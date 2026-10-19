// Shared helper (kept separate to avoid circular imports between inventory,
// building and quests): how many of a placeable exist across all islands.
import { getState } from './state.js';

export function countBuilt(type) {
  const s = getState();
  if (!s) return 0;
  let n = 0;
  for (const isl of Object.values(s.islands)) for (const p of isl.placements) if (p.type === type) n++;
  return n;
}

export function hasBuilding(type) { return countBuilt(type) > 0; }
