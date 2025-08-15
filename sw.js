// Service Worker for PWA capabilities
const CACHE_NAME = 'barcode-scanner-v1';
const urlsToCache = [
  './index.html',
  './styles.css',
  './scanner.js',
  './workflows.js',
  './app.js',
  './barcode-test.html'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll(urlsToCache).catch(err => {
          console.log('Cache addAll failed:', err);
        });
      })
  );
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});