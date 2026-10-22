// Fishing HUD: cast-power meter, bite alert, the reeling minigame (drawn as
// pixel art on its own small canvas) and the catch result card.
import { h, icon, spriteImg, button, modal, fmt } from './dom.js';
import { getState, commit } from '../state.js';
import { toast } from '../events.js';
import { sprite } from '../art/sprites.js';
import { C, RARITY_COLORS } from '../art/palette.js';
import { RODS, BAIT } from '../../data/item-data.js';
import { VARIANT } from '../../data/fish-data.js';
import { itemCount, addCoins } from '../economy.js';
import { fishValue, capacity, fishCount } from '../inventory.js';
import { PERFECT_ZONE } from '../fishing.js';
import { ZONE_NAMES } from '../fish.js';

const TRACK_W = 168, TRACK_H = 30;

// No buttons: hold / tap anywhere on the screen (or Space / E) to play.
const LABELS = {
  ready: 'Hold anywhere to cast', charge: 'Let go!', cast: '…', wait: 'Waiting…', bite: 'TAP NOW!',
  reel: 'Hold anywhere to reel', landing: 'Got it!', result: '', missed: 'Tap to cast again',
};
const HINTS = {
  ready: 'Hold anywhere and let go in the gold zone for a perfect cast.',
  charge: 'Let go in the gold zone!',
  cast: '',
  wait: 'Watch the bobber… tap only when it splashes.',
  bite: 'Something bit! Tap!',
  reel: 'Hold to push the green zone right, let go to drift left. Keep the fish inside!',
  landing: '',
};

export class FishingUI {
  constructor(ui) {
    this.ui = ui;
    this.session = null;
    this.root = document.getElementById('fishing-ui');
    this.build();
  }

  build() {
    this.el = {};
    this.el.title = h('div.fish-spot');
    this.el.baitBtn = h('button.chip', { type: 'button', on: { click: () => this.cycleBait() } });
    this.el.rod = h('span.chip.static');
    this.el.msg = h('div.fish-msg', { 'aria-live': 'polite' });
    this.el.meterFill = h('div.fill');
    this.el.meter = h('div.meter', h('div.sweet', { style: { left: PERFECT_ZONE[0] * 100 + '%', width: (PERFECT_ZONE[1] - PERFECT_ZONE[0]) * 100 + '%' } }), this.el.meterFill);
    this.el.track = h('canvas.track', { width: TRACK_W, height: TRACK_H });
    this.tctx = this.el.track.getContext('2d');
    this.el.progFill = h('div.fill');
    this.el.prog = h('div.bar.catch', this.el.progFill);
    this.el.reelBox = h('div.reel-box', this.el.track, this.el.prog);
    this.el.action = h('div.fish-cue', { 'aria-live': 'polite' }, h('span.lbl', LABELS.ready));
    this.el.close = h('button.icon-btn.close', { type: 'button', 'aria-label': 'Stop fishing', on: { click: () => this.ui.game.stopFishing() } }, icon('close'));
    this.root.append(
      h('div.fish-head', icon('rod'), this.el.title, this.el.rod, this.el.baitBtn, this.el.close),
      this.el.msg,
      h('div.fish-play', this.el.meter, this.el.reelBox),
      this.el.action);
    // Hold-style input anywhere on the screen (touch, mouse and pen). Buttons
    // in the fishing bar (bait, close), menus and pop-ups keep working as usual.
    const btn = this.el.action;
    const busy = () => !this.session || this.resultOpen || this.ui.blocking() || ['cast', 'landing', 'result'].includes(this.session.phase);
    const down = e => {
      if (busy() || this.pointer != null) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.target.closest?.('button, a, input, select, .fish-head, #nav, #hud-top, #hotbar, .modal-wrap, .sheet')) return;
      e.preventDefault();
      this.pointer = e.pointerId; btn.classList.add('held'); this.session.press();
    };
    const up = e => { if (this.pointer !== e.pointerId) return; this.pointer = null; btn.classList.remove('held'); this.session?.release(); };
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);
    // Keyboard: Space / E / Enter behave like holding the button.
    window.addEventListener('keydown', e => {
      if (!this.session || this.resultOpen || this.ui.blocking()) return;
      if (['Space', 'KeyE', 'Enter'].includes(e.code)) { e.preventDefault(); if (!e.repeat) { btn.classList.add('held'); this.session.press(); } }
      if (e.code === 'Escape') this.ui.game.stopFishing();
    });
    window.addEventListener('keyup', e => {
      if (!this.session) return;
      if (['Space', 'KeyE', 'Enter'].includes(e.code)) { btn.classList.remove('held'); this.session.release(); }
    });
  }

  start(session) {
    this.session = session;
    this.lastPhase = null;
    this.resultOpen = false;
    this.el.title.textContent = session.spot.name;
    this.el.title.title = ZONE_NAMES[session.spot.zone];
    this.refreshGear();
    this.root.classList.add('show');
    document.activeElement?.blur?.();
  }

  end() {
    this.session = null;
    this.root.classList.remove('show');
    this.pointer = null;
  }

  refreshGear() {
    const s = getState();
    this.el.rod.textContent = RODS[s.inventory.equippedRod].name;
    const b = s.inventory.equippedBait;
    const bait = BAIT[b] || BAIT.none;
    const n = b === 'none' ? '' : ` ×${itemCount(b)}`;
    this.el.baitBtn.replaceChildren(icon(bait.icon), h('span', bait.name + n));
    this.el.baitBtn.title = 'Tap to change bait';
  }

  cycleBait() {
    const s = getState();
    const owned = ['none', ...Object.keys(BAIT).filter(id => id !== 'none' && itemCount(id) > 0)];
    const i = owned.indexOf(s.inventory.equippedBait);
    s.inventory.equippedBait = owned[(i + 1) % owned.length];
    commit('bait');
    this.refreshGear();
  }

  frame() {
    const ses = this.session;
    if (!ses) return;
    const ph = ses.phase;
    if (ph !== this.lastPhase) this.onPhase(ph);
    if (ph === 'charge' || ph === 'ready' || ph === 'missed') {
      this.el.meterFill.style.width = (ph === 'charge' ? ses.power * 100 : 0) + '%';
    }
    if (ph === 'reel' && ses.reel) this.drawTrack(ses);
  }

  onPhase(ph) {
    const ses = this.session;
    this.lastPhase = ph;
    this.root.dataset.phase = ph;
    this.el.action.querySelector('.lbl').textContent = LABELS[ph] ?? '';
    this.el.msg.textContent = ses.message || HINTS[ph] || '';
    this.el.meter.hidden = !(ph === 'ready' || ph === 'charge' || ph === 'missed');
    this.el.reelBox.hidden = ph !== 'reel';
    this.el.action.classList.toggle('dim', ph === 'cast' || ph === 'landing' || ph === 'result');
    this.el.baitBtn.disabled = !(ph === 'ready' || ph === 'missed');
    if (ph === 'ready' || ph === 'missed') this.refreshGear();
    if (ph === 'result') this.showResult(ses.result);
  }

  drawTrack(ses) {
    const ctx = this.tctx, r = ses.reel;
    ctx.imageSmoothingEnabled = false;
    // water background with stripes
    ctx.fillStyle = C.deep; ctx.fillRect(0, 0, TRACK_W, TRACK_H);
    ctx.fillStyle = '#2f90a2';
    for (let x = 0; x < TRACK_W; x += 12) ctx.fillRect((x + Math.floor(performance.now() / 120)) % TRACK_W, 6 + (x % 3) * 7, 5, 1);
    // catch zone
    const zx = Math.round(r.zonePos * TRACK_W), zw = Math.round(r.zoneW * TRACK_W);
    ctx.fillStyle = r.inZone ? '#7fe08a' : '#5fbf6a';
    ctx.fillRect(zx, 2, zw, TRACK_H - 4);
    ctx.fillStyle = r.inZone ? '#c8f7c0' : '#8fdc90';
    ctx.fillRect(zx, 2, zw, 2); ctx.fillRect(zx, 2, 2, TRACK_H - 4); ctx.fillRect(zx + zw - 2, 2, 2, TRACK_H - 4);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(zx + 3, 6, zw - 6, 1);
    // treasure
    const tr = r.treasure;
    if (tr && tr.shown && !tr.done) {
      const cs = sprite('chest');
      const tx = Math.round(tr.pos * TRACK_W - cs.width / 2);
      ctx.drawImage(cs, tx, TRACK_H - cs.height - 1);
      ctx.fillStyle = C.ink; ctx.fillRect(tx, 1, cs.width, 3);
      ctx.fillStyle = C.gold; ctx.fillRect(tx + 1, 2, Math.round((cs.width - 2) * tr.progress), 1);
    }
    // fish (silhouette until discovered)
    const known = !!getState().collection[ses.fish.id];
    const fs = sprite((known ? 'fish_' : 'fishsil_') + ses.fish.id);
    const wob = Math.round(Math.sin(performance.now() / 90) * 1);
    const fx = Math.round(r.fishPos * TRACK_W - fs.width / 2);
    ctx.save();
    if (r.fishVel < -0.02) { ctx.translate(fx + fs.width, 0); ctx.scale(-1, 1); ctx.drawImage(fs, 0, Math.round((TRACK_H - fs.height) / 2) + wob); }
    else ctx.drawImage(fs, fx, Math.round((TRACK_H - fs.height) / 2) + wob);
    ctx.restore();
    // border
    ctx.fillStyle = C.ink;
    ctx.fillRect(0, 0, TRACK_W, 1); ctx.fillRect(0, TRACK_H - 1, TRACK_W, 1); ctx.fillRect(0, 0, 1, TRACK_H); ctx.fillRect(TRACK_W - 1, 0, 1, TRACK_H);
    // catch progress
    this.el.progFill.style.width = Math.max(0, Math.min(1, r.progress)) * 100 + '%';
    this.el.prog.classList.toggle('low', r.progress < 0.2);
    this.el.reelBox.classList.toggle('struggle', !r.inZone);
  }

  showResult(res) {
    if (!res) return;
    this.resultOpen = true;
    const f = res.fish;
    const value = res.entry ? fishValue(res.entry) : 0;
    let close;
    const done = keepGoing => {
      close();
      this.resultOpen = false;
      setTimeout(() => this.ui.flushPending(), 200);
      if (keepGoing && this.session) this.session.continueFishing();
      else this.ui.game.stopFishing();
    };
    const badges = h('div.badges',
      h('span.rarity', { style: { background: RARITY_COLORS[f.rarity] } }, f.rarity),
      res.isNew ? h('span.badge-new', 'NEW!') : null,
      res.isRecord ? h('span.badge-rec', 'Record size!') : null,
      res.variant ? h('span.badge-var', VARIANT.name) : null);
    let actions;
    if (res.released) {
      actions = [h('p.note', 'You record the encounter in your journal and gently let it swim free. It leaves 3 pearls behind as thanks.'),
        h('div.row.center', button('Keep fishing', () => done(true), { cls: 'primary' }), button('Done', () => done(false), { cls: 'ghost' }))];
    } else if (!res.stored) {
      actions = [h('p.note.warn', `Your bag is full (all ${capacity()} slots are used). Sell this fish now or release it.`),
        h('div.row.center',
          button(`Sell now +${value}`, () => {
            const s = getState();
            addCoins(value, 'sale');
            s.stats.fishSold += 1; s.stats.coinsFromSales += value;
            commit('sell');
            done(true);
          }, { cls: 'primary', iconName: 'coin' }),
          button('Release', () => { toast(`You released the ${f.name}.`); done(true); }, { cls: 'ghost' }))];
    } else {
      actions = [h('div.row.center', button('Keep fishing', () => done(true), { cls: 'primary' }), button('Done', () => done(false), { cls: 'ghost' }))];
    }
    close = modal(h('div.catch-card' + (f.rarity === 'legendary' || f.rarity === 'epic' ? '.shiny' : ''),
      h('div.catch-art', spriteImg((res.variant ? 'fishvar_' : 'fish_') + f.id, 5, 'bounce')),
      h('h3', (res.variant ? VARIANT.name + ' ' : '') + f.name),
      badges,
      h('div.catch-stats',
        h('div', h('small', 'Size'), h('b', res.size + ' cm')),
        h('div', h('small', 'Value'), h('b', res.released ? '—' : fmt(value))),
        h('div', h('small', 'XP'), h('b', '+' + res.xp))),
      h('p.desc', f.desc),
      actions), { dismissable: false, cls: 'catch' });
  }
}
