// Interactable things near the player: fishing spots, NPCs, resource nodes,
// buildings and props. Finds the nearest one and performs its action.
import { TILE } from './art/tiles.js';
import { sprite } from './art/sprites.js';
import { getState, commit } from './state.js';
import { emit, toast } from './events.js';
import { addItem, addCoins, addPearls, checkCost, spend, describeMissing } from './economy.js';
import { BUILDINGS } from '../data/building-data.js';
import { RESOURCES } from '../data/item-data.js';
import { sfx } from './audio.js';
import { MONSTERS } from '../data/mine-data.js';
import { CROPS } from '../data/farm-data.js';
import { hasRoomFor, freeSlots } from './bag.js';

export const BRIDGE_COST = { coins: 100, wood: 15, stone: 6 };

/**
 * Everything the player can use from where they stand, closest first.
 * rangeBoost > 1 widens every range (used when arriving after a tap);
 * only(it) restricts the search to the thing the player tapped.
 * game.canUse(it), if present, filters by mode (e.g. visiting a friend).
 */
function collectInteractables(game, rangeBoost = 1, only = null) {
  const { world: w, player: p } = game;
  if (!w || !p) return [];
  const found = [];
  const consider = (it, x, y, range) => {
    if (only && !only(it)) return;
    if (!w.inBoundsPx(x, y + 4)) return;
    if (game.canUse && !game.canUse(it)) return;
    const d = Math.hypot(p.x - x, p.y - 4 - y);
    if (d < range * rangeBoost) { it.d = d; found.push(it); }
  };
  for (const s of w.spots) {
    if (s.hidden && !game.revealedSpots.has(s.id)) continue;
    const cx = s.x * TILE + 8, cy = s.y * TILE + 8;
    consider({ kind: 'spot', spot: s, verb: 'Fish', label: s.name, mx: s.waterX * TILE + 8, my: s.waterY * TILE - 6 }, cx, cy, 14);
  }
  // Indoors you can talk across a counter, so NPCs reach a little further.
  const npcRange = w.def.interior ? 40 : 28;
  for (const n of w.npcs) {
    consider({ kind: 'npc', npc: n, verb: 'Talk', label: n.def.name, mx: n.x, my: n.y - 30 }, n.x, n.y - 4, npcRange);
  }
  for (const o of w.objects) {
    if (w.objectHidden(o) || o.def.quiet) continue;
    const fp = o.def.footprint || { w: 1, h: 1 };
    let cx = o.x * TILE + (fp.w * TILE) / 2;
    const cy = (o.y + fp.h) * TILE - 6;
    // Long furniture (the shop counter) can be used from anywhere along it.
    if (w.def.interior) cx = Math.max(o.x * TILE + 8, Math.min((o.x + fp.w) * TILE - 8, p.x));
    if (o.def.resource) {
      if (!w.nodeReady(o)) continue;
      const res = o.def.resource;
      const spr = sprite(o.type === 'palm' ? 'palm_1' : o.type === 'mangrove' ? 'mangrove_1' : o.type);
      consider({ kind: 'gather', obj: o, verb: res.verb, label: nodeLabel(o), mx: cx, my: cy + 6 - (spr ? spr.height : 16) - 2 }, cx, cy, 20);
    } else if (o.def.interact) {
      const spr = sprite(o.type);
      const range = o.type === 'boat' ? 40 : o.type === 'shop' ? 24 : 20;
      const iy = o.type === 'shop' ? (o.y + fp.h) * TILE + 6 : cy;
      consider({ kind: o.def.interact.kind, obj: o, verb: o.def.interact.verb, label: o.label || o.def.interact.label, mx: cx, my: (o.y + fp.h) * TILE - (spr ? spr.height : 16) - 2 }, cx, iy, range);
    }
  }
  // Utilities you can use: chests, furnaces, campfires.
  const USE_VERB = { chest: 'Open', furnace: 'Smelt', campfire: 'Cook' };
  for (const pl of w.placed) {
    if (!pl.def.use) continue;
    const cx = pl.x * TILE + (pl.fw * TILE) / 2, cy = (pl.y + pl.fh) * TILE - 4;
    const spr = sprite(pl.type);
    consider({ kind: 'use', placement: pl, verb: USE_VERB[pl.def.use] || 'Use', label: pl.def.name, mx: cx, my: (pl.y + pl.fh) * TILE - (spr ? spr.height : 16) - 2 }, cx, cy, 26);
  }
  // Ripe (or withered) crops close by.
  const soil = w.islandState.farm?.soil;
  if (soil && !game.visit) {
    const ptx = Math.floor(p.x / TILE), pty = Math.floor((p.y - 1) / TILE);
    for (let ty = pty - 1; ty <= pty + 1; ty++) for (let tx = ptx - 1; tx <= ptx + 1; tx++) {
      const plot = soil[tx + ',' + ty];
      if (!plot?.crop || !(plot.ready || plot.dead)) continue;
      const crop = CROPS[plot.crop];
      consider({ kind: 'harvest', tx, ty, verb: plot.dead ? 'Clear' : 'Harvest', label: plot.dead ? `Withered ${crop.name}` : crop.name, mx: tx * TILE + 8, my: ty * TILE - 14 }, tx * TILE + 8, ty * TILE + 8, 22);
    }
  }
  // Monsters in reach.
  for (const m of w.monsters || []) {
    if (m.dead) continue;
    consider({ kind: 'attack', monster: m, verb: 'Attack', label: MONSTERS[m.type]?.name || 'Monster', mx: m.x, my: m.y - 22 }, m.x, m.y - 2, 26);
  }
  for (const pl of w.placed) {
    if (pl.def.kind !== 'building' || pl.def.use) continue;
    const cx = pl.x * TILE + (pl.fw * TILE) / 2, cy = (pl.y + pl.fh) * TILE + 6;
    if (pl.type === 'cottage' || pl.type === 'guest_cabin') {
      const label = pl.type === 'guest_cabin' ? `${pl.ownerName || 'Guest'}’s Cabin` : pl.def.name;
      consider({ kind: 'enter', placement: pl, verb: 'Enter', label, mx: cx, my: (pl.y + pl.fh) * TILE - (sprite(pl.type)?.height || 32) - 2 }, cx, cy, 22);
      continue;
    }
    const verbs = { fishing_hut: 'Bait Shop', fish_market: 'Orders', crop_garden: 'Harvest', storage_shed: 'Check', lighthouse: 'Visit' };
    const spr = sprite(pl.type === 'crop_garden' ? 'crop_garden_3' : pl.type);
    consider({ kind: 'building', placement: pl, verb: verbs[pl.type] || 'Look', label: pl.def.name, mx: cx, my: (pl.y + pl.fh) * TILE - (spr ? spr.height : 32) - 2 }, cx, cy, 22);
  }
  return found.sort((x, y) => x.d - y.d);
}

/** The single closest interactable (used by the E key and tap-to-use). */
export function findInteractable(game, rangeBoost = 1, only = null) {
  return collectInteractables(game, rangeBoost, only)[0] || null;
}

/** Up to `max` distinct nearby interactables for the contextual action panel. */
export function nearbyInteractables(game, max = 3) {
  const seen = new Set();
  const out = [];
  for (const it of collectInteractables(game)) {
    const key = it.kind + it.label;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
    if (out.length >= max) break;
  }
  return out;
}

function nodeLabel(o) {
  return { palm: 'Palm Tree', mangrove: 'Mangrove', driftwood: 'Driftwood', boulder: 'Boulder', shells: 'Shells', seaglass: 'Sea Glass', tidepool: 'Tide Pool', flowerbush: 'Flower Bush', crystal: 'Moon Crystal' }[o.type] || o.type;
}

/** Gather from a resource node. */
export function gather(game, o) {
  const s = getState();
  const w = game.world;
  if (!w.nodeReady(o)) return;
  const res = o.def.resource;
  const gives = res.item === 'crystal' ? 'seaglass' : res.item === 'tidepool' ? null : res.item;
  if (gives ? !hasRoomFor(gives) : !freeSlots()) { sfx('error'); toast('Your bag is full! Make room first.', 'bag', 'error'); return; }
  const isl = w.islandState;   // the island being played (a friend's when visiting)
  let respawn = res.respawn;
  if (w.id === 'coral' && (o.type === 'shells' || o.type === 'seaglass')) respawn *= 0.6;
  isl.nodes[o.id] = Date.now() + respawn;
  const cx = o.x * TILE + 8, cy = o.y * TILE + 4;
  const give = (item, n) => {
    addItem(item, n);
    s.stats.gathered += n;
    game.renderer.floatText(`+${n} ${RESOURCES[item]?.name || item}`, cx, cy - 10);
  };
  if (res.item === 'tidepool') {
    const r = Math.random();
    if (r < 0.4) give('shell', 2);
    else if (r < 0.65) give('seaglass', 1);
    else if (r < 0.85) { addItem('worm_bait', 2); s.stats.gathered += 1; game.renderer.floatText('+2 Worm Bait', cx, cy - 10); }
    else { const c = 15 + Math.floor(Math.random() * 25); addCoins(c, 'treasure'); s.stats.gathered += 1; game.renderer.floatText(`+${c} coins`, cx, cy - 10, '#f8dc7c'); }
  } else if (res.item === 'crystal') {
    give('seaglass', 1);
    if (Math.random() < 0.15) { addPearls(1); toast('The crystal hummed and left a pearl!', 'pearl', 'good'); }
  } else {
    const n = res.amount[0] + Math.floor(Math.random() * (res.amount[1] - res.amount[0] + 1));
    give(res.item, n);
  }
  if (o.type === 'palm' || o.type === 'mangrove' || o.type === 'flowerbush') game.renderer.emit('leaf', cx, cy - 18, 6, { speed: 25, life: 1.4, color: o.type === 'flowerbush' ? '#f7c6d4' : '#5b936a' });
  else game.renderer.emit('sparkle', cx, cy, 6, { speed: 30, gravity: 30 });
  if (o.def.solid !== undefined) w.rebuild();
  sfx('gather');
  emit('gathered', { type: o.type });
  commit('gather');
}

export function repairBridge(game) {
  const s = getState();
  const isl = s.islands[game.world.id];
  if (isl.flags.bridgeRepaired) return { ok: false, message: 'Already repaired.' };
  const check = checkCost(BRIDGE_COST);
  if (!check.ok) { sfx('error'); return { ok: false, message: 'Not enough: ' + describeMissing(check.missing) + '.' }; }
  spend(BRIDGE_COST);
  isl.flags.bridgeRepaired = true;
  game.world.applyFlags();
  game.world.rebuild();
  game.renderer.buildLand();
  const site = game.world.objects.find(o => o.type === 'bridgeSite');
  if (site) game.renderer.emit('sparkle', (site.x + 3) * TILE, (site.y - 1) * TILE, 20, { speed: 50, gravity: 20 });
  sfx('build');
  emit('bridgeRepaired');
  commit('bridge');
  return { ok: true, message: 'The bridge is fixed! The hidden lagoon awaits.' };
}

/** Garden: harvest produce that has grown since the last harvest. */
export function harvestGarden(game, placement) {
  const s = getState();
  const isl = s.islands[game.world.id];
  const prod = BUILDINGS.crop_garden.produce;
  const last = isl.gardens[placement.uid] || 0;
  const cycles = Math.min(prod.cap, Math.floor((Date.now() - last) / prod.every));
  if (cycles <= 0) {
    const mins = Math.ceil((prod.every - (Date.now() - last)) / 60000);
    return { ok: false, message: `Still growing — ready in about ${mins} min.` };
  }
  const parts = [];
  for (const [id, n] of Object.entries(prod.items)) { addItem(id, n * cycles); parts.push(`${n * cycles} ${id === 'worm_bait' ? 'Worm Bait' : RESOURCES[id].name}`); }
  s.stats.gathered += cycles;
  isl.gardens[placement.uid] = Date.now();
  const cx = placement.x * TILE + placement.fw * 8, cy = placement.y * TILE;
  game.renderer.emit('leaf', cx, cy, 10, { speed: 30, life: 1.2, color: '#f7c6d4' });
  sfx('gather');
  emit('gathered', { type: 'garden' });
  commit('harvest');
  return { ok: true, message: 'Harvested ' + parts.join(' and ') + '!' };
}
