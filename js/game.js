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
import { findInteractable, gather } from './interactions.js';
import { tick as tickWeather, lighting, currentWeather, currentPhase } from './weather.js';
import { initQuests, ensureOrders, ensureDaily, currentQuest } from './quests.js';
import { travelTo } from './islands.js';
import { checkAchievements } from './progression.js';
import { initAudio, sfx, setVolumes, startMusic, setMood, pauseAudio, resumeAudio } from './audio.js';
import { ISLANDS } from '../data/island-data.js';
import { INTERIORS } from '../data/interior-data.js';
import { markTalked } from './dialogue.js';
import { pendingSettings } from './ui/panels/settings.js';
import { FootstepSystem } from './footsteps.js';
import { buildCharacter } from './art/characters.js';
import { PLACEABLES } from '../data/building-data.js';
import { fullCost, checkCost, spend } from './economy.js';
import { countBuilt } from './building-count.js';
import { hasBlueprint } from './shop.js';
import { reasonText } from './building.js';
import { addXp } from './progression.js';
import { commit } from './state.js';

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
    this.indoor = null;           // { id, outside: World, ret: {x, y} } while inside a building
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
      onInteractKey: e => this.onInteractKey(e),
      onEscape: () => this.onEscape(),
      onRotateKey: () => { if (this.build.active && this.build.type) this.build.rotate(); },
      onKeyNudge: dir => this.build.active && this.build.type && this.build.nudge(...{ up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir]),
      onDrag: (dx, dy) => this.onBuildDrag(dx, dy),
      onDragEnd: () => { this.dragAcc = null; },
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

  /** Start a fresh game (overwrites the stored save only after confirmation in UI). */
  newGame(profile) {
    const st = createNewState(profile);
    st.settings = { ...st.settings, ...pendingSettings };
    setState(st);
    Save.save(st);
    this.enterPlay();
    emit('newGame');
  }

  continueGame(loaded) {
    setState(loaded);
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
    this.leaveChannel();
    this.visit = null;
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
    if (!s || !this.player || this.visit) return;   // a visit never moves your own save
    s.player.pos = this.indoor ? { ...this.indoor.ret } : { x: this.player.tileX, y: this.player.tileY };
    s.player.facing = this.player.facing;
  }

  // ---------------------------------------------------------------- visits
  /**
   * Visit a friend's island from their public snapshot. A temporary world is
   * built from the snapshot; the visitor's own state (save, island, position,
   * inventory) is never modified and saving continues as normal.
   */
  startVisit({ hostId, hostName, snapshot, islandId, member = false }) {
    if (this.fishing) this.stopFishing();
    if (this.build.active) this.ui.closeBuild();
    // Joined players may arrive before the host ever synced: start empty, the
    // host's live layout arrives a moment later.
    const islands = snapshot?.islands?.length ? snapshot.islands : [{ id: islandId || 'sunny', placements: [], flags: {} }];
    const isl = islands.find(i => i.id === islandId) || (member ? { id: islandId, placements: [], flags: {} } : islands[0]);
    if (!isl || !ISLANDS[isl.id]) { toast('That island can’t be visited right now.', null, 'error'); return; }
    this.syncPlayerToState();
    this.ui.fade(() => {
      this.leaveChannel();
      const temp = {
        unlocked: true, visited: true, nodes: {}, gardens: {}, flags: { ...(isl.flags || {}) },
        placements: isl.placements.filter(p => p && typeof p.type === 'string').map((p, i) => ({ ...p, uid: 'visit' + i })),
      };
      this.indoor = null;
      this.visit = { hostId, hostName, islandId: isl.id, islandName: isl.name || ISLANDS[isl.id].name, hostHere: false, member };
      this.world = new World(isl.id, temp);
      this.renderer.setWorld(this.world);
      this.revealedSpots = new Set();
      const sp = ISLANDS[isl.id].spawn;
      this.player = new Player(0, 0, 'up');
      this.footsteps.attach(this.player);
      this.player.placeAtTile(sp.x, sp.y);
      this.onResize();
      this.camera.snap(this.player.x, this.player.y, this.world);
      this.joinChannel(hostId, isl.id);
      this.ui.online?.social.setStatus({ status: 'visiting' });
      this.ui.refreshVisit();
    }, `${hostName}’s island`);
  }

  leaveVisit() {
    if (!this.visit) return;
    if (this.visit.member) this.ui.online?.social.leaveSession();
    this.ui.fade(() => {
      this.leaveChannel();
      this.visit = null;
      this.loadIsland(getState().player.island, true);
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
      name: online.auth.profile?.name || s.player.name, look: s.player.look,
      host: hostId === online.auth.user.id, x: this.player.x, y: this.player.y, f: this.player.facing,
    }, {
      onPeers: list => {
        const ids = new Set(list.map(p => p.id));
        for (const id of [...this.remotes.keys()]) if (!ids.has(id)) this.remotes.delete(id);
        for (const p of list) {
          const r = this.remotes.get(p.id) || { x: p.x, y: p.y, tx: p.x, ty: p.y, f: p.f || 'down', anim: 0 };
          Object.assign(r, { name: p.name, look: p.look, host: p.host });
          this.remotes.set(p.id, r);
        }
        if (this.visit) { this.visit.hostHere = list.some(p => p.host); this.ui.refreshVisit(); }
        else this.shareLayout();   // newcomers get the host's live layout
      },
      onCoopEdit: m => this.hostCoopEdit(m),
      onCoopLayout: m => this.applyCoopLayout(m),
      onMove: (id, pos) => {
        const r = this.remotes.get(id);
        if (!r) return;
        r.tx = pos.x; r.ty = pos.y; r.f = pos.f || r.f;
      },
    });
  }

  leaveChannel() {
    if (this.channel) { try { this.channel.leave(); } catch { /* already closed */ } }
    this.channel = null; this.channelKey = null; this.remotes = new Map();
  }

  /** Throttled position broadcast + smooth movement of other players. */
  updateRemotes(dt) {
    const online = this.ui.online;
    // Hosts are reachable on their own island whenever they're signed in.
    if (!this.visit && online?.auth.signedIn && this.mode === 'play') this.joinChannel(online.auth.user.id, this.outdoor.id);
    if (!this.channel) return;
    this.netT = (this.netT || 0) - dt;
    // Indoors, everyone else on the island sees you waiting at the door.
    const p = this.indoor ? { x: this.indoor.ret.x * TILE + 8, y: this.indoor.ret.y * TILE + 12, facing: 'up' } : this.player;
    const moved = !this.lastSent || Math.hypot(p.x - this.lastSent.x, p.y - this.lastSent.y) > 0.5 || p.facing !== this.lastSent.f;
    if ((moved && this.netT <= 0) || this.netT < -2) {
      this.netT = 0.12;
      this.lastSent = { x: Math.round(p.x), y: Math.round(p.y), f: p.facing };
      try { this.channel.send(this.lastSent); } catch { /* reconnecting */ }
    }
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
    on('settings', () => { const s = getState(); setVolumes(s.settings); });
    // Friends on my island see my building changes live.
    on('change', e => { if (e && ['build', 'move', 'store', 'bridge'].includes(e.reason)) this.shareLayout(); });
  }

  // ---------------------------------------------------------------- input
  inputBlocked() {
    return this.mode !== 'play' || this.ui.blocking() || (this.fishing && this.fishing.active);
  }

  onTap(cssX, cssY) {
    if (this.mode !== 'play' || !this.world) return;
    initAudio();
    const b = this.renderer.cssToBuffer(cssX, cssY);
    const wpt = this.camera.toWorld(b.x, b.y);
    const tx = Math.floor(wpt.x / TILE), ty = Math.floor(wpt.y / TILE);
    if (this.build.active) { this.build.tapTile(tx, ty); return; }
    if (!getState().settings.tapToMove) return;
    // Tapped something interactable? Walk next to it and use it.
    const target = this.interactableNear(wpt.x, wpt.y);
    const p = this.player;
    if (target) {
      const goal = target.npc ? this.besideTile(target.tx, target.ty) : this.world.nearestWalkable(target.tx, target.ty, p.tileX, p.tileY);
      const useTapped = () => {
        // Use exactly what was tapped (not just whatever is nearest on arrival).
        this.interactTarget = findInteractable(this, 1.8, target.match) || findInteractable(this);
        if (this.interactTarget) this.interact(this.interactTarget);
      };
      if (goal && goal.x === p.tileX && goal.y === p.tileY) { useTapped(); return; }
      if (goal) {
        const path = this.world.findPath(p.tileX, p.tileY, goal.x, goal.y);
        if (path) {
          p.setPath(path, useTapped);
          this.renderer.emit('sparkle', goal.x * TILE + 8, goal.y * TILE + 10, 4, { speed: 15, gravity: 0, life: 0.5 });
          return;
        }
      }
    }
    if (this.world.walkableTile(tx, ty)) {
      const path = this.world.findPath(p.tileX, p.tileY, tx, ty);
      if (path) { p.setPath(path); this.renderer.emit('sparkle', tx * TILE + 8, ty * TILE + 10, 4, { speed: 15, gravity: 0, life: 0.5 }); }
    }
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
      if (!(o.def.resource || o.def.interact) || w.objectHidden(o)) continue;
      const fp = o.def.footprint || { w: 1, h: 1 };
      test(o.x * TILE + fp.w * 8, (o.y + fp.h) * TILE - 10, o.x + Math.floor(fp.w / 2), o.y + fp.h, it => it.obj === o, fp.w > 1 || o.type === 'boat' ? 30 : 18);
    }
    for (const p of w.placed) {
      if (p.def.kind !== 'building') continue;
      test(p.x * TILE + p.fw * 8, (p.y + p.fh) * TILE - 12, p.x + Math.floor(p.fw / 2), p.y + p.fh, it => it.placement === p, 30);
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
    if (this.interactTarget) { this.interact(this.interactTarget); return true; }
    return false;
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
  async joinGame({ host, name, island }) {
    let snap = null;
    try { snap = (await this.ui.online.social.snapshotOf(host))?.data || null; } catch { /* start empty */ }
    this.startVisit({ hostId: host, hostName: name, snapshot: snap, islandId: island, member: true });
  }

  canUse(it) {
    if (!this.visit) return true;
    if (it.kind === 'npc' || it.kind === 'enter' || it.kind === 'exit') return true;
    return this.visit.member && ['spot', 'gather', 'shop', 'board'].includes(it.kind);
  }

  // ---------------------------------------------------------------- co-op
  /** Host: send the island's live layout to everyone on it. */
  shareLayout() {
    const online = this.ui.online;
    if (this.visit || !this.channel || !online?.auth.signedIn) return;
    const isl = getState().islands[this.outdoor.id];
    online.social.shareLayout({ bridgeRepaired: !!isl.flags.bridgeRepaired },
      isl.placements.map(({ uid, type, x, y, rot }) => ({ uid, type, x, y, rot })));
  }

  /** Host: a visiting friend wants to place or move something. */
  hostCoopEdit(m) {
    const social = this.ui.online?.social;
    const reply = (ok, error = '') => social?.coopResult(m.from, m.req, ok, error);
    const s = getState();
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
      case 'spot': this.startFishing(it.spot); break;
      case 'npc': {
        const n = it.npc;
        n.dir = faceToward(n, p);
        p.facing = faceToward(p, n);
        markTalked(n.id);
        this.ui.talk(n.id);
        break;
      }
      case 'gather': gather(this, it.obj); break;
      case 'board': this.ui.open('quests'); break;
      case 'shop': this.ui.open('shop'); break;
      case 'enter': this.enterInterior(it); break;
      case 'exit': this.exitInterior(); break;
      case 'bed': this.ui.restMenu(); break;
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
  enterInterior(it) {
    if (this.indoor || this.ui.fading) return;
    const id = it.obj ? it.obj.def.interior : 'cottage_interior';
    const def = INTERIORS[id];
    if (!def) return;
    // Where to stand when coming back out: the tile in front of the door.
    let ret;
    if (it.obj) { const fp = it.obj.def.footprint || { w: 1, h: 1 }; ret = { x: it.obj.x + Math.floor(fp.w / 2), y: it.obj.y + fp.h }; }
    else { const pl = it.placement; ret = { x: pl.x + Math.floor(pl.fw / 2), y: pl.y + pl.fh }; }
    const outside = this.world;
    if (!outside.walkableTile(ret.x, ret.y)) ret = outside.nearestWalkable(ret.x, ret.y, this.player.tileX, this.player.tileY) || { x: this.player.tileX, y: this.player.tileY };
    sfx('click');
    this.ui.fade(() => {
      this.indoor = { id, outside, ret };
      this.world = new World(id, { unlocked: true, visited: true, nodes: {}, gardens: {}, flags: {}, placements: [] });
      this.renderer.setWorld(this.world);
      this.player.placeAtTile(def.spawn.x, def.spawn.y);
      this.player.facing = 'up';
      this.onResize();
      this.camera.snap(this.player.x, this.player.y, this.world);
      this.ui.closeAll();
    }, def.name);
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

  startFishing(spot) {
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
    const blocked = this.inputBlocked();
    // Menus, dialogue and fishing stop the player (and their footsteps) at once,
    // including a tap-to-walk that was in progress.
    if (blocked && this.player.path) this.player.cancelPath();
    const input = blocked ? { x: 0, y: 0 } : this.controls.read();
    if (!this.build.active) this.player.update(dt, input, this.world);
    else this.player.moving = false;
    this.footsteps.update(dt);
    if (this.indoor && !this.ui.fading && this.player.tileY >= this.world.def.exit.y) this.exitInterior();
    this.updateNpcs(dt);
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

  updateNpcs(dt) {
    const p = this.mode === 'play' ? this.player : null;
    for (const n of this.world.npcs) {
      // Hold still while the player is close (or heading over to chat).
      if (p && Math.hypot(p.x - n.x, p.y - n.y) < 3 * TILE) {
        n.tx = null; n.moving = false; n.timer = Math.max(n.timer, 1.5);
        continue;
      }
      n.timer -= dt;
      if (n.tx != null) {
        const dx = n.tx - n.x, dy = n.ty - n.y, d = Math.hypot(dx, dy);
        if (d < 1.5) { n.tx = null; n.moving = false; n.timer = 2 + Math.random() * 4; }
        else {
          const sp = 22 * dt;
          const nx = n.x + (dx / d) * sp, ny = n.y + (dy / d) * sp;
          if (this.world.boxFree(nx, ny - 3, 5, 3) && !(this.player && Math.hypot(nx - this.player.x, ny - this.player.y) < 10)) { n.x = nx; n.y = ny; n.moving = true; n.anim += dt * 6; }
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
      player: play ? this.player : null,
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
      remotes: play && this.remotes && !this.indoor ? [...this.remotes.values()] : null,
      phase: play ? currentPhase() : 'morning',
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

