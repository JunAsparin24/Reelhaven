// Items: rods, bait, resources, special items and cosmetics.
// Balance values live here so they can be tuned without touching logic.
import { FARM_ITEMS, FARM_SELL } from './farm-data.js';
import { SWORDS } from './weapon-data.js';
import { LIFE_ITEMS, LIFE_SELL } from './life-data.js';

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
  // from the Old Mine
  copper_ore: { id: 'copper_ore', name: 'Copper Ore', icon: 'ore_copper', desc: 'Smelt 5 in a furnace for a copper bar.' },
  iron_ore: { id: 'iron_ore', name: 'Iron Ore', icon: 'ore_iron', desc: 'Found from floor 5 of the mine down.' },
  gold_ore: { id: 'gold_ore', name: 'Gold Ore', icon: 'ore_gold', desc: 'Glints deep in the mine, from floor 10.' },
  copper_bar: { id: 'copper_bar', name: 'Copper Bar', icon: 'bar_copper', desc: 'Used for copper tools and fancy builds.' },
  iron_bar: { id: 'iron_bar', name: 'Iron Bar', icon: 'bar_iron', desc: 'Strong metal for iron tools.' },
  gold_bar: { id: 'gold_bar', name: 'Gold Bar', icon: 'bar_gold', desc: 'The finest metal on the islands.' },
  quartz: { id: 'quartz', name: 'Quartz', icon: 'quartz', desc: 'A clear crystal. Sells well.' },
  amethyst: { id: 'amethyst', name: 'Amethyst', icon: 'amethyst', desc: 'A rare purple gem from the deep mine.' },
  slime: { id: 'slime', name: 'Slime', icon: 'slime', desc: 'Squishy. Left behind by mine slimes.' },
  bat_wing: { id: 'bat_wing', name: 'Bat Wing', icon: 'wing', desc: 'Dropped by cave bats.' },
  // farming: seeds, produce and fiber (data/farm-data.js)
  ...FARM_ITEMS,
  // animal products, artisan goods, hay, hardwood (data/life-data.js)
  ...LIFE_ITEMS,
};

/** Things you can eat from the hotbar to heal. heal = HP restored. */
export const FOOD = {
  seaweed_snack: { id: 'seaweed_snack', name: 'Seaweed Snack', icon: 'snack', heal: 20, energy: 15, price: 15, desc: 'Salty and crunchy. +20 HP, +15 energy.' },
  island_salad: { id: 'island_salad', name: 'Island Salad', icon: 'salad', heal: 40, energy: 35, price: 40, desc: 'Fresh greens and fruit. +40 HP, +35 energy.' },
  grilled_fish: { id: 'grilled_fish', name: 'Grilled Fish', icon: 'grilled', heal: 60, energy: 45, sell: 25, desc: 'Cooked at a furnace or campfire. +60 HP, +45 energy.' },
  fish_stew: { id: 'fish_stew', name: 'Fish Stew', icon: 'grilled', heal: 60, energy: 70, sell: 120, desc: 'Cooked in your kitchen. +60 HP, +70 energy.' },
  omelet: { id: 'omelet', name: 'Omelet', icon: 'snack', heal: 40, energy: 60, sell: 125, desc: 'Fluffy and filling. +40 HP, +60 energy.' },
  melon_smoothie: { id: 'melon_smoothie', name: 'Melon Smoothie', icon: 'salad', heal: 30, energy: 90, sell: 300, desc: 'Cold and sweet. +90 energy.' },
  pumpkin_soup: { id: 'pumpkin_soup', name: 'Pumpkin Soup', icon: 'salad', heal: 90, energy: 110, sell: 350, desc: 'Warms you to your toes. +90 HP, +110 energy.' },
  leek_soup: { id: 'leek_soup', name: 'Frost Leek Soup', icon: 'salad', heal: 70, energy: 80, sell: 200, desc: 'Perfect for snowy days. +70 HP, +80 energy.' },
  field_snack: { id: 'field_snack', name: 'Field Snack', icon: 'snack', heal: 10, energy: 30, sell: 20, desc: 'Crafted from a radish and fiber. +30 energy.' },
};

export const MAX_HP = 100;

/**
 * Tool tiers. Index 0 is the starting version; upgrade at Nori's. A tool is
 * owned once inventory.tools has its key (the sword is found in the mine).
 */
export const TOOL_ORDER = ['axe', 'pickaxe', 'scythe', 'hoe', 'watering_can', 'sword'];
export const WATER_CAPACITY = 40;
export const TOOLS = {
  axe: [
    { name: 'Old Axe', power: 1, desc: 'Chops trees and twigs.' },
    { name: 'Copper Axe', power: 2, cost: { coins: 300, copper_bar: 4 }, minLevel: 2, desc: 'Fells trees twice as fast.' },
    { name: 'Iron Axe', power: 3, cost: { coins: 900, iron_bar: 4 }, minLevel: 4, desc: 'Big trees in a few swings.' },
    { name: 'Golden Axe', power: 5, cost: { coins: 2200, gold_bar: 4 }, minLevel: 6, desc: 'Timber!' },
  ],
  scythe: [{ name: 'Scythe', power: 1, desc: 'Cuts weeds in a wide sweep.' }],
  hoe: [{ name: 'Hoe', power: 1, desc: 'Tills grass or sand in your yard so you can plant seeds.' }],
  watering_can: [
    { name: 'Watering Can', power: 1, capacity: 40, area: 1, desc: 'Waters one tile. Refill it at any water.' },
    { name: 'Copper Can', power: 1, capacity: 60, area: 3, cost: { coins: 400, copper_bar: 4 }, minLevel: 2, desc: 'Holds more and waters 3 tiles in a row.' },
    { name: 'Iron Can', power: 1, capacity: 90, area: 9, cost: { coins: 1200, iron_bar: 4 }, minLevel: 4, desc: 'Holds lots and waters a 3×3 patch.' },
  ],
  pickaxe: [
    { name: 'Old Pickaxe', power: 1, desc: 'Breaks rocks in the mine.' },
    { name: 'Copper Pickaxe', power: 2, cost: { coins: 300, copper_bar: 4 }, minLevel: 2, desc: 'Breaks rocks twice as fast.' },
    { name: 'Iron Pickaxe', power: 3, cost: { coins: 900, iron_bar: 4 }, minLevel: 4, desc: 'Chews through tough ore.' },
    { name: 'Golden Pickaxe', power: 5, cost: { coins: 2200, gold_bar: 4 }, minLevel: 6, desc: 'Shatters rocks in one or two swings.' },
  ],
  // swords are sold at the Wayfarers' Hall, not Nori's (data/weapon-data.js)
  sword: SWORDS,
};

/** Furnace recipes. `fish: 1` means any one fish from the bag (the least valuable). */
export const SMELT_RECIPES = [
  { id: 'copper_bar', in: { copper_ore: 5, coal: 1 }, out: { copper_bar: 1 }, station: 'furnace' },
  { id: 'iron_bar', in: { iron_ore: 5, coal: 1 }, out: { iron_bar: 1 }, station: 'furnace' },
  { id: 'gold_bar', in: { gold_ore: 5, coal: 1 }, out: { gold_bar: 1 }, station: 'furnace' },
  { id: 'grilled_fish', in: { fish: 1, wood: 1 }, out: { grilled_fish: 1 }, station: 'campfire' },
  // cottage kitchen (after Rowan's kitchen upgrade)
  { id: 'k_grilled_fish', in: { fish: 1 }, out: { grilled_fish: 1 }, station: 'kitchen' },
  { id: 'k_salad', in: { radish: 1, sunbean: 1 }, out: { island_salad: 1 }, station: 'kitchen' },
  { id: 'fish_stew', in: { fish: 2, radish: 1 }, out: { fish_stew: 1 }, station: 'kitchen' },
  { id: 'omelet', in: { egg: 2, milk: 1 }, out: { omelet: 1 }, station: 'kitchen' },
  { id: 'melon_smoothie', in: { tidemelon: 1, milk: 1 }, out: { melon_smoothie: 1 }, station: 'kitchen' },
  { id: 'pumpkin_soup', in: { emberpumpkin: 1, milk: 1 }, out: { pumpkin_soup: 1 }, station: 'kitchen' },
  { id: 'leek_soup', in: { frostleek: 2, fish: 1 }, out: { leek_soup: 1 }, station: 'kitchen' },
];

/** Sell prices for spare resources (players can always sell extras). */
export const RESOURCE_SELL = {
  wood: 2, stone: 3, shell: 4, seaglass: 15, flower: 3,
  copper_ore: 5, iron_ore: 9, gold_ore: 16, copper_bar: 30, iron_bar: 55, gold_bar: 95,
  quartz: 20, amethyst: 45, slime: 3, bat_wing: 6,
  ...FARM_SELL,
  ...LIFE_SELL,
};

export const HATS = {
  none: { id: 'none', name: 'No Hat', pearls: 0 },
  straw: { id: 'straw', name: 'Straw Hat', pearls: 0 },
  bandana: { id: 'bandana', name: 'Bandana', pearls: 0 },
  cap: { id: 'cap', name: 'Sailor Cap', pearls: 3 },
  flower: { id: 'flower', name: 'Hibiscus Pin', pearls: 3 },
  beanie: { id: 'beanie', name: 'Cozy Beanie', pearls: 5 },
  explorer: { id: 'explorer', name: 'Explorer Hat', pearls: 6 },
  captain: { id: 'captain', name: 'Captain’s Hat', pearls: 10 },
  sunhat: { id: 'sunhat', name: 'Sun Hat', pearls: 0 },
  bucket: { id: 'bucket', name: 'Bucket Hat', pearls: 0 },
  beret: { id: 'beret', name: 'Beret', pearls: 0 },
  cowboy: { id: 'cowboy', name: 'Cowboy Hat', pearls: 0 },
  bow: { id: 'bow', name: 'Hair Bow', pearls: 0 },
  headband: { id: 'headband', name: 'Headband', pearls: 0 },
  tophat: { id: 'tophat', name: 'Top Hat', pearls: 0 },
  hardhat: { id: 'hardhat', name: 'Hard Hat', pearls: 4 },
  frog: { id: 'frog', name: 'Frog Hat', pearls: 8 },
  cat: { id: 'cat', name: 'Cat Ears', pearls: 8 },
  pirate: { id: 'pirate', name: 'Pirate Hat', pearls: 12 },
  wizard: { id: 'wizard', name: 'Wizard Hat', pearls: 15 },
  crown: { id: 'crown', name: 'Coral Crown', pearls: 20 },
};

/** Hats anyone can pick when making a character (the rest are bought with pearls). */
export const STARTING_HATS = ['none', 'straw', 'bandana', 'sunhat', 'bucket', 'beret', 'cowboy', 'bow', 'headband', 'tophat'];

/** Base fish capacity; storage sheds add to it (see building-data). */
export const BASE_FISH_CAPACITY = 30;

/** Bonus for selling at a Fish Market owner. */
export const MARKET_SELL_BONUS = 0.15;
