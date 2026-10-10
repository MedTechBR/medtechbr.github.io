/* ============================================================
   admin.js — Administração MedTech (10/10/2026, abertura das vendas)
   Tudo passa pelo servidor (o navegador não decide nada de acesso):
     mtAdmin  {acao:'painel'|'assinantes'|'pedidos'|'usuarios'|'usuario'|'editarUsuario'|'resetSenha'|'papel'|'ver'|'conceder'|'revogar'|'vincularCpf'|'teste'|'geracaoIA'|'testeIA'}
              (10/10/2026: seção Usuários = todas as contas, ficha com dados, liberações, permissões,
               acesso à conta e histórico; o servidor nunca devolve o CPF inteiro nem segredo da conta)
              (10/10/2026: ver/revogar por e-mail ou CPF; conceder com lista mista e ilimitado;
               o servidor só devolve o CPF mascarado, 039.***.***-08)
     mpCheckout / mpCancelar (compra de teste R$ 5)
     mtSinal  {op:'listar'} | {op:'marcar', id, status, resposta}  (Sinalizações: questão completa lida do
              banco público de cada app, análise pela IA (MT.ai, nível forte, sem busca) e pedido de correção)
              {op:'errata'|'listarErratas'|'responder'} (10/10/2026: corrigir, tirar do ar e desfazer pelo painel;
              resposta a quem sinalizou, entregue no app pelo mterrata.js ou por e-mail)
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
/* acesso ilimitado = vale até 01/01/2100; tudo a partir de 2099 aparece como "ilimitado" */
const ILIMITADO = 4102444800;
const ehIlim = s => Number(s) >= ILIMITADO - 366 * 86400;
const dataS = s => s ? (ehIlim(s) ? 'ilimitado' : new Date(s * 1000).toLocaleDateString('pt-BR')) : '—';
const soDig = s => String(s == null ? '' : s).replace(/\D/g, '');
const fmtCpf = s => { const c = soDig(s).slice(0, 11); return c.length > 9 ? c.slice(0, 3) + '.' + c.slice(3, 6) + '.' + c.slice(6, 9) + '-' + c.slice(9) : c.length > 6 ? c.slice(0, 3) + '.' + c.slice(3, 6) + '.' + c.slice(6) : c.length > 3 ? c.slice(0, 3) + '.' + c.slice(3) : c; };
const quando = iso => iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
const ddmm = d => d ? d.slice(8, 10) + '/' + d.slice(5, 7) : '';
const plural = (n, um, varios) => inteiro(n) + ' ' + (Number(n) === 1 ? um : varios);
const agoraS = () => Math.floor(Date.now() / 1000);

const SECOES = ['visao', 'usuarios', 'assinantes', 'acessos', 'pagamentos', 'planos', 'sinalizacoes', 'diagnostico'];
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
  trafegotitulo: { nm: 'TráfegoTítulo', ic: 'ti-car', c: '#23272E', url: '/trafego-titulo/' },
  /* farmácia (linha provas, publico "farmacia" no planos.json) */
  farmauti: { nm: 'FarmaUTI', ic: 'ti-pill', c: '#4545D8', url: '/farmauti/' },
  enarefarmacia: { nm: 'Banca ENARE Farmácia', ic: 'ti-vaccine-bottle', c: '#0A3F3B', url: '/quiz-enare-farmacia/' },
  sosfarmacia: { nm: 'SOS Farmácia Comercial', ic: 'ti-first-aid-kit', c: '#C8373C', url: '/sos-farmacia/' }
};
const ROTULO = {
  mp_approved: 'Pagamento aprovado', mp_refunded: 'Reembolso', mp_charged_back: 'Contestação no cartão',
  order_approved: 'Compra aprovada (Kiwify)', subscription_renewed: 'Renovação (Kiwify)', order_refunded: 'Reembolso (Kiwify)',
  chargeback: 'Contestação (Kiwify)', mp_assinatura_cancelada: 'Assinatura cancelada', mp_cancelada_pelo_usuario: 'Cancelada pelo assinante',
  subscription_canceled: 'Assinatura cancelada (Kiwify)', subscription_cancelled: 'Assinatura cancelada (Kiwify)',
  subscription_late: 'Pagamento atrasado (Kiwify)', admin_conceder: 'Liberação manual', admin_revogar: 'Revogação manual',
  admin_vincular_cpf: 'CPF vinculado pela administração', cpf_pendente_aplicado: 'Liberação por CPF aplicada no cadastro'
};
const METODO = { pix: 'Pix', credit_card: 'cartão de crédito', debit_card: 'cartão de débito', ticket: 'boleto', account_money: 'saldo Mercado Pago', bank_transfer: 'transferência' };
const GATEWAY = { mp: 'Mercado Pago', kiwify: 'Kiwify', admin: 'manual' };
const ORIGEM = { compra: 'Compra', admin: 'Liberação manual', cortesia: 'Cortesia', teste: 'Compra de teste', 'sem registro': 'Sem registro', 'sem dado': 'Sem dado' };

const E = { planos: null, painel: null, naoPublicado: false, bloqueado: false, carregou: {}, medida: 'receita',
  as: { pagina: 1 }, pgTipo: 'todos', iniciado: false };

/* ---------------- servidor ---------------- */
async function modulo() {
  if (window.MT && MT.acessoModulo) { const m = await MT.acessoModulo(); if (m) return m; }
  if (!window.MTAcesso) await import('/_mtacesso.js?v=13');
  return window.MTAcesso;
}
async function chamar(nome, dados) { const A = await modulo(); return A.chamar(nome, dados || {}, MT.user); }
const ehNaoPublicado = e => /Ação desconhecida/i.test((e && e.message) || '') || (e && (e.status === 404 || e.status === 'NOT_FOUND'));
const ehNegado = e => (e && e.status === 'PERMISSION_DENIED') || /administração do MedTech/i.test((e && e.message) || '');
async function admin(dados) {
  try { return await chamar('mtAdmin', dados); }
  catch (e) {
    if (ehNegado(e)) bloquear(e.message);
    if (ehNaoPublicado(e) && ['painel', 'assinantes', 'pedidos', 'usuarios', 'usuario'].includes(dados.acao)) { E.naoPublicado = true; e.naoPublicado = true; }
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
function irPara(destino, focar) {
  /* #usuarios/<uid> abre a ficha da conta (o voltar do navegador volta para a lista) */
  let [sec, sub] = String(destino || '').split('/');
  if (!SECOES.includes(sec)) { sec = 'visao'; sub = ''; }
  let uid = '';
  try { uid = decodeURIComponent(sub || ''); } catch (e) { uid = ''; }
  E.sub = sec === 'usuarios' ? uid : '';
  if (!E.bloqueado) document.querySelectorAll('[data-painel]').forEach(el => el.hidden = el.id !== sec);
  document.querySelectorAll('.menu a').forEach(a => {
    if (a.dataset.sec === sec) { a.setAttribute('aria-current', 'page'); if (a.scrollIntoView && window.innerWidth <= 960) a.scrollIntoView({ block: 'nearest', inline: 'center' }); }
    else a.removeAttribute('aria-current');
  });
  window.scrollTo(0, 0);
  setTimeout(() => window.scrollTo(0, 0), 0);   /* o navegador ainda rola até a âncora depois de mostrar a seção */
  if (focar && !E.sub) { const h = document.querySelector('#' + sec + ' h2'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } }
  if (E.iniciado && !E.bloqueado) abrirSecao(sec);
}
window.addEventListener('hashchange', () => irPara(location.hash.slice(1), true));
function abrirSecao(sec) {
  if (sec === 'visao') { if (!E.carregou.painel) carregarPainel(); else if (E.painel) desenharPainel(); }
  if (sec === 'usuarios') abrirUsuarios(E.sub);
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
function kpi(rot, icone, valor, det, href, dica) {
  const corpo = `<span class="rot"><i class="ti ${icone}" aria-hidden="true"></i>${rot}</span><span class="v">${valor}</span><span class="det">${det || '&nbsp;'}</span>`;
  /* cartão que leva a uma lista: um link de verdade, com o destino dito no fim */
  if (href) return `<a class="kpi kpi-link" href="${href}">${corpo}<span class="ir">${esc(dica || 'Abrir')}<i class="ti ti-arrow-right" aria-hidden="true"></i></span></a>`;
  return `<div class="kpi">${corpo}</div>`;
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
    c ? 'hoje ' + inteiro(c.contas.hoje) + ' · 30 dias ' + inteiro(c.contas.d30) + ' · total ' + inteiro(c.contas.total) + (c.contas.comCpf != null ? ' · com CPF ' + inteiro(c.contas.comCpf) : '') : '',
    '#usuarios', 'Ver todas as contas'));
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
  if (ehIlim(ate)) return '<span class="selo ok">sem fim</span>';
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
    $('asLista').innerHTML = `<p class="vazio">${r.buscaCpf ? 'Nenhum acesso na conta deste CPF (ou o CPF não está cadastrado). Consulte o CPF em Acessos.' : r.busca || r.produto ? 'Ninguém com esses filtros.' : (r.situacao === 'vencidos' ? 'Nenhum acesso vencido nos últimos 60 dias.' : 'Ainda não há assinantes.')}</p>`;
    return;
  }
  const linhas = r.itens.map((x, i) => `<tr>
      <td data-r="E-mail" class="em cheia">${esc(x.email || '(sem e-mail)')}</td>
      <td data-r="Produto">${esc(x.nome || x.produto)}</td>
      <td data-r="Válido até"><span>${ehIlim(x.ate) ? '<b>ilimitado</b>' : dataS(x.ate) + ' ' + faltam(x.ate)}</span></td>
      <td data-r="CPF" class="fraco">${x.cpf === true ? 'sim' : x.cpf === false ? '<span class="selo av">não</span>' : '—'}</td>
      <td data-r="Período" class="fraco">${esc(x.periodo || '—')}</td>
      <td data-r="Origem" class="fraco">${esc(origemTxt(x))}</td>
      <td class="acoes"><div class="acoesL">
        <button class="btn btn-g sm" type="button" data-ac="ver" data-i="${i}" title="Detalhes" aria-label="Detalhes de ${esc(x.email)}"><i class="ti ti-eye" aria-hidden="true"></i><span class="tx">Detalhes</span></button>
        <button class="btn btn-g sm" type="button" data-ac="dias" data-i="${i}" title="Liberar mais dias" aria-label="Liberar mais dias de ${esc(x.nome)} para ${esc(x.email)}"><i class="ti ti-calendar-plus" aria-hidden="true"></i><span class="tx">Mais dias</span></button>
        <button class="btn btn-dn sm" type="button" data-ac="rev" data-i="${i}" title="Revogar" aria-label="Revogar ${esc(x.nome)} de ${esc(x.email)}"><i class="ti ti-ban" aria-hidden="true"></i><span class="tx">Revogar</span></button>
      </div></td></tr>`).join('');
  $('asLista').innerHTML = (avisos.length ? `<div class="aviso" style="margin-top:12px"><i class="ti ti-info-circle" aria-hidden="true"></i><div>${avisos.map(esc).join(' ')}</div></div>` : '') +
    `<div class="tblw"><table class="tbl resp"><caption class="sr">Assinantes, página ${r.pagina} de ${r.paginas}</caption><thead><tr>
      <th scope="col">E-mail</th><th scope="col">Produto</th><th scope="col">Válido até</th><th scope="col">CPF cadastrado</th><th scope="col">Período</th><th scope="col">Origem</th><th scope="col"><span class="sr">Ações</span></th>
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
  admin({ acao: 'ver', alvo: email }).then(r => { $('dlgCorpo').innerHTML = fichaConta(r); })
    .catch(e => { $('dlgCorpo').innerHTML = avisoErro(e); });
}
function maisDias(x) {
  dialogo('Liberar mais dias', `<p>${esc(x.nome)} para <b>${esc(x.email)}</b>. Hoje vale ${ehIlim(x.ate) ? 'sem data de fim (ilimitado)' : 'até ' + dataS(x.ate)}.</p>
    <div class="campo" style="margin-top:12px"><label for="dlgDias">Dias a acrescentar</label><input id="dlgDias" type="number" min="1" max="3660" value="30" inputmode="numeric"></div>
    <label class="marca-l" style="margin-top:6px"><input type="checkbox" id="dlgIlim"> Tornar ilimitado</label>
    <div class="chips" style="margin-top:10px" role="group" aria-label="Atalhos de dias"><button class="chip" type="button" data-d="7">7</button><button class="chip" type="button" data-d="30">30</button><button class="chip" type="button" data-d="90">90</button><button class="chip" type="button" data-d="365">365</button></div>
    <p class="sub" style="margin-top:10px">Os dias somam a partir do fim do acesso atual. Não gera cobrança.</p>`,
  [{ rot: 'Cancelar', cls: 'btn-g' }, { rot: 'Liberar', cls: 'btn-p', acao: async () => {
    const dias = Math.floor(Number($('dlgDias').value)), ilimitado = $('dlgIlim').checked;
    if (!ilimitado && !(dias >= 1 && dias <= 3660)) { toast('Informe de 1 a 3660 dias.', 'erro'); return false; }
    try {
      const r = await admin(Object.assign({ acao: 'conceder', alvos: [x.email], produto: x.produto }, ilimitado ? { ilimitado: true } : { dias }));
      const res = (r.resultado || [])[0] || {};
      if (res.erro) { toast('Não liberou: ' + res.erro, 'erro'); return false; }
      toast(ehIlim(res.ate) ? 'Liberado sem data de fim.' : 'Liberado até ' + dataS(res.ate) + '.', 'ok');
      carregarAssinantes();
    } catch (e) { toast('Não liberou: ' + (e.message || e), 'erro'); return false; }
  } }]);
  $('dlgCorpo').querySelectorAll('[data-d]').forEach(b => b.onclick = () => { $('dlgDias').value = b.dataset.d; $('dlgIlim').checked = false; $('dlgDias').disabled = false; });
  $('dlgIlim').onchange = () => { $('dlgDias').disabled = $('dlgIlim').checked; };
}
async function revogarLinha(x) {
  const ok = await confirmar('Revogar acesso', `Tirar <b>${esc(x.nome)}</b> de <b>${esc(x.email)}</b>? O acesso sai na hora. Cobrança mensal no Mercado Pago não é cancelada por aqui.`, 'Revogar', true);
  if (!ok) return;
  try {
    await admin({ acao: 'revogar', alvo: x.email, produto: x.produto });
    toast('Acesso revogado.', 'ok');
    carregarAssinantes();
  } catch (e) { toast('Não revogou: ' + (e.message || e), 'erro'); }
}
let tBusca = 0;
$('asBusca').addEventListener('input', () => { clearTimeout(tBusca); tBusca = setTimeout(() => { E.as.pagina = 1; carregarAssinantes(); }, 400); });
['asProd', 'asSit', 'asOrdem'].forEach(id => $(id).addEventListener('change', () => { E.as.pagina = 1; carregarAssinantes(); }));

/* ============================================================
   USUÁRIOS (10/10/2026): todas as contas e a ficha de cada uma
   mtAdmin usuarios {filtro, ordem, busca, pagina, porPagina} → {total, contagens, itens, eu}
           usuario {uid} → ficha (mesmos campos do "ver" + pedidos, sinalizações, log, pode)
           editarUsuario {uid, nome?, email?, desativar?} · resetSenha {uid} · papel {uid, papel, ativo}
           previaExclusao {uid} → {apaga, fica, bloqueios} · excluirConta {uid, email, confirmar:"EXCLUIR"} → {concluido}
           (exclusão só pela ficha, aba Acesso à conta; a lista não tem botão de excluir)
   CPF: vincularCpf (Acessos). Liberações: o mesmo editor da seção Acessos (prefixo ulib).
   Tudo que vem do servidor passa por esc() antes de ir para o HTML.
   ============================================================ */
E.us = { filtro: 'todos', ordem: 'recentes', pagina: 1, r: null, ficha: null, aba: 'dados', abrindo: '', digitou: false };
const FILTRO_US = { todos: 'Todas', semCpf: 'Sem CPF', comPlano: 'Com plano', semPlano: 'Sem plano', novos7: 'Novas em 7 dias', desativadas: 'Desativadas' };
const PROVEDOR = { password: 'e-mail e senha', 'google.com': 'Google', 'apple.com': 'Apple', phone: 'telefone', 'microsoft.com': 'Microsoft' };
const ABAS_US = [['dados', 'Dados', 'ti-id'], ['liberacoes', 'Liberações', 'ti-checklist'], ['permissoes', 'Permissões', 'ti-shield-check'], ['acesso', 'Acesso à conta', 'ti-key'], ['historico', 'Histórico', 'ti-history']];
const ACAO_LOG = { editarUsuario: 'Cadastro editado', resetSenha: 'Link de nova senha enviado', papel: 'Permissão alterada', excluirConta: 'Exclusão da conta' };
const dataC = iso => iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';
function relativo(iso) {
  if (!iso) return 'nunca';
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
  if (d <= 0) return 'hoje';
  if (d === 1) return 'ontem';
  if (d < 30) return 'há ' + d + ' dias';
  return dataC(iso);
}
const nomeOuEmail = x => x.nome || x.email || '(conta sem nome e sem e-mail)';
function selosConta(x, longo) {
  const s = [];
  if (x.dono) s.push('<span class="selo ac">dono</span>');
  else if (x.admin) s.push('<span class="selo ac">administrador</span>');
  if (x.coordenador) s.push(x.coordenadorAtivo ? '<span class="selo ac">coordenador ClínicaMed</span>' : '<span class="selo av" title="Vale quando a pessoa confirmar o e-mail">coordenador (falta confirmar e-mail)</span>');
  if (x.desativada) s.push('<span class="selo err">desativada</span>');
  if (x.email && !x.emailVerificado) s.push('<span class="selo av">e-mail não confirmado</span>');
  if (x.teste) s.push(`<span class="selo">teste grátis até ${dataS(x.teste)}</span>`);
  if (x.claimsIlegiveis) s.push('<span class="selo err">claims ilegíveis</span>');
  if (longo && !s.length) s.push('<span class="selo">conta comum</span>');
  return s.join(' ');
}
const produtosTxt = x => (x.produtos || []).filter(p => !p.teste).length
  ? (x.produtos || []).filter(p => !p.teste).map(p => `<span class="us-prod"><b>${esc(nomeProd(p.id) || p.nome)}</b> <span class="fraco">${p.ilimitado ? 'ilimitado' : 'até ' + dataS(p.ate)}</span></span>`).join('')
  : '<span class="fraco">nenhum</span>';

function abrirUsuarios(uid) {
  if (uid) { mostrarFicha(uid); return; }
  $('usFicha').hidden = true; $('usLista').hidden = false;
  /* de volta da ficha: o foco volta para a linha da pessoa */
  const volta = () => {
    if (!E.us.voltaFoco) return;
    const b = $('usTabela').querySelector('button.us-nome[data-uid="' + CSS.escape(E.us.voltaFoco) + '"]');
    E.us.voltaFoco = '';
    if (b) setTimeout(() => b.focus(), 0);
  };
  if (!E.carregou.usuarios) carregarUsuarios().then(volta); else volta();
}
async function carregarUsuarios() {
  E.carregou.usuarios = true;
  $('btUs').disabled = true;
  $('usQuando').textContent = 'Atualizando…';
  if (!E.us.r) $('usTabela').innerHTML = carregando('Carregando as contas…');
  const busca = buscaUs();
  try {
    const [r] = await Promise.all([admin({ acao: 'usuarios', filtro: E.us.filtro, ordem: $('usOrdem').value, busca, pagina: E.us.pagina, porPagina: 50 }), planos()]);
    E.us.r = r; E.us.pagina = r.pagina;
    $('usAviso').innerHTML = '';
    desenharUsuarios(r);
    /* de volta de uma exclusão: o aviso fica no topo da lista e recebe o foco */
    if (E.us.aviso) {
      $('usAviso').innerHTML = `<div class="aviso ok" role="status" tabindex="-1" id="usAvisoEx"><i class="ti ti-circle-check" aria-hidden="true"></i><div><b>Conta excluída.</b> ${esc(E.us.aviso)}</div></div>`;
      E.us.aviso = '';
      setTimeout(() => { const a = $('usAvisoEx'); if (a) a.focus(); }, 0);
    }
    $('usQuando').textContent = 'Atualizado às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    if (E.bloqueado) return;
    $('usQuando').textContent = '';
    $('usAviso').innerHTML = e.naoPublicado ? avisoPublicar('a lista de usuários') : avisoErro(e);
    $('usTabela').innerHTML = e.naoPublicado ? '<p class="vazio">Enquanto isso, consulte uma conta pelo e-mail em Acessos.</p>' : '';
  } finally { $('btUs').disabled = false; }
}
/* o Chrome põe o e-mail do login em campo de busca: ignora se ninguém digitou (honeypot no topo da página) */
function buscaUs() {
  const v = $('usBusca').value.trim();
  if (!E.us.digitou && MT.user && v && v.toLowerCase() === String(MT.user.email || '').toLowerCase()) { $('usBusca').value = ''; return ''; }
  return v;
}
function desenharUsuarios(r) {
  const n = r.contagens || {};
  $('usFiltros').querySelectorAll('[data-usf]').forEach(b => {
    b.setAttribute('aria-pressed', String(b.dataset.usf === r.filtro));
    const k = b.querySelector('.n'); k.textContent = n[b.dataset.usf] != null ? inteiro(n[b.dataset.usf]) : '';
  });
  const filtroTxt = r.filtro !== 'todos' ? ' · filtro: ' + FILTRO_US[r.filtro].toLowerCase() : '';
  $('usResumo').textContent = plural(r.total, 'conta', 'contas') + (r.busca ? ' para "' + r.busca + '"' : '') + filtroTxt +
    (r.total !== n.todos ? ' (de ' + inteiro(n.todos) + ' no total)' : '');
  const avisos = [];
  if (r.truncado) avisos.push('Há mais de 20 mil contas: a lista considera só as primeiras 20 mil.');
  if (r.cpfsOk === false) avisos.push('Os CPFs não puderam ser lidos agora; o selo "sem CPF" pode estar errado.');
  if (!r.itens.length) {
    $('usTabela').innerHTML = `<p class="vazio">${r.buscaCpf ? 'Nenhuma conta com este CPF.' : r.busca ? 'Nenhuma conta encontrada com essa busca.' : 'Nenhuma conta neste filtro.'}</p>`;
    return;
  }
  const linhas = r.itens.map(x => `<tr${x.desativada ? ' class="us-off"' : ''}>
      <td data-r="Pessoa" class="cheia us-pessoa"><button type="button" class="us-nome" data-uid="${esc(x.uid)}" aria-label="Abrir a ficha de ${esc(nomeOuEmail(x))}">${esc(nomeOuEmail(x))}</button>
        ${x.nome && x.email ? `<span class="us-email">${esc(x.email)}</span>` : ''}</td>
      <td data-r="CPF">${x.cpf ? `<span class="us-cpf">${esc(x.cpf)}</span>` : (x.temCpf ? '<span class="fraco">cadastrado</span>' : '<span class="selo av">sem CPF</span>')}</td>
      <td data-r="Criada em" class="fraco">${dataC(x.criadoEm)}</td>
      <td data-r="Último acesso" class="fraco" title="${esc(x.ultimoAcesso ? quando(x.ultimoAcesso) : 'nunca entrou')}">${relativo(x.ultimoAcesso)}</td>
      <td data-r="Situação" class="cheia us-sit">${selosConta(x) || '<span class="fraco">—</span>'}</td>
      <td data-r="Produtos ativos" class="cheia us-prods">${produtosTxt(x)}</td>
      <td class="acoes"><button class="btn btn-g sm" type="button" data-uid="${esc(x.uid)}" title="Abrir a ficha" aria-label="Abrir a ficha de ${esc(nomeOuEmail(x))}"><i class="ti ti-chevron-right" aria-hidden="true"></i><span class="tx">Abrir ficha</span></button></td>
    </tr>`).join('');
  $('usTabela').innerHTML = (avisos.length ? `<div class="aviso" style="margin-top:12px"><i class="ti ti-info-circle" aria-hidden="true"></i><div>${avisos.map(esc).join(' ')}</div></div>` : '') +
    `<div class="tblw"><table class="tbl resp us-tbl"><caption class="sr">Contas, página ${r.pagina} de ${r.paginas}</caption><thead><tr>
      <th scope="col">Pessoa</th><th scope="col">CPF</th><th scope="col">Criada em</th><th scope="col">Último acesso</th><th scope="col">Situação</th><th scope="col">Produtos ativos</th><th scope="col"><span class="sr">Ficha</span></th>
    </tr></thead><tbody>${linhas}</tbody></table></div>
    ${r.paginas > 1 ? `<div class="pag"><span>Página ${r.pagina} de ${r.paginas}</span>
      <span class="acoesL"><button class="btn btn-g sm" type="button" id="usAnt" ${r.pagina <= 1 ? 'disabled' : ''}><i class="ti ti-chevron-left" aria-hidden="true"></i>Anterior</button>
      <button class="btn btn-g sm" type="button" id="usProx" ${r.pagina >= r.paginas ? 'disabled' : ''}>Próxima<i class="ti ti-chevron-right" aria-hidden="true"></i></button></span></div>` : ''}`;
  const ant = $('usAnt'), prox = $('usProx');
  if (ant) ant.onclick = () => { E.us.pagina--; carregarUsuarios(); };
  if (prox) prox.onclick = () => { E.us.pagina++; carregarUsuarios(); };
  $('usTabela').querySelectorAll('[data-uid]').forEach(b => b.onclick = () => irFicha(b.dataset.uid));
}
function irFicha(uid) {
  if (E.libOcupado) { toast('Espere terminar de aplicar as liberações.', 'err'); return; }
  location.hash = 'usuarios/' + encodeURIComponent(uid);
}

/* ---------- ficha ---------- */
async function mostrarFicha(uid) {
  $('usLista').hidden = true; $('usFicha').hidden = false;
  E.us.voltaFoco = uid;
  if (E.us.ficha && E.us.ficha.uid === uid) { desenharFicha(E.us.ficha); return; }
  E.us.ficha = null; E.us.aba = 'dados'; E.us.previa = null;
  $('usFicha').innerHTML = barraVoltar() + carregando('Abrindo a ficha…');
  ligaVoltar();
  try {
    const [r] = await Promise.all([admin({ acao: 'usuario', uid }), planos()]);
    if (E.sub !== uid) return;                  // a pessoa já saiu desta ficha
    E.us.ficha = r;
    desenharFicha(r, true);
  } catch (e) {
    if (E.bloqueado) return;
    $('usFicha').innerHTML = barraVoltar() + (e.naoPublicado ? avisoPublicar('a ficha da conta') : avisoErro(e));
    ligaVoltar();
  }
}
const barraVoltar = () => `<div class="us-volta"><button class="btn btn-g sm" type="button" id="usVoltar"><i class="ti ti-arrow-left" aria-hidden="true"></i>Voltar à lista</button></div>`;
function ligaVoltar() { const b = $('usVoltar'); if (b) b.onclick = () => { location.hash = 'usuarios'; }; }
/* relê a ficha depois de uma mudança e volta para a mesma aba */
async function recarregarFicha(msg) {
  const uid = E.us.ficha && E.us.ficha.uid;
  if (!uid) return;
  E.carregou.usuarios = false; E.carregou.assinantes = false; E.carregou.painel = false;
  E.us.previa = null;                         // papel, CPF etc. mudam o que a exclusão apagaria ou impediria
  try {
    const r = await admin({ acao: 'usuario', uid });
    E.us.ficha = r;
    if (E.sub === uid) desenharFicha(r);
    if (msg) toast(msg, 'ok');
  } catch (e) { if (!E.bloqueado) toast('Mudou, mas não consegui reler a ficha: ' + ((e && e.message) || e), 'err'); }
}
function desenharFicha(r, focar) {
  const titulo = nomeOuEmail(r);
  const inicial = (r.nome || r.email || '?').trim().charAt(0).toUpperCase();
  const abas = ABAS_US.map(([id, nm, ic]) => `<button type="button" role="tab" id="usTab-${id}" aria-controls="usPan-${id}" aria-selected="${E.us.aba === id}" tabindex="${E.us.aba === id ? 0 : -1}" data-aba="${id}"><i class="ti ${ic}" aria-hidden="true"></i>${nm}</button>`).join('');
  const painel = (id, html) => `<div class="card us-pan" role="tabpanel" id="usPan-${id}" aria-labelledby="usTab-${id}" tabindex="0"${E.us.aba === id ? '' : ' hidden'}>${html}</div>`;
  $('usFicha').innerHTML = barraVoltar() + `
    <div class="card us-topo">
      <span class="us-av" aria-hidden="true">${esc(inicial)}</span>
      <div class="us-id">
        <h2 id="usFichaTit" tabindex="-1">${esc(titulo)}</h2>
        <p class="sub">${r.nome && r.email ? esc(r.email) + ' · ' : ''}conta criada em ${dataC(r.criadoEm)} · último acesso ${esc(relativo(r.ultimoAcesso))}</p>
        <div class="us-selos">${selosConta(r, true)}</div>
      </div>
    </div>
    <div class="us-abas" role="tablist" aria-label="Partes da ficha">${abas}</div>
    ${painel('dados', fichaDados(r))}
    ${painel('liberacoes', fichaLiberacoes(r))}
    ${painel('permissoes', fichaPermissoes(r))}
    ${painel('acesso', fichaAcesso(r))}
    ${painel('historico', fichaHistorico(r))}`;
  ligaVoltar();
  ligaAbas();
  ligaDados(r); ligaLiberacoes(r); ligaPermissoes(r); ligaAcesso(r);
  if (focar) { const h = $('usFichaTit'); if (h) h.focus({ preventScroll: true }); }
}
function ligaAbas() {
  const tabs = [...$('usFicha').querySelectorAll('[role=tab]')];
  const escolhe = (t, focar) => {
    E.us.aba = t.dataset.aba;
    tabs.forEach(x => { const on = x === t; x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1; $(x.getAttribute('aria-controls')).hidden = !on; });
    if (focar) t.focus();
    /* a prévia da exclusão só é pedida ao servidor quando a aba Acesso à conta abre */
    if (E.us.aba === 'acesso' && E.us.ficha) carregarPrevia(E.us.ficha);
  };
  tabs.forEach((t, i) => {
    t.onclick = () => escolhe(t);
    t.onkeydown = ev => {
      const k = ev.key; let j = -1;
      if (k === 'ArrowRight') j = (i + 1) % tabs.length;
      else if (k === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
      else if (k === 'Home') j = 0; else if (k === 'End') j = tabs.length - 1;
      if (j >= 0) { ev.preventDefault(); escolhe(tabs[j], true); }
    };
  });
}
const travaTxt = (r, tipo) => {
  if (tipo === 'desativar') {
    if (r.dono) return 'A conta do dono não pode ser desativada.';
    if (r.uid === E.us.eu) return 'Você não pode desativar a própria conta.';
  }
  return 'Esta conta é da administração: só o dono do MedTech mexe nela.';
};

/* Dados: nome, e-mail e CPF */
function fichaDados(r) {
  const ficha = [
    ['Identificador da conta', r.uid],
    ['Forma de entrar', (r.provedores || []).map(p => PROVEDOR[p] || p).join(', ') || '—'],
    ['E-mail confirmado', r.email ? (r.emailVerificado ? 'sim' : 'não') : 'sem e-mail'],
    ['Criada em', r.criadoEm ? quando(r.criadoEm) : '—'],
    ['Último acesso', r.ultimoAcesso ? quando(r.ultimoAcesso) : 'nunca entrou'],
    ['Acesso agora', r.ativo ? 'liberado' : 'sem acesso pago']
  ];
  if (r.teste) ficha.push(['Teste grátis', 'até ' + dataS(r.teste)]);
  const trava = !r.pode.editar;
  return `<h3><i class="ti ti-id" aria-hidden="true"></i>Dados da conta</h3>
    <dl class="ficha">${ficha.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
    <form id="usFormDados" class="us-form" novalidate>
      <h4>Nome e e-mail</h4>
      ${trava ? `<p class="aviso"><i class="ti ti-lock" aria-hidden="true"></i><span>${esc(travaTxt(r))}</span></p>` : ''}
      <div class="linhaC">
        <div class="campo"><label for="usNome">Nome</label><input id="usNome" type="text" maxlength="80" autocomplete="off" value="${esc(r.nome)}"${trava ? ' disabled' : ''}></div>
        <div class="campo"><label for="usEmail">E-mail (é o login)</label><input id="usEmail" type="email" maxlength="254" autocomplete="off" spellcheck="false" value="${esc(r.email)}" aria-describedby="usEmailAj"${trava ? ' disabled' : ''}></div>
      </div>
      <p class="ajuda" id="usEmailAj">Trocar o e-mail muda o login: a pessoa passa a entrar com o novo, que fica como não confirmado até ela abrir o link de confirmação.</p>
      <div class="acoesL"><button class="btn btn-p" type="submit"${trava ? ' disabled' : ''}><i class="ti ti-device-floppy" aria-hidden="true"></i>Salvar nome e e-mail</button></div>
    </form>
    <form id="usFormCpf" class="us-form" novalidate>
      <h4>CPF</h4>
      <p class="sub">Atual: <b>${r.cpf ? esc(r.cpf) : (r.temCpf ? 'cadastrado' : 'não cadastrado')}</b>. O CPF inteiro nunca aparece aqui. Se o CPF estiver em outra conta, sai de lá; o CPF antigo desta conta fica livre.</p>
      ${!r.email ? '<p class="aviso"><i class="ti ti-info-circle" aria-hidden="true"></i><span>Conta sem e-mail: o CPF se vincula pelo e-mail da conta.</span></p>' : ''}
      <div class="linhaC">
        <div class="campo"><label for="usCpf">${r.temCpf ? 'CPF correto' : 'CPF'}</label><input id="usCpf" type="text" inputmode="numeric" maxlength="14" autocomplete="off" spellcheck="false" placeholder="000.000.000-00"${r.email ? '' : ' disabled'}></div>
        <div class="campo"><label for="usCpfMotivo">Motivo (fica registrado)</label><input id="usCpfMotivo" type="text" maxlength="300" autocomplete="off" placeholder="Ex.: titular pediu por e-mail; CPF digitado errado"${r.email ? '' : ' disabled'}></div>
      </div>
      <div class="acoesL"><button class="btn btn-g" type="submit"${r.email ? '' : ' disabled'}><i class="ti ti-link" aria-hidden="true"></i>${r.temCpf ? 'Corrigir CPF' : 'Vincular CPF'}</button></div>
    </form>`;
}
function ligaDados(r) {
  const f = $('usFormDados'), fc = $('usFormCpf');
  f.onsubmit = async ev => {
    ev.preventDefault();
    if (!r.pode.editar) return;
    const nome = $('usNome').value.replace(/\s+/g, ' ').trim(), email = $('usEmail').value.trim().toLowerCase();
    const q = { acao: 'editarUsuario', uid: r.uid }, mud = [];
    if (nome !== (r.nome || '')) { q.nome = nome; mud.push(nome ? 'Nome: <b>' + esc(nome) + '</b>' : 'Tirar o nome'); }
    if (email !== (r.email || '')) {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast('E-mail inválido.', 'err'); $('usEmail').focus(); return; }
      q.email = email; mud.push('E-mail: <b>' + esc(r.email || '(nenhum)') + '</b> para <b>' + esc(email) + '</b>. A pessoa passa a entrar com o novo e precisa confirmá-lo.');
    }
    if (!mud.length) { toast('Nada mudou.'); return; }
    if (!await confirmar('Salvar o cadastro', `<span>Para <b>${esc(nomeOuEmail(r))}</b>:</span></p><ul class="lib-notas">${mud.map(m => '<li>' + m + '</li>').join('')}</ul><p>`, 'Salvar')) return;
    try { await admin(q); await recarregarFicha('Cadastro salvo.'); }
    catch (e) { if (!E.bloqueado) toast('Não salvei: ' + ((e && e.message) || e), 'err'); }
  };
  $('usCpf').addEventListener('input', () => { const v = fmtCpf($('usCpf').value); if (v !== $('usCpf').value) $('usCpf').value = v; });
  fc.onsubmit = async ev => {
    ev.preventDefault();
    if (!r.email) return;
    const cpf = $('usCpf').value.trim(), motivo = $('usCpfMotivo').value.trim();
    if (soDig(cpf).length !== 11) { toast('O CPF precisa dos 11 números.', 'err'); $('usCpf').focus(); return; }
    if (motivo.length < 5) { toast('Escreva o motivo: ele fica registrado.', 'err'); $('usCpfMotivo').focus(); return; }
    if (!await confirmar(r.temCpf ? 'Corrigir CPF' : 'Vincular CPF', `Vincular o CPF <b>${esc(fmtCpf(cpf))}</b> à conta <b>${esc(r.email)}</b>? Se ele estiver em outra conta, sai de lá. Se esta conta tiver outro CPF, o antigo fica livre.`, 'Vincular')) return;
    try {
      const x = await admin({ acao: 'vincularCpf', alvo: r.email, cpf, motivo });
      E.carregou.pedidos = false;
      await recarregarFicha(x.jaEstava ? 'Este CPF já era desta conta. Nada mudou.' : 'CPF ' + x.cpf + ' vinculado.' + (x.transferidoDe ? ' Saiu da conta ' + x.transferidoDe + '.' : ''));
    } catch (e) { if (!E.bloqueado) toast('Não vinculei: ' + ((e && e.message) || e), 'err'); }
  };
}

/* Liberações: o editor da seção Acessos, já carregado com esta conta */
function fichaLiberacoes(r) {
  if (!r.email) return `<h3><i class="ti ti-checklist" aria-hidden="true"></i>Liberações</h3><p class="aviso"><i class="ti ti-info-circle" aria-hidden="true"></i><span>Conta sem e-mail: libere pelo CPF na seção Acessos.</span></p>`;
  return `<div class="us-lib" id="usLib">${editorLib(r, 'ulib')}</div>`;
}
function ligaLiberacoes(r) {
  const raiz = $('usLib');
  if (!raiz) return;
  const uid = r.uid, alvo = r.email;
  E.lib = { raiz, p: 'ulib', alvo, r,
    recarregar: () => admin({ acao: 'usuario', uid }),
    mostrar: (r2, res) => { E.us.ficha = r2; E.us.aba = 'liberacoes'; if (E.sub === uid) { desenharFicha(r2); mostrarResultadoLib(res); } } };
  ligaLib();
}

/* Permissões: administrador (só o dono muda) e coordenação do ClínicaMed */
function fichaPermissoes(r) {
  const linha = (id, titulo, desc, ativo, estado, botao) => `<li class="us-papel">
      <div class="us-ptx"><h4 id="usP-${id}">${titulo}</h4><p class="sub" id="usPd-${id}">${desc}</p></div>
      <div class="us-pac">${estado}${botao}</div></li>`;
  const btnPapel = (papel, ativo, pode, rotOn, rotOff, porque) => pode
    ? `<button class="btn ${ativo ? 'btn-dn' : 'btn-p'} sm" type="button" data-papel="${papel}" data-ativo="${ativo ? 0 : 1}" aria-describedby="usPd-${papel}">${ativo ? rotOff : rotOn}</button>`
    : `<button class="btn btn-g sm" type="button" disabled aria-describedby="usPd-${papel} usPw-${papel}">${ativo ? rotOff : rotOn}</button><span class="us-porque" id="usPw-${papel}">${esc(porque)}</span>`;
  const admEstado = r.dono ? '<span class="selo ac">dono (permanente)</span>' : r.admin ? '<span class="selo ok">sim</span>' : '<span class="selo">não</span>';
  const admBtn = r.dono ? '' : btnPapel('admin', r.admin, r.pode.admin, 'Dar administração', 'Tirar administração', 'Só o dono do MedTech muda este papel.');
  const coEstado = r.dono ? '<span class="selo ac">sim (permanente)</span>' : r.coordenador ? (r.coordenadorAtivo ? '<span class="selo ok">sim</span>' : '<span class="selo av">sim, falta confirmar o e-mail</span>') : '<span class="selo">não</span>';
  const coBtn = r.dono ? '' : btnPapel('coordenador', r.coordenador, !!r.email, 'Tornar coordenador', 'Tirar da coordenação', 'Conta sem e-mail.');
  return `<h3><i class="ti ti-shield-check" aria-hidden="true"></i>Permissões</h3>
    <ul class="us-papeis">
      ${linha('admin', 'Administrador do MedTech', 'Entra neste painel e muda tudo nele. Exige e-mail confirmado. Só o dono dá ou tira.', r.admin, admEstado, admBtn)}
      ${linha('coordenador', 'Coordenador do ClínicaMed', 'Cria turmas e vê o desempenho dos alunos no ClínicaMed. Vale quando o e-mail estiver confirmado.', r.coordenador, coEstado, coBtn)}
    </ul>`;
}
function ligaPermissoes(r) {
  $('usPan-permissoes').querySelectorAll('[data-papel]').forEach(b => b.onclick = async () => {
    const papel = b.dataset.papel, ativo = b.dataset.ativo === '1';
    const nm = esc(nomeOuEmail(r));
    const txt = papel === 'admin'
      ? (ativo ? `Dar administração a <b>${nm}</b>? A conta passa a ver e mudar tudo neste painel: contas, liberações, pagamentos e a IA.` : `Tirar a administração de <b>${nm}</b>? Ela deixa de entrar neste painel na hora.`)
      : (ativo ? `Tornar <b>${nm}</b> coordenador do ClínicaMed? Ela passa a criar turmas e ver o desempenho dos alunos.` : `Tirar <b>${nm}</b> da coordenação do ClínicaMed?`);
    if (!await confirmar(papel === 'admin' ? 'Administração' : 'Coordenação do ClínicaMed', txt, ativo ? 'Confirmar' : 'Tirar', !ativo)) return;
    try {
      const x = await admin({ acao: 'papel', uid: r.uid, papel, ativo });
      await recarregarFicha(x.aviso ? 'Feito. ' + x.aviso : 'Permissão atualizada.');
    } catch (e) { if (!E.bloqueado) toast('Não mudei: ' + ((e && e.message) || e), 'err'); }
  });
}

/* Acesso à conta: link de nova senha e desativar/reativar */
function fichaAcesso(r) {
  const podeLink = r.pode.editar && !!r.email && !r.desativada;
  const porqueLink = !r.email ? 'Conta sem e-mail.' : r.desativada ? 'Reative a conta antes.' : !r.pode.editar ? travaTxt(r) : '';
  const porqueDes = r.desativada ? '' : (!r.pode.desativar ? travaTxt(r, 'desativar') : '');
  return `<h3><i class="ti ti-key" aria-hidden="true"></i>Acesso à conta</h3>
    <ul class="us-papeis">
      <li class="us-papel"><div class="us-ptx"><h4>Nova senha</h4>
        <p class="sub" id="usAcSenha">Manda para ${r.email ? '<b>' + esc(r.email) + '</b>' : 'o e-mail da conta'} o e-mail do MedTech com o link para criar uma senha nova. Ninguém vê nem define a senha por aqui.</p></div>
        <div class="us-pac"><button class="btn btn-p sm" type="button" id="usBtSenha" aria-describedby="usAcSenha${porqueLink ? ' usAcSenhaP' : ''}"${podeLink ? '' : ' disabled'}><i class="ti ti-mail-forward" aria-hidden="true"></i>Enviar link de nova senha</button>
        ${porqueLink ? `<span class="us-porque" id="usAcSenhaP">${esc(porqueLink)}</span>` : ''}</div></li>
      <li class="us-papel"><div class="us-ptx"><h4>${r.desativada ? 'Conta desativada' : 'Desativar a conta'}</h4>
        <p class="sub" id="usAcDes">${r.desativada ? 'A pessoa não consegue entrar. Reativar devolve o acesso com tudo como estava.' : 'A pessoa deixa de conseguir entrar e as sessões abertas caem. Nada é apagado: dá para reativar quando quiser.'}</p></div>
        <div class="us-pac">${r.desativada
          ? `<button class="btn btn-p sm" type="button" id="usBtDes" data-des="0"${r.pode.editar ? '' : ' disabled'}><i class="ti ti-player-play" aria-hidden="true"></i>Reativar conta</button>`
          : `<button class="btn btn-dn sm" type="button" id="usBtDes" data-des="1" aria-describedby="usAcDes${porqueDes ? ' usAcDesP' : ''}"${r.pode.desativar ? '' : ' disabled'}><i class="ti ti-user-off" aria-hidden="true"></i>Desativar conta</button>`}
        ${porqueDes ? `<span class="us-porque" id="usAcDesP">${esc(porqueDes)}</span>` : ''}</div></li>
    </ul>
    <section class="us-perigo" aria-labelledby="usExTit">
      <h4 id="usExTit"><i class="ti ti-alert-octagon" aria-hidden="true"></i>Excluir conta</h4>
      <p class="sub">Para atender o pedido da própria pessoa (LGPD): apaga a conta e os dados dela de vez. <b>Não dá para desfazer.</b> Se a ideia é só impedir o acesso, use "Desativar conta" acima.</p>
      <div id="usExCorpo">${prontaPrevia(r) ? htmlPrevia(r, E.us.previa.p) : carregando('Conferindo o que seria apagado…')}</div>
    </section>`;
}

/* ---------- Excluir conta: prévia (o que sai, o que fica, o que impede) e confirmação ---------- */
const NOME_GRUPO = { avisos: 'Avisos', 'trafego-titulo': 'TráfegoTítulo', 'radio-titulo': 'RadioTítulo' };
const nomeGrupo = g => (APPS[g] && APPS[g].nm) || NOME_GRUPO[g] || g;
const prontaPrevia = r => !!(E.us.previa && E.us.previa.uid === r.uid && E.us.previa.p);
const mesmoEmail = (a, b) => !!a && String(a).trim().toLowerCase() === String(b || '').trim().toLowerCase();
async function carregarPrevia(r, forcar) {
  if (!r || !$('usExCorpo')) return;
  if (!forcar && prontaPrevia(r)) return;
  if (!forcar && E.us.previa && E.us.previa.uid === r.uid && E.us.previa.carregando) return;
  E.us.previa = { uid: r.uid, carregando: true };
  $('usExCorpo').innerHTML = carregando('Conferindo o que seria apagado…');
  try {
    const p = await admin({ acao: 'previaExclusao', uid: r.uid });
    if (!E.us.previa || E.us.previa.uid !== r.uid) return;
    E.us.previa = { uid: r.uid, p };
  } catch (e) {
    if (E.bloqueado) return;
    E.us.previa = null;
    const alvo = $('usExCorpo');
    if (!alvo || !E.us.ficha || E.us.ficha.uid !== r.uid) return;
    alvo.innerHTML = ehNaoPublicado(e)
      ? avisoPublicar('a exclusão de conta')
      : avisoErro(e) + '<div class="acoesL"><button class="btn btn-g sm" type="button" id="usExDeNovo"><i class="ti ti-refresh" aria-hidden="true"></i>Tentar de novo</button></div>';
    const b = $('usExDeNovo'); if (b) b.onclick = () => carregarPrevia(r, true);
    return;
  }
  if (E.us.ficha && E.us.ficha.uid === r.uid && $('usExCorpo')) { $('usExCorpo').innerHTML = htmlPrevia(r, E.us.previa.p); ligaPrevia(r, E.us.previa.p); }
}
function htmlPrevia(r, p) {
  const a = p.apaga || {}, f = p.fica || {}, pr = a.progresso || { total: 0, grupos: [] };
  const grupos = (pr.grupos || []).map(g => `${esc(nomeGrupo(g.nome))}: ${inteiro(g.n)}`).join(' · ');
  const sai = [
    `<li><b>Progresso nos apps:</b> ${pr.total ? (pr.maisQue ? 'mais de ' : '') + plural(pr.total, 'documento', 'documentos') : 'nenhum documento'}${grupos ? `<span class="us-ex-det">${grupos}</span>` : ''}</li>`,
    `<li><b>CPF:</b> ${a.cpf ? `${esc(a.cpf)} <span class="us-ex-det">o cadastro e o índice saem; o CPF fica livre para outra conta</span>` : 'nenhum cadastrado'}</li>`,
    `<li><b>Uso da IA:</b> ${a.usoIA ? plural(a.usoIA, 'registro diário', 'registros diários') : 'nenhum registro'}</li>`,
    a.pendentes ? `<li><b>Liberações esperando:</b> ${plural(a.pendentes, 'pendência ligada', 'pendências ligadas')} ao e-mail ou ao CPF</li>` : '',
    a.perfilClinicamed ? '<li><b>Perfil de aluno do ClínicaMed</b> (nome e turma)</li>' : '',
    a.sinalizacoes ? `<li><b>Nome e e-mail em ${plural(a.sinalizacoes, 'questão sinalizada', 'questões sinalizadas')}</b>, e as respostas enviadas à pessoa <span class="us-ex-det">a questão sinalizada continua na caixa, sem identificar quem mandou</span></li>` : '',
    `<li><b>A conta de acesso</b> (${esc(r.email || 'sem e-mail')}): a pessoa não entra mais e o e-mail fica livre para um cadastro novo</li>`
  ].join('');
  const fica = [
    f.pedidos ? `<li><b>${plural(f.pedidos, 'pedido ou pagamento', 'pedidos e pagamentos')}</b> <span class="us-ex-det">registro de compra que a lei manda guardar (LGPD, art. 16, I); ficam marcados como "conta excluída"</span></li>`
      : '<li><b>Nenhum pedido ou pagamento</b> <span class="us-ex-det">se houvesse, o registro de compra ficaria guardado (LGPD, art. 16, I)</span></li>',
    f.assinaturas ? `<li><b>${plural(f.assinaturas, 'registro de assinatura', 'registros de assinatura')}</b> do Mercado Pago <span class="us-ex-det">mesma regra, marcados como "conta excluída"</span></li>` : '',
    '<li><b>O registro desta exclusão</b> <span class="us-ex-det">quem excluiu e quando, com o e-mail mascarado e sem CPF</span></li>'
  ].join('');
  const bloq = (p.bloqueios || []);
  const blocoBloq = bloq.length ? `<div class="aviso err" role="note"><i class="ti ti-lock" aria-hidden="true"></i><div><b>Esta conta não pode ser excluída agora.</b>
      <ul class="us-ex-bloq">${bloq.map(b => `<li><b>${esc(b.texto)}</b> ${esc(b.comoResolver || '')}</li>`).join('')}</ul></div></div>` : '';
  const conf = bloq.length ? `<div class="acoesL"><button class="btn btn-g sm" type="button" id="usExReler"><i class="ti ti-refresh" aria-hidden="true"></i>Conferir de novo</button></div>` : `
    <form class="us-ex-conf" id="usExForm" novalidate>
      <div class="campo">
        <label for="usExEmail">Para confirmar, digite o e-mail da conta: <b class="us-ex-alvo">${esc(r.email)}</b></label>
        <input id="usExEmail" type="email" inputmode="email" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="usExAjuda usExConfere">
        <span class="ajuda" id="usExAjuda">O botão só funciona quando o e-mail digitado for igual ao da conta.</span>
        <span class="ajuda us-ex-ok" id="usExConfere" aria-live="polite"></span>
      </div>
      <div class="acoesL"><button class="btn btn-ex" type="submit" id="usExBt" disabled aria-describedby="usExAjuda"><i class="ti ti-trash-x" aria-hidden="true"></i>Excluir conta definitivamente</button></div>
    </form>`;
  return `${blocoBloq}
    <div class="us-ex-cols">
      <div class="us-ex-col"><h5><i class="ti ti-trash" aria-hidden="true"></i>O que será apagado</h5><ul>${sai}</ul></div>
      <div class="us-ex-col"><h5><i class="ti ti-archive" aria-hidden="true"></i>O que fica, e por quê</h5><ul>${fica}</ul></div>
    </div>${conf}`;
}
function ligaPrevia(r, p) {
  const reler = $('usExReler'); if (reler) reler.onclick = () => carregarPrevia(r, true);
  const inp = $('usExEmail'), bt = $('usExBt'), form = $('usExForm');
  if (!inp || !bt || !form) return;
  const confere = () => {
    const ok = mesmoEmail(inp.value, r.email);
    bt.disabled = !ok;
    $('usExConfere').textContent = ok ? 'O e-mail confere.' : (inp.value.trim() ? 'Ainda não é igual ao e-mail da conta.' : '');
    $('usExConfere').classList.toggle('sim', ok);
  };
  inp.addEventListener('input', confere);
  form.onsubmit = ev => { ev.preventDefault(); if (mesmoEmail(inp.value, r.email)) excluirDefinitivo(r, p, inp.value.trim()); };
}
async function excluirDefinitivo(r, p, emailDigitado) {
  const a = p.apaga || {}, f = p.fica || {}, nm = esc(nomeOuEmail(r));
  const resumo = [
    (a.progresso && a.progresso.total) ? plural(a.progresso.total, 'documento de progresso', 'documentos de progresso') : '',
    a.cpf ? 'o CPF ' + esc(a.cpf) : '',
    a.usoIA ? plural(a.usoIA, 'registro de uso da IA', 'registros de uso da IA') : '',
    'a conta de acesso'
  ].filter(Boolean).join(', ');
  let concluiu = false, tentou = false;
  const corpo = `<p>Excluir a conta de <b>${nm}</b>${r.nome && r.email ? ' (<b>' + esc(r.email) + '</b>)' : ''}?</p>
    <p>Sai de vez: ${resumo}.${f.pedidos ? ' ' + plural(f.pedidos, 'pedido fica guardado', 'pedidos ficam guardados') + ', marcados como de conta excluída.' : ''}</p>
    <p class="us-ex-aviso"><i class="ti ti-alert-triangle" aria-hidden="true"></i><b>Não dá para desfazer.</b></p>`;
  const d = dialogo('Excluir conta definitivamente', corpo, [
    { rot: 'Cancelar', cls: 'btn-g' },
    { rot: '<i class="ti ti-trash-x" aria-hidden="true"></i>Excluir conta', cls: 'btn-ex', acao: async () => {
      const prog = txt => { $('dlgCorpo').innerHTML = `<p class="carregando" role="status">${esc(txt)}</p>`; };
      tentou = true;
      prog('Excluindo a conta…');
      try {
        for (let rodada = 1; rodada <= 12; rodada++) {
          const x = await admin({ acao: 'excluirConta', uid: r.uid, email: emailDigitado, confirmar: 'EXCLUIR' });
          if (x.concluido) { concluiu = true; break; }
          prog('Ainda apagando (muitos dados)… parte ' + (rodada + 1));
        }
        if (!concluiu) toast('A exclusão foi feita em parte. Abra a ficha e tente de novo para terminar.', 'err');
      } catch (e) {
        if (!E.bloqueado) toast('Não excluí: ' + ((e && e.message) || e), 'err');
      }
    } }
  ]);
  /* foco no Cancelar: o botão perigoso não fica pronto para um Enter distraído */
  const cancelar = $('dlgRodape').querySelector('button'); if (cancelar) setTimeout(() => cancelar.focus(), 40);
  await new Promise(res => d.addEventListener('close', res, { once: true }));
  if (concluiu) {
    E.us.previa = null; E.us.ficha = null; E.us.r = null; E.us.voltaFoco = '';
    E.carregou.usuarios = false; E.carregou.assinantes = false; E.carregou.painel = false;
    E.us.aviso = (r.email || r.uid) + ' não existe mais. Os pedidos dela continuam no registro de compras.';
    toast('Conta excluída.', 'ok');
    location.hash = 'usuarios';
  } else if (tentou && E.us.ficha && E.us.ficha.uid === r.uid) {
    carregarPrevia(r, true);                  // falhou ou ficou em parte: mostra o que ainda falta (cancelar não muda nada)
  }
}
function ligaAcesso(r) {
  $('usBtSenha').onclick = async () => {
    if (!await confirmar('Enviar link de nova senha', `Mandar para <b>${esc(r.email)}</b> o e-mail com o link de redefinição de senha? A senha atual continua valendo até a pessoa criar a nova.`, 'Enviar link')) return;
    try { const x = await admin({ acao: 'resetSenha', uid: r.uid }); await recarregarFicha('Link enviado para ' + x.email + '.'); }
    catch (e) { if (!E.bloqueado) toast('Não enviei: ' + ((e && e.message) || e), 'err'); }
  };
  $('usBtDes').onclick = async () => {
    const des = $('usBtDes').dataset.des === '1', nm = esc(nomeOuEmail(r));
    const ok = await confirmar(des ? 'Desativar a conta' : 'Reativar a conta',
      des ? `Desativar <b>${nm}</b>? A pessoa não consegue mais entrar e as sessões abertas caem em até 1 hora. Compras e dados ficam guardados; dá para reativar.` : `Reativar <b>${nm}</b>? A pessoa volta a entrar com a mesma senha.`,
      des ? 'Desativar' : 'Reativar', des);
    if (!ok) return;
    try { await admin({ acao: 'editarUsuario', uid: r.uid, desativar: des }); await recarregarFicha(des ? 'Conta desativada.' : 'Conta reativada.'); }
    catch (e) { if (!E.bloqueado) toast('Não mudei: ' + ((e && e.message) || e), 'err'); }
  };
  if (prontaPrevia(r)) ligaPrevia(r, E.us.previa.p);
  else if (E.us.aba === 'acesso') carregarPrevia(r);
}

/* Histórico: pedidos e pagamentos, sinalizações, pendências e registros da administração */
function fichaHistorico(r) {
  const falhou = '<p class="vazio">Não consegui ler agora.</p>';
  const peds = r.pedidos;
  const tPed = peds === null ? falhou : !peds.length ? '<p class="vazio">Nenhum pedido ou pagamento.</p>' :
    `<div class="tblw"><table class="tbl resp"><caption class="sr">Pedidos e pagamentos</caption><thead><tr><th scope="col">Quando</th><th scope="col">Evento</th><th scope="col">Produto</th><th scope="col" class="n">Valor</th><th scope="col">Meio</th></tr></thead><tbody>
    ${peds.map(x => `<tr><td data-r="Quando" class="fraco">${quando(x.em)}</td>
      <td data-r="Evento"><span class="selo ${SELO_TIPO[x.tipo] || ''}">${esc(x.tipo === 'revisar' ? 'A revisar' : x.rotulo)}</span>${x.teste ? ' <span class="selo">teste</span>' : ''}${x.motivo ? '<br><span class="fraco">Motivo: ' + esc(x.motivo) + '</span>' : ''}</td>
      <td data-r="Produto">${esc(x.nome || '—')}${x.periodo ? ' <span class="fraco">(' + esc(/^\d+d$/.test(x.periodo) ? x.periodo.slice(0, -1) + ' dias' : x.periodo) + ')</span>' : ''}</td>
      <td data-r="Valor" class="n">${x.valor === null ? '—' : (x.estimado ? '≈ ' : '') + brl(x.valor)}</td>
      <td data-r="Meio" class="fraco">${esc(GATEWAY[x.gateway] || x.gateway)}${x.por ? ' · por ' + esc(x.por) : ''}</td></tr>`).join('')}</tbody></table></div>`;
  const sis = r.sinalizacoes;
  const tSi = sis === null ? falhou : !sis.length ? '<p class="vazio">Nenhuma questão sinalizada por esta conta.</p>' :
    `<div class="tblw"><table class="tbl resp"><caption class="sr">Sinalizações</caption><thead><tr><th scope="col">Quando</th><th scope="col">App</th><th scope="col">Problema</th><th scope="col">Situação</th><th scope="col">Questão</th></tr></thead><tbody>
    ${sis.map(x => `<tr><td data-r="Quando" class="fraco">${quando(x.em)}</td><td data-r="App">${esc(siNome(x))}</td><td data-r="Problema">${esc(TIPO_CURTO[x.tipo] || x.tipo)}</td>
      <td data-r="Situação"><span class="selo ${(ST_SINAL[x.status] || {}).selo || ''}">${esc((ST_SINAL[x.status] || {}).nm || x.status)}</span></td><td data-r="Questão" class="cheia us-q">${esc(x.q || '—')}</td></tr>`).join('')}</tbody></table></div>`;
  const log = r.log;
  const tLog = log === null ? falhou : !log.length ? '<p class="vazio">Nenhuma mudança feita pela seção Usuários ainda. Liberações e CPF aparecem em Pedidos e pagamentos.</p>' :
    `<div class="tblw"><table class="tbl resp"><caption class="sr">Registros da administração</caption><thead><tr><th scope="col">Quando</th><th scope="col">O que</th><th scope="col">Detalhe</th><th scope="col">Quem fez</th></tr></thead><tbody>
    ${log.map(x => `<tr><td data-r="Quando" class="fraco">${quando(x.em)}</td><td data-r="O que">${esc(ACAO_LOG[x.acao] || x.acao)}</td><td data-r="Detalhe" class="cheia">${esc(x.resumo)}</td><td data-r="Quem fez" class="fraco em">${esc(x.por || '—')}</td></tr>`).join('')}</tbody></table></div>`;
  const pend = [];
  Object.entries((r.pendente && r.pendente.p) || {}).forEach(([id, ate]) => pend.push(`<li>${esc(nomeProd(id))}: ${dataS(ate)} <span class="fraco">(guardado para o e-mail; entra quando ele for confirmado)</span></li>`));
  Object.entries((r.pendenteCpf && r.pendenteCpf.p) || {}).forEach(([id, ate]) => pend.push(`<li>${esc(nomeProd(id))}: ${dataS(ate)} <span class="fraco">(guardado para o CPF)</span></li>`));
  return `<h3><i class="ti ti-history" aria-hidden="true"></i>Histórico</h3>
    <h4 class="us-h4">Pedidos e pagamentos</h4>${tPed}
    ${pend.length ? `<h4 class="us-h4">Liberações esperando</h4><ul class="us-pend">${pend.join('')}</ul>` : ''}
    <h4 class="us-h4">Questões sinalizadas</h4>${tSi}
    <h4 class="us-h4">Registros da administração</h4>${tLog}`;
}

$('btUs').onclick = () => { E.us.pagina = 1; carregarUsuarios(); };
$('usFiltros').querySelectorAll('[data-usf]').forEach(b => b.addEventListener('click', () => { E.us.filtro = b.dataset.usf; E.us.pagina = 1; carregarUsuarios(); }));
$('usOrdem').addEventListener('change', () => { E.us.pagina = 1; carregarUsuarios(); });
['keydown', 'paste'].forEach(t => $('usBusca').addEventListener(t, () => { E.us.digitou = true; }));
let tBuscaUs = 0;
$('usBusca').addEventListener('input', () => { clearTimeout(tBuscaUs); tBuscaUs = setTimeout(() => { E.us.pagina = 1; carregarUsuarios(); }, 400); });

/* ============================================================
   ACESSOS
   ============================================================ */
function fichaConta(r, semProdutos) {
  if (!r) return '';
  const agora = r.agora || agoraS();
  const prods = Object.entries((r.mt && r.mt.p) || {}).map(([id, ate]) => ({ id, ate, onde: 'conta' }))
    .concat(Object.entries((r.pendente && r.pendente.p) || {}).map(([id, ate]) => ({ id, ate, onde: 'pendente' })))
    .concat(Object.entries((r.pendenteCpf && r.pendenteCpf.p) || {}).map(([id, ate]) => ({ id, ate, onde: 'pendente-cpf' })));
  const ONDE = { conta: 'na conta', pendente: 'pendente (aguarda a conta com este e-mail)', 'pendente-cpf': 'pendente (aguarda o cadastro deste CPF)' };
  const ficha = [
    ['Conta', r.existe ? 'existe' : 'ainda não existe'],
    ['E-mail', r.email || (r.existe ? '—' : 'nenhuma conta com este CPF')],
    ['CPF', r.cpf ? r.cpf + (r.temCpf ? '' : ' (sem conta)') : (r.existe ? 'não cadastrado' : '—')],
    ['Criada em', r.criadoEm ? quando(r.criadoEm) : '—'],
    ['E-mail confirmado', r.existe ? (r.emailVerified ? 'sim' : 'não') : '—'],
    ['Acesso agora', r.existe ? (r.ativo ? 'liberado' : 'sem acesso pago') : '—']
  ];
  if (r.mt && r.mt.adm) ficha.push(['Perfil', 'administração']);
  if (r.mt && r.mt.t) ficha.push(['Teste grátis', (r.mt.t > agora ? 'até ' : 'terminou em ') + dataS(r.mt.t)]);
  const tabProd = prods.length ? `<div class="tblw"><table class="tbl"><caption>Produtos</caption><thead><tr><th scope="col">Produto</th><th scope="col">Vale até</th><th scope="col">Onde</th></tr></thead><tbody>
      ${prods.map(p => `<tr><td>${esc(nomeProd(p.id))}</td><td>${ehIlim(p.ate) ? '<b>ilimitado</b>' : dataS(p.ate) + ' ' + faltam(p.ate)}</td><td class="fraco">${esc(ONDE[p.onde])}</td></tr>`).join('')}</tbody></table></div>`
    : '<p class="sub" style="margin-top:12px">Nenhum produto nesta conta.</p>';
  const peds = (r.pedidos || []);
  const tabPed = peds.length ? `<div class="tblw"><table class="tbl"><caption>Últimos pedidos</caption><thead><tr><th scope="col">Quando</th><th scope="col">Evento</th><th scope="col">Produto</th></tr></thead><tbody>
      ${peds.map(p => `<tr><td class="fraco">${quando(p.em)}</td><td>${esc(ROTULO[p.evento] || p.evento)}${p.revisar ? ' <span class="selo err">a revisar</span>' : ''}</td><td>${esc(nomeProd(p.produto))}${p.periodo ? ' <span class="fraco">(' + esc(p.periodo) + ')</span>' : ''}</td></tr>`).join('')}</tbody></table></div>` : '';
  const limpo = JSON.parse(JSON.stringify(r)); delete limpo.agora;
  /* semProdutos = o editor de liberações (Acessos), que já mostra a situação de cada produto */
  return `<dl class="ficha">${ficha.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>${semProdutos || tabProd}${tabPed}
    <details class="tec"><summary>Dados técnicos</summary><pre>${esc(JSON.stringify(limpo, null, 2))}</pre></details>`;
}
/* ---------- Liberações da conta consultada (10/10/2026) ----------
   Marca de uma vez o que a pessoa tem. A lista vem do planos.json (produtos novos aparecem
   sozinhos); os de "teste": true ficam à parte, recolhidos. Aplicar = diferença:
   marcou um que não estava ativo → conceder {alvos:[alvo], produto, dias | ilimitado:true};
   desmarcou um ativo → revogar {alvo, produto}. Uma chamada por produto, em sequência,
   e no fim a conta é consultada de novo. Sem conta: o servidor guarda como pendente.
   O MESMO editor serve a seção Acessos e a ficha da seção Usuários: o contexto E.lib diz
   onde ele está desenhado (raiz), o prefixo dos ids (p: 'lib' em Acessos, 'ulib' na ficha)
   e como reler a conta depois de aplicar (recarregar) e redesenhar (mostrar). */
const LINHA_NOME = { clinica: 'MedTech App', provas: 'MedTech Provas' };
const nomeLinha = l => LINHA_NOME[l] || (l ? l.charAt(0).toUpperCase() + l.slice(1) : 'Outros');
const MOTIVOS = ['cortesia', 'residência', 'instituição', 'parceria'];
const idLib = (id, p) => (p || 'lib') + '-' + String(id).replace(/[^\w-]/g, '_');
/* elemento do editor ativo pelo id sem prefixo ('Resumo' → #libResumo ou #ulibResumo) */
const qLib = nome => document.getElementById(((E.lib && E.lib.p) || 'lib') + nome);
function situacoesConta(r) {
  const s = {};
  const pega = (obj, onde) => Object.entries((obj && obj.p) || {}).forEach(([id, ate]) => {
    ate = Number(ate) || 0;
    if (!s[id] || ate > s[id].ate) s[id] = { ate, onde };
  });
  pega(r.mt, 'conta'); pega(r.pendente, 'pendente'); pega(r.pendenteCpf, 'pendente-cpf');
  return s;
}
function seloSituacao(st, agora) {
  if (!st || !st.ate) return '<span class="selo">sem acesso</span>';
  if (st.ate <= agora) return `<span class="selo err">vencido em ${dataS(st.ate)}</span>`;
  /* pendente = guardado para o e-mail ou CPF sem conta; entra quando a conta aparecer */
  if (st.onde !== 'conta') return `<span class="selo av">pendente, ${ehIlim(st.ate) ? 'ilimitado' : 'até ' + dataS(st.ate)}</span>`;
  return ehIlim(st.ate) ? '<span class="selo ok">ilimitado</span>' : `<span class="selo ok">ativo até ${dataS(st.ate)}</span>`;
}
function itemLib(id, nome, sub, st, agora, extra, p) {
  const ativo = !!(st && st.ate > agora);
  const k = idLib(id, p);
  return `<li><label class="lib-item" for="${k}">
    <input type="checkbox" id="${k}" data-lib="${esc(id)}" data-orig="${ativo ? 1 : 0}"${ativo ? ' checked' : ''}${extra || ''}>
    <span class="lib-tx"><span class="lib-nm">${esc(nome)}</span>${sub && sub !== nome ? `<span class="lib-sub">${esc(sub)}</span>` : ''}
      <span class="lib-sel">${seloSituacao(st, agora)}<span class="lib-mud" data-mud></span></span></span>
  </label></li>`;
}
function editorLib(r, p) {
  p = p || 'lib';
  const P = E.planos || { produtos: [] }, agora = r.agora || agoraS(), sit = situacoesConta(r);
  const prods = (P.produtos || []).filter(p => p && p.id);
  const subDe = p => { const a = appsDoProduto(P, p); return a.txt || a.ids.map(x => (APPS[x] || {}).nm || x).join(', '); };
  const grupos = [], porLinha = {};
  prods.filter(x => !x.teste).forEach(x => {
    const l = x.linha || '';
    if (!porLinha[l]) { porLinha[l] = []; grupos.push(l); }
    porLinha[l].push(itemLib(x.id, x.nome || x.id, subDe(x), sit[x.id], agora, ` data-linha="${esc(l)}"`, p));
  });
  /* produto que saiu do catálogo e ainda está ativo na conta: só dá para revogar */
  const fora = Object.keys(sit).filter(id => !prods.some(x => x.id === id) && sit[id].ate > agora);
  const testes = prods.filter(x => x.teste);
  const fs = (titulo, itens) => `<fieldset class="lib-grupo"><legend>${esc(titulo)}</legend><ul class="lib-lista">${itens.join('')}</ul></fieldset>`;
  const semConta = !r.existe;
  const pendTxt = r.busca === 'cpf'
    ? 'Não há conta com este CPF. O que for liberado fica pendente e entra quando alguém cadastrar este CPF.'
    : 'Ainda não há conta com este e-mail. O que for liberado fica pendente e entra no primeiro login com este e-mail.';
  return `<section class="lib" aria-labelledby="${p}Tit">
    <div><h4 id="${p}Tit"><i class="ti ti-checklist" aria-hidden="true"></i>Liberações ${semConta ? 'pendentes ' : ''}desta ${r.busca === 'cpf' ? 'pessoa' : 'conta'}</h4>
      <p class="sub">Marcados são os que estão ativos agora. Marque ou desmarque e aplique tudo de uma vez. Os que já estão ativos ficam com a data que têm.</p></div>
    ${semConta ? `<div class="aviso"><i class="ti ti-clock-pause" aria-hidden="true"></i><div>${esc(pendTxt)}</div></div>` : ''}
    <div class="chips" role="group" aria-label="Atalhos de seleção" id="${p}Atalhos">
      <button class="chip" type="button" data-sel="todos">Marcar todos</button>
      <button class="chip" type="button" data-sel="nenhum">Desmarcar todos</button>
      <button class="chip" type="button" data-sel="clinica">Só MedTech App</button>
      <button class="chip" type="button" data-sel="provas">Só provas</button>
    </div>
    ${grupos.map(l => fs(nomeLinha(l), porLinha[l])).join('')}
    ${fora.length ? fs('Fora do catálogo (só revogar)', fora.map(id => itemLib(id, id, 'Saiu do planos.json; ainda ativo nesta conta.', sit[id], agora, ' data-fora="1"', p))) : ''}
    ${testes.length ? `<details class="lib-teste"><summary>Produtos de teste (${testes.length})</summary>
      <p class="sub">Os atalhos não mexem nestes.</p>${fs('Teste', testes.map(x => itemLib(x.id, x.nome || x.id, '', sit[x.id], agora, ' data-teste="1"', p)))}</details>` : ''}
    <div class="lib-opc">
      <fieldset class="lib-dur"><legend>Duração para os que forem adicionados</legend>
        <div class="chips">
          <label class="chip lib-r"><input type="radio" name="${p}Dur" value="30" checked>30 dias</label>
          <label class="chip lib-r"><input type="radio" name="${p}Dur" value="90">90 dias</label>
          <label class="chip lib-r"><input type="radio" name="${p}Dur" value="365">1 ano</label>
          <label class="chip lib-r"><input type="radio" name="${p}Dur" value="ilim">Ilimitado</label>
          <label class="chip lib-r"><input type="radio" name="${p}Dur" value="n">Outro</label>
        </div>
        <div class="campo lib-n"><label for="${p}N">Número de dias</label><input id="${p}N" type="number" min="1" max="3660" value="180" inputmode="numeric" disabled aria-describedby="${p}Naj"><span class="ajuda" id="${p}Naj">De 1 a 3660. Vale quando "Outro" estiver escolhido.</span></div>
      </fieldset>
      <div class="campo"><label for="${p}Motivo">Motivo (opcional)</label>
        <select id="${p}Motivo" aria-describedby="${p}MotAj"><option value="">Sem motivo</option>${MOTIVOS.map(m => `<option value="${esc(m)}">${esc(m.charAt(0).toUpperCase() + m.slice(1))}</option>`).join('')}</select>
        <span class="ajuda" id="${p}MotAj">Aparece no resumo desta aplicação.</span></div>
    </div>
    <div class="lib-rod">
      <p class="lib-res" id="${p}Resumo" aria-live="polite">Nenhuma alteração marcada.</p>
      <button class="btn btn-p" type="button" id="${p}Aplicar" disabled><i class="ti ti-check" aria-hidden="true"></i>Aplicar alterações</button>
    </div>
    <div class="lib-out" id="${p}Out"></div>
  </section>`;
}
const caixasLib = () => (E.lib && E.lib.raiz) ? [...E.lib.raiz.querySelectorAll('[data-lib]')] : [];
function difLib() {
  const cx = caixasLib();
  return { add: cx.filter(c => c.checked && c.dataset.orig !== '1').map(c => c.dataset.lib),
    rem: cx.filter(c => !c.checked && c.dataset.orig === '1').map(c => c.dataset.lib) };
}
function atualizaLib() {
  caixasLib().forEach(c => {
    const m = c.closest('.lib-item').querySelector('[data-mud]');
    const mudou = c.checked !== (c.dataset.orig === '1');
    m.innerHTML = !mudou ? '' : (c.checked ? '<span class="selo ac">vai liberar</span>' : '<span class="selo err">vai revogar</span>');
  });
  const d = difLib(), n = d.add.length + d.rem.length;
  qLib('Resumo').textContent = n ? [d.add.length ? 'Liberar ' + plural(d.add.length, 'produto', 'produtos') : '', d.rem.length ? 'revogar ' + plural(d.rem.length, 'produto', 'produtos') : ''].filter(Boolean).join(', ').replace(/^r/, 'R') + '.' : 'Nenhuma alteração marcada.';
  qLib('Aplicar').disabled = !n || !!E.libOcupado;
}
function duracaoLib() {
  const v = (E.lib.raiz.querySelector('input[name="' + E.lib.p + 'Dur"]:checked') || {}).value || '30';
  if (v === 'ilim') return { ilimitado: true, txt: 'ilimitado' };
  const dias = v === 'n' ? Math.floor(Number(qLib('N').value)) : Number(v);
  if (!(dias >= 1 && dias <= 3660)) return { erro: 'Informe de 1 a 3660 dias.' };
  return { dias, txt: dias === 365 ? '1 ano' : plural(dias, 'dia', 'dias') };
}
function ligaLib() {
  const out = E.lib && E.lib.raiz;
  if (!out || !out.querySelector('.lib')) return;
  /* cada editor desenhado (Acessos e ficha) volta a ser o ativo quando alguém mexe nele */
  const ctx = E.lib, ativa = () => { E.lib = ctx; };
  out.querySelectorAll('[data-lib]').forEach(c => c.addEventListener('change', () => { ativa(); atualizaLib(); }));
  qLib('Atalhos').querySelectorAll('[data-sel]').forEach(b => b.onclick = () => {
    ativa();
    const q = b.dataset.sel;
    caixasLib().forEach(c => {
      if (c.dataset.teste) return;
      if (c.dataset.fora) { if (q === 'nenhum' || q === 'clinica' || q === 'provas') c.checked = false; return; }
      c.checked = q === 'todos' ? true : q === 'nenhum' ? false : c.dataset.linha === q;
    });
    atualizaLib();
    toast(b.textContent + ': ' + qLib('Resumo').textContent);
  });
  out.querySelectorAll('input[name="' + E.lib.p + 'Dur"]').forEach(r => r.addEventListener('change', () => {
    ativa();
    const outro = r.value === 'n' && r.checked;
    qLib('N').disabled = !outro;
    if (outro) qLib('N').focus();
  }));
  qLib('Aplicar').onclick = () => { ativa(); aplicarLib(); };
  atualizaLib();
}
function mostrarConta(alvo, r, resultado) {
  E.lib = { raiz: $('outVer'), p: 'lib', alvo, r, recarregar: () => admin({ acao: 'ver', alvo }), mostrar: (r2, res) => mostrarConta(alvo, r2, res) };
  $('outVer').innerHTML = fichaConta(r, editorLib(r, 'lib'));
  ligaLib();
  mostrarResultadoLib(resultado);
}
function mostrarResultadoLib(resultado) {
  if (!resultado) return;
  const o = qLib('Out'); o.innerHTML = resultado;
  const h = o.querySelector('[tabindex="-1"]'); if (h) h.focus();
}
/* alvo que o servidor entende: o CPF digitado (com máscara) ou o e-mail da conta */
function alvoDaBusca(digitado, r) {
  if (r.busca === 'cpf') return fmtCpf(digitado);
  return (r.email || digitado).toLowerCase();
}
const nomeAlvo = (alvo, r) => r.busca === 'cpf' ? 'CPF ' + alvo + (r.email ? ' (' + r.email + ')' : '') : alvo;
async function aplicarLib() {
  if (E.libOcupado || !E.lib) return;
  const ctx = E.lib, { alvo, r } = ctx, d = difLib();
  const qc = n => document.getElementById(ctx.p + n);   // fixo neste editor, mesmo se outro virar o ativo durante a aplicação
  if (!d.add.length && !d.rem.length) return;
  const dur = duracaoLib();
  if (d.add.length && dur.erro) { toast(dur.erro, 'err'); qc('N').focus(); return; }
  const motivo = qc('Motivo').value;
  const nomes = l => l.map(nomeProd).join(', ');
  const linha = [d.add.length ? 'Liberar: ' + nomes(d.add) + ' (' + dur.txt + ')' : '', d.rem.length ? 'Revogar: ' + nomes(d.rem) : ''].filter(Boolean).join(' · ');
  const notas = [];
  if (!r.existe && d.add.length) notas.push(r.busca === 'cpf' ? 'Sem conta com este CPF: a liberação fica pendente até alguém cadastrar o CPF.' : 'Sem conta com este e-mail: a liberação fica pendente até o primeiro login.');
  if (d.add.some(id => ((situacoesConta(r)[id] || {}).ate || 0) > 0)) notas.push('Produto vencido volta a valer a partir de hoje.');
  if (d.rem.length) notas.push('Revogar tira o acesso na hora. Cobrança no Mercado Pago não é cancelada por aqui.');
  if (motivo) notas.push('Motivo: ' + motivo + '.');
  let ok = false;
  const dl = dialogo('Aplicar alterações', `<p>Para <b>${esc(nomeAlvo(alvo, r))}</b>:</p>
    <p class="lib-linha">${esc(linha)}</p>
    ${notas.length ? `<ul class="lib-notas">${notas.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}`,
    [{ rot: 'Cancelar', cls: 'btn-g' }, { rot: 'Aplicar ' + plural(d.add.length + d.rem.length, 'alteração', 'alterações'), cls: d.rem.length ? 'btn-dn' : 'btn-p', acao: () => { ok = true; } }]);
  await new Promise(res => dl.addEventListener('close', res, { once: true }));
  if (!ok) return;

  const passos = d.add.map(id => ({ tipo: 'add', id })).concat(d.rem.map(id => ({ tipo: 'rem', id })));
  E.libOcupado = true;
  const sec = ctx.raiz.querySelector('.lib');
  sec.querySelectorAll('input,select,button').forEach(x => { x.disabled = true; });
  sec.setAttribute('aria-busy', 'true');
  const out = qc('Out');
  const listaPasso = p => {
    const rot = (p.tipo === 'add' ? 'Liberar ' : 'Revogar ') + nomeProd(p.id);
    const est = !p.st ? '<span class="selo">aguardando</span>' : p.st === 'fazendo' ? '<span class="selo ac">aplicando…</span>'
      : `<span class="selo ${p.erro ? 'err' : (p.pend ? 'av' : 'ok')}">${esc(p.txt)}</span>`;
    const ic = !p.st || p.st === 'fazendo' ? 'ti-point' : p.erro ? 'ti-alert-triangle' : 'ti-circle-check';
    return `<li><i class="ti ${ic}" aria-hidden="true"></i><span class="lib-pn">${esc(rot)}</span>${est}</li>`;
  };
  /* região viva fixa: só o texto muda a cada passo (trocar o bloco inteiro faria o leitor de tela repetir tudo) */
  const pp = ctx.p;
  out.innerHTML = `<div class="lib-prog"><p id="${pp}ProgTx" role="status" aria-live="polite"></p>
      <progress id="${pp}ProgBar" max="${passos.length}" value="0" aria-labelledby="${pp}ProgTx"></progress>
      <ol class="lib-passos" id="${pp}Passos"></ol></div>`;
  const desenhaPassos = feitos => {
    qc('ProgTx').textContent = feitos < passos.length ? 'Aplicando ' + (feitos + 1) + ' de ' + passos.length + '…' : 'Concluído.';
    qc('ProgBar').value = feitos;
    qc('Passos').innerHTML = passos.map(listaPasso).join('');
  };
  for (let i = 0; i < passos.length; i++) {
    const p = passos[i];
    p.st = 'fazendo'; desenhaPassos(i);
    try {
      if (p.tipo === 'add') {
        const q = Object.assign({ acao: 'conceder', alvos: [alvo], produto: p.id }, dur.ilimitado ? { ilimitado: true } : { dias: dur.dias });
        if (motivo) q.motivo = motivo;
        const res = ((await admin(q)).resultado || [])[0] || {};
        if (res.erro) { p.erro = true; p.txt = res.erro; }
        else {
          p.pend = res.destino !== 'conta';
          p.txt = (p.pend ? 'pendente, ' : 'liberado, ') + (ehIlim(res.ate) ? 'ilimitado' : 'até ' + dataS(res.ate));
        }
      } else {
        const res = await admin({ acao: 'revogar', alvo, produto: p.id });
        p.txt = res.conta && res.pendente ? 'revogado da conta e do pendente' : res.conta ? 'revogado' : res.pendente ? 'revogado do pendente' : 'já não estava ativo';
      }
    } catch (e) {
      p.erro = true; p.txt = (e && e.message) || String(e);
      if (E.bloqueado) break;
    }
    p.st = 'feito';
  }
  const erros = passos.filter(p => p.erro).length, feitos = passos.filter(p => p.st === 'feito').length;
  E.carregou.assinantes = false; E.carregou.painel = false; E.carregou.pedidos = false; E.carregou.usuarios = false;
  const resumo = `<div class="aviso ${erros ? 'err' : 'info'} lib-fim"><i class="ti ${erros ? 'ti-alert-triangle' : 'ti-check'}" aria-hidden="true"></i><div>
      <p class="lib-fimtit" tabindex="-1"><b>${erros ? plural(feitos - erros, 'alteração aplicada', 'alterações aplicadas') + ', ' + plural(erros, 'com erro', 'com erro') + '.' : 'Tudo aplicado: ' + plural(feitos, 'alteração', 'alterações') + '.'}</b></p>
      <p>${esc(linha)}${motivo ? ' · Motivo: ' + esc(motivo) : ''}</p></div></div>
    <ol class="lib-passos">${passos.map(listaPasso).join('')}</ol>`;
  E.libOcupado = false;
  if (E.bloqueado) return;
  out.innerHTML = resumo + carregando('Consultando a conta de novo…');
  try {
    const r2 = await ctx.recarregar();
    ctx.mostrar(r2, resumo + `<p class="leg">Situação acima consultada de novo às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.</p>`);
  } catch (e) {
    out.innerHTML = resumo + avisoErro(e);
  }
}
$('fVer').addEventListener('submit', async ev => {
  ev.preventDefault();
  const alvo = $('vEmail').value.trim();
  if (!alvo || E.libOcupado) return;
  const out = $('outVer'); out.innerHTML = carregando('Consultando…');
  try {
    const [r] = await Promise.all([admin({ acao: 'ver', alvo }), planos()]);
    mostrarConta(alvoDaBusca(alvo, r), r);
  }
  catch (e) { out.innerHTML = E.bloqueado ? '' : avisoErro(e); }
});
/* e-mails e CPFs misturados: separa por linha, vírgula, ponto e vírgula ou espaço
   (o CPF "000.000.000-00" não tem espaço; e-mail também não) */
const listaAlvos = () => [...new Set($('cEmails').value.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean)
  .map(s => s.includes('@') ? s.toLowerCase() : (soDig(s).length === 11 ? fmtCpf(s) : s)))];
const contaAlvos = l => { const c = l.filter(s => !s.includes('@') && soDig(s).length === 11).length; return { cpfs: c, emails: l.length - c }; };
function descreveAlvos(l) {
  const k = contaAlvos(l);
  return [k.emails ? plural(k.emails, 'e-mail', 'e-mails') : '', k.cpfs ? plural(k.cpfs, 'CPF', 'CPFs') : ''].filter(Boolean).join(' e ');
}
$('cEmails').addEventListener('input', () => {
  const l = listaAlvos();
  $('cConta').textContent = l.length ? descreveAlvos(l) + (l.length > 200 ? ' (o máximo é 200 por vez)' : '') : 'Um por linha ou separados por vírgula. Pode misturar e-mails e CPFs. Até 200 por vez.';
});
function marcaIlim() {
  const on = $('cIlim').checked;
  $('cDias').disabled = on;
  document.querySelector('#fConceder .chips').classList.toggle('off', on);
}
$('cIlim').addEventListener('change', marcaIlim);
document.querySelectorAll('[data-dias]').forEach(b => b.addEventListener('click', () => { $('cDias').value = b.dataset.dias; $('cIlim').checked = false; marcaIlim(); }));
$('fConceder').addEventListener('submit', async ev => {
  ev.preventDefault();
  const alvos = listaAlvos(), prod = $('cProd').value, dias = Math.floor(Number($('cDias').value)), ilimitado = $('cIlim').checked;
  const out = $('outConceder');
  if (!alvos.length) { out.innerHTML = avisoErro('Informe ao menos um e-mail ou CPF.'); return; }
  if (alvos.length > 200) { out.innerHTML = avisoErro('No máximo 200 e-mails ou CPFs por vez.'); return; }
  if (!ilimitado && !(dias >= 1 && dias <= 3660)) { out.innerHTML = avisoErro('Informe de 1 a 3660 dias, ou marque acesso ilimitado.'); return; }
  const ok = await confirmar('Liberar acesso', `Liberar <b>${esc(nomeProd(prod))}</b> ${ilimitado ? '<b>sem data de fim (ilimitado)</b>' : 'por <b>' + plural(dias, 'dia', 'dias') + '</b>'} para <b>${esc(descreveAlvos(alvos))}</b>?`, 'Liberar');
  if (!ok) return;
  out.innerHTML = carregando('Liberando…');
  try {
    const r = await admin(Object.assign({ acao: 'conceder', alvos, produto: prod }, ilimitado ? { ilimitado: true } : { dias }));
    const res = r.resultado || [];
    const erros = res.filter(x => x.erro).length;
    out.innerHTML = `<div class="aviso ${erros ? '' : 'info'}" style="margin-top:14px"><i class="ti ${erros ? 'ti-alert-triangle' : 'ti-check'}" aria-hidden="true"></i><div>${plural(res.length - erros, 'liberação feita', 'liberações feitas')}${erros ? ', ' + plural(erros, 'com erro', 'com erro') : ''}.</div></div>
      <div class="tblw"><table class="tbl resp"><thead><tr><th scope="col">E-mail ou CPF</th><th scope="col">Resultado</th><th scope="col">Vale até</th></tr></thead><tbody>
      ${res.map(x => `<tr><td data-r="E-mail ou CPF" class="em cheia">${x.tipo === 'cpf' ? '<span style="white-space:nowrap">' + esc(x.alvo) + '</span>' : esc(x.alvo || x.email)}${x.tipo === 'cpf' && x.email ? '<br><span class="fraco">' + esc(x.email) + '</span>' : ''}</td><td data-r="Resultado">${x.erro ? `<span class="selo err">${esc(x.erro)}</span>` : (x.destino === 'conta' ? '<span class="selo ok">na conta</span>' : `<span class="selo av">${x.tipo === 'cpf' ? 'pendente: aguarda o CPF' : 'pendente: entra no primeiro login'}</span>`)}</td><td data-r="Vale até">${x.ate ? dataS(x.ate) : '—'}</td></tr>`).join('')}
      </tbody></table></div>`;
    E.carregou.assinantes = false; E.carregou.painel = false;
  } catch (e) { out.innerHTML = avisoErro(e); }
});
$('fRevogar').addEventListener('submit', async ev => {
  ev.preventDefault();
  const alvo = $('rEmail').value.trim(), prod = $('rProd').value, out = $('outRevogar');
  if (!alvo) return;
  const ehCpf = !alvo.includes('@');
  const ok = await confirmar('Revogar acesso', `Tirar <b>${esc(nomeProd(prod))}</b> de <b>${esc(ehCpf ? 'CPF ' + fmtCpf(alvo) : alvo)}</b>? O acesso sai na hora.`, 'Revogar', true);
  if (!ok) return;
  out.innerHTML = carregando('Revogando…');
  try {
    const r = await admin({ acao: 'revogar', alvo, produto: prod });
    const onde = [r.conta ? 'da conta' + (ehCpf && r.email ? ' ' + r.email : '') : '', r.pendente ? 'da liberação pendente' : ''].filter(Boolean).join(' e ');
    out.innerHTML = `<div class="aviso info" style="margin-top:14px"><i class="ti ti-check" aria-hidden="true"></i><div>${onde ? 'Revogado ' + esc(onde) + '.' : (ehCpf ? 'Este CPF' : 'Este e-mail') + ' não tinha esse produto. Nada mudou.'}</div></div>`;
    E.carregou.assinantes = false; E.carregou.painel = false;
  } catch (e) { out.innerHTML = avisoErro(e); }
});

$('vcCpf').addEventListener('input', () => { const v = fmtCpf($('vcCpf').value); if (v !== $('vcCpf').value) $('vcCpf').value = v; });
$('fVincular').addEventListener('submit', async ev => {
  ev.preventDefault();
  const email = $('vcEmail').value.trim(), cpf = $('vcCpf').value.trim(), motivo = $('vcMotivo').value.trim(), out = $('outVincular');
  if (!email || !cpf) return;
  if (soDig(cpf).length !== 11) { out.innerHTML = avisoErro('O CPF precisa dos 11 números.'); return; }
  if (motivo.length < 5) { out.innerHTML = avisoErro('Escreva o motivo: ele fica registrado.'); return; }
  const ok = await confirmar('Vincular CPF', `Vincular o CPF <b>${esc(fmtCpf(cpf))}</b> à conta <b>${esc(email)}</b>? Se ele estiver em outra conta, sai de lá. Se esta conta tiver outro CPF, o antigo fica livre.`, 'Vincular');
  if (!ok) return;
  out.innerHTML = carregando('Vinculando…');
  try {
    const r = await admin({ acao: 'vincularCpf', alvo: email, cpf, motivo });
    const det = r.jaEstava ? 'Este CPF já era desta conta. Nada mudou.'
      : 'CPF ' + r.cpf + ' vinculado a ' + r.email + '.' + (r.transferidoDe ? ' Saiu da conta ' + r.transferidoDe + '.' : '') + (r.cpfAnterior ? ' O CPF anterior (' + r.cpfAnterior + ') ficou livre.' : '') + (r.pendenteAplicado ? ' A liberação pendente deste CPF foi aplicada.' : '');
    out.innerHTML = `<div class="aviso info" style="margin-top:14px"><i class="ti ti-check" aria-hidden="true"></i><div>${esc(det)}</div></div>`;
    $('vcMotivo').value = '';
    E.carregou.assinantes = false; E.carregou.pedidos = false;
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
        <td data-r="E-mail" class="em">${esc(x.email || (x.cpf ? 'CPF ' + x.cpf : '—'))}${x.email && x.cpf ? '<br><span class="fraco">CPF ' + esc(x.cpf) + '</span>' : ''}${x.motivo ? '<br><span class="fraco">Motivo: ' + esc(x.motivo) + '</span>' : ''}</td>
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
   SINALIZAÇÕES (10/10/2026): resolver sem sair do painel
   mtSinal {op:'listar'} → {itens, apps}   (traz todas; filtros aqui, como no sinalizacoes.html)
           {op:'marcar', id, status: aberta|corrigida|descartada, resposta}
   "Ver a questão completa" lê o banco PÚBLICO de cada app (mesmo domínio) com fetch e
   JSON.parse do literal `window.X = [...]`: nada do arquivo é executado. A chave é a mesma
   dos apps (chaveTxt do enunciado; no FarmaUTI, o id do item). Se não achar pela chave, procura
   pelo começo do enunciado guardado na sinalização. RadioTítulo é repositório privado.
   ============================================================ */
const TIPO_SINAL = { gabarito: 'Gabarito errado', texto: 'Erro no enunciado ou nas alternativas', desatualizada: 'Desatualizada (norma ou diretriz mudou)', comentario: 'Erro no comentário ou na explicação', outro: 'Outro problema' };
const TIPO_CURTO = { gabarito: 'Gabarito errado', texto: 'Erro no texto', desatualizada: 'Desatualizada', comentario: 'Erro no comentário', outro: 'Outro problema' };
const ST_SINAL = { aberta: { nm: 'aberta', selo: 'err' }, corrigida: { nm: 'corrigida', selo: 'ok' }, descartada: { nm: 'descartada', selo: '' } };
const LETRAS = 'ABCDE';
const ONDE_LEVAS = 'lotes-questoes/leva*.json, montado por monta_banco.py em banco.js (o banco.js nunca se edita à mão)';
const SI_APP = {
  'trafego-titulo': { nm: 'TráfegoTítulo', c: '#23272E', repo: 'MedTechBR/trafego-titulo', base: '/trafego-titulo/', fmt: 'padrao', arq: [['banco.js', 'BANCO']], onde: ONDE_LEVAS, publico: 'prova de título de especialista em Medicina de Tráfego (ABRAMET)' },
  clinicamed: { nm: 'ClínicaMed', c: '#0B6A72', repo: 'MedTechBR/clinicamed', base: '/clinicamed/', fmt: 'padrao', reordena: true, arq: [['banco.js', 'BANCO']], onde: ONDE_LEVAS, publico: 'prova de título (TECM) e residência em Clínica Médica' },
  cirurgiamed: { nm: 'CirurgiaMed', c: '#33479E', repo: 'MedTechBR/cirurgiamed', base: '/cirurgiamed/', fmt: 'padrao', reordena: true, arq: [['banco.js', 'BANCO']], onde: ONDE_LEVAS, publico: 'Cirurgia Geral (prova de título e ENARE R+ cirúrgico)' },
  flashmed: { nm: 'FlashMed', c: '#A86D12', repo: 'MedTechBR/flashmed', base: '/flashmed/', fmt: 'padrao', reordena: true, peso: 'cerca de 10 MB', arq: [['banco.js', 'BANCO']], onde: ONDE_LEVAS + '; questão importada de outro app (campo orig) se corrige no app de origem e se reimporta com importa.py', publico: 'preparatório ENARE e ENAMED (residência médica, acesso direto)' },
  'quiz-enare-farmacia': { nm: 'Banca ENARE Farmácia', c: '#0F766E', repo: 'MedTechBR/quiz-enare-farmacia', base: '/quiz-enare-farmacia/', fmt: 'enare', arq: [['banco_edital.js', 'BANCO_EDITAL'], ['simulados.js', 'SIMULADOS']], onde: 'banco_edital.js (banco) e simulados.js (provas reais na íntegra); os simulados diários reaproveitam o banco', publico: 'residência multiprofissional em Farmácia (ENARE)' },
  farmauti: { nm: 'FarmaUTI', c: '#B4235A', repo: 'MedTechBR/farmauti', base: '/farmauti/', fmt: 'farmauti', arq: [['dados/estudo.js', 'FU_ESTUDO']], onde: 'lotes/*.json, montado por monta.py em dados/estudo.js', publico: 'residência de Farmácia em terapia intensiva' },
  'radio-titulo': { nm: 'RadioTítulo', c: '#4166D6', privado: true, repo: 'repositório privado do RadioTítulo', publico: 'prova de título de Radiologia (CBR)' }
};
const siCfg = app => SI_APP[app] || { nm: app, c: 'var(--ac)' };
const siNome = x => (SI_APP[x.app] && SI_APP[x.app].nm) || x.appNome || x.app;

E.si = { itens: [], apps: {}, st: 'aberta', app: '', busca: '', limite: 30, abertos: new Set(), questao: {}, ia: {}, pedido: {}, rascunho: {}, bancos: {},
  erratas: new Map(), errNaoPublicado: false, errErro: '', editor: {}, resp: {}, modelo: {},
  fixos: new Set() };   /* resolvida agora pelo painel: fica na lista (para responder) até trocar o filtro */

/* ---- chave estável: a MESMA função dos apps (djb2 + FNV com Math.imul) ---- */
function hashTxt(s) {
  let h1 = 5381, h2 = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = ((h1 << 5) + h1 + c) >>> 0; h2 = Math.imul(h2 ^ c, 0x01000193) >>> 0; }
  return (h1.toString(36) + h2.toString(36)).slice(0, 10);
}
const normTxt = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const chaveTxt = t => hashTxt(normTxt(t));
/* FarmaUTI: ordem das alternativas na tela (hash FNV do id, app.js ordemAlts) */
function fnv(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function ordemFU(id, n) {
  if (n !== 5) return [...Array(n).keys()];
  const o = [0, 1, 2, 3, 4]; let h = fnv(String(id));
  for (let i = 4; i > 0; i--) { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; const j = h % (i + 1); [o[i], o[j]] = [o[j], o[i]]; }
  return o;
}
/* ClínicaMed, CirurgiaMed, FlashMed: autoral de 5 alternativas tem a correta numa posição tirada da chave */
function ordemCM(q, ch) {
  const n = q.alts.length, idx = [...Array(n).keys()];
  let alvo = q.gab;
  if (!q.fonte && n === 5) { let h = 0; for (const c of ch) h = (h * 31 + c.charCodeAt(0)) >>> 0; alvo = h % 5; }
  const outras = idx.filter(i => i !== q.gab);
  return [...outras.slice(0, alvo), q.gab, ...outras.slice(alvo)];
}
/* comentário com HTML (Banca ENARE): vira texto, sem executar nada (DOMParser não roda script nem carrega imagem) */
function htmlTxt(h) {
  const s = String(h || '');
  if (!/[<&]/.test(s)) return s;
  const d = new DOMParser().parseFromString(s.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li|div)>/gi, '\n'), 'text/html');
  return (d.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}
function extraiGlobal(txt, nome) {
  const m = new RegExp('window\\.' + nome + '\\s*=\\s*').exec(txt);
  if (!m) throw new Error('o arquivo não define ' + nome);
  const s = txt.slice(m.index + m[0].length);
  const fim = Math.max(s.lastIndexOf(']'), s.lastIndexOf('}'));
  return JSON.parse(s.slice(0, fim + 1));
}
function procedencia(f) {
  if (!f) return 'autoral';
  const partes = [f.banca || f.instituicao || ''];
  if (f.prova) partes.push(f.prova);
  else if (f.instituicao && f.instituicao !== f.banca) partes.push(f.instituicao);
  if (f.ano && !partes.join(' ').includes(String(f.ano))) partes.push(String(f.ano));
  if (f.n) partes.push('questão ' + f.n);
  return partes.filter(Boolean).join(' · ');
}

/* ---- carregadores: devolvem {idx: Map(chave → item normalizado), todos: [...]} ---- */
function normPadrao(cfg, q, ch) {
  const ord = cfg.reordena ? ordemCM(q, ch) : q.alts.map((_, i) => i);
  const extras = [];
  if (q.sub) extras.push(['Subtema', q.sub]);
  if (q.nivel) extras.push(['Nível', ({ r1: 'essencial', r2: 'intermediário', r3: 'avançado', tit: 'prova de título ou especialista' })[q.nivel] || q.nivel]);
  if (q.orig) extras.push(['Importada de', (SI_APP[q.orig] && SI_APP[q.orig].nm) || q.orig]);
  return {
    tipo: 'questao', ch, enunciado: q.q, reordenada: ord.some((o, p) => o !== p),
    alts: ord.map((orig, p) => ({ letra: LETRAS[p], txt: q.alts[orig], idx: orig, certa: orig === q.gab, por: (q.porAlt || [])[orig] || '' })),
    comentario: q.coment || '', base: q.base || '', proc: procedencia(q.fonte), real: !!q.fonte, orig: q.orig || '', extras
  };
}
function normEnare(cfg, q, ch, onde) {
  const anulada = q.correct === -1;
  return {
    tipo: 'questao', ch, enunciado: q.q, anulada,
    alts: (q.ops || []).map((t, i) => ({ letra: LETRAS[i], txt: htmlTxt(t), idx: i, certa: i === q.correct, por: '' })),
    comentario: htmlTxt(q.c), base: '', proc: q.fonte ? procedencia(q.fonte) : (onde || 'autoral'), real: !!q.fonte || !!onde,
    img: q.img ? cfg.base + q.img : '', extras: q.tema ? [['Tema no banco', q.tema]] : []
  };
}
async function lerArquivo(cfg, arq, nome) {
  const r = await fetch(cfg.base + arq, { cache: 'no-cache' });
  if (!r.ok) throw new Error(arq + ' respondeu ' + r.status);
  return extraiGlobal(await r.text(), nome);
}
async function montaBanco(app) {
  const cfg = SI_APP[app];
  const idx = new Map(), todos = [];
  const poe = it => { todos.push(it); if (!idx.has(it.ch)) idx.set(it.ch, it); };
  if (cfg.fmt === 'padrao') {
    const B = await lerArquivo(cfg, 'banco.js', 'BANCO');
    B.forEach(q => { if (q && q.q && Array.isArray(q.alts)) { const ch = chaveTxt(q.q); poe(normPadrao(cfg, q, ch)); } });
  } else if (cfg.fmt === 'enare') {
    const [B, S] = await Promise.all([lerArquivo(cfg, 'banco_edital.js', 'BANCO_EDITAL'), lerArquivo(cfg, 'simulados.js', 'SIMULADOS').catch(() => [])]);
    B.forEach(q => { if (q && q.q) poe(normEnare(cfg, q, chaveTxt(q.q))); });
    (S || []).forEach(sm => (sm.questions || []).forEach((q, i) => { if (q && q.q) poe(normEnare(cfg, q, chaveTxt(q.q), (sm.title || 'Simulado') + ', questão ' + (i + 1))); }));
  } else if (cfg.fmt === 'farmauti') {
    const D = await lerArquivo(cfg, 'dados/estudo.js', 'FU_ESTUDO');
    const LEIT = {}; (D.leituras || []).forEach(l => LEIT[l.slug] = l);
    const AREA = {}; (D.areas || []).forEach(a => AREA[a.id] = a.nome);
    const NIV = { basico: 'básico', intermediario: 'intermediário', avancado: 'avançado' };
    (D.questoes || []).forEach(q => {
      const l = LEIT[q.l] || {}, ord = ordemFU(q.id, (q.a || []).length);
      poe({ tipo: 'questao', ch: q.id, enunciado: q.e, reordenada: true,
        alts: ord.map((orig, p) => ({ letra: LETRAS[p], txt: q.a[orig], idx: orig, certa: orig === q.g, por: (q.p || [])[orig] || '' })),
        comentario: q.c || '', base: q.b || '', proc: 'autoral',
        extras: [['Leitura', l.titulo || q.l], ['Área', AREA[l.area] || '—'], ['Nível', NIV[q.n] || q.n || '—']] });
    });
    (D.cartoes || []).forEach(c => {
      const l = LEIT[c.l] || {};
      poe({ tipo: 'cartao', ch: c.id, enunciado: c.f, verso: c.v, alts: [], comentario: '', base: (l.fontes || []).join('; '), baseRot: 'Fontes da leitura', proc: 'autoral',
        extras: [['Leitura', l.titulo || c.l], ['Área', AREA[l.area] || '—']] });
    });
  }
  return { idx, todos };
}
function banco(app) {
  if (!E.si.bancos[app]) E.si.bancos[app] = montaBanco(app).catch(e => { delete E.si.bancos[app]; throw e; });
  return E.si.bancos[app];
}
/* acha a questão de uma sinalização: pela chave; se não bater, pelo começo do enunciado */
async function achaQuestao(x) {
  const cfg = SI_APP[x.app];
  if (!cfg) return { erro: 'App sem banco conhecido pelo painel.' };
  if (cfg.privado) return { privado: true };
  const B = await banco(x.app);
  let it = B.idx.get(x.chave), por = 'chave';
  if (!it) {
    const ini = normTxt(String(x.q || '').replace(/…\s*$/, ''));
    if (ini.length >= 30) {
      const achados = B.todos.filter(q => normTxt(q.enunciado).startsWith(ini));
      if (achados.length) { it = achados[0]; por = achados.length > 1 ? 'texto-varias' : 'texto'; }
    }
  }
  return it ? { it, por, total: B.idx.size } : { nao: true, total: B.idx.size };
}

/* ---- lista ---- */
async function carregarSinal() {
  E.carregou.sinal = true;
  $('btSi').disabled = true;
  $('siQuando').textContent = 'Atualizando…';
  if (!E.si.itens.length) $('siLista').innerHTML = carregando('Carregando as sinalizações…');
  try {
    const [r] = await Promise.all([chamar('mtSinal', { op: 'listar' }), carregarErratas()]);
    E.si.itens = (r.itens || []).sort((a, b) => String(b.em || '').localeCompare(String(a.em || '')));
    E.si.apps = r.apps || {};
    $('siAviso').innerHTML = '';
    const ap = $('siApp').value;
    const ids = [...new Set(Object.keys(E.si.apps).concat(Object.keys(SI_APP)))];
    $('siApp').innerHTML = '<option value="">Todos os apps</option>' + ids.map(k => `<option value="${esc(k)}">${esc(siCfg(k).nm || (E.si.apps[k] || {}).nome || k)}</option>`).join('');
    $('siApp').value = ap;
    desenharSinal();
    $('siQuando').textContent = 'Atualizado às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    $('siQuando').textContent = '';
    if (ehNegado(e)) { bloquear(e.message); return; }
    $('siAviso').innerHTML = avisoErro(e);
    if (!E.si.itens.length) $('siLista').innerHTML = '';
  } finally { $('btSi').disabled = false; }
}
function contaSinal() {
  const c = { aberta: 0, corrigida: 0, descartada: 0, todas: E.si.itens.length };
  E.si.itens.forEach(x => { c[x.status] = (c[x.status] || 0) + 1; });
  return c;
}
function atualizaContadorSinal() {
  const c = contaSinal();
  document.querySelectorAll('#siSituacao [data-n]').forEach(s => { s.textContent = inteiro(c[s.dataset.n] || 0); });
  const cnt = $('cntSinal');
  if (c.aberta) { cnt.innerHTML = (c.aberta > 99 ? '99+' : c.aberta) + '<span class="sr"> abertas</span>'; cnt.hidden = false; }
  else cnt.hidden = true;
  if (E.painel && E.painel.sinalizacoes && E.painel.sinalizacoes.ok) E.painel.sinalizacoes.abertas = c.aberta;
}
function filtradosSinal() {
  const b = normTxt(E.si.busca), bt = E.si.busca.trim().toLowerCase();
  return E.si.itens.filter(x => E.si.fixos.has(x.id) || (!E.si.st || x.status === E.si.st) && (!E.si.app || x.app === E.si.app) &&
    (!bt || [x.q, x.nota, x.tema, x.email, x.extra, x.chave, x.resposta, siNome(x)].join(' ').toLowerCase().includes(bt) ||
      (b.length > 2 && normTxt([x.q, x.nota, x.tema].join(' ')).includes(b))));
}
function desenharSinal() {
  atualizaContadorSinal();
  marcarChips('siSituacao', 'sist', E.si.st);
  const L = filtradosSinal();
  const porApp = {}; L.forEach(x => { const k = siNome(x); porApp[k] = (porApp[k] || 0) + 1; });
  const stNm = { aberta: 'aberta', corrigida: 'corrigida', descartada: 'descartada' }[E.si.st];
  $('siResumo').textContent = L.length
    ? plural(L.length, 'sinalização' + (stNm ? ' ' + stNm : ''), 'sinalizações' + (stNm ? ' ' + stNm.replace(/a$/, 'as') : '')) + (Object.keys(porApp).length > 1 ? ': ' + Object.entries(porApp).map(([k, n]) => k + ' ' + n).join(' · ') : '')
    : '';
  if (!L.length) {
    $('siLista').innerHTML = `<div class="card"><p class="vazio">${E.si.itens.length ? 'Nenhuma sinalização' + (stNm ? ' ' + stNm : '') + ' com esses filtros.' : 'Nenhuma sinalização recebida ainda.'}</p></div>`;
    return;
  }
  const mostra = L.slice(0, E.si.limite);
  $('siLista').innerHTML = mostra.map(itemSinal).join('') +
    (L.length > mostra.length ? `<div class="si-mais"><button class="btn btn-g" type="button" data-si="mais">Mostrar mais ${Math.min(30, L.length - mostra.length)} de ${inteiro(L.length - mostra.length)}</button></div>` : '');
}
function itemSinal(x) {
  const id = x.id, aberto = E.si.abertos.has(id), st = ST_SINAL[x.status] || { nm: x.status || '—', selo: '' };
  const q = String(x.q || '').trim();
  return `<article class="si-item${aberto ? ' aberto' : ''}" id="si-${esc(id)}" data-id="${esc(id)}">
    <button class="si-cab" type="button" data-si="abre" aria-expanded="${aberto}" aria-controls="si-c-${esc(id)}">
      <span class="si-l1"><span class="si-app" style="--c:${siCfg(x.app).c}">${esc(siNome(x))}</span>
        <span class="selo ${x.tipo === 'gabarito' ? 'err' : 'av'}">${esc(TIPO_CURTO[x.tipo] || x.tipo)}</span>
        <span class="selo ${st.selo}">${esc(st.nm)}</span>
        ${x.vezes > 1 ? `<span class="selo ac">${inteiro(x.vezes)} vezes</span>` : ''}
        <span class="si-quando">${esc(quando(x.em))}</span></span>
      <span class="si-qt">${esc(q || '(sem o começo do enunciado)')}</span>
      ${x.nota ? `<span class="si-nt"><i class="ti ti-message" aria-hidden="true"></i><span>${esc(x.nota)}</span></span>` : ''}
      <i class="ti ti-chevron-down si-chev" aria-hidden="true"></i>
    </button>
    <div class="si-corpo" id="si-c-${esc(id)}"${aberto ? '' : ' hidden'}>${aberto ? corpoSinal(x) : ''}</div>
  </article>`;
}
function corpoSinal(x) {
  const id = x.id, cfg = siCfg(x.app);
  const ficha = [
    ['App', siNome(x)], ['Tema', x.tema || '—'], ['Problema', TIPO_SINAL[x.tipo] || x.tipo || '—'],
    ['Sinalizada', x.vezes > 1 ? inteiro(x.vezes) + ' vezes' : '1 vez'],
    ['Primeira vez', quando(x.criada || x.em)], ['Última vez', quando(x.em)],
    ['Quem', x.email || (x.dispositivo ? 'aparelho sem conta (' + String(x.dispositivo).slice(0, 8) + '…)' : '—')],
    ['Situação', (ST_SINAL[x.status] || {}).nm || x.status || '—']
  ];
  if (x.tratadaEm) ficha.push(['Tratada em', quando(x.tratadaEm) + (x.tratadaPor ? ' por ' + x.tratadaPor : '')]);
  if (x.retiradaPeloUsuario) ficha.push(['Observação', 'a pessoa tirou a bandeira depois']);
  const Q = E.si.questao[id], IA = E.si.ia[id], P = E.si.pedido[id];
  const resp = E.si.rascunho[id] != null ? E.si.rascunho[id] : (x.resposta || '');
  const bts = [];
  if (x.status !== 'corrigida') bts.push(`<button class="btn btn-p" type="button" data-si="marca" data-st="corrigida"><i class="ti ti-check" aria-hidden="true"></i>Marcar como corrigida</button>`);
  if (x.status !== 'descartada') bts.push(`<button class="btn btn-g" type="button" data-si="marca" data-st="descartada"><i class="ti ti-x" aria-hidden="true"></i>Descartar</button>`);
  if (x.status !== 'aberta') bts.push(`<button class="btn btn-g" type="button" data-si="marca" data-st="aberta"><i class="ti ti-arrow-back-up" aria-hidden="true"></i>Reabrir</button>`);
  return `
    <dl class="ficha si-ficha">${ficha.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}
      <div class="largo"><dt>Chave da questão</dt><dd><code>${esc(x.chave || '—')}</code></dd></div>
      ${x.extra ? `<div class="largo"><dt>Extra enviado pelo app</dt><dd>${esc(x.extra)}</dd></div>` : ''}</dl>
    <div class="si-sec"><h4><i class="ti ti-message" aria-hidden="true"></i>Comentário do usuário</h4>
      ${x.nota ? `<p class="si-nota">${esc(x.nota)}</p>` : '<p class="sub">A pessoa não escreveu comentário.</p>'}</div>
    ${x.resposta && x.status !== 'aberta' ? `<div class="si-sec"><h4><i class="ti ti-circle-check" aria-hidden="true"></i>Resposta registrada</h4><p class="si-nota">${esc(x.resposta)}</p></div>` : ''}
    <div class="si-acoes" role="group" aria-label="Ferramentas da sinalização">
      <button class="btn btn-g" type="button" data-si="questao"${Q && Q.ok ? ' aria-pressed="true"' : ''}><i class="ti ti-file-text" aria-hidden="true"></i>${Q && Q.ok ? 'Questão carregada' : 'Ver a questão completa'}</button>
      <button class="btn btn-g" type="button" data-si="ia"><i class="ti ti-sparkles" aria-hidden="true"></i>${IA && IA.ok ? 'Analisar de novo com IA' : 'Analisar com IA'}</button>
      <button class="btn btn-g" type="button" data-si="pedido"><i class="ti ti-clipboard-text" aria-hidden="true"></i>Gerar pedido de correção</button>
    </div>
    <div class="si-out" data-out="questao" aria-live="polite">${Q ? Q.html : ''}</div>
    <div class="si-out" data-out="ia" aria-live="polite">${IA ? IA.html : ''}</div>
    <div class="si-out" data-out="pedido">${P ? P.html : ''}</div>
    <div data-out="resolver">${htmlResolver(x)}</div>
    <div class="si-out" data-out="editor">${E.si.editor[id] ? htmlEditor(x, E.si.editor[id]) : ''}</div>
    ${htmlResposta(x)}
    <div class="si-res">
      <div class="campo"><label for="si-r-${esc(id)}">O que foi feito (resposta curta)</label>
        <textarea id="si-r-${esc(id)}" data-si="resp" maxlength="600" spellcheck="true" placeholder="Ex.: gabarito trocado para C conforme ESC 2024; publicado na versão 179" aria-describedby="si-rh-${esc(id)}">${esc(resp)}</textarea>
        <span class="ajuda" id="si-rh-${esc(id)}">Anotação interna, só a administração vê. Até 600 caracteres. Para escrever ao usuário, use a resposta acima.</span></div>
      <div class="acoesL">${bts.join('')}</div>
    </div>
    <p class="leg">${cfg.base ? `<a href="${esc(cfg.base)}" target="_blank" rel="noopener">Abrir o ${esc(cfg.nm)}<span class="sr"> em nova aba</span></a> · ` : ''}id <code>${esc(id)}</code></p>`;
}
function itemPorId(id) { return E.si.itens.find(y => y.id === id); }
function repintaItem(id, focoSel) {
  const el = document.getElementById('si-' + id), x = itemPorId(id);
  if (!el || !x) return;
  el.outerHTML = itemSinal(x);
  if (focoSel) { const f = document.getElementById('si-' + id).querySelector(focoSel); if (f) f.focus({ preventScroll: true }); }
}
function repintaResolver(id) {
  const x = itemPorId(id), el = document.querySelector(`#si-${id} [data-out="resolver"]`);
  if (x && el && !el.contains(document.activeElement)) el.innerHTML = htmlResolver(x);
  else if (x && el) { const f = document.activeElement && document.activeElement.dataset.si; el.innerHTML = htmlResolver(x); const b = f && el.querySelector(`[data-si="${f}"]`); if (b) b.focus({ preventScroll: true }); }
}
function repintaSaida(id, qual, html) {
  const el = document.getElementById('si-' + id);
  const out = el && el.querySelector(`[data-out="${qual}"]`);
  if (out) out.innerHTML = html;
}

/* ---- questão completa ---- */
function htmlQuestao(x, r) {
  const cfg = siCfg(x.app);
  if (r.privado) return `<div class="aviso info"><i class="ti ti-lock" aria-hidden="true"></i><div><b>Banco privado: abra o app.</b> O RadioTítulo fica num repositório privado e o painel não lê o banco dele. Use o começo do enunciado e a chave acima para achar a questão no app ou no repositório.</div></div>`;
  if (r.erro) return `<div class="aviso err"><i class="ti ti-alert-triangle" aria-hidden="true"></i><div><b>Não consegui ler o banco do ${esc(cfg.nm)}.</b> ${esc(r.erro)} O que a sinalização já tem continua acima; o pedido de correção sai com esses dados.</div></div>`;
  if (r.nao) return `<div class="aviso"><i class="ti ti-search-off" aria-hidden="true"></i><div><b>Questão não encontrada no banco atual do ${esc(cfg.nm)}</b> (${plural(r.total, 'item lido', 'itens lidos')}). Nem a chave nem o começo do enunciado bateram: a questão pode ter sido editada ou retirada depois da sinalização. Se já foi corrigida, dá para marcar como corrigida.</div></div>`;
  const q = r.it;
  const selos = [`<span class="selo ${q.real ? 'ac' : ''}">${esc(q.proc)}</span>`];
  if (q.tipo === 'cartao') selos.push('<span class="selo">cartão de revisão</span>');
  if (q.anulada) selos.push('<span class="selo av">anulada</span>');
  selos.push(r.por === 'chave' ? '<span class="selo ok">achada pela chave</span>' : '<span class="selo av">achada pelo começo do enunciado</span>');
  const avisoTexto = r.por !== 'chave' ? `<p class="sub">A chave não bateu: o enunciado foi editado depois da sinalização${r.por === 'texto-varias' ? ' e há mais de uma questão com o mesmo começo (mostrando a primeira)' : ''}. Confira se é a mesma questão.</p>` : '';
  const alts = q.tipo === 'cartao'
    ? `<div class="si-bloco"><h5>Verso (resposta)</h5><p>${esc(q.verso)}</p></div>`
    : `<ol class="si-alts" aria-label="Alternativas">${q.alts.map(a => `<li class="${a.certa ? 'certa' : ''}"><span class="l" aria-hidden="true">${a.letra}</span>
        <div><p><span class="sr">${a.letra}) </span>${esc(a.txt)}${a.certa ? ' <span class="gab">gabarito</span>' : ''}</p>
        ${a.por ? `<p class="por">${esc(a.por)}</p>` : ''}${q.reordenada ? `<p class="pos">posição ${a.idx} no banco</p>` : ''}</div></li>`).join('')}</ol>
      <p class="leg">Letras na ordem em que o app mostra ao aluno${q.reordenada ? '; o app reordena as alternativas, por isso a posição no banco (de 0 a 4) vai junto' : ''}.${x.app === 'quiz-enare-farmacia' ? ' Nos simulados diários a correta pode trocar de lugar com outra alternativa.' : ''}</p>`;
  return `<div class="si-questao">
    <div class="si-sel">${selos.join('')}</div>${avisoTexto}
    <p class="si-enun">${esc(q.enunciado)}</p>
    ${q.img ? `<img class="si-img" src="${esc(q.img)}" alt="Figura da questão" loading="lazy">` : ''}
    ${alts}
    ${q.comentario ? `<div class="si-bloco"><h5>Comentário</h5><p>${esc(q.comentario)}</p></div>` : ''}
    ${q.base ? `<div class="si-bloco"><h5>${esc(q.baseRot || 'Base e fonte')}</h5><p>${esc(q.base)}</p></div>` : ''}
    ${q.extras && q.extras.length ? `<dl class="si-mini">${q.extras.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
  </div>`;
}
async function verQuestao(id) {
  const x = itemPorId(id); if (!x) return null;
  const cfg = SI_APP[x.app];
  if (E.si.questao[id] && E.si.questao[id].r) return E.si.questao[id].r;
  repintaSaida(id, 'questao', carregando(cfg && !cfg.privado ? 'Lendo o banco do ' + cfg.nm + (cfg.peso ? ' (' + cfg.peso + ', só na primeira vez)' : '') + '…' : 'Procurando a questão…'));
  let r;
  try { r = await achaQuestao(x); } catch (e) { r = { erro: (e && e.message) || String(e) }; }
  E.si.questao[id] = { r, ok: !!r.it, html: htmlQuestao(x, r) };
  repintaSaida(id, 'questao', E.si.questao[id].html);
  const b = document.querySelector(`#si-${id} [data-si="questao"]`);
  if (b && r.it) { b.setAttribute('aria-pressed', 'true'); b.innerHTML = '<i class="ti ti-file-text" aria-hidden="true"></i>Questão carregada'; }
  repintaResolver(id);
  return r;
}

/* ---- texto da questão para a IA e para o pedido ---- */
function textoQuestao(x, r) {
  const L = [];
  if (r && r.it) {
    const q = r.it;
    if (q.tipo === 'cartao') {
      L.push('Cartão de revisão (frente e verso).', 'Frente: ' + q.enunciado, 'Verso: ' + q.verso);
    } else {
      L.push('Enunciado: ' + q.enunciado);
      L.push(q.reordenada ? 'Alternativas (letra como o app mostra; entre colchetes a posição no banco, de 0 a 4):' : 'Alternativas:');
      q.alts.forEach(a => L.push(`${a.letra})${q.reordenada ? ' [' + a.idx + ']' : ''} ${a.txt}${a.por ? '\n   Comentário da alternativa: ' + a.por : ''}`));
      const g = q.alts.find(a => a.certa);
      L.push('Gabarito atual: ' + (q.anulada ? 'questão anulada' : g ? g.letra + (q.reordenada ? ' (posição ' + g.idx + ' no banco)' : '') : '—'));
    }
    if (q.comentario) L.push('Comentário atual: ' + q.comentario);
    if (q.base) L.push((q.baseRot || 'Base e fonte citadas') + ': ' + q.base);
    L.push('Procedência: ' + q.proc);
    (q.extras || []).forEach(([k, v]) => L.push(k + ': ' + v));
  } else {
    L.push('(A questão completa não pôde ser carregada. Só há o começo do enunciado guardado na sinalização.)');
    L.push('Começo do enunciado: ' + (x.q || '—'));
  }
  return L.join('\n');
}

/* ---- análise da IA (sugestão; o médico revisa) ---- */
function promptIA(x, r) {
  const cfg = siCfg(x.app);
  return `Você é um médico revisor de questões de um banco de estudo. App: ${cfg.nm} (${cfg.publico || 'estudo'}).
Um usuário sinalizou um problema nesta questão. Avalie com rigor técnico, como revisor sênior, usando a diretriz, norma ou referência VIGENTE que você conhece (hoje é ${new Date().toLocaleDateString('pt-BR')}). Não invente fonte nem ano: se não tiver certeza da versão vigente, diga isso no campo "conferir".

PROBLEMA RELATADO: ${TIPO_SINAL[x.tipo] || x.tipo}
COMENTÁRIO DO USUÁRIO: ${x.nota ? x.nota : '(sem comentário)'}
${x.extra ? 'INFORMAÇÃO DO APP: ' + x.extra + '\n' : ''}TEMA: ${x.tema || '—'}

QUESTÃO:
${textoQuestao(x, r)}

Responda APENAS com um objeto JSON válido, sem texto fora dele e sem markdown, neste formato:
{"razao":"sim" ou "nao" ou "em_parte","resumo":"uma ou duas frases","erro":"o que está errado na questão; escreva nada se estiver correta","correcao":{"enunciado":"texto novo ou vazio","alternativas":"quais alternativas mudam e como, ou vazio","gabarito":"letra correta na ordem do app e o porquê, ou vazio","comentario":"comentário corrigido, curto, ou vazio"},"novo":${r && r.it && r.it.tipo === 'cartao'
    ? '{"frente":"a frente do cartão inteira já corrigida, ou vazio se não muda","verso":"o verso inteiro já corrigido, ou vazio se não muda"}'
    : '{"enunciado":"o enunciado INTEIRO já corrigido, ou vazio se não muda","alternativas":["texto INTEIRO da A já corrigido","…da B","…"] na ordem das letras do app e sem a letra na frente, ou [] se nenhuma muda (se só uma muda, repita as outras como estão),"comentarios_alternativas":["comentário da A","…"] ou [] se não mudam,"gabarito":"só a letra correta na ordem do app, ou vazio se não muda","comentario":"o comentário INTEIRO já corrigido, ou vazio se não muda"}'},"fonte":"diretriz, norma ou referência vigente, com o ano","confianca":"alta" ou "media" ou "baixa","conferir":"o que o médico deve conferir antes de aplicar"}
O campo "novo" vira a correção aplicada no app depois da revisão do médico: escreva texto final, sem comentários entre parênteses, e deixe vazio o que estiver certo. Se o usuário não tiver razão, "novo" vai com tudo vazio.
Português do Brasil, frases curtas e diretas.`;
}
function lerJSON(txt) {
  const s = String(txt || '').replace(/```(?:json)?/gi, '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; }
}
const RAZAO = { sim: { t: 'Sim, o usuário tem razão', s: 'err' }, nao: { t: 'Não, a questão está certa', s: 'ok' }, em_parte: { t: 'Em parte', s: 'av' } };
const razaoDe = v => RAZAO[String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/[\s-]+/g, '_')];
function htmlIA(j, bruto, quandoIso) {
  const aviso = `<p class="si-iaaviso"><i class="ti ti-info-circle" aria-hidden="true"></i>Sugestão da IA, sem busca na internet, para o médico revisar. Confira a fonte e o ano antes de aplicar.</p>`;
  if (!j) return `<div class="si-ia">${aviso}<div class="si-bloco"><h5>Resposta da IA</h5><p>${esc(bruto || '(vazia)')}</p></div></div>`;
  const rz = razaoDe(j.razao) || { t: j.razao || '—', s: '' };
  const c = j.correcao || {};
  const corr = [['Enunciado', c.enunciado], ['Alternativas', c.alternativas], ['Gabarito', c.gabarito], ['Comentário', c.comentario]].filter(([, v]) => v && String(v).trim() && !/^(vazio|nada|-|—)$/i.test(String(v).trim()));
  return `<div class="si-ia">
    <div class="si-iatopo"><h4><i class="ti ti-sparkles" aria-hidden="true"></i>Análise da IA</h4><span class="si-quando">${esc(quando(quandoIso))}</span></div>
    ${aviso}
    <p class="si-ver"><span class="selo ${rz.s}">O usuário tem razão? ${esc(rz.t)}</span>${j.confianca ? ` <span class="selo">confiança ${esc(String(j.confianca).replace('media', 'média'))}</span>` : ''}</p>
    ${j.resumo ? `<p class="si-res-ia">${esc(j.resumo)}</p>` : ''}
    ${j.erro ? `<div class="si-bloco"><h5>O que está errado</h5><p>${esc(j.erro)}</p></div>` : ''}
    ${corr.length ? `<div class="si-bloco"><h5>Correção proposta</h5><dl class="si-mini">${corr.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></div>` : ''}
    ${j.fonte ? `<div class="si-bloco"><h5>Fonte vigente indicada</h5><p>${esc(j.fonte)}</p></div>` : ''}
    ${j.conferir ? `<div class="si-bloco"><h5>Conferir antes de aplicar</h5><p>${esc(j.conferir)}</p></div>` : ''}
  </div>`;
}
async function analisarIA(id, botao) {
  const x = itemPorId(id); if (!x) return;
  if (!window.MT || typeof MT.ai !== 'function') { toast('A IA não está disponível nesta página.', 'err'); return; }
  botao.disabled = true;
  repintaSaida(id, 'ia', carregando('Carregando a questão…'));
  try {
    const r = await verQuestao(id);
    repintaSaida(id, 'ia', carregando('A IA está analisando a questão (pode levar até 1 minuto)…'));
    const txt = await MT.ai(promptIA(x, r || {}), 'forte', { grounding: false, maxTokens: 8192, temperature: 0.2 });
    const j = lerJSON(txt);
    E.si.ia[id] = { ok: true, j, bruto: txt, em: new Date().toISOString() };
    E.si.ia[id].html = htmlIA(j, txt, E.si.ia[id].em);
    repintaSaida(id, 'ia', E.si.ia[id].html);
    E.si.pedido[id] = null; repintaSaida(id, 'pedido', '');
    botao.innerHTML = '<i class="ti ti-sparkles" aria-hidden="true"></i>Analisar de novo com IA';
    repintaResolver(id);
  } catch (e) {
    const msg = (e && e.message) || String(e);
    E.si.ia[id] = null;
    repintaSaida(id, 'ia', `<div class="aviso err"><i class="ti ti-alert-triangle" aria-hidden="true"></i><div><b>A IA não respondeu.</b> ${esc(msg)}</div></div>`);
  } finally { botao.disabled = false; }
}

/* ---- pedido de correção para colar na conversa com o Claude ---- */
function textoPedido(x) {
  const cfg = siCfg(x.app), Q = E.si.questao[x.id], r = Q && Q.r, IA = E.si.ia[x.id];
  const L = [];
  L.push(`Pedido de correção de questão sinalizada (painel da administração MedTech, ${new Date().toLocaleDateString('pt-BR')})`, '');
  L.push(`App: ${cfg.nm}`);
  L.push(`Repositório: ${cfg.repo || '—'}${cfg.base ? ' (no ar em medtechbr.com.br' + cfg.base + ')' : ''}`);
  if (cfg.onde) L.push(`Onde corrigir: ${cfg.onde}`);
  if (r && r.it && r.it.orig) L.push(`Atenção: esta questão foi importada do ${(SI_APP[r.it.orig] || {}).nm || r.it.orig}. Corrigir lá e reimportar no ${cfg.nm}.`);
  L.push(`Chave da questão: ${x.chave}${cfg.fmt === 'farmauti' ? ' (id do item)' : ' (hash do enunciado: mudar o enunciado muda a chave e solta o progresso dos alunos)'}`);
  L.push(`Sinalização: ${x.id} · ${x.status} · ${x.vezes > 1 ? x.vezes + ' vezes' : '1 vez'} · última em ${quando(x.em)}`);
  L.push(`Problema relatado: ${TIPO_SINAL[x.tipo] || x.tipo}`);
  L.push(`Comentário do usuário: ${x.nota ? x.nota.replace(/\s+/g, ' ') : '(sem comentário)'}`);
  if (x.tema) L.push(`Tema: ${x.tema}`);
  if (x.extra) L.push(`Extra enviado pelo app: ${x.extra}`);
  L.push('', 'Questão atual:');
  if (r && r.privado) L.push('(Banco privado: o painel não lê. Começo do enunciado: ' + (x.q || '—') + ')');
  else L.push(textoQuestao(x, r));
  if (r && r.it && r.por !== 'chave') L.push('(Achada pelo começo do enunciado: a chave da sinalização não bateu com a do banco atual.)');
  if (IA && IA.ok) {
    const j = IA.j;
    L.push('', 'Correção sugerida pela IA (sem busca na internet; conferir antes de aplicar):');
    if (j) {
      const rz = razaoDe(j.razao);
      L.push('O usuário tem razão? ' + (rz ? rz.t : (j.razao || '—')) + (j.confianca ? ' (confiança ' + j.confianca + ')' : ''));
      if (j.resumo) L.push('Resumo: ' + j.resumo);
      if (j.erro) L.push('O que está errado: ' + j.erro);
      const c = j.correcao || {};
      [['Enunciado', c.enunciado], ['Alternativas', c.alternativas], ['Gabarito', c.gabarito], ['Comentário', c.comentario]]
        .forEach(([k, v]) => { if (v && String(v).trim()) L.push(k + ': ' + v); });
      if (j.fonte) L.push('Fonte vigente indicada: ' + j.fonte);
      if (j.conferir) L.push('Conferir: ' + j.conferir);
    } else L.push(String(IA.bruto || '').trim());
  }
  L.push('', 'O que fazer:',
    '1. Confirmar na diretriz ou norma vigente (fonte e ano) se o usuário tem razão.',
    '2. Se tiver, corrigir no arquivo de origem do banco, sem mexer no enunciado quando o erro estiver só no gabarito, nas alternativas ou no comentário (para manter a chave).',
    '3. Rodar o montador e os validadores do app, subir a versão e publicar.',
    `4. Me dizer o que mudou, para eu marcar a sinalização ${x.id} como corrigida no painel.`);
  return L.join('\n');
}
async function copiar(txt) {
  try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(txt); return true; } } catch (e) {}
  const volta = document.activeElement;
  try {
    const ta = document.createElement('textarea');
    ta.value = txt; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove();
    if (volta && volta.focus) volta.focus({ preventScroll: true });
    return ok;
  } catch (e) { return false; }
}
async function gerarPedido(id, botao) {
  const x = itemPorId(id); if (!x) return;
  botao.disabled = true;
  try {
    if (!E.si.questao[id] || !E.si.questao[id].r) await verQuestao(id);
    const txt = textoPedido(x);
    const ok = await copiar(txt);
    const html = `<div class="si-pedido">
      <p class="aviso ${ok ? 'info' : ''}" role="status"><i class="ti ${ok ? 'ti-clipboard-check' : 'ti-clipboard-x'}" aria-hidden="true"></i><span>${ok ? 'Copiado. Cole na conversa com o Claude para aplicar a correção no app.' : 'O navegador não deixou copiar sozinho. Selecione o texto abaixo e copie.'}</span></p>
      <details${ok ? '' : ' open'}><summary>Ver o texto do pedido</summary>
        <label class="sr" for="si-p-${esc(id)}">Texto do pedido de correção</label>
        <textarea id="si-p-${esc(id)}" readonly>${esc(txt)}</textarea></details></div>`;
    E.si.pedido[id] = { html, txt };
    repintaSaida(id, 'pedido', html);
    if (ok) toast('Copiado. Cole na conversa com o Claude para aplicar a correção no app.', 'ok');
    else { const ta = document.getElementById('si-p-' + id); if (ta) { ta.focus(); ta.select(); } }
  } finally { botao.disabled = false; }
}

/* ============================================================
   ERRATAS E RESPOSTA (10/10/2026, pacote das Sinalizações): resolver a questão no próprio painel
   mtSinal {op:'errata', app, qid, tipo: corrige|oculta|restaura, dados?, motivo?, sinalId?, q?}
           {op:'listarErratas'} → {itens}      {op:'responder', sinalId, texto, status, resolucao}
   A errata vale pela chave da questão NO BANCO ATUAL (it.ch), que é a que o app usa. `dados` leva só o
   que muda em relação ao banco, na ordem do BANCO (alternativas[], porAlt[], gabarito = índice no banco).
   Os apps buscam as erratas ao abrir (mterrata.js) e aplicam antes de desenhar as questões.
   ============================================================ */
const APPS_ERRATA = ['clinicamed', 'cirurgiamed', 'flashmed', 'trafego-titulo', 'farmauti', 'quiz-enare-farmacia'];
const ehOpNova = e => /Operação desconhecida/i.test((e && e.message) || '');
const chaveErr = (app, qid) => app + '|' + qid;
const trechoTxt = (t, n) => { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
const ROT_CAMPO = { enunciado: 'Enunciado', alternativas: 'Alternativas', porAlt: 'Comentários das alternativas', gabarito: 'Gabarito', comentario: 'Comentário', verso: 'Verso' };
function errataDe(x, Q) {
  const r = Q && Q.r;
  const qid = r && r.it ? r.it.ch : x.chave;
  return E.si.erratas.get(chaveErr(x.app, qid)) || null;
}
async function carregarErratas() {
  try {
    const r = await chamar('mtSinal', { op: 'listarErratas' });
    E.si.erratas = new Map((r.itens || []).filter(e => e && e.ativa).map(e => [chaveErr(e.app, e.qid), e]));
    E.si.errNaoPublicado = false; E.si.errErro = '';
  } catch (e) {
    if (ehNegado(e)) throw e;
    if (ehOpNova(e)) E.si.errNaoPublicado = true; else E.si.errErro = (e && e.message) || String(e);
  }
  desenharErratas();
}

/* ---- valores de trabalho do editor (ordem da TELA, com o índice no banco junto) ---- */
function valoresDe(it, errata) {
  const v = {
    enunciado: it.enunciado || '', comentario: it.comentario || '', verso: it.verso || '',
    alts: it.alts.map(a => ({ letra: a.letra, idx: a.idx, txt: a.txt, por: a.por || '' })),
    gab: it.anulada ? -1 : ((it.alts.find(a => a.certa) || {}).idx ?? -1)
  };
  const d = errata && errata.tipo === 'corrige' && errata.dados;
  if (d) {
    if (typeof d.enunciado === 'string') v.enunciado = d.enunciado;
    if (typeof d.comentario === 'string') v.comentario = d.comentario;
    if (typeof d.verso === 'string') v.verso = d.verso;
    if (Array.isArray(d.alternativas)) v.alts.forEach(a => { if (typeof d.alternativas[a.idx] === 'string') a.txt = d.alternativas[a.idx]; });
    if (Array.isArray(d.porAlt)) v.alts.forEach(a => { if (typeof d.porAlt[a.idx] === 'string') a.por = d.porAlt[a.idx]; });
    if (Number.isInteger(d.gabarito)) v.gab = d.gabarito;
  }
  return v;
}
/* proposta estruturada da IA (campo "novo", letras na ordem da tela) sobre os valores atuais */
function valoresIA(base, j) {
  const n = j && j.novo; if (!n || typeof n !== 'object') return null;
  const v = JSON.parse(JSON.stringify(base));
  const cheio = s => typeof s === 'string' && s.trim() && !/^(vazio|nada|-|—|n\/a)$/i.test(s.trim());
  if (cheio(n.enunciado)) v.enunciado = n.enunciado.trim();
  if (cheio(n.frente)) v.enunciado = n.frente.trim();
  if (cheio(n.verso)) v.verso = n.verso.trim();
  if (cheio(n.comentario)) v.comentario = n.comentario.trim();
  if (Array.isArray(n.alternativas)) n.alternativas.forEach((t, p) => { if (v.alts[p] && cheio(t)) v.alts[p].txt = String(t).replace(/^\s*[A-E]\s*[).:-]\s+/, '').trim(); });
  if (Array.isArray(n.comentarios_alternativas)) n.comentarios_alternativas.forEach((t, p) => { if (v.alts[p] && cheio(t)) v.alts[p].por = String(t).trim(); });
  const L = String(n.gabarito || '').trim().toUpperCase().match(/^([A-E])\b/);
  if (L && v.alts[LETRAS.indexOf(L[1])]) v.gab = v.alts[LETRAS.indexOf(L[1])].idx;
  else if (/anulad/i.test(String(n.gabarito || ''))) v.gab = -1;
  return v;
}
/* o que mudou de `a` para `b` (mesmo formato de valores) */
function camposMudados(a, b, cartao) {
  const m = [];
  if (a.enunciado.trim() !== b.enunciado.trim()) m.push('enunciado');
  if (cartao) { if (a.verso.trim() !== b.verso.trim()) m.push('verso'); return m; }
  if (a.alts.some((x, i) => x.txt.trim() !== b.alts[i].txt.trim())) m.push('alternativas');
  if (a.alts.some((x, i) => x.por.trim() !== b.alts[i].por.trim())) m.push('porAlt');
  if (a.gab !== b.gab) m.push('gabarito');
  if (a.comentario.trim() !== b.comentario.trim()) m.push('comentario');
  return m;
}
/* `dados` da errata: o estado desejado em relação ao BANCO original, na ordem do banco */
function dadosDe(orig, novo, cartao) {
  const d = {};
  camposMudados(orig, novo, cartao).forEach(k => {
    if (k === 'enunciado') d.enunciado = novo.enunciado.trim();
    if (k === 'verso') d.verso = novo.verso.trim();
    if (k === 'comentario') d.comentario = novo.comentario.trim();
    if (k === 'gabarito') d.gabarito = novo.gab;
    if (k === 'alternativas' || k === 'porAlt') {
      const arr = []; novo.alts.forEach(a => { arr[a.idx] = (k === 'alternativas' ? a.txt : a.por).trim(); });
      d[k] = Array.from({ length: novo.alts.length }, (_, i) => arr[i] || '');
    }
  });
  return d;
}
const letraDoIdx = (v, idx) => idx === -1 ? 'anulada' : ((v.alts.find(a => a.idx === idx) || {}).letra || '?');

/* ---- antes/depois: diferença por palavra (LCS), com teto para textos longos ---- */
function difPalavras(a, b) {
  const A = String(a || '').split(/(\s+)/), B = String(b || '').split(/(\s+)/);
  if (A.length * B.length > 360000) return { antes: `<del>${esc(a)}</del>`, depois: `<ins>${esc(b)}</ins>` };
  const n = A.length, m = B.length, T = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) T[i][j] = A[i] === B[j] ? T[i + 1][j + 1] + 1 : Math.max(T[i + 1][j], T[i][j + 1]);
  let i = 0, j = 0, antes = '', depois = '';
  while (i < n && j < m) {
    if (A[i] === B[j]) { antes += esc(A[i]); depois += esc(B[j]); i++; j++; }
    else if (T[i + 1][j] >= T[i][j + 1]) { antes += `<del>${esc(A[i])}</del>`; i++; }
    else { depois += `<ins>${esc(B[j])}</ins>`; j++; }
  }
  while (i < n) antes += `<del>${esc(A[i++])}</del>`;
  while (j < m) depois += `<ins>${esc(B[j++])}</ins>`;
  return { antes, depois };
}
const textoDoIdx = (v, idx) => idx === -1 ? '' : trechoTxt((v.alts.find(a => a.idx === idx) || {}).txt, 90);
function htmlAntesDepois(atual, novo, cartao, reordena) {
  const m = camposMudados(atual, novo, cartao);
  if (!m.length) return '<p class="sub" role="status">Nada mudou em relação ao que o app mostra hoje.</p>';
  const linha = (rot, a, b) => { const d = difPalavras(a, b); return `<div class="si-dif"><h5>${esc(rot)}</h5><div class="ad"><p class="an"><span class="sr">Antes: </span>${d.antes || '<i>(vazio)</i>'}</p><p class="de"><span class="sr">Depois: </span>${d.depois || '<i>(vazio)</i>'}</p></div></div>`; };
  const L = [];
  if (m.includes('enunciado')) L.push(linha(cartao ? 'Frente' : 'Enunciado', atual.enunciado, novo.enunciado));
  if (m.includes('verso')) L.push(linha('Verso', atual.verso, novo.verso));
  if (m.includes('gabarito')) L.push(`<div class="si-dif"><h5>Gabarito</h5><div class="ad"><p class="an"><span class="sr">Antes: </span><del>${esc(letraDoIdx(atual, atual.gab))}</del>${atual.gab >= 0 ? ' · ' + esc(textoDoIdx(atual, atual.gab)) : ''}</p><p class="de"><span class="sr">Depois: </span><ins>${esc(reordena && novo.gab >= 0 ? 'a correta passa a ser' : letraDoIdx(novo, novo.gab))}</ins>${novo.gab >= 0 ? ' · ' + esc(textoDoIdx(novo, novo.gab)) : ''}</p></div>
    ${reordena && novo.gab >= 0 ? `<p class="sub">Nesta questão autoral o app sempre mostra a correta na letra ${esc(letraDoIdx(atual, atual.gab))} (a posição vem da chave): o texto da alternativa certa é que muda, e as outras mudam de letra.</p>` : ''}</div>`);
  novo.alts.forEach((a, i) => {
    if (a.txt.trim() !== atual.alts[i].txt.trim()) L.push(linha('Alternativa ' + a.letra, atual.alts[i].txt, a.txt));
    if (a.por.trim() !== atual.alts[i].por.trim()) L.push(linha('Comentário da alternativa ' + a.letra, atual.alts[i].por, a.por));
  });
  if (m.includes('comentario')) L.push(linha('Comentário', atual.comentario, novo.comentario));
  return `<p class="si-difleg"><span class="an">riscado = sai</span> <span class="de">grifado = entra</span></p>${L.join('')}`;
}

/* ---- editor ---- */
function htmlEditor(x, ed) {
  const id = x.id, v = ed.novo, cfg = siCfg(x.app), cartao = ed.cartao, p = 'si-e-' + id;
  const anul = cfg.fmt === 'enare';
  const temPor = cfg.fmt === 'padrao' || cfg.fmt === 'farmauti';
  const ta = (nome, rot, val, linhas, extra) => `<div class="campo"><label for="${p}-${nome}">${esc(rot)}</label><textarea id="${p}-${nome}" data-ed="${nome}" rows="${linhas || 3}" maxlength="${nome === 'comentario' ? 8000 : nome === 'enunciado' ? 6000 : 3000}" spellcheck="true"${extra || ''}>${esc(val)}</textarea></div>`;
  const alts = cartao ? '' : `<fieldset class="si-ed-alts"><legend>Alternativas, na ordem em que o app mostra${ed.reordena ? ' (nas autorais, a posição da correta na tela vem da chave: ao trocar o gabarito, a ordem das letras no app pode mudar)' : ''}. Marque a correta.</legend>
      ${v.alts.map((a, i) => `<div class="si-ed-alt">
        <label class="si-ed-gab"><input type="radio" name="${p}-gab" value="${a.idx}" data-ed="gab"${v.gab === a.idx ? ' checked' : ''}><span>${a.letra}<span class="sr">: correta</span></span></label>
        <div class="si-ed-txts">${ta('alt' + i, 'Alternativa ' + a.letra + (ed.reordena ? ' (posição ' + a.idx + ' no banco)' : ''), a.txt, 2)}
          ${temPor ? ta('por' + i, 'Comentário da alternativa ' + a.letra + ' (opcional)', a.por, 2) : ''}</div></div>`).join('')}
      ${anul ? `<label class="si-ed-anul"><input type="radio" name="${p}-gab" value="-1" data-ed="gab"${v.gab === -1 ? ' checked' : ''}> Questão anulada (sem gabarito)</label>` : ''}
    </fieldset>`;
  return `<div class="si-editor" role="group" aria-labelledby="${p}-tit">
    <div class="si-iatopo"><h4 id="${p}-tit"><i class="ti ${ed.modo === 'ia' ? 'ti-sparkles' : 'ti-pencil'}" aria-hidden="true"></i>${ed.modo === 'ia' ? 'Correção sugerida pela IA' : 'Corrigir a questão'}</h4>
      <span class="si-quando">${esc(cfg.nm)}</span></div>
    ${ed.modo === 'ia' ? '<p class="si-iaaviso"><i class="ti ti-info-circle" aria-hidden="true"></i>Campos já preenchidos com a sugestão da IA. Confira cada um na diretriz vigente antes de aplicar; dá para editar aqui.</p>' : '<p class="sub">Campos preenchidos com o que o app mostra hoje. Mude só o que está errado: o resto fica como está.</p>'}
    ${ta('enunciado', cartao ? 'Frente do cartão' : 'Enunciado', v.enunciado, cartao ? 3 : 6)}
    ${cartao ? ta('verso', 'Verso do cartão', v.verso, 4) : alts}
    ${cartao ? '' : ta('comentario', 'Comentário (explicação)', v.comentario, 5)}
    <div class="campo"><label for="${p}-motivo">Motivo (fica no registro da errata)</label><input id="${p}-motivo" data-ed="motivo" maxlength="600" value="${esc(ed.motivo || '')}" placeholder="Ex.: gabarito pela ESC 2024; alternativa C ambígua"></div>
    <div class="si-ad" aria-live="polite"><h4><i class="ti ti-arrows-diff" aria-hidden="true"></i>Antes e depois</h4><div data-ed-ad>${htmlAntesDepois(ed.atual, v, cartao, ed.reordena)}</div></div>
    <div class="acoesL"><button class="btn btn-p" type="button" data-si="edAplica"><i class="ti ti-check" aria-hidden="true"></i>Aplicar a correção no app</button>
      <button class="btn btn-g" type="button" data-si="edCancela">Cancelar</button></div>
  </div>`;
}
function leEditor(id) {
  const ed = E.si.editor[id], el = document.getElementById('si-' + id);
  if (!ed || !el) return null;
  const v = ed.novo, val = n => { const t = el.querySelector(`[data-ed="${n}"]`); return t ? t.value : null; };
  if (val('enunciado') != null) v.enunciado = val('enunciado');
  if (val('verso') != null) v.verso = val('verso');
  if (val('comentario') != null) v.comentario = val('comentario');
  v.alts.forEach((a, i) => { if (val('alt' + i) != null) a.txt = val('alt' + i); if (val('por' + i) != null) a.por = val('por' + i); });
  const g = el.querySelector('[data-ed="gab"]:checked'); if (g) v.gab = Number(g.value);
  ed.motivo = val('motivo') || '';
  return ed;
}
async function abrirEditor(id, modo, botao) {
  const x = itemPorId(id); if (!x) return;
  if (botao) botao.disabled = true;
  try {
    const r = await verQuestao(id);
    if (!r || !r.it) { toast('Carregue a questão primeiro: o painel não achou a questão no banco do app.', 'err'); return; }
    const it = r.it, cartao = it.tipo === 'cartao', er = errataDe(x, E.si.questao[id]);
    const orig = valoresDe(it, null), atual = valoresDe(it, er);
    let novo = JSON.parse(JSON.stringify(atual));
    if (modo === 'ia') {
      const IA = E.si.ia[id]; novo = IA && IA.ok ? valoresIA(atual, IA.j) : null;
      if (!novo || !camposMudados(atual, novo, cartao).length) { toast('A análise da IA não trouxe uma correção para aplicar. Use "Corrigir eu mesmo".', 'err'); return; }
    }
    E.si.editor[id] = { modo, it, cartao, orig, atual, novo, motivo: modo === 'ia' && E.si.ia[id].j && E.si.ia[id].j.fonte ? String(E.si.ia[id].j.fonte).slice(0, 600) : '', reordena: !!siCfg(x.app).reordena && !it.real && it.alts.length === 5 };
    E.si.editor[id].html = htmlEditor(x, E.si.editor[id]);
    repintaSaida(id, 'editor', E.si.editor[id].html);
    const f = document.querySelector(`#si-${id} [data-out="editor"] textarea`); if (f) f.focus();
  } finally { if (botao) botao.disabled = false; }
}
function atualizaAntesDepois(id) {
  const ed = leEditor(id); if (!ed) return;
  const alvo = document.querySelector(`#si-${id} [data-ed-ad]`);
  if (alvo) alvo.innerHTML = htmlAntesDepois(ed.atual, ed.novo, ed.cartao, ed.reordena);
}
function fechaEditor(id) { delete E.si.editor[id]; repintaSaida(id, 'editor', ''); }

async function aplicarEditor(id) {
  const x = itemPorId(id), ed = leEditor(id); if (!x || !ed) return;
  const cfg = siCfg(x.app);
  const mudou = camposMudados(ed.atual, ed.novo, ed.cartao);
  if (!mudou.length) { toast('Nada mudou em relação ao que o app mostra hoje.', 'err'); return; }
  if (!ed.cartao && ed.novo.alts.some(a => !a.txt.trim())) { toast('Há alternativa em branco.', 'err'); return; }
  if (!ed.novo.enunciado.trim()) { toast('O enunciado ficou em branco.', 'err'); return; }
  const dados = dadosDe(ed.orig, ed.novo, ed.cartao);
  const voltaAoBanco = !Object.keys(dados).length;
  const lista = mudou.map(k => k === 'gabarito' ? (ed.reordena && ed.novo.gab >= 0 ? `Gabarito: a correta passa a ser "${textoDoIdx(ed.novo, ed.novo.gab)}"` : `Gabarito: ${letraDoIdx(ed.atual, ed.atual.gab)} → ${letraDoIdx(ed.novo, ed.novo.gab)}`) : (ed.cartao && k === 'enunciado' ? 'Frente' : ROT_CAMPO[k]));
  const ok = await confirmar(voltaAoBanco ? 'Voltar a questão ao original?' : `Aplicar a correção no ${cfg.nm}?`,
    voltaAoBanco ? `Do jeito que ficou, a questão é igual à do banco do ${esc(cfg.nm)}: a errata atual será desfeita.`
      : `Muda: <b>${esc(lista.join('; '))}</b>.</p><p>Vale para todos os usuários do ${esc(cfg.nm)} quando abrirem o app (em até alguns minutos). Ninguém perde progresso; respostas antigas passam a ser conferidas pelo gabarito novo. Dá para desfazer em "Erratas ativas".`,
    voltaAoBanco ? 'Desfazer a errata' : 'Aplicar a correção');
  if (!ok) return;
  await gravarErrata(x, voltaAoBanco ? 'restaura' : 'corrige', voltaAoBanco ? null : dados, ed.motivo, ed.it);
}
async function gravarErrata(x, tipo, dados, motivo, it) {
  const id = x.id, cfg = siCfg(x.app);
  const qid = it ? it.ch : x.chave;
  try {
    const r = await chamar('mtSinal', Object.assign({ op: 'errata', app: x.app, qid, tipo, motivo: motivo || '', q: trechoTxt(it ? it.enunciado : x.q, 200) },
      dados ? { dados } : {}, tipo !== 'restaura' ? { sinalId: id } : {}));
    const k = chaveErr(x.app, qid), agora = new Date().toISOString();
    if (tipo === 'restaura') E.si.erratas.delete(k);
    else E.si.erratas.set(k, Object.assign({}, E.si.erratas.get(k) || {}, { app: x.app, appNome: cfg.nm, qid, tipo, ativa: true, em: r.em || agora, atualizada: r.em || agora,
      por: (MT.user && MT.user.email) || '', motivo: motivo || '', sinalId: id, q: trechoTxt(it ? it.enunciado : x.q, 200) }, dados ? { dados } : {}));
    if (tipo !== 'restaura') {
      Object.assign(x, { status: 'corrigida', resolucao: tipo, tratadaEm: agora, tratadaPor: (MT.user && MT.user.email) || '' });
      /* o servidor anota o que mudou quando a sinalização ainda não tinha anotação: espelha aqui */
      if (!x.resposta) x.resposta = (dados ? 'Corrigido: ' + Object.keys(dados).map(k => (ROT_CAMPO[k] || k).toLowerCase()).join(', ') + '.' : 'Questão retirada do ar.') + (motivo ? ' ' + motivo : '');
    }
    delete E.si.editor[id];
    /* a resposta ao usuário já sai com o modelo da resolução */
    E.si.modelo[id] = tipo === 'oculta' ? 'retirada' : tipo === 'corrige' ? 'corrigida' : E.si.modelo[id];
    if (tipo !== 'restaura') E.si.resp[id] = modeloResposta(x, E.si.modelo[id]);
    desenharErratas();
    E.si.fixos.add(id);
    repintaItem(id);
    atualizaContadorSinal();
    toast(tipo === 'corrige' ? 'Correção aplicada. Agora responda a quem sinalizou.' : tipo === 'oculta' ? 'Questão tirada do ar. Agora responda a quem sinalizou.' : 'Errata desfeita: a questão voltou a ser a do banco.', 'ok');
    const alvo = document.getElementById('si-u-' + id) || document.querySelector(`#si-${id} .si-cab`);
    if (alvo) { alvo.focus({ preventScroll: false }); }
    return true;
  } catch (e) {
    if (ehNegado(e)) { bloquear(e.message); return false; }
    if (ehOpNova(e)) { toast('Publique o servidor para corrigir pelo painel (deploy-backend.command).', 'err'); return false; }
    toast('Não gravou: ' + ((e && e.message) || e), 'err');
    return false;
  }
}
function pedeMotivo(titulo, texto, rotOk, perigo) {
  return new Promise(res => {
    let val = null;
    const d = dialogo(titulo, `<p>${texto}</p><div class="campo"><label for="dlgMotivo">Motivo (fica no registro)</label><input id="dlgMotivo" maxlength="600" placeholder="Ex.: duas alternativas corretas; diretriz mudou"></div>`, [
      { rot: 'Cancelar', cls: 'btn-g' },
      { rot: rotOk, cls: perigo ? 'btn-dn' : 'btn-p', acao: () => { val = ($('dlgMotivo').value || '').trim(); } }
    ]);
    d.addEventListener('close', () => res(val), { once: true });
  });
}
async function ocultarQuestao(id, botao) {
  const x = itemPorId(id); if (!x) return;
  botao.disabled = true;
  try {
    const r = await verQuestao(id);
    if (!r || !r.it) { toast('O painel não achou a questão no banco do app: não dá para tirar do ar por aqui.', 'err'); return; }
    const cfg = siCfg(x.app);
    const motivo = await pedeMotivo('Tirar a questão do ar?', `A questão some das listas, simulados, sorteios e contagens do <b>${esc(cfg.nm)}</b> para todos os usuários, quando abrirem o app. As respostas que as pessoas já deram ficam guardadas. Dá para devolver ao ar depois, em "Erratas ativas".`, 'Tirar do ar', true);
    if (motivo === null) return;
    await gravarErrata(x, 'oculta', null, motivo, r.it);
  } finally { if (botao.isConnected) botao.disabled = false; }
}
async function desfazerErrata(app, qid, botao) {
  const e = E.si.erratas.get(chaveErr(app, qid)); if (!e) return;
  const cfg = siCfg(app);
  const ok = await confirmar(e.tipo === 'oculta' ? 'Devolver a questão ao ar?' : 'Desfazer a correção?',
    `A questão volta a ser exatamente a do banco do ${esc(cfg.nm)}${e.tipo === 'oculta' ? ' e reaparece para todos' : ''}, quando os usuários abrirem o app.`,
    e.tipo === 'oculta' ? 'Devolver ao ar' : 'Desfazer a correção');
  if (!ok) return;
  if (botao) botao.disabled = true;
  try {
    await chamar('mtSinal', { op: 'errata', app, qid, tipo: 'restaura' });
    E.si.erratas.delete(chaveErr(app, qid));
    desenharErratas();
    E.si.itens.filter(x => x.app === app && E.si.abertos.has(x.id)).forEach(x => repintaItem(x.id));
    toast(e.tipo === 'oculta' ? 'Questão devolvida ao ar.' : 'Correção desfeita.', 'ok');
  } catch (er) {
    if (ehNegado(er)) { bloquear(er.message); return; }
    toast('Não gravou: ' + ((er && er.message) || er), 'err');
  } finally { if (botao && botao.isConnected) botao.disabled = false; }
}

/* ---- lista "Erratas ativas" ---- */
function desenharErratas() {
  const n = E.si.erratas.size, el = $('siErrLista'), cnt = $('siErrN');
  if (!el) return;
  cnt.textContent = E.si.errNaoPublicado ? '' : inteiro(n);
  if (E.si.errNaoPublicado) { el.innerHTML = avisoPublicar('as erratas'); return; }
  if (E.si.errErro) { el.innerHTML = avisoErro(E.si.errErro); return; }
  if (!n) { el.innerHTML = '<p class="vazio">Nenhuma questão corrigida ou fora do ar pelo painel.</p>'; return; }
  const porApp = {};
  [...E.si.erratas.values()].sort((a, b) => String(b.atualizada || b.em || '').localeCompare(String(a.atualizada || a.em || ''))).forEach(e => (porApp[e.app] = porApp[e.app] || []).push(e));
  el.innerHTML = Object.keys(porApp).map(app => `<div class="si-errapp"><h4><span class="si-app" style="--c:${siCfg(app).c}">${esc(siCfg(app).nm || app)}</span> <span class="sub">${plural(porApp[app].length, 'errata', 'erratas')}</span></h4>
    <ul class="si-errl">${porApp[app].map(e => `<li>
      <div class="si-errtx"><p><span class="selo ${e.tipo === 'oculta' ? 'err' : 'ok'}">${e.tipo === 'oculta' ? 'fora do ar' : 'corrigida'}</span> ${esc(e.q || 'questão ' + e.qid)}</p>
        <p class="sub">${esc(quando(e.atualizada || e.em))}${e.por ? ' · ' + esc(e.por) : ''}${e.dados ? ' · mudou: ' + esc(Object.keys(e.dados).map(k => ROT_CAMPO[k] || k).join(', ').toLowerCase()) : ''}${e.motivo ? ' · ' + esc(e.motivo) : ''} · chave <code>${esc(e.qid)}</code></p></div>
      <button class="btn btn-g sm" type="button" data-err-desfaz="${esc(app)}" data-qid="${esc(e.qid)}"><i class="ti ti-arrow-back-up" aria-hidden="true"></i>${e.tipo === 'oculta' ? 'Devolver ao ar' : 'Desfazer'}<span class="sr"> a errata de ${esc(trechoTxt(e.q || e.qid, 50))}</span></button></li>`).join('')}</ul></div>`).join('');
}

/* ---- resposta ao usuário ---- */
const MODELOS = { corrigida: 'Corrigida', retirada: 'Retirada do ar', correta: 'Está correta' };
function modeloResposta(x, modelo) {
  const nm = siNome(x), tr = trechoTxt(String(x.q || '').replace(/…\s*$/, ''), 70);
  const cab = `Olá! Obrigado por sinalizar a questão "${tr}" do ${nm}.`;
  if (modelo === 'retirada') return `${cab} Você tinha razão: a questão tinha um problema e saiu do ar até ser revista. As suas respostas continuam guardadas.\n\nEquipe MedTech`;
  if (modelo === 'correta') {
    const IA = E.si.ia[x.id], j = IA && IA.ok && IA.j;
    const pq = j && razaoDe(j.razao) === RAZAO.nao && j.resumo ? ' ' + String(j.resumo).trim() : '';
    return `${cab} Revisamos com cuidado e a questão está correta.${pq}\n\nContinue sinalizando o que parecer errado: isso melhora o banco para todo mundo.\n\nEquipe MedTech`;
  }
  const Q = E.si.questao[x.id], e = errataDe(x, Q), d = e && e.tipo === 'corrige' ? e.dados : null;
  const partes = [];
  if (d) {
    if ('gabarito' in d) {
      const it = Q && Q.r && Q.r.it, txt = d.gabarito === -1 ? '' : (Array.isArray(d.alternativas) && d.alternativas[d.gabarito]) || (it && (it.alts.find(a => a.idx === d.gabarito) || {}).txt) || '';
      partes.push(d.gabarito === -1 ? 'a questão foi anulada' : `corrigimos o gabarito: a resposta certa é "${trechoTxt(txt, 80)}"`);
    }
    if ('enunciado' in d) partes.push('ajustamos o enunciado');
    if ('alternativas' in d) partes.push('ajustamos as alternativas');
    if ('comentario' in d || 'porAlt' in d) partes.push('atualizamos a explicação');
    if ('verso' in d) partes.push('corrigimos o verso do cartão');
  }
  const mud = partes.length ? partes.length > 1 ? partes.slice(0, -1).join(', ') + ' e ' + partes[partes.length - 1] : partes[0] : 'corrigimos a questão';
  return `${cab} Você tinha razão: ${mud}. A correção já aparece no app${d && 'gabarito' in d ? ', e as respostas que você já deu são conferidas pelo gabarito novo' : ''}.\n\nEquipe MedTech`;
}
function modeloPadrao(x) {
  const e = errataDe(x, E.si.questao[x.id]);
  if (e) return e.tipo === 'oculta' ? 'retirada' : 'corrigida';
  if (x.resolucao === 'oculta') return 'retirada';
  if (x.status === 'descartada') return 'correta';
  const IA = E.si.ia[x.id];
  if (IA && IA.ok && IA.j && razaoDe(IA.j.razao) === RAZAO.nao) return 'correta';
  return 'corrigida';
}
function mailtoDe(x, texto) {
  const assunto = `Sua sinalização no ${siNome(x)}`;
  return 'mailto:' + encodeURIComponent(x.email) + '?subject=' + encodeURIComponent(assunto) + '&body=' + encodeURIComponent(texto);
}
function htmlResposta(x) {
  const id = x.id, mod = E.si.modelo[id] || (E.si.modelo[id] = modeloPadrao(x));
  const txt = E.si.resp[id] != null ? E.si.resp[id] : (E.si.resp[id] = modeloResposta(x, mod));
  const noApp = !!(x.uid || x.dispositivo), hist = Array.isArray(x.respostas) ? x.respostas : [];
  const quem = x.uid ? 'Quem sinalizou tem conta: a resposta aparece num aviso quando abrir o app.' : x.dispositivo ? 'Quem sinalizou usou um aparelho sem conta: a resposta aparece nesse aparelho quando abrir o app.' : 'Não há como entregar no app.';
  return `<div class="si-resp" role="group" aria-labelledby="si-uh-${esc(id)}">
    <h4 id="si-uh-${esc(id)}"><i class="ti ti-message-reply" aria-hidden="true"></i>Resposta para o usuário</h4>
    <div class="chips" role="group" aria-label="Modelo da resposta">${Object.entries(MODELOS).map(([k, r]) => `<button class="chip" type="button" data-si="modelo" data-mod="${k}" aria-pressed="${mod === k}">${esc(r)}</button>`).join('')}</div>
    <div class="campo"><label for="si-u-${esc(id)}">Texto (o usuário vê exatamente isto)</label>
      <textarea id="si-u-${esc(id)}" data-si="utxt" maxlength="1200" rows="6" spellcheck="true" aria-describedby="si-uq-${esc(id)}">${esc(txt)}</textarea>
      <span class="ajuda" id="si-uq-${esc(id)}">${esc(quem)} Até 1.200 caracteres.</span></div>
    <div class="acoesL">
      ${noApp ? `<button class="btn btn-p" type="button" data-si="enviaApp"><i class="ti ti-send" aria-hidden="true"></i>Enviar no app</button>` : ''}
      ${x.email ? `<a class="btn btn-g" data-si="email" href="${esc(mailtoDe(x, txt))}"><i class="ti ti-mail" aria-hidden="true"></i>Responder por e-mail</a>` : ''}
    </div>
    ${hist.length ? `<div class="si-hist"><h5>Respostas enviadas</h5><ul>${hist.slice().reverse().map(h => `<li><span class="si-quando">${esc(quando(h.em))}${h.por ? ' · ' + esc(h.por) : ''} · ${h.entrega === 'app' ? 'entregue no app' : 'só registrada'}</span><p>${esc(h.texto)}</p></li>`).join('')}</ul></div>` : ''}
  </div>`;
}
async function enviarResposta(id, botao) {
  const x = itemPorId(id); if (!x) return;
  const ta = document.getElementById('si-u-' + id), texto = (ta ? ta.value : '').trim();
  if (!texto) { toast('Escreva a resposta antes de enviar.', 'err'); if (ta) ta.focus(); return; }
  const mod = E.si.modelo[id] || 'corrigida';
  const ok = await confirmar('Enviar a resposta no app?', `A pessoa vê este texto num aviso no ${esc(siNome(x))} na próxima vez que abrir o app, e a sinalização fica como <b>${mod === 'correta' ? 'descartada (questão correta)' : 'corrigida'}</b>.`, 'Enviar no app');
  if (!ok) return;
  botao.disabled = true;
  try {
    const status = mod === 'correta' ? 'descartada' : 'corrigida';
    const resolucao = mod === 'correta' ? 'sem-alteracao' : mod === 'retirada' ? 'oculta' : (x.resolucao || 'corrige');
    const r = await chamar('mtSinal', { op: 'responder', sinalId: id, texto, status, resolucao });
    const agora = new Date().toISOString(), por = (MT.user && MT.user.email) || '';
    x.respostas = (Array.isArray(x.respostas) ? x.respostas : []).concat([{ texto, em: agora, por, entrega: r && r.entregue ? 'app' : 'nenhuma' }]);
    Object.assign(x, { status, resolucao, tratadaEm: agora, tratadaPor: por, resposta: texto.slice(0, 600) });
    delete E.si.resp[id];
    E.si.fixos.add(id);
    repintaItem(id);
    atualizaContadorSinal();
    toast(r && r.entregue ? 'Resposta enviada: aparece no app de quem sinalizou.' : 'Resposta registrada (sem como entregar no app).', 'ok');
    const b = document.querySelector(`#si-${id} .si-cab`); if (b) b.focus({ preventScroll: true });
  } catch (e) {
    if (ehNegado(e)) { bloquear(e.message); return; }
    if (ehOpNova(e)) { toast('Publique o servidor para responder pelo app (deploy-backend.command).', 'err'); return; }
    toast('Não enviou: ' + ((e && e.message) || e), 'err');
  } finally { if (botao.isConnected) botao.disabled = false; }
}

/* ---- bloco "Resolver no app" de cada sinalização ---- */
function htmlResolver(x) {
  const id = x.id, cfg = SI_APP[x.app] || {}, Q = E.si.questao[id], IA = E.si.ia[id];
  if (!APPS_ERRATA.includes(x.app)) return `<div class="si-resolver"><h4><i class="ti ti-tool" aria-hidden="true"></i>Resolver no app</h4><p class="sub">O ${esc(siNome(x))} ainda não recebe correções pelo painel. Use o pedido de correção.</p></div>`;
  if (E.si.errNaoPublicado) return `<div class="si-resolver"><h4><i class="ti ti-tool" aria-hidden="true"></i>Resolver no app</h4>${avisoPublicar('corrigir, tirar do ar e responder pelo painel')}</div>`;
  const e = errataDe(x, Q);
  const naoAchou = Q && Q.r && !Q.r.it;
  const temIA = IA && IA.ok && IA.j && IA.j.novo;
  const iaUtil = (() => {
    if (!temIA || !Q || !Q.r || !Q.r.it) return false;
    const atual = valoresDe(Q.r.it, e), v = valoresIA(atual, IA.j);
    return !!(v && camposMudados(atual, v, Q.r.it.tipo === 'cartao').length);
  })();
  const dicaIA = !IA || !IA.ok ? 'Peça a análise da IA primeiro.' : !temIA ? 'Esta análise não trouxe a correção estruturada: analise de novo.'
    : !iaUtil ? (e && e.tipo === 'corrige' ? 'A correção da IA já está aplicada.' : 'A IA não propôs mudança na questão.') : '';
  return `<div class="si-resolver" role="group" aria-labelledby="si-rv-${esc(id)}">
    <h4 id="si-rv-${esc(id)}"><i class="ti ti-tool" aria-hidden="true"></i>Resolver no app</h4>
    ${e ? `<div class="aviso ${e.tipo === 'oculta' ? 'err' : 'info'}"><i class="ti ${e.tipo === 'oculta' ? 'ti-eye-off' : 'ti-circle-check'}" aria-hidden="true"></i><div><b>${e.tipo === 'oculta' ? 'Esta questão está fora do ar' : 'Esta questão tem correção aplicada'}</b> desde ${esc(quando(e.atualizada || e.em))}${e.dados ? ' (' + esc(Object.keys(e.dados).map(k => ROT_CAMPO[k] || k).join(', ').toLowerCase()) + ')' : ''}.
      <button class="btn btn-g sm" type="button" data-err-desfaz="${esc(x.app)}" data-qid="${esc(e.qid)}"><i class="ti ti-arrow-back-up" aria-hidden="true"></i>${e.tipo === 'oculta' ? 'Devolver ao ar' : 'Desfazer a correção'}</button></div></div>` : ''}
    ${naoAchou ? '<p class="sub">A questão não foi achada no banco atual do app: corrigir ou tirar do ar por aqui não é possível. Use o pedido de correção.</p>' : ''}
    <div class="si-acoes">
      <button class="btn btn-g" type="button" data-si="corrIA"${iaUtil ? '' : ' aria-disabled="true"'} aria-describedby="si-rvd-${esc(id)}"><i class="ti ti-wand" aria-hidden="true"></i>Aplicar a correção da IA</button>
      <button class="btn btn-g" type="button" data-si="corrMao"${naoAchou ? ' disabled' : ''}><i class="ti ti-pencil" aria-hidden="true"></i>Corrigir eu mesmo</button>
      ${e && e.tipo === 'oculta' ? '' : `<button class="btn btn-dn" type="button" data-si="oculta"${naoAchou ? ' disabled' : ''}><i class="ti ti-eye-off" aria-hidden="true"></i>Tirar a questão do ar</button>`}
    </div>
    <p class="ajuda" id="si-rvd-${esc(id)}">${esc(dicaIA || 'A IA preenche o editor; você confere o antes e depois e aplica.')}</p>
  </div>`;
}

/* ---- dar baixa ---- */
async function marcarSinal(id, status, botao) {
  const x = itemPorId(id); if (!x) return;
  const ta = document.getElementById('si-r-' + id);
  const resposta = (ta ? ta.value : (x.resposta || '')).trim().slice(0, 600);
  const art = document.getElementById('si-' + id);
  art.querySelectorAll('.si-res button').forEach(b => b.disabled = true);
  try {
    await chamar('mtSinal', { op: 'marcar', id, status, resposta });
    Object.assign(x, { status, resposta, tratadaEm: new Date().toISOString(), tratadaPor: (MT.user && MT.user.email) || '' });
    delete E.si.rascunho[id];
    const ROT = { corrigida: 'Marcada como corrigida.', descartada: 'Sinalização descartada.', aberta: 'Sinalização reaberta.' };
    const L0 = filtradosSinal().slice(0, E.si.limite).map(y => y.id);
    const sai = E.si.st && E.si.st !== status;
    let proximo = null;
    if (sai) { const i = L0.indexOf(id); proximo = L0[i + 1] || L0[i - 1] || null; E.si.abertos.delete(id); }
    desenharSinal();
    toast(ROT[status] + (sai ? ' Saiu desta lista.' : ''), 'ok');
    if (sai) {
      const alvo = proximo && document.querySelector(`#si-${proximo} .si-cab`);
      if (alvo) alvo.focus({ preventScroll: false }); else { $('h-si').setAttribute('tabindex', '-1'); $('h-si').focus(); }
    } else {
      const b = document.querySelector(`#si-${id} .si-cab`); if (b) b.focus({ preventScroll: true });
    }
  } catch (e) {
    if (ehNegado(e)) { bloquear(e.message); return; }
    toast('Não gravou: ' + ((e && e.message) || e), 'err');
    art.querySelectorAll('.si-res button').forEach(b => b.disabled = false);
  }
}

/* ---- eventos (delegados: a lista é redesenhada a cada filtro) ---- */
$('siLista').addEventListener('click', ev => {
  const bd = ev.target.closest('[data-err-desfaz]');
  if (bd) { desfazerErrata(bd.dataset.errDesfaz, bd.dataset.qid, bd); return; }
  const b = ev.target.closest('[data-si]'); if (!b || b.tagName === 'TEXTAREA') return;
  if (b.dataset.si === 'email') return;   /* o link mailto segue o caminho normal */
  const art = b.closest('.si-item'), id = art && art.dataset.id, ac = b.dataset.si;
  if (ac === 'mais') { E.si.limite += 30; desenharSinal(); return; }
  if (!id) return;
  if (ac === 'abre') {
    if (E.si.abertos.has(id)) E.si.abertos.delete(id); else E.si.abertos.add(id);
    repintaItem(id, '.si-cab');
    return;
  }
  if (ac === 'questao') verQuestao(id);
  if (ac === 'corrIA') {
    if (b.getAttribute('aria-disabled') === 'true') { const d = document.getElementById('si-rvd-' + id); toast((d && d.textContent) || 'Peça a análise da IA primeiro.', 'err'); return; }
    abrirEditor(id, 'ia', b);
  }
  if (ac === 'corrMao') abrirEditor(id, 'mao', b);
  if (ac === 'oculta') ocultarQuestao(id, b);
  if (ac === 'edAplica') aplicarEditor(id);
  if (ac === 'edCancela') { fechaEditor(id); const f = document.querySelector(`#si-${id} [data-si="corrMao"]`); if (f) f.focus(); }
  if (ac === 'enviaApp') enviarResposta(id, b);
  if (ac === 'modelo') {
    const x = itemPorId(id); E.si.modelo[id] = b.dataset.mod; E.si.resp[id] = modeloResposta(x, b.dataset.mod);
    const ta = document.getElementById('si-u-' + id); if (ta) ta.value = E.si.resp[id];
    b.parentNode.querySelectorAll('[data-mod]').forEach(c => c.setAttribute('aria-pressed', String(c === b)));
    const m = document.querySelector(`#si-${id} [data-si="email"]`); if (m) m.href = mailtoDe(x, E.si.resp[id]);
  }
  if (ac === 'ia') analisarIA(id, b);
  if (ac === 'pedido') gerarPedido(id, b);
  if (ac === 'marca') marcarSinal(id, b.dataset.st, b);
});
let tAD = 0;
$('siLista').addEventListener('input', ev => {
  const t = ev.target, art = t.closest('.si-item'); if (!art) return;
  const id = art.dataset.id;
  if (t.dataset.si === 'resp') E.si.rascunho[id] = t.value;
  if (t.dataset.si === 'utxt') {
    E.si.resp[id] = t.value;
    const x = itemPorId(id), m = art.querySelector('[data-si="email"]'); if (x && m) m.href = mailtoDe(x, t.value);
  }
  if (t.dataset.ed) { clearTimeout(tAD); tAD = setTimeout(() => atualizaAntesDepois(id), 250); }
});
$('siLista').addEventListener('change', ev => { const t = ev.target, art = t.closest('.si-item'); if (art && t.dataset.ed === 'gab') atualizaAntesDepois(art.dataset.id); });
$('siErrLista').addEventListener('click', ev => {
  const bd = ev.target.closest('[data-err-desfaz]'); if (bd) desfazerErrata(bd.dataset.errDesfaz, bd.dataset.qid, bd);
});
$('siSituacao').querySelectorAll('[data-sist]').forEach(b => b.addEventListener('click', () => { E.si.st = b.dataset.sist; E.si.limite = 30; E.si.fixos.clear(); desenharSinal(); }));
$('siApp').addEventListener('change', () => { E.si.app = $('siApp').value; E.si.limite = 30; E.si.fixos.clear(); desenharSinal(); });
let tBuscaSi = 0;
$('siBusca').addEventListener('input', () => { clearTimeout(tBuscaSi); tBuscaSi = setTimeout(() => { E.si.busca = $('siBusca').value; E.si.limite = 30; E.si.fixos.clear(); desenharSinal(); }, 200); });
$('btSi').onclick = () => { E.si.fixos.clear(); carregarSinal(); };

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
  E.us.eu = MT.user.uid;
  E.iniciado = true;
  $('quem').textContent = MT.user.email || MT.user.uid;
  const P = await planos();
  const ops = (P.produtos || []).map(p => `<option value="${esc(p.id)}">${esc(p.nome || p.id)}${p.interno ? ' (interno)' : ''}${p.teste ? ' (teste)' : ''}</option>`).join('');
  $('cProd').innerHTML = ops; $('rProd').innerHTML = ops; $('cProd').value = 'cortesia';
  $('asProd').innerHTML = '<option value="">Todos</option>' + ops;
  const sec = location.hash.slice(1);
  irPara(sec);
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
