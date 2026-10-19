// Build-mode toolbar shown while placing or editing. The catalogue itself is
// the "build" sheet panel (panels/build.js).
import { h, icon, button, costView, closeSheet } from './dom.js';
import { on, toast } from '../events.js';
import { getState } from '../state.js';
import { PLACEABLES } from '../../data/building-data.js';
import { reasonText } from '../building.js';

export class BuildUI {
  constructor(ui) {
    this.ui = ui;
    this.root = document.getElementById('build-bar');
    on('build:update', () => this.render());
  }

  get mode() { return this.ui.game.build; }

  /** Enter build mode to place `type` (called from the build catalogue). */
  place(type, fromStore = false) {
    closeSheet(true);
    const b = this.mode;
    b.open();
    b.begin(type, fromStore);
    this.ui.app.classList.add('building');
    this.render();
  }

  /** Enter edit mode (tap existing items to move/store). */
  edit() {
    closeSheet(true);
    this.mode.open();
    this.ui.app.classList.add('building');
    this.render();
    toast('Tap something you built to move or store it.', 'move');
  }

  exit() {
    this.mode.close();
    this.ui.app.classList.remove('building');
    this.root.classList.remove('show');
  }

  render() {
    const b = this.mode;
    this.ui.app.classList.toggle('building', b.active);
    if (!b.active) { this.root.classList.remove('show'); return; }
    this.root.classList.add('show');
    const s = getState();
    const have = id => id === 'coins' ? s.player.coins : id === 'pearls' ? s.player.pearls : (s.inventory.items[id] || 0);
    if (b.type) {
      const def = PLACEABLES[b.type];
      const g = b.ghost;
      const cost = b.cost();
      this.root.replaceChildren(
        h('div.build-info',
          h('b', b.moving ? `Moving ${def.name}` : def.name),
          Object.keys(cost).length ? costView(cost, have) : h('span.free', b.moving ? 'Free to move' : 'From storage'),
          h('span.build-status' + (g?.ok ? '.ok' : '.bad'), g?.ok ? 'Looks good here!' : reasonText(g?.reasons))),
        h('div.build-hint', 'Drag on the island or use arrow keys to move. Tap a tile to jump there.'),
        h('div.build-actions',
          button('Cancel', () => b.cancelPlacement(), { cls: 'ghost', iconName: 'close' }),
          def.rotations ? button('Rotate', () => b.rotate(), { iconName: 'rotate' }) : null,
          button(b.moving ? 'Move here' : 'Place', () => {
            const r = b.confirm();
            toast(r.message, r.ok ? 'build' : null, r.ok ? 'good' : 'error');
          }, { cls: 'primary', iconName: 'check', disabled: !g?.ok, sound: null })));
    } else if (b.selected) {
      const p = b.selected;
      const def = p.def;
      this.root.replaceChildren(
        h('div.build-info', h('b', def.name), h('span', def.kind === 'building' ? 'Building' : 'Decoration')),
        h('div.build-actions',
          button('Back', () => { b.selected = null; this.render(); }, { cls: 'ghost' }),
          button('Move', () => b.startMove(p), { iconName: 'move' }),
          def.kind === 'decor' ? button('Store', () => { const r = b.store(p); toast(r.message, 'bag'); }, { iconName: 'bag' }) : null));
    } else {
      this.root.replaceChildren(
        h('div.build-info', icon('build'), h('b', 'Edit mode'), h('span', 'Tap anything you built to move it.')),
        h('div.build-actions',
          button('Catalogue', () => this.ui.open('build'), { iconName: 'shop' }),
          button('Done', () => this.exit(), { cls: 'primary', iconName: 'check' })));
    }
  }
}
