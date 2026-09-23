#!/usr/bin/env node
/* Paridade entre as regras de acesso do navegador (_mtacesso.js) e do servidor
   (MedTech/backend/functions/acesso.js): sorteia milhares de catálogos e claims e
   exige a MESMA decisão nas duas. Uso: node _testa_acesso.js [caminho/do/acesso.js] */
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os');
const srv = require(process.argv[2] || path.join(os.homedir(), 'Documents/Claude/MedTech/backend/functions/acesso.js'));
const ctx = { console, fetch: () => Promise.reject(new Error('sem rede no teste')), location: { search: '' } };
ctx.globalThis = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '_mtacesso.js'), 'utf8'), ctx);
const cli = ctx.MTAcesso;
const base = JSON.parse(fs.readFileSync(path.join(__dirname, 'planos.json'), 'utf8'));
let seed = 42; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = a => a[Math.floor(rnd() * a.length)];
const AG = 1790000000, apps = [].concat(...Object.values(base.linhas)), ids = base.produtos.map(p => p.id);
let n = 0, dif = [];
for (let i = 0; i < 6000; i++) {
  const P = JSON.parse(JSON.stringify(base));
  P.produtos.forEach(p => { if (rnd() < 0.5) { p.checkout = { mensal: rnd() < 0.8 ? 'https://pay.kiwify.com.br/x' + p.id : '' }; } });
  if (rnd() < 0.2) P.gratis = [pick(apps)];
  const mt = rnd() < 0.1 ? null : { v: 1 };
  if (mt) {
    if (rnd() < 0.1) mt.adm = 1;
    if (rnd() < 0.4) mt.t = AG + Math.floor((rnd() - 0.5) * 20 * 86400);
    if (rnd() < 0.8) { mt.p = {}; const k = 1 + Math.floor(rnd() * 3); for (let j = 0; j < k; j++) mt.p[pick(ids)] = AG + Math.floor((rnd() - 0.4) * 60 * 86400); }
    if (rnd() < 0.6) mt.s = { clinica: [pick(apps), pick(apps), pick(apps)].slice(0, 1 + Math.floor(rnd() * 3)), provas: rnd() < 0.3 ? [pick(apps)] : [] };
  }
  for (const a of apps.concat(['portal', 'desconhecido'])) {
    n++;
    const s = srv.liberado(P, mt, a, AG), c = cli.liberado(P, mt, a, AG);
    if (s.ok !== c.ok || s.motivo !== c.motivo || (s.livres || 0) !== (c.livres || 0)) dif.push({ a, s, c, mt, P: P.produtos.filter(p => p.checkout && p.checkout.mensal).map(p => p.id) });
    if (srv.vendaAtiva(P, a) !== cli.vendaAtiva(P, a)) dif.push({ a, venda: true });
  }
  n++; if (srv.acessoAtivoQualquer(P, mt, AG) !== cli.acessoAtivoQualquer(P, mt, AG)) dif.push({ ia: true, mt });
}
console.log(`comparações: ${n} · divergências: ${dif.length}`);
if (dif.length) { console.log(JSON.stringify(dif.slice(0, 3), null, 1)); process.exit(1); }
/* o catálogo publicado não pode bloquear ninguém enquanto não houver checkout */
const semVenda = apps.every(a => cli.liberado(base, null, a, AG).ok);
console.log(semVenda ? 'planos.json atual: nada bloqueado (nenhum checkout preenchido)' : 'planos.json atual: HÁ produto à venda (bloqueio ativo)');
