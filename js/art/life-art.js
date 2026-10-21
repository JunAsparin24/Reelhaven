// Pixel art for island-life things: the shipping bin, restoration board,
// museum, coop and barn, animals, sprinklers, machines, the mine elevator,
// boss treasure and big yard debris. Sprites sit bottom-centre on their tiles.
import { paint, outline, shade } from './pixel.js';
import { C } from './palette.js';

const O = c => outline(c, C.ink);

export function shippingBin() {
  return O(paint(22, 20, p => {
    p.rect(1, 7, 20, 12, C.wood); for (let x = 2; x < 21; x += 4) p.vline(x, 8, 10, C.wood2);
    p.hline(1, 7, 20, C.woodLight); p.rect(1, 17, 20, 2, C.wood3);
    p.rect(0, 3, 22, 4, C.wood2); p.hline(0, 3, 22, C.woodLight);   // lid
    p.rect(9, 9, 4, 3, C.gold); p.px(10, 10, C.gold2);
    p.rect(3, 1, 6, 2, C.cream); p.px(4, 1, C.red);                 // a parsnip-y thing poking out
  }));
}

export function restoreBoard() {
  return O(paint(28, 28, p => {
    p.rect(4, 13, 2, 14, C.wood2); p.rect(22, 13, 2, 14, C.wood2);
    p.rect(2, 3, 24, 14, '#6f8f6a'); p.hline(2, 3, 24, '#8fb08a'); p.hline(2, 16, 24, '#4f6f4a');
    p.rect(4, 5, 20, 10, '#e9dcb8');
    for (const [x, y, c] of [[6, 7, C.turq], [12, 7, C.coral], [18, 7, C.gold], [9, 11, C.grass3], [15, 11, C.lilac]]) { p.rect(x, y, 4, 3, c); p.px(x + 1, y - 1, C.red); }
    p.rect(1, 1, 26, 3, C.wood); p.hline(1, 1, 26, C.woodLight);
  }));
}

export function museumBuilding() {
  return O(paint(68, 54, p => {
    p.rect(4, 22, 60, 28, '#e8e0cc'); p.rect(4, 48, 60, 4, C.stone2);
    for (const x of [8, 20, 44, 56]) { p.rect(x, 24, 4, 24, C.white); p.vline(x + 3, 24, 24, '#c8c0aa'); }
    for (let i = 0; i < 14; i++) p.hline(34 - i * 2.3, 6 + i, i * 4.6, i % 5 === 0 ? '#c8c0aa' : '#efe8d6');
    p.rect(2, 20, 64, 3, '#c8c0aa'); p.hline(2, 20, 64, C.white);
    p.ellipse(34, 13, 3, 3, C.gold); p.px(33, 12, C.yellow);
    p.rect(29, 34, 10, 14, C.wood2); p.rect(30, 35, 8, 13, C.wood); p.px(36, 41, C.gold);
    p.rect(26, 28, 16, 4, C.blueRoof); p.hline(27, 29, 14, '#8fb5dc');
    for (const x of [14, 50]) { p.rect(x - 1, 30, 4, 7, '#9fd6e8'); p.hline(x - 1, 33, 4, C.wood2); }
  }));
}

export function museumDesk() {
  return O(paint(32, 20, p => {
    p.rect(1, 6, 30, 13, C.wood); p.hline(1, 6, 30, C.woodLight); p.rect(1, 17, 30, 2, C.wood3);
    for (let x = 4; x < 30; x += 7) p.rect(x, 9, 4, 6, C.wood2);
    p.rect(4, 2, 6, 4, C.cream); p.hline(5, 3, 4, C.stone2);   // guest book
    p.rect(22, 1, 4, 5, '#9fd6e8'); p.rect(21, 5, 6, 1, C.gold); // bell jar
  }));
}

export function displayCase() {
  return O(paint(16, 24, p => {
    p.rect(2, 14, 12, 9, C.wood); p.hline(2, 14, 12, C.woodLight); p.rect(2, 21, 12, 2, C.wood3);
    p.rect(2, 2, 12, 12, 'rgba(170,220,235,0.55)'); p.vline(3, 3, 9, 'rgba(255,255,255,0.7)'); p.px(12, 3, C.white);
    p.hline(2, 2, 12, C.stone);
  }));
}

export function feedTrough(full = false) {
  return O(paint(32, 14, p => {
    p.rect(1, 4, 30, 8, C.wood); p.hline(1, 4, 30, C.woodLight); p.rect(3, 12, 2, 2, C.wood3); p.rect(27, 12, 2, 2, C.wood3);
    p.rect(3, 5, 26, 3, full ? '#e8c66a' : C.wood3);
    if (full) for (let x = 4; x < 28; x += 3) p.px(x, 4, '#f4dc8a');
  }));
}

export function animalBoard() {
  return O(paint(16, 22, p => {
    p.rect(7, 10, 2, 11, C.wood2);
    p.rect(1, 2, 14, 10, C.wood); p.hline(1, 2, 14, C.woodLight);
    p.rect(3, 4, 10, 6, C.cream);
    p.ellipse(6, 7, 2, 1.5, C.white); p.px(8, 6, C.orange); p.rect(10, 6, 2, 3, C.ink2); p.px(11, 6, C.white);
  }));
}

export function elevator() {
  return O(paint(26, 34, p => {
    p.rect(1, 2, 24, 31, C.stone3); p.rect(3, 6, 20, 26, '#2b2430');
    for (let x = 5; x < 22; x += 4) p.vline(x, 6, 26, C.stone2);
    p.rect(1, 2, 24, 4, C.stone2); p.hline(1, 2, 24, C.stone);
    p.rect(10, 0, 6, 3, C.gold2); p.px(12, 1, C.yellow);
    p.rect(20, 14, 3, 4, C.red); p.px(21, 15, '#ff9a8a');
    p.rect(3, 30, 20, 2, C.wood2);
  }));
}

export function bossChest() {
  return O(paint(24, 20, p => {
    p.rect(2, 8, 20, 11, '#5a3f7a'); p.hline(2, 12, 20, '#4a2f6a');
    p.rrect(2, 2, 20, 7, '#6f4f96'); p.hline(3, 3, 18, '#8f6fb6');
    for (const x of [6, 17]) p.vline(x, 2, 17, C.gold2);
    p.rect(10, 9, 4, 5, C.gold); p.px(11, 11, C.ink);
    p.px(4, 4, C.white); p.px(19, 15, C.yellow);
  }));
}

export function sprinkler(quality = false) {
  return O(paint(12, 12, p => {
    p.ellipse(6, 8, 5, 3, quality ? C.gold2 : C.stone2); p.ellipse(6, 7, 4, 2, quality ? C.gold : C.stone);
    p.rect(5, 2, 2, 5, quality ? C.gold2 : C.stone3); p.rect(3, 2, 6, 1, C.turq); p.px(2, 1, '#9fe0f0'); p.px(9, 1, '#9fe0f0');
  }));
}

export function machine(kind) {
  return O(paint(16, 22, p => {
    if (kind === 'preserves_jar') {
      p.rect(2, 6, 12, 15, '#9fd6c8'); p.rect(3, 9, 10, 11, '#c03a5a'); p.rect(1, 3, 14, 3, C.wood); p.hline(1, 3, 14, C.woodLight);
      p.vline(4, 10, 8, '#e06a8a'); p.rect(5, 12, 6, 4, C.cream);
      return;
    }
    const body = kind === 'cheese_press' ? C.wood : C.stone;
    p.rect(1, 6, 14, 15, body); p.hline(1, 6, 14, shade(body, 0.2)); p.rect(1, 19, 14, 2, shade(body, -0.25));
    if (kind === 'cheese_press') { p.rect(6, 0, 4, 7, C.stone2); p.rect(3, 1, 10, 2, C.stone3); p.rect(4, 11, 8, 5, C.yellow); }
    else { p.rect(3, 2, 10, 4, C.stone2); p.ellipse(8, 12, 4, 3, '#fff6c8'); p.rect(11, 8, 2, 2, C.red); }
  }));
}

export function bigStump() {
  return O(paint(28, 20, p => {
    p.ellipse(14, 13, 13, 6, C.wood3); p.ellipse(14, 11, 12, 6, C.wood2);
    p.ellipse(14, 8, 12, 5, C.woodLight); p.ellipse(14, 8, 8, 3, C.wood); p.ellipse(14, 8, 4, 1.5, C.woodLight);
    p.rect(2, 13, 3, 4, C.wood3); p.rect(23, 13, 3, 4, C.wood3);
  }));
}

export function bigBoulder() {
  return O(paint(26, 20, p => {
    p.ellipse(13, 12, 12, 7, C.stone3); p.ellipse(12, 10, 11, 7, C.stone2); p.ellipse(10, 8, 7, 4, C.stone);
    p.line(14, 6, 18, 13, C.stone3); p.px(7, 6, C.white); p.px(19, 9, C.stone);
  }));
}

function barnLike(p, w, h, wall, roof) {
  const top = Math.round(h * 0.42);
  p.rect(2, top, w - 4, h - top - 2, wall); p.rect(2, h - 4, w - 4, 2, C.stone2);
  for (let y = top + 3; y < h - 4; y += 4) p.hline(3, y, w - 6, shade(wall, -0.12));
  for (let i = 0; i < top; i++) { const inset = Math.round((top - i) * 0.7); p.hline(inset, i + 2, w - inset * 2, i % 4 === 0 ? shade(roof, -0.15) : roof); }
  p.rect(0, top, w, 2, shade(roof, -0.25));
}

export function coopBuilding() {
  return O(paint(50, 40, p => {
    barnLike(p, 50, 40, '#e8d6a8', C.roof);
    p.rect(21, 25, 9, 11, C.wood2); p.rect(22, 26, 7, 10, C.wood); p.line(22, 26, 28, 35, C.wood2);
    p.rect(8, 23, 6, 5, '#9fd6e8'); p.rect(36, 23, 6, 5, '#9fd6e8');
    p.rect(24, 13, 3, 3, C.ink2);
    p.ellipse(42, 35, 2.5, 2, C.white); p.px(44, 34, C.orange);
  }));
}

export function barnBuilding() {
  return O(paint(66, 54, p => {
    barnLike(p, 66, 54, '#b84a3a', '#6a4a3a');
    p.rect(23, 30, 20, 20, C.cream); p.rect(25, 32, 16, 18, '#9a3a2a');
    p.line(25, 32, 40, 49, C.cream); p.line(40, 32, 25, 49, C.cream);
    p.rect(29, 17, 8, 7, C.cream); p.rect(30, 18, 6, 5, '#e8c66a');
    p.rect(6, 33, 6, 6, '#9fd6e8'); p.rect(54, 33, 6, 6, '#9fd6e8');
  }));
}

/** Little farm animals, two walk frames each. */
export function critter(kind, f) {
  const big = kind === 'cow' || kind === 'goat';
  return O(paint(big ? 22 : 14, big ? 18 : 13, p => {
    const leg = f ? 1 : 0;
    if (kind === 'chicken' || kind === 'duck') {
      const body = kind === 'duck' ? '#f4f0e0' : C.white;
      p.ellipse(6, 8, 5, 3.5, body); p.ellipse(10, 4, 2.5, 2.5, body);
      if (kind === 'duck') { p.rect(12, 4, 2, 2, C.orange); p.ellipse(10, 4, 2, 1, '#5aa06a'); }
      else { p.rect(12, 4, 2, 1, C.orange); p.rect(9, 1, 2, 1, C.red); }
      p.px(10, 3, C.ink); p.ellipse(4, 8, 2, 1.5, shade(body, -0.12));
      p.vline(5 + leg, 11, 2, C.orange); p.vline(8 - leg, 11, 2, C.orange);
    } else {
      const body = kind === 'goat' ? '#d8cbb0' : C.white;
      p.rect(3, 5, 14, 8, body); p.rect(15, 2, 6, 6, body);
      if (kind === 'cow') { p.rect(5, 6, 4, 3, C.ink2); p.rect(11, 9, 3, 3, C.ink2); p.rect(18, 5, 3, 3, C.pink); p.px(15, 1, C.stone2); p.px(20, 1, C.stone2); }
      else { p.px(16, 1, C.stone3); p.px(19, 1, C.stone3); p.rect(19, 7, 2, 3, C.cream); }
      p.px(17, 4, C.ink);
      for (const x of [4, 7, 12, 15]) p.vline(x + ((x % 2) ? leg : -leg), 13, 4, shade(body, -0.35));
      p.vline(2, 6, 4, shade(body, -0.2));
    }
  }));
}

// ---------------------------------------------------------------- building & crafting additions
export function silo() {
  return O(paint(30, 50, p => {
    p.rect(3, 12, 24, 36, '#c9c0ae'); for (let y = 16; y < 46; y += 6) p.hline(3, y, 24, '#b0a794');
    p.vline(25, 12, 36, '#a89f8c'); p.rect(3, 46, 24, 2, C.stone3);
    for (let i = 0; i < 10; i++) p.hline(15 - i - 2, 2 + i, (i + 2) * 2, i % 3 === 0 ? '#9a4a3a' : '#b85a46');
    p.rect(12, 36, 6, 10, C.wood2); p.rect(13, 37, 4, 9, C.wood);
    p.rect(13, 20, 4, 4, '#9fd6e8');
  }));
}

export function shedBuilding() {
  return O(paint(50, 40, p => {
    p.rect(3, 16, 44, 22, '#9a7a5a'); for (let x = 5; x < 46; x += 4) p.vline(x, 17, 20, '#8a6a4a');
    p.rect(3, 36, 44, 2, C.stone2);
    for (let i = 0; i < 14; i++) { const inset = Math.round((14 - i) * 0.9); p.hline(inset, i + 2, 50 - inset * 2, i % 4 === 0 ? '#4f6f86' : '#5f7f96'); }
    p.rect(0, 15, 50, 2, '#3f5f76');
    p.rect(19, 24, 12, 12, C.wood2); p.rect(20, 25, 10, 11, C.wood); p.vline(25, 25, 11, C.wood2); p.px(23, 30, C.gold); p.px(27, 30, C.gold);
    p.rect(7, 22, 7, 5, '#9fd6e8'); p.rect(36, 22, 7, 5, '#9fd6e8');
  }));
}

export function stableBuilding() {
  return O(paint(50, 40, p => {
    p.rect(3, 16, 44, 22, '#a8744a'); p.rect(3, 36, 44, 2, C.stone2);
    for (let i = 0; i < 14; i++) { const inset = Math.round((14 - i) * 0.9); p.hline(inset, i + 2, 50 - inset * 2, i % 4 === 0 ? '#6a4a3a' : '#7a5a46'); }
    p.rect(0, 15, 50, 2, '#5a3a2a');
    for (const x of [6, 21, 36]) { p.rect(x, 22, 10, 14, '#3a2a22'); p.line(x, 22, x + 9, 35, '#d8c8a0'); p.line(x + 9, 22, x, 35, '#d8c8a0'); }
    p.rect(22, 8, 6, 5, C.gold); p.px(24, 9, C.gold2);
  }));
}

/** The coop / barn, bigger: an extra wing on the side. */
export function bigVersion(base) {
  const w = base.width, hgt = base.height;
  const c = paint(w, hgt, p => p.ctx.drawImage(base, 0, 0));
  const g = c.getContext('2d');
  g.fillStyle = '#f2d27e'; g.fillRect(3, Math.round(hgt * 0.45), 5, 3); g.fillRect(w - 8, Math.round(hgt * 0.45), 5, 3);
  g.fillStyle = C.gold; g.fillRect(Math.round(w / 2) - 2, 2, 4, 3);
  return c;
}

export function kitchenStove() {
  return O(paint(32, 24, p => {
    p.rect(1, 6, 30, 17, '#e8e2d0'); p.hline(1, 6, 30, C.white); p.rect(1, 21, 30, 2, '#b8b2a0');
    p.rect(3, 8, 12, 6, '#3a3440'); p.ellipse(6, 9, 2, 1, '#e05a3a'); p.ellipse(12, 9, 2, 1, '#e05a3a');
    p.rect(3, 15, 12, 5, '#c8c2b0'); p.hline(4, 16, 10, '#a8a290');
    p.rect(18, 8, 11, 12, C.wood); p.rect(19, 9, 9, 4, '#9fd6e8'); p.rect(20, 15, 7, 1, C.wood2);
    p.rect(5, 1, 6, 5, '#8a8a96'); p.rect(4, 0, 8, 1, '#6a6a76');
  }));
}

export function torch() {
  return O(paint(10, 24, p => {
    p.rect(4, 8, 2, 15, C.wood2); p.rect(3, 6, 4, 3, C.wood);
    p.ellipse(5, 4, 3, 3.5, C.orange); p.ellipse(5, 4, 1.5, 2.5, C.yellow); p.px(5, 1, C.yellow);
  }));
}

export function woodPath() {
  return paint(16, 16, p => {
    for (let y = 1; y < 16; y += 5) { p.rect(0, y, 16, 4, '#b98a5a'); p.hline(0, y, 16, '#cfa070'); p.hline(0, y + 3, 16, '#8a6a4a'); p.px(3, y + 1, '#8a6a4a'); p.px(11, y + 2, '#8a6a4a'); }
  });
}

export function keg() {
  return O(paint(16, 22, p => {
    p.ellipse(8, 12, 7, 9, C.wood); for (const y of [5, 12, 18]) p.hline(1, y, 14, '#6a6a76');
    p.vline(4, 4, 16, C.wood2); p.vline(11, 4, 16, C.woodLight);
    p.rect(7, 13, 3, 2, C.gold2); p.px(9, 15, C.gold);
  }));
}

export function charcoalKiln() {
  return O(paint(16, 22, p => {
    p.rect(2, 6, 12, 15, C.stone2); for (let y = 8; y < 20; y += 4) p.hline(2, y, 12, C.stone3);
    p.rect(5, 13, 6, 6, '#2e2a36'); p.rect(6, 15, 4, 3, C.orange);
    p.rect(6, 1, 4, 5, C.stone3); p.px(7, 0, '#8a8a96');
  }));
}

/** Your horse, side view (faces left; flip for right). f = walk frame. */
export function horse(f = 0) {
  return O(paint(30, 22, p => {
    const body = '#8a5a36', dark = '#6a4226';
    p.ellipse(15, 11, 10, 5, body);
    p.rect(3, 4, 6, 9, body); p.rect(1, 2, 6, 5, body); p.px(2, 3, C.ink); p.rect(0, 5, 2, 2, dark);
    p.rect(6, 1, 4, 9, dark);           // mane
    p.rect(24, 8, 4, 2, dark); p.rect(26, 9, 2, 6, dark);   // tail
    const l = f ? 1 : 0;
    for (const [x, o] of [[7, l], [10, -l], [19, -l], [22, l]]) p.rect(x, 15 + Math.max(0, o), 2, 6 - Math.max(0, o), dark);
    p.rect(12, 7, 7, 3, '#c2554f');     // saddle
  }));
}

/** A building under construction: scaffolding over a faded outline. */
export function scaffold(base) {
  const w = base.width, hgt = base.height;
  return paint(w, hgt, p => {
    const g = p.ctx;
    g.globalAlpha = 0.35; g.drawImage(base, 0, 0); g.globalAlpha = 1;
    const wood = '#b98a5a', dark = '#7a5a3a';
    for (let x = 1; x < w; x += 10) p.rect(x, Math.round(hgt * 0.2), 2, Math.round(hgt * 0.8), wood);
    for (let y = Math.round(hgt * 0.3); y < hgt; y += 9) p.rect(0, y, w, 2, dark);
    p.line(1, hgt - 2, w - 2, Math.round(hgt * 0.3), wood);
    p.rect(Math.round(w / 2) - 4, hgt - 8, 8, 7, '#e8c66a'); p.hline(Math.round(w / 2) - 4, hgt - 5, 8, dark);
  });
}
