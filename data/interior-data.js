// Indoor rooms. Each is a tiny map built with the same builder as islands
// (see js/world-gen.js). Terrain: I wooden floor, L wall / outside the room.
// The bottom row's opening is the door: stepping onto `exit` leads back out.
//
// `solid` rects block walking without changing the floor art (e.g. the space
// behind Nori's counter). Rooms share the island's theme fields so the
// renderer has everything it expects.

const THEME = { deep: 'deep', near: 'ocean', shallow: 'shallow', pond: 'pond', reef: 'reef', grass: 'grass', sand: 'sand' };

export const INTERIORS = {
  shop_interior: {
    id: 'shop_interior', name: 'Nori’s Shop', interior: true, theme: THEME,
    size: { w: 12, h: 10 },
    spawn: { x: 6, y: 8 },
    exit: { x: 5, y: 9, w: 2 },
    // behind the counter (Nori's side) — not walkable for customers
    solid: [{ x: 1, y: 2, w: 10, h: 2 }],
    build(m) {
      const { I, L } = m.T;
      m.fill(L);
      m.rect(1, 2, 10, 7, I);
      m.rect(5, 9, 2, 1, I);            // doorway
      m.obj('shelf', 1, 2); m.obj('shelf_b', 3, 2);
      m.obj('shelf_b', 7, 2); m.obj('shelf', 9, 2);
      m.obj('counter', 1, 4);
      m.obj('rug', 4, 6);
      m.obj('barrel', 1, 6); m.obj('crate', 1, 7);
      m.obj('fish_tank', 9, 6);
      m.obj('plant', 10, 8);
      m.obj('doormat', 5, 9);
    },
    npcs: [{ id: 'nori', x: 6, y: 3 }],
  },

  cottage_interior: {
    id: 'cottage_interior', name: 'Cozy Cottage', interior: true, theme: THEME,
    size: { w: 10, h: 9 },
    spawn: { x: 5, y: 7 },
    exit: { x: 4, y: 8, w: 2 },
    build(m) {
      const { I, L } = m.T;
      m.fill(L);
      m.rect(1, 2, 8, 6, I);
      m.rect(4, 8, 2, 1, I);            // doorway
      m.obj('bed', 1, 2);
      m.obj('nightstand', 3, 2);
      m.obj('fireplace', 5, 2);
      m.obj('bookshelf', 7, 2);
      m.obj('rug', 3, 4);
      m.obj('table', 6, 5);
      m.obj('plant', 1, 7);
      m.obj('tv', 1, 5);
      m.obj('kitchen', 7, 4);            // appears after the kitchen upgrade
      m.obj('gift_box', 7, 6);
      m.obj('doormat', 4, 8);
    },
    npcs: [],
  },

  // The Wayfarers' Hall by the Old Mine: Bram sells swords and keeps track of
  // the monsters you've defeated.
  hall_interior: {
    id: 'hall_interior', name: 'Wayfarers’ Hall', interior: true, theme: THEME,
    size: { w: 12, h: 10 },
    spawn: { x: 6, y: 8 },
    exit: { x: 5, y: 9, w: 2 },
    solid: [{ x: 1, y: 2, w: 10, h: 2 }],
    build(m) {
      const { I, L } = m.T;
      m.fill(L);
      m.rect(1, 2, 10, 7, I);
      m.rect(5, 9, 2, 1, I);
      m.obj('weapon_rack', 1, 2); m.obj('weapon_rack', 3, 2);
      m.obj('weapon_rack', 7, 2); m.obj('weapon_rack', 9, 2);
      m.obj('hall_counter', 1, 4);
      m.obj('rug', 4, 6);
      m.obj('barrel', 1, 7); m.obj('crate', 10, 7);
      m.obj('fireplace', 9, 5);
      m.obj('doormat', 5, 9);
    },
    npcs: [{ id: 'bram', x: 6, y: 3 }],
  },

  // Animals live here (js/life.js). Put hay in the trough every day.
  coop_interior: {
    id: 'coop_interior', name: 'Coop', interior: true, theme: THEME,
    size: { w: 10, h: 8 },
    spawn: { x: 4, y: 6 },
    exit: { x: 4, y: 7, w: 2 },
    build(m) {
      const { I, L } = m.T;
      m.fill(L);
      m.rect(1, 2, 8, 5, I);
      m.rect(4, 7, 2, 1, I);
      m.obj('feed_trough', 1, 2);
      m.obj('animal_board', 8, 2);
      m.obj('crate', 8, 6);
      m.obj('doormat', 4, 7);
    },
    npcs: [],
  },
  big_coop_interior: {
    id: 'big_coop_interior', name: 'Big Coop', interior: true, theme: THEME,
    size: { w: 14, h: 9 },
    spawn: { x: 6, y: 7 },
    exit: { x: 6, y: 8, w: 2 },
    build(m) {
      const { I, L } = m.T;
      m.fill(L);
      m.rect(1, 2, 12, 6, I);
      m.rect(6, 8, 2, 1, I);
      m.obj('feed_trough', 1, 2); m.obj('feed_trough', 3, 2);
      m.obj('animal_board', 12, 2);
      m.obj('hay_pile', 9, 2);
      m.obj('crate', 12, 7);
      m.obj('doormat', 6, 8);
    },
    npcs: [],
  },
  big_barn_interior: {
    id: 'big_barn_interior', name: 'Big Barn', interior: true, theme: THEME,
    size: { w: 16, h: 10 },
    spawn: { x: 8, y: 8 },
    exit: { x: 7, y: 9, w: 2 },
    build(m) {
      const { I, L } = m.T;
      m.fill(L);
      m.rect(1, 2, 14, 7, I);
      m.rect(7, 9, 2, 1, I);
      m.obj('feed_trough', 1, 2); m.obj('feed_trough', 3, 2); m.obj('feed_trough', 5, 2);
      m.obj('animal_board', 14, 2);
      m.obj('hay_pile', 11, 2);
      m.obj('barrel', 14, 8);
      m.obj('doormat', 7, 9);
    },
    npcs: [],
  },
  // After the kitchen upgrade: a bigger cottage with a kitchen and a second room.
  cottage_big_interior: {
    id: 'cottage_big_interior', name: 'Cozy Cottage', interior: true, theme: THEME,
    size: { w: 16, h: 10 },
    spawn: { x: 7, y: 8 },
    exit: { x: 6, y: 9, w: 2 },
    solid: [{ x: 10, y: 2, w: 1, h: 4 }],
    build(m) {
      const { I, L } = m.T;
      m.fill(L);
      m.rect(1, 2, 14, 7, I);
      m.rect(6, 9, 2, 1, I);
      // bedroom on the right, behind a little wall
      m.rect(10, 2, 1, 4, L);
      m.obj('bed', 12, 2); m.obj('nightstand', 14, 2); m.obj('bookshelf', 11, 6);
      // living room
      m.obj('fireplace', 5, 2); m.obj('rug', 4, 5); m.obj('tv', 1, 5); m.obj('plant', 1, 8);
      // kitchen corner
      m.obj('kitchen', 1, 2); m.obj('table', 7, 6);
      m.obj('gift_box', 9, 7);
      m.obj('doormat', 6, 9);
    },
    npcs: [],
  },
  barn_interior: {
    id: 'barn_interior', name: 'Barn', interior: true, theme: THEME,
    size: { w: 12, h: 9 },
    spawn: { x: 6, y: 7 },
    exit: { x: 5, y: 8, w: 2 },
    build(m) {
      const { I, L } = m.T;
      m.fill(L);
      m.rect(1, 2, 10, 6, I);
      m.rect(5, 8, 2, 1, I);
      m.obj('feed_trough', 1, 2); m.obj('feed_trough', 3, 2);
      m.obj('animal_board', 10, 2);
      m.obj('barrel', 10, 7);
      m.obj('doormat', 5, 8);
    },
    npcs: [],
  },
  // An empty room you furnish yourself (Build menu works in here).
  shed_interior: {
    id: 'shed_interior', name: 'Shed', interior: true, theme: THEME, buildInside: true,
    size: { w: 12, h: 9 },
    spawn: { x: 6, y: 7 },
    exit: { x: 5, y: 8, w: 2 },
    build(m) {
      const { I, L } = m.T;
      m.fill(L);
      m.rect(1, 2, 10, 6, I);
      m.rect(5, 8, 2, 1, I);
      m.obj('doormat', 5, 8);
    },
    npcs: [],
  },
  // The island museum: donated fish and gems go on display.
  museum_interior: {
    id: 'museum_interior', name: 'Museum', interior: true, theme: THEME,
    size: { w: 14, h: 10 },
    spawn: { x: 7, y: 8 },
    exit: { x: 6, y: 9, w: 2 },
    build(m) {
      const { I, L } = m.T;
      m.fill(L);
      m.rect(1, 2, 12, 7, I);
      m.rect(6, 9, 2, 1, I);
      let k = 0;
      for (const y of [2, 5]) for (const x of [2, 4, 6, 8, 10]) m.obj('display_case', x, y, { showIdx: k++ });
      for (const x of [1, 12]) for (const y of [3, 6]) m.obj('display_case', x, y, { showIdx: k++ });
      m.obj('museum_desk', 6, 7);
      m.obj('plant', 1, 8); m.obj('plant', 12, 8);
      m.obj('doormat', 6, 9);
    },
    npcs: [],
  },

  // Each friend who joins your game gets one of these in your yard.
  cabin_interior: {
    id: 'cabin_interior', name: 'Guest Cabin', interior: true, theme: THEME,
    size: { w: 8, h: 8 },
    spawn: { x: 4, y: 6 },
    exit: { x: 3, y: 7, w: 2 },
    build(m) {
      const { I, L } = m.T;
      m.fill(L);
      m.rect(1, 2, 6, 5, I);
      m.rect(3, 7, 2, 1, I);
      m.obj('bed', 1, 2);
      m.obj('nightstand', 3, 2);
      m.obj('bookshelf', 5, 2);
      m.obj('plant', 6, 6);
      m.obj('doormat', 3, 7);
    },
    npcs: [],
  },
};
