# Sessões de acompanhamento sem IA: motores em JavaScript

Porta fiel dos motores do app de iPhone (`medtech-ios/MedTech/Ferramentas/Sessoes/*.swift`) para o PWA.
O médico informa os parâmetros atuais e a regra devolve o próximo passo, com a fonte de cada orientação.
Sem IA, sem rede, sem dado de paciente. Aqui só tem a lógica; a tela é outra frente.

A regra clínica é a do Swift. Para mudar uma regra, muda-se primeiro no app (com a especificação e os testes de lá)
e depois aqui; o teste diferencial (`teste/`) reprova qualquer diferença entre os dois.

## Arquivos

| Arquivo | O que é |
|---|---|
| `nucleo.js` | Estado, construtores, formatação, passagem de plantão, comparação entre avaliações, guarda no aparelho. Porta de `NucleoSessao.swift` e do modelo de `SessaoView.swift`. |
| `index.js` | Registro: `todas`, `protocolo(id)`, `protocoloPorConduta(idConduta)` e `nucleo`. Porta de `SessoesDisponiveis.swift`. |
| `cad.js`, `sca.js`, `sepse.js`, `anafilaxia.js`, `epileptico.js`, `ehh.js`, `hipona.js` | Um motor por doença, `export default` o protocolo. |
| `package.json` | Só `"type": "module"`, para o Node tratar os `.js` como módulos ES. |
| `DIVERGENCIAS.md` | Pontos do Swift que parecem erro, portados iguais, para decisão do Matheus. |
| `teste/` | Prova de equivalência com o Swift (não é carregado pela tela). |

Ids: `cad`, `sca` (conduta `stemi`; `nstemi` cai na mesma sessão), `sepse`, `anafilaxia`, `epileptico`, `ehh`, `hipona`.

## Uso pela tela

```js
import { protocolo, nucleo as n } from './medtech/sessoes/index.js';
const p = protocolo('cad');
let e = n.carregarEstado('cad') ?? n.novoEstado('cad', Date.now());
const o = p.avaliar(e, Date.now());          // Orientacoes
n.salvarEstado(e);                            // localStorage, chave abaixo
```

Toda ação do médico muda o estado e a tela chama `p.avaliar(e, Date.now())` de novo (o app recalcula a cada toque e
a cada minuto, por causa dos relógios). As funções de mudança do estado, iguais às do modelo da tela do app:

| Função | Quando |
|---|---|
| `n.responder(e, chave, bool)` | resposta da triagem e das perguntas iniciais |
| `n.responderCartao(e, cartao.pergunta, bool, agora)` | pergunta dentro de um cartão (grava também a ação `resposta.<chave>`) |
| `n.escolher(e, ramo, opcao)` | ramos (`p.ramos`) |
| `n.medir(e, id, valor, hora)` | parâmetros iniciais e novos resultados (hora da coleta) |
| `n.confirmar(e, acaoProposta, agora)` | toque em uma ação de cartão, de `confirmacao.acao` ou `resolucao.acao` |
| `n.desfazerUltima(e)` | desfazer |
| `n.responderPasso(e, passo, rotulo, hora, aplicar)` | passo guiado; `aplicar(e)` grava a resposta (ver abaixo) |
| `n.voltarPasso(e)` | volta um passo guiado; devolve `false` se não há |
| `n.mudancas(antes, depois)` | lista "o que mudou" depois de novos resultados |
| `n.passagem(p, e, o, agora)` | texto da passagem de plantão (modelo fixo) |

Passo guiado (`o.passo`), conforme `passo.tipo.caso`, como no app:
- `simNao`: `aplicar = (e) => e.respostas[passo.chave] = v`, rótulo `passo.texto + " Sim"`/`" Não"`;
- `opcoes`: `e.escolhas[passo.chave] = op.id`, rótulo `passo.texto + " " + op.rotulo`;
- `numero`: `n.medir(e, passo.tipo.parametro, v, agora)`, rótulo `"<nome>: <num(v, casas)> <unidade>"`;
- `hora`: sem `aplicar`, `hora` = a escolhida (padrão `passo.tipo.padrao`; se `confirmarPadrao` existe, o médico
  tem de mexer na hora ou tocar nesse rótulo), rótulo `passo.texto + ": HH:mm"`;
- `lista`: sem `aplicar`, rótulo `passo.texto + ": lista conferida"`; itens com `trava: true` em vermelho;
- `semDado` (rótulo do botão): `e.respostas["semDado." + passo.chave] = true`, rótulo `passo.texto + " " + semDado`.

Os textos de tela que mudam por doença estão no protocolo: `rotuloProximoPasso`, `rotuloPrazoExame`, `tituloRamos`,
`nomeFonte`, `graficoFixo`, `tituloExames`, `tituloOutrosExames`, `tituloResolucao` (null tira a linha), `mostraTodasAsFontes`,
`camposResultados(e)` e `perguntasResultados(e)` (o que a tela de Novos resultados pede). `n.rotuloSituacao(situacao, p.nomeFonte)`
dá o rótulo da situação do cartão (ou use `cartao.etiqueta` quando vier).

## Contrato dos dados (JSON, igual ao Swift campo a campo)

Datas: **número em milissegundos desde 1970** (`Date.now()`), em todo lugar. Intervalos em texto já vêm formatados.
Campo opcional ausente é `null`, nunca omitido. Números com vírgula decimal já vêm formatados nos textos.

**Estado** (o que se salva):
`{ protocolo, inicio, series: { <parametro>: [{ valor, hora }] }, respostas: { <chave>: bool }, escolhas: { <chave>: string }, acoes: [{ id, tipo, rotulo, hora, valores: { <k>: number } }], etapa }`.
`etapa` é da tela (no app: `triagem`, `parametros`, `perguntas`, `ramos`, `agora`); os motores não leem.
Não existe campo para nome nem identificador do paciente, e não deve existir.

**Protocolo** (definição): `id, nome, descricao, idConduta, referencia, escopo, parametros [{ id, nome, unidade, minPlausivel, maxPlausivel, casas }]`
(`n.foraDaFaixa(def, v)` para o aviso de valor implausível), `parametrosIniciais, parametrosResultados, triagem, perguntasIniciais,
perguntasAcompanhamento [{ chave, texto, detalhe }], ramos [{ id, titulo, opcoes [{ id, rotulo, detalhe }] }],
exames [{ id, nome, aviso, destaque }], graficos [{ id, titulo, parametros, linhas: { <parametro>: [{ valor, rotulo }] } }]`.

**Orientacoes** (o que `avaliar` devolve):

| Campo | Tipo |
|---|---|
| `foraDeEscopo` | string[]; não vazio = aviso e nenhum passo automático |
| `triagemCompleta` | bool |
| `confirmacao`, `resolucao` | Painel ou null: `{ titulo, criterios [{ id, nome, situacao: 'sim'\|'nao'\|'falta', valor, opcional }], cumprido, regra, acao, texto }` |
| `classificacao`, `classificacaoDetalhe` | string ou null; `classificacaoRegra`: Regra ou null |
| `ramoBloqueado`, `ramoAtual` | `{ <opção ou ramo>: string }` |
| `travas` | `[{ id, titulo, texto, regra }]` (vermelho, no topo) |
| `alertas` | `[{ id, nivel: 'amarelo'\|'vermelho', texto, regra }]` |
| `cartoes`, `etapasFinais` | Cartão[] |
| `exames` | `[{ id, nome, aviso, destaque, ultima, janelaInicio, proxima, situacao: 'semDado'\|'noPrazo'\|'vencido'\|'encerrado', regra, rotuloSemDado }]` |
| `encerradaPelaRegra`, `faixaCaminho` | string ou null |
| `passo` | Passo ou null (uma pergunta por tela) |
| `relogioDesde` | data ou null (cronômetro do cabeçalho quando não é o início da sessão) |
| `cronometro` | `{ titulo, desde, subtitulo, marcos [{ minutos, rotulo }], regra }` ou null |

Cartão: `{ id, titulo, simbolo (nome SF Symbol do app; a tela troca pelo ícone Tabler), corHex (número, ex. 0x0F7F74), situacao, valor, conta, detalhe, regras [Regra], acoes [AcaoProposta], pergunta { chave, texto } | null, discreto, primeiro, liberado, doses { <k>: number }, etiqueta, noTopo }`.
`situacao`: `proximoPasso`, `correndo`, `travado`, `semIndicacao`, `faltaDado`, `decisaoMedico`, `pergunta`.
AcaoProposta: `{ tipo, rotulo, valores, secundaria }`. Regra: `{ linha, texto, origem }` (`linha` = linha do arquivo
`docs/sessao_<doenca>_regras.md` do app). Passo: `{ chave, secao, texto, detalhe, tipo, regras, semDado, confirmarPadrao }`,
com `tipo` = `{ caso: 'simNao' }` | `{ caso: 'opcoes', opcoes }` | `{ caso: 'numero', parametro }` | `{ caso: 'hora', padrao }` | `{ caso: 'lista', itens [{ chave, texto, trava }] }`.
A ordem dos cartões na tela segue as regras do app (`primeiro`, `noTopo`, `discreto`, situação); o motor devolve na ordem do Swift.

Funções auxiliares exportadas por doença (contas puras, as mesmas do Swift): ver o fim de cada módulo
(`gravidade`, `criteriosCAD`, `estimarCrCl`, `tenecteplaseMg`, `doseAdrenalina`, `hipotensaoCalculada`, `osmEfetiva`, `grau`, `conta` etc.).
`funcoesTeste` e `regras<Doença>` existem para o teste; a tela não precisa delas.

## Formatação

- `n.num(v, casas = 2)`: vírgula decimal, sem zeros à direita. Arredonda como o `String(format:)` da Apple: os dígitos
  mais curtos do número e meio para par (`2.675` → `2,68`; `0.125` → `0,12`). Conferido contra o Swift em 3,4 milhões de valores.
- `n.hora(ms)`: `HH:mm` no fuso do aparelho. `n.duracao(segundos)`: `"1 h 5 min"` / `"5 min"`.

## Guarda no aparelho

O estado fica só no navegador, em `localStorage`, chave **`mt.sessao.v1.<id>`** (ex.: `mt.sessao.v1.cad`), uma sessão por doença,
como o app (um arquivo por doença). `n.salvarEstado(e)`, `n.carregarEstado(id)`, `n.apagarEstado(id)` (encerrar a sessão).
Nada vai para a conta, para o Firestore nem para a rede. Avisos de exame: o texto é só `exame.aviso` (sem dado do paciente),
nas horas `janelaInicio` e `proxima` dos exames `noPrazo`, como o app faz com notificação local.

## Prova de equivalência (`teste/`)

Precisa do Mac com o app iOS em `~/Documents/Claude/medtech-ios` (só leitura), `swiftc` e `node`.

- `teste/varredura.sh <id> [semente] [escala]`: compila o motor Swift do app junto de `Codec.swift`, `Ponte.swift`,
  `VarreduraComum.swift` e `varredura_<id>.swift` numa pasta temporária, gera milhares de estados (bordas dos cortes colhidos
  do fonte Swift, caminhadas como na tela, estados aleatórios e grades da doença), avalia no Swift e no JS e exige igualdade
  exata: orientações inteiras, passagem de plantão, campos e perguntas de novos resultados, mudanças entre avaliações e as contas puras.
- `teste/casos.sh <id> [comparar|js|ambos]`: roda os testes do próprio app (casos à mão + grades), trocando só o motor.
  `comparar`: cada avaliação dos testes também é diferencial. `js`: os testes do app conferem a saída do JS.
  Onde o teste do app chama funções ou regras estáticas direto (`MotorSCA.janela`, `M.r17`...), `ponte_<id>.swift` e
  `troca_<id>.txt` desviam essas chamadas: com `PONTE=js`, cada uma também vai ao JS e reprova se ele discordar.
- `node teste/plantar.mjs <id>`: os erros plantados do `tools/sessao_<id>_teste.sh` do app, traduzidos para o JS; cada um tem
  de reprovar no diferencial e nos testes do app sobre o JS.
- `SWIFT_DETERMINISTIC_HASHING=1` fixa a ordem dos dicionários do Swift (ver `DIVERGENCIAS.md`, mal epiléptico). Datas do Swift
  (segundos desde 2001) viram milissegundos desde 1970 arredondados; os testes rodam em `America/Fortaleza` e `America/New_York`.
