// UI controller: owns the HUD, navigation, overlays and routes to panels.
// Panels re-render on state changes (throttled), never every frame.
import { h, icon, fmt, initLayers, openSheet, closeSheet, refreshSheet, sheetOpen, modal, modalOpen, showToast, button, costView } from './dom.js';
import { on, toast } from '../events.js';
import { getState } from '../state.js';
import { spriteUrl, clearUrlCache } from '../art/sprites.js';
import { xpToNext } from '../progression.js';
import { clockText, currentPhase, currentWeather, restUntil } from '../weather.js';
import { questProgress, dailyProgress } from '../quests.js';
import { ISLANDS } from '../../data/island-data.js';
import { sfx, initAudio } from '../audio.js';
import { FishingUI } from './fishing-ui.js';
import { DialogueUI } from './dialogue-ui.js';
import { BuildUI } from './build-ui.js';
import { TitleUI } from './title.js';
import { PANELS } from './panels/index.js';
import { repairBridge, harvestGarden, BRIDGE_COST } from '../interactions.js';
import { checkCost } from '../economy.js';
import { capacity } from '../inventory.js';
import { countBuilt } from '../building-count.js';

const NAV = [
  ['island', 'Island', 'island'],
  ['encyclopedia', 'Fish', 'fish'],
  ['map', 'Map', 'map'],
  ['friends', 'Friends', 'friends'],
];

export class UI {
  constructor() {
    this.game = null;
    this.app = document.getElementById('app');
    this.dirty = false;
    this.refreshTimer = 0;
    this.pending = [];
  }

  attach(game) {
    this.game = game;
    initLayers();
    this.buildHud();
    this.fishingUI = new FishingUI(this);
    this.dialogueUI = new DialogueUI(this);
    this.buildUI = new BuildUI(this);
    this.title = new TitleUI(this);
    this.bindEvents();
    this.title.show();
  }

  // ---------------------------------------------------------------- HUD
  buildHud() {
    const top = document.getElementById('hud-top');
    this.el = {};
    this.el.portrait = h('img.portrait', { alt: '' });
    this.el.name = h('span.pname');
    this.el.level = h('span.plevel');
    this.el.xpFill = h('div.fill');
    this.el.coins = h('span.num');
    this.el.pearls = h('span.num');
    this.el.clockIcon = h('img.px-icon', { alt: '' });
    this.el.clock = h('span.clock-text');
    this.el.saving = h('span.save-dot', { title: 'Saved', 'aria-live': 'polite' });
    top.append(
      h('button.profile', { type: 'button', 'aria-label': 'Profile', on: { click: () => this.open('profile') } },
        h('div.portrait-wrap', this.el.portrait, this.el.level),
        h('div.pinfo', h('div.prow', this.el.name), h('div.bar.xp', this.el.xpFill))),
      h('div.wallet',
        h('div.pill.coins', { title: 'Coins' }, icon('coin'), this.el.coins),
        h('div.pill.pearls', { title: 'Pearls' }, icon('pearl'), this.el.pearls)),
      h('div.pill.clock', { title: 'Time & weather' }, this.el.clockIcon, this.el.clock, this.el.saving),
      h('button.icon-btn.settings', { type: 'button', 'aria-label': 'Settings', on: { click: () => this.open('settings') } }, icon('gear')));

    const nav = document.getElementById('nav');
    this.navButtons = {};
    for (const [id, label, ic] of NAV) {
      const b = h('button.nav-btn', { type: 'button', 'data-tab': id, on: { click: () => { sfx('click'); this.navTo(id); } } }, icon(ic), h('span', label));
      this.navButtons[id] = b;
      nav.append(b);
    }

    const stage = document.getElementById('stage');
    // Safety net for browsers without overflow: clip.
    stage.addEventListener('scroll', () => { stage.scrollTop = 0; stage.scrollLeft = 0; });
    this.el.questBadge = h('span.badge', { hidden: true }, '!');
    this.el.side = h('div#side-buttons',
      h('button.fab', { type: 'button', 'aria-label': 'Bag', on: { click: () => this.open('inventory') } }, icon('bag'), h('span', 'Bag')),
      h('button.fab', { type: 'button', 'aria-label': 'Quests', on: { click: () => this.open('quests') } }, icon('quest'), h('span', 'Quests'), this.el.questBadge),
      h('button.fab', { type: 'button', 'aria-label': 'Build', on: { click: () => this.openBuild() } }, icon('build'), h('span', 'Build')));
    this.el.questChip = h('button.quest-chip', { type: 'button', on: { click: () => this.open('quests') } });
    this.el.interact = h('button#interact-btn', { type: 'button', 'aria-label': 'Interact', on: { click: () => { const t = this.game.interactTarget; if (t) this.game.interact(t); } } },
      h('span.key', 'A'), h('span.verb'));
    this.el.prompt = h('div#prompt', { 'aria-live': 'polite' });
    stage.append(this.el.side, this.el.questChip, this.el.interact, this.el.prompt);
  }

  enterPlay() {
    this.title.hide();
    this.app.classList.remove('on-title');
    this.app.classList.add('playing');
    clearUrlCache('portrait_player');
    document.documentElement.classList.toggle('reduced-motion', !!getState().settings.reducedMotion);
    this.refreshHud();
    this.navTo('island');
    const s = getState();
    if (s.stats.fishCaught === 0 && s.quests.index === 0) {
      setTimeout(() => toast('Tip: drag anywhere to walk, or tap where you want to go.', 'island'), 900);
    }
  }

  refreshHud() {
    const s = getState();
    if (!s) return;
    const p = s.player;
    this.el.portrait.src = spriteUrl('portrait_player', 3);
    this.el.name.textContent = p.name;
    this.el.level.textContent = 'Lv ' + p.level;
    this.el.xpFill.style.width = Math.min(100, (p.xp / xpToNext(p.level)) * 100) + '%';
    this.el.coins.textContent = fmt(p.coins);
    this.el.pearls.textContent = fmt(p.pearls);
    const qp = questProgress();
    const dailyReady = s.daily.goals.some(g => !g.claimed && dailyProgress(g) >= g.count);
    this.el.questBadge.hidden = !(qp && qp.ready) && !dailyReady;
    if (qp) {
      this.el.questChip.hidden = false;
      this.el.questChip.classList.toggle('ready', qp.ready);
      this.el.questChip.replaceChildren(...[icon(qp.ready ? 'check' : 'quest'), h('span.qtitle', qp.ready ? 'Quest complete! Tap to claim' : qp.def.title), qp.ready ? null : h('span.qprog', `${qp.value}/${qp.goal}`)].filter(Boolean));
    } else this.el.questChip.hidden = true;
  }

  updateClock() {
    const w = currentWeather(), ph = currentPhase();
    const ic = w === 'storm' ? 'storm' : w === 'rain' ? 'rain' : ph === 'night' ? 'moon' : ph === 'evening' ? 'sunset' : 'sun';
    if (this.el.clockIcon.dataset.ic !== ic) { this.el.clockIcon.src = icon(ic).src; this.el.clockIcon.dataset.ic = ic; }
    const isl = ISLANDS[getState().player.island];
    const txt = isl.alwaysNight ? 'Night' : clockText();
    if (this.el.clock.dataset.t !== txt) {
      this.el.clock.dataset.t = txt;
      const [time, ampm] = txt.split(' ');
      this.el.clock.replaceChildren(time, ampm ? h('span.ampm', ' ' + ampm) : '');
    }
  }

  /** CSS px at the bottom of the stage hidden by a panel (fishing, dialogue, build). */
  obscuredBottom() {
    for (const id of ['fishing-ui', 'dialogue', 'build-bar']) {
      const el = document.getElementById(id);
      if (el.classList.contains('show')) return el.offsetHeight + 12;
    }
    return 0;
  }

  /** Called every frame by the game; keep it cheap. */
  frame(dt) {
    if (this.dirty) {
      this.refreshTimer -= dt;
      if (this.refreshTimer <= 0) {
        this.dirty = false;
        this.refreshHud();
        if (sheetOpen() && !this.noRefresh) refreshSheet();
      }
    }
    this.clockAcc = (this.clockAcc || 0) + dt;
    if (this.clockAcc > 0.5) { this.clockAcc = 0; this.updateClock(); }
    const t = this.game.interactTarget;
    const show = !!t && !this.blocking() && !this.game.build.active;
    const key = show ? t.verb + '|' + t.label : '';
    if (key !== this.lastPrompt) {
      this.lastPrompt = key;
      this.el.interact.classList.toggle('show', show);
      this.el.prompt.classList.toggle('show', show);
      if (show) {
        this.el.interact.querySelector('.verb').textContent = t.verb;
        const kb = matchMedia('(hover: hover) and (pointer: fine)').matches;
        this.el.prompt.replaceChildren(h('b', t.label), h('span', kb ? ` — press E to ${t.verb.toLowerCase()}` : ` — tap ${t.verb}`));
      }
    }
    this.fishingUI.frame(dt);
  }

  // ---------------------------------------------------------------- routing
  navTo(tab) {
    for (const [id, b] of Object.entries(this.navButtons)) {
      b.classList.toggle('active', id === tab);
      b.setAttribute('aria-current', id === tab ? 'page' : 'false');
    }
    if (tab === 'island') { closeSheet(true); if (this.game.build.active) this.closeBuild(); return; }
    this.open(tab);
  }

  open(name, opts = {}) {
    const panel = PANELS[name];
    if (!panel) return;
    if (this.game.build.active && name !== 'build') this.closeBuild();
    const ctx = { game: this.game, ui: this, opts };
    openSheet(name, panel.title, body => panel.render(body, ctx), {
      wide: panel.wide, iconName: panel.icon,
      onClose: () => { this.syncNav(null); panel.onClose?.(ctx); },
    });
    this.syncNav(name);
  }

  syncNav(name) {
    const tab = NAV.find(n => n[0] === name)?.[0] || 'island';
    for (const [id, b] of Object.entries(this.navButtons)) b.classList.toggle('active', id === tab);
  }

  closeAll() { closeSheet(true); if (this.game.build.active) this.closeBuild(); this.dialogueUI.close(); }

  blocking() {
    return !!sheetOpen() || modalOpen() || this.dialogueUI.open || this.title.visible || this.fading;
  }

  handleEscape() {
    if (modalOpen()) { document.querySelector('#modal-layer .modal-wrap:last-child')?.click(); return true; }
    if (this.dialogueUI.open) { this.dialogueUI.advance(); return true; }
    if (sheetOpen()) { closeSheet(); return true; }
    if (this.game.fishing) { this.game.stopFishing(); return true; }
    return false;
  }

  // ---------------------------------------------------------------- features
  openBuild() {
    if (this.game.fishing) this.game.stopFishing();
    this.open('build');
  }
  closeBuild() { this.buildUI.exit(); }

  talk(npcId) { this.dialogueUI.start(npcId); }

  fishingStart(session) { this.fishingUI.start(session); this.app.classList.add('fishing'); }
  fishingEnd() { this.fishingUI.end(); this.app.classList.remove('fishing'); setTimeout(() => this.flushPending(), 250); }

  bridge() {
    const s = getState();
    if (s.islands.sunny.flags.bridgeRepaired) return;
    let close;
    const check = checkCost(BRIDGE_COST);
    const have = id => id === 'coins' ? s.player.coins : (s.inventory.items[id] || 0);
    close = modal(h('div.confirm',
      h('h3', 'The Old Bridge'),
      h('p', 'Storm-battered planks span the channel to the north-east grove. Rowan can repair it with the right materials.'),
      costView(BRIDGE_COST, have),
      h('div.row.end',
        button('Not now', () => close(), { cls: 'ghost' }),
        button('Repair bridge', () => {
          const res = repairBridge(this.game);
          toast(res.message, res.ok ? 'build' : null, res.ok ? 'good' : 'error');
          if (res.ok) close();
        }, { cls: 'primary', disabled: !check.ok }))));
  }

  building(pl) {
    const g = this.game;
    switch (pl.type) {
      case 'cottage': return this.restMenu();
      case 'fishing_hut': return this.open('shop', { tab: 'bait' });
      case 'fish_market': return this.open('orders');
      case 'crop_garden': { const r = harvestGarden(g, pl); toast(r.message, r.ok ? 'flower' : null, r.ok ? 'good' : 'info'); return; }
      case 'storage_shed': toast(`Your bag holds ${capacity()} fish (${countBuilt('storage_shed')} shed${countBuilt('storage_shed') === 1 ? '' : 's'} built).`, 'bag'); return;
      case 'lighthouse': toast(getState().islands.moon.unlocked ? 'The beam points the way to Moonlit Bay.' : 'The lighthouse beam reveals a route to Moonlit Bay — check the Map!', 'map', 'good'); return;
      default: return;
    }
  }

  restMenu() {
    const isl = ISLANDS[getState().player.island];
    let close;
    const rest = phase => {
      close();
      this.fade(() => { restUntil(phase); toast(`You rested until ${phase}.`, 'sleep', 'good'); }, 'Zzz…');
    };
    close = modal(h('div.confirm',
      h('h3', 'Cozy Cottage'),
      h('p', isl.alwaysNight ? 'Time stands still in Moonlit Bay.' : `It is ${clockText()}. Take a nap and wake up at…`),
      h('div.rest-grid',
        button('Morning', () => rest('morning'), { iconName: 'sun' }),
        button('Afternoon', () => rest('afternoon'), { iconName: 'sun' }),
        button('Evening', () => rest('evening'), { iconName: 'sunset' }),
        button('Night', () => rest('night'), { iconName: 'moon' })),
      h('div.row.end', button('Change hat', () => { close(); this.open('profile'); }, { cls: 'ghost', iconName: 'hat' }), button('Close', () => close(), { cls: 'ghost' }))));
  }

  levelUp({ level, coins, unlocks }) {
    initAudio(); sfx('levelup');
    this.game.player?.cheer(1.6);
    if (this.game.player) this.game.renderer.emit('sparkle', this.game.player.x, this.game.player.y - 20, 16, { speed: 60, gravity: 20, color: '#f8dc7c' });
    let close;
    close = modal(h('div.levelup',
      h('div.burst', icon('xp', 'big')),
      h('h3', `Level ${level}!`),
      h('p', `+${coins} coins`),
      unlocks.length ? h('div.unlocks', h('b', 'New unlocks'), h('ul', unlocks.map(u => h('li', u)))) : null,
      h('div.row.center', button('Hooray!', () => close(), { cls: 'primary' }))), { cls: 'celebrate', queue: true });
  }

  /** Run celebrations that were held back (e.g. during a catch). */
  flushPending() {
    const list = this.pending.splice(0);
    for (const fn of list) fn();
  }

  /** Fade to black, run a callback (e.g. travel), fade back in. */
  fade(mid, label = '') {
    const f = document.getElementById('fade');
    this.fading = true;
    f.querySelector('.fade-label').textContent = label;
    f.classList.add('on');
    setTimeout(() => {
      try { mid(); } finally {
        setTimeout(() => { f.classList.remove('on'); this.fading = false; }, 450);
      }
    }, 420);
  }

  reportError(err) {
    if (this.errorShown) return;
    this.errorShown = true;
    toast('Something went wrong: ' + (err?.message || err), null, 'error');
    setTimeout(() => { this.errorShown = false; }, 5000);
  }

  // ---------------------------------------------------------------- events
  bindEvents() {
    on('toast', showToast);
    on('change', () => { this.dirty = true; this.refreshTimer = 0.08; });
    on('saving', () => this.el.saving.classList.add('busy'));
    on('saved', () => { this.el.saving.classList.remove('busy'); this.el.saving.classList.add('ok'); clearTimeout(this.savedT); this.savedT = setTimeout(() => this.el.saving.classList.remove('ok'), 1200); });
    on('levelUp', info => {
      // Don't interrupt a catch: show the celebration after the catch card closes.
      const f = this.game.fishing;
      if (f && ['landing', 'result'].includes(f.phase)) { this.pending.push(() => this.levelUp(info)); return; }
      this.levelUp(info);
    });
    on('questReady', def => toast(`Quest complete: ${def.title}`, 'check', 'good'));

    on('questClaimed', def => toast(`Rewards claimed for “${def.title}”`, 'quest', 'good'));
    on('achievement', a => { sfx('quest'); toast(`Achievement: ${a.name}!`, 'trophy', 'gold'); });
    on('milestone', m => toast(`Encyclopedia ${m.pct}% — milestone reward!`, 'fish', 'gold'));
    on('islandUnlocked', ({ id }) => toast(`${ISLANDS[id].name} is now open for travel!`, 'boat', 'gold'));
    on('travel', ({ id, first }) => { if (first) setTimeout(() => toast(`Welcome to ${ISLANDS[id].name}! ${ISLANDS[id].tagline}`, 'island', 'good'), 900); });
    on('bridgeRepaired', () => toast('The grove is open!', 'build', 'good'));
    on('weather', ({ weather }) => {
      if (!this.game || this.game.mode !== 'play') return;
      if (weather === 'rain') toast('It started to rain. Drizzle Darters love this!', 'rain');
      if (weather === 'storm') toast('A storm rolls in… Stormrays are stirring.', 'storm');
    });
    on('phase', ({ phase }) => { if (this.game?.mode === 'play' && phase === 'night') toast('Night falls. Nocturnal fish are rising.', 'moon'); });
    on('newDay', () => { if (this.game?.mode === 'play') toast('A new day dawns on the islands.', 'sun'); });
    document.addEventListener('sheet', () => this.syncNav(sheetOpen()));
  }
}
