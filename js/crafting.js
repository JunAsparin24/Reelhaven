// Storage chests and the furnace / campfire.
import { getState, commit } from './state.js';
import { emit } from './events.js';
import { addItem, removeItem, itemCount } from './economy.js';
import { SMELT_RECIPES } from '../data/item-data.js';
import { fishValue, removeFishByUid } from './inventory.js';
import { sfx } from './audio.js';

// ---------------------------------------------------------------- chests
/** The item stacks inside a placed chest (on the island it stands on). */
export function chestItems(islandId, uid) {
  const isl = getState().islands[islandId];
  isl.chests = isl.chests || {};
  return (isl.chests[uid] = isl.chests[uid] || {});
}

export function chestEmpty(islandId, uid) {
  const c = getState().islands[islandId]?.chests?.[uid];
  return !c || !Object.values(c).some(n => n > 0);
}

/** Move n of an item between the bag and a chest. toChest = true stores it. */
export function transfer(islandId, uid, id, n, toChest) {
  const box = chestItems(islandId, uid);
  if (toChest) {
    n = Math.min(n, itemCount(id));
    if (n <= 0 || !removeItem(id, n)) return 0;
    box[id] = (box[id] || 0) + n;
  } else {
    n = Math.min(n, box[id] || 0);
    if (n <= 0) return 0;
    box[id] -= n;
    if (box[id] <= 0) delete box[id];
    addItem(id, n);
  }
  sfx('gather');
  commit('chest');
  return n;
}

// ---------------------------------------------------------------- furnace
const cheapestFish = () => {
  const fish = getState().inventory.fish;
  return fish.length ? fish.reduce((a, b) => (fishValue(b) < fishValue(a) ? b : a)) : null;
};

/** Which inputs are missing for a recipe ([] when it can be made). */
export function missingFor(recipe) {
  const out = [];
  for (const [id, need] of Object.entries(recipe.in)) {
    const have = id === 'fish' ? getState().inventory.fish.length : itemCount(id);
    if (have < need) out.push({ id, need, have });
  }
  return out;
}

/** Make one of a recipe. Returns { ok, message }. */
export function smelt(recipe) {
  if (missingFor(recipe).length) { sfx('error'); return { ok: false, message: 'Not enough materials.' }; }
  for (const [id, need] of Object.entries(recipe.in)) {
    if (id === 'fish') { for (let i = 0; i < need; i++) { const f = cheapestFish(); if (f) removeFishByUid([f.uid]); } }
    else removeItem(id, need);
  }
  for (const [id, n] of Object.entries(recipe.out)) addItem(id, n);
  sfx('smelt');
  emit('smelted', { id: recipe.id });
  commit('smelt');
  return { ok: true, message: 'Done!' };
}

/** Recipes a station can make: the campfire only cooks. */
export function recipesFor(station) {
  return station === 'campfire' ? SMELT_RECIPES.filter(r => r.id === 'grilled_fish') : SMELT_RECIPES;
}
