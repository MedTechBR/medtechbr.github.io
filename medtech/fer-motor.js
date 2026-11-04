/* MedTech PWA: motor das Ferramentas, sem DOM (roda no navegador e no Node, para o teste de paridade).
   Faz em tempo real o que o gerador do iPhone faz uma vez (medtech-ios/tools/ferramentas_gera_dados.mjs):
   lê os arquivos do próprio site (condutai-calc.js, condutai-atb.js, condutai-pocus.js, paliai.html, pali-conteudo.js,
   condutai.html e condutai-seguranca.js), roda o JS clínico original sem mudar uma linha dentro de um "global" isolado
   criado pela ponte do iPhone (fer-ponte.js) e devolve:
   - os mesmos dados que o app de iPhone lê dos JSON gerados (campos das calculadoras, focos, drogas, exames, temas...);
   - os mesmos motores do iPhone (MotorCalc, MotorATB, MotorPocus, MotorPali, MotorCondutai, FerMd), chamando as funções
     originais: calc(), CVATB.calcDoseTool(), calcClcrFill() (CKD-EPI 2021), compute() do PaliAI, interpretarGaso() etc.
   Nenhuma regra clínica é escrita aqui. Expõe MTFerMotor.criar(ler), onde ler(caminho) devolve uma promessa com o texto. */
(function (raiz) {
  'use strict';
  var Ponte = (typeof module !== 'undefined' && module.exports) ? require('./fer-ponte.js') : raiz.MTFerPonte;

  /* ---------- execução isolada: o equivalente a um JSContext do iPhone ---------- */
  /* O código original enxerga window, document, MT etc. do global da ponte; o que o JavaScriptCore não tem
     (requestAnimationFrame, localStorage, fetch) fica indefinido, para o caminho ser o mesmo do iPhone. */
  var PARAMS = ['window', 'self', 'globalThis', 'document', 'MT', 'matchMedia', 'MutationObserver', 'history', 'location', 'navigator',
    'isSecureContext', 'scrollTo', 'addEventListener', 'setTimeout', 'clearTimeout', 'requestAnimationFrame', 'localStorage', 'sessionStorage', 'fetch', 'module'];
  /* with(G): um nome solto (CVSeg, setSQ...) acha o que outro script pôs no global, como no JavaScriptCore. */
  function executar(G, fonte, nomes) {
    nomes = nomes || [];
    var ret = nomes.length ? '\n;return {' + nomes.map(function (n) { return JSON.stringify(n) + ':typeof ' + n + '!=="undefined"?' + n + ':undefined'; }).join(',') + '};' : '\n;';
    var f = new Function(PARAMS.join(','), 'with (window) {\n' + fonte + ret + '\n}');
    var r = f.apply(G, PARAMS.map(function (p) { return (p === 'window' || p === 'self' || p === 'globalThis') ? G : p === 'module' ? undefined : G[p]; })) || {};
    /* funções e constantes de nível superior viram globais, como num script comum */
    nomes.forEach(function (n) { if (r[n] !== undefined) G[n] = r[n]; });
    return r;
  }
  function contexto(permissivo) {
    var G = Ponte();
    if (permissivo) G.MTPonte.permissivo(true);
    return G;
  }

  /* ---------- HTML para árvore (igual ao gerador) ---------- */
  var VAZIOS = { br: 1, input: 1, img: 1, hr: 1, meta: 1, link: 1 };
  function ent(s) {
    return s.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#(\d+);/g, function (_, n) { return String.fromCodePoint(+n); }).replace(/&amp;/g, '&');
  }
  function arvore(html) {
    var raizA = { tag: '#', attrs: {}, filhos: [] }, pilha = [raizA];
    var re = /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:\s[^<>]*?)?)\s*\/?>/g;
    var ult = 0, m;
    while ((m = re.exec(html))) {
      if (m.index > ult) pilha[pilha.length - 1].filhos.push(ent(html.slice(ult, m.index)));
      ult = re.lastIndex;
      var tag = m[1].toLowerCase();
      if (m[0][1] === '/') {
        var i = pilha.length - 1;
        while (i > 0 && pilha[i].tag !== tag) i--;
        if (i > 0) pilha.length = i;
        continue;
      }
      var attrs = {}, am, are = /([a-zA-Z0-9-]+)(?:="([^"]*)")?/g, txt = m[2] || '';
      while ((am = are.exec(txt))) attrs[am[1].toLowerCase()] = am[2] === undefined ? '' : ent(am[2]);
      var no = { tag: tag, attrs: attrs, filhos: [] };
      pilha[pilha.length - 1].filhos.push(no);
      if (!VAZIOS[tag] && !/\/>$/.test(m[0])) pilha.push(no);
    }
    if (ult < html.length) pilha[pilha.length - 1].filhos.push(ent(html.slice(ult)));
    return raizA;
  }
  function textoPuro(n) { return typeof n === 'string' ? n : n.filhos.map(textoPuro).join(''); }
  var LIGA_B = '\u0001', DESL_B = '\u0002', LIGA_I = '\u0003', DESL_I = '\u0004';
  function semMarcas(s) { return String(s).replace(/[\u0001-\u0004]/g, ''); }
  function emLinha(n) {
    if (typeof n === 'string') return n.replace(/\s+/g, ' ');
    var dentro = function () { return n.filhos.map(emLinha).join(''); };
    switch (n.tag) {
      case 'br': return '\n';
      case 'b': case 'strong': return LIGA_B + dentro() + DESL_B;
      case 'i': if ((n.attrs.class || '').indexOf('ti') >= 0) return ''; return LIGA_I + dentro() + DESL_I;
      case 'em': return LIGA_I + dentro() + DESL_I;
      default: return dentro();
    }
  }
  function limpa(s) { return s.replace(/[ \t]*\n[ \t]*/g, '\n').replace(/ {2,}/g, ' ').trim(); }
  function inl(n) { return limpa(emLinha(n)); }
  function ehNo(c) { return typeof c !== 'string'; }
  function tabela(no) {
    var linhas = [];
    var achar = function (n) { if (typeof n === 'string') return; if (n.tag === 'tr') linhas.push(n); else n.filhos.forEach(achar); };
    achar(no);
    var celulas = function (tr) { return tr.filhos.filter(function (c) { return ehNo(c) && (c.tag === 'td' || c.tag === 'th'); }); };
    var h = [], r = [];
    linhas.forEach(function (tr, i) {
      var cs = celulas(tr), vals = [];
      cs.forEach(function (c) { vals.push(inl(c)); for (var k = 1; k < (+c.attrs.colspan || 1); k++) vals.push(''); });
      if (i === 0 && cs.every(function (c) { return c.tag === 'th'; })) h = vals; else r.push(vals);
    });
    return { t: 'tab', h: h, r: r };
  }
  function blocosHTML(html) {
    var raizA = arvore(html), out = [];
    var lista = function (n) { return { t: 'l', o: n.tag === 'ol', i: n.filhos.filter(function (c) { return ehNo(c) && c.tag === 'li'; }).map(inl) }; };
    raizA.filhos.forEach(function (n) {
      if (typeof n === 'string') { if (n.trim()) out.push({ t: 'p', x: limpa(n.replace(/\s+/g, ' ')) }); return; }
      if (/^h[1-6]$/.test(n.tag)) out.push({ t: 'h', x: inl(n) });
      else if (n.tag === 'p') { var k = (n.attrs.class || '').split(/\s+/); out.push(k.indexOf('ref') >= 0 ? { t: 'c', k: 'ref', x: inl(n) } : { t: 'p', x: inl(n) }); }
      else if (n.tag === 'ul' || n.tag === 'ol') out.push(lista(n));
      else if (n.tag === 'table') out.push(tabela(n));
      else if (n.tag === 'div' && (n.attrs.class || '').indexOf('tbl-scroll') >= 0) { n.filhos.filter(function (c) { return ehNo(c) && c.tag === 'table'; }).forEach(function (c) { out.push(tabela(c)); }); }
      else if (n.tag === 'div') {
        var kk = (n.attrs.class || '').split(/\s+/)[0] || 'p';
        var partes = n.filhos.filter(function (c) { return typeof c === 'string' ? c.trim() : true; });
        var txt = partes.map(function (c) { return ehNo(c) && (c.tag === 'ul' || c.tag === 'ol') ? c.filhos.filter(ehNo).map(inl).join('\n') : inl(c); }).join(' ');
        out.push({ t: 'c', k: kk, x: limpa(txt) });
      } else { var s = inl(n); if (s) out.push({ t: 'p', x: s }); }
    });
    return out;
  }
  function semEmoji(s) { return s.replace(/\p{Emoji_Presentation}️?\s*/gu, ''); }
  function norm(s) { return String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

  /* ---------- texto que o JS original escreve em HTML (FerTexto.deHTML do iPhone) ---------- */
  function deHTML(html) {
    var s = String(html);
    s = s.replace(/<i class="ti[^>]*><\/i>/g, '');
    s = s.replace(/<br\s*\/?>/g, '\n');
    s = s.replace(/<\/?(b|strong)>/g, function (t) { return t.charAt(1) === '/' ? DESL_B : LIGA_B; });
    s = s.replace(/<\/?(i|em)>/g, function (t) { return t.charAt(1) === '/' ? DESL_I : LIGA_I; });
    s = s.replace(/<div[^>]*>/g, '\n');
    s = s.replace(/<[^>]+>/g, '');
    [['&lt;', '<'], ['&gt;', '>'], ['&quot;', '"'], ['&#39;', "'"], ['&nbsp;', ' '], ['&amp;', '&']].forEach(function (p) { s = s.split(p[0]).join(p[1]); });
    return s.trim();
  }

  /* ---------- CALCULADORAS (gerarCalc) ---------- */
  var GRUPOS_CALC = [
    ['Rim e eletrólitos', ['Nefrologia / Eletrólitos']],
    ['Coração e trombose', ['Cardiologia / TEV', 'Cardiologia avançada', 'TEV / Embolia']],
    ['Sinais vitais e ECG', ['Sinais vitais / ECG']],
    ['UTI e emergência', ['Terapia intensiva', 'Emergência / Infecto']],
    ['Neurologia', ['Neurologia', 'Neurologia / AVC']],
    ['Fígado e digestivo', ['Gastro / Hepato', 'Hepatologia']],
    ['Sangue', ['Hematologia']],
    ['Gestação e criança', ['Obstetrícia / Pediatria', 'Pediatria']],
    ['Peso e metabolismo', ['Antropometria']]
  ];
  var GRUPO_POR_ID = { retic: 'Sangue' };
  function dadosCalc(CALCS) {
    var grupoDe = function (x) { if (GRUPO_POR_ID[x.id]) return GRUPO_POR_ID[x.id]; var g = GRUPOS_CALC.filter(function (g) { return g[1].indexOf(x.cat) >= 0; })[0]; return g ? g[0] : null; };
    var lista = CALCS.map(function (x) {
      var raizA = arvore(x.fields), grupos = [];
      var acaoDe = function (n) { var m = /CVCalc\.(\w+)\(\)/.exec(n.attrs.onchange || n.attrs.oninput || ''); return m && m[1] !== 'run' ? m[1] : undefined; };
      var campoDe = function (ctrl, rotulo) {
        if (ctrl.tag === 'select') return { tipo: 'escolha', id: ctrl.attrs.id, rotulo: rotulo, opcoes: ctrl.filhos.filter(function (o) { return ehNo(o) && o.tag === 'option'; }).map(function (o) { return { v: o.attrs.value, t: textoPuro(o) }; }), acao: acaoDe(ctrl) };
        if (ctrl.attrs.type === 'date') return { tipo: 'data', id: ctrl.attrs.id, rotulo: rotulo };
        if (ctrl.attrs.type === 'checkbox') return { tipo: 'marcar', id: ctrl.attrs.id, rotulo: rotulo };
        return { tipo: 'numero', id: ctrl.attrs.id, rotulo: rotulo, inicial: ctrl.attrs.value, dica: ctrl.attrs.placeholder || undefined, passo: ctrl.attrs.step || undefined };
      };
      var achaCtrl = function (n) { for (var i = 0; i < n.filhos.length; i++) { var f = n.filhos[i]; if (typeof f === 'string') continue; if (f.tag === 'input' || f.tag === 'select') return f; var r = achaCtrl(f); if (r) return r; } return null; };
      var deField = function (n) { var lab = n.filhos.filter(function (f) { return ehNo(f) && f.tag === 'label'; })[0]; return campoDe(achaCtrl(n), textoPuro(lab).trim()); };
      var deChecks = function (n) { return n.filhos.filter(function (f) { return ehNo(f) && f.tag === 'label'; }).map(function (l) { return campoDe(achaCtrl(l), textoPuro(l).trim()); }); };
      raizA.filhos.forEach(function (n) {
        if (typeof n === 'string') return;
        var k = (n.attrs.class || '');
        if (k === 'field') grupos.push({ g: '', campos: [deField(n)] });
        else if (k === 'grid2' || k === 'grid3') grupos.push({ g: k, campos: n.filhos.filter(ehNo).map(deField) });
        else if (k === 'checks') grupos.push({ g: 'checks', campos: deChecks(n) });
      });
      return { id: x.id, nome: x.name, desc: x.desc, cat: x.cat, grupo: grupoDe(x), chave: norm(x.name + ' ' + x.desc + ' ' + x.cat), grupos: grupos };
    });
    return { grupos: GRUPOS_CALC.map(function (g) { return g[0]; }), calculadoras: lista };
  }

  /* MotorCalc do iPhone: monta os campos com os ids do html() original e chama calc(). */
  function MotorCalc(G) {
    var P = G.MTPonte;
    var campos = function (d) { return [].concat.apply([], d.grupos.map(function (g) { return g.campos; })); };
    return {
      campos: campos,
      montar: function (d) { P.montar(JSON.stringify(campos(d).map(function (c) { return { tipo: c.tipo, id: c.id, opcoes: c.opcoes ? c.opcoes.map(function (o) { return { v: o.v, t: o.t }; }) : undefined, inicial: c.inicial }; }))); },
      definir: function (id, v) { P.definir(id, v); },
      marcar: function (id, b) { P.marcar(id, b); },
      acionar: function (n) { P.acionar(n); },
      estado: function () { try { return JSON.parse(P.estado()); } catch (e) { return {}; } },
      calcular: function (id) { var s = P.calcular(id); return s === 'null' ? null : JSON.parse(s); }
    };
  }
  /* EstadoCalc do iPhone: o modelo da tela. O autoteste e o teste de paridade passam por aqui. */
  function EstadoCalc(motor, def) {
    var e = { def: def, valores: {}, marcados: {}, opcoes: {}, resultado: null };
    function puxar() {
      var x = motor.estado(), v = {}, m = {}, o = {};
      Object.keys(x).forEach(function (id) { v[id] = x[id].v; m[id] = x[id].c; o[id] = x[id].o; });
      e.valores = v; e.marcados = m; e.opcoes = o;
    }
    function recalcular() { e.resultado = motor.calcular(def.id); }
    e.reiniciar = function () { motor.montar(def); puxar(); recalcular(); };
    e.definir = function (c, v) { motor.definir(c.id, v); e.valores[c.id] = v; if (c.acao) { motor.acionar(c.acao); puxar(); } recalcular(); };
    e.marcar = function (c, b) { motor.marcar(c.id, b); e.marcados[c.id] = b; recalcular(); };
    /* várias telas de calculadora dividem o mesmo motor: antes de mexer, a tela remonta o próprio estado */
    e.reaplicar = function () {
      motor.montar(def);
      motor.campos(def).forEach(function (c) {
        if (c.tipo === 'marcar') motor.marcar(c.id, !!e.marcados[c.id]);
        else if (e.valores[c.id] != null) { motor.definir(c.id, e.valores[c.id]); if (c.acao) motor.acionar(c.acao); }
      });
    };
    e.reiniciar();
    return e;
  }
  function faixaCalc(badge) { return { 'b-green': 'ok', 'b-amber': 'atencao', 'b-red': 'alerta', 'b-blue': 'info' }[badge] || 'neutra'; }
  /* Mesmo texto de copiarRes() do original. */
  function textoCopiarCalc(nome, r) { var base = (nome + ': ' + r.val + ' ' + r.unit).trim(); return r.interp ? base + ' (' + r.interp + ')' : base; }

  /* ---------- ANTIBIÓTICOS (gerarATB) ---------- */
  function dadosATB(fonte, G) {
    var d = G.CVATB._dados;
    var alvo = G.document.getElementById('atbRoot');
    var tela = function (f) { f(); return alvo.innerHTML; };
    var disc = function (h) { var m = /<div class="disc">([\s\S]*?)<\/div>/.exec(h); return m ? inl(arvore(m[1])) : ''; };
    var secoes = function (t) { return JSON.parse(G.MTPonte.secoes(t)); };
    var inlMd = function (s) { var r = secoes(String(s)); return (r[0] && r[0].blocos[0] && r[0].blocos[0].x) || ''; };
    var focos = d.FOCOS.map(function (f) { return { id: f.id, nome: f.nome, tags: f.tags || '', secoes: secoes(f.md) }; });
    var guia = d.GUIA.map(function (f) { return { id: f.id, nome: f.nome, cat: f.cat, tags: f.tags || '', secoes: secoes(f.md) }; });
    var faixa = function (b) { return (b.max >= 999 ? '≥ ' + b.min : (b.min <= 0 ? '< ' + (b.max + 1) : b.min + '–' + b.max)) + ' mL/min'; };
    var drogas = d.DRUGS.map(function (x) {
      return {
        id: x.id, nome: x.nome, classe: x.classe, grupo: x.grupo || 'Antibacterianos',
        dose: inlMd(x.doseNormal), kg: x.kg ? { faixa: x.kg.lo + (x.kg.hi !== x.kg.lo ? '–' + x.kg.hi : '') + ' mg/kg', intervalo: inlMd(x.kg.intervalo), nota: x.kg.nota ? inlMd(x.kg.nota) : undefined } : undefined,
        renal: (x.renal || []).map(function (b) { return { rotulo: 'ClCr ' + faixa(b), txt: inlMd(b.txt), bruto: b.txt, min: b.min || 0, max: b.max == null ? 9999 : b.max }; }),
        ped: d.PED[x.id] ? inlMd(d.PED[x.id]) : undefined, rx: d.RX[x.id] ? inlMd(d.RX[x.id]) : undefined,
        adversos: inlMd(x.adversos), interacoes: inlMd(x.interacoes)
      };
    });
    var C = G.CVATB;
    var hIvvo = tela(function () { C.abrir_ivvo(); });
    var corpoIvvo = /<div class="cvx-content">([\s\S]*?)<\/div>\s*<div class="disc">/.exec(hIvvo)[1];
    var ivvoPartes = corpoIvvo.replace(/<div class="perla">[\s\S]*?<span><b>Pérola:<\/b>\s*([\s\S]*?)<\/span><\/div>/, '<div class="perola">$1</div>');
    var hCob = tela(function () { C.abrir_cobertura(); });
    var hDir = tela(function () { C.abrir_dirigida(); });
    var hItem = tela(function () { C.abrirItem('pac'); });
    var hDrug = tela(function () { C.abrirDrug('vancomicina'); });
    var hDose = tela(function () { C.abrir_dose(); });
    var notaPed = /<div class="nota-p">([\s\S]*?)<\/div>/.exec(hDrug)[1];
    var hEmp = tela(function () { C.abrirEmpirico(); });
    var hAss = tela(function () { C.abrirAssistente(); });
    var riscos = [], m, re = /id="r_(\w+)"[^>]*>\s*([^<]+)<\/label>/g;
    while ((m = re.exec(hEmp))) riscos.push({ id: m[1], t: m[2].trim() });
    var prevAtbs = JSON.parse(/const PREV_ATBS=(\[[^\]]*\])/.exec(fonte)[1].replace(/'/g, '"'));
    var sugestoes = function (html) { var r = [], mm, rr = /class="sugg" onclick="[^"]*">([^<]+)<\/button>/g; while ((mm = rr.exec(html))) r.push(ent(mm[1])); return r; };
    return {
      focos: focos, guia: guia, drogas: drogas,
      cobertura: { alvos: d.COV_ALVOS, linhas: d.COV.map(function (r) { return { nome: r[0], v: r.slice(1) }; }), aviso: disc(hCob) },
      dirigida: d.DIRIGIDA.map(function (x, i) { return { id: String(i), g: x.g, atb: x.atb }; }),
      ivvo: { blocos: blocosHTML(ivvoPartes), aviso: disc(hIvvo) },
      empirico: { riscos: riscos, usados: prevAtbs, aviso: disc(hEmp) },
      assistente: { sugestoes: sugestoes(hAss), aviso: disc(hAss) },
      textos: { item: disc(hItem), droga: disc(hDrug), dirigida: disc(hDir), dose: disc(hDose), notaPed: inl(arvore(notaPed)) }
    };
  }
  function ponto(v) { return String(v == null ? '' : v).replace(/,/g, '.'); }
  /* MotorATB do iPhone: dose e TFG saem do CVATB original. */
  function MotorATB(G) {
    var P = G.MTPonte;
    P.prepararATB();
    var pedido = function (f) { var s = P.capturarIA(f); return s === 'null' ? null : JSON.parse(s); };
    var el = function (id) { return G.document.getElementById(id); };
    var M = {
      dose: function (id, peso, clcr) { return P.doseATB(id, ponto(peso), ponto(clcr)); },
      doseTool: function (id, peso, clcr) { return P.doseToolATB(id, ponto(peso), ponto(clcr)); },
      tfg: function (idade, cr, sexo) { var r = JSON.parse(P.tfgATB(ponto(idade), ponto(cr), sexo)); return { valor: r.tfg, html: r.html }; },
      pedido: pedido,
      aprofundar: function (id) { return pedido(function () { G.CVATB.aprofundar(id); }); },
      aprofundarDrug: function (id) { return pedido(function () { G.CVATB.aprofundarDrug(id); }); },
      dirigida: function (id) { return pedido(function () { el('dirSel').value = id; G.CVATB.sugerirDirigida(); }); },
      /* mesmo roteiro de MotorATB.scriptEmpirico */
      empirico: function (d) {
        return pedido(function () {
          var f = G.CVATB.empForm; f.foco = d.foco; f.ctx = d.ctx; f.grav = d.grav; f.alergia = d.alergia; f.peso = d.peso; f.clcr = d.clcr; f.usados = d.usados; f.riscos = d.riscos;
          el('empUsadosTxt').value = d.detalhe; el('empExtra').value = d.extra; G.CVATB.sugerirEmpirico();
        });
      },
      responder: function (t) { P.responderIA(t); },
      falhar: function (t) { P.falharIA(t); }
    };
    M.chat = {
      reiniciar: function () { G.CVATB.abrirAssistente(); },
      enviar: function (q) { return pedido(function () { el('ask').value = q; G.CVATB.enviar(); }); },
      responder: M.responder, falhar: M.falhar
    };
    return M;
  }
  function dadosEmpiricoNovo() {
    return { foco: 'pac', ctx: 'comunitario', grav: 'enfermaria', alergia: 'nao', peso: '', clcr: '', usados: [], riscos: { atb: false, intern: false, disp: false, col: false, imuno: false }, detalhe: '', extra: '' };
  }
  /* A faixa que o original escolheu: lida da própria saída de doseAjustada() (TelaDoseATB.faixaAtiva do iPhone). */
  function faixaAtiva(saida, faixas) {
    var l = String(saida).split('\n').filter(function (x) { return semMarcas(x).indexOf('Ajuste renal (ClCr ') >= 0; })[0];
    if (!l) return null;
    var k = l.indexOf('mL/min):\u0002');
    if (k < 0) return null;
    var txt = l.slice(k + 'mL/min):\u0002'.length).trim();
    return faixas.filter(function (f) { return f.txt === txt; })[0] || null;
  }

  /* ---------- POCUS (gerarPocus) ---------- */
  function caminhoAbs(d) {
    var out = [], x = 0, y = 0, sx = 0, sy = 0;
    var toks = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g), i = 0, cmd = '';
    var n = function () { return +toks[i++]; };
    while (i < toks.length) {
      if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++];
      switch (cmd) {
        case 'M': x = n(); y = n(); sx = x; sy = y; out.push(['M', x, y]); cmd = 'L'; break;
        case 'm': x += n(); y += n(); sx = x; sy = y; out.push(['M', x, y]); cmd = 'l'; break;
        case 'L': x = n(); y = n(); out.push(['L', x, y]); break;
        case 'l': x += n(); y += n(); out.push(['L', x, y]); break;
        case 'H': x = n(); out.push(['L', x, y]); break;
        case 'h': x += n(); out.push(['L', x, y]); break;
        case 'V': y = n(); out.push(['L', x, y]); break;
        case 'v': y += n(); out.push(['L', x, y]); break;
        case 'Q': { var a = n(), b = n(); x = n(); y = n(); out.push(['Q', a, b, x, y]); break; }
        case 'q': { var a2 = x + n(), b2 = y + n(); var nx = x + n(), ny = y + n(); out.push(['Q', a2, b2, nx, ny]); x = nx; y = ny; break; }
        case 'Z': case 'z': x = sx; y = sy; out.push(['Z']); break;
        default: throw new Error('comando de caminho desconhecido ' + cmd);
      }
    }
    return out;
  }
  function diagrama(svg) {
    var raizA = arvore(svg).filhos.filter(function (f) { return ehNo(f) && f.tag === 'svg'; })[0];
    var vb = raizA.attrs.viewbox.split(/\s+/).map(Number), formas = [];
    var num = function (a, k) { return a[k] === undefined ? undefined : +a[k]; };
    raizA.filhos.forEach(function (n) {
      if (typeof n === 'string') return;
      var a = n.attrs, base = { f: a.fill, s: a.stroke, sw: num(a, 'stroke-width') };
      if (a.opacity !== undefined && +a.opacity === 0) return;
      var mix = function (o) { return Object.assign(o, base); };
      if (n.tag === 'circle') formas.push(mix({ k: 'c', x: +a.cx, y: +a.cy, r: +a.r }));
      else if (n.tag === 'ellipse') formas.push(mix({ k: 'e', x: +a.cx, y: +a.cy, rx: +a.rx, ry: +a.ry }));
      else if (n.tag === 'rect') formas.push(mix({ k: 'r', x: +a.x, y: +a.y, w: +a.width, h: +a.height, rx: num(a, 'rx') }));
      else if (n.tag === 'line') formas.push(mix({ k: 'l', x: +a.x1, y: +a.y1, x2: +a.x2, y2: +a.y2, tracejado: !!a['stroke-dasharray'] }));
      else if (n.tag === 'path') formas.push(mix({ k: 'p', d: caminhoAbs(a.d) }));
      else if (n.tag === 'text') {
        var t = textoPuro(n), f = { k: 't', x: +a.x, y: +a.y, fs: +a['font-size'], meio: a['text-anchor'] === 'middle', t: t, f: a.fill, forte: !!a['font-weight'] };
        var ant = formas[formas.length - 1];
        if (/^\d+$/.test(t) && ant && ant.k === 'c' && ant.f === '#2563eb') { ant.n = +t; f.n = +t; }
        formas.push(f);
      }
    });
    return { w: vb[2], h: vb[3], formas: formas };
  }
  function pontosDaLegenda(leg) {
    var partes = leg.split(' · ');
    var cada = partes.map(function (p) { var m = /<b>(\d+)<\/b>/.exec(p); return m ? { n: +m[1], x: inl(arvore(p.replace(m[0], '').trim())) } : null; });
    var unicos = {}; cada.forEach(function (c) { if (c) unicos[c.n] = 1; });
    if (partes.length > 1 && cada.every(Boolean) && Object.keys(unicos).length === cada.length) return cada;
    if (partes.length === 1) { var ms = leg.match(/<b>(\d+)<\/b>/g) || []; if (ms.length === 1) { var mm = /<b>(\d+)<\/b>/.exec(leg); return [{ n: +mm[1], x: inl(arvore(leg.replace(mm[0], '').trim())) }]; } }
    return null;
  }
  function fluxoBlue(html) {
    var r = arvore(html.replace(/<style>[\s\S]*?<\/style>/, ''));
    var acha = function (n, k, out) { out = out || []; n.filhos.forEach(function (f) { if (typeof f === 'string') return; if ((f.attrs.class || '').split(/\s+/).indexOf(k) >= 0) out.push(f); acha(f, k, out); }); return out; };
    var tom = function (n) { var c = acha(n, 'bf-dx')[0]; return c ? (c.attrs.class.split(/\s+/).filter(function (x) { return x.indexOf('dx-') === 0; })[0] || '').slice(3) : ''; };
    var dxTexto = function (n) { var c = acha(n, 'bf-dx')[0]; return c ? inl(c) : ''; };
    var textoSem = function (n, excl) { return semEmoji(limpa(n.filhos.map(function (f) { if (typeof f === 'string') return f.replace(/\s+/g, ' '); var k = (f.attrs.class || '').split(/\s+/); if (k.some(function (x) { return excl.indexOf(x) >= 0; })) return ''; return emLinha(f); }).join(''))); };
    return {
      pergunta: inl(acha(r, 'bf-q')[0]),
      ramos: acha(r, 'bf-lane').map(function (l) {
        return {
          rotulo: inl(acha(l, 'bf-lh')[0]),
          linhas: acha(l, 'bf-row').map(function (row) {
            var br = acha(row, 'bf-branch')[0], prof = acha(row, 'bf-prof')[0];
            var texto = textoSem(row, ['bf-prof', 'bf-arr', 'bf-dx', 'bf-branch']);
            if (br) return { perfil: inl(prof), texto: texto, sub: br.filhos.filter(ehNo).map(function (s) { return { texto: textoSem(s, ['bf-arr', 'bf-dx']), dx: dxTexto(s), tom: tom(s) }; }) };
            return { perfil: inl(prof), texto: texto, dx: dxTexto(row), tom: tom(row) };
          })
        };
      }),
      rodape: inl(acha(r, 'bf-foot')[0])
    };
  }
  function etapasPocus(e, secoes, diag, imgs, fluxo) {
    var etapas = [], lembretes = [];
    var limpos = secoes.map(function (s) { return { titulo: s.titulo, blocos: s.blocos.filter(function (b) { if (b.t === 'c' && (b.k === 'perola' || b.k === 'atencao')) { lembretes.push(b); return false; } return true; }) }; });
    var ehSonda = function (t) { return /^(sonda|posi[cç][aã]o)/i.test(semMarcas(t)); };
    var depois = -1; limpos.forEach(function (s, i) { if (ehSonda(s.titulo) && i <= 3) depois = i; });
    if (depois < 0) depois = 0;
    var pontos = e.leg ? pontosDaLegenda(e.leg) : null;
    var etapasDiagrama = function () {
      if (!diag) return [];
      if (pontos) return pontos.map(function (p, i) { return { tipo: 'ponto', titulo: 'Onde colocar a sonda', parte: pontos.length > 1 ? 'Ponto ' + (i + 1) + ' de ' + pontos.length : undefined, ponto: p.n, blocos: [{ t: 'p', x: p.x }] }; });
      return [{ tipo: 'ponto', titulo: 'Onde colocar a sonda', blocos: e.leg ? [{ t: 'p', x: inl(arvore(e.leg)) }] : [] }];
    };
    var dividir = function (t) { return /passo a passo|^t[eé]cnica|^como medir|^pontos$/i.test(semMarcas(t)); };
    limpos.forEach(function (s, i) {
      var listas = s.blocos.filter(function (b) { return b.t === 'l'; });
      if (dividir(s.titulo) && listas.length === 1 && listas[0].i.length >= 2) {
        var iniciais = [], achou = false, finais = [];
        s.blocos.forEach(function (b) { if (b.t === 'l') achou = true; else (achou ? finais : iniciais).push(b); });
        var itens = listas[0].i;
        itens.forEach(function (it, k) { etapas.push({ tipo: 'item', titulo: s.titulo, parte: (k + 1) + ' de ' + itens.length, blocos: [].concat(k === 0 ? iniciais : [], [{ t: 'g', x: it }], k === itens.length - 1 ? finais : []) }); });
      } else etapas.push({ tipo: 'texto', titulo: s.titulo, blocos: s.blocos });
      if (i === depois) etapas.push.apply(etapas, etapasDiagrama());
    });
    if (lembretes.length) etapas.push({ tipo: 'texto', titulo: 'Pontos de atenção', blocos: lembretes });
    if (fluxo) etapas.push({ tipo: 'fluxo', titulo: 'Fluxograma de decisão', blocos: [] });
    if (imgs.length) etapas.push({ tipo: 'imagens', titulo: 'Imagens de ultrassom', blocos: [] });
    return etapas;
  }
  function basename(p) { return String(p).split('/').pop(); }
  function dadosPocus(fonte) {
    var c = contexto(true);
    executar(c, fonte.replace('W.CVPOCUS = {', 'W.__X={EXAMES,IMGS,ORDEM_CAT};W.CVPOCUS = {'));
    var X = c.__X, EXAMES = X.EXAMES, IMGS = X.IMGS, ORDEM_CAT = X.ORDEM_CAT;
    var secoesMd = function (t) { return JSON.parse(c.MTPonte.secoes(t)); };
    var srcs = {};
    var exames = EXAMES.map(function (e) {
      var secoes = secoesMd(e.md);
      var diag = e.diag ? diagrama(e.diag) : null;
      var imgs = (IMGS[e.id] || []).map(function (im) {
        var arq = 'pocusimg_' + basename(im.src);
        srcs[arq] = im.src;
        return { arq: arq, leg: semEmoji(im.leg), autor: im.autor, lic: im.lic, mod: im.mod || undefined, url: im.url };
      });
      var fluxo = e.flow ? fluxoBlue(e.flow) : undefined;
      return { id: e.id, nome: e.nome, cat: e.cat, tags: e.tags || '', diagrama: diag || undefined, imagens: imgs, fluxo: fluxo, etapas: etapasPocus(e, secoes, diag, imgs, fluxo) };
    });
    var nota = /class="img-note">([^<]*?)\s*Envie/.exec(fonte)[1].trim();
    return { categorias: ORDEM_CAT, notaImagens: nota, sugestoes: JSON.parse(/const suggs=(\[[^\]]*\])/.exec(fonte)[1].replace(/'/g, '"')), exames: exames, _srcs: srcs };
  }
  function MotorPocus(G) {
    var P = G.MTPonte;
    var pedido = function (f) { var s = P.capturarIA(f); return s === 'null' ? null : JSON.parse(s); };
    return {
      aprofundar: function (id) { return pedido(function () { G.CVPOCUS.aprofundar(id); }); },
      chat: {
        reiniciar: function () { G.CVPOCUS.abrirAssistente(); },
        enviar: function (q) { return pedido(function () { G.document.getElementById('ask').value = q; G.CVPOCUS.enviar(); }); },
        responder: function (t) { P.responderIA(t); }, falhar: function (t) { P.falharIA(t); }
      }
    };
  }

  /* ---------- PALIATIVOS (gerarPali) ---------- */
  function scriptPali(html) {
    var fim = html.lastIndexOf('</script>', html.indexOf('_mtinstalar.js'));
    var ini = html.lastIndexOf('<script>', fim);
    return html.slice(ini + 8, fim);
  }
  var NOMES_PALI = ['GERAIS', 'DOENCAS', 'setSQ', 'compute', 'renderDoenca', 'gerarReuniao'];
  function dadosPali(html, conteudo, G) {
    var opcoes = /<select id="pps"[\s\S]*?<\/select>/.exec(html)[0];
    var pps = [], m, re = /<option value="([^"]*)">([^<]*)<\/option>/g;
    while ((m = re.exec(opcoes))) pps.push({ v: m[1], t: ent(m[2]) });
    G.MTPonte.prepararPali(JSON.stringify(pps));
    executar(G, scriptPali(html), NOMES_PALI);
    var GERAIS = G.GERAIS, DOENCAS = G.DOENCAS;
    var hint = /<div class="hint">"([\s\S]*?)"<\/div>/.exec(html)[1];
    var opt = function (id) { var mm = new RegExp('data-sq="' + id + '"[\\s\\S]*?</span><span>([\\s\\S]*?)<small>([\\s\\S]*?)</small>').exec(html); return { t: mm[1].trim(), d: mm[2].trim() }; };
    var base = /<div class="src">([\s\S]*?)<\/div>/.exec(html)[1];
    var discl = /<div class="disclaimer"><i[^>]*><\/i><span>([\s\S]*?)<\/span><\/div>/.exec(html)[1];
    var dica3 = /<div class="hint">(Selecione a condição[\s\S]*?)<\/div>/.exec(html)[1];
    var cj = {};
    var r = executar(cj, 'var window=this;' + conteudo, ['PALI_CONTENT']);
    var CONT = r.PALI_CONTENT || cj.PALI_CONTENT;
    var temas = CONT.map(function (x) { return { id: x.id, grupo: x.grupo, titulo: x.titulo, sub: x.sub || '', blocos: blocosHTML(x.html || '') }; });
    var grupos = []; CONT.forEach(function (x) { if (grupos.indexOf(x.grupo) < 0) grupos.push(x.grupo); });
    return {
      triagem: {
        pergunta: inl(arvore(hint)), opcoes: { sim: opt('sim'), nao: opt('nao') },
        pps: pps.filter(function (o) { return o.v; }).map(function (o) { var p = o.t.split(' — '); return { v: o.v, t: p[0], d: p.slice(1).join(' — '), bruto: o.t }; }),
        ppsTodas: pps, gerais: GERAIS.map(function (g) { return { id: g.id, t: g.t }; }), doencas: DOENCAS.map(function (d) { return { id: d.id, l: d.l, inds: d.inds }; }),
        dicaIA: /A IA gera um roteiro[^<]*/.exec(html)[0], dicaContexto: /id="ctx" placeholder="([^"]*)"/.exec(html)[1],
        dicaDoenca: dica3, base: inl(arvore(base)), aviso: inl(arvore(discl))
      },
      grupos: grupos, temas: temas
    };
  }
  /* MotorPali do iPhone: compute() do PaliAI sem alteração. */
  function MotorPali(G) {
    var P = G.MTPonte;
    var M = {
      avaliar: function (sq, pps, nGerais, doenca, nEspec) { var s = P.triagem(sq, pps, nGerais, doenca, nEspec); return s === 'null' ? null : JSON.parse(s); },
      pedidoReuniao: function (sq, pps, gerais, doenca, especs, contexto) {
        P.textosMarcados('gerais', JSON.stringify(gerais));
        P.textosMarcados('espec', JSON.stringify(especs));
        M.avaliar(sq, pps, gerais.length, doenca, especs.length);
        G.document.getElementById('ctx').value = contexto;
        var s = P.capturarIA(function () { G.gerarReuniao(); });
        return s === 'null' ? null : JSON.parse(s);
      }
    };
    return M;
  }
  function faixaPali(f) { return f === 'red' ? 'alerta' : f === 'amber' ? 'atencao' : 'ok'; }

  /* ---------- FERRAMENTAS DO CONDUTAI (gerarCondutai): trechos de condutai.html sem mudança ---------- */
  var TRECHOS = ['function escapeHtml', 'function _normKey', 'function findOffline', 'const INV_OFF', 'const INV_COMUNS', 'function buildPromptInvestigacao',
    'function buildPromptInteracoes', 'function conferenciaInteracoes', 'function buildPromptDDx', 'const PROC_OFF', 'const PROC_COMUNS', 'function buildPromptProc',
    'const VACINAS', 'function buildPromptVac', 'function buildPromptOrient', 'const CID10', 'const CID_COMUNS', 'function runCid', 'function interpretarGaso'];
  var NOMES_CONDUTAI = ['findOffline', 'INV_OFF', 'INV_COMUNS', 'PROC_OFF', 'PROC_COMUNS', 'VACINAS', 'CID10', 'CID_COMUNS', 'runCid', 'interpretarGaso', 'conferenciaInteracoes',
    'buildPromptInvestigacao', 'buildPromptInteracoes', 'buildPromptDDx', 'buildPromptProc', 'buildPromptVac', 'buildPromptOrient'];
  function extraiCondutai(html) {
    var linhas = html.split('\n');
    var pedaco = function (inicio) {
      var i = -1; for (var k = 0; k < linhas.length; k++) if (linhas[k].indexOf(inicio) === 0) { i = k; break; }
      if (i < 0) throw new Error('não achei ' + inicio);
      var l0 = linhas[i];
      if (/^(const|function) /.test(l0) && /[};]\s*$/.test(l0) && !/[{\[]\s*$/.test(l0)) return l0;
      var j = i + 1;
      while (j < linhas.length && ['}', '};', '];'].indexOf(linhas[j]) < 0) j++;
      return linhas.slice(i, j + 1).join('\n');
    };
    var iniIIFE = html.indexOf('Calculadoras dos guias ECG / VM');
    var iniS = html.indexOf('<script>', iniIIFE) + 8, fimS = html.indexOf('</script>', iniS);
    var prelude = 'function md(t){return t}\nfunction cvMostra(){}\nfunction cvCopia(){}\n';
    return { extraido: prelude + TRECHOS.map(pedaco).join('\n') + '\n' + html.slice(iniS, fimS), pedaco: pedaco };
  }
  function dadosCondutai(html, pedaco, G) {
    var d = G;
    var secoesMd = function (t) { return JSON.parse(G.MTPonte.secoes(t)); };
    var secao = function (id) { var i = html.indexOf('<section id="' + id + '"'); return html.slice(i, html.indexOf('</section>', i)); };
    var intro = function (id) { return inl(arvore(/class="wb-view-intro">([\s\S]*?)<\/p>/.exec(secao(id))[1])); };
    var aviso = function (id) { var m = /class="alert alert-warn"[\s\S]*?<div>([\s\S]*?)<\/div><\/div>/.exec(secao(id)); return m ? inl(arvore(m[1])) : ''; };
    var campos = function (id) {
      var r = arvore(secao(id)), out = [];
      var anda = function (n) {
        n.filhos.forEach(function (f) {
          if (typeof f === 'string') return;
          if (f.tag === 'label') {
            var ctrl = f.filhos.filter(function (x) { return ehNo(x) && (x.tag === 'input' || x.tag === 'select'); })[0];
            if (ctrl) out.push({ id: ctrl.attrs.id, rotulo: f.filhos.filter(function (x) { return typeof x === 'string'; }).join('').trim(), dica: ctrl.attrs.placeholder || '', opcoes: ctrl.tag === 'select' ? ctrl.filhos.filter(ehNo).map(function (o) { return { v: o.attrs.value, t: textoPuro(o) }; }) : undefined });
          } else anda(f);
        });
      };
      anda(r); return out;
    };
    var serial = function (n) { return n.filhos.map(function (f) { return typeof f === 'string' ? f.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '<' + f.tag + Object.keys(f.attrs).map(function (k) { return ' ' + k + '="' + f.attrs[k].replace(/"/g, '&quot;') + '"'; }).join('') + '>' + serial(f) + (VAZIOS[f.tag] ? '' : '</' + f.tag + '>'); }).join(''); };
    var guia = function (id) {
      var out = [];
      var achar = function (n) {
        n.filhos.forEach(function (f) {
          if (typeof f === 'string') return;
          if (f.tag === 'details') {
            var corpo = f.filhos.filter(function (x) { return ehNo(x) && (x.attrs.class || '').indexOf('wb-acc-body') >= 0; })[0];
            var tit = textoPuro(f.filhos.filter(function (x) { return ehNo(x) && x.tag === 'summary'; })[0]).trim();
            out.push({ titulo: tit, blocos: blocosHTML(serial(corpo)) });
          } else achar(f);
        });
      };
      achar(arvore(secao(id)));
      return out;
    };
    var notasDe = function (nome) { var r = [], m, re = /alert-info[^`]*?<\/span><div>([^<]*)<\/div>/g, t = pedaco('async function ' + nome); while ((m = re.exec(t))) r.push(m[1].trim()); return r; };
    var nota = /<p style="font-size:12px[^>]*>([\s\S]*?)<\/p>/;
    var banco = function (o) { return Object.keys(o).map(function (k) { var e = o[k]; return { chave: k, nome: e.nome, alias: e.alias || [] }; }); };
    void secoesMd;
    return {
      investigacao: { intro: intro('investigacaoView'), dica: 'Ex.: hiponatremia, dispneia, transaminases altas', comuns: d.INV_COMUNS, banco: banco(d.INV_OFF), notas: notasDe('runInv') },
      procedimentos: { intro: intro('proceduresView'), dica: 'Ex.: punção lombar, acesso central, intubação', comuns: d.PROC_COMUNS, banco: banco(d.PROC_OFF), notas: notasDe('runProc') },
      gasometria: { intro: intro('gasoView'), campos: campos('gasoView') },
      ecg: { intro: intro('ecgView'), aviso: aviso('ecgView'), campos: campos('ecgView'), nota: inl(arvore(nota.exec(secao('ecgView'))[1])), guia: guia('ecgView') },
      ventilacao: { intro: intro('vmView'), aviso: aviso('vmView'), campos: campos('vmView'), nota: inl(arvore(nota.exec(secao('vmView'))[1])), guia: guia('vmView') },
      interacoes: { intro: intro('interacoesView'), dica: 'Um por linha. Ex.:\nVarfarina\nAmiodarona\nClaritromicina', dicaObs: 'Ex.: idoso, função renal reduzida, hepatopatia…', notas: notasDe('runInteracoes') },
      ddx: { intro: intro('ddxView'), dica: /id="dd_caso"[^>]*placeholder="([^"]*)"/.exec(html)[1], notas: notasDe('runDDx') },
      orientacoes: { intro: intro('orientacoesView'), dicaTema: /id="or_tema"[^>]*placeholder="([^"]*)"/.exec(html)[1], dicaDetalhes: /id="or_det"[^>]*placeholder="([^"]*)"/.exec(html)[1], notas: notasDe('runOrient') },
      vacinas: { intro: intro('vacinasView'), dica: /id="vacSearch"[^>]*placeholder="([^"]*)"/.exec(html)[1], grupos: Object.keys(d.VACINAS).map(function (id) { return { id: id, l: d.VACINAS[id].l }; }), notas: notasDe('runVacIA') },
      cid: d.CID10, cidComuns: d.CID_COMUNS, cidIntro: intro('cidView')
    };
  }
  /* MotorCondutai do iPhone. */
  function MotorCondutai(G, dados) {
    var P = G.MTPonte;
    P.valor('vm_sexo', 'M');
    /* callGemini() do original usa temperatura 0,4 e até 8192 tokens; vão explícitos ao MT.ai, como no iPhone. */
    var pedido = function (prompt, nivel, grounding, cache) { var o = { grounding: !!grounding, temperature: 0.4, maxTokens: 8192 }; if (cache) o.cache = true; return { prompt: prompt, modelo: nivel, opcoes: o }; };
    return {
      oferta: function (banco, q) { var r = G.findOffline(G[banco], q); return r ? JSON.parse(JSON.stringify(r)) : null; },
      vacina: function (k) { return G.VACINAS[k].md; },
      gaso: function (v) { dados.gasometria.campos.forEach(function (c) { P.valor(c.id, v[c.id] || ''); }); G.interpretarGaso(); return P.html('gasoResult'); },
      calcGuia: function (f, v) {
        var c = f === 'ecg' ? dados.ecg : dados.ventilacao;
        c.campos.forEach(function (x) { P.valor(x.id, v[x.id] != null ? v[x.id] : (x.opcoes && x.opcoes[0] ? x.opcoes[0].v : '')); });
        P.disparar(c.campos[0].id, 'input');
        return P.htmlFilho(f === 'ecg' ? 'ecg_calc_res' : 'vm_calc_res', 'div');
      },
      regras: function (meds) { return String(G.conferenciaInteracoes(meds)); },
      cid: function (q) { G.runCid(q); return P.html('cidResult'); },
      promptInvestigacao: function (q) { return pedido(G.buildPromptInvestigacao(q), 'padrao', false, true); },
      promptProc: function (q) { return pedido(G.buildPromptProc(q), 'padrao', false, true); },
      promptInteracoes: function (m, o) { return pedido(G.buildPromptInteracoes(m, o), 'forte'); },
      promptDdx: function (c) { return pedido(G.buildPromptDDx(c), 'padrao'); },
      promptVac: function (q) { return pedido(G.buildPromptVac(q), 'padrao', true, true); },
      promptOrient: function (t, d) { var p = G.buildPromptOrient(t, d); return d ? pedido(p, 'padrao') : pedido(p, 'padrao', false, true); }
    };
  }

  /* ---------- ÍNDICE PARA A BUSCA (gerarIndice) ---------- */
  function indice(calc, atb, pocus, pali, c) {
    var L = [];
    var add = function (id, f, t, d, k) { L.push([id, f, t, d, norm(t + ' ' + k)]); };
    if (calc) calc.forEach(function (x) { add('calculadoras/' + x.id, 'calculadoras', x.nome, x.grupo, x.desc + ' ' + x.cat); });
    if (atb) {
    atb.focos.forEach(function (x) { add('antibioticos/foco:' + x.id, 'antibioticos', x.nome, 'Foco de infecção', x.tags); });
    atb.guia.forEach(function (x) { add('antibioticos/guia:' + x.id, 'antibioticos', x.nome, x.cat, x.tags + ' ' + x.cat); });
    atb.dirigida.forEach(function (x) { add('antibioticos/germe:' + x.id, 'antibioticos', x.g, 'Germe isolado', 'antibiograma cultura dirigida'); });
    atb.drogas.forEach(function (x) { add('antibioticos/droga:' + x.id, 'antibioticos', x.nome, x.classe.split('·')[0].trim(), x.classe + ' ' + x.grupo); });
    add('antibioticos/cobertura', 'antibioticos', 'Cobertura e espectro', 'Antibióticos', 'espectro cobertura mrsa pseudomonas esbl anaerobios atipicos');
    add('antibioticos/dose', 'antibioticos', 'Corrigir dose de antibiótico', 'Antibióticos', 'dose peso ajuste renal clearance tfg ckd-epi correcao correção');
    add('antibioticos/empirico', 'antibioticos', 'Empírico e escalonamento', 'Antibióticos', 'esquema empirico escalonamento escalonar');
    add('antibioticos/dirigida', 'antibioticos', 'Terapia dirigida', 'Antibióticos', 'antibiograma germe cultura dirigida descalonamento');
    add('antibioticos/pediatria', 'antibioticos', 'Doses pediátricas de antibióticos', 'Antibióticos', 'pediatria crianca dose pediatrica');
    add('antibioticos/assistente', 'antibioticos', 'Assistente de antibióticos', 'Antibióticos', 'ia pergunta assistente');
    add('antibioticos/ivvo', 'antibioticos', 'Troca de IV para VO', 'Antibióticos', 'iv vo via oral troca biodisponibilidade');
    }
    add('pocus/assistente', 'pocus', 'Assistente POCUS', 'POCUS', 'ia pergunta assistente ultrassom');
    if (pocus) pocus.forEach(function (x) { add('pocus/' + x.id, 'pocus', x.nome, 'POCUS, ' + x.cat, x.tags + ' ' + x.cat); });
    add('paliativos/triagem', 'paliativos', 'Triagem de cuidados paliativos', 'Paliativos', 'pergunta surpresa pps ecog spict necpal');
    if (pali) pali.temas.forEach(function (x) { add('paliativos/tema:' + x.id, 'paliativos', x.titulo, x.grupo, x.sub + ' ' + x.grupo); });
    if (c) c.investigacao.banco.forEach(function (x) { add('investigacao/' + x.nome, 'investigacao', x.nome, 'Investigação', x.alias.join(' ')); });
    add('investigacao', 'investigacao', 'Investigação', 'Roteiro por sintoma, sinal ou exame', 'investigar achado sintoma exame alterado');
    if (c) c.procedimentos.banco.forEach(function (x) { add('procedimentos/' + x.nome, 'procedimentos', x.nome, 'Procedimentos', x.alias.join(' ')); });
    add('procedimentos', 'procedimentos', 'Procedimentos', 'Técnica passo a passo', 'procedimento puncao acesso intubacao');
    add('gasometria', 'gasometria', 'Gasometria', 'Interpretação sem IA', 'gasometria gaso acido base anion gap delta');
    add('ecg', 'ecg', 'ECG', 'Leitura, FC e QTc', 'ecg eletrocardiograma qtc');
    add('ventilacao', 'ventilacao', 'Ventilação mecânica', 'Peso predito, VC e P/F', 'ventilacao mecanica vm ventilador peep sdra desmame');
    add('interacoes', 'interacoes', 'Interações medicamentosas', 'Regra e IA', 'interacao interacoes medicamentosa');
    add('ddx', 'ddx', 'Diagnóstico diferencial', 'Por IA', 'diferencial ddx hipoteses');
    add('orientacoes', 'orientacoes', 'Orientações ao paciente', 'Por IA', 'orientacao orientacoes paciente');
    if (c) c.vacinas.grupos.forEach(function (x) { add('vacinas/' + x.id, 'vacinas', 'Vacinação: ' + x.l, 'PNI / SBIm', 'vacina vacinas calendario'); });
    if (c) c.cid.forEach(function (x) { add('cid/' + x.c, 'cid', x.c + ' ' + x.d, 'CID-10', ''); });
    add('sessoes', 'sessoes', 'Acompanhar paciente', 'Próximo passo pelos parâmetros atuais', 'sessao acompanhar cetoacidose cad');
    add('sessoes/cad', 'sessoes', 'Acompanhar cetoacidose', 'Acompanhar paciente', 'cetoacidose cad diabetica insulina potassio');
    return L;
  }
  /* BuscaFerramentas.buscar do iPhone: todas as palavras precisam aparecer; o título pesa mais. */
  function buscar(L, normalizada, ferramenta, limite) {
    var palavras = String(normalizada).split(' ').filter(Boolean);
    if (!palavras.length) return [];
    var achados = [];
    L.forEach(function (l, ordem) {
      if (ferramenta && l[1] !== ferramenta) return;
      var titulo = norm(l[2]), chave = l[4], nota = 0, ok = true;
      for (var i = 0; i < palavras.length; i++) {
        var p = palavras[i];
        if (titulo.indexOf(p) === 0) nota += 4;
        else if (titulo.indexOf(' ' + p) >= 0) nota += 3;
        else if (titulo.indexOf(p) >= 0) nota += 2;
        else if (chave.indexOf(p) >= 0) nota += 0;
        else { ok = false; break; }
      }
      if (ok) achados.push([nota, ordem, { id: l[0], ferramenta: l[1], titulo: l[2], detalhe: l[3] }]);
    });
    achados.sort(function (a, b) { return a[0] !== b[0] ? b[0] - a[0] : a[1] - b[1]; });
    return achados.slice(0, limite || 30).map(function (a) { return a[2]; });
  }

  /* ---------- carregamento: os arquivos do site, nas versões que o CondutAI usa ---------- */
  function criar(ler) {
    var memo = {};
    var uma = function (k, f) { return memo[k] || (memo[k] = f().catch(function (e) { delete memo[k]; throw e; })); };
    var html = function () { return uma('html', function () { return ler('condutai.html'); }); };
    var versao = function (texto, arq) { var m = new RegExp('(' + arq.replace(/[.]/g, '\\.') + '\\?v=\\d+)').exec(texto); return m ? m[1] : arq; };
    var areas = function () { return uma('areas', function () { return html().then(function (h) { return ler(versao(h, 'condutai-areas.js')); }); }); };
    var daArea = function (arq) { return areas().then(function (a) { return ler(versao(a, arq)); }); };
    var M = {
      arquivos: {},
      calc: function () {
        return uma('calc', function () {
          return daArea('condutai-calc.js').then(function (fonte) {
            var G = contexto(false);
            executar(G, fonte);
            var motor = MotorCalc(G);
            return { dados: dadosCalc(G.CVCalc.CALCS), motor: motor, estado: function (def) { return EstadoCalc(motor, def); } };
          });
        });
      },
      atb: function () {
        return uma('atb', function () {
          return daArea('condutai-atb.js').then(function (fonte) {
            var Gd = contexto(true);
            executar(Gd, fonte);
            var dados = dadosATB(fonte, Gd);
            var Gm = contexto(true);
            executar(Gm, fonte);
            return { dados: dados, motor: MotorATB(Gm) };
          });
        });
      },
      pocus: function () {
        return uma('pocus', function () {
          return daArea('condutai-pocus.js').then(function (fonte) {
            var dados = dadosPocus(fonte);
            var Gm = contexto(true);
            executar(Gm, fonte);
            return { dados: dados, motor: MotorPocus(Gm) };
          });
        });
      },
      pali: function () {
        return uma('pali', function () {
          return ler('paliai.html').then(function (h) {
            return ler(versao(h, 'pali-conteudo.js')).then(function (conteudo) {
              var G = contexto(false);
              var dados = dadosPali(h, conteudo, G);
              return { dados: dados, motor: MotorPali(G) };
            });
          });
        });
      },
      condutai: function () {
        return uma('condutai', function () {
          return html().then(function (h) {
            return ler(versao(h, 'condutai-seguranca.js')).then(function (seg) {
              var x = extraiCondutai(h);
              var G = contexto(true);
              executar(G, seg);
              executar(G, x.extraido, NOMES_CONDUTAI);
              var dados = dadosCondutai(h, x.pedaco, G);
              return { dados: dados, motor: MotorCondutai(G, dados), extraido: x.extraido };
            });
          });
        });
      },
      indice: function () {
        return uma('indice', function () {
          return Promise.all([M.calc(), M.atb(), M.pocus(), M.pali(), M.condutai()]).then(function (r) {
            return indice(r[0].dados.calculadoras, r[1].dados, r[2].dados.exames, r[3].dados, r[4].dados);
          });
        });
      },
      /* só os itens de uma ferramenta, carregando só o que ela precisa (busca interna de Antibióticos e POCUS) */
      indiceDe: function (f) {
        var so = function (L) { return L.filter(function (l) { return l[1] === f; }); };
        if (f === 'antibioticos') return M.atb().then(function (a) { return so(indice(null, a.dados, null, null, null)); });
        if (f === 'pocus') return M.pocus().then(function (p) { return so(indice(null, null, p.dados.exames, null, null)); });
        return M.indice().then(so);
      },
      md: (function () { var G = null; return function (t) { G = G || contexto(false); return JSON.parse(G.MTPonte.secoes(t)); }; })(),
      versao: versao
    };
    return M;
  }

  var API = {
    criar: criar, buscar: buscar, norm: norm, semMarcas: semMarcas, deHTML: deHTML, faixaAtiva: faixaAtiva, faixaCalc: faixaCalc, faixaPali: faixaPali,
    textoCopiarCalc: textoCopiarCalc, dadosEmpiricoNovo: dadosEmpiricoNovo, executar: executar, contexto: contexto
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else raiz.MTFerMotor = API;
})(typeof window !== 'undefined' ? window : globalThis);
