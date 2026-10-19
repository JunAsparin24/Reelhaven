// Title-screen diorama: a sunset over the sea with a little island, drawn in
// pixel art into the renderer's low-res buffer. Layers drift at different
// speeds (parallax) so the scene feels alive while the menu waits.
import { sprite, tiles } from './art/sprites.js';
import { silhouette, hash2 } from './art/pixel.js';
import { buildCharacter } from './art/characters.js';
import { C } from './art/palette.js';

const SKY = ['#25244f', '#3a2f63', '#5a3d74', '#8a4c7c', '#c2627a', '#e47f6c', '#f4a364', '#f8c779'];
const SEA = ['#f1a97a', '#d98377', '#a96b86', '#6f6596', '#4b5f95', '#3a5486', '#2f4775', '#283e66'];

export class TitleScene {
  constructor() {
    this.ready = false;
    this.gulls = [];
  }

  build() {
    // Silhouettes for the distant islands, and the angler on the dock.
    this.palmFar = silhouette(sprite('palm_1'), '#5b3f6e');
    this.palmMid = silhouette(sprite('palmb_1'), '#40325c');
    this.gullSil = [silhouette(sprite('gull_0'), '#3b2f55'), silhouette(sprite('gull_1'), '#3b2f55')];
    this.angler = buildCharacter({ skin: '#e8b48f', hair: '#7a4a2c', hairStyle: 'short', shirt: '#e07f7d', pants: '#4f5f86', hat: 'straw' });
    this.ready = true;
  }

  render(ctx, W, H, t, reduced) {
    if (!this.ready) this.build();
    const motion = reduced ? 0 : 1;
    const portrait = H > W;
    const horizon = Math.round(H * (portrait ? 0.46 : 0.52));
    const drift = Math.sin(t * 0.05) * 10 * motion;   // slow parallax sway
    // ---- sky: banded gradient with dithered seams
    const bandH = horizon / SKY.length;
    for (let i = 0; i < SKY.length; i++) {
      const y0 = Math.floor(i * bandH);
      ctx.fillStyle = SKY[i];
      ctx.fillRect(0, y0, W, Math.ceil(bandH) + 1);
      if (i > 0) {
        ctx.fillStyle = SKY[i - 1];
        for (let x = 0; x < W; x += 2) ctx.fillRect(x + (y0 % 2), y0, 1, 1);
      }
    }
    // stars in the upper sky
    for (let i = 0; i < 60; i++) {
      const x = Math.floor(hash2(i, 1, 7) * W), y = Math.floor(hash2(i, 2, 7) * horizon * 0.45);
      const tw = Math.sin(t * 1.7 + i * 1.3);
      if (tw < -0.3 && motion) continue;
      ctx.fillStyle = tw > 0.7 ? '#fff6d8' : 'rgba(255,240,220,0.65)';
      ctx.fillRect(x, y, 1, 1);
    }
    // ---- sun: striped half-disc sitting on the horizon
    const sx = Math.round(W * (portrait ? 0.62 : 0.5) + drift * 0.15), r = Math.round(Math.min(W, H) * 0.17);
    for (let dy = -r; dy <= 0; dy++) {
      const half = Math.round(Math.sqrt(r * r - dy * dy));
      const fromBottom = -dy;
      // retro stripes get thicker towards the horizon
      if (fromBottom < r * 0.45 && fromBottom % Math.max(2, Math.round(fromBottom / 4) + 2) === 0) continue;
      ctx.fillStyle = dy < -r * 0.6 ? '#fff0b0' : dy < -r * 0.3 ? '#ffd27a' : '#ffb565';
      ctx.fillRect(sx - half, horizon + dy, half * 2, 1);
    }
    // ---- clouds (two speeds)
    for (let i = 0; i < 5; i++) {
      const speed = (i % 2 ? 2.2 : 1.3) * motion;
      const cw = 30 + (i * 13) % 26;
      const x = ((i * 97 + t * speed) % (W + cw * 2)) - cw;
      const y = Math.round(horizon * (0.18 + (i * 0.13) % 0.5));
      this.cloud(ctx, Math.round(x), y, cw, i % 2 ? '#f3a0a0' : '#f7b98f');
    }
    // ---- distant islands (far, then mid)
    this.island(ctx, Math.round(W * 0.14 + drift * 0.3), horizon, 44, 7, '#6b4a7a', this.palmFar, 0.6);
    this.island(ctx, Math.round(W * 0.86 + drift * 0.3), horizon, 30, 5, '#6b4a7a', this.palmFar, 0.5);
    this.island(ctx, Math.round(W * 0.42 + drift * 0.45), horizon + 3, 26, 5, '#4f3a66', this.palmMid, 0.7);
    // ---- sea: bands + moving wave dashes + sun glitter column
    const seaH = H - horizon;
    for (let i = 0; i < SEA.length; i++) {
      const y0 = horizon + Math.floor((i / SEA.length) ** 1.4 * seaH);
      ctx.fillStyle = SEA[i];
      ctx.fillRect(0, y0, W, H - y0);
    }
    for (let row = 0; row < 26; row++) {
      const depth = row / 26;
      const y = horizon + 2 + Math.floor(depth ** 1.5 * (seaH - 4));
      const speed = (4 + depth * 14) * motion;
      const len = 2 + Math.floor(depth * 9);
      ctx.fillStyle = depth < 0.3 ? 'rgba(255,210,160,0.55)' : 'rgba(200,225,255,0.28)';
      for (let k = 0; k < 6; k++) {
        const x = ((hash2(row, k, 3) * W + t * speed + drift * (0.5 + depth)) % (W + len)) - len;
        ctx.fillRect(Math.round(x), y, len, 1);
      }
    }
    for (let i = 0; i < 40; i++) {
      const depth = hash2(i, 9, 1);
      const y = horizon + 1 + Math.floor(depth ** 1.3 * seaH * 0.8);
      const spread = 4 + depth * r * 1.3;
      const x = sx + (hash2(i, 5, 1) - 0.5) * spread * 2;
      if (motion && Math.sin(t * 4 + i * 2.1) < 0.1) continue;
      ctx.fillStyle = depth < 0.4 ? '#fff0b8' : 'rgba(255,220,170,0.7)';
      ctx.fillRect(Math.round(x), y, 1 + Math.floor((1 - depth) * 4), 1);
    }
    // ---- foreground island with cottage, palms, dock and the angler
    this.foreground(ctx, W, H, horizon, t, drift, motion, portrait);
    // ---- seagulls
    if (motion && Math.random() < 0.004 && this.gulls.length < 2) this.gulls.push({ x: W + 10, y: 10 + Math.random() * horizon * 0.5, v: 12 + Math.random() * 8, t: 0 });
    this.gulls = this.gulls.filter(g => g.x > -20);
    for (const g of this.gulls) {
      g.t += 1 / 60; g.x -= g.v / 60;
      const spr = this.gullSil[Math.floor(g.t * 4) % 2];
      ctx.drawImage(spr, Math.round(g.x), Math.round(g.y + Math.sin(g.t * 2) * 2));
    }
  }

  cloud(ctx, x, y, w, col) {
    const h = Math.round(w * 0.22);
    ctx.fillStyle = col;
    ctx.fillRect(x + 4, y, w - 8, h);
    ctx.fillRect(x, y + 2, w, h - 2);
    ctx.fillRect(x + w * 0.25, y - 3, w * 0.4, 3);
    ctx.fillStyle = 'rgba(255,240,220,0.5)';
    ctx.fillRect(x + 5, y, w * 0.5, 1);
  }

  island(ctx, cx, horizon, w, h, col, palm, palmScale) {
    ctx.fillStyle = col;
    for (let dy = 0; dy < h; dy++) {
      const half = Math.round(w * Math.sqrt(1 - (dy / h) ** 2) * (0.6 + 0.4 * (dy / h)));
      ctx.fillRect(cx - half, horizon - h + dy, half * 2, 1);
    }
    const pw = Math.round(palm.width * palmScale), ph = Math.round(palm.height * palmScale);
    ctx.drawImage(palm, cx - w * 0.3, horizon - h - ph + 4, pw, ph);
    ctx.drawImage(palm, cx + w * 0.05, horizon - h - ph + 6, Math.round(pw * 0.8), Math.round(ph * 0.8));
  }

  foreground(ctx, W, H, horizon, t, drift, motion, portrait) {
    const ox = Math.round(drift * 1.0);
    const base = H - 6;                                   // island shoreline
    const cx = Math.round((portrait ? W * 0.4 : W * 0.22) + ox);
    const iw = Math.round(Math.min(portrait ? W * 0.62 : W * 0.3, 150));
    const ih = Math.round(Math.min(H * 0.24, 56));
    // shore foam ring
    const foamPhase = Math.floor(t * 3);
    ctx.fillStyle = 'rgba(255,240,225,0.75)';
    for (let x = -iw - 4; x <= iw + 4; x += 2) {
      if ((x + foamPhase) % 6 === 0) continue;
      const yy = base + 2 - Math.round(Math.sqrt(Math.max(0, 1 - (x / (iw + 4)) ** 2)) * 2);
      ctx.fillRect(cx + x, yy, 2, 1);
    }
    // sand mound and grass cap
    for (let dy = 0; dy < ih; dy++) {
      const k = 1 - dy / ih;
      const half = Math.round(iw * Math.sqrt(1 - k * k));
      ctx.fillStyle = dy > ih - 3 ? '#d8b679' : C.sand;
      ctx.fillRect(cx - half, base - ih + dy, half * 2, 1);
    }
    for (let dy = 0; dy < ih * 0.62; dy++) {
      const k = 1 - dy / (ih * 0.62);
      const half = Math.round(iw * 0.82 * Math.sqrt(1 - k * k));
      ctx.fillStyle = dy > ih * 0.62 - 3 ? C.grass3 : C.grass;
      ctx.fillRect(cx - half, base - ih + 2 + dy, half * 2, 1);
    }
    // dock going out to the right, with the angler at the end
    const dockY = base - 10;
    const dockStart = cx + Math.round(iw * 0.55), dockLen = Math.round(Math.min(W * 0.28, 120));
    const dockTile = tiles().dock[0];
    for (let x = 0; x < dockLen; x += 16) ctx.drawImage(dockTile, 0, 0, Math.min(16, dockLen - x), 10, dockStart + x, dockY, Math.min(16, dockLen - x), 10);
    ctx.fillStyle = C.wood3;
    ctx.fillRect(dockStart, dockY + 10, dockLen, 2);
    for (let x = 4; x < dockLen; x += 22) ctx.fillRect(dockStart + x, dockY + 10, 2, 7);
    const ax = dockStart + dockLen - 10, ay = dockY + 6;
    const angler = this.angler.hold.right;
    ctx.drawImage(angler, ax - angler.width / 2, ay - angler.height + 2);
    // rod, line and bobber
    const tipX = ax + 15, tipY = ay - 20;
    ctx.fillStyle = C.wood3;
    for (let i = 0; i < 12; i++) ctx.fillRect(ax + 3 + i, ay - 9 - Math.round(i * 0.9), 1, 1);
    const bobX = tipX + 22, bobY = dockY + 4 + (motion ? Math.round(Math.sin(t * 2.2)) : 0);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i <= 20; i++) {
      const u = i / 20;
      ctx.fillRect(Math.round(tipX + (bobX - tipX) * u), Math.round(tipY + (bobY - tipY) * u + Math.sin(u * Math.PI) * 5), 1, 1);
    }
    ctx.drawImage(sprite('bobber'), bobX - 4, bobY - 7);
    if (motion) { ctx.globalAlpha = 0.6; ctx.drawImage(sprite('ripple_' + (Math.floor(t * 2) % 4)), bobX - 10, bobY - 2); ctx.globalAlpha = 1; }
    // boat moored by the dock
    const boat = sprite('boat');
    ctx.drawImage(boat, dockStart + Math.round(dockLen * 0.35), dockY - 16 + (motion ? Math.round(Math.sin(t * 1.4) * 1) : 0));
    // cottage with warm windows, palms, flowers, lantern
    const cot = sprite('cottage_lit');
    const cs = Math.min(1, (ih * 1.6) / cot.height);
    const cw = Math.round(cot.width * cs), ch = Math.round(cot.height * cs);
    ctx.drawImage(cot, cx - cw / 2 - iw * 0.18, base - ih * 0.55 - ch + 6, cw, ch);
    const sway = motion ? (Math.sin(t * 1.3) > 0.5 ? 2 : Math.sin(t * 1.3) < -0.5 ? 0 : 1) : 1;
    const palm = sprite('palm_' + sway), palm2 = sprite('palmb_' + (2 - sway));
    ctx.drawImage(palm, cx - iw * 0.82, base - ih * 0.5 - palm.height + 6);
    ctx.drawImage(palm2, cx + iw * 0.3, base - ih * 0.62 - palm2.height + 6);
    ctx.drawImage(sprite('flowers_0'), cx + iw * 0.05, base - ih * 0.3);
    ctx.drawImage(sprite('flowers_1'), cx - iw * 0.55, base - ih * 0.25);
    ctx.drawImage(sprite('bush_1'), cx + iw * 0.18, base - ih * 0.42);
    ctx.drawImage(sprite('lantern_lit'), dockStart - 8, dockY - 18);
    // warm glow + fireflies
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,190,110,0.12)';
    ctx.beginPath(); ctx.arc(dockStart - 2, dockY - 12, 14, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 10; i++) {
      if (motion && Math.sin(t * 2 + i * 1.9) < 0.2) continue;
      const fx = cx + Math.sin(t * 0.4 + i * 2.3) * iw * 0.9, fy = base - ih * 0.8 + Math.cos(t * 0.5 + i) * ih * 0.5;
      ctx.fillStyle = 'rgba(255,240,150,0.95)';
      ctx.fillRect(Math.round(fx), Math.round(fy), 1, 1);
    }
  }
}

