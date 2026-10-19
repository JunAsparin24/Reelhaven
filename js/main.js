// Entry point: wires UI + game together, shows readable errors, and registers
// the service worker for offline play / install-to-home-screen.
import { UI } from './ui/index.js';
import { Game } from './game.js';
import { buildAllSprites } from './art/sprites.js';

function showBootError(err) {
  const el = document.getElementById('boot-error');
  if (!el) return;
  el.hidden = false;
  el.textContent = 'Tide & Town hit a problem: ' + (err?.message || String(err)) + ' — try reloading the page.';
}

window.addEventListener('error', e => { console.error(e.error || e.message); if (!window.__ttBooted) showBootError(e.error || e.message); });
window.addEventListener('unhandledrejection', e => console.error('Unhandled promise rejection', e.reason));

try {
  buildAllSprites();   // sprites must exist before the UI builds its icons
  const ui = new UI();
  const game = new Game({ canvas: document.getElementById('world'), ui });
  ui.attach(game);
  game.boot();
  window.__ttBooted = true;
  // Exposed for debugging and automated tests only.
  window.__tideTown = { game, ui };
} catch (err) {
  console.error(err);
  showBootError(err);
}

if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !new URLSearchParams(location.search).has('nosw')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(err => console.warn('Service worker not registered', err));
  });
}
