// Currency and cost handling. All spending goes through canAfford/spend so
// balances can never go negative and multi-resource costs are atomic.
import { getState } from './state.js';
import { emit } from './events.js';
import { RESOURCES } from '../data/item-data.js';

export function coins() { return getState().player.coins; }

export function addCoins(n, source = 'other') {
  if (!Number.isFinite(n) || n <= 0) return;
  const p = getState().player;
  p.coins = Math.floor(p.coins + n);
  emit('coins', { delta: n, source });
}

export function addPearls(n) {
  if (!Number.isFinite(n) || n <= 0) return;
  getState().player.pearls += Math.floor(n);
  emit('pearls', { delta: n });
}

export function itemCount(id) { return getState().inventory.items[id] || 0; }

export function addItem(id, n = 1) {
  if (n <= 0) return;
  const items = getState().inventory.items;
  items[id] = (items[id] || 0) + n;
}

export function removeItem(id, n = 1) {
  const items = getState().inventory.items;
  if ((items[id] || 0) < n) return false;
  items[id] -= n;
  if (items[id] <= 0) delete items[id];
  return true;
}

/**
 * cost: { coins?, pearls?, wood?, stone?, ... }
 * Returns { ok, missing: [{ id, need, have }] }
 */
export function checkCost(cost = {}) {
  const s = getState();
  const missing = [];
  for (const [id, need] of Object.entries(cost)) {
    if (!need) continue;
    const have = id === 'coins' ? s.player.coins : id === 'pearls' ? s.player.pearls : itemCount(id);
    if (have < need) missing.push({ id, need, have });
  }
  return { ok: missing.length === 0, missing };
}

export function spend(cost = {}) {
  const check = checkCost(cost);
  if (!check.ok) return false;
  const s = getState();
  for (const [id, need] of Object.entries(cost)) {
    if (!need) continue;
    if (id === 'coins') s.player.coins -= need;
    else if (id === 'pearls') s.player.pearls -= need;
    else removeItem(id, need);
  }
  emit('spent', { cost });
  return true;
}

export function costName(id) {
  if (id === 'coins') return 'coins';
  if (id === 'pearls') return 'pearls';
  return RESOURCES[id]?.name || id;
}

export function describeMissing(missing) {
  return missing.map(m => `${m.need - m.have} more ${costName(m.id)}`).join(', ');
}

/** Merge a building/item def's coin price and resource cost into one cost object. */
export function fullCost(def) {
  return { coins: def.price || 0, ...(def.cost || {}) };
}

/** Grant a reward bundle { coins, pearls, xp, items } — xp handled by progression. */
export function grantItems(reward = {}) {
  if (reward.coins) addCoins(reward.coins, 'reward');
  if (reward.pearls) addPearls(reward.pearls);
  for (const [id, n] of Object.entries(reward.items || {})) addItem(id, n);
}
