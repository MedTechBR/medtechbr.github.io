#!/usr/bin/env python3
"""Gera provas.html a partir de app.html.

Os dois portais (MedTech App e MedTech Provas) são o MESMO launcher com outra linha de
produto: catálogo, perfis, padrão e chave de seleção mudam com a constante LINHA. Editar
sempre o app.html e rodar este script; provas.html não se edita à mão.
"""
import pathlib
t = pathlib.Path('app.html').read_text()
trocas = [
  ("const LINHA = 'clinica';", "const LINHA = 'provas';"),
  ("<title>MedTech App — seus apps médicos</title>", "<title>MedTech Provas — estude pelo edital</title>"),
  ('<meta name="description" content="MedTech App: os apps do médico assistencial em um só lugar, com uma conta.">',
   '<meta name="description" content="MedTech Provas: plataformas de estudo para prova de título, residência e R+, construídas em cima do edital.">'),
  # 03/11/2026 (decisão do Matheus): o MedTech Provas deixa de ser app instalável. Cada plataforma de estudo
  # é um app próprio (manifesto e SW na sua pasta); esta página só mostra as plataformas e abre cada uma.
  # Sem manifesto, sem metas de app do iPhone, sem service worker e sem cartão "Instale o MedTech Provas".
  ('<link rel="manifest" href="manifest.webmanifest">\n', ''),
  ('<meta name="apple-mobile-web-app-capable" content="yes">\n', ''),
  ('<meta name="apple-mobile-web-app-status-bar-style" content="default">\n', ''),
  ('<meta name="apple-mobile-web-app-title" content="MedTech App">\n', ''),
  ("if ('serviceWorker' in navigator) {\n  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(()=>{}));\n}\n",
   "/* sem service worker: o MedTech Provas não é app instalável (cada plataforma tem o seu) */\n"),
  ("function htmlInstalar(onde){\n  if (instalado() || lsLer('mt.instalar.dispensado')) return '';\n",
   "function htmlInstalar(onde){\n"
   "  /* MedTech Provas: em vez de instalar o portal, cada plataforma se instala pela própria página */\n"
   "  if (onde !== 'portal') return '';\n"
   "  return `<section class=\"inst\" aria-labelledby=\"inst-t-portal\"><div class=\"inst-h\"><span class=\"inst-ic\" aria-hidden=\"true\"><i class=\"ti ti-device-mobile-down\"></i></span><h4 id=\"inst-t-portal\">Cada plataforma é um app</h4></div><p>Abra a sua plataforma e instale por ela: no celular, ela ganha ícone e entrada próprios na tela inicial.</p></section>`;\n"),
  ('window.MT_APP={id:"portal",name:"MedTech App",linha:"clinica"};', 'window.MT_APP={id:"portal-provas",name:"MedTech Provas",linha:"provas"};'),
  ('<span>MedTech <b>App</b></span>', '<span>MedTech <b>Provas</b></span>'),
  # tema vivo: o portal Provas tem a própria cor (laranja) em _mtviva.css
  ('<html lang="pt-BR" data-viva="portal"', '<html lang="pt-BR" data-viva="portal-provas"'),
  ('<link rel="apple-touch-icon" href="icone-180.png">', '<link rel="apple-touch-icon" href="icone-provas-180.png">'),
]
for a, b in trocas:
    assert a in t, 'âncora não encontrada: ' + a[:60]
    t = t.replace(a, b, 1)
pathlib.Path('provas.html').write_text(t)
print('provas.html gerado')
