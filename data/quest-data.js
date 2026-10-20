// Quests, daily goals, achievements, level rewards and collection milestones.
//
// Objectives are { type, ...params, count }. Each type is measured by
// js/quests.js. Cumulative counters (catch, sell, gather...) are measured
// relative to the moment the quest became active.

export const MAIN_QUESTS = [
  {
    id: 'q_gift', title: 'A Welcome Gift', giver: 'mira',
    desc: 'Mira left a gift box in your cottage. Open it!',
    objective: { type: 'flag', flag: 'giftOpened', count: 1 },
    reward: { coins: 15, xp: 5 },
  },
  {
    id: 'q_clear', title: 'Clearing the Yard', giver: 'rowan',
    desc: 'Your yard is overgrown! Use your axe, pickaxe and scythe to clear 10 trees, stones or weeds.',
    objective: { type: 'clear', count: 10 },
    reward: { coins: 30, xp: 20 },
  },
  {
    id: 'q_plant', title: 'Green Thumb', giver: 'pip',
    desc: 'Till soil in your yard with the hoe, plant 15 seeds and water them with your watering can.',
    objective: { type: 'plant', count: 15 },
    reward: { coins: 40, xp: 25, items: { radish_seeds: 5 } },
  },
  {
    id: 'q_welcome', title: 'Welcome to Sunny Shores', giver: 'nori',
    desc: 'Walk east into town and visit Nori’s shop. She has a starter rod and sword for you!',
    objective: { type: 'talk', npc: 'nori', count: 1 },
    reward: { coins: 20, xp: 10 },
  },
  {
    id: 'q_first_bite', title: 'First Bite', giver: 'mira',
    desc: 'Cast from the dock or the beach and catch 3 fish.',
    objective: { type: 'catch', count: 3 },
    reward: { coins: 40, xp: 20, items: { worm_bait: 5 } },
  },
  {
    id: 'q_market_day', title: 'Market Day', giver: 'nori',
    desc: 'Sell 3 fish. Open your Bag and tap Sell — Nori buys anything that swims.',
    objective: { type: 'sell', count: 3 },
    reward: { coins: 30, xp: 15 },
  },
  {
    id: 'q_gather', title: 'Helping Hands', giver: 'rowan',
    desc: 'Gather 6 wood or stone from palm trees, driftwood and rocks around the island.',
    objective: { type: 'gather', count: 6 },
    reward: { coins: 40, xp: 20, items: { stone: 2 } },
  },
  {
    id: 'q_better_gear', title: 'Better Gear', giver: 'nori',
    desc: 'Reach level 2 and buy the Fiberglass Rod from Nori’s shop.',
    objective: { type: 'own_rod', rod: 'fiberglass_rod', count: 1 },
    reward: { xp: 40, items: { stone: 4, worm_bait: 5 } },
  },
  {
    id: 'q_bridge', title: 'Mind the Gap', giver: 'rowan',
    desc: 'Help Rowan repair the old bridge to the north-east grove.',
    objective: { type: 'flag', flag: 'bridgeRepaired', count: 1 },
    reward: { coins: 60, xp: 50 },
  },
  {
    id: 'q_hut', title: 'Hut Sweet Hut', giver: 'mira',
    desc: 'Open Build mode and construct a Fishing Hut anywhere on your island.',
    objective: { type: 'build', building: 'fishing_hut', count: 1 },
    reward: { xp: 60, items: { shrimp_bait: 5 } },
  },
  {
    id: 'q_rare', title: 'Something Rare', giver: 'pip',
    desc: 'Catch a fish of Rare quality or better. Try the pond at dawn, or the hidden lagoon.',
    objective: { type: 'catch_rare', count: 1 },
    reward: { coins: 150, xp: 60 },
  },
  {
    id: 'q_collector', title: 'Budding Collector', giver: 'pip',
    desc: 'Discover 7 different species for your encyclopedia.',
    objective: { type: 'species', count: 7 },
    reward: { xp: 60, items: { seaglass: 3 } },
  },
  {
    id: 'q_set_sail', title: 'Set Sail', giver: 'mira',
    desc: 'Fix up Mira’s boat at the dock (or from the Map) to unlock Pearlreef Atoll.',
    objective: { type: 'island_unlocked', island: 'coral', count: 1 },
    reward: { coins: 100, xp: 80 },
  },
  {
    id: 'q_reef', title: 'Reef Explorer', giver: 'pip',
    desc: 'Catch 4 fish at the reef spots of Pearlreef Atoll.',
    objective: { type: 'zone_catch', zone: 'reef', count: 4 },
    reward: { xp: 80, coins: 80, items: { shell: 6 } },
  },
  {
    id: 'q_market', title: 'Open for Business', giver: 'nori',
    desc: 'Build a Fish Market. Customers will start posting orders.',
    objective: { type: 'build', building: 'fish_market', count: 1 },
    reward: { xp: 90, coins: 120 },
  },
  {
    id: 'q_orders', title: 'Happy Customers', giver: 'nori',
    desc: 'Complete 3 customer orders at the Fish Market.',
    objective: { type: 'orders', count: 3 },
    reward: { xp: 100, pearls: 3 },
  },
  {
    id: 'q_mist', title: 'Into the Mist', giver: 'pip',
    desc: 'Chart a course to Misty Mangrove from the Map.',
    objective: { type: 'island_unlocked', island: 'mangrove', count: 1 },
    reward: { xp: 120, coins: 150 },
  },
  {
    id: 'q_decorate', title: 'Home Sweet Island', giver: 'rowan',
    desc: 'Place 8 decorations to make your islands your own.',
    objective: { type: 'decor', count: 8 },
    reward: { xp: 100, pearls: 2 },
  },
  {
    id: 'q_lighthouse', title: 'Guiding Light', giver: 'rowan',
    desc: 'Build the Lighthouse so boats can find Moonlit Bay at night.',
    objective: { type: 'build', building: 'lighthouse', count: 1 },
    reward: { xp: 150, coins: 250 },
  },
  {
    id: 'q_moonrise', title: 'Moonrise', giver: 'mira',
    desc: 'Sail to Moonlit Bay.',
    objective: { type: 'island_visited', island: 'moon', count: 1 },
    reward: { xp: 150, pearls: 3 },
  },
  {
    id: 'q_legend', title: 'Legend of the Bay', giver: 'mira',
    desc: 'Catch a Legendary fish. Only the most patient anglers ever do.',
    objective: { type: 'catch_legendary', count: 1 },
    reward: { xp: 300, coins: 1000, pearls: 10 },
  },
];

// Daily goal templates. Three are picked each local day using a date seed.
export const DAILY_TEMPLATES = [
  { id: 'd_catch', text: 'Catch {n} fish', type: 'catch', n: [4, 6, 8], reward: { coins: 60 } },
  { id: 'd_sell', text: 'Sell {n} fish', type: 'sell', n: [4, 6], reward: { coins: 50 } },
  { id: 'd_gather', text: 'Gather {n} resources', type: 'gather', n: [5, 8], reward: { coins: 40, items: { worm_bait: 3 } } },
  { id: 'd_perfect', text: 'Make {n} perfect casts', type: 'perfect_cast', n: [3, 5], reward: { coins: 50 } },
  { id: 'd_uncommon', text: 'Catch {n} Uncommon-or-better fish', type: 'catch_uncommon', n: [2, 3], reward: { coins: 70 } },
  { id: 'd_night', text: 'Catch {n} fish after dark', type: 'catch_night', n: [2, 3], reward: { coins: 60, items: { worm_bait: 3 } } },
  { id: 'd_order', text: 'Complete {n} customer order', type: 'orders', n: [1], reward: { coins: 80 }, requiresBuilding: 'fish_market' },
  { id: 'd_species', text: 'Discover {n} new species', type: 'species_new', n: [1], reward: { coins: 90 }, requiresUndiscovered: true },
];
export const DAILY_ALL_BONUS = { pearls: 1, coins: 50 };

export const ACHIEVEMENTS = [
  { id: 'first_catch', name: 'First Catch', desc: 'Catch your very first fish.', stat: 'fishCaught', goal: 1, reward: { pearls: 1 } },
  { id: 'angler', name: 'Weekend Angler', desc: 'Catch 50 fish.', stat: 'fishCaught', goal: 50, reward: { pearls: 2 } },
  { id: 'master_angler', name: 'Master Angler', desc: 'Catch 250 fish.', stat: 'fishCaught', goal: 250, reward: { pearls: 5 } },
  { id: 'fish_collector', name: 'Fish Collector', desc: 'Discover 15 species.', stat: 'species', goal: 15, reward: { pearls: 4 } },
  { id: 'island_builder', name: 'Island Builder', desc: 'Construct 4 buildings.', stat: 'buildingsBuilt', goal: 4, reward: { pearls: 3 } },
  { id: 'decorator', name: 'Interior… Exterior Decorator', desc: 'Place 25 decorations.', stat: 'decorPlaced', goal: 25, reward: { pearls: 3 } },
  { id: 'deep_sea_explorer', name: 'Deep Sea Explorer', desc: 'Visit every island.', stat: 'islandsVisited', goal: 4, reward: { pearls: 5 } },
  { id: 'legendary_discovery', name: 'Legendary Discovery', desc: 'Catch a Legendary fish.', stat: 'legendaryCaught', goal: 1, reward: { pearls: 5 } },
  { id: 'perfect_caster', name: 'Perfect Caster', desc: 'Make 25 perfect casts.', stat: 'perfectCasts', goal: 25, reward: { pearls: 2 } },
  { id: 'merchant', name: 'Island Merchant', desc: 'Earn 5,000 coins from sales.', stat: 'coinsFromSales', goal: 5000, reward: { pearls: 3 } },
  { id: 'night_owl', name: 'Night Owl', desc: 'Catch 15 fish at night.', stat: 'nightCatches', goal: 15, reward: { pearls: 2 } },
  { id: 'treasure_hunter', name: 'Treasure Hunter', desc: 'Find 5 treasures while reeling.', stat: 'treasures', goal: 5, reward: { pearls: 3 } },
];

// What each level unlocks (shown in the level-up popup and used by the shop).
export const LEVEL_UNLOCKS = {
  2: ['Fiberglass Rod', 'Fishing Hut', 'Shrimp Bait'],
  3: ['Crop Garden', 'Fish Market', 'Small Pond & Hammock'],
  4: ['Storage Shed', 'Coral Rod', 'Topiary'],
  5: ['Sunset Mahi-Mahi appears', 'Treasure Lure'],
  6: ['Lighthouse', 'Moonlit Rod', 'Glow Bait'],
  8: ['The Moonfin stirs…'],
  9: ['Golden Rod'],
};

export const XP_CURVE = { base: 50, exp: 1.55 };

export const COLLECTION_MILESTONES = [
  { pct: 25, reward: { coins: 150, pearls: 1 } },
  { pct: 50, reward: { coins: 400, pearls: 2 } },
  { pct: 75, reward: { coins: 800, pearls: 4 } },
  { pct: 100, reward: { coins: 2000, pearls: 10 } },
];

// Customer order generation (Fish Market).
export const ORDERS = {
  slots: 3,
  refreshMs: 6 * 60 * 1000,
  bonusMult: [1.6, 2.2],
  customers: ['Captain Bo', 'Auntie Lu', 'Chef Tamsin', 'Little Kai', 'Old Harlan', 'Sunny Café', 'The Lighthouse Keeper'],
};
