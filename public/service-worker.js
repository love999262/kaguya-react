const CACHE_PREFIX = 'kaguya-background-cache-';
const CACHE_VERSION = 'v2';
const BACKGROUND_CACHE = `${CACHE_PREFIX}${CACHE_VERSION}`;

const BACKGROUND_PATTERN = /\/backgrounds\/.+\.(jpg|jpeg|png|webp|avif|gif|svg)$/i;

self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            const outdated = keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== BACKGROUND_CACHE);
            return Promise.all(outdated.map((key) => caches.delete(key)));
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') {
        return;
    }

    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin || !BACKGROUND_PATTERN.test(url.pathname)) {
        return;
    }

    event.respondWith(
        caches.open(BACKGROUND_CACHE).then(async (cache) => {
            const cached = await cache.match(event.request, { ignoreSearch: true });
            if (cached) {
                return cached;
            }

            const response = await fetch(event.request);
            if (response && response.ok) {
                cache.put(event.request, response.clone());
            }
            return response;
        })
    );
});
