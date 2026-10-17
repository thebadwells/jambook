// Offline support. Everything is served from the cache first (instant, works with no signal),
// then refreshed from the network in the background. When a refresh brings changed content,
// open pages are told so they can offer a reload. New files are cached as they're fetched;
// SHELL only needs to list what must be available on the very first offline launch.
const CACHE = 'jambook-v1';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/music.js', 'js/song-format.js', 'js/fretboard.js', 'js/app.js',
  'js/instruments/guitar.js', 'js/instruments/mandolin.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png',
  'songs/index.txt',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL.map(url => new Request(url, { cache: 'reload' }))); // skip the HTTP cache
    await cacheSongs(cache, await cache.match('songs/index.txt'));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

// Make sure every song named in the index is cached, so new songs work offline too.
async function cacheSongs(cache, indexResponse) {
  if (!indexResponse) return;
  const files = (await indexResponse.clone().text()).split('\n').map(s => s.trim()).filter(Boolean);
  await Promise.all(files.map(async f => {
    const url = 'songs/' + f;
    if (!(await cache.match(url))) await cache.add(new Request(url, { cache: 'reload' })).catch(() => {});
  }));
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    // Read the cached body now: once `cached` is handed to the page its body is consumed.
    const cachedText = cached ? cached.clone().text() : null;
    const refresh = (async () => {
      const fresh = await fetch(req, { cache: 'no-cache' });
      if (!fresh.ok) return fresh;
      const changed = cachedText && (await cachedText) !== (await fresh.clone().text());
      await cache.put(req, fresh.clone());
      if (req.url.endsWith('songs/index.txt')) await cacheSongs(cache, fresh.clone());
      if (changed) notifyUpdated();
      return fresh;
    })();
    if (cached) { event.waitUntil(refresh.catch(() => {})); return cached; }
    return refresh;
  })());
});

let notifyTimer;
function notifyUpdated() { // batch: one message after a burst of refreshes
  clearTimeout(notifyTimer);
  notifyTimer = setTimeout(async () => {
    for (const client of await self.clients.matchAll()) client.postMessage({ type: 'updated' });
  }, 500);
}
