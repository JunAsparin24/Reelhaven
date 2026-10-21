// Procedural character sprites. A "look" describes colours and accessories;
// the same generator draws the player and every NPC so they share a style.
//
// look = { skin, hair, hairStyle, shirt, outfit, pants, bottoms, shoes, hat, acc }
// NPCs can also use: overalls (colour), apron (colour), beard (colour), glasses (colour).
import { paint, outline, flipH, shade } from './pixel.js';
import { C } from './palette.js';

export const CHAR_W = 18;
export const CHAR_H = 24;

export const SKIN_TONES = ['#fbe0c8', '#f6d3b3', '#e8b48f', '#c98d63', '#9a6644', '#6e4a33', '#4f3324'];
export const HAIR_COLORS = ['#4a3328', '#7a4a2c', '#d79a52', '#f2d27e', '#2e2a36', '#c2554f', '#e8e2d0', '#e98fb4', '#6fa8dc', '#7bc47f', '#9b7be0'];
export const SHIRT_COLORS = ['#e07f7d', '#f6b66c', '#f2d27e', '#6dbb72', '#4fa3a0', '#5b9be0', '#3f5f9a', '#b27be0', '#e98fb4', '#fbfbf6', '#8a8a96', '#3a3440'];
export const PANTS_COLORS = ['#4f5f86', '#2f3a56', '#6b4a36', '#a88a5c', '#5f7a4a', '#8a8a96', '#3a3440', '#b84a4a', '#e8e2d0'];
export const SHOE_COLORS = ['#5a3e33', '#2e2a36', '#fbfbf6', '#c2554f', '#5b9be0', '#e9c46a'];
export const HAIR_STYLES = ['short', 'long', 'bun', 'spiky', 'ponytail', 'bob', 'curly', 'mohawk', 'buzz'];

/** Top styles you can pick in the character creator. */
export const OUTFITS = {
  tee: 'T-shirt', stripes: 'Striped tee', hoodie: 'Hoodie', tank: 'Tank top', jacket: 'Jacket',
  sweater: 'Sweater', vest: 'Vest', overalls: 'Overalls', dress: 'Sundress', sailor: 'Sailor top',
};
/** Bottom styles. */
export const BOTTOMS = { pants: 'Pants', shorts: 'Shorts', skirt: 'Skirt', cargo: 'Cargo pants', rolled: 'Rolled jeans' };
/** Face accessories. */
export const ACCESSORIES = { none: 'None', glasses: 'Glasses', sunglasses: 'Sunglasses', freckles: 'Freckles', earrings: 'Earrings', blush: 'Rosy cheeks', eyepatch: 'Eye patch' };

/**
 * Draw one frame.
 * dir: 'down' | 'up' | 'left'; step: -1,0,1 (leg phase); pose: 'walk' | 'hold' | 'cheer'
 */
function drawFrame(look, dir, step, pose) {
  const skin = look.skin, skinS = shade(look.skin, -0.15);
  const hair = look.hair, hairS = shade(look.hair, -0.25);
  const outfit = look.outfit || 'tee';
  const shirt = look.shirt, shirtS = shade(look.shirt, -0.2), shirtL = shade(look.shirt, 0.35);
  const pants = look.pants || '#4f5f86', pantsS = shade(pants, -0.25);
  const shoes = look.shoes || '#5a3e33';
  const bottoms = outfit === 'dress' ? 'dress' : outfit === 'overalls' ? 'pants' : (look.bottoms || 'pants');
  const left = dir === 'left';
  const can = paint(CHAR_W, CHAR_H, p => {
    const lLeg = step === 1 ? -1 : 0, rLeg = step === -1 ? -1 : 0;
    // ---- legs: [x, height] for each leg; the top part shows the bottoms, the rest is skin
    const legs = left
      ? [[7 + (step === 1 ? -1 : step === -1 ? 1 : 0), 3, pants], [9 - (step === 1 ? -1 : step === -1 ? 1 : 0), 3, pantsS]]
      : [[6, 3 + lLeg, pants], [10, 3 + rLeg, pantsS]];
    for (const [x, len, col] of legs) {
      const cover = bottoms === 'shorts' || bottoms === 'skirt' || bottoms === 'dress' ? 1 : bottoms === 'rolled' ? len - 1 : len;
      p.rect(x, 17, 2, len, skin);
      if (cover > 0) p.rect(x, 17, 2, cover, col);
      if (bottoms === 'rolled') p.hline(x, 17 + cover - 1, 2, shade(pants, 0.3));
      if (bottoms === 'cargo' && len >= 3) p.px(x + (x < 9 ? 0 : 1), 18, shade(pants, -0.4));
      p.rect(x, 17 + len, 2, 1, shoes);
    }
    // ---- body
    const bx = left ? 6 : 5, bw = left ? 6 : 8;
    const top = outfit === 'vest' ? '#fbfbf6' : outfit === 'overalls' && !look.overalls ? shirt : shirt;
    p.rect(bx, 11, bw, 6, top);
    p.rect(bx + bw - 1, 11, 1, 6, shade(top, -0.2));
    p.rect(bx, 16, bw, 1, shade(top, -0.2));
    if (outfit === 'stripes') { p.hline(bx, 12, bw, shirtL); p.hline(bx, 14, bw, shirtL); }
    if (outfit === 'tank') { p.rect(bx + 1, 11, bw - 2, 1, skin); p.px(bx + 1, 11, top); p.px(bx + bw - 2, 11, top); }
    if (outfit === 'hoodie') {
      if (dir === 'down') { p.px(8, 12, C.cream); p.px(10, 12, C.cream); p.hline(bx + 2, 15, bw - 4, shirtS); }
      else if (dir === 'up') p.rect(bx + 1, 9, bw - 2, 3, shirtS);
      else p.rect(bx + bw - 2, 9, 2, 3, shirtS);
    }
    if (outfit === 'jacket' && dir !== 'up') {
      const cx = left ? bx : 8;
      p.rect(cx, 11, 2, 6, C.cream); p.px(cx, 11, shirtS); p.px(cx + 1, 11, shirtS);
      if (!left) { p.px(7, 11, shirtL); p.px(10, 11, shirtL); }
    }
    if (outfit === 'sweater') { p.hline(bx, 11, bw, shirtL); p.hline(bx, 16, bw, shirtL); if (dir === 'down') p.hline(bx + 1, 13, bw - 2, shirtS); }
    if (outfit === 'vest') { p.rect(bx, 11, 2, 6, shirt); p.rect(bx + bw - 2, 11, 2, 6, shirtS); if (dir === 'down') { p.px(9, 13, shirtS); p.px(9, 15, shirtS); } }
    if (outfit === 'sailor') { p.rect(bx, 11, bw, 2, '#3f5f9a'); p.hline(bx, 12, bw, C.white); if (dir === 'down') { p.px(8, 13, C.red); p.px(9, 13, C.red); } }
    if (outfit === 'dress') {
      // the skirt of the dress flares over the top of the legs
      p.rect(bx - 1, 16, bw + 2, 2, shirt); p.hline(bx - 1, 17, bw + 2, shirtS);
      if (dir === 'down') p.hline(bx, 13, bw, shirtL);
    }
    if (bottoms === 'skirt') { p.rect(bx - 1, 16, bw + 2, 2, pants); p.hline(bx - 1, 17, bw + 2, pantsS); }
    const ov = look.overalls || (outfit === 'overalls' ? pants : null);
    if (ov) {
      p.rect(bx + 1, 13, bw - 2, 4, ov);
      p.px(bx + 1, 11, ov); p.px(bx + bw - 2, 11, ov);
      p.px(bx + 1, 12, ov); p.px(bx + bw - 2, 12, ov);
      if (dir === 'down') { p.px(bx + 1, 13, C.gold); p.px(bx + bw - 2, 13, C.gold); }
    }
    if (look.apron) { p.rect(bx + 1, 13, bw - 2, 4, look.apron); p.hline(bx + 1, 13, bw - 2, shade(look.apron, -0.15)); }
    if (dir === 'down' && !ov && !['tank', 'sweater', 'sailor', 'jacket'].includes(outfit)) { p.px(8, 11, skinS); p.px(9, 11, skinS); }
    // ---- arms (tank tops and dresses show bare arms)
    const sleeve = outfit === 'tank' || outfit === 'dress' ? skin : outfit === 'vest' ? '#fbfbf6' : shirt;
    const sleeveS = outfit === 'tank' || outfit === 'dress' ? skinS : outfit === 'vest' ? '#e2e2da' : shirtS;
    if (pose === 'cheer') {
      p.rect(3, 7, 2, 4, sleeve); p.rect(3, 6, 2, 1, skin);
      p.rect(13, 7, 2, 4, sleeve); p.rect(13, 6, 2, 1, skin);
    } else if (pose === 'hold') {
      if (left) {
        p.rect(5, 12, 3, 2, sleeve); p.rect(4, 12, 1, 2, skin);
      } else if (dir === 'up') {
        p.rect(4, 11, 1, 3, sleeve); p.rect(13, 11, 1, 3, sleeve);
      } else {
        p.rect(4, 11, 1, 3, sleeve); p.rect(13, 11, 1, 3, sleeve);
        p.rect(7, 14, 4, 1, skin);
      }
    } else if (left) {
      const s = step === 0 ? 0 : step;
      p.rect(8 + s, 12, 2, 3, sleeveS); p.rect(8 + s, 15, 2, 1, skin);
    } else {
      const sl = step === 1 ? 1 : step === -1 ? -1 : 0;
      p.rect(4, 11 + Math.max(0, sl), 1, 4, sleeve); p.px(4, 15 + Math.max(0, sl), skin);
      p.rect(13, 11 + Math.max(0, -sl), 1, 4, sleeveS); p.px(13, 15 + Math.max(0, -sl), skin);
    }
    // ---- head
    const hx = 4, hw = left ? 9 : 10;
    p.rrect(hx, 2, hw, 9, skin);
    p.hline(hx + 1, 10, hw - 2, skinS);
    drawHair(p, look.hairStyle || 'short', hair, hairS, dir, hx, hw);
    // ---- face
    const acc = look.acc || 'none';
    if (dir === 'down') {
      p.rect(7, 6, 1, 2, C.ink); p.rect(10, 6, 1, 2, C.ink);
      p.px(6, 8, C.coral); p.px(11, 8, C.coral);
      if (pose === 'cheer') { p.rect(8, 9, 2, 1, C.red2); }
      if (look.beard) { p.rect(6, 8, 6, 3, look.beard); p.px(8, 8, skin); p.px(9, 8, skin); }
      const glass = look.glasses || (acc === 'glasses' ? '#3a3440' : null);
      if (glass) { p.rect(6, 6, 3, 2, glass); p.rect(9, 6, 3, 2, glass); p.px(7, 6, C.foam); p.px(10, 6, C.foam); }
      if (acc === 'sunglasses') { p.rect(6, 6, 6, 2, '#2e2a36'); p.px(7, 6, '#6f6a80'); p.px(10, 6, '#6f6a80'); }
      if (acc === 'freckles') { p.px(6, 9, shade(skin, -0.3)); p.px(7, 8, shade(skin, -0.3)); p.px(11, 9, shade(skin, -0.3)); p.px(10, 8, shade(skin, -0.3)); }
      if (acc === 'blush') { p.rect(6, 8, 2, 1, '#f08a9a'); p.rect(10, 8, 2, 1, '#f08a9a'); }
      if (acc === 'earrings') { p.px(4, 8, C.gold); p.px(13, 8, C.gold); }
      if (acc === 'eyepatch') { p.rect(9, 5, 3, 3, '#2e2a36'); p.line(4, 4, 9, 5, '#2e2a36'); }
    } else if (left) {
      p.rect(5, 6, 1, 2, C.ink); p.px(5, 8, C.coral);
      p.px(4, 7, skinS);
      if (look.beard) { p.rect(4, 8, 4, 3, look.beard); }
      const glass = look.glasses || (acc === 'glasses' ? '#3a3440' : null);
      if (glass) { p.rect(4, 6, 3, 2, glass); p.px(5, 6, C.foam); }
      if (acc === 'sunglasses') p.rect(4, 6, 4, 2, '#2e2a36');
      if (acc === 'freckles') { p.px(5, 9, shade(skin, -0.3)); p.px(6, 8, shade(skin, -0.3)); }
      if (acc === 'blush') p.rect(5, 8, 2, 1, '#f08a9a');
      if (acc === 'earrings') p.px(10, 8, C.gold);
      if (acc === 'eyepatch') p.line(4, 5, 11, 4, '#2e2a36');
    } else if (acc === 'earrings') { p.px(4, 8, C.gold); p.px(13, 8, C.gold); }
    // ---- hats
    drawHat(p, look.hat, dir);
  });
  return outline(can, C.ink);
}

function drawHair(p, style, hair, hairS, dir, hx, hw) {
  const left = dir === 'left';
  if (style === 'buzz') {
    // just a short cap of hair
    if (dir === 'up') p.rrect(hx, 1, hw, 8, hair);
    else if (left) { p.rect(hx + 1, 1, hw - 1, 2, hair); p.rect(hx + hw - 3, 3, 3, 3, hair); }
    else p.rect(hx + 1, 1, hw - 2, 2, hair);
    return;
  }
  if (dir === 'up') {
    p.rrect(hx, 1, hw, 9, hair);
    p.hline(hx + 1, 9, hw - 2, hairS);
    if (style === 'long') p.rect(hx + 1, 9, hw - 2, 3, hair);
    if (style === 'ponytail') { p.rect(8, 9, 2, 4, hair); p.px(8, 9, hairS); }
    if (style === 'bob') p.rect(hx, 8, hw, 2, hair);
  } else if (left) {
    p.rect(hx + 1, 1, hw - 1, 3, hair);
    p.rect(hx + 4, 3, hw - 4, 4, hair);
    p.rect(hx + hw - 2, 3, 2, 6, hair);
    p.px(hx, 3, hair); p.px(hx + 1, 4, hair);
    if (style === 'long') p.rect(hx + 5, 7, 4, 5, hair);
    if (style === 'ponytail') { p.rect(hx + hw, 4, 2, 5, hair); p.px(hx + hw - 1, 4, hairS); }
    if (style === 'bob') p.rect(hx + 4, 7, 5, 2, hair);
    p.rect(hx + hw - 1, 4, 1, 4, hairS);
  } else {
    p.rect(hx + 1, 1, hw - 2, 3, hair);
    p.rect(hx, 2, hw, 3, hair);
    p.rect(hx, 5, 1, 3, hair); p.rect(hx + hw - 1, 5, 1, 3, hair);
    p.px(hx + 1, 5, hair); p.px(hx + hw - 2, 5, hair);
    p.px(hx + 4, 5, hairS);
    if (style === 'long') { p.rect(hx, 7, 1, 5, hair); p.rect(hx + hw - 1, 7, 1, 5, hair); }
    if (style === 'bob') { p.rect(hx - 1, 4, 2, 6, hair); p.rect(hx + hw - 1, 4, 2, 6, hair); }
    if (style === 'ponytail') { p.rect(hx + hw - 1, 3, 2, 2, hairS); }
  }
  if (style === 'curly') {
    for (const [x, y] of left ? [[5, 0], [8, 0], [11, 1], [12, 4], [12, 7]] : [[4, 1], [6, 0], [9, 0], [12, 0], [14, 1], [3, 4], [14, 4]]) { p.rect(x, y, 2, 2, hair); p.px(x, y + 1, hairS); }
  }
  if (style === 'bun') { p.rrect(left ? 9 : 6, 0, 6, 3, hair); p.px(left ? 10 : 8, 0, hairS); }
  if (style === 'spiky') { p.px(5, 0, hair); p.px(8, 0, hair); p.px(11, 0, hair); }
  if (style === 'mohawk') { p.rect(left ? 8 : 8, 0, 2, 2, hair); p.px(left ? 9 : 9, 0, shade(hair, 0.25)); if (!left && dir !== 'up') { p.rect(hx, 4, 1, 4, hairS); p.rect(hx + hw - 1, 4, 1, 4, hairS); } }
}

function drawHat(p, hat, dir) {
  if (!hat || hat === 'none') return;
  const left = dir === 'left';
  const down = dir === 'down';
  switch (hat) {
    case 'straw':
      p.rect(2, 3, 14, 1, '#e9c46a');
      p.rect(left ? 4 : 5, 0, 8, 3, '#f2d27e');
      p.hline(left ? 4 : 5, 2, 8, C.red);
      break;
    case 'cap':
      p.rect(4, 0, 10, 3, '#5b9be0');
      if (down) p.rect(4, 3, 10, 1, '#46719f');
      if (left) p.rect(2, 2, 4, 1, '#46719f');
      break;
    case 'captain':
      p.rect(4, 0, 10, 3, C.white);
      p.hline(4, 2, 10, C.night);
      if (down) { p.rect(5, 3, 8, 1, C.night); p.px(9, 1, C.gold); }
      if (left) p.rect(2, 3, 4, 1, C.night);
      break;
    case 'bandana':
      p.rect(4, 1, 10, 2, C.coral2);
      p.px(5, 1, C.white); p.px(9, 2, C.white); p.px(12, 1, C.white);
      if (!down) { p.px(13, 3, C.coral2); p.px(14, 4, C.coral2); }
      break;
    case 'flower': {
      const x = left ? 10 : 12;
      p.px(x, 2, C.pink); p.px(x - 1, 3, C.pink); p.px(x + 1, 3, C.pink); p.px(x, 4, C.pink); p.px(x, 3, C.yellow);
      break;
    }
    case 'hardhat':
      p.rrect(4, 0, 10, 4, C.yellow); p.hline(3, 3, 12, C.gold2); p.px(8, 1, C.cream);
      break;
    case 'explorer':
      p.rect(3, 3, 12, 1, '#a78b5f'); p.rrect(5, 0, 8, 4, '#c9ad7a'); p.hline(5, 2, 8, C.wood3);
      break;
    case 'beanie':
      p.rrect(4, 0, 10, 4, C.lilac); p.hline(4, 3, 10, C.lilac2); p.px(9, 0, C.cream);
      break;
    case 'sunhat':
      p.rect(1, 3, 16, 1, '#f4e2c0'); p.rect(0, 4, 2, 1, '#f4e2c0'); p.rect(16, 4, 2, 1, '#f4e2c0');
      p.rrect(5, 0, 8, 4, '#fbf0d8'); p.hline(5, 2, 8, '#e98fb4');
      break;
    case 'bucket':
      p.rect(3, 3, 12, 2, '#6f9a5a'); p.rect(5, 0, 8, 3, '#7fae68'); p.hline(5, 2, 8, '#5f8a4a');
      break;
    case 'beret':
      p.rrect(4, 0, 11, 3, '#c2554f'); p.rect(13, 2, 2, 1, '#a2453f'); p.px(9, 0, '#a2453f');
      break;
    case 'cowboy':
      p.rect(1, 3, 16, 1, '#8a5a36'); p.px(1, 2, '#8a5a36'); p.px(16, 2, '#8a5a36');
      p.rect(5, 0, 8, 3, '#a06a42'); p.hline(5, 2, 8, '#5a3e33'); p.px(8, 0, '#8a5a36');
      break;
    case 'bow': {
      const x = left ? 10 : 11;
      p.rect(x - 2, 1, 2, 2, '#e98fb4'); p.rect(x + 1, 1, 2, 2, '#e98fb4'); p.px(x, 1, '#c96f94'); p.px(x, 2, '#c96f94');
      break;
    }
    case 'headband':
      p.rect(4, 3, 10, 1, '#5b9be0'); if (!down) p.rect(left ? 12 : 12, 4, 1, 3, '#5b9be0');
      break;
    case 'tophat':
      p.rect(3, 3, 12, 1, '#2e2a36'); p.rect(5, 0, 8, 3, '#3a3440'); p.hline(5, 2, 8, '#c2554f');
      break;
    case 'crown':
      p.rect(5, 1, 8, 2, C.gold); for (const x of [5, 8, 11]) p.rect(x, 0, 2, 1, C.gold); p.px(9, 1, C.red); p.px(6, 2, C.yellow);
      break;
    case 'pirate':
      p.rect(2, 2, 14, 2, '#2e2a36'); p.rect(5, 0, 8, 2, '#2e2a36'); if (down) { p.px(8, 2, C.white); p.px(9, 2, C.white); }
      break;
    case 'wizard':
      p.rect(2, 3, 14, 1, '#6a4fb0'); p.rect(5, 1, 8, 2, '#7b5fc6'); p.rect(7, 0, 4, 1, '#7b5fc6'); p.px(8, 1, C.yellow); p.px(11, 2, C.yellow);
      break;
    case 'frog':
      p.rrect(4, 0, 10, 4, '#6dbb72'); p.rect(4, 0, 3, 2, C.white); p.rect(11, 0, 3, 2, C.white); p.px(5, 1, C.ink); p.px(12, 1, C.ink);
      break;
    case 'flower_crown':
      for (const [x, c] of [[4, C.pink], [6, C.yellow], [8, '#e98fb4'], [10, C.white], [12, C.pink]]) { p.rect(x, 2, 2, 2, c); p.px(x, 2, shade(c, 0.2)); }
      p.hline(4, 3, 10, '#5f8a4a');
      break;
    case 'cat':
      p.rrect(4, 0, 10, 3, '#3a3440'); p.px(4, 0, '#3a3440'); p.px(13, 0, '#3a3440'); p.px(5, 1, '#e98fb4'); p.px(12, 1, '#e98fb4');
      break;
    default: break;
  }
}

/** Build every animation frame for a look. */
export function buildCharacter(look) {
  const down = [drawFrame(look, 'down', 0, 'walk'), drawFrame(look, 'down', 1, 'walk'), drawFrame(look, 'down', 0, 'walk'), drawFrame(look, 'down', -1, 'walk')];
  const up = [drawFrame(look, 'up', 0, 'walk'), drawFrame(look, 'up', 1, 'walk'), drawFrame(look, 'up', 0, 'walk'), drawFrame(look, 'up', -1, 'walk')];
  const left = [drawFrame(look, 'left', 0, 'walk'), drawFrame(look, 'left', 1, 'walk'), drawFrame(look, 'left', 0, 'walk'), drawFrame(look, 'left', -1, 'walk')];
  const right = left.map(flipH);
  const holdLeft = drawFrame(look, 'left', 0, 'hold');
  return {
    down, up, left, right,
    hold: {
      down: drawFrame(look, 'down', 0, 'hold'),
      up: drawFrame(look, 'up', 0, 'hold'),
      left: holdLeft,
      right: flipH(holdLeft),
    },
    cheer: drawFrame(look, 'down', 0, 'cheer'),
  };
}

/** Portrait (head + shoulders) for UI avatars and dialogue boxes. */
export function buildPortrait(look) {
  const frame = drawFrame(look, 'down', 0, 'walk');
  return paint(CHAR_W, 15, p => p.ctx.drawImage(frame, 0, 0));
}

/** Full-body preview (used by the character creator). */
export function buildFullPreview(look) {
  return drawFrame(look, 'down', 0, 'walk');
}
