import { CRAFT_RECIPES } from '../data/life-data.js';
// Shop catalogue and purchasing. Every purchase checks requirements and
// affordability, spends atomically, grants the item, then commits (autosave).
import { getState, commit } from './state.js';
import { emit } from './events.js';
import { checkCost, spend, addItem, describeMissing } from './economy.js';
import { RODS, BAIT, HATS, TOOLS, FOOD, RESOURCES } from '../data/item-data.js';
import { CROPS, seasonOf } from '../data/farm-data.js';
import { BACKPACKS, hasRoomFor } from './bag.js';
import { SWORDS } from '../data/weapon-data.js';
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
    case 'recipe': return (s.recipes || []).includes(id) ? 'Owned' : null;
    case 'tool': {
      const next = TOOLS[id][(s.inventory.tools[id] || 0) + 1];
      return next ? need(next) : 'Owned';
    }
    case 'food': return null;
    case 'sword': {
      const tier = Number(id), sw = SWORDS[tier];
      const cur = s.inventory.tools.sword;
      if (cur === undefined) return 'Get a starter sword from Nori';
      if (tier <= cur) return 'Owned';
      if ((s.stats.mineDeepest || 0) < (sw.floor || 0)) return `Reach mine floor ${sw.floor}`;
      return null;
    }
    case 'backpack': {
      const b = BACKPACKS.find(x => x.id === id);
      const size = s.inventory.bagSize || 12;
      if (size >= b.size) return 'Owned';
      return size < b.size - 12 ? 'Buy the smaller backpack first' : null;
    }
    case 'seed': {
      const it = RESOURCES[id], crop = CROPS[it.seed];
      if (it.minLevel && lvl < it.minLevel) return `Reach level ${it.minLevel}`;
      return crop.seasons.includes(seasonOf(s.world.day).season) ? null : 'Out of season';
    }
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
    case 'recipe': return { coins: CRAFT_RECIPES.find(r => r.id === id)?.learn?.shop || 0 };
    case 'tool': return { ...(TOOLS[id][(getState().inventory.tools[id] || 0) + 1]?.cost || {}) };
    case 'food': return { coins: FOOD[id].price };
    case 'backpack': return { coins: BACKPACKS.find(x => x.id === id).price };
    case 'sword': return { coins: SWORDS[Number(id)].price || 0, ...(SWORDS[Number(id)].cost || {}) };
    case 'seed': return { coins: RESOURCES[id].price * 5 };
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
  // Stackable things need a free slot in your bag (or a stack to join).
  if (['bait', 'material', 'food', 'seed'].includes(kind) && !hasRoomFor(id)) { sfx('error'); return { ok: false, message: 'Your bag is full — make room first.' }; }
  if (!spend(cost)) return { ok: false, message: 'Purchase failed.' };
  const s = getState();
  let message = '';
  switch (kind) {
    case 'sword':
      s.inventory.tools.sword = Number(id);
      message = `${SWORDS[Number(id)].name} — ${SWORDS[Number(id)].damage} damage!`;
      break;
    case 'backpack': {
      const b = BACKPACKS.find(x => x.id === id);
      s.inventory.bagSize = b.size;
      message = `${b.name}! Your bag now has ${b.size} slots.`;
      break;
    }
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
    case 'tool': {
      s.inventory.tools[id] = (s.inventory.tools[id] || 0) + 1;
      message = `${TOOLS[id][s.inventory.tools[id]].name} ready!`;
      break;
    }
    case 'food':
      addItem(id, 1);
      message = `+1 ${FOOD[id].name}`;
      break;
    case 'seed':
      addItem(id, 5);
      message = `+5 ${RESOURCES[id].name}`;
      break;
    case 'recipe':
      s.recipes = [...(s.recipes || []), id];
      message = `You learned the ${CRAFT_RECIPES.find(r => r.id === id)?.name} recipe!`;
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
