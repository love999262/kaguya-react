const CACHE_VERSION = 'kaguya-bg-cache-v1';
const BG_PATH_SEGMENT = '/backgrounds/';
const PRELOAD_IMAGES = [
  'backgrounds/bg-1.svg',
  'backgrounds/bg-2.svg',
  'backgrounds/bg-3.svg',
  'backgrounds/bg-4.svg',
  'backgrounds/bg-5.svg',
  'backgrounds/bg-6.svg',
  'backgrounds/weibo/a25ec037gy1gfwh1shji1j21hc0u0b29.jpg',
  'backgrounds/weibo/a25ec037gy1gfwi8m1qurj21hc0u01kx.jpg',
  'backgrounds/weibo/a25ec037gy1gfwi8tuvgzj21hc0u07wh.jpg',
  'backgrounds/weibo/a25ec037gy1gfwi8yk25hj21hc0u0tx2.jpg',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const cachedKeys = await cache.keys();

    if (cachedKeys.length === 0) {
      await Promise.allSettled(
        PRELOAD_IMAGES.map(async (path) => {
          const url = new URL(path, self.registration.scope).toString();
          const response = await fetch(url, { cache: 'no-store' });
          if (response.ok) {
            await cache.put(url, response.clone());
          }
        })
      );
    }

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key !== CACHE_VERSION)
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;
  const isBackgroundAsset = requestUrl.pathname.includes(BG_PATH_SEGMENT);

  if (!isSameOrigin || !isBackgroundAsset) {
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) {
      return cached;
    }

    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  })());
});
