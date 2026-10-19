// Entry point: wires UI + game together, shows readable errors, and registers
// the service worker for offline play / install-to-home-screen.
import { UI } from './ui/index.js';
import { Game } from './game.js';
import { buildAllSprites } from './art/sprites.js';
import { installWebPageGuards } from './ui/device.js';
import { Online } from './online/index.js';

function showBootError(err) {
  const el = document.getElementById('boot-error');
  if (!el) return;
  el.hidden = false;
  el.textContent = 'Reelhaven hit a problem: ' + (err?.message || String(err)) + ' — try reloading the page.';
}

window.addEventListener('error', e => { console.error(e.error || e.message); if (!window.__ttBooted) showBootError(e.error || e.message); });
window.addEventListener('unhandledrejection', e => console.error('Unhandled promise rejection', e.reason));

try {
  installWebPageGuards();
  buildAllSprites();   // sprites must exist before the UI builds its icons
  const ui = new UI();
  const game = new Game({ canvas: document.getElementById('world'), ui });
  ui.attach(game);
  game.boot();
  window.__ttBooted = true;
  // Online services are optional: without config.json the game stays offline.
  const online = new Online();
  online.start(game, ui, ui.attachOnline(online)).catch(err => console.warn('Online start failed', err));
  // Exposed for debugging and automated tests only.
  window.__reelhaven = window.__tideTown = { game, ui, online };
} catch (err) {
  console.error(err);
  showBootError(err);
}

if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !new URLSearchParams(location.search).has('nosw')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(err => console.warn('Service worker not registered', err));
  });
}
