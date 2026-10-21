// Tools, health and the mine's monsters. The player swings the held tool
// (pickaxe or sword) at whatever is in front of them; monsters chase and
// bump into the player. Everything here is local to the current world.
import { TILE } from './art/tiles.js';
import { getState, commit } from './state.js';
import { toast } from './events.js';
import { addItem, addCoins, removeItem, itemCount } from './economy.js';
import { TOOLS, FOOD, RESOURCES } from '../data/item-data.js';
import { ROCKS, MONSTERS } from '../data/mine-data.js';
import { OBJECT_TYPES } from './world.js';
import { T } from './world-gen.js';
import { sfx, vibrate } from './audio.js';
import { addXp } from './progression.js';
import { hitDebris, till, water, plant, harvest } from './farm.js';
import { SWORDS } from '../data/weapon-data.js';
import { spendEnergy, energyCost, restoreEnergy, addSkillXp, skillLevel, combatBonus } from './life.js';

const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const SWING_TIME = 0.26, SWING_COOLDOWN = 0.36;

export function toolTier(kind) {
  const tiers = TOOLS[kind];
  if (!tiers) return { name: kind, power: 1 };
  return tiers[Math.min(tiers.length - 1, getState().inventory.tools?.[kind] || 0)];
}

/** Which way to face to look at a point. */
export function faceToward(p, x, y) {
  const dx = x - p.x, dy = y - p.y;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
}

/** Tools you swing (seeds are 'seed:<item>'). */
export const SWING_TOOLS = new Set(['pickaxe', 'sword', 'axe', 'scythe', 'hoe', 'watering_can']);
export const ownsTool = kind => getState().inventory.tools?.[kind] !== undefined;

/** The tile in front of the player. */
export function frontTile(p) {
  const [dx, dy] = DIRV[p.facing];
  return { x: Math.floor((p.x + dx * 12) / TILE), y: Math.floor((p.y - 4 + dy * 12) / TILE) };
}

/** Use the held tool (or seeds). Returns true if something happened. */
export function swing(game, tool = getState().inventory.held) {
  const p = game.player, w = game.world;
  if (typeof tool === 'string' && tool.startsWith('seed:')) {
    const t = frontTile(p);
    if (plant(game, t.x, t.y, tool.slice(5))) { p.swingCool = 0.15; return true; }
    return false;
  }
  if (!SWING_TOOLS.has(tool) || !ownsTool(tool)) return false;
  if ((p.swingCool || 0) > 0) return false;
  if (!spendEnergy(tool)) { p.swingCool = 0.4; return false; }
  p.swing = { tool, t: 0, dur: SWING_TIME };
  p.swingCool = SWING_COOLDOWN;
  const [dx, dy] = DIRV[p.facing];
  const hx = p.x + dx * 13, hy = p.y - 5 + dy * 13;
  const nearest = (match, range = 15) => {
    let best = null, bestD = range;
    for (const o of w.objects) {
      if (!match(o) || w.objectHidden(o) || !w.inBounds(o.x, o.y)) continue;
      const d = Math.hypot(o.x * TILE + 8 - hx, o.y * TILE + 8 - hy);
      if (d < bestD) { bestD = d; best = o; }
    }
    return best;
  };
  if (tool === 'hoe') { const t = frontTile(p); if (!harvest(game, t.x, t.y)) till(game, t.x, t.y); return true; }
  if (tool === 'watering_can') { const t = frontTile(p); water(game, t.x, t.y); return true; }
  // Hitting something you placed (a chest, machine, fence, path…) with the axe or pickaxe picks it back up.
  const pickUp = () => {
    if (game.visit || (tool !== 'axe' && tool !== 'pickaxe')) return false;
    const t = frontTile(p);
    const pl = w.placementAt(t.x, t.y);
    if (!pl || pl.def.kind !== 'decor') return false;
    const r = game.build.store(pl);
    toast(r.message, 'bag', r.ok ? 'good' : 'error');
    restoreEnergy(energyCost(tool));
    return true;
  };
  if (tool === 'axe') {
    const o = nearest(o => ['debris_tree', 'debris_twig', 'debris_stump', 'debris_big_stump'].includes(o.type));
    if (o) hitDebris(game, o, toolTier('axe').power); else if (!pickUp()) missed(game);
    return true;
  }
  if (tool === 'scythe') {
    // A wide sweep: every weed in front of you, and ripe crops get picked.
    let hit = false;
    for (const o of [...w.objects]) {
      if ((o.type !== 'debris_weed' && o.type !== 'debris_grass') || !w.inBounds(o.x, o.y)) continue;
      if (Math.hypot(o.x * TILE + 8 - hx, o.y * TILE + 8 - hy) < 22) { hitDebris(game, o, 1); hit = true; }
    }
    const t = frontTile(p);
    if (harvest(game, t.x, t.y)) hit = true;
    if (!hit) missed(game);
    return true;
  }
  const crate = (tool === 'pickaxe' || tool === 'sword') && nearest(o => o.type === 'mine_crate');
  if (crate) { hitCrate(game, crate); return true; }
  if (tool === 'pickaxe') {
    const best = nearest(o => o.type === 'mine_rock' || o.type === 'debris_stone' || o.type === 'debris_boulder');
    if (best?.type === 'mine_rock') hitRock(game, best, toolTier('pickaxe').power);
    else if (best) hitDebris(game, best, toolTier('pickaxe').power);
    else if (!pickUp()) missed(game);
  } else {
    let hit = false;
    for (const m of w.monsters) {
      if (m.dead) continue;
      if (Math.hypot(m.x - hx, m.y - 6 - hy) < (MONSTERS[m.type]?.boss ? 30 : 17)) { hitMonster(game, m, Math.round(toolTier('sword').damage * combatBonus()), dx, dy); hit = true; }
    }
    sfx(hit ? 'hit' : 'swing');
  }
  return true;
}

function roll([, min, max, chance]) {
  if (Math.random() > chance) return 0;
  return min + Math.floor(Math.random() * (max - min + 1));
}

function hitRock(game, o, power) {
  const w = game.world;
  const def = ROCKS[o.kind] || ROCKS.stone;
  // tougher rocks need an upgraded pickaxe
  if ((getState().inventory.tools.pickaxe || 0) < (def.minTier || 0)) {
    o.shake = 0.5;
    sfx('pick');
    toast('You need a better pickaxe.', 'pickaxe');
    return;
  }
  if (o.hp == null) o.hp = def.hp;
  o.hp -= power;
  o.shake = 1;
  const cx = o.x * TILE + 8, cy = o.y * TILE + 8;
  game.renderer.emit('sparkle', cx, cy, 3, { speed: 40, gravity: 60, color: '#d8d2c8', life: 0.4 });
  if (o.hp > 0) { sfx('pick'); return; }
  sfx('rockbreak');
  vibrate(12);
  w.broken.add(o.id);
  const s = getState();
  s.stats.rocksBroken = (s.stats.rocksBroken || 0) + 1;
  const got = [];
  const extra = skillLevel('mining') >= 10 ? 2 : skillLevel('mining') >= 5 ? 1 : 0;
  for (const d of def.drops) {
    let n = roll(d);
    if (n > 0 && d[0].endsWith('_ore')) n += extra;
    if (n > 0) { addItem(d[0], n); got.push(`+${n} ${RESOURCES[d[0]]?.name || d[0]}`); }
  }
  addSkillXp('mining', o.kind === 'stone' ? 2 : o.kind === 'gold' || o.kind === 'gem' ? 8 : 5);
  if (got.length) game.renderer.floatText(got.join('  '), cx, cy - 8, o.kind === 'gold' ? '#f8dc7c' : '#fff5df');
  game.renderer.emit('leaf', cx, cy, 8, { speed: 45, gravity: 120, life: 0.6, color: o.kind === 'copper' ? '#e3924a' : o.kind === 'gold' ? '#f0c14b' : '#918b88' });
  // The one rock hiding the ladder down.
  const at = w.def.ladderAt;
  if (at && at.x === o.x && at.y === o.y) {
    w.objects.push({ id: 'ladder_down', type: 'ladder_down', x: o.x, y: o.y, def: OBJECT_TYPES.ladder_down, variant: 0 });
    toast('You found the ladder down!', 'sparkle', 'good');
    sfx('perfect');
  }
  addXp(1);
  w.rebuild();
  commit('mine', false);
}

/** The next sword up the ladder, if this floor is deep enough to find it. */
export function maybeSwordDrop(game, level, chance, x, y) {
  const s = getState();
  const cur = s.inventory.tools.sword;
  if (cur === undefined || Math.random() > chance) return false;
  const next = SWORDS[cur + 1];
  if (!next || (next.floor || 0) > level) return false;
  s.inventory.tools.sword = cur + 1;
  game.renderer.floatText(next.name + '!', x, y - 30, '#f8dc7c');
  toast(`You found a ${next.name}! (${next.damage} damage)`, 'sword', 'gold');
  sfx('levelup');
  game.ui.hotbar?.render();
  return true;
}

/** Breakable mine crates: coins, snacks, ore — and once in a while a sword. */
function hitCrate(game, o) {
  const w = game.world;
  o.hp = (o.hp ?? 2) - 1;
  o.shake = 1;
  const cx = o.x * TILE + 8, cy = o.y * TILE + 8;
  game.renderer.emit('leaf', cx, cy, 4, { speed: 40, gravity: 120, life: 0.5, color: '#b9794f' });
  if (o.hp > 0) { sfx('chop'); return; }
  sfx('rockbreak');
  w.broken.add(o.id);
  const level = w.def.level || 1;
  const r = Math.random();
  if (r < 0.45) { const c = 5 + Math.floor(Math.random() * (10 + level)); addCoins(c, 'treasure'); game.renderer.floatText(`+${c} coins`, cx, cy - 10, '#f8dc7c'); }
  else if (r < 0.7) { addItem('seaweed_snack', 1); game.renderer.floatText('+1 Seaweed Snack', cx, cy - 10); }
  else if (r < 0.95) { const ore = level >= 10 ? 'gold_ore' : level >= 5 ? 'iron_ore' : 'copper_ore'; addItem(ore, 2); game.renderer.floatText(`+2 ${RESOURCES[ore].name}`, cx, cy - 10); }
  maybeSwordDrop(game, level, 0.05, cx, cy);
  w.rebuild();
  commit('crate', false);
}

/**
 * A swing that hit nothing: if what's in front of you needs a different
 * tool, say so ("You need a pickaxe.").
 */
function missed(game) {
  sfx('swing');
  restoreEnergy(energyCost(getState().inventory.held));   // swinging at nothing doesn't tire you
  const w = game.world, t = frontTile(game.player);
  const o = w.objects.find(x => x.x === t.x && x.y === t.y && !w.objectHidden(x) && (x.def.tool || x.type === 'mine_rock'));
  if (!o) return;
  const need = o.type === 'mine_rock' ? 'pickaxe' : o.def.tool;
  if (need && need !== getState().inventory.held) {
    const name = { axe: 'axe', pickaxe: 'pickaxe', scythe: 'scythe' }[need] || need;
    toast(`You need ${/^[aeiou]/.test(name) ? 'an' : 'a'} ${name}.`, need);
  }
}

/** Monster stats scaled for the current floor. */
export function monsterStats(m, level = 1) {
  const d = MONSTERS[m.type];
  if (d.boss) return { ...d };
  const k = 1 + 0.12 * (level - 1);
  return { ...d, hp: Math.round(d.hp * k), damage: Math.round(d.damage * (1 + 0.08 * (level - 1))), speed: d.speed * (1 + 0.02 * Math.min(20, level)) };
}

function hitMonster(game, m, dmg, dx, dy) {
  const level = game.world.def.level || 1;
  const st = monsterStats(m, level);
  if (m.hp == null) m.hp = st.hp;
  m.hp -= dmg;
  m.maxHp = st.hp;
  m.flash = 0.18;
  m.kx = dx * 150; m.ky = dy * 150;
  m.aggro = true;
  game.renderer.floatText(String(dmg), m.x, m.y - 18, '#ffd6a0');
  if (m.hp > 0) return;
  m.dead = true;
  sfx('squish');
  const s = getState();
  s.stats.monstersSlain = (s.stats.monstersSlain || 0) + 1;
  s.stats.kills = s.stats.kills || {};
  s.stats.kills[m.type] = (s.stats.kills[m.type] || 0) + 1;
  // A very rare blade drop, never past what this depth would unlock.
  maybeSwordDrop(game, level, 0.006, m.x, m.y);
  // a boss leaves the ladder down and a treasure shared with the whole world
  if (st.boss) {
    const tx = Math.floor(m.x / TILE), ty = Math.floor((m.y - 1) / TILE);
    game.world.objects.push({ id: 'ladder_down', type: 'ladder_down', x: tx, y: ty, def: OBJECT_TYPES.ladder_down, variant: 0 });
    game.world.objects.push({ id: 'boss_chest', type: 'boss_chest', x: tx + 1, y: ty, level, def: OBJECT_TYPES.boss_chest, variant: 0 });
    game.world.rebuild();
    game.onBossDefeated?.(level, st.name);
  }
  game.renderer.emit('sparkle', m.x, m.y - 6, 10, { speed: 50, gravity: 40, color: m.type === 'slime' ? '#8ee07a' : '#c9b8e6' });
  const coins = st.coins[0] + Math.floor(Math.random() * (st.coins[1] - st.coins[0] + 1)) + Math.floor(level / 3);
  addCoins(coins, 'treasure');
  for (const [id, n, chance] of st.drops) if (Math.random() < chance) { addItem(id, n); game.renderer.floatText(`+${n} ${RESOURCES[id]?.name || id}`, m.x, m.y - 26); }
  addXp(st.xp);
  addSkillXp('combat', st.xp);
  commit('slay', false);
}

const isOpen = (w, x, y, flies) => {
  if (flies) {
    const t = w.tile(Math.floor(x / TILE), Math.floor((y - 3) / TILE));
    return t === T.C;
  }
  return w.boxFree(x, y - 3, 4, 3);
};

/** Monster AI: wander, chase when close, bump the player. */
export function updateMonsters(game, dt) {
  const w = game.world, p = game.player;
  const level = w.def.level || 1;
  for (const m of w.monsters) {
    if (m.dead) continue;
    const st = monsterStats(m, level);
    if (m.hp == null) { m.hp = st.hp; m.maxHp = st.hp; }
    m.anim += dt * (st.flies ? 9 : 5);
    m.flash = Math.max(0, m.flash - dt);
    m.cool = Math.max(0, m.cool - dt);
    const dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy);
    if (d < 6 * TILE) m.aggro = true;
    if (d > 12 * TILE) m.aggro = false;
    let vx = 0, vy = 0;
    if (m.aggro && !game.sleeping) {
      vx = dx / (d || 1); vy = dy / (d || 1);
      if (st.flies) { vx += Math.sin(m.anim * 0.7) * 0.6; vy += Math.cos(m.anim * 0.5) * 0.6; }
    } else {
      m.wt = (m.wt || 0) - dt;
      if (m.wt <= 0) { m.wt = 1 + Math.random() * 2; const a = Math.random() * Math.PI * 2; m.wx = Math.random() < 0.4 ? 0 : Math.cos(a); m.wy = Math.random() < 0.4 ? 0 : Math.sin(a); }
      vx = (m.wx || 0) * 0.4; vy = (m.wy || 0) * 0.4;
    }
    // Slimes move in little hops.
    const hop = m.type === 'slime' ? (Math.sin(m.anim * 2) > 0 ? 1.4 : 0.2) : 1;
    let mx = vx * st.speed * hop * dt + (m.kx || 0) * dt;
    let my = vy * st.speed * hop * dt + (m.ky || 0) * dt;
    m.kx = (m.kx || 0) * Math.pow(0.002, dt); m.ky = (m.ky || 0) * Math.pow(0.002, dt);
    if (isOpen(w, m.x + mx, m.y, st.flies)) m.x += mx;
    if (isOpen(w, m.x, m.y + my, st.flies)) m.y += my;
    if (Math.abs(vx) > 0.05 || Math.abs(vy) > 0.05) m.dir = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 'right' : 'left') : vy > 0 ? 'down' : 'up';
    // contact damage
    if (d < (st.boss ? 24 : 11) && m.cool <= 0 && (p.invuln || 0) <= 0 && !game.ui.fading) {
      m.cool = 0.8;
      hurtPlayer(game, st.damage, m.x, m.y);
    }
  }
}

export function hurtPlayer(game, dmg, fromX, fromY) {
  const s = getState(), p = game.player, w = game.world;
  s.player.hp = Math.max(0, s.player.hp - dmg);
  p.invuln = 1.0;
  const d = Math.hypot(p.x - fromX, p.y - fromY) || 1;
  const kx = ((p.x - fromX) / d) * 14, ky = ((p.y - fromY) / d) * 14;
  if (w.boxFree(p.x + kx, p.y - 3 + ky, 5, 3)) { p.x += kx; p.y += ky; }
  sfx('hurt');
  vibrate(30);
  game.renderer.floatText('-' + dmg, p.x, p.y - 26, '#ff9a8a');
  game.ui.hurtFlash?.();
  if (s.player.hp <= 0) game.faint();
  commit('hurt', false);
}

/** Eat a food item from the hotbar or bag. */
export function eat(game, id) {
  const s = getState();
  const f = FOOD[id];
  if (!f || itemCount(id) <= 0) return { ok: false, message: 'You don’t have any.' };
  if (s.player.hp >= s.player.maxHp && (s.player.energy ?? 0) >= (s.player.maxEnergy || 100)) return { ok: false, message: 'You’re already full of energy and health.' };
  removeItem(id, 1);
  const before = s.player.hp, eBefore = s.player.energy ?? 0;
  s.player.hp = Math.min(s.player.maxHp, s.player.hp + f.heal);
  if (f.energy) restoreEnergy(f.energy);
  sfx('eat');
  if (game?.player) game.renderer.floatText(`+${s.player.hp - before} HP  +${Math.round(s.player.energy - eBefore)} energy`, game.player.x, game.player.y - 26, '#a8f0a0');
  commit('eat');
  return { ok: true, message: `Ate ${f.name}.` };
}
