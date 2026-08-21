// minigames.js -- ported from minigames.py to Canvas 2D.
import * as S from "./settings.js";
import {
  Button, FeedbackOverlay, ImagePlaceholder, drawPanel, drawWrapped, fitText, drawLines, setFont,
} from "./ui.js";
import { fillRoundRect, strokeRoundRect, scaleTo, cropToBounds } from "./gfx.js";

const T = S.THEME;
const SECONDARY = { bg: T.BG_ALT, hover: T.PRIMARY_LIGHT, textColor: T.TEXT };
const inRect = (r, [x, y]) => x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3];
const fbColor = (ok) => (ok ? T.SUCCESS : T.ERROR);

export class OrderingGame {
  constructor(rect, data, onComplete) {
    this.rect = rect; this.prompt = data.prompt; this.correct = data.correct_order;
    this.onComplete = onComplete; this.items = data.items.map((i) => ({ ...i }));
    this.grip = 22; this.dragIndex = null; this.dragOffY = 0;
    this.promptLines = null; this.feedback = ""; this.attempted = false; this.solved = false;
    this._fx = null; this._pending = null;
    // layout computed lazily on first draw (needs ctx for text metrics)
    this._laid = false;
  }
  _layout(ctx) {
    const [rx, ry, rw, rh] = this.rect;
    const pf = fitText(ctx, this.prompt, rw - 40, 70, 14, S.MIN_FONT_SIZE);
    this.promptLines = pf; const promptH = pf.lines.length * pf.lineHeight;
    const hint = fitText(ctx, S.UI_TEXT.drag_hint, rw - 40, 24, 11, S.MIN_FONT_SIZE);
    this.hint = hint; const hintH = hint.lines.length * hint.lineHeight;
    this.barsStartY = 12 + promptH + 4 + hintH + 8;
    const n = this.items.length, submitZone = 56;
    const availH = rh - this.barsStartY - submitZone;
    this.barGap = 6;
    this.barH = Math.max(36, Math.min(60, Math.floor((availH - (n - 1) * this.barGap) / n)));
    this._itemText = {};
    const barW = rw - 40 - 20 - this.grip, barTh = this.barH - 8;
    for (const it of this.items) this._itemText[it.id] = fitText(ctx, it.text, barW, barTh, S.BASE_FONT_SIZE, S.MIN_FONT_SIZE);
    const submitY = ry + this.barsStartY + n * (this.barH + this.barGap) + 6;
    this.submit = new Button([rx + rw / 2 - 70, submitY, 140, 36], S.UI_TEXT.submit, () => this._submit());
    this._laid = true;
  }
  _barRect(i) { const [rx, ry, rw] = this.rect; return [rx + 20, ry + this.barsStartY + i * (this.barH + this.barGap), rw - 40, this.barH]; }
  _submit() {
    if (this._fx && !this._fx.finished) return;
    const order = this.items.map((i) => i.id);
    const ok = order.length === this.correct.length && order.every((v, i) => v === this.correct[i]);
    const first = !this.attempted; this.attempted = true;
    this._fx = new FeedbackOverlay(this.rect, ok);
    if (ok) { this.solved = true; this.feedback = "Correct!"; }
    else { this.feedback = "Not quite — rearrange and try Again, or continue anyway."; this.submit.text = S.UI_TEXT.again; this.submit._prep = null; }
    if (first && this.onComplete) this._pending = () => this.onComplete(ok);
  }
  content_height() { const n = this.items.length; return this.barsStartY + n * (this.barH + this.barGap) + 60; }
  handle_event(e) {
    if (this.solved || !this._laid) return;
    this.submit.handle_event(e);
    if (e.type === "mousedown" && e.button === 0) {
      for (let i = 0; i < this.items.length; i++) if (inRect(this._barRect(i), e.pos)) { this.dragIndex = i; this.dragOffY = e.pos[1] - this._barRect(i)[1]; break; }
    } else if (e.type === "mouseup" && e.button === 0) this.dragIndex = null;
    else if (e.type === "mousemove" && this.dragIndex != null) {
      const [rx, ry] = this.rect;
      const targetY = e.pos[1] - this.dragOffY;
      let ni = Math.round((targetY - (ry + this.barsStartY)) / (this.barH + this.barGap));
      ni = Math.max(0, Math.min(this.items.length - 1, ni));
      if (ni !== this.dragIndex) { const it = this.items.splice(this.dragIndex, 1)[0]; this.items.splice(ni, 0, it); this.dragIndex = ni; }
    }
  }
  update() { if (this._fx) { this._fx.update(); if (this._fx.finished) { this._fx = null; if (this._pending) { const c = this._pending; this._pending = null; c(); } } } }
  draw(ctx) {
    if (!this._laid) this._layout(ctx);
    drawPanel(ctx, this.rect);
    const [rx, ry] = this.rect;
    let y = drawLines(ctx, this.promptLines.lines, rx + 20, ry + 12, this.promptLines.size, T.TEXT, false, this.promptLines.lineHeight);
    drawLines(ctx, this.hint.lines, rx + 20, y + 4, this.hint.size, T.TEXT_MUTED, false, this.hint.lineHeight);
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i], [bx, by, bw, bh] = this._barRect(i);
      fillRoundRect(ctx, bx, by, bw, bh, 8, i === this.dragIndex ? T.PRIMARY_LIGHT : T.BG_ALT);
      strokeRoundRect(ctx, bx, by, bw, bh, 8, T.BORDER, 1);
      // grip dots
      ctx.fillStyle = T.TEXT_MUTED;
      for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) { ctx.beginPath(); ctx.arc(bx + 9 + c * 6, by + bh / 2 - 7 + r * 7, 1.6, 0, Math.PI * 2); ctx.fill(); }
      const fr = this._itemText[it.id]; const totalH = fr.lines.length * fr.lineHeight;
      let ty = by + bh / 2 - totalH / 2;
      drawLines(ctx, fr.lines, bx + this.grip, ty, fr.size, T.TEXT, false, fr.lineHeight);
    }
    if (!this.solved) this.submit.draw(ctx);
    if (this.feedback && !this._fx) { const fy = this.submit.rect[1] - 26; drawWrapped(ctx, this.feedback, rx + 20, fy, this.rect[2] - 40, 30, 13, 9, fbColor(this.solved)); }
    if (this._fx) this._fx.draw(ctx);
  }
}

export class QuizGame {
  constructor(rect, data, onComplete) {
    this.rect = rect; this.question = data.question; this.answers = data.answers; this.onComplete = onComplete;
    this.solved = false; this.feedback = ""; this._fx = null; this._pending = null; this._laid = false;
  }
  _layout(ctx) {
    const [rx, ry, rw] = this.rect;
    this.qf = fitText(ctx, this.question, rw - 40, 64, 15, S.MIN_FONT_SIZE);
    const qh = this.qf.lines.length * this.qf.lineHeight;
    let by = ry + 20 + qh + 12; const bh = 48, gap = 8;
    this.buttons = this.answers.map((a, i) => new Button([rx + 20, by + i * (bh + gap), rw - 40, bh], a.text, () => this._choose(a), SECONDARY));
    this._laid = true;
  }
  _choose(a) {
    if (this.solved || this._fx) return;
    this._fx = new FeedbackOverlay(this.rect, a.correct); this.solved = true;
    this.feedback = a.correct ? "Correct!" : "Not quite — let's keep going.";
    if (this.onComplete) this._pending = () => this.onComplete(a.correct);
  }
  content_height() { const qh = this.qf ? this.qf.lines.length * this.qf.lineHeight : 40; return 20 + qh + 12 + this.answers.length * (48 + 8) + 50; }
  handle_event(e) { if (this.solved || !this._laid) return; for (const b of this.buttons) b.handle_event(e); }
  update() { if (this._fx) { this._fx.update(); if (this._fx.finished) { this._fx = null; if (this._pending) { const c = this._pending; this._pending = null; c(); } } } }
  draw(ctx) {
    if (!this._laid) this._layout(ctx);
    drawPanel(ctx, this.rect); const [rx, ry] = this.rect;
    drawLines(ctx, this.qf.lines, rx + 20, ry + 20, this.qf.size, T.TEXT, false, this.qf.lineHeight);
    if (!this.solved) for (const b of this.buttons) b.draw(ctx);
    if (this.feedback && !this._fx) drawWrapped(ctx, this.feedback, rx + 20, this.rect[1] + this.rect[3] - 30, this.rect[2] - 40, 30, 13, 9, fbColor(this.solved));
    if (this._fx) this._fx.draw(ctx);
  }
}

export class CharacterCreatorGame {
  constructor(rect, data, onComplete) {
    this.rect = rect; this.types = data.types; this.descriptions = data.descriptions || [];
    this.resultSprites = data.result_sprites || []; this.onComplete = onComplete;
    this.stage = "select_type"; this.selType = null; this.selDesc = null; this.chosen = null; this.feedback = "";
    this._laid = false;
  }
  _layout(ctx) {
    const [rx, ry, rw] = this.rect;
    this.pf = fitText(ctx, "Choose a character type and a vibe, then generate.", rw - 32, 44, S.BASE_FONT_SIZE, S.MIN_FONT_SIZE);
    const gridTop = ry + 14 + this.pf.lines.length * this.pf.lineHeight + 6;
    const cols = 3, rows = 2, pad = 8;
    const cardW = (rw - 24 - (cols - 1) * pad) / cols, cardH = 62;
    this.typeButtons = this.types.slice(0, cols * rows).map((ctype, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      return new Button([rx + 12 + col * (cardW + pad), gridTop + row * (cardH + pad), cardW, cardH], ctype.title, () => this._selType(ctype), { ...SECONDARY, baseSize: 14 });
    });
    const gridBottom = gridTop + rows * cardH + (rows - 1) * pad;
    let chipY = gridBottom + 12; const chipH = 36;
    this.descButtons = this.descriptions.map((d, i) => new Button([rx + 12, chipY + i * (chipH + 6), rw - 24, chipH], d, () => this._selDesc(d), { ...SECONDARY, baseSize: 14 }));
    const chipsBottom = chipY + this.descriptions.length * (chipH + 6);
    this.genButton = new Button([rx + rw / 2 - 90, chipsBottom + 14, 180, 36], S.UI_TEXT.generate, () => this._generate());
    this.resultButtons = [];
    this._laid = true;
  }
  _selType(t) { this.selType = t; this.feedback = ""; this._restyle(this.typeButtons, this.types.map((x) => x.id === t.id)); }
  _selDesc(d) { this.selDesc = d; this.feedback = ""; this._restyle(this.descButtons, this.descriptions.map((x) => x === d)); }
  _restyle(btns, flags) { btns.forEach((b, i) => { if (flags[i]) { b.bg = T.PRIMARY; b.hover = T.PRIMARY_HOVER; b.textColor = "rgb(255,255,255)"; } else { b.bg = T.BG_ALT; b.hover = T.PRIMARY_LIGHT; b.textColor = T.TEXT; } }); }
  _generate() {
    if (!this.selType) { this.feedback = "Pick a character type first!"; return; }
    if (this.descriptions.length && !this.selDesc) { this.feedback = "Pick a vibe for them first!"; return; }
    this.stage = "results"; this._buildResults();
  }
  _thumb(surf, maxw = 112, maxh = 104) { const src = cropToBounds(surf); const sc = Math.min(maxw / src.width, maxh / src.height); return scaleTo(src, src.width * sc, src.height * sc, false); }
  _resultImage(slot) {
    if (!this.resultSprites.length) return ImagePlaceholder(110, 90, "CHAR " + (slot === 0 ? "A" : "B"));
    let base = this.types.indexOf(this.selType); if (base < 0) base = 0;
    return this._thumb(this.resultSprites[(base * 2 + slot) % this.resultSprites.length]);
  }
  _buildResults() {
    const [rx, ry, rw] = this.rect; const cardW = 140, cardH = 180, gap = 16, y = ry + 70;
    const x1 = rx + rw / 2 - cardW - gap / 2, x2 = rx + rw / 2 + gap / 2, title = this.selType.title;
    this.resultButtons = [
      new Button([x1, y, cardW, cardH], `${title} A`, () => this._choose("A"), { ...SECONDARY, baseSize: 14, image: this._resultImage(0) }),
      new Button([x2, y, cardW, cardH], `${title} B`, () => this._choose("B"), { ...SECONDARY, baseSize: 14, image: this._resultImage(1) }),
    ];
  }
  _choose(w) { this.chosen = w; if (this.onComplete) this.onComplete(); }
  content_height() {
    const pf = this.pf || { lines: [1], lineHeight: 20 };
    const promptH = pf.lines.length * pf.lineHeight;
    const gridH = 2 * 62 + 8, chipsH = this.descriptions.length * (36 + 6);
    return promptH + 6 + gridH + 12 + chipsH + 14 + 36 + 30;
  }
  handle_event(e) {
    if (this.chosen || !this._laid) return;
    if (this.stage === "select_type") { for (const b of this.typeButtons) b.handle_event(e); for (const b of this.descButtons) b.handle_event(e); this.genButton.handle_event(e); }
    else for (const b of this.resultButtons) b.handle_event(e);
  }
  update() {}
  draw(ctx) {
    if (!this._laid) this._layout(ctx);
    drawPanel(ctx, this.rect); const [rx, ry] = this.rect;
    if (this.stage === "select_type") {
      drawLines(ctx, this.pf.lines, rx + 16, ry + 14, this.pf.size, T.TEXT, false, this.pf.lineHeight);
      for (const b of this.typeButtons) b.draw(ctx);
      for (const b of this.descButtons) b.draw(ctx);
      this.genButton.draw(ctx);
      if (this.feedback) drawWrapped(ctx, this.feedback, rx + 16, this.genButton.rect[1] + this.genButton.rect[3] + 6, this.rect[2] - 32, 24, 12, S.MIN_FONT_SIZE, T.ERROR);
    } else {
      drawWrapped(ctx, "Pick your favorite generated character.", rx + 16, ry + 20, this.rect[2] - 32, 30, 13, S.MIN_FONT_SIZE, T.TEXT);
      for (const b of this.resultButtons) b.draw(ctx);
    }
  }
}

export class VideoTrimGame {
  constructor(rect, data, onComplete) {
    this.rect = rect; this.prompt = data.prompt || "Trim the video."; this.onComplete = onComplete;
    const [rx, ry, rw] = rect;
    this.preview = [rx + 16, ry + 44, rw - 32, 120];
    this.timeline = [rx + 24, this.preview[1] + this.preview[3] + 38, rw - 48, 8];
    this.trimming = false; this.adjusted = false; this.solved = false; this.feedback = "";
    this.dragHandle = null; this.trimStart = 0.15; this.trimEnd = 0.85; this._laid = false;
  }
  _layout(ctx) {
    const [rx, ry, rw] = this.rect;
    this.pf = fitText(ctx, this.prompt, rw - 32, 40, 13, S.MIN_FONT_SIZE);
    this.trimBtn = new Button([this.preview[0] + this.preview[2] - 74, this.preview[1] - 36, 74, 28], S.UI_TEXT.trim, () => { this.trimming = true; }, { baseSize: 12 });
    this.saveBtn = new Button([rx + rw / 2 - 55, this.timeline[1] + this.timeline[3] + 28, 110, 32], S.UI_TEXT.save, () => this._save(), { baseSize: 13 });
    this._laid = true;
  }
  _hx(f) { return this.timeline[0] + f * this.timeline[2]; }
  _handleRect(which) { const x = this._hx(which === "start" ? this.trimStart : this.trimEnd); return [x - 12, this.timeline[1] + this.timeline[3] / 2 - 16, 24, 32]; }
  _save() { if (!this.trimming) return; if (!this.adjusted) { this.feedback = "Drag the trim handles first!"; return; } this.solved = true; if (this.onComplete) this.onComplete(); }
  content_height() { const ph = this.pf ? this.pf.lines.length * this.pf.lineHeight : 20; return ph + 36 + 120 + 38 + 8 + 28 + 32 + 30; }
  handle_event(e) {
    if (this.solved || !this._laid) return;
    if (!this.trimming) { this.trimBtn.handle_event(e); return; }
    if (e.type === "mousedown" && e.button === 0) {
      if (inRect(this._handleRect("start"), e.pos)) this.dragHandle = "start";
      else if (inRect(this._handleRect("end"), e.pos)) this.dragHandle = "end";
    } else if (e.type === "mouseup" && e.button === 0) this.dragHandle = null;
    else if (e.type === "mousemove" && this.dragHandle) {
      let f = (e.pos[0] - this.timeline[0]) / Math.max(1, this.timeline[2]); f = Math.max(0, Math.min(1, f));
      if (this.dragHandle === "start") this.trimStart = Math.min(f, this.trimEnd - 0.05);
      else this.trimEnd = Math.max(f, this.trimStart + 0.05);
      this.adjusted = true; this.feedback = "";
    }
    this.saveBtn.handle_event(e);
  }
  update() {}
  draw(ctx) {
    if (!this._laid) this._layout(ctx);
    drawPanel(ctx, this.rect); const [rx, ry] = this.rect;
    drawLines(ctx, this.pf.lines, rx + 16, ry + 16, this.pf.size, T.TEXT, false, this.pf.lineHeight);
    fillRoundRect(ctx, ...this.preview, 10, T.SURFACE_DARK);
    setFont(ctx, this.pf.size, false); ctx.fillStyle = "rgb(210,190,175)"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("video preview", this.preview[0] + this.preview[2] / 2, this.preview[1] + this.preview[3] / 2); ctx.textAlign = "left";
    if (!this.trimming) { this.trimBtn.draw(ctx); return; }
    fillRoundRect(ctx, ...this.timeline, 4, T.BG_ALT);
    const ax = this._hx(this.trimStart), aw = this._hx(this.trimEnd) - ax;
    fillRoundRect(ctx, ax, this.timeline[1], aw, this.timeline[3], 4, T.PRIMARY);
    for (const which of ["start", "end"]) {
      const dragging = this.dragHandle === which, hr = this._handleRect(which);
      if (dragging) { ctx.save(); ctx.globalAlpha = 0.31; fillRoundRect(ctx, hr[0] - 5, hr[1] - 5, hr[2] + 10, hr[3] + 10, 8, T.PRIMARY); ctx.restore(); fillRoundRect(ctx, ...hr, 5, T.PRIMARY); }
      else fillRoundRect(ctx, ...hr, 5, T.SURFACE_DARK);
    }
    this.saveBtn.draw(ctx);
    if (this.feedback) drawWrapped(ctx, this.feedback, rx + 16, this.saveBtn.rect[1] + this.saveBtn.rect[3] + 6, this.rect[2] - 32, 24, 12, S.MIN_FONT_SIZE, T.ERROR);
  }
}
