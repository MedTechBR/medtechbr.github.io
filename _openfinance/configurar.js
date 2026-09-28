#!/usr/bin/env node
/* Configura o Open Finance do Granaê de ponta a ponta, num comando só:
     node _openfinance/configurar.js
   Funciona no Windows, macOS e Linux (precisa só do Node 18+).
   O que faz: login no Firebase → pede e TESTA as credenciais do Pluggy →
   gera a senha do webhook → grava os segredos → publica as funções.
   Nada digitado aqui vai para o Git nem sai do seu computador, exceto
   para o Firebase (segredos) e para o Pluggy (teste das credenciais). */
const { spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');

const PROJETO = 'medtech-c658c';
const RAIZ = __dirname;
const FUNCOES = path.join(RAIZ, 'functions');
const WIN = process.platform === 'win32';
const SECO = !!process.env.DRY_RUN; // DRY_RUN=1 só mostra os comandos

const passo = (n, t) => console.log(`\n\x1b[1m[${n}/6] ${t}\x1b[0m`);
const falha = (t) => { console.error(`\n\x1b[31m✗ ${t}\x1b[0m`); process.exit(1); };

function rodar(cmd, args, opt = {}) {
  console.log(`  $ ${cmd} ${args.join(' ')}`);
  if (SECO) return { status: 0, stdout: '' };
  const r = spawnSync(cmd, args, { stdio: opt.capturar ? 'pipe' : 'inherit', shell: WIN, cwd: opt.cwd || RAIZ, encoding: 'utf8' });
  if (r.status !== 0 && !opt.tolerar) falha(`O comando falhou: ${cmd} ${args.join(' ')}`);
  return r;
}

// criado só depois do "firebase login", que também lê o teclado
let rl = null, mudo = false;
function leitor() {
  if (rl) return rl;
  rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl._writeToOutput = function (s) { if (!mudo || /[\r\n]/.test(s)) rl.output.write(mudo ? '\n' : s); };
  return rl;
}
const perguntar = (q, { oculto = false, padrao = '' } = {}) => new Promise((ok) => {
  const rl = leitor();
  rl.output.write(q + (padrao ? ` [${padrao}]` : '') + ': ');
  mudo = oculto;
  rl.question('', (r) => { mudo = false; ok((r || '').trim() || padrao); });
});

function abrir(url) {
  const [c, a] = WIN ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  try { spawnSync(c, a, { stdio: 'ignore' }); } catch {}
}

function firebase() {
  const v = spawnSync('firebase', ['--version'], { shell: WIN, encoding: 'utf8' });
  if (v.status === 0) return ['firebase', []];
  console.log('  Firebase CLI não encontrado; usando npx firebase-tools (a primeira vez demora um pouco).');
  return ['npx', ['-y', 'firebase-tools@latest']];
}

async function testarPluggy(clientId, clientSecret) {
  if (SECO) return true;
  const r = await fetch('https://api.pluggy.ai/auth', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, clientSecret }),
  });
  return r.ok;
}

(async () => {
  if (+process.versions.node.split('.')[0] < 18) falha('Precisa do Node 18 ou mais novo (https://nodejs.org).');
  console.log('\x1b[1mGranaê × Open Finance: configuração\x1b[0m');
  const [fb, fbArgs] = firebase();
  const F = (...a) => [fb, [...fbArgs, ...a, '--project', PROJETO]];

  passo(1, 'Login no Firebase (abre o navegador se precisar)');
  rodar(fb, [...fbArgs, 'login']);

  passo(2, 'Credenciais do Pluggy');
  console.log(`  1. Entre em https://dashboard.pluggy.ai com o mesmo e-mail do MeuPluggy.
  2. Crie uma Application (Development) e deixe o conector "MeuPluggy" ativo.
  3. Copie o CLIENT_ID e o CLIENT_SECRET e cole aqui.`);
  abrir('https://dashboard.pluggy.ai');
  let clientId, clientSecret;
  for (let t = 0; ; t++) {
    clientId = await perguntar('  CLIENT_ID');
    clientSecret = await perguntar('  CLIENT_SECRET (não aparece ao digitar)', { oculto: true });
    if (clientId && clientSecret && await testarPluggy(clientId, clientSecret)) { console.log('  ✓ Credenciais válidas'); break; }
    if (t >= 2) falha('O Pluggy recusou as credenciais três vezes. Confira no painel e rode de novo.');
    console.log('  ✗ O Pluggy recusou. Confira e cole de novo.');
  }

  passo(3, 'Quem pode usar');
  let padrao = '';
  try { padrao = spawnSync('git', ['config', 'user.email'], { encoding: 'utf8' }).stdout.trim(); } catch {}
  const emails = await perguntar('  E-mail da sua conta MedTech (vários: separe por vírgula)', { padrao });
  if (!/@/.test(emails)) falha('E-mail inválido.');
  if (rl) rl.close();
  if (!SECO) fs.writeFileSync(path.join(FUNCOES, `.env.${PROJETO}`), `OF_EMAILS=${emails}\n`);

  passo(4, 'Instalando dependências da função');
  rodar(WIN ? 'npm.cmd' : 'npm', ['install', '--no-audit', '--no-fund'], { cwd: FUNCOES });

  passo(5, 'Gravando os segredos no Firebase');
  const segredos = {
    PLUGGY_CLIENT_ID: clientId,
    PLUGGY_CLIENT_SECRET: clientSecret,
    PLUGGY_WEBHOOK_KEY: crypto.randomBytes(24).toString('hex'),
  };
  for (const [nome, valor] of Object.entries(segredos)) {
    const arq = path.join(os.tmpdir(), `of-${crypto.randomBytes(6).toString('hex')}`);
    if (!SECO) fs.writeFileSync(arq, valor, { mode: 0o600 });
    try { rodar(...F('functions:secrets:set', nome, '--data-file', arq, '--force')); }
    finally { try { fs.unlinkSync(arq); } catch {} }
  }

  passo(6, 'Publicando as funções (pode levar alguns minutos)');
  rodar(...F('deploy', '--only', 'functions:granae-of'));

  console.log(`\n\x1b[32m✓ Pronto!\x1b[0m
  Agora abra https://medtechbr.com.br/granae.html#categorias
  → Open Finance → Conectar banco → MeuPluggy → autorize cada banco.
  Se o painel disser que não consegue ler o resumo, libere a leitura de
  users/{uid}/apps/granae_of nas regras do Firestore (veja LEIAME.md).`);
  abrir('https://medtechbr.com.br/granae.html#categorias');
})().catch((e) => falha(e.message));
