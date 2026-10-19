// Build catalogue: choose a building or decoration, then place it on the
// island with a live preview (handled by BuildUI + BuildMode).
import { h, icon, spriteImg, button, costView, tabs, refreshSheet } from '../dom.js';
import { getState } from '../../state.js';
import { BUILDINGS, DECOR } from '../../../data/building-data.js';
import { buildBlocker } from '../../building.js';
import { fullCost, checkCost } from '../../economy.js';

let tab = 'buildings';

export const buildPanel = {
  title: 'Build', icon: 'build',
  render(body, ctx) {
    const s = getState();
    const have = id => id === 'coins' ? s.player.coins : id === 'pearls' ? s.player.pearls : (s.inventory.items[id] || 0);
    body.append(tabs([['buildings', 'Buildings', 'home'], ['decor', 'Decor', 'flower'], ['stored', 'Stored', 'bag']], tab, t => { tab = t; refreshSheet(); }));
    body.append(button('Move or store what you’ve built', () => ctx.ui.buildUI.edit(), { cls: 'ghost wide', iconName: 'move' }));
    const list = h('div.build-grid');
    if (tab === 'buildings' || tab === 'decor') {
      const defs = Object.values(tab === 'buildings' ? BUILDINGS : DECOR).filter(d => d.buildable !== false);
      for (const d of defs) {
        const block = buildBlocker(d.id);
        const cost = fullCost(d);
        const afford = checkCost(cost).ok;
        list.append(h('button.build-card' + (block ? '.locked' : afford ? '' : '.poor'), {
          type: 'button',
          on: { click: () => block ? null : ctx.ui.buildUI.place(d.id) },
          disabled: !!block,
          'aria-label': d.name,
        },
        h('div.build-art', spriteImg(d.id === 'crop_garden' ? 'crop_garden_3' : d.id, d.kind === 'building' ? 1 : 2)),
        h('div.build-name', d.name),
        h('div.build-desc', d.desc),
        block ? h('span.req', icon('lock'), block) : costView(cost, have),
        h('div.fp', `${d.footprint.w}×${d.footprint.h} tiles`)));
      }
    } else {
      const stored = Object.entries(s.inventory.storedDecor).filter(([, n]) => n > 0);
      if (!stored.length) list.append(h('p.muted', 'Nothing in storage. Store decorations in Edit mode, or buy them at Nori’s shop.'));
      for (const [id, n] of stored) {
        list.append(h('button.build-card', { type: 'button', on: { click: () => ctx.ui.buildUI.place(id, true) } },
          h('div.build-art', spriteImg(id, 2)),
          h('div.build-name', DECOR[id].name),
          h('div.build-desc', `${n} in storage — free to place`)));
      }
    }
    body.append(list);
  },
};
