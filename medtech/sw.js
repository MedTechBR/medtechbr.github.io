/* MedTech PWA: service worker com escopo /medtech/ (não substitui o /sw.js do portal).
   - Casca e banco de condutas abrem offline.
   - Estáticos: stale-while-revalidate (serve do cache na hora e sempre revalida na rede),
     a cura do precache envenenado pela borda do CDN; o precache busca com cache:'reload'.
   - Páginas HTML: rede primeiro, cache só como reserva offline.
   - Só o próprio domínio; Firebase, gstatic e APIs passam direto. */
const CACHE = 'medtech-pwa-v4';
const NUCLEO = [
  './', './index.html', './medtech.css?v=1', './manifest.webmanifest',
  './ui.js?v=1', './dados.js?v=1', './conduta.js?v=1', './leitor.js?v=1', './presc.js?v=1', './fluxo.js?v=1', './casca.js?v=2',
  './gestao.css?v=1', './cofre.js?v=1', './gestao.js?v=1',
  '../condutai.html',
  /* sessões de acompanhamento: a tela e os motores (importados sem ?v=, como estão em sessoes/index.js) */
  './sessoes.css?v=1', './sessoes-tela.js?v=1', './sessoes/index.js', './sessoes/nucleo.js', './sessoes/cad.js', './sessoes/sca.js', './sessoes/sepse.js',
  './sessoes/anafilaxia.js', './sessoes/epileptico.js', './sessoes/ehh.js', './sessoes/hipona.js',
  './ferramentas.css?v=1', './fer-ponte.js?v=1', './fer-motor.js?v=1', './fer-ui.js?v=1', './ferramentas.js?v=1',
  /* JS original das Ferramentas (versões do condutai-areas.js e do paliai.html); imagens do POCUS entram no cache ao abrir */
  '../condutai-areas.js?v=2', '../condutai-calc.js?v=1', '../condutai-atb.js?v=2', '../condutai-pocus.js?v=2', '../paliai.html', '../pali-conteudo.js?v=7',
  '../condutai-banco.js?v=7', '../condutai-prescricoes.js?v=5', '../condutai-seguranca.js?v=4', '../condutai-didatica.js?v=1', '../condutai-ligacoes.js?v=1',
  '../vendor/tabler/tabler-icons.min.css?v=3.48.0', '../vendor/tabler/fonts/tabler-icons.woff2?v3.48.0',
  '../_mtfb.js?v=1', '../_mtauth.js?v=50',
  '../icone-192.png?v=2', '../icone-512.png?v=2', '../icone-180.png', '../favicon.png',
  './didatica/indice.json', './didatica/acls.json', './didatica/avc_isq.json', './didatica/choque_cardio.json', './didatica/choque_hipov.json', './didatica/eap.json',
  './didatica/hipercalemia.json', './didatica/intox_geral.json', './didatica/intox_paracet.json', './didatica/pac.json', './didatica/politrauma.json',
  './didatica/queimadura.json', './didatica/rabdomio.json', './didatica/sepse.json', './didatica/stemi.json', './didatica/tep.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(NUCLEO.map(u =>
    c.add(new Request(u, { cache: 'reload' })).catch(() => {})   // um arquivo que falhar não derruba a instalação
  ))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.indexOf('medtech-pwa-') === 0 && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const html = req.mode === 'navigate';
  if (html) {
    e.respondWith(fetch(new Request(req.url, { cache: 'reload', credentials: 'same-origin' })).then(r => {
      if (r && r.ok && r.type === 'basic') { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
      return r;
    }).catch(() => caches.match(req, { ignoreSearch: req.mode === 'navigate' }).then(h => h || caches.match('./index.html'))));
    return;
  }
  e.respondWith(caches.open(CACHE).then(c => c.match(req).then(hit => {
    const rede = fetch(req, { cache: 'no-cache' }).then(r => { if (r && r.ok && r.type === 'basic') c.put(req, r.clone()); return r; }).catch(() => hit);
    return hit || rede;
  })));
});
