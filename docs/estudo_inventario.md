# Plataformas de estudo como apps instaláveis separados — inventário

Levantado em 03/11/2026, a partir do `origin/main` de cada repositório (não da cópia local, que em alguns casos
está atrasada ou tem mudança não commitada). Decisão do Matheus: cada plataforma de estudo vira um app instalável
próprio (ícone, nome e entrada próprios), sem misturar públicos. O portal `provas.html` fica como está até ele decidir.

Todas moram no mesmo domínio, `medtechbr.com.br` (GitHub Pages: o site é o repo de usuário com CNAME e cada app é
um repo de projeto servido em `/<repo>/`). Consequência que pesa em tudo abaixo: **uma origem só**. O
`localStorage`, o IndexedDB e o **Cache Storage** são compartilhados por todos os apps e pelo portal.

## Quadro por plataforma

| App | Público | Fonte | Publicado em | Manifesto (id · start_url · scope) | Ícones | SW próprio (cache) | Instalável sozinho? |
|---|---|---|---|---|---|---|---|
| FlashMed | Medicina (ENARE/ENAMED) | `~/Documents/Claude/flashmed` · MedTechBR/flashmed | /flashmed/ | `/flashmed/` · `./index.html?fonte=pwa` · `./` | 180/192/512 + maskable, quadrados cheios | `/flashmed/sw.js` (`fl-v15`, `fl-fontes-v1`, `fl-livros-v1`) | Sim |
| ClínicaMed | Medicina (TECM, R+) | `clinicamed` · MedTechBR/clinicamed | /clinicamed/ | `/clinicamed/` · `./index.html?fonte=pwa` · `./` | idem, cheios | `cm-v185` (+fontes, livros) | Sim |
| CirurgiaMed | Medicina (COTECIG, R+) | `cirurgiamed` · MedTechBR/cirurgiamed | /cirurgiamed/ | `/cirurgiamed/` · `./index.html?fonte=pwa` · `./` | idem, cheios | `cg-v9` (+fontes, livros) | Sim |
| FamíliaMed | Medicina (TEMFC) | `familiamed` · MedTechBR/familiamed | /familiamed/ | `/familiamed/` · `./index.html?fonte=pwa` · `./` | idem, cheios | `fm-v2` (+fontes, livros) | Sim |
| RadioTítulo | Medicina (título CBR) | `radio-titulo` · MedTechBR/radio-titulo-estudio (privado, fonte) → MedTechBR/radio-titulo (público, runtime, via `publica.command`) | /radio-titulo/ | (sem id → `/radio-titulo/`) · `./` · `./` | 192/512 `any maskable` (mesmo PNG), cheios | `rt-v27` | Sim |
| TráfegoTítulo | Medicina (título ABRAMET) | `trafego-titulo` · MedTechBR/trafego-titulo (cópia local 8 commits atrás e com `mtsync.js` modificado) | /trafego-titulo/ | (sem id → `/trafego-titulo/`) · `./` · `./` | 192/512 `any` com **cantos transparentes**; maskable cheio | `tt-v39` (+`tt-fontes-v1`) | Sim |
| Enfermare | Enfermagem (Multi) | `enfermare` · MedTechBR/enfermare | /enfermare/ | `/enfermare/` · `./index.html?fonte=pwa` · `./` | idem forks, cheios | `ef-v17` (+fontes, livros) | Sim |
| Fisiare | Fisioterapia (Multi) | `fisiare` · MedTechBR/fisiare | /fisiare/ | `/fisiare/` · `./index.html?fonte=pwa` · `./` | idem, cheios | `fi-v5` (+fontes, livros) | Sim |
| AprovaFarma | Farmácia (Multi) | `quiz-enare-farmacia` · MedTechBR/quiz-enare-farmacia | /quiz-enare-farmacia/ | (sem id → `/quiz-enare-farmacia/index.html`) · `./index.html` · `./` | 192/512 `any` e **maskable** com cantos arredondados transparentes | `enare-farma-v58` | Sim |
| FarmaUTI | Farmácia (Multi) | `farmauti` · MedTechBR/farmauti | /farmauti/ | `./` → `/farmauti/` · `./` · `./` | 192/512 `any` em **círculo** (cantos transparentes); maskable cheio | `fu-v22` (+`fu-leituras-v1`, `fu-ext-v1`) | Sim |
| SOS Farmácia Comercial | Farmácia (Multi) | `sos-farmacia` · MedTechBR/sos-farmacia (`fonte/casca.html` → `monta.py` → `SOS-Farmacia-Comercial.html` = `index.html`) | /sos-farmacia/ (+ /sos-farmacia/gestao/) | **não tem** | **não tem** | **não tem** (de propósito, CLAUDE.md: "sem service worker") | **Não** |
| SOS Farmacologia | Farmácia (Multi) | `sos-farmacologia` · MedTechBR/sos-farmacologia (mesmo esquema) | /sos-farmacologia/ | **não tem** | **não tem** | **não tem** | **Não** |

Fora do escopo, mas na mesma origem: CapiFala (`/capifala/`, inglês, uso exclusivo; SW rede-primeiro que não
apaga caches alheios), Celeris (`/celeris/`, no repo do site), MedProvas (`medprovas.html`, saindo do catálogo),
`flashmed.html` (só redireciona para `/flashmed/`; o `flashmed.webmanifest` antigo, escopo `/`, não é mais ligado
por página nenhuma, mas quem instalou o FlashMed antigo continua com um app de escopo `/`).

## "Adicionar à tela de início" abre o app certo?

- Os 10 apps com manifesto: sim. `start_url` dentro do próprio `scope`, `scope` = a pasta do app; `apple-touch-icon`
  e `apple-mobile-web-app-*` presentes (o RadioTítulo não tem as metas `apple-mobile-web-app-*`; o iPhone ainda
  abre em tela cheia pelo manifesto, mas o título sob o ícone vem do `<title>`).
- SOS Farmácia e SOS Farmacologia: não. Sem manifesto, o Chrome cria atalho para o navegador e o iPhone usa o
  título da página e uma captura de tela como ícone.
- Portais: `manifest.webmanifest` (MedTech App, id `/app.html`) e `provas.webmanifest` (MedTech Provas, id
  `/provas.html`) têm **escopo `/`**: o domínio inteiro, incluindo as pastas de todos os apps. Um app instalado com
  escopo mais específico (`/clinicamed/`) vence na hora de abrir link; quem só tem o portal instalado abre os apps
  dentro da janela do portal. Fica como está (decisão pendente sobre o portal).

## Service workers: onde há conflito

1. **Todos os SWs apagam os caches dos outros.** O Cache Storage é um só para a origem, e o `activate` de cada SW
   faz `caches.keys()` → apaga tudo que não for dele: o `/sw.js` do portal (`medtech-v810`), o do Celeris
   (`celeris-v6`) e os dos 10 apps. Efeito: cada atualização de qualquer app (ou do portal) zera o cache offline
   dos outros, inclusive as **leituras baixadas para estudar sem internet** (`*-livros-v1`, `fu-leituras-v1`) e
   as fontes. Só o CapiFala e o console do painel limpam apenas o próprio prefixo.
2. **O `/sw.js` do portal (escopo `/`) captura as pastas dos apps.** Ele controla qualquer página do domínio que não
   tenha SW mais específico: SOS Farmácia e SOS Farmacologia sempre, e qualquer app na primeira visita (antes de o SW
   dele registrar). Nessas páginas ele guarda tudo no cache do portal e, **sem internet, responde com `/app.html`**
   (o portal do médico) — numa página de Farmácia, isso é cruzar público.
3. Os SWs dos apps não capturam outro app: cada um registra `sw.js` relativo à própria pasta e só trata a própria
   origem.

## Links para outro público ou para o ecossistema

| Onde | O quê | Público de destino |
|---|---|---|
| `nuvem.js` dos 6 forks (FlashMed, ClínicaMed, CirurgiaMed, FamíliaMed, Enfermare, Fisiare), painel "Conta" | botão "MedTech Provas" → `/provas.html` | portal Provas, que lista apps de Medicina **e** de Enfermagem, Fisioterapia e Farmácia (o filtro `soMulti` só age para quem já comprou só da Multi) |
| `_mtacesso.js` (site), tela de assinatura sem "Fechar" | selo "MedTech Provas" e link "Voltar ao portal" → `/provas.html` para **todos** os apps da linha provas, inclusive os da Multi | idem |
| `_mtvoltar.js` (site), em todos os apps | tocar no ícone do topo volta ao portal **só se o app foi aberto pelo portal** (marca `mt.voltar`); aberto direto ou instalado, nada aparece | neutro (volta de onde veio) |
| `#btLinha` dos 6 forks ("MedTech Provas: outras plataformas de estudo") | escondido por CSS (`display:none!important`) e por JS | não aparece |
| Retorno do Mercado Pago (Pix/anual/boleto) | o backend (`voltaDe`/`voltaProvas` em `mercadopago.js`) devolve ao portal `provas.html` | portal Provas (fora do app instalado) |

Nenhum app usa o trocador do ecossistema (`MT.openSwitcher`) nem linka produto de outro app. Os links absolutos que
sobram são termos/privacidade/ajuda do site (neutros) e o `_mttokens.css`.

## Login e acesso por produto

Todos exigem conta MedTech (Firebase Auth do `medtech-c658c`) pelo `mtsync.js` (portão síncrono no `<head>`; o
progresso fica na conta, `users/{uid}/apps/<app>/...`). A compra é conferida pelo `/_mtacesso.js` do site
(claims `mt` do token; `planos.json` do site é a fonte de produtos e preços):

| App | id no mtsync (dados) | produto (`planos.json`) | `publico` | onde chama o acesso |
|---|---|---|---|---|
| FlashMed | `flashmed` | `flashmed` | — | `nuvem.js` (`appId`) |
| ClínicaMed | `clinicamed` | `clinicamed` | — | `nuvem.js` |
| CirurgiaMed | `cirurgiamed` | `cirurgiamed` | — | `nuvem.js` |
| FamíliaMed | `familiamed` | `familiamed` | — | `nuvem.js` |
| RadioTítulo | `radio-titulo` | `radiotitulo` | — | `CONTA_CFG.acesso` + `conta-estudo.js` |
| TráfegoTítulo | `trafego-titulo` | `trafegotitulo` | — | `CONTA_CFG.acesso` + `conta-estudo.js` |
| Enfermare | `enfermare` | `enfermare` | enfermagem | `nuvem.js` |
| Fisiare | `fisiare` | `fisiare` | fisioterapia | `nuvem.js` |
| AprovaFarma | `enare-farmacia` | `enarefarmacia` | farmacia | `conta-enare.js` |
| FarmaUTI | `farmauti` | `farmauti` | farmacia | `conta-farmauti.js` |
| SOS Farmácia | `sosfarmacia` (+ `sosgestao`) | `sosfarmacia` | farmacia | `conta-sos.js` (só no site; file:// e localhost ficam livres) |
| SOS Farmacologia | `sosfarmacologia` | `sosfarmacologia` | farmacia | `conta-sosfarmacologia.js` |

Cada produto cobre só o próprio app (nenhum pacote "tudo" na linha provas), então a tela de assinatura de um app
oferece só ele mesmo. Como tudo é a mesma origem, entrar em um app já vale para os outros (sessão do Firebase
compartilhada) — inclusive num app instalado separado. O endereço de nenhum app muda (dados locais e sessões
ficam presos à origem e ao caminho do SW).

## Plano de ajustes (Etapa 2)

Só o necessário para cada um ser um app instalável separado:

1. Site (`/sw.js`): não tratar as pastas dos apps de estudo e apagar só caches `medtech-*`. Celeris: só `celeris-*`.
2. Cada SW de app: apagar só os caches do próprio prefixo (`fl-`, `cm-`, `cg-`, `fm-`, `rt-`, `tt-`, `ef-`, `fi-`,
   `enare-farma-`, `fu-`).
3. SOS Farmácia e SOS Farmacologia: manifesto próprio (escopo da pasta), ícones no padrão dos apps de estudo
   (quadrado cheio, papel claro, glifo na cor da marca, sem moldura), metas do iPhone e SW próprio só de rede
   primeiro, tudo escrito pelo carregador "só no site" para não entrar no arquivo salvo pelo "Salvar arquivo".
4. Enfermare e Fisiare: tirar o botão "MedTech Provas" da Conta. `_mtacesso.js`: nos apps de produto com `publico`
   (Multi), selo "MedTech Multi" e sem "Voltar ao portal".

Não muda: conteúdo, questões, preços, layout, ids de manifesto, endereços, ícones existentes, `provas.html`.

## Resultado (03/11/2026, tudo em branch `pwa-estudo`, commitado, SEM push)

| Repo | Commit | O quê |
|---|---|---|
| MedTechBR/medtechbr.github.io (site) | ver `git log pwa-estudo` | `/sw.js`: ignora as pastas dos apps (`APPS_PROPRIOS`) e apaga só `medtech-*`; `celeris/sw.js`: só `celeris-*`; `_mtacesso.js`: app com `publico` (Multi) mostra selo "MedTech Multi" e não tem "Voltar ao portal"; este inventário |
| cirurgiamed, clinicamed, familiamed, flashmed | b306ea4, e0a8c60, ff13814, 5883061 | `sw.js` limpa só o próprio prefixo |
| radio-titulo-estudio | 2b9b331 | idem (chega ao público pelo `publica.command`) |
| trafego-titulo, quiz-enare-farmacia, farmauti | 141f3e0, beb6c7a, a03c3fe | idem |
| enfermare, fisiare | 9110a67, 00ee8e7 | idem + sem o botão "MedTech Provas" na Conta |
| sos-farmacia, sos-farmacologia | 424e549, dd6554f | manifesto, ícones, metas do iPhone e SW próprios |

Verificação (árvore local com o site na raiz e cada app na sua pasta, `python3 -m http.server`):
- Navegador embutido: manifesto 200, `scope` = pasta do app, `start_url` dentro do escopo, ícones 200 nos 12 apps;
  console só com o erro de registro de SW, que o painel embutido dá em todos os apps (ele não registra SW).
- Chrome headless (CDP, Chrome 156): `Page.getInstallabilityErrors` vazio nos 12 (SOS incluídos); cada app fica
  controlado pelo próprio SW; caches plantados de outros apps sobrevivem à ativação de cada SW e à atualização do
  `/sw.js` do portal; na 1ª visita aos SOS o `/sw.js` do portal não guarda nada da pasta. FarmaUTI só registra SW
  em https (regra dele), por isso não aparece no teste local.
- `node --check` em todo JS alterado (e no script inline dos SOS); `_testa_acesso.js`: 120 mil casos, 0 divergências.

## Publicação (03/11/2026)
Publicado com bump em cada repo (CACHE do sw.js; `bump.py` onde existe; `/_mtacesso.js?v=19` nos 6 apps da Multi).
No reteste antes de publicar apareceu um defeito antigo do `/sw.js`: com a rede falhando, ele respondia com o
`app.html` a QUALQUER pedido, então um script da raiz (`/_mtacesso.js`) chegava como HTML ao app de estudo na
1ª visita (SyntaxError, app quebrado). Agora o `app.html` só é reserva de navegação. `/sw.js` em `medtech-v811`.

## Decisões do Matheus aplicadas (03/11/2026, noite)
1. Botão "MedTech Provas" fora também do ClínicaMed, CirurgiaMed, FamíliaMed e FlashMed.
2. Ícones do TráfegoTítulo, FarmaUTI e AprovaFarma em quadrado cheio, mesmo desenho (inclusive o maskable do
   AprovaFarma e o ícone do iPhone), URLs com `?v=2`.
3. `provas.html` deixa de ser app instalável: o `_gera_provas.py` tira manifesto, metas de app do iPhone e registro
   do SW, e troca o cartão "Instale o MedTech Provas" por "Cada plataforma é um app" (abrir e instalar pela
   própria plataforma). O `/sw.js` (medtech-v812) tirou `provas.html`/`provas.webmanifest` do shell e não trata mais
   essas URLs. O `app.html` não mudou. `provas.webmanifest` e os ícones do Provas continuam no repo (quem já
   instalou não quebra), mas nenhuma página liga o manifesto.
4. Gestão da farmácia continua dentro do SOS Farmácia, sem manifesto próprio.
