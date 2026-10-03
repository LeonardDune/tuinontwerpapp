// Service worker: de app werkt offline. Kaarttegels en adreszoeken gaan altijd via het netwerk.
const VERSION = 'tuinontwerp-v6';
const SHELL = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'js/app.js',
  'js/assets.js',
  'js/shadows.js',
  'js/sun.js',
  'js/sunpanel.js',
  'js/brushes.js',
  'js/camera.js',
  'js/export.js',
  'js/geom.js',
  'js/guides.js',
  'js/icons.js',
  'js/items.js',
  'js/map.js',
  'js/model.js',
  'js/patterns.js',
  'js/pdf.js',
  'js/render.js',
  'js/stencils.js',
  'js/storage.js',
  'js/tools.js',
  'js/units.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Eigen bestanden: eerst netwerk (zodat updates direct binnenkomen), anders de cache.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(event.request, copy));
        return res;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true })),
  );
});
