// Island life: energy, skills, crafting, friendship, schedules, mail,
// festivals, restoration bundles, the museum, animals and machines.
// Everything is data so new content needs no new code.

// ---------------------------------------------------------------- energy
export const MAX_ENERGY = 100;
/** Energy used per swing / cast. The skill for that tool lowers it. */
export const ENERGY_COST = { axe: 1, pickaxe: 1, hoe: 1, watering_can: 0.5, scythe: 0, sword: 0, cast: 0.5 };
export const TIRED_AT = 15;

// ---------------------------------------------------------------- skills
export const SKILLS = {
  farming: { name: 'Farming', icon: 'hoe', tools: ['hoe', 'watering_can'], perk: 'Crops sell for 10% more (level 5) and 20% more (level 10).' },
  mining: { name: 'Mining', icon: 'pickaxe', tools: ['pickaxe'], perk: 'Extra ore from rocks (level 5), even more at level 10.' },
  foraging: { name: 'Foraging', icon: 'axe', tools: ['axe', 'scythe'], perk: 'Extra wood from trees (level 5) and a chance of double gathers (level 10).' },
  fishing: { name: 'Fishing', icon: 'rod', tools: ['cast'], perk: 'A wider catch zone (level 5) and more treasure (level 10).' },
  combat: { name: 'Combat', icon: 'sword', tools: ['sword'], perk: '+15% sword damage (level 5), +30% at level 10.' },
};
/** Total XP needed for each skill level (index = level). */
export const SKILL_XP = [0, 60, 160, 320, 560, 900, 1350, 1950, 2700, 3700, 5000];
export const MAX_SKILL = 10;

// ---------------------------------------------------------------- crafting
/**
 * Crafting menu recipes. `place` = goes to your build storage to place;
 * `item` = goes in the bag. You have to learn a recipe before you can craft it:
 *   learn: 'start'            known from the beginning
 *   learn: { skill: lvl }     learned when that skill reaches the level
 *   learn: { shop: price }    bought at Nori's shop (Recipes tab)
 *   learn: { hearts: [npc, n] } taught by an islander at n hearts
 *   learn: { quest: id }      reward for finishing that story quest
 */
export const CRAFT_RECIPES = [
  // known from the start
  { id: 'chest', name: 'Storage Chest', in: { wood: 50 }, place: 'chest', learn: 'start', desc: 'Store anything you don’t want to carry.' },
  { id: 'torch', name: 'Torch', in: { wood: 1, sap: 2 }, place: 'torch', learn: 'start', desc: 'A bright light for your yard at night.' },
  { id: 'wood_path', name: 'Wood Path', in: { wood: 1 }, place: 'wood_path', learn: 'start', desc: 'Walkable wooden planks.' },
  { id: 'stone_path', name: 'Stone Path', in: { stone: 1 }, place: 'stone_path', learn: 'start', desc: 'Walkable stepping stones.' },
  { id: 'fence_pack', name: 'Fence ×5', in: { wood: 5 }, place: 'fence', count: 5, learn: 'start', desc: 'Five pieces of wooden fence.' },
  // skills
  { id: 'scarecrow', name: 'Scarecrow', in: { wood: 30, coal: 1, fiber: 20 }, place: 'scarecrow', learn: { farming: 1 }, desc: 'A friendly guardian for your crops.' },
  { id: 'field_snack', name: 'Field Snack', in: { radish: 1, fiber: 2 }, item: { field_snack: 1 }, learn: { foraging: 1 }, desc: 'A quick bite: +30 energy.' },
  { id: 'worm_bait', name: 'Worm Bait ×5', in: { fiber: 5, slime: 1 }, item: { worm_bait: 5 }, learn: { fishing: 1 }, desc: 'Homemade bait — fish bite sooner.' },
  { id: 'furnace', name: 'Furnace', in: { stone: 25, copper_ore: 20 }, place: 'furnace', learn: { mining: 1 }, desc: 'Smelt ore and coal into bars.' },
  { id: 'sprinkler', name: 'Sprinkler', in: { copper_bar: 1, iron_bar: 1 }, place: 'sprinkler', learn: { farming: 2 }, desc: 'Waters the 4 tilled tiles next to it every morning.' },
  { id: 'charcoal_kiln', name: 'Charcoal Kiln', in: { wood: 20, copper_bar: 2 }, place: 'charcoal_kiln', learn: { foraging: 2 }, desc: 'Turns 10 wood into 1 coal.' },
  { id: 'mayo_machine', name: 'Mayonnaise Machine', in: { wood: 15, stone: 15, copper_bar: 1 }, place: 'mayo_machine', learn: { farming: 3 }, desc: 'Turns an egg into mayonnaise.' },
  { id: 'preserves_jar', name: 'Preserves Jar', in: { wood: 50, stone: 40, coal: 8 }, place: 'preserves_jar', learn: { farming: 4 }, desc: 'Turns any crop into jam.' },
  { id: 'cheese_press', name: 'Cheese Press', in: { wood: 45, stone: 45, hardwood: 10, copper_bar: 1 }, place: 'cheese_press', learn: { farming: 5 }, desc: 'Turns milk into cheese.' },
  { id: 'keg', name: 'Keg', in: { wood: 30, copper_bar: 1, iron_bar: 1, sap: 10 }, place: 'keg', learn: { farming: 6 }, desc: 'Turns any crop into juice.' },
  { id: 'quality_sprinkler', name: 'Quality Sprinkler', in: { iron_bar: 1, gold_bar: 1, quartz: 1 }, place: 'quality_sprinkler', learn: { farming: 7 }, desc: 'Waters all 8 tiles around it every morning.' },
  // bought at Nori's
  { id: 'tiki_torch', name: 'Tiki Torch', in: { wood: 2, sap: 3 }, place: 'tiki_torch', learn: { shop: 150 }, desc: 'Flickers cheerfully after dark.' },
  { id: 'stone_lantern', name: 'Stone Lantern', in: { stone: 5, coal: 1 }, place: 'stone_lantern', learn: { shop: 250 }, desc: 'A calm glow carved from stone.' },
  { id: 'shrimp_bait', name: 'Shrimp Bait ×3', in: { shell: 2, fiber: 2 }, item: { shrimp_bait: 3 }, learn: { shop: 300 }, desc: 'Bait that tempts the bigger fish.' },
  // taught by islanders
  { id: 'lantern', name: 'Lantern', in: { wood: 2, coal: 1 }, place: 'lantern', learn: { hearts: ['nori', 3] }, desc: 'Nori’s favourite warm light.' },
  { id: 'well', name: 'Stone Well', in: { stone: 10, wood: 3 }, place: 'well', learn: { hearts: ['rowan', 3] }, desc: 'Rowan shows you how to build a well.' },
  { id: 'fish_statue', name: 'Fish Statue', in: { stone: 8, copper_bar: 1 }, place: 'fish_statue', learn: { hearts: ['pip', 3] }, desc: 'Pip’s proud fish sculpture.' },
  { id: 'deluxe_bait', name: 'Glow Bait ×3', in: { seaglass: 1, fiber: 3 }, item: { glow_bait: 3 }, learn: { hearts: ['mira', 3] }, desc: 'Mira’s night-fishing secret.' },
  // story rewards
  { id: 'bench', name: 'Bench', in: { wood: 3 }, place: 'bench', learn: { quest: 'q_gather' }, desc: 'A place to watch the waves.' },
];

// ---------------------------------------------------------------- friendship
export const HEART_POINTS = 250;
export const MAX_HEARTS = 10;
export const GIFT_POINTS = { love: 80, like: 45, neutral: 20, dislike: -20 };
export const TALK_POINTS = 20;

/** What each islander loves / likes / dislikes (item ids; 'fish:*' = any fish). */
export const TASTES = {
  mira: { love: ['golden_koi', 'grilled_fish', 'tidemelon'], like: ['fish:*', 'shell', 'island_salad'], dislike: ['slime', 'stone'] },
  nori: { love: ['amethyst', 'gold_bar', 'cheese'], like: ['quartz', 'seaglass', 'jam', 'mayonnaise'], dislike: ['fiber', 'bat_wing'] },
  rowan: { love: ['iron_bar', 'gold_bar', 'grilled_fish'], like: ['wood', 'stone', 'copper_bar'], dislike: ['flower', 'radish'] },
  pip: { love: ['seaglass', 'amethyst', 'emberpumpkin'], like: ['shell', 'flower', 'quartz', 'egg'], dislike: ['slime'] },
  bram: { love: ['amethyst', 'bat_wing', 'cheese'], like: ['iron_ore', 'gold_ore', 'grilled_fish'], dislike: ['flower', 'jam'] },
  marlo: { love: ['seaglass', 'coral'], like: ['shell', 'fish:*'], dislike: ['stone'] },
  wren: { love: ['frostleek', 'amethyst'], like: ['flower', 'mushroom', 'fish:*'], dislike: ['gold_bar'] },
  luna: { love: ['amethyst', 'quartz'], like: ['seaglass', 'flower'], dislike: ['slime'] },
};

/** Gifts islanders send when your friendship reaches a heart level (by mail). */
export const HEART_REWARDS = {
  mira: { 2: { items: { worm_bait: 10 }, note: 'Here’s some of my best bait. Go catch something big!' }, 5: { items: { shrimp_bait: 10 }, coins: 200, note: 'You’ve become a real angler. These are my secret shrimp.' }, 8: { rod: 'coral_rod', note: 'I want you to have my old Coral Rod. Take care of it!' } },
  nori: { 2: { items: { island_salad: 3 }, note: 'On the house! Don’t tell the other customers.' }, 5: { coins: 500, note: 'A little thank-you for being my best customer.' }, 8: { pearls: 5, note: 'Pearls! I’ve been saving these for someone special.' } },
  rowan: { 2: { items: { wood: 50 }, note: 'Spare timber. You’ll put it to better use than me.' }, 5: { items: { iron_bar: 5 }, note: 'Good iron for good tools.' }, 8: { decor: 'well', note: 'I built you a well. Every yard needs one.' } },
  pip: { 2: { items: { seaglass: 3 }, note: 'Found these on an adventure!' }, 5: { decor: 'fish_statue', note: 'I made you a statue. It’s a fish. Obviously.' }, 8: { pearls: 4, note: 'My treasure map led to these. Splitting it with you!' } },
  bram: { 2: { items: { grilled_fish: 3 }, note: 'Trail rations. Eat before the mine, not after.' }, 5: { coins: 800, note: 'A bounty bonus. You’ve earned it.' }, 8: { sword: 3, note: 'Take the Tidebreaker. You’re ready for it.' } },
};

// ---------------------------------------------------------------- schedules
/**
 * Where islanders spend the day: [fromHour, x, y] on their island (Sunny
 * Shores uses the big map). Nori and Bram stay inside their buildings and
 * their doors are locked outside opening hours.
 */
export const SCHEDULES = {
  mira: [[5, 53, 48], [10, 62, 41], [15, 44, 33], [19, 53, 46]],
  rowan: [[6, 58, 22], [12, 48, 31], [17, 61, 21], [21, 58, 23]],
  pip: [[7, 47, 34], [11, 66, 37], [15, 40, 26], [20, 47, 33]],
};
export const OPENING_HOURS = {
  shop_interior: { from: 9, to: 18, name: 'Nori’s Shop' },
  hall_interior: { from: 10, to: 22, name: 'the Wayfarers’ Hall' },
  museum_interior: { from: 8, to: 20, name: 'the Museum' },
};

// ---------------------------------------------------------------- festivals
/** One festival per season, 9 AM – 3 PM in town. */
export const FESTIVALS = {
  spring: { day: 13, id: 'flower_fair', name: 'Flower Fair', desc: 'Stalls of rare seeds and flowers, and a dance with the islanders.' },
  summer: { day: 11, id: 'fishing_derby', name: 'Fishing Derby', desc: 'Catch as many fish as you can in 3 minutes. Big prizes for big hauls!' },
  fall: { day: 16, id: 'harvest_fair', name: 'Harvest Fair', desc: 'Show off your best produce and goods. The judges award star tokens.' },
  winter: { day: 25, id: 'lantern_night', name: 'Lantern Night', desc: 'Release a lantern over the sea with everyone on the island.' },
};
export const FESTIVAL_HOURS = { from: 9, to: 15 };

// ---------------------------------------------------------------- mail
/** Letters that arrive on certain days (day = total days played). */
export const MAIL_SCHEDULE = [
  { id: 'welcome', day: 2, from: 'Mira', subject: 'Welcome to the island!', body: 'Hope your first night was cozy! Tip: crops only grow on days you water them, and the TV in your cottage tells you tomorrow’s weather. — Mira', attach: { items: { radish_seeds: 5 } } },
  { id: 'mine_open', day: 5, from: 'Rowan', subject: 'The mine is open', body: 'Cleared the rocks at the Old Mine this morning. Bram at the Wayfarers’ Hall can sell you a better blade once you get going. Bring food!', attach: { items: { seaweed_snack: 3 } } },
  { id: 'museum', day: 8, from: 'Pip', subject: 'Our museum needs you!', body: 'I’m reopening the island museum in town. Donate a fish or gem you find and I’ll put it on display. There are prizes!', attach: {} },
  { id: 'animals', day: 12, from: 'Rowan', subject: 'Thought about animals?', body: 'A Coop or a Barn would suit that yard of yours. Chickens lay eggs, cows give milk — and machines turn them into something special. Check the Build menu!', attach: { items: { wood: 20 } } },
];

// ---------------------------------------------------------------- restoration
/** Projects on the Island Restoration Board. Donated items are used up. */
export const BUNDLES = [
  { id: 'pier', name: 'Repair the Old Pier', items: { wood: 60, stone: 30, shell: 10 }, coins: 500, reward: 'A long pier opens up deep-sea fishing.', flag: 'pierRepaired' },
  { id: 'garden', name: 'Community Garden', items: { radish: 5, sunbean: 5, flower: 10, fiber: 20 }, reward: 'Gives you 5 Quality Sprinklers.', give: { decor: { quality_sprinkler: 5 } } },
  { id: 'catch', name: 'Fisher’s Catch', fish: 6, reward: 'Pearls and a Fish Market blueprint discount.', give: { pearls: 4, coins: 600 } },
  { id: 'forge', name: 'Miner’s Forge', items: { copper_bar: 5, iron_bar: 5, gold_bar: 2, quartz: 3 }, reward: 'Rowan upgrades your pickaxe one level.' },
  { id: 'kitchen', name: 'Town Kitchen', items: { egg: 5, milk: 3, cheese: 1, jam: 2 }, reward: 'Islanders’ friendship grows twice as fast from gifts.', flag: 'townKitchen' },
];

// ---------------------------------------------------------------- museum
/** Museum: donate fish species and gems/minerals; rewards at milestones. */
export const MUSEUM_GEMS = ['quartz', 'amethyst', 'seaglass', 'copper_ore', 'iron_ore', 'gold_ore'];
export const MUSEUM_REWARDS = [
  { at: 3, coins: 250, note: 'A small reward from the museum fund.' },
  { at: 8, decor: 'fish_statue', note: 'A fish statue for your yard!' },
  { at: 15, pearls: 5, note: 'The museum is buzzing! Here are some pearls.' },
  { at: 25, coins: 3000, pearls: 5, note: 'A truly great collection. Thank you!' },
];

// ---------------------------------------------------------------- animals
export const ANIMALS = {
  chicken: { name: 'Chicken', home: 'coop', price: 400, product: 'egg', every: 1, sprite: 'chicken' },
  duck: { name: 'Duck', home: 'coop', price: 900, product: 'duck_egg', every: 2, sprite: 'duck' },
  cow: { name: 'Cow', home: 'barn', price: 1500, product: 'milk', every: 1, sprite: 'cow' },
  goat: { name: 'Goat', home: 'barn', price: 2500, product: 'goat_milk', every: 2, sprite: 'goat' },
};
export const ANIMAL_CAPACITY = { coop: 4, barn: 4 };

/** Animal products, artisan goods and other new items (merged into RESOURCES). */
export const LIFE_ITEMS = {
  egg: { id: 'egg', name: 'Egg', icon: 'egg', desc: 'Fresh from the coop.' },
  duck_egg: { id: 'duck_egg', name: 'Duck Egg', icon: 'duck_egg', desc: 'Big and blue.' },
  milk: { id: 'milk', name: 'Milk', icon: 'milk', desc: 'Creamy and fresh.' },
  goat_milk: { id: 'goat_milk', name: 'Goat Milk', icon: 'milk', desc: 'Rich goat milk.' },
  mayonnaise: { id: 'mayonnaise', name: 'Mayonnaise', icon: 'mayo', desc: 'Made in a Mayonnaise Machine.' },
  cheese: { id: 'cheese', name: 'Cheese', icon: 'cheese', desc: 'Aged in a Cheese Press.' },
  jam: { id: 'jam', name: 'Jam', icon: 'jam', desc: 'Sweet preserves from your crops.' },
  hay: { id: 'hay', name: 'Hay', icon: 'hay', desc: 'Cut tall grass to get hay. Animals eat it.' },
  hardwood: { id: 'hardwood', name: 'Hardwood', icon: 'hardwood', desc: 'Dense wood from big stumps.' },
  coal: { id: 'coal', name: 'Coal', icon: 'coal', desc: 'Fuel for the furnace. Found in mine rocks, or made in a kiln.' },
  sap: { id: 'sap', name: 'Sap', icon: 'sap', desc: 'Sticky stuff from chopped trees.' },
  juice: { id: 'juice', name: 'Juice', icon: 'juice', desc: 'Pressed in a keg from your crops.' },
};
export const LIFE_SELL = { egg: 50, duck_egg: 95, milk: 125, goat_milk: 225, mayonnaise: 190, cheese: 230, jam: 120, hay: 5, hardwood: 15, coal: 15, sap: 2, juice: 160 };

/**
 * Processing machines: put an input in, wait `time` game minutes, collect.
 * inputs: item id → output id ('*crop' = any crop); need = how many go in.
 */
export const MACHINES = {
  mayo_machine: { name: 'Mayonnaise Machine', inputs: { egg: 'mayonnaise', duck_egg: 'mayonnaise' }, time: 180, ask: 'an egg' },
  cheese_press: { name: 'Cheese Press', inputs: { milk: 'cheese', goat_milk: 'cheese' }, time: 200, ask: 'milk' },
  preserves_jar: { name: 'Preserves Jar', inputs: { '*crop': 'jam' }, time: 2400, ask: 'a crop' },
  keg: { name: 'Keg', inputs: { '*crop': 'juice' }, time: 1600, ask: 'a crop' },
  charcoal_kiln: { name: 'Charcoal Kiln', inputs: { wood: 'coal' }, need: { wood: 10 }, time: 30, ask: '10 wood' },
};
/** Furnace smelting times (game minutes) per bar. */
export const SMELT_TIME = { copper_bar: 30, iron_bar: 120, gold_bar: 300 };

// ---------------------------------------------------------------- mine
/** Boss floors (every 25): a big monster guarding a treasure shared with the world. */
export const BOSSES = {
  25: { type: 'king_slime', name: 'King Slime', hp: 600, damage: 18, speed: 14, xp: 120, reward: { coins: 2000, items: { gold_bar: 3 }, pearls: 3 } },
  50: { type: 'stone_golem', name: 'Stone Golem', hp: 1500, damage: 26, speed: 12, xp: 260, reward: { coins: 5000, items: { amethyst: 5, gold_bar: 5 }, pearls: 5 } },
  75: { type: 'void_wisp', name: 'Void Wisp', hp: 2600, damage: 34, speed: 24, xp: 400, reward: { coins: 9000, items: { amethyst: 8 }, pearls: 8 } },
};
