/* Testes da conferência de segurança da prescrição do CondutAI (condutai-seguranca.js).
   Rodar: node _testa_seguranca.js   — sai com código 1 se algum caso falhar. Dados fictícios. */
const S = require('./condutai-seguranca.js');
let ok = 0, falhas = 0;
const P0 = { idade: 45, sexo: 'M', peso: 80, tfg: 95, alergias: 'nega', hepatica: 'normal' };
const it = (farmaco, o = {}) => Object.assign({ farmaco, dose_valor: 1, dose_unidade: 'g', via: 'EV', intervalo_horas: 24, duracao: '7 dias', diluicao: 'SF 100 mL em 30 min' }, o);
function caso(nome, itens, pac, emUso, espera) {
  const r = S.conferir(itens, Object.assign({}, P0, pac), emUso || '');
  const todos = [...r.itens.flatMap(x => x.alertas.map(a => ({ ...a, i: x.i }))), ...r.conjunto.map(a => ({ ...a, i: 'conj' }))];
  const erros = [];
  for (const e of espera) {
    const achou = todos.some(a => (e.i === undefined || a.i === e.i) && (!e.nivel || a.nivel === e.nivel) && (!e.tipo || a.tipo === e.tipo) && (!e.re || e.re.test(a.msg)));
    if (e.nao ? achou : !achou) erros.push((e.nao ? 'NÃO devia ter ' : 'faltou ') + JSON.stringify({ ...e, re: String(e.re || '') }));
  }
  if (erros.length) { falhas++; console.log('FALHOU', nome, '\n  ', erros.join('\n   '), '\n   alertas:', todos.map(a => a.i + ':' + a.nivel + ':' + a.tipo + ':' + a.msg.slice(0, 70)).join('\n            ')); }
  else ok++;
}
// alergias
caso('penicilina x amoxicilina', [it('Amoxicilina', { dose_unidade: 'mg', dose_valor: 500, via: 'VO', intervalo_horas: 8 })], { alergias: 'penicilina (urticária)' }, '', [{ nivel: 'grave', tipo: 'alergia' }]);
caso('penicilina x ceftriaxona', [it('Ceftriaxona')], { alergias: 'penicilina' }, '', [{ nivel: 'atencao', tipo: 'alergia' }, { nivel: 'grave', tipo: 'alergia', nao: true }]);
caso('penicilina x cefalexina', [it('Cefalexina', { dose_unidade: 'mg', dose_valor: 500, via: 'VO', intervalo_horas: 6 })], { alergias: 'amoxicilina' }, '', [{ nivel: 'grave', tipo: 'alergia', re: /cadeia lateral/ }]);
caso('penicilina anafilaxia x ceftriaxona', [it('Ceftriaxona')], { alergias: 'penicilina - anafilaxia' }, '', [{ nivel: 'grave', tipo: 'alergia' }]);
caso('nega x amoxicilina', [it('Amoxicilina', { dose_unidade: 'mg', dose_valor: 500, via: 'VO', intervalo_horas: 8 })], { alergias: 'nega alergias' }, '', [{ tipo: 'alergia', nao: true }]);
caso('betalactâmico x meropenem', [it('Meropenem', { intervalo_horas: 8 })], { alergias: 'betalactâmicos' }, '', [{ nivel: 'grave', tipo: 'alergia' }]);
caso('sulfa x bactrim', [it('Sulfametoxazol + trimetoprima', { dose_valor: 800, dose_unidade: 'mg', via: 'VO', intervalo_horas: 12 })], { alergias: 'sulfa' }, '', [{ nivel: 'grave', tipo: 'alergia' }]);
caso('AINE x cetoprofeno', [it('Cetoprofeno', { dose_valor: 100, dose_unidade: 'mg', intervalo_horas: 12 })], { alergias: 'AAS' }, '', [{ nivel: 'grave', tipo: 'alergia' }]);
caso('dipirona x dipirona', [it('Dipirona', { dose_valor: 1, intervalo_horas: 6 })], { alergias: 'dipirona' }, '', [{ nivel: 'grave', tipo: 'alergia' }]);
caso('alergia livre x fármaco', [it('Clindamicina', { dose_valor: 600, dose_unidade: 'mg', intervalo_horas: 8 })], { alergias: 'clindamicina' }, '', [{ nivel: 'grave', tipo: 'alergia' }]);
caso('HIT x enoxaparina', [it('Enoxaparina', { dose_valor: 40, dose_unidade: 'mg', via: 'SC', intervalo_horas: 24 })], { alergias: 'trombocitopenia induzida por heparina' }, '', [{ nivel: 'grave', tipo: 'alergia' }]);
// tetos de dose
caso('paracetamol 1 g 6/6 no limite', [it('Paracetamol', { via: 'VO', intervalo_horas: 6 })], {}, '', [{ nivel: 'info', tipo: 'dose', re: /limite/ }, { nivel: 'grave', tipo: 'dose', nao: true }]);
caso('paracetamol 1 g 4/4 acima', [it('Paracetamol', { via: 'VO', intervalo_horas: 4 })], {}, '', [{ nivel: 'grave', tipo: 'dose', re: /teto/ }]);
caso('paracetamol hepatopata', [it('Paracetamol', { via: 'VO', intervalo_horas: 6 })], { hepatica: 'B' }, '', [{ nivel: 'atencao', tipo: 'dose', re: /cirrose/ }]);
caso('paracetamol erro de unidade', [it('Paracetamol', { dose_valor: 750, dose_unidade: 'g', via: 'VO', intervalo_horas: 6 })], {}, '', [{ nivel: 'grave', tipo: 'dose', re: /unidade/ }]);
caso('dipirona 2 g 6/6', [it('Dipirona', { dose_valor: 2, intervalo_horas: 6 })], {}, '', [{ nivel: 'grave', tipo: 'dose' }]);
caso('ondansetrona 24 mg EV', [it('Ondansetrona', { dose_valor: 24, dose_unidade: 'mg', intervalo_horas: 24 })], {}, '', [{ nivel: 'grave', tipo: 'dose', re: /por dose/ }]);
caso('ondansetrona 8 mg EV ok', [it('Ondansetrona', { dose_valor: 8, dose_unidade: 'mg', intervalo_horas: 8 })], {}, '', [{ tipo: 'dose', nivel: 'grave', nao: true }]);
caso('tramadol 100 6/6 aos 80 anos', [it('Tramadol', { dose_valor: 100, dose_unidade: 'mg', intervalo_horas: 6 })], { idade: 80 }, '', [{ nivel: 'grave', tipo: 'dose', re: /75 anos/ }]);
caso('tramadol 50 6/6 TFG 20', [it('Tramadol', { dose_valor: 100, dose_unidade: 'mg', intervalo_horas: 12 })], { tfg: 20 }, '', [{ nivel: 'info', tipo: 'dose', re: /limite/ }]);
caso('metoclopramida 10 mg 8/8 com 50 kg', [it('Metoclopramida', { dose_valor: 10, dose_unidade: 'mg', intervalo_horas: 8 })], { peso: 50 }, '', [{ nivel: 'atencao', tipo: 'dose', re: /25 mg/ }, { re: /fora da base/, nao: true }]);
caso('SOS dipirona', [it('Dipirona', { dose_valor: 1, via: 'VO', intervalo_horas: 6, se_necessario: true })], {}, '', [{ nivel: 'info', re: /todos os horários/ }]);
// conta por peso
caso('vanco dose acima do peso', [it('Vancomicina', { dose_valor: 3000, dose_unidade: 'mg', intervalo_horas: 12, dose_por_kg: { valor: 25, unidade: 'mg/kg' }, ajuste_renal_aplicado: true })], {}, '', [{ nivel: 'grave', tipo: 'dose', re: /conta por peso/ }]);
caso('vanco dose certa', [it('Vancomicina', { dose_valor: 2000, dose_unidade: 'mg', intervalo_horas: 12, dose_por_kg: { valor: 25, unidade: 'mg/kg' } })], {}, '', [{ tipo: 'dose', nivel: 'grave', nao: true }]);
caso('dose por kg sem peso', [it('Vancomicina', { dose_valor: 2000, dose_unidade: 'mg', intervalo_horas: 12, dose_por_kg: { valor: 25, unidade: 'mg/kg' } })], { peso: null }, '', [{ nivel: 'grave', tipo: 'dados' }]);
caso('mg/kg convertida', [it('Gentamicina', { dose_valor: 5, dose_unidade: 'mg/kg', intervalo_horas: 24 })], {}, '', [{ tipo: 'dose', nivel: 'grave', nao: true }]);
// rins
caso('metformina TFG 25', [it('Metformina', { dose_valor: 850, dose_unidade: 'mg', via: 'VO', intervalo_horas: 12 })], { tfg: 25 }, '', [{ nivel: 'grave', tipo: 'renal' }]);
caso('enoxaparina 12/12 TFG 25', [it('Enoxaparina', { dose_valor: 80, dose_unidade: 'mg', via: 'SC', intervalo_horas: 12, ajuste_renal_aplicado: false })], { tfg: 25 }, '', [{ nivel: 'grave', tipo: 'renal', re: /uma vez ao dia/ }]);
caso('cefepima TFG 35 sem ajuste', [it('Cefepima', { dose_valor: 2, intervalo_horas: 8 })], { tfg: 35 }, '', [{ nivel: 'atencao', tipo: 'renal' }]);
caso('cefepima TFG 35 com ajuste', [it('Cefepima', { dose_valor: 2, intervalo_horas: 24, ajuste_renal_aplicado: true })], { tfg: 35 }, '', [{ tipo: 'renal', nao: true }]);
caso('ceftriaxona TFG 20 sem alerta renal', [it('Ceftriaxona')], { tfg: 20 }, '', [{ tipo: 'renal', nao: true }]);
caso('vanco sem creatinina', [it('Vancomicina', { dose_valor: 1, intervalo_horas: 12 })], { tfg: null }, '', [{ tipo: 'dados', re: /creatinina/ }]);
caso('AINE TFG 25', [it('Cetoprofeno', { dose_valor: 100, dose_unidade: 'mg', intervalo_horas: 12 })], { tfg: 25 }, '', [{ nivel: 'grave', tipo: 'renal' }]);
caso('AAS TFG 25 sem alerta de AINE', [it('AAS', { dose_valor: 100, dose_unidade: 'mg', via: 'VO', intervalo_horas: 24 })], { tfg: 25 }, '', [{ tipo: 'renal', nao: true }]);
caso('hemodiálise', [it('Vancomicina', { dose_valor: 1, intervalo_horas: 12 })], { tfg: 8, dialise: 'hemodiálise' }, '', [{ tipo: 'renal', re: /hemodiálise/ }]);
// gestação
caso('gestante enalapril', [it('Enalapril', { dose_valor: 10, dose_unidade: 'mg', via: 'VO', intervalo_horas: 12 })], { sexo: 'F', gestante: true }, '', [{ nivel: 'grave', tipo: 'gestacao' }]);
caso('gestante ceftriaxona sem alerta', [it('Ceftriaxona')], { sexo: 'F', gestante: true }, '', [{ tipo: 'gestacao', nao: true }]);
caso('gestante AAS 100 mg sem alerta', [it('AAS', { dose_valor: 100, dose_unidade: 'mg', via: 'VO' })], { sexo: 'F', gestante: true }, '', [{ tipo: 'gestacao', nao: true }]);
caso('gestante ibuprofeno', [it('Ibuprofeno', { dose_valor: 400, dose_unidade: 'mg', via: 'VO', intervalo_horas: 8 })], { sexo: 'F', gestante: true }, '', [{ nivel: 'atencao', tipo: 'gestacao' }]);
// idoso
caso('idoso prometazina', [it('Prometazina', { dose_valor: 25, dose_unidade: 'mg', via: 'IM' })], { idade: 78 }, '', [{ nivel: 'atencao', tipo: 'idoso' }]);
caso('adulto prometazina sem Beers', [it('Prometazina', { dose_valor: 25, dose_unidade: 'mg', via: 'IM' })], { idade: 40 }, '', [{ tipo: 'idoso', nao: true }]);
// alta vigilância
caso('KCl alta vigilância', [it('Cloreto de potássio 19,1%', { dose_valor: 10, dose_unidade: 'mL', intervalo_horas: 8 })], {}, '', [{ tipo: 'mpp' }]);
caso('noradrenalina EV alta vigilância', [it('Noradrenalina', { dose_valor: 0.1, dose_unidade: 'mcg/kg/min', continuo: true, intervalo_horas: null })], {}, '', [{ tipo: 'mpp' }]);
// conjunto
caso('sinva em uso + claritro', [it('Claritromicina', { dose_valor: 500, dose_unidade: 'mg', via: 'VO', intervalo_horas: 12 })], {}, 'Sinvastatina 40 mg\nLosartana 50 mg', [{ nivel: 'grave', tipo: 'interacao', re: /CYP3A4/ }]);
caso('linezolida + sertralina em uso', [it('Linezolida', { dose_valor: 600, dose_unidade: 'mg', intervalo_horas: 12 })], {}, 'Sertralina 50 mg', [{ nivel: 'grave', re: /serotonin/ }]);
caso('morfina + midazolam', [it('Morfina', { dose_valor: 2, dose_unidade: 'mg', intervalo_horas: 4 }), it('Midazolam', { dose_valor: 2, dose_unidade: 'mg', intervalo_horas: 4 })], {}, '', [{ nivel: 'atencao', re: /depressão respiratória/ }]);
caso('varfarina + metronidazol', [it('Metronidazol', { dose_valor: 500, dose_unidade: 'mg', intervalo_horas: 8 })], {}, 'Varfarina 5 mg', [{ nivel: 'atencao', re: /INR/ }]);
caso('nitrato + sildenafila', [it('Sildenafila', { dose_valor: 50, dose_unidade: 'mg', via: 'VO' })], {}, 'Mononitrato de isossorbida 20 mg', [{ nivel: 'grave', re: /PDE-5/ }]);
caso('meropenem + valproato', [it('Meropenem', { intervalo_horas: 8 })], {}, 'Ácido valproico 500 mg', [{ nivel: 'grave', re: /valproato/ }]);
caso('dois AINEs', [it('Cetoprofeno', { dose_valor: 100, dose_unidade: 'mg', intervalo_horas: 12 }), it('Ibuprofeno', { dose_valor: 400, dose_unidade: 'mg', via: 'VO', intervalo_horas: 8 })], {}, '', [{ nivel: 'atencao', re: /Duplicidade: dois AINEs/ }]);
caso('dipirona + paracetamol não é duplicidade', [it('Dipirona', { intervalo_horas: 6 }), it('Paracetamol', { dose_valor: 750, dose_unidade: 'mg', via: 'VO', intervalo_horas: 6 })], {}, '', [{ re: /Duplicidade/, nao: true }]);
caso('enoxaparina + heparina', [it('Enoxaparina', { dose_valor: 40, dose_unidade: 'mg', via: 'SC' }), it('Heparina não fracionada', { dose_valor: 5000, dose_unidade: 'UI', via: 'SC', intervalo_horas: 8 })], {}, '', [{ nivel: 'grave', re: /dois anticoagulantes/ }]);
caso('omeprazol + clopidogrel em uso', [it('Omeprazol', { dose_valor: 40, dose_unidade: 'mg', via: 'EV' })], {}, 'Clopidogrel 75 mg', [{ re: /pantoprazol/ }]);
caso('QT: ondansetrona + azitro', [it('Ondansetrona', { dose_valor: 4, dose_unidade: 'mg', intervalo_horas: 8 }), it('Azitromicina', { dose_valor: 500, dose_unidade: 'mg' })], {}, '', [{ re: /QT/ }]);
caso('IECA + BRA', [it('Losartana', { dose_valor: 50, dose_unidade: 'mg', via: 'VO' })], {}, 'Enalapril 10 mg 12/12h', [{ nivel: 'grave', re: /duplo bloqueio/ }]);
caso('mesmo fármaco em uso', [it('Losartana', { dose_valor: 50, dose_unidade: 'mg', via: 'VO' })], {}, 'Losartana 50 mg', [{ re: /já está nas medicações/ }]);
caso('hipercalemia TFG 25', [it('Espironolactona', { dose_valor: 25, dose_unidade: 'mg', via: 'VO' })], { tfg: 25 }, 'Enalapril 10 mg', [{ nivel: 'grave', re: /potássio/ }]);
caso('antimicrobiano sem duração', [it('Ceftriaxona', { duracao: '' })], {}, '', [{ nivel: 'atencao', re: /duração/ }]);
caso('fármaco desconhecido', [it('Xyzzimabe', {})], {}, '', [{ nivel: 'info', re: /fora da base/ }]);
// regras conferidas na pesquisa de 24/09/2026
caso('dipirona EV 1 g 6/6 dentro do teto injetável', [it('Dipirona', { dose_valor: 1, intervalo_horas: 6 })], {}, '', [{ tipo: 'dose', nivel: 'grave', nao: true }, { re: /limite/, nao: true }]);
caso('dipirona EV 1,5 g 4/4 acima de 5 g', [it('Dipirona', { dose_valor: 1.5, intervalo_horas: 4 })], {}, '', [{ nivel: 'grave', tipo: 'dose', re: /injetável/ }]);
caso('nimesulida 100 12/12 ok', [it('Nimesulida', { dose_valor: 100, dose_unidade: 'mg', via: 'VO', intervalo_horas: 12 })], {}, '', [{ tipo: 'dose', nao: true }]);
caso('nimesulida 200 12/12 atenção', [it('Nimesulida', { dose_valor: 200, dose_unidade: 'mg', via: 'VO', intervalo_horas: 12 })], {}, '', [{ nivel: 'atencao', tipo: 'dose' }, { nivel: 'grave', tipo: 'dose', nao: true }]);
caso('nimesulida 300 12/12 bloqueio', [it('Nimesulida', { dose_valor: 300, dose_unidade: 'mg', via: 'VO', intervalo_horas: 12 })], {}, '', [{ nivel: 'grave', tipo: 'dose' }]);
caso('cetorolaco SL 10 mg 6/6 adulto ok', [it('Cetorolaco', { dose_valor: 10, dose_unidade: 'mg', via: 'SL', intervalo_horas: 6 })], {}, '', [{ tipo: 'dose', nivel: 'grave', nao: true }]);
caso('cetorolaco SL 20 mg 6/6 acima', [it('Cetorolaco', { dose_valor: 20, dose_unidade: 'mg', via: 'SL', intervalo_horas: 6 })], {}, '', [{ nivel: 'grave', tipo: 'dose', re: /sublingual/ }]);
caso('cetorolaco EV 30 mg 6/6 idoso acima de 60', [it('Cetorolaco', { dose_valor: 30, dose_unidade: 'mg', intervalo_horas: 6 })], { idade: 70 }, '', [{ nivel: 'grave', tipo: 'dose' }, { nivel: 'atencao', tipo: 'idoso', re: /Beers/ }]);
caso('naproxeno sódico 550 8/8 no limite (base)', [it('Naproxeno sódico', { dose_valor: 550, dose_unidade: 'mg', via: 'VO', intervalo_horas: 8 })], {}, '', [{ nivel: 'grave', tipo: 'dose', nao: true }]);
caso('metotrexato VO diário', [it('Metotrexato', { dose_valor: 15, dose_unidade: 'mg', via: 'VO', intervalo_horas: 24 })], {}, '', [{ nivel: 'grave', re: /SEMANAL/ }]);
caso('metotrexato VO semanal ok', [it('Metotrexato', { dose_valor: 15, dose_unidade: 'mg', via: 'VO', intervalo_horas: 168 })], {}, '', [{ re: /SEMANAL/, nao: true }]);
caso('paracetamol + Tylex', [it('Paracetamol', { dose_valor: 750, dose_unidade: 'mg', via: 'VO', intervalo_horas: 6 }), it('Tylex 30 mg', { dose_valor: 1, dose_unidade: 'comprimido', via: 'VO', intervalo_horas: 6, se_necessario: true })], {}, '', [{ nivel: 'atencao', re: /mais de uma fonte/ }]);
caso('riociguate + sildenafila', [it('Sildenafila', { dose_valor: 20, dose_unidade: 'mg', via: 'VO', intervalo_horas: 8 })], {}, 'Riociguate 1,5 mg', [{ nivel: 'grave', re: /Riociguate/ }]);
caso('voriconazol EV TFG 40', [it('Voriconazol', { dose_valor: 4, dose_unidade: 'mg/kg', intervalo_horas: 12 })], { tfg: 40 }, '', [{ nivel: 'atencao', re: /veículo/ }]);
caso('idoso nortriptilina', [it('Nortriptilina', { dose_valor: 25, dose_unidade: 'mg', via: 'VO' })], { idade: 72 }, '', [{ nivel: 'atencao', tipo: 'idoso' }]);
caso('idoso buscopan só aviso', [it('Butilbrometo de escopolamina', { dose_valor: 20, dose_unidade: 'mg', intervalo_horas: 8 })], { idade: 72 }, '', [{ nivel: 'info', tipo: 'idoso' }, { nivel: 'atencao', tipo: 'idoso', nao: true }]);
caso('adrenalina SC alta vigilância', [it('Adrenalina', { dose_valor: 0.5, dose_unidade: 'mg', via: 'SC' })], {}, '', [{ tipo: 'mpp' }]);
caso('adrenalina IM sem alta vigilância', [it('Adrenalina', { dose_valor: 0.5, dose_unidade: 'mg', via: 'IM' })], {}, '', [{ tipo: 'mpp', nao: true }]);
caso('prometazina IM alta vigilância', [it('Prometazina', { dose_valor: 25, dose_unidade: 'mg', via: 'IM' })], {}, '', [{ tipo: 'mpp' }]);
caso('gestante topiramato', [it('Topiramato', { dose_valor: 25, dose_unidade: 'mg', via: 'VO', intervalo_horas: 12 })], { sexo: 'F', gestante: true }, '', [{ nivel: 'atencao', tipo: 'gestacao', re: /EMA/ }]);
caso('gestante rivaroxabana', [it('Rivaroxabana', { dose_valor: 15, dose_unidade: 'mg', via: 'VO', intervalo_horas: 12 })], { sexo: 'F', gestante: true }, '', [{ nivel: 'atencao', tipo: 'gestacao' }]);
caso('idoso magro enoxaparina sem altura', [it('Enoxaparina', { dose_valor: 40, dose_unidade: 'mg', via: 'SC' })], { idade: 82, peso: 48, tfg: 55 }, '', [{ nivel: 'info', re: /desindexada/ }]);
caso('altura informada usa TFG desindexada', [it('Enoxaparina', { dose_valor: 50, dose_unidade: 'mg', via: 'SC', intervalo_horas: 12 })], { idade: 82, peso: 48, tfg: 34, altura: 150 }, '', [{ nivel: 'grave', tipo: 'renal', re: /uma vez ao dia/ }, { re: /informe a altura/, nao: true }]);
caso('vanco + pip-tazo só aviso', [it('Vancomicina', { dose_valor: 1, intervalo_horas: 12 }), it('Piperacilina-tazobactam', { dose_valor: 4.5, intervalo_horas: 6 })], {}, '', [{ nivel: 'info', re: /ACORN/ }]);
caso('idoso AINE + prednisona', [it('Ibuprofeno', { dose_valor: 400, dose_unidade: 'mg', via: 'VO', intervalo_horas: 8 })], { idade: 70 }, 'Prednisona 20 mg', [{ nivel: 'atencao', re: /sangramento digestivo/ }]);
// nível do item = pior alerta (selo e contador da tela dependem disso)
{
  const r = S.conferir([it('Paracetamol', { via: 'VO', intervalo_horas: 4 }), it('Ceftriaxona'), it('Dipirona', { via: 'VO', intervalo_horas: 8 })], Object.assign({}, P0, { alergias: 'penicilina' }), '');
  const niv = r.itens.map(x => x.nivel).join(',');
  if (niv !== 'grave,atencao,ok') { falhas++; console.log('FALHOU nível do item:', niv); } else ok++;
}
console.log(`\n${ok} casos ok, ${falhas} falharam`);
process.exit(falhas ? 1 : 0);
