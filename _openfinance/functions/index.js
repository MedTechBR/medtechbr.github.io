/* Granaê × Open Finance (Pluggy)
   ---------------------------------------------------------------------------
   Por que existe: a chave do Pluggy (client secret) dá leitura de TODAS as
   contas conectadas. Ela não pode ir para o navegador, então fica aqui, como
   segredo do Firebase. O app só fala com estas funções, com o login MedTech.

   Fluxo:
     1. O app pede um connect token (openfinance {action:'connectToken'}) e abre
        o widget do Pluggy. O usuário escolhe o banco / MeuPluggy e autoriza.
     2. O widget devolve o itemId; o app registra (action:'addItem').
     3. Sempre que o banco manda lançamento novo, o Pluggy chama o webhook
        (pluggyWebhook), que responde na hora e publica no tópico
        openfinance-sync. Quem consome (openfinanceSyncJob) busca contas e
        lançamentos e grava um resumo em users/{uid}/apps/granae_of. O app escuta esse documento ao vivo
        (onSnapshot) e importa na hora.
     4. Rede de segurança: a cada 6 h sincroniza todo mundo, caso um webhook
        tenha se perdido.

   Coleções só do servidor (as regras do Firestore não precisam liberar):
     openfinance_users/{uid}   { items: [{id, bank, createdAt, backfillUntil, refreshedAt}] }
     openfinance_items/{item}  { uid }   ← para o webhook achar o dono
*/
const crypto = require('crypto');
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onMessagePublished } = require('firebase-functions/v2/pubsub');
const { PubSub } = require('@google-cloud/pubsub');
const { setGlobalOptions, logger } = require('firebase-functions/v2');
const { defineSecret, defineString } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const N = require('./normaliza');

initializeApp();
const db = getFirestore();
setGlobalOptions({ region: 'southamerica-east1', maxInstances: 5 });

const PLUGGY_CLIENT_ID = defineSecret('PLUGGY_CLIENT_ID');
const PLUGGY_CLIENT_SECRET = defineSecret('PLUGGY_CLIENT_SECRET');
const PLUGGY_WEBHOOK_KEY = defineSecret('PLUGGY_WEBHOOK_KEY');
/* Quem pode usar. O MeuPluggy é gratuito para acessar os SEUS dados; abrir
   para qualquer conta MedTech geraria custo no Pluggy. Perguntado no deploy
   (não fica no repositório, que é público). */
const OF_EMAILS = defineString('OF_EMAILS', {
  description: 'E-mails (separados por vírgula) das contas MedTech que podem usar o Open Finance no Granaê',
});
const SECRETS = [PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET, PLUGGY_WEBHOOK_KEY];

const API = 'https://api.pluggy.ai';
const DIA = 24 * 3600 * 1000;
const JANELA_DIAS = 45;          // lançamentos mantidos no resumo (ver nota no app sobre tombstones)
const JANELA_INICIAL_DIAS = 90;  // na primeira hora após conectar, puxa mais histórico

/* ---------------- Pluggy ---------------- */
let _chave = { valor: null, expira: 0 };
async function apiKey() {
  if (_chave.valor && Date.now() < _chave.expira) return _chave.valor;
  const r = await fetch(API + '/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: PLUGGY_CLIENT_ID.value(), clientSecret: PLUGGY_CLIENT_SECRET.value() }),
  });
  if (!r.ok) throw erroPluggy(r.status, await r.text());
  const j = await r.json();
  _chave = { valor: j.apiKey, expira: Date.now() + 100 * 60 * 1000 }; // a chave vale 2 h
  return _chave.valor;
}

function erroPluggy(status, corpo) {
  let msg = corpo;
  try { const j = JSON.parse(corpo); msg = j.message || j.error || corpo; } catch {}
  const e = new Error(`Pluggy ${status}: ${String(msg).slice(0, 300)}`);
  e.status = status;
  return e;
}

async function pluggy(metodo, caminho, corpo) {
  const r = await fetch(API + caminho, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', 'X-API-KEY': await apiKey() },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  if (r.status === 401) _chave = { valor: null, expira: 0 };
  if (!r.ok) throw erroPluggy(r.status, await r.text());
  const txt = await r.text();
  return txt ? JSON.parse(txt) : {};
}

/* GET /transactions (por página) foi desativado pelo Pluggy (410). O /v2 pagina
   por cursor: cada resposta traz "next", um trecho de query pronto para a
   próxima página (ou null). Aceita as formas "?a=b", "a=b", URL ou só o cursor. */
async function todasTransacoes(accountId, desde) {
  const out = [];
  let q = new URLSearchParams({ accountId, dateFrom: desde });
  for (let pagina = 0; q && pagina < 40; pagina++) {
    const r = await pluggy('GET', '/v2/transactions?' + q);
    out.push(...(r.results || []));
    q = proximaPagina(r.next, accountId);
  }
  return out;
}

function proximaPagina(next, accountId) {
  if (!next) return null;
  let s = String(next).trim();
  if (/^https?:/.test(s)) s = new URL(s).search;
  s = s.replace(/^.*\?/, '');
  const q = /(^|&)(after|accountId)=/.test(s) ? new URLSearchParams(s) : new URLSearchParams({ after: s });
  if (!q.get('accountId')) q.set('accountId', accountId);
  return q;
}

async function produtosExtras(itemId, pi) {
  const out = [];
  try {
    const r = await pluggy('GET', `/loans?itemId=${encodeURIComponent(itemId)}`);
    for (const l of r.results || []) out.push({ tipo: 'loan', v: N.emprestimo(l, pi) });
  } catch (e) { logger.info('sem financiamentos', { item: itemId, erro: e.message }); }
  try {
    for (let pagina = 1; pagina <= 5; pagina++) {
      const r = await pluggy('GET', `/investments?itemId=${encodeURIComponent(itemId)}&pageSize=100&page=${pagina}`);
      for (const i of r.results || []) {
        const v = N.investimento(i, pi);
        if (v.balance || v.gross) out.push({ tipo: 'inv', v });  // resgatado (saldo zero) não entra
      }
      if (!r.totalPages || pagina >= r.totalPages) break;
    }
  } catch (e) { logger.info('sem investimentos', { item: itemId, erro: e.message }); }
  return out;
}

const ymd = (ms) => new Date(ms).toISOString().slice(0, 10);

/* ---------------- Sincronização ---------------- */
async function sincronizar(uid, { atualizar = false } = {}) {
  const ref = db.doc(`openfinance_users/${uid}`);
  const snap = await ref.get();
  const itens = (snap.exists && snap.data().items) || [];
  const agora = Date.now();
  const feed = { v: 1, syncedAt: agora, items: [], accounts: [], transactions: [], loans: [], investments: [] };
  const mudancas = {}; // itemId → campos a atualizar na lista (refreshedAt, bank)
  /* No MeuPluggy cada banco é uma conexão, todas com o mesmo login. Se o mesmo
     banco for ligado duas vezes, as contas chegam com ids novos e os lançamentos
     entrariam em dobro: a primeira conexão vence e a repetida é ignorada. */
  const contasVistas = new Set(), extrasVistos = new Set();
  const chaveConta = (a) => [a.type, a.subtype, a.number, a.marketingName || a.name].map(x => String(x || '').toLowerCase().trim()).join('|');

  for (const it of itens) {
    try {
      const pi = await pluggy('GET', `/items/${it.id}`);
      // "Sincronizar agora": pede ao Pluggy para buscar no banco. No MeuPluggy
      // a atualização é diária e pode ser recusada; não é erro.
      if (atualizar && pi.status !== 'UPDATING' && agora - (it.refreshedAt || 0) > 10 * 60 * 1000) {
        try { await pluggy('PATCH', `/items/${it.id}`, {}); (mudancas[it.id] ||= {}).refreshedAt = agora; }
        catch (e) { logger.info('atualização recusada', { item: it.id, erro: e.message }); }
      }
      if (pi.connector && pi.connector.name && pi.connector.name !== it.bank) (mudancas[it.id] ||= {}).bank = pi.connector.name;

      const dias = agora < (it.backfillUntil || 0) ? JANELA_INICIAL_DIAS : JANELA_DIAS;
      const desde = ymd(agora - dias * DIA);
      const todas = (await pluggy('GET', `/accounts?itemId=${encodeURIComponent(it.id)}`)).results || [];
      const contas = todas.filter(a => !contasVistas.has(chaveConta(a)));
      if (contas.length < todas.length) logger.info('contas repetidas ignoradas', { item: it.id, repetidas: todas.length - contas.length });
      contas.forEach(a => contasVistas.add(chaveConta(a)));
      const lotes = await Promise.all(contas.map(a => todasTransacoes(a.id, desde)));
      // só entra no resumo depois de tudo buscado: item pela metade não vai
      const resumo = N.item(pi);
      // no MeuPluggy o conector de todas as conexões se chama "MeuPluggy": mostra o banco
      if (/meu ?pluggy/i.test(resumo.bank) && (contas[0] || todas[0])) resumo.bank = `${(contas[0] || todas[0]).name} · MeuPluggy`;
      feed.items.push(resumo);
      // financiamentos e investimentos (inclui previdência): produto à parte no
      // Pluggy; se não vier, o resto da conexão segue normal
      for (const e of await produtosExtras(it.id, pi)) {
        const chave = e.tipo + '|' + [e.v.name, e.v.contract || '', e.v.subtype || '', e.v.bank].join('|').toLowerCase();
        if (extrasVistos.has(chave)) continue;
        extrasVistos.add(chave);
        (e.tipo === 'loan' ? feed.loans : feed.investments).push(e.v);
      }
      contas.forEach((a, i) => {
        feed.accounts.push({ ...N.conta(a, pi), from: desde });
        for (const t of lotes[i]) {
          const tx = N.transacao(t, a);
          if (tx.date) feed.transactions.push(tx);
        }
      });
    } catch (e) {
      // uma conexão com problema não impede as outras de sincronizar
      logger.warn('item indisponível', { uid, item: it.id, erro: e.message });
      feed.items.push({ id: it.id, bank: it.bank || 'Banco', status: 'ERROR', error: e.status === 404 ? 'Conexão removida no Pluggy. Conecte de novo.' : e.message });
    }
  }

  await db.doc(`users/${uid}/apps/granae_of`).set({
    json: N.cabeNoDocumento(feed),
    updatedAt: FieldValue.serverTimestamp(),
  });
  // Relê a lista numa transação: um addItem pode ter entrado durante a sincronização
  if (Object.keys(mudancas).length) {
    await db.runTransaction(async (tx) => {
      const atual = await tx.get(ref);
      const lista = ((atual.exists && atual.data().items) || []).map(x => mudancas[x.id] ? { ...x, ...mudancas[x.id] } : x);
      tx.set(ref, { items: lista }, { merge: true });
    });
  }
  return { contas: feed.accounts.length, lancamentos: feed.transactions.length };
}

/* ---------------- Autorização ---------------- */
function autorizado(token) {
  const lista = String(OF_EMAILS.value() || '').toLowerCase().split(/[,;\s]+/).filter(Boolean);
  const email = String(token.email || '').toLowerCase();
  /* Conta de e-mail/senha costuma ficar com email_verified=false, mas o Firebase
     não deixa duas contas de senha com o mesmo e-mail: se ela existe, é do dono.
     Por isso OF_EMAILS só deve ter e-mails que JÁ têm conta MedTech; um e-mail
     sem conta poderia ser registrado por outra pessoa. */
  const provedor = token.firebase && token.firebase.sign_in_provider;
  const confiavel = token.email_verified === true || provedor === 'password';
  return !!email && confiavel && lista.includes(email);
}

async function donoDoItem(uid, itemId) {
  const m = await db.doc(`openfinance_items/${itemId}`).get();
  if (!m.exists || m.data().uid !== uid) throw new HttpsError('permission-denied', 'Esta conexão não é sua.');
}

function urlWebhook() {
  const proj = process.env.GCLOUD_PROJECT || JSON.parse(process.env.FIREBASE_CONFIG || '{}').projectId;
  return `https://southamerica-east1-${proj}.cloudfunctions.net/pluggyWebhook?k=${encodeURIComponent(PLUGGY_WEBHOOK_KEY.value())}`;
}

/* Aviso no nível da APLICAÇÃO (POST /webhooks). O webhookUrl do connect token
   só cobre eventos daquela conexão no momento da criação; as atualizações
   diárias do MeuPluggy não chegavam por ele (logs: nenhum aviso desde 28/09) e
   o Granaê só via o banco na varredura. Garante um aviso "all" apontando para
   cá; roda no máximo uma vez por instância. */
let _webhookOk = false;
async function garantirWebhook() {
  if (_webhookOk) return;
  try {
    const url = urlWebhook();
    const base = url.split('?')[0];
    const r = await pluggy('GET', '/webhooks');
    const lista = (r && (r.results || r)) || [];
    const meus = (Array.isArray(lista) ? lista : []).filter(w => String(w.url || '').split('?')[0] === base);
    if (!meus.some(w => w.url === url && w.event === 'all')) {
      for (const w of meus) { try { await pluggy('DELETE', `/webhooks/${w.id}`); } catch {} } // senha antiga
      await pluggy('POST', '/webhooks', { event: 'all', url });
      logger.info('webhook da aplicação registrado');
    }
    _webhookOk = true;
  } catch (e) { logger.warn('não consegui registrar o webhook da aplicação', { erro: e.message }); }
}

function paraHttps(e) {
  if (e instanceof HttpsError) return e;
  logger.error(e);
  return new HttpsError('internal', e.message || 'Falha no Open Finance');
}

/* ---------------- Funções ---------------- */
exports.openfinance = onCall({ secrets: SECRETS, timeoutSeconds: 120, memory: '256MiB' }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta MedTech.');
  if (!autorizado(req.auth.token)) throw new HttpsError('permission-denied', 'O Open Finance ainda não está liberado para esta conta.');
  const uid = req.auth.uid;
  const d = req.data || {};
  try {
    switch (d.action) {
      case 'connectToken': {
        if (d.itemId) await donoDoItem(uid, d.itemId);
        const r = await pluggy('POST', '/connect_token', {
          itemId: d.itemId || undefined,
          // avoidDuplicates recusava o 2º banco do MeuPluggy (mesmo login para todos);
          // conta repetida é filtrada na sincronização
          options: { clientUserId: uid, webhookUrl: urlWebhook(), avoidDuplicates: false },
        });
        return { accessToken: r.accessToken };
      }
      case 'addItem': {
        const itemId = String(d.itemId || '');
        if (!/^[\w-]{8,64}$/.test(itemId)) throw new HttpsError('invalid-argument', 'itemId inválido');
        const pi = await pluggy('GET', `/items/${itemId}`);
        if (pi.clientUserId && pi.clientUserId !== uid) throw new HttpsError('permission-denied', 'Esta conexão não é sua.');
        const mapa = db.doc(`openfinance_items/${itemId}`);
        const ref = db.doc(`openfinance_users/${uid}`);
        await db.runTransaction(async (tx) => {
          const m = await tx.get(mapa);
          if (m.exists && m.data().uid !== uid) throw new HttpsError('permission-denied', 'Esta conexão não é sua.');
          const u = await tx.get(ref);
          const itens = ((u.exists && u.data().items) || []).filter(x => x.id !== itemId);
          const agora = Date.now();
          itens.push({ id: itemId, bank: (pi.connector && pi.connector.name) || 'Banco', createdAt: agora, backfillUntil: agora + 3600 * 1000 });
          tx.set(mapa, { uid, createdAt: agora });
          tx.set(ref, { items: itens }, { merge: true });
        });
        return await sincronizar(uid);
      }
      case 'sync':
        await garantirWebhook();
        return await sincronizar(uid, { atualizar: !!d.refresh });
      case 'removeItem': {
        const itemId = String(d.itemId || '');
        await donoDoItem(uid, itemId);
        try { await pluggy('DELETE', `/items/${itemId}`); }
        catch (e) { if (e.status !== 404) throw e; }
        const ref = db.doc(`openfinance_users/${uid}`);
        const u = await ref.get();
        const itens = ((u.exists && u.data().items) || []).filter(x => x.id !== itemId);
        await ref.set({ items: itens }, { merge: true });
        await db.doc(`openfinance_items/${itemId}`).delete();
        return await sincronizar(uid);
      }
      default:
        throw new HttpsError('invalid-argument', 'Ação desconhecida');
    }
  } catch (e) { throw paraHttps(e); }
});

function chaveConfere(recebida) {
  const a = Buffer.from(String(recebida || ''));
  const b = Buffer.from(PLUGGY_WEBHOOK_KEY.value());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const TOPICO = 'openfinance-sync';
let _pubsub = null;

/* O Pluggy espera resposta rápida do webhook; buscar tudo no banco pode levar
   alguns segundos. Então o webhook só enfileira e responde. */
exports.pluggyWebhook = onRequest({ secrets: [PLUGGY_WEBHOOK_KEY], timeoutSeconds: 30, memory: '256MiB' }, async (req, res) => {
  if (req.method !== 'POST') { res.status(405).end(); return; }
  if (!chaveConfere(req.query.k)) { res.status(403).end(); return; }
  const ev = req.body || {};
  const itemId = ev.itemId;
  logger.info('webhook', { event: ev.event, item: itemId });
  if (!itemId || !/^(transactions\/|item\/)/.test(ev.event || '')) { res.status(200).send('ok'); return; }
  try {
    const m = await db.doc(`openfinance_items/${itemId}`).get();
    if (!m.exists) { res.status(200).send('ignorado'); return; }
    _pubsub = _pubsub || new PubSub();
    await _pubsub.topic(TOPICO).publishMessage({ json: { uid: m.data().uid, event: ev.event } });
    res.status(200).send('ok');
  } catch (e) {
    logger.error('webhook falhou', e);
    res.status(500).send('erro'); // o Pluggy tenta de novo
  }
});

exports.openfinanceSyncJob = onMessagePublished({ topic: TOPICO, secrets: SECRETS, timeoutSeconds: 120, memory: '256MiB' }, async (event) => {
  const { uid } = event.data.message.json || {};
  if (!uid) return;
  const r = await sincronizar(uid);
  logger.info('sincronizado via webhook', { uid, ...r });
});

exports.openfinanceCron = onSchedule({ schedule: 'every 3 hours', timeZone: 'America/Sao_Paulo', secrets: SECRETS, timeoutSeconds: 540 }, async () => {
  await garantirWebhook();
  const docs = await db.collection('openfinance_users').listDocuments();
  for (const d of docs) {
    try { await sincronizar(d.id); }
    catch (e) { logger.error('cron: falha ao sincronizar', { uid: d.id, erro: e.message }); }
  }
});
