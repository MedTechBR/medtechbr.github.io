/* MedTech PWA: Finanças (espaço Gestão), a versão nova aprovada em 05/11/2026.
   Seis abas em pílulas no topo (Resumo, Lançamentos, Orçamento, Cartões, Dívidas, Contas) e Lançar fixo embaixo.
   Resumo, Lançamentos e Orçamento seguem o mês escolhido; Cartões, Dívidas e Contas são a foto de hoje.
   Os dados vêm do Granaê pelo cofre (cofre.js): lê e grava pela própria página granae.html, com as funções dela
   (faturaDoCartao, faturaPaga, compromissos, saldoDaConta, projecaoSaldo, a Visão geral do granae.banco.js, GranaeOF, Gemini).
   Nenhum formato novo, nenhum campo novo. Gráficos em SVG próprio, com rótulo e valor à vista e sem animação.
   Liga-se à casca só por MedTechCasca.registrar('secao', 'financas', ...). */
(function () {
  'use strict';
  var W = window, D = document;
  var U = W.MTUI, C = W.MTCofre, Casca = W.MedTechCasca, K = W.MTGestao && W.MTGestao.comum;
  if (!U || !C || !Casca || !K) { console.error('financas.js: falta ui.js, cofre.js, casca.js ou gestao.js'); return; }
  var esc = U.esc, real = K.real, realC = K.realCheio, hoje = K.hoje, data = K.data, iso = K.iso, p2 = K.p2, MESES = K.MESES;

  var ABAS = [['resumo', 'Resumo'], ['lancamentos', 'Lançamentos'], ['orcamento', 'Orçamento'], ['cartoes', 'Cartões'], ['dividas', 'Dívidas'], ['contas', 'Contas']];
  var DO_MES = { resumo: 1, lancamentos: 1, orcamento: 1 };
  var CHAVE_ABA = 'medtech.financas.aba', CHAVE_CONTA = 'medtech.financas.conta', CHAVE_CARTAO = 'medtech.financas.cartao';
  var DEMO = C.demo;

  function lerLS(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function gravaLS(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { } }

  var F = {
    el: null, aba: 'resumo', ref: new Date(), cartao: lerLS(CHAVE_CARTAO), fatSel: null, verQuitadas: false, verAgendados: false,
    filtro: { tipo: 'tudo', semCat: false, conta: null, categoria: null, busca: '', fatura: null }
  };
  (function () {
    var q = /[?&]fin=([a-z]+)/.exec(location.search), a = q ? q[1] : lerLS(CHAVE_ABA);
    if (ABAS.some(function (x) { return x[0] === a; })) F.aba = a;
  })();

  /* ---------- números e datas ---------- */
  var N1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  function mil(v) { return (v < 0 ? '−' : '') + N1.format(Math.abs(v) / 1000); }
  function sinal(v) { return (v < -0.004 ? '− ' : '+ ') + real(Math.abs(v)); }
  function soma(a, fn) { return a.reduce(function (s, x) { return s + (+fn(x) || 0); }, 0); }
  function mesDe(d, n) { return new Date(d.getFullYear(), d.getMonth() + (n || 0), 1); }
  function chaveMes(d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1); }
  function deChave(k) { var p = String(k || '').split('-'); return new Date(+p[0], +p[1] - 1, 1); }
  function ultimoDia(a, m) { return new Date(a, m + 1, 0).getDate(); }
  function diaNoMes(ref, dia) { return new Date(ref.getFullYear(), ref.getMonth(), Math.min(dia, ultimoDia(ref.getFullYear(), ref.getMonth()))); }
  function mesCurto3(d) { return K.primeira(MESES[d.getMonth()].slice(0, 3)); }
  function mesAnoCurto(s) { var d = typeof s === 'string' ? data(s) || deChave(s) : s; return d ? MESES[d.getMonth()].slice(0, 3) + '/' + String(d.getFullYear()).slice(2) : ''; }
  function mesAnoLongo(d) { return MESES[d.getMonth()] + ' de ' + d.getFullYear(); }
  function diaSemana(s) { var d = data(s); if (!d) return s; var r = K.rotuloDia(s); return /^(Hoje|Ontem|Amanhã)$/.test(r) ? r + ', ' + K.SEM_LONGO[d.getDay()].replace('-feira', '') + ' ' + K.dm(d) : K.primeira(K.SEM_LONGO[d.getDay()].replace('-feira', '')) + ' ' + K.dm(d); }
  function curtoDia(s) { var d = data(s); return d ? K.primeira(K.SEM_LONGO[d.getDay()].replace('-feira', '')) + ' ' + K.dm(d) : s; }

  /* ---------- regras do Granaê usadas na tela ---------- */
  var g = function () { return C.granae; };
  function semCategoria(t) { return !t.transferId && (!t.category || t.category === 'Outros'); }   // paraRevisar()
  function nomeConta(id) { var a = g().accounts.filter(function (x) { return x.id === id; })[0]; return a ? limpaNome(a.name) : ''; }
  function limpaNome(s) { return String(s || '').replace(/\s*••\d+$/, ''); }
  function conta(id) { return g().accounts.filter(function (x) { return x.id === id; })[0] || null; }
  function visaoConta(id) { return g().visao.contas.filter(function (x) { return x.id === id; })[0] || null; }
  /* faturaDoCartao: gasto depois do dia de fechamento cai na fatura do mês seguinte */
  function mesDaFatura(fech, s) { var d = data(s); if (!d) return null; var m = mesDe(d); return fech && d.getDate() > fech ? mesDe(m, 1) : m; }
  function vencimentoDe(fech, venc, mesFat) { if (!venc) return null; return diaNoMes(mesDe(mesFat, fech && venc <= fech ? 1 : 0), venc); }
  function compromissos() { return (g().calc.compromissos || []).map(function (c) { return Object.assign({}, c, { divida: c.kind === 'divida' }); }); }

  /* painel do mês (PainelFinancas) + o previsto pelos fixos */
  function painel(ref) {
    var m = K.painelFinancas(ref, g()), mes = m.r.s.getMonth() + 1;
    var ativos = g().fixedItems.filter(function (f) { return K.ativoEm(f, mes); });
    m.fixoEntra = soma(ativos.filter(function (f) { return f.type === 'income'; }), function (f) { return f.amount; });
    m.fixoSai = soma(ativos.filter(function (f) { return f.type === 'expense'; }), function (f) { return f.amount; });
    m.fixos = ativos;
    return m;
  }
  function fluxo(ref) {
    var r = K.mesCivil(ref), o = { entrou: 0, saiu: 0 };
    g().transactions.forEach(function (t) { if (t.pending || t.transferId || !K.contem(r, t.date)) return; if (t.type === 'income') o.entrou += t.amount; else o.saiu += t.amount; });
    return o;
  }
  /* a mesma base do projecaoSaldo(): tudo o que entrou menos o que saiu, sem agendados nem transferências */
  function acumuladoAte(fim) {
    var lim = fim < hoje() ? fim : hoje();
    return soma(g().transactions.filter(function (t) { return !t.pending && !t.transferId && t.date <= lim; }), function (t) { return t.type === 'income' ? t.amount : -t.amount; });
  }
  function riscos(m) {
    var com = m.categorias.filter(function (c) { return c.teto > 0; });
    return {
      com: com,
      passou: com.filter(function (c) { return c.gasto > c.teto + 0.004; }).sort(function (a, b) { return (b.gasto - b.teto) - (a.gasto - a.teto); }),
      perto: com.filter(function (c) { return c.gasto <= c.teto + 0.004 && c.gasto >= c.teto * 0.8; })
    };
  }
  function precisaReconectar(i) { return !!(i.error || /ERROR|OUTDATED/.test(i.status || '')); }
  function dataDoMs(v) { var d = typeof v === 'number' ? new Date(v) : new Date(Date.parse(v)); return isNaN(d) ? null : d; }

  /* ---------- gráficos: SVG estático, rótulo e valor à vista ---------- */
  var LARG = 322;
  function caminhoBarra(x, y, w, h) {
    if (h <= 0) return '';
    var r = Math.min(4, h, w / 2);
    return 'M' + x + ',' + (y + h) + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + (y + h) + 'Z';
  }
  function rosca(fatias, rotulo) {
    var R = 52, E = 20, Cc = 2 * Math.PI * R, tot = soma(fatias, function (f) { return f.v; }) || 1, off = 0, gap = fatias.length > 1 ? 1.6 : 0;
    return '<svg viewBox="0 0 132 132" role="img" aria-label="' + esc(rotulo) + '">' + fatias.map(function (f) {
      var len = Math.max(0, f.v / tot * Cc - gap);
      var a = '<circle cx="66" cy="66" r="' + R + '" fill="none" stroke="var(' + f.cor + ')" stroke-width="' + E + '" stroke-dasharray="' + len.toFixed(2) + ' ' + (Cc - len).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '" transform="rotate(-90 66 66)"><title>' + esc(f.n + ': ' + real(f.v)) + '</title></circle>';
      off += f.v / tot * Cc; return a;
    }).join('') + '</svg>';
  }
  function barrasAgrupadas(meses) {
    var top = 22, base = 160, max = Math.max.apply(null, meses.map(function (d) { return Math.max(d.entrou, d.saiu); }).concat([1])) * 1.08;
    var gw = LARG / meses.length, bw = 17, g0 = '<line class="fz-eixo" x1="0" x2="' + LARG + '" y1="' + base + '" y2="' + base + '"/>';
    meses.forEach(function (d, i) {
      var cx = gw * i + gw / 2, hE = d.entrou / max * (base - top), hS = d.saiu / max * (base - top), x1 = cx - bw - 1.5, x2 = cx + 1.5, at = d.atual ? ' class="forte"' : '';
      g0 += '<path d="' + caminhoBarra(x1, base - hE, bw, hE) + '" fill="var(--fz-entra)"><title>' + esc(d.m + ', entrou ' + real(d.entrou)) + '</title></path>';
      g0 += '<path d="' + caminhoBarra(x2, base - hS, bw, hS) + '" fill="var(--fz-sai)"><title>' + esc(d.m + ', saiu ' + real(d.saiu)) + '</title></path>';
      g0 += '<text x="' + (x1 + bw / 2) + '" y="' + (base - hE - 5) + '" text-anchor="middle"' + at + '>' + mil(d.entrou) + '</text>';
      g0 += '<text x="' + (x2 + bw / 2) + '" y="' + (base - hS - 5 - (Math.abs(hE - hS) < 12 ? 11 : 0)) + '" text-anchor="middle"' + at + '>' + mil(d.saiu) + '</text>';
      g0 += '<text x="' + cx + '" y="' + (base + 20) + '" text-anchor="middle"' + at + ' style="font-size:13px">' + esc(d.m) + '</text>';
    });
    return '<svg viewBox="0 0 ' + LARG + ' 186" role="img" aria-label="' + esc('Entrou e saiu, ' + meses.map(function (d) { return d.m + ': entrou ' + real(d.entrou) + ', saiu ' + real(d.saiu); }).join('; ')) + '">' + g0 + '</svg>';
  }
  function linhaSaldo(pts) {
    var top = 26, base = 150, vs = pts.map(function (p) { return p.v; });
    var mn = Math.min.apply(null, vs), mx = Math.max.apply(null, vs), folga = (mx - mn) * 0.12 || Math.abs(mx) * 0.1 || 1000;
    mn -= folga; mx += folga;
    var step = (LARG - 30) / Math.max(1, pts.length - 1);
    var xy = pts.map(function (p, i) { return { x: 15 + i * step, y: base - (p.v - mn) / (mx - mn) * (base - top), p: p }; });
    var reais = xy.filter(function (q) { return !q.p.p; }), proj = xy.filter(function (q) { return q.p.p; });
    var g0 = '<line class="fz-eixo" x1="0" x2="' + LARG + '" y1="' + base + '" y2="' + base + '"/>';
    if (mn < 0 && mx > 0) { var y0 = base - (0 - mn) / (mx - mn) * (base - top); g0 += '<line class="fz-eixo" x1="0" x2="' + LARG + '" y1="' + y0 + '" y2="' + y0 + '" stroke-dasharray="2 4"/>'; }
    g0 += '<polyline points="' + reais.map(function (q) { return q.x + ',' + q.y; }).join(' ') + '" fill="none" stroke="var(--g-fi)" stroke-width="2.5" stroke-linejoin="round"/>';
    if (proj.length) g0 += '<polyline points="' + [reais[reais.length - 1]].concat(proj).map(function (q) { return q.x + ',' + q.y; }).join(' ') + '" fill="none" stroke="var(--g-fi)" stroke-width="2.5" stroke-dasharray="5 5"/>';
    xy.forEach(function (q) {
      var at = q.p.atual ? ' class="forte"' : '';
      g0 += '<circle cx="' + q.x + '" cy="' + q.y + '" r="' + (q.p.atual ? 5.5 : 4) + '" fill="' + (q.p.p ? 'var(--sup)' : 'var(--g-fi)') + '" stroke="' + (q.p.p ? 'var(--g-fi)' : 'var(--sup)') + '" stroke-width="2"><title>' + esc(q.p.m + ': ' + real(q.p.v) + (q.p.p ? ' (projeção)' : '')) + '</title></circle>';
      g0 += '<text x="' + q.x + '" y="' + Math.max(12, q.y - 11) + '" text-anchor="middle"' + at + '>' + mil(q.p.v) + '</text>';
      g0 += '<text x="' + q.x + '" y="' + (base + 20) + '" text-anchor="middle"' + at + ' style="font-size:13px">' + esc(q.p.m) + '</text>';
    });
    return '<svg viewBox="0 0 ' + LARG + ' 176" role="img" aria-label="' + esc('Saldo no fim de cada mês: ' + pts.map(function (p) { return p.m + ' ' + real(p.v) + (p.p ? ' (projeção)' : ''); }).join('; ')) + '">' + g0 + '</svg>';
  }
  function barrasSimples(dados, rotulo) {
    var top = 24, base = 128, gw = LARG / dados.length, bw = 28, max = Math.max.apply(null, dados.map(function (d) { return d.v; }).concat([1])) * 1.05;
    var g0 = '<line class="fz-eixo" x1="0" x2="' + LARG + '" y1="' + base + '" y2="' + base + '"/>';
    dados.forEach(function (d, i) {
      var cx = gw * i + gw / 2, h = d.v / max * (base - top);
      g0 += '<path d="' + caminhoBarra(cx - bw / 2, base - h, bw, h) + '" fill="var(--g-fi)"><title>' + esc(d.m + ': ' + real(d.v)) + '</title></path>';
      g0 += '<text x="' + cx + '" y="' + (base - h - 6) + '" text-anchor="middle" class="forte" style="font-size:12.5px">' + (d.v ? esc(real(Math.round(d.v)).replace('R$ ', '').replace('R$', '')) : '0') + '</text>';
      g0 += '<text x="' + cx + '" y="' + (base + 20) + '" text-anchor="middle" style="font-size:13px">' + esc(d.m) + '</text>';
    });
    return '<svg viewBox="0 0 ' + LARG + ' 154" role="img" aria-label="' + esc(rotulo + ': ' + dados.map(function (d) { return d.m + ' ' + real(d.v); }).join('; ')) + '">' + g0 + '</svg>';
  }
  /* Até quando você paga: uma barra por dívida, do hoje ao fim; sem fim conhecido, contorno tracejado */
  function linhaDoTempo(lista) {
    var h0 = new Date(), ini = h0.getFullYear() + h0.getMonth() / 12;
    var fins = lista.filter(function (l) { return l.fim; }).map(function (l) { var d = data(l.fim); return d ? d.getFullYear() + d.getMonth() / 12 : ini; });
    var fim = Math.max(Math.ceil(Math.max.apply(null, fins.concat([ini + 1]))), Math.floor(ini) + 2);
    var x = function (a) { return Math.max(0, Math.min(LARG, (a - ini) / (fim - ini) * LARG)); };
    var alt = 14 + lista.length * 44, g0 = '', anos = [], passo = Math.max(1, Math.ceil((fim - Math.floor(ini)) / 4));
    for (var a = Math.floor(ini) + 1; a <= fim; a += passo) anos.push(a);
    if (anos[anos.length - 1] !== fim) anos.push(fim);
    anos.forEach(function (a) {
      g0 += '<line class="fz-eixo" x1="' + x(a) + '" x2="' + x(a) + '" y1="0" y2="' + (alt - 12) + '" stroke-dasharray="2 4"/><text x="' + (a === fim ? LARG : x(a)) + '" y="' + (alt + 8) + '" text-anchor="' + (a === fim ? 'end' : 'middle') + '" style="font-size:12.5px">' + a + '</text>';
    });
    lista.forEach(function (l, i) {
      var y = 14 + i * 44, nome = l.nome.length > 22 ? l.nome.slice(0, 21) + '…' : l.nome;
      g0 += '<text x="0" y="' + y + '" class="forte" style="font-size:14px">' + esc(nome) + '</text>';
      g0 += '<text x="' + LARG + '" y="' + y + '" text-anchor="end" style="font-size:13.5px">' + esc(l.txt) + '</text>';
      if (l.fim) {
        var d = data(l.fim), w = d ? x(d.getFullYear() + d.getMonth() / 12) : 0;
        g0 += '<rect x="0" y="' + (y + 8) + '" width="' + Math.max(6, w).toFixed(1) + '" height="14" rx="4" fill="var(--g-fi)"><title>' + esc(l.nome + ' ' + l.txt) + '</title></rect>';
      } else {
        g0 += '<rect x="0.6" y="' + (y + 8) + '" width="' + (LARG - 1.2) + '" height="14" rx="4" fill="none" stroke="var(--tinta2)" stroke-width="1.2" stroke-dasharray="4 4"><title>' + esc(l.nome + ', ' + l.txt) + '</title></rect>';
      }
    });
    return '<svg viewBox="0 0 ' + LARG + ' ' + (alt + 14) + '" role="img" aria-label="' + esc('Até quando você paga: ' + lista.map(function (l) { return l.nome + ' ' + l.txt; }).join('; ')) + '">' + g0 + '</svg>';
  }

  /* ---------- peças de tela ---------- */
  function trilho(frac, cls, teto, rotulo) {
    var pct = Math.max(0, Math.min(100, frac * 100));
    return '<div class="fz-trilho" role="img" aria-label="' + esc(rotulo || Math.round(frac * 100) + '%') + '"><i class="' + (cls || '') + '" style="width:' + (pct > 0 ? Math.max(1.5, pct).toFixed(1) : 0) + '%"></i>' +
      (teto != null ? '<span class="fz-teto" style="left:calc(' + (teto * 100).toFixed(1) + '% - 1.5px)"></span>' : '') + '</div>';
  }
  function selo(txt, cls) { return '<span class="fz-selo' + (cls ? ' ' + cls : '') + '">' + esc(txt) + '</span>'; }
  function item(o) {
    return '<div class="fz-item"><div class="fz-e"><b>' + esc(o.t) + '</b>' + (o.sub ? '<small>' + esc(o.sub) + '</small>' : '') + '</div><div class="fz-d"><b' + (o.cor ? ' style="color:' + o.cor + '"' : '') + '>' + esc(o.v) + '</b>' + (o.selo ? selo(o.selo, o.seloCls) : '') + '</div></div>';
  }
  function abas() {
    return '<div class="fz-abas" role="tablist" aria-label="Partes de Finanças">' + ABAS.map(function (a) {
      var s = a[0] === F.aba;
      return '<button type="button" role="tab" class="fz-aba' + (s ? ' sel' : '') + '" data-aba="' + a[0] + '" aria-selected="' + s + '">' + a[1] + '</button>';
    }).join('') + '</div>';
  }
  function cabeca() {
    if (DO_MES[F.aba]) {
      var r = K.mesCivil(F.ref);
      return K.cabecaMes({ titulo: K.mesExtenso(r.s), ano: String(r.s.getFullYear()), anterior: K.mesCurto(mesDe(r.s, -1)), seguinte: K.mesCurto(mesDe(r.s, 1)), corMais: 'var(--g-fi-tx)' });
    }
    var h0 = new Date(), t = ABAS.filter(function (a) { return a[0] === F.aba; })[0][1];
    return '<div class="g-cabeca"><div class="g-cab1"><span class="g-ano">Hoje, ' + h0.getDate() + ' de ' + MESES[h0.getMonth()] + '</span>' +
      '<button type="button" class="g-mais" data-acao="mais" style="color:var(--g-fi-tx)">Mais opções</button></div><h1 class="fz-titulo">' + esc(t) + '</h1>' +
      (F.aba === 'dividas' ? '<p class="fz-sub-tela">Financiamentos, empréstimos e o que você deve sem prazo</p>' : '') + '</div>';
  }
  function espera(txt) { return '<div class="g-cartao fz-pad"><p class="g-t2">' + esc(txt || 'Abrindo seus dados.') + '</p></div>'; }

  /* =====================================================================
     RESUMO
     ===================================================================== */
  function telaResumo() {
    var tem = C.temDinheiro, m = painel(F.ref), r = m.r, ant = painel(mesDe(r.s, -1)), V = g().visao;
    var ehAtual = chaveMes(r.s) === chaveMes(new Date());
    var h = '<div class="g-cartao g-resumo-f">';
    var notaE = [m.fixoEntra > 0 ? 'Previsto pelos fixos: ' + real(m.fixoEntra) : '', m.entrar > 0 ? real(m.entrar) + ' agendados para entrar' : ''].filter(Boolean).join('. ');
    h += '<div class="fz-ln"><span>Entrou</span><b style="color:var(--fz-entra-tx)">' + (tem ? real(m.entrou) : K.vazio(130)) + '</b></div>' + (tem && notaE ? '<p class="fz-nota">' + esc(notaE) + '</p>' : '<div class="fz-sem-nota"></div>');
    var comp = '';
    if (ant.saiu > 0 && m.saiu > 0) { var pc = Math.round((m.saiu - ant.saiu) / ant.saiu * 100); comp = pc === 0 ? 'Igual a ' + MESES[ant.r.s.getMonth()] : Math.abs(pc) + '% ' + (pc < 0 ? 'menos' : 'mais') + ' que em ' + MESES[ant.r.s.getMonth()]; }
    var notaS = [m.sair > 0 ? 'Ainda saem ' + real(m.sair) + ' até o fim do mês' : '', comp].filter(Boolean).join('. ');
    h += '<div class="fz-fio"></div><div class="fz-ln"><span>Saiu</span><b>' + (tem ? real(m.saiu) : K.vazio(130)) + '</b></div>' + (tem && notaS ? '<p class="fz-nota">' + esc(notaS) + '</p>' : '<div class="fz-sem-nota"></div>');
    h += '<div class="fz-fio"></div><div class="fz-saldo"><span>Saldo do mês</span><b' + (m.saldo < 0 ? ' style="color:var(--g-al-tx)"' : '') + '>' + (tem ? sinal(m.saldo) : K.vazio(110)) + '</b></div></div>';
    if (!tem) return h;

    var rk = riscos(m);
    if (rk.passou.length) {
      var x = rk.passou[0], resto = rk.passou.length - 1;
      var peq = [resto ? (resto === 1 ? 'Mais 1 categoria passou' : 'Mais ' + resto + ' categorias passaram') : '', rk.perto.length ? (rk.perto.length === 1 ? '1 categoria está perto do limite' : rk.perto.length + ' categorias estão perto do limite') : ''].filter(Boolean).join('. ');
      h += '<div class="fz-faixa fz-al"><p>' + esc(x.nome + ' passou do teto em ' + real(x.gasto - x.teto)) + (peq ? '<small>' + esc(peq) + '</small>' : '') + '</p><button type="button" class="fz-bt" data-ir="orcamento">Orçamento</button></div>';
    } else if (rk.perto.length) {
      h += '<div class="fz-faixa fz-av"><p>' + esc(rk.perto.length === 1 ? rk.perto[0].nome + ' está perto do teto' : rk.perto.length + ' categorias estão perto do teto') + '<small>A partir de 80% do teto do mês</small></p><button type="button" class="fz-bt" data-ir="orcamento">Orçamento</button></div>';
    }
    var semCat = m.lancamentos.filter(semCategoria), doBanco = semCat.filter(function (t) { return t.doBanco; }).length;
    if (semCat.length) {
      h += '<div class="fz-faixa fz-rx"><p>' + esc(semCat.length === 1 ? '1 lançamento sem categoria' : semCat.length + ' lançamentos sem categoria') + '<small>' + esc(doBanco ? (doBanco === semCat.length ? 'Chegaram pelo Open Finance' : doBanco + ' chegaram pelo Open Finance') : 'Escolha a categoria para entrar no orçamento') + '</small></p><button type="button" class="fz-bt" data-acao="revisar">Revisar</button></div>';
    }

    // rosca: 5 maiores e o resto somado
    var com = m.categorias.filter(function (c) { return c.gasto > 0; });
    h += '<div class="g-cartao fz-pad"><div class="fz-cab"><h2>Para onde foi</h2>' + (com.length ? '<small>toque para filtrar</small>' : '') + '</div>';
    if (!com.length) h += '<p class="g-t2">Nenhum gasto neste mês.</p>';
    else {
      var top = com.length === 6 ? com : com.slice(0, 5), resto2 = com.length === 6 ? [] : com.slice(5);
      var fatias = top.map(function (c, i) { return { n: c.nome, v: c.gasto, cor: '--fz-c' + (i + 1), cat: c.nome }; });
      if (resto2.length) fatias.push({ n: 'Outras ' + resto2.length, v: soma(resto2, function (c) { return c.gasto; }), cor: '--fz-c6', cat: null });
      h += '<div class="fz-rosca"><div class="fz-r">' + rosca(fatias, 'Gastos por categoria') + '<div class="fz-rc"><small>Saiu</small><b>' + real(m.saiu) + '</b></div></div><div class="fz-leg-cat">' +
        fatias.map(function (f) {
          return '<button type="button" class="fz-leg"' + (f.cat ? ' data-cat="' + esc(f.cat) + '"' : ' data-acao="saidas"') + '><i class="fz-dot" style="background:var(' + f.cor + ')"></i><span class="n">' + esc(f.n) + '</span><b>' + real(f.v) + '</b><em>' + Math.round(f.v / (m.saiu || 1) * 100) + '%</em></button>';
        }).join('') + '</div></div>';
    }
    h += '</div>';

    // barras de 6 meses
    var meses = [];
    for (var i = 5; i >= 0; i--) { var d = mesDe(r.s, -i), fl = fluxo(d); meses.push({ m: mesCurto3(d), entrou: fl.entrou, saiu: fl.saiu, atual: i === 0 }); }
    h += '<div class="g-cartao fz-pad fz-graf"><div class="fz-cab"><h2>Entrou e saiu</h2><small>R$ mil, 6 meses</small></div>' + barrasAgrupadas(meses) +
      '<div class="fz-legenda"><span><i style="background:var(--fz-entra)"></i>Entrou</span><span><i style="background:var(--fz-sai)"></i>Saiu</span></div></div>';

    // saldo acumulado com a projeção do Granaê
    var pts = [];
    for (var j = 5; j >= 0; j--) { var dm = mesDe(r.s, -j), fimM = iso(new Date(dm.getFullYear(), dm.getMonth() + 1, 0)); pts.push({ m: mesCurto3(dm), v: acumuladoAte(fimM), atual: j === 0 }); }
    var proj = ehAtual ? (g().calc.projecao || []) : [];
    proj.forEach(function (p) { pts.push({ m: mesCurto3(deChave(p.mes)), v: p.saldo, p: true }); });
    h += '<div class="g-cartao fz-pad fz-graf"><div class="fz-cab"><h2>Saldo acumulado</h2><small>R$ mil, fim do mês</small></div>' + linhaSaldo(pts) +
      '<div class="fz-legenda"><span><i class="ln"></i>Pelos lançamentos</span>' + (proj.length ? '<span><i class="tr"></i>Projeção pelos fixos e parcelas</span>' : '') + '</div>' +
      (proj.some(function (p) { return p.saldo < 0; }) ? '<p class="g-alerta-tx">No ritmo atual o saldo fica negativo em ' + esc(mesAnoLongo(deChave(proj.filter(function (p) { return p.saldo < 0; })[0].mes))) + '.</p>' : '') + '</div>';

    // atalhos
    var cartoes = V.contas.filter(function (c) { return c.cartao; }), prox = proximoVencimento(cartoes);
    var reconectar = ((g().feed && g().feed.items) || []).filter(precisaReconectar);
    var tetoTot = soma(rk.com, function (c) { return c.teto; }), gastoTeto = soma(rk.com, function (c) { return c.gasto; });
    var porMes = soma(V.financiamentos, function (x) { return x.parcela; });
    h += '<div class="fz-grade2">' +
      atalho('cartoes', 'Cartões', real(totalAbertas()), cartoes.length ? 'em faturas abertas' + (prox ? '. ' + prox.nome + ' vence ' + K.dm(prox.data) : '') : 'Nenhum cartão cadastrado') +
      atalho('dividas', 'Dívidas', real(V.devedor), V.financiamentos.length ? 'falta pagar' + (porMes ? '. ' + real(porMes) + ' por mês' : '') : 'Nenhuma dívida') +
      atalho('contas', 'Contas', real(V.saldoContas), reconectar.length ? reconectar[0].banco + ' precisa reconectar' : (g().feed ? 'lido ' + g().feed.lidoTxt : 'saldo em conta'), reconectar.length ? 'x-al' : '') +
      atalho('orcamento', 'Orçamento', tetoTot ? Math.round(gastoTeto / tetoTot * 100) + '%' : 'Sem teto', tetoTot ? 'do teto usado' + (rk.passou.length || rk.perto.length ? '. ' + [rk.passou.length ? rk.passou.length + ' passou' : '', rk.perto.length ? rk.perto.length + ' perto' : ''].filter(Boolean).join(', ') : '') : 'Defina tetos por categoria') +
      '</div>';

    // agendados do mês
    var ag = m.lancamentos.filter(function (t) { return t.pending && t.type === 'expense'; }).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    if (ag.length) {
      var mostra = F.verAgendados ? ag : ag.slice(0, 4);
      h += '<div class="g-cartao"><div class="fz-cab fz-cab-lista"><h2>Ainda saem este mês</h2><small>' + real(soma(ag, function (t) { return t.amount; })) + '</small></div><div class="fz-lista">' + mostra.map(function (t) {
        return '<button type="button" class="fz-item-bt" data-editar="' + esc(t.id) + '">' + item({ t: t.description, sub: [curtoDia(t.date), t.category, nomeConta(t.accountId)].filter(Boolean).join(' · '), v: '− ' + realC(t.amount), selo: 'agendado' }) + '</button>';
      }).join('') + '</div>' + (ag.length > 4 ? '<button type="button" class="fz-mais-lista" data-acao="ver-agendados">' + (F.verAgendados ? 'Mostrar menos' : 'Ver os ' + ag.length) + '</button>' : '') + '</div>';
    }
    h += '<button type="button" class="fz-claro" data-acao="ia">Analisar este mês com IA</button>';
    return h;
  }
  function atalho(aba, t, v, nota, cls) {
    return '<button type="button" class="fz-atalho" data-ir="' + aba + '"><span>' + esc(t) + '</span><b>' + esc(v) + '</b><small' + (cls ? ' class="' + cls + '"' : '') + '>' + esc(nota) + '</small></button>';
  }
  function proximoVencimento(cartoes) {
    var h0 = hoje(), melhor = null;
    cartoes.forEach(function (c) {
      if (!c.vence) return;
      var a = new Date(), d = diaNoMes(a, c.vence);
      if (iso(d) < h0) d = diaNoMes(mesDe(a, 1), c.vence);
      if (!melhor || d < melhor.data) melhor = { nome: limpaNome(c.nome), data: d };
    });
    return melhor;
  }

  /* =====================================================================
     LANÇAMENTOS
     ===================================================================== */
  function filtroLigado() { var f = F.filtro; return f.tipo !== 'tudo' || f.semCat || f.conta || f.categoria || f.busca.trim() || f.fatura; }
  function listaFiltrada() {
    var f = F.filtro, q = f.busca.trim().toLowerCase(), base;
    if (f.fatura) {
      var a = conta(f.fatura.conta), fech = a ? a.fechamento : null;
      base = g().transactions.filter(function (t) { return t.accountId === f.fatura.conta && t.type === 'expense' && chaveMes(mesDaFatura(fech, t.date) || new Date(0)) === f.fatura.mes; });
    } else {
      var r = K.mesCivil(F.ref);
      base = g().transactions.filter(function (t) { return K.contem(r, t.date); });
    }
    return base.filter(function (t) {
      if (f.tipo === 'saidas' && (t.type === 'income' || t.transferId)) return false;
      if (f.tipo === 'entradas' && (t.type !== 'income' || t.transferId)) return false;
      if (f.semCat && !semCategoria(t)) return false;
      if (f.conta && t.accountId !== f.conta) return false;
      if (f.categoria && t.category !== f.categoria) return false;
      if (q) {
        var valor = realC(t.amount).toLowerCase(), cru = String(t.amount).replace('.', ',');
        if ((t.description || '').toLowerCase().indexOf(q) < 0 && (t.category || '').toLowerCase().indexOf(q) < 0 && (t.sub || '').toLowerCase().indexOf(q) < 0 && valor.indexOf(q) < 0 && cru.indexOf(q) < 0) return false;
      }
      return true;
    });
  }
  function telaLancamentos() {
    var f = F.filtro, r = K.mesCivil(F.ref);
    var semCatN = g().transactions.filter(function (t) { return K.contem(r, t.date) && semCategoria(t); }).length;
    var h = '<input class="fz-busca" type="search" name="busca" placeholder="Buscar por descrição ou valor" aria-label="Buscar nos lançamentos" autocomplete="off" autocapitalize="off" value="' + esc(f.busca) + '">';
    h += '<div class="fz-chips" role="group" aria-label="Filtros">' +
      [['tudo', 'Tudo'], ['saidas', 'Saídas'], ['entradas', 'Entradas']].map(function (t) { return '<button type="button" class="fz-chip' + (f.tipo === t[0] ? ' sel' : '') + '" data-tipo="' + t[0] + '" aria-pressed="' + (f.tipo === t[0]) + '">' + t[1] + '</button>'; }).join('') +
      '<button type="button" class="fz-chip' + (f.semCat ? ' sel' : semCatN ? ' marc' : '') + '" data-acao="semcat" aria-pressed="' + f.semCat + '">Sem categoria ' + semCatN + '</button>' +
      '<button type="button" class="fz-chip' + (f.conta ? ' sel' : '') + '" data-acao="escolhe-conta">' + esc(f.conta ? limpaNome(nomeConta(f.conta)) || 'Conta' : 'Conta') + '</button>' +
      '<button type="button" class="fz-chip' + (f.categoria ? ' sel' : '') + '" data-acao="escolhe-cat">' + esc(f.categoria || 'Categoria') + '</button></div>';
    if (f.fatura) h += '<button type="button" class="fz-faixa-filtro" data-acao="limpa-fatura">' + esc('Fatura de ' + MESES[deChave(f.fatura.mes).getMonth()] + ' do ' + limpaNome(nomeConta(f.fatura.conta)) + '. Toque para voltar ao mês') + '</button>';
    else if (filtroLigado()) h += '<button type="button" class="fz-faixa-filtro" data-acao="limpa-filtro">Filtro ligado. Toque para mostrar tudo</button>';
    h += '<div class="fz-lanc-corpo">' + corpoLancamentos() + '</div>';
    return h;
  }
  function corpoLancamentos() {
    var l = listaFiltrada(), hj = hoje();
    var feitos = l.filter(function (t) { return !t.pending && !t.transferId; });
    var en = soma(feitos.filter(function (t) { return t.type === 'income'; }), function (t) { return t.amount; }), sa = soma(feitos.filter(function (t) { return t.type !== 'income'; }), function (t) { return t.amount; });
    /* a faixa resume em reais inteiros (como no protótipo); cada lançamento mostra os centavos */
    var h = '<div class="fz-tres"><div><small>Entradas</small><b style="color:var(--fz-entra-tx)">' + real(Math.round(en)) + '</b></div><div><small>Saídas</small><b>' + real(Math.round(sa)) + '</b></div><div><small>Saldo</small><b>' + sinal(Math.round(en - sa)) + '</b></div></div>';
    if (!C.temDinheiro) return h + espera();
    if (!l.length) return h + '<p class="g-vaziotx">' + (filtroLigado() ? 'Nada com esse filtro.' : 'Nada lançado neste mês.') + '</p>';
    function grupos(lista, cresc) {
      var dias = {}; lista.forEach(function (t) { (dias[t.date] = dias[t.date] || []).push(t); });
      return Object.keys(dias).sort(function (a, b) { return cresc ? (a < b ? -1 : 1) : (a < b ? 1 : -1); }).map(function (d) { return { dia: d, itens: dias[d] }; });
    }
    var passado = grupos(l.filter(function (t) { return t.date <= hj && !t.pending; }), false), porVir = grupos(l.filter(function (t) { return t.date > hj || t.pending; }), true);
    if (passado.length) h += '<div class="g-cartao">' + passado.map(blocoDia).join('') + '</div>';
    if (porVir.length) h += '<p class="fz-grupo-tit">Agendados</p><div class="g-cartao">' + porVir.map(blocoDia).join('') + '</div>';
    h += '<p class="fz-toque">Toque para editar. Deslize para a esquerda para excluir.</p>';
    return h;
  }
  function blocoDia(gr) {
    var tot = soma(gr.itens.filter(function (t) { return !t.transferId; }), function (t) { return t.type === 'income' ? t.amount : -t.amount; });
    return '<div class="fz-dia-cab"><span>' + esc(diaSemana(gr.dia)) + '</span><span>' + sinal(tot).replace('+ R$ 0', 'R$ 0') + '</span></div>' + gr.itens.map(linhaLanc).join('');
  }
  function linhaLanc(t) {
    var rec = t.type === 'income', pi = K.parcelaInfo(t.description), sem = semCategoria(t);
    var s = null, cls = '';
    if (t.transferId) s = 'transferência';
    else if (t.pending) s = 'agendado';
    else if (sem) { s = 'escolher categoria'; cls = 'x-al'; }
    else if (pi && (t.groupId || pi)) { s = 'parcela ' + pi.k + ' de ' + pi.n; cls = 'roxo'; }
    else if (t.doBanco) s = 'do banco';
    var cat = t.transferId ? 'Transferência, fora dos totais' : (sem && !t.category ? 'Sem categoria' : t.category) + (t.sub ? ', ' + t.sub : '');
    var sub = [cat, t.transferId ? '' : nomeConta(t.accountId)].filter(Boolean).join(' · ');
    var v = t.transferId ? realC(t.amount) : (rec ? '+ ' : '− ') + realC(t.amount);
    return K.linhaDeslizante('data-id="' + esc(t.id) + '"', null, { rotulo: 'Excluir', cor: 'var(--g-al)' },
      '<span class="fz-e"><b>' + esc(pi && cls === 'roxo' ? pi.base : t.description) + '</b><small>' + esc(sub) + '</small></span><span class="fz-d"><b' + (rec && !t.transferId ? ' style="color:var(--fz-entra-tx)"' : '') + '>' + esc(v) + '</b>' + (s ? selo(s, cls) : '') + '</span>');
  }

  /* =====================================================================
     ORÇAMENTO
     ===================================================================== */
  function telaOrcamento() {
    if (!C.temDinheiro) return espera();
    var m = painel(F.ref), rk = riscos(m), r = m.r;
    var gasto = soma(rk.com, function (c) { return c.gasto; }), teto = soma(rk.com, function (c) { return c.teto; });
    var h = '';
    if (teto > 0) {
      var p = gasto / teto, falta = teto - gasto, dias = chaveMes(r.s) === chaveMes(new Date()) ? ultimoDia(r.s.getFullYear(), r.s.getMonth()) - new Date().getDate() + 1 : 0;
      h += '<div class="g-cartao fz-pad"><div class="fz-hero2"><div class="a"><small>Gasto com teto</small><b>' + real(gasto) + '</b></div><div class="b"><small>Teto do mês</small><b>' + real(teto) + '</b></div></div>' +
        trilho(Math.min(1, p), p > 1 ? 'x-al' : p >= 0.8 ? 'x-av' : '', null, Math.round(p * 100) + '% do teto usado') +
        '<p class="fz-med g-t2">' + Math.round(p * 100) + '% usado. ' + (falta >= 0 ? 'Sobram ' + real(falta) + (dias > 0 ? (dias === 1 ? ' para hoje' : ' para ' + dias + ' dias') : '') : 'Passou ' + real(-falta)) + '</p></div>';
    } else h += '<div class="g-cartao fz-pad"><p class="g-t2">Nenhuma categoria tem teto neste mês. Toque em Definir teto numa categoria abaixo, ou cadastre fixos: sem teto próprio, vale a soma dos fixos da categoria.</p></div>';

    var subs = g().budgets.filter(function (b) { return b.tipo === 'sub' && b.valor > 0; });
    function gastoSub(b) { return soma(g().transactions.filter(function (t) { return t.type === 'expense' && t.category === b.ref && (t.sub || '') === (b.sub || '') && K.contem(r, t.date) && !t.transferId; }), function (t) { return t.amount; }); }
    function linha(c, sub, pai) {
      var p = c.teto > 0 ? c.gasto / c.teto : 0, cls = p > 1 ? 'x-al' : p >= 0.8 ? 'x-av' : '', f = c.teto - c.gasto;
      var txt = p > 1 ? '<strong class="x-al">Passou ' + real(-f) + '</strong>' : p >= 0.8 ? '<strong class="x-av">Perto, sobram ' + real(f) + '</strong>' : '<span>Sobram ' + real(f) + '</span>';
      var catObj = !sub && g().categories.filter(function (x) { return x.name === c.nome && x.type === 'expense'; })[0];
      return '<div class="fz-orc' + (sub ? ' sub' : '') + '"><div class="l1"><b>' + esc(sub ? c.nome + ', dentro de ' + pai : c.nome) + '</b><span>' + Math.round(p * 100) + '%</span></div>' +
        trilho(Math.min(1, c.gasto / Math.max(c.teto, c.gasto || 1)), cls, c.gasto > c.teto ? c.teto / c.gasto : null, c.nome + ': ' + real(c.gasto) + ' de ' + real(c.teto)) +
        '<div class="l2"><span>' + real(c.gasto) + ' de ' + real(c.teto) + '</span>' + txt + '</div>' +
        (catObj ? '<button type="button" class="fz-link-p" data-teto="' + esc(catObj.id) + '">Mudar teto</button>' : '') + '</div>';
    }
    var ord = rk.com.slice().sort(function (a, b) { return b.gasto / b.teto - a.gasto / a.teto; }), usados = {};
    if (ord.length) {
      h += '<div class="g-cartao">' + ord.map(function (c) {
        return linha(c) + subs.filter(function (b) { return b.ref === c.nome; }).map(function (b) { usados[b.id] = 1; return linha({ nome: b.sub || 'Sem subcategoria', gasto: gastoSub(b), teto: b.valor }, true, c.nome); }).join('');
      }).join('') + subs.filter(function (b) { return !usados[b.id]; }).map(function (b) { return linha({ nome: b.sub || 'Sem subcategoria', gasto: gastoSub(b), teto: b.valor }, true, b.ref); }).join('') + '</div>';
      h += '<p class="fz-peq g-t2">Roxo: dentro do teto. Âmbar: a partir de 80%. Laranja: passou, e o traço marca onde estava o teto.</p>';
    }
    var semTeto = m.categorias.filter(function (c) { return !(c.teto > 0) && c.gasto > 0; });
    if (semTeto.length) {
      h += '<p class="fz-grupo-tit">Sem teto</p><div class="g-cartao"><div class="fz-lista">' + semTeto.map(function (c) {
        var catObj = g().categories.filter(function (x) { return x.name === c.nome && x.type === 'expense'; })[0];
        return '<div class="fz-item"><div class="fz-e"><b>' + esc(c.nome) + '</b></div><div class="fz-d"><b>' + real(c.gasto) + '</b></div>' + (catObj ? '<button type="button" class="fz-link-p" data-teto="' + esc(catObj.id) + '">Definir teto</button>' : '') + '</div>';
      }).join('') + '</div></div>';
    }
    // fixos do mês (renderFixedCompare)
    h += '<p class="fz-grupo-tit">Fixos do mês</p><div class="g-cartao">';
    if (!m.fixos.length) h += '<div class="fz-pad"><p class="g-t2">Nenhum fixo cadastrado. Fixos são o que entra e sai todo mês, como salário e aluguel.</p></div>';
    else {
      var pe = m.fixoEntra > 0 ? m.entrou / m.fixoEntra : 0, ps = m.fixoSai > 0 ? m.saiu / m.fixoSai : 0;
      if (m.fixoEntra > 0) h += '<div class="fz-orc"><div class="l1"><b>Receitas fixas</b><span style="color:var(--fz-entra-tx)">' + Math.round(pe * 100) + '%</span></div>' + trilho(Math.min(1, pe), 'en') + '<div class="l2"><span>Previsto ' + real(m.fixoEntra) + '</span><span>Entrou ' + real(m.entrou) + '</span></div></div>';
      if (m.fixoSai > 0) h += '<div class="fz-orc"><div class="l1"><b>Despesas fixas</b><span' + (ps > 1 ? ' class="x-al"' : '') + '>' + Math.round(ps * 100) + '%</span></div>' + trilho(Math.min(1, ps), ps > 1 ? 'x-al' : '') + '<div class="l2"><span>Previsto ' + real(m.fixoSai) + '</span><span>Saiu ' + real(m.saiu) + '</span></div></div>';
      var fx = m.fixos.slice().sort(function (a, b) { return a.type !== b.type ? (a.type === 'income' ? -1 : 1) : b.amount - a.amount; });
      h += '<div class="fz-lista fz-fio-top">' + fx.map(function (f) {
        return '<button type="button" class="fz-item-bt" data-fixo="' + esc(f.id) + '">' + item({ t: f.name, sub: f.category + ' · ' + (f.frequency === 'yearly' ? 'todo ano, em ' + MESES[(f.month || 1) - 1] : 'todo mês'), v: (f.type === 'income' ? '+ ' : '') + real(f.amount), cor: f.type === 'income' ? 'var(--fz-entra-tx)' : '' }) + '</button>';
      }).join('') + '</div>';
    }
    h += '</div><div class="fz-par"><button type="button" class="fz-claro" data-acao="fixos">Editar fixos</button><button type="button" class="fz-claro" data-acao="tetos">Editar tetos</button></div>';
    return h;
  }

  /* =====================================================================
     CARTÕES
     ===================================================================== */
  function cartoesLista() { return g().visao.contas.filter(function (c) { return c.cartao; }); }
  function infoCartao(c) {
    var a = conta(c.id) || {}, fech = c.fecha || a.fechamento || null, venc = c.vence || a.vencimento || null;
    var aberta = mesDaFatura(fech, hoje());
    var lista = (g().calc.faturas[c.id] || []).map(function (x) { return Object.assign({}, x, { ref: deChave(x.mes) }); });
    var iA = lista.map(function (x) { return x.mes; }).indexOf(chaveMes(aberta));
    var tira = lista.slice(Math.max(0, iA - 1), Math.max(0, iA - 1) + 5).map(function (x) {
      var k = x.mes < chaveMes(aberta) ? -1 : x.mes === chaveMes(aberta) ? 0 : 1;
      var v = k === 0 && c.doBanco ? c.fatura : x.total;
      return Object.assign(x, { k: k, v: v, st: x.paga ? 'paga' : k < 0 ? 'fechada' : k === 0 ? 'aberta' : 'prevista' });
    });
    return { fech: fech, venc: venc, aberta: aberta, tira: tira, fechaEm: fech ? diaNoMes(aberta, fech) : null, venceEm: vencimentoDe(fech, venc, aberta) };
  }
  /* valor da fatura aberta: a do banco quando o cartão é conectado; senão faturaDoCartao do mês em que cai uma compra feita hoje */
  function abertaDe(c) { var t = infoCartao(c).tira.filter(function (x) { return x.k === 0; })[0]; return t ? t.v : (c.fatura || 0); }
  function totalAbertas() { return soma(cartoesLista(), abertaDe); }
  function telaCartoes() {
    if (!C.temDinheiro) return espera();
    var cs = cartoesLista(), V = g().visao;
    if (!cs.length) return '<div class="g-cartao fz-pad"><p class="g-t2">Nenhum cartão ainda. Conecte o banco em Contas para os cartões chegarem sozinhos, ou cadastre um cartão com o dia de fechamento e o de vencimento.</p></div><button type="button" class="fz-claro" data-acao="novo-cartao">Novo cartão</button>';
    var c = cs.filter(function (x) { return x.id === F.cartao; })[0] || cs[0];
    F.cartao = c.id;
    var inf = infoCartao(c);
    var h = '<div class="fz-cartoes-sel' + (cs.length > 2 ? ' tres' : '') + '" role="group" aria-label="Cartão">' + cs.map(function (x) {
      return '<button type="button" class="' + (x.id === c.id ? 'sel' : '') + '" data-cartao="' + esc(x.id) + '" aria-pressed="' + (x.id === c.id) + '"><b>' + esc(limpaNome(x.nome)) + '</b><small>' + realC(abertaDe(x)) + '</small></button>';
    }).join('') + '</div>';
    var sel = inf.tira.filter(function (x) { return x.mes === F.fatSel; })[0] || inf.tira.filter(function (x) { return x.k === 0; })[0] || inf.tira[0];
    F.fatSel = sel ? sel.mes : null;
    var fr = g().feed;
    var usado = c.limite ? (c.disponivel != null ? c.limite - c.disponivel : (c.fatura || 0)) : 0;
    h += '<div class="g-cartao fz-pad"><div class="fz-cab fz-cab0"><small>' + esc('Fatura de ' + MESES[sel.ref.getMonth()] + ', ' + sel.st) + '</small>' + (sel.k === 0 ? selo(c.doBanco ? 'do banco' + (fr && fr.lidoTxt ? ', lida ' + fr.lidoTxt : '') : 'pelos lançamentos') : '') + '</div>' +
      '<div class="fz-grande">' + realC(sel.v) + '</div>' +
      '<p class="fz-med g-t2">' + esc(sel.k === 0 ? [inf.fechaEm ? 'Fecha ' + K.dm(inf.fechaEm) : 'Sem dia de fechamento', inf.venceEm ? 'vence ' + K.dm(inf.venceEm) : ''].filter(Boolean).join(' · ') : (inf.fech ? 'Fecha ' + K.dm(diaNoMes(sel.ref, inf.fech)) : '') + (inf.venc ? (inf.fech ? ' · ' : '') + 'vence ' + K.dm(vencimentoDe(inf.fech, inf.venc, sel.ref)) : '')) + '</p>';
    if (c.limite) h += '<div class="fz-mt">' + trilho(Math.min(1, usado / c.limite), usado / c.limite > 0.8 ? 'x-av' : '', null, 'Limite usado ' + Math.round(usado / c.limite * 100) + '%') + '</div><div class="fz-limite"><span class="g-t2">Usado ' + real(usado) + ' de ' + real(c.limite) + '</span><b>Livre ' + real(c.limite - usado) + '</b></div>';
    else h += '<p class="fz-peq g-t2 fz-mt">Limite não informado.</p>';
    var a = conta(c.id);
    if (a && a.orcamento > 0) {
      var r = K.mesCivil(new Date()), gm = soma(g().transactions.filter(function (t) { return t.type === 'expense' && t.accountId === c.id && K.contem(r, t.date) && !t.transferId; }), function (t) { return t.amount; }), po = gm / a.orcamento;
      h += '<p class="fz-peq fz-mt' + (po > 1 ? ' x-al' : po >= 0.8 ? ' x-av' : ' g-t2') + '">' + esc('Teto do cartão em ' + MESES[r.s.getMonth()] + ': ' + real(gm) + ' de ' + real(a.orcamento) + ' (' + Math.round(po * 100) + '%)') + '</p>';
    }
    h += '</div>';
    var fechada = inf.tira.filter(function (x) { return x.k < 0 && !x.paga && x.v > 0; }).pop();
    if (fechada) {
      var vf = vencimentoDe(inf.fech, inf.venc, fechada.ref);
      h += '<div class="fz-faixa ' + (vf && iso(vf) < hoje() ? 'fz-al' : 'fz-av') + '"><p>' + esc('Fatura de ' + MESES[fechada.ref.getMonth()] + ' fechou em ' + realC(fechada.v)) + '<small>' + esc(vf ? (iso(vf) < hoje() ? 'Venceu em ' + K.dm(vf) + '. Já pagou? Marque como paga' : 'Vence ' + K.dm(vf) + '. Depois de pagar, marque como paga') : 'Depois de pagar, marque como paga') + '</small></p><button type="button" class="fz-bt" data-pagafat="' + fechada.mes + '">Paga</button></div>';
    }
    h += '<div class="fz-faturas" role="group" aria-label="Faturas">' + inf.tira.map(function (x) {
      return '<button type="button" class="' + x.st + (x.mes === sel.mes ? ' sel' : '') + '" data-fat="' + x.mes + '" aria-pressed="' + (x.mes === sel.mes) + '" aria-label="' + esc('Fatura de ' + MESES[x.ref.getMonth()] + ', ' + real(x.v) + ', ' + x.st) + '"><small>' + mesCurto3(x.ref) + '</small><b>' + (x.v >= 1000 ? mil(x.v) + ' mil' : real(Math.round(x.v))) + '</b><em>' + x.st + '</em></button>';
    }).join('') + '</div>';
    h += '<div class="fz-par"><button type="button" class="fz-claro" data-acao="compras">' + (sel.n === 1 ? 'Ver a compra' : 'Ver as ' + sel.n + ' compras') + '</button>' +
      (sel.k <= 0 ? '<button type="button" class="fz-claro" data-acao="paga">' + (sel.paga ? 'Desmarcar paga' : 'Marcar como paga') + '</button>' : '') + '</div>';
    // peso das parcelas (comprometimentoPorMes só deste cartão)
    var hj = hoje(), pesos = [];
    for (var i = 0; i < 6; i++) {
      var ref = mesDe(new Date(), i), rr = K.mesCivil(ref);
      pesos.push({ m: mesCurto3(ref), v: soma(g().transactions.filter(function (t) { return t.type === 'expense' && t.accountId === c.id && K.chaveGrupo(t) && K.contem(rr, t.date) && t.date >= hj; }), function (t) { return t.amount; }) });
    }
    h += '<div class="g-cartao fz-pad fz-graf"><div class="fz-cab"><h2>Parcelas nos próximos meses</h2></div><p class="fz-peq g-t2 fz-sob">Só o que já está parcelado neste cartão, sem compras novas</p>' +
      (pesos.some(function (p) { return p.v > 0; }) ? barrasSimples(pesos, 'Parcelas já compradas neste cartão por mês') : '<p class="g-t2">Nenhuma parcela futura neste cartão.</p>') + '</div>';
    var par = compromissos().filter(function (x) { return x.accountId === c.id && !x.quitado && x.kind !== 'divida' && x.kind !== 'financiamento' && x.type === 'expense'; })
      .sort(function (a, b) { return (a.ultima || '').localeCompare(b.ultima || ''); });
    if (par.length) {
      h += '<div class="g-cartao"><div class="fz-cab fz-cab-lista"><h2>Compras parceladas</h2><small>' + real(soma(par, function (x) { return x.valorParcela; })) + ' por mês</small></div>' + par.map(function (x) {
        return '<div class="fz-parc"><div class="l1"><b>' + esc(x.descricao) + '</b><span>' + x.pagas + ' de ' + x.n + '</span></div>' + trilho(x.n ? x.pagas / x.n : 0, '', null, x.pagas + ' de ' + x.n + ' parcelas') +
          '<div class="l2">' + esc(real(x.valorParcela) + ' por mês · falta ' + real(x.aPagar) + (x.estimado ? ' (estimado)' : '') + (x.ultima ? ' · até ' + mesAnoCurto(x.ultima) : '')) + '</div></div>';
      }).join('') + '</div>';
    }
    var prox = proximoVencimento(cs);
    h += '<div class="fz-faixa fz-rx"><p>Todos os cartões<small>' + esc(realC(totalAbertas()) + ' em faturas abertas' + (prox ? '. Próximo vencimento: ' + prox.nome + ', ' + K.dm(prox.data) : '')) + '</small></p></div>';
    h += '<button type="button" class="fz-claro" data-acao="novo-cartao">Novo cartão</button>';
    return h;
  }

  /* =====================================================================
     DÍVIDAS
     ===================================================================== */
  var TIPO_DIV = { banco: 'Informado pelo banco', financiamento: 'Financiamento', lancamentos: 'Achado no extrato', cadastro: 'Dívida sem prazo' };
  function telaDividas() {
    if (!C.temDinheiro) return espera();
    var V = g().visao, fins = V.financiamentos, porMes = soma(fins, function (x) { return x.parcela; });
    var h = '<div class="g-cartao fz-pad"><div class="fz-hero2"><div class="a"><small>Falta pagar</small><b>' + real(V.devedor) + '</b></div><div class="b"><small>Sai por mês</small><b>' + real(porMes) + '</b></div></div>' +
      (V.semSaldo ? '<p class="fz-peq g-t2 fz-mt6">' + esc(V.semSaldo === 1 ? 'Mais 1 dívida sem saldo informado' : 'Mais ' + V.semSaldo + ' dívidas sem saldo informado') + '</p>' : '') + '</div>';
    if (!fins.length) h += '<div class="g-cartao fz-pad"><p class="g-t2">Nenhuma dívida em aberto. Financiamentos do banco, parcelas que se repetem no extrato e dívidas cadastradas aparecem aqui.</p></div>';
    else {
      h += '<div class="g-cartao fz-pad fz-graf"><div class="fz-cab"><h2>Até quando você paga</h2></div>' + linhaDoTempo(fins.map(function (x) {
        return { nome: x.nome, fim: x.fim || null, txt: x.fim ? 'até ' + mesAnoCurto(x.fim) : x.fonte === 'cadastro' ? 'sem prazo' : 'fim não informado' };
      })) + '</div>';
      fins.forEach(function (x) {
        var cmt = x.fonte === 'financiamento' ? g().commitments.filter(function (c) { return 'fin:' + c.id === x.chave; })[0] : null;
        h += '<div class="g-cartao fz-pad fz-divida"><div class="topo"><div><b>' + esc(x.nome) + '</b><small>' + esc([TIPO_DIV[x.fonte], x.banco].filter(Boolean).join(' · ')) + '</small></div>' +
          '<div class="valor"><small>Saldo devedor</small><b>' + (x.devedor != null ? real(x.devedor) : 'falta informar') + '</b></div></div>';
        if (x.total) {
          h += trilho((x.pagas || 0) / x.total, '', null, (x.pagas || 0) + ' de ' + x.total + ' parcelas pagas') + '<p class="fz-med"><b>' + (x.pagas || 0) + ' de ' + x.total + ' parcelas pagas</b><span class="g-t2"> · faltam ' + Math.max(0, x.total - (x.pagas || 0)) + '</span>' + (x.atraso ? ' <b class="x-al">· ' + x.atraso + ' em atraso</b>' : '') + '</p>' +
            '<div class="dados"><div><small>Parcela</small><b>' + (x.parcela ? real(x.parcela) : 'não informada') + '</b></div><div><small>Termina em</small><b>' + (x.fim ? esc(mesAnoLongo(data(x.fim))) : 'não informado') + '</b></div>' +
            '<div><small>Juros</small><b>' + esc(cmt && cmt.taxaMensal ? String(cmt.taxaMensal).replace('.', ',') + '% ao mês' : x.cet ? 'CET ' + String(x.cet).replace('.', ',') + '%' : 'não informado') + '</b></div>' +
            '<div><small>Saldo</small><b>' + esc(x.fonte === 'banco' ? 'do banco' : x.estimado ? 'estimado' : x.informadoEm ? 'informado em ' + K.curto(x.informadoEm) : 'informado') + '</b></div></div>';
        } else if (x.valorTotal) {
          var pc = Math.round((x.pago || 0) / x.valorTotal * 100);
          h += trilho((x.pago || 0) / x.valorTotal, '', null, pc + '% pago') + '<p class="fz-med"><b>' + real(x.pago || 0) + ' pagos de ' + real(x.valorTotal) + '</b><span class="g-t2"> · ' + pc + '%</span></p><p class="fz-peq g-t2">Cada pagamento entra como despesa do mês e abate o saldo</p>';
        } else {
          h += '<p class="fz-med"><b>' + real(x.parcela || 0) + ' por mês</b><span class="g-t2"> · ' + esc((x.vezes || 0) + ' vezes nos últimos 4 meses, a última em ' + K.curto(x.ultima)) + '</span></p>' +
            (x.devedor == null ? '<p class="fz-peq g-t2">O banco não manda o contrato. Informe o saldo para entrar no total</p>' : '<p class="fz-peq g-t2">' + esc('Saldo informado em ' + K.curto(x.informadoEm)) + '</p>');
        }
        if (x.fonte === 'financiamento' || x.fonte === 'lancamentos') h += '<button type="button" class="fz-claro" data-saldo="' + esc(x.chave) + '">' + (x.fonte === 'financiamento' ? (x.estimado ? 'Informar saldo devedor do banco' : 'Atualizar saldo devedor') : (x.devedor != null ? 'Atualizar saldo devedor' : 'Informar saldo devedor')) + '</button>';
        else if (x.fonte === 'cadastro') h += '<button type="button" class="fz-claro" data-pagar="' + esc(x.chave.slice(4)) + '">Registrar pagamento</button>';
        h += '</div>';
      });
    }
    h += '<div class="fz-par"><button type="button" class="fz-claro" data-acao="novo-fin">Novo financiamento</button><button type="button" class="fz-claro" data-acao="nova-div">Nova dívida</button></div>';
    var qt = compromissos().filter(function (c) { return c.quitado && (c.kind === 'financiamento' || c.kind === 'divida'); });
    if (qt.length) {
      h += '<button type="button" class="fz-mais-lista" data-acao="quitadas">' + (F.verQuitadas ? 'Esconder' : 'Mostrar') + ' ' + (qt.length === 1 ? '1 quitada' : qt.length + ' quitadas') + '</button>';
      if (F.verQuitadas) h += '<div class="g-cartao"><div class="fz-lista">' + qt.map(function (c) { return item({ t: c.descricao, sub: c.kind === 'divida' ? 'Dívida sem prazo' : c.n + ' parcelas', v: real(c.pago || c.total || 0), selo: 'quitada' }); }).join('') + '</div></div>';
    }
    return h;
  }

  /* =====================================================================
     CONTAS
     ===================================================================== */
  function telaContas() {
    if (!C.temDinheiro) return espera();
    var V = g().visao, fd = g().feed, itens = (fd && fd.items) || [];
    var correntes = V.contas.filter(function (c) { return !c.cartao; });
    var porBanco = {}, ordem = [];
    var itemDe = function (id) { return itens.filter(function (i) { return i.id === id; })[0] || null; };
    correntes.forEach(function (c) {
      var it = c.itemId && itemDe(c.itemId), nome = it ? it.banco : c.doBanco ? c.banco : 'Sem banco conectado';
      if (!porBanco[nome]) { porBanco[nome] = []; ordem.push(nome); } porBanco[nome].push(c);
    });
    var bancos = ordem.map(function (b) { return { b: b, l: porBanco[b], s: soma(porBanco[b], function (c) { return c.saldo; }) }; }).sort(function (x, y) { return y.s - x.s; });
    var h = '<div class="g-cartao fz-pad"><div class="fz-hero2"><div class="a"><small>Saldo em conta</small><b>' + real(V.saldoContas) + '</b></div><div class="b"><small>' + (bancos.length === 1 ? '1 banco' : bancos.length + ' bancos') + '</small><b class="fz-b2">' + (correntes.length === 1 ? '1 conta' : correntes.length + ' contas') + '</b></div></div></div>';
    if (itens.length) h += '<div class="fz-faixa fz-rx"><p>' + esc('Bancos lidos ' + (fd.lidoTxt || '')) + '<small>' + esc((fd.ateTxt ? 'Lançamentos até ' + fd.ateTxt + '. ' : '') + 'Cartão costuma chegar em 1 a 3 dias') + '</small></p><button type="button" class="fz-bt" data-acao="sincronizar">Sincronizar</button></div>';
    else h += '<div class="fz-faixa fz-rx"><p>Nenhum banco conectado<small>Conecte pelo Open Finance e os lançamentos entram sozinhos</small></p><a class="fz-bt" href="../granae.html#categorias">Conectar</a></div>';
    itens.filter(precisaReconectar).forEach(function (i) {
      var d = dataDoMs(i.lastUpdatedAt);
      h += '<div class="fz-faixa fz-al"><p>' + esc(i.banco + (d ? ' parou de ler em ' + K.dm(d) : ' precisa de atenção')) + '<small>' + esc(i.error || 'A conexão com o banco precisa ser refeita') + '</small></p><a class="fz-bt" href="../granae.html#categorias">Reconectar</a></div>';
    });
    if (bancos.length) {
      h += '<div class="g-cartao">' + bancos.map(function (x) {
        var item0 = null;
        x.l.forEach(function (c) { if (c.itemId) item0 = itens.filter(function (i) { return i.id === c.itemId; })[0] || item0; });
        var st = item0 ? (precisaReconectar(item0) ? ['reconectar', 'x-al'] : ['conectado', 'roxo']) : ['sem banco', ''];
        var lido = item0 && dataDoMs(item0.lastUpdatedAt);
        return '<div class="fz-banco"><div class="l1"><b>' + esc(x.b) + '</b><strong>' + real(x.s) + '</strong></div>' + (V.saldoContas > 0 && x.s > 0 ? trilho(x.s / V.saldoContas, '', null, Math.round(x.s / V.saldoContas * 100) + '% do saldo') : '') +
          x.l.map(function (c) { return '<div class="fz-conta"><span>' + esc(limpaNome(c.nome)) + '</span><span>' + real(c.saldo) + '</span></div>'; }).join('') +
          '<div class="fz-st">' + selo(st[0], st[1]) + '<small class="g-t2">' + esc(item0 ? (lido ? 'lido em ' + K.dm(lido) + ' às ' + p2(lido.getHours()) + ':' + p2(lido.getMinutes()) : '') : 'saldo pelos lançamentos') + '</small></div></div>';
      }).join('') + '</div>';
    }
    var imp = g().transactions.filter(function (t) { return t.doBanco && semCategoria(t); });
    if (imp.length) h += '<div class="fz-faixa fz-rx"><p>' + esc(imp.length === 1 ? '1 lançamento importado sem categoria' : imp.length + ' lançamentos importados sem categoria') + '<small>Escolha uma vez e crie a regra para os próximos</small></p><button type="button" class="fz-bt" data-acao="revisar-banco">Revisar</button></div>';
    var pv = V.previdencia || {};
    h += '<div class="g-cartao fz-pad"><div class="fz-cab"><h2>Patrimônio financeiro</h2></div><div class="fz-pat">' +
      '<div><span>Contas</span><b>+ ' + real(V.saldoContas) + '</b></div>' +
      (V.totInv ? '<div><span>Investimentos</span><b>+ ' + real(V.totInv) + '</b></div>' : '') +
      (pv.saldo != null ? '<div><span>' + esc('Previdência' + (pv.informadoEm ? ', informada em ' + K.curto(pv.informadoEm) : pv.doBanco ? ', do banco' : '')) + '</span><b>+ ' + real(pv.saldo) + '</b></div>' : '') +
      (V.faturas ? '<div><span>Faturas do mês</span><b>− ' + real(V.faturas) + '</b></div>' : '') +
      (V.devedor ? '<div><span>Dívidas</span><b>− ' + real(V.devedor) + '</b></div>' : '') +
      '<div class="tot"><span>Total</span><b' + (V.patrimonio < 0 ? ' class="x-al"' : '') + '>' + sinal(V.patrimonio) + '</b></div></div>' +
      '<p class="fz-peq g-t2 fz-mt6">Imóvel e carro não entram. Só dinheiro e dívidas.' + (V.semSaldo ? ' ' + esc(V.semSaldo === 1 ? '1 dívida sem saldo informado fica de fora.' : V.semSaldo + ' dívidas sem saldo informado ficam de fora.') : '') + '</p>' +
      (!pv.doBanco ? '<button type="button" class="fz-link-p" data-saldo="prev">' + (pv.saldo != null ? 'Atualizar saldo da previdência' : 'Informar saldo da previdência') + '</button>' : '') + '</div>';
    h += '<div class="fz-par"><a class="fz-claro" href="../granae.html#categorias">Conectar banco</a><button type="button" class="fz-claro" data-acao="nova-conta">Conta sem banco</button></div>';
    return h;
  }

  /* =====================================================================
     montagem, desenho e toques
     ===================================================================== */
  var TELAS = { resumo: telaResumo, lancamentos: telaLancamentos, orcamento: telaOrcamento, cartoes: telaCartoes, dividas: telaDividas, contas: telaContas };
  function monta(el) {
    F.el = el;
    el.classList.add('g-secao', 'g-financas', 'fz');
    el.innerHTML = '<div class="rola-secao g-rola"></div><div class="g-aviso-lugar" aria-live="polite"></div>' +
      '<div class="g-pe"><button type="button" class="g-acao" data-acao="lancar">Lançar</button></div>';
    desenha();
    C.ligar('granae');
    if (el.__fz) return;
    el.__fz = 1;
    el.addEventListener('click', clique);
    el.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('g-lc')) { e.preventDefault(); e.target.click(); } });
    el.addEventListener('input', function (e) { if (e.target.name === 'busca') { F.filtro.busca = e.target.value; var c = el.querySelector('.fz-lanc-corpo'); if (c) c.innerHTML = corpoLancamentos(); } });
    F.giro = K.arrastoMes(el, '.g-cab2, .g-resumo-f', function () { return el.querySelector('.fz-corpo'); }, function (n) { if (DO_MES[F.aba]) trocarMes(n); });
    K.linhasDeslizantes(el, function (l) { var t = achaLanc(l.dataset.id); if (!t) return {}; return { esquerda: { executar: function () { excluir(t); } } }; });
  }
  function achaLanc(id) { return g().transactions.filter(function (t) { return t.id === id; })[0] || null; }
  function trocarMes(n) { var r = K.mesCivil(F.ref); F.ref = mesDe(r.s, n); desenha(); }
  function desenha(topo) {
    var el = F.el; if (!el) return;
    var rola = el.querySelector('.g-rola'); if (!rola) return;
    var y = rola.scrollTop, x = (rola.querySelector('.fz-abas') || {}).scrollLeft || 0;
    rola.innerHTML = cabeca() + K.faixa('granae') + abas() + '<div class="fz-corpo" data-tela="' + F.aba + '">' + TELAS[F.aba]() + '</div>';
    var ab = rola.querySelector('.fz-abas');
    rola.scrollTop = topo ? 0 : y;
    if (ab) {
      ab.scrollLeft = x;
      var s = ab.querySelector('.sel');   // a aba escolhida fica sempre à vista
      if (s && (topo || s.offsetLeft < ab.scrollLeft || s.offsetLeft + s.offsetWidth > ab.scrollLeft + ab.clientWidth)) ab.scrollLeft = Math.max(0, s.offsetLeft - ab.offsetLeft - (ab.clientWidth - s.offsetWidth) / 2);
    }
    var bt = el.querySelector('.g-acao'), trav = !!C.bloqueio('granae');
    bt.classList.toggle('travado', trav);
    bt.style.background = trav ? '' : 'var(--g-fi)';
  }
  function irAba(a, ajuste) {
    F.aba = a; gravaLS(CHAVE_ABA, a);
    if (ajuste) ajuste();
    desenha(true);
    var b = F.el.querySelector('.fz-aba.sel'); if (b) b.focus({ preventScroll: true });
  }
  function aviso(t, desfazer) { K.mostraAviso(F.el, { texto: t, desfazer: desfazer }); }
  function erro(e) { K.erroAviso(F.el, e); }

  function clique(e) {
    var b = e.target.closest('button, a'); if (!b || !F.el.contains(b) || b.tagName === 'A') return;
    var d = b.dataset;
    if (d.aba) return irAba(d.aba);
    if (d.ir) return irAba(d.ir);
    if (d.tipo) { F.filtro.tipo = d.tipo; return desenha(); }
    if (d.cat != null && b.classList.contains('fz-leg')) return irAba('lancamentos', function () { limpaFiltro(); F.filtro.categoria = d.cat; });
    if (d.cartao) { F.cartao = d.cartao; F.fatSel = null; gravaLS(CHAVE_CARTAO, d.cartao); return desenha(); }
    if (d.fat) { F.fatSel = d.fat; return desenha(); }
    if (d.editar) { var t0 = achaLanc(d.editar); if (t0) folhaLancar({ editar: t0 }); return; }
    if (d.teto) { var cat = g().categories.filter(function (x) { return x.id === d.teto; })[0]; if (cat) K.abreTeto(cat); return; }
    if (d.fixo) { var fx = g().fixedItems.filter(function (x) { return x.id === d.fixo; })[0]; if (fx) K.abreFixo(fx); return; }
    if (d.saldo) return folhaSaldo(d.saldo);
    if (d.pagar) { var c = compromissos().filter(function (x) { return x.id === d.pagar; })[0]; if (c) K.abrePagamento(c); return; }
    var acao = d.acao; if (!acao && !d.pagafat) return;
    if (acao === 'editar') { var li = b.closest('.g-linha'), t = li && achaLanc(li.dataset.id); if (!t) return; if (F.filtro.semCat && semCategoria(t)) return folhaRevisar(t); return folhaLancar({ editar: t }); }
    if (acao === 'mes') return trocarMes(+d.n);
    if (acao === 'mais') return maisOpcoes();
    if (acao === 'tentar') return C.tentarDeNovo('granae');
    if (acao === 'lancar') { var bl = C.bloqueio('granae'); if (bl) return aviso(bl); return folhaLancar({}); }
    if (acao === 'revisar') return irAba('lancamentos', function () { limpaFiltro(); F.filtro.semCat = true; });
    if (acao === 'revisar-banco') {
      var ultimo = g().transactions.filter(function (t) { return t.doBanco && semCategoria(t); }).sort(function (a, b2) { return a.date < b2.date ? 1 : -1; })[0];
      return irAba('lancamentos', function () { limpaFiltro(); F.filtro.semCat = true; if (ultimo) F.ref = data(ultimo.date); });
    }
    if (acao === 'saidas') return irAba('lancamentos', function () { limpaFiltro(); F.filtro.tipo = 'saidas'; });
    if (acao === 'semcat') { F.filtro.semCat = !F.filtro.semCat; return desenha(); }
    if (acao === 'escolhe-conta') return escolher('Conta ou cartão', [{ v: '', t: 'Todas' }].concat(g().accounts.map(function (a) { return { v: a.id, t: limpaNome(a.name) }; })), F.filtro.conta || '', function (v) { F.filtro.conta = v || null; desenha(); });
    if (acao === 'escolhe-cat') {
      var nomes = {}; g().categories.forEach(function (x) { nomes[x.name] = 1; });
      return escolher('Categoria', [{ v: '', t: 'Todas' }].concat(Object.keys(nomes).sort(function (a, b2) { return a.localeCompare(b2, 'pt-BR'); }).map(function (n) { return { v: n, t: n }; })), F.filtro.categoria || '', function (v) { F.filtro.categoria = v || null; desenha(); });
    }
    if (acao === 'limpa-filtro') { limpaFiltro(); return desenha(); }
    if (acao === 'limpa-fatura') { F.filtro.fatura = null; return desenha(); }
    if (acao === 'ver-agendados') { F.verAgendados = !F.verAgendados; return desenha(); }
    if (acao === 'quitadas') { F.verQuitadas = !F.verQuitadas; return desenha(); }
    if (acao === 'fixos') return folhaFixosTetos('fixos');
    if (acao === 'tetos') return folhaFixosTetos('tetos');
    if (acao === 'compras') return irAba('lancamentos', function () { limpaFiltro(); F.filtro.fatura = { conta: F.cartao, mes: F.fatSel }; });
    if (acao === 'paga' || d.pagafat) {
      var mes = d.pagafat || F.fatSel, a0 = conta(F.cartao); if (!a0 || !mes) return;
      var era = (a0.faturasPagas || {})[a0.id + ':' + mes];
      b.disabled = true;
      return C.alternarFaturaPaga(a0.id, mes).then(function () { aviso(era ? 'Fatura de ' + MESES[deChave(mes).getMonth()] + ' em aberto de novo' : 'Fatura de ' + MESES[deChave(mes).getMonth()] + ' marcada como paga'); }, function (x) { b.disabled = false; erro(x); });
    }
    if (acao === 'novo-cartao') return folhaConta('cartao');
    if (acao === 'nova-conta') return folhaConta('conta');
    if (acao === 'novo-fin') return folhaFinanciamento();
    if (acao === 'nova-div') return folhaDivida();
    if (acao === 'ia') return folhaIA();
    if (acao === 'sincronizar') {
      if (DEMO) return aviso('Na demonstração não há banco de verdade para ler.');
      b.disabled = true;
      return C.consultar('sincronizar').then(function () { aviso('Pedido enviado ao banco. Os lançamentos chegam em instantes.'); setTimeout(function () { b.disabled = false; }, 4000); }, function (x) { b.disabled = false; erro(x); });
    }
  }
  function limpaFiltro() { F.filtro = { tipo: 'tudo', semCat: false, conta: null, categoria: null, busca: '', fatura: null }; }
  function excluir(t) {
    C.excluirLancamento(t.id).then(function (copia) {
      aviso('Lançamento excluído', function () { C.restaurarLancamento(copia).catch(erro); });
    }, erro);
  }

  /* folha de escolha simples (filtro por conta e por categoria) */
  function escolher(titulo, opcoes, atual, fn) {
    U.folha({
      titulo: titulo, classe: 'g-folha fz-folha',
      conteudo: function (c, api) {
        c.innerHTML = K.topo(titulo) + '<div class="g-sup fz-escolha">' + opcoes.map(function (o) {
          return '<button type="button" class="g-opcao' + (o.v === atual ? ' sel' : '') + '" data-v="' + esc(o.v) + '" aria-pressed="' + (o.v === atual) + '"><span>' + esc(o.t) + '</span>' + (o.v === atual ? '<small>escolhida</small>' : '') + '</button>';
        }).join('') + '</div>';
        c.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; if (b.dataset.topo) return api.fechar(); if (b.dataset.v != null) { api.fechar(); fn(b.dataset.v); } });
      }
    });
  }

  /* =====================================================================
     LANÇAR (novo lançamento, edição e transferência)
     ===================================================================== */
  function folhaLancar(pedido) {
    var o = pedido.editar || null, pre = pedido.pre || {};
    var contas0 = g().accounts.slice().sort(function (a, b) { return (a.kind === 'cartao' ? 0 : 1) - (b.kind === 'cartao' ? 0 : 1); });
    var ultimaConta = lerLS(CHAVE_CONTA);
    if (!contas0.some(function (a) { return a.id === ultimaConta; })) ultimaConta = '';
    var parc = o ? K.parcelaInfo(o.description) : null;
    U.folha({
      titulo: o ? 'Editar lançamento' : 'Novo lançamento', classe: 'g-folha fz-folha fz-lancar', alta: true,
      conteudo: function (c, api) {
        var st = {
          modo: o ? (o.type === 'income' ? 'receita' : 'despesa') : (pedido.modo || pre.modo || 'despesa'),
          digitos: o ? K.textoCampo(o.amount) : (pre.amount ? K.textoCampo(pre.amount) : ''),
          descricao: o ? o.description : (pre.description || ''), categoria: o ? o.category : (pre.category || ''),
          conta: o ? (o.accountId || '') : ultimaConta, de: '', para: '',
          data: o ? o.date : (pre.date || hoje()), quando: o ? 'outro' : (pre.date && pre.date !== hoje() ? 'outro' : 'hoje'),
          parcelas: 1, todas: false, salvando: false, erro: null
        };
        function tipo() { return st.modo === 'receita' ? 'income' : 'expense'; }
        function valor() { return K.numeroCampo(st.digitos) || 0; }
        function exibicao() { if (!st.digitos) return 'R$ 0'; var pt = st.digitos.split(','), int = K.FI.format(+pt[0] || 0); return pt.length > 1 ? 'R$ ' + int + ',' + pt[1] : 'R$ ' + int; }
        function tocar(t) {
          var x = st.digitos;
          if (t === 'apagar') { st.digitos = x.slice(0, -1); return; }
          if (t === ',') { if (x.indexOf(',') >= 0) return; st.digitos = x ? x + ',' : '0,'; return; }
          var i = x.indexOf(',');
          if (i >= 0) { if (x.length - i > 2) return; } else if (x.length >= 8) return;
          st.digitos = x === '0' ? t : x + t;
        }
        function categorias() {
          var l = g().categories.map(function (x, i) { return { c: x, i: i }; }).filter(function (x) { return x.c.type === tipo() && x.c.name !== 'Transferência'; }), usos = {};
          g().transactions.slice(-400).forEach(function (t) { if (t.type === tipo()) usos[t.category] = (usos[t.category] || 0) + 1; });
          return l.sort(function (a, b) { return ((usos[b.c.name] || 0) - (usos[a.c.name] || 0)) || a.i - b.i; }).map(function (x) { return x.c.name; });
        }
        function parcelasTexto() {
          var n = st.parcelas, cents = Math.round(valor() * 100), cada = Math.floor(cents / n), resto = cents - cada * n;
          if (!cents) return n + ' parcelas, uma por mês';
          return n + ' de ' + realC(cada / 100) + (resto ? ' (a 1ª de ' + realC((cada + resto) / 100) + ')' : '') + ', uma por mês';
        }
        function avisoFatura() {
          var a = conta(st.conta), d = data(st.data);
          if (!d) return '';
          if (st.modo === 'transferencia') return st.data > hoje() ? 'Fica registrada em ' + K.dm(d) + '.' : '';
          if (a && a.kind === 'cartao' && st.modo === 'despesa') {
            var vc = visaoConta(a.id) || {}, fech = vc.fecha || a.fechamento, venc = vc.vence || a.vencimento, mf = mesDaFatura(fech, st.data), vd = vencimentoDe(fech, venc, mf);
            var t = 'Entra na fatura de ' + MESES[mf.getMonth()] + ' do ' + limpaNome(a.name) + (vd ? ', que vence ' + K.dm(vd) : '') + '.';
            if (st.parcelas > 1) t += ' Última parcela em ' + mesAnoLongo(mesDe(mf, st.parcelas - 1)) + '.';
            if (!fech) t += ' Sem dia de fechamento cadastrado, conta o mês da compra.';
            return t;
          }
          var tx = [];
          if (st.data > hoje()) tx.push('Fica agendado para ' + K.dm(d) + ' e só entra nos totais nesse dia.');
          if (st.parcelas > 1) tx.push('Uma por mês, de ' + MESES[d.getMonth()] + ' a ' + mesAnoLongo(mesDe(d, st.parcelas - 1)) + '.');
          return tx.join(' ');
        }
        function pinta() {
          var ed = !!o, tr = st.modo === 'transferencia', cats = tr ? [] : categorias();
          var mostra = st.todas ? cats : cats.slice(0, 5);
          if (st.categoria && mostra.indexOf(st.categoria) < 0 && cats.indexOf(st.categoria) >= 0) mostra = mostra.slice(0, 4).concat([st.categoria]);
          var h = K.topo(ed ? (o.type === 'income' ? 'Editar receita' : 'Editar despesa') : 'Novo lançamento', 'Cancelar');
          if (!ed) h += '<div class="fz-seg" role="group" aria-label="Tipo">' + [['despesa', 'Despesa'], ['receita', 'Receita'], ['transferencia', 'Transferência']].map(function (m) {
            return '<button type="button" class="' + (st.modo === m[0] ? 'sel' : '') + '" data-modo="' + m[0] + '" aria-pressed="' + (st.modo === m[0]) + '">' + m[1] + '</button>';
          }).join('') + '</div>';
          h += '<p class="g-erro" role="alert"' + (st.erro ? '' : ' hidden') + '>' + esc(st.erro || '') + '</p>';
          h += '<div class="fz-valor-g"><output aria-live="polite" aria-label="' + esc('Valor ' + real(valor())) + '"' + (st.digitos ? '' : ' class="zero"') + '>' + esc(exibicao()) + '</output><small>' +
            esc(tr ? 'Valor da transferência' : ed && parc ? 'Valor desta parcela (' + parc.k + ' de ' + parc.n + ')' : st.parcelas > 1 ? 'Valor total da compra' : 'Valor') + '</small></div>';
          h += '<input class="fz-campo" type="text" name="descricao" placeholder="' + (tr ? 'Descrição (opcional)' : 'Descrição') + '" aria-label="Descrição" autocomplete="off" value="' + esc(st.descricao) + '">';
          if (!tr) {
            h += '<p class="fz-rot">Categoria</p><div class="fz-cats">' + mostra.map(function (n) {
              return '<button type="button" class="' + (st.categoria === n ? 'sel' : '') + '" data-cat="' + esc(n) + '" aria-pressed="' + (st.categoria === n) + '">' + esc(n) + '</button>';
            }).join('') + (cats.length > 5 ? '<button type="button" data-x="todas">' + (st.todas ? 'Menos' : 'Outras') + '</button>' : '') + '</div>';
            if (contas0.length) h += '<p class="fz-rot">' + (st.modo === 'receita' ? 'Entrou em' : 'Pagar com') + '</p><div class="fz-chips fz-quebra">' + contas0.map(function (a) {
              return '<button type="button" class="fz-chip' + (st.conta === a.id ? ' sel' : '') + '" data-conta="' + esc(a.id) + '" aria-pressed="' + (st.conta === a.id) + '">' + esc(limpaNome(a.name)) + '</button>';
            }).join('') + '<button type="button" class="fz-chip' + (!st.conta ? ' sel' : '') + '" data-conta="" aria-pressed="' + !st.conta + '">Sem conta</button></div>';
          } else {
            if (contas0.length < 2) h += '<p class="g-t2">Para transferir, cadastre ou conecte pelo menos duas contas.</p>';
            ['de', 'para'].forEach(function (lado) {
              h += '<p class="fz-rot">' + (lado === 'de' ? 'Sai de' : 'Entra em') + '</p><div class="fz-chips fz-quebra">' + contas0.map(function (a) {
                return '<button type="button" class="fz-chip' + (st[lado] === a.id ? ' sel' : '') + '" data-' + lado + '="' + esc(a.id) + '" aria-pressed="' + (st[lado] === a.id) + '">' + esc(limpaNome(a.name)) + '</button>';
              }).join('') + '</div>';
            });
          }
          var ontem = iso(K.somaDias(new Date(), -1));
          h += '<p class="fz-rot">Quando</p><div class="fz-chips fz-quebra">' +
            '<button type="button" class="fz-chip' + (st.quando === 'hoje' ? ' sel' : '') + '" data-quando="hoje" aria-pressed="' + (st.quando === 'hoje') + '">Hoje ' + K.dm(new Date()) + '</button>' +
            '<button type="button" class="fz-chip' + (st.quando === 'ontem' ? ' sel' : '') + '" data-quando="ontem" aria-pressed="' + (st.quando === 'ontem') + '">Ontem</button>' +
            '<button type="button" class="fz-chip' + (st.quando === 'outro' ? ' sel' : '') + '" data-quando="outro" aria-pressed="' + (st.quando === 'outro') + '">Outro dia</button></div>';
          if (st.quando === 'outro') h += '<input class="fz-campo" type="date" name="data" aria-label="Data" value="' + esc(st.data) + '">';
          void ontem;
          if (!ed && st.modo === 'despesa') h += '<div class="fz-stepper"><p>Parcelas<small>' + esc(st.parcelas > 1 ? parcelasTexto() : 'À vista') + '</small></p><button type="button" data-par="-1" aria-label="Menos parcelas"' + (st.parcelas <= 1 ? ' disabled' : '') + '>−</button><strong aria-live="polite">' + st.parcelas + '×</strong><button type="button" data-par="1" aria-label="Mais parcelas"' + (st.parcelas >= 120 ? ' disabled' : '') + '>+</button></div>';
          var av = avisoFatura();
          if (av) h += '<div class="fz-faixa fz-rx"><p class="fz-normal">' + esc(av) + '</p></div>';
          h += '<div class="fz-teclado">' + ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'apagar'].map(function (t) {
            return '<button type="button" data-t="' + t + '" aria-label="' + (t === 'apagar' ? 'Apagar' : t === ',' ? 'Vírgula' : t) + '"' + (t === 'apagar' ? ' class="ap"' : '') + '>' + (t === 'apagar' ? 'Apagar' : t) + '</button>';
          }).join('') + '</div>';
          var rot = tr ? 'Transferir' : ed ? 'Salvar' : st.parcelas > 1 ? 'Salvar ' + st.parcelas + ' parcelas' : 'Salvar';
          h += '<button type="button" class="fz-cheio" data-x="salvar"' + (st.salvando ? ' disabled' : '') + '>' + rot + '</button>';
          if (ed) h += '<div class="fz-par"><button type="button" class="fz-claro" data-x="dup">Duplicar para hoje</button><button type="button" class="fz-claro perigo" data-x="exc">Excluir</button></div>';
          var foco = D.activeElement && c.contains(D.activeElement) ? D.activeElement : null, sel = null;
          if (foco) { var ds = foco.dataset; sel = ds.t ? '[data-t="' + ds.t + '"]' : ds.cat ? '[data-cat="' + CSS.escape(ds.cat) + '"]' : ds.modo ? '[data-modo="' + ds.modo + '"]' : ds.par ? '[data-par="' + ds.par + '"]' : ds.quando ? '[data-quando="' + ds.quando + '"]' : ds.conta != null ? '[data-conta="' + CSS.escape(ds.conta) + '"]' : ds.x ? '[data-x="' + ds.x + '"]' : foco.name === 'data' ? '[name=data]' : null; }
          c.innerHTML = h;
          if (sel) { var fe = c.querySelector(sel); if (fe && !fe.disabled) fe.focus({ preventScroll: true }); }
        }
        function lerCampos() { var x; if ((x = c.querySelector('[name=descricao]'))) st.descricao = x.value; if ((x = c.querySelector('[name=data]')) && x.value) st.data = x.value; }
        c.addEventListener('input', function () { lerCampos(); });
        c.addEventListener('change', function (e) { if (e.target.name === 'data') { lerCampos(); pinta(); } });
        c.addEventListener('click', function (e) {
          var b = e.target.closest('button'); if (!b || b.disabled) return;
          lerCampos(); var d = b.dataset;
          if (d.topo) return api.fechar();
          if (d.modo) { if (d.modo !== st.modo) { st.modo = d.modo; st.categoria = ''; st.parcelas = 1; st.erro = null; } return pinta(); }
          if (d.t) { tocar(d.t); st.erro = null; return pinta(); }
          if (d.cat != null) { st.categoria = d.cat; st.erro = null; return pinta(); }
          if (d.x === 'todas') { st.todas = !st.todas; return pinta(); }
          if (d.conta != null) { st.conta = d.conta; return pinta(); }
          if (d.de != null) { st.de = d.de; return pinta(); }
          if (d.para != null) { st.para = d.para; return pinta(); }
          if (d.quando) { st.quando = d.quando; if (d.quando === 'hoje') st.data = hoje(); else if (d.quando === 'ontem') st.data = iso(K.somaDias(new Date(), -1)); pinta(); if (d.quando === 'outro') { var di = c.querySelector('[name=data]'); if (di) di.focus(); } return; }
          if (d.par) { st.parcelas = Math.max(1, Math.min(120, st.parcelas + +d.par)); return pinta(); }
          if (d.x === 'salvar') return salvar();
          if (d.x === 'dup') return C.duplicarLancamentoHoje(o.id).then(function () { terminar('Duplicado para hoje', null, hoje()); }, falhou);
          if (d.x === 'exc') return U.confirma('Excluir este lançamento?', o.description + ', ' + realC(o.amount) + '.', [
            { rotulo: 'Excluir', perigo: true, acao: function () { C.excluirLancamento(o.id).then(function (copia) { terminar('Lançamento excluído', function () { C.restaurarLancamento(copia).catch(erro); }, null); }, falhou); } },
            { rotulo: 'Cancelar' }]);
        });
        c.addEventListener('keydown', function (e) {
          if (e.target.matches && e.target.matches('input, select, textarea')) return;
          var k = e.key === '.' ? ',' : e.key === 'Backspace' ? 'apagar' : e.key;
          if (/^[0-9,]$/.test(k) || k === 'apagar') { e.preventDefault(); tocar(k); pinta(); }
        });
        function falhou(x) { st.salvando = false; st.erro = (x && x.message) || String(x); pinta(); var er = c.querySelector('.g-erro'); if (er) er.scrollIntoView({ block: 'nearest' }); }
        function terminar(texto, desfazer, foiPara) {
          api.fechar();
          if (foiPara && DO_MES[F.aba]) { var r = K.mesCivil(F.ref); if (!K.contem(r, foiPara)) { var dd = data(foiPara); if (dd) F.ref = dd; } }
          desenha();
          aviso(texto, desfazer);
        }
        function salvar() {
          if (st.salvando) return;
          var v = valor();
          if (!(v > 0)) { st.erro = 'Digite o valor.'; return pinta(); }
          if (!st.data) { st.erro = 'Escolha a data.'; return pinta(); }
          if (st.modo === 'transferencia') {
            if (!st.de || !st.para || st.de === st.para) { st.erro = 'Escolha duas contas diferentes.'; return pinta(); }
            st.salvando = true; st.erro = null; pinta();
            return C.transferir({ de: st.de, para: st.para, valor: v, data: st.data, descricao: st.descricao.trim() }).then(function () { terminar('Transferência registrada', null, st.data); }, falhou);
          }
          if (!st.categoria) { st.erro = 'Escolha a categoria.'; return pinta(); }
          if (st.parcelas > 1 && Math.round(v * 100) < st.parcelas) { st.erro = 'O valor é pequeno demais para tantas parcelas.'; return pinta(); }
          var r = { id: o ? o.id : null, type: o ? o.type : tipo(), amount: v, description: st.descricao.trim() || st.categoria, category: st.categoria, date: st.data,
            sub: o ? o.sub : null, accountId: st.conta || null, parcelas: o ? 1 : st.parcelas, porTotal: !o && st.parcelas > 1 };
          st.salvando = true; st.erro = null; pinta();
          C.salvarLancamento(r).then(function () {
            if (!o) gravaLS(CHAVE_CONTA, st.conta || null);
            var n = r.parcelas, cents = Math.round(v * 100), cada = Math.floor(cents / n);
            terminar(n > 1 ? n + ' parcelas de ' + realC(cada / 100) + ', total ' + realC(v) : r.date > hoje() ? 'Agendado para ' + K.curto(r.date) : (o ? 'Atualizado' : 'Lançado em ' + r.category), null, r.date);
          }, falhou);
        }
        pinta();
      }
    });
  }

  /* revisão em lote (paraRevisar + aplicarRevisao do Granaê): uma de cada vez, com regra opcional */
  function folhaRevisar(t0) {
    U.folha({
      titulo: 'Escolher categoria', classe: 'g-folha fz-folha', alta: true,
      conteudo: function (c, api) {
        var atual = t0, feitos = 0, salvando = false;
        function fila() { var r = K.mesCivil(F.ref); return g().transactions.filter(function (t) { return K.contem(r, t.date) && semCategoria(t); }).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; }); }
        function pinta(msg) {
          var h = K.topo('Escolher categoria', 'Fechar');
          if (!atual) { c.innerHTML = h + '<p class="g-t2">' + esc(feitos ? 'Fim da fila. ' + feitos + ' revisado' + (feitos > 1 ? 's' : '') + '.' : 'Nada para revisar neste mês.') + '</p>'; return; }
          var resta = fila().length;
          var cats = g().categories.filter(function (x) { return x.type === atual.type && x.name !== 'Transferência'; });
          h += '<p class="g-t2">' + esc(resta + ' sem categoria neste mês') + '</p>' + (msg ? '<p class="g-t2 fz-ok" role="status">' + esc(msg) + '</p>' : '') +
            '<div class="g-cartao fz-pad"><div class="fz-cab fz-cab0"><b class="fz-rev-n">' + esc(atual.description) + '</b><b' + (atual.type === 'income' ? ' style="color:var(--fz-entra-tx)"' : '') + '>' + (atual.type === 'income' ? '+ ' : '− ') + realC(atual.amount) + '</b></div>' +
            '<p class="g-t2">' + esc([diaSemana(atual.date), nomeConta(atual.accountId), atual.doBanco ? 'do banco' : ''].filter(Boolean).join(' · ')) + '</p></div>' +
            '<label class="fz-rot" for="fzRegra">Criar regra: sempre que a descrição contiver</label><input class="fz-campo" id="fzRegra" name="regra" type="text" autocomplete="off" placeholder="' + esc((atual.description || '').split(' ')[0] || '') + '">' +
            '<p class="fz-rot">Toque na categoria para salvar</p><div class="fz-cats">' + cats.map(function (x) { return '<button type="button" data-cat="' + esc(x.name) + '"' + (salvando ? ' disabled' : '') + '>' + esc(x.name) + '</button>'; }).join('') + '</div>' +
            '<p class="g-erro" role="alert" hidden></p><div class="fz-par"><button type="button" class="fz-claro" data-x="pular">Pular</button><button type="button" class="fz-claro" data-x="editar">Editar lançamento</button></div>';
          c.innerHTML = h;
        }
        function proximo() { var l = fila(), i = l.map(function (t) { return t.id; }).indexOf(atual && atual.id); atual = l.filter(function (t) { return t.id !== (atual && atual.id); })[i >= 0 ? i : 0] || null; }
        c.addEventListener('click', function (e) {
          var b = e.target.closest('button'); if (!b || b.disabled) return;
          if (b.dataset.topo) return api.fechar();
          if (b.dataset.x === 'pular') { var l = fila(), i = l.map(function (t) { return t.id; }).indexOf(atual.id); atual = l[i + 1] || l[0]; if (atual && atual.id === b.dataset.atual) atual = null; return pinta(); }
          if (b.dataset.x === 'editar') { var t = atual; api.fechar(); return folhaLancar({ editar: t }); }
          if (b.dataset.cat) {
            var regra = (c.querySelector('[name=regra]') || {}).value || '';
            salvando = true;
            C.categorizar(atual.id, b.dataset.cat, regra).then(function (n) {
              salvando = false; feitos++;
              var msg = regra.trim() ? 'Regra criada. ' + n + ' lançamento' + (n === 1 ? '' : 's') + ' atualizado' + (n === 1 ? '' : 's') + '.' : 'Salvo em ' + b.dataset.cat + '.';
              proximo(); pinta(msg);
            }, function (x) { salvando = false; var r = c.querySelector('.g-erro'); r.textContent = x.message; r.hidden = false; });
          }
        });
        pinta();
      }
    });
  }

  /* saldo informado (financiamento sem saldo do banco, parcela achada no extrato, previdência) */
  function folhaSaldo(chave) {
    var inf = g().bancoSaldos[chave], fin = g().visao.financiamentos.filter(function (x) { return x.chave === chave; })[0];
    var titulo = chave === 'prev' ? 'Saldo da previdência' : (fin ? fin.nome : 'Saldo devedor');
    U.folha({
      titulo: titulo, classe: 'g-folha fz-folha',
      conteudo: function (el, api) {
        el.innerHTML = K.topo(titulo, 'Cancelar') + '<p class="g-t2">' + esc(chave === 'prev' ? 'Saldo acumulado, como está no extrato da previdência.' : 'Saldo devedor hoje. Veja no app do banco.') + (inf ? ' ' + esc('Último informado em ' + K.curto(inf.em) + '.') : '') + '</p>' +
          '<div class="g-valor"><span aria-hidden="true">R$</span><input name="valor" type="text" inputmode="decimal" placeholder="0" aria-label="Valor" autocomplete="off" value="' + esc(inf ? K.textoCampo(inf.valor) : '') + '"></div>' +
          '<p class="g-erro" role="alert" hidden></p><button type="button" class="fz-cheio" data-x="ok">Salvar</button>' + (inf ? '<button type="button" class="fz-claro perigo" data-x="apagar">Apagar o valor informado</button>' : '');
        var salvando = false;
        el.addEventListener('click', function (e) {
          var b = e.target.closest('button'); if (!b || salvando) return;
          if (b.dataset.topo) return api.fechar();
          var er = el.querySelector('.g-erro');
          if (b.dataset.x === 'ok' || b.dataset.x === 'apagar') {
            var v = b.dataset.x === 'apagar' ? null : K.numeroCampo(el.querySelector('[name=valor]').value);
            if (b.dataset.x === 'ok' && !(v >= 0 && v !== null)) { er.textContent = 'Digite um valor, por exemplo 12.345,67.'; er.hidden = false; return; }
            salvando = true;
            C.informarSaldo(chave, v).then(function () { api.fechar(); aviso(v == null ? 'Saldo apagado' : 'Saldo salvo'); }, function (x) { salvando = false; er.textContent = x.message; er.hidden = false; });
          }
        });
      }
    });
  }

  /* formulários simples (cmtForm, divForm, accForm do Granaê) */
  function folhaForm(titulo, campos, botao, enviar, dica) {
    U.folha({
      titulo: titulo, classe: 'g-folha fz-folha', alta: true,
      conteudo: function (el, api) {
        el.innerHTML = K.topo(titulo, 'Cancelar') + '<div class="fz-form">' + campos.map(function (f) {
          if (f.tipo === 'select') return '<label class="fz-rot" for="fz_' + f.n + '">' + esc(f.r) + '</label><select class="fz-campo" id="fz_' + f.n + '" name="' + f.n + '">' + f.op.map(function (o) { return '<option value="' + esc(o.v) + '"' + (o.v === f.v ? ' selected' : '') + '>' + esc(o.t) + '</option>'; }).join('') + '</select>';
          return '<label class="fz-rot" for="fz_' + f.n + '">' + esc(f.r) + '</label><input class="fz-campo" id="fz_' + f.n + '" name="' + f.n + '" type="' + (f.tipo || 'text') + '"' + (f.num ? ' inputmode="decimal"' : '') + ' autocomplete="off" placeholder="' + esc(f.ph || '') + '" value="' + esc(f.v || '') + '">';
        }).join('') + '</div><p class="g-t2 fz-dica" aria-live="polite"></p><p class="g-erro" role="alert" hidden></p><button type="button" class="fz-cheio" data-x="ok">' + esc(botao) + '</button>';
        function ler() { var o = {}; campos.forEach(function (f) { var x = el.querySelector('[name=' + f.n + ']'); o[f.n] = x ? x.value : ''; }); return o; }
        if (dica) el.addEventListener('input', function () { el.querySelector('.fz-dica').textContent = dica(ler()) || ''; });
        var salvando = false;
        el.addEventListener('click', function (e) {
          var b = e.target.closest('button'); if (!b || salvando) return;
          if (b.dataset.topo) return api.fechar();
          if (b.dataset.x !== 'ok') return;
          var er = el.querySelector('.g-erro'), r = enviar(ler());
          if (typeof r === 'string') { er.textContent = r; er.hidden = false; return; }
          salvando = true;
          r.then(function (msg) { api.fechar(); aviso(msg); }, function (x) { salvando = false; er.textContent = x.message === 'Não consegui gravar. Nada mudou: tente de novo.' ? 'Confira os campos e tente de novo.' : x.message; er.hidden = false; });
        });
      }
    });
  }
  function opcoesCategoria(tipo, padrao) { var l = g().categories.filter(function (c) { return c.type === tipo; }).map(function (c) { return { v: c.name, t: c.name }; }); if (padrao && !l.some(function (o) { return o.v === padrao; })) l.unshift({ v: padrao, t: padrao }); return l; }
  function opcoesConta() { return [{ v: '', t: 'Não informado' }].concat(g().accounts.map(function (a) { return { v: a.id, t: limpaNome(a.name) + (a.kind === 'cartao' ? ' (cartão)' : '') }; })); }
  function folhaFinanciamento() {
    folhaForm('Novo financiamento', [
      { n: 'descricao', r: 'O que foi financiado', ph: 'Apartamento, carro...' },
      { n: 'valorFinanciado', r: 'Valor financiado (opcional)', num: 1, ph: '0' },
      { n: 'parcela', r: 'Valor da parcela', num: 1, ph: '0' },
      { n: 'n', r: 'Número de parcelas', num: 1, ph: '48' },
      { n: 'taxa', r: 'Juros ao mês, em % (opcional)', num: 1, ph: '1,2' },
      { n: 'date', r: 'Primeira parcela', tipo: 'date', v: hoje() },
      { tipo: 'select', n: 'category', r: 'Categoria', op: opcoesCategoria('expense', 'Moradia'), v: 'Moradia' },
      { tipo: 'select', n: 'accountId', r: 'Conta', op: opcoesConta(), v: '' }
    ], 'Criar financiamento', function (r) {
      var n = parseInt(r.n, 10), p = K.numeroCampo(r.parcela);
      if (!r.descricao.trim()) return 'Diga o que foi financiado.';
      if (!(p > 0) || !(n > 0)) return 'Digite a parcela e o número de parcelas.';
      return C.novoFinanciamento({ descricao: r.descricao, n: n, parcela: p, valorFinanciado: K.numeroCampo(r.valorFinanciado) || '', taxa: K.numeroCampo(r.taxa) || '', category: r.category, date: r.date || hoje(), accountId: r.accountId }).then(function () { return 'Financiamento criado: ' + n + ' de ' + realC(p); });
    }, function (r) {
      var vf = K.numeroCampo(r.valorFinanciado) || 0, p = K.numeroCampo(r.parcela) || 0, n = parseInt(r.n, 10) || 0;
      if (!p || !n) return '';
      var tot = p * n;
      return vf ? 'Vai pagar ' + real(tot) + ' por algo de ' + real(vf) + ', ' + real(tot - vf) + ' de juros (' + Math.round((tot - vf) / vf * 100) + '%).' : 'Total de ' + real(tot) + ' em ' + n + ' parcelas.';
    });
  }
  function folhaDivida() {
    folhaForm('Nova dívida', [
      { n: 'descricao', r: 'Descrição', ph: 'Empréstimo do pai' },
      { n: 'credor', r: 'Para quem (opcional)', ph: '' },
      { n: 'total', r: 'Quanto deve no total', num: 1, ph: '0' },
      { tipo: 'select', n: 'category', r: 'Categoria dos pagamentos', op: opcoesCategoria('expense', 'Dívidas'), v: 'Dívidas' }
    ], 'Cadastrar dívida', function (r) {
      var t = K.numeroCampo(r.total);
      if (!r.descricao.trim() || !(t > 0)) return 'Digite a descrição e o total.';
      return C.novaDivida({ descricao: r.descricao, credor: r.credor, total: t, category: r.category }).then(function () { return 'Dívida de ' + real(t) + ' cadastrada'; });
    });
  }
  function folhaConta(kind) {
    var cartao = kind === 'cartao';
    folhaForm(cartao ? 'Novo cartão' : 'Conta sem banco', [{ n: 'name', r: 'Nome', ph: cartao ? 'Cartão do banco' : 'Carteira, conta...' }].concat(cartao ? [
      { n: 'fechamento', r: 'Dia em que a fatura fecha', num: 1, ph: '3' },
      { n: 'vencimento', r: 'Dia em que a fatura vence', num: 1, ph: '10' },
      { n: 'limite', r: 'Limite (opcional)', num: 1, ph: '0' }
    ] : [{ n: 'saldoInicial', r: 'Saldo de hoje', num: 1, ph: '0' }]), cartao ? 'Criar cartão' : 'Criar conta', function (r) {
      if (!r.name.trim()) return 'Dê um nome.';
      var fe = parseInt(r.fechamento, 10), ve = parseInt(r.vencimento, 10);
      if (cartao && ((r.fechamento && !(fe >= 1 && fe <= 31)) || (r.vencimento && !(ve >= 1 && ve <= 31)))) return 'Os dias vão de 1 a 31.';
      return C.salvarConta({ kind: kind, name: r.name, color: cartao ? '#7c3aed' : '#0ea5e9', saldoInicial: K.numeroCampo(r.saldoInicial) || 0, fechamento: fe || '', vencimento: ve || '', limite: K.numeroCampo(r.limite) || '' }).then(function () { return cartao ? 'Cartão criado' : 'Conta criada'; });
    });
  }

  /* fixos e tetos (FixosTetosView do iPhone) */
  function folhaFixosTetos(aba0) {
    U.folha({
      titulo: 'Fixos e tetos', classe: 'g-folha fz-folha', alta: true,
      conteudo: function (c, api) {
        var aba = aba0;
        function pinta() {
          var pf = K.painelFinancas(F.ref, g());
          var h = K.topo('Fixos e tetos') + '<div class="fz-seg dois" role="group" aria-label="Ver">' + [['tetos', 'Tetos'], ['fixos', 'Fixos']].map(function (x) { return '<button type="button" class="' + (aba === x[0] ? 'sel' : '') + '" data-aba2="' + x[0] + '" aria-pressed="' + (aba === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>';
          if (aba === 'tetos') {
            h += '<p class="g-t2">O teto é o valor da categoria no mês. Sem teto próprio, vale a soma dos fixos dela.</p><div class="g-sup">' + g().categories.filter(function (x) { return x.type === 'expense'; }).map(function (x) {
              var k = pf.categorias.filter(function (y) { return y.nome === x.name; })[0], gasto = k ? k.gasto : 0, lim = k ? k.teto : 0;
              return '<button type="button" class="g-opcao" data-teto2="' + esc(x.id) + '"><span>' + esc(x.name) + '</span><small' + (lim > 0 && gasto > lim ? ' class="x-al"' : '') + '>' + esc(lim > 0 ? real(gasto) + ' de ' + real(lim) : gasto > 0 ? real(gasto) + ', sem teto' : 'Sem teto') + '</small></button>';
            }).join('') + '</div>';
          } else {
            var fx = g().fixedItems.slice().sort(function (a, b) { if (a.type !== b.type) return a.type === 'income' ? -1 : 1; var ay = a.frequency === 'yearly', by = b.frequency === 'yearly'; if (ay !== by) return ay ? 1 : -1; return a.name.localeCompare(b.name, 'pt-BR'); });
            h += '<button type="button" class="fz-cheio" data-fixo2="">Novo fixo</button>' + (fx.length ? '<div class="g-sup">' + fx.map(function (f) {
              return '<button type="button" class="g-opcao" data-fixo2="' + esc(f.id) + '"><span>' + esc(f.name) + '</span><small>' + esc((f.type === 'income' ? '+ ' : '− ') + real(f.amount) + ', ' + f.category + ', ' + (f.frequency === 'yearly' ? '1 vez por ano' : 'todo mês')) + '</small></button>';
            }).join('') + '</div>' : '<p class="g-vaziotx">Nenhum fixo cadastrado.</p>');
          }
          var y = c.scrollTop; c.innerHTML = h; c.scrollTop = y;
        }
        c.addEventListener('click', function (e) {
          var b = e.target.closest('button'); if (!b) return;
          if (b.dataset.topo) return api.fechar();
          if (b.dataset.aba2) { aba = b.dataset.aba2; return pinta(); }
          if (b.dataset.teto2) { var x = g().categories.filter(function (k) { return k.id === b.dataset.teto2; })[0]; if (x) K.abreTeto(x); return; }
          if (b.dataset.fixo2 != null) { var f = b.dataset.fixo2 ? g().fixedItems.filter(function (k) { return k.id === b.dataset.fixo2; })[0] : null; K.abreFixo(f || null); }
        });
        var solta = K.vigiaCofre(api, pinta);
        api.el.addEventListener('transitionend', function () { if (!api.el.isConnected) solta(); });
        pinta();
      }
    });
  }

  /* =====================================================================
     IA, voz e leitura de fatura (as funções do próprio Granaê: Gemini.analyzeMonth, classifyAudio, analyzeInvoice)
     Na demonstração a IA devolve uma resposta simulada (como as Ferramentas com ?demo=1).
     ===================================================================== */
  function folhaIA() {
    var r = K.mesCivil(F.ref), mes = chaveMes(r.s);
    U.folha({
      titulo: 'Analisar com IA', classe: 'g-folha fz-folha', alta: true,
      conteudo: function (c, api) {
        c.innerHTML = K.topo('Análise de ' + MESES[r.s.getMonth()], 'Fechar') +
          '<p class="g-t2">A IA lê os lançamentos de ' + esc(mesAnoLongo(r.s)) + ', as categorias e os fixos. Os dados vão só para a análise, sem guardar.</p>' +
          '<div class="g-cartao fz-pad fz-ia" aria-live="polite"><p class="g-t2">Analisando…</p></div>' +
          '<label class="fz-rot" for="fzPerg">Perguntar sobre este mês</label><input class="fz-campo" id="fzPerg" name="pergunta" type="text" autocomplete="off" placeholder="Onde posso economizar?">' +
          '<button type="button" class="fz-cheio" data-x="perg">Perguntar</button>';
        var caixa = c.querySelector('.fz-ia'), ocupado = false;
        function roda(q) {
          if (ocupado) return; ocupado = true;
          caixa.innerHTML = '<p class="g-t2">Analisando…</p>';
          var p = DEMO ? new Promise(function (ok) { setTimeout(function () { ok('<h3>Resumo de ' + esc(MESES[r.s.getMonth()]) + '</h3><p>Demonstração: a análise de verdade usa a IA do Granaê com a sua conta.</p><ul><li>Os maiores gastos foram em Moradia e Mercado.</li><li>' + (q ? 'Sobre a pergunta: ' + esc(q) : 'Alimentação ficou perto do teto.') + '</li></ul>'); }, 500); })
            : C.consultar('analisarMes', { mes: mes, pergunta: q || '' });
          p.then(function (html) { ocupado = false; caixa.innerHTML = html || '<p class="g-t2">A IA não devolveu texto. Tente de novo.</p>'; }, function (x) { ocupado = false; caixa.innerHTML = '<p class="g-alerta-tx">' + esc('Não consegui analisar: ' + x.message) + '</p>'; });
        }
        c.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; if (b.dataset.topo) return api.fechar(); if (b.dataset.x === 'perg') { var q = c.querySelector('[name=pergunta]').value.trim(); if (q) roda(q); } });
        c.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.name === 'pergunta') { e.preventDefault(); var q = e.target.value.trim(); if (q) roda(q); } });
        roda('');
      }
    });
  }

  function folhaVoz() {
    U.folha({
      titulo: 'Lançar por voz', classe: 'g-folha fz-folha', alta: true,
      conteudo: function (c, api) {
        var rec = null, partes = [], ini = 0, tempo = null, res = null;
        function pinta(estado, msg) {
          var h = K.topo('Lançar por voz', 'Fechar');
          if (estado === 'gravando') h += '<p class="fz-voz-t" aria-live="polite">' + msg + '</p><button type="button" class="fz-cheio" data-x="parar">Parar e ler</button>';
          else if (estado === 'lendo') h += '<p class="g-t2" aria-live="polite">Interpretando o áudio…</p>';
          else if (estado === 'pronto' && res) {
            h += (res.transcription ? '<p class="g-t2">' + esc('"' + res.transcription + '"') + '</p>' : '') + '<div class="g-cartao fz-pad"><p class="fz-rot">' + (res.type === 'income' ? 'Receita' : 'Despesa') + ' detectada</p>' +
              '<div class="fz-pat"><div><span>Valor</span><b>' + realC(+res.amount || 0) + '</b></div><div><span>Descrição</span><b>' + esc(res.description || '') + '</b></div><div><span>Categoria</span><b>' + esc(res.category || 'Outros') + '</b></div><div><span>Data</span><b>' + esc(K.curto(res.date || hoje())) + '</b></div></div></div>' +
              '<p class="g-erro" role="alert" hidden></p><button type="button" class="fz-cheio" data-x="salvar">Salvar</button><div class="fz-par"><button type="button" class="fz-claro" data-x="editar">Editar antes</button><button type="button" class="fz-claro" data-x="descartar">Descartar</button></div>';
          } else {
            h += '<p class="g-t2">Diga o valor, o que foi e, se quiser, a data. Por exemplo: gastei 42 reais no almoço do hospital. Até 30 segundos.</p>' + (msg ? '<p class="g-alerta-tx" role="alert">' + esc(msg) + '</p>' : '') +
              '<button type="button" class="fz-cheio" data-x="gravar">Gravar</button>' + (DEMO ? '<button type="button" class="fz-claro" data-x="exemplo">Usar o exemplo da demonstração</button>' : '');
          }
          c.innerHTML = h;
        }
        function para() { if (rec && rec.state !== 'inactive') { rec.stop(); rec.stream.getTracks().forEach(function (t) { t.stop(); }); } clearInterval(tempo); }
        function interpreta(blob) {
          pinta('lendo');
          var p = DEMO ? new Promise(function (ok) { setTimeout(function () { ok({ type: 'expense', amount: 42.5, description: 'Almoço no hospital', category: 'Alimentação', date: hoje(), transcription: 'gastei quarenta e dois e cinquenta no almoço do hospital' }); }, 400); })
            : C.consultar('lerAudio', { blob: blob });
          p.then(function (r) { res = r; pinta('pronto'); }, function (x) { pinta('', 'Não consegui ler o áudio: ' + x.message); });
        }
        c.addEventListener('click', function (e) {
          var b = e.target.closest('button'); if (!b) return;
          if (b.dataset.topo) { para(); return api.fechar(); }
          var x = b.dataset.x;
          if (x === 'exemplo') return interpreta(null);
          if (x === 'gravar') {
            if (!navigator.mediaDevices || !W.MediaRecorder) return pinta('', 'Este navegador não grava áudio.');
            navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true, autoGainControl: true } }).then(function (stream) {
              var mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '';
              var op = { audioBitsPerSecond: 24000 }; if (mime) op.mimeType = mime;
              rec = new MediaRecorder(stream, op); partes = [];
              rec.ondataavailable = function (ev) { if (ev.data.size) partes.push(ev.data); };
              rec.onstop = function () { interpreta(new Blob(partes, { type: rec.mimeType || 'audio/webm' })); };
              rec.start(); ini = Date.now();
              pinta('gravando', '0:00');
              tempo = setInterval(function () { var s = Math.floor((Date.now() - ini) / 1000), t = c.querySelector('.fz-voz-t'); if (t) t.textContent = Math.floor(s / 60) + ':' + p2(s % 60); if (s >= 30) para(); }, 250);
            }, function () { pinta('', 'Sem permissão para o microfone.'); });
            return;
          }
          if (x === 'parar') return para();
          if (x === 'descartar') { res = null; return pinta(''); }
          if (x === 'editar') { var r0 = res; api.fechar(); return folhaLancar({ pre: { modo: r0.type === 'income' ? 'receita' : 'despesa', amount: +r0.amount || 0, description: r0.description || '', category: r0.category || '', date: r0.date || hoje() } }); }
          if (x === 'salvar') {
            b.disabled = true;
            C.lancarVoz({ type: res.type === 'income' ? 'income' : 'expense', amount: +res.amount || 0, description: res.description || res.transcription || 'Lançamento por voz', category: res.category || 'Outros', date: res.date || hoje() })
              .then(function () { api.fechar(); aviso('Lançado por voz'); }, function (er) { b.disabled = false; var r = c.querySelector('.g-erro'); r.textContent = er.message; r.hidden = false; });
          }
        });
        pinta('');
      },
      aoFechar: function () { }
    });
  }

  function folhaFatura() {
    U.folha({
      titulo: 'Ler fatura ou extrato', classe: 'g-folha fz-folha', alta: true,
      conteudo: function (c, api) {
        var itens = null;
        function pinta(msg) {
          var h = K.topo('Ler fatura ou extrato', 'Fechar');
          if (itens) {
            h += '<p class="g-t2">' + esc(itens.length + ' lançamentos encontrados. Confira antes de importar: entram como despesas.') + '</p><div class="g-cartao"><div class="fz-lista">' + itens.map(function (it) {
              return item({ t: it.description, sub: K.curto(it.date) + ' · ' + it.category, v: '− ' + realC(+it.amount || 0) });
            }).join('') + '</div></div><p class="g-erro" role="alert" hidden></p><button type="button" class="fz-cheio" data-x="importar">Importar tudo</button><button type="button" class="fz-claro" data-x="cancelar">Cancelar</button>';
          } else {
            h += '<p class="g-t2">Envie o PDF ou a foto da fatura do cartão ou do extrato. A IA do Granaê lê os lançamentos e você confere antes de importar. Até 10 MB.</p>' + (msg ? '<p class="' + (/^Lendo/.test(msg) ? 'g-t2' : 'g-alerta-tx') + '" role="status">' + esc(msg) + '</p>' : '') +
              '<label class="fz-cheio fz-arquivo">Escolher arquivo<input type="file" name="arquivo" accept="application/pdf,image/*"></label>' + (DEMO ? '<button type="button" class="fz-claro" data-x="exemplo">Usar o exemplo da demonstração</button>' : '');
          }
          c.innerHTML = h;
        }
        function le(arq) {
          if (arq && arq.size > 10 * 1024 * 1024) return pinta('Arquivo grande demais (máximo 10 MB). Envie as páginas em partes ou uma foto ou PDF mais leve.');
          pinta('Lendo o arquivo. Pode levar até 30 segundos.');
          var p = DEMO ? new Promise(function (ok) { setTimeout(function () { ok({ items: [{ description: 'Farmácia', amount: 58.4, date: iso(K.somaDias(new Date(), -3)), category: 'Saúde' }, { description: 'Posto de gasolina', amount: 210, date: iso(K.somaDias(new Date(), -4)), category: 'Transporte' }] }); }, 400); })
            : C.consultar('lerFatura', { arquivo: arq });
          p.then(function (r) { var l = (r && r.items) || []; if (!l.length) return pinta('Nenhum lançamento encontrado no arquivo.'); itens = l; pinta(); }, function (x) { pinta('Não consegui ler: ' + x.message); });
        }
        c.addEventListener('change', function (e) { if (e.target.name === 'arquivo' && e.target.files && e.target.files[0]) le(e.target.files[0]); });
        c.addEventListener('click', function (e) {
          var b = e.target.closest('button'); if (!b) return;
          if (b.dataset.topo) return api.fechar();
          if (b.dataset.x === 'exemplo') return le(null);
          if (b.dataset.x === 'cancelar') { itens = null; return pinta(); }
          if (b.dataset.x === 'importar') {
            b.disabled = true;
            C.importarFatura(itens).then(function (n) { api.fechar(); aviso(n + ' lançamentos importados'); }, function (er) { b.disabled = false; var r = c.querySelector('.g-erro'); r.textContent = er.message; r.hidden = false; });
          }
        });
        pinta();
      }
    });
  }

  /* CSV do mês: a mesma planilha do botão CSV do Granaê (; + BOM + proteção contra fórmula) */
  function baixarCSV() {
    var r = K.mesCivil(F.ref);
    var campo = function (v) { var x = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(x)) x = "'" + x; return /[",\n\r]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
    var linhas = [['Data', 'Tipo', 'Descrição', 'Categoria', 'Valor', 'Status']].concat(g().transactions.filter(function (t) { return K.contem(r, t.date); })
      .sort(function (a, b) { return a.date.localeCompare(b.date); })
      .map(function (t) { return [t.date, t.type === 'income' ? 'Receita' : 'Despesa', t.description, t.category, String(t.amount).replace('.', ','), t.pending ? 'Agendado' : 'Efetivado']; }));
    var csv = linhas.map(function (l) { return l.map(campo).join(';'); }).join('\n');
    var a = D.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'granae-' + chaveMes(r.s) + '.csv'; D.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    aviso('CSV de ' + MESES[r.s.getMonth()] + ' baixado');
  }

  /* Mais opções */
  function maisOpcoes() {
    var r = K.mesCivil(F.ref), n = g().transactions.filter(function (t) { return K.contem(r, t.date) && semCategoria(t); }).length;
    U.folha({
      titulo: 'Mais opções', classe: 'g-folha g-mais-f', alta: true,
      conteudo: function (c, api) {
        function op(x, t, s) { return '<button type="button" class="g-opcao g-link" data-x="' + x + '"><span>' + esc(t) + '</span>' + (s ? '<small>' + esc(s) + '</small>' : '') + '</button>'; }
        c.innerHTML = '<div class="g-topo"><span class="g-topo-esq"></span><h2 class="g-topo-t" data-foco tabindex="-1">Mais opções</h2><button type="button" class="g-topo-bt dir" data-fechar="1" style="color:var(--g-fi-tx)">Fechar</button></div>' +
          '<div class="g-sup">' + op('voz', 'Lançar por voz', 'fale o gasto') + op('fatura', 'Ler fatura ou extrato', 'PDF ou foto') + op('transferir', 'Transferir entre contas', '') +
          op('revisar', 'Revisar sem categoria', n === 1 ? '1 neste mês' : n + ' neste mês') + op('fixos', 'Fixos e tetos', g().fixedItems.length + ' fixos') + op('csv', 'Baixar CSV de ' + MESES[r.s.getMonth()], '') + '</div>' +
          '<p class="g-rot g-rot-fora">Abrem o Granaê no site</p><div class="g-sup">' + [
            ['Regras automáticas e filtros salvos', '../granae.html#transacoes'], ['Categorias, contas e cartões', '../granae.html#categorias'],
            ['Conectar ou reconectar banco', '../granae.html#categorias'], ['Importar planilha de fixos', '../granae.html#fixos'], ['Análise completa por IA', '../granae.html#ia']
          ].map(function (x) { return '<a class="g-opcao" href="' + x[1] + '">' + esc(x[0]) + '</a>'; }).join('') + '</div>';
        c.addEventListener('click', function (e) {
          var b = e.target.closest('button'); if (!b) return;
          if (b.dataset.fechar) return api.fechar();
          var x = b.dataset.x; if (!x) return;
          api.fechar();
          if (x === 'voz') return folhaVoz();
          if (x === 'fatura') return folhaFatura();
          if (x === 'transferir') return folhaLancar({ modo: 'transferencia' });
          if (x === 'revisar') return irAba('lancamentos', function () { limpaFiltro(); F.filtro.semCat = true; });
          if (x === 'fixos') return folhaFixosTetos('fixos');
          if (x === 'csv') return baixarCSV();
        });
      }
    });
  }

  /* ---------- ligação com o cofre e com a casca ---------- */
  D.addEventListener('medtech:cofre', function (e) {
    var o = e.detail && e.detail.origem;
    if (!F.el || (o !== 'granae' && o !== 'situacao')) return;
    if (D.activeElement && D.activeElement.name === 'busca' && F.el.contains(D.activeElement)) { var c = F.el.querySelector('.fz-lanc-corpo'); if (c) c.innerHTML = corpoLancamentos(); return; }
    desenha();
  });
  Casca.registrar('secao', 'financas', monta);
  W.MTFinancas = { F: F, irAba: irAba, desenha: desenha, _painel: painel, _infoCartao: infoCartao };
})();
