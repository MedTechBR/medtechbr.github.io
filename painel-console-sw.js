/* 05/10/2026: o console do Painel de Leitos saiu do ar (o fluxo ficou só nas planilhas
   institucionais e nos PDFs). Este service worker existe só para limpar os aparelhos
   que tinham o console instalado: apaga o cache, cancela o próprio registro e recarrega
   as abas abertas (que então caem no 404 do site). */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const ks = await caches.keys();
    await Promise.all(ks.filter(k => k.startsWith('painel-console-')).map(k => caches.delete(k)));
    await self.registration.unregister();
    const cs = await self.clients.matchAll({ type: 'window' });
    cs.forEach(c => { try { c.navigate(c.url); } catch (_) {} });
  })());
});
