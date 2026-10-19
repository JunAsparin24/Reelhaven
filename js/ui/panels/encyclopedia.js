// Fish encyclopedia: every species, discovered or a mysterious silhouette.
import { h, icon, spriteImg, button, modal, progressBar } from '../dom.js';
import { getState } from '../../state.js';
import { FISH, VARIANT, RARITIES } from '../../../data/fish-data.js';
import { COLLECTION_MILESTONES } from '../../../data/quest-data.js';
import { RARITY_COLORS } from '../../art/palette.js';
import { habitatText } from '../../fish.js';
import { collectionPct, speciesDiscovered } from '../../progression.js';

let filter = 'all';

export const encyclopediaPanel = {
  title: 'Fish Encyclopedia', icon: 'fish', wide: true,
  render(body) {
    const s = getState();
    const found = speciesDiscovered();
    const pct = collectionPct();
    body.append(h('div.ency-head',
      h('div.ency-pct', h('b', pct + '%'), h('span', `${found} of ${FISH.length} species`)),
      progressBar(found, FISH.length, 'ency'),
      h('div.milestones', COLLECTION_MILESTONES.map(m => h('span.ms' + (s.milestones.includes(m.pct) ? '.done' : ''), { title: `Reward at ${m.pct}%` }, m.pct + '%')))));
    body.append(h('div.filters', ['all', ...RARITIES].map(r =>
      h('button.filter' + (filter === r ? '.on' : ''), { type: 'button', on: { click: () => { filter = r; body.replaceChildren(); encyclopediaPanel.render(body); } } },
        r === 'all' ? 'All' : r[0].toUpperCase() + r.slice(1)))));
    const grid = h('div.ency-grid');
    for (const f of FISH) {
      if (filter !== 'all' && f.rarity !== filter) continue;
      const rec = s.collection[f.id];
      grid.append(h('button.ency-card' + (rec ? '' : '.locked'), {
        type: 'button', style: { '--rc': RARITY_COLORS[f.rarity] },
        'aria-label': rec ? f.name : 'Undiscovered fish',
        on: { click: () => details(f, rec) },
      },
      spriteImg((rec ? 'fish_' : 'fishsil_') + f.id, 3),
      h('span.ency-name', rec ? f.name : '???'),
      h('span.ency-rar', f.rarity),
      rec?.variant ? h('span.ency-var', { title: VARIANT.name + ' variant found' }, icon('sparkle')) : null));
    }
    body.append(grid);
  },
};

function details(f, rec) {
  let close;
  close = modal(h('div.fish-detail',
    h('div.catch-art', spriteImg((rec ? 'fish_' : 'fishsil_') + f.id, 5)),
    h('h3', rec ? f.name : 'Undiscovered'),
    h('div.badges', h('span.rarity', { style: { background: RARITY_COLORS[f.rarity] } }, f.rarity)),
    h('p.desc', rec ? f.desc : 'A mysterious fish nobody on these islands has recorded yet.'),
    h('dl.facts',
      h('dt', 'Where & when'), h('dd', habitatText(f)),
      rec ? [h('dt', 'Caught'), h('dd', rec.count + (rec.count === 1 ? ' time' : ' times')),
        h('dt', 'Largest'), h('dd', rec.maxSize + ' cm'),
        h('dt', 'Base value'), h('dd', f.release ? 'Released (gives pearls)' : f.price + ' coins'),
        rec.variant ? [h('dt', 'Variant'), h('dd', VARIANT.name + ' seen!')] : null] : null),
    h('div.row.center', button('Close', () => close(), { cls: 'primary' }))));
}
