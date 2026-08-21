// main.js -- isometric sprite-stacking renderer + game loop.
// Faithful Canvas 2D port of main.py.
import * as S from "./settings.js";
import { lerp, clamp, rad, rgb, rgba } from "./utils.js";
import {
  newCanvas, loadImage, blitCentered, blitMidbottom, scaleTo, scaleBy,
  cropToBounds, pixelate8bit, wash, boundingRect,
} from "./gfx.js";
import { Player, NPC, AmbientNPC } from "./entities.js";
import { Draw } from "./draw_order.js";
import { audio } from "./audio.js";
import { Story } from "./story.js";
import { makeAmbientNpcPlaceholder } from "./ui.js";
import * as minigame_data from "./minigame_data.js";

const { WINDOW_WIDTH: W, WINDOW_HEIGHT: H, TILESIZE, FLOOR_COVERAGE, ZOOM, UP_OFFSET, THEME } = S;

const canvas = document.getElementById("game");
canvas.width = W; canvas.height = H;
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false; // crisp pixel art by default

// ---------------- rotation / scale helpers ----------------
// pygame.transform.rotate rotates CCW for positive angle; canvas rotates CW,
// so we negate. Returns a canvas sized to the rotated bounding box.
function rotateImage(img, deg) {
  const r = -deg * Math.PI / 180;
  const w = img.width, h = img.height;
  const c = Math.abs(Math.cos(r)), s = Math.abs(Math.sin(r));
  const nw = Math.max(1, Math.ceil(w * c + h * s));
  const nh = Math.max(1, Math.ceil(w * s + h * c));
  const { canvas: cv, ctx: cx } = newCanvas(nw, nh);
  cx.imageSmoothingEnabled = false;
  cx.translate(nw / 2, nh / 2);
  cx.rotate(r);
  cx.drawImage(img, -w / 2, -h / 2);
  return cv;
}

// ---------------- input ----------------
const input = { down: false, x: 0, y: 0, px: 0, py: 0, dx: 0, dy: 0, button: 0 };
function toCanvas(e) {
  const r = canvas.getBoundingClientRect();
  const cx = (e.clientX - r.left) * (W / r.width);
  const cy = (e.clientY - r.top) * (H / r.height);
  return [cx, cy];
}
let story = null;
function dispatch(type, x, y, button = 0) {
  if (story) story.handle_event({ type, pos: [x, y], button });
}
canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  const [x, y] = toCanvas(e);
  input.down = true; input.x = x; input.y = y; input.px = x; input.py = y;
  input.dx = 0; input.dy = 0;
  input.button = e.button;
  dispatch("mousedown", x, y, e.button);
  audio.play_bgm();
});
canvas.addEventListener("pointermove", (e) => {
  const [x, y] = toCanvas(e);
  input.dx = x - input.x; input.dy = y - input.y;
  input.x = x; input.y = y;
  dispatch("mousemove", x, y);
});
window.addEventListener("pointerup", (e) => {
  const [x, y] = toCanvas(e);
  dispatch("mouseup", x, y, input.button);
  input.down = false; input.dx = 0; input.dy = 0;
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

// ---------------- main ----------------
async function main() {
  // Start audio first: begins buffering bgm.ogg and registers the tap-to-unlock
  // listener before any sprites load, so the soundtrack is ready to play the
  // moment the user first taps (even while still on the loading screen).
  audio.init();

  // ensure pixel font is ready before first text render (skipped when the
  // USE_PIXEL_FONT toggle is off -- the fallback font needs no preloading)
  if (S.USE_PIXEL_FONT) { try { await document.fonts.load(`16px ${S.FONT_FAMILY}`); } catch (e) {} }

  let zoom = ZOOM, base_zoom = ZOOM, render_zoom = zoom;
  const CONVO_ZOOM = 1.0;
  let direction = 0;

  const hcells = Math.floor(Math.ceil(W / TILESIZE) * FLOOR_COVERAGE);
  const tablesTiles = S.allTiles.filter((t) => t[2] === 1);
  const maxTableY = tablesTiles.reduce((m, t) => Math.max(m, t[1]), 0);
  const vcells = maxTableY + 3;
  const HW = W / 2, HH = H / 2;

  const ROTATION_SNAP_DEG = 5;
  const snapDir = (d) => Math.round(d / ROTATION_SNAP_DEG) * ROTATION_SNAP_DEG;
  const ZOOM_SNAP_STEP = 0.15;
  const snapZoom = (z) => Math.round(z / ZOOM_SNAP_STEP) * ZOOM_SNAP_STEP;
  const SCALE_SNAP_STEP = 0.05;
  const snapScale = (s) => Math.round(Math.round(s / SCALE_SNAP_STEP) * SCALE_SNAP_STEP * 1000) / 1000;

  const swipe_speed = [1, 1];
  let scale_raw = 0.5;
  let scale = snapScale(scale_raw);

  // ---- load images ----
  const safe = (p) => loadImage(p);
  const [concreteRaw, computerSprite, windowTex, boss_png, tm1_png, tm2_png,
    idChar, edChar, deskPlant, cornerPlant, logo] = await Promise.all([
    safe("sprites/concrete_nonshaded.png"), safe("sprites/monitor.png"),
    safe("sprites/window.png"), safe("sprites/boss.png"), safe("sprites/teammate1.png"),
    safe("sprites/teammate2.png"), safe("sprites/ID_character.png"), safe("sprites/ED_character.png"),
    safe("sprites/desk_plant.png"), safe("sprites/corner_plant.png"), safe("sprites/logo.jpeg"),
  ]);

  // ---- procedural neutral-office textures ----
  function flatTile(color, seam, grain) {
    const { canvas: c, ctx: cx } = newCanvas(TILESIZE, TILESIZE);
    cx.fillStyle = rgb(color); cx.fillRect(0, 0, TILESIZE, TILESIZE);
    if (grain) {
      const im = cx.getImageData(0, 0, TILESIZE, TILESIZE);
      for (let i = 0; i < TILESIZE * 2; i++) {
        const x = (Math.random() * TILESIZE) | 0, y = (Math.random() * TILESIZE) | 0;
        const d = ((Math.random() * (grain * 2 + 1)) | 0) - grain;
        const o = (y * TILESIZE + x) * 4;
        im.data[o] = clamp(im.data[o] + d, 0, 255);
        im.data[o + 1] = clamp(im.data[o + 1] + d, 0, 255);
        im.data[o + 2] = clamp(im.data[o + 2] + d, 0, 255);
      }
      cx.putImageData(im, 0, 0);
    }
    if (seam) { cx.strokeStyle = rgb(seam); cx.lineWidth = 1; cx.strokeRect(0.5, 0.5, TILESIZE - 1, TILESIZE - 1); }
    return c;
  }
  const green_tile = flatTile(S.THEME_FLOOR_A, S.THEME_FLOOR_SEAM, S.THEME_FLOOR_GRAIN);
  const white_tile = flatTile(S.THEME_FLOOR_B, S.THEME_FLOOR_SEAM, S.THEME_FLOOR_GRAIN);
  const computer_table = flatTile(S.THEME_DESK_TOP, S.THEME_DESK_EDGE, 0);
  const wooden_bar = (() => {
    const { canvas: c, ctx: cx } = newCanvas(TILESIZE, TILESIZE);
    cx.fillStyle = rgb(S.THEME_DESK_EDGE); cx.fillRect(0, 13, TILESIZE, 5); return c;
  })();
  const concrete_wall = wash(concreteRaw, S.THEME_WALL_WASH[0], S.THEME_WALL_WASH[1], S.THEME_WALL_WASH[2], S.THEME_WALL_WASH[3]);
  const textures = [concrete_wall, computer_table, wooden_bar, windowTex];

  function makeMuted(img) {
    const small = scaleTo(img, Math.max(1, img.width / 4), Math.max(1, img.height / 4), true);
    return scaleTo(small, img.width, img.height, true);
  }
  const wall_muted = makeMuted(concrete_wall);

  // ---- 8-bit role avatars + portraits ----
  const id_8bit = pixelate8bit(idChar, 72);
  const ed_8bit = pixelate8bit(edChar, 72);
  const avatarFrom = (pix, boxH) => scaleTo(pix, (pix.width * boxH) / pix.height, boxH, false);
  const id_avatar = avatarFrom(id_8bit, 100);
  const ed_avatar = avatarFrom(ed_8bit, 100);

  // ---- player + map ----
  const player = new Player((hcells * TILESIZE) / 2, 2 * TILESIZE);

  const allTiles = S.allTiles.map((t) => t.slice());
  // wooden bars on each table tile
  for (const t of allTiles.slice()) if (t[2] === 1) allTiles.push([t[0], t[1], 2, 10, 5]);
  // walls
  for (let y = 0; y < vcells; y++) {
    for (let x = 0; x < hcells; x++) {
      const isCorner = (x === 0 || x === hcells - 1) && (y === 0 || y === vcells - 1);
      const isHEdge = y === 0 || y === vcells - 1;
      const isVEdge = x === 0 || x === hcells - 1;
      if (!(isHEdge || isVEdge)) continue;
      if (isVEdge && !isCorner && !isHEdge) allTiles.push([x, y, 3, 0, 12]);
      else allTiles.push([x, y, 0, 0, 20]);
    }
  }
  const maxTileX = Math.max(...allTiles.map((t) => t[0])) + 2;
  const maxTileYAll = Math.max(...allTiles.map((t) => t[1])) + 2;
  const geoW = Math.max(hcells, maxTileX), geoH = Math.max(vcells, maxTileYAll);
  const geometry = Array.from({ length: geoH }, () => new Array(geoW).fill(0));
  for (const t of allTiles) geometry[t[1]][t[0]] = 1;

  // ---- entities (functional NPCs) ----
  // Surfaces are assigned raw here; they're re-sized just below (once the npc
  // pose sprites load) to match the ambient coworkers' on-screen size.
  const chairPos = (tile) => [tile[0] * TILESIZE + 16, (tile[1] - 1) * TILESIZE + 16];
  const boss = new NPC(6 * TILESIZE + 16, 2 * TILESIZE + 16, boss_png);
  const t1c = chairPos(S.STORY_TEAMMATE1_DESK_TILE);
  const t2c = chairPos(S.STORY_TEAMMATE2_DESK_TILE);
  const teammate1 = new NPC(t1c[0], t1c[1], tm1_png);
  const teammate2 = new NPC(t2c[0], t2c[1], tm2_png);

  const story_positions = {
    boss: [boss.x, boss.y],
    id_desk: chairPos(S.STORY_ID_DESK_TILE),
    teammate1: [teammate1.x - TILESIZE, teammate1.y],
    teammate2: [teammate2.x - TILESIZE, teammate2.y],
  };
  const computer_positions = {
    id_desk: [S.STORY_ID_DESK_TILE[0] * TILESIZE + 16, S.STORY_ID_DESK_TILE[1] * TILESIZE + 16],
    teammate1: [S.STORY_TEAMMATE1_DESK_TILE[0] * TILESIZE + 16, S.STORY_TEAMMATE1_DESK_TILE[1] * TILESIZE + 16],
    teammate2: [S.STORY_TEAMMATE2_DESK_TILE[0] * TILESIZE + 16, S.STORY_TEAMMATE2_DESK_TILE[1] * TILESIZE + 16],
  };

  function worldToScreen(wx, wy) {
    const pX = wx - player.x, pY = wy - player.y;
    const d = snapDir(direction);
    const ux = HW + Math.cos(rad(-d)) * pX - Math.sin(rad(-d)) * pY;
    const uy = HH + (Math.sin(rad(-d)) * pX + Math.cos(rad(-d)) * pY) * scale + UP_OFFSET;
    return [HW + render_zoom * (ux - HW), HH + render_zoom * (uy - HH)];
  }

  // ---- NPC frames (sprites/npc/*.png) grouped by identity ----
  const NPC_FILES = ["npc1_idle", "npc1_work", "npc1_talk", "npc1_sleep",
    "npc2_idle", "npc2_working", "npc2_talk", "npc2_sleep",
    "npc3_idle", "npc3_work", "npc3_talk", "npc3_sleep",
    "npc4_idle", "npc4_work", "npc4_talk", "npc4_sleep"];
  const npcImgs = await Promise.all(NPC_FILES.map((n) => safe(`sprites/npc/${n}.png`)));
  const npc_frames = {};
  NPC_FILES.forEach((n, i) => {
    const m = n.match(/(npc\d+)_(.+)/);
    (npc_frames[m[1]] = npc_frames[m[1]] || {})[m[2]] = npcImgs[i];
  });
  const npc_identities = Object.keys(npc_frames).sort();
  const poseFor = (who, preferWork) => {
    const f = npc_frames[who];
    const order = preferWork ? ["work", "working", "idle"] : ["idle", "work", "working"];
    for (const p of order) if (f[p]) return f[p];
    for (const k of Object.keys(f)) if (k !== "sleep" && k !== "talk") return f[k];
    return Object.values(f)[0];
  };

  // Normalise the functional NPCs (Boss / Lan / Hung) to the same on-screen size
  // as the ambient coworkers, so the whole room reads at one consistent scale.
  // Match a shared *content* height (opaque pixels) averaged across the ambient
  // standing poses -- robust even if the source sprites fill their frames
  // differently -- rather than a fixed frame scale.
  {
    const contentH = (img) => boundingRect(img).h;
    const pool = [];
    for (const who of npc_identities) {
      const f = npc_frames[who];
      for (const k of ["idle", "work", "working"]) if (f[k] && f[k].width > 1) pool.push(f[k]);
    }
    const targetH = pool.length
      ? Math.round(pool.reduce((s, im) => s + contentH(im), 0) / pool.length) : 46;
    const sizeToNpc = (png) => { const fct = targetH / Math.max(1, contentH(png)); return scaleBy(png, fct, fct, false); };
    boss.surface = sizeToNpc(boss_png);
    teammate1.surface = sizeToNpc(tm1_png);
    teammate2.surface = sizeToNpc(tm2_png);
  }

  // ---- player animation frames ----
  async function loadPlayerFrames(prefix, sf = 1.4) {
    const frames = {};
    for (const [state, names] of [["idle", [`${prefix}_idle`]], ["talk", [`${prefix}_talk`]],
      ["walk", [`${prefix}_walk1`, `${prefix}_walk2`]]]) {
      const loaded = [];
      for (const nm of names) {
        const img = await safe(`sprites/player/${nm}.png`);
        loaded.push(scaleBy(img, sf, sf, false));
      }
      frames[state] = loaded;
    }
    return frames;
  }
  const player_frames = { id: await loadPlayerFrames("orange"), eld: await loadPlayerFrames("grey") };

  // ---- ambient NPCs (baked) + functional NPCs baked in ----
  const ambient = [];
  const reserved = new Set([S.STORY_ID_DESK_TILE, S.STORY_TEAMMATE1_DESK_TILE, S.STORY_TEAMMATE2_DESK_TILE].map((t) => `${t[0]},${t[1]}`));
  let ambI = 0;
  for (const t of allTiles) {
    if (t[2] === 1 && !reserved.has(`${t[0]},${t[1]}`)) {
      let sprite;
      if (npc_identities.length) {
        const who = npc_identities[ambI % npc_identities.length];
        sprite = poseFor(who, Math.floor(ambI / npc_identities.length) % 2 === 0);
      } else sprite = makeAmbientNpcPlaceholder(S.AMBIENT_NPC_COLORS[ambI % S.AMBIENT_NPC_COLORS.length]);
      ambient.push(new AmbientNPC(t[0] * TILESIZE + 16, (t[1] - 1) * TILESIZE + 16, sprite));
      ambI++;
    }
  }
  ambient.push(boss, teammate1, teammate2); // functional NPCs baked -> correct depth

  // character-creator result thumbnails
  const charPool = [];
  for (const who of npc_identities) {
    const f = npc_frames[who];
    charPool.push(f.idle || f.talk || f.work || f.working);
  }
  for (const pf of [player_frames.id, player_frames.eld]) if (pf && pf.idle) charPool.push(pf.idle[0]);
  if (charPool.length) minigame_data.CHARACTER_GAMES.teammate2_character.result_sprites = charPool;

  // computer / plant positions
  const all_computer_positions = [];
  for (const t of allTiles) if (t[2] === 1) all_computer_positions.push([t[0] * TILESIZE + 16, t[1] * TILESIZE + 16 - S.COMPUTER_Y_OFFSET]);
  const desk_plant_positions = [];
  for (const t of allTiles) if (t[2] === 1) desk_plant_positions.push([t[0] * TILESIZE + TILESIZE - 4, t[1] * TILESIZE + 8]);
  const corner_plant_positions = [
    [1 * TILESIZE + 16, 1 * TILESIZE + 16],
    [(hcells - 2) * TILESIZE + 16, 1 * TILESIZE + 16],
    [1 * TILESIZE + 16, (vcells - 2) * TILESIZE + 16],
    [(hcells - 2) * TILESIZE + 16, (vcells - 2) * TILESIZE + 16],
  ];

  // ---- story ----
  story = new Story(player, geometry, story_positions, computer_positions, worldToScreen,
    { id: id_avatar, eld: ed_avatar });
  story.npc_sprites = { boss: boss_png, teammate1: tm1_png, teammate2: tm2_png };
  story.player_portraits = { id: id_8bit, eld: ed_8bit };
  story.player_frames = player_frames;
  story.room_snapshot_provider = () => canvas;
  story.ctx = ctx; // used to lay out minigames (text metrics)

  // ---------------- caches ----------------
  const _sprite_zoom_cache = new Map();
  function getZoomedSprite(surf) {
    if (Math.abs(render_zoom - 1.0) < 0.001) return surf;
    const key = surf._id || (surf._id = ++_sid);
    const k = key + "|" + render_zoom;
    let c = _sprite_zoom_cache.get(k);
    if (!c) { c = scaleBy(surf, render_zoom, render_zoom, false); _sprite_zoom_cache.set(k, c); }
    return c;
  }
  let _sid = 0;

  const _rotation_cache_all = new Map();
  const _floor_cache_all = new Map();
  const CACHE_CAP = 220;
  const PROTECTED_SCALE = snapScale(0.5);
  function evict(cache) {
    if (cache.size <= CACHE_CAP) return;
    for (const k of cache.keys()) {
      if (parseFloat(k.split("|")[1]) !== PROTECTED_SCALE) {
        cache.delete(k);
        if (cache.size <= CACHE_CAP) return;
      }
    }
  }

  function buildRotationCaches(renderDir, cacheScale, cacheZoom) {
    const caches = [];
    for (let idx = 0; idx < textures.length; idx++) {
      let height = 0, z = 0;
      if (idx === 0) height = 20; else if (idx === 1) height = 10; else if (idx === 3) height = 12; else { height = 5; z = 10; }
      const tex = idx === 0 ? wall_muted : textures[idx];
      const rotated = rotateImage(tex, renderDir);
      const tw = scaleTo(rotated, rotated.width * cacheZoom, rotated.height * cacheScale * cacheZoom, false);
      const dsH = Math.round(tw.height * (height + z) * 2) + 2;
      const { canvas: ds, ctx: dcx } = newCanvas(tw.width, dsH);
      dcx.imageSmoothingEnabled = false;
      const cx = ds.width / 2, cy = ds.height / 2;
      const step = 2 * cacheZoom, zbase = z * 4 * cacheZoom;
      if (idx === 3) dcx.globalCompositeOperation = "lighten"; // window: blend max-ish
      for (let i = 0; i < height; i++) {
        blitCentered(dcx, tw, cx, cy - zbase - i * step);
      }
      dcx.globalCompositeOperation = "source-over";
      caches.push(ds);
    }
    return caches;
  }
  function getRotationCaches() {
    const key = `${snapDir(direction)}|${Math.round(scale * 1000) / 1000}|${render_zoom}`;
    let c = _rotation_cache_all.get(key);
    if (!c) { c = buildRotationCaches(snapDir(direction), Math.round(scale * 1000) / 1000, render_zoom); _rotation_cache_all.set(key, c); evict(_rotation_cache_all); }
    return c;
  }

  // ---- floor buffer ----
  const { canvas: floorbuff, ctx: fbx } = newCanvas(hcells * TILESIZE, vcells * TILESIZE);
  fbx.imageSmoothingEnabled = false;
  for (let y = 0; y < vcells; y++)
    for (let x = 0; x < hcells; x++)
      fbx.drawImage((Math.abs(x) + Math.abs(y)) % 2 === 0 ? green_tile : white_tile, x * TILESIZE, y * TILESIZE);
  const floor_ready = floorbuff;
  let _floor_cache = null, _floor_cache_key = null;
  function getFloorCache(dirR, scaleR, rz) {
    const key = `${dirR}|${scaleR}|${rz}`;
    if (_floor_cache_key === key) return _floor_cache;
    let c = _floor_cache_all.get(key);
    if (!c) {
      const rot = rotateImage(floor_ready, dirR);
      c = scaleTo(rot, rot.width * rz, rot.height * scaleR * rz, false);
      _floor_cache_all.set(key, c); evict(_floor_cache_all);
    }
    _floor_cache = c; _floor_cache_key = key;
    return c;
  }

  // ---- bake_world (behind / front offscreen layers) ----
  let _baked_behind = null, _baked_front = null;
  let _baked_dir = null, _baked_scale = null, _baked_zoom = null, _baked_pos = null;
  const BAKE_REFRESH_DIST = 32;
  const player_screen_y = HH + UP_OFFSET;

  function bakeWorld() {
    const dirR = snapDir(direction);
    const cosd = Math.cos(rad(-dirR)), sind = Math.sin(rad(-dirR));
    const caches = getRotationCaches();
    const aX = HW - player.x, aY = HH - player.y;
    const cameraX = HW + cosd * aX - sind * aY;
    const cameraY = HH + (sind * aX + cosd * aY) * scale;
    const cox = HW - cameraX, coy = HH - cameraY;
    const rz = render_zoom, ts = TILESIZE, tsH = TILESIZE / 2;
    const px_p = player.x, py_p = player.y;
    const cullMin = -100, cullMaxX = W + 100, cullMaxY = H + 100;
    const lastWallRow = vcells - 1;

    const behind = [], front = [];
    // tiles
    for (const wall of allTiles) {
      const dX = wall[0] * ts + tsH - HW, dY = wall[1] * ts + tsH - HH;
      const dwx = HW + cosd * dX - sind * dY - cox;
      const dwy = HH + (sind * dX + cosd * dY) * scale - coy + UP_OFFSET;
      if (dwx < cullMin || dwx > cullMaxX || dwy < cullMin || dwy > cullMaxY) continue;
      if (wall[2] === 0 && wall[1] === lastWallRow && dwy > player_screen_y) continue;
      const anchorY = dwy + wall[3] * 2;
      const zx = HW + rz * (dwx - HW), zy = HH + rz * (anchorY - HH);
      (anchorY > player_screen_y ? front : behind).push([anchorY, zx, zy, caches[wall[2]]]);
    }
    // computers
    const zc = getZoomedSprite(computerSprite);
    const compHalf = zc.height / 2, compLift = S.COMPUTER_DESK_LIFT * rz;
    for (const [wx, wy] of all_computer_positions) {
      const pX = wx - px_p, pY = wy - py_p;
      const sx = HW + cosd * pX - sind * pY, sy = HH + (sind * pX + cosd * pY) * scale + UP_OFFSET;
      if (sx < cullMin || sx > cullMaxX || sy < cullMin || sy > cullMaxY) continue;
      const zx = HW + rz * (sx - HW), zy = HH + rz * (sy - compHalf - compLift - HH);
      (sy > player_screen_y ? front : behind).push([sy, zx, zy, zc]);
    }
    // ambient + functional NPCs
    for (const npc of ambient) {
      const s = getZoomedSprite(npc.surf());
      const pX = npc.x - px_p, pY = npc.y - py_p;
      const sx = HW + cosd * pX - sind * pY, sy = HH + (sind * pX + cosd * pY) * scale + UP_OFFSET;
      if (sx < cullMin || sx > cullMaxX || sy < cullMin || sy > cullMaxY) continue;
      const zx = HW + rz * (sx - HW), zy = HH + rz * (sy - s.height / 2 - HH);
      (sy > player_screen_y ? front : behind).push([sy, zx, zy, s]);
    }
    // desk plants
    const zdp = getZoomedSprite(deskPlant), dpHalf = zdp.height / 2, dpLift = (S.COMPUTER_DESK_LIFT + 4) * rz;
    for (const [wx, wy] of desk_plant_positions) {
      const pX = wx - px_p, pY = wy - py_p;
      const sx = HW + cosd * pX - sind * pY, sy = HH + (sind * pX + cosd * pY) * scale + UP_OFFSET;
      if (sx < cullMin || sx > cullMaxX || sy < cullMin || sy > cullMaxY) continue;
      const zx = HW + rz * (sx - HW), zy = HH + rz * (sy - dpHalf - dpLift - HH);
      (sy > player_screen_y ? front : behind).push([sy, zx, zy, zdp]);
    }
    // corner plants
    const zcp = getZoomedSprite(cornerPlant), cpHalf = zcp.height / 2;
    for (const [wx, wy] of corner_plant_positions) {
      const pX = wx - px_p, pY = wy - py_p;
      const sx = HW + cosd * pX - sind * pY, sy = HH + (sind * pX + cosd * pY) * scale + UP_OFFSET;
      if (sx < cullMin || sx > cullMaxX || sy < cullMin || sy > cullMaxY) continue;
      const zx = HW + rz * (sx - HW), zy = HH + rz * (sy - cpHalf - HH);
      (sy > player_screen_y ? front : behind).push([sy, zx, zy, zcp]);
    }

    behind.sort((a, b) => a[0] - b[0]);
    front.sort((a, b) => a[0] - b[0]);
    const bakeLayer = (list) => {
      const { canvas: c, ctx: cx } = newCanvas(W, H);
      cx.imageSmoothingEnabled = false;
      for (const [, x, y, surf] of list) blitCentered(cx, surf, x, y);
      return c;
    };
    _baked_behind = bakeLayer(behind);
    _baked_front = bakeLayer(front);
    _baked_dir = dirR; _baked_scale = Math.round(scale * 1000) / 1000; _baked_zoom = render_zoom;
    _baked_pos = [player.x, player.y];
  }

  // pre-bake only the initial angle; the rest warm lazily / progressively
  const startupScale = Math.round(scale * 1000) / 1000, startupZoom = render_zoom;
  {
    const k = `${snapDir(direction)}|${startupScale}|${startupZoom}`;
    _rotation_cache_all.set(k, buildRotationCaches(snapDir(direction), startupScale, startupZoom));
    const rot = rotateImage(floor_ready, snapDir(direction));
    _floor_cache_all.set(k, scaleTo(rot, rot.width * startupZoom, rot.height * startupScale * startupZoom, false));
  }
  const warmPending = [];
  for (let d = 0; d < 360; d += ROTATION_SNAP_DEG) if (d !== snapDir(direction)) warmPending.push(d);
  warmPending.sort((a, b) => Math.min((a - direction + 360) % 360, (direction - a + 360) % 360) - Math.min((b - direction + 360) % 360, (direction - b + 360) % 360));

  // hide the HTML loading screen -- assets are ready
  const loaderEl = document.getElementById("loader");
  if (loaderEl) { loaderEl.classList.add("hidden"); setTimeout(() => loaderEl.remove(), 500); }

  // ---------------- update + render ----------------
  function update() {
    // camera drag (free-roam only): rotate + up/down look
    const modal = story.dialogue_box || story.active_minigame || story.buttons.length ||
      story.transition || story.show_end_screen || story.convo_scene;
    if (input.down && !modal && (Math.abs(input.dx) > 0.01 || Math.abs(input.dy) > 0.01)) {
      const swipeDir = input.y > HH + UP_OFFSET ? 1 : -1;
      let interp = Math.abs(input.dx) > 0.01 ? 0.2 : 0.05;
      swipe_speed[0] = lerp(swipe_speed[0], (input.dx / 5) * swipeDir, interp);
      direction += swipe_speed[0];
      if (direction >= 360) direction -= 360; if (direction < 0) direction += 360;
      interp = Math.abs(input.dy) >= 0.01 ? 0.2 : 0.05;
      swipe_speed[1] = lerp(swipe_speed[1], input.dy / 300, interp);
      scale_raw = clamp(scale_raw + swipe_speed[1], 0.3, 0.75);
    }
    input.dx = 0; input.dy = 0;
    scale = snapScale(scale_raw);

    story.update();

    const targetZoom = story.in_conversation ? CONVO_ZOOM : base_zoom;
    if (Math.abs(zoom - targetZoom) < 0.03) zoom = targetZoom;
    else zoom = lerp(zoom, targetZoom, 0.06);
    render_zoom = snapZoom(zoom);
  }

  function render() {
    const convo = story.convo_scene;
    const worldHidden = convo && convo._alpha >= 255;
    if (!worldHidden) {
      const dirR = snapDir(direction);
      const cosd = Math.cos(rad(-dirR)), sind = Math.sin(rad(-dirR));
      const applyZoom = (ux, uy) => [HW + render_zoom * (ux - HW), HH + render_zoom * (uy - HH)];
      const scaleR = Math.round(scale * 1000) / 1000;

      const fc = getFloorCache(dirR, scaleR, render_zoom);
      const fX = floorbuff.width / 2 - player.x, fY = floorbuff.height / 2 - player.y;
      const dfx = HW + cosd * fX - sind * fY, dfy = HH + (sind * fX + cosd * fY) * scale + UP_OFFSET;
      const [zdfx, zdfy] = applyZoom(dfx, dfy);
      ctx.fillStyle = THEME.WORLD_BG; ctx.fillRect(0, 0, W, H);
      blitCentered(ctx, fc, zdfx, zdfy);

      if (_baked_dir !== dirR || _baked_scale !== scaleR || _baked_zoom !== render_zoom ||
        !_baked_behind || Math.abs(player.x - _baked_pos[0]) > BAKE_REFRESH_DIST ||
        Math.abs(player.y - _baked_pos[1]) > BAKE_REFRESH_DIST) bakeWorld();

      const pdx = player.x - _baked_pos[0], pdy = player.y - _baked_pos[1];
      const shx = -render_zoom * (cosd * pdx - sind * pdy);
      const shy = -render_zoom * ((sind * pdx + cosd * pdy) * scale);

      ctx.drawImage(_baked_behind, shx, shy);

      const psurf = player.surf();
      if (psurf) {
        const zp = getZoomedSprite(psurf);
        const psy = HH + UP_OFFSET + player.bob_offset();
        const [zpx, zpy] = applyZoom(HW, psy);
        Draw.add_call(zpx, zpy - zp.height / 2, zpy, zp);
      }
      Draw.render_calls(ctx);
      ctx.drawImage(_baked_front, shx, shy);

      // progressive warm one angle/frame while idle
      if (warmPending.length && !worldHidden && !input.down) {
        const wd = warmPending.shift();
        const k = `${wd}|${startupScale}|${startupZoom}`;
        if (!_rotation_cache_all.has(k)) { _rotation_cache_all.set(k, buildRotationCaches(wd, startupScale, startupZoom)); }
        if (!_floor_cache_all.has(k)) { const rot = rotateImage(floor_ready, wd); _floor_cache_all.set(k, scaleTo(rot, rot.width * startupZoom, rot.height * startupScale * startupZoom, false)); }
      }
    }
    story.draw(ctx);
  }

  // fixed 60Hz update, render each frame
  let acc = 0, last = performance.now();
  const STEP = 1000 / 60;
  const MAX_BACKLOG = STEP * 5; // drop time if we fall too far behind (tab throttling)
  function frame(now) {
    acc = Math.min(acc + (now - last), MAX_BACKLOG); last = now;
    let steps = 0;
    while (acc >= STEP && steps < 5) { update(); acc -= STEP; steps++; }
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.__story = story; window.__step = (n = 1) => { for (let i = 0; i < n; i++) update(); render(); }; // TEMP debug
}

main().catch((e) => { console.error("MAIN FAILED:", (e && e.stack) || e); });
