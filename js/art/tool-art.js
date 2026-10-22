// Tool icons in the style of a cozy farming game: chunky diagonal tools with
// wooden handles and shaded metal heads. Each upgrade tier gets its own metal
// (basic steel, copper, iron, gold); swords and rods get their own colours.
import { paint, outline, shade } from './pixel.js';
import { C } from './palette.js';

const O = c => outline(c, C.ink);
const icon = fn => O(paint(18, 18, p => fn(p)));

/** [light, mid, dark] metal colours per upgrade tier. */
export const METALS = [
  ['#e4e8ec', '#a9b2ba', '#6f7a84'],   // basic steel
  ['#f6c08a', '#d9844a', '#9a5428'],   // copper
  ['#f2f6fa', '#c4d0d8', '#7f8c98'],   // iron (bright steel)
  ['#fff0a0', '#f2c040', '#b8861a'],   // gold
];
const WOOD = ['#e0a868', '#b87a44', '#7a4c26'];

/** A 2-pixel wooden handle from (x0,y0) to (x1,y1) with a light edge. */
function handle(p, x0, y0, x1, y1) {
  p.line(x0, y0, x1, y1, WOOD[1]);
  p.line(x0 + 1, y0, x1 + 1, y1, WOOD[2]);
  p.line(x0, y0 - 1, x1, y1 - 1, WOOD[0]);
}

export function pickaxe(t = 0) {
  const [hi, mid, lo] = METALS[t];
  return icon(p => {
    handle(p, 3, 16, 9, 5);
    for (let x = 2; x <= 16; x++) {
      const y = 2 + Math.round(((x - 9) ** 2) / 13);
      p.px(x, y, hi); p.px(x, y + 1, mid); p.px(x, y + 2, lo);
    }
    p.px(2, 7, lo); p.px(16, 7, lo); p.px(2, 6, mid); p.px(16, 6, mid);   // pointed tips
    p.rect(8, 3, 3, 3, lo); p.px(9, 3, mid);                              // collar
  });
}

export function axe(t = 0) {
  const [hi, mid, lo] = METALS[t];
  return icon(p => {
    handle(p, 4, 17, 13, 3);
    // the head: a wide, curved blade facing up-left, a small poll behind the handle
    const rows = { 0: [7, 10], 1: [5, 12], 2: [4, 13], 3: [4, 13], 4: [5, 13], 5: [6, 12], 6: [8, 11] };
    for (const [y, [a, b]] of Object.entries(rows)) for (let x = a; x <= b; x++) p.px(x, +y, x <= a + 1 ? hi : x >= b - 1 ? lo : mid);
    p.rect(14, 2, 2, 3, lo); p.px(14, 2, mid);          // poll
    p.line(5, 6, 9, 1, shade(mid, 0.12));                // shine
  });
}

export function hoe(t = 0) {
  const [hi, mid, lo] = METALS[t];
  return icon(p => {
    handle(p, 2, 16, 12, 5);
    p.rect(12, 3, 2, 3, lo);                       // neck
    p.rect(8, 1, 8, 3, mid); p.hline(8, 1, 8, hi); // blade top
    p.rect(8, 4, 3, 4, mid); p.vline(8, 4, 4, hi); p.hline(8, 7, 3, lo);   // bent-down edge
  });
}

export function scythe(t = 0) {
  const [hi, mid, lo] = METALS[t];
  return icon(p => {
    handle(p, 6, 17, 11, 3);
    p.rect(7, 10, 4, 2, WOOD[2]); p.px(10, 10, WOOD[0]);   // grip
    for (let x = 1; x <= 11; x++) {
      const y = 3 + Math.round(((11 - x) ** 2) / 22);
      p.px(x, y, mid); p.px(x, y + 1, hi); if (x > 3) p.px(x, y - 1, lo);
    }
    p.px(1, 8, hi);
  });
}

export function wateringCan(t = 0) {
  const [hi, mid, lo] = METALS[t].map((c, i) => t === 0 ? ['#9fc4ec', '#5b8fd0', '#33598f'][i] : c);
  return icon(p => {
    p.ellipse(7, 11, 5.5, 4.5, mid);
    p.ellipse(6, 10, 3.5, 2.5, hi);
    p.hline(3, 15, 9, lo);
    p.rect(4, 5, 5, 2, lo); p.hline(4, 5, 5, mid);                       // opening
    for (const [x, y] of [[2, 6], [1, 7], [1, 8], [1, 9], [2, 10]]) p.px(x, y, lo);   // handle loop
    p.line(12, 11, 16, 6, mid); p.line(12, 12, 16, 7, lo);               // spout
    p.rect(15, 4, 3, 2, hi); p.px(17, 6, lo);                            // rose
  });
}

/** Swords: blade colour by tier (wood, coral, rusty, tide, obsidian, moon, star). */
const BLADES = [
  ['#f0c890', '#c89058', '#8a5a30'], ['#ffc8c0', '#f08a80', '#b8504a'], ['#e8b898', '#b8785a', '#7a4a32'],
  ['#c8f4f8', '#5fc8d8', '#2f8898'], ['#8a7aa0', '#4a3a5a', '#241a30'], ['#f4f6ff', '#c8d0f8', '#8890c8'], ['#fff8c0', '#f8e07a', '#c8a030'],
];
export function sword(t = 0) {
  const [hi, mid, lo] = BLADES[Math.min(t, BLADES.length - 1)];
  return icon(p => {
    for (let i = 0; i < 11; i++) { p.px(5 + i, 12 - i, mid); p.px(6 + i, 12 - i, hi); p.px(5 + i, 13 - i, lo); p.px(6 + i, 13 - i, mid); }
    p.px(16, 1, hi); p.px(16, 2, mid);                     // tip
    p.line(3, 10, 8, 15, '#c8a040'); p.line(4, 10, 8, 14, '#f2d27e');   // cross-guard
    p.line(2, 16, 4, 14, WOOD[1]); p.line(3, 16, 5, 14, WOOD[2]);      // grip
    p.rect(1, 16, 2, 2, '#c8a040');                         // pommel
  });
}

/** Fishing rods: colour by rod. */
const RODS_ART = {
  wooden_rod: ['#e0a868', '#b87a44'], fiberglass_rod: ['#9fe0e8', '#4fa8b8'], coral_rod: ['#ffb8b0', '#e0706a'],
  moonlit_rod: ['#d8d0ff', '#8a7ad8'], golden_rod: ['#fff0a0', '#e0b030'],
};
export function rod(id = 'wooden_rod') {
  const [hi, mid] = RODS_ART[id] || RODS_ART.wooden_rod;
  return icon(p => {
    p.line(2, 16, 15, 2, mid); p.line(3, 16, 16, 2, shade(mid, -0.25)); p.line(2, 15, 14, 2, hi);
    p.rect(2, 13, 3, 4, '#4a3a3a'); p.px(3, 14, '#8a7a7a');       // cork grip
    p.rect(5, 11, 3, 3, '#8a8a96'); p.px(6, 11, '#d8d8e0');       // reel
    p.line(16, 2, 16, 12, '#fff5df'); p.rect(15, 12, 3, 2, C.red); p.px(16, 12, C.white);   // line + bobber
  });
}
