// Pixel-art toolkit: tiny helpers for painting sprites into offscreen canvases.
// All game art is generated at boot from these primitives so it stays crisp at
// any integer scale. Real image files can replace any sprite (see sprites.js).

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Paint a sprite with a small immediate-mode API. Returns the canvas. */
export function paint(w, h, fn) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const p = painter(ctx);
  fn(p, ctx);
  return c;
}

export function painter(ctx) {
  return {
    ctx,
    px(x, y, c) { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, 1, 1); },
    rect(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w | 0, h | 0); },
    hline(x, y, w, c) { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w | 0, 1); },
    vline(x, y, h, c) { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, 1, h | 0); },
    clear(x, y, w = 1, h = 1) { ctx.clearRect(x, y, w, h); },
    /** Filled pixel ellipse (no anti-aliasing). */
    ellipse(cx, cy, rx, ry, c) {
      ctx.fillStyle = c;
      for (let y = Math.floor(-ry); y <= Math.ceil(ry); y++) {
        const t = 1 - (y * y) / (ry * ry + 0.0001);
        if (t < 0) continue;
        const half = Math.round(Math.sqrt(t) * rx);
        ctx.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2 + 1, 1);
      }
    },
    /** Rounded rectangle with 1px clipped corners. */
    rrect(x, y, w, h, c) {
      ctx.fillStyle = c;
      ctx.fillRect(x + 1, y, w - 2, h);
      ctx.fillRect(x, y + 1, w, h - 2);
    },
    line(x0, y0, x1, y1, c) {
      ctx.fillStyle = c;
      let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
      let dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        ctx.fillRect(x0, y0, 1, 1);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    },
  };
}

/** Build a sprite from an array of strings and a palette ('.' or ' ' = clear). */
export function fromGrid(rows, palette) {
  const h = rows.length;
  const w = Math.max(...rows.map(r => r.length));
  return paint(w, h, p => {
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        const col = palette[ch];
        if (col) p.px(x, y, col);
      }
    });
  });
}

/** Adds a 1px outline around all opaque pixels (sprite must have 1px free margin). */
export function outline(canvas, color = '#2c2433', diagonal = false) {
  const w = canvas.width, h = canvas.height;
  const ctx = canvas.getContext('2d');
  const src = ctx.getImageData(0, 0, w, h);
  const out = ctx.getImageData(0, 0, w, h);
  const [r, g, b] = hexToRgb(color);
  const a = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : src.data[(y * w + x) * 4 + 3];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (a(x, y) > 0) continue;
      let n = a(x - 1, y) || a(x + 1, y) || a(x, y - 1) || a(x, y + 1);
      if (!n && diagonal) n = a(x - 1, y - 1) || a(x + 1, y - 1) || a(x - 1, y + 1) || a(x + 1, y + 1);
      if (n) {
        const i = (y * w + x) * 4;
        out.data[i] = r; out.data[i + 1] = g; out.data[i + 2] = b; out.data[i + 3] = 255;
      }
    }
  }
  ctx.putImageData(out, 0, 0);
  return canvas;
}

/** Horizontally mirrored copy. */
export function flipH(canvas) {
  const c = makeCanvas(canvas.width, canvas.height);
  const ctx = c.getContext('2d');
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(canvas, 0, 0);
  return c;
}

/** Copy with every opaque pixel replaced by a single color (silhouettes, flashes). */
export function silhouette(canvas, color) {
  const c = makeCanvas(canvas.width, canvas.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(canvas, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

/** Scales a sprite up by an integer factor (for data-URL icons used in the DOM). */
export function scaleUp(canvas, s) {
  const c = makeCanvas(canvas.width * s, canvas.height * s);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, 0, 0, c.width, c.height);
  return c;
}

export function hexToRgb(hex) {
  const v = hex.replace('#', '');
  const n = parseInt(v.length === 3 ? v.split('').map(c => c + c).join('') : v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function shade(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  const f = v => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
  return '#' + [f(r), f(g), f(b)].map(v => v.toString(16).padStart(2, '0')).join('');
}

/** Deterministic hash → [0,1). Used for speckles so tiles look identical every load. */
export function hash2(x, y, seed = 0) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return ((h >>> 0) % 10000) / 10000;
}
