// Items: rods, bait, resources, special items and cosmetics.
// Balance values live here so they can be tuned without touching logic.

export const RODS = {
  wooden_rod: {
    id: 'wooden_rod', name: 'Wooden Rod', price: 0, minLevel: 1, icon: 'rod',
    zone: 0.28, power: 1.0, biteWindow: 0.85, luck: 0,
    desc: 'Your trusty starter rod. Smells faintly of sunscreen.',
  },
  fiberglass_rod: {
    id: 'fiberglass_rod', name: 'Fiberglass Rod', price: 180, minLevel: 2, icon: 'rod',
    zone: 0.33, power: 1.15, biteWindow: 1.0, luck: 0.1,
    desc: 'Light and springy. Wider catch zone and faster reeling.',
  },
  coral_rod: {
    id: 'coral_rod', name: 'Coral Rod', price: 650, minLevel: 4, icon: 'rod', requiresIsland: 'coral',
    zone: 0.32, power: 1.15, biteWindow: 1.0, luck: 0.1,
    bonus: { zones: ['reef'], zone: 0.1, luck: 0.3 },
    desc: 'Carved from driftwood and reef stone. Much stronger at reef spots.',
  },
  moonlit_rod: {
    id: 'moonlit_rod', name: 'Moonlit Rod', price: 1200, minLevel: 6, icon: 'rod',
    zone: 0.34, power: 1.2, biteWindow: 1.1, luck: 0.15,
    bonus: { night: true, zone: 0.08, nightWeight: 1.8 },
    desc: 'Glows faintly after dark. Nocturnal fish find it irresistible.',
  },
  golden_rod: {
    id: 'golden_rod', name: 'Golden Rod', price: 3200, cost: { seaglass: 5 }, minLevel: 9, icon: 'rod',
    zone: 0.42, power: 1.4, biteWindow: 1.3, luck: 0.35,
    desc: 'A master angler’s rod. Everything about fishing becomes easier.',
  },
};

export const BAIT = {
  none: { id: 'none', name: 'No Bait', icon: 'rod', biteSpeed: 1, luck: 0, desc: 'Fish will bite eventually. Probably.' },
  worm_bait: {
    id: 'worm_bait', name: 'Worm Bait', icon: 'worm', packSize: 5, packPrice: 18, minLevel: 1,
    biteSpeed: 1.45, luck: 0.02,
    desc: 'Wriggly and reliable. Fish bite much sooner.',
  },
  shrimp_bait: {
    id: 'shrimp_bait', name: 'Shrimp Bait', icon: 'shrimp', packSize: 5, packPrice: 45, minLevel: 2, requiresBuilding: 'fishing_hut',
    biteSpeed: 1.25, luck: 0.22,
    desc: 'A tasty treat that attracts rarer fish. Pearl Puffers adore it.',
  },
  glow_bait: {
    id: 'glow_bait', name: 'Glow Bait', icon: 'glow', packSize: 5, packPrice: 80, minLevel: 6, requiresBuilding: 'fishing_hut',
    biteSpeed: 1.2, luck: 0.15, nightWeight: 2,
    desc: 'Shimmers in dark water. Doubles the chance of night-time fish.',
  },
  treasure_lure: {
    id: 'treasure_lure', name: 'Treasure Lure', icon: 'lure', packSize: 1, packPrice: 150, cost: { seaglass: 2 }, minLevel: 5, requiresBuilding: 'fishing_hut',
    biteSpeed: 1, luck: 0.1,
    desc: 'A glittering golden lure. The only way to tempt the Sunken Crownfish.',
  },
};

export const RESOURCES = {
  wood: { id: 'wood', name: 'Wood', icon: 'wood', desc: 'Sturdy palm wood for building.' },
  stone: { id: 'stone', name: 'Stone', icon: 'stone', desc: 'Smooth island stone.' },
  shell: { id: 'shell', name: 'Shells', icon: 'shell', desc: 'Pretty shells from the beach.' },
  seaglass: { id: 'seaglass', name: 'Sea Glass', icon: 'seaglass', desc: 'Frosted glass polished by the waves. Quite rare.' },
  flower: { id: 'flower', name: 'Flowers', icon: 'flower', desc: 'Fresh tropical blooms.' },
};

/** Sell prices for spare resources (players can always sell extras). */
export const RESOURCE_SELL = { wood: 2, stone: 3, shell: 4, seaglass: 15, flower: 3 };

export const HATS = {
  none: { id: 'none', name: 'No Hat', pearls: 0 },
  straw: { id: 'straw', name: 'Straw Hat', pearls: 0 },
  bandana: { id: 'bandana', name: 'Bandana', pearls: 0 },
  cap: { id: 'cap', name: 'Sailor Cap', pearls: 3 },
  flower: { id: 'flower', name: 'Hibiscus Pin', pearls: 3 },
  beanie: { id: 'beanie', name: 'Cozy Beanie', pearls: 5 },
  explorer: { id: 'explorer', name: 'Explorer Hat', pearls: 6 },
  captain: { id: 'captain', name: 'Captain’s Hat', pearls: 10 },
};

export const STARTING_HATS = ['none', 'straw', 'bandana'];

/** Base fish capacity; storage sheds add to it (see building-data). */
export const BASE_FISH_CAPACITY = 30;

/** Bonus for selling at a Fish Market owner. */
export const MARKET_SELL_BONUS = 0.15;
