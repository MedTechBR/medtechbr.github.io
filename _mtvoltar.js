/* Botão "Início" nos apps de estudo (10/10/2026).
   No celular, com o MedTech instalado como app (PWA), não há botão de voltar do navegador:
   quem abria um app de estudo pelo portal ficava preso nele. O portal (app.html / provas.html)
   grava em sessionStorage de onde o app foi aberto ('mt.voltar'); aqui, se essa marca existir,
   aparece um botão discreto no canto de baixo à esquerda que volta para o portal.
   Sem a marca (app aberto direto, ou instalado como app próprio), nada aparece. */
(function () {
  var destino = null;
  try { destino = sessionStorage.getItem('mt.voltar'); } catch (e) {}
  if (!destino || !/^\/(app|provas)\.html$/.test(destino)) return;
  var nome = destino === '/app.html' ? 'MedTech App' : 'MedTech Provas';
  function monta() {
    if (document.getElementById('mt-voltar')) return;
    var st = document.createElement('style');
    st.textContent =
      '.mt-voltar{position:fixed;z-index:9400;left:calc(env(safe-area-inset-left) + 12px);bottom:calc(env(safe-area-inset-bottom) + 84px);' +
      'display:inline-flex;align-items:center;gap:6px;height:40px;padding:0 14px 0 11px;border-radius:999px;border:0;' +
      'background:rgba(15,23,42,.86);color:#fff;font:600 13px/1 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;text-decoration:none;' +
      'box-shadow:0 6px 18px rgba(0,0,0,.28);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);opacity:.88}' +
      '.mt-voltar:hover,.mt-voltar:focus-visible{opacity:1}' +
      '.mt-voltar:focus-visible{outline:3px solid #8C8CFF;outline-offset:2px}' +
      '.mt-voltar svg{width:16px;height:16px;flex:0 0 auto}' +
      '@media print{.mt-voltar{display:none}}';
    document.head.appendChild(st);
    var a = document.createElement('a');
    a.id = 'mt-voltar'; a.className = 'mt-voltar'; a.href = destino;
    a.setAttribute('aria-label', 'Voltar ao ' + nome);
    a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/></svg>Início';
    document.body.appendChild(a);
  }
  if (document.body) monta(); else document.addEventListener('DOMContentLoaded', monta);
})();
