/* Cetoacidose diabética. Porta fiel de MotorCAD.swift (app iOS). Especificação: docs/sessao_cad_regras.md do app
   (consenso de 2024; a Figura 4 só onde o texto não define). O número de cada regra é a linha do arquivo de regras.
   Não mudar regra aqui sem mudar no Swift: o teste diferencial reprova. */
import {
  criarProtocolo, defParametro, pergunta, defRamo, opcaoRamo, defExame, defGrafico, linhaGrafico, regra,
  orientacoes, cartao, alerta, trava, criterio, painelCriterios, acaoProposta, perguntaCartao, exameDevido,
  ultimo, primeiro, ultimosDois, valor, resposta, ultimaAcao, teveAcao, num, hora, duracao, desde, mais, copia,
} from './nucleo.js';

const R = {
  rCriterio: regra(15, 'Glicemia ≥200 ou diabetes prévio; β-OHB ≥3,0; pH <7,3 ou HCO₃ <18: confirma CAD.', 'Consenso, seção 3 e Tabela 2'),
  rLeve: regra(16, 'pH >7,25 a <7,30 ou HCO₃ 15-18: leve.', 'Tabela 2'),
  rModerada: regra(17, 'pH 7,0-7,25 ou HCO₃ 10 a <15: moderada.', 'Tabela 2'),
  rGrave: regra(18, 'pH <7,0, HCO₃ <10 ou β-OHB >6,0: grave, nível sugerido UTI.', 'Tabela 2'),
  rVolume: regra(19, 'Primeiras 2-4 h, sem comprometimento renal ou cardíaco: isotônico ou cristaloide balanceado, 500-1000 mL/h.', 'Texto, Fluid therapy'),
  rKTrava: regra(20, 'K <3,5: não iniciar insulina; repor K até >3,5.', 'Texto e Figura 4'),
  rKExato: regra(53, 'K exatamente 3,5: o texto exige >3,5 para insulina. Segura a insulina.', 'Regras, sem regra numérica'),
  rKAlto: regra(36, 'K >5,0: sem K; iniciar insulina; repetir K a cada 2 h.', 'Figura 4'),
  rInicio: regra(22, 'Início, com K permitindo: regular IV 0,1 U/kg/h; bólus 0,1 U/kg só se houver atraso na infusão.', 'Texto e Figura 4'),
  rMenos250: regra(23, 'Glicemia <250 mg/dL: reduzir para 0,05 U/kg/h e acrescentar dextrose 5-10%.', 'Texto, Tabela 3 e Figura 4'),
  rEugl: regra(24, 'Glicemia <200 com β-OHB positivo: dextrose desde o início da insulina.', 'Figura 4'),
  rBic: regra(25, 'pH <7,0: considerar 100 mmol em 400 mL de água estéril a cada 2 h até pH >7,0.', 'Texto'),
  rFosf: regra(26, 'Fraqueza muscular, comprometimento respiratório ou cardíaco, com fosfato <1,0 mmol/L: considerar reposição.', 'Texto e Figura 4'),
  rTransicao: regra(27, 'Depois da resolução e podendo comer: basal SC; manter insulina IV por 1-2 h depois da SC.', 'Texto, Figuras 4 e 5'),
  rDoseSC: regra(28, 'Sem insulina prévia: dose diária total 0,5-0,6 U/kg; fragilidade ou falência renal, cerca de 0,3 U/kg.', 'Texto'),
  rKcl: regra(34, 'KCl com K 3,5-5,0: 20-30 mmol por litro, alvo K 4-5.', 'Texto'),
  rKBaixo: regra(35, 'K <3,5: 10 mmol/h e adiar a insulina até K >3,5.', 'Texto'),
  rDiurese: regra(37, 'Diurese de cerca de 0,5 mL/kg/h antes de repor K.', 'Figura 4'),
  rRepetirK: regra(38, 'Repetir K 2 h após iniciar insulina, depois a cada 4 h.', 'Texto'),
  r4h: regra(39, 'Gasometria, β-OHB, eletrólitos, fosfato e creatinina a cada 4 h até a resolução.', 'Texto'),
  rGlicemia: regra(40, 'Glicemia a cada 1-2 h.', 'Texto'),
  rAlvo: regra(41, 'Alvo depois de <250: cerca de 200 mg/dL.', 'Texto'),
  rResolucao: regra(42, 'Resolução: β-OHB <0,6 e (pH ≥7,3 ou HCO₃ ≥18); idealmente glicemia <200.', 'Texto'),
  rBasal: regra(43, 'Basal SC 1-2 h antes de parar a insulina IV.', 'Texto'),
  rViaSC: regra(44, 'Via SC: leve ou moderada não complicada; não em grave nem complicada.', 'Texto'),
  rDosesSC: regra(45, '0,1 U/kg inicial; depois 0,1 U/kg a cada 1 h ou 0,2 U/kg a cada 2 h; com glicemia <250, 0,05 U/kg/h ou 0,1 U/kg a cada 2 h.', 'Figura 4'),
  rNaoCai: regra(51, 'Glicemia que não cai ou cai rápido demais: o consenso não traz regra numérica.', 'Regras, sem regra numérica'),
  rHipo: regra(52, 'Abaixo de 70 mg/dL: alerta em vermelho pedindo reavaliação imediata, sem dose automática.', 'Regras, sem regra numérica'),
  rKCaindo: regra(54, 'K abaixo de 3,5 com insulina correndo: alerta, reposição de 10 mmol/h e decisão do médico, sem mandar parar.', 'Regras, sem regra numérica'),
  rNeuro: regra(56, 'Rebaixamento neurológico: alerta para reavaliação imediata, com menção a edema cerebral.', 'Regras, sem regra numérica'),
};

/* Gravidade: 0 fora das faixas, 1 leve, 2 moderada, 3 grave (o rawValue do enum Grav do Swift). */
export const GRAV = { semFaixa: 0, leve: 1, moderada: 2, grave: 3 };

/* Tabela 2, linhas 16 a 18: basta um critério; a linha mais grave que casar vale. */
export function gravidade(ph, hco3, bohb) {
  if (ph === null && hco3 === null && bohb === null) return null;
  if (ph !== null && ph < 7.0) return GRAV.grave;
  if (hco3 !== null && hco3 < 10) return GRAV.grave;
  if (bohb !== null && bohb > 6.0) return GRAV.grave;
  if (ph !== null && ph >= 7.0 && ph <= 7.25) return GRAV.moderada;
  if (hco3 !== null && hco3 >= 10 && hco3 < 15) return GRAV.moderada;
  if (ph !== null && ph > 7.25 && ph < 7.30) return GRAV.leve;
  if (hco3 !== null && hco3 >= 15 && hco3 <= 18) return GRAV.leve;
  return GRAV.semFaixa;
}
export function nomeGravidade(g) {
  return g === GRAV.grave ? 'Grave' : g === GRAV.moderada ? 'Moderada' : g === GRAV.leve ? 'Leve' : 'Fora das faixas de gravidade';
}

const v0 = (m) => (m ? m.valor : null);
const juntar = (xs) => xs.filter((x) => x !== null).join(', ');

/* Critério de CAD com três valores: dado faltando nunca conta como cumprido nem como normal. */
export function criteriosCAD(e) {
  const g = v0(primeiro(e, 'glicemia')), b = v0(primeiro(e, 'bohb')), p = v0(primeiro(e, 'ph')), h = v0(primeiro(e, 'hco3'));
  const dm = resposta(e, 'diabetesPrevio');
  let c1;
  if (g !== null && g >= 200) c1 = 'sim'; else if (dm === true) c1 = 'sim'; else if (g !== null && dm === false) c1 = 'nao'; else c1 = 'falta';
  const c2 = b !== null ? (b >= 3.0 ? 'sim' : 'nao') : 'falta';
  let c3;
  if (p !== null && p < 7.3) c3 = 'sim'; else if (h !== null && h < 18) c3 = 'sim'; else if (p !== null && h !== null) c3 = 'nao'; else c3 = 'falta';
  return [
    criterio('glic', 'Glicemia ≥200 ou diabetes prévio', c1, g !== null ? num(g, 0) + ' mg/dL' : null),
    criterio('bohb', 'β-OHB ≥3,0 mmol/L', c2, b !== null ? num(b, 1) + ' mmol/L' : null),
    criterio('acido', 'pH <7,3 ou HCO₃ <18 mmol/L', c3, juntar([p !== null ? 'pH ' + num(p) : null, h !== null ? 'HCO₃ ' + num(h, 1) : null])),
  ];
}

/* Resolução, linha 42: dado faltando fica como falta, nunca como normal. */
export function criteriosResolucao(e) {
  const b = valor(e, 'bohb'), p = valor(e, 'ph'), h = valor(e, 'hco3'), g = valor(e, 'glicemia');
  const c1 = b !== null ? (b < 0.6 ? 'sim' : 'nao') : 'falta';
  let c2;
  if (p !== null && p >= 7.3) c2 = 'sim'; else if (h !== null && h >= 18) c2 = 'sim'; else if (p !== null && h !== null) c2 = 'nao'; else c2 = 'falta';
  const c3 = g !== null ? (g < 200 ? 'sim' : 'nao') : 'falta';
  const cs = [
    criterio('bohb', 'β-OHB <0,6 mmol/L', c1, b !== null ? num(b, 2) + ' mmol/L' : null),
    criterio('acido', 'pH ≥7,3 ou HCO₃ ≥18 mmol/L', c2, juntar([p !== null ? 'pH ' + num(p) : null, h !== null ? 'HCO₃ ' + num(h, 1) : null])),
    criterio('glic', 'Idealmente glicemia <200 mg/dL', c3, g !== null ? num(g, 0) + ' mg/dL' : null, true),
  ];
  return { criterios: cs, cumprido: c1 === 'sim' && c2 === 'sim' };
}

const acao = (tipo, rotulo, v = {}) => acaoProposta(tipo, rotulo, v);

const DEF = {
  id: 'cad',
  nome: 'Cetoacidose diabética',
  descricao: 'Do início da insulina à transição',
  idConduta: 'cad',
  referencia: 'Umpierrez GE et al. Hyperglycaemic crises in adults with diabetes: a consensus report. Diabetologia 2024;67:1455-1479 (doi:10.1007/s00125-024-06183-8).',
  escopo: 'Adulto com cetoacidose confirmada, em insulina regular IV em bomba ou via SC na forma leve ou moderada não complicada.',
  parametros: [
    defParametro('peso', 'Peso', 'kg', 30, 250),
    defParametro('glicemia', 'Glicemia', 'mg/dL', 20, 1500, 0),
    defParametro('potassio', 'Potássio', 'mmol/L', 1.5, 9),
    defParametro('ph', 'pH', '', 6.5, 7.8, 2),
    defParametro('hco3', 'HCO₃', 'mmol/L', 1, 45),
    defParametro('bohb', 'β-OHB', 'mmol/L', 0, 20),
    defParametro('fosfato', 'Fosfato', 'mmol/L', 0.1, 5),
    defParametro('creatinina', 'Creatinina', 'mg/dL', 0.1, 25),
  ],
  parametrosIniciais: ['peso', 'glicemia', 'potassio', 'ph', 'hco3', 'bohb'],
  parametrosResultados: ['glicemia', 'potassio', 'ph', 'hco3', 'bohb', 'fosfato', 'creatinina'],
  triagem: [
    pergunta('gestante', 'Gestante'),
    pergunta('menor18', 'Menor de 18 anos'),
    pergunta('ic', 'Insuficiência cardíaca'),
    pergunta('dialise', 'Doença renal em diálise'),
    pergunta('ehh', 'Estado hiperosmolar'),
  ],
  perguntasIniciais: [
    pergunta('diabetesPrevio', 'Tem diabetes prévio?'),
    pergunta('comprometimento', 'Há comprometimento renal ou cardíaco?'),
    pergunta('complicada', 'É um quadro complicado?', 'A via SC não é para grave nem complicada.'),
  ],
  perguntasAcompanhamento: [
    pergunta('diureseOk', 'Diurese de cerca de 0,5 mL/kg/h?'),
    pergunta('sinaisFosfato', 'Fraqueza muscular ou comprometimento respiratório ou cardíaco?'),
    pergunta('rebaixamento', 'Rebaixamento neurológico?'),
  ],
  ramos: [
    defRamo('via', 'Via da insulina', [
      opcaoRamo('iv', 'Regular IV em bomba', 'Infusão contínua'),
      opcaoRamo('sc', 'Subcutânea', 'Leve ou moderada não complicada'),
    ]),
  ],
  exames: [
    defExame('glicemia', 'Glicemia', 'Hora de repetir a glicemia', true),
    defExame('potassio', 'Potássio', 'Hora de repetir o potássio', true),
    defExame('gasometria', 'Gasometria', 'Hora de repetir a gasometria', true),
    defExame('bohb', 'β-OHB', 'Hora de repetir o β-OHB'),
    defExame('fosfato', 'Fosfato', 'Hora de repetir o fosfato'),
    defExame('creatinina', 'Creatinina', 'Hora de repetir a creatinina'),
  ],
  graficos: [
    defGrafico('glicemia', 'Glicemia', ['glicemia'], { glicemia: [linhaGrafico(250, '250')] }),
    defGrafico('potassio', 'Potássio', ['potassio'], { potassio: [linhaGrafico(3.5, '3,5'), linhaGrafico(5, '5,0')] }),
    defGrafico('acidose', 'Acidose', ['hco3', 'ph'], { hco3: [linhaGrafico(18, '18')], ph: [linhaGrafico(7.3, '7,3'), linhaGrafico(7.0, '7,0')] }),
  ],
  avaliar(e, agora) { return avaliar(this, e, agora); },
};

function avaliar(p, e, agora) {
  const o = orientacoes();

  /* Triagem: qualquer item marcado encerra os passos automáticos. */
  const marcados = p.triagem.filter((q) => resposta(e, q.chave) === true).map((q) => q.texto);
  if (marcados.length) { o.foraDeEscopo = marcados; return o; }
  o.triagemCompleta = p.triagem.every((q) => resposta(e, q.chave) !== null);
  if (!o.triagemCompleta) return o;

  const peso = valor(e, 'peso');
  const g = valor(e, 'glicemia'), k = valor(e, 'potassio'), ph = valor(e, 'ph'), hco3 = valor(e, 'hco3'), bohb = valor(e, 'bohb'), fos = valor(e, 'fosfato');

  /* Confirmação da CAD: o médico confirma mesmo com os critérios cumpridos. */
  const crit = criteriosCAD(e);
  const pelosCriterios = crit.every((c) => c.situacao === 'sim');
  o.confirmacao = painelCriterios('Critérios de cetoacidose', crit, pelosCriterios, R.rCriterio,
    acaoProposta('cad.confirmada', pelosCriterios ? 'Confirmo a cetoacidose' : 'Confirmo a cetoacidose mesmo sem todos os critérios'));

  /* Gravidade: a atual e a pior desde o início, para a via SC. */
  const gIni = gravidade(v0(primeiro(e, 'ph')), v0(primeiro(e, 'hco3')), v0(primeiro(e, 'bohb')));
  const gAtu = gravidade(ph, hco3, bohb);
  const pior = Math.max(gIni ?? 0, gAtu ?? 0);
  if (gIni !== null) {
    o.classificacao = 'Gravidade inicial: ' + nomeGravidade(gIni);
    o.classificacaoDetalhe = gIni === GRAV.grave ? 'Nível sugerido UTI.' : null;
    o.classificacaoRegra = gIni === GRAV.grave ? R.rGrave : gIni === GRAV.moderada ? R.rModerada : R.rLeve;
  } else {
    o.classificacao = 'Gravidade: falta pH, HCO₃ ou β-OHB';
  }
  if (pior === GRAV.grave) o.ramoBloqueado.sc = 'Não indicada em grave.';
  else if (resposta(e, 'complicada') === true) o.ramoBloqueado.sc = 'Não indicada em quadro complicado.';

  /* Exames seguem valendo desde o início da sessão. */
  const resol = criteriosResolucao(e);
  const resolucaoConfirmada = teveAcao(e, 'resolucao.confirmada');
  o.resolucao = painelCriterios('Resolução', resol.criterios, resol.cumprido, R.rResolucao,
    resol.cumprido && !resolucaoConfirmada ? acaoProposta('resolucao.confirmada', 'Confirmo a resolução') : null,
    resolucaoConfirmada ? 'Resolução confirmada pelo médico.' : null);

  if (!teveAcao(e, 'cad.confirmada')) {
    o.exames = examesDevidos(p, e, agora, false, null, (k ?? 0) > 5.0);
    return o;
  }

  /* Situação da insulina a partir do que o médico confirmou. */
  const via = e.escolhas.via ?? null;
  const horasIni = e.acoes.filter((a) => a.tipo === 'insulina.inicio' || a.tipo === 'sc.dose').map((a) => a.hora);
  const inicioIns = horasIni.length ? Math.min(...horasIni) : null;
  const parada = teveAcao(e, 'insulina.parada');
  const correndo = inicioIns !== null && !parada;
  const ua = ultimaAcao(e, 'insulina.inicio', 'insulina.ajuste');
  const taxa = ua ? (ua.valores.uKgH ?? null) : null;

  o.exames = examesDevidos(p, e, agora, resolucaoConfirmada, inicioIns, (k ?? 0) > 5.0);

  /* Alertas sem dose. */
  if (g !== null && g < 70) {
    o.alertas.push(alerta('hipo', 'vermelho', 'Glicemia abaixo de 70 mg/dL: reavaliar agora. O consenso não traz protocolo de resgate; a regra não sugere dose.', R.rHipo));
  }
  if (resposta(e, 'rebaixamento') === true) {
    o.alertas.push(alerta('neuro', 'vermelho', 'Rebaixamento neurológico: reavaliar agora. Considerar edema cerebral.', R.rNeuro));
  }
  if (correndo && k !== null && k < 3.5) {
    o.alertas.push(alerta('kCaindo', 'vermelho', `K ${num(k)} mmol/L com a insulina correndo. O consenso fala do início do tratamento: reposição de 10 mmol/h e decisão do médico sobre a insulina.`, R.rKCaindo));
  }
  if (correndo && k !== null && k === 3.5) {
    o.alertas.push(alerta('kLimite', 'amarelo', 'K 3,5 mmol/L com a insulina correndo: a regra de >3,5 é para iniciar. Decisão do médico sobre a insulina.', R.rKExato));
  }
  if (correndo) {
    const d = ultimosDois(e, 'glicemia');
    if (d && d[0].hora >= (inicioIns ?? agora) && d[1].valor >= d[0].valor) {
      o.alertas.push(alerta('naoCai', 'amarelo', `A glicemia não caiu entre as duas últimas medidas (${num(d[0].valor, 0)} e ${num(d[1].valor, 0)} mg/dL). Sem regra numérica: reavalie a infusão.`, R.rNaoCai));
    }
  }

  /* Trava: K ≤3,5 ou faltando antes de iniciar. */
  if (!correndo && !parada) {
    if (k !== null && k <= 3.5) {
      o.travas.push(trava('insulinaK', 'Não iniciar insulina', `K ${num(k)} mmol/L. Repor K até >3,5 mmol/L antes da insulina.`, k === 3.5 ? R.rKExato : R.rKTrava));
    }
  }

  /* Depois da parada da insulina IV a especificação não orienta mais nada: fica só o registro. */
  if (parada) {
    o.etapasFinais = etapasTransicao(e, agora, via, peso, false);
    o.encerradaPelaRegra = 'Insulina IV parada às ' + hora(ultimaAcao(e, 'insulina.parada')?.hora ?? agora) + '.';
    return o;
  }
  o.cartoes.push(cartaoInsulina(e, agora, via, peso, g, k, bohb, correndo, taxa, o.ramoBloqueado.sc ?? null, resolucaoConfirmada));
  o.cartoes.push(cartaoPotassio(e, peso, k));
  o.cartoes.push(cartaoVolume(e, agora));
  o.cartoes.push(cartaoDextrose(e, g, bohb));
  o.cartoes.push(cartaoBicarbonato(e, agora, ph));
  o.cartoes.push(cartaoFosfato(e, fos));

  if (resolucaoConfirmada) o.etapasFinais = etapasTransicao(e, agora, via, peso, correndo);
  return o;
}

function cartaoInsulina(e, agora, via, peso, g, k, bohb, correndo, taxa, scBloqueada, resolvida) {
  const c = cartao('insulina', 'Insulina', 'syringe.fill', 0x0F7F74, 'faltaDado', 'Falta dado');
  c.regras = [R.rInicio, R.rKTrava, R.rKExato, R.rMenos250, R.rAlvo];
  if (via === null) {
    c.valor = 'Escolha a via';
    c.detalhe = 'A dose depende da via da insulina.';
    return c;
  }
  const travaK = (k) => k <= 3.5;
  if (via === 'sc') return cartaoInsulinaSC(c, e, agora, peso, g, k, scBloqueada, travaK);

  if (!correndo) {
    if (k === null) {
      c.valor = 'Falta potássio';
      c.detalhe = 'A insulina só é liberada com K conhecido e >3,5 mmol/L.';
      return c;
    }
    if (travaK(k)) {
      c.situacao = 'travado';
      c.valor = 'Não iniciar';
      c.detalhe = `K ${num(k)} mmol/L. Repor K até >3,5 mmol/L.`;
      return c;
    }
    if (g === null) {
      c.valor = 'Falta glicemia';
      c.detalhe = 'Sem a glicemia não dá para saber a dose nem a dextrose.';
      return c;
    }
    if (peso === null) {
      c.valor = 'Falta peso';
      c.detalhe = 'A dose é por kg.';
      return c;
    }
    c.liberado = true;
    const u01 = 0.1 * peso, u005 = 0.05 * peso;
    if (g >= 250) {
      c.situacao = 'proximoPasso';
      c.valor = '0,1 U/kg/h';
      c.conta = `${num(u01)} U/h para ${num(peso, 1)} kg`;
      c.detalhe = `Bólus de 0,1 U/kg (${num(u01)} U) só se houver atraso na infusão.`;
      c.doses = { uKgH: 0.1, uH: u01, bolusU: u01 };
      c.acoes = [acao('insulina.inicio', `Confirmar início: ${num(u01)} U/h`, { uKgH: 0.1, uH: u01 }),
        acaoProposta('insulina.bolus', `Registrar bólus de ${num(u01)} U por atraso na infusão`, { u: u01 }, true)];
    } else {
      /* Início com glicemia <250: a especificação traz 0,1 (linha 22) e 0,05 (linha 23) sem dizer qual vale. O médico escolhe. */
      c.situacao = 'decisaoMedico';
      c.valor = '0,1 ou 0,05 U/kg/h';
      c.conta = `${num(u01)} ou ${num(u005)} U/h para ${num(peso, 1)} kg`;
      c.detalhe = `Glicemia ${num(g, 0)} mg/dL. A regra de início é 0,1 U/kg/h e a de glicemia <250 é 0,05 U/kg/h, sem definir qual vale ao iniciar abaixo de 250. Dextrose junto.`;
      c.doses = { uKgH01: 0.1, uKgH005: 0.05, uH01: u01, uH005: u005 };
      c.acoes = [acao('insulina.inicio', `Confirmar 0,1 U/kg/h: ${num(u01)} U/h`, { uKgH: 0.1, uH: u01 }),
        acao('insulina.inicio', `Confirmar 0,05 U/kg/h: ${num(u005)} U/h`, { uKgH: 0.05, uH: u005 })];
    }
    return c;
  }

  /* Já correndo. */
  c.liberado = true;
  const t = taxa ?? 0.1;
  const contaAtual = peso !== null ? `${num(t * peso)} U/h para ${num(peso, 1)} kg` : null;
  if (g === null) {
    c.situacao = 'correndo';
    c.valor = num(t) + ' U/kg/h';
    c.conta = contaAtual;
    c.detalhe = 'Falta glicemia para orientar a infusão.';
    return c;
  }
  if (g < 250 && t > 0.05) {
    c.situacao = 'proximoPasso';
    c.valor = 'Reduzir para 0,05 U/kg/h';
    if (peso !== null) {
      c.conta = `${num(0.05 * peso)} U/h para ${num(peso, 1)} kg`;
      c.doses = { uKgH: 0.05, uH: 0.05 * peso };
      c.acoes = [acao('insulina.ajuste', `Confirmar redução: ${num(0.05 * peso)} U/h`, { uKgH: 0.05, uH: 0.05 * peso })];
    }
    c.detalhe = `Glicemia ${num(g, 0)} mg/dL. Alvo depois de <250: cerca de 200 mg/dL.`;
    if (g < 200 && (bohb ?? 0) >= 3.0) {
      c.detalhe = (c.detalhe ?? '') + ' Forma euglicêmica: a regra não define taxa própria.';
    }
  } else if (g >= 250 && t <= 0.05) {
    c.situacao = 'decisaoMedico';
    c.valor = num(t) + ' U/kg/h';
    c.conta = contaAtual;
    c.detalhe = `Glicemia voltou a ${num(g, 0)} mg/dL com a taxa reduzida. Sem regra para subir: decisão do médico.`;
    c.regras = [R.rMenos250, R.rNaoCai];
  } else {
    c.situacao = 'correndo';
    c.valor = num(t) + ' U/kg/h';
    c.conta = contaAtual;
    c.doses = { uKgH: t };
    c.detalhe = g < 250 ? 'Alvo depois de <250: cerca de 200 mg/dL.' : null;
  }
  if (resolvida) c.detalhe = (c.detalhe !== null ? c.detalhe + ' ' : '') + 'Manter até a transição.';
  return c;
}

function cartaoInsulinaSC(base, e, agora, peso, g, k, bloqueada, travaK) {
  const c = copia(base);
  c.regras = [R.rViaSC, R.rDosesSC, R.rKTrava, R.rKExato];
  if (bloqueada !== null) {
    c.situacao = 'travado';
    c.valor = 'Via SC não indicada';
    c.detalhe = bloqueada + ' Escolha a via IV.';
    return c;
  }
  if (resposta(e, 'complicada') === null) {
    c.situacao = 'pergunta';
    c.valor = 'Quadro complicado?';
    c.pergunta = perguntaCartao('complicada', 'É um quadro complicado?');
    return c;
  }
  const doses = e.acoes.filter((a) => a.tipo === 'sc.dose');
  let ultima = null;
  for (const a of doses) if (ultima === null || ultima.hora < a.hora) ultima = a;
  if (!doses.length) {
    if (k === null) {
      c.valor = 'Falta potássio';
      c.detalhe = 'A insulina só é liberada com K conhecido e >3,5 mmol/L.';
      return c;
    }
    if (travaK(k)) {
      c.situacao = 'travado';
      c.valor = 'Não iniciar';
      c.detalhe = `K ${num(k)} mmol/L. Repor K até >3,5 mmol/L.`;
      return c;
    }
  }
  if (g === null) { c.valor = 'Falta glicemia'; c.detalhe = 'O esquema depende da glicemia.'; return c; }
  if (peso === null) { c.valor = 'Falta peso'; c.detalhe = 'A dose é por kg.'; return c; }
  c.liberado = true;
  const u = (x) => x * peso;
  if (!doses.length) {
    c.situacao = 'proximoPasso';
    c.valor = '0,1 U/kg inicial';
    c.conta = `${num(u(0.1))} U para ${num(peso, 1)} kg`;
    c.doses = { uKg: 0.1, u: u(0.1) };
    c.acoes = [acao('sc.dose', `Confirmar dose inicial: ${num(u(0.1))} U`, { uKg: 0.1, u: u(0.1), aCada: 1 })];
    if (g < 250) c.detalhe = `Glicemia ${num(g, 0)} mg/dL: a regra de <250 traz 0,05 U/kg/h ou 0,1 U/kg a cada 2 h, sem dizer qual vale na primeira dose. Decisão do médico.`;
    return c;
  }
  const intervalo = ultima?.valores.aCada ?? 1;
  const proxima = mais(ultima?.hora ?? agora, intervalo * 3600);
  c.situacao = agora >= proxima ? 'proximoPasso' : 'correndo';
  c.valor = 'Próxima às ' + hora(proxima);
  if (g < 250) {
    c.conta = `${num(u(0.05))} U/h ou ${num(u(0.1))} U a cada 2 h`;
    c.detalhe = `Glicemia ${num(g, 0)} mg/dL: 0,05 U/kg/h ou 0,1 U/kg a cada 2 h. Alvo: cerca de 200 mg/dL.`;
    c.doses = { uKg005: 0.05, uKg01: 0.1 };
    c.acoes = [acao('sc.dose', `Confirmar 0,05 U/kg: ${num(u(0.05))} U, em 1 h`, { uKg: 0.05, u: u(0.05), aCada: 1 }),
      acao('sc.dose', `Confirmar 0,1 U/kg: ${num(u(0.1))} U, em 2 h`, { uKg: 0.1, u: u(0.1), aCada: 2 })];
  } else {
    c.conta = `${num(u(0.1))} U a cada 1 h ou ${num(u(0.2))} U a cada 2 h`;
    c.detalhe = '0,1 U/kg a cada 1 h ou 0,2 U/kg a cada 2 h.';
    c.doses = { uKg01: 0.1, uKg02: 0.2 };
    c.acoes = [acao('sc.dose', `Confirmar 0,1 U/kg: ${num(u(0.1))} U, em 1 h`, { uKg: 0.1, u: u(0.1), aCada: 1 }),
      acao('sc.dose', `Confirmar 0,2 U/kg: ${num(u(0.2))} U, em 2 h`, { uKg: 0.2, u: u(0.2), aCada: 2 })];
  }
  return c;
}

function cartaoPotassio(e, peso, k) {
  const c = cartao('potassio', 'Potássio', 'bolt.fill', 0x6D3FD6, 'faltaDado', 'Falta potássio');
  c.regras = [R.rKcl, R.rKBaixo, R.rKAlto, R.rDiurese];
  let aberto = null;
  for (const a of e.acoes) if ((a.tipo === 'kcl.inicio' || a.tipo === 'kcl.parada') && (aberto === null || aberto.hora < a.hora)) aberto = a;
  const modoAtual = aberto?.tipo === 'kcl.inicio' ? (aberto.valores.modo ?? null) : null;
  if (k === null) {
    c.detalhe = 'Sem o K, a reposição não é orientada.';
    return c;
  }
  if (k > 5.0) {
    c.valor = 'Sem K';
    c.conta = `K ${num(k)} mmol/L`;
    if (modoAtual !== null) {
      c.situacao = 'proximoPasso';
      c.acoes = [acao('kcl.parada', 'Confirmar retirada do K')];
      c.detalhe = 'K >5,0 mmol/L. Repetir K a cada 2 h.';
    } else {
      c.situacao = 'semIndicacao';
      c.detalhe = 'Repetir K a cada 2 h.';
    }
    c.regras = [R.rKAlto];
    return c;
  }
  /* Diurese antes de repor: resposta do médico, nunca presumida. */
  const contaDiurese = peso !== null ? `Cerca de ${num(0.5 * peso)} mL/h para ${num(peso, 1)} kg` : null;
  const diu = resposta(e, 'diureseOk');
  if (diu === null) {
    c.situacao = 'pergunta';
    c.valor = 'Diurese antes de repor';
    c.conta = contaDiurese;
    c.detalhe = `K ${num(k)} mmol/L. A reposição só é mostrada depois da resposta.`;
    c.pergunta = perguntaCartao('diureseOk', 'Diurese de cerca de 0,5 mL/kg/h?');
    return c;
  }
  if (!diu) {
    c.situacao = 'decisaoMedico';
    c.valor = 'Diurese insuficiente';
    c.conta = contaDiurese;
    c.detalhe = `K ${num(k)} mmol/L. A reposição não é liberada pela regra.`;
    c.pergunta = perguntaCartao('diureseOk', 'A diurese chegou a cerca de 0,5 mL/kg/h?');
    return c;
  }
  c.liberado = true;
  if (k < 3.5) {
    c.doses = { mmolH: 10 };
    c.valor = '10 mmol/h';
    c.conta = `K ${num(k)} mmol/L`;
    c.detalhe = 'Adiar a insulina até K >3,5 mmol/L.';
    if (modoAtual === 1) c.situacao = 'correndo';
    else {
      c.situacao = 'proximoPasso';
      c.acoes = [acao('kcl.inicio', 'Confirmar KCl 10 mmol/h', { modo: 1, mmolH: 10 })];
    }
    c.regras = [R.rKBaixo, R.rKCaindo, R.rDiurese];
  } else {
    c.doses = { mmolLMin: 20, mmolLMax: 30 };
    c.valor = '20-30 mmol por litro';
    c.conta = `K ${num(k)} mmol/L. Alvo K 4-5`;
    if (k === 3.5) c.detalhe = 'K exatamente 3,5: a insulina segue segurada até K >3,5 se ainda não começou.';
    if (modoAtual === 2) c.situacao = 'correndo';
    else {
      c.situacao = 'proximoPasso';
      c.acoes = [acao('kcl.inicio', 'Confirmar KCl 20-30 mmol por litro', { modo: 2, mmolLMin: 20, mmolLMax: 30 })];
    }
    c.regras = [R.rKcl, R.rDiurese];
  }
  return c;
}

function cartaoVolume(e, agora) {
  const c = cartao('volume', 'Volume', 'drop.fill', 0x1F5FD1, 'pergunta', 'Comprometimento?');
  c.regras = [R.rVolume];
  const comp = resposta(e, 'comprometimento');
  if (comp === null) {
    c.detalhe = 'A taxa vale para quem não tem comprometimento renal ou cardíaco.';
    c.pergunta = perguntaCartao('comprometimento', 'Há comprometimento renal ou cardíaco?');
    return c;
  }
  if (comp) {
    c.situacao = 'decisaoMedico';
    c.valor = 'Sem taxa pela regra';
    c.detalhe = 'Com comprometimento renal ou cardíaco, a regra de volume não se aplica. Decisão do médico.';
    return c;
  }
  const ini = ultimaAcao(e, 'volume.inicio')?.hora ?? null;
  if (ini === null) {
    c.situacao = 'proximoPasso';
    c.valor = '500-1000 mL/h';
    c.conta = 'Isotônico ou cristaloide balanceado';
    c.detalhe = 'Nas primeiras 2-4 h.';
    c.liberado = true;
    c.acoes = [acao('volume.inicio', 'Confirmar início do volume')];
    return c;
  }
  const h = desde(agora, ini) / 3600;
  if (h <= 4) {
    c.situacao = 'correndo';
    c.valor = '500-1000 mL/h';
    c.conta = 'Isotônico ou cristaloide balanceado';
    c.detalhe = `Iniciado às ${hora(ini)}, há ${duracao(desde(agora, ini))}. A regra vale nas primeiras 2-4 h.`;
    c.liberado = true;
  } else {
    c.situacao = 'decisaoMedico';
    c.valor = 'Passou de 4 h';
    c.detalhe = `Iniciado às ${hora(ini)}. A especificação não traz taxa depois das primeiras 2-4 h. Decisão do médico.`;
  }
  return c;
}

function cartaoDextrose(e, g, bohb) {
  const c = cartao('dextrose', 'Dextrose', 'cube.fill', 0xA8530A, 'faltaDado', 'Falta glicemia');
  c.regras = [R.rMenos250, R.rEugl];
  const rodando = teveAcao(e, 'dextrose.inicio') && !teveAcao(e, 'dextrose.parada');
  if (g === null) return c;
  const eugl = g < 200 && (bohb ?? -1) >= 3.0;
  if (g < 250) {
    c.liberado = true;
    c.valor = 'Dextrose 5-10%';
    c.conta = `Glicemia ${num(g, 0)} mg/dL`;
    c.detalhe = eugl ? 'Forma euglicêmica: dextrose desde o início da insulina.' : 'Junto da redução da insulina.';
    c.situacao = rodando ? 'correndo' : 'proximoPasso';
    if (!rodando) c.acoes = [acao('dextrose.inicio', 'Confirmar dextrose 5-10%')];
  } else if (rodando) {
    c.situacao = 'decisaoMedico';
    c.valor = 'Dextrose correndo';
    c.conta = `Glicemia ${num(g, 0)} mg/dL`;
    c.detalhe = 'Sem regra de suspensão com glicemia ≥250. Decisão do médico.';
    c.acoes = [acao('dextrose.parada', 'Registrar parada da dextrose')];
  } else {
    c.situacao = 'semIndicacao';
    c.valor = 'Não indicada agora';
    c.conta = `Glicemia ${num(g, 0)} mg/dL. Entra com <250`;
  }
  return c;
}

function cartaoBicarbonato(e, agora, ph) {
  const c = cartao('bicarbonato', 'Bicarbonato', 'testtube.2', 0x0E7C94, 'faltaDado', 'Falta pH');
  c.regras = [R.rBic];
  if (ph === null) return c;
  const ultima = ultimaAcao(e, 'bicarbonato.dose');
  if (ph < 7.0) {
    c.liberado = true;
    c.valor = 'Considerar 100 mmol';
    c.conta = 'Em 400 mL de água estéril, a cada 2 h até pH >7,0';
    c.doses = { mmol: 100, mL: 400 };
    if (ultima !== null && agora < mais(ultima.hora, 7200)) {
      c.situacao = 'correndo';
      c.detalhe = `pH ${num(ph)}. Última às ${hora(ultima.hora)}; próxima às ${hora(mais(ultima.hora, 7200))}.`;
    } else {
      c.situacao = 'proximoPasso';
      c.detalhe = `pH ${num(ph)}.`;
      c.acoes = [acao('bicarbonato.dose', 'Registrar 100 mmol de bicarbonato', { mmol: 100 })];
    }
  } else {
    c.situacao = 'semIndicacao';
    c.valor = 'Não indicado';
    c.conta = `pH ${num(ph)}`;
    if (ultima !== null && ph === 7.0) c.detalhe = 'pH exatamente 7,0: a regra indica com <7,0 e segue até >7,0. Decisão do médico.';
  }
  return c;
}

function cartaoFosfato(e, fos) {
  const c = cartao('fosfato', 'Fosfato', 'figure.walk.motion', 0xA8327E, 'pergunta', 'Há sinais?');
  c.regras = [R.rFosf];
  const s = resposta(e, 'sinaisFosfato');
  if (s === null) {
    c.detalhe = 'A regra pede fraqueza muscular ou comprometimento respiratório ou cardíaco, com fosfato <1,0 mmol/L.';
    c.pergunta = perguntaCartao('sinaisFosfato', 'Fraqueza muscular ou comprometimento respiratório ou cardíaco?');
    c.discreto = true;
    return c;
  }
  if (!s) {
    c.situacao = 'semIndicacao';
    c.valor = 'Não indicado agora';
    c.conta = fos !== null ? `Fosfato ${num(fos)} mmol/L` : null;
    return c;
  }
  if (fos === null) {
    c.situacao = 'faltaDado';
    c.valor = 'Falta fosfato';
    c.detalhe = 'Há sinais; falta o valor do fosfato.';
    return c;
  }
  if (fos < 1.0) {
    c.situacao = 'proximoPasso';
    c.valor = 'Considerar reposição';
    c.conta = `Fosfato ${num(fos)} mmol/L`;
    c.detalhe = 'A especificação não traz dose.';
    c.liberado = true;
    if (!teveAcao(e, 'fosfato.inicio')) c.acoes = [acao('fosfato.inicio', 'Registrar decisão de repor fosfato')];
    else c.situacao = 'correndo';
  } else {
    c.situacao = 'semIndicacao';
    c.valor = 'Não indicado agora';
    c.conta = `Fosfato ${num(fos)} mmol/L`;
  }
  return c;
}

function etapasTransicao(e, agora, via, peso, correndo) {
  const c = cartao('transicao', 'Transição', 'arrow.triangle.swap', 0x3451B2, 'pergunta', 'Pode comer?');
  c.regras = [R.rTransicao, R.rDoseSC, R.rBasal];
  const come = resposta(e, 'podeComer');
  if (come === null) {
    c.pergunta = perguntaCartao('podeComer', 'O paciente pode comer?');
    return [c];
  }
  if (!come) {
    c.situacao = 'decisaoMedico';
    c.valor = 'Aguardando poder comer';
    c.detalhe = 'A regra de transição é para quem pode comer. Manter o que está em curso; decisão do médico.';
    c.pergunta = perguntaCartao('podeComer', 'O paciente já pode comer?');
    return [c];
  }
  c.liberado = true;
  const d = cartao('doseSC', 'Dose SC', 'syringe', 0x3451B2, 'pergunta', 'Usava insulina?');
  d.regras = [R.rDoseSC];
  const prev = resposta(e, 'insulinaPrevia');
  if (prev !== null) {
    const fragil = resposta(e, 'fragilOuRenal');
    if (prev) {
      d.situacao = 'decisaoMedico';
      d.valor = 'Sem regra para quem usava insulina';
      d.detalhe = 'A especificação só traz dose para quem não usava insulina. Decisão do médico.';
    } else if (fragil !== null) {
      if (peso === null) {
        d.situacao = 'faltaDado';
        d.valor = 'Falta peso';
        return [c, d];
      }
      d.situacao = 'proximoPasso';
      if (fragil) {
        d.valor = 'Cerca de 0,3 U/kg';
        d.conta = `Dose diária total: cerca de ${num(0.3 * peso)} U/dia para ${num(peso, 1)} kg`;
        d.doses = { uKgDia: 0.3, uDia: 0.3 * peso };
      } else {
        d.valor = '0,5-0,6 U/kg';
        d.conta = `Dose diária total: ${num(0.5 * peso)}-${num(0.6 * peso)} U/dia para ${num(peso, 1)} kg`;
        d.doses = { uKgDiaMin: 0.5, uKgDiaMax: 0.6, uDiaMin: 0.5 * peso, uDiaMax: 0.6 * peso };
      }
    } else {
      d.valor = 'Fragilidade ou falência renal?';
      d.pergunta = perguntaCartao('fragilOuRenal', 'Há fragilidade ou falência renal?');
    }
  } else {
    d.pergunta = perguntaCartao('insulinaPrevia', 'Usava insulina antes?');
  }
  /* Depois da basal a dose fica como informação, não como próximo passo. */
  if (teveAcao(e, 'basal.sc') && d.situacao === 'proximoPasso') d.situacao = 'semIndicacao';
  const cartoes = [d];
  c.valor = 'Basal SC';
  const basal = ultimaAcao(e, 'basal.sc');
  if (basal !== null) {
    if (via === 'iv' && correndo) {
      const de = mais(basal.hora, 3600), ate = mais(basal.hora, 7200);
      if (agora < de) {
        c.situacao = 'correndo';
        c.valor = 'Manter insulina IV';
        c.conta = `Basal às ${hora(basal.hora)}. Parar entre ${hora(de)} e ${hora(ate)}`;
        c.detalhe = `Faltam ${duracao(desde(de, agora))} para abrir a janela.`;
      } else {
        c.situacao = 'proximoPasso';
        c.valor = 'Parar a insulina IV';
        c.conta = `Basal às ${hora(basal.hora)}. Janela de 1-2 h: ${hora(de)} a ${hora(ate)}`;
        c.detalhe = agora > ate ? 'A janela de 1-2 h já passou.' : null;
        c.acoes = [acao('insulina.parada', 'Confirmar parada da insulina IV')];
      }
    } else {
      c.situacao = 'semIndicacao';
      c.valor = 'Basal registrada';
      c.conta = `Às ${hora(basal.hora)}`;
    }
  } else {
    c.situacao = 'proximoPasso';
    c.conta = 'Dar 1-2 h antes de parar a insulina IV';
    c.acoes = [acao('basal.sc', 'Confirmar basal SC dada')];
  }
  cartoes.unshift(c);
  return cartoes;
}

function examesDevidos(p, e, agora, resolvido, inicioInsulina, kAlto) {
  const def = (id) => p.exames.find((x) => x.id === id);
  const montar = (id, ultima, janela, proxima, r, encerrado = false) => {
    const d = def(id);
    let s;
    if (encerrado) s = 'encerrado';
    else if (ultima === null && proxima === null) s = 'semDado';
    else if (proxima !== null && agora > proxima) s = 'vencido';
    else s = 'noPrazo';
    return exameDevido({ id, nome: d.nome, aviso: d.aviso, destaque: d.destaque, ultima, janelaInicio: janela, proxima, situacao: s, regra: r });
  };
  const hr = (id) => ultimo(e, id)?.hora ?? null;
  const r = [];
  const ug = hr('glicemia');
  r.push(montar('glicemia', ug, ug !== null ? mais(ug, 3600) : null, ug !== null ? mais(ug, 7200) : null, R.rGlicemia, teveAcao(e, 'insulina.parada')));

  /* K: >5,0 a cada 2 h; depois de iniciar a insulina, 2 h e então a cada 4 h; antes disso, com os eletrólitos, a cada 4 h. */
  const uk = hr('potassio');
  let pk = null;
  let rk = R.r4h;
  if (uk !== null) {
    if (kAlto) {
      pk = mais(uk, 7200); rk = R.rKAlto;
    } else if (inicioInsulina !== null) {
      const marco = mais(inicioInsulina, 7200);
      pk = uk >= marco ? mais(uk, 14400) : marco;
      rk = R.rRepetirK;
    } else {
      pk = mais(uk, 14400);
    }
  }
  r.push(montar('potassio', uk, null, pk, rk, teveAcao(e, 'insulina.parada')));

  const gs = [hr('ph'), hr('hco3')].filter((x) => x !== null);
  const ugas = gs.length ? Math.max(...gs) : null;
  r.push(montar('gasometria', ugas, null, ugas !== null ? mais(ugas, 14400) : null, R.r4h, resolvido));
  for (const id of ['bohb', 'fosfato', 'creatinina']) {
    const u = hr(id);
    r.push(montar(id, u, null, u !== null ? mais(u, 14400) : null, R.r4h, resolvido));
  }
  return r;
}

/* Para o teste diferencial: as contas puras, em JSON simples. */
export const funcoesTeste = {
  gravidade: (ph, hco3, bohb) => gravidade(ph, hco3, bohb),
  criteriosCAD: (e) => criteriosCAD(e),
  criteriosResolucao: (e) => criteriosResolucao(e),
};
export const regrasCAD = R;
export const motorCAD = criarProtocolo(DEF);
export default motorCAD;
