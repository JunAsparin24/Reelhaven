// Service worker: network-first for the game's own files (so updates appear
// immediately during development), with a cache fallback for offline play.
const CACHE = 'reelhaven-v2';

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', './index.html', './manifest.json'])).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com');
  // The Supabase client library (pinned version) is cached for offline starts;
  // API calls to Supabase itself are never cached.
  const isLib = url.hostname === 'cdn.jsdelivr.net' && url.pathname.startsWith('/npm/@supabase/');
  if (!sameOrigin && !isFont && !isLib) return;
  if (sameOrigin && url.pathname.endsWith('/config.json')) return;
  event.respondWith(
    fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match(req).then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))),
  );
});
