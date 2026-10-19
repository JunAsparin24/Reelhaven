// Authoritative game state. Everything that must persist lives in this plain
// JSON-compatible object; rendering and UI only read from it. Simulation
// modules mutate it through their own functions and then call commit().
import { emit } from './events.js';
import { ISLANDS, ISLAND_ORDER } from '../data/island-data.js';
import { MAIN_QUESTS } from '../data/quest-data.js';
import { defaultPlacements } from './world-gen.js';

export const SAVE_VERSION = 3;
export const GAME_VERSION = '1.0.0';

let state = null;

export function getState() { return state; }
export function setState(s) { state = s; emit('change', { reason: 'load' }); }

/** Notify listeners that state changed; autosave picks this up (debounced). */
export function commit(reason = 'update', important = true) {
  emit('change', { reason, important });
}

let uidCounter = 0;
export function uid(prefix = 'u') {
  uidCounter = (uidCounter + 1) % 1e6;
  return prefix + Date.now().toString(36) + uidCounter.toString(36) + Math.floor(Math.random() * 1296).toString(36);
}

export function defaultSettings() {
  return { music: 0.5, sfx: 0.7, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches, haptics: true, tapToMove: true };
}

export function createIslandState(id) {
  return {
    unlocked: id === 'sunny',
    visited: id === 'sunny',
    placements: defaultPlacements(id).map(p => ({ ...p, uid: uid('p') })),
    nodes: {},          // resource node id -> timestamp when it is ready again
    gardens: {},        // placement uid -> last harvest timestamp
    flags: {},
  };
}

export function createNewState({ name = 'Islander', look }) {
  const islands = {};
  for (const id of ISLAND_ORDER) islands[id] = createIslandState(id);
  const now = Date.now();
  return {
    version: SAVE_VERSION,
    createdAt: now,
    savedAt: now,
    player: {
      name: name.slice(0, 16) || 'Islander',
      look,
      level: 1, xp: 0, coins: 75, pearls: 0,
      island: 'sunny',
      pos: { ...ISLANDS.sunny.spawn },
      facing: 'up',
    },
    inventory: {
      fish: [],                   // [{ uid, id, size, variant, caughtAt }]
      items: { worm_bait: 3 },    // stackables: bait, resources
      rods: ['wooden_rod'],
      equippedRod: 'wooden_rod',
      equippedBait: 'none',
      hats: ['none', 'straw', 'bandana'],
      storedDecor: {},            // decorations picked up from the island
    },
    collection: {},               // fishId -> { count, maxSize, first, variant }
    quests: {
      index: 0,
      baseline: null,
      ready: false,
      done: [],
    },
    daily: { date: null, goals: [], bonusClaimed: false },
    orders: { list: [], nextAt: 0 },
    achievements: {},
    milestones: [],
    stats: {
      fishCaught: 0, fishSold: 0, coinsFromSales: 0, gathered: 0, perfectCasts: 0,
      nightCatches: 0, rareCaught: 0, uncommonCaught: 0, legendaryCaught: 0, treasures: 0,
      ordersDone: 0, buildingsBuilt: 0, decorPlaced: 0, speciesNew: 0, casts: 0, escapes: 0,
      zoneCatch: {}, talked: {},
    },
    flags: {},
    islands,
    world: { minutes: 7 * 60, day: 1, weather: 'sunny', weatherUntil: 10 * 60 },
    settings: defaultSettings(),
  };
}

export function questDef(index) { return MAIN_QUESTS[index] || null; }
