// Controller support (standard Gamepad API layout, e.g. Xbox / PlayStation):
//   left stick / d-pad  walk (or move between buttons in a menu)
//   A                   interact / confirm (hold while fishing)
//   X                   use the held tool
//   B                   back / close
//   Y                   open the bag
//   LB / RB             previous / next hotbar slot
//   Start               Island Life menu      Back / Select  settings
const A = 0, B = 1, X = 2, Y = 3, LB = 4, RB = 5, BACK = 8, START = 9, UP = 12, DOWN = 13, LEFT = 14, RIGHT = 15;
const DEAD = 0.22;

export class GamepadInput {
  constructor(h) {
    this.h = h;            // { blocked(), interact(down), use(), back(), menu(name), cycle(dir), confirm(), focusMove(dir) }
    this.prev = [];
    this.vec = { x: 0, y: 0 };
    this.connected = false;
    this.repeatAt = 0;
    window.addEventListener('gamepadconnected', () => { this.connected = true; h.connected?.(); });
    window.addEventListener('gamepaddisconnected', () => { this.connected = !!this.pad(); });
  }

  pad() {
    const list = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of list) if (p && p.connected) return p;
    return null;
  }

  /** Call every frame. Returns the walk vector (zero when no controller). */
  poll() {
    const p = this.pad();
    this.vec.x = 0; this.vec.y = 0;
    if (!p) return this.vec;
    const down = i => !!p.buttons[i]?.pressed;
    const now = p.buttons.map((b, i) => down(i));
    const pressed = i => now[i] && !this.prev[i];
    const released = i => !now[i] && this.prev[i];
    const blocked = this.h.blocked();

    let x = p.axes[0] || 0, y = p.axes[1] || 0;
    if (Math.hypot(x, y) < DEAD) { x = 0; y = 0; }
    if (now[LEFT]) x = -1; if (now[RIGHT]) x = 1; if (now[UP]) y = -1; if (now[DOWN]) y = 1;

    if (blocked) {
      // in menus: d-pad / stick moves between buttons, A presses, B goes back
      const t = performance.now();
      const dir = Math.abs(y) > 0.6 ? (y > 0 ? 1 : -1) : Math.abs(x) > 0.6 ? (x > 0 ? 1 : -1) : 0;
      if (!dir) this.repeatAt = 0;
      else if (t >= this.repeatAt) { this.h.focusMove(dir); this.repeatAt = t + (this.repeatAt ? 140 : 320); }
      if (pressed(A)) this.h.confirm();
    } else {
      const l = Math.hypot(x, y);
      if (l > 0) { const m = Math.min(1, l); this.vec.x = (x / l) * m; this.vec.y = (y / l) * m; }
      if (pressed(X)) this.h.use();
      if (pressed(LB)) this.h.cycle(-1);
      if (pressed(RB)) this.h.cycle(1);
      if (pressed(Y)) this.h.menu('inventory');
      if (pressed(START)) this.h.menu('life');
      if (pressed(BACK)) this.h.menu('settings');
    }
    // A also works as "hold" for fishing, so it sends both edges
    if (!blocked || this.h.fishing()) { if (pressed(A)) this.h.interact(true); if (released(A)) this.h.interact(false); }
    if (pressed(B)) this.h.back();
    this.prev = now;
    return this.vec;
  }
}

/** Move keyboard focus between the buttons of the open menu. */
export function moveMenuFocus(dir) {
  const layer = document.querySelector('#modal-layer .modal-wrap:last-child') || document.querySelector('#sheet-layer .sheet') || document.body;
  if (!layer) return;
  const items = [...layer.querySelectorAll('button:not([disabled]), input, [tabindex="0"]')].filter(el => el.offsetParent !== null);
  if (!items.length) return;
  const i = items.indexOf(document.activeElement);
  const next = items[(i + dir + items.length) % items.length] || items[0];
  next.focus();
  next.scrollIntoView?.({ block: 'nearest' });
}

/** A in a menu: press the focused button, or the menu's main button. */
export function confirmMenu() {
  const el = document.activeElement;
  if (el && (el.tagName === 'BUTTON' || el.tagName === 'INPUT') && el !== document.body) { el.click(); return; }
  const layer = document.querySelector('#modal-layer .modal-wrap:last-child');
  layer?.querySelector('button.primary')?.click();
}
