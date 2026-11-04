/* Anafilaxia. Porta fiel de MotorAnafilaxia.swift (app iOS). Especificação: docs/sessao_anafilaxia_regras.md do app
   (WAO Anaphylaxis Guidance 2020). O número de cada regra é a linha do arquivo de regras.
   Dose por peso manda em qualquer idade. Infusão, glucagon e tempo de observação são alerta, sem número.
   Não mudar regra aqui sem mudar no Swift: o teste diferencial reprova. */
import {
  criarProtocolo, pergunta, defParametro, defRamo, opcaoRamo, defExame, defGrafico, regra,
  orientacoes, cartao, alerta, criterio, painelCriterios, acaoProposta, perguntaCartao, exameDevido,
  cronometroSessao, marcoCronometro, valor, resposta, ultimaAcao, teveAcao, num, hora, desde, mais,
} from './nucleo.js';

const R = {
  r01: regra(31, 'R01. Início agudo com pele ou mucosa e pelo menos um de: respiratório; PA reduzida ou disfunção de órgão; gastrointestinal grave. Anafilaxia muito provável.', 'WAO 2020, Tabela 2, critério 1'),
  r02: regra(32, 'R02. Início agudo após exposição a alérgeno conhecido ou muito provável, com hipotensão, broncoespasmo ou comprometimento laríngeo, mesmo sem pele. Anafilaxia muito provável.', 'WAO 2020, Tabela 2, critério 2 e notas b e c'),
  r03: regra(33, 'R03. Hipotensão em adulto e criança de 10 anos ou mais: PAS abaixo de 90 mmHg.', 'WAO 2020, Tabela 2, nota a'),
  r04: regra(34, 'R04. Hipotensão em criança de menos de 10 anos: PAS abaixo de 70 + 2 x idade em anos.', 'WAO 2020, Tabela 2, nota a'),
  r05: regra(35, 'R05. PAS caiu mais de 30% em relação à basal conhecida: conta como hipotensão, em qualquer idade.', 'WAO 2020, Tabela 2, nota a'),
  r06: regra(36, 'R06. Só pele ou mucosa: não classifica como anafilaxia por esta fonte. A evolução pode mudar, e a decisão sobre adrenalina é do médico.', 'WAO 2020, seção de definição'),
  r07: regra(37, 'R07. Quadro suspeito que não fecha os critérios: adrenalina pode ser dada por julgamento clínico mesmo assim. A sessão não bloqueia.', 'WAO 2020, definição; GA2LEN 2024, fonte secundária'),
  r08: regra(38, 'R08. Reação sistêmica em evolução durante imunoterapia: os critérios não impedem tratar como anafilaxia desde o início.', 'WAO 2020, texto após a Tabela 2'),
  r09: regra(44, 'R09. Retirar o gatilho se possível; avaliar via aérea, respiração, circulação, estado mental e pele; pedir ajuda; adrenalina IM; posicionar.', 'WAO 2020, Acute treatment'),
  r10: regra(45, 'R10. Adrenalina IM: 0,01 mg x peso em kg, teto de 0,5 mg, no vasto lateral (face anterolateral da coxa).', 'WAO 2020, Acute treatment; Tabela 6'),
  r11: regra(46, 'R11. Concentração de 1 mg/mL: o volume em mL é igual à dose em mg.', 'WAO 2020, Tabela 6, nota a'),
  r12: regra(47, 'R12. Sem peso, faixa etária da Tabela 6: 1 a 5 anos, 0,15 mg; 6 a 12 anos, 0,3 mg; adolescente e adulto, 0,5 mg. Lactente depende do peso. A tabela é uma simplificação, com lacunas de faixa.', 'WAO 2020, Tabela 6'),
  r13: regra(48, 'R13. Sintomas persistem após a dose: repetir a cada 5 a 15 min. Marca de 5 min: repetição permitida se sem melhora. Marca de 15 min: fim da janela da fonte, reavaliar agora.', 'WAO 2020, Acute treatment'),
  r14: regra(49, 'R14. A via IV não é recomendada no tratamento inicial. Se usada: paciente monitorado, equipe experiente em diluir e dar a dose, de preferência em bomba.', 'WAO 2020, Acute treatment'),
  r15: regra(50, 'R15. Sem dificuldade respiratória: decúbito dorsal. Elevação das pernas é descrita como controversa e não é imposta.', 'WAO 2020, Acute treatment'),
  r16: regra(51, 'R16. Dificuldade respiratória: sentado pode ajudar. Gestante: semirreclinada para o lado esquerdo. Inconsciente: posição de recuperação.', 'WAO 2020, Acute treatment'),
  r17: regra(52, 'R17. Dificuldade respiratória, ou recebendo nova dose de adrenalina: oxigênio em alto fluxo, de preferência 100% por máscara com reservatório.', 'WAO 2020, texto após a dose de adrenalina'),
  r18: regra(53, 'R18. Em atendimento hospitalar: cateter calibroso, 14 ou 16 G no adulto.', 'WAO 2020, texto após a dose de adrenalina'),
  r19: regra(54, 'R19. Instabilidade cardiovascular: cristaloide em bólus de 20 mL/kg. A fonte não dá teto, tipo de cristaloide nem regra de repetição.', 'WAO 2020, texto após a dose de adrenalina'),
  r20: regra(55, 'R20. Sibilo ou broncoconstrição: beta-2 agonista inalatório, sem dose na fonte. Não substitui nova dose de adrenalina IM se os sintomas continuam.', 'WAO 2020, adjuvantes'),
  r21: regra(56, 'R21. Estridor ou edema de laringe: considerar adrenalina nebulizada, sem dose na fonte.', 'WAO 2020, Acute treatment'),
  r22: regra(57, 'R22. Anti-H1 alivia sintomas de pele e tem papel limitado; pode atrasar a adrenalina repetida; a infusão IV rápida pode causar hipotensão. Sem dose, nunca antes da adrenalina.', 'WAO 2020, segundas linhas'),
  r23: regra(58, 'R23. Corticoide não é oferecido: a fonte diz que a evidência é de nenhum benefício agudo e possível dano, e o uso de rotina é controverso.', 'WAO 2020, segundas linhas'),
  r24: regra(59, 'R24. Resposta ruim à adrenalina, sobretudo em betabloqueador: glucagon parenteral pode ser usado; evidência muito limitada; sem dose na fonte.', 'WAO 2020, Acute treatment'),
  r25: regra(60, 'R25. Reavaliar a intervalos curtos e regulares PA, FC, perfusão, estado respiratório e mental; monitorização invasiva se pertinente.', 'WAO 2020, Acute treatment'),
  r26: regra(61, 'R26. A triptase sobe de 15 min a 3 h ou mais do início, com pico entre 1 e 2 h; normal não exclui anafilaxia. Basal pelo menos 24 h após a resolução. A sessão só registra o horário.', 'WAO 2020, Diagnostic tests'),
  r27: regra(62, 'R27. Todo paciente tratado deve ser observado, em especial reações graves ou com várias doses de adrenalina. A fonte afirma que não há consenso sobre a duração.', 'WAO 2020, Acute treatment; Unmet needs'),
  r28: regra(63, 'R28. Antes da alta: autoinjetor ou alternativa com treino; plano de ação escrito; alerta médico; registrar o gatilho suspeito; encaminhar ao alergista; reavaliar fatores de risco; seguimento.', 'WAO 2020, Long-term management; Tabela 8'),
  rGestante: regra(91, 'Gestante: a fonte só trata da posição. A sessão usa a mesma fórmula de dose e avisa que a fonte não discute a dose na gravidez.', 'Seção de fora do escopo da especificação'),
  rLactente: regra(92, 'Lactente menor de 10 kg: a fonte dá 0,01 mg/kg sem dose mínima. A sessão calcula e avisa que o volume é muito pequeno, sem inventar mínimo.', 'Seção de fora do escopo da especificação'),
  rDiferenciais: regra(89, 'Sintoma de um sistema só, sem alérgeno conhecido ou muito provável: não preenche os critérios. Diferenciais: asma aguda, síncope, escombroidose, crise de pânico, disfunção de corda vocal, entre outros.', 'WAO 2020, Tabela 3'),
  rInfusao: regra(97, 'A WAO não define anafilaxia refratária. A cada nova dose sem melhora, a sessão mostra que a fonte prevê adrenalina IV em bomba para reação refratária à IM, sem taxa, sem diluição e sem calculadora.', 'Regras, sem regra numérica'),
  rVolumeSem: regra(101, 'Volume: teto em mL, tipo de cristaloide e quantos bólus repetir, sem regra. 20 mL/kg é o único número.', 'Regras, sem regra numérica'),
  rSemJanela: regra(98, 'Número máximo de doses de adrenalina IM e o que fazer se passar de 15 min sem decidir: sem regra.', 'Regras, sem regra numérica'),
};

export const avisosTriagem = {
  perioperatorio: 'Perioperatório: a fonte não dá regra própria para este cenário.',
  parada: 'Parada cardiorrespiratória: a fonte só cita reanimação com compressões contínuas. Saia da sessão.',
  angioedema: 'Angioedema sem urticária: a fonte lista angioedema por inibidor da ECA e hereditário como diferencial e não dá tratamento. A adrenalina continua a critério do médico.',
  respBaixa: 'Sintoma respiratório baixo só por alérgeno inalatório comum, ou por alimento sem ingestão: excluído do critério 2 pela própria fonte.',
};

/* Dose de adrenalina IM. Linhas 45 a 47: peso manda; idade só sem peso. Lactente sem peso fica sem número.
   Devolve { mg, porPeso } ou null. */
export function doseAdrenalina(peso, idade) {
  if (peso !== null && peso > 0) return { mg: Math.min(0.01 * peso, 0.5), porPeso: true };
  if (idade === null) return null;
  if (idade < 1) return null;
  if (idade < 6) return { mg: 0.15, porPeso: false };
  if (idade < 13) return { mg: 0.3, porPeso: false };
  return { mg: 0.5, porPeso: false };
}

/* Hipotensão pelas linhas 33 a 35. Três valores: sem dado para concluir, fica falta. */
export function hipotensaoCalculada(pas, idade, basal) {
  if (pas === null) return 'falta';
  if (basal !== null && (basal - pas) * 10 > basal * 3) return 'sim';
  if (idade === null) return 'falta';
  const limite = idade < 10 ? 70 + 2 * idade : 90;
  return pas < limite ? 'sim' : 'nao';
}
export function hipotensao(e) {
  const calc = hipotensaoCalculada(valor(e, 'pas'), valor(e, 'idade'), valor(e, 'pasBasal'));
  const resp = resposta(e, 'hipotensao');
  if (calc === 'sim' || resp === true) return 'sim';
  if (calc === 'nao' || resp === false) return 'nao';
  return 'falta';
}

/* Lógica de três valores: "sim" prevalece no ou; "não" prevalece no e; o resto é falta. */
export const ou = (v) => (v.includes('sim') ? 'sim' : v.every((x) => x === 'nao') ? 'nao' : 'falta');
export const e_ = (v) => (v.includes('nao') ? 'nao' : v.every((x) => x === 'sim') ? 'sim' : 'falta');
export const tres = (b) => (b === null ? 'falta' : b ? 'sim' : 'nao');

export function criterio1(e) {
  const hip = hipotensao(e);
  return e_([tres(resposta(e, 'inicioAgudo')), tres(resposta(e, 'pele')),
    ou([tres(resposta(e, 'respiratorio')), tres(resposta(e, 'paOrgao')), hip, tres(resposta(e, 'giGrave'))])]);
}
export function criterio2(e) {
  const x = e.escolhas.exposicao;
  const exp = x !== undefined && x !== null ? (x === 'sem' ? 'nao' : 'sim') : 'falta';
  return e_([tres(resposta(e, 'inicioAgudo')), exp, ou([hipotensao(e), tres(resposta(e, 'bronco')), tres(resposta(e, 'laringe'))])]);
}

/* Doses dadas: as confirmadas na tela e as digitadas (fora do serviço, por exemplo).
   Digitada de novo não conta duas vezes (decisão do Matheus, 04/11/2026, igual ao Swift): a mesma dose é a que cai no
   mesmo minuto calculado (hora da coleta menos os minutos digitados, no minuto do relógio). Vale a primeira digitada.
   Só junta digitada com digitada. */
export function horasDoses(e) {
  const h = e.acoes.filter((a) => a.tipo === 'adrenalina.dose').map((a) => a.hora);
  const minutos = new Set();
  for (const m of e.series.adrenalinaHa ?? []) {
    const quando = mais(m.hora, -Math.max(0, m.valor) * 60);
    const minuto = Math.floor(quando / 60000);
    if (!minutos.has(minuto)) { minutos.add(minuto); h.push(quando); }
  }
  return h.sort((a, b) => a - b);
}
const RESPOSTAS = ['resolveu', 'persiste', 'piorou'];
/* A resposta informada depois da última dose; a de antes não vale mais. */
export function respostaDepois(e, ultima) {
  let a = null;
  for (const x of e.acoes) if (x.tipo.startsWith('evolucao.') && x.hora >= ultima && (a === null || a.hora < x.hora)) a = x;
  if (a === null) return null;
  const r = a.tipo.slice('evolucao.'.length);
  return RESPOSTAS.includes(r) ? r : null;
}

function juntar(...r) {
  return regra(r[0].linha, r.map((x) => x.texto).join('\n\n'), r.map((x) => x.origem).join('. '));
}
const acao = (tipo, rotulo, v = {}, secundaria = false) => acaoProposta(tipo, rotulo, v, secundaria);

const DEF = {
  id: 'anafilaxia',
  nome: 'Anafilaxia',
  descricao: 'Dose por peso e cronômetro da adrenalina',
  idConduta: 'anafilaxia',
  referencia: 'Cardona V, Ansotegui IJ, Ebisawa M et al. World Allergy Organization Anaphylaxis Guidance 2020. World Allergy Organ J 2020, artigo 100472 (doi:10.1016/j.waojou.2020.100472).',
  escopo: 'Suspeita de anafilaxia em pronto atendimento ou enfermaria, em qualquer idade, com peso informado ou estimado.',
  tituloRamos: 'Critérios',
  rotuloProximoPasso: 'Próximo passo pela diretriz',
  tituloExames: 'Prazos',
  tituloOutrosExames: 'Janela da adrenalina',
  rotuloPrazoExame: 'janela até',
  tituloResolucao: 'Observação e alta',
  parametros: [
    defParametro('peso', 'Peso', 'kg', 2, 250),
    defParametro('idade', 'Idade', 'anos', 0, 110),
    defParametro('pas', 'PA sistólica', 'mmHg', 30, 300, 0),
    defParametro('pasBasal', 'PA sistólica basal', 'mmHg', 60, 250, 0),
    defParametro('adrenalinaHa', 'Adrenalina dada há', 'min', 0, 360, 0),
  ],
  parametrosIniciais: ['peso', 'idade', 'pas', 'pasBasal', 'adrenalinaHa'],
  parametrosResultados: ['pas', 'peso', 'idade', 'pasBasal', 'adrenalinaHa'],
  triagem: [
    pergunta('perioperatorio', 'Perioperatório'),
    pergunta('parada', 'Parada cardiorrespiratória'),
    pergunta('angioedema', 'Angioedema sem urticária, sobretudo com inibidor da ECA ou história familiar'),
    pergunta('respBaixa', 'Sintoma respiratório baixo só por alérgeno inalatório comum, ou por alimento sem ingestão'),
  ],
  perguntasIniciais: [
    pergunta('inicioAgudo', 'Início agudo, de minutos a várias horas?'),
    pergunta('pele', 'Pele ou mucosa?', 'Urticária generalizada, prurido, rubor, lábios, língua ou úvula inchados.'),
    pergunta('respiratorio', 'Respiratório?', 'Dispneia, sibilo, estridor, PFE reduzido, hipoxemia.'),
    pergunta('bronco', 'Broncoespasmo?'),
    pergunta('laringe', 'Comprometimento laríngeo?', 'Estridor, alteração da voz, odinofagia.'),
    pergunta('paOrgao', 'PA reduzida ou disfunção de órgão?', 'Hipotonia, síncope, incontinência.'),
    pergunta('giGrave', 'Gastrointestinal grave?', 'Cólica intensa, vômitos repetidos, sobretudo após exposição não alimentar.'),
    pergunta('hipotensao', 'Hipotensão?', 'Pergunta para quando não há PA digitada. Com PA e idade, a regra calcula.'),
    pergunta('gestante', 'Gestante?'),
    pergunta('imunoterapia', 'Reação sistêmica durante imunoterapia com alérgeno?'),
    pergunta('pesoEstimado', 'O peso é estimado?'),
  ],
  perguntasAcompanhamento: [
    pergunta('respiratorio', 'Dificuldade respiratória?'),
    pergunta('bronco', 'Broncoespasmo?'),
    pergunta('laringe', 'Estridor ou edema de laringe?'),
    pergunta('hipotensao', 'Hipotensão?'),
    pergunta('instavel', 'Instabilidade cardiovascular?'),
    pergunta('inconsciente', 'Inconsciente?'),
    pergunta('betabloqueador', 'Em uso de betabloqueador?', 'Sem resposta fica como não sei.'),
  ],
  ramos: [
    defRamo('exposicao', 'Exposição a alérgeno', [
      opcaoRamo('conhecido', 'Alérgeno conhecido', 'Para este paciente'),
      opcaoRamo('provavel', 'Alérgeno muito provável', 'Para este paciente'),
      opcaoRamo('sem', 'Sem exposição identificada', 'Vale só o critério 1'),
    ]),
  ],
  exames: [
    defExame('adrenalina', 'Janela da repetição', 'Hora de reavaliar a adrenalina'),
  ],
  graficos: [
    defGrafico('pas', 'PA sistólica', ['pas'], {}),
  ],
  avaliar(e, agora) { return avaliar(motorAnafilaxia, e, agora); },
};

function avaliar(p, e, agora) {
  const o = orientacoes();

  const marcados = p.triagem.filter((q) => resposta(e, q.chave) === true).map((q) => avisosTriagem[q.chave] ?? q.texto);
  if (marcados.length) { o.foraDeEscopo = marcados; return o; }
  o.triagemCompleta = p.triagem.every((q) => resposta(e, q.chave) !== null);
  if (!o.triagemCompleta) return o;

  const c1 = criterio1(e), c2 = criterio2(e);
  const cumprido = c1 === 'sim' || c2 === 'sim';
  o.confirmacao = painelCriterios('Critérios de anafilaxia', [
    criterio('c1', 'Critério 1: início agudo, pele ou mucosa, e respiratório, PA ou órgão, ou gastrointestinal grave', c1, c1 === 'sim' ? 'Preenchido' : 'Não preenchido'),
    criterio('c2', 'Critério 2: início agudo, alérgeno conhecido ou muito provável, e hipotensão, broncoespasmo ou laringe', c2, c2 === 'sim' ? 'Preenchido' : 'Não preenchido'),
  ], cumprido, R.r01,
  acaoProposta('anafilaxia.confirmada', cumprido ? 'Confirmo: tratar como anafilaxia' : 'Seguir sem critérios preenchidos'));
  if (cumprido) {
    o.classificacao = 'Anafilaxia muito provável';
    o.classificacaoRegra = c1 === 'sim' ? R.r01 : R.r02;
  } else if (c1 === 'falta' || c2 === 'falta') {
    o.classificacao = 'Critérios incompletos: falta dado';
    o.classificacaoDetalhe = 'A adrenalina continua a critério do médico.';
    o.classificacaoRegra = R.r07;
  } else {
    o.classificacao = 'Não preenche os critérios';
    const soPele = resposta(e, 'pele') === true && c1 === 'nao';
    o.classificacaoDetalhe = soPele ? 'Só pele ou mucosa: a evolução pode mudar. A adrenalina é decisão do médico.' : 'Diferenciais: asma aguda, síncope, escombroidose, crise de pânico, disfunção de corda vocal, entre outros. A adrenalina continua a critério do médico.';
    o.classificacaoRegra = soPele ? R.r06 : R.rDiferenciais;
  }
  if (!cumprido && resposta(e, 'imunoterapia') === true) {
    o.classificacaoDetalhe = 'Reação durante imunoterapia: os critérios não impedem tratar como anafilaxia desde o início.';
    o.classificacaoRegra = R.r08;
  }
  if (!teveAcao(e, 'anafilaxia.confirmada')) return o;

  const doses = horasDoses(e);
  const ultima = doses.length ? doses[doses.length - 1] : null;
  const n = doses.length;
  const resp = ultima !== null ? respostaDepois(e, ultima) : null;
  const ruim = resp === 'persiste' || resp === 'piorou';
  const hip = hipotensao(e);
  const peso = valor(e, 'peso');

  /* Cronômetro: parte da última dose; não dispara dose, só marca a janela. */
  if (ultima !== null) {
    const s = desde(agora, ultima);
    let sub = `${n === 1 ? '1 dose' : `${n} doses`}. `;
    if (resp === 'resolveu') sub += 'Sintomas resolvidos.';
    else if (s < 300) sub += 'Repetição a partir de ' + hora(mais(ultima, 300)) + '.';
    else if (s < 900) sub += 'Janela aberta até ' + hora(mais(ultima, 900)) + '.';
    else sub += 'Fim da janela: reavaliar agora.';
    o.cronometro = cronometroSessao('Desde a última adrenalina', ultima, sub, [
      marcoCronometro(5, 'Repetição permitida se sem melhora'),
      marcoCronometro(15, 'Fim da janela da fonte: reavaliar agora'),
    ], R.r13);
    const d = p.exames[0];
    o.exames = [exameDevido({ id: d.id, nome: d.nome, aviso: d.aviso, destaque: d.destaque, ultima, janelaInicio: mais(ultima, 300), proxima: mais(ultima, 900),
      situacao: resp === 'resolveu' ? 'encerrado' : (s >= 900 ? 'vencido' : 'noPrazo'), regra: R.r13 })];
    if (resp !== 'resolveu' && s >= 900) {
      o.alertas.push(alerta('fimJanela', 'vermelho', 'Passou o fim da janela da fonte desde a última adrenalina: reavaliar agora. Sem regra para depois disso; a decisão é do médico.', juntar(R.r13, R.rSemJanela)));
    }
    if (ruim && n >= 2) {
      o.alertas.push(alerta('infusao', 'vermelho', `Persistem sintomas após ${n} doses. A fonte prevê adrenalina IV em bomba para reação refratária à IM, sem dose nem diluição. Decisão do médico.`, juntar(R.rInfusao, R.r14)));
    }
    if (ruim) {
      const bb = resposta(e, 'betabloqueador');
      o.alertas.push(alerta('glucagon', 'amarelo', (bb === true ? 'Em uso de betabloqueador. ' : bb === null ? 'Betabloqueador não informado. ' : '') + 'Resposta ruim à adrenalina: glucagon parenteral pode ser usado, com evidência muito limitada. A fonte não traz dose.', R.r24));
    }
    o.alertas.push(alerta('observacao', 'amarelo', 'Observar todo paciente tratado, em especial reação grave ou com várias doses de adrenalina. A fonte não define por quanto tempo: decisão do médico.', R.r27));
  }
  if (peso !== null && peso < 10) {
    o.alertas.push(alerta('lactente', 'amarelo', 'Menos de 10 kg: o volume da dose é muito pequeno. A fonte não dá dose mínima.', R.rLactente));
  }
  if (resposta(e, 'gestante') === true) {
    o.alertas.push(alerta('gestante', 'amarelo', 'Gestante: mesma fórmula de dose. A fonte não discute a dose na gravidez.', R.rGestante));
  }

  o.cartoes.push(cartaoAdrenalina(e, agora, ultima, n, resp, cumprido));
  o.cartoes.push(cartaoPrimeirosPassos(e));
  o.cartoes.push(cartaoPosicao(e, hip));
  o.cartoes.push(cartaoOxigenio(e, n));
  o.cartoes.push(cartaoAcesso(e));
  o.cartoes.push(cartaoVolume(e, hip, peso));
  o.cartoes.push(cartaoBroncoespasmo(e));
  o.cartoes.push(cartaoLaringe(e));
  if (n >= 1 && resposta(e, 'pele') === true) o.cartoes.push(cartaoAntiH1());
  o.cartoes.push(cartaoMonitorizacao());
  o.cartoes.push(cartaoTriptase(e));
  o.cartoes.push(cartaoCorticoide());

  /* Depois de resolver: observação e alta. */
  const resolvido = resp === 'resolveu';
  const confirmada = teveAcao(e, 'resolucao.confirmada');
  o.resolucao = painelCriterios('Resolução', [
    criterio('dose', 'Adrenalina registrada', n >= 1 ? 'sim' : 'falta', n >= 1 ? `${n} ${n === 1 ? 'dose' : 'doses'}` : null),
    criterio('sintomas', 'Sintomas resolveram depois da última dose', resp === null ? 'falta' : (resolvido ? 'sim' : 'nao'),
      resp !== null ? (resp === 'resolveu' ? 'Resolveram' : (resp === 'persiste' ? 'Persistem' : 'Pioraram')) : null),
  ], n >= 1 && resolvido, R.r13,
  n >= 1 && resolvido && !confirmada ? acaoProposta('resolucao.confirmada', 'Confirmo a resolução') : null,
  confirmada ? 'Resolução confirmada pelo médico. Duração da observação: a fonte não define.' : null);
  if (confirmada) o.etapasFinais = [cartaoAlta(e)];
  return o;
}

function cartaoAdrenalina(e, agora, ultima, n, resp, cumprido) {
  const c = cartao('adrenalina', 'Adrenalina IM', 'syringe.fill', 0xB91C1C, 'faltaDado', 'Falta peso');
  c.noTopo = true;
  c.regras = [juntar(R.r10, R.r11)];
  const peso = valor(e, 'peso'), idade = valor(e, 'idade');
  const dose = doseAdrenalina(peso, idade);
  if (dose !== null) {
    c.doses = { mg: dose.mg, mL: dose.mg };
    const d = num(dose.mg);
    if (dose.porPeso && peso !== null) {
      const est = resposta(e, 'pesoEstimado') === true ? ' estimados' : '';
      c.conta = `0,01 mg x ${num(peso, 1)} kg${est}, teto 0,5 mg. ${d} mL a 1 mg/mL`;
    } else {
      c.conta = `Sem peso: faixa etária, ${d} mL a 1 mg/mL`;
      c.regras = [juntar(R.r12, R.r11)];
    }
  }
  const doseTexto = dose !== null ? num(dose.mg) + ' mg' : null;
  const registrar = dose !== null ? acao('adrenalina.dose', `Confirmar dose de ${num(dose.mg)} mg`, { mg: dose.mg, mL: dose.mg }) : null;

  if (ultima === null) {
    if (doseTexto === null || registrar === null) {
      c.detalhe = idade !== null ? 'Lactente: a dose depende do peso.' : 'Sem peso nem idade não há dose. Digite em Novos resultados.';
      return c;
    }
    c.valor = doseTexto;
    c.acoes = [registrar];
    if (cumprido) {
      c.situacao = 'proximoPasso';
      c.liberado = true;
      c.detalhe = 'No vasto lateral, face anterolateral da coxa. A via IV não é recomendada no tratamento inicial.';
    } else {
      c.situacao = 'decisaoMedico';
      c.detalhe = 'Os critérios não estão preenchidos. A adrenalina pode ser dada por julgamento clínico; a sessão não bloqueia.';
      c.regras = [R.r07, ...c.regras];
    }
    if (!(dose?.porPeso ?? true)) c.detalhe = (c.detalhe ?? '') + ' Tabela por idade é simplificação, com lacunas de faixa.';
    return c;
  }

  /* Já houve dose. A repetição nunca aparece antes dos 5 min. */
  const s = desde(agora, ultima);
  c.regras = [R.r13, ...c.regras];
  c.valor = doseTexto !== null ? `Última dose às ${hora(ultima)}. Próxima: ${doseTexto}` : `Última dose às ${hora(ultima)}`;
  const respostas = [acao('evolucao.resolveu', 'Sintomas resolveram'), acao('evolucao.persiste', 'Sintomas persistem'), acao('evolucao.piorou', 'Piorou')];
  if (resp === 'resolveu') {
    c.situacao = 'correndo';
    c.etiqueta = 'Em observação';
    c.valor = 'Sintomas resolvidos';
    c.conta = `Última dose às ${hora(ultima)}. ${n} ${n === 1 ? 'dose' : 'doses'}`;
    c.acoes = [acaoProposta('evolucao.persiste', 'Os sintomas voltaram', {}, true)];
  } else if (resp === null) {
    if (s < 300) {
      c.situacao = 'correndo';
      c.detalhe = `Repetição a partir de ${hora(mais(ultima, 300))}.`;
      c.acoes = [acaoProposta('evolucao.resolveu', 'Sintomas resolveram', {}, true)];
    } else {
      c.situacao = 'pergunta';
      c.detalhe = s < 900 ? `Janela aberta até ${hora(mais(ultima, 900))}. Como está a resposta?` : 'Passou o fim da janela. Como está a resposta?';
      c.acoes = respostas;
    }
  } else {
    const texto = resp === 'piorou' ? 'Piorou' : 'Sintomas persistem';
    if (s < 300) {
      c.situacao = 'correndo';
      c.detalhe = `${texto}. Repetição a partir de ${hora(mais(ultima, 300))}.`;
    } else if (registrar !== null) {
      c.situacao = s < 900 ? 'proximoPasso' : 'decisaoMedico';
      c.liberado = s < 900;
      c.detalhe = s < 900 ? `${texto}. Repetição permitida: a fonte manda repetir a cada 5 a 15 min.` : `${texto}. Passou o fim da janela da fonte e não há regra para depois. Decisão do médico.`;
      c.acoes = [registrar, acaoProposta('evolucao.resolveu', 'Sintomas resolveram', {}, true)];
    } else {
      c.situacao = 'faltaDado';
      c.detalhe = `${texto}. Falta peso para a dose.`;
    }
  }
  return c;
}

function cartaoPrimeirosPassos(e) {
  const c = cartao('primeiros', 'Primeiros passos', 'list.bullet.clipboard.fill', 0x0F7F74, 'proximoPasso', 'Gatilho, ABC, ajuda');
  c.regras = [R.r09];
  const h = ultimaAcao(e, 'primeiros.feitos')?.hora ?? null;
  if (h !== null) {
    c.situacao = 'semIndicacao';
    c.valor = 'Feitos às ' + hora(h);
    return c;
  }
  c.detalhe = 'Retirar o gatilho se possível. Avaliar via aérea, respiração, circulação, estado mental e pele. Pedir ajuda.';
  c.acoes = [acao('primeiros.feitos', 'Confirmar primeiros passos')];
  return c;
}

function cartaoPosicao(e, hip) {
  const c = cartao('posicao', 'Posição', 'figure.stand', 0x6D3FD6, 'pergunta', 'Dificuldade respiratória?');
  c.regras = [R.r15, R.r16];
  const resp = resposta(e, 'respiratorio');
  if (resp === null) {
    c.pergunta = perguntaCartao('respiratorio', 'Há dificuldade respiratória?');
    return c;
  }
  const incons = resposta(e, 'inconsciente');
  if (incons === null) {
    c.valor = 'Inconsciente?';
    c.pergunta = perguntaCartao('inconsciente', 'Está inconsciente?');
    return c;
  }
  const gest = resposta(e, 'gestante');
  if (gest === null) {
    c.valor = 'Gestante?';
    c.pergunta = perguntaCartao('gestante', 'É gestante?');
    return c;
  }
  const pos = [];
  if (resp) pos.push('Sentado pode ajudar a respirar');
  if (gest) pos.push('Gestante: semirreclinada para o lado esquerdo');
  if (incons) pos.push('Inconsciente: posição de recuperação');
  if (!pos.length) pos.push('Decúbito dorsal');
  c.valor = pos[0];
  if (pos.length > 1) c.valor = pos.join('. ');
  /* Mais de uma condição, ou dispneia com hipotensão: a fonte não diz qual prevalece. */
  if (pos.length > 1 || (resp && hip === 'sim')) {
    c.situacao = 'decisaoMedico';
    c.detalhe = 'A fonte não diz qual prevalece quando há mais de uma condição, nem com dispneia e hipotensão juntas.';
  } else {
    c.situacao = 'correndo';
    c.etiqueta = 'Orientação da fonte';
    c.regras = [resp || gest || incons ? R.r16 : R.r15];
    if (!(resp || gest || incons)) c.detalhe = 'Elevação das pernas é controversa; a fonte não a impõe.';
  }
  return c;
}

function cartaoOxigenio(e, n) {
  const c = cartao('oxigenio', 'Oxigênio', 'lungs.fill', 0x1F5FD1, 'pergunta', 'Dificuldade respiratória?');
  c.regras = [R.r17];
  const h = ultimaAcao(e, 'oxigenio.inicio')?.hora ?? null;
  if (h !== null) {
    c.situacao = 'correndo';
    c.valor = 'Em curso desde ' + hora(h);
    return c;
  }
  const resp = resposta(e, 'respiratorio');
  if (resp === true || n >= 2) {
    c.situacao = 'proximoPasso';
    c.liberado = true;
    c.valor = 'Alto fluxo';
    c.conta = 'De preferência 100% por máscara com reservatório';
    c.acoes = [acao('oxigenio.inicio', 'Confirmar oxigênio')];
    return c;
  }
  if (resp === null) {
    c.pergunta = perguntaCartao('respiratorio', 'Há dificuldade respiratória?');
    return c;
  }
  c.situacao = 'semIndicacao';
  c.valor = 'Sem indicação pela regra';
  return c;
}

function cartaoAcesso(e) {
  const c = cartao('acesso', 'Acesso venoso', 'cross.vial.fill', 0x0E7C94, 'proximoPasso', 'Cateter calibroso');
  c.regras = [R.r18];
  const h = ultimaAcao(e, 'acesso.feito')?.hora ?? null;
  if (h !== null) {
    c.situacao = 'semIndicacao';
    c.valor = 'Registrado às ' + hora(h);
    return c;
  }
  c.conta = '14 ou 16 G no adulto';
  c.acoes = [acao('acesso.feito', 'Confirmar acesso venoso')];
  return c;
}

function cartaoVolume(e, hip, peso) {
  const c = cartao('volume', 'Volume', 'drop.fill', 0x1F5FD1, 'pergunta', 'Instabilidade?');
  c.regras = [juntar(R.r19, R.rVolumeSem)];
  const inst = resposta(e, 'instavel');
  if (hip === 'sim' || inst === true) {
    if (peso === null) {
      c.situacao = 'faltaDado';
      c.valor = 'Falta peso';
      c.detalhe = 'O bólus é de 20 mL/kg.';
      return c;
    }
    const ml = 20 * peso;
    c.liberado = true;
    c.doses = { mlKg: 20, mL: ml };
    c.conta = `20 mL/kg x ${num(peso, 1)} kg`;
    c.valor = `Cristaloide ${num(ml, 0)} mL em bólus`;
    const registro = acaoProposta('volume.bolus', `Confirmar bólus de ${num(ml, 0)} mL`, { mL: ml });
    const h = ultimaAcao(e, 'volume.bolus')?.hora ?? null;
    if (h !== null) {
      c.situacao = 'decisaoMedico';
      c.detalhe = `Último bólus às ${hora(h)}. A fonte não traz regra de repetição, teto nem tipo de cristaloide.`;
      c.acoes = [acaoProposta('volume.bolus', `Registrar novo bólus de ${num(ml, 0)} mL`, { mL: ml }, true)];
    } else {
      c.situacao = 'proximoPasso';
      c.detalhe = 'A fonte não traz teto nem tipo de cristaloide.';
      c.acoes = [registro];
    }
    return c;
  }
  if (hip === 'falta' && inst !== false) {
    c.detalhe = 'Sem PA e idade, a regra não sabe se há hipotensão.';
    c.pergunta = perguntaCartao('instavel', 'Há instabilidade cardiovascular?');
    return c;
  }
  if (inst === null) {
    c.situacao = 'semIndicacao';
    c.valor = 'Sem hipotensão pela regra';
    c.detalhe = 'Instabilidade por julgamento clínico entra em Novos resultados.';
    return c;
  }
  c.situacao = 'semIndicacao';
  c.valor = 'Sem instabilidade marcada';
  return c;
}

function cartaoBroncoespasmo(e) {
  const c = cartao('bronco', 'Broncoespasmo', 'wind', 0x0F7F74, 'pergunta', 'Sibilo ou broncoconstrição?');
  c.regras = [R.r20];
  const b = resposta(e, 'bronco');
  if (b === null) {
    c.pergunta = perguntaCartao('bronco', 'Há sibilo ou broncoconstrição?');
    c.discreto = true;
    return c;
  }
  if (!b) {
    c.situacao = 'semIndicacao';
    c.valor = 'Não marcado';
    return c;
  }
  const h = ultimaAcao(e, 'beta2.dado')?.hora ?? null;
  if (h !== null) {
    c.situacao = 'correndo';
    c.valor = 'Beta-2 registrado às ' + hora(h);
    c.detalhe = 'Não substitui nova dose de adrenalina IM se os sintomas continuam.';
    return c;
  }
  c.situacao = 'proximoPasso';
  c.liberado = true;
  c.valor = 'Beta-2 agonista inalatório';
  c.conta = 'Salbutamol ou albuterol. A fonte não traz dose';
  c.detalhe = 'Não substitui nova dose de adrenalina IM se os sintomas continuam.';
  c.acoes = [acao('beta2.dado', 'Registrar beta-2 inalatório')];
  return c;
}

function cartaoLaringe(e) {
  const c = cartao('laringe', 'Via aérea alta', 'waveform.path', 0xA8530A, 'pergunta', 'Estridor ou edema de laringe?');
  c.regras = [R.r21];
  const l = resposta(e, 'laringe');
  if (l === null) {
    c.pergunta = perguntaCartao('laringe', 'Há estridor ou edema de laringe?');
    c.discreto = true;
    return c;
  }
  if (!l) {
    c.situacao = 'semIndicacao';
    c.valor = 'Não marcada';
    return c;
  }
  c.situacao = 'decisaoMedico';
  c.valor = 'Considerar adrenalina nebulizada';
  c.conta = 'A fonte não traz dose';
  return c;
}

function cartaoAntiH1() {
  const c = cartao('antiH1', 'Anti-H1', 'pills.fill', 0xA8327E, 'decisaoMedico', 'Só alívio de pele');
  c.regras = [R.r22];
  c.conta = 'A fonte não traz dose';
  c.detalhe = 'Papel limitado. Pode atrasar a adrenalina repetida. A infusão IV rápida pode causar hipotensão.';
  c.discreto = true;
  return c;
}

function cartaoMonitorizacao() {
  const c = cartao('monitorizacao', 'Monitorização', 'waveform.path.ecg', 0x3451B2, 'correndo', 'Intervalos curtos e regulares');
  c.regras = [R.r25];
  c.detalhe = 'PA, FC, perfusão, estado respiratório e mental. Monitorização invasiva se pertinente.';
  c.discreto = true;
  return c;
}

function cartaoTriptase(e) {
  const c = cartao('triptase', 'Triptase', 'testtube.2', 0x0E7C94, 'decisaoMedico', 'Dúvida ou investigação');
  c.etiqueta = 'Opcional';
  c.regras = [R.r26];
  const h = ultimaAcao(e, 'triptase.coleta')?.hora ?? null;
  if (h !== null) {
    c.situacao = 'semIndicacao';
    c.etiqueta = null;
    c.valor = 'Coleta registrada às ' + hora(h);
    return c;
  }
  c.detalhe = 'Pico entre 1 e 2 h do início; normal não exclui anafilaxia. A sessão só registra o horário.';
  c.acoes = [acao('triptase.coleta', 'Registrar coleta de triptase')];
  c.discreto = true;
  return c;
}

function cartaoCorticoide() {
  const c = cartao('corticoide', 'Corticoide', 'nosign', 0x6B7280, 'semIndicacao', 'Não oferecido');
  c.detalhe = 'Evidência de nenhum benefício agudo e possível dano.';
  c.regras = [R.r23];
  return c;
}

function cartaoAlta(e) {
  const c = cartao('alta', 'Antes da alta', 'checklist', 0x3451B2, 'proximoPasso', 'Lista de conferência');
  c.regras = [R.r28];
  const h = ultimaAcao(e, 'alta.conferida')?.hora ?? null;
  if (h !== null) {
    c.situacao = 'semIndicacao';
    c.valor = 'Conferida às ' + hora(h);
    return c;
  }
  c.detalhe = [
    'Autoinjetor de adrenalina, um ou mais; sem acesso, seringa pré-carregada ou ampola com seringa e treino.',
    'Plano de ação escrito, com repetição pelo paciente.',
    'Alerta médico: pulseira ou cartão.',
    'Registrar o gatilho suspeito.',
    'Encaminhar ao alergista.',
    'Reavaliar asma e doença cardiovascular mal controladas.',
    'Seguimento.',
  ].join('\n');
  c.acoes = [acao('alta.conferida', 'Registrar lista conferida')];
  return c;
}

/* Para o teste diferencial (Ponte.swift, compararFuncao): mesmos argumentos e saída em JSON simples. */
export const funcoesTeste = {
  doseAdrenalina: (peso, idade) => doseAdrenalina(peso, idade),
  hipotensaoCalculada: (pas, idade, basal) => hipotensaoCalculada(pas, idade, basal),
  criterios: (e) => ({ c1: criterio1(e), c2: criterio2(e), hip: hipotensao(e) }),
  horasDoses: (e) => horasDoses(e),
  criterio1: (e) => criterio1(e),
  criterio2: (e) => criterio2(e),
  regra: (nome) => R[nome] ?? null,
};

export const regrasAnafilaxia = R;
export const motorAnafilaxia = criarProtocolo(DEF);
export default motorAnafilaxia;
