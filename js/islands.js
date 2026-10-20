// Island unlocks and travel. Each island keeps its own state in
// state.islands[id] (placements, resource timers, flags) which persists across
// visits.
import { getState, commit } from './state.js';
import { emit } from './events.js';
import { ISLANDS, ISLAND_ORDER } from '../data/island-data.js';
import { BUILDINGS } from '../data/building-data.js';
import { checkCost, spend, describeMissing } from './economy.js';
import { hasBuilding } from './building-count.js';
import { addXp, checkAchievements } from './progression.js';
import { sfx } from './audio.js';

/** List of unmet requirements for unlocking an island (excluding cost). */
export function unlockRequirements(id) {
  const s = getState();
  const u = ISLANDS[id].unlock;
  if (!u) return [];
  const out = [];
  if (u.level && s.player.level < u.level) out.push({ text: `Reach level ${u.level}`, met: false });
  else if (u.level) out.push({ text: `Reach level ${u.level}`, met: true });
  if (u.flag) {
    const met = Object.values(s.islands).some(i => i.flags[u.flag]);
    out.push({ text: u.flagText, met });
  }
  if (u.building) out.push({ text: u.buildingText || `Build a ${BUILDINGS[u.building].name}`, met: hasBuilding(u.building) });
  return out;
}

export function canUnlock(id) {
  const reqs = unlockRequirements(id);
  if (reqs.some(r => !r.met)) return { ok: false, message: reqs.find(r => !r.met).text + ' first.' };
  const check = checkCost(ISLANDS[id].unlock.cost);
  if (!check.ok) return { ok: false, message: 'Not enough: ' + describeMissing(check.missing) + '.' };
  return { ok: true };
}

export function unlockIsland(id) {
  const s = getState();
  if (s.islands[id].unlocked) return { ok: true };
  const c = canUnlock(id);
  if (!c.ok) { sfx('error'); return c; }
  spend(ISLANDS[id].unlock.cost);
  s.islands[id].unlocked = true;
  addXp(60);
  sfx('unlock');
  emit('islandUnlocked', { id });
  commit('unlock');
  return { ok: true, message: `${ISLANDS[id].name} unlocked!` };
}

/** Change the active island. The game module performs the visual transition. */
export function travelTo(id) {
  const s = getState();
  if (!s.islands[id]?.unlocked) return { ok: false, message: 'That island is still locked.' };
  if (s.player.island === id) return { ok: false, message: 'You are already here.' };
  s.player.island = id;
  s.player.pos = { ...(ISLANDS[id].arrival || ISLANDS[id].spawn) };
  const first = !s.islands[id].visited;
  s.islands[id].visited = true;
  if (first) addXp(50);
  checkAchievements();
  emit('travel', { id, first });
  commit('travel');
  return { ok: true, first };
}

export function islandList() {
  const s = getState();
  return ISLAND_ORDER.map(id => ({ def: ISLANDS[id], state: s.islands[id], current: s.player.island === id }));
}
