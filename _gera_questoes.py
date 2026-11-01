#!/usr/bin/env python3
"""Gera as páginas abertas de questões comentadas (questoes/), o índice, sitemap.xml e robots.txt (01/11/2026).
Entrada: _vitrine/questoes-lote-*.json, montados a partir do banco do FlashMed sem questões com errata.
Sem letra nas alternativas: o banco reequilibra a posição do gabarito, então a ordem pode diferir do caderno.
Rodar antes de _gera_vitrine.py. Nunca editar questoes/*.html à mão."""
import glob, html, io, json, os, re, unicodedata
RAIZ = os.path.dirname(os.path.abspath(__file__))
SITE = 'https://medtechbr.com.br'
TESTE = 'provas.html?testar=flashmed'
HOJE = '2026-11-01'
def ler(p): return io.open(os.path.join(RAIZ, p), encoding='utf-8').read()
V = re.search(r"^V = '(\d+)'", ler('_gera_vitrine.py'), re.M).group(1)
header = ler('_vitrine/header.html').rstrip('\n'); footer = ler('_vitrine/footer.html').rstrip('\n')
e = lambda s: html.escape(str(s or ''), quote=True)
def slug(s):
    s = unicodedata.normalize('NFD', str(s)).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')
def paragrafos(t): return ''.join(f'<p>{e(p)}</p>' for p in re.split(r'\n+', str(t).strip()) if p.strip())
MOLDE = '''<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<base href="/">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{url}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{url}">
<meta property="og:type" content="article">
<meta name="theme-color" content="#000000">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="preload" href="fonts/ti-vitrine.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="vitrine.css?v={v}">
<link rel="stylesheet" href="questoes.css?v=1">
<link rel="icon" type="image/png" href="favicon.png">{ld}
</head>
<body class="qb" data-linha="provas">

{header}
<main class="qp"><div class="wrap qp-w">
{conteudo}
</div></main>

{footer}
<script src="vitrine.js?v={v}"></script>
<script src="questoes.js?v=1"></script>
<script defer src="_mtpixel.js?v=2"></script>
</body>
</html>
'''
CTA = f'''<aside class="qp-cta">
  <h2>Treine com mais questões assim</h2>
  <p>O FlashMed tem questões reais de USP, ENARE, ENAMED e Revalida, comentadas alternativa por alternativa, com simulado e fila de erros.</p>
  <a class="pill solid lg" href="{TESTE}">Testar 7 dias sem cartão<i class="ti ti-arrow-right" aria-hidden="true"></i></a>
</aside>'''
lote = []
for f in sorted(glob.glob(os.path.join(RAIZ, '_vitrine/questoes-lote-*.json'))): lote += json.load(io.open(f, encoding='utf-8'))
usados = set()
for i, q in enumerate(lote):
    base = f"{q['prova']}" + (f" questao {q['n']}" if q.get('n') else '') + f" {q['tema']}"
    s = slug(base.replace('Acesso Direto', '').replace('2024/2025', '2024-2025'))
    k, n = s, 2
    while k in usados: k = f'{s}-{n}'; n += 1
    usados.add(k); q['slug'] = k
    q['rotulo'] = q['prova'].replace(' Acesso Direto', '') + (f", questão {q['n']}" if q.get('n') else f": {q['tema']}")
os.makedirs(os.path.join(RAIZ, 'questoes'), exist_ok=True)
for velho in glob.glob(os.path.join(RAIZ, 'questoes/*.html')): os.remove(velho)
def grava(nome, title, desc, conteudo, ld=''):
    url = f'{SITE}/questoes/{nome}' if nome != 'index.html' else f'{SITE}/questoes/'
    io.open(os.path.join(RAIZ, 'questoes', nome), 'w', encoding='utf-8').write(MOLDE.format(title=e(title), desc=e(desc), url=url, v=V, ld=ld, header=header, footer=footer, conteudo=conteudo))
    return url
urls = []
por_tema = {}
for q in lote: por_tema.setdefault(q['tema'], []).append(q)
for i, q in enumerate(lote):
    gab = q['gab']
    alts = ''.join(f'<li><button type="button" class="q-alt" data-ok="{1 if j == gab else 0}">{e(a)}</button></li>' for j, a in enumerate(q['alts']))
    por = ''.join(f'<li class="{"ok" if j == gab else ""}"><b>{e(q["alts"][j])}</b><span>{e(q["porAlt"][j])}</span></li>' for j in range(len(q['alts'])))
    ant = lote[i-1] if i and lote[i-1]['prova'] == q['prova'] else None
    prox = lote[i+1] if i+1 < len(lote) and lote[i+1]['prova'] == q['prova'] else None
    nav = ''.join([f'<a href="questoes/{ant["slug"]}.html">Questão anterior</a>' if ant else '<span></span>', f'<a href="questoes/{prox["slug"]}.html">Próxima questão<i class="ti ti-arrow-right" aria-hidden="true"></i></a>' if prox else '<span></span>'])
    rel = [x for x in por_tema[q['tema']] if x is not q][:3]
    rel_html = (f'<section class="qp-rel"><h2>Mais questões de {e(q["tema"])}</h2><ul>' + ''.join(f'<li><a href="questoes/{x["slug"]}.html">{e(x["rotulo"])}</a></li>' for x in rel) + '</ul></section>') if rel else ''
    conteudo = f'''<nav class="qp-cam" aria-label="Caminho"><a href="questoes/">Questões comentadas</a><span>/</span><span>{e(q['grande'])}</span></nav>
<article class="qp-q">
  <p class="qp-tag">{e(q['grande'])} · {e(q['tema'])}</p>
  <h1>{e(q['rotulo'])}</h1>
  <div class="qp-enun">{paragrafos(q['q'])}</div>
  <ol class="q-alts" aria-label="Alternativas">{alts}</ol>
  <p class="q-res" role="status" aria-live="polite"></p>
  <details class="q-det">
    <summary>Ver gabarito e comentário</summary>
    <p class="q-gab"><b>Resposta correta:</b> {e(q['alts'][gab])}</p>
    <div class="q-com">{paragrafos(q['coment'])}</div>
    <h2>Por que cada alternativa está certa ou errada</h2>
    <ul class="q-por">{por}</ul>
    {f'<p class="q-base"><b>Base:</b> {e(q["base"])}</p>' if q.get('base') else ''}
  </details>
  <p class="qp-nota">Questão da prova oficial {e(q['prova'])} ({e(q['banca'])}). Comentário da MedTech. As alternativas podem estar em ordem diferente da do caderno. Material de estudo: confira sempre a diretriz vigente.</p>
</article>
<nav class="qp-nav" aria-label="Outras questões">{nav}</nav>
{CTA}
{rel_html}'''
    ld = {"@context": "https://schema.org", "@type": "Quiz", "about": {"@type": "Thing", "name": q['tema']}, "educationalLevel": "Residência médica",
          "hasPart": [{"@type": "Question", "eduQuestionType": "Multiple choice", "learningResourceType": "Practice problem", "name": q['rotulo'], "text": q['q'],
                       "suggestedAnswer": [{"@type": "Answer", "position": j, "text": a} for j, a in enumerate(q['alts']) if j != gab],
                       "acceptedAnswer": {"@type": "Answer", "position": gab, "text": q['alts'][gab], "answerExplanation": {"@type": "Comment", "text": q['coment']}}}]}
    ldh = '\n<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False).replace('</', '<\\/') + '</script>'
    enun = re.sub(r'\s+', ' ', q['q'])[:110].rstrip()
    urls.append(grava(q['slug'] + '.html', f"{q['rotulo']}: {q['tema']} comentada | MedTech" if q.get('n') else f"{q['rotulo']}, questão comentada | MedTech",
                      f"Gabarito e comentário de cada alternativa. {enun}...", conteudo, ldh))
# índice
provas = {}
for q in lote: provas.setdefault(q['prova'], {}).setdefault(q['grande'], []).append(q)
blocos = ''
for p, gr in provas.items():
    blocos += f'<section class="qp-bloco"><h2>{e(p.replace(" Acesso Direto", ""))}</h2>'
    for g, l in sorted(gr.items()):
        blocos += f'<h3>{e(g)}</h3><ul>' + ''.join(f'<li><a href="questoes/{x["slug"]}.html">{("Questão " + str(x["n"]) + ": ") if x.get("n") else ""}{e(x["tema"])}</a></li>' for x in l) + '</ul>'
    blocos += '</section>'
urls.insert(0, grava('index.html', 'Questões de residência comentadas: ENAMED e ENARE | MedTech', 'Questões reais do ENAMED e do ENARE para responder online, com gabarito e comentário de cada alternativa. Abertas, sem cadastro.',
    f'<div class="qp-cab"><h1>Questões de residência comentadas</h1><p>Questões reais de prova para responder aqui, sem cadastro, com o gabarito e o comentário de cada alternativa.</p></div>\n{CTA}\n{blocos}'))
# sitemap e robots
paginas = []
for f in sorted(glob.glob(os.path.join(RAIZ, '_vitrine/paginas/*.html'))):
    if not re.match(r'<!-- meta [^\n]*?(?<![\w"=])noindex', ler(os.path.relpath(f, RAIZ))): paginas.append(SITE + '/' + ('' if os.path.basename(f) == 'index.html' else os.path.basename(f)))
todas = paginas + urls
io.open(os.path.join(RAIZ, 'sitemap.xml'), 'w', encoding='utf-8').write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(f'<url><loc>{u}</loc><lastmod>{HOJE}</lastmod></url>\n' for u in todas) + '</urlset>\n')
io.open(os.path.join(RAIZ, 'robots.txt'), 'w', encoding='utf-8').write(f'User-agent: *\nAllow: /\nSitemap: {SITE}/sitemap.xml\n')
print(len(urls) - 1, 'questões,', len(todas), 'endereços no sitemap')
