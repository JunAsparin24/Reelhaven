// Island-life panels: Crafting, Island Life (skills, people, mail), the
// Restoration Board and the Museum. The rules live in js/life.js.
import { h, icon, spriteImg, button, tabs, refreshSheet, progressBar, costView } from '../dom.js';
import { getState, commit } from '../../state.js';
import { toast } from '../../events.js';
import { sfx } from '../../audio.js';
import { checkCost, spend, addItem, describeMissing } from '../../economy.js';
import { hasRoomFor, slotInfo, ownedKeys } from '../../bag.js';
import {
  knowsRecipe, learnText, skillLevel, hearts, friendOf, tasteOf, unreadMail, takeAttachment, bundleState, bundleProgress, donateToBundle,
  payBundleCoins, canDonate, donateToMuseum, museumKey,
} from '../../life.js';
import { SKILLS, SKILL_XP, MAX_SKILL, CRAFT_RECIPES, TASTES, MAX_HEARTS, BUNDLES, MUSEUM_GEMS, MUSEUM_REWARDS, HEART_REWARDS } from '../../../data/life-data.js';
import { RESOURCES, FOOD, BAIT } from '../../../data/item-data.js';
import { PLACEABLES } from '../../../data/building-data.js';
import { NPCS } from '../../../data/npc-data.js';
import { FISH, FISH_BY_ID } from '../../../data/fish-data.js';

const itemName = id => RESOURCES[id]?.name || FOOD[id]?.name || BAIT[id]?.name || PLACEABLES[id]?.name || id;
const itemIcon = id => RESOURCES[id]?.icon || FOOD[id]?.icon || BAIT[id]?.icon || 'bag';
const have = id => (id === 'coins' ? getState().player.coins : getState().inventory.items[id] || 0);

/** Art for a bag key (fish use their sprite). */
function keyArt(key) {
  const info = slotInfo(key);
  return info?.sprite ? spriteImg(info.sprite, 1, 'px-icon item-icon') : icon(info?.icon || 'bag', 'item-icon');
}

// ---------------------------------------------------------------- crafting
function recipeLocked(r) {
  return knowsRecipe(r.id) ? null : learnText(r);
}

/** How many of a recipe you could make right now. */
export function craftable(r) {
  let n = Infinity;
  for (const [id, need] of Object.entries(r.in)) n = Math.min(n, Math.floor(have(id) / need));
  return n === Infinity ? 0 : n;
}

export function craft(r, times = 1) {
  if (recipeLocked(r)) return { ok: false, message: `You haven’t learned that yet (${recipeLocked(r)}).` };
  times = Math.max(1, Math.min(times, craftable(r)));
  const total = Object.fromEntries(Object.entries(r.in).map(([id, n]) => [id, n * times]));
  const c = checkCost(total);
  if (!c.ok) return { ok: false, message: 'Not enough: ' + describeMissing(c.missing) + '.' };
  if (r.item && !Object.keys(r.item).every(id => hasRoomFor(id))) return { ok: false, message: 'Your bag is full! Make room first.' };
  spend(total);
  const s = getState();
  if (r.place) s.inventory.storedDecor[r.place] = (s.inventory.storedDecor[r.place] || 0) + (r.count || 1) * times;
  for (const [id, n] of Object.entries(r.item || {})) addItem(id, n * times);
  s.stats.crafted = (s.stats.crafted || 0) + times;
  sfx('build');
  commit('craft');
  const what = times > 1 ? `${times}× ${r.name}` : r.name;
  return { ok: true, message: r.place ? `Crafted ${what}! Place it from Build → Stored.` : `Crafted ${what}!` };
}

let craftFilter = 'known';

export const craftPanel = {
  title: 'Crafting', icon: 'craft',
  render(body) {
    const s = getState();
    const known = CRAFT_RECIPES.filter(r => knowsRecipe(r.id));
    body.append(tabs([['known', `Recipes (${known.length})`, 'craft'], ['locked', 'Not learned', 'lock']], craftFilter, t => { craftFilter = t; refreshSheet(); }));
    body.append(h('p.muted', craftFilter === 'known'
      ? 'Crafting uses up the ingredients. Machines, chests and decorations go to Build → Stored so you can place them.'
      : 'Learn more recipes by levelling skills, making friends, finishing story quests, or buying them at Nori’s shop.'));
    const list = h('div.list.shop-list');
    for (const r of CRAFT_RECIPES.filter(r => (craftFilter === 'known') === knowsRecipe(r.id))) {
      const lock = recipeLocked(r);
      const n = lock ? 0 : craftable(r);
      const out = r.place || Object.keys(r.item || {})[0];
      const art = PLACEABLES[out] ? spriteImg(out, 1, 'decor-thumb') : icon(itemIcon(out), 'item-icon');
      const needs = h('div.needs', Object.entries(r.in).map(([id, k]) => h('span.need' + (have(id) >= k ? '.ok' : '.short'), icon(itemIcon(id)), `${itemName(id)} ${Math.min(have(id), 9999)}/${k}`)));
      const go = t => () => { const res = craft(r, t); toast(res.message, res.ok ? 'craft' : null, res.ok ? 'good' : 'error'); refreshSheet(); };
      list.append(h('div.item-row.shop-row.recipe' + (lock ? '.locked' : ''),
        art,
        h('div.item-main', h('div.item-name', r.name, !lock && n ? h('span.count', ` can make ${n}`) : null), h('div.item-sub', r.desc), needs),
        h('div.buy-col',
          lock ? h('span.req', icon('lock'), lock) : [
            button('Craft', go(1), { cls: 'small' + (n ? ' primary' : ''), disabled: !n, sound: null }),
            n >= 5 ? button('×5', go(5), { cls: 'small', sound: null }) : null,
            n > 1 ? button(`All (${Math.min(n, 99)})`, go(Math.min(n, 99)), { cls: 'small ghost', sound: null }) : null])));
    }
    if (!list.children.length) list.append(h('p.muted', craftFilter === 'known' ? 'No recipes yet.' : 'You know every recipe!'));
    body.append(list);
  },
};

// ---------------------------------------------------------------- island life
let lifeTab = 'skills';

export const lifePanel = {
  title: 'Island Life', icon: 'people',
  render(body, ctx) {
    if (ctx.opts?.tab) { lifeTab = ctx.opts.tab; ctx.opts.tab = null; }
    const unread = unreadMail();
    body.append(tabs([['skills', 'Skills', 'skills'], ['people', 'People', 'heart'], ['mail', unread ? `Mail (${unread})` : 'Mail', 'mail']], lifeTab, t => { lifeTab = t; refreshSheet(); }));
    if (lifeTab === 'skills') renderSkills(body);
    else if (lifeTab === 'people') renderPeople(body);
    else renderMail(body);
  },
};

function renderSkills(body) {
  const s = getState();
  const p = s.player;
  body.append(h('div.energy-line', icon('bolt'), h('span', `Energy ${Math.ceil(p.energy ?? 100)}/${p.maxEnergy || 100}`), h('span.muted', ' — tools and casting use energy. Eat or sleep to refill.')));
  const list = h('div.list');
  for (const [id, d] of Object.entries(SKILLS)) {
    const sk = s.skills?.[id] || { xp: 0, level: 0 };
    const maxed = sk.level >= MAX_SKILL;
    const lo = SKILL_XP[sk.level], hi = SKILL_XP[Math.min(MAX_SKILL, sk.level + 1)];
    list.append(h('div.item-row',
      icon(d.icon, 'item-icon'),
      h('div.item-main',
        h('div.item-name', d.name, h('span.count', ` Lv ${sk.level}`)),
        h('div.item-sub', d.perk),
        maxed ? h('div.item-sub', 'Mastered!') : progressBar(sk.xp - lo, hi - lo))));
  }
  body.append(list);
}

function renderPeople(body) {
  const s = getState();
  body.append(h('p.muted', 'Talk to islanders every day and give them a gift (hold it and right click / tap them). Gifts they love count most.'));
  const list = h('div.list');
  for (const [id, n] of Object.entries(NPCS)) {
    if (!TASTES[id]) continue;
    const f = friendOf(id), hh = hearts(id);
    const known = k => (TASTES[id][k] || []).map(x => x === 'fish:*' ? 'any fish' : FISH_BY_ID[x]?.name || itemName(x));
    const next = Object.keys(HEART_REWARDS[id] || {}).map(Number).find(x => x > hh);
    list.append(h('div.item-row',
      icon('people', 'item-icon'),
      h('div.item-main',
        h('div.item-name', n.name, h('span.hearts', ' ' + '♥'.repeat(hh) + '♡'.repeat(MAX_HEARTS - hh))),
        h('div.item-sub', `Loves: ${known('love').join(', ')}`),
        hh >= 2 ? h('div.item-sub', `Likes: ${known('like').join(', ')}`) : h('div.item-sub.muted', 'Become friends to learn more about what they like.'),
        h('div.item-sub', [f.talked === s.world.day ? 'Talked today' : 'Not talked today', f.gifted === s.world.day ? 'Gift given' : 'Gift ready'].join(' · ') + (next ? ` · a surprise at ${next}♥` : '')))));
  }
  body.append(list);
}

function renderMail(body) {
  const s = getState();
  if (!s.mail.length) { body.append(h('p.muted', 'No letters yet. Check your mailbox by the cottage each morning.')); return; }
  const list = h('div.list');
  for (const m of s.mail) {
    const a = m.attach || {};
    const hasGift = !m.taken && (a.coins || a.pearls || a.decor || a.rod || a.sword !== undefined || Object.keys(a.items || {}).length);
    list.append(h('div.item-row.letter' + (m.read ? '' : '.unread'),
      icon('mail', 'item-icon'),
      h('div.item-main',
        h('div.item-name', m.subject),
        h('div.item-sub', `From ${m.from} · Day ${m.day}`),
        h('p.letter-body', m.body)),
      hasGift ? button('Take', () => {
        m.read = true;
        const got = takeAttachment(m);
        if (got.length) toast('Got ' + got.join(', ') + '!', 'gift', 'good');
        refreshSheet();
      }, { cls: 'small primary' }) : null));
    m.read = true;
  }
  commit('mailRead', false);
  body.append(list);
}

// ---------------------------------------------------------------- restoration board
export const restorePanel = {
  title: 'Island Restoration', icon: 'build',
  render(body) {
    body.append(h('p.muted', 'The islanders are fixing up the town. Donate what each project needs — everything you give is used up.'));
    const s = getState();
    const list = h('div.list');
    for (const b of BUNDLES) {
      const st = bundleState(b.id), pr = bundleProgress(b);
      const parts = [];
      for (const [id, n] of Object.entries(b.items || {})) {
        const got = st.items[id] || 0, mine = have(id);
        parts.push(h('div.bundle-need' + (got >= n ? '.done' : ''), icon(itemIcon(id)), h('span', `${itemName(id)} ${got}/${n}`),
          got < n ? button(mine ? `Give (${mine})` : 'None', () => { donateToBundle(b, id); refreshSheet(); }, { cls: 'small', disabled: !mine, sound: null }) : icon('check')));
      }
      if (b.fish) {
        const fishKeys = [...new Set(s.inventory.fish.map(f => f.id))].filter(id => !st.fish.includes(id));
        parts.push(h('div.bundle-need' + (st.fish.length >= b.fish ? '.done' : ''), icon('fish'), h('span', `Different fish ${st.fish.length}/${b.fish}`),
          st.fish.length < b.fish ? h('span.fish-picks', fishKeys.slice(0, 6).map(id => button(FISH_BY_ID[id]?.name || id, () => { donateToBundle(b, 'fish:' + id); refreshSheet(); }, { cls: 'small', sound: null }))) : icon('check')));
        if (!fishKeys.length && st.fish.length < b.fish) parts.push(h('p.muted', 'Bring fish you haven’t donated yet.'));
      }
      if (b.coins && !st.done) parts.push(h('div.bundle-need', icon('coin'), h('span', `${b.coins} coins`),
        button('Pay', () => { if (pr.have < pr.need) { toast('Donate the items first.', 'build'); return; } if (!payBundleCoins(b)) toast('Not enough coins.', 'coin', 'error'); refreshSheet(); }, { cls: 'small', disabled: s.player.coins < b.coins, sound: null })));
      list.append(h('div.item-row.bundle' + (st.done ? '.owned' : ''),
        icon(st.done ? 'trophy' : 'build', 'item-icon'),
        h('div.item-main',
          h('div.item-name', b.name, st.done ? h('span.tag', 'Done!') : null),
          h('div.item-sub', 'Reward: ' + b.reward),
          st.done ? null : progressBar(pr.have, pr.need),
          st.done ? null : h('div.bundle-needs', parts))));
    }
    body.append(list);
  },
};

// ---------------------------------------------------------------- museum
export const museumPanel = {
  title: 'Island Museum', icon: 'museum',
  render(body) {
    const s = getState();
    const m = s.museum;
    const total = FISH.length + MUSEUM_GEMS.length;
    body.append(h('p.muted', `Pip looks after the collection. Donate one of each fish and gem. ${m.donated.length}/${total} donated.`));
    body.append(progressBar(m.donated.length, total));
    const next = MUSEUM_REWARDS.find(r => !m.rewards.includes(r.at));
    if (next) body.append(h('p.muted', `Next reward at ${next.at} donations.`));
    const can = ownedKeys(s).filter(k => !k.startsWith('tool:') && k !== 'rod' && canDonate(k));
    body.append(h('h4.section', 'From your bag'));
    if (!can.length) body.append(h('p.muted', 'Nothing new to donate right now. Catch new fish or find gems in the Old Mine.'));
    else body.append(h('div.list', can.map(k => h('div.item-row.compact', keyArt(k), h('div.item-main', h('div.item-name', slotInfo(k).name)),
      button('Donate', () => { const r = donateToMuseum(k); toast(r.message, 'museum', r.ok ? 'good' : 'error'); refreshSheet(); }, { cls: 'small primary', sound: null })))));
    body.append(h('h4.section', 'On display'));
    body.append(h('div.museum-grid', m.donated.map(id => h('div.museum-item', { title: FISH_BY_ID[id]?.name || itemName(id) },
      FISH_BY_ID[id] ? spriteImg('fish_' + id, 1, 'px-icon') : icon(itemIcon(id)), h('span', FISH_BY_ID[id]?.name || itemName(id))))));
  },
};

export { museumKey };
