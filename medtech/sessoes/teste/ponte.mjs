/* Lado JS da ponte do teste diferencial. Lê uma linha de JSON por pedido e responde uma linha.
   SESSOES_DIR troca a pasta dos módulos (usado para plantar erros numa cópia). */
import readline from 'node:readline';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const dir = process.env.SESSOES_DIR ? path.resolve(process.env.SESSOES_DIR) : path.resolve(aqui, '..');
const url = (f) => pathToFileURL(path.join(dir, f)).href;
const nucleo = await import(url('nucleo.js'));
const modulos = {};
async function modulo(id) {
  if (!modulos[id]) modulos[id] = await import(url(id + '.js'));
  return modulos[id];
}
async function protocolo(id) {
  const m = await modulo(id);
  return m.default;
}

/* Igualdade exata: mesmas chaves, mesmos tipos, números idênticos. Devolve o caminho da primeira diferença. */
function dif(a, b, c = '') {
  if (a === b) return null;
  if (typeof a === 'number' && typeof b === 'number') return Object.is(a, b) || (a === 0 && b === 0) ? null : `${c}: Swift ${a} x JS ${b}`;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return `${c}: Swift ${JSON.stringify(a)?.slice(0, 400)} x JS ${JSON.stringify(b)?.slice(0, 400)}`;
  if (Array.isArray(a) !== Array.isArray(b)) return `${c}: lista x objeto`;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return `${c}: Swift ${a.length} itens x JS ${b.length} itens (${JSON.stringify(a.map((x) => x?.id ?? x?.chave ?? x)).slice(0, 300)} x ${JSON.stringify(b.map((x) => x?.id ?? x?.chave ?? x)).slice(0, 300)})`;
    for (let i = 0; i < a.length; i++) { const d = dif(a[i], b[i], `${c}[${i}${a[i]?.id ? '=' + a[i].id : ''}]`); if (d) return d; }
    return null;
  }
  const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
  const falta = ka.filter((k) => !kb.includes(k)), sobra = kb.filter((k) => !ka.includes(k));
  if (falta.length || sobra.length) return `${c}: chaves só no Swift [${falta}] só no JS [${sobra}]`;
  for (const k of ka) { const d = dif(a[k], b[k], c + '.' + k); if (d) return d; }
  return null;
}
const plano = (x) => JSON.parse(JSON.stringify(x));

async function atender(q) {
  if (q.op === 'avaliar') {
    const p = await protocolo(q.p);
    const e = q.e;
    const o = plano(p.avaliar(structuredClone(e), q.agora));
    if (!q.x) return { ok: true, o };
    const js = { o, passagem: nucleo.passagem(p, e, o, q.agora), campos: plano(p.camposResultados(e)), perguntas: plano(p.perguntasResultados(e)) };
    const d = dif(q.x, js);
    return d ? { ok: false, dif: d, estado: JSON.stringify({ e, agora: q.agora }) } : { ok: true };
  }
  if (q.op === 'definicao') {
    const p = await protocolo(q.p);
    const js = {};
    for (const k of Object.keys(q.x)) js[k] = p[k];
    const extra = Object.keys(p).filter((k) => typeof p[k] !== 'function' && !(k in q.x));
    const d = dif(q.x, plano(js)) ?? (extra.length ? `campos a mais no JS: ${extra}` : null);
    return d ? { ok: false, dif: d } : { ok: true };
  }
  if (q.op === 'mudancas') {
    const d = dif(q.x, plano(nucleo.mudancas(q.a, q.d)));
    return d ? { ok: false, dif: d } : { ok: true };
  }
  if (q.op === 'funcao') {
    const m = await modulo(q.p);
    const f = q.p === 'nucleo' ? nucleo[q.f] : m.funcoesTeste?.[q.f];
    if (!f) return { erro: `função ${q.f} não exportada em ${q.p}` };
    const d = dif(q.x, plano(f(...q.args) ?? null));
    return d ? { ok: false, dif: d } : { ok: true };
  }
  return { erro: 'op desconhecida ' + q.op };
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
const sai = process.stdout;
for await (const l of rl) {
  let r;
  try { r = await atender(JSON.parse(l)); } catch (err) { r = { erro: String(err?.stack ?? err).slice(0, 2000) }; }
  sai.write(JSON.stringify(r) + '\n');
}
