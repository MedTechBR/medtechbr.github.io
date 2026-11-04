/* Estado de mal epiléptico convulsivo, só adulto. Porta fiel de MotorEpileptico.swift (app iOS).
   Especificação: docs/sessao_epileptico_regras.md do app (AES 2016, Figura 1; ESETT só para os 10 min de infusão).
   O número de cada regra é a linha do arquivo de regras. Não mudar regra aqui sem mudar no Swift: o teste diferencial reprova. */
import {
  criarProtocolo, defParametro, pergunta, defExame, defGrafico, linhaGrafico, regra,
  orientacoes, cartao, alerta, trava, criterio, painelCriterios, acaoProposta, exameDevido, cronometroSessao, marcoCronometro,
  ultimo, valor, resposta, ultimaAcao, teveAcao, num, hora, desde, mais,
} from './nucleo.js';

/* ÚNICA chave da dose de fenitoína comum. A fonte não traz essa dose: vem do banco do app, aprovada pelo médico em 02/11/2026,
   e sai como "conduta local". Com null, nenhuma dose aparece, só a opção "Fenitoína: dose não definida na diretriz". */
export const fenitoinaCondutaLocal = { mgKg: 20, tetoMg: 1500 };

const avisosTriagem = {
  menor18: 'Menor de 18 anos: nesta versão a sessão é só de adultos. A fonte tem doses próprias para criança.',
  gestante: 'Gestante, puérpera ou eclâmpsia: a fonte não trata. Sem regra na fonte, a sessão não improvisa.',
  naoConvulsivo: 'Sem convulsão: a diretriz trata só do estado de mal convulsivo.',
  intubado: 'Já intubado ou em anestésico contínuo: o tratamento do refratário está fora do escopo da diretriz.',
  causaEspecifica: 'Causa com tratamento específico: a diretriz exclui essa terapia; a sessão cobre só o algoritmo geral.',
};

const R = {
  r01: regra(53, 'R01. Marcar o início da crise e contar o tempo desde ele. As fases mudam em 5, 20, 40 e 60 min, quando a duração atinge cada marca.', 'AES 2016, Figura 1, passo 2; texto'),
  r02: regra(54, 'R02. De 0 a 5 min: estabilizar via aérea, respiração, circulação e déficit neurológico; cronometrar; avaliar oxigenação e dar oxigênio, considerar intubação se precisar de assistência respiratória; ECG contínuo; glicemia capilar; tentar acesso IV e colher eletrólitos, hematologia, toxicologia e nível de anticonvulsivante, se couber.', 'AES 2016, Figura 1, caixa de 0-5 min'),
  r03: regra(55, 'R03. Glicemia abaixo de 60 mg/dL em adulto: tiamina 100 mg IV e depois glicose a 50%, 50 mL IV.', 'AES 2016, Figura 1, passo 5'),
  r06: regra(58, 'R06. Glicemia de 60 mg/dL ou mais: sem passo de glicose.', 'AES 2016, Figura 1, passo 5'),
  r07: regra(59, 'R07. Crise com menos de 5 min: só estabilização e cronômetro. A terapia inicial começa quando a duração atinge 5 min.', 'AES 2016, Recomendações'),
  r08: regra(60, 'R08. De 5 a 20 min, crise continua: benzodiazepínico é a terapia inicial de escolha, nível A. Escolher uma de 3 opções equivalentes: midazolam IM, lorazepam IV ou diazepam IV.', 'AES 2016, Figura 1'),
  r09: regra(61, 'R09. Midazolam IM: 10 mg se mais de 40 kg; 5 mg de 13 a 40 kg; dose única, não repete. Nível A.', 'AES 2016, Figura 1'),
  r10: regra(62, 'R10. Lorazepam IV: 0,1 mg/kg/dose, máximo 4 mg/dose; pode repetir uma vez. Nível A.', 'AES 2016, Figura 1'),
  r11: regra(63, 'R11. Diazepam IV: 0,15 a 0,2 mg/kg/dose, máximo 10 mg/dose; pode repetir uma vez. Nível A. A sessão mostra a faixa e o teto, sem escolher o ponto da faixa.', 'AES 2016, Figura 1'),
  r12: regra(64, 'R12. Dose plena única, não fracionada. Só lorazepam e diazepam repetem, uma vez, em dose plena; as demais terapias iniciais não repetem.', 'AES 2016, Recomendações'),
  r13: regra(65, 'R13. Nenhuma das 3 opções disponível: fenobarbital IV 15 mg/kg/dose, dose única, nível A; diazepam retal 0,2 a 0,5 mg/kg, máximo 20 mg/dose, dose única, nível B; midazolam intranasal ou bucal, nível B, sem dose na figura.', 'AES 2016, Figura 1'),
  r14: regra(66, 'R14. Sem acesso venoso: midazolam IM é uma das 3 equivalentes e, em adultos sem acesso IV estabelecido, mostrou efetividade superior à do lorazepam IV. Nível A.', 'AES 2016, resumo e conclusões Q1'),
  r15: regra(67, 'R15. A resposta deve estar clara até o minuto 20. Crise que continua leva à segunda terapia.', 'AES 2016, texto; Figura 1'),
  r16: regra(68, 'R16. Crise cessou, em qualquer fase: se o paciente está no basal, cuidado médico sintomático. O fluxograma não manda dar segunda linha a quem parou.', 'AES 2016, Figura 1, caixas de basal'),
  r17: regra(69, 'R17. De 20 a 40 min, crise continua: não há segunda linha preferida baseada em evidência. Escolher uma, dose única: fosfenitoína 20 mg PE/kg, máximo 1500 mg PE, nível U; ácido valproico 40 mg/kg, máximo 3000 mg, nível B; levetiracetam 60 mg/kg, máximo 4500 mg, nível U.', 'AES 2016, Figura 1'),
  r18: regra(70, 'R18. Infusão da segunda linha: 10 minutos, em bomba. É o protocolo do ESETT; a diretriz não define velocidade. O ESETT excluiu trauma maior, hiperglicemia, parada cardíaca ou pós-anóxia, hepatopatia, insuficiência renal grave e erro inato do metabolismo: é a população do ensaio, não contraindicação da diretriz.', 'ESETT, Methods'),
  r19: regra(71, 'R19. Nenhuma das 3 de segunda linha disponível: fenobarbital IV 15 mg/kg, se ainda não foi dado. Nível B.', 'AES 2016, Figura 1'),
  r20: regra(72, 'R20. Todas equivalentes, sem preferência. No ESETT, cessação com melhora da responsividade em 47% (levetiracetam), 45% (fosfenitoína) e 46% (valproato) aos 60 min, sem diferença significativa. A sessão não ordena por eficácia.', 'AES 2016, texto; ESETT, Results'),
  r21: regra(73, 'R21. De 40 a 60 min, crise continua: sem evidência clara, nível U. Repetir a segunda linha ou doses anestésicas de tiopental, midazolam, pentobarbital ou propofol, todas com EEG contínuo. A fonte não dá doses.', 'AES 2016, Figura 1'),
  r22: regra(74, 'R22. Mais de 60 min: a figura não tem fase além disso. A diretriz não cobre o refratário.', 'AES 2016, Figura 1; Scope'),
  r23: regra(75, 'R23. Gravidade ou etiologia: o paciente pode passar pelas fases mais rápido ou pular a segunda. Avançar é decisão do médico, com horário registrado.', 'AES 2016, Recomendações'),
  r24: regra(76, 'R24. Em adultos a segunda terapia é menos eficaz que a primeira e a terceira é substancialmente menos eficaz. Nível A.', 'AES 2016, resumo; Q5'),
  r25: regra(77, 'R25. A taxa de depressão respiratória com benzodiazepínico é menor do que com placebo, nível A: a crise não tratada é que compromete a respiração.', 'AES 2016, resumo; texto'),
  r26: regra(78, 'R26. Os tetos de segunda linha são atingidos a partir de 75 kg.', 'AES 2016, Figura 1; ESETT, Discussion'),
  rFenitoina: regra(97, 'Fenitoína comum: o fluxograma só traz fosfenitoína. O texto diz que a fenitoína é alternativa aceitável, mas não dá dose, máximo nem velocidade. Dose mostrada: conduta local do banco do app, aprovada pelo médico em 02/11/2026.', 'Regras, sem regra numérica'),
  rPendente: regra(100, 'Benzodiazepínico ainda não dado e já passou de 20 min: a fonte não diz se volta à fase 1 ou salta para a 2. A sessão mostra os passos pendentes e pede a decisão do médico.', 'Regras, sem regra numérica'),
  rAbaixoPlena: regra(101, 'Dose inicial abaixo da dose plena: a fonte proíbe fracionar e não diz como completar. A sessão alerta e não calcula complemento.', 'Regras, sem regra numérica'),
  rMid13: regra(94, 'Midazolam IM abaixo de 13 kg: a figura não traz dose.', 'Regras, sem regra numérica'),
  rRepetir: regra(93, 'Intervalo para repetir lorazepam ou diazepam: a fonte não dá o tempo. A sessão não impõe intervalo e mostra o horário da primeira dose.', 'Regras, sem regra numérica'),
  rFase3Sem: regra(102, 'Fase 3: doses de anestésicos, alvo de EEG, duração e desmame estão fora da fonte.', 'Regras, sem regra numérica'),
  rDisp: regra(107, 'A sessão esconde a droga marcada como indisponível e não substitui por conta própria.', 'Regras, sem regra numérica'),
  rEscopo: regra(21, 'Menor de 18 anos: fora do escopo desta versão.', 'Escopo da especificação'),
  rSemInicio: regra(35, 'Início da crise: o médico informa há quantos minutos começou. Sem isso, o cronômetro conta da abertura da sessão.', 'Parâmetros da especificação'),
};

/* Doses por dose, em mg. Tetos da Figura 1. */
export const midazolamIM = (p) => (p > 40 ? 10 : (p >= 13 ? 5 : null));
export const lorazepam = (p) => Math.min(0.1 * p, 4);
export const diazepamIV = (p) => ({ min: Math.min(0.15 * p, 10), max: Math.min(0.2 * p, 10) });
export const diazepamRetal = (p) => ({ min: Math.min(0.2 * p, 20), max: Math.min(0.5 * p, 20) });
export const fenobarbital = (p) => 15 * p;
export const fosfenitoina = (p) => Math.min(20 * p, 1500);
export const valproato = (p) => Math.min(40 * p, 3000);
export const levetiracetam = (p) => Math.min(60 * p, 4500);

/* Fase pelo tempo, linha 53: a marca vale no segundo exato em que a duração a atinge. s em segundos. */
export function fase(s) {
  if (s < 300) return 0;
  if (s < 1200) return 1;
  if (s < 2400) return 2;
  if (s < 3600) return 3;
  return 4;
}
export const nomesFase = ['Estabilização: até 5 min', 'Terapia inicial: 5 a 20 min', 'Segunda terapia: 20 a 40 min', 'Terceira fase: 40 a 60 min', 'Além de 60 min: a figura não tem fase'];

export function inicioCrise(e) {
  const m = ultimo(e, 'minCrise');
  if (m) return mais(m.hora, -Math.max(0, m.valor) * 60);
  return e.inicio;
}

/* Ordem das doses, decisão do Matheus de 04/11/2026 (igual ao Swift): por hora; no empate, pela ordem fixa destas listas
   (a da Figura 1) e, dentro da mesma droga, a confirmada na tela antes da digitada, cada uma na ordem em que entrou.
   O estado não guarda ordem de registro entre drogas diferentes, por isso o empate entre drogas vai pela lista. */
const tiposIniciais = [['midazolam', 'dadoMidazolam'], ['lorazepam', 'dadoLorazepam'], ['diazepam', 'dadoDiazepam'], ['fenobarbital', 'dadoFenobarbital'], ['diazepamRetal', ''], ['midazolamNasal', '']];
const tiposSegunda = [['fosfenitoina', 'dadoFosfenitoina'], ['valproato', 'dadoValproato'], ['levetiracetam', 'dadoLevetiracetam'], ['fenitoina', ''], ['fenobarbital', '']];
function doses(e, prefixo, lista) {
  let r = [];
  for (const [droga, serie] of lista) {
    r = r.concat(e.acoes.filter((a) => a.tipo === prefixo + droga).map((a) => ({ droga, hora: a.hora, mg: a.valores.mg ?? null })));
    if (serie !== '') r = r.concat((e.series[serie] ?? []).map((m) => ({ droga, hora: m.hora, mg: m.valor })));
  }
  /* Desempate explícito pela posição na lista montada acima, como o Swift. */
  return r.map((d, i) => [d, i]).sort((a, b) => (a[0].hora !== b[0].hora ? a[0].hora - b[0].hora : a[1] - b[1])).map(([d]) => d);
}
export const dosesIniciais = (e) => doses(e, 'inicial.', tiposIniciais);
export const dosesSegunda = (e) => doses(e, 'segunda.', tiposSegunda);

/* Disponibilidade: só some o que o médico marcou como indisponível; sem marca, a opção aparece. */
export function indisponivel(e, droga) {
  return ultimaAcao(e, 'servico.sem.' + droga, 'servico.tem.' + droga)?.tipo === 'servico.sem.' + droga;
}

/* 'continua' | 'cessou' | 'naoInformado'. A resposta só vale depois da última terapia: passou uma dose, pergunta de novo. */
export function status(e) {
  const hs = [...dosesIniciais(e), ...dosesSegunda(e)].map((d) => d.hora);
  const ultimaTerapia = hs.length ? Math.max(...hs) : null;
  const a = ultimaAcao(e, 'crise.continua', 'crise.cessou');
  if (a !== null) {
    if (a.tipo === 'crise.cessou') return 'cessou';
    if (ultimaTerapia !== null ? a.hora >= ultimaTerapia : true) return 'continua';
    return 'naoInformado';
  }
  if (resposta(e, 'criseContinua') === false) return 'cessou';
  if (resposta(e, 'criseContinua') === true && ultimaTerapia === null) return 'continua';
  return 'naoInformado';
}

const acao = (tipo, rotulo, v = {}, secundaria = false) => acaoProposta(tipo, rotulo, v, secundaria);
const mg = (v) => num(v);
const faixa = (f) => (f.min === f.max ? mg(f.max) + ' mg' : mg(f.min) + ' a ' + mg(f.max) + ' mg');
export function juntar(...r) {
  return regra(r[0].linha, r.map((x) => x.texto).join('\n\n'), r.map((x) => x.origem).join('. '));
}

/* A primeira dose digitada menor que a plena, com o nome da droga. A dose confirmada na tela já sai plena. */
export function abaixoDaPlena(e, p) {
  for (const d of dosesIniciais(e)) {
    if (d.mg === null) continue;
    if (d.droga === 'midazolam') { const plena = midazolamIM(p); if (plena !== null && d.mg < plena) return 'Midazolam'; }
    else if (d.droga === 'lorazepam') { if (d.mg < lorazepam(p)) return 'Lorazepam'; }
    else if (d.droga === 'diazepam') { if (d.mg < diazepamIV(p).min) return 'Diazepam'; }
  }
  return null;
}

function nomeDroga(d) {
  switch (d) {
    case 'midazolam': return 'Midazolam IM';
    case 'lorazepam': return 'Lorazepam IV';
    case 'diazepam': return 'Diazepam IV';
    case 'fenobarbital': return 'Fenobarbital IV';
    case 'diazepamRetal': return 'Diazepam retal';
    case 'midazolamNasal': return 'Midazolam intranasal ou bucal';
    case 'fosfenitoina': return 'Fosfenitoína';
    case 'valproato': return 'Ácido valproico';
    case 'levetiracetam': return 'Levetiracetam';
    case 'fenitoina': return 'Fenitoína';
    default: return d;
  }
}

const DEF = {
  id: 'epileptico',
  nome: 'Estado de mal epiléptico',
  descricao: 'Cronômetro da crise e fases por tempo',
  idConduta: 'epileptico',
  referencia: 'Glauser T et al. Evidence-Based Guideline: Treatment of Convulsive Status Epilepticus in Children and Adults. Epilepsy Currents 2016;16(1):48-61 (doi:10.5698/1535-7597-16.1.48), Figura 1. Infusão de 10 min: Kapur J et al. ESETT. N Engl J Med 2019;381:2103-2113.',
  escopo: 'Adulto com crise convulsiva generalizada de 5 minutos ou mais, ou crises repetidas sem recuperação da consciência.',
  tituloRamos: 'Início da crise',
  rotuloProximoPasso: 'Próximo passo pela diretriz',
  tituloExames: 'Prazos',
  tituloOutrosExames: 'Marcas da crise',
  rotuloPrazoExame: 'marca às',
  tituloResolucao: null,
  parametros: [
    defParametro('minCrise', 'A crise começou há', 'min', 0, 240, 0),
    defParametro('peso', 'Peso', 'kg', 30, 300),
    defParametro('idade', 'Idade', 'anos', 0, 110, 0),
    defParametro('glicemia', 'Glicemia capilar', 'mg/dL', 10, 800, 0),
    defParametro('dadoMidazolam', 'Midazolam já dado', 'mg', 0, 10),
    defParametro('dadoLorazepam', 'Lorazepam já dado', 'mg', 0, 8),
    defParametro('dadoDiazepam', 'Diazepam já dado', 'mg', 0, 20),
    defParametro('dadoFenobarbital', 'Fenobarbital já dado', 'mg', 0, 4500),
    defParametro('dadoFosfenitoina', 'Fosfenitoína já dada', 'mg PE', 0, 1500),
    defParametro('dadoValproato', 'Valproato já dado', 'mg', 0, 3000),
    defParametro('dadoLevetiracetam', 'Levetiracetam já dado', 'mg', 0, 4500),
  ],
  parametrosIniciais: ['minCrise', 'peso', 'idade', 'glicemia'],
  parametrosResultados: ['glicemia', 'minCrise', 'peso', 'idade', 'dadoMidazolam', 'dadoLorazepam', 'dadoDiazepam', 'dadoFenobarbital', 'dadoFosfenitoina', 'dadoValproato', 'dadoLevetiracetam'],
  triagem: [
    pergunta('menor18', 'Menor de 18 anos'),
    pergunta('gestante', 'Gestante, puérpera ou eclâmpsia'),
    pergunta('naoConvulsivo', 'Sem convulsão: não convulsivo, focal, ausência ou mioclônico'),
    pergunta('intubado', 'Já intubado ou em anestésico contínuo'),
    pergunta('causaEspecifica', 'Causa com tratamento específico'),
  ],
  perguntasIniciais: [
    pergunta('criseContinua', 'A crise continua agora?'),
    pergunta('acessoVenoso', 'Tem acesso venoso?'),
  ],
  perguntasAcompanhamento: [
    pergunta('acessoVenoso', 'Tem acesso venoso?'),
  ],
  ramos: [],
  exames: [
    defExame('m5', 'Terapia inicial', 'Hora de reavaliar a crise'),
    defExame('m20', 'Segunda terapia', 'Hora de reavaliar a crise'),
    defExame('m40', 'Terceira fase', 'Hora de reavaliar a crise'),
    defExame('m60', 'Fim das fases da figura', 'Hora de reavaliar a crise'),
    defExame('glicemia', 'Glicemia capilar', 'Hora de medir a glicemia'),
  ],
  graficos: [
    defGrafico('glicemia', 'Glicemia capilar', ['glicemia'], { glicemia: [linhaGrafico(60, '60')] }),
  ],
  avaliar(e, agora) { return avaliar(motorEpileptico, e, agora); },
};

function avaliar(p, e, agora) {
  const o = orientacoes();

  const marcados = p.triagem.filter((q) => resposta(e, q.chave) === true).map((q) => avisosTriagem[q.chave] ?? q.texto);
  if (marcados.length) { o.foraDeEscopo = marcados; return o; }
  o.triagemCompleta = p.triagem.every((q) => resposta(e, q.chave) !== null);
  if (!o.triagemCompleta) return o;

  const peso = valor(e, 'peso'), idade = valor(e, 'idade');
  const temInicio = ultimo(e, 'minCrise') !== null;
  const confirmar = acaoProposta('sessao.confirmada', 'Iniciar o cronômetro');
  const marca = (id, nome, v, uni) => criterio(id, nome, v === null ? 'falta' : 'sim', v !== null ? num(v, 1) + ' ' + uni : null);
  o.confirmacao = painelCriterios('Antes de iniciar', [
    marca('inicio', 'Início da crise informado', valor(e, 'minCrise'), 'min'),
    marca('peso', 'Peso', peso, 'kg'),
    marca('idade', 'Idade', idade, 'anos'),
  ], temInicio && peso !== null && idade !== null, R.r01, confirmar);

  if (idade !== null && idade < 18) {
    o.classificacao = 'Fora do escopo: idade abaixo de 18 anos';
    o.classificacaoRegra = R.rEscopo;
    o.travas = [trava('idade', 'Fora do escopo', `Idade ${num(idade, 0)} anos. A sessão não gera passo automático. Corrija a idade se foi erro de digitação.`, R.rEscopo)];
    return o;
  }

  const inicio = inicioCrise(e);
  const s = desde(agora, inicio);
  const faseTempo = fase(s);
  const paras = e.acoes.filter((a) => a.tipo === 'fase.avancar').map((a) => a.valores.para).filter((x) => x !== undefined && x !== null).map((x) => Math.trunc(x));
  const faseDecisao = paras.length ? Math.max(...paras) : 0;
  const f = Math.max(faseTempo, faseDecisao);
  o.classificacao = nomesFase[f];
  o.classificacaoRegra = R.r01;
  if (!teveAcao(e, 'sessao.confirmada')) return o;

  const st = status(e);
  const iniciais = dosesIniciais(e), segunda = dosesSegunda(e);
  const cessou = st === 'cessou';

  o.cronometro = cronometroSessao('Desde o início da crise', inicio, (cessou ? 'Crise cessada. ' : '') + nomesFase[f] + (faseDecisao > faseTempo ? ', por decisão do médico.' : '.'), [
    marcoCronometro(5, 'Terapia inicial'),
    marcoCronometro(20, 'Segunda terapia'),
    marcoCronometro(40, 'Terceira fase'),
    marcoCronometro(60, 'Fim das fases da figura'),
  ], R.r01);
  o.exames = examesDevidos(p, e, agora, inicio, cessou);

  /* Alertas sem dose. */
  if (!temInicio) {
    o.alertas.push(alerta('semInicio', 'vermelho', 'Início da crise não informado: o cronômetro conta da abertura da sessão. Corrija em Novos resultados.', R.rSemInicio));
  }
  if (!cessou && f >= 2 && !iniciais.length) {
    o.alertas.push(alerta('benzoPendente', 'vermelho', 'Terapia inicial ainda não registrada e já passou da marca de 20 min. A fonte não diz se volta ou salta: os passos pendentes estão abaixo, a decisão é do médico.', R.rPendente));
  }
  if (peso !== null) {
    const baixo = abaixoDaPlena(e, peso);
    if (baixo !== null) o.alertas.push(alerta('abaixoPlena', 'amarelo', `${baixo} abaixo da dose plena. A fonte proíbe fracionar e não diz como completar: a sessão não calcula complemento.`, R.rAbaixoPlena));
  }
  if (s >= 3600 && !cessou) {
    o.alertas.push(alerta('alemDe60', 'vermelho', 'Além de 60 min: a figura não tem fase e a diretriz não cobre o refratário.', R.r22));
  }

  o.cartoes.push(cartaoCrise(e, st, f, faseTempo));
  if (!cessou) o.cartoes.push(cartaoEstabilizacao(e, s));
  o.cartoes.push(cartaoGlicose(e));
  if (!cessou) {
    if (f >= 1) o.cartoes.push(cartaoInicial(e, peso, f, st, iniciais));
    if (f >= 2) o.cartoes.push(cartaoSegunda(e, peso, f, st, segunda, iniciais));
    if (f >= 3) o.cartoes.push(cartaoTerceira(e, f, st));
    if (f >= 1) o.cartoes.push(cartaoServico(e));
  }
  return o;
}

function cartaoCrise(e, st, f, faseTempo) {
  const c = cartao('crise', 'A crise', 'waveform.path.ecg', 0xB91C1C, 'pergunta', 'A crise continua?');
  c.noTopo = true;
  c.regras = [juntar(R.r15, R.r16)];
  if (st === 'naoInformado') {
    c.detalhe = 'Sem resposta, a sessão não libera a próxima terapia.';
    c.acoes = [acao('crise.continua', 'A crise continua'), acao('crise.cessou', 'A crise cessou')];
  } else if (st === 'continua') {
    c.situacao = 'correndo';
    c.valor = 'A crise continua';
    c.acoes = [acao('crise.cessou', 'A crise cessou')];
    /* Linha 75: só avança quem já está nas fases de tratamento. Antes dos 5 min vale a linha 59. */
    if (f === 1 || f === 2) {
      c.acoes.push(acaoProposta('fase.avancar', `Avançar para ${nomesFase[f + 1]}, por gravidade ou etiologia`, { para: f + 1 }, true));
      c.detalhe = 'Gravidade ou etiologia permitem passar mais rápido. Decisão do médico, com horário.';
    }
  } else {
    c.regras = [R.r16];
    const quando = ultimaAcao(e, 'crise.cessou')?.hora ?? null;
    const ub = ultimaAcao(e, 'basal.sim', 'basal.nao');
    const basal = ub !== null && (quando !== null ? ub.hora >= quando : true) ? ub : null;
    c.conta = quando !== null ? 'Cessou às ' + hora(quando) : null;
    if (basal?.tipo === 'basal.sim') {
      c.situacao = 'proximoPasso';
      c.valor = 'Cuidado médico sintomático';
      c.detalhe = 'Paciente no basal. O fluxograma não manda dar segunda linha a quem parou.';
    } else if (basal?.tipo === 'basal.nao') {
      c.situacao = 'decisaoMedico';
      c.valor = 'Parou, mas não voltou ao basal';
      c.detalhe = 'O fluxograma só define o cuidado de quem voltou ao basal. Sem critério numérico para resposta: decisão clínica.';
    } else {
      c.valor = 'Voltou ao basal?';
      c.acoes = [acao('basal.sim', 'Voltou ao basal'), acao('basal.nao', 'Não voltou ao basal')];
    }
    c.acoes.push(acaoProposta('crise.continua', 'A crise voltou', {}, true));
  }
  return c;
}

function cartaoEstabilizacao(e, s) {
  const c = cartao('estabilizacao', 'Estabilização', 'list.bullet.clipboard.fill', 0x0F7F74, 'proximoPasso', 'Via aérea, oxigênio, ECG, glicemia, acesso');
  c.regras = [R.r02];
  const h = ultimaAcao(e, 'estabilizacao.feita')?.hora ?? null;
  if (h !== null) {
    c.situacao = 'semIndicacao';
    c.valor = 'Feita às ' + hora(h);
    return c;
  }
  c.detalhe = 'Via aérea, respiração, circulação, déficit neurológico.\n'
    + 'Oxigênio por cateter ou máscara; considerar intubação se precisar de assistência respiratória.\n'
    + 'ECG contínuo. Glicemia capilar.\n'
    + 'Acesso IV; colher eletrólitos, hematologia, toxicologia e nível de anticonvulsivante, se couber.';
  if (s < 300) c.conta = 'Terapia inicial só aos 5 min';
  c.acoes = [acao('estabilizacao.feita', 'Confirmar estabilização')];
  return c;
}

function cartaoGlicose(e) {
  const c = cartao('glicose', 'Glicose', 'cube.fill', 0xA8530A, 'faltaDado', 'Falta glicemia capilar');
  c.regras = [R.r03, R.r06];
  const g = ultimo(e, 'glicemia');
  if (g === null) return c;
  c.conta = `Glicemia ${num(g.valor, 0)} mg/dL às ` + hora(g.hora);
  if (g.valor < 60) {
    c.liberado = true;
    c.doses = { tiaminaMg: 100, glicose50mL: 50 };
    c.regras = [R.r03];
    const d = ultimaAcao(e, 'glicose.dada');
    if (d !== null && d.hora >= g.hora) {
      c.situacao = 'correndo';
      c.valor = 'Tiamina e glicose às ' + hora(d.hora);
    } else {
      c.situacao = 'proximoPasso';
      c.valor = 'Tiamina 100 mg IV e depois glicose a 50%, 50 mL IV';
      c.acoes = [acao('glicose.dada', 'Confirmar tiamina e depois glicose', { tiaminaMg: 100, glicose50mL: 50 })];
    }
  } else {
    c.situacao = 'semIndicacao';
    c.valor = 'Sem passo de glicose';
    c.regras = [R.r06];
  }
  return c;
}

function cartaoInicial(e, peso, f, st, ds) {
  const c = cartao('inicial', 'Terapia inicial', 'syringe.fill', 0xB91C1C, 'faltaDado', 'Falta peso');
  c.noTopo = f === 1;
  c.regras = [juntar(R.r08, R.r12, R.r25)];

  if (ds.length) {
    const primeira = ds[0];
    const repetivel = primeira.droga === 'lorazepam' || primeira.droga === 'diazepam';
    c.conta = `${nomeDroga(primeira.droga)} às ${hora(primeira.hora)}` + (ds.length > 1 ? `. ${ds.length} doses` : '');
    if (repetivel && ds.length === 1 && f === 1) {
      if (st !== 'continua') {
        c.situacao = 'pergunta';
        c.valor = 'Confirme se a crise continua';
        c.detalhe = 'A repetição só é mostrada com a crise continuando.';
        return c;
      }
      if (peso === null) { c.detalhe = 'A repetição é em dose plena, por kg.'; return c; }
      const p = peso;
      c.situacao = 'proximoPasso';
      c.liberado = true;
      c.valor = 'Pode repetir uma vez';
      c.detalhe = `Dose plena. A fonte não dá intervalo; primeira dose às ${hora(primeira.hora)}.`;
      c.regras = [juntar(R.r12, R.rRepetir)];
      if (primeira.droga === 'lorazepam') {
        const m = lorazepam(p);
        c.doses = { lorazepam: m };
        c.acoes = [acao('inicial.lorazepam', `Confirmar 2ª dose de lorazepam: ${mg(m)} mg`, { mg: m })];
      } else {
        const fx = diazepamIV(p);
        c.doses = { diazepamMin: fx.min, diazepamMax: fx.max };
        c.acoes = [acao('inicial.diazepam', `Confirmar 2ª dose de diazepam: ${faixa(fx)}`, { mgMin: fx.min, mgMax: fx.max })];
      }
      return c;
    }
    c.situacao = 'correndo';
    c.valor = 'Terapia inicial dada';
    const clara = f === 1 ? ' A resposta deve estar clara até o minuto 20.' : '';
    c.detalhe = repetivel ? (ds.length >= 2 ? 'As duas doses que a fonte permite.' : (f === 1 ? 'A resposta deve estar clara até o minuto 20.' : 'Marca de 20 min passou.')) : 'Esta opção não repete.' + clara;
    c.regras = [juntar(R.r12, R.r15)];
    return c;
  }

  /* Nada dado ainda. */
  if (st === 'naoInformado') {
    c.situacao = 'pergunta';
    c.valor = 'Confirme se a crise continua';
    return c;
  }
  if (peso === null) {
    c.detalhe = 'As doses são por kg. Digite o peso em Novos resultados.';
    return c;
  }
  const p = peso;
  c.situacao = f === 1 ? 'proximoPasso' : 'decisaoMedico';
  c.liberado = true;
  const acoes = [];
  const d = [];
  let regras = [R.r08, R.r12, R.r25];
  if (!indisponivel(e, 'midazolam')) {
    const m = midazolamIM(p);
    if (m !== null) {
      c.doses.midazolam = m;
      acoes.push(acao('inicial.midazolam', `Midazolam IM: ${mg(m)} mg, dose única`, { mg: m }));
    } else {
      d.push('Midazolam IM abaixo de 13 kg: a figura não traz dose.');
      regras.push(R.rMid13);
    }
  }
  if (!indisponivel(e, 'lorazepam')) {
    const m = lorazepam(p);
    c.doses.lorazepam = m;
    acoes.push(acao('inicial.lorazepam', `Lorazepam IV: ${mg(m)} mg`, { mg: m }));
  }
  if (!indisponivel(e, 'diazepam')) {
    const fx = diazepamIV(p);
    c.doses.diazepamMin = fx.min;
    c.doses.diazepamMax = fx.max;
    acoes.push(acao('inicial.diazepam', `Diazepam IV: ${faixa(fx)}`, { mgMin: fx.min, mgMax: fx.max }));
  }
  if (indisponivel(e, 'midazolam') && indisponivel(e, 'lorazepam') && indisponivel(e, 'diazepam')) {
    /* Linha 65: só quando nenhuma das 3 está disponível. */
    c.valor = 'Nenhuma das 3: escolha uma destas';
    regras = [R.r13, R.rDisp];
    if (!indisponivel(e, 'fenobarbital')) {
      const m = fenobarbital(p);
      c.doses.fenobarbital = m;
      acoes.push(acao('inicial.fenobarbital', `Fenobarbital IV: ${mg(m)} mg, dose única`, { mg: m }));
    }
    const fx = diazepamRetal(p);
    c.doses.retalMin = fx.min;
    c.doses.retalMax = fx.max;
    acoes.push(acao('inicial.diazepamRetal', `Diazepam retal: ${faixa(fx)}, dose única`, { mgMin: fx.min, mgMax: fx.max }));
    acoes.push(acao('inicial.midazolamNasal', 'Midazolam intranasal ou bucal: sem dose na figura'));
  } else {
    c.valor = 'Escolha uma, dose plena';
    d.push('As opções são equivalentes. A dose não é fracionada.');
    if (resposta(e, 'acessoVenoso') === false) {
      d.push('Sem acesso venoso: em adultos, o midazolam IM mostrou efetividade superior à do lorazepam IV.');
      regras.unshift(R.r14);
    }
    d.push('A depressão respiratória é menor com benzodiazepínico do que com placebo.');
  }
  if (f >= 2) d.unshift('Marca de 20 min passou sem terapia inicial: a fonte não diz se volta ou salta. Decisão do médico.');
  c.detalhe = d.join(' ');
  c.regras = [regras.slice(1).reduce((a, b) => juntar(a, b), regras[0])];
  c.acoes = acoes;
  return c;
}

function cartaoSegunda(e, peso, f, st, ds, iniciais) {
  const c = cartao('segunda', 'Segunda terapia', 'cross.vial.fill', 0x6D3FD6, 'faltaDado', 'Falta peso');
  c.noTopo = f >= 2 && !ds.length;
  c.regras = [juntar(R.r17, R.r18, R.r20, R.r24, R.r26)];
  if (ds.length) {
    const d = ds[0];
    c.situacao = 'correndo';
    c.valor = `${nomeDroga(d.droga)} às ${hora(d.hora)}`;
    c.detalhe = d.droga === 'fenitoina' ? (fenitoinaCondutaLocal === null ? 'Registrada sem dose: dose não definida na diretriz. Decisão do médico.' : 'Conduta local, não é da diretriz. Até 50 mg/min.') : (f === 2 ? 'Dose única. Próxima marca: 40 min.' : 'Dose única.');
    return c;
  }
  if (st !== 'continua') {
    c.situacao = 'pergunta';
    c.valor = 'Confirme se a crise continua';
    c.detalhe = 'A segunda terapia é para crise que continua.';
    return c;
  }
  if (peso === null) {
    c.detalhe = 'As doses são por kg. Digite o peso em Novos resultados.';
    return c;
  }
  const p = peso;
  /* Sem terapia inicial registrada, os dois passos ficam pendentes e a decisão é do médico (linha 100). */
  c.situacao = f === 2 && iniciais.length ? 'proximoPasso' : 'decisaoMedico';
  c.liberado = true;
  c.valor = 'Escolha uma, dose única';
  const acoes = [];
  if (!indisponivel(e, 'fosfenitoina')) {
    const m = fosfenitoina(p);
    c.doses.fosfenitoina = m;
    acoes.push(acao('segunda.fosfenitoina', `Fosfenitoína: ${mg(m)} mg PE. Nível U`, { mg: m }));
  }
  if (!indisponivel(e, 'valproato')) {
    const m = valproato(p);
    c.doses.valproato = m;
    acoes.push(acao('segunda.valproato', `Ácido valproico: ${mg(m)} mg. Nível B`, { mg: m }));
  }
  if (!indisponivel(e, 'levetiracetam')) {
    const m = levetiracetam(p);
    c.doses.levetiracetam = m;
    acoes.push(acao('segunda.levetiracetam', `Levetiracetam: ${mg(m)} mg. Nível U`, { mg: m }));
  }
  if (!acoes.length) {
    /* Linha 71: fenobarbital só se nenhuma das 3 está disponível e ele ainda não foi dado. */
    c.regras = [juntar(R.r19, R.rDisp)];
    if (iniciais.some((x) => x.droga === 'fenobarbital') || indisponivel(e, 'fenobarbital')) {
      c.situacao = 'decisaoMedico';
      c.liberado = false;
      c.valor = 'Sem opção de segunda linha';
      c.detalhe = 'Nenhuma das 3 disponível, e fenobarbital já dado ou indisponível. Decisão do médico.';
    } else {
      const m = fenobarbital(p);
      c.doses.fenobarbital = m;
      c.valor = 'Nenhuma das 3: fenobarbital';
      acoes.push(acao('segunda.fenobarbital', `Fenobarbital IV: ${mg(m)} mg. Nível B`, { mg: m }));
    }
  } else {
    c.detalhe = 'Sem preferência baseada em evidência; a lista não ordena por eficácia. Infusão em 10 min, em bomba: protocolo do ESETT, a diretriz não define velocidade. A segunda terapia é menos eficaz que a primeira.';
    if (p >= 75) c.conta = 'Tetos de dose atingidos a partir de 75 kg';
  }
  if (fenitoinaCondutaLocal !== null) {
    const fl = fenitoinaCondutaLocal;
    const m = Math.min(fl.mgKg * p, fl.tetoMg);
    c.doses.fenitoina = m;
    acoes.push(acao('segunda.fenitoina', `Fenitoína, conduta local: ${mg(m)} mg, até 50 mg/min`, { mg: m }));
  } else {
    acoes.push(acaoProposta('segunda.fenitoina', 'Fenitoína: dose não definida na diretriz', {}, true));
  }
  c.acoes = acoes;
  return c;
}

function cartaoTerceira(e, f, st) {
  const c = cartao('terceira', f >= 4 ? 'Além de 60 min' : 'Terceira fase', 'exclamationmark.triangle.fill', 0xA8327E, 'decisaoMedico', 'Sem evidência clara');
  c.noTopo = true;
  c.regras = [juntar(R.r21, R.r24, R.rFase3Sem)];
  if (st !== 'continua') {
    c.situacao = 'pergunta';
    c.valor = 'Confirme se a crise continua';
    return c;
  }
  if (f >= 4) {
    c.valor = 'A figura não tem fase';
    c.detalhe = 'A diretriz não cobre o refratário. A fonte não traz doses.';
    c.regras = [R.r22];
    return c;
  }
  c.detalhe = 'Nível U. Repetir a segunda linha, sem dose na fonte, ou doses anestésicas de tiopental, midazolam, pentobarbital ou propofol, todas com EEG contínuo. A fonte não dá doses. A terceira terapia é substancialmente menos eficaz.';
  const r = ultimaAcao(e, 'terceira.repetir', 'terceira.anestesico');
  if (r !== null) {
    c.conta = (r.tipo === 'terceira.repetir' ? 'Repetição da segunda linha' : 'Anestésico com EEG contínuo') + ' registrada às ' + hora(r.hora);
  } else {
    c.acoes = [acao('terceira.repetir', 'Registrar: repetir a segunda linha'), acao('terceira.anestesico', 'Registrar: anestésico com EEG contínuo')];
  }
  return c;
}

function cartaoServico(e) {
  const c = cartao('servico', 'Drogas do serviço', 'shippingbox.fill', 0x3451B2, 'pergunta', 'Falta alguma?');
  c.etiqueta = 'Opcional';
  c.discreto = true;
  c.regras = [R.rDisp];
  c.detalhe = 'Sem marca, a opção aparece. A sessão não substitui por conta própria.';
  c.acoes = ['midazolam', 'lorazepam', 'diazepam', 'fenobarbital', 'fosfenitoina', 'valproato', 'levetiracetam'].map((d) => {
    const sem = indisponivel(e, d);
    return acaoProposta((sem ? 'servico.tem.' : 'servico.sem.') + d, (sem ? 'Agora tem ' : 'Não tem ') + nomeDroga(d).toLowerCase(), {}, true);
  });
  return c;
}

function examesDevidos(p, e, agora, inicio, cessou) {
  const r = [];
  for (const [id, m] of [['m5', 5.0], ['m20', 20.0], ['m40', 40.0], ['m60', 60.0]]) {
    const d = p.exames.find((x) => x.id === id);
    const limite = mais(inicio, m * 60);
    const passou = agora >= limite;
    /* Marca já vencida some da lista: o cartão da fase é que orienta. A última fica sinalizada, porque depois dela a figura não tem fase. */
    const s = cessou ? 'encerrado' : (passou ? (id === 'm60' ? 'vencido' : 'encerrado') : 'noPrazo');
    r.push(exameDevido({ id, nome: d.nome, aviso: d.aviso, destaque: false, ultima: null, janelaInicio: null, proxima: limite, situacao: s, regra: R.r01 }));
  }
  const g = p.exames.find((x) => x.id === 'glicemia');
  const ug = ultimo(e, 'glicemia')?.hora ?? null;
  r.push(exameDevido({ id: g.id, nome: g.nome, aviso: g.aviso, destaque: false, ultima: ug, janelaInicio: null, proxima: null, situacao: ug === null ? 'semDado' : 'encerrado', regra: R.r02, rotuloSemDado: 'medir' }));
  return r;
}

/* Para o teste diferencial (compararFuncao em Ponte.swift): JSON simples, igual ao que o Swift devolve. */
export const funcoesTeste = {
  doses: (p) => ({
    midazolamIM: midazolamIM(p), lorazepam: lorazepam(p), diazepamIV: diazepamIV(p), diazepamRetal: diazepamRetal(p),
    fenobarbital: fenobarbital(p), fosfenitoina: fosfenitoina(p), valproato: valproato(p), levetiracetam: levetiracetam(p),
  }),
  fase: (s) => fase(s),
  inicioCrise: (e) => inicioCrise(e),
  status: (e) => status(e),
  abaixoDaPlena: (e, p) => abaixoDaPlena(e, p),
  dosesIniciais: (e) => dosesIniciais(e),
  dosesSegunda: (e) => dosesSegunda(e),
  indisponivel: (e, d) => indisponivel(e, d),
  /* Membros estáticos que os testes do app leem direto (teste/ponte_epileptico.swift). */
  dose: (nome, p) => ({ midazolamIM, lorazepam, diazepamIV, diazepamRetal, fenobarbital, fosfenitoina, valproato, levetiracetam })[nome](p),
  regra: (nome) => R[nome],
  nomesFase: () => nomesFase,
  fenitoinaCondutaLocal: () => fenitoinaCondutaLocal,
};

export const regrasEpileptico = R;
export const motorEpileptico = criarProtocolo(DEF);
export default motorEpileptico;
