/* CondutAI — áreas absorvidas em 07/10/2026: Antibióticos (ex-ATBguia), Calculadoras (ex-CalcMed) e POCUS (ex-PocusAI).
   Este arquivo é pequeno e entra com o app; o conteúdo de cada área (condutai-atb/-calc/-pocus .js + .css)
   só é baixado quando a área abre ou quando a busca do Início precisa dele.
   - showView(nome) chama CVX.view(...): abre a área (carrega se preciso), fecha a anterior (esvazia o DOM dela);
   - telas internas entram no histórico ({cv: área, sub: tela}): o Voltar do aparelho volta de tela em tela;
   - endereços: condutai.html#antibioticos[/item], #calculadoras[/id], #pocus[/exame] (os apps antigos redirecionam para cá);
   - busca do Início: calculadoras, focos/germes/antimicrobianos e exames de POCUS;
   - dentro de uma conduta do banco: atalhos para as calculadoras citadas no texto e para o foco correspondente em
     Antibióticos (lista explícita abaixo, conferida contra o texto do banco). */
(function () {
  'use strict';
  var W = window, D = document;
  var AREAS = {
    atb:   { js: 'condutai-atb.js?v=2',   css: 'condutai-atb.css?v=1',   ns: 'CVATB',   hash: 'antibioticos', ic: 'ti-pill',       cor: 'var(--c-ciano)',   chave: 'atb antibiotico antibioticos antimicrobiano antibioticoterapia' },
    calc:  { js: 'condutai-calc.js?v=1',  css: 'condutai-calc.css?v=1',  ns: 'CVCalc',  hash: 'calculadoras', ic: 'ti-calculator', cor: 'var(--c-laranja)', chave: 'calculadora calculo escore score' },
    pocus: { js: 'condutai-pocus.js?v=2', css: 'condutai-pocus.css?v=1', ns: 'CVPOCUS', hash: 'pocus',        ic: 'ti-wave-sine',  cor: 'var(--c-teal)',    chave: 'pocus ultrassom ultrassonografia us usg' }
  };
  var DO_HASH = { antibioticos: 'atb', calculadoras: 'calc', pocus: 'pocus' };
  var promJs = {}, promCss = {};

  function carregaJs(a) {
    if (!promJs[a]) promJs[a] = new Promise(function (ok, falha) {
      if (W[AREAS[a].ns]) { ok(W[AREAS[a].ns]); return; }
      var s = D.createElement('script');
      s.src = AREAS[a].js; s.async = true;
      s.onload = function () { W[AREAS[a].ns] ? ok(W[AREAS[a].ns]) : falha(new Error('módulo vazio')); };
      s.onerror = function () { promJs[a] = null; falha(new Error('sem rede')); };
      D.head.appendChild(s);
    });
    return promJs[a];
  }
  function carregaCss(a) {
    if (!promCss[a]) promCss[a] = new Promise(function (ok) {
      var l = D.createElement('link');
      l.rel = 'stylesheet'; l.href = AREAS[a].css;
      l.onload = function () { ok(); };
      l.onerror = function () { promCss[a] = null; ok(); };
      D.head.appendChild(l);
    });
    return promCss[a];
  }
  function carrega(a) { return Promise.all([carregaJs(a), carregaCss(a)]).then(function (r) { return r[0]; }); }

  function raiz(a) { return D.getElementById(a + 'Root'); }
  function secao(a) { return D.getElementById(a + 'View'); }
  function ativa(a) { var s = secao(a); return !!(s && !s.hidden); }

  /* ---------- abrir / fechar área (chamado pelo showView) ---------- */
  var pedido = {};   // última tela pedida por área (vale a mais recente, mesmo se o módulo demorar)
  function mostra(a, sub) {
    pedido[a] = sub || '';
    var r = raiz(a);
    var pronto = W[AREAS[a].ns] && promCss[a];
    if (!pronto && r && !r.childElementCount) r.innerHTML = '<div class="cvx-carrega" role="status"><span class="cvx-spin" aria-hidden="true"></span> Carregando</div>';
    carrega(a).then(function (m) {
      if (!ativa(a)) return;
      var rr = raiz(a); if (rr && rr.querySelector('.cvx-carrega')) rr.innerHTML = '';
      m.entrar(pedido[a]);
    }, function () {
      var rr = raiz(a);
      if (rr && ativa(a)) rr.innerHTML = '<div class="cvx-carrega erro" role="alert"><i class="ti ti-wifi-off" aria-hidden="true"></i> Não consegui abrir esta área agora. Confira a conexão e toque de novo.</div>';
    });
  }
  function esconde(a) {
    var m = W[AREAS[a].ns];
    if (m && m.sair) { try { m.sair(); } catch (e) { } }
    else { var r = raiz(a); if (r) r.innerHTML = ''; }
  }
  /* showView(nome, opt) → aqui, depois de trocar a tela visível */
  function view(nome, antes, opt) {
    opt = opt || {};
    if (AREAS[antes] && antes !== nome) esconde(antes);
    if (AREAS[nome]) {
      var sub = opt.estado ? (opt.estado.sub || '') : (opt.sub || '');
      mostra(nome, sub);
    }
    // o endereço #area só vale enquanto a área está aberta
    var h = (location.hash || '').slice(1).split('/')[0];
    if (DO_HASH[h] && DO_HASH[h] !== nome) { try { W.history.replaceState(W.history.state, '', location.pathname + location.search); } catch (e) { } }
  }
  /* sempre W.history: o CondutAI tem uma variável global "history" (o histórico de consultas) que esconde a do navegador */
  function empilha(a, sub) { try { W.history.pushState({ cv: a, sub: sub || '' }, ''); } catch (e) { } }
  function troca(a, sub) { try { W.history.replaceState({ cv: a, sub: sub || '' }, ''); } catch (e) { } }
  /* abrir de fora (busca, atalho na conduta, endereço) */
  function abre(a, sub) {
    if (!AREAS[a] || typeof W.showView !== 'function') return;
    if (ativa(a)) { mostra(a, sub); return; }
    W.showView(a, { sub: sub || '' });
  }
  /* botões da barra de seções da área (funcionam mesmo antes de o módulo terminar de baixar) */
  function nav(a, v) {
    carrega(a).then(function (m) { if (ativa(a)) m.navIr(v); });
  }

  /* ---------- endereço ---------- */
  function rota() {
    var h = decodeURIComponent((location.hash || '').slice(1));
    var m = /^(antibioticos|calculadoras|pocus)(?:\/(.*))?$/.exec(h);
    if (!m) return false;
    abre(DO_HASH[m[1]], m[2] || '');
    return true;
  }
  W.addEventListener('hashchange', rota);

  /* ---------- busca do Início ---------- */
  var norm = function (t) { return String(t || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase(); };
  var idx = null, idxDe = '';
  function indice() {
    var de = Object.keys(AREAS).filter(function (a) { return W[AREAS[a].ns]; }).join(',');
    if (idx && idxDe === de) return idx;
    idx = []; idxDe = de;
    Object.keys(AREAS).forEach(function (a) {
      var m = W[AREAS[a].ns]; if (!m || !m.indice) return;
      m.indice().forEach(function (x) {
        idx.push({ area: a, sub: x.sub, nome: x.nome, rot: x.rot, nn: norm(x.nome), ch: norm(x.nome + ' ' + x.chave + ' ' + AREAS[a].chave) });
      });
    });
    return idx;
  }
  var refazer = null, pedindo = false;
  function busca(q, refaz) {
    refazer = refaz || refazer;
    var faltam = Object.keys(AREAS).filter(function (a) { return !W[AREAS[a].ns]; });
    if (faltam.length && !pedindo) {
      pedindo = true;
      Promise.all(faltam.map(function (a) { return carregaJs(a).catch(function () { }); })).then(function () {
        pedindo = false; idx = null; if (refazer) refazer();
      });
    }
    var t = norm(String(q || '').trim());
    if (t.length < 2) return [];
    var termos = t.split(/\s+/);
    return indice().map(function (x) {
      if (!termos.every(function (w) { return x.ch.indexOf(w) >= 0; })) return null;
      var pts = (x.nn.indexOf(t) === 0 ? 3 : 0) + (x.nn.indexOf(t) >= 0 ? 2 : 0) + termos.filter(function (w) { return x.nn.indexOf(w) >= 0; }).length;
      return { x: x, pts: pts };
    }).filter(Boolean).sort(function (a, b) { return b.pts - a.pts; }).slice(0, 4).map(function (h) {
      return { area: h.x.area, sub: h.x.sub, nome: h.x.nome, rot: h.x.rot, ic: AREAS[h.x.area].ic, cor: AREAS[h.x.area].cor };
    });
  }

  /* ---------- atalhos dentro da conduta ----------
     Só onde o texto da conduta (condutai-banco.js) já cita o escore/calculadora pelo nome. Não entram citações
     homônimas: "4 Ts" da hemorragia pós-parto (não é o 4Ts da HIT), "Cairo-Bishop" da lise tumoral (não é o
     índice de Bishop), "Glasgow" da hepatite alcoólica (escore de Glasgow para hepatite, não a escala de coma),
     nem a menção genérica ao CKD-EPI para ajuste de dose, que aparece em quase todas as condutas. */
  var NOME_CALC = {
    wellstep: 'Wells para TEP', wellstvp: 'Wells para TVP', genebra: 'Escore de Genebra revisado (TEP)', perc: 'PERC (descartar TEP)',
    pesi: 'PESI (gravidade do TEP)', spesi: 'sPESI (PESI simplificado)', cg: 'Clearance de creatinina (Cockcroft-Gault)',
    chads: 'CHA₂DS₂-VA', hasbled: 'HAS-BLED', timi: 'TIMI (AI / IAMSSST)', grace: 'GRACE (SCA)', qtc: 'QTc (Bazett e Fridericia)',
    qsofa: 'qSOFA', sofa: 'SOFA', glasgow: 'Escala de Coma de Glasgow', shock: 'Índice de choque', aniongap: 'Ânion gap',
    gaposm: 'Gap osmolar', osm: 'Osmolaridade plasmática', curb: 'CURB-65', centor: 'Centor / McIsaac', childpugh: 'Child-Pugh',
    meld: 'MELD-Na', blatchford: 'Glasgow-Blatchford (HDA)', apache: 'APACHE II', maddrey: 'Função discriminante de Maddrey',
    pafi: 'Relação PaO₂/FiO₂', pesoideal: 'Peso ideal (Devine)', nacorr: 'Sódio corrigido (hiperglicemia)',
    defagua: 'Déficit de água livre', cacorr: 'Cálcio corrigido (albumina)', abcd2: 'ABCD²  (risco após AIT)', nihss: 'NIHSS (gravidade do AVC)',
    ich: 'ICH Score (hemorragia)', hunthess: 'Hunt-Hess (HSA)', feureia: 'Fração de excreção de ureia', ckdepi: 'TFG (CKD-EPI 2021)',
    plasmic: 'PLASMIC (PTT)', hscore: 'HScore (hemofagocitose / LHH)'
  };
  var LIG_CALC = {
    nstemi: ['grace', 'timi'],
    fa_rvr: ['chads', 'cg'], fa_cronica: ['chads', 'hasbled'], flutter: ['chads'], cmh: ['chads'], chagas: ['chads'], ic_cronica: ['chads'],
    sincope: ['qtc'],
    sepse: ['qsofa', 'sofa', 'pafi'], itu_comp: ['qsofa', 'sofa'],
    politrauma: ['glasgow'], tce_grave: ['glasgow'], choque_hipov: ['shock'],
    intox_geral: ['aniongap', 'gaposm', 'qtc'], intox_metanol: ['aniongap', 'gaposm'], acid_metab: ['aniongap', 'gaposm'],
    pac: ['curb'], influenza: ['curb'], mono: ['centor'],
    tep: ['wellstep', 'genebra', 'perc', 'pesi', 'spesi', 'cg'], tep_gestante: ['wellstep', 'genebra', 'pesi'], tvp: ['wellstvp', 'cg'],
    sdra: ['pafi', 'pesoideal'], vni_criterios: ['pafi'], covid_grave: ['pafi'],
    hep_b_cron: ['childpugh', 'meld'], hep_c: ['childpugh'], hda_var: ['childpugh', 'meld'], hda_naovar: ['blatchford'],
    pancreatite: ['apache'], hep_alcool: ['maddrey', 'meld'], encef_hep: ['meld'], pbe: ['childpugh', 'meld'],
    cirrose_inicial: ['childpugh', 'meld'], chc: ['childpugh', 'meld'], ascite: ['meld'], sd_hepatorrenal: ['meld'],
    cad: ['aniongap', 'nacorr'], ehh: ['osm', 'nacorr', 'aniongap'], di: ['osm', 'defagua'], hiperna: ['defagua', 'nacorr', 'osm'],
    hipocalcemia: ['cacorr', 'qtc'],
    avc_isq: ['nihss'], avc_hem: ['ich', 'glasgow'], ait: ['abcd2', 'nihss', 'chads'], hsa: ['hunthess', 'glasgow'],
    lra: ['feureia'], doenca_renal: ['ckdepi'], nefropatia_diab: ['ckdepi'],
    plaquetopenia: ['plasmic'], hlh: ['hscore']
  };
  var LIG_ATB = {
    pac: ['pac', 'Pneumonia'], pav: ['pac', 'Pneumonia'],
    itu_comp: ['itu', 'ITU / urinária'], itu_naocomp: ['itu', 'ITU / urinária'], itu_gestante: ['itu', 'ITU / urinária'],
    celulite: ['pele', 'Pele e partes moles'], fascite_necr: ['pele', 'Pele e partes moles'], celulite_facial: ['pele', 'Pele e partes moles'],
    apendicite: ['abdome', 'Intra-abdominal'], diverticulite: ['abdome', 'Intra-abdominal'], colangite: ['abdome', 'Intra-abdominal'], colecistite: ['abdome', 'Intra-abdominal'],
    sepse: ['sepse', 'Sepse / foco indefinido'], meningite: ['meningite', 'Meningite / SNC'],
    osteomielite: ['osteo', 'Osteoarticular'], artrite_sept: ['osteo', 'Osteoarticular'],
    neutropenia_febril: ['neutropenia', 'Neutropenia febril'],
    tb_pulm: ['tuberculose', 'Tuberculose'], tb_extra: ['tuberculose', 'Tuberculose'],
    criptococose: ['fungos', 'Infecções fúngicas'], aspergilose: ['fungos', 'Infecções fúngicas'], histoplasmose: ['fungos', 'Infecções fúngicas'], pcm: ['fungos', 'Infecções fúngicas']
  };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function liga(rc, item) {
    var meta = item && item.protocolMeta;
    if (!rc || !meta) return;
    var calcs = LIG_CALC[meta.id] || [], atb = LIG_ATB[meta.id];
    if (!calcs.length && !atb) return;
    var bloco = rc.querySelector('.cvl-links'), lin = bloco && bloco.querySelector('.cvl-lin');
    if (!lin || bloco.querySelector('[data-cvx]')) return;
    if (atb) {
      var b = D.createElement('button');
      b.type = 'button'; b.dataset.cvx = 'atb|item:' + atb[0];
      b.innerHTML = '<span class="cvl-l-ic" style="--k:var(--c-ciano)"><i class="ti ti-pill" aria-hidden="true"></i></span><span><b>Antibióticos: ' + esc(atb[1]) + '</b><small>Esquema empírico, escalonamento e doses com ajuste renal</small></span><i class="ti ti-chevron-right" aria-hidden="true"></i>';
      var ia = lin.querySelector('[data-l="ia"]');
      lin.insertBefore(b, ia || null);
    }
    if (calcs.length) {
      var p = D.createElement('p'); p.className = 'cvl-citp'; p.textContent = calcs.length > 1 ? 'Calculadoras citadas nesta conduta' : 'Calculadora citada nesta conduta';
      var cx = D.createElement('div'); cx.className = 'cvl-cit cvx-calcs';
      cx.innerHTML = calcs.map(function (id) { return '<button type="button" class="cvx-calc" data-cvx="calc|' + id + '"><i class="ti ti-calculator" aria-hidden="true"></i>' + esc(NOME_CALC[id] || id) + '</button>'; }).join('');
      lin.insertAdjacentElement('afterend', cx);
      lin.insertAdjacentElement('afterend', p);
    }
  }
  function janelaCalc(id) {
    carrega('calc').then(function (m) { if (!m.abreJanela(id)) abre('calc', id); }, function () { abre('calc', id); });
  }
  D.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-cvx]');
    if (!b) return;
    var par = b.dataset.cvx.split('|');
    e.preventDefault();
    if (par[0] === 'calc' && b.closest('.cvl-links')) janelaCalc(par[1]);
    else abre(par[0], par[1]);
  });

  W.CVX = {
    AREAS: AREAS, view: view, mostra: mostra, abre: abre, nav: nav, empilha: empilha, troca: troca, busca: busca,
    liga: liga, janelaCalc: janelaCalc, carrega: carrega, rota: rota, _LIG_CALC: LIG_CALC, _LIG_ATB: LIG_ATB, _NOME_CALC: NOME_CALC
  };
  // endereço de entrada (ex.: condutai.html#calculadoras/imc, vindo do calcmed.html antigo)
  if (location.hash) rota();
})();
