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
  tombstones: [],       // exclusoes de transacoes {id, at} — impedem que o merge ressuscite
  fixedTombstones: [],  // exclusoes de itens fixos
  categoryTombstones: [], // exclusoes de categorias {id, at}
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
  return {
    profile: local.profile || remote.profile || {},
    transactions: tx.items,
    tombstones: tx.tombstones,
    fixedItems: fx.items,
    fixedTombstones: fx.tombstones,
    categories: cat.items,
    categoryTombstones: cat.tombstones,
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
function navigate(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('hidden', v.dataset.view !== view));
  document.querySelectorAll('.bottom-nav button').forEach(b => b.classList.toggle('active', b.dataset.nav === view));
  if (view === 'dashboard') renderDashboard();
  if (view === 'transacoes') renderTransactions();
  if (view === 'categorias') renderCategories();
  if (view === 'fixos') renderFixed();
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
  navigate('transacoes');
});
document.getElementById('categoryBars').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const item = e.target.closest('.bar-item[data-cat]');
  if (!item) return;
  e.preventDefault();
  categoryFilter = { name: item.dataset.cat };
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

function txOfMonth() {
  return state.transactions.filter(t => inMonth(t.date, currentMonth));
}

// Ativa transações agendadas cuja data já chegou (ou já passou)
function activateDuePending() {
  const today = todayISO();
  let changed = false;
  for (const t of state.transactions) {
    if (t.pending && t.date <= today) {
      delete t.pending;
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
    const tx = state.transactions.filter(t => !t.pending && inMonth(t.date, m));
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
  if (!monthPending.length || net === 0) { wrap.hidden = true; return; }
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
  return `<li class="tx-item${pendingCls}" data-id="${t.id}">
    <div class="meta">
      <span class="desc">${escapeHTML(t.description)}${pendingBadge}</span>
      ${hideDate ? '' : `<span class="sub">${dayFmt.format(new Date(t.date + 'T00:00:00'))}</span>`}
    </div>
    <span class="tx-cat-chip" style="background:${chipBg};color:${chipFg}">
      <span class="ico">${cat.icon || '🏷️'}</span> ${escapeHTML(t.category)}
    </span>
    <span class="val ${t.type}">${sign} ${fmt.format(t.amount)}</span>
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
  const monthTx = state.transactions.filter(t => inMonth(t.date, currentMonth));
  let list = monthTx.slice();
  if (filter !== 'all') list = list.filter(t => t.type === filter);
  if (categoryFilter) list = list.filter(t => t.category === categoryFilter.name);
  list.sort((a, b) => b.date.localeCompare(a.date));

  const lbl = document.getElementById('txMonthLabel');
  if (lbl) lbl.textContent = monthLongFmt.format(currentMonth);
  renderTxMonthSummary(monthTx);
  renderTxFilterChip();

  const ul = document.getElementById('txList');
  if (!list.length) {
    const que = categoryFilter ? `Nenhum lançamento de ${escapeHTML(categoryFilter.name)}` : 'Nenhuma transação';
    ul.innerHTML = `<li class="empty">${que} em ${monthLongFmt.format(currentMonth)}.</li>`;
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
    el.addEventListener('click', () => openTxDialog(el.dataset.id));
  });
}

// Diálogo de transação
const txDialog = document.getElementById('txDialog');
const txForm = document.getElementById('txForm');
const txDelete = document.getElementById('txDelete');

function fillCategorySelect(select, type) {
  const list = state.categories.filter(c => c.type === type);
  select.innerHTML = list.map(c => `<option value="${c.name}">${c.icon} ${c.name}</option>`).join('')
    || `<option value="">— sem categorias —</option>`;
}

function openTxDialog(id) {
  txForm.reset();
  const editing = id ? state.transactions.find(t => t.id === id) : null;
  document.getElementById('txDialogTitle').textContent = editing ? 'Editar transação' : 'Nova transação';
  txDelete.hidden = !editing;
  txForm.dataset.id = editing?.id || '';
  const type = editing?.type || 'expense';
  txForm.querySelector(`input[name=type][value=${type}]`).checked = true;
  fillCategorySelect(txForm.category, type);
  if (editing) {
    txForm.amount.value = editing.amount;
    txForm.description.value = editing.description;
    txForm.category.value = editing.category;
    txForm.date.value = editing.date;
  } else {
    txForm.date.value = todayISO();
  }
  updateTxScheduledHint();
  txDialog.showModal();
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
  };
  if (!obj.amount || !obj.description || !obj.category || !obj.date) return;
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

function renderCategories() {
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

// FAB de "+ transação" através da nav inferior (botão Lançar)
document.querySelector('.bottom-nav button[data-nav="transacoes"]').addEventListener('dblclick', () => openTxDialog(null));
// Garantir que clicar em "Lançar" também abre o diálogo ao já estar na view
let lastNavClickTs = 0;
document.querySelector('.bottom-nav button[data-nav="transacoes"]').addEventListener('click', () => {
  const now = Date.now();
  if (now - lastNavClickTs < 350 || !document.querySelector('[data-view=transacoes]').classList.contains('hidden') === true) {
    // já estávamos na view
  }
  lastNavClickTs = now;
});

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
function refreshAll() {
  renderDashboard();
  if (!document.querySelector('[data-view=transacoes]').classList.contains('hidden')) renderTransactions();
  if (!document.querySelector('[data-view=categorias]').classList.contains('hidden')) renderCategories();
  if (!document.querySelector('[data-view=fixos]').classList.contains('hidden')) renderFixed();
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
