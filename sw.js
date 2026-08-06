const CACHE_NAME = 'ecotrack-pwa-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/antimacet.js',
  '/amview.js',
  '/adminctl.js',
  '/logo.png'
];

// Install: Cache file-file utama
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// Fetch: Gunakan cache dulu, kalau tidak ada baru ambil dari internet
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) return response;
        return fetch(event.request).then(res => {
          if(!res || res.status !== 200 || res.type !== 'basic') return res;
          const responseToCache = res.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
          return res;
        });
      })
  );
});
