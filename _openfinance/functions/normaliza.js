/* Converte o que o Pluggy devolve no formato enxuto que o Granaê lê.
   Fica separado do index.js para ser testado sem Firebase nem rede. */

/* Data do lançamento no fuso de Brasília. O Open Finance manda muita coisa
   como "só data" (meia-noite UTC); converter isso para o fuso jogaria o gasto
   para o dia anterior, então meia-noite UTC fica como está. */
function dataBR(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) {
    return d.toISOString().slice(0, 10);
  }
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

function diaDoMes(iso) {
  const s = dataBR(iso);
  return s ? +s.slice(8, 10) : null;
}

/* Pagamento de fatura e transferência entre contas do próprio titular não são
   gasto nem ganho: o gasto já entrou pelo cartão. Marcados como transferência,
   ficam fora dos totais do mês no Granaê. */
const RE_TRANSF_CAT = /credit card payment|same person transfer|pagamento de fatura|transfer[eê]ncia (entre|mesma) (contas|titularidade)/i;
const RE_PGTO_CARTAO = /pagamento (recebido|efetuado|de fatura|fatura)|pa?gto\.? ?fatura|pag fatura|^pagamento \d+$/i;
// lado da conta corrente: "PAGTO FATURA MASTER ..." (Sicredi), "PAGAMENTO DE FATURA"...
const RE_PGTO_FATURA_CONTA = /pa?gto\.? ?fatura|pagamento de fatura|pag fatura/i;

function transacao(t, conta) {
  const cartao = conta && conta.type === 'CREDIT';
  const valor = Math.abs(Number(t.amount) || 0);
  let tipo;
  if (t.type === 'DEBIT') tipo = 'expense';
  else if (t.type === 'CREDIT') tipo = 'income';
  else tipo = (cartao ? t.amount > 0 : t.amount < 0) ? 'expense' : 'income';
  const cc = t.creditCardMetadata || {};
  const desc = (t.merchant && t.merchant.name) || t.description || t.descriptionRaw || 'Lançamento';
  const cat = t.category || '';
  const d0 = String(t.description || '').trim();
  const transfer = RE_TRANSF_CAT.test(cat)
    || (cartao && tipo === 'income' && RE_PGTO_CARTAO.test(d0))
    || (!cartao && tipo === 'expense' && RE_PGTO_FATURA_CONTA.test(d0));
  const out = {
    id: t.id,
    accountId: t.accountId,
    date: dataBR(t.date),
    desc: String(desc).replace(/\s+/g, ' ').trim().slice(0, 120),
    amount: Math.round(valor * 100) / 100,
    type: tipo,
    cat,
  };
  if (t.status === 'PENDING') out.pending = true;
  if (transfer) out.transfer = true;
  if (cc.totalInstallments > 1 && cc.installmentNumber) out.inst = [cc.installmentNumber, cc.totalInstallments];
  return out;
}

function conta(a, item) {
  const cartao = a.type === 'CREDIT';
  const cd = a.creditData || {};
  const out = {
    id: a.id,
    itemId: a.itemId || (item && item.id),
    kind: cartao ? 'cartao' : 'conta',
    name: a.marketingName || a.name || (cartao ? 'Cartão' : 'Conta'),
    bank: (item && item.connector && item.connector.name) || '',
    number: a.number ? String(a.number).slice(-4) : '',
    balance: Math.round((Number(a.balance) || 0) * 100) / 100,
  };
  if (cartao) {
    if (cd.creditLimit != null) out.limit = cd.creditLimit;
    if (cd.availableCreditLimit != null) out.available = cd.availableCreditLimit;
    const f = diaDoMes(cd.balanceCloseDate), v = diaDoMes(cd.balanceDueDate);
    if (f) out.closeDay = f;
    if (v) out.dueDay = v;
  }
  return out;
}

function item(it) {
  return {
    id: it.id,
    bank: (it.connector && it.connector.name) || 'Banco',
    status: it.status || '',
    lastUpdatedAt: it.lastUpdatedAt || it.updatedAt || null,
    error: (it.error && (it.error.message || it.error.code)) || null,
  };
}

const num = (...v) => { for (const x of v) if (x != null && x !== '' && !isNaN(+x)) return +x; return null; };
const dia = (v) => (v ? String(v).slice(0, 10) : null);
const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100);

/* Financiamento / empréstimo (Open Finance: GET /loans). O saldo devedor é o
   que quita a dívida hoje; as parcelas vêm aninhadas em "installments" em
   algumas instituições e soltas em outras. */
function emprestimo(l, item) {
  const p = l.installments || {};
  const pagamentos = ((l.payments && l.payments.releases) || []).filter(x => x && x.paidDate);
  const ultimo = pagamentos.sort((a, b) => String(b.paidDate).localeCompare(String(a.paidDate)))[0];
  return {
    id: l.id,
    itemId: l.itemId || (item && item.id),
    bank: (item && item.connector && item.connector.name) || '',
    name: l.productName || l.type || 'Financiamento',
    kind: l.kind || l.type || '',
    contract: l.contractNumber ? String(l.contractNumber).slice(-4) : '',
    amount: r2(num(l.contractAmount)),
    outstanding: r2(num(l.contractOutstandingBalance, l.outstandingBalance)),
    total: num(p.totalNumberOfInstallments, l.totalNumberOfInstallments),
    paid: num(p.paidInstallments, l.paidInstallments),
    due: num(p.dueInstallments, l.dueInstallments),
    pastDue: num(p.pastDueInstallments, l.pastDueInstallments),
    installment: r2(num(ultimo && ultimo.instalmentAmount, ultimo && ultimo.installmentAmount, ultimo && ultimo.amount)),
    cet: num(l.CET, l.cet),
    start: dia(l.contractDate),
    end: dia(l.dueDate),
    system: l.amortizationScheduled || '',
  };
}

/* Investimento (GET /investments). Previdência (PGBL/VGBL) vem como
   investimento; fica marcada à parte porque o Granaê mostra separado. */
const RE_PREVIDENCIA = /previd|retirement|pgbl|vgbl/i;
function investimento(i, item) {
  const saldo = num(i.balance, i.amount);
  return {
    id: i.id,
    itemId: i.itemId || (item && item.id),
    bank: (item && item.connector && item.connector.name) || '',
    name: i.name || 'Investimento',
    type: i.type || '',
    subtype: i.subtype || '',
    balance: r2(saldo),
    gross: r2(num(i.amount)),
    rate12m: num(i.lastTwelveMonthsRate),
    due: dia(i.dueDate),
    date: dia(i.date),
    status: i.status || '',
    previdencia: RE_PREVIDENCIA.test([i.type, i.subtype, i.name].join(' ')),
  };
}

/* O documento do Firestore tem teto de 1 MiB. Se passar, corta os lançamentos
   mais antigos até caber. */
function cabeNoDocumento(feed, limite = 900000) {
  let json = JSON.stringify(feed);
  if (json.length <= limite) return json;
  const tx = [...feed.transactions].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  let n = tx.length;
  while (n > 0) {
    n = Math.floor(n * 0.85);
    const menor = { ...feed, transactions: tx.slice(0, n) };
    menor.from = n ? tx[n - 1].date : feed.from;
    json = JSON.stringify(menor);
    if (json.length <= limite) return json;
  }
  return JSON.stringify({ ...feed, transactions: [] });
}

module.exports = { dataBR, transacao, conta, item, emprestimo, investimento, cabeNoDocumento };
