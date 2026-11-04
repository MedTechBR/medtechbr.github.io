/* MedTech Portal — service worker (PWA instalável).
   Network-first no shell do portal; cache só como fallback offline.
   NÃO intercepta apps externos (.web.app) nem APIs (origem diferente). */
const CACHE = 'medtech-v811';
const APPS_PROPRIOS = /^\/(flashmed|clinicamed|cirurgiamed|familiamed|radio-titulo|trafego-titulo|enfermare|fisiare|quiz-enare-farmacia|farmauti|sos-farmacia|sos-farmacologia|capifala)(\/|$)/;
const SHELL = [
  './app.html',
  './provas.html',
  './provas.webmanifest',
  './flashmed.webmanifest',
  // FlashMed abre offline (antes caía no portal) e leva a conta vendorizada (mtsync + Firebase compat)
  './flashmed.html',
  './flashmed-provas.js?v=3',
  './flashmed-medbank.js?v=2',
  './mtfiltro.js?v=2',
  './mtsinal.js?v=2',
  './mtsync.js?v=2',
  './vendor/firebase/firebase-app-compat.js',
  './vendor/firebase/firebase-auth-compat.js',
  './vendor/firebase/firebase-firestore-compat.js',
  './manifest.webmanifest',
  './icone-192.png',
  './icone-512.png',
  './_mtfb.js',
  './_mtauth.js',
  './_mtviva.css',
  './fonts/inter-400.woff2',
  './fonts/inter-500.woff2',
  './fonts/inter-600.woff2',
  './fonts/inter-700.woff2',
  './vendor/tabler/tabler-icons.min.css?v=3.48.0',
  './vendor/tabler/fonts/tabler-icons.woff2?v3.48.0'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      // 03/11/2026: a origem é uma só para o portal e todos os apps de estudo (Cache Storage por origem):
      // apagar só os caches do portal. Antes, cada atualização dele zerava o cache offline dos apps.
      .then(keys => Promise.all(keys.filter(k => k.startsWith('medtech-') && k !== CACHE).map(k => caches.delete(k))))
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
  // 03/11/2026: cada app de estudo é um app instalável com SW próprio na sua pasta (repos de projeto).
  // O escopo deste SW é '/', então sem isto ele controlava essas pastas (SOS sempre, os outros na 1ª visita),
  // guardava tudo no cache do portal e, sem internet, respondia com o app.html (portal do médico).
  if (APPS_PROPRIOS.test(url.pathname)) return;
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
      // 03/11/2026: o app.html é reserva só de NAVEGAÇÃO. Antes valia para qualquer pedido: um script da raiz
      // (/_mtacesso.js) que falhasse na rede chegava como HTML ao app de estudo (SyntaxError, app quebrado).
      .catch(() => caches.match(req).then(c => c || (req.mode === 'navigate' ? caches.match('./app.html') : Response.error())))
  );
});
