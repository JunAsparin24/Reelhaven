// Runtime world for the current island: effective terrain (island flags
// applied), objects, player-built placements, NPCs and the collision grid.
import { buildIslandMap, T, WALKABLE, WATERY, BUILDABLE, SURFACE } from './world-gen.js';
import { TILE } from './art/tiles.js';
import { ISLANDS } from '../data/island-data.js';
import { INTERIORS } from '../data/interior-data.js';
import { NPCS } from '../data/npc-data.js';
import { PLACEABLES, footprintOf } from '../data/building-data.js';

/**
 * Static object behaviour. resource: what gathering yields; respawn in ms.
 * solid objects block movement on their tile.
 */
export const OBJECT_TYPES = {
  palm: { solid: true, resource: { item: 'wood', amount: [1, 2], respawn: 3 * 60e3, verb: 'Shake' }, keepWhenEmpty: true },
  mangrove: { solid: true, resource: { item: 'wood', amount: [2, 3], respawn: 4 * 60e3, verb: 'Chop' }, keepWhenEmpty: true },
  driftwood: { solid: false, resource: { item: 'wood', amount: [2, 2], respawn: 6 * 60e3, verb: 'Collect' } },
  boulder: { solid: true, resource: { item: 'stone', amount: [1, 2], respawn: 4 * 60e3, verb: 'Mine' }, keepWhenEmpty: true },
  shells: { solid: false, resource: { item: 'shell', amount: [1, 2], respawn: 5 * 60e3, verb: 'Pick up' } },
  seaglass: { solid: false, resource: { item: 'seaglass', amount: [1, 1], respawn: 9 * 60e3, verb: 'Pick up' } },
  tidepool: { solid: false, resource: { item: 'tidepool', amount: [1, 1], respawn: 5 * 60e3, verb: 'Search' }, keepWhenEmpty: true },
  flowerbush: { solid: true, resource: { item: 'flower', amount: [1, 2], respawn: 4 * 60e3, verb: 'Pick' }, keepWhenEmpty: true },
  crystal: { solid: true, resource: { item: 'crystal', amount: [1, 1], respawn: 8 * 60e3, verb: 'Harvest' }, keepWhenEmpty: true },
  rock: { solid: true }, bush: { solid: true }, stump: { solid: true },
  flowers: { solid: false }, reeds: { solid: false }, coral: { solid: false, water: true }, lily: { solid: false, water: true },
  board: { solid: true, interact: { kind: 'board', verb: 'Read', label: 'Quest Board' } },
  shop: { solid: true, footprint: { w: 4, h: 2 }, interact: { kind: 'enter', verb: 'Enter', label: 'Nori’s Shop' }, interior: 'shop_interior' },
  boat: { solid: false, water: true, interact: { kind: 'boat', verb: 'Sail', label: 'Boat' } },
  bridgeSite: { solid: true, interact: { kind: 'bridge', verb: 'Inspect', label: 'Broken Bridge' } },
  // ---- indoor furniture (see data/interior-data.js)
  counter: { solid: true, footprint: { w: 10, h: 1 }, interact: { kind: 'shop', verb: 'Shop', label: 'Shop Counter' } },
  shelf: { solid: true, footprint: { w: 2, h: 1 } },
  shelf_b: { solid: true, footprint: { w: 2, h: 1 } },
  barrel: { solid: true }, crate: { solid: true }, plant: { solid: true }, nightstand: { solid: true },
  fish_tank: { solid: true, footprint: { w: 2, h: 1 } },
  bookshelf: { solid: true, footprint: { w: 2, h: 1 } },
  fireplace: { solid: true, footprint: { w: 2, h: 1 } },
  table: { solid: true, footprint: { w: 2, h: 1 } },
  bed: { solid: true, footprint: { w: 2, h: 2 }, interact: { kind: 'bed', verb: 'Sleep', label: 'Bed' } },
  rug: { solid: false, footprint: { w: 4, h: 2 } },
  doormat: { solid: false, footprint: { w: 2, h: 1 }, interact: { kind: 'exit', verb: 'Leave', label: 'Door' } },
  // ---- home yard + the Old Mine
  yard_fence: { solid: true },
  mine_entrance: { solid: true, footprint: { w: 3, h: 2 }, interact: { kind: 'mine_enter', verb: 'Enter', label: 'Old Mine' } },
  mine_rock: { solid: true, interact: { kind: 'mine', verb: 'Mine', label: 'Rock' } },
  ladder_up: { solid: true, interact: { kind: 'ascend', verb: 'Climb up', label: 'Ladder' } },
  ladder_down: { solid: false, interact: { kind: 'descend', verb: 'Climb down', label: 'Ladder' } },
  cave_crystal: { solid: false },
};

export class World {
  constructor(islandId, islandState) {
    this.id = islandId;
    this.def = ISLANDS[islandId] || INTERIORS[islandId];
    this.map = buildIslandMap(islandId);
    this.w = this.map.w; this.h = this.map.h;
    this.pxW = this.w * TILE; this.pxH = this.h * TILE;
    this.islandState = islandState;
    this.terrain = new Uint8Array(this.map.terrain);
    this.applyFlags();
    this.objects = this.map.objects.map(o => ({ ...o, def: OBJECT_TYPES[o.type] || {}, variant: (o.x * 7 + o.y * 3) % 4 }));
    this.spots = this.map.spots;
    this.broken = new Set();      // mine rocks broken this visit
    this.monsters = (this.map.monsters || []).map((m, i) => ({ id: 'm' + i, ...m, x: m.x * TILE + 8, y: m.y * TILE + 12, hp: null, vx: 0, vy: 0, cool: 0, flash: 0, anim: Math.random() * 4, dir: 'down' }));
    this.npcs = (this.def.npcs || []).map(n => ({
      id: n.id, def: NPCS[n.id], x: n.x * TILE + 8, y: n.y * TILE + 12, homeX: n.x * TILE + 8, homeY: n.y * TILE + 12,
      wander: (n.wander || 0) * TILE, dir: 'down', frame: 0, anim: 0, timer: 1 + Math.random() * 2, tx: null, ty: null,
    }));
    this.rebuild();
  }

  applyFlags() {
    const flags = this.islandState.flags;
    if (flags.bridgeRepaired) for (let i = 0; i < this.terrain.length; i++) if (this.terrain[i] === T.X) this.terrain[i] = T.B;
  }

  /** Surface under a world-pixel position (for footsteps). Decorations like
   *  stone paths override the ground they sit on. */
  surfaceAt(px, py) {
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    const pl = this.placementAt(tx, ty);
    if (pl && pl.type === 'stone_path') return 'stone';
    return SURFACE[this.tile(tx, ty)] || 'grass';
  }

  tile(x, y) { return (x < 0 || y < 0 || x >= this.w || y >= this.h) ? T.W : this.terrain[y * this.w + x]; }
  isWater(x, y) { return WATERY.has(this.tile(x, y)); }

  objectHidden(o) {
    if (this.broken.has(o.id)) return true;
    if (o.type === 'bridgeSite' && this.islandState.flags.bridgeRepaired) return true;
    const res = o.def.resource;
    if (res && !o.def.keepWhenEmpty && !this.nodeReady(o)) return true;
    return false;
  }

  nodeReady(o) {
    const t = this.islandState.nodes[o.id];
    return !t || Date.now() >= t;
  }

  /** Recompute collision + occupancy after placements or flags change. */
  rebuild() {
    const n = this.w * this.h;
    this.solid = new Uint8Array(n);
    this.occupied = new Uint8Array(n);   // anything placed or a fixed object (blocks building)
    this.slow = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const t = this.terrain[i];
      if (!WALKABLE.has(t)) this.solid[i] = 1;
      if (t === T.M) this.slow[i] = 1;
    }
    for (const r of this.def.solid || []) for (let j = r.y; j < r.y + r.h; j++) for (let i = r.x; i < r.x + r.w; i++) this.solid[j * this.w + i] = 1;
    const mark = (x, y, w, h, solid) => {
      for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
        if (i < 0 || j < 0 || i >= this.w || j >= this.h) continue;
        this.occupied[j * this.w + i] = 1;
        if (solid) this.solid[j * this.w + i] = 1;
      }
    };
    for (const o of this.objects) {
      const fp = o.def.footprint || { w: 1, h: 1 };
      const hidden = this.objectHidden(o);
      mark(o.x, o.y, fp.w, fp.h, o.def.solid && !hidden);
    }
    // keep fishing spots and NPC homes free from building
    for (const s of this.spots) mark(s.x, s.y, 1, 1, false);
    // NPC homes (and the tile below, where tall building sprites would cover them)
    for (const npc of this.npcs) mark(Math.floor(npc.homeX / TILE) - 1, Math.floor(npc.homeY / TILE), 3, 2, false);
    this.placed = this.islandState.placements.map(p => this.instance(p));
    for (const p of this.placed) mark(p.x, p.y, p.fw, p.fh, p.def.solid);
    // Building fronts must stay walkable so doors are reachable.
    this.fronts = new Uint8Array(n);
    for (const p of this.placed) if (p.def.kind === 'building') for (let i = p.x; i < p.x + p.fw; i++) {
      const j = p.y + p.fh; if (j < this.h) this.fronts[j * this.w + i] = 1;
    }
  }

  instance(p) {
    const def = PLACEABLES[p.type];
    const fp = footprintOf(def, p.rot || 0);
    return { ...p, def, fw: fp.w, fh: fp.h };
  }

  placementAt(tx, ty) {
    return this.placed.find(p => tx >= p.x && ty >= p.y && tx < p.x + p.fw && ty < p.y + p.fh) || null;
  }

  /** Validate a placement; ignoreUid lets a moved object overlap its old spot. */
  canPlace(type, x, y, rot, ignoreUid = null, playerTile = null) {
    const def = PLACEABLES[type];
    const fp = footprintOf(def, rot);
    const reasons = [];
    const bad = new Set();
    const fail = (r, i, j) => { reasons.push(r); bad.add(i + ',' + j); };
    for (let j = y; j < y + fp.h; j++) for (let i = x; i < x + fp.w; i++) {
      if (i < 0 || j < 0 || i >= this.w || j >= this.h) { fail('edge', i, j); continue; }
      const k = j * this.w + i;
      if (!BUILDABLE.has(this.terrain[k])) { fail('terrain', i, j); continue; }
      const p = this.placementAt(i, j);
      if (p && p.uid !== ignoreUid) { fail('occupied', i, j); continue; }
      if (!p && this.occupied[k]) { fail('occupied', i, j); continue; }
      if (this.fronts[k] && def.solid) {
        const owner = this.placed.find(q => q.def.kind === 'building' && j === q.y + q.fh && i >= q.x && i < q.x + q.fw);
        if (!owner || owner.uid !== ignoreUid) { fail('door', i, j); continue; }
      }
      if (playerTile && def.solid && playerTile.x === i && playerTile.y === j) fail('player', i, j);
    }
    // A building's own doorway must be walkable land.
    if (def.kind === 'building') {
      for (let i = x; i < x + fp.w; i++) {
        const j = y + fp.h;
        const t = this.tile(i, j);
        const p = this.placementAt(i, j);
        if (!WALKABLE.has(t) || (p && p.uid !== ignoreUid && p.def.solid)) fail('front', i, y + fp.h - 1);
      }
    }
    return { ok: reasons.length === 0, reasons, bad, fw: fp.w, fh: fp.h };
  }

  /** Is a pixel-space box free of solid tiles? */
  boxFree(x, y, hw, hh) {
    const x0 = Math.floor((x - hw) / TILE), x1 = Math.floor((x + hw - 0.01) / TILE);
    const y0 = Math.floor((y - hh) / TILE), y1 = Math.floor((y + hh - 0.01) / TILE);
    for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
      if (i < 0 || j < 0 || i >= this.w || j >= this.h) return false;
      if (this.solid[j * this.w + i]) return false;
    }
    return true;
  }

  walkableTile(tx, ty) {
    return tx >= 0 && ty >= 0 && tx < this.w && ty < this.h && !this.solid[ty * this.w + tx];
  }

  /** Breadth-first path between tiles (4-way). Returns array of tiles or null. */
  findPath(sx, sy, gx, gy, maxNodes = 4000) {
    if (!this.walkableTile(gx, gy)) return null;
    const w = this.w;
    const prev = new Int32Array(this.w * this.h).fill(-1);
    const start = sy * w + sx, goal = gy * w + gx;
    const queue = [start];
    prev[start] = start;
    let head = 0;
    while (head < queue.length && head < maxNodes) {
      const cur = queue[head++];
      if (cur === goal) break;
      const cx = cur % w, cy = (cur / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (!this.walkableTile(nx, ny)) continue;
        const ni = ny * w + nx;
        if (prev[ni] !== -1) continue;
        prev[ni] = cur;
        queue.push(ni);
      }
    }
    if (prev[goal] === -1) return null;
    const path = [];
    for (let c = goal; c !== start; c = prev[c]) path.push({ x: c % w, y: (c / w) | 0 });
    return path.reverse();
  }

  /** Nearest walkable tile to a target tile (used when tapping on objects). */
  nearestWalkable(tx, ty, fromX, fromY) {
    let best = null, bestD = Infinity;
    for (let r = 0; r <= 3 && !best; r++) {
      for (let j = ty - r; j <= ty + r; j++) for (let i = tx - r; i <= tx + r; i++) {
        if (!this.walkableTile(i, j)) continue;
        const d = Math.abs(i - fromX) + Math.abs(j - fromY) + (Math.abs(i - tx) + Math.abs(j - ty)) * 4;
        if (d < bestD) { bestD = d; best = { x: i, y: j }; }
      }
    }
    return best;
  }
}
