// ============================================
// Checkup! — Service Worker
// Bump the version to force a cache refresh.
// ============================================

var CACHE_NAME = 'checkup-v26';

// App shell — always cached
var SHELL_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
];

// Image & icon assets — cached individually so missing files don't block install
var OPTIONAL_ASSETS = [
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/apple-touch-icon.png',
  '/assets/icons/favicon.png',
  '/assets/images/Doppler_Device_Background.png',
  '/assets/images/logo.png',
  '/assets/video/Doppler_Intro.mp4',
  '/assets/video/Found_It.mp4',
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      // Cache shell assets (required — will fail install if missing)
      return cache.addAll(SHELL_ASSETS).then(function () {
        // Cache optional assets individually — missing files won't block install
        return Promise.all(
          OPTIONAL_ASSETS.map(function (url) {
            return cache.add(url).catch(function () {
              // Asset not available yet — skip it
            });
          })
        );
      });
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  // Delete old caches when version is bumped
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (k) { return k !== CACHE_NAME; })
          .map(function (k) { return caches.delete(k); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      return cached || fetch(event.request);
    })
  );
});
