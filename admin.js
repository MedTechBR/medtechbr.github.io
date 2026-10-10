/* ============================================================
   admin.js — Administração MedTech (10/10/2026, abertura das vendas)
   Tudo passa pelo servidor (o navegador não decide nada de acesso):
     mtAdmin  {acao:'painel'|'assinantes'|'pedidos'|'ver'|'conceder'|'revogar'|'teste'|'geracaoIA'|'testeIA'}
     mpCheckout / mpCancelar (compra de teste R$ 5)
     mtSinal  {op:'listar', status:'aberta'}
   Se o servidor ainda não tiver as ações novas (painel, assinantes, pedidos),
   a página avisa para publicar (deploy-backend.command) e o resto segue.
   ============================================================ */
(function () {
'use strict';
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brlCurto = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });
const inteiro = v => Number(v || 0).toLocaleString('pt-BR');
const dataS = s => s ? new Date(s * 1000).toLocaleDateString('pt-BR') : '—';
const quando = iso => iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
const ddmm = d => d ? d.slice(8, 10) + '/' + d.slice(5, 7) : '';
const plural = (n, um, varios) => inteiro(n) + ' ' + (Number(n) === 1 ? um : varios);
const agoraS = () => Math.floor(Date.now() / 1000);

const SECOES = ['visao', 'assinantes', 'acessos', 'pagamentos', 'planos', 'sinalizacoes', 'diagnostico'];
/* apps: mesmos nomes, ícones e cores do catálogo do _mtauth */
const APPS = {
  condutai: { nm: 'CondutAI', ic: 'ti-stethoscope', c: '#1D6FD0', url: '/condutai.html' },
  laudai: { nm: 'LaudAI', ic: 'ti-report-medical', c: '#4166D6', url: '/laudai.html' },
  paliai: { nm: 'PaliAI', ic: 'ti-heart-handshake', c: '#B84A86', url: '/paliai.html' },
  plantaohub: { nm: 'PlantãoHub', ic: 'ti-clock', c: '#15966F', url: '/plantaohub.html' },
  granae: { nm: 'Granaê', ic: 'ti-wallet', c: '#6D46D8', url: '/granae.html' },
  flashmed: { nm: 'FlashMed', ic: 'ti-cards', c: '#A86D12', url: '/flashmed.html' },
  clinicamed: { nm: 'ClínicaMed', ic: 'ti-heartbeat', c: '#0B6A72', url: '/clinicamed/' },
  cirurgiamed: { nm: 'CirurgiaMed', ic: 'ti-cut', c: '#33479E', url: '/cirurgiamed/' },
  trafegotitulo: { nm: 'TráfegoTítulo', ic: 'ti-car', c: '#23272E', url: '/trafego-titulo/' }
};
const ROTULO = {
  mp_approved: 'Pagamento aprovado', mp_refunded: 'Reembolso', mp_charged_back: 'Contestação no cartão',
  order_approved: 'Compra aprovada (Kiwify)', subscription_renewed: 'Renovação (Kiwify)', order_refunded: 'Reembolso (Kiwify)',
  chargeback: 'Contestação (Kiwify)', mp_assinatura_cancelada: 'Assinatura cancelada', mp_cancelada_pelo_usuario: 'Cancelada pelo assinante',
  subscription_canceled: 'Assinatura cancelada (Kiwify)', subscription_cancelled: 'Assinatura cancelada (Kiwify)',
  subscription_late: 'Pagamento atrasado (Kiwify)', admin_conceder: 'Liberação manual', admin_revogar: 'Revogação manual'
};
const METODO = { pix: 'Pix', credit_card: 'cartão de crédito', debit_card: 'cartão de débito', ticket: 'boleto', account_money: 'saldo Mercado Pago', bank_transfer: 'transferência' };
const GATEWAY = { mp: 'Mercado Pago', kiwify: 'Kiwify', admin: 'manual' };
const ORIGEM = { compra: 'Compra', admin: 'Liberação manual', cortesia: 'Cortesia', teste: 'Compra de teste', 'sem registro': 'Sem registro', 'sem dado': 'Sem dado' };

const E = { planos: null, painel: null, naoPublicado: false, bloqueado: false, carregou: {}, medida: 'receita',
  as: { pagina: 1 }, pgTipo: 'todos', iniciado: false };

/* ---------------- servidor ---------------- */
async function modulo() {
  if (window.MT && MT.acessoModulo) { const m = await MT.acessoModulo(); if (m) return m; }
  if (!window.MTAcesso) await import('/_mtacesso.js?v=6');
  return window.MTAcesso;
}
async function chamar(nome, dados) { const A = await modulo(); return A.chamar(nome, dados || {}, MT.user); }
const ehNaoPublicado = e => /Ação desconhecida/i.test((e && e.message) || '') || (e && (e.status === 404 || e.status === 'NOT_FOUND'));
const ehNegado = e => (e && e.status === 'PERMISSION_DENIED') || /administração do MedTech/i.test((e && e.message) || '');
async function admin(dados) {
  try { return await chamar('mtAdmin', dados); }
  catch (e) {
    if (ehNegado(e)) bloquear(e.message);
    if (ehNaoPublicado(e) && ['painel', 'assinantes', 'pedidos'].includes(dados.acao)) { E.naoPublicado = true; e.naoPublicado = true; }
    throw e;
  }
}
async function planos() {
  if (E.planos) return E.planos;
  try { const A = await modulo(); E.planos = await A.carregarPlanos(); }
  catch (e) { E.planos = { produtos: [], linhas: {} }; }
  return E.planos;
}
const produto = id => ((E.planos && E.planos.produtos) || []).find(p => p.id === id) || null;
const nomeProd = id => { const p = produto(id); return p ? (p.curto || p.nome || id) : (id || '—'); };

/* ---------------- avisos ---------------- */
function avisoPublicar(oque) {
  return `<div class="aviso"><i class="ti ti-cloud-upload" aria-hidden="true"></i><div><b>Publique o servidor para ver ${esc(oque)}.</b>
    As funções novas do painel já estão prontas, mas ainda não foram publicadas. No Mac, rode <code>deploy-backend.command</code>
    (pasta MedTech/backend) e depois clique em Atualizar. Consultar, liberar, revogar e a compra de teste já funcionam.</div></div>`;
}
function avisoErro(e) {
  return `<div class="aviso err"><i class="ti ti-alert-triangle" aria-hidden="true"></i><div><b>Não consegui ler agora.</b> ${esc((e && e.message) || e)}</div></div>`;
}
const carregando = t => `<p class="carregando">${esc(t || 'Carregando…')}</p>`;
let tToast = 0;
function toast(msg, tipo) {
  const t = $('toast'); t.textContent = msg; t.className = 'toast' + (tipo ? ' ' + tipo : ''); t.hidden = false;
  clearTimeout(tToast); tToast = setTimeout(() => { t.hidden = true; }, 4200);
}
function bloquear(msg) {
  if (E.bloqueado) return;
  E.bloqueado = true;
  document.querySelectorAll('[data-painel]').forEach(el => el.hidden = true);
  document.querySelector('.menu').hidden = true;
  document.querySelector('.adm').classList.add('so');
  $('bloqTxt').textContent = (msg || 'O servidor recusou o acesso.') + ' Entre com a conta de administração do MedTech.';
  $('bloqueio').hidden = false;
}

/* ---------------- diálogo ---------------- */
let voltaFoco = null;
function dialogo(titulo, corpoHtml, botoes) {
  const d = $('dlg');
  voltaFoco = document.activeElement;
  $('dlgTit').textContent = titulo;
  $('dlgCorpo').innerHTML = corpoHtml;
  const rod = $('dlgRodape'); rod.innerHTML = '';
  (botoes || [{ rot: 'Fechar', cls: 'btn-g' }]).forEach(b => {
    const el = document.createElement('button');
    el.type = 'button'; el.className = 'btn ' + (b.cls || 'btn-g'); el.innerHTML = b.rot;
    el.onclick = async () => {
      if (!b.acao) return d.close();
      rod.querySelectorAll('button').forEach(x => x.disabled = true);
      try { const fecha = await b.acao(); if (fecha !== false) d.close(); }
      finally { rod.querySelectorAll('button').forEach(x => x.disabled = false); }
    };
    rod.appendChild(el);
  });
  if (!d.open) d.showModal();
  const foco = d.querySelector('#dlgCorpo input, #dlgCorpo select') || rod.querySelector('button:last-child');
  if (foco) setTimeout(() => foco.focus(), 30);
  return d;
}
$('dlg').addEventListener('close', () => { if (voltaFoco && voltaFoco.focus) try { voltaFoco.focus(); } catch (e) {} });
$('dlg').querySelector('[data-fecha]').onclick = () => $('dlg').close();
function confirmar(titulo, texto, rotOk, perigo) {
  return new Promise(res => {
    let ok = false;
    const d = dialogo(titulo, `<p>${texto}</p>`, [
      { rot: 'Cancelar', cls: 'btn-g' },
      { rot: rotOk, cls: perigo ? 'btn-dn' : 'btn-p', acao: () => { ok = true; } }
    ]);
    d.addEventListener('close', () => res(ok), { once: true });
  });
}

/* ---------------- navegação ---------------- */
function irPara(sec, focar) {
  if (!SECOES.includes(sec)) sec = 'visao';
  if (!E.bloqueado) document.querySelectorAll('[data-painel]').forEach(el => el.hidden = el.id !== sec);
  document.querySelectorAll('.menu a').forEach(a => {
    if (a.dataset.sec === sec) { a.setAttribute('aria-current', 'page'); if (a.scrollIntoView && window.innerWidth <= 960) a.scrollIntoView({ block: 'nearest', inline: 'center' }); }
    else a.removeAttribute('aria-current');
  });
  window.scrollTo(0, 0);
  setTimeout(() => window.scrollTo(0, 0), 0);   /* o navegador ainda rola até a âncora depois de mostrar a seção */
  if (focar) { const h = document.querySelector('#' + sec + ' h2'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } }
  if (E.iniciado && !E.bloqueado) abrirSecao(sec);
}
window.addEventListener('hashchange', () => irPara(location.hash.slice(1), true));
function abrirSecao(sec) {
  if (sec === 'visao') { if (!E.carregou.painel) carregarPainel(); else if (E.painel) desenharPainel(); }
  if (sec === 'assinantes' && !E.carregou.assinantes) carregarAssinantes();
  if (sec === 'pagamentos' && !E.carregou.pedidos) carregarPedidos();
  if (sec === 'planos' && !E.carregou.planos) desenharPlanos();
  if (sec === 'sinalizacoes' && !E.carregou.sinal) carregarSinal();
  if (sec === 'diagnostico' && !E.carregou.ia) carregarIA();
}

/* ============================================================
   VISÃO GERAL
   ============================================================ */
async function carregarPainel() {
  E.carregou.painel = true;
  $('btVg').disabled = true;
  $('vgQuando').textContent = 'Atualizando…';
  if (!E.painel) $('vgKpis').innerHTML = carregando('Carregando os números…');
  try {
    E.painel = await admin({ acao: 'painel' });
    E.naoPublicado = false;
    $('vgAviso').innerHTML = '';
    desenharPainel();
    $('vgQuando').textContent = 'Atualizado às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    if (E.bloqueado) return;
    $('vgQuando').textContent = '';
    $('vgAviso').innerHTML = e.naoPublicado ? avisoPublicar('os números') : avisoErro(e);
    E.painel = null;
    desenharPainel();
  } finally { $('btVg').disabled = false; }
}
const SEM = (motivo) => `<span class="semdado" title="${esc(motivo || 'o servidor não devolveu este número')}">sem dado</span>`;
function kpi(rot, icone, valor, det) {
  return `<div class="kpi"><span class="rot"><i class="ti ${icone}" aria-hidden="true"></i>${rot}</span><span class="v">${valor}</span><span class="det">${det || '&nbsp;'}</span></div>`;
}
function desenharPainel() {
  const p = E.painel || {};
  const c = p.contas && p.contas.ok ? p.contas : null;
  const v = p.vendas && p.vendas.ok ? p.vendas : null;
  const pend = p.pendentes && p.pendentes.ok ? p.pendentes : null;
  const erro = s => (s && s.erro) || (E.painel ? '' : 'servidor sem as funções do painel');
  const ks = [];
  ks.push(kpi('Assinantes ativos', 'ti-users', c ? inteiro(c.assinantes.ativos) : SEM(erro(p.contas)),
    c ? plural(c.assinantes.cortesias, 'cortesia', 'cortesias') + (pend ? ' · ' + plural(pend.n, 'compra aguardando conta', 'compras aguardando conta') : '') : ''));
  ks.push(kpi('Receita em 30 dias', 'ti-cash', v ? brl(v.d30.receita) : SEM(erro(p.vendas)),
    v ? plural(v.d30.n, 'venda', 'vendas') + (v.estimados ? ' · ' + inteiro(v.estimados) + ' com valor estimado' : '') : ''));
  ks.push(kpi('Vendas hoje', 'ti-shopping-cart', v ? inteiro(v.hoje.n) : SEM(erro(p.vendas)), v ? brl(v.hoje.receita) : ''));
  ks.push(kpi('Vendas em 7 dias', 'ti-calendar-week', v ? inteiro(v.d7.n) : SEM(erro(p.vendas)), v ? brl(v.d7.receita) : ''));
  ks.push(kpi('Reembolsos em 30 dias', 'ti-receipt-refund', v ? inteiro(v.reembolsos.n) : SEM(erro(p.vendas)),
    v ? brl(v.reembolsos.valor) + ' · ' + plural(v.cancelamentos, 'cancelamento', 'cancelamentos') : ''));
  ks.push(kpi('Contas novas em 7 dias', 'ti-user-plus', c ? inteiro(c.contas.d7) : SEM(erro(p.contas)),
    c ? 'hoje ' + inteiro(c.contas.hoje) + ' · 30 dias ' + inteiro(c.contas.d30) + ' · total ' + inteiro(c.contas.total) : ''));
  $('vgKpis').innerHTML = ks.join('');

  desenharGrafico();

  /* cartões menores */
  const a = p.assinaturas && p.assinaturas.ok ? p.assinaturas : null;
  const ia = p.ia && p.ia.ok ? p.ia : null;
  const si = p.sinalizacoes && p.sinalizacoes.ok ? p.sinalizacoes : null;
  const mais = [];
  mais.push(`<div class="card"><h3><i class="ti ti-repeat" aria-hidden="true"></i>Assinaturas mensais</h3><p class="sub">Recorrentes no cartão, pelo Mercado Pago.</p>
    ${a ? `<div class="mini"><div><b>${inteiro(a.ativas)}</b><span>ativas</span></div><div><b>${inteiro(a.canceladas)}</b><span>canceladas</span></div>
      <div><b>${inteiro(a.pendentes)}</b><span>iniciadas sem pagar</span></div>${a.pausadas ? `<div><b>${inteiro(a.pausadas)}</b><span>pausadas</span></div>` : ''}</div>`
      : `<p class="vazio">${SEM(erro(p.assinaturas))}</p>`}</div>`);
  mais.push(`<div class="card"><h3><i class="ti ti-sparkles" aria-hidden="true"></i>Uso de IA hoje</h3>
    <p class="sub">${ia ? plural(ia.contas, 'conta usou', 'contas usaram') + ' a IA hoje. O contador vira ' + (ia.fuso === 'brasilia' ? 'à meia-noite' : 'às 21h') + ' (Brasília).' : 'Chamadas de IA de todas as contas.'}</p>
    ${ia ? `<div class="mini"><div><b>${inteiro(ia.hoje.texto)}</b><span>texto</span></div><div><b>${inteiro(ia.hoje.imagem)}</b><span>imagem</span></div>
      <div><b>${inteiro(ia.hoje.audio)}</b><span>áudio</span></div><div><b>${inteiro(ia.hoje.doc)}</b><span>documento</span></div></div>
      ${ia.detalhe ? `<div class="mini" style="margin-top:8px"><div><b>${inteiro(ia.detalhe.cache)}</b><span>do cache (sem custo)</span></div><div><b>${inteiro(ia.detalhe.busca)}</b><span>com busca no Google</span></div>
      <div><b>${inteiro(ia.detalhe.rapido)}</b><span>Flash-Lite</span></div><div><b>${inteiro(ia.detalhe.padrao)}</b><span>Flash</span></div><div><b>${inteiro(ia.detalhe.forte)}</b><span>Pro</span></div></div>` : ''}
      ${ia.total ? '' : '<p class="sub" style="margin-top:10px">O dia do uso passou a ser gravado com a publicação do servidor de 10/10/2026. Antes disso este número fica zerado.</p>'}`
      : `<p class="vazio">${SEM(erro(p.ia))}</p>`}</div>`);
  const alertas = [];
  if (si) alertas.push(`<li><a href="#sinalizacoes"><b>${inteiro(si.abertas)}</b> ${si.abertas === 1 ? 'sinalização aberta' : 'sinalizações abertas'}</a></li>`);
  if (v && v.revisar) alertas.push(`<li><a href="#pagamentos" data-pg="revisar"><b>${inteiro(v.revisar)}</b> ${v.revisar === 1 ? 'pagamento a revisar' : 'pagamentos a revisar'}</a> (sem conta ou produto reconhecido)</li>`);
  if (pend && pend.n) alertas.push(`<li><b>${inteiro(pend.n)}</b> ${pend.n === 1 ? 'compra ou liberação espera' : 'compras ou liberações esperam'} a pessoa criar a conta</li>`);
  if (v && v.testes) alertas.push(`<li><b>${inteiro(v.testes)}</b> ${v.testes === 1 ? 'compra de teste' : 'compras de teste'} em 30 dias (fora da receita)</li>`);
  if (c && c.truncado) alertas.push('<li>Mais de 20 mil contas: os números de contas consideram só as primeiras 20 mil.</li>');
  if (v && v.truncado) alertas.push('<li>Mais de 2.000 pedidos em 30 dias: a receita considera só os 2.000 mais recentes.</li>');
  mais.push(`<div class="card"><h3><i class="ti ti-bell" aria-hidden="true"></i>Pede atenção</h3>
    ${alertas.length ? `<ul style="margin:10px 0 0 18px;display:flex;flex-direction:column;gap:6px;font-size:14px">${alertas.join('')}</ul>` : `<p class="vazio">${E.painel ? 'Nada pendente.' : SEM()}</p>`}</div>`);
  $('vgMais').innerHTML = mais.join('');
  $('vgMais').querySelectorAll('[data-pg]').forEach(x => x.addEventListener('click', () => { E.pgTipo = x.dataset.pg; E.carregou.pedidos = false; marcarChips('pgTipos', 'tipo', E.pgTipo); }));
  if (c) barras($('grafContas'), c.contas.porDia.map(d => ({ dia: d.dia, v: d.n })), inteiro, 'Contas novas por dia', 150);
  else $('grafContas').innerHTML = `<p class="vazio">${SEM(erro(p.contas))}</p>`;

  /* badge das sinalizações */
  const cnt = $('cntSinal');
  if (si && si.abertas) { cnt.innerHTML = (si.abertas > 99 ? '99+' : si.abertas) + '<span class="sr"> abertas</span>'; cnt.hidden = false; }
  else cnt.hidden = true;

  /* por produto */
  const ids = new Set();
  ((E.planos && E.planos.produtos) || []).forEach(x => { if (!x.teste) ids.add(x.id); });
  if (c) Object.keys(c.assinantes.porProduto).forEach(k => ids.add(k));
  if (v) Object.keys(v.porProduto).forEach(k => ids.add(k));
  if (!c && !v) { $('vgProdutos').innerHTML = `<p class="vazio">${SEM()}</p>`; return; }
  const linhas = [...ids].map(id => {
    const as = c ? ((c.assinantes.porProduto[id] || {}).n || 0) : null;
    const vp = v ? (v.porProduto[id] || { n: 0, receita: 0 }) : null;
    return { id, as, vn: vp ? vp.n : null, vr: vp ? vp.receita : null };
  }).sort((x, y) => (y.as || 0) - (x.as || 0) || (y.vr || 0) - (x.vr || 0));
  $('vgProdutos').innerHTML = `<div class="tblw"><table class="tbl resp"><thead><tr><th scope="col">Produto</th><th scope="col" class="n">Assinantes ativos</th><th scope="col" class="n">Vendas em 30 dias</th><th scope="col" class="n">Receita em 30 dias</th></tr></thead><tbody>
    ${linhas.map(l => `<tr><th scope="row" data-r="Produto" style="background:none;font-size:14px;color:var(--tinta)">${esc(nomeProd(l.id))}</th>
      <td class="n" data-r="Assinantes ativos">${l.as === null ? '—' : inteiro(l.as)}</td><td class="n" data-r="Vendas em 30 dias">${l.vn === null ? '—' : inteiro(l.vn)}</td>
      <td class="n" data-r="Receita em 30 dias">${l.vr === null ? '—' : brl(l.vr)}</td></tr>`).join('')}</tbody></table></div>`;
}

function desenharGrafico() {
  const v = E.painel && E.painel.vendas && E.painel.vendas.ok ? E.painel.vendas : null;
  if (!v) {
    $('grafVendas').innerHTML = `<p class="vazio">${E.painel ? SEM(E.painel.vendas && E.painel.vendas.erro) : 'O gráfico aparece quando o servidor devolver os números.'}</p>`;
    $('tabVendas').innerHTML = '';
    return;
  }
  const rec = E.medida === 'receita';
  barras($('grafVendas'), v.porDia.map(d => ({ dia: d.dia, v: rec ? d.receita : d.n, extra: rec ? plural(d.n, 'venda', 'vendas') : brl(d.receita) })),
    rec ? brl : inteiro, rec ? 'Receita por dia' : 'Vendas por dia', 220, rec ? brlCurto : inteiro);
  $('tabVendas').innerHTML = `<div class="tblw"><table class="tbl"><caption>Vendas e receita por dia, últimos 30 dias</caption><thead><tr><th scope="col">Dia</th><th scope="col" class="n">Vendas</th><th scope="col" class="n">Receita</th></tr></thead><tbody>
    ${v.porDia.slice().reverse().map(d => `<tr><th scope="row" style="background:none;font-weight:500;color:var(--tinta)">${ddmm(d.dia)}</th><td class="n">${inteiro(d.n)}</td><td class="n">${brl(d.receita)}</td></tr>`).join('')}</tbody></table></div>`;
}
document.querySelectorAll('[data-med]').forEach(b => b.addEventListener('click', () => {
  E.medida = b.dataset.med;
  document.querySelectorAll('[data-med]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  desenharGrafico();
}));

/* gráfico de barras em SVG, feito à mão (sem biblioteca) */
function escala(max) {
  if (!(max > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(max)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= max) return m * p;
  return 10 * p;
}
function barras(el, serie, fmt, rotulo, alt, fmtEixo) {
  if (!el) return;
  fmtEixo = fmtEixo || fmt;
  const W = Math.max(260, Math.floor(el.clientWidth || 600)), H = alt || 220;
  const padL = 52, padR = 6, padT = 10, padB = 24;
  const max = Math.max(0, ...serie.map(d => d.v || 0));
  const topo = escala(max);
  const n = serie.length, larg = (W - padL - padR) / n, gap = Math.max(1.5, larg * 0.24);
  const y = v => H - padB - (v / topo) * (H - padT - padB);
  let s = '';
  [0, topo / 2, topo].forEach(g => {
    s += `<line class="grade" x1="${padL}" x2="${W - padR}" y1="${y(g).toFixed(1)}" y2="${y(g).toFixed(1)}"/>`;
    s += `<text class="eixo" x="${padL - 8}" y="${(y(g) + 4).toFixed(1)}" text-anchor="end">${esc(fmtEixo(g))}</text>`;
  });
  const passo = Math.ceil(n / (W < 420 ? 4 : 7));
  const hoje = serie.length ? serie[serie.length - 1].dia : '';
  serie.forEach((d, i) => {
    const x = padL + i * larg + gap / 2, w = Math.max(1, larg - gap);
    const v = d.v || 0;
    const h = Math.max(v > 0 ? 2 : 0, (v / topo) * (H - padT - padB));
    const tip = ddmm(d.dia) + ': ' + fmt(v) + (d.extra ? ' · ' + d.extra : '');
    if (v > 0) s += `<rect class="barra${d.dia === hoje ? ' hoje' : ''}" x="${x.toFixed(1)}" y="${(H - padB - h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(3, w / 2, h / 2).toFixed(1)}" data-tip="${esc(tip)}"><title>${esc(tip)}</title></rect>`;
    else s += `<rect class="zero" x="${x.toFixed(1)}" y="${(H - padB - 1).toFixed(1)}" width="${w.toFixed(1)}" height="1"><title>${esc(tip)}</title></rect>`;
    if (i % passo === 0 || i === n - 1) {
      if (i === n - 1 || n - 1 - i >= passo / 2) s += `<text class="eixo" x="${(x + w / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${i === n - 1 ? 'hoje' : ddmm(d.dia)}</text>`;
    }
  });
  const total = serie.reduce((t, d) => t + (d.v || 0), 0);
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(rotulo)} nos últimos ${n} dias. Total: ${esc(fmt(total))}. Maior dia: ${esc(fmt(max))}.">${s}</svg><div class="dica" hidden></div>`;
  const dica = el.querySelector('.dica');
  el.querySelectorAll('rect.barra').forEach(r => {
    const mostra = () => {
      const b = r.getBoundingClientRect(), base = el.getBoundingClientRect();
      dica.textContent = r.dataset.tip; dica.hidden = false;
      dica.style.left = (b.left - base.left + b.width / 2) + 'px'; dica.style.top = (b.top - base.top) + 'px';
    };
    r.addEventListener('pointerenter', mostra); r.addEventListener('pointerdown', mostra);
    r.addEventListener('pointerleave', () => { dica.hidden = true; });
  });
}
let tResize = 0;
window.addEventListener('resize', () => { clearTimeout(tResize); tResize = setTimeout(() => { if (E.painel && !$('visao').hidden) desenharPainel(); }, 200); });
$('btVg').onclick = () => carregarPainel();

/* ============================================================
   ASSINANTES
   ============================================================ */
function faltam(ate) {
  const d = Math.ceil((ate - agoraS()) / 86400);
  if (d < 0) return `<span class="selo err">venceu há ${plural(-d, 'dia', 'dias')}</span>`;
  if (d === 0) return '<span class="selo av">vence hoje</span>';
  return `<span class="selo ${d <= 7 ? 'av' : 'ok'}">${d <= 7 ? 'faltam ' : ''}${plural(d, 'dia', 'dias')}</span>`;
}
function origemTxt(x) {
  let t = ORIGEM[x.origem] || x.origem || '—';
  if (x.origem === 'compra' && x.gateway) t += ' · ' + (GATEWAY[x.gateway] || x.gateway);
  return t;
}
async function carregarAssinantes() {
  E.carregou.assinantes = true;
  const q = { acao: 'assinantes', pagina: E.as.pagina, porPagina: 25, produto: $('asProd').value, busca: $('asBusca').value.trim(),
    situacao: $('asSit').value, ordem: $('asOrdem').value };
  $('asLista').innerHTML = carregando('Carregando assinantes…');
  try {
    const r = await admin(q);
    $('asAviso').innerHTML = '';
    E.as.pagina = r.pagina;
    desenharAssinantes(r);
  } catch (e) {
    if (E.bloqueado) return;
    $('asAviso').innerHTML = e.naoPublicado ? avisoPublicar('a lista de assinantes') : avisoErro(e);
    $('asLista').innerHTML = e.naoPublicado ? '<p class="vazio">Enquanto isso, consulte uma conta pelo e-mail em Acessos.</p>' : '';
  }
}
function desenharAssinantes(r) {
  const avisos = [];
  if (!r.origensOk) avisos.push('A origem de cada acesso não pôde ser lida agora.');
  if (r.truncado) avisos.push('Há mais de 20 mil contas: a lista considera só as primeiras 20 mil.');
  if (!r.itens.length) {
    $('asLista').innerHTML = `<p class="vazio">${r.busca || r.produto ? 'Ninguém com esses filtros.' : (r.situacao === 'vencidos' ? 'Nenhum acesso vencido nos últimos 60 dias.' : 'Ainda não há assinantes.')}</p>`;
    return;
  }
  const linhas = r.itens.map((x, i) => `<tr>
      <td data-r="E-mail" class="em cheia">${esc(x.email || '(sem e-mail)')}</td>
      <td data-r="Produto">${esc(x.nome || x.produto)}</td>
      <td data-r="Válido até"><span>${dataS(x.ate)} ${faltam(x.ate)}</span></td>
      <td data-r="Período" class="fraco">${esc(x.periodo || '—')}</td>
      <td data-r="Origem" class="fraco">${esc(origemTxt(x))}</td>
      <td class="acoes"><div class="acoesL">
        <button class="btn btn-g sm" type="button" data-ac="ver" data-i="${i}" title="Detalhes" aria-label="Detalhes de ${esc(x.email)}"><i class="ti ti-eye" aria-hidden="true"></i><span class="tx">Detalhes</span></button>
        <button class="btn btn-g sm" type="button" data-ac="dias" data-i="${i}" title="Liberar mais dias" aria-label="Liberar mais dias de ${esc(x.nome)} para ${esc(x.email)}"><i class="ti ti-calendar-plus" aria-hidden="true"></i><span class="tx">Mais dias</span></button>
        <button class="btn btn-dn sm" type="button" data-ac="rev" data-i="${i}" title="Revogar" aria-label="Revogar ${esc(x.nome)} de ${esc(x.email)}"><i class="ti ti-ban" aria-hidden="true"></i><span class="tx">Revogar</span></button>
      </div></td></tr>`).join('');
  $('asLista').innerHTML = (avisos.length ? `<div class="aviso" style="margin-top:12px"><i class="ti ti-info-circle" aria-hidden="true"></i><div>${avisos.map(esc).join(' ')}</div></div>` : '') +
    `<div class="tblw"><table class="tbl resp"><caption class="sr">Assinantes, página ${r.pagina} de ${r.paginas}</caption><thead><tr>
      <th scope="col">E-mail</th><th scope="col">Produto</th><th scope="col">Válido até</th><th scope="col">Período</th><th scope="col">Origem</th><th scope="col"><span class="sr">Ações</span></th>
    </tr></thead><tbody>${linhas}</tbody></table></div>
    <div class="pag"><span>${plural(r.total, 'acesso', 'acessos')} · página ${r.pagina} de ${r.paginas}</span>
      <span class="acoesL"><button class="btn btn-g sm" type="button" id="asAnt" ${r.pagina <= 1 ? 'disabled' : ''}><i class="ti ti-chevron-left" aria-hidden="true"></i>Anterior</button>
      <button class="btn btn-g sm" type="button" id="asProx" ${r.pagina >= r.paginas ? 'disabled' : ''}>Próxima<i class="ti ti-chevron-right" aria-hidden="true"></i></button></span></div>`;
  const ant = $('asAnt'), prox = $('asProx');
  if (ant) ant.onclick = () => { E.as.pagina--; carregarAssinantes(); };
  if (prox) prox.onclick = () => { E.as.pagina++; carregarAssinantes(); };
  $('asLista').querySelectorAll('[data-ac]').forEach(b => b.onclick = () => {
    const x = r.itens[Number(b.dataset.i)];
    if (b.dataset.ac === 'ver') verDetalhes(x.email);
    if (b.dataset.ac === 'dias') maisDias(x);
    if (b.dataset.ac === 'rev') revogarLinha(x);
  });
}
function verDetalhes(email) {
  dialogo(email, carregando('Consultando a conta…'));
  admin({ acao: 'ver', email }).then(r => { $('dlgCorpo').innerHTML = fichaConta(r); })
    .catch(e => { $('dlgCorpo').innerHTML = avisoErro(e); });
}
function maisDias(x) {
  dialogo('Liberar mais dias', `<p>${esc(x.nome)} para <b>${esc(x.email)}</b>. Hoje vale até ${dataS(x.ate)}.</p>
    <div class="campo" style="margin-top:12px"><label for="dlgDias">Dias a acrescentar</label><input id="dlgDias" type="number" min="1" max="3660" value="30" inputmode="numeric"></div>
    <div class="chips" style="margin-top:10px" role="group" aria-label="Atalhos de dias"><button class="chip" type="button" data-d="7">7</button><button class="chip" type="button" data-d="30">30</button><button class="chip" type="button" data-d="90">90</button><button class="chip" type="button" data-d="365">365</button></div>
    <p class="sub" style="margin-top:10px">Os dias somam a partir do fim do acesso atual. Não gera cobrança.</p>`,
  [{ rot: 'Cancelar', cls: 'btn-g' }, { rot: 'Liberar', cls: 'btn-p', acao: async () => {
    const dias = Math.floor(Number($('dlgDias').value));
    if (!(dias >= 1 && dias <= 3660)) { toast('Informe de 1 a 3660 dias.', 'erro'); return false; }
    try {
      const r = await admin({ acao: 'conceder', emails: [x.email], produto: x.produto, dias });
      const res = (r.resultado || [])[0] || {};
      if (res.erro) { toast('Não liberou: ' + res.erro, 'erro'); return false; }
      toast('Liberado até ' + dataS(res.ate) + '.', 'ok');
      carregarAssinantes();
    } catch (e) { toast('Não liberou: ' + (e.message || e), 'erro'); return false; }
  } }]);
  $('dlgCorpo').querySelectorAll('[data-d]').forEach(b => b.onclick = () => { $('dlgDias').value = b.dataset.d; });
}
async function revogarLinha(x) {
  const ok = await confirmar('Revogar acesso', `Tirar <b>${esc(x.nome)}</b> de <b>${esc(x.email)}</b>? O acesso sai na hora. Cobrança mensal no Mercado Pago não é cancelada por aqui.`, 'Revogar', true);
  if (!ok) return;
  try {
    await admin({ acao: 'revogar', email: x.email, produto: x.produto });
    toast('Acesso revogado.', 'ok');
    carregarAssinantes();
  } catch (e) { toast('Não revogou: ' + (e.message || e), 'erro'); }
}
let tBusca = 0;
$('asBusca').addEventListener('input', () => { clearTimeout(tBusca); tBusca = setTimeout(() => { E.as.pagina = 1; carregarAssinantes(); }, 400); });
['asProd', 'asSit', 'asOrdem'].forEach(id => $(id).addEventListener('change', () => { E.as.pagina = 1; carregarAssinantes(); }));

/* ============================================================
   ACESSOS
   ============================================================ */
function fichaConta(r) {
  if (!r) return '';
  const agora = r.agora || agoraS();
  const prods = Object.entries((r.mt && r.mt.p) || {}).map(([id, ate]) => ({ id, ate, onde: 'conta' }))
    .concat(Object.entries((r.pendente && r.pendente.p) || {}).map(([id, ate]) => ({ id, ate, onde: 'pendente' })));
  const ficha = [
    ['Conta', r.existe ? 'existe' : 'ainda não existe'],
    ['Criada em', r.criadoEm ? quando(r.criadoEm) : '—'],
    ['E-mail confirmado', r.existe ? (r.emailVerified ? 'sim' : 'não') : '—'],
    ['Acesso agora', r.existe ? (r.ativo ? 'liberado' : 'sem acesso pago') : '—']
  ];
  if (r.mt && r.mt.adm) ficha.push(['Perfil', 'administração']);
  if (r.mt && r.mt.t) ficha.push(['Teste grátis', (r.mt.t > agora ? 'até ' : 'terminou em ') + dataS(r.mt.t)]);
  const tabProd = prods.length ? `<div class="tblw"><table class="tbl"><caption>Produtos</caption><thead><tr><th scope="col">Produto</th><th scope="col">Vale até</th><th scope="col">Onde</th></tr></thead><tbody>
      ${prods.map(p => `<tr><td>${esc(nomeProd(p.id))}</td><td>${dataS(p.ate)} ${faltam(p.ate)}</td><td class="fraco">${p.onde === 'conta' ? 'na conta' : 'pendente (aguarda a conta)'}</td></tr>`).join('')}</tbody></table></div>`
    : '<p class="sub" style="margin-top:12px">Nenhum produto nesta conta.</p>';
  const peds = (r.pedidos || []);
  const tabPed = peds.length ? `<div class="tblw"><table class="tbl"><caption>Últimos pedidos</caption><thead><tr><th scope="col">Quando</th><th scope="col">Evento</th><th scope="col">Produto</th></tr></thead><tbody>
      ${peds.map(p => `<tr><td class="fraco">${quando(p.em)}</td><td>${esc(ROTULO[p.evento] || p.evento)}${p.revisar ? ' <span class="selo err">a revisar</span>' : ''}</td><td>${esc(nomeProd(p.produto))}${p.periodo ? ' <span class="fraco">(' + esc(p.periodo) + ')</span>' : ''}</td></tr>`).join('')}</tbody></table></div>` : '';
  const limpo = JSON.parse(JSON.stringify(r)); delete limpo.agora;
  return `<dl class="ficha">${ficha.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>${tabProd}${tabPed}
    <details class="tec"><summary>Dados técnicos</summary><pre>${esc(JSON.stringify(limpo, null, 2))}</pre></details>`;
}
$('fVer').addEventListener('submit', async ev => {
  ev.preventDefault();
  const email = $('vEmail').value.trim();
  if (!email) return;
  const out = $('outVer'); out.innerHTML = carregando('Consultando…');
  try { out.innerHTML = fichaConta(await admin({ acao: 'ver', email })); }
  catch (e) { out.innerHTML = E.bloqueado ? '' : avisoErro(e); }
});
const listaEmails = () => [...new Set($('cEmails').value.split(/[\s,;]+/).map(s => s.trim().toLowerCase()).filter(Boolean))];
$('cEmails').addEventListener('input', () => {
  const n = listaEmails().length;
  $('cConta').textContent = n ? plural(n, 'e-mail', 'e-mails') + (n > 200 ? ' (o máximo é 200 por vez)' : '') : 'Um por linha ou separados por vírgula. Até 200 por vez.';
});
document.querySelectorAll('[data-dias]').forEach(b => b.addEventListener('click', () => { $('cDias').value = b.dataset.dias; }));
$('fConceder').addEventListener('submit', async ev => {
  ev.preventDefault();
  const emails = listaEmails(), prod = $('cProd').value, dias = Math.floor(Number($('cDias').value));
  const out = $('outConceder');
  if (!emails.length) { out.innerHTML = avisoErro('Informe ao menos um e-mail.'); return; }
  if (emails.length > 200) { out.innerHTML = avisoErro('No máximo 200 e-mails por vez.'); return; }
  if (!(dias >= 1 && dias <= 3660)) { out.innerHTML = avisoErro('Informe de 1 a 3660 dias.'); return; }
  const ok = await confirmar('Liberar acesso', `Liberar <b>${esc(nomeProd(prod))}</b> por <b>${plural(dias, 'dia', 'dias')}</b> para <b>${plural(emails.length, 'e-mail', 'e-mails')}</b>?`, 'Liberar');
  if (!ok) return;
  out.innerHTML = carregando('Liberando…');
  try {
    const r = await admin({ acao: 'conceder', emails, produto: prod, dias });
    const res = r.resultado || [];
    const erros = res.filter(x => x.erro).length;
    out.innerHTML = `<div class="aviso ${erros ? '' : 'info'}" style="margin-top:14px"><i class="ti ${erros ? 'ti-alert-triangle' : 'ti-check'}" aria-hidden="true"></i><div>${plural(res.length - erros, 'liberação feita', 'liberações feitas')}${erros ? ', ' + plural(erros, 'com erro', 'com erro') : ''}.</div></div>
      <div class="tblw"><table class="tbl resp"><thead><tr><th scope="col">E-mail</th><th scope="col">Resultado</th><th scope="col">Vale até</th></tr></thead><tbody>
      ${res.map(x => `<tr><td data-r="E-mail" class="em cheia">${esc(x.email)}</td><td data-r="Resultado">${x.erro ? `<span class="selo err">${esc(x.erro)}</span>` : (x.destino === 'conta' ? '<span class="selo ok">na conta</span>' : '<span class="selo av">pendente: entra no primeiro login</span>')}</td><td data-r="Vale até">${x.ate ? dataS(x.ate) : '—'}</td></tr>`).join('')}
      </tbody></table></div>`;
    E.carregou.assinantes = false; E.carregou.painel = false;
  } catch (e) { out.innerHTML = avisoErro(e); }
});
$('fRevogar').addEventListener('submit', async ev => {
  ev.preventDefault();
  const email = $('rEmail').value.trim(), prod = $('rProd').value, out = $('outRevogar');
  if (!email) return;
  const ok = await confirmar('Revogar acesso', `Tirar <b>${esc(nomeProd(prod))}</b> de <b>${esc(email)}</b>? O acesso sai na hora.`, 'Revogar', true);
  if (!ok) return;
  out.innerHTML = carregando('Revogando…');
  try {
    const r = await admin({ acao: 'revogar', email, produto: prod });
    const onde = [r.conta ? 'da conta' : '', r.pendente ? 'da compra pendente' : ''].filter(Boolean).join(' e ');
    out.innerHTML = `<div class="aviso info" style="margin-top:14px"><i class="ti ti-check" aria-hidden="true"></i><div>${onde ? 'Revogado ' + onde + '.' : 'Este e-mail não tinha esse produto. Nada mudou.'}</div></div>`;
    E.carregou.assinantes = false; E.carregou.painel = false;
  } catch (e) { out.innerHTML = avisoErro(e); }
});

/* ============================================================
   PAGAMENTOS
   ============================================================ */
function marcarChips(grupo, attr, valor) {
  $(grupo).querySelectorAll('[data-' + attr + ']').forEach(x => x.setAttribute('aria-pressed', String(x.dataset[attr] === valor)));
}
const SELO_TIPO = { venda: 'ok', reembolso: 'err', cancelamento: 'av', admin: 'ac', revisar: 'err', outro: '' };
async function carregarPedidos() {
  E.carregou.pedidos = true;
  marcarChips('pgTipos', 'tipo', E.pgTipo);
  $('pgLista').innerHTML = carregando('Carregando pedidos…');
  try {
    const r = await admin({ acao: 'pedidos', tipo: E.pgTipo, limite: 50 });
    $('pgAviso').innerHTML = '';
    if (!r.itens.length) { $('pgLista').innerHTML = '<p class="vazio">Nenhum pedido deste tipo ainda.</p>'; return; }
    const estimado = r.itens.some(x => x.estimado);
    $('pgLista').innerHTML = `<div class="tblw"><table class="tbl resp"><caption class="sr">Últimos ${r.itens.length} pedidos</caption><thead><tr>
        <th scope="col">Quando</th><th scope="col">Evento</th><th scope="col">Produto</th><th scope="col">E-mail</th><th scope="col" class="n">Valor</th><th scope="col">Meio</th></tr></thead><tbody>
      ${r.itens.map(x => `<tr>
        <td data-r="Quando" class="fraco">${quando(x.em)}</td>
        <td data-r="Evento"><span class="selo ${SELO_TIPO[x.tipo] || ''}">${esc(x.tipo === 'revisar' ? 'A revisar' : x.rotulo)}</span>${x.teste ? ' <span class="selo">teste</span>' : ''}${x.ok ? '' : ' <span class="selo av" title="O servidor ainda não terminou de aplicar este pedido; o Mercado Pago reenvia.">em processamento</span>'}</td>
        <td data-r="Produto">${esc(x.nome || '—')}${x.periodo ? ' <span class="fraco">(' + esc(/^\d+d$/.test(x.periodo) ? x.periodo.slice(0, -1) + ' dias' : x.periodo) + ')</span>' : ''}</td>
        <td data-r="E-mail" class="em">${esc(x.email || '—')}</td>
        <td data-r="Valor" class="n">${x.valor === null ? '—' : (x.estimado ? '<span title="Estimado pelo preço do catálogo">≈ </span>' : '') + brl(x.valor)}</td>
        <td data-r="Meio" class="fraco">${esc(GATEWAY[x.gateway] || x.gateway)}${x.metodo ? ' · ' + esc(METODO[x.metodo] || x.metodo) : ''}${x.pagamento ? `<br><span title="Número do pagamento no Mercado Pago">nº ${esc(x.pagamento)}</span>` : ''}${x.por ? `<br>por ${esc(x.por)}` : ''}</td>
      </tr>`).join('')}</tbody></table></div>
      ${estimado ? '<p class="leg">≈ valor estimado pelo preço do catálogo (pedido do Kiwify ou gravado antes de o servidor guardar o valor cobrado).</p>' : ''}`;
  } catch (e) {
    if (E.bloqueado) return;
    $('pgAviso').innerHTML = e.naoPublicado ? avisoPublicar('os pedidos') : avisoErro(e);
    $('pgLista').innerHTML = '';
  }
}
$('pgTipos').querySelectorAll('[data-tipo]').forEach(b => b.addEventListener('click', () => { E.pgTipo = b.dataset.tipo; carregarPedidos(); }));
async function compraTeste(periodo) {
  const out = $('outCompra');
  if (periodo === 'mensal') return compraTesteCartao(out);
  out.innerHTML = carregando('Abrindo o Mercado Pago…');
  try {
    const r = await chamar('mpCheckout', { produto: 'teste-mp', periodo });
    if (r && r.url) { out.innerHTML = carregando('Indo para o pagamento…'); location.href = r.url; }
    else out.innerHTML = avisoErro('O servidor não devolveu o link de pagamento.');
  } catch (e) { out.innerHTML = avisoErro(e); }
}
/* mensal de teste: o MESMO diálogo do cliente (formulário de cartão do Mercado Pago no site),
   com o produto teste-mp e o campo de e-mail do pagador visível (o e-mail da conta vendedora
   não pode pagar a si mesma). */
async function compraTesteCartao(out) {
  out.innerHTML = carregando('Abrindo o formulário do cartão…');
  try {
    const A = await modulo(), P = await planos();
    const prod = A.produtoPorId(P, 'teste-mp');
    const op = prod && A.opcoes(P, prod).find(o => o.periodo === 'mensal' && !o.modo);
    if (!op || !A.ehCartao || !A.ehCartao(op)) { out.innerHTML = avisoErro('O produto teste-mp não está à venda no mensal pelo Mercado Pago (planos.json).'); return; }
    const res = await A.assinarCartao({ op, user: MT.user, pedirEmail: true });
    if (!res || res.cancelado) { out.innerHTML = ''; return; }
    const ate = Number(((res.mt && res.mt.p) || {})['teste-mp'] || res.r.ate || 0);
    out.innerHTML = `<div class="aviso info" style="margin-top:14px"><i class="ti ti-check" aria-hidden="true"></i><div>Assinatura de teste autorizada (nº ${esc(res.r.preapproval)}).${ate ? ' Acesso de teste provisório até ' + dataS(ate) + '.' : ''} A 1ª cobrança de R$ 5 sai em até 1 hora; confira depois em Pedidos e no Mercado Pago. Para não ser cobrado de novo, use "Cancelar a assinatura de teste".</div></div>`;
  } catch (e) { out.innerHTML = avisoErro(e); }
}
$('btTesteMensal').onclick = () => compraTeste('mensal');
$('btTesteAnual').onclick = () => compraTeste('anual');
$('btTesteCancelar').onclick = async () => {
  const ok = await confirmar('Cancelar assinatura de teste', 'Cancelar a assinatura mensal de teste no Mercado Pago? O acesso de teste vale até o fim do período pago.', 'Cancelar assinatura', true);
  if (!ok) return;
  const out = $('outCompra'); out.innerHTML = carregando('Cancelando…');
  try {
    const r = await chamar('mpCancelar', { produto: 'teste-mp' });
    out.innerHTML = `<div class="aviso info" style="margin-top:14px"><i class="ti ti-check" aria-hidden="true"></i><div>${r.jaEstava ? 'A assinatura já estava cancelada.' : 'Assinatura cancelada.'}${r.valeAte ? ' O acesso de teste vale até ' + dataS(r.valeAte) + '.' : ''}</div></div>`;
  } catch (e) { out.innerHTML = avisoErro(e); }
};

/* ============================================================
   APLICATIVOS E PLANOS
   ============================================================ */
function appsDoProduto(P, prod) {
  const a = prod.apps;
  if (a === '*') return { txt: 'Todos os apps de todas as linhas', ids: Object.values(P.linhas || {}).flat() };
  if (a === 'tudo') return { txt: 'Todos os apps da linha ' + (prod.linha === 'provas' ? 'MedTech Provas' : 'MedTech App'), ids: (P.linhas || {})[prod.linha] || [] };
  if (typeof a === 'number') return { txt: a + (a === 1 ? ' app à escolha' : ' apps à escolha') + ' na linha', ids: (P.linhas || {})[prod.linha] || [] };
  if (Array.isArray(a)) return { txt: '', ids: a };
  return { txt: '', ids: [] };
}
const chipApp = id => {
  const a = APPS[id];
  if (!a) return `<span class="selo">${esc(id)}</span>`;
  return `<a href="${a.url}" target="_blank" rel="noopener" style="--c:${a.c}"><span class="bo" aria-hidden="true"><i class="ti ${a.ic}"></i></span>${esc(a.nm)}</a>`;
};
async function desenharPlanos() {
  E.carregou.planos = true;
  const P = await planos();
  const g = [];
  g.push(`<div><dt>Catálogo atualizado em</dt><dd>${esc(P.atualizado ? P.atualizado.split('-').reverse().join('/') : '—')}</dd></div>`);
  g.push(`<div><dt>Teste grátis</dt><dd>${P.teste_dias ? plural(P.teste_dias, 'dia', 'dias') : 'não oferecido'}</dd></div>`);
  g.push(`<div><dt>Carência depois do vencimento</dt><dd>${plural(P.carencia_dias || 0, 'dia', 'dias')}</dd></div>`);
  g.push(`<div><dt>Mensal avulso por Pix</dt><dd>${P.mp_pix_mensal ? 'oferecido' : 'desligado'}</dd></div>`);
  $('plGeral').innerHTML = `<div class="card"><h3><i class="ti ti-settings" aria-hidden="true"></i>Regras gerais</h3><dl class="ficha">${g.join('')}</dl></div>`;
  const prods = (P.produtos || []);
  if (!prods.length) { $('plProdutos').innerHTML = '<p class="vazio">Não consegui ler o planos.json agora.</p>'; }
  else $('plProdutos').innerHTML = prods.map(prod => {
    const ck = prod.checkout || {}, pr = prod.preco || {};
    const venda = per => { const v = String(ck[per] || '').trim(); return v === 'mp' ? 'Mercado Pago' : (v ? 'link externo' : ''); };
    let selo;
    if (prod.interno) selo = '<span class="selo ac">só liberação manual</span>';
    else if (prod.teste) selo = '<span class="selo">teste escondido</span>';
    else if (venda('mensal') || venda('anual')) selo = '<span class="selo ok">à venda</span>';
    else selo = '<span class="selo av">fora de venda</span>';
    const precos = ['mensal', 'anual'].filter(per => pr[per]).map(per => `<div><b>${brl(pr[per])}</b><span>${per === 'mensal' ? 'por mês' : 'por ano'} · ${venda(per) ? 'à venda (' + venda(per) + ')' : 'fora de venda'}</span></div>`).join('');
    const ap = appsDoProduto(P, prod);
    return `<div class="card prod"><div class="topo"><h3>${esc(prod.nome || prod.id)}</h3>${selo}</div>
      ${prod.resumo ? `<p class="sub">${esc(prod.resumo)}</p>` : ''}
      ${precos ? `<div class="precos">${precos}</div>` : ''}
      <div><p class="sub" style="margin-bottom:6px">${esc(ap.txt || 'Apps cobertos')}</p><div class="apps">${ap.ids.length ? ap.ids.map(chipApp).join('') : (prod.teste ? '<span class="selo">nenhum app</span>' : '—')}</div></div>
      <p class="fraco" style="font-size:12.5px;color:var(--tinta2)">id: ${esc(prod.id)}</p></div>`;
  }).join('');
  const at = [
    { nm: 'Portal MedTech App', ic: 'ti-layout-grid', c: '#5B5BF0', url: '/app.html' },
    { nm: 'Portal MedTech Provas', ic: 'ti-school', c: '#C2410C', url: '/provas.html' },
    { nm: 'Site (vitrine)', ic: 'ti-world', c: '#141827', url: '/' },
    ...Object.values(APPS),
    { nm: 'Mercado Pago', ic: 'ti-credit-card', c: '#0A6CB7', url: 'https://www.mercadopago.com.br/activities' },
    { nm: 'Console do Firebase', ic: 'ti-flame', c: '#B45309', url: 'https://console.firebase.google.com/project/medtech-c658c/overview' }
  ];
  $('plAtalhos').innerHTML = at.map(a => `<a href="${a.url}" target="_blank" rel="noopener" style="--c:${a.c}"><span class="bo" aria-hidden="true"><i class="ti ${a.ic}"></i></span>${esc(a.nm)}</a>`).join('');
}

/* ============================================================
   SINALIZAÇÕES
   ============================================================ */
const TIPO_SINAL = { gabarito: 'Gabarito errado', texto: 'Erro no texto', desatualizada: 'Desatualizada', comentario: 'Comentário', outro: 'Outro' };
async function carregarSinal() {
  E.carregou.sinal = true;
  const el = $('siLista'); el.innerHTML = carregando('Carregando as sinalizações abertas…');
  try {
    const r = await chamar('mtSinal', { op: 'listar', status: 'aberta' });
    const itens = (r.itens || []).filter(x => x.status === 'aberta').sort((a, b) => String(b.em || '').localeCompare(String(a.em || '')));
    if (!itens.length) { el.innerHTML = '<p class="vazio">Nenhuma sinalização aberta.</p>'; return; }
    const porApp = {}; itens.forEach(x => porApp[x.appNome || x.app] = (porApp[x.appNome || x.app] || 0) + 1);
    el.innerHTML = `<h3><i class="ti ti-flag" aria-hidden="true"></i>${plural(itens.length, 'aberta', 'abertas')}</h3>
      <p class="sub">${Object.entries(porApp).map(([k, n]) => esc(k) + ': ' + n).join(' · ')}</p>
      <div class="tblw"><table class="tbl resp"><thead><tr><th scope="col">Quando</th><th scope="col">App</th><th scope="col">Problema</th><th scope="col">Questão</th></tr></thead><tbody>
      ${itens.slice(0, 10).map(x => `<tr><td data-r="Quando" class="fraco">${quando(x.em)}</td><td data-r="App">${esc(x.appNome || x.app)}</td><td data-r="Problema">${esc(TIPO_SINAL[x.tipo] || x.tipo)}</td><td data-r="Questão" class="cheia">${esc(String(x.q || '').slice(0, 140))}${String(x.q || '').length > 140 ? '…' : ''}</td></tr>`).join('')}
      </tbody></table></div>${itens.length > 10 ? `<p class="leg">Mostrando as 10 mais recentes. A caixa completa tem as ${inteiro(itens.length)}.</p>` : ''}`;
  } catch (e) { el.innerHTML = avisoErro(e); }
}

/* ============================================================
   DIAGNÓSTICO
   ============================================================ */
$('btTeste').onclick = async () => {
  const out = $('outTeste'); out.innerHTML = carregando('Conferindo o servidor…');
  $('btTeste').disabled = true;
  try {
    const [t, pub] = await Promise.all([
      admin({ acao: 'teste' }),
      admin({ acao: 'pedidos', limite: 1 }).then(() => ({ ok: true })).catch(e => ({ ok: false, nao: !!e.naoPublicado, erro: e.message }))
    ]);
    const linha = (ok, rot, det) => `<tr><td data-r="Situação">${ok ? '<span class="selo ok">ok</span>' : '<span class="selo err">falhou</span>'}</td><th scope="row" data-r="Item" style="background:none;color:var(--tinta);font-size:14px">${esc(rot)}</th><td data-r="Detalhe" class="fraco cheia">${esc(det)}</td></tr>`;
    const pl = t.planos || {};
    const ORIG = { site: 'lido do site', memoria: 'última cópia em memória (o site não respondeu)', arquivo: 'cópia empacotada no servidor (o site não respondeu)', vazio: 'nenhum catálogo: nada é bloqueado' };
    out.innerHTML = `<div class="tblw"><table class="tbl resp"><thead><tr><th scope="col">Situação</th><th scope="col">Item</th><th scope="col">Detalhe</th></tr></thead><tbody>
      ${linha(pl.origem === 'site', 'Catálogo de planos', (ORIG[pl.origem] || pl.origem || '—') + ' · ' + plural(pl.produtos || 0, 'produto', 'produtos') + ' · venda ' + (pl.vendaAtiva ? 'aberta' : 'fechada'))}
      ${linha(t.identity && t.identity.ok, 'Contas (Firebase Auth)', t.identity && t.identity.ok ? 'lê as contas; sua conta ' + (t.identity.temMt ? 'tem' : 'não tem') + ' claims de acesso' : ((t.identity && t.identity.erro) || '—'))}
      ${linha(t.firestore && t.firestore.ok, 'Banco de dados (Firestore)', t.firestore && t.firestore.ok ? 'lê e responde' : ((t.firestore && t.firestore.erro) || '—'))}
      ${linha(pub.ok, 'Funções do painel (números, assinantes, pedidos)', pub.ok ? 'publicadas' : (pub.nao ? 'ainda não publicadas: rode deploy-backend.command' : pub.erro))}
      </tbody></table></div>
      <details class="tec"><summary>Dados técnicos</summary><pre>${esc(JSON.stringify(t, null, 2))}</pre></details>`;
  } catch (e) { out.innerHTML = E.bloqueado ? '' : avisoErro(e); }
  finally { $('btTeste').disabled = false; }
};

/* ============================================================
   DIAGNÓSTICO: IA (10/10/2026)
   mtAdmin geracaoIA → {atual, origem, em, por, modelos, geracoes}
           geracaoIA {definir:'2.5'|'3'} grava config/ia no servidor
   mtAdmin testeIA {geracao} → {ok, totalMs, niveis:[{nivel, modelo, ok, testes:[...]}]}
   ============================================================ */
const NIVEL_NM = { rapido: 'Rápido', padrao: 'Padrão', forte: 'Forte' };
const NIVEL_USO = { rapido: 'consultas curtas e o padrão das chamadas sem nível', padrao: 'imagem, áudio, documento e respostas elaboradas', forte: 'revisão da prescrição e laudos' };
const ORIGEM_IA = { firestore: 'escolhida no painel', ambiente: 'variável do servidor', padrao: 'padrão do servidor' };
const PENSAR_NM = { LOW: 'baixo', MEDIUM: 'médio', HIGH: 'alto', MINIMAL: 'mínimo' };
function nomeTeste(t) {
  const m = /^raciocínio (\w+)$/.exec(t || '');
  if (m) return 'Raciocínio ' + (PENSAR_NM[m[1]] || m[1]) + ' (' + m[1] + ')';
  return ({ texto: 'Texto simples', json: 'JSON com esquema', busca: 'Busca do Google', imagem: 'Imagem (PNG 8×8)' })[t] || t;
}
const segs = ms => (Number(ms || 0) / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' s';
function diasAte(iso) { return Math.ceil((new Date(iso + 'T23:59:59-03:00').getTime() - Date.now()) / 86400000); }
E.ia = null; E.iaTeste = {};

function iaOcupado(sim) { ['btIaTeste3', 'btIaTesteAtual', 'btIaUsar3', 'btIaVoltar', 'btIaAtualizar'].forEach(id => $(id).disabled = sim); }
async function carregarIA() {
  E.carregou.ia = true;
  const d = diasAte('2026-10-20');
  $('iaFaltam').textContent = d > 1 ? 'Faltam ' + d + ' dias.' : d === 1 ? 'Falta 1 dia.' : d === 0 ? 'É hoje.' : 'O prazo já passou.';
  $('iaPrazo').className = 'aviso' + (d <= 3 ? ' err' : '');
  $('iaEstado').innerHTML = carregando('Lendo a geração em uso…');
  iaOcupado(true);
  try {
    E.ia = await admin({ acao: 'geracaoIA' });
    desenharIA();
  } catch (e) {
    if (E.bloqueado) return;
    E.ia = null;
    $('iaAcoes').hidden = true;
    $('iaEstado').innerHTML = ehNaoPublicado(e)
      ? `<div class="aviso"><i class="ti ti-cloud-upload" aria-hidden="true"></i><div><b>Publique o servidor para testar e trocar a geração da IA.</b> As ações novas já estão prontas, mas ainda não foram publicadas. No Mac, rode <code>deploy-backend.command</code> (pasta MedTech/backend) e depois clique em Atualizar. Até lá, a IA segue no Gemini 2.5.</div></div>`
      : avisoErro(e);
  } finally { iaOcupado(false); }
}
function desenharIA() {
  const s = E.ia || {};
  const g3 = (s.geracoes || {})['3'] || {}, g25 = (s.geracoes || {})['2.5'] || {};
  const outra = s.atual === '3' ? g25 : g3, outraNm = s.atual === '3' ? 'Geração 2.5' : 'Geração 3';
  const quem = s.origem === 'firestore' && s.em ? ' · trocada em ' + quando(s.em) + (s.por ? ' por ' + s.por : '') : '';
  $('iaEstado').innerHTML = `
    <div class="ia-ger"><span>Geração em uso</span><b>${esc(s.atual || '—')}</b><span class="selo ${s.atual === '3' ? 'ok' : 'av'}">${esc(ORIGEM_IA[s.origem] || s.origem || '—')}</span><span>${esc(quem)}</span></div>
    <div class="tblw"><table class="tbl resp"><caption class="sr">Modelos por nível</caption><thead><tr><th scope="col">Nível</th><th scope="col">Modelo em uso</th><th scope="col">${esc(outraNm)}</th><th scope="col">Usado em</th></tr></thead><tbody>
    ${['rapido', 'padrao', 'forte'].map(n => `<tr><th scope="row" data-r="Nível" style="background:none;color:var(--tinta);font-size:14px">${NIVEL_NM[n]}</th>
      <td data-r="Modelo em uso"><code>${esc((s.modelos || {})[n] || '—')}</code></td><td data-r="${esc(outraNm)}"><code>${esc(outra[n] || '—')}</code></td>
      <td data-r="Usado em" class="fraco">${esc(NIVEL_USO[n])}</td></tr>`).join('')}
    </tbody></table></div>`;
  $('iaAcoes').hidden = false;
  $('btIaUsar3').hidden = s.atual === '3';
  $('btIaVoltar').hidden = s.atual !== '3';
  $('btIaTesteAtual').innerHTML = `<i class="ti ti-player-play" aria-hidden="true"></i>Testar geração atual (${esc(s.atual || '?')})`;
  $('btIaTeste3').hidden = s.atual === '3';
}
function desenharTesteIA(r) {
  const niveis = r.niveis || [];
  const testes = niveis.reduce((a, n) => a.concat(n.testes || []), []);
  const falhas = testes.filter(t => !t.ok).length;
  const linha = t => {
    const tk = t.tokens ? `${inteiro(t.tokens.entrada)} → ${inteiro(t.tokens.saida)}${t.tokens.pensamento ? ' + ' + inteiro(t.tokens.pensamento) + ' pens.' : ''}` : '—';
    const txt = t.ok ? (t.amostra || '(sem texto)') : (t.erro || 'falhou') + (t.amostra ? ' · ' + t.amostra : '');
    return `<tr><th scope="row" data-r="Teste" style="background:none;color:var(--tinta);font-size:14px">${esc(nomeTeste(t.teste))}</th>
      <td data-r="Situação">${t.ok ? '<span class="selo ok">ok</span>' : '<span class="selo err">erro</span>'}</td>
      <td data-r="Tempo" class="n">${segs(t.ms)}</td><td data-r="Tokens" class="n fraco">${tk}</td>
      <td data-r="${t.ok ? 'Resposta' : 'Erro'}" class="amostra cheia${t.ok ? '' : ' err'}">${esc(txt)}</td></tr>`;
  };
  return `<div class="ia-resumo">${r.ok ? '<span class="selo ok"><i class="ti ti-check" aria-hidden="true"></i>tudo ok</span>' : `<span class="selo err">${plural(falhas, 'falha', 'falhas')}</span>`}
      <span>Geração <b>${esc(r.geracao)}</b> · ${plural(testes.length, 'chamada', 'chamadas')} em ${segs(r.totalMs)} · ${esc(quando(r.em))} · não conta na cota</span></div>
    ${niveis.map(n => `<div class="ia-nivel"><h4>${n.ok ? '<span class="selo ok">ok</span>' : '<span class="selo err">com erro</span>'}${NIVEL_NM[n.nivel] || esc(n.nivel)} <code>${esc(n.modelo)}</code></h4>
      <div class="tblw"><table class="tbl resp"><caption class="sr">Testes do nível ${esc(NIVEL_NM[n.nivel] || n.nivel)}, modelo ${esc(n.modelo)}</caption><thead><tr><th scope="col">Teste</th><th scope="col">Situação</th><th scope="col" class="n">Tempo</th><th scope="col" class="n">Tokens</th><th scope="col">Resposta (início)</th></tr></thead>
      <tbody>${(n.testes || []).map(linha).join('')}</tbody></table></div></div>`).join('')}
    <details class="tec"><summary>Dados técnicos</summary><pre>${esc(JSON.stringify(r, null, 2))}</pre></details>`;
}
async function testarIA(geracao) {
  const out = $('iaTeste');
  out.innerHTML = carregando('Testando a geração ' + geracao + ' na Vertex (até 1 minuto)…');
  iaOcupado(true);
  try {
    const r = await admin({ acao: 'testeIA', geracao });
    E.iaTeste[geracao] = r;
    out.innerHTML = desenharTesteIA(r);
    toast(r.ok ? 'Geração ' + geracao + ': tudo ok.' : 'Geração ' + geracao + ': há falhas, veja a tabela.', r.ok ? 'ok' : 'err');
  } catch (e) {
    out.innerHTML = E.bloqueado ? '' : (ehNaoPublicado(e) ? `<div class="aviso"><i class="ti ti-cloud-upload" aria-hidden="true"></i><div><b>Publique o servidor</b> (<code>deploy-backend.command</code>) para testar a IA.</div></div>` : avisoErro(e));
  } finally { iaOcupado(false); }
}
async function definirIA(g) {
  const t = E.iaTeste['3'];
  let texto;
  if (g === '3') {
    texto = t && t.ok ? 'O último teste da geração 3 passou em todos os níveis. Todos os apps passam a usar os modelos 3.x em até 1 minuto. Dá para voltar quando quiser.'
      : t ? '<b>O último teste da geração 3 teve falhas.</b> Trocar agora pode quebrar a IA de algum app. Tem certeza?'
        : '<b>A geração 3 ainda não foi testada nesta sessão.</b> O recomendado é clicar em "Testar geração 3" antes. Trocar mesmo assim?';
  } else {
    texto = 'Todos os apps voltam para o Gemini 2.5 em até 1 minuto. Lembre: o 2.5 sai do ar em 20/10/2026.';
  }
  const ok = await confirmar(g === '3' ? 'Usar a geração 3?' : 'Voltar para a 2.5?', texto, g === '3' ? 'Usar geração 3' : 'Voltar para a 2.5', g !== '3' || !(t && t.ok));
  if (!ok) return;
  iaOcupado(true);
  try {
    E.ia = await admin({ acao: 'geracaoIA', definir: g });
    desenharIA();
    toast('IA na geração ' + E.ia.atual + '. Vale para todos em até 1 minuto.', 'ok');
  } catch (e) {
    if (!E.bloqueado) toast('Não troquei: ' + ((e && e.message) || e), 'err');
  } finally { iaOcupado(false); }
}
$('btIaAtualizar').onclick = () => carregarIA();
$('btIaTeste3').onclick = () => testarIA('3');
$('btIaTesteAtual').onclick = () => testarIA((E.ia && E.ia.atual) || '2.5');
$('btIaUsar3').onclick = () => definirIA('3');
$('btIaVoltar').onclick = () => definirIA('2.5');

/* ============================================================
   INÍCIO
   ============================================================ */
async function iniciar() {
  if (E.iniciado) return;
  E.iniciado = true;
  $('quem').textContent = MT.user.email || MT.user.uid;
  const P = await planos();
  const ops = (P.produtos || []).map(p => `<option value="${esc(p.id)}">${esc(p.nome || p.id)}${p.interno ? ' (interno)' : ''}${p.teste ? ' (teste)' : ''}</option>`).join('');
  $('cProd').innerHTML = ops; $('rProd').innerHTML = ops; $('cProd').value = 'cortesia';
  $('asProd').innerHTML = '<option value="">Todos</option>' + ops;
  const sec = location.hash.slice(1);
  irPara(SECOES.includes(sec) ? sec : 'visao');
  if (sec && sec !== 'visao' && !E.carregou.painel) carregarPainel();   // contagem das sinalizações no menu
}
$('btSair').onclick = () => { if (window.MT && MT.signOut) MT.signOut(); };
$('btTrocar').onclick = () => { if (window.MT && MT.signOut) MT.signOut(); };
(function espera() {
  if (!window.MT || !MT.ready) return setTimeout(espera, 60);
  MT.ready.then(() => {
    MT.onData(() => { if (MT.user && !MT.user.demo) iniciar(); });
    if (MT.user && MT.user.demo) $('quem').textContent = 'Modo demonstração: sem servidor';
  });
})();
})();
