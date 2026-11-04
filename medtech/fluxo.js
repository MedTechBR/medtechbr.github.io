/* MedTech PWA: fluxograma conduzido, como FluxoGuiado.swift.
   Um nó por vez em letra grande, saídas em botões na zona do polegar, trilha do caminho.
   O grafo vem de CVD.parseFluxo (condutai-didatica.js); o diagrama é desenhado pelo mermaid do site,
   com a mesma limpeza de sanitizeMermaid do CondutAI. Expõe window.MTFluxo. */
(function () {
  'use strict';
  var W = window, D = document;
  var esc = function (s) { return W.MTUI.esc(s); };
  var MARCA_DID = 'Resumo didático derivado desta conduta';
  var mermaidPronto = null, nDiag = 0;

  function tipo(n) { return n.cls.has('critical') ? 'critico' : n.cls.has('action') ? 'acao' : ''; }
  function curto(t) { t = (t || '').split('\n')[0]; return t.length > 26 ? t.slice(0, 25).trim() + '…' : t; }

  function carregaMermaid() {
    if (mermaidPronto) return mermaidPronto;
    mermaidPronto = new Promise(function (ok, falha) {
      if (W.mermaid) return ok(W.mermaid);
      var s = D.createElement('script');
      s.src = W.MTDados.versoes.mermaid; s.async = true;
      s.onload = function () { ok(W.mermaid); };
      s.onerror = function () { mermaidPronto = null; falha(new Error('mermaid')); };
      D.head.appendChild(s);
    });
    return mermaidPronto;
  }
  function temaMermaid() {
    var cs = getComputedStyle(D.documentElement), v = function (n) { return cs.getPropertyValue(n).trim(); };
    W.mermaid.initialize({
      startOnLoad: false, theme: 'base', securityLevel: 'strict', fontSize: 15,
      themeVariables: {
        fontSize: '15px', fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", Roboto, sans-serif',
        background: v('--sup'), mainBkg: v('--sup'), primaryColor: v('--sup'), primaryTextColor: v('--tinta'), primaryBorderColor: v('--tinta2'),
        secondaryColor: v('--sup2'), tertiaryColor: v('--sup'), lineColor: v('--tinta2'), textColor: v('--tinta'), nodeTextColor: v('--tinta'),
        edgeLabelBackground: v('--sup'), clusterBkg: v('--sup'), clusterBorder: v('--fio'), titleColor: v('--tinta')
      },
      flowchart: { useMaxWidth: false, htmlLabels: true, curve: 'basis', nodeSpacing: 34, rankSpacing: 48, padding: 12, diagramPadding: 14 }
    });
  }

  /* o = {grafo, fonte, titulo, didatico, diagrama} */
  function abrir(o) {
    var G = o.grafo, caminho = [], avancando = true, verTudo = !!o.diagrama;
    function comeca() { caminho = G.raizes.length === 1 ? [{ no: G.raizes[0], escolha: '' }] : []; }
    comeca();
    /* Caminho mais curto da raiz até o nó tocado no diagrama. */
    function ramoAte(alvo) {
      var pai = {}, fila = G.raizes.slice(), vistos = new Set(fila);
      while (fila.length) {
        var a = fila.shift(); if (a === alvo) break;
        (G.nos.get(a).saidas || []).forEach(function (s) { if (!vistos.has(s.para)) { vistos.add(s.para); pai[s.para] = [a, s.rotulo]; fila.push(s.para); } });
      }
      var r = [], at = alvo;
      while (pai[at]) { r.unshift({ no: at, escolha: pai[at][1] }); at = pai[at][0]; }
      r.unshift({ no: at, escolha: '' });
      return r;
    }
    W.MTUI.folha({
      titulo: o.titulo, classe: 'folha-fluxo', alta: true,
      conteudo: function (c, api) {
        function topo() {
          return '<div class="ff-topo"><div class="ff-bts"><button type="button" data-acao="fechar">Fechar</button><button type="button" data-acao="modo">' + (verTudo ? 'Passo a passo' : 'Diagrama') + '</button></div>' +
            '<h2 class="ff-tit" data-foco tabindex="-1">' + esc(o.titulo) + '</h2>' + (o.didatico ? '<p class="ff-did">' + MARCA_DID + '</p>' : '') + '</div>';
        }
        function guiado() {
          var at = caminho.length ? G.nos.get(caminho[caminho.length - 1].no) : null, h = topo();
          h += '<nav class="ff-trilha" aria-label="Caminho percorrido"><ol>' + caminho.map(function (p, i) {
            var ult = i === caminho.length - 1, rot = (p.escolha ? p.escolha + ': ' : '') + curto(G.nos.get(p.no).texto);
            return '<li><button type="button" data-ir="' + i + '"' + (ult ? ' aria-current="step" class="ult"' : '') + ' aria-label="Passo ' + (i + 1) + ': ' + esc(rot) + '"><b>' + (i + 1) + '</b><span>' + esc(rot) + '</span></button></li>';
          }).join('') + '</ol></nav>';
          if (at) {
            var tp = tipo(at), n = at.texto.length, tam = n > 110 ? 24 : n > 50 ? 30 : 36;
            h += '<div class="ff-meio"><div class="ff-no ' + (avancando ? 'vem' : 'volta') + '" data-tipo="' + tp + '"><p class="ff-np">Passo ' + caminho.length +
              (tp === 'critico' ? '<span class="ff-tag critico">' + W.MTUI.ic('alert-triangle') + 'Alarme ou decisão crítica</span>' : tp === 'acao' ? '<span class="ff-tag acao">Conduta</span>' : '') + '</p>' +
              '<p class="ff-tx" style="font-size:' + tam + 'px">' + W.MTConduta.textoSimples(at.texto) + '</p></div></div>';
            h += '<div class="ff-saidas">';
            if (!at.saidas.length) {
              h += '<div class="ff-fim"><b>Fim do fluxo</b><p>Caminho percorrido em ' + caminho.length + ' ' + (caminho.length === 1 ? 'passo' : 'passos') + '. Confira o trecho na conduta antes de aplicar.</p></div>' +
                '<button type="button" class="ff-cheio" data-acao="fechar">Voltar à conduta</button>';
            } else if (at.saidas.length === 2 && at.saidas.every(function (s) { return s.rotulo && s.rotulo.length <= 10; })) {
              h += '<div class="ff-par">' + at.saidas.map(function (s) { return '<button type="button" data-para="' + esc(s.para) + '" data-escolha="' + esc(s.rotulo) + '">' + esc(s.rotulo) + '</button>'; }).join('') + '</div>';
            } else {
              var unica = at.saidas.length === 1 && !at.saidas[0].rotulo;
              h += at.saidas.map(function (s) {
                var dest = G.nos.get(s.para).texto.replace(/\n/g, ' ');
                if (unica) return '<button type="button" class="ff-saida cheia" data-para="' + esc(s.para) + '" data-escolha=""><b>Próximo passo</b></button>';
                return '<button type="button" class="ff-saida" data-para="' + esc(s.para) + '" data-escolha="' + esc(s.rotulo || '') + '">' + (s.rotulo ? '<b>' + esc(s.rotulo) + '</b><span>' + esc(dest) + '</span>' : '<b class="so-dest">' + esc(dest) + '</b>') + '</button>';
              }).join('');
            }
          } else {
            h += '<div class="ff-meio ff-ini"><p class="ff-por">Por onde começar?</p>' + G.raizes.map(function (r) {
              return '<button type="button" class="ff-saida" data-para="' + esc(r) + '" data-raiz="1"><b class="so-dest">' + esc(G.nos.get(r).texto.replace(/\n/g, ' ')) + '</b></button>';
            }).join('') + '</div><div class="ff-saidas">';
          }
          var trava = caminho.length <= 1 && G.raizes.length === 1;
          h += '<div class="ff-pe"><button type="button" data-acao="voltar"' + (trava ? ' disabled' : '') + '>Voltar</button><button type="button" data-acao="recomecar"' + (trava ? ' disabled' : '') + '>Recomeçar</button></div></div>';
          c.innerHTML = h;
          var tr = c.querySelector('.ff-trilha'); if (tr) tr.scrollLeft = tr.scrollWidth;
        }
        function diagrama() {
          c.innerHTML = topo() + '<div class="ff-leg"><span class="lg critico">Alarme ou decisão crítica</span><span class="lg acao">Conduta</span></div>' +
            '<p class="ff-dica">Arraste para ver o diagrama todo. Toque numa caixa para seguir dali.</p><div class="ff-diag" tabindex="0" aria-label="Diagrama do fluxograma"><p class="nota">Desenhando o diagrama</p></div>';
          var caixa = c.querySelector('.ff-diag');
          carregaMermaid().then(function (m) {
            temaMermaid();
            return m.render('mtdiag' + (++nDiag), W.MTDados.sanitizeMermaid(o.fonte));
          }).then(function (r) {
            if (!caixa.isConnected) return;
            caixa.innerHTML = r.svg;
            caixa.querySelectorAll('g.node').forEach(function (g) { g.style.cursor = 'pointer'; });
            // cabe na largura quando dá, sem ficar menor que 62% (mesma regra do CondutAI); o início fica à vista
            var svg = caixa.querySelector('svg'), vb = svg && svg.viewBox && svg.viewBox.baseVal;
            if (vb && vb.width > 0) {
              var livre = caixa.clientWidth - 28, e = Math.max(0.62, Math.min(1, livre / vb.width));
              svg.style.width = Math.round(vb.width * e) + 'px'; svg.style.height = Math.round(vb.height * e) + 'px'; svg.style.maxWidth = 'none';
              var raiz = caixa.querySelector('g.node[id*="flowchart-' + G.raizes[0] + '-"]');
              if (raiz) { var rr = raiz.getBoundingClientRect(), cr = caixa.getBoundingClientRect(); caixa.scrollLeft += (rr.left + rr.width / 2) - (cr.left + cr.width / 2); }
            }
          }).catch(function () {
            if (caixa.isConnected) caixa.innerHTML = '<p class="corpo">Não foi possível desenhar o diagrama neste aparelho. Use o passo a passo.</p>';
          });
        }
        function desenha() { if (verTudo) diagrama(); else guiado(); }
        c.addEventListener('click', function (e) {
          var g = e.target.closest('g.node');
          if (g && verTudo) {
            var m = /flowchart-(.+)-\d+$/.exec(g.id || '');
            if (m && G.nos.has(m[1])) { caminho = ramoAte(m[1]); avancando = true; verTudo = false; desenha(); }
            return;
          }
          var a = e.target.closest('button'); if (!a || !c.contains(a)) return;
          var acao = a.dataset.acao;
          if (acao === 'fechar') return api.fechar();
          if (acao === 'modo') { verTudo = !verTudo; return desenha(); }
          if (acao === 'voltar') { avancando = false; if (caminho.length > 1) caminho.pop(); else if (G.raizes.length > 1) caminho = []; return desenha(); }
          if (acao === 'recomecar') { avancando = false; comeca(); return desenha(); }
          if (a.dataset.ir != null && a.dataset.ir !== '') { var i = +a.dataset.ir; if (i < caminho.length - 1) { avancando = false; caminho = caminho.slice(0, i + 1); desenha(); } return; }
          if (a.dataset.para) {
            avancando = true;
            if (a.dataset.raiz) caminho = [{ no: a.dataset.para, escolha: '' }];
            else caminho.push({ no: a.dataset.para, escolha: a.dataset.escolha || '' });
            desenha();
            var no = c.querySelector('.ff-no'); if (no) no.setAttribute('tabindex', '-1'), no.focus({ preventScroll: true });
          }
        });
        desenha();
      }
    });
  }

  W.MTFluxo = { abrir: abrir };
})();
