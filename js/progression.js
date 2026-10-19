// Experience, levels, achievements and encyclopedia milestones.
import { getState, commit } from './state.js';
import { emit } from './events.js';
import { grantItems } from './economy.js';
import { ACHIEVEMENTS, XP_CURVE, COLLECTION_MILESTONES, LEVEL_UNLOCKS } from '../data/quest-data.js';
import { FISH } from '../data/fish-data.js';

export const MAX_LEVEL = 30;

/** XP required to advance from `level` to `level + 1`. */
export function xpToNext(level) {
  return Math.round(XP_CURVE.base * Math.pow(level, XP_CURVE.exp));
}

export function addXp(n) {
  if (!n || n <= 0) return;
  const p = getState().player;
  p.xp += Math.round(n);
  let leveled = false;
  while (p.level < MAX_LEVEL && p.xp >= xpToNext(p.level)) {
    p.xp -= xpToNext(p.level);
    p.level += 1;
    leveled = true;
    const bonus = 20 * p.level;
    p.coins += bonus;
    emit('levelUp', { level: p.level, coins: bonus, unlocks: LEVEL_UNLOCKS[p.level] || [] });
  }
  if (p.level >= MAX_LEVEL) p.xp = Math.min(p.xp, xpToNext(p.level));
  if (leveled) checkAchievements();
}

/** Grant a full reward bundle (coins, pearls, items, xp). */
export function grantReward(reward = {}) {
  grantItems(reward);
  if (reward.xp) addXp(reward.xp);
}

export function speciesDiscovered() {
  return Object.keys(getState().collection).length;
}

export function collectionPct() {
  return Math.floor((speciesDiscovered() / FISH.length) * 100);
}

function statValue(stat) {
  const s = getState();
  if (stat === 'species') return speciesDiscovered();
  if (stat === 'islandsVisited') return Object.values(s.islands).filter(i => i.visited).length;
  return s.stats[stat] || 0;
}

export function achievementProgress(a) {
  return Math.min(a.goal, statValue(a.stat));
}

export function checkAchievements() {
  const s = getState();
  let any = false;
  for (const a of ACHIEVEMENTS) {
    if (s.achievements[a.id]) continue;
    if (statValue(a.stat) >= a.goal) {
      s.achievements[a.id] = Date.now();
      grantReward(a.reward);
      emit('achievement', a);
      any = true;
    }
  }
  for (const m of COLLECTION_MILESTONES) {
    if (s.milestones.includes(m.pct)) continue;
    if (collectionPct() >= m.pct) {
      s.milestones.push(m.pct);
      grantReward(m.reward);
      emit('milestone', m);
      any = true;
    }
  }
  if (any) commit('achievement');
}
