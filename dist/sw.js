const CACHE_VERSION = 'kaguya-static-cache-v3';
const BACKGROUND_PATH_SEGMENT = '/backgrounds/';
const LIVE2D_PATH_SEGMENT = '/live2d/';

const PRELOAD_BACKGROUND_ASSETS = [
  'backgrounds/bg-1.svg',
  'backgrounds/bg-2.svg',
  'backgrounds/bg-3.svg',
  'backgrounds/bg-4.svg',
  'backgrounds/bg-5.svg',
  'backgrounds/bg-6.svg',
  'backgrounds/weibo/a25ec037gy1gfwh1shji1j21hc0u0b29.jpg',
  'backgrounds/weibo/a25ec037gy1gfwi8m1qurj21hc0u01kx.jpg',
  'backgrounds/weibo/a25ec037gy1gfwi8tuvgzj21hc0u07wh.jpg',
  'backgrounds/weibo/a25ec037gy1gfwi8yk25hj21hc0u0tx2.jpg'
];

const PRELOAD_LIVE2D_ASSETS = [
  'live2d/lib/L2Dwidget.0.min.js',
  'live2d/lib/L2Dwidget.min.js',
  'live2d/model/bilibili-live/22/index.json',
  'live2d/model/bilibili-live/22/model.moc',
  'live2d/model/bilibili-live/22/motions/idle-01.mtn',
  'live2d/model/bilibili-live/22/motions/idle-02.mtn',
  'live2d/model/bilibili-live/22/motions/idle-03.mtn',
  'live2d/model/bilibili-live/22/motions/thanking.mtn',
  'live2d/model/bilibili-live/22/motions/touch.mtn',
  'live2d/model/bilibili-live/22/texture_00/closet-default-v2.png',
  'live2d/model/bilibili-live/22/texture_01/cba-normal-upper.png',
  'live2d/model/bilibili-live/22/texture_01/cba-super-upper.png',
  'live2d/model/bilibili-live/22/texture_01/default-upper.png',
  'live2d/model/bilibili-live/22/texture_01/newyear-upper.png',
  'live2d/model/bilibili-live/22/texture_01/school2017-upper.png',
  'live2d/model/bilibili-live/22/texture_01/spring-2018-upper.png',
  'live2d/model/bilibili-live/22/texture_01/summer2017-high-upper.png',
  'live2d/model/bilibili-live/22/texture_01/summer2017-low-upper.png',
  'live2d/model/bilibili-live/22/texture_01/tomo-high-upper.png',
  'live2d/model/bilibili-live/22/texture_01/tomo-low-upper.png',
  'live2d/model/bilibili-live/22/texture_01/valley2017-upper.png',
  'live2d/model/bilibili-live/22/texture_01/vdays-upper.png',
  'live2d/model/bilibili-live/22/texture_01/xmas-upper.png',
  'live2d/model/bilibili-live/22/texture_02/cba-normal-lower.png',
  'live2d/model/bilibili-live/22/texture_02/cba-super-lower.png',
  'live2d/model/bilibili-live/22/texture_02/default-lower.png',
  'live2d/model/bilibili-live/22/texture_02/newyear-lower.png',
  'live2d/model/bilibili-live/22/texture_02/school2017-lower.png',
  'live2d/model/bilibili-live/22/texture_02/spring-2018-lower.png',
  'live2d/model/bilibili-live/22/texture_02/summer2017-high-lower.png',
  'live2d/model/bilibili-live/22/texture_02/summer2017-low-lower.png',
  'live2d/model/bilibili-live/22/texture_02/tomo-high-lower.png',
  'live2d/model/bilibili-live/22/texture_02/tomo-low-lower.png',
  'live2d/model/bilibili-live/22/texture_02/valley2017-lower.png',
  'live2d/model/bilibili-live/22/texture_02/vdays-lower.png',
  'live2d/model/bilibili-live/22/texture_02/xmas-lower.png',
  'live2d/model/bilibili-live/22/texture_03/cba-hat.png',
  'live2d/model/bilibili-live/22/texture_03/default-hat.png',
  'live2d/model/bilibili-live/22/texture_03/newyear-hat.png',
  'live2d/model/bilibili-live/22/texture_03/school2017-hat.png',
  'live2d/model/bilibili-live/22/texture_03/spring-2018-hat.png',
  'live2d/model/bilibili-live/22/texture_03/summer2017-hat.png',
  'live2d/model/bilibili-live/22/texture_03/tomo-high-hat.png',
  'live2d/model/bilibili-live/22/texture_03/tomo-low-hat.png',
  'live2d/model/bilibili-live/22/texture_03/valley2017-hat.png',
  'live2d/model/bilibili-live/22/texture_03/vdays-hat.png',
  'live2d/model/bilibili-live/22/texture_03/xmas-hat.png',
  'live2d/model/bilibili-live/22/texture_03/xmas-headwear.png',
  'live2d/model/bilibili-live/22/textures.cache',
  'live2d/model/bilibili-live/22/textures_order.json',
  'live2d/model/bilibili-live/33/index.json',
  'live2d/model/bilibili-live/33/model.moc',
  'live2d/model/bilibili-live/33/motions/idle-01.mtn',
  'live2d/model/bilibili-live/33/motions/idle-02.mtn',
  'live2d/model/bilibili-live/33/motions/idle-03.mtn',
  'live2d/model/bilibili-live/33/motions/thanking.mtn',
  'live2d/model/bilibili-live/33/motions/touch.mtn',
  'live2d/model/bilibili-live/33/texture_00/closet-default-v2.png',
  'live2d/model/bilibili-live/33/texture_01/cba-normal-upper.png',
  'live2d/model/bilibili-live/33/texture_01/cba-super-upper.png',
  'live2d/model/bilibili-live/33/texture_01/default-upper.png',
  'live2d/model/bilibili-live/33/texture_01/newyear-upper.png',
  'live2d/model/bilibili-live/33/texture_01/school2017-upper.png',
  'live2d/model/bilibili-live/33/texture_01/spring-2018-upper.png',
  'live2d/model/bilibili-live/33/texture_01/summer2017-high-upper.png',
  'live2d/model/bilibili-live/33/texture_01/summer2017-low-upper.png',
  'live2d/model/bilibili-live/33/texture_01/tomo-high-upper.png',
  'live2d/model/bilibili-live/33/texture_01/tomo-low-upper.png',
  'live2d/model/bilibili-live/33/texture_01/valley2017-upper.png',
  'live2d/model/bilibili-live/33/texture_01/vdays-upper.png',
  'live2d/model/bilibili-live/33/texture_01/xmas-upper.png',
  'live2d/model/bilibili-live/33/texture_02/cba-normal-lower.png',
  'live2d/model/bilibili-live/33/texture_02/cba-super-lower.png',
  'live2d/model/bilibili-live/33/texture_02/default-lower.png',
  'live2d/model/bilibili-live/33/texture_02/newyear-lower.png',
  'live2d/model/bilibili-live/33/texture_02/school2017-lower.png',
  'live2d/model/bilibili-live/33/texture_02/spring-2018-lower.png',
  'live2d/model/bilibili-live/33/texture_02/summer2017-high-lower.png',
  'live2d/model/bilibili-live/33/texture_02/summer2017-low-lower.png',
  'live2d/model/bilibili-live/33/texture_02/tomo-high-lower.png',
  'live2d/model/bilibili-live/33/texture_02/tomo-low-lower.png',
  'live2d/model/bilibili-live/33/texture_02/valley2017-lower.png',
  'live2d/model/bilibili-live/33/texture_02/vdays-lower.png',
  'live2d/model/bilibili-live/33/texture_02/xmas-lower.png',
  'live2d/model/bilibili-live/33/texture_03/cba-hat.png',
  'live2d/model/bilibili-live/33/texture_03/default-hat.png',
  'live2d/model/bilibili-live/33/texture_03/newyear-hat.png',
  'live2d/model/bilibili-live/33/texture_03/school2017-hat.png',
  'live2d/model/bilibili-live/33/texture_03/spring-2018-hat.png',
  'live2d/model/bilibili-live/33/texture_03/summer2017-hat.png',
  'live2d/model/bilibili-live/33/texture_03/tomo-high-hat.png',
  'live2d/model/bilibili-live/33/texture_03/tomo-low-hat.png',
  'live2d/model/bilibili-live/33/texture_03/valley2017-hat.png',
  'live2d/model/bilibili-live/33/texture_03/vdays-hat.png',
  'live2d/model/bilibili-live/33/texture_03/xmas-hat.png',
  'live2d/model/bilibili-live/33/texture_03/xmas-headwear.png',
  'live2d/model/bilibili-live/33/textures.cache',
  'live2d/model/bilibili-live/33/textures_order.json'
];

const PRELOAD_ASSETS = [...PRELOAD_BACKGROUND_ASSETS, ...PRELOAD_LIVE2D_ASSETS];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);

    await Promise.allSettled(
      PRELOAD_ASSETS.map(async (path) => {
        const url = new URL(path, self.registration.scope).toString();
        const cached = await cache.match(url, { ignoreSearch: true });
        if (cached) {
          return;
        }

        const response = await fetch(url, { cache: 'no-store' });
        if (response.ok) {
          await cache.put(url, response.clone());
        }
      })
    );

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
  const isBackgroundAsset = requestUrl.pathname.includes(BACKGROUND_PATH_SEGMENT);
  const isLive2DAsset = requestUrl.pathname.includes(LIVE2D_PATH_SEGMENT);

  if (!isSameOrigin || (!isBackgroundAsset && !isLive2DAsset)) {
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
