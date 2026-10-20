// Authoritative game state. Everything that must persist lives in this plain
// JSON-compatible object; rendering and UI only read from it. Simulation
// modules mutate it through their own functions and then call commit().
import { emit } from './events.js';
import { ISLANDS, ISLAND_ORDER } from '../data/island-data.js';
import { MAIN_QUESTS } from '../data/quest-data.js';
import { defaultPlacements } from './world-gen.js';

export const SAVE_VERSION = 5;
export const GAME_NAME = 'Reelhaven';
// Version: 26 = the year (2026), then .1, then the number of commits so far.
export const GAME_VERSION = '26.1.47';

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
  return { master: 1, music: 0.5, sfx: 0.7, footsteps: 0.8, ambience: 0.6, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches, haptics: true, tapToMove: true };
}

export function createIslandState(id) {
  return {
    unlocked: id === 'sunny',
    visited: id === 'sunny',
    placements: defaultPlacements(id).map(p => ({ ...p, uid: uid('p') })),
    nodes: {},          // resource node id -> timestamp when it is ready again
    gardens: {},        // placement uid -> last harvest timestamp
    chests: {},         // chest placement uid -> { itemId: count }
    flags: {},
    layout: 2,          // map layout version (2 = Sunny Shores with the home yard)
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
      hp: 100, maxHp: 100,
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
      tools: { pickaxe: 0, sword: 0 },   // tier index into TOOLS (data/item-data.js)
      held: 'rod',                // what the hotbar has selected: rod | pickaxe | sword
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
      mineDeepest: 0, monstersSlain: 0, rocksBroken: 0, daysSlept: 0,
    },
    flags: {},
    islands,
    world: { minutes: 7 * 60, day: 1, weather: 'sunny', weatherUntil: 10 * 60 },
    settings: defaultSettings(),
  };
}

export function questDef(index) { return MAIN_QUESTS[index] || null; }
