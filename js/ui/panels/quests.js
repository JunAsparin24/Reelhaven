import { ensureFavors, completeFavor } from '../../quests.js';
import { RESOURCES, FOOD, BAIT } from '../../../data/item-data.js';
import { addFriendship } from '../../life.js';
// Quests (main story + daily goals + achievements) and Fish Market orders.
import { h, icon, spriteImg, button, progressBar, tabs, refreshSheet, fmt } from '../dom.js';
import { getState } from '../../state.js';
import { questProgress, claimQuest, dailyProgress, claimDaily, fulfillOrder, canFulfill, skipOrder, ensureOrders } from '../../quests.js';
import { ACHIEVEMENTS, MAIN_QUESTS, DAILY_ALL_BONUS } from '../../../data/quest-data.js';
import { NPCS } from '../../../data/npc-data.js';
import { FISH_BY_ID } from '../../../data/fish-data.js';
import { achievementProgress } from '../../progression.js';
import { hasBuilding } from '../../building-count.js';

let tab = 'story';

function rewardView(r) {
  const parts = [];
  if (r.coins) parts.push(h('span.rw', icon('coin'), fmt(r.coins)));
  if (r.pearls) parts.push(h('span.rw', icon('pearl'), r.pearls));
  if (r.xp) parts.push(h('span.rw', icon('xp'), r.xp + ' XP'));
  for (const [id, n] of Object.entries(r.items || {})) {
    const ic = { worm_bait: 'worm', shrimp_bait: 'shrimp', seaglass: 'seaglass', shell: 'shell', stone: 'stone', wood: 'wood' }[id] || 'bag';
    parts.push(h('span.rw', icon(ic), '×' + n));
  }
  return h('div.rewards', parts);
}

export const questsPanel = {
  title: 'Quests', icon: 'quest',
  render(body) {
    const s = getState();
    body.append(tabs([['story', 'Story', 'quest'], ['favors', 'Favors', 'heart'], ['daily', 'Daily', 'sun'], ['achievements', 'Awards', 'trophy']], tab, t => { tab = t; refreshSheet(); }));
    if (tab === 'favors') {
      body.append(h('p.muted', 'Islanders ask you for small favors each day. These are yours alone — friends in your world get their own.'));
      const list = h('div.list');
      ensureFavors().forEach((f, i) => {
        const have = s.inventory.items[f.item] || 0;
        const name = RESOURCES[f.item]?.name || FOOD[f.item]?.name || BAIT[f.item]?.name || f.item;
        list.append(h('div.item-row' + (f.done ? '.claimed' : ''),
          spriteImg('portrait_' + f.npc, 2, 'item-icon'),
          h('div.item-main', h('div.item-name', `${NPCS[f.npc]?.name}: “Could you bring me ${f.n} ${name}?”`), progressBar(Math.min(have, f.n), f.n, have >= f.n ? 'done' : ''), h('div.item-sub', `Reward: ${f.coins} coins and friendship`)),
          f.done ? h('span.tag', 'Done') : button('Give', () => { const r = completeFavor(i); if (r.ok) { addFriendship(f.npc, 60); toast(`${NPCS[f.npc]?.name} thanks you!`, 'heart', 'good'); } refreshSheet(); }, { cls: 'small primary', disabled: have < f.n, sound: null })));
      });
      body.append(list);
      return;
    }
    if (tab === 'story') {
      const qp = questProgress();
      if (!qp) body.append(h('div.empty', icon('trophy', 'big'), h('p', 'You’ve completed every story quest. The islands are yours! Keep collecting fish and decorating.')));
      else {
        const d = qp.def, npc = NPCS[d.giver];
        body.append(h('article.quest-card' + (qp.ready ? '.ready' : ''),
          h('div.quest-giver', spriteImg('portrait_' + d.giver, 3), h('small', npc?.name)),
          h('div.quest-main',
            h('h4', d.title),
            h('p', d.desc),
            progressBar(qp.value, qp.goal, qp.ready ? 'done' : ''),
            h('div.qmeta', h('span', `${qp.value} / ${qp.goal}`), rewardView(d.reward)),
            qp.ready ? button('Claim reward', () => { claimQuest(); refreshSheet(); }, { cls: 'primary', iconName: 'check', sound: null }) : null)));
      }
      body.append(h('div.story-track', MAIN_QUESTS.map((q, i) => h('span.step' + (i < s.quests.index ? '.done' : i === s.quests.index ? '.now' : ''), { title: i <= s.quests.index ? q.title : '???' }))));
      body.append(h('p.muted.center', `Story progress: ${Math.min(s.quests.index, MAIN_QUESTS.length)} / ${MAIN_QUESTS.length}`));
      if (s.member) body.append(h('p.muted.center', 'The story is shared with everyone in this world — when anyone finishes a step, it moves on for all.'));
    } else if (tab === 'daily') {
      body.append(h('p.muted', 'Fresh goals every day (your local date). No streaks, no pressure.'));
      const list = h('div.list');
      s.daily.goals.forEach((g, i) => {
        const v = dailyProgress(g);
        const done = v >= g.count;
        list.append(h('div.item-row.daily' + (g.claimed ? '.claimed' : ''),
          icon(g.claimed ? 'check' : 'sun', 'item-icon'),
          h('div.item-main', h('div.item-name', g.text), progressBar(v, g.count, done ? 'done' : ''), rewardView(g.reward)),
          g.claimed ? h('span.tag', 'Done') : button('Claim', () => { claimDaily(i); refreshSheet(); }, { cls: 'small primary', disabled: !done, sound: null })));
      });
      body.append(list);
      body.append(h('div.bonus-row' + (s.daily.bonusClaimed ? '.done' : ''), icon('pearl'), h('span', 'Complete all three for a bonus: '), rewardView(DAILY_ALL_BONUS)));
    } else {
      const list = h('div.list');
      for (const a of ACHIEVEMENTS) {
        const got = !!s.achievements[a.id];
        const v = achievementProgress(a);
        list.append(h('div.item-row.ach' + (got ? '.got' : ''),
          icon(got ? 'trophy' : 'lock', 'item-icon'),
          h('div.item-main', h('div.item-name', a.name), h('div.item-sub', a.desc), got ? null : progressBar(v, a.goal)),
          rewardView(a.reward)));
      }
      body.append(list);
    }
  },
};

export const ordersPanel = {
  title: 'Fish Market Orders', icon: 'order',
  render(body) {
    const s = getState();
    if (!hasBuilding('fish_market')) { body.append(h('p.muted', 'Build a Fish Market to receive customer orders.')); return; }
    ensureOrders();
    body.append(h('p.muted', 'Customers pay well above market price. New orders arrive every few minutes.'));
    const list = h('div.list');
    if (!s.orders.list.length) {
      const mins = Math.max(1, Math.ceil((s.orders.nextAt - Date.now()) / 60000));
      list.append(h('div.empty', icon('order', 'big'), h('p', `No orders right now. New customers in about ${mins} min.`)));
    }
    for (const o of s.orders.list) {
      const f = FISH_BY_ID[o.fish];
      const have = s.inventory.fish.filter(x => x.id === o.fish).length;
      const ok = canFulfill(o);
      list.append(h('div.item-row.order',
        spriteImg('fish_' + o.fish, 2, 'fish-thumb'),
        h('div.item-main', h('div.item-name', `${o.customer} wants ${o.qty} × ${f.name}`), h('div.item-sub', `You have ${have}`), rewardView({ coins: o.reward, xp: o.xp })),
        h('div.buy-col',
          button('Deliver', () => { fulfillOrder(o.id); refreshSheet(); }, { cls: 'small primary', disabled: !ok, sound: null }),
          button('Skip', () => { skipOrder(o.id); refreshSheet(); }, { cls: 'small ghost' }))));
    }
    body.append(list);
  },
};
