// Hotbar: your tools (rod, pickaxe, sword) plus food and bait, one tap (or
// number key) away. Tools become the held item; food is eaten right away;
// bait is equipped for fishing. A health bar sits above it when it matters.
import { h, icon } from './dom.js';
import { getState, commit } from '../state.js';
import { toast } from '../events.js';
import { FOOD, BAIT, RODS } from '../../data/item-data.js';
import { toolTier, eat } from '../combat.js';
import { sfx } from '../audio.js';

const MAX_SLOTS = 8;

export class Hotbar {
  constructor(ui) {
    this.ui = ui;
    this.root = h('div#hotbar.hud-region', { role: 'toolbar', 'aria-label': 'Hotbar' });
    this.hpFill = h('div.fill');
    this.hpText = h('span.hp-text');
    this.hp = h('div.hp-bar.hud-glass', { title: 'Health' }, icon('heart'), h('div.bar.hp', this.hpFill), this.hpText);
    this.slotsEl = h('div.slots');
    this.root.append(this.hp, this.slotsEl);
    document.getElementById('hud').append(this.root);
    this.slots = [];
  }

  /** Slot list from the current inventory. */
  build() {
    const s = getState();
    const items = s.inventory.items;
    const out = [
      { kind: 'tool', id: 'rod', icon: 'rod', name: RODS[s.inventory.equippedRod]?.name || 'Fishing Rod' },
      { kind: 'tool', id: 'pickaxe', icon: 'pickaxe', name: toolTier('pickaxe').name },
      { kind: 'tool', id: 'sword', icon: 'sword', name: toolTier('sword').name },
    ];
    for (const f of Object.values(FOOD)) if (items[f.id] > 0) out.push({ kind: 'food', id: f.id, icon: f.icon, name: f.name, count: items[f.id] });
    for (const b of Object.values(BAIT)) if (b.id !== 'none' && items[b.id] > 0) out.push({ kind: 'bait', id: b.id, icon: b.icon, name: b.name, count: items[b.id] });
    return out.slice(0, MAX_SLOTS);
  }

  render() {
    const s = getState();
    if (!s) return;
    this.slots = this.build();
    const kb = matchMedia('(hover: hover) and (pointer: fine)').matches;
    const nodes = this.slots.map((sl, i) => {
      const held = sl.kind === 'tool' && s.inventory.held === sl.id;
      const equipped = sl.kind === 'bait' && s.inventory.equippedBait === sl.id;
      return h('button.slot' + (held ? '.held' : '') + (equipped ? '.equipped' : ''), {
        type: 'button', title: sl.name + (sl.kind === 'food' ? ' (tap to eat)' : sl.kind === 'bait' ? ' (tap to use as bait)' : ''),
        'aria-label': sl.name, 'aria-pressed': held || equipped ? 'true' : 'false',
        on: { click: e => { e.stopPropagation(); this.pick(i); } },
      }, icon(sl.icon), sl.count ? h('span.cnt', String(sl.count)) : null, kb ? h('span.key', String(i + 1)) : null);
    });
    this.slotsEl.replaceChildren(...nodes);
    this.renderHp();
  }

  renderHp() {
    const s = getState();
    if (!s) return;
    const p = s.player;
    const show = this.ui.game.world?.def.mine || p.hp < p.maxHp;
    this.hp.hidden = !show;
    this.hpFill.style.width = Math.max(0, (p.hp / p.maxHp) * 100) + '%';
    this.hpFill.parentElement.classList.toggle('low', p.hp / p.maxHp < 0.3);
    this.hpText.textContent = `${Math.ceil(p.hp)}/${p.maxHp}`;
  }

  /** Use a slot (from a tap or a number key). Returns true if a slot existed. */
  pick(i) {
    const sl = this.slots[i];
    if (!sl) return false;
    const s = getState();
    if (sl.kind === 'tool') {
      s.inventory.held = sl.id;
      sfx('click');
      commit('held', false);
    } else if (sl.kind === 'food') {
      const r = eat(this.ui.game, sl.id);
      if (!r.ok) toast(r.message, 'heart');
    } else if (sl.kind === 'bait') {
      s.inventory.equippedBait = s.inventory.equippedBait === sl.id ? 'none' : sl.id;
      toast(s.inventory.equippedBait === 'none' ? 'Fishing without bait.' : `${sl.name} on the hook.`, sl.icon);
      commit('bait');
    }
    this.render();
    return true;
  }
}
