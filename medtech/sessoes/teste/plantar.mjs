/* Erros plantados no JS: os mesmos do tools/sessao_<doenca>_teste.sh do app, traduzidos para o módulo JS.
   Cada um tem de reprovar duas vezes: no teste diferencial (varredura) e nos testes do app (casos à mão + grades)
   rodando sobre o JS (casos.sh, modo js). Os binários são compilados uma vez: o Swift não muda entre mutantes.
   Uso: node plantar.mjs <doenca> [escala da varredura, padrão 0.3]   (DESDE=n retoma do n-ésimo) */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const sessoes = path.resolve(aqui, '..');
const D = process.argv[2];
const ESC = process.argv[3] ?? '0.3';
const DESDE = +(process.env.DESDE ?? 1);
const IOS = process.env.IOS ?? path.join(os.homedir(), 'Documents/Claude/medtech-ios');
const S = path.join(IOS, 'MedTech/Ferramentas/Sessoes');
const MOTOR = { cad: 'MotorCAD', sca: 'MotorSCA', sepse: 'MotorSepse', anafilaxia: 'MotorAnafilaxia', epileptico: 'MotorEpileptico', ehh: 'MotorEHH', hipona: 'MotorHipona' }[D];
const { default: lista } = await import(path.join(aqui, 'plantados', D + '.mjs'));
/* Os mesmos argumentos que o .sh do app usa nos mutantes. */
const argsCasos = [`tools/sessao_${D}_casos.md`, ...(D === 'sca' ? ['docs/sessao_sca_regras.md'] : []), ...(D === 'ehh' || D === 'hipona' ? ['--rapido'] : [])];

const T = fs.mkdtempSync(path.join(os.tmpdir(), `mtsessoes-plantar-${D}-`));
console.log(`Compilando os dois binários de ${D} (uma vez só; o Swift não muda)...`);
const envBase = { ...process.env, SWIFT_DETERMINISTIC_HASHING: '1', PONTE_JS: path.join(aqui, 'ponte.mjs') };
execFileSync('zsh', [path.join(aqui, 'varredura.sh'), D], { env: { ...envBase, COMPILAR: `${T}/varr` }, stdio: ['ignore', 'inherit', 'inherit'] });
execFileSync('zsh', [path.join(aqui, 'casos.sh'), D], { env: { ...envBase, COMPILAR: `${T}/casos` }, stdio: ['ignore', 'inherit', 'inherit'] });

const linhaChave = (s) => {
  const ls = String(s ?? '').trim().split('\n').filter((l) => l && !l.startsWith('PONTE['));
  return (ls.find((l) => l.startsWith('DIFERENÇA') || l.startsWith('REPROVADO')) ?? ls.pop() ?? '').slice(0, 160);
};
let n = 0, pegosV = 0, pegosC = 0, rodados = 0;
const falhas = [];
for (const { nome, de, para, arquivo = D + '.js' } of lista) {
  n++;
  if (n < DESDE) continue;
  rodados++;
  const dir = path.join(T, 'js' + n);
  fs.cpSync(sessoes, dir, { recursive: true, filter: (f) => !f.startsWith(path.join(sessoes, 'teste')) });
  const alvo = path.join(dir, arquivo);
  const src = fs.readFileSync(alvo, 'utf8');
  const i = src.indexOf(de);
  if (i < 0) { console.log(`  ${n} NÃO APLICOU: ${nome}`); falhas.push(n + ' ' + nome + ' (não aplicou)'); continue; }
  fs.writeFileSync(alvo, src.slice(0, i) + para + src.slice(i + de.length));
  const env = { ...envBase, SESSOES_DIR: dir };
  const op = { encoding: 'utf8', cwd: IOS, maxBuffer: 1 << 29 };
  const v = spawnSync(`${T}/varr`, [`${S}/${MOTOR}.swift`, '1', ESC], { ...op, env: { ...env, PONTE: 'comparar' } });
  const c = spawnSync(`${T}/casos`, argsCasos, { ...op, env: { ...env, PONTE: 'js' } });
  /* Reprovar é sair com código diferente de zero; processo que nem rodou (status null) não conta. */
  const res = (r) => (r.status === null ? 'ERRO: não rodou (' + (r.error?.code ?? r.signal) + ')' : r.status !== 0 ? 'REPROVOU' : 'PASSOU (erro não pego)');
  const rv = v.status !== null && v.status !== 0, rc = c.status !== null && c.status !== 0;
  if (rv) pegosV++;
  if (rc) pegosC++;
  if (!rv || !rc) falhas.push(`${n} ${nome}${rv ? '' : ' [diferencial]'}${rc ? '' : ' [casos]'}`);
  console.log(`  ${n} ${nome}`);
  console.log(`     diferencial: ${res(v)}: ${linhaChave(v.stdout + '\n' + v.stderr)}`);
  console.log(`     testes do app sobre o JS: ${res(c)}: ${linhaChave(c.stdout)}`);
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log(`PLANTADOS ${D}: ${rodados} erros; diferencial reprovou ${pegosV} de ${rodados}; testes do app sobre o JS reprovaram ${pegosC} de ${rodados}.`);
if (falhas.length) console.log('Não pegos: ' + falhas.join('; '));
fs.rmSync(T, { recursive: true, force: true });
process.exit(falhas.length ? 3 : 0);
