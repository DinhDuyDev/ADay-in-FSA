// draw_order.js -- painter's-algorithm depth sort, ported from draw_order.py.
import { WINDOW_WIDTH, WINDOW_HEIGHT } from "./settings.js";
import { blitCentered } from "./gfx.js";

const HW = WINDOW_WIDTH / 2;
const SH = WINDOW_HEIGHT;
const Z_REF = 512;

export const Draw = {
  _calls: [],
  add_call(x, y, z, surf) {
    const d = (HW - x) ** 2 + (SH - y) ** 2 + (Z_REF - z) ** 2;
    this._calls.push([d, x, y, surf]);
  },
  render_calls(ctx) {
    // farthest (largest dist) first, closest last (on top)
    this._calls.sort((a, b) => b[0] - a[0]);
    for (const [, x, y, surf] of this._calls) blitCentered(ctx, surf, x, y);
    this._calls.length = 0;
  },
};
