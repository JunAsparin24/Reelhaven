// Shop catalogue and purchasing. Every purchase checks requirements and
// affordability, spends atomically, grants the item, then commits (autosave).
import { getState, commit } from './state.js';
import { emit } from './events.js';
import { checkCost, spend, addItem, describeMissing } from './economy.js';
import { RODS, BAIT, HATS } from '../data/item-data.js';
import { DECOR, BUILDINGS } from '../data/building-data.js';
import { hasBuilding } from './building-count.js';
import { sfx } from './audio.js';
import { ISLANDS } from '../data/island-data.js';

export const MATERIALS = {
  wood: { id: 'wood', name: 'Wood Bundle', qty: 5, price: 30, icon: 'wood' },
  stone: { id: 'stone', name: 'Stone Bundle', qty: 5, price: 40, icon: 'stone' },
  shell: { id: 'shell', name: 'Shell Sack', qty: 3, price: 36, icon: 'shell' },
};

export const BLUEPRINTS = {
  fish_market: { id: 'fish_market', price: 150 },
  storage_shed: { id: 'storage_shed', price: 100 },
  lighthouse: { id: 'lighthouse', price: 400 },
};

export function hasBlueprint(id) {
  if (!BLUEPRINTS[id]) return true;
  return (getState().flags.blueprints || []).includes(id);
}

/** Requirement check shared by the shop UI and purchase(). */
export function requirement(kind, id) {
  const s = getState();
  const lvl = s.player.level;
  const need = def => {
    if (def.minLevel && lvl < def.minLevel) return `Reach level ${def.minLevel}`;
    if (def.requiresBuilding && !hasBuilding(def.requiresBuilding)) return `Build a ${BUILDINGS[def.requiresBuilding].name}`;
    if (def.requiresIsland && !s.islands[def.requiresIsland]?.unlocked) return 'Discover ' + ISLANDS[def.requiresIsland].name;
    return null;
  };
  switch (kind) {
    case 'rod': return s.inventory.rods.includes(id) ? 'Owned' : need(RODS[id]);
    case 'bait': return need(BAIT[id]);
    case 'decor': return need(DECOR[id]);
    case 'blueprint': return hasBlueprint(id) ? 'Owned' : need(BUILDINGS[id]);
    case 'hat': return s.inventory.hats.includes(id) ? 'Owned' : null;
    default: return null;
  }
}

export function priceOf(kind, id) {
  switch (kind) {
    case 'rod': return { coins: RODS[id].price, ...(RODS[id].cost || {}) };
    case 'bait': return { coins: BAIT[id].packPrice, ...(BAIT[id].cost || {}) };
    case 'material': return { coins: MATERIALS[id].price };
    case 'decor': return { coins: DECOR[id].price, ...(DECOR[id].cost || {}) };
    case 'blueprint': return { coins: BLUEPRINTS[id].price };
    case 'hat': return { pearls: HATS[id].pearls };
    default: return {};
  }
}

/** Attempt a purchase. Returns { ok, message }. */
export function purchase(kind, id) {
  const req = requirement(kind, id);
  if (req) { sfx('error'); return { ok: false, message: req === 'Owned' ? 'You already own this.' : req + ' first.' }; }
  const cost = priceOf(kind, id);
  const check = checkCost(cost);
  if (!check.ok) { sfx('error'); return { ok: false, message: 'Not enough: ' + describeMissing(check.missing) + '.' }; }
  if (!spend(cost)) return { ok: false, message: 'Purchase failed.' };
  const s = getState();
  let message = '';
  switch (kind) {
    case 'rod':
      s.inventory.rods.push(id);
      s.inventory.equippedRod = id;
      message = `${RODS[id].name} equipped!`;
      break;
    case 'bait':
      addItem(id, BAIT[id].packSize);
      message = `+${BAIT[id].packSize} ${BAIT[id].name}`;
      break;
    case 'material':
      addItem(id, MATERIALS[id].qty);
      message = `+${MATERIALS[id].qty} ${MATERIALS[id].name.split(' ')[0]}`;
      break;
    case 'decor':
      s.inventory.storedDecor[id] = (s.inventory.storedDecor[id] || 0) + 1;
      message = `${DECOR[id].name} added to your build menu`;
      break;
    case 'blueprint':
      s.flags.blueprints = [...(s.flags.blueprints || []), id];
      message = `${BUILDINGS[id].name} blueprint unlocked!`;
      break;
    case 'hat':
      s.inventory.hats.push(id);
      message = `${HATS[id].name} added to your wardrobe`;
      break;
    default: break;
  }
  sfx('buy');
  emit('purchased', { kind, id });
  commit('purchase');
  return { ok: true, message };
}
