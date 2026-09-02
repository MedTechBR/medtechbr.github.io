/* Console do Painel de Leitos — service worker
   Só a casca (html + manifest), rede primeiro; nunca guarda dado da planilha
   nem toca em script.google.com. Escopo restrito a /painel-console para não
   disputar com o sw.js do portal. */
const CACHE = 'painel-console-v2';
const CASCA = ['painel-console.html', 'painel-console.webmanifest'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(CASCA)).catch(() => {})); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('painel-console-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (u.origin !== location.origin || e.request.method !== 'GET') return;          /* ponte, fontes: direto na rede */
  e.respondWith(fetch(e.request).then(r => { if (r.ok) caches.open(CACHE).then(c => c.put(e.request, r.clone())); return r; })
    .catch(() => caches.match(e.request)));
});
