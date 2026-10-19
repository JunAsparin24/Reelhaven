// Fish species. Add a new fish by appending an entry here — the encyclopedia,
// spawn tables, sprites and selling all read from this list.
//
// zones:    fishing-spot types where the fish lives (see island-data spots)
// islands:  optional island restriction
// times:    null = any time, else subset of morning/afternoon/evening/night
// weather:  null = any, else subset of sunny/rain/storm
// bait:     bait required to hook it at all; likesBait: bait that boosts it
// behavior: movement pattern in the reeling minigame (see fishing.js)
// difficulty: 1 (gentle) .. 10 (very tough)
// art:      parameters for the procedural sprite (js/art/fish-art.js)

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

export const RARITY_WEIGHT = { common: 60, uncommon: 24, rare: 9, epic: 3.2, legendary: 0.9 };
export const RARITY_XP = { common: 8, uncommon: 14, rare: 26, epic: 45, legendary: 90 };

export const FISH = [
  {
    id: 'silver_sardine', name: 'Silver Sardine', rarity: 'common', price: 8,
    zones: ['ocean', 'beach'], times: null, weather: null, size: [8, 16], difficulty: 1, behavior: 'smooth',
    desc: 'Travels in glittering schools. Where there is one, there are forty more.',
    art: { len: 14, h: 6, body: '#b8c6d0', belly: '#eef4f6', pattern: 'band', patternColor: '#7f93a3' },
  },
  {
    id: 'blue_minnow', name: 'Blue Minnow', rarity: 'common', price: 6,
    zones: ['pond', 'lagoon', 'beach'], times: null, weather: null, size: [4, 9], difficulty: 1, behavior: 'darter',
    desc: 'A tiny, curious fish that nibbles bobbers just to see what happens.',
    art: { len: 10, h: 5, body: '#6fa8e0', belly: '#cfe6fb', pattern: 'band', patternColor: '#3f6fa8' },
  },
  {
    id: 'striped_perch', name: 'Striped Perch', rarity: 'common', price: 12,
    zones: ['ocean', 'pond'], times: ['morning', 'afternoon'], weather: null, size: [14, 30], difficulty: 2, behavior: 'smooth',
    desc: 'A sturdy daytime fish. Locals say its stripes count the days of summer.',
    art: { len: 16, h: 8, body: '#c9c27a', pattern: 'stripes', patternColor: '#5b6f45' },
  },
  {
    id: 'sunny_tang', name: 'Sunny Tang', rarity: 'common', price: 14,
    zones: ['reef', 'beach'], islands: ['coral'], times: null, weather: null, size: [10, 22], difficulty: 2, behavior: 'darter',
    desc: 'Bright as a lemon and twice as zesty. The reef’s most cheerful resident.',
    art: { len: 13, h: 10, body: '#f8dc7c', fin: '#e3a83a', tail: 'round' },
  },
  {
    id: 'mangrove_snapper', name: 'Mangrove Snapper', rarity: 'common', price: 16,
    zones: ['mangrove'], times: null, weather: null, size: [20, 45], difficulty: 2, behavior: 'smooth',
    desc: 'Hides among the roots and snaps at anything shiny.',
    art: { len: 17, h: 8, body: '#c86a5a', fin: '#9b4a44', pattern: 'gradient', patternColor: '#e08f7a' },
  },
  {
    id: 'coral_clownfish', name: 'Coral Clownfish', rarity: 'uncommon', price: 32,
    zones: ['reef'], times: null, weather: null, size: [6, 11], difficulty: 2, behavior: 'darter',
    desc: 'Never far from its anemone. Tells terrible jokes, probably.',
    art: { len: 12, h: 7, body: '#f08a4b', pattern: 'stripes', patternColor: '#fbfbf6', thick: true, tail: 'round', fin: '#c9602e' },
  },
  {
    id: 'moon_jelly', name: 'Moon Jelly', rarity: 'uncommon', price: 28,
    zones: ['ocean', 'beach', 'moon'], times: ['evening', 'night'], weather: null, size: [10, 25], difficulty: 2, behavior: 'floater',
    desc: 'Drifts up toward the surface after sunset, glowing softly like a paper lantern.',
    art: { special: 'jelly', body: '#e7d8ff', patternColor: '#b9a3f0' },
  },
  {
    id: 'drizzle_darter', name: 'Drizzle Darter', rarity: 'uncommon', price: 36,
    zones: ['pond', 'lagoon', 'mangrove'], times: null, weather: ['rain', 'storm'], size: [8, 15], difficulty: 3, behavior: 'darter',
    desc: 'Only comes out to dance in the rain. Grumpy when it is sunny.',
    art: { len: 13, h: 6, body: '#8fb8d8', pattern: 'stripes', patternColor: '#5f7fa8' },
  },
  {
    id: 'fog_lanternfish', name: 'Fog Lanternfish', rarity: 'uncommon', price: 45,
    zones: ['mangrove'], times: ['evening', 'night'], weather: null, size: [8, 18], difficulty: 3, behavior: 'floater',
    desc: 'Its little lights guide lost boats home through the mist.',
    art: { len: 14, h: 8, body: '#5f6f7f', fin: '#46525f', pattern: 'spots', patternColor: '#fff1a8' },
  },
  {
    id: 'mossy_catfish', name: 'Mossy Catfish', rarity: 'uncommon', price: 40,
    zones: ['mangrove', 'pond'], islands: ['mangrove'], times: ['evening', 'night'], weather: null, size: [25, 60], difficulty: 3, behavior: 'lazy',
    desc: 'So slow that moss grows on it. Surprisingly strong when it wants to be.',
    art: { len: 18, h: 7, body: '#7f8f5f', fin: '#5f6f45', whiskers: true, tail: 'round', pattern: 'spots', patternColor: '#5f6f45' },
  },
  {
    id: 'golden_koi', name: 'Golden Koi', rarity: 'rare', price: 120,
    zones: ['pond'], times: ['morning'], weather: null, size: [30, 70], difficulty: 4, behavior: 'lazy',
    desc: 'A magical koi that only rises at morning light. Said to bring good fortune.',
    art: { len: 18, h: 8, body: '#f0c14b', fin: '#e3924a', pattern: 'spots', patternColor: '#fbfbf6', whiskers: true, tail: 'fan' },
  },
  {
    id: 'lagoon_sunfish', name: 'Lagoon Sunfish', rarity: 'rare', price: 100,
    zones: ['lagoon'], times: ['afternoon'], weather: ['sunny'], size: [20, 45], difficulty: 4, behavior: 'smooth',
    desc: 'Basks in the warm afternoon shallows of the hidden lagoon.',
    art: { len: 14, h: 12, body: '#f6c46c', fin: '#e3924a', pattern: 'gradient', patternColor: '#f2a6a1', tail: 'round' },
  },
  {
    id: 'rainbow_parrotfish', name: 'Rainbow Parrotfish', rarity: 'rare', price: 140,
    zones: ['reef'], times: ['morning', 'afternoon'], weather: null, size: [25, 60], difficulty: 4, behavior: 'darter',
    desc: 'Crunches coral all day and sleeps in a bubble at night. Wonderfully weird.',
    art: { len: 18, h: 9, body: '#7fcfc0', pattern: 'rainbow' },
  },
  {
    id: 'pearl_puffer', name: 'Pearl Puffer', rarity: 'rare', price: 130,
    zones: ['reef', 'beach'], times: null, weather: null, likesBait: 'shrimp_bait', size: [10, 25], difficulty: 3, behavior: 'puffer',
    desc: 'Puffs up when startled. Rumour says it keeps a pearl in its cheek.',
    art: { len: 13, h: 11, body: '#f3e6c6', pattern: 'spots', patternColor: '#c9a96e', spikes: true, tail: 'round', fin: '#d9c49a' },
  },
  {
    id: 'glass_eel', name: 'Glass Eel', rarity: 'rare', price: 110,
    zones: ['mangrove', 'lagoon'], times: ['night'], weather: null, size: [30, 80], difficulty: 5, behavior: 'eel',
    desc: 'Almost invisible in moonlit water. You will feel it before you see it.',
    art: { special: 'eel', body: '#cfeef0', belly: '#a8d8e0' },
  },
  {
    id: 'stormray', name: 'Stormray', rarity: 'rare', price: 180,
    zones: ['ocean', 'reef', 'mangrove'], times: null, weather: ['storm'], size: [60, 140], difficulty: 6, behavior: 'sprinter',
    desc: 'Glides beneath thunderclouds, its spots flickering like distant lightning.',
    art: { special: 'ray', body: '#5a6f8f', patternColor: '#7f9fc9', fin: '#3f4f6f' },
  },
  {
    id: 'crystal_seahorse', name: 'Crystal Seahorse', rarity: 'epic', price: 300,
    zones: ['reef', 'lagoon'], times: ['evening', 'night'], weather: null, size: [8, 18], difficulty: 5, behavior: 'erratic',
    desc: 'A magical seahorse whose body refracts moonlight into tiny rainbows.',
    art: { special: 'seahorse', body: '#9fe3f0', fin: '#6fc0e0' },
  },
  {
    id: 'sunset_mahi', name: 'Sunset Mahi-Mahi', rarity: 'epic', price: 320, minLevel: 5,
    zones: ['ocean'], times: ['evening'], weather: null, size: [70, 150], difficulty: 6, behavior: 'sprinter',
    desc: 'Its scales shift from gold to green as the sun goes down. A true angler’s prize.',
    art: { len: 21, h: 8, body: '#f6b66c', fin: '#7fcf8f', pattern: 'gradient', patternColor: '#7fcf8f', longDorsal: true, dorsal: 3 },
  },
  {
    id: 'starlight_angelfish', name: 'Starlight Angelfish', rarity: 'epic', price: 360,
    zones: ['moon'], times: null, weather: null, size: [15, 30], difficulty: 6, behavior: 'erratic',
    desc: 'Born from a falling star, or so the story goes. It certainly sparkles like one.',
    art: { len: 13, h: 13, body: '#3f4f9f', fin: '#7f8fdf', pattern: 'spots', patternColor: '#fbfbf6', tail: 'fan', dorsal: 4 },
  },
  {
    id: 'moonfin', name: 'Moonfin', rarity: 'legendary', price: 800, minLevel: 8,
    zones: ['moon'], times: ['night'], weather: null, likesBait: 'glow_bait', size: [50, 110], difficulty: 8, behavior: 'trickster',
    desc: 'A legendary, softly glowing fish that appears only under the moon of the bay.',
    art: { len: 20, h: 9, body: '#cfe2ff', fin: '#8fb8ff', pattern: 'band', patternColor: '#ffffff', tail: 'fan', longDorsal: true, dorsal: 3 },
  },
  {
    id: 'sunken_crownfish', name: 'Sunken Crownfish', rarity: 'legendary', price: 650,
    zones: ['ocean', 'reef', 'moon'], times: null, weather: null, bait: 'treasure_lure', size: [30, 60], difficulty: 7, behavior: 'erratic',
    desc: 'Guards a crown lost from a sunken ship. Only a treasure lure catches its eye.',
    art: { len: 16, h: 9, body: '#d9a54b', fin: '#a87a2e', pattern: 'spots', patternColor: '#f8dc7c', crown: true },
  },
  {
    id: 'ancient_sea_turtle', name: 'Ancient Sea Turtle', rarity: 'legendary', price: 0, release: true, weight: 0.35,
    zones: ['ocean', 'reef'], times: null, weather: null, size: [90, 160], difficulty: 4, behavior: 'lazy',
    desc: 'A gentle elder of the sea. You say hello, record the moment, and let it swim free.',
    art: { special: 'turtle', body: '#6f9f6a', fin: '#8fbf7a', patternColor: '#4f7f4a' },
  },
];

export const FISH_BY_ID = Object.fromEntries(FISH.map(f => [f.id, f]));

/** Shiny variant: rare colour morph worth double, tracked in the encyclopedia. */
export const VARIANT = { name: 'Shimmering', chance: 0.025, priceMult: 2 };
