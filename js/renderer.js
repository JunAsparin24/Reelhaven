// Canvas renderer. Draws the world into a low-resolution buffer at a fixed
// logical pixel size and upscales it by an integer factor, so pixel art stays
// razor sharp on any screen. Text overlays are drawn after upscaling.
import { TILE, WATER_FRAMES, WATER_STYLES } from './art/tiles.js';
import { sprite, tiles, hasSprite } from './art/sprites.js';
import { makeCanvas } from './art/pixel.js';
import { C } from './art/palette.js';
import { T, WATERY } from './world-gen.js';
import { lighting } from './weather.js';
import { getState } from './state.js';
import { seasonOf } from '../data/farm-data.js';
import { cropStage } from './farm.js';
import { MONSTERS } from '../data/mine-data.js';
import { ANIMALS } from '../data/life-data.js';
import { RESOURCES } from '../data/item-data.js';
import { scaffold } from './art/life-art.js';
import { machineReady } from './life.js';

/** The current season ('spring' on the title screen). */
const seasonNow = () => { const s = getState(); return s?.world ? seasonOf(s.world.day).season : 'spring'; };
import { TitleScene } from './title-scene.js';

const GRASSY = new Set([T.G, T.K, T.N]);
// Floor coverings indoors, drawn under everything and bottom-aligned.
const FLOOR_OBJECTS = new Set(['rug', 'doormat', 'ladder_down']);
const FLAT_OBJECTS = new Set(['shells', 'seaglass', 'tidepool', 'flowers', 'lily', 'coral', 'driftwood', 'reeds']);
const TARGET_TILES = 13.5; // tiles visible across the shorter screen side

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.buf = makeCanvas(16, 16);
    this.bctx = this.buf.getContext('2d');
    this.light = makeCanvas(16, 16);
    this.lctx = this.light.getContext('2d');
    this.scale = 3;
    this.world = null;
    this.land = null;
    this.particles = [];
    this.rain = [];
    this.shadows = [];
    this.gulls = [];
    this.flash = 0;
    this.time = 0;
    this.reducedMotion = false;
    this.texts = [];          // floating world texts
    this.titleScene = new TitleScene();
    this.titleT = 0;
    this.resize();
  }

  /** Fit the canvas to its CSS box using an integer pixel scale. */
  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const cssW = Math.max(1, rect.width), cssH = Math.max(1, rect.height);
    const devW = Math.round(cssW * dpr), devH = Math.round(cssH * dpr);
    const shortSide = Math.min(devW, devH);
    this.scale = Math.max(1, Math.floor(shortSide / (TILE * TARGET_TILES)));
    if (devW > devH * 1.25) this.scale = Math.max(1, Math.floor(devH / (TILE * 12)));
    this.canvas.width = devW; this.canvas.height = devH;
    this.dpr = dpr;
    this.viewW = Math.ceil(devW / this.scale);
    this.viewH = Math.ceil(devH / this.scale);
    this.buf.width = this.viewW; this.buf.height = this.viewH;
    this.light.width = this.viewW; this.light.height = this.viewH;
    this.ctx.imageSmoothingEnabled = false;
    this.bctx.imageSmoothingEnabled = false;
    this.rain = [];
  }

  /** CSS pixel -> buffer pixel. */
  cssToBuffer(x, y) { return { x: (x * this.dpr) / this.scale, y: (y * this.dpr) / this.scale }; }

  // ------------------------------------------------------------ static layers
  setWorld(world) {
    this.world = world;
    this.buildLand();
    this.spawnShadows();
    this.particles.length = 0;
  }

  buildLand() {
    const w = this.world, th = w.def.theme, ts = tiles();
    const land = makeCanvas(w.pxW, w.pxH);
    const g = land.getContext('2d');
    const pick = (arr, x, y) => arr[(((x * 73856093) ^ (y * 19349663)) >>> 0) % arr.length];
    const groundSet = t => {
      if (t === T.G) {
        const season = w.def.seasonal ? seasonNow() : 'spring';
        return (season !== 'spring' && ts['grass_' + season]) || ts[th.grass] || ts.grass;
      }
      if (t === T.S) return ts[th.sand] || ts.sand;
      if (t === T.K) return ts.darkgrass;
      if (t === T.M) return ts.mud;
      if (t === T.N) return ts.moongrass;
      if (t === T.P) return ts.path;
      return null;
    };
    const underSand = ts[th.sand] || ts.sand;
    // water style per tile (distance from land)
    const dist = new Uint8Array(w.w * w.h).fill(9);
    const q = [];
    for (let y = 0; y < w.h; y++) for (let x = 0; x < w.w; x++) {
      const t = w.tile(x, y);
      if (!WATERY.has(t) && t !== T.D && t !== T.B && t !== T.X) { dist[y * w.w + x] = 0; q.push(x, y); }
    }
    for (let h = 0; h < q.length; h += 2) {
      const x = q[h], y = q[h + 1], d = dist[y * w.w + x];
      if (d >= 5) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w.w || ny >= w.h) continue;
        const k = ny * w.w + nx;
        if (dist[k] > d + 1) { dist[k] = d + 1; q.push(nx, ny); }
      }
    }
    this.waterStyle = new Array(w.w * w.h);
    this.waterVar = new Uint8Array(w.w * w.h);
    this.foam = [];
    for (let y = 0; y < w.h; y++) for (let x = 0; x < w.w; x++) {
      const k = y * w.w + x, t = w.terrain[k];
      this.waterVar[k] = (x * 7 + y * 13) % 4;
      if (t === T.H) this.waterStyle[k] = 'wade';
      else if (t === T.O) this.waterStyle[k] = th.pond;
      else if (t === T.R) this.waterStyle[k] = th.reef;
      else {
        const d = dist[k];
        this.waterStyle[k] = d <= 1 ? th.shallow : d <= 3 ? th.near : th.deep;
      }
      if (WATERY.has(t) || t === T.H) {
        // Shallows count as water here, so surf breaks on sand, not between depths.
        const landAt = (xx, yy) => { const tt = w.tile(xx, yy); return !WATERY.has(tt) && tt !== T.D && tt !== T.B && tt !== T.X && tt !== T.H; };
        if (landAt(x, y - 1)) this.foam.push(x, y, 0);
        if (landAt(x, y + 1)) this.foam.push(x, y, 1);
        if (landAt(x - 1, y)) this.foam.push(x, y, 2);
        if (landAt(x + 1, y)) this.foam.push(x, y, 3);
      }
    }

    // Checkerboard dither where two water depths meet, so bands blend softly.
    const dither = makeCanvas(w.pxW, w.pxH);
    const dg = dither.getContext('2d');
    for (let y = 0; y < w.h; y++) for (let x = 0; x < w.w; x++) {
      const k = y * w.w + x;
      const wet = i => WATERY.has(w.terrain[i]) || w.terrain[i] === T.H;
      if (!wet(k)) continue;
      const a = this.waterStyle[k];
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx >= w.w || ny >= w.h) continue;
        const nk = ny * w.w + nx;
        if (!wet(nk)) continue;
        const b = this.waterStyle[nk];
        if (a === b) continue;
        const ca = WATER_STYLES[a][0], cb = WATER_STYLES[b][0];
        for (let i = 0; i < 16; i++) {
          for (let d = 0; d < 3; d++) {
            if ((i + d) % 2) continue;
            if (dx) { dg.fillStyle = d === 2 ? ca : cb; dg.fillRect(nx * TILE - 2 + d, y * TILE + i, 1, 1); }
            else { dg.fillStyle = d === 2 ? ca : cb; dg.fillRect(x * TILE + i, ny * TILE - 2 + d, 1, 1); }
          }
        }
      }
    }
    this.dither = dither;

    for (let y = 0; y < w.h; y++) for (let x = 0; x < w.w; x++) {
      const t = w.tile(x, y), px = x * TILE, py = y * TILE;
      if (WATERY.has(t)) continue;
      if (t === T.H) {
        // Wadeable shallows: a faint sandy bottom showing through the water.
        g.globalAlpha = 0.28;
        g.drawImage(pick(underSand, x, y), px, py);
        g.globalAlpha = 1;
        continue;
      }
      if (t === T.D) {
        g.drawImage(pick(ts.dock, x, y), px, py);
        if (WATERY.has(w.tile(x, y + 1))) {
          g.fillStyle = C.wood3; g.fillRect(px, py + 14, 16, 2);
          g.fillStyle = 'rgba(20,60,80,0.35)'; g.fillRect(px, py + 16, 16, 3);
          g.fillStyle = C.wood2; g.fillRect(px + 2, py + 14, 2, 5); g.fillRect(px + 12, py + 14, 2, 5);
        }
        continue;
      }
      if (t === T.B || t === T.X) {
        g.drawImage(t === T.B ? ts.bridge[0] : ts.bridgeBroken[0], px, py);
        continue;
      }
      if (t === T.I) {
        g.drawImage(pick(ts.floor, x, y), px, py);
        // soft shadow along the walls
        g.fillStyle = 'rgba(60,30,20,0.25)';
        if (w.tile(x, y - 1) === T.L) g.fillRect(px, py, 16, 3);
        if (w.tile(x - 1, y) === T.L) g.fillRect(px, py, 2, 16);
        if (w.tile(x + 1, y) === T.L) g.fillRect(px + 14, py, 2, 16);
        continue;
      }
      if (t === T.C) {
        g.drawImage(pick(ts.cave, x, y), px, py);
        g.fillStyle = 'rgba(10,6,16,0.35)';
        if (w.tile(x, y - 1) === T.V) g.fillRect(px, py, 16, 4);
        if (w.tile(x - 1, y) === T.V) g.fillRect(px, py, 3, 16);
        if (w.tile(x + 1, y) === T.V) g.fillRect(px + 13, py, 3, 16);
        continue;
      }
      if (t === T.V) {
        g.drawImage(w.tile(x, y + 1) === T.C ? ts.caveFace[0] : pick(ts.caveTop, x, y), px, py);
        continue;
      }
      if (t === T.L) {
        // Only the back wall is drawn; walls at the sides and below are dark.
        const below = w.tile(x, y + 1), below2 = w.tile(x, y + 2);
        if (below === T.I && y > 0) g.drawImage(ts.wallLower[0], px, py);
        else if (below === T.L && below2 === T.I) g.drawImage(ts.wallUpper[(x * 5 + y) % 4 === 1 ? 1 : (x * 3) % 7 === 2 ? 2 : 0], px, py);
        else if (w.tile(x, y - 1) === T.I || w.tile(x - 1, y) === T.I || w.tile(x + 1, y) === T.I) { g.fillStyle = '#5a3a2a'; g.fillRect(px, py, 16, 16); g.fillStyle = '#744631'; g.fillRect(px, py, 16, 2); }
        continue;
      }
      const set = groundSet(t);
      const isGrass = GRASSY.has(t);
      const nb = (dx, dy) => w.tile(x + dx, y + dy);
      if (isGrass || t === T.P) g.drawImage(pick(underSand, x, y), px, py);
      g.drawImage(pick(set, x, y), px, py);
      if (isGrass) {
        const notG = (dx, dy) => !GRASSY.has(nb(dx, dy));
        const under = (cx, cy) => { g.drawImage(pick(underSand, x, y), cx, cy, 2, 2, px + cx, py + cy, 2, 2); };
        // rounded corners
        if (notG(0, -1) && notG(-1, 0)) { g.clearRect(px, py, 2, 1); g.clearRect(px, py, 1, 2); under(0, 0); g.fillStyle = C.grass3; g.fillRect(px + 1, py + 1, 1, 1); }
        if (notG(0, -1) && notG(1, 0)) { g.clearRect(px + 14, py, 2, 1); g.clearRect(px + 15, py, 1, 2); under(14, 0); }
        if (notG(0, 1) && notG(-1, 0)) { g.clearRect(px, py + 14, 1, 2); g.clearRect(px, py + 15, 2, 1); under(0, 14); }
        if (notG(0, 1) && notG(1, 0)) { g.clearRect(px + 15, py + 14, 1, 2); g.clearRect(px + 14, py + 15, 2, 1); under(14, 14); }
        const lip = t === T.N ? '#5f8f70' : t === T.K ? C.forest2 : C.grass3;
        if (notG(0, 1)) { g.fillStyle = lip; g.fillRect(px + (notG(-1, 0) ? 1 : 0), py + 14, 16 - (notG(-1, 0) ? 1 : 0) - (notG(1, 0) ? 1 : 0), 2); }
        g.fillStyle = lip;
        if (notG(-1, 0)) g.fillRect(px, py + 1, 1, 13);
        if (notG(1, 0)) g.fillRect(px + 15, py + 1, 1, 13);
        if (notG(0, -1)) { g.fillStyle = t === T.N ? '#b4dcc0' : C.mint; g.fillRect(px + 1, py, 14, 1); }
      } else if (t === T.S || t === T.M) {
        g.fillStyle = t === T.M ? C.mud2 : C.wetsand;
        const wet = (dx, dy) => WATERY.has(nb(dx, dy)) || nb(dx, dy) === T.H;
        if (wet(0, 1)) g.fillRect(px, py + 13, 16, 3);
        if (wet(0, -1)) g.fillRect(px, py, 16, 2);
        if (wet(-1, 0)) g.fillRect(px, py, 2, 16);
        if (wet(1, 0)) g.fillRect(px + 14, py, 2, 16);
      } else if (t === T.P) {
        g.fillStyle = C.path2;
        if (GRASSY.has(nb(0, -1))) g.fillRect(px, py, 16, 1);
        if (GRASSY.has(nb(-1, 0))) g.fillRect(px, py, 1, 16);
        if (GRASSY.has(nb(1, 0))) g.fillRect(px + 15, py, 1, 16);
      }
    }
    this.land = land;
  }

  spawnShadows() {
    this.shadows = [];
    const w = this.world;
    for (let i = 0; i < 14; i++) {
      for (let tries = 0; tries < 40; tries++) {
        const x = Math.floor(Math.random() * w.w), y = Math.floor(Math.random() * w.h);
        if (!w.isWater(x, y)) continue;
        this.shadows.push({ x: x * TILE + 8, y: y * TILE + 8, a: Math.random() * 6.28, s: 6 + Math.random() * 8, size: Math.random() < 0.3 ? 2 : 1 });
        break;
      }
    }
  }

  // ------------------------------------------------------------ particles
  emit(type, x, y, n = 6, opts = {}) {
    if (this.reducedMotion && type !== 'coin') n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) {
      const a = opts.angle ?? (-Math.PI / 2 + (Math.random() - 0.5) * 2.2);
      const sp = (opts.speed ?? 40) * (0.5 + Math.random());
      this.particles.push({
        type, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: (opts.life ?? 0.8) * (0.7 + Math.random() * 0.6),
        color: opts.color || (type === 'splash' ? C.foam : type === 'leaf' ? C.grass3 : type === 'coin' ? C.gold : C.yellow),
        g: opts.gravity ?? (type === 'leaf' ? 10 : 120),
      });
    }
    if (this.particles.length > 400) this.particles.splice(0, this.particles.length - 400);
  }

  floatText(text, x, y, color = '#fff5df') {
    this.texts.push({ text, x, y, life: 0, max: 1.4, color });
  }

  // ------------------------------------------------------------ frame
  /**
   * scene = { camera, player, playerSprite, world, state, fishing, build, interactTarget,
   *           phase, weather, settings, title, stick, hiddenSpotsVisible }
   */
  render(scene, dt) {
    this.time += dt;
    const t = this.time;
    const ctx = this.bctx, cam = scene.camera, w = this.world;
    this.reducedMotion = !!scene.settings?.reducedMotion;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    const indoor = !!this.world?.def.interior && !scene.title;
    ctx.fillStyle = indoor ? '#2c2433' : '#1d6878';
    ctx.fillRect(0, 0, this.viewW, this.viewH);
    if (scene.title) {
      // Title screen: sunset diorama, fading in from night on first show.
      this.titleT += dt;
      this.titleScene.render(ctx, this.viewW, this.viewH, this.time, this.reducedMotion);
      const a = this.reducedMotion ? 0 : Math.max(0, 1 - this.titleT / 1.1);
      if (a > 0) { ctx.fillStyle = `rgba(20,22,48,${a})`; ctx.fillRect(0, 0, this.viewW, this.viewH); }
      this.present(scene);
      return;
    }
    this.titleT = 0;
    if (!w) { this.present(scene); return; }

    // Areas: only the current part of the map is drawn (see World.setArea).
    const B = w.bounds || { x: 0, y: 0, w: w.w, h: w.h, px: 0, py: 0, pw: w.pxW, ph: w.pxH };
    const inB = (px, py) => px >= B.px && py >= B.py && px < B.px + B.pw && py < B.py + B.ph;
    const x0 = Math.max(B.x, Math.floor(cam.x / TILE) - 1), y0 = Math.max(B.y, Math.floor(cam.y / TILE) - 1);
    const x1 = Math.min(B.x + B.w - 1, Math.ceil((cam.x + this.viewW) / TILE)), y1 = Math.min(B.y + B.h - 1, Math.ceil((cam.y + this.viewH) / TILE));
    const water = tiles().water;
    const wf = this.reducedMotion ? 0 : Math.floor(t * 4);
    // 1. water (also beyond the map edge)
    if (!indoor) for (let y = Math.floor(cam.y / TILE) - 1; y <= Math.ceil((cam.y + this.viewH) / TILE); y++) {
      for (let x = Math.floor(cam.x / TILE) - 1; x <= Math.ceil((cam.x + this.viewW) / TILE); x++) {
        let style, v;
        if (x < B.x || y < B.y || x >= B.x + B.w || y >= B.y + B.h) { style = w.def.theme.deep; v = (((x * 7 + y * 13) % 4) + 4) % 4; }
        else {
          const k = y * w.w + x;
          if (!WATERY.has(w.terrain[k]) && w.terrain[k] !== T.X && w.terrain[k] !== T.D && w.terrain[k] !== T.B && w.terrain[k] !== T.H) continue;
          style = this.waterStyle[k]; v = this.waterVar[k];
        }
        ctx.drawImage(water[style][v][(wf + v * 2) % WATER_FRAMES], x * TILE - cam.x, y * TILE - cam.y);
      }
    }
    {
      const sx = Math.max(B.px, cam.x), sy = Math.max(B.py, cam.y);
      const sw = Math.min(B.px + B.pw, cam.x + this.viewW) - sx, sh = Math.min(B.py + B.ph, cam.y + this.viewH) - sy;
      if (sw > 0 && sh > 0) ctx.drawImage(this.dither, sx, sy, sw, sh, sx - cam.x, sy - cam.y, sw, sh);
    }
    // 2. fish shadows under water
    ctx.fillStyle = 'rgba(16,48,64,0.28)';
    for (const s of this.shadows) {
      if (!this.reducedMotion) {
        s.a += (Math.sin(t * 0.7 + s.s) * 0.6) * dt;
        const nx = s.x + Math.cos(s.a) * s.s * dt, ny = s.y + Math.sin(s.a) * s.s * dt;
        if (w.isWater(Math.floor(nx / TILE), Math.floor(ny / TILE))) { s.x = nx; s.y = ny; } else s.a += Math.PI * 0.7;
      }
      const sx = Math.round(s.x - cam.x), sy = Math.round(s.y - cam.y);
      if (sx < -10 || sy < -10 || sx > this.viewW + 10 || sy > this.viewH + 10 || !inB(s.x, s.y)) continue;
      const len = 3 + s.size * 2;
      const dx = Math.cos(s.a), dy = Math.sin(s.a);
      for (let i = -len; i <= len; i++) ctx.fillRect(sx + Math.round(dx * i), sy + Math.round(dy * i * 0.6), 2, s.size + 1);
    }
    // 3. foam lapping on the shore
    if (!indoor) this.drawFoam(ctx, cam, t, x0, y0, x1, y1);
    // 4. land layer
    {
      // Clip the source rect manually: the camera may show sea beyond the map.
      const sx = Math.max(B.px, cam.x), sy = Math.max(B.py, cam.y);
      const sw = Math.min(B.px + B.pw, cam.x + this.viewW) - sx, sh = Math.min(B.py + B.ph, cam.y + this.viewH) - sy;
      if (sw > 0 && sh > 0) ctx.drawImage(this.land, sx, sy, sw, sh, sx - cam.x, sy - cam.y, sw, sh);
    }

    // 5. ground decals + y-sorted sprites
    const night = scene.light ? scene.light.dark > 0.35 : false;
    const drawList = [];
    const inView = (px, py, m = 64) => px > cam.x - m && py > cam.y - m && px < cam.x + this.viewW + m && py < cam.y + this.viewH + m + 40;
    // tilled soil (darker when watered) and the crops growing in it
    const soil = w.islandState?.farm?.soil;
    if (soil) for (const [k, plot] of Object.entries(soil)) {
      const [tx, ty] = k.split(',').map(Number);
      const px = tx * TILE, py = ty * TILE;
      if (!inView(px, py, 20) || !inB(px + 1, py + 1)) continue;
      const sx = px - cam.x, sy = py - cam.y;
      ctx.fillStyle = plot.water ? '#5a3f2e' : '#8a6a48';
      ctx.fillRect(sx + 1, sy + 1, 14, 14);
      ctx.fillStyle = plot.water ? '#4a3224' : '#76583c';
      for (let r = 4; r < 15; r += 4) ctx.fillRect(sx + 2, sy + r, 12, 1);
      ctx.fillStyle = plot.water ? '#6d4e3a' : '#a07c56';
      ctx.fillRect(sx + 1, sy + 1, 14, 1);
      if (plot.crop) {
        const spr = sprite(`crop_${plot.crop}_${cropStage(plot)}`);
        if (spr) drawList.push({ y: py + 14, spr, x: px + 8, by: py + 14, crop: plot });
      }
    }
    // the tile your farming tool will hit
    if (scene.target) {
      const tx = scene.target.x * TILE - cam.x, ty = scene.target.y * TILE - cam.y;
      ctx.fillStyle = 'rgba(255,245,223,0.75)';
      ctx.fillRect(tx, ty, 4, 1); ctx.fillRect(tx, ty, 1, 4); ctx.fillRect(tx + 12, ty, 4, 1); ctx.fillRect(tx + 15, ty, 1, 4);
      ctx.fillRect(tx, ty + 15, 4, 1); ctx.fillRect(tx, ty + 12, 1, 4); ctx.fillRect(tx + 12, ty + 15, 4, 1); ctx.fillRect(tx + 15, ty + 12, 1, 4);
    }
    this.marks = [];
    for (const o of w.objects) {
      if (!inView(o.x * TILE, o.y * TILE) || !inB(o.x * TILE + 1, o.y * TILE + 1)) continue;
      if (w.objectHidden(o)) continue;
      const spr = this.objectSprite(o, t, night, w);
      if (!spr) continue;
      const fp = o.def.footprint || { w: 1, h: 1 };
      const baseX = o.x * TILE + (fp.w * TILE) / 2, baseY = (o.y + fp.h) * TILE;
      if (o.type === 'debris_tree') {
        const tap = w.islandState.farm?.taps?.[o.id];
        if (tap) {
          const full = (scene.state?.world.day || 0) - tap.day >= 3;
          const b = sprite(full ? 'tapper_bucket_full' : 'tapper_bucket');
          drawList.push({ y: baseY + 0.5, spr: b, x: baseX + 4, by: baseY - 1 });
          if (full) this.twinkle(ctx, baseX + 4 - cam.x, baseY - 12 - cam.y, o.x);
        }
      }
      if (FLOOR_OBJECTS.has(o.type)) {
        ctx.drawImage(spr, Math.round(o.x * TILE - cam.x), Math.round(baseY - spr.height - cam.y));
      } else if (FLAT_OBJECTS.has(o.type)) {
        ctx.drawImage(spr, Math.round(baseX - spr.width / 2 - cam.x), Math.round(baseY - 8 - spr.height / 2 - cam.y));
        if (o.def.resource && w.nodeReady(o)) this.twinkle(ctx, baseX - cam.x, baseY - 12 - cam.y, o.x + o.y);
      } else {
        drawList.push({ y: baseY, spr, x: baseX, o, by: baseY + (o.type === 'boat' ? 4 : 0) });
      }
    }
    for (const p of w.placed) {
      if (!inView(p.x * TILE, p.y * TILE, 100) || !inB(p.x * TILE + 1, p.y * TILE + 1)) continue;
      if (scene.build && scene.build.moving && scene.build.moving.uid === p.uid) continue;
      const spr = this.placementSprite(p, night, scene.state);
      if (!spr) continue;
      const baseX = p.x * TILE + (p.fw * TILE) / 2, baseY = (p.y + p.fh) * TILE;
      if (p.def.flat) ctx.drawImage(spr, Math.round(baseX - spr.width / 2 - cam.x), Math.round(baseY - spr.height + (p.type === 'small_pond' ? 0 : 1) - cam.y));
      else drawList.push({ y: baseY, spr, x: baseX, by: baseY + 1 });
      // machines show when they're busy or done
      const job = (p.def.use === 'machine' || p.def.use === 'furnace') && scene.state?.islands[scene.state.player.island]?.machines?.[p.uid];
      if (job) this.marks.push({ x: baseX, y: baseY - spr.height - 2, ready: machineReady(job), out: job.output });
    }
    // fishing spot markers
    if (!scene.title) for (const s of w.spots) {
      if (s.hidden && !scene.hiddenSpotsVisible?.has(s.id)) continue;
      const wx = s.waterX * TILE + 8, wy = s.waterY * TILE + 8;
      if (!inView(wx, wy) || !inB(s.x * TILE + 8, s.y * TILE + 8)) continue;
      const f = this.reducedMotion ? 1 : Math.floor((t * 2 + s.x) % 4);
      ctx.globalAlpha = 0.75;
      ctx.drawImage(sprite('ripple_' + f), Math.round(wx - 10 - cam.x), Math.round(wy - 5 - cam.y));
      ctx.globalAlpha = 1;
    }
    for (const n of w.npcs) {
      if (!inB(n.x, n.y - 2)) continue;
      const set = sprite('npc_' + n.id);
      const frames = set[n.dir] || set.down;
      const spr = n.moving ? frames[Math.floor(n.anim) % 4] : frames[0];
      drawList.push({ y: n.y, spr, x: n.x, by: n.y + 1, npc: n });
    }
    this.nameTags = [];
    for (const r of scene.remotes || []) {
      if (!r.sprites || !inB(r.x, r.y - 2)) continue;   // friends in another area aren't shown
      const frames = r.sprites[r.f] || r.sprites.down;
      const spr = r.moving ? frames[Math.floor(r.anim) % 4] : frames[0];
      drawList.push({ y: r.y, spr, x: r.x, by: r.y + 1, remote: true });
      this.nameTags.push({ text: r.name || 'Islander', x: r.x, y: r.y - spr.height - 1, host: r.host });
    }
    for (const c of w.critters || []) {
      const spr = sprite(`critter_${ANIMALS[c.a.kind]?.sprite || 'chicken'}_${c.moving ? Math.floor(c.anim) % 2 : 0}`);
      if (spr) drawList.push({ y: c.y, spr, x: c.x, by: c.y + 1, flip: c.dir === 'left' });
      if (c.a.ready && !this.reducedMotion) this.twinkle(ctx, c.x - cam.x, c.y - 16 - cam.y, c.x);
    }
    for (const m of w.monsters) {
      if (m.dead || !inView(m.x, m.y)) continue;
      const md = MONSTERS[m.type] || {};
      const spr = sprite(`mon_${md.sprite || m.type}_${Math.floor(m.anim) % 2}`);
      if (spr) drawList.push({ y: m.y, spr, x: m.x, by: m.y + (md.flies ? -6 : 1), monster: m, scale: md.scale || 1 });
    }
    if (scene.player && !scene.title) {
      const p = scene.player;
      const wading = w.tile(Math.floor(p.x / TILE), Math.floor((p.y - 2) / TILE)) === T.H;
      drawList.push({ y: p.y, spr: p.frame(scene.playerSprite), x: p.x, by: p.y + 1, player: true, wading });
    }
    // falling trees (see fallTree)
    this.falls = (this.falls || []).filter(f => (f.t += dt) < f.dur);
    for (const f of this.falls) {
      drawList.push({ y: f.y, by: f.y, x: f.x, spr: f.spr, fall: f });
      if (!f.landed && f.t > f.dur * 0.6) {
        f.landed = true;
        // leaves and dust where the crown hits the ground
        const lx = f.x + f.dir * f.spr.height * 0.7;
        this.emit('leaf', lx, f.y - 4, 14, { speed: 55, gravity: 40, life: 1, color: f.leaf });
        this.emit('sparkle', lx, f.y - 2, 6, { speed: 40, gravity: 80, life: 0.5, color: '#d8c8a0' });
      }
    }
    if (scene.festival && w.id === 'sunny' && !indoor) {
      // the town square dressed up (around the quest board at 48,30)
      const T0 = TILE;
      for (let x = 42; x <= 54; x++) drawList.push({ y: 27 * T0, spr: sprite('fest_bunting_' + (x % 3)), x: x * T0 + 8, by: 27 * T0 - 14 });
      for (const [x, y, id] of [[42, 27, 'fest_lantern'], [55, 27, 'fest_lantern'], [42, 34, 'fest_lantern'], [55, 34, 'fest_lantern'], [43, 30, 'fest_stall_a'], [53, 30, 'fest_stall_b']]) {
        const spr = sprite(id); if (spr) drawList.push({ y: y * T0, spr, x: x * T0 + 8, by: y * T0 });
      }
      if (scene.festival === 'flower_fair' && !this.reducedMotion && Math.random() < 0.08) this.emit('leaf', (42 + Math.random() * 13) * T0, 27 * T0, 1, { speed: 12, gravity: 8, life: 3, color: ['#f7c6d4', '#f2d27e', '#fff5df'][Math.floor(Math.random() * 3)] });
    }
    drawList.sort((a, b) => a.y - b.y);
    for (const d of drawList) {
      let bob = 0;
      if ((d.player && !scene.player.moving) || (d.npc && !d.npc.moving)) bob = this.reducedMotion ? 0 : (Math.sin(t * 2.4 + (d.npc ? d.npc.homeX : 0)) > 0.6 ? 1 : 0);
      if (d.wading) {
        // Feet hidden under the water line, with a little ring of ripples.
        const sx = Math.round(d.x - d.spr.width / 2 - cam.x), sy = Math.round(d.by - d.spr.height - cam.y + 2 + bob);
        const cut = 5;
        ctx.drawImage(d.spr, 0, 0, d.spr.width, d.spr.height - cut, sx, sy, d.spr.width, d.spr.height - cut);
        const rf = this.reducedMotion ? 1 : Math.floor((t * 3) % 4);
        ctx.globalAlpha = 0.8;
        ctx.drawImage(sprite('ripple_' + rf), Math.round(d.x - 10 - cam.x), Math.round(d.by - 7 - cam.y));
        ctx.globalAlpha = 1;
        continue;
      }
      if (d.monster) {
        const m = d.monster;
        ctx.fillStyle = 'rgba(10,6,16,0.35)';
        ctx.fillRect(Math.round(d.x - 5 - cam.x), Math.round(m.y - 1 - cam.y), 10, 2);
        if (m.flash > 0 && Math.floor(t * 30) % 2) ctx.globalAlpha = 0.35;
        const sc = d.scale || 1, sw = d.spr.width * sc, sh = d.spr.height * sc;
        ctx.drawImage(d.spr, Math.round(d.x - sw / 2 - cam.x), Math.round(d.by - sh - cam.y), sw, sh);
        ctx.globalAlpha = 1;
        if (m.maxHp && (m.hp < m.maxHp || sc > 1)) {
          const bw = sc > 1 ? 40 : 16;
          const bx = Math.round(d.x - bw / 2 - cam.x), by = Math.round(d.by - sh - 5 - cam.y);
          ctx.fillStyle = C.ink; ctx.fillRect(bx - 1, by - 1, bw + 2, 4);
          ctx.fillStyle = sc > 1 ? '#b27be0' : '#e05a5a'; ctx.fillRect(bx, by, Math.max(0, Math.round(bw * m.hp / m.maxHp)), 2);
        }
        continue;
      }
      if (d.fall) {
        // a felled tree tipping over from its base, then fading out
        const f = d.fall, u = Math.min(1, f.t / f.dur);
        const ang = f.dir * (Math.PI / 2) * u * u;
        ctx.save();
        ctx.globalAlpha = u > 0.75 ? 1 - (u - 0.75) / 0.25 : 1;
        ctx.translate(Math.round(f.x - cam.x), Math.round(f.y - cam.y));
        ctx.rotate(ang);
        ctx.drawImage(f.spr, -Math.round(f.spr.width / 2), -f.spr.height);
        ctx.restore();
        continue;
      }
      if (d.o && d.o.shake > 0) {
        // hit wiggle for trees, rocks and stumps
        const o = d.o;
        o.shake = Math.max(0, o.shake - dt * 4);
        const off = Math.round(Math.sin(t * 60) * 2 * o.shake * (o.shakeDir || 1));
        ctx.drawImage(d.spr, Math.round(d.x - d.spr.width / 2 - cam.x + off), Math.round(d.by - d.spr.height - cam.y));
        continue;
      }
      if (d.player && scene.player.invuln > 0 && Math.floor(t * 14) % 2) continue;
      if (d.player || d.npc || d.remote) {
        ctx.fillStyle = 'rgba(30,30,50,0.22)';
        ctx.fillRect(Math.round(d.x - 5 - cam.x), Math.round(d.by - 2 - cam.y), 10, 2);
        ctx.fillRect(Math.round(d.x - 4 - cam.x), Math.round(d.by - 3 - cam.y), 8, 1);
      }
      let lift = 0;
      if (d.player && scene.riding) {
        // on horseback: the horse first, you sitting on top
        const pl = scene.player, side = { right: 'r', left: 'l', up: 'u', down: 'd' }[pl.facing] || 'd';
        const hs = sprite(`horse_${side}_${pl.moving ? Math.floor(pl.anim * 1.5) % 2 : 0}`);
        if (hs) ctx.drawImage(hs, Math.round(d.x - hs.width / 2 - cam.x), Math.round(d.by - hs.height + 2 - cam.y));
        lift = side === 'u' || side === 'd' ? -7 : -9;
      }
      ctx.drawImage(d.spr, Math.round(d.x - d.spr.width / 2 - cam.x), Math.round(d.by - d.spr.height - cam.y + bob + lift + (d.player || d.npc || d.remote ? 2 : 0)));
      if (d.player && scene.riding && scene.player.facing === 'down') {
        const hd = sprite('horse_head_d');
        if (hd) ctx.drawImage(hd, Math.round(d.x - hd.width / 2 - cam.x), Math.round(d.by - hd.height - 4 - cam.y));
      }
      if (d.npc && scene.questGiver === d.npc.id) {
        const m = sprite('marker');
        const hop = this.reducedMotion ? 0 : Math.round(Math.abs(Math.sin(t * 3)) * 3);
        ctx.drawImage(m, Math.round(d.x - m.width / 2 - cam.x), Math.round(d.by - d.spr.height - 14 - hop - cam.y));
      }
    }
    // machine status bubbles: the finished product, or a little puff while working
    for (const m of this.marks) {
      const bx = Math.round(m.x - cam.x), by = Math.round(m.y - cam.y);
      if (m.ready) {
        const hop = this.reducedMotion ? 0 : Math.round(Math.abs(Math.sin(t * 3)) * 2);
        ctx.fillStyle = '#fff5df'; ctx.fillRect(bx - 8, by - 18 - hop, 16, 15);
        ctx.fillStyle = '#3a2e2a'; ctx.fillRect(bx - 8, by - 4 - hop, 16, 1); ctx.fillRect(bx - 1, by - 3 - hop, 2, 2);
        const ic = sprite('icon_' + (RESOURCES[m.out]?.icon || m.out));
        if (ic) ctx.drawImage(ic, bx - 6, by - 17 - hop, 12, 12);
      } else if (!this.reducedMotion) {
        const k = (t * 0.8 + m.x * 0.01) % 1;
        ctx.globalAlpha = 0.6 * (1 - k); ctx.fillStyle = '#e8e2d0';
        ctx.fillRect(bx - 2 + Math.round(Math.sin(k * 6) * 2), by - 4 - Math.round(k * 10), 3, 3);
        ctx.globalAlpha = 1;
      }
    }
    // tool swing
    if (scene.player?.swing) this.drawSwing(ctx, scene.player, cam);
    // 6. fishing line, bobber, jumping fish
    if (scene.fishing) this.drawFishing(ctx, scene, cam, t);
    // 7. particles
    this.drawParticles(ctx, cam, dt);
    // 8. build ghost
    if (scene.build) this.drawBuild(ctx, scene.build, cam, t);
    // 9. weather & lighting
    if (indoor) this.drawIndoorLight(ctx, scene, cam, t);
    else {
      this.drawWeather(ctx, scene, cam, dt, t);
      this.drawLighting(ctx, scene, cam, t);
    }
    if (w.def.fog) this.drawFog(ctx, t, cam);
    // Lantern Night: lanterns drift up over the sea, glowing on top of the night
    if (scene.lanterns && !indoor) {
      const age = (performance.now() - scene.lanterns.start) / 1000;
      const spr = sprite('sky_lantern');
      for (let i = 0; i < 26; i++) {
        const k = ((age * 0.04 + i * 0.137) % 1);
        const x = ((i * 97) % this.viewW) + Math.sin(age * 0.6 + i) * 10;
        const y = this.viewH * (1 - k) - 10;
        ctx.globalAlpha = Math.min(1, k * 4) * (1 - k * 0.6);
        const gl = ctx.createRadialGradient(x + 4, y + 5, 1, x + 4, y + 5, 14);
        gl.addColorStop(0, 'rgba(255,200,110,0.45)'); gl.addColorStop(1, 'rgba(255,170,80,0)');
        ctx.fillStyle = gl; ctx.fillRect(Math.round(x) - 10, Math.round(y) - 9, 28, 28);
        if (spr) ctx.drawImage(spr, Math.round(x), Math.round(y));
      }
      ctx.globalAlpha = 1;
    }
    if (this.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${this.flash})`; ctx.fillRect(0, 0, this.viewW, this.viewH); this.flash = Math.max(0, this.flash - dt * 2.5); }
    // interaction marker
    if (scene.interactTarget && !scene.title && !scene.fishing?.active) {
      const it = scene.interactTarget;
      const hop = this.reducedMotion ? 0 : Math.round(Math.sin(t * 5) * 2);
      const mx = Math.round(it.mx - cam.x), my = Math.round(it.my - cam.y + hop);
      ctx.fillStyle = C.ink; ctx.fillRect(mx - 4, my - 4, 9, 6); ctx.fillRect(mx - 2, my + 2, 5, 2); ctx.fillRect(mx - 1, my + 4, 3, 1);
      ctx.fillStyle = C.cream; ctx.fillRect(mx - 3, my - 3, 7, 4); ctx.fillRect(mx - 1, my + 1, 3, 2); ctx.fillRect(mx, my + 3, 1, 1);
    }
    this.present(scene);
  }

  twinkle(ctx, x, y, seed) {
    const ph = (this.time * 1.3 + seed * 0.37) % 3;
    if (ph < 0.5) ctx.drawImage(sprite('sparkle_' + (ph < 0.25 ? 0 : 1)), Math.round(x - 3 + ((seed * 5) % 7) - 3), Math.round(y - 3));
  }

  drawFoam(ctx, cam, t, x0, y0, x1, y1) {
    const f = this.foam;
    const anim = this.reducedMotion ? 0 : t;
    for (let i = 0; i < f.length; i += 3) {
      const x = f[i], y = f[i + 1], side = f[i + 2];
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      const px = x * TILE - cam.x, py = y * TILE - cam.y;
      const wave = Math.sin(anim * 1.6 + (x + y) * 0.9);
      const off = 1 + Math.round((wave + 1) * 1.2);
      for (let k = 0; k < 16; k += 1) {
        const on = Math.sin(anim * 2.2 + (x * 16 + y * 16 + k) * 0.45) > -0.35;
        const on2 = Math.sin(anim * 1.3 + (x * 16 + k) * 0.8 + y) > 0.55;
        ctx.fillStyle = 'rgba(233,251,244,0.95)';
        if (side === 0) { if (on) ctx.fillRect(px + k, py, 1, 1); ctx.fillStyle = 'rgba(233,251,244,0.55)'; if (on2) ctx.fillRect(px + k, py + off + 1, 1, 1); }
        else if (side === 1) { if (on) ctx.fillRect(px + k, py + 15, 1, 1); ctx.fillStyle = 'rgba(233,251,244,0.55)'; if (on2) ctx.fillRect(px + k, py + 14 - off, 1, 1); }
        else if (side === 2) { if (on) ctx.fillRect(px, py + k, 1, 1); ctx.fillStyle = 'rgba(233,251,244,0.55)'; if (on2) ctx.fillRect(px + off + 1, py + k, 1, 1); }
        else { if (on) ctx.fillRect(px + 15, py + k, 1, 1); ctx.fillStyle = 'rgba(233,251,244,0.55)'; if (on2) ctx.fillRect(px + 14 - off, py + k, 1, 1); }
      }
    }
  }

  objectSprite(o, t, night, w) {
    const sway = this.reducedMotion ? 1 : (Math.sin(t * 1.4 + o.x * 0.7 + o.y) > 0.55 ? 2 : Math.sin(t * 1.4 + o.x * 0.7 + o.y) < -0.55 ? 0 : 1);
    switch (o.type) {
      case 'palm': return sprite((o.variant % 2 ? 'palmb_' : 'palm_') + sway);
      case 'mangrove': return sprite('mangrove_' + sway);
      case 'bush': return sprite('bush_' + (o.variant % 3));
      case 'flowers': return sprite('flowers_' + (w.def.id === 'moon' ? 3 : o.variant % 3));
      case 'flowerbush': return sprite(w.nodeReady(o) ? 'flowerbush_ready' : 'flowerbush_empty');
      case 'boulder': return sprite(w.nodeReady(o) ? 'boulder' : 'rock');
      case 'tidepool': return sprite(w.nodeReady(o) ? 'tidepool' : 'tidepool_empty');
      case 'coral': return sprite('coral_' + (o.variant % 3));
      case 'lily': return sprite('lily_' + (o.variant % 2));
      case 'shop': return sprite(night ? 'shop_lit' : 'shop');
      case 'hall': return sprite(night ? 'hall_lit' : 'hall');
      case 'mine_entrance': return sprite(night ? 'mine_entrance_lit' : 'mine_entrance');
      case 'yard_fence': return sprite(o.vert ? 'fence_r1' : 'fence');
      case 'debris_tree': return sprite('debris_tree_' + seasonNow());
      case 'debris_weed': return sprite(`debris_weed_${seasonNow()}_${o.variant % 2}`);
      case 'debris_grass': {
        // tall grass sways a little in the breeze
        const sw = this.reducedMotion ? 1 : (Math.sin(t * 1.8 + o.x * 0.9 + o.y * 0.5) > 0.5 ? 2 : Math.sin(t * 1.8 + o.x * 0.9 + o.y * 0.5) < -0.5 ? 0 : 1);
        return sprite(`debris_grass_${seasonNow()}_${(o.variant % 2) * 3 + sw}`);
      }
      case 'mine_rock': return sprite('rock_' + (o.kind || 'stone'));
      case 'display_case': return this.caseSprite(o);
      case 'feed_trough': return sprite(this.troughFull ? 'feed_trough_full' : 'feed_trough');
      default: return sprite(o.type);
    }
  }

  /** A museum case with whatever was donated in that slot. */
  caseSprite(o) {
    const id = getState()?.museum?.donated?.[o.showIdx];
    if (!id) return sprite('display_case');
    this.cases = this.cases || new Map();
    let c = this.cases.get(id);
    if (!c) {
      const base = sprite('display_case');
      c = makeCanvas(base.width, base.height);
      const g = c.getContext('2d');
      g.drawImage(base, 0, 0);
      const art = hasSprite('fish_' + id) ? sprite('fish_' + id) : sprite('icon_' + ({ copper_ore: 'ore_copper', iron_ore: 'ore_iron', gold_ore: 'ore_gold' }[id] || id));
      if (art) { const s = Math.min(1, 11 / Math.max(art.width, art.height)); g.imageSmoothingEnabled = false; g.drawImage(art, Math.round(8 - art.width * s / 2), Math.round(8 - art.height * s / 2), Math.round(art.width * s), Math.round(art.height * s)); }
      this.cases.set(id, c);
    }
    return c;
  }

  placementSprite(p, night, state) {
    // Rowan's still building it: scaffolding over a faded outline
    if (p.buildDay && state && p.buildDay > state.world.day) {
      this.scaffolds = this.scaffolds || new Map();
      if (!this.scaffolds.has(p.type)) this.scaffolds.set(p.type, scaffold(sprite(p.type === 'crop_garden' ? 'crop_garden_3' : p.type)));
      return this.scaffolds.get(p.type);
    }
    let id = p.type;
    if (p.type === 'cottage' && state?.flags.kitchen && !state.member) id = 'cottage_big';
    if (p.rot === 1 && p.def.rotations) id += '_r1';
    if (p.type === 'crop_garden') {
      const isl = state?.islands[state.player.island];
      const last = isl?.gardens[p.uid] || 0;
      const per = p.def.produce.every;
      const stage = Math.min(3, Math.floor((Date.now() - last) / (per / 3)));
      id = 'crop_garden_' + Math.max(0, stage);
    }
    if (night && hasSprite(id + '_lit')) return sprite(id + '_lit');
    return sprite(id);
  }

  drawFishing(ctx, scene, cam, t) {
    const f = scene.fishing;
    if (!f.active) return;
    const p = scene.player;
    const dir = p.facing;
    const tip = rodTip(p);
    // rod
    const hand = { x: p.x + (dir === 'left' ? -3 : dir === 'right' ? 3 : 2), y: p.y - 10 };
    const bend = f.tension || 0;
    ctx.fillStyle = C.wood3;
    lineTo(ctx, hand.x - cam.x, hand.y - cam.y, tip.x - cam.x, tip.y - cam.y + Math.round(bend * 3));
    if (f.bobber) {
      const b = f.bobber;
      const bx = b.x - cam.x, by = b.y - b.z - cam.y;
      // fishing line with a little sag
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      const sx = tip.x - cam.x, sy = tip.y - cam.y + Math.round(bend * 3);
      const sag = f.phase === 'reel' ? 1 : 6;
      let lx = sx, ly = sy;
      for (let i = 1; i <= 14; i++) {
        const u = i / 14;
        const x = sx + (bx - sx) * u, y = sy + (by - sy) * u + Math.sin(u * Math.PI) * sag;
        lineTo(ctx, lx, ly, x, y); lx = x; ly = y;
      }
      if (b.inWater) {
        const rf = Math.floor((t * 3) % 4);
        ctx.globalAlpha = 0.6; ctx.drawImage(sprite('ripple_' + rf), Math.round(bx - 10), Math.round(by - 1)); ctx.globalAlpha = 1;
      }
      const bob = sprite('bobber');
      ctx.drawImage(bob, Math.round(bx - 4), Math.round(by - 8 + (b.dip || 0)));
      if (f.phase === 'bite') {
        const s = Math.floor(t * 8) % 2;
        ctx.fillStyle = C.ink; ctx.fillRect(Math.round(bx - 2), Math.round(by - 24), 5, 11);
        ctx.fillStyle = s ? C.yellow : C.white; ctx.fillRect(Math.round(bx - 1), Math.round(by - 23), 3, 6); ctx.fillRect(Math.round(bx - 1), Math.round(by - 16), 3, 2);
      }
    }
    if (f.jump) {
      const j = f.jump, u = Math.min(1, j.t / j.dur);
      const x = j.x0 + (j.x1 - j.x0) * u, y = j.y0 + (j.y1 - j.y0) * u - Math.sin(u * Math.PI) * 26;
      const spr = sprite(j.sprite);
      if (spr) ctx.drawImage(spr, Math.round(x - spr.width / 2 - cam.x), Math.round(y - spr.height / 2 - cam.y));
    }
  }

  drawParticles(ctx, cam, dt) {
    const ps = this.particles;
    let n = 0;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      p.life += dt;
      if (p.life >= p.max) continue;
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.type === 'leaf') p.vx += Math.sin(this.time * 3 + i) * 8 * dt;
      ps[n++] = p;
      const a = 1 - p.life / p.max;
      ctx.globalAlpha = Math.min(1, a * 1.5);
      ctx.fillStyle = p.color;
      const sx = Math.round(p.x - cam.x), sy = Math.round(p.y - cam.y);
      if (p.type === 'coin') { ctx.fillRect(sx - 1, sy - 1, 3, 3); ctx.fillStyle = C.yellow; ctx.fillRect(sx - 1, sy - 1, 1, 1); }
      else if (p.type === 'sparkle') { ctx.fillRect(sx, sy - 1, 1, 3); ctx.fillRect(sx - 1, sy, 3, 1); }
      else ctx.fillRect(sx, sy, p.type === 'splash' ? 1 : 2, p.type === 'splash' ? 2 : 1);
    }
    ps.length = n;
    ctx.globalAlpha = 1;
  }

  drawBuild(ctx, b, cam, t) {
    if (!b.ghost) return;
    const g = b.ghost;
    const pulse = 0.35 + Math.sin(t * 5) * 0.1;
    // tile grid near the ghost
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    for (let y = g.y - 3; y < g.y + g.fh + 3; y++) for (let x = g.x - 3; x < g.x + g.fw + 3; x++) {
      ctx.fillRect(x * TILE - cam.x, y * TILE - cam.y, TILE, 1);
      ctx.fillRect(x * TILE - cam.x, y * TILE - cam.y, 1, TILE);
    }
    ctx.fillStyle = g.ok ? `rgba(110,220,120,${pulse})` : `rgba(240,90,90,${pulse})`;
    for (let y = 0; y < g.fh; y++) for (let x = 0; x < g.fw; x++) {
      const bad = g.badTiles && g.badTiles.has((g.x + x) + ',' + (g.y + y));
      if (bad) ctx.fillStyle = `rgba(240,90,90,${pulse + 0.15})`;
      else ctx.fillStyle = g.ok ? `rgba(110,220,120,${pulse})` : `rgba(240,200,90,${pulse})`;
      ctx.fillRect((g.x + x) * TILE - cam.x + 1, (g.y + y) * TILE - cam.y + 1, TILE - 2, TILE - 2);
    }
    const spr = g.sprite;
    if (spr) {
      ctx.globalAlpha = 0.72;
      const baseX = g.x * TILE + (g.fw * TILE) / 2, baseY = (g.y + g.fh) * TILE;
      ctx.drawImage(spr, Math.round(baseX - spr.width / 2 - cam.x), Math.round(baseY - spr.height + 1 - cam.y));
      ctx.globalAlpha = 1;
    }
    // corner brackets
    ctx.fillStyle = g.ok ? C.white : C.red;
    const bx = g.x * TILE - cam.x, by = g.y * TILE - cam.y, bw = g.fw * TILE, bh = g.fh * TILE;
    for (const [cx, cy, sx, sy] of [[bx, by, 1, 1], [bx + bw - 1, by, -1, 1], [bx, by + bh - 1, 1, -1], [bx + bw - 1, by + bh - 1, -1, -1]]) {
      ctx.fillRect(cx, cy, 4 * sx, 1); ctx.fillRect(cx, cy, 1, 4 * sy);
    }
  }

  drawWeather(ctx, scene, cam, dt, t) {
    const weather = scene.weather;
    // drifting cloud shadows on fair days
    if (weather === 'sunny' && !this.world.def.alwaysNight) {
      ctx.fillStyle = 'rgba(30,50,70,0.07)';
      for (let i = 0; i < 3; i++) {
        const cx = ((t * (6 + i * 2) + i * 260) % (this.world.pxW + 300)) - 150 - cam.x;
        const cy = ((i * 211 + 90) % this.world.pxH) - cam.y;
        ellipseFill(ctx, cx, cy, 46, 18); ellipseFill(ctx, cx + 30, cy + 6, 30, 14);
      }
    }
    // seagulls
    {
      if (weather === 'sunny' && !(scene.light && scene.light.dark > 0.5) && Math.random() < dt * 0.06 && this.gulls.length < 2) {
        const fromLeft = Math.random() < 0.5;
        this.gulls.push({ x: fromLeft ? -20 : this.viewW + 20, y: 20 + Math.random() * this.viewH * 0.5, vx: (fromLeft ? 1 : -1) * (22 + Math.random() * 10), t: 0 });
      }
      for (const g of this.gulls) {
        g.x += g.vx * dt; g.t += dt;
        const spr = sprite('gull_' + (Math.floor(g.t * 4) % 2));
        ctx.save();
        if (g.vx < 0) { ctx.translate(Math.round(g.x), 0); ctx.scale(-1, 1); ctx.drawImage(spr, 0, Math.round(g.y + Math.sin(g.t * 2) * 3)); }
        else ctx.drawImage(spr, Math.round(g.x), Math.round(g.y + Math.sin(g.t * 2) * 3));
        ctx.restore();
      }
      this.gulls = this.gulls.filter(g => g.x > -40 && g.x < this.viewW + 40);
    }
    if (weather === 'snow') {
      ctx.fillStyle = 'rgba(220,235,255,0.10)';
      ctx.fillRect(0, 0, this.viewW, this.viewH);
      const target = Math.floor((this.viewW * this.viewH) / 520 * (this.reducedMotion ? 0.4 : 1));
      while (this.rain.length < target) this.rain.push({ x: Math.random() * this.viewW, y: Math.random() * this.viewH, s: 0.5 + Math.random() * 0.7, ph: Math.random() * 6 });
      if (this.rain.length > target) this.rain.length = target;
      for (const d of this.rain) {
        d.y += 22 * d.s * dt; d.x += Math.sin(t * 1.3 + d.ph) * 10 * dt;
        if (d.y > this.viewH) { d.y -= this.viewH + 4; d.x = Math.random() * this.viewW; }
        if (d.x < -2) d.x += this.viewW + 4; else if (d.x > this.viewW + 2) d.x -= this.viewW + 4;
        ctx.fillStyle = d.s > 0.9 ? 'rgba(255,255,255,0.95)' : 'rgba(240,248,255,0.7)';
        ctx.fillRect(Math.round(d.x), Math.round(d.y), d.s > 0.9 ? 2 : 1, d.s > 0.9 ? 2 : 1);
      }
    } else if (weather === 'rain' || weather === 'storm') {
      const storm = weather === 'storm';
      ctx.fillStyle = storm ? 'rgba(30,40,60,0.28)' : 'rgba(60,80,100,0.16)';
      ctx.fillRect(0, 0, this.viewW, this.viewH);
      const target = Math.floor((this.viewW * this.viewH) / (storm ? 260 : 480) * (this.reducedMotion ? 0.4 : 1));
      while (this.rain.length < target) this.rain.push({ x: Math.random() * this.viewW, y: Math.random() * this.viewH, s: 0.7 + Math.random() * 0.6 });
      if (this.rain.length > target) this.rain.length = target;
      const slant = storm ? 0.35 : 0.15;
      ctx.fillStyle = 'rgba(200,225,255,0.55)';
      for (const d of this.rain) {
        d.y += 190 * d.s * dt; d.x -= 190 * slant * d.s * dt;
        if (d.y > this.viewH) { d.y -= this.viewH + 6; d.x = Math.random() * (this.viewW + 40); }
        if (d.x < -4) d.x += this.viewW + 8;
        const x = Math.round(d.x), y = Math.round(d.y);
        ctx.fillRect(x, y, 1, 3);
        if (storm) ctx.fillRect(x - 1, y + 3, 1, 1);
      }
      if (storm && !this.reducedMotion && Math.random() < dt * 0.08) this.flash = 0.5;
    } else this.rain.length = 0;
  }

  drawLighting(ctx, scene, cam, t) {
    const L = scene.light;
    if (!L || L.a < 0.01) return;
    const lc = this.lctx;
    lc.globalCompositeOperation = 'source-over';
    lc.clearRect(0, 0, this.viewW, this.viewH);
    lc.fillStyle = `rgba(${L.r},${L.g},${L.b},${L.a})`;
    lc.fillRect(0, 0, this.viewW, this.viewH);
    const lights = [];
    if (L.dark > 0.15) {
      lc.globalCompositeOperation = 'destination-out';
      const w = this.world;
      for (const p of w.placed) for (const l of p.def.lights || []) {
        lights.push({ x: p.x * TILE + (p.fw * TILE) / 2 + l.x, y: (p.y + p.fh) * TILE + l.y, r: l.r });
      }
      for (const o of w.objects) {
        if (o.type === 'shop') lights.push({ x: o.x * TILE + 32, y: (o.y + 2) * TILE - 18, r: 22 });
        if (o.type === 'hall') lights.push({ x: o.x * TILE + 32, y: (o.y + 2) * TILE - 20, r: 24 });
        if (o.type === 'mine_entrance') { lights.push({ x: o.x * TILE + 24 - 19, y: (o.y + 2) * TILE - 22, r: 14 }); lights.push({ x: o.x * TILE + 24 + 17, y: (o.y + 2) * TILE - 22, r: 14 }); }
        if (o.type === 'crystal' && w.nodeReady(o)) lights.push({ x: o.x * TILE + 8, y: o.y * TILE + 6, r: 16 });
      }
      if (scene.player && !scene.title) lights.push({ x: scene.player.x, y: scene.player.y - 8, r: 26 });
      for (const l of lights) {
        const x = l.x - cam.x, y = l.y - cam.y;
        if (x < -l.r || y < -l.r || x > this.viewW + l.r || y > this.viewH + l.r) continue;
        const flick = this.reducedMotion ? 0 : Math.sin(t * 7 + l.x) * 0.6;
        for (const [rr, a] of [[1, 0.25], [0.72, 0.35], [0.45, 0.5]]) {
          lc.fillStyle = `rgba(0,0,0,${a * L.dark})`;
          lc.beginPath(); lc.arc(Math.round(x), Math.round(y), Math.max(2, Math.round(l.r * rr + flick)), 0, Math.PI * 2); lc.fill();
        }
      }
      lc.globalCompositeOperation = 'source-over';
    }
    ctx.drawImage(this.light, 0, 0);
    if (L.dark > 0.3) {
      // warm glow + fireflies
      ctx.globalCompositeOperation = 'lighter';
      for (const l of lights) {
        ctx.fillStyle = `rgba(255,190,90,${0.09 * L.dark})`;
        ctx.beginPath(); ctx.arc(Math.round(l.x - cam.x), Math.round(l.y - cam.y), Math.round(l.r * 0.5), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      if (!this.reducedMotion) {
        for (let i = 0; i < 14; i++) {
          const fx = ((i * 97.3 + Math.sin(t * 0.4 + i) * 30 + t * 4) % this.viewW + this.viewW) % this.viewW;
          const fy = ((i * 61.7 + Math.cos(t * 0.5 + i * 2) * 20) % this.viewH + this.viewH) % this.viewH;
          const on = Math.sin(t * 2 + i * 1.7) > 0.2;
          if (!on) continue;
          ctx.fillStyle = this.world.def.alwaysNight ? 'rgba(170,230,255,0.9)' : 'rgba(255,240,150,0.9)';
          ctx.fillRect(Math.round(fx), Math.round(fy), 1, 1);
          ctx.fillStyle = 'rgba(255,240,150,0.25)';
          ctx.fillRect(Math.round(fx) - 1, Math.round(fy), 3, 1); ctx.fillRect(Math.round(fx), Math.round(fy) - 1, 1, 3);
        }
      }
    }
    if (this.world.def.alwaysNight) {
      // glowing tide sparkles
      ctx.fillStyle = 'rgba(150,230,255,0.8)';
      for (let i = 0; i < 40; i++) {
        const sx = ((i * 131.7) % this.world.pxW), sy = ((i * 89.3) % this.world.pxH);
        if (!this.world.isWater(Math.floor(sx / TILE), Math.floor(sy / TILE))) continue;
        if (Math.sin(t * 1.5 + i * 2.3) < 0.4) continue;
        ctx.fillRect(Math.round(sx - cam.x), Math.round(sy - cam.y), 1, 1);
      }
    }
  }

  /** Play the "timber!" animation for a tree that was just chopped down. */
  fallTree(spr, x, y, dir = 1) {
    if (!spr) return;
    const season = seasonNow();
    const leaf = { spring: '#5fa070', summer: '#4f9a5a', fall: '#d9823f', winter: '#e8f0f4' }[season];
    (this.falls = this.falls || []).push({ spr, x, y, dir: dir || 1, t: 0, dur: this.reducedMotion ? 0.3 : 0.9, leaf });
  }

  /** The held pickaxe / sword sweeping in front of the player. */
  drawSwing(ctx, p, cam) {
    const sw = p.swing;
    const lvl = getState()?.inventory.tools?.[sw.tool] || 0;
    const spr = hasSprite(`icon_${sw.tool}_t${lvl}`) ? sprite(`icon_${sw.tool}_t${lvl}`) : sprite('icon_' + sw.tool);
    if (!spr) return;
    const u = Math.min(1, sw.t / sw.dur);
    const base = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[p.facing];
    const a = base - 1.1 + u * 2.2;
    const cx = p.x - cam.x, cy = p.y - 9 - cam.y;
    ctx.save();
    ctx.translate(Math.round(cx + Math.cos(a) * 9), Math.round(cy + Math.sin(a) * 9));
    ctx.rotate(a + Math.PI / 4);
    ctx.drawImage(spr, -9, -9);
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let k = 0; k < 6; k++) {
      const b = base - 1.1 + (u * 2.2) * (k / 5);
      ctx.fillRect(Math.round(cx + Math.cos(b) * 15), Math.round(cy + Math.sin(b) * 15), 1, 1);
    }
  }

  /** The mine is dark: you see around yourself and the glowing crystals. */
  drawMineLight(ctx, scene, cam) {
    const lc = this.lctx, w = this.world;
    lc.globalCompositeOperation = 'source-over';
    lc.clearRect(0, 0, this.viewW, this.viewH);
    lc.fillStyle = 'rgba(6,4,12,0.78)';
    lc.fillRect(0, 0, this.viewW, this.viewH);
    lc.globalCompositeOperation = 'destination-out';
    const lights = [];
    if (scene.player) lights.push([scene.player.x, scene.player.y - 8, 78]);
    for (const o of w.objects) if (o.type === 'cave_crystal') lights.push([o.x * TILE + 8, o.y * TILE + 8, 26]);
    for (const [x, y, r] of lights) {
      for (const [rr, a] of [[1, 0.3], [0.75, 0.4], [0.5, 0.6]]) {
        lc.fillStyle = `rgba(0,0,0,${a})`;
        lc.beginPath(); lc.arc(Math.round(x - cam.x), Math.round(y - cam.y), Math.round(r * rr), 0, Math.PI * 2); lc.fill();
      }
    }
    lc.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.light, 0, 0);
  }

  /** Indoors: no weather, just a warm lamp-lit glow (a touch dimmer at night). */
  drawIndoorLight(ctx, scene, cam, t) {
    if (this.world.def.mine) { this.drawMineLight(ctx, scene, cam); return; }
    const dark = scene.light ? scene.light.dark : 0;
    ctx.fillStyle = `rgba(40,24,40,${0.06 + dark * 0.22})`;
    ctx.fillRect(0, 0, this.viewW, this.viewH);
    ctx.globalCompositeOperation = 'lighter';
    const w = this.world;
    const flick = this.reducedMotion ? 0 : Math.sin(t * 6) * 0.01;
    ctx.fillStyle = `rgba(255,190,110,${0.05 + dark * 0.05 + flick})`;
    ctx.beginPath(); ctx.arc(Math.round(w.pxW / 2 - cam.x), Math.round(w.pxH * 0.45 - cam.y), Math.round(w.pxW * 0.45), 0, Math.PI * 2); ctx.fill();
    for (const o of w.objects) if (o.type === 'fireplace') {
      ctx.fillStyle = `rgba(255,150,60,${0.12 + flick * 3})`;
      ctx.beginPath(); ctx.arc(Math.round(o.x * TILE + 16 - cam.x), Math.round((o.y + 1) * TILE - 6 - cam.y), 22, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  drawFog(ctx, t, cam) {
    for (let i = 0; i < 5; i++) {
      const y = ((i * 97 + t * (3 + i)) % (this.viewH + 80)) - 40;
      const x = Math.sin(t * 0.2 + i) * 40 - cam.x * 0.15;
      ctx.fillStyle = 'rgba(230,240,238,0.11)';
      ellipseFill(ctx, ((x + i * 120) % (this.viewW + 200)) - 60, y, 120, 22);
      ellipseFill(ctx, ((x + i * 120 + 160) % (this.viewW + 200)) - 60, y + 30, 90, 16);
    }
    ctx.fillStyle = 'rgba(220,235,232,0.12)';
    ctx.fillRect(0, 0, this.viewW, this.viewH);
  }

  /** Upscale the buffer and draw crisp overlays (texts, joystick). */
  present(scene) {
    const ctx = this.ctx, s = this.scale;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.buf, 0, 0, this.viewW * s, this.viewH * s);
    // floating texts
    if (this.texts.length) {
      ctx.textAlign = 'center';
      ctx.font = `${Math.round(18 * this.dpr)}px "Reel Pixel", monospace`;
      const cam = scene.camera;
      this.texts = this.texts.filter(tx => (tx.life += 1 / 60) < tx.max);
      for (const tx of this.texts) {
        const a = 1 - tx.life / tx.max;
        const x = (tx.x - cam.x) * s, y = (tx.y - cam.y - tx.life * 14) * s;
        ctx.globalAlpha = Math.min(1, a * 2);
        ctx.lineWidth = Math.round(4 * this.dpr);
        ctx.lineJoin = "round";
        ctx.strokeStyle = '#2c2433';
        ctx.strokeText(tx.text, x, y);
        ctx.fillStyle = tx.color;
        ctx.fillText(tx.text, x, y);
      }
      ctx.globalAlpha = 1;
    }
    // Other players' name tags (crisp text drawn after upscaling).
    if (this.nameTags?.length && scene.camera) {
      const cam = scene.camera;
      ctx.textAlign = 'center';
      ctx.font = `${Math.round(14 * this.dpr)}px "Reel Pixel", monospace`;
      for (const n of this.nameTags) {
        const x = (n.x - cam.x) * s, y = (n.y - cam.y) * s;
        const w = ctx.measureText(n.text).width + 10 * this.dpr;
        ctx.fillStyle = n.host ? 'rgba(240,193,75,0.92)' : 'rgba(30,44,70,0.85)';
        ctx.fillRect(x - w / 2, y - 14 * this.dpr, w, 15 * this.dpr);
        ctx.fillStyle = n.host ? '#2c2433' : '#fff5df';
        ctx.fillText(n.text, x, y - 3 * this.dpr);
      }
    }
    const st = scene.stick;
    if (st) {
      const d = this.dpr;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 3 * d;
      ctx.strokeStyle = 'rgba(255,245,223,0.75)';
      ctx.fillStyle = 'rgba(38,58,88,0.35)';
      ctx.beginPath(); ctx.arc(st.ox * d, st.oy * d, st.radius * d, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      const dx = st.x - st.ox, dy = st.y - st.oy, dl = Math.hypot(dx, dy), lim = Math.min(dl, st.radius);
      const kx = st.ox + (dl ? (dx / dl) * lim : 0), ky = st.oy + (dl ? (dy / dl) * lim : 0);
      ctx.fillStyle = 'rgba(255,245,223,0.95)';
      ctx.beginPath(); ctx.arc(kx * d, ky * d, 20 * d, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

export function rodTip(p) {
  const dir = p.facing;
  if (dir === 'left') return { x: p.x - 16, y: p.y - 20 };
  if (dir === 'right') return { x: p.x + 16, y: p.y - 20 };
  if (dir === 'up') return { x: p.x + 6, y: p.y - 28 };
  return { x: p.x + 8, y: p.y - 18 };
}

function lineTo(ctx, x0, y0, x1, y1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, guard = 0;
  for (;;) {
    ctx.fillRect(x0, y0, 1, 1);
    if ((x0 === x1 && y0 === y1) || guard++ > 600) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

function ellipseFill(ctx, cx, cy, rx, ry) {
  for (let y = -ry; y <= ry; y += 2) {
    const half = Math.round(Math.sqrt(1 - (y * y) / (ry * ry)) * rx);
    ctx.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2, 2);
  }
}
