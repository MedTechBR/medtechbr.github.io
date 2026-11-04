/* MedTech PWA: as Ferramentas, igual ao app de iPhone (MedTech/Ferramentas/*.swift).
   Liga-se à casca só pelos pontos de encaixe: MedTechCasca.registrar('ferramenta', ...) e ('busca', ...).
   As contas, doses, escores e textos saem do JS original do site pelo motor (fer-motor.js): nada clínico é escrito aqui.
   A linha "Acompanhar paciente" (sessoes) segue para o encaixe das sessões da casca.
   Teste: ?demo=1&ferramenta=calculadoras/imc (como o argumento -ferramenta= do iPhone). Expõe window.MTFer. */
(function () {
  'use strict';
  var W = window, D = document;
  var U = W.MTUI, F = W.MTFerUI, Mo = W.MTFerMotor;
  var esc = U.esc, ic = U.ic, mk = F.mk, sem = F.sem;

  var motor = Mo.criar(function (p) {
    return fetch('../' + p).then(function (r) { if (!r.ok) throw new Error(p + ' ' + r.status); return r.text(); });
  });
  var norm = Mo.norm;
  function lerLista(k) { try { return (localStorage.getItem(k) || '').split(',').filter(Boolean); } catch (e) { return []; } }
  function gravaLista(k, l) { try { localStorage.setItem(k, l.join(',')); } catch (e) { } }

  /* ====================================================================== CALCULADORAS (Calculadoras.swift) */
  var K_FAV = 'medtech.calc.favoritas', K_REC = 'medtech.calc.recentes';
  var Prefs = {
    favoritas: function () { return lerLista(K_FAV); },
    recentes: function () { return lerLista(K_REC); },
    alternar: function (id) { var l = lerLista(K_FAV), i = l.indexOf(id); if (i >= 0) l.splice(i, 1); else l.unshift(id); gravaLista(K_FAV, l); },
    usar: function (id) { var r = lerLista(K_REC).filter(function (x) { return x !== id; }); r.unshift(id); gravaLista(K_REC, r.slice(0, 6)); }
  };
  function estrela(cheia) {
    return '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" fill="' + (cheia ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
  }

  function abrirCalc(item) {
    motor.calc().then(function (C) {
      var d = item && C.dados.calculadoras.filter(function (x) { return x.id === item; })[0];
      if (d) telaCalc(C, d); else listaCalc(C);
    }, function () { var t = F.tela({ ferramenta: 'calculadoras', titulo: 'Calculadoras', grande: true, corTitulo: true }); F.carregando(t, motor.calc(), function () { }); t.reabrir = function () { abrirCalc(item); }; });
  }
  function listaCalc(C) {
    var t = F.tela({ ferramenta: 'calculadoras', titulo: 'Calculadoras', grande: true, corTitulo: true });
    var abertos = {}, q = '';
    var achar = function (id) { return C.dados.calculadoras.filter(function (x) { return x.id === id; })[0]; };
    t.rola.innerHTML = '<div style="padding-bottom:6px">' + F.busca('Buscar calculadora', '') + '</div><div class="lc"></div>' + F.aviso('As calculadoras são ferramenta de apoio. Confira os valores e use o julgamento clínico: a decisão é do profissional.');
    var corpo = t.q('.lc');
    function desenha() {
      var n = norm(q).split(' ').filter(Boolean), h = '';
      if (!n.length) {
        var favs = Prefs.favoritas().map(achar).filter(Boolean);
        var recs = Prefs.recentes().filter(function (x) { return Prefs.favoritas().indexOf(x) < 0; }).map(achar).filter(Boolean);
        if (favs.length) h += F.sobre('Favoritas') + favs.map(function (d) { return F.linha(d.nome, null, null, 'data-acao="abre" data-id="' + esc(d.id) + '"'); }).join('');
        if (recs.length) h += F.sobre('Recentes') + recs.map(function (d) { return F.linha(d.nome, null, null, 'data-acao="abre" data-id="' + esc(d.id) + '"'); }).join('');
        h += F.sobre('Todas, por área');
        h += C.dados.grupos.map(function (g) {
          var itens = C.dados.calculadoras.filter(function (x) { return x.grupo === g; });
          return F.recolhivel({ titulo: g, detalhe: String(itens.length), tam: 20, botao: true, recuo: true, chave: g, aberto: !!abertos[g],
            conteudo: itens.map(function (d) { return F.linha(d.nome, null, 18, 'data-acao="abre" data-id="' + esc(d.id) + '"'); }).join('') });
        }).join('');
      } else {
        var lista = C.dados.calculadoras.filter(function (d) { return n.every(function (p) { return d.chave.indexOf(p) >= 0; }); });
        var pre = function (d) { return norm(d.nome).indexOf(n[0]) === 0 ? 0 : 1; };
        lista = lista.map(function (d, i) { return [d, i]; }).sort(function (a, b) { return pre(a[0]) - pre(b[0]) || a[1] - b[1]; }).map(function (x) { return x[0]; });
        h = lista.length ? lista.map(function (d) { return F.linha(d.nome, d.grupo, null, 'data-acao="abre" data-id="' + esc(d.id) + '"'); }).join('')
          : '<p class="fer-nada">Nada encontrado. Tente um termo como renal, sepse ou AVC.</p>';
      }
      corpo.innerHTML = h;
    }
    t.aoRec = function (b, aberto) { if (b.dataset.chave) abertos[b.dataset.chave] = aberto; };
    t.q('.fer-busca input').addEventListener('input', function (e) { q = e.target.value; desenha(); });
    t.acoes.abre = function (b) { var d = achar(b.dataset.id); if (!d) return; var c = telaCalc(C, d); c.aoFechar.push(desenha); };
    desenha();
    return t;
  }
  function ehCurta(ops) {
    if (ops.length > 3) return false;
    var maior = Math.max.apply(null, ops.map(function (o) { return o.t.length; }).concat([0]));
    return ops.length === 2 ? maior <= 16 : maior <= 11;
  }
  function telaCalc(C, def) {
    var fav = function () { return Prefs.favoritas().indexOf(def.id) >= 0; };
    var bt = function () { return '<button type="button" class="fer-estrela' + (fav() ? ' sim' : '') + '" data-acao="fav" aria-pressed="' + fav() + '" aria-label="' + (fav() ? 'Tirar das favoritas' : 'Marcar como favorita') + '">' + estrela(fav()) + '</button>'; };
    var t = F.tela({ ferramenta: 'calculadoras', titulo: def.nome, direita: bt() });
    Prefs.usar(def.id);
    var est = C.estado(def), campos = C.motor.campos(def), aberta = null, copiado = false, tCop = null;
    var porId = {}; campos.forEach(function (c) { porId[c.id] = c; });
    var opsDe = function (c) { return est.opcoes[c.id] || c.opcoes || []; };
    var longa = function (c) { return c.tipo === 'escolha' && !ehCurta(opsDe(c)); };
    function painel() {
      var r = est.resultado;
      if (!r) { t.fixo.innerHTML = '<div class="calc-res fx-neutra"><span class="vazio1">Resultado</span><span class="vazio2">Preencha os campos para calcular.</span></div>'; return; }
      var fx = Mo.faixaCalc(r.badge), interp = r.interp && r.interp !== '—' ? r.interp : '';
      var tam = (r.val + r.unit).length > 18 ? ' muito' : (r.val + r.unit).length > 11 ? ' longo' : '';
      t.fixo.innerHTML = '<div class="calc-res fx-' + fx + '" role="status" aria-live="polite"><p class="val' + tam + '">' + esc(r.val) + (r.unit ? '<small>' + esc(r.unit) + '</small>' : '') + '</p>' +
        '<div class="lin">' + F.iconeFaixa(fx) + (interp ? '<span class="interp' + (interp.length > 70 ? ' pequeno' : '') + '">' + esc(interp) + '</span>' : '<span style="flex:1"></span>') +
        '<button type="button" class="copiar" data-acao="copiar" aria-label="Copiar o resultado para colar na evolução">' + (copiado ? 'Copiado' : 'Copiar') + '</button></div></div>';
    }
    function campoHTML(c) {
      if (c.tipo === 'numero') return F.campoNumero(t, { id: c.id, rotulo: c.rotulo, dica: c.dica, valor: est.valores[c.id] });
      if (c.tipo === 'marcar') return '<button type="button" class="fer-marcar" data-acao="marcar" data-campo="' + esc(c.id) + '" aria-pressed="' + !!est.marcados[c.id] + '"><span>' + esc(c.rotulo) + '</span>' + ic('check') + '</button>';
      if (c.tipo === 'data') { var hoje = new Date(); hoje = new Date(hoje.getTime() - hoje.getTimezoneOffset() * 60000).toISOString().slice(0, 10); return '<div class="fer-data"><label class="fer-rotulo" for="' + t.id + '-' + esc(c.id) + '">' + esc(c.rotulo) + '</label><input type="date" id="' + t.id + '-' + esc(c.id) + '" data-campo="' + esc(c.id) + '" max="' + hoje + '"></div>'; }
      return '<div data-escolha="' + esc(c.id) + '">' + escolhaHTML(c) + '</div>';
    }
    function escolhaHTML(c) {
      var ops = opsDe(c), v = est.valores[c.id] || '';
      if (ehCurta(ops)) return '<div class="fer-pilha" style="gap:6px"><span class="fer-rotulo">' + esc(c.rotulo) + '</span>' + F.segmentos(ops.map(function (o) { return { id: o.v, nome: o.t }; }), v, 'data-acao="esc" data-campo="' + esc(c.id) + '"') + '</div>';
      var atual = (ops.filter(function (o) { return o.v === v; })[0] || {}).t || '', ab = aberta === c.id;
      return '<div class="fer-longa' + (ab ? ' aberta' : '') + '"><button type="button" data-acao="longa" data-campo="' + esc(c.id) + '" aria-expanded="' + ab + '"><span>' + esc(c.rotulo) + '</span><b>' + esc(atual) + '</b></button>' +
        (ab ? '<div class="fer-ops">' + ops.map(function (o) { return '<button type="button" data-acao="op" data-campo="' + esc(c.id) + '" data-v="' + esc(o.v) + '" aria-pressed="' + (o.v === v) + '">' + esc(o.t) + '</button>'; }).join('') + '</div>' : '') + '</div>';
    }
    function grupoHTML(g) {
      if (g.g === 'grid2' || g.g === 'grid3') {
        var nums = g.campos.filter(function (c) { return c.tipo === 'numero'; }), outros = g.campos.filter(function (c) { return c.tipo !== 'numero'; });
        return (nums.length ? '<div class="fer-linha-campos">' + nums.map(campoHTML).join('') + '</div>' : '') + outros.map(campoHTML).join('');
      }
      if (g.g === 'checks') return '<div class="fer-pilha" style="gap:8px">' + g.campos.map(campoHTML).join('') + '</div>';
      return g.campos.map(campoHTML).join('');
    }
    function form() {
      t.rola.innerHTML = '<div class="fer-pilha" style="padding-top:4px"><p class="fer-desc">' + esc(def.desc) + '</p>' + def.grupos.map(grupoHTML).join('') +
        '<div><button type="button" class="fer-leve" data-acao="limpar" style="margin-top:6px">Limpar</button>' + F.aviso('Ferramenta de apoio à decisão. Confira os valores e use o julgamento clínico: a responsabilidade pela conduta é do profissional.') + '</div></div>';
    }
    /* depois de uma ação do original (lista dependente, diluição), a tela relê o estado sem mexer no campo em uso */
    function sincroniza() {
      campos.forEach(function (c) {
        if (c.tipo === 'numero') { var i = t.q('[data-campo="' + c.id + '"]'); if (i && i !== D.activeElement && i.value !== (est.valores[c.id] || '')) i.value = est.valores[c.id] || ''; }
        else if (c.tipo === 'escolha') redesenhaEscolha(c);
        else if (c.tipo === 'marcar') { var m = t.q('[data-campo="' + c.id + '"]'); if (m) m.setAttribute('aria-pressed', !!est.marcados[c.id]); }
      });
    }
    function redesenhaEscolha(c) { var w = t.q('[data-escolha="' + c.id + '"]'); if (w) w.innerHTML = escolhaHTML(c); }
    function definir(c, v) { est.definir(c, v); if (c.acao) sincroniza(); painel(); }
    t.el.addEventListener('input', function (e) { var x = e.target; if (x.matches('input[data-num]')) definir(porId[x.dataset.campo], x.value); });
    t.el.addEventListener('change', function (e) { var x = e.target; if (x.matches('input[type="date"]')) definir(porId[x.dataset.campo], x.value); });
    t.acoes.marcar = function (b) { var c = porId[b.dataset.campo], v = b.getAttribute('aria-pressed') !== 'true'; est.marcar(c, v); b.setAttribute('aria-pressed', v); painel(); };
    t.acoes.esc = function (b) { var c = porId[b.dataset.campo]; if (b.getAttribute('aria-pressed') === 'true') return; definir(c, b.dataset.v); F.marcaSeg(b.parentNode, b.dataset.v); };
    t.acoes.longa = function (b) { var c = porId[b.dataset.campo], ant = aberta; aberta = aberta === c.id ? null : c.id; if (ant && porId[ant]) redesenhaEscolha(porId[ant]); redesenhaEscolha(c); };
    t.acoes.op = function (b) {
      var c = porId[b.dataset.campo];
      definir(c, b.dataset.v);
      var i = campos.indexOf(c), prox = campos.slice(i + 1).filter(longa)[0];
      aberta = prox ? prox.id : null;
      redesenhaEscolha(c);
      if (prox) {
        redesenhaEscolha(prox);
        setTimeout(function () { var w = t.q('[data-escolha="' + prox.id + '"]'); if (w) w.scrollIntoView({ block: 'start', behavior: U.reduz() ? 'auto' : 'smooth' }); }, 180);
      }
    };
    t.acoes.limpar = function () { var f = D.activeElement; if (f && f.blur) f.blur(); est.reiniciar(); aberta = null; form(); painel(); };
    t.acoes.copiar = function () {
      var r = est.resultado; if (!r) return;
      F.copiar(Mo.textoCopiarCalc(def.nome, r)); copiado = true; painel();
      clearTimeout(tCop); tCop = setTimeout(function () { copiado = false; painel(); }, 1400);
    };
    t.acoes.fav = function () { Prefs.alternar(def.id); t.direita(bt()); };
    /* escala só de pontos abre a primeira pergunta; com campo numérico, os números vêm primeiro */
    if (!campos.some(function (c) { return c.tipo === 'numero'; })) { var p = campos.filter(longa)[0]; if (p) aberta = p.id; }
    form(); painel();
    return t;
  }

  /* ====================================================================== ANTIBIÓTICOS (Antibioticos.swift) */
  function rotaATB(item) {
    var fixas = { ivvo: ['ivvo'], cobertura: ['cobertura'], dose: ['dose', null], empirico: ['empirico'], dirigida: ['listaDirigida'], pediatria: ['pediatria'], assistente: ['assistente'] };
    if (fixas[item]) return fixas[item];
    var p = String(item || '').split(':');
    if (p.length < 2) return null;
    var resto = p.slice(1).join(':');
    return { foco: ['foco', resto], guia: ['guia', resto], germe: ['germe', resto], droga: ['droga', resto], dose: ['dose', resto] }[p[0]] || null;
  }
  function abrirATB(item) {
    motor.atb().then(function (A) {
      var r = item && rotaATB(item);
      if (r) destinoATB(A, r); else inicioATB(A);
    }, function () { var t = F.tela({ ferramenta: 'antibioticos', titulo: 'Antibióticos', grande: true, corTitulo: true }); F.carregando(t, motor.atb(), function () { }); t.reabrir = function () { abrirATB(item); }; });
  }
  function destinoATB(A, r) {
    var b = A.dados, k = r[0], id = r[1];
    var ach = function (l, i) { return l.filter(function (x) { return x.id === i; })[0]; };
    switch (k) {
      case 'listaFoco': return listaATB('Por foco', 'Qual o foco?', b.focos.map(function (f) { return F.linha(f.nome, null, 21, 'data-acao="ir" data-rota="foco:' + esc(f.id) + '"'); }).join(''), A);
      case 'listaGerme': return listaATB('Por germe', 'Qual o germe?',
        b.guia.filter(function (g) { return g.cat === 'Bactérias'; }).map(function (g) { return F.linha(g.nome, null, 20, 'data-acao="ir" data-rota="guia:' + esc(g.id) + '"'); }).join('') +
        F.sobre('Mecanismos de resistência') + b.guia.filter(function (g) { return g.cat !== 'Bactérias'; }).map(function (g) { return F.linha(g.nome, null, 20, 'data-acao="ir" data-rota="guia:' + esc(g.id) + '"'); }).join(''), A);
      case 'listaDroga': return listaATB('Por droga', 'Qual o antimicrobiano?', listaDrogasATB(b, 'ir', 'droga:'), A);
      case 'listaDirigida': return listaATB('Terapia dirigida', 'Qual o germe isolado?', b.dirigida.map(function (g) { return F.linha(g.g, null, 20, 'data-acao="ir" data-rota="germe:' + esc(g.id) + '"'); }).join('') + F.aviso(b.textos.dirigida), A);
      case 'foco': var f = ach(b.focos, id); return f && telaFocoATB(A, f);
      case 'guia': var g = ach(b.guia, id); return g && telaGuiaATB(A, g);
      case 'germe': var ge = ach(b.dirigida, id); return ge && telaGermeATB(A, ge);
      case 'droga': var d = ach(b.drogas, id); return d && telaDrogaATB(A, d);
      case 'dose': return telaDoseATB(A, id ? ach(b.drogas, id) : null);
      case 'empirico': return telaEmpiricoATB(A);
      case 'cobertura': return telaCoberturaATB(A);
      case 'ivvo': var t = F.tela({ ferramenta: 'antibioticos', titulo: 'IV para VO', grande: true }); t.rola.innerHTML = '<div class="fer-pilha g10">' + F.blocos(b.ivvo.blocos, 19) + F.aviso(b.ivvo.aviso) + '</div>'; return t;
      case 'pediatria': return telaPediatriaATB(A);
      case 'assistente': return F.telaAssistente({ ferramenta: 'antibioticos', titulo: 'Assistente de antibióticos', dica: 'Sua pergunta sobre antibióticos', sugestoes: b.assistente.sugestoes, aviso: b.assistente.aviso, chat: A.motor.chat });
    }
  }
  function ligaRotasATB(t, A) { t.acoes.ir = function (b) { var r = b.dataset.rota.split(':'); destinoATB(A, r.length > 1 ? [r[0], r.slice(1).join(':')] : rotaATB(r[0])); }; }
  function inicioATB(A) {
    var t = F.tela({ ferramenta: 'antibioticos', titulo: 'Antibióticos', grande: true, corTitulo: true });
    var ops = [['Por foco', 'listaFoco'], ['Por germe', 'listaGerme'], ['Por droga', 'listaDroga'], ['Corrigir dose', 'dose'], ['Empírico', 'empirico'], ['Terapia dirigida', 'listaDirigida'], ['Cobertura', 'cobertura'], ['IV para VO', 'ivvo'], ['Pediatria', 'pediatria'], ['Perguntar à IA', 'assistente']];
    t.rola.innerHTML = '<div style="padding-bottom:6px">' + F.busca('Foco, germe ou antimicrobiano', '') + '</div><div class="ia-corpo"></div>';
    var corpo = t.q('.ia-corpo'), L = null, q = '';
    function desenha() {
      var n = norm(q).trim();
      if (!n) { corpo.innerHTML = '<div class="atb-grade">' + ops.map(function (o) { return '<button type="button" data-acao="op" data-k="' + o[1] + '">' + esc(o[0]) + '</button>'; }).join('') + '</div>'; return; }
      if (!L) { corpo.innerHTML = '<p class="fer-nada">Buscando</p>'; motor.indiceDe('antibioticos').then(function (x) { L = x; desenha(); }); return; }
      var r = Mo.buscar(L, n, 'antibioticos', 30);
      corpo.innerHTML = r.length ? r.map(function (x) { return F.linha(x.titulo, x.detalhe, null, 'data-acao="ir" data-rota="' + esc(x.id.slice('antibioticos/'.length)) + '"'); }).join('')
        : '<p class="fer-nada">Nada encontrado. Busque pelo foco, pelo germe ou pelo nome do antibiótico.</p>';
    }
    t.q('.fer-busca input').addEventListener('input', function (e) { q = e.target.value; desenha(); });
    t.acoes.op = function (b) { destinoATB(A, b.dataset.k === 'dose' ? ['dose', null] : [b.dataset.k]); };
    ligaRotasATB(t, A);
    desenha();
    return t;
  }
  function listaATB(titulo, pergunta, conteudo, A) {
    var t = F.tela({ ferramenta: 'antibioticos', titulo: titulo });
    t.rola.innerHTML = '<h2 class="fer-pergunta">' + esc(pergunta) + '</h2>' + conteudo;
    ligaRotasATB(t, A);
    return t;
  }
  function listaDrogasATB(b, acao, prefixo) {
    return ['Antibacterianos', 'Antifúngicos', 'Antituberculose'].map(function (g) {
      return F.sobre(g) + b.drogas.filter(function (d) { return d.grupo === g; }).map(function (d) { return F.linha(d.nome, null, 20, 'data-acao="' + acao + '" data-rota="' + prefixo + esc(d.id) + '" data-id="' + esc(d.id) + '"'); }).join('');
    }).join('');
  }
  /* "**Internado:** ceftriaxona..." vira rótulo pequeno e esquema grande (EsquemaATB) */
  function esquemaLinha(s) {
    if (s.charAt(0) === '\u0001') {
      var fim = s.indexOf('\u0002');
      if (fim > 0) {
        var rot = s.slice(1, fim), resto = s.slice(fim + 1).trim();
        if (/:$/.test(rot) && resto) return '<div><p class="rot">' + esc(sem(rot.slice(0, -1))) + '</p><p class="esq">' + mk(resto) + '</p></div>';
      }
    }
    return '<p class="esq">' + mk(s) + '</p>';
  }
  function esquemaATB(bs) {
    return '<div class="atb-esq">' + bs.map(function (b) {
      if (b.t === 'l') return (b.i || []).map(esquemaLinha).join('');
      if (b.t === 'p') return esquemaLinha(b.x || '');
      return F.blocos([b], 20);
    }).join('') + '</div>';
  }
  var APOIO = /^(Germes|Duração|Alergia|Quando suspeitar|Princípios|Descalonamento|Redosagem)/;
  function conteudoFocoATB(t, foco, aberto) {
    var esq = foco.secoes.filter(function (s) { return !APOIO.test(sem(s.titulo)); }), apo = foco.secoes.filter(function (s) { return APOIO.test(sem(s.titulo)); });
    var semC = function (b) { return b.filter(function (x) { return x.t !== 'c'; }); };
    var caixas = [].concat.apply([], foco.secoes.map(function (s) { return s.blocos; })).filter(function (b) { return b.t === 'c'; });
    if (aberto === undefined) aberto = 0;
    var h = '<div class="fer-pilha g10">' + esq.map(function (s, i) {
      return '<div class="atb-cen"><button type="button" data-acao="cen" data-i="' + i + '" aria-expanded="' + (i === aberto) + '">' + esc(F.tit(sem(s.titulo))) + '</button><div' + (i === aberto ? '' : ' hidden') + '>' + esquemaATB(semC(s.blocos)) + '</div></div>';
    }).join('');
    if (caixas.length) h += '<div style="padding-top:6px">' + F.blocos(caixas) + '</div>';
    h += '<div>' + apo.map(function (s) { return F.recolhivel({ titulo: sem(s.titulo), conteudo: F.blocos(semC(s.blocos)) }); }).join('') + '</div></div>';
    t.acoes.cen = function (b) {
      var lig = b.getAttribute('aria-expanded') !== 'true';
      [].forEach.call(b.closest('.fer-pilha').querySelectorAll('.atb-cen > button'), function (x) { x.setAttribute('aria-expanded', 'false'); x.nextElementSibling.hidden = true; });
      b.setAttribute('aria-expanded', lig); b.nextElementSibling.hidden = !lig;
    };
    return h;
  }
  function telaFocoATB(A, foco) {
    var t = F.tela({ ferramenta: 'antibioticos', titulo: foco.nome, grande: true });
    t.rola.innerHTML = '<div class="fer-pilha g12">' + conteudoFocoATB(t, foco) + '<div class="ia" style="padding-top:8px"></div>' + F.aviso(A.dados.textos.item) + '</div>';
    F.painelIA(t, t.q('.ia'), { rotulo: 'Casos, doses e detalhes com a IA', pedido: function () { return A.motor.aprofundar(foco.id); } });
    return t;
  }
  function telaGuiaATB(A, g) {
    var t = F.tela({ ferramenta: 'antibioticos', titulo: g.nome, grande: true });
    t.rola.innerHTML = '<div class="fer-pilha g18"><p class="fer-desc">' + esc(g.cat + ' · ' + g.tags) + '</p>' + g.secoes.map(function (s) {
      return '<div class="fer-pilha" style="gap:8px"><h2 class="fer-h22">' + esc(F.tit(sem(s.titulo))) + '</h2>' + F.blocos(s.blocos, 19) + '</div>';
    }).join('') + '<div class="ia"></div>' + F.aviso(A.dados.textos.item) + '</div>';
    F.painelIA(t, t.q('.ia'), { rotulo: 'Casos, doses e detalhes com a IA', pedido: function () { return A.motor.aprofundar(g.id); } });
    return t;
  }
  function telaGermeATB(A, g) {
    var t = F.tela({ ferramenta: 'antibioticos', titulo: g.g, grande: true });
    t.rola.innerHTML = '<div class="fer-pilha"><div class="atb-germe">' + esc(g.atb) + '</div><div class="ia"></div>' + F.aviso(A.dados.textos.dirigida) + '</div>';
    F.painelIA(t, t.q('.ia'), { rotulo: 'Refinar com a IA (dose, duração, alergia)', pedido: function () { return A.motor.dirigida(g.id); } });
    return t;
  }
  function faixasRenais(faixas, ativa) {
    return '<div class="atb-faixas">' + faixas.map(function (b) {
      var lig = ativa && ativa === b;
      return '<div class="atb-faixa' + (lig ? ' acesa' : '') + '"' + (lig ? ' aria-current="true"' : '') + '><b>' + esc(b.rotulo) + '</b><span>' + mk(b.txt) + '</span></div>';
    }).join('') + '</div>';
  }
  function telaDrogaATB(A, d) {
    var t = F.tela({ ferramenta: 'antibioticos', titulo: d.nome, grande: true });
    var sec = function (tit, corpo, nota) { return '<div class="atb-sec"><h2>' + esc(tit) + '</h2><p>' + mk(corpo) + '</p>' + (nota ? '<small>' + esc(nota) + '</small>' : '') + '</div>'; };
    t.rola.innerHTML = '<div class="fer-pilha g18"><p class="fer-desc" style="font-size:16px">' + esc(d.classe) + '</p>' +
      '<div class="atb-dose-box"><span class="r">Dose habitual (adulto, função renal normal)</span><span class="d">' + mk(d.dose) + '</span>' +
      (d.kg ? '<span class="k"><b>Dose por peso: </b>' + esc(d.kg.faixa) + ' ' + mk(d.kg.intervalo) + (d.kg.nota ? '. ' + mk(d.kg.nota) : '') + '</span>' : '') + '</div>' +
      '<button type="button" class="fer-cheio" data-acao="dose">Corrigir dose</button>' +
      '<div class="fer-pilha" style="gap:8px"><h2 class="fer-h">Ajuste pela função renal</h2>' + faixasRenais(d.renal) + '</div>' +
      (d.rx ? sec('Prescrição sugerida', d.rx) : '') + (d.ped ? sec('Dose pediátrica', d.ped, A.dados.textos.notaPed) : '') +
      sec('Reações adversas', d.adversos) + sec('Interações importantes', d.interacoes) + '<div class="ia"></div>' + F.aviso(A.dados.textos.droga) + '</div>';
    t.acoes.dose = function () { telaDoseATB(A, d); };
    F.painelIA(t, t.q('.ia'), { rotulo: 'Tirar dúvidas com a IA', pedido: function () { return A.motor.aprofundarDrug(d.id); } });
    return t;
  }
  /* Corrigir dose: droga, peso, função renal. Toda faixa fica à vista; a do paciente acende e sobe para cima do teclado. */
  function telaDoseATB(A, inicial) {
    var t = F.tela({ ferramenta: 'antibioticos', titulo: 'Corrigir dose' });
    var b = A.dados, d = inicial, v = { peso: '', clcr: '', idade: '', cr: '', sexo: 'M' }, nota = '';
    function lista() {
      t.rola.innerHTML = '<h2 class="fer-pergunta">Qual o antimicrobiano?</h2>' + listaDrogasATB(b, 'escolhe', '');
      t.faixaTeclado('');
    }
    t.acoes.escolhe = function (x) { d = b.drogas.filter(function (y) { return y.id === x.dataset.id; })[0]; form(); };
    t.acoes.troca = function () { if (!inicial) { d = null; lista(); } };
    function saida() { return v.clcr || v.peso ? Mo.deHTML(A.motor.doseTool(d.id, v.peso, v.clcr)) : ''; }
    function form() {
      t.rola.innerHTML = '<div class="fer-pilha">' +
        '<button type="button" class="atb-droga-topo" data-acao="troca"><b>' + esc(d.nome) + '</b><span>' + mk(d.dose) + '</span>' + (inicial ? '' : '<small>Trocar antimicrobiano</small>') + '</button>' +
        '<div class="fer-linha-campos">' + F.campoNumero(t, { id: 'peso', rotulo: d.kg ? 'Peso (kg)' : 'Peso (não usado neste antibiótico)', valor: v.peso, off: !d.kg }) + F.campoNumero(t, { id: 'clcr', rotulo: 'Clearance / TFG (mL/min)', valor: v.clcr }) + '</div>' +
        '<p class="fer-rotulo">Sem o clearance, calcule a TFG (CKD-EPI 2021):</p>' +
        '<div class="fer-linha-campos">' + F.campoNumero(t, { id: 'idade', rotulo: 'Idade (anos)', valor: v.idade }) + F.campoNumero(t, { id: 'cr', rotulo: 'Creatinina (mg/dL)', valor: v.cr }) + '</div>' +
        F.segmentos([{ id: 'M', nome: 'Homem' }, { id: 'F', nome: 'Mulher' }], v.sexo, 'data-acao="sexo"') +
        '<p class="atb-nota-tfg" aria-live="polite"></p>' +
        '<h2 class="fer-h">Ajuste pela função renal</h2><div class="faixas"></div><div class="saida" aria-live="polite"></div>' + F.aviso(b.textos.dose) + '</div>';
      atualiza();
    }
    function atualiza() {
      var s = saida(), ativa = Mo.faixaAtiva(s, d.renal);
      t.q('.faixas').innerHTML = faixasRenais(d.renal, ativa);
      var n = t.q('.atb-nota-tfg'); n.innerHTML = mk(nota); n.hidden = !nota;
      var linhas = s.split('\n').filter(Boolean).filter(function (l) { var x = sem(l); return x.indexOf(d.nome + ' ·') !== 0 && x.indexOf('Posologia:') !== 0; });
      t.q('.saida').innerHTML = s ? '<div class="atb-saida">' + linhas.map(function (l) { return sem(l).indexOf('Estimativa') === 0 ? '<p class="est">' + mk(l) + '</p>' : '<p>' + mk(l) + '</p>'; }).join('') + '</div>' : '';
      /* a dose fica à vista enquanto se digita: as faixas ficam atrás do teclado */
      t.faixaTeclado(ativa ? '<div class="faixa-viva" role="status"><b>' + esc(ativa.rotulo) + '</b><span>' + mk(ativa.txt) + '</span></div>' : '');
    }
    function tfg() {
      if (!v.idade || !v.cr) { nota = ''; return; }
      var r = A.motor.tfg(v.idade, v.cr, v.sexo);
      if (r.valor && r.valor !== 'NaN') { v.clcr = r.valor; var i = t.q('[data-campo="clcr"]'); if (i) i.value = r.valor; }
      /* no original a frase termina mandando tocar em Calcular, botão que aqui não existe: o cálculo é ao vivo */
      nota = Mo.deHTML(r.html).replace(/\s*Agora toque em .*$/, '');
    }
    t.el.addEventListener('input', function (e) {
      var x = e.target; if (!d || !x.matches('input[data-num]')) return;
      v[x.dataset.campo] = x.value;
      if (x.dataset.campo === 'idade' || x.dataset.campo === 'cr') tfg();
      atualiza();
    });
    t.acoes.sexo = function (x) { if (v.sexo === x.dataset.v) return; v.sexo = x.dataset.v; F.marcaSeg(x.parentNode, v.sexo); tfg(); atualiza(); };
    if (d) form(); else lista();
    return t;
  }
  /* Empírico: quatro telas curtas, depois o guia do foco e a sugestão da IA */
  function telaEmpiricoATB(A) {
    var t = F.tela({ ferramenta: 'antibioticos', titulo: 'Empírico', progresso: true });
    var b = A.dados, passo = 0, d = Mo.dadosEmpiricoNovo();
    t.voltar = function () { if (passo > 0) { passo--; desenha(); } else t.fechar(); };
    var grupo = function (tit, ops, val, campo) { return '<div class="fer-pilha" style="gap:6px"><span class="fer-rotulo">' + esc(tit) + '</span>' + F.segmentos(ops.map(function (o) { return { id: o[0], nome: o[1] }; }), val, 'data-acao="seg" data-campo="' + campo + '"', true) + '</div>'; };
    function desenha() {
      t.progresso((passo + 1) / 5);
      var h = '<div class="fer-pilha" style="padding-top:14px">';
      if (passo === 0) h += '<h2 class="fer-pergunta">Qual o foco?</h2><div>' + b.focos.map(function (f) { return F.linha(f.nome, null, 21, 'data-acao="foco" data-id="' + esc(f.id) + '"'); }).join('') + '</div>';
      else if (passo === 1) h += '<h2 class="fer-pergunta">Como está o paciente?</h2>' + grupo('Contexto', [['comunitario', 'Comunitário'], ['hospitalar', 'Hospitalar/nosocomial']], d.ctx, 'ctx') +
        grupo('Gravidade / local', [['ambulatorial', 'Ambulatorial'], ['enfermaria', 'Internado'], ['uti', 'UTI / grave']], d.grav, 'grav') + grupo('Alergia a penicilina', [['nao', 'Não'], ['leve', 'Leve (rash)'], ['grave', 'Grave/anafilaxia']], d.alergia, 'alergia');
      else if (passo === 2) h += '<h2 class="fer-pergunta">Há risco de multirresistência?</h2>' + b.empirico.riscos.map(function (r) { return '<button type="button" class="fer-marcar" data-acao="risco" data-id="' + esc(r.id) + '" aria-pressed="' + !!d.riscos[r.id] + '"><span>' + esc(r.t) + '</span>' + ic('check') + '</button>'; }).join('');
      else if (passo === 3) h += '<h2 class="fer-pergunta">O que já está em uso?</h2><div class="fer-chips">' + b.empirico.usados.map(function (a) { return '<button type="button" data-acao="usado" data-a="' + esc(a) + '" aria-pressed="' + (d.usados.indexOf(a) >= 0) + '">' + esc(a) + '</button>'; }).join('') + '</div>' +
        F.campoTexto(t, { id: 'detalhe', rotulo: 'Outros / detalhes', dica: 'ex. há 3 dias, sem melhora', valor: d.detalhe }) +
        '<div class="fer-linha-campos">' + F.campoNumero(t, { id: 'peso', rotulo: 'Peso (kg)', valor: d.peso }) + F.campoNumero(t, { id: 'clcr', rotulo: 'ClCr (mL/min)', valor: d.clcr }) + '</div>' +
        F.campoTexto(t, { id: 'extra', rotulo: 'Dados extras (opcional)', dica: 'ex.: gestante, cultura: E. coli ESBL', valor: d.extra });
      else {
        var f = b.focos.filter(function (x) { return x.id === d.foco; })[0] || b.focos[0];
        h += '<h2 class="fer-pergunta">' + esc(F.tit(f.nome)) + '</h2><div class="ia"></div><h2 class="fer-h">Guia curado</h2>' + conteudoFocoATB(t, f) + F.aviso(b.empirico.aviso);
      }
      t.rola.innerHTML = h + '</div>';
      t.rola.scrollTop = 0;
      t.pe.innerHTML = passo >= 1 && passo <= 3 ? '<div style="padding-top:8px"><button type="button" class="fer-cheio" data-acao="prox">Próximo</button></div>' : '';
      if (passo === 4) F.painelIA(t, t.q('.ia'), { rotulo: 'Sugerir conduta com a IA', ocupado: 'Gerando sugestão', pedido: function () { var c = JSON.parse(JSON.stringify(d)); c.peso = d.peso.replace(/,/g, '.'); c.clcr = d.clcr.replace(/,/g, '.'); return A.motor.empirico(c); } });
    }
    t.el.addEventListener('input', function (e) { var c = e.target.dataset.campo; if (c && passo === 3) d[c] = e.target.value; });
    t.acoes.foco = function (x) { d.foco = x.dataset.id; passo = 1; desenha(); };
    t.acoes.seg = function (x) { d[x.dataset.campo] = x.dataset.v; F.marcaSeg(x.parentNode, x.dataset.v); };
    t.acoes.risco = function (x) { var on = x.getAttribute('aria-pressed') !== 'true'; d.riscos[x.dataset.id] = on; x.setAttribute('aria-pressed', on); };
    t.acoes.usado = function (x) { var a = x.dataset.a, i = d.usados.indexOf(a); if (i >= 0) d.usados.splice(i, 1); else d.usados.push(a); x.setAttribute('aria-pressed', i < 0); };
    t.acoes.prox = function () { var f = D.activeElement; if (f && f.blur) f.blur(); passo++; desenha(); };
    desenha();
    return t;
  }
  /* Cobertura: toca o alvo e a lista se reorganiza em quem cobre, em parte e não cobre */
  function telaCoberturaATB(A) {
    var t = F.tela({ ferramenta: 'antibioticos', titulo: 'Cobertura' }), cob = A.dados.cobertura, alvo = -1;
    var nomes = function (l, n) { var x = cob.alvos.filter(function (_, i) { return l.v[i] === n; }); return x.length ? x.join(', ') : 'nenhum'; };
    var grupo = function (tit, n, fx, icone) {
      var it = cob.linhas.filter(function (l) { return l.v[alvo] === n; }); if (!it.length) return '';
      return '<div class="atb-cob fx-' + fx + ' n' + n + '"><div class="cab">' + ic(icone) + '<span>' + esc(tit) + '</span></div>' + it.map(function (l) { return '<p>' + esc(l.nome) + '</p>'; }).join('') + '</div>';
    };
    t.rola.innerHTML = '<h2 class="fer-pergunta">Quem cobre?</h2><div class="fer-chips t17" style="padding-top:8px">' + cob.alvos.map(function (a, i) { return '<button type="button" data-acao="alvo" data-i="' + i + '" aria-pressed="false">' + esc(a) + '</button>'; }).join('') + '</div>' +
      '<div class="grupos" aria-live="polite"></div><div style="padding-top:8px">' + F.recolhivel({ titulo: 'Por antibiótico', tam: 18, conteudo: '<div class="fer-pilha g12">' + cob.linhas.map(function (l) {
        return '<div><p style="margin:0;font-size:18px;font-weight:600">' + esc(l.nome) + '</p><p style="margin:0;font-size:16px">Cobre: ' + esc(nomes(l, 2)) + '</p><p style="margin:0;font-size:16px;color:var(--tinta2)">Parcial: ' + esc(nomes(l, 1)) + '</p></div>';
      }).join('') + '</div>' }) + '</div>' + F.aviso(cob.aviso);
    t.acoes.alvo = function (x) {
      var i = +x.dataset.i; alvo = alvo === i ? -1 : i;
      [].forEach.call(t.qa('[data-acao="alvo"]'), function (y) { y.setAttribute('aria-pressed', +y.dataset.i === alvo); });
      t.q('.grupos').innerHTML = alvo < 0 ? '' : grupo('Cobre', 2, 'ok', 'circle-check') + grupo('Parcial ou variável (depende de antibiograma, dose ou cepa)', 1, 'atencao', 'circle-plus-minus') + grupo('Não cobre ou não confiável', 0, 'neutra', 'circle-minus');
    };
    return t;
  }
  function telaPediatriaATB(A) {
    var t = F.tela({ ferramenta: 'antibioticos', titulo: 'Pediatria', grande: true });
    t.rola.innerHTML = F.busca('Qual antimicrobiano?', '') + '<p class="fer-desc" style="padding:12px 0">' + esc(A.dados.textos.notaPed) + '</p><div class="lp"></div>';
    function desenha(q) {
      var n = norm(q || '');
      t.q('.lp').innerHTML = A.dados.drogas.filter(function (d) { return d.ped && (!n || norm(d.nome).indexOf(n) >= 0); }).map(function (d) { return '<div class="atb-ped"><b>' + esc(d.nome) + '</b><span>' + mk(d.ped) + '</span></div>'; }).join('');
    }
    t.q('.fer-busca input').addEventListener('input', function (e) { desenha(e.target.value); });
    desenha('');
    return t;
  }

  /* ====================================================================== POCUS (Pocus.swift) */
  function abrirPocus(item) {
    motor.pocus().then(function (P) {
      var e = item && P.dados.exames.filter(function (x) { return x.id === item; })[0];
      if (item === 'assistente') assistentePocus(P); else if (e) telaExamePocus(P, e); else listaPocus(P);
    }, function () { var t = F.tela({ ferramenta: 'pocus', titulo: 'POCUS', grande: true, corTitulo: true }); F.carregando(t, motor.pocus(), function () { }); t.reabrir = function () { abrirPocus(item); }; });
  }
  function assistentePocus(P) { return F.telaAssistente({ ferramenta: 'pocus', titulo: 'Assistente POCUS', dica: 'Sua pergunta sobre POCUS', sugestoes: P.dados.sugestoes, chat: P.motor.chat }); }
  function listaPocus(P) {
    var t = F.tela({ ferramenta: 'pocus', titulo: 'POCUS', grande: true, corTitulo: true }), L = null, q = '';
    t.rola.innerHTML = '<div style="padding-bottom:6px">' + F.busca('Qual exame?', '') + '</div><div class="lp"></div>';
    function desenha() {
      var n = norm(q).trim(), c = t.q('.lp');
      if (!n) {
        c.innerHTML = F.linha('Perguntar à IA', null, 20, 'data-acao="abre" data-id="assistente"') + P.dados.categorias.map(function (cat) {
          return F.sobre(cat) + P.dados.exames.filter(function (e) { return e.cat === cat; }).map(function (e) { return F.linha(e.nome, null, 20, 'data-acao="abre" data-id="' + esc(e.id) + '"'); }).join('');
        }).join('');
        return;
      }
      if (!L) { c.innerHTML = '<p class="fer-nada">Buscando</p>'; motor.indiceDe('pocus').then(function (x) { L = x; desenha(); }); return; }
      var r = Mo.buscar(L, n, 'pocus', 30);
      c.innerHTML = r.length ? r.map(function (x) { return F.linha(x.titulo, x.detalhe.replace('POCUS, ', ''), null, 'data-acao="abre" data-id="' + esc(x.id.slice('pocus/'.length)) + '"'); }).join('')
        : '<p class="fer-nada">Nada encontrado. Busque por região ou achado, como pulmão, choque ou aorta.</p>';
    }
    t.q('.fer-busca input').addEventListener('input', function (e) { q = e.target.value; desenha(); });
    t.acoes.abre = function (b) { var id = b.dataset.id; if (id === 'assistente') return assistentePocus(P); var e = P.dados.exames.filter(function (x) { return x.id === id; })[0]; if (e) telaExamePocus(P, e); };
    desenha();
    return t;
  }
  /* Diagrama desenhado das formas do SVG original (como DiagramaPocusVista): cores do tema e só o ponto da etapa aceso */
  function diagramaPocus(def, ponto) {
    var r = function (n) { return Math.round(n * 100) / 100; };
    var preench = function (h) { return h == null ? 'none' : h === '#2563eb' ? 'var(--fer)' : h === '#9cc' ? 'var(--pc-contorno)' : 'var(--pc-corpo)'; };
    var traco = function (h) { return h == null ? 'none' : (h === '#1e40af' || h === '#2563eb') ? 'var(--fer)' : h === '#cfe1e2' ? 'var(--pc-tracado)' : 'var(--pc-contorno)'; };
    var out = def.formas.map(function (f) {
      var n = f.n, aceso = ponto == null || n == null || n === ponto, op = aceso ? '' : ' opacity=".28"';
      var st = ' stroke="' + traco(f.s) + '" stroke-width="' + r((f.sw == null ? 0.6 : f.sw) * 0.7) + '" stroke-linecap="round" stroke-linejoin="round"' + (f.tracejado ? ' stroke-dasharray="2 2"' : '');
      switch (f.k) {
        case 'c':
          var raio = f.r, halo = '';
          if (n != null && n === ponto) { raio *= 1.55; halo = '<circle class="halo" cx="' + f.x + '" cy="' + f.y + '" r="' + r(raio * 1.25) + '" fill="var(--fer-c)" opacity=".38"/>'; }
          return halo + '<circle cx="' + f.x + '" cy="' + f.y + '" r="' + r(raio) + '" fill="' + preench(f.f) + '"' + st + op + '/>';
        case 'e': return '<ellipse cx="' + f.x + '" cy="' + f.y + '" rx="' + f.rx + '" ry="' + f.ry + '" fill="' + preench(f.f) + '"' + st + op + '/>';
        case 'r': return '<rect x="' + f.x + '" y="' + f.y + '" width="' + f.w + '" height="' + f.h + '" rx="' + (f.rx || 0) + '" fill="' + preench(f.f) + '"' + st + op + '/>';
        case 'l': return '<line x1="' + f.x + '" y1="' + f.y + '" x2="' + f.x2 + '" y2="' + f.y2 + '"' + st + op + '/>';
        case 'p': return '<path d="' + (f.d || []).map(function (c) { return c[0] + c.slice(1).map(r).join(' '); }).join(' ') + '" fill="' + preench(f.f) + '"' + st + op + '/>';
        case 't':
          var ativo = n != null && n === ponto, tam = r((f.fs || 4) * (ativo ? 1.55 : 1));
          if (n != null) return '<text x="' + f.x + '" y="' + r(f.y - 1.4) + '" font-size="' + tam + '" text-anchor="middle" dominant-baseline="central" fill="#fff" font-weight="' + (f.forte ? 800 : 400) + '"' + op + '>' + esc(f.t) + '</text>';
          return '<text x="' + f.x + '" y="' + f.y + '" font-size="' + tam + '"' + (f.meio ? ' text-anchor="middle"' : '') + ' fill="var(--tinta2)" font-weight="' + (f.forte ? 800 : 400) + '"' + op + '>' + esc(f.t) + '</text>';
      }
      return '';
    }).join('');
    return '<svg class="pocus-diag' + (def.h > 80 ? '' : ' baixo') + '" viewBox="0 0 ' + def.w + ' ' + def.h + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' + (ponto != null ? 'Diagrama com o ponto ' + ponto + ' destacado' : 'Diagrama da posição da sonda') + '" font-family="-apple-system, system-ui, sans-serif">' + out + '</svg>';
  }
  var TOM_FX = { tep: 'alerta', ptx: 'alerta', pna: 'atencao', dpoc: 'ok', eap: 'info' };
  /* Fluxograma do BLUE como perguntas: toca a resposta e o caminho continua */
  function fluxoPocus(onde, fl) {
    var st = { ramo: null, linha: null, dx: null };
    function op(t, lig, attrs) { return '<button type="button" class="pocus-op" aria-pressed="' + lig + '" ' + attrs + '>' + esc(t) + '</button>'; }
    function desenha() {
      var h = '<div class="pocus-fluxo"><p class="q">' + mk(fl.pergunta) + '</p>';
      fl.ramos.forEach(function (r, i) { if (st.ramo == null || st.ramo === i) h += op(sem(r.rotulo), st.ramo === i, 'data-fx="ramo" data-i="' + i + '"'); });
      if (st.ramo != null) {
        var linhas = fl.ramos[st.ramo].linhas;
        linhas.forEach(function (l, i) { if (st.linha == null || st.linha === i) h += op(sem(l.perfil) + ': ' + sem(l.texto), st.linha === i, 'data-fx="linha" data-i="' + i + '"'); });
        if (st.linha != null && linhas[st.linha].sub) linhas[st.linha].sub.forEach(function (s, i) { h += op(sem(s.texto), !!(st.dx && st.dx[0] === s.dx && st.dx[1] === s.tom), 'data-fx="sub" data-i="' + i + '"'); });
      }
      if (st.dx) { var fx = TOM_FX[st.dx[1]] || 'neutra'; h += '<div class="pocus-dx fx-' + fx + '" role="status">' + F.iconeFaixa(fx) + '<span>' + esc(st.dx[0]) + '</span></div>'; }
      onde.innerHTML = h + F.aviso(fl.rodape) + '</div>';
    }
    onde.addEventListener('click', function (e) {
      var b = e.target.closest('[data-fx]'); if (!b) return;
      var i = +b.dataset.i;
      if (b.dataset.fx === 'ramo') { st.ramo = st.ramo === i ? null : i; st.linha = null; st.dx = null; }
      else if (b.dataset.fx === 'linha') { var l = fl.ramos[st.ramo].linhas[i]; if (st.linha === i) { st.linha = null; st.dx = null; } else { st.linha = i; st.dx = l.dx ? [l.dx, l.tom || ''] : null; } }
      else { var s = fl.ramos[st.ramo].linhas[st.linha].sub[i]; st.dx = [s.dx, s.tom]; }
      desenha();
    });
    desenha();
  }
  function galeriaPocus(P, imgs) {
    var reduz = U.reduz();
    return '<div class="fer-pilha" style="gap:22px">' + imgs.map(function (im) {
      var src = '../' + (P.dados._srcs[im.arq] || ''), gif = /\.gif$/i.test(src);
      var quadro = gif && reduz ? '<button type="button" class="tocar" data-acao="tocar" data-src="' + esc(src) + '">Tocar clipe</button>' : '<img src="' + esc(src) + '" alt="' + esc(im.leg) + '" loading="lazy" decoding="async">';
      return '<div class="pocus-img"><div class="quadro">' + quadro + '</div><p>' + esc(im.leg) + '</p><div class="cred"><span>' + esc([im.autor, im.lic, im.mod].filter(Boolean).join(' · ')) + '</span>' +
        (im.url ? '<a href="' + esc(im.url) + '" target="_blank" rel="noopener">fonte</a>' : '') + '</div></div>';
    }).join('') + F.aviso(P.dados.notaImagens) + '</div>';
  }
  /* Uma etapa por tela: arrastar para o lado ou usar o botão no alcance do polegar */
  function telaExamePocus(P, ex) {
    var etapas = ex.etapas.concat([{ tipo: 'ia', titulo: 'Aprofundar com IA', blocos: [] }]), total = etapas.length, i = 0;
    var t = F.tela({ ferramenta: 'pocus', titulo: ex.nome, progresso: true, semRola: true, direita: '<span class="fer-etapa" aria-live="polite"></span>' });
    var pags = D.createElement('div'); pags.className = 'pocus-paginas';
    t.el.insertBefore(pags, t.q('.fer-teclado'));
    pags.innerHTML = etapas.map(function (e, k) {
      var h = '<section class="pocus-pag" aria-label="Etapa ' + (k + 1) + ' de ' + total + '"><div class="fer-pilha">' + '<div>';
      if (k === 0) h += '<p class="pocus-tags">' + esc(ex.cat + ' · ' + ex.tags) + '</p>';
      if (e.parte) h += '<p class="fer-marca">' + esc(e.parte) + '</p>';
      h += '<h2 class="pocus-tit">' + mk(F.tit(e.titulo)) + '</h2></div>';
      if (e.tipo === 'ponto') h += (ex.diagrama ? diagramaPocus(ex.diagrama, e.ponto) : '') + F.blocos(e.blocos.map(function (b) { return b.t === 'p' ? { t: 'g', x: b.x } : b; }), 24);
      else if (e.tipo === 'fluxo') h += '<div class="fluxo"></div>';
      else if (e.tipo === 'imagens') h += galeriaPocus(P, ex.imagens);
      else if (e.tipo === 'ia') {
        var outros = P.dados.exames.filter(function (o) { return o.cat === ex.cat && o.id !== ex.id; });
        h += '<div class="ia"></div>' + (outros.length ? '<div>' + F.sobre('Mais em ' + ex.cat) + outros.map(function (o) { return F.linha(o.nome, null, 19, 'data-acao="outro" data-id="' + esc(o.id) + '"'); }).join('') + '</div>' : '');
      } else h += F.blocos(e.blocos, 20);
      return h + '</div></section>';
    }).join('');
    var fl = pags.querySelector('.fluxo'); if (fl && ex.fluxo) fluxoPocus(fl, ex.fluxo);
    F.painelIA(t, pags.querySelector('.ia'), { rotulo: 'Pedir casos e detalhes à IA', pedido: function () { return P.motor.aprofundar(ex.id); } });
    function marca() {
      t.q('.fer-etapa').textContent = (i + 1) + ' de ' + total;
      t.q('.fer-etapa').setAttribute('aria-label', 'Etapa ' + (i + 1) + ' de ' + total);
      t.progresso((i + 1) / total);
      t.pe.innerHTML = '<div class="fer-dupla" style="padding-top:8px">' + (i > 0 ? '<button type="button" class="fer-leve" data-acao="ant" style="flex:none;width:118px;min-height:62px;border-radius:20px">Anterior</button>' : '') +
        '<button type="button" class="fer-cheio" data-acao="prox">' + (i + 1 < total ? 'Próximo' : 'Concluir') + '</button></div>';
    }
    function ir(k) { i = Math.max(0, Math.min(total - 1, k)); pags.scrollTo({ left: i * pags.clientWidth, behavior: U.reduz() ? 'auto' : 'smooth' }); marca(); }
    var tRol = null;
    pags.addEventListener('scroll', function () { clearTimeout(tRol); tRol = setTimeout(function () { var k = Math.round(pags.scrollLeft / Math.max(1, pags.clientWidth)); if (k !== i) { i = k; marca(); } }, 80); });
    t.acoes.ant = function () { ir(i - 1); };
    t.acoes.prox = function () { if (i + 1 < total) ir(i + 1); else t.fechar(); };
    t.acoes.outro = function (b) { var o = P.dados.exames.filter(function (x) { return x.id === b.dataset.id; })[0]; if (o) telaExamePocus(P, o); };
    t.acoes.tocar = function (b) { var q = b.parentNode; q.innerHTML = '<img src="' + esc(b.dataset.src) + '" alt="">'; };
    marca();
    return t;
  }

  /* ====================================================================== PALIATIVOS (Paliativos.swift) */
  function abrirPali(item) {
    motor.pali().then(function (Pa) {
      var temaId = item && item.indexOf('tema:') === 0 ? item.slice(5) : null;
      if (item === 'triagem') telaTriagem(Pa);
      else if (temaId && Pa.dados.temas.some(function (x) { return x.id === temaId; })) telaTemaPali(Pa, temaId);
      else inicioPali(Pa);
    }, function () { var t = F.tela({ ferramenta: 'paliativos', titulo: 'Paliativos', grande: true, corTitulo: true }); F.carregando(t, motor.pali(), function () { }); t.reabrir = function () { abrirPali(item); }; });
  }
  var textoPali = null;
  function textoNormPali(Pa) {
    if (textoPali) return textoPali;
    textoPali = {};
    Pa.dados.temas.forEach(function (t) {
      var partes = t.blocos.map(function (b) { if (b.i) return b.i.join(' '); if (b.r) return (b.h || []).concat([].concat.apply([], b.r)).join(' '); return b.x || ''; });
      textoPali[t.id] = norm(sem(partes.join(' ')));
    });
    return textoPali;
  }
  function inicioPali(Pa) {
    var t = F.tela({ ferramenta: 'paliativos', titulo: 'Paliativos', grande: true, corTitulo: true }), q = '';
    t.rola.innerHTML = '<button type="button" class="pali-triar" data-acao="triar"><b>Triar paciente</b><span>Uma pergunta por vez, menos de 2 minutos</span></button><div style="padding-top:14px">' + F.busca('Buscar: dor, sedação, SPIKES', '') + '</div><div class="lp"></div>' + F.aviso(Pa.dados.triagem.aviso);
    function desenha() {
      var n = norm(q).trim(), c = t.q('.lp'), temas = Pa.dados.temas;
      if (!n) {
        c.innerHTML = F.sobre('Temas') + Pa.dados.grupos.map(function (g) {
          var it = temas.filter(function (x) { return x.grupo === g; });
          return F.recolhivel({ titulo: g, detalhe: String(it.length), tam: 20, botao: true, recuo: true, conteudo: it.map(function (x) { return F.linha(x.titulo, x.sub, 18, 'data-acao="tema" data-id="' + esc(x.id) + '"'); }).join('') });
        }).join('');
        return;
      }
      var noTit = temas.filter(function (x) { return norm(x.titulo + ' ' + x.sub + ' ' + x.grupo).indexOf(n) >= 0; }), ids = noTit.map(function (x) { return x.id; }), tn = textoNormPali(Pa);
      var noTxt = temas.filter(function (x) { return ids.indexOf(x.id) < 0 && (tn[x.id] || '').indexOf(n) >= 0; }), r = noTit.concat(noTxt);
      c.innerHTML = r.length ? r.map(function (x) { return F.linha(x.titulo, x.sub, null, 'data-acao="tema" data-id="' + esc(x.id) + '"'); }).join('')
        : '<p class="fer-nada">Nada encontrado. Tente um sintoma, como dor ou náusea, ou uma situação, como sedação ou últimos dias.</p>';
    }
    t.q('.fer-busca input').addEventListener('input', function (e) { q = e.target.value; desenha(); });
    t.acoes.triar = function () { telaTriagem(Pa); };
    t.acoes.tema = function (b) { telaTemaPali(Pa, b.dataset.id); };
    desenha();
    return t;
  }
  /* Triagem: uma pergunta por tela; as respostas descem para o alcance do polegar */
  function telaTriagem(Pa) {
    var tri = Pa.dados.triagem, t = F.tela({ ferramenta: 'paliativos', titulo: 'Triagem', progresso: 'alto' });
    var pilha = [['sq']], r = { sq: '', pps: '', gerais: {}, doenca: '', especs: {} }, adiante = true, contexto = '';
    var doencaAtual = function () { return tri.doencas.filter(function (d) { return d.id === r.doenca; })[0] || null; };
    var conta = function (o) { return Object.keys(o).filter(function (k) { return o[k]; }).length; };
    var chave = function (p) { return p.join(':'); };
    function seq() {
      var s = [['sq'], ['pps']].concat(tri.gerais.map(function (_, i) { return ['geral', i]; }), [['doenca']]);
      var d = doencaAtual(); if (d) s = s.concat(d.inds.map(function (_, i) { return ['espec', i]; }));
      return s.concat([['resultado']]);
    }
    function proximo(p) { var s = seq().map(chave), i = s.indexOf(chave(p)); return i >= 0 && i + 1 < s.length ? seq()[i + 1] : ['resultado']; }
    function avancar(p) { adiante = true; pilha.push(p); desenha(); }
    t.voltar = function () { if (pilha.length <= 1) return t.fechar(); adiante = false; pilha.pop(); desenha(); };
    var opG = function (tit, det, lig, attrs) { return '<button type="button" class="pali-op" aria-pressed="' + lig + '" ' + attrs + '><b>' + mk(tit) + '</b>' + (det ? '<span>' + mk(det) + '</span>' : '') + '</button>'; };
    function pergunta(texto, opcoes) { return '<div class="pali-passo"><h2 class="pali-q">' + mk(texto) + '</h2><div class="pali-ops">' + opcoes + '<button type="button" class="pali-pular" data-acao="pular">Pular</button></div></div>'; }
    function simNao(ctx, texto) { return '<div class="pali-passo"><p class="pali-ctx">' + esc(ctx) + '</p><h2 class="pali-q" style="padding-top:10px">' + esc(texto) + '</h2><div class="pali-simnao" style="margin-top:auto"><button type="button" class="nao" data-acao="resp" data-v="0">Não</button><button type="button" class="sim" data-acao="resp" data-v="1">Sim</button></div></div>'; }
    function avaliar() { return Pa.motor.avaliar(r.sq, r.pps, conta(r.gerais), r.doenca, conta(r.especs)); }
    function resultado() {
      var res = avaliar(), h = '<div class="fer-pilha" style="padding-top:16px">';
      if (res) {
        var fx = Mo.faixaPali(res.faixa);
        h += '<div class="pali-res fx-' + fx + '"><span class="fer-rotulo">Resultado da triagem</span><div class="cab">' + F.iconeFaixa(fx) + '<b>' + esc(res.titulo) + '</b></div><p>' + mk(Mo.deHTML(res.msg)) + '</p></div>' +
          '<div class="por" style="--fer-t:var(--fx-' + fx + ')">' + F.blocos([{ t: 'l', o: false, i: res.porque.map(Mo.deHTML) }], 17) + '</div>' +
          '<div class="fer-dupla"><button type="button" class="fer-leve" data-acao="resumo" style="min-height:58px;border-radius:20px">Copiar resumo</button><button type="button" class="fer-cheio" data-acao="nova" style="min-height:58px;font-size:17px">Nova triagem</button></div>';
        if (res.positivo) h += '<div class="fer-pilha g10" style="padding-top:8px"><h2 class="fer-h">Apoio à reunião familiar</h2><p class="fer-desc" style="font-size:16px">' + esc(tri.dicaIA) + '</p>' +
          F.campoTexto(t, { id: 'ctx', rotulo: 'Contexto breve do paciente (opcional)', dica: tri.dicaContexto, valor: contexto, linhas: [2, 4] }) + '<div class="ia"></div></div>';
      } else h += '<p class="fer-nada" style="font-size:20px;font-weight:600">Nenhuma pergunta respondida. Volte e responda ao menos uma.</p>';
      h += F.recolhivel({ titulo: 'Base e referências', tam: 17, conteudo: '<p style="margin:0;font-size:16px">' + mk(tri.base) + '</p>' }) + F.aviso(tri.aviso) + '</div>';
      return { h: h, res: res };
    }
    function desenha() {
      var p = pilha[pilha.length - 1], s = seq().map(chave), i = s.indexOf(chave(p));
      t.progresso(i < 0 ? 1 : (i + 1) / s.length);
      var h = '', res = null, d = doencaAtual();
      if (p[0] === 'sq') h = pergunta(tri.pergunta, opG(tri.opcoes.sim.t, tri.opcoes.sim.d, r.sq === 'sim', 'data-acao="sq" data-v="sim"') + opG(tri.opcoes.nao.t, tri.opcoes.nao.d, r.sq === 'nao', 'data-acao="sq" data-v="nao"'));
      else if (p[0] === 'pps') h = pergunta('Estado funcional (PPS / ECOG)', tri.pps.map(function (o) { return opG(o.t, o.d, r.pps === o.v, 'data-acao="pps" data-v="' + esc(o.v) + '"'); }).join(''));
      else if (p[0] === 'geral') h = simNao('Indicador geral ' + (p[1] + 1) + ' de ' + tri.gerais.length, tri.gerais[p[1]].t);
      else if (p[0] === 'doenca') h = pergunta('Qual a doença de base principal?', tri.doencas.map(function (x) { return opG(x.l, null, r.doenca === x.id, 'data-acao="doenca" data-v="' + esc(x.id) + '"'); }).join(''));
      else if (p[0] === 'espec' && d && p[1] < d.inds.length) h = simNao(d.l, d.inds[p[1]]);
      else { var x = resultado(); h = x.h; res = x.res; }
      t.rola.innerHTML = '<div class="pali-anim' + (adiante ? '' : ' volta') + '" style="min-height:100%;display:flex;flex-direction:column">' + h + '</div>';
      t.rola.scrollTop = 0;
      if (res && res.positivo) {
        F.painelIA(t, t.q('.ia'), { rotulo: 'Gerar roteiro da reunião', ocupado: 'Gerando o roteiro', copiar: 'Copiar roteiro', pedido: function () {
          var g = Object.keys(r.gerais).filter(function (k) { return r.gerais[k]; }).map(Number).sort(function (a, b) { return a - b; }).map(function (k) { return tri.gerais[k].t; });
          var dd = doencaAtual(), e = dd ? Object.keys(r.especs).filter(function (k) { return r.especs[k]; }).map(Number).sort(function (a, b) { return a - b; }).map(function (k) { return dd.inds[k]; }) : [];
          return Pa.motor.pedidoReuniao(r.sq, r.pps, g, r.doenca, e, contexto.trim());
        } });
      }
      var f = t.q('.pali-q'); if (f) { f.setAttribute('tabindex', '-1'); try { f.focus({ preventScroll: true }); } catch (e) { } }
    }
    t.el.addEventListener('input', function (e) { if (e.target.dataset.campo === 'ctx') contexto = e.target.value; });
    t.acoes.sq = function (b) { r.sq = b.dataset.v; avancar(proximo(['sq'])); };
    t.acoes.pps = function (b) { r.pps = b.dataset.v; avancar(proximo(['pps'])); };
    t.acoes.doenca = function (b) { if (r.doenca !== b.dataset.v) r.especs = {}; r.doenca = b.dataset.v; avancar(['espec', 0]); };
    t.acoes.pular = function () {
      var p = pilha[pilha.length - 1];
      if (p[0] === 'pps') r.pps = '';
      if (p[0] === 'doenca') { r.doenca = ''; r.especs = {}; return avancar(['resultado']); }
      avancar(proximo(p));
    };
    t.acoes.resp = function (b) {
      var p = pilha[pilha.length - 1], sim = b.dataset.v === '1';
      if (p[0] === 'geral') { r.gerais[p[1]] = sim; avancar(proximo(p)); }
      else { r.especs[p[1]] = sim; var d = doencaAtual(); avancar(p[1] + 1 < d.inds.length ? ['espec', p[1] + 1] : ['resultado']); }
    };
    t.acoes.resumo = function (b) {
      var res = avaliar(); if (!res) return;
      var d = doencaAtual();
      /* mesmo formato de copiarResumo() do original */
      F.copiar('Triagem PaliAI: ' + res.titulo + '\n' + (d ? 'Doença de base: ' + d.l + '\n' : '') + res.porque.map(function (x) { return '- ' + sem(Mo.deHTML(x)); }).join('\n'));
      b.textContent = 'Copiado';
    };
    t.acoes.nova = function () { adiante = false; r = { sq: '', pps: '', gerais: {}, doenca: '', especs: {} }; pilha = [['sq']]; desenha(); };
    desenha();
    return t;
  }
  function telaTemaPali(Pa, id) {
    var temas = Pa.dados.temas, atual = id, t = F.tela({ ferramenta: 'paliativos', titulo: '', grande: true });
    function desenha() {
      var k = Math.max(0, temas.map(function (x) { return x.id; }).indexOf(atual)), tema = temas[k], secoes = [];
      t.titulo(tema.titulo);
      tema.blocos.forEach(function (b) {
        if (b.t === 'c' && b.k === 'ref') return;
        if (b.t === 'h') secoes.push([sem(b.x || ''), []]); else if (!secoes.length) secoes.push(['', [b]]); else secoes[secoes.length - 1][1].push(b);
      });
      var refs = tema.blocos.filter(function (b) { return b.t === 'c' && b.k === 'ref'; });
      t.rola.innerHTML = '<p class="fer-marca">' + esc(tema.grupo) + '</p>' + (tema.sub ? '<p class="fer-desc" style="font-size:17px;padding:2px 0 8px">' + esc(tema.sub) + '</p>' : '') +
        secoes.map(function (s, i) { return s[0] ? F.recolhivel({ titulo: s[0], aberto: i === 0, conteudo: F.blocos(s[1]) }) : '<div style="padding:8px 0">' + F.blocos(s[1]) + '</div>'; }).join('') +
        (refs.length ? F.recolhivel({ titulo: 'Referências', tam: 17, conteudo: F.blocos(refs) }) : '') +
        '<div style="padding-top:14px">' + (k > 0 ? F.linha(temas[k - 1].titulo, 'Tema anterior', 18, 'data-acao="ir" data-id="' + esc(temas[k - 1].id) + '"') : '') +
        (k + 1 < temas.length ? F.linha(temas[k + 1].titulo, 'Próximo tema', 18, 'data-acao="ir" data-id="' + esc(temas[k + 1].id) + '"') : '') + '</div>' + F.aviso(Pa.dados.triagem.aviso);
      t.rola.scrollTop = 0;
    }
    t.acoes.ir = function (b) { atual = b.dataset.id; desenha(); };
    desenha();
    return t;
  }

  /* ====================================================================== CONDUTAI (FerramentasCondutai.swift) */
  function comCondutai(f, item, fn) {
    motor.condutai().then(function (Cd) { fn(Cd, item); }, function () {
      var t = F.tela({ ferramenta: f, titulo: F.nome(f), grande: true, corTitulo: true }); F.carregando(t, motor.condutai(), function () { }); t.reabrir = function () { comCondutai(f, item, fn); };
    });
  }
  function matches(re, s) { var r = [], m; re.lastIndex = 0; while ((m = re.exec(s))) r.push(m); return r; }
  /* Investigação e Procedimentos: banco primeiro; o que não estiver no banco vai para a IA */
  function telaBancoIA(Cd, f, item) {
    if (item) return resultadoBanco(Cd, f, item);
    var cfg = f === 'investigacao' ? Cd.dados.investigacao : Cd.dados.procedimentos, banco = f === 'investigacao' ? 'INV_OFF' : 'PROC_OFF', q = '';
    var t = F.tela({ ferramenta: f, titulo: F.nome(f), grande: true, corTitulo: true });
    t.rola.innerHTML = '<div style="padding-bottom:6px">' + F.busca(cfg.dica, '') + '</div><p class="fer-intro">' + mk(cfg.intro) + '</p><div class="lb"></div>';
    var nomesComuns = null;
    function desenha() {
      var c = t.q('.lb'), n = norm(q);
      if (!q.trim()) {
        nomesComuns = nomesComuns || cfg.comuns.map(function (x) { var o = Cd.motor.oferta(banco, x); return o && o.nome; });
        var resto = cfg.banco.filter(function (b) { return nomesComuns.indexOf(b.nome) < 0; });
        c.innerHTML = F.sobre('Mais buscados') + cfg.comuns.map(function (x) { return F.linha(x, null, 20, 'data-acao="q" data-q="' + esc(x) + '"'); }).join('') +
          (resto.length ? F.sobre('Mais no banco') + resto.map(function (b) { return F.linha(b.nome, null, 20, 'data-acao="q" data-q="' + esc(b.nome) + '"'); }).join('') : '');
        return;
      }
      var fil = cfg.banco.filter(function (b) { return norm(b.nome + ' ' + b.alias.join(' ')).indexOf(n) >= 0; });
      c.innerHTML = fil.map(function (b) { return F.linha(b.nome, null, 20, 'data-acao="q" data-q="' + esc(b.nome) + '"'); }).join('') + F.linha('Buscar: ' + q, fil.length ? null : 'Fora do banco: a IA gera', 18, 'data-acao="q" data-q="' + esc(q) + '"');
    }
    t.q('.fer-busca input').addEventListener('input', function (e) { q = e.target.value; desenha(); });
    t.acoes.q = function (b) { resultadoBanco(Cd, f, b.dataset.q); };
    desenha();
    return t;
  }
  function resultadoBanco(Cd, f, q) {
    var cfg = f === 'investigacao' ? Cd.dados.investigacao : Cd.dados.procedimentos, o = Cd.motor.oferta(f === 'investigacao' ? 'INV_OFF' : 'PROC_OFF', q);
    var t = F.tela({ ferramenta: f, titulo: o ? o.nome : q, grande: true });
    t.rola.innerHTML = '<div class="fer-pilha g10">' + (o ? '<p class="fer-marca">Banco MedTech</p>' + F.secoesVista(F.semTituloInicial(motor.md(o.md)), 1) + F.aviso(cfg.notas[0] || '') : '<p class="fer-nada" style="font-size:18px;font-weight:600;padding:0">Não está no banco. A IA pode gerar.</p>') +
      '<div class="ia" style="padding-top:8px"></div></div>';
    F.painelIA(t, t.q('.ia'), { rotulo: o ? 'Gerar versão pela IA' : 'Gerar com a IA', ocupado: 'Buscando', nota: cfg.notas[cfg.notas.length - 1], pedido: function () { return f === 'investigacao' ? Cd.motor.promptInvestigacao(q) : Cd.motor.promptProc(q); } });
    return t;
  }
  /* grade de campos: segmentos primeiro, números em linhas de `colunas` */
  function gradeCampos(t, campos, colunas, valores) {
    var nums = campos.filter(function (c) { return !c.opcoes; }), h = '<div class="fer-pilha g10">';
    campos.filter(function (c) { return c.opcoes; }).forEach(function (c) { h += F.segmentos(c.opcoes.map(function (o) { return { id: o.v, nome: o.t }; }), valores[c.id] || c.opcoes[0].v, 'data-acao="seg" data-campo="' + esc(c.id) + '"'); });
    for (var i = 0; i < nums.length; i += colunas) h += '<div class="fer-linha-campos">' + nums.slice(i, i + colunas).map(function (c) { return F.campoNumero(t, { id: c.id, rotulo: c.rotulo, dica: c.dica, valor: valores[c.id], t24: true }); }).join('') + '</div>';
    return h + '</div>';
  }
  function telaGasometria(Cd) {
    var cfg = Cd.dados.gasometria, t = F.tela({ ferramenta: 'gasometria', titulo: 'Gasometria' }), v = {};
    t.rola.innerHTML = '<div class="fer-pilha g12">' + gradeCampos(t, cfg.campos, 3, v) + '<div class="secs"></div></div>';
    function atualiza() {
      var bruto = Cd.motor.gaso(v), alerta = bruto.indexOf('<div class="alert') === 0;
      var texto = bruto.split('<div class="result content">').join('').split('</div>').join('');
      var secoes = alerta ? [] : F.semTituloInicial(motor.md(texto).map(function (s) { return { titulo: s.titulo, blocos: s.blocos.filter(function (b) { return b.t !== 'h'; }) }; }));
      var achar = function (nome) { var s = secoes.filter(function (x) { return sem(x.titulo) === nome; })[0]; return s && s.blocos[0] && s.blocos[0].i && s.blocos[0].i[0]; };
      var prim = achar('Distúrbio primário'), estado = achar('Estado');
      t.fixo.innerHTML = '<div class="fer-vivo" role="status" aria-live="polite">' + (prim ? '<p class="primario">' + mk(prim) + '</p>' + (estado ? '<p class="estado">' + mk(estado) + '</p>' : '') : '<p class="apagado">' + mk(Mo.deHTML(bruto)) + '</p>') + '</div>';
      t.q('.secs').innerHTML = F.secoesVista(secoes.filter(function (s) { return s.titulo || s.blocos.length; }), null, 17);
    }
    t.el.addEventListener('input', function (e) { if (e.target.matches('input[data-num]')) { v[e.target.dataset.campo] = e.target.value; atualiza(); } });
    atualiza();
    return t;
  }
  /* ECG e Ventilação: conta ao vivo no alto e o guia logo abaixo */
  function telaCalcGuia(Cd, f) {
    var cfg = f === 'ecg' ? Cd.dados.ecg : Cd.dados.ventilacao, t = F.tela({ ferramenta: f, titulo: F.nome(f) }), v = {};
    t.rola.innerHTML = '<div class="fer-pilha g12">' + gradeCampos(t, cfg.campos, 2, v) + '<p class="fer-aviso" style="padding:0">' + mk(cfg.nota) + '</p><div>' +
      cfg.guia.map(function (g, i) { return F.recolhivel({ titulo: g.titulo, aberto: i === 0, conteudo: F.blocos(g.blocos, 18) }); }).join('') + '</div>' + F.aviso(cfg.aviso) + '</div>';
    function atualiza() {
      var linhas = Mo.deHTML(Cd.motor.calcGuia(f, v)).split('·').map(function (x) { return x.trim(); });
      t.fixo.innerHTML = '<div class="fer-vivo" role="status" aria-live="polite">' + linhas.map(function (l) { return '<p>' + mk(l) + '</p>'; }).join('') + '</div>';
    }
    t.el.addEventListener('input', function (e) { if (e.target.matches('input[data-num]')) { v[e.target.dataset.campo] = e.target.value; atualiza(); } });
    t.acoes.seg = function (b) { v[b.dataset.campo] = b.dataset.v; F.marcaSeg(b.parentNode, b.dataset.v); atualiza(); };
    atualiza();
    return t;
  }
  function telaFormIA(f, intro) {
    var t = F.tela({ ferramenta: f, titulo: F.nome(f), grande: true, corTitulo: true });
    t.rola.innerHTML = '<div class="fer-pilha"><p class="fer-desc" style="font-size:16px">' + mk(intro) + '</p><div class="campos fer-pilha"></div></div>';
    return t;
  }
  function telaDdx(Cd) {
    var c = Cd.dados.ddx, t = telaFormIA('ddx', c.intro), caso = '';
    t.q('.campos').innerHTML = F.campoTexto(t, { id: 'caso', rotulo: 'Quadro clínico', dica: c.dica, linhas: [4, 10] }) + '<div class="ia"></div>';
    var p = F.painelIA(t, t.q('.ia'), { rotulo: 'Gerar diagnóstico diferencial', ocupado: 'Gerando hipóteses', nota: c.notas[0], liberado: function () { return !!caso.trim(); }, pedido: function () { return Cd.motor.promptDdx(caso.trim()); } });
    t.el.addEventListener('input', function (e) { if (e.target.dataset.campo === 'caso') { caso = e.target.value; p.atualiza(); } });
    return t;
  }
  function telaInteracoes(Cd) {
    var c = Cd.dados.interacoes, t = telaFormIA('interacoes', c.intro), meds = '', obs = '';
    t.q('.campos').innerHTML = F.campoTexto(t, { id: 'meds', rotulo: 'Medicamentos em uso', dica: c.dica, linhas: [3, 10], multi: true }) + '<div class="regras" aria-live="polite"></div>' +
      F.campoTexto(t, { id: 'obs', rotulo: 'Observações (opcional)', dica: c.dicaObs }) + '<div class="ia"></div>';
    /* conferência por regra (CVSeg): sai na hora e não depende da IA */
    function regras() {
      var m = meds.trim(), el = t.q('.regras');
      if (!m) { el.innerHTML = ''; return; }
      var h = Cd.motor.regras(m);
      var al = matches(/<li class="rx-al (\w+)">[\s\S]*?<span>([\s\S]*?)<\/span><\/li>/g, h), fora = /Fora da base de regras: ([\s\S]*?)\.<\/p>/.exec(h);
      el.innerHTML = '<div class="fer-pilha g10"><h2 class="fer-h" style="font-size:18px;padding:0">Conferência por regra</h2>' +
        (al.length ? '' : '<p class="fer-desc" style="font-size:16px">Nenhuma interação da base de regras entre estes fármacos. A análise da IA cobre o restante.</p>') +
        al.map(function (a) { var fx = a[1] === 'grave' ? 'alerta' : a[1] === 'atencao' ? 'atencao' : 'info'; return '<div class="reg-al fx-' + fx + '">' + F.iconeFaixa(fx) + '<span>' + mk(Mo.deHTML(a[2])) + '</span></div>'; }).join('') +
        (fora ? '<p class="fer-desc">Fora da base de regras: ' + mk(Mo.deHTML(fora[1])) + '.</p>' : '') + '</div>';
    }
    var p = F.painelIA(t, t.q('.ia'), { rotulo: 'Verificar com a IA', ocupado: 'Verificando', nota: c.notas[0], liberado: function () { return !!meds.trim(); }, pedido: function () { return Cd.motor.promptInteracoes(meds.trim(), obs.trim()); } });
    t.el.addEventListener('input', function (e) { var k = e.target.dataset.campo; if (k === 'meds') { meds = e.target.value; regras(); p.atualiza(); } if (k === 'obs') obs = e.target.value; });
    return t;
  }
  function telaOrientacoes(Cd) {
    var c = Cd.dados.orientacoes, t = telaFormIA('orientacoes', c.intro), tema = '', det = '';
    t.q('.campos').innerHTML = F.campoTexto(t, { id: 'tema', rotulo: 'Tema / diagnóstico', dica: c.dicaTema }) + F.campoTexto(t, { id: 'det', rotulo: 'Detalhes (opcional)', dica: c.dicaDetalhes, linhas: [2, 5] }) + '<div class="ia"></div>';
    var p = F.painelIA(t, t.q('.ia'), { rotulo: 'Gerar orientações', ocupado: 'Gerando orientações', nota: c.notas[0], copiar: 'Copiar orientações', liberado: function () { return !!tema.trim(); }, pedido: function () { return Cd.motor.promptOrient(tema.trim(), det.trim()); } });
    t.el.addEventListener('input', function (e) { var k = e.target.dataset.campo; if (k === 'tema') { tema = e.target.value; p.atualiza(); } if (k === 'det') det = e.target.value; });
    return t;
  }
  function telaVacinas(Cd, item) {
    var cfg = Cd.dados.vacinas;
    var g0 = item && cfg.grupos.filter(function (g) { return g.id === item; })[0];
    if (g0) return grupoVacina(Cd, g0);
    var t = telaFormIA('vacinas', cfg.intro), duvida = '';
    t.q('.campos').innerHTML = '<div>' + cfg.grupos.map(function (g) { return F.linha(g.l, null, 21, 'data-acao="grupo" data-id="' + esc(g.id) + '"'); }).join('') + '</div><div style="padding-top:10px">' + F.campoTexto(t, { id: 'duv', rotulo: 'Dúvida específica', dica: cfg.dica }) + '</div><div class="ia"></div>';
    var p = F.painelIA(t, t.q('.ia'), { rotulo: 'Perguntar à IA', ocupado: 'Consultando', nota: cfg.notas[0], liberado: function () { return !!duvida.trim(); }, pedido: function () { return Cd.motor.promptVac(duvida.trim()); } });
    t.el.addEventListener('input', function (e) { if (e.target.dataset.campo === 'duv') { duvida = e.target.value; p.atualiza(); } });
    t.acoes.grupo = function (b) { grupoVacina(Cd, cfg.grupos.filter(function (g) { return g.id === b.dataset.id; })[0]); };
    return t;
  }
  function grupoVacina(Cd, g) {
    var t = F.tela({ ferramenta: 'vacinas', titulo: g.l, grande: true });
    t.rola.innerHTML = '<div class="fer-pilha" style="gap:8px"><p class="fer-marca">Base PNI / SBIm</p>' + F.secoesVista(F.semTituloInicial(motor.md(Cd.motor.vacina(g.id)))) + '</div>';
    return t;
  }
  function telaCID(Cd, item) {
    var t = F.tela({ ferramenta: 'cid', titulo: 'CID-10', grande: true, corTitulo: true }), q = item || '', copiado = '';
    t.rola.innerHTML = '<div style="padding-bottom:6px">' + F.busca('Código ou doença', q) + '</div><div class="lc"></div>';
    var inp = t.q('.fer-busca input');
    function desenha() {
      var c = t.q('.lc');
      if (q.trim().length < 2) {
        c.innerHTML = '<p class="fer-intro">' + mk(Cd.dados.cidIntro) + '</p>' + F.sobre('Mais buscados') + Cd.dados.cidComuns.map(function (x) { return F.linha(x, null, 20, 'data-acao="comum" data-q="' + esc(x) + '"'); }).join('');
        return;
      }
      var h = Cd.motor.cid(q), it = matches(/<div class="cv-cid"><b>([\s\S]*?)<\/b><span>([\s\S]*?)<\/span>/g, h);
      c.innerHTML = (it.length ? '' : '<p class="fer-nada" style="padding-top:14px">' + mk(Mo.deHTML(h)) + '</p>') + it.map(function (x) {
        var cod = Mo.deHTML(x[1]), desc = Mo.deHTML(x[2]);
        return '<button type="button" class="cid-it" data-acao="copia" data-cod="' + esc(cod) + '" data-desc="' + esc(desc) + '" aria-label="' + esc(cod + ' ' + desc + ', copiar') + '"><b>' + esc(cod) + '</b><span>' + esc(desc) + '</span><small>' + (copiado === cod ? 'Copiado' : 'Copiar') + '</small></button>';
      }).join('');
    }
    inp.addEventListener('input', function () { q = inp.value; desenha(); });
    t.acoes.comum = function (b) { inp.value = b.dataset.q; inp.dispatchEvent(new Event('input', { bubbles: true })); };
    t.acoes.copia = function (b) { F.copiar(b.dataset.cod + ' - ' + b.dataset.desc); copiado = b.dataset.cod; [].forEach.call(t.qa('.cid-it small'), function (s) { s.textContent = s.parentNode.dataset.cod === copiado ? 'Copiado' : 'Copiar'; }); };
    desenha();
    return t;
  }

  /* ====================================================================== entrada (FerramentaView do iPhone) */
  function abrir(f, item) {
    /* aceita o id do resultado de busca ("pocus/pulmao") ou só o item ("pulmao") */
    if (item === f) item = null;
    if (item && item.indexOf(f + '/') === 0) item = item.slice(f.length + 1);
    switch (f) {
      case 'sessoes': return W.MedTechCasca.sessoes.abrir(item || null);
      case 'calculadoras': return abrirCalc(item);
      case 'antibioticos': return abrirATB(item);
      case 'pocus': return abrirPocus(item);
      case 'paliativos': return abrirPali(item);
      case 'gasometria': return comCondutai(f, item, function (Cd) { telaGasometria(Cd); });
      case 'ventilacao': case 'ecg': return comCondutai(f, item, function (Cd) { telaCalcGuia(Cd, f); });
      case 'investigacao': case 'procedimentos': return comCondutai(f, item, function (Cd, it) { telaBancoIA(Cd, f, it); });
      case 'ddx': return comCondutai(f, item, telaDdx);
      case 'interacoes': return comCondutai(f, item, telaInteracoes);
      case 'orientacoes': return comCondutai(f, item, telaOrientacoes);
      case 'vacinas': return comCondutai(f, item, telaVacinas);
      case 'cid': return comCondutai(f, item, telaCID);
    }
  }

  /* busca da tela inicial: os itens das ferramentas aparecem depois das condutas, como no iPhone */
  var indice = null, pedindo = false;
  function carregaIndice() {
    if (indice || pedindo) return;
    pedindo = true;
    motor.indice().then(function (L) {
      indice = L;
      var b = D.getElementById('busca');
      if (b && b.value) b.dispatchEvent(new Event('input'));
    }, function (e) { console.warn(e); }).then(function () { pedindo = false; });
  }
  function busca(n) {
    if (!indice) { carregaIndice(); return []; }
    return Mo.buscar(indice, n, null, 30).map(function (x) {
      return { titulo: x.titulo, detalhe: x.detalhe, cor: F.cores(x.ferramenta).fundo, abrir: function () { var b = D.getElementById('busca'); if (b) b.blur(); W.MedTechCasca.abrirFerramenta(x.ferramenta, x.id); } };
    });
  }

  function liga() {
    var C = W.MedTechCasca;
    if (!C) return setTimeout(liga, 30);
    C.registrar('ferramenta', function (id, item) { abrir(id, item); });
    C.registrar('busca', busca);
    D.addEventListener('focusin', function (e) { if (e.target && e.target.id === 'busca') carregaIndice(); });
    var alvo = new URLSearchParams(location.search).get('ferramenta');
    if (alvo) { var p = alvo.split('/'); setTimeout(function () { C.abrirFerramenta(p[0], p.slice(1).join('/') || null); }, 0); }
  }

  W.MTFer = { motor: motor, abrir: abrir };
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', liga); else liga();
})();
