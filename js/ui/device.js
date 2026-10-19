// Device niceties: stop the browser treating the game like a web page
// (text selection, long-press menus, zoom gestures) and, on phones, try to go
// fullscreen in landscape when play starts.

const isField = el => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

export function installWebPageGuards() {
  document.addEventListener('selectstart', e => { if (!isField(e.target)) e.preventDefault(); });
  document.addEventListener('contextmenu', e => { if (!isField(e.target)) e.preventDefault(); });
  // iOS Safari pinch-zoom gestures.
  for (const ev of ['gesturestart', 'gesturechange']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });
  // Double-tap zoom on plain backgrounds for browsers that ignore touch-action.
  // (Buttons and the game canvas already opt out via CSS touch-action, and we
  // must never swallow quick repeat taps on real controls.)
  let lastTouch = 0;
  document.addEventListener('touchend', e => {
    const now = performance.now();
    const interactive = e.target.closest?.('button, a, input, textarea, select, label, canvas, [role="button"]');
    if (!interactive && now - lastTouch < 300) e.preventDefault();
    lastTouch = now;
  }, { passive: false });
}

export const isTouchDevice = () => matchMedia('(pointer: coarse)').matches;

/**
 * Best effort: fullscreen + landscape lock on touch devices. Must be called
 * from a user gesture. Silently does nothing where unsupported (e.g. iPhone).
 */
export async function enterLandscape() {
  if (!isTouchDevice()) return;
  const el = document.documentElement;
  try {
    if (!document.fullscreenElement && el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    await screen.orientation?.lock?.('landscape');
  } catch { /* not allowed on this device — the rotate hint covers it */ }
}
