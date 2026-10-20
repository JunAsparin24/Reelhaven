// Hotbar: the first row (12 slots) of your bag, like Stardew's toolbar.
// Tap a slot or press 1–9, 0, -, =. Tools and seeds become what you hold;
// food is eaten right away; bait goes on the hook. A health bar sits above it
// when it matters.
import { h, icon, spriteImg } from './dom.js';
import { getState, commit } from '../state.js';
import { toast } from '../events.js';
import { eat } from '../combat.js';
import { sfx } from '../audio.js';
import { ROW, syncBag, slotInfo, heldFor } from '../bag.js';

export const HOTKEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];

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
    this.keys = [];
  }

  render() {
    const s = getState();
    if (!s) return;
    syncBag(s);
    this.keys = s.inventory.slots.slice(0, ROW);
    const kb = matchMedia('(hover: hover) and (pointer: fine)').matches;
    const held = s.inventory.held;
    const nodes = this.keys.map((key, i) => {
      const info = slotInfo(key, s);
      if (!info) return h('button.slot.empty', { type: 'button', 'aria-label': `Empty slot ${HOTKEYS[i]}`, on: { click: e => e.stopPropagation() } }, kb ? h('span.key', HOTKEYS[i]) : null);
      const isHeld = heldFor(key) === held;
      const equipped = info.kind === 'bait' && s.inventory.equippedBait === info.id;
      const art = info.sprite ? spriteImg(info.sprite, 1, 'px-icon') : icon(info.icon);
      return h('button.slot' + (isHeld ? '.held' : '') + (equipped ? '.equipped' : ''), {
        type: 'button', 'aria-label': info.name, 'aria-pressed': isHeld || equipped ? 'true' : 'false',
        title: info.name + (info.kind === 'food' ? ' (tap to eat)' : info.kind === 'bait' ? ' (tap to use as bait)' : ''),
        on: { click: e => { e.stopPropagation(); this.pick(i); } },
      }, art, info.count != null ? h('span.cnt', String(info.count)) : null, kb ? h('span.key', HOTKEYS[i]) : null);
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

  /** Use a slot (from a tap or a number key). Returns true if handled. */
  pick(i) {
    const key = this.keys[i];
    if (key === undefined) return false;
    if (!key) return true;
    const s = getState();
    const info = slotInfo(key, s);
    if (info.kind === 'food') {
      const r = eat(this.ui.game, info.id);
      if (!r.ok) toast(r.message, 'heart');
    } else if (info.kind === 'bait') {
      s.inventory.equippedBait = s.inventory.equippedBait === info.id ? 'none' : info.id;
      toast(s.inventory.equippedBait === 'none' ? 'Fishing without bait.' : `${info.name} on the hook.`, info.icon);
      commit('bait');
    } else {
      s.inventory.held = heldFor(key);
      sfx('click');
      commit('held', false);
    }
    this.render();
    return true;
  }
}
