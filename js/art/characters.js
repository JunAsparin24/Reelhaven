// Procedural character sprites. A "look" describes colours and accessories;
// the same generator draws the player and every NPC so they share a style.
import { paint, outline, flipH, shade } from './pixel.js';
import { C } from './palette.js';

export const CHAR_W = 18;
export const CHAR_H = 24;

export const SKIN_TONES = ['#f6d3b3', '#e8b48f', '#c98d63', '#9a6644', '#6e4a33'];
export const HAIR_COLORS = ['#4a3328', '#7a4a2c', '#d79a52', '#2e2a36', '#c2554f', '#e8e2d0'];
export const SHIRT_COLORS = ['#e07f7d', '#5b9be0', '#6dbb72', '#f6b66c', '#b27be0', '#fbfbf6'];
export const HAIR_STYLES = ['short', 'long', 'bun', 'spiky'];

/**
 * Draw one frame.
 * dir: 'down' | 'up' | 'left'; step: -1,0,1 (leg phase); pose: 'walk' | 'hold' | 'cheer'
 */
function drawFrame(look, dir, step, pose) {
  const skin = look.skin, skinS = shade(look.skin, -0.15);
  const hair = look.hair, hairS = shade(look.hair, -0.25);
  const shirt = look.shirt, shirtS = shade(look.shirt, -0.2);
  const pants = look.pants || '#4f5f86', pantsS = shade(pants, -0.25);
  const shoes = '#5a3e33';
  const can = paint(CHAR_W, CHAR_H, p => {
    const lLeg = step === 1 ? -1 : 0, rLeg = step === -1 ? -1 : 0;
    // ---- legs
    if (dir === 'left') {
      const a = step === 1 ? -1 : step === -1 ? 1 : 0;
      p.rect(7 + a, 17, 2, 3, pants); p.rect(7 + a, 20, 2, 1, shoes);
      p.rect(9 - a, 17, 2, 3, pantsS); p.rect(9 - a, 20, 2, 1, shoes);
    } else {
      p.rect(6, 17, 2, 3 + lLeg, pants); p.rect(6, 20 + lLeg, 2, 1, shoes);
      p.rect(10, 17, 2, 3 + rLeg, pantsS); p.rect(10, 20 + rLeg, 2, 1, shoes);
    }
    // ---- body
    const bx = dir === 'left' ? 6 : 5, bw = dir === 'left' ? 6 : 8;
    p.rect(bx, 11, bw, 6, shirt);
    p.rect(bx + bw - 1, 11, 1, 6, shirtS);
    p.rect(bx, 16, bw, 1, shirtS);
    if (look.overalls) {
      p.rect(bx + 1, 13, bw - 2, 4, look.overalls);
      p.px(bx + 1, 11, look.overalls); p.px(bx + bw - 2, 11, look.overalls);
      p.px(bx + 1, 12, look.overalls); p.px(bx + bw - 2, 12, look.overalls);
    }
    if (look.apron) { p.rect(bx + 1, 13, bw - 2, 4, look.apron); p.hline(bx + 1, 13, bw - 2, shade(look.apron, -0.15)); }
    if (dir === 'down' && !look.overalls) { p.px(8, 11, skinS); p.px(9, 11, skinS); }
    // ---- arms
    if (pose === 'cheer') {
      p.rect(3, 7, 2, 4, shirt); p.rect(3, 6, 2, 1, skin);
      p.rect(13, 7, 2, 4, shirt); p.rect(13, 6, 2, 1, skin);
    } else if (pose === 'hold') {
      if (dir === 'left') {
        p.rect(5, 12, 3, 2, shirt); p.rect(4, 12, 1, 2, skin);
      } else if (dir === 'up') {
        p.rect(4, 11, 1, 3, shirt); p.rect(13, 11, 1, 3, shirt);
      } else {
        p.rect(4, 11, 1, 3, shirt); p.rect(13, 11, 1, 3, shirt);
        p.rect(7, 14, 4, 1, skin);
      }
    } else if (dir === 'left') {
      const s = step === 0 ? 0 : step;
      p.rect(8 + s, 12, 2, 3, shirtS); p.rect(8 + s, 15, 2, 1, skin);
    } else {
      const sl = step === 1 ? 1 : step === -1 ? -1 : 0;
      p.rect(4, 11 + Math.max(0, sl), 1, 4, shirt); p.px(4, 15 + Math.max(0, sl), skin);
      p.rect(13, 11 + Math.max(0, -sl), 1, 4, shirtS); p.px(13, 15 + Math.max(0, -sl), skin);
    }
    // ---- head
    const hx = dir === 'left' ? 4 : 4, hw = dir === 'left' ? 9 : 10;
    p.rrect(hx, 2, hw, 9, skin);
    p.hline(hx + 1, 10, hw - 2, skinS);
    // hair
    const style = look.hairStyle || 'short';
    if (dir === 'up') {
      p.rrect(hx, 1, hw, 9, hair);
      p.hline(hx + 1, 9, hw - 2, hairS);
      if (style === 'long') p.rect(hx + 1, 9, hw - 2, 3, hair);
    } else if (dir === 'left') {
      p.rect(hx + 1, 1, hw - 1, 3, hair);
      p.rect(hx + 4, 3, hw - 4, 4, hair);
      p.rect(hx + hw - 2, 3, 2, 6, hair);
      p.px(hx, 3, hair); p.px(hx + 1, 4, hair);
      if (style === 'long') p.rect(hx + 5, 7, 4, 5, hair);
      p.rect(hx + hw - 1, 4, 1, 4, hairS);
    } else {
      p.rect(hx + 1, 1, hw - 2, 3, hair);
      p.rect(hx, 2, hw, 3, hair);
      p.rect(hx, 5, 1, 3, hair); p.rect(hx + hw - 1, 5, 1, 3, hair);
      p.px(hx + 1, 5, hair); p.px(hx + hw - 2, 5, hair);
      p.px(hx + 4, 5, hairS);
      if (style === 'long') { p.rect(hx - 1 + 1, 7, 1, 5, hair); p.rect(hx + hw - 1, 7, 1, 5, hair); }
    }
    if (style === 'bun') { p.rrect(dir === 'left' ? 9 : 6, -0 + 0, 6, 3, hair); p.px(dir === 'left' ? 10 : 8, 0, hairS); }
    if (style === 'spiky') { p.px(5, 0, hair); p.px(8, 0, hair); p.px(11, 0, hair); }
    // face
    if (dir === 'down') {
      p.rect(7, 6, 1, 2, C.ink); p.rect(10, 6, 1, 2, C.ink);
      p.px(6, 8, C.coral); p.px(11, 8, C.coral);
      if (pose === 'cheer') { p.rect(8, 9, 2, 1, C.red2); }
      if (look.beard) { p.rect(6, 8, 6, 3, look.beard); p.px(8, 8, skin); p.px(9, 8, skin); }
      if (look.glasses) { p.rect(6, 6, 3, 2, look.glasses); p.rect(9, 6, 3, 2, look.glasses); p.px(7, 6, C.foam); p.px(10, 6, C.foam); }
    } else if (dir === 'left') {
      p.rect(5, 6, 1, 2, C.ink); p.px(5, 8, C.coral);
      p.px(4, 7, skinS);
      if (look.beard) { p.rect(4, 8, 4, 3, look.beard); }
      if (look.glasses) { p.rect(4, 6, 3, 2, look.glasses); p.px(5, 6, C.foam); }
    }
    // ---- hats
    drawHat(p, look.hat, dir);
  });
  return outline(can, C.ink);
}

function drawHat(p, hat, dir) {
  if (!hat || hat === 'none') return;
  const left = dir === 'left';
  if (hat === 'straw') {
    p.rect(2, 3, 14, 1, '#e9c46a');
    p.rect(left ? 4 : 5, 0, left ? 8 : 8, 3, '#f2d27e');
    p.hline(left ? 4 : 5, 2, 8, C.red);
  } else if (hat === 'cap') {
    p.rect(4, 0, 10, 3, '#5b9be0');
    if (dir === 'down') p.rect(4, 3, 10, 1, '#46719f');
    if (left) p.rect(2, 2, 4, 1, '#46719f');
  } else if (hat === 'captain') {
    p.rect(4, 0, 10, 3, C.white);
    p.hline(4, 2, 10, C.night);
    if (dir === 'down') { p.rect(5, 3, 8, 1, C.night); p.px(9, 1, C.gold); }
    if (left) p.rect(2, 3, 4, 1, C.night);
  } else if (hat === 'bandana') {
    p.rect(4, 1, 10, 2, C.coral2);
    p.px(5, 1, C.white); p.px(9, 2, C.white); p.px(12, 1, C.white);
    if (dir !== 'down') { p.px(left ? 13 : 13, 3, C.coral2); p.px(left ? 14 : 14, 4, C.coral2); }
  } else if (hat === 'flower') {
    const x = left ? 10 : 12;
    p.px(x, 2, C.pink); p.px(x - 1, 3, C.pink); p.px(x + 1, 3, C.pink); p.px(x, 4, C.pink); p.px(x, 3, C.yellow);
  } else if (hat === 'hardhat') {
    p.rrect(4, 0, 10, 4, C.yellow);
    p.hline(3, 3, 12, C.gold2);
    p.px(8, 1, C.cream);
  } else if (hat === 'explorer') {
    p.rect(3, 3, 12, 1, '#a78b5f');
    p.rrect(5, 0, 8, 4, '#c9ad7a');
    p.hline(5, 2, 8, C.wood3);
  } else if (hat === 'beanie') {
    p.rrect(4, 0, 10, 4, C.lilac);
    p.hline(4, 3, 10, C.lilac2);
    p.px(9, -0, C.cream);
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
