// The Wayfarers' Hall: Bram's swords (unlocked by how deep you've been in
// the Old Mine) and monster bounties.
import { h, icon, button, costView, tabs, refreshSheet, progressBar } from '../dom.js';
import { getState, commit } from '../../state.js';
import { toast } from '../../events.js';
import { purchase, requirement, priceOf } from '../../shop.js';
import { SWORDS, SLAYER_GOALS } from '../../../data/weapon-data.js';
import { MONSTERS } from '../../../data/mine-data.js';
import { grantItems } from '../../economy.js';
import { sfx } from '../../audio.js';

let tab = 'swords';

export const hallPanel = {
  title: 'Wayfarers’ Hall', icon: 'sword',
  render(body) {
    const s = getState();
    body.append(tabs([['swords', 'Swords', 'sword'], ['bounties', 'Bounties', 'trophy']], tab, t => { tab = t; refreshSheet(); }));
    if (tab === 'swords') renderSwords(body, s);
    else renderBounties(body, s);
  },
};

function renderSwords(body, s) {
  const cur = s.inventory.tools.sword;
  const deep = s.stats.mineDeepest || 0;
  body.append(h('p.muted', `Deepest mine floor: ${deep}. Bram stocks better blades as you go deeper.${cur === undefined ? ' First, get a starter sword from Nori in town.' : ''}`));
  const have = id => id === 'coins' ? s.player.coins : id === 'pearls' ? s.player.pearls : (s.inventory.items[id] || 0);
  const list = h('div.list.shop-list');
  SWORDS.forEach((sw, tier) => {
    const owned = cur !== undefined && tier <= cur;
    const inHand = owned && tier === cur;
    const req = tier === 0 ? null : requirement('sword', String(tier));
    list.append(h('div.item-row.shop-row' + (owned ? '.owned' : req ? '.locked' : ''),
      icon('sword', 'item-icon'),
      h('div.item-main', h('div.item-name', sw.name), h('div.item-sub', sw.desc), h('div.statline', h('span', `Damage ${sw.damage}`), sw.floor ? h('span', `Unlocks at floor ${sw.floor}`) : null)),
      h('div.buy-col',
        inHand ? h('span.tag', 'Your blade') : owned ? h('span.tag', 'Outgrown') : tier === 0 ? h('span.tag', 'From Nori') :
          req ? h('span.req', icon('lock'), req) :
            [costView(priceOf('sword', String(tier)), have), button('Buy', () => {
              const r = purchase('sword', String(tier));
              toast(r.message, r.ok ? 'sword' : null, r.ok ? 'gold' : 'error');
              refreshSheet();
            }, { cls: 'small primary', sound: null })])));
  });
  body.append(list);
}

function renderBounties(body, s) {
  const kills = s.stats.kills || {};
  const claimed = s.flags.slayerClaimed || [];
  body.append(h('p.muted', 'Defeat monsters in the Old Mine and claim the Hall’s bounty.'));
  const list = h('div.list');
  for (const g of SLAYER_GOALS) {
    const n = Math.min(g.count, kills[g.monster] || 0);
    const done = claimed.includes(g.id);
    const ready = !done && n >= g.count;
    const rw = g.reward;
    const rewardText = [rw.coins ? `${rw.coins} coins` : null, rw.pearls ? `${rw.pearls} pearls` : null, ...Object.entries(rw.items || {}).map(([id, k]) => `${k}× ${id.replace(/_/g, ' ')}`)].filter(Boolean).join(', ');
    list.append(h('div.item-row' + (done ? '.owned' : ''),
      icon('trophy', 'item-icon'),
      h('div.item-main', h('div.item-name', g.name), h('div.item-sub', `Defeat ${g.count} ${MONSTERS[g.monster].name}s · reward: ${rewardText}`), progressBar(n, g.count, ready ? 'done' : '')),
      done ? h('span.tag', 'Claimed') : button(ready ? 'Claim' : `${n}/${g.count}`, () => {
        if (!ready) return;
        s.flags.slayerClaimed = [...claimed, g.id];
        grantItems(rw);
        sfx('quest');
        toast(`Bounty claimed: ${g.name}!`, 'trophy', 'gold');
        commit('bounty');
        refreshSheet();
      }, { cls: 'small' + (ready ? ' primary' : ' ghost'), disabled: !ready, sound: null })));
  }
  body.append(list);
}
