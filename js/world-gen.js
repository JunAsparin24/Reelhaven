// Deterministic island map builder. Island data files describe each map with
// a short script (blobs, rects, paths, objects, spots); this module turns that
// script into a tile grid plus object / fishing-spot lists.
import { ISLANDS } from '../data/island-data.js';
import { INTERIORS } from '../data/interior-data.js';

export const T = { W: 0, S: 1, G: 2, P: 3, D: 4, B: 5, X: 6, O: 7, M: 8, K: 9, N: 10, R: 11, H: 12, I: 13, L: 14, C: 15, V: 16 };
export const TERRAIN_NAMES = ['water', 'sand', 'grass', 'path', 'dock', 'bridge', 'bridgeBroken', 'pond', 'mud', 'darkgrass', 'moongrass', 'reef', 'shallows', 'floor', 'wall', 'cave', 'rockwall'];

/** Tiles you can stand on. */
export const WALKABLE = new Set([T.S, T.G, T.P, T.D, T.B, T.M, T.K, T.N, T.H, T.I, T.C]);
/** Tiles that count as water for fishing / bobbers. */
export const WATERY = new Set([T.W, T.O, T.R]);
/** Tiles where buildings and decorations may be placed. */
export const BUILDABLE = new Set([T.S, T.G, T.M, T.K, T.N]);

/** What each walkable terrain sounds like underfoot (see js/footsteps.js). */
export const SURFACE = {
  [T.S]: 'sand', [T.G]: 'grass', [T.K]: 'grass', [T.N]: 'grass', [T.P]: 'mud',
  [T.D]: 'wood', [T.B]: 'wood', [T.M]: 'mud', [T.H]: 'shallow_water', [T.I]: 'wood', [T.C]: 'stone',
};

const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

const cache = new Map();

export function buildIslandMap(id) {
  if (cache.has(id)) return cache.get(id);
  const def = ISLANDS[id] || INTERIORS[id];
  const { w, h } = def.size;
  const terrain = new Uint8Array(w * h);
  const objects = [];
  const spots = [];
  const placements = [];
  const monsters = [];
  // Everything a map script draws can be shifted (used when an island grows).
  let ox = 0, oy = 0;
  const idx = (x, y) => y * w + x;
  const inb = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
  const get = (x, y) => (inb(x, y) ? terrain[idx(x, y)] : T.W);

  const m = {
    T,
    fill(t) { terrain.fill(t); },
    offset(x, y) { ox = x; oy = y; },
    raw(x, y, t) { if (inb(x, y)) terrain[idx(x, y)] = t; },
    set(x, y, t) { x += ox; y += oy; if (inb(x, y)) terrain[idx(x, y)] = t; },
    rect(x, y, rw, rh, t) { for (let j = y; j < y + rh; j++) for (let i = x; i < x + rw; i++) m.set(i, j, t); },
    blob(cx, cy, rx, ry, t, wobble = 0.1, seed = 0) {
      for (let y = Math.floor(cy - ry - 3); y <= cy + ry + 3; y++) {
        for (let x = Math.floor(cx - rx - 3); x <= cx + rx + 3; x++) {
          const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
          const ang = Math.atan2(dy, dx);
          const mod = 1 + wobble * (Math.sin(ang * 3 + seed * 1.7) * 0.6 + Math.sin(ang * 7 + seed * 3.1) * 0.4);
          if (dx * dx + dy * dy <= mod * mod) m.set(x, y, t);
        }
      }
    },
    path(points, t, width = 1) {
      for (let i = 0; i < points.length - 1; i++) {
        const [x0, y0] = points[i], [x1, y1] = points[i + 1];
        const sx = Math.sign(x1 - x0), sy = Math.sign(y1 - y0);
        let x = x0, y = y0;
        for (;;) {
          for (let k = 0; k < width; k++) m.set(sx === 0 ? x + k : x, sx === 0 ? y : y + k, t);
          if (x === x1 && y === y1) break;
          x += sx; y += sy;
        }
      }
    },
    obj(type, x, y, extra = {}) { x += ox; y += oy; objects.push({ id: `${type}_${x}_${y}`, type, x, y, ...extra }); },
    place(type, x, y, rot = 0) { placements.push({ type, x: x + ox, y: y + oy, rot }); },
    spot(sid, zone, x, y, facing, name, extra = {}) { spots.push({ id: sid, zone, x: x + ox, y: y + oy, facing, name, ...extra }); },
    monster(type, x, y) { monsters.push({ type, x: x + ox, y: y + oy }); },
  };

  def.build(m);

  // Snap fishing spots so the player stands on the last land tile facing water.
  for (const s of spots) {
    const [dx, dy] = DIRS[s.facing];
    let x = s.x, y = s.y, guard = 0;
    while (!WALKABLE.has(get(x, y)) && guard++ < 20) { x -= dx; y -= dy; }
    guard = 0;
    while (WALKABLE.has(get(x + dx, y + dy)) && guard++ < 30) { x += dx; y += dy; }
    s.x = x; s.y = y;
    s.waterX = x + dx * 3; s.waterY = y + dy * 3;
    if (!WATERY.has(get(s.waterX, s.waterY))) { s.waterX = x + dx * 2; s.waterY = y + dy * 2; }
  }

  // Land objects that ended up in the sea (coastlines are noisy) move to the
  // nearest free land tile so they never float on water.
  const WATER_OBJECTS = new Set(['coral', 'lily', 'boat']);
  const taken = new Set(objects.map(o => o.x + ',' + o.y));
  // Keep fishing spots (and the tile behind them) clear.
  for (const sp of spots) { const [dx, dy] = DIRS[sp.facing]; taken.add(sp.x + ',' + sp.y); taken.add((sp.x - dx) + ',' + (sp.y - dy)); }
  for (const o of def.interior ? [] : objects) {
    if (WATER_OBJECTS.has(o.type) || BUILDABLE.has(get(o.x, o.y))) continue;
    let best = null;
    for (let r = 1; r <= 5 && !best; r++) {
      for (let j = o.y - r; j <= o.y + r && !best; j++) for (let i = o.x - r; i <= o.x + r; i++) {
        if (BUILDABLE.has(get(i, j)) && !taken.has(i + ',' + j)) { best = { x: i, y: j }; break; }
      }
    }
    if (best && o.type !== 'shop' && o.type !== 'bridgeSite') {
      taken.delete(o.x + ',' + o.y);
      o.x = best.x; o.y = best.y; o.id = `${o.type}_${o.x}_${o.y}`;
      taken.add(o.x + ',' + o.y);
    }
  }

  const map = { id, w, h, terrain, objects, spots, placements, monsters, get, inb };
  cache.set(id, map);
  return map;
}

/** Drop a cached map (mine floors are regenerated on every visit). */
export function forgetMap(id) { cache.delete(id); }

export function defaultPlacements(id) {
  return buildIslandMap(id).placements;
}

export { DIRS };
