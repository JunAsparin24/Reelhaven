// Farming in the home yard: clutter to clear (trees, twigs, stones, weeds),
// tilled soil, planting, watering, daily growth and harvest. Saved on the
// island's state as farm = { soil: { "x,y": plot }, debris: [...], ... }.
import { TILE } from './art/tiles.js';
import { getState, commit } from './state.js';
import { toast, emit } from './events.js';
import { addItem, removeItem, itemCount } from './economy.js';
import { RESOURCES, TOOLS } from '../data/item-data.js';
import { CROPS, DEBRIS, seasonOf } from '../data/farm-data.js';
import { ISLANDS } from '../data/island-data.js';
import { T, WATERY } from './world-gen.js';
import { sfx, vibrate } from './audio.js';
import { addXp } from './progression.js';
import { addSkillXp, skillLevel } from './life.js';

export const FARM_ISLAND = 'sunny';
const MAX_DEBRIS = 170;

export function farmOf(isl) {
  if (!isl.farm) isl.farm = { soil: {}, debris: [], n: 0, seeded: false };
  return isl.farm;
}

/** Can this tile be farmed? Only inside the fenced home yard. */
export function inYard(tx, ty) {
  const y = ISLANDS[FARM_ISLAND].home.yard;
  return tx > y.x && ty > y.y && tx < y.x + y.w - 1 && ty < y.y + y.h - 1;
}

function rnd(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Free grass/sand tile for clutter (keeps paths, doorways and friends' cabin spots clear). */
function freeForDebris(world, farm, tx, ty) {
  const t = world.tile(tx, ty);
  if (t !== T.G && t !== T.S) return false;
  if (world.occupied[ty * world.w + tx] || world.fronts[ty * world.w + tx]) return false;
  if (farm.soil[tx + ',' + ty]) return false;
  if (farm.debris.some(d => d.x === tx && d.y === ty)) return false;
  const def = ISLANDS[FARM_ISLAND];
  const c = def.home.cottage;
  if (tx >= c.x - 1 && tx <= c.x + 4 && ty >= c.y - 1 && ty <= c.y + 4) return false;      // around the cottage
  for (const g of def.guestSpots) if (tx >= g.x - 1 && tx <= g.x + 3 && ty >= g.y - 1 && ty <= g.y + 3) return false;
  for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) if (world.tile(tx + dx, ty + dy) === T.P) return false; // beside paths
  return true;
}

function addDebris(farm, type, x, y) {
  farm.n = (farm.n || 0) + 1;
  farm.debris.push({ id: `deb${farm.n}`, type, x, y });
}

/** First visit: cover the yard in clutter, like a Stardew farm. */
export function seedYard(world, isl) {
  const farm = farmOf(isl);
  if (farm.seeded) return false;
  farm.seeded = true;
  const r = rnd(isl.placements.length * 7 + 12345);
  const y0 = ISLANDS[FARM_ISLAND].home.yard;
  for (let ty = y0.y + 1; ty < y0.y + y0.h - 1; ty++) for (let tx = y0.x + 1; tx < y0.x + y0.w - 1; tx++) {
    const roll = r();
    if (roll > 0.62 || !freeForDebris(world, farm, tx, ty)) continue;
    const k = r();
    const type = k < 0.3 ? 'grass' : k < 0.58 ? 'weed' : k < 0.74 ? 'stone' : k < 0.88 ? 'twig' : 'tree';
    if (type === 'tree' && farm.debris.some(d => d.type === 'tree' && Math.abs(d.x - tx) <= 1 && Math.abs(d.y - ty) <= 1)) continue;
    addDebris(farm, type, tx, ty);
  }
  return true;
}

/**
 * Wild clutter across the rest of the island: tall grass, stones, twigs and
 * the odd tree, like Stardew's countryside. Runs once per save.
 */
export function seedWild(world, isl) {
  const farm = farmOf(isl);
  if (farm.wild) return false;
  farm.wild = true;
  const r = rnd(9001 + isl.placements.length);
  // Keep clear of fishing spots, doors and everything people walk up to.
  const keep = new Set();
  const block = (x, y, rad) => { for (let j = y - rad; j <= y + rad; j++) for (let i = x - rad; i <= x + rad; i++) keep.add(i + ',' + j); };
  for (const s of world.spots) block(s.x, s.y, 2);
  for (const o of world.objects) if (o.def.interact && !o.type.startsWith('debris_')) { const fp = o.def.footprint || { w: 1, h: 1 }; for (let i = 0; i < fp.w; i++) block(o.x + i, o.y + fp.h, 1); }
  for (const n of world.npcs) block(Math.floor(n.homeX / TILE), Math.floor(n.homeY / TILE), 2);
  for (let ty = 1; ty < world.h - 1; ty++) for (let tx = 1; tx < world.w - 1; tx++) {
    if (inYard(tx, ty) || keep.has(tx + ',' + ty)) continue;
    const t = world.tile(tx, ty);
    const grassy = t === T.G;
    const roll = r();
    const chance = grassy ? 0.2 : t === T.S ? 0.05 : 0;
    if (roll > chance || !freeForDebris(world, farm, tx, ty)) continue;
    const k = r();
    let type = grassy ? (k < 0.66 ? 'grass' : k < 0.8 ? 'stone' : k < 0.93 ? 'twig' : 'tree') : (k < 0.5 ? 'stone' : 'twig');
    if (type === 'tree' && farm.debris.some(d => (d.type === 'tree' || d.type === 'stump') && Math.abs(d.x - tx) <= 2 && Math.abs(d.y - ty) <= 2)) type = 'grass';
    addDebris(farm, type, tx, ty);
  }
  return true;
}

/**
 * Large stumps and boulders (need copper / iron tools) scattered around the
 * home area once per save.
 */
export function seedBig(world, isl) {
  const farm = farmOf(isl);
  if (farm.big) return false;
  farm.big = true;
  const r = rnd(4242 + isl.placements.length);
  let stumps = 0, boulders = 0;
  for (let tries = 0; tries < 600 && (stumps < 5 || boulders < 4); tries++) {
    const tx = 2 + Math.floor(r() * 30), ty = 10 + Math.floor(r() * 36);
    if (!freeForDebris(world, farm, tx, ty) || world.tile(tx, ty) !== T.G) continue;
    if (stumps < 5) { addDebris(farm, 'big_stump', tx, ty); stumps++; } else { addDebris(farm, 'boulder', tx, ty); boulders++; }
  }
  return true;
}

/** A few new weeds pop up every morning. */
export function sproutWeeds(world, isl, n = 4) {
  const farm = farmOf(isl);
  if (!farm.seeded || farm.debris.length >= MAX_DEBRIS) return;
  const y0 = ISLANDS[FARM_ISLAND].home.yard;
  for (let i = 0, tries = 0; i < n && tries < 80; tries++) {
    const tx = y0.x + 1 + Math.floor(Math.random() * (y0.w - 2)), ty = y0.y + 1 + Math.floor(Math.random() * (y0.h - 2));
    if (!freeForDebris(world, farm, tx, ty)) continue;
    addDebris(farm, Math.random() < 0.5 ? 'weed' : 'grass', tx, ty);
    i++;
  }
  // Grass grows back out in the wild, too.
  if (farm.wild && farm.debris.length < MAX_DEBRIS + 450) {
    for (let i = 0, tries = 0; i < n * 3 && tries < 200; tries++) {
      const tx = 1 + Math.floor(Math.random() * (world.w - 2)), ty = 1 + Math.floor(Math.random() * (world.h - 2));
      if (inYard(tx, ty) || world.tile(tx, ty) !== T.G || !freeForDebris(world, farm, tx, ty)) continue;
      addDebris(farm, 'grass', tx, ty);
      i++;
    }
  }
}

/** Objects the World should show for the clutter. */
export function debrisObjects(isl) {
  return (isl.farm?.debris || []).map(d => ({ id: d.id, type: 'debris_' + d.type, kind: d.type, x: d.x, y: d.y, label: DEBRIS[d.type].label }));
}

/** Hit a piece of clutter with a tool of some power. */
export function hitDebris(game, o, power) {
  const def = DEBRIS[o.kind];
  if (!def) return;
  // big stumps and boulders need an upgraded tool
  if (def.minTier && (getState().inventory.tools[def.tool] || 0) < def.minTier) {
    o.shake = 0.5;
    sfx(def.tool === 'axe' ? 'chop' : 'pick');
    toast(`You need a better ${def.tool}.`, def.tool);
    return;
  }
  if (o.hp == null) o.hp = def.hp;
  o.hp -= power;
  o.shake = 1;   // the renderer wiggles it for a moment
  const p = game.player;
  o.shakeDir = p && p.x > o.x * TILE + 8 ? -1 : 1;
  const cx = o.x * TILE + 8, cy = o.y * TILE + 8;
  const leafy = o.kind === 'tree' || o.kind === 'weed' || o.kind === 'grass';
  game.renderer.emit(leafy ? 'leaf' : 'sparkle', cx, cy - (o.kind === 'tree' ? 18 : 2), o.kind === 'tree' ? 6 : 4, { speed: 35, gravity: 60, life: 0.6, color: leafy ? '#5b936a' : o.kind === 'stump' ? '#b9794f' : '#d8d2c8' });
  if (o.kind === 'stump' || o.kind === 'twig') game.renderer.emit('leaf', cx, cy, 3, { speed: 40, gravity: 120, life: 0.4, color: '#d39a6a' });
  if (o.hp > 0) { sfx(def.tool === 'axe' ? 'chop' : 'pick'); return; }
  const s = getState();
  const isl = s.islands[game.outdoor.id];
  const farm = farmOf(isl);
  const w = game.world;
  farm.debris = farm.debris.filter(d => d.id !== o.id);
  w.objects = w.objects.filter(x => x !== o);
  if (o.kind === 'tree') {
    // Timber! The tree topples away from you and leaves a stump behind.
    sfx('treefall');
    game.renderer.fallTree?.(game.renderer.objectSprite(o, 0, false, w), o.x * TILE + 8, (o.y + 1) * TILE, o.shakeDir);
    addDebris(farm, 'stump', o.x, o.y);
    w.syncDebris(false);
  } else {
    sfx(o.kind === 'stone' ? 'rockbreak' : o.kind === 'stump' ? 'chop' : 'gather');
    if (o.kind === 'stone') game.renderer.emit('leaf', cx, cy, 8, { speed: 50, gravity: 140, life: 0.5, color: '#918b88' });
    if (o.kind === 'grass' || o.kind === 'weed') game.renderer.emit('leaf', cx, cy, 7, { speed: 45, gravity: 30, life: 0.9, color: '#76b475' });
  }
  vibrate(10);
  const got = [];
  const forage = skillLevel('foraging');
  for (const [id, min, max, chance] of def.drops) {
    if (Math.random() > chance) continue;
    let n = min + Math.floor(Math.random() * (max - min + 1));
    if (id === 'wood' && o.kind === 'tree' && forage >= 5) n += 2;
    if (n > 0) { addItem(id, n); got.push(`+${n} ${RESOURCES[id]?.name || id}`); s.stats.gathered += n; }
  }
  if (got.length) game.renderer.floatText(got.join('  '), cx, cy - 10);
  s.stats.debrisCleared = (s.stats.debrisCleared || 0) + 1;
  addSkillXp(def.tool === 'pickaxe' ? 'mining' : 'foraging', { tree: 6, stump: 4, big_stump: 10, boulder: 10 }[o.kind] || 1);
  addXp(1);
  w.rebuild();
  emit('gathered', { type: o.kind });
  commit('clear', false);
}

// ---------------------------------------------------------------- soil
/** Why farming isn't possible right here (null if it is). */
export function farmBlocker(game) {
  if (game.visit) return 'You can farm on your own island.';
  if (game.indoor || game.world.id !== FARM_ISLAND || game.world.area !== 'home') return 'Farming happens in your home yard.';
  return null;
}

const keyOf = (x, y) => x + ',' + y;
/** The watering can you own (capacity, area). */
export function canTier() {
  const tiers = TOOLS.watering_can;
  return tiers[Math.min(tiers.length - 1, getState().inventory.tools?.watering_can || 0)];
}

export function plotAt(world, tx, ty) { return world.islandState.farm?.soil?.[keyOf(tx, ty)] || null; }

export function till(game, tx, ty) {
  const why = farmBlocker(game);
  if (why) { toast(why, 'hoe'); return false; }
  const w = game.world;
  const farm = farmOf(w.islandState);
  if (!inYard(tx, ty)) { toast('Till the soil inside your fenced yard.', 'hoe'); return false; }
  if (farm.soil[keyOf(tx, ty)]) return false;
  const t = w.tile(tx, ty);
  if ((t !== T.G && t !== T.S) || w.occupied[ty * w.w + tx] || w.fronts[ty * w.w + tx]) { sfx('click'); return false; }
  farm.soil[keyOf(tx, ty)] = { water: false, crop: null, age: 0, ready: false };
  // tilling turns any tall grass under the hoe into soil
  if (farm.debris.some(d => d.type === 'grass' && d.x === tx && d.y === ty)) {
    farm.debris = farm.debris.filter(d => !(d.type === 'grass' && d.x === tx && d.y === ty));
    w.syncDebris(false);
  }
  sfx('hoe');
  game.renderer.emit('leaf', tx * TILE + 8, ty * TILE + 10, 4, { speed: 25, gravity: 80, life: 0.4, color: '#8a6a48' });
  w.rebuild();
  commit('till', false);
  return true;
}

export function water(game, tx, ty) {
  const s = getState(), w = game.world;
  // Refill from any water in front of you.
  const can = canTier();
  if (WATERY.has(w.tile(tx, ty)) || w.tile(tx, ty) === T.H) {
    s.inventory.water = can.capacity;
    sfx('splash');
    toast('Watering can refilled.', 'watering_can', 'good');
    commit('refill', false);
    return true;
  }
  const why = farmBlocker(game);
  if (why) { toast(why, 'watering_can'); return false; }
  if ((s.inventory.water ?? can.capacity) <= 0) { toast('Your watering can is empty. Refill it at the pond or the sea.', 'watering_can'); sfx('error'); return false; }
  s.inventory.water = (s.inventory.water ?? can.capacity) - 1;
  // Better cans water a line (3) or a 3x3 patch around the target tile.
  const p = game.player, dir = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[p.facing];
  const tiles = can.area >= 9 ? [-1, 0, 1].flatMap(j => [-1, 0, 1].map(i => [tx + i, ty + j]))
    : can.area >= 3 ? [0, 1, 2].map(k => [tx + dir[0] * k, ty + dir[1] * k]) : [[tx, ty]];
  for (const [x, y] of tiles) {
    const plot = plotAt(w, x, y);
    if (plot) plot.water = true;
    game.renderer.emit('splash', x * TILE + 8, y * TILE + 8, 4, { speed: 30, life: 0.4 });
  }
  sfx('pour');
  commit('water', false);
  return true;
}

export function plant(game, tx, ty, seedId) {
  const why = farmBlocker(game);
  if (why) { toast(why, 'seeds_radish'); return false; }
  const s = getState();
  const item = RESOURCES[seedId];
  const crop = item && CROPS[item.seed];
  if (!crop || itemCount(seedId) <= 0) return false;
  const plot = plotAt(game.world, tx, ty);
  if (!plot) { toast('Till the soil with your hoe first.', 'hoe'); return false; }
  if (plot.crop) return false;
  const season = seasonOf(s.world.day).season;
  if (!crop.seasons.includes(season)) { toast(`${crop.name} won’t grow in ${seasonOf(s.world.day).name.toLowerCase()}.`, item.icon, 'error'); sfx('error'); return false; }
  removeItem(seedId, 1);
  Object.assign(plot, { crop: crop.id, age: 0, ready: false, dead: false });
  s.stats.seedsPlanted = (s.stats.seedsPlanted || 0) + 1;
  sfx('gather');
  commit('plant');
  return true;
}

/** Pick a ripe crop. */
export function harvest(game, tx, ty) {
  const s = getState();
  const plot = plotAt(game.world, tx, ty);
  if (!plot?.crop) return false;
  if (plot.dead) {      // clear withered plants
    Object.assign(plot, { crop: null, age: 0, ready: false, dead: false });
    sfx('gather'); commit('clearCrop', false);
    return true;
  }
  if (!plot.ready) return false;
  const crop = CROPS[plot.crop];
  const n = crop.big ? 1 : Math.random() < 0.15 ? 2 : 1;
  addItem(crop.produce, n);
  game.renderer.floatText(`+${n} ${crop.name}`, tx * TILE + 8, ty * TILE - 4, '#f8dc7c');
  game.renderer.emit('leaf', tx * TILE + 8, ty * TILE + 4, 6, { speed: 35, life: 0.6, color: crop.fruit });
  if (crop.regrow) { plot.ready = false; plot.age = crop.days - crop.regrow; }
  else Object.assign(plot, { crop: null, age: 0, ready: false });
  s.stats.cropsHarvested = (s.stats.cropsHarvested || 0) + n;
  addSkillXp('farming', crop.big ? 14 : 5);
  addXp(crop.big ? 12 : 4);
  sfx('coin');
  emit('harvested', { crop: crop.id });
  commit('harvest');
  return true;
}

/** 0..3 growth stage for drawing. */
export function cropStage(plot) {
  const crop = CROPS[plot.crop];
  if (!crop) return 0;
  if (plot.ready) return 3;
  return Math.min(2, Math.floor((plot.age / crop.days) * 3));
}

/**
 * Overnight: watered crops grow a day, rain waters everything, crops out of
 * season wither, and the soil dries out. Runs once per new day.
 */
export function growFarms(day, weather) {
  const s = getState();
  if ((s.world.grownDay || 0) >= day) return;
  const prevSeason = seasonOf(Math.max(1, (s.world.grownDay || day - 1))).season;
  s.world.grownDay = day;
  const season = seasonOf(day).season;
  for (const isl of Object.values(s.islands)) {
    const farm = isl.farm;
    if (!farm) continue;
    for (const [k, plot] of Object.entries(farm.soil)) {
      if (plot.crop && !plot.dead) {
        const crop = CROPS[plot.crop];
        if (!crop.seasons.includes(season)) { plot.dead = true; plot.ready = false; }
        else if (plot.water && !plot.ready) { plot.age += 1; if (plot.age >= crop.days) plot.ready = true; }
      }
      // Bare, dry soil slowly turns back to grass.
      if (!plot.crop && !plot.water && Math.random() < 0.12) delete farm.soil[k];
      else plot.water = weather === 'rain' || weather === 'storm';
    }
  }
  if (prevSeason !== season) emit('season', { season });
}
