// Persistence: versioned saves in localStorage with a rolling backup,
// migrations, validation and export/import. A failed load never overwrites
// the stored data — corrupt saves are preserved under a separate key.
import { SAVE_VERSION, createIslandState, defaultSettings } from './state.js';
import { ISLAND_ORDER, ISLANDS } from '../data/island-data.js';
import { emit } from './events.js';

const KEY = 'tidetown.save';
const BACKUP_KEY = 'tidetown.save.backup';
const CORRUPT_PREFIX = 'tidetown.save.corrupt.';

/** Ordered migrations: MIGRATIONS[n] upgrades a save from version n to n+1. */
const MIGRATIONS = {
  1: s => {
    // v1 -> v2: added stored decorations and per-island garden timers
    s.inventory.storedDecor = s.inventory.storedDecor || {};
    for (const isl of Object.values(s.islands || {})) isl.gardens = isl.gardens || {};
    return s;
  },
  2: s => {
    // v2 -> v3: settings gained haptics/tapToMove; stats gained zone tracking
    s.settings = { ...defaultSettings(), ...(s.settings || {}) };
    s.stats.zoneCatch = s.stats.zoneCatch || {};
    s.stats.talked = s.stats.talked || {};
    return s;
  },
  3: s => {
    // v3 -> v4: master / footstep / ambience volumes
    s.settings = { ...defaultSettings(), ...(s.settings || {}) };
    return s;
  },
  4: s => {
    // v4 -> v5: Sunny Shores grew a home yard in the west, so everything built
    // there moves east with the rest of the island and the cottage moves into
    // the yard. Also: health, tools and the mine.
    const sunny = s.islands?.sunny;
    if (sunny) shiftSunnyLayout(sunny);
    if (s.player.island === 'sunny' && s.player.pos) s.player.pos = { ...ISLANDS.sunny.spawn };
    return s;
  },
};

/** Move a pre-v5 Sunny Shores layout onto the bigger map. */
export function shiftSunnyLayout(isl) {
  const { x: dx, y: dy } = ISLANDS.sunny.layoutShift;
  const home = ISLANDS.sunny.home.cottage;
  for (const p of isl.placements || []) {
    if (p.type === 'cottage') { p.x = home.x; p.y = home.y; p.rot = 0; }
    else { p.x += dx; p.y += dy; }
  }
  const nodes = {};
  for (const [id, t] of Object.entries(isl.nodes || {})) {
    const m = /^(.*)_(\d+)_(\d+)$/.exec(id);
    nodes[m ? `${m[1]}_${+m[2] + dx}_${+m[3] + dy}` : id] = t;
  }
  isl.nodes = nodes;
  isl.layout = 2;
}

function storageAvailable() {
  try { localStorage.setItem('__tt', '1'); localStorage.removeItem('__tt'); return true; } catch { return false; }
}
export const canPersist = storageAvailable();

export function hasSave() {
  if (!canPersist) return false;
  return !!(localStorage.getItem(KEY) || localStorage.getItem(BACKUP_KEY));
}

/** Validate structure; throws with a human-readable message when invalid. */
export function validate(s) {
  const fail = msg => { throw new Error('Invalid save: ' + msg); };
  if (!s || typeof s !== 'object') fail('not an object');
  if (typeof s.version !== 'number') fail('missing version');
  if (s.version > SAVE_VERSION) fail(`made by a newer version (${s.version})`);
  if (!s.player || typeof s.player.coins !== 'number' || !Number.isFinite(s.player.coins)) fail('bad player');
  if (!s.inventory || !Array.isArray(s.inventory.fish) || typeof s.inventory.items !== 'object') fail('bad inventory');
  if (!s.islands || typeof s.islands !== 'object') fail('bad islands');
  return true;
}

/** Bring an older save up to the current version and fill any missing pieces. */
export function migrate(s) {
  let v = s.version;
  while (v < SAVE_VERSION) {
    const fn = MIGRATIONS[v];
    if (fn) s = fn(s);
    v += 1;
    s.version = v;
  }
  // Repairs that are always safe to apply.
  s.player.coins = Math.max(0, Math.floor(s.player.coins));
  s.player.pearls = Math.max(0, Math.floor(s.player.pearls || 0));
  for (const id of ISLAND_ORDER) if (!s.islands[id]) s.islands[id] = createIslandState(id);
  s.islands.sunny.unlocked = true;
  s.settings = { ...defaultSettings(), ...(s.settings || {}) };
  s.flags = s.flags || {};
  s.achievements = s.achievements || {};
  s.milestones = s.milestones || [];
  s.orders = s.orders || { list: [], nextAt: 0 };
  s.daily = s.daily || { date: null, goals: [], bonusClaimed: false };
  // health, tools and the mine (v5)
  const p = s.player;
  p.maxHp = p.maxHp || 100;
  p.hp = Number.isFinite(p.hp) ? Math.max(1, Math.min(p.maxHp, p.hp)) : p.maxHp;
  s.inventory.tools = { pickaxe: 0, sword: 0, ...(s.inventory.tools || {}) };
  s.inventory.held = s.inventory.held || 'rod';
  for (const k of ['mineDeepest', 'monstersSlain', 'rocksBroken', 'daysSlept']) s.stats[k] = s.stats[k] || 0;
  for (const isl of Object.values(s.islands)) isl.chests = isl.chests || {};
  s.islands.sunny.layout = 2;
  return s;
}

function parse(raw) {
  const obj = JSON.parse(raw);
  const data = obj && obj.data ? obj.data : obj;
  validate(data);
  return migrate(data);
}

/**
 * Load the save. Returns { state, source, error }.
 * source: 'main' | 'backup' | null
 */
export function load() {
  if (!canPersist) return { state: null, source: null, error: 'Storage unavailable — progress will not be saved in this browser mode.' };
  const raw = localStorage.getItem(KEY);
  if (raw) {
    try { return { state: parse(raw), source: 'main', error: null }; }
    catch (err) {
      console.warn('Main save failed to load', err);
      try { localStorage.setItem(CORRUPT_PREFIX + Date.now(), raw); } catch { /* storage full */ }
      const braw = localStorage.getItem(BACKUP_KEY);
      if (braw) {
        try { return { state: parse(braw), source: 'backup', error: 'Your latest save was damaged, so we restored the backup.' }; }
        catch (err2) { console.warn('Backup save failed too', err2); }
      }
      return { state: null, source: null, error: 'Your save data could not be read. It has been kept aside safely; you can start a new game.' };
    }
  }
  const braw = localStorage.getItem(BACKUP_KEY);
  if (braw) {
    try { return { state: parse(braw), source: 'backup', error: null }; } catch { /* ignore */ }
  }
  return { state: null, source: null, error: null };
}

let lastWrite = 0;
/** Write the save; rotates the previous good save into the backup slot. */
export function save(state) {
  if (!canPersist || !state) return false;
  try {
    state.savedAt = Date.now();
    const raw = JSON.stringify({ app: 'reelhaven', data: state });
    const prev = localStorage.getItem(KEY);
    // Rotate the backup at most once a minute so it trails the main save.
    if (prev && Date.now() - lastWrite > 60_000) localStorage.setItem(BACKUP_KEY, prev);
    localStorage.setItem(KEY, raw);
    lastWrite = Date.now();
    emit('saved', { at: state.savedAt });
    return true;
  } catch (err) {
    console.error('Save failed', err);
    emit('toast', { text: 'Could not save — storage may be full.', tone: 'error' });
    return false;
  }
}

export function wipe() {
  if (!canPersist) return;
  localStorage.removeItem(KEY);
  localStorage.removeItem(BACKUP_KEY);
}

export function exportSave(state) {
  const blob = new Blob([JSON.stringify({ app: 'reelhaven', data: state }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = URL.createObjectURL(blob);
  a.download = `reelhaven-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/** Parse an imported file's text; throws with a readable message if invalid. */
export function importSave(text) {
  return parse(text);
}

/** Debounced autosave controller. */
export function createAutosaver(getState) {
  let timer = null;
  const flush = () => { clearTimeout(timer); timer = null; const s = getState(); if (s) save(s); };
  return {
    schedule(delay = 1200) { clearTimeout(timer); timer = setTimeout(flush, delay); emit('saving'); },
    flush,
  };
}

// ------------------------------------------------------------- archives
// Old islands are never thrown away by "New Game" or account switches: they
// are copied here first and can be restored from Settings → Save data.
const ARCHIVE_PREFIX = 'tidetown.archive.';

export function archiveSave(state, reason = 'manual') {
  if (!canPersist || !state) return null;
  try {
    const key = ARCHIVE_PREFIX + Date.now();
    localStorage.setItem(key, JSON.stringify({ reason, at: Date.now(), data: state }));
    return key;
  } catch (err) {
    console.warn('Could not archive save', err);
    return null;
  }
}

/** [{ key, reason, at, name, level }] newest first. */
export function listArchives() {
  if (!canPersist) return [];
  const out = [];
  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith(ARCHIVE_PREFIX)) continue;
    try {
      const a = JSON.parse(localStorage.getItem(key));
      out.push({ key, reason: a.reason, at: a.at, name: a.data?.player?.name, level: a.data?.player?.level });
    } catch { /* unreadable archive: leave it alone */ }
  }
  return out.sort((a, b) => b.at - a.at);
}

/** Make an archived island the active save (the current one is archived first). */
export function restoreArchive(key, current) {
  const raw = localStorage.getItem(key);
  if (!raw) throw new Error('That backup no longer exists.');
  const state = parse(raw);
  if (current) archiveSave(current, 'before-restore');
  save(state);
  localStorage.removeItem(key);
  return state;
}

export function deleteArchive(key) { localStorage.removeItem(key); }
