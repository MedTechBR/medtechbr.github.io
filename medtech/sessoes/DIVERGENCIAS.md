# Pontos do Swift que parecem erro (portados iguais, sem correção)

Achados durante a porta. Nenhum foi corrigido, nem no app nem aqui: o JS faz exatamente o que o Swift faz, e o
teste diferencial garante isso. Cada item é decisão do Matheus; se mudar, muda primeiro no app e depois aqui.

## 1. Mal epiléptico: doses na mesma hora mudam de ordem ao reabrir o app (lógica)

- Onde: `MotorEpileptico.swift`, linhas 132-141 (`tiposIniciais`, `tiposSegunda`, `doses(_:prefixo:mapa:)`).
- O que faz: junta as doses percorrendo um `Dictionary` (`for (droga, serie) in mapa`) e depois ordena por hora. O Swift
  sorteia a ordem dos dicionários a cada execução do app. Com duas drogas na mesma hora (caso real: "Midazolam já dado" e
  "Lorazepam já dado" digitados juntos na tela de Novos resultados, que grava tudo com a hora da coleta), "a primeira" muda.
- Efeito: `cartaoInicial` ("Pode repetir uma vez" × "Esta opção não repete"), o nome na segunda linha e no alerta de dose
  abaixo da plena podem trocar só por reabrir o app, com os mesmos dados.
- No JS: ordem fixa, a mesma do Swift com `SWIFT_DETERMINISTIC_HASHING=1` (iniciais: lorazepam, midazolam, diazepam,
  fenobarbital, midazolamNasal, diazepamRetal; segunda: valproato, levetiracetam, fosfenitoína, fenitoína, fenobarbital).
  Sem essa variável, a varredura reprova justamente nesses empates (confirmado com duas sementes).
- Correção possível, nos dois: lista ordenada no lugar do dicionário, ou desempate fixo (ordem de registro).

## 2. Estado hiperosmolar: fosfato de potássio liberado com K exatamente 5,0 (clínica)

- Onde: `MotorEHH.swift`, `cartaoFosfato`, linha 719 (`if k > 5.0`).
- O que faz: com K = 5,0, sinais e fosfato <1,0, o cartão de fosfato libera "20-30 mmol de fosfato de potássio no fluido",
  enquanto o cartão de potássio (linha 480, `k >= 5.0`, regra R32: "K exatamente 5,0: não repor") diz para não repor.
- O código segue o texto da seção 5 (K >5,0), mas os dois cartões dão sinais opostos sobre potássio com K 5,0.
- Decisão: manter ou trocar para `k >= 5.0`.

## 3. Anafilaxia: cada valor digitado em "Adrenalina dada há" conta como dose nova (lógica)

- Onde: `MotorAnafilaxia.swift`, `horasDoses`, linhas 155-159.
- O que faz: cada medida da série `adrenalinaHa` vira uma dose. O campo está em `parametrosResultados` e volta na tela de
  Novos resultados; se o médico digita de novo a mesma dose pré-hospitalar, a sessão conta duas.
- Efeito: número de doses no cronômetro e na resolução, oxigênio liberado por "nova dose" (n ≥ 2) e o alerta de infusão
  ("Persistem sintomas após 2 doses") podem acender. Nenhuma dose a mais é sugerida: a repetição segue presa à janela de 5-15 min.
- Gravidade baixa.

## 4. SCA: fonte da função renal ainda diz "pendente" (texto)

- Onde: `MotorSCA.swift`, linha 218 (`rD8`): termina em "Decisão do médico, pendente.", mas `metodoCrCl` (linhas 7-9) e
  as decisões de 02/11/2026 em `docs/sessao_sca_regras.md` fixaram CKD-EPI 2021. A linha 279 da especificação também
  segue dizendo "pendente". Quem abre a fonte do cartão Função renal lê que a decisão ainda está pendente.

## 5. SCA: fonte S6b repetida (texto)

- Onde: `MotorSCA.swift`, linha 716 (`cartaoReperfusao`, `.fibrinolise(considerar: true)` com paciente estável): as regras
  ficam `[rS6b, rS6b]`. Como a SCA mostra todas as fontes, a folha da fonte repete a S6b.
