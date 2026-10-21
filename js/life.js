// Island life systems: energy, skills, friendship & gifts, mail, the
// shipping bin, the restoration board, the museum, animals and machines.
// Daily things happen in onNewDay(), called by the game each morning.
import { getState, commit, uid } from './state.js';
import { emit, toast } from './events.js';
import { addCoins, addItem, removeItem, itemCount, addPearls } from './economy.js';
import { RESOURCES, RESOURCE_SELL, FOOD, BAIT, STARTING_HATS } from '../data/item-data.js';
import { FISH_BY_ID } from '../data/fish-data.js';
import { CROPS, seasonOf } from '../data/farm-data.js';
import { NPCS } from '../data/npc-data.js';
import { fishValue, removeFishByUid } from './inventory.js';
import {
  MAX_ENERGY, ENERGY_COST, SKILLS, SKILL_XP, MAX_SKILL, HEART_POINTS, MAX_HEARTS, GIFT_POINTS, TALK_POINTS, TASTES,
  HEART_REWARDS, MAIL_SCHEDULE, BUNDLES, MUSEUM_GEMS, MUSEUM_REWARDS, ANIMALS, MACHINES, CRAFT_RECIPES,
} from '../data/life-data.js';
import { PLACEABLES } from '../data/building-data.js';
import { sfx } from './audio.js';

// ---------------------------------------------------------------- setup
/** Fill in anything an older save is missing. */
export function ensureLife(s = getState()) {
  if (!s) return;
  const p = s.player;
  p.maxEnergy = p.maxEnergy || MAX_ENERGY;
  if (!Number.isFinite(p.energy)) p.energy = p.maxEnergy;
  s.skills = s.skills || {};
  for (const k of Object.keys(SKILLS)) s.skills[k] = { xp: 0, level: 0, ...(s.skills[k] || {}) };
  s.friends = s.friends || {};
  s.mail = s.mail || [];
  s.mailSent = s.mailSent || [];
  s.shipping = s.shipping || { coins: 0, count: 0 };
  s.restoration = s.restoration || {};
  s.museum = s.museum || { donated: [], rewards: [] };
  s.festivals = s.festivals || {};
  for (const id of STARTING_HATS) if (!s.inventory.hats.includes(id)) s.inventory.hats.push(id);
  if (!Array.isArray(s.recipes)) {
    // older saves already knew every recipe their skills allowed
    s.recipes = CRAFT_RECIPES.filter(r => r.learn === 'start' || (r.learn && !r.learn.shop && !r.learn.hearts && !r.learn.quest && Object.entries(r.learn).every(([k, v]) => (s.skills[k]?.level || 0) >= v))).map(r => r.id);
  }
  for (const isl of Object.values(s.islands || {})) { isl.silo = isl.silo || 0; isl.interiors = isl.interiors || {}; }
  for (const isl of Object.values(s.islands || {})) { isl.animals = isl.animals || []; isl.feed = isl.feed || {}; isl.machines = isl.machines || {}; }
}

// ---------------------------------------------------------------- recipes
/** How a recipe is learned, in words. */
export function learnText(r) {
  const l = r.learn;
  if (!l || l === 'start') return 'Known';
  if (l.shop) return `Buy at Nori’s (${l.shop} coins)`;
  if (l.hearts) return `${NPCS[l.hearts[0]]?.name} at ${l.hearts[1]}♥`;
  if (l.quest) return 'Story quest reward';
  const [sk, lvl] = Object.entries(l)[0];
  return `${SKILLS[sk]?.name} level ${lvl}`;
}
export const knowsRecipe = id => (getState().recipes || []).includes(id);
export function learnRecipe(id, quiet = false) {
  const s = getState();
  if (knowsRecipe(id)) return false;
  s.recipes.push(id);
  if (!quiet) { const r = CRAFT_RECIPES.find(x => x.id === id); toast(`New crafting recipe: ${r?.name || id}!`, 'craft', 'gold'); }
  return true;
}
/** Learn every recipe whose skill / friendship / quest condition is now met. */
export function checkRecipes() {
  const s = getState();
  if (!s?.recipes) return;
  for (const r of CRAFT_RECIPES) {
    const l = r.learn;
    if (!l || knowsRecipe(r.id) || l.shop) continue;
    let ok = l === 'start';
    if (l.hearts) ok = hearts(l.hearts[0]) >= l.hearts[1];
    else if (l.quest) ok = (s.quests.done || []).includes(l.quest);
    else if (typeof l === 'object') ok = Object.entries(l).every(([k, v]) => (s.skills[k]?.level || 0) >= v);
    if (ok) learnRecipe(r.id);
  }
}

// ---------------------------------------------------------------- time
/** Game time as one number (minutes since day 0) for machine timers. */
export const absMinutes = (s = getState()) => s.world.day * 1440 + Math.floor(s.world.minutes);
export function minutesText(m) {
  if (m <= 0) return 'ready';
  if (m < 60) return `${m} min`;
  if (m < 1440) return `${Math.round(m / 60)} h`;
  return `${Math.round(m / 1440 * 10) / 10} days`;
}

// ---------------------------------------------------------------- energy
export function energyCost(tool) {
  const s = getState();
  const base = ENERGY_COST[tool] ?? 0;
  if (!base) return 0;
  const skill = Object.entries(SKILLS).find(([, d]) => d.tools.includes(tool))?.[0];
  const lvl = skill ? s.skills?.[skill]?.level || 0 : 0;
  // each skill level shaves a little off, down to half the base cost
  return Math.max(base / 2, Math.round(base * (1 - lvl * 0.05) * 4) / 4);
}

/** Spend energy for a tool use. Returns false (with a hint) when too tired. */
export function spendEnergy(tool) {
  const s = getState();
  const c = energyCost(tool);
  if (!c) return true;
  if (s.player.energy < c) { toast('You’re too tired. Eat something or go to bed.', 'sleep', 'error'); sfx('error'); return false; }
  s.player.energy = Math.max(0, s.player.energy - c);
  if (s.player.energy <= 15 && s.player.energy + c > 15) toast('You’re getting tired…', 'sleep');
  return true;
}

export function restoreEnergy(n) {
  const p = getState().player;
  p.energy = Math.min(p.maxEnergy, p.energy + n);
}

// ---------------------------------------------------------------- skills
export function skillLevel(id) { return getState()?.skills?.[id]?.level || 0; }

export function addSkillXp(id, n) {
  const s = getState();
  if (!s?.skills?.[id] || n <= 0) return;
  const sk = s.skills[id];
  sk.xp += n;
  while (sk.level < MAX_SKILL && sk.xp >= SKILL_XP[sk.level + 1]) {
    sk.level += 1;
    sfx('levelup');
    toast(`${SKILLS[id].name} level ${sk.level}!${sk.level === 5 || sk.level === 10 ? ' New perk unlocked.' : ''}`, SKILLS[id].icon, 'gold');
    emit('skillUp', { id, level: sk.level });
  }
  checkRecipes();
}

/** Multiplier for crop / artisan sell prices from the Farming perk. */
export function farmingBonus() { const l = skillLevel('farming'); return l >= 10 ? 1.2 : l >= 5 ? 1.1 : 1; }
export function combatBonus() { const l = skillLevel('combat'); return l >= 10 ? 1.3 : l >= 5 ? 1.15 : 1; }

// ---------------------------------------------------------------- friendship
export function friendOf(id) {
  const s = getState();
  return (s.friends[id] = s.friends[id] || { pts: 0, talked: 0, gifted: 0, rewards: [] });
}
export function hearts(id) { return Math.min(MAX_HEARTS, Math.floor((getState().friends[id]?.pts || 0) / HEART_POINTS)); }

export function addFriendship(id, pts) {
  const f = friendOf(id);
  const before = hearts(id);
  f.pts = Math.max(0, Math.min(HEART_POINTS * MAX_HEARTS, f.pts + pts));
  const after = hearts(id);
  if (after > before) {
    toast(`${NPCS[id]?.name || id} ♥ ${after}`, 'heart', 'good');
    checkRecipes();
    for (let h = before + 1; h <= after; h++) if (HEART_REWARDS[id]?.[h] && !f.rewards.includes(h)) {
      f.rewards.push(h);
      const r = HEART_REWARDS[id][h];
      sendMail({ id: `heart_${id}_${h}`, from: NPCS[id].name, subject: `${'♥'.repeat(Math.min(h, 5))} A gift for you`, body: r.note, attach: r });
    }
  }
}

/** Talking every day builds friendship a little. */
export function talkedTo(id) {
  if (!NPCS[id]) return;
  const s = getState(), f = friendOf(id);
  if (f.talked !== s.world.day) { f.talked = s.world.day; addFriendship(id, TALK_POINTS); }
}

/** How much an islander likes an item: 'love' | 'like' | 'neutral' | 'dislike'. */
export function tasteOf(npc, key) {
  const t = TASTES[npc];
  if (!t) return 'neutral';
  const isFish = key.startsWith('fish:');
  const id = isFish ? key.slice(5).replace('*', '') : key;
  for (const kind of ['love', 'like', 'dislike']) if ((t[kind] || []).some(x => x === id || (x === 'fish:*' && isFish))) return kind;
  return 'neutral';
}

/** Can this held key be given as a gift? (items and fish, not tools) */
export function giftable(key) {
  if (!key || key.startsWith('tool:') || key === 'rod' || key.startsWith('seed:')) return false;
  if (key.startsWith('fish:')) return true;
  return !!(RESOURCES[key] || FOOD[key] || BAIT[key]);
}

export function giftName(key) {
  if (key.startsWith('fish:')) return FISH_BY_ID[key.slice(5).replace('*', '')]?.name || 'fish';
  return RESOURCES[key]?.name || FOOD[key]?.name || BAIT[key]?.name || key;
}

/** Give the held item to an islander (once a day each). */
export function giveGift(npc, key) {
  const s = getState(), f = friendOf(npc);
  const name = NPCS[npc]?.name || npc;
  if (f.gifted === s.world.day) return { ok: false, message: `You already gave ${name} a gift today.` };
  if (key.startsWith('fish:')) {
    const variant = key.endsWith('*'), id = key.slice(5).replace('*', '');
    const fish = s.inventory.fish.find(e => e.id === id && !!e.variant === variant);
    if (!fish) return { ok: false, message: 'You don’t have that any more.' };
    removeFishByUid([fish.uid]);
  } else if (!removeItem(key, 1)) return { ok: false, message: 'You don’t have that any more.' };
  const taste = tasteOf(npc, key);
  const mult = s.restoration.kitchen?.done ? 2 : 1;
  f.gifted = s.world.day;
  addFriendship(npc, GIFT_POINTS[taste] * (taste === 'dislike' ? 1 : mult));
  const g = giftName(key);
  const line = { love: `“${g}? I love this! Thank you!”`, like: `“Oh, ${g}! That’s really nice of you.”`, neutral: `“${g}… thanks!”`, dislike: `“Um… ${g}. I’ll… find a use for it.”` }[taste];
  sfx(taste === 'dislike' ? 'error' : 'coin');
  commit('gift');
  return { ok: true, taste, message: `${name}: ${line}` };
}

// ---------------------------------------------------------------- mail
export function sendMail(letter) {
  const s = getState();
  if (s.mailSent.includes(letter.id)) return;
  s.mailSent.push(letter.id);
  s.mail.unshift({ ...letter, day: s.world.day, read: false, taken: false });
  emit('mail', letter);
}
export function unreadMail() { return (getState()?.mail || []).filter(m => !m.read).length; }

/** Take whatever is attached to a letter. */
export function takeAttachment(m) {
  if (m.taken) return [];
  const a = m.attach || {}, s = getState(), got = [];
  if (a.coins) { addCoins(a.coins, 'reward'); got.push(`${a.coins} coins`); }
  if (a.pearls) { addPearls(a.pearls); got.push(`${a.pearls} pearls`); }
  for (const [id, n] of Object.entries(a.items || {})) { addItem(id, n); got.push(`${n} ${RESOURCES[id]?.name || FOOD[id]?.name || BAIT[id]?.name || id}`); }
  if (a.decor) { s.inventory.storedDecor[a.decor] = (s.inventory.storedDecor[a.decor] || 0) + 1; got.push('a decoration (in Build → Stored)'); }
  if (a.rod && !s.inventory.rods.includes(a.rod)) { s.inventory.rods.push(a.rod); got.push('a new rod'); }
  if (a.sword !== undefined && (s.inventory.tools.sword ?? -1) < a.sword) { s.inventory.tools.sword = a.sword; got.push('a new sword'); }
  m.taken = true;
  commit('mail');
  return got;
}

// ---------------------------------------------------------------- shipping bin
/** Sell value of one of something (used by the bin and the Harvest Fair). */
export function itemValue(key) {
  if (key.startsWith('fish:')) {
    const variant = key.endsWith('*'), id = key.slice(5).replace('*', '');
    const f = getState().inventory.fish.find(e => e.id === id && !!e.variant === variant);
    return f ? fishValue(f) : 0;
  }
  let v = RESOURCE_SELL[key] || FOOD[key]?.sell || 0;
  const isFarm = Object.values(CROPS).some(c => c.produce === key) || ['egg', 'duck_egg', 'milk', 'goat_milk', 'mayonnaise', 'cheese', 'jam'].includes(key);
  if (isFarm) v = Math.round(v * farmingBonus());
  return v;
}

/** Put n of something in the bin; you're paid overnight. */
export function ship(key, n = 1) {
  const s = getState();
  let total = 0, moved = 0;
  if (key.startsWith('fish:')) {
    const variant = key.endsWith('*'), id = key.slice(5).replace('*', '');
    const fish = s.inventory.fish.filter(e => e.id === id && !!e.variant === variant).slice(0, n);
    for (const f of fish) total += fishValue(f);
    removeFishByUid(fish.map(f => f.uid));
    moved = fish.length;
  } else {
    n = Math.min(n, itemCount(key));
    const each = itemValue(key);
    if (!each || n <= 0) return 0;
    removeItem(key, n);
    total = each * n; moved = n;
  }
  s.shipping.coins += total;
  s.shipping.count += moved;
  sfx('gather');
  commit('ship');
  return total;
}

// ---------------------------------------------------------------- restoration board
export function bundleState(id) {
  const s = getState();
  return (s.restoration[id] = s.restoration[id] || { items: {}, fish: [], done: false });
}

/** Donate as much as possible of one item (or a fish species) to a bundle. */
export function donateToBundle(b, key) {
  const st = bundleState(b.id);
  if (st.done) return 0;
  if (key.startsWith('fish:')) {
    const id = key.slice(5).replace('*', '');
    if (!b.fish || st.fish.includes(id) || st.fish.length >= b.fish) return 0;
    const f = getState().inventory.fish.find(e => e.id === id);
    if (!f) return 0;
    removeFishByUid([f.uid]);
    st.fish.push(id);
  } else {
    const need = (b.items?.[key] || 0) - (st.items[key] || 0);
    const n = Math.min(need, itemCount(key));
    if (n <= 0) return 0;
    removeItem(key, n);
    st.items[key] = (st.items[key] || 0) + n;
  }
  sfx('gather');
  checkBundle(b);
  commit('bundle');
  return 1;
}

export function bundleProgress(b) {
  const st = bundleState(b.id);
  let need = 0, have = 0;
  for (const [id, n] of Object.entries(b.items || {})) { need += n; have += Math.min(n, st.items[id] || 0); }
  if (b.fish) { need += b.fish; have += st.fish.length; }
  return { need, have, done: st.done };
}

function checkBundle(b) {
  const st = bundleState(b.id);
  const { need, have } = bundleProgress(b);
  if (st.done || have < need) return;
  if (b.coins && getState().player.coins < b.coins) return;
  if (b.coins) getState().player.coins -= b.coins;
  st.done = true;
  const s = getState();
  if (b.flag) { s.flags[b.flag] = true; emit('restored', { id: b.id, flag: b.flag }); }
  const g = b.give || {};
  if (g.coins) addCoins(g.coins, 'reward');
  if (g.pearls) addPearls(g.pearls);
  for (const [id, n] of Object.entries(g.decor || {})) s.inventory.storedDecor[id] = (s.inventory.storedDecor[id] || 0) + n;
  if (b.id === 'forge') s.inventory.tools.pickaxe = Math.min(3, (s.inventory.tools.pickaxe || 0) + 1);
  sfx('unlock');
  toast(`${b.name} complete! ${b.reward}`, 'trophy', 'gold');
}

/** Pay the coin part of a bundle (the pier needs a donation too). */
export function payBundleCoins(b) { checkBundle(b); commit('bundle'); return bundleState(b.id).done; }

// ---------------------------------------------------------------- museum
export const museumKey = key => (key.startsWith('fish:') ? key.slice(5).replace('*', '') : key);
export function canDonate(key) {
  const m = getState().museum, k = museumKey(key);
  if (m.donated.includes(k)) return false;
  return key.startsWith('fish:') || MUSEUM_GEMS.includes(key);
}
export function donateToMuseum(key) {
  const s = getState();
  if (!canDonate(key)) return { ok: false, message: 'The museum already has one of those.' };
  if (key.startsWith('fish:')) {
    const id = museumKey(key);
    const f = s.inventory.fish.find(e => e.id === id);
    if (!f) return { ok: false };
    removeFishByUid([f.uid]);
  } else if (!removeItem(key, 1)) return { ok: false };
  s.museum.donated.push(museumKey(key));
  const n = s.museum.donated.length;
  for (const r of MUSEUM_REWARDS) if (n >= r.at && !s.museum.rewards.includes(r.at)) {
    s.museum.rewards.push(r.at);
    sendMail({ id: 'museum_' + r.at, from: 'Pip', subject: `Museum milestone: ${r.at} donations!`, body: r.note, attach: r });
  }
  sfx('quest');
  commit('museum');
  return { ok: true, message: 'Donated! It’s on display now.' };
}

// ---------------------------------------------------------------- animals
export function animalsIn(isl, homeUid) { return (isl.animals || []).filter(a => a.home === homeUid); }

/** How many animals a coop / barn holds. */
export function capacityOf(isl, homeUid) {
  const pl = isl.placements.find(p => p.uid === homeUid);
  return PLACEABLES[pl?.type]?.capacity || 4;
}

export function buyAnimal(isl, home, kind, name) {
  const def = ANIMALS[kind];
  const s = getState();
  if (s.player.coins < def.price) return { ok: false, message: 'Not enough coins.' };
  if (animalsIn(isl, home.uid).length >= capacityOf(isl, home.uid)) return { ok: false, message: 'This building is full.' };
  s.player.coins -= def.price;
  isl.animals.push({ id: uid('a'), kind, name: name || def.name, home: home.uid, hearts: 0, fedDay: 0, pettedDay: 0, lastProduced: s.world.day, ready: null });
  sfx('buy');
  commit('animal');
  return { ok: true, message: `Welcome home, ${name || def.name}!` };
}

export function petAnimal(a) {
  const s = getState();
  if (a.ready) {
    addItem(a.ready, 1);
    const got = RESOURCES[a.ready]?.name || a.ready;
    a.ready = null;
    addSkillXp('farming', 5);
    commit('collect');
    return `Collected ${got}!`;
  }
  if (a.pettedDay === s.world.day) return `${a.name} is happy.`;
  a.pettedDay = s.world.day;
  a.hearts = Math.min(5, a.hearts + 0.2);
  sfx('coin');
  commit('pet');
  return `You pet ${a.name}. ♥`;
}

/** Put all your hay (or, with none, enough from the silo for today) into a building's trough. */
export function fillTrough(isl, homeUid) {
  let n = itemCount('hay');
  if (n) removeItem('hay', n);
  else {
    n = Math.min(isl.silo || 0, Math.max(0, animalsIn(isl, homeUid).length - (isl.feed[homeUid] || 0)));
    isl.silo -= n;
  }
  if (!n) return 0;
  isl.feed[homeUid] = (isl.feed[homeUid] || 0) + n;
  commit('feed');
  return n;
}

// ---------------------------------------------------------------- silo
/** Hay the silos on this island can hold (finished silos only). */
export function siloCapacity(isl) {
  return isl.placements.filter(p => p.type === 'silo' && !underConstruction(p)).length * (PLACEABLES.silo.hay || 240);
}
/** Cut grass: hay goes to the silo if there's room. Returns how many went in. */
export function storeHay(isl, n) {
  const room = Math.max(0, siloCapacity(isl) - (isl.silo || 0));
  const put = Math.min(room, n);
  isl.silo = (isl.silo || 0) + put;
  return put;
}

// ---------------------------------------------------------------- construction
/** Rowan is still building this (or the placement is being upgraded). */
export const underConstruction = (p, s = getState()) => !!(p?.buildDay && p.buildDay > s.world.day);
/**
 * Each morning: finished buildings open, upgrades are applied. Returns
 * a list of messages for the morning toasts.
 */
export function finishConstruction(day) {
  const s = getState(), done = [];
  for (const isl of Object.values(s.islands)) for (const p of isl.placements || []) {
    if (p.buildDay && p.buildDay <= day) {
      delete p.buildDay;
      done.push(`Rowan finished your ${PLACEABLES[p.type]?.name || p.type}!`);
      if (p.type === 'stable') s.flags.horse = true;
    }
    if (p.upgrade && p.upgrade.day <= day) {
      const to = p.upgrade.to;
      delete p.upgrade;
      if (to === 'kitchen') { s.flags.kitchen = true; done.push('Your cottage kitchen is ready — cook something tasty!'); }
      else { const old = PLACEABLES[p.type]?.name; p.type = to; done.push(`Your ${old} is now a ${PLACEABLES[to]?.name}!`); }
    }
  }
  return done;
}

// ---------------------------------------------------------------- machines
export function machineAccepts(type, key) {
  const m = MACHINES[type];
  if (!m) return null;
  if (m.inputs[key]) return m.inputs[key];
  if (m.inputs['*crop'] && Object.values(CROPS).some(c => c.produce === key)) return m.inputs['*crop'];
  return null;
}

/** When a machine's job is done (older saves used readyDay). */
export const readyAt = st => st.readyAt ?? (st.readyDay * 1440 + 360);
export const machineReady = st => !!st && absMinutes() >= readyAt(st);

/** Load (held item) / collect from a machine placement. */
export function useMachine(isl, pl, heldKey) {
  const s = getState();
  const st = isl.machines[pl.uid];
  const m = MACHINES[pl.type];
  if (st && machineReady(st)) {
    addItem(st.output, st.n || 1);
    delete isl.machines[pl.uid];
    addSkillXp(pl.type === 'charcoal_kiln' ? 'foraging' : 'farming', 4);
    sfx('coin');
    commit('machine');
    return { ok: true, message: `Collected ${RESOURCES[st.output]?.name || st.output}!` };
  }
  if (st) return { ok: false, message: `Working on it… ready in ${minutesText(readyAt(st) - absMinutes())}.` };
  const keys = heldKey && itemCount(heldKey) ? [heldKey] : Object.keys(s.inventory.items).filter(k => s.inventory.items[k] > 0);
  for (const k of keys) {
    const out = machineAccepts(pl.type, k);
    if (!out) continue;
    const need = m.need?.[k] || 1;
    if (itemCount(k) < need) continue;
    removeItem(k, need);
    isl.machines[pl.uid] = { input: k, n: 1, output: out, readyAt: absMinutes() + (m.time || 600) };
    sfx('smelt');
    commit('machine');
    return { ok: true, message: `Loaded ${need > 1 ? need + ' ' : ''}${RESOURCES[k]?.name || k}. Ready in ${minutesText(m.time || 600)}.` };
  }
  return { ok: false, message: `The ${m.name} needs ${m.ask}.` };
}

// ---------------------------------------------------------------- each morning
/**
 * Overnight: the bin pays out, animals that ate yesterday produce, machines
 * finish, letters arrive. Returns a summary for the morning toast.
 */
export function onNewDay(day) {
  const s = getState();
  ensureLife(s);
  const out = {};
  if (s.shipping.coins > 0) {
    out.shipped = s.shipping.coins;
    addCoins(s.shipping.coins, 'sale');
    s.stats.coinsFromSales += s.shipping.coins;
    s.shipping = { coins: 0, count: 0 };
  }
  for (const isl of Object.values(s.islands)) {
    for (const a of isl.animals || []) {
      const def = ANIMALS[a.kind];
      // a fair day outside means they grazed; otherwise they eat hay from the trough (big buildings use the silo)
      const grazed = s.world.yesterday && !['rain', 'storm', 'snow'].includes(s.world.yesterday) && seasonOf(Math.max(1, day - 1)).season !== 'winter';
      if (grazed) a.fedDay = day;
      else if ((isl.feed[a.home] || 0) > 0) { isl.feed[a.home] -= 1; a.fedDay = day; }
      else if (PLACEABLES[isl.placements.find(p => p.uid === a.home)?.type]?.autoFeed && (isl.silo || 0) > 0) { isl.silo -= 1; a.fedDay = day; }
      if (a.fedDay === day && !a.ready && day - a.lastProduced >= def.every) { a.ready = def.product; a.lastProduced = day; out.products = (out.products || 0) + 1; }
      if (a.pettedDay < day - 1) a.hearts = Math.max(0, a.hearts - 0.1);
    }
  }
  for (const m of MAIL_SCHEDULE) if (day >= m.day) sendMail(m);
  return out;
}
