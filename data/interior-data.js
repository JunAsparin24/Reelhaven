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
