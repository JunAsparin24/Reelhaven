// Fishing: charge-and-release casting, bite timing, and the reeling
// minigame. This module is pure simulation; js/ui/fishing-panel.js draws it.
//
// Phases: ready → charge → cast → wait → bite → reel → (landing) → done
//                                  ↘ early tap: "too soon"   ↘ missed / escaped
import { TILE } from './art/tiles.js';
import { getState, commit } from './state.js';
import { emit, toast } from './events.js';
import { pickFish, rodStats, rollSize, rollVariant } from './fish.js';
import { BAIT } from '../data/item-data.js';
import { RARITY_XP } from '../data/fish-data.js';
import { ISLANDS } from '../data/island-data.js';
import { itemCount, removeItem, addCoins, addItem, addPearls } from './economy.js';
import { addFish, isFull } from './inventory.js';
import { addXp, checkAchievements } from './progression.js';
import { currentPhase, currentWeather } from './weather.js';
import { hasBuilding } from './building-count.js';
import { sfx, vibrate } from './audio.js';
import { eventEffect } from './world-events.js';

const DIR = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
export const PERFECT_ZONE = [0.78, 0.93];

/** Movement styles for the reeling minigame. Values are in track units (0..1). */
const BEHAVIORS = {
  smooth: { interval: [1.1, 2.0], range: 0.45, speed: 1.0 },
  darter: { interval: [0.35, 0.8], range: 0.25, speed: 1.4 },
  lazy: { interval: [1.6, 3.0], range: 0.35, speed: 0.6, burst: 0.18 },
  floater: { interval: [2.0, 3.0], range: 0.3, speed: 0.7, wave: 0.12 },
  puffer: { interval: [0.9, 1.6], range: 0.6, speed: 0.4, burst: 0.4 },
  erratic: { interval: [0.25, 0.7], range: 0.55, speed: 1.3 },
  sprinter: { interval: [0.9, 1.5], range: 0.9, speed: 1.5 },
  eel: { interval: [0.8, 1.4], range: 0.4, speed: 1.0, wave: 0.18 },
  trickster: { interval: [0.6, 1.2], range: 0.8, speed: 1.5, feint: 0.35 },
};

const rand = (a, b) => a + Math.random() * (b - a);

export class FishingSession {
  constructor(spot, world, player) {
    this.spot = spot;
    this.world = world;
    this.player = player;
    this.active = true;
    this.phase = 'ready';
    this.power = 0;
    this.powerDir = 1;
    this.perfect = false;
    this.bobber = null;
    this.timer = 0;
    this.nibbleAt = 0;
    this.fish = null;
    this.reel = null;
    this.tension = 0;
    this.jump = null;
    this.result = null;
    this.message = null;
    this.holding = false;
    this.reelTick = 0;
    player.facing = spot.facing;
    player.pose = 'hold';
    player.poseTimer = 0;
  }

  get state() { return getState(); }

  context() {
    const s = this.state;
    const isl = ISLANDS[s.player.island];
    const night = currentPhase() === 'night';
    return {
      zone: this.spot.zone, island: s.player.island, phase: currentPhase(), weather: currentWeather(),
      bait: this.baitInUse(), rod: s.inventory.equippedRod, level: s.player.level, perfect: this.perfect,
      spotLuck: this.spot.luck || 0, islandLuck: (isl.fishingMod?.luck || 0) + (night ? eventEffect('nightLuck') : 0), lighthouse: hasBuilding('lighthouse'),
      collection: s.collection,
    };
  }

  baitInUse() {
    const b = this.state.inventory.equippedBait;
    return b !== 'none' && itemCount(b) > 0 ? b : 'none';
  }

  setPhase(p, msg = null) {
    this.phase = p;
    this.message = msg;
    emit('fishing:phase', { phase: p, session: this });
  }

  // ---------------------------------------------------------------- input
  press() {
    this.holding = true;
    switch (this.phase) {
      case 'ready':
      case 'missed':
        this.power = 0; this.powerDir = 1;
        this.setPhase('charge');
        break;
      case 'wait':
        // Reeled in too early: no penalty except time.
        this.bobber = null;
        sfx('plop');
        this.setPhase('ready', 'Too soon! Wait for the splash.');
        break;
      case 'bite': this.hook(); break;
      default: break;
    }
  }

  release() {
    this.holding = false;
    if (this.phase === 'charge') this.cast();
  }

  cast() {
    const [dx, dy] = DIR[this.spot.facing];
    const p = this.player;
    this.perfect = this.power >= PERFECT_ZONE[0] && this.power <= PERFECT_ZONE[1];
    // Distance 1.6–3.6 tiles; pull back until it lands in water.
    let dist = 1.6 + this.power * 2;
    let tx, ty, guard = 0;
    do {
      tx = p.x + dx * dist * TILE; ty = p.y - 6 + dy * dist * TILE;
      dist -= 0.25;
    } while (!this.world.isWater(Math.floor(tx / TILE), Math.floor(ty / TILE)) && dist > 0.8 && guard++ < 20);
    if (!this.world.isWater(Math.floor(tx / TILE), Math.floor(ty / TILE))) {
      tx = this.spot.waterX * TILE + 8; ty = this.spot.waterY * TILE + 8;
    }
    const s = this.state;
    s.stats.casts += 1;
    if (this.perfect) {
      s.stats.perfectCasts += 1;
      emit('perfectCast');
      sfx('perfect');
    }
    sfx('cast');
    this.bobber = { sx: p.x, sy: p.y - 18, x: p.x, y: p.y - 18, tx, ty, z: 0, t: 0, dur: 0.55, inWater: false, dip: 0 };
    this.setPhase('cast', this.perfect ? 'Perfect cast!' : null);
  }

  hook() {
    const bait = this.baitInUse();
    if (bait !== 'none') removeItem(bait, 1);
    const ctx = this.context();
    const rod = rodStats(ctx.rod, ctx);
    const isl = ISLANDS[this.state.player.island];
    const difficulty = Math.min(10, this.fish.difficulty + (isl.fishingMod?.difficulty || 0));
    const beh = BEHAVIORS[this.fish.behavior] || BEHAVIORS.smooth;
    // Catch zone ~10% narrower than v1 (fishing was a little too easy).
    const zoneW = Math.max(0.16, Math.min(0.46, rod.zone * 0.9 - (difficulty - 3) * 0.008));
    this.reel = {
      difficulty, beh, zoneW, power: rod.power,
      fishPos: 0.5, fishVel: 0, fishTarget: 0.5, nextMove: 0.6, t: 0,
      zonePos: 0.5 - zoneW / 2, zoneVel: 0,
      progress: 0.28,
      inZone: false,
      treasure: Math.random() < 0.12 + ctx.spotLuck * 0.2 ? { at: rand(1, 3), pos: rand(0.1, 0.9), progress: 0, shown: false, done: false, life: 7 } : null,
    };
    this.tension = 0;
    sfx('splash');
    vibrate(30);
    this.setPhase('reel');
  }

  stop() {
    this.active = false;
    this.player.pose = 'walk';
    emit('fishing:end');
  }

  // ---------------------------------------------------------------- update
  update(dt) {
    const b = this.bobber;
    switch (this.phase) {
      case 'charge':
        this.power += this.powerDir * dt * 1.15;
        if (this.power >= 1) { this.power = 1; this.powerDir = -1; }
        if (this.power <= 0) { this.power = 0; this.powerDir = 1; }
        break;
      case 'cast': {
        b.t += dt;
        const u = Math.min(1, b.t / b.dur);
        b.x = b.sx + (b.tx - b.sx) * u;
        b.y = b.sy + (b.ty - b.sy) * u;
        b.z = Math.sin(u * Math.PI) * 22;
        if (u >= 1) {
          b.inWater = true; b.z = 0;
          sfx('plop');
          emit('fishing:splash', { x: b.x, y: b.y, small: true });
          this.startWait();
        }
        break;
      }
      case 'wait':
        this.timer -= dt;
        b.dip = Math.sin(performance.now() / 300) > 0.7 ? 1 : 0;
        if (this.timer <= this.nibbleAt && this.nibbleAt > 0) {
          this.nibbleAt = this.timer > 1.2 ? rand(0.6, this.timer - 0.4) : 0;
          b.dip = 2;
          sfx('nibble');
        }
        if (this.timer <= 0) this.startBite();
        break;
      case 'bite':
        this.timer -= dt;
        b.dip = 3 + (Math.floor(performance.now() / 90) % 2);
        if (this.timer <= 0) {
          this.state.stats.escapes += 1;
          sfx('escape');
          this.bobber = null;
          this.fish = null;
          this.setPhase('missed', 'It slipped away… Tap faster when it bites!');
        }
        break;
      case 'reel': this.updateReel(dt); break;
      case 'landing':
        this.jump.t += dt;
        if (this.jump.t >= this.jump.dur) { this.jump = null; this.finishCatch(); }
        break;
      default: break;
    }
  }

  startWait() {
    const bait = BAIT[this.baitInUse()] || BAIT.none;
    let t = rand(2.2, 6.5) / (bait.biteSpeed || 1);
    if (this.perfect) t *= 0.7;
    this.timer = t;
    this.nibbleAt = t > 2.5 ? rand(1, t - 0.5) : 0;
    this.setPhase('wait', this.perfect ? 'Perfect cast! Fish are curious…' : null);
  }

  startBite() {
    const ctx = this.context();
    const fish = pickFish(ctx);
    if (!fish) {
      this.bobber = null;
      this.setPhase('ready', 'Nothing is biting here right now. Try another spot or time.');
      return;
    }
    this.fish = fish;
    this.timer = rodStats(ctx.rod, ctx).biteWindow + (this.state.settings.reducedMotion ? 0.15 : 0);
    sfx('bite');
    vibrate([40, 30, 40]);
    emit('fishing:splash', { x: this.bobber.x, y: this.bobber.y });
    this.setPhase('bite');
  }

  updateReel(dt) {
    const r = this.reel, beh = r.beh;
    r.t += dt;
    // --- fish movement
    r.nextMove -= dt;
    if (r.nextMove <= 0) {
      r.nextMove = rand(beh.interval[0], beh.interval[1]) * (1.1 - r.difficulty * 0.03);
      let target = r.fishPos + rand(-beh.range, beh.range);
      if (beh.feint && Math.random() < beh.feint) target = r.fishPos - (target - r.fishPos) * 0.8;
      if (beh.burst && Math.random() < beh.burst) { target = Math.random() < 0.5 ? 0.05 : 0.95; r.nextMove *= 0.6; }
      r.fishTarget = Math.max(0.03, Math.min(0.97, target));
    }
    let goal = r.fishTarget;
    if (beh.wave) goal += Math.sin(r.t * 3.2) * beh.wave;
    const maxSpeed = (0.24 + r.difficulty * 0.08) * beh.speed;
    const want = Math.max(-maxSpeed, Math.min(maxSpeed, (goal - r.fishPos) * 4));
    r.fishVel += (want - r.fishVel) * Math.min(1, dt * 6);
    r.fishPos = Math.max(0.02, Math.min(0.98, r.fishPos + r.fishVel * dt));
    // --- player's catch zone (hold to push right, release to drift left)
    const acc = this.holding ? 3.1 : -2.6;
    r.zoneVel = (r.zoneVel + acc * dt) * Math.pow(0.35, dt);
    r.zonePos += r.zoneVel * dt;
    if (r.zonePos < 0) { r.zonePos = 0; r.zoneVel = Math.abs(r.zoneVel) * 0.25; }
    if (r.zonePos > 1 - r.zoneW) { r.zonePos = 1 - r.zoneW; r.zoneVel = -Math.abs(r.zoneVel) * 0.25; }
    // --- progress
    const inZone = r.fishPos >= r.zonePos && r.fishPos <= r.zonePos + r.zoneW;
    r.inZone = inZone;
    if (inZone) r.progress += 0.25 * r.power * dt;
    else r.progress -= (0.15 + r.difficulty * 0.016) * dt;
    this.tension += ((inZone ? 0.4 : 1) - this.tension) * Math.min(1, dt * 5);
    this.reelTick -= dt;
    if (inZone && this.reelTick <= 0) { sfx('reel'); this.reelTick = 0.12; }
    // --- treasure chest
    const tr = r.treasure;
    if (tr && !tr.done) {
      if (!tr.shown && r.t >= tr.at) tr.shown = true;
      if (tr.shown) {
        tr.life -= dt;
        if (tr.pos >= r.zonePos && tr.pos <= r.zonePos + r.zoneW) tr.progress += dt / 1.4;
        if (tr.progress >= 1) { tr.done = true; tr.won = true; this.grantTreasure(); }
        else if (tr.life <= 0) tr.done = true;
      }
    }
    if (r.progress >= 1) this.land();
    else if (r.progress <= 0) {
      this.state.stats.escapes += 1;
      sfx('escape');
      vibrate(80);
      this.bobber = null;
      const name = this.fish.name;
      this.fish = null;
      this.reel = null;
      this.tension = 0;
      this.setPhase('missed', `The ${name} got away! Keep it inside the green zone.`);
    }
  }

  grantTreasure() {
    const s = this.state;
    s.stats.treasures += 1;
    const roll = Math.random();
    let text;
    if (roll < 0.08) { addPearls(1); text = 'Treasure! A shimmering pearl!'; }
    else if (roll < 0.35) { addItem('seaglass', 1); text = 'Treasure! A piece of sea glass!'; }
    else if (roll < 0.55) { addItem('shrimp_bait', 2); text = 'Treasure! 2 Shrimp Bait!'; }
    else { const c = Math.round(rand(20, 70)); addCoins(c, 'treasure'); text = `Treasure! ${c} coins!`; }
    sfx('coin');
    toast(text, 'chest', 'good');
  }

  land() {
    const b = this.bobber;
    const p = this.player;
    this.jump = { x0: b.x, y0: b.y, x1: p.x, y1: p.y - 20, t: 0, dur: 0.7, sprite: 'fish_' + this.fish.id };
    this.bobber = null;
    this.reel = null;
    this.tension = 0;
    sfx('catch');
    vibrate([30, 40, 60]);
    emit('fishing:splash', { x: b.x, y: b.y, big: true });
    this.setPhase('landing');
  }

  finishCatch() {
    const s = this.state;
    const fish = this.fish;
    const variant = rollVariant(this.context().spotLuck);
    const size = rollSize(fish, this.perfect);
    const isNew = !s.collection[fish.id];
    const rec = s.collection[fish.id] || { count: 0, maxSize: 0, first: Date.now(), variant: false };
    rec.count += 1;
    const isRecord = size > rec.maxSize;
    rec.maxSize = Math.max(rec.maxSize, size);
    if (variant) rec.variant = true;
    s.collection[fish.id] = rec;
    // stats
    const ph = currentPhase();
    s.stats.fishCaught += 1;
    s.stats.zoneCatch[this.spot.zone] = (s.stats.zoneCatch[this.spot.zone] || 0) + 1;
    if (ph === 'night') s.stats.nightCatches += 1;
    if (['uncommon', 'rare', 'epic', 'legendary'].includes(fish.rarity)) s.stats.uncommonCaught += 1;
    if (['rare', 'epic', 'legendary'].includes(fish.rarity)) s.stats.rareCaught += 1;
    if (fish.rarity === 'legendary') s.stats.legendaryCaught += 1;
    if (isNew) s.stats.speciesNew += 1;
    let entry = null, stored = false;
    if (!fish.release) {
      entry = { id: fish.id, size, variant };
      if (!isFull()) { entry = addFish(fish.id, size, variant); stored = true; }
    } else {
      addPearls(3);
    }
    const xp = RARITY_XP[fish.rarity] + (isNew ? 25 : 0);
    addXp(xp);
    this.player.cheer();
    this.result = { fish, size, variant, isNew, isRecord: isRecord && !isNew, xp, entry, stored, released: !!fish.release };
    emit('fishCaught', { fish, entry, isNew, zone: this.spot.zone, night: ph === 'night' });
    checkAchievements();
    commit('catch');
    this.setPhase('result');
  }

  /** After the result card is dismissed. */
  continueFishing() {
    this.fish = null;
    this.result = null;
    this.player.pose = 'hold';
    this.setPhase('ready');
  }
}
