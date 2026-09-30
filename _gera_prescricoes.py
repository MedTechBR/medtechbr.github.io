#!/usr/bin/env python3
"""Gera condutai-prescricoes.js (window.PRESC_MODELOS) a partir de _prescricoes/<id>.json.
Confere o formato de cada modelo, que o id existe no banco de condutas e que cada item tem os campos que a
conferência de segurança usa. Não editar condutai-prescricoes.js à mão: editar o JSON e rodar
    python3 _gera_prescricoes.py
"""
import json, re, sys, pathlib
RAIZ = pathlib.Path(__file__).parent
ids_banco = set(re.findall(r"^  \{ id: '([a-z_0-9]+)'", (RAIZ / 'condutai.html').read_text(encoding='utf8'), re.M))
CAMPOS = {'farmaco': str, 'apresentacao': str, 'posologia': str, 'duracao': str, 'diluicao': str, 'via': str, 'dose_unidade': str,
          'continuo': bool, 'dose_unica': bool, 'se_necessario': bool, 'obs': str}
VIAS = {'VO', 'EV', 'IM', 'SC', 'SL', 'inalatória', 'retal', 'tópica', 'IO', 'intranasal'}
erros, modelos = [], {}
for arq in sorted((RAIZ / '_prescricoes').glob('*.json')):
    try:
        m = json.loads(arq.read_text(encoding='utf8'))
    except Exception as e:
        erros.append(f'{arq.name}: JSON inválido ({e})'); continue
    mid = m.get('id')
    if mid != arq.stem: erros.append(f'{arq.name}: id "{mid}" diferente do nome do arquivo')
    if mid not in ids_banco: erros.append(f'{arq.name}: id "{mid}" não existe no banco de condutas')
    if not m.get('fontes'): erros.append(f'{arq.name}: sem fontes')
    n_itens = 0
    for c in m.get('cenarios', []):
        for k in ('id', 'titulo', 'blocos'):
            if not c.get(k): erros.append(f'{arq.name}: cenário sem "{k}"')
        for b in c.get('blocos', []):
            if b.get('tipo') not in ('orientacao', 'esquema', 'lista'): erros.append(f'{arq.name}/{c.get("id")}: bloco com tipo "{b.get("tipo")}"')
            if b.get('tipo') == 'orientacao':
                if not b.get('itens'): erros.append(f'{arq.name}/{c.get("id")}: orientação vazia')
                continue
            for p in b.get('partes', []):
                for it in p.get('opcoes', []):
                    n_itens += 1
                    ref = f'{arq.name}/{c.get("id")}/{it.get("farmaco")}'
                    for k, t in CAMPOS.items():
                        if not isinstance(it.get(k), t): erros.append(f'{ref}: campo "{k}" ausente ou de tipo errado')
                    if it.get('via') not in VIAS: erros.append(f'{ref}: via "{it.get("via")}" fora da lista')
                    if it.get('dose_valor') is not None and not isinstance(it.get('dose_valor'), (int, float)): erros.append(f'{ref}: dose_valor não numérico')
                    if it.get('intervalo_horas') is not None and not isinstance(it.get('intervalo_horas'), (int, float)): erros.append(f'{ref}: intervalo_horas não numérico')
                    if not it.get('posologia', '').strip(): erros.append(f'{ref}: sem posologia')
    if n_itens == 0: erros.append(f'{arq.name}: nenhum item de prescrição')
    modelos[mid] = m
if erros:
    print('\n'.join(erros)); sys.exit(1)
js = ('/* GERADO por _gera_prescricoes.py a partir de _prescricoes/*.json — não editar à mão.\n'
      '   Modelos de prescrição por conduta, por cenário (aba Prescrição da conduta). */\n'
      'window.PRESC_MODELOS = ' + json.dumps(modelos, ensure_ascii=False, separators=(',', ':')) + ';\n')
(RAIZ / 'condutai-prescricoes.js').write_text(js, encoding='utf8')
print(f'{len(modelos)} modelos gravados em condutai-prescricoes.js ({len(js)//1024} KB)')
