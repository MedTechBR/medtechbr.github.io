/* Sepse e choque séptico. Porta fiel de MotorSepse.swift (app iOS). Especificação: docs/sessao_sepse_regras.md do app
   (Surviving Sepsis Campaign 2026). O número de cada regra é a linha do arquivo de regras.
   Decisões do dono: lactato elevado só pela marcação do médico, sem corte automático; corticoide e vasopressina sem dose nem gatilho,
   relato do painel só como nota; margem de 5 mmHg da PAM só para o alerta; 3 h do volume contadas do reconhecimento; 6 h da UTI contadas
   da indicação que o médico registra; gestante fora do escopo; glicemia, transfusão e bicarbonato fora desta versão; antibiótico só prazo.
   Não mudar regra aqui sem mudar no Swift: o teste diferencial reprova. */
import {
  criarProtocolo, defParametro, pergunta, defRamo, opcaoRamo, defExame, defGrafico, linhaGrafico, regra,
  orientacoes, cartao, alerta, trava, criterio, painelCriterios, acaoProposta, perguntaCartao, exameDevido,
  ultimo, primeiro, valor, resposta, ultimaAcao, teveAcao, num, hora, mais,
} from './nucleo.js';

const R = {
  r1: regra(29, 'R1. Choque séptico, possível, provável ou definido: antibiótico imediato, idealmente em até 1 h do reconhecimento.', 'Decl. 16, p. 881; forte, certeza muito baixa'),
  r2: regra(30, 'R2. Sepse provável ou definida, sem choque: antibiótico imediato, idealmente em até 1 h do reconhecimento.', 'Decl. 17, p. 881; forte, certeza muito baixa'),
  r3: regra(31, 'R3. Sepse possível, sem choque: investigação rápida e limitada no tempo. Se a preocupação com infecção persistir, antibiótico em até 3 h da primeira suspeita.', 'Decl. 18, p. 881, condicional, certeza muito baixa; decl. 19, boa prática; Figura 2, p. 883'),
  r4: regra(32, 'R4. Baixa probabilidade de infecção, sem choque: sugere adiar o antibiótico e manter monitorização próxima.', 'Decl. 20, p. 881; condicional, certeza muito baixa'),
  r5: regra(33, 'R5. Hemoculturas o mais cedo possível, idealmente antes do antibiótico, sem atrasar o antibiótico, em especial com hipotensão. Número de séries e frascos individualizado.', 'Decl. 7, p. 877; forte, certeza baixa'),
  r6: regra(34, 'R6. Decisão clínica de iniciar o antibiótico; a procalcitonina não entra nessa decisão.', 'Decl. 22, p. 884; condicional, certeza muito baixa'),
  r7: regra(35, 'R7. Escolha, dose, descalonamento e duração ficam fora da sessão: só o prazo e a ferramenta Antibióticos.', 'Decl. 33 e 36, p. 888 e 890'),
  r8: regra(41, 'R8. Sepse com hipotensão ou lactato elevado: monitorar PA, FC, FR e nível de consciência de forma contínua, ao menos de hora em hora.', 'Figura 3, p. 893, sem grau'),
  r9: regra(42, 'R9. Medir lactato. A Figura 3 pede em até 1 h.', 'Decl. 8, p. 877, condicional, certeza baixa; prazo de 1 h: Figura 3, condicional'),
  rD3: regra(219, 'D3. Sugerir hipotensão com PAM abaixo de 65 (exemplo da narrativa, não do enunciado). O médico confirma. Decisão de 02/11/2026.', 'Decisão do médico; SSC 2026, narrativa'),
  r10: regra(43, 'R10. Medir o tempo de enchimento capilar em até 1 h e usá-lo como adjunto de outras medidas de perfusão, considerando luz ambiente, temperatura, pigmentação da pele e doença vascular periférica.', 'Decl. 52, p. 897, condicional, certeza baixa; prazo de 1 h: Figura 3, condicional'),
  r11: regra(44, 'R11. Lactato seriado para guiar a ressuscitação. Depois do bólus inicial, individualizar o volume pela queda do lactato, em vez de dar volume até normalizá-lo. Não confiar em um só marcador.', 'Decl. 51, p. 897; condicional, certeza baixa'),
  r12: regra(50, 'R12. Hipoperfusão por sepse ou choque: ao menos 30 mL/kg de cristaloide IV nas primeiras 3 h. Peso real; peso ajustado ou ideal se IMC acima de 30. Individualizar e reavaliar com frequência.', 'Decl. 10, p. 878, e observações; condicional, certeza baixa'),
  r13: regra(51, 'R13. Hipotensão por sepse: bólus inicial de cristaloide e, se a hipotensão persistir, vasopressor. Choque instável: vasopressor junto com o volume pode se justificar caso a caso.', 'Decl. 11, p. 879, e observação; condicional, certeza muito baixa'),
  r14: regra(52, 'R14. Cristaloide como primeira linha; balanceado em vez de salina 0,9%, exceto TCE, que usa salina 0,9%. Cristaloide sozinho em vez de cristaloide mais albumina; albumina pode caber a quem recebeu grande volume ou tem cirrose; evitar em TCE. Amido e gelatina: contra.', 'Decl. 43 a 47, p. 894'),
  r15: regra(53, 'R15. Já recebeu 30 mL/kg e a hipoperfusão persiste: estratégia liberal ou restritiva, conforme paciente e serviço. Mortalidade provavelmente igual.', 'Decl. 48, p. 895; condicional, certeza baixa'),
  r16: regra(54, 'R16. Para decidir mais volume, medidas dinâmicas em vez de exame físico ou medidas estáticas isoladas. Narrativa: aumento de 10 a 15% no parâmetro indica responsividade.', 'Decl. 49, p. 895, condicional, certeza baixa; narrativa, p. 896'),
  r17: regra(55, 'R17. Reavaliação frequente durante toda a ressuscitação. A fonte não dá intervalo numérico.', 'Decl. 10, observação; Figura 3, nota de rodapé'),
  r18: regra(61, 'R18. Choque séptico, menor de 65 anos: alvo inicial de PAM 65 mmHg em vez de alvos maiores; faixa razoável, por exemplo dentro de 5 mmHg, titulando o vasopressor. A margem de 5 mmHg no alerta é escolha de interface.', 'Decl. 13, p. 880, e observação; forte, certeza moderada'),
  r19: regra(62, 'R19. Choque séptico, 65 anos ou mais: faixa inicial de PAM 60-65 mmHg em vez de faixas maiores.', 'Decl. 14, p. 880; condicional, certeza baixa'),
  r20: regra(63, 'R20. Vasopressor indicado: noradrenalina como primeira linha.', 'Decl. 53, forte; decl. 55, condicional; p. 898'),
  r21: regra(64, 'R21. Iniciar o vasopressor por via periférica em vez de esperar o acesso central, com acesso de boa qualidade e vigilância frequente de extravasamento.', 'Decl. 12, p. 879, e observação; condicional, certeza muito baixa'),
  r22: regra(65, 'R22. PA invasiva ou não invasiva. A invasiva é aconselhada com vasopressor em dose intermediária a alta ou em escalada, vários vasopressores, coleta arterial frequente, ou PA não invasiva inconsistente.', 'Decl. 42, p. 892, e observação; condicional, certeza muito baixa'),
  r23: regra(66, 'R23. Hipotensão ou lactato elevado persiste depois do volume inicial: iniciar noradrenalina, se ainda não iniciada.', 'Figura 3, condicional, derivada da decl. 11'),
  r25: regra(73, 'R25. Choque séptico: sugere corticoide IV. Figura 3: hidrocortisona, com ou sem fludrocortisona, se a necessidade de noradrenalina persiste. Sem dose, gatilho numérico nem duração na fonte.', 'Decl. 79, p. 907, condicional, certeza baixa; Figura 3'),
  r26: regra(74, 'R26. Noradrenalina em doses crescentes: sugere associar vasopressina. Sem limiar numérico no enunciado.', 'Decl. 56, p. 898, condicional, certeza moderada; Figura 3'),
  r27: regra(75, 'R27. PAM inadequada apesar de noradrenalina mais vasopressina: sugere associar epinefrina. Sem vasopressina disponível, epinefrina junto com noradrenalina. Sem limiar numérico.', 'Decl. 57, p. 898, condicional, certeza muito baixa; Figura 3'),
  r28: regra(76, 'R28. Choque com disfunção cardíaca: noradrenalina ou epinefrina como primeira linha. Noradrenalina com taquiarritmia ou taquicardia sinusal importante; epinefrina com bradiarritmia ou bradicardia sinusal importante.', 'Decl. 58, p. 898; condicional, certeza muito baixa'),
  r29: regra(77, 'R29. Choque, disfunção cardíaca e hipoperfusão persistente apesar de volume e PA adequados: inotrópico somando ao vasopressor, nunca no lugar dele. Dobutamina somada à noradrenalina ou epinefrina isolada. Sem recomendação entre dobutamina e milrinona.', 'Decl. 60 e 61, p. 901; condicional, certeza muito baixa'),
  r30: regra(78, 'R30. Choque que não responde como esperado: conferir o controle do foco e considerar outras causas de choque.', 'Figura 3, sem grau'),
  r31: regra(84, 'R31. Avaliar rápido se há foco anatômico que exija controle de urgência. Se há, controle precoce, idealmente em até 6 h do diagnóstico; mais cedo é melhor quando viável.', 'Decl. 23, boa prática; decl. 24, p. 884, condicional, certeza muito baixa'),
  r32: regra(85, 'R32. Sepse ou choque que exige UTI: admitir em até 6 h. O texto não define o marco inicial; a sessão conta da indicação que o médico registra.', 'Decl. 15, p. 881, condicional, certeza baixa; decisão D5'),
  r33: regra(86, 'R33. Choque, depois da fase aguda: sugere retirada ativa de volume, com diurético e, se insuficiente, ultrafiltração ou remoção extracorpórea. Fase aguda: vasopressor em escalada ou em dose alta, ou volume ainda sendo expandido.', 'Decl. 89, p. 911; condicional, certeza muito baixa'),
  rPrazoVolume: regra(136, 'Prazo de 3 h dos 30 mL/kg: a sessão conta do reconhecimento, por decisão do dono.', 'Decl. 10, condicional; decisão D5'),
  rLembrete: regra(142, 'Repetir lactato, repetir enchimento capilar, reavaliar volume e titular vasopressor não têm intervalo na fonte. O lembrete é o que o próprio médico programa.', 'Seção de prazos da especificação'),
  rSem50: regra(167, 'A fonte não traz volume máximo. A narrativa só diz que os danos aparecem em geral acima de 50 mL/kg.', 'Narrativa, não enunciado; decl. 10, p. 878'),
  rSobrecarga: regra(177, 'Sobrecarga de volume e choque refratário: alerta de reavaliação, sem dose automática.', 'Regras, sem regra numérica'),
  rDrcIC: regra(159, 'Doença renal terminal e insuficiência cardíaca: o enunciado manda individualizar; a narrativa cita análise em que não receber 30 mL/kg em 3 h se associou a pior desfecho também nesses pacientes. A sessão não reduz volume por conta própria.', 'Decl. 10; narrativa, p. 878'),
  rEscopo: regra(147, 'Menor de 18 anos: fora do escopo. A diretriz pediátrica de 2026 é outro documento.', 'Triagem de fora do escopo'),
};

/* O aviso que cada item da triagem mostra. */
export const avisosTriagem = {
  menor18: 'Menor de 18 anos: a diretriz pediátrica de 2026 é outro documento.',
  gestante: 'Gestante ou puérpera: o texto de 2026 não trata de gestação. Sem regra na fonte, a sessão não improvisa.',
  outraCausa: 'Choque de outra causa dominante, ou infecção sem suspeita: a sessão não conduz esses quadros.',
  preHospitalar: 'Atendimento pré-hospitalar: esta sessão é hospitalar.',
  limitacao: 'Limitação de suporte já definida: a sessão não decide proporcionalidade. As declarações 100 e 101 pedem abordar metas de cuidado em até 72 h.',
};

/* Relato do painel: nota identificada, nunca regra nem dose. */
export const notaVasopressina = 'Prática do painel, não é recomendação: 85,1% associam, em mediana com noradrenalina de 0,3 mcg/kg/min.';
export const notaEpinefrina = 'Prática do painel, não é recomendação: 55,2% associam, em mediana com noradrenalina de 0,8 mcg/kg/min.';
export const notaCorticoide = 'Prática do painel, não é recomendação: 88,4% usam corticoide.';

const RAMOS = [
  defRamo('verossimilhanca', 'Sepse é', [
    opcaoRamo('definida', 'Definida', 'Confirmada; alternativa muito improvável'),
    opcaoRamo('provavel', 'Provável', 'A mais provável; alternativa menos provável'),
    opcaoRamo('possivel', 'Possível', 'Alternativa também provável'),
    opcaoRamo('improvavel', 'Improvável', 'Avaliação não condiz ou outra causa mais provável'),
  ]),
];
const rotuloDe = (v) => RAMOS[0].opcoes.find((o) => o.id === v)?.rotulo ?? null;

/* A classificação pode mudar durante a sessão: vale a última que o médico registrou. */
export function verossimilhanca(e) {
  let a = null;
  for (const x of e.acoes) if (x.tipo.startsWith('verossimilhanca.') && (a === null || a.hora < x.hora)) a = x;
  if (a !== null) return a.tipo.slice('verossimilhanca.'.length);
  return e.escolhas.verossimilhanca ?? null;
}

/* A hora do reconhecimento: a digitada, ou a abertura da sessão. */
export function reconhecimento(e) {
  const m = ultimo(e, 'reconhecidaHa');
  if (m) return mais(m.hora, -Math.max(0, m.valor) * 60);
  return e.inicio;
}
export function horaAntibiotico(e) {
  const h = e.acoes.filter((a) => a.tipo === 'antibiotico.dado').map((a) => a.hora);
  for (const m of e.series.antibioticoHa ?? []) h.push(mais(m.hora, -Math.max(0, m.valor) * 60));
  return h.length ? Math.min(...h) : null;
}
export function infundido(e) { return (e.series.cristaloide ?? []).map((m) => m.valor).reduce((a, b) => a + b, 0); }

/* PrazoATB: { caso: 'horas', h } | { caso: 'adiar' } | { caso: 'semRegra' } | { caso: 'falta' }.
   Linhas 29 a 32. Sem resposta sobre choque, só decide quando as duas respostas dariam o mesmo prazo. */
export function prazoAntibiotico(v, choque) {
  if (v === null) return { caso: 'falta' };
  if (choque === true && v === 'improvavel') return { caso: 'semRegra' };
  if (choque === true) return { caso: 'horas', h: 1 };
  if (v === 'definida' || v === 'provavel') return { caso: 'horas', h: 1 };
  if (choque === false && v === 'possivel') return { caso: 'horas', h: 3 };
  if (choque === false && v === 'improvavel') return { caso: 'adiar' };
  return { caso: 'falta' };
}

/* Peso de cálculo, linha 50: real; acima de IMC 30, o que o médico digitar. A sessão não calcula peso ideal. */
export function pesoDeCalculo(peso, altura, digitado) {
  if (peso === null) return { kg: null, motivo: 'Falta peso real' };
  if (altura === null || !(altura > 0)) {
    if (digitado !== null) return { kg: digitado, motivo: 'Peso de cálculo digitado, sem altura' };
    return { kg: null, motivo: 'Falta altura para saber o IMC' };
  }
  const m = altura / 100;
  const imc = peso / (m * m);
  if (imc > 30) {
    if (digitado !== null) return { kg: digitado, motivo: `IMC ${num(imc, 1)}: peso de cálculo digitado` };
    return { kg: null, motivo: `IMC ${num(imc, 1)}, acima de 30: digite o peso ajustado ou ideal` };
  }
  return { kg: peso, motivo: 'Peso real' };
}

/* Faixa do alerta de PAM. A margem de 5 mmHg abaixo de 65 anos é escolha de interface; em 65 anos ou mais vale a faixa da fonte. */
export function faixaPAM(idade) {
  if (idade === null) return null;
  return idade >= 65 ? { alvo: 'Faixa 60-65 mmHg', min: 60, max: 65, regra: R.r19 } : { alvo: 'Alvo 65 mmHg', min: 60, max: 70, regra: R.r18 };
}

const acao = (tipo, rotulo, secundaria = false) => acaoProposta(tipo, rotulo, {}, secundaria);
export function juntar(...r) {
  return regra(r[0].linha, r.map((x) => x.texto).join('\n\n'), r.map((x) => x.origem).join('. '));
}

const DEF = {
  id: 'sepse',
  nome: 'Sepse e choque séptico',
  descricao: 'Prazos, volume, PAM e vasopressor',
  idConduta: 'sepse',
  referencia: 'Prescott HC, Antonelli M et al. Surviving Sepsis Campaign: international guidelines for management of sepsis and septic shock 2026. Intensive Care Med 2026;52:863-936 (doi:10.1007/s00134-026-08361-1).',
  escopo: 'Adulto internado, com sepse possível, provável ou definida, ou choque séptico.',
  tituloRamos: 'Reconhecimento',
  rotuloProximoPasso: 'Próximo passo pela diretriz',
  tituloExames: 'Prazos',
  tituloOutrosExames: 'Outros prazos',
  rotuloPrazoExame: 'prazo até',
  tituloResolucao: null,
  parametros: [
    defParametro('reconhecidaHa', 'Reconhecida há', 'min', 0, 1440, 0),
    defParametro('idade', 'Idade', 'anos', 18, 110, 0),
    defParametro('peso', 'Peso real', 'kg', 30, 300),
    defParametro('altura', 'Altura', 'cm', 120, 230, 0),
    defParametro('pesoCalculo', 'Peso de cálculo', 'kg', 30, 300),
    defParametro('pam', 'PAM', 'mmHg', 20, 200, 0),
    defParametro('fc', 'FC', 'bpm', 20, 250, 0),
    defParametro('fr', 'FR', 'irpm', 4, 70, 0),
    defParametro('lactato', 'Lactato', 'mmol/L', 0.2, 30),
    defParametro('tec', 'Enchimento capilar', 's', 0, 15),
    defParametro('cristaloide', 'Cristaloide desta alíquota', 'mL', 0, 20000, 0),
    defParametro('nora', 'Noradrenalina', 'mcg/kg/min', 0, 3),
    defParametro('antibioticoHa', 'Antibiótico dado há', 'min', 0, 1440, 0),
    defParametro('lembreteMin', 'Lembrar de reavaliar em', 'min', 1, 1440, 0),
  ],
  parametrosIniciais: ['reconhecidaHa', 'idade', 'peso', 'altura', 'pam', 'lactato'],
  parametrosResultados: ['pam', 'fc', 'fr', 'lactato', 'tec', 'cristaloide', 'nora', 'lembreteMin', 'antibioticoHa', 'idade', 'peso', 'altura', 'pesoCalculo', 'reconhecidaHa'],
  triagem: [
    pergunta('menor18', 'Menor de 18 anos'),
    pergunta('gestante', 'Gestante ou puérpera'),
    pergunta('outraCausa', 'Choque de outra causa dominante, ou infecção sem suspeita'),
    pergunta('preHospitalar', 'Atendimento pré-hospitalar'),
    pergunta('limitacao', 'Limitação de suporte já definida'),
  ],
  perguntasIniciais: [
    pergunta('choque', 'Choque séptico?', 'Decisão do médico.'),
    pergunta('hipotensao', 'Hipotensão?', 'Exemplos da narrativa, não do enunciado: PAM abaixo de 65, PAS abaixo de 90, PAS muito abaixo da basal. Você confirma.'),
    pergunta('lactatoElevado', 'Lactato elevado?', 'Os enunciados não definem o corte. Você marca; o valor digitado não marca sozinho.'),
    pergunta('instavel', 'Choque instável?', 'Ao exame: PA muito reduzida, pele mosqueada, aspecto acinzentado, cianose ou queda de saturação, taquicardia, alteração do estado mental.'),
    pergunta('tce', 'Trauma cranioencefálico?'),
    pergunta('cirrose', 'Cirrose?'),
    pergunta('drcIC', 'Doença renal terminal ou insuficiência cardíaca?'),
  ],
  perguntasAcompanhamento: [
    pergunta('choque', 'Choque séptico?'),
    pergunta('hipotensao', 'Hipotensão?'),
    pergunta('lactatoElevado', 'Lactato elevado?'),
    pergunta('instavel', 'Choque instável?'),
    pergunta('disfuncaoCardiaca', 'Disfunção cardíaca?'),
    pergunta('sobrecarga', 'Sinais de sobrecarga de volume?'),
    pergunta('naoResponde', 'O choque não responde como esperado?'),
  ],
  /* Termos da Tabela 3, p. 874. Quem classifica é o médico. */
  ramos: RAMOS,
  exames: [
    defExame('antibiotico', 'Antibiótico', 'Prazo do antibiótico', true),
    defExame('lactato', 'Lactato', 'Prazo do lactato', true),
    defExame('volume', 'Volume', 'Prazo do volume', true),
    defExame('tec', 'Enchimento capilar', 'Prazo do enchimento capilar'),
    defExame('sinais', 'PA, FC, FR e consciência', 'Hora de reavaliar os sinais vitais'),
    defExame('foco', 'Controle do foco', 'Prazo do controle do foco'),
    defExame('uti', 'Admissão na UTI', 'Prazo da admissão na UTI'),
    defExame('lembrete', 'Lembrete seu', 'Hora da reavaliação que você programou'),
  ],
  /* Lactato e enchimento capilar sem linha: a diretriz não traz corte em enunciado. */
  graficos: [
    defGrafico('pam', 'PAM', ['pam'], { pam: [linhaGrafico(65, '65')] }),
    defGrafico('lactato', 'Lactato', ['lactato'], {}),
    defGrafico('tec', 'Enchimento capilar', ['tec'], {}),
    defGrafico('nora', 'Noradrenalina', ['nora'], {}),
  ],
  avaliar(e, agora) { return avaliar(motorSepse, e, agora); },
};

function avaliar(p, e, agora) {
  const o = orientacoes();

  /* Triagem: qualquer item marcado encerra os passos automáticos. */
  const marcados = p.triagem.filter((q) => resposta(e, q.chave) === true).map((q) => avisosTriagem[q.chave] ?? q.texto);
  if (marcados.length) { o.foraDeEscopo = marcados; return o; }
  o.triagemCompleta = p.triagem.every((q) => resposta(e, q.chave) !== null);
  if (!o.triagemCompleta) return o;

  const confirmar = acaoProposta('sepse.confirmada', 'Confirmo e inicio a contagem');
  const idade = valor(e, 'idade');
  if (idade !== null && idade < 18) {
    o.classificacao = 'Fora do escopo: idade abaixo de 18 anos';
    o.classificacaoRegra = R.rEscopo;
    o.confirmacao = painelCriterios('Reconhecimento', [], false, R.rEscopo, confirmar);
    o.travas = [trava('idade', 'Fora do escopo', `Idade ${num(idade, 0)} anos. A sessão não gera passo automático. Corrija a idade se foi erro de digitação.`, R.rEscopo)];
    return o;
  }

  const v = verossimilhanca(e);
  if (v !== null) o.ramoAtual.verossimilhanca = v;
  const choque = resposta(e, 'choque'), hipot = resposta(e, 'hipotensao'), lacEl = resposta(e, 'lactatoElevado');
  const respondida = (id, nome, b) => criterio(id, nome, b === null ? 'falta' : 'sim', b !== null ? (b ? 'Sim' : 'Não') : null);
  const rotuloV = rotuloDe(v);
  const crit = [
    criterio('verossimilhanca', 'Verossimilhança de sepse', v === null ? 'falta' : 'sim', rotuloV),
    respondida('choque', 'Choque séptico', choque),
    respondida('hipotensao', 'Hipotensão', hipot),
    respondida('lactatoElevado', 'Lactato elevado', lacEl),
  ];
  o.confirmacao = painelCriterios('Reconhecimento', crit, crit.every((c) => c.situacao === 'sim'), R.r1, confirmar);
  {
    const pam = valor(e, 'pam');
    if (hipot === null && pam !== null && pam < 65) {
      o.alertas.push(alerta('sugereHipotensao', 'amarelo', `PAM ${num(pam, 0)} mmHg, abaixo de 65: sugere hipotensão. Exemplo do texto da diretriz. Nada muda até você responder a pergunta.`, R.rD3));
    }
  }
  o.classificacao = 'Sepse: ' + (rotuloV ?? 'falta verossimilhança') + '. Choque: ' + (choque !== null ? (choque ? 'sim' : 'não') : 'falta');
  o.classificacaoRegra = v === null ? null : R.r1;

  const rec = reconhecimento(e);
  const prazo = prazoAntibiotico(v, choque);
  /* Sepse possível, provável ou definida, ou choque: é quem entra nas regras de ressuscitação. */
  const sepseAtiva = choque === true || (v !== null && v !== 'improvavel');
  const inf = infundido(e);
  const hipoperf = hipot === true || lacEl === true || choque === true ? 'sim' : (hipot === false && lacEl === false && choque === false ? 'nao' : 'falta');
  const pc = pesoDeCalculo(valor(e, 'peso'), valor(e, 'altura'), valor(e, 'pesoCalculo'));
  const meta = pc.kg !== null ? 30 * pc.kg : null;
  const noraValor = valor(e, 'nora');
  const noraCorrendo = noraValor !== null ? noraValor > 0 : teveAcao(e, 'nora.inicio');
  const faixa = faixaPAM(idade);

  o.exames = examesDevidos(p, e, agora, rec, prazo, sepseAtiva, hipoperf, hipot, lacEl, meta, inf);
  if (!teveAcao(e, 'sepse.confirmada')) return o;

  /* Alertas sem dose. */
  {
    const pam = valor(e, 'pam');
    if (choque === true && pam !== null && faixa !== null) {
      if (pam < faixa.min) {
        o.alertas.push(alerta('pamBaixa', 'vermelho', `PAM ${num(pam, 0)} mmHg abaixo de ${num(faixa.min, 0)}. ${faixa.alvo}. A sessão não sugere dose de vasopressor.`, faixa.regra));
      } else if (pam > faixa.max && noraCorrendo) {
        o.alertas.push(alerta('pamAlta', 'amarelo', `PAM ${num(pam, 0)} mmHg acima de ${num(faixa.max, 0)} com vasopressor. ${faixa.alvo}. Titular é decisão do médico.`, faixa.regra));
      }
    }
  }
  if (pc.kg !== null && inf > 50 * pc.kg) {
    o.alertas.push(alerta('volume50', 'amarelo', 'Mais de 50 mL/kg infundidos. Narrativa, não enunciado: é onde os danos em geral aparecem. A fonte não traz volume máximo; reavalie.', R.rSem50));
  }
  if (resposta(e, 'sobrecarga') === true) {
    o.alertas.push(alerta('sobrecarga', 'vermelho', 'Sobrecarga de volume marcada: reavaliar agora. Sem dose automática.', R.rSobrecarga));
  }
  if (resposta(e, 'naoResponde') === true) {
    o.alertas.push(alerta('naoResponde', 'vermelho', 'O choque não responde como esperado: conferir o controle do foco e considerar outras causas de choque.', R.r30));
  }
  if (resposta(e, 'drcIC') === true && hipoperf === 'sim') {
    o.alertas.push(alerta('drcIC', 'amarelo', 'Doença renal terminal ou insuficiência cardíaca: individualizar o volume. A narrativa cita pior desfecho sem os 30 mL/kg em 3 h também nesses pacientes. A sessão não reduz volume por conta própria.', R.rDrcIC));
  }

  o.cartoes.push(cartaoAntibiotico(e, prazo, rec));
  o.cartoes.push(cartaoHemocultura(e));
  o.cartoes.push(cartaoClassificacao(v));
  if (!sepseAtiva) return o;

  o.cartoes.push(cartaoVolume(e, agora, rec, hipoperf, hipot, lacEl, choque, pc, inf));
  const adicional = cartaoVolumeAdicional(e, hipoperf, meta, inf);
  if (adicional !== null) o.cartoes.push(adicional);
  o.cartoes.push(cartaoNoradrenalina(e, hipot, lacEl, choque, inf, noraCorrendo, noraValor));
  o.cartoes.push(cartaoPAM(e, choque, faixa, noraCorrendo));
  if (choque === true) {
    if (noraCorrendo) o.cartoes.push(cartaoSegundoVasopressor(e));
    o.cartoes.push(cartaoCorticoide(e));
    o.cartoes.push(cartaoCardiaco(e));
  }
  o.cartoes.push(cartaoLactato(e, lacEl, choque));
  o.cartoes.push(cartaoTEC(e));
  o.cartoes.push(cartaoFoco(e));
  o.cartoes.push(cartaoUTI(e, agora));
  if (choque === true) o.cartoes.push(cartaoRetirada(e));
  return o;
}

function cartaoAntibiotico(e, prazo, rec) {
  const c = cartao('antibiotico', 'Antibiótico', 'cross.vial.fill', 0x0F7F74, 'faltaDado', 'Falta classificar');
  const fora = 'Escolha, dose e duração: ferramenta Antibióticos.';
  const h = horaAntibiotico(e);
  if (h !== null) {
    c.situacao = 'correndo';
    c.valor = 'Dado às ' + hora(h);
    c.detalhe = fora;
    c.regras = [R.r7];
    return c;
  }
  switch (prazo.caso) {
    case 'falta':
      c.regras = [R.r1, R.r3];
      if (verossimilhanca(e) === null) {
        c.detalhe = 'O prazo depende da verossimilhança de sepse.';
      } else {
        c.situacao = 'pergunta';
        c.valor = 'Há choque séptico?';
        c.detalhe = 'O prazo é 1 h com choque e até 3 h na sepse possível sem choque.';
        c.pergunta = perguntaCartao('choque', 'Há choque séptico?');
      }
      break;
    case 'semRegra':
      c.situacao = 'decisaoMedico';
      c.valor = 'Choque com sepse improvável';
      c.detalhe = 'A regra de 1 h vale para choque possível, provável ou definido, e a de adiar é sem choque. Sem regra para esta combinação; considere outras causas de choque.';
      c.regras = [R.r30];
      break;
    case 'adiar':
      c.situacao = 'semIndicacao';
      c.valor = 'Sugere adiar';
      c.conta = 'Manter monitorização próxima';
      c.regras = [R.r4];
      break;
    case 'horas': {
      const hh = prazo.h;
      const limite = mais(rec, hh * 3600);
      c.situacao = 'proximoPasso';
      c.liberado = true;
      c.doses = { prazoH: hh };
      c.valor = hh === 1 ? 'Imediato, até 1 h' : 'Até 3 h, se a preocupação persistir';
      c.conta = 'Limite: ' + hora(limite) + ', contado de ' + hora(rec);
      if (hh === 1) {
        c.detalhe = fora + ' A procalcitonina não entra na decisão de iniciar.';
        c.regras = [resposta(e, 'choque') === true ? R.r1 : R.r2, R.r6, R.r7];
      } else {
        c.detalhe = 'Investigação rápida de causa infecciosa contra não infecciosa. Dar assim que infecção bacteriana for a causa mais provável. ' + fora;
        c.regras = [R.r3, R.r6, R.r7];
      }
      c.acoes = [acao('antibiotico.dado', 'Confirmar antibiótico dado agora')];
      break;
    }
  }
  return c;
}

function cartaoClassificacao(v) {
  const c = cartao('classificacao', 'Classificação da sepse', 'arrow.triangle.2.circlepath', 0x3451B2, 'decisaoMedico', rotuloDe(v) ?? 'Falta classificar');
  c.etiqueta = 'Pode mudar: quem classifica é o médico';
  c.discreto = true;
  c.regras = [R.r3];
  c.detalhe = 'Ao mudar, os prazos do antibiótico recontam do reconhecimento.';
  c.acoes = RAMOS[0].opcoes.filter((x) => x.id !== v).map((x) => acao('verossimilhanca.' + x.id, 'Mudar para ' + x.rotulo.toLowerCase(), true));
  return c;
}

function cartaoHemocultura(e) {
  const c = cartao('hemocultura', 'Hemoculturas', 'testtube.2', 0x0E7C94, 'proximoPasso', 'O mais cedo possível');
  c.regras = [R.r5];
  const h = ultimaAcao(e, 'hemocultura.colhida')?.hora ?? null;
  if (h !== null) {
    c.situacao = 'semIndicacao';
    c.valor = 'Colhidas às ' + hora(h);
    return c;
  }
  c.conta = 'Idealmente antes do antibiótico, sem atrasá-lo';
  c.detalhe = horaAntibiotico(e) !== null ? 'O antibiótico já foi dado; colher assim mesmo é decisão do médico.' : 'Número de séries e frascos individualizado.';
  c.acoes = [acao('hemocultura.colhida', 'Confirmar hemoculturas colhidas')];
  return c;
}

function textoFluido(e) {
  const tce = resposta(e, 'tce');
  if (tce === null) return 'Balanceado, exceto em TCE, que usa salina 0,9%. Falta responder sobre TCE.';
  if (tce) return 'TCE: salina 0,9%, sem albumina.';
  let t = 'Balanceado em vez de salina 0,9%. Cristaloide sozinho em vez de cristaloide mais albumina.';
  if (resposta(e, 'cirrose') === true) t += ' Com cirrose, a albumina pode ser apropriada.';
  return t;
}

function cartaoVolume(e, agora, rec, hipoperf, hipot, lacEl, choque, pc, inf) {
  const c = cartao('volume', 'Volume', 'drop.fill', 0x1F5FD1, 'pergunta', 'Há hipoperfusão?');
  c.regras = [juntar(R.r12, R.r14, R.r17)];
  if (hipoperf === 'nao') {
    c.situacao = 'semIndicacao';
    c.valor = 'Sem hipoperfusão marcada';
    return c;
  }
  if (hipoperf === 'falta') {
    /* Uma pergunta por vez; nada vira normal sem resposta. */
    const chave = hipot === null ? 'hipotensao' : lacEl === null ? 'lactatoElevado' : 'choque';
    const texto = hipot === null ? 'Há hipotensão?' : lacEl === null ? 'O lactato está elevado?' : 'Há choque séptico?';
    c.detalhe = 'A regra de volume é para hipoperfusão, por hipotensão, lactato elevado ou choque.';
    c.pergunta = perguntaCartao(chave, texto);
    return c;
  }
  const limite = mais(rec, 3 * 3600);
  const kg = pc.kg;
  if (kg === null) {
    c.situacao = 'faltaDado';
    c.valor = 'Falta peso';
    c.conta = pc.motivo;
    const real = valor(e, 'peso');
    if (real !== null) c.detalhe = `Com o peso real de ${num(real, 1)} kg seriam ${num(30 * real, 0)} mL, válido só com IMC até 30.`;
    return c;
  }
  const meta = 30 * kg;
  const falta = Math.max(0, meta - inf);
  c.doses = { mlKg: 30, metaML: meta, faltaML: falta };
  c.conta = `30 mL/kg x ${num(kg, 1)} kg. Infundido ${num(inf, 0)} mL`;
  if (falta > 0) {
    c.liberado = true;
    c.situacao = 'proximoPasso';
    c.valor = `Ao menos ${num(meta, 0)} mL até ${hora(limite)}`;
    c.detalhe = `Faltam ${num(falta, 0)} mL. ${pc.motivo}. ` + textoFluido(e) + ' Registre cada alíquota em Novos resultados. Reavaliação frequente; a fonte não dá intervalo.';
  } else {
    /* Fica em curso para o total infundido constar da passagem de plantão. */
    c.situacao = 'correndo';
    c.valor = 'Meta inicial atingida';
  }
  return c;
}

function cartaoVolumeAdicional(e, hipoperf, meta, inf) {
  if (!(hipoperf === 'sim' && meta !== null && inf >= meta)) return null;
  const c = cartao('volumeAdicional', 'Depois dos 30 mL/kg', 'drop.triangle.fill', 0x1F5FD1, 'pergunta', 'Meta inicial atingida');
  c.regras = [juntar(R.r15, R.r16)];
  const p = resposta(e, 'hipoperfusaoPersiste');
  if (p === null) {
    c.pergunta = perguntaCartao('hipoperfusaoPersiste', 'A hipoperfusão persiste?');
    return c;
  }
  if (!p) {
    c.situacao = 'semIndicacao';
    c.valor = 'Hipoperfusão não persiste';
    return c;
  }
  c.situacao = 'decisaoMedico';
  c.etiqueta = 'A diretriz aceita as duas: decisão do médico';
  c.pergunta = perguntaCartao('hipoperfusaoPersiste', 'A hipoperfusão ainda persiste?');
  const est = ultimaAcao(e, 'volume.liberal', 'volume.restritiva');
  if (est !== null) {
    c.valor = est.tipo === 'volume.liberal' ? 'Estratégia liberal' : 'Estratégia restritiva';
    c.conta = 'Decidida às ' + hora(est.hora);
  } else {
    c.valor = 'Liberal ou restritiva';
    c.conta = 'A sessão não escolhe. Mortalidade provavelmente igual';
    c.acoes = [acao('volume.liberal', 'Registrar estratégia liberal'), acao('volume.restritiva', 'Registrar estratégia restritiva')];
  }
  let d = 'Pesar a condição atual, doenças crônicas como insuficiência cardíaca e a disponibilidade de leito monitorado. Para decidir mais volume, medidas dinâmicas em vez de exame físico ou medidas estáticas isoladas.';
  const t = ultimaAcao(e, 'teste.responsivo', 'teste.naoResponsivo');
  if (t !== null) {
    d += ' Último teste dinâmico: ' + (t.tipo === 'teste.responsivo' ? 'responsivo' : 'não responsivo') + ' às ' + hora(t.hora) + '.';
  }
  c.detalhe = d;
  c.acoes = [...c.acoes, acao('teste.responsivo', 'Teste dinâmico: responsivo', true), acao('teste.naoResponsivo', 'Teste dinâmico: não responsivo', true)];
  return c;
}

function cartaoNoradrenalina(e, hipot, lacEl, choque, inf, correndo, valorNora) {
  const c = cartao('noradrenalina', 'Noradrenalina', 'syringe.fill', 0xA8327E, 'pergunta', 'Há hipotensão?');
  c.regras = [juntar(R.r20, R.r21, R.r22)];
  const notaVia = 'Por via periférica em vez de esperar o acesso central, com vigilância de extravasamento. A fonte não traz dose inicial, máxima nem desmame.';
  if (correndo) {
    c.situacao = 'correndo';
    c.valor = 'Em curso';
    c.conta = valorNora !== null ? `${num(valorNora)} mcg/kg/min, registrado por você` : 'Dose não registrada';
    c.detalhe = 'Titular é decisão do médico. PA invasiva é aconselhada com dose intermediária a alta, escalada ou vários vasopressores.';
    return c;
  }
  const inicio = () => [acao('nora.inicio', 'Confirmar início da noradrenalina')];
  if (resposta(e, 'instavel') === true) {
    c.situacao = 'decisaoMedico';
    c.valor = 'Junto com o volume, caso a caso';
    c.detalhe = 'Choque instável marcado. ' + notaVia;
    c.regras = [juntar(R.r13, R.r20, R.r21)];
    c.acoes = inicio();
    return c;
  }
  if (!(hipot === true || lacEl === true || choque === true)) {
    if (hipot === null) {
      c.pergunta = perguntaCartao('hipotensao', 'Há hipotensão?');
    } else {
      c.situacao = 'semIndicacao';
      c.valor = 'Sem hipotensão marcada';
    }
    return c;
  }
  if (inf <= 0) {
    c.situacao = 'semIndicacao';
    c.valor = 'Depois do bólus inicial';
    c.conta = 'Se a hipotensão persistir';
    c.regras = [R.r13];
    return c;
  }
  c.regras = [juntar(R.r23, R.r20, R.r21)];
  const persiste = resposta(e, 'persisteAposVolume');
  if (persiste === null) {
    c.valor = 'Persiste depois do volume?';
    c.pergunta = perguntaCartao('persisteAposVolume', 'A hipotensão ou o lactato elevado persistem depois do volume inicial?');
    return c;
  }
  if (!persiste) {
    c.situacao = 'semIndicacao';
    c.valor = 'Não persiste depois do volume';
    return c;
  }
  c.situacao = 'proximoPasso';
  c.liberado = true;
  c.valor = 'Iniciar noradrenalina';
  c.detalhe = notaVia;
  c.acoes = inicio();
  return c;
}

function cartaoPAM(e, choque, faixa, correndo) {
  const c = cartao('pam', 'PAM', 'gauge.with.dots.needle.33percent', 0x6D3FD6, 'pergunta', 'Há choque séptico?');
  c.regras = [R.r18, R.r19];
  if (choque === null) {
    c.pergunta = perguntaCartao('choque', 'Há choque séptico?');
    return c;
  }
  if (!choque) {
    c.situacao = 'semIndicacao';
    c.valor = 'Alvo só no choque séptico';
    return c;
  }
  if (faixa === null) {
    c.situacao = 'faltaDado';
    c.valor = 'Falta idade';
    c.detalhe = 'O alvo muda aos 65 anos: 65 mmHg antes e faixa 60-65 mmHg depois.';
    return c;
  }
  c.regras = [faixa.regra];
  c.doses = { min: faixa.min, max: faixa.max };
  c.liberado = true;
  c.valor = faixa.alvo;
  const pam = ultimo(e, 'pam');
  if (pam === null) {
    c.situacao = 'faltaDado';
    c.conta = 'Falta PAM';
    return c;
  }
  c.situacao = 'correndo';
  c.conta = `PAM ${num(pam.valor, 0)} mmHg às ` + hora(pam.hora);
  if (faixa.regra === R.r18) c.detalhe = 'O alerta usa 60 a 70 mmHg. A margem de 5 mmHg é escolha de interface; a observação da decl. 13 diz: faixa razoável, por exemplo dentro de 5 mmHg.';
  return c;
}

/* O cartão de vasopressores muda de assunto conforme o degrau. Como o id2 do Swift: primeiro e noTopo voltam ao padrão. */
function id2(c, novoId, titulo) {
  c.id = novoId;
  c.titulo = titulo;
  c.primeiro = false;
  c.noTopo = false;
}

function cartaoSegundoVasopressor(e) {
  const c = cartao('vasopressina', 'Vasopressina', 'syringe', 0x3451B2, 'pergunta', 'Dose crescente?');
  c.regras = [R.r26];
  const semVaso = teveAcao(e, 'vaso.indisponivel');
  const vaso = ultimaAcao(e, 'vaso.inicio');
  const epi = ultimaAcao(e, 'epi.inicio');
  if (epi !== null) {
    id2(c, 'epinefrina', 'Epinefrina');
    c.situacao = 'correndo';
    c.valor = 'Registrada às ' + hora(epi.hora);
    c.detalhe = 'A fonte não traz dose.';
    c.regras = [R.r27];
    return c;
  }
  if (vaso !== null || semVaso) {
    id2(c, 'epinefrina', 'Epinefrina');
    c.regras = [R.r27];
    if (semVaso) {
      c.situacao = 'proximoPasso';
      c.liberado = true;
      c.valor = 'Epinefrina junto com a noradrenalina';
      c.detalhe = 'Sem vasopressina disponível. A fonte não traz limiar nem dose. ' + notaEpinefrina;
      c.acoes = [acao('epi.inicio', 'Registrar epinefrina iniciada')];
      return c;
    }
    const inadequada = resposta(e, 'pamInadequada');
    if (inadequada === null) {
      c.valor = 'PAM inadequada?';
      c.detalhe = 'Com noradrenalina mais vasopressina. Sem limiar numérico na fonte: você decide.';
      c.pergunta = perguntaCartao('pamInadequada', 'A PAM está inadequada apesar de noradrenalina mais vasopressina?');
      return c;
    }
    if (!inadequada) {
      id2(c, 'vasopressina', 'Vasopressina');
      c.situacao = 'correndo';
      c.valor = 'Registrada às ' + hora(vaso?.hora ?? e.inicio);
      c.detalhe = 'A fonte não traz dose.';
      c.regras = [R.r26];
      c.pergunta = perguntaCartao('pamInadequada', 'A PAM está inadequada apesar de noradrenalina mais vasopressina?');
      return c;
    }
    c.situacao = 'proximoPasso';
    c.liberado = true;
    c.valor = 'Sugere associar epinefrina';
    c.detalhe = 'Terceira linha. A fonte não traz limiar nem dose. ' + notaEpinefrina;
    c.acoes = [acao('epi.inicio', 'Registrar epinefrina iniciada')];
    return c;
  }
  const subindo = resposta(e, 'noraCrescente');
  if (subindo === null) {
    c.detalhe = 'Sem limiar numérico no enunciado: você decide.';
    c.pergunta = perguntaCartao('noraCrescente', 'A dose de noradrenalina está aumentando?');
    return c;
  }
  if (!subindo) {
    c.situacao = 'semIndicacao';
    c.valor = 'Noradrenalina sem aumento';
    return c;
  }
  c.situacao = 'proximoPasso';
  c.liberado = true;
  c.valor = 'Sugere associar vasopressina';
  c.detalhe = 'A fonte não traz limiar nem dose. ' + notaVasopressina;
  c.acoes = [acao('vaso.inicio', 'Registrar vasopressina iniciada'), acao('vaso.indisponivel', 'Sem vasopressina disponível', true)];
  return c;
}

function cartaoCorticoide(e) {
  const c = cartao('corticoide', 'Corticoide', 'pills.fill', 0xA8530A, 'decisaoMedico', 'Sugere corticoide IV');
  c.etiqueta = 'Sugestão sem dose nem gatilho';
  c.regras = [R.r25];
  const h = ultimaAcao(e, 'corticoide.inicio')?.hora ?? null;
  if (h !== null) {
    c.situacao = 'correndo';
    c.etiqueta = null;
    c.valor = 'Registrado às ' + hora(h);
    c.detalhe = 'A fonte não traz dose nem duração.';
    return c;
  }
  c.detalhe = 'Figura 3: hidrocortisona, com ou sem fludrocortisona, se a necessidade de noradrenalina persiste. A diretriz não traz dose, gatilho numérico nem duração. ' + notaCorticoide;
  c.acoes = [acao('corticoide.inicio', 'Registrar corticoide iniciado')];
  return c;
}

function cartaoCardiaco(e) {
  const c = cartao('cardiaco', 'Disfunção cardíaca', 'heart.fill', 0xB91C1C, 'pergunta', 'Há disfunção cardíaca?');
  c.regras = [R.r28];
  const d = resposta(e, 'disfuncaoCardiaca');
  if (d === null) {
    c.detalhe = 'Suspeita por ecocardiograma à beira do leito ou monitor de débito cardíaco.';
    c.pergunta = perguntaCartao('disfuncaoCardiaca', 'Há disfunção cardíaca?');
    c.discreto = true;
    return c;
  }
  if (!d) {
    c.situacao = 'semIndicacao';
    c.valor = 'Não marcada';
    return c;
  }
  const hp = resposta(e, 'hipoperfusaoComPA');
  if (hp === null) {
    c.valor = 'Noradrenalina ou epinefrina';
    c.detalhe = 'Noradrenalina com taquiarritmia ou taquicardia sinusal importante; epinefrina com bradiarritmia ou bradicardia sinusal importante.';
    c.pergunta = perguntaCartao('hipoperfusaoComPA', 'Hipoperfusão persistente apesar de volume e PA adequados?');
    return c;
  }
  if (!hp) {
    c.situacao = 'decisaoMedico';
    c.valor = 'Noradrenalina ou epinefrina';
    c.detalhe = 'Noradrenalina com taquiarritmia ou taquicardia sinusal importante; epinefrina com bradiarritmia ou bradicardia sinusal importante.';
    c.pergunta = perguntaCartao('hipoperfusaoComPA', 'Hipoperfusão persistente apesar de volume e PA adequados?');
    return c;
  }
  c.regras = [R.r29];
  const i = ultimaAcao(e, 'inotropico.dobutamina', 'inotropico.epinefrina');
  if (i !== null) {
    c.situacao = 'correndo';
    c.valor = (i.tipo === 'inotropico.dobutamina' ? 'Dobutamina somada' : 'Epinefrina isolada') + ' às ' + hora(i.hora);
    c.detalhe = 'A fonte não traz dose.';
    return c;
  }
  c.situacao = 'proximoPasso';
  c.liberado = true;
  c.valor = 'Sugere inotrópico somando ao vasopressor';
  c.conta = 'Nunca no lugar dele';
  c.detalhe = 'Dobutamina somada à noradrenalina ou epinefrina isolada. Sem recomendação entre dobutamina e milrinona. A fonte não traz dose.';
  c.acoes = [acao('inotropico.dobutamina', 'Registrar dobutamina somada'), acao('inotropico.epinefrina', 'Registrar epinefrina isolada')];
  return c;
}

function cartaoLactato(e, lacEl, choque) {
  const c = cartao('lactato', 'Lactato', 'chart.line.uptrend.xyaxis', 0x0E7C94, 'faltaDado', 'Falta lactato');
  c.regras = [R.r9];
  const l = ultimo(e, 'lactato');
  if (l === null) {
    c.detalhe = 'A Figura 3 pede em até 1 h do reconhecimento.';
    return c;
  }
  c.valor = `${num(l.valor)} mmol/L`;
  c.conta = 'Às ' + hora(l.hora);
  if (lacEl === null) {
    c.situacao = 'pergunta';
    c.detalhe = 'Os enunciados não definem o corte: você marca.';
    c.pergunta = perguntaCartao('lactatoElevado', 'O lactato está elevado?');
    return c;
  }
  if (lacEl === true || choque === true) {
    c.situacao = 'correndo';
    c.regras = [juntar(R.r11, R.rLembrete)];
    c.detalhe = 'Lactato seriado, sem intervalo na fonte. Individualizar o volume pela queda, em vez de dar volume até normalizar. Não confiar em um só marcador.';
  } else {
    c.situacao = 'semIndicacao';
    c.detalhe = 'Marcado como não elevado por você.';
  }
  return c;
}

function cartaoTEC(e) {
  const c = cartao('tec', 'Enchimento capilar', 'hand.point.up.left.fill', 0x0E7C94, 'faltaDado', 'Falta medir');
  c.regras = [R.r10];
  c.detalhe = 'Figura 3: em até 1 h. Adjunto de outras medidas de perfusão, considerando luz, temperatura, pigmentação da pele e doença vascular periférica. Referência dos estudos: até 3 s; não é meta da diretriz.';
  c.discreto = true;
  const t = ultimo(e, 'tec');
  if (t !== null) {
    c.situacao = 'correndo';
    c.valor = `${num(t.valor, 1)} s`;
    c.conta = 'Às ' + hora(t.hora);
  }
  return c;
}

function cartaoFoco(e) {
  const c = cartao('foco', 'Controle do foco', 'scope', 0x3451B2, 'pergunta', 'Avaliar rápido');
  c.regras = [R.r31];
  const f = resposta(e, 'focoControle');
  if (f === null) {
    c.detalhe = 'Sem resposta, fica pendente.';
    c.pergunta = perguntaCartao('focoControle', 'Há foco anatômico que exige controle de urgência?');
    return c;
  }
  if (!f) {
    c.situacao = 'semIndicacao';
    c.valor = 'Sem foco que exija controle';
    return c;
  }
  const h = ultimaAcao(e, 'foco.controlado')?.hora ?? null;
  if (h !== null) {
    c.situacao = 'semIndicacao';
    c.valor = 'Controle registrado às ' + hora(h);
    return c;
  }
  c.situacao = 'proximoPasso';
  c.liberado = true;
  c.valor = 'Controle precoce';
  c.conta = 'Idealmente em até 6 h do diagnóstico';
  c.detalhe = 'Mais cedo é melhor quando viável.';
  c.doses = { prazoH: 6 };
  c.acoes = [acao('foco.controlado', 'Confirmar controle do foco')];
  return c;
}

function cartaoUTI(e, agora) {
  const c = cartao('uti', 'UTI', 'bed.double.fill', 0x0F7F74, 'decisaoMedico', 'Exige UTI?');
  c.etiqueta = 'Você registra a indicação';
  c.regras = [R.r32];
  c.discreto = true;
  const adm = ultimaAcao(e, 'uti.admitido')?.hora ?? null;
  if (adm !== null) {
    c.situacao = 'semIndicacao';
    c.etiqueta = null;
    c.valor = 'Admissão registrada às ' + hora(adm);
    return c;
  }
  const h = ultimaAcao(e, 'uti.indicada')?.hora ?? null;
  if (h !== null) {
    c.situacao = 'proximoPasso';
    c.etiqueta = null;
    c.discreto = false;
    c.liberado = true;
    c.valor = 'Admitir até ' + hora(mais(h, 6 * 3600));
    c.conta = 'Indicação registrada às ' + hora(h);
    c.doses = { prazoH: 6 };
    c.acoes = [acao('uti.admitido', 'Confirmar admissão na UTI')];
    return c;
  }
  c.detalhe = 'A fonte pede admissão em até 6 h e não define o marco. A contagem começa quando você registra a indicação.';
  c.acoes = [acao('uti.indicada', 'Registrar indicação de UTI agora')];
  return c;
}

function cartaoRetirada(e) {
  const c = cartao('retirada', 'Depois da fase aguda', 'arrow.down.circle.fill', 0x3451B2, 'pergunta', 'Saiu da fase aguda?');
  c.regras = [R.r33];
  c.discreto = true;
  const saiu = resposta(e, 'saiuFaseAguda');
  if (saiu === null) {
    c.detalhe = 'Fase aguda: vasopressor em escalada ou em dose alta, ou volume ainda sendo expandido. Sem prazo em horas na fonte.';
    c.pergunta = perguntaCartao('saiuFaseAguda', 'Saiu da fase aguda?');
    return c;
  }
  if (!saiu) {
    c.situacao = 'semIndicacao';
    c.valor = 'Ainda na fase aguda';
    return c;
  }
  c.situacao = 'decisaoMedico';
  c.discreto = false;
  c.valor = 'Sugere retirada ativa de volume';
  c.detalhe = 'Diurético e, se insuficiente, ultrafiltração ou remoção extracorpórea. Considerar função cardiorrespiratória, dose de vasopressor, evolução, edema, peso e balanço hídrico. A fonte não traz dose.';
  c.pergunta = perguntaCartao('saiuFaseAguda', 'Saiu da fase aguda?');
  return c;
}

function examesDevidos(p, e, agora, rec, prazo, sepseAtiva, hipoperf, hipot, lacEl, meta, inf) {
  const def = (id) => p.exames.find((x) => x.id === id);
  const montar = (id, ultima, proxima, r, encerrado = false, semDado = 'responda') => {
    const d = def(id);
    let s;
    if (encerrado) s = 'encerrado';
    else if (proxima === null) s = 'semDado';
    else if (agora > proxima) s = 'vencido';
    else s = 'noPrazo';
    return exameDevido({ id, nome: d.nome, aviso: d.aviso, destaque: d.destaque, ultima, janelaInicio: null, proxima, situacao: s, regra: r, rotuloSemDado: semDado });
  };
  const r = [];
  const horaATB = horaAntibiotico(e);
  if (prazo.caso === 'horas') {
    const h = prazo.h;
    r.push(montar('antibiotico', horaATB, mais(rec, h * 3600), h === 3 ? R.r3 : (resposta(e, 'choque') === true ? R.r1 : R.r2), horaATB !== null));
  } else if (prazo.caso === 'falta') {
    r.push(montar('antibiotico', horaATB, null, R.r1, horaATB !== null));
  }
  if (sepseAtiva) {
    const ul = primeiro(e, 'lactato')?.hora ?? null;
    r.push(montar('lactato', ul, mais(rec, 3600), R.r9, ul !== null));
    if (hipoperf === 'sim') {
      const atingido = meta !== null ? inf >= meta : false;
      r.push(montar('volume', null, mais(rec, 3 * 3600), R.rPrazoVolume, atingido));
    } else if (hipoperf === 'falta') {
      r.push(montar('volume', null, null, R.rPrazoVolume));
    }
    const ut = primeiro(e, 'tec')?.hora ?? null;
    r.push(montar('tec', ut, mais(rec, 3600), R.r10, ut !== null));
    if (hipot === true || lacEl === true) {
      const hs = [ultimo(e, 'pam')?.hora, ultimo(e, 'fc')?.hora, ultimo(e, 'fr')?.hora].filter((x) => x !== undefined && x !== null);
      const us = hs.length ? Math.max(...hs) : null;
      r.push(montar('sinais', us, us !== null ? mais(us, 3600) : null, R.r8, false, 'registrar'));
    }
    const f = resposta(e, 'focoControle');
    if (f !== null) {
      if (f) r.push(montar('foco', null, mais(rec, 6 * 3600), R.r31, teveAcao(e, 'foco.controlado')));
    } else {
      r.push(montar('foco', null, null, R.r31));
    }
    const h = ultimaAcao(e, 'uti.indicada')?.hora ?? null;
    if (h !== null) {
      r.push(montar('uti', null, mais(h, 6 * 3600), R.r32, teveAcao(e, 'uti.admitido')));
    }
  }
  const m = ultimo(e, 'lembreteMin');
  if (m !== null) {
    r.push(montar('lembrete', null, mais(m.hora, Math.max(0, m.valor) * 60), R.rLembrete));
  }
  return r;
}

export const regrasSepse = R;
export const motorSepse = criarProtocolo(DEF);
export default motorSepse;

/* Adaptadores para o teste diferencial (Ponte.swift, compararFuncao): entrada e saída em JSON simples. */
export const funcoesTeste = {
  prazoAntibiotico: (v, choque) => prazoAntibiotico(v, choque),
  pesoDeCalculo: (peso, altura, digitado) => pesoDeCalculo(peso, altura, digitado),
  faixaPAM: (idade) => faixaPAM(idade),
  reconhecimento: (e) => reconhecimento(e),
  horaAntibiotico: (e) => horaAntibiotico(e),
  infundido: (e) => infundido(e),
  verossimilhanca: (e) => verossimilhanca(e),
  regras: () => R,
  regra: (nome) => R[nome] ?? null,
};
