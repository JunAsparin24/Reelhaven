// The Old Mine: every floor is a freshly carved cave. Rocks hide ore, gems and
// (in exactly one of them) the ladder down. Monsters get tougher with depth,
// and every 5th floor becomes a checkpoint you can start from next time.
import { INTERIORS } from './interior-data.js';
import { FLOOR_CHESTS } from './weapon-data.js';

const THEME = { deep: 'deep', near: 'ocean', shallow: 'shallow', pond: 'pond', reef: 'reef', grass: 'grass', sand: 'sand' };

/** Rock kinds. hp = pickaxe power needed in total; drops are [item, min, max, chance]. */
export const ROCKS = {
  stone: { label: 'Rock', hp: 2, drops: [['stone', 1, 2, 1]] },
  copper: { label: 'Copper Rock', hp: 3, drops: [['copper_ore', 1, 3, 1], ['stone', 0, 1, 0.5]] },
  iron: { label: 'Iron Rock', hp: 5, drops: [['iron_ore', 1, 3, 1], ['stone', 0, 1, 0.5]] },
  gold: { label: 'Gold Rock', hp: 8, drops: [['gold_ore', 1, 2, 1]] },
  gem: { label: 'Gem Rock', hp: 6, drops: [['quartz', 1, 1, 0.8], ['amethyst', 1, 1, 0.25]] },
};

/** Monster stats; scaled by floor in js/combat.js. */
export const MONSTERS = {
  slime: { name: 'Slime', hp: 22, speed: 20, damage: 7, xp: 4, coins: [1, 4], drops: [['slime', 1, 0.7]], from: 1 },
  bat: { name: 'Cave Bat', hp: 14, speed: 36, damage: 6, xp: 5, coins: [2, 5], drops: [['bat_wing', 1, 0.5]], from: 3, flies: true },
  crab: { name: 'Rock Crab', hp: 48, speed: 15, damage: 12, xp: 9, coins: [4, 9], drops: [['stone', 2, 1], ['iron_ore', 1, 0.3]], from: 6 },
  shade: { name: 'Shadow Wisp', hp: 40, speed: 30, damage: 15, xp: 14, coins: [8, 16], drops: [['amethyst', 1, 0.15]], from: 11, flies: true },
};

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function rockKind(level, r) {
  const x = r();
  if (level >= 10 && x < 0.12) return 'gold';
  if (level >= 4 && x < 0.2) return 'gem';
  if (level >= 5 && x < 0.38) return 'iron';
  if (x < (level >= 5 ? 0.55 : 0.32)) return 'copper';
  return 'stone';
}

/** Create (and register) the definition for one mine floor. */
export function mineFloor(level, seed = Date.now()) {
  const id = 'mine_' + level;
  const r = rng(seed * 31 + level * 977);
  const w = 30, h = 24;
  const def = {
    id, name: `Old Mine · Floor ${level}`, interior: true, mine: true, level, theme: THEME,
    size: { w, h },
    spawn: null,          // filled in by build()
    build(m) {
      const { C, V } = m.T;
      m.fill(V);
      // carve the cave with a few wandering diggers from the middle
      const open = new Set();
      const dig = (x, y) => { if (x < 2 || y < 3 || x > w - 3 || y > h - 3) return; m.set(x, y, C); open.add(x + ',' + y); };
      const sx = 4 + Math.floor(r() * (w - 8)), sy = 4 + Math.floor(r() * 4);
      for (let k = 0; k < 6; k++) {
        let x = sx, y = sy;
        for (let i = 0; i < 260; i++) {
          dig(x, y); dig(x + 1, y); dig(x, y + 1);
          const d = Math.floor(r() * 4);
          x += [1, -1, 0, 0][d]; y += [0, 0, 1, -1][d];
          x = Math.max(2, Math.min(w - 4, x)); y = Math.max(3, Math.min(h - 4, y));
        }
      }
      // a few round chambers
      for (let k = 0; k < 4; k++) {
        const cx = 4 + Math.floor(r() * (w - 8)), cy = 5 + Math.floor(r() * (h - 9)), rad = 2 + Math.floor(r() * 2);
        for (let y = cy - rad; y <= cy + rad; y++) for (let x = cx - rad; x <= cx + rad; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= rad * rad + 1) dig(x, y);
        // connect the chamber to the start
        let x = cx, y = cy;
        while (x !== sx || y !== sy) { dig(x, y); if (x !== sx && (r() < 0.5 || y === sy)) x += Math.sign(sx - x); else y += Math.sign(sy - y); }
      }
      def.spawn = { x: sx, y: sy + 1 };
      dig(sx, sy + 1); dig(sx, sy + 2);
      m.obj('ladder_up', sx, sy);
      const tiles = [...open].map(k => k.split(',').map(Number)).filter(([x, y]) => Math.abs(x - sx) + Math.abs(y - sy) > 2);
      // rocks
      const rocks = [];
      for (const [x, y] of tiles) {
        if (r() > 0.24) continue;
        const kind = rockKind(level, r);
        m.obj('mine_rock', x, y, { kind, label: ROCKS[kind].label });
        rocks.push({ x, y });
      }
      // exactly one rock far from the start hides the ladder down
      const far = rocks.filter(t => Math.abs(t.x - sx) + Math.abs(t.y - sy) > 8);
      const pick = (far.length ? far : rocks)[Math.floor(r() * (far.length || rocks.length))];
      def.ladderAt = pick ? { x: pick.x, y: pick.y } : null;
      // a few breakable crates (coins, snacks, ore, rare swords)
      const freeTile = () => {
        for (let tries = 0; tries < 40; tries++) {
          const t = tiles[Math.floor(r() * tiles.length)];
          if (t && !rocks.some(q => q.x === t[0] && q.y === t[1])) { rocks.push({ x: t[0], y: t[1], crate: true }); return t; }
        }
        return null;
      };
      for (let k = 0; k < 2 + Math.floor(r() * 3); k++) { const t = freeTile(); if (t) m.obj('mine_crate', t[0], t[1]); }
      // milestone floors hide a treasure chest close to the ladder
      if (FLOOR_CHESTS[level]) {
        const spot = [[sx + 2, sy + 1], [sx - 2, sy + 1], [sx + 1, sy + 3], [sx - 1, sy + 3]].find(([x, y]) => open.has(x + ',' + y) && !rocks.some(q => q.x === x && q.y === y));
        if (spot) m.obj('mine_chest', spot[0], spot[1], { level });
      }
      // glowing crystals for a little light
      for (let k = 0; k < 6; k++) {
        const t = tiles[Math.floor(r() * tiles.length)];
        if (t && !rocks.some(q => q.x === t[0] && q.y === t[1])) m.obj('cave_crystal', t[0], t[1]);
      }
      // monsters
      const kinds = Object.entries(MONSTERS).filter(([, d]) => level >= d.from).map(([k]) => k);
      const n = Math.min(14, 3 + Math.floor(level * 0.7));
      const free = tiles.filter(([x, y]) => Math.abs(x - sx) + Math.abs(y - sy) > 6 && !rocks.some(q => q.x === x && q.y === y));
      for (let k = 0; k < n && free.length; k++) {
        const [x, y] = free.splice(Math.floor(r() * free.length), 1)[0];
        m.monster(kinds[Math.floor(r() * kinds.length)], x, y);
      }
    },
    npcs: [],
  };
  INTERIORS[id] = def;
  return def;
}
