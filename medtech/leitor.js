/* MedTech PWA: a doença aberta, como LeitorConduta.swift.
   Barra de tópicos com figura e cor própria, uma página por tópico (deslizar troca de tópico),
   camada didática no alto de Tratamento, barra verde "Prescrição pronta", favoritar e "Acompanhar este paciente".
   Expõe window.MTLeitor. */
(function () {
  'use strict';
  var W = window, D = document;
  var U = function () { return W.MTUI; }, C = function () { return W.MTConduta; }, Dd = function () { return W.MTDados; };
  var esc = function (s) { return W.MTUI.esc(s); }, ic = function (n) { return W.MTUI.ic(n); };
  var MARCA_DID = 'Resumo didático derivado desta conduta';
  var AVISO_FIXO = 'Material de apoio à decisão. Não substitui o julgamento clínico nem as diretrizes vigentes. Confirme doses e condutas antes de aplicar ao paciente.';

  /* ---------- favoritas e recentes: ids separados por vírgula (mesmo formato do iPhone) ---------- */
  var K_FAV = 'medtech.condutasFavoritas', K_REC = 'medtech.condutasRecentes';
  function ler(k) { try { return (localStorage.getItem(k) || '').split(',').filter(Boolean); } catch (e) { return []; } }
  function grava(k, l) { try { localStorage.setItem(k, l.join(',')); } catch (e) { } }
  var Listas = {
    favoritas: function () { return ler(K_FAV); },
    recentes: function () { return ler(K_REC); },
    ehFavorita: function (id) { return ler(K_FAV).indexOf(id) >= 0; },
    alternar: function (id) { var l = ler(K_FAV), i = l.indexOf(id); if (i >= 0) l.splice(i, 1); else l.unshift(id); grava(K_FAV, l); return i < 0; },
    comRecente: function (id) { var l = ler(K_REC).filter(function (x) { return x !== id; }); l.unshift(id); grava(K_REC, l.slice(0, 12)); }
  };

  var ESTRELA = function (cheia) {
    return '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" fill="' + (cheia ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
  };

  function figura(icone, cor, tam) {
    return '<span class="figura" style="--cor:' + cor + ';--tam:' + (tam || 40) + 'px" aria-hidden="true">' + ic(icone) + '</span>';
  }
  function corTopico(t) { return 'var(--tp-' + t + ')'; }
  function topico(id) { return C().topicos.filter(function (t) { return t.id === id; })[0]; }

  /* A figura da seção sai do título e, sem palavra-chave, do tipo ou do tópico. */
  var ICONE_TIPO = { perolas: 'bulb', internar: 'bed', diferencial: 'arrows-left-right', tratamento: 'pills', complicacoes: 'alert-triangle', seguimento: 'calendar', populacoes: 'users', sus: 'building-bank', epidemio: 'chart-bar', fisio: 'activity-heartbeat', classificacao: 'list-numbers', diagnostico: 'stethoscope', apresentacao: 'id-badge-2', fluxo: 'git-fork' };
  function iconeSecao(s) {
    var t = C().normal(s.titulo);
    if (/\bexames?\b|laborat/.test(t)) return 'test-pipe-2';
    if (/imagem|ecg|neuroimagem|radiograf/.test(t)) return 'heart-rate-monitor';
    if (t.indexOf('prevencao') >= 0 || t.indexOf('profilaxia') >= 0) return 'shield';
    return ICONE_TIPO[s.tipo] || topico(s.topico).icone;
  }

  var abertos = [];

  function abrir(id) {
    var Dados = Dd(), item = Dados.conduta(id);
    if (!item) return;
    Listas.comRecente(id);
    if (W.MedTechCasca && W.MedTechCasca._aoMudarListas) W.MedTechCasca._aoMudarListas();
    // a mesma doença já aberta mais embaixo sobe para o topo
    abertos.filter(function (l) { return l.id === id; }).forEach(function (l) { l.fecharUI(); });
    var L = new Leitor(item);
    abertos.push(L);
    return L;
  }

  function Leitor(item) {
    var self = this;
    this.id = item.id; this.item = item;
    var el = D.createElement('div');
    el.className = 'leitor';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', item.nome);
    try { if (localStorage.getItem('medtech.tabelaEmGrade') === '1') el.classList.add('em-grade'); } catch (e) { }
    this.el = el;
    var sessao = W.MedTechCasca && W.MedTechCasca.sessoes ? W.MedTechCasca.sessoes.daConduta(item.id) : null;
    var fav = Listas.ehFavorita(item.id);
    el.innerHTML = '<div class="lt-topo"><div class="lt-linha">' +
      '<button type="button" class="lt-volta" data-acao="voltar" aria-label="Voltar">' + ic('chevron-left') + '</button>' +
      '<h1 class="lt-nome">' + esc(item.nome) + '</h1>' +
      '<button type="button" class="lt-fav' + (fav ? ' sim' : '') + '" data-acao="favoritar" aria-label="' + (fav ? 'Tirar das favoritas' : 'Favoritar') + '" aria-pressed="' + fav + '">' + ESTRELA(fav) + '</button></div>' +
      (sessao ? '<button type="button" class="lt-sessao" data-acao="sessao" data-sessao="' + esc(sessao.id) + '">Acompanhar este paciente</button>' : '') +
      '<div class="barra-topicos" role="tablist" aria-label="Tópicos"></div></div>' +
      '<div class="lt-fio"></div><div class="paginas"><div class="lt-carrega" role="status">Abrindo a conduta</div></div>';
    (D.getElementById('app') || D.body).appendChild(el);
    D.body.classList.add('em-detalhe');
    requestAnimationFrame(function () { el.classList.add('vis'); });
    this.fecharUI = U().empilha(function () { self.fechar(); });
    el.addEventListener('click', function (e) { self.clique(e); });
    el.addEventListener('change', function (e) { self.muda(e); });
    el.querySelector('.lt-volta').focus({ preventScroll: true });
    this.carrega();
  }

  Leitor.prototype.carrega = function () {
    var self = this, item = this.item, el = this.el;
    Dd().carregaBanco().then(function () { return Dd().didatica(item.id); }).then(function (camada) {
      self.monta(camada);
    }).catch(function (e) {
      console.warn(e);
      el.querySelector('.paginas').innerHTML = '<div class="lt-carrega"><p>Não foi possível abrir o banco de condutas. Confira a conexão.</p><button type="button" class="bt-leve" data-acao="tentar">Tentar de novo</button></div>';
    });
  }

  Leitor.prototype.fechar = function () {
    var el = this.el, i = abertos.indexOf(this);
    if (i >= 0) abertos.splice(i, 1);
    el.classList.remove('vis');
    if (!abertos.length) D.body.classList.remove('em-detalhe');
    setTimeout(function () { el.remove(); }, U().reduz() ? 0 : 280);
  };

  Leitor.prototype.monta = function (camada) {
    var self = this, item = this.item, Dados = Dd();
    var conta = C().conta(Dados.markdown(item.id), item.id);
    var modelo = Dados.modelo(item.id);
    this.conta = conta; this.camada = camada; this.modelo = modelo;
    this.fluxosReg = [];
    this.cenarios = modelo && modelo.cenarios ? modelo.cenarios.length : 0;
    var topicos = conta.topicos;
    this.topicos = topicos;
    // barra de tópicos
    this.el.querySelector('.barra-topicos').innerHTML = topicos.map(function (t) {
      var tp = topico(t);
      return '<button type="button" role="tab" class="tp" data-topico="' + t + '" style="--cor:' + corTopico(t) + '" aria-selected="false"><span class="tp-c">' + ic(tp.icone) + '</span><span class="tp-n">' + esc(tp.nome) + '</span></button>';
    }).join('');
    var pag = this.el.querySelector('.paginas');
    pag.innerHTML = topicos.map(function (t) {
      return '<section class="pagina" data-topico="' + t + '" style="--cor:' + corTopico(t) + '" role="tabpanel" aria-label="' + esc(topico(t).nome) + '"></section>';
    }).join('');
    topicos.forEach(function (t) {
      var p = pag.querySelector('.pagina[data-topico="' + t + '"]');
      if (t === 'prescricao') W.MTPresc.pagina(p, { item: item, modelo: modelo, rodape: self.rodape(t), doses: self.dosesHTML(), leitor: self });
      else if (t === 'fluxogramas') p.innerHTML = '<div class="rola">' + self.paginaFluxos() + '</div>';
      else p.innerHTML = (t === topicos[0] && self.cenarios ? self.barraPresc() : '') + '<div class="rola">' + self.paginaTopico(t) + '</div>';
    });
    this.ligaPaginas(pag);
    var inicial = topicos[0];
    try { var q = new URLSearchParams(location.search).get('topico'); if (q && topicos.indexOf(q) >= 0 && abertos.length === 1) inicial = q; } catch (e) { }
    this.ir(inicial, true);
  };

  /* ---------- páginas ---------- */
  Leitor.prototype.barraPresc = function () {
    return '<button type="button" class="barra-presc" data-acao="ir" data-topico="prescricao">' + ic('pills') + '<b>Prescrição pronta</b><span>' + (this.cenarios === 1 ? '1 cenário' : this.cenarios + ' cenários') + '</span>' + ic('chevron-right') + '</button>';
  };

  Leitor.prototype.registraFluxo = function (grafo, fonte, titulo, didatico) {
    this.fluxosReg.push({ grafo: grafo, fonte: fonte, titulo: titulo, didatico: !!didatico });
    return this.fluxosReg.length - 1;
  };

  Leitor.prototype.paginaTopico = function (t) {
    var self = this, conta = this.conta, camada = this.camada, h = '';
    var secoes = conta.secoesDe(t);
    var primeiro = t === this.topicos[0];
    if (t === 'tratamento' && camada) h += this.aberturaDidatica(camada);
    if (primeiro) h += conta.abertura.map(function (b) { return '<div class="bloco">' + C().blocoHTML(b, { registraFluxo: self.registraFluxo.bind(self), tituloFluxo: 'Fluxograma' }) + '</div>'; }).join('');
    var temFluxoAqui = conta.fluxos.some(function (f) { return secoes.some(function (s) { return s.id === f.secao; }); });
    if (!temFluxoAqui && conta.fluxos.length) {
      h += '<button type="button" class="entrada-fluxos" data-acao="ir" data-topico="fluxogramas">' + figura('git-fork', corTopico('fluxogramas'), 36) +
        '<span>' + (conta.fluxos.length === 1 ? 'Ver o fluxograma desta doença' : 'Ver os ' + conta.fluxos.length + ' fluxogramas desta doença') + '</span>' + ic('chevron-right') + '</button>';
    }
    secoes.forEach(function (s, n) {
      var tp = C().tituloPartido(s.titulo);
      h += '<div class="sec" id="' + self.id + '-s' + s.id + '" data-sec="' + s.id + '"><div class="sec-cab' + (n === 0 && !conta.abertura.length && !camada ? ' primeira' : '') + '">' + figura(iconeSecao(s), corTopico(t)) +
        '<div><h2>' + esc(tp.principal) + '</h2>' + (tp.sub ? '<p class="sec-sub">' + esc(tp.sub) + '</p>' : '') + '</div></div>';
      var ctx = { emPerolas: t === 'perolas', tituloFluxo: tp.principal, registraFluxo: self.registraFluxo.bind(self) };
      (conta.formas[s.id] || []).forEach(function (f) {
        h += '<div class="forma" id="' + self.id + '-s' + s.id + 'b' + f.id + '" data-b="' + f.blocos.length + '" data-ini="' + f.id + '">' + C().formaHTML(f, ctx) + '</div>';
      });
      h += '</div>';
    });
    if (camada && camada.testeSe && camada.testeSe[t] && camada.testeSe[t].length) h += this.testeSe(camada.testeSe[t]);
    return h + this.rodape(t);
  };

  Leitor.prototype.aberturaDidatica = function (cam) {
    var h = '<div class="did">';
    if (cam.emUmMinuto && cam.emUmMinuto.length) {
      h += '<div class="em1"><h2>' + ic('bolt') + 'Em 1 minuto</h2><ul>' + cam.emUmMinuto.map(function (i) { return '<li>' + C().textoSimples(i.texto, { sobre: true }) + '</li>'; }).join('') +
        '</ul><p class="em1-marca">' + MARCA_DID + '</p></div>';
    }
    if (cam.primeirosPassos && cam.primeirosPassos.length) {
      h += '<div class="pp"><div class="pp-cab">' + figura('walk', 'var(--cor)', 36) + '<h2>Primeiros passos</h2></div><ol class="passos">' +
        cam.primeirosPassos.map(function (i, n) {
          var o = i.origens && i.origens[0];
          return '<li><span class="pa-n">' + (n + 1) + '</span><div class="pa-t"><p>' + C().textoSimples(i.texto) + '</p>' +
            (o ? '<button type="button" class="ver-texto" data-origem="' + esc(o.secao) + '">Ver no texto: ' + esc(C().tituloPartido(o.secao).principal) + '</button>' : '') + '</div></li>';
        }).join('') + '</ol><p class="marca-did">' + MARCA_DID + '</p></div>';
    }
    return h + '</div>';
  };

  Leitor.prototype.testeSe = function (cartas) {
    return '<div class="teste"><div class="pp-cab">' + figura('message-question', 'var(--cor)', 36) + '<h2>Teste-se</h2></div><p class="nota">Toque na carta para ver a resposta.</p>' +
      cartas.map(function (c) {
        var o = c.origens && c.origens[0];
        return '<div class="tc"><button type="button" class="tc-carta" data-acao="carta" aria-expanded="false"><span class="tc-p">' + esc(c.pergunta) + '</span>' +
          '<span class="tc-ver">Ver resposta</span><span class="tc-r">' + C().textoSimples(c.resposta) + '</span></button>' +
          (o ? '<button type="button" class="ver-texto tc-origem" data-origem="' + esc(o.secao) + '">Ver no texto: ' + esc(C().tituloPartido(o.secao).principal) + '</button>' : '') + '</div>';
      }).join('') + '<p class="marca-did">' + MARCA_DID + '</p></div>';
  };

  Leitor.prototype.paginaFluxos = function () {
    var self = this, h = '', cam = this.camada;
    var cartao = function (titulo, grafo, fonte, did) {
      var k = self.registraFluxo(grafo, fonte, titulo, did);
      var raiz = grafo.raizes[0] ? grafo.nos.get(grafo.raizes[0]).texto.replace(/\n/g, ' ') : '';
      return '<div class="cartao-fluxo"><div class="cf-cab">' + figura('git-fork', corTopico('fluxogramas')) + '<div><h2>' + esc(titulo) + '</h2>' + (did ? '<p class="cf-did">' + MARCA_DID + '</p>' : '') + '</div></div>' +
        '<p class="cf-raiz">' + esc(raiz) + '</p><p class="cf-n">' + grafo.nos.size + ' etapas</p>' +
        '<div class="cf-bts"><button type="button" class="cf-passo" data-fluxo="' + k + '">Passo a passo</button><button type="button" class="cf-diag" data-fluxo="' + k + '" data-diagrama="1">Ver diagrama</button></div></div>';
    };
    if (cam && cam.fluxoTratamento) {
      var g = C().parseFluxo(cam.fluxoTratamento.mermaid);
      if (g) h += cartao(cam.fluxoTratamento.titulo, g, cam.fluxoTratamento.mermaid, true);
    }
    this.conta.fluxos.forEach(function (f) { h += cartao(f.titulo, f.grafo, f.fonte, false); });
    return '<div class="fluxos">' + h + '</div>' + this.rodape('fluxogramas');
  };

  /* Doses citadas no próprio texto; cada trecho leva ao contexto. */
  Leitor.prototype.dosesHTML = function () {
    var conta = this.conta, h = '<div class="doses"><h2>Doses citadas nesta doença</h2>';
    var grupos = conta.secoes.map(function (s) { return [s, conta.doses.filter(function (d) { return d.secao === s.id; })]; }).filter(function (g) { return g[1].length; });
    if (!grupos.length) return h + '<p class="nota-g">Nenhum trecho com dose em mg, g, UI ou mL/kg foi identificado no texto desta doença.</p></div>';
    h += '<p class="nota">Trechos do texto. Toque para ler em contexto.</p>';
    grupos.forEach(function (g) {
      h += '<h3>' + esc(C().tituloPartido(g[0].titulo).principal) + '</h3><div class="superficie">' + g[1].map(function (d) {
        return '<button type="button" class="dose-linha" data-secao="' + d.secao + '" data-bloco="' + d.bloco + '">' + C().textoSimples(d.texto) + '</button>';
      }).join('') + '</div>';
    });
    return h + '</div>';
  };

  /* Aviso em toda página; relacionadas e referência só na última. */
  Leitor.prototype.rodape = function (t) {
    var item = this.item, h = '<div class="rodape">';
    if (t === this.topicos[this.topicos.length - 1]) {
      var rel = item.relacionados.map(Dd().conduta).filter(Boolean);
      if (rel.length) h += '<h2>Relacionadas</h2>' + W.MTLeitor.linhas(rel);
      if (item.diretriz) h += '<p class="nota">Referência da conduta: ' + esc(item.diretriz) + '</p>';
    }
    return h + '<p class="nota">' + AVISO_FIXO + '</p></div>';
  };

  /* ---------- troca de tópico: toque na barra ou deslizar a página ---------- */
  Leitor.prototype.ligaPaginas = function (pag) {
    var self = this, t = null;
    pag.addEventListener('scroll', function () {
      if (self.programado) return;
      clearTimeout(t);
      t = setTimeout(function () {
        var i = Math.round(pag.scrollLeft / Math.max(1, pag.clientWidth));
        var tp = self.topicos[i];
        if (tp && tp !== self.atual) self.ir(tp, false, true);
      }, 90);
    }, { passive: true });
    // baralho de pérolas: contador acompanha a carta
    pag.querySelectorAll('.ba-cartas').forEach(function (b) {
      b.addEventListener('scroll', function () {
        var cs = b.children; if (!cs.length) return;
        var w = cs[0].getBoundingClientRect().width + 12, n = Math.min(cs.length - 1, Math.round(b.scrollLeft / w));
        var bar = b.closest('.baralho');
        if (!bar.classList.contains('lista')) bar.querySelector('.ba-conta').textContent = 'Pérola ' + (n + 1) + ' de ' + cs.length + '. Deslize para o lado.';
      }, { passive: true });
    });
  };

  Leitor.prototype.ir = function (t, inicial, doDeslize) {
    var self = this, el = this.el;
    if (!t || this.topicos.indexOf(t) < 0) return;
    this.atual = t;
    el.style.setProperty('--cor', corTopico(t));
    el.querySelectorAll('.tp').forEach(function (b) {
      var sel = b.dataset.topico === t;
      b.classList.toggle('sel', sel);
      b.setAttribute('aria-selected', sel ? 'true' : 'false');
      if (sel) {
        var barra = b.parentElement, alvo = b.offsetLeft - (barra.clientWidth - b.offsetWidth) / 2;
        barra.scrollTo({ left: alvo, behavior: inicial || U().reduz() ? 'auto' : 'smooth' });
      }
    });
    if (!doDeslize) {
      var pag = el.querySelector('.paginas'), i = this.topicos.indexOf(t);
      this.programado = true;
      pag.scrollTo({ left: i * pag.clientWidth, behavior: inicial || U().reduz() ? 'auto' : 'smooth' });
      clearTimeout(this._prog);
      this._prog = setTimeout(function () { self.programado = false; }, inicial ? 50 : 650);
    }
  };

  /* Leva ao trecho: troca o tópico, rola e realça por um instante. */
  Leitor.prototype.irParaSecao = function (secId, bloco) {
    var s = this.conta.secoes.filter(function (x) { return x.id === secId; })[0];
    if (!s) return;
    this.ir(s.topico);
    var alvo = D.getElementById(this.id + '-s' + secId);
    if (bloco != null) {
      var fs = alvo ? alvo.querySelectorAll('.forma') : [];
      for (var k = 0; k < fs.length; k++) { var ini = +fs[k].dataset.ini, n = +fs[k].dataset.b; if (bloco >= ini && bloco < ini + n) { alvo = fs[k]; break; } }
    }
    if (!alvo) return;
    setTimeout(function () {
      alvo.scrollIntoView({ behavior: U().reduz() ? 'auto' : 'smooth', block: bloco != null ? 'center' : 'start' });
      if (bloco != null) { alvo.classList.add('destaque'); setTimeout(function () { alvo.classList.remove('destaque'); }, 2600); }
    }, U().reduz() ? 0 : 380);
  };
  Leitor.prototype.irParaTitulo = function (titulo) {
    var s = this.conta.secoes.filter(function (x) { return x.titulo === titulo; })[0];
    if (s) this.irParaSecao(s.id, null);
  };

  /* ---------- toques ---------- */
  Leitor.prototype.clique = function (e) {
    var self = this, a = e.target.closest('a, button, summary');
    if (!a || !this.el.contains(a)) return;
    if (a.dataset.conduta) { e.preventDefault(); abrir(a.dataset.conduta); return; }
    if (a.dataset.bula) { e.preventDefault(); abreBula(a.dataset.bula); return; }
    if (a.dataset.fluxo != null && a.dataset.fluxo !== '') {
      var f = this.fluxosReg[+a.dataset.fluxo];
      if (f) W.MTFluxo.abrir({ grafo: f.grafo, fonte: f.fonte, titulo: f.titulo, didatico: f.didatico, diagrama: !!a.dataset.diagrama });
      return;
    }
    if (a.dataset.origem) { this.irParaTitulo(a.dataset.origem); return; }
    if (a.classList.contains('dose-linha')) { this.irParaSecao(+a.dataset.secao, +a.dataset.bloco); return; }
    if (a.classList.contains('tp')) { if (a.dataset.topico !== this.atual) this.ir(a.dataset.topico); return; }
    var acao = a.dataset.acao;
    if (acao === 'voltar') return this.fecharUI();
    if (acao === 'tentar') { this.el.querySelector('.paginas').innerHTML = '<div class="lt-carrega" role="status">Abrindo a conduta</div>'; return this.carrega(); }
    if (acao === 'ir') return this.ir(a.dataset.topico);
    if (acao === 'favoritar') {
      var sim = Listas.alternar(this.id);
      a.classList.toggle('sim', sim);
      a.innerHTML = ESTRELA(sim);
      a.setAttribute('aria-pressed', sim);
      a.setAttribute('aria-label', sim ? 'Tirar das favoritas' : 'Favoritar');
      if (!U().reduz()) { a.classList.remove('pula'); void a.offsetWidth; a.classList.add('pula'); }
      if (W.MedTechCasca && W.MedTechCasca._aoMudarListas) W.MedTechCasca._aoMudarListas();
      return;
    }
    if (acao === 'sessao') { W.MedTechCasca.sessoes.abrir(a.dataset.sessao); return; }
    if (acao === 'tabela-modo') {
      var g = !this.el.classList.contains('em-grade');
      abertos.forEach(function (l) { l.el.classList.toggle('em-grade', g); });
      try { localStorage.setItem('medtech.tabelaEmGrade', g ? '1' : '0'); } catch (x) { }
      return;
    }
    if (acao === 'crit-limpa') {
      var cr = a.closest('.criterios');
      cr.querySelectorAll('input').forEach(function (i) { i.checked = false; });
      this.contaCriterios(cr);
      return;
    }
    if (acao === 'dif-todos') {
      var ds = a.closest('.difs').querySelectorAll('details'), todos = Array.prototype.every.call(ds, function (d) { return d.open; });
      ds.forEach(function (d) { d.open = !todos; });
      a.textContent = !todos ? 'Fechar todos' : a.dataset.n + ' itens. Toque para abrir ou abra todos';
      return;
    }
    if (acao === 'baralho-modo') {
      var b = a.closest('.baralho'), lista = !b.classList.contains('lista');
      b.classList.toggle('lista', lista);
      a.textContent = lista ? 'Ver em baralho' : 'Ver em lista';
      b.querySelector('.ba-conta').textContent = lista ? b.dataset.n + ' pérolas' : 'Pérola 1 de ' + b.dataset.n + '. Deslize para o lado.';
      if (!lista) b.querySelector('.ba-cartas').scrollLeft = 0;
      return;
    }
    if (acao === 'carta') {
      var v = a.getAttribute('aria-expanded') !== 'true';
      a.setAttribute('aria-expanded', v);
      a.parentElement.classList.toggle('virada', v);
      return;
    }
    if (a.tagName === 'SUMMARY') {
      // diferencial: o botão "abra todos" acompanha
      setTimeout(function () {
        var difs = a.closest('.difs'); if (!difs) return;
        var bt = difs.querySelector('.dif-todos'), ds = difs.querySelectorAll('details');
        var todos = Array.prototype.every.call(ds, function (d) { return d.open; });
        bt.textContent = todos ? 'Fechar todos' : bt.dataset.n + ' itens. Toque para abrir ou abra todos';
      }, 0);
    }
  };
  Leitor.prototype.muda = function (e) {
    var i = e.target;
    if (i.dataset && i.dataset.acao === 'crit') this.contaCriterios(i.closest('.criterios'));
  };
  Leitor.prototype.contaCriterios = function (cr) {
    var n = cr.querySelectorAll('input:checked').length;
    cr.querySelector('.cr-conta').textContent = 'Marcados: ' + n + ' de ' + cr.dataset.total;
    cr.querySelector('.cr-limpa').hidden = !n;
  };

  /* ---------- bula do Banco MedTech ---------- */
  function abreBula(id) {
    var b = Dd().bula(id);
    if (!b) return;
    U().folha({
      titulo: 'Bula de ' + b.nome, classe: 'folha-bula', alta: true,
      conteudo: function (c, api) {
        var doc = C().documento(b.md);
        var h = '<div class="folha-cab"><span></span><h2 data-foco tabindex="-1">' + esc(b.nome) + '</h2><button type="button" class="fc-dir" data-acao="fechar">Fechar</button></div><div class="bula-texto">';
        h += doc.abertura.map(function (x) { return C().blocoHTML(x, {}); }).join('');
        h += '<div class="superficie bula-secs">' + doc.secoes.map(function (s) {
          return '<details class="bula-sec"><summary><span>' + esc(C().tituloPartido(s.titulo).principal) + '</span>' + ic('chevron-down') + '</summary><div class="bula-corpo">' +
            s.blocos.map(function (x) { return C().blocoHTML(x, { emPerolas: s.tipo === 'perolas' }); }).join('') + '</div></details>';
        }).join('') + '</div>';
        c.innerHTML = h + '<p class="nota">Bula do Banco MedTech. Confirme na bula oficial.</p></div>';
        c.querySelector('[data-acao="fechar"]').addEventListener('click', api.fechar);
      }
    });
  }

  /* Lista em superfície com o traço da área (LinhaConsulta.swift). */
  function linhas(lista, detalhe) {
    return '<div class="superficie">' + lista.map(function (c) {
      var det = detalhe ? detalhe(c) : null;
      return '<a class="linha" href="?conduta=' + esc(c.id) + '" data-conduta="' + esc(c.id) + '"><span class="traco' + (det ? ' alto' : '') + '" style="--cor:' + corArea(c.area) + '"></span><span class="li-tx"><span class="li-n">' + (c.nomeHTML || esc(c.nome)) + '</span>' + (det ? '<span class="li-d">' + esc(det) + '</span>' : '') + '</span></a>';
    }).join('') + '</div>';
  }
  function corArea(a) { return 'var(--area-' + (/^(emergencia|cardio|infecto|pneumo|endocrino|neuro|gastro|nefro|hemato|reumato|gineco|psiq)$/.test(a) ? a : 'outra') + ')'; }

  W.MTLeitor = { abrir: abrir, abreBula: abreBula, linhas: linhas, corArea: corArea, Listas: Listas, abertos: abertos };
})();
