/* Fluxo completo da função com Pluggy e Firestore falsos: node fluxo.test.js */
const Module = require('module');
const path = require('path');
const dir = __dirname;
// Firestore em memória
const banco = new Map();
const docRef = (p) => ({
  path: p,
  get: async () => ({ exists: banco.has(p), data: () => banco.get(p) }),
  set: async (v, o) => { banco.set(p, o && o.merge ? { ...(banco.get(p) || {}), ...v } : v); },
  delete: async () => { banco.delete(p); },
});
const fakeDb = {
  doc: docRef,
  runTransaction: async (fn) => fn({ get: (r) => r.get(), set: (r, v, o) => r.set(v, o) }),
  collection: (c) => ({ listDocuments: async () => [...banco.keys()].filter(k => k.startsWith(c + '/')).map(k => ({ id: k.split('/')[1] })) }),
};
const origLoad = Module._load;
Module._load = function (req, ...r) {
  if (req === 'firebase-admin/app') return { initializeApp() {} };
  if (req === 'firebase-admin/firestore') return { getFirestore: () => fakeDb, FieldValue: { serverTimestamp: () => 'TS' } };
  if (req === '@google-cloud/pubsub') return { PubSub: class { topic(t) { return { publishMessage: async (m) => { publicados.push({ t, ...m }); } }; } } };
  return origLoad.call(this, req, ...r);
};
const publicados = [];
Object.assign(process.env, { PLUGGY_CLIENT_ID: 'cid', PLUGGY_CLIENT_SECRET: 'sec', PLUGGY_WEBHOOK_KEY: 'k'.repeat(48), OF_EMAILS: 'eu@x.com', GCLOUD_PROJECT: 'medtech-c658c' });
// Pluggy falso
const chamadas = [];
global.fetch = async (url, o = {}) => {
  const u = new URL(url); chamadas.push(o.method + ' ' + u.pathname + u.search);
  const J = (b, s = 200) => ({ ok: s < 300, status: s, json: async () => b, text: async () => JSON.stringify(b) });
  if (u.pathname === '/auth') return J({ apiKey: 'AK' });
  if (o.headers['X-API-KEY'] !== 'AK') return J({ message: 'no key' }, 401);
  if (u.pathname === '/connect_token') { const b = JSON.parse(o.body); return J({ accessToken: 'CT', echo: b }); }
  if (u.pathname === '/items/item-12345678') return J({ id: 'item-12345678', clientUserId: 'uid1', status: 'UPDATED', connector: { name: 'MeuPluggy' } });
  if (u.pathname === '/items/item-alheio00') return J({ id: 'item-alheio00', clientUserId: 'outro', connector: { name: 'X' } });
  if (u.pathname === '/accounts') return J({ results: [{ id: 'acc1', type: 'BANK', name: 'Conta', balance: 10, number: '0001-9' }] });
  if (u.pathname === '/transactions') {
    const pg = +u.searchParams.get('page');
    return J({ totalPages: 2, page: pg, results: [{ id: 'tx' + pg, accountId: 'acc1', date: '2026-09-20T00:00:00Z', description: 'Coisa ' + pg, amount: -5, type: 'DEBIT' }] });
  }
  return J({ message: 'nf' }, 404);
};
const assert = require('assert');
const f = require(path.join(dir, 'index.js'));
const req = (data, email = 'eu@x.com', uid = 'uid1') => ({ data, auth: { uid, token: { email, email_verified: true } } });
(async () => {
  await assert.rejects(f.openfinance.run(req({ action: 'sync' }, 'intruso@x.com')), /não está liberado/);
  // conta de e-mail/senha sem verificação passa (o e-mail é único entre contas de senha); outro provedor não
  const semVerif = (provedor) => ({ data: { action: 'connectToken' }, auth: { uid: 'uid1', token: { email: 'eu@x.com', email_verified: false, firebase: { sign_in_provider: provedor } } } });
  assert.strictEqual((await f.openfinance.run(semVerif('password'))).accessToken, 'CT');
  await assert.rejects(f.openfinance.run(semVerif('custom')), /não está liberado/);
  const ct = await f.openfinance.run(req({ action: 'connectToken' }));
  assert.strictEqual(ct.accessToken, 'CT');
  await assert.rejects(f.openfinance.run(req({ action: 'addItem', itemId: 'item-alheio00' })), /não é sua/);
  const r = await f.openfinance.run(req({ action: 'addItem', itemId: 'item-12345678' }));
  assert.deepStrictEqual(r, { contas: 1, lancamentos: 2 });
  assert.strictEqual(banco.get('openfinance_items/item-12345678').uid, 'uid1');
  const feed = JSON.parse(banco.get('users/uid1/apps/granae_of').json);
  assert.strictEqual(feed.accounts[0].from, new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10)); // janela inicial
  assert.deepStrictEqual(feed.transactions.map(t => t.id), ['tx1', 'tx2']);
  // outro usuário não remove nem reconecta o item
  await assert.rejects(f.openfinance.run(req({ action: 'removeItem', itemId: 'item-12345678' }, 'eu@x.com', 'uid2')), /não é sua/);
  // webhook: chave errada, depois certa
  const res = () => { const o = { c: 0, status(c) { o.c = c; return o; }, send() { return o; }, end() { return o; } }; return o; };
  let w = res(); await f.pluggyWebhook({ method: 'POST', query: { k: 'errada' }, body: {} }, w); assert.strictEqual(w.c, 403);
  w = res(); await f.pluggyWebhook({ method: 'POST', query: { k: 'k'.repeat(48) }, body: { event: 'transactions/created', itemId: 'item-12345678' } }, w);
  assert.strictEqual(w.c, 200); assert.strictEqual(publicados[0].json.uid, 'uid1');
  await f.openfinanceSyncJob.run({ data: { message: { json: { uid: 'uid1' } } } });
  // sync manual com refresh chama PATCH
  await f.openfinance.run(req({ action: 'sync', refresh: true }));
  assert(chamadas.some(c => c.startsWith('PATCH /items/item-12345678')));
  assert(banco.get('openfinance_users/uid1').items[0].refreshedAt > 0);
  await f.openfinance.run(req({ action: 'removeItem', itemId: 'item-12345678' }));
  assert(!banco.has('openfinance_items/item-12345678'));
  assert.strictEqual(JSON.parse(banco.get('users/uid1/apps/granae_of').json).items.length, 0);
  console.log('fluxo: ok');
})().catch(e => { console.error(e); process.exit(1); });
