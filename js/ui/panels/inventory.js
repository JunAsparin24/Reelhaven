// Bag: fish (select & sell in batches), items/resources, and gear.
import { h, icon, spriteImg, button, fmt, tabs, progressBar, refreshSheet, confirmModal } from '../dom.js';
import { getState, commit } from '../../state.js';
import { toast } from '../../events.js';
import { fishStacks, sellFish, sellAllFish, capacity, fishCount, sellResource } from '../../inventory.js';
import { FISH_BY_ID, VARIANT } from '../../../data/fish-data.js';
import { RODS, BAIT, RESOURCES, RESOURCE_SELL, FOOD, TOOLS } from '../../../data/item-data.js';
import { eat } from '../../combat.js';
import { DECOR } from '../../../data/building-data.js';
import { RARITY_COLORS } from '../../art/palette.js';
import { countBuilt } from '../../building-count.js';
import { ROW, syncBag, slotInfo, swapSlots, heldFor } from '../../bag.js';
import { HOTKEYS } from '../hotbar.js';

let tab = 'bag';
const selected = new Set();
let pickedSlot = -1;     // slot tapped in the bag grid (tap another to swap)

export const inventoryPanel = {
  title: 'Bag', icon: 'bag', wide: true,
  render(body, ctx) {
    if (ctx.opts.tab) { tab = ['fish', 'items'].includes(ctx.opts.tab) ? 'bag' : ctx.opts.tab; ctx.opts.tab = null; }
    body.append(tabs([['bag', 'Bag', 'bag'], ['gear', 'Gear', 'rod']], tab, t => { tab = t; refreshSheet(); }));
    if (tab === 'bag') renderBag(body);
    else renderGear(body, ctx);
  },
  onClose() { selected.clear(); pickedSlot = -1; },
};

/** Stardew-style grid: 12 slots per row; the first row is your hotbar. */
function renderBag(body) {
  const s = getState();
  const overflow = syncBag(s);
  const slots = s.inventory.slots;
  const used = slots.filter(Boolean).length;
  if (pickedSlot >= slots.length) pickedSlot = -1;
  body.append(h('div.cap-row', h('span', `Bag ${used}/${slots.length} slots`), progressBar(used, slots.length, used >= slots.length ? 'full' : ''),
    h('span.hint', 'Top row = hotbar. Tap an item, then another slot to move it.')));
  const grid = h('div.bag-grid', { role: 'grid' });
  slots.forEach((key, i) => {
    const info = slotInfo(key, s);
    const cls = 'button.bag-slot' + (i < ROW ? '.hot' : '') + (i === pickedSlot ? '.picked' : '') + (info ? '' : '.empty');
    grid.append(h(cls, {
      type: 'button', 'aria-label': info ? info.name : 'Empty slot',
      on: { click: () => {
        if (pickedSlot >= 0 && pickedSlot !== i) { swapSlots(pickedSlot, i); pickedSlot = -1; commit('bag', false); }
        else pickedSlot = pickedSlot === i || !info ? -1 : i;
        refreshSheet();
      } },
    },
    i < ROW ? h('span.key', HOTKEYS[i]) : null,
    info ? (info.sprite ? spriteImg(info.sprite, 1, 'px-icon') : icon(info.icon)) : null,
    info?.count != null ? h('span.cnt', String(info.count)) : null));
  });
  body.append(grid);
  // details + actions for the picked slot
  const info = pickedSlot >= 0 ? slotInfo(slots[pickedSlot], s) : null;
  if (info) body.append(slotDetails(info));
  else body.append(h('p.muted.bag-hint', 'Tap an item to see what it is and what you can do with it.'));
  if (overflow.length) {
    body.append(h('h4.section', 'Doesn’t fit — make room'));
    const ol = h('div.list');
    for (const key of overflow) {
      const o = slotInfo(key, s);
      ol.append(h('div.item-row', o.sprite ? spriteImg(o.sprite, 2, 'fish-thumb') : icon(o.icon, 'item-icon'),
        h('div.item-main', h('div.item-name', o.name, o.count != null ? h('span.count', '×' + o.count) : null), h('div.item-sub', 'Free a slot to carry this.')),
        sellButton(o)));
    }
    body.append(ol);
  }
  // quick sell-all for fish
  const stacks = fishStacks();
  if (stacks.length) {
    const total = stacks.reduce((a, st) => a + st.value, 0);
    body.append(h('div.sticky-actions',
      countBuilt('fish_market') ? h('span.hint', '+15% Fish Market bonus') : null,
      button(`Sell all fish (${fmt(total)})`, () => {
        const hasRare = stacks.some(st => ['epic', 'legendary'].includes(FISH_BY_ID[st.id].rarity) || st.variant);
        const go = () => { const earned = sellAllFish(); toast(`Sold every fish for ${fmt(earned)} coins!`, 'coin', 'good'); refreshSheet(); };
        if (hasRare) confirmModal('Sell every fish?', 'Your bag includes some very rare fish. Sell them all anyway?', 'Sell all', go);
        else go();
      }, { iconName: 'coin', sound: null })));
  }
}

function sellButton(info) {
  if (info.kind === 'fish') {
    const st = fishStacks().find(x => x.key === info.id + (info.variant ? '*' : ''));
    if (!st) return null;
    return button(`Sell ${st.entries.length} · ${fmt(st.value)}`, () => { const c = sellFish(st.entries.map(e => e.uid)); if (c) toast(`Sold for ${fmt(c)} coins!`, 'coin', 'good'); pickedSlot = -1; refreshSheet(); }, { cls: 'small', sound: null });
  }
  if (RESOURCE_SELL[info.id] && info.count > 0) return button(`Sell 1 · ${RESOURCE_SELL[info.id]}`, () => { sellResource(info.id, 1); refreshSheet(); }, { cls: 'small ghost', sound: null });
  return null;
}

function slotDetails(info) {
  const s = getState();
  const acts = [];
  const hold = () => { s.inventory.held = heldFor(info.key); commit('held'); refreshSheet(); };
  if (info.kind === 'tool' || info.kind === 'rod' || info.kind === 'seed') {
    acts.push(heldFor(info.key) === s.inventory.held ? h('span.tag', 'In hand') : button('Hold', hold, { cls: 'small primary' }));
  }
  if (info.kind === 'food') acts.push(button(`Eat (+${FOOD[info.id].heal} HP)`, () => { const r = eat(null, info.id); toast(r.message, 'heart', r.ok ? 'good' : 'info'); refreshSheet(); }, { cls: 'small primary', sound: null }));
  if (info.kind === 'bait') {
    const on = s.inventory.equippedBait === info.id;
    acts.push(button(on ? 'Take off hook' : 'Use as bait', () => { s.inventory.equippedBait = on ? 'none' : info.id; commit('bait'); refreshSheet(); }, { cls: 'small' + (on ? '' : ' primary') }));
  }
  const sb = sellButton(info);
  if (sb) acts.push(sb);
  if (info.kind === 'item' && RESOURCE_SELL[info.id] && info.count > 1) acts.push(button(`Sell all · ${fmt(RESOURCE_SELL[info.id] * info.count)}`, () => { sellResource(info.id, info.count); pickedSlot = -1; refreshSheet(); }, { cls: 'small ghost', sound: null }));
  const sub = info.kind === 'fish' ? `${info.rarity} fish` : info.kind === 'tool' ? 'Tool' : info.kind === 'seed' ? 'Seeds — hold them and Use on tilled soil' : info.desc;
  return h('div.slot-details',
    info.sprite ? spriteImg(info.sprite, 2, 'fish-thumb') : icon(info.icon, 'item-icon'),
    h('div.item-main', h('div.item-name', info.name, info.count != null ? h('span.count', '×' + info.count) : null), h('div.item-sub', sub), info.kind !== 'item' && info.desc && info.desc !== sub ? h('div.item-sub', info.desc) : null),
    h('div.slot-actions', ...acts));
}

function renderFish(body) {
  const stacks = fishStacks();
  const keys = new Set(stacks.map(s => s.key));
  for (const k of [...selected]) if (!keys.has(k)) selected.delete(k);
  const cap = capacity(), n = fishCount();
  body.append(h('div.cap-row', h('span', `Bag space ${n}/${cap}`), progressBar(n, cap, n >= cap ? 'full' : ''),
    countBuilt('fish_market') ? h('span.hint', '+15% Fish Market bonus') : null));
  if (!stacks.length) {
    body.append(h('div.empty', icon('fish', 'big'), h('p', 'No fish yet! Head to a dock or beach and tap Fish.')));
    return;
  }
  const selValue = stacks.filter(s => selected.has(s.key)).reduce((a, s) => a + s.value, 0);
  const total = stacks.reduce((a, s) => a + s.value, 0);
  const list = h('div.list');
  for (const st of stacks) {
    const f = FISH_BY_ID[st.id];
    const on = selected.has(st.key);
    const biggest = Math.max(...st.entries.map(e => e.size));
    list.append(h('button.item-row.selectable' + (on ? '.on' : ''), {
      type: 'button', 'aria-pressed': on ? 'true' : 'false',
      on: { click: () => { on ? selected.delete(st.key) : selected.add(st.key); refreshSheet(); } },
    },
    h('span.check', on ? icon('check') : null),
    spriteImg((st.variant ? 'fishvar_' : 'fish_') + st.id, 2, 'fish-thumb'),
    h('div.item-main',
      h('div.item-name', (st.variant ? VARIANT.name + ' ' : '') + f.name, h('span.count', '×' + st.entries.length)),
      h('div.item-sub', h('span.rarity-dot', { style: { background: RARITY_COLORS[f.rarity] } }), f.rarity, ' · best ', biggest + ' cm')),
    h('div.item-value', icon('coin'), fmt(st.value))));
  }
  body.append(list);
  body.append(h('div.sticky-actions',
    button(selected.size ? `Sell selected (${fmt(selValue)})` : 'Select fish to sell', () => {
      const uids = stacks.filter(s => selected.has(s.key)).flatMap(s => s.entries.map(e => e.uid));
      const earned = sellFish(uids);
      selected.clear();
      if (earned) toast(`Sold for ${fmt(earned)} coins!`, 'coin', 'good');
      refreshSheet();
    }, { cls: 'primary', iconName: 'sell', disabled: !selected.size, sound: null }),
    button(`Sell all (${fmt(total)})`, () => {
      const hasRare = stacks.some(s => ['epic', 'legendary'].includes(FISH_BY_ID[s.id].rarity) || s.variant);
      const go = () => { const earned = sellAllFish(); selected.clear(); toast(`Sold everything for ${fmt(earned)} coins!`, 'coin', 'good'); refreshSheet(); };
      if (hasRare) confirmModal('Sell everything?', 'Your bag includes some very rare fish. Sell them all anyway?', 'Sell all', go);
      else go();
    }, { iconName: 'coin', sound: null })));
}

function renderItems(body) {
  const s = getState();
  const items = s.inventory.items;
  const res = Object.values(RESOURCES).filter(r => (items[r.id] || 0) > 0 || ['wood', 'stone', 'shell', 'seaglass', 'flower'].includes(r.id));
  const foods = Object.values(FOOD).filter(f => (items[f.id] || 0) > 0);
  if (foods.length) {
    body.append(h('h4.section', `Food · ${Math.ceil(s.player.hp)}/${s.player.maxHp} HP`));
    const fl = h('div.list');
    for (const f of foods) fl.append(h('div.item-row', icon(f.icon, 'item-icon'),
      h('div.item-main', h('div.item-name', f.name, h('span.count', '×' + items[f.id])), h('div.item-sub', f.desc)),
      button('Eat', () => { const r = eat(null, f.id); toast(r.message, 'heart', r.ok ? 'good' : 'info'); refreshSheet(); }, { cls: 'small', sound: null })));
    body.append(fl);
  }
  body.append(h('h4.section', 'Materials'));
  const grid = h('div.list');
  for (const r of res) {
    const n = items[r.id] || 0;
    grid.append(h('div.item-row',
      icon(r.icon, 'item-icon'),
      h('div.item-main', h('div.item-name', r.name, h('span.count', '×' + n)), h('div.item-sub', r.desc)),
      n > 0 ? button(`Sell 1 · ${RESOURCE_SELL[r.id]}`, () => { sellResource(r.id, 1); refreshSheet(); }, { cls: 'small ghost', sound: null }) : null));
  }
  body.append(grid);
  body.append(h('h4.section', 'Bait'));
  const bl = h('div.list');
  let anyBait = false;
  for (const b of Object.values(BAIT)) {
    if (b.id === 'none') continue;
    const n = items[b.id] || 0;
    if (!n) continue;
    anyBait = true;
    const eq = s.inventory.equippedBait === b.id;
    bl.append(h('div.item-row' + (eq ? '.equipped' : ''),
      icon(b.icon, 'item-icon'),
      h('div.item-main', h('div.item-name', b.name, h('span.count', '×' + n)), h('div.item-sub', b.desc)),
      eq ? h('span.tag', 'Equipped') : button('Use', () => { s.inventory.equippedBait = b.id; commit('bait'); refreshSheet(); }, { cls: 'small' })));
  }
  if (!anyBait) bl.append(h('p.muted', 'No bait. Buy some at Nori’s shop — fish bite much faster!'));
  else if (s.inventory.equippedBait !== 'none') bl.append(button('Fish without bait', () => { s.inventory.equippedBait = 'none'; commit('bait'); refreshSheet(); }, { cls: 'ghost small' }));
  body.append(bl);
}

function renderGear(body, ctx) {
  const s = getState();
  body.append(h('h4.section', 'Tools'));
  const tl = h('div.list');
  for (const [kind, tiers] of Object.entries(TOOLS)) {
    if (s.inventory.tools[kind] === undefined) continue;
    const t = tiers[s.inventory.tools[kind] || 0];
    tl.append(h('div.item-row', icon(kind, 'item-icon'), h('div.item-main', h('div.item-name', t.name), h('div.item-sub', t.desc),
      h('div.statline', h('span', kind === 'sword' ? `Damage ${t.damage}` : kind === 'watering_can' ? `Water ${s.inventory.water ?? 0}/40` : `Power ${t.power}`))),
      s.inventory.held === kind ? h('span.tag', 'In hand') : button('Hold', () => { s.inventory.held = kind; commit('held'); refreshSheet(); }, { cls: 'small' })));
  }
  body.append(tl);
  body.append(h('h4.section', 'Fishing Rods'));
  const list = h('div.list');
  for (const id of s.inventory.rods) {
    const r = RODS[id];
    const eq = s.inventory.equippedRod === id;
    list.append(h('div.item-row' + (eq ? '.equipped' : ''),
      icon('rod', 'item-icon'),
      h('div.item-main', h('div.item-name', r.name), h('div.item-sub', r.desc), rodStatsView(r)),
      eq ? h('span.tag', 'Equipped') : button('Equip', () => { s.inventory.equippedRod = id; commit('rod'); refreshSheet(); }, { cls: 'small' })));
  }
  body.append(list);
  const stored = Object.entries(s.inventory.storedDecor).filter(([, n]) => n > 0);
  body.append(h('h4.section', 'Stored decorations'));
  if (!stored.length) body.append(h('p.muted', 'Decorations you store or buy from the shop appear here.'));
  else {
    const dl = h('div.list');
    for (const [id, n] of stored) {
      dl.append(h('div.item-row', spriteImg(id, 1, 'decor-thumb'),
        h('div.item-main', h('div.item-name', DECOR[id].name, h('span.count', '×' + n))),
        button('Place', () => ctx.ui.buildUI.place(id, true), { cls: 'small', iconName: 'build' })));
    }
    body.append(dl);
  }
}

export function rodStatsView(r) {
  const pct = v => Math.round(v * 100);
  return h('div.statline',
    h('span', 'Zone ' + pct(r.zone) + '%'),
    h('span', 'Reel ×' + r.power.toFixed(2)),
    h('span', 'Bite ' + r.biteWindow.toFixed(2) + 's'),
    r.luck ? h('span', 'Luck +' + pct(r.luck) + '%') : null,
    r.bonus ? h('span.bonus', r.bonus.zones ? 'Reef bonus' : 'Night bonus') : null);
}
