/* MedTech Portal — service worker (PWA instalável).
   Network-first no shell do portal; cache só como fallback offline.
   NÃO intercepta apps externos (.web.app) nem APIs (origem diferente). */
const CACHE = 'medtech-v717';
const SHELL = [
  './app.html',
  './enfermaria.html',
  './consultai.html',
  './manifest.webmanifest',
  './enfermaria.webmanifest',
  './consultai.webmanifest',
  './icone-192.png',
  './icone-512.png',
  './_mtfb.js',
  './_mtauth.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET') return;
  // só o próprio domínio (não toca apps .web.app, gstatic, firebase, etc.)
  if (url.origin !== location.origin) return;
  // HTML (navegação / *.html): SEMPRE buscar fresco da rede (cache:'reload') p/ nunca servir
  // código velho quando online; cache só como reserva offline. Estáticos (?v) seguem normal.
  const isHTML = req.mode === 'navigate' || url.pathname.endsWith('.html');
  const fetchReq = isHTML ? new Request(url.href, { cache: 'reload' }) : req;
  e.respondWith(
    fetch(fetchReq)
      .then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then(c => c || caches.match('./app.html')))
  );
});
