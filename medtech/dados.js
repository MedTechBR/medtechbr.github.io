/* MedTech PWA: camada de dados.
   Tudo sai dos arquivos do próprio site, que também são a fonte do app de iPhone
   (veja medtech-ios/tools/consultar_gera_dados.mjs): nada de cópia do banco aqui.
   - condutai.html: catálogo (SPECIALTIES, PROTOCOLS), critérios, bulas, protocolAliases e sanitizeMermaid,
     recortados do próprio HTML com a mesma regra do gerador do iPhone;
   - condutai-banco.js (OFFLINE), condutai-prescricoes.js (PRESC_MODELOS), condutai-seguranca.js (CVSeg),
     condutai-didatica.js (CVD.parseFluxo) e condutai-ligacoes.js (CVL._bulaDe), carregados como estão;
   - medtech/didatica/<id>.json: a camada didática gerada pelo app de iPhone (tools/consultar_didatica_fonte.py).
   Expõe window.MTDados. */
(function () {
  'use strict';
  var W = window, D = document;
  var SITE = '../';

  /* Mesmo critério do app de iPhone: o nome aparece sem travessão na interface. */
  function nomeTela(n) { return String(n || '').replace(/\s+—\s+/g, ': '); }
  function normal(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function palavras(n) { return n.split(/[^\p{L}\p{N}]+/u).filter(Boolean); }

  /* Cada arquivo carrega uma vez; se a rede falhar, a próxima tentativa refaz só o que faltou. */
  var scripts = {};
  function carregaScript(src) {
    if (scripts[src]) return scripts[src];
    scripts[src] = new Promise(function (ok, falha) {
      var s = D.createElement('script');
      s.src = src; s.async = false;
      s.onload = function () { ok(); };
      s.onerror = function () { s.remove(); delete scripts[src]; falha(new Error('não carregou ' + src)); };
      D.head.appendChild(s);
    });
    return scripts[src];
  }

  /* ---------- recortes de condutai.html (regras de consultar_gera_dados.mjs) ---------- */
  function constDoHtml(html, nome) {
    var marca = 'const ' + nome + ' = ';
    var ini = html.indexOf(marca);
    if (ini < 0) throw new Error('não achei ' + nome + ' em condutai.html');
    var corpo = ini + marca.length;
    var fim = html.slice(corpo).search(/^[}\]];?[ \t]*$/m);
    if (fim < 0) throw new Error('não achei o fim de ' + nome);
    return new Function('return (' + html.slice(corpo, corpo + fim + 1) + ');')();
  }
  function funcaoDoHtml(html, nome) {
    var ini = html.indexOf('function ' + nome + '(');
    if (ini < 0) throw new Error('não achei ' + nome + ' em condutai.html');
    var fimLinha = html.indexOf('\n', ini);
    if (html.slice(ini, fimLinha).trimEnd().endsWith('}')) return html.slice(ini, fimLinha + 1);
    return html.slice(ini, html.indexOf('\n}\n', ini) + 2);
  }
  function trechoDoHtml(html, ini, fim) {
    var a = html.indexOf(ini), b = html.indexOf(fim, a);
    if (a < 0 || b < 0) throw new Error('não achei ' + ini + ' em condutai.html');
    return html.slice(a, b);
  }

  var M = {
    pronto: null,          // promessa do índice (catálogo)
    bancoPronto: null,     // promessa do texto das condutas e das prescrições
    areas: {},             // id -> rótulo
    condutas: [],          // {id, nome, tags, area, diretriz, relacionados}
    porId: {},
    bulas: [],             // {id, nome, alias, md}
    versoes: {},           // arquivo -> url com ?v= igual ao condutai.html
    ordemAreas: ['emergencia', 'cardio', 'infecto', 'pneumo', 'endocrino', 'neuro', 'gastro', 'nefro', 'hemato', 'reumato', 'gineco', 'psiq', 'derm', 'uro', 'olho_orl', 'geriatria', 'onco_pal', 'raras'],
    normal: normal,
    nomeTela: nomeTela
  };
  var CRITERIOS = {}, CRIT_MAP = {}, BULAS_OFF = {}, criteriosFor = null, protocolAliases = null;

  /* As versões (?v=) dos JS do banco são as que o condutai.html usa: o cache fica alinhado com o CondutAI. */
  function versoes(html) {
    var v = {};
    ['condutai-banco.js', 'condutai-prescricoes.js', 'condutai-seguranca.js', 'condutai-didatica.js', 'condutai-ligacoes.js'].forEach(function (f) {
      var m = new RegExp('src="(' + f.replace(/[.]/g, '\\.') + '[^"]*)"').exec(html);
      v[f] = SITE + (m ? m[1] : f);
    });
    var mm = /src="(vendor\/mermaid-[^"]+\/mermaid\.min\.js)"/.exec(html);
    v.mermaid = SITE + (mm ? mm[1] : 'vendor/mermaid-11.17.2/mermaid.min.js');
    return v;
  }

  M.pronto = fetch(SITE + 'condutai.html', { cache: 'no-cache' }).then(function (r) {
    if (!r.ok) throw new Error('condutai.html ' + r.status);
    return r.text();
  }).then(function (html) {
    var SPECIALTIES = constDoHtml(html, 'SPECIALTIES');
    var PROTOCOLS = constDoHtml(html, 'PROTOCOLS');
    CRITERIOS = constDoHtml(html, 'CRITERIOS');
    CRIT_MAP = constDoHtml(html, 'CRIT_MAP');
    BULAS_OFF = constDoHtml(html, 'BULAS_OFF');
    criteriosFor = new Function('CRITERIOS', 'CRIT_MAP', funcaoDoHtml(html, 'criteriosFor') + '\nreturn criteriosFor;')(CRITERIOS, CRIT_MAP);
    protocolAliases = new Function(trechoDoHtml(html, 'const GENERIC_ALIAS_BLOCK', 'function linkifyRelated') + '\nreturn protocolAliases;')();
    M.sanitizeMermaid = new Function(funcaoDoHtml(html, 'sanitizeMermaid') + '\nreturn sanitizeMermaid;')();
    M.versoes = versoes(html);
    W.BULAS_OFF = BULAS_OFF;   // condutai-ligacoes.js lê o nome global, como no CondutAI

    Object.keys(SPECIALTIES).forEach(function (k) { M.areas[k] = SPECIALTIES[k].label; });
    M.condutas = PROTOCOLS.map(function (p) {
      return {
        id: p.id, nome: nomeTela(p.name), nomeOriginal: p.name, tags: p.tags || '', area: p.specialty, diretriz: p.guideline || '',
        /* relacionadas: a regra do site (buildRelated), mesma especialidade na ordem do catálogo, até 5 */
        relacionados: PROTOCOLS.filter(function (x) { return x.specialty === p.specialty && x.id !== p.id; }).slice(0, 5).map(function (x) { return x.id; }),
        aliases: protocolAliases(p)
      };
    });
    M.condutas.forEach(function (c) { M.porId[c.id] = c; });
    M.bulas = Object.keys(BULAS_OFF).map(function (k) { return { id: k, nome: BULAS_OFF[k].nome, alias: BULAS_OFF[k].alias || [], md: BULAS_OFF[k].md }; });
    preparaChaves();
    preparaAliases();
    return M;
  });

  /* O texto das 274 condutas (6 MB) vem logo depois, em segundo plano: a tela inicial não espera. */
  M.carregaBanco = function () {
    if (M.bancoPronto) return M.bancoPronto;
    M.bancoPronto = M.pronto.then(function () {
      var v = M.versoes;
      return Promise.all([
        carregaScript(v['condutai-banco.js']),
        carregaScript(v['condutai-prescricoes.js']),
        carregaScript(v['condutai-seguranca.js']),
        carregaScript(v['condutai-didatica.js']),
        carregaScript(v['condutai-ligacoes.js'])
      ]);
    }).then(function () {
      if (!W.OFFLINE) throw new Error('banco de condutas indisponível');
      return M;
    });
    M.bancoPronto.catch(function () { M.bancoPronto = null; });
    return M.bancoPronto;
  };

  M.conduta = function (id) { return M.porId[id] || null; };
  M.daArea = function (a) { return M.condutas.filter(function (c) { return c.area === a; }); };
  M.areasOrdenadas = function () { return M.ordemAreas.filter(function (a) { return M.areas[a]; }); };
  /* Mesma montagem de showOfflineProtocol: OFFLINE + critérios diagnósticos. */
  M.markdown = function (id) { return W.OFFLINE && W.OFFLINE[id] ? W.OFFLINE[id] + criteriosFor(id) : ''; };
  M.modelo = function (id) { return W.PRESC_MODELOS ? W.PRESC_MODELOS[id] || null : null; };
  M.temModelo = function (id) { return !!M.modelo(id); };
  M.bula = function (id) { return M.bulas.filter(function (b) { return b.id === id; })[0] || null; };
  /* Regra de condutai-ligacoes.js: nome ou alias como palavra inteira, o mais longo primeiro. */
  M.bulaPara = function (texto) {
    if (!W.CVL || !W.CVL._bulaDe) return null;
    var b = W.CVL._bulaDe(texto);
    return b ? M.bula(b.k) : null;
  };

  /* Só as doenças listadas em didatica/indice.json têm camada didática; as outras abrem igual, sem ela. */
  var cacheDid = {}, indiceDid = null;
  M.didatica = function (id) {
    if (id in cacheDid) return cacheDid[id];
    if (!indiceDid) indiceDid = fetch('didatica/indice.json').then(function (r) { return r.ok ? r.json() : { ids: [] }; }).then(function (j) { return j.ids || []; }).catch(function () { indiceDid = null; return []; });
    cacheDid[id] = indiceDid.then(function (ids) {
      if (ids.indexOf(id) < 0) return null;
      return fetch('didatica/' + encodeURIComponent(id) + '.json').then(function (r) { return r.ok ? r.json() : null; });
    }).catch(function () { delete cacheDid[id]; return null; });
    return cacheDid[id];
  };

  /* ---------- ligações entre condutas: aliases de protocolAliases, regra de linkifyRelated ---------- */
  function preparaAliases() {
    var cand = [];
    M.condutas.forEach(function (c) { c.aliases.forEach(function (a) { cand.push({ alias: a, id: c.id }); }); });
    cand.sort(function (a, b) { return b.alias.length - a.alias.length; });
    var vistos = {}, unicos = [];
    cand.forEach(function (c) { var k = c.alias.toLowerCase(); if (vistos[k]) return; vistos[k] = c.id; unicos.push(c); });
    var esc = function (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
    M.ligacoes = { porApelido: vistos, fonte: '\\b(' + unicos.map(function (c) { return esc(c.alias); }).join('|') + ')\\b' };
  }

  /* ---------- busca (mesma pontuação do app de iPhone) ---------- */
  var chaves = [], chavesBula = [];
  function preparaChaves() {
    chaves = M.condutas.map(function (c) { var n = normal(c.nome); return { c: c, nome: n, pal: palavras(n), tags: normal(c.tags) }; });
    chavesBula = M.bulas.map(function (b) { return { b: b, termos: [b.nome].concat(b.alias).map(normal) }; });
  }

  function distancia(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 99;
    var ant = [], i, j;
    for (j = 0; j <= b.length; j++) ant[j] = j;
    for (i = 1; i <= a.length; i++) {
      var at = [i];
      for (j = 1; j <= b.length; j++) at[j] = Math.min(ant[j] + 1, at[j - 1] + 1, ant[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      ant = at;
    }
    return ant[b.length];
  }

  /* Índice de menções, como consultar_termos.txt do iPhone: título vale mais que negrito, negrito mais que texto. */
  var termos = null, termosChaves = null;
  var PARADAS = new Set('para pela pelo pelos pelas como mais menos entre sobre quando onde qual quais cada toda todo todos todas esta este estes estas essa esse esses essas isso aquilo muito muita muitos muitas pode podem deve devem sendo sido seja sao tem tendo foram mesmo mesma ainda apos antes depois durante sempre nunca tambem porque porem nao sim uma umas uns dos das nos nas aos com sem por que dia dias hora horas'.split(' '));
  M.preparaTermos = function () {
    if (termos || !W.OFFLINE) return;
    var peso = new Map();
    M.condutas.forEach(function (c, ip) {
      var md = M.markdown(c.id);
      var soma = function (t, p) {
        var re = /[\p{L}][\p{L}\p{N}-]{2,}/gu, m;
        while ((m = re.exec(t))) {
          var cru = m[0], k = normal(cru).replace(/-+$/, '');
          var sigla = cru.length <= 3 && cru === cru.toUpperCase();
          if ((k.length < 4 && !sigla) || PARADAS.has(k)) continue;
          var mapa = peso.get(k); if (!mapa) { mapa = new Map(); peso.set(k, mapa); }
          mapa.set(ip, (mapa.get(ip) || 0) + p);
        }
      };
      soma(c.nomeOriginal + ' ' + c.tags, 12);
      md.split('\n').forEach(function (l) {
        if (l.indexOf('## ') === 0) { soma(l, 6); return; }
        var re = /\*\*(.+?)\*\*/g, n;
        while ((n = re.exec(l))) soma(n[1], 2);
        soma(l, 1);
      });
    });
    termos = new Map();
    peso.forEach(function (mapa, k) {
      if (mapa.size > 230) return;
      termos.set(k, Array.from(mapa.entries()).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 12).map(function (x) { return x[0]; }));
    });
    termosChaves = Array.from(termos.keys()).sort();
  };

  function mencoes(pals, fora) {
    if (!termos) return [];
    var ordem = null;
    pals.filter(function (p) { return p.length >= 3; }).forEach(function (p) {
      var ini = 0, fim = termosChaves.length;
      while (ini < fim) { var meio = (ini + fim) >> 1; if (termosChaves[meio] < p) ini = meio + 1; else fim = meio; }
      var daqui = new Map(), variantes = 0;
      for (var i = ini; i < termosChaves.length && termosChaves[i].indexOf(p) === 0 && variantes < 12; i++, variantes++) {
        var atraso = termosChaves[i] === p ? 0 : 6;
        termos.get(termosChaves[i]).forEach(function (c, pos) { daqui.set(c, Math.min(daqui.has(c) ? daqui.get(c) : 99, pos + atraso)); });
      }
      if (!ordem) ordem = daqui;
      else {
        var nova = new Map();
        ordem.forEach(function (v, k) { if (daqui.has(k)) nova.set(k, v + daqui.get(k)); });
        ordem = nova;
      }
    });
    if (!ordem) return [];
    return Array.from(ordem.entries()).sort(function (a, b) { return a[1] !== b[1] ? a[1] - b[1] : a[0] - b[0]; })
      .map(function (x) { return M.condutas[x[0]]; }).filter(function (c) { return c && !fora.has(c.id); });
  }

  /* Todas as palavras precisam aparecer: nome pesa mais que tag, início de palavra mais que meio. */
  M.buscar = function (consulta) {
    var ts = palavras(normal(consulta));
    var r = { condutas: [], bulas: [], mencoes: [], aproximados: [] };
    if (!ts.length) return r;
    var achados = [];
    chaves.forEach(function (k) {
      var total = 0;
      for (var i = 0; i < ts.length; i++) {
        var t = ts[i], p = 0;
        if (k.nome.indexOf(t) === 0) p = 100;
        else if (k.pal.indexOf(t) >= 0) p = 90;
        else if (k.pal.some(function (w) { return w.indexOf(t) === 0; })) p = 75;
        else if (t.length >= 3 && k.nome.indexOf(t) >= 0) p = 55;
        else if (k.tags.indexOf(t) >= 0) p = t.length >= 3 ? 35 : 0;
        if (!p) return;
        total += p;
      }
      achados.push([k.c, total]);
    });
    achados.sort(function (a, b) { return a[1] !== b[1] ? b[1] - a[1] : a[0].nome.length - b[0].nome.length; });
    r.condutas = achados.map(function (x) { return x[0]; });
    var junto = ts.join(' ');
    r.bulas = chavesBula.filter(function (b) { return b.termos.some(function (t) { return t.indexOf(junto) === 0 || t.indexOf(' ' + junto) >= 0; }); }).map(function (b) { return b.b; });
    r.mencoes = mencoes(ts, new Set(r.condutas.map(function (c) { return c.id; }))).slice(0, 8);
    if (!r.condutas.length && !r.bulas.length && !r.mencoes.length) {
      var longos = ts.filter(function (t) { return t.length >= 4; });
      if (longos.length) {
        var perto = [];
        chaves.forEach(function (k) {
          var soma = 0;
          for (var i = 0; i < longos.length; i++) {
            var t = longos[i], lim = t.length >= 8 ? 2 : 1;
            var d = Math.min.apply(null, k.pal.map(function (w) { return distancia(t, w.slice(0, t.length + 1)); }).concat([99]));
            if (d > lim) return;
            soma += d;
          }
          perto.push([k.c, soma]);
        });
        r.aproximados = perto.sort(function (a, b) { return a[1] - b[1]; }).slice(0, 6).map(function (x) { return x[0]; });
      }
    }
    return r;
  };

  W.MTDados = M;
})();
