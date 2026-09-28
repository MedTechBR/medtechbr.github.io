/* node normaliza.test.js */
const assert = require('assert');
const N = require('./normaliza');

// datas: meia-noite UTC é "só data"; horário real vira fuso de Brasília
assert.strictEqual(N.dataBR('2026-09-28T00:00:00.000Z'), '2026-09-28');
assert.strictEqual(N.dataBR('2026-09-28T02:30:00.000Z'), '2026-09-27');
assert.strictEqual(N.dataBR('2026-09-28T03:00:00.000Z'), '2026-09-28');
assert.strictEqual(N.dataBR(null), null);

const banco = { id: 'a1', type: 'BANK' };
const cartao = { id: 'c1', type: 'CREDIT' };

// conta corrente: débito é gasto, crédito é ganho, valor sempre positivo
let t = N.transacao({ id: 't1', accountId: 'a1', date: '2026-09-10T00:00:00Z', description: 'IFOOD *REST', amount: -42.5, type: 'DEBIT', category: 'Food delivery' }, banco);
assert.deepStrictEqual(t, { id: 't1', accountId: 'a1', date: '2026-09-10', desc: 'IFOOD *REST', amount: 42.5, type: 'expense', cat: 'Food delivery' });
t = N.transacao({ id: 't2', accountId: 'a1', date: '2026-09-05T00:00:00Z', description: 'SALARIO', amount: 9000, type: 'CREDIT', category: 'Salary' }, banco);
assert.strictEqual(t.type, 'income');

// sem "type": cai no sinal (no cartão, positivo é compra)
assert.strictEqual(N.transacao({ id: 'x', amount: 10, date: '2026-09-01' }, cartao).type, 'expense');
assert.strictEqual(N.transacao({ id: 'x', amount: -10, date: '2026-09-01' }, banco).type, 'expense');

// parcela e pendente
t = N.transacao({ id: 't3', accountId: 'c1', date: '2026-09-12T00:00:00Z', description: 'MAGALU', amount: 100, type: 'DEBIT', status: 'PENDING',
  creditCardMetadata: { installmentNumber: 2, totalInstallments: 10 }, merchant: { name: 'Magazine Luiza' } }, cartao);
assert.deepStrictEqual(t.inst, [2, 10]);
assert.strictEqual(t.pending, true);
assert.strictEqual(t.desc, 'Magazine Luiza');

// pagamento de fatura: transferência dos dois lados
assert.strictEqual(N.transacao({ id: 'p1', amount: -1500, type: 'DEBIT', category: 'Credit card payment', date: '2026-09-15' }, banco).transfer, true);
assert.strictEqual(N.transacao({ id: 'p2', amount: -1500, type: 'CREDIT', description: 'Pagamento recebido', date: '2026-09-15' }, cartao).transfer, true);
assert.strictEqual(N.transacao({ id: 'r1', amount: -30, type: 'CREDIT', description: 'Estorno UBER', date: '2026-09-15' }, cartao).transfer, undefined);

// conta e cartão
const c = N.conta({ id: 'c1', type: 'CREDIT', name: 'Mastercard Black', number: '5555444433331234', balance: 2345.678,
  creditData: { creditLimit: 20000, availableCreditLimit: 17654.32, balanceCloseDate: '2026-10-03T00:00:00Z', balanceDueDate: '2026-10-10T00:00:00Z' } },
  { id: 'i1', connector: { name: 'Nubank' } });
assert.deepStrictEqual(c, { id: 'c1', itemId: 'i1', kind: 'cartao', name: 'Mastercard Black', bank: 'Nubank', number: '1234', balance: 2345.68,
  limit: 20000, available: 17654.32, closeDay: 3, dueDay: 10 });

// documento grande é cortado pelos lançamentos mais antigos
const muitos = { v: 1, from: '2026-01-01', items: [], accounts: [], transactions: [] };
for (let i = 0; i < 20000; i++) muitos.transactions.push({ id: 'id' + i, date: '2026-' + String(1 + (i % 9)).padStart(2, '0') + '-10', desc: 'x'.repeat(60), amount: 1, type: 'expense', cat: '' });
const json = N.cabeNoDocumento(muitos);
assert(json.length <= 900000);
const cortado = JSON.parse(json);
assert(cortado.transactions.length > 0 && cortado.transactions.length < 20000);
assert(cortado.transactions.every(x => x.date >= cortado.from));

console.log('normaliza: ok');
