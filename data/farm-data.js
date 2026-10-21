// Farming, seasons and the home-yard clutter.
//
// A year has four 28-day seasons (Stardew style). Crops only grow in their
// seasons and wither when the season changes. Weather odds depend on the
// season, and winter brings snow.

export const SEASON_DAYS = 28;
export const SEASONS = ['spring', 'summer', 'fall', 'winter'];
export const SEASON_NAMES = { spring: 'Spring', summer: 'Summer', fall: 'Autumn', winter: 'Winter' };

/** Weather odds per season: [weather, chance] (the rest is sunny). */
export const SEASON_WEATHER = {
  spring: [['rain', 0.26], ['storm', 0.04]],
  summer: [['rain', 0.12], ['storm', 0.12]],
  fall: [['rain', 0.3], ['storm', 0.05]],
  winter: [['snow', 0.38], ['rain', 0.04]],
};

/** day 1 = Spring 1 of year 1. */
export function seasonOf(day) {
  const d = Math.max(1, day) - 1;
  const season = SEASONS[Math.floor(d / SEASON_DAYS) % 4];
  return { season, name: SEASON_NAMES[season], day: (d % SEASON_DAYS) + 1, year: Math.floor(d / (SEASON_DAYS * 4)) + 1 };
}

/**
 * Crops. days = watered days to grow; regrow = days until it fruits again
 * after picking (it stays planted). stages are drawn by js/art/objects.js.
 */
export const CROPS = {
  radish: { id: 'radish', name: 'Island Radish', seed: 'radish_seeds', produce: 'radish', days: 4, seasons: ['spring', 'fall'], leaf: '#5fa070', fruit: '#e0607e' },
  sunbean: { id: 'sunbean', name: 'Sunbean', seed: 'sunbean_seeds', produce: 'sunbean', days: 6, regrow: 3, seasons: ['spring', 'summer'], leaf: '#6aa45a', fruit: '#f0c14b', vine: true },
  tidemelon: { id: 'tidemelon', name: 'Tide Melon', seed: 'tidemelon_seeds', produce: 'tidemelon', days: 9, seasons: ['summer'], leaf: '#4f8f4a', fruit: '#6dbb72', big: true },
  emberpumpkin: { id: 'emberpumpkin', name: 'Ember Pumpkin', seed: 'emberpumpkin_seeds', produce: 'emberpumpkin', days: 10, seasons: ['fall'], leaf: '#5b7f3a', fruit: '#e3924a', big: true },
  frostleek: { id: 'frostleek', name: 'Frost Leek', seed: 'frostleek_seeds', produce: 'frostleek', days: 5, seasons: ['winter'], leaf: '#8fc0a8', fruit: '#e8f4ff' },
};

/** Seeds and produce, merged into RESOURCES in item-data.js. */
export const FARM_ITEMS = {
  radish_seeds: { id: 'radish_seeds', name: 'Island Radish Seeds', icon: 'seeds_radish', seed: 'radish', price: 20, desc: 'Spring & autumn. Ready in 4 days.' },
  sunbean_seeds: { id: 'sunbean_seeds', name: 'Sunbean Seeds', icon: 'seeds_sunbean', seed: 'sunbean', price: 40, desc: 'Spring & summer. Keeps giving beans every 3 days.' },
  tidemelon_seeds: { id: 'tidemelon_seeds', name: 'Tide Melon Seeds', icon: 'seeds_tidemelon', seed: 'tidemelon', price: 80, minLevel: 3, desc: 'Summer. A big, juicy melon in 9 days.' },
  emberpumpkin_seeds: { id: 'emberpumpkin_seeds', name: 'Ember Pumpkin Seeds', icon: 'seeds_emberpumpkin', seed: 'emberpumpkin', price: 90, minLevel: 3, desc: 'Autumn. A glowing pumpkin in 10 days.' },
  frostleek_seeds: { id: 'frostleek_seeds', name: 'Frost Leek Seeds', icon: 'seeds_frostleek', seed: 'frostleek', price: 50, desc: 'Winter. Hardy enough to grow in the snow.' },
  radish: { id: 'radish', name: 'Island Radish', icon: 'crop_radish', desc: 'Crunchy and peppery.' },
  sunbean: { id: 'sunbean', name: 'Sunbean', icon: 'crop_sunbean', desc: 'Golden beans that taste like summer.' },
  tidemelon: { id: 'tidemelon', name: 'Tide Melon', icon: 'crop_tidemelon', desc: 'Sweet, cool and enormous.' },
  emberpumpkin: { id: 'emberpumpkin', name: 'Ember Pumpkin', icon: 'crop_emberpumpkin', desc: 'Faintly warm to the touch.' },
  frostleek: { id: 'frostleek', name: 'Frost Leek', icon: 'crop_frostleek', desc: 'Crisp and cold, like a winter morning.' },
  fiber: { id: 'fiber', name: 'Fiber', icon: 'fiber', desc: 'Tough strands from cut weeds.' },
};

export const FARM_SELL = {
  radish_seeds: 10, sunbean_seeds: 20, tidemelon_seeds: 40, emberpumpkin_seeds: 45, frostleek_seeds: 25,
  radish: 40, sunbean: 25, tidemelon: 220, emberpumpkin: 260, frostleek: 70, fiber: 1,
};

/** Clutter covering the home yard at the start. tool = what clears it. */
export const DEBRIS = {
  tree: { label: 'Tree', tool: 'axe', verb: 'Chop', hp: 6, drops: [['wood', 5, 8, 1]] },
  twig: { label: 'Twig', tool: 'axe', verb: 'Chop', hp: 1, drops: [['wood', 1, 2, 1]] },
  stone: { label: 'Stone', tool: 'pickaxe', verb: 'Break', hp: 2, drops: [['stone', 1, 2, 1]] },
  weed: { label: 'Weeds', tool: 'scythe', verb: 'Cut', hp: 1, drops: [['fiber', 1, 1, 0.6]] },
  // tall grass you can walk through; cut it with the scythe for fiber
  grass: { label: 'Tall Grass', tool: 'scythe', verb: 'Cut', hp: 1, drops: [['fiber', 1, 1, 0.3], ['hay', 1, 1, 0.5]] },
  // what's left after a tree falls
  stump: { label: 'Stump', tool: 'axe', verb: 'Chop', hp: 3, drops: [['wood', 2, 3, 1]] },
  // need upgraded tools (1 = copper, 2 = iron)
  big_stump: { label: 'Large Stump', tool: 'axe', verb: 'Chop', hp: 10, minTier: 1, drops: [['hardwood', 2, 3, 1], ['wood', 4, 6, 1]] },
  boulder: { label: 'Boulder', tool: 'pickaxe', verb: 'Break', hp: 10, minTier: 2, drops: [['stone', 10, 15, 1], ['iron_ore', 1, 3, 0.5], ['gold_ore', 1, 2, 0.2]] },
};

/** What the TV says. */
export const TV_TIPS = [
  'Crops only grow on days they were watered. Rainy days water them for you!',
  'Each crop grows in certain seasons. Plant out of season and it won’t sprout; when the season changes, old crops wither.',
  'Go to bed before 2 AM, or you’ll pass out and drop some coins.',
  'Chop trees for wood: a Storage Chest takes 50, and it keeps your bag tidy.',
  'Nori in town hands new islanders a starter rod and sword. Go say hi!',
  'Every 5th floor of the Old Mine is a checkpoint you can start from.',
  'Furnaces turn 5 ore into a bar. Bars upgrade your tools at Nori’s.',
  'Grilled fish heals a lot in the mine. Cook one at a campfire.',
  'Your watering can holds 40 splashes. Refill it at any water.',
];
