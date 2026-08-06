// sw.js — EcoTRACK PWA (SAFE v3)
const CACHE_NAME = 'ecotrack-pwa-v3';
const STATIC_ASSETS = [
  '/', '/index.html', '/style.css', '/app.js',
  '/antimacet.js', '/amview.js', '/adminctl.js',
  '/manifest.json', '/logo.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 🔥 SEMUA request cross-origin (Firebase, OSM, CDN) dibiarkan lewat
  // tanpa di-intercept sama sekali
  if (url.hostname !== self.location.hostname) return;
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE_NAME).then(c => c.put(event.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(event.request))
  );
});
