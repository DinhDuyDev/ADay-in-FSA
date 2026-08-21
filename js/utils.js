// utils.js -- ported from utilityfuncs.py + small helpers

export function dist(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

// degrees; matches the pygame convention entities use (x += cos, y -= sin)
export function pointDirection(x1, y1, x2, y2) {
  return (Math.atan2(y1 - y2, x2 - x1) * 180) / Math.PI;
}

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const rad = (deg) => (deg * Math.PI) / 180;
export const rgb = (c) => (Array.isArray(c) ? `rgb(${c[0]},${c[1]},${c[2]})` : c);
export const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
