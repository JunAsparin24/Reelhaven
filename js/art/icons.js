// 16x16 UI icons, painted as pixel art (no emoji or font glyphs).
import { paint, outline, shade } from './pixel.js';
import { C } from './palette.js';
import { CROPS } from '../../data/farm-data.js';

const O = c => outline(c, C.ink);
const icon = fn => O(paint(18, 18, p => fn(p)));

export const ICONS = {
  coin: () => icon(p => {
    p.ellipse(9, 9, 6, 6, C.gold2); p.ellipse(9, 8, 6, 6, C.gold);
    p.ellipse(9, 8, 4, 4, C.yellow); p.vline(9, 5, 7, C.gold2); p.px(7, 5, C.white);
  }),
  pearl: () => icon(p => {
    p.ellipse(9, 9, 6, 6, '#c9b8e6'); p.ellipse(9, 9, 5, 5, '#ece4fb');
    p.rect(6, 5, 3, 2, C.white); p.px(12, 12, '#b5a1d9');
  }),
  xp: () => icon(p => {
    const pts = [[9, 2], [11, 7], [16, 7], [12, 10], [14, 15], [9, 12], [4, 15], [6, 10], [2, 7], [7, 7]];
    for (let y = 2; y <= 15; y++) for (let x = 2; x <= 16; x++) if (inPoly(x + 0.5, y + 0.5, pts)) p.px(x, y, C.yellow);
    p.px(8, 6, C.white);
  }),
  island: () => icon(p => {
    p.ellipse(9, 13, 8, 3, C.turq); p.ellipse(9, 12, 6, 2, C.sand);
    p.vline(9, 5, 7, C.wood); p.vline(10, 5, 7, C.wood2);
    p.line(4, 6, 9, 4, C.grass3); p.line(9, 4, 14, 6, C.grass3); p.line(5, 4, 9, 3, C.grass2); p.line(9, 3, 13, 4, C.grass2);
  }),
  fish: () => icon(p => {
    p.ellipse(10, 9, 5, 3.5, C.orange); p.ellipse(10, 10, 4, 1.5, C.yellow);
    p.px(4, 7, C.orange2); p.px(4, 11, C.orange2); p.rect(3, 6, 1, 7, C.orange2); p.px(4, 9, C.orange2);
    p.px(13, 8, C.ink); p.px(9, 6, C.orange2);
  }),
  map: () => icon(p => {
    p.rect(2, 3, 14, 12, C.cream); p.vline(6, 3, 12, C.sand2); p.vline(11, 3, 12, C.sand2);
    p.ellipse(8, 9, 2, 2, C.grass3); p.line(5, 12, 12, 6, C.red); p.px(12, 6, C.red2); p.px(13, 5, C.red2);
  }),
  friends: () => icon(p => {
    p.ellipse(6, 6, 2.5, 2.5, C.coral); p.rect(3, 9, 6, 6, C.coral2);
    p.ellipse(12, 6, 2.5, 2.5, '#8fb8ef'); p.rect(9, 9, 6, 6, C.blueRoof);
  }),
  bag: () => icon(p => {
    p.rect(3, 6, 12, 10, C.wood); p.hline(3, 6, 12, C.woodLight); p.rect(3, 9, 12, 1, C.wood2);
    p.rect(6, 2, 6, 2, C.wood2); p.vline(6, 3, 3, C.wood2); p.vline(11, 3, 3, C.wood2);
    p.rect(8, 9, 2, 3, C.gold);
  }),
  quest: () => icon(p => {
    p.rect(4, 2, 10, 14, C.cream); p.hline(4, 2, 10, C.sand2);
    p.hline(6, 5, 6, C.stone2); p.hline(6, 8, 6, C.stone2); p.hline(6, 11, 4, C.stone2);
    p.rect(3, 1, 12, 2, C.wood); p.rect(3, 15, 12, 2, C.wood);
  }),
  build: () => icon(p => {
    p.line(4, 15, 11, 8, C.wood2); p.line(5, 15, 12, 8, C.wood);
    p.rect(9, 3, 7, 4, C.stone2); p.rect(9, 3, 7, 2, C.stone); p.rect(15, 3, 1, 6, C.stone3);
  }),
  gear: () => icon(p => {
    p.ellipse(9, 9, 6, 6, C.stone2);
    for (const [x, y] of [[8, 1], [8, 15], [1, 8], [15, 8], [3, 3], [13, 3], [3, 13], [13, 13]]) p.rect(x, y, 2, 2, C.stone2);
    p.ellipse(9, 9, 4, 4, C.stone); p.ellipse(9, 9, 2, 2, C.ink2);
  }),
  shop: () => icon(p => {
    p.rect(3, 8, 12, 8, C.woodLight); p.rect(7, 11, 4, 5, C.wood2);
    for (let i = 0; i < 4; i++) p.rect(2 + i * 3.5, 4, 4, 4, i % 2 ? C.cream : C.coral);
  }),
  wood: () => icon(p => {
    p.rect(2, 9, 14, 4, C.wood); p.hline(2, 9, 14, C.woodLight); p.ellipse(15, 11, 1.5, 2, C.woodLight);
    p.rect(4, 4, 12, 4, C.wood2); p.hline(4, 4, 12, C.wood); p.ellipse(15, 6, 1.5, 2, C.woodLight);
  }),
  stone: () => icon(p => { p.ellipse(9, 10, 6, 5, C.stone2); p.ellipse(8, 9, 5, 4, C.stone); p.hline(6, 6, 3, C.white); }),
  shell: () => icon(p => {
    p.ellipse(9, 10, 6, 5, C.coral); for (const x of [6, 9, 12]) p.line(9, 15, x, 6, C.coral2);
    p.rect(7, 14, 4, 2, C.coral2);
  }),
  seaglass: () => icon(p => {
    p.rect(3, 8, 6, 5, '#7fd8c3'); p.px(4, 9, C.foam);
    p.rect(9, 4, 6, 6, '#8fb8ef'); p.px(10, 5, C.foam);
    p.rect(8, 11, 5, 4, '#c6f0d0');
  }),
  flower: () => icon(p => {
    p.vline(9, 9, 7, C.grass3); p.px(8, 12, C.grass3); p.px(7, 11, C.grass3);
    p.ellipse(9, 6, 4, 4, C.pink); p.ellipse(9, 6, 1.5, 1.5, C.yellow);
  }),
  worm: () => icon(p => { for (let x = 3; x < 15; x++) p.rect(x, Math.round(10 + Math.sin(x / 2) * 2), 1, 2, C.coral); p.px(14, 9, C.ink); }),
  shrimp: () => icon(p => {
    for (let i = 0; i < 6; i++) p.ellipse(4 + i * 2, 10 - Math.sin(i / 2) * 3, 2, 2, C.orange);
    p.px(14, 6, C.ink); p.line(14, 5, 16, 2, C.orange2);
  }),
  glow: () => icon(p => { p.ellipse(9, 9, 5, 5, '#a8f0ff'); p.ellipse(9, 9, 3, 3, C.white); p.px(3, 3, '#a8f0ff'); p.px(15, 4, '#a8f0ff'); p.px(14, 15, '#a8f0ff'); }),
  lure: () => icon(p => { p.ellipse(9, 9, 5, 3, C.gold); p.px(12, 8, C.ink); p.line(4, 9, 2, 13, C.stone2); p.rect(8, 6, 2, 2, C.red); }),
  rod: () => icon(p => { p.line(3, 15, 15, 3, C.wood); p.line(4, 15, 15, 4, C.wood2); p.rect(3, 13, 3, 3, C.ink2); p.line(15, 3, 15, 11, C.cream); p.px(15, 12, C.red); }),
  chest: () => icon(p => { p.rect(3, 7, 12, 8, C.wood); p.rrect(3, 3, 12, 5, C.wood2); p.vline(6, 3, 12, C.gold2); p.vline(11, 3, 12, C.gold2); p.rect(8, 8, 2, 3, C.gold); }),
  boat: () => icon(p => { p.rect(2, 10, 14, 4, C.wood); p.hline(2, 10, 14, C.woodLight); p.vline(9, 2, 8, C.wood2); p.rect(10, 3, 5, 5, C.cream); }),
  home: () => icon(p => {
    for (let r = 0; r < 6; r++) p.hline(9 - r - 1, 2 + r, r * 2 + 2, C.roof);
    p.rect(4, 8, 10, 8, C.cream); p.rect(8, 11, 3, 5, C.wood2);
  }),
  lock: () => icon(p => { p.rect(4, 8, 10, 8, C.gold); p.rect(6, 3, 6, 6, C.stone2); p.rect(8, 5, 2, 4, 'rgba(0,0,0,0)'); p.ctx.clearRect(8, 5, 2, 3); p.rect(8, 10, 2, 3, C.gold2); }),
  check: () => icon(p => { p.line(3, 9, 7, 13, C.grass3); p.line(4, 9, 8, 13, C.grass3); p.line(7, 13, 15, 4, C.grass3); p.line(8, 13, 15, 5, C.grass3); }),
  sun: () => icon(p => {
    p.ellipse(9, 9, 4, 4, C.gold);
    for (const [x, y] of [[9, 1], [9, 16], [1, 9], [16, 9], [3, 3], [14, 3], [3, 14], [14, 14]]) p.rect(x - 0.5, y - 0.5, 2, 2, C.orange);
  }),
  moon: () => icon(p => { p.ellipse(9, 9, 6, 6, C.moon); p.ellipse(12, 7, 5, 5, 'rgba(0,0,0,1)'); p.ctx.globalCompositeOperation = 'destination-out'; p.ellipse(12, 7, 5, 5, '#000'); p.ctx.globalCompositeOperation = 'source-over'; }),
  rain: () => icon(p => { p.ellipse(9, 6, 6, 4, C.stone); p.ellipse(6, 7, 4, 3, C.stone); for (const x of [5, 9, 13]) p.line(x, 12, x - 1, 15, '#7fb6e8'); }),
  storm: () => icon(p => { p.ellipse(9, 6, 6, 4, C.stone2); p.ellipse(6, 7, 4, 3, C.stone2); p.line(10, 10, 8, 13, C.yellow); p.line(8, 13, 11, 13, C.yellow); p.line(11, 13, 9, 16, C.yellow); }),
  sunset: () => icon(p => { p.ellipse(9, 11, 5, 5, C.orange); p.ctx.clearRect(0, 12, 18, 6); p.hline(2, 12, 14, C.coral2); p.hline(4, 14, 10, C.coral); }),
  trophy: () => icon(p => { p.rect(5, 3, 8, 6, C.gold); p.ellipse(9, 8, 4, 3, C.gold); p.rect(8, 11, 2, 3, C.gold2); p.rect(5, 14, 8, 2, C.wood2); p.px(3, 4, C.gold); p.px(14, 4, C.gold); p.px(6, 4, C.yellow); }),
  sell: () => icon(p => { p.ellipse(7, 10, 5, 5, C.gold); p.vline(7, 7, 6, C.gold2); p.line(11, 6, 16, 2, C.grass3); p.line(13, 2, 16, 2, C.grass3); p.line(16, 2, 16, 5, C.grass3); }),
  rotate: () => icon(p => { for (let a = 0.6; a < 5.6; a += 0.15) p.px(Math.round(9 + Math.cos(a) * 5), Math.round(9 + Math.sin(a) * 5), C.cream); p.rect(12, 3, 3, 3, C.cream); }),
  move: () => icon(p => { p.rect(8, 3, 2, 12, C.cream); p.rect(3, 8, 12, 2, C.cream); p.px(7, 4, C.cream); p.px(10, 4, C.cream); p.px(4, 7, C.cream); p.px(4, 10, C.cream); p.px(13, 7, C.cream); p.px(13, 10, C.cream); p.px(7, 13, C.cream); p.px(10, 13, C.cream); }),
  close: () => icon(p => { p.line(4, 4, 13, 13, C.cream); p.line(5, 4, 14, 13, C.cream); p.line(13, 4, 4, 13, C.cream); p.line(14, 4, 5, 13, C.cream); }),
  sleep: () => icon(p => { p.rect(2, 9, 14, 5, C.coral); p.rect(2, 7, 5, 3, C.cream); p.rect(2, 14, 2, 2, C.wood2); p.rect(14, 14, 2, 2, C.wood2); p.hline(9, 3, 4, C.cream); p.line(12, 3, 9, 6, C.cream); p.hline(9, 6, 4, C.cream); }),
  order: () => icon(p => { p.rect(3, 3, 12, 12, C.cream); p.rect(5, 6, 5, 3, C.orange); p.hline(5, 11, 8, C.stone2); p.rect(11, 5, 3, 3, C.gold); }),
  postcard: () => icon(p => { p.rect(2, 4, 14, 10, C.cream); p.rect(3, 5, 7, 8, C.turq); p.ellipse(6, 10, 2, 1, C.sand); p.hline(11, 7, 4, C.stone2); p.hline(11, 9, 4, C.stone2); p.rect(13, 5, 2, 1, C.red); }),
  hat: () => icon(p => { p.rect(2, 11, 14, 2, '#e9c46a'); p.rrect(5, 5, 8, 7, '#f2d27e'); p.hline(5, 10, 8, C.red); }),
  pickaxe: () => icon(p => {
    p.line(4, 15, 12, 7, C.wood2); p.line(5, 15, 13, 7, C.wood);
    for (let i = 0; i < 9; i++) { const x = 6 + i, y = 3 + Math.round(Math.abs(i - 4) * 0.6); p.px(x, y, C.stone2); p.px(x, y + 1, C.stone); }
    p.px(6, 4, C.stone3); p.px(14, 4, C.stone3);
  }),
  sword: () => icon(p => {
    p.line(5, 13, 14, 4, C.stone); p.line(6, 13, 15, 4, C.white); p.px(14, 3, C.white);
    p.rect(4, 11, 4, 2, C.gold2); p.rect(5, 10, 2, 4, C.gold2); p.line(2, 16, 5, 13, C.wood2);
  }),
  heart: () => icon(p => {
    p.ellipse(6, 7, 3, 3, C.red); p.ellipse(12, 7, 3, 3, C.red);
    for (let y = 8; y < 15; y++) p.hline(3 + (y - 8), y, 13 - 2 * (y - 8), C.red);
    p.px(5, 6, C.coral);
  }),
  snack: () => icon(p => { p.rect(4, 5, 10, 9, '#3f7a52'); p.hline(4, 5, 10, '#5fa070'); for (let x = 5; x < 14; x += 3) p.vline(x, 7, 5, '#2f5f40'); p.rect(6, 9, 6, 2, C.cream); }),
  salad: () => icon(p => { p.ellipse(9, 12, 7, 3, C.white); p.ellipse(9, 10, 6, 3, C.grass2); p.px(6, 9, C.red); p.px(11, 9, C.orange); p.px(9, 8, C.yellow); p.px(12, 11, C.red); }),
  grilled: () => icon(p => { p.ellipse(9, 13, 7, 2, C.white); p.ellipse(9, 10, 5, 3, '#c9804a'); p.px(4, 9, '#a0603a'); p.px(4, 11, '#a0603a'); for (let x = 7; x < 13; x += 2) p.vline(x, 8, 4, '#7a4426'); }),
  ore_copper: () => icon(p => { p.ellipse(9, 10, 6, 5, C.stone2); p.ellipse(9, 9, 5, 4, C.stone); p.px(7, 8, C.orange); p.px(11, 10, C.orange2); p.px(9, 11, C.orange); p.px(10, 7, C.orange); }),
  ore_iron: () => icon(p => { p.ellipse(9, 10, 6, 5, '#7d7a80'); p.ellipse(9, 9, 5, 4, '#a29ea5'); p.px(7, 8, '#e8eef5'); p.px(11, 10, '#a8c4dc'); p.px(9, 11, '#e8eef5'); }),
  ore_gold: () => icon(p => { p.ellipse(9, 10, 6, 5, '#8a7e6a'); p.ellipse(9, 9, 5, 4, '#b0a58c'); p.px(7, 8, C.yellow); p.px(11, 10, C.gold); p.px(9, 11, C.yellow); p.px(10, 7, C.gold); }),
  bar_copper: () => icon(p => { p.rect(3, 8, 12, 6, '#c26b34'); p.rect(4, 7, 10, 2, '#e3924a'); p.hline(5, 8, 6, '#f6b66c'); }),
  bar_iron: () => icon(p => { p.rect(3, 8, 12, 6, '#8a8f99'); p.rect(4, 7, 10, 2, '#b8bec8'); p.hline(5, 8, 6, '#e8eef5'); }),
  bar_gold: () => icon(p => { p.rect(3, 8, 12, 6, C.gold2); p.rect(4, 7, 10, 2, C.gold); p.hline(5, 8, 6, C.yellow); }),
  quartz: () => icon(p => { p.rect(8, 3, 3, 11, '#e8f4ff'); p.rect(5, 7, 3, 7, '#cfe4f5'); p.rect(11, 6, 2, 8, '#d8ecfa'); p.px(9, 3, C.white); }),
  amethyst: () => icon(p => { p.rect(8, 3, 3, 11, '#b27be0'); p.rect(5, 7, 3, 7, '#8f5fc0'); p.rect(11, 6, 2, 8, '#c9a0f0'); p.px(9, 4, '#efe0ff'); }),
  slime: () => icon(p => { p.ellipse(9, 11, 6, 4, '#5fbf5a'); p.ellipse(9, 10, 5, 3, '#8ee07a'); p.px(7, 9, C.white); }),
  wing: () => icon(p => { p.line(3, 6, 15, 6, '#4a3b5c'); for (let x = 4; x < 15; x++) p.vline(x, 7, 3 + ((x * 3) % 4), '#6c5a82'); }),
  ladder: () => icon(p => { p.vline(5, 2, 14, C.wood); p.vline(12, 2, 14, C.wood); for (let y = 4; y < 16; y += 4) p.hline(5, y, 8, C.woodLight); }),
  fire: () => icon(p => { p.ellipse(9, 11, 5, 5, C.orange); p.ellipse(9, 12, 3, 3, C.yellow); p.px(9, 4, C.orange); p.px(7, 6, C.orange); p.rect(4, 15, 10, 2, C.wood2); }),
  axe: () => icon(p => {
    p.line(4, 16, 12, 5, C.wood2); p.line(5, 16, 13, 5, C.wood);
    p.rect(10, 2, 5, 6, C.stone2); p.rect(11, 3, 4, 4, C.stone); p.vline(15, 3, 4, C.white);
  }),
  scythe: () => icon(p => {
    p.line(5, 16, 9, 4, C.wood2); p.line(6, 16, 10, 4, C.wood);
    for (let i = 0; i < 8; i++) p.px(9 + i, 3 + Math.round(Math.sin(i / 7 * Math.PI) * -1 + i * 0.4), C.stone);
    p.line(9, 4, 16, 6, C.white);
  }),
  hoe: () => icon(p => {
    // long handle with a flat blade bent down at the end
    p.line(3, 16, 13, 3, C.wood2); p.line(4, 16, 14, 3, C.wood);
    p.rect(9, 1, 8, 2, C.stone2); p.rect(9, 3, 3, 4, C.stone); p.hline(9, 6, 3, C.white);
  }),
  watering_can: () => icon(p => {
    p.rect(3, 7, 9, 8, C.blueRoof); p.hline(3, 7, 9, '#8fb5dc'); p.rect(4, 4, 6, 2, C.blueRoof2);
    p.line(12, 9, 16, 5, C.blueRoof2); p.px(16, 4, '#9fd6e8'); p.px(17, 6, '#9fd6e8');
  }),
  gift: () => icon(p => { p.rect(3, 7, 12, 8, C.coral2); p.rect(2, 5, 14, 3, C.coral); p.rect(8, 5, 2, 10, C.yellow); p.ellipse(6, 4, 2, 1.5, C.yellow); p.ellipse(12, 4, 2, 1.5, C.yellow); }),
  tv: () => icon(p => { p.rect(2, 4, 14, 10, C.ink2); p.rect(3, 5, 12, 8, '#6fb8c8'); p.hline(4, 7, 8, '#a8e0e8'); p.rect(5, 14, 8, 2, C.wood); }),
  snow: () => icon(p => { for (const [x, y] of [[9, 3], [4, 8], [14, 8], [6, 14], [12, 14], [9, 9]]) { p.px(x, y, C.white); p.px(x - 1, y, '#cfe4f5'); p.px(x + 1, y, '#cfe4f5'); p.px(x, y - 1, '#cfe4f5'); p.px(x, y + 1, '#cfe4f5'); } }),
  fiber: () => icon(p => { for (let i = 0; i < 5; i++) p.line(4 + i * 2, 15, 6 + i * 2, 3, i % 2 ? '#7aa04a' : '#9ab85a'); p.hline(4, 10, 10, C.wood2); }),
  bolt: () => icon(p => { p.line(11, 2, 5, 10, C.yellow); p.line(12, 2, 6, 10, C.yellow); p.rect(5, 9, 8, 2, C.yellow); p.line(12, 10, 7, 16, C.gold); p.line(11, 10, 6, 16, C.yellow); p.px(10, 4, C.white); }),
  egg: () => icon(p => { p.ellipse(9, 10, 4.5, 5.5, C.cream); p.ellipse(9, 11, 4, 4, '#f3e6cc'); p.px(7, 7, C.white); p.px(8, 6, C.white); }),
  duck_egg: () => icon(p => { p.ellipse(9, 10, 5, 6, '#a8d4e6'); p.ellipse(9, 11, 4, 4, '#8cc0d6'); p.px(7, 6, C.white); p.px(11, 12, '#6fa0b8'); }),
  milk: () => icon(p => { p.rect(5, 6, 8, 10, C.white); p.rect(6, 3, 6, 3, '#d8e4ee'); p.rect(5, 9, 8, 3, '#8fb8ef'); p.rect(6, 2, 6, 1, C.stone2); }),
  mayo: () => icon(p => { p.rect(5, 5, 8, 11, '#fff6c8'); p.rect(5, 3, 8, 2, C.coral); p.rect(6, 9, 6, 3, C.yellow); p.vline(6, 6, 9, C.white); }),
  cheese: () => icon(p => { for (let y = 5; y < 15; y++) p.hline(3, y, Math.max(2, Math.round((y - 4) * 1.4)), C.yellow); p.rect(3, 13, 14, 2, C.gold); p.px(7, 11, C.gold2); p.px(11, 9, C.gold2); p.px(12, 13, C.gold2); }),
  jam: () => icon(p => { p.rect(4, 6, 10, 10, '#c03a5a'); p.rect(4, 4, 10, 2, C.cream); p.rect(3, 3, 12, 1, C.red); p.rect(6, 9, 6, 4, C.cream); p.vline(5, 7, 7, '#e06a8a'); }),
  hay: () => icon(p => { for (let i = 0; i < 6; i++) p.line(3 + i * 2, 15, 5 + i * 2, 4, i % 2 ? C.gold : C.yellow); p.hline(3, 10, 12, C.wood2); p.hline(3, 11, 12, C.wood); }),
  hardwood: () => icon(p => { p.rect(3, 6, 12, 7, C.wood3 || C.wood2); p.ellipse(14, 9, 2, 3.5, C.woodLight); p.ellipse(14, 9, 1, 2, C.wood2); p.hline(4, 8, 8, C.wood2); p.hline(4, 11, 8, C.wood2); }),
  mail: () => icon(p => { p.rect(2, 5, 14, 10, C.cream); p.line(2, 5, 9, 11, C.sand2); p.line(16, 5, 9, 11, C.sand2); p.rect(12, 6, 3, 3, C.red); }),
  craft: () => icon(p => { p.rect(2, 11, 14, 4, C.wood); p.hline(2, 11, 14, C.woodLight); p.line(5, 9, 12, 2, C.stone2); p.rect(10, 2, 5, 3, C.stone); p.line(4, 9, 11, 2, C.stone3); }),
  museum: () => icon(p => { p.rect(2, 6, 14, 2, C.cream); for (let i = 0; i < 6; i++) p.line(9 - i, 1 + i, 9 + i, 1 + i, C.cream); for (const x of [3, 7, 11, 14]) p.rect(x, 8, 1, 6, C.white); p.rect(2, 14, 15, 2, C.stone2); }),
  lantern: () => icon(p => { p.rect(6, 5, 7, 9, C.orange); p.rect(7, 6, 5, 7, C.yellow); p.rect(7, 3, 5, 2, C.red2); p.vline(9, 1, 2, C.ink2); p.rect(7, 14, 5, 2, C.red2); p.px(8, 7, C.white); }),
  star: () => icon(p => { const pts = [[9, 2], [11, 7], [16, 7], [12, 10], [14, 15], [9, 12], [4, 15], [6, 10], [2, 7], [7, 7]]; for (let y = 2; y <= 15; y++) for (let x = 2; x <= 16; x++) if (inPoly(x + 0.5, y + 0.5, pts)) p.px(x, y, C.gold); }),
  chicken: () => icon(p => { p.ellipse(9, 11, 5, 4, C.white); p.ellipse(12, 6, 2.5, 2.5, C.white); p.rect(14, 6, 2, 1, C.orange); p.rect(11, 3, 2, 1, C.red); p.px(12, 5, C.ink); p.vline(8, 15, 2, C.orange); p.vline(10, 15, 2, C.orange); }),
  cow: () => icon(p => { p.rect(3, 6, 12, 7, C.white); p.rect(5, 7, 3, 3, C.ink2); p.rect(11, 10, 3, 2, C.ink2); p.rect(13, 4, 4, 5, C.white); p.rect(15, 7, 2, 2, C.pink); p.px(14, 5, C.ink); for (const x of [4, 7, 11, 13]) p.vline(x, 13, 3, C.ink2); }),
  people: () => icon(p => { p.ellipse(9, 5, 3, 3, C.coral); p.rect(5, 9, 8, 7, C.coral2); p.px(8, 4, C.white); }),
  skills: () => icon(p => { p.rect(2, 12, 3, 4, C.grass3); p.rect(6, 9, 3, 7, C.turq); p.rect(10, 6, 3, 10, C.gold); p.rect(14, 3, 2, 13, C.coral); }),
  coal: () => icon(p => { p.ellipse(9, 10, 6, 5, '#2e2a36'); p.ellipse(7, 8, 3, 2, '#4a4456'); p.px(6, 7, '#8a8496'); p.px(12, 12, '#1e1a26'); }),
  sap: () => icon(p => { p.ellipse(9, 11, 5, 5, '#c98a3a'); p.rect(8, 3, 3, 5, '#c98a3a'); p.px(7, 9, '#f2c27a'); p.px(8, 8, '#f2c27a'); }),
  juice: () => icon(p => { p.rect(5, 4, 8, 12, '#9fd6e8'); p.rect(6, 7, 6, 8, '#e98f4a'); p.rect(6, 2, 6, 2, C.wood); p.vline(7, 8, 6, '#f6b66c'); }),
  tapper: () => icon(p => { p.rect(4, 6, 10, 9, '#8a8a96'); p.hline(4, 6, 10, '#b0b0ba'); p.rect(5, 8, 8, 3, '#c98a3a'); p.rect(8, 2, 2, 4, C.wood2); }),
  syrup: () => icon(p => { p.rect(6, 5, 6, 11, '#a8602a'); p.rect(7, 2, 4, 3, C.cream); p.vline(7, 7, 7, '#d8904a'); p.rect(6, 9, 6, 3, C.cream); }),
  sparkle: () => icon(p => { p.rect(8, 2, 2, 14, C.yellow); p.rect(2, 8, 14, 2, C.yellow); p.rect(7, 7, 4, 4, C.white); }),
};

// Seed packets and produce for every crop.
for (const c of Object.values(CROPS)) {
  ICONS['seeds_' + c.id] = () => icon(p => {
    p.rect(4, 3, 10, 13, C.cream); p.rect(4, 3, 10, 3, c.leaf);
    p.ellipse(9, 10, 3, 3, c.fruit); p.px(8, 9, C.white); p.hline(5, 14, 8, C.sand2);
  });
  ICONS['crop_' + c.id] = () => icon(p => {
    if (c.big) { p.ellipse(9, 10, 6, 5, c.fruit); for (let x = 5; x < 14; x += 3) p.vline(x, 6, 8, shade(c.fruit, -0.15)); p.rect(8, 3, 2, 3, c.leaf); }
    else if (c.vine) { for (const [x, y] of [[5, 8], [9, 5], [12, 10], [7, 12]]) { p.rect(x, y, 3, 4, c.fruit); p.px(x, y, C.white); } }
    else { p.ellipse(9, 11, 5, 4, c.fruit); for (let i = 0; i < 3; i++) p.line(9, 7, 6 + i * 3, 2, c.leaf); p.px(7, 10, C.white); }
  });
}

function inPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
