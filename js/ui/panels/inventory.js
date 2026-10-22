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
import { buildFullPreview } from '../../art/characters.js';
import { scaleUp } from '../../art/pixel.js';
import { seasonOf } from '../../../data/farm-data.js';

let tab = 'bag';
const selected = new Set();
let pickedSlot = -1;     // slot tapped in the bag grid (tap another to swap)

export const inventoryPanel = {
  title: 'Bag', icon: 'bag', wide: true, center: true,
  render(body, ctx) {
    if (ctx.opts.tab) { tab = ['fish', 'items'].includes(ctx.opts.tab) ? 'bag' : ctx.opts.tab; ctx.opts.tab = null; }
    body.append(tabs([['bag', 'Bag', 'bag'], ['gear', 'Gear', 'rod']], tab, t => { tab = t; refreshSheet(); }));
    if (tab === 'bag') renderBag(body);
    else renderGear(body, ctx);
  },
  onClose() { selected.clear(); pickedSlot = -1; hideTip(); },
};

/**
 * The bag, like a farming game's inventory: a grid of slots (the top row is
 * your hotbar) and your character card below. Hover an item for its details;
 * drag to move it; tap it for quick actions.
 */
function renderBag(body) {
  const s = getState();
  const overflow = syncBag(s);
  const slots = s.inventory.slots;
  if (pickedSlot >= slots.length) pickedSlot = -1;
  const slotEl = i => {
    const key = slots[i], info = slotInfo(key, s);
    return h('div.bag-slot' + (i < ROW ? '.hot' : '') + (i === pickedSlot ? '.picked' : '') + (info ? '' : '.empty') + (info && heldFor(key) === s.inventory.held ? '.held' : ''), {
      'data-i': String(i), role: 'gridcell', tabindex: '0', 'aria-label': info ? `${info.name}${info.count != null ? ' ×' + info.count : ''}` : 'Empty slot',
    },
    i < ROW ? h('span.key', HOTKEYS[i]) : null,
    info ? (info.sprite ? spriteImg(info.sprite, 1, 'px-icon') : icon(info.icon)) : null,
    info?.count != null && info.kind !== 'tool' ? h('span.cnt', String(info.count)) : info?.kind === 'tool' && info.id === 'watering_can' ? h('span.cnt', String(info.count)) : null);
  };
  const grid = h('div.bag-grid.inv');
  for (let i = 0; i < slots.length; i++) { grid.append(slotEl(i)); if (i === ROW - 1 && slots.length > ROW) grid.append(h('div.bag-divider')); }
  const wrap = h('div.bag-wrap', grid);
  body.append(wrap);
  wireDrag(wrap, slots);
  wireTips(wrap, slots);
  const info = pickedSlot >= 0 ? slotInfo(slots[pickedSlot], s) : null;
  if (info) body.append(slotDetails(info));
  if (overflow.length) {
    body.append(h('p.warn-note', `${overflow.length} thing${overflow.length > 1 ? 's don’t' : ' doesn’t'} fit: `, overflow.map(k => slotInfo(k, s).name).join(', '), '. Free a slot to pick ', overflow.length > 1 ? 'them' : 'it', ' up.'));
  }
  body.append(characterCard(s));
}

/** Portrait, name, world, money and the date — under the bag. */
function characterCard(s) {
  const p = s.player, sn = seasonOf(s.world.day);
  const portrait = h('img.inv-portrait', { src: scaleUp(buildFullPreview(p.look), 4).toDataURL(), alt: '' });
  return h('div.inv-card',
    h('div.inv-who', h('div.inv-frame', portrait), h('b', p.name)),
    h('div.inv-facts',
      h('div.inv-world', s.worldName || personalNameOf(s)),
      h('div', icon('coin'), ` Current funds: ${fmt(p.coins)}`),
      h('div', icon('trophy'), ` Total earnings: ${fmt(s.stats.coinsFromSales || 0)}`),
      h('div', icon('pearl'), ` Pearls: ${fmt(p.pearls)}`),
      h('div', icon('sun'), ` Day ${sn.day} of ${sn.name}, Year ${sn.year}`)));
}
const personalNameOf = s => (s.member ? `${s.member.ownerName}’s world` : 'My Island');

// ---------------------------------------------------------------- hover tooltips
let tipEl = null;
function hideTip() { tipEl?.remove(); tipEl = null; }
function tipFor(info) {
  const lines = [];
  if (info.kind === 'tool') lines.push('Tool');
  else if (info.kind === 'rod') lines.push('Fishing rod');
  else if (info.kind === 'fish') lines.push(`${info.rarity} fish`);
  else if (info.kind === 'food') lines.push('Food');
  else if (info.kind === 'seed') lines.push('Seeds');
  else if (info.kind === 'bait') lines.push('Bait');
  const extra = [];
  if (info.kind === 'food') { const f = FOOD[info.id]; if (f.energy) extra.push(`+${f.energy} Energy`); if (f.heal) extra.push(`+${f.heal} Health`); }
  if (info.kind === 'tool' && info.id === 'watering_can') extra.push(`Water: ${info.count}`);
  if (info.kind === 'item' && RESOURCE_SELL[info.id]) extra.push(`Sells for ${RESOURCE_SELL[info.id]} each`);
  if (info.kind === 'fish') { const st = fishStacks().find(x => x.key === info.id + (info.variant ? '*' : '')); if (st) extra.push(`Worth ${fmt(st.value)} (${st.entries.length})`); }
  return h('div.inv-tip',
    h('b', info.name + (info.count != null && info.kind !== 'tool' ? ` ×${info.count}` : '')),
    lines.length ? h('small.tip-kind', lines[0]) : null,
    info.desc ? h('p', info.desc) : null,
    extra.length ? h('div.tip-extra', extra.map(x => h('span', x))) : null);
}
function wireTips(root, slots) {
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!fine) return;
  root.addEventListener('pointermove', e => {
    const el = e.target.closest('.bag-slot');
    const key = el && slots[Number(el.dataset.i)];
    if (!key || root.querySelector('.dragging')) { hideTip(); return; }
    const info = slotInfo(key, getState());
    if (!tipEl || tipEl.dataset.key !== key) { hideTip(); tipEl = tipFor(info); tipEl.dataset.key = key; document.body.append(tipEl); }
    const w = tipEl.offsetWidth, hgt = tipEl.offsetHeight;
    tipEl.style.left = Math.min(innerWidth - w - 8, e.clientX + 16) + 'px';
    tipEl.style.top = Math.min(innerHeight - hgt - 8, e.clientY + 18) + 'px';
  });
  root.addEventListener('pointerleave', hideTip);
}

/** Drag and drop between slots (mouse and touch). A tap without moving selects. */
function wireDrag(root, slots) {
  let drag = null;
  root.addEventListener('pointerdown', e => {
    const el = e.target.closest('.bag-slot');
    if (!el || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag = { i: Number(el.dataset.i), x: e.clientX, y: e.clientY, el, id: e.pointerId, moving: false, ghost: null };
    el.setPointerCapture?.(e.pointerId);
  });
  root.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moving && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6 && slots[drag.i]) {
      drag.moving = true;
      const art = drag.el.querySelector('.px-icon');
      drag.ghost = h('div.bag-ghost', art ? art.cloneNode(true) : null);
      document.body.append(drag.ghost);
      drag.el.classList.add('dragging');
      hideTip();
    }
    if (drag.moving) {
      e.preventDefault();
      drag.ghost.style.left = e.clientX + 'px'; drag.ghost.style.top = e.clientY + 'px';
      const over = document.elementFromPoint(e.clientX, e.clientY)?.closest('.bag-slot');
      root.querySelectorAll('.bag-slot.over').forEach(x => x !== over && x.classList.remove('over'));
      over?.classList.add('over');
    }
  });
  const end = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    d.ghost?.remove();
    if (d.moving) {
      const over = document.elementFromPoint(e.clientX, e.clientY)?.closest('.bag-slot');
      const j = over ? Number(over.dataset.i) : -1;
      if (j >= 0 && j !== d.i) { swapSlots(d.i, j); commit('bag', false); pickedSlot = j; }
    } else pickedSlot = pickedSlot === d.i || !slots[d.i] ? -1 : d.i;
    refreshSheet();
  };
  root.addEventListener('pointerup', end);
  root.addEventListener('pointercancel', e => { if (drag && e.pointerId === drag.id) { drag.ghost?.remove(); drag = null; refreshSheet(); } });
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
    tl.append(h('div.item-row', icon(`${kind}_t${s.inventory.tools[kind] || 0}`, 'item-icon'), h('div.item-main', h('div.item-name', t.name), h('div.item-sub', t.desc),
      h('div.statline', h('span', kind === 'sword' ? `Damage ${t.damage}` : kind === 'watering_can' ? `Water ${s.inventory.water ?? 0}/${t.capacity || 40}` : `Power ${t.power}`))),
      s.inventory.held === kind ? h('span.tag', 'In hand') : button('Hold', () => { s.inventory.held = kind; commit('held'); refreshSheet(); }, { cls: 'small' })));
  }
  body.append(tl);
  body.append(h('h4.section', 'Fishing Rods'));
  const list = h('div.list');
  for (const id of s.inventory.rods) {
    const r = RODS[id];
    const eq = s.inventory.equippedRod === id;
    list.append(h('div.item-row' + (eq ? '.equipped' : ''),
      icon('rod_' + id, 'item-icon'),
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
