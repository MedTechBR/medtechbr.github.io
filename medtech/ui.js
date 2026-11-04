/* MedTech PWA: peças de interface comuns (folha que sobe, aviso, pilha de camadas com o botão Voltar do aparelho). */
(function () {
  'use strict';
  var W = window, D = document;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function reduz() { try { return W.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function ic(nome) { return '<i class="ti ti-' + nome + '" aria-hidden="true"></i>'; }

  /* Pilha de camadas (conduta aberta, folhas): o Voltar do aparelho ou do navegador fecha a de cima.
     Uma só entrada extra no histórico enquanto houver camada aberta; fechar pela tela e abrir outra
     no mesmo toque (folha que leva à conduta) não perde a entrada. */
  var pilha = [], armado = false, ignorarPop = 0;
  function arma() { if (armado) return; try { history.pushState({ mtCamada: 1 }, ''); armado = true; } catch (e) { } }
  function empilha(fechar) {
    var c = { fechar: fechar, viva: true };
    pilha.push(c);
    arma();
    return function () {   // fechar pela interface
      if (!c.viva) return;
      c.viva = false;
      var i = pilha.indexOf(c);
      if (i >= 0) pilha.splice(i, 1);
      fechar();
      setTimeout(function () {
        if (!pilha.length && armado) { armado = false; ignorarPop++; try { history.back(); } catch (e) { ignorarPop--; } }
      }, 0);
    };
  }
  W.addEventListener('popstate', function () {
    if (ignorarPop) { ignorarPop--; return; }
    armado = false;
    var c = pilha.pop();
    if (c && c.viva) { c.viva = false; c.fechar(); }
    if (pilha.length) arma();
  });

  /* Folha que sobe de baixo, como a sheet do iPhone. opts: {titulo, classe, conteudo(el), aoFechar, alta} */
  function folha(opts) {
    var fundo = D.createElement('div');
    fundo.className = 'folha-fundo';
    var f = D.createElement('div');
    f.className = 'folha' + (opts.classe ? ' ' + opts.classe : '') + (opts.alta ? ' alta' : '');
    f.setAttribute('role', 'dialog');
    f.setAttribute('aria-modal', 'true');
    if (opts.titulo) f.setAttribute('aria-label', opts.titulo);
    f.innerHTML = '<div class="folha-alca" aria-hidden="true"></div><div class="folha-corpo"></div>';
    fundo.appendChild(f);
    var raiz = D.getElementById('app') || D.body;
    raiz.appendChild(fundo);
    var anterior = D.activeElement;
    var corpo = f.querySelector('.folha-corpo');
    var fechada = false;
    var fecharUI = empilha(function () {
      if (fechada) return;
      fechada = true;
      fundo.classList.remove('aberta');
      var some = function () { fundo.remove(); if (anterior && anterior.focus) try { anterior.focus({ preventScroll: true }); } catch (e) { } };
      if (reduz()) some(); else setTimeout(some, 260);
      if (opts.aoFechar) opts.aoFechar();
    });
    fundo.addEventListener('click', function (e) { if (e.target === fundo) fecharUI(); });
    f.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); fecharUI(); } });
    // arrastar a alça para baixo fecha
    var alca = f.querySelector('.folha-alca'), y0 = null;
    alca.addEventListener('pointerdown', function (e) { y0 = e.clientY; alca.setPointerCapture(e.pointerId); });
    alca.addEventListener('pointermove', function (e) { if (y0 != null) f.style.transform = 'translateY(' + Math.max(0, e.clientY - y0) + 'px)'; });
    alca.addEventListener('pointerup', function (e) { var d = y0 == null ? 0 : e.clientY - y0; y0 = null; f.style.transform = ''; if (d > 90) fecharUI(); });
    var api = { el: f, corpo: corpo, fechar: fecharUI };
    if (opts.conteudo) opts.conteudo(corpo, api);
    requestAnimationFrame(function () {
      fundo.classList.add('aberta');
      var alvo = f.querySelector('[data-foco]') || f.querySelector('h2, button, a, input');
      if (alvo) try { alvo.focus({ preventScroll: true }); } catch (e) { }
    });
    return api;
  }

  var tAviso = null;
  function aviso(txt) {
    var a = D.getElementById('aviso');
    if (!a) { a = D.createElement('div'); a.id = 'aviso'; a.setAttribute('role', 'status'); (D.getElementById('app') || D.body).appendChild(a); }
    a.textContent = txt;
    a.classList.add('vis');
    clearTimeout(tAviso);
    tAviso = setTimeout(function () { a.classList.remove('vis'); }, 2400);
  }

  function copia(texto, msg) {
    var ok = function () { aviso(msg); };
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(texto).then(ok, function () { copiaVelha(texto); ok(); });
    copiaVelha(texto); ok();
  }
  function copiaVelha(t) {
    var x = D.createElement('textarea'); x.value = t; x.setAttribute('readonly', ''); x.style.position = 'fixed'; x.style.opacity = '0';
    D.body.appendChild(x); x.select(); try { D.execCommand('copy'); } catch (e) { } x.remove();
  }

  /* Confirmação no estilo do alerta do iPhone. botoes: [{rotulo, perigo, acao}] */
  function confirma(titulo, msg, botoes) {
    var fundo = D.createElement('div');
    fundo.className = 'alerta-fundo';
    fundo.innerHTML = '<div class="alerta" role="alertdialog" aria-modal="true" aria-labelledby="alT" aria-describedby="alM"><h2 id="alT">' + esc(titulo) + '</h2><p id="alM">' + esc(msg) + '</p><div class="alerta-bts"></div></div>';
    var bts = fundo.querySelector('.alerta-bts');
    var fechar = empilha(function () { fundo.remove(); });
    botoes.forEach(function (b) {
      var x = D.createElement('button');
      x.type = 'button'; x.textContent = b.rotulo;
      if (b.perigo) x.className = 'perigo';
      x.addEventListener('click', function () { fechar(); if (b.acao) b.acao(); });
      bts.appendChild(x);
    });
    fundo.addEventListener('click', function (e) { if (e.target === fundo) fechar(); });
    fundo.addEventListener('keydown', function (e) { if (e.key === 'Escape') fechar(); });
    (D.getElementById('app') || D.body).appendChild(fundo);
    var ult = bts.lastElementChild; if (ult) ult.focus();
  }

  W.MTUI = { esc: esc, ic: ic, reduz: reduz, folha: folha, aviso: aviso, copia: copia, confirma: confirma, empilha: empilha };
})();
