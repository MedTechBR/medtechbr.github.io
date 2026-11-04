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

- Ferramentas, Plantões, Finanças e as sessões de acompanhamento são pontos de encaixe (outras frentes).
- Diagrama do fluxograma: desenhado pelo mermaid do site (com `sanitizeMermaid`, que troca `≤` por "menor ou igual a"), não pelo desenho nativo.
- Tópicos trocam por toque ou deslizando a página (scroll-snap); sem vibração; ícones Tabler no lugar dos SF Symbols.
- Prescrição com IA (doenças sem modelo) leva ao CondutAI; no iPhone ela roda dentro do app.
- Exames mostra o LaudAI no modo Achados dentro de um quadro, não a tela nativa `AchadosView`.
