// gfx.js -- Canvas 2D helpers standing in for pygame Surface operations.

export function newCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const ctx = c.getContext("2d");
  return { canvas: c, ctx };
}

export function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => { // fallback: 1x1 transparent
      const { canvas } = newCanvas(1, 1);
      resolve(canvas);
    };
    img.src = src;
  });
}

// draw an image centered at (cx,cy)
export function blitCentered(ctx, img, cx, cy) {
  ctx.drawImage(img, Math.round(cx - img.width / 2), Math.round(cy - img.height / 2));
}
// draw an image with midbottom at (cx,by)
export function blitMidbottom(ctx, img, cx, by) {
  ctx.drawImage(img, Math.round(cx - img.width / 2), Math.round(by - img.height));
}

// scale to (w,h). smooth=false -> crisp nearest-neighbour (pixel art).
export function scaleTo(img, w, h, smooth = true) {
  w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
  const { canvas, ctx } = newCanvas(w, h);
  ctx.imageSmoothingEnabled = smooth;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}
export const scaleBy = (img, sx, sy = sx, smooth = true) =>
  scaleTo(img, img.width * sx, img.height * sy, smooth);

// opaque bounding box of an image (alpha > 8)
export function boundingRect(img) {
  const { canvas, ctx } = newCanvas(img.width, img.height);
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let minx = canvas.width, miny = canvas.height, maxx = -1, maxy = -1;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (data[(y * canvas.width + x) * 4 + 3] > 8) {
        if (x < minx) minx = x; if (x > maxx) maxx = x;
        if (y < miny) miny = y; if (y > maxy) maxy = y;
      }
    }
  }
  if (maxx < 0) return { x: 0, y: 0, w: img.width, h: img.height };
  return { x: minx, y: miny, w: maxx - minx + 1, h: maxy - miny + 1 };
}
export function cropToBounds(img) {
  const bb = boundingRect(img);
  const { canvas, ctx } = newCanvas(bb.w, bb.h);
  ctx.drawImage(img, bb.x, bb.y, bb.w, bb.h, 0, 0, bb.w, bb.h);
  return canvas;
}

// crisp integer-ish nearest upscale to a target height (pixel-art portraits)
export function pixelFitH(img, targetH) {
  const src = cropToBounds(img);
  const factor = Math.max(1, Math.round(targetH / src.height));
  return scaleTo(src, src.width * factor, src.height * factor, false);
}
export function smoothFitH(img, targetH) {
  return scaleTo(img, (img.width * targetH) / img.height, targetH, true);
}

// pixelate: smooth-downscale to pxH then it's the 8-bit master
export function pixelate8bit(img, pxH = 72) {
  const src = cropToBounds(img);
  return scaleTo(src, (src.width * pxH) / src.height, pxH, true);
}

// horizontal flip
export function flipH(img) {
  const { canvas, ctx } = newCanvas(img.width, img.height);
  ctx.translate(img.width, 0); ctx.scale(-1, 1);
  ctx.drawImage(img, 0, 0);
  return canvas;
}

// wash a texture toward an rgba tone (reduces saturation)
export function wash(img, r, g, b, a) {
  const { canvas, ctx } = newCanvas(img.width, img.height);
  ctx.drawImage(img, 0, 0);
  ctx.fillStyle = `rgba(${r},${g},${b},${a / 255})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

// rounded-rect path
export function roundRectPath(ctx, x, y, w, h, r, corners = null) {
  const c = corners || { tl: r, tr: r, br: r, bl: r };
  ctx.beginPath();
  ctx.moveTo(x + c.tl, y);
  ctx.lineTo(x + w - c.tr, y);
  ctx.arcTo(x + w, y, x + w, y + c.tr, c.tr);
  ctx.lineTo(x + w, y + h - c.br);
  ctx.arcTo(x + w, y + h, x + w - c.br, y + h, c.br);
  ctx.lineTo(x + c.bl, y + h);
  ctx.arcTo(x, y + h, x, y + h - c.bl, c.bl);
  ctx.lineTo(x, y + c.tl);
  ctx.arcTo(x, y, x + c.tl, y, c.tl);
  ctx.closePath();
}
export function fillRoundRect(ctx, x, y, w, h, r, style, corners = null) {
  roundRectPath(ctx, x, y, w, h, r, corners);
  ctx.fillStyle = style; ctx.fill();
}
export function strokeRoundRect(ctx, x, y, w, h, r, style, lw = 2, corners = null) {
  roundRectPath(ctx, x, y, w, h, r, corners);
  ctx.strokeStyle = style; ctx.lineWidth = lw; ctx.stroke();
}

// ---- text ----
import { FONT_FAMILY, FONT_FALLBACK, USE_PIXEL_FONT } from "./settings.js";
export function setFont(ctx, size, bold = false) {
  const family = USE_PIXEL_FONT ? `${FONT_FAMILY}, ${FONT_FALLBACK}` : FONT_FALLBACK;
  ctx.font = `${bold ? "bold " : ""}${Math.max(1, Math.round(size))}px ${family}`;
}
export function wrapText(ctx, text, size, maxWidth, bold = false) {
  setFont(ctx, size, bold);
  if (!text) return [""];
  const words = String(text).split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    const cand = cur ? cur + " " + w : w;
    if (cur && ctx.measureText(cand).width > maxWidth) { lines.push(cur); cur = w; }
    else cur = cand;
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}
// shrink font from base to min until wrapped text fits maxW x maxH
export function fitText(ctx, text, maxW, maxH, base, min, bold = false) {
  let size = Math.max(base, min);
  let lines = wrapText(ctx, text, size, maxW, bold);
  const lineH = () => Math.round(size * 1.25);
  while (size > min && lines.length * lineH() > maxH) {
    size -= 1;
    lines = wrapText(ctx, text, size, maxW, bold);
  }
  return { size, lines, lineHeight: lineH() };
}
export function drawLines(ctx, lines, x, y, size, color, bold = false, lineHeight = null) {
  setFont(ctx, size, bold);
  ctx.fillStyle = color; ctx.textAlign = "left"; ctx.textBaseline = "top";
  const lh = lineHeight || Math.round(size * 1.25);
  let yy = y;
  for (const line of lines) { ctx.fillText(line, x, yy); yy += lh; }
  return yy;
}
