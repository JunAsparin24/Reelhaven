// Sprite registry. Builds every procedural sprite once at boot and exposes them
// by id. To swap in hand-made art, drop a PNG into assets/ and register it in
// SPRITE_OVERRIDES — overrides replace the generated canvas with the image.
import * as OBJ from './objects.js';
import { ICONS } from './icons.js';
import { buildTileset } from './tiles.js';
import { buildFishSprite } from './fish-art.js';
import { buildCharacter, buildPortrait } from './characters.js';
import { scaleUp, silhouette } from './pixel.js';
import { C } from './palette.js';
import { FISH } from '../../data/fish-data.js';
import { NPCS } from '../../data/npc-data.js';
import { CROPS, SEASONS } from '../../data/farm-data.js';

/** e.g. { palm_0: 'assets/sprites/palm.png' } */
export const SPRITE_OVERRIDES = {};

const store = new Map();
const iconUrls = new Map();
let tileset = null;

export function sprite(id) {
  const s = store.get(id);
  if (!s && !warned.has(id)) { warned.add(id); console.warn('Missing sprite', id); }
  return s;
}
const warned = new Set();

export function tiles() { return tileset; }
export function hasSprite(id) { return store.has(id); }

export function buildAllSprites() {
  tileset = buildTileset();
  const put = (id, c) => store.set(id, c);
  for (let s = 0; s < 3; s++) {
    put('palm_' + s, OBJ.palm(s - 1, 0));
    put('palmb_' + s, OBJ.palm(s - 1, 1));
    put('mangrove_' + s, OBJ.mangroveTree(s - 1));
  }
  put('bush_0', OBJ.bush(0)); put('bush_1', OBJ.bush(1)); put('bush_2', OBJ.bush(2));
  put('flowerbush_ready', OBJ.berryBush(true)); put('flowerbush_empty', OBJ.berryBush(false));
  put('flowers_0', OBJ.flowers(C.coral, C.yellow));
  put('flowers_1', OBJ.flowers(C.pink, C.white));
  put('flowers_2', OBJ.flowers(C.lilac, C.coral));
  put('flowers_3', OBJ.flowers('#9fe3ff', C.white));
  put('rock', OBJ.rock(false)); put('boulder', OBJ.rock(true));
  put('shells', OBJ.shells()); put('seaglass', OBJ.seaGlass());
  put('driftwood', OBJ.driftwood());
  put('coral_0', OBJ.coral(C.coral)); put('coral_1', OBJ.coral('#f08ab0')); put('coral_2', OBJ.coral(C.orange));
  put('lily_0', OBJ.lilypad(false)); put('lily_1', OBJ.lilypad(true));
  put('reeds', OBJ.reeds()); put('crystal', OBJ.moonCrystal()); put('stump', OBJ.stump());
  put('board', OBJ.questBoard()); put('boat', OBJ.boat());
  put('chest', OBJ.chest(false)); put('chest_open', OBJ.chest(true));
  put('bobber', OBJ.bobber());
  for (let f = 0; f < 4; f++) put('ripple_' + f, OBJ.ripple(f));
  put('cloud_0', OBJ.cloud(0)); put('cloud_1', OBJ.cloud(1));
  put('gull_0', OBJ.seagull(0)); put('gull_1', OBJ.seagull(1));
  put('marker', OBJ.npcMarker());
  put('sparkle_0', OBJ.sprinkleSparkle(0)); put('sparkle_1', OBJ.sprinkleSparkle(1));
  put('bridgeSite', OBJ.bridgeRepairSign());
  put('tidepool', OBJ.tidePool(true)); put('tidepool_empty', OBJ.tidePool(false));

  // buildings (day / night-lit variants)
  put('cottage', OBJ.cottage(false)); put('cottage_lit', OBJ.cottage(true));
  put('shop', OBJ.shopStall(false)); put('shop_lit', OBJ.shopStall(true));
  put('fishing_hut', OBJ.fishingHut(false)); put('fishing_hut_lit', OBJ.fishingHut(true));
  put('fish_market', OBJ.fishMarket(false)); put('fish_market_lit', OBJ.fishMarket(true));
  for (let s = 0; s < 4; s++) put('crop_garden_' + s, OBJ.cropGarden(s));
  put('crop_garden', store.get('crop_garden_3'));
  put('storage_shed', OBJ.storageShed());
  put('lighthouse', OBJ.lighthouse(false)); put('lighthouse_lit', OBJ.lighthouse(true));

  // indoor furniture
  put('shelf', OBJ.shelf(0)); put('shelf_b', OBJ.shelf(1));
  put('counter', OBJ.shopCounter()); put('barrel', OBJ.barrel()); put('crate', OBJ.crate());
  put('plant', OBJ.pottedPlant()); put('fish_tank', OBJ.fishTank()); put('bed', OBJ.bed());
  put('nightstand', OBJ.nightstand()); put('fireplace', OBJ.fireplace()); put('bookshelf', OBJ.bookshelf());
  put('table', OBJ.table()); put('rug', OBJ.rug()); put('doormat', OBJ.doormat());

  // home yard, mine, monsters
  put('guest_cabin', OBJ.guestCabin(false)); put('guest_cabin_lit', OBJ.guestCabin(true));
  put('mine_entrance', OBJ.mineEntrance(false)); put('mine_entrance_lit', OBJ.mineEntrance(true));
  put('hall', OBJ.hallBuilding(false)); put('hall_lit', OBJ.hallBuilding(true));
  put('weapon_rack', OBJ.weaponRack());
  for (const k of ['stone', 'copper', 'iron', 'gold', 'gem']) put('rock_' + k, OBJ.mineRock(k));
  put('ladder_down', OBJ.ladder(true)); put('ladder_up', OBJ.ladder(false));
  put('cave_crystal', OBJ.caveCrystal());
  put('mine_rock', store.get('rock_stone')); put('flowerbush', store.get('flowerbush_ready'));
  // farm clutter (seasonal), crops, cottage extras
  for (const s of SEASONS) {
    put('debris_tree_' + s, OBJ.yardTree(s));
    put('debris_weed_' + s + '_0', OBJ.weed(0, s)); put('debris_weed_' + s + '_1', OBJ.weed(1, s));
    for (let v = 0; v < 2; v++) for (let sw = 0; sw < 3; sw++) put(`debris_grass_${s}_${v * 3 + sw}`, OBJ.tallGrass(v, s, sw));
  }
  put('debris_grass', store.get('debris_grass_spring_1')); put('debris_stump', store.get('stump'));
  put('debris_tree', store.get('debris_tree_spring')); put('debris_weed', store.get('debris_weed_spring_0'));
  put('debris_twig', OBJ.twig()); put('debris_stone', OBJ.yardStone());
  for (const c of Object.values(CROPS)) for (let st = 0; st < 4; st++) put(`crop_${c.id}_${st}`, OBJ.crop(c, st));
  put('gift_box', OBJ.giftBox()); put('tv', OBJ.tvSet());
  put('hall_counter', store.get('counter')); put('mine_crate', store.get('crate')); put('mine_chest', store.get('chest'));
  for (const t of ['slime', 'bat', 'crab', 'shade']) for (let f = 0; f < 2; f++) put(`mon_${t}_${f}`, OBJ.monster(t, f));
  // utilities + extra decorations
  put('furnace', OBJ.furnace(false)); put('furnace_lit', OBJ.furnace(true));
  put('campfire', OBJ.campfire());
  put('picket_fence', OBJ.picketFence(0)); put('picket_fence_r1', OBJ.picketFence(1));
  put('planter_box', OBJ.planterBox()); put('hay_bale', OBJ.hayBale()); put('scarecrow', OBJ.scarecrow());
  put('mailbox', OBJ.mailbox()); put('birdbath', OBJ.birdbath());
  put('stone_lantern', OBJ.stoneLantern(false)); put('stone_lantern_lit', OBJ.stoneLantern(true));
  put('flag_pole', OBJ.flagPole()); put('picnic_table', OBJ.picnicTable()); put('crate_stack', OBJ.crateStack());
  put('garden_arch', OBJ.gardenArch()); put('well', OBJ.well()); put('fish_statue', OBJ.fishStatue());

  // decorations
  put('bench', OBJ.bench(0)); put('bench_r1', OBJ.bench(1));
  put('lantern', OBJ.lantern(false)); put('lantern_lit', OBJ.lantern(true));
  put('fence', OBJ.fence(0)); put('fence_r1', OBJ.fence(1));
  put('flower_bed', OBJ.flowerBed());
  put('stone_path', OBJ.stonePath());
  put('palm_deco', store.get('palm_1'));
  put('bush_deco', store.get('bush_1'));
  put('shell_display', OBJ.shellDisplay());
  put('wooden_sign', OBJ.sign());
  put('tiki_torch', OBJ.tikiTorch(false)); put('tiki_torch_lit', OBJ.tikiTorch(true));
  put('beach_umbrella', OBJ.umbrella());
  put('small_pond', OBJ.smallPond());
  put('hammock', OBJ.hammock());
  put('topiary', OBJ.topiary());
  put('coral_planter', OBJ.coralPlanter());
  put('barrel_deco', store.get('barrel')); put('potted_plant', store.get('plant'));

  // fish (+ shimmering variants + silhouettes)
  for (const f of FISH) {
    const s = buildFishSprite(f.art);
    put('fish_' + f.id, s);
    put('fishsil_' + f.id, silhouette(s, '#3d4f66'));
    const variantArt = { ...f.art, body: shiftHue(f.art.body), patternColor: f.art.patternColor };
    put('fishvar_' + f.id, buildFishSprite(variantArt));
  }

  // characters
  for (const npc of Object.values(NPCS)) {
    put('npc_' + npc.id, buildCharacter(npc.look));
    put('portrait_' + npc.id, buildPortrait(npc.look));
  }

  // icons
  for (const [name, fn] of Object.entries(ICONS)) put('icon_' + name, fn());

  applyOverrides();

}

export function setPlayerSprites(look) {
  store.set('player', buildCharacter(look));
  store.set('portrait_player', buildPortrait(look));
  iconUrls.delete('portrait_player');
}

/** Data URL for DOM <img> usage, scaled up so browsers render it crisply. */
export function spriteUrl(id, scale = 4) {
  const key = id + '@' + scale;
  if (iconUrls.has(key)) return iconUrls.get(key);
  const s = store.get(id);
  if (!s) return '';
  const url = scaleUp(s, scale).toDataURL();
  iconUrls.set(key, url);
  return url;
}
export function iconUrl(name) { return spriteUrl('icon_' + name, 3); }
export function clearUrlCache(prefix) { for (const k of [...iconUrls.keys()]) if (k.startsWith(prefix)) iconUrls.delete(k); }

function applyOverrides() {
  for (const [id, src] of Object.entries(SPRITE_OVERRIDES)) {
    const img = new Image();
    img.onload = () => store.set(id, img);
    img.src = src;
  }
}

function shiftHue(hex) {
  // Simple, stable colour morph for "Shimmering" variants: rotate channels.
  const v = hex.replace('#', '');
  return '#' + v.slice(2, 4) + v.slice(4, 6) + v.slice(0, 2);
}
