// Footsteps and ambience, driven by the world rather than the screen:
//  - the player raises a step event on each foot-down animation frame;
//  - we look up the surface under the player's feet in world coordinates
//    (tilemap + decorations) and play a matching sample;
//  - ambience levels (surf, rain, birds, crickets) follow the player's
//    surroundings, time of day and weather.
import { TILE } from './art/tiles.js';
import { playFootstep, setAmbience } from './audio.js';
import { WATERY } from './world-gen.js';
import { currentPhase, currentWeather } from './weather.js';

export class FootstepSystem {
  constructor(game) {
    this.game = game;
    this.lastSurface = null;
    this.ambT = 0;
  }

  /** Attach to a (new) player instance. */
  attach(player) {
    player.onStep = p => this.step(p);
  }

  step(player) {
    const w = this.game.world;
    if (!w) return;
    const surface = w.surfaceAt(player.x, player.y - 2);
    // Slightly softer when moving across mud (slower steps).
    const played = playFootstep(surface, surface === 'mud' ? 0.85 : 1);
    if (played && surface === 'shallow_water') {
      this.game.renderer.emit('splash', player.x, player.y - 1, 4, { speed: 22, life: 0.45, gravity: 90 });
    }
    this.lastSurface = surface;
  }

  /** Update ambience a few times a second (cheap). */
  update(dt) {
    this.ambT -= dt;
    if (this.ambT > 0) return;
    this.ambT = 0.5;
    const g = this.game;
    if (g.mode === 'title') { setAmbience({ waves: 0.75, rain: 0, birds: 0.25, crickets: 0.35 }); return; }
    if (g.mode !== 'play' || !g.world || !g.player) { setAmbience({ waves: 0, rain: 0, birds: 0, crickets: 0 }); return; }
    const w = g.world, p = g.player;
    if (w.def.interior) {
      // Indoors: no surf or birdsong, rain is a soft patter on the roof.
      const wx = currentWeather();
      setAmbience({ waves: 0, rain: wx === 'storm' ? 0.45 : wx === 'rain' ? 0.3 : 0, birds: 0, crickets: currentPhase() === 'night' ? 0.15 : 0 });
      return;
    }
    // How much open water is around the player (0..1) → surf volume.
    const r = 7, cx = Math.floor(p.x / TILE), cy = Math.floor(p.y / TILE);
    let water = 0, total = 0;
    for (let y = cy - r; y <= cy + r; y += 2) for (let x = cx - r; x <= cx + r; x += 2) {
      total++;
      if (WATERY.has(w.tile(x, y))) water++;
    }
    const waves = Math.min(1, (water / total) * 1.6);
    const phase = currentPhase(), weather = currentWeather();
    const wet = weather === 'rain' ? 0.7 : weather === 'storm' ? 1 : 0;
    setAmbience({
      waves: waves * (weather === 'storm' ? 1.3 : 1),
      rain: wet,
      birds: phase !== 'night' && !wet && !w.def.alwaysNight ? 0.6 : 0,
      crickets: phase === 'night' && !wet ? 0.7 : 0,
    });
  }
}
