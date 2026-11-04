/* MedTech PWA: a ponte do app de iPhone (medtech-ios/MedTech/Ferramentas/Dados/ferramentas_ponte.js), copiada sem mudança
   entre as marcas abaixo. Cada chamada de MTFerPonte() cria um "global" novo e isolado, como um JSContext do iPhone:
   o JS clínico original roda dentro dele (fer-motor.js) e nunca encosta no DOM real da página.
   A prova de que o trecho é idêntico ao do iPhone está no teste de paridade (scratchpad/paridade). */
(function (raiz) {
  /* sem 'use strict': a ponte roda como script comum, igual ao JavaScriptCore */
  function MTFerPonte() {
    var G = {};
    var MTPonte;   // a ponte chama MTPonte pelo nome global
    (function () {
/* ===== INÍCIO DA PONTE DO IPHONE ===== */
/* DOM mínimo para rodar o JS clínico original fora do navegador, sem alterar nenhuma linha dele.
   Vale para JavaScriptCore no app e para o node no gerador. */
var window = this; var self = this; var globalThis_ = this;
(function (glob) {
  var els = {}, permissivo = false, marcados = {}, textosMarcados = {}, iaPendente = null;
  function decod(s) { return String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&'); }
  function lista() { return { add: function () {}, remove: function () {}, toggle: function () { return false; }, contains: function () { return false; } }; }
  function El(id, tag) {
    this.id = id || ''; this.tagName = String(tag || 'DIV').toUpperCase(); this._h = ''; this._v = ''; this.checked = false;
    this.options = []; this.style = { setProperty: function () {} }; this.classList = lista(); this.dataset = {}; this.children = [];
    this.hidden = false; this.disabled = false; this.textContent = ''; this._ouvintes = {}; this._filhos = {};
  }
  Object.defineProperty(El.prototype, 'value', {
    get: function () { return this._v; },
    set: function (v) {
      v = (v === null || v === undefined) ? '' : String(v);
      if (this.tagName === 'SELECT') { var ok = this.options.some(function (o) { return o.value === v; }); this._v = ok ? v : ''; }
      else this._v = v;
    }
  });
  Object.defineProperty(El.prototype, 'innerHTML', {
    get: function () { return this._h; },
    set: function (v) {
      this._h = String(v);
      if (this.tagName === 'SELECT') {
        var o = [], m, re = /<option value="([^"]*)"[^>]*>([\s\S]*?)<\/option>/g;
        while ((m = re.exec(this._h))) o.push({ value: m[1], text: decod(m[2]) });
        this.options = o; this._v = o.length ? o[0].value : '';
      }
    }
  });
  Object.defineProperty(El.prototype, 'selectedOptions', {
    get: function () { var v = this._v; return this.options.filter(function (o) { return o.value === v; }); }
  });
  El.prototype.addEventListener = function (t, f) { (this._ouvintes[t] = this._ouvintes[t] || []).push(f); };
  El.prototype.removeEventListener = function () {};
  El.prototype.appendChild = function (c) { return c; };
  El.prototype.remove = function () {};
  El.prototype.setAttribute = function () {};
  El.prototype.getAttribute = function () { return null; };
  El.prototype.querySelector = function (s) { return this._filhos[s] || (this._filhos[s] = new El()); };
  El.prototype.querySelectorAll = function () { return []; };
  El.prototype.closest = function () { return null; };
  El.prototype.focus = function () {};
  El.prototype.blur = function () {};
  El.prototype.select = function () {};
  El.prototype.scrollIntoView = function () {};
  El.prototype.getBoundingClientRect = function () { return { top: 0, left: 0, width: 0, height: 0 }; };

  glob.document = {
    getElementById: function (id) { if (els[id]) return els[id]; if (permissivo) { els[id] = new El(id); return els[id]; } return null; },
    createElement: function (t) { return new El('', t); },
    addEventListener: function () {},
    querySelector: function () { return permissivo ? new El() : null; },
    querySelectorAll: function (s) { var m = /^#(\w+) input:checked$/.exec(s); if (m) { var n = marcados[m[1]] || 0, a = [], tx = textosMarcados[m[1]] || []; for (var i = 0; i < n; i++) { var e = new El(); e.parentElement = { innerText: tx[i] || '' }; a.push(e); } return a; } return []; },
    body: new El('body'), documentElement: new El('html'), activeElement: null
  };
  glob.addEventListener = function () {};
  /* A IA do original passa por aqui: o prompt é montado pelo código original e entregue ao app, que chama o Motor. */
  glob.MT = { user: {}, mode: 'app', ai: function (prompt, model, opts) { return new Promise(function (res, rej) { iaPendente = { prompt: prompt, model: model, opts: opts || {}, res: res, rej: rej }; }); } };
  glob.matchMedia = function () { return { matches: false }; };
  glob.MutationObserver = function () { this.observe = function () {}; this.disconnect = function () {}; };
  glob.history = { state: null, back: function () {}, pushState: function () {}, replaceState: function () {} };
  glob.location = { href: '', hash: '' };
  glob.navigator = {};
  glob.isSecureContext = false;
  glob.scrollTo = function () {};
  if (!glob.setTimeout) { glob.setTimeout = function () { return 0; }; glob.clearTimeout = function () {}; }

  glob.MTPonte = {
    permissivo: function (b) { permissivo = !!b; },
    registrar: function (id, tag) { els[id] = new El(id, tag); return els[id]; },
    limpar: function () { els = {}; marcados = {}; },
    el: function (id) { return els[id] || null; },
    marcados: function (caixa, n) { marcados[caixa] = n; },

    capturarIA: function (f) {
      iaPendente = null;
      f();
      return iaPendente ? JSON.stringify({ prompt: iaPendente.prompt, modelo: iaPendente.model, opcoes: iaPendente.opts }) : 'null';
    },
    responderIA: function (t) { if (iaPendente) { var r = iaPendente.res; iaPendente = null; r(t); } },
    falharIA: function (m) { if (iaPendente) { var r = iaPendente.rej; iaPendente = null; r(new Error(m)); } },
    disparar: function (id, tipo) { var e = els[id]; if (!e) return; (e._ouvintes[tipo || 'input'] || []).forEach(function (f) { f(); }); },
    valor: function (id, v) { var e = glob.document.getElementById(id); if (e) e.value = v; },
    html: function (id) { var e = glob.document.getElementById(id); return e ? e.innerHTML : ''; },
    htmlFilho: function (id, s) { var e = glob.document.getElementById(id); return e ? e.querySelector(s).innerHTML : ''; },
    textosMarcados: function (caixa, jsonLista) { textosMarcados[caixa] = JSON.parse(jsonLista); },
    secoes: function (t) { return JSON.stringify(MTPonte.mdSecoes(t)); },

    /* Calculadoras: cada campo da especificação vira um elemento com o mesmo id do html() original. */
    montar: function (camposJSON) {
      els = {};
      JSON.parse(camposJSON).forEach(function (c) {
        var e = new El(c.id, c.tipo === 'escolha' ? 'SELECT' : 'INPUT');
        if (c.tipo === 'escolha') { e.options = (c.opcoes || []).map(function (o) { return { value: o.v, text: o.t }; }); e._v = e.options.length ? e.options[0].value : ''; }
        if (c.inicial !== undefined && c.inicial !== null) e.value = c.inicial;
        els[c.id] = e;
      });
    },
    definir: function (id, v) { if (els[id]) els[id].value = v; },
    marcar: function (id, b) { if (els[id]) els[id].checked = !!b; },
    acionar: function (nome) { if (glob.CVCalc && glob.CVCalc[nome]) glob.CVCalc[nome](); },
    estado: function () {
      var r = {};
      Object.keys(els).forEach(function (id) { var e = els[id]; r[id] = { v: e.value, c: e.checked, o: e.options.map(function (o) { return { v: o.value, t: o.text }; }) }; });
      return JSON.stringify(r);
    },
    calcular: function (id) {
      var c = glob.CVCalc.CALCS.filter(function (x) { return x.id === id; })[0], r = null;
      try { r = c.calc(); } catch (e) { r = null; }
      if (!r) return 'null';
      return JSON.stringify({ val: String(r.val), unit: String(r.unit), interp: String(r.interp === null || r.interp === undefined ? '' : r.interp), badge: String(r.badge || '') });
    },

    /* Antibióticos: os mesmos ids da tela original; quem calcula é o CVATB, sem mudança. */
    prepararATB: function () {
      els = {};
      ['dPeso', 'dClcr', 'rIdade', 'rCr', 'doseClcr', 'dosePeso', 'doseAtb'].forEach(function (i) { els[i] = new El(i, 'INPUT'); });
      ['dOut', 'rOut', 'doseOut'].forEach(function (i) { els[i] = new El(i, 'DIV'); });
    },
    doseATB: function (id, peso, clcr) {
      els.dPeso.value = peso; els.dClcr.value = clcr; els.dOut.innerHTML = '';
      glob.CVATB.calcDose(id);
      return els.dOut.innerHTML;
    },
    doseToolATB: function (id, peso, clcr) {
      els.doseAtb.value = id; els.dosePeso.value = peso; els.doseClcr.value = clcr; els.doseOut.innerHTML = '';
      glob.CVATB.calcDoseTool();
      return els.doseOut.innerHTML;
    },
    tfgATB: function (idade, cr, sexo) {
      els.rIdade.value = idade; els.rCr.value = cr; els.rOut.innerHTML = ''; els.doseClcr.value = '';
      glob.CVATB.setSexo(sexo); glob.CVATB.calcClcrFill();
      return JSON.stringify({ tfg: els.doseClcr.value, html: els.rOut.innerHTML });
    },

    /* Paliativos: roda compute() do PaliAI e devolve o que ele escreveu no resultado. */
    prepararPali: function (ppsJSON) {
      permissivo = true; els = {}; marcados = {};
      var p = new El('pps', 'SELECT');
      p.options = JSON.parse(ppsJSON).map(function (o) { return { value: o.v, text: o.t }; });
      els.pps = p;
      els.doenca = new El('doenca', 'SELECT');
    },
    triagem: function (sq, pps, nG, doenca, nE) {
      els.pps.value = pps;
      els.doenca.value = doenca;
      marcados.gerais = nG; marcados.espec = nE;
      glob.setSQ(sq);
      return MTPonte.lerResultado();
    },
    /* Markdown dos bancos e das respostas da IA, com as regras de md()/inlMd() do original; também serve ao gerador. */
    mdSecoes: function (t) {
      var B = '\u0001', b = '\u0002', I = '\u0003', i = '\u0004';
      function limpa(s) { return s.replace(/[ \t]*\n[ \t]*/g, '\n').replace(/ {2,}/g, ' ').trim(); }
      /* "***E. faecalis*:**" (negrito com itálico dentro) sai com asteriscos soltos no original: aqui vira negrito e itálico, sem mudar o texto. */
      function inl(s) {
        return limpa(String(s).replace(/\*\*\*([^*]+)\*([^*]*)\*\*/g, B + I + '$1' + i + '$2' + b).replace(/\*\*([^*]+)\*\*/g, B + '$1' + b).replace(/\*([^*]+)\*/g, I + '$1' + i));
      }
      function semEmoji(s) { return s.replace(/\p{Emoji_Presentation}\uFE0F?\s*/gu, ''); }
      /* Fluxograma mermaid vira lista de passos: sem página web, o texto dos nós e das setas é preservado. */
      function mermaid(linhas) {
        var nomes = {}, saida = [];
        var no = /([A-Za-z0-9_]+)\s*(?:\[\[?|\(\(?|\{\{?)\s*"?([^\]\)\}"]+)"?\s*(?:\]\]?|\)\)?|\}\}?)/g, m;
        linhas.forEach(function (l) { var r; no.lastIndex = 0; while ((r = no.exec(l))) nomes[r[1]] = r[2].trim(); });
        linhas.forEach(function (l) {
          var limpo = l.replace(no, '$1').trim();
          var e = /^([A-Za-z0-9_]+)\s*-+\.?-*>?\s*(?:\|\s*"?([^|"]*)"?\s*\|)?\s*([A-Za-z0-9_]+)/.exec(limpo);
          if (e) saida.push((nomes[e[1]] || e[1]) + (e[2] ? ' (' + e[2].trim() + ')' : '') + ' → ' + (nomes[e[3]] || e[3]));
        });
        return saida;
      }
      var secs = [], cur = { titulo: '', blocos: [] }, ul = null, ol = null, tab = null, cerca = null, buf = [];
      var fim = function () { ul = null; ol = null; tab = null; };
      String(t || '').split('\n').forEach(function (raw) {
        var l = raw.trim();
        if (cerca !== null) {
          if (/^```/.test(l)) {
            var itens = cerca === 'mermaid' ? mermaid(buf) : buf.slice();
            if (itens.length) cur.blocos.push({ t: 'l', o: false, i: itens.map(inl) });
            cerca = null; buf = [];
          } else if (l) buf.push(l);
          return;
        }
        if (/^```/.test(l)) { fim(); cerca = l.slice(3).trim().toLowerCase(); buf = []; return; }
        if (!l) { fim(); return; }
        if (/^-{3,}$/.test(l)) { fim(); return; }
        if (/^## /.test(l)) { fim(); if (cur.titulo || cur.blocos.length) secs.push(cur); cur = { titulo: inl(l.slice(3)), blocos: [] }; return; }
        if (/^# /.test(l)) { fim(); cur.blocos.push({ t: 'h', x: inl(l.slice(2)) }); return; }
        if (/^#{3,6} /.test(l)) { fim(); cur.blocos.push({ t: 'h', x: inl(l.replace(/^#+ /, '')) }); return; }
        if (/^> Perla[:：]?/i.test(l)) { fim(); cur.blocos.push({ t: 'c', k: 'perola', x: inl(l.replace(/^> Perla[:：]?\s*/i, '')) }); return; }
        if (/^> Alarme[:：]?/i.test(l)) { fim(); cur.blocos.push({ t: 'c', k: 'atencao', x: inl(l.replace(/^> Alarme[:：]?\s*/i, '')) }); return; }
        if (/^> /.test(l)) { fim(); cur.blocos.push({ t: 'c', k: 'nota', x: inl(l.slice(2)) }); return; }
        if (/^\|.*\|$/.test(l)) {
          var cel = l.slice(1, -1).split('|').map(function (c) { return inl(c); });
          if (cel.every(function (c) { return /^:?-{2,}:?$/.test(c); })) return;
          if (!tab) { tab = { t: 'tab', h: cel, r: [] }; cur.blocos.push(tab); } else tab.r.push(cel);
          ul = null; ol = null;
          return;
        }
        if (/^[-*•] /.test(l)) { ol = null; tab = null; if (!ul) { ul = { t: 'l', o: false, i: [] }; cur.blocos.push(ul); } ul.i.push(inl(l.slice(2))); return; }
        if (/^\d+\. /.test(l)) { ul = null; tab = null; if (!ol) { ol = { t: 'l', o: true, i: [] }; cur.blocos.push(ol); } ol.i.push(inl(l.replace(/^\d+\. /, ''))); return; }
        fim();
        cur.blocos.push({ t: 'p', x: inl(l) });
      });
      if (cur.titulo || cur.blocos.length) secs.push(cur);
      secs.forEach(function (s) {
        s.titulo = semEmoji(s.titulo);
        s.blocos.forEach(function (b) { if (b.x) b.x = semEmoji(b.x); if (b.i) b.i = b.i.map(semEmoji); });
      });
      return secs;
    },

    lerResultado: function () {
      var h = els.resultBox ? els.resultBox.innerHTML : '';
      if (!h) return 'null';
      var cls = (/class="result (\w+)"/.exec(h) || [])[1] || '';
      var tit = (/class="rtitle">([\s\S]*?)<\/div>/.exec(h) || [])[1] || '';
      var msg = (/class="rwhy">([\s\S]*?)<ul>/.exec(h) || [])[1] || '';
      var why = [], m, re = /<li>([\s\S]*?)<\/li>/g;
      while ((m = re.exec(h))) why.push(m[1]);
      return JSON.stringify({ faixa: cls, titulo: tit, msg: msg, porque: why, positivo: h.indexOf('irIA()') >= 0 });
    }
  };
})(this);
/* ===== FIM DA PONTE DO IPHONE ===== */
      MTPonte = G.MTPonte;
    }).call(G);
    return G;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = MTFerPonte; else raiz.MTFerPonte = MTFerPonte;
})(typeof window !== 'undefined' ? window : globalThis);
