// Swords and monster-slaying goals, sold and tracked at the Wayfarers' Hall
// next to the Old Mine. Better swords unlock as you reach deeper floors
// (like Stardew's Adventurer's Guild); some can also be found in the mine.

/**
 * The sword ladder. Your sword is a tier index (inventory.tools.sword);
 * floor = deepest mine floor you need to have reached before Bram sells it.
 */
export const SWORDS = [
  { id: 'wooden_sword', name: 'Wooden Sword', damage: 10, desc: 'Nori’s starter blade. Better than a stick. Just.' },
  { id: 'coral_saber', name: 'Coral Saber', damage: 16, price: 500, floor: 5, desc: 'Light and quick, carved from reef stone.' },
  { id: 'rusty_cutlass', name: 'Rusty Cutlass', damage: 20, price: 1500, floor: 20, desc: 'An old pirate’s cutlass. Waiting in the chest on floor 20.' },
  { id: 'tidebreaker', name: 'Tidebreaker', damage: 27, price: 2500, floor: 25, desc: 'Heavy enough to split a rock crab’s shell.' },
  { id: 'obsidian_fang', name: 'Obsidian Fang', damage: 36, price: 5000, floor: 40, desc: 'Glassy black and wickedly sharp.' },
  { id: 'moonlit_katana', name: 'Moonlit Katana', damage: 48, price: 9000, floor: 60, desc: 'Glows faintly in the dark of the deep mine.' },
  { id: 'starfall_blade', name: 'Starfall Blade', damage: 64, price: 20000, cost: { amethyst: 5, gold_bar: 3 }, floor: 80, desc: 'Forged from a fallen star. The finest blade on the islands.' },
];

/** Monster-slaying goals: defeat enough of one kind for a reward. */
export const SLAYER_GOALS = [
  { id: 'slime_25', monster: 'slime', count: 25, name: 'Slime Sweeper', reward: { coins: 300, items: { island_salad: 3 } } },
  { id: 'bat_20', monster: 'bat', count: 20, name: 'Bat Wrangler', reward: { coins: 400, items: { glow_bait: 5 } } },
  { id: 'crab_15', monster: 'crab', count: 15, name: 'Crab Cracker', reward: { coins: 600, items: { iron_bar: 3 } } },
  { id: 'shade_10', monster: 'shade', count: 10, name: 'Shadow Chaser', reward: { coins: 1200, pearls: 2, items: { amethyst: 2 } } },
  { id: 'slime_100', monster: 'slime', count: 100, name: 'Slime Legend', reward: { coins: 1500, pearls: 3 } },
];

/** Special chests on milestone floors. */
export const FLOOR_CHESTS = {
  20: { sword: 2, coins: 200, label: 'Floor 20 Treasure' },
  50: { coins: 1500, items: { gold_bar: 3, amethyst: 2 }, pearls: 2, label: 'Floor 50 Treasure' },
};
