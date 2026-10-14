/* ============================================================
   _mtinstalar.js — "Instale no celular" em todos os apps da MedTech (14/10/2026)
   Pedido do Matheus: orientação de como instalar como app no celular, ou um botão em cada app.
   - Aparece UMA vez por app, só no celular, só se ainda não estiver instalado, alguns
     segundos depois de abrir; "Agora não" esconde por 21 dias ("x" também).
   - Android/Chrome: botão Instalar (beforeinstallprompt). iPhone/iPad: passos do Safari
     (Compartilhar → Adicionar à Tela de Início). Outros: passos pelo menu do navegador.
   - Página sem manifesto próprio (apps clínicos, que moram dentro do MedTech App): leva ao
     portal, que é o app instalável.
   - window.MTInstalar.abrir() mostra o cartão a qualquer momento (para um item de menu).
   Cores do tema vivo quando existem (--sup, --tinta, --ac); senão, neutras.
   ============================================================ */
(function () {
  if (window.MTInstalar) return;
  var CHAVE = 'mt.inst.' + (location.pathname.split('/')[1] || 'raiz');
  var DIAS = 21;
  var prompt = null;
  function ler(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function gravar(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function instalado() { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) { return false; } }
  function ios() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
  function celular() { return ios() || /Android|Mobi/i.test(navigator.userAgent); }
  function temManifesto() { return !!document.querySelector('link[rel="manifest"]'); }
  function nome() {
    var m = window.MT_APP && window.MT_APP.name;
    if (!temManifesto()) return 'MedTech App';
    return m || (document.title || 'app').split(/\s[—–|-]\s/)[0].trim();
  }
  /* tela de login (do site ou dos apps de estudo) ou qualquer diálogo aberto */
  function loginAberto() {
    if (document.querySelector('dialog[open]')) return true;
    var vis = function (el) { return !!(el && !el.hidden && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden'); };
    /* .mt-auth = login dos apps do site; #mtsPortao = login/espera dos apps de estudo (mtsync.js) */
    return vis(document.querySelector('.mt-auth')) || vis(document.getElementById('mtsPortao'));
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); prompt = e; });
  window.addEventListener('appinstalled', function () { fechar(); gravar(CHAVE, '9e15'); });

  function estilo() {
    if (document.getElementById('mtinst-css')) return;
    var s = document.createElement('style'); s.id = 'mtinst-css';
    s.textContent = '.mtinst{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:2147483000;max-width:460px;margin:0 auto;' +
      'background:var(--sup,#fff);color:var(--tinta,#111827);border:1px solid var(--fio,rgba(0,0,0,.1));border-radius:20px;padding:16px 16px 14px;' +
      'box-shadow:0 18px 50px rgba(0,0,0,.28);font:15px/1.45 Inter,system-ui,-apple-system,sans-serif;animation:mtinst-in .25s ease-out}' +
      '@keyframes mtinst-in{from{transform:translateY(16px);opacity:0}}@media (prefers-reduced-motion:reduce){.mtinst{animation:none}}' +
      '.mtinst h2{margin:0 34px 6px 0;font-size:16px;font-weight:700;letter-spacing:-.01em;line-height:1.3}' +
      '.mtinst p{margin:0 0 10px;color:var(--tinta2,#4b5563);font-size:14px}.mtinst ol{margin:0 0 10px;padding-left:20px;font-size:14px}.mtinst li{margin:3px 0}' +
      '.mtinst .mtinst-x{position:absolute;top:10px;right:10px;width:36px;height:36px;border:0;border-radius:50%;background:transparent;color:inherit;font-size:20px;line-height:1;cursor:pointer}' +
      '.mtinst .mtinst-r{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}' +
      '.mtinst button.mtinst-b,.mtinst a.mtinst-b{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 18px;border-radius:999px;border:0;font:600 14px Inter,system-ui,sans-serif;cursor:pointer;text-decoration:none}' +
      '.mtinst .mtinst-p{background:var(--ac,#2F7BF6);color:var(--acTxt,#fff)}.mtinst .mtinst-g{background:var(--sup2,rgba(0,0,0,.06));color:inherit}' +
      '.mtinst b{font-weight:650}';
    document.head.appendChild(s);
  }
  function fechar() { var c = document.getElementById('mtinst'); if (c) c.remove(); }
  function abrir(forcar) {
    if (instalado()) return false;
    if (!forcar && !celular()) return false;
    fechar(); estilo();
    var n = esc(nome()), corpo;
    if (!temManifesto()) {
      corpo = '<p>Os apps clínicos moram no <b>MedTech App</b>. Instale o portal uma vez e abra todos pela tela inicial, em tela cheia.</p>' +
        '<div class="mtinst-r"><button type="button" class="mtinst-b mtinst-g" data-nao>Agora não</button><a class="mtinst-b mtinst-p" href="/app.html">Instalar o MedTech App</a></div>';
    } else if (prompt) {
      corpo = '<p>Abre direto da tela inicial, em tela cheia, como um aplicativo.</p>' +
        '<div class="mtinst-r"><button type="button" class="mtinst-b mtinst-g" data-nao>Agora não</button><button type="button" class="mtinst-b mtinst-p" data-instalar>Instalar</button></div>';
    } else if (ios()) {
      corpo = '<ol><li>No <b>Safari</b>, toque em <b>Compartilhar</b> (o quadrado com a seta, na barra de baixo ou de cima).</li><li>Toque em <b>Adicionar à Tela de Início</b>.</li><li>Toque em <b>Adicionar</b>.</li></ol>' +
        '<p>No Chrome do iPhone, abra este endereço no Safari para instalar.</p><div class="mtinst-r"><button type="button" class="mtinst-b mtinst-p" data-nao>Entendi</button></div>';
    } else {
      corpo = '<ol><li>Toque no menu do navegador (os <b>três pontinhos</b>).</li><li>Toque em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</li></ol>' +
        '<div class="mtinst-r"><button type="button" class="mtinst-b mtinst-p" data-nao>Entendi</button></div>';
    }
    var c = document.createElement('section');
    c.id = 'mtinst'; c.className = 'mtinst'; c.setAttribute('role', 'dialog'); c.setAttribute('aria-labelledby', 'mtinst-t');
    c.innerHTML = '<button type="button" class="mtinst-x" data-nao aria-label="Fechar">×</button><h2 id="mtinst-t">Instale o ' + n + ' no celular</h2>' + corpo;
    document.body.appendChild(c);
    c.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-nao],[data-instalar]'); if (!b) return;
      if (b.hasAttribute('data-instalar') && prompt) {
        var p = prompt; prompt = null; p.prompt();
        (p.userChoice || Promise.resolve()).then(function () { fechar(); });
        gravar(CHAVE, String(Date.now() + 365 * 864e5));
        return;
      }
      gravar(CHAVE, String(Date.now() + DIAS * 864e5)); fechar();
    });
    return true;
  }
  window.MTInstalar = { abrir: function () { return abrir(true); }, instalado: instalado };

  /* aparece sozinho uma vez: celular, não instalado, fora do prazo de "agora não" */
  function automatico() {
    if (instalado() || !celular()) return;
    var ate = Number(ler(CHAVE) || 0);
    if (ate && Date.now() < ate) return;
    setTimeout(function () {
    /* espera a tela de login (ou outro diálogo) fechar: tenta a cada 5 s por até 10 min */
    var tentativas = 0;
    (function tenta() {
      if (instalado() || document.getElementById('mtinst')) return;
      if (!loginAberto()) { abrir(false); return; }
      if (++tentativas < 120) setTimeout(tenta, 5000);
    })();
    }, 6000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', automatico); else automatico();
})();
