// Fish inventory, capacity and selling.
import { getState, uid, commit } from './state.js';
import { emit, toast } from './events.js';
import { addCoins, removeItem, itemCount } from './economy.js';
import { FISH_BY_ID, VARIANT } from '../data/fish-data.js';
import { BASE_FISH_CAPACITY, MARKET_SELL_BONUS, RESOURCE_SELL } from '../data/item-data.js';
import { BUILDINGS } from '../data/building-data.js';
import { countBuilt } from './building-count.js';
import { eventEffect } from './world-events.js';
import { START_BAG, hasRoomFor, freeSlots, fishKey, noticeGain } from './bag.js';

/** Number of bag slots (12 to start; backpacks add rows). */
export function capacity() { return getState().inventory.bagSize || START_BAG; }

export function fishCount() { return getState().inventory.fish.length; }

/**
 * Is there no room for a fish? Same species stack together, so a fish you
 * already carry always fits; a new species needs a free slot.
 */
export function isFull(fishId = null, variant = false) {
  if (fishId) return !hasRoomFor(fishKey(fishId, variant));
  return freeSlots() === 0;
}

/** Sell value of one caught fish (size and variant adjust the base price). */
export function fishValue(entry) {
  const def = FISH_BY_ID[entry.id];
  if (!def || def.release) return 0;
  const [mn, mx] = def.size;
  const sizeT = mx > mn ? (entry.size - mn) / (mx - mn) : 0.5;
  let v = def.price * (0.85 + sizeT * 0.4);
  if (entry.variant) v *= VARIANT.priceMult;
  if (countBuilt('fish_market') > 0) v *= 1 + MARKET_SELL_BONUS;
  v *= 1 + eventEffect('sellBonus');
  return Math.max(1, Math.round(v));
}

export function addFish(id, size, variant) {
  const entry = { uid: uid('f'), id, size, variant: !!variant, caughtAt: Date.now() };
  getState().inventory.fish.push(entry);
  noticeGain(fishKey(id, variant));
  return entry;
}

export function removeFishByUid(uids) {
  const set = new Set(uids);
  const inv = getState().inventory;
  const removed = inv.fish.filter(f => set.has(f.uid));
  inv.fish = inv.fish.filter(f => !set.has(f.uid));
  return removed;
}

/** Group fish into stacks by species+variant for display and batch selling. */
export function fishStacks() {
  const groups = new Map();
  for (const f of getState().inventory.fish) {
    const key = f.id + (f.variant ? '*' : '');
    if (!groups.has(key)) groups.set(key, { key, id: f.id, variant: f.variant, entries: [], value: 0 });
    const g = groups.get(key);
    g.entries.push(f);
    g.value += fishValue(f);
  }
  const order = ['legendary', 'epic', 'rare', 'uncommon', 'common'];
  return [...groups.values()].sort((a, b) =>
    order.indexOf(FISH_BY_ID[a.id].rarity) - order.indexOf(FISH_BY_ID[b.id].rarity) || a.id.localeCompare(b.id));
}

/** Sell specific fish. Returns coins earned. */
export function sellFish(uids) {
  const s = getState();
  const removed = removeFishByUid(uids);
  if (!removed.length) return 0;
  const total = removed.reduce((sum, f) => sum + fishValue(f), 0);
  addCoins(total, 'sale');
  s.stats.fishSold += removed.length;
  s.stats.coinsFromSales += total;
  emit('fishSold', { count: removed.length, coins: total });
  commit('sell');
  return total;
}

export function sellAllFish() {
  return sellFish(getState().inventory.fish.map(f => f.uid));
}

export function sellResource(id, n) {
  const price = RESOURCE_SELL[id];
  if (!price || n <= 0 || itemCount(id) < n) return 0;
  removeItem(id, n);
  const total = price * n;
  addCoins(total, 'sale');
  getState().stats.coinsFromSales += total;
  emit('resourceSold', { id, n, coins: total });
  toast(`Sold ${n} for ${total} coins`, 'coin', 'good');
  commit('sellResource');
  return total;
}
