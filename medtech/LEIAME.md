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
| `gestao.js`, `gestao.css` | espaço Gestão: Plantões, Finanças, lançar, mais opções | `MeuMes/PlantoesView`, `FinancasView`, `LancarView`, `MaisMes`, `ModelosMes`, `ComumGestao` |

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
- **Estado em andamento**: `localStorage['medtech.sessao.<id>']` = JSON com pelo menos `{ "protocolo": "<id>", "inicio": "<data ISO 8601 ou milissegundos>" }`
  (o resto é livre; o formato do iPhone é `EstadoSessao`). Chave presente = sessão em andamento.
  A barra azul da tela inicial lê essas chaves: nome, "Em andamento há…", "e mais N", "Continuar" e "Finalizar".
- "Finalizar e apagar" remove a chave e dispara `medtech:sessoes` em `document` (`detail.finalizada = id`).
  Quem gravar ou mudar uma sessão dispara o mesmo evento para a barra se redesenhar (`document.dispatchEvent(new CustomEvent('medtech:sessoes'))`).
- Abrir: `MedTechCasca.registrar('sessao', function (id, sessao) { ... })`. `id` é o protocolo (ex.: `'sca'`) vindo de "Continuar"
  ou de "Acompanhar este paciente" dentro da doença; `id = null` quando vem da barra "Acompanhar paciente" (escolher a doença).
- Dado de paciente fica só no aparelho; nada disso vai para a nuvem. Sair da conta (`MT.signOut`) limpa o `localStorage`.

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

- As sessões de acompanhamento são ponto de encaixe (outra frente); a linha "Acompanhar paciente" das Ferramentas segue para o encaixe das sessões. Plantões e Finanças: ver "Espaço Gestão" abaixo.
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
- Leitura: uma "capa" instalada na página exporta o `state` a cada `MT.onData` (100 ms de folga). Escrita: as operações de `JSMes` do iPhone, copiadas
  dos formulários dos próprios apps (`saveForm`, `toggleStatus`, `del`, `dup`, `setCompDay`, `salvarRegraPg`, `txForm`, `txDelete`, `txDup`, `pagForm`,
  `fixedForm`, `fixedDelete`, `catForm` só a meta), rodando dentro da página com as funções dela (`persist`, `saveState`, `stampTx`, `tombstone`,
  `MT.markDeleted`, `uid`, `cid`, `aplicarRegras`, `compromissos`). Formato e lugar de gravação são os do app; o merge por entidade e as lápides são os dele.
- Mesmas duas diferenças deliberadas do iPhone: salvar plantão mantém `pgDia`/`pgMes` do local; editar lançamento mantém grupo, banco e vencimento.
- Uma gravação por vez (fila). Antes de gravar na conta real, a capa confere a nuvem (`getDocFromServer`, 8 s); sem rede, nada é gravado e o
  `MT.save` da página não cai no `setDoc` sem merge. A tela só muda quando a gravação foi confirmada (até 20 s).
- Sem rede a página nem abre (ela gravaria sozinha ao ativar agendados). Diferente do iPhone, não há cópia guardada em disco: sem rede, a tela mostra o
  que foi carregado nesta sessão, com o horário.
- Sair da conta: o cofre fecha os quadros antes do `MT.signOut` (assim o `clearIndexedDbPersistence` não esbarra neles) e esquece o que estava na memória.

### `?demo=1`

- As mesmas páginas, no modo demonstração nativo do `_mtauth.js`: o quadro recebe o HTML da página com só duas mudanças (`<base>` do site e a
  configuração do Firebase vazia). Dados fictícios só neste navegador (`mt_plantaohub_anon`, `mt_granae_anon`), nunca a nuvem.
- Trava: página em demo só com `?demo=1`, página na nuvem só sem ele; se não conferir, o quadro é fechado e nada é gravado.
- Semente fictícia (a do `RepositorioDemo` do iPhone) gravada pela própria página na primeira abertura (`localStorage['medtech.demo.semeado.*']`).
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
- Finanças: cabeça do mês, Entrou (abre as receitas), Saiu (abre gastos por categoria com teto), Saldo, lista com filtro (tipo, busca, categoria),
  agendados à parte, arrastar para a esquerda exclui com Desfazer, botão Lançar.
- Lançar: Gasto/Receita (lembra o último), valor no teclado, data, toque na categoria salva; Descrição, parcelas e conta; na edição, Salvar, Duplicar para hoje e Excluir.
- Mais opções de Finanças: Parcelas e dívidas (registrar parcela ou pagamento), Fixos e tetos, e as telas do Granaê no site (`granae.html#ia`, `#transacoes`...).

### Diferenças em relação ao iPhone

- Toque longo no dia vira folha com as duas ações (no iPhone é o menu de contexto); no computador, o botão direito também abre.
- Categorias do lançamento quebram em linhas com rolagem vertical (no iPhone, duas linhas com rolagem lateral): nada rola de lado.
- Plantões no ano: o gráfico é só visual e o detalhe de cada mês vem na lista "Por mês" (no iPhone, toque na barra). Assim nenhum alvo fica abaixo de 44 px.
- Botão de voltar das telas internas diz "Voltar"; Desfazer, avisos e números sem animação de contagem; sem vibração.
- As páginas abrem quando a seção é aberta (no iPhone, as duas abrem juntas): o Granaê é pesado e só carrega quando Finanças é aberta.
- Sem cópia em disco para ver sem internet (ver acima).
