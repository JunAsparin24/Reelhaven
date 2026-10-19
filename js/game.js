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
import { markTalked } from './dialogue.js';
import { pendingSettings } from './ui/panels/settings.js';

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
    this.interactTarget = null;
    this.revealedSpots = new Set();
    this.paused = false;
    this.last = 0;
    this.titlePan = 0;
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
    this.world = new World(id, s.islands[id]);
    this.renderer.setWorld(this.world);
    this.revealedSpots = new Set();
    const pos = keepPos && s.player.pos ? s.player.pos : ISLANDS[id].spawn;
    this.player = new Player(0, 0, s.player.facing || 'down');
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

  persistNow() {
    const s = getState();
    if (!s || this.mode !== 'play') return;
    this.syncPlayerToState();
    this.autosave.flush();
  }

  syncPlayerToState() {
    const s = getState();
    if (!s || !this.player) return;
    s.player.pos = { x: this.player.tileX, y: this.player.tileY };
    s.player.facing = this.player.facing;
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
      this.renderer.emit('leaf', (x + fw / 2) * TILE, (y + fh) * TILE - 4, 16, { speed: 50, life: 0.8, color: '#e8c98e', gravity: 60 });
      this.renderer.emit('sparkle', (x + fw / 2) * TILE, (y + fh / 2) * TILE, 10, { speed: 40, gravity: 10 });
    });
    on('weather', ({ weather }) => {
      if (this.mode === 'play' && weather === 'storm') { sfx('thunder'); }
    });
    on('phase', ({ phase }) => setMood(phase === 'night' || phase === 'evening' ? 'night' : 'day'));
    on('settings', () => { const s = getState(); setVolumes(s.settings); });
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

  interact(it) {
    if (!it || this.inputBlocked()) return;
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
      case 'boat': this.ui.open('map'); break;
      case 'bridge': this.ui.bridge(); break;
      case 'building': this.ui.building(it.placement); break;
      default: break;
    }
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
    if (this.mode === 'title') {
      this.titlePan += dt;
      const cx = 22 * TILE + Math.sin(this.titlePan * 0.08) * 90, cy = 26 * TILE + Math.cos(this.titlePan * 0.06) * 50;
      this.camera.follow(cx, cy, dt, this.world);
      this.updateNpcs(dt);
      return;
    }
    const s = getState();
    tickWeather(dt);
    const input = this.inputBlocked() ? { x: 0, y: 0 } : this.controls.read();
    if (!this.build.active) this.player.update(dt, input, this.world);
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
    if (this.build.active && this.build.ghost) {
      const g = this.build.ghost;
      const hidden = (this.ui.obscuredBottom() * this.renderer.dpr) / this.renderer.scale;
      this.camera.extraBottom = hidden;
      this.camera.follow((g.x + g.fw / 2) * TILE, (g.y + g.fh / 2) * TILE + hidden / 2, dt, this.world);
    } else {
      const look = this.fishing && this.fishing.bobber ? { x: (this.fishing.bobber.x - this.player.x) * 0.5, y: (this.fishing.bobber.y - this.player.y) * 0.5 } : { x: 0, y: 0 };
      // Keep the action centred in the part of the screen not covered by panels.
      const hidden = (this.ui.obscuredBottom() * this.renderer.dpr) / this.renderer.scale;
      look.y += hidden / 2;
      this.camera.extraBottom = hidden;
      this.camera.follow(this.player.x, this.player.y - 8, dt, this.world, look);
    }
    // periodic housekeeping
    const t = this.timers;
    t.orders += dt; t.daily += dt; t.nodes += dt;
    if (t.orders > 5) { t.orders = 0; ensureOrders(); }
    if (t.daily > 30) { t.daily = 0; ensureDaily(); }
    if (t.nodes > 4) { t.nodes = 0; this.world.rebuild(); }
    this.ui.frame(dt, s);
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
      questGiver: play ? questGiverHere() : null,
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

