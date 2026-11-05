# MedTech PWA (`/medtech/`)

Versão web do app de iPhone (`~/Documents/Claude/medtech-ios`), com a mesma casca e o mesmo espaço Clínica.
Não mexe em `app.html`, no `/sw.js` do portal, no banco de condutas nem nas regras clínicas.

- Endereço: `medtechbr.com.br/medtech/` (`?demo=1` abre sem login, para teste).
- Atalhos de teste, como os argumentos `-demo`, `-aba=` e `-conduta=` do iPhone:
  `?demo=1`, `?aba=condutas|ferramentas|exames|plantoes|financas`, `?conduta=sepse`, `?conduta=sepse&topico=prescricao`, `?busca=texto`.

## Arquivos

| Arquivo | O que faz | Equivalente no iPhone |
|---|---|---|
| `index.html` | estrutura, login (`_mtfb.js` + `_mtauth.js`) e ordem dos scripts | `MedTechApp.swift` |
| `medtech.css` | tokens do Tema (claro e escuro), casca, leitor, folhas | `Tema.swift`, `EstiloConsultar.swift`, `Ferramentas.swift` (corFundo), `CondutasModelo.swift` (cor por área) |
| `casca.js` | barras Clínica/Gestão e de seções, tela inicial, busca, folhas, perfil, acesso por produto, **pontos de encaixe** | `MedTechApp.swift`, `InicioClinica.swift`, `ConsultarView.swift`, `PerfilView.swift` |
| `dados.js` | lê os dados do site (ver abaixo) e faz a busca | `BancoCondutas.swift`, `tools/consultar_gera_dados.mjs` |
| `conduta.js` | parser do markdown, tópicos, doses, ligações e formas | `MarkdownConduta.swift`, `OrganizaConduta.swift`, `FormasConduta.swift` |
| `leitor.js` | a doença aberta: barra de tópicos, páginas, camada didática, favoritar, bula | `LeitorConduta.swift`, `BlocosConduta.swift`, `FormasView.swift`, `CamadaDidatica.swift` |
| `presc.js` | tópico Prescrição: cenários, itens, copiar e conferência por regra | `PrescricaoFolha.swift`, `PrescricaoModelo.swift` |
| `fluxo.js` | fluxograma passo a passo e diagrama | `FluxoGuiado.swift`, `DiagramaFluxo.swift` |
| `ui.js` | folha que sobe, alerta, aviso, pilha de camadas com o Voltar do aparelho | (SwiftUI) |
| `sw.js`, `manifest.webmanifest` | PWA com escopo `/medtech/`, offline | |
| `didatica/*.json` | camada didática (Em 1 minuto, Primeiros passos, Teste-se, fluxo de tratamento) | `MedTech/Consultar/Dados/didatica/` |
| `fer-ponte.js` | a ponte do iPhone (DOM mínimo), copiada sem mudança; cada chamada cria um global isolado | `Ferramentas/Dados/ferramentas_ponte.js` |
| `fer-motor.js` | motor das Ferramentas, sem DOM: lê o JS original do site, roda na ponte e devolve dados e motores | `tools/ferramentas_gera_dados.mjs`, `MotorCalc`, `MotorATB`, `MotorPocus`, `MotorPali`, `MotorCondutai`, `BuscaFerramentas` |
| `fer-ui.js` | camada de ferramenta, componentes, barra acima do teclado, painel e conversa de IA | `FerramentasComum.swift`, `FerramentasIA.swift` |
| `ferramentas.js` | as telas das 14 ferramentas e o encaixe na casca (`ferramenta` e `busca`) | `Calculadoras.swift`, `Antibioticos.swift`, `Pocus.swift`, `Paliativos.swift`, `FerramentasCondutai.swift` |
| `ferramentas.css` | estilo das Ferramentas (tinta por ferramenta, faixas de resultado, claro e escuro) | `Ferramentas.swift` (corFundo, corTinta), `FaixaClinica` |
| `cofre.js` | dados de Plantões e Finanças: abre `plantaohub.html` e `granae.html` em quadros ocultos e lê e grava por eles | `MeuMes/CofreMes.swift` |
| `sessoes-tela.js`, `sessoes.css` | tela das sessões de acompanhamento sem IA (lista, triagem, parâmetros, Agora, passo guiado, subtelas, avisos) | `Ferramentas/Sessoes/SessaoView.swift`, `SessaoArmazem.swift` |
| `sessoes/*.js` | motores das sessões (contrato em `sessoes/LEIAME.md`) | `Ferramentas/Sessoes/Motor*.swift`, `NucleoSessao.swift` |
| `gestao.js`, `gestao.css` | espaço Gestão: Plantões e as peças comuns (`MTGestao.comum`: arrasto do mês, linha deslizante, avisos, folhas de pagamento, teto e fixo) | `MeuMes/PlantoesView`, `MaisMes`, `ModelosMes`, `ComumGestao` |
| `financas.js`, `financas.css` | Finanças nova: 6 abas (Resumo, Lançamentos, Orçamento, Cartões, Dívidas, Contas), Lançar, revisão em lote, análise do mês por IA | `MeuMes/FinancasView`, `FinancasCartoes`, `FinancasDividasContas`, `FinancasLancamentos`, `FinancasCalculo`, `LancarView` |

## De onde vêm os dados (nada copiado do banco)

- `../condutai.html`: `SPECIALTIES`, `PROTOCOLS`, `CRITERIOS`, `CRIT_MAP`, `BULAS_OFF`, `criteriosFor`, `protocolAliases` e `sanitizeMermaid`,
  recortados do próprio HTML com a regra de `consultar_gera_dados.mjs` (vai até a primeira linha só com `};` ou `];`).
  As versões `?v=` dos JS abaixo também saem das tags `<script>` do `condutai.html`.
- `../condutai-banco.js` (`OFFLINE`), `../condutai-prescricoes.js` (`PRESC_MODELOS`), `../condutai-seguranca.js` (`CVSeg.conferir`, TFG CKD-EPI 2021),
  `../condutai-didatica.js` (`CVD.parseFluxo`) e `../condutai-ligacoes.js` (`CVL._bulaDe`), carregados como estão.
- Texto da conduta = `OFFLINE[id] + criteriosFor(id)`, igual a `showOfflineProtocol`.
- `didatica/*.json` é a única cópia: a camada didática ainda não existe no site. Fonte editável no iPhone:
  `tools/consultar_didatica_fonte.py`. Ao mudar lá, copiar os JSON para cá e atualizar `didatica/indice.json`.
- Conferido em 03/11/2026 contra o parser Swift do iPhone (`tools/consultar_verifica_main.swift` compilado no Mac):
  formas idênticas nas 274 condutas (mesma contagem por tipo); tópicos, doses citadas e selos de bula iguais em 274/274;
  links entre condutas iguais em 270/274 (4 condutas com 1 link a menos, porque aqui vale a regra `\b` do `linkifyRelated` do site).

## Ferramentas (fer-*.js e ferramentas.js)

- A lista da seção é a da casca (`montaFerramentas`, mesmas portas do iPhone). As telas entram por `MedTechCasca.registrar('ferramenta', ...)`
  e os itens das ferramentas na busca da tela inicial por `registrar('busca', ...)`. `casca.js` não foi alterado.
- Nenhuma regra clínica é escrita aqui. `fer-motor.js` faz em tempo real o que o gerador do iPhone faz uma vez:
  `condutai-calc.js`, `condutai-atb.js` e `condutai-pocus.js` (versões do `condutai-areas.js`), `paliai.html` + `pali-conteudo.js` e os trechos de
  `condutai.html` (mesma lista de `ferramentas_gera_dados.mjs`) + `condutai-seguranca.js` rodam sem mudança dentro do global da ponte
  (`new Function` + `with`, sem `setTimeout` nem DOM, como o JavaScriptCore). Contas: `calc()`, `CVATB.calcDoseTool()`/`calcClcrFill()` (CKD-EPI 2021),
  `compute()` do PaliAI, `interpretarGaso()`, calculadoras de ECG/VM, `runCid()`, `conferenciaInteracoes()`. Prompts de IA: as funções originais;
  a chamada vai ao `MT.ai` do login central com o nível e as opções do iPhone. Com `?demo=1` a IA devolve uma resposta simulada (igual ao `-demo`).
- Atalho de teste, como `-ferramenta=` do iPhone: `?ferramenta=calculadoras/ckdepi`, `?ferramenta=antibioticos/dose:vancomicina`, `?ferramenta=pocus/blue`,
  `?ferramenta=paliativos/triagem`, `?ferramenta=cid/J18`.
- Prova de paridade (Node, no scratchpad da sessão de 03/11/2026, pasta `paridade/`): os dados extraídos em tempo real são iguais aos JSON do pacote
  do iPhone (calculadoras, antibióticos, POCUS, paliativos, CondutAI e índice de busca), a ponte e o trecho do `condutai.html` são idênticos byte a byte,
  e os números batem com o caminho do iPhone nos casos do `AutotesteFerramentas.swift`: 64/64 calculadoras (4.444 casos), 534/534 doses em 89 faixas
  renais (faixa acesa certa 495/495), 400/400 doses da ficha, TFG, 129/129 prompts, gasometria 400/400, ECG 200/200, VM 200/200, CID 173/173, triagem 504/504.
- Favoritas e recentes das calculadoras: `localStorage['medtech.calc.favoritas']` e `['medtech.calc.recentes']` (ids por vírgula; recentes guarda 6).
- Offline: o `sw.js` guarda os arquivos acima no precache; as imagens do POCUS entram no cache quando abertas.

## Pontos de encaixe (contrato)

Tudo passa por `window.MedTechCasca` (versão 1). Uma frente nova entra com um script próprio carregado depois de `casca.js`
e chama `MedTechCasca.registrar(...)`. Nenhuma frente edita `casca.js` para se ligar.

### Seções (Ferramentas completas, Plantões, Finanças)

```js
MedTechCasca.registrar('secao', 'plantoes', function (el) { /* desenha dentro de el */ });
```

- Chaves: `condutas`, `ferramentas`, `exames`, `plantoes`, `financas`. `el` é a `<section>` da seção, com altura fixa entre as barras;
  quem desenha cuida da própria rolagem (a casca usa `.rola-secao`, que pode ser reaproveitada).
- A seção só é montada na primeira visita e continua viva ao trocar de seção, como no iPhone.
- Se a seção estiver fora do plano da conta, a casca mostra o aviso de plano e não chama o encaixe.
- Evento `medtech:secao` (em `document`, `detail.secao`) a cada troca de seção.

### Ferramentas avulsas (Calculadoras, Antibióticos e as demais portas)

```js
MedTechCasca.registrar('ferramenta', function (id, item) { /* abre a ferramenta id, opcionalmente no item */ });
```

- Ids e nomes iguais aos de `Ferramentas.swift`: `sessoes`, `calculadoras`, `antibioticos`, `gasometria`, `ventilacao`, `ecg`, `pocus`,
  `investigacao`, `ddx`, `interacoes`, `procedimentos`, `vacinas`, `cid`, `paliativos`, `orientacoes` (`MedTechCasca.ferramentas` traz nome, descrição e cor).
- Chamado pelos botões Calculadoras e Antibióticos da tela inicial e pelas portas da aba Ferramentas. Sem encaixe, abre um aviso "em construção" com link para o CondutAI.
- Resultado de busca de ferramenta: `MedTechCasca.registrar('busca', fn)`, onde `fn(textoNormalizado)` devolve
  `[{ titulo, detalhe, cor, abrir }]` (texto já sem acento e em minúsculas). Aparecem depois das condutas, como no iPhone.

### Sessões de acompanhamento

- Lista (ordem do iPhone): `cad`, `sca` (condutas `stemi` e `nstemi`), `sepse`, `anafilaxia`, `epileptico`, `ehh`, `hipona`.
  `MedTechCasca.sessoes.lista` e `MedTechCasca.sessoes.daConduta(idConduta)`.
- **Estado em andamento**: uma chave só, a dos motores: `localStorage['mt.sessao.v1.<id>']` = JSON `EstadoSessao` (contrato em `sessoes/LEIAME.md`;
  `inicio` em milissegundos). Chave presente = sessão em andamento. A barra azul da tela inicial lê essas chaves: nome, "Em andamento há…", "e mais N",
  "Continuar" e "Finalizar". (Antes desta tela a casca lia `medtech.sessao.<id>`, que ninguém gravava; trocada sem migração.)
  Os motores são importados sem `?v=`: ao mudar `sessoes/*.js`, subir o nome do `CACHE` no `sw.js` para o aparelho buscar a versão nova.
- "Finalizar e apagar" remove a chave e dispara `medtech:sessoes` em `document` (`detail.finalizada = id`); a tela cancela os avisos dessa sessão.
  Toda gravação da tela dispara o mesmo evento (`detail.id`) para a barra se redesenhar.
- Abrir: `MedTechCasca.registrar('sessao', function (id, sessao) { ... })`, feito por `sessoes-tela.js`. `id` é o protocolo (ex.: `'sca'`) vindo de "Continuar"
  ou de "Acompanhar este paciente" dentro da doença; `id = null` quando vem da linha "Acompanhar paciente" das Ferramentas ou da barra vazia (abre a lista).
- Dado de paciente fica só no aparelho; nada disso vai para a nuvem. Sair da conta (`MT.signOut`) limpa o `localStorage`.

### Tela das sessões (`sessoes-tela.js`, `sessoes.css`)

Porta de `SessaoView.swift` e `SessaoArmazem.swift`. Módulo ES carregado depois da casca; importa `sessoes/index.js` (motores, que não são alterados aqui).
Nenhuma regra clínica na tela: tudo o que aparece é o que `protocolo.avaliar(e, Date.now())` devolveu, reavaliado a cada toque, a cada 30 s e a cada
segundo quando há cronômetro (como o app). Usa a camada `.fer` das Ferramentas (`MTFerUI.tela`: cabeçalho, barra acima do teclado, pé).

- Telas: lista de sessões, triagem (com "Fora do escopo"), Parâmetros de agora (faixa plausível com "Confirme o valor"), Sobre o paciente, ramos
  (classificação, critérios, opções bloqueadas), Agora (faixa do caminho, cronômetro grande, travas, alertas, resolução cumprida, curva fixa, relógios
  dos exames, cartões na ordem `prioridade()` do app, "Sem indicação agora", menu) e passo guiado (uma pergunta por tela: sim/não, opções, número, hora,
  lista, "sem dado"). Subtelas: Resolução e transição, Evolução em gráfico (SVG próprio, sem animação), Passagem de plantão (texto de `nucleo.passagem`),
  Registro (com "Finalizar e apagar a sessão"), Novos resultados e O que mudou (`nucleo.mudancas`). "Ver regra e fonte" abre uma folha
  (com as demais regras do cartão quando `mostraTodasAsFontes`).
- Hora que exige escolha (`confirmarPadrao`): enquanto a hora for a padrão, o botão fica "Escolha a hora acima" e não faz nada; só a hora mexida ou o
  botão do `confirmarPadrao` registram.
- Avisos de exame: `Notification` com o título "MedTech" e o texto `exame.aviso` do motor (sem dado de paciente), nas horas `janelaInicio` e `proxima`
  dos exames `noPrazo`. A permissão é pedida no toque em "Seguir" da triagem, como no iPhone. Os avisos são `setTimeout` com a página aberta
  (reprogramados ao abrir o app para todas as sessões guardadas); sem permissão ou sem suporte, valem os relógios na tela.
- Atalho de teste: `?sessao=lista` ou `?sessao=<id>` (com `?demo=1`). `window.MTSessoesTela.atual()` devolve `{ p, e, o }` da sessão aberta.

Diferenças em relação ao iPhone: hora por seletor do navegador (`datetime-local` no passo, `time` na coleta) no lugar da roda; ícones Tabler no lugar
dos SF Symbols; blocos de exame com mais de 3 itens quebram em linhas (o iPhone espreme numa linha); "O que mudou" tem botão de voltar no topo;
o Voltar do aparelho fecha a sessão inteira (no app não existe esse gesto); na Resolução, confirmar um cartão mostra "Registrado às" num aviso
passageiro (o app não mostra nada); os avisos de exame só disparam com o app aberto (o iPhone agenda notificação local no sistema); sem vibração.

### Outros

- `MedTechCasca.registrar('prescricaoIA', function (conduta) {...})`: botão "Montar prescrição com IA" das doenças sem modelo.
  Sem encaixe, abre o CondutAI na busca da doença.
- `MedTechCasca.registrar('perfil', { titulo, href })`: link a mais na folha "Sua conta".
- `MedTechCasca.abrirConduta(id)`, `MedTechCasca.abrirFerramenta(id, item)`, `MedTechCasca.irSecao(id)`.
- Favoritas e recentes: `localStorage['medtech.condutasFavoritas']` e `['medtech.condutasRecentes']`, ids separados por vírgula
  (mesmo formato do iPhone; recentes guarda 12). Tabelas em grade: `localStorage['medtech.tabelaEmGrade'] = '1'`.

## Conta e acesso

- Mesmo login do portal: `window.MT_APP = { id: 'portal', linha: 'clinica' }`, `_mtfb.js` e `_mtauth.js` (tela de login, splash e CPF são os dele).
  Com `id: 'portal'` o `_mtauth.js` não põe o botão de voltar ao portal e não aplica a trava de app avulso.
- Acesso por produto como em `app.html`: `MT.acessoEstado()` e `MTAcesso.liberado(P, mt, produto)`. Seção → produto:
  Condutas e Ferramentas `condutai`, Exames `laudai`, Plantões `plantaohub`, Finanças `granae`. Fora do plano: aviso com link para Assinatura.
  Enquanto nenhum produto tiver venda ligada no `planos.json`, nada trava.
- Exames abre `../laudai.html?achados=1` dentro da seção (mesmo domínio, mesma sessão de login).

## PWA

- Manifesto próprio (nome MedTech, `icone-192/512`, escopo e início `/medtech/`).
- `sw.js` só controla `/medtech/` (não substitui o `/sw.js` do portal). Precache da casca, do `condutai.html`, dos JS do banco,
  dos ícones e da camada didática com `cache: 'reload'`; estáticos em stale-while-revalidate; navegação rede primeiro com reserva offline.
- Ao mudar qualquer arquivo daqui: subir o `?v=` no `index.html` e em `NUCLEO`, e o nome do `CACHE` no `sw.js`.

## Diferenças conhecidas em relação ao iPhone

- Sessões de acompanhamento: ver "Tela das sessões" acima. Plantões e Finanças: ver "Espaço Gestão" abaixo.
- Ferramentas: o diagrama do POCUS é desenhado em SVG a partir das mesmas formas do iPhone (com halo pulsante no ponto); clipes GIF, com Reduzir movimento,
  só tocam ao tocar em "Tocar clipe"; títulos e nomes aparecem sem travessão (": "), o texto clínico fica como veio; sem vibração;
  a data das calculadoras usa o seletor de data do navegador (o iPhone mostra o calendário aberto).
- Diagrama do fluxograma: desenhado pelo mermaid do site (com `sanitizeMermaid`, que troca `≤` por "menor ou igual a"), não pelo desenho nativo.
- Tópicos trocam por toque ou deslizando a página (scroll-snap); sem vibração; ícones Tabler no lugar dos SF Symbols.
- Prescrição com IA (doenças sem modelo) leva ao CondutAI; no iPhone ela roda dentro do app.
- Exames mostra o LaudAI no modo Achados dentro de um quadro, não a tela nativa `AchadosView`.

## Espaço Gestão (Plantões e Finanças)

Entra por `MedTechCasca.registrar('secao', 'plantoes' | 'financas', ...)` em `gestao.js`; `casca.js` não foi mexido. Clínica e Gestão não se misturam.

### De onde vêm os dados (`cofre.js`, igual ao `CofreMes.swift`)

- O PWA nunca fala direto com o Firestore. Ao abrir a seção, o cofre carrega `../plantaohub.html` ou `../granae.html` num `<iframe>` oculto,
  inerte e fora da tela (mesmo domínio, mesma sessão de login). Cada app liga o `_mtauth.js` dele e lê `users/{uid}/apps/plantaohub` ou `.../granae`.
- Pronta = `MT.user`, `MT._data` e `MT.mergeFn` presentes: o app registra o `mergeFn` no mesmo bloco em que liga o `MT.onData`, então o `state` dele já é o da nuvem.
  (Sem essa última condição, uma gravação logo na abertura partiria do `state` vazio do app.)
- Leitura: uma "capa" instalada na página exporta o `state` a cada `MT.onData` (100 ms de folga). No Granaê a exportação (`exportaGranae` em `cofre.js`, rodada dentro da página)
  leva também o que as funções do próprio app calculam: `faturaDoCartao` e `faturaPaga` (2 meses antes a 4 depois, por cartão), `compromissos()`, `saldoDaConta`,
  `projecaoSaldo(3)`, `comprometimentoPorMes(7)`, `paraRevisar()`, o resumo do Open Finance (`GranaeOF.feed()` e `frescor`) e a Visão geral de `granae.banco.js`
  (contas, financiamentos, investimentos, previdência e patrimônio). Como essas funções ficam fechadas no módulo dele, a Visão geral é cópia fiel
  (inclusive a regra de que pagamento que já pertence a um compromisso, `groupId`, não vira "parcela achada no extrato", corrigida no `granae.banco.js?v=7`). Escrita: as operações de `JSMes` do iPhone, copiadas
  dos formulários dos próprios apps (`saveForm`, `toggleStatus`, `del`, `dup`, `setCompDay`, `salvarRegraPg`, `txForm`, `txDelete`, `txDup`, `pagForm`,
  `fixedForm`, `fixedDelete`, `catForm` só a meta; na Finanças nova também `alternarFaturaPaga`, `criarTransferencia`, `informar` da Visão geral
  (saldo devedor e previdência em `profile.bancoSaldos`), `cmtForm`, `divForm`, `accForm` e `aplicarRevisao` com regra), rodando dentro da página com as funções dela (`persist`, `saveState`, `stampTx`, `tombstone`,
  `MT.markDeleted`, `uid`, `cid`, `aplicarRegras`, `compromissos`). Formato e lugar de gravação são os do app; o merge por entidade e as lápides são os dele.
- Mesmas duas diferenças deliberadas do iPhone: salvar plantão mantém `pgDia`/`pgMes` do local; editar lançamento mantém grupo, banco e vencimento.
- Compra parcelada pelo total (Lançar): `salvarLancamento` com `porTotal` divide o total em centavos e a sobra fica na 1ª parcela (R$ 1.000 em 3x = 333,34 + 333,33 + 333,33);
  o resto é o caminho do `txForm` (descrição "(k/N)", `groupId`, uma por mês com o dia ajustado, `pending` nas futuras). Igual ao `DivisaoParcelas` do iPhone.
- Leituras sem gravar (`cofre.consultar`): `analisarMes` (Gemini.analyzeMonth + safeMD do Granaê) e `sincronizar` (o clique da faixa do Open Finance).
- Uma gravação por vez (fila). Antes de gravar na conta real, a capa confere a nuvem (`getDocFromServer`, 8 s); sem rede, nada é gravado e o
  `MT.save` da página não cai no `setDoc` sem merge. A tela só muda quando a gravação foi confirmada (até 20 s).
- Sem rede a página nem abre (ela gravaria sozinha ao ativar agendados). Diferente do iPhone, não há cópia guardada em disco: sem rede, a tela mostra o
  que foi carregado nesta sessão, com o horário.
- Sair da conta: o cofre fecha os quadros antes do `MT.signOut` (assim o `clearIndexedDbPersistence` não esbarra neles) e esquece o que estava na memória.

### `?demo=1`

- As mesmas páginas, no modo demonstração nativo do `_mtauth.js`: o quadro recebe o HTML da página com só duas mudanças (`<base>` do site e a
  configuração do Firebase vazia). Dados fictícios só neste navegador (`mt_plantaohub_anon`, `mt_granae_anon`), nunca a nuvem.
- Trava: página em demo só com `?demo=1`, página na nuvem só sem ele; se não conferir, o quadro é fechado e nada é gravado.
- Semente fictícia (a do `RepositorioDemo` do iPhone, mais cartões, contas, parcelados, financiamento, meses anteriores e teto de subcategoria) gravada pela própria
  página na primeira abertura (`localStorage['medtech.demo.semeado.v3.*']`). O resumo do Open Finance da demonstração (dois bancos fictícios, um pedindo reconexão)
  entra a cada abertura por `GranaeOF._setFeed`, e a própria importação do Granaê cria as contas e os lançamentos. Na demonstração a análise por IA é simulada.
- Atalho de teste: `?demo=1&aba=financas&fin=resumo|lancamentos|orcamento|cartoes|dividas|contas`. `window.MTFinancas` expõe `F`, `irAba` e `desenha`.
- O `granae.app.js` escreve `localStorage['gc-state-v1']` (cópia que ninguém lê); na demo o cofre devolve o valor que havia antes, para a cópia da conta real deste navegador não virar fictícia.
- Para conferir a compatibilidade com os apps originais na demo, eles precisam abrir no modo demo nativo (Firebase sem configuração). No teste de 03/11
  isso foi feito com um servidor local que entrega `_mtfb.js` vazio só quando `plantaohub.html?demo=1` ou `granae.html?demo=1` é aberto direto na aba.

### Telas (iguais ao iPhone)

- Plantões: cabeça do mês (ano ou período, Mais opções, vizinhos, arrastar de lado troca o mês), próximo plantão, Falta receber (abre recebidos,
  previsão por local com a regra e atrasados), calendário (toque escolhe o dia; toque longo ou botão direito: copiar o dia e lançar nele; colar tocando nos dias),
  lista do mês ou do dia (arrastar para a direita alterna recebido, para a esquerda exclui, com Desfazer), botão Lançar plantão (no dia escolhido).
- Folha do plantão: locais recentes, outro local (preenche horário e valor do local), dia, início, fim, valor com horas e valor por hora, A receber/Recebido,
  observação, Duplicar em 7 dias e Excluir.
- Mais opções de Plantões: Locais e pagamento (período do mês, regra padrão, regra por local), Plantões no ano, e o PlantãoHub no site (CSV).
- Finanças (nova, 05/11/2026, igual ao app de iPhone): 6 abas em pílulas e Lançar fixo embaixo. Resumo, Lançamentos e Orçamento seguem o mês; Cartões, Dívidas e Contas são hoje.
  Resumo: Entrou (verde-azulado) e Saiu (roxo) com previsto pelos fixos e "<mês> fechou em R$ X" no mês corrente (porcentagem nos meses fechados), alerta de teto,
  "sem categoria", rosca (5 maiores e o resto), barras Entrou x Saiu de 6 meses, "Saldo acumulado" com a projeção do Granaê, atalhos, agendados e "Analisar este mês com IA".
  Lançamentos: busca por descrição ou valor, Tudo/Saídas/Entradas, Sem categoria (abre a revisão em lote com regra), Conta, Categoria, selos (do banco, parcela k de N,
  transferência, agendado). Orçamento: tetos pelo risco (roxo, âmbar a partir de 80%, laranja passou com o traço do teto), subcategoria, sem teto, fixos do mês.
  Cartões: fatura aberta (`faturaAtual` do Granaê), fecha e vence, limite, faturas fechada/aberta/previstas com marcar paga, compras da fatura, peso das parcelas
  (o mês corrente só entra se ainda há parcela por vencer), compras parceladas. Dívidas: falta pagar, sai por mês, prazo (sem data = faixa clara), cartão por dívida
  com informar saldo ou registrar pagamento, novo financiamento e nova dívida. Contas: saldo, leitura do Open Finance com Sincronizar, Reconectar, bancos e estado,
  importados sem categoria, patrimônio (dinheiro menos dívidas, mesmo negativo; imóvel e carro não entram).
- Lançar: Despesa/Receita/Transferência, valor no teclado, descrição, categorias mais usadas, pagar com, quando, parcelas pelo total, aviso da fatura em que entra.
- Mais opções de Finanças: Transferir, Revisar sem categoria, Fixos e tetos, CSV do mês (o mesmo do Granaê); abrem o Granaê no site: voz, leitura de fatura,
  regras e filtros salvos, categorias e contas, conectar ou reconectar banco (o widget do Pluggy precisa de tela visível), planilha de fixos e análise completa.

### Diferenças em relação ao iPhone

- Toque longo no dia vira folha com as duas ações (no iPhone é o menu de contexto); no computador, o botão direito também abre.
- Categorias do lançamento quebram em linhas com rolagem vertical (no iPhone, duas linhas com rolagem lateral): nada rola de lado.
- Plantões no ano: o gráfico é só visual e o detalhe de cada mês vem na lista "Por mês" (no iPhone, toque na barra). Assim nenhum alvo fica abaixo de 44 px.
- Botão de voltar das telas internas diz "Voltar"; Desfazer, avisos e números sem animação de contagem; sem vibração.
- As páginas abrem quando a seção é aberta (no iPhone, as duas abrem juntas): o Granaê é pesado e só carrega quando Finanças é aberta.
- Finanças: "Ver as N compras" leva a Lançamentos filtrado pela fatura (no iPhone abre uma folha); Conectar e Reconectar banco abrem o Granaê no site.
- Sem cópia em disco para ver sem internet (ver acima).
