// Estado e persistência
const STORE_KEY = 'gc-state-v1';
const defaultState = () => ({
  transactions: [],
  categories: [
    { id: cid(), name: 'Alimentação',  type: 'expense', icon: '🍔', color: '#f59e0b' },
    { id: cid(), name: 'Mercado',      type: 'expense', icon: '🛒', color: '#10b981' },
    { id: cid(), name: 'Transporte',   type: 'expense', icon: '🚗', color: '#0ea5e9' },
    { id: cid(), name: 'Lazer',        type: 'expense', icon: '🎮', color: '#a855f7' },
    { id: cid(), name: 'Contas',       type: 'expense', icon: '🧾', color: '#ef4444' },
    { id: cid(), name: 'Pix',          type: 'expense', icon: '⚡', color: '#22d3ee' },
    { id: cid(), name: 'Saúde',        type: 'expense', icon: '💊', color: '#f43f5e' },
    { id: cid(), name: 'Educação',     type: 'expense', icon: '📚', color: '#6366f1' },
    { id: cid(), name: 'Assinaturas',  type: 'expense', icon: '📺', color: '#f97316' },
    { id: cid(), name: 'Outros',       type: 'expense', icon: '🏷️', color: '#94a3b8' },
    { id: cid(), name: 'Salário',      type: 'income',  icon: '💼', color: '#22c55e' },
    { id: cid(), name: 'Freelance',    type: 'income',  icon: '💻', color: '#84cc16' },
    { id: cid(), name: 'Investimentos',type: 'income',  icon: '📈', color: '#14b8a6' },
    { id: cid(), name: 'Outras receitas', type: 'income', icon: '💰', color: '#06b6d4' },
  ],
  fixedItems: [],
  accounts: [],         // contas e cartões {id, name, kind:'conta'|'cartao', bank, color, fechamento, vencimento, limite}
  commitments: [],      // metadados do parcelamento/financiamento; id == groupId das parcelas
  rules: [],            // regras automáticas {id, contem, category, sub, accountId}
  tombstones: [],       // exclusoes de transacoes {id, at} — impedem que o merge ressuscite
  fixedTombstones: [],  // exclusoes de itens fixos
  categoryTombstones: [], // exclusoes de categorias {id, at}
  accountTombstones: [],
  commitmentTombstones: [],
  ruleTombstones: [],
});

function cid() { return Math.random().toString(36).slice(2, 10); }

// Reconciliacao entre aparelhos: une duas listas por id (vence o maior updatedAt),
// depois aplica os tombstones. Sem isto, um aparelho com estado antigo
// sobrescrevia o documento inteiro e apagava o que outro lancou.
function mergeById(localArr, remoteArr, localTomb, remoteTomb) {
  const tomb = new Map();
  for (const t of [...(remoteTomb || []), ...(localTomb || [])]) {
    if (!t || !t.id) continue;
    const prev = tomb.get(t.id);
    if (!prev || (t.at || 0) > (prev.at || 0)) tomb.set(t.id, t);
  }
  const byId = new Map();
  for (const it of [...(remoteArr || []), ...(localArr || [])]) {
    if (!it || !it.id) continue;
    const prev = byId.get(it.id);
    if (!prev || (it.updatedAt || 0) >= (prev.updatedAt || 0)) byId.set(it.id, it);
  }
  const items = [];
  for (const [id, it] of byId) {
    const tb = tomb.get(id);
    if (tb && (tb.at || 0) >= (it.updatedAt || 0)) continue;
    items.push(it);
  }
  const cutoff = Date.now() - 60 * 24 * 3600 * 1000;
  const tombstones = [...tomb.values()].filter(t => (t.at || 0) >= cutoff);
  return { items, tombstones };
}
function stampTx(obj) { obj.updatedAt = Date.now(); return obj; }

/* ---------- COMPROMISSOS (parcelamentos e financiamentos) ----------------
   O parcelamento sempre gravou um groupId nas parcelas, mas nada lia esse
   campo — as parcelas ficavam soltas com "(1/3)" no texto e o usuário tinha
   que contar na mão. Aqui elas voltam a ser UMA coisa só.
   Precisa funcionar com o que já está no banco: parcelas antigas podem não
   ter groupId, então caímos no padrão "(k/N)" da descrição. */
/* Aceita os dois jeitos de escrever, porque o histórico real tem os dois:
   o que o app gera — "Notebook (1/3)" — e o que foi digitado à mão ao longo
   dos anos, sem parênteses: "CORTINAS 1/3", "GRAMA CASA 4/6". */
const RE_PARCELA = /^(.*?)\s*(\()?\s*(\d{1,3})\s*\/\s*(\d{1,3})\s*(?:\))?\s*$/;

function parcelaInfo(t) {
  const desc = t.description || '';
  const m = RE_PARCELA.exec(desc);
  if (!m) return null;
  const temParenteses = !!m[2];
  const kRaw = m[3], nRaw = m[4];
  const k = +kRaw, n = +nRaw;
  /* coerência: "Consulta 14/08" é uma DATA, não a parcela 14 de 8 */
  if (!(n >= 2 && n <= 600 && k >= 1 && k <= n)) return null;   // 420 = 35 anos de financiamento
  /* sem parênteses, zero à esquerda denuncia data: "ALUGUEL 05/12" não é
     parcela 5 de 12. O app nunca gera zero à esquerda. */
  if (!temParenteses && (/^0\d/.test(kRaw) || /^0\d/.test(nRaw))) return null;
  const base = m[1].trim();
  if (!base) return null;                 // "1/3" sozinho não identifica nada
  return { base, k, n };
}

/* Chave de agrupamento: groupId quando existe; senão, descrição-base + total
   de parcelas + tipo (duas compras diferentes em 12x não se misturam porque
   a descrição-base é diferente). */
function chaveGrupo(t) {
  if (t.groupId) return t.groupId;
  const pi = parcelaInfo(t);
  if (!pi) return null;
  return 'legado:' + t.type + ':' + pi.base.toLowerCase() + ':' + pi.n;
}

function compromissos() {
  const hoje = todayISO();
  const grupos = new Map();
  for (const t of state.transactions) {
    const g = chaveGrupo(t);
    if (!g) continue;
    if (!grupos.has(g)) grupos.set(g, []);
    grupos.get(g).push(t);
  }
  /* Compromisso recém-criado ainda não tem lançamento nenhum. Sem isto ele
     não apareceria na tela — some justo quando você acabou de cadastrar. */
  (state.commitments || []).forEach(c => { if (!grupos.has(c.id)) grupos.set(c.id, []); });

  const out = [];
  for (const [id, txs] of grupos) {
    const meta0 = (state.commitments || []).find(c => c.id === id) || {};

    /* DÍVIDA: sem cronograma. Não tem parcela nem data — tem um total e o
       tanto que já foi abatido. Cada pagamento é uma despesa normal do mês. */
    if (meta0.kind === 'divida') {
      const pagos = txs.filter(t => !t.pending);
      const pago = pagos.reduce((s, t) => s + (+t.amount || 0), 0);
      const total = +meta0.total || 0;
      out.push({
        id, kind: 'divida',
        descricao: meta0.descricao || 'Dívida',
        credor: meta0.credor || null,
        categoria: (txs[0] && txs[0].category) || meta0.category || 'Dívidas',
        type: 'expense', accountId: meta0.accountId || null,
        n: null, pagas: pagos.length, restantes: null,
        valorParcela: 0, total, totalParcelas: total,
        pago, aPagar: Math.max(0, total - pago), aPagarOficial: true,
        estimado: false, lancadas: txs.length,
        primeira: txs.length ? txs[0].date : (meta0.desde || null),
        ultima: txs.length ? txs[txs.length - 1].date : null,
        ultimaProjetada: false,
        quitado: total > 0 && pago >= total - 0.005,
        txs: pagos,
      });
      continue;
    }
    if (!txs.length) continue;      // parcelamento/financiamento sem lançamento: nada a mostrar
    txs.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const pi = parcelaInfo(txs[0]) || {};
    const meta = (state.commitments || []).find(c => c.id === id) || {};
    const n = meta.nParcelas || pi.n || txs.length;
    /* A parcela de financiamento muda todo mês. Para projetar o que falta,
       o valor mais RECENTE representa melhor do que o mais antigo. */
    const valorParcela = +txs[txs.length - 1].amount || +txs[0].amount || 0;
    /* Quando o app cria o parcelamento, TODAS as N parcelas viram lançamento.
       No histórico digitado à mão só existe o que já aconteceu ("GRAMA CASA 3/6"
       sem as outras 3). Aí o número da parcela no texto é a única fonte de
       verdade sobre quantas já foram, e o que falta é ESTIMADO pelo valor. */
    const completo = txs.length >= n;
    const jaVencidas = txs.filter(t => !t.pending && t.date <= hoje);
    const maiorK = txs.reduce((mx, t) => {
      const pj = parcelaInfo(t);
      return pj && (!t.pending && t.date <= hoje) ? Math.max(mx, pj.k) : mx;
    }, 0);
    const pagas = Math.min(n, completo ? jaVencidas.length : Math.max(maiorK, jaVencidas.length));
    const soma = completo ? txs.reduce((s, t) => s + (+t.amount || 0), 0) : valorParcela * n;
    const pago = completo ? jaVencidas.reduce((s, t) => s + (+t.amount || 0), 0) : valorParcela * pagas;
    out.push({
      id,
      kind: meta.kind || 'parcelamento',
      descricao: meta.descricao || pi.base || txs[0].description,
      categoria: txs[0].category,
      type: txs[0].type,
      accountId: meta.accountId || txs[0].accountId || null,
      n, pagas,
      restantes: Math.max(0, n - pagas),
      valorParcela,
      estimado: !completo && meta.saldoDevedor == null,
      lancadas: txs.length,
      /* financiamento tem juros: o total contratado NÃO é parcela × N */
      total: meta.total != null ? +meta.total : soma,
      totalParcelas: soma,
      pago,
      aPagar: meta.saldoDevedor != null ? +meta.saldoDevedor : Math.max(0, soma - pago),
      aPagarOficial: meta.saldoDevedor != null,
      taxaMensal: meta.taxaMensal != null ? +meta.taxaMensal : null,
      taxaAnual: meta.taxaAnual != null ? +meta.taxaAnual : null,
      valorFinanciado: meta.valorFinanciado != null ? +meta.valorFinanciado : null,
      /* Em financiamento a parcela muda todo mês (SAC + TR), então multiplicar
         parcela × restantes é chute. O saldo devedor do banco é o número real —
         quando ele existe, manda. */
      saldoDevedor: meta.saldoDevedor != null ? +meta.saldoDevedor : null,
      dataSaldo: meta.dataSaldo || null,
      banco: meta.banco || null,
      contrato: meta.contrato || null,
      diaDebito: meta.diaDebito != null ? +meta.diaDebito : null,
      sistema: meta.sistema || null,
      primeira: txs[0].date,
      /* Com o histórico incompleto, a última parcela LANÇADA não é a última do
         acordo — projetamos a partir da parcela mais recente e do que falta,
         senão "faltam 57" apareceria com término no mês que vem. */
      ultima: (function () {
        const ultimoTx = txs[txs.length - 1];
        if (completo) return ultimoTx.date;
        const pj = parcelaInfo(ultimoTx);
        const restam = pj ? (n - pj.k) : Math.max(0, n - txs.length);
        const d = new Date(ultimoTx.date + 'T00:00:00');
        d.setMonth(d.getMonth() + restam);
        return d.toISOString().slice(0, 10);
      })(),
      ultimaProjetada: !completo,
      quitado: pagas >= n,
      txs,
    });
  }
  /* em aberto primeiro, e dentro disso o que acaba mais cedo */
  return out.sort((a, b) => (a.quitado - b.quitado) || (a.ultima || '').localeCompare(b.ultima || ''));
}

/* Quanto de cada mês futuro já está comprometido (parcelas ainda por vencer). */
function comprometimentoPorMes(meses = 12) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const out = [];
  for (let i = 0; i < meses; i++) {
    const ref = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
    const total = state.transactions
      .filter(t => t.type === 'expense' && chaveGrupo(t) && inMonth(t.date, ref) && t.date >= todayISO())
      .reduce((s, t) => s + (+t.amount || 0), 0);
    out.push({ ref, total });
  }
  return out;
}
function tombstone(list, id) {
  if (!Array.isArray(state[list])) state[list] = [];
  state[list] = state[list].filter(t => t.id !== id);
  state[list].push({ id, at: Date.now() });
}
// Merge especifico deste app, registrado no helper central MT dentro do waitMT
// (users/{uid}/apps/granae). Definido como funcao porque este script roda antes
// do modulo _mtauth.js — window.MT ainda nao existe aqui.
function granaeMergeFn(remote, local) {
  remote = remote || {};
  const tx = mergeById(local.transactions, remote.transactions, local.tombstones, remote.tombstones);
  const fx = mergeById(local.fixedItems, remote.fixedItems, local.fixedTombstones, remote.fixedTombstones);
  const cat = mergeById(local.categories, remote.categories, local.categoryTombstones, remote.categoryTombstones);
  const acc = mergeById(local.accounts, remote.accounts, local.accountTombstones, remote.accountTombstones);
  const cmt = mergeById(local.commitments, remote.commitments, local.commitmentTombstones, remote.commitmentTombstones);
  const rul = mergeById(local.rules, remote.rules, local.ruleTombstones, remote.ruleTombstones);
  return {
    profile: local.profile || remote.profile || {},
    transactions: tx.items,
    tombstones: tx.tombstones,
    fixedItems: fx.items,
    fixedTombstones: fx.tombstones,
    categories: cat.items,
    categoryTombstones: cat.tombstones,
    accounts: acc.items,
    accountTombstones: acc.tombstones,
    commitments: cmt.items,
    commitmentTombstones: cmt.tombstones,
    rules: rul.items,
    ruleTombstones: rul.tombstones,
  };
}

let state = defaultState();
// Filtro ativo de categoria + mês na tela de Transações (setado ao clicar num bar do dashboard)
let categoryFilter = null; // { name: string, month: Date }
let currentUid = null;
window.currentUid = null; // exposto pros módulos Gemini namespeared
let applyingCloud = false; // true enquanto aplicamos dados vindos da nuvem (evita re-salvar em eco)

function saveState() {
  // cache local sempre (resiste a refresh offline)
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch {}
  // nuvem via login central MedTech: users/{uid}/apps/granae = { json: JSON.stringify(state) }
  if (applyingCloud) return;
  if (window.MT && window.MT.save) window.MT.save(state);
}

// Aplica ao estado local os dados vindos da nuvem MedTech (MT.onData).
function applyData(d) {
  applyingCloud = true;
  if (d && typeof d === 'object') {
    state = {
      profile: d.profile || {},
      transactions: Array.isArray(d.transactions) ? d.transactions : [],
      categories: (d.categories && d.categories.length) ? d.categories : defaultState().categories,
      fixedItems: Array.isArray(d.fixedItems) ? d.fixedItems : [],
      tombstones: Array.isArray(d.tombstones) ? d.tombstones : [],
      fixedTombstones: Array.isArray(d.fixedTombstones) ? d.fixedTombstones : [],
      categoryTombstones: Array.isArray(d.categoryTombstones) ? d.categoryTombstones : [],
      accounts: Array.isArray(d.accounts) ? d.accounts : [],
      commitments: Array.isArray(d.commitments) ? d.commitments : [],
      accountTombstones: Array.isArray(d.accountTombstones) ? d.accountTombstones : [],
      commitmentTombstones: Array.isArray(d.commitmentTombstones) ? d.commitmentTombstones : [],
      rules: Array.isArray(d.rules) ? d.rules : [],
      ruleTombstones: Array.isArray(d.ruleTombstones) ? d.ruleTombstones : [],
    };
  } else {
    state = defaultState();
  }
  applyingCloud = false;
  if (userNameEl) {
    userNameEl.textContent = state.profile?.name
      || (window.MT && window.MT.user && (window.MT.user.displayName || window.MT.user.email)) || '';
  }
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch {}
  activateDuePending();
  refreshAll();
}

// Utilidades
const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const monthLongFmt = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const dayFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });
const wdLongFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' });

let currentMonth = startOfCurrentMonth();

function startOfCurrentMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function inMonth(dateStr, ref) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}
function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}
function categoryByName(name, type) {
  return state.categories.find(c => c.name === name && (type ? c.type === type : true))
      || state.categories.find(c => c.name.toLowerCase() === (name || '').toLowerCase());
}
function categoryById(id) { return state.categories.find(c => c.id === id); }

function toast(msg, ms = 2400) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, ms);
}

function safeMD(text) {
  // Minimal markdown -> HTML (headers, bold, lists, code, paragraphs)
  const esc = text.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  return esc
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/(^|\n)([-*] .+(?:\n[-*] .+)*)/g, (_, pre, block) => {
      const items = block.split('\n').map(l => l.replace(/^[-*]\s+/, '')).map(l => `<li>${l}</li>`).join('');
      return `${pre}<ul>${items}</ul>`;
    })
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/^([^<].+?)$/gm, '<p>$1</p>')
    .replace(/<p>(<h\d|<ul|<\/ul|<li)/g, '$1')
    .replace(/(<\/h\d>|<\/ul>|<\/li>)<\/p>/g, '$1');
}

// ====== Navegação ======
let _keepTxFilter = false;
/* Rotas no endereço: o botão voltar do navegador passa a andar entre as telas
   em vez de sair do app. Também deixa recarregar caindo na mesma tela. */
const VIEWS = ['dashboard', 'transacoes', 'categorias', 'fixos', 'compromissos', 'ia'];
function viewDoHash() {
  const h = (location.hash || '').replace(/^#\/?/, '');
  return VIEWS.includes(h) ? h : 'dashboard';
}
window.addEventListener('hashchange', () => navigate(viewDoHash(), true));

function navigate(view, doHash) {
  // entrar em Transações "do zero" (pela nav) limpa filtro de categoria e busca —
  // filtro grudado fazia a lista parecer vazia ("sumiu os lançamentos").
  if (view === 'transacoes' && !_keepTxFilter) {
    categoryFilter = null;
    const _q = document.getElementById('txSearch'); if (_q) _q.value = '';
  }
  _keepTxFilter = false;
  if (!VIEWS.includes(view)) view = 'dashboard';
  if (!doHash && ('#/' + view) !== location.hash) location.hash = '#/' + view;
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('hidden', v.dataset.view !== view));
  document.querySelectorAll('.bottom-nav button').forEach(b => b.classList.toggle('active', b.dataset.nav === view));
  if (view === 'dashboard') renderDashboard();
  if (view === 'transacoes') { renderTransactions(); aplicarTabelaTx(); }
  if (view === 'categorias') renderCategories();
  if (view === 'fixos') renderFixed();
  if (view === 'compromissos') { renderCompromissos(); renderFaturas(); }
  if (view === 'ia') renderAI();
  window.scrollTo({ top: 0 });
}

document.querySelectorAll('[data-nav]').forEach(el => {
  el.addEventListener('click', () => navigate(el.dataset.nav));
});

// Clique em barra de categoria do dashboard → filtra Transações por categoria + mês
document.getElementById('categoryBars').addEventListener('click', (e) => {
  const item = e.target.closest('.bar-item[data-cat]');
  if (!item) return;
  categoryFilter = { name: item.dataset.cat };
  _keepTxFilter = true;
  navigate('transacoes');
});
document.getElementById('categoryBars').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const item = e.target.closest('.bar-item[data-cat]');
  if (!item) return;
  e.preventDefault();
  categoryFilter = { name: item.dataset.cat };
  _keepTxFilter = true;
  navigate('transacoes');
});

// ====== Dashboard ======
document.getElementById('prevMonth').addEventListener('click', () => {
  currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
  renderDashboard();
});
document.getElementById('nextMonth').addEventListener('click', () => {
  currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
  renderDashboard();
});
// Seletor de mês da tela de Transações (compartilha o currentMonth com o dashboard)
document.getElementById('txPrevMonth').addEventListener('click', () => {
  currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
  renderTransactions();
});
document.getElementById('txNextMonth').addEventListener('click', () => {
  currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
  renderTransactions();
});

/* Transferir dinheiro entre suas contas não é ganhar nem gastar. Os dois
   lançamentos do par ficam de fora de qualquer total, gráfico ou orçamento —
   senão o mês mostraria receita e despesa que não existiram. */
const ehTransfer = t => !!t.transferId;

function txOfMonth() {
  return state.transactions.filter(t => inMonth(t.date, currentMonth) && !ehTransfer(t));
}

// Ativa transações agendadas cuja data já chegou (ou já passou)
function activateDuePending() {
  const today = todayISO();
  let changed = false;
  for (const t of state.transactions) {
    if (t.pending && t.date <= today) {
      delete t.pending;
      t.updatedAt = Date.now(); // senão o merge entre aparelhos pode reverter a ativação
      changed = true;
    }
  }
  if (changed) saveState();
  return changed;
}

function renderDashboard() {
  document.getElementById('monthLabel').textContent = monthLongFmt.format(currentMonth);
  const allTx = txOfMonth();
  const tx = allTx.filter(t => !t.pending); // agendados não contam até a data chegar
  const income = tx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = tx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  document.getElementById('sumIncome').textContent = fmt.format(income);
  document.getElementById('sumExpense').textContent = fmt.format(expense);
  const balance = income - expense;
  const bal = document.getElementById('sumBalance');
  bal.textContent = fmt.format(balance);
  bal.classList.toggle('negative', balance < 0);

  // Renderiza próximos agendados (global, todos os meses)
  renderScheduled();

  // por categoria — progresso vs. orçamento fixo (sem pending)
  const byCat = new Map();
  for (const t of tx.filter(t => t.type === 'expense')) {
    byCat.set(t.category, (byCat.get(t.category) || 0) + t.amount);
  }
  const total = [...byCat.values()].reduce((a, b) => a + b, 0);
  const budgetByCat = new Map();
  const activeFixed = fixedItemsActiveIn(currentMonth);
  for (const f of activeFixed.filter(f => f.type === 'expense')) {
    budgetByCat.set(f.category, (budgetByCat.get(f.category) || 0) + f.amount);
  }
  // meta manual da categoria tem precedência sobre a soma dos fixos
  for (const c of state.categories) {
    if (c.type === 'expense' && c.goal > 0) budgetByCat.set(c.name, c.goal);
  }
  const allCatNames = new Set([...byCat.keys(), ...budgetByCat.keys()]);
  const rows = [...allCatNames].map(name => ({
    name,
    spent: byCat.get(name) || 0,
    budget: budgetByCat.get(name) || 0,
  })).sort((a, b) => {
    const ap = a.budget ? a.spent / a.budget : -1;
    const bp = b.budget ? b.spent / b.budget : -1;
    if ((ap > 1) !== (bp > 1)) return ap > 1 ? -1 : 1; // estouro primeiro
    if (ap !== bp) return bp - ap; // maior % primeiro
    return b.spent - a.spent;
  });
  const bars = document.getElementById('categoryBars');
  bars.innerHTML = rows.length
    ? rows.map(r => {
        const cat = categoryByName(r.name, 'expense') || { color: '#888', icon: '🏷️' };
        const hasBudget = r.budget > 0;
        const pct = hasBudget ? (r.spent / r.budget) * 100 : 0;
        const pctRound = Math.round(pct);
        const fillWidth = hasBudget ? Math.min(100, pct) : 0;
        const status = !hasBudget ? 'no-budget' : (pct > 100 ? 'over' : pct >= 80 ? 'warn' : 'ok');
        const fillStyle = !hasBudget
          ? `width:${Math.min(100, (r.spent / Math.max(1, total)) * 100)}%;background:${cat.color};opacity:.55`
          : status === 'over' ? `width:100%;background:linear-gradient(90deg,var(--expense-2),var(--expense))`
          : status === 'warn' ? `width:${fillWidth}%;background:linear-gradient(90deg,#f59e0b,#fbbf24)`
          : `width:${fillWidth}%;background:linear-gradient(90deg,var(--income-2),var(--income))`;
        const pctColor = status === 'over' ? 'var(--expense)'
          : status === 'warn' ? 'var(--warning)'
          : status === 'ok' ? 'var(--income)' : 'var(--muted)';
        const right = hasBudget
          ? `<strong style="color:${pctColor}">${pctRound}%</strong>`
          : `<span class="muted small">sem meta</span>`;
        const sub = hasBudget
          ? `${fmt.format(r.spent)} <span class="muted small">/ ${fmt.format(r.budget)}</span>`
          : `${fmt.format(r.spent)}`;
        return `<div class="bar-item" data-cat="${escapeHTML(r.name)}" role="button" tabindex="0" aria-label="Ver lançamentos de ${escapeHTML(r.name)}">
          <div class="row">
            <div class="name"><span class="dot" style="background:${cat.color}"></span><span class="emoji">${cat.icon || '🏷️'}</span> ${r.name}</div>
            <div>${right}</div>
          </div>
          <div class="bar-sub">${sub}</div>
          <div class="track"><span class="fill" style="${fillStyle}"></span></div>
        </div>`;
      }).join('')
    : `<p class="empty">Sem despesas neste mês.</p>`;

  // Atualiza título da seção de gastos por categoria
  const dashTitle = document.getElementById('categoryBarsTitle');
  if (dashTitle) dashTitle.textContent = activeFixed.some(f => f.type === 'expense')
    ? 'Progresso vs. orçamento'
    : 'Gastos por categoria';

  // Recentes
  const recent = [...tx].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  document.getElementById('recentList').innerHTML = recent.length
    ? recent.map(txItemHTML).join('')
    : `<li class="empty">Nenhuma transação ainda.</li>`;
  attachTxClicks('recentList');

  renderFixedCompare(income, byCat);
  renderDonut(byCat);
  renderTrend();
}

// Donut: distribuição de despesas do mês por categoria
function renderDonut(byCat) {
  const wrap = document.getElementById('chartDonut');
  if (!wrap) return;
  const total = [...byCat.values()].reduce((s, v) => s + v, 0);
  if (!total) {
    wrap.innerHTML = `<p class="empty">Sem despesas neste mês.</p>`;
    return;
  }
  const slices = [...byCat.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, val]) => ({
      name, val, pct: val / total,
      cat: categoryByName(name, 'expense') || { color: '#888', icon: '🏷️' },
    }));

  const R = 36, STROKE = 14, SIZE = 100, CENTER = SIZE / 2;
  const C = 2 * Math.PI * R;
  let offset = 0;
  const arcs = slices.map(s => {
    const len = s.pct * C;
    const arc = `<circle cx="${CENTER}" cy="${CENTER}" r="${R}" fill="none" stroke="${s.cat.color}" stroke-width="${STROKE}" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 ${CENTER} ${CENTER})" />`;
    offset += len;
    return arc;
  }).join('');

  const topN = 4;
  const top = slices.slice(0, topN);
  const others = slices.slice(topN);
  const othersVal = others.reduce((s, o) => s + o.val, 0);
  const legendItems = [
    ...top.map(s => `
      <li>
        <span class="dot" style="background:${s.cat.color}"></span>
        <span class="name">${escapeHTML(s.name)}</span>
        <span class="val">${fmt.format(s.val)}</span>
        <span class="pct">${Math.round(s.pct * 100)}%</span>
      </li>`),
    others.length ? `
      <li>
        <span class="dot" style="background:#666"></span>
        <span class="name">Outros (${others.length})</span>
        <span class="val">${fmt.format(othersVal)}</span>
        <span class="pct">${Math.round((othersVal / total) * 100)}%</span>
      </li>` : '',
  ].join('');

  wrap.innerHTML = `
    <div class="donut-wrap">
      <div class="donut-svg-wrap">
        <svg viewBox="0 0 ${SIZE} ${SIZE}" class="donut-svg" aria-label="Distribuição de despesas">
          <circle cx="${CENTER}" cy="${CENTER}" r="${R}" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="${STROKE}"/>
          ${arcs}
        </svg>
        <div class="donut-center">
          <span class="donut-label">Total</span>
          <strong class="donut-total">${fmt.format(total)}</strong>
        </div>
      </div>
      <ul class="donut-legend">${legendItems}</ul>
    </div>
  `;
}

// Trend: últimos 6 meses (terminando no currentMonth), barras receita vs despesa
function renderTrend() {
  const wrap = document.getElementById('chartTrend');
  if (!wrap) return;
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(currentMonth);
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    months.push(d);
  }
  const data = months.map(m => {
    const tx = state.transactions.filter(t => !t.pending && !ehTransfer(t) && inMonth(t.date, m));
    const income = tx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = tx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { month: m, income, expense };
  });

  const hasData = data.some(d => d.income > 0 || d.expense > 0);
  if (!hasData) {
    wrap.innerHTML = `<p class="empty">Sem dados nos últimos 6 meses.</p>`;
    return;
  }

  const maxVal = Math.max(...data.flatMap(d => [d.income, d.expense]), 1);
  const W = 320, H = 170;
  const padding = { top: 12, right: 8, bottom: 28, left: 8 };
  const colW = (W - padding.left - padding.right) / 6;
  const barW = Math.max(8, (colW - 8) / 2);
  const chartH = H - padding.top - padding.bottom;
  const shortFmt = new Intl.DateTimeFormat('pt-BR', { month: 'short' });

  const groups = data.map((d, i) => {
    const cx = padding.left + i * colW + colW / 2;
    const incH = (d.income / maxVal) * chartH;
    const expH = (d.expense / maxVal) * chartH;
    const yBase = padding.top + chartH;
    const label = shortFmt.format(d.month).replace('.', '').replace(/^\w/, c => c.toUpperCase());
    return `
      <g class="trend-group">
        <rect x="${cx - barW - 2}" y="${yBase - incH}" width="${barW}" height="${incH}" fill="var(--income)" rx="3" opacity="0.9"/>
        <rect x="${cx + 2}" y="${yBase - expH}" width="${barW}" height="${expH}" fill="var(--expense)" rx="3" opacity="0.9"/>
        <text x="${cx}" y="${H - 10}" text-anchor="middle" class="trend-label">${label}</text>
      </g>
    `;
  }).join('');

  wrap.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" class="trend-svg" preserveAspectRatio="xMidYMid meet">
      ${groups}
    </svg>
    <div class="trend-legend">
      <span><i style="background:var(--income)"></i> Receitas</span>
      <span><i style="background:var(--expense)"></i> Despesas</span>
    </div>
  `;
}

function renderScheduled() {
  const today = todayISO();
  // Pending desse mês visualizado (não global)
  const monthPending = state.transactions
    .filter(t => t.pending && inMonth(t.date, currentMonth) && t.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const wrap = document.getElementById('scheduledWrap');
  const list = document.getElementById('scheduledList');
  const countEl = document.getElementById('scheduledCount');
  const totalEl = document.getElementById('scheduledTotal');
  if (!wrap || !list) return;
  // Total signed (despesas - receitas)
  const net = monthPending.reduce((s, t) => s + (t.type === 'expense' ? -t.amount : t.amount), 0);
  if (!monthPending.length) { wrap.hidden = true; return; }
  wrap.hidden = false;
  countEl.textContent = `${monthPending.length} pendente${monthPending.length === 1 ? '' : 's'}`;
  const sign = net < 0 ? '−' : (net > 0 ? '+' : '');
  totalEl.textContent = `${sign} ${fmt.format(Math.abs(net))}`.trim();
  totalEl.style.color = net < 0 ? 'var(--expense)' : (net > 0 ? 'var(--income)' : 'var(--text)');
  const todayMs = new Date(today + 'T00:00:00').getTime();
  list.innerHTML = monthPending.map(t => {
    const cat = categoryByName(t.category, t.type) || { color: '#888', icon: '🏷️' };
    const txSign = t.type === 'income' ? '+' : '−';
    const days = Math.max(0, Math.round((new Date(t.date + 'T00:00:00').getTime() - todayMs) / 86400000));
    const dayLabel = days === 0 ? 'hoje' : days === 1 ? 'amanhã' : `em ${days} dias`;
    const dateBR = t.date.split('-').reverse().slice(0, 2).join('/');
    return `<li class="tx-item pending" data-tx-id="${t.id}">
      <div class="icon" style="background:${cat.color}22;color:${cat.color}">${cat.icon}</div>
      <div class="meta">
        <span class="desc">${escapeHTML(t.description || cat.name || '—')}</span>
        <span class="sub">${dateBR} · <strong style="color:var(--primary-2)">${dayLabel}</strong> · ${escapeHTML(t.category)}</span>
      </div>
      <span class="val ${t.type}">${txSign} ${fmt.format(t.amount)}</span>
    </li>`;
  }).join('');
  attachTxClicks('scheduledList');
}

// Toggle expand/collapse do card de agendados
(function setupScheduledToggle(){
  const btn = document.getElementById('scheduledToggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const list = document.getElementById('scheduledList');
    const expanded = !list.hidden;
    list.hidden = expanded;
    btn.setAttribute('aria-expanded', String(!expanded));
    btn.classList.toggle('expanded', !expanded);
  });
})();

function renderFixedCompare(realIncome, expenseByCat) {
  const realExpense = [...expenseByCat.values()].reduce((a, b) => a + b, 0);
  const hasFixed = state.fixedItems.length > 0;
  const active = hasFixed ? fixedItemsActiveIn(currentMonth) : [];
  const fIncome = active.filter(f => f.type === 'income').reduce((s, f) => s + f.amount, 0);
  const fExpense = active.filter(f => f.type === 'expense').reduce((s, f) => s + f.amount, 0);

  applyFlowRow('income', realIncome, fIncome, hasFixed);
  applyFlowRow('expense', realExpense, fExpense, hasFixed);

  // CTA pra cadastrar fixos
  const cta = document.getElementById('fixedCompareCta');
  if (cta) cta.hidden = hasFixed;

  // Itens anuais ativos neste mês
  const yearlyThisMonth = active.filter(f => f.frequency === 'yearly');
  const yearlyEl = document.getElementById('yearlyNote');
  if (yearlyEl) {
    if (yearlyThisMonth.length) {
      yearlyEl.textContent = `Inclui este mês: ${yearlyThisMonth.map(f => f.name).join(', ')}`;
      yearlyEl.hidden = false;
    } else {
      yearlyEl.hidden = true;
    }
  }
}

function applyFlowRow(kind, real, budget, hasFixed) {
  const meta = document.getElementById(kind + 'Meta');
  const bar = document.getElementById(kind + 'Bar');
  const barWrap = bar?.parentElement;
  if (!meta || !bar || !barWrap) return;

  if (!hasFixed || !budget) {
    meta.textContent = '';
    barWrap.hidden = true;
    return;
  }
  const pct = Math.min(150, Math.round((real / budget) * 100));
  const status = kind === 'expense' ? (real > budget ? 'over' : 'ok') : (real >= budget ? 'ok' : 'under');
  meta.textContent = `de ${fmt.format(budget)} (${pct}%)`;
  barWrap.hidden = false;
  bar.className = status;
  bar.style.width = Math.min(100, pct) + '%';
}

// ====== Transações ======
function txItemHTML(t, hideDate) {
  const cat = categoryByName(t.category) || { color: '#999', icon: '🏷️' };
  const sign = t.type === 'income' ? '+' : '−';
  const pendingCls = t.pending ? ' pending' : '';
  const pendingBadge = t.pending ? ' <span class="badge-pending">agendado</span>' : '';
  // Chip estilo Monerix: fundo tonal da cor da categoria + emoji + nome
  const chipBg = cat.color + '1F'; // ~12% alpha
  const chipFg = cat.color;
  const conta = (state.accounts || []).find(a => a.id === t.accountId);
  return `<li class="tx-item${pendingCls}" data-id="${t.id}">
    <span class="txc-date txc-dim">${new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
    <div class="meta">
      <span class="desc">${escapeHTML(t.description)}${pendingBadge}</span>
      ${hideDate ? '' : `<span class="sub">${dayFmt.format(new Date(t.date + 'T00:00:00'))}</span>`}
    </div>
    <span class="tx-cat-chip" style="background:${chipBg};color:${chipFg}">
      <span class="ico">${cat.icon || '🏷️'}</span> ${escapeHTML(t.category)}
    </span>
    <span class="txc-acc txc-dim">${conta ? escapeHTML(conta.name) : ''}</span>
    <span class="val ${t.type} txc-r">${sign} ${fmt.format(t.amount)}</span>
  </li>`;
}
function escapeHTML(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function isYesterday(dateStr) {
  const d = new Date(); d.setDate(d.getDate() - 1);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10) === dateStr;
}

function renderTxMonthSummary(monthTx) {
  const eff = monthTx.filter(t => !t.pending); // agendados não entram no resumo
  const income = eff.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = eff.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const bal = income - expense;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = fmt.format(v); };
  set('txSumIn', income);
  set('txSumOut', expense);
  const b = document.getElementById('txSumBal');
  if (b) { b.textContent = fmt.format(bal); b.classList.toggle('negative', bal < 0); }
}

function renderTransactions() {
  const filter = document.getElementById('filterType').value;
  // SEMPRE escopado ao mês vigente (navegável pelo seletor de mês acima da lista)
  const monthTx = state.transactions.filter(t => inMonth(t.date, currentMonth) && !ehTransfer(t));
  let list = monthTx.slice();
  if (filter !== 'all') list = list.filter(t => t.type === filter);
  if (categoryFilter) list = list.filter(t => t.category === categoryFilter.name);
  const _q = (document.getElementById('txSearch')?.value || '').trim().toLowerCase();
  if (_q) list = list.filter(t => t.description.toLowerCase().includes(_q) || String(t.amount).includes(_q.replace(',', '.')));
  list.sort((a, b) => b.date.localeCompare(a.date));

  const lbl = document.getElementById('txMonthLabel');
  if (lbl) lbl.textContent = monthLongFmt.format(currentMonth);
  renderTxMonthSummary(monthTx);
  renderTxFilterChip();

  const ul = document.getElementById('txList');
  if (!list.length) {
    if (monthTx.length > 0) {
      // o mês TEM lançamentos — estão escondidos por filtro/busca. Diga isso e ofereça a saída.
      ul.innerHTML = `<li class="empty">${monthTx.length} lançamento${monthTx.length===1?'':'s'} de ${monthLongFmt.format(currentMonth)} escondido${monthTx.length===1?'':'s'} pelos filtros.<br><button type="button" class="primary" style="margin-top:10px" onclick="limparFiltrosTx()">Limpar filtros e mostrar tudo</button></li>`;
    } else {
      ul.innerHTML = `<li class="empty">Nenhuma transação em ${monthLongFmt.format(currentMonth)}.</li>`;
    }
    attachTxClicks('txList');
    return;
  }

  // agrupa por dia: cabeçalho de dia (rótulo + saldo do dia) + itens
  const order = [];
  const byDay = new Map();
  for (const t of list) {
    if (!byDay.has(t.date)) { byDay.set(t.date, []); order.push(t.date); }
    byDay.get(t.date).push(t);
  }
  const today = todayISO();
  let html = '';
  for (const day of order) {
    const items = byDay.get(day);
    const net = items.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);
    const d = new Date(day + 'T00:00:00');
    let friendly = wdLongFmt.format(d);
    friendly = friendly.charAt(0).toUpperCase() + friendly.slice(1);
    if (day === today) friendly = 'Hoje';
    else if (isYesterday(day)) friendly = 'Ontem';
    const dd = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
    html += `<li class="tx-day"><span class="tx-day-date">${friendly}<em>${dd}</em></span><span class="tx-day-net ${net < 0 ? 'neg' : 'pos'}">${net < 0 ? '−' : '+'} ${fmt.format(Math.abs(net))}</span></li>`;
    html += items.map(t => txItemHTML(t, true)).join('');
  }
  ul.innerHTML = html;
  attachTxClicks('txList');
}

function renderTxFilterChip() {
  const chip = document.getElementById('txFilterChip');
  if (!chip) return;
  if (categoryFilter) {
    chip.hidden = false;
    chip.querySelector('.chip-label').textContent = categoryFilter.name;
  } else {
    chip.hidden = true;
  }
}

document.getElementById('filterType').addEventListener('change', renderTransactions);

document.getElementById('clearTxFilter').addEventListener('click', () => {
  categoryFilter = null;
  renderTransactions();
});

function attachTxClicks(listId) {
  document.getElementById(listId).querySelectorAll('.tx-item').forEach(el => {
    el.addEventListener('click', () => openTxDetail(el.dataset.id));
  });
}

/* ---------- DETALHE DO LANÇAMENTO (leitura) ----------
   Antes o clique caía direto no formulário de edição. Ver não é editar — e
   quando o lançamento faz parte de um parcelamento, é aqui que aparece o
   progresso do grupo inteiro. */
let _detalheId = null;
const txDetail = document.getElementById('txDetail');

function openTxDetail(id) {
  const t = state.transactions.find(x => x.id === id);
  if (!t) return;
  _detalheId = id;
  const cat = categoryByName(t.category, t.type) || { color: '#888', icon: '🏷️' };
  const g = chaveGrupo(t);
  const grupo = g ? compromissos().find(c => c.id === g) : null;
  const conta = (state.accounts || []).find(a => a.id === t.accountId);
  const dataFmt = new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR');
  const venc = t.dueDate && t.dueDate !== t.date
    ? `<div><span class="muted small">Vencimento</span><b>${new Date(t.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}</b></div>` : '';

  let blocoGrupo = '';
  if (grupo) {
    blocoGrupo = `
      <h4 class="muted small uppercase" style="margin:16px 0 6px">${grupo.kind === 'financiamento' ? 'Financiamento' : 'Parcelamento'}</h4>
      <div class="det-grid">
        <div><span class="muted small">Parcelas</span><b>${grupo.pagas} de ${grupo.n}</b></div>
        <div><span class="muted small">Faltam</span><b>${grupo.restantes}</b></div>
        <div><span class="muted small">Já pago</span><b>${fmt.format(grupo.pago)}</b></div>
        <div><span class="muted small">Falta pagar</span><b>${fmt.format(grupo.aPagar)}</b></div>
      </div>
      <div class="cmt-bar big"><div style="width:${pct(grupo.pagas, grupo.n)}%"></div></div>
      <button type="button" class="link" id="verCompromisso" style="margin-top:8px">Ver todas as parcelas →</button>`;
  }

  document.getElementById('txDetailBody').innerHTML = `
    <div class="det-hero">
      <strong>${escapeHTML(t.description)}</strong>
      <span class="${t.type === 'income' ? 'income' : ''}">${t.type === 'income' ? '+' : '−'} ${fmt.format(t.amount)}</span>
    </div>
    <div class="det-grid">
      <div><span class="muted small">Situação</span><b>${t.pending ? 'Agendado' : 'Efetivado'}</b></div>
      <div><span class="muted small">Data</span><b>${dataFmt}</b></div>
      ${venc}
      <div><span class="muted small">Categoria</span><b><span style="color:${cat.color}">${escapeHTML(cat.icon || '')}</span> ${escapeHTML(t.category || '—')}</b></div>
      ${t.sub ? `<div><span class="muted small">Subcategoria</span><b>${escapeHTML(t.sub)}</b></div>` : ''}
      ${conta ? `<div><span class="muted small">${conta.kind === 'cartao' ? 'Cartão' : 'Conta'}</span><b>${escapeHTML(conta.name)}</b></div>` : ''}
    </div>
    ${blocoGrupo}`;
  document.getElementById('txDetailDel').hidden = false;
  document.getElementById('txDetailEdit').hidden = false;
  const vc = document.getElementById('verCompromisso');
  if (vc) vc.addEventListener('click', () => { txDetail.close(); openCmtDetail(grupo.id); });
  txDetail.showModal();
}

// Diálogo de transação
const txDialog = document.getElementById('txDialog');
const txForm = document.getElementById('txForm');
const txDelete = document.getElementById('txDelete');

function fillCategorySelect(select, type) {
  const list = state.categories.filter(c => c.type === type);
  /* escapa: o nome da categoria pode vir da IA lendo uma fatura, não só do usuário */
  select.innerHTML = list.map(c => `<option value="${escapeHTML(c.name)}">${escapeHTML(c.icon)} ${escapeHTML(c.name)}</option>`).join('')
    || `<option value="">— sem categorias —</option>`;
}

function openTxDialog(id) {
  const _pf = document.getElementById('parcelasField');
  if (_pf) { _pf.hidden = !!id; if (txForm.parcelas) txForm.parcelas.value = '1'; const _h=document.getElementById('parcelasHint'); if(_h)_h.textContent=''; }
  const _dup = document.getElementById('txDup'); if (_dup) _dup.hidden = !id;
  txForm.reset();
  const editing = id ? state.transactions.find(t => t.id === id) : null;
  document.getElementById('txDialogTitle').textContent = editing ? 'Editar transação' : 'Nova transação';
  txDelete.hidden = !editing;
  txForm.dataset.id = editing?.id || '';
  const type = editing?.type || 'expense';
  txForm.querySelector(`input[name=type][value=${type}]`).checked = true;
  fillCategorySelect(txForm.category, type);
  fillAccountSelect(txForm.accountId, editing?.accountId);
  preencherSugestoesSub();
  if (editing) {
    txForm.amount.value = editing.amount;
    txForm.description.value = editing.description;
    txForm.category.value = editing.category;
    txForm.date.value = editing.date;
    if (txForm.sub) txForm.sub.value = editing.sub || '';
  } else {
    txForm.date.value = todayISO();
  }
  updateTxScheduledHint();
  txDialog.showModal();
}

/* As subcategorias não são cadastradas: viram sugestão a partir do que já foi
   digitado antes, para não criar mais uma tela de cadastro. */
function preencherSugestoesSub() {
  const dl = document.getElementById('subSugestoes');
  if (!dl) return;
  const usadas = [...new Set(state.transactions.map(t => t.sub).filter(Boolean))].sort();
  dl.innerHTML = usadas.map(v => `<option value="${escapeHTML(v)}"></option>`).join('');
}

function updateTxScheduledHint() {
  const hint = document.getElementById('txScheduledHint');
  const dateInput = txForm.date;
  if (!hint || !dateInput) return;
  const d = dateInput.value;
  if (d && d > todayISO()) {
    hint.hidden = false;
    const [y, m, day] = d.split('-');
    document.getElementById('txScheduledDate').textContent = `${day}/${m}/${y}`;
  } else {
    hint.hidden = true;
  }
}

txForm.date.addEventListener('change', updateTxScheduledHint);
txForm.date.addEventListener('input', updateTxScheduledHint);
txForm.querySelectorAll('input[name=type]').forEach(r => {
  r.addEventListener('change', e => fillCategorySelect(txForm.category, e.target.value));
});

txForm.addEventListener('submit', e => {
  e.preventDefault();
  const data = new FormData(txForm);
  const obj = {
    id: txForm.dataset.id || cid(),
    type: data.get('type'),
    amount: parseFloat(data.get('amount')),
    description: data.get('description').trim(),
    category: data.get('category'),
    date: data.get('date'),
    sub: (data.get('sub') || '').trim() || null,
    accountId: data.get('accountId') || null,
  };
  if (!obj.amount || !obj.description || !obj.category || !obj.date) return;
  const nPar = parseInt(data.get('parcelas')) || 1;
  const editing = !!txForm.dataset.id && state.transactions.some(t => t.id === txForm.dataset.id);
  if (!editing && nPar > 1) {
    // parcelamento: o valor digitado é o valor DA PARCELA; gera N lançamentos mensais
    const gid = cid();
    const base = new Date(obj.date + 'T00:00:00');
    const hoje = todayISO();
    for (let k = 0; k < nPar; k++) {
      const d = new Date(base); d.setMonth(base.getMonth() + k);
      // clampa dia (31 → último dia do mês curto)
      if (d.getDate() !== base.getDate()) d.setDate(0);
      const ds = d.toISOString().slice(0, 10);
      const p = stampTx({ id: cid(), type: obj.type, amount: obj.amount,
        description: `${obj.description} (${k + 1}/${nPar})`, category: obj.category,
        date: ds, groupId: gid, sub: obj.sub, accountId: obj.accountId });
      if (ds > hoje) p.pending = true;
      state.transactions.push(p);
    }
    saveState(); txDialog.close(); refreshAll();
    const fim = new Date(base); fim.setMonth(base.getMonth() + nPar - 1);
    toast(`${nPar} parcelas de ${fmt.format(obj.amount)} até ${monthLongFmt.format(fim)}`);
    return;
  }
  aplicarRegras(obj);      // "UBER vira Transporte" antes de salvar
  // Data futura → agendado (não conta nos totais até a data chegar)
  if (obj.date > todayISO()) obj.pending = true;
  const idx = state.transactions.findIndex(t => t.id === obj.id);
  stampTx(obj);
  if (idx >= 0) state.transactions[idx] = obj;
  else state.transactions.push(obj);
  saveState();
  txDialog.close();
  refreshAll();
  toast(obj.pending ? 'Agendado' : (idx >= 0 ? 'Atualizado' : 'Lançado'));
});

txDelete.addEventListener('click', () => {
  const id = txForm.dataset.id;
  if (!id) return;
  if (!confirm('Excluir esta transação?')) return;
  state.transactions = state.transactions.filter(t => t.id !== id);
  tombstone('tombstones', id);
  saveState();
  txDialog.close();
  refreshAll();
  toast('Excluído');
});

// ====== Categorias ======
const catDialog = document.getElementById('catDialog');
const catForm = document.getElementById('catForm');
const catDelete = document.getElementById('catDelete');

document.getElementById('addCategory').addEventListener('click', () => openCatDialog(null));

/* ---------- TELA: COMPROMISSOS ---------- */
function pct(a, b) { return b > 0 ? Math.min(100, Math.round(a / b * 100)) : 0; }

function cmtItemHTML(c) {
  const cat = categoryByName(c.categoria) || { color: '#888', icon: '🏷️' };
  if (c.kind === 'divida') return dividaItemHTML(c, cat);
  const p = pct(c.pagas, c.n);
  const jaPago = c.kind === 'financiamento' && c.total ? '' :
    `<span>${fmt.format(c.pago)} pagos</span>`;
  /* a linha do banco vale mesmo sem extrato oficial (só o nome já situa) */
  const juros = (c.kind === 'financiamento' && (c.valorFinanciado || c.banco))
    ? `<div class="cmt-juros">${c.banco ? '<b>' + escapeHTML(c.banco) + '</b> · ' : ''}${c.valorFinanciado ? 'financiado ' + fmt.format(c.valorFinanciado) : 'sem extrato oficial ainda'}${c.taxaAnual ? ' · ' + String(c.taxaAnual).replace('.', ',') + '% a.a' : ''}${c.sistema ? ' · ' + escapeHTML(c.sistema) : ''}${c.diaDebito ? ' · debita dia ' + c.diaDebito : ''}</div>`
    : '';
  return `<li class="cmt-item${c.quitado ? ' quitado' : ''}" data-cmt="${escapeHTML(c.id)}">
    <div class="cmt-top">
      <span class="cmt-ico" style="background:${cat.color}22;color:${cat.color}">${escapeHTML(cat.icon || '🏷️')}</span>
      <div class="cmt-id">
        <strong>${escapeHTML(c.descricao)}</strong>
        <small class="muted">${c.kind === 'financiamento' ? 'Financiamento' : 'Parcelamento'} · ${escapeHTML(c.categoria || '')}</small>
      </div>
      <div class="cmt-num">
        <strong>${c.pagas}/${c.n}</strong>
        <small class="muted">${c.quitado ? 'quitado' : 'faltam ' + c.restantes}</small>
      </div>
    </div>
    <div class="cmt-bar"><div style="width:${p}%"></div></div>
    <div class="cmt-foot">
      ${jaPago}
      ${c.quitado ? '' : `<span class="cmt-falta"><b>${fmt.format(c.aPagar)}</b> ${c.aPagarOficial ? 'de saldo devedor' : 'a pagar'}${c.estimado ? ' <small class="muted">(estimado)</small>' : ''}${c.aPagarOficial && c.dataSaldo ? ` <small class="muted">em ${new Date(c.dataSaldo + 'T00:00:00').toLocaleDateString('pt-BR')}</small>` : ''}</span>`}
      <span class="muted">${fmt.format(c.valorParcela)}/mês${c.quitado ? '' : (c.ultimaProjetada ? ' · termina por volta de ' : ' · última em ') + monthLongFmt.format(new Date(c.ultima + 'T00:00:00'))}</span>
    </div>
    ${juros}
  </li>`;
}

/* Dívida sem cronograma: o que importa é quanto já foi abatido do total. */
function dividaItemHTML(c, cat) {
  const p = c.total ? pct(c.pago, c.total) : 0;
  return `<li class="cmt-item${c.quitado ? ' quitado' : ''}" data-cmt="${escapeHTML(c.id)}">
    <div class="cmt-top">
      <span class="cmt-ico" style="background:${cat.color}22;color:${cat.color}">${escapeHTML(cat.icon || '🤝')}</span>
      <div class="cmt-id">
        <strong>${escapeHTML(c.descricao)}</strong>
        <small class="muted">Dívida${c.credor ? ' · ' + escapeHTML(c.credor) : ''} · sem prazo fixo</small>
      </div>
      <div class="cmt-num">
        <strong>${p}%</strong>
        <small class="muted">${c.quitado ? 'quitada' : 'abatido'}</small>
      </div>
    </div>
    <div class="cmt-bar"><div style="width:${p}%"></div></div>
    <div class="cmt-foot">
      <span>${fmt.format(c.pago)} pagos de ${fmt.format(c.total)}</span>
      ${c.quitado ? '' : `<span class="cmt-falta"><b>${fmt.format(c.aPagar)}</b> em aberto</span>`}
      <span class="muted">${c.pagas} pagamento${c.pagas === 1 ? '' : 's'}</span>
    </div>
    ${c.quitado ? '' : `<div class="cmt-acao"><button type="button" class="primary" data-pagar="${escapeHTML(c.id)}">Registrar pagamento</button></div>`}
  </li>`;
}

function renderCompromissos() {
  const todos = compromissos();
  const abertos = todos.filter(c => !c.quitado);
  const quitados = todos.filter(c => c.quitado);
  const listaEl = document.getElementById('cmtList');
  const doneEl = document.getElementById('cmtDone');
  if (!listaEl) return;

  /* São bichos diferentes: parcelamento tem parcela fixa e o total é
     parcela × N; financiamento tem parcela que muda todo mês (SAC + TR) e o
     que importa é o saldo devedor. Misturar os dois numa lista só confunde. */
  const fin = abertos.filter(c => c.kind === 'financiamento');
  const div = abertos.filter(c => c.kind === 'divida');
  const par = abertos.filter(c => c.kind !== 'financiamento' && c.kind !== 'divida');
  const bloco = (titulo, lista) => lista.length
    ? `<li class="cmt-grupo">${titulo}</li>` + lista.map(cmtItemHTML).join('') : '';
  listaEl.innerHTML = abertos.length
    ? bloco('Financiamentos', fin) + bloco('Dívidas sem prazo', div) + bloco('Parcelamentos', par)
    : '<li class="empty">Nenhum compromisso em aberto. Ao lançar uma despesa parcelada — ou cadastrar uma dívida — ela aparece aqui.</li>';
  doneEl.innerHTML = quitados.length ? quitados.map(cmtItemHTML).join('')
    : '<li class="empty muted small">Nada quitado ainda.</li>';

  /* resumo do topo: o número que interessa é o que ainda falta sair do bolso */
  const aPagar = abertos.reduce((s, c) => s + c.aPagar, 0);
  const porMes = abertos.reduce((s, c) => s + c.valorParcela, 0);
  const dividaFin = fin.reduce((s, c) => s + c.aPagar, 0);
  const resumo = document.getElementById('cmtResumo');
  resumo.innerHTML = `
    <div class="cmt-kpi"><span class="muted small">Dívida total</span><strong>${fmt.format(aPagar)}</strong></div>
    <div class="cmt-kpi"><span class="muted small">Sai por mês</span><strong>${fmt.format(porMes)}</strong></div>
    <div class="cmt-kpi"><span class="muted small">Só imóveis</span><strong>${fmt.format(dividaFin)}</strong></div>`;

  /* projeção: quanto de cada mês já está comprometido */
  const proj = comprometimentoPorMes(12).filter(m => m.total > 0);
  const projEl = document.getElementById('cmtProj');
  if (!proj.length) { projEl.innerHTML = '<p class="muted small">Nenhuma parcela futura.</p>'; }
  else {
    const max = Math.max(...proj.map(m => m.total));
    projEl.innerHTML = proj.map(m => `
      <div class="proj-row">
        <span class="proj-m">${m.ref.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}</span>
        <div class="proj-bar"><div style="width:${pct(m.total, max)}%"></div></div>
        <span class="proj-v">${fmt.format(m.total)}</span>
      </div>`).join('');
  }

  /* o botão de pagar não pode abrir o detalhe junto */
  listaEl.querySelectorAll('[data-pagar]').forEach(b => b.addEventListener('click', (e) => {
    e.stopPropagation(); abrirPagamentoDivida(b.dataset.pagar);
  }));
  listaEl.querySelectorAll('.cmt-item').forEach(el => el.addEventListener('click', () => openCmtDetail(el.dataset.cmt)));
  doneEl.querySelectorAll('.cmt-item').forEach(el => el.addEventListener('click', () => openCmtDetail(el.dataset.cmt)));
}

/* Detalhe do compromisso: a lista de parcelas, marcando o que já passou */
function openCmtDetail(id) {
  const c = compromissos().find(x => x.id === id);
  if (!c) return;
  const hoje = todayISO();
  const linhas = c.txs.map((t, i) => {
    const paga = !t.pending && t.date <= hoje;
    return `<div class="par-row${paga ? ' paga' : ''}">
      <span class="par-k">${i + 1}/${c.n}</span>
      <span class="par-d">${new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
      <span class="par-v">${fmt.format(t.amount)}</span>
      <span class="par-s">${paga ? '✓ paga' : 'pendente'}</span>
    </div>`;
  }).join('');
  const body = document.getElementById('txDetailBody');
  body.innerHTML = `
    <div class="det-hero"><strong>${escapeHTML(c.descricao)}</strong><span>${fmt.format(c.valorParcela)}<small>/mês</small></span></div>
    <div class="det-grid">
      <div><span class="muted small">Tipo</span><b>${c.kind === 'financiamento' ? 'Financiamento' : 'Parcelamento'}</b></div>
      <div><span class="muted small">Parcelas</span><b>${c.pagas} de ${c.n}</b></div>
      <div><span class="muted small">Já pago</span><b>${fmt.format(c.pago)}</b></div>
      <div><span class="muted small">Falta pagar</span><b>${fmt.format(c.aPagar)}</b></div>
      ${c.valorFinanciado ? `<div><span class="muted small">Valor financiado</span><b>${fmt.format(c.valorFinanciado)}</b></div>
      <div><span class="muted small">Juros no total</span><b>${fmt.format(c.totalParcelas - c.valorFinanciado)}</b></div>` : ''}
      <div><span class="muted small">Categoria</span><b>${escapeHTML(c.categoria || '—')}</b></div>
      <div><span class="muted small">Última parcela</span><b>${new Date(c.ultima + 'T00:00:00').toLocaleDateString('pt-BR')}</b></div>
    </div>
    <div class="cmt-bar big"><div style="width:${pct(c.pagas, c.n)}%"></div></div>
    ${c.estimado ? `<p class="muted small" style="margin:8px 0 0">Só ${c.lancadas} das ${c.n} parcelas estão lançadas. O que falta é estimado pelo valor da parcela — lance as próximas para o número ficar exato.</p>` : ''}
    <h4 class="muted small uppercase" style="margin:16px 0 6px">Parcelas lançadas</h4>
    <div class="par-list">${linhas}</div>`;
  document.getElementById('txDetailDel').hidden = true;
  document.getElementById('txDetailEdit').hidden = true;
  document.getElementById('txDetail').showModal();
}

function renderCategories() {
  renderAccounts();
  const exp = state.categories.filter(c => c.type === 'expense');
  const inc = state.categories.filter(c => c.type === 'income');
  document.getElementById('catExpenseList').innerHTML = exp.map(catItemHTML).join('') || `<li class="empty">Sem categorias.</li>`;
  document.getElementById('catIncomeList').innerHTML = inc.map(catItemHTML).join('') || `<li class="empty">Sem categorias.</li>`;
  document.querySelectorAll('.cat-item').forEach(el => {
    el.addEventListener('click', () => openCatDialog(el.dataset.id));
  });
}
function catItemHTML(c) {
  const count = state.transactions.filter(t => t.category === c.name).length;
  return `<li class="cat-item" data-id="${c.id}">
    <div class="icon" style="background:${c.color}22;color:${c.color}">${c.icon}</div>
    <span class="name">${escapeHTML(c.name)}</span>
    <span class="badge">${count} lançamento${count === 1 ? '' : 's'}</span>
  </li>`;
}

function openCatDialog(id) {
  catForm.reset();
  const editing = id ? state.categories.find(c => c.id === id) : null;
  document.getElementById('catDialogTitle').textContent = editing ? 'Editar categoria' : 'Nova categoria';
  catDelete.hidden = !editing;
  catForm.dataset.id = editing?.id || '';
  if (editing) {
    catForm.querySelector(`input[name=type][value=${editing.type}]`).checked = true;
    catForm.name.value = editing.name;
    catForm.icon.value = editing.icon || '🏷️';
    catForm.color.value = editing.color || '#6366f1';
    catForm.goal.value = editing.goal || '';
  }
  catDialog.showModal();
}

catForm.addEventListener('submit', e => {
  e.preventDefault();
  const data = new FormData(catForm);
  const obj = {
    id: catForm.dataset.id || cid(),
    type: data.get('type'),
    name: data.get('name').trim(),
    icon: data.get('icon') || '🏷️',
    color: data.get('color') || '#6366f1',
    goal: Math.max(0, parseFloat(data.get('goal')) || 0) || null,
    updatedAt: Date.now(),
  };
  if (!obj.name) return;
  const idx = state.categories.findIndex(c => c.id === obj.id);
  if (idx >= 0) {
    const old = state.categories[idx];
    state.categories[idx] = obj;
    if (old.name !== obj.name) {
      state.transactions.forEach(t => { if (t.category === old.name) t.category = obj.name; });
      state.fixedItems.forEach(f => { if (f.category === old.name) f.category = obj.name; });
    }
  } else {
    state.categories.push(obj);
  }
  saveState();
  catDialog.close();
  refreshAll();
  toast(idx >= 0 ? 'Categoria atualizada' : 'Categoria criada');
});

catDelete.addEventListener('click', () => {
  const id = catForm.dataset.id;
  if (!id) return;
  const cat = state.categories.find(c => c.id === id);
  if (!cat) return;
  const used = state.transactions.some(t => t.category === cat.name) || state.fixedItems.some(f => f.category === cat.name);
  if (used && !confirm('Esta categoria está em uso. Excluir mesmo assim? Os lançamentos serão remarcados como "Outros".')) return;
  if (used) {
    state.transactions.forEach(t => { if (t.category === cat.name) t.category = 'Outros'; });
    state.fixedItems.forEach(f => { if (f.category === cat.name) f.category = 'Outros'; });
  }
  (state.categoryTombstones = state.categoryTombstones || []).push({ id, at: Date.now() });
  state.categories = state.categories.filter(c => c.id !== id);
  saveState();
  catDialog.close();
  refreshAll();
  toast('Categoria excluída');
});

// ====== Fixos ======
const fixedDialog = document.getElementById('fixedDialog');
const fixedForm = document.getElementById('fixedForm');
const fixedDelete = document.getElementById('fixedDelete');

document.getElementById('addFixed').addEventListener('click', () => openFixedDialog(null));

fixedForm.querySelectorAll('input[name=type]').forEach(r => {
  r.addEventListener('change', e => fillCategorySelect(fixedForm.category, e.target.value));
});

function renderFixed() {
  // Ordena: mensais antes; depois anuais ordenados por mês de cobrança
  const order = (a, b) => {
    const ay = a.frequency === 'yearly' ? 1 : 0;
    const by = b.frequency === 'yearly' ? 1 : 0;
    if (ay !== by) return ay - by;
    if (ay) return (a.month || 0) - (b.month || 0);
    return a.name.localeCompare(b.name);
  };
  const inc = state.fixedItems.filter(f => f.type === 'income').sort(order);
  const exp = state.fixedItems.filter(f => f.type === 'expense').sort(order);
  document.getElementById('fixedIncomeList').innerHTML = inc.map(fixedItemHTML).join('') || `<li class="empty">Nenhuma receita fixa.</li>`;
  document.getElementById('fixedExpenseList').innerHTML = exp.map(fixedItemHTML).join('') || `<li class="empty">Nenhuma despesa fixa.</li>`;
  document.querySelectorAll('[data-fixedid]').forEach(el => {
    el.addEventListener('click', () => openFixedDialog(el.dataset.fixedid));
  });
}
const MONTH_NAMES_PT = ['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// Retorna os fixos que CONTAM para um mês de referência:
// - frequency 'monthly' (ou undefined, retrocompat): sempre
// - frequency 'yearly': só no mês configurado
function fixedItemsActiveIn(refDate) {
  const m = refDate.getMonth() + 1;
  return state.fixedItems.filter(f => {
    if (f.frequency === 'yearly') return Number(f.month) === m;
    return true;
  });
}

function fixedItemHTML(f) {
  const cat = categoryByName(f.category) || { color: '#888', icon: '🏷️' };
  const isYearly = f.frequency === 'yearly';
  const freqLabel = isYearly ? `1×/ano em ${MONTH_NAMES_PT[f.month] || '—'}` : 'mensal';
  return `<li class="cat-item" data-fixedid="${f.id}">
    <div class="icon" style="background:${cat.color}22;color:${cat.color}">${cat.icon}</div>
    <div style="flex:1;min-width:0">
      <div class="name">${escapeHTML(f.name)}</div>
      <div class="badge">${fmt.format(f.amount)} · ${escapeHTML(f.category)} · ${freqLabel}</div>
    </div>
  </li>`;
}

// Mostra/esconde o campo "mês" conforme a frequência
function syncFixedFrequencyUI() {
  const freq = fixedForm.querySelector('input[name=frequency]:checked')?.value || 'monthly';
  const monthField = document.getElementById('fixedMonthField');
  const amountLabel = document.querySelector('#fixedAmountField span');
  monthField.classList.toggle('hidden', freq !== 'yearly');
  if (amountLabel) amountLabel.textContent = freq === 'yearly' ? 'Valor (1× no ano)' : 'Valor mensal';
}
fixedForm.querySelectorAll('input[name=frequency]').forEach(r => {
  r.addEventListener('change', syncFixedFrequencyUI);
});

function openFixedDialog(id) {
  fixedForm.reset();
  const editing = id ? state.fixedItems.find(f => f.id === id) : null;
  document.getElementById('fixedDialogTitle').textContent = editing ? 'Editar fixo' : 'Novo fixo';
  fixedDelete.hidden = !editing;
  fixedForm.dataset.id = editing?.id || '';
  const type = editing?.type || 'expense';
  fixedForm.querySelector(`input[name=type][value=${type}]`).checked = true;
  const freq = editing?.frequency || 'monthly';
  fixedForm.querySelector(`input[name=frequency][value=${freq}]`).checked = true;
  fillCategorySelect(fixedForm.category, type);
  if (editing) {
    fixedForm.name.value = editing.name;
    fixedForm.amount.value = editing.amount;
    fixedForm.category.value = editing.category;
    if (editing.month) fixedForm.month.value = String(editing.month);
  } else {
    fixedForm.month.value = String((currentMonth.getMonth() + 1));
  }
  syncFixedFrequencyUI();
  fixedDialog.showModal();
}

fixedForm.addEventListener('submit', e => {
  e.preventDefault();
  const data = new FormData(fixedForm);
  const frequency = data.get('frequency') || 'monthly';
  const obj = {
    id: fixedForm.dataset.id || cid(),
    type: data.get('type'),
    name: data.get('name').trim(),
    amount: parseFloat(data.get('amount')),
    category: data.get('category') || 'Outros',
    frequency,
  };
  if (frequency === 'yearly') {
    obj.month = parseInt(data.get('month') || '1', 10);
  }
  if (!obj.name || !obj.amount) return;
  const idx = state.fixedItems.findIndex(f => f.id === obj.id);
  stampTx(obj);
  if (idx >= 0) state.fixedItems[idx] = obj;
  else state.fixedItems.push(obj);
  saveState();
  fixedDialog.close();
  refreshAll();
  toast(idx >= 0 ? 'Atualizado' : 'Adicionado');
});

fixedDelete.addEventListener('click', () => {
  const id = fixedForm.dataset.id;
  if (!id) return;
  if (!confirm('Excluir este item fixo?')) return;
  state.fixedItems = state.fixedItems.filter(f => f.id !== id);
  tombstone('fixedTombstones', id);
  saveState();
  fixedDialog.close();
  refreshAll();
  toast('Excluído');
});

// Upload de planilha de fixos
document.getElementById('fixedSheet').addEventListener('change', async e => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  toast('Analisando planilha…', 6000);
  try {
    const { items } = await Gemini.analyzeFixedSheet(file, state.categories);
    if (!items?.length) { toast('Nenhum item encontrado'); return; }
    for (const it of items) {
      ensureCategory(it.category, it.type);
      state.fixedItems.push({
        id: cid(), type: it.type, name: it.name,
        amount: Number(it.amount) || 0, category: it.category,
        updatedAt: Date.now(),
      });
    }
    saveState();
    refreshAll();
    toast(`${items.length} itens importados`);
  } catch (err) {
    console.error(err);
    toast('Erro: ' + err.message);
  }
});

function ensureCategory(name, type) {
  if (!name) return;
  const existing = categoryByName(name, type);
  if (existing) return existing;
  const c = { id: cid(), name, type: type || 'expense', icon: '🏷️', color: '#6366f1', updatedAt: Date.now() };
  state.categories.push(c);
  return c;
}

// ====== IA ======
const aiOutput = document.getElementById('aiOutput');

// Tabs
document.querySelectorAll('.ai-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.aitab;
    document.querySelectorAll('.ai-tab').forEach(b => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.ai-pane').forEach(p => p.classList.toggle('hidden', p.dataset.aipane !== tab));
  });
});

// Chips de sugestão preenchem o textarea
document.querySelectorAll('.chip-suggestion').forEach(c => {
  c.addEventListener('click', () => {
    document.getElementById('aiQuestion').value = c.dataset.q;
    document.getElementById('aiQuestion').focus();
  });
});

document.getElementById('aiAsk').addEventListener('click', () => {
  const q = document.getElementById('aiQuestion').value.trim();
  if (!q) { toast('Digite uma pergunta'); return; }
  runAnalysis(q);
});

document.getElementById('aiDeep').addEventListener('click', () => runDeepAnalysis());

async function runAnalysis(question = '') {
  showAIOutput(`<p class="muted">Analisando…</p>`);
  try {
    const text = await Gemini.analyzeMonth({
      transactions: txOfMonth(),
      categories: state.categories,
      fixedItems: state.fixedItems,
      monthLabel: monthLongFmt.format(currentMonth),
      customQuestion: question,
    });
    showAIOutput(safeMD(text));
  } catch (err) {
    showAIOutput(`<p style="color:var(--expense)">Erro: ${escapeHTML(err.message)}</p>`);
  }
}

async function runDeepAnalysis() {
  if (!state.transactions.length) {
    showAIOutput(`<p>Você ainda não tem transações. Lance alguns gastos primeiro.</p>`);
    return;
  }
  showAIOutput(`<p class="muted">Analisando todos os seus gastos… (pode levar 10-30 segundos)</p>`);
  try {
    const text = await Gemini.deepAnalysis({
      transactions: state.transactions,
      categories: state.categories,
      fixedItems: state.fixedItems,
    });
    showAIOutput(safeMD(text));
  } catch (err) {
    showAIOutput(`<p style="color:var(--expense)">Erro: ${escapeHTML(err.message)}</p>`);
  }
}

function showAIOutput(html) {
  aiOutput.hidden = false;
  aiOutput.innerHTML = html;
  aiOutput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderAI() { /* tabs assumem o estado inicial via HTML */ }

// Anexar arquivo (fatura/extrato)
document.getElementById('invoiceFile').addEventListener('change', async e => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  showAIOutput(`<p class="muted">Lendo arquivo… (pode levar até 30s)</p>`);
  try {
    const { items } = await Gemini.analyzeInvoice(file, state.categories);
    if (!items?.length) { showAIOutput(`<p>Nenhuma transação detectada no arquivo.</p>`); return; }

    showAIOutput(`
      <h3>Transações detectadas (${items.length})</h3>
      <p class="muted small">Revise e confirme para importar.</p>
      <ul class="tx-list">
        ${items.map((it, i) => `<li class="tx-item">
          <div class="icon" style="background:#ef444422;color:#ef4444">🧾</div>
          <div class="meta">
            <span class="desc">${escapeHTML(it.description)}</span>
            <span class="sub">${escapeHTML(it.date)} · ${escapeHTML(it.category)}</span>
          </div>
          <span class="val expense">− ${fmt.format(Number(it.amount) || 0)}</span>
        </li>`).join('')}
      </ul>
      <div class="row gap" style="margin-top:12px">
        <button id="invConfirm" class="primary">Importar tudo</button>
        <button id="invCancel" class="ghost">Cancelar</button>
      </div>
    `);
    document.getElementById('invConfirm').onclick = () => {
      for (const it of items) {
        ensureCategory(it.category, 'expense');
        state.transactions.push({
          id: cid(), type: 'expense',
          amount: Number(it.amount) || 0,
          description: it.description,
          category: it.category,
          date: it.date,
          updatedAt: Date.now(),
        });
      }
      saveState();
      refreshAll();
      toast(`${items.length} lançamentos importados`);
      aiOutput.hidden = true;
      aiOutput.innerHTML = '';
      navigate('transacoes');
    };
    document.getElementById('invCancel').onclick = () => {
      aiOutput.hidden = true;
      aiOutput.innerHTML = '';
    };
  } catch (err) {
    showAIOutput(`<p style="color:var(--expense)">Erro: ${escapeHTML(err.message)}</p>`);
  }
});

// ====== Áudio ======
const micBtn = document.getElementById('micBtn');
const audioDialog = document.getElementById('audioDialog');
const audioRecord = document.getElementById('audioRecord');
const audioStop = document.getElementById('audioStop');
const audioVisual = document.getElementById('audioVisual');
const audioTime = document.getElementById('audioTime');
const audioResult = document.getElementById('audioResult');
const audioHint = document.getElementById('audioHint');
let mediaRecorder = null;
let recChunks = [];
let recStart = 0;
let recTimer = null;

micBtn.addEventListener('click', () => {
  audioResult.innerHTML = '';
  audioTime.textContent = '0:00';
  audioHint.style.display = '';
  audioDialog.showModal();
});

audioRecord.addEventListener('click', startRecording);
audioStop.addEventListener('click', stopRecording);

async function startRecording() {
  try {
    // Constraints de áudio mono + sample rate baixo já reduzem tamanho final
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      }
    });
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
      : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '';
    // 24 kbps é suficiente pra fala — Gemini transcreve tranquilo, e fica bem abaixo
    // do limite do gateway (Express default ~100KB no body).
    const options = { audioBitsPerSecond: 24000 };
    if (mime) options.mimeType = mime;
    mediaRecorder = new MediaRecorder(stream, options);
    recChunks = [];
    mediaRecorder.ondataavailable = e => { if (e.data.size) recChunks.push(e.data); };
    mediaRecorder.onstop = onRecordingDone;
    mediaRecorder.start();
    recStart = Date.now();
    recTimer = setInterval(() => {
      const s = Math.floor((Date.now() - recStart) / 1000);
      const m = Math.floor(s / 60);
      audioTime.textContent = `${m}:${String(s % 60).padStart(2, '0')}`;
      if (s >= 30) stopRecording();   // trava ~30s: mantém o áudio pequeno o bastante p/ o gateway
    }, 250);
    audioRecord.hidden = true;
    audioStop.hidden = false;
    audioVisual.classList.add('rec');
    audioHint.style.display = 'none';
  } catch (err) {
    toast('Sem permissão de microfone');
    console.error(err);
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(t => t.stop());
  }
  clearInterval(recTimer);
  audioRecord.hidden = false;
  audioStop.hidden = true;
  audioVisual.classList.remove('rec');
}

async function onRecordingDone() {
  const blob = new Blob(recChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
  audioResult.innerHTML = `<p class="muted">Interpretando áudio…</p>`;
  try {
    const r = await Gemini.classifyAudio(blob, state.categories);
    ensureCategory(r.category, r.type);
    const tx = {
      id: cid(),
      type: r.type,
      amount: Number(r.amount) || 0,
      description: r.description || r.transcription || 'Lançamento por voz',
      category: r.category || 'Outros',
      date: r.date || todayISO(),
    };
    audioResult.innerHTML = `
      <p class="muted small">"${escapeHTML(r.transcription || '')}"</p>
      <h3>${tx.type === 'income' ? 'Receita' : 'Despesa'} detectada</h3>
      <ul>
        <li><strong>Valor:</strong> ${fmt.format(tx.amount)}</li>
        <li><strong>Descrição:</strong> ${escapeHTML(tx.description)}</li>
        <li><strong>Categoria:</strong> ${escapeHTML(tx.category)}</li>
        <li><strong>Data:</strong> ${escapeHTML(tx.date)}</li>
      </ul>
      <div class="row gap" style="margin-top:10px">
        <button id="audConfirm" class="primary">Salvar</button>
        <button id="audEdit" class="ghost">Editar antes</button>
        <button id="audCancel" class="danger">Descartar</button>
      </div>
    `;
    document.getElementById('audConfirm').onclick = () => {
      stampTx(tx);
      state.transactions.push(tx);
      saveState();
      audioDialog.close();
      refreshAll();
      toast('Lançado por voz');
    };
    document.getElementById('audEdit').onclick = () => {
      audioDialog.close();
      openTxDialog(null);
      txForm.querySelector(`input[name=type][value=${tx.type}]`).checked = true;
      fillCategorySelect(txForm.category, tx.type);
      txForm.amount.value = tx.amount;
      txForm.description.value = tx.description;
      txForm.category.value = tx.category;
      txForm.date.value = tx.date;
    };
    document.getElementById('audCancel').onclick = () => { audioResult.innerHTML = ''; };
  } catch (err) {
    audioResult.innerHTML = `<p style="color:var(--expense)">Erro: ${escapeHTML(err.message)}</p>`;
  }
}

// ====== Settings ======
const settingsDialog = document.getElementById('settingsDialog');
const settingsForm = document.getElementById('settingsForm');

document.getElementById('btnSettings').addEventListener('click', () => {
  settingsDialog.showModal();
});
settingsForm.addEventListener('submit', e => {
  e.preventDefault();
  settingsDialog.close();
});

document.getElementById('wipeData').addEventListener('click', () => {
  if (!confirm('Apagar TODOS os dados? Esta ação não pode ser desfeita.')) return;
  Object.assign(state, defaultState());
  saveState();
  settingsDialog.close();
  refreshAll();
  toast('Dados apagados');
});

// Botão "+ Lançar" no Resumo (primeira aba) — abre o lançamento direto
const _dashLancar = document.getElementById('dashLancar');
if (_dashLancar) _dashLancar.addEventListener('click', () => openTxDialog(null));

// Nav "Transações" apenas NAVEGA (criar = botão + Lançar flutuante/dashboard).
// A versão que abria o modal a cada clique tornava impossível só OLHAR a lista.

// Fechar diálogos via [data-close]
document.querySelectorAll('[data-close]').forEach(b => {
  b.addEventListener('click', () => b.closest('dialog')?.close());
});

// Botão flutuante de nova transação na tela transacoes
function ensureNewTxButton() {
  const view = document.querySelector('[data-view=transacoes]');
  if (view.querySelector('.new-tx-fab')) return;
  const btn = document.createElement('button');
  btn.className = 'new-tx-fab';
  btn.textContent = '+ Lançar';
  btn.addEventListener('click', () => openTxDialog(null));
  view.appendChild(btn);
  const sync = () => { btn.style.display = view.classList.contains('hidden') ? 'none' : ''; };
  new MutationObserver(sync).observe(view, { attributes: true, attributeFilter: ['class'] });
  sync();
}

// Instalação PWA
let deferredPrompt;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('btnInstall').hidden = false;
});
document.getElementById('btnInstall').addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  document.getElementById('btnInstall').hidden = true;
});

// ====== Refresh ======
const ehDesktop = () => window.matchMedia('(min-width: 1024px)').matches;

/* Cabeçalho da tabela — só no desktop, onde a lista vira tabela de verdade. */
function aplicarTabelaTx() {
  const ul = document.getElementById('txList');
  if (!ul) return;
  const desk = ehDesktop();
  ul.classList.toggle('as-table', desk);
  const antigo = ul.querySelector('.tx-head');
  if (antigo) antigo.remove();
  if (desk && ul.children.length) {
    const th = document.createElement('li');
    th.className = 'tx-item tx-head';
    th.innerHTML = '<span>Descrição</span><span>Categoria</span><span>Conta</span><span class="txc-r">Valor</span>';
    ul.prepend(th);
  }
}

/* Coluna da direita do painel: o que estava só na aba Parcelas. */
function renderDashLateral() {
  const box = document.getElementById('dashCompromissos');
  if (box) {
    const abertos = compromissos().filter(c => !c.quitado);
    if (!abertos.length) { box.hidden = true; }
    else {
      box.hidden = false;
      const aPagar = abertos.reduce((s, c) => s + c.aPagar, 0);
      const mes = abertos.reduce((s, c) => s + c.valorParcela, 0);
      box.innerHTML = `<div class="card-head row between"><span class="card-label">Parcelas em aberto</span>
          <button class="link" data-nav="compromissos">ver →</button></div>
        <div class="dashcmt-kpis"><div><span class="muted small">Por mês</span><strong>${fmt.format(mes)}</strong></div>
        <div><span class="muted small">Falta pagar</span><strong>${fmt.format(aPagar)}</strong></div></div>
        ${abertos.slice(0, 3).map(c => `<div class="dashcmt-row"><span>${escapeHTML(c.descricao)}</span>
          <span class="muted small">${c.pagas}/${c.n}</span></div>`).join('')}`;
      box.querySelector('[data-nav]')?.addEventListener('click', () => navigate('compromissos'));
    }
  }
  const fat = document.getElementById('dashFaturas');
  if (fat) {
    const cartoes = (state.accounts || []).filter(a => a.kind === 'cartao');
    if (!cartoes.length) { fat.innerHTML = ''; }
    else {
      const ref = new Date();
      fat.innerHTML = `<div class="section-title"><h3>Fatura aberta</h3></div><div class="fat-list">` +
        cartoes.map(c => {
          const tot = faturaDoCartao(c, ref).reduce((s, t) => s + (+t.amount || 0), 0);
          return `<div class="fat-row"><span class="dot" style="background:${escapeHTML(c.color || '#6366f1')}"></span>
            <div class="fat-id"><strong>${escapeHTML(c.name)}</strong></div>
            <div class="fat-v"><strong>${fmt.format(tot)}</strong></div></div>`;
        }).join('') + '</div>';
    }
  }
}

function refreshAll() {
  renderDashboard();
  renderDashLateral();
  renderProjecao();
  if (!document.querySelector('[data-view=transacoes]').classList.contains('hidden')) { renderTransactions(); aplicarTabelaTx(); }
  if (!document.querySelector('[data-view=categorias]').classList.contains('hidden')) renderCategories();
  if (!document.querySelector('[data-view=fixos]').classList.contains('hidden')) renderFixed();
  if (!document.querySelector('[data-view=compromissos]').classList.contains('hidden')) { renderCompromissos(); renderFaturas(); }
}

// ====== Conta (login central MedTech via window.MT) ======
// A tela de login é renderizada pelo módulo _mtauth.js (a mesma de todos os apps).
const userNameEl = document.getElementById('userName');

document.getElementById('logoutBtn').addEventListener('click', async () => {
  if (!confirm('Sair da conta MedTech?')) return;
  document.getElementById('settingsDialog').close();
  if (window.MT && window.MT.signOut) window.MT.signOut();
});

// ====== Boot: liga na nuvem da conta MedTech ======
ensureNewTxButton();
refreshAll();
(function waitMT() {
  if (window.MT && window.MT.onData) {
    window.MT.mergeFn = granaeMergeFn;
    window.MT.onData((d) => {
      const u = window.MT.user;
      currentUid = u ? u.uid : null;
      window.currentUid = currentUid;
      applyData(d);
    });
  } else {
    setTimeout(waitMT, 40);
  }
})();


// ====== Limpar todos os filtros das Transações ======
function limparFiltrosTx() {
  categoryFilter = null;
  const q = document.getElementById('txSearch'); if (q) q.value = '';
  const ft = document.getElementById('filterType'); if (ft) ft.value = 'all';
  renderTransactions();
}
window.limparFiltrosTx = limparFiltrosTx;

// ====== Abas do dashboard (Resumo | Gráficos) ======
document.querySelectorAll('#dashTabs button').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('#dashTabs button').forEach(x => x.classList.toggle('on', x === b));
    const g = b.dataset.dtab === 'graficos';
    document.getElementById('dashResumo').hidden = g;
    document.getElementById('dashGraficos').hidden = !g;
  });
});

// ====== Busca ======
document.getElementById('txSearch')?.addEventListener('input', () => renderTransactions());

// ====== Preview do parcelamento ======
(function () {
  const upd = () => {
    const h = document.getElementById('parcelasHint'); if (!h) return;
    const n = parseInt(txForm.parcelas?.value) || 1;
    const v = parseFloat(txForm.amount?.value) || 0;
    h.textContent = (n > 1 && v > 0) ? `${n}× de ${fmt.format(v)} = ${fmt.format(n * v)} no total` : '';
  };
  txForm.parcelas?.addEventListener('change', upd);
  txForm.amount?.addEventListener('input', upd);
})();

// ====== Duplicar p/ hoje ======
document.getElementById('txDup')?.addEventListener('click', () => {
  const data = new FormData(txForm);
  const obj = stampTx({ id: cid(), type: data.get('type'), amount: parseFloat(data.get('amount')),
    description: data.get('description').trim(), category: data.get('category'), date: todayISO() });
  if (!obj.amount || !obj.description) return;
  state.transactions.push(obj);
  saveState(); txDialog.close(); refreshAll();
  toast('Duplicado para hoje');
});

// ====== Export CSV do mês ======
document.getElementById('txCsv')?.addEventListener('click', () => {
  const csvField = v => { let x = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(x)) x = "'" + x; return /[",\n\r]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
  const rows = [['Data', 'Tipo', 'Descrição', 'Categoria', 'Valor', 'Status']]
    .concat(state.transactions.filter(t => inMonth(t.date, currentMonth))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(t => [t.date, t.type === 'income' ? 'Receita' : 'Despesa', t.description, t.category,
        String(t.amount).replace('.', ','), t.pending ? 'Agendado' : 'Efetivado']));
  const csv = rows.map(r => r.map(csvField).join(';')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
  const ym = currentMonth.getFullYear() + '-' + String(currentMonth.getMonth() + 1).padStart(2, '0');
  a.download = `granae-${ym}.csv`; a.click(); URL.revokeObjectURL(a.href);
  toast('CSV do mês baixado');
});

// ====== Análise IA do mês (atalho) ======
document.getElementById('aiMonthBtn')?.addEventListener('click', () => {
  navigate('ia');
  const q = document.getElementById('aiQuestion');
  if (q) q.value = `Análise completa de ${monthLongFmt.format(currentMonth)}: receitas, despesas por categoria (com % do total), comparação com fixos e metas, gastos atípicos e 3 recomendações práticas.`;
  setTimeout(() => document.getElementById('aiAsk')?.click(), 250);
});

// ====== Detalhe do lançamento: fechar / editar / excluir ======
document.querySelector('[data-close-detail]')?.addEventListener('click', () => txDetail.close());
document.getElementById('txDetailEdit')?.addEventListener('click', () => {
  txDetail.close();
  if (_detalheId) openTxDialog(_detalheId);
});
document.getElementById('txDetailDel')?.addEventListener('click', () => {
  if (!_detalheId) return;
  const t = state.transactions.find(x => x.id === _detalheId);
  if (!t) return;
  if (!confirm(`Excluir "${t.description}"?`)) return;
  tombstone('tombstones', _detalheId);
  saveState(); txDetail.close(); refreshAll();
  toast('Excluído');
});

// ====== Financiamento ======
// Parcelamento e financiamento geram as MESMAS parcelas mensais; o que muda é
// o metadado (valor financiado, juros) guardado em state.commitments.
const cmtDialog = document.getElementById('cmtDialog');
const cmtForm = document.getElementById('cmtForm');

document.querySelector('[data-close-cmt]')?.addEventListener('click', () => cmtDialog.close());
document.getElementById('addCommitment')?.addEventListener('click', () => {
  fillCategorySelect(cmtForm.category, 'expense');
  fillAccountSelect(cmtForm.accountId);
  cmtForm.reset();
  fillCategorySelect(cmtForm.category, 'expense');
  fillAccountSelect(cmtForm.accountId);
  cmtForm.date.value = todayISO();
  document.getElementById('cmtHint').textContent = '';
  cmtDialog.showModal();
});

// prévia do custo total enquanto digita — o juro fica visível ANTES de criar
['valorFinanciado', 'parcela', 'n'].forEach(campo => {
  cmtForm?.[campo]?.addEventListener('input', () => {
    const vf = +cmtForm.valorFinanciado.value || 0;
    const p = +cmtForm.parcela.value || 0;
    const n = +cmtForm.n.value || 0;
    const el = document.getElementById('cmtHint');
    if (!p || !n) { el.textContent = ''; return; }
    const total = p * n;
    const juros = total - vf;
    el.innerHTML = vf
      ? `Vai pagar <b>${fmt.format(total)}</b> por algo de ${fmt.format(vf)} — <b>${fmt.format(juros)}</b> de juros (${Math.round(juros / vf * 100)}%).`
      : `Total de <b>${fmt.format(total)}</b> em ${n}×.`;
  });
});

cmtForm?.addEventListener('submit', () => {
  const d = new FormData(cmtForm);
  const n = parseInt(d.get('n')) || 0;
  const parcela = +d.get('parcela') || 0;
  const desc = String(d.get('descricao') || '').trim();
  if (!n || !parcela || !desc || !d.get('category') || !d.get('date')) return;
  const gid = cid();
  const base = new Date(d.get('date') + 'T00:00:00');
  const hoje = todayISO();
  for (let k = 0; k < n; k++) {
    const dt = new Date(base); dt.setMonth(base.getMonth() + k);
    if (dt.getDate() !== base.getDate()) dt.setDate(0);   // 31 → último dia do mês curto
    const ds = dt.toISOString().slice(0, 10);
    const t = stampTx({
      id: cid(), type: 'expense', amount: parcela,
      description: `${desc} (${k + 1}/${n})`,
      category: d.get('category'), date: ds, groupId: gid,
      accountId: d.get('accountId') || null,
    });
    if (ds > hoje) t.pending = true;
    state.transactions.push(t);
  }
  state.commitments = state.commitments || [];
  state.commitments.push(stampTx({
    id: gid, kind: 'financiamento', descricao: desc, nParcelas: n,
    valorFinanciado: +d.get('valorFinanciado') || null,
    taxaMensal: +d.get('taxa') || null,
    total: parcela * n,
    accountId: d.get('accountId') || null,
  }));
  saveState(); cmtDialog.close(); refreshAll();
  toast(`Financiamento criado: ${n}× de ${fmt.format(parcela)}`);
});

/* ================= CONTAS E CARTÕES =================
   Sem isto não dá para responder "quanto vem na fatura do Santander". */
function fillAccountSelect(select, selecionado) {
  if (!select) return;
  const list = state.accounts || [];
  select.innerHTML = '<option value="">— não informado —</option>' +
    list.map(a => `<option value="${escapeHTML(a.id)}"${a.id === selecionado ? ' selected' : ''}>${escapeHTML(a.name)}${a.kind === 'cartao' ? ' (cartão)' : ''}</option>`).join('');
}

function accItemHTML(a) {
  const usados = state.transactions.filter(t => t.accountId === a.id).length;
  return `<li class="cat-item" data-acc="${escapeHTML(a.id)}">
    <span class="dot" style="background:${escapeHTML(a.color || '#6366f1')}"></span>
    <span class="name">${escapeHTML(a.name)}</span>
    <span class="muted small">${a.kind === 'cartao' ? 'cartão' : 'conta'} · ${usados} lanç.</span>
  </li>`;
}

function renderAccounts() {
  const el = document.getElementById('accList');
  if (!el) return;
  const list = state.accounts || [];
  el.innerHTML = list.length ? list.map(accItemHTML).join('')
    : '<li class="empty muted small">Nenhuma conta ou cartão. Toque em “+ Adicionar”.</li>';
  el.querySelectorAll('.cat-item').forEach(li => li.addEventListener('click', () => openAccDialog(li.dataset.acc)));
}

const accDialog = document.getElementById('accDialog');
const accForm = document.getElementById('accForm');

function syncAccKindUI() {
  const kind = accForm.querySelector('input[name=kind]:checked')?.value;
  document.getElementById('accCardFields').hidden = kind !== 'cartao';
}
accForm?.querySelectorAll('input[name=kind]').forEach(r => r.addEventListener('change', syncAccKindUI));
document.querySelector('[data-close-acc]')?.addEventListener('click', () => accDialog.close());

function openAccDialog(id) {
  const a = (state.accounts || []).find(x => x.id === id);
  accForm.reset();
  accForm.dataset.id = a ? a.id : '';
  document.getElementById('accDialogTitle').textContent = a ? 'Editar' : 'Nova conta ou cartão';
  document.getElementById('accDelete').hidden = !a;
  if (a) {
    accForm.querySelector(`input[name=kind][value="${a.kind || 'conta'}"]`).checked = true;
    accForm.name.value = a.name || '';
    accForm.color.value = a.color || '#6366f1';
    accForm.fechamento.value = a.fechamento || '';
    accForm.vencimento.value = a.vencimento || '';
    accForm.limite.value = a.limite || '';
    if (accForm.saldoInicial) accForm.saldoInicial.value = a.saldoInicial || '';
  }
  syncAccKindUI();
  accDialog.showModal();
}
document.getElementById('addAccount')?.addEventListener('click', () => openAccDialog(null));

accForm?.addEventListener('submit', () => {
  const d = new FormData(accForm);
  const nome = String(d.get('name') || '').trim();
  if (!nome) return;
  const id = accForm.dataset.id;
  const obj = stampTx({
    id: id || cid(), kind: d.get('kind') || 'conta', name: nome,
    color: d.get('color') || '#6366f1',
    saldoInicial: +d.get('saldoInicial') || 0,
    fechamento: +d.get('fechamento') || null,
    vencimento: +d.get('vencimento') || null,
    limite: +d.get('limite') || null,
  });
  state.accounts = state.accounts || [];
  const i = state.accounts.findIndex(x => x.id === obj.id);
  if (i >= 0) state.accounts[i] = obj; else state.accounts.push(obj);
  saveState(); accDialog.close(); refreshAll();
  toast(id ? 'Atualizado' : 'Criado');
});

document.getElementById('accDelete')?.addEventListener('click', () => {
  const id = accForm.dataset.id;
  if (!id) return;
  const usados = state.transactions.filter(t => t.accountId === id).length;
  if (!confirm(usados ? `Excluir? ${usados} lançamento(s) ficam sem conta (nada é apagado).` : 'Excluir?')) return;
  tombstone('accountTombstones', id);
  state.accounts = (state.accounts || []).filter(a => a.id !== id);
  saveState(); accDialog.close(); refreshAll();
  toast('Excluído');
});

/* ---------- FATURA DO CARTÃO ----------
   O ciclo fecha no dia configurado: gasto após o fechamento cai na fatura do
   mês seguinte. Sem dia de fechamento, cai no mês do próprio gasto. */
function faturaDoCartao(acc, ref) {
  const fech = acc.fechamento || 0;
  return state.transactions.filter(t => {
    if (t.accountId !== acc.id || t.type !== 'expense') return false;
    const d = new Date(t.date + 'T00:00:00');
    let mes = d.getMonth(), ano = d.getFullYear();
    if (fech && d.getDate() > fech) { mes += 1; if (mes > 11) { mes = 0; ano += 1; } }
    return mes === ref.getMonth() && ano === ref.getFullYear();
  });
}

function renderFaturas() {
  const el = document.getElementById('faturas');
  if (!el) return;
  const cartoes = (state.accounts || []).filter(a => a.kind === 'cartao');
  if (!cartoes.length) { el.innerHTML = ''; return; }
  const ref = new Date();
  const linhas = cartoes.map(c => {
    const itens = faturaDoCartao(c, ref);
    const total = itens.reduce((s, t) => s + (+t.amount || 0), 0);
    const usoLimite = c.limite ? pct(total, c.limite) : null;
    return `<div class="fat-row">
      <span class="dot" style="background:${escapeHTML(c.color || '#6366f1')}"></span>
      <div class="fat-id"><strong>${escapeHTML(c.name)}</strong>
        <small class="muted">${itens.length} lanç.${c.vencimento ? ' · vence dia ' + c.vencimento : ''}</small></div>
      <div class="fat-v"><strong>${fmt.format(total)}</strong>
        ${usoLimite !== null ? `<small class="muted">${usoLimite}% do limite</small>` : ''}</div>
      <button type="button" class="fat-pg ${faturaPaga(c.id, ref) ? 'on' : ''}" data-fat="${escapeHTML(c.id)}">
        ${faturaPaga(c.id, ref) ? '✓ paga' : 'marcar paga'}</button>
    </div>`;
  }).join('');
  el.innerHTML = `<h3 class="muted small uppercase" style="margin:16px 0 8px">Fatura aberta dos cartões</h3><div class="fat-list">${linhas}</div>`;
  el.querySelectorAll('[data-fat]').forEach(b =>
    b.addEventListener('click', () => alternarFaturaPaga(b.dataset.fat, new Date())));
}

/* ====== Atalhos de teclado (desktop) ======
   Quem usa no computador não quer caçar botão com o mouse. */
document.addEventListener('keydown', (e) => {
  const emCampo = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')
    || document.activeElement?.isContentEditable;
  const modalAberto = [...document.querySelectorAll('dialog')].some(d => d.open);

  if (e.key === 'Escape' && modalAberto) return;            // o próprio dialog fecha
  if (emCampo || modalAberto || e.metaKey || e.ctrlKey || e.altKey) return;

  const k = e.key.toLowerCase();
  if (k === 'n') { e.preventDefault(); openTxDialog(null); return; }
  if (k === '/') { e.preventDefault(); navigate('transacoes');
                   setTimeout(() => document.getElementById('txSearch')?.focus(), 60); return; }
  if (k === 'arrowleft')  { e.preventDefault(); document.getElementById(
      document.querySelector('[data-view=transacoes]').classList.contains('hidden') ? 'prevMonth' : 'txPrevMonth')?.click(); return; }
  if (k === 'arrowright') { e.preventDefault(); document.getElementById(
      document.querySelector('[data-view=transacoes]').classList.contains('hidden') ? 'nextMonth' : 'txNextMonth')?.click(); return; }
  const atalhos = { '1':'dashboard', '2':'transacoes', '3':'categorias', '4':'fixos', '5':'compromissos', '6':'ia' };
  if (atalhos[k]) { e.preventDefault(); navigate(atalhos[k]); }
});

/* A tabela só existe no desktop: ao mudar a largura, refaz o cabeçalho. */
let _rzTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(_rzTimer);
  _rzTimer = setTimeout(() => {
    if (!document.querySelector('[data-view=transacoes]').classList.contains('hidden')) aplicarTabelaTx();
  }, 180);
});

/* Entra pela rota do endereço (recarregar mantém a tela). Sem o segundo
   argumento para que o endereço seja gravado já no primeiro carregamento. */
navigate(viewDoHash());

/* ============================================================
   REGRAS AUTOMÁTICAS
   "Todo lançamento com UBER vira Transporte". É o que separa
   dez minutos de uma hora quando você importa uma fatura.
   ============================================================ */
function aplicarRegras(t) {
  const desc = (t.description || '').toLowerCase();
  for (const r of (state.rules || [])) {
    if (!r.contem) continue;
    if (desc.indexOf(String(r.contem).toLowerCase()) < 0) continue;
    if (r.category) t.category = r.category;
    if (r.sub) t.sub = r.sub;
    if (r.accountId) t.accountId = r.accountId;
    return r;
  }
  return null;
}

/* Roda as regras em tudo que já existe — útil ao criar uma regra nova. */
function reaplicarRegras() {
  let n = 0;
  state.transactions.forEach(t => {
    const antes = t.category + '|' + (t.sub || '');
    if (aplicarRegras(t) && (t.category + '|' + (t.sub || '')) !== antes) { t.updatedAt = Date.now(); n++; }
  });
  return n;
}

/* ============================================================
   REVISÃO EM LOTE
   Fila do que está sem categoria de verdade (ou caiu em "Outros").
   Teclado: 1-9 escolhe categoria, Enter pula, Esc sai.
   ============================================================ */
function paraRevisar() {
  return state.transactions
    .filter(t => !ehTransfer(t) && (!t.category || t.category === 'Outros'))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

let _revIdx = 0, _revLista = [];
function abrirRevisao() {
  _revLista = paraRevisar();
  _revIdx = 0;
  if (!_revLista.length) { toast('Nada para revisar — tudo categorizado.'); return; }
  document.getElementById('revDialog').showModal();
  pintarRevisao();
}
function pintarRevisao() {
  const t = _revLista[_revIdx];
  const box = document.getElementById('revBody');
  if (!t) {
    box.innerHTML = `<p class="muted">Fim da fila. ${_revLista.length} revisado(s).</p>`;
    document.getElementById('revProg').textContent = '';
    return;
  }
  const cats = state.categories.filter(c => c.type === t.type).slice(0, 9);
  document.getElementById('revProg').textContent = `${_revIdx + 1} de ${_revLista.length}`;
  box.innerHTML = `
    <div class="rev-tx">
      <strong>${escapeHTML(t.description)}</strong>
      <span class="${t.type === 'income' ? 'income' : ''}">${t.type === 'income' ? '+' : '−'} ${fmt.format(t.amount)}</span>
    </div>
    <div class="muted small" style="margin-bottom:12px">${new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR')} · categoria atual: ${escapeHTML(t.category || '—')}</div>
    <div class="rev-cats">
      ${cats.map((c, i) => `<button type="button" class="rev-cat" data-cat="${escapeHTML(c.name)}">
        <kbd>${i + 1}</kbd> <span>${escapeHTML(c.icon || '')} ${escapeHTML(c.name)}</span></button>`).join('')}
    </div>
    <label class="field" style="margin-top:12px">
      <span>Criar regra: sempre que a descrição contiver</span>
      <input id="revRegra" type="text" placeholder="${escapeHTML((t.description || '').split(' ')[0] || '')}" />
    </label>`;
  box.querySelectorAll('.rev-cat').forEach(b =>
    b.addEventListener('click', () => aplicarRevisao(b.dataset.cat)));
}
function aplicarRevisao(cat) {
  const t = _revLista[_revIdx];
  if (!t) return;
  t.category = cat; t.updatedAt = Date.now();
  const termo = (document.getElementById('revRegra')?.value || '').trim();
  if (termo) {
    state.rules = state.rules || [];
    state.rules.push({ id: cid(), contem: termo, category: cat, updatedAt: Date.now() });
    const n = reaplicarRegras();
    toast(`Regra criada — ${n} lançamento(s) atualizados`);
  }
  _revIdx++;
  saveState(); pintarRevisao(); refreshAll();
}
document.addEventListener('keydown', (e) => {
  const dlg = document.getElementById('revDialog');
  if (!dlg || !dlg.open) return;
  if (/^[1-9]$/.test(e.key)) {
    const b = document.querySelectorAll('#revBody .rev-cat')[+e.key - 1];
    if (b) { e.preventDefault(); b.click(); }
  } else if (e.key === 'Enter') { e.preventDefault(); _revIdx++; pintarRevisao(); }
});

/* ============================================================
   SALDO POR CONTA — "quanto tem no Nubank"
   ============================================================ */
function saldoDaConta(acc) {
  const base = +acc.saldoInicial || 0;
  return state.transactions.reduce((s, t) => {
    if (t.accountId !== acc.id || t.pending) return s;
    return s + (t.type === 'income' ? +t.amount : -(+t.amount));
  }, base);
}

/* ============================================================
   PROJEÇÃO DE SALDO — o que o YNAB faz de mais útil:
   avisar do aperto ANTES de ele acontecer.
   ============================================================ */
function projecaoSaldo(meses = 6) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  let acumulado = state.transactions
    .filter(t => !t.pending && !ehTransfer(t) && t.date <= todayISO())
    .reduce((s, t) => s + (t.type === 'income' ? +t.amount : -(+t.amount)), 0);
  const fixos = (state.fixedItems || []);
  const rendaFixa = fixos.filter(f => f.type === 'income').reduce((s, f) => s + (+f.amount || 0), 0);
  const gastoFixo = fixos.filter(f => f.type === 'expense').reduce((s, f) => s + (+f.amount || 0), 0);
  const out = [];
  for (let i = 1; i <= meses; i++) {
    const ref = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
    const parcelas = state.transactions
      .filter(t => t.type === 'expense' && chaveGrupo(t) && inMonth(t.date, ref))
      .reduce((s, t) => s + (+t.amount || 0), 0);
    const compromissoEstimado = compromissos()
      .filter(c => !c.quitado && c.estimado)
      .reduce((s, c) => s + c.valorParcela, 0);
    const saida = gastoFixo + Math.max(parcelas, compromissoEstimado);
    acumulado += rendaFixa - saida;
    out.push({ ref, entra: rendaFixa, sai: saida, saldo: acumulado });
  }
  return out;
}

/* ============================================================
   TRANSFERÊNCIA ENTRE CONTAS
   Dois lançamentos amarrados por transferId: saída na origem e
   entrada no destino. Ambos ficam fora dos totais do mês.
   ============================================================ */
function criarTransferencia({ de, para, valor, data, descricao }) {
  if (!de || !para || de === para || !(valor > 0)) return null;
  const tid = cid();
  const nomeDe = (state.accounts.find(a => a.id === de) || {}).name || 'conta';
  const nomePara = (state.accounts.find(a => a.id === para) || {}).name || 'conta';
  const txt = descricao || `Transferência ${nomeDe} → ${nomePara}`;
  const base = { date: data, category: 'Transferência', transferId: tid, updatedAt: Date.now() };
  state.transactions.push({ ...base, id: cid(), type: 'expense', amount: valor, accountId: de, description: txt });
  state.transactions.push({ ...base, id: cid(), type: 'income', amount: valor, accountId: para, description: txt });
  return tid;
}

/* ============================================================
   FATURA FECHÁVEL — marcar o mês do cartão como pago
   ============================================================ */
function chaveFatura(accId, ref) {
  return accId + ':' + ref.getFullYear() + '-' + String(ref.getMonth() + 1).padStart(2, '0');
}
function faturaPaga(accId, ref) {
  const acc = (state.accounts || []).find(a => a.id === accId);
  return !!(acc && acc.faturasPagas && acc.faturasPagas[chaveFatura(accId, ref)]);
}
function alternarFaturaPaga(accId, ref) {
  const acc = (state.accounts || []).find(a => a.id === accId);
  if (!acc) return;
  acc.faturasPagas = acc.faturasPagas || {};
  const k = chaveFatura(accId, ref);
  if (acc.faturasPagas[k]) delete acc.faturasPagas[k];
  else acc.faturasPagas[k] = Date.now();
  acc.updatedAt = Date.now();
  saveState(); refreshAll();
}

/* ====== Ligações das telas novas ====== */
document.getElementById('txRevisar')?.addEventListener('click', abrirRevisao);

document.getElementById('txTransferir')?.addEventListener('click', () => {
  const f = document.getElementById('trfForm');
  if (!(state.accounts || []).length) { toast('Cadastre uma conta primeiro (aba Categorias).'); return; }
  fillAccountSelect(f.de); fillAccountSelect(f.para);
  f.data.value = todayISO();
  document.getElementById('trfDialog').showModal();
});
document.getElementById('trfForm')?.addEventListener('submit', () => {
  const d = new FormData(document.getElementById('trfForm'));
  const ok = criarTransferencia({
    de: d.get('de'), para: d.get('para'), valor: +d.get('valor'),
    data: d.get('data'), descricao: (d.get('descricao') || '').trim()
  });
  if (!ok) { toast('Escolha duas contas diferentes e um valor.'); return; }
  saveState(); refreshAll(); toast('Transferência registrada');
});

function renderRegras() {
  const ul = document.getElementById('rulesList');
  if (!ul) return;
  const rs = state.rules || [];
  ul.innerHTML = rs.length ? rs.map(r => `<li class="cat-item" data-rule="${escapeHTML(r.id)}">
      <span class="name">contém “${escapeHTML(r.contem)}” → <b>${escapeHTML(r.category || '')}</b></span>
      <button type="button" class="ghost" data-del="${escapeHTML(r.id)}">remover</button></li>`).join('')
    : '<li class="empty muted small">Nenhuma regra ainda.</li>';
  ul.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
    tombstone('ruleTombstones', b.dataset.del);
    state.rules = (state.rules || []).filter(r => r.id !== b.dataset.del);
    saveState(); renderRegras();
  }));
}
document.getElementById('txRegras')?.addEventListener('click', () => {
  fillCategorySelect(document.getElementById('ruleCat'), 'expense');
  renderRegras();
  document.getElementById('rulesDialog').showModal();
});
document.getElementById('ruleAdd')?.addEventListener('click', () => {
  const termo = document.getElementById('ruleTermo').value.trim();
  const cat = document.getElementById('ruleCat').value;
  if (!termo || !cat) return;
  state.rules = state.rules || [];
  state.rules.push({ id: cid(), contem: termo, category: cat, updatedAt: Date.now() });
  const n = reaplicarRegras();
  saveState(); renderRegras(); refreshAll();
  toast(`Regra criada — ${n} lançamento(s) recategorizados`);
  document.getElementById('ruleTermo').value = '';
});

/* Projeção de saldo no painel — o aviso do aperto antes dele chegar. */
function renderProjecao() {
  const el = document.getElementById('dashProjecao');
  if (!el) return;
  const p = projecaoSaldo(6);
  if (!p.length || !(state.fixedItems || []).length) { el.innerHTML = ''; return; }
  const negativo = p.find(m => m.saldo < 0);
  el.innerHTML = `<div class="section-title"><h3>Projeção de saldo</h3></div>
    ${negativo ? `<div class="proj-alerta">No ritmo atual, o saldo fica negativo em <b>${negativo.ref.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</b>.</div>` : ''}
    <div class="cmt-proj">${p.map(m => `<div class="proj-row">
      <span class="proj-m">${m.ref.toLocaleDateString('pt-BR',{month:'short',year:'2-digit'})}</span>
      <span class="proj-v ${m.saldo < 0 ? 'neg' : ''}">${fmt.format(m.saldo)}</span>
    </div>`).join('')}</div>
    <p class="muted small" style="margin-top:6px">Estimativa a partir dos fixos cadastrados e das parcelas em aberto.</p>`;
}

/* Saldo por conta na lista de contas. */
accItemHTML = function (a) {
  const usados = state.transactions.filter(t => t.accountId === a.id).length;
  const saldo = saldoDaConta(a);
  return `<li class="cat-item" data-acc="${escapeHTML(a.id)}">
    <span class="dot" style="background:${escapeHTML(a.color || '#6366f1')}"></span>
    <span class="name">${escapeHTML(a.name)}</span>
    <span class="acc-saldo ${saldo < 0 ? 'neg' : ''}">${fmt.format(saldo)}</span>
    <span class="muted small">${a.kind === 'cartao' ? 'cartão' : 'conta'} · ${usados}</span>
  </li>`;
};

/* ============================================================
   DÍVIDA SEM PRAZO
   Dinheiro que se deve sem cronograma — o empréstimo do pai, o
   acerto com um amigo. Não tem parcela nem vencimento: tem um
   total e o tanto que já foi abatido. Cada pagamento é uma
   despesa NORMAL do mês (entra nos totais) e reduz o saldo.
   ============================================================ */
const divDialog = document.getElementById('divDialog');
const divForm = document.getElementById('divForm');
const pagDialog = document.getElementById('pagDialog');
const pagForm = document.getElementById('pagForm');

document.getElementById('addDivida')?.addEventListener('click', () => {
  divForm.reset();
  ensureCategory('Dívidas', 'expense');
  fillCategorySelect(divForm.category, 'expense');
  divForm.category.value = 'Dívidas';
  divDialog.showModal();
});

divForm?.addEventListener('submit', () => {
  const d = new FormData(divForm);
  const desc = String(d.get('descricao') || '').trim();
  const total = +d.get('total') || 0;
  if (!desc || !total) return;
  state.commitments = state.commitments || [];
  state.commitments.push({
    id: cid(), kind: 'divida', descricao: desc,
    credor: (d.get('credor') || '').trim() || null,
    total, category: d.get('category') || 'Dívidas',
    desde: todayISO(), updatedAt: Date.now(),
  });
  saveState(); divDialog.close(); refreshAll();
  toast(`Dívida de ${fmt.format(total)} cadastrada`);
});

let _dividaAlvo = null;
function abrirPagamentoDivida(id) {
  const c = compromissos().find(x => x.id === id);
  if (!c) return;
  _dividaAlvo = id;
  pagForm.reset();
  fillAccountSelect(pagForm.accountId);
  pagForm.data.value = todayISO();
  document.getElementById('pagTitulo').textContent = 'Pagamento — ' + c.descricao;
  document.getElementById('pagResumo').innerHTML =
    `Em aberto: <b>${fmt.format(c.aPagar)}</b> de ${fmt.format(c.total)}. O valor entra como despesa do mês.`;
  pagDialog.showModal();
}

pagForm?.addEventListener('submit', () => {
  const c = (state.commitments || []).find(x => x.id === _dividaAlvo);
  if (!c) return;
  const d = new FormData(pagForm);
  const valor = +d.get('valor') || 0;
  const data = d.get('data');
  if (!valor || !data) return;
  const t = stampTx({
    id: cid(), type: 'expense', amount: valor,
    description: `${c.descricao} — pagamento`,
    category: c.category || 'Dívidas', date: data,
    groupId: c.id, accountId: d.get('accountId') || null,
  });
  if (data > todayISO()) t.pending = true;
  state.transactions.push(t);
  saveState(); pagDialog.close(); refreshAll();
  const dep = compromissos().find(x => x.id === c.id);
  toast(dep && dep.quitado ? 'Dívida quitada! 🎉' : `Pago ${fmt.format(valor)} — faltam ${fmt.format(dep ? dep.aPagar : 0)}`);
});
