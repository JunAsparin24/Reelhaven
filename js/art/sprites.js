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
