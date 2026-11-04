/* Núcleo das sessões de acompanhamento, porta fiel de NucleoSessao.swift do app iOS.
   Sem regra clínica aqui: cada doença mora no seu módulo. Roda no navegador e no Node (módulo ES).
   Datas: sempre número, milissegundos desde 1970 (Date.now()). O Swift guarda segundos desde 2001;
   a conversão fica só no teste diferencial. Contrato completo em LEIAME.md. */

/* ---------- Estado ---------- */

export function novoId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID().toUpperCase();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 3) | 8).toString(16).toUpperCase();
  });
}

/* O estado inteiro da sessão. Não existe campo para nome nem identificador do paciente. */
export function novoEstado(protocolo, inicio) {
  return { protocolo, inicio, series: {}, respostas: {}, escolhas: {}, acoes: [], etapa: 'triagem' };
}

/* max(by:) do Swift: o primeiro entre os empatados. */
function maxPor(lista, menor) {
  let r;
  for (const x of lista) if (r === undefined || menor(r, x)) r = x;
  return r;
}
function minPor(lista, menor) {
  let r;
  for (const x of lista) if (r === undefined || menor(x, r)) r = x;
  return r;
}
export const maior = (lista, menor) => maxPor(lista, menor);
export const menorDe = (lista, menor) => minPor(lista, menor);

export function ultimo(e, id) { const s = e.series[id]; return s ? (maxPor(s, (a, b) => a.hora < b.hora) ?? null) : null; }
export function primeiro(e, id) { const s = e.series[id]; return s ? (minPor(s, (a, b) => a.hora < b.hora) ?? null) : null; }
/* As duas medidas mais recentes, da mais antiga para a mais nova. */
export function ultimosDois(e, id) {
  const s = e.series[id];
  if (!s || s.length < 2) return null;
  const o = [...s].sort((a, b) => a.hora - b.hora);
  return [o[o.length - 2], o[o.length - 1]];
}
export function valor(e, id) { const m = ultimo(e, id); return m ? m.valor : null; }
export function resposta(e, chave) { const v = e.respostas[chave]; return v === undefined ? null : v; }
export function escolha(e, chave) { const v = e.escolhas[chave]; return v === undefined ? null : v; }
export function ultimaAcao(e, ...tipos) { return maxPor(e.acoes.filter((a) => tipos.includes(a.tipo)), (a, b) => a.hora < b.hora) ?? null; }
export function teveAcao(e, tipo) { return e.acoes.some((a) => a.tipo === tipo); }

export function medir(e, id, v, hora) { (e.series[id] ??= []).push({ valor: v, hora }); }
export function registrar(e, a, hora) { e.acoes.push(acaoRegistrada(a.tipo, a.rotulo, hora, { ...a.valores })); }
export function acaoRegistrada(tipo, rotulo, hora, valores = {}) { return { id: novoId(), tipo, rotulo, hora, valores }; }

/* ---------- O que a tela faz com o estado (SessaoView.swift, modelo) ---------- */

export function confirmar(e, a, agora) { registrar(e, a, agora); }
export function desfazerUltima(e) { if (e.acoes.length) e.acoes.pop(); }
export function responder(e, chave, v) { e.respostas[chave] = v; }
/* Resposta a uma pergunta de cartão: a tela também deixa o registro. */
export function responderCartao(e, pergunta, v, agora) {
  e.respostas[pergunta.chave] = v;
  e.acoes.push(acaoRegistrada('resposta.' + pergunta.chave, pergunta.texto + ' ' + (v ? 'Sim' : 'Não'), agora));
}
export function escolher(e, ramo, op) { e.escolhas[ramo] = op; }
/* Resposta de um passo guiado: o registro leva a hora escolhida ou a do toque, e a resposta anterior sai. */
export function responderPasso(e, passo, rotulo, hora, aplicar = () => {}) {
  e.acoes = e.acoes.filter((a) => a.tipo !== 'passo.' + passo.chave);
  aplicar(e);
  e.acoes.push(acaoRegistrada('passo.' + passo.chave, rotulo, hora));
}
/* Volta um passo guiado. Devolve false se não há o que voltar. */
export function voltarPasso(e) {
  let i = -1;
  for (let j = e.acoes.length - 1; j >= 0; j--) if (e.acoes[j].tipo.startsWith('passo.')) { i = j; break; }
  if (i < 0) return false;
  const chave = e.acoes[i].tipo.slice('passo.'.length);
  e.acoes.splice(i, 1);
  delete e.respostas[chave];
  delete e.respostas['semDado.' + chave];
  delete e.escolhas[chave];
  if (e.series[chave] && e.series[chave].length) e.series[chave].pop();
  return true;
}

/* ---------- Definições que cada doença declara ---------- */

export const defParametro = (id, nome, unidade, minPlausivel, maxPlausivel, casas = 1) => ({ id, nome, unidade, minPlausivel, maxPlausivel, casas });
export const foraDaFaixa = (d, v) => v < d.minPlausivel || v > d.maxPlausivel;
export const pergunta = (chave, texto, detalhe = null) => ({ chave, texto, detalhe });
export const opcaoRamo = (id, rotulo, detalhe) => ({ id, rotulo, detalhe });
export const defRamo = (id, titulo, opcoes) => ({ id, titulo, opcoes });
export const defExame = (id, nome, aviso, destaque = false) => ({ id, nome, aviso, destaque });
export const linhaGrafico = (valor, rotulo) => ({ valor, rotulo });
export const defGrafico = (id, titulo, parametros, linhas) => ({ id, titulo, parametros, linhas });

/* Os padrões da extensão de ProtocoloSessao. O motor passa só o que muda. */
export function criarProtocolo(p) {
  const r = {
    tituloRamos: 'Gravidade e via',
    nomeFonte: 'consenso',
    graficoFixo: null,
    rotuloPrazoExame: 'repetir até',
    mostraTodasAsFontes: false,
    tituloExames: 'Exames',
    tituloOutrosExames: 'Outros exames a cada 4 h',
    tituloResolucao: 'Resolução e transição',
    camposResultados() { return this.parametrosResultados; },
    perguntasResultados() { return this.perguntasAcompanhamento; },
    ...p,
  };
  if (!('rotuloProximoPasso' in p)) r.rotuloProximoPasso = r.nomeFonte === 'consenso' ? 'Próximo passo pelo consenso' : 'Próximo passo pela ' + r.nomeFonte;
  /* Métodos presos ao protocolo: a tela pode desestruturar sem perder o this. */
  for (const k of Object.keys(r)) if (typeof r[k] === 'function') r[k] = r[k].bind(r);
  return r;
}

/* ---------- O que a regra devolve ---------- */

export const regra = (linha, texto, origem) => ({ linha, texto, origem });
export const acaoProposta = (tipo, rotulo, valores = {}, secundaria = false) => ({ tipo, rotulo, valores, secundaria });
export const itemPasso = (chave, texto, trava = false) => ({ chave, texto, trava });

/* TipoPasso: { caso: 'simNao' } | { caso: 'opcoes', opcoes } | { caso: 'numero', parametro } | { caso: 'hora', padrao } | { caso: 'lista', itens } */
export const tipoSimNao = () => ({ caso: 'simNao' });
export const tipoOpcoes = (opcoes) => ({ caso: 'opcoes', opcoes });
export const tipoNumero = (parametro) => ({ caso: 'numero', parametro });
export const tipoHora = (padrao) => ({ caso: 'hora', padrao: padrao ?? null });
export const tipoLista = (itens) => ({ caso: 'lista', itens });

export function passoGuiado({ chave, secao, texto, detalhe = null, tipo, regras = [], semDado = null, confirmarPadrao = null }) {
  return { chave, secao, texto, detalhe, tipo, regras, semDado, confirmarPadrao };
}

export const SITUACAO_ROTULO = {
  proximoPasso: 'Próximo passo pelo consenso',
  correndo: 'Em curso',
  travado: 'Bloqueado pela regra',
  semIndicacao: 'Sem indicação agora',
  faltaDado: 'Falta dado',
  decisaoMedico: 'Sem regra: decisão do médico',
  pergunta: 'Responda para seguir',
};
export function rotuloSituacao(situacao, fonte = 'consenso') {
  return situacao === 'proximoPasso' && fonte !== 'consenso' ? 'Próximo passo pela ' + fonte : SITUACAO_ROTULO[situacao];
}

export const perguntaCartao = (chave, texto) => ({ chave, texto });

export function cartao(id, titulo, simbolo, corHex, situacao, valor, extra = {}) {
  return {
    id, titulo, simbolo, corHex, situacao, valor,
    conta: null, detalhe: null, regras: [], acoes: [], pergunta: null,
    discreto: false, primeiro: false, liberado: false, doses: {}, etiqueta: null, noTopo: false,
    ...extra,
  };
}
/* nivel: 'amarelo' | 'vermelho' (no Swift, 0 e 1). */
export const alerta = (id, nivel, texto, regraFonte) => ({ id, nivel, texto, regra: regraFonte });
export const trava = (id, titulo, texto, regraFonte) => ({ id, titulo, texto, regra: regraFonte });

/* situacao: 'semDado' | 'noPrazo' | 'vencido' | 'encerrado' */
export function exameDevido({ id, nome, aviso, destaque, ultima = null, janelaInicio = null, proxima = null, situacao, regra: r, rotuloSemDado = 'colher' }) {
  return { id, nome, aviso, destaque, ultima, janelaInicio, proxima, situacao, regra: r, rotuloSemDado };
}
/* situacao: 'sim' | 'nao' | 'falta' */
export const criterio = (id, nome, situacao, valor = null, opcional = false) => ({ id, nome, situacao, valor, opcional });
export const painelCriterios = (titulo, criterios, cumprido, regraFonte, acao = null, texto = null) => ({ titulo, criterios, cumprido, regra: regraFonte, acao, texto });
export const marcoCronometro = (minutos, rotulo) => ({ minutos, rotulo });
export const cronometroSessao = (titulo, desde, subtitulo = null, marcos = [], regraFonte = null) => ({ titulo, desde, subtitulo, marcos, regra: regraFonte });

export function orientacoes() {
  return {
    foraDeEscopo: [],
    triagemCompleta: true,
    confirmacao: null,
    classificacao: null,
    classificacaoDetalhe: null,
    classificacaoRegra: null,
    ramoBloqueado: {},
    travas: [],
    alertas: [],
    cartoes: [],
    exames: [],
    resolucao: null,
    etapasFinais: [],
    encerradaPelaRegra: null,
    passo: null,
    relogioDesde: null,
    faixaCaminho: null,
    cronometro: null,
    ramoAtual: {},
  };
}
export const cartaoDe = (o, id) => [...o.cartoes, ...o.etapasFinais].find((c) => c.id === id) ?? null;
export const exameDe = (o, id) => o.exames.find((x) => x.id === id) ?? null;
export const temVencido = (o) => o.exames.some((x) => x.situacao === 'vencido' || x.situacao === 'semDado');

/* Cópia de valor: no Swift tudo isto é struct; em JS, quem copia para depois mexer usa isto. */
export const copia = (x) => (x === null || x === undefined ? x : structuredClone(x));

/* ---------- Formato ---------- */

/* Igual ao String(format: "%.Nf") da Apple: arredonda os dígitos mais curtos do número (os de toString),
   meio para par. Conferido contra o Swift em 3,4 milhões de formatações. Ex.: 2.675 → "2.68", 0.125 → "0.12". */
export function fixo(v, casas) {
  if (!Number.isFinite(v)) return Number.isNaN(v) ? 'nan' : v < 0 ? '-inf' : 'inf';
  const neg = v < 0 || Object.is(v, -0);
  const m = Math.abs(v).toString().match(/^(\d+)(?:\.(\d+))?(?:e([+-]\d+))?$/);
  let dig = m[1] + (m[2] || '');
  let ponto = m[1].length + (m[3] ? +m[3] : 0);
  const z = dig.match(/^0+(?=\d)/);
  if (z) { dig = dig.slice(z[0].length); ponto -= z[0].length; }
  if (ponto < 0) { dig = '0'.repeat(-ponto) + dig; ponto = 0; }
  while (dig.length < ponto + casas + 1) dig += '0';
  const fica = dig.slice(0, ponto + casas), resto = dig.slice(ponto + casas);
  let sobe = false;
  if (resto[0] > '5') sobe = true;
  else if (resto[0] === '5') sobe = /[1-9]/.test(resto.slice(1)) || (fica.length ? +fica[fica.length - 1] % 2 === 1 : false);
  let n = BigInt(fica || '0');
  if (sobe) n += 1n;
  const t = n.toString().padStart(casas + 1, '0');
  const r = casas > 0 ? t.slice(0, t.length - casas) + '.' + t.slice(t.length - casas) : t;
  return (neg ? '-' : '') + r;
}

/* Vírgula decimal e sem zeros à direita. */
export function num(v, casas = 2) {
  let s = fixo(v, casas);
  if (s.includes('.')) {
    s = s.replace(/0+$/, '');
    if (s.endsWith('.')) s = s.slice(0, -1);
  }
  return s.replaceAll('.', ',');
}
/* HH:mm no fuso do aparelho, como o DateFormatter. */
export function hora(ms) {
  const d = new Date(ms);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
/* Recebe segundos, como o TimeInterval do Swift. */
export function duracao(s) {
  const t = Math.trunc(Math.abs(s));
  const h = Math.trunc(t / 3600), m = Math.trunc((t % 3600) / 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}
/* agora.timeIntervalSince(d), em segundos. */
export const desde = (agora, d) => (agora - d) / 1000;
/* d.addingTimeInterval(s), s em segundos. */
export const mais = (d, s) => d + s * 1000;
/* Int(x) do Swift: trunca para zero. */
export const inteiro = (x) => Math.trunc(x);
/* x.rounded() do Swift: meio para longe do zero. */
export const arredonda = (x) => (x < 0 ? -Math.round(-x) : Math.round(x));

/* ---------- O que mudou entre duas avaliações ---------- */

export function mudancas(a, d) {
  const r = [];
  const mud = (id, titulo, antes, depois, porque) => r.push({ id, titulo, antes, depois, porque: porque ?? null });
  const conta = (c) => c.valor + (c.conta !== null ? ' (' + c.conta + ')' : '');
  for (const t of d.travas) if (!a.travas.some((x) => x.id === t.id)) mud('trava+' + t.id, t.titulo, 'Sem bloqueio', 'Bloqueado', t.regra);
  for (const t of a.travas) if (!d.travas.some((x) => x.id === t.id)) mud('trava-' + t.id, t.titulo, 'Bloqueado', 'Bloqueio saiu', t.regra);
  for (const x of d.alertas) if (!a.alertas.some((y) => y.id === x.id)) mud('al+' + x.id, 'Novo alerta', 'Sem este alerta', x.texto, x.regra);
  for (const x of a.alertas) if (!d.alertas.some((y) => y.id === x.id)) mud('al-' + x.id, 'Alerta saiu', x.texto, 'Sem este alerta', x.regra);
  const antes = [...a.cartoes, ...a.etapasFinais];
  for (const c of [...d.cartoes, ...d.etapasFinais]) {
    const v = antes.find((x) => x.id === c.id);
    if (!v) { mud('c+' + c.id, c.titulo, 'Sem orientação', c.valor, c.regras[0]); continue; }
    if (v.situacao !== c.situacao || v.valor !== c.valor || v.conta !== c.conta) mud('c~' + c.id, c.titulo, conta(v), conta(c), c.regras[0]);
  }
  const ca = a.resolucao ? a.resolucao.cumprido : null, cd = d.resolucao ? d.resolucao.cumprido : null;
  if (ca !== cd && d.resolucao) {
    const n = d.resolucao;
    mud('res', n.titulo, ca === true ? 'Critérios cumpridos' : 'Critérios não cumpridos', n.cumprido ? 'Critérios cumpridos' : 'Critérios não cumpridos', n.regra);
  }
  return r;
}

/* ---------- Passagem de plantão: modelo fixo, sem texto livre e sem IA ---------- */

export function passagem(p, e, o, agora) {
  const l = [];
  const conta = (c) => c.valor + (c.conta !== null ? ' (' + c.conta + ')' : '');
  l.push('PASSAGEM DE PLANTÃO: ' + p.nome.toUpperCase());
  l.push('Sessão iniciada às ' + hora(e.inicio) + ', há ' + duracao(desde(agora, e.inicio)) + '.');
  if (o.classificacao !== null) l.push(o.classificacao + '.');
  if (o.cronometro) l.push(o.cronometro.titulo + ': ' + duracao(desde(agora, o.cronometro.desde)) + ', desde ' + hora(o.cronometro.desde) + '.');
  for (const r of p.ramos) {
    const v = o.ramoAtual[r.id] ?? e.escolhas[r.id];
    const op = v !== undefined ? r.opcoes.find((x) => x.id === v) : undefined;
    if (op) l.push(r.titulo + ': ' + op.rotulo + '.');
  }
  l.push('');
  l.push('Últimos valores:');
  for (const d of p.parametros) {
    const m = ultimo(e, d.id);
    if (m) l.push('- ' + d.nome + ': ' + num(m.valor, d.casas) + ' ' + d.unidade + ' às ' + hora(m.hora));
  }
  const correndo = o.cartoes.filter((c) => c.situacao === 'correndo');
  if (correndo.length) {
    l.push('');
    l.push('Em curso:');
    for (const c of correndo) l.push('- ' + c.titulo + ': ' + conta(c));
  }
  const passos = [
    ...o.travas.map((t) => '- BLOQUEIO: ' + t.titulo + '. ' + t.texto),
    ...[...o.cartoes, ...o.etapasFinais].filter((c) => c.situacao === 'proximoPasso').map((c) => '- ' + c.titulo + ': ' + conta(c)),
  ];
  if (passos.length) {
    l.push('');
    l.push(p.rotuloProximoPasso + ':');
    l.push(...passos);
  }
  if (o.alertas.length) {
    l.push('');
    l.push('Alertas:');
    l.push(...o.alertas.map((x) => '- ' + x.texto));
  }
  const ex = o.exames.filter((x) => x.situacao !== 'encerrado');
  if (ex.length) {
    l.push('');
    l.push(p.tituloExames + ':');
    for (const x of ex) {
      if (x.situacao === 'semDado') l.push('- ' + x.nome + ': sem registro');
      else if (x.situacao === 'vencido') l.push('- ' + x.nome + ': VENCIDO desde ' + hora(x.proxima ?? agora));
      else l.push('- ' + x.nome + ': ' + p.rotuloPrazoExame + ' ' + hora(x.proxima ?? agora));
    }
  }
  if (o.resolucao) {
    l.push('');
    l.push(o.resolucao.titulo + ': ' + (o.resolucao.cumprido ? 'critérios cumpridos' : 'critérios não cumpridos') + '.');
  }
  const reg = [...e.acoes].sort((a, b) => a.hora - b.hora).filter((a) => !a.tipo.startsWith('resposta'));
  if (reg.length) {
    l.push('');
    l.push('Registro das confirmações:');
    for (const a of reg) l.push('- ' + hora(a.hora) + ' ' + a.rotulo);
  }
  l.push('');
  l.push('Fonte: ' + p.referencia);
  l.push('Apoio à decisão. A conduta é do médico.');
  return l.join('\n');
}

/* ---------- Guarda no aparelho ---------- */

/* Uma chave por doença; o estado nunca sai do aparelho. */
export const CHAVE_ARMAZEM = 'mt.sessao.v1.';
export function salvarEstado(e, armazem = globalThis.localStorage) {
  try { armazem.setItem(CHAVE_ARMAZEM + e.protocolo, JSON.stringify(e)); return true; } catch { return false; }
}
export function carregarEstado(id, armazem = globalThis.localStorage) {
  try { const s = armazem.getItem(CHAVE_ARMAZEM + id); return s ? JSON.parse(s) : null; } catch { return null; }
}
export function apagarEstado(id, armazem = globalThis.localStorage) {
  try { armazem.removeItem(CHAVE_ARMAZEM + id); } catch { /* sem armazém */ }
}
