// Island definitions. Each island is built by a small, deterministic map
// script (see js/world-gen.js for the builder API) so new islands can be added
// by appending an entry here — the map screen, travel and saving pick it up.
//
// Terrain: W water, S sand, G grass, P path, D dock, B bridge, X broken bridge,
//          O pond/inner water, M mud, K dark grass, N moon grass, R reef water,
//          H wadeable shallows (walkable, splashy footsteps).

export const ISLAND_ORDER = ['sunny', 'coral', 'mangrove', 'moon'];

export const ISLANDS = {
  sunny: {
    id: 'sunny', name: 'Sunny Shores', size: { w: 48, h: 44 },
    tagline: 'Your home island. Gentle waves and friendly faces.',
    features: ['Starter shops', 'Hidden lagoon past the old bridge', 'Freshwater pond'],
    mapPos: { x: 0.24, y: 0.66 },
    theme: { deep: 'deep', near: 'ocean', shallow: 'shallow', pond: 'pond', reef: 'reef', grass: 'grass', sand: 'sand' },
    unlock: null,
    spawn: { x: 22, y: 33 },
    build(m) {
      const { W, S, G, P, D, X, O, H } = m.T;
      m.fill(W);
      m.blob(22, 23, 16, 14, S, 0.1, 1);
      m.blob(22, 22, 13, 11, G, 0.1, 2);
      m.blob(39, 9, 6, 5, S, 0.1, 3);
      m.blob(39, 9, 4.5, 3.5, G, 0.12, 4);
      m.rect(31, 2, 2, 16, W);           // channel separating the grove
      m.rect(27, 10, 4, 4, S);           // west landing
      m.rect(33, 10, 2, 4, S);           // east landing
      m.rect(31, 11, 2, 2, X);           // the broken bridge
      m.blob(13, 28, 3, 2.2, O, 0, 5);   // freshwater pond
      m.blob(32, 36, 3.2, 1.7, H, 0.1, 6); // sandbar shallows you can wade through
      // paths
      m.path([[14, 19], [14, 24], [22, 24]], P, 1);
      m.path([[21, 24], [21, 36]], P, 2);
      m.path([[22, 24], [22, 19], [30, 19], [30, 12]], P, 1);
      m.path([[29, 11], [30, 11]], P, 2);
      m.path([[14, 25], [14, 26]], P, 1);
      // dock
      m.rect(21, 35, 2, 6, D);
      m.rect(18, 40, 7, 2, D);

      m.place('cottage', 12, 17);
      m.obj('shop', 25, 16);
      m.obj('board', 18, 22);
      m.obj('boat', 26, 41);
      m.obj('bridgeSite', 29, 13);
      for (const [x, y] of [[9, 15], [17, 12], [34, 21], [8, 30], [26, 31], [35, 29], [24, 12], [37, 7], [42, 10], [10, 20], [33, 15]]) m.obj('palm', x, y);
      for (const [x, y] of [[31, 35], [9, 34]]) m.obj('driftwood', x, y);
      for (const [x, y] of [[33, 17], [17, 31], [41, 12]]) m.obj('boulder', x, y);
      for (const [x, y] of [[16, 36], [28, 36], [37, 22], [7, 25], [36, 32]]) m.obj('shells', x, y);
      m.obj('seaglass', 44, 9);
      for (const [x, y] of [[18, 29], [27, 22], [38, 11]]) m.obj('flowerbush', x, y);
      for (const [x, y] of [[11, 22], [33, 24], [16, 15], [25, 27], [40, 7]]) m.obj('bush', x, y);
      for (const [x, y] of [[19, 18], [10, 26], [28, 25], [16, 21], [24, 21], [36, 9], [31, 27]]) m.obj('flowers', x, y);
      for (const [x, y] of [[12, 35], [34, 34], [38, 26]]) m.obj('rock', x, y);

      m.spot('dock_end', 'ocean', 21, 41, 'down', 'Dock End');
      m.spot('dock_west', 'ocean', 18, 40, 'left', 'Dock Corner');
      m.spot('east_beach', 'beach', 34, 25, 'right', 'East Beach');
      m.spot('west_beach', 'beach', 10, 22, 'left', 'West Beach');
      m.spot('pond', 'pond', 13, 24, 'down', 'Lily Pond');
      m.spot('lagoon', 'lagoon', 39, 9, 'up', 'Hidden Lagoon');
    },
    npcs: [
      { id: 'mira', x: 23, y: 40 },
      { id: 'nori', x: 27, y: 19 },
      { id: 'rowan', x: 28, y: 14 },
      { id: 'pip', x: 17, y: 26, wander: 3 },
    ],
  },

  coral: {
    id: 'coral', name: 'Pearlreef Atoll', size: { w: 44, h: 40 },
    tagline: 'A crescent of white sand wrapped around a living reef.',
    features: ['Reef fishing (Coral Rod bonus)', 'Tide pools with surprises', 'Plentiful shells and sea glass'],
    mapPos: { x: 0.72, y: 0.7 },
    theme: { deep: 'deep', near: 'ocean', shallow: 'shallow', pond: 'reef', reef: 'reef', grass: 'grass', sand: 'sand' },
    unlock: { level: 3, flag: 'bridgeRepaired', flagText: 'Repair the bridge on Sunny Shores', cost: { coins: 250, wood: 15 }, action: 'Repair Mira’s boat' },
    spawn: { x: 8, y: 18 },
    build(m) {
      const { W, S, G, P, D, R, H } = m.T;
      m.fill(W);
      m.blob(22, 18, 15, 12, S, 0.1, 11);
      m.blob(22, 15, 11, 7, G, 0.12, 12);
      m.blob(22, 29, 8, 6, R, 0.08, 13);
      m.rect(19, 33, 7, 6, R);
      m.blob(10, 27, 2.6, 1.6, H, 0.1, 14);
      m.blob(34, 27, 2.6, 1.6, H, 0.1, 15);
      m.rect(3, 17, 5, 2, D);
      m.rect(22, 23, 1, 5, D);
      m.path([[8, 18], [16, 18], [16, 20], [28, 20]], P, 1);
      m.path([[22, 20], [22, 22]], P, 1);
      for (const [x, y] of [[13, 12], [30, 11], [34, 17], [10, 21], [26, 9], [17, 9]]) m.obj('palm', x, y);
      for (const [x, y] of [[12, 26], [33, 26], [36, 13], [9, 13], [30, 6], [15, 6]]) m.obj('shells', x, y);
      for (const [x, y] of [[29, 24], [16, 24], [37, 20]]) m.obj('seaglass', x, y);
      for (const [x, y] of [[11, 24], [35, 23], [26, 5]]) m.obj('tidepool', x, y);
      for (const [x, y] of [[20, 27], [25, 30], [18, 31], [27, 27], [23, 34]]) m.obj('coral', x, y);
      for (const [x, y] of [[28, 15], [18, 13]]) m.obj('flowerbush', x, y);
      m.obj('boulder', 32, 9);
      for (const [x, y] of [[24, 12], [14, 16], [31, 16], [20, 10]]) m.obj('flowers', x, y);
      m.obj('bush', 25, 16);
      m.obj('boat', 2, 19);
      m.spot('reef_pier', 'reef', 22, 27, 'down', 'Reef Pier');
      m.spot('reef_west', 'reef', 16, 27, 'right', 'Reef Edge');
      m.spot('reef_east', 'reef', 28, 27, 'left', 'Coral Shelf');
      m.spot('north_beach', 'beach', 22, 7, 'up', 'North Beach');
      m.spot('cove_ocean', 'ocean', 36, 18, 'right', 'Open Water');
    },
    npcs: [{ id: 'marlo', x: 24, y: 21, wander: 2 }],
  },

  mangrove: {
    id: 'mangrove', name: 'Misty Mangrove', size: { w: 44, h: 40 },
    tagline: 'Tangled roots, drifting fog, and fish that glow after dark.',
    features: ['Fog that hides secret fishing spots', 'Muddy ground slows you down', 'Rich wood from mangrove trees'],
    mapPos: { x: 0.27, y: 0.2 },
    theme: { deep: 'mistDeep', near: 'mist', shallow: 'mist', pond: 'mist', reef: 'mist', grass: 'darkgrass', sand: 'mud' },
    fog: true,
    unlock: { level: 5, building: 'fishing_hut', buildingText: 'Build a Fishing Hut', cost: { coins: 600, wood: 20, stone: 10 }, action: 'Chart the misty channel' },
    spawn: { x: 6, y: 14 },
    build(m) {
      const { W, D, M, K, H } = m.T;
      m.fill(W);
      m.blob(14, 14, 9, 7, M, 0.15, 21); m.blob(14, 14, 7, 5, K, 0.15, 22);
      m.blob(31, 24, 10, 8, M, 0.15, 23); m.blob(31, 24, 7.5, 5.5, K, 0.15, 24);
      m.blob(14, 31, 7, 5, M, 0.15, 25); m.blob(14, 31, 4.5, 3, K, 0.15, 26);
      m.rect(2, 14, 4, 2, D);
      m.path([[22, 15], [25, 15], [25, 18]], D, 2);
      m.rect(13, 20, 2, 7, D);
      m.blob(23, 30, 2.4, 1.8, H, 0.15, 27);
      for (const [x, y] of [[10, 10], [18, 11], [28, 20], [35, 22], [31, 28], [12, 29], [16, 16]]) m.obj('mangrove', x, y);
      for (const [x, y] of [[8, 17], [20, 13], [37, 27], [25, 25], [17, 33]]) m.obj('reeds', x, y);
      for (const [x, y] of [[21, 20], [6, 22], [38, 16], [24, 32], [8, 36]]) m.obj('lily', x, y);
      for (const [x, y] of [[33, 19], [10, 33]]) m.obj('boulder', x, y);
      for (const [x, y] of [[26, 28], [7, 12]]) m.obj('driftwood', x, y);
      m.obj('flowerbush', 34, 25);
      m.obj('stump', 15, 9);
      m.obj('boat', 1, 16);
      m.spot('root_pool', 'mangrove', 14, 18, 'down', 'Root Pool');
      m.spot('boardwalk', 'mangrove', 25, 17, 'right', 'Boardwalk');
      m.spot('east_bank', 'mangrove', 38, 24, 'right', 'Misty Bank');
      m.spot('secret', 'mangrove', 14, 34, 'down', 'Secret Hollow', { hidden: true, luck: 0.35 });
    },
    npcs: [{ id: 'wren', x: 30, y: 23, wander: 2 }],
  },

  moon: {
    id: 'moon', name: 'Moonlit Bay', size: { w: 40, h: 36 },
    tagline: 'Where it is always night and the water glows.',
    features: ['Eternal night and glowing tides', 'Moon crystals', 'Tougher fish, richer rewards'],
    mapPos: { x: 0.74, y: 0.22 },
    theme: { deep: 'moonDeep', near: 'moon', shallow: 'moon', pond: 'moon', reef: 'moon', grass: 'moongrass', sand: 'sand' },
    alwaysNight: true,
    fishingMod: { difficulty: 1, luck: 0.3 },
    unlock: { level: 6, building: 'lighthouse', buildingText: 'Build the Lighthouse', cost: { coins: 1000, seaglass: 8 }, action: 'Follow the lighthouse beam' },
    spawn: { x: 9, y: 18 },
    build(m) {
      const { W, S, D, N, O, P } = m.T;
      m.fill(W);
      m.blob(21, 18, 13, 11, S, 0.1, 31);
      m.blob(21, 17, 10, 8, N, 0.12, 32);
      m.blob(23, 17, 3.5, 2.5, O, 0, 33);
      m.rect(4, 18, 5, 2, D);
      m.path([[9, 18], [18, 18]], P, 1);
      for (const [x, y] of [[16, 11], [28, 13], [27, 23], [14, 22], [31, 19]]) m.obj('crystal', x, y);
      for (const [x, y] of [[12, 13], [30, 10], [24, 26], [11, 23]]) m.obj('palm', x, y);
      for (const [x, y] of [[19, 13], [26, 21], [15, 16]]) m.obj('flowers', x, y);
      m.obj('boulder', 20, 25);
      m.obj('boat', 3, 20);
      m.spot('moon_pool', 'moon', 23, 14, 'down', 'Moon Pool');
      m.spot('star_point', 'moon', 33, 17, 'right', 'Star Point');
      m.spot('north_tide', 'moon', 21, 8, 'up', 'Silver Tide');
    },
    npcs: [{ id: 'luna', x: 18, y: 19, wander: 1 }],
  },
};
