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
import { nearbyInteractables } from '../interactions.js';
import { Layout } from './layout.js';
import { AccountUI } from './account-ui.js';
import { friendlyError } from '../online/auth.js';

// Menu bar: one compact row of icon buttons (top-right in landscape,
// bottom edge in portrait). null = visual separator.
const MENU = [
  ['inventory', 'Bag', 'bag'],
  ['quests', 'Quests', 'quest'],
  ['build', 'Build', 'build'],
  null,
  ['encyclopedia', 'Fish', 'fish'],
  ['map', 'Map', 'map'],
  ['friends', 'Friends', 'friends'],
  ['settings', 'Settings', 'gear'],
];

/** Icon shown on the contextual action button for each kind of interaction. */
function actionIcon(it) {
  switch (it.kind) {
    case 'spot': return 'rod';
    case 'npc': return 'friends';
    case 'shop': return 'shop';
    case 'enter': return it.obj ? 'shop' : 'home';
    case 'exit': return 'home';
    case 'bed': return 'sleep';
    case 'board': return 'quest';
    case 'boat': return 'boat';
    case 'bridge': return 'build';
    case 'building': return { cottage: 'sleep', fishing_hut: 'worm', fish_market: 'order', crop_garden: 'flower', storage_shed: 'bag', lighthouse: 'map' }[it.placement.type] || 'home';
    case 'gather': return { wood: 'wood', stone: 'stone', shell: 'shell', seaglass: 'seaglass', flower: 'flower', tidepool: 'shell', crystal: 'seaglass' }[it.obj.def.resource.item] || 'sparkle';
    default: return 'sparkle';
  }
}

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
      h('button.profile.hud-glass', { type: 'button', 'aria-label': 'Profile', on: { click: () => this.open('profile') } },
        h('div.portrait-wrap', this.el.portrait, this.el.level),
        h('div.pinfo', this.el.name, h('div.bar.xp', this.el.xpFill))),
      h('div.pill.coins.hud-glass', { title: 'Coins' }, icon('coin'), this.el.coins),
      h('div.pill.pearls.hud-glass', { title: 'Pearls' }, icon('pearl'), this.el.pearls),
      h('div.pill.clock.hud-glass', { title: 'Time & weather' }, this.el.clockIcon, this.el.clock, this.el.saving));

    const nav = document.getElementById('nav');
    this.navButtons = {};
    this.el.questBadge = h('span.badge', { hidden: true }, '!');
    for (const item of MENU) {
      if (!item) { nav.append(h('span.nav-sep')); continue; }
      const [id, label, ic] = item;
      const b = h('button.nav-btn', { type: 'button', 'data-tab': id, 'aria-label': label, title: label, on: { click: () => { sfx('click'); this.navTo(id); } } },
        icon(ic), h('span', label), id === 'quests' ? this.el.questBadge : null);
      this.navButtons[id] = b;
      nav.append(b);
    }

    const stage = document.getElementById('stage');
    // Safety net for browsers without overflow: clip.
    stage.addEventListener('scroll', () => { stage.scrollTop = 0; stage.scrollLeft = 0; });
    this.el.questChip = h('button.quest-chip', { type: 'button', on: { click: () => this.open('quests') } });
    this.el.rotate = h('div.hud-note.rotate-hint.hud-glass', icon('sparkle'), h('span', 'Turn your phone sideways for the best view'));
    this.el.info = document.getElementById('hud-info');
    this.el.sync = h('div.hud-note.sync-note.hud-glass', { hidden: true, role: 'status' });
    this.el.visit = h('div.visit-banner.hud-glass', { hidden: true });
    this.el.info.append(this.el.visit, this.el.questChip, this.el.sync, this.el.rotate);
    this.el.actions = document.getElementById('action-region');
    this.layout = new Layout();
  }

  /** Render the contextual action buttons (only what is nearby, never stale). */
  renderActions() {
    const g = this.game;
    const usable = g.mode === 'play' && !this.blocking() && !g.build.active && !g.fishing;
    const list = usable ? nearbyInteractables(g, 3) : [];
    const key = list.map(it => it.kind + ':' + it.verb + ':' + it.label).join('|');
    if (key === this.actionKey) return;
    this.actionKey = key;
    this.actionList = list;
    const kb = matchMedia('(hover: hover) and (pointer: fine)').matches;
    // The closest object is the big primary action; others stack above it.
    const nodes = list.map((it, i) => h('button.act' + (i === 0 ? '.primary' : ''), {
      type: 'button', 'aria-label': it.verb + ' ' + it.label,
      on: { click: e => { e.stopPropagation(); const cur = this.actionList?.[i]; if (cur) g.interact(cur); } },
    },
    h('span.key', icon(actionIcon(it))),
    h('span.txt', h('span.verb', it.verb, i === 0 && kb ? h('kbd', 'E') : null), h('span.what', it.label))));
    this.el.actions.replaceChildren(...nodes.reverse());
  }

  enterPlay() {
    this.title.hide();
    this.app.classList.remove('on-title');
    this.app.classList.add('playing');
    clearUrlCache('portrait_player');
    document.documentElement.classList.toggle('reduced-motion', !!getState().settings.reducedMotion);
    this.refreshHud();
    this.layout.measure();
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

  /** CSS px of the stage covered by UI on each side (see layout.js). */
  insets() { return this.layout.insets(); }

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
    this.app.classList.toggle('talking', this.dialogueUI.open);
    this.renderActions();
    this.fishingUI.frame(dt);
  }

  // ---------------------------------------------------------------- routing
  navTo(tab) {
    if (tab === 'island') { closeSheet(true); if (this.game.build.active) this.closeBuild(); this.syncNav(null); return; }
    // Tapping the active menu button again closes it.
    if (sheetOpen() === tab) { closeSheet(); return; }
    if (tab === 'build') { this.openBuild(); return; }
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
    for (const [id, b] of Object.entries(this.navButtons)) {
      b.classList.toggle('active', id === name);
      b.setAttribute('aria-pressed', id === name ? 'true' : 'false');
    }
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
    const v = this.game.visit;
    if (v && !v.member) { toast('You’re visiting, so you can only look around. Join their game to build.', 'build'); return; }
    if (v && !v.hostHere) { toast(`${v.hostName} needs to be on this island for you to build.`, 'build'); return; }
    if (this.game.indoor) { toast('Step outside to build.', 'build'); return; }
    if (this.game.fishing) this.game.stopFishing();
    this.open('build');
  }
  closeBuild() { this.buildUI.exit(); }

  talk(npcId) { this.dialogueUI.start(npcId); }

  /** Account / sign-in screen (see account-ui.js). */
  openAccount() { this.account?.open(); }

  /** Connect the online services (accounts, cloud saves, friends). */
  attachOnline(online) {
    this.online = online;
    this.account = new AccountUI(this, online);
    this.wireSessions();
    online.auth.on(type => { if (type === 'change') { this.refreshSync(); if (this.title.visible && !this.titleRefreshQueued) { this.titleRefreshQueued = true; setTimeout(() => { this.titleRefreshQueued = false; if (!modalOpen()) this.title.refresh(); }, 50); } } });
    return { chooseSave: (l, c, w) => this.account.chooseSave(l, c, w), confirmUpload: l => this.account.confirmUpload(l) };
  }

  get cloud() { return this.online?.cloud ? Object.assign(this.online.cloud, { resolveBeforePlay: st => this.online.resolveBeforePlay(st) }) : null; }

  /** Small cloud-sync indicator under the status card (only when signed in). */
  refreshSync() {
    const c = this.online?.cloud;
    const el = this.el?.sync;
    if (!el) return;
    if (!c || !this.online.auth.signedIn) { el.hidden = true; return; }
    const map = { synced: ['check', 'Synced'], syncing: ['island', 'Syncing…'], local: ['island', 'Syncing soon'], offline: ['rain', 'Offline — will sync'], failed: ['storm', 'Sync failed — retrying'], conflict: ['quest', 'Choose a save'], paused: ['lock', 'Cloud sync paused'] };
    const [ic, text] = map[c.status] || ['island', 'Cloud ready'];
    el.hidden = false;
    el.className = 'hud-note sync-note hud-glass ' + c.status;
    el.replaceChildren(icon(ic), h('span', text));
  }

  /** Visitor banner with a clear way home. */
  refreshVisit() {
    const v = this.game.visit;
    const el = this.el.visit;
    this.app.classList.toggle('visiting', !!v);
    if (!v) { el.hidden = true; return; }
    el.hidden = false;
    el.replaceChildren(icon('island'), h('span', `${v.hostName}’s ${v.islandName}`, h('small', (v.member ? ' · playing together' : ' · visiting') + (v.hostHere ? '' : ' · host is away'))),
      button('Leave', () => this.game.leaveVisit(), { cls: 'small', iconName: 'home' }));
  }

  /** Join a hosted game; from the title screen your own game loads first. */
  async joinHosted(res) {
    closeSheet(true);
    if (this.game.mode !== 'play') {
      if (!this.title.loaded?.state) { toast('Start a game first, then you can join friends.', 'island'); this.online.social.leaveSession(); return; }
      await this.title.continueGame();
      setTimeout(() => this.game.joinGame(res), 900);
      return;
    }
    this.game.joinGame(res);
  }

  /** Popups and events for hosted games. */
  wireSessions() {
    const social = this.online.social;
    social.handlers.onInvite = m => {
      sfx('quest');
      let close;
      close = modal(h('div.confirm',
        h('h3', `${m.name} invited you!`),
        h('p', `Join ${m.name}’s game to fish, gather and build together on their island. Your own island and progress stay safe.`),
        h('div.row.end',
          button('Not now', () => close(), { cls: 'ghost' }),
          button('Join game', async () => {
            close();
            try { this.joinHosted(await social.joinInvite(m.from)); }
            catch (err) { toast(friendlyError(err), null, 'error'); }
          }, { cls: 'primary', iconName: 'boat' }))), { cls: 'invite-modal' });
    };
    social.handlers.onJoined = m => toast(`${m.name} joined your game!`, 'friends', 'good');
    social.handlers.onSessionEnd = m => {
      const v = this.game.visit;
      const why = { stopped: 'The host closed the game.', host_left: 'The host left.', removed: 'The host removed you from the game.' }[m.reason] || 'The game ended.';
      toast(why + ' Heading home.', 'home');
      if (v && v.member && v.hostId === m.host) { v.member = false; this.game.leaveVisit(); }
    };
    social.handlers.onSessionMove = m => {
      const v = this.game.visit;
      if (v && v.member && v.hostId === m.host && v.islandId !== m.island) this.game.joinGame({ host: m.host, name: v.hostName, island: m.island });
    };
  }

  /** Load a friend's public island snapshot and go visit. */
  async visitFriend(fr) {
    // From the title screen: load your own game first, then sail over.
    if (this.game.mode !== 'play') {
      const st = this.title.loaded?.state;
      if (!st) { toast('Start a game first, then you can visit friends.', 'island'); return; }
      closeSheet(true);
      await this.title.continueGame();
      setTimeout(() => this.visitFriend(fr), 900);
      return;
    }
    try {
      const snap = await this.online.social.snapshotOf(fr.user);
      if (!snap?.data?.islands?.length) { toast(`${fr.name} hasn’t synced an island yet.`, 'island'); return; }
      const go = islandId => { closeSheet(true); this.game.startVisit({ hostId: fr.user, hostName: fr.name, snapshot: snap.data, islandId }); };
      if (snap.data.islands.length === 1) { go(snap.data.islands[0].id); return; }
      let close;
      close = modal(h('div.confirm', h('h3', `Visit ${fr.name}`), h('p', 'Which island would you like to see?'),
        h('div.list', snap.data.islands.map(i => button(`${i.name} · ${i.placements.length} things built`, () => { close(); go(i.id); }, { cls: 'wide', iconName: 'boat' }))),
        h('div.row.end', button('Cancel', () => close(), { cls: 'ghost' }))));
    } catch (err) {
      toast(friendlyError(err), null, 'error');
    }
  }

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
      h('h3', 'Time for bed?'),
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
