#!/usr/bin/env python3
"""Gera provas.html a partir de app.html.

Os dois portais (MedTech Clínica e MedTech Provas) são o MESMO launcher com outra linha de
produto: catálogo, perfis, padrão e chave de seleção mudam com a constante LINHA. Editar
sempre o app.html e rodar este script; provas.html não se edita à mão.
"""
import pathlib
t = pathlib.Path('app.html').read_text()
trocas = [
  ("const LINHA = 'clinica';", "const LINHA = 'provas';"),
  ("<title>MedTech Clínica — seus apps médicos</title>", "<title>MedTech Provas — estude pelo edital</title>"),
  ('<meta name="description" content="MedTech Clínica: os apps do médico assistencial em um só lugar, com uma conta.">',
   '<meta name="description" content="MedTech Provas: plataformas de estudo para prova de título, residência e R+, construídas em cima do edital.">'),
  ('<link rel="manifest" href="manifest.webmanifest">', '<link rel="manifest" href="provas.webmanifest">'),
  ('<meta name="apple-mobile-web-app-title" content="MedTech Clínica">', '<meta name="apple-mobile-web-app-title" content="MedTech Provas">'),
  ('window.MT_APP={id:"portal",name:"MedTech Clínica",linha:"clinica"};', 'window.MT_APP={id:"portal-provas",name:"MedTech Provas",linha:"provas"};'),
  ('<span class="wm">MedTech <b>Clínica</b></span>', '<span class="wm">MedTech <b>Provas</b></span>'),
]
for a, b in trocas:
    assert a in t, 'âncora não encontrada: ' + a[:60]
    t = t.replace(a, b, 1)
pathlib.Path('provas.html').write_text(t)
print('provas.html gerado')
