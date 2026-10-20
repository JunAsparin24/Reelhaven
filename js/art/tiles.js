// Terrain tile art (16x16). Water is animated through pre-rendered frames.
import { paint, hash2, shade } from './pixel.js';
import { C } from './palette.js';

export const TILE = 16;
export const WATER_FRAMES = 8;

/** Water styles per island theme: [base, highlight, sparkle]. */
export const WATER_STYLES = {
  deep: [C.deep, '#2f90a2', C.turq],
  ocean: [C.ocean, '#56bcc2', C.foam],
  shallow: [C.turq, '#86ddd5', C.foam],
  reef: [C.reef, '#7fd6cf', C.foam],
  pond: ['#5fb5b0', '#7ccac3', C.foam],
  mist: [C.mistWater, '#6dada5', '#cfe8e2'],
  mistDeep: [C.mistWater2, '#5a9590', '#bcd9d3'],
  moon: [C.moonWater, '#386491', '#9fd0ff'],
  moonDeep: [C.moonWater2, '#2c5381', '#7fd8ff'],
  wade: ['#93d6c7', '#b2e6da', C.foam],
};

function waterFrame(style, f, variant) {
  const [base, hi, sp] = WATER_STYLES[style];
  return paint(TILE, TILE, p => {
    p.rect(0, 0, TILE, TILE, base);
    // Two drifting wave crests; positions wrap so tiles connect seamlessly.
    const phase = (f / WATER_FRAMES) * Math.PI * 2;
    for (let i = 0; i < 2; i++) {
      const y = (4 + i * 8 + variant * 3) % 16;
      const x = Math.round((i * 7 + variant * 5 + f * 2) % 16);
      const len = 3 + Math.round(Math.sin(phase + i) * 1.5 + 1.5);
      for (let k = 0; k < len; k++) p.px((x + k) % 16, y, hi);
      p.px((x + 1) % 16, (y + 1) % 16, shade(base, 0.08));
    }
    if ((f + variant) % 8 === 0) p.px((variant * 5 + 3) % 16, (variant * 3 + 9) % 16, sp);
  });
}

export function buildWaterFrames() {
  const out = {};
  for (const style of Object.keys(WATER_STYLES)) {
    out[style] = [];
    for (let v = 0; v < 4; v++) {
      const frames = [];
      for (let f = 0; f < WATER_FRAMES; f++) frames.push(waterFrame(style, f, v));
      out[style].push(frames);
    }
  }
  return out;
}

export function grassTile(v) {
  return paint(TILE, TILE, p => {
    p.rect(0, 0, 16, 16, C.grass);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const h = hash2(x, y, v + 11);
      if (h < 0.06) p.px(x, y, C.grass2);
      else if (h > 0.975) p.px(x, y, C.mint);
    }
    // a couple of tufts
    const tufts = [[3 + v, 5], [10, 11 - v], [12 - v, 3]];
    for (const [x, y] of tufts) {
      p.px(x, y, C.grass3); p.px(x + 2, y, C.grass3); p.px(x + 1, y - 1, C.grass3);
    }
  });
}

export function sandTile(v) {
  return paint(TILE, TILE, p => {
    p.rect(0, 0, 16, 16, C.sand);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const h = hash2(x, y, v + 3);
      if (h < 0.05) p.px(x, y, C.sand2);
      else if (h > 0.985) p.px(x, y, C.cream);
    }
    if (v === 2) { p.px(5, 9, C.coral); p.px(6, 9, C.cream); }
  });
}

export function pathTile(v) {
  return paint(TILE, TILE, p => {
    p.rect(0, 0, 16, 16, C.path);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const h = hash2(x, y, v + 21);
      if (h < 0.08) p.px(x, y, C.path2);
      else if (h > 0.97) p.px(x, y, C.sand);
    }
    p.rect(3 + v, 4, 2, 1, C.stone); p.rect(10, 11 - v, 2, 1, C.stone);
  });
}

export function mudTile(v) {
  return paint(TILE, TILE, p => {
    p.rect(0, 0, 16, 16, '#9c8a63');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const h = hash2(x, y, v + 41);
      if (h < 0.08) p.px(x, y, C.mud);
      else if (h > 0.975) p.px(x, y, '#b4a37a');
    }
  });
}

export function darkGrassTile(v) {
  return paint(TILE, TILE, p => {
    p.rect(0, 0, 16, 16, '#6aa47a');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const h = hash2(x, y, v + 61);
      if (h < 0.07) p.px(x, y, C.forest);
      else if (h > 0.98) p.px(x, y, C.grass);
    }
    p.px(4 + v, 6, C.forest2); p.px(6 + v, 6, C.forest2); p.px(5 + v, 5, C.forest2);
  });
}

export function moonGrassTile(v) {
  return paint(TILE, TILE, p => {
    p.rect(0, 0, 16, 16, '#8ab89a');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const h = hash2(x, y, v + 71);
      if (h < 0.07) p.px(x, y, '#72a283');
      else if (h > 0.985) p.px(x, y, '#e2fff2');
    }
  });
}

export function dockTile(v) {
  return paint(TILE, TILE, p => {
    p.rect(0, 0, 16, 16, C.wood);
    for (let y = 0; y < 16; y += 4) {
      p.hline(0, y + 3, 16, C.wood3);
      p.hline(0, y, 16, C.woodLight);
      const seam = (y * 5 + v * 7) % 16;
      p.vline(seam, y, 3, C.wood2);
    }
    p.px(2, 1, C.wood3); p.px(13, 9, C.wood3);
  });
}

export function bridgeTile(broken) {
  return paint(TILE, TILE, p => {
    // planks run vertically (bridge spans horizontally)
    for (let x = 0; x < 16; x += 4) {
      if (broken && (x === 4 || x === 12)) continue;
      p.rect(x, 1, 3, 14, broken ? C.wood2 : C.wood);
      p.vline(x, 1, 14, broken ? C.wood3 : C.woodLight);
      p.px(x + 1, 3, C.wood3); p.px(x + 1, 12, C.wood3);
    }
    p.hline(0, 0, 16, broken ? C.wood3 : C.wood2);
    p.hline(0, 15, 16, broken ? C.wood3 : C.wood2);
    if (broken) { p.px(9, 15, C.wood3); p.px(10, 14, C.wood3); }
  });
}

/** Indoor wooden floorboards (planks run horizontally, staggered seams). */
export function floorTile(v) {
  return paint(TILE, TILE, p => {
    p.rect(0, 0, 16, 16, '#c98d5e');
    for (let y = 0; y < 16; y += 4) {
      p.hline(0, y, 16, '#d8a273');
      p.hline(0, y + 3, 16, '#a96f47');
      const seam = (y * 3 + v * 6 + (y / 4) * 5) % 16;
      p.vline(seam, y, 3, '#a96f47');
      for (let x = 0; x < 16; x++) if (hash2(x, y + 1, v + 81) < 0.08) p.px(x, y + 1, '#bd8155');
    }
  });
}

/** Back wall: `lower` is the row touching the floor (wainscot + skirting),
 *  the upper row is wallpaper with a little window or picture now and then. */
export function wallTile(lower, v = 0) {
  return paint(TILE, TILE, p => {
    if (lower) {
      p.rect(0, 0, 16, 7, '#efdcbc');
      for (let x = 1; x < 16; x += 4) p.vline(x, 0, 7, '#e6cfa9');
      p.rect(0, 7, 16, 9, '#a96f47');
      p.hline(0, 7, 16, '#d8a273');
      for (let x = 0; x < 16; x += 8) p.vline(x, 8, 6, '#8c5a39');
      p.rect(0, 14, 16, 2, '#744631');
    } else {
      p.rect(0, 0, 16, 16, '#efdcbc');
      for (let x = 1; x < 16; x += 4) p.vline(x, 0, 16, '#e6cfa9');
      p.rect(0, 0, 16, 2, '#744631');
      p.hline(0, 2, 16, '#97603e');
      if (v === 1) {   // window
        p.rect(4, 5, 8, 8, '#744631'); p.rect(5, 6, 6, 6, '#9fd6e8');
        p.vline(8, 6, 6, '#744631'); p.hline(5, 9, 6, '#744631'); p.px(6, 7, '#fbfbf6');
        p.hline(3, 13, 10, '#97603e');
      } else if (v === 2) {   // little framed picture
        p.rect(5, 6, 6, 5, '#97603e'); p.rect(6, 7, 4, 3, '#8cc78a'); p.px(7, 7, '#f8dc7c');
      }
    }
  });
}

export function buildTileset() {
  const range = n => [...Array(n).keys()];
  return {
    grass: range(4).map(grassTile),
    sand: range(4).map(sandTile),
    path: range(3).map(pathTile),
    mud: range(3).map(mudTile),
    darkgrass: range(3).map(darkGrassTile),
    moongrass: range(3).map(moonGrassTile),
    dock: range(3).map(dockTile),
    bridge: [bridgeTile(false)],
    bridgeBroken: [bridgeTile(true)],
    floor: range(3).map(floorTile),
    wallUpper: range(3).map(v => wallTile(false, v)),
    wallLower: [wallTile(true)],
    water: buildWaterFrames(),
  };
}
