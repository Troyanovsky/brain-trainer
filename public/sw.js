const CACHE = 'brain-garden-__VERSION__';
const ASSETS = /*__ASSETS__*/ [];
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('brain-garden-') && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin)
    return;
  event.respondWith(
    caches
      .open(CACHE)
      // Static build files are identical for every Origin header. Module requests
      // must reuse precached responses even when a static host adds Vary: Origin.
      .then((cache) => cache.match(event.request, { ignoreVary: true }))
      .then(
        (cached) =>
          cached ||
          fetch(event.request).catch(() =>
            event.request.mode === 'navigate'
              ? caches.open(CACHE).then((cache) => cache.match('/index.html', { ignoreVary: true }))
              : Response.error(),
          ),
      ),
  );
});
