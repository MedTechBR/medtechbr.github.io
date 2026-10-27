/* ============================================================
   MedTech: resumo de estudo da licença para turma (/_mtresumo.js, 27/10/2026)
   ARQUIVO GERADO por ~/Documents/Claude/_mtresumo/monta.py (motor.js + adaptadores/).
   Não editar no site: editar na pasta _mtresumo e montar de novo.

   Carregado SÓ pelo /_mtacesso.js, depois do MTAcesso.verificar de um app de
   estudo, e SÓ quando o planos.json tem "turmas": true e a conta tem turma
   (claim mt.g). Para qualquer outra pessoa este arquivo nem é baixado.

   O que faz, para o aluno de turma:
   1) pergunta ao servidor (mtTurma 'minhas') quais turmas valem neste app; o
      servidor marca "ativou" na primeira vez;
   2) na primeira vez, mostra o aviso: "Seu acesso foi liberado pelo [curso].
      O [curso] pode acompanhar seu desempenho (...). Você autoriza?"
      Autorizo / Agora não. A resposta vai ao servidor com data (mtTurma
      'autorizar'); dá para mudar depois em medtechbr.com.br/turma.html;
   3) calcula um RESUMO AGREGADO com o adaptador do app (questões feitas, acerto
      geral e por grande área, simulados, dias de estudo, último acesso) e manda
      (mtTurma 'resumo') quando mudou, no máximo a cada 10 minutos. O caderno de
      respostas nunca sai do aparelho/conta: só esses números.
   Sem a autorização, o curso vê só "ativou: sim/não" e números da turma inteira,
   sem identificar ninguém (regra no servidor, turmas.js).
   Toda falha é silenciosa: nada aqui pode travar o app.
   ============================================================ */
(function () {
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;
if (G.MTResumo) return;
var VERSAO = 1;
var INTERVALO_MS = 10 * 60 * 1000;
var CACHE_MINHAS_MS = 6 * 3600 * 1000;
var MTRESUMO_ADAPT = {};

/* ====================== adaptadores (um por app) ====================== */
/* ---- _familia-clinicamed.js ---- */
/* Familia ClinicaMed (clinicamed, cirurgiamed, flashmed, enfermare, fisiare): os 5 sao forks do mesmo index.html.
   localStorage (PREF = cm_, cg_, fl_, ef_, fi_):
     PREF+"resp"      {chave: {hist:[{d:"AAAA-MM-DD", ok, alt, m, ts}]}}  (registraResposta; teto de 60 por questao)
     PREF+"sim"       [{quando: ISO, n, acertos, nota, dur, prova, qs, res}]  um item por simulado ENCERRADO (encerraSim)
     PREF+"atividade" {"AAAA-MM-DD": n}  questoes, cartoes, leituras e casos por dia (o "dias com estudo" do Painel)
     PREF+"treino"    {idCaso: {quando: ISO, ...}}  casos clinicos escritos
     "mterr:"+appId   cache das erratas {itens:[{qid, tipo:"oculta"|"corrige", dados:{gabarito}}]} (mterrata.js)
   Area: window.BANCO (banco.js, carregado sincrono no <head>) -> q.tema -> window.TAXONOMIA[].nome;
   no FlashMed, TAXONOMIA[].grande -> window.GRANDES[].nome. Chave da questao = q._ch (posta pelo app) ou
   o mesmo hash do app (chaveTxt do enunciado ORIGINAL). Questao fora do banco ou banco ausente = "Outras".
   Depende so de ctx; nao grava nada. Os arquivos <appId>.js chamam MTRESUMO_FAMILIA_CM({...}). */
function MTRESUMO_FAMILIA_CM(cfg) {
  var RE_DIA = /^\d{4}-\d{2}-\d{2}$/;
  var cache = { banco: null, n: -1, tax: null, mapa: null };

  function imul(a, b) {
    if (Math.imul) return Math.imul(a, b);
    var ah = (a >>> 16) & 0xffff, al = a & 0xffff, bh = (b >>> 16) & 0xffff, bl = b & 0xffff;
    return ((al * bl) + (((ah * bl + al * bh) << 16) >>> 0)) | 0;
  }
  /* copia fiel de hashTxt/chaveTxt do index.html dos 5 apps */
  function hashTxt(s) {
    var h1 = 5381, h2 = 0x811c9dc5, i, c;
    for (i = 0; i < s.length; i++) {
      c = s.charCodeAt(i);
      h1 = ((h1 << 5) + h1 + c) >>> 0;
      h2 = imul(h2 ^ c, 0x01000193) >>> 0;
    }
    return (h1.toString(36) + h2.toString(36)).slice(0, 10);
  }
  function chaveTxt(t) {
    var s = String(t || "");
    if (s.normalize) s = s.normalize("NFD");
    return hashTxt(s.replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, ""));
  }
  function chaveDe(q) {
    if (typeof q._ch === "string" && q._ch) return q._ch;
    var o = q.__mterrOrig;                       /* errata mexeu no enunciado: a chave e a do original */
    if (o && typeof o === "object" && typeof o.q === "string") return chaveTxt(o.q);
    return chaveTxt(q.q);
  }

  /* chave -> nome da grande area, refeito so quando o banco muda */
  function mapaAreas(w) {
    var banco = w && w.BANCO, tax = w && w.TAXONOMIA;
    if (!banco || typeof banco.length !== "number" || !tax || typeof tax.length !== "number") return null;
    if (cache.banco === banco && cache.n === banco.length && cache.tax === tax) return cache.mapa;
    var nomeTema = {}, grandes = {}, i, t, g, q;
    if (cfg.grande) {
      var gl = w.GRANDES || [];
      for (i = 0; i < gl.length; i++) { g = gl[i]; if (g && g.id) grandes[g.id] = g.nome || g.id; }
    }
    for (i = 0; i < tax.length; i++) {
      t = tax[i]; if (!t || !t.id) continue;
      nomeTema[t.id] = cfg.grande ? (grandes[t.grande] || "Outras") : (t.nome || t.id);
    }
    var mapa = {};
    for (i = 0; i < banco.length; i++) {
      q = banco[i]; if (!q || typeof q !== "object" || typeof q.q !== "string") continue;
      try { mapa[chaveDe(q)] = nomeTema[q.tema] || "Outras"; } catch (e) {}
    }
    cache.banco = banco; cache.n = banco.length; cache.tax = tax; cache.mapa = mapa;
    return mapa;
  }

  function erratas(ctx) {
    var out = { oculta: {}, gab: {} }, c = ctx.ls("mterr:" + cfg.app), it = c && c.itens, i, e;
    if (!it || typeof it.length !== "number") return out;
    for (i = 0; i < it.length; i++) {
      e = it[i]; if (!e || typeof e.qid !== "string") continue;
      if (e.tipo === "oculta") out.oculta[e.qid] = 1;
      else if (e.tipo === "corrige" && e.dados && typeof e.dados.gabarito === "number" && e.dados.gabarito % 1 === 0) out.gab[e.qid] = e.dados.gabarito;
    }
    return out;
  }
  function ms(iso) { var t = typeof iso === "number" ? iso : Date.parse(iso); return isNaN(t) || t <= 0 ? 0 : t; }
  function ehLista(v) { return Object.prototype.toString.call(v) === "[object Array]"; }
  function ehObj(v) { return !!v && typeof v === "object" && !ehLista(v); }

  return function (ctx) {
    var P = cfg.pref;
    var resp = ctx.ls(P + "resp"), sims = ctx.ls(P + "sim"), ativ = ctx.ls(P + "atividade"), treino = ctx.ls(P + "treino");
    if (!ehObj(resp)) resp = {};
    if (!ehLista(sims)) sims = [];
    if (!ehObj(ativ)) ativ = {};
    if (!ehObj(treino)) treino = {};

    var mapa = null; try { mapa = mapaAreas(ctx.w); } catch (e) { mapa = null; }
    var er = erratas(ctx);
    var r = { q: 0, a: 0, areas: {}, sim: 0, dias: [], ult: 0 };
    var dias = {}, algo = false, ch, h, i, x, ult, ultIdx, ok, nome, t, d, k;

    function marca(t, dTxt) {
      if (t) { if (t > r.ult) r.ult = t; d = ctx.dia(t); if (d) dias[d] = 1; }
      else if (typeof dTxt === "string" && RE_DIA.test(dTxt)) dias[dTxt] = 1;
    }

    for (ch in resp) {
      if (!Object.prototype.hasOwnProperty.call(resp, ch)) continue;
      h = resp[ch] && resp[ch].hist;
      if (!ehLista(h)) continue;
      ult = null; ultIdx = -1;
      for (i = 0; i < h.length; i++) {
        x = h[i]; if (!x || typeof x !== "object") continue;
        algo = true;
        t = ms(x.ts); marca(t, x.d);           /* o estudo aconteceu mesmo se a questao saiu do ar */
        if (!ult || (t || 0) >= (ms(ult.ts) || 0)) { ult = x; ultIdx = i; }
      }
      if (!ult || er.oculta[ch]) continue;     /* tirada do ar pela revisao: o Painel do app tambem nao conta */
      ok = (ch in er.gab && typeof ult.alt === "number") ? (er.gab[ch] < 0 ? true : ult.alt === er.gab[ch]) : !!ult.ok;
      nome = (mapa && mapa[ch]) || "Outras";
      r.q++; if (ok) r.a++;
      x = r.areas[nome] || (r.areas[nome] = [0, 0]);
      x[0]++; if (ok) x[1]++;
    }

    for (i = 0; i < sims.length; i++) {
      x = sims[i]; if (!x || typeof x !== "object") continue;
      r.sim++; algo = true; marca(ms(x.quando));
    }
    for (k in treino) {
      if (Object.prototype.hasOwnProperty.call(treino, k) && treino[k] && treino[k].quando) { algo = true; marca(ms(treino[k].quando)); }
    }
    for (k in ativ) {
      if (Object.prototype.hasOwnProperty.call(ativ, k) && RE_DIA.test(k) && +ativ[k] > 0) { dias[k] = 1; algo = true; }
    }
    if (!algo) return null;

    var lista = [];
    for (k in dias) if (Object.prototype.hasOwnProperty.call(dias, k)) lista.push(k);
    lista.sort();
    if (lista.length > 400) lista = lista.slice(lista.length - 400);
    r.dias = lista;
    /* dia de estudo sem carimbo de hora (so cartoes, leituras ou casos em PREF+"atividade"): meio-dia de Brasilia desse dia */
    if (lista.length && (!r.ult || lista[lista.length - 1] > ctx.dia(r.ult))) {
      t = Date.parse(lista[lista.length - 1] + "T12:00:00-03:00");
      if (!isNaN(t)) r.ult = Math.max(r.ult, Math.min(t, Date.now()));
    }
    return r;
  };
}

/* ---- _familia-sos.js ---- */
/* _familia-sos: motor comum do SOS Farmácia Comercial (sosfarmacia) e do SOS Farmacologia (sosfarmacologia).
   Mesmo app.js nos dois; muda só o prefixo do localStorage ("sos-farmacia:" / "sos-farmacologia:").
   - resp (<pref>resp) = {"<idDoBloco>:<índice>": alternativa escolhida}: só a ÚLTIMA resposta, sem data.
     q = chaves que são questão do banco atual; a = valor === item.c (mesma conta da tela de início do app).
   - Banco e nomes: window.SOS.dados.modulos (app.js); área = módulo, nome m.curto || m.titulo (barra lateral).
   - dias/ult: carimbos de edição por item do motor do mtsync (<pref>mts: E.bt / E.ed), só nos itens que ainda
     existem em resp, estudado e vistos. Carimbo 1 (progresso de antes da conta) não conta.
   - sim = 0: o app não tem simulado nem prova final de módulo.
   Carregar ANTES de sosfarmacia.js e sosfarmacologia.js. A fábrica fica não enumerável em MTRESUMO_ADAPT. */
(function () {
  var A = (typeof MTRESUMO_ADAPT !== "undefined" && MTRESUMO_ADAPT) || null;
  if (!A) return;

  var MIN_T = 1000000000000;        /* set/2001: abaixo disso é carimbo "antigo" (1) ou lixo */
  var FOLGA_FUTURO = 86400000;      /* relógio de outro aparelho adiantado: tolera 1 dia */

  function ehObj(v) { return !!v && typeof v === "object" && !(v instanceof Array); }
  function chavesDe(v) {
    /* lista de ids (forma do app) ou mapa {id: 1} (tolerância) -> lista de ids em texto */
    var out = [], i, k;
    if (v instanceof Array) {
      for (i = 0; i < v.length; i++) {
        if ((typeof v[i] === "string" && v[i]) || typeof v[i] === "number") out.push(String(v[i]));
      }
    } else if (ehObj(v)) {
      for (k in v) if (Object.prototype.hasOwnProperty.call(v, k) && v[k] !== null && v[k] !== undefined) out.push(k);
    }
    return out;
  }

  function fabrica(cfg) {
    var PREF = cfg.pref;
    return function (ctx) {
      var resp = ctx.ls(PREF + "resp");
      if (!ehObj(resp)) resp = {};
      var estudado = chavesDe(ctx.ls(PREF + "estudado"));
      var vistos = chavesDe(ctx.ls(PREF + "vistos"));
      var check = ctx.ls(PREF + "check");
      var respIds = [], k;
      for (k in resp) if (Object.prototype.hasOwnProperty.call(resp, k) && resp[k] !== null && resp[k] !== undefined) respIds.push(k);
      var nCheck = 0;
      if (ehObj(check)) for (k in check) if (Object.prototype.hasOwnProperty.call(check, k)) nCheck++;
      if (!respIds.length && !estudado.length && !vistos.length && !nCheck) return null;

      /* ---------- banco de questões (só se a página é deste app) ---------- */
      var w = ctx.w || {}, dados = null;
      try {
        var conta = w.__contaSOS, outroApp = false;
        if (conta && conta.CHAVE && typeof conta.CHAVE.resp === "string" && conta.CHAVE.resp !== PREF + "resp") outroApp = true;
        if (!outroApp && w.SOS && w.SOS.dados && w.SOS.dados.modulos instanceof Array) dados = w.SOS.dados;
      } catch (e) { dados = null; }

      var indice = null, ordem = [], i, j, m, b;
      if (dados) {
        indice = {};
        for (i = 0; i < dados.modulos.length; i++) {
          m = dados.modulos[i];
          if (!m || !(m.apoio instanceof Array)) continue;
          var nome = String(m.curto || m.titulo || m.id || "Outras");
          for (j = 0; j < m.apoio.length; j++) {
            b = m.apoio[j];
            if (!b || b.tipo !== "questoes" || !(b.itens instanceof Array)) continue;
            for (var n = 0; n < b.itens.length; n++) {
              if (b.itens[n]) indice[b.id + ":" + n] = { area: nome, c: b.itens[n].c };
            }
          }
          ordem.push(nome);
        }
      }

      /* ---------- q, a, áreas ---------- */
      var q = 0, a = 0, cont = {}, x, info, certa, area;
      for (i = 0; i < respIds.length; i++) {
        x = resp[respIds[i]];
        if (indice) {
          info = indice[respIds[i]];
          if (!info) continue;                 /* questão que não existe mais no banco: o app também ignora */
          certa = x === info.c;
          area = info.area;
        } else {
          certa = false;                       /* sem o banco não dá para saber o gabarito */
          area = "Outras";
        }
        q++; if (certa) a++;
        if (!cont[area]) cont[area] = [0, 0];
        cont[area][0]++; if (certa) cont[area][1]++;
      }
      var areas = {};
      for (i = 0; i < ordem.length; i++) if (cont[ordem[i]] && !areas[ordem[i]]) areas[ordem[i]] = cont[ordem[i]];
      for (k in cont) if (Object.prototype.hasOwnProperty.call(cont, k) && !areas[k]) areas[k] = cont[k];

      /* ---------- dias e última atividade: carimbos por item do motor do mtsync ---------- */
      var E = ctx.ls(PREF + "mts"), diasM = {}, ult = 0, agora = new Date().getTime();
      var cols = { resp: respIds, estudado: estudado, vistos: vistos };
      function carimbo(t) {
        t = +t;
        if (!(t > MIN_T) || t > agora + FOLGA_FUTURO) return;
        if (t > ult) ult = t;
        var d = ctx.dia(t);
        if (d) diasM[d] = 1;
      }
      if (ehObj(E)) {
        for (var c in cols) {
          if (!Object.prototype.hasOwnProperty.call(cols, c)) continue;
          var bt = ehObj(E.bt) && ehObj(E.bt[c]) ? E.bt[c] : {};
          var ed = ehObj(E.ed) && ehObj(E.ed[c]) ? E.ed[c] : {};
          for (i = 0; i < cols[c].length; i++) {
            if (Object.prototype.hasOwnProperty.call(bt, cols[c][i])) carimbo(bt[cols[c][i]]);
            if (Object.prototype.hasOwnProperty.call(ed, cols[c][i])) carimbo(ed[cols[c][i]]);
          }
        }
      }
      var dias = [];
      for (k in diasM) if (Object.prototype.hasOwnProperty.call(diasM, k)) dias.push(k);
      dias.sort();
      if (dias.length > 400) dias = dias.slice(dias.length - 400);

      return { q: q, a: a, areas: areas, sim: 0, dias: dias, ult: ult };
    };
  }

  try {
    Object.defineProperty(A, "_familiaSOS", { value: fabrica, enumerable: false, configurable: true, writable: true });
  } catch (e) { A._familiaSOS = fabrica; }
})();

/* ---- cirurgiamed.js ---- */
/* cirurgiamed: CirurgiaMed (TECG/CBC e ENARE pre-requisito).
   Respostas: localStorage "cg_resp" (historico por questao, ultima tentativa decide o acerto); simulados: "cg_sim" (encerrados).
   Dias: carimbos ts das tentativas (Brasilia) + chaves de "cg_atividade" + "quando" dos simulados e casos; ult = maior carimbo.
   Area: window.BANCO[].tema -> window.TAXONOMIA[].nome (19 areas, as do filtro e do Painel).
   Erratas: "mterr:cirurgiamed" (questao tirada do ar sai da contagem; gabarito trocado reavalia a ultima resposta).
   Usa MTRESUMO_FAMILIA_CM (_familia-clinicamed.js). */
MTRESUMO_ADAPT["cirurgiamed"] = MTRESUMO_FAMILIA_CM({ app: "cirurgiamed", pref: "cg_" });

/* ---- clinicamed.js ---- */
/* clinicamed: ClinicaMed (TECM/SBCM).
   Respostas: localStorage "cm_resp" (historico por questao, ultima tentativa decide o acerto); simulados: "cm_sim" (encerrados).
   Dias: carimbos ts das tentativas (Brasilia) + chaves de "cm_atividade" + "quando" dos simulados e casos; ult = maior carimbo.
   Area: window.BANCO[].tema -> window.TAXONOMIA[].nome (15 areas do edital, as do filtro e do Painel).
   Erratas: "mterr:clinicamed" (questao tirada do ar sai da contagem; gabarito trocado reavalia a ultima resposta).
   Usa MTRESUMO_FAMILIA_CM (_familia-clinicamed.js). */
MTRESUMO_ADAPT["clinicamed"] = MTRESUMO_FAMILIA_CM({ app: "clinicamed", pref: "cm_" });

/* ---- enarefarmacia.js ---- */
/* enarefarmacia (AprovaFarma): respostas em enareFarmaProgress_v1 = {chave: {sel, ok, t, tema, refeita?}} (só a ÚLTIMA
   resposta; "refazer erradas" grava por cima). q = chaves; a = ok. Área = bloco do edital do tema (tema gravado na
   resposta ou, se faltar, window.BANCO_EDITAL pela chave): "1." Básicos, "6." Farmácia, como em Painel > blocos.
   sim = chaves enareSim_<id> com finished = true (provas reais e diários). dias = t das respostas + dias com
   contagem em enareFarmaAtiv_v1 + sessões de flashcards/treino em enareFarmaDias_v1.
   ult = maior t das respostas e das marcações de exames (enareExames_v1). Simulados não entram em q (o app não os soma ao painel). */
MTRESUMO_ADAPT["enarefarmacia"] = function (ctx) {
  function ehObj(o) { return !!o && typeof o === "object" && !Array.isArray(o); }
  function ehDia(s) { return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s); }
  function ehMs(n) { return typeof n === "number" && isFinite(n) && n > 946684800000 && n < 4102444800000; }
  function tem(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  /* mesma chave do app (index.html, chaveQ/hashTxt): djb2 + FNV sobre o enunciado normalizado */
  function hashTxt(s) {
    var h1 = 5381, h2 = 0x811c9dc5, i, c;
    for (i = 0; i < s.length; i++) {
      c = s.charCodeAt(i);
      h1 = ((h1 << 5) + h1 + c) >>> 0;
      h2 = Math.imul(h2 ^ c, 0x01000193) >>> 0;
    }
    return (h1.toString(36) + h2.toString(36)).slice(0, 10);
  }
  function chaveQ(q) {
    var t = String((q && q.q) || "");
    if (t.normalize) t = t.normalize("NFD");
    t = t.replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
    return hashTxt(t);
  }
  var BASICOS = "1 · Conhecimentos Básicos em Saúde", FARMACIA = "6 · Conhecimentos Específicos — Farmácia";
  function bloco(tema) {
    var t = String(tema || "");
    if (t.indexOf("1.") === 0) return BASICOS;
    if (t.indexOf("6.") === 0) return FARMACIA;
    return "Outras";
  }

  var resp = ctx.ls("enareFarmaProgress_v1"), ativ = ctx.ls("enareFarmaAtiv_v1"), sess = ctx.ls("enareFarmaDias_v1");
  var chSim = ctx.chaves("enareSim_") || [];
  if (!ehObj(resp) && !ehObj(ativ) && !ehObj(sess) && !chSim.length) return null;
  if (!ehObj(resp)) resp = {};

  var dias = {}, ult = 0, q = 0, a = 0, areas = {}, k, i;
  function marcaMs(ms) { if (ehMs(ms)) { dias[ctx.dia(ms)] = 1; if (ms > ult) ult = ms; } }

  /* chave -> tema pelo banco, só se alguma resposta não trouxer o tema (registros antigos) */
  var temaDe = null;
  function temaPorChave(ch) {
    if (temaDe === null) {
      temaDe = {};
      try {
        var b = ctx.w && ctx.w.BANCO_EDITAL;
        if (Array.isArray(b)) for (i = 0; i < b.length; i++) if (b[i] && typeof b[i] === "object") temaDe[chaveQ(b[i])] = b[i].tema;
      } catch (e) {}
    }
    return temaDe[ch];
  }

  for (k in resp) {
    if (!tem(resp, k) || /^\d+$/.test(k)) continue;          /* formato antigo por posição: o app migra/descarta */
    var r = resp[k];
    if (!ehObj(r)) continue;
    var ok = r.ok === true;
    q++; if (ok) a++;
    marcaMs(r.t);
    var nome = bloco(typeof r.tema === "string" && r.tema ? r.tema : temaPorChave(k));
    var par = areas[nome] || (areas[nome] = [0, 0]);
    par[0]++; if (ok) par[1]++;
  }

  if (ehObj(ativ)) for (k in ativ) if (tem(ativ, k) && ehDia(k) && (+ativ[k] || 0) > 0) dias[k] = 1;
  if (ehObj(sess)) for (k in sess) if (tem(sess, k) && ehDia(k) && (+sess[k] || 0) > 0) dias[k] = 1;

  var sim = 0;
  for (i = 0; i < chSim.length; i++) {
    var st = ctx.ls(chSim[i]);
    if (ehObj(st) && st.finished === true) sim++;
  }

  var ex = ctx.ls("enareExames_v1");
  if (ehObj(ex)) for (k in ex) if (tem(ex, k) && ehObj(ex[k]) && ehMs(ex[k].t) && ex[k].t > ult) ult = ex[k].t;

  var lista = [];
  for (k in dias) if (tem(dias, k)) lista.push(k);
  lista.sort();
  if (lista.length > 400) lista = lista.slice(lista.length - 400);
  return { q: q, a: a, areas: areas, sim: sim, dias: lista, ult: ult };
};

/* ---- enfermare.js ---- */
/* enfermare: Enfermare (ENARE multi/EBSERH Enfermagem).
   Respostas: localStorage "ef_resp" (historico por questao, ultima tentativa decide o acerto); simulados: "ef_sim" (encerrados).
   Dias: carimbos ts das tentativas (Brasilia) + chaves de "ef_atividade" + "quando" dos simulados e casos; ult = maior carimbo.
   Area: window.BANCO[].tema -> window.TAXONOMIA[].nome (19 areas, as do filtro e do Painel).
   Erratas: "mterr:enfermare" (questao tirada do ar sai da contagem; gabarito trocado reavalia a ultima resposta).
   Usa MTRESUMO_FAMILIA_CM (_familia-clinicamed.js). */
MTRESUMO_ADAPT["enfermare"] = MTRESUMO_FAMILIA_CM({ app: "enfermare", pref: "ef_" });

/* ---- farmauti.js ---- */
/* farmauti: respostas em fu_resp = {idQuestao: [{t, a, ok, sim?}]} (histórico; inclui as feitas em simulado).
   q = ids com histórico; a = ok da última tentativa. Área = área da leitura da questão (window.FU_ESTUDO:
   questoes[].l -> leituras[].area -> areas[].nome), as 8 áreas de Desempenho. sim = itens de fu_sims (um por
   simulado entregue, {ts, n, ok, ...}). dias = t das respostas + dias de fu_ativ com estudo (questões, cartões,
   leitura, prescrição ou 10+ min) + ts dos simulados + data de conclusão dos casos (fu_casos[id].feito).
   ult = maior t das respostas e ts dos simulados. */
MTRESUMO_ADAPT["farmauti"] = function (ctx) {
  function ehObj(o) { return !!o && typeof o === "object" && !Array.isArray(o); }
  function ehDia(s) { return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s); }
  function ehMs(n) { return typeof n === "number" && isFinite(n) && n > 946684800000 && n < 4102444800000; }
  function tem(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  var resp = ctx.ls("fu_resp"), ativ = ctx.ls("fu_ativ"), sims = ctx.ls("fu_sims"), casos = ctx.ls("fu_casos");
  if (!ehObj(resp) && !ehObj(ativ) && !Array.isArray(sims)) return null;
  if (!ehObj(resp)) resp = {};

  var dias = {}, ult = 0, q = 0, a = 0, areas = {}, k, i;
  function marcaMs(ms) { if (ehMs(ms)) { dias[ctx.dia(ms)] = 1; if (ms > ult) ult = ms; } }

  /* id da questão -> nome da área (só se o banco estiver na página) */
  var areaDe = {};
  try {
    var E = ctx.w && ctx.w.FU_ESTUDO;
    if (ehObj(E)) {
      var nomeA = {}, areaL = {};
      if (Array.isArray(E.areas)) for (i = 0; i < E.areas.length; i++) if (E.areas[i] && E.areas[i].id) nomeA[E.areas[i].id] = String(E.areas[i].nome || E.areas[i].id);
      if (Array.isArray(E.leituras)) for (i = 0; i < E.leituras.length; i++) if (E.leituras[i] && E.leituras[i].slug) areaL[E.leituras[i].slug] = E.leituras[i].area;
      if (Array.isArray(E.questoes)) for (i = 0; i < E.questoes.length; i++) {
        var qq = E.questoes[i]; if (!qq || !qq.id) continue;
        var ar = areaL[qq.l];
        if (ar && nomeA[ar]) areaDe[qq.id] = nomeA[ar];
      }
    }
  } catch (e) { areaDe = {}; }

  for (k in resp) {
    if (!tem(resp, k)) continue;
    var h = resp[k];
    if (!Array.isArray(h) || !h.length) continue;
    var ultT = null, j;
    for (j = 0; j < h.length; j++) {
      if (!ehObj(h[j])) continue;
      ultT = h[j];
      marcaMs(h[j].t);
    }
    if (!ultT) continue;
    var ok = ultT.ok === true;
    q++; if (ok) a++;
    var nome = tem(areaDe, k) ? areaDe[k] : "Outras";
    var par = areas[nome] || (areas[nome] = [0, 0]);
    par[0]++; if (ok) par[1]++;
  }

  /* mesmo critério de "estudou" do app (app.js, estudou), mais prescrições corrigidas */
  if (ehObj(ativ)) for (k in ativ) {
    if (!tem(ativ, k) || !ehDia(k) || !ehObj(ativ[k])) continue;
    var d = ativ[k];
    if ((+d.q || 0) + (+d.c || 0) > 0 || (+d.min || 0) >= 10 || (+d.l || 0) > 0 || (+d.rx || 0) > 0) dias[k] = 1;
  }

  var sim = 0;
  if (Array.isArray(sims)) for (i = 0; i < sims.length; i++) {
    if (!ehObj(sims[i])) continue;
    sim++;
    marcaMs(sims[i].ts);
  }

  if (ehObj(casos)) for (k in casos) if (tem(casos, k) && ehObj(casos[k]) && ehDia(casos[k].feito)) dias[casos[k].feito] = 1;

  var lista = [];
  for (k in dias) if (tem(dias, k)) lista.push(k);
  lista.sort();
  if (lista.length > 400) lista = lista.slice(lista.length - 400);
  return { q: q, a: a, areas: areas, sim: sim, dias: lista, ult: ult };
};

/* ---- fisiare.js ---- */
/* fisiare: Fisiare (ENARE multi/EBSERH Fisioterapia).
   Respostas: localStorage "fi_resp" (historico por questao, ultima tentativa decide o acerto); simulados: "fi_sim" (encerrados).
   Dias: carimbos ts das tentativas (Brasilia) + chaves de "fi_atividade" + "quando" dos simulados e casos; ult = maior carimbo.
   Area: window.BANCO[].tema -> window.TAXONOMIA[].nome (17 areas, as do filtro e do Painel).
   Erratas: "mterr:fisiare" (questao tirada do ar sai da contagem; gabarito trocado reavalia a ultima resposta).
   Usa MTRESUMO_FAMILIA_CM (_familia-clinicamed.js). */
MTRESUMO_ADAPT["fisiare"] = MTRESUMO_FAMILIA_CM({ app: "fisiare", pref: "fi_" });

/* ---- flashmed.js ---- */
/* flashmed: FlashMed (ENARE/ENAMED). Nuvem usa colecoes f2resp/f2sim..., mas o localStorage continua fl_*.
   Respostas: localStorage "fl_resp" (historico por questao, ultima tentativa decide o acerto); simulados: "fl_sim" (encerrados).
   Dias: carimbos ts das tentativas (Brasilia) + chaves de "fl_atividade" + "quando" dos simulados e casos; ult = maior carimbo.
   Area: window.BANCO[].tema (subarea) -> TAXONOMIA[].grande -> window.GRANDES[].nome (8 grandes areas, as do Painel).
   Erratas: "mterr:flashmed" (questao tirada do ar sai da contagem; gabarito trocado reavalia a ultima resposta).
   Usa MTRESUMO_FAMILIA_CM (_familia-clinicamed.js). */
MTRESUMO_ADAPT["flashmed"] = MTRESUMO_FAMILIA_CM({ app: "flashmed", pref: "fl_", grande: true });

/* ---- sosfarmacia.js ---- */
/* sosfarmacia (SOS Farmácia Comercial, 14 módulos): motor comum em _familia-sos.js (carregar antes).
   q/a: localStorage "sos-farmacia:resp" ({"<bloco>:<i>": alternativa}) x gabarito item.c de window.SOS.dados.
   areas: módulo (m.curto || m.titulo, como na barra lateral). sim: 0 (não há simulado).
   dias/ult: carimbos por item em "sos-farmacia:mts" (E.bt/E.ed do mtsync) de resp, estudado e vistos.
   Janela: a mesma do app (sem iframe); casca.html escreve mtsync.js, /_mtacesso.js e conta-sos.js no <head>. */
if (MTRESUMO_ADAPT._familiaSOS) MTRESUMO_ADAPT["sosfarmacia"] = MTRESUMO_ADAPT._familiaSOS({ pref: "sos-farmacia:" });

/* ---- sosfarmacologia.js ---- */
/* sosfarmacologia (SOS Farmacologia, 17 módulos): motor comum em _familia-sos.js (carregar antes).
   q/a: localStorage "sos-farmacologia:resp" ({"<bloco>:<i>": alternativa}) x gabarito item.c de window.SOS.dados.
   areas: módulo (m.curto || m.titulo, como na barra lateral). sim: 0 (não há simulado).
   dias/ult: carimbos por item em "sos-farmacologia:mts" (E.bt/E.ed do mtsync) de resp, estudado e vistos.
   Janela: a mesma do app (sem iframe); casca.html escreve mtsync.js, /_mtacesso.js e conta-sosfarmacologia.js no <head>. */
if (MTRESUMO_ADAPT._familiaSOS) MTRESUMO_ADAPT["sosfarmacologia"] = MTRESUMO_ADAPT._familiaSOS({ pref: "sos-farmacologia:" });

/* ---- trafegotitulo.js ---- */
/* trafegotitulo: respostas em tt_resp = {chave: {hist: [{d, ok, alt, m, ts}]}} (chave = hash do enunciado, q._ch;
   inclui as questões feitas em simulado). q = chaves com histórico; a = ok da última tentativa.
   Área = tema da questão (window.BANCO[i].tema) com o nome de window.TAXONOMIA (21 temas do edital, como no Painel).
   sim = itens de tt_sim (cada um é um simulado entregue). dias = ts/d das tentativas + dias com contagem em
   tt_atividade (questões e cartões) + quando dos simulados + ts dos casos da prática (tt_treino).
   ult = maior ts das tentativas, do id do simulado (Date.now em base 36) e dos casos da prática. */
MTRESUMO_ADAPT["trafegotitulo"] = function (ctx) {
  function ehObj(o) { return !!o && typeof o === "object" && !Array.isArray(o); }
  function ehDia(s) { return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s); }
  function ehMs(n) { return typeof n === "number" && isFinite(n) && n > 946684800000 && n < 4102444800000; }
  /* mesma chave do app (index.html, chaveTxt/hashTxt): djb2 + FNV sobre o enunciado normalizado */
  function hashTxt(s) {
    var h1 = 5381, h2 = 0x811c9dc5, i, c;
    for (i = 0; i < s.length; i++) {
      c = s.charCodeAt(i);
      h1 = ((h1 << 5) + h1 + c) >>> 0;
      h2 = Math.imul(h2 ^ c, 0x01000193) >>> 0;
    }
    return (h1.toString(36) + h2.toString(36)).slice(0, 10);
  }
  function chaveTxt(t) {
    t = String(t || "");
    if (t.normalize) t = t.normalize("NFD");
    t = t.replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
    return hashTxt(t);
  }

  var resp = ctx.ls("tt_resp"), ativ = ctx.ls("tt_atividade"), sims = ctx.ls("tt_sim"), treino = ctx.ls("tt_treino");
  if (!ehObj(resp) && !ehObj(ativ) && !(Array.isArray(sims))) return null;
  if (!ehObj(resp)) resp = {};

  var w = ctx.w || {}, dias = {}, ult = 0, q = 0, a = 0, areas = {};
  function marcaMs(ms) { if (ehMs(ms)) { dias[ctx.dia(ms)] = 1; if (ms > ult) ult = ms; } }

  /* chave -> nome do tema (só se o banco estiver na página) */
  var nomeTema = {}, temaDe = null, i;
  try {
    var tax = w.TAXONOMIA;
    if (Array.isArray(tax)) for (i = 0; i < tax.length; i++) if (tax[i] && tax[i].id) nomeTema[tax[i].id] = String(tax[i].nome || tax[i].id);
    var banco = w.BANCO;
    if (Array.isArray(banco) && banco.length) {
      temaDe = {};
      for (i = 0; i < banco.length; i++) {
        var bq = banco[i]; if (!bq || typeof bq !== "object") continue;
        var ch = typeof bq._ch === "string" ? bq._ch : chaveTxt(bq.q);
        temaDe[ch] = bq.tema;
      }
    }
  } catch (e) { temaDe = null; }

  var k;
  for (k in resp) {
    if (!Object.prototype.hasOwnProperty.call(resp, k)) continue;
    var r = resp[k];
    if (!ehObj(r) || !(Array.isArray(r.hist)) || !r.hist.length) continue;
    var ultT = null, j;
    for (j = 0; j < r.hist.length; j++) {
      var h = r.hist[j]; if (!ehObj(h)) continue;
      ultT = h;
      if (ehMs(h.ts)) marcaMs(h.ts); else if (ehDia(h.d)) dias[h.d] = 1;
    }
    if (!ultT) continue;
    var ok = ultT.ok === true;
    q++; if (ok) a++;
    var tema = temaDe ? temaDe[k] : null;
    var nome = (tema && nomeTema[tema]) ? nomeTema[tema] : "Outras";
    var par = areas[nome] || (areas[nome] = [0, 0]);
    par[0]++; if (ok) par[1]++;
  }

  if (ehObj(ativ)) for (k in ativ) if (Object.prototype.hasOwnProperty.call(ativ, k) && ehDia(k) && (+ativ[k] || 0) > 0) dias[k] = 1;

  var sim = 0;
  if (Array.isArray(sims)) {
    for (i = 0; i < sims.length; i++) {
      var s = sims[i]; if (!ehObj(s)) continue;
      sim++;
      if (ehDia(s.quando)) dias[s.quando] = 1;
      var ms = typeof s.id === "string" ? parseInt(s.id, 36) : NaN;
      if (ehMs(ms) && ms > ult) ult = ms;
    }
  }

  if (ehObj(treino)) for (k in treino) if (Object.prototype.hasOwnProperty.call(treino, k) && ehObj(treino[k])) {
    if (ehMs(treino[k].ts)) marcaMs(treino[k].ts); else if (ehDia(treino[k].d)) dias[treino[k].d] = 1;
  }

  var lista = [];
  for (k in dias) if (Object.prototype.hasOwnProperty.call(dias, k)) lista.push(k);
  lista.sort();
  if (lista.length > 400) lista = lista.slice(lista.length - 400);
  return { q: q, a: a, areas: areas, sim: sim, dias: lista, ult: ult };
};

/* ====================== fim dos adaptadores ====================== */

function lsGet(k) { try { return G.localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { if (v == null) G.localStorage.removeItem(k); else G.localStorage.setItem(k, v); } catch (e) {} }
function lsJson(k) { var s = lsGet(k); if (s == null) return null; try { return JSON.parse(s); } catch (e) { return null; } }
function diaBR(ms) { return new Date(Number(ms) - 3 * 3600000).toISOString().slice(0, 10); }
var ctx = {
  ls: lsJson, raw: lsGet, w: G, dia: diaBR,
  chaves: function (pref) { var out = []; try { for (var i = 0; i < G.localStorage.length; i++) { var k = G.localStorage.key(i); if (k && k.indexOf(pref) === 0) out.push(k); } } catch (e) {} return out; }
};
/* número inteiro >= 0 */
function n0(v) { v = Math.floor(Number(v)); return isFinite(v) && v > 0 ? v : 0; }
/* resultado do adaptador → o que vai ao servidor (só números) */
function calcular(appId, agoraMs) {
  var f = MTRESUMO_ADAPT[appId];
  if (typeof f !== 'function') return null;
  var r;
  try { r = f(ctx); } catch (e) { return null; }
  if (!r || typeof r !== 'object') return null;
  agoraMs = agoraMs || Date.now();
  var hoje = diaBR(agoraMs), d7 = diaBR(agoraMs - 6 * 86400000), d30 = diaBR(agoraMs - 29 * 86400000);
  var dias = {}, lista = Array.isArray(r.dias) ? r.dias : [];
  for (var i = 0; i < lista.length; i++) { var d = String(lista[i]); if (/^\d{4}-\d{2}-\d{2}$/.test(d) && d <= hoje) dias[d] = 1; }
  var ks = Object.keys(dias), c7 = 0, c30 = 0;
  ks.forEach(function (d) { if (d >= d7) c7++; if (d >= d30) c30++; });
  var areas = {}, fa = (r.areas && typeof r.areas === 'object') ? r.areas : {};
  Object.keys(fa).slice(0, 40).forEach(function (k) {
    var v = fa[k]; if (!Array.isArray(v)) return;
    var q = n0(v[0]), a = Math.min(n0(v[1]), q);
    if (q) areas[String(k).replace(/\s*—\s*/g, ': ').slice(0, 60)] = [q, a];
  });
  var q = n0(r.q), ultMs = n0(r.ult);
  return { q: q, a: Math.min(n0(r.a), q), areas: areas, sim: n0(r.sim), dias: ks.length, d7: c7, d30: c30,
    ult: ultMs > 1e11 ? Math.floor(ultMs / 1000) : ultMs };
}

/* ---------------- aviso de autorização ---------------- */
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function dataBR(s) { return s ? new Date(s * 1000).toLocaleDateString('pt-BR', { timeZone: 'America/Fortaleza' }) : ''; }
function css() {
  if (!G.document || document.getElementById('mtr-css')) return;
  var s = document.createElement('style'); s.id = 'mtr-css';
  s.textContent = '.mtr{position:fixed;inset:0;z-index:99994;background:rgba(15,18,24,.72);display:flex;align-items:flex-end;justify-content:center;padding:16px 16px max(16px,env(safe-area-inset-bottom));font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-text-size-adjust:100%}'
    + '@media(min-width:600px){.mtr{align-items:center}}.mtr *{box-sizing:border-box}'
    + '.mtr-c{width:100%;max-width:500px;background:#fff;color:#1F2329;border-radius:22px;padding:24px 22px 18px;box-shadow:0 24px 60px -20px rgba(0,0,0,.5)}'
    + '.mtr-k{display:inline-flex;font-size:12.5px;font-weight:600;color:#1E4FCB;background:#EAF0FE;border-radius:999px;padding:4px 12px;margin:0 0 12px}'
    + '.mtr h2{font-size:21px;font-weight:700;letter-spacing:-.01em;line-height:1.25;margin:0;outline:none}.mtr p{font-size:15px;color:#3A4048;line-height:1.55;margin:10px 0 0}'
    + '.mtr .mtr-m{font-size:13.5px;color:#4A515A;background:#F4F6F8;border-radius:14px;padding:10px 12px;margin-top:14px}'
    + '.mtr-r{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px}.mtr-r button{flex:1 1 160px;min-height:48px;padding:0 18px;border-radius:999px;border:1.5px solid transparent;font:600 15px Inter,system-ui,sans-serif;cursor:pointer}'
    + '.mtr .s{background:#2B5CE6;color:#fff}.mtr .s:hover{background:#1E4FCB}.mtr .g{background:#fff;color:#1F2329;border-color:#BFC5CD}.mtr .g:hover{background:#F1F3F6}'
    + '.mtr button:focus-visible{outline:3px solid #1E4FCB;outline-offset:2px}.mtr button:disabled{opacity:.6;cursor:default}.mtr .mtr-e{color:#B42318;font-weight:600;font-size:14px;margin-top:10px;min-height:1.2em}'
    + '@media(prefers-color-scheme:dark){html[data-viva-escuro] .mtr-c{background:#1B1E24;color:#ECEEF1}html[data-viva-escuro] .mtr p{color:#C9CDD3}html[data-viva-escuro] .mtr .mtr-m{background:#262A31;color:#C9CDD3}'
    + 'html[data-viva-escuro] .mtr-k{background:#24315A;color:#C7D5FF}html[data-viva-escuro] .mtr .g{background:transparent;color:#ECEEF1;border-color:#5B626C}html[data-viva-escuro] .mtr .mtr-e{color:#FF8A80}}';
  document.head.appendChild(s);
}
/* o = {titulo, html, botoes:[{rot, cls, valor}]} → Promise<valor | null (fechou com Esc)> */
function dialogo(o) {
  return new Promise(function (resolver) {
    css();
    var volta = document.activeElement, fim = false;
    var d = document.createElement('div'); d.className = 'mtr'; d.id = 'mtr';
    d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-labelledby', 'mtr-h'); d.setAttribute('aria-describedby', 'mtr-d');
    d.innerHTML = '<div class="mtr-c"><p class="mtr-k">Licença da turma</p><h2 id="mtr-h" tabindex="-1">' + esc(o.titulo) + '</h2><div id="mtr-d">' + o.html + '</div>' +
      '<p class="mtr-e" role="alert"></p><div class="mtr-r">' + o.botoes.map(function (b, i) { return '<button type="button" class="' + b.cls + '" data-i="' + i + '">' + esc(b.rot) + '</button>'; }).join('') + '</div></div>';
    var marcados = [];
    Array.prototype.forEach.call(document.body.children, function (el) { if (el !== d && el.nodeType === 1 && el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE' && !el.inert) { el.inert = true; marcados.push(el); } });
    document.body.appendChild(d);
    setTimeout(function () { try { d.querySelector('#mtr-h').focus({ preventScroll: true }); } catch (e) {} }, 40);
    function fechar(v) {
      if (fim) return; fim = true;
      d.remove(); marcados.forEach(function (el) { el.inert = false; });
      if (volta && document.contains(volta)) { try { volta.focus({ preventScroll: true }); } catch (e) {} }
      resolver(v);
    }
    d.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); fechar(null); return; }
      if (e.key !== 'Tab') return;
      var f = Array.prototype.slice.call(d.querySelectorAll('button:not([disabled])'));
      if (!f.length) { e.preventDefault(); return; }
      if (e.shiftKey && (document.activeElement === f[0] || document.activeElement === d.querySelector('#mtr-h'))) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    });
    d.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-i]'); if (!b) return;
      var bt = o.botoes[Number(b.dataset.i)];
      if (!bt.acao) { fechar(bt.valor); return; }
      Array.prototype.forEach.call(d.querySelectorAll('button'), function (x) { x.disabled = true; });
      d.querySelector('.mtr-e').textContent = '';
      bt.acao().then(function () { fechar(bt.valor); }, function (err) {
        Array.prototype.forEach.call(d.querySelectorAll('button'), function (x) { x.disabled = false; });
        d.querySelector('.mtr-e').textContent = (err && err.message) || 'Não foi possível salvar agora. Tente de novo.';
      });
    });
  });
}
var LINK_TURMA = 'medtechbr.com.br/turma.html';
function perguntar(t, o) {
  var curso = t.curso || 'seu curso';
  var html = '<p>Seu acesso foi liberado pelo <b>' + esc(curso) + '</b>' + (t.fim_s ? ', até ' + esc(dataBR(t.fim_s - 1)) : '') + '.</p>' +
    '<p>O ' + esc(curso) + ' pode acompanhar seu desempenho (questões feitas, acerto por área, simulados, último acesso). Você autoriza?</p>' +
    '<p class="mtr-m">Suas respostas, questão por questão, não vão para o curso. Sem autorização, o curso vê só se você ativou o acesso e números da turma inteira, sem o seu nome. Você pode mudar depois em Minha conta, na página da turma (' + LINK_TURMA + ').</p>';
  function salvar(sim) { return function () { return o.chamar('mtTurma', { acao: 'autorizar', turma: t.id, autoriza: sim, origem: 'app' }, o.user); }; }
  return dialogo({ titulo: 'Acesso liberado pelo seu curso', html: html, botoes: [
    /* "Agora não" nunca prende ninguém: se o servidor falhar, fecha e pergunta de novo outro dia */
    { rot: 'Agora não', cls: 'g', valor: 'nao', acao: function () { return salvar(false)().catch(function () {}); } },
    { rot: 'Autorizo', cls: 's', valor: 'sim', acao: salvar(true) }
  ] });
}
/* turma em que o curso não vê ninguém individualmente: só avisa, uma vez por aparelho */
function avisar(t) {
  var curso = t.curso || 'seu curso';
  return dialogo({ titulo: 'Acesso liberado pelo seu curso', html: '<p>Seu acesso foi liberado pelo <b>' + esc(curso) + '</b>' + (t.fim_s ? ', até ' + esc(dataBR(t.fim_s - 1)) : '') + '.</p>' +
    '<p class="mtr-m">O curso vê só se você ativou o acesso e números da turma inteira, sem o seu nome. Suas respostas não vão para o curso. Detalhes em Minha conta, na página da turma (' + LINK_TURMA + ').</p>',
    botoes: [{ rot: 'Entendi', cls: 's', valor: 'ok' }] });
}

/* ---------------- envio do resumo ---------------- */
var E = { iniciado: false, o: null, ultimoEnvio: 0, enviando: false };
function chaveResumo() { return 'mt.resumo.' + E.o.user.uid + '.' + E.o.appId; }
function enviar(forcar) {
  if (!E.o || E.enviando) return;
  var agora = Date.now();
  if (!forcar && agora - E.ultimoEnvio < INTERVALO_MS) return;
  var r = calcular(E.o.appId, agora);
  if (!r) return;
  var assinatura = JSON.stringify([r.q, r.a, r.areas, r.sim, r.dias, r.d7, r.d30, r.ult]);
  var ant = lsJson(chaveResumo());
  if (ant && ant.h === assinatura && agora - Number(ant.em || 0) < 24 * 3600000) { E.ultimoEnvio = agora; return; }
  E.enviando = true; E.ultimoEnvio = agora;
  E.o.chamar('mtTurma', { acao: 'resumo', app: E.o.appId, r: r }, E.o.user).then(function (res) {
    E.enviando = false;
    if (res && res.ok) lsSet(chaveResumo(), JSON.stringify({ h: assinatura, em: agora }));
  }, function () { E.enviando = false; });
}
function ligarEnvio() {
  setTimeout(function () { enviar(true); }, 8000);
  setInterval(function () { if (!document.hidden) enviar(false); }, INTERVALO_MS);
  document.addEventListener('visibilitychange', function () { if (document.hidden) enviar(false); });
}

/* o = {appId, user, P, mt, chamar} (chamar = MTAcesso.chamar) */
function iniciar(o) {
  if (E.iniciado || !o || !o.user || !o.appId || typeof o.chamar !== 'function') return;
  if (!(o.P && o.P.turmas === true)) return;
  var g = (o.mt && o.mt.g) || {};
  if (!Object.keys(g).length) return;
  E.iniciado = true; E.o = o;
  var ck = 'mt.turma.' + o.user.uid + '.' + o.appId, cache = lsJson(ck);
  var pronto = (cache && Date.now() - Number(cache.em || 0) < CACHE_MINHAS_MS && Array.isArray(cache.turmas))
    ? Promise.resolve({ turmas: cache.turmas })
    : o.chamar('mtTurma', { acao: 'minhas', app: o.appId }, o.user).then(function (r) {
        if (r && Array.isArray(r.turmas)) lsSet(ck, JSON.stringify({ em: Date.now(), turmas: r.turmas }));
        return r;
      });
  pronto.then(function (r) {
    var ts = ((r && r.turmas) || []).filter(function (t) { return t.vigente && (t.apps || []).indexOf(o.appId) > -1; });
    if (!ts.length) return;
    var fila = Promise.resolve();
    ts.forEach(function (t) {
      fila = fila.then(function () {
        if (t.verDesempenho && !t.autoriza) return perguntar(t, o).then(function (v) { if (v) { t.autoriza = v; lsSet(ck, null); } });
        var ka = 'mt.turma.aviso.' + o.user.uid + '.' + t.id;
        if (!t.verDesempenho && !lsGet(ka)) return avisar(t).then(function () { lsSet(ka, '1'); });
      });
    });
    fila.then(ligarEnvio, ligarEnvio);
  }).catch(function (e) { try { console.warn('MTResumo: turma não conferida agora', e && e.message); } catch (x) {} });
}

G.MTResumo = { versao: VERSAO, iniciar: iniciar, calcular: calcular, apps: function () { return Object.keys(MTRESUMO_ADAPT); }, _enviar: enviar };
})();
