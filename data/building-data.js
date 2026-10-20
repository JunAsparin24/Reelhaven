// Buildings and decorations that the player can place in build mode.
//
// footprint: tiles occupied (w x h) for rotation 0; rotation 1 swaps w/h.
// sprite:    sprite id in the registry ("{id}" or "{id}_r1" for rotations).
// solid:     blocks movement; walkable decorations (paths) do not.
// light:     radius in px of the night-time glow (optional), offset from base.
// maxCount:  limit across all islands (null = unlimited).

export const BUILDINGS = {
  cottage: {
    id: 'cottage', name: 'Starter Cottage', kind: 'building', price: 0, minLevel: 1, maxCount: 1, buildable: false,
    footprint: { w: 4, h: 2 }, solid: true,
    lights: [{ x: -17, y: -16, r: 18 }, { x: 21, y: -16, r: 18 }],
    desc: 'Your cozy home. Sleep here to skip to the next morning.',
  },
  guest_cabin: {
    id: 'guest_cabin', name: 'Guest Cabin', kind: 'building', price: 0, buildable: false,
    footprint: { w: 3, h: 2 }, solid: true,
    lights: [{ x: -10, y: -14, r: 16 }],
    desc: 'Built automatically for each friend who joins your game, with a bed of their own.',
  },
  fishing_hut: {
    id: 'fishing_hut', name: 'Fishing Hut', kind: 'building', price: 220, cost: { wood: 10, stone: 4 }, minLevel: 2, maxCount: 1,
    footprint: { w: 3, h: 2 }, solid: true,
    lights: [{ x: -12, y: -14, r: 16 }, { x: 14, y: -14, r: 16 }],
    desc: 'Unlocks Shrimp Bait, Glow Bait and Treasure Lures. Mira will love it.',
  },
  crop_garden: {
    id: 'crop_garden', name: 'Crop Garden', kind: 'building', price: 250, cost: { wood: 8 }, minLevel: 3, maxCount: 2,
    footprint: { w: 3, h: 2 }, solid: true, flat: true,
    produce: { every: 8 * 60 * 1000, items: { flower: 2, worm_bait: 2 }, cap: 3 },
    desc: 'Grows flowers and wriggly worm bait over time. Harvest it whenever you pass by.',
  },
  fish_market: {
    id: 'fish_market', name: 'Fish Market', kind: 'building', price: 500, cost: { wood: 15, stone: 8, shell: 5 }, minLevel: 3, maxCount: 1,
    footprint: { w: 4, h: 2 }, solid: true,
    lights: [{ x: -22, y: -6, r: 16 }, { x: 22, y: -6, r: 16 }],
    desc: 'Customers post special orders here, and every fish sells for 15% more.',
  },
  storage_shed: {
    id: 'storage_shed', name: 'Storage Shed', kind: 'building', price: 400, cost: { wood: 20, stone: 10 }, minLevel: 4, maxCount: 2,
    footprint: { w: 2, h: 2 }, solid: true, use: 'chest',
    desc: 'A walk-in store for everything that won’t fit in your bag. You can build two.',
  },
  lighthouse: {
    id: 'lighthouse', name: 'Lighthouse', kind: 'building', price: 1500, cost: { stone: 30, wood: 20, seaglass: 6 }, minLevel: 6, maxCount: 1,
    footprint: { w: 2, h: 2 }, solid: true,
    lights: [{ x: 0, y: -70, r: 40 }],
    desc: 'Lights the way to Moonlit Bay and makes rare night fish a little more common.',
  },
};

export const DECOR = {
  bench: { id: 'bench', name: 'Bench', kind: 'decor', price: 60, cost: { wood: 3 }, footprint: { w: 2, h: 1 }, rotations: 2, solid: true, desc: 'A place to watch the waves.' },
  lantern: { id: 'lantern', name: 'Lantern', kind: 'decor', price: 45, footprint: { w: 1, h: 1 }, solid: true, lights: [{ x: 0, y: -18, r: 22 }], desc: 'Glows warmly at night.' },
  fence: { id: 'fence', name: 'Fence', kind: 'decor', price: 10, cost: { wood: 1 }, footprint: { w: 1, h: 1 }, rotations: 2, solid: true, desc: 'Neat wooden fencing.' },
  flower_bed: { id: 'flower_bed', name: 'Flower Bed', kind: 'decor', price: 30, cost: { flower: 2 }, footprint: { w: 1, h: 1 }, solid: true, desc: 'A burst of colour.' },
  stone_path: { id: 'stone_path', name: 'Stone Path', kind: 'decor', price: 8, cost: { stone: 1 }, footprint: { w: 1, h: 1 }, solid: false, flat: true, desc: 'Walkable stepping stones.' },
  palm_deco: { id: 'palm_deco', name: 'Palm Tree', kind: 'decor', price: 50, footprint: { w: 1, h: 1 }, solid: true, desc: 'Can never have too many palms.' },
  bush_deco: { id: 'bush_deco', name: 'Hibiscus Bush', kind: 'decor', price: 20, footprint: { w: 1, h: 1 }, solid: true, desc: 'A leafy bush with pink blooms.' },
  shell_display: { id: 'shell_display', name: 'Shell Display', kind: 'decor', price: 40, cost: { shell: 4 }, footprint: { w: 1, h: 1 }, solid: true, desc: 'Show off your finest shells.' },
  wooden_sign: { id: 'wooden_sign', name: 'Wooden Sign', kind: 'decor', price: 25, cost: { wood: 2 }, footprint: { w: 1, h: 1 }, solid: true, desc: 'Points somewhere. Possibly everywhere.' },
  tiki_torch: { id: 'tiki_torch', name: 'Tiki Torch', kind: 'decor', price: 35, cost: { wood: 2 }, footprint: { w: 1, h: 1 }, solid: true, lights: [{ x: 0, y: -22, r: 20 }], desc: 'Flickers cheerfully after dark.' },
  beach_umbrella: { id: 'beach_umbrella', name: 'Beach Umbrella', kind: 'decor', price: 70, footprint: { w: 1, h: 1 }, solid: true, desc: 'Shade for lazy afternoons.' },
  small_pond: { id: 'small_pond', name: 'Small Pond', kind: 'decor', price: 150, cost: { stone: 6 }, footprint: { w: 2, h: 2 }, solid: true, flat: true, minLevel: 3, desc: 'A tiny pond with a lily pad.' },
  hammock: { id: 'hammock', name: 'Hammock', kind: 'decor', price: 120, cost: { wood: 6 }, footprint: { w: 3, h: 1 }, solid: true, minLevel: 3, desc: 'Peak island relaxation.' },
  topiary: { id: 'topiary', name: 'Topiary', kind: 'decor', price: 90, cost: { flower: 3 }, footprint: { w: 1, h: 1 }, solid: true, minLevel: 4, desc: 'A carefully clipped little tree.' },
  coral_planter: { id: 'coral_planter', name: 'Coral Planter', kind: 'decor', price: 80, cost: { shell: 3 }, footprint: { w: 1, h: 1 }, solid: true, requiresIsland: 'coral', desc: 'Reef-inspired garden art.' },
  picket_fence: { id: 'picket_fence', name: 'Picket Fence', kind: 'decor', price: 14, cost: { wood: 1 }, footprint: { w: 1, h: 1 }, rotations: 2, solid: true, desc: 'A crisp white fence for tidy yards.' },
  planter_box: { id: 'planter_box', name: 'Planter Box', kind: 'decor', price: 45, cost: { wood: 3, flower: 2 }, footprint: { w: 2, h: 1 }, solid: true, desc: 'A long box of bright flowers.' },
  hay_bale: { id: 'hay_bale', name: 'Hay Bale', kind: 'decor', price: 25, footprint: { w: 1, h: 1 }, solid: true, desc: 'Farm-fresh and very sit-on-able.' },
  scarecrow: { id: 'scarecrow', name: 'Scarecrow', kind: 'decor', price: 55, cost: { wood: 3 }, footprint: { w: 1, h: 1 }, solid: true, desc: 'Keeps the gulls off your garden.' },
  mailbox: { id: 'mailbox', name: 'Mailbox', kind: 'decor', price: 40, cost: { wood: 2 }, footprint: { w: 1, h: 1 }, solid: true, desc: 'For letters from far-off islands.' },
  birdbath: { id: 'birdbath', name: 'Birdbath', kind: 'decor', price: 60, cost: { stone: 4 }, footprint: { w: 1, h: 1 }, solid: true, desc: 'A splash spot for passing birds.' },
  stone_lantern: { id: 'stone_lantern', name: 'Stone Lantern', kind: 'decor', price: 70, cost: { stone: 5 }, footprint: { w: 1, h: 1 }, solid: true, lights: [{ x: 0, y: -14, r: 22 }], desc: 'A calm glow carved from stone.' },
  flag_pole: { id: 'flag_pole', name: 'Island Flag', kind: 'decor', price: 65, cost: { wood: 2 }, footprint: { w: 1, h: 1 }, solid: true, desc: 'Fly your island colours.' },
  picnic_table: { id: 'picnic_table', name: 'Picnic Table', kind: 'decor', price: 90, cost: { wood: 6 }, footprint: { w: 2, h: 1 }, solid: true, desc: 'Lunch with a sea view.' },
  crate_stack: { id: 'crate_stack', name: 'Crate Stack', kind: 'decor', price: 30, cost: { wood: 3 }, footprint: { w: 1, h: 1 }, solid: true, desc: 'Who knows what is inside?' },
  barrel_deco: { id: 'barrel_deco', name: 'Barrel', kind: 'decor', price: 25, cost: { wood: 2 }, footprint: { w: 1, h: 1 }, solid: true, desc: 'A sturdy wooden barrel.' },
  potted_plant: { id: 'potted_plant', name: 'Potted Plant', kind: 'decor', price: 30, footprint: { w: 1, h: 1 }, solid: true, desc: 'A leafy friend in a pot.' },
  garden_arch: { id: 'garden_arch', name: 'Garden Arch', kind: 'decor', price: 120, cost: { wood: 5, flower: 4 }, footprint: { w: 2, h: 1 }, solid: false, minLevel: 3, desc: 'A flowery arch you can walk under.' },
  well: { id: 'well', name: 'Stone Well', kind: 'decor', price: 160, cost: { stone: 10, wood: 3 }, footprint: { w: 2, h: 1 }, solid: true, minLevel: 3, desc: 'A classic village well.' },
  fish_statue: { id: 'fish_statue', name: 'Fish Statue', kind: 'decor', price: 200, cost: { stone: 8, copper_bar: 1 }, footprint: { w: 1, h: 1 }, solid: true, minLevel: 4, desc: 'A proud tribute to the big one.' },
  // utility: things you use, not just look at
  chest: { id: 'chest', name: 'Storage Chest', kind: 'decor', category: 'utility', use: 'chest', price: 0, cost: { wood: 50 }, footprint: { w: 1, h: 1 }, solid: true, desc: 'Store items you don’t want to carry around.' },
  furnace: { id: 'furnace', name: 'Furnace', kind: 'decor', category: 'utility', use: 'furnace', price: 120, cost: { stone: 15 }, footprint: { w: 1, h: 1 }, solid: true, minLevel: 2, lights: [{ x: 0, y: -8, r: 18 }], desc: 'Smelt ore into bars and grill fish.' },
  campfire: { id: 'campfire', name: 'Campfire', kind: 'decor', category: 'utility', use: 'campfire', price: 30, cost: { wood: 5, stone: 2 }, footprint: { w: 1, h: 1 }, solid: true, lights: [{ x: 0, y: -6, r: 26 }], desc: 'Grill fish to heal up. Cozy after dark.' },
};

export const PLACEABLES = { ...BUILDINGS, ...DECOR };

export function footprintOf(def, rot = 0) {
  return rot % 2 === 1 ? { w: def.footprint.h, h: def.footprint.w } : { ...def.footprint };
}
