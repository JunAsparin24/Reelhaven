// World object art: nature, buildings, decorations, props.
// Each painter returns a canvas. Sprites are anchored bottom-centre on their
// footprint by the renderer.
import { paint, outline, shade, hash2 } from './pixel.js';
import { C } from './palette.js';

const O = c => outline(c, C.ink);

// ---------------------------------------------------------------- nature
export function palm(sway = 0, variant = 0) {
  return O(paint(36, 50, p => {
    // trunk: gently curving segments
    const lean = variant % 2 ? -1 : 1;
    for (let i = 0; i < 9; i++) {
      const y = 46 - i * 3;
      const x = 16 + Math.round(Math.sin(i / 5) * 3 * lean);
      p.rect(x, y - 3, 4, 4, i % 2 ? C.wood : C.woodLight);
      p.px(x + 3, y - 2, C.wood2);
    }
    const tx = 17 + Math.round(Math.sin(8 / 5) * 3 * lean), ty = 18;
    // coconuts
    p.rect(tx - 1, ty + 1, 3, 3, C.wood3); p.rect(tx + 2, ty + 2, 3, 3, C.wood2);
    // fronds
    const leaf = (dx, dy, len, dir) => {
      for (let k = 0; k < len; k++) {
        const x = tx + 1 + dx + Math.round(k * dir) + (k > len / 2 ? sway : 0);
        const y = ty + dy + Math.round((k * k) / (len * 1.4));
        p.rect(x, y - 1, 2, 3, k % 3 === 0 ? C.forest : C.grass3);
        p.px(x, y - 2, C.grass2);
      }
    };
    leaf(0, -1, 12, 1.1); leaf(0, -1, 12, -1.1);
    leaf(0, -2, 9, 0.5); leaf(0, -2, 9, -0.5);
    leaf(1, 0, 10, 1.4); leaf(-1, 0, 10, -1.4);
    p.rect(tx - 2, ty - 4, 6, 4, C.grass3);
    p.px(tx, ty - 4, C.grass2);
  }));
}

export function mangroveTree(sway = 0) {
  return O(paint(40, 46, p => {
    // roots
    for (const [x0, x1] of [[12, 8], [16, 14], [22, 24], [26, 31]]) {
      p.line(x0 + 2, 36, x1, 44, C.wood2);
      p.line(x0 + 3, 36, x1 + 1, 44, C.wood3);
    }
    p.rect(17, 22, 6, 16, C.wood2); p.vline(21, 22, 16, C.wood3);
    p.ellipse(20 + sway, 15, 16, 11, C.forest2);
    p.ellipse(20 + sway, 13, 14, 9, C.forest);
    p.ellipse(14 + sway, 11, 6, 5, C.grass3); p.ellipse(26 + sway, 12, 6, 4, C.grass3);
    for (let i = 0; i < 14; i++) p.px(8 + ((i * 7) % 25) + sway, 6 + ((i * 5) % 14), C.grass2);
  }));
}

export function bush(v = 0) {
  return O(paint(18, 15, p => {
    const col = v === 2 ? C.forest : C.grass3;
    p.ellipse(9, 9, 7, 5, col);
    p.ellipse(6, 7, 4, 3, shade(col, 0.15));
    p.ellipse(12, 7, 4, 3, shade(col, 0.1));
    p.px(5, 5, C.grass2); p.px(11, 5, C.grass2);
    if (v === 1) { p.px(6, 9, C.coral); p.px(11, 8, C.coral); p.px(9, 11, C.coral); }
  }));
}

export function berryBush(ready) {
  return O(paint(18, 15, p => {
    p.ellipse(9, 9, 7, 5, C.forest);
    p.ellipse(7, 7, 4, 3, C.grass3);
    p.ellipse(12, 8, 4, 3, C.grass3);
    if (ready) for (const [x, y] of [[5, 8], [8, 6], [12, 7], [10, 11], [6, 11], [13, 10]]) { p.px(x, y, C.pink); p.px(x + 1, y, C.coral2); }
  }));
}

export function flowers(colorA, colorB) {
  return paint(14, 10, p => {
    const pts = [[2, 5], [6, 2], [10, 5], [5, 7], [11, 1]];
    pts.forEach(([x, y], i) => {
      p.vline(x + 1, y + 2, 2, C.grass3);
      const c = i % 2 ? colorB : colorA;
      p.px(x, y + 1, c); p.px(x + 2, y + 1, c); p.px(x + 1, y, c); p.px(x + 1, y + 2, c);
      p.px(x + 1, y + 1, C.yellow);
    });
  });
}

export function rock(big = false) {
  return O(paint(big ? 22 : 16, big ? 17 : 12, p => {
    if (big) {
      p.ellipse(11, 10, 9, 6, C.stone2);
      p.ellipse(10, 8, 7, 5, C.stone);
      p.hline(6, 5, 4, C.white);
      p.px(14, 10, C.stone3); p.px(15, 11, C.stone3); p.px(7, 12, C.stone3);
      p.px(12, 7, C.stone2);
    } else {
      p.ellipse(8, 7, 6, 4, C.stone2);
      p.ellipse(7, 6, 5, 3, C.stone);
      p.hline(5, 4, 3, C.white);
    }
  }));
}

export function shells() {
  return paint(14, 10, p => {
    // spiral shell
    p.ellipse(4, 5, 3, 2.5, C.coral); p.px(4, 5, C.coral2); p.px(3, 4, C.cream);
    // scallop
    p.ellipse(10, 6, 3, 3, C.cream); p.vline(9, 4, 4, C.sand3); p.vline(11, 4, 4, C.sand3);
    p.px(7, 8, C.pink);
  });
}

export function seaGlass() {
  return paint(12, 9, p => {
    p.rect(2, 4, 3, 2, '#7fd8c3'); p.px(3, 3, C.foam);
    p.rect(7, 5, 3, 2, '#8fb8ef'); p.px(8, 4, C.foam);
    p.rect(5, 2, 2, 2, '#c6f0d0');
  });
}

export function driftwood() {
  return O(paint(22, 9, p => {
    p.rect(2, 3, 17, 3, C.stone2);
    p.hline(2, 3, 17, C.stone);
    p.rect(14, 1, 2, 3, C.stone2);
    p.px(6, 4, C.stone3); p.px(11, 5, C.stone3);
  }));
}

export function coral(col) {
  return O(paint(16, 14, p => {
    p.rect(7, 4, 2, 9, col);
    p.rect(3, 6, 2, 5, col); p.rect(3, 10, 5, 2, col);
    p.rect(11, 3, 2, 6, col); p.rect(9, 8, 4, 2, col);
    p.px(7, 4, shade(col, 0.3)); p.px(3, 6, shade(col, 0.3)); p.px(11, 3, shade(col, 0.3));
  }));
}

export function lilypad(flower) {
  return paint(12, 8, p => {
    p.ellipse(6, 4, 5, 3, C.grass3);
    p.line(6, 4, 10, 2, C.forest);
    if (flower) { p.px(5, 2, C.pink); p.px(4, 3, C.pink); p.px(6, 3, C.pink); p.px(5, 3, C.yellow); }
  });
}

export function reeds() {
  return O(paint(12, 16, p => {
    for (const [x, h] of [[3, 10], [5, 13], [7, 9], [9, 12]]) {
      p.vline(x, 15 - h, h, C.grass3);
      p.rect(x, 15 - h, 1, 3, C.wood2);
    }
  }));
}

export function moonCrystal() {
  return O(paint(16, 20, p => {
    p.rect(6, 3, 4, 14, '#8fc9ff'); p.vline(6, 3, 14, '#d4ecff');
    p.rect(2, 9, 3, 8, '#a99cf0'); p.vline(2, 9, 8, '#d9d2ff');
    p.rect(11, 7, 3, 10, '#7fd8ff');
    p.px(7, 2, '#d4ecff'); p.px(3, 8, '#d9d2ff'); p.px(12, 6, '#c4f1ff');
    p.hline(1, 17, 14, '#5b6f9c');
  }));
}

export function tidePool(full) {
  return paint(18, 12, p => {
    p.ellipse(9, 6, 8, 5, C.stone2);
    p.ellipse(9, 6, 6, 3.5, '#5fb8c0');
    p.hline(5, 4, 4, '#9fe0e0');
    if (full) { p.px(7, 7, C.coral); p.px(8, 7, C.coral); p.px(12, 5, C.orange); p.px(11, 6, C.yellow); }
    p.px(2, 6, C.stone); p.px(15, 4, C.stone);
  });
}

export function stump() {
  return O(paint(16, 12, p => {
    p.ellipse(8, 7, 6, 4, C.wood2);
    p.ellipse(8, 5, 6, 3, C.woodLight);
    p.ellipse(8, 5, 3, 1.5, C.wood);
  }));
}

// ---------------------------------------------------------------- props
export function questBoard() {
  return O(paint(26, 26, p => {
    p.rect(4, 12, 2, 13, C.wood2); p.rect(20, 12, 2, 13, C.wood2);
    p.rect(2, 3, 22, 13, C.wood);
    p.hline(2, 3, 22, C.woodLight); p.hline(2, 15, 22, C.wood3);
    p.rect(4, 5, 18, 9, C.wood2);
    p.rect(5, 6, 6, 7, C.cream); p.hline(6, 8, 4, C.stone2); p.hline(6, 10, 3, C.stone2);
    p.rect(13, 5, 7, 6, '#fde8b8'); p.hline(14, 7, 5, C.stone2);
    p.px(8, 6, C.red); p.px(16, 5, C.red);
    p.rect(1, 1, 24, 3, C.roof); p.hline(1, 1, 24, shade(C.roof, 0.2));
  }));
}

export function signpost() {
  return O(paint(16, 20, p => {
    p.rect(7, 8, 2, 11, C.wood2);
    p.rect(2, 3, 12, 6, C.wood); p.hline(2, 3, 12, C.woodLight);
    p.hline(4, 5, 8, C.wood3); p.hline(4, 7, 6, C.wood3);
  }));
}

export function boat() {
  return O(paint(36, 20, p => {
    p.rect(4, 8, 28, 6, C.wood);
    p.rect(6, 14, 24, 2, C.wood2);
    p.rect(9, 16, 18, 1, C.wood3);
    p.hline(4, 8, 28, C.woodLight);
    p.hline(4, 11, 28, C.white);
    p.rect(2, 7, 3, 4, C.wood); p.rect(31, 7, 3, 4, C.wood);
    p.rect(10, 9, 4, 3, C.wood3); p.rect(22, 9, 4, 3, C.wood3);
    p.vline(18, 0, 9, C.wood2);
    p.rect(19, 1, 6, 5, C.cream); p.hline(19, 3, 6, C.coral);
  }));
}

export function chest(open = false) {
  return O(paint(16, 14, p => {
    p.rect(2, 6, 12, 7, C.wood); p.hline(2, 9, 12, C.wood2);
    if (open) { p.rect(2, 2, 12, 3, C.wood2); p.rect(3, 5, 10, 2, C.gold); p.px(5, 4, C.yellow); }
    else { p.rrect(2, 2, 12, 5, C.wood); p.hline(3, 3, 10, C.woodLight); }
    p.vline(5, 3, 10, C.gold2); p.vline(10, 3, 10, C.gold2);
    p.rect(7, 7, 2, 3, C.gold);
  }));
}

export function bobber() {
  return O(paint(8, 9, p => {
    p.rect(2, 1, 4, 3, C.red);
    p.rect(2, 4, 4, 3, C.white);
    p.px(3, 1, '#f08f86'); p.vline(4, 0, 1, C.ink2);
  }));
}

export function ripple(frame) {
  return paint(20, 10, p => {
    const r = 3 + frame * 2;
    const col = 'rgba(255,255,255,' + (0.85 - frame * 0.18) + ')';
    for (let a = 0; a < 24; a++) {
      const t = (a / 24) * Math.PI * 2;
      p.px(Math.round(10 + Math.cos(t) * r), Math.round(5 + Math.sin(t) * r * 0.45), col);
    }
  });
}

export function cloud(v) {
  return paint(48, 20, p => {
    const col = 'rgba(255,255,255,0.9)';
    p.ellipse(16, 12, 10, 6, col); p.ellipse(28, 10, 12, 8, col); p.ellipse(38, 13, 8, 5, col);
    if (v) p.ellipse(22, 8, 7, 5, col);
  });
}

export function seagull(frame) {
  return O(paint(14, 8, p => {
    if (frame === 0) {
      p.line(1, 2, 6, 5, C.white); p.line(12, 2, 7, 5, C.white);
      p.line(1, 3, 6, 6, C.white); p.line(12, 3, 7, 6, C.white);
    } else {
      p.hline(1, 5, 12, C.white); p.hline(2, 4, 10, C.white);
    }
    p.px(7, 4, C.orange);
  }));
}

export function npcMarker() {
  return O(paint(9, 12, p => {
    p.rect(3, 1, 3, 6, C.gold); p.rect(3, 8, 3, 2, C.gold);
    p.vline(3, 1, 6, C.yellow);
  }));
}

// ---------------------------------------------------------------- buildings
function walls(p, x, y, w, h, col) {
  p.rect(x, y, w, h, col);
  for (let yy = y + 4; yy < y + h; yy += 5) p.hline(x, yy, w, shade(col, -0.12));
  p.vline(x, y, h, shade(col, -0.2)); p.vline(x + w - 1, y, h, shade(col, -0.25));
}

function roofShape(p, x, y, w, h, col, inset) {
  for (let r = 0; r < h; r++) {
    const ins = Math.round(((h - 1 - r) / h) * inset);
    const c = r % 4 === 3 ? shade(col, -0.18) : (r < 2 ? shade(col, 0.15) : col);
    p.hline(x + ins, y + r, w - ins * 2, c);
    if (r % 4 === 1) for (let k = x + ins + ((r / 4) % 2 ? 2 : 0); k < x + w - ins; k += 5) p.px(k, y + r, shade(col, -0.12));
  }
}

function windowAt(p, x, y, glow) {
  p.rect(x, y, 8, 7, C.wood3);
  p.rect(x + 1, y + 1, 6, 5, glow ? C.glow : '#9fd6e8');
  p.vline(x + 4, y + 1, 5, C.wood3); p.hline(x + 1, y + 3, 6, C.wood3);
  if (!glow) p.px(x + 2, y + 2, C.white);
}

function door(p, x, y, col = C.wood2) {
  p.rect(x, y, 10, 14, C.wood3);
  p.rect(x + 1, y + 1, 8, 13, col);
  p.vline(x + 5, y + 1, 13, C.wood3);
  p.px(x + 7, y + 8, C.gold);
}

function flowerBox(p, x, y) {
  p.rect(x, y, 10, 2, C.wood2);
  p.px(x + 1, y - 1, C.coral); p.px(x + 4, y - 1, C.yellow); p.px(x + 7, y - 1, C.pink);
  p.px(x + 2, y - 1, C.grass3); p.px(x + 5, y - 1, C.grass3); p.px(x + 8, y - 1, C.grass3);
}

export function cottage(glow = false) {
  return O(paint(68, 64, p => {
    walls(p, 4, 32, 60, 30, C.cream);
    p.rect(4, 58, 60, 4, C.stone2);
    roofShape(p, 1, 6, 66, 28, C.roof, 10);
    p.rect(48, 2, 7, 10, C.stone2); p.hline(48, 2, 7, C.stone); p.rect(47, 1, 9, 2, C.stone3);
    door(p, 29, 46);
    windowAt(p, 11, 40, glow); windowAt(p, 49, 40, glow);
    flowerBox(p, 10, 48); flowerBox(p, 48, 48);
    p.rect(26, 28, 16, 8, C.roof2); p.rect(29, 30, 10, 5, glow ? C.glow : '#9fd6e8'); p.vline(34, 30, 5, C.wood3);
  }));
}

export function shopStall(glow = false) {
  return O(paint(68, 58, p => {
    walls(p, 6, 26, 56, 30, C.woodLight);
    p.rect(6, 52, 56, 4, C.wood2);
    // awning
    for (let i = 0; i < 14; i++) p.rect(3 + i * 4.5, 16, 5, 12, i % 2 ? C.cream : C.coral);
    for (let i = 0; i < 14; i++) p.ellipse(5 + i * 4.5, 28, 2, 1.5, i % 2 ? C.cream : C.coral);
    p.rect(3, 12, 62, 5, C.coral2); p.hline(3, 12, 62, C.coral);
    // sign with coin
    p.rect(26, 2, 16, 11, C.wood); p.rect(27, 3, 14, 9, C.wood2);
    p.ellipse(34, 7, 3, 3, C.gold); p.vline(34, 5, 4, C.gold2);
    // counter with goods
    p.rect(10, 38, 48, 8, C.wood);
    p.hline(10, 38, 48, C.woodLight);
    p.rect(13, 34, 5, 4, C.orange); p.rect(21, 33, 4, 5, C.mint); p.rect(41, 34, 6, 4, C.coral);
    p.rect(50, 33, 5, 5, C.yellow);
    p.rect(30, 32, 8, 6, glow ? C.glow : '#9fd6e8');
  }));
}

export function fishingHut(glow = false) {
  return O(paint(52, 52, p => {
    // stilts
    for (const x of [6, 22, 40]) p.rect(x, 44, 3, 7, C.wood3);
    walls(p, 5, 24, 42, 22, '#8fb4c6');
    p.rect(5, 44, 42, 2, C.wood2);
    roofShape(p, 2, 6, 48, 20, C.blueRoof, 8);
    door(p, 21, 32, C.wood);
    windowAt(p, 9, 29, glow); windowAt(p, 35, 29, glow);
    // fish sign
    p.rect(17, 14, 18, 8, C.wood);
    p.ellipse(25, 18, 5, 2, C.orange); p.px(19, 17, C.orange); p.px(19, 19, C.orange); p.px(28, 17, C.ink);
    // net
    p.line(40, 24, 47, 40, C.cream);
    for (let i = 0; i < 4; i++) p.hline(42, 28 + i * 3, 4, 'rgba(255,245,223,0.8)');
  }));
}

export function fishMarket(glow = false) {
  return O(paint(68, 60, p => {
    walls(p, 4, 30, 60, 28, '#f0e0c0');
    p.rect(4, 54, 60, 4, C.stone2);
    roofShape(p, 1, 8, 66, 22, '#5f9c8a', 8);
    // awning stripes over counter
    for (let i = 0; i < 12; i++) p.rect(8 + i * 4.4, 30, 5, 6, i % 2 ? C.cream : C.deep);
    p.rect(8, 40, 52, 8, C.wood); p.hline(8, 40, 52, C.woodLight);
    // displayed fish on ice
    p.rect(10, 37, 48, 3, C.foam);
    for (let i = 0; i < 5; i++) { p.ellipse(15 + i * 9, 38, 3, 1, [C.orange, C.ocean, C.coral, C.yellow, C.lilac][i]); }
    // big fish sign on roof
    p.rect(22, 0, 24, 10, C.wood);
    p.ellipse(34, 5, 7, 3, C.turq); p.px(26, 4, C.turq); p.px(26, 6, C.turq); p.px(25, 3, C.turq); p.px(25, 7, C.turq); p.px(38, 4, C.ink);
    windowAt(p, 10, 49, glow); windowAt(p, 50, 49, glow);
  }));
}

export function cropGarden(stage = 0) {
  return O(paint(52, 36, p => {
    p.rect(2, 4, 48, 30, '#9b7b55');
    for (let r = 0; r < 4; r++) {
      p.rect(5, 7 + r * 7, 42, 4, '#7d5f3f');
      p.hline(5, 7 + r * 7, 42, '#b08f66');
      for (let c = 0; c < 6; c++) {
        const x = 8 + c * 7, y = 6 + r * 7;
        if (stage >= 1) { p.vline(x, y, 3, C.grass3); p.px(x - 1, y, C.grass2); p.px(x + 1, y, C.grass2); }
        if (stage >= 2) { p.px(x - 1, y - 1, C.grass3); p.px(x + 1, y - 1, C.grass3); }
        if (stage >= 3) { const col = [C.pink, C.yellow, C.coral, C.lilac][(r + c) % 4]; p.px(x, y - 2, col); p.px(x - 1, y - 1, col); p.px(x + 1, y - 1, col); p.px(x, y - 1, C.yellow); }
      }
    }
    // fence
    for (let x = 1; x < 51; x += 5) { p.rect(x, 1, 2, 6, C.woodLight); p.rect(x, 29, 2, 6, C.woodLight); }
    p.hline(1, 3, 50, C.wood); p.hline(1, 31, 50, C.wood);
    p.rect(1, 1, 2, 34, C.woodLight); p.rect(49, 1, 2, 34, C.woodLight);
  }));
}

export function storageShed() {
  return O(paint(36, 44, p => {
    walls(p, 3, 18, 30, 24, C.wood);
    roofShape(p, 1, 4, 34, 16, C.wood3, 4);
    p.rect(9, 26, 18, 16, C.wood2);
    p.vline(18, 26, 16, C.wood3);
    p.line(9, 26, 17, 41, C.wood3); p.line(19, 26, 27, 41, C.wood3);
    p.px(16, 34, C.gold); p.px(20, 34, C.gold);
    p.rect(28, 36, 5, 6, C.wood3); p.hline(28, 36, 5, C.woodLight);
  }));
}

export function lighthouse(lit = false) {
  return O(paint(36, 88, p => {
    // tapering tower
    for (let y = 22; y < 80; y++) {
      const half = Math.round(8 + (y - 22) * 0.07);
      const band = Math.floor((y - 22) / 10) % 2;
      p.hline(18 - half, y, half * 2, band ? C.red : C.white);
      p.px(18 + half - 1, y, band ? C.red2 : '#d9dad5');
    }
    p.rect(8, 80, 20, 6, C.stone2); p.hline(8, 80, 20, C.stone);
    door(p, 13, 72, C.wood2);
    p.rect(15, 44, 6, 7, C.wood3); p.rect(16, 45, 4, 5, lit ? C.glow : '#9fd6e8');
    // lamp room
    p.rect(8, 20, 20, 3, C.ink2);
    p.rect(11, 10, 14, 10, lit ? C.glow : '#cfeaf2');
    p.vline(14, 10, 10, C.ink2); p.vline(18, 10, 10, C.ink2); p.vline(22, 10, 10, C.ink2);
    if (lit) p.rect(15, 12, 6, 6, C.white);
    for (let r = 0; r < 8; r++) p.hline(10 + r, 9 - r, 16 - r * 2, r < 2 ? C.red2 : C.red);
    p.px(18, 1, C.gold);
  }));
}

export function bridgeRepairSign() {
  return O(paint(14, 18, p => {
    p.rect(6, 8, 2, 9, C.wood2);
    p.rect(1, 2, 12, 7, C.yellow); p.hline(1, 2, 12, C.cream);
    for (let i = 0; i < 4; i++) p.rect(2 + i * 3, 3, 2, 5, C.ink2);
  }));
}

// ---------------------------------------------------------------- decorations
export function bench(rot) {
  if (rot === 1) return O(paint(14, 28, p => {
    p.rect(3, 3, 8, 22, C.wood); for (let y = 3; y < 25; y += 4) p.hline(3, y, 8, C.woodLight);
    p.rect(9, 1, 3, 25, C.wood2);
    p.rect(3, 24, 2, 3, C.wood3); p.rect(9, 24, 2, 3, C.wood3);
  }));
  return O(paint(30, 18, p => {
    p.rect(2, 2, 26, 5, C.wood2); p.hline(2, 2, 26, C.wood);
    p.rect(2, 8, 26, 5, C.wood); p.hline(2, 8, 26, C.woodLight); p.hline(2, 10, 26, C.wood2);
    p.rect(3, 13, 2, 4, C.wood3); p.rect(25, 13, 2, 4, C.wood3);
  }));
}

export function lantern(lit) {
  return O(paint(12, 26, p => {
    p.rect(5, 9, 2, 15, C.ink2); p.rect(3, 23, 6, 2, C.ink2);
    p.rect(2, 2, 8, 8, C.ink2);
    p.rect(3, 3, 6, 6, lit ? C.glow : '#e3d9b8');
    if (lit) p.rect(5, 4, 2, 4, C.white);
    p.hline(1, 1, 10, C.ink2); p.px(5, 0, C.ink2); p.px(6, 0, C.ink2);
  }));
}

export function fence(rot) {
  if (rot === 1) return O(paint(8, 22, p => {
    p.rect(3, 1, 2, 20, C.woodLight); p.vline(4, 1, 20, C.wood);
    p.rect(2, 2, 4, 3, C.wood); p.rect(2, 16, 4, 3, C.wood);
  }));
  return O(paint(18, 16, p => {
    p.rect(2, 3, 2, 12, C.woodLight); p.rect(14, 3, 2, 12, C.woodLight);
    p.px(2, 2, C.woodLight); p.px(15, 2, C.woodLight);
    p.rect(0, 6, 18, 2, C.wood); p.rect(0, 11, 18, 2, C.wood);
  }));
}

export function flowerBed() {
  return O(paint(18, 14, p => {
    p.rect(1, 6, 16, 7, C.wood2); p.hline(1, 6, 16, C.wood);
    p.rect(2, 7, 14, 2, '#7d5f3f');
    const cols = [C.coral, C.yellow, C.pink, C.lilac, C.coral];
    cols.forEach((c, i) => { const x = 3 + i * 3; p.vline(x, 3, 4, C.grass3); p.px(x, 2, c); p.px(x - 1, 3, c); p.px(x + 1, 3, c); p.px(x, 3, C.yellow); });
  }));
}

export function stonePath() {
  return paint(16, 16, p => {
    const stones = [[1, 1, 6, 5], [8, 2, 7, 5], [2, 8, 5, 6], [9, 9, 6, 5]];
    for (const [x, y, w, h] of stones) { p.rrect(x, y, w, h, C.stone2); p.rrect(x, y, w, h - 1, C.stone); p.px(x + 1, y + 1, C.white); }
  });
}

export function shellDisplay() {
  return O(paint(18, 18, p => {
    p.rect(3, 8, 12, 9, C.wood); p.hline(3, 8, 12, C.woodLight);
    p.rect(4, 10, 10, 5, C.wood2);
    p.ellipse(6, 6, 3, 2.5, C.coral); p.px(6, 6, C.coral2);
    p.ellipse(12, 6, 3, 3, C.cream); p.vline(11, 4, 4, C.sand3); p.vline(13, 4, 4, C.sand3);
    p.px(9, 4, C.pink); p.px(9, 5, '#7fd8c3');
  }));
}

export function sign() {
  return signpost();
}

export function smallPond() {
  return paint(32, 32, p => {
    p.ellipse(16, 16, 14, 12, C.stone2);
    p.ellipse(16, 15, 13, 11, C.stone);
    p.ellipse(16, 16, 11, 9, '#5fb5b0');
    p.ellipse(14, 14, 6, 4, '#7ccac3');
    p.ellipse(20, 19, 3, 2, C.grass3); p.px(19, 18, C.pink);
    p.px(11, 12, C.white); p.px(12, 12, C.white);
  });
}

export function coralPlanter() {
  return O(paint(18, 20, p => {
    p.rect(3, 12, 12, 7, '#d8c8a8'); p.hline(3, 12, 12, C.cream);
    p.rect(7, 3, 2, 9, C.coral2); p.rect(4, 6, 2, 6, C.coral); p.rect(4, 9, 4, 2, C.coral);
    p.rect(11, 4, 2, 8, '#f08ab0'); p.rect(9, 8, 4, 2, '#f08ab0');
    p.px(7, 3, C.pink); p.px(11, 4, C.pink);
  }));
}

export function umbrella() {
  return O(paint(30, 36, p => {
    p.vline(15, 10, 24, C.wood2);
    for (let r = 0; r < 9; r++) {
      const w = 6 + r * 3;
      for (let x = 0; x < w; x++) {
        const seg = Math.floor((x / w) * 6);
        p.px(15 - w / 2 + x, 3 + r, seg % 2 ? C.cream : C.coral);
      }
    }
    p.px(15, 2, C.wood3);
  }));
}

export function tikiTorch(lit) {
  return O(paint(10, 28, p => {
    p.rect(4, 9, 2, 18, C.wood2);
    p.rect(2, 6, 6, 4, C.wood); p.hline(2, 7, 6, C.wood3);
    if (lit) { p.rect(3, 1, 4, 5, C.orange); p.rect(4, 2, 2, 3, C.yellow); }
  }));
}

export function hammock() {
  return O(paint(46, 26, p => {
    p.rect(2, 2, 3, 22, C.wood2); p.rect(41, 2, 3, 22, C.wood2);
    for (let x = 6; x < 41; x++) {
      const y = Math.round(10 + Math.sin(((x - 6) / 35) * Math.PI) * 6);
      p.vline(x, y, 3, (x >> 2) % 2 ? C.coral : C.cream);
    }
    p.line(5, 5, 7, 10, C.cream); p.line(41, 5, 39, 10, C.cream);
  }));
}

export function topiary() {
  return O(paint(16, 26, p => {
    p.rect(4, 20, 8, 5, C.coral2); p.hline(4, 20, 8, C.coral);
    p.vline(8, 14, 6, C.wood2);
    p.ellipse(8, 9, 6, 6, C.grass3); p.ellipse(7, 7, 3, 3, C.grass2);
  }));
}

export function sprinkleSparkle(frame) {
  return paint(7, 7, p => {
    const c = frame ? C.white : C.yellow;
    p.px(3, 0, c); p.px(3, 6, c); p.px(0, 3, c); p.px(6, 3, c);
    p.px(3, 2, c); p.px(3, 4, c); p.px(2, 3, c); p.px(4, 3, c); p.px(3, 3, C.white);
  });
}

export function treeHash(x, y) { return hash2(x, y, 99); }
