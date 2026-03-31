const CACHE_NAME = 'roadtrip-v1';

// Pre-cache the app shell on install
const SHELL_URLS = ['/', '/plan'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)));
  self.skipWaiting();
});

// Remove old cache versions on activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests; skip API calls
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/')
  ) {
    return;
  }

  // Cache-first for Next.js static assets (hashed filenames — safe to cache forever)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            const toCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, toCache));
            return response;
          }),
      ),
    );
    return;
  }

  // Network-first for HTML navigation: show cached shell when offline
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/') ?? Response.error()));
  }
});
