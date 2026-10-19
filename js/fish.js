// Fish spawn rules: which fish can bite at a spot, weighted by rarity, rod,
// bait, time, weather and discovery state.
import { FISH, RARITY_WEIGHT, VARIANT } from '../data/fish-data.js';
import { RODS, BAIT } from '../data/item-data.js';

export const ZONE_NAMES = {
  ocean: 'Open sea & docks', beach: 'Beaches', pond: 'Ponds', lagoon: 'Hidden Lagoon',
  reef: 'Coral reefs', mangrove: 'Mangrove waters', moon: 'Moonlit Bay',
};
export const TIME_NAMES = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', night: 'Night' };
export const WEATHER_NAMES = { sunny: 'Sunny', rain: 'Rain', storm: 'Storms' };

const TIER_BOOST = { common: -1, uncommon: 1, rare: 2, epic: 3, legendary: 4 };

/** Can this fish appear in the given conditions at all? */
export function fishAvailable(f, c) {
  if (!f.zones.includes(c.zone)) return false;
  if (f.islands && !f.islands.includes(c.island)) return false;
  if (f.times && !f.times.includes(c.phase)) return false;
  if (f.weather && !f.weather.includes(c.weather)) return false;
  if (f.bait && c.bait !== f.bait) return false;
  if (f.minLevel && c.level < f.minLevel) return false;
  return true;
}

export function rodStats(rodId, c = {}) {
  const r = RODS[rodId] || RODS.wooden_rod;
  let zone = r.zone, luck = r.luck, nightWeight = 1;
  if (r.bonus) {
    if (r.bonus.zones && r.bonus.zones.includes(c.zone)) { zone += r.bonus.zone || 0; luck += r.bonus.luck || 0; }
    if (r.bonus.night && c.phase === 'night') { zone += r.bonus.zone || 0; nightWeight = r.bonus.nightWeight || 1; }
  }
  return { zone, luck, power: r.power, biteWindow: r.biteWindow, nightWeight };
}

/**
 * Weighted candidate list for the current context.
 * c = { zone, island, phase, weather, bait, rod, level, perfect, spotLuck, islandLuck, lighthouse, collection }
 */
export function candidates(c) {
  const rod = rodStats(c.rod, c);
  const bait = BAIT[c.bait] || BAIT.none;
  const luck = rod.luck + (bait.luck || 0) + (c.perfect ? 0.15 : 0) + (c.spotLuck || 0) + (c.islandLuck || 0);
  const out = [];
  for (const f of FISH) {
    if (!fishAvailable(f, c)) continue;
    let w = f.weight ?? RARITY_WEIGHT[f.rarity];
    const tier = TIER_BOOST[f.rarity];
    w *= tier < 0 ? 1 / (1 + luck) : 1 + luck * tier;
    if (f.likesBait && f.likesBait === c.bait) w *= 3;
    if (f.bait && f.bait === c.bait) w *= 6;
    if (f.times && f.times.includes('night') && c.phase === 'night') {
      w *= rod.nightWeight * (bait.nightWeight || 1);
      if (c.lighthouse && f.rarity !== 'common') w *= 1.2;
    }
    if (c.collection && !c.collection[f.id]) w *= 1.3; // nudge towards undiscovered species
    out.push({ fish: f, w });
  }
  return out;
}

export function pickFish(c, rng = Math.random) {
  const list = candidates(c);
  if (!list.length) return null;
  const total = list.reduce((s, x) => s + x.w, 0);
  let r = rng() * total;
  for (const x of list) { r -= x.w; if (r <= 0) return x.fish; }
  return list[list.length - 1].fish;
}

export function rollSize(f, perfect, rng = Math.random) {
  const [mn, mx] = f.size;
  let t = Math.pow(rng(), perfect ? 1.1 : 1.6);
  return Math.round((mn + (mx - mn) * t) * 10) / 10;
}

export function rollVariant(luck = 0, rng = Math.random) {
  return rng() < VARIANT.chance + luck * 0.02;
}

/** Human-readable list of where/when a fish appears (for the encyclopedia). */
export function habitatText(f) {
  const parts = [f.zones.map(z => ZONE_NAMES[z]).join(', ')];
  if (f.times) parts.push(f.times.map(t => TIME_NAMES[t]).join(' / '));
  if (f.weather) parts.push(f.weather.map(w => WEATHER_NAMES[w]).join(' / '));
  if (f.bait) parts.push('Needs ' + (BAIT[f.bait]?.name || f.bait));
  if (f.likesBait) parts.push('Loves ' + (BAIT[f.likesBait]?.name || f.likesBait));
  if (f.minLevel) parts.push('Level ' + f.minLevel + '+');
  return parts.join(' · ');
}
