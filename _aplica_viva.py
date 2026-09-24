#!/usr/bin/env python3
"""Troca o tema de um app do Astra (preto) para o tema vivo (_mtviva.css).
   uso: python3 _aplica_viva.py condutai granae ...
   - data-astra="x" → data-viva="x"
   - _mtastra.css → _mtviva.css (a folha nova serve a Inter local; sai o Google Fonts)
"""
import re, sys, io
VIVA = '_mtviva.css?v=1'
for app in sys.argv[1:]:
    p = f'{app}.html'; t = io.open(p, encoding='utf-8').read(); t0 = t
    t = re.sub(r'data-astra="([a-z-]+)"', r'data-viva="\1"', t, count=1)
    t = re.sub(r'_mtastra\.css\?v=\d+', VIVA, t)
    # fontes da web: o tema vivo usa a Inter local (/fonts); fontes de "display" da web saem
    t = re.sub(r'[ \t]*<link rel="preconnect" href="https://fonts\.(googleapis|gstatic)\.com"[^>]*>\n', '', t)
    t = re.sub(r'[ \t]*<link[^>]*href="https://fonts\.googleapis\.com/css2[^"]*"[^>]*>\n', '', t)
    if t == t0: print(app, 'SEM MUDANÇA'); continue
    io.open(p, 'w', encoding='utf-8').write(t)
    print(app, 'ok', 'data-viva' in t, VIVA in t, 'fonts.googleapis' not in t)
