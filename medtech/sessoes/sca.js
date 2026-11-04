/* Síndrome coronariana aguda: IAM com supra e SCA sem supra. Porta fiel de MotorSCA.swift (app iOS).
   Especificação: docs/sessao_sca_regras.md do app (ACC/AHA 2025, conferida na íntegra). O número de cada regra é a linha
   do arquivo de regras, e a origem está escrita naquela linha. Não mudar regra aqui sem mudar no Swift: o teste diferencial reprova.
   Representações (o Swift usa enums): Tres 'sim'|'nao'|'falta'; janela 'menos12'|'de12a24'|'mais24'|'desconhecida';
   motivo da ICP 1..6 (MOTIVO); plano { k: 'passo'|'icp'|'fibrinolise'|'naoICP'|'falta'|'semRegra', ... };
   faixa de risco { k: 'instavel'|'alto'|'intermediario'|'baixo'|'escolher'|'falta', x? }. */
import {
  criarProtocolo, defParametro, pergunta, defExame, defGrafico, linhaGrafico, regra, itemPasso, opcaoRamo,
  orientacoes, cartao, alerta, trava, acaoProposta, perguntaCartao, exameDevido, passoGuiado,
  tipoHora, tipoOpcoes, tipoSimNao, tipoNumero, tipoLista,
  ultimo, primeiro, valor, resposta, ultimaAcao, teveAcao, num, hora, duracao, desde, mais, inteiro,
} from './nucleo.js';

/* LINHA D8 DA ESPECIFICAÇÃO: CKD-EPI 2021, DECISÃO DO MÉDICO EM 02/11/2026.
   A ACC escreve "CrCl" e não define o método. Trocar o método é mudar só esta constante: rótulo, unidade, conta e cortes acompanham. */
export const METODOS = {
  ckdEpi2021: { id: 'ckdEpi2021', nome: 'CKD-EPI 2021', unidade: 'mL/min/1,73 m²' },
  cockcroftGault: { id: 'cockcroftGault', nome: 'Cockcroft-Gault', unidade: 'mL/min' },
};
export const metodoCrCl = 'ckdEpi2021';
const M = (m) => METODOS[m];

export const perguntasInstabilidade = [
  pergunta('choque', 'Choque?'),
  pergunta('ic', 'Insuficiência cardíaca?'),
  pergunta('arritmia', 'Arritmia ventricular?'),
  pergunta('dorRefrat', 'Dor refratária?'),
];

/* Regras: o número é a linha de docs/sessao_sca_regras.md; a origem está escrita nessa linha. */
const R = {
  rEscopo: regra(247, 'Doença renal em diálise: sem dose na fonte lida e sem passo automático. CrCl abaixo de 15 mL/min: sem dose por função renal na fonte lida; a ICP fica como decisão do médico (decisão de 02/11/2026).', 'Especificação, seção 6: sem dose na fonte lida'),
  rEscopoIdade: regra(248, 'Menor de 18 anos: fora do escopo. Sem passo automático.', 'Especificação, seção 6: Menor de 18 anos'),
  rT1: regra(39, 'Registrar e interpretar ECG de 12 derivações em até 10 min da apresentação.', 'ACC 3.1.1 rec 1 e 3.1.2 rec 1: COR 1, LOE B-NR'),
  rT2: regra(40, 'ECG inicial não diagnóstico com dor persistente, suspeita alta ou piora clínica: ECG seriado, comparar com anterior. O ECG normal não afasta SCA.', 'ACC 3.1.2 rec 2: COR 1, B-NR'),
  rT3: regra(41, 'IAM inferior: V3R e V4R. Depressão isolada de ST de 0,5 mm ou mais em V1-V3: V7-V9.', 'ACC Tabela 3 e texto 3.1.1 e 3.1.2'),
  rT4: regra(42, 'Supra novo de 1 mm ou mais em 2 ou mais derivações contíguas fora de V2-V3. Em V2-V3: 2 mm ou mais em homem de 40 anos ou mais, 2,5 mm ou mais em homem com menos de 40, 1,5 mm ou mais em mulher. BRE novo não é diagnóstico isolado; em assintomático não é equivalente.', 'ACC Tabela 3 e notas'),
  rT5: regra(43, 'Depressão horizontal ou descendente de ST de 0,5 mm ou mais, inversão de T maior que 1 mm com R proeminente ou R/S maior que 1, ou supra transitório: caminho sem supra. Em ECG normal a SCA continua possível.', 'ACC Tabela 3 e texto 3.1.1'),
  rT6: regra(44, 'ECG com supra: não esperar troponina para reperfundir.', 'ACC texto 3.1.2 (classe não lida)'),
  rT7: regra(45, 'Choque, insuficiência cardíaca, arritmia ventricular ou dor refratária muda o caminho. Ecocardiograma urgente à beira do leito se choque, instabilidade ou suspeita de complicação mecânica.', 'ACC 5.2.1 rec 2 (COR 1, B-R), 6.1 rec 3 (COR 1, C-LD), texto 3.1.2 (classe não lida)'),
  rT8: regra(46, 'Insuficiência cardíaca, arritmia ventricular ou choque na triagem: triar para hospital com ICP quando possível.', 'ACC texto 3.1.1 (classe não lida)'),
  rS1: regra(52, 'Sintomas há menos de 12 h: ICP primária com meta FMC ao dispositivo de 90 min ou menos, ou 120 min ou menos se precisar de transferência.', 'ACC 5.2.1 rec 1: COR 1, LOE A'),
  rS2: regra(53, 'FMC ao dispositivo projetado de 120 min ou menos: transferir ou manter para ICP primária.', 'ACC 5.3 rec 1: COR 1, A'),
  rS3: regra(54, 'Projetado maior que 120 min, sintomas há menos de 12 h, sem contraindicação: fibrinólise e estratégia fármaco-invasiva.', 'ACC 5.3 rec 2: COR 1, A'),
  rS4: regra(55, 'Qualquer contraindicação absoluta: transferir para ICP primária mesmo com tempo maior que 120 min.', 'ACC 5.3 rec 1: COR 1, A'),
  rS5: regra(56, 'Choque ou instabilidade hemodinâmica, em qualquer hora: revascularização de emergência da artéria culpada (ICP ou cirurgia). Em choque, ICP primária o mais cedo possível, idealmente em até 90 min, sem ICP de rotina de artéria não culpada (dano).', 'ACC 5.2.1 rec 2 e 8.1 rec 1: COR 1, B-R; 8.1 rec 2: COR 3 (dano), B-R'),
  rS6: regra(57, 'Sintomas de 12 a 24 h: transferir para ICP é razoável; ICP primária é razoável.', 'ACC 5.3 rec 3: COR 2a, B-NR; 5.2.1 rec 3: COR 2a, B-NR'),
  rS6b: regra(58, 'Sintomas de 12 h ou mais com instabilidade ou grande área em risco, ICP indisponível: considerar fibrinólise; transferir logo em seguida.', 'ACC texto 5.3 e 5.3.1 (classe não lida)'),
  rS6c: regra(59, 'Mais de 24 h com isquemia em curso, insuficiência cardíaca grave ou arritmia ameaçadora: ICP é razoável.', 'ACC 5.2.1 rec 4: COR 2a, C-LD'),
  rS6d: regra(60, 'Mais de 24 h, estável, assintomático, artéria totalmente ocluída: não fazer ICP (sem benefício).', 'ACC 5.2.1 rec 5: COR 3 (sem benefício), B-R'),
  rS6e: regra(61, 'Só depressão de ST, sem suspeita de IAM posterior verdadeiro: não fibrinolisar (dano).', 'ACC 5.3 rec 4: COR 3 (dano), B-R'),
  rCI: regra(65, 'Qualquer item absoluto bloqueia a fibrinólise. Item relativo gera alerta e exige decisão do médico. A tabela é orientadora e não exaustiva.', 'Tabela 14 da ACC'),
  rS9: regra(76, 'Preferir agente fibrino-específico (tenecteplase, alteplase ou reteplase); estreptoquinase não é fibrino-específica.', 'ACC texto 5.3.1 e Tabela 13. ESC: COR I, B'),
  rS9a: regra(77, 'Tenecteplase em bólus único IV: menos de 60 kg, 30 mg; 60-69 kg, 35 mg; 70-79 kg, 40 mg; 80-89 kg, 45 mg; 90 kg ou mais, 50 mg.', 'ACC Tabela 13'),
  rS9b: regra(78, 'Alteplase, 67 kg ou mais: 15 mg em bólus; 50 mg em 30 min; depois 35 mg em 60 min (total 100 mg).', 'ACC Tabela 13'),
  rS9c: regra(79, 'Alteplase, menos de 67 kg: 15 mg em bólus; 0,75 mg/kg em 30 min (máximo 50 mg); depois 0,5 mg/kg em 60 min (máximo 35 mg).', 'ACC Tabela 13'),
  rS9d: regra(80, 'Reteplase: dois bólus de 10 U, 30 min de intervalo, cada um em 2 min.', 'ACC Tabela 13'),
  rS9e: regra(81, 'Idade maior que 75 anos: a ACC não traz ajuste. A ESC considera meia dose de tenecteplase. O médico escolhe.', 'ESC: COR IIa, B. ACC: sem regra'),
  rS9f: regra(82, 'Clopidogrel com fibrinólise, 75 anos ou menos: ataque de 300 mg, depois 75 mg/dia.', 'ACC 4.3.2 rec 9: COR 1, A; Tabela 7'),
  rS9g: regra(83, 'Clopidogrel com fibrinólise, mais de 75 anos: sem ataque, 75 mg na dose inicial, depois 75 mg/dia.', 'ACC Tabela 7 e texto'),
  rS9h: regra(84, 'AAS com fibrinólise: ataque de 162-325 mg mastigado, depois 75-100 mg/dia.', 'ACC 4.3.1 rec 1: COR 1, A'),
  rDuracao: regra(88, 'Manter o anticoagulante por toda a internação (no máximo 8 dias) ou até a revascularização.', 'ACC 4.4 rec 9: COR 1, A'),
  rS10a: regra(92, 'Enoxaparina com fibrinólise, menos de 75 anos, CrCl 30 ou mais: 30 mg IV; 15 min depois 1 mg/kg SC a cada 12 h; máximo 100 mg nas duas primeiras doses SC.', 'ACC Tabela de anticoagulantes; 4.4 rec 10: COR 1, A'),
  rS10b: regra(93, 'Enoxaparina com fibrinólise, 75 anos ou mais: sem bólus; 0,75 mg/kg SC a cada 12 h; máximo 75 mg nas duas primeiras doses.', 'ACC Tabela de anticoagulantes; 4.4 rec 10: COR 1, A'),
  rS10c: regra(94, 'Enoxaparina com fibrinólise, CrCl abaixo de 30: 1 mg/kg SC a cada 24 h, em qualquer idade.', 'ACC Tabela de anticoagulantes; 4.4 rec 10: COR 1, A'),
  rS10d: regra(95, 'HNF com fibrinólise: bólus de 60 UI/kg, máximo 4.000 UI; infusão de 12 UI/kg/h, máximo 1.000 UI/h; TTPa de 50-70 s.', 'ACC Tabela 10 e nota'),
  rS10e: regra(96, 'Fondaparinux com fibrinólise, CrCl 30 ou mais: 2,5 mg IV; depois 2,5 mg SC por dia a partir do dia seguinte. Contraindicado com CrCl abaixo de 30. Não usar se houver ICP prevista.', 'ACC 4.4 rec 11: COR 1, B-R; rec 8: COR 3 (dano), B-R'),
  rS11: regra(102, 'Fibrinólise iniciada: transferir imediatamente para centro com hemodinâmica.', 'ACC 5.3.2 rec 1: COR 1, A'),
  rS12: regra(103, 'Sem melhora dos sintomas, resolução de ST menor que 50% nas anteriores ou menor que 70% nas inferiores, ou instabilidade hemodinâmica ou elétrica: angiografia imediata com ICP de resgate.', 'ACC 5.3.2 rec 2: COR 1, B-R e texto'),
  rS13: regra(104, 'Reavaliar ECG e sintomas em 60-90 min. O intervalo é da ESC; a ACC não dá os minutos.', 'ESC (resolução de ST menor que 50% em 60-90 min)'),
  rS14: regra(105, 'Sinais de reperfusão: angiografia de rotina entre 2 e 24 h, com intenção de ICP.', 'ACC 5.3.2 rec 3: COR 1, B-R'),
  rS15: regra(106, 'Falha: não repetir a fibrinólise; resgate por ICP.', 'ESC (texto; classe não lida). ACC: sem regra'),
  rS16: regra(112, 'ICP primária: prasugrel ou ticagrelor.', 'ACC 4.3.2 rec 7: COR 1, B-R'),
  rS16a: regra(113, 'Prasugrel e ticagrelor indisponíveis, não tolerados ou contraindicados: clopidogrel.', 'ACC 4.3.2 rec 8: COR 1, C-LD'),
  rS16b: regra(114, 'AVC ou AIT prévio: não usar prasugrel (dano).', 'ACC 4.3.2 rec 2: COR 3 (dano), B-R'),
  rS16c: regra(115, 'Prasugrel: ataque de 60 mg; 10 mg/dia se 60 kg ou mais e menos de 75 anos; 5 mg/dia se menos de 60 kg ou 75 anos ou mais (cautela).', 'ACC Tabela 7'),
  rS16d: regra(116, 'Ticagrelor: ataque de 180 mg; 90 mg a cada 12 h; AAS de 100 mg/dia ou menos.', 'ACC Tabela 7 e texto 4.3.1'),
  rS16e: regra(117, 'Clopidogrel: ataque de 300 ou 600 mg; 75 mg/dia.', 'ACC Tabela 7'),
  rS17: regra(118, 'Sem anticoagulante prévio: HNF em bólus de 70-100 UI/kg para ACT de 250-300 s. Com anticoagulante prévio: HNF adicional até ACT de 250-300 s.', 'ACC Tabela de anticoagulantes; 4.4 rec 4: COR 1, C-EO'),
  rS17a: regra(119, 'Bivalirudina: 0,75 mg/kg em bólus e 1,75 mg/kg/h durante a ICP; 1,75 mg/kg/h por 2-4 h depois; com CrCl abaixo de 30, 1 mg/kg/h.', 'ACC 4.4 rec 5: COR 1, B-R'),
  rS17b: regra(120, 'Enoxaparina IV na ICP sem tratamento prévio: 0,5-0,75 mg/kg. Com enoxaparina prévia: última SC há 8-12 h ou só uma dose, 0,3 mg/kg IV; há menos de 8 h, nada.', 'ACC 4.4 rec 7: COR 2b, B-R'),
  rS17c: regra(121, 'Fondaparinux na ICP: não usar, por trombose de cateter.', 'ACC 4.4 rec 8: COR 3 (dano), B-R'),
  rN1: regra(139, 'Medir a troponina o quanto antes, de preferência hs-cTn.', 'ACC 3.1.2 rec 3: COR 1, B-NR'),
  rN2: regra(140, 'hs inicial não diagnóstica: repetir em 1 a 2 h. Convencional: repetir em 3 a 6 h da chegada.', 'ACC 3.1.2 rec 4: COR 1, B-NR'),
  rN3: regra(141, 'Dosagem isolada de hs só vale com 3 h ou mais do início dos sintomas.', 'ACC texto 3.1.2'),
  rN4: regra(142, 'Infarto: aumento e/ou queda com pelo menos um valor acima do percentil 99 do ensaio, em contexto de isquemia. Limite e delta são do ensaio do laboratório.', 'ACC texto 3.1.2'),
  rN5: regra(143, 'Duas primeiras coletas do protocolo 0/1 h sem decisão, sem outro diagnóstico: nova dosagem após 3 h.', 'ESC: COR I, B'),
  rN6: regra(151, 'Instável ou muito alto risco: estratégia invasiva imediata, menos de 2 h da admissão. Sem hemodinâmica, transferir de imediato com meta de angiografia imediata.', 'ACC 6.1 rec 3: COR 1, C-LD'),
  rN7: regra(152, 'GRACE maior que 140, troponina subindo de forma acentuada apesar do tratamento otimizado ou ST dinâmico em curso: invasiva de rotina, angiografia em menos de 24 h.', 'ACC 6.1 rec 1: COR 1, A; rec 4: COR 2a, B-R'),
  rN8: regra(153, 'GRACE de 109 a 140, sem isquemia em curso, troponina estável ou em queda: invasiva de rotina, angiografia antes da alta, na figura em menos de 72 h.', 'ACC 6.1 rec 1: COR 1, A; rec 5: COR 2a, B-R'),
  rN9: regra(154, 'GRACE menor que 109, TIMI menor que 2, sem isquemia em curso, troponina abaixo do percentil 99, sem ST dinâmico: invasiva de rotina ou seletiva. Sintomas recorrentes ou teste de risco alto: angiografia antes da alta.', 'ACC 6.1 rec 2: COR 1, A; rec 5: COR 2a, B-R'),
  rN10: regra(155, 'Plaquetas abaixo de 50, doença renal avançada fora de diálise, insuficiência renal aguda, expectativa de vida menor que 1-2 anos, demência avançada, anatomia sem opção de ICP ou cirurgia, preferência do paciente: alerta e decisão do médico.', 'ACC Tabela 15 e texto 6.1'),
  rN11: regra(156, 'GRACE acima de 140, diabetes, idade acima de 75 anos, troponina elevada ou subindo de forma contínua favorecem invasiva precoce. Apenas aviso.', 'ACC texto 6.1 rec 4 (sem classe própria)'),
  rA1: regra(162, 'AAS: ataque de 162-325 mg, mastigado se possível, mesmo em quem já usa; manutenção de 75-100 mg/dia.', 'ACC Tabela 7 (classe não lida)'),
  rA2: regra(163, 'Todo paciente com SCA: inibidor de P2Y12 além do AAS.', 'ACC 4.3.2 rec 1: COR 1, A'),
  rA3: regra(164, 'Vai para ICP: prasugrel ou ticagrelor.', 'ACC 4.3.2 rec 3: COR 1, B-R'),
  rA4: regra(165, 'Sem cateterismo planejado: ticagrelor.', 'ACC 4.3.2 rec 4: COR 1, B-R'),
  rA5: regra(166, 'Prasugrel e ticagrelor indisponíveis, não tolerados ou contraindicados, ou alto risco de sangramento: clopidogrel 300 ou 600 mg, depois 75 mg/dia.', 'ACC 4.3.2 rec 5: COR 1, B-R; texto'),
  rA6: regra(167, 'Cateterismo previsto em menos de 24 h: iniciar o P2Y12 na sala, depois de conhecer a anatomia.', 'ACC 4.3.2 texto rec 6'),
  rA7: regra(168, 'Angiografia prevista para 24 h ou mais após a carga: pode considerar clopidogrel ou ticagrelor.', 'ACC 4.3.2 rec 6: COR 2b, B-NR'),
  rA8: regra(169, 'AVC ou AIT prévio: não usar prasugrel.', 'ACC 4.3.2 rec 2: COR 3 (dano), B-R'),
  rA9: regra(170, 'Anticoagulante no diagnóstico: HNF IV é útil.', 'ACC 4.4 rec 1: COR 1, B-R'),
  rA10: regra(171, 'Cateterismo em 24 h não previsto: enoxaparina ou fondaparinux são alternativas à HNF.', 'ACC 4.4 rec 2: COR 1, B-R'),
  rA11: regra(172, 'Enoxaparina: 1 mg/kg SC a cada 12 h; CrCl abaixo de 30: 1 mg/kg a cada 24 h. Sem máximo por dose nessa linha.', 'ACC Tabela de anticoagulantes (sem máximo por dose nessa linha)'),
  rA12: regra(173, 'Fondaparinux: 2,5 mg SC por dia; contraindicado com CrCl abaixo de 30. Para ICP não usar; dar HNF no procedimento. A SBC corta em 20.', 'ACC Tabela 10 e rec 8 (COR 3, dano, B-R)'),
  rA13: regra(174, 'HNF: bólus de 60 UI/kg (máximo 4.000 UI) e infusão de 12 UI/kg/h (máximo 1.000 UI/h), TTPa de 60-80 s.', 'ACC Tabela de anticoagulantes'),
  rA14: regra(175, 'Revascularização na mesma internação: continuar o anticoagulante até a revascularização.', 'ACC 4.4 rec 3: COR 1, C-LD'),
  rA15: regra(176, 'Antes de CABG eletiva: clopidogrel 5 dias, prasugrel 7 dias, ticagrelor 3 a 5 dias. CABG urgente: pausa de pelo menos 24 h, idealmente.', 'ACC Tabela 8'),
  rP1: regra(182, 'SpO₂ menor que 90%: oxigênio suplementar, para elevar a 90% ou mais.', 'ACC 4.1 rec 1: COR 1, C-LD'),
  rP2: regra(183, 'SpO₂ de 90% ou mais: sem oxigênio de rotina.', 'ACC 4.1 rec 2: COR 3 (sem benefício), A'),
  rP3: regra(184, 'Nitroglicerina SL com PAS de 90 mmHg ou mais: 0,3 ou 0,4 mg a cada 5 min, até 3 doses.', 'ACC Tabela 6 (tabela de opções analgésicas; sem recomendação numerada com classe)'),
  rP4: regra(185, 'Nitroglicerina IV com dor persistente, hipertensão ou edema pulmonar: iniciar 10 mcg/min e titular. Evitar na suspeita de IAM de VD, com PAS abaixo de 90 ou queda de PAS maior que 30 abaixo da basal.', 'ACC Tabela 6'),
  rP5: regra(186, 'Não dar nitrato dentro de 12 h de avanafil, 24 h de sildenafil ou vardenafil, 48 h de tadalafil.', 'ACC Tabela 6'),
  rP6: regra(187, 'Betabloqueador oral, em baixa dose, em menos de 24 h, com escalonamento lento. Contraindicações: insuficiência cardíaca aguda (Killip II a IV), baixo débito ou risco de choque, PR longo, BAV de 2º ou 3º grau sem marcapasso, bradicardia grave, broncoespasmo ativo. Reavaliar após 24 h.', 'ACC 4.6 rec 1: COR 1, A'),
  rP7: regra(188, 'Baixo risco de arritmia: ritmo por até 24 h ou até a revascularização. Risco intermediário ou alto: mais de 24 h.', 'ACC 10.3 rec 1: COR 1, C-LD'),
  rP8: regra(189, 'Anemia no infarto: transfusão para alcançar hemoglobina de 10 g/dL ou mais pode ser razoável. Fora do ensaio, a conduta restritiva geral usa alvo de 7-8 g/dL. Decisão do médico.', 'ACC 10.2 rec 1: COR 2b, B-R'),
  rP9: regra(190, 'STEMI de baixo risco pós-ICP: alta com menos de 3 dias não aumentou mortalidade; Zwolle de 3 ou menos pode apoiar alta em 48-72 h. Só referência.', 'ACC 10.3 texto'),
  rC1: regra(226, 'T0 ao ECG: 10 min.', 'ACC e ESC'),
  rC2: regra(227, 'T0 ao dispositivo: 90 min na ICP primária; 120 min com transferência.', 'ACC 5.2.1 rec 1, 5.3 rec 1 e 2'),
  rC3: regra(228, 'Diagnóstico ao bólus da fibrinólise: meta de 10 min da ESC. A ACC não dá meta de porta-agulha.', 'Meta de 10 min (ESC, COR I, A)'),
  rC10: regra(235, 'Marcos dos sintomas: 12 h e 24 h (ACC) e, como aviso, 48 h (ESC).', 'ACC 5.2.1; ESC'),
  rTropSemCorte: regra(253, 'O app não decide descarta ou confirma por número: registra as coletas e os horários e pede ao médico que aplique o protocolo do laboratório.', 'Especificação, seção 7: Cortes de hs-cTn por ensaio'),
  rEstrepto: regra(259, 'Estreptoquinase: dose sem fonte lida. O app não calcula. Disponibilidade no Brasil não verificada: o médico escolhe o que tem.', 'Especificação, seção 7: Dose de estreptoquinase'),
  rEnoxBolusSemRegra: regra(260, 'CrCl abaixo de 30 e menos de 75 anos: a ACC não diz se o bólus IV de 30 mg é dado. Sem regra.', 'Especificação, seção 7: Enoxaparina com CrCl abaixo de 30'),
  rD2: regra(273, 'AAS: ACC 162-325 mg; ESC 150-300 mg. Faixa comum 162-300 mg, em destaque para o médico escolher.', 'Especificação, D2: ACC 162-325 mg; ESC 150-300 mg'),
  rD7: regra(278, 'Fondaparinux: ACC contraindica abaixo de 30 mL/min; SBC e banco, abaixo de 20 mL/min. Vale a ACC.', 'Especificação, D7: ACC: contraindicado abaixo de 30 mL/min'),
  rD8: regra(279, 'A ACC escreve CrCl e não define o método de estimativa. O app mostra o valor e o método usado e pede confirmação. Decisão do médico, pendente.', 'Especificação, D8: Fórmula de função renal'),
  rD9: regra(280, 'ESC: NSTEMI confirmado por algoritmo de hs-cTn é alto risco, menos de 24 h. Nota da tela: vale a ACC, a ESC pode antecipar o cateterismo.', 'Especificação, D9: a tela mostra a conduta da ESC em nota'),
  rD12: regra(283, 'ESC: ICP razoável de 12 a 48 h; sem indicação depois de 48 h. Vale a ACC, com aviso do corte da ESC.', 'Especificação, D12: ACC, com aviso do corte de 48 h da ESC'),
  rD18: regra(289, 'Após fibrinólise, para dar suporte à ICP: clopidogrel ou ticagrelor (menos de 75 anos, em 24 h) ou prasugrel (depois de 24 h).', 'Especificação, D18: Aviso na tela'),
};
export const regrasSCA = R;

/* Tabela 14. O texto dos itens é o da linha 69 e o da linha 70. */
export const contraAbsolutas = [
  itemPasso('ci.hic', 'Hemorragia intracraniana prévia, a qualquer tempo', true),
  itemPasso('ci.lesao', 'Lesão vascular cerebral estrutural conhecida (por exemplo MAV)', true),
  itemPasso('ci.neoplasia', 'Neoplasia intracraniana maligna conhecida (primária ou metastática)', true),
  itemPasso('ci.avc3m', 'AVC isquêmico há menos de 3 meses, exceto AVC isquêmico agudo nas primeiras 4,5 h', true),
  itemPasso('ci.dissecao', 'Suspeita de dissecção de aorta', true),
  itemPasso('ci.sangramento', 'Sangramento ativo ou diátese hemorrágica (exceto menstruação)', true),
  itemPasso('ci.trauma', 'Trauma craniano ou facial fechado importante há menos de 3 meses', true),
  itemPasso('ci.neurocirurgia', 'Cirurgia intracraniana ou intraespinhal há menos de 2 meses', true),
  itemPasso('ci.has', 'Hipertensão grave não controlada, refratária à terapia (PAS >180 ou PAD >110 mmHg)', true),
];
export const contraRelativas = [
  itemPasso('cr.hasCronica', 'História de hipertensão crônica grave mal controlada'),
  itemPasso('cr.hasApresentacao', 'Hipertensão importante na apresentação (PAS >180 ou PAD >110 mmHg)'),
  itemPasso('cr.avcAntigo', 'AVC isquêmico prévio há mais de 3 meses'),
  itemPasso('cr.demencia', 'Demência'),
  itemPasso('cr.patologia', 'Patologia intracraniana conhecida não listada nas absolutas'),
  itemPasso('cr.rcp', 'RCP traumática ou prolongada (mais de 10 min)'),
  itemPasso('cr.cirurgia', 'Cirurgia de grande porte há menos de 3 semanas'),
  itemPasso('cr.sangramento', 'Sangramento interno recente (2 a 4 semanas)'),
  itemPasso('cr.puncao', 'Punção vascular não compressível'),
  itemPasso('cr.gravidez', 'Gravidez'),
  itemPasso('cr.ulcera', 'Úlcera péptica ativa'),
  itemPasso('cr.aco', 'Uso de anticoagulante oral'),
];

const esc = (e, k) => e.escolhas[k] ?? null;
const vh = (m) => (m ? m.hora : null);

// ---------- Contas puras (uma por linha da especificação) ----------

/* CKD-EPI 2021 sem raça; Cockcroft-Gault só existe para a troca da linha D8. Dado faltando devolve null. */
export function estimarCrCl(metodo, creatinina, idade, sexo, peso) {
  if (creatinina === null || !(creatinina > 0) || idade === null || sexo === null) return null;
  const c = creatinina, i = idade;
  const f = sexo === 'f';
  if (metodo === 'ckdEpi2021') {
    const k = f ? 0.7 : 0.9, a = f ? -0.241 : -0.302;
    return 142 * Math.pow(Math.min(c / k, 1), a) * Math.pow(Math.max(c / k, 1), -1.200) * Math.pow(0.9938, i) * (f ? 1.012 : 1);
  }
  if (peso === null) return null;
  return (140 - i) * peso / (72 * c) * (f ? 0.85 : 1);
}
/* O digitado vale quando é o mais recente; no empate, o digitado. */
export function funcaoRenal(e, metodo = metodoCrCl) {
  const dig = ultimo(e, 'crcl'), cr = ultimo(e, 'creatinina');
  let v, conta;
  if (dig !== null && (cr === null || dig.hora >= cr.hora)) {
    v = dig.valor;
    conta = `CrCl informado pelo médico. Método desta sessão: ${M(metodo).nome}.`;
  } else if (cr !== null) {
    const idade = valor(e, 'idade'), sexo = esc(e, 'sexo'), peso = valor(e, 'peso');
    v = estimarCrCl(metodo, cr.valor, idade, sexo, peso);
    if (v !== null) {
      const s = sexo === 'f' ? 'mulher' : 'homem';
      conta = `${M(metodo).nome}: creatinina ${num(cr.valor)} mg/dL, ${num(idade ?? 0, 0)} anos, ${s}.`;
    } else {
      const falta = [idade === null ? 'idade' : null, sexo === null ? 'sexo' : null];
      if (metodo === 'cockcroftGault' && peso === null) falta.push('peso');
      conta = `Creatinina ${num(cr.valor)} mg/dL. Falta ${falta.filter((x) => x !== null).join(' e ')} para o ${M(metodo).nome}.`;
    }
  } else {
    v = null;
    conta = 'Informe a creatinina ou o CrCl.';
  }
  const conf = ultimaAcao(e, 'crcl.confirmado')?.valores.crcl ?? null;
  const ok = v !== null && conf !== null && Math.abs(conf - v) < 0.05;
  return { valor: v, conta, confirmado: ok };
}
export function textoCrCl(v, metodo = metodoCrCl) {
  return `CrCl ${num(v, 1)} ${M(metodo).unidade} (${M(metodo).nome})`;
}

/* T4. Com sexo ou idade faltando, só responde quando o valor passa ou fica abaixo de todos os cortes possíveis. */
export function criterioSupra(v2v3, outras, sexo, idade) {
  if (outras !== null && outras >= 1) return 'sim';
  let v23 = 'falta';
  if (v2v3 !== null) {
    const v = v2v3;
    if (sexo === 'f') v23 = v >= 1.5 ? 'sim' : 'nao';
    else if (sexo === 'm') {
      if (idade !== null) v23 = v >= (idade >= 40 ? 2 : 2.5) ? 'sim' : 'nao';
      else v23 = v >= 2.5 ? 'sim' : (v < 2 ? 'nao' : 'falta');
    } else v23 = v >= 2.5 ? 'sim' : (v < 1.5 ? 'nao' : 'falta');
  }
  if (v23 === 'sim') return 'sim';
  if (v23 === 'nao' && outras !== null) return 'nao';
  return 'falta';
}

export function tenecteplaseMg(p) {
  if (p < 60) return 30;
  if (p < 70) return 35;
  if (p < 80) return 40;
  if (p < 90) return 45;
  return 50;
}
export function faixaTNK(p) {
  if (p < 60) return 'faixa de menos de 60 kg';
  if (p < 70) return 'faixa de 60-69 kg';
  if (p < 80) return 'faixa de 70-79 kg';
  if (p < 90) return 'faixa de 80-89 kg';
  return 'faixa de 90 kg ou mais';
}
export function alteplaseMg(p) {
  if (p >= 67) return { bolus: 15, trinta: 50, sessenta: 35 };
  return { bolus: 15, trinta: Math.min(0.75 * p, 50), sessenta: Math.min(0.5 * p, 35) };
}
/* S9f e S9g: ataque null quer dizer sem ataque. */
export function clopidogrelComFibrinolise(i) {
  return i <= 75 ? { ataque: 300, inicial: 300 } : { ataque: null, inicial: 75 };
}
/* S16c: null enquanto o dado que falta puder mudar a dose. */
export function prasugrelManutencao(peso, idade) {
  if (peso !== null && peso < 60) return 5;
  if (idade !== null && idade >= 75) return 5;
  if (peso !== null && idade !== null) return 10;
  return null;
}
const esquemaEnox = (bolusIV, scMg, mgKg, intervaloH, teto, bolusSemRegra = false) => ({ bolusIV, scMg, mgKg, intervaloH, teto, bolusSemRegra });
/* S10a, S10b, S10c. */
export function enoxComFibrinolise(p, i, crcl) {
  if (crcl < 30) return esquemaEnox(null, p, 1, 24, null, i !== null ? i < 75 : true);
  if (i === null) return null;
  if (i >= 75) return esquemaEnox(null, Math.min(0.75 * p, 75), 0.75, 12, 75);
  return esquemaEnox(30, Math.min(p, 100), 1, 12, 100);
}
/* S10d e A13: mesma dose; muda só o TTPa. */
export function hnfUI(p) { return { bolus: Math.min(60 * p, 4000), infusao: Math.min(12 * p, 1000) }; }
export function fondaparinuxBloqueado(crcl) { return crcl < 30; }
/* S17a. */
export function bivalirudinaInfusaoMgKgH(crcl) { return crcl < 30 ? 1 : 1.75; }
/* S17b: uma dose há menos de 8 h cai nas duas frases da fonte; sem regra. Mais de 12 h com várias doses, idem.
   Devolve 'semPrevia' | 'dose03' | 'nada' | 'semRegra' | 'falta'. */
export function enoxNaICP(previa, horas, umaDose) {
  if (previa === null) return 'falta';
  if (!previa) return 'semPrevia';
  if (horas === null) return 'falta';
  const h = horas;
  if (h < 8) return umaDose === true ? 'semRegra' : (umaDose === null ? 'falta' : 'nada');
  if (h <= 12) return 'dose03';
  if (umaDose === null) return 'falta';
  return umaDose ? 'dose03' : 'semRegra';
}
/* S1, S6, S6c: 12 e 24 h exatas ficam na faixa de 12 a 24 h. */
export function janela(h) { return h < 12 ? 'menos12' : (h <= 24 ? 'de12a24' : 'mais24'); }
const JANELAS = ['menos12', 'de12a24', 'mais24', 'desconhecida'];
/* S12: falha com qualquer sinal; ausência de falha só com tudo conhecido. Parede sem limiar não decide. */
export function falhaReperfusao(s, i, t, r) {
  if (s === false || i === true) return 'sim';
  if (r !== null && t === 'anterior' && r < 50) return 'sim';
  if (r !== null && t === 'inferior' && r < 70) return 'sim';
  if (!(s === true && i === false && r !== null && (t === 'anterior' || t === 'inferior'))) return 'falta';
  return 'nao';
}
const faixa = (k, x) => (x === undefined ? { k } : { k, x });
const igualFaixa = (a, b) => a.k === b.k && (a.x ?? null) === (b.x ?? null);
/* N6 a N9. A coluna diz "qualquer um"; lido em ordem da mais grave para a mais baixa. Dado faltando nunca rebaixa.
   GRACE <109 com TIMI, isquemia ou troponina fora da faixa mais baixa: a fonte não fecha e o médico escolhe. */
export function faixaRisco(instavel, grace, subindo, stDinamico, isquemia, timi, tropAbaixoP99) {
  if (instavel === 'sim') return faixa('instavel');
  if (grace !== null && grace > 140) return faixa('alto');
  if (subindo === true || stDinamico === true) return faixa('alto');
  if (instavel === 'falta') return faixa('falta', 'sinais de instabilidade');
  const falta = [];
  if (grace === null) falta.push('GRACE');
  if (subindo === null) falta.push('curva da troponina');
  if (stDinamico === null) falta.push('ST dinâmico');
  if (isquemia === null) falta.push('isquemia em curso');
  if (falta.length) return faixa('falta', falta.join(', '));
  if (grace >= 109) return faixa('intermediario');
  if (timi === null) falta.push('TIMI');
  if (tropAbaixoP99 === null) falta.push('troponina e percentil 99');
  if (falta.length) return faixa('falta', falta.join(', '));
  return isquemia === false && timi < 2 && tropAbaixoP99 === true ? faixa('baixo') : faixa('escolher');
}
/* P5: "dentro de" inclui a hora exata. */
export function nitratoBloqueadoPorPDE5(droga, horas) {
  let limite;
  switch (droga) {
    case 'avanafil': limite = 12; break;
    case 'sildenafil': case 'vardenafil': limite = 24; break;
    default: limite = 48;
  }
  return horas <= limite;
}

/* MotivoICP do Swift (rawValue Double). */
export const MOTIVO = { s2: 1, s4: 2, s5: 3, s6: 4, s6c: 5, medico: 6 };
const MOTIVOS_VALIDOS = [1, 2, 3, 4, 5, 6];

// ---------- Auxiliares de estado ----------

export function horaAcao(e, chave) { return ultimaAcao(e, 'passo.' + chave)?.hora ?? null; }
/* O início dos sintomas não pode ser futuro nem depois do T0: nesses casos conta como não respondido. */
export function horaSintomas(e, agora) {
  const s = horaAcao(e, 'sintomas'), t0 = horaAcao(e, 't0');
  if (s === null || t0 === null || !(s <= agora) || !(s <= t0)) return null;
  return s;
}
export function semDado(e, chave) { return resposta(e, 'semDado.' + chave) === true; }
export function instabilidade(e) {
  const v = perguntasInstabilidade.map((q) => resposta(e, q.chave));
  if (v.includes(true)) return 'sim';
  return v.includes(null) ? 'falta' : 'nao';
}
export function textoCorteSupra(sexo, idade) {
  const fora = 'Novo ou presumivelmente novo: 1 mm ou mais em 2 ou mais derivações contíguas fora de V2-V3.';
  let v23;
  if (sexo === 'f') v23 = 'Em V2-V3, mulher: 1,5 mm ou mais.';
  else if (idade !== null) v23 = idade >= 40 ? 'Em V2-V3, homem de 40 anos ou mais: 2 mm ou mais.' : 'Em V2-V3, homem com menos de 40 anos: 2,5 mm ou mais.';
  else v23 = 'Em V2-V3, homem: 2 mm ou mais a partir de 40 anos; 2,5 mm ou mais antes.';
  return `${fora} ${v23} BRE novo não é diagnóstico isolado; em assintomático não é equivalente. Equivalente é julgamento clínico.`;
}
export function absolutasMarcadas(e) { return contraAbsolutas.filter((x) => resposta(e, x.chave) === true); }
/* Hipertensão na apresentação pelos números conta como relativa mesmo sem marcar. */
export function relativasMarcadas(e) {
  return contraRelativas.filter((x) => (x.chave === 'cr.hasApresentacao' ? (resposta(e, x.chave) === true || pressaoAlta(e)) : resposta(e, x.chave) === true));
}
export function pressaoAlta(e) {
  const pas = valor(e, 'pas'), pad = valor(e, 'pad');
  return (pas !== null ? pas > 180 : false) || (pad !== null ? pad > 110 : false);
}
export function listaConferida(e) {
  const c = horaAcao(e, 'ci');
  if (c === null) return false;
  const r = ultimaAcao(e, 'ci.rever')?.hora ?? null;
  if (r !== null) return c >= r;
  return true;
}

const plano = {
  passo: (p) => ({ k: 'passo', passo: p }),
  icp: (m) => ({ k: 'icp', m }),
  fibrinolise: (considerar) => ({ k: 'fibrinolise', considerar }),
  naoICP: () => ({ k: 'naoICP' }),
  falta: (x) => ({ k: 'falta', x }),
  semRegra: (x) => ({ k: 'semRegra', x }),
};

/* A decisão de reperfusão. Depois de dose dada ou ICP acionada o plano fica como está, mesmo que a janela passe. */
export function planoSupra(e, agora, inst) {
  if (teveAcao(e, 'fibrinolise.dose')) return plano.fibrinolise(false);
  const a0 = ultimaAcao(e, 'icp.acionada');
  if (a0 !== null) {
    const mv = a0.valores.motivo;
    if (mv !== undefined && MOTIVOS_VALIDOS.includes(mv) && decisaoICPValida(e, mv, inst)) return plano.icp(mv);
  }
  const secao = 'Reperfusão';
  const pIcp = passoGuiado({ chave: 'icpAcessivel', secao, texto: 'Hemodinâmica acessível agora, aqui ou por transferência?', tipo: tipoSimNao(), regras: inst === 'sim' ? [R.rS5, R.rS6b] : [R.rS6, R.rS6b] });
  if (inst === 'sim') {
    const a = resposta(e, 'icpAcessivel');
    if (a === null) return plano.passo(pIcp);
    if (a) return plano.icp(MOTIVO.s5);
  }
  let j;
  const s = horaSintomas(e, agora);
  if (s !== null) {
    j = janela(desde(agora, s) / 3600);
  } else if (semDado(e, 'sintomas')) {
    const m = esc(e, 'janelaManual');
    if (m === null) {
      return plano.passo(passoGuiado({ chave: 'janelaManual', secao, texto: 'Sem a hora exata: em que faixa estão os sintomas?', detalhe: 'A faixa é o seu julgamento. O app não presume.', tipo: tipoOpcoes([
        opcaoRamo('menos12', 'Menos de 12 h', ''), opcaoRamo('de12a24', 'De 12 a 24 h', ''),
        opcaoRamo('mais24', 'Mais de 24 h', ''), opcaoRamo('desconhecida', 'Não dá para estimar', ''),
      ]), regras: [R.rC10, R.rS1] }));
    }
    j = JANELAS.includes(m) ? m : 'desconhecida';
  } else {
    const t0 = horaAcao(e, 't0');
    const hs = horaAcao(e, 'sintomas');
    const erro = hs !== null && t0 !== null && hs > t0;
    return plano.passo(passoGuiado({ chave: 'sintomas', secao, texto: 'Hora do início dos sintomas', detalhe: erro ? 'A hora anterior ficou depois do T0. O T0 vem depois do início dos sintomas.' : null, tipo: tipoHora(t0), regras: [R.rC10, R.rS1], semDado: 'Não sei a hora', confirmarPadrao: 'Começaram na hora do primeiro contato' }));
  }
  if (inst === 'sim') {
    if (j === 'desconhecida') return plano.semRegra('Instável, sem hemodinâmica acessível e sem janela definida.');
    return planoFibrinolise(e, true);
  }
  switch (j) {
    case 'desconhecida':
      return plano.semRegra('Sem janela de sintomas definida, a regra não escolhe a reperfusão.');
    case 'menos12': {
      if (resposta(e, 'servicoICP') === null) {
        return plano.passo(passoGuiado({ chave: 'servicoICP', secao, texto: 'Este serviço faz ICP primária?', detalhe: 'Meta do T0 ao dispositivo: 90 min aqui; 120 min com transferência.', tipo: tipoSimNao(), regras: [R.rS1, R.rC2] }));
      }
      const p = valor(e, 'projecao');
      if (p !== null) return p <= 120 ? plano.icp(MOTIVO.s2) : planoFibrinolise(e, false);
      if (semDado(e, 'projecao')) return plano.falta('tempo projetado até o dispositivo');
      return plano.passo(passoGuiado({ chave: 'projecao', secao, texto: 'Tempo projetado do T0 ao dispositivo', detalhe: 'Inclui a transferência. Até 120 min: ICP primária. Mais de 120 min: lista de contraindicações à fibrinólise.', tipo: tipoNumero('projecao'), regras: [R.rS2, R.rS3], semDado: 'Não sei estimar' }));
    }
    default: {
      const a = resposta(e, 'icpAcessivel');
      if (a === null) return plano.passo(pIcp);
      if (!a) {
        const g = resposta(e, 'grandeArea');
        if (g === null) {
          return plano.passo(passoGuiado({ chave: 'grandeArea', secao, texto: 'Grande área em risco?', detalhe: 'Sintomas de 12 h ou mais e ICP indisponível. A fonte não dá número.', tipo: tipoSimNao(), regras: [R.rS6b] }));
        }
        return g ? planoFibrinolise(e, true) : plano.semRegra('12 h ou mais, sem hemodinâmica acessível e sem grande área em risco: a fonte não traz regra.');
      }
      if (j === 'de12a24') return plano.icp(MOTIVO.s6);
      const c = resposta(e, 's6c');
      if (c === null) {
        return plano.passo(passoGuiado({ chave: 's6c', secao, texto: 'Isquemia em curso, insuficiência cardíaca grave ou arritmia ameaçadora?', tipo: tipoSimNao(), regras: [R.rS6c] }));
      }
      if (c) return plano.icp(MOTIVO.s6c);
      const d = resposta(e, 's6d');
      if (d === null) {
        return plano.passo(passoGuiado({ chave: 's6d', secao, texto: 'Estável, assintomático e com artéria totalmente ocluída?', tipo: tipoSimNao(), regras: [R.rS6d] }));
      }
      return d ? plano.naoICP() : plano.semRegra('Mais de 24 h, sem isquemia em curso e sem artéria sabidamente ocluída: a fonte não traz regra.');
    }
  }
}
/* ICP acionada não muda quando a janela passa, mas uma resposta corrigida reabre a decisão. A dose de fibrinólise dada não reabre. */
export function decisaoICPValida(e, m, inst) {
  const sintomas = horaAcao(e, 'sintomas') !== null || semDado(e, 'sintomas');
  switch (m) {
    case MOTIVO.s5: return inst === 'sim' && resposta(e, 'icpAcessivel') === true;
    case MOTIVO.s2: { const p = valor(e, 'projecao'); return sintomas && resposta(e, 'servicoICP') !== null && (p !== null ? p <= 120 : false); }
    case MOTIVO.s4: return listaConferida(e) && absolutasMarcadas(e).length > 0;
    case MOTIVO.s6: return sintomas && resposta(e, 'icpAcessivel') === true;
    case MOTIVO.s6c: return sintomas && resposta(e, 'icpAcessivel') === true && resposta(e, 's6c') === true;
    default: return esc(e, 'decisaoFib') === 'icp';
  }
}
export function planoFibrinolise(e, considerar) {
  if (!listaConferida(e)) {
    return plano.passo(passoGuiado({ chave: 'ci', secao: 'Contraindicações', texto: 'Toque no que se aplica', detalhe: 'Vermelho é absoluta e trava a fibrinólise. As demais são relativas e só alertam. A tabela não é exaustiva.', tipo: tipoLista([...contraAbsolutas, ...contraRelativas]), regras: [R.rCI] }));
  }
  if (absolutasMarcadas(e).length) return plano.icp(MOTIVO.s4);
  if (relativasMarcadas(e).length || considerar) {
    const d = esc(e, 'decisaoFib');
    if (d === null) {
      const rel = relativasMarcadas(e).map((x) => x.texto).join('; ');
      return plano.passo(passoGuiado({ chave: 'decisaoFib', secao: 'Decisão do médico', texto: rel === '' ? 'A fonte pede considerar a fibrinólise. O que fazer?' : 'Há contraindicação relativa. O que fazer?', detalhe: rel === '' ? null : rel, tipo: tipoOpcoes([
        opcaoRamo('fibrinolise', 'Fibrinolisar', 'Doses a seguir'), opcaoRamo('icp', 'Transferir para ICP', ''),
      ]), regras: considerar ? [R.rS6b, R.rCI] : [R.rCI] }));
    }
    if (d === 'icp') return plano.icp(MOTIVO.medico);
  }
  if (esc(e, 'agente') === null) {
    return plano.passo(passoGuiado({ chave: 'agente', secao: 'Fibrinolítico', texto: 'Qual fibrinolítico o serviço tem?', detalhe: 'Preferir agente fibrino-específico. A disponibilidade no Brasil não foi verificada: o app não troca um pelo outro.', tipo: tipoOpcoes([
      opcaoRamo('tnk', 'Tenecteplase', 'Bólus único, por peso'),
      opcaoRamo('tpa', 'Alteplase', 'Bólus e infusão em 90 min, por peso'),
      opcaoRamo('rpa', 'Reteplase', 'Dois bólus de 10 U'),
      opcaoRamo('sk', 'Estreptoquinase', 'Sem dose na fonte lida'),
    ]), regras: [R.rS9, R.rEstrepto] }));
  }
  return plano.fibrinolise(considerar);
}

/* O rótulo do botão vira o texto do registro: "Confirmar tenecteplase: 45 mg" fica "Tenecteplase: 45 mg". */
export function semVerbo(r) {
  let t = r;
  for (const v of ['Confirmar ', 'Registrar ']) if (t.startsWith(v)) t = t.slice(v.length);
  const cs = Array.from(t);
  return (cs[0] ?? '').toUpperCase() + cs.slice(1).join('');
}
/* String.capitalized do Swift para uma palavra só. */
const capitalizar = (s) => s.split(' ').map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w)).join(' ');

export function falhaAtual(e) {
  return falhaReperfusao(resposta(e, 'sintomasMelhoraram'), resposta(e, 'instabPos'), esc(e, 'territorio'), valor(e, 'resolucaoST'));
}
export function reavaliacaoConcluida(e) {
  return resposta(e, 'sintomasMelhoraram') !== null && resposta(e, 'instabPos') !== null && esc(e, 'territorio') !== null && (valor(e, 'resolucaoST') !== null || semDado(e, 'resolucaoST'));
}
export function faixaAtual(e, inst) {
  const s = e.series.troponina;
  const trop = s && s.length ? Math.max(...s.map((m) => m.valor)) : null;
  const p99 = valor(e, 'p99');
  const abaixo = trop !== null && p99 !== null ? trop < p99 : null;
  return faixaRisco(inst, valor(e, 'grace'), resposta(e, 'tropSubindo'), resposta(e, 'stDinamico'), resposta(e, 'isquemiaCurso'), valor(e, 'timi'), abaixo);
}

const acao = (tipo, rotulo, v = {}, secundaria = false) => acaoProposta(tipo, rotulo, v, secundaria);
const exameDef = (id) => DEF.exames.find((x) => x.id === id) ?? null;

// ---------- Avaliação ----------

function avaliar(p, e, agora) {
  const o = orientacoes();
  const marcados = p.triagem.filter((q) => resposta(e, q.chave) === true).map((q) => q.texto);
  if (marcados.length) { o.foraDeEscopo = marcados; return o; }
  o.triagemCompleta = p.triagem.every((q) => resposta(e, q.chave) !== null);
  if (!o.triagemCompleta) return o;

  /* Fora do escopo descoberto pelos números. */
  const renal = funcaoRenal(e);
  const idade0 = valor(e, 'idade');
  if (idade0 !== null && idade0 < 18) {
    o.foraDeEscopo = ['Menor de 18 anos'];
    o.travas = [trava('escopo', 'Fora do escopo', 'Menor de 18 anos. A sessão não gera passo automático.', R.rEscopoIdade)];
    return o;
  }
  if (renal.valor !== null && renal.valor < 15) {
    o.alertas.push(alerta('crclBaixo', 'vermelho', `${textoCrCl(renal.valor)}. Sem dose por função renal na fonte lida: esses passos ficam com o médico. A ICP segue como decisão do médico.`, R.rEscopo));
  }

  /* Cronômetro. */
  const t0 = horaAcao(e, 't0');
  if (t0 === null || !(t0 <= agora)) {
    o.passo = passoGuiado({ chave: 't0', secao: 'Primeiro contato', texto: 'Hora do primeiro contato médico (T0)', detalhe: 'O cronômetro conta daqui.', tipo: tipoHora(e.inicio), regras: [R.rC2] });
    return o;
  }
  o.relogioDesde = t0;
  const ecg = horaAcao(e, 'ecg');
  if (ecg === null || !(ecg <= agora)) {
    o.passo = passoGuiado({ chave: 'ecg', secao: 'ECG', texto: 'Hora do ECG de 12 derivações', detalhe: `Registrar e interpretar em até 10 min do T0: até ${hora(mais(t0, 600))}.`, tipo: tipoHora(agora), regras: [R.rT1, R.rC1] });
    return o;
  }
  if (desde(ecg, t0) > 600) {
    o.alertas.push(alerta('ecgTardio', 'amarelo', `ECG ${duracao(desde(ecg, t0))} depois do T0. Meta: até 10 min.`, R.rT1));
  }
  const sexo = esc(e, 'sexo');
  if (sexo === null) {
    o.passo = passoGuiado({ chave: 'sexo', secao: 'Paciente', texto: 'Sexo', detalhe: 'Muda o corte de supra em V2-V3 e a conta do CrCl.', tipo: tipoOpcoes([opcaoRamo('m', 'Masculino', ''), opcaoRamo('f', 'Feminino', '')]), regras: [R.rT4] });
    return o;
  }
  const supra = resposta(e, 'supra');
  if (supra === null) {
    o.passo = passoGuiado({ chave: 'supra', secao: 'ECG', texto: 'O ECG tem supra de ST novo, ou equivalente?', detalhe: textoCorteSupra(sexo, valor(e, 'idade')), tipo: tipoSimNao(), regras: [R.rT4, R.rT5] });
    return o;
  }
  const cSupra = criterioSupra(valor(e, 'supraV2V3'), valor(e, 'supraOutras'), sexo, valor(e, 'idade'));
  if (!supra && cSupra === 'sim') {
    o.alertas.push(alerta('supraDigitado', 'amarelo', 'Os milímetros digitados cumprem o critério de supra e a resposta foi sem supra. Reveja o ECG.', R.rT4));
  }
  if (supra && cSupra === 'nao') {
    o.alertas.push(alerta('supraDigitado', 'amarelo', 'Os milímetros digitados não cumprem o critério de supra. Vale se for equivalente, pelo seu julgamento.', R.rT4));
  }

  /* Instabilidade: uma pergunta por tela; o primeiro sim já muda o caminho. */
  const inst = instabilidade(e);
  if (inst === 'falta') {
    const q = perguntasInstabilidade.find((x) => resposta(e, x.chave) === null);
    if (q) {
      o.passo = passoGuiado({ chave: q.chave, secao: 'Instabilidade', texto: q.texto, detalhe: q.chave === 'ic' ? 'Inclui edema agudo de pulmão e insuficiência mitral nova ou que piora.' : (q.chave === 'arritmia' ? 'Por exemplo TV sustentada ou FV.' : null), tipo: tipoSimNao(), regras: [R.rT7, R.rN6] });
      return o;
    }
  }
  if (inst === 'sim') {
    o.alertas.push(alerta('eco', 'amarelo', 'Ecocardiograma urgente à beira do leito se choque, instabilidade ou suspeita de complicação mecânica.', R.rT7));
  }

  if (supra) avaliarSupra(e, agora, t0, ecg, inst, renal, o);
  else avaliarSemSupra(e, agora, t0, inst, renal, o);
  if (o.passo === null) o.cartoes.push(...cartoesComuns(e, supra, renal));
  if (renal.valor !== null && o.classificacao !== null) o.classificacao = `${o.classificacao}. ${textoCrCl(renal.valor)}`;
  return o;
}

function avaliarSupra(e, agora, t0, ecg, inst, renal, o) {
  const pl = planoSupra(e, agora, inst);
  const absolutas = absolutasMarcadas(e);
  const relativas = relativasMarcadas(e);
  const caminho = 'IAM com supra' + (inst === 'sim' ? ', instável' : '');
  o.classificacao = caminho;
  o.faixaCaminho = caminho;
  o.classificacaoRegra = R.rT4;

  if (absolutas.length) {
    o.travas.push(trava('fibrinolise', 'Fibrinólise bloqueada', `${absolutas.map((x) => x.texto).join('; ')}. Transferir para ICP primária mesmo com tempo maior que 120 min.`, R.rS4));
  }
  if (relativas.length) {
    o.alertas.push(alerta('relativas', 'amarelo', `Contraindicação relativa à fibrinólise: ${relativas.map((x) => x.texto).join('; ')}. Decisão do médico.`, R.rCI));
  }
  if (pressaoAlta(e)) {
    o.alertas.push(alerta('pressao', 'amarelo', 'PAS >180 ou PAD >110 mmHg conta como relativa. Se for refratária à terapia, é absoluta: marque na lista.', R.rCI));
  }
  if (pl.k === 'passo') { o.passo = pl.passo; return; }

  const reperfusao = cartaoReperfusao(e, pl, agora, t0, inst);
  if (pl.k === 'icp' && renal.valor !== null && renal.valor < 15) {
    reperfusao.situacao = 'decisaoMedico';
    reperfusao.detalhe = 'CrCl abaixo de 15 mL/min: decisão do médico. ' + (reperfusao.detalhe ?? '');
  }
  o.cartoes.push(reperfusao);
  if (pl.k === 'naoICP') {
    o.travas.push(trava('icpSemBeneficio', 'Não fazer ICP', 'Mais de 24 h, estável, assintomático e artéria totalmente ocluída: sem benefício.', R.rS6d));
  }
  const hs = horaSintomas(e, agora);
  if (hs !== null && janela(desde(agora, hs) / 3600) === 'mais24') {
    o.alertas.push(alerta('corte48', 'amarelo', 'ESC: ICP razoável de 12 a 48 h e sem indicação depois de 48 h. Vale a ACC, que corta em 24 h.', R.rD12));
  }
  o.exames = examesSupra(e, pl, agora, t0, ecg, inst);

  if (pl.k === 'fibrinolise') {
    if (teveAcao(e, 'fibrinolise.dose')) posFibrinolise(e, agora, o);
    o.cartoes.push(cartaoFibrinolitico(e, agora, ecg, absolutas.length > 0));
    o.cartoes.push(cartaoAAS(e, R.rS9h));
    o.cartoes.push(cartaoClopidogrelFibrinolise(e));
    o.cartoes.push(cartaoAnticoagFibrinolise(e, renal));
  } else if (pl.k === 'icp') {
    o.cartoes.push(cartaoAAS(e, R.rA1));
    o.cartoes.push(cartaoP2Y12ICP(e, [R.rS16, R.rS16a, R.rS16b, R.rS16c, R.rS16d, R.rS16e], o));
    o.cartoes.push(cartaoAnticoagICP(e, renal));
  }
}

function cartaoReperfusao(e, pl, agora, t0, inst) {
  const c = cartao('reperfusao', 'Reperfusão', 'bolt.heart.fill', 0xB91C1C, 'proximoPasso', 'ICP primária');
  c.primeiro = true;
  c.regras = [R.rS1, R.rT6];
  switch (pl.k) {
    case 'passo': break;
    case 'falta':
      c.situacao = 'faltaDado';
      c.valor = 'Falta ' + pl.x;
      c.detalhe = 'Sem esse dado a regra não escolhe entre ICP e fibrinólise. Decisão do médico.';
      c.regras = [R.rS2, R.rS3];
      break;
    case 'semRegra':
      c.situacao = 'decisaoMedico';
      c.valor = 'Sem regra';
      c.detalhe = pl.x;
      c.regras = [R.rC10, R.rS6b];
      break;
    case 'naoICP':
      c.situacao = 'travado';
      c.valor = 'Não fazer ICP';
      c.conta = 'Sem benefício';
      c.regras = [R.rS6d];
      break;
    case 'fibrinolise': {
      const considerar = pl.considerar;
      c.situacao = considerar ? 'decisaoMedico' : 'proximoPasso';
      c.valor = considerar ? 'Considerar fibrinólise' : 'Fibrinólise';
      c.liberado = true;
      const p = valor(e, 'projecao');
      if (p !== null && !considerar) c.conta = `Projeção de ${num(p, 0)} min, acima de 120 min, e sintomas há menos de 12 h`;
      c.detalhe = considerar ? 'Sem hemodinâmica acessível. Transferir logo em seguida.' : 'Estratégia fármaco-invasiva.';
      c.regras = considerar ? [inst === 'sim' ? R.rS5 : R.rS6b, R.rS6b] : [R.rS3, R.rS6e];
      if (teveAcao(e, 'fibrinolise.dose')) c.situacao = 'correndo'; else c.acoes = [acao('ci.rever', 'Rever a lista de contraindicações', {}, true)];
      break;
    }
    case 'icp': {
      const motivo = pl.m;
      c.liberado = true;
      const serv = resposta(e, 'servicoICP');
      let meta;
      switch (motivo) {
        case MOTIVO.s2: {
          meta = serv === false ? 120 : 90;
          c.valor = 'ICP primária';
          const p = valor(e, 'projecao');
          if (p !== null) c.conta = `Projeção de ${num(p, 0)} min do T0 ao dispositivo`;
          c.detalhe = serv === false ? 'Transferir. Meta com transferência: até 120 min. Não esperar troponina.' : 'Meta: até 90 min do T0. Não esperar troponina.';
          if (serv === true && p !== null && p > 90) c.detalhe = 'Projeção acima da meta de 90 min. Até 120 min a regra mantém a ICP. Não esperar troponina.';
          c.regras = [R.rS2, R.rS1, R.rC2, R.rT6];
          break;
        }
        case MOTIVO.s4:
          meta = null;
          c.valor = 'Transferir para ICP';
          c.conta = 'Mesmo com tempo maior que 120 min';
          c.regras = [R.rS4, R.rCI];
          break;
        case MOTIVO.s5: {
          const choque = resposta(e, 'choque') === true;
          meta = choque ? 90 : null;
          c.valor = 'Revascularização de emergência';
          c.conta = 'ICP ou cirurgia da artéria culpada, em qualquer hora';
          c.detalhe = choque ? 'Em choque: ICP primária o mais cedo possível, idealmente em até 90 min. Sem ICP de rotina de artéria não culpada na ICP primária (dano).' : 'Triar para hospital com ICP quando possível.';
          c.regras = [R.rS5, R.rT7, R.rT8];
          break;
        }
        case MOTIVO.s6:
          meta = null;
          c.valor = 'ICP é razoável';
          c.conta = 'Sintomas de 12 a 24 h: transferir ou ICP primária';
          c.regras = [R.rS6, R.rC10];
          break;
        case MOTIVO.s6c:
          meta = null;
          c.valor = 'ICP é razoável';
          c.conta = 'Mais de 24 h, com isquemia em curso, insuficiência cardíaca grave ou arritmia ameaçadora';
          c.regras = [R.rS6c, R.rD12];
          break;
        default:
          meta = null;
          c.valor = 'Transferir para ICP';
          c.conta = 'Decisão do médico';
          c.regras = [R.rCI, R.rS4];
      }
      if (meta !== null) c.doses.metaMin = meta;
      const motivoV = { motivo };
      const d = ultimaAcao(e, 'dispositivo')?.hora ?? null;
      if (d !== null) {
        c.situacao = 'semIndicacao';
        c.valor = `Dispositivo às ${hora(d)}`;
        c.conta = `${duracao(desde(d, t0))} do T0`;
        c.detalhe = null;
      } else if (teveAcao(e, 'icp.acionada')) {
        /* Segue no topo: o relógio do dispositivo está correndo. */
        c.situacao = 'proximoPasso';
        c.acoes = [acao('dispositivo', 'Registrar dispositivo agora')];
      } else {
        c.acoes = [acao('icp.acionada', 'Confirmar ICP ou transferência acionada', motivoV)];
        if (motivo === MOTIVO.s4 || motivo === MOTIVO.medico) c.acoes.push(acao('ci.rever', 'Rever a lista de contraindicações', {}, true));
      }
      break;
    }
  }
  return c;
}

function examesSupra(e, pl, agora, t0, ecg, inst) {
  const r = [];
  const add = (id, nome, janelaIni, ate, rg) => {
    const d = exameDef(id);
    if (!d) return;
    r.push(exameDevido({ id, nome: nome ?? d.nome, aviso: d.aviso, destaque: d.destaque, ultima: null, janelaInicio: janelaIni, proxima: ate, situacao: agora > ate ? 'vencido' : 'noPrazo', regra: rg }));
  };
  const dada = ultimaAcao(e, 'fibrinolise.dose')?.hora ?? null;
  if (pl.k === 'icp' && !teveAcao(e, 'dispositivo')) {
    const m = pl.m;
    const meta = m === MOTIVO.s2 ? (resposta(e, 'servicoICP') === false ? 120 : 90) : (m === MOTIVO.s5 && resposta(e, 'choque') === true ? 90 : null);
    if (meta !== null) add('dispositivo', `Dispositivo ${inteiro(meta)} min`, null, mais(t0, meta * 60), R.rC2);
  }
  if (pl.k === 'fibrinolise' && dada === null) {
    add('bolus', null, null, mais(ecg, 600), R.rC3);
  }
  if (dada === null && !teveAcao(e, 'icp.acionada')) {
    const s = horaSintomas(e, agora);
    if (s !== null) {
      const h = desde(agora, s) / 3600;
      if (h < 12) add('sintomas', 'Sintomas 12 h', null, mais(s, 12 * 3600), R.rC10);
      else if (h <= 24) add('sintomas', 'Sintomas 24 h', null, mais(s, 24 * 3600), R.rC10);
    }
  }
  if (dada !== null) {
    const falha = falhaAtual(e);
    if (!reavaliacaoConcluida(e) && falha !== 'sim') {
      add('reavaliacao', null, mais(dada, 3600), mais(dada, 5400), R.rS13);
    }
    if (!teveAcao(e, 'angiografia') && falha !== 'sim') {
      add('angiografia', 'Angiografia 2-24 h', mais(dada, 2 * 3600), mais(dada, 24 * 3600), R.rS14);
    }
  }
  return r;
}

function cartaoFibrinolitico(e, agora, ecg, travada) {
  const c = cartao('fibrinolitico', 'Fibrinolítico', 'syringe.fill', 0xB91C1C, 'faltaDado', 'Falta dado');
  c.primeiro = true;
  c.regras = [R.rS9, R.rC3];
  const dada = ultimaAcao(e, 'fibrinolise.dose');
  if (travada && dada === null) {
    c.situacao = 'travado';
    c.valor = 'Bloqueada';
    c.detalhe = 'Contraindicação absoluta marcada.';
    c.regras = [R.rCI, R.rS4];
    c.acoes = [acao('ci.rever', 'Rever a lista de contraindicações', {}, true)];
    return c;
  }
  const agente = esc(e, 'agente');
  const peso = valor(e, 'peso'), idade = valor(e, 'idade');
  if (dada !== null) {
    c.situacao = 'correndo';
    c.valor = `Dada às ${hora(dada.hora)}`;
    c.conta = `${semVerbo(dada.rotulo)}. Não repetir a fibrinólise.`;
    c.regras = [R.rS15, R.rS9];
    if (agente === 'rpa') {
      const seg = mais(dada.hora, 1800);
      if (teveAcao(e, 'fibrinolise.segundo')) c.detalhe = 'Segundo bólus registrado.';
      else if (falhaAtual(e) !== 'sim') {
        c.detalhe = `Segundo bólus de 10 U às ${hora(seg)}.`;
        if (agora >= seg) {
          c.situacao = 'proximoPasso';
          c.acoes = [acao('fibrinolise.segundo', 'Confirmar segundo bólus: 10 U', { u: 10 })];
        }
      }
      c.regras = [R.rS9d, R.rS15];
    }
    return c;
  }
  c.detalhe = `ESC: 10 min do diagnóstico ao bólus, até ${hora(mais(ecg, 600))}. A ACC não traz meta.`;
  switch (agente) {
    case 'tnk': {
      c.regras = [R.rS9a, R.rS9e, R.rC3, R.rS9];
      if (peso === null) { c.valor = 'Falta peso'; c.detalhe = 'A dose é por faixa de peso.'; return c; }
      if (idade === null) { c.valor = 'Falta idade'; c.detalhe = 'A ESC considera meia dose acima de 75 anos.'; return c; }
      const mg = tenecteplaseMg(peso);
      c.liberado = true;
      c.doses = { tnkMg: mg };
      if (idade > 75) {
        c.situacao = 'decisaoMedico';
        c.valor = `${num(mg)} mg ou ${num(mg / 2)} mg`;
        c.conta = `${num(peso, 1)} kg: ${faixaTNK(peso)}, ${num(mg)} mg. ${num(idade, 0)} anos: a ACC não ajusta; a ESC considera meia dose.`;
        c.doses.tnkMeiaMg = mg / 2;
        c.acoes = [acao('fibrinolise.dose', `Confirmar dose plena (ACC): ${num(mg)} mg`, { mg }),
          acao('fibrinolise.dose', `Confirmar meia dose (ESC): ${num(mg / 2)} mg`, { mg: mg / 2 })];
      } else {
        c.situacao = 'proximoPasso';
        c.valor = `${num(mg)} mg IV`;
        c.conta = `Tenecteplase em bólus único. ${num(peso, 1)} kg: ${faixaTNK(peso)}`;
        c.acoes = [acao('fibrinolise.dose', `Confirmar tenecteplase: ${num(mg)} mg`, { mg })];
      }
      break;
    }
    case 'tpa': {
      c.regras = [(peso ?? 67) >= 67 ? R.rS9b : R.rS9c, R.rS9, R.rC3];
      if (peso === null) { c.valor = 'Falta peso'; c.detalhe = 'A dose é por peso.'; return c; }
      const a = alteplaseMg(peso);
      c.liberado = true;
      c.situacao = 'proximoPasso';
      c.valor = `${num(a.bolus)} + ${num(a.trinta)} + ${num(a.sessenta)} mg`;
      if (peso >= 67) {
        c.conta = '67 kg ou mais: 15 mg em bólus, 50 mg em 30 min e 35 mg em 60 min. Total 100 mg.';
      } else {
        c.conta = `15 mg em bólus. 0,75 mg/kg × ${num(peso, 1)} kg = ${num(a.trinta)} mg em 30 min (máximo 50). 0,5 mg/kg × ${num(peso, 1)} kg = ${num(a.sessenta)} mg em 60 min (máximo 35).`;
      }
      c.doses = { tpaBolus: a.bolus, tpa30: a.trinta, tpa60: a.sessenta };
      c.acoes = [acao('fibrinolise.dose', 'Confirmar alteplase: bólus de 15 mg', { mg: a.bolus })];
      break;
    }
    case 'rpa':
      c.regras = [R.rS9d, R.rS9, R.rC3];
      c.liberado = true;
      c.situacao = 'proximoPasso';
      c.valor = '10 U + 10 U';
      c.conta = 'Dois bólus de 10 U, 30 min de intervalo, cada um em 2 min';
      c.doses = { rpaU: 10 };
      c.acoes = [acao('fibrinolise.dose', 'Confirmar primeiro bólus de reteplase: 10 U', { u: 10 })];
      break;
    case 'sk':
      c.regras = [R.rEstrepto, R.rS9];
      c.situacao = 'decisaoMedico';
      c.valor = 'Sem dose na fonte';
      c.conta = 'Estreptoquinase não é fibrino-específica. O app não calcula.';
      c.acoes = [acao('fibrinolise.dose', 'Registrar estreptoquinase iniciada')];
      break;
    default:
      c.valor = 'Escolha o agente';
  }
  return c;
}

function cartaoAAS(e, rg) {
  const c = cartao('aas', 'AAS', 'pills.fill', 0x0F7F74, 'proximoPasso', '162-325 mg');
  c.regras = [rg, R.rD2];
  c.liberado = true;
  c.conta = 'Ataque, mastigado se possível. Faixa comum ACC e ESC: 162-300 mg';
  c.detalhe = 'Mesmo em quem já usa AAS. Manutenção: 75-100 mg/dia.';
  c.doses = { ataqueMin: 162, ataqueMax: 325, comumMin: 162, comumMax: 300, manutMin: 75, manutMax: 100 };
  const a = ultimaAcao(e, 'aas.dada');
  if (a !== null) {
    c.situacao = 'semIndicacao';
    c.valor = `Ataque às ${hora(a.hora)}`;
    c.conta = 'Manutenção: 75-100 mg/dia';
    c.detalhe = null;
  } else {
    c.acoes = [acao('aas.dada', 'Confirmar AAS de ataque')];
  }
  return c;
}

function cartaoClopidogrelFibrinolise(e) {
  const c = cartao('p2y12', 'Clopidogrel', 'pills.circle.fill', 0x6D3FD6, 'faltaDado', 'Falta idade');
  c.regras = [R.rS9f, R.rS9g, R.rD18];
  const i = valor(e, 'idade');
  if (i === null) {
    c.detalhe = 'Com fibrinólise, o ataque depende da idade: até 75 anos ou mais de 75.';
    return c;
  }
  const d = clopidogrelComFibrinolise(i);
  c.liberado = true;
  c.doses = { inicial: d.inicial, manut: 75 };
  if (d.ataque !== null) c.doses.ataque = d.ataque;
  c.regras = [i <= 75 ? R.rS9f : R.rS9g, R.rD18];
  const aviso = 'Para a ICP depois da fibrinólise: clopidogrel ou ticagrelor (menos de 75 anos, em 24 h) ou prasugrel (depois de 24 h).';
  if (teveAcao(e, 'fibrinolise.dose')) c.detalhe = aviso;
  const g = ultimaAcao(e, 'p2y12.dada');
  if (g !== null) {
    c.situacao = 'semIndicacao';
    c.valor = `Dado às ${hora(g.hora)}`;
    c.conta = 'Manutenção: 75 mg/dia';
    return c;
  }
  c.situacao = 'proximoPasso';
  if (d.ataque !== null) {
    c.valor = '300 mg de ataque';
    c.conta = `${num(i, 0)} anos: ataque de 300 mg, depois 75 mg/dia`;
    c.acoes = [acao('p2y12.dada', 'Confirmar clopidogrel 300 mg', { op: 3, mg: 300 })];
  } else {
    c.valor = '75 mg, sem ataque';
    c.conta = `${num(i, 0)} anos: sem ataque, 75 mg na dose inicial, depois 75 mg/dia`;
    c.acoes = [acao('p2y12.dada', 'Confirmar clopidogrel 75 mg', { op: 3, mg: 75 })];
  }
  return c;
}

function escolhaAnticoag(e) {
  const a = ultimaAcao(e, 'ac.escolha', 'ac.trocar');
  if (a === null || a.tipo !== 'ac.escolha') return null;
  return a.valores.op ?? null;
}
/* Doses que dependem do corte só aparecem com o CrCl conhecido e confirmado (D8). */
function pedirRenal(c, r) {
  const v = r.valor;
  if (v === null) {
    c.situacao = 'faltaDado';
    c.valor = 'Falta CrCl';
    c.detalhe = 'A dose depende do corte de 30 mL/min. Informe em Novos resultados.';
    return null;
  }
  if (!r.confirmado) {
    c.situacao = 'pergunta';
    c.valor = 'Confirme o CrCl';
    c.conta = textoCrCl(v);
    c.detalhe = 'A confirmação está no cartão Função renal.';
    return null;
  }
  if (!(v >= 15)) {
    c.situacao = 'decisaoMedico';
    c.valor = 'Sem dose na fonte';
    c.conta = textoCrCl(v);
    c.detalhe = 'CrCl abaixo de 15 mL/min: a fonte lida não traz esta dose. Decisão do médico.';
    return null;
  }
  return v;
}

/* 1 enoxaparina, 2 HNF, 3 fondaparinux. */
function cartaoAnticoagFibrinolise(e, renal) {
  const c = cartao('anticoagulante', 'Anticoagulante', 'drop.fill', 0x1F5FD1, 'pergunta', 'Qual o serviço vai usar?');
  c.regras = [R.rDuracao, R.rS10a, R.rS10d, R.rS10e];
  c.discreto = false;
  const peso = valor(e, 'peso'), idade = valor(e, 'idade');
  const trocar = () => acao('ac.trocar', 'Trocar o anticoagulante', {}, true);
  const op = escolhaAnticoag(e);
  if (op === null) {
    c.detalhe = 'Manter por toda a internação, no máximo 8 dias, ou até a revascularização.';
    c.acoes = [acao('ac.escolha', 'Anticoagulante: enoxaparina', { op: 1 }), acao('ac.escolha', 'Anticoagulante: HNF (se sem enoxaparina)', { op: 2 })];
    if (renal.valor !== null && fondaparinuxBloqueado(renal.valor)) {
      c.detalhe = (c.detalhe ?? '') + ` Fondaparinux contraindicado: ${textoCrCl(renal.valor)}, abaixo de 30 mL/min.`;
    } else if (renal.valor !== null) {
      c.acoes.push(acao('ac.escolha', 'Anticoagulante: fondaparinux', { op: 3 }, true));
    } else {
      c.detalhe = (c.detalhe ?? '') + ' Fondaparinux depende do CrCl, que falta.';
    }
    return c;
  }
  const dada = teveAcao(e, 'ac.dose');
  if (op === 2) {
    c.regras = [R.rS10d, R.rDuracao];
    if (peso === null) { c.situacao = 'faltaDado'; c.valor = 'Falta peso'; c.acoes = [trocar()]; return c; }
    const h = hnfUI(peso);
    c.liberado = true;
    c.situacao = dada ? 'correndo' : 'proximoPasso';
    c.valor = `HNF: ${num(h.bolus, 0)} UI em bólus`;
    c.conta = `60 UI/kg × ${num(peso, 1)} kg (máximo 4.000 UI). Infusão: 12 UI/kg/h = ${num(h.infusao, 0)} UI/h (máximo 1.000 UI/h).`;
    c.detalhe = 'TTPa com fibrinólise: 50-70 s. Até 8 dias ou até a revascularização.';
    c.doses = { hnfBolus: h.bolus, hnfInfusao: h.infusao, ttpaMin: 50, ttpaMax: 70 };
    if (!dada) c.acoes = [acao('ac.dose', `Confirmar HNF: ${num(h.bolus, 0)} UI`, { ui: h.bolus }), trocar()];
  } else if (op === 3) {
    c.regras = [R.rS10e, R.rD7, R.rDuracao];
    const v = renal.valor;
    if (v === null) { pedirRenal(c, renal); c.acoes = [trocar()]; return c; }
    if (fondaparinuxBloqueado(v)) {
      c.situacao = 'travado';
      c.valor = 'Fondaparinux contraindicado';
      c.conta = textoCrCl(v);
      c.detalhe = 'ACC: abaixo de 30 mL/min. SBC e banco citam abaixo de 20 mL/min.';
      c.acoes = [trocar()];
      return c;
    }
    if (pedirRenal(c, renal) === null) { c.acoes = [trocar()]; return c; }
    const icp = resposta(e, 'icpPrevista');
    if (icp === null) {
      c.situacao = 'pergunta';
      c.valor = 'Antes do fondaparinux';
      c.detalhe = 'Não usar se houver ICP prevista. O caminho fármaco-invasivo prevê angiografia em 2 a 24 h com intenção de ICP.';
      c.pergunta = perguntaCartao('icpPrevista', 'Há ICP prevista?');
      c.acoes = [trocar()];
      return c;
    }
    if (icp) {
      c.situacao = 'travado';
      c.valor = 'Fondaparinux: não usar';
      c.conta = 'ICP prevista: trombose de cateter';
      c.regras = [R.rS17c, R.rS10e];
      c.acoes = [trocar()];
      return c;
    }
    c.liberado = true;
    c.situacao = dada ? 'correndo' : 'proximoPasso';
    c.valor = '2,5 mg IV';
    c.conta = 'Depois 2,5 mg SC por dia, a partir do dia seguinte';
    c.detalhe = `${textoCrCl(v)}. ACC corta em 30 mL/min; SBC e banco citam 20 mL/min. Até 8 dias ou até a revascularização.`;
    c.doses = { fondaMg: 2.5 };
    if (!dada) c.acoes = [acao('ac.dose', 'Confirmar fondaparinux 2,5 mg IV', { mg: 2.5 }), trocar()];
  } else {
    const idadeE = idade ?? 0;
    const crE = renal.valor ?? 99;
    c.regras = crE < 30 ? [R.rS10c, R.rDuracao] : (idadeE >= 75 ? [R.rS10b, R.rDuracao] : [R.rS10a, R.rDuracao]);
    if (peso === null) { c.situacao = 'faltaDado'; c.valor = 'Falta peso'; c.acoes = [trocar()]; return c; }
    const v = pedirRenal(c, renal);
    if (v === null) { c.acoes = [trocar()]; return c; }
    const x = enoxComFibrinolise(peso, idade, v);
    if (x === null) {
      c.situacao = 'faltaDado';
      c.valor = 'Falta idade';
      c.detalhe = 'Com CrCl de 30 mL/min ou mais, a dose muda aos 75 anos.';
      c.acoes = [trocar()];
      return c;
    }
    c.liberado = true;
    c.situacao = dada ? 'correndo' : 'proximoPasso';
    c.doses = { enoxSC: x.scMg, enoxIntervalo: x.intervaloH, enoxMgKg: x.mgKg };
    if (x.teto !== null) c.doses.enoxTeto = x.teto;
    if (x.bolusIV !== null) c.doses.enoxBolusIV = x.bolusIV;
    const contaSC = `${num(x.mgKg)} mg/kg × ${num(peso, 1)} kg`;
    if (v < 30) {
      c.valor = `${num(x.scMg, 1)} mg SC a cada 24 h`;
      c.conta = `${contaSC}. ${textoCrCl(v)}, abaixo de 30 mL/min.`;
      if (x.bolusSemRegra) {
        c.detalhe = 'A ACC não diz se o bólus IV de 30 mg é dado com CrCl abaixo de 30. Decisão do médico.';
        c.regras = [R.rS10c, R.rEnoxBolusSemRegra, R.rDuracao];
      }
      if (!dada) c.acoes = [acao('ac.dose', `Confirmar enoxaparina ${num(x.scMg, 1)} mg SC`, { mg: x.scMg }), trocar()];
    } else if (x.bolusIV !== null) {
      const b = x.bolusIV;
      c.valor = `${num(b, 0)} mg IV e ${num(x.scMg, 1)} mg SC`;
      c.conta = `Bólus IV de 30 mg; 15 min depois ${contaSC} a cada 12 h (máximo 100 mg nas 2 primeiras doses SC).`;
      c.detalhe = `${textoCrCl(v)}. Até 8 dias ou até a revascularização.`;
      if (!dada) c.acoes = [acao('ac.dose', 'Confirmar enoxaparina 30 mg IV', { mg: b }), trocar()];
    } else {
      c.valor = `${num(x.scMg, 1)} mg SC, sem bólus`;
      c.conta = `${num(idade ?? 0, 0)} anos: ${contaSC} a cada 12 h (máximo 75 mg nas 2 primeiras doses).`;
      c.detalhe = `${textoCrCl(v)}. Até 8 dias ou até a revascularização.`;
      if (!dada) c.acoes = [acao('ac.dose', `Confirmar enoxaparina ${num(x.scMg, 1)} mg SC`, { mg: x.scMg }), trocar()];
    }
  }
  return c;
}

function posFibrinolise(e, agora, o) {
  const dada = ultimaAcao(e, 'fibrinolise.dose')?.hora ?? null;
  if (dada === null) return;
  const t = cartao('transferencia', 'Transferência', 'cross.case.fill', 0x3451B2, 'proximoPasso', 'Transferir agora');
  t.regras = [R.rS11];
  t.conta = 'Para centro com hemodinâmica';
  t.liberado = true;
  const at = ultimaAcao(e, 'transferencia')?.hora ?? null;
  if (at !== null) {
    t.situacao = 'semIndicacao';
    t.valor = `Acionada às ${hora(at)}`;
    t.conta = null;
  } else {
    t.acoes = [acao('transferencia', 'Confirmar transferência acionada')];
  }
  o.cartoes.push(t);
  const de = mais(dada, 3600), ate = mais(dada, 5400);
  const r = cartao('reavaliacao', 'Reavaliação', 'clock.arrow.circlepath', 0xA8530A, 'proximoPasso', 'ECG e sintomas');
  r.regras = [R.rS13, R.rS12];
  r.conta = `Em 60-90 min (ESC): ${hora(de)} a ${hora(ate)}. A ACC não dá os minutos.`;
  const falha = falhaAtual(e);
  if (teveAcao(e, 'reavaliacao.abrir') && !reavaliacaoConcluida(e) && falha !== 'sim') {
    o.passo = passoReavaliacao(e);
    return;
  }
  if (falha === 'sim') {
    const s = cartao('resgate', 'ICP de resgate', 'exclamationmark.triangle.fill', 0xB91C1C, 'proximoPasso', 'Angiografia imediata');
    s.primeiro = true;
    s.regras = [R.rS12, R.rS15];
    s.conta = 'Com ICP de resgate. Não repetir a fibrinólise.';
    s.detalhe = motivosFalha(e);
    s.liberado = true;
    if (teveAcao(e, 'resgate.acionado')) s.situacao = 'correndo'; else s.acoes = [acao('resgate.acionado', 'Confirmar resgate acionado')];
    o.cartoes.push(s);
    o.alertas.push(alerta('resgate', 'vermelho', 'Reperfusão falhou: angiografia imediata com ICP de resgate. Não repetir a fibrinólise.', R.rS12));
    return;
  }
  if (falha === 'falta') {
    if (teveAcao(e, 'reavaliacao.abrir')) {
      r.situacao = 'decisaoMedico';
      r.valor = 'Sem conclusão';
      r.detalhe = esc(e, 'territorio') === 'outra' ? 'Parede sem limiar de resolução na fonte. Decisão do médico.' : 'Falta o percentual de resolução do supra. Informe em Novos resultados.';
    } else {
      r.acoes = [acao('reavaliacao.abrir', 'Reavaliar agora')];
    }
    o.cartoes.push(r);
    return;
  }
  /* Sem falha. */
  r.situacao = 'semIndicacao';
  r.valor = 'Sinais de reperfusão';
  r.conta = `Resolução de ${num(valor(e, 'resolucaoST') ?? 0, 0)}% e sintomas melhores`;
  o.cartoes.push(r);
  const a = cartao('angiografia', 'Angiografia de rotina', 'arrow.triangle.branch', 0x0E7C94, 'correndo', 'Entre 2 e 24 h');
  a.regras = [R.rS14];
  a.liberado = true;
  const abre = mais(dada, 2 * 3600), fecha = mais(dada, 24 * 3600);
  a.conta = `Com intenção de ICP: ${hora(abre)} até ${hora(fecha)}`;
  const f = ultimaAcao(e, 'angiografia')?.hora ?? null;
  if (f !== null) {
    a.situacao = 'semIndicacao';
    a.valor = `Feita às ${hora(f)}`;
    a.conta = null;
  } else {
    if (agora >= abre) a.situacao = 'proximoPasso';
    if (agora > fecha) a.detalhe = 'A janela de 24 h já passou.';
    a.acoes = [acao('angiografia', 'Registrar angiografia')];
  }
  o.cartoes.push(a);
}
function motivosFalha(e) {
  const m = [];
  if (resposta(e, 'sintomasMelhoraram') === false) m.push('sem melhora dos sintomas');
  if (resposta(e, 'instabPos') === true) m.push('instabilidade hemodinâmica ou elétrica');
  const r = valor(e, 'resolucaoST'), t = esc(e, 'territorio');
  if (r !== null && t !== null) {
    if (t === 'anterior' && r < 50) m.push(`resolução de ${num(r, 0)}%, abaixo de 50% nas anteriores`);
    if (t === 'inferior' && r < 70) m.push(`resolução de ${num(r, 0)}%, abaixo de 70% nas inferiores`);
  }
  return 'Motivo: ' + m.join('; ') + '.';
}
function passoReavaliacao(e) {
  const secao = 'Reavaliação';
  if (resposta(e, 'sintomasMelhoraram') === null) {
    return passoGuiado({ chave: 'sintomasMelhoraram', secao, texto: 'Os sintomas melhoraram?', tipo: tipoSimNao(), regras: [R.rS12, R.rS13] });
  }
  if (resposta(e, 'instabPos') === null) {
    return passoGuiado({ chave: 'instabPos', secao, texto: 'Instabilidade hemodinâmica ou elétrica?', tipo: tipoSimNao(), regras: [R.rS12] });
  }
  if (esc(e, 'territorio') === null) {
    return passoGuiado({ chave: 'territorio', secao, texto: 'Qual parede tinha o supra?', detalhe: 'O limiar de resolução muda com a parede.', tipo: tipoOpcoes([
      opcaoRamo('anterior', 'Anterior', 'Falha com resolução menor que 50%'),
      opcaoRamo('inferior', 'Inferior', 'Falha com resolução menor que 70%'),
      opcaoRamo('outra', 'Outra', 'Sem limiar na fonte'),
    ]), regras: [R.rS12] });
  }
  return passoGuiado({ chave: 'resolucaoST', secao, texto: 'Resolução do supra', detalhe: 'Na derivação de maior supra basal ou na soma dos desvios.', tipo: tipoNumero('resolucaoST'), regras: [R.rS12], semDado: 'Não medi' });
}

/* Prasugrel fica de fora sem a resposta sobre AVC ou AIT. */
function cartaoP2Y12ICP(e, regras, o) {
  const c = cartao('p2y12', 'Inibidor de P2Y12', 'pills.circle.fill', 0x6D3FD6, 'pergunta', 'Antes do P2Y12');
  c.regras = [...regras];
  const manut = prasugrelManutencao(valor(e, 'peso'), valor(e, 'idade'));
  const textoManut = (m) => `${num(m, 0)} mg/dia` + (m === 5 ? ' (cautela)' : '');
  const g = ultimaAcao(e, 'p2y12.dada');
  if (g !== null) {
    c.situacao = 'semIndicacao';
    c.liberado = true;
    const op = g.valores.op ?? null;
    c.valor = `${semVerbo(g.rotulo)} às ${hora(g.hora)}`;
    if (op === 1) c.conta = manut !== null ? 'Manutenção: ' + textoManut(manut) : 'Manutenção: falta peso ou idade';
    if (op === 2) c.conta = 'Manutenção: 90 mg a cada 12 h. AAS de 100 mg/dia ou menos.';
    if (op === 3) c.conta = 'Manutenção: 75 mg/dia';
    return c;
  }
  const avc = resposta(e, 'avcAit');
  if (avc === null) {
    c.pergunta = perguntaCartao('avcAit', 'AVC ou AIT prévio?');
    c.detalhe = 'Com AVC ou AIT prévio, prasugrel não entra.';
    return c;
  }
  c.liberado = true;
  c.situacao = 'proximoPasso';
  c.valor = avc ? 'Ticagrelor' : 'Prasugrel ou ticagrelor';
  const linhas = [];
  if (avc) {
    o.alertas.push(alerta('prasugrel', 'vermelho', 'AVC ou AIT prévio: não usar prasugrel (dano).', R.rS16b));
    c.acoes.push(acao('p2y12.dada', 'Confirmar ticagrelor 180 mg', { op: 2, mg: 180 }));
  } else {
    const m = manut !== null ? textoManut(manut) : 'falta peso ou idade';
    linhas.push(`Prasugrel: ataque de 60 mg; manutenção ${m}.`);
    c.acoes.push(acao('p2y12.dada', 'Confirmar prasugrel 60 mg', { op: 1, mg: 60 }));
    c.acoes.push(acao('p2y12.dada', 'Confirmar ticagrelor 180 mg', { op: 2, mg: 180 }));
    c.doses.prasugrelAtaque = 60;
    if (manut !== null) c.doses.prasugrelManut = manut;
  }
  c.doses.ticagrelorAtaque = 180;
  c.doses.ticagrelorQ12 = 90;
  linhas.push('Ticagrelor: ataque de 180 mg; 90 mg a cada 12 h; AAS de 100 mg/dia ou menos.');
  linhas.push('Se indisponíveis, não tolerados ou contraindicados: clopidogrel 300 ou 600 mg, depois 75 mg/dia.');
  c.conta = linhas.shift();
  c.detalhe = linhas.join(' ');
  c.acoes.push(acao('p2y12.dada', 'Confirmar clopidogrel 300 mg', { op: 3, mg: 300 }, true));
  c.acoes.push(acao('p2y12.dada', 'Confirmar clopidogrel 600 mg', { op: 3, mg: 600 }, true));
  c.doses.clopidogrelManut = 75;
  return c;
}

/* 2 HNF, 4 bivalirudina, 5 enoxaparina IV. Fondaparinux nunca entra na ICP. */
function cartaoAnticoagICP(e, renal) {
  const c = cartao('anticoagulante', 'Anticoagulante na ICP', 'drop.fill', 0x1F5FD1, 'pergunta', 'Qual o serviço vai usar?');
  c.regras = [R.rS17, R.rS17a, R.rS17b, R.rS17c];
  const peso = valor(e, 'peso');
  const trocar = () => acao('ac.trocar', 'Trocar o anticoagulante', {}, true);
  const op = escolhaAnticoag(e);
  if (op === null) {
    c.detalhe = 'Fondaparinux não entra na ICP, por trombose de cateter.';
    c.acoes = [acao('ac.escolha', 'Anticoagulante: HNF', { op: 2 }), acao('ac.escolha', 'Anticoagulante: bivalirudina', { op: 4 }), acao('ac.escolha', 'Anticoagulante: enoxaparina IV', { op: 5 }, true)];
    return c;
  }
  const dada = teveAcao(e, 'ac.dose');
  if (op === 4) {
    c.regras = [R.rS17a];
    if (peso === null) { c.situacao = 'faltaDado'; c.valor = 'Falta peso'; c.acoes = [trocar()]; return c; }
    const v = pedirRenal(c, renal);
    if (v === null) { c.acoes = [trocar()]; return c; }
    const tx = bivalirudinaInfusaoMgKgH(v);
    const b = 0.75 * peso;
    c.liberado = true;
    c.situacao = dada ? 'correndo' : 'proximoPasso';
    c.valor = `${num(b, 1)} mg em bólus`;
    c.conta = `0,75 mg/kg × ${num(peso, 1)} kg. Infusão: ${num(tx)} mg/kg/h = ${num(tx * peso, 1)} mg/h, durante a ICP e por 2-4 h depois.`;
    c.detalhe = v < 30 ? `${textoCrCl(v)}, abaixo de 30 mL/min: infusão de 1 mg/kg/h.` : textoCrCl(v);
    c.doses = { bivaBolus: b, bivaMgKgH: tx, bivaMgH: tx * peso };
    if (!dada) c.acoes = [acao('ac.dose', `Confirmar bivalirudina: ${num(b, 1)} mg`, { mg: b }), trocar()];
  } else if (op === 5) {
    c.regras = [R.rS17b];
    if (peso === null) { c.situacao = 'faltaDado'; c.valor = 'Falta peso'; c.acoes = [trocar()]; return c; }
    const previa = resposta(e, 'enoxPrevia');
    if (previa === null) {
      c.valor = 'Antes da enoxaparina';
      c.pergunta = perguntaCartao('enoxPrevia', 'Já recebeu enoxaparina SC?');
      c.acoes = [trocar()];
      return c;
    }
    if (previa === true && resposta(e, 'enoxUmaDose') === null) {
      c.valor = 'Antes da enoxaparina';
      c.pergunta = perguntaCartao('enoxUmaDose', 'Só houve uma dose SC?');
      c.acoes = [trocar()];
      return c;
    }
    switch (enoxNaICP(previa, valor(e, 'enoxHoras'), resposta(e, 'enoxUmaDose'))) {
      case 'semPrevia': {
        const lo = 0.5 * peso, hi = 0.75 * peso;
        c.liberado = true;
        c.situacao = dada ? 'correndo' : 'proximoPasso';
        c.valor = `${num(lo, 1)}-${num(hi, 1)} mg IV`;
        c.conta = `0,5-0,75 mg/kg × ${num(peso, 1)} kg, sem tratamento prévio`;
        c.doses = { enoxIVMin: lo, enoxIVMax: hi };
        if (!dada) c.acoes = [acao('ac.dose', 'Confirmar enoxaparina IV', { mgMin: lo, mgMax: hi }), trocar()];
        break;
      }
      case 'dose03': {
        const d = 0.3 * peso;
        c.liberado = true;
        c.situacao = dada ? 'correndo' : 'proximoPasso';
        c.valor = `${num(d, 1)} mg IV`;
        c.conta = `0,3 mg/kg × ${num(peso, 1)} kg`;
        c.doses = { enoxIV: d };
        if (!dada) c.acoes = [acao('ac.dose', `Confirmar enoxaparina ${num(d, 1)} mg IV`, { mg: d }), trocar()];
        break;
      }
      case 'nada':
        c.situacao = 'semIndicacao';
        c.valor = 'Nada de enoxaparina adicional';
        c.conta = 'Última dose SC há menos de 8 h';
        c.acoes = [trocar()];
        break;
      case 'semRegra':
        c.situacao = 'decisaoMedico';
        c.valor = 'Sem regra';
        c.detalhe = 'A fonte não define este intervalo com este número de doses. Decisão do médico.';
        c.acoes = [trocar()];
        break;
      default:
        c.situacao = 'faltaDado';
        c.valor = 'Falta a hora da última dose';
        c.detalhe = 'Informe em Novos resultados.';
        c.acoes = [trocar()];
    }
  } else {
    c.regras = [R.rS17];
    const prev = resposta(e, 'anticoagPrevio');
    if (prev === null) {
      c.valor = 'Antes da HNF';
      c.pergunta = perguntaCartao('anticoagPrevio', 'Já recebeu anticoagulante?');
      c.acoes = [trocar()];
      return c;
    }
    if (prev) {
      c.liberado = true;
      c.situacao = dada ? 'correndo' : 'proximoPasso';
      c.valor = 'HNF adicional';
      c.conta = 'Até ACT de 250-300 s';
      c.doses = { actMin: 250, actMax: 300 };
      if (!dada) c.acoes = [acao('ac.dose', 'Confirmar HNF adicional'), trocar()];
      return c;
    }
    if (peso === null) { c.situacao = 'faltaDado'; c.valor = 'Falta peso'; c.acoes = [trocar()]; return c; }
    const lo = 70 * peso, hi = 100 * peso;
    c.liberado = true;
    c.situacao = dada ? 'correndo' : 'proximoPasso';
    c.valor = `${num(lo, 0)}-${num(hi, 0)} UI`;
    c.conta = `70-100 UI/kg × ${num(peso, 1)} kg, para ACT de 250-300 s`;
    c.doses = { hnfMin: lo, hnfMax: hi, actMin: 250, actMax: 300 };
    if (!dada) c.acoes = [acao('ac.dose', 'Confirmar HNF em bólus', { uiMin: lo, uiMax: hi }), trocar()];
  }
  return c;
}

// ---------- Sem supra ----------

function passoSemSupra(e, inst, agora) {
  const secao = 'Sem supra';
  if (inst === 'sim') return null;
  if (horaSintomas(e, agora) === null && !semDado(e, 'sintomas')) {
    const erro = horaAcao(e, 'sintomas') !== null;
    return passoGuiado({ chave: 'sintomas', secao, texto: 'Hora do início dos sintomas', detalhe: erro ? 'A hora anterior ficou depois do T0. O T0 vem depois do início dos sintomas.' : 'Uma dosagem isolada de hs-cTn só vale com 3 h ou mais.', tipo: tipoHora(horaAcao(e, 't0')), regras: [R.rN3, R.rC10], semDado: 'Não sei a hora', confirmarPadrao: 'Começaram na hora do primeiro contato' });
  }
  /* Um critério de alto risco já fecha a faixa: as outras perguntas não mudam o caminho. */
  if (igualFaixa(faixaAtual(e, inst), faixa('alto'))) return null;
  if (valor(e, 'grace') === null && !semDado(e, 'grace')) {
    return passoGuiado({ chave: 'grace', secao, texto: 'Pontuação do GRACE', detalhe: 'Escore intra-hospitalar de 8 variáveis, calculado à parte. O app não calcula.', tipo: tipoNumero('grace'), regras: [R.rN7, R.rN8, R.rN9], semDado: 'Ainda não tenho' });
  }
  if (resposta(e, 'tropSubindo') === null && !semDado(e, 'tropSubindo')) {
    return passoGuiado({ chave: 'tropSubindo', secao, texto: 'Troponina subindo de forma acentuada apesar do tratamento otimizado?', detalhe: 'A fonte não dá número: o critério é seu.', tipo: tipoSimNao(), regras: [R.rN7], semDado: 'Ainda não sei' });
  }
  if (resposta(e, 'stDinamico') === null && !semDado(e, 'stDinamico')) {
    return passoGuiado({ chave: 'stDinamico', secao, texto: 'Alterações dinâmicas de ST em curso?', tipo: tipoSimNao(), regras: [R.rN7], semDado: 'Ainda não sei' });
  }
  if (resposta(e, 'isquemiaCurso') === null && !semDado(e, 'isquemiaCurso')) {
    return passoGuiado({ chave: 'isquemiaCurso', secao, texto: 'Isquemia em curso?', tipo: tipoSimNao(), regras: [R.rN8, R.rN9], semDado: 'Ainda não sei' });
  }
  if (igualFaixa(faixaAtual(e, inst), faixa('escolher')) && esc(e, 'faixaMedico') === null) {
    return passoGuiado({ chave: 'faixaMedico', secao: 'Decisão do médico', texto: 'GRACE abaixo de 109, mas falta critério da faixa mais baixa. Qual faixa?', detalhe: 'TIMI 2 ou mais, troponina no percentil 99 ou acima, ou isquemia em curso. A fonte diz "qualquer um" e não fecha este caso.', tipo: tipoOpcoes([
      opcaoRamo('intermediario', 'Risco intermediário', 'Antes da alta, na figura em menos de 72 h'),
      opcaoRamo('baixo', 'Risco mais baixo', 'Invasiva de rotina ou seletiva'),
    ]), regras: [R.rN8, R.rN9] });
  }
  return null;
}

function avaliarSemSupra(e, agora, t0, inst, renal, o) {
  const ps = passoSemSupra(e, inst, agora);
  if (ps !== null) {
    o.passo = ps;
    o.classificacao = 'SCA sem supra';
    return;
  }
  let fx = faixaAtual(e, inst);
  if (fx.k === 'escolher') {
    const m = esc(e, 'faixaMedico');
    if (m !== null) fx = faixa(m === 'baixo' ? 'baixo' : 'intermediario');
  }
  const NOMES = { instavel: 'instável ou muito alto risco', alto: 'alto risco', intermediario: 'risco intermediário', baixo: 'risco mais baixo', escolher: 'faixa em aberto', falta: 'faixa em aberto' };
  o.classificacao = `SCA sem supra, ${NOMES[fx.k]}`;
  o.faixaCaminho = o.classificacao;

  o.cartoes.push(cartaoRisco(e, fx, agora, t0));
  o.cartoes.push(cartaoContraInvasiva(e));
  o.cartoes.push(cartaoNotasRisco());
  if (fx.k === 'intermediario' && resposta(e, 'isquemiaCurso') === true) {
    o.alertas.push(alerta('isquemiaIntermediario', 'amarelo', 'Isquemia em curso: a faixa intermediária pede ausência. Decisão do médico.', R.rN8));
  }
  const pq = valor(e, 'plaquetas');
  if (pq !== null && pq < 50) {
    o.alertas.push(alerta('plaquetas', 'amarelo', `Plaquetas ${num(pq, 0)} x10⁹/L, abaixo de 50: contraindicação relativa à invasiva. Decisão do médico.`, R.rN10));
  }
  if (resposta(e, 'contraInvasiva') === true) {
    o.alertas.push(alerta('contraInvasiva', 'amarelo', 'Contraindicação relativa à invasiva: decisão do médico. Pode manter abordagem não invasiva.', R.rN10));
  }
  o.cartoes.push(cartaoTroponina(e, agora, t0));
  o.cartoes.push(cartaoAAS(e, R.rA1));
  o.cartoes.push(cartaoP2Y12SemSupra(e, o));
  o.cartoes.push(cartaoAnticoagSemSupra(e, renal));
  const f = cartao('fibrinolitico', 'Fibrinólise', 'syringe.fill', 0xB91C1C, 'semIndicacao', 'Não fibrinolisar');
  f.conta = 'Só depressão de ST, sem suspeita de IAM posterior verdadeiro: dano';
  f.regras = [R.rS6e];
  o.cartoes.push(f);
  const ecg = cartao('ecgSerie', 'ECG seriado', 'waveform.path.ecg', 0x0E7C94, 'semIndicacao', 'Se dor persistente ou piora');
  ecg.conta = 'Comparar com o anterior. O ECG normal não afasta SCA. Depressão isolada em V1-V3: V7-V9.';
  ecg.regras = [R.rT2, R.rT3, R.rT5];
  o.cartoes.push(ecg);

  const ex = exameInvasiva(e, fx, agora, t0);
  if (ex !== null) o.exames.push(ex);
  const et = exameTroponina(e, agora, t0);
  if (et !== null) o.exames.push(et);
}

function prazoInvasivaH(fx) {
  switch (fx.k) {
    case 'instavel': return 2;
    case 'alto': return 24;
    case 'intermediario': return 72;
    default: return null;
  }
}
function exameInvasiva(e, fx, agora, t0) {
  const h = prazoInvasivaH(fx);
  const d = exameDef('invasiva');
  if (h === null || teveAcao(e, 'invasiva.feita') || !d) return null;
  const ate = mais(t0, h * 3600);
  return exameDevido({ id: d.id, nome: `Invasiva ${inteiro(h)} h`, aviso: d.aviso, destaque: true, ultima: null, janelaInicio: null, proxima: ate, situacao: agora > ate ? 'vencido' : 'noPrazo', regra: fx.k === 'instavel' ? R.rN6 : (fx.k === 'alto' ? R.rN7 : R.rN8) });
}

function diaSeguinte(t0, h) {
  const dias = inteiro(h / 24);
  return dias === 0 ? '' : `em ${dias} dia${dias > 1 ? 's' : ''}`;
}

function cartaoRisco(e, fx, agora, t0) {
  const c = cartao('risco', 'Risco e prazo invasivo', 'gauge.with.dots.needle.67percent', 0xB91C1C, 'proximoPasso', '');
  c.liberado = true;
  const ate = (h) => hora(mais(t0, h * 3600));
  switch (fx.k) {
    case 'instavel':
      c.valor = 'Invasiva imediata';
      c.conta = `Menos de 2 h da admissão: até ${ate(2)}. Com intenção de revascularizar.`;
      c.detalhe = 'Sem hemodinâmica: transferir de imediato com meta de angiografia imediata.';
      c.regras = [R.rN6, R.rT7];
      c.doses.prazoH = 2;
      break;
    case 'alto':
      c.valor = 'Angiografia em menos de 24 h';
      c.conta = `Invasiva de rotina: até ${ate(24)} ${diaSeguinte(t0, 24)}.`;
      c.regras = [R.rN7];
      c.doses.prazoH = 24;
      break;
    case 'intermediario':
      c.valor = 'Angiografia antes da alta';
      c.conta = `Invasiva de rotina. Na figura, menos de 72 h: até ${ate(72)} ${diaSeguinte(t0, 72)}.`;
      c.regras = [R.rN8];
      c.doses.prazoH = 72;
      break;
    case 'baixo':
      c.valor = 'Invasiva de rotina ou seletiva';
      c.conta = 'Seletiva: teste não invasivo ou angiotomografia antes da alta. Sintomas recorrentes ou teste de risco alto: angiografia antes da alta.';
      c.regras = [R.rN9];
      break;
    default:
      c.liberado = false;
      c.situacao = 'faltaDado';
      c.valor = fx.k === 'falta' ? `Falta ${fx.x}` : 'Falta decisão da faixa';
      c.detalhe = 'Dado faltando não rebaixa o risco. Informe em Novos resultados.';
      c.regras = [R.rN7, R.rN8, R.rN9];
      return c;
  }
  const f = ultimaAcao(e, 'invasiva.feita')?.hora ?? null;
  if (f !== null) {
    c.situacao = 'semIndicacao';
    c.valor = `Angiografia às ${hora(f)}`;
    c.conta = `${duracao(desde(f, t0))} do T0`;
    c.detalhe = null;
    return c;
  }
  if (resposta(e, 'contraInvasiva') === true) {
    c.situacao = 'decisaoMedico';
    c.regras = [R.rN10, ...c.regras];
  }
  c.acoes = [acao('invasiva.feita', 'Registrar angiografia')];
  return c;
}
function cartaoContraInvasiva(e) {
  const c = cartao('contraInvasiva', 'Contraindicação à invasiva', 'exclamationmark.shield.fill', 0xA8530A, 'pergunta', 'Antes da invasiva');
  c.regras = [R.rN10];
  c.discreto = true;
  const r = resposta(e, 'contraInvasiva');
  if (r !== null) {
    c.situacao = 'semIndicacao';
    c.valor = r ? 'Relativa marcada' : 'Nenhuma marcada';
    c.conta = r ? 'Decisão do médico. Pode manter abordagem não invasiva.' : null;
    return c;
  }
  c.detalhe = 'Plaquetas abaixo de 50, doença renal avançada fora de diálise, insuficiência renal aguda, expectativa de vida menor que 1-2 anos, demência avançada, anatomia sem opção de ICP ou cirurgia, preferência do paciente.';
  c.pergunta = perguntaCartao('contraInvasiva', 'Alguma destas?');
  return c;
}
function cartaoNotasRisco() {
  const c = cartao('notasRisco', 'Notas', 'note.text', 0x3451B2, 'semIndicacao', 'Invasiva precoce');
  c.conta = 'Favorecem: GRACE acima de 140, diabetes, idade acima de 75 anos, troponina elevada ou subindo.';
  c.detalhe = 'ESC: NSTEMI confirmado por algoritmo de hs-cTn é alto risco, menos de 24 h. Pode antecipar o cateterismo.';
  c.regras = [R.rN11, R.rD9];
  return c;
}

function serieTroponina(e) { return [...(e.series.troponina ?? [])].sort((a, b) => a.hora - b.hora); }

function cartaoTroponina(e, agora, t0) {
  const c = cartao('troponina', 'Troponina', 'testtube.2', 0x0E7C94, 'faltaDado', 'Falta a primeira coleta');
  c.regras = [R.rN1, R.rN2, R.rN3, R.rN4, R.rTropSemCorte];
  const serie = serieTroponina(e);
  const primeira = serie[0];
  if (!primeira) {
    c.detalhe = 'Medir o quanto antes, de preferência hs-cTn. Informe em Novos resultados.';
    return c;
  }
  const hs = resposta(e, 'ensaioHs');
  if (hs === null) {
    c.situacao = 'pergunta';
    c.valor = 'Qual ensaio?';
    c.pergunta = perguntaCartao('ensaioHs', 'Troponina de alta sensibilidade?');
    return c;
  }
  const lista = serie.map((m) => `${num(m.valor, 0)} às ${hora(m.hora)}`).join(', ');
  c.conta = `Coletas: ${lista} ng/L`;
  const det = [];
  const p = valor(e, 'p99');
  if (p !== null) {
    const acima = serie.some((m) => m.valor > p);
    det.push(`Percentil 99 do ensaio: ${num(p, 0)} ng/L. ${acima ? 'Há valor acima.' : 'Nenhum valor acima.'}`);
  } else {
    det.push('Falta o percentil 99 do ensaio.');
  }
  det.push('Aplique o protocolo do laboratório: o app não descarta nem confirma por número.');
  c.detalhe = det.join(' ');
  if (serie.length === 1) {
    if (hs) {
      const de = mais(primeira.hora, 3600), ate = mais(primeira.hora, 7200);
      c.situacao = agora >= de ? 'proximoPasso' : 'correndo';
      c.valor = 'Repetir em 1 a 2 h';
      c.conta = (c.conta ?? '') + `. De ${hora(de)} a ${hora(ate)}.`;
      const s = horaSintomas(e, agora);
      if (s !== null) {
        const h = desde(primeira.hora, s) / 3600;
        c.detalhe = (c.detalhe ?? '') + (h >= 3 ? ' Dosagem isolada pode valer: 3 h ou mais do início dos sintomas.' : ' Dosagem isolada não vale: menos de 3 h do início dos sintomas.');
        c.doses.isoladaVale = h >= 3 ? 1 : 0;
      } else {
        c.detalhe = (c.detalhe ?? '') + ' Sem a hora dos sintomas, a dosagem isolada não vale.';
        c.doses.isoladaVale = 0;
      }
    } else {
      const de = mais(t0, 3 * 3600), ate = mais(t0, 6 * 3600);
      c.situacao = agora >= de ? 'proximoPasso' : 'correndo';
      c.valor = 'Repetir em 3 a 6 h';
      c.conta = (c.conta ?? '') + `. Da chegada: ${hora(de)} a ${hora(ate)}.`;
    }
    return c;
  }
  const decidido = resposta(e, 'tropDecidido');
  if (decidido === null) {
    c.situacao = 'pergunta';
    c.valor = 'Protocolo do laboratório';
    c.pergunta = perguntaCartao('tropDecidido', 'As coletas fecharam decisão pelo protocolo do laboratório?');
    return c;
  }
  if (decidido) {
    c.situacao = 'semIndicacao';
    c.valor = 'Decisão pelo protocolo';
    return c;
  }
  const segunda = mais(serie[1].hora, 3 * 3600);
  if (serie.length === 2) {
    c.situacao = agora >= segunda ? 'proximoPasso' : 'correndo';
    c.valor = 'Nova dosagem após 3 h (ESC)';
    c.conta = (c.conta ?? '') + `. A partir de ${hora(segunda)}.`;
    c.regras = [R.rN5, R.rN4];
  } else {
    c.situacao = 'decisaoMedico';
    c.valor = 'Decisão do médico';
    c.regras = [R.rN5, R.rN4];
  }
  return c;
}
function exameTroponina(e, agora, t0) {
  const d = exameDef('troponina');
  if (!d) return null;
  const serie = serieTroponina(e);
  const primeira = serie[0];
  if (!primeira) {
    return exameDevido({ id: d.id, nome: d.nome, aviso: d.aviso, destaque: true, ultima: null, janelaInicio: null, proxima: null, situacao: 'semDado', regra: R.rN1 });
  }
  const hs = resposta(e, 'ensaioHs');
  if (serie.length !== 1 || hs === null) return null;
  const de = hs ? mais(primeira.hora, 3600) : mais(t0, 3 * 3600);
  const ate = hs ? mais(primeira.hora, 7200) : mais(t0, 6 * 3600);
  return exameDevido({ id: d.id, nome: d.nome, aviso: d.aviso, destaque: true, ultima: primeira.hora, janelaInicio: de, proxima: ate, situacao: agora > ate ? 'vencido' : 'noPrazo', regra: R.rN2 });
}

function cateterismo(e) { const a = ultimaAcao(e, 'cate.escolha'); return a !== null ? (a.valores.op ?? null) : null; }

/* cate: 1 em menos de 24 h, 2 em 24 h ou mais, 3 sem cateterismo planejado. */
function cartaoP2Y12SemSupra(e, o) {
  const c = cartao('p2y12', 'Inibidor de P2Y12', 'pills.circle.fill', 0x6D3FD6, 'pergunta', 'Quando é o cateterismo?');
  c.regras = [R.rA2, R.rA6, R.rA7, R.rA4];
  if (teveAcao(e, 'p2y12.dada') || (cateterismo(e) === 1 && teveAcao(e, 'anatomia.icp'))) {
    return cartaoP2Y12ICP(e, [R.rA3, R.rA5, R.rA8, R.rS16c, R.rS16d, R.rS16e], o);
  }
  const opcoesCate = () => [acao('cate.escolha', 'Cateterismo em menos de 24 h', { op: 1 }), acao('cate.escolha', 'Cateterismo em 24 h ou mais', { op: 2 }), acao('cate.escolha', 'Sem cateterismo planejado', { op: 3 })];
  const cate = cateterismo(e);
  if (cate === null) {
    c.detalhe = 'O P2Y12 depende do plano.';
    c.acoes = opcoesCate();
    return c;
  }
  const trocar = acao('cate.escolha', 'Rever o plano do cateterismo', { op: 0 }, true);
  c.doses = { ticagrelorAtaque: 180, ticagrelorQ12: 90, clopidogrelManut: 75 };
  const clopi = () => [acao('p2y12.dada', 'Confirmar clopidogrel 300 mg', { op: 3, mg: 300 }, true), acao('p2y12.dada', 'Confirmar clopidogrel 600 mg', { op: 3, mg: 600 }, true)];
  switch (cate) {
    case 1:
      c.doses = {};
      c.situacao = 'proximoPasso';
      c.valor = 'Não pré-tratar';
      c.conta = 'Iniciar o P2Y12 na sala, depois de conhecer a anatomia';
      c.regras = [R.rA6, R.rA3];
      c.acoes = [acao('anatomia.icp', 'Anatomia conhecida, vai para ICP'), trocar];
      break;
    case 2:
      c.liberado = true;
      c.situacao = 'proximoPasso';
      c.valor = 'Pode considerar';
      c.conta = 'Clopidogrel ou ticagrelor, com angiografia prevista para 24 h ou mais após a carga';
      c.detalhe = 'Ticagrelor: 180 mg, depois 90 mg a cada 12 h. Clopidogrel: 300 ou 600 mg, depois 75 mg/dia.';
      c.regras = [R.rA7, R.rS16d, R.rS16e];
      c.acoes = [acao('p2y12.dada', 'Confirmar ticagrelor 180 mg', { op: 2, mg: 180 }), ...clopi(), trocar];
      break;
    case 3:
      c.liberado = true;
      c.situacao = 'proximoPasso';
      c.valor = 'Ticagrelor';
      c.conta = '180 mg, depois 90 mg a cada 12 h. AAS de 100 mg/dia ou menos.';
      c.detalhe = 'Se indisponível, não tolerado ou contraindicado, ou alto risco de sangramento: clopidogrel 300 ou 600 mg, depois 75 mg/dia.';
      c.regras = [R.rA4, R.rA5, R.rS16d];
      c.acoes = [acao('p2y12.dada', 'Confirmar ticagrelor 180 mg', { op: 2, mg: 180 }), ...clopi(), trocar];
      break;
    default:
      c.doses = {};
      c.detalhe = 'O P2Y12 depende do plano.';
      c.acoes = opcoesCate();
  }
  return c;
}

/* 6 HNF, 7 enoxaparina, 8 fondaparinux. As duas últimas só sem cateterismo em 24 h (A10). */
function cartaoAnticoagSemSupra(e, renal) {
  const c = cartao('anticoagulante', 'Anticoagulante', 'drop.fill', 0x1F5FD1, 'pergunta', 'Qual o serviço vai usar?');
  c.regras = [R.rA9, R.rA10, R.rA14];
  const peso = valor(e, 'peso');
  const trocar = () => acao('ac.trocar', 'Trocar o anticoagulante', {}, true);
  const cate = cateterismo(e);
  const op = escolhaAnticoag(e);
  if (op === null) {
    c.acoes = [acao('ac.escolha', 'Anticoagulante: HNF', { op: 6 })];
    c.detalhe = 'Continuar até a revascularização, se houver na mesma internação.';
    if (cate === 2 || cate === 3) {
      c.acoes.push(acao('ac.escolha', 'Anticoagulante: enoxaparina', { op: 7 }));
      if (renal.valor !== null && fondaparinuxBloqueado(renal.valor)) {
        c.detalhe = (c.detalhe ?? '') + ` Fondaparinux contraindicado: ${textoCrCl(renal.valor)}, abaixo de 30 mL/min.`;
      } else if (renal.valor !== null) {
        c.acoes.push(acao('ac.escolha', 'Anticoagulante: fondaparinux', { op: 8 }, true));
      } else {
        c.detalhe = (c.detalhe ?? '') + ' Fondaparinux depende do CrCl, que falta.';
      }
    } else {
      c.detalhe = (c.detalhe ?? '') + ' Enoxaparina e fondaparinux entram quando não há cateterismo previsto em 24 h.';
    }
    return c;
  }
  const dada = teveAcao(e, 'ac.dose');
  if (op === 7) {
    c.regras = [R.rA11, R.rA10, R.rA14];
    if (peso === null) { c.situacao = 'faltaDado'; c.valor = 'Falta peso'; c.acoes = [trocar()]; return c; }
    const v = pedirRenal(c, renal);
    if (v === null) { c.acoes = [trocar()]; return c; }
    const intervalo = v < 30 ? 24 : 12;
    c.liberado = true;
    c.situacao = dada ? 'correndo' : 'proximoPasso';
    c.valor = `${num(peso, 1)} mg SC a cada ${inteiro(intervalo)} h`;
    c.conta = `1 mg/kg × ${num(peso, 1)} kg. ${textoCrCl(v)}.`;
    c.detalhe = 'Esta linha da fonte não traz máximo por dose.';
    c.doses = { enoxSC: peso, enoxIntervalo: intervalo, enoxMgKg: 1 };
    if (!dada) c.acoes = [acao('ac.dose', `Confirmar enoxaparina ${num(peso, 1)} mg SC`, { mg: peso }), trocar()];
  } else if (op === 8) {
    c.regras = [R.rA12, R.rD7, R.rA10];
    const v = renal.valor;
    if (v === null) { pedirRenal(c, renal); c.acoes = [trocar()]; return c; }
    if (fondaparinuxBloqueado(v)) {
      c.situacao = 'travado';
      c.valor = 'Fondaparinux contraindicado';
      c.conta = textoCrCl(v);
      c.detalhe = 'ACC: abaixo de 30 mL/min. SBC e banco citam abaixo de 20 mL/min.';
      c.acoes = [trocar()];
      return c;
    }
    if (pedirRenal(c, renal) === null) { c.acoes = [trocar()]; return c; }
    c.liberado = true;
    c.situacao = dada ? 'correndo' : 'proximoPasso';
    c.valor = '2,5 mg SC por dia';
    c.conta = textoCrCl(v);
    c.detalhe = 'Para ICP não usar: dar HNF no procedimento. ACC corta em 30 mL/min; SBC e banco citam 20 mL/min.';
    c.doses = { fondaMg: 2.5 };
    if (!dada) c.acoes = [acao('ac.dose', 'Confirmar fondaparinux 2,5 mg SC', { mg: 2.5 }), trocar()];
  } else {
    c.regras = [R.rA13, R.rA9, R.rA14];
    if (peso === null) { c.situacao = 'faltaDado'; c.valor = 'Falta peso'; c.acoes = [trocar()]; return c; }
    const h = hnfUI(peso);
    c.liberado = true;
    c.situacao = dada ? 'correndo' : 'proximoPasso';
    c.valor = `HNF: ${num(h.bolus, 0)} UI em bólus`;
    c.conta = `60 UI/kg × ${num(peso, 1)} kg (máximo 4.000 UI). Infusão: 12 UI/kg/h = ${num(h.infusao, 0)} UI/h (máximo 1.000 UI/h).`;
    c.detalhe = 'TTPa de 60-80 s. Até a revascularização.';
    c.doses = { hnfBolus: h.bolus, hnfInfusao: h.infusao, ttpaMin: 60, ttpaMax: 80 };
    if (!dada) c.acoes = [acao('ac.dose', `Confirmar HNF: ${num(h.bolus, 0)} UI`, { ui: h.bolus }), trocar()];
  }
  return c;
}

// ---------- Comuns ----------

function cartoesComuns(e, supra, renal) {
  const r = [cartaoRenal(e, renal), cartaoOxigenio(e), cartaoNitrato(e), cartaoBetabloqueador(e), cartaoAnemia(e)];
  const m = cartao('monitor', 'Monitorização', 'waveform.path.ecg.rectangle', 0x0E7C94, 'semIndicacao', 'Ritmo por telemetria');
  m.conta = 'Baixo risco: até 24 h ou até a revascularização. Risco intermediário ou alto: mais de 24 h.';
  m.regras = [R.rP7];
  r.push(m);
  const g = cartao('cabg', 'Se for para CABG', 'scissors', 0x3451B2, 'semIndicacao', 'Pausa do P2Y12');
  g.conta = 'Eletiva: clopidogrel 5 dias, prasugrel 7 dias, ticagrelor 3 a 5 dias. Urgente: pelo menos 24 h, idealmente.';
  g.regras = [R.rA15];
  r.push(g);
  if (supra) {
    const a = cartao('alta', 'Alta precoce', 'house.fill', 0x3451B2, 'semIndicacao', 'Só referência');
    a.conta = 'STEMI de baixo risco pós-ICP: alta com menos de 3 dias não aumentou mortalidade. Zwolle de 3 ou menos pode apoiar alta em 48-72 h.';
    a.regras = [R.rP9];
    r.push(a);
    const x = cartao('derivacoes', 'Derivações extras', 'waveform.path.ecg', 0x0E7C94, 'semIndicacao', 'V3R, V4R e V7-V9');
    x.conta = 'IAM inferior: V3R e V4R. Depressão isolada de 0,5 mm ou mais em V1-V3: V7-V9.';
    x.regras = [R.rT3];
    r.push(x);
  }
  return r;
}

function cartaoRenal(e, renal) {
  const c = cartao('renal', 'Função renal', 'drop.triangle.fill', 0xA8327E, 'faltaDado', 'Falta CrCl');
  c.regras = [R.rD8];
  c.conta = renal.conta;
  c.detalhe = `Método: ${M(metodoCrCl).nome}. A ACC escreve CrCl e não define o método.`;
  const v = renal.valor;
  if (v === null) return c;
  c.valor = textoCrCl(v);
  c.doses.crcl = v;
  if (renal.confirmado) {
    c.situacao = 'semIndicacao';
    c.detalhe = null;
  } else {
    c.situacao = 'proximoPasso';
    c.acoes = [acao('crcl.confirmado', `Confirmo ${textoCrCl(v)}`, { crcl: v })];
  }
  return c;
}

function cartaoOxigenio(e) {
  const c = cartao('oxigenio', 'Oxigênio', 'lungs.fill', 0x1F5FD1, 'faltaDado', 'Falta SpO₂');
  c.regras = [R.rP1, R.rP2];
  c.discreto = true;
  const s = valor(e, 'spo2');
  if (s === null) return c;
  c.conta = `SpO₂ ${num(s, 0)}%`;
  if (s < 90) {
    c.liberado = true;
    c.discreto = false;
    c.situacao = teveAcao(e, 'oxigenio.inicio') ? 'correndo' : 'proximoPasso';
    c.valor = 'Oxigênio suplementar';
    c.detalhe = 'Para elevar a SpO₂ a 90% ou mais.';
    if (!teveAcao(e, 'oxigenio.inicio')) c.acoes = [acao('oxigenio.inicio', 'Confirmar oxigênio iniciado')];
  } else {
    c.situacao = 'semIndicacao';
    c.valor = 'Sem oxigênio de rotina';
    c.regras = [R.rP2];
  }
  return c;
}

const PDE5 = ['avanafil', 'sildenafil', 'vardenafil', 'tadalafil'];
function cartaoNitrato(e) {
  const c = cartao('nitrato', 'Nitroglicerina', 'pills', 0x0F7F74, 'faltaDado', 'Falta PAS');
  c.regras = [R.rP3, R.rP4, R.rP5];
  c.discreto = true;
  const pas = valor(e, 'pas');
  if (pas === null) return c;
  if (pas < 90) {
    c.situacao = 'semIndicacao';
    c.valor = 'Não dar';
    c.conta = `PAS ${num(pas, 0)} mmHg, abaixo de 90`;
    return c;
  }
  const pde = resposta(e, 'pde5');
  if (pde === null) {
    c.situacao = 'pergunta';
    c.valor = 'Antes do nitrato';
    c.pergunta = perguntaCartao('pde5', 'Inibidor de PDE5 recente?');
    return c;
  }
  if (pde) {
    const a = ultimaAcao(e, 'pde5.droga');
    let droga = null;
    if (a !== null) {
      const i = inteiro(a.valores.op ?? -1);
      if (i >= 0 && i < PDE5.length) droga = PDE5[i];
    }
    if (droga === null) {
      c.situacao = 'pergunta';
      c.valor = 'Qual inibidor?';
      c.acoes = [acao('pde5.droga', 'PDE5: avanafil', { op: 0 }), acao('pde5.droga', 'PDE5: sildenafil', { op: 1 }), acao('pde5.droga', 'PDE5: vardenafil', { op: 2 }), acao('pde5.droga', 'PDE5: tadalafil', { op: 3 })];
      return c;
    }
    const h = valor(e, 'pde5Horas');
    if (h === null) {
      c.situacao = 'faltaDado';
      c.valor = `Falta a hora do ${droga}`;
      c.detalhe = 'Sem a hora, nitrato não é liberado. Informe em Novos resultados.';
      return c;
    }
    if (nitratoBloqueadoPorPDE5(droga, h)) {
      c.situacao = 'travado';
      c.valor = 'Não dar nitrato';
      c.conta = `${capitalizar(droga)} há ${num(h, 0)} h`;
      c.regras = [R.rP5];
      return c;
    }
  }
  const vd = resposta(e, 'suspeitaVD');
  if (vd === null) {
    c.situacao = 'pergunta';
    c.valor = 'Antes do nitrato';
    c.pergunta = perguntaCartao('suspeitaVD', 'Suspeita de IAM de VD?');
    return c;
  }
  const basal = primeiro(e, 'pas')?.valor ?? pas;
  const queda = basal - pas;
  c.liberado = true;
  c.situacao = 'proximoPasso';
  c.valor = 'SL 0,3 ou 0,4 mg';
  c.conta = 'A cada 5 min, até 3 doses';
  c.doses = { slDoses: 3 };
  if (vd || queda > 30) {
    c.detalhe = vd ? 'IV: evitar, por suspeita de IAM de VD.' : `IV: evitar, queda de PAS de ${num(queda, 0)} mmHg abaixo da basal.`;
    c.doses.ivLiberado = 0;
  } else {
    c.detalhe = 'IV, se dor persistente, hipertensão ou edema pulmonar: iniciar 10 mcg/min e titular.';
    c.doses.ivLiberado = 1;
    c.doses.ivMcgMin = 10;
  }
  if (teveAcao(e, 'nitrato.dado')) c.situacao = 'correndo'; else c.acoes = [acao('nitrato.dado', 'Registrar nitroglicerina')];
  return c;
}

function cartaoBetabloqueador(e) {
  const c = cartao('betabloqueador', 'Betabloqueador', 'heart.fill', 0xA8327E, 'pergunta', 'Antes de dar');
  c.regras = [R.rP6];
  c.discreto = true;
  const lista = 'Insuficiência cardíaca aguda (Killip II a IV), baixo débito ou risco de choque, PR longo, BAV de 2º ou 3º grau sem marcapasso, bradicardia grave, broncoespasmo ativo.';
  const k = valor(e, 'killip');
  const killipAlto = (k !== null ? k >= 2 : false) || resposta(e, 'ic') === true || resposta(e, 'choque') === true;
  if (killipAlto || resposta(e, 'bbContra') === true) {
    c.situacao = 'semIndicacao';
    c.valor = 'Não dar agora';
    c.conta = killipAlto ? 'Insuficiência cardíaca aguda, Killip II a IV, ou choque' : 'Contraindicação marcada';
    c.detalhe = 'Reavaliar após 24 h.';
    return c;
  }
  if (resposta(e, 'bbContra') === null) {
    c.detalhe = lista;
    c.pergunta = perguntaCartao('bbContra', 'Alguma destas?');
    return c;
  }
  c.liberado = true;
  c.situacao = teveAcao(e, 'betabloqueador') ? 'semIndicacao' : 'proximoPasso';
  c.valor = 'Oral, baixa dose';
  c.conta = 'Em menos de 24 h, com escalonamento lento';
  c.detalhe = 'A fonte não traz dose nesta linha.';
  if (!teveAcao(e, 'betabloqueador')) c.acoes = [acao('betabloqueador', 'Registrar betabloqueador oral')];
  return c;
}

function cartaoAnemia(e) {
  const c = cartao('anemia', 'Hemoglobina', 'drop.circle.fill', 0xB91C1C, 'faltaDado', 'Sem registro');
  c.regras = [R.rP8];
  c.discreto = true;
  const h = valor(e, 'hb');
  if (h === null) return c;
  c.conta = `Hb ${num(h, 1)} g/dL`;
  if (h < 10) {
    c.discreto = false;
    c.situacao = 'decisaoMedico';
    c.valor = 'Transfusão pode ser razoável';
    c.detalhe = 'Para alcançar 10 g/dL ou mais (COR 2b). Fora do ensaio, a conduta restritiva geral usa 7-8 g/dL.';
  } else {
    c.situacao = 'semIndicacao';
    c.valor = '10 g/dL ou mais';
  }
  return c;
}

/* Toda regra citada acima, para o teste conferir contra o arquivo de regras. */
export function todasRegras() {
  return ['rEscopo', 'rEscopoIdade', 'rT1', 'rT2', 'rT3', 'rT4', 'rT5', 'rT6', 'rT7', 'rT8', 'rS1', 'rS2', 'rS3', 'rS4', 'rS5', 'rS6', 'rS6b', 'rS6c', 'rS6d', 'rS6e', 'rCI', 'rS9', 'rS9a', 'rS9b', 'rS9c', 'rS9d', 'rS9e', 'rS9f', 'rS9g', 'rS9h', 'rDuracao', 'rS10a', 'rS10b', 'rS10c', 'rS10d', 'rS10e', 'rS11', 'rS12', 'rS13', 'rS14', 'rS15', 'rS16', 'rS16a', 'rS16b', 'rS16c', 'rS16d', 'rS16e', 'rS17', 'rS17a', 'rS17b', 'rS17c', 'rN1', 'rN2', 'rN3', 'rN4', 'rN5', 'rN6', 'rN7', 'rN8', 'rN9', 'rN10', 'rN11', 'rA1', 'rA2', 'rA3', 'rA4', 'rA5', 'rA6', 'rA7', 'rA8', 'rA9', 'rA10', 'rA11', 'rA12', 'rA13', 'rA14', 'rA15', 'rP1', 'rP2', 'rP3', 'rP4', 'rP5', 'rP6', 'rP7', 'rP8', 'rP9', 'rC1', 'rC2', 'rC3', 'rC10', 'rTropSemCorte', 'rEstrepto', 'rEnoxBolusSemRegra', 'rD2', 'rD7', 'rD8', 'rD9', 'rD12', 'rD18'].map((k) => R[k]);
}

const DEF = {
  id: 'sca',
  nome: 'Síndrome coronariana aguda',
  descricao: 'Com supra e sem supra, desde o primeiro contato',
  idConduta: 'stemi',
  referencia: 'Rao SV et al. 2025 ACC/AHA/ACEP/NAEMSP/SCAI Guideline for the Management of Patients With Acute Coronary Syndromes. Circulation 2025;151(13):e771-e862 (doi:10.1161/CIR.0000000000001309). O que está marcado como ESC vem de: 2023 ESC Guidelines for the management of acute coronary syndromes. Eur Heart J 2023;44(38):3720- (doi:10.1093/eurheartj/ehad191).',
  escopo: 'Adulto com SCA suspeita ou confirmada, em serviço com ou sem hemodinâmica.',
  nomeFonte: 'diretriz',
  rotuloPrazoExame: 'até',
  mostraTodasAsFontes: true,
  parametros: [
    defParametro('idade', 'Idade', 'anos', 18, 110, 0),
    defParametro('peso', 'Peso', 'kg', 30, 250),
    defParametro('creatinina', 'Creatinina', 'mg/dL', 0.2, 15, 2),
    defParametro('crcl', 'CrCl, ' + M(metodoCrCl).nome, M(metodoCrCl).unidade, 1, 150),
    defParametro('pas', 'PAS', 'mmHg', 40, 300, 0),
    defParametro('pad', 'PAD', 'mmHg', 20, 200, 0),
    defParametro('fc', 'Frequência cardíaca', 'bpm', 20, 250, 0),
    defParametro('spo2', 'SpO₂', '%', 50, 100, 0),
    defParametro('killip', 'Killip (1 a 4)', 'classe', 1, 4, 0),
    defParametro('projecao', 'T0 ao dispositivo projetado', 'min', 0, 600, 0),
    defParametro('supraV2V3', 'Supra em V2-V3', 'mm', 0, 10),
    defParametro('supraOutras', 'Supra fora de V2-V3', 'mm', 0, 10),
    defParametro('resolucaoST', 'Resolução do supra', '%', 0, 100, 0),
    defParametro('troponina', 'Troponina', 'ng/L', 0, 100000, 0),
    defParametro('p99', 'Percentil 99 do ensaio', 'ng/L', 0, 100000, 0),
    defParametro('grace', 'GRACE', 'pontos', 0, 400, 0),
    defParametro('timi', 'TIMI', 'pontos', 0, 7, 0),
    defParametro('hb', 'Hemoglobina', 'g/dL', 3, 20),
    defParametro('plaquetas', 'Plaquetas', 'x10⁹/L', 5, 1000, 0),
    defParametro('pde5Horas', 'Último inibidor de PDE5 há', 'h', 0, 240, 0),
    defParametro('enoxHoras', 'Última enoxaparina SC há', 'h', 0, 240, 0),
  ],
  parametrosIniciais: ['idade', 'peso', 'creatinina', 'crcl', 'pas', 'pad', 'fc', 'spo2'],
  parametrosResultados: ['pas', 'pad', 'fc', 'spo2', 'peso', 'idade', 'creatinina', 'crcl', 'killip', 'hb'],
  /* Seção 6 e parágrafo de escopo. Qualquer item marcado encerra os passos automáticos. */
  triagem: [
    pergunta('parada', 'Parada cardíaca ou pós-parada'),
    pergunta('gestante', 'Gestante'),
    pergunta('menor18', 'Menor de 18 anos'),
    pergunta('dissecao', 'Suspeita de dissecção de aorta'),
    pergunta('scad', 'Dissecção coronariana espontânea'),
    pergunta('minoca', 'MINOCA'),
    pergunta('takotsubo', 'Takotsubo'),
    pergunta('tipo2', 'Infarto tipo 2'),
    pergunta('miopericardite', 'Miopericardite'),
    pergunta('aco', 'Anticoagulante oral de uso crônico'),
    pergunta('scm', 'Suporte circulatório mecânico'),
    pergunta('mecanica', 'Complicação mecânica'),
    pergunta('tvfv', 'TV ou FV refratária'),
    pergunta('dialise', 'Doença renal em diálise'),
  ],
  perguntasIniciais: [],
  perguntasAcompanhamento: [],
  ramos: [],
  exames: [
    defExame('ecg', 'ECG', 'Hora de registrar o ECG', true),
    defExame('dispositivo', 'Dispositivo', 'Hora de conferir o tempo até o dispositivo', true),
    defExame('bolus', 'Bólus (ESC)', 'Hora de conferir o bólus da fibrinólise', true),
    defExame('sintomas', 'Sintomas', 'Hora de conferir a janela dos sintomas', true),
    defExame('reavaliacao', 'Reavaliar (ESC)', 'Hora de reavaliar ECG e sintomas', true),
    defExame('angiografia', 'Angiografia', 'Hora de conferir a angiografia', true),
    defExame('troponina', 'Troponina', 'Hora de repetir a troponina', true),
    defExame('invasiva', 'Invasiva', 'Hora de conferir o prazo da invasiva', true),
  ],
  graficos: [
    defGrafico('pas', 'PAS', ['pas'], { pas: [linhaGrafico(90, '90')] }),
    defGrafico('spo2', 'SpO₂', ['spo2'], { spo2: [linhaGrafico(90, '90')] }),
    defGrafico('troponina', 'Troponina', ['troponina'], {}),
  ],
  camposResultados(e) {
    const c = [];
    if (resposta(e, 'supra') === false) c.push('troponina', 'p99', 'grace', 'timi', 'plaquetas');
    if (resposta(e, 'supra') === true) {
      if (teveAcao(e, 'fibrinolise.dose')) c.push('resolucaoST');
      if (!teveAcao(e, 'fibrinolise.dose')) c.push('projecao');
      c.push('supraV2V3', 'supraOutras');
    }
    c.push(...DEF.parametrosResultados);
    if (resposta(e, 'pde5') === true) c.push('pde5Horas');
    if (resposta(e, 'enoxPrevia') === true) c.push('enoxHoras');
    return c;
  },
  perguntasResultados(e) {
    if (teveAcao(e, 'fibrinolise.dose')) {
      return [pergunta('sintomasMelhoraram', 'Os sintomas melhoraram?'), pergunta('instabPos', 'Instabilidade hemodinâmica ou elétrica?')];
    }
    const q = [...perguntasInstabilidade];
    if (resposta(e, 'supra') === false) {
      q.push(pergunta('tropSubindo', 'Troponina subindo de forma acentuada apesar do tratamento?'),
        pergunta('stDinamico', 'Alterações dinâmicas de ST em curso?'),
        pergunta('isquemiaCurso', 'Isquemia em curso?'));
    }
    return q;
  },
  avaliar(e, agora) { return avaliar(motorSCA, e, agora); },
};

export const motorSCA = criarProtocolo(DEF);
export default motorSCA;

/* Adaptadores para o teste diferencial (compararFuncao da Ponte.swift): argumentos e resultados em JSON simples. */
export const funcoesTeste = {
  estimarCrCl: (m, c, i, s, p) => estimarCrCl(m, c, i, s, p),
  funcaoRenal: (e, m) => funcaoRenal(e, m),
  textoCrCl: (v, m) => textoCrCl(v, m),
  criterioSupra: (v, o, s, i) => criterioSupra(v, o, s, i),
  tenecteplaseMg: (p) => tenecteplaseMg(p),
  faixaTNK: (p) => faixaTNK(p),
  alteplaseMg: (p) => alteplaseMg(p),
  clopidogrelComFibrinolise: (i) => clopidogrelComFibrinolise(i),
  prasugrelManutencao: (p, i) => prasugrelManutencao(p, i),
  enoxComFibrinolise: (p, i, c) => enoxComFibrinolise(p, i, c),
  hnfUI: (p) => hnfUI(p),
  fondaparinuxBloqueado: (c) => fondaparinuxBloqueado(c),
  bivalirudinaInfusaoMgKgH: (c) => bivalirudinaInfusaoMgKgH(c),
  enoxNaICP: (pr, h, u) => enoxNaICP(pr, h, u),
  janela: (h) => janela(h),
  falhaReperfusao: (s, i, t, r) => falhaReperfusao(s, i, t, r),
  faixaRisco: (inst, g, sub, st, isq, timi, trop) => faixaRisco(inst, g, sub, st, isq, timi, trop),
  nitratoBloqueadoPorPDE5: (d, h) => nitratoBloqueadoPorPDE5(d, h),
  textoCorteSupra: (s, i) => textoCorteSupra(s, i),
  semVerbo: (r) => semVerbo(r),
  todasRegras: () => todasRegras(),
  contra: () => ({ absolutas: contraAbsolutas, relativas: contraRelativas, instabilidade: perguntasInstabilidade, metodo: metodoCrCl }),
  planoSupra: (e, agora, inst) => planoSupra(e, agora, inst),
  horaSintomas: (e, agora) => horaSintomas(e, agora),
  instabilidade: (e) => instabilidade(e),
  faixaAtual: (e, inst) => faixaAtual(e, inst),
  absolutasMarcadas: (e) => absolutasMarcadas(e).map((x) => x.chave),
  relativasMarcadas: (e) => relativasMarcadas(e).map((x) => x.chave),
  listaConferida: (e) => listaConferida(e),
  decisaoICPValida: (e, m, inst) => decisaoICPValida(e, m, inst),
};
