// Fish sprites. Most fish use a parametric body generator so new species can be
// added purely from data; a few special creatures have bespoke painters.
import { paint, outline, shade } from './pixel.js';
import { C } from './palette.js';

const W = 26, H = 18;

function drawFishBody(a) {
  const len = a.len || 16, ht = a.h || 7;
  const cx = 14, cy = 9;
  const body = a.body, belly = a.belly || shade(a.body, 0.35), fin = a.fin || shade(a.body, -0.2);
  const can = paint(W, H, p => {
    const rx = len / 2, ry = ht / 2;
    // tail
    const tx = Math.round(cx - rx);
    if (a.tail === 'round') {
      p.ellipse(tx - 2, cy, 2.2, 3, fin);
    } else if (a.tail === 'fan') {
      for (let i = 0; i < 5; i++) p.vline(tx - 1 - i, cy - 1 - i, 3 + i * 2, fin);
    } else {
      for (let i = 0; i < 4; i++) { p.px(tx - 1 - i, cy - 1 - i, fin); p.px(tx - 1 - i, cy - i, fin); p.px(tx - 1 - i, cy + 1 + i, fin); p.px(tx - 1 - i, cy + i, fin); }
      p.px(tx - 1, cy, fin);
    }
    // dorsal fin
    const dfH = a.dorsal ?? 2;
    for (let i = 0; i < dfH; i++) p.hline(cx - 3 + i, Math.round(cy - ry) - 1 - i, 5 - i * 2 + (a.longDorsal ? 4 : 0), fin);
    // body
    p.ellipse(cx, cy, rx, ry, body);
    // belly
    for (let x = -rx + 2; x < rx - 1; x++) {
      const t = 1 - (x * x) / (rx * rx);
      const yb = Math.round(Math.sqrt(Math.max(0, t)) * ry);
      p.px(cx + x, cy + yb - 1, belly);
      if (ht > 6) p.px(cx + x, cy + yb - 2, belly);
    }
    // pattern
    if (a.pattern === 'stripes') {
      for (let s = -1; s <= 1; s++) {
        const sx = cx + s * Math.round(rx / 2.2);
        const yh = Math.round(Math.sqrt(Math.max(0, 1 - ((sx - cx) ** 2) / (rx * rx))) * ry);
        p.vline(sx, cy - yh + 1, yh * 2 - 1, a.patternColor);
        if (a.thick) p.vline(sx + 1, cy - yh + 1, yh * 2 - 1, a.patternColor);
      }
    } else if (a.pattern === 'spots') {
      const pts = [[-3, -1], [1, -2], [3, 1], [-1, 1], [5, -1], [-5, 0]];
      for (const [x, y] of pts) if (Math.abs(x) < rx - 1) p.px(cx + x, cy + y, a.patternColor);
    } else if (a.pattern === 'band') {
      p.hline(Math.round(cx - rx + 1), cy, Math.round(len - 2), a.patternColor);
    } else if (a.pattern === 'gradient') {
      for (let x = Math.round(-rx); x < -rx / 3; x++) {
        const yh = Math.round(Math.sqrt(Math.max(0, 1 - (x * x) / (rx * rx))) * ry);
        p.vline(cx + x, cy - yh, yh * 2, a.patternColor);
      }
    } else if (a.pattern === 'rainbow') {
      const cols = ['#f08a8a', '#f6c46c', '#8fd18a', '#6fb8e8', '#b28be0'];
      cols.forEach((c, i) => {
        const x = Math.round(cx - rx + 3 + i * (len - 5) / 5);
        const yh = Math.round(Math.sqrt(Math.max(0, 1 - ((x - cx) ** 2) / (rx * rx))) * ry);
        p.vline(x, cy - yh + 1, yh * 2 - 2, c); p.vline(x + 1, cy - yh + 1, yh * 2 - 2, c);
      });
    }
    // top shading
    p.hline(cx - 2, Math.round(cy - ry) + 1, 4, shade(body, 0.25));
    // pectoral fin
    p.px(cx + 1, cy + 1, fin); p.px(cx, cy + 2, fin);
    // eye + mouth
    const ex = Math.round(cx + rx - 3);
    p.px(ex, cy - 1, C.white); p.px(ex + 1, cy - 1, C.ink); p.px(ex + 1, cy - 2, C.white);
    p.px(Math.round(cx + rx), cy + 1, shade(body, -0.35));
    if (a.crown) {
      const kx = cx + 1, ky = Math.round(cy - ry) - 3;
      p.rect(kx, ky + 1, 5, 2, C.gold);
      p.px(kx, ky, C.gold); p.px(kx + 2, ky, C.gold); p.px(kx + 4, ky, C.gold);
      p.px(kx + 2, ky + 1, C.red);
    }
    if (a.whiskers) { p.px(ex + 2, cy + 2, C.gold2); p.px(ex + 3, cy + 3, C.gold2); }
    if (a.spikes) {
      for (let i = -2; i <= 2; i++) { p.px(cx + i * 2, Math.round(cy - ry) - 1, fin); p.px(cx + i * 2, Math.round(cy + ry) + 1, fin); }
    }
  });
  return outline(can, C.ink);
}

const SPECIAL = {
  jelly(a) {
    return outline(paint(W, H, p => {
      p.ellipse(13, 6, 6, 4, a.body);
      p.rect(7, 6, 13, 3, a.body);
      p.hline(9, 3, 4, C.white);
      p.ellipse(13, 6, 2, 1.5, a.patternColor);
      for (let i = 0; i < 5; i++) {
        const x = 8 + i * 2 + (i % 2);
        p.vline(x, 9, 4 + (i % 3), shade(a.body, -0.1));
        p.px(x + (i % 2 ? 1 : -1), 13 + (i % 3), shade(a.body, -0.1));
      }
    }), C.ink);
  },
  seahorse(a) {
    return outline(paint(W, H, p => {
      p.rect(11, 3, 5, 4, a.body);   // head
      p.rect(16, 4, 4, 2, a.body);   // snout
      p.rect(10, 6, 5, 7, a.body);   // body
      p.rect(9, 9, 2, 3, a.fin);     // fin
      p.rect(12, 13, 3, 2, a.body);
      p.rect(14, 14, 2, 2, a.body); p.px(13, 16, a.body); p.px(12, 15, a.body);
      p.px(12, 1, a.fin); p.px(13, 2, a.fin); p.px(11, 2, a.fin);
      p.vline(14, 7, 5, shade(a.body, 0.3));
      p.px(14, 4, C.ink); p.px(14, 3, C.white);
      p.px(11, 8, C.white); p.px(12, 11, C.white);
    }), C.ink);
  },
  turtle(a) {
    return outline(paint(W, H, p => {
      p.ellipse(19, 8, 3, 2.5, '#9ccf8f'); // head
      p.px(20, 7, C.ink);
      p.rect(5, 2, 3, 3, '#9ccf8f'); p.rect(5, 12, 3, 3, '#9ccf8f');
      p.rect(15, 2, 3, 3, '#9ccf8f'); p.rect(15, 12, 3, 3, '#9ccf8f');
      p.ellipse(11, 8, 7, 5, a.body);
      p.ellipse(11, 8, 4, 3, a.fin);
      p.px(9, 6, a.patternColor); p.px(13, 6, a.patternColor); p.px(11, 9, a.patternColor);
      p.px(8, 10, a.patternColor); p.px(14, 10, a.patternColor);
      p.px(3, 8, '#9ccf8f');
    }), C.ink);
  },
  eel(a) {
    return outline(paint(W, H, p => {
      for (let x = 2; x < 23; x++) {
        const y = Math.round(9 + Math.sin(x / 3) * 2.5);
        p.vline(x, y - 1, 3, a.body);
        p.px(x, y + 1, a.belly);
      }
      p.px(22, 8, C.ink); p.px(21, 7, C.white);
      for (let x = 4; x < 20; x += 3) p.px(x, Math.round(9 + Math.sin(x / 3) * 2.5) - 1, C.white);
    }), C.ink);
  },
  ray(a) {
    return outline(paint(W, H, p => {
      for (let i = 0; i < 7; i++) p.hline(13 - i * 2 + 1, 4 + i, i * 4 + 1, a.body);
      for (let i = 0; i < 4; i++) p.hline(13 - (6 - i * 2) * 2 + 1, 11 + i, (6 - i * 2) * 4 + 1, a.body);
      p.hline(10, 9, 7, a.patternColor);
      p.px(12, 6, C.ink); p.px(15, 6, C.ink);
      p.line(13, 14, 13, 17, a.fin);
      p.px(12, 8, C.yellow); p.px(16, 10, C.yellow); p.px(9, 9, C.yellow);
    }), C.ink);
  },
};

export function buildFishSprite(art) {
  if (art.special && SPECIAL[art.special]) return SPECIAL[art.special](art);
  return drawFishBody(art);
}
