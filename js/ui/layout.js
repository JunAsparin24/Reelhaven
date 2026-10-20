// Centralised layout: measures the HUD regions and publishes their sizes as
// CSS variables (so panels, sheets and actions never overlap them) and as
// "insets" in CSS pixels (so the camera can keep the player inside the part
// of the world that isn't covered by UI).
//
// Regions: status (#hud-top, top-left), menu (#nav, top-right in landscape,
// bottom in portrait), info (#hud-info), actions (#action-region), bottom
// panels (#fishing-ui / #dialogue / #build-bar) and the menu drawer (.sheet).

const app = () => document.getElementById('app');

export class Layout {
  constructor() {
    this.portrait = false;
    this.vars = {};
    this.onChange = null;
    const update = () => this.measure();
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    window.addEventListener('orientationchange', () => setTimeout(update, 120));
    document.addEventListener('fullscreenchange', () => setTimeout(update, 120));
    if ('ResizeObserver' in window) {
      this.ro = new ResizeObserver(update);
      for (const id of ['hud-top', 'nav']) { const el = document.getElementById(id); if (el) this.ro.observe(el); }
    }
    update();
  }

  /** Re-measure the fixed HUD regions and publish CSS variables. */
  measure() {
    const a = app();
    if (!a) return;
    this.portrait = window.innerHeight > window.innerWidth;
    a.classList.toggle('is-portrait', this.portrait);
    a.classList.toggle('is-landscape', !this.portrait);
    const status = document.getElementById('hud-top');
    const nav = document.getElementById('nav');
    const set = (k, v) => { if (this.vars[k] !== v) { this.vars[k] = v; a.style.setProperty(k, v + 'px'); } };
    if (status && status.offsetHeight) set('--status-h', status.offsetHeight);
    if (nav && nav.offsetHeight) { set('--menu-h', nav.offsetHeight); set('--menu-w', nav.offsetWidth); }
    this.onChange?.();
  }

  /**
   * Parts of the stage (CSS px) covered by UI right now. The camera centres
   * the action in the remaining area.
   */
  insets() {
    const ins = { top: 0, right: 0, bottom: 0, left: 0 };
    const stage = document.getElementById('stage');
    if (!stage) return ins;
    const sr = stage.getBoundingClientRect();
    if (this.portrait) {
      const nav = document.getElementById('nav');
      if (nav && nav.offsetParent) ins.bottom = Math.max(ins.bottom, sr.bottom - nav.getBoundingClientRect().top);
    }
    for (const id of ['fishing-ui', 'dialogue', 'build-bar']) {
      const el = document.getElementById(id);
      if (el && el.classList.contains('show')) ins.bottom = Math.max(ins.bottom, sr.bottom - el.getBoundingClientRect().top + 6);
    }
    const sheet = document.querySelector('.sheet.in');
    if (sheet) {
      const r = sheet.getBoundingClientRect();
      if (this.portrait) ins.bottom = Math.max(ins.bottom, sr.bottom - r.top);
      else ins.right = Math.max(ins.right, sr.right - r.left);
    }
    return ins;
  }
}
