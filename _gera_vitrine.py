#!/usr/bin/env python3
"""Monta as páginas da vitrine (index.html, medtech-app.html, medtech-provas.html,
institucional.html e uma página por produto institucional) a partir de:

  _vitrine/header.html   cabeçalho + barra de produtos (compartilhados)
  _vitrine/footer.html   rodapé (compartilhado)
  _vitrine/paginas/*.html  o conteúdo de cada página; a 1ª linha é o meta:
      <!-- meta title="..." description="..." linha="app|provas|institucional|" [home] -->

Estilo e comportamento ficam em vitrine.css e vitrine.js (compartilhados por todas).
NUNCA edite os *.html gerados na raiz: edite a parte em _vitrine/ e rode
    python3 _gera_vitrine.py
O gerador confere que todo link local aponta para arquivo existente e que todo
ícone usado tem regra no subconjunto da fonte (vitrine.css).
"""
import io, os, re, sys, glob

RAIZ = os.path.dirname(os.path.abspath(__file__))
V = '5'   # versão de vitrine.css / vitrine.js (bumpar ao mudar qualquer um dos dois)

def ler(p): return io.open(os.path.join(RAIZ, p), encoding='utf-8').read()

header = ler('_vitrine/header.html'); footer = ler('_vitrine/footer.html')
css = ler('vitrine.css')
icones_ok = set(re.findall(r'\.ti-([a-z0-9-]+):before', css))

MOLDE = '''<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<meta name="description" content="{description}">
<meta name="theme-color" content="#000000">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="preload" href="fonts/ti-vitrine.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="vitrine.css?v={v}">
<link rel="icon" type="image/png" href="favicon.png">
</head>
<body{attrs}>

{header}
<main>
{conteudo}
</main>

{footer}
<script src="vitrine.js?v={v}"></script>
</body>
</html>
'''

erros = []
gerados = []
# projetos publicados como "project pages" de OUTROS repositórios, no mesmo domínio: não existem aqui
EXTERNOS = {'clinicamed/', 'trafego-titulo/', 'casos-clinicos/', 'clinicar/'}
htmls = {}
for parte in sorted(glob.glob(os.path.join(RAIZ, '_vitrine/paginas/*.html'))):
    nome = os.path.basename(parte)
    src = ler(os.path.relpath(parte, RAIZ))
    m = re.match(r'<!-- meta (.*?) -->\n', src, re.S)
    if not m: erros.append(f'{nome}: sem linha <!-- meta ... -->'); continue
    meta = dict(re.findall(r'(\w+)="([^"]*)"', m.group(1)))
    home = ' home' in m.group(1)
    conteudo = src[m.end():].rstrip('\n')
    attrs = ''
    if meta.get('linha'): attrs += f' data-linha="{meta["linha"]}"'
    if home: attrs += ' data-home'
    html = MOLDE.format(title=meta['title'], description=meta['description'], v=V, attrs=attrs,
                        header=header.rstrip('\n'), conteudo=conteudo, footer=footer.rstrip('\n'))
    io.open(os.path.join(RAIZ, nome), 'w', encoding='utf-8').write(html)
    gerados.append(nome); htmls[nome] = html

# conferência depois de gerar tudo: links locais precisam existir; ícones precisam estar no subconjunto
for nome, html in htmls.items():
    for href in set(re.findall(r'(?:href|src|srcset)="([^"#?]+)', html)):
        for h in re.split(r',\s*', href):
            h = h.split(' ')[0]
            if re.match(r'^(https?:|mailto:|/|data:)', h) or h in EXTERNOS: continue
            if not os.path.exists(os.path.join(RAIZ, h)): erros.append(f'{nome}: link para arquivo inexistente: {h}')
    for ic in set(re.findall(r'class="ti ti-([a-z0-9-]+)"', html)):
        if ic not in icones_ok: erros.append(f'{nome}: ícone ti-{ic} não está no subconjunto da fonte (vitrine.css)')
for ic in set(re.findall(r"'ti-([a-z0-9-]+)'", ler('vitrine.js'))):
    if ic not in icones_ok: erros.append(f'vitrine.js: ícone ti-{ic} não está no subconjunto da fonte')

print('gerados:', ', '.join(gerados))
if erros:
    print('\n'.join('ERRO ' + e for e in erros)); sys.exit(1)
print('links locais e ícones conferidos: ok')
