// Main quest chain, daily goals and Fish Market customer orders.
// Progress is derived from state (stats counters, flags, collection), so it
// updates automatically whenever the relevant action happens.
import { getState, commit, uid } from './state.js';
import { emit, on, toast } from './events.js';
import { MAIN_QUESTS, DAILY_TEMPLATES, DAILY_ALL_BONUS, ORDERS } from '../data/quest-data.js';
import { FISH } from '../data/fish-data.js';
import { grantReward, speciesDiscovered } from './progression.js';
import { addCoins } from './economy.js';
import { hasBuilding, countBuilt } from './building-count.js';
import { removeFishByUid, fishValue } from './inventory.js';
import { sfx } from './audio.js';

// ------------------------------------------------------------- measurement
/** Current value of an objective. Cumulative types return raw counters. */
function measure(o) {
  const s = getState();
  switch (o.type) {
    case 'talk': return s.stats.talked[o.npc] ? 1 : 0;
    case 'catch': return s.stats.fishCaught;
    case 'sell': return s.stats.fishSold;
    case 'gather': return s.stats.gathered;
    case 'perfect_cast': return s.stats.perfectCasts;
    case 'catch_uncommon': return s.stats.uncommonCaught;
    case 'catch_rare': return s.stats.rareCaught;
    case 'catch_legendary': return s.stats.legendaryCaught;
    case 'catch_night': return s.stats.nightCatches;
    case 'zone_catch': return s.stats.zoneCatch[o.zone] || 0;
    case 'orders': return s.stats.ordersDone;
    case 'decor': return s.stats.decorPlaced;
    case 'species': return speciesDiscovered();
    case 'species_new': return s.stats.speciesNew;
    case 'own_rod': return s.inventory.rods.includes(o.rod) ? 1 : 0;
    case 'flag': return Object.values(s.islands).some(i => i.flags[o.flag]) || s.flags[o.flag] ? 1 : 0;
    case 'build': return countBuilt(o.building) > 0 ? 1 : 0;
    case 'island_unlocked': return s.islands[o.island]?.unlocked ? 1 : 0;
    case 'island_visited': return s.islands[o.island]?.visited ? 1 : 0;
    case 'level': return s.player.level;
    default: return 0;
  }
}
const ABSOLUTE = new Set(['talk', 'own_rod', 'flag', 'build', 'island_unlocked', 'island_visited', 'level', 'species']);

function progressOf(o, baseline) {
  const v = measure(o);
  return Math.min(o.count, ABSOLUTE.has(o.type) ? v : v - (baseline || 0));
}

// ------------------------------------------------------------- main quests
export function currentQuest() {
  const q = getState().quests;
  return MAIN_QUESTS[q.index] || null;
}

export function questProgress() {
  const q = getState().quests, def = currentQuest();
  if (!def) return null;
  return { def, value: progressOf(def.objective, q.baseline), goal: def.objective.count, ready: q.ready };
}

function activateQuest() {
  const q = getState().quests, def = currentQuest();
  q.ready = false;
  q.baseline = def ? measure(def.objective) : null;
}

export function claimQuest() {
  const s = getState(), q = s.quests, def = currentQuest();
  if (!def || !q.ready) return false;
  grantReward(def.reward);
  q.done.push(def.id);
  q.index += 1;
  activateQuest();
  sfx('quest');
  emit('questClaimed', def);
  checkQuests();
  commit('quest');
  return true;
}

// ------------------------------------------------------------- daily goals
function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function seededRng(str) {
  let h = 2166136261;
  for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
}

/** Roll today's goals if the local date changed. Missing days is never punished. */
export function ensureDaily() {
  const s = getState();
  const key = localDateKey();
  if (s.daily.date === key) return;
  const rng = seededRng(key + s.createdAt);
  const pool = DAILY_TEMPLATES.filter(t =>
    (!t.requiresBuilding || hasBuilding(t.requiresBuilding)) &&
    (!t.requiresUndiscovered || speciesDiscovered() < FISH.length));
  const goals = [];
  while (goals.length < 3 && pool.length) {
    const t = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    const n = t.n[Math.floor(rng() * t.n.length)];
    goals.push({ id: t.id, text: t.text.replace('{n}', n), type: t.type, count: n, baseline: measure({ type: t.type }), reward: t.reward, claimed: false });
  }
  s.daily = { date: key, goals, bonusClaimed: false };
  commit('daily', false);
}

export function dailyProgress(g) { return Math.min(g.count, measure({ type: g.type }) - g.baseline); }

export function claimDaily(i) {
  const s = getState();
  const g = s.daily.goals[i];
  if (!g || g.claimed || dailyProgress(g) < g.count) return false;
  g.claimed = true;
  grantReward(g.reward);
  sfx('coin');
  if (!s.daily.bonusClaimed && s.daily.goals.every(x => x.claimed)) {
    s.daily.bonusClaimed = true;
    grantReward(DAILY_ALL_BONUS);
    toast('All daily goals done! Bonus pearl earned.', 'pearl', 'good');
  }
  commit('daily');
  return true;
}

// ------------------------------------------------------------- customer orders
export function ensureOrders() {
  const s = getState();
  if (!hasBuilding('fish_market')) return;
  const o = s.orders;
  const now = Date.now();
  let changed = false;
  if (o.list.length < ORDERS.slots && now >= o.nextAt) {
    while (o.list.length < ORDERS.slots) o.list.push(makeOrder());
    o.nextAt = now + ORDERS.refreshMs;
    changed = true;
  }
  if (changed) commit('orders', false);
}

function makeOrder() {
  const s = getState();
  // Prefer species the player has already discovered so orders are achievable.
  const known = FISH.filter(f => s.collection[f.id] && !f.release && f.rarity !== 'legendary');
  const pool = known.length >= 2 ? known : FISH.filter(f => ['silver_sardine', 'blue_minnow', 'striped_perch'].includes(f.id));
  const fish = pool[Math.floor(Math.random() * pool.length)];
  const qty = fish.rarity === 'common' ? 2 + Math.floor(Math.random() * 3) : fish.rarity === 'uncommon' ? 1 + Math.floor(Math.random() * 2) : 1;
  const mult = ORDERS.bonusMult[0] + Math.random() * (ORDERS.bonusMult[1] - ORDERS.bonusMult[0]);
  return {
    id: uid('o'), fish: fish.id, qty,
    customer: ORDERS.customers[Math.floor(Math.random() * ORDERS.customers.length)],
    reward: Math.round(fish.price * qty * mult),
    xp: 10 + qty * 4,
  };
}

export function canFulfill(order) {
  return getState().inventory.fish.filter(f => f.id === order.fish).length >= order.qty;
}

export function fulfillOrder(orderId) {
  const s = getState();
  const order = s.orders.list.find(o => o.id === orderId);
  if (!order || !canFulfill(order)) return false;
  // Deliver the smallest fish first so players keep their trophies.
  const fish = s.inventory.fish.filter(f => f.id === order.fish).sort((a, b) => fishValue(a) - fishValue(b)).slice(0, order.qty);
  removeFishByUid(fish.map(f => f.uid));
  addCoins(order.reward, 'order');
  grantReward({ xp: order.xp });
  s.stats.ordersDone += 1;
  s.orders.list = s.orders.list.filter(o => o.id !== orderId);
  if (s.orders.nextAt < Date.now()) s.orders.nextAt = Date.now() + ORDERS.refreshMs;
  sfx('coin');
  toast(`${order.customer} paid ${order.reward} coins!`, 'coin', 'good');
  emit('orderDone', order);
  commit('order');
  return true;
}

export function skipOrder(orderId) {
  const s = getState();
  s.orders.list = s.orders.list.filter(o => o.id !== orderId);
  if (s.orders.nextAt < Date.now()) s.orders.nextAt = Date.now() + 60_000;
  commit('order');
}

// ------------------------------------------------------------- automatic checks
export function checkQuests() {
  const s = getState();
  const p = questProgress();
  if (p && !p.ready && p.value >= p.goal) {
    s.quests.ready = true;
    emit('questReady', p.def);
    sfx('quest');
    commit('questReady');
  }
}

export function initQuests() {
  const s = getState();
  if (s.quests.baseline === null && currentQuest()) activateQuest();
  ensureDaily();
  ensureOrders();
  checkQuests();
}

/** Re-check objectives whenever anything changes. */
on('change', () => { if (getState()) checkQuests(); });
