// Browser-based tests for the game simulation. They use the real modules and
// a fresh in-memory state per test (localStorage is not touched except in the
// save tests, which use and then restore it).
import { setState, createNewState, SAVE_VERSION } from '../js/state.js';
import { checkCost, spend, addCoins, itemCount } from '../js/economy.js';
import { addFish, capacity, isFull, sellFish, fishValue } from '../js/inventory.js';
import { fishAvailable, pickFish, candidates } from '../js/fish.js';
import { FISH, FISH_BY_ID } from '../data/fish-data.js';
import { validate, migrate, load, save, wipe } from '../js/save.js';
import { World } from '../js/world.js';
import { buildIslandMap, WALKABLE, WATERY } from '../js/world-gen.js';
import { purchase } from '../js/shop.js';
import { addXp, xpToNext, checkAchievements } from '../js/progression.js';
import { initQuests, questProgress, claimQuest, ensureDaily, dailyProgress, ensureOrders, fulfillOrder } from '../js/quests.js';
import { harvestGarden } from '../js/interactions.js';
import { unlockIsland, travelTo } from '../js/islands.js';
import { ISLANDS, ISLAND_ORDER } from '../data/island-data.js';
import { buildAllSprites } from '../js/art/sprites.js';
import { CloudSync } from '../js/online/cloud-sync.js';
import * as Save from '../js/save.js';

const results = [];
const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const assert = (cond, msg) => { if (!cond) throw new Error(msg || 'assertion failed'); };
const eq = (a, b, msg) => assert(a === b, `${msg || 'expected equal'}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
const fresh = () => { const s = createNewState({ name: 'Tester', look: { skin: '#e8b48f', hair: '#7a4a2c', shirt: '#5b9be0' } }); setState(s); return s; };

// ---------------------------------------------------------------- economy
test('spend never allows a negative balance', () => {
  const s = fresh();
  s.player.coins = 50;
  assert(!spend({ coins: 51 }), 'should refuse');
  eq(s.player.coins, 50, 'coins unchanged');
  assert(spend({ coins: 50 }), 'exact amount ok');
  eq(s.player.coins, 0);
});
test('multi-resource costs are atomic', () => {
  const s = fresh();
  s.player.coins = 1000; s.inventory.items.wood = 3;
  assert(!spend({ coins: 100, wood: 5 }), 'not enough wood');
  eq(s.player.coins, 1000, 'coins untouched when wood missing');
  eq(itemCount('wood'), 3);
  const c = checkCost({ coins: 100, wood: 5 });
  eq(c.missing.length, 1); eq(c.missing[0].id, 'wood');
});
test('addCoins ignores invalid amounts', () => {
  const s = fresh(); s.player.coins = 10;
  addCoins(-5); addCoins(NaN); addCoins(Infinity);
  eq(s.player.coins, 10);
});

// ---------------------------------------------------------------- inventory
test('bag capacity is enforced and sheds increase it', () => {
  const s = fresh();
  const base = capacity();
  for (let i = 0; i < base; i++) addFish('silver_sardine', 10, false);
  assert(isFull(), 'should be full');
  s.islands.sunny.placements.push({ uid: 'shed1', type: 'storage_shed', x: 5, y: 5, rot: 0 });
  eq(capacity(), base + 30);
  assert(!isFull());
});
test('selling removes fish and pays the right amount', () => {
  const s = fresh(); s.player.coins = 0;
  const a = addFish('golden_koi', 50, false), b = addFish('silver_sardine', 10, false);
  const expected = fishValue(a);
  const got = sellFish([a.uid]);
  eq(got, expected); eq(s.player.coins, expected);
  eq(s.inventory.fish.length, 1); eq(s.inventory.fish[0].uid, b.uid);
  eq(s.stats.fishSold, 1);
});
test('released species (turtle) has no sale value', () => {
  fresh();
  eq(fishValue({ id: 'ancient_sea_turtle', size: 120 }), 0);
});

// ---------------------------------------------------------------- fish rules
test('there are at least 15 distinct species with complete data', () => {
  assert(FISH.length >= 15, 'count');
  const ids = new Set(FISH.map(f => f.id));
  eq(ids.size, FISH.length, 'unique ids');
  for (const f of FISH) for (const k of ['id', 'name', 'rarity', 'price', 'zones', 'size', 'desc', 'difficulty', 'behavior', 'art']) assert(f[k] !== undefined, `${f.id} missing ${k}`);
});
test('time, weather, bait and island restrictions are respected', () => {
  const base = { zone: 'pond', island: 'sunny', phase: 'morning', weather: 'sunny', bait: 'none', level: 1 };
  assert(fishAvailable(FISH_BY_ID.golden_koi, base), 'koi in the morning');
  assert(!fishAvailable(FISH_BY_ID.golden_koi, { ...base, phase: 'night' }), 'no koi at night');
  assert(!fishAvailable(FISH_BY_ID.drizzle_darter, base), 'darter needs rain');
  assert(fishAvailable(FISH_BY_ID.drizzle_darter, { ...base, weather: 'rain' }));
  const ocean = { ...base, zone: 'ocean' };
  assert(!fishAvailable(FISH_BY_ID.sunken_crownfish, ocean), 'crownfish needs lure');
  assert(fishAvailable(FISH_BY_ID.sunken_crownfish, { ...ocean, bait: 'treasure_lure' }));
  assert(!fishAvailable(FISH_BY_ID.sunset_mahi, { ...ocean, phase: 'evening' }), 'mahi needs level 5');
  assert(fishAvailable(FISH_BY_ID.sunset_mahi, { ...ocean, phase: 'evening', level: 5 }));
  assert(!fishAvailable(FISH_BY_ID.sunny_tang, { ...base, zone: 'beach' }), 'tang only at coral');
});
test('every fish is catchable somewhere', () => {
  const zones = new Set();
  for (const id of ISLAND_ORDER) for (const s of buildIslandMap(id).spots) zones.add(s.zone);
  for (const f of FISH) assert(f.zones.some(z => zones.has(z)), `${f.id} has no reachable zone`);
});
test('pickFish only returns fish valid for the spot', () => {
  fresh();
  const c = { zone: 'reef', island: 'coral', phase: 'afternoon', weather: 'sunny', bait: 'none', rod: 'wooden_rod', level: 3 };
  for (let i = 0; i < 300; i++) { const f = pickFish(c); assert(f.zones.includes('reef'), f.id); }
  eq(candidates({ ...c, zone: 'nowhere' }).length, 0);
});
test('better rods and bait raise rare odds', () => {
  const c = { zone: 'reef', island: 'coral', phase: 'morning', weather: 'sunny', bait: 'none', rod: 'wooden_rod', level: 9 };
  const rareShare = ctx => { const l = candidates(ctx); const t = l.reduce((a, x) => a + x.w, 0); return l.filter(x => x.fish.rarity !== 'common').reduce((a, x) => a + x.w, 0) / t; };
  assert(rareShare({ ...c, rod: 'golden_rod', bait: 'shrimp_bait' }) > rareShare(c), 'luck should help');
});

// ---------------------------------------------------------------- saves
test('validate rejects malformed and future saves', () => {
  const bad = [null, {}, { version: 1 }, { version: SAVE_VERSION + 1, player: { coins: 1 }, inventory: { fish: [], items: {} }, islands: {} }, { version: 1, player: { coins: 'lots' }, inventory: { fish: [], items: {} }, islands: {} }];
  for (const b of bad) { let threw = false; try { validate(b); } catch { threw = true; } assert(threw, 'should reject ' + JSON.stringify(b)); }
});
test('migrations upgrade a v1 save', () => {
  const s = createNewState({ name: 'Old', look: {} });
  s.version = 1; delete s.inventory.storedDecor; delete s.stats.zoneCatch; delete s.settings.tapToMove; s.player.coins = -20;
  const m = migrate(JSON.parse(JSON.stringify(s)));
  eq(m.version, SAVE_VERSION); assert(m.inventory.storedDecor, 'storedDecor'); assert(m.stats.zoneCatch, 'zoneCatch');
  eq(m.settings.tapToMove, true); eq(m.player.coins, 0, 'negative coins repaired');
});
test('corrupt main save falls back to backup and is preserved', () => {
  const keep = { main: localStorage.getItem('tidetown.save'), backup: localStorage.getItem('tidetown.save.backup') };
  try {
    const good = createNewState({ name: 'Backup', look: {} });
    localStorage.setItem('tidetown.save.backup', JSON.stringify({ data: good }));
    localStorage.setItem('tidetown.save', '{not json');
    const r = load();
    eq(r.source, 'backup'); eq(r.state.player.name, 'Backup');
    assert(Object.keys(localStorage).some(k => k.startsWith('tidetown.save.corrupt.')), 'corrupt copy kept');
    localStorage.removeItem('tidetown.save.backup');
    const r2 = load();
    eq(r2.state, null); assert(r2.error, 'reports an error');
    eq(localStorage.getItem('tidetown.save'), '{not json', 'never overwrites unreadable data');
  } finally {
    for (const k of Object.keys(localStorage)) if (k.startsWith('tidetown.save.corrupt.')) localStorage.removeItem(k);
    wipe();
    if (keep.main) localStorage.setItem('tidetown.save', keep.main);
    if (keep.backup) localStorage.setItem('tidetown.save.backup', keep.backup);
  }
});
test('save → load round trip keeps progress', () => {
  const keep = localStorage.getItem('tidetown.save');
  try {
    const s = fresh(); s.player.coins = 1234; addFish('moon_jelly', 20, true); s.islands.sunny.flags.bridgeRepaired = true;
    save(s);
    const r = load();
    eq(r.state.player.coins, 1234); eq(r.state.inventory.fish[0].id, 'moon_jelly'); eq(r.state.islands.sunny.flags.bridgeRepaired, true);
  } finally { wipe(); if (keep) localStorage.setItem('tidetown.save', keep); }
});

// ---------------------------------------------------------------- world & building
test('islands have walkable spawns and spots facing water', () => {
  for (const id of ISLAND_ORDER) {
    const m = buildIslandMap(id);
    assert(WALKABLE.has(m.get(ISLANDS[id].spawn.x, ISLANDS[id].spawn.y)), `${id} spawn walkable`);
    for (const s of m.spots) {
      assert(WALKABLE.has(m.get(s.x, s.y)), `${id}/${s.id} stand tile`);
      assert(WATERY.has(m.get(s.waterX, s.waterY)), `${id}/${s.id} water target`);
    }
  }
});
test('every spot is reachable from spawn (bridge repaired)', () => {
  for (const id of ISLAND_ORDER) {
    const st = createNewState({ name: 'x', look: {} }).islands[id];
    st.flags.bridgeRepaired = true;
    const w = new World(id, st);
    const sp = ISLANDS[id].spawn;
    for (const s of w.spots) assert(w.findPath(sp.x, sp.y, s.x, s.y), `${id}/${s.id} unreachable`);
  }
});
test('broken bridge blocks the lagoon until repaired', () => {
  const s = fresh();
  const w = new World('sunny', s.islands.sunny);
  const lag = w.spots.find(x => x.id === 'lagoon');
  eq(w.findPath(22, 33, lag.x, lag.y), null, 'blocked');
  s.islands.sunny.flags.bridgeRepaired = true;
  const w2 = new World('sunny', s.islands.sunny);
  assert(w2.findPath(22, 33, lag.x, lag.y), 'open after repair');
});
test('placement rejects water, occupied tiles and blocked doors', () => {
  const s = fresh();
  const w = new World('sunny', s.islands.sunny);
  assert(!w.canPlace('lantern', 1, 1, 0).ok, 'water');
  const cot = s.islands.sunny.placements[0];
  assert(!w.canPlace('lantern', cot.x + 1, cot.y, 0).ok, 'on cottage');
  assert(!w.canPlace('lantern', cot.x + 1, cot.y + 2, 0).ok, 'cottage doorway');
  assert(w.canPlace('stone_path', cot.x + 1, cot.y + 2, 0).ok, 'walkable path may go in front of a door');
  assert(w.canPlace('lantern', 16, 29, 0).ok, 'open grass');
});

// ---------------------------------------------------------------- shop, quests, progression
test('shop refuses duplicates, locked items and unaffordable items', () => {
  const s = fresh(); s.player.coins = 10000;
  assert(!purchase('rod', 'fiberglass_rod').ok, 'level-locked');
  s.player.level = 2;
  assert(purchase('rod', 'fiberglass_rod').ok, 'buy');
  const after = s.player.coins;
  assert(!purchase('rod', 'fiberglass_rod').ok, 'duplicate');
  eq(s.player.coins, after, 'no double charge');
  s.player.coins = 1;
  const before = itemCount('worm_bait');
  assert(!purchase('bait', 'worm_bait').ok, 'too poor');
  eq(itemCount('worm_bait'), before);
});
test('quests progress automatically and pay out once', () => {
  const s = fresh();
  s.quests.index = 3;   // skip the farming intro (gift, clearing, planting) to "Welcome to Sunny Shores"
  initQuests();
  eq(questProgress().def.id, 'q_welcome');
  s.stats.talked.mira = true;
  eq(questProgress().value, 1);
  checkAchievements();
  s.quests.ready = true;
  const coins = s.player.coins;
  assert(claimQuest(), 'claim');
  assert(s.player.coins > coins, 'reward paid');
  assert(!claimQuest(), 'cannot claim again');
  eq(questProgress().def.id, 'q_first_bite');
  s.stats.fishCaught += 3;
  eq(questProgress().value, 3, 'relative counter');
});
test('daily goals reset with the date and measure relative progress', () => {
  const s = fresh();
  ensureDaily();
  eq(s.daily.goals.length, 3);
  const g = s.daily.goals[0];
  eq(dailyProgress(g), 0);
  s.daily.date = '2000-01-01';
  ensureDaily();
  assert(s.daily.date !== '2000-01-01', 'rolled over');
});
test('levelling up carries over xp and grants coins', () => {
  const s = fresh(); s.player.coins = 0;
  addXp(xpToNext(1) + 5);
  eq(s.player.level, 2); eq(s.player.xp, 5); assert(s.player.coins > 0);
});
test('islands unlock with requirements and travel switches island', () => {
  const s = fresh(); s.player.coins = 5000; s.inventory.items.wood = 50;
  assert(!unlockIsland('coral').ok, 'requirements first');
  s.player.level = 3; s.islands.sunny.flags.bridgeRepaired = true;
  assert(unlockIsland('coral').ok, 'unlock');
  eq(s.player.coins, 5000 - ISLANDS.coral.unlock.cost.coins);
  assert(travelTo('coral').ok); eq(s.player.island, 'coral'); assert(s.islands.coral.visited);
  assert(!travelTo('moon').ok, 'locked island');
});

test('fish market orders appear, deliver the right fish and pay a bonus', () => {
  const s = fresh();
  s.islands.sunny.placements.push({ uid: 'm1', type: 'fish_market', x: 5, y: 5, rot: 0 });
  ensureOrders();
  eq(s.orders.list.length, 3);
  const o = s.orders.list[0];
  for (let i = 0; i < o.qty; i++) addFish(o.fish, 10, false);
  addFish('blue_minnow', 5, false);
  const coins = s.player.coins;
  assert(fulfillOrder(o.id), 'fulfil');
  eq(s.player.coins, coins + o.reward);
  eq(s.inventory.fish.filter(f => f.id === o.fish).length, o.fish === 'blue_minnow' ? 1 : 0);
  assert(!fulfillOrder(o.id), 'cannot fulfil twice');
  eq(s.stats.ordersDone, 1);
});
test('gardens produce over time and cap their output', () => {
  const s = fresh();
  const pl = { uid: 'g1', type: 'crop_garden', x: 5, y: 5, rot: 0 };
  s.islands.sunny.placements.push(pl);
  const game = { world: { id: 'sunny' }, renderer: { emit() {} } };
  s.islands.sunny.gardens.g1 = Date.now();
  assert(!harvestGarden(game, { ...pl, fw: 3, fh: 2 }).ok, 'not grown yet');
  s.islands.sunny.gardens.g1 = Date.now() - 100 * 60 * 1000;
  assert(harvestGarden(game, { ...pl, fw: 3, fh: 2 }).ok, 'harvest');
  eq(itemCount('flower'), 6, 'capped at 3 cycles x 2');
});

// ---------------------------------------------------------------- cloud sync
// These run the real CloudSync logic against an in-memory stand-in for the
// server's save store (same revision rules as server.py).
// They do NOT talk to a real server.
class MemoryBackend {
  constructor(row = null) { this.row = row; this.offline = false; }
  async fetch() { if (this.offline) throw new TypeError('Failed to fetch'); return this.row && JSON.parse(JSON.stringify(this.row)); }
  async insert(row) { if (this.offline) throw new TypeError('Failed to fetch'); if (this.row) return null; this.row = { ...row, revision: 1, updated_at: new Date().toISOString() }; return { revision: 1 }; }
  async update(row, exp) {
    if (this.offline) throw new TypeError('Failed to fetch');
    if (!this.row || this.row.revision !== exp) return null;
    this.row = { ...row, revision: exp + 1, updated_at: new Date().toISOString() };
    return { revision: exp + 1 };
  }
  async publishSnapshot() {}
}

async function withCloud(fn) {
  const keep = {};
  for (const k of Object.keys(localStorage)) if (k.startsWith('tidetown.')) keep[k] = localStorage.getItem(k);
  for (const k of Object.keys(localStorage)) if (k.startsWith('tidetown.')) localStorage.removeItem(k);
  try { await fn(); }
  finally {
    for (const k of Object.keys(localStorage)) if (k.startsWith('tidetown.')) localStorage.removeItem(k);
    for (const [k, v] of Object.entries(keep)) localStorage.setItem(k, v);
  }
}

function makeCloud(backend, uid = 'user-a', answers = {}) {
  const asked = [];
  const auth = { signedIn: true, enabled: true, status: 'signedIn', user: { id: uid }, profile: { display_name: 'T' } };
  const cloud = new CloudSync({
    auth, makeBackend: () => backend,
    prompt: {
      chooseSave: async (l, c, why) => { asked.push('choose:' + why); return answers.choose || 'later'; },
      confirmUpload: async () => { asked.push('upload'); return answers.upload || 'upload'; },
    },
  });
  return { cloud, asked, auth };
}

const island = (name, level, fish = 0) => { const s = createNewState({ name, look: {} }); s.player.level = level; s.stats.fishCaught = fish; return s; };

test('cloud: brand-new account with no saves anywhere', () => withCloud(async () => {
  const be = new MemoryBackend();
  const { cloud } = makeCloud(be);
  const res = await cloud.reconcile();
  eq(res.state, null); eq(cloud.status, 'synced'); eq(be.row, null);
}));
test('cloud: guest progress uploads to an empty account after asking', () => withCloud(async () => {
  save(island('Guest', 4));
  const be = new MemoryBackend();
  const { cloud, asked } = makeCloud(be);
  const res = await cloud.reconcile();
  eq(asked.join(), 'upload'); eq(res.state.player.name, 'Guest');
  eq(be.row.revision, 1); eq(be.row.data.player.name, 'Guest'); eq(cloud.meta.userId, 'user-a');
}));
test('cloud: a new device downloads the cloud island', () => withCloud(async () => {
  const be = new MemoryBackend({ data: island('Cloudy', 7), revision: 3 });
  const { cloud, asked } = makeCloud(be);
  const res = await cloud.reconcile();
  eq(asked.length, 0); eq(res.state.player.name, 'Cloudy'); eq(load().state.player.name, 'Cloudy'); eq(cloud.meta.revision, 3);
}));
test('cloud: local changes push with the next revision', () => withCloud(async () => {
  const be = new MemoryBackend({ data: island('Me', 2), revision: 1 });
  const { cloud } = makeCloud(be);
  await cloud.reconcile();
  const s = load().state; s.player.level = 3; save(s); cloud.noteLocalSave();
  eq(cloud.meta.dirty, true);
  await cloud.push();
  eq(be.row.revision, 2); eq(be.row.data.player.level, 3); eq(cloud.meta.dirty, false); eq(cloud.status, 'synced');
}));
test('cloud: two devices changed → player chooses, loser is archived', () => withCloud(async () => {
  const be = new MemoryBackend({ data: island('Me', 2), revision: 1 });
  const { cloud, asked } = makeCloud(be, 'user-a', { choose: 'cloud' });
  await cloud.reconcile();
  be.row = { data: island('Me', 9, 50), revision: 2 };            // other device pushed
  const s = load().state; s.player.level = 4; save(s); cloud.noteLocalSave();   // this device changed too
  const res = await cloud.reconcile();
  eq(asked.join(), 'choose:both'); eq(res.state.player.level, 9);
  assert(Save.listArchives().some(a => a.level === 4), 'device copy archived');
}));
test('cloud: a stale push never overwrites newer cloud data', () => withCloud(async () => {
  const be = new MemoryBackend({ data: island('Me', 2), revision: 1 });
  const { cloud, asked } = makeCloud(be, 'user-a', { choose: 'later' });
  await cloud.reconcile();
  be.row = { data: island('Me', 8, 30), revision: 2 };
  const s = load().state; s.player.level = 5; save(s); cloud.noteLocalSave();
  await cloud.push();
  eq(be.row.revision, 2, 'server copy untouched'); eq(be.row.data.player.level, 8);
  assert(asked.includes('choose:both'), 'player asked');
}));
test('cloud: offline keeps the local save and marks status offline', () => withCloud(async () => {
  save(island('Local', 3));
  const be = new MemoryBackend(); be.offline = true;
  const { cloud } = makeCloud(be);
  const res = await cloud.reconcile();
  eq(res.state.player.name, 'Local'); eq(cloud.status, 'offline');
  clearTimeout(cloud.pushTimer);
}));
test('cloud: another account’s island is not mixed in, but is kept as a backup', () => withCloud(async () => {
  save(island('Alice', 6));
  localStorage.setItem('tidetown.sync', JSON.stringify({ userId: 'user-alice', revision: 4, dirty: false }));
  const be = new MemoryBackend({ data: island('Bob', 2), revision: 1 });
  const { cloud, asked } = makeCloud(be, 'user-bob');
  const res = await cloud.reconcile();
  eq(asked.length, 0); eq(res.state.player.name, 'Bob');
  assert(Save.listArchives().some(a => a.name === 'Alice'), 'Alice’s island kept as a restorable backup');
}));
test('cloud: sign-out with unsynced progress keeps an archive', () => withCloud(async () => {
  const be = new MemoryBackend({ data: island('Me', 2), revision: 1 });
  const { cloud } = makeCloud(be);
  await cloud.reconcile();
  const s = load().state; s.player.level = 6; save(s); cloud.noteLocalSave();
  be.offline = true;
  cloud.afterSignOut(false);
  eq(load().state, null);
  assert(Save.listArchives().some(a => a.level === 6), 'unsynced progress archived');
}));

// ---------------------------------------------------------------- run
buildAllSprites();
let pass = 0;
for (const t of tests) {
  try { await t.fn(); results.push({ name: t.name, ok: true }); pass++; }
  catch (err) { results.push({ name: t.name, ok: false, err: err.message }); console.error(t.name, err); }
}
const ol = document.getElementById('results');
for (const r of results) {
  const li = document.createElement('li');
  li.className = r.ok ? 'pass' : 'fail';
  li.textContent = (r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.ok ? '' : ' — ' + r.err);
  ol.append(li);
}
document.getElementById('summary').textContent = `${pass}/${tests.length} passed`;
window.testResults = { pass, total: tests.length, results };
