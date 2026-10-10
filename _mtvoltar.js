/* Voltar ao menu pelo ícone dos apps de estudo (10/10/2026).
   No celular, com o MedTech instalado como app (PWA), não há botão de voltar do navegador:
   quem abria um app de estudo pelo portal ficava preso nele. O portal (app.html / provas.html)
   grava de onde o app foi aberto ('mt.voltar'); aqui, se essa marca existir, tocar no ícone
   do app no topo volta para o portal.
   Sem a marca (app aberto direto, ou instalado como app próprio), nada aparece. */
(function () {
  var OK = /^\/(app|provas)\.html$/, destino = null;
  try { destino = sessionStorage.getItem('mt.voltar'); } catch (e) {}
  /* reserva 1: marca em localStorage (o iPhone às vezes perde o sessionStorage no app instalado), vale 12 h */
  if (!destino || !OK.test(destino)) {
    try { var m = JSON.parse(localStorage.getItem('mt.voltar') || 'null'); if (m && OK.test(m.d) && Date.now() - m.t < 12 * 3600e3) destino = m.d; } catch (e) {}
  }
  /* reserva 2: veio direto de um portal */
  if (!destino || !OK.test(destino)) {
    try { var r = new URL(document.referrer); if (r.origin === location.origin && OK.test(r.pathname)) destino = r.pathname; } catch (e) {}
  }
  if (!destino || !OK.test(destino)) return;
  var nome = destino === '/app.html' ? 'MedTech App' : 'MedTech Provas';
  /* 10/10/2026, pedido do Matheus: nada de botão flutuante. Tocar no ÍCONE do app (o logo no
     topo) volta para o menu do portal; o nome do app continua levando ao início do próprio app.
     Delegação no document (fase de captura): vale mesmo quando o app redesenha o topo. */
  var SEL = '.marca .logo, header .topo > span.marca, header .brand > .logo';
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest && e.target.closest(SEL);
    if (!el) return;
    e.preventDefault(); e.stopPropagation();
    location.href = destino;
  }, true);
  function marca() {
    var els = document.querySelectorAll(SEL);
    for (var i = 0; i < els.length; i++) {
      if (els[i].getAttribute('data-mt-volta')) continue;
      els[i].setAttribute('data-mt-volta', '1');
      els[i].setAttribute('title', 'Voltar ao ' + nome);
      els[i].style.cursor = 'pointer';
    }
  }
  function inicia() {
    marca();
    try { new MutationObserver(marca).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
  }
  if (document.body) inicia(); else document.addEventListener('DOMContentLoaded', inicia);
})();
