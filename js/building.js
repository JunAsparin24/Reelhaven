// Build mode: choose a building/decoration, position a ghost preview, and
// confirm. Costs are only deducted once a valid placement is confirmed.
import { getState, commit, uid } from './state.js';
import { emit } from './events.js';
import { PLACEABLES, BUILDINGS, footprintOf } from '../data/building-data.js';
import { checkCost, spend, describeMissing, fullCost } from './economy.js';
import { countBuilt } from './building-count.js';
import { hasBlueprint } from './shop.js';
import { sprite } from './art/sprites.js';
import { addXp, checkAchievements } from './progression.js';
import { sfx } from './audio.js';
import { ISLANDS } from '../data/island-data.js';

/** Why the player can't build this right now (null if they can). */
export function buildBlocker(type) {
  const s = getState();
  const def = PLACEABLES[type];
  if (def.buildable === false) return 'Already built';
  if (def.minLevel && s.player.level < def.minLevel) return `Reach level ${def.minLevel}`;
  if (def.maxCount && countBuilt(type) >= def.maxCount) return def.maxCount === 1 ? 'Already built' : `Limit ${def.maxCount}`;
  if (def.kind === 'building' && !hasBlueprint(type)) return 'Buy blueprint at Nori’s';
  if (def.requiresIsland && !s.islands[def.requiresIsland]?.unlocked) return 'Discover ' + ISLANDS[def.requiresIsland].name;
  return null;
}

export class BuildMode {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.type = null;
    this.rot = 0;
    this.ghost = null;
    this.moving = null;     // placement being moved
    this.fromStore = false;
    this.selected = null;   // placement tapped while browsing
  }

  get world() { return this.game.world; }

  open() { this.active = true; this.type = null; this.ghost = null; this.moving = null; this.selected = null; }
  close() { this.active = false; this.type = null; this.ghost = null; this.moving = null; this.selected = null; emit('build:update'); }

  /** Start placing a new item (optionally one from stored decorations). */
  begin(type, fromStore = false) {
    this.type = type;
    this.rot = 0;
    this.fromStore = fromStore;
    this.moving = null;
    this.selected = null;
    const p = this.game.player;
    const fp = footprintOf(PLACEABLES[type], 0);
    const start = this.findFreeSpot(p.tileX - Math.floor(fp.w / 2), p.tileY - fp.h - 1, type);
    this.setGhost(start.x, start.y);
  }

  /** Spiral search for a valid spot near (x, y) so the ghost starts green. */
  findFreeSpot(x, y, type, ignore = null) {
    const pt = { x: this.game.player.tileX, y: this.game.player.tileY };
    for (let r = 0; r < 10; r++) {
      for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
        if (this.world.canPlace(type, x + i, y + j, this.rot, ignore, pt).ok) return { x: x + i, y: y + j };
      }
    }
    return { x, y };
  }

  setGhost(x, y) {
    if (!this.type) return;
    const w = this.world;
    const def = PLACEABLES[this.type];
    const fp = footprintOf(def, this.rot);
    x = Math.max(0, Math.min(w.w - fp.w, x));
    y = Math.max(0, Math.min(w.h - fp.h, y));
    const pt = { x: this.game.player.tileX, y: this.game.player.tileY };
    const res = w.canPlace(this.type, x, y, this.rot, this.moving?.uid || null, pt);
    let sprId = this.type + (this.rot === 1 && def.rotations ? '_r1' : '');
    if (this.type === 'crop_garden') sprId = 'crop_garden_1';
    this.ghost = { x, y, fw: fp.w, fh: fp.h, ok: res.ok, reasons: res.reasons, badTiles: res.bad, sprite: sprite(sprId) };
    emit('build:update');
  }

  nudge(dx, dy) { if (this.ghost) this.setGhost(this.ghost.x + dx, this.ghost.y + dy); }

  rotate() {
    const def = PLACEABLES[this.type];
    if (!def?.rotations) return;
    this.rot = (this.rot + 1) % def.rotations;
    this.setGhost(this.ghost.x, this.ghost.y);
    sfx('click');
  }

  /** Tap on a tile in build mode: move ghost there, or select an existing item. */
  tapTile(tx, ty) {
    if (this.type) {
      const g = this.ghost;
      this.setGhost(tx - Math.floor(g.fw / 2), ty - Math.floor(g.fh / 2));
      return;
    }
    const p = this.world.placementAt(tx, ty);
    this.selected = p || null;
    emit('build:update');
  }

  cost() {
    if (!this.type || this.moving || this.fromStore) return {};
    return fullCost(PLACEABLES[this.type]);
  }

  /** Confirm placement. Returns { ok, message }. */
  confirm() {
    if (this.game.visit) return this.game.coopConfirm(this);   // building on a friend's island
    const g = this.ghost;
    if (!this.type || !g) return { ok: false, message: 'Choose something to build first.' };
    if (!g.ok) { sfx('error'); return { ok: false, message: reasonText(g.reasons) }; }
    const s = getState();
    const isl = s.islands[this.world.id];
    const def = PLACEABLES[this.type];
    if (this.moving) {
      const pl = isl.placements.find(p => p.uid === this.moving.uid);
      if (pl) { pl.x = g.x; pl.y = g.y; pl.rot = this.rot; }
      this.world.rebuild();
      sfx('build');
      emit('placed', { type: this.type, moved: true, x: g.x, y: g.y });
      commit('move');
      const name = def.name;
      this.type = null; this.moving = null; this.ghost = null;
      emit('build:update');
      return { ok: true, message: `${name} moved.` };
    }
    if (!this.fromStore) {
      const blocker = buildBlocker(this.type);
      if (blocker) { sfx('error'); return { ok: false, message: blocker + '.' }; }
      const cost = fullCost(def);
      const check = checkCost(cost);
      if (!check.ok) { sfx('error'); return { ok: false, message: 'Not enough: ' + describeMissing(check.missing) + '.' }; }
      spend(cost);
    } else {
      const st = s.inventory.storedDecor;
      if (!st[this.type]) return { ok: false, message: 'None left in storage.' };
      st[this.type] -= 1;
      if (st[this.type] <= 0) delete st[this.type];
    }
    const placement = { uid: uid('p'), type: this.type, x: g.x, y: g.y, rot: this.rot };
    isl.placements.push(placement);
    if (def.produce) isl.gardens[placement.uid] = Date.now();
    if (def.kind === 'building') { s.stats.buildingsBuilt += 1; addXp(40); }
    else { s.stats.decorPlaced += 1; addXp(3); }
    this.world.rebuild();
    sfx('build');
    emit('built', { id: this.type, kind: def.kind, x: g.x, y: g.y, fw: g.fw, fh: g.fh });
    checkAchievements();
    commit('build');
    const name = def.name;
    // Decorations stay selected for quick repeated placement; buildings end.
    const again = def.kind === 'decor' && !(this.fromStore && !s.inventory.storedDecor[this.type]);
    if (again) this.setGhost(g.x + g.fw, g.y);
    else if (def.kind === 'building') this.close();   // back to normal play so the new building can be used
    else { this.type = null; this.ghost = null; emit('build:update'); }
    return { ok: true, message: `${name} placed!` };
  }

  /** Pick up an existing placement to move it. */
  startMove(placement) {
    this.type = placement.type;
    this.rot = placement.rot || 0;
    this.moving = placement;
    this.fromStore = false;
    this.selected = null;
    this.setGhost(placement.x, placement.y);
  }

  /** Put a decoration back into storage (buildings can only be moved). */
  store(placement) {
    const def = PLACEABLES[placement.type];
    if (def.kind !== 'decor') return { ok: false, message: 'Buildings can be moved, but not stored.' };
    const s = getState();
    const isl = s.islands[this.world.id];
    isl.placements = isl.placements.filter(p => p.uid !== placement.uid);
    s.inventory.storedDecor[placement.type] = (s.inventory.storedDecor[placement.type] || 0) + 1;
    this.world.rebuild();
    this.selected = null;
    sfx('gather');
    commit('store');
    emit('build:update');
    return { ok: true, message: `${def.name} stored.` };
  }

  cancelPlacement() {
    this.type = null; this.ghost = null; this.moving = null;
    emit('build:update');
  }
}

export function reasonText(reasons = []) {
  if (reasons.includes('terrain')) return 'You can only build on grass or sand.';
  if (reasons.includes('front')) return 'The doorway needs open ground in front of it.';
  if (reasons.includes('door')) return 'That would block a doorway.';
  if (reasons.includes('player')) return 'You’re standing there!';
  if (reasons.includes('occupied')) return 'Something is already there.';
  if (reasons.includes('edge')) return 'Too close to the edge of the map.';
  return 'Can’t place that here.';
}

export { BUILDINGS };
