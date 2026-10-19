// Smooth-follow camera clamped to the world, snapped to whole pixels so the
// pixel art never shimmers.
export class Camera {
  constructor() { this.x = 0; this.y = 0; this.viewW = 200; this.viewH = 300; this.fx = 0; this.fy = 0; this.extraBottom = 0; }

  resize(w, h) { this.viewW = w; this.viewH = h; }

  /** Jump directly to centre on a point. */
  snap(x, y, world) { this.fx = x; this.fy = y; this.clamp(world); }

  /** Open sea beyond the map edge that the camera may show (keeps docks centred). */
  static MARGIN = 72;

  follow(x, y, dt, world, lookAhead = { x: 0, y: 0 }) {
    const k = 1 - Math.pow(0.0025, dt);
    this.fx += (x + lookAhead.x - this.fx) * k;
    this.fy += (y + lookAhead.y - this.fy) * k;
    this.clamp(world);
  }

  clamp(world) {
    let cx = this.fx - this.viewW / 2, cy = this.fy - this.viewH / 2;
    const m = Camera.MARGIN;
    if (world.pxW + m * 2 <= this.viewW) cx = (world.pxW - this.viewW) / 2;
    else cx = Math.max(-m, Math.min(world.pxW + m - this.viewW, cx));
    if (world.pxH + m * 2 <= this.viewH) cy = (world.pxH - this.viewH) / 2;
    else cy = Math.max(-m, Math.min(world.pxH + m + this.extraBottom - this.viewH, cy));
    this.x = Math.round(cx);
    this.y = Math.round(cy);
  }

  /** Screen (buffer px) to world px. */
  toWorld(sx, sy) { return { x: sx + this.x, y: sy + this.y }; }
}
