// Input: keyboard, a floating virtual joystick, and tap-to-move / tap-to-act.
// Dragging anywhere on the world spawns the joystick under your thumb; a quick
// tap walks to that spot (or interacts with what you tapped).
const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
};
const DRAG_THRESHOLD = 10;   // css px before a touch becomes a joystick drag
const STICK_RADIUS = 46;     // css px

export class Controls {
  constructor(canvas, handlers) {
    this.canvas = canvas;
    this.h = handlers;       // { onTap(x,y), onInteract(), onDrag(dx,dy,phase), isBlocked(), mode() }
    this.keys = new Set();
    this.stick = null;       // { id, ox, oy, x, y, active }
    this.vec = { x: 0, y: 0 };
    this.listeners = [];
    this.bind();
  }

  listen(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    this.listeners.push(() => target.removeEventListener(type, fn, opts));
  }

  destroy() { this.listeners.forEach(off => off()); this.listeners = []; }

  bind() {
    this.listen(window, 'keydown', e => {
      if (isTyping(e)) return;
      if (KEYMAP[e.code]) {
        if (this.h.isBlocked() && this.h.mode() !== 'build') return;
        this.keys.add(KEYMAP[e.code]);
        if (this.h.mode() === 'build') { this.h.onKeyNudge?.(KEYMAP[e.code]); }
        e.preventDefault();
      } else if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') {
        if (e.code !== 'Enter' && e.target && e.target.tagName === 'BUTTON') return; // let buttons handle space
        if (this.h.onInteractKey?.(e)) e.preventDefault();
      } else if (e.code === 'Escape') {
        this.h.onEscape?.();
      } else if (e.code === 'KeyR') {
        this.h.onRotateKey?.();
      } else if (/^Digit[0-9]$/.test(e.code) || e.code === 'Minus' || e.code === 'Equal') {
        const n = e.code === 'Minus' ? 11 : e.code === 'Equal' ? 12 : Number(e.code.slice(5)) || 10;
        if (this.h.onHotkey?.(n)) e.preventDefault();
      }
    });
    this.listen(window, 'keyup', e => { if (KEYMAP[e.code]) this.keys.delete(KEYMAP[e.code]); });
    this.listen(window, 'blur', () => { this.keys.clear(); this.endStick(); });

    const c = this.canvas;
    this.listen(c, 'pointerdown', e => {
      if (this.stick || this.h.isBlocked()) return;
      c.setPointerCapture?.(e.pointerId);
      this.stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY, active: false, t: performance.now() };
      e.preventDefault();
    });
    this.listen(c, 'pointermove', e => {
      const s = this.stick;
      if (!s || s.id !== e.pointerId) return;
      const prevX = s.x, prevY = s.y;
      s.x = e.clientX; s.y = e.clientY;
      if (!s.active && Math.hypot(s.x - s.ox, s.y - s.oy) > DRAG_THRESHOLD) s.active = true;
      if (s.active && this.h.mode() === 'build') this.h.onDrag?.(s.x - prevX, s.y - prevY);
      e.preventDefault();
    });
    const end = e => {
      const s = this.stick;
      if (!s || s.id !== e.pointerId) return;
      if (!s.active && performance.now() - s.t < 450) {
        const r = c.getBoundingClientRect();
        this.h.onTap(e.clientX - r.left, e.clientY - r.top);
      }
      if (s.active && this.h.mode() === 'build') this.h.onDragEnd?.();
      this.endStick();
    };
    this.listen(c, 'pointerup', end);
    this.listen(c, 'pointercancel', end);
    // Stop the page from scrolling / zooming while steering on the canvas.
    this.listen(c, 'touchmove', e => e.preventDefault(), { passive: false });
    this.listen(c, 'contextmenu', e => e.preventDefault());
  }

  endStick() { this.stick = null; this.vec.x = 0; this.vec.y = 0; }

  /** Current movement vector (-1..1 per axis). */
  read() {
    let x = 0, y = 0;
    if (this.keys.has('left')) x -= 1;
    if (this.keys.has('right')) x += 1;
    if (this.keys.has('up')) y -= 1;
    if (this.keys.has('down')) y += 1;
    if (x || y) { const l = Math.hypot(x, y); return { x: x / l, y: y / l }; }
    const s = this.stick;
    if (s && s.active && this.h.mode() !== 'build') {
      let dx = s.x - s.ox, dy = s.y - s.oy;
      const d = Math.hypot(dx, dy);
      if (d > STICK_RADIUS) { s.ox = s.x - (dx / d) * STICK_RADIUS; s.oy = s.y - (dy / d) * STICK_RADIUS; dx = s.x - s.ox; dy = s.y - s.oy; }
      const m = Math.min(1, Math.hypot(dx, dy) / STICK_RADIUS);
      if (m < 0.18) return { x: 0, y: 0 };
      const a = Math.atan2(dy, dx);
      return { x: Math.cos(a) * Math.min(1, m * 1.25), y: Math.sin(a) * Math.min(1, m * 1.25) };
    }
    return { x: 0, y: 0 };
  }

  /** Joystick visual state in css pixels relative to the canvas, or null. */
  stickVisual() {
    const s = this.stick;
    if (!s || !s.active || this.h.mode() === 'build') return null;
    const r = this.canvas.getBoundingClientRect();
    return { ox: s.ox - r.left, oy: s.oy - r.top, x: s.x - r.left, y: s.y - r.top, radius: STICK_RADIUS };
  }
}

function isTyping(e) {
  const t = e.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}
