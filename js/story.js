// story.js -- state machine, ported from story.py.
import * as S from "./settings.js";
import * as dialogue_data from "./dialogue_data.js";
import * as minigame_data from "./minigame_data.js";
import { audio } from "./audio.js";
import {
  Button, DialogueBox, ComputerTransition, ConfettiEffect, ConversationScene,
  fitText, drawLines, setFont,
} from "./ui.js";
import { OrderingGame, QuizGame, CharacterCreatorGame, VideoTrimGame } from "./minigames.js";
import { pixelFitH, fillRoundRect, strokeRoundRect, scaleTo } from "./gfx.js";

const { WINDOW_WIDTH: W, WINDOW_HEIGHT: H, UP_OFFSET, UI_TEXT, THEME: T } = S;

const DLG_RECT = [0, 0, W, H * 0.25];
const MOVE_STAGES = new Set(["id_move_to_desk", "id_move_to_teammate1", "eld_move_to_teammate2", "return_to_boss"]);
const CONVO_KEEP = new Set([
  "computer_zoom_in", "computer_zoom_out", "id_ordering_game", "id_quiz_game",
  "eld_character_game", "eld_trim_game", "eld_task1_congrats",
  "teammate1_intro", "teammate1_thanks", "teammate2_intro", "teammate2_thanks",
  "boss_intro", "boss_end",
]);
const NAME_MAP = { boss: "Boss", teammate1: "Lan", teammate2: "Hung" };

export class Story {
  constructor(player, geometry, positions, computerPositions, worldToScreen, avatars) {
    this.player = player; this.geometry = geometry; this.positions = positions;
    this.computer_positions = computerPositions; this.worldToScreen = worldToScreen;
    this.avatars = avatars || {};
    this.ctx = null; // set by main

    this.stage = null; this.fall_timer = 0; this.fall_target_y = 0;
    this.dialogue_box = null; this.active_minigame = null; this.buttons = [];
    this.transition = null; this.hosted_bezel_rect = null; this.confetti = null;
    this.show_end_screen = false; this._zoom_target = null; this._zoom_key = null;
    this.chosen_path = null; this.has_completed_a_path = false;
    this.in_conversation = false; this.convo_scene = null;
    this.npc_sprites = {}; this.player_portraits = {}; this.player_frames = {};
    this.room_snapshot_provider = null; this._convo_names = {};

    this.FALL_START_OFFSET = -400; this.FALL_DURATION_FRAMES = 60; this.ZOOM_DURATION_FRAMES = 22;

    const [lx, ly] = this.positions.boss;
    player.x = player.real_x = lx; player.dest_x = lx; player.dest_y = ly;
    this.fall_target_y = ly; player.real_y = ly + this.FALL_START_OFFSET; player.y = player.real_y;

    this._enter_stage("intro_fall");
  }

  // ---- zoom helpers ----
  _icon_rect_at(key, size = [46, 34]) {
    const [sx, sy] = this.worldToScreen(...this.computer_positions[key]);
    return [sx - size[0] / 2, sy - size[1] / 2, size[0], size[1]];
  }
  _full_screen_rect() { const w = W - 16, h = H - 40; return [W / 2 - w / 2, H / 2 + 10 - h / 2, w, h]; }
  _zoom_in_to(target, key) { this._zoom_target = target; this._zoom_key = key; this._enter_stage("computer_zoom_in"); }
  _zoom_out_to(target, key) { this._zoom_target = target; this._zoom_key = key; this._enter_stage("computer_zoom_out"); }

  _host_minigame(cls, data, onSolved) {
    const maxRect = this._full_screen_rect();
    const inner0 = [maxRect[0] + 6, maxRect[1] + 8, maxRect[2] - 12, maxRect[3] - 16];
    let mg = new cls(inner0, data, onSolved);
    if (mg._layout && this.ctx) mg._layout(this.ctx);
    let actualH = mg.content_height ? mg.content_height() : null;
    if (actualH && actualH < inner0[3]) {
      const bezelH = actualH + 16 + 24;
      const bezel = [maxRect[0], maxRect[1] + maxRect[3] / 2 - bezelH / 2, maxRect[2], bezelH];
      this.hosted_bezel_rect = bezel;
      const inner = [bezel[0] + 6, bezel[1] + 8, bezel[2] - 12, bezel[3] - 16];
      mg = new cls(inner, data, onSolved);
      if (mg._layout && this.ctx) mg._layout(this.ctx);
    } else this.hosted_bezel_rect = maxRect;
    this.active_minigame = mg;
  }

  _enter_stage(stage) {
    this.stage = stage;
    this.dialogue_box = null; this.active_minigame = null; this.buttons = [];
    this.transition = null; this.hosted_bezel_rect = null; this.confetti = null;
    this.show_end_screen = false; this.in_conversation = false;

    if (!CONVO_KEEP.has(stage)) { if (this.convo_scene && !this.convo_scene._fadingOut) this.convo_scene.start_fade_out(); }

    const P = this.positions, geo = this.geometry, pl = this.player;
    switch (stage) {
      case "intro_fall": this.fall_timer = 0; break;
      case "boss_intro":
        this.in_conversation = true; this._start_conversation("boss");
        this.dialogue_box = this._dlg("boss_intro", () => this._enter_stage("role_selection")); break;
      case "role_selection": this._build_role_selection_buttons(); break;

      case "id_move_to_desk": pl.move_to(...P.id_desk, geo); break;
      case "id_ordering_game":
        this._host_minigame(OrderingGame, minigame_data.ORDERING_GAMES.id_desk,
          (ok) => this._show_result_and_continue(ok, () => this._zoom_out_to("id_move_to_teammate1", "id_desk"), "id_desk")); break;
      case "id_move_to_teammate1": pl.move_to(...P.teammate1, geo); break;
      case "teammate1_intro":
        this.in_conversation = true; this._start_conversation("teammate1");
        this.dialogue_box = this._dlg("teammate1_intro", () => this._zoom_in_to("id_quiz_game", "teammate1")); break;
      case "id_quiz_game":
        this._host_minigame(QuizGame, minigame_data.QUIZ_GAMES.teammate1,
          (ok) => this._show_result_and_continue(ok, () => this._zoom_out_to("teammate1_thanks", "teammate1"), "teammate1")); break;
      case "teammate1_thanks":
        this.in_conversation = true; this._start_conversation("teammate1");
        this.dialogue_box = this._dlg("teammate1_thanks", () => this._enter_stage("return_to_boss")); break;

      case "eld_move_to_teammate2": pl.move_to(...P.teammate2, geo); break;
      case "teammate2_intro":
        this.in_conversation = true; this._start_conversation("teammate2");
        this.dialogue_box = this._dlg("teammate2_intro", () => this._zoom_in_to("eld_character_game", "teammate2")); break;
      case "eld_character_game":
        this._host_minigame(CharacterCreatorGame, minigame_data.CHARACTER_GAMES.teammate2_character,
          () => this._celebrate_and_continue(() => this._zoom_out_to("eld_task1_congrats", "teammate2"), "character_creator")); break;
      case "eld_task1_congrats":
        this.in_conversation = true; this._start_conversation("teammate2");
        this.dialogue_box = this._dlg("eld_task1_congrats", () => this._zoom_in_to("eld_trim_game", "teammate2")); break;
      case "eld_trim_game":
        this._host_minigame(VideoTrimGame, minigame_data.VIDEO_TRIM_GAMES.teammate2_trim,
          () => this._celebrate_and_continue(() => this._zoom_out_to("teammate2_thanks", "teammate2"), "video_trim")); break;
      case "teammate2_thanks":
        this.in_conversation = true; this._start_conversation("teammate2");
        this.dialogue_box = this._dlg("teammate2_thanks", () => this._enter_stage("return_to_boss")); break;

      case "computer_zoom_in":
        this.transition = new ComputerTransition(() => this._icon_rect_at(this._zoom_key), this._full_screen_rect(),
          this.ZOOM_DURATION_FRAMES, "booting up...", () => this._enter_stage(this._zoom_target)); break;
      case "computer_zoom_out":
        this.transition = new ComputerTransition(this._full_screen_rect(), () => this._icon_rect_at(this._zoom_key),
          this.ZOOM_DURATION_FRAMES, "", () => this._enter_stage(this._zoom_target)); break;

      case "return_to_boss": pl.move_to(...P.boss, geo); break;
      case "boss_end":
        this.in_conversation = true; this._start_conversation("boss");
        this.dialogue_box = this._dlg("boss_end", () => this._enter_stage("game_end")); break;
      case "game_end":
        this.show_end_screen = true;
        this.confetti = new ConfettiEffect([0, 0, W, H], 140, 100000); break;
    }
  }

  _dlg(key, onComplete) { return new DialogueBox(DLG_RECT, dialogue_data.DIALOGUE[key], onComplete, this._convo_names); }

  _show_continue_button(onClick) {
    this.buttons = [new Button([W / 2 - 60, H - 60, 120, 36], UI_TEXT.continue, onClick)];
  }
  _celebrate_and_continue(onClick, id) { this._show_result_and_continue(true, onClick, id); }
  _show_result_and_continue(ok, onClick, id) {
    if (ok) { this.confetti = new ConfettiEffect([0, 0, W, H], 90, 110); audio.play_sfx("confetti"); }
    if (id != null) audio.play_minigame_result(id, ok); else audio.play_sfx(ok ? "correct" : "wrong");
    this._show_continue_button(onClick);
  }

  _build_role_selection_buttons() {
    const bw = 140, bh = 160, gap = 20, totalW = bw * 2 + gap;
    const sx = W / 2 - totalW / 2, y = H / 2 - bh / 2 - (this.has_completed_a_path ? 24 : 0);
    this.buttons = [
      new Button([sx, y, bw, bh], "Instructional Designer", () => this._choose_path("id"),
        { bg: T.BG_ALT, hover: T.PRIMARY_LIGHT, textColor: T.TEXT, image: this.avatars.id }),
      new Button([sx + bw + gap, y, bw, bh], "E-Learning Developer", () => this._choose_path("eld"),
        { bg: T.BG_ALT, hover: T.PRIMARY_LIGHT, textColor: T.TEXT, image: this.avatars.eld }),
    ];
    if (this.has_completed_a_path)
      this.buttons.push(new Button([W / 2 - 80, y + bh + 20, 160, 44], UI_TEXT.end_day,
        () => this._enter_stage("boss_end"), { bg: T.PRIMARY_DARK, hover: T.PRIMARY_DARK_HOVER }));
  }

  _choose_path(path) {
    this.chosen_path = path;
    if (this.avatars[path]) this.player.set_sprite(scaleTo(this.avatars[path], 40, 70, false));
    if (this.player_frames && this.player_frames[path]) this.player.set_frames(this.player_frames[path]);
    if (path === "id") this._enter_stage("id_move_to_desk"); else this._enter_stage("eld_move_to_teammate2");
  }

  _start_conversation(npcKey) {
    this._convo_names = { left: "You", right: NAME_MAP[npcKey] || "" };
    if (this.convo_scene && this.convo_scene.npc_key === npcKey && !this.convo_scene._fadingOut) return;
    const PLAYER_H = Math.floor(H * 0.45), NPC_H = Math.floor(H * 0.375);
    let playerSrc = (this.player_portraits && this.player_portraits[this.chosen_path]) || this.avatars[this.chosen_path];
    const left = playerSrc ? pixelFitH(playerSrc, PLAYER_H) : null;
    const npcSrc = this.npc_sprites[npcKey];
    const right = npcSrc ? pixelFitH(npcSrc, NPC_H) : null;
    this.convo_scene = new ConversationScene(left, right, { leftName: "", rightName: "", background: null });
    this.convo_scene.npc_key = npcKey;
  }

  // ---- main-loop hooks ----
  handle_event(e) {
    if (this.dialogue_box) this.dialogue_box.handle_event(e);
    if (this.active_minigame) this.active_minigame.handle_event(e);
    for (const b of this.buttons) b.handle_event(e);
  }
  update() {
    if (this.confetti && !this.confetti.finished) this.confetti.update();
    if (this.convo_scene) {
      this.convo_scene.update();
      if (this.dialogue_box && this.dialogue_box.is_typing) this.convo_scene.set_speaking(this.dialogue_box.current_speaker);
      else this.convo_scene.set_speaking(null);
      if (this.convo_scene.finished_fade_out) this.convo_scene = null;
    }
    if (this.stage === "intro_fall") { this._update_fall(); return; }
    if (this.stage === "computer_zoom_in" || this.stage === "computer_zoom_out") { this.transition.update(); return; }
    if (MOVE_STAGES.has(this.stage)) {
      this.player.movement();
      if (this.player.has_arrived()) {
        if (this.stage === "id_move_to_desk") this._zoom_in_to("id_ordering_game", "id_desk");
        else if (this.stage === "id_move_to_teammate1") this._enter_stage("teammate1_intro");
        else if (this.stage === "eld_move_to_teammate2") this._enter_stage("teammate2_intro");
        else if (this.stage === "return_to_boss") { this.has_completed_a_path = true; this._enter_stage("role_selection"); }
      }
      return;
    }
    if (this.dialogue_box) this.dialogue_box.update();
    if (this.active_minigame) this.active_minigame.update();
  }
  _update_fall() {
    this.fall_timer++;
    const t = Math.min(1, this.fall_timer / this.FALL_DURATION_FRAMES);
    const te = 1 - (1 - t) ** 2;
    const startY = this.fall_target_y + this.FALL_START_OFFSET;
    this.player.real_y = startY + (this.fall_target_y - startY) * te;
    this.player.y = this.player.real_y;
    if (t >= 1) this._enter_stage("boss_intro");
  }
  draw(ctx) {
    if (this.convo_scene && this.convo_scene.visible) this.convo_scene.draw(ctx);
    if (this.show_end_screen) {
      ctx.save(); ctx.globalAlpha = 190 / 255; ctx.fillStyle = T.SURFACE_DARK; ctx.fillRect(0, 0, W, H); ctx.restore();
      const fr = fitText(ctx, "The End — thanks for playing today!", W - 80, 140, 22, 14);
      setFont(ctx, fr.size, false); ctx.fillStyle = T.TEXT_ON_DARK; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      let yy = H / 2 - (fr.lines.length * fr.lineHeight) / 2 + fr.lineHeight / 2;
      for (const line of fr.lines) { ctx.fillText(line, W / 2, yy); yy += fr.lineHeight; }
      ctx.textAlign = "left";
    }
    if (this.transition) this.transition.draw(ctx);
    if (this.hosted_bezel_rect) { fillRoundRect(ctx, ...this.hosted_bezel_rect, 14, T.SURFACE_DARK); strokeRoundRect(ctx, ...this.hosted_bezel_rect, 14, T.PRIMARY, 2); }
    if (this.dialogue_box) this.dialogue_box.draw(ctx);
    if (this.active_minigame) this.active_minigame.draw(ctx);
    for (const b of this.buttons) b.draw(ctx);
    if (this.confetti) this.confetti.draw(ctx);
  }
}
