#!/usr/bin/env python3
"""Testa todos os caminhos entre as páginas do site MedTech.

    python3 _testa_caminhos.py                      # no ar: https://medtechbr.com.br/
    python3 _testa_caminhos.py http://localhost:8914/   # cópia local (servir.py)

Percorre a vitrine (todas as páginas geradas por _gera_vitrine.py), os portais (app.html,
provas.html), termos e privacidade, e confere:
  - todo link, imagem, folha de estilo e script local responde 200 (seguindo redirecionamentos);
  - toda âncora (#algo) existe na página de destino, e as âncoras antigas da home têm destino no
    mapa de redirecionamento do vitrine.js;
  - os links montados por script: vitrine.js (vitrines, mural, galerias, #app=<id>), o catálogo
    do portal (app.html/provas.html) e o trocador de apps do _mtauth.js;
  - e-mails (mailto:) bem formados; links externos respondem (aviso, não erro).
Sai com código 1 se houver caminho quebrado. Os apps em si não são varridos por dentro: só se
confere que abrem.
"""
import re, sys, json, ssl, urllib.request, urllib.parse
from html.parser import HTMLParser

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'https://medtechbr.com.br/').rstrip('/') + '/'
HOST = urllib.parse.urlparse(BASE).netloc
CTX = ssl.create_default_context()
cache = {}
PROJETOS = ('clinicamed/', 'trafego-titulo/', 'casos-clinicos/', 'clinicar/')

def get(url):
    if url in cache: return cache[url]
    req = urllib.request.Request(url, headers={'User-Agent': 'medtech-testa-caminhos/1'})
    try:
        with urllib.request.urlopen(req, timeout=25, context=CTX) as r:
            corpo = r.read() if 'html' in r.headers.get('Content-Type', '') or url.endswith(('.js', '.json')) else b''
            res = (r.status, r.geturl(), corpo.decode('utf-8', 'replace'))
    except urllib.error.HTTPError as e: res = (e.code, url, '')
    except Exception as e: res = (0, url, str(e)[:120])
    cache[url] = res; return res

class Coleta(HTMLParser):
    def __init__(s): super().__init__(); s.links = []; s.ids = set()
    def handle_starttag(s, tag, a):
        a = dict(a)
        if a.get('id'): s.ids.add(a['id'])
        if a.get('name') and tag == 'a': s.ids.add(a['name'])
        for k in ('href', 'src'):
            if a.get(k) and not (tag == 'link' and a.get('rel') in ('preconnect', 'dns-prefetch')): s.links.append((tag, k, a[k]))
        if a.get('srcset'):
            for parte in a['srcset'].split(','):
                if parte.strip(): s.links.append((tag, 'srcset', parte.strip().split(' ')[0]))
        if a.get('data-src'): s.links.append((tag, 'data-src', 'img/vitrine/%s.webp' % a['data-src']))

erros, avisos, testados = [], [], set()
def erro(onde, msg): erros.append(f'{onde}: {msg}')

def ids_de(url):
    st, final, html = get(url)
    p = Coleta(); p.feed(html); return p.ids

def confere(origem, alvo, tipo='link'):
    if alvo.startswith(('javascript:', 'data:', 'tel:')): return
    if alvo.startswith('mailto:'):
        end = urllib.parse.unquote(alvo[7:].split('?')[0])
        if not re.fullmatch(r'[^@\s]+@[^@\s]+\.[a-z]{2,}', end): erro(origem, f'e-mail malformado: {alvo}')
        return
    url = urllib.parse.urljoin(origem, alvo)
    u = urllib.parse.urlparse(url)
    if u.netloc != HOST:
        chave = url.split('#')[0]
        if chave in testados: return
        testados.add(chave); st = get(chave)[0]
        if st not in (200, 301, 302) and 'fonts.googleapis' not in chave: avisos.append(f'{origem}: externo {chave} → {st}')
        return
    sem = url.split('#')[0]; testados.add(url)
    # project pages de OUTROS repositórios (mesmo domínio): numa cópia local, confere no ar
    caminho = urllib.parse.urlparse(sem).path.lstrip('/')
    if HOST != 'medtechbr.com.br' and caminho.startswith(PROJETOS): sem = 'https://medtechbr.com.br/' + caminho
    st, final, _ = get(sem)
    if st != 200: erro(origem, f'{tipo} quebrado ({st}): {alvo}'); return
    if urllib.parse.urlparse(final).netloc not in (HOST, '', 'medtechbr.com.br'): avisos.append(f'{origem}: {alvo} sai do site para {final}')
    frag = u.fragment
    if frag and not frag.startswith('app='):
        if frag not in ids_de(sem): erro(origem, f'âncora inexistente: {alvo}')

# ---------- páginas-semente ----------
home = get(BASE + 'index.html')
if home[0] != 200: print('site fora do ar:', home[0]); sys.exit(1)
paginas = ['index.html']
for m in re.findall(r'href="([a-z0-9-]+\.html)"', home[2]):
    if m not in paginas: paginas.append(m)
for extra in ('app.html', 'provas.html', 'termos.html', 'privacidade.html', 'medtech-app.html', 'medtech-provas.html', 'institucional.html'):
    if extra not in paginas: paginas.append(extra)
# a vitrine inteira: tudo que o cabeçalho e o rodapé citam (as páginas de produto)
vitrine = set()
for p in list(paginas):
    st, _, html = get(BASE + p)
    for m in re.findall(r'href="([a-z0-9-]+\.html)(?:#[^"]*)?"', html):
        if m not in paginas: paginas.append(m)
apps_ids = set()
for p in paginas:
    url = BASE + p; st, final, html = get(url)
    if st != 200: erro('(sementes)', f'{p} → {st}'); continue
    if 'vitrine.js' in html: vitrine.add(p)
    # apps: só confere que abrem; não varre por dentro
    if p not in vitrine and p not in ('app.html', 'provas.html', 'termos.html', 'privacidade.html'): continue
    c = Coleta(); c.feed(html)
    for tag, k, alvo in c.links: confere(url, alvo, f'{tag}[{k}]')

# ---------- links montados pelo vitrine.js ----------
js = get(BASE + 'vitrine.js')[2]
for u in set(re.findall(r"url:'([^']+)'", js)): confere(BASE + 'medtech-app.html', u, 'vitrine.js url')
for n in set(re.findall(r"img:'([a-z0-9-]+)'", js)):
    confere(BASE + 'index.html', f'img/vitrine/{n}.webp', 'vitrine.js img'); confere(BASE + 'index.html', f'img/vitrine/{n}-500.webp', 'vitrine.js img')
for arr in re.findall(r"(?:desk|ph):\[([^\]]*)\]", js):
    for n in re.findall(r"'([a-z0-9-]+)'", arr):
        confere(BASE + 'index.html', f'img/vitrine/{n}.webp', 'palco'); confere(BASE + 'index.html', f'img/vitrine/{n}{"-500" if n.endswith("-390") else "-800"}.webp', 'palco')
ids_app = set(re.findall(r"\{id:'([a-z0-9-]+)',nm:", js))
for pag in ('medtech-app.html', 'medtech-provas.html'):
    for alvo in re.findall(r"'(%s#app=)'\+a\.id" % re.escape(pag), js): pass
if not ids_app: erro('vitrine.js', 'não achei os ids das vitrines (APPS/PROVAS)')
# âncoras antigas da home → mapa R
mapa = re.search(r"const R=\{([^}]*)\}", js)
if mapa:
    for k, v in re.findall(r"(\w+):'([^']+)'", mapa.group(1)): confere(BASE + 'index.html#' + k, v, f'redirecionamento #{k}')
else: erro('vitrine.js', 'mapa de âncoras antigas (R) não encontrado')
# planos.json (lido pela calculadora de planos)
st, _, pj = get(BASE + 'planos.json')
if st != 200: erro('planos.json', f'→ {st}')
else:
    try:
        P = json.loads(pj)
        for pr in P.get('produtos', []):
            for per, url in (pr.get('checkout') or {}).items():
                if url and not url.startswith('https://'): erro('planos.json', f'{pr["id"]}.{per}: checkout sem https')
    except Exception as e: erro('planos.json', f'JSON inválido: {e}')

# ---------- catálogo do portal e trocador de apps ----------
for portal in ('app.html', 'provas.html'):
    html = get(BASE + portal)[2]
    for u in set(re.findall(r"url:\s*BASE\s*\+\s*'([^']+)'", html)): confere(BASE + portal, u, 'catálogo do portal')
    for u in set(re.findall(r"url:\s*'(/[^']+)'", html)): confere(BASE + portal, u, 'catálogo do portal')
auth = get(BASE + '_mtauth.js')[2]
for u in set(re.findall(r"url:'(/[^']+)'", auth)): confere(BASE + '_mtauth.js', u, 'trocador de apps')

print(f'Base: {BASE}')
print(f'Páginas varridas: {len([p for p in paginas if p in vitrine or p in ("app.html","provas.html","termos.html","privacidade.html")])} · endereços conferidos: {len(testados)}')
for a in avisos: print('AVISO', a)
if erros:
    print('\n'.join('ERRO ' + e for e in erros)); print(f'{len(erros)} caminho(s) quebrado(s).'); sys.exit(1)
print('Todos os caminhos funcionam.')
