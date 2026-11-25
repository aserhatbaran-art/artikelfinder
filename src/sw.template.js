// Service Worker – wird beim Build mit Version und Dateiliste befüllt (siehe vite.config.ts).
// Strategie: alles beim Installieren vorladen, danach Cache zuerst. Neue Version → neuer Cache, alter wird gelöscht.
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const CACHE = `artikelfinder-${VERSION}`;
// ignoreVary: Vite lädt JS/CSS mit crossorigin (Origin-Header); Server senden oft "Vary: Origin/Accept-Encoding",
// sonst passt der beim Installieren gespeicherte Eintrag nicht zur späteren Anfrage.
const MATCH = { cacheName: CACHE, ignoreVary: true };

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE.map((p) => new Request(new URL(p, self.registration.scope), { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('artikelfinder-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // Seitenaufrufe (auch mit ?q=…) immer mit der gecachten App-Shell beantworten
    event.respondWith(
      caches.match(new URL('./', self.registration.scope).href, MATCH).then((r) => r || fetch(req)),
    );
    return;
  }
  event.respondWith(caches.match(req.url, MATCH).then((r) => r || fetch(req)));
});
