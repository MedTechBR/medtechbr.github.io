/* MedTech PWA: a casca do app, igual à do iPhone (MedTechApp.swift, InicioClinica.swift, ConsultarView.swift).
   No alto, Clínica | Gestão e o perfil; embaixo, a barra flutuante de seções.
   Clínica: Condutas (esta frente), Ferramentas e Exames. Gestão: Plantões e Finanças (outras frentes).
   Pontos de encaixe para as outras frentes: window.MedTechCasca (contrato em LEIAME.md). */
(function () {
  'use strict';
  var W = window, D = document;
  var U = W.MTUI, esc = U.esc, ic = U.ic;
  var PARAM = new URLSearchParams(location.search);
  var DEMO = PARAM.get('demo') === '1';

  /* ---------- espaços e seções (Tema.swift) ---------- */
  var SECOES = {
    condutas: { nome: 'Condutas', espaco: 'clinica', cor: '#2563EB', produto: 'condutai' },
    ferramentas: { nome: 'Ferramentas', espaco: 'clinica', cor: '#C2410C', produto: 'condutai' },
    exames: { nome: 'Exames', espaco: 'clinica', cor: '#0F7F74', produto: 'laudai' },
    plantoes: { nome: 'Plantões', espaco: 'gestao', cor: '#4D7C0F', produto: 'plantaohub' },
    financas: { nome: 'Finanças', espaco: 'gestao', cor: '#7C4DE8', produto: 'granae' }
  };
  var ESPACOS = { clinica: { nome: 'Clínica', secoes: ['condutas', 'ferramentas', 'exames'] }, gestao: { nome: 'Gestão', secoes: ['plantoes', 'financas'] } };

  /* ---------- ferramentas (Ferramentas.swift: nome, descrição, corFundo) ---------- */
  var FERRAMENTAS = {
    sessoes: ['Acompanhar paciente', 'Próximo passo pelos parâmetros atuais, sem IA', '#4338CA'],
    calculadoras: ['Calculadoras', 'Escores e fórmulas, com resultado na hora', '#B84A0E'],
    antibioticos: ['Antibióticos', 'Foco, germe, droga e correção de dose', '#0E7C94'],
    gasometria: ['Gasometria', 'Distúrbio, compensação, ânion-gap, P/F', '#C21F2F'],
    ventilacao: ['Ventilação mecânica', 'Peso predito, VC, P/F e ajustes', '#2563EB'],
    ecg: ['ECG', 'FC, QTc e leitura sistemática', '#B93A32'],
    pocus: ['POCUS', 'Exame passo a passo, com o ponto da sonda', '#0F7F74'],
    investigacao: ['Investigação', 'Do achado aos exames na ordem certa', '#3451B2'],
    ddx: ['Diagnóstico diferencial', 'Hipóteses, graves e o que pedir', '#A8327E'],
    interacoes: ['Interações', 'Conferência por regra e análise da IA', '#B4530A'],
    procedimentos: ['Procedimentos', 'Indicação, material e técnica', '#8F5A2B'],
    vacinas: ['Vacinação', 'Calendário por faixa e condição', '#4D7C0F'],
    cid: ['CID-10', 'Busca por código ou doença', '#5D6579'],
    paliativos: ['Paliativos', 'Triagem, reunião familiar e temas', '#C9285F'],
    orientacoes: ['Orientações ao paciente', 'Texto simples para entregar', '#96600A']
  };
  var GRUPOS_FER = [['No plantão', ['sessoes', 'calculadoras', 'antibioticos', 'gasometria', 'ventilacao', 'ecg', 'pocus']], ['Raciocínio clínico', ['investigacao', 'ddx', 'interacoes']], ['Técnica e registro', ['procedimentos', 'vacinas', 'cid']], ['Paciente e família', ['paliativos', 'orientacoes']]];

  /* ---------- sessões de acompanhamento (SessoesDisponiveis.swift), na ordem do iPhone ---------- */
  var SESSOES = [
    { id: 'cad', nome: 'Cetoacidose diabética', conduta: 'cad' },
    { id: 'sca', nome: 'Síndrome coronariana aguda', conduta: 'stemi' },
    { id: 'sepse', nome: 'Sepse e choque séptico', conduta: 'sepse' },
    { id: 'anafilaxia', nome: 'Anafilaxia', conduta: 'anafilaxia' },
    { id: 'epileptico', nome: 'Estado de mal epiléptico', conduta: 'epileptico' },
    { id: 'ehh', nome: 'Estado hiperosmolar', conduta: 'ehh' },
    { id: 'hipona', nome: 'Hiponatremia', conduta: 'hipona' }
  ];
  var IRMAS = { nstemi: 'stemi' };   // sessão única para mais de uma conduta
  var CHAVE_SESSAO = 'mt.sessao.v1.';   // a mesma chave dos motores (sessoes/nucleo.js, CHAVE_ARMAZEM)

  var encaixes = { sessao: null, ferramenta: null, secao: {}, busca: [], prescricaoIA: null, perfil: [] };

  var Sessoes = {
    lista: SESSOES,
    chave: function (id) { return CHAVE_SESSAO + id; },
    daConduta: function (idConduta) { var c = IRMAS[idConduta] || idConduta; return SESSOES.filter(function (s) { return s.conduta === c; })[0] || null; },
    estado: function (id) {
      try { var e = JSON.parse(localStorage.getItem(CHAVE_SESSAO + id) || 'null'); if (!e) return null; var t = new Date(e.inicio).getTime(); return isFinite(t) ? Object.assign({}, e, { _inicio: t }) : null; } catch (x) { return null; }
    },
    emAndamento: function () { return SESSOES.map(function (s) { var e = Sessoes.estado(s.id); return e ? { s: s, e: e } : null; }).filter(Boolean); },
    abrir: function (id) {
      var s = SESSOES.filter(function (x) { return x.id === id; })[0];
      if (encaixes.sessao) return encaixes.sessao(id, s);
      emConstrucao(s ? s.nome : 'Acompanhar paciente', 'O acompanhamento do paciente pelos parâmetros chega ao app numa próxima etapa.');
    },
    finalizar: function (id) {
      try { localStorage.removeItem(CHAVE_SESSAO + id); } catch (x) { }
      D.dispatchEvent(new CustomEvent('medtech:sessoes', { detail: { finalizada: id } }));
    }
  };

  /* ---------- estado ---------- */
  var st = { secao: 'condutas', ultima: { clinica: 'condutas', gestao: 'plantoes' }, visitadas: {}, travada: {}, acesso: null };

  function travado(secao) {
    var A = st.acesso;
    if (!A || !A.venda || A.falha || !W.MTAcesso) return null;
    var r = W.MTAcesso.liberado(A.P, A.mt, SECOES[secao].produto);
    return r.ok ? null : r;
  }

  /* ---------- barras ---------- */
  function desenhaBarras() {
    var sec = SECOES[st.secao], esp = sec.espaco;
    D.documentElement.style.setProperty('--secao', sec.cor);
    D.querySelectorAll('.espacos button').forEach(function (b) {
      var sel = b.dataset.espaco === esp;
      b.classList.toggle('sel', sel); b.setAttribute('aria-selected', sel);
    });
    var nav = D.querySelector('.barra-secoes .bs-itens');
    var lista = ESPACOS[esp].secoes;
    if (nav.dataset.espaco !== esp) {
      nav.dataset.espaco = esp;
      nav.innerHTML = '<span class="bs-pilula" aria-hidden="true"></span>' + lista.map(function (s) { return '<button type="button" data-secao="' + s + '">' + SECOES[s].nome + '</button>'; }).join('');
      nav.classList.add('sem-anima');
    }
    var idx = lista.indexOf(st.secao);
    nav.querySelectorAll('button').forEach(function (b) { var sel = b.dataset.secao === st.secao; b.classList.toggle('sel', sel); if (sel) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    var p = nav.querySelector('.bs-pilula');
    p.style.width = 'calc((100% - 10px) / ' + lista.length + ')';
    p.style.transform = 'translateX(' + (idx * 100) + '%)';
    p.style.background = sec.cor;
    requestAnimationFrame(function () { nav.classList.remove('sem-anima'); });
  }

  function irSecao(s) {
    if (!SECOES[s]) return;
    st.secao = s;
    st.ultima[SECOES[s].espaco] = s;
    D.querySelectorAll('.secao').forEach(function (el) { var v = el.dataset.secao === s; el.hidden = !v; });
    if (!st.visitadas[s]) { st.visitadas[s] = 1; montaSecao(s); }
    else reconfere(s);
    desenhaBarras();
    D.dispatchEvent(new CustomEvent('medtech:secao', { detail: { secao: s } }));
  }

  function montaSecao(s) {
    var el = D.getElementById('s-' + s);
    /* Seção fora do plano: aviso no lugar do conteúdo, como o cadeado do portal. */
    if (travado(s)) {
      st.travada[s] = 1;
      el.onclick = null;
      el.innerHTML = '<div class="trava rola-secao"><div class="em-obra"><span class="trava-ic" aria-hidden="true">' + ic('lock') + '</span><h1>' + SECOES[s].nome + '</h1><p class="corpo">Esta seção não faz parte do seu plano atual.</p>' +
        '<a class="bt-cheio" href="../app.html?conta=1">Ver planos e assinatura</a></div></div>';
      return;
    }
    st.travada[s] = 0;
    if (encaixes.secao[s]) { el.onclick = null; el.innerHTML = ''; encaixes.secao[s](el); return; }
    if (s === 'condutas') return montaCondutas(el);
    if (s === 'ferramentas') return montaFerramentas(el);
    if (s === 'exames') {
      el.innerHTML = '<iframe class="exames" src="../laudai.html?achados=1" title="Exames: achados por foto ou texto"></iframe>';
      return;
    }
    el.innerHTML = '<div class="rola-secao"><div class="em-obra"><h1>' + SECOES[s].nome + '</h1><p class="corpo">Em construção. ' + (s === 'plantoes' ? 'Seus plantões, escala e o mês chegam aqui numa próxima etapa.' : 'Ganhos, gastos e o resumo do mês chegam aqui numa próxima etapa.') + '</p></div></div>';
  }
  /* O acesso chegou ou mudou: só refaz a seção cuja situação mudou. */
  function reconfere(s) { if (!!travado(s) !== !!st.travada[s]) montaSecao(s); }

  /* ---------- Clínica: tela inicial (InicioClinica + ConsultarView) ---------- */
  var ECG = (function () {
    var pts = [[30, 0], [38, -9], [46, 0], [66, 0], [70, 6], [76, -58], [83, 20], [89, 0], [112, 0], [124, -14], [138, 0], [170, 0]];
    var meio = 96 * 0.62, d = 'M-170 ' + meio, x;
    for (x = -170; x < 860; x += 170) pts.forEach(function (p) { d += ' L' + (x + p[0]) + ' ' + (meio + p[1]).toFixed(1); });
    return '<svg class="ecg" viewBox="0 0 690 96" preserveAspectRatio="xMinYMid slice" aria-hidden="true" focusable="false"><g class="ecg-g"><path d="' + d + '"/></g></svg>';
  })();

  function montaCondutas(el) {
    el.innerHTML = '<div class="rola-secao" id="rolaCondutas"><div class="consulta">' +
      '<h1 class="pergunta">O que você procura?</h1>' +
      '<div class="busca"><span class="bu-ic">' + ic('search') + '</span><input id="busca" type="search" name="mt-consulta" placeholder="Doença, conduta ou remédio" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" aria-label="Doença, conduta ou remédio">' +
      '<button type="button" class="bu-limpa" aria-label="Limpar busca" hidden>' + ic('x') + '</button><button type="button" class="bu-cancela" hidden>Cancelar</button></div></div>' +
      '<div class="calma"></div><div class="resultados" hidden aria-live="polite"></div></div>';
    var input = el.querySelector('#busca');
    var limpa = el.querySelector('.bu-limpa'), cancela = el.querySelector('.bu-cancela');
    var res = el.querySelector('.resultados');
    var focada = false;
    /* e-mail do login que o Chrome joga no campo de busca: nunca é busca */
    var semEmail = function () { if (input.value.indexOf('@') >= 0) { input.value = ''; atualiza(); } };
    [200, 600, 1200, 2500, 5000].forEach(function (t) { setTimeout(semEmail, t); });
    function atualiza() {
      var q = input.value.indexOf('@') >= 0 ? '' : input.value;
      var buscando = focada || !!q;
      el.classList.toggle('buscando', buscando);
      limpa.hidden = !q; cancela.hidden = !(focada && !q);
      res.hidden = !buscando;
      el.querySelector('.calma').hidden = buscando;
      if (buscando) desenhaResultados(res, q);
    }
    input.addEventListener('focus', function () { semEmail(); focada = true; atualiza(); });
    input.addEventListener('blur', function () { focada = false; atualiza(); });
    input.addEventListener('input', atualiza);
    input.addEventListener('keydown', function (e) { if (e.key === 'Escape') { input.value = ''; input.blur(); } if (e.key === 'Enter') { var p = res.querySelector('a.linha'); if (p) p.click(); } });
    limpa.addEventListener('click', function () { input.value = ''; input.focus(); atualiza(); });
    cancela.addEventListener('mousedown', function (e) { e.preventDefault(); });
    cancela.addEventListener('click', function () { input.blur(); });
    // tocar num resultado não pode tirar o foco antes do toque valer
    res.addEventListener('mousedown', function (e) { if (e.target.closest('a, button')) e.preventDefault(); });
    el.onclick = cliqueInicio;
    st.atualizaBusca = atualiza;
    desenhaCalma();
    if (PARAM.get('busca')) { input.value = PARAM.get('busca'); atualiza(); }
  }

  function cliqueInicio(e) {
    var a = e.target.closest('a, button'); if (!a) return;
    if (a.dataset.conduta) { e.preventDefault(); var inp = D.getElementById('busca'); if (inp) inp.blur(); W.MTLeitor.abrir(a.dataset.conduta); return; }
    if (a.dataset.bula) { e.preventDefault(); W.MTLeitor.abreBula(a.dataset.bula); return; }
    if (a.dataset.extra != null && a.dataset.extra !== '') { e.preventDefault(); var x = st.extras && st.extras[+a.dataset.extra]; if (x && x.abrir) x.abrir(); return; }
    var acao = a.dataset.acao;
    if (acao === 'folha') return abreFolha(a.dataset.folha);
    if (acao === 'ferramenta') return abrirFerramenta(a.dataset.ferramenta);
    if (acao === 'continuar') return Sessoes.abrir(a.dataset.sessao);
    if (acao === 'finalizar') {
      var s = SESSOES.filter(function (x) { return x.id === a.dataset.sessao; })[0];
      return U.confirma('Finalizar o acompanhamento?', s.nome + ' sai da tela inicial e os parâmetros, confirmações e horários são apagados deste aparelho. Não dá para desfazer.', [
        { rotulo: 'Finalizar e apagar', perigo: true, acao: function () { Sessoes.finalizar(s.id); } }, { rotulo: 'Cancelar' }]);
    }
  }

  function tempoDesde(t) {
    var m = Math.max(0, Math.floor((Date.now() - t) / 60000));
    return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min';
  }

  function desenhaCalma() {
    var el = D.querySelector('#s-condutas .calma'); if (!el) return;
    var and = Sessoes.emAndamento(), h = '';
    if (and.length) {
      var p = and[0], mais = and.length > 1 ? ' e mais ' + (and.length - 1) : '';
      h += '<div class="acompanhar com-fim"><button type="button" class="ac-bt" data-acao="continuar" data-sessao="' + p.s.id + '">' + ECG +
        '<span class="ac-t">' + esc(p.s.nome) + '</span><span class="ac-l"><span>Em andamento há ' + tempoDesde(p.e._inicio) + mais + '</span><b>Continuar</b></span></button>' +
        '<button type="button" class="ac-fim" data-acao="finalizar" data-sessao="' + p.s.id + '">Finalizar</button></div>';
    } else {
      h += '<div class="acompanhar"><button type="button" class="ac-bt" data-acao="ferramenta" data-ferramenta="sessoes">' + ECG +
        '<span class="ac-t">Acompanhar paciente</span><span class="ac-l"><span>Informe os parâmetros e veja o próximo passo</span></span></button></div>';
    }
    h += '<div class="caminhos">' +
      caminho('Emergências', 'first-aid-kit', '#C21F2F', 'data-acao="folha" data-folha="emergencias"') +
      caminho('Todas as áreas', 'layout-grid', '#0F7F74', 'data-acao="folha" data-folha="areas"') +
      caminho('Calculadoras', 'math-function', '#B84A0E', 'data-acao="ferramenta" data-ferramenta="calculadoras"') +
      caminho('Antibióticos', 'pills', '#0E7C94', 'data-acao="ferramenta" data-ferramenta="antibioticos"') + '</div>';
    var Dd = W.MTDados, L = W.MTLeitor.Listas;
    var ultimas = L.recentes().map(Dd.conduta).filter(Boolean).slice(0, 2);
    if (ultimas.length || L.favoritas().length) {
      h += '<div class="recentes"><div class="re-cab"><h2>Recentes</h2><button type="button" class="link-azul" data-acao="folha" data-folha="pessoais">Ver favoritas</button></div>' +
        ultimas.map(function (c) { return linhaGrande(c.nome, iconeArea(c.area), W.MTLeitor.corArea(c.area), 'data-conduta="' + esc(c.id) + '" href="?conduta=' + esc(c.id) + '"'); }).join('') + '</div>';
    }
    el.innerHTML = h;
    // entrada escalonada só na primeira pintura (respeita Reduzir movimento pelo CSS)
    if (!st.animou && W.MTDados.condutas.length) { st.animou = 1; el.classList.add('anima'); setTimeout(function () { el.classList.remove('anima'); }, 900); }
  }
  function caminho(t, icone, cor, attr) {
    return '<button type="button" class="caminho" style="background:' + cor + '" ' + attr + '>' + ic(icone) + '<span>' + t + '</span></button>';
  }
  function linhaGrande(t, icone, cor, attr, num) {
    return '<a class="linha-g" ' + attr + '>' + (icone ? '<span class="lg-ic" style="color:' + cor + '">' + ic(icone) + '</span>' : '') + '<span class="lg-t">' + esc(t) + '</span>' + (num != null ? '<span class="lg-n">' + num + '</span>' : '') + ic('chevron-right') + '</a>';
  }
  var ICONE_AREA = { emergencia: 'first-aid-kit', cardio: 'heart', infecto: 'virus', pneumo: 'lungs', endocrino: 'droplet', neuro: 'brain', gastro: 'tools-kitchen-2', nefro: 'droplet-half-2', hemato: 'droplet', reumato: 'walk', gineco: 'woman', psiq: 'mood-neutral', derm: 'hand-stop', uro: 'toilet-paper', olho_orl: 'eye', geriatria: 'wheelchair', onco_pal: 'ribbon-health', raras: 'dna-2' };
  function iconeArea(a) { return ICONE_AREA[a] || 'stethoscope'; }

  /* ---------- busca ---------- */
  function destacado(nome, termos) {
    var n = W.MTDados.normal(nome);
    if (n.length !== nome.length) return esc(nome);
    var marca = new Array(nome.length).fill(false);
    termos.forEach(function (t) { var k = n.indexOf(t); if (k >= 0) for (var j = k; j < k + t.length; j++) marca[j] = true; });
    var h = '', dentro = false;
    for (var i = 0; i < nome.length; i++) {
      if (marca[i] && !dentro) { h += '<b class="achado">'; dentro = true; }
      if (!marca[i] && dentro) { h += '</b>'; dentro = false; }
      h += esc(nome[i]);
    }
    return h + (dentro ? '</b>' : '');
  }
  function desenhaResultados(res, q) {
    var Dd = W.MTDados, L = W.MTLeitor, areas = function (c) { return Dd.areas[c.area]; };
    var n = Dd.normal(q).trim();
    if (!n) {
      var fav = L.Listas.favoritas().map(Dd.conduta).filter(Boolean);
      var rec = L.Listas.recentes().map(Dd.conduta).filter(function (c) { return c && fav.indexOf(c) < 0; }).slice(0, 4);
      res.innerHTML = (fav.length ? '<h2 class="res-t">Favoritas</h2>' + L.linhas(fav) : '') + (rec.length ? '<h2 class="res-t">Abertas por último</h2>' + L.linhas(rec) : '');
      return;
    }
    var r = Dd.buscar(q), termos = n.split(/\s+/).filter(Boolean), h = '';
    var extras = [];
    encaixes.busca.forEach(function (f) { try { extras = extras.concat(f(n) || []); } catch (e) { console.error(e); } });
    st.extras = extras;
    if (!r.condutas.length && !r.bulas.length && !r.mencoes.length && !extras.length) {
      if (r.aproximados.length) h += '<h2 class="res-t">Você quis dizer</h2>' + L.linhas(r.aproximados, areas);
      else h += '<p class="res-nada">Nada encontrado para "' + esc(q) + '".</p>';
    }
    if (r.bulas.length) h += '<div class="superficie">' + r.bulas.map(function (b) {
      return '<a class="linha" href="#" data-bula="' + esc(b.id) + '"><span class="traco alto" style="--cor:var(--cheio)"></span><span class="li-tx"><span class="li-n">' + destacado(b.nome, termos) + '</span><span class="li-d">Bula</span></span></a>';
    }).join('') + '</div>';
    if (r.condutas.length) h += L.linhas(r.condutas.slice(0, 40).map(function (c) { return Object.assign({}, c, { nomeHTML: destacado(c.nome, termos) }); }), areas);
    if (r.mencoes.length) h += '<h2 class="res-t">Citado no texto de</h2>' + L.linhas(r.mencoes, areas);
    if (extras.length) h += '<div class="superficie">' + extras.map(function (x, i) {
      return '<a class="linha" href="#" data-extra="' + i + '"><span class="traco alto" style="--cor:' + esc(x.cor || 'var(--tinta2)') + '"></span><span class="li-tx"><span class="li-n">' + destacado(x.titulo, termos) + '</span>' + (x.detalhe ? '<span class="li-d">' + esc(x.detalhe) + '</span>' : '') + '</span></a>';
    }).join('') + '</div>';
    res.innerHTML = h;
  }

  /* ---------- folhas da abertura: Emergências, Todas as áreas, Favoritas e recentes ---------- */
  var DESTAQUES = ['acls', 'sepse', 'stemi', 'nstemi', 'avc_isq', 'tep', 'anafilaxia', 'cad'];
  function abreFolha(qual) {
    var Dd = W.MTDados, L = W.MTLeitor.Listas;
    var titulo = { emergencias: 'Emergências', areas: 'Todas as áreas', pessoais: 'Favoritas e recentes' }[qual];
    var item = function (c) { return linhaGrande(c.nome, null, null, 'data-conduta="' + esc(c.id) + '" href="?conduta=' + esc(c.id) + '"'); };
    U.folha({
      titulo: titulo, classe: 'folha-lista', alta: true,
      conteudo: function (c, api) {
        function raiz() {
          var h = '<h2 class="folha-titulo" data-foco tabindex="-1">' + titulo + '</h2><div class="lista-g">';
          if (qual === 'emergencias') {
            h += DESTAQUES.map(Dd.conduta).filter(Boolean).map(item).join('');
            h += Dd.daArea('emergencia').filter(function (x) { return DESTAQUES.indexOf(x.id) < 0; }).map(item).join('');
          } else if (qual === 'areas') {
            h += Dd.areasOrdenadas().map(function (a) { return linhaGrande(Dd.areas[a], iconeArea(a), 'var(--principal)', 'href="#" data-area="' + a + '"', Dd.daArea(a).length); }).join('');
          } else {
            var fav = L.favoritas().map(Dd.conduta).filter(Boolean);
            var rec = L.recentes().map(Dd.conduta).filter(function (x) { return x && fav.indexOf(x) < 0; });
            if (!fav.length && !rec.length) h += '<p class="corpo t2">Abra uma conduta e ela aparece aqui. Para favoritar, toque na estrela dentro da conduta.</p>';
            if (fav.length) h += '<h3 class="lista-sub">Favoritas</h3>' + fav.map(item).join('');
            if (rec.length) h += '<h3 class="lista-sub">Recentes</h3>' + rec.map(item).join('');
          }
          c.innerHTML = h + '</div>';
        }
        function area(a) {
          c.innerHTML = '<button type="button" class="folha-volta" data-volta="1">' + ic('chevron-left') + 'Todas as áreas</button>' +
            '<div class="area-cab"><span class="circulo" style="background:' + W.MTLeitor.corArea(a) + '">' + ic(iconeArea(a)) + '</span><h2 data-foco tabindex="-1">' + esc(Dd.areas[a]) + '</h2></div><div class="lista-area">' +
            Dd.daArea(a).map(function (x) { return '<a class="li-area" style="--cor:' + W.MTLeitor.corArea(a) + '" href="?conduta=' + esc(x.id) + '" data-conduta="' + esc(x.id) + '">' + esc(x.nome) + '</a>'; }).join('') + '</div>';
          c.querySelector('h2').focus({ preventScroll: true });
          c.scrollTop = 0;
        }
        c.addEventListener('click', function (e) {
          var a = e.target.closest('a, button'); if (!a) return;
          if (a.dataset.conduta) { e.preventDefault(); api.fechar(); W.MTLeitor.abrir(a.dataset.conduta); return; }
          if (a.dataset.area) { e.preventDefault(); area(a.dataset.area); return; }
          if (a.dataset.volta) { raiz(); var f = c.querySelector('h2'); if (f) f.focus({ preventScroll: true }); }
        });
        raiz();
      }
    });
  }

  /* ---------- Ferramentas (FerramentasAba): portas grandes; o conteúdo é de outra frente ---------- */
  function montaFerramentas(el) {
    var h = '<div class="rola-secao"><h1 class="titulo-secao">Ferramentas</h1>';
    GRUPOS_FER.forEach(function (g) {
      h += '<h2 class="grupo-fer">' + g[0] + '</h2>' + g[1].map(function (id) {
        var f = FERRAMENTAS[id];
        return '<button type="button" class="porta" style="background:' + f[2] + '" data-acao="ferramenta" data-ferramenta="' + id + '"><b>' + f[0] + '</b><span>' + f[1] + '</span></button>';
      }).join('');
    });
    el.innerHTML = h + '</div>';
    el.onclick = function (e) { var a = e.target.closest('[data-ferramenta]'); if (a) abrirFerramenta(a.dataset.ferramenta); };
  }
  function abrirFerramenta(id, item) {
    if (id === 'sessoes' && encaixes.sessao) return encaixes.sessao(null, null);
    if (encaixes.ferramenta) return encaixes.ferramenta(id, item || null);
    var f = FERRAMENTAS[id] || ['Ferramenta'];
    emConstrucao(f[0], 'Esta ferramenta chega ao app numa próxima etapa. Enquanto isso, ela continua no CondutAI.', '../condutai.html');
  }
  function emConstrucao(titulo, texto, link) {
    U.folha({
      titulo: titulo, classe: 'folha-obra',
      conteudo: function (c, api) {
        c.innerHTML = '<h2 class="folha-titulo" data-foco tabindex="-1">' + esc(titulo) + '</h2><p class="corpo">' + esc(texto) + '</p>' +
          (link ? '<a class="bt-cheio" href="' + link + '">Abrir no CondutAI</a>' : '') + '<button type="button" class="bt-leve" data-acao="ok">Fechar</button>';
        c.querySelector('[data-acao="ok"]').addEventListener('click', api.fechar);
      }
    });
  }

  /* ---------- perfil (PerfilView.swift) ---------- */
  function abrePerfil() {
    U.folha({
      titulo: 'Sua conta', classe: 'folha-perfil',
      conteudo: function (c, api) {
        var u = W.MT && W.MT.user, nome = u && !u.demo ? (u.displayName || u.email || '') : (DEMO ? 'Modo demonstração' : '');
        var link = function (t, href) { return '<a class="pf-l" href="' + href + '"><span>' + t + '</span>' + ic('arrow-up-right') + '</a>'; };
        c.innerHTML = '<h2 class="folha-titulo" data-foco tabindex="-1">Sua conta</h2>' + (nome ? '<p class="pf-nome">' + esc(nome) + '</p>' : '') +
          '<div class="pf-grupo">' + link('Minha conta e assinatura', '../app.html?conta=1') + link('Ajuda', '../ajuda.html') + link('Termos de uso', '../termos.html') + link('Privacidade', '../privacidade.html') +
          encaixes.perfil.map(function (x) { return link(esc(x.titulo), esc(x.href)); }).join('') + '</div>' +
          (u && !u.demo ? '<button type="button" class="pf-sair">Sair da conta</button>' : '') + '<p class="pf-versao">Versão 1.0</p>';
        var s = c.querySelector('.pf-sair');
        if (s) s.addEventListener('click', function () {
          U.confirma('Sair da conta?', 'Os dados deste aparelho serão limpos; na nuvem eles continuam.', [
            { rotulo: 'Sair', perigo: true, acao: function () { api.fechar(); W.MT.signOut(); } }, { rotulo: 'Cancelar' }]);
        });
      }
    });
  }

  /* ---------- conta e acesso (igual ao portal: _mtauth.js e MT.acessoEstado) ---------- */
  function inicial() {
    var u = W.MT && W.MT.user, n = u && !u.demo ? (u.displayName || u.email || '') : '';
    return (n.trim().charAt(0) || 'M').toUpperCase();
  }
  function aoEntrar() {
    var b = D.querySelector('.perfil span'); if (b) b.textContent = inicial();
    if (st.acesso !== null || !W.MT || !W.MT.user || W.MT.user.demo) return;
    st.acesso = false;
    W.MT.acessoEstado().then(function (a) { st.acesso = a || { venda: false }; }, function () { st.acesso = { venda: false }; }).then(function () {
      Object.keys(st.visitadas).forEach(function (s) { if (st.visitadas[s]) reconfere(s); });
    });
  }
  function ligaConta() {
    if (DEMO) {
      W.MT = { mode: 'demo', user: { demo: true, displayName: 'Demonstração' }, ready: Promise.resolve(), onData: function (cb) { cb(null); }, signOut: function () { }, acessoEstado: function () { return Promise.resolve(null); } };
      D.documentElement.dataset.demo = '1';
      return;
    }
    (function espera() { if (W.MT && W.MT.onData) W.MT.onData(aoEntrar); else setTimeout(espera, 50); })();
  }

  /* ---------- início ---------- */
  function inicia() {
    ligaConta();
    D.querySelector('.espacos').addEventListener('click', function (e) {
      var b = e.target.closest('[data-espaco]'); if (!b) return;
      var esp = b.dataset.espaco; if (esp === SECOES[st.secao].espaco) return;
      irSecao(st.ultima[esp]);
    });
    D.querySelector('.barra-secoes').addEventListener('click', function (e) { var b = e.target.closest('[data-secao]'); if (b && b.dataset.secao !== st.secao) irSecao(b.dataset.secao); });
    D.querySelector('.perfil').addEventListener('click', function () { if (encaixes.abrePerfil) encaixes.abrePerfil(); else abrePerfil(); });
    var aba = PARAM.get('aba');
    irSecao(SECOES[aba] ? aba : 'condutas');
    var aposIndice = function () {
      desenhaCalma();
      if (st.atualizaBusca) st.atualizaBusca();
      var c = PARAM.get('conduta'); if (c && W.MTDados.conduta(c)) W.MTLeitor.abrir(c);
    };
    W.MTDados.pronto.then(aposIndice, function (e) {
      console.error(e);
      var cm = D.querySelector('#s-condutas .calma'); if (cm) cm.insertAdjacentHTML('afterbegin', '<p class="corpo t2">Não foi possível abrir o catálogo de condutas. Confira a conexão.</p>');
    });
    // o texto das condutas vem em segundo plano; depois, o índice de menções da busca
    W.MTDados.pronto.then(function () { return W.MTDados.carregaBanco(); }).then(function () {
      (W.requestIdleCallback || function (f) { setTimeout(f, 400); })(function () { W.MTDados.preparaTermos(); if (st.atualizaBusca) st.atualizaBusca(); });
    }).catch(function (e) { console.warn(e); });
    D.addEventListener('medtech:sessoes', desenhaCalma);
    W.addEventListener('storage', function (e) { if (!e.key || e.key.indexOf('medtech.') === 0 || e.key.indexOf(CHAVE_SESSAO) === 0) desenhaCalma(); });
    setInterval(function () { if (Sessoes.emAndamento().length) desenhaCalma(); }, 60000);
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js', { scope: './' }).catch(function () { });
  }

  /* ---------- pontos de encaixe (contrato em LEIAME.md) ---------- */
  W.MedTechCasca = {
    versao: 1,
    demo: DEMO,
    secoes: SECOES,
    ferramentas: FERRAMENTAS,
    sessoes: Sessoes,
    irSecao: irSecao,
    abrirConduta: function (id) { return W.MTLeitor.abrir(id); },
    abrirFerramenta: abrirFerramenta,
    /* tipo: 'sessao' fn(idSessao|null, sessao) · 'ferramenta' fn(id, item) · 'secao' (chave = id da seção) fn(el)
       · 'busca' fn(textoNormalizado) -> [{titulo, detalhe, cor, abrir}] · 'prescricaoIA' fn(conduta) · 'perfil' {titulo, href} · 'abrePerfil' fn() */
    registrar: function (tipo, a, b) {
      if (tipo === 'secao') { encaixes.secao[a] = b; if (st.visitadas[a]) montaSecao(a); return; }
      if (tipo === 'busca') { encaixes.busca.push(a); return; }
      if (tipo === 'perfil') { encaixes.perfil.push(a); return; }
      encaixes[tipo] = a;
    },
    prescricaoIA: function (item) {
      if (encaixes.prescricaoIA) return encaixes.prescricaoIA(item);
      location.href = '../condutai.html?busca=' + encodeURIComponent(item.nomeOriginal || item.nome);
    },
    _aoMudarListas: function () { desenhaCalma(); }
  };

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', inicia); else inicia();
})();
