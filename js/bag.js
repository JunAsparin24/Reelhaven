// The bag: a grid of slots, 12 per row like Stardew. The first row is the
// hotbar (keys 1–9, 0, -, =). Each slot holds one "key":
//   tool:<id>      a tool (axe, pickaxe, ...)
//   rod            your fishing rod
//   <item id>      a stack of wood, seeds, food, bait...
//   fish:<id>[*]   a stack of one fish species (* = shimmering variant)
// Counts still live in inventory.items / inventory.fish; slots only decide
// where things sit. Anything that doesn't fit waits in "overflow" until you
// make room, so nothing is ever lost.
import { getState } from './state.js';
import { toast } from './events.js';
import { TOOLS, TOOL_ORDER, RESOURCES, FOOD, BAIT, RODS } from '../data/item-data.js';
import { FISH_BY_ID, VARIANT } from '../data/fish-data.js';

export const ROW = 12;
export const START_BAG = 12;
/** Backpack upgrades sold at Nori's. */
export const BACKPACKS = [
  { id: 'backpack_24', size: 24, price: 500, name: 'Large Backpack', desc: 'Adds a second row: 24 slots in total.' },
  { id: 'backpack_36', size: 36, price: 2500, name: 'Deluxe Backpack', desc: 'Adds a third row: 36 slots in total.' },
];

export const fishKey = (id, variant) => 'fish:' + id + (variant ? '*' : '');

/** Everything the player owns that needs a slot, in a sensible default order. */
export function ownedKeys(s = getState()) {
  const inv = s.inventory, keys = [];
  for (const k of TOOL_ORDER) if (inv.tools?.[k] !== undefined) keys.push('tool:' + k);
  if (inv.rods?.length) keys.push('rod');
  for (const [id, n] of Object.entries(inv.items)) if (n > 0) keys.push(id);
  const seen = new Set();
  for (const f of inv.fish) { const k = fishKey(f.id, f.variant); if (!seen.has(k)) { seen.add(k); keys.push(k); } }
  return keys;
}

/**
 * Keep the slots in step with what you own: emptied stacks free their slot,
 * new things take the first empty one. Returns the keys that didn't fit.
 */
export function syncBag(s = getState()) {
  const inv = s.inventory;
  const size = inv.bagSize || START_BAG;
  const owned = ownedKeys(s), have = new Set(owned), used = new Set();
  const slots = [];
  for (let i = 0; i < size; i++) {
    const k = inv.slots?.[i] || null;
    if (k && have.has(k) && !used.has(k)) { slots.push(k); used.add(k); } else slots.push(null);
  }
  const overflow = [];
  for (const k of owned) {
    if (used.has(k)) continue;
    const i = slots.indexOf(null);
    if (i < 0) { overflow.push(k); continue; }
    slots[i] = k; used.add(k);
  }
  inv.slots = slots;
  return overflow;
}

/** Is there a slot for this key (already slotted, or a free one)? */
export function hasRoomFor(key) {
  const s = getState();
  syncBag(s);
  return s.inventory.slots.includes(key) || s.inventory.slots.includes(null);
}

export function freeSlots() {
  const s = getState();
  syncBag(s);
  return s.inventory.slots.filter(k => !k).length;
}

export function swapSlots(a, b) {
  const slots = getState().inventory.slots;
  if (a === b || a < 0 || b < 0 || a >= slots.length || b >= slots.length) return;
  [slots[a], slots[b]] = [slots[b], slots[a]];
}

let warnedAt = 0;
/** After picking something up: tell the player if it had to go to overflow. */
export function noticeGain(key) {
  const s = getState();
  if (!s) return;
  const overflow = syncBag(s);
  if (overflow.includes(key) && Date.now() - warnedAt > 4000) {
    warnedAt = Date.now();
    toast('Your bag is full! Open your Bag to make room — extra items wait there.', 'bag', 'error');
  }
}

/** What the hotbar should hold when this slot is picked. */
export function heldFor(key) {
  if (!key) return null;
  if (key.startsWith('tool:')) return key.slice(5);
  if (key === 'rod') return 'rod';
  if (RESOURCES[key]?.seed) return 'seed:' + key;
  return key;
}

/** Display info for a slot key. */
export function slotInfo(key, s = getState()) {
  if (!key) return null;
  const inv = s.inventory;
  if (key.startsWith('tool:')) {
    const id = key.slice(5), tier = TOOLS[id][Math.min(TOOLS[id].length - 1, inv.tools[id] || 0)];
    return { key, kind: 'tool', id, icon: id, name: tier.name, desc: tier.desc, count: id === 'watering_can' ? inv.water ?? 0 : null };
  }
  if (key === 'rod') { const r = RODS[inv.equippedRod] || RODS.wooden_rod; return { key, kind: 'rod', id: r.id, icon: 'rod', name: r.name, desc: r.desc }; }
  if (key.startsWith('fish:')) {
    const variant = key.endsWith('*'), id = key.slice(5).replace('*', '');
    const f = FISH_BY_ID[id];
    const n = inv.fish.filter(e => e.id === id && !!e.variant === variant).length;
    return { key, kind: 'fish', id, variant, sprite: (variant ? 'fishvar_' : 'fish_') + id, name: (variant ? VARIANT.name + ' ' : '') + (f?.name || id), desc: f?.desc || '', count: n, rarity: f?.rarity };
  }
  const n = inv.items[key] || 0;
  if (FOOD[key]) return { key, kind: 'food', id: key, icon: FOOD[key].icon, name: FOOD[key].name, desc: FOOD[key].desc, count: n };
  if (BAIT[key]) return { key, kind: 'bait', id: key, icon: BAIT[key].icon, name: BAIT[key].name, desc: BAIT[key].desc, count: n };
  const r = RESOURCES[key];
  return { key, kind: r?.seed ? 'seed' : 'item', id: key, icon: r?.icon || 'bag', name: r?.name || key, desc: r?.desc || '', count: n };
}
