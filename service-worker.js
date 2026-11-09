const CACHE_NAME = 'arcadefin-v5';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/aset/logo.png',
  '/manifest.json',
  '/aset/logos/bca.png',
  '/aset/logos/mandiri.png',
  '/aset/logos/bri.png',
  '/aset/logos/bni.png',
  '/aset/logos/jago.png',
  '/aset/logos/seabank.png',
  '/aset/logos/blu.png',
  '/aset/logos/tmrw.png',
  '/aset/logos/gopay.png',
  '/aset/logos/ovo.png',
  '/aset/logos/dana.png',
  '/aset/logos/shopeepay.png',
  '/aset/logos/cash.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
