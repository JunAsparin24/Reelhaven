// Game orchestrator: owns the loop, the current island world, the player and
// the active mode (exploring, fishing, building, title screen).
import { setPlayerSprites, sprite } from './art/sprites.js';
import { TILE } from './art/tiles.js';
import { getState, setState, createNewState } from './state.js';
import { on, emit, toast } from './events.js';
import * as Save from './save.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Camera } from './camera.js';
import { Renderer } from './renderer.js';
import { Controls } from './controls.js';
import { FishingSession } from './fishing.js';
import { BuildMode } from './building.js';
import { findInteractable, nearbyInteractables, gather } from './interactions.js';

/** "You need a pickaxe." / "You need a better pickaxe." */
export function needToolText(tool, better = false) {
  const name = { axe: 'axe', pickaxe: 'pickaxe', scythe: 'scythe', sword: 'sword', hoe: 'hoe', watering_can: 'watering can' }[tool] || tool;
  if (better) return `You need a better ${name}.`;
  return `You need ${/^[aeiou]/.test(name) ? 'an' : 'a'} ${name}.`;
}

/** Interactions that are really "use your tool" (left click / tap, never E). */
const TOOL_KINDS = new Set(['clear', 'mine', 'attack', 'swing']);
import { tick as tickWeather, lighting, currentWeather, currentPhase } from './weather.js';
import { initQuests, ensureOrders, ensureDaily, currentQuest, setStoryIndex } from './quests.js';
import { travelTo } from './islands.js';
import { checkAchievements } from './progression.js';
import { initAudio, sfx, setVolumes, startMusic, setMood, pauseAudio, resumeAudio, setMusicScene } from './audio.js';
import { ISLANDS } from '../data/island-data.js';
import { INTERIORS } from '../data/interior-data.js';
import { markTalked } from './dialogue.js';
import { pendingSettings } from './ui/panels/settings.js';
import { FootstepSystem } from './footsteps.js';
import { GamepadInput, moveMenuFocus, confirmMenu } from './gamepad.js';
import { heldFor as heldForKey } from './bag.js';
import { buildCharacter } from './art/characters.js';
import { PLACEABLES } from '../data/building-data.js';
import { fullCost, checkCost, spend } from './economy.js';
import { countBuilt } from './building-count.js';
import { hasBlueprint } from './shop.js';
import { reasonText } from './building.js';
import { addXp } from './progression.js';
import { commit, uid } from './state.js';
import { mineFloor } from '../data/mine-data.js';
import { forgetMap } from './world-gen.js';
import { swing, updateMonsters, faceToward as facePoint, frontTile, SWING_TOOLS } from './combat.js';
import { sleepToMorning, setClock } from './weather.js';
import { shiftSunnyLayout } from './save.js';
import { FARM_ISLAND, seedYard, seedWild, seedBig, sproutWeeds, growFarms, hitDebris, harvest, farmBlocker } from './farm.js';
import { seasonOf } from '../data/farm-data.js';
import { memberSlot, notePersonal, noteJoined, personalName, lastPersonal } from './worlds.js';
import { clearUrlCache } from './art/sprites.js';
import { FLOOR_CHESTS, SWORDS } from '../data/weapon-data.js';
import { finishConstruction, underConstruction, siloCapacity, checkRecipes, ensureLife, onNewDay, talkedTo, giveGift, giftable, giftName, animalsIn, petAnimal, fillTrough, useMachine, sendMail, spendEnergy, energyCost } from './life.js';
import { SCHEDULES, OPENING_HOURS, FESTIVALS, FESTIVAL_HOURS, FESTIVAL_SPOTS, BOSSES, ANIMALS, TAP_DAYS } from '../data/life-data.js';
import { crowsVisit } from './farm.js';
import { PLACEABLES as ALL_PLACEABLES } from '../data/building-data.js';
import { RESOURCES } from '../data/item-data.js';
import { addCoins as addCoinsTo, addItem as addItemTo } from './economy.js';

/** A fresh character for a friend's world (separate from all your own saves). */
function createMemberState(profile, res) {
  const st = createNewState(profile);
  st.member = { world: res.world, owner: res.host, ownerName: res.name };
  st.worldName = res.worldName;
  st.player.island = res.island || 'sunny';
  // The world's story is shared: the host tells us where it's at when we arrive.
  st.flags = { ...st.flags, giftOpened: true, mineOpen: true };
  st.quests.index = 0;
  st.quests.waitHost = true;
  return st;
}

export class Game {
  constructor({ canvas, ui }) {
    this.canvas = canvas;
    this.ui = ui;
    this.mode = 'title';          // 'title' | 'play'
    this.world = null;
    this.player = null;
    this.camera = new Camera();
    this.renderer = new Renderer(canvas);
    this.fishing = null;
    this.build = new BuildMode(this);
    this.footsteps = new FootstepSystem(this);
    this.visit = null;
    this.indoor = null;           // { id, outside: World, ret: {x, y}, mine? } while inside a building or the mine
    this.activeWorld = { kind: 'personal', slot: 'main' };   // which world's save is playing
    this.home = null;             // your own world to return to after a friend's
    this.sleeping = false;        // in bed, waiting for everyone else (multiplayer)
    this.sleepers = new Set();    // other players on this island who are in bed
    this.remotes = new Map();
    this.charCache = new Map();
    this.interactTarget = null;
    this.revealedSpots = new Set();
    this.paused = false;
    this.last = 0;
    this.timers = { orders: 0, daily: 0, pos: 0, nodes: 0 };
    this.autosave = Save.createAutosaver(getState);
    this.controls = new Controls(canvas, {
      isBlocked: () => this.inputBlocked(),
      mode: () => (this.build.active ? 'build' : this.mode),
      onTap: (x, y) => this.onTap(x, y),
      onAltTap: (x, y) => this.onAltTap(x, y),
      onInteractKey: e => this.onInteractKey(e),
      onEscape: () => this.onEscape(),
      onRotateKey: () => { if (this.build.active && this.build.type) this.build.rotate(); },
      onHorseKey: () => { if (this.mode === 'play' && !this.inputBlocked()) this.setRiding(!this.riding); },
      onHotkey: n => this.onHotkey(n),
      onKeyNudge: dir => this.build.active && this.build.type && this.build.nudge(...{ up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir]),
      onDrag: (dx, dy) => this.onBuildDrag(dx, dy),
      onDragEnd: () => { this.dragAcc = null; },
    });
    this.pad = new GamepadInput({
      blocked: () => this.inputBlocked(),
      fishing: () => !!(this.fishing && this.fishing.active),
      connected: () => toast('Controller connected! A interact · X use tool · B back · Y bag · LB/RB hotbar.', 'sparkle'),
      interact: down => {
        if (this.fishing && this.fishing.active) { window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code: 'KeyE', key: 'e' })); return; }
        if (down) this.onInteractKey();
      },
      use: () => { const p = this.player; if (p) this.useHeld({ x: p.x, y: p.y }); },
      back: () => this.onEscape(),
      menu: name => { if (this.mode === 'play') this.ui.navTo(name); },
      cycle: dir => {
        const s = getState(); if (!s || this.mode !== 'play') return;
        const keys = this.ui.hotbar?.keys || [];
        const cur = keys.findIndex(k => k && heldForKey(k) === s.inventory.held);
        for (let i = 1; i <= keys.length; i++) { const j = (cur + dir * i + keys.length * 2) % keys.length; if (keys[j]) { this.ui.hotbar.pick(j); break; } }
      },
      confirm: () => { if (this.ui.dialogueUI.open) this.ui.dialogueUI.advance(); else confirmMenu(); },
      focusMove: dir => moveMenuFocus(dir),
    });
  }

  boot() {
    this.bindEvents();
    this.showTitleWorld();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
    window.addEventListener('resize', () => this.onResize());
    // The stage changes size when the HUD appears or the phone rotates.
    if ('ResizeObserver' in window) new ResizeObserver(() => this.onResize()).observe(this.canvas);
    window.visualViewport?.addEventListener('resize', () => this.onResize());
    // Going fullscreen or rotating can change the size without a resize event on some phones.
    for (const ev of ['fullscreenchange', 'orientationchange']) (ev === 'fullscreenchange' ? document : window).addEventListener(ev, () => setTimeout(() => this.onResize(), 150));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.paused = true; this.persistNow(); pauseAudio(); }
      else { this.paused = false; this.last = performance.now(); resumeAudio(); }
    });
    window.addEventListener('pagehide', () => this.persistNow());
  }

  onResize() {
    this.renderer.resize();
    this.camera.resize(this.renderer.viewW, this.renderer.viewH);
    if (this.world) this.camera.clamp(this.world);
  }

  // ---------------------------------------------------------------- lifecycle
  showTitleWorld() {
    const temp = createNewState({ name: 'Title', look: { skin: '#e8b48f', hair: '#7a4a2c', shirt: '#5b9be0' } });
    this.titleState = temp;
    this.world = new World('sunny', temp.islands.sunny);
    this.renderer.setWorld(this.world);
    this.onResize();
    this.camera.snap(22 * TILE, 30 * TILE, this.world);
  }

  /** Start a fresh world in the current personal save slot. */
  newGame(profile, { worldName = null } = {}) {
    const st = createNewState(profile);
    st.settings = { ...st.settings, ...pendingSettings };
    if (worldName) st.worldName = worldName;
    setState(st);
    Save.save(st);
    this.activeWorld = { kind: 'personal', slot: Save.currentSlot() };
    notePersonal(Save.currentSlot(), { name: st.worldName || personalName(Save.currentSlot()), charName: st.player.name, level: 1, lastPlayed: Date.now() });
    this.ui.online?.cloud?.claimNew?.();
    this.enterPlay();
    this.startInCottage();
    emit('newGame');
  }

  // ---------------------------------------------------------------- worlds
  /**
   * Every world is its own save (js/worlds.js): your own worlds, and a
   * separate character for each friend's world you join. activeWorld says
   * which one is playing; saves and cloud uploads always go to that slot.
   */
  usePersonalSlot(slot) {
    Save.setSlot(slot);
    this.ui.online?.cloud?.setSlot?.({ id: slot });
    this.activeWorld = { kind: 'personal', slot };
  }

  /**
   * Join a friend's world (after the server accepted the code / invite).
   * Loads your character for that world — or asks you to create one the
   * first time — and never touches your own worlds' saves.
   */
  async joinWorld(res) {
    // Host sailed to another island in the same world: just follow.
    if (this.visit && this.visit.world === res.world) { this.joinGame(res); return; }
    const online = this.ui.online;
    // going to a friend's world closes yours (and sends its players home)
    if (online?.social.hosting) await online.social.hostStop().catch(() => {});
    if (this.mode === 'play') { this.persistNow(); await online?.cloud?.flush?.(); }
    const prev = this.activeWorld;
    if (this.visit) { this.leaveChannel(); this.visit = null; }
    const slot = memberSlot(res.world);
    Save.setSlot(slot);
    online?.cloud?.setSlot?.({ id: slot, member: true, world: res.world });
    let state = Save.load().state;
    if (online?.auth.signedIn) {
      try { const r = await online.cloud.reconcile(); state = r.state || state; } catch (err) { console.warn('character sync failed', err); }
    }
    let created = false;
    if (!state) {
      const profile = await this.ui.worldCharacter(res);
      if (!profile) {
        // cancelled: back to whatever was playing before
        online?.social.leaveSession();
        if (prev?.kind === 'personal') this.usePersonalSlot(prev.slot);
        return;
      }
      state = createMemberState(profile, res);
      created = true;
    }
    if (prev?.kind === 'personal') this.home = prev;
    this.activeWorld = { kind: 'member', world: res.world, slot, host: res.host };
    setState(state);
    Save.save(state);
    if (created) online?.cloud?.claimNew?.();
    noteJoined(res.world, { owner: res.host, ownerName: res.name, worldName: res.worldName, charName: state.player.name, level: state.player.level, lastPlayed: Date.now() });
    setPlayerSprites(state.player.look);
    clearUrlCache('portrait_player');
    if (this.mode !== 'play') {
      initAudio(); setVolumes(state.settings); startMusic();
      this.mode = 'play';
      this.ui.enterPlay();
    }
    initQuests();
    this.ui.refreshHud();
    await this.joinGame(res);
  }

  /** Back to your own world after leaving someone else's. */
  goHome() {
    const home = this.home || { kind: 'personal', slot: lastPersonal() || 'main' };
    this.home = null;
    this.usePersonalSlot(home.slot);
    const st = Save.load().state;
    if (!st) { this.mode = 'play'; this.returnToTitle(); return; }
    setState(st);
    setPlayerSprites(st.player.look);
    clearUrlCache('portrait_player');
    this.loadIsland(st.player.island, true);
    initQuests();
    this.ui.refreshHud();
  }

  continueGame(loaded) {
    setState(loaded);
    if (!loaded.member) {
      this.activeWorld = { kind: 'personal', slot: Save.currentSlot() };
      notePersonal(Save.currentSlot(), { charName: loaded.player.name, level: loaded.player.level, lastPlayed: Date.now() });
    }
    this.enterPlay();
  }

  enterPlay() {
    const s = getState();
    initAudio();
    setVolumes(s.settings);
    setMood(['evening', 'night'].includes(currentPhase()) ? 'night' : 'day');
    startMusic();
    setPlayerSprites(s.player.look);
    this.mode = 'play';
    this.loadIsland(s.player.island, true);
    initQuests();
    checkAchievements();
    this.ui.enterPlay();
  }

  loadIsland(id, keepPos = false) {
    const s = getState();
    this.indoor = null;
    this.world = new World(id, s.islands[id]);
    // First time home: the yard is covered in trees, stones and weeds.
    ensureLife(s);
    if (id === FARM_ISLAND) {
      const a = seedYard(this.world, s.islands[id]);
      if (a) this.world.syncDebris();
      const b = seedWild(this.world, s.islands[id]);
      if (b) this.world.syncDebris();
      const c = seedBig(this.world, s.islands[id]);
      if (a || b || c) { this.world.syncDebris(); commit('seedYard', false); }
    }
    this.renderer.setWorld(this.world);
    this.revealedSpots = new Set();
    const pos = keepPos && s.player.pos ? s.player.pos : ISLANDS[id].spawn;
    this.player = new Player(0, 0, s.player.facing || 'down');
    this.footsteps.attach(this.player);
    this.player.placeAtTile(pos.x, pos.y);
    // If the saved position became blocked (e.g. something was built), find space.
    if (!this.world.walkableTile(pos.x, pos.y)) {
      const n = this.world.nearestWalkable(ISLANDS[id].spawn.x, ISLANDS[id].spawn.y, pos.x, pos.y) || ISLANDS[id].spawn;
      this.player.placeAtTile(n.x, n.y);
    }
    this.world.setArea(this.world.areaAt(this.player.tileX, this.player.tileY));
    this.onResize();
    this.camera.snap(this.player.x, this.player.y, this.world);
  }

  /** Travel with a fade transition. */
  travel(id) {
    if (this.fishing) this.stopFishing();
    const res = travelTo(id);
    if (!res.ok) { toast(res.message, null, 'error'); return; }
    sfx('unlock');
    this.ui.fade(() => {
      this.loadIsland(id);
      this.ui.closeAll();
    }, ISLANDS[id].name);
  }

  /** Save and go back to the title screen (Continue resumes right here). */
  returnToTitle() {
    if (this.mode !== 'play') return;
    if (this.fishing) this.stopFishing();
    if (this.build.active) this.ui.closeBuild();
    this.persistNow();
    this.ui.online?.cloud?.flush?.();
    if (this.visit) this.ui.online?.social.leaveSession();
    // the host leaving closes their world: everyone in it is sent home
    if (this.ui.online?.social.hosting) this.ui.online.social.hostStop().catch(() => {});
    this.leaveChannel();
    this.visit = null;
    this.home = null;
    this.ui.online?.social.setStatus({ status: 'home' });
    this.ui.closeAll();
    this.mode = 'title';
    this.ui.refreshVisit();
    this.ui.app.classList.remove('playing', 'fishing', 'building', 'talking');
    this.ui.title.show();
  }

  persistNow() {
    const s = getState();
    if (!s || this.mode !== 'play') return;
    this.syncPlayerToState();
    this.autosave.flush();
  }

  syncPlayerToState() {
    const s = getState();
    // In a friend's world the host's map rules, so your character's position isn't kept.
    if (!s || !this.player || this.visit) return;
    s.player.pos = this.indoor ? { ...this.indoor.ret } : { x: this.player.tileX, y: this.player.tileY };
    s.player.facing = this.player.facing;
  }

  // ---------------------------------------------------------------- visits
  /**
   * Visit a friend's island from their public snapshot. A temporary world is
   * built from the snapshot; the visitor's own state (save, island, position,
   * inventory) is never modified and saving continues as normal.
   */
  startVisit({ hostId, hostName, snapshot, islandId, member = true, world = null, worldName = null }) {
    if (this.fishing) this.stopFishing();
    if (this.build.active) this.ui.closeBuild();
    // Joined players may arrive before the host ever synced: start empty, the
    // host's live layout arrives a moment later.
    const islands = snapshot?.islands?.length ? snapshot.islands : [{ id: islandId || 'sunny', placements: [], flags: {} }];
    const isl = islands.find(i => i.id === islandId) || (member ? { id: islandId, placements: [], flags: {} } : islands[0]);
    if (!isl || !ISLANDS[isl.id]) { toast('That island can’t be visited right now.', null, 'error'); return; }
    // A friend whose game hasn't updated yet still shares the old, smaller map.
    if (isl.id === 'sunny' && (isl.layout || 1) < 2 && isl.placements?.length) shiftSunnyLayout(isl);
    this.syncPlayerToState();
    this.ui.fade(() => {
      this.leaveChannel();
      const temp = {
        unlocked: true, visited: true, nodes: {}, gardens: {}, flags: { ...(isl.flags || {}) },
        placements: isl.placements.filter(p => p && typeof p.type === 'string').map((p, i) => ({ ...p, uid: 'visit' + i })),
      };
      this.indoor = null;
      this.sleeping = false;
      this.sleepers = new Set();
      this.visit = { hostId, hostName, islandId: isl.id, islandName: isl.name || ISLANDS[isl.id].name, hostHere: false, member: true, world, worldName };
      this.world = new World(isl.id, temp);
      this.renderer.setWorld(this.world);
      this.revealedSpots = new Set();
      const sp = ISLANDS[isl.id].spawn;
      this.player = new Player(0, 0, 'up');
      this.footsteps.attach(this.player);
      this.player.placeAtTile(sp.x, sp.y);
      this.world.setArea(this.world.areaAt(sp.x, sp.y));
      this.onResize();
      this.camera.snap(this.player.x, this.player.y, this.world);
      this.joinChannel(hostId, isl.id);
      this.ui.online?.social.setStatus({ status: 'playing' });
      this.ui.refreshVisit();
    }, worldName || `${hostName}’s world`);
  }

  /** Leave a friend's world: your character there is saved, then you go home. */
  leaveVisit() {
    if (!this.visit) return;
    this.ui.online?.social.leaveSession();
    this.persistNow();
    this.ui.online?.cloud?.flush?.();
    this.ui.fade(() => {
      this.leaveChannel();
      this.visit = null;
      this.sleeping = false;
      this.goHome();
      this.ui.online?.social.setStatus({ status: 'home' });
      this.ui.refreshVisit();
    }, 'Home sweet home');
  }

  /** Live channel for whichever island we're on (as host or visitor). */
  joinChannel(hostId, islandId) {
    const online = this.ui.online;
    if (!online?.auth.signedIn) return;
    const key = hostId + ':' + islandId;
    if (this.channel && this.channelKey === key) return;
    this.leaveChannel();
    const s = getState();
    this.remotes = new Map();
    this.channelKey = key;
    this.channel = online.social.joinIsland(hostId, islandId, {
      name: s.player.name, look: s.player.look, r: this.roomKey(),
      host: hostId === online.auth.user.id, x: this.player.x, y: this.player.y, f: this.player.facing,
    }, {
      onPeers: list => {
        const ids = new Set(list.map(p => p.id));
        for (const id of [...this.remotes.keys()]) if (!ids.has(id)) this.remotes.delete(id);
        for (const p of list) {
          const known = this.remotes.get(p.id);
          const r = known || { x: p.x, y: p.y, tx: p.x, ty: p.y, f: p.f || 'down', anim: 0, room: p.r || '' };
          Object.assign(r, { id: p.id, host: p.host, member: p.member });
          if (!r.ownLook) { r.look = p.look; }
          if (!r.ownName) r.name = p.n || p.name;
          this.remotes.set(p.id, r);
        }
        for (const id of [...this.sleepers]) if (!ids.has(id)) this.sleepers.delete(id);
        if (this.visit) { this.visit.hostHere = list.some(p => p.host); this.ui.refreshVisit(); }
        else {
          this.ensureGuestCabins(list);
          this.shareLayout();      // newcomers get the host's live layout
          this.shareClock(true);
          this.shareStory();
        }
        if (this.sleeping) this.ui.online?.social.relay('sleep', { on: true });
        this.shareMe();
        this.lastSent = null;   // everyone gets our room right away
        this.ui.refreshSleep?.();
        this.checkSleep();
      },
      onRelay: m => this.onRelay(m),
      onCoopEdit: m => this.hostCoopEdit(m),
      onCoopLayout: m => this.applyCoopLayout(m),
      onMove: (id, pos) => {
        const r = this.remotes.get(id);
        if (!r) return;
        const room = pos.r || '';
        if (room !== (r.room || '')) { r.x = pos.x; r.y = pos.y; }   // walked through a door: no sliding across the map
        r.tx = pos.x; r.ty = pos.y; r.f = pos.f || r.f; r.room = room;
        if (pos.n) r.name = pos.n;
      },
    });
  }

  leaveChannel() {
    if (this.channel) { try { this.channel.leave(); } catch { /* already closed */ } }
    this.channel = null; this.channelKey = null; this.remotes = new Map(); this.sleepers = new Set();
  }

  /** Which room you're in: '' outdoors, else the interior (and whose building / which mine floor). */
  roomKey() {
    if (!this.indoor) return '';
    if (this.world?.def.mine) return 'mine:' + this.world.def.level;
    return this.world.id + (this.indoor.home ? ':' + this.indoor.home : '');
  }

  /** Other players standing in the same place as you. */
  remotesHere() {
    if (!this.remotes) return [];
    const k = this.roomKey();
    return [...this.remotes.values()].filter(r => (r.room || '') === k);
  }

  /** Tell everyone in this world who you are here (name + look). */
  shareMe() {
    const s = getState();
    this.ui.online?.social.relay('me', { name: s.player.name, look: s.player.look });
  }

  /** Wave at a friend, or hand them what you're holding. */
  waveAt(r) {
    this.ui.online?.social.relay('wave', { to: r.id });
    this.player.cheer?.(0.8);
    this.renderer.floatText('Hi!', this.player.x, this.player.y - 28, '#fff5df');
    sfx('click');
  }

  giveTo(r) {
    const s = getState(), key = s.inventory.held;
    if (!key || key.startsWith('fish:') || !giftable(key) || !(s.inventory.items[key] > 0)) { toast('Hold an item from your bag to give it.', 'gift'); return; }
    s.inventory.items[key] -= 1;
    if (s.inventory.items[key] <= 0) delete s.inventory.items[key];
    this.ui.online?.social.relay('give', { to: r.id, item: key, n: 1 });
    toast(`You gave ${r.name} 1 ${giftName(key)}.`, 'gift', 'good');
    sfx('coin');
    commit('give');
    this.ui.hotbar?.render();
  }

  /** Throttled position broadcast + smooth movement of other players. */
  updateRemotes(dt) {
    const online = this.ui.online;
    // Hosts are reachable on their own island whenever they're signed in.
    if (!this.visit && online?.auth.signedIn && this.mode === 'play') this.joinChannel(online.auth.user.id, this.outdoor.id);
    if (!this.channel) return;
    this.netT = (this.netT || 0) - dt;
    // Indoors you're in that room for everyone else too (same shop, same mine floor...).
    const p = this.player, room = this.roomKey(), myName = getState().player.name;
    const moved = !this.lastSent || Math.hypot(p.x - this.lastSent.x, p.y - this.lastSent.y) > 0.5 || p.facing !== this.lastSent.f || room !== this.lastSent.r;
    if ((moved && this.netT <= 0) || this.netT < -2) {
      this.netT = 0.12;
      this.lastSent = { x: Math.round(p.x), y: Math.round(p.y), f: p.facing, r: room, n: myName };
      try { this.channel.send(this.lastSent); } catch { /* reconnecting */ }
    }
    this.clockT = (this.clockT || 0) - dt;
    if (this.clockT <= 0) { this.clockT = 8; this.shareClock(); }
    for (const r of this.remotes.values()) {
      const dx = r.tx - r.x, dy = r.ty - r.y, d = Math.hypot(dx, dy);
      r.moving = d > 0.6;
      if (d > 80) { r.x = r.tx; r.y = r.ty; }
      else if (r.moving) { const k = Math.min(1, dt * 10); r.x += dx * k; r.y += dy * k; r.anim += dt * 8; }
      if (!r.sprites || r.lookKey !== JSON.stringify(r.look)) {
        r.lookKey = JSON.stringify(r.look);
        const look = r.look && r.look.skin ? r.look : { skin: '#e8b48f', hair: '#4a3328', shirt: '#6dbb72' };
        r.sprites = this.charCache.get(r.lookKey) || buildCharacter(look);
        this.charCache.set(r.lookKey, r.sprites);
      }
    }
  }

  bindEvents() {
    on('change', e => {
      if (this.mode !== 'play') return;
      this.syncPlayerToState();
      this.autosave.schedule(e && e.important === false ? 8000 : 900);
    });
    on('fishing:splash', ({ x, y, big, small }) => {
      this.renderer.emit('splash', x, y, big ? 18 : small ? 5 : 10, { speed: big ? 70 : 45 });
    });
    on('coins', ({ delta, source }) => {
      if (this.mode !== 'play' || !this.player) return;
      if (source === 'sale' || source === 'order' || source === 'treasure') {
        this.renderer.emit('coin', this.player.x, this.player.y - 26, Math.min(14, 3 + Math.floor(delta / 25)), { speed: 55, gravity: 140, life: 0.9 });
        sfx('coin');
      }
    });
    on('built', ({ x, y, fw, fh }) => {
      if (this.indoor) return;
      this.renderer.emit('leaf', (x + fw / 2) * TILE, (y + fh) * TILE - 4, 16, { speed: 50, life: 0.8, color: '#e8c98e', gravity: 60 });
      this.renderer.emit('sparkle', (x + fw / 2) * TILE, (y + fh / 2) * TILE, 10, { speed: 40, gravity: 10 });
    });
    on('weather', ({ weather }) => {
      if (this.mode === 'play' && weather === 'storm') { sfx('thunder'); }
    });
    on('phase', ({ phase }) => setMood(phase === 'night' || phase === 'evening' ? 'night' : 'day'));
    // A new morning: crops grow, weeds sprout, the mine opens on Day 5.
    on('questClaimed', () => checkRecipes());
    on('questClaimed', def => {
      if (!this.channel) return;
      if (this.visit) this.ui.online?.social.relay('story_claim', { index: def.index });
      else this.shareStory();
    });
    on('restored', () => {
      // a restoration project can change the map (the long pier)
      const w = this.indoor ? this.outdoor : this.world;
      if (w?.id !== FARM_ISLAND) return;
      w.applyFlags(); w.rebuild();
      if (!this.indoor) this.renderer.buildLand();
    });
    on('newDay', ({ day }) => {
      if (this.mode !== 'play' || this.visit) return;
      const s = getState();
      growFarms(day, s.world.weather);
      this.waterSprinklers();
      const eaten = crowsVisit(day);
      if (eaten.length) setTimeout(() => toast(`Crows ate ${eaten.length === 1 ? 'your ' + eaten[0] : eaten.length + ' of your crops'}! A scarecrow keeps them away.`, 'flower', 'error'), 3000);
      const summary = onNewDay(day);
      finishConstruction(day).forEach((msg, i) => setTimeout(() => toast(msg, 'build', 'gold'), 600 + i * 900));
      checkRecipes();
      if (summary.shipped) setTimeout(() => toast(`Your shipping bin earned ${summary.shipped} coins overnight!`, 'coin', 'gold'), 1200);
      if (summary.products) setTimeout(() => toast(`Your animals have ${summary.products} thing${summary.products === 1 ? '' : 's'} for you.`, 'egg', 'good'), 1800);
      const fest = FESTIVALS[seasonOf(day).season];
      if (fest && seasonOf(day).day === fest.day) setTimeout(() => toast(`Today is the ${fest.name}! Head to the quest board in town, 9 AM – 3 PM.`, 'sparkle', 'gold'), 2400);
      if (fest && seasonOf(day + 1).day === fest.day) sendMail({ id: `fest_${fest.id}_${seasonOf(day).year}`, from: 'Nori', subject: `Tomorrow: the ${fest.name}!`, body: `${fest.desc} Come by the quest board in town between 9 AM and 3 PM.`, attach: {} });
      const home = this.outdoor;
      if (home?.id === FARM_ISLAND) { sproutWeeds(home, s.islands[FARM_ISLAND], 3); home.syncDebris(); }
      if (!s.flags.mineOpen && day >= 5) {
        s.flags.mineOpen = true;
        setTimeout(() => toast('Rowan cleared the rocks at the Old Mine. It’s open!', 'pickaxe', 'gold'), 1500);
      }
      commit('newDay');
    });
    // Seasons repaint the grass.
    on('season', ({ season }) => {
      if (this.mode !== 'play') return;
      if (!this.indoor) this.renderer.buildLand();
      const n = seasonOf(getState().world.day);
      setTimeout(() => toast(`${n.name} has arrived! ${season === 'winter' ? 'Bundle up — and plant Frost Leeks.' : 'New seeds are in at Nori’s.'}`, 'sun', 'gold'), 1200);
    });
    on('settings', () => { const s = getState(); setVolumes(s.settings); });
    // Friends on my island see my building changes live.
    on('change', e => { if (e && ['build', 'move', 'store', 'bridge'].includes(e.reason)) this.shareLayout(); });
  }

  // ---------------------------------------------------------------- input
  inputBlocked() {
    return this.mode !== 'play' || this.ui.blocking() || (this.fishing && this.fishing.active) || this.sleeping;
  }

  onTap(cssX, cssY) {
    if (this.mode !== 'play' || !this.world) return;
    initAudio();
    const b = this.renderer.cssToBuffer(cssX, cssY);
    const wpt = this.camera.toWorld(b.x, b.y);
    const tx = Math.floor(wpt.x / TILE), ty = Math.floor(wpt.y / TILE);
    if (this.build.active) { this.build.tapTile(tx, ty); return; }
    // A left click / tap uses what you're holding (no tap-to-walk: steer with
    // the joystick or WASD / arrow keys).
    this.useHeld(wpt);
  }

  /** Right click (mouse): talk to, open or pick up what you clicked, or what's nearest. */
  onAltTap(cssX, cssY) {
    if (this.mode !== 'play' || !this.world || this.build.active || this.inputBlocked()) return;
    initAudio();
    const b = this.renderer.cssToBuffer(cssX, cssY);
    const wpt = this.camera.toWorld(b.x, b.y);
    const target = this.interactableNear(wpt.x, wpt.y);
    let it = (target && findInteractable(this, 1.6, target.match)) || this.interactTarget;
    if (it?.kind === 'npc' && giftable(getState().inventory.held)) it = { kind: 'gift_npc', npc: it.npc, label: it.label };
    if (it) this.interact(it);
  }

  /** Find a tappable object at a world point (generous hit area for thumbs). */
  interactableNear(x, y) {
    const w = this.world;
    let best = null, bestD = 20;
    const test = (px, py, tx, ty, match, r = 20, npc = false) => {
      const d = Math.hypot(px - x, py - y);
      if (d < r && d < bestD) { bestD = d; best = { tx, ty, match, npc }; }
    };
    for (const n of w.npcs) test(n.x, n.y - 10, Math.floor(n.x / TILE), Math.floor((n.y - 1) / TILE), it => it.npc === n, 20, true);
    for (const s of w.spots) {
      if (s.hidden && !this.revealedSpots.has(s.id)) continue;
      test(s.waterX * TILE + 8, s.waterY * TILE + 8, s.x, s.y, it => it.spot === s, 22);
      test(s.x * TILE + 8, s.y * TILE + 8, s.x, s.y, it => it.spot === s, 12);
    }
    for (const o of w.objects) {
      if (!(o.def.resource || o.def.interact) || w.objectHidden(o) || o.def.quiet || !w.inBounds(o.x, o.y)) continue;
      const fp = o.def.footprint || { w: 1, h: 1 };
      test(o.x * TILE + fp.w * 8, (o.y + fp.h) * TILE - 10, o.x + Math.floor(fp.w / 2), o.y + fp.h, it => it.obj === o, fp.w > 1 || o.type === 'boat' ? 30 : 18);
    }
    for (const p of w.placed) {
      if (p.def.kind !== 'building' && !p.def.use) continue;
      test(p.x * TILE + p.fw * 8, (p.y + p.fh) * TILE - 12, p.x + Math.floor(p.fw / 2), p.y + p.fh, it => it.placement === p, p.def.use ? 18 : 30);
    }
    for (const m of w.monsters) {
      if (m.dead) continue;
      test(m.x, m.y - 8, Math.floor(m.x / TILE), Math.floor((m.y - 1) / TILE), it => it.monster === m, 20, true);
    }
    return best;
  }

  /** Closest free tile next to (tx, ty) — used to stand beside NPCs, not on them. */
  besideTile(tx, ty) {
    const p = this.player;
    let best = null, bestD = Infinity;
    // Prefer standing to the side so sprites don't stack vertically.
    for (const [dx, dy, pen] of [[-1, 0, 0], [1, 0, 0], [0, 1, 3], [0, -1, 4]]) {
      const x = tx + dx, y = ty + dy;
      if (!this.world.walkableTile(x, y)) continue;
      const d = Math.abs(x - p.tileX) + Math.abs(y - p.tileY) + pen;
      if (d < bestD) { bestD = d; best = { x, y }; }
    }
    return best || this.world.nearestWalkable(tx, ty, p.tileX, p.tileY);
  }

  onInteractKey() {
    if (this.mode !== 'play') return false;
    if (this.fishing && this.fishing.active) return false; // fishing UI handles keys
    if (this.ui.blocking()) return false;
    // E / Space only interact (talk, open, enter, fish...). Tools are used with a left click.
    const list = nearbyInteractables(this, 8).filter(x => !TOOL_KINDS.has(x.kind));
    if (!list.length) return false;
    // what you're facing wins over something just beside you
    const p = this.player, [fx, fy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[p.facing] || [0, 1];
    const score = x => {
      const dx = (x.ax ?? p.x) - p.x, dy = (x.ay ?? p.y) - (p.y - 4), len = Math.hypot(dx, dy);
      if (len < 6) return x.d + 10;   // someone standing right on top of you isn't what you're looking at
      return x.d - ((dx * fx + dy * fy) / len > 0.5 ? 14 : 0);
    };
    this.interact(list.sort((a, b) => score(a) - score(b))[0]);
    return true;
  }

  /**
   * Left click / tap on the world: swing the held tool (or plant the held
   * seeds) toward where you clicked, any time. With the rod (or something
   * that isn't a tool) it uses what you clicked, or whatever is nearby.
   */
  useHeld(wpt) {
    if (this.inputBlocked()) return false;
    const p = this.player;
    const held = getState().inventory.held || '';
    if (SWING_TOOLS.has(held) || held.startsWith('seed:')) {
      p.cancelPath();
      // The action always happens on the tile you're facing (see the marker).
      swing(this, held);
      return true;
    }
    const target = this.interactableNear(wpt.x, wpt.y);
    let it = (target && findInteractable(this, 1.6, target.match)) || this.interactTarget;
    if (it?.kind === 'npc' && giftable(held)) it = { kind: 'gift_npc', npc: it.npc, label: it.label };
    if (it) { this.interact(it); return true; }
    return false;
  }

  /** Number keys pick a hotbar slot. */
  onHotkey(n) {
    if (this.mode !== 'play' || this.ui.blocking()) return false;
    return this.ui.hotbar?.pick(n - 1) || false;
  }

  onEscape() {
    if (this.ui.handleEscape()) return;
    if (this.build.active) { if (this.build.type) this.build.cancelPlacement(); else this.ui.closeBuild(); return; }
    if (this.fishing) this.stopFishing();
  }

  onBuildDrag(dx, dy) {
    if (!this.build.active || !this.build.type) return;
    // Convert css drag into whole tiles.
    this.dragAcc = this.dragAcc || { x: 0, y: 0 };
    this.dragAcc.x += (dx * this.renderer.dpr) / this.renderer.scale;
    this.dragAcc.y += (dy * this.renderer.dpr) / this.renderer.scale;
    const mx = Math.trunc(this.dragAcc.x / TILE), my = Math.trunc(this.dragAcc.y / TILE);
    if (mx || my) { this.build.nudge(mx, my); this.dragAcc.x -= mx * TILE; this.dragAcc.y -= my * TILE; }
  }

  /**
   * Visitors can only look around and talk to NPCs. Players who joined the
   * host's game can also fish, gather and shop (progress goes to their own
   * save). Things that would change the host's island directly stay off.
   */
  /** Join a hosted game (from an invite code or a friend's invite). */
  async joinGame({ host, name, island, world = null, worldName = null }) {
    let snap = null;
    try { snap = (await this.ui.online.social.snapshotOf(host))?.data || null; } catch { /* start empty */ }
    const v = this.visit;
    this.startVisit({ hostId: host, hostName: name, snapshot: snap, islandId: island, world: world || v?.world, worldName: worldName || v?.worldName });
  }

  canUse(it) {
    if (!this.visit) return true;
    if (['npc', 'enter', 'exit'].includes(it.kind)) return true;
    // Joined players can fish, gather, shop, mine and sleep (their own progress);
    // a host's chests stay the host's.
    if (it.kind === 'use') return this.visit.member && it.placement?.def.use !== 'chest';
    if (it.kind === 'use') return this.visit.member && it.placement?.def.use === 'chest';   // chests are shared with everyone in the world
    return this.visit.member && ['spot', 'gather', 'shop', 'hall', 'board', 'bed', 'mine_enter', 'mine', 'attack', 'descend', 'ascend', 'swing', 'floor_chest',
      'ship', 'mail', 'museum', 'gift_npc', 'festival', 'elevator', 'boss_chest', 'pet', 'friend_wave', 'friend_give', 'construction'].includes(it.kind);
  }

  // ---------------------------------------------------------------- co-op
  /** Host: send the island's live layout to everyone on it. */
  shareLayout() {
    const online = this.ui.online;
    if (this.visit || !this.channel || !online?.auth.signedIn) return;
    const isl = getState().islands[this.outdoor.id];
    online.social.shareLayout({ bridgeRepaired: !!isl.flags.bridgeRepaired },
      isl.placements.map(({ uid, type, x, y, rot, owner, ownerName }) => ({ uid, type, x, y, rot, ...(owner ? { owner, ownerName } : {}) })));
  }

  /** Host: a visiting friend wants to place or move something. */
  hostCoopEdit(m) {
    const social = this.ui.online?.social;
    const reply = (ok, error = '', data) => social?.coopResult(m.from, m.req, ok, error, data);
    const s = getState();
    if (m.op === 'chest') {
      // a friend uses one of your chests: your game holds the contents
      if (this.visit || this.mode !== 'play') return reply(false, 'The host isn’t on this island right now.');
      const isl = s.islands[this.outdoor.id];
      const pl = isl.placements.find(p => p.uid === m.uid);
      if (!pl || PLACEABLES[pl.type]?.use !== 'chest') return reply(false, 'That chest isn’t there any more.');
      isl.chests = isl.chests || {};
      const box = (isl.chests[pl.uid] = isl.chests[pl.uid] || {});
      if (m.dir === 'put' && m.item && m.n > 0) box[m.item] = (box[m.item] || 0) + m.n;
      if (m.dir === 'take') {
        if ((box[m.item] || 0) < m.n || m.n <= 0) return reply(false, 'Someone already took that.', box);
        box[m.item] -= m.n; if (box[m.item] <= 0) delete box[m.item];
      }
      if (m.dir !== 'peek') commit('coopChest', false);
      return reply(true, '', box);
    }
    const def = PLACEABLES[m.type];
    if (this.visit || this.mode !== 'play' || !def) return reply(false, 'The host isn’t on this island right now.');
    const world = this.outdoor;
    const isl = s.islands[world.id];
    const tile = this.indoor ? { ...this.indoor.ret } : { x: this.player.tileX, y: this.player.tileY };
    if (m.op === 'move') {
      const pl = isl.placements.find(p => p.uid === m.uid);
      if (!pl) return reply(false, 'That has already been moved — try again.');
      const res = world.canPlace(pl.type, m.x, m.y, m.rot, pl.uid, tile);
      if (!res.ok) return reply(false, reasonText(res.reasons));
      Object.assign(pl, { x: m.x, y: m.y, rot: m.rot });
    } else {
      if (def.buildable === false) return reply(false, 'That can’t be built.');
      if (def.maxCount && countBuilt(m.type) >= def.maxCount) return reply(false, `This island already has ${def.maxCount === 1 ? 'one' : 'the most it can hold'}.`);
      const res = world.canPlace(m.type, m.x, m.y, m.rot, null, tile);
      if (!res.ok) return reply(false, reasonText(res.reasons));
      const pl = { uid: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), type: m.type, x: m.x, y: m.y, rot: m.rot, by: m.name };
      if (def.days) pl.buildDay = s.world.day + def.days;
      isl.placements.push(pl);
      if (def.produce) isl.gardens[pl.uid] = Date.now();
      emit('built', { id: m.type, kind: def.kind, x: m.x, y: m.y, fw: res.fw, fh: res.fh });
      toast(`${m.name} built a ${def.name} on your island!`, 'build', 'good');
    }
    world.rebuild();
    if (this.build.active && this.build.ghost) this.build.setGhost(this.build.ghost.x, this.build.ghost.y);
    commit('coop');
    reply(true);
    this.shareLayout();
  }

  /** Visitor: the host's island changed (their build or someone else's). */
  applyCoopLayout(m) {
    const world = this.outdoor;   // still applies while indoors
    if (!this.visit || m.island !== world.id) return;
    const st = world.islandState;
    st.placements = (m.placements || []).map((p, i) => ({ ...p, uid: p.uid || 'visit' + i }));
    const bridge = !!m.flags?.bridgeRepaired;
    if (bridge !== !!st.flags.bridgeRepaired) {
      st.flags.bridgeRepaired = bridge;
      world.applyFlags();
      if (!this.indoor) this.renderer.buildLand();
    }
    world.rebuild();
    if (this.build.active && this.build.ghost) this.build.setGhost(this.build.ghost.x, this.build.ghost.y);
  }

  /** Visitor: confirm in build mode → ask the host; pay only if accepted. */
  coopConfirm(b) {
    const g = b.ghost, v = this.visit;
    if (!b.type || !g) return { ok: false, message: 'Choose something to build first.' };
    if (!v.member) return { ok: false, message: 'Visitors can only look around — join the game to build.' };
    if (!v.hostHere) return { ok: false, message: `${v.hostName} needs to be on this island for you to build.` };
    if (!g.ok) return { ok: false, message: reasonText(g.reasons) };
    const s = getState();
    const def = PLACEABLES[b.type];
    const moving = b.moving;
    let cost = {};
    if (!moving) {
      if (def.minLevel && s.player.level > 0 && s.player.level < def.minLevel) return { ok: false, message: `Reach level ${def.minLevel} first.` };
      if (def.kind === 'building' && !hasBlueprint(b.type)) return { ok: false, message: 'Buy that blueprint at Nori’s first.' };
      if (b.fromStore) { if (!s.inventory.storedDecor[b.type]) return { ok: false, message: 'None left in storage.' }; }
      else {
        cost = fullCost(def);
        const check = checkCost(cost);
        if (!check.ok) return { ok: false, message: 'You can’t afford that yet.' };
      }
    }
    if (this.coopBusy) return { ok: false, message: 'Hang on — still waiting for the host.' };
    this.coopBusy = true;
    const type = b.type, x = g.x, y = g.y, rot = b.rot, fromStore = b.fromStore, fw = g.fw;
    this.ui.online.social.coopEdit(moving ? { op: 'move', uid: moving.uid, type, x, y, rot } : { op: 'place', type, x, y, rot })
      .then(r => {
        this.coopBusy = false;
        if (!r.ok) { sfx('error'); toast(r.error || 'The host couldn’t place that.', null, 'error'); return; }
        if (!moving) {
          if (fromStore) { s.inventory.storedDecor[type] -= 1; if (s.inventory.storedDecor[type] <= 0) delete s.inventory.storedDecor[type]; }
          else spend(cost);
          if (def.kind === 'building') { s.stats.buildingsBuilt += 1; addXp(40); } else { s.stats.decorPlaced += 1; addXp(3); }
          commit('coopBuild');
        }
        sfx('build');
        toast(moving ? `${def.name} moved.` : `${def.name} built on ${v.hostName}’s island!`, 'build', 'good');
        if (moving || def.kind === 'building') { b.cancelPlacement(); }
        else if (b.type === type) b.setGhost(x + fw, y);
      });
    return { ok: true, message: `Asking ${v.hostName}…` };
  }

  interact(it) {
    if (!it || this.inputBlocked()) return;
    if (!this.canUse(it) && it.kind === 'bed') { toast('That’s your host’s bed — you can rest at home.', 'sleep'); return; }
    if (!this.canUse(it)) { toast('You’re a guest here — fishing, gathering and building happen on your own island.', 'island'); return; }
    initAudio();
    const p = this.player;
    p.cancelPath();
    switch (it.kind) {
      case 'spot': {
        if (!getState().inventory.rods.length) { toast('You need a fishing rod. Visit Nori’s shop in town — she has a starter one.', 'rod'); return; }
        this.startFishing(it.spot);
        break;
      }
      case 'npc': {
        const n = it.npc;
        n.dir = faceToward(n, p);
        p.facing = faceToward(p, n);
        markTalked(n.id);
        talkedTo(n.id);
        this.ui.talk(n.id);
        // Nori sets new islanders up with a starter rod and sword.
        if (n.id === 'nori' && !this.visit) this.starterGear();
        break;
      }
      case 'clear': {
        const o = it.obj, tool = o.def.tool;
        if (this.visit) { toast('That belongs to your host’s yard.', 'axe'); return; }
        if (!this.needTool(tool)) return;
        swing(this, tool);
        break;
      }
      case 'harvest': {
        p.facing = facePoint(p, it.tx * TILE + 8, it.ty * TILE + 8);
        harvest(this, it.tx, it.ty);
        break;
      }
      case 'gift': this.openGift(); break;
      case 'construction': {
        const p = it.placement;
        toast(p.upgrade ? `Rowan is upgrading this — ready on Day ${p.upgrade.day}.` : `Rowan is building your ${p.def.name}. Ready on Day ${p.buildDay}.`, 'build');
        break;
      }
      case 'cook': this.ui.furnaceModal({ def: { use: 'kitchen' }, uid: 'kitchen' }); break;
      case 'silo_hay': {
        const isl = getState().islands[this.outdoor.id];
        const n = Math.min(isl.silo || 0, 20);
        if (!n) { toast('Your silo is empty. Cut tall grass to fill it.', 'hay'); break; }
        isl.silo -= n; addItemTo('hay', n); commit('hay');
        toast(`Took ${n} hay from the silo (${isl.silo} left).`, 'hay', 'good');
        break;
      }
      case 'tap_place': this.placeTapper(it.obj); break;
      case 'tap_collect': this.collectTap(it.obj); break;
      case 'ride': this.setRiding(!this.riding); break;
      case 'friend_wave': this.waveAt(it.remote); break;
      case 'friend_give': this.giveTo(it.remote); break;
      case 'gift_npc': {
        const r = giveGift(it.npc.id, getState().inventory.held);
        toast(r.message, r.ok ? (r.taste === 'dislike' ? 'friends' : 'heart') : 'friends', r.ok && r.taste === 'love' ? 'gold' : r.ok ? 'good' : 'info');
        this.ui.hotbar?.render();
        break;
      }
      case 'ship': this.ui.shipModal(); break;
      case 'mail': this.ui.mailModal(); break;
      case 'restore': this.ui.open('restore'); break;
      case 'museum': this.ui.open('museum'); break;
      case 'festival': this.ui.festivalModal(this.festivalToday()); break;
      case 'elevator': this.ui.mineMenu(true); break;
      case 'boss_chest': this.openBossChest(it.obj); break;
      case 'feed': {
        const n = fillTrough(getState().islands[this.outdoor.id], this.indoor?.home);
        if (n) this.renderer.troughFull = true;
        toast(n ? `Added ${n} hay to the trough. Each animal eats one a day.` : 'You have no hay. Cut tall grass with your scythe to get some.', 'hay');
        break;
      }
      case 'animals': this.ui.animalShop(this.indoor?.home, this.indoor?.homeType); break;
      case 'pet': toast(petAnimal(it.critter.a), 'heart', 'good'); this.ui.hotbar?.render(); break;
      case 'hall': this.ui.open('hall'); break;
      case 'floor_chest': this.openFloorChest(it.obj); break;
      case 'tv': this.ui.tvModal(); break;
      case 'gather': gather(this, it.obj); break;
      case 'board': this.ui.open('quests'); break;
      case 'shop':
        this.ui.open('shop');
        if (!this.visit && this.world.id === 'shop_interior') this.starterGear();   // the counter is Nori's too
        break;
      case 'enter': this.enterInterior(it); break;
      case 'exit': this.exitInterior(); break;
      case 'bed': this.ui.sleepPrompt(); break;
      case 'use':
        if (it.placement.def.use === 'machine') { const r = useMachine(getState().islands[this.outdoor.id], it.placement, getState().inventory.held); toast(r.message, 'sparkle', r.ok ? 'good' : 'info'); this.ui.hotbar?.render(); }
        else this.ui.useUtility(it.placement);
        break;
      case 'mine_enter': {
        const s = getState();
        if (!s.flags.mineOpen && !this.visit) { toast(`Fallen rocks block the way in. Rowan says they’ll be cleared by Day 5 (it’s Day ${s.world.day}).`, 'pickaxe'); return; }
        this.ui.mineMenu();
        break;
      }
      case 'descend': this.enterMine((this.world.def.level || 0) + 1); break;
      case 'ascend': this.exitInterior(); break;
      case 'mine': {
        const o = it.obj;
        // crates break with a pickaxe or a sword; rocks need the pickaxe
        const held = getState().inventory.held;
        const ok = o.type === 'mine_crate' ? ['pickaxe', 'sword'].includes(held) : held === 'pickaxe';
        if (!ok) { this.needTool(o.type === 'mine_crate' && held !== 'pickaxe' ? 'sword' : 'pickaxe'); return; }
        swing(this, held);
        break;
      }
      case 'attack': {
        if (!this.needTool('sword')) return;
        swing(this, 'sword');
        break;
      }
      case 'swing': swing(this); break;
      case 'boat': this.ui.open('map'); break;
      case 'bridge': this.ui.bridge(); break;
      case 'building': this.ui.building(it.placement); break;
      default: break;
    }
  }

  // ---------------------------------------------------------------- interiors
  /** The island world (the one outside when indoors). */
  get outdoor() { return this.indoor ? this.indoor.outside : this.world; }

  /** Walk into a building: the shop object or a cottage placement. */
  enterInterior(it, { instant = false, spawn = null } = {}) {
    if (this.indoor || (this.ui.fading && !instant)) return;
    const id = it.obj ? it.obj.def.interior : it.placement?.def?.interior || (it.placement?.type === 'guest_cabin' ? 'cabin_interior' : getState().flags.kitchen && !this.visit ? 'cottage_big_interior' : 'cottage_interior');
    const def = INTERIORS[id];
    if (!def) return;
    if (it.placement && underConstruction(it.placement)) { toast(`Rowan is still building this. It’ll be ready on Day ${it.placement.buildDay}.`, 'build'); return; }
    // shops keep opening hours (festival days too)
    const hours = OPENING_HOURS[id];
    const hour = getState().world.minutes / 60;
    if (hours && !instant && (hour < hours.from || hour >= hours.to)) {
      const t = n => `${((n + 11) % 12) + 1} ${n < 12 ? 'AM' : 'PM'}`;
      toast(`${hours.name[0].toUpperCase() + hours.name.slice(1)} is closed. Open ${t(hours.from)} – ${t(hours.to)}.`, 'lock');
      return;
    }
    // Where to stand when coming back out: the tile in front of the door.
    let ret;
    if (it.obj) { const fp = it.obj.def.footprint || { w: 1, h: 1 }; ret = { x: it.obj.x + Math.floor(fp.w / 2), y: it.obj.y + fp.h }; }
    else { const pl = it.placement; ret = { x: pl.x + Math.floor(pl.fw / 2), y: pl.y + pl.fh }; }
    const outside = this.world;
    if (!outside.walkableTile(ret.x, ret.y)) ret = outside.nearestWalkable(ret.x, ret.y, this.player.tileX, this.player.tileY) || { x: this.player.tileX, y: this.player.tileY };
    const go = () => {
      this.indoor = { id, outside, ret, home: it.placement?.uid, homeType: it.placement?.type };
      this.setRiding(false, true);
      let roomState = { unlocked: true, visited: true, nodes: {}, gardens: {}, flags: {}, placements: [] };
      if (def.buildInside && it.placement?.uid && !this.visit) {
        // a shed keeps whatever you put inside it
        const isl = getState().islands[outside.id];
        isl.interiors = isl.interiors || {};
        roomState = isl.interiors[it.placement.uid] = isl.interiors[it.placement.uid] || { unlocked: true, visited: true, nodes: {}, gardens: {}, flags: {}, placements: [] };
      }
      this.world = new World(id, roomState);
      // animals live inside their coop / barn
      if (it.placement?.uid && it.placement.def.animals) this.spawnCritters(it.placement.uid);
      this.renderer.setWorld(this.world);
      const sp = spawn || def.spawn;
      this.player.placeAtTile(sp.x, sp.y);
      this.player.facing = 'up';
      this.onResize();
      this.camera.snap(this.player.x, this.player.y, this.world);
      this.ui.closeAll();
    };
    if (instant) { go(); return; }
    sfx('click');
    this.ui.fade(go, def.name);
  }

  /** Tile a held hoe / watering can / seed packet would affect (shown as a marker). */
  farmTarget() {
    const held = getState().inventory.held || '';
    if (this.build.active || this.fishing || this.sleeping || !this.player) return null;
    const farming = held === 'hoe' || held === 'watering_can' || held.startsWith('seed:');
    if (!farming && !SWING_TOOLS.has(held)) return null;
    if (farming && farmBlocker(this)) return null;
    if (!farming && this.indoor && !this.indoor.mine) return null;
    return frontTile(this.player);
  }

  /** Tools are never switched for you: say which one you need. Returns true if it's in hand. */
  needTool(tool) {
    if (getState().inventory.held === tool) return true;
    toast(needToolText(tool), tool);
    sfx('error');
    return false;
  }

  /** Treasure chest on a milestone mine floor (once per character). */
  openFloorChest(o) {
    const s = getState();
    const loot = FLOOR_CHESTS[o.level];
    s.flags.floorChests = s.flags.floorChests || [];
    if (!loot || s.flags.floorChests.includes(o.level)) return;
    s.flags.floorChests.push(o.level);
    const got = [];
    if (loot.sword !== undefined && (s.inventory.tools.sword ?? -1) < loot.sword) {
      s.inventory.tools.sword = loot.sword;
      got.push(SWORDS[loot.sword].name);
    }
    if (loot.coins) { addCoinsTo(loot.coins); got.push(`${loot.coins} coins`); }
    for (const [id, n] of Object.entries(loot.items || {})) { addItemTo(id, n); got.push(`${n} ${RESOURCES[id]?.name || id}`); }
    if (loot.pearls) { s.player.pearls += loot.pearls; got.push(`${loot.pearls} pearls`); }
    sfx('levelup');
    this.renderer.emit('sparkle', o.x * TILE + 8, o.y * TILE, 18, { speed: 60, gravity: 30, color: '#f8dc7c' });
    this.world.rebuild();
    toast(`${loot.label}: ${got.join(', ')}!`, 'chest', 'gold');
    this.ui.hotbar?.render();
    commit('floorChest');
  }

  /** Talking to Nori the first time: a Wooden Rod and a Wooden Sword. */
  starterGear() {
    const inv = getState().inventory;
    const got = [];
    if (!inv.rods.length) { inv.rods.push('wooden_rod'); inv.equippedRod = 'wooden_rod'; got.push('a Wooden Rod'); }
    if (inv.tools.sword === undefined) { inv.tools.sword = 0; got.push('a Wooden Sword'); }
    if (!got.length) return;
    setTimeout(() => { toast(`Nori gave you ${got.join(' and ')}! They’re in your bag.`, 'rod', 'gold'); sfx('quest'); }, 400);
    commit('starterGear');
    this.ui.hotbar?.render();
  }

  /** The welcome gift in the cottage: starter seeds. */
  openGift() {
    const s = getState();
    if (s.flags.giftOpened) return;
    s.flags.giftOpened = true;
    s.inventory.items.radish_seeds = (s.inventory.items.radish_seeds || 0) + 15;
    s.inventory.held = 'seed:radish_seeds';
    sfx('quest');
    this.renderer.emit('sparkle', this.player.x, this.player.y - 16, 14, { speed: 50, gravity: 30, color: '#f8dc7c' });
    this.ui.giftModal();
    this.world.rebuild();
    commit('gift');
  }

  /** A brand-new game starts inside your cottage, next to the welcome gift. */
  startInCottage() {
    const pl = this.world.placed.find(p => p.type === 'cottage');
    if (pl) this.enterInterior({ placement: pl }, { instant: true, spawn: { x: 5, y: 5 } });
  }

  /** Stayed up past 2 AM: pass out and wake at home, a few coins lighter. */
  passOut() {
    if (this.fainting || this.sleeping) return;
    this.fainting = true;
    const s = getState();
    const lost = Math.min(250, Math.floor(s.player.coins * 0.1));
    if (this.fishing) this.stopFishing();
    this.ui.closeAll();
    this.ui.fade(() => {
      s.player.coins -= lost;
      const ind = this.indoor;
      if (ind) { this.indoor = null; this.world = ind.outside; this.renderer.setWorld(this.world); }
      if (this.world.id === 'sunny') {
        const home = ISLANDS.sunny.spawn;
        this.player.placeAtTile(home.x, home.y);
      }
      this.player.facing = 'down';
      sleepToMorning();
      s.player.hp = Math.ceil(s.player.maxHp * 0.75);
      s.player.energy = Math.ceil((s.player.maxEnergy || 100) * 0.5);
      if (this.channel && this.bedPeers().length) {
        const w = s.world;
        this.ui.online?.social.relay('wake', { day: w.day, minutes: Math.floor(w.minutes), weather: w.weather });
      }
      this.world.rebuild();
      this.camera.snap(this.player.x, this.player.y, this.world);
      this.syncPlayerToState();
      this.fainting = false;
      setTimeout(() => toast(`You stayed up too late and passed out!${lost ? ` Someone found you and kept ${lost} coins for their trouble.` : ''}`, 'sleep', 'error'), 500);
    }, 'You passed out…');
  }

  /** Step back outside onto the doorstep. */
  exitInterior() {
    const ind = this.indoor;
    if (!ind || this.ui.fading) return;
    this.player.cancelPath();
    this.ui.fade(() => {
      this.indoor = null;
      this.world = ind.outside;
      this.world.rebuild();
      this.renderer.setWorld(this.world);
      this.player.placeAtTile(ind.ret.x, ind.ret.y);
      this.player.facing = 'down';
      this.onResize();
      this.camera.snap(this.player.x, this.player.y, this.world);
      this.syncPlayerToState();
    }, '');
  }

  // ---------------------------------------------------------------- areas
  /**
   * Sunny Shores is split into areas. Teleports (doors, the mine, waking up)
   * switch area straight away; walking off the end of a path at an edge
   * fades over to the next area.
   */
  updateArea() {
    const w = this.world, p = this.player;
    const here = w.areaAt(p.tileX, p.tileY);
    if (here !== w.area) {
      w.setArea(here);
      this.camera.snap(p.x, p.y - 8, w);
      return;
    }
    if (this.ui.fading || !p.moving) return;
    const b = w.bounds;
    const tx = p.tileX, ty = p.tileY;
    const dir = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[p.facing];
    const atEdge = (dir[0] < 0 && tx === b.x) || (dir[0] > 0 && tx === b.x + b.w - 1) || (dir[1] < 0 && ty === b.y) || (dir[1] > 0 && ty === b.y + b.h - 1);
    if (!atEdge) return;
    const nx = tx + dir[0], ny = ty + dir[1];
    const open = (x, y) => x >= 0 && y >= 0 && x < w.w && y < w.h && !w.solid[y * w.w + x];
    if (!open(nx, ny)) return;
    const next = w.areaAt(nx, ny);
    if (!next || next === w.area) return;
    // Land one step past the edge so you don't bounce straight back.
    const fx = nx + dir[0], fy = ny + dir[1];
    const land = open(fx, fy) ? { x: fx, y: fy } : { x: nx, y: ny };
    p.cancelPath();
    const facing = p.facing;
    this.ui.fade(() => {
      w.setArea(next);
      p.placeAtTile(land.x, land.y);
      p.facing = facing;
      this.camera.snap(p.x, p.y - 8, w);
      this.syncPlayerToState();
    }, w.areas[next].name);
  }

  // ---------------------------------------------------------------- the mine
  /** Go down to a mine floor (from the entrance or a ladder). */
  enterMine(level) {
    if (this.ui.fading) return;
    const surface = this.outdoor;
    let ret = this.indoor?.ret;
    if (!this.indoor) {
      const ent = surface.objects.find(o => o.type === 'mine_entrance');
      ret = ent ? { x: ent.x + 1, y: ent.y + 2 } : { x: this.player.tileX, y: this.player.tileY };
    }
    const s = getState();
    sfx('ladder');
    this.ui.fade(() => {
      forgetMap('mine_' + level);
      const def = mineFloor(level, Date.now() & 0xffffff);
      this.indoor = { id: def.id, outside: surface, ret, mine: true };
      this.world = new World(def.id, { unlocked: true, visited: true, nodes: {}, gardens: {}, flags: {}, placements: [] });
      this.renderer.setWorld(this.world);
      this.player.placeAtTile(def.spawn.x, def.spawn.y);
      this.player.facing = 'down';
      this.onResize();
      this.camera.snap(this.player.x, this.player.y, this.world);
      this.ui.closeAll();
      if (s.inventory.tools.sword === undefined && level === 1) {
        setTimeout(() => toast('Monsters lurk down here and you have no sword! Nori in town has a starter one.', 'sword', 'error'), 600);
      }
      if (level > (s.stats.mineDeepest || 0)) {
        s.stats.mineDeepest = level;
        if (level % 5 === 0) setTimeout(() => toast(`Floor ${level} reached! You can start here next time.`, 'sparkle', 'gold'), 500);
        commit('mine');
      }
      this.ui.refreshWhere?.();
    }, `Floor ${level}`);
  }

  /** HP ran out: wake up outside the mine, a little lighter in the pocket. */
  faint() {
    if (this.fainting) return;
    this.fainting = true;
    const s = getState();
    const lost = Math.min(300, Math.floor(s.player.coins * 0.1));
    this.ui.fade(() => {
      const ind = this.indoor;
      if (ind) {
        this.indoor = null;
        this.world = ind.outside;
        this.world.rebuild();
        this.renderer.setWorld(this.world);
        this.player.placeAtTile(ind.ret.x, ind.ret.y);
      }
      this.player.facing = 'down';
      this.player.invuln = 2;
      s.player.coins -= lost;
      s.player.hp = Math.ceil(s.player.maxHp * 0.5);
      this.onResize();
      this.camera.snap(this.player.x, this.player.y, this.world);
      this.syncPlayerToState();
      commit('faint');
      this.fainting = false;
      this.ui.refreshWhere?.();
      setTimeout(() => toast(lost ? `You passed out and dropped ${lost} coins. Take some food next time!` : 'You passed out. Take some food next time!', 'sleep', 'error'), 500);
    }, 'You passed out…');
  }

  // ---------------------------------------------------------------- sleeping
  /** Players whose bed time counts: the host and everyone who joined the game. */
  bedPeers() { return [...this.remotes.entries()].filter(([, r]) => r.host || r.member).map(([id]) => id); }

  /** Get into bed. Alone you wake up next morning; together, once everyone is in bed. */
  goToSleep() {
    const others = this.channel ? this.bedPeers() : [];
    if (!others.length) { this.wakeUp(false); return; }
    this.sleeping = true;
    this.player.cancelPath();
    this.ui.online?.social.relay('sleep', { on: true });
    this.ui.refreshSleep?.();
    this.checkSleep();
  }

  getUp() {
    if (!this.sleeping) return;
    this.sleeping = false;
    this.ui.online?.social.relay('sleep', { on: false });
    this.ui.refreshSleep?.();
  }

  /** The host starts the new day once every player is in bed. */
  checkSleep() {
    if (this.visit || !this.sleeping) return;
    if (this.bedPeers().every(id => this.sleepers.has(id))) this.wakeUp(true);
  }

  /** Fade out, skip to 6 AM tomorrow, fade in. broadcast = tell the others. */
  wakeUp(broadcast, clock = null) {
    this.ui.fade(() => {
      if (clock) {
        setClock(clock);
        const s = getState();
        s.player.hp = s.player.maxHp;
        s.player.energy = s.player.maxEnergy || 100;
        s.stats.daysSlept = (s.stats.daysSlept || 0) + 1;
        emit('newDay', { day: clock.day, slept: true });
        commit('sleep');
      } else sleepToMorning();
      this.sleeping = false;
      this.sleepers = new Set();
      if (broadcast) {
        const w = getState().world;
        this.ui.online?.social.relay('wake', { day: w.day, minutes: Math.floor(w.minutes), weather: w.weather });
      }
      this.ui.refreshSleep?.();
      const day = getState().world.day;
      setTimeout(() => toast(`Day ${day} — good morning!`, 'sun', 'good'), 500);
    }, 'Zzz…');
  }

  onRelay(m) {
    const fromHost = this.visit && m.user === this.visit.hostId;
    if (m.kind === 'story' && fromHost && this.visit?.member) {
      const s = getState();
      s.quests.waitHost = false;
      if (setStoryIndex(m.data.index)) toast(`The story in this world: “${currentQuest()?.title || 'all done!'}”`, 'quest');
      return;
    }
    if (m.kind === 'story_claim' && !this.visit) {
      // a friend finished the world's current story quest: it moves on for everyone
      if (m.data.index > getState().quests.index) { setStoryIndex(m.data.index); const r = this.remotes.get(m.user); toast(`${r?.name || 'A friend'} finished a story quest for the world!`, 'quest', 'good'); }
      this.shareStory();
      return;
    }
    if (m.kind === 'me') {
      const r = this.remotes.get(m.user);
      if (r) { if (m.data.name) { r.name = m.data.name; r.ownName = true; } if (m.data.look?.skin) { r.look = m.data.look; r.ownLook = true; } }
      return;
    }
    if (m.kind === 'wave') {
      const r = this.remotes.get(m.user);
      if (m.data.to !== this.ui.online?.auth.user?.id || !r) return;
      this.renderer.floatText('Hi!', r.x, r.y - 28, '#fff5df');
      toast(`${r.name} waves at you!`, 'friends');
      return;
    }
    if (m.kind === 'give') {
      const r = this.remotes.get(m.user);
      if (m.data.to !== this.ui.online?.auth.user?.id) return;
      addItemTo(m.data.item, m.data.n);
      toast(`${r?.name || 'A friend'} gave you ${m.data.n} ${giftName(m.data.item)}!`, 'gift', 'good');
      sfx('coin');
      commit('gift');
      this.ui.hotbar?.render();
      return;
    }
    if (m.kind === 'boss') {
      // someone in this world beat a boss: everyone shares the treasure
      const r = BOSSES[m.data.floor]?.reward;
      if (r) sendMail({ id: `boss_${m.data.floor}_${getState().world.day}`, from: 'Bram', subject: `Shared treasure from floor ${m.data.floor}!`, body: `Word travels fast — a friend beat the boss on floor ${m.data.floor}. The Hall splits the treasure with everyone in the world.`, attach: { coins: Math.round((r.coins || 0) / 2), pearls: 1 } });
      toast('A friend beat a mine boss! A share of the treasure is in your mailbox.', 'trophy', 'gold');
      return;
    }
    if (m.kind === 'sleep') {
      if (m.data.on) this.sleepers.add(m.user); else this.sleepers.delete(m.user);
      this.ui.refreshSleep?.();
      this.checkSleep();
    } else if (m.kind === 'wake' && fromHost && this.visit.member) {
      this.wakeUp(false, m.data);
    } else if (m.kind === 'clock' && fromHost && this.visit.member && !this.ui.fading) {
      const w = getState().world;
      if (w.day !== m.data.day || Math.abs(w.minutes - m.data.minutes) > 3 || w.weather !== m.data.weather) setClock(m.data);
    }
  }

  /** Host: keep joined players on the same day and time. */
  /** Host: tell everyone where the world's story is at. */
  shareStory() {
    if (this.visit || !this.channel) return;
    this.ui.online?.social.relay('story', { index: getState().quests.index });
  }

  shareClock(now = false) {
    if (this.visit || !this.channel || !this.bedPeers().length) return;
    if (!now && this.ui.fading) return;
    const w = getState().world;
    this.ui.online?.social.relay('clock', { day: w.day, minutes: Math.floor(w.minutes), weather: w.weather });
  }

  /** Host: every friend who joins gets their own cabin in the home yard. */
  ensureGuestCabins(list) {
    const world = this.outdoor;
    if (this.visit || world.id !== 'sunny') return;
    const isl = getState().islands.sunny;
    const def = ISLANDS.sunny;
    let added = false;
    for (const p of list) {
      if (!p.member || p.host) continue;
      if (isl.placements.some(q => q.type === 'guest_cabin' && q.owner === p.id)) continue;
      let spot = def.guestSpots.find(g => world.canPlace('guest_cabin', g.x, g.y, 0).ok);
      if (!spot) {
        const yd = def.home.yard;
        for (let y = yd.y + 1; y < yd.y + yd.h - 3 && !spot; y++) for (let x = yd.x + 1; x < yd.x + yd.w - 3; x++) if (world.canPlace('guest_cabin', x, y, 0).ok) { spot = { x, y }; break; }
      }
      if (!spot) continue;
      isl.placements.push({ uid: uid('p'), type: 'guest_cabin', x: spot.x, y: spot.y, rot: 0, owner: p.id, ownerName: p.name || 'Friend' });
      world.rebuild();
      added = true;
      toast(`A cabin went up in your yard for ${p.name || 'your friend'}!`, 'home', 'good');
    }
    if (added) commit('build');
  }

  /** Fishing Derby: count catches for 3 minutes, then hand out a prize. */
  updateDerby() {
    const d = this.derby;
    if (!d || performance.now() < d.end || this.ui.fading) return;
    this.derby = null;
    const s = getState();
    const n = s.stats.fishCaught - d.start;
    if (s.festivals[d.key]) s.festivals[d.key].derbyFish = n;
    const prize = n >= 8 ? { coins: 1500, pearls: 3, medal: 'Gold' } : n >= 5 ? { coins: 700, pearls: 1, medal: 'Silver' } : n >= 2 ? { coins: 250, medal: 'Bronze' } : null;
    if (prize) { addCoinsTo(prize.coins); if (prize.pearls) s.player.pearls += prize.pearls; sfx('levelup'); }
    if (prize?.medal === 'Gold') { s.inventory.storedDecor.fish_statue = (s.inventory.storedDecor.fish_statue || 0) + 1; setTimeout(() => toast('Gold medal prize: a Fish Statue (in Build → Stored)!', 'trophy', 'gold'), 1500); }
    toast(prize ? `Fishing Derby over! ${n} fish — ${prize.medal} medal: ${prize.coins} coins${prize.pearls ? ' and ' + prize.pearls + ' pearls' : ''}!` : `Fishing Derby over! You caught ${n}. Better luck next year!`, 'rod', prize ? 'gold' : 'info');
    commit('derby');
    this.ui.refreshWhere?.();
  }

  startFishing(spot) {
    if (getState().player.energy < energyCost('cast')) { toast('You’re too tired to fish. Eat something or go to bed.', 'sleep', 'error'); return; }
    const p = this.player;
    // Step onto the spot tile so the cast lines up.
    p.placeAtTile(spot.x, spot.y);
    this.fishing = new FishingSession(spot, this.world, p);
    emit('fishing:start', this.fishing);
    this.ui.fishingStart(this.fishing);
  }

  stopFishing() {
    if (!this.fishing) return;
    this.fishing.stop();
    this.fishing = null;
    this.ui.fishingEnd();
  }

  // ---------------------------------------------------------------- loop
  loop(now) {
    requestAnimationFrame(this.loop);
    if (this.paused) return;
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;
    try {
      this.update(dt);
      this.draw(dt);
    } catch (err) {
      console.error(err);
      this.ui.reportError?.(err);
    }
  }

  update(dt) {
    if (this.mode === 'title') { this.footsteps.update(dt); return; }   // the title scene animates itself
    const s = getState();
    tickWeather(dt);
    // Stay up past 2 AM and you pass out (the host's clock rules in multiplayer).
    if (!this.visit && s.world.minutes >= 120 && s.world.minutes < 360 && !this.ui.fading && !ISLANDS[s.player.island]?.alwaysNight) this.passOut();
    const blocked = this.inputBlocked();
    // Menus, dialogue and fishing stop the player (and their footsteps) at once,
    // including a tap-to-walk that was in progress.
    if (blocked && this.player.path) this.player.cancelPath();
    const padVec = this.pad.poll();
    let input = blocked ? { x: 0, y: 0 } : this.controls.read();
    if (!blocked && !input.x && !input.y && (padVec.x || padVec.y)) input = { x: padVec.x, y: padVec.y };
    this.updateRest(dt, input);
    if (!this.build.active) this.player.update(dt, input, this.world);
    else this.player.moving = false;
    this.footsteps.update(dt);
    if (this.indoor && this.world.def.exit && !this.ui.fading && this.player.tileY >= this.world.def.exit.y) this.exitInterior();
    if (this.world.areas) this.updateArea();
    const pl = this.player;
    if (pl.swingCool > 0) pl.swingCool -= dt;
    if (pl.swing) { pl.swing.t += dt; if (pl.swing.t >= pl.swing.dur) pl.swing = null; }
    if (pl.invuln > 0) pl.invuln -= dt;
    if (this.world.monsters.length && !this.ui.fading) updateMonsters(this, dt);
    this.updateNpcs(dt);
    { // music follows the season, and goes quiet and dark underground
      const ms = { season: seasonOf(getState().world.day).season, mine: !!this.world?.def.mine };
      const key = ms.season + ms.mine;
      if (key !== this.musicKey) { this.musicKey = key; setMusicScene(ms); }
    }
    this.updateCritters(dt);
    this.updateDerby();
    if (this.fishing) this.fishing.update(dt);
    this.interactTarget = this.build.active || this.fishing ? null : findInteractable(this);
    // Fog hides secret spots until you get close.
    if (this.world.def.fog) for (const sp of this.world.spots) {
      if (sp.hidden && !this.revealedSpots.has(sp.id) && Math.hypot(this.player.x - (sp.x * TILE + 8), this.player.y - (sp.y * TILE + 8)) < 4 * TILE) {
        this.revealedSpots.add(sp.id);
        toast('You found a secret fishing spot!', 'sparkle', 'good');
        sfx('perfect');
      }
    }
    // Keep the action centred in the part of the screen not covered by UI.
    const ins = this.uiInsets(dt);
    this.camera.extraBottom = ins.bottom;
    this.camera.extraRight = ins.right;
    const shift = { x: (ins.right - ins.left) / 2, y: (ins.bottom - ins.top) / 2 };
    if (this.build.active && this.build.ghost) {
      const g = this.build.ghost;
      this.camera.follow((g.x + g.fw / 2) * TILE + shift.x, (g.y + g.fh / 2) * TILE + shift.y, dt, this.world);
    } else {
      const look = this.fishing && this.fishing.bobber ? { x: (this.fishing.bobber.x - this.player.x) * 0.5, y: (this.fishing.bobber.y - this.player.y) * 0.5 } : { x: 0, y: 0 };
      look.x += shift.x; look.y += shift.y;
      this.camera.follow(this.player.x, this.player.y - 8, dt, this.world, look);
    }
    // periodic housekeeping
    const t = this.timers;
    t.orders += dt; t.daily += dt; t.nodes += dt;
    if (t.orders > 5) { t.orders = 0; ensureOrders(); }
    if (t.daily > 30) { t.daily = 0; ensureDaily(); }
    if (t.nodes > 4) { t.nodes = 0; this.world.rebuild(); }
    this.updateRemotes(dt);
    this.ui.frame(dt, s);
  }

  /** UI-covered margins in buffer pixels, re-measured a few times a second. */
  uiInsets(dt) {
    this.insetT = (this.insetT || 0) - dt;
    if (this.insetT <= 0 || !this.insetCache) {
      this.insetT = 0.15;
      const css = this.ui.insets();
      const k = this.renderer.dpr / this.renderer.scale;
      this.insetCache = { top: css.top * k, right: css.right * k, bottom: css.bottom * k, left: css.left * k };
    }
    return this.insetCache;
  }

  /** Put a tapper on a tree in your yard. */
  placeTapper(o) {
    const s = getState(), farm = getState().islands[this.world.id]?.farm;
    if (!farm || !o) return;
    farm.taps = farm.taps || {};
    if (farm.taps[o.id]) { toast('That tree already has a tapper.', 'tapper'); return; }
    if (!(s.inventory.items.tapper > 0)) { toast('You need a tapper.', 'tapper'); return; }
    s.inventory.items.tapper -= 1; if (s.inventory.items.tapper <= 0) delete s.inventory.items.tapper;
    farm.taps[o.id] = { day: s.world.day };
    sfx('build');
    toast(`Tapper attached! Check back in ${TAP_DAYS} days.`, 'tapper', 'good');
    commit('tap');
    this.ui.hotbar?.render();
  }

  collectTap(o) {
    const s = getState(), farm = s.islands[this.world.id]?.farm, tap = farm?.taps?.[o.id];
    if (!tap) return;
    if (s.world.day - tap.day < TAP_DAYS) { toast(`Still filling — ready in ${TAP_DAYS - (s.world.day - tap.day)} day(s).`, 'tapper'); return; }
    const got = Math.random() < 0.65 ? 'tree_syrup' : 'resin';
    addItemTo(got, 1);
    tap.day = s.world.day;
    sfx('coin');
    toast(`Collected ${RESOURCES[got].name}!`, RESOURCES[got].icon, 'good');
    commit('tap');
  }

  /** Hop on (or off) your horse. Only outdoors, once you've built a stable. */
  setRiding(on, quiet = false) {
    if (on && (!getState().flags.horse || this.indoor || this.visit)) {
      if (!quiet) toast(this.indoor ? 'Your horse waits outside.' : 'Build a Stable to get a horse.', 'home');
      return;
    }
    if (!!this.riding === !!on) return;
    this.riding = !!on;
    if (this.player) this.player.speedMul = this.riding ? 1.8 : 1;
    if (!quiet) { sfx('click'); toast(this.riding ? 'Giddy-up! (H to hop off)' : 'You hop off your horse.', 'home'); }
  }

  /** Lie down in bed without skipping the day: energy (and health) slowly come back. */
  restInBed() {
    this.resting = true;
    this.player.cancelPath?.();
    toast('You lie down for a rest. Walk away to get up.', 'sleep');
    this.ui.refreshSleep?.();
  }

  /** In bed (resting, or waiting for others to sleep): recover a little every second. */
  updateRest(dt, input) {
    if (this.resting && (input.x || input.y || !this.indoor)) { this.resting = false; this.ui.refreshSleep?.(); }
    if (!this.resting && !this.sleeping) return;
    const p = getState().player;
    const before = Math.floor(p.energy);
    p.energy = Math.min(p.maxEnergy || 100, p.energy + dt * 1.5);
    p.hp = Math.min(p.maxHp, p.hp + dt * 0.75);
    if (Math.floor(p.energy) !== before) { this.ui.hotbar?.renderHp(); this.ui.refreshSleep?.(); }
  }

  /** Islanders move between places through the day (data/life-data.js). */
  scheduleNpcs() {
    const w = this.world;
    if (w.def.interior) return;
    const hour = getState().world.minutes / 60;
    const wet = ['rain', 'storm', 'snow'].includes(currentWeather());
    const fest = this.festivalToday();
    for (const n of w.npcs) {
      const sch = SCHEDULES[n.id];
      if (!sch || sch.island !== w.id) continue;
      let key, place;
      if (fest && FESTIVAL_SPOTS[n.id]) { key = 'fest'; place = FESTIVAL_SPOTS[n.id]; n.doing = `at the ${fest.name}`; }
      else {
        const list = (wet && sch.rain) || sch.day;
        let e = list[list.length - 1];
        for (const x of list) if (hour >= x[0]) e = x;
        key = (wet ? 'r' : 'd') + e[0]; place = e[1]; n.doing = e[2];
      }
      if (n.schedKey === key) continue;
      n.schedKey = key;
      const at = this.resolvePlace(w, place);
      if (!at) continue;
      const tx = at.x * TILE + 8, ty = at.y * TILE + 12;
      n.homeX = tx; n.homeY = ty;
      const here = w.areaAt?.(Math.floor(n.x / TILE), Math.floor(n.y / TILE)), there = w.areaAt?.(at.x, at.y);
      if (here !== there || !w.inBoundsPx(n.x, n.y)) { n.x = tx; n.y = ty; n.tx = null; }
      else { n.tx = tx; n.ty = ty; n.walkHome = true; }
    }
  }

  /** A schedule place → a walkable tile: [x, y], 'spot:<id>' or 'obj:<type>'. */
  resolvePlace(w, place) {
    let x, y;
    if (Array.isArray(place)) [x, y] = place;
    else if (place.startsWith('spot:')) { const sp = w.allSpots.find(s => s.id === place.slice(5)); if (!sp) return null; x = sp.x; y = sp.y; }
    else if (place.startsWith('obj:')) {
      const o = w.objects.find(o => o.type === place.slice(4));
      if (!o) return null;
      const fp = o.def.footprint || { w: 1, h: 1 };
      x = o.x + Math.floor(fp.w / 2); y = o.y + fp.h;
      // stand beside it, so the spot in front stays free for you
      for (const [dx, dy] of [[-1, 0], [fp.w, 0], [-1, -1], [fp.w, -1], [0, 1]]) {
        const nx = (dx === fp.w ? o.x + fp.w : o.x + Math.floor(fp.w / 2) + dx), ny = y + dy;
        if (w.walkableTile(nx, ny) && !(nx === x && ny === y)) { x = nx; y = ny; break; }
      }
    } else return null;
    if (!w.walkableTile(x, y)) { const nw = w.nearestWalkable(x, y, x, y); if (nw) ({ x, y } = nw); }
    return { x, y };
  }

  /** Animals in the coop / barn you're standing in. */
  spawnCritters(homeUid) {
    const isl = getState().islands[this.outdoor.id];
    const def = this.world.def;
    this.renderer.troughFull = (isl.feed?.[homeUid] || 0) > 0;
    if (this.grazingNow()) {
      this.world.critters = [];
      if (animalsIn(isl, homeUid).length) setTimeout(() => toast('Your animals are outside grazing on this nice day.', 'heart'), 700);
      return;
    }
    this.world.critters = animalsIn(isl, homeUid).map((a, i) => ({
      a, x: (2 + (i * 2) % (def.size.w - 4)) * TILE + 8, y: (4 + (i % 2)) * TILE + 12, dir: 'down', anim: Math.random() * 4, t: 1 + Math.random() * 2, tx: null, ty: null,
    }));
  }

  /** On fair days (not winter) from 9 to 5, animals step outside to graze near their building. */
  grazingNow() {
    const s = getState();
    const h = s.world.minutes / 60;
    return h >= 9 && h < 17 && !['rain', 'storm', 'snow'].includes(currentWeather()) && seasonOf(s.world.day).season !== 'winter';
  }

  updateGrazing() {
    if (this.visit || this.indoor || this.world?.id !== FARM_ISLAND) return;
    const on = this.grazingNow();
    const key = on + ':' + (getState().islands[FARM_ISLAND].animals || []).length;
    if (key === this.world.grazeKey) return;
    this.world.grazeKey = key;
    const isl = getState().islands[FARM_ISLAND];
    const out = [];
    if (on) for (const p of this.world.placed) {
      if (!p.def.animals || underConstruction(p)) continue;
      const door = { x: (p.x + p.fw / 2) * TILE, y: (p.y + p.fh + 1.5) * TILE };
      animalsIn(isl, p.uid).forEach((a, i) => out.push({ a, x: door.x + ((i % 4) - 1.5) * 14, y: door.y + Math.floor(i / 4) * 12, hx: door.x, hy: door.y + 10, dir: 'down', anim: Math.random() * 4, t: Math.random() * 2, tx: null, ty: null, outside: true }));
    }
    this.world.critters = out;
  }

  updateCritters(dt) {
    if (!this.indoor) this.updateGrazing();
    for (const c of this.world.critters || []) {
      c.t -= dt;
      if (c.tx != null) {
        const dx = c.tx - c.x, dy = c.ty - c.y, d = Math.hypot(dx, dy);
        if (d < 1.5) { c.tx = null; c.moving = false; c.t = 1.5 + Math.random() * 3; }
        else { const sp = 14 * dt, nx = c.x + dx / d * sp, ny = c.y + dy / d * sp; if (this.world.boxFree(nx, ny - 3, 5, 3)) { c.x = nx; c.y = ny; c.moving = true; c.anim += dt * 5; c.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'; } else { c.tx = null; c.moving = false; } }
      } else if (c.t <= 0) {
        c.tx = c.x + (Math.random() * 2 - 1) * 28; c.ty = c.y + (Math.random() * 2 - 1) * 20;
        // outside, they stay near their building
        if (c.outside) { c.tx = Math.max(c.hx - 70, Math.min(c.hx + 70, c.tx)); c.ty = Math.max(c.hy - 20, Math.min(c.hy + 60, c.ty)); }
      }
    }
  }

  /** Sprinklers water the tilled soil around them every morning. */
  waterSprinklers() {
    const isl = getState().islands[FARM_ISLAND];
    const soil = isl?.farm?.soil;
    if (!soil) return;
    for (const p of isl.placements) {
      const d = ALL_PLACEABLES[p.type];
      if (!d?.sprinkle) continue;
      const around = d.sprinkle >= 8 ? [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] : [[0, -1], [-1, 0], [1, 0], [0, 1]];
      for (const [dx, dy] of around) { const plot = soil[(p.x + dx) + ',' + (p.y + dy)]; if (plot) plot.water = true; }
    }
  }

  /** The festival happening right now in town, if any. */
  festivalToday() {
    const s = getState();
    if (!s || this.world?.id !== FARM_ISLAND || this.indoor) return null;
    const sn = seasonOf(s.world.day), f = FESTIVALS[sn.season];
    const h = s.world.minutes / 60;
    if (!f || sn.day !== f.day || h < (f.from ?? FESTIVAL_HOURS.from) || h >= (f.to ?? FESTIVAL_HOURS.to)) return null;
    return { ...f, season: sn.season, year: sn.year, key: `${sn.year}-${f.id}` };
  }

  /** A beaten boss: you open its chest; everyone else in the world gets a share. */
  onBossDefeated(level, name) {
    toast(`You defeated the ${name}! Its treasure is yours.`, 'trophy', 'gold');
    sfx('levelup');
    if (this.channel) this.ui.online?.social.relay('boss', { floor: level });
  }

  openBossChest(o) {
    const s = getState();
    s.flags.bossDay = s.flags.bossDay || {};
    if (s.flags.bossDay[o.level] === s.world.day) { toast('You already opened this treasure today.', 'chest'); return; }
    s.flags.bossDay[o.level] = s.world.day;
    const r = BOSSES[o.level]?.reward || {};
    const got = [];
    if (r.coins) { addCoinsTo(r.coins); got.push(`${r.coins} coins`); }
    for (const [id, n] of Object.entries(r.items || {})) { addItemTo(id, n); got.push(`${n} ${RESOURCES[id]?.name || id}`); }
    if (r.pearls) { s.player.pearls += r.pearls; got.push(`${r.pearls} pearls`); }
    this.world.broken.add(o.id);
    this.world.rebuild();
    sfx('levelup');
    toast(`Boss treasure: ${got.join(', ')}!`, 'chest', 'gold');
    commit('bossChest');
  }

  updateNpcs(dt) {
    const p = this.mode === 'play' ? this.player : null;
    this.scheduleNpcs();
    for (const n of this.world.npcs) {
      if (!this.world.inBoundsPx(n.homeX, n.homeY - 2)) continue;   // in another area
      // Hold still while the player is close (or heading over to chat).
      if (p && Math.hypot(p.x - n.x, p.y - n.y) < 3 * TILE) {
        n.tx = null; n.moving = false; n.timer = Math.max(n.timer, 1.5);
        continue;
      }
      n.timer -= dt;
      if (n.tx != null) {
        const dx = n.tx - n.x, dy = n.ty - n.y, d = Math.hypot(dx, dy);
        if (d < 1.5) { n.tx = null; n.moving = false; n.walkHome = false; n.timer = 2 + Math.random() * 4; }
        else {
          const sp = 22 * dt;
          const nx = n.x + (dx / d) * sp, ny = n.y + (dy / d) * sp;
          if (this.world.boxFree(nx, ny - 3, 5, 3) && !(this.player && Math.hypot(nx - this.player.x, ny - this.player.y) < 10)) { n.x = nx; n.y = ny; n.moving = true; n.anim += dt * 6; }
          else if (n.walkHome) { n.x = n.tx; n.y = n.ty; n.tx = null; n.moving = false; n.walkHome = false; }   // blocked: they took another way
          else { n.tx = null; n.moving = false; n.timer = 1.5; }
          n.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
        }
      } else if (n.timer <= 0 && n.wander > 0) {
        n.tx = n.homeX + (Math.random() * 2 - 1) * n.wander;
        n.ty = n.homeY + (Math.random() * 2 - 1) * n.wander;
      } else if (n.timer <= 0) {
        n.dir = ['down', 'left', 'right', 'down'][Math.floor(Math.random() * 4)];
        n.timer = 3 + Math.random() * 4;
      }
    }
  }

  draw(dt) {
    const s = getState();
    const play = this.mode === 'play';
    const st = play ? s : this.titleState;
    const scene = {
      camera: this.camera,
      world: this.world,
      player: play && !this.sleeping ? this.player : null,
      playerSprite: play ? sprite('player') : null,
      state: st,
      fishing: this.fishing,
      build: this.build.active ? { ghost: this.build.ghost, moving: this.build.moving } : null,
      interactTarget: this.interactTarget,
      settings: play ? s.settings : { reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches },
      weather: play ? currentWeather() : 'sunny',
      light: play ? lighting() : { r: 0, g: 0, b: 0, a: 0, dark: 0 },
      title: !play,
      stick: play ? this.controls.stickVisual() : null,
      hiddenSpotsVisible: this.revealedSpots,
      questGiver: play && !this.visit ? questGiverHere() : null,
      remotes: play && this.remotes ? this.remotesHere() : null,
      riding: play && !!this.riding,
      festival: play ? this.festivalToday()?.id || null : null,
      lanterns: play ? (this.lanternShow || (this.festivalToday()?.id === 'lantern_night' && getState().world.minutes >= 19.5 * 60 ? (this.lanternStart = this.lanternStart || { start: performance.now() }) : null)) : null,
      phase: play ? currentPhase() : 'morning',
      target: play ? this.farmTarget() : null,
    };
    this.renderer.render(scene, dt);
  }
}

function faceToward(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
}

function questGiverHere() {
  const q = currentQuest();
  if (!q) return null;
  if (q.objective.type === 'talk' && !getState().quests.ready) return q.objective.npc;
  return null;
}

