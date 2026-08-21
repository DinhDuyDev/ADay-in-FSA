// ui.js -- reusable widgets, ported from ui.py to Canvas 2D.
import * as S from "./settings.js";
import { audio } from "./audio.js";
import {
  newCanvas, blitCentered, blitMidbottom, fillRoundRect, strokeRoundRect,
  roundRectPath, setFont, fitText, wrapText, drawLines, cropToBounds, pixelFitH, flipH,
} from "./gfx.js";
import { clamp } from "./utils.js";

const T = S.THEME;
const inRect = (r, [x, y]) => x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3];

function parseRGB(s) {
  const m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(s);
  return m ? [+m[1], +m[2], +m[3]] : [0, 0, 0];
}
const lighten = (c, a) => { const [r, g, b] = parseRGB(c); return `rgb(${clamp(r + a, 0, 255)},${clamp(g + a, 0, 255)},${clamp(b + a, 0, 255)})`; };
const darken = (c, a) => lighten(c, -a);

// ---- panels ----
export function drawPanel(ctx, rect, { radius = T.CARD_RADIUS, bg = T.BG, border = T.BORDER, bw = 2, shadow = true } = {}) {
  const [x, y, w, h] = rect;
  if (shadow) { ctx.save(); ctx.globalAlpha = 0.16; fillRoundRect(ctx, x, y + 3, w, h, radius, "rgb(0,0,0)"); ctx.restore(); }
  fillRoundRect(ctx, x, y, w, h, radius, bg);
  if (bw > 0) strokeRoundRect(ctx, x, y, w, h, radius, border, bw);
}

// ---- Button ----
export class Button {
  constructor(rect, text, onClick, opts = {}) {
    this.rect = rect; // [x,y,w,h]
    this.text = text;
    this.onClick = onClick;
    this.bg = opts.bg || T.PRIMARY;
    this.hover = opts.hover || T.PRIMARY_HOVER;
    this.textColor = opts.textColor || "rgb(255,255,255)";
    this.image = opts.image || null;
    this.baseSize = opts.baseSize || S.BASE_FONT_SIZE;
    this.minSize = opts.minSize || S.MIN_FONT_SIZE;
    this.sfx = opts.sfx === undefined ? "click" : opts.sfx;
    this.hovered = false; this.pressed = false;
    this._scale = 1; this._vel = 0;
    this._prep = null;
  }
  _prepare(ctx) {
    const [, , w, h] = this.rect;
    let availW = Math.max(10, w - 16), availH = Math.max(10, h - 16);
    if (this.image) availH = Math.max(10, availH - this.image.height - 6);
    const fitres = fitText(ctx, this.text.replace(/\n/g, " "), availW, availH, this.baseSize, this.minSize);
    this._prep = fitres;
  }
  handle_event(e) {
    const [x, y, w, h] = this.rect;
    if (e.type === "mousemove") { this.hovered = inRect(this.rect, e.pos); if (this.pressed && !this.hovered) this.pressed = false; }
    else if (e.type === "mousedown" && e.button === 0) {
      if (inRect(this.rect, e.pos)) { this.pressed = true; this.hovered = true; this._vel += -0.08; if (this.sfx) audio.play_sfx(this.sfx); return true; }
    } else if (e.type === "mouseup" && e.button === 0) {
      const was = this.pressed; this.pressed = false;
      if (was && inRect(this.rect, e.pos)) { if (this.onClick) this.onClick(); return true; }
    }
    return false;
  }
  _spring() {
    const target = this.pressed ? 0.92 : (this.hovered ? 1.06 : 1.0);
    this._vel = (this._vel + (target - this._scale) * 0.22) * 0.72;
    this._scale += this._vel;
  }
  draw(ctx) {
    if (!this._prep) this._prepare(ctx);
    this._spring();
    const [x, y, w, h] = this.rect;
    const base = this.hovered ? this.hover : this.bg;
    const r = T.BUTTON_RADIUS;
    const cx = x + w / 2, cy = y + h / 2;
    const sc = this._scale;
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.translate(-cx, -cy);
    // shadow
    ctx.save(); ctx.globalAlpha = 0.22; fillRoundRect(ctx, x, y + 2, w, h, r, "rgb(0,0,0)"); ctx.restore();
    // gradient fill
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, lighten(base, 14)); g.addColorStop(1, darken(base, 10));
    fillRoundRect(ctx, x, y, w, h, r, g);
    if (this.hovered) strokeRoundRect(ctx, x, y, w, h, r, lighten(base, 40), 2);
    // content
    let yc = y + 8;
    if (this.image) { blitCentered(ctx, this.image, x + w / 2, yc + this.image.height / 2); yc += this.image.height + 6; }
    setFont(ctx, this._prep.size, false);
    ctx.fillStyle = this.textColor; ctx.textAlign = "center"; ctx.textBaseline = "top";
    let ty = yc;
    for (const line of this._prep.lines) { ctx.fillText(line, x + w / 2, ty); ty += this._prep.lineHeight; }
    ctx.textAlign = "left";
    ctx.restore();
  }
}

// ---- DialogueBox ----
export class DialogueBox {
  constructor(rect, lines, onComplete, speakerNames = null, speaker = "right") {
    this.rect = rect;
    this.lines = lines;
    this.char_speed = S.DIALOGUE_TEXT_SPEED;
    this.onComplete = onComplete;
    this.PAUSE = S.DIALOGUE_PAUSE_FRAMES;
    this.speakerNames = speakerNames || {};
    this.headerH = this.speakerNames && Object.keys(this.speakerNames).length ? 40 : 0;
    this.speaker = speaker; this._curSpeaker = speaker;
    this.line_index = 0; this.char_index = 0; this.finished = false; this._pause = 0;
    this._display = ""; this._size = S.DIALOGUE_BASE_FONT_SIZE; this._wrapped = [];
    this._lineH = 0;
    this._prepared = false;
  }
  get is_typing() { return !this.finished && this.char_index < this._display.length; }
  get current_speaker() { return this._curSpeaker; }

  _prepareLine(ctx) {
    if (!this.lines || this.line_index >= this.lines.length) { this._display = ""; return; }
    let raw = this.lines[this.line_index];
    this._curSpeaker = this.speaker;
    for (const [tag, side] of [["[speaker=left]", "left"], ["[speaker=right]", "right"]]) {
      if (raw.startsWith(tag)) { this._curSpeaker = side; raw = raw.slice(tag.length).trimStart(); break; }
    }
    const availW = Math.max(10, this.rect[2] - 40), availH = Math.max(10, this.rect[3] - 24 - this.headerH);
    const fr = fitText(ctx, raw, availW, availH, S.DIALOGUE_BASE_FONT_SIZE, S.DIALOGUE_MIN_FONT_SIZE);
    this._size = fr.size; this._wrapped = fr.lines; this._lineH = fr.lineHeight;
    this._display = fr.lines.join("\n");
  }
  _advance() {
    if (!this.lines) return;
    this.line_index++; this.char_index = 0; this._pause = 0; this._prepared = false;
    if (this.line_index >= this.lines.length) { this.finished = true; if (this.onComplete) this.onComplete(); }
  }
  handle_event(e) {
    if (this.finished) return;
    if (e.type === "mousedown" && e.button === 0 && inRect(this.rect, e.pos)) this._advance();
  }
  // map the current speaker to a synth voice (see VOICES in audio.js)
  _voice() {
    const name = ((this.speakerNames && this.speakerNames[this._curSpeaker]) || "").toLowerCase();
    if (this._curSpeaker === "left" || name === "you") return "player";
    if (name.includes("boss")) return "boss";
    if (name.includes("lan")) return "lan";
    if (name.includes("hung")) return "hung";
    return "npc";
  }
  update() {
    if (this.finished || !this.lines) return;
    if (this.char_index < this._display.length) {
      const before = Math.floor(this.char_index);
      this.char_index = Math.min(this.char_index + this.char_speed, this._display.length);
      const after = Math.floor(this.char_index);
      // play a soft speech blip for each newly revealed character
      for (let i = before; i < after; i++) audio.speak(this._display[i], { voice: this._voice() });
    } else { this._pause++; if (this._pause >= this.PAUSE) this._advance(); }
  }
  draw(ctx) {
    if (this.finished || !this.lines) return;
    if (!this._prepared) { this._prepareLine(ctx); this._prepared = true; }
    const [x, y, w, h] = this.rect;
    const rad = T.CARD_RADIUS;
    const corners = { tl: 0, tr: 0, br: rad, bl: rad };
    // shadow
    ctx.save(); ctx.globalAlpha = 0.15; fillRoundRect(ctx, x, y + 5, w, h, rad, "rgb(0,0,0)", corners); ctx.restore();
    fillRoundRect(ctx, x, y, w, h, rad, T.BG, corners);
    strokeRoundRect(ctx, x, y, w, h, rad, T.BORDER, 2, corners);

    let tx = x + 20, ty = y + 14;
    if (this.headerH) {
      const name = this.speakerNames[this._curSpeaker || ""];
      if (name) {
        setFont(ctx, 15, true);
        const tw = ctx.measureText(name).width;
        const pw = tw + 24, ph = 26;
        const pill = this._curSpeaker === "left" ? T.PRIMARY : T.PRIMARY_DARK;
        fillRoundRect(ctx, tx, ty, pw, ph, ph / 2, pill);
        ctx.fillStyle = "rgb(255,255,255)"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(name, tx + pw / 2, ty + ph / 2 + 1); ctx.textAlign = "left";
        ty += ph + 8;
        ctx.strokeStyle = T.BORDER; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x + 20, ty - 2); ctx.lineTo(x + w - 20, ty - 2); ctx.stroke();
        ty += 8;
      }
    }
    const n = Math.floor(this.char_index);
    const revealed = this._display.slice(0, n).split("\n");
    setFont(ctx, this._size, false); ctx.fillStyle = T.TEXT; ctx.textBaseline = "top"; ctx.textAlign = "left";
    let yy = ty;
    for (const line of revealed) { ctx.fillText(line, tx, yy); yy += this._lineH; }
    // blinking chevron
    if (this.char_index >= this._display.length && Math.floor(Date.now() / 400) % 2 === 0) {
      setFont(ctx, 18, true); ctx.fillStyle = T.TEXT_MUTED; ctx.textAlign = "right"; ctx.textBaseline = "bottom";
      ctx.fillText("▸", x + w - 16, y + h - 10); ctx.textAlign = "left";
    }
  }
}

// ---- ConversationScene ----
function makeOutline(sprite, color = "rgb(20,15,12)") {
  const { canvas, ctx } = newCanvas(sprite.width, sprite.height);
  ctx.drawImage(sprite, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color; ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}
function hasOpaque(img) {
  if (!img) return false;
  try { const bb = cropToBounds(img); return bb.width > 1 || bb.height > 1; } catch (e) { return true; }
}
export class ConversationScene {
  constructor(left, right, { background = null, leftName = "", rightName = "" } = {}) {
    this.width = S.WINDOW_WIDTH; this.height = S.WINDOW_HEIGHT;
    this.left = hasOpaque(left) ? left : null;
    this.right = hasOpaque(right) ? right : null;
    this.leftName = this.left ? leftName : ""; this.rightName = this.right ? rightName : "";
    this.hasCustomBg = !!background;
    this._alpha = 0; this._fadingOut = false; this.finished_fade_out = false;
    this._speaking = null; this._bob = 0;
    this._outlineL = this.left ? makeOutline(this.left) : null;
    this._rightFlipped = this.right ? flipH(this.right) : null;
    this._outlineR = this._rightFlipped ? makeOutline(this._rightFlipped) : null;
    const hasL = !!this.left, hasR = !!this.right;
    if (hasL && hasR) { this._lx = this.width * 0.28; this._rx = this.width * 0.72; }
    else if (hasL) { this._lx = this.width * 0.5; this._rx = null; }
    else if (hasR) { this._lx = null; this._rx = this.width * 0.5; }
    else { this._lx = null; this._rx = null; }
    this.background = background;
    this.npc_key = null;
  }
  start_fade_out() { this._fadingOut = true; }
  update() {
    if (this._fadingOut) { this._alpha = Math.max(0, this._alpha - 14); if (this._alpha <= 0) this.finished_fade_out = true; }
    else this._alpha = Math.min(255, this._alpha + 14);
  }
  get visible() { return this._alpha > 0; }
  set_speaking(s) { this._speaking = s; }
  _bobOffset(side) {
    if (this._speaking === side) {
      // livelier bounce while this character is talking
      const phase = (this._bob / 7) * 2 * Math.PI;
      return Math.round(-Math.abs(Math.sin(phase)) * 5);
    }
    // gentle idle "breathing" so the listener isn't frozen (phase offset per side)
    return Math.round(Math.sin((this._bob + (side === "left" ? 0 : 24)) / 42) * 1.2);
  }
  // little animated "chatter" bubble above a talking head: a rounded speech
  // bubble with a downward tail and three dots that bob in a wave.
  _drawChatterBubble(ctx, cx, headTopY) {
    const phase = this._bob;
    const pulse = 1 + Math.sin(phase / 6) * 0.06;            // gentle breathing pop
    const bw = 42, bh = 26;
    const bx = Math.round(cx - bw / 2);
    const by = Math.round(headTopY - bh - 10 + Math.sin(phase / 9) * 1.5); // slight float
    ctx.save();
    ctx.translate(cx, by + bh); ctx.scale(pulse, pulse); ctx.translate(-cx, -(by + bh));
    ctx.save(); ctx.globalAlpha = 0.16; fillRoundRect(ctx, bx, by + 3, bw, bh, 11, "rgb(0,0,0)"); ctx.restore();
    // tail first, so the rounded body edge covers its top
    ctx.fillStyle = "rgb(255,255,255)";
    ctx.beginPath();
    ctx.moveTo(cx - 6, by + bh - 2); ctx.lineTo(cx + 6, by + bh - 2); ctx.lineTo(cx, by + bh + 9); ctx.closePath(); ctx.fill();
    fillRoundRect(ctx, bx, by, bw, bh, 11, "rgb(255,255,255)");
    strokeRoundRect(ctx, bx, by, bw, bh, 11, "rgb(60,45,30)", 2);
    ctx.strokeStyle = "rgb(60,45,30)"; ctx.lineWidth = 2; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(cx - 6, by + bh - 1); ctx.lineTo(cx, by + bh + 9); ctx.lineTo(cx + 6, by + bh - 1); ctx.stroke();
    // three chattering dots
    const cyd = by + bh / 2, gap = 11, dotR = 3;
    for (let i = 0; i < 3; i++) {
      const dx = cx - gap + i * gap;
      const up = Math.max(0, Math.sin(phase / 5 - i * 0.7)) * 4;
      ctx.fillStyle = T.PRIMARY;
      ctx.beginPath(); ctx.arc(dx, cyd - up, dotR, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  _drawOutlined(ctx, sprite, outline, cx, by) {
    const x = Math.round(cx - sprite.width / 2), y = Math.round(by - sprite.height);
    if (outline) for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) ctx.drawImage(outline, x + dx, y + dy);
    ctx.drawImage(sprite, x, y);
  }
  _nameTag(ctx, name, cx, topY) {
    setFont(ctx, 16, false);
    const tw = ctx.measureText(name).width, w = tw + 12, h = 24;
    const x = cx - w / 2;
    fillRoundRect(ctx, x, topY, w, h, 6, "rgb(255,255,255)");
    strokeRoundRect(ctx, x, topY, w, h, 6, "rgb(60,45,30)", 2);
    ctx.fillStyle = T.TEXT; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(name, cx, topY + h / 2 + 1); ctx.textAlign = "left";
  }
  draw(ctx) {
    if (this._alpha <= 0) return;
    this._bob++;
    const a = Math.min(1, this._alpha / 255);
    ctx.save(); ctx.globalAlpha = a;
    if (this.background) ctx.drawImage(this.background, 0, 0, this.width, this.height);
    else { ctx.fillStyle = T.WORLD_BG; ctx.fillRect(0, 0, this.width, this.height); }
    if (!this.hasCustomBg && this._alpha > 100) {
      const groundY = Math.round(this.height * 0.78);
      if (this.left && this._lx != null) {
        const oy = this._alpha >= 255 ? this._bobOffset("left") : 0;
        this._drawOutlined(ctx, this.left, this._outlineL, this._lx, groundY + oy);
        if (this._alpha >= 255 && this._speaking === "left")
          this._drawChatterBubble(ctx, this._lx, groundY + oy - this.left.height);
      }
      if (this._rightFlipped && this._rx != null) {
        const oy = this._alpha >= 255 ? this._bobOffset("right") : 0;
        this._drawOutlined(ctx, this._rightFlipped, this._outlineR, this._rx, groundY + oy);
        if (this._alpha >= 255 && this._speaking === "right")
          this._drawChatterBubble(ctx, this._rx, groundY + oy - this._rightFlipped.height);
      }
    }
    ctx.restore();
  }
}

// ---- ComputerTransition ----
export class ComputerTransition {
  constructor(startRect, endRect, duration, label, onComplete) {
    this.startRect = startRect; this.endRect = endRect;
    this.duration = Math.max(1, duration); this.timer = 0; this.done = false;
    this.label = label || ""; this.onComplete = onComplete;
  }
  _resolve(r) { return typeof r === "function" ? r() : r; }
  update() { if (this.done) return; this.timer++; if (this.timer >= this.duration) { this.done = true; if (this.onComplete) this.onComplete(); } }
  current_rect() {
    const s = this._resolve(this.startRect), e = this._resolve(this.endRect);
    let t = Math.min(1, this.timer / this.duration); t = t * t * (3 - 2 * t);
    return [s[0] + (e[0] - s[0]) * t, s[1] + (e[1] - s[1]) * t, s[2] + (e[2] - s[2]) * t, s[3] + (e[3] - s[3]) * t];
  }
  draw(ctx) {
    const [x, y, w, h] = this.current_rect();
    fillRoundRect(ctx, x, y, w, h, 14, T.SURFACE_DARK);
    strokeRoundRect(ctx, x, y, w, h, 14, T.PRIMARY, 2);
    const ix = x + w * 0.04, iy = y + h * 0.06, iw = w * 0.92, ih = h * 0.88;
    fillRoundRect(ctx, ix, iy, iw, ih, 8, T.SCREEN_DARK);
    if (this.label && w > 100 && h > 60) {
      const fr = fitText(ctx, this.label, iw - 16, ih - 16, 12, 8);
      setFont(ctx, fr.size, false); ctx.fillStyle = T.TEXT_ON_DARK; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      let yy = y + h / 2 - (fr.lines.length * fr.lineHeight) / 2 + fr.lineHeight / 2;
      for (const line of fr.lines) { ctx.fillText(line, x + w / 2, yy); yy += fr.lineHeight; }
      ctx.textAlign = "left";
    }
  }
}

// ---- ConfettiEffect ----
export class ConfettiEffect {
  constructor(rect, count = 90, duration = 110) {
    this.rect = rect; this.duration = duration; this.timer = 0;
    this.colors = ["rgb(255,140,40)", "rgb(255,178,90)", "rgb(230,100,30)", "rgb(255,210,140)", "rgb(214,70,35)", "rgb(255,235,190)"];
    this.parts = Array.from({ length: count }, () => this._mk());
  }
  _mk() {
    const [x, y, w] = this.rect;
    return { x: x + Math.random() * w, y: y - 60 + Math.random() * 60, vx: -1.3 + Math.random() * 2.6, vy: 2 + Math.random() * 2.5, size: 4 + Math.random() * 4, angle: Math.random() * 360, spin: -8 + Math.random() * 16, color: this.colors[(Math.random() * this.colors.length) | 0] };
  }
  get finished() { return this.timer >= this.duration; }
  update() {
    this.timer++;
    const [rx, ry, rw, rh] = this.rect;
    for (const p of this.parts) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.angle += p.spin;
      if (p.y > ry + rh + 20) { Object.assign(p, this._mk()); p.y = ry - 10 - Math.random() * 50; }
    }
  }
  draw(ctx) {
    for (const p of this.parts) {
      const r = (p.angle * Math.PI) / 180, ca = Math.cos(r), sa = Math.sin(r), s = p.size;
      ctx.fillStyle = p.color; ctx.beginPath();
      const pts = [[-s, -s / 2], [s, -s / 2], [s, s / 2], [-s, s / 2]];
      pts.forEach(([dx, dy], i) => { const rx = dx * ca - dy * sa, ry = dx * sa + dy * ca; i ? ctx.lineTo(p.x + rx, p.y + ry) : ctx.moveTo(p.x + rx, p.y + ry); });
      ctx.closePath(); ctx.fill();
    }
  }
}

// ---- FeedbackOverlay ----
export class FeedbackOverlay {
  constructor(rect, isCorrect) { this.rect = rect; this.ok = isCorrect; this.timer = 0; this.finished = false; this.DUR = 28; }
  update() { this.timer++; if (this.timer >= this.DUR) this.finished = true; }
  draw(ctx) {
    const t = this.timer / this.DUR; const [x, y, w, h] = this.rect;
    if (this.ok) { const inten = Math.sin(t * Math.PI) * 0.25; ctx.fillStyle = `rgba(95,173,97,${inten})`; ctx.fillRect(x, y, w, h); }
    else { const shake = Math.sin(this.timer * 1.8) * 6 * (1 - t); const inten = Math.sin(t * Math.PI) * 0.3; ctx.fillStyle = `rgba(222,84,66,${inten})`; ctx.fillRect(x + shake, y, w, h); }
  }
}

// ---- placeholders ----
export function ImagePlaceholder(w, h, label = "IMAGE") {
  const { canvas, ctx } = newCanvas(w, h);
  strokeRoundRect(ctx, 1, 1, w - 2, h - 2, 8, T.PRIMARY, 2);
  setFont(ctx, 12, false); ctx.fillStyle = T.PRIMARY; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(label, w / 2, h / 2);
  return canvas;
}
export function makeAmbientNpcPlaceholder(color = [150, 130, 120], w = 26, h = 44) {
  const { canvas, ctx } = newCanvas(w, h);
  ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
  const headR = w * 0.34;
  ctx.beginPath(); ctx.arc(w / 2, headR + 2, headR, 0, Math.PI * 2); ctx.fill();
  fillRoundRect(ctx, 0, headR * 1.7, w, h - headR * 1.7, w * 0.32, `rgb(${color[0]},${color[1]},${color[2]})`);
  return canvas;
}

// text helpers used by minigames/story
export { fitText, wrapText, drawLines, setFont } from "./gfx.js";
export function drawWrapped(ctx, text, x, y, maxW, maxH, base, min, color, bold = false) {
  const fr = fitText(ctx, text, maxW, maxH, base, min, bold);
  return { end: drawLines(ctx, fr.lines, x, y, fr.size, color, bold, fr.lineHeight), fr };
}
