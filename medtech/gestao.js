/* MedTech PWA: espaço Gestão, igual ao iPhone (MeuMes/PlantoesView, FinancasView, LancarView, MaisMes, ModelosMes, ComumGestao).
   Plantões: o próximo, quanto falta receber, o calendário onde se toca para lançar e a lista do mês.
   Finanças: entrou, saiu e saldo do mês, gastos por categoria e a lista.
   Os dados vêm de MTCofre (cofre.js), que lê e grava pelas próprias páginas do PlantãoHub e do Granaê.
   Liga-se à casca só por MedTechCasca.registrar('secao', ...). Clínica e Gestão não se misturam. */
(function () {
  'use strict';
  var W = window, D = document;
  var U = W.MTUI, esc = U.esc, C = W.MTCofre, Casca = W.MedTechCasca;
  if (!U || !C || !Casca) { console.error('gestao.js: falta ui.js, cofre.js ou casca.js'); return; }

  /* ---------- datas (DiaMes) ---------- */
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var SEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  var SEM_LONGO = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  function p2(n) { return String(n).padStart(2, '0'); }
  function iso(d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
  function data(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function criar(a, m, d) { return new Date(a, m, d); }   // como new Date(a, m, d) do JS: estouro de mês e dia permitido
  function hoje() { return iso(new Date()); }
  function primeira(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function mesExtenso(d) { return primeira(MESES[d.getMonth()]); }
  function mesCurto(d) { return primeira(MESES[d.getMonth()].slice(0, 3)); }
  function dm(d) { return p2(d.getDate()) + '/' + p2(d.getMonth() + 1); }
  function curto(s) { var d = data(s); return d ? dm(d) : s; }
  function completo(d) { return dm(d) + '/' + d.getFullYear(); }
  function somaDias(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function rotuloDia(s) {
    var d = data(s); if (!d) return s;
    var h = hoje();
    if (s === h) return 'Hoje';
    if (s === iso(somaDias(new Date(), -1))) return 'Ontem';
    if (s === iso(somaDias(new Date(), 1))) return 'Amanhã';
    return primeira(SEM[d.getDay()]) + ', ' + d.getDate() + ' de ' + MESES[d.getMonth()].slice(0, 3);
  }
  function diaLongo(d) { return SEM_LONGO[d.getDay()] + ', ' + d.getDate() + ' de ' + MESES[d.getMonth()]; }

  /* ---------- números (Double.real, realCheio, textoCampo, String.numeroCampo) ---------- */
  var F0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });
  var F2 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var FC = new Intl.NumberFormat('pt-BR', { useGrouping: false, maximumFractionDigits: 2 });
  var FH = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
  var FI = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
  function real(v) { v = +v || 0; return (v % 1 === 0 ? F0 : F2).format(v); }
  function realCheio(v) { return F2.format(+v || 0); }
  function textoCampo(v) { return !v ? '' : FC.format(v); }
  function numeroCampo(s) {
    var t = String(s == null ? '' : s).trim(); if (!t) return null;
    var n;
    if (t.indexOf(',') >= 0) n = Number(t.replace(/\./g, '').replace(',', '.'));
    else if (t.lastIndexOf('.') >= 0 && t.length - t.lastIndexOf('.') === 4) n = Number(t.replace(/\./g, ''));
    else n = Number(t);
    return isFinite(n) ? n : null;
  }
  function textoHoras(h) { return FH.format(h) + ' h'; }

  /* ---------- plantões: mesmas contas de compRange, regraPg, dataPg, previsaoDaComp e hoursOf do PlantãoHub ---------- */
  function compDayVal(p) { return Math.min(28, Math.max(1, p.compDay || 1)); }
  function comp(s, e, civil) { return { s: s, e: e, civil: civil, deS: iso(s), ateE: iso(e) }; }
  function contem(r, x) { return x >= r.deS && x <= r.ateE; }
  function mesCivil(ref) { return comp(criar(ref.getFullYear(), ref.getMonth(), 1), criar(ref.getFullYear(), ref.getMonth() + 1, 0), true); }
  function compRange(p, ref) {
    var cd = compDayVal(p);
    if (cd <= 1) return mesCivil(ref);
    var sy = ref.getFullYear(), sm = ref.getMonth();
    if (ref.getDate() < cd) { sm--; if (sm < 0) { sm = 11; sy--; } }
    return comp(criar(sy, sm, cd), criar(sy, sm + 1, cd - 1), false);
  }
  function moverComp(p, ref, n) { var s = compRange(p, ref).s; return criar(s.getFullYear(), s.getMonth() + n, s.getDate()); }
  function regraPg(p, local) {
    var m = (p.locais || {})[local] || {};
    var dia = m.pgDia != null ? m.pgDia : (p.pgDia != null ? p.pgDia : 10);
    var mes = m.pgMes != null ? m.pgMes : (p.pgMes != null ? p.pgMes : 1);
    return { dia: Math.min(28, Math.max(1, +dia || 10)), mes: Math.max(0, Math.min(6, +mes || 0)), proprio: m.pgDia != null || m.pgMes != null };
  }
  function dataPg(p, local, fim) { var g = regraPg(p, local); return criar(fim.getFullYear(), fim.getMonth() + g.mes, g.dia); }
  function previsaoDaComp(p, lista, r) {
    var ordem = [], soma = {};
    lista.forEach(function (s) {
      var k = s.local || 'Sem local';
      if (!soma[k]) { ordem.push(k); soma[k] = { t: 0, p: 0, n: 0 }; }
      soma[k].t += s.value || 0; soma[k].n++;
      if (s.status === 'pago') soma[k].p += s.value || 0;
    });
    return ordem.map(function (k, i) {
      return { i: i, local: k, total: soma[k].t, pago: soma[k].p, n: soma[k].n, aReceber: soma[k].t - soma[k].p, data: dataPg(p, k, r.e), regra: regraPg(p, k) };
    }).sort(function (a, b) { return a.data - b.data || a.i - b.i; });
  }
  function horasDe(a, b) {
    var i = String(a || '').split(':').map(Number), f = String(b || '').split(':').map(Number);
    if (i.length !== 2 || f.length !== 2 || i.some(isNaN) || f.some(isNaN)) return 0;
    var h = (f[0] * 60 + f[1]) - (i[0] * 60 + i[1]); if (h <= 0) h += 1440;
    return h / 60;
  }
  function pago(s) { return s.status === 'pago'; }
  function ordemPlantao(a, b) { return a.date === b.date ? ((a.start || '') < (b.start || '') ? -1 : (a.start || '') > (b.start || '') ? 1 : 0) : (a.date < b.date ? -1 : 1); }

  /* PainelPlantoes.calcular */
  function painelPlantoes(ref, p) {
    var r = compRange(p, ref), h = hoje();
    var m = { r: r, previsto: 0, recebido: 0, atrasado: 0, plantoes: [], previsao: [], marcas: {}, proximo: null };
    m.plantoes = p.shifts.filter(function (s) { return contem(r, s.date); }).sort(ordemPlantao);
    m.plantoes.forEach(function (s) { m.previsto += s.value || 0; if (pago(s)) m.recebido += s.value || 0; });
    m.faltaReceber = m.previsto - m.recebido;
    m.previsao = previsaoDaComp(p, m.plantoes, r).filter(function (x) { return x.aReceber > 0; });
    p.shifts.forEach(function (s) { if (!pago(s) && s.date < r.deS) m.atrasado += s.value || 0; });
    if (r.ateE >= h) {
      var desde = h > r.deS ? h : r.deS;
      p.shifts.filter(function (s) { return s.date >= desde; }).forEach(function (s) { if (!m.proximo || ordemPlantao(s, m.proximo) < 0) m.proximo = s; });
    }
    m.plantoes.forEach(function (s) { var k = m.marcas[s.date] || (m.marcas[s.date] = { aReceber: 0, pagos: 0 }); if (pago(s)) k.pagos++; else k.aReceber++; });
    return m;
  }

  /* ---------- dinheiro: compromissos(), parcelaInfo, chaveGrupo e proximaData do Granaê ---------- */
  var RE_PARCELA = /^(.*?)\s*(\()?\s*(\d{1,3})\s*\/\s*(\d{1,3})\s*(?:\))?\s*$/;
  function parcelaInfo(desc) {
    var m = RE_PARCELA.exec(desc || ''); if (!m) return null;
    var temP = !!m[2], kRaw = m[3], nRaw = m[4], k = +kRaw, n = +nRaw;
    if (!(n >= 2 && n <= 600 && k >= 1 && k <= n)) return null;
    if (!temP && (/^0\d/.test(kRaw) || /^0\d/.test(nRaw))) return null;
    var base = m[1].trim(); if (!base) return null;
    return { base: base, k: k, n: n };
  }
  function chaveGrupo(t) {
    if (t.groupId) return t.groupId;
    var pi = parcelaInfo(t.description); if (!pi) return null;
    return 'legado:' + t.type + ':' + pi.base.toLowerCase() + ':' + pi.n;
  }
  function compromissos(g) {
    var h = hoje(), grupos = new Map();
    g.transactions.forEach(function (t) { var k = chaveGrupo(t); if (!k) return; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(t); });
    g.commitments.forEach(function (c) { if (!grupos.has(c.id)) grupos.set(c.id, []); });
    var out = [];
    grupos.forEach(function (txs, id) {
      var meta = g.commitments.filter(function (c) { return c.id === id; })[0] || {};
      if (meta.kind === 'divida') {
        var pagos = txs.filter(function (t) { return !t.pending; });
        var pg = pagos.reduce(function (s, t) { return s + (+t.amount || 0); }, 0), total = +meta.total || 0;
        out.push({ id: id, kind: 'divida', divida: true, descricao: meta.descricao || 'Dívida', credor: meta.credor || null, categoria: (txs[0] && txs[0].category) || meta.category || 'Dívidas',
          n: null, pagas: pagos.length, restantes: null, valorParcela: 0, total: total, pago: pg, aPagar: Math.max(0, total - pg), estimado: false,
          ultima: txs.length ? txs[txs.length - 1].date : null, quitado: total > 0 && pg >= total - 0.005, txs: pagos });
        return;
      }
      if (!txs.length) return;
      txs = txs.slice().sort(function (a, b) { return (a.date || '').localeCompare(b.date || ''); });
      var pi = parcelaInfo(txs[0].description) || {};
      var n = meta.nParcelas || pi.n || txs.length;
      var valorParcela = +txs[txs.length - 1].amount || +txs[0].amount || 0;
      var completoG = txs.length >= n;
      var ja = txs.filter(function (t) { return !t.pending && t.date <= h; });
      var maiorK = txs.reduce(function (mx, t) { var pj = parcelaInfo(t.description); return pj && (!t.pending && t.date <= h) ? Math.max(mx, pj.k) : mx; }, 0);
      var pagas = Math.min(n, completoG ? ja.length : Math.max(maiorK, ja.length));
      var soma = completoG ? txs.reduce(function (s, t) { return s + (+t.amount || 0); }, 0) : valorParcela * n;
      var pg2 = completoG ? ja.reduce(function (s, t) { return s + (+t.amount || 0); }, 0) : valorParcela * pagas;
      var ultima = (function () {
        var u = txs[txs.length - 1];
        if (completoG) return u.date;
        var pj = parcelaInfo(u.description), restam = pj ? (n - pj.k) : Math.max(0, n - txs.length);
        var d = new Date(u.date + 'T00:00:00'); d.setMonth(d.getMonth() + restam);
        return d.toISOString().slice(0, 10);
      })();
      out.push({ id: id, kind: meta.kind || 'parcelamento', divida: false, descricao: meta.descricao || pi.base || txs[0].description, credor: null, categoria: txs[0].category,
        n: n, pagas: pagas, restantes: Math.max(0, n - pagas), valorParcela: valorParcela, total: meta.total != null ? +meta.total : soma, pago: pg2,
        aPagar: meta.saldoDevedor != null ? +meta.saldoDevedor : Math.max(0, soma - pg2), estimado: !completoG && meta.saldoDevedor == null,
        ultima: ultima, quitado: pagas >= n, txs: txs });
    });
    return out.sort(function (a, b) { return (a.quitado - b.quitado) || (a.ultima || '').localeCompare(b.ultima || ''); });
  }
  function proximaData(u) {
    var d = data(u); if (!d) return hoje();
    var ultimoDia = criar(d.getFullYear(), d.getMonth() + 2, 0).getDate();
    return iso(criar(d.getFullYear(), d.getMonth() + 1, Math.min(d.getDate(), ultimoDia)));
  }
  function ativoEm(f, m1a12) { return f.frequency === 'yearly' ? f.month === m1a12 : true; }

  /* PainelFinancas.calcular: só dinheiro, no mês civil como o Granaê. Agendados e transferências ficam fora dos totais. */
  function painelFinancas(ref, g) {
    var r = mesCivil(ref);
    var m = { r: r, entrou: 0, saiu: 0, entrar: 0, sair: 0, lancamentos: [], categorias: [] };
    m.lancamentos = g.transactions.filter(function (t) { return contem(r, t.date) && !t.transferId; });
    var porCat = {};
    m.lancamentos.forEach(function (t) {
      if (t.pending) { if (t.type === 'income') m.entrar += t.amount; else m.sair += t.amount; }
      else if (t.type === 'income') m.entrou += t.amount;
      else { m.saiu += t.amount; porCat[t.category] = (porCat[t.category] || 0) + t.amount; }
    });
    m.saldo = m.entrou - m.saiu;
    var mesRef = r.e.getMonth() + 1, teto = {};
    g.fixedItems.forEach(function (f) { if (f.type === 'expense' && ativoEm(f, mesRef)) teto[f.category] = (teto[f.category] || 0) + f.amount; });
    g.categories.forEach(function (c) { if (c.type === 'expense' && c.goal > 0) teto[c.name] = c.goal; });
    var nomes = {}; Object.keys(porCat).concat(Object.keys(teto)).forEach(function (k) { nomes[k] = 1; });
    m.categorias = Object.keys(nomes).map(function (k) { return { nome: k, gasto: porCat[k] || 0, teto: teto[k] || 0 }; })
      .sort(function (a, b) { return a.gasto === b.gasto ? (a.nome < b.nome ? -1 : a.nome > b.nome ? 1 : 0) : b.gasto - a.gasto; });
    return m;
  }

  /* ---------- peças comuns (ComumGestao) ---------- */
  var COR = { plantao: 'var(--g-pl)', dinheiro: 'var(--g-fi)' };
  function reduz() { return U.reduz(); }
  function vazio(largura) { return '<span class="g-espera" style="width:' + (largura || 120) + 'px" aria-label="Carregando"></span>'; }

  /* Trocar de mês por arrasto (GiroMes + ArrastoHorizontal): o conteúdo acompanha o dedo; ao soltar depois de 70 px, troca. */
  function arrastoMes(raiz, seletor, alvoMove, trocar) {
    var st = null, fim = 0;
    raiz.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      var z = e.target.closest(seletor); if (!z || e.target.closest('.g-linha')) return;
      st = { x: e.clientX, y: e.clientY, id: e.pointerId, trava: null, dx: 0 };
    });
    raiz.addEventListener('pointermove', function (e) {
      if (!st || e.pointerId !== st.id) return;
      var dx = e.clientX - st.x, dy = e.clientY - st.y;
      if (st.trava == null && (Math.abs(dx) > 12 || Math.abs(dy) > 12)) st.trava = Math.abs(dx) > Math.abs(dy) * 1.3;
      if (st.trava) {
        st.dx = dx;
        var a = alvoMove(); if (a && !reduz()) { a.style.transition = 'none'; a.style.transform = 'translateX(' + dx + 'px)'; a.style.opacity = String(1 - Math.min(0.55, Math.abs(dx) / 700)); }
      }
    });
    function solta(e) {
      if (!st || (e && e.pointerId !== st.id)) return;
      var s = st; st = null;
      if (!s.trava) return;
      fim = Date.now();
      var a = alvoMove();
      if (a) { a.style.transition = reduz() ? 'none' : 'transform .3s var(--mola), opacity .2s'; a.style.transform = ''; a.style.opacity = ''; }
      if (e && e.type === 'pointerup' && Math.abs(s.dx) > 70) trocar(s.dx < 0 ? 1 : -1);
    }
    raiz.addEventListener('pointerup', solta);
    raiz.addEventListener('pointercancel', solta);
    // soltar o dedo depois de arrastar não vale como toque no que está embaixo
    raiz.addEventListener('click', function (e) { if (Date.now() - fim < 350) { e.stopPropagation(); e.preventDefault(); } }, true);
    return { acabou: function () { return Date.now() - fim < 350; } };
  }

  /* Linha que se arrasta (LinhaDeslizante): a ação só dispara ao soltar depois do limite. */
  function linhasDeslizantes(raiz, acoes) {
    var st = null, fim = 0, LIM = 92;
    raiz.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      var l = e.target.closest('.g-linha'); if (!l || !raiz.contains(l)) return;
      st = { l: l, c: l.querySelector('.g-lc'), x: e.clientX, y: e.clientY, id: e.pointerId, trava: null, dx: 0, passou: false };
    });
    raiz.addEventListener('pointermove', function (e) {
      if (!st || e.pointerId !== st.id) return;
      var dx = e.clientX - st.x, dy = e.clientY - st.y;
      if (st.trava == null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) st.trava = Math.abs(dx) > Math.abs(dy) * 1.3;
      if (!st.trava) return;
      var a = acoes(st.l);
      if ((dx > 0 && !a.direita) || (dx < 0 && !a.esquerda)) dx = 0;
      var v = Math.abs(dx) <= LIM ? dx : (dx > 0 ? 1 : -1) * (LIM + (Math.abs(dx) - LIM) * 0.45);
      st.dx = dx; st.passou = Math.abs(dx) >= LIM;
      st.c.style.transition = 'none'; st.c.style.transform = 'translateX(' + v + 'px)';
      st.l.dataset.lado = dx > 0 ? 'direita' : dx < 0 ? 'esquerda' : '';
      st.l.classList.toggle('passou', st.passou);
    });
    function solta(e) {
      if (!st || (e && e.pointerId !== st.id)) return;
      var s = st; st = null;
      if (!s.trava) return;
      fim = Date.now();
      s.c.style.transition = reduz() ? 'none' : 'transform .3s var(--mola)'; s.c.style.transform = '';
      setTimeout(function () { s.l.dataset.lado = ''; s.l.classList.remove('passou'); }, reduz() ? 0 : 260);
      if (e && e.type === 'pointerup' && s.passou) { var a = acoes(s.l), x = s.dx > 0 ? a.direita : a.esquerda; if (x) x.executar(); }
    }
    raiz.addEventListener('pointerup', solta);
    raiz.addEventListener('pointercancel', solta);
    raiz.addEventListener('click', function (e) { if (Date.now() - fim < 350 && e.target.closest('.g-linha')) { e.stopPropagation(); e.preventDefault(); } }, true);
  }
  function linhaDeslizante(dados, direita, esquerda, conteudo) {
    return '<div class="g-linha" ' + dados + '>' +
      (direita ? '<span class="g-fundo g-dir" style="background:' + direita.cor + '">' + esc(direita.rotulo) + '</span>' : '') +
      (esquerda ? '<span class="g-fundo g-esq" style="background:' + esquerda.cor + '">' + esc(esquerda.rotulo) + '</span>' : '') +
      '<div class="g-lc" role="button" tabindex="0" data-acao="editar">' + conteudo + '</div></div>';
  }

  /* Cabeça do mês (CabecaMes): o ano e Mais opções em cima; o mês no meio e os vizinhos dos lados. */
  function cabecaMes(o) {
    return '<div class="g-cabeca"><div class="g-cab1"><span class="g-ano">' + esc(o.ano) + '</span>' +
      '<button type="button" class="g-mais" data-acao="mais" style="color:' + o.corMais + '">Mais opções</button></div>' +
      '<div class="g-cab2"><button type="button" class="g-viz" data-acao="mes" data-n="-1" aria-label="Mês anterior">' + esc(o.anterior) + '</button>' +
      '<h1 class="g-titulo" aria-live="polite">' + esc(o.titulo) + '</h1>' +
      '<button type="button" class="g-viz dir" data-acao="mes" data-n="1" aria-label="Mês seguinte">' + esc(o.seguinte) + '</button></div></div>';
  }
  function faixa(nome) {
    var f = C.textoBloqueio(nome); if (!f) return '';
    return '<div class="g-faixa" role="status"><span>' + esc(f) + '</span>' + (C.podeTentar(nome) ? '<button type="button" data-acao="tentar">Tentar de novo</button>' : '') + '</div>';
  }

  /* Aviso no pé (BarraAvisoMes + TempoDoAviso): some sozinho; com Desfazer fica mais tempo. */
  function mostraAviso(sec, a) {
    var lugar = sec.querySelector('.g-aviso-lugar'); if (!lugar) return;
    clearTimeout(sec._tAviso);
    lugar.innerHTML = '<div class="g-aviso' + (a.erro ? ' erro' : '') + '" role="' + (a.erro ? 'alert' : 'status') + '"><span>' + esc(a.texto) + '</span>' +
      (a.desfazer ? '<button type="button" class="g-desfazer">Desfazer</button>' : '') + '</div>';
    var b = lugar.querySelector('.g-desfazer');
    if (b) b.addEventListener('click', function () { lugar.innerHTML = ''; a.desfazer(); });
    sec._tAviso = setTimeout(function () { lugar.innerHTML = ''; }, a.desfazer ? 7000 : 4000);
  }
  function erroAviso(sec, e) { mostraAviso(sec, { texto: (e && e.message) || String(e), erro: true }); }

  /* Folha com topo (TopoFolha): Fechar à esquerda, título no meio. */
  function topo(titulo, esquerda, direita) {
    return '<div class="g-topo"><button type="button" class="g-topo-bt" data-topo="esq">' + esc(esquerda || 'Fechar') + '</button>' +
      '<h2 class="g-topo-t" data-foco tabindex="-1">' + esc(titulo || '') + '</h2>' +
      (direita ? '<button type="button" class="g-topo-bt dir" data-topo="dir">' + esc(direita) + '</button>' : '<span class="g-topo-vazio"></span>') + '</div>';
  }
  /* Repinta uma folha aberta quando os dados mudam (as telas do iPhone observam o cofre). */
  function vigiaCofre(api, fn) {
    var h = function () { if (api.el.isConnected) fn(); };
    D.addEventListener('medtech:cofre', h);
    return function () { D.removeEventListener('medtech:cofre', h); };
  }

  /* =====================================================================
     PLANTÕES (PlantoesView)
     ===================================================================== */
  var P = { el: null, ref: new Date(), diaSel: null, faltaAberta: false, copiado: null, painel: null, giro: null };

  function montaPlantoes(el) {
    P.el = el;
    el.classList.add('g-secao', 'g-plantoes');
    el.innerHTML = '<div class="rola-secao g-rola"></div><div class="g-aviso-lugar" aria-live="polite"></div>' +
      '<div class="g-pe"><button type="button" class="g-acao" data-acao="lancar"></button></div>';
    desenhaPlantoes();
    C.ligar('plantao');
    if (el.__gestao) return;
    el.__gestao = 1;
    el.addEventListener('click', cliquePlantoes);
    el.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('g-lc')) { e.preventDefault(); e.target.click(); } });
    P.giro = arrastoMes(el, '.g-giro, .g-cab2', function () { return el.querySelector('.g-desliza'); }, trocarMesP);
    linhasDeslizantes(el, function (l) {
      var s = achaPlantao(l.dataset.id); if (!s) return {};
      return { direita: { executar: function () { alternar(s); } }, esquerda: { executar: function () { excluirP(s); } } };
    });
    diasComToqueLongo(el);
  }
  function achaPlantao(id) { return C.plantao.shifts.filter(function (s) { return s.id === id; })[0] || null; }

  function nomeComp(r) { return r.civil ? mesExtenso(r.s) : dm(r.s) + ' a ' + dm(r.e); }
  function vizinhoP(n) { var r = compRange(C.plantao, moverComp(C.plantao, P.ref, n)); return r.civil ? mesCurto(r.s) : dm(r.s); }

  function desenhaPlantoes() {
    var el = P.el; if (!el) return;
    var p = C.plantao, m = P.painel = painelPlantoes(P.ref, p), tem = C.temPlantoes, r = m.r;
    var rola = el.querySelector('.g-rola'); if (!rola) return;
    var h = cabecaMes({ titulo: nomeComp(r), ano: r.civil ? String(r.s.getFullYear()) : 'Período ' + r.e.getFullYear(), anterior: vizinhoP(-1), seguinte: vizinhoP(1), corMais: 'var(--g-pl-tx)' });
    h += faixa('plantao');
    h += '<div class="g-desliza"><div class="g-giro">';
    // próximo plantão
    if (m.proximo) {
      var x = m.proximo;
      h += '<button type="button" class="g-proximo" data-acao="editar-id" data-id="' + esc(x.id) + '"><span class="g-px-e"><small>Próximo plantão</small><b>' + esc(rotuloDia(x.date)) + '</b></span>' +
        '<span class="g-px-d"><b>' + esc(x.local) + '</b>' + (x.start && x.end ? '<small>' + esc(x.start) + ' às ' + esc(x.end) + '</small>' : '') + '</span></button>';
    }
    // falta receber
    var nota = m.previsao.length ? 'Próximo crédito: ' + real(m.previsao[0].aReceber) + ' em ' + dm(m.previsao[0].data) : (m.plantoes.length ? 'Tudo deste período já foi recebido' : 'Nenhum plantão neste período');
    h += '<div class="g-cartao"><button type="button" class="g-num" data-acao="falta" aria-expanded="' + P.faltaAberta + '"' + (tem ? '' : ' disabled') + '>' +
      '<span class="g-num-l"><span class="g-num-t">Falta receber</span><span class="g-num-v grande" style="color:var(--g-pl-tx)">' + (tem ? real(m.faltaReceber) : vazio(130)) + '</span></span>' +
      (tem ? '<span class="g-num-nota">' + esc(nota) + '</span>' : '') + '</button>';
    if (P.faltaAberta && tem) {
      var pct = m.previsto > 0 ? m.recebido / m.previsto : 0;
      h += '<div class="g-detalhe"><div class="g-trilho" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(pct * 100) + '" aria-label="Recebido do previsto"><i style="width:' + (pct > 0 ? 'max(10px,' + (pct * 100) + '%)' : '0') + ';background:var(--g-pl)"></i></div>' +
        '<p class="g-t2">' + real(m.recebido) + ' recebidos de ' + real(m.previsto) + ' previstos</p>' +
        m.previsao.map(function (x) {
          return '<button type="button" class="g-prev" data-acao="regra" data-local="' + esc(x.local) + '"><b style="color:var(--g-pl-tx)">' + dm(x.data) + '</b><span class="g-prev-m"><span>' + esc(x.local) + '</span><small>' + (x.regra.proprio ? 'Regra deste local' : 'Regra padrão') + '</small></span><span class="g-prev-v">' + real(x.aReceber) + '</span></button>';
        }).join('') +
        (m.atrasado > 0 ? '<p class="g-alerta-tx">' + real(m.atrasado) + ' de períodos anteriores ainda não marcados como pagos.</p>' : '') +
        '<p class="g-miuda">Estimativa pela regra de cada local, contada do fim do período. Toque num local para ajustar.</p></div>';
    }
    h += '</div>';
    // calendário
    h += '<div class="g-cal" id="gCalendario">';
    if (P.copiado) h += '<div class="g-colar"><span>Toque nos dias para colar ' + esc(curto(P.copiado.de)) + '</span><button type="button" data-acao="parar">Parar</button></div>';
    h += '<div class="g-sem" aria-hidden="true">' + ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(function (l) { return '<span>' + l + '</span>'; }).join('') + '</div><div class="g-grade">';
    var ini = somaDias(r.s, -r.s.getDay()), fim = somaDias(r.e, 6 - r.e.getDay()), hj = hoje();
    for (var d = ini; d <= fim; d = somaDias(d, 1)) {
      var di = iso(d), dentro = contem(r, di), mk = m.marcas[di] || { aReceber: 0, pagos: 0 }, sel = P.diaSel === di;
      var pg = mk.pagos > 0 && mk.aReceber === 0, tp = mk.pagos + mk.aReceber > 0;
      var cls = 'g-dia' + (dentro ? '' : ' fora') + (pg ? ' pago' : tp ? ' tem' : '') + (sel ? ' sel' : di === hj ? ' hoje' : '') + (tp || di === hj ? ' forte' : '');
      var rot = [diaLongo(d)]; if (mk.aReceber) rot.push(mk.aReceber + ' plantão a receber'); if (mk.pagos) rot.push(mk.pagos + ' plantão recebido');
      h += '<button type="button" class="' + cls + '" data-dia="' + di + '" aria-label="' + esc(rot.join(', ')) + '"' + (sel ? ' aria-pressed="true"' : '') + '>' + d.getDate() + '</button>';
    }
    h += '</div><div class="g-legenda" aria-hidden="true"><span><i style="background:var(--g-pl)"></i>Recebido</span><span><i class="tinto"></i>A receber</span></div></div>';
    h += '</div>';   // g-giro
    // lista
    var itens = m.plantoes.filter(function (s) { return !P.diaSel || s.date === P.diaSel; });
    h += '<div class="g-lista" id="gListaP"><h2 class="g-h2">' + esc(P.diaSel ? rotuloDia(P.diaSel) : 'Lista do mês') + '</h2>';
    if (!itens.length) h += '<p class="g-vaziotx">' + (P.diaSel ? 'Sem plantão neste dia.' : 'Sem plantão neste período.') + '</p>';
    else h += '<div class="g-sup">' + itens.map(function (s) {
      var dd = data(s.date);
      return linhaDeslizante('data-id="' + esc(s.id) + '"', { rotulo: pago(s) ? 'A receber' : 'Recebido', cor: 'var(--g-pl)' }, { rotulo: 'Excluir', cor: 'var(--g-al)' },
        '<span class="g-lp-dia"><b style="color:var(--g-pl-tx)">' + (dd ? dd.getDate() : '') + '</b><small>' + (dd ? SEM[dd.getDay()] : '') + '</small></span>' +
        '<span class="g-lp-m"><b>' + esc(s.local) + '</b><small>' + esc(s.start && s.end ? s.start + ' às ' + s.end + ', ' + textoHoras(horasDe(s.start, s.end)) : 'Plantão') + '</small></span>' +
        '<span class="g-lp-v"><b>' + real(s.value || 0) + '</b><small' + (pago(s) ? ' style="color:var(--g-pl-tx)"' : '') + '>' + (pago(s) ? 'Recebido' : 'A receber') + '</small></span>');
    }).join('') + '</div>';
    h += '</div></div>';   // g-lista, g-desliza
    var topoAntes = rola.scrollTop;
    rola.innerHTML = h;
    rola.scrollTop = topoAntes;
    var bt = el.querySelector('.g-acao'), trav = !!C.bloqueio('plantao');
    bt.textContent = P.diaSel ? 'Lançar plantão em ' + curto(P.diaSel) : 'Lançar plantão';
    bt.classList.toggle('travado', trav);
    bt.style.background = trav ? '' : 'var(--g-pl)';
  }

  function trocarMesP(n) { P.ref = moverComp(C.plantao, P.ref, n); P.diaSel = null; desenhaPlantoes(); }

  function cliquePlantoes(e) {
    var a = e.target.closest('[data-acao], [data-dia]'); if (!a || !P.el.contains(a)) return;
    if (a.dataset.dia) return tocouDia(a.dataset.dia);
    var acao = a.dataset.acao;
    if (acao === 'mes') return trocarMesP(+a.dataset.n);
    if (acao === 'mais') return abreMaisPlantoes();
    if (acao === 'tentar') return C.tentarDeNovo('plantao');
    if (acao === 'falta') { if (!C.temPlantoes) return; P.faltaAberta = !P.faltaAberta; return desenhaPlantoes(); }
    if (acao === 'regra') return abreRegra(a.dataset.local);
    if (acao === 'parar') { P.copiado = null; return desenhaPlantoes(); }
    if (acao === 'editar-id') { var s0 = achaPlantao(a.dataset.id); if (s0) folhaPlantao({ editar: s0 }); return; }
    if (acao === 'editar') { var l = a.closest('.g-linha'), s = l && achaPlantao(l.dataset.id); if (s) folhaPlantao({ editar: s }); return; }
    if (acao === 'lancar') {
      var b = C.bloqueio('plantao'); if (b) return mostraAviso(P.el, { texto: b, erro: true });
      return folhaPlantao({ dia: P.diaSel });
    }
  }

  function tocouDia(di) {
    if (P.giro && P.giro.acabou()) return;
    if (P.copiado) {
      if (di === P.copiado.de) return;
      C.colarDia(P.copiado.itens, di).then(function () { mostraAviso(P.el, { texto: 'Colado em ' + curto(di) }); }, function (e) { erroAviso(P.el, e); });
      return;
    }
    var escolheu = P.diaSel !== di;
    P.diaSel = escolheu ? di : null;
    desenhaPlantoes();
    var f = P.el.querySelector('[data-dia="' + di + '"]'); if (f) f.focus({ preventScroll: true });
    // Sobe o calendário para o dia e o que há nele ficarem à vista.
    if (escolheu) { var cal = P.el.querySelector('#gCalendario'); if (cal) cal.scrollIntoView({ block: 'start', behavior: reduz() ? 'auto' : 'smooth' }); }
  }

  /* Toque longo num dia (o contextMenu do iPhone): copiar os plantões do dia e lançar nele. */
  function diasComToqueLongo(el) {
    var t = null, x0 = 0, y0 = 0, longo = false;
    el.addEventListener('pointerdown', function (e) {
      var c = e.target.closest('.g-dia'); if (!c) return;
      longo = false; x0 = e.clientX; y0 = e.clientY;
      clearTimeout(t);
      t = setTimeout(function () { longo = true; menuDia(c.dataset.dia); }, 520);
    });
    el.addEventListener('pointermove', function (e) { if (t && (Math.abs(e.clientX - x0) > 10 || Math.abs(e.clientY - y0) > 10)) { clearTimeout(t); t = null; } });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (k) { el.addEventListener(k, function () { clearTimeout(t); t = null; }); });
    el.addEventListener('click', function (e) { if (longo && e.target.closest('.g-dia')) { longo = false; e.stopPropagation(); e.preventDefault(); } }, true);
    el.addEventListener('contextmenu', function (e) { var c = e.target.closest('.g-dia'); if (!c) return; e.preventDefault(); clearTimeout(t); if (!longo) menuDia(c.dataset.dia); });
  }
  function menuDia(di) {
    var l = C.plantao.shifts.filter(function (s) { return s.date === di; });
    U.folha({
      titulo: rotuloDia(di), classe: 'g-folha g-menu',
      conteudo: function (c, api) {
        c.innerHTML = '<h2 class="g-menu-t" data-foco tabindex="-1">' + esc(rotuloDia(di)) + '</h2><div class="g-sup">' +
          (l.length ? '<button type="button" class="g-opcao" data-o="copiar">Copiar os plantões deste dia</button>' : '') +
          '<button type="button" class="g-opcao" data-o="lancar">Lançar plantão neste dia</button></div><button type="button" class="g-linhabt" data-o="fechar">Cancelar</button>';
        c.addEventListener('click', function (e) {
          var b = e.target.closest('[data-o]'); if (!b) return;
          api.fechar();
          if (b.dataset.o === 'copiar') { P.copiado = { de: di, itens: l }; desenhaPlantoes(); }
          if (b.dataset.o === 'lancar') { if (C.bloqueio('plantao')) return mostraAviso(P.el, { texto: C.bloqueio('plantao'), erro: true }); folhaPlantao({ dia: di }); }
        });
      }
    });
  }

  function alternar(s) {
    C.alternarPago(s.id).then(function () { mostraAviso(P.el, { texto: pago(s) ? 'Voltou para a receber' : 'Marcado como recebido' }); }, function (e) { erroAviso(P.el, e); });
  }
  function excluirP(s) {
    C.excluirPlantao(s.id).then(function (copia) {
      mostraAviso(P.el, { texto: 'Plantão excluído', desfazer: function () { C.restaurarPlantao(copia).catch(function (e) { erroAviso(P.el, e); }); } });
    }, function (e) { erroAviso(P.el, e); });
  }

  /* ---------- FolhaPlantao + FormPlantao ---------- */
  function folhaPlantao(pedido) {
    var o = pedido.editar || null, p = C.plantao;
    var f = { data: o ? o.date : (pedido.dia || hoje()), local: o ? o.local : '', inicio: (o && o.start) || '19:00', fim: (o && o.end) || '07:00',
      valor: o ? textoCampo(o.value || 0) : '', pago: o ? pago(o) : false, nota: (o && o.note) || '' };
    var vistos = [];
    p.shifts.slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; }).forEach(function (s) { if (s.local && vistos.indexOf(s.local) < 0) vistos.push(s.local); });
    Object.keys(p.locais).sort().forEach(function (k) { if (vistos.indexOf(k) < 0) vistos.push(k); });
    var recentes = vistos.slice(0, 8);
    U.folha({
      titulo: o ? 'Editar plantão' : 'Novo plantão', classe: 'g-folha g-fp', alta: true,
      conteudo: function (c, api) {
        var salvando = false;
        c.innerHTML = topo(o ? 'Editar plantão' : 'Novo plantão') + '<p class="g-erro" role="alert" hidden></p>' +
          '<div class="g-form"><span class="g-rot" id="gfpOnde">Onde</span>' +
          (recentes.length ? '<div class="g-chips" role="group" aria-labelledby="gfpOnde">' + recentes.map(function (l) { return '<button type="button" class="g-chip" data-local="' + esc(l) + '">' + esc(l) + '</button>'; }).join('') + '</div>' : '') +
          '<input class="g-campo" name="local" type="text" placeholder="Outro local" aria-label="Local" autocomplete="off" value="' + esc(f.local) + '">' +
          '<div class="g-tres"><label><span class="g-rot">Dia</span><input class="g-campo" name="data" type="date" required value="' + esc(f.data) + '"></label>' +
          '<label><span class="g-rot">Início</span><input class="g-campo" name="inicio" type="time" value="' + esc(f.inicio) + '"></label>' +
          '<label><span class="g-rot">Fim</span><input class="g-campo" name="fim" type="time" value="' + esc(f.fim) + '"></label></div>' +
          '<label class="g-rot" for="gfpValor">Valor</label><div class="g-valor"><span aria-hidden="true">R$</span><input id="gfpValor" name="valor" type="text" inputmode="decimal" placeholder="0" autocomplete="off" value="' + esc(f.valor) + '"></div>' +
          '<p class="g-t2 g-resumo"></p>' +
          '<div class="g-dois" role="group" aria-label="Situação"><button type="button" class="g-alt" data-pago="0">A receber</button><button type="button" class="g-alt" data-pago="1">Recebido</button></div>' +
          '<textarea class="g-campo g-nota" name="nota" rows="2" placeholder="Observação (opcional)" aria-label="Observação">' + esc(f.nota) + '</textarea>' +
          (o ? '<div class="g-dois"><button type="button" class="g-linhabt" data-x="dup" style="color:var(--g-pl-tx)">Duplicar em 7 dias</button><button type="button" class="g-linhabt" data-x="exc" style="color:var(--g-al-tx)">Excluir</button></div>' : '') +
          '</div><div class="g-folha-pe"><button type="button" class="g-cheio" data-x="salvar" style="background:var(--g-pl)">' + (o ? 'Salvar' : 'Lançar plantão') + '</button></div>';
        var q = function (s) { return c.querySelector(s); };
        var inLocal = q('[name=local]'), inValor = q('[name=valor]'), inIni = q('[name=inicio]'), inFim = q('[name=fim]'), inData = q('[name=data]');
        var erro = q('.g-erro');
        function pinta() {
          c.querySelectorAll('.g-chip').forEach(function (b) { var s = b.dataset.local === inLocal.value; b.classList.toggle('sel', s); b.setAttribute('aria-pressed', s); });
          c.querySelectorAll('.g-alt').forEach(function (b) { var s = (b.dataset.pago === '1') === f.pago; b.classList.toggle('sel', s); b.setAttribute('aria-pressed', s); });
          var h = horasDe(inIni.value, inFim.value), v = numeroCampo(inValor.value) || 0;
          q('.g-resumo').textContent = v > 0 && h > 0 ? textoHoras(h) + ', ' + realCheio(v) + ' (' + realCheio(v / h) + ' por hora)' : textoHoras(h);
        }
        /* fillLocal: horário sempre vem do local; o valor só quando o campo está vazio. */
        function doLocal(l) {
          var m = p.locais[l]; if (!m) return;
          if (o && o.local === l) return;
          if (m.start) inIni.value = m.start;
          if (m.end) inFim.value = m.end;
          if (!inValor.value && m.value) inValor.value = textoCampo(m.value);
        }
        inLocal.addEventListener('input', function () { doLocal(inLocal.value); pinta(); });
        [inValor, inIni, inFim].forEach(function (x) { x.addEventListener('input', pinta); });
        c.addEventListener('click', function (e) {
          var b = e.target.closest('button'); if (!b) return;
          if (b.dataset.topo) return api.fechar();
          if (b.dataset.local != null) { inLocal.value = b.dataset.local; doLocal(b.dataset.local); return pinta(); }
          if (b.dataset.pago != null) { f.pago = b.dataset.pago === '1'; return pinta(); }
          if (b.dataset.x === 'salvar') return salvar();
          if (b.dataset.x === 'dup') return C.duplicarPlantao(o.id).then(function (d) { terminar('Duplicado para ' + curto(d), null, d); }, mostraErro);
          if (b.dataset.x === 'exc') return U.confirma('Excluir este plantão?', o.local + ', ' + curto(o.date) + '.', [
            { rotulo: 'Excluir', perigo: true, acao: function () { C.excluirPlantao(o.id).then(function (copia) { terminar('Plantão excluído', function () { C.restaurarPlantao(copia).catch(function (x) { erroAviso(P.el, x); }); }, null); }, mostraErro); } },
            { rotulo: 'Cancelar' }]);
        });
        function mostraErro(e) { salvando = false; q('[data-x=salvar]').disabled = false; erro.textContent = (e && e.message) || String(e); erro.hidden = false; }
        function terminar(texto, desfazer, foiPara) {
          api.fechar();
          if (foiPara && P.painel && !contem(P.painel.r, foiPara)) { var d = data(foiPara); if (d) { P.ref = d; P.diaSel = null; desenhaPlantoes(); } }
          mostraAviso(P.el, { texto: texto, desfazer: desfazer });
        }
        function salvar() {
          if (salvando) return;
          if (!inData.value) { erro.textContent = 'Informe o dia do plantão.'; erro.hidden = false; inData.focus(); return; }
          erro.hidden = true;
          var r = { id: o ? o.id : null, date: inData.value, local: inLocal.value, start: inIni.value || '19:00', end: inFim.value || '07:00', value: numeroCampo(inValor.value) || 0, status: f.pago ? 'pago' : 'agendado', note: q('[name=nota]').value.trim() };
          salvando = true; q('[data-x=salvar]').disabled = true;
          C.salvarPlantao(r).then(function () { terminar(o ? 'Plantão atualizado' : 'Plantão lançado em ' + curto(r.date), null, r.date); }, mostraErro);
        }
        pinta();
      }
    });
  }

  /* ---------- Mais opções (MaisPlantoesView, LocaisView, AnoPlantoesView, RegraPagamentoView) ---------- */
  function folhaMais(cor, raizHTML, telas, reservas) {
    var solta = null;
    U.folha({
      titulo: 'Mais opções', classe: 'g-folha g-mais-f', alta: true,
      conteudo: function (c, api) {
        var pilha = [];
        function pinta() {
          var t = pilha[pilha.length - 1];
          var h = '<div class="g-topo"><span class="g-topo-esq">' + (t ? '<button type="button" class="g-topo-bt" data-volta="1" aria-label="Voltar para Mais opções" style="color:' + cor + '">Voltar</button>' : '') + '</span>' +
            '<h2 class="g-topo-t" data-foco tabindex="-1">' + esc(t ? telas[t.id].titulo : 'Mais opções') + '</h2><button type="button" class="g-topo-bt dir" data-fechar="1" style="color:' + cor + '">Fechar</button></div>';
          if (!t) {
            h += '<div class="g-sup">' + raizHTML() + '</div>';
            h += '<p class="g-rot g-rot-fora">Abrem o site</p><div class="g-sup">' + reservas.map(function (r) { return '<a class="g-opcao" href="' + esc(r.href) + '">' + esc(r.titulo) + '</a>'; }).join('') + '</div>';
          } else h += telas[t.id].html(t);
          var y = c.scrollTop;
          c.innerHTML = h;
          c.scrollTop = t && t.rolou === false ? 0 : y;
          if (t) t.rolou = true;
        }
        c.addEventListener('click', function (e) {
          var b = e.target.closest('button, a'); if (!b) return;
          if (b.dataset.fechar) return api.fechar();
          if (b.dataset.volta) { pilha.pop(); pinta(); var f = c.querySelector('[data-foco]'); if (f) f.focus({ preventScroll: true }); return; }
          if (b.dataset.tela) { pilha.push({ id: b.dataset.tela, rolou: false }); pinta(); var g = c.querySelector('[data-foco]'); if (g) g.focus({ preventScroll: true }); return; }
          var t = pilha[pilha.length - 1];
          if (t && telas[t.id].clique) telas[t.id].clique(b, t, pinta, e);
        });
        c.addEventListener('change', function (e) { var t = pilha[pilha.length - 1]; if (t && telas[t.id].muda) telas[t.id].muda(e.target, t, pinta); });
        solta = vigiaCofre(api, pinta);
        pinta();
      },
      aoFechar: function () { if (solta) solta(); }
    });
  }
  function linkMais(tela, titulo, valor) {
    return '<button type="button" class="g-opcao g-link" data-tela="' + tela + '"><span>' + esc(titulo) + '</span><small>' + esc(valor) + '</small></button>';
  }
  function textoRegra(r) { return 'Dia ' + r.dia + ', ' + (r.mes === 0 ? 'no mesmo mês do fechamento' : r.mes === 1 ? 'no mês seguinte' : 'em ' + r.mes + ' meses'); }

  function abreMaisPlantoes() {
    var cor = 'var(--g-pl-tx)';
    folhaMais(cor, function () {
      var cd = compDayVal(C.plantao);
      return linkMais('locais', 'Locais e pagamento', cd === 1 ? 'Mês civil' : 'Fecha no dia ' + cd) + linkMais('ano', 'Plantões no ano', String(P.ref.getFullYear()));
    }, {
      locais: {
        titulo: 'Locais e pagamento',
        html: function () {
          var p = C.plantao, cd = compDayVal(p);
          var opts = '<option value="1"' + (cd === 1 ? ' selected' : '') + '>Mês civil</option>';
          for (var d = 2; d <= 28; d++) opts += '<option value="' + d + '"' + (cd === d ? ' selected' : '') + '>Dia ' + d + '</option>';
          var ks = Object.keys(p.locais).sort();
          return '<div class="g-sup"><label class="g-opcao g-escolha"><span><span>Período do mês</span><small>' + (cd === 1 ? 'De 1 ao último dia' : 'Fecha todo dia ' + cd) + '</small></span>' +
            '<select class="g-sel" data-m="compday" aria-label="Período do mês">' + opts + '</select></label>' +
            '<button type="button" class="g-opcao g-col" data-regra=""><span class="g-col-t">Regra padrão de pagamento</span><small>' + esc(textoRegra(regraPg(p, '\u0000'))) + '</small></button></div>' +
            '<h3 class="g-h3">Locais</h3>' + (ks.length ? '' : '<p class="g-vaziotx">Os locais aparecem aqui quando você lança um plantão.</p>') +
            (ks.length ? '<div class="g-sup">' + ks.map(function (l) {
              var m = p.locais[l], rg = regraPg(p, l);
              return '<button type="button" class="g-opcao g-local" data-regra="' + esc(l) + '"><span class="g-local-1"><b>' + esc(l) + '</b><b>' + real(m.value || 0) + '</b></span><small>' + esc((m.start || '') + ' às ' + (m.end || '') + '. ' + (rg.proprio ? textoRegra(rg) : 'Regra padrão')) + '</small></button>';
            }).join('') + '</div>' : '') +
            '<p class="g-miuda">Horário e valor de cada local são os do último plantão lançado nele.</p>';
        },
        clique: function (b) { if (b.dataset.regra != null) abreRegra(b.dataset.regra || null); },
        muda: function (t, tela, pinta) {
          if (t.dataset.m !== 'compday') return;
          var v = +t.value; if (v === compDayVal(C.plantao)) return;
          C.definirCompDay(v).then(function () { P.diaSel = null; desenhaPlantoes(); }, function (e) { pinta(); U.aviso((e && e.message) || 'Não gravou'); });
        }
      },
      ano: {
        titulo: 'Plantões no ano',
        html: function (t) {
          if (t.ano == null) t.ano = P.ref.getFullYear();
          var ano = t.ano, ys = C.plantao.shifts.filter(function (s) { return s.date.indexOf(ano + '-') === 0; });
          var meses = []; for (var m = 0; m < 12; m++) {
            var l = ys.filter(function (s) { return +s.date.slice(5, 7) === m + 1; });
            meses.push({ m: m, n: l.length, h: l.reduce(function (a, s) { return a + horasDe(s.start, s.end); }, 0), p: l.reduce(function (a, s) { return a + (s.value || 0); }, 0), r: l.filter(pago).reduce(function (a, s) { return a + (s.value || 0); }, 0) });
          }
          var tp = 0, tr = 0, tn = 0, th = 0, mx = 0;
          meses.forEach(function (x) { tp += x.p; tr += x.r; tn += x.n; th += x.h; mx = Math.max(mx, x.p); });
          var h = '<div class="g-anonav"><button type="button" data-ano="-1">' + (ano - 1) + '</button><b>' + ano + '</b><button type="button" data-ano="1">' + (ano + 1) + '</button></div>' +
            '<div class="g-anotot"><b>' + real(tp) + ' previstos</b><span>' + real(tr) + ' recebidos, em ' + tn + ' plantões e ' + textoHoras(th) + '</span></div>' +
            '<div class="g-sup g-grafico"><div class="g-barras" aria-hidden="true">' + meses.map(function (x) {
              return '<span class="g-coluna"><span class="g-col-area"><i class="g-col-p" style="height:' + (mx ? x.p / mx * 100 : 0) + '%"></i><i class="g-col-r" style="height:' + (mx ? x.r / mx * 100 : 0) + '%"></i></span>' +
                '<small>' + MESES[x.m].charAt(0).toUpperCase() + '</small></span>';
            }).join('') + '</div><div class="g-legenda" aria-hidden="true"><span><i style="background:var(--g-pl)"></i>Recebido</span><span><i class="tinto28"></i>Previsto</span></div></div>';
          var comPl = meses.filter(function (x) { return x.n > 0; });
          if (comPl.length) h += '<h3 class="g-h3">Por mês</h3><div class="g-sup">' + comPl.map(function (x) {
            return '<div class="g-opcao g-col g-estatico"><span class="g-local-1"><b>' + mesExtenso(criar(2026, x.m, 1)) + '</b><b>' + real(x.p) + '</b></span><small>' + x.n + (x.n === 1 ? ' plantão, ' : ' plantões, ') + textoHoras(x.h) + '. Recebido ' + real(x.r) + '.</small></div>';
          }).join('') + '</div>';
          else h += '<p class="g-vaziotx">Sem plantões neste ano.</p>';
          var porLocal = {}; ys.forEach(function (s) { porLocal[s.local] = (porLocal[s.local] || 0) + (s.value || 0); });
          var pl = Object.keys(porLocal).map(function (k) { return [k, porLocal[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
          if (pl.length) h += '<h3 class="g-h3">Por local</h3><div class="g-sup">' + pl.map(function (k) { return '<div class="g-opcao g-estatico"><span>' + esc(k[0]) + '</span><b>' + real(k[1]) + '</b></div>'; }).join('') + '</div>';
          return h;
        },
        clique: function (b, t, pinta) {
          if (b.dataset.ano) { t.ano += +b.dataset.ano; return pinta(); }
        }
      }
    }, [{ titulo: 'Plantões no site, com CSV', href: '../plantaohub.html' }]);
  }

  function abreRegra(local) {
    var p = C.plantao, r = regraPg(p, local == null ? '\u0000' : local), fim = (P.painel || painelPlantoes(P.ref, p)).r.e;
    U.folha({
      titulo: local || 'Regra padrão', classe: 'g-folha g-regra',
      conteudo: function (c, api) {
        var dias = ''; for (var d = 1; d <= 28; d++) dias += '<option value="' + d + '"' + (d === r.dia ? ' selected' : '') + '>' + d + '</option>';
        var mes = Math.min(3, r.mes);
        c.innerHTML = topo(local || 'Regra padrão', 'Cancelar', 'Salvar') + '<p class="g-erro" role="alert" hidden></p>' +
          '<div class="g-sup"><label class="g-opcao g-escolha"><span>Dia do crédito</span><select class="g-sel" name="dia">' + dias + '</select></label>' +
          '<label class="g-opcao g-escolha"><span>Quando</span><select class="g-sel" name="mes">' + ['No mesmo mês do fechamento', 'No mês seguinte', 'Em 2 meses', 'Em 3 meses'].map(function (t, i) { return '<option value="' + i + '"' + (i === mes ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></label></div>' +
          '<p class="g-miuda g-rodape-regra"></p>' + (local && r.proprio ? '<button type="button" class="g-linhabt" data-x="padrao" style="color:var(--g-pl-tx)">Usar a regra padrão</button>' : '');
        var sd = c.querySelector('[name=dia]'), sm = c.querySelector('[name=mes]'), salvando = false;
        function pinta() { c.querySelector('.g-rodape-regra').textContent = 'Neste período, cairia em ' + completo(criar(fim.getFullYear(), fim.getMonth() + +sm.value, +sd.value)) + '. ' + (local ? 'Vale só para este local.' : 'Vale para os locais sem regra própria.'); }
        sd.addEventListener('change', pinta); sm.addEventListener('change', pinta);
        function falhou(e) { salvando = false; var x = c.querySelector('.g-erro'); x.textContent = (e && e.message) || String(e); x.hidden = false; }
        c.addEventListener('click', function (e) {
          var b = e.target.closest('button'); if (!b) return;
          if (b.dataset.topo === 'esq') return api.fechar();
          if (salvando) return;
          if (b.dataset.topo === 'dir') { salvando = true; return C.salvarRegra(local, +sd.value, +sm.value).then(api.fechar, falhou); }
          if (b.dataset.x === 'padrao') { salvando = true; return C.limparRegra(local).then(api.fechar, falhou); }
        });
        pinta();
      }
    });
  }

  /* =====================================================================
     FINANÇAS (FinancasView)
     ===================================================================== */
  var Fz = { el: null, ref: new Date(), aberto: null, filtroAberto: false, filtroTipo: 'tudo', filtroCategoria: null, busca: '', sel: null, painel: null };

  function montaFinancas(el) {
    Fz.el = el;
    el.classList.add('g-secao', 'g-financas');
    el.innerHTML = '<div class="rola-secao g-rola"><div class="g-fin-topo"></div></div><div class="g-aviso-lugar" aria-live="polite"></div>' +
      '<div class="g-pe"><button type="button" class="g-acao" data-acao="lancar">Lançar</button></div>';
    Fz.lista = D.createElement('div'); Fz.lista.className = 'g-fin-lista g-lista';
    desenhaFinancas();
    C.ligar('granae');
    if (el.__gestao) return;
    el.__gestao = 1;
    el.addEventListener('click', cliqueFinancas);
    el.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('g-lc')) { e.preventDefault(); e.target.click(); } });
    el.addEventListener('input', function (e) { if (e.target.name === 'busca') { Fz.busca = e.target.value; desenhaListaF(); desenhaBotaoFiltro(); } });
    Fz.giro = arrastoMes(el, '.g-resumo-f, .g-cab2', function () { return el.querySelector('.g-desliza'); }, trocarMesF);
    linhasDeslizantes(el, function (l) {
      var t = achaLanc(l.dataset.id); if (!t) return {};
      return { esquerda: { executar: function () { excluirL(t); } } };
    });
  }
  function achaLanc(id) { return C.granae.transactions.filter(function (t) { return t.id === id; })[0] || null; }
  function mesVizinho(n) { var s = Fz.painel ? Fz.painel.r.s : mesCivil(Fz.ref).s; return criar(s.getFullYear(), s.getMonth() + n, 1); }
  function trocarMesF(n) { Fz.ref = mesVizinho(n); desenhaFinancas(); }

  function desenhaFinancas() {
    var el = Fz.el; if (!el || !el.querySelector('.g-fin-topo') || !Fz.lista) return;
    var m = Fz.painel = painelFinancas(Fz.ref, C.granae), tem = C.temDinheiro;
    var h = cabecaMes({ titulo: mesExtenso(m.r.s), ano: String(m.r.s.getFullYear()), anterior: mesCurto(mesVizinho(-1)), seguinte: mesCurto(mesVizinho(1)), corMais: 'var(--g-fi-tx)' });
    h += faixa('granae');
    h += '<div class="g-desliza"><div class="g-cartao g-resumo-f">';
    h += numeroF('entrou', 'Entrou', m.entrou, 'var(--g-fi-tx)', m.entrar > 0 ? real(m.entrar) + ' agendados para entrar' : null, tem);
    if (Fz.aberto === 'entrou' && tem) {
      var rec = m.lancamentos.filter(function (t) { return t.type === 'income'; }).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
      h += '<div class="g-detalhe">' + (rec.length ? '' : '<p class="g-t2">Nenhuma receita lançada neste mês.</p>') + rec.slice(0, 6).map(function (t) {
        return '<button type="button" class="g-rec" data-acao="editar-id" data-id="' + esc(t.id) + '"><span>' + esc(t.description) + '</span><b style="color:' + (t.pending ? 'var(--tinta2)' : 'var(--g-fi-tx)') + '">' + real(t.amount) + '</b></button>';
      }).join('') + '</div>';
    }
    h += '<div class="g-fio"></div>';
    h += numeroF('saiu', 'Saiu', m.saiu, 'var(--tinta)', m.sair > 0 ? real(m.sair) + ' agendados para sair' : null, tem);
    if (Fz.aberto === 'saiu' && tem) h += '<div class="g-detalhe">' + gastosPorCategoria(m) + '</div>';
    h += '<div class="g-fio"></div><div class="g-saldo"><span>Saldo</span><b' + (m.saldo < 0 ? ' style="color:var(--g-al-tx)"' : '') + '>' + (tem ? real(m.saldo) : vazio(110)) + '</b></div>';
    h += '</div></div>';
    el.querySelector('.g-fin-topo').innerHTML = h;
    // a lista entra no mesmo deslizamento do mês
    el.querySelector('.g-desliza').appendChild(Fz.lista);
    desenhaListaF();
    var bt = el.querySelector('.g-acao'), trav = !!C.bloqueio('granae');
    bt.classList.toggle('travado', trav);
    bt.style.background = trav ? '' : 'var(--g-fi)';
  }
  function numeroF(b, titulo, v, cor, nota, tem) {
    var ab = Fz.aberto === b;
    return '<button type="button" class="g-num" data-acao="bloco" data-b="' + b + '" aria-expanded="' + ab + '"' + (tem ? '' : ' disabled') + '>' +
      '<span class="g-num-l"><span class="g-num-t">' + titulo + '</span><span class="g-num-v grande" style="color:' + cor + '">' + (tem ? real(v) : vazio(130)) + '</span></span>' +
      (tem && nota ? '<span class="g-num-nota">' + esc(nota) + '</span>' : '') +
      (tem && b === 'saiu' && !ab ? '<span class="g-num-link">Ver por categoria</span>' : '') + '</button>';
  }

  /* GastosPorCategoria: barras horizontais, cor única; a selecionada fica cheia; o traço marca o teto. */
  function gastosPorCategoria(m) {
    var com = m.categorias.filter(function (c) { return c.gasto > 0; });
    var linhas = com.length > 7 ? com.slice(0, 6).concat([{ nome: 'Outras somadas', gasto: com.slice(6).reduce(function (s, c) { return s + c.gasto; }, 0), teto: 0 }]) : com;
    var semGasto = m.categorias.filter(function (c) { return c.gasto === 0 && c.teto > 0; });
    if (Fz.sel && !linhas.some(function (c) { return c.nome === Fz.sel; })) Fz.sel = null;
    var h = '';
    if (!linhas.length) h += '<p class="g-t2">Nenhum gasto neste mês.</p>';
    else {
      var esc0 = linhas.filter(function (c) { return c.nome === Fz.sel; })[0];
      if (esc0) {
        var pct = m.saiu > 0 ? Math.round(esc0.gasto / m.saiu * 100) : 0, tx, acima = false;
        if (esc0.teto > 0) { var f = esc0.teto - esc0.gasto; acima = f < 0; tx = f >= 0 ? pct + '% do que saiu. Faltam ' + real(f) + ' do teto' : pct + '% do que saiu. ' + real(-f) + ' acima do teto'; }
        else tx = pct + '% do que saiu';
        h += '<div class="g-escolhida"><div class="g-esc-1"><b>' + esc(esc0.nome) + '</b><b>' + realCheio(esc0.gasto) + '</b></div><div class="g-esc-2"><span' + (acima ? ' style="color:var(--g-al-tx)"' : '') + '>' + esc(tx) + '</span>' +
          (esc0.nome !== 'Outras somadas' ? '<button type="button" class="g-link-tx" data-acao="filtra-cat" data-cat="' + esc(esc0.nome) + '">' + (Fz.filtroCategoria === esc0.nome ? 'Mostrar tudo' : 'Ver lançamentos') + '</button>' : '') + '</div></div>';
      } else h += '<p class="g-t2 g-dica">Toque numa barra para ver a categoria.</p>';
      var mx = linhas.reduce(function (a, c) { return Math.max(a, c.gasto, c.teto); }, 0) || 1;
      h += '<div class="g-cats" role="group" aria-label="Gastos por categoria">' + linhas.map(function (c) {
        var on = !Fz.sel || Fz.sel === c.nome;
        return '<button type="button" class="g-cat' + (Fz.sel === c.nome ? ' sel' : '') + '" data-acao="cat" data-cat="' + esc(c.nome) + '" aria-pressed="' + (Fz.sel === c.nome) + '" aria-label="' + esc(c.nome + ': ' + real(c.gasto) + (c.teto > 0 ? ', teto ' + real(c.teto) : '')) + '">' +
          '<span class="g-cat-t">' + esc(c.nome) + '&nbsp;&nbsp;' + real(c.gasto) + '</span><span class="g-cat-area"><i class="g-cat-b" style="width:' + (c.gasto / mx * 100) + '%;opacity:' + (on ? 1 : 0.32) + '"></i>' +
          (c.teto > 0 ? '<i class="g-cat-teto" style="left:calc(' + (c.teto / mx * 100) + '% - 1px)"></i>' : '') + '</span></button>';
      }).join('') + '</div>';
      if (linhas.some(function (c) { return c.teto > 0; })) h += '<p class="g-miuda">O traço marca o teto da categoria.</p>';
    }
    if (semGasto.length) h += '<p class="g-miuda">Sem gasto ainda: ' + esc(semGasto.map(function (c) { return c.nome + ' (teto ' + real(c.teto) + ')'; }).join(', ')) + '</p>';
    return h;
  }

  function filtroLigado() { return Fz.filtroTipo !== 'tudo' || !!Fz.filtroCategoria || !!Fz.busca.trim(); }
  function desenhaBotaoFiltro() { var b = Fz.el.querySelector('[data-acao=filtro]'); if (b) b.textContent = filtroLigado() ? 'Filtro ligado' : 'Filtrar'; }
  function desenhaListaF() {
    var lista = Fz.lista, m = Fz.painel, hj = hoje();
    var q = Fz.busca.trim().toLowerCase();
    var todos = m.lancamentos.filter(function (l) {
      if ((Fz.filtroTipo === 'receitas' && l.type !== 'income') || (Fz.filtroTipo === 'gastos' && l.type === 'income')) return false;
      if (Fz.filtroCategoria && l.category !== Fz.filtroCategoria) return false;
      if (q && l.description.toLowerCase().indexOf(q) < 0 && l.category.toLowerCase().indexOf(q) < 0 && (l.sub || '').toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    function agrupar(l, crescente) {
      var dias = {}; l.forEach(function (t) { (dias[t.date] = dias[t.date] || []).push(t); });
      return Object.keys(dias).sort(function (a, b) { return crescente ? (a < b ? -1 : 1) : (a < b ? 1 : -1); })
        .map(function (d) { return { dia: d, itens: dias[d].sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; }) }; });
    }
    var porVir = agrupar(todos.filter(function (t) { return t.date > hj; }), true), feitos = agrupar(todos.filter(function (t) { return t.date <= hj; }), false);
    var cabAntes = lista.querySelector('.g-filtro');
    var h = '';
    if (!cabAntes) {
      h += '<div class="g-lista-cab"><h2 class="g-h2">Lançamentos</h2><button type="button" class="g-link-tx" data-acao="filtro" aria-expanded="' + Fz.filtroAberto + '">' + (filtroLigado() ? 'Filtro ligado' : 'Filtrar') + '</button></div>';
      if (Fz.filtroAberto) h += painelFiltro();
      h += '<div class="g-lista-corpo"></div>';
      lista.innerHTML = h;
    }
    var corpo = lista.querySelector('.g-lista-corpo'), b = '';
    var fc = lista.querySelector('.g-filtro-cat');
    if (fc) { fc.hidden = !Fz.filtroCategoria; fc.textContent = Fz.filtroCategoria ? 'Só ' + Fz.filtroCategoria + '. Toque para limpar' : ''; }
    if (!todos.length) b += '<p class="g-vaziotx">' + (filtroLigado() ? 'Nada com esse filtro.' : 'Nada lançado neste mês.') + '</p>';
    if (feitos.length) b += grupoLinhas(null, feitos);
    if (porVir.length) b += grupoLinhas('Agendados', porVir);
    corpo.innerHTML = b;
  }
  function painelFiltro() {
    return '<div class="g-filtro">' +
      '<div class="g-tipos" role="group" aria-label="Tipo">' + [['tudo', 'Tudo'], ['receitas', 'Receitas'], ['gastos', 'Gastos']].map(function (t) {
        return '<button type="button" class="g-tipo' + (Fz.filtroTipo === t[0] ? ' sel' : '') + '" data-acao="tipo" data-t="' + t[0] + '" aria-pressed="' + (Fz.filtroTipo === t[0]) + '">' + t[1] + '</button>';
      }).join('') + '</div>' +
      '<input class="g-campo g-busca" type="search" name="busca" placeholder="Buscar" aria-label="Buscar nos lançamentos" autocomplete="off" autocapitalize="off" value="' + esc(Fz.busca) + '">' +
      '<button type="button" class="g-link-tx g-filtro-cat" data-acao="limpa-cat"' + (Fz.filtroCategoria ? '' : ' hidden') + '>' + (Fz.filtroCategoria ? esc('Só ' + Fz.filtroCategoria + '. Toque para limpar') : '') + '</button></div>';
  }
  function grupoLinhas(titulo, grupos) {
    return (titulo ? '<h3 class="g-grupo-t">' + titulo + '</h3>' : '') + '<div class="g-sup g-grupo">' + grupos.map(function (g) {
      return '<p class="g-dia-t">' + esc(rotuloDia(g.dia)) + '</p>' + g.itens.map(function (l) {
        var rec = l.type === 'income';
        return linhaDeslizante('data-id="' + esc(l.id) + '"', null, { rotulo: 'Excluir', cor: 'var(--g-al)' },
          '<span class="g-ll-m"><b>' + esc(l.description) + '</b>' + (l.category !== l.description || l.transferId ? '<small>' + esc(l.transferId ? 'Transferência' : l.category) + '</small>' : '') + '</span>' +
          '<span class="g-ll-v"><b' + (rec ? ' style="color:var(--g-fi-tx)"' : '') + '>' + (rec ? '+ ' : '− ') + realCheio(l.amount) + '</b>' + (l.pending ? '<small>Agendado</small>' : '') + '</span>');
      }).join('');
    }).join('') + '</div>';
  }

  function cliqueFinancas(e) {
    var a = e.target.closest('[data-acao]'); if (!a || !Fz.el.contains(a)) return;
    var acao = a.dataset.acao;
    if (acao === 'mes') return trocarMesF(+a.dataset.n);
    if (acao === 'mais') return abreMaisFinancas();
    if (acao === 'tentar') return C.tentarDeNovo('granae');
    if (acao === 'bloco') { if (!C.temDinheiro || (Fz.giro && Fz.giro.acabou())) return; Fz.aberto = Fz.aberto === a.dataset.b ? null : a.dataset.b; if (Fz.aberto === 'saiu') Fz.sel = Fz.filtroCategoria; return desenhaFinancas(); }
    if (acao === 'cat') { Fz.sel = Fz.sel === a.dataset.cat ? null : a.dataset.cat; return desenhaFinancas(); }
    if (acao === 'filtra-cat') {
      var n = Fz.filtroCategoria === a.dataset.cat ? null : a.dataset.cat;
      Fz.filtroCategoria = n;
      if (n) { Fz.filtroTipo = 'tudo'; Fz.filtroAberto = true; }
      Fz.lista.innerHTML = '';
      desenhaFinancas();
      if (n) Fz.lista.scrollIntoView({ block: 'start', behavior: reduz() ? 'auto' : 'smooth' });
      return;
    }
    if (acao === 'filtro') { Fz.filtroAberto = !Fz.filtroAberto; Fz.lista.innerHTML = ''; desenhaListaF(); var bu = Fz.el.querySelector('[name=busca]'); if (bu) bu.focus({ preventScroll: true }); return; }
    if (acao === 'tipo') { Fz.filtroTipo = a.dataset.t; Fz.lista.innerHTML = ''; desenhaListaF(); var tb = Fz.el.querySelector('[data-t="' + Fz.filtroTipo + '"]'); if (tb) tb.focus({ preventScroll: true }); return; }
    if (acao === 'limpa-cat') { Fz.filtroCategoria = null; desenhaListaF(); desenhaBotaoFiltro(); return; }
    if (acao === 'editar-id') { var t0 = achaLanc(a.dataset.id); if (t0) folhaDinheiro({ editar: t0 }); return; }
    if (acao === 'editar') { var li = a.closest('.g-linha'), t = li && achaLanc(li.dataset.id); if (t) folhaDinheiro({ editar: t }); return; }
    if (acao === 'lancar') {
      var b = C.bloqueio('granae'); if (b) return mostraAviso(Fz.el, { texto: b, erro: true });
      return folhaDinheiro({});
    }
  }
  function excluirL(l) {
    C.excluirLancamento(l.id).then(function (copia) {
      mostraAviso(Fz.el, { texto: 'Lançamento excluído', desfazer: function () { C.restaurarLancamento(copia).catch(function (e) { erroAviso(Fz.el, e); }); } });
    }, function (e) { erroAviso(Fz.el, e); });
  }

  /* ---------- FolhaDinheiro + FormDinheiro: valor primeiro, categoria com um toque ---------- */
  var CHAVE_MODO = 'medtech.meumes.modo';
  function folhaDinheiro(pedido) {
    var o = pedido.editar || null, g = C.granae;
    var modo = o ? (o.type === 'income' ? 'receita' : 'gasto') : (function () { try { return localStorage.getItem(CHAVE_MODO) === 'Receita' ? 'receita' : 'gasto'; } catch (e) { return 'gasto'; } })();
    var parc = o ? parcelaInfo(o.description) : null;
    U.folha({
      titulo: o ? (o.type === 'income' ? 'Editar receita' : 'Editar gasto') : 'Lançar', classe: 'g-folha g-fd', alta: true,
      conteudo: function (c, api) {
        var st = { digitos: o ? textoCampo(o.amount) : '', data: o ? o.date : hoje(), descricao: o ? o.description : '', categoria: o ? o.category : '', parcelas: 1, sub: (o && o.sub) || '', conta: (o && o.accountId) || '', detalhes: false, salvando: false, falta: false };
        function tipo() { return modo === 'receita' ? 'income' : 'expense'; }
        function categorias() {
          var l = g.categories.map(function (x, i) { return { c: x, i: i }; }).filter(function (x) { return x.c.type === tipo(); }), usos = {};
          g.transactions.slice(-400).forEach(function (t) { if (t.type === tipo()) usos[t.category] = (usos[t.category] || 0) + 1; });
          return l.sort(function (a, b) { return ((usos[b.c.name] || 0) - (usos[a.c.name] || 0)) || a.i - b.i; }).map(function (x) { return x.c; });
        }
        function exibicao() {
          if (!st.digitos) return 'R$ 0';
          var pt = st.digitos.split(','), int = FI.format(+pt[0] || 0);
          return pt.length > 1 ? 'R$ ' + int + ',' + pt[1] : 'R$ ' + int;
        }
        function valor() { return numeroCampo(st.digitos) || 0; }
        function tocar(t) {
          var x = st.digitos;
          if (t === 'apagar') { st.digitos = x.slice(0, -1); return; }
          if (t === ',') { if (x.indexOf(',') >= 0) return; st.digitos = x ? x + ',' : '0,'; return; }
          var i = x.indexOf(',');
          if (i >= 0) { if (x.length - i > 2) return; } else if (x.length >= 8) return;
          st.digitos = x === '0' ? t : x + t;
        }
        function pinta() {
          var cats = categorias(), ed = !!o;
          var h = topo(o ? (o.type === 'income' ? 'Editar receita' : 'Editar gasto') : '');
          if (!ed) h += '<div class="g-modo" role="group" aria-label="Tipo de lançamento">' + ['gasto', 'receita'].map(function (m) { return '<button type="button" class="g-modo-bt' + (modo === m ? ' sel' : '') + '" data-modo="' + m + '" aria-pressed="' + (modo === m) + '">' + (m === 'gasto' ? 'Gasto' : 'Receita') + '</button>'; }).join('') + '</div>';
          h += '<p class="g-erro" role="alert"' + (st.erro ? '' : ' hidden') + '>' + esc(st.erro || '') + '</p>';
          h += '<div class="g-vtopo"><output class="g-vgrande' + (st.digitos ? '' : ' zero') + '" aria-live="polite" aria-label="Valor ' + esc(real(valor())) + '">' + esc(exibicao()) + '</output>' +
            '<div class="g-vdata"><input class="g-campo g-data" type="date" name="data" aria-label="Data" value="' + esc(st.data) + '">' + (st.data > hoje() ? '<span class="g-t2 g-forte">Agendado</span>' : '') + '</div>' +
            (st.falta ? '<p class="g-alerta-tx g-forte">Digite o valor</p>' : '') + '</div>';
          if (st.detalhes) {
            h += '<div class="g-det-campos">' +
              '<input class="g-campo" type="text" name="descricao" placeholder="Descrição" aria-label="Descrição" value="' + esc(st.descricao) + '">';
            if (!ed) {
              h += '<div class="g-parc"><span>' + (st.parcelas === 1 ? 'À vista' : st.parcelas + ' parcelas de ' + esc(realCheio(valor()))) + '</span><span class="g-passo"><button type="button" data-par="-1" aria-label="Menos parcelas"' + (st.parcelas <= 1 ? ' disabled' : '') + '>−</button><button type="button" data-par="1" aria-label="Mais parcelas"' + (st.parcelas >= 120 ? ' disabled' : '') + '>+</button></span></div>';
              if (st.parcelas > 1) h += '<p class="g-miuda">O valor digitado é o de cada parcela. Elas ficam lançadas uma por mês.</p>';
            } else if (parc) h += '<p class="g-t2">Esta é a parcela ' + parc.k + ' de ' + parc.n + '. A edição muda só ela.</p>';
            h += '<input class="g-campo" type="text" name="sub" placeholder="Subcategoria (opcional)" aria-label="Subcategoria" value="' + esc(st.sub) + '">';
            if (g.accounts.length) h += '<label class="g-parc"><span>Conta ou cartão</span><select class="g-sel" name="conta"><option value="">Não informado</option>' + g.accounts.map(function (a) { return '<option value="' + esc(a.id) + '"' + (a.id === st.conta ? ' selected' : '') + '>' + esc(a.name) + '</option>'; }).join('') + '</select></label>';
            if (ed) h += '<div class="g-dois"><button type="button" class="g-linhabt" data-x="dup" style="color:var(--g-fi-tx)">Duplicar para hoje</button><button type="button" class="g-linhabt" data-x="exc" style="color:var(--g-al-tx)">Excluir</button></div>';
            h += '</div>';
          }
          h += '<div class="g-cats-esc"><p class="g-rot">' + (ed ? 'Categoria' : 'Toque na categoria para salvar') + '</p><div class="g-chips g-chips-cat">' + cats.map(function (x) {
            return '<button type="button" class="g-chip' + (st.categoria === x.name ? ' sel' : '') + '" data-cat="' + esc(x.name) + '" aria-pressed="' + (st.categoria === x.name) + '"' + (st.salvando ? ' disabled' : '') + '>' + esc(x.name) + '</button>';
          }).join('') + '</div></div>';
          if (!st.detalhes) h += '<div class="g-teclado">' + ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'apagar'].map(function (t) {
            return '<button type="button" class="g-tecla" data-t="' + t + '" aria-label="' + (t === 'apagar' ? 'Apagar' : t === ',' ? 'Vírgula' : t) + '">' + (t === 'apagar' ? U.ic('backspace') : t) + '</button>';
          }).join('') + '</div>';
          h += '<div class="g-rodape"><button type="button" class="g-linhabt" data-x="det" style="color:var(--g-fi-tx)">' + (st.detalhes ? 'Voltar ao valor' : ed ? 'Mais campos' : 'Descrição, parcelas e conta') + '</button>' +
            (ed ? '<button type="button" class="g-cheio" data-x="salvar" style="background:var(--g-fi)"' + (st.salvando ? ' disabled' : '') + '>Salvar</button>' : '') + '</div>';
          var foco = D.activeElement && c.contains(D.activeElement) ? (D.activeElement.dataset.t ? '[data-t="' + D.activeElement.dataset.t + '"]' : D.activeElement.dataset.cat ? '[data-cat="' + CSS.escape(D.activeElement.dataset.cat) + '"]' : D.activeElement.dataset.modo ? '[data-modo="' + D.activeElement.dataset.modo + '"]' : D.activeElement.dataset.x ? '[data-x="' + D.activeElement.dataset.x + '"]' : D.activeElement.dataset.par ? '[data-par="' + D.activeElement.dataset.par + '"]' : null) : null;
          c.innerHTML = h;
          if (foco) { var fe = c.querySelector(foco); if (fe && !fe.disabled) fe.focus({ preventScroll: true }); }
        }
        function lerCampos() {
          var x;
          if ((x = c.querySelector('[name=descricao]'))) st.descricao = x.value;
          if ((x = c.querySelector('[name=sub]'))) st.sub = x.value;
          if ((x = c.querySelector('[name=conta]'))) st.conta = x.value;
          if ((x = c.querySelector('[name=data]'))) st.data = x.value || st.data;
        }
        c.addEventListener('input', function (e) { if (e.target.name === 'data') { lerCampos(); var ag = c.querySelector('.g-vdata .g-t2'); var fut = st.data > hoje(); if (fut && !ag) e.target.insertAdjacentHTML('afterend', '<span class="g-t2 g-forte">Agendado</span>'); if (!fut && ag) ag.remove(); } else lerCampos(); });
        c.addEventListener('click', function (e) {
          var b = e.target.closest('button'); if (!b || b.disabled) return;
          lerCampos();
          if (b.dataset.topo) return api.fechar();
          if (b.dataset.modo) { if (b.dataset.modo === modo) return; modo = b.dataset.modo; try { localStorage.setItem(CHAVE_MODO, modo === 'receita' ? 'Receita' : 'Gasto'); } catch (x) { } st.categoria = ''; return pinta(); }
          if (b.dataset.t) { st.falta = false; tocar(b.dataset.t); return pinta(); }
          if (b.dataset.par) { st.parcelas = Math.max(1, Math.min(120, st.parcelas + +b.dataset.par)); return pinta(); }
          if (b.dataset.cat != null) { st.categoria = b.dataset.cat; if (o) return pinta(); return salvar(b.dataset.cat); }
          if (b.dataset.x === 'det') { st.detalhes = !st.detalhes; return pinta(); }
          if (b.dataset.x === 'salvar') return salvar(st.categoria);
          if (b.dataset.x === 'dup') return C.duplicarLancamentoHoje(o.id).then(function () { terminar('Duplicado para hoje', null, hoje()); }, falhou);
          if (b.dataset.x === 'exc') return U.confirma('Excluir este lançamento?', o.description + ', ' + realCheio(o.amount) + '.', [
            { rotulo: 'Excluir', perigo: true, acao: function () { C.excluirLancamento(o.id).then(function (copia) { terminar('Lançamento excluído', function () { C.restaurarLancamento(copia).catch(function (x) { erroAviso(Fz.el, x); }); }, null); }, falhou); } },
            { rotulo: 'Cancelar' }]);
        });
        /* teclado físico no computador: números, vírgula e apagar */
        c.addEventListener('keydown', function (e) {
          if (st.detalhes || (e.target.matches && e.target.matches('input, select, textarea'))) return;
          var k = e.key === '.' ? ',' : e.key === 'Backspace' ? 'apagar' : e.key;
          if (/^[0-9,]$/.test(k) || k === 'apagar') { e.preventDefault(); st.falta = false; tocar(k); pinta(); }
        });
        function falhou(e) { st.salvando = false; if (!o) st.categoria = ''; st.erro = (e && e.message) || String(e); pinta(); }
        function terminar(texto, desfazer, foiPara) {
          api.fechar();
          if (foiPara && Fz.painel && !contem(Fz.painel.r, foiPara)) { var d = data(foiPara); if (d) Fz.ref = d; }
          desenhaFinancas();
          mostraAviso(Fz.el, { texto: texto, desfazer: desfazer });
        }
        function salvar(cat) {
          if (st.salvando) return;
          if (!(valor() > 0)) { st.falta = true; if (!o) st.categoria = ''; return pinta(); }
          if (!cat) { st.erro = 'Escolha a categoria.'; return pinta(); }
          var r = { id: o ? o.id : null, type: tipo(), amount: valor(), description: st.descricao.trim() || cat, category: cat, date: st.data || hoje(), sub: st.sub.trim() || null, accountId: st.conta || null, parcelas: o ? 1 : st.parcelas };
          st.salvando = true; st.erro = null; pinta();
          C.salvarLancamento(r).then(function () {
            var texto = r.parcelas > 1 ? r.parcelas + ' parcelas de ' + realCheio(r.amount) : r.date > hoje() ? 'Agendado para ' + curto(r.date) : (o ? 'Atualizado' : 'Lançado em ' + cat);
            terminar(texto, null, r.date);
          }, falhou);
        }
        pinta();
      }
    });
  }

  /* ---------- Mais opções de Finanças (MaisFinancasView, CompromissosView, FixosTetosView) ---------- */
  function abreMaisFinancas() {
    var cor = 'var(--g-fi-tx)';
    folhaMais(cor, function () {
      var ab = compromissos(C.granae).filter(function (c) { return !c.quitado; }).length;
      return linkMais('comp', 'Parcelas e dívidas', ab === 1 ? '1 em aberto' : ab + ' em aberto') + linkMais('fixos', 'Fixos e tetos', C.granae.fixedItems.length + ' fixos');
    }, {
      comp: {
        titulo: 'Parcelas e dívidas',
        html: function (t) {
          var lista = compromissos(C.granae), ab = lista.filter(function (c) { return !c.quitado; }), qt = lista.filter(function (c) { return c.quitado; });
          var h = '<div class="g-comp-tot"><span><small>Falta pagar</small><b style="color:var(--g-fi-tx)">' + real(ab.reduce(function (s, c) { return s + c.aPagar; }, 0)) + '</b></span>' +
            '<span class="dir"><small>Sai por mês</small><b>' + real(ab.reduce(function (s, c) { return s + c.valorParcela; }, 0)) + '</b></span></div>';
          if (!ab.length) h += '<p class="g-vaziotx">Nada em aberto. Lance um gasto com parcelas e ele aparece aqui.</p>';
          h += ab.map(function (c) { return cartaoComp(c, t); }).join('');
          if (qt.length) {
            h += '<button type="button" class="g-link-tx" data-c="quitados">' + (t.verQuitados ? 'Esconder' : 'Mostrar') + ' ' + qt.length + ' quitados</button>';
            if (t.verQuitados) h += qt.map(function (c) { return cartaoComp(c, t); }).join('');
          }
          return h;
        },
        clique: function (b, t, pinta) {
          if (b.dataset.c === 'quitados') { t.verQuitados = !t.verQuitados; return pinta(); }
          if (b.dataset.abre) { t.aberto = t.aberto === b.dataset.abre ? null : b.dataset.abre; return pinta(); }
          if (b.dataset.pagar) { var c = compromissos(C.granae).filter(function (x) { return x.id === b.dataset.pagar; })[0]; if (c) abrePagamento(c); }
        }
      },
      fixos: {
        titulo: 'Fixos e tetos',
        html: function (t) {
          t.aba = t.aba || 'tetos';
          var g = C.granae, pf = painelFinancas(Fz.ref, g);
          var h = '<div class="g-modo g-seg" role="group" aria-label="Ver"><button type="button" class="g-modo-bt' + (t.aba === 'tetos' ? ' sel' : '') + '" data-aba="tetos" aria-pressed="' + (t.aba === 'tetos') + '">Tetos</button><button type="button" class="g-modo-bt' + (t.aba === 'fixos' ? ' sel' : '') + '" data-aba="fixos" aria-pressed="' + (t.aba === 'fixos') + '">Fixos</button></div>';
          if (t.aba === 'tetos') {
            h += '<p class="g-t2">O teto é o valor da categoria no mês. Sem teto próprio, vale a soma dos fixos dela.</p><div class="g-sup">' + g.categories.filter(function (c) { return c.type === 'expense'; }).map(function (c) {
              var x = pf.categorias.filter(function (k) { return k.nome === c.name; })[0], gasto = x ? x.gasto : 0, lim = x ? x.teto : 0, fr = lim > 0 ? Math.min(1, gasto / lim) : 0;
              return '<button type="button" class="g-opcao g-teto" data-teto="' + esc(c.id) + '"><span class="g-local-1"><b>' + esc(c.name) + '</b><small' + (lim > 0 && gasto > lim ? ' style="color:var(--g-al-tx)"' : '') + '>' + esc(lim > 0 ? real(gasto) + ' de ' + real(lim) : gasto > 0 ? real(gasto) + ', sem teto' : 'Sem teto') + '</small></span>' +
                (lim > 0 ? '<span class="g-trilho fino"><i style="width:' + (gasto > 0 ? 'max(6px,' + fr * 100 + '%)' : '0') + ';background:' + (gasto > lim ? 'var(--g-al)' : 'var(--g-fi)') + '"></i></span>' : '') + '</button>';
            }).join('') + '</div>';
          } else {
            var fx = g.fixedItems.slice().sort(function (a, b) {
              if (a.type !== b.type) return a.type === 'income' ? -1 : 1;
              var ay = a.frequency === 'yearly', by = b.frequency === 'yearly'; if (ay !== by) return ay ? 1 : -1;
              return a.name.localeCompare(b.name, 'pt-BR');
            });
            h += '<button type="button" class="g-cheio g-cheio-m" data-fixo="" style="background:var(--g-fi)">Novo fixo</button>' + (fx.length ? '' : '<p class="g-vaziotx">Nenhum fixo cadastrado.</p>') +
              (fx.length ? '<div class="g-sup">' + fx.map(function (f) {
                var rec = f.type === 'income';
                return '<button type="button" class="g-opcao g-fixo" data-fixo="' + esc(f.id) + '"><span class="g-ll-m"><b>' + esc(f.name) + '</b><small>' + esc(f.category + ', ' + (f.frequency === 'yearly' ? '1 vez por ano' : 'todo mês')) + '</small></span><b' + (rec ? ' style="color:var(--g-fi-tx)"' : '') + '>' + (rec ? '+ ' : '− ') + real(f.amount) + '</b></button>';
              }).join('') + '</div>' : '');
          }
          return h;
        },
        clique: function (b, t, pinta) {
          if (b.dataset.aba) { t.aba = b.dataset.aba; return pinta(); }
          if (b.dataset.teto) { var c = C.granae.categories.filter(function (x) { return x.id === b.dataset.teto; })[0]; if (c) abreTeto(c); return; }
          if (b.dataset.fixo != null) { var f = b.dataset.fixo ? C.granae.fixedItems.filter(function (x) { return x.id === b.dataset.fixo; })[0] : null; abreFixo(f || null); }
        }
      }
    }, [
      { titulo: 'Bancos e Open Finance', href: '../granae.html#categorias' },
      { titulo: 'Análise por IA, voz e fatura', href: '../granae.html#ia' },
      { titulo: 'Regras, revisão em lote e CSV', href: '../granae.html#transacoes' },
      { titulo: 'Cartões, faturas e novo financiamento', href: '../granae.html#compromissos' },
      { titulo: 'Categorias e contas', href: '../granae.html#categorias' }
    ]);
  }
  function mesAno(s) { var d = data(s); return d ? MESES[d.getMonth()].slice(0, 3) + ' de ' + d.getFullYear() : s; }
  function cartaoComp(c, t) {
    var fr = c.divida ? (c.total > 0 ? Math.min(1, c.pago / c.total) : 0) : (c.n > 0 ? c.pagas / c.n : 0);
    var linha = c.divida ? real(c.aPagar) + ' em aberto de ' + real(c.total) + (c.credor ? ', ' + c.credor : '')
      : real(c.valorParcela) + ' por mês. Faltam ' + real(c.aPagar) + (c.estimado ? ' (estimado)' : '') + (c.ultima && !c.quitado ? '. Última em ' + mesAno(c.ultima) : '');
    var hj = hoje();
    var h = '<div class="g-comp"><button type="button" class="g-comp-cab" data-abre="' + esc(c.id) + '" aria-expanded="' + (t.aberto === c.id) + '"><span class="g-local-1"><b class="g-comp-n">' + esc(c.descricao) + '</b><b style="color:var(--g-fi-tx)">' + (c.divida ? Math.round(fr * 100) + '%' : c.pagas + ' de ' + c.n) + '</b></span>' +
      '<span class="g-trilho fino"><i style="width:' + (fr > 0 ? 'max(8px,' + fr * 100 + '%)' : '0') + ';background:var(--g-fi)"></i></span><small class="g-t2">' + esc(linha) + '</small></button>';
    if (t.aberto === c.id && c.txs.length) h += '<div class="g-comp-txs">' + c.txs.map(function (x) {
      var pg = !x.pending && x.date <= hj, d = data(x.date);
      return '<div class="g-comp-tx"><span>' + (d ? completo(d) : esc(x.date)) + '</span><b>' + realCheio(x.amount) + '</b><small' + (pg ? ' style="color:var(--g-fi-tx)"' : '') + '>' + (pg ? 'Paga' : 'Pendente') + '</small></div>';
    }).join('') + '</div>';
    if (!c.quitado && !c.divida && c.txs.length >= (c.n || 0)) h += '<p class="g-t2">As ' + c.n + ' parcelas já estão lançadas e entram na data de cada uma.</p>';
    else if (!c.quitado) h += '<button type="button" class="g-cheio g-cheio-m" data-pagar="' + esc(c.id) + '" style="background:var(--g-fi)">' + (c.divida ? 'Registrar pagamento' : 'Registrar parcela ' + (c.pagas + 1) + ' de ' + c.n) + '</button>';
    return h + '</div>';
  }

  function abrePagamento(c) {
    var g = C.granae;
    U.folha({
      titulo: c.descricao, classe: 'g-folha g-pag',
      conteudo: function (el, api) {
        var ult = c.txs.filter(function (t) { return t.groupId === c.id; }).slice(-1)[0];
        var v = c.divida ? '' : textoCampo(c.valorParcela), d = c.divida ? hoje() : proximaData(ult && ult.date), conta = (!c.divida && ult && ult.accountId) || '';
        el.innerHTML = topo(c.descricao, 'Cancelar') + '<p class="g-t2">' + esc(c.divida ? 'Em aberto: ' + realCheio(c.aPagar) + ' de ' + realCheio(c.total) + '. O valor entra como gasto do mês.' : 'Vai lançar como ' + c.descricao + ' (' + (c.pagas + 1) + '/' + c.n + ') em ' + c.categoria + '. Restam ' + (c.restantes || 0) + ' depois desta.') + '</p>' +
          '<div class="g-valor"><span aria-hidden="true">R$</span><input name="valor" type="text" inputmode="decimal" placeholder="0" aria-label="Valor" autocomplete="off" value="' + esc(v) + '"></div>' +
          '<label class="g-parc"><span>Data</span><input class="g-campo g-data" type="date" name="data" value="' + esc(d) + '"></label>' +
          (g.accounts.length ? '<label class="g-parc"><span>Conta ou cartão</span><select class="g-sel" name="conta"><option value="">Não informado</option>' + g.accounts.map(function (a) { return '<option value="' + esc(a.id) + '"' + (a.id === conta ? ' selected' : '') + '>' + esc(a.name) + '</option>'; }).join('') + '</select></label>' : '') +
          '<p class="g-erro" role="alert" hidden></p><button type="button" class="g-cheio" data-x="ok" style="background:var(--g-fi)">Registrar</button>';
        var salvando = false;
        el.addEventListener('click', function (e) {
          var b = e.target.closest('button'); if (!b) return;
          if (b.dataset.topo) return api.fechar();
          if (b.dataset.x !== 'ok' || salvando) return;
          var val = numeroCampo(el.querySelector('[name=valor]').value), err = el.querySelector('.g-erro');
          if (!(val > 0)) { err.textContent = 'Digite o valor.'; err.hidden = false; return; }
          var sc = el.querySelector('[name=conta]');
          salvando = true;
          C.registrarPagamento(c.id, c.divida ? 'divida' : 'parcela', val, el.querySelector('[name=data]').value || hoje(), sc ? sc.value : '').then(function () { api.fechar(); desenhaFinancas(); }, function (x) { salvando = false; err.textContent = x.message; err.hidden = false; });
        });
      }
    });
  }

  function abreTeto(cat) {
    U.folha({
      titulo: cat.name, classe: 'g-folha g-teto-f',
      conteudo: function (el, api) {
        el.innerHTML = topo('', 'Cancelar') + '<h2 class="g-h2">' + esc(cat.name) + '</h2><p class="g-t2">Teto por mês. Deixe vazio para tirar.</p>' +
          '<div class="g-valor"><span aria-hidden="true">R$</span><input name="valor" type="text" inputmode="decimal" placeholder="0" aria-label="Teto por mês" autocomplete="off" value="' + esc(textoCampo(cat.goal || 0)) + '"></div>' +
          '<p class="g-erro" role="alert" hidden></p><button type="button" class="g-cheio" data-x="ok" style="background:var(--g-fi)">Salvar</button>';
        var salvando = false;
        el.addEventListener('click', function (e) {
          var b = e.target.closest('button'); if (!b) return;
          if (b.dataset.topo) return api.fechar();
          if (b.dataset.x !== 'ok' || salvando) return;
          salvando = true;
          C.definirTeto(cat.id, numeroCampo(el.querySelector('[name=valor]').value) || 0).then(function () { api.fechar(); desenhaFinancas(); }, function (x) { salvando = false; var r = el.querySelector('.g-erro'); r.textContent = x.message; r.hidden = false; });
        });
      }
    });
  }

  function abreFixo(of) {
    var g = C.granae;
    U.folha({
      titulo: of ? 'Editar fixo' : 'Novo fixo', classe: 'g-folha g-fixo-f', alta: true,
      conteudo: function (el, api) {
        var st = { tipo: of ? of.type : 'expense', nome: of ? of.name : '', valor: of ? textoCampo(of.amount) : '', categoria: of ? of.category : ((g.categories.filter(function (c) { return c.type === 'expense'; })[0] || {}).name || 'Outros'), anual: of ? of.frequency === 'yearly' : false, mes: of ? (of.month || 1) : new Date().getMonth() + 1 };
        function pinta() {
          var cats = g.categories.filter(function (c) { return c.type === st.tipo; });
          if (!cats.some(function (c) { return c.name === st.categoria; })) st.categoria = (cats[0] || {}).name || 'Outros';
          el.innerHTML = topo(of ? 'Editar fixo' : 'Novo fixo', 'Cancelar', 'Salvar') + '<p class="g-erro" role="alert" hidden></p>' +
            '<div class="g-modo g-seg" role="group" aria-label="Tipo"><button type="button" class="g-modo-bt' + (st.tipo === 'expense' ? ' sel' : '') + '" data-tipo="expense" aria-pressed="' + (st.tipo === 'expense') + '">Gasto</button><button type="button" class="g-modo-bt' + (st.tipo === 'income' ? ' sel' : '') + '" data-tipo="income" aria-pressed="' + (st.tipo === 'income') + '">Receita</button></div>' +
            '<div class="g-det-campos"><input class="g-campo" type="text" name="nome" placeholder="Nome" aria-label="Nome" value="' + esc(st.nome) + '">' +
            '<input class="g-campo" type="text" inputmode="decimal" name="valor" placeholder="' + (st.anual ? 'Valor no ano' : 'Valor por mês') + '" aria-label="' + (st.anual ? 'Valor no ano' : 'Valor por mês') + '" value="' + esc(st.valor) + '">' +
            '<label class="g-parc"><span>Categoria</span><select class="g-sel" name="categoria">' + cats.map(function (c) { return '<option' + (c.name === st.categoria ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select></label>' +
            '<label class="g-parc g-chave"><span>Uma vez por ano</span><input type="checkbox" name="anual" role="switch"' + (st.anual ? ' checked' : '') + '></label>' +
            (st.anual ? '<label class="g-parc"><span>Mês</span><select class="g-sel" name="mes">' + MESES.map(function (m, i) { return '<option value="' + (i + 1) + '"' + (i + 1 === st.mes ? ' selected' : '') + '>' + primeira(m) + '</option>'; }).join('') + '</select></label>' : '') +
            (of ? '<button type="button" class="g-linhabt" data-x="exc" style="color:var(--g-al-tx)">Excluir</button>' : '') + '</div>';
        }
        function ler() {
          var x;
          if ((x = el.querySelector('[name=nome]'))) st.nome = x.value;
          if ((x = el.querySelector('[name=valor]'))) st.valor = x.value;
          if ((x = el.querySelector('[name=categoria]'))) st.categoria = x.value;
          if ((x = el.querySelector('[name=mes]'))) st.mes = +x.value;
        }
        var salvando = false;
        function falhou(e) { salvando = false; var r = el.querySelector('.g-erro'); r.textContent = (e && e.message) || String(e); r.hidden = false; }
        el.addEventListener('change', function (e) { ler(); if (e.target.name === 'anual') { st.anual = e.target.checked; pinta(); var k = el.querySelector('[name=anual]'); if (k) k.focus(); } });
        el.addEventListener('click', function (e) {
          var b = e.target.closest('button'); if (!b) return;
          ler();
          if (b.dataset.topo === 'esq') return api.fechar();
          if (b.dataset.tipo) { st.tipo = b.dataset.tipo; pinta(); var t = el.querySelector('[data-tipo="' + st.tipo + '"]'); if (t) t.focus(); return; }
          if (salvando) return;
          if (b.dataset.topo === 'dir') {
            var v = numeroCampo(st.valor);
            if (!st.nome.trim() || !v) return falhou({ message: !st.nome.trim() ? 'Dê um nome ao fixo.' : 'Digite o valor.' });
            salvando = true;
            return C.salvarFixo({ id: of ? of.id : null, type: st.tipo, name: st.nome, amount: v, category: st.categoria, frequency: st.anual ? 'yearly' : 'monthly', month: st.mes }).then(function () { api.fechar(); desenhaFinancas(); }, falhou);
          }
          if (b.dataset.x === 'exc') return U.confirma('Excluir este fixo?', of.name + '.', [{ rotulo: 'Excluir', perigo: true, acao: function () { salvando = true; C.excluirFixo(of.id).then(function () { api.fechar(); desenhaFinancas(); }, falhou); } }, { rotulo: 'Cancelar' }]);
        });
        pinta();
      }
    });
  }

  /* ---------- ligação com a casca e com o cofre ---------- */
  D.addEventListener('medtech:cofre', function (e) {
    var o = e.detail && e.detail.origem;
    if (P.el && (o === 'plantao' || o === 'situacao')) desenhaPlantoes();
    if (Fz.el && (o === 'granae' || o === 'situacao')) {
      var foco = D.activeElement && D.activeElement.name === 'busca';
      if (foco) { Fz.painel = painelFinancas(Fz.ref, C.granae); desenhaListaF(); } else { Fz.lista.innerHTML = ''; desenhaFinancas(); }
    }
  });
  Casca.registrar('secao', 'plantoes', montaPlantoes);
  Casca.registrar('secao', 'financas', montaFinancas);

  W.MTGestao = { _contas: { painelPlantoes: painelPlantoes, painelFinancas: painelFinancas, compromissos: compromissos, compRange: compRange, regraPg: regraPg, numeroCampo: numeroCampo, real: real, rotuloDia: rotuloDia }, P: P, F: Fz };
})();
