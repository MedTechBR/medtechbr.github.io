/* Hiponatremia. Porta fiel de MotorHipona.swift (app iOS). Especificação: docs/sessao_hipona_regras.md do app
   (diretriz europeia ESE/ESICM/ERBP 2014). O número de cada regra é a linha do arquivo de regras; o início da origem é o id da regra ou a seção.
   Não mudar regra aqui sem mudar no Swift: o teste diferencial reprova. */
import {
  criarProtocolo, defParametro, pergunta, defRamo, opcaoRamo, defExame, defGrafico, linhaGrafico, regra,
  orientacoes, cartao, alerta, criterio, painelCriterios, acaoProposta, perguntaCartao, exameDevido,
  ultimo, valor, resposta, ultimaAcao, teveAcao, num, hora, duracao, desde, mais, copia,
} from './nucleo.js';

const textoGrave = 'Sintoma grave: vômito, desconforto cardiorrespiratório, sonolência anormal e profunda, convulsão, coma (Glasgow ≤8) ou sinal de edema cerebral?';
const textoModerado = 'Sintoma moderadamente grave: náusea sem vômito, confusão ou cefaleia?';

const R = {
  h01: regra(41, 'Na <135 e hipotonicidade confirmada pelo médico: entra na sessão.', 'H01: Definição no resumo da diretriz; o limiar de osmolalidade não foi transcrito'),
  h02: regra(42, '130 a <135 leve; 125 a <130 moderada; <125 profunda.', 'H02: Rev. (Clin Exp Nephrol 2025, Tabela 1)'),
  h03: regra(43, '<48 h aguda; ≥48 h ou desconhecida crônica; sem certeza, tratar como crônica.', 'H03: Rev. e escolha do app'),
  h04: regra(44, 'Graves: vômito, desconforto cardiorrespiratório, sonolência anormal e profunda, convulsão, coma (Glasgow ≤8), sinal de edema cerebral. Moderadamente graves: náusea sem vômito, confusão, cefaleia.', 'H04: Tabela de sintomas do original'),
  h05: regra(45, 'Grave: ramo A. Moderadamente grave: ramo B. Sem grave nem moderado e aguda: ramo C. Crônica ou desconhecida: ramo D.', 'H05: Escolha do app, a partir de 7.1 a 7.4'),
  a1: regra(51, 'Sintoma grave, agudo ou crônico, na 1ª hora: salina hipertônica a 3%, 150 mL IV em 20 min, em ambiente com monitorização estreita.', 'A1: 7.1.1 (1D)'),
  a2: regra(52, '20 min depois do início: medir o sódio enquanto se repete 150 mL nos 20 min seguintes.', 'A2: 7.1.1 (2D)'),
  a3: regra(53, 'Repetir duas vezes (3 bólus no total) ou até o Na subir 5.', 'A3: 7.1.1 (2D); o gatilho de 5 ou mais é do app'),
  a4: regra(54, 'Melhorou depois de subir 5: parar a hipertônica; manter o acesso com o menor volume possível de SF 0,9% até tratar a causa; tratamento específico da causa, ao menos para estabilizar.', 'A4: 7.1.2 (1D, 1D, 1D)'),
  a5: regra(55, 'Limitar a alta total a 10 em 24 h e a mais 8 a cada 24 h seguintes, até o Na chegar a 130.', 'A5: 7.1.2 (1D)'),
  a6: regra(56, 'Depois da melhora: sódio com 6 h e 12 h, depois diário até estabilizar.', 'A6: 7.1.2 (2D); contar a partir de T0 é do app'),
  a7: regra(57, 'Não melhorou depois de subir 5: continuar a salina a 3% buscando mais 1 mmol/L por hora. A taxa de infusão não foi transcrita.', 'A7: 7.1.3 (1D)'),
  a8: regra(58, 'Parar a hipertônica quando ocorrer o que vier primeiro: sintomas melhoraram; alta total chegou a 10; Na chegou a 130.', 'A8: 7.1.3 (1D)'),
  a9: regra(59, 'Investigar outras causas dos sintomas.', 'A9: 7.1.3 (1D)'),
  a10: regra(60, 'Com a infusão correndo: sódio a cada 4 h.', 'A10: 7.1.3 (2D)'),
  a11: regra(61, 'Considerar 2 mL/kg em vez de 150 mL quando a composição corporal for muito diferente da habitual. Não esperar recuperação imediata dos sintomas.', 'A11: Conselhos de 7.1'),
  b1: regra(67, 'Investigar; parar fatores que causam ou agravam; tratar a causa.', 'B1: 7.2 (1D)'),
  b2: regra(68, 'Sugere-se uma única infusão de 150 mL de salina a 3% em 20 min.', 'B2: 7.2 (2D)'),
  b3: regra(69, 'Meta: alta de 5 em 24 h.', 'B3: 7.2 (2D); o gatilho do aviso é do app'),
  b4: regra(70, 'Limitar a alta a 10 em 24 h e a 8 a cada 24 h seguintes, até o Na chegar a 130.', 'B4: 7.2 (2D)'),
  b5: regra(71, 'Sódio com 1 h, 6 h e 12 h, contadas a partir de T0.', 'B5: 7.2 (2D); contar a partir de T0 é do app'),
  b6: regra(72, 'Sem melhora: investigar outras causas.', 'B6: 7.2'),
  c1: regra(78, 'Repetir o sódio pela mesma técnica de dosagem; parar fatores; investigar; tratar a causa.', 'C1: 7.3'),
  c2: regra(79, 'Queda aguda do sódio maior que 10 (Na documentado nas últimas 48 h menos Na atual): sugere-se uma única infusão de 150 mL de salina a 3% em 20 min.', 'C2: 7.3 (2D); a conta da queda é do app'),
  c3: regra(80, 'Repetir o sódio em 4 h, pela mesma técnica.', 'C3: 7.3 (2D)'),
  d1: regra(86, 'Parar o que não for essencial; tratar a causa.', 'D1: 7.4 (1D)'),
  d2: regra(87, 'Hiponatremia leve: sugere-se não tratar apenas para subir o sódio.', 'D2: 7.4 (2C)'),
  d3: regra(88, 'Moderada ou profunda: evitar alta acima de 10 em 24 h e acima de 8 a cada 24 h seguintes.', 'D3: 7.4 (1D)'),
  d4: regra(89, 'Sódio a cada 6 h até estabilizar; o médico marca.', 'D4: 7.4 (2D)'),
  d5: regra(90, 'Não resolve: rever o algoritmo e pedir opinião especializada.', 'D5: 7.4'),
  g1: regra(96, 'Δ desde o início >10 nas primeiras 24 h, ou Δ em 24 h >8 depois: intervir prontamente para reabaixar o sódio e parar o tratamento ativo. Consultar especialista sobre 10 mL/kg de água livre em 1 h e desmopressina 2 mcg IV.', 'G1: 7.5 (1D em cada item)'),
  g2: regra(97, 'Diurese sobe de repente para mais de 100 mL/h: risco de correção rápida; sódio e diurese a cada 2 h até estabilizar.', 'G2: Rev. (Clin Exp Nephrol 2025)'),
  g3: regra(98, 'Na ≤105, uso abusivo de álcool, hipocalemia, desnutrição ou hepatopatia avançada: destacar e mostrar o aviso de divergência, sem trocar o teto.', 'G3: Rev. (CJASN 2024; Clin Exp Nephrol 2025)'),
  g4: regra(99, 'Reposição de K também eleva o sódio.', 'G4: Rev. (Clin Exp Nephrol 2025)'),
  g5: regra(100, 'Sintoma neurológico novo depois de melhora: pensar em desmielinização osmótica; reavaliar a curva.', 'G5: Rev. (Clin Exp Nephrol 2025)'),
  g6: regra(101, 'O exame tem imprecisão e um aumento de 8 pode ser de 10; não mirar o limite.', 'G6: Rev. (CJASN 2024)'),
  rConcentracao: regra(141, 'O app mostra salina a 3%, como na fonte, pede que o médico confirme a concentração usada e não converte volumes nem concentrações.', 'Seção 2: concentração da salina'),
  rNaoHipotonica: regra(149, 'Hiponatremia não hipotônica: fora do escopo.', 'Seção 3: triagem'),
  rSemT0: regra(150, 'Sódio ≥135 ou sem sódio de partida: sem T0 não há delta.', 'Seção 3: triagem'),
  rComorbidade: regra(156, 'Cirrose, insuficiência cardíaca, diálise, insuficiência adrenal em corticoide: a sessão continua, com aviso de que o risco de autocorreção e de desmielinização muda; sem regra própria.', 'Seção 3: triagem'),
  rSemTaxa: regra(160, 'Taxa e volume da infusão contínua de salina a 3%: o original transcrito dá só a meta e os critérios de parada. O app não calcula taxa.', 'Seção 4: sem regra numérica'),
  rJanela: regra(162, 'O app usa janela móvel de 24 h, com os sódios realmente medidos.', 'Seção 4: sem regra numérica'),
  r130: regra(164, 'Os limites de A5 e B4 contam até Na 130; o alerta de 7.5 segue literal, mesmo depois de 130.', 'Seção 4: sem regra numérica'),
  rSemIntervalo: regra(167, 'Intervalo do sódio no ramo B depois de 12 h e no ramo C depois do controle de 4 h: sem regra na transcrição.', 'Seção 4: sem regra numérica'),
  rMargem: regra(168, 'Sem margem de alerta: o app mostra quanto falta para o limite e alerta só ao ultrapassar.', 'Seção 4: sem regra numérica'),
  rDivergencia: regra(185, 'Alto risco de desmielinização: a europeia não traz teto próprio na transcrição; a americana, por revisão, traz 8 em 24 h. A europeia manda.', 'Seção 5: divergências'),
};

/* Ramo: 'a' | 'b' | 'c' | 'd' (rawValue do enum Ramo do Swift). */
export const RAMO = { a: 'a', b: 'b', c: 'c', d: 'd' };
export function tituloRamo(r) {
  return r === 'a' ? 'Ramo A: sintoma grave'
    : r === 'b' ? 'Ramo B: sintoma moderadamente grave'
      : r === 'c' ? 'Ramo C: aguda, sem sintoma grave nem moderado'
        : 'Ramo D: crônica, sem sintoma grave nem moderado';
}
/* Grau: 'leve' | 'moderada' | 'profunda' | 'semFaixa'. */
export const GRAU = { leve: 'leve', moderada: 'moderada', profunda: 'profunda', semFaixa: 'semFaixa' };

/* H02, sobre o sódio atual. */
export function grau(na) {
  if (na < 125) return 'profunda';
  if (na < 130) return 'moderada';
  if (na < 135) return 'leve';
  return 'semFaixa';
}

const ordenado = (e, id) => [...(e.series[id] ?? [])].sort((a, b) => a.hora - b.hora);

/* T0: o sódio de partida. É o último medido até a confirmação, para que corrigir um valor digitado errado antes de confirmar não crie delta falso. */
export function t0(e) {
  const s = ordenado(e, 'sodio');
  const conf = ultimaAcao(e, 'hipona.confirmada');
  if (conf === null) return s.length ? s[s.length - 1] : null;
  for (let i = s.length - 1; i >= 0; i--) if (s[i].hora <= conf.hora) return s[i];
  return s.length ? s[0] : null;
}

function contaDelta(t0, atual, referencia, desdeInicio, em24h, primeiras24h, limite) {
  return { t0, atual, referencia, desdeInicio, em24h, primeiras24h, limite, falta: limite - em24h, passou: em24h > limite };
}
/* Δ em 24 h: atual menos o último sódio medido até 24 h antes da coleta atual; nunca interpola. Nas primeiras 24 h é o Δ desde o início. */
export function conta(e) {
  const t = t0(e), u = ultimo(e, 'sodio');
  if (t === null || u === null) return null;
  const d = u.valor - t.valor;
  if (desde(u.hora, t.hora) <= 86400) return contaDelta(t, u, t, d, d, true, 10);
  const corte = mais(u.hora, -86400);
  let ref = null;
  for (const m of e.series.sodio ?? []) if (m.hora >= t.hora && m.hora <= corte && (ref === null || ref.hora < m.hora)) ref = m;
  ref = ref ?? t;
  return contaDelta(t, u, ref, d, u.valor - ref.valor, false, 8);
}

/* H05, com o ramo mantido depois de bólus daquele ramo: é a resposta da diretriz para "melhorou" (A4, A5, A6, B4, B5) que precisa seguir valendo. */
export function ramo(e) {
  if (resposta(e, 'sintomaGrave') === true || teveAcao(e, 'hipertonica.bolusA')) return 'a';
  if (resposta(e, 'sintomaGrave') === null) return null;
  if (resposta(e, 'sintomaModerado') === true || teveAcao(e, 'hipertonica.bolusB')) return 'b';
  if (resposta(e, 'sintomaModerado') === null) return null;
  switch (e.escolhas.duracao) {
    case 'aguda': return 'c';
    case 'cronica': case 'desconhecida': return 'd';
    default: return null;
  }
}

/* Queda aguda do ramo C: Na documentado nas últimas 48 h menos Na atual. */
export function quedaAguda(e) {
  const v = ultimo(e, 'sodioPrevio'), h = ultimo(e, 'sodioPrevioHoras'), u = ultimo(e, 'sodio');
  if (v === null || h === null || v.hora !== h.hora || u === null) return null;
  const documentado = mais(v.hora, -h.valor * 3600);
  const idade = desde(u.hora, documentado);
  if (!(idade >= 0 && idade <= 48 * 3600)) return null;
  return v.valor - u.valor;
}

/* FaseA: { caso: 'rapida' | 'parar' (motivo) | 'melhorou' | 'continuar' | 'perguntaMelhora' | 'semRegraMelhoraCedo'
   | 'semRegraNa130' | 'naAltoSemBolus' | 'emCurso' | 'aplicar' (n) | 'tresSemMeta' }. */
const fase = (caso, extra = {}) => ({ caso, ...extra });
/* Máquina do ramo A: A1 a A3, A4, A7 e os três critérios de parada de A8. */
export function faseA(e, c, agora) {
  const bolus = e.acoes.filter((a) => a.tipo === 'hipertonica.bolusA');
  const n = bolus.length;
  const ult = n ? Math.max(...bolus.map((a) => a.hora)) : null;
  const melhora = resposta(e, 'sintomasMelhoraram');
  const na = c.atual.valor;
  if (c.passou) return fase('rapida');
  if (c.desdeInicio >= 5) {
    if (melhora === true) return fase('melhorou');
    if (c.desdeInicio >= 10) return fase('parar', { motivo: 'a alta total chegou a 10' });
    if (na >= 130) return fase('parar', { motivo: 'o Na chegou a 130' });
    if (melhora === null) return fase('perguntaMelhora');
    return fase('continuar');
  }
  if (melhora === true) return fase('semRegraMelhoraCedo');
  if (na >= 130 && (c.t0.valor < 130 || n > 0)) return fase('semRegraNa130');
  if (c.t0.valor >= 130 && n === 0) return fase('naAltoSemBolus');
  if (n > 0 && resposta(e, 'sintomaGrave') !== true && melhora === null) return fase('perguntaMelhora');
  if (ult !== null && agora < mais(ult, 1200)) return fase('emCurso');
  if (n >= 3) return fase('tresSemMeta');
  return fase('aplicar', { n });
}
export function infusaoCorrendo(e) { return ultimaAcao(e, 'hipertonica.infusao', 'hipertonica.parada')?.tipo === 'hipertonica.infusao'; }

/* G2: número e marca do médico. A marca sem número também avisa: dado faltando nunca vira normal. */
export function g2Ativo(e) {
  if (resposta(e, 'aumentoDiurese') !== true) return false;
  const v = valor(e, 'diurese');
  return v !== null ? v > 100 : true;
}

const acao = (tipo, rotulo, v = {}) => acaoProposta(tipo, rotulo, v);
const base = (id, titulo, situacao, v) => cartao(id, titulo, 'drop.fill', 0x1F5FD1, situacao, v);

const DEF = {
  id: 'hipona',
  nome: 'Hiponatremia',
  descricao: 'Ramo, limites de alta e correção rápida',
  idConduta: 'hipona',
  referencia: 'Spasovski G, Vanholder R, Allolio B et al. Clinical practice guideline on diagnosis and treatment of hyponatraemia. Eur J Endocrinol 2014;170:G1-G47 (doi:10.1530/EJE-13-1020). Rev. = só revisão aberta.',
  escopo: 'Adulto com hiponatremia hipotônica confirmada pelo médico. A sessão não escolhe nem trata a causa.',
  tituloRamos: 'Critérios e duração',
  nomeFonte: 'diretriz',
  graficoFixo: 'sodio',
  parametros: [
    defParametro('sodio', 'Sódio', 'mmol/L', 90, 170),
    defParametro('peso', 'Peso', 'kg', 30, 250),
    defParametro('sodioPrevio', 'Sódio documentado antes', 'mmol/L', 90, 170),
    defParametro('sodioPrevioHoras', 'Há quantas horas', 'h', 0, 48),
    defParametro('diurese', 'Diurese', 'mL/h', 0, 2000, 0),
    defParametro('potassio', 'Potássio', 'mmol/L', 1.5, 7.5),
    defParametro('taxa3', 'Infusão de 3% informada', 'mL/h', 0, 200, 0),
  ],
  parametrosIniciais: ['sodio', 'peso', 'sodioPrevio', 'sodioPrevioHoras', 'diurese'],
  parametrosResultados: ['sodio', 'diurese', 'potassio', 'taxa3', 'sodioPrevio', 'sodioPrevioHoras'],
  triagem: [
    pergunta('menor18', 'Menor de 18 anos'),
    pergunta('gestante', 'Gestante ou puérpera'),
    pergunta('exercicio', 'Associada a exercício'),
    pergunta('tolvaptana', 'Uso recente de tolvaptana'),
    pergunta('perdaSal', 'Neurocirurgia ou hemorragia subaracnóidea, com suspeita de perda cerebral de sal'),
    pergunta('aguaLivre', 'Excesso de água livre, psiquiátrico ou de esforço, com autocorreção esperada'),
  ],
  perguntasIniciais: [
    pergunta('hipotonica', 'A hipotonicidade está confirmada?', 'Sem número pela fonte transcrita: o médico responde.'),
    pergunta('sintomaGrave', textoGrave),
    pergunta('sintomaModerado', textoModerado),
    pergunta('fatorRisco', 'Uso abusivo de álcool, hipocalemia, desnutrição ou hepatopatia avançada?'),
    pergunta('comorbidade', 'Cirrose, insuficiência cardíaca, diálise ou insuficiência adrenal em corticoide?'),
    pergunta('composicaoDiferente', 'Composição corporal muito diferente da habitual?', 'Sem critério na fonte: o médico marca.'),
  ],
  perguntasAcompanhamento: [
    pergunta('sintomaGrave', textoGrave),
    pergunta('sintomaModerado', textoModerado),
    pergunta('sintomasMelhoraram', 'Os sintomas melhoraram?'),
    pergunta('estabilizou', 'O sódio estabilizou?'),
    pergunta('aumentoDiurese', 'A diurese subiu de repente?'),
    pergunta('repondoK', 'Está repondo potássio?'),
    pergunta('neuroNovo', 'Sintoma neurológico novo depois de melhora: disartria, disfagia, fraqueza ou desorientação?'),
  ],
  ramos: [
    defRamo('duracao', 'Duração', [
      opcaoRamo('aguda', 'Menos de 48 h', 'Aguda'),
      opcaoRamo('cronica', '48 h ou mais', 'Crônica'),
      opcaoRamo('desconhecida', 'Desconhecida', 'Sem certeza: tratar como crônica'),
    ]),
  ],
  exames: [
    defExame('sodio', 'Sódio', 'Hora de repetir o sódio', true),
    defExame('diurese', 'Diurese', 'Hora de medir a diurese', true),
  ],
  graficos: [
    defGrafico('sodio', 'Sódio', ['sodio'], { sodio: [linhaGrafico(130, '130')] }),
    defGrafico('diurese', 'Diurese', ['diurese'], { diurese: [linhaGrafico(100, '100')] }),
  ],
  avaliar(e, agora) { return avaliar(motorHipona, e, agora); },
};

function avaliar(p, e, agora) {
  const o = orientacoes();

  /* Triagem: qualquer item marcado encerra os passos automáticos. */
  const marcados = p.triagem.filter((q) => resposta(e, q.chave) === true).map((q) => q.texto);
  if (marcados.length) { o.foraDeEscopo = marcados; return o; }
  o.triagemCompleta = p.triagem.every((q) => resposta(e, q.chave) !== null);
  if (!o.triagemCompleta) return o;

  const t = t0(e);
  const hip = resposta(e, 'hipotonica');
  const c1 = t !== null ? (t.valor < 135 ? 'sim' : 'nao') : 'falta';
  const c2 = hip !== null ? (hip ? 'sim' : 'nao') : 'falta';
  const cumprido = c1 === 'sim' && c2 === 'sim';
  o.confirmacao = painelCriterios('Critérios de entrada', [
    criterio('na', 'Sódio <135 mmol/L', c1, t !== null ? num(t.valor, 1) + ' mmol/L' : null),
    criterio('hipo', 'Hipotonicidade confirmada pelo médico', c2, hip !== null ? (hip ? 'Sim' : 'Não') : null),
  ], cumprido, R.h01, cumprido ? acaoProposta('hipona.confirmada', 'Confirmo a hiponatremia hipotônica') : null);

  if (hip === false) {
    o.foraDeEscopo = ['Hiponatremia não hipotônica'];
    o.classificacao = 'Não hipotônica: fora do escopo';
    o.classificacaoRegra = R.rNaoHipotonica;
    return o;
  }
  if (t !== null && t.valor >= 135) {
    o.foraDeEscopo = ['Sódio ≥135 mmol/L'];
    o.classificacao = 'Sódio ≥135: fora do escopo';
    o.classificacaoRegra = R.rSemT0;
    return o;
  }
  const d = conta(e);
  if (d === null) {
    o.classificacao = 'Sem sódio de partida: sem T0 não há delta';
    o.classificacaoRegra = R.rSemT0;
    return o;
  }

  const rm = ramo(e);
  const gr = grau(d.atual.valor);
  o.classificacao = rm !== null ? tituloRamo(rm) : 'Ramo: falta responder';
  o.classificacaoRegra = R.h05;
  if (gr === 'semFaixa') o.classificacaoDetalhe = `Na ${num(d.atual.valor, 1)}: fora das faixas de gravidade.`;
  else o.classificacaoDetalhe = `Na ${num(d.atual.valor, 1)}: ${gr}.`;

  if (!teveAcao(e, 'hipona.confirmada')) return o;

  const estabilizou = resposta(e, 'estabilizou') === true;
  const g2 = g2Ativo(e) && !estabilizou;
  const fs = rm === 'a' ? faseA(e, d, agora) : null;
  o.exames = examesDevidos(p, e, d, rm, fs, g2, estabilizou, agora);

  /* Alertas. */
  if (d.passou) {
    const janela = d.primeiras24h ? 'nas primeiras 24 h' : 'em 24 h';
    o.alertas.push(alerta('rapida', 'vermelho', `Correção rápida demais: alta de ${num(d.em24h, 1)} mmol/L ${janela}, limite ${num(d.limite, 0)}. Intervir prontamente para reabaixar o sódio e parar o tratamento ativo. Consultar especialista.`, R.g1));
  }
  if ((rm === 'a' || rm === 'b') && d.desdeInicio >= 5) {
    o.alertas.push(alerta('meta5', 'amarelo', `Meta de 5 atingida: alta de ${num(d.desdeInicio, 1)} mmol/L desde o início.`, rm === 'a' ? R.a3 : R.b3));
  }
  const vs = (e.series.sodio ?? []).map((m) => m.valor);
  const naMin = vs.length ? Math.min(...vs) : d.atual.valor;
  const riscoNa = naMin <= 105, riscoResp = resposta(e, 'fatorRisco') === true;
  if (riscoNa || riscoResp) {
    const qual = riscoNa ? 'Na ≤105' : 'Fator de risco marcado';
    o.alertas.push(alerta('risco', 'amarelo', `${qual}: risco de desmielinização. A diretriz europeia mantém 10 e 8; a americana, por revisão, traz 8 em 24 h. Divergência: o limite daqui não muda.`, R.rDivergencia));
  }
  if (resposta(e, 'comorbidade') === true) {
    o.alertas.push(alerta('comorbidade', 'amarelo', 'O risco de autocorreção e de desmielinização muda nesta condição. Sem regra própria.', R.rComorbidade));
  }
  if (g2) {
    const dv = valor(e, 'diurese');
    o.alertas.push(alerta('diureseSubita', 'vermelho', 'Diurese subiu de repente' + (dv !== null ? ` para ${num(dv, 0)} mL/h` : ', falta o valor') + ': risco de correção rápida. Medir sódio e diurese a cada 2 h até estabilizar.', R.g2));
  }
  if (resposta(e, 'repondoK') === true) {
    o.alertas.push(alerta('repondoK', 'amarelo', 'Reposição de potássio também eleva o sódio.', R.g4));
  }
  if (resposta(e, 'neuroNovo') === true) {
    o.alertas.push(alerta('neuroNovo', 'vermelho', 'Sintoma neurológico novo depois de melhora: pensar em desmielinização osmótica. Reavaliar a curva. Sem conduta na fonte.', R.g5));
  }

  /* Cartões. */
  if (d.passou) o.cartoes.push(cartaoRapida(e, d));
  switch (rm) {
    case 'a': o.cartoes.push(cartaoRamoA(e, d, fs ?? fase('emCurso'), agora)); break;
    case 'b':
      o.cartoes.push(cartaoRamoB(e, d));
      o.cartoes.push(cartaoCausa(e, 'b', 'Investigar e tratar a causa', 'Parar fatores que causam ou agravam.' + (resposta(e, 'sintomasMelhoraram') === false ? ' Sem melhora: investigar outras causas.' : ''), R.b1));
      break;
    case 'c':
      o.cartoes.push(cartaoRamoC(e, d));
      o.cartoes.push(cartaoCausa(e, 'c', 'Repetir o sódio e investigar', 'Repetir pela mesma técnica de dosagem. Parar fatores, investigar e tratar a causa.', R.c1));
      break;
    case 'd':
      o.cartoes.push(cartaoRamoD(d, gr));
      o.cartoes.push(cartaoCausa(e, 'd', 'Parar o não essencial', 'Tratar a causa. Se não resolver: rever o algoritmo e pedir opinião especializada.', R.d1));
      break;
    default:
      o.cartoes.push(cartaoRamoFaltando(e));
  }
  o.cartoes.push(cartaoSodio(d, rm));
  const cd = cartaoDiurese(e, g2);
  if (cd !== null) o.cartoes.push(cd);
  return o;
}

function cartaoRapida(e, d) {
  const c = cartao('rapida', 'Correção rápida demais', 'exclamationmark.octagon.fill', 0xB91C1C, 'proximoPasso', 'Reabaixar o sódio');
  c.conta = `Alta de ${num(d.em24h, 1)} mmol/L; limite ${num(d.limite, 0)}`;
  c.detalhe = 'Parar o tratamento ativo. Consultar especialista: infusão de 10 mL/kg de água livre (por exemplo solução glicosada) em 1 h, com controle estrito de diurese e balanço hídrico; e desmopressina 2 mcg IV, sem repetir em menos de 8 h.';
  c.regras = [R.g1];
  if (!teveAcao(e, 'g1.parado')) c.acoes.push(acao('g1.parado', 'Registrar tratamento ativo parado'));
  if (!teveAcao(e, 'g1.especialista')) c.acoes.push(acaoProposta('g1.especialista', 'Registrar especialista consultado', {}, true));
  return c;
}

/* O bólus de 150 mL, ou 2 mL/kg se o médico marcou a composição corporal; a concentração é confirmada e nunca convertida. */
function oferecerBolus(c0, e, tipo, ordem, detalhe) {
  const c = copia(c0);
  c.valor = '150 mL em 20 min';
  c.conta = 'Salina hipertônica a 3%, como na fonte';
  c.detalhe = detalhe;
  const conc = resposta(e, 'concentracao3');
  if (conc === null) {
    c.situacao = 'pergunta';
    c.liberado = true;
    c.pergunta = perguntaCartao('concentracao3', 'A salina usada é a de 3%?');
    return c;
  }
  if (!conc) {
    c.situacao = 'decisaoMedico';
    c.valor = 'Concentração diferente';
    c.conta = 'A fonte traz salina a 3%';
    c.detalhe = 'O app não converte volumes nem concentrações. Decisão do médico.';
    c.regras = [R.rConcentracao, ...c.regras];
    c.pergunta = perguntaCartao('concentracao3', 'A salina usada é a de 3%?');
    c.acoes = [acaoProposta(tipo, 'Registrar bólus feito em outra concentração', {}, true)];
    return c;
  }
  c.situacao = 'proximoPasso';
  c.liberado = true;
  c.doses = { mL: 150, pct: 3 };
  c.acoes = [acao(tipo, `Confirmar ${ordem}: 150 mL de salina a 3%`, { mL: 150, pct: 3 })];
  if (resposta(e, 'composicaoDiferente') === true) {
    const p = valor(e, 'peso');
    if (p !== null) {
      c.detalhe = (c.detalhe !== null ? c.detalhe + ' ' : '') + `Composição corporal muito diferente: considerar 2 mL/kg, ${num(2 * p, 0)} mL para ${num(p, 1)} kg.`;
      c.doses.mLPorPeso = 2 * p;
      c.acoes.push(acaoProposta(tipo, `Confirmar ${ordem}: 2 mL/kg, ${num(2 * p, 0)} mL de salina a 3%`, { mL: 2 * p, pct: 3 }, true));
    } else {
      c.detalhe = (c.detalhe !== null ? c.detalhe + ' ' : '') + 'Composição corporal muito diferente: considerar 2 mL/kg. Falta o peso para a conta.';
    }
  }
  return c;
}

function cartaoRamoA(e, d, fs, agora) {
  let c = cartao('hipertonica', 'Salina hipertônica', 'syringe.fill', 0xB4471A, 'decisaoMedico', 'Decisão do médico');
  c.regras = [R.a1, R.a2, R.a3, R.a11];
  const bolus = e.acoes.filter((a) => a.tipo === 'hipertonica.bolusA');
  const n = bolus.length;
  const correndo = infusaoCorrendo(e);
  const parada = ultimaAcao(e, 'hipertonica.infusao', 'hipertonica.parada')?.tipo === 'hipertonica.parada';
  const posMelhora = 'Manter o acesso com o menor volume possível de SF 0,9% até tratar a causa. Tratamento específico da causa, ao menos para estabilizar.';
  const houve = n > 0 || teveAcao(e, 'hipertonica.infusao');
  const parar = (motivo, regras, extra) => {
    c.regras = regras;
    if (!houve) {
      c.situacao = 'semIndicacao';
      c.valor = 'Sem hipertônica';
      c.conta = motivo;
      c.detalhe = extra;
      return;
    }
    c.valor = parada ? 'Hipertônica parada' : 'Parar a hipertônica';
    c.conta = motivo;
    c.detalhe = extra;
    c.situacao = parada ? 'semIndicacao' : 'proximoPasso';
    if (!parada) c.acoes = [acao('hipertonica.parada', 'Confirmar parada da hipertônica')];
  };
  switch (fs.caso) {
    case 'rapida': break;
    case 'parar': {
      const m = fs.motivo.slice(0, 1).toUpperCase() + fs.motivo.slice(1);
      parar(m + '.', [R.a8, R.a9, R.a10], 'Investigar outras causas dos sintomas.');
      break;
    }
    case 'melhorou':
      parar('Sintomas melhoraram depois de subir 5.', [R.a4, R.a5, R.a6, R.a11], posMelhora + ' Não esperar recuperação imediata dos sintomas.');
      break;
    case 'continuar':
      c.regras = [R.a7, R.a8, R.a9, R.a10, R.rSemTaxa];
      c.liberado = true;
      c.valor = 'Buscar mais 1 mmol/L por hora';
      c.conta = 'Salina a 3%. A fonte transcrita não traz a taxa';
      c.detalhe = 'Parar quando ocorrer o que vier primeiro: sintomas melhoraram, alta total chegou a 10, Na chegou a 130. Investigar outras causas dos sintomas.';
      c.doses = { mmolLH: 1 };
      if (correndo) c.situacao = 'correndo';
      else {
        c.situacao = 'proximoPasso';
        c.acoes = [acao('hipertonica.infusao', 'Confirmar infusão contínua de 3%')];
      }
      break;
    case 'perguntaMelhora':
      c.situacao = 'pergunta';
      c.valor = d.desdeInicio >= 5 ? 'Meta de 5 atingida' : 'Sintomas melhoraram?';
      c.conta = `Alta de ${num(d.desdeInicio, 1)} mmol/L desde o início`;
      c.detalhe = 'A resposta decide entre parar e continuar. Não esperar recuperação imediata dos sintomas.';
      c.regras = [R.a3, R.a4, R.a7, R.a11];
      c.pergunta = perguntaCartao('sintomasMelhoraram', 'Os sintomas melhoraram?');
      break;
    case 'semRegraMelhoraCedo':
      c.valor = 'Melhorou antes de subir 5';
      c.conta = `Alta de ${num(d.desdeInicio, 1)} mmol/L; ${n} de 3 bólus`;
      c.detalhe = 'A regra de parar é para quem melhorou depois de subir 5. Sem regra para este caso: decisão do médico.';
      c.regras = [R.a4, R.a3];
      break;
    case 'semRegraNa130':
      c.valor = 'Na chegou a 130';
      c.conta = `Alta de ${num(d.desdeInicio, 1)} mmol/L, abaixo de 5; ${n} de 3 bólus`;
      c.detalhe = 'O Na chegou a 130 antes de subir 5, ainda sem melhora. Sem regra para este caso: decisão do médico.';
      c.regras = [R.a8, R.a3];
      break;
    case 'naAltoSemBolus':
      c.valor = 'Na já em 130 ou mais';
      c.conta = `Na ${num(d.atual.valor, 1)} mmol/L com sintoma grave`;
      c.detalhe = 'A1 indica 150 mL de salina a 3% sem citar o valor do sódio; A8 cita Na 130 como critério de parada. Decisão do médico.';
      c.regras = [R.a1, R.a8];
      c.acoes = [acaoProposta('hipertonica.bolusA', 'Registrar bólus feito por decisão do médico', {}, true)];
      break;
    case 'emCurso': {
      const ult = n ? Math.max(...bolus.map((a) => a.hora)) : agora;
      c.situacao = 'correndo';
      c.valor = `Bólus ${n} de 3 em curso`;
      c.conta = `Medir o sódio aos 20 min: ${hora(mais(ult, 1200))}`;
      c.detalhe = n < 3 ? 'Repetir 150 mL nos 20 min seguintes, enquanto se mede o sódio.' : 'Depois deste não há outro bólus pela regra.';
      c.regras = [R.a2, R.a3];
      break;
    }
    case 'aplicar': {
      const feitos = fs.n;
      const nota = 'Em ambiente com monitorização estreita.' + (feitos > 0 ? ' Repetir duas vezes ou até o Na subir 5.' : '');
      c = oferecerBolus(c, e, 'hipertonica.bolusA', `bólus ${feitos + 1} de 3`, nota);
      break;
    }
    case 'tresSemMeta':
      c.valor = '3 bólus sem subir 5';
      c.conta = `Alta de ${num(d.desdeInicio, 1)} mmol/L`;
      c.detalhe = 'A regra para em 3 bólus, e A7 só fala de quem já subiu 5. Sem regra para este caso: decisão do médico.';
      c.regras = [R.a3, R.a7];
      break;
  }
  /* Correção rápida: nenhuma sugestão de hipertônica; se a infusão correr, parar. */
  if (fs.caso === 'rapida') parar('Correção rápida demais.', [R.g1, R.a8], null);
  return c;
}

function cartaoRamoB(e, d) {
  const c = cartao('hipertonica', 'Salina hipertônica', 'syringe.fill', 0xB4471A, 'semIndicacao', 'Sem novo bólus');
  c.regras = [R.b2, R.b3, R.a11];
  const feito = ultimaAcao(e, 'hipertonica.bolusB');
  if (feito !== null) {
    c.conta = 'Bólus único às ' + hora(feito.hora);
    c.detalhe = resposta(e, 'sintomasMelhoraram') === false ? 'Sem melhora: investigar outras causas.' : null;
    if (resposta(e, 'sintomasMelhoraram') === false) c.regras = [R.b6, R.b2];
    return c;
  }
  if (d.passou) { c.conta = 'Correção rápida demais'; c.regras = [R.g1]; return c; }
  if (d.desdeInicio >= 5) { c.conta = 'Meta de 5 atingida sem bólus'; c.regras = [R.b3]; return c; }
  if (resposta(e, 'sintomasMelhoraram') === true) {
    c.situacao = 'decisaoMedico';
    c.valor = 'Sintomas melhoraram';
    c.detalhe = 'O bólus é sugerido na entrada do ramo. Sem regra para melhora antes dele: decisão do médico.';
    return c;
  }
  if (d.atual.valor >= 130 && d.t0.valor < 130) {
    c.situacao = 'decisaoMedico';
    c.valor = 'Na chegou a 130';
    c.detalhe = 'Sem bólus: bloqueio local aprovado pelo médico, não é da diretriz. Decisão do médico.';
    return c;
  }
  return oferecerBolus(c, e, 'hipertonica.bolusB', 'bólus único', 'Sugere-se uma única infusão. Meta: alta de 5 em 24 h.');
}

function cartaoRamoC(e, d) {
  const c = cartao('hipertonica', 'Salina hipertônica', 'syringe.fill', 0xB4471A, 'semIndicacao', 'Sem bólus');
  c.regras = [R.c2];
  const feito = ultimaAcao(e, 'hipertonica.bolusC');
  if (feito !== null) {
    c.valor = 'Sem novo bólus';
    c.conta = 'Bólus único às ' + hora(feito.hora);
    return c;
  }
  if (d.passou) { c.conta = 'Correção rápida demais'; c.regras = [R.g1]; return c; }
  if (d.em24h >= d.limite) {
    c.situacao = 'decisaoMedico';
    c.valor = 'Alta no limite';
    c.conta = `Alta de ${num(d.em24h, 1)} mmol/L; limite ${num(d.limite, 0)}`;
    c.detalhe = 'Sem bólus enquanto a alta estiver no limite: bloqueio local aprovado pelo médico, não é da diretriz. Decisão do médico.';
    return c;
  }
  const q = quedaAguda(e);
  if (q === null) {
    c.situacao = 'faltaDado';
    c.valor = 'Falta Na anterior';
    c.detalhe = 'Informe em Novos resultados um sódio documentado nas últimas 48 h e há quantas horas.';
    return c;
  }
  if (!(q > 10)) {
    c.conta = `Queda de ${num(q, 1)} mmol/L. Entra com queda maior que 10`;
    return c;
  }
  c.conta = `Queda de ${num(q, 1)} mmol/L`;
  return oferecerBolus(c, e, 'hipertonica.bolusC', 'bólus único', `Queda de ${num(q, 1)} mmol/L, maior que 10. Sugere-se uma única infusão.`);
}

/* D nunca oferece hipertônica. */
function cartaoRamoD(d, gr) {
  const c = base('conduta', 'Sem hipertônica neste ramo', 'semIndicacao', 'Fora das faixas');
  c.conta = `Na ${num(d.atual.valor, 1)} mmol/L`;
  if (gr === 'leve') {
    c.situacao = 'proximoPasso';
    c.valor = 'Não tratar só para subir o sódio';
    c.detalhe = 'Hiponatremia leve: é o que a diretriz sugere.';
    c.regras = [R.d2];
  } else if (gr === 'moderada' || gr === 'profunda') {
    c.situacao = 'proximoPasso';
    c.valor = 'Evitar alta acima do limite';
    c.conta = '10 em 24 h e 8 a cada 24 h seguintes';
    c.detalhe = `Hiponatremia ${gr}, Na ${num(d.atual.valor, 1)} mmol/L.`;
    c.regras = [R.d3];
  } else {
    c.regras = [R.h02];
  }
  return c;
}

function cartaoCausa(e, id, v, detalhe, r) {
  const c = cartao('causa', 'Causa', 'magnifyingglass', 0x3451B2, 'proximoPasso', v);
  c.detalhe = detalhe;
  c.regras = [r];
  if (teveAcao(e, `causa.${id}`)) c.situacao = 'correndo';
  else c.acoes = [acao(`causa.${id}`, 'Registrar conduta sobre a causa')];
  return c;
}

function cartaoRamoFaltando(e) {
  const c = cartao('ramo', 'Ramo', 'arrow.triangle.branch', 0x3451B2, 'pergunta', 'Falta responder');
  c.regras = [R.h05, R.h04];
  if (resposta(e, 'sintomaGrave') === null) {
    c.pergunta = perguntaCartao('sintomaGrave', textoGrave);
  } else if (resposta(e, 'sintomaModerado') === null) {
    c.pergunta = perguntaCartao('sintomaModerado', textoModerado);
  } else {
    c.situacao = 'faltaDado';
    c.valor = 'Falta a duração';
    c.detalhe = 'Sem a duração não dá para escolher entre os ramos C e D.';
    c.regras = [R.h03];
  }
  return c;
}

/* A conta do delta, sempre à vista. */
function cartaoSodio(d, rm) {
  const c = cartao('delta', 'Alta de sódio', 'chart.line.uptrend.xyaxis', 0x0E7C94, 'correndo', '');
  const sinal = (v) => (v > 0 ? '+' : '') + num(v, 1);
  c.valor = sinal(d.desdeInicio) + ' mmol/L desde o início';
  c.doses = { desdeInicio: d.desdeInicio, em24h: d.em24h, limite: d.limite };
  c.regras = [R.a5, R.b4, R.rJanela, R.rMargem, R.g6];
  const contaAte130 = rm === 'a' || rm === 'b';
  const linhas = [];
  linhas.push(`Na de partida ${num(d.t0.valor, 1)} às ${hora(d.t0.hora)}; atual ${num(d.atual.valor, 1)} às ${hora(d.atual.hora)}.`);
  if (!d.primeiras24h) {
    const idade = desde(d.atual.hora, d.referencia.hora);
    linhas.push(`Em 24 h: ${sinal(d.em24h)} mmol/L, contra o Na ${num(d.referencia.valor, 1)} medido ${duracao(idade)} antes.`);
    if (idade > 86400) linhas.push('Sem sódio medido exatamente às 24 h: a conta não interpola. Se não houver sódio perto das 24 h, colha um.');
  }
  if (contaAte130 && d.atual.valor >= 130) {
    linhas.push('Na chegou a 130: a contagem do limite deste ramo termina aqui. O alerta de correção rápida continua valendo.');
    c.regras = [R.r130, R.a5, R.b4, R.g6];
  } else {
    c.doses.falta = d.falta;
    c.conta = `Limite de ${num(d.limite, 0)} ${d.primeiras24h ? 'nas primeiras 24 h' : 'em 24 h'}. ` + (d.falta >= 0 ? `Faltam ${num(d.falta, 1)}` : `Passou ${num(-d.falta, 1)}`);
  }
  linhas.push('O exame tem imprecisão e um aumento de 8 pode ser de 10: não mirar o limite.');
  c.detalhe = linhas.join(' ');
  return c;
}

function cartaoDiurese(e, g2) {
  const v = valor(e, 'diurese');
  if (v === null) return null;
  const c = cartao('diurese', 'Diurese', 'drop.circle.fill', 0x1F5FD1, 'pergunta', num(v, 0) + ' mL/h');
  c.regras = [R.g2];
  if (g2) {
    c.situacao = 'correndo';
    c.detalhe = 'Sódio e diurese a cada 2 h até estabilizar.';
    return c;
  }
  if (!(v > 100 && resposta(e, 'aumentoDiurese') === null)) return null;
  c.pergunta = perguntaCartao('aumentoDiurese', 'A diurese subiu de repente?');
  return c;
}

/* Timers: vale o mais curto entre os que se aplicam; sem marco, sem prazo. */
function examesDevidos(p, e, d, rm, fs, g2, estabilizou, agora) {
  const u = d.atual.hora;
  const opcoes = [];
  const marcos = (horas, r) => {
    for (const h of horas) {
      const m = mais(d.t0.hora, h * 3600);
      if (m > u) { opcoes.push([m, r]); return true; }
    }
    return false;
  };
  switch (rm) {
    case 'a': {
      const hs = e.acoes.filter((a) => a.tipo === 'hipertonica.bolusA').map((a) => a.hora);
      const bolus = hs.length ? Math.max(...hs) : null;
      if (bolus !== null && u < bolus && fs !== null && (fs.caso === 'emCurso' || fs.caso === 'aplicar')) {
        opcoes.push([mais(bolus, 1200), R.a2]);
      }
      if (infusaoCorrendo(e)) opcoes.push([mais(u, 4 * 3600), R.a10]);
      if (fs !== null && fs.caso === 'melhorou' && !marcos([6, 12], R.a6) && !estabilizou) opcoes.push([mais(u, 24 * 3600), R.a6]);
      break;
    }
    case 'b': marcos([1, 6, 12], R.b5); break;
    case 'c': marcos([4], R.c3); break;
    case 'd': if (!estabilizou) opcoes.push([mais(u, 6 * 3600), R.d4]); break;
    default: break;
  }
  if (g2) opcoes.push([mais(u, 2 * 3600), R.g2]);
  let vence = null;
  for (const x of opcoes) if (vence === null || x[0] < vence[0]) vence = x;
  const def = p.exames[0];
  let s;
  if (vence !== null) s = agora > vence[0] ? 'vencido' : 'noPrazo';
  else s = (estabilizou && (rm === 'a' || rm === 'd')) ? 'encerrado' : 'noPrazo';
  const regraSem = rm === 'b' || rm === 'c' ? R.rSemIntervalo : rm === 'a' ? R.a6 : rm === 'd' ? R.d4 : R.h05;
  const r = [exameDevido({ id: def.id, nome: def.nome, aviso: def.aviso, destaque: def.destaque, ultima: u, janelaInicio: null, proxima: vence !== null ? vence[0] : null, situacao: s, regra: vence !== null ? vence[1] : regraSem })];
  if (g2) {
    const dv = p.exames[1];
    const ud = ultimo(e, 'diurese')?.hora ?? null;
    const px = ud !== null ? mais(ud, 2 * 3600) : null;
    const sd = ud === null ? 'semDado' : (agora > (px ?? agora) ? 'vencido' : 'noPrazo');
    r.push(exameDevido({ id: dv.id, nome: dv.nome, aviso: dv.aviso, destaque: dv.destaque, ultima: ud, janelaInicio: null, proxima: px, situacao: sd, regra: R.g2 }));
  }
  return r;
}

/* Para o teste diferencial: as funções estáticas do Swift, em JSON simples. */
export const funcoesTeste = {
  t0: (e) => t0(e),
  conta: (e) => conta(e),
  ramo: (e) => ramo(e),
  grau: (na) => grau(na),
  quedaAguda: (e) => quedaAguda(e),
  faseA: (e, agora) => { const c = conta(e); return c === null ? null : faseA(e, c, agora); },
  g2Ativo: (e) => g2Ativo(e),
  infusaoCorrendo: (e) => infusaoCorrendo(e),
};

export const regrasHipona = R;
export const motorHipona = criarProtocolo(DEF);
export default motorHipona;
