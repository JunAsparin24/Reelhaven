// Nori's shop: rods, bait, materials, decorations, blueprints and hats.
import { h, icon, spriteImg, button, costView, tabs, refreshSheet } from '../dom.js';
import { getState } from '../../state.js';
import { toast } from '../../events.js';
import { purchase, requirement, priceOf, MATERIALS, BLUEPRINTS } from '../../shop.js';
import { RODS, BAIT, HATS, TOOLS, FOOD } from '../../../data/item-data.js';
import { DECOR, BUILDINGS } from '../../../data/building-data.js';
import { rodStatsView } from './inventory.js';

let tab = 'rods';

export const shopPanel = {
  title: 'Nori’s Shop', icon: 'shop',
  render(body, ctx) {
    if (ctx.opts.tab) { tab = ctx.opts.tab; ctx.opts.tab = null; }
    body.append(tabs([['rods', 'Rods', 'rod'], ['bait', 'Bait', 'worm'], ['tools', 'Tools', 'pickaxe'], ['food', 'Food', 'salad'], ['materials', 'Supplies', 'wood'], ['decor', 'Decor', 'flower'], ['blueprints', 'Plans', 'build'], ['hats', 'Hats', 'hat']], tab, t => { tab = t; refreshSheet(); }));
    const list = h('div.list.shop-list');
    const s = getState();
    const have = id => id === 'coins' ? s.player.coins : id === 'pearls' ? s.player.pearls : (s.inventory.items[id] || 0);
    const row = (kind, id, art, name, desc, extra = null) => {
      const req = requirement(kind, id);
      const owned = req === 'Owned';
      const cost = priceOf(kind, id);
      list.append(h('div.item-row.shop-row' + (owned ? '.owned' : req ? '.locked' : ''),
        art,
        h('div.item-main', h('div.item-name', name), h('div.item-sub', desc), extra),
        h('div.buy-col',
          owned ? h('span.tag', 'Owned') : costView(cost, have),
          owned ? null : req ? h('span.req', icon('lock'), req) :
            button('Buy', () => {
              const r = purchase(kind, id);
              toast(r.message, r.ok ? 'check' : null, r.ok ? 'good' : 'error');
              refreshSheet();
            }, { cls: 'small primary', sound: null }))));
    };
    if (tab === 'rods') for (const r of Object.values(RODS)) { if (r.price === 0) continue; row('rod', r.id, icon('rod', 'item-icon'), r.name, r.desc, rodStatsView(r)); }
    if (tab === 'bait') for (const b of Object.values(BAIT)) {
      if (b.id === 'none') continue;
      row('bait', b.id, icon(b.icon, 'item-icon'), `${b.name} ×${b.packSize}`, b.desc, h('div.statline', h('span', 'You have ' + (s.inventory.items[b.id] || 0))));
    }
    if (tab === 'tools') {
      list.append(h('p.muted', 'Upgrade your pickaxe and sword with bars from the furnace. Better tools break rocks faster and hit harder.'));
      for (const [kind, tiers] of Object.entries(TOOLS)) {
        const cur = s.inventory.tools[kind] || 0;
        const next = tiers[cur + 1];
        const stat = t => kind === 'pickaxe' ? `Power ${t.power}` : `Damage ${t.damage}`;
        if (!next) { list.append(h('div.item-row.owned', icon(kind, 'item-icon'), h('div.item-main', h('div.item-name', tiers[cur].name), h('div.item-sub', 'Fully upgraded! ' + stat(tiers[cur]))), h('span.tag', 'Max'))); continue; }
        row('tool', kind, icon(kind, 'item-icon'), `${next.name}`, next.desc, h('div.statline', h('span', `Now: ${tiers[cur].name} (${stat(tiers[cur])})`), h('span.bonus', stat(next))));
      }
    }
    if (tab === 'food') {
      list.append(h('p.muted', 'Food heals you in the mine. Tap it on the hotbar to eat. Grill fish at a furnace or campfire for the best meals.'));
      for (const f of Object.values(FOOD)) { if (!f.price) continue; row('food', f.id, icon(f.icon, 'item-icon'), f.name, f.desc, h('div.statline', h('span', 'You have ' + (s.inventory.items[f.id] || 0)))); }
    }
    if (tab === 'materials') for (const m of Object.values(MATERIALS)) row('material', m.id, icon(m.icon, 'item-icon'), `${m.name} (×${m.qty})`, 'Short on supplies? Gathering is free, but this is faster.');
    if (tab === 'decor') {
      list.append(h('p.muted', 'Decorations bought here go to storage and can be placed for free. You can also buy-and-place directly in Build mode.'));
      for (const d of Object.values(DECOR)) row('decor', d.id, spriteImg(d.id, 1, 'decor-thumb'), d.name, d.desc, h('div.statline', h('span', `In storage: ${s.inventory.storedDecor[d.id] || 0}`)));
    }
    if (tab === 'blueprints') {
      list.append(h('p.muted', 'Some bigger buildings need plans before Rowan can build them.'));
      for (const id of Object.keys(BLUEPRINTS)) row('blueprint', id, spriteImg(id, 1, 'decor-thumb'), BUILDINGS[id].name + ' Blueprint', BUILDINGS[id].desc);
    }
    if (tab === 'hats') {
      list.append(h('p.muted', 'Hats are paid with pearls, earned from achievements, milestones and rare encounters.'));
      for (const hat of Object.values(HATS)) { if (!hat.pearls) continue; row('hat', hat.id, icon('hat', 'item-icon'), hat.name, 'A stylish island look. Change hats from your Profile.'); }
    }
    body.append(list);
  },
};
