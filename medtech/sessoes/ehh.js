/* Estado hiperglicêmico hiperosmolar. Porta fiel de MotorEHH.swift (app iOS). Especificação: docs/sessao_ehh_regras.md do app
   (consenso de 2024; figura ou tabela só onde o texto não define). O número de cada regra é a linha do arquivo de regras;
   o início de origem é o id da regra ou a seção. Não mudar regra aqui sem mudar no Swift: o teste diferencial reprova. */
import {
  criarProtocolo, defParametro, pergunta, defRamo, opcaoRamo, defExame, defGrafico, linhaGrafico, regra,
  orientacoes, cartao, alerta, trava, criterio, painelCriterios, acaoProposta, perguntaCartao, exameDevido,
  ultimo, ultimosDois, valor, resposta, ultimaAcao, teveAcao, num, hora, duracao, desde, mais,
} from './nucleo.js';

const R = {
  r02: regra(18, 'Osmolalidade efetiva calculada >300 mOsm/kg, por 2 × Na + glicose/18; ou total medida >320.', 'R02: Figura 2b'),
  r05: regra(21, 'Qualquer um dos quatro critérios ausente: não confirma EHH; o app diz qual falhou e não gera passo.', 'R05: Texto, Diagnostic criteria for HHS'),
  r06: regra(22, 'EHH confirmado: sugerir UTI.', 'R06: Texto, local de tratamento'),
  r07: regra(23, 'Primeiras 2-4 h, sem comprometimento renal ou cardíaco: salina isotônica ou cristaloide balanceado, 500-1000 mL/h.', 'R07: Texto, Fluid therapy; Figura 4'),
  r08: regra(24, 'Idoso, ou comprometimento renal ou cardíaco: bólus menores (o texto exemplifica 250 mL), com reavaliação hemodinâmica frequente; sem taxa fixa.', 'R08: Texto, Fluid therapy'),
  r09: regra(25, 'Sódio que sobe enquanto a glicemia cai não é indicação de fluido hipotônico.', 'R09: Texto, Fluid therapy'),
  r10: regra(26, 'Salina 0,45%: só se a osmolalidade não declina apesar de balanço hídrico positivo adequado e insulina adequada. O médico confirma as três condições.', 'R10: Texto, Fluid therapy'),
  r11: regra(27, 'Glicemia <250 mg/dL: acrescentar dextrose 5-10% ao fluido; insulina continua em 0,05 U/kg/h.', 'R11: Figura 4; Tabela 3'),
  r12: regra(28, 'K <3,5: não iniciar insulina; repor K até >3,5.', 'R12: Texto, Potassium; Figura 4'),
  r13: regra(29, 'K >5,0: iniciar insulina sem repor K; repetir K em 2 h.', 'R13: Figura 4; texto'),
  r14: regra(30, 'K >3,5, sem cetose significativa nem acidose: regular IV em infusão fixa de 0,05 U/kg/h.', 'R14: Texto, Insulin therapy; Figura 4'),
  r15: regra(31, 'Forma mista (β-OHB ≥3,0, pH <7,30 ou HCO₃ <18): o texto define 0,1 U/kg/h.', 'R15: Texto, Insulin therapy'),
  r16: regra(32, 'Usava basal em casa: manter a basal na dose habitual e ajustar.', 'R16: Texto, Insulin therapy'),
  r17: regra(33, 'Queda da glicemia acima de 90-120 mg/dL/h: alerta; reavaliar; o app não muda a insulina sozinho.', 'R17: Texto, Fluid therapy; Tabela 3'),
  r18: regra(34, 'Queda do sódio de mais de 10 mmol/L em 24 h: alerta.', 'R18: Texto, Fluid therapy'),
  r19: regra(35, 'Queda da osmolalidade de mais de 8 mOsm/kg/h: alerta.', 'R19: Texto, Fluid therapy; Tabela 3'),
  r20: regra(36, 'Glicemia <70 mg/dL: alerta em vermelho; reavaliação imediata; sem dose automática.', 'R20: Tabela 3'),
  r21: regra(37, 'Fraqueza muscular, comprometimento respiratório ou cardíaco, com fosfato <1,0 mmol/L: considerar 20-30 mmol de fosfato de potássio no fluido.', 'R21: Texto, Phosphate; Figura 4'),
  r22: regra(38, 'Sem trombose suspeita: lembrar HBPM em dose profilática; sem dose numérica.', 'R22: Tabela 3'),
  r23: regra(39, 'Piora ou mudança do estado mental: reavaliação imediata, risco de edema cerebral, baixo limiar para imagem; manitol e ventilação são citados sem dose.', 'R23: Tabela 3'),
  r25: regra(41, 'Resolvido e podendo comer e beber: esquema SC multidose; manter a insulina IV por 1-2 h depois da SC.', 'R25: Texto, Transition; Figuras 4 e 5'),
  r26: regra(42, 'Sem insulina prévia: dose diária total 0,5-0,6 U/kg; fragilidade ou falência renal, cerca de 0,3 U/kg.', 'R26: Texto; Figura 5'),
  r27: regra(43, 'Dieta oral: 40-60% da dose diária em basal; o resto em três doses prandiais de rápida.', 'R27: Figura 5'),
  r28: regra(44, 'Em jejum: basal mais correção com rápida a cada 4-6 h.', 'R28: Figura 5'),
  r29: regra(50, 'K entre 3,5 e 5,0, exclusive: KCl 20-30 mmol por litro de fluido, alvo K 4-5.', 'R29: Texto (frase de CAD, sem frase própria para EHH)'),
  r30: regra(51, 'K <3,5: 10 mmol/h e adiar a insulina até K >3,5.', 'R30: Texto'),
  r31: regra(52, 'K exatamente 3,5: segura a insulina; sem K automático; repetir K.', 'R31: Texto'),
  r32: regra(53, 'K exatamente 5,0: não repor; repetir K em 2 h.', 'R32: Texto'),
  r33: regra(54, 'Diurese antes de repor K: cerca de 0,5 mL/kg/h; abaixo disso o app pergunta e o médico decide.', 'R33: Figura 4'),
  r34: regra(55, 'Repetir K 2 h após iniciar insulina, depois a cada 4 h.', 'R34: Texto'),
  r35: regra(56, 'Glicemia capilar a cada 1-2 h; lembrete a partir de 1 h, atraso depois de 2 h.', 'R35: Texto; Tabela 3'),
  r36: regra(57, 'Na, K, creatinina, fosfato, β-OHB, pH venoso e osmolalidade sérica a cada 4 h até a resolução.', 'R36: Texto'),
  r37: regra(58, 'Resolução: osmolalidade <300, glicemia <250, diurese >0,5 mL/kg/h e melhora cognitiva; osmolalidade medida se informada, senão a efetiva calculada.', 'R37: Texto'),
  r38: regra(59, 'Alvo depois de <250: 200-250 mg/dL até a resolução.', 'R38: Figura 4'),
  r39: regra(60, 'Corrigir o déficit estimado em 24-48 h; com hipovolemia leve, repor cerca de 50% em 8-12 h.', 'R39: Texto; Figura 4'),
  r40: regra(61, 'O texto não exige volume antes da insulina; a Figura 4 registra que alguns adiam. O app registra a decisão do médico: iniciar agora ou aguardar.', 'R40: Texto; nota da Figura 4'),
  r41: regra(62, 'HCO₃ 15 a menos de 18, pH ≥7,3, β-OHB <3,0: cumpre os critérios, mas o texto classifica como forma mista: 0,1 U/kg/h com aviso; com glicemia <250, reduzir para 0,05.', 'R41: Texto, Insulin therapy; Figura 4'),
  r43: regra(64, 'pH <7,30, HCO₃ <18 ou β-OHB ≥3,0 numa coleta nova: o quadro saiu do perfil de EHH; reavaliação clínica; sem passo.', 'R43: Texto, Insulin therapy; Figura 2'),
  r44: regra(65, 'Dose em U/h = U/kg/h × peso informado.', 'R44: Texto'),
  r45: regra(66, 'Taxas por hora usam o horário real das duas coletas; osmolalidade só entre coletas completas (Na e glicose da mesma coleta, ou osmolalidade medida).', 'R45: Escolha do app para executar R17 a R19'),
  rMista: regra(107, 'β-OHB ≥3,0 ou pH <7,30: não é EHH puro; forma mista ou CAD. Sem passo; o texto dá 0,1 U/kg/h como informação. Usar a sessão de CAD.', 'Seção 4: Figura 2; texto, Insulin therapy'),
  rSemTitulacao: regra(114, 'Glicemia que não cai com volume e insulina: o texto não dá regra de titulação.', 'Seção 5: sem regra numérica'),
  rOsmLenta: regra(115, 'Osmolalidade que cai menos de 3 mOsm/kg/h: sem conduta. A salina 0,45% só entra se a osmolalidade não declinar; o app pergunta, não prescreve.', 'Seção 5: sem regra numérica'),
  rRitmo: regra(121, 'Ritmo do fluido depois das primeiras 2-4 h: o texto só diz que depende de pressão, frequência, balanço e sódio.', 'Seção 5: sem regra numérica'),
  rAbaixoAlvo: regra(123, 'Glicemia entre 70 e 199: abaixo do alvo de 200-250; o app só mostra a faixa, sem conduta.', 'Seção 5: sem regra numérica'),
  rKCaindo: regra(124, 'K <3,5 com a insulina correndo: alerta, reposição de 10 mmol/h e decisão do médico, sem mandar parar.', 'Seção 5: sem regra numérica'),
  rK25: regra(125, 'K ≤2,5 durante o tratamento: a Tabela 3 liga a mortalidade maior, sem conduta numérica.', 'Seção 5: sem regra numérica'),
  rFosfK: regra(126, 'Fosfato de potássio com K ≥5,0: sem orientação.', 'Seção 5: sem regra numérica'),
  rTrombose: regra(129, 'Conduta se houver trombose: não está na fonte.', 'Seção 5: sem regra numérica'),
  rQuedaFaixa: regra(151, 'Queda da glicemia: de 90 a 120 mg/dL/h aviso amarelo; acima de 120 aviso vermelho.', 'Seção 6: divergências'),
};

/* Critério R02: efetiva = 2 × Na + glicose/18, com glicose em mg/dL. */
export function osmEfetiva(na, glicemia) { return 2 * na + glicemia / 18; }

/* Coletas com Na e glicose da mesma hora: só elas dão osmolalidade calculada (R45). */
export function coletasCompletas(e) {
  const gs = e.series.glicemia ?? [];
  const r = [];
  for (const n of e.series.sodio ?? []) {
    let g = null;
    for (let i = gs.length - 1; i >= 0; i--) if (gs[i].hora === n.hora) { g = gs[i]; break; }
    if (g === null) continue;
    r.push({ valor: osmEfetiva(n.valor, g.valor), hora: n.hora });
  }
  return r.sort((a, b) => a.hora - b.hora);
}

/* Osmolalidade atual para a resolução: a medida se informada na coleta mais recente; senão a efetiva calculada (R37). */
export function osmAtual(e) {
  const cs = coletasCompletas(e);
  const c = cs.length ? cs[cs.length - 1] : null;
  const m = ultimo(e, 'osm');
  if (m !== null && (c !== null ? m.hora >= c.hora : true)) return { valor: m.valor, hora: m.hora, medida: true };
  if (c !== null) return { valor: c.valor, hora: c.hora, medida: false };
  return null;
}

/* Queda por hora entre as duas coletas mais recentes da mesma natureza. Medida e calculada não se misturam. */
export function quedaOsm(e) {
  const med = [...(e.series.osm ?? [])].sort((a, b) => a.hora - b.hora);
  const cal = coletasCompletas(e);
  const taxa = (s) => {
    if (s.length < 2) return null;
    const a = s[s.length - 2], b = s[s.length - 1];
    const h = desde(b.hora, a.hora) / 3600;
    return h > 0 ? (a.valor - b.valor) / h : null;
  };
  const tm = taxa(med);
  if (tm !== null && (cal.length ? med[med.length - 1].hora >= cal[cal.length - 1].hora : true)) return { queda: tm, medida: true };
  const tc = taxa(cal);
  if (tc !== null) return { queda: tc, medida: false };
  if (tm !== null) return { queda: tm, medida: true };
  return null;
}

export function quedaGlicemia(e) {
  const d = ultimosDois(e, 'glicemia');
  if (!d) return null;
  const h = desde(d[1].hora, d[0].hora) / 3600;
  return h > 0 ? (d[0].valor - d[1].valor) / h : null;
}

/* Maior queda do sódio na janela de 24 h que termina na coleta mais recente (R18). */
export function quedaSodio24h(e) {
  const u = ultimo(e, 'sodio');
  if (u === null) return null;
  const de = mais(u.hora, -86400);
  const vs = (e.series.sodio ?? []).filter((m) => m.hora >= de && m.hora < u.hora).map((m) => m.valor);
  if (!vs.length) return null;
  return Math.max(...vs) - u.valor;
}

/* Diurese em mL/kg/h pelo volume e período da mesma coleta: nunca presumida. */
export function diurese(e) {
  const v = ultimo(e, 'diureseML'), h = ultimo(e, 'diureseH');
  if (v === null || h === null || v.hora !== h.hora || !(h.valor > 0)) return null;
  const p = valor(e, 'peso');
  if (p === null || !(p > 0)) return null;
  return v.valor / h.valor / p;
}

const juntar = (xs) => xs.filter((x) => x !== null).join(', ');

/* Quatro critérios da Figura 2b, com três valores: dado faltando nunca conta como cumprido nem como normal. */
export function criteriosEHH(e) {
  const g = valor(e, 'glicemia'), na = valor(e, 'sodio'), m = valor(e, 'osm'), b = valor(e, 'bohb'), p = valor(e, 'ph'), h = valor(e, 'hco3');
  const c1 = g !== null ? (g >= 600 ? 'sim' : 'nao') : 'falta';
  let ef = null;
  if (na !== null && g !== null) ef = osmEfetiva(na, g);
  let c2;
  if ((ef !== null ? ef > 300 : false) || (m !== null ? m > 320 : false)) c2 = 'sim'; else if (ef !== null) c2 = 'nao'; else c2 = 'falta';
  const c3 = b !== null ? (b < 3.0 ? 'sim' : 'nao') : 'falta';
  let c4;
  if ((p !== null ? p < 7.3 : false) || (h !== null ? h < 15 : false)) c4 = 'nao'; else if (p !== null && h !== null) c4 = 'sim'; else c4 = 'falta';
  return [
    criterio('glic', 'Glicemia ≥600 mg/dL', c1, g !== null ? num(g, 0) + ' mg/dL' : null),
    criterio('osm', 'Osmolalidade efetiva >300 ou medida >320 mOsm/kg', c2, juntar([ef !== null ? 'Efetiva ' + num(ef, 1) : null, m !== null ? 'Medida ' + num(m, 0) : null])),
    criterio('bohb', 'β-OHB <3,0 mmol/L', c3, b !== null ? num(b, 1) + ' mmol/L' : null),
    criterio('acido', 'pH ≥7,3 e HCO₃ ≥15 mmol/L', c4, juntar([p !== null ? 'pH ' + num(p) : null, h !== null ? 'HCO₃ ' + num(h, 1) : null])),
  ];
}

/* Resolução, R24 e R37: os quatro itens; dado faltando fica como falta. */
export function criteriosResolucao(e) {
  const o = osmAtual(e), g = valor(e, 'glicemia'), d = diurese(e), cog = resposta(e, 'melhoraCognitiva');
  const c1 = o !== null ? (o.valor < 300 ? 'sim' : 'nao') : 'falta';
  const c2 = g !== null ? (g < 250 ? 'sim' : 'nao') : 'falta';
  const c3 = d !== null ? (d > 0.5 ? 'sim' : 'nao') : 'falta';
  const c4 = cog !== null ? (cog ? 'sim' : 'nao') : 'falta';
  const cs = [
    criterio('osm', 'Osmolalidade <300 mOsm/kg', c1, o !== null ? (o.medida ? 'Medida ' : 'Efetiva calculada ') + num(o.valor, 1) : null),
    criterio('glic', 'Glicemia <250 mg/dL', c2, g !== null ? num(g, 0) + ' mg/dL' : null),
    criterio('diurese', 'Diurese >0,5 mL/kg/h', c3, d !== null ? num(d, 2) + ' mL/kg/h' : null),
    criterio('cog', 'Melhora cognitiva', c4, cog !== null ? (cog ? 'Sim' : 'Não') : null),
  ];
  return { criterios: cs, cumprido: [c1, c2, c3, c4].every((x) => x === 'sim') };
}

const acao = (tipo, rotulo, v = {}) => acaoProposta(tipo, rotulo, v);

const DEF = {
  id: 'ehh',
  nome: 'Estado hiperosmolar',
  descricao: 'Dos quatro critérios à transição',
  idConduta: 'ehh',
  referencia: 'Umpierrez GE et al. Hyperglycaemic crises in adults with diabetes: a consensus report. Diabetologia 2024;67:1455-1479 (doi:10.1007/s00125-024-06183-8).',
  escopo: 'Adulto com estado hiperosmolar confirmado pelos quatro critérios, em insulina regular IV em bomba, internado.',
  tituloRamos: 'Critérios e hipovolemia',
  parametros: [
    defParametro('peso', 'Peso', 'kg', 30, 300),
    defParametro('glicemia', 'Glicemia', 'mg/dL', 20, 2000, 0),
    defParametro('sodio', 'Sódio', 'mmol/L', 100, 200),
    defParametro('potassio', 'Potássio', 'mmol/L', 1.5, 9),
    defParametro('ph', 'pH venoso', '', 6.5, 7.8, 2),
    defParametro('hco3', 'HCO₃', 'mmol/L', 2, 50),
    defParametro('bohb', 'β-OHB', 'mmol/L', 0, 15),
    defParametro('osm', 'Osmolalidade medida', 'mOsm/kg', 250, 500, 0),
    defParametro('fosfato', 'Fosfato', 'mmol/L', 0.1, 4),
    defParametro('creatinina', 'Creatinina', 'mg/dL', 0.2, 15),
    defParametro('diureseML', 'Diurese no período', 'mL', 0, 1000, 0),
    defParametro('diureseH', 'Duração do período', 'h', 1, 12),
  ],
  parametrosIniciais: ['peso', 'glicemia', 'sodio', 'potassio', 'ph', 'hco3', 'bohb', 'osm', 'diureseML', 'diureseH'],
  parametrosResultados: ['glicemia', 'sodio', 'potassio', 'ph', 'hco3', 'bohb', 'osm', 'fosfato', 'creatinina', 'diureseML', 'diureseH'],
  triagem: [
    pergunta('gestante', 'Gestante'),
    pergunta('menor18', 'Menor de 18 anos'),
    pergunta('ic', 'Insuficiência cardíaca'),
    pergunta('dialise', 'Doença renal em diálise'),
    pergunta('mista', 'Forma mista cetoacidose e hiperosmolar'),
  ],
  perguntasIniciais: [
    pergunta('idoso', 'É idoso?', 'O texto não define a idade; o médico marca.'),
    pergunta('comprometimento', 'Há comprometimento renal ou cardíaco?', 'Fora insuficiência cardíaca e diálise, que já saíram na triagem.'),
    pergunta('basalPrevia', 'Usa insulina basal em casa?'),
    pergunta('tromboseSuspeita', 'Há trombose suspeita?'),
  ],
  perguntasAcompanhamento: [
    pergunta('pioraMental', 'Piora ou mudança do estado mental?'),
    pergunta('melhoraCognitiva', 'Houve melhora cognitiva?'),
    pergunta('sinaisFosfato', 'Fraqueza muscular ou comprometimento respiratório ou cardíaco?'),
  ],
  ramos: [
    defRamo('hipovolemia', 'Hipovolemia', [
      opcaoRamo('grave', 'Grave', 'Sem critério numérico: o médico escolhe'),
      opcaoRamo('leve', 'Leve', 'Sem critério numérico: o médico escolhe'),
    ]),
  ],
  exames: [
    defExame('glicemia', 'Glicemia', 'Hora de repetir a glicemia', true),
    defExame('potassio', 'Potássio', 'Hora de repetir o potássio', true),
    defExame('sodio', 'Sódio', 'Hora de repetir o sódio', true),
    defExame('ph', 'pH venoso', 'Hora de repetir o pH venoso'),
    defExame('bohb', 'β-OHB', 'Hora de repetir o β-OHB'),
    defExame('osm', 'Osmolalidade', 'Hora de repetir a osmolalidade'),
    defExame('fosfato', 'Fosfato', 'Hora de repetir o fosfato'),
    defExame('creatinina', 'Creatinina', 'Hora de repetir a creatinina'),
  ],
  graficos: [
    defGrafico('glicemia', 'Glicemia', ['glicemia'], { glicemia: [linhaGrafico(600, '600'), linhaGrafico(250, '250')] }),
    defGrafico('sodio', 'Sódio', ['sodio'], {}),
    defGrafico('osm', 'Osmolalidade medida', ['osm'], { osm: [linhaGrafico(320, '320'), linhaGrafico(300, '300')] }),
    defGrafico('potassio', 'Potássio', ['potassio'], { potassio: [linhaGrafico(3.5, '3,5'), linhaGrafico(5, '5,0')] }),
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

  const g = valor(e, 'glicemia'), k = valor(e, 'potassio'), ph = valor(e, 'ph'), hco3 = valor(e, 'hco3'), bohb = valor(e, 'bohb'), fos = valor(e, 'fosfato'), peso = valor(e, 'peso');
  const confirmada = ultimaAcao(e, 'ehh.confirmada');

  /* Confirmação: os quatro critérios, sem exceção; R05 não deixa gerar passo sem eles. */
  const crit = criteriosEHH(e);
  const cumprido = crit.every((c) => c.situacao === 'sim');
  const mista = (bohb !== null ? bohb >= 3.0 : false) || (ph !== null ? ph < 7.30 : false);
  o.confirmacao = painelCriterios('Critérios de estado hiperosmolar', crit, cumprido, crit[1].situacao === 'sim' ? R.r05 : R.r02,
    cumprido ? acaoProposta('ehh.confirmada', 'Confirmo o estado hiperosmolar') : null);

  /* Antes de confirmar, β-OHB ≥3,0 ou pH <7,30 tira do escopo. */
  if (confirmada === null && mista) {
    o.foraDeEscopo = ['β-OHB ≥3,0 ou pH <7,30: não é estado hiperosmolar puro'];
    o.classificacao = 'Forma mista ou cetoacidose: fora do escopo';
    o.classificacaoDetalhe = 'Sem passo automático. O texto dá a insulina da forma mista, 0,1 U/kg/h, só como informação. Usar a sessão de cetoacidose.';
    o.classificacaoRegra = R.rMista;
    return o;
  }
  if (confirmada !== null) {
    /* Depois de confirmar, a glicemia cai por causa do tratamento: não reclassifica. */
    o.classificacao = 'Estado hiperosmolar confirmado pelo médico';
    o.classificacaoRegra = R.r06;
  } else if (cumprido && hco3 !== null && hco3 < 18) {
    o.classificacao = 'Estado hiperosmolar confirmado';
    o.classificacaoDetalhe = `HCO₃ ${num(hco3, 1)}: cumpre os critérios, mas o texto classifica HCO₃ <18 como forma mista. Sugerir UTI.`;
    o.classificacaoRegra = R.r41;
  } else if (cumprido) {
    o.classificacao = 'Estado hiperosmolar confirmado';
    o.classificacaoDetalhe = 'Sugerir UTI.';
    o.classificacaoRegra = R.r06;
  } else if (crit.some((c) => c.situacao === 'nao')) {
    o.classificacao = 'Não confirma estado hiperosmolar';
    o.classificacaoRegra = R.r05;
  } else {
    o.classificacao = 'Falta dado para os quatro critérios';
    o.classificacaoRegra = R.r05;
  }

  const resol = criteriosResolucao(e);
  const resolucaoConfirmada = teveAcao(e, 'resolucao.confirmada');
  o.resolucao = painelCriterios('Resolução', resol.criterios, resol.cumprido, R.r37,
    resol.cumprido && !resolucaoConfirmada ? acaoProposta('resolucao.confirmada', 'Confirmo a resolução') : null,
    resolucaoConfirmada ? 'Resolução confirmada pelo médico.' : null);

  if (confirmada === null) {
    o.exames = examesDevidos(p, e, agora, false, null, k);
    return o;
  }

  /* Situação da insulina a partir do que o médico confirmou. */
  const horasIni = e.acoes.filter((a) => a.tipo === 'insulina.inicio').map((a) => a.hora);
  const inicioIns = horasIni.length ? Math.min(...horasIni) : null;
  const parada = teveAcao(e, 'insulina.parada');
  const correndo = inicioIns !== null && !parada;
  const ua = ultimaAcao(e, 'insulina.inicio', 'insulina.ajuste');
  const taxa = ua ? (ua.valores.uKgH ?? null) : null;
  o.exames = examesDevidos(p, e, agora, resolucaoConfirmada, inicioIns, k);

  /* Saiu do perfil numa coleta depois da confirmação: aviso, sem passo. */
  const novaFora = (id, fora) => {
    const u = ultimo(e, id);
    if (u === null || !(u.hora > confirmada.hora) || !fora(u.valor)) return null;
    return u.valor;
  };
  const saiuPH = novaFora('ph', (v) => v < 7.30), saiuH = novaFora('hco3', (v) => v < 18), saiuB = novaFora('bohb', (v) => v >= 3.0);
  if (saiuPH !== null || saiuH !== null || saiuB !== null) {
    const itens = juntar([saiuPH !== null ? 'pH ' + num(saiuPH) : null, saiuH !== null ? 'HCO₃ ' + num(saiuH, 1) : null, saiuB !== null ? 'β-OHB ' + num(saiuB, 1) : null]);
    o.alertas.push(alerta('foraPerfil', 'vermelho', `${itens}: o quadro saiu do perfil de estado hiperosmolar. Reavaliação clínica; a regra não gera passo.`, R.r43));
  }
  /* HCO₃ 15 a <18 com a insulina ainda não iniciada ou em 0,1: aviso destacado. */
  if (hco3 !== null && hco3 >= 15 && hco3 < 18 && (ph ?? 0) >= 7.30 && (bohb ?? 9) < 3.0 && (!correndo || (taxa ?? 0) > 0.05)) {
    o.alertas.push(alerta('mista41', 'amarelo', `HCO₃ ${num(hco3, 1)} mmol/L: cumpre os critérios, mas o texto classifica HCO₃ <18 como forma mista. Insulina 0,1 U/kg/h; com glicemia <250, reduzir para 0,05.`, R.r41));
  }

  /* Alertas sem dose. */
  if (g !== null && g < 70) {
    o.alertas.push(alerta('hipo', 'vermelho', `Glicemia abaixo de 70 mg/dL${g < 40 ? ', grave pela Tabela 3 (<40)' : ''}: reavaliar agora. O consenso não traz protocolo de resgate; a regra não sugere dose.`, R.r20));
  }
  if (g !== null && g >= 70 && g < 200) {
    o.alertas.push(alerta('abaixoAlvo', 'amarelo', `Glicemia ${num(g, 0)} mg/dL: abaixo do alvo de 200-250 mg/dL. Sem conduta na fonte.`, R.rAbaixoAlvo));
  }
  if (resposta(e, 'pioraMental') === true) {
    o.alertas.push(alerta('neuro', 'vermelho', 'Piora ou mudança do estado mental: reavaliar agora. Risco de edema cerebral, baixo limiar para imagem. Manitol e ventilação são citados sem dose.', R.r23));
  }
  if (correndo && k !== null && k < 3.5) {
    o.alertas.push(alerta('kCaindo', 'vermelho', `K ${num(k)} mmol/L com a insulina correndo. O consenso fala do início do tratamento: reposição de 10 mmol/h e decisão do médico sobre a insulina.`, R.rKCaindo));
  }
  if (correndo && k !== null && k === 3.5) {
    o.alertas.push(alerta('kLimite', 'amarelo', 'K 3,5 mmol/L com a insulina correndo: a regra de >3,5 é para iniciar. Decisão do médico sobre a insulina.', R.r31));
  }
  if (k !== null && k <= 2.5) {
    o.alertas.push(alerta('k25', 'vermelho', `K ${num(k)} mmol/L: a Tabela 3 liga K ≤2,5 a mortalidade maior, sem conduta numérica.`, R.rK25));
  }
  const qg = quedaGlicemia(e);
  if (qg !== null) {
    if (qg > 120) {
      o.alertas.push(alerta('glicRapida', 'vermelho', `Glicemia caindo ${num(qg, 0)} mg/dL/h, acima de 120. Reavaliar; a regra não muda a insulina.`, R.r17));
    } else if (qg >= 90) {
      o.alertas.push(alerta('glicFaixa', 'amarelo', `Glicemia caindo ${num(qg, 0)} mg/dL/h, na faixa de 90-120. Reavaliar; a regra não muda a insulina.`, R.rQuedaFaixa));
    }
  }
  const qn = quedaSodio24h(e);
  if (qn !== null && qn > 10) {
    o.alertas.push(alerta('naQueda', 'vermelho', `Sódio caiu ${num(qn, 1)} mmol/L em 24 h, acima de 10. Sem conduta na fonte: decisão do médico.`, R.r18));
  }
  const qo = quedaOsm(e);
  if (qo !== null) {
    if (qo.queda > 8) {
      o.alertas.push(alerta('osmRapida', 'vermelho', `Osmolalidade caindo ${num(qo.queda, 1)} mOsm/kg/h, acima de 8. A regra não muda a insulina nem a dextrose: decisão do médico.`, R.r19));
    } else if (qo.queda < 3) {
      o.alertas.push(alerta('osmLenta', 'amarelo', qo.queda > 0 ? `Osmolalidade caindo ${num(qo.queda, 1)} mOsm/kg/h, menos que 3. Sem conduta na fonte.` : 'A osmolalidade não caiu entre as duas últimas coletas. Sem conduta na fonte.', R.rOsmLenta));
    }
  }
  const n2 = ultimosDois(e, 'sodio'), d2 = ultimosDois(e, 'glicemia');
  if (n2 && d2 && n2[1].valor > n2[0].valor && d2[1].valor < d2[0].valor) {
    o.alertas.push(alerta('naSobe', 'amarelo', 'O sódio subiu enquanto a glicemia caiu: não é indicação de fluido hipotônico.', R.r09));
  }
  if (correndo && d2 && d2[0].hora >= (inicioIns ?? agora) && d2[1].valor >= d2[0].valor) {
    o.alertas.push(alerta('naoCai', 'amarelo', `A glicemia não caiu entre as duas últimas medidas (${num(d2[0].valor, 0)} e ${num(d2[1].valor, 0)} mg/dL). A insulina é infusão fixa: sem regra de titulação.`, R.rSemTitulacao));
  }

  /* Trava: K ≤3,5 antes de iniciar. */
  if (!correndo && !parada && k !== null && k <= 3.5) {
    o.travas.push(trava('insulinaK', 'Não iniciar insulina', `K ${num(k)} mmol/L. Repor K até >3,5 mmol/L antes da insulina.`, k === 3.5 ? R.r31 : R.r12));
  }

  /* Depois da parada da insulina IV a especificação não orienta mais nada: fica só o registro. */
  if (parada) {
    o.etapasFinais = etapasTransicao(e, agora, peso, false);
    o.encerradaPelaRegra = 'Insulina IV parada às ' + hora(ultimaAcao(e, 'insulina.parada')?.hora ?? agora) + '.';
    return o;
  }
  o.cartoes.push(cartaoInsulina(e, peso, g, k, ph, hco3, bohb, correndo, taxa, resolucaoConfirmada));
  o.cartoes.push(cartaoPotassio(e, peso, k));
  o.cartoes.push(cartaoVolume(e, agora));
  o.cartoes.push(cartaoLocal(e));
  o.cartoes.push(cartaoDextrose(e, g));
  o.cartoes.push(cartaoOsmolalidade(e));
  o.cartoes.push(cartaoSalina045(e));
  o.cartoes.push(cartaoFosfato(e, fos, k));
  o.cartoes.push(cartaoBasalPrevia(e));
  o.cartoes.push(cartaoTromboprofilaxia(e));

  if (resolucaoConfirmada) o.etapasFinais = etapasTransicao(e, agora, peso, correndo);
  return o;
}

function cartaoLocal(e) {
  const c = cartao('local', 'Local de cuidado', 'cross.case.fill', 0x3451B2, 'proximoPasso', 'Sugerir UTI');
  c.regras = [R.r06];
  if (teveAcao(e, 'local.ciente')) { c.situacao = 'semIndicacao'; c.valor = 'UTI sugerida'; }
  else c.acoes = [acao('local.ciente', 'Registrar que vi a sugestão')];
  return c;
}

function cartaoInsulina(e, peso, g, k, ph, hco3, bohb, correndo, taxa, resolvida) {
  const c = cartao('insulina', 'Insulina', 'syringe.fill', 0x0F7F74, 'faltaDado', 'Falta dado');
  c.regras = [R.r14, R.r12, R.r31, R.r11, R.r38, R.r44];
  if (!correndo) {
    if (k === null) {
      c.valor = 'Falta potássio';
      c.detalhe = 'A insulina só é liberada com K conhecido e >3,5 mmol/L.';
      return c;
    }
    if (k <= 3.5) {
      c.situacao = 'travado';
      c.valor = 'Não iniciar';
      c.detalhe = `K ${num(k)} mmol/L. Repor K até >3,5 mmol/L.`;
      c.regras = [k === 3.5 ? R.r31 : R.r12, R.r30];
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
    if (ph === null || hco3 === null || bohb === null) {
      c.valor = 'Falta pH, HCO₃ ou β-OHB';
      c.detalhe = 'A dose depende de não haver cetose significativa nem acidose.';
      return c;
    }
    if (bohb >= 3.0 || ph < 7.30 || hco3 < 15) {
      c.situacao = 'decisaoMedico';
      c.valor = 'Sem passo';
      c.detalhe = 'O quadro saiu do perfil de estado hiperosmolar. Reavaliação clínica.';
      c.regras = [R.r43, R.r15];
      return c;
    }
    const mista = hco3 < 18 && g >= 250;
    const t = mista ? 0.1 : 0.05;
    const u = t * peso;
    const tx = num(t) + ' U/kg/h';
    c.liberado = true;
    c.valor = tx;
    c.conta = `${num(u)} U/h para ${num(peso, 1)} kg`;
    c.doses = { uKgH: t, uH: u };
    if (mista) c.regras = [R.r41, R.r15, R.r44];
    const aguardando = ultimaAcao(e, 'insulina.aguardar') !== null;
    const iniciar = acao('insulina.inicio', `Iniciar agora: ${num(u)} U/h`, { uKgH: t, uH: u });
    if (aguardando) {
      c.situacao = 'decisaoMedico';
      c.detalhe = `Decisão registrada: aguardar. A regra segue sendo ${tx} ao iniciar.`;
      c.acoes = [iniciar];
    } else {
      c.situacao = 'proximoPasso';
      c.detalhe = 'O texto não exige volume antes da insulina; a Figura 4 registra que alguns adiam até a glicemia parar de cair só com volume. Decisão do médico: iniciar agora ou aguardar.';
      c.acoes = [iniciar, acaoProposta('insulina.aguardar', 'Registrar decisão de aguardar', {}, true)];
      c.regras = mista ? [...c.regras, R.r40] : [R.r14, R.r40, R.r44];
    }
    return c;
  }

  /* Já correndo: infusão fixa; só a redução de 0,1 para 0,05 com glicemia <250. */
  const t = taxa ?? 0.05;
  c.liberado = true;
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
    c.regras = [R.r41, R.r11, R.r44];
    if (peso !== null) {
      c.conta = `${num(0.05 * peso)} U/h para ${num(peso, 1)} kg`;
      c.doses = { uKgH: 0.05, uH: 0.05 * peso };
      c.acoes = [acao('insulina.ajuste', `Confirmar redução: ${num(0.05 * peso)} U/h`, { uKgH: 0.05, uH: 0.05 * peso })];
    }
    c.detalhe = `Glicemia ${num(g, 0)} mg/dL. Alvo depois de <250: 200-250 mg/dL.`;
  } else {
    c.situacao = 'correndo';
    c.valor = num(t) + ' U/kg/h';
    c.conta = contaAtual;
    c.doses = { uKgH: t };
    c.detalhe = g < 250 ? 'Insulina continua em 0,05 U/kg/h. Alvo depois de <250: 200-250 mg/dL.' : 'Infusão fixa.';
  }
  if (resolvida) c.detalhe = (c.detalhe !== null ? c.detalhe + ' ' : '') + 'Manter até a transição.';
  return c;
}

function cartaoPotassio(e, peso, k) {
  const c = cartao('potassio', 'Potássio', 'bolt.fill', 0x6D3FD6, 'faltaDado', 'Falta potássio');
  c.regras = [R.r29, R.r30, R.r13, R.r33];
  let aberto = null;
  for (const a of e.acoes) if ((a.tipo === 'kcl.inicio' || a.tipo === 'kcl.parada') && (aberto === null || aberto.hora < a.hora)) aberto = a;
  const modoAtual = aberto?.tipo === 'kcl.inicio' ? (aberto.valores.modo ?? null) : null;
  if (k === null) {
    c.detalhe = 'Sem o K, a reposição não é orientada.';
    return c;
  }
  /* K ≥5,0: sem reposição. K >5,0 pela R13 e 5,0 exato pela R32. */
  if (k >= 5.0) {
    c.valor = 'Sem K';
    c.conta = `K ${num(k)} mmol/L`;
    c.regras = [k === 5.0 ? R.r32 : R.r13];
    if (modoAtual !== null) {
      c.situacao = 'proximoPasso';
      c.acoes = [acao('kcl.parada', 'Confirmar retirada do K')];
      c.detalhe = 'Repetir K em 2 h.';
    } else {
      c.situacao = 'semIndicacao';
      c.detalhe = 'Repetir K em 2 h.';
    }
    return c;
  }
  if (k === 3.5) {
    c.situacao = 'decisaoMedico';
    c.valor = 'Sem K automático';
    c.conta = 'K 3,5 mmol/L';
    c.detalhe = 'Repetir K. A insulina segue segurada até K >3,5 se ainda não começou.';
    c.regras = [R.r31];
    if (modoAtual !== null) c.acoes = [acaoProposta('kcl.parada', 'Registrar retirada do K', {}, true)];
    return c;
  }
  /* Diurese antes de repor: calculada do que o médico digitou. Abaixo de 0,5 o médico decide. */
  const alvo = peso !== null ? `Cerca de ${num(0.5 * peso)} mL/h para ${num(peso, 1)} kg` : null;
  const diu = diurese(e);
  if (diu === null) {
    c.valor = 'Falta diurese';
    c.conta = alvo;
    c.detalhe = `K ${num(k)} mmol/L. Informe volume e período em Novos resultados. A reposição só é mostrada depois disso.`;
    c.regras = [R.r33];
    return c;
  }
  if (diu < 0.5) {
    const horaDiurese = ultimo(e, 'diureseML')?.hora ?? -Infinity;
    const ud = ultimaAcao(e, 'kcl.decisaoDiurese');
    const dec = ud !== null && ud.hora >= horaDiurese ? ud : null;
    if ((dec ? dec.valores.repor : undefined) !== 1) {
      c.situacao = 'decisaoMedico';
      c.valor = 'Diurese abaixo de 0,5';
      c.conta = `${num(diu)} mL/kg/h. K ${num(k)} mmol/L`;
      c.detalhe = dec !== null ? 'Decisão registrada: não repor agora.' : 'A figura não dá o passo seguinte. Decisão do médico: repor ou não.';
      c.regras = [R.r33];
      c.acoes = [acaoProposta('kcl.decisaoDiurese', 'Registrar decisão de repor', { repor: 1 })];
      if (dec === null) c.acoes.push(acaoProposta('kcl.decisaoDiurese', 'Registrar decisão de não repor', { repor: 0 }, true));
      return c;
    }
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
    c.regras = [R.r30, R.rKCaindo, R.r33];
  } else {
    c.doses = { mmolLMin: 20, mmolLMax: 30 };
    c.valor = '20-30 mmol por litro';
    c.conta = `K ${num(k)} mmol/L. Alvo K 4-5`;
    if (modoAtual === 2) c.situacao = 'correndo';
    else {
      c.situacao = 'proximoPasso';
      c.acoes = [acao('kcl.inicio', 'Confirmar KCl 20-30 mmol por litro', { modo: 2, mmolLMin: 20, mmolLMax: 30 })];
    }
    c.regras = [R.r29, R.r33];
  }
  return c;
}

function cartaoVolume(e, agora) {
  const c = cartao('volume', 'Volume', 'drop.fill', 0x1F5FD1, 'pergunta', 'Falta responder');
  c.regras = [R.r07, R.r39];
  const idoso = resposta(e, 'idoso');
  if (idoso === null) {
    c.detalhe = 'A taxa fixa vale para quem não é idoso nem tem comprometimento renal ou cardíaco.';
    c.pergunta = perguntaCartao('idoso', 'É idoso?');
    return c;
  }
  const comp = resposta(e, 'comprometimento');
  if (comp === null) {
    c.detalhe = 'A taxa fixa vale para quem não é idoso nem tem comprometimento renal ou cardíaco.';
    c.pergunta = perguntaCartao('comprometimento', 'Há comprometimento renal ou cardíaco?');
    return c;
  }
  if (idoso || comp) {
    c.regras = [R.r08, R.r39];
    c.valor = 'Bólus menores';
    c.conta = 'O texto exemplifica 250 mL. Sem taxa fixa';
    c.detalhe = 'Reavaliação hemodinâmica frequente.';
    c.liberado = true;
    c.situacao = teveAcao(e, 'volume.bolus') ? 'correndo' : 'proximoPasso';
    c.acoes = [acao('volume.bolus', 'Registrar bólus de volume')];
    return c;
  }
  const hipo = e.escolhas.hipovolemia ?? null;
  const notaDeficit = 'Corrigir o déficit estimado em 24-48 h.' + (hipo === 'leve' ? ' Hipovolemia leve: repor cerca de 50% em 8-12 h.' : '');
  const notaGrave = hipo === 'grave' ? ' Hipovolemia grave: topo da faixa, 1,0 L/h na Figura 4.' : '';
  const ini = ultimaAcao(e, 'volume.inicio')?.hora ?? null;
  if (ini === null) {
    c.situacao = 'proximoPasso';
    c.valor = '500-1000 mL/h';
    c.conta = 'Salina isotônica ou cristaloide balanceado';
    c.detalhe = 'Nas primeiras 2-4 h.' + notaGrave + ' ' + notaDeficit;
    c.liberado = true;
    c.doses = { mLHMin: 500, mLHMax: 1000 };
    c.acoes = [acao('volume.inicio', 'Confirmar início do volume')];
    return c;
  }
  const h = desde(agora, ini) / 3600;
  if (h <= 4) {
    c.situacao = 'correndo';
    c.valor = '500-1000 mL/h';
    c.conta = 'Salina isotônica ou cristaloide balanceado';
    c.detalhe = `Iniciado às ${hora(ini)}, há ${duracao(desde(agora, ini))}. A regra vale nas primeiras 2-4 h.` + notaGrave + ' ' + notaDeficit;
    c.liberado = true;
    c.doses = { mLHMin: 500, mLHMax: 1000 };
  } else {
    c.situacao = 'decisaoMedico';
    c.valor = 'Passou de 4 h';
    c.detalhe = `Iniciado às ${hora(ini)}. O texto só diz que o ritmo depende de pressão, frequência, balanço e sódio. ` + notaDeficit;
    c.regras = [R.rRitmo, R.r39];
  }
  return c;
}

function cartaoDextrose(e, g) {
  const c = cartao('dextrose', 'Dextrose', 'cube.fill', 0xA8530A, 'faltaDado', 'Falta glicemia');
  c.regras = [R.r11, R.r38];
  const rodando = teveAcao(e, 'dextrose.inicio') && !teveAcao(e, 'dextrose.parada');
  if (g === null) return c;
  if (g < 250) {
    c.liberado = true;
    c.valor = 'Dextrose 5-10%';
    c.conta = `Glicemia ${num(g, 0)} mg/dL`;
    c.detalhe = 'Acrescentar ao fluido. Alvo: 200-250 mg/dL até a resolução.';
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

/* Só mostra a osmolalidade e a velocidade. */
function cartaoOsmolalidade(e) {
  const c = cartao('osmolalidade', 'Osmolalidade', 'gauge.medium', 0x0E7C94, 'faltaDado', 'Falta Na e glicemia');
  c.discreto = true;
  c.regras = [R.r45, R.r19];
  const a = osmAtual(e);
  if (a === null) {
    c.detalhe = 'A calculada precisa de Na e glicose da mesma coleta.';
    return c;
  }
  c.situacao = 'correndo';
  c.valor = num(a.valor, 1) + ' mOsm/kg';
  c.conta = (a.medida ? 'Medida' : 'Efetiva calculada') + ' às ' + hora(a.hora);
  const q = quedaOsm(e);
  if (q !== null) c.detalhe = `Variação entre as duas últimas coletas: queda de ${num(q.queda, 1)} mOsm/kg/h.`;
  else c.detalhe = 'Ainda sem duas coletas completas para a velocidade.';
  return c;
}

/* R10: só entra se a osmolalidade não declina; o médico confirma as três condições; sem taxa na fonte. */
function cartaoSalina045(e) {
  const c = cartao('salina045', 'Salina 0,45%', 'drop.triangle', 0x1F5FD1, 'faltaDado', 'Falta comparar');
  c.regras = [R.r10, R.rOsmLenta, R.r09];
  c.discreto = true;
  const q = quedaOsm(e);
  if (q === null) {
    c.detalhe = 'A regra pede duas coletas completas de osmolalidade.';
    return c;
  }
  if (q.queda > 0) {
    c.situacao = 'semIndicacao';
    c.valor = 'Não indicada agora';
    c.conta = 'Osmolalidade caindo';
    return c;
  }
  c.discreto = false;
  const itens = [['osmNaoDeclina', 'A osmolalidade não declina?'], ['balancoPositivo', 'O balanço hídrico está positivo e adequado?'], ['insulinaAdequada', 'A insulina está adequada?']];
  for (const [chave, texto] of itens) {
    const r = resposta(e, chave);
    if (r === null) {
      c.situacao = 'pergunta';
      c.valor = 'Três condições';
      c.detalhe = 'Única indicação citada na fonte. O app pergunta, não prescreve.';
      c.pergunta = perguntaCartao(chave, texto);
      return c;
    }
    if (!r) {
      c.situacao = 'semIndicacao';
      c.valor = 'Não indicada agora';
      c.conta = 'Condição não confirmada pelo médico';
      return c;
    }
  }
  c.situacao = 'decisaoMedico';
  c.valor = 'Três condições confirmadas';
  c.detalhe = 'Única indicação citada na fonte. Sem taxa na fonte.';
  c.liberado = true;
  if (!teveAcao(e, 'salina045.decisao')) c.acoes = [acao('salina045.decisao', 'Registrar decisão de usar salina 0,45%')];
  return c;
}

function cartaoFosfato(e, fos, k) {
  const c = cartao('fosfato', 'Fosfato', 'figure.walk.motion', 0xA8327E, 'pergunta', 'Há sinais?');
  c.regras = [R.r21];
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
    c.detalhe = 'Há sinais; falta o valor do fosfato em mmol/L.';
    return c;
  }
  if (!(fos < 1.0)) {
    c.situacao = 'semIndicacao';
    c.valor = 'Não indicado agora';
    c.conta = `Fosfato ${num(fos)} mmol/L`;
    return c;
  }
  if (k === null) {
    c.situacao = 'faltaDado';
    c.valor = 'Falta potássio';
    c.detalhe = `Fosfato ${num(fos)} mmol/L. A reposição é com fosfato de potássio; falta o K.`;
    return c;
  }
  /* K ≥5,0: sem fosfato de potássio, como o cartão de potássio (K 5,0 exato pela R32). Decisão do Matheus, 04/11/2026. */
  if (k >= 5.0) {
    c.situacao = 'decisaoMedico';
    c.valor = 'Sem orientação';
    c.conta = `Fosfato ${num(fos)} mmol/L. K ${num(k)} mmol/L`;
    c.detalhe = 'Fosfato de potássio com K ≥5,0: sem orientação. Decisão do médico.';
    c.regras = k === 5.0 ? [R.rFosfK, R.r32, R.r21] : [R.rFosfK, R.r21];
    return c;
  }
  c.liberado = true;
  c.valor = 'Considerar reposição';
  c.conta = '20-30 mmol de fosfato de potássio no fluido';
  c.detalhe = `Fosfato ${num(fos)} mmol/L.`;
  c.doses = { mmolMin: 20, mmolMax: 30 };
  if (teveAcao(e, 'fosfato.inicio')) c.situacao = 'correndo';
  else {
    c.situacao = 'proximoPasso';
    c.acoes = [acao('fosfato.inicio', 'Registrar decisão de repor fosfato')];
  }
  return c;
}

function cartaoBasalPrevia(e) {
  const c = cartao('basalPrevia', 'Basal de casa', 'house.fill', 0x0F7F74, 'pergunta', 'Usa em casa?');
  c.regras = [R.r16];
  const usa = resposta(e, 'basalPrevia');
  if (usa === null) {
    c.pergunta = perguntaCartao('basalPrevia', 'Usa insulina basal em casa?');
    c.discreto = true;
    return c;
  }
  if (!usa) {
    c.situacao = 'semIndicacao';
    c.valor = 'Não usa';
    return c;
  }
  c.valor = 'Manter a basal';
  c.conta = 'Na dose habitual, e ajustar';
  if (teveAcao(e, 'basalPrevia.mantida')) c.situacao = 'correndo';
  else {
    c.situacao = 'proximoPasso';
    c.acoes = [acao('basalPrevia.mantida', 'Registrar basal mantida')];
  }
  return c;
}

function cartaoTromboprofilaxia(e) {
  const c = cartao('trombo', 'Tromboprofilaxia', 'bandage.fill', 0xA8327E, 'pergunta', 'Trombose suspeita?');
  c.regras = [R.r22];
  const susp = resposta(e, 'tromboseSuspeita');
  if (susp === null) {
    c.pergunta = perguntaCartao('tromboseSuspeita', 'Há trombose suspeita?');
    c.discreto = true;
    return c;
  }
  if (susp) {
    c.situacao = 'decisaoMedico';
    c.valor = 'Trombose suspeita';
    c.detalhe = 'A conduta não está na fonte. Decisão do médico.';
    c.regras = [R.rTrombose];
    return c;
  }
  c.valor = 'Lembrar HBPM';
  c.conta = 'Em dose profilática';
  c.detalhe = 'A fonte não traz dose numérica.';
  if (teveAcao(e, 'trombo.lembrado')) c.situacao = 'semIndicacao';
  else {
    c.situacao = 'proximoPasso';
    c.acoes = [acao('trombo.lembrado', 'Registrar tromboprofilaxia avaliada')];
  }
  return c;
}

function etapasTransicao(e, agora, peso, correndo) {
  const c = cartao('transicao', 'Transição', 'arrow.triangle.swap', 0x3451B2, 'pergunta', 'Come e bebe?');
  c.regras = [R.r25, R.r26, R.r27];
  const come = resposta(e, 'podeComer');
  if (come === null) {
    c.pergunta = perguntaCartao('podeComer', 'O paciente pode comer e beber?');
    return [c];
  }
  if (!come) {
    c.situacao = 'decisaoMedico';
    c.valor = 'Ainda em jejum';
    c.detalhe = 'A regra de transição é para quem pode comer e beber. Em jejum, a Figura 5 traz basal mais correção com rápida a cada 4-6 h. Decisão do médico.';
    c.regras = [R.r28, R.r25];
    c.pergunta = perguntaCartao('podeComer', 'O paciente já pode comer e beber?');
    return [c];
  }
  c.liberado = true;
  const d = cartao('doseSC', 'Dose SC', 'syringe', 0x3451B2, 'pergunta', 'Usava insulina?');
  d.regras = [R.r26, R.r27];
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
      d.detalhe = 'Dieta oral: 40-60% da dose diária em basal; o resto em três doses prandiais de rápida.';
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
  c.valor = 'Esquema SC multidose';
  const basal = ultimaAcao(e, 'basal.sc');
  if (basal !== null) {
    if (correndo) {
      const de = mais(basal.hora, 3600), ate = mais(basal.hora, 7200);
      if (agora < de) {
        c.situacao = 'correndo';
        c.valor = 'Manter insulina IV';
        c.conta = `SC às ${hora(basal.hora)}. Parar entre ${hora(de)} e ${hora(ate)}`;
        c.detalhe = `Faltam ${duracao(desde(de, agora))} para abrir a janela.`;
      } else {
        c.situacao = 'proximoPasso';
        c.valor = 'Parar a insulina IV';
        c.conta = `SC às ${hora(basal.hora)}. Pelo menos 1-2 h: ${hora(de)} a ${hora(ate)}`;
        c.acoes = [acao('insulina.parada', 'Confirmar parada da insulina IV')];
      }
    } else {
      c.situacao = 'semIndicacao';
      c.valor = 'Esquema SC registrado';
      c.conta = `Às ${hora(basal.hora)}`;
    }
  } else {
    c.situacao = 'proximoPasso';
    c.conta = 'Manter a insulina IV por 1-2 h depois da SC';
    c.acoes = [acao('basal.sc', 'Confirmar primeira dose SC dada')];
  }
  return [c, d];
}

function examesDevidos(p, e, agora, resolvido, inicioInsulina, k) {
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
  const parada = teveAcao(e, 'insulina.parada');
  const ug = hr('glicemia');
  r.push(montar('glicemia', ug, ug !== null ? mais(ug, 3600) : null, ug !== null ? mais(ug, 7200) : null, R.r35, parada));

  /* K ≥5,0: em 2 h (R13 e R32). Depois de iniciar a insulina, 2 h e então a cada 4 h (R34). Antes, com os eletrólitos, a cada 4 h (R36). */
  const uk = hr('potassio');
  let pk = null;
  let rk = R.r36;
  if (uk !== null) {
    if (k !== null && k >= 5.0) {
      pk = mais(uk, 7200); rk = k === 5.0 ? R.r32 : R.r13;
    } else if (inicioInsulina !== null) {
      const marco = mais(inicioInsulina, 7200);
      pk = uk >= marco ? mais(uk, 14400) : marco;
      rk = R.r34;
    } else {
      pk = mais(uk, 14400);
    }
  }
  r.push(montar('potassio', uk, null, pk, rk, parada));

  const cs = coletasCompletas(e);
  const hs = [hr('osm'), cs.length ? cs[cs.length - 1].hora : null].filter((x) => x !== null);
  const uosm = hs.length ? Math.max(...hs) : null;
  for (const id of ['sodio', 'ph', 'bohb', 'osm', 'fosfato', 'creatinina']) {
    const u = id === 'osm' ? uosm : hr(id);
    r.push(montar(id, u, null, u !== null ? mais(u, 14400) : null, R.r36, resolvido));
  }
  return r;
}

/* Adaptadores para a comparação direta com o Swift (compararFuncao da Ponte.swift). */
export const funcoesTeste = {
  osmEfetiva: (na, g) => osmEfetiva(na, g),
  quedaOsm: (e) => quedaOsm(e),
  quedaGlicemia: (e) => quedaGlicemia(e),
  quedaSodio24h: (e) => quedaSodio24h(e),
  diurese: (e) => diurese(e),
  osmAtual: (e) => osmAtual(e),
  coletasCompletas: (e) => coletasCompletas(e),
  criteriosEHH: (e) => criteriosEHH(e),
  criteriosResolucao: (e) => criteriosResolucao(e),
};

export const regrasEHH = R;
export const motorEHH = criarProtocolo(DEF);
export default motorEHH;
