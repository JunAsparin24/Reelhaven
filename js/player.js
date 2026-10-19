// Player movement, collision and animation. Position is in world pixels at
// the character's feet.
import { TILE } from './art/tiles.js';

const SPEED = 64;          // px per second
const HALF_W = 5, HALF_H = 3;

export class Player {
  constructor(x, y, facing = 'down') {
    this.x = x; this.y = y;
    this.facing = facing;
    this.moving = false;
    this.anim = 0;
    this.pose = 'walk';     // 'walk' | 'hold' | 'cheer'
    this.poseTimer = 0;
    this.path = null;
    this.onArrive = null;
    this.lastFrame = 0;
    this.onStep = null;   // set by the footstep system
  }

  get tileX() { return Math.floor(this.x / TILE); }
  get tileY() { return Math.floor((this.y - 1) / TILE); }

  placeAtTile(tx, ty) { this.x = tx * TILE + 8; this.y = ty * TILE + 12; this.path = null; }

  setPath(path, onArrive) { this.path = path && path.length ? path : null; this.onArrive = onArrive || null; if (!this.path && onArrive) onArrive(); }
  cancelPath() { this.path = null; this.onArrive = null; }

  /**
   * input: { x, y } direction vector (-1..1) from joystick/keyboard.
   * Returns true if the player moved this frame.
   */
  update(dt, input, world) {
    if (this.poseTimer > 0) { this.poseTimer -= dt; if (this.poseTimer <= 0) this.pose = 'walk'; }
    let dx = input.x, dy = input.y;
    if (dx || dy) this.cancelPath();
    else if (this.path) {
      const next = this.path[0];
      const tx = next.x * TILE + 8, ty = next.y * TILE + 12;
      const ex = tx - this.x, ey = ty - this.y;
      const d = Math.hypot(ex, ey);
      if (d < 2) {
        this.path.shift();
        if (!this.path.length) {
          this.path = null;
          const cb = this.onArrive; this.onArrive = null;
          this.moving = false;
          if (cb) cb();
          return false;
        }
      } else { dx = ex / d; dy = ey / d; }
    }
    const len = Math.hypot(dx, dy);
    if (len < 0.15) { this.moving = false; this.anim = 0; return false; }
    if (len > 1) { dx /= len; dy /= len; }
    if (this.pose === 'hold') this.pose = 'walk';
    const slow = world.slow[this.tileY * world.w + this.tileX] ? 0.65 : 1;
    const sp = SPEED * slow * dt;
    // Axis-separated movement lets the player slide along walls.
    const ox = this.x, oy = this.y;
    const nx = this.x + dx * sp;
    if (world.boxFree(nx, this.y - HALF_H, HALF_W, HALF_H)) this.x = nx;
    const ny = this.y + dy * sp;
    if (world.boxFree(this.x, ny - HALF_H, HALF_W, HALF_H)) this.y = ny;
    // Facing still follows input, but walking into a wall is not "moving":
    // no walk animation and no footsteps.
    const moved = Math.hypot(this.x - ox, this.y - oy) > sp * 0.2;
    // Facing follows the dominant axis.
    if (Math.abs(dx) > Math.abs(dy)) this.facing = dx > 0 ? 'right' : 'left';
    else this.facing = dy > 0 ? 'down' : 'up';
    if (!moved) { this.moving = false; this.anim = 0; this.lastFrame = 0; return false; }
    this.moving = true;
    this.anim += dt * 8 * slow;
    // Frames 1 and 3 of the 4-frame walk cycle are the feet touching down.
    const frame = Math.floor(this.anim) % 4;
    if (frame !== this.lastFrame) {
      this.lastFrame = frame;
      if (frame === 1 || frame === 3) this.onStep?.(this);
    }
    return true;
  }

  /** Pick the current animation frame from a character sprite set. */
  frame(set) {
    if (this.pose === 'cheer') return set.cheer;
    if (this.pose === 'hold') return set.hold[this.facing];
    const frames = set[this.facing];
    return this.moving ? frames[Math.floor(this.anim) % 4] : frames[0];
  }

  cheer(t = 1.4) { this.pose = 'cheer'; this.poseTimer = t; }
}
