# Pontos do Swift que pareciam erro (achados na porta)

Achados durante a porta, portados iguais ao Swift enquanto esperavam decisão. Em 04/11/2026 o Matheus aprovou corrigir
os cinco e mais dois achados depois (itens 6 e 7). A correção foi feita primeiro no app (`medtech-ios`, com especificação, casos à mão e erro antigo plantado) e
depois aqui; o teste diferencial continua exigindo igualdade exata entre os dois.

## 1. Mal epiléptico: doses na mesma hora mudavam de ordem ao reabrir o app (lógica). RESOLVIDO em 04/11/2026

- Onde: `MotorEpileptico.swift` (`tiposIniciais`, `tiposSegunda`, `doses(_:prefixo:lista:)`) e `epileptico.js`.
- O que fazia: juntava as doses percorrendo um `Dictionary` e ordenava só por hora. O Swift sorteia a ordem dos dicionários
  a cada execução; com duas drogas na mesma hora (Novos resultados grava tudo com a hora da coleta), "a primeira" mudava:
  `cartaoInicial` ("Pode repetir uma vez" × "Esta opção não repete"), o nome no alerta de dose abaixo da plena e o nome na
  segunda terapia. O JS imitava a ordem do Swift com `SWIFT_DETERMINISTIC_HASHING=1`.
- Decisão e correção, nos dois: por hora; no empate, pela ordem fixa da Figura 1 (inicial: midazolam IM, lorazepam IV,
  diazepam IV, fenobarbital IV, diazepam retal, midazolam intranasal ou bucal; segunda: fosfenitoína, ácido valproico,
  levetiracetam, fenitoína, fenobarbital) e, dentro da mesma droga, a confirmada antes da digitada, cada uma na ordem em
  que entrou. A ordem de registro não serve entre drogas: o estado não a guarda entre séries diferentes. Desempate
  explícito pelo índice, sem depender de o sort ser estável. Registrado em `docs/sessao_epileptico_regras.md`.
- Prova: casos 59-61 e a grade "Doses na mesma hora em ordem fixa" do app reprovam o código antigo (com hash fixo e em seis
  sementes aleatórias); o código antigo plantado reprova. A varredura cobre todos os pares de drogas no empate e não usa
  mais `SWIFT_DETERMINISTIC_HASHING` (tirado de `varredura.sh`, `casos.sh` e `plantar.mjs`).

## 2. Estado hiperosmolar: fosfato de potássio liberado com K exatamente 5,0 (clínica). RESOLVIDO em 04/11/2026

- Onde: `MotorEHH.swift` e `ehh.js`, `cartaoFosfato`.
- O que fazia: com K = 5,0, sinais e fosfato <1,0, liberava "20-30 mmol de fosfato de potássio no fluido", enquanto o
  cartão de potássio (R32: "K exatamente 5,0: não repor") dizia para não repor.
- Decisão do Matheus: bloquear com K ≥5,0 (`k >= 5.0`). Com K 5,0 o cartão mostra "Sem orientação", decisão do médico,
  com a R32 entre as fontes; a linha 126 da especificação e a fonte `rFosfK` dizem "K ≥5,0".
- Prova: caso 98 (K 5,0) e a grade do fosfato (4,99 libera, 5,0 e 5,1 não) reprovam o código antigo; o erro antigo
  (`k > 5.0`) entrou nos plantados do app e daqui.

## 3. Anafilaxia: cada valor digitado em "Adrenalina dada há" contava como dose nova (lógica). RESOLVIDO em 04/11/2026

- Onde: `MotorAnafilaxia.swift` e `anafilaxia.js`, `horasDoses`.
- O que fazia: cada medida da série `adrenalinaHa` virava uma dose. Digitada de novo em Novos resultados, a mesma dose
  pré-hospitalar contava duas: número de doses no cronômetro, oxigênio por "nova dose" e o alerta de infusão.
- O que é "a mesma dose": a digitada que cai no mesmo minuto calculado (hora da coleta menos os minutos digitados, no
  minuto do relógio; os segundos da hora da coleta não contam, porque o campo é em minutos inteiros e a hora da coleta é
  escolhida em horas e minutos). Vale a primeira digitada. Duas doses reais nunca caem no mesmo minuto (repetição a cada
  5 a 15 min, R13). Só junta digitada com digitada; confirmada na tela não se junta. Digitada com 1 min de diferença
  conta como outra (a regra não adivinha arredondamento). Registrado em `docs/sessao_anafilaxia_regras.md`.
- Prova: casos 84-86 e a grade da mesma dose do app reprovam o código antigo; o erro antigo e "só no segundo exato"
  entraram nos plantados. A varredura ganhou um bloco de doses digitadas de novo (segundos variados, minutos vizinhos,
  três digitações, com confirmada no mesmo minuto).

## 4. SCA: fonte da função renal dizia "pendente" (texto). RESOLVIDO em 04/11/2026

- `rD8` (linha 279 da especificação) agora diz que o app usa CKD-EPI 2021, decisão do médico de 02/11/2026. A linha 279 de
  `docs/sessao_sca_regras.md` foi corrigida no lugar, sem mudar a numeração.

## 5. SCA: fonte S6b repetida no cartão de fibrinólise (texto). RESOLVIDO em 04/11/2026

- `cartaoReperfusao`, `.fibrinolise(considerar: true)` com paciente estável: agora `[S6b]` (instável segue `[S5, S6b]`).
- Prova: o teste do app ganhou o invariante "fonte sem repetição no cartão" (vale para todo cartão de toda avaliação
  colhida); o erro antigo entrou nos plantados do app e daqui.

## 6. Estado hiperosmolar: velocidade calculada com qualquer intervalo (lógica). RESOLVIDO em 04/11/2026

- Onde: `MotorEHH.swift` e `ehh.js`, `quedaGlicemia` e `quedaOsm` (alertas da R17 e da R19, cartões da osmolalidade e da
  salina 0,45%).
- O que fazia: dividia a diferença pelo intervalo, qualquer que fosse. Duas glicemias lançadas com menos de 1 min davam
  "Glicemia caindo 15013 mg/dL/h".
- Decisão do Matheus: a velocidade só é calculada com as duas medidas usadas a 30 min ou mais uma da outra (30 min exatos
  calculam). Abaixo disso a taxa não aparece; os cartões da osmolalidade e da salina 0,45% dizem "Intervalo curto para
  calcular a velocidade", e para a glicemia (que não tem cartão próprio) um aviso amarelo `glicIntervalo` diz o mesmo.
  Par com a mesma hora segue sem conta, como antes. Funções novas para o teste: `glicemiaIntervaloCurto`, `osmIntervaloCurto`.
- Sódio (R18): queda em mmol/L numa janela de 24 h, sem divisão pelo tempo. Decisão do Matheus: fica como está.
  Hiponatremia: só diferenças em janelas de 24 e 48 h, sem conta por hora; não mudou. CAD: ver o item 7.
- Prova: casos 100-104 e a grade de intervalos curtos do app reprovam o comportamento antigo; erro antigo, borda de 30 min
  e mínimo de 15 min plantados; a varredura cobre intervalos de 0,6 s a 241 min.

## 7. CAD: "glicemia não cai" comparava duas glicemias com qualquer intervalo (lógica). RESOLVIDO em 04/11/2026

- Onde: `MotorCAD.swift` e `cad.js`, alerta `naoCai` (sem regra numérica).
- O que fazia: com a insulina correndo, comparava as duas últimas glicemias, mesmo a minutos uma da outra.
- Decisão do Matheus: só compara com as duas glicemias a 30 min ou mais (30 min exatos comparam). Abaixo disso, mesma
  hora inclusive, o alerta não acende e um aviso amarelo `glicIntervalo` diz "Intervalo curto para calcular a velocidade".
- Prova: casos 69-72 e a grade nova do app reprovam o comportamento antigo; erro antigo e borda de 30 min plantados; a
  varredura ganhou o bloco de intervalos em volta de 30 min, com a insulina antes e depois da primeira glicemia.
