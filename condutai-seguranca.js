/* CondutAI — conferência de segurança da prescrição (determinística, sem IA).
   Recebe os itens que a IA sugeriu (estruturados) e os dados do paciente, e devolve alertas por item e do
   conjunto: alergia e reação cruzada, teto de dose, conta por peso, função renal (TFG CKD-EPI 2021),
   fígado, gestação, idoso (Beers 2023), alta vigilância (ISMP Brasil), interações graves e duplicidade.
   A regra é explícita e auditável; a IA não decide aqui. Cada regra traz a fonte.
   Funciona no navegador (window.CVSeg) e no Node (require) para os testes em _testa_seguranca.js. */
(function (root) {
  'use strict';

  const norm = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9%+\/.,\- ]/g, ' ').replace(/\s+/g, ' ').trim();

  /* ---------------- Fármacos por classe ----------------
     'nome|alias|alias'. O primeiro nome é o canônico. Um fármaco pode estar em várias classes. */
  const CLASSES = {
    penicilina: 'amoxicilina|amoxil|ampicilina|penicilina|benzilpenicilina|benzetacil|penicilina g benzatina|penicilina cristalina|oxacilina|piperacilina|tazocin|amoxicilina clavulanato|clavulin|sulbactam|unasyn',
    cefalosporina: 'cefalexina|keflex|cefadroxila|cefadroxil|cefaclor|cefazolina|cefuroxima|cefoxitina|ceftriaxona|rocefin|cefotaxima|ceftazidima|fortaz|cefepima|cefepime|maxcef|ceftarolina|ceftazidima avibactam|ceftolozana',
    carbapenem: 'meropenem|meronem|imipenem|imipenem cilastatina|ertapenem|invanz',
    monobactam: 'aztreonam',
    sulfa_atb: 'sulfametoxazol|smx|bactrim|sulfadiazina|sulfassalazina',
    aine: 'ibuprofeno|diclofenaco|cetoprofeno|profenid|naproxeno|nimesulida|cetorolaco|toragesic|meloxicam|piroxicam|tenoxicam|indometacina|acido mefenamico|etoricoxibe|celecoxibe|aas|acido acetilsalicilico|aspirina',
    cox2: 'celecoxibe|etoricoxibe',
    pirazolona: 'dipirona|metamizol|novalgina|dorflex|neosaldina',
    paracetamol: 'paracetamol|acetaminofeno|tylenol|tylex|paco|paracetamol codeina',
    macrolideo: 'azitromicina|claritromicina|eritromicina',
    quinolona: 'ciprofloxacino|levofloxacino|moxifloxacino|norfloxacino|ofloxacino',
    aminoglicosideo: 'gentamicina|amicacina|tobramicina|estreptomicina',
    tetraciclina: 'doxiciclina|tetraciclina|minociclina|tigeciclina',
    glicopeptideo: 'vancomicina|teicoplanina',
    antimicrobiano: 'smx|bactrim|trimetoprima|amoxicilina|ampicilina|penicilina|oxacilina|piperacilina|cefalexina|cefadroxila|cefazolina|cefuroxima|ceftriaxona|cefotaxima|ceftazidima|cefepima|cefepime|ceftarolina|meropenem|imipenem|ertapenem|aztreonam|sulfametoxazol|azitromicina|claritromicina|eritromicina|ciprofloxacino|levofloxacino|moxifloxacino|norfloxacino|gentamicina|amicacina|doxiciclina|tetraciclina|tigeciclina|vancomicina|teicoplanina|clindamicina|metronidazol|nitrofurantoina|fosfomicina|linezolida|daptomicina|polimixina b|colistina|rifampicina|fluconazol|voriconazol|anfotericina|aciclovir|valaciclovir|oseltamivir|ganciclovir',
    opioide: 'tylex|paco|morfina|dimorf|codeina|tramadol|tramal|fentanil|fentanila|metadona|oxicodona|meperidina|petidina|hidromorfona|buprenorfina|nalbufina|remifentanil|sufentanil|tapentadol',
    benzodiazepinico: 'diazepam|midazolam|dormonid|clonazepam|rivotril|lorazepam|alprazolam|bromazepam|clobazam|flunitrazepam',
    hipnotico_z: 'zolpidem|zopiclona|eszopiclona',
    anti_h1_1g: 'prometazina|fenergan|difenidramina|hidroxizina|hixizine|dexclorfeniramina|polaramine|clorfeniramina|dimenidrinato|dramin|meclizina|ciproeptadina',
    antimuscarinico: 'escopolamina|hioscina|butilbrometo de escopolamina|buscopan|atropina|oxibutinina|biperideno',
    relaxante_beers: 'ciclobenzaprina|carisoprodol|orfenadrina|metocarbamol|clorzoxazona|dorflex',
    relaxante_muscular: 'ciclobenzaprina|carisoprodol|orfenadrina|metocarbamol|baclofeno',
    anticoagulante: 'heparina|heparina nao fracionada|enoxaparina|clexane|dalteparina|fondaparinux|varfarina|marevan|rivaroxabana|xarelto|apixabana|eliquis|dabigatrana|pradaxa|edoxabana',
    doac: 'rivaroxabana|xarelto|apixabana|eliquis|dabigatrana|pradaxa|edoxabana',
    antitrombotico_ismp: 'tirofibana|abciximabe|eptifibatida|argatrobana|bivalirrudina',
    sedativo_ev: 'midazolam|dormonid|dexmedetomidina|precedex|diazepam|lorazepam',
    betabloq_ev: 'metoprolol|esmolol|labetalol',
    antiagregante: 'aas|acido acetilsalicilico|aspirina|clopidogrel|ticagrelor|prasugrel|cilostazol',
    trombolitico: 'alteplase|tenecteplase|estreptoquinase',
    ieca: 'captopril|enalapril|lisinopril|ramipril|perindopril|benazepril',
    bra: 'losartana|valsartana|olmesartana|candesartana|irbesartana|telmisartana|sacubitril valsartana',
    poupador_k: 'espironolactona|eplerenona|amilorida|triantereno',
    potassio: 'cloreto de potassio|kcl|fosfato de potassio|citrato de potassio|slow k',
    diuretico_alca: 'furosemida|lasix|bumetanida',
    tiazidico: 'hidroclorotiazida|clortalidona|indapamida',
    estatina_cyp3a4: 'sinvastatina|lovastatina',
    estatina: 'sinvastatina|lovastatina|atorvastatina|rosuvastatina|pravastatina|pitavastatina',
    inib_cyp3a4_forte: 'claritromicina|eritromicina|itraconazol|cetoconazol|posaconazol|voriconazol|ritonavir|nirmatrelvir',
    nitrato: 'nitroglicerina|tridil|mononitrato de isossorbida|dinitrato de isossorbida|isossorbida|isordil|monocordil',
    ipde5: 'sildenafila|tadalafila|vardenafila',
    riociguate: 'riociguate',
    febuxostate: 'febuxostate',
    isrs: 'fluoxetina|sertralina|paroxetina|citalopram|escitalopram|fluvoxamina',
    irsn: 'venlafaxina|desvenlafaxina|duloxetina',
    triciclico: 'amitriptilina|nortriptilina|imipramina|clomipramina|desipramina|doxepina',
    imao_like: 'linezolida|azul de metileno|tranilcipromina|selegilina|rasagilina|moclobemida|fenelzina',
    serotoninergico: 'fluoxetina|sertralina|paroxetina|citalopram|escitalopram|fluvoxamina|venlafaxina|desvenlafaxina|duloxetina|amitriptilina|nortriptilina|imipramina|clomipramina|tramadol|meperidina|fentanil|fentanila|metadona|linezolida|azul de metileno|trazodona|sumatriptana|litio|ondansetrona|tranilcipromina|selegilina',
    qt: 'amiodarona|sotalol|haloperidol|droperidol|ondansetrona|azitromicina|claritromicina|eritromicina|ciprofloxacino|levofloxacino|moxifloxacino|hidroxicloroquina|cloroquina|metadona|domperidona|citalopram|escitalopram|fluconazol|clorpromazina|levomepromazina|quetiapina|procainamida|propofol|pentamidina|arsenico',
    anticonv_aromatico: 'carbamazepina|oxcarbazepina|fenitoina|hidantal|fenobarbital|gardenal|lamotrigina',
    ipp: 'omeprazol|esomeprazol|pantoprazol|lansoprazol|rabeprazol|dexlansoprazol',
    ipp_cyp2c19: 'omeprazol|esomeprazol',
    insulina: 'insulina|nph|glargina|detemir|degludeca|lispro|asparte|glulisina|insulina regular',
    sulfonilureia: 'glibenclamida|daonil|gliclazida|glimepirida|glipizida|clorpropamida',
    corticoide: 'prednisona|prednisolona|dexametasona|decadron|hidrocortisona|metilprednisolona|solumedrol|betametasona|deflazacorte',
    tiopurina: 'azatioprina|mercaptopurina',
    antipsicotico: 'haloperidol|haldol|clorpromazina|levomepromazina|quetiapina|olanzapina|risperidona|aripiprazol|ziprasidona|droperidol',
    neuromuscular: 'rocuronio|succinilcolina|suxametonio|cisatracurio|atracurio|vecuronio|pancuronio',
    anestesico_geral: 'propofol|cetamina|ketamina|etomidato|tiopental',
    adrenergico_ev: 'noradrenalina|norepinefrina|adrenalina|epinefrina|dopamina|dobutamina|efedrina|fenilefrina|vasopressina|milrinona|isoproterenol',
    antiarritmico: 'amiodarona|lidocaina|procainamida|adenosina|sotalol|propafenona',
    nefrotoxico: 'vancomicina|gentamicina|amicacina|anfotericina|polimixina b|colistina|aciclovir|contraste iodado',
    colchicina: 'colchicina',
    valproato: 'valproato|acido valproico|divalproato|depakote|depakene',
    metotrexato: 'metotrexato',
    alopurinol: 'alopurinol|zyloric',
    litio: 'litio|carbonato de litio',
    digoxina: 'digoxina',
    metformina: 'metformina|glifage',
    nitrofurantoina: 'nitrofurantoina|macrodantina',
    /* fármacos comuns sem regra própria: entram para não cair em "fora da base" e para o texto livre da alergia */
    conhecido: 'metoclopramida|bromoprida|domperidona|ondansetrona|gabapentina|pregabalina|loperamida|simeticona|lactulose|bisacodil|sene|macrogol|clonidina|anlodipino|hidralazina|nifedipina|carvedilol|propranolol|atenolol|bisoprolol|diltiazem|verapamil|atorvastatina|levotiroxina|propiltiouracil|metimazol|tiamazol|tiamina|acido folico|sulfato ferroso|vitamina b12|cianocobalamina|salbutamol|fenoterol|ipratropio|budesonida|formoterol|beclometasona|montelucaste|n acetilcisteina|acetilcisteina|haloperidol|quetiapina|risperidona|olanzapina|sertralina|fluoxetina|escitalopram|trazodona|mirtazapina|levetiracetam|topiramato|acido tranexamico|vitamina k|fitomenadiona|protamina|naloxona|flumazenil|glicose|soro fisiologico|ringer lactato|albumina|manitol|bicarbonato de sodio|gluconato de calcio|sulfato de magnesio|nitroprussiato|ocitocina|dexmedetomidina|lidocaina|bupivacaina|nistatina|aciclovir|ivermectina|albendazol|hidroxicloroquina|colchicina|alopurinol|febuxostate|riociguate|topiramato',
    teratogeno: 'isotretinoina|acitretina|talidomida|micofenolato|leflunomida|ribavirina|metotrexato|misoprostol|varfarina|valproato|acido valproico|bosentana|ambrisentana|macitentana|riociguate'
  };

  // índice: alias normalizado -> {nome, classes:Set}
  const IDX = new Map();
  for (const [cls, lista] of Object.entries(CLASSES)) {
    const nomes = lista.split('|').map(norm);
    for (const a of nomes) {
      if (!IDX.has(a)) IDX.set(a, new Set());
      IDX.get(a).add(cls);
    }
  }
  const ALIASES = [...IDX.keys()].sort((a, b) => b.length - a.length);
  const temPalavra = (txt, a) => (' ' + txt + ' ').includes(' ' + a + ' ');

  /* identifica os fármacos citados num nome ("amoxicilina + clavulanato", "SMX-TMP 800/160") */
  function identifica(nome) {
    const t = ' ' + norm(nome).replace(/[+\/,\-]/g, ' ').replace(/\s+/g, ' ') + ' ';
    const achados = new Set(), classes = new Set();
    for (const a of ALIASES) {
      if (temPalavra(t.trim(), a)) { achados.add(a); IDX.get(a).forEach(c => classes.add(c)); }
    }
    return { farmacos: [...achados], classes };
  }
  const tem = (id, cls) => id.classes.has(cls);
  const temAlgum = (id, lista) => lista.some(c => id.classes.has(c));
  const nomeTem = (id, re) => id.farmacos.some(f => re.test(f));

  /* ---------------- Alergias ---------------- */
  const ALERGIA_MAP = [
    [/penicil|amoxicil|ampicil|benzetacil|oxacil|piperacil|clavul/, ['penicilina']],
    [/betalact|beta lact|b lactam/, ['penicilina', 'cefalosporina', 'carbapenem']],
    [/cefalospor|cefalex|cefadrox|cefaclor|cefazol|cefurox|cefoxit|ceftriax|cefotax|ceftazid|cefepi|ceftarol/, ['cefalosporina']],
    [/carbapen|meropen|imipen|ertapen/, ['carbapenem']],
    [/sulfa|sulfonamid|bactrim|sulfametox|sulfadiaz/, ['sulfa_atb']],
    [/\baine\b|antiinflamat|anti inflamat|ibuprof|diclofen|cetoprof|naprox|nimesul|cetorol|meloxic|piroxic|tenoxic|indometac|\baas\b|aspirin|acetilsalicil/, ['aine']],
    [/dipiron|metamizol|novalgin|pirazol/, ['pirazolona']],
    [/paracetamol|acetaminof|tylenol/, ['paracetamol']],
    [/macrolid|azitromic|claritromic|eritromic/, ['macrolideo']],
    [/quinolon|ciproflox|levoflox|moxiflox|norflox/, ['quinolona']],
    [/opioid|opiace|morfin|codein|tramad|fentan|meperid|oxicodon|metadon/, ['opioide']],
    [/aminoglicos|gentamic|amicac/, ['aminoglicosideo']],
    [/tetracicl|doxicicl|minocicl/, ['tetraciclina']],
    [/vancomic/, ['glicopeptideo']],
    [/heparin|enoxapar|\bhit\b|trombocitopenia induzida/, ['heparina']],
    [/carbamazep|oxcarbaz|fenitoin|hidantal|fenobarb|gardenal|lamotrig/, ['anticonv_aromatico']],
    [/benzodiaz|diazepam|midazol|clonazep|lorazep|alprazol/, ['benzodiazepinico']],
    [/fenotiazin|prometazin/, ['fenotiazina']],
    [/metoclopram|bromoprid/, ['benzamida']],
    [/ondansetr|setron/, ['setron']],
    [/contraste|iodo/, ['contraste']],
    [/insulin/, ['insulina']],
    [/corticoid|dexametas|hidrocortis|metilpred|predniso/, ['corticoide']]
  ];
  const NEGA = /^(nega|nenhuma|nao tem|nao|sem alergias?|nkda|nda|nada|nao conhecidas?|desconhece)\b/;

  function parseAlergias(txt) {
    const t = norm(txt);
    if (!t || NEGA.test(t)) return { nega: !!t, grupos: new Set(), termos: [] };
    const grupos = new Set();
    for (const [re, gs] of ALERGIA_MAP) if (re.test(t)) gs.forEach(g => grupos.add(g));
    const anafilaxia = /anafila|edema de glote|choque|angioedema|sjs|stevens|necrolise|dress/.test(t);
    const termos = t.split(/[,;\/]| e /).map(s => s.trim()).filter(s => s.length >= 4);
    return { nega: false, grupos, termos, anafilaxia };
  }

  function checaAlergia(id, nomeItem, al) {
    const out = [];
    if (!al || al.nega || (!al.grupos.size && !al.termos.length)) return out;
    const G = al.grupos;
    const g = (grupo, cls) => G.has(grupo) && tem(id, cls);
    // mesmo grupo: bloqueio
    const direto = [
      ['penicilina', 'penicilina'], ['cefalosporina', 'cefalosporina'], ['carbapenem', 'carbapenem'], ['sulfa_atb', 'sulfa_atb'],
      ['pirazolona', 'pirazolona'], ['paracetamol', 'paracetamol'], ['macrolideo', 'macrolideo'], ['quinolona', 'quinolona'],
      ['aminoglicosideo', 'aminoglicosideo'], ['tetraciclina', 'tetraciclina'], ['glicopeptideo', 'glicopeptideo'],
      ['anticonv_aromatico', 'anticonv_aromatico'], ['benzodiazepinico', 'benzodiazepinico'], ['insulina', 'insulina'], ['corticoide', 'corticoide']
    ];
    for (const [gr, cls] of direto) if (g(gr, cls)) out.push({ nivel: 'grave', tipo: 'alergia', msg: `Alergia registrada a ${ROTULO_GRUPO[gr]}: este fármaco é do mesmo grupo.` });
    if (G.has('aine') && tem(id, 'aine') && !tem(id, 'cox2')) out.push({ nivel: 'grave', tipo: 'alergia', msg: 'Alergia registrada a anti-inflamatório (AINE/AAS): este fármaco é do mesmo grupo.' });
    if (G.has('aine') && tem(id, 'cox2')) out.push({ nivel: 'atencao', tipo: 'alergia', msg: 'Alergia a AINE: os inibidores seletivos da COX-2 costumam ser tolerados na doença respiratória exacerbada por AINE, mas não na alergia verdadeira ao mesmo fármaco. Confirme o tipo de reação.' });
    if (G.has('heparina') && tem(id, 'anticoagulante') && nomeTem(id, /heparin|enoxapar|daltepar/)) out.push({ nivel: 'grave', tipo: 'alergia', msg: 'Alergia ou trombocitopenia induzida por heparina registrada: não use heparina nem enoxaparina.' });
    if (G.has('opioide') && tem(id, 'opioide')) {
      const fenant = nomeTem(id, /morfin|codein|hidromorf|oxicodon/);
      out.push({ nivel: fenant ? 'grave' : 'atencao', tipo: 'alergia', msg: fenant ? 'Alergia a opioide registrada: este é do mesmo grupo químico (fenantrenos). Confirme se foi alergia ou efeito adverso (náusea, prurido).' : 'Alergia a opioide registrada: grupo químico diferente, reatividade cruzada menor. Confirme o tipo de reação.' });
    }
    // reação cruzada entre betalactâmicos
    if (G.has('penicilina') && !G.has('cefalosporina') && tem(id, 'cefalosporina')) {
      const cadeia = nomeTem(id, /cefalexin|cefadrox|cefaclor/);
      out.push({ nivel: (cadeia || al.anafilaxia) ? 'grave' : 'atencao', tipo: 'alergia', msg: cadeia
        ? 'Alergia a penicilina: esta cefalosporina tem cadeia lateral igual à da amoxicilina/ampicilina, com reatividade cruzada maior. Prefira outra classe ou uma cefalosporina de cadeia diferente.'
        : 'Alergia a penicilina: reatividade cruzada com cefalosporinas de cadeia lateral diferente é baixa (cerca de 1–2%).' + (al.anafilaxia ? ' Houve reação grave: só com avaliação do alergista ou em ambiente monitorado.' : ' Confirme o tipo de reação.') });
    }
    if (G.has('cefalosporina') && !G.has('penicilina') && tem(id, 'penicilina')) out.push({ nivel: 'atencao', tipo: 'alergia', msg: 'Alergia a cefalosporina: há reatividade cruzada possível com penicilinas, maior se a cadeia lateral for semelhante. Confirme o tipo de reação.' });
    if ((G.has('penicilina') || G.has('cefalosporina')) && !G.has('carbapenem') && tem(id, 'carbapenem')) out.push({ nivel: 'info', tipo: 'alergia', msg: 'Alergia a betalactâmico: reatividade cruzada com carbapenêmicos é inferior a 1%.' + (al.anafilaxia ? ' Houve reação grave: considere dose-teste monitorada.' : '') });
    if (G.has('pirazolona') && tem(id, 'aine')) out.push({ nivel: 'atencao', tipo: 'alergia', msg: 'Alergia a dipirona: pode haver reação cruzada com AINEs (inibidores da COX-1). Confirme o tipo de reação.' });
    if (G.has('aine') && tem(id, 'pirazolona')) out.push({ nivel: 'atencao', tipo: 'alergia', msg: 'Alergia a AINE: a dipirona também inibe a COX-1 e pode cruzar. Confirme o tipo de reação.' });
    // termo livre: o nome do fármaco aparece na alergia
    if (!out.some(a => a.nivel === 'grave')) {
      const n = norm(nomeItem);
      for (const termo of al.termos) {
        const palavras = termo.split(' ').filter(p => p.length >= 5 && !/^(alerg|reacao|grave|leve|urtic|prurid|rash|anafil)/.test(p));
        if (palavras.some(p => n.includes(p.slice(0, Math.max(5, p.length - 1))))) {
          out.push({ nivel: 'grave', tipo: 'alergia', msg: `A alergia registrada ("${termo}") cita este fármaco.` });
          break;
        }
      }
    }
    return out;
  }
  const ROTULO_GRUPO = {
    penicilina: 'penicilina', cefalosporina: 'cefalosporina', carbapenem: 'carbapenêmico', sulfa_atb: 'sulfonamida (sulfa)',
    pirazolona: 'dipirona', paracetamol: 'paracetamol', macrolideo: 'macrolídeo', quinolona: 'quinolona',
    aminoglicosideo: 'aminoglicosídeo', tetraciclina: 'tetraciclina', glicopeptideo: 'vancomicina',
    anticonv_aromatico: 'anticonvulsivante aromático (reação cruzada entre carbamazepina, fenitoína, fenobarbital, lamotrigina)',
    benzodiazepinico: 'benzodiazepínico', insulina: 'insulina', corticoide: 'corticoide'
  };

  /* ---------------- Doses: unidades e tetos ---------------- */
  function paraMg(valor, unidade) {
    const u = norm(unidade).replace(/\s/g, '');
    if (valor == null || isNaN(valor)) return null;
    if (/^(mg)$/.test(u)) return valor;
    if (/^(g|grama|gramas)$/.test(u)) return valor * 1000;
    if (/^(mcg|ug|µg|microgramas?)$/.test(u)) return valor / 1000;
    return null;
  }
  /* Tetos de dose em ADULTO (mg). dia = máximo em 24 h; dose = máximo por tomada. Fonte em cada linha.
     Valores conferidos na bula/agência citada; quando a fonte admite faixa, fica o limite superior. */
  const TETOS = [
    { re: /paracetamol|acetaminof/, dia: 4000, fonte: 'bula do paracetamol (FDA)', hep: 2000, hepNivel: 'atencao', hepMsg: 'hepatopatia: consenso de 2–3 g/dia' },
    { re: /dipirona|metamizol/, dia: 4000, diaParenteral: 5000, fonte: 'bula da Novalgina: VO 4 g/dia; injetável até 5 g/dia' },
    { re: /ibuprofeno/, dia: 3200, fonte: 'bula do ibuprofeno (FDA)' },
    { re: /cetoprofeno/, dia: 300, fonte: 'bula do Profenid' },
    { re: /diclofenaco/, dia: 150, fonte: 'bula do Voltaren (Novartis Brasil)' },
    { re: /naproxeno/, dia: 1500, sal: [/sodico/, 500 / 550], fonte: 'bula do Naprosyn: 1.500 mg/dia de base, por tempo limitado' },
    { re: /cetorolaco/, dia: 120, diaIdoso: 60, diaSL: 60, diaSLIdoso: 40, fonte: 'bula do cetorolaco: EV/IM 120 mg/dia (60 se ≥65 anos, <50 kg ou disfunção renal); Toragesic SL 60 mg/dia (40 nesses casos); máx. 5 dias' },
    { re: /tramadol/, dia: 400, diaIdoso75: 300, diaRenal30: 200, fonte: 'bula do tramadol (FDA): >75 anos 300 mg/dia; ClCr <30 a cada 12 h, máx. 200 mg/dia' },
    { re: /codeina/, dia: 360, fonte: 'bula da codeína (DailyMed)' },
    { re: /metoclopramida/, dia: 30, porKgDia: 0.5, nivel: 'atencao', fonte: 'EMA 2013: máx. 0,5 mg/kg/dia (30 mg/dia) por até 5 dias; a bula brasileira exige intervalo mínimo de 6 h' },
    { re: /ondansetrona/, doseEV: 16, fonte: 'FDA 2012: dose única EV máx. 16 mg (prolonga o QT)' },
    { re: /alopurinol/, dia: 800, fonte: 'bula do alopurinol (Zyloprim)' },
    { re: /gabapentina/, dia: 3600, fonte: 'bula da gabapentina (FDA)' },
    { re: /pregabalina/, dia: 600, fonte: 'bula da pregabalina (FDA)' },
    { re: /metformina/, dia: 2550, fonte: 'bula da metformina: 2.550 mg/dia (liberação imediata); XR 2.000 mg/dia' },
    { re: /escopolamina|hioscina|buscopan/, dia: 100, fonte: 'bula do Buscopan' },
    { re: /nimesulida/, dia: 400, diaAlerta: 200, fonte: 'bula brasileira da nimesulida: 100 mg 2x/dia, excepcionalmente 400 mg/dia; EMA: 200 mg/dia por até 15 dias' },
    { re: /meloxicam/, dia: 15, fonte: 'bula do meloxicam (FDA)' },
    { re: /celecoxibe/, dia: 600, diaAlerta: 400, fonte: 'bula do Celebrex: 400 mg/dia; só no 1º dia da dor aguda até 600 mg' },
    { re: /loperamida/, dia: 16, fonte: 'bula da loperamida (FDA 2016)' }
  ];

  /* ---------------- Rins (TFG CKD-EPI 2021, mL/min/1,73m²) ---------------- */
  const PRECISA_AJUSTE_RENAL = /claritromicina|cefoxitina|ceftarolina|avibactam|ceftolozana|penicilina cristalina|benzilpenicilina|valganciclovir|etambutol|nitrofurantoina|tenofovir|lamivudina|aciclovir|valaciclovir|ganciclovir|vancomicina|teicoplanina|gentamicina|amicacina|tobramicina|cefepim|cefepime|ceftazidima|cefazolina|cefuroxima|cefalexina|cefadrox|piperacilina|meropenem|imipenem|ertapenem|ampicilina|amoxicilina|ciprofloxacino|levofloxacino|norfloxacino|sulfametoxazol|smx|bactrim|fluconazol|oseltamivir|daptomicina|colistina|gabapentina|pregabalina|levetiracetam|tramadol|morfina|codeina|baclofeno|alopurinol|colchicina|digoxina|litio|enoxaparina|fondaparinux|rivaroxabana|apixabana|dabigatrana|edoxabana|espironolactona|sotalol|metformina|famotidina|sitagliptina|saxagliptina|vildagliptina|atenolol|ranitidina/;

  function checaRenal(id, item, P) {
    const out = [];
    const tfg = P.tfg, n = id.farmacos.join(' ');
    if (P.dialise) {
      if (PRECISA_AJUSTE_RENAL.test(n)) out.push({ nivel: 'atencao', tipo: 'renal', msg: `Paciente em ${P.dialise}: a dose e o horário em relação à diálise precisam de ajuste específico.` + (item.ajuste_renal_aplicado ? ' A sugestão diz que ajustou; confira.' : '') });
    }
    if (tfg == null) {
      if (PRECISA_AJUSTE_RENAL.test(n) && !P.dialise) out.push({ nivel: 'atencao', tipo: 'dados', msg: 'Sem creatinina: não dá para conferir o ajuste renal deste fármaco.' });
      return out;
    }
    const regra = (cond, nivel, msg) => { if (cond) out.push({ nivel, tipo: 'renal', msg }); };
    regra(tem(id, 'metformina') && tfg < 30, 'grave', `Metformina é contraindicada com TFG <30 (TFG ≈ ${tfg}). FDA 2016.`);
    regra(tem(id, 'metformina') && tfg >= 30 && tfg < 45, 'atencao', `Metformina com TFG 30–45 (≈ ${tfg}): não iniciar; se já usa, reavaliar a dose. FDA 2016.`);
    regra(tem(id, 'aine') && !nomeTem(id, /^(aas|acido acetilsalicilico|aspirina)$/) && tfg < 30, 'grave', `AINE com TFG <30 (≈ ${tfg}): evitar (risco de lesão renal aguda e hipercalemia). Beers 2023, KDIGO.`);
    regra(tem(id, 'aine') && !nomeTem(id, /^(aas|acido acetilsalicilico|aspirina)$/) && tfg >= 30 && tfg < 60, 'atencao', `AINE com TFG ${tfg}: menor dose e menor tempo possíveis; evite com IECA/BRA e diurético.`);
    regra(tem(id, 'nitrofurantoina') && tfg < 30, 'grave', `Nitrofurantoína com TFG <30 (≈ ${tfg}): evitar (ineficaz e tóxica). Beers 2023.`);
    regra(nomeTem(id, /enoxaparina|clexane/) && tfg < 30 && Number(item.intervalo_horas) === 12, 'grave', `Enoxaparina a cada 12 h com TFG <30 (≈ ${tfg}): a dose terapêutica passa a 1 mg/kg uma vez ao dia. Bula da enoxaparina.`);
    regra(nomeTem(id, /dabigatrana|pradaxa/) && tfg < 30, 'grave', `Dabigatrana com função renal <30: contraindicada. Bula.`);
    regra(nomeTem(id, /sulfametoxazol|smx|bactrim/) && tfg < 15, 'grave', `Sulfametoxazol-trimetoprima com TFG <15 (≈ ${tfg}): evitar. Bula.`);
    regra(nomeTem(id, /sulfametoxazol|smx|bactrim/) && tfg >= 15 && tfg < 30, 'atencao', `Sulfametoxazol-trimetoprima com TFG 15–30 (≈ ${tfg}): metade da dose. Bula.`);
    regra(nomeTem(id, /espironolactona|eplerenona/) && tfg < 30, 'grave', `Antagonista mineralocorticoide com TFG <30 (≈ ${tfg}): risco alto de hipercalemia; evitar.`);
    regra(nomeTem(id, /^(morfina|codeina|dimorf)$/) && tfg < 30, 'atencao', `Morfina ou codeína com TFG <30 (≈ ${tfg}): metabólitos ativos acumulam; prefira fentanil ou metadona, ou reduza dose e aumente o intervalo.`);
    regra(nomeTem(id, /amoxicilina clavulanato|clavulin|clavulanato/) && tfg < 30 && /875/.test(norm(item.farmaco + ' ' + (item.apresentacao || '') + ' ' + item.dose_valor)), 'grave', `Amoxicilina-clavulanato 875 mg com função renal <30 (≈ ${tfg}): não usar esta apresentação.`);
    regra(nomeTem(id, /voriconazol/) && tfg < 50 && /\b(ev|iv|endoven|intraven)/.test(norm(item.via)), 'atencao', `Voriconazol EV com TFG <50 (≈ ${tfg}): o veículo da apresentação EV acumula; prefira VO.`);
    regra(tem(id, 'doac') && tfg < 15, 'grave', `Anticoagulante oral direto com TFG <15 (≈ ${tfg}): evitar. Beers 2023.`);
    regra(nomeTem(id, /baclofeno/) && tfg < 60, 'atencao', `Baclofeno com TFG <60 (≈ ${tfg}): risco de encefalopatia; evitar ou reduzir muito. Beers 2023.`);
    if (P.tfgDesindexada == null && (P.idade >= 75 || (P.peso && P.peso < 55)) && (tem(id, 'anticoagulante') || tem(id, 'aminoglicosideo') || nomeTem(id, /vancomicina/)))
      out.push({ nivel: 'info', tipo: 'renal', msg: 'Idoso ou peso baixo: a TFG indexada (por 1,73 m²) pode superestimar a função renal. Para este fármaco, informe a altura para usar a TFG desindexada (KDIGO 2024).' });
    // genérico: fármaco que exige ajuste, TFG <50, sem ajuste declarado
    const limiar = /claritromicina|tramadol|enoxaparina|rivaroxabana|apixabana|espironolactona|nitrofurantoina/.test(n) ? 30 : 50; // bula: ajuste só abaixo de 30
    if (tfg < limiar && PRECISA_AJUSTE_RENAL.test(n) && !item.ajuste_renal_aplicado && !out.some(a => a.nivel === 'grave'))
      out.push({ nivel: 'atencao', tipo: 'renal', msg: `TFG ≈ ${tfg}: este fármaco costuma exigir ajuste renal e a sugestão não diz que ajustou. Confira a dose na bula ou na tabela de ajuste.` });
    return out;
  }

  /* ---------------- Fígado ---------------- */
  function checaHepatica(id, P) {
    const out = [], h = P.hepatica;
    if (!h || h === 'normal') return out;
    const grave = h === 'C';
    if (tem(id, 'aine')) out.push({ nivel: 'atencao', tipo: 'hepatica', msg: 'AINE na cirrose: risco de lesão renal, hemorragia digestiva e piora da ascite. Evitar.' });
    if (tem(id, 'benzodiazepinico')) out.push({ nivel: grave ? 'grave' : 'atencao', tipo: 'hepatica', msg: 'Benzodiazepínico na hepatopatia pode precipitar encefalopatia. Evitar; se indispensável, lorazepam ou oxazepam em dose baixa.' });
    if (tem(id, 'opioide')) out.push({ nivel: 'atencao', tipo: 'hepatica', msg: 'Opioide na hepatopatia: dose menor e intervalo maior; risco de encefalopatia.' });
    if (tem(id, 'metformina') && grave) out.push({ nivel: 'grave', tipo: 'hepatica', msg: 'Metformina na hepatopatia grave: risco de acidose lática. Evitar.' });
    return out;
  }

  /* ---------------- Gestação ---------------- */
  const GESTACAO = [
    { re: /isotretinoina|acitretina|talidomida|micofenolato|leflunomida|ribavirina|bosentana|ambrisentana|macitentana|riociguate|finasterida|dutasterida|danazol|testosterona|iodo radioativo/, nivel: 'grave', msg: 'Teratogênico: contraindicado na gestação.' },
    { re: /metotrexato/, nivel: 'grave', msg: 'Metotrexato é teratogênico e abortivo: contraindicado na gestação (exceto uso obstétrico específico).' },
    { re: /varfarina|marevan/, nivel: 'grave', msg: 'Varfarina na gestação: embriopatia (6–12 semanas) e sangramento fetal. Use heparina de baixo peso (exceção discutida: prótese valvar mecânica, ESC 2018).' },
    { cls: ['doac'], nivel: 'atencao', msg: 'Anticoagulante oral direto na gestação: sem segurança estabelecida. Prefira heparina de baixo peso.' },
    { re: /valproato|acido valproico|divalproato|depakote|depakene/, nivel: 'grave', msg: 'Valproato na gestação: defeitos do tubo neural e dano ao neurodesenvolvimento. Evitar.' },
    { re: /misoprostol/, nivel: 'atencao', msg: 'Misoprostol é uterotônico e abortivo: só em indicação obstétrica.' },
    { cls: ['ieca', 'bra'], nivel: 'grave', msg: 'IECA/BRA na gestação: toxicidade fetal (insuficiência renal, oligoâmnio). Contraindicado em todos os trimestres; suspender ao detectar a gestação.' },
    { re: /aliscireno|sacubitril/, nivel: 'grave', msg: 'Bloqueio do sistema renina-angiotensina na gestação: contraindicado.' },
    { cls: ['estatina'], nivel: 'atencao', msg: 'Estatina na gestação: em geral suspender (FDA 2021 retirou a contraindicação absoluta; manter só em risco cardiovascular muito alto).' },
    { cls: ['tetraciclina'], nivel: 'atencao', msg: 'Tetraciclina/doxiciclina na gestação: evitar no 2º e no 3º trimestre (dentes e ossos do feto). Bula FDA 2025.' },
    { cls: ['quinolona'], nivel: 'atencao', msg: 'Quinolona na gestação: evitar se houver alternativa.' },
    { cls: ['aine'], nivel: 'atencao', msg: 'AINE na gestação: evitar a partir de 20 semanas (oligoâmnio) e contraindicado a partir de 30 (fechamento do canal arterial). FDA 2020.' },
    { re: /^(litio|carbonato de litio)$/, nivel: 'atencao', msg: 'Lítio na gestação: risco de anomalia cardíaca (Ebstein); pesar risco e benefício.' },
    { re: /carbamazepina|fenitoina|hidantal|fenobarbital/, nivel: 'atencao', msg: 'Anticonvulsivante com risco teratogênico: confirmar indicação e ácido fólico.' },
    { re: /topiramato/, nivel: 'atencao', msg: 'Topiramato na gestação: a EMA (2023) contraindica para enxaqueca e obesidade; na epilepsia, pesar risco e benefício.' },
    { re: /amiodarona/, nivel: 'atencao', msg: 'Amiodarona na gestação: risco de hipotireoidismo fetal; só se não houver alternativa.' },
    { re: /metimazol|tiamazol/, nivel: 'atencao', msg: 'Metimazol no 1º trimestre: prefira propiltiouracil.' },
    { cls: ['aminoglicosideo'], nivel: 'atencao', msg: 'Aminoglicosídeo na gestação: ototoxicidade fetal; só se indispensável.' }
  ];
  function checaGestacao(id, item, P) {
    if (!P.gestante) return [];
    const out = [], n = id.farmacos.join(' ');
    // AAS em dose baixa (até 150 mg/dia) é indicado na gestação (profilaxia de pré-eclâmpsia) e ficou fora do alerta de AINE (FDA 2020)
    const soAAS = id.farmacos.length && id.farmacos.every(f => /^(aas|acido acetilsalicilico|aspirina)$/.test(f));
    const mgAAS = paraMg(Number(item.dose_valor), item.dose_unidade);
    for (const r of GESTACAO) {
      if (r.cls && r.cls.includes('aine') && soAAS && (mgAAS == null || mgAAS <= 150)) continue;
      const hit = r.re ? id.farmacos.some(f => r.re.test(f)) : temAlgum(id, r.cls);
      if (hit) out.push({ nivel: r.nivel, tipo: 'gestacao', msg: r.msg });
    }
    if (!out.length && /varfarina|isotretinoina/.test(n)) out.push({ nivel: 'grave', tipo: 'gestacao', msg: 'Contraindicado na gestação.' });
    return out;
  }

  /* ---------------- Idoso (Beers AGS 2023) ---------------- */
  const BEERS = [
    { cls: ['benzodiazepinico'], msg: 'Benzodiazepínico no idoso: delirium, quedas e fraturas. Beers 2023: evitar.' },
    { cls: ['hipnotico_z'], msg: 'Hipnótico Z no idoso: quedas e delirium. Beers 2023: evitar.' },
    { cls: ['anti_h1_1g'], msg: 'Anti-histamínico de 1ª geração no idoso: efeito anticolinérgico (confusão, retenção urinária). Beers 2023: evitar.' },
    { re: /^(escopolamina|atropina|oxibutinina|biperideno)$/, exceto: /butil|buscopan/, msg: 'Antimuscarínico no idoso: efeito anticolinérgico. Beers 2023: evitar.' },
    { re: /butilbrometo|buscopan|hioscina/, nivel: 'info', msg: 'Butilescopolamina no idoso: anticolinérgico, mas quaternário (quase não entra no SNC). Use pelo menor tempo.' },
    { cls: ['relaxante_beers'], msg: 'Relaxante muscular no idoso: sedação e efeito anticolinérgico. Beers 2023: evitar.' },
    { re: /cetorolaco|indometacina/, msg: 'Cetorolaco e indometacina no idoso: sangramento e lesão renal. Beers 2023: evitar sempre.' },
    { re: /meperidina|petidina/, msg: 'Meperidina no idoso: neurotoxicidade. Beers 2023: evitar.' },
    { re: /metoclopramida/, msg: 'Metoclopramida no idoso: sintomas extrapiramidais e discinesia tardia. Beers 2023: evitar, exceto gastroparesia.' },
    { cls: ['sulfonilureia'], msg: 'Sulfonilureia no idoso: hipoglicemia prolongada. Beers 2023: evitar.' },
    { re: /amitriptilina|imipramina|clomipramina|nortriptilina|desipramina|doxepina/, msg: 'Tricíclico no idoso: anticolinérgico, sedação e hipotensão ortostática. Beers 2023: evitar.' },
    { re: /paroxetina/, msg: 'Paroxetina no idoso: efeito anticolinérgico. Beers 2023: evitar.' },
    { re: /nifedipina/, msg: 'Nifedipina de liberação imediata no idoso: hipotensão e isquemia. Beers 2023: evitar.', soImediata: true },
    { re: /oleo mineral/, msg: 'Óleo mineral oral no idoso: risco de aspiração. Beers 2023: evitar.' }
  ];
  function checaIdoso(id, item, P) {
    if (!(P.idade >= 65)) return [];
    const out = [];
    for (const r of BEERS) {
      const hit = r.re ? id.farmacos.some(f => r.re.test(f)) : temAlgum(id, r.cls);
      if (!hit) continue;
      if (r.exceto && r.exceto.test(norm(item.farmaco))) continue;
      if (r.soImediata && /retard|oros|liberacao prolongada|lp\b|xl\b/.test(norm(item.farmaco + ' ' + (item.apresentacao || '')))) continue;
      out.push({ nivel: r.nivel || 'atencao', tipo: 'idoso', msg: r.msg });
    }
    if (nomeTem(id, /digoxina/)) {
      const mg = paraMg(item.dose_valor, item.dose_unidade);
      if (mg != null && mg > 0.125) out.push({ nivel: 'atencao', tipo: 'idoso', msg: 'Digoxina acima de 0,125 mg/dia no idoso: toxicidade. Beers 2023.' });
    }
    if (tem(id, 'aine') && !nomeTem(id, /^(aas|acido acetilsalicilico|aspirina)$/)) out.push({ nivel: 'info', tipo: 'idoso', msg: 'AINE no idoso: evitar uso prolongado; se usar, curto prazo e com proteção gástrica. Beers 2023.' });
    return out;
  }

  /* ---------------- Alta vigilância (ISMP Brasil, uso hospitalar) ---------------- */
  function altaVigilancia(id, item) {
    const via = norm(item.via);
    const ev = /\b(ev|iv|endoven|intraven|bic|infusao)/.test(via + ' ' + norm(item.diluicao));
    const parenteral = ev || /\b(im|sc|intramusc|subcut)/.test(via);
    const classesEV = ['adrenergico_ev', 'anestesico_geral', 'antiarritmico', 'sedativo_ev', 'neuromuscular', 'betabloq_ev'];
    const nomeTxt = norm(item.farmaco + ' ' + (item.apresentacao || ''));
    if (temAlgum(id, ['anticoagulante', 'antitrombotico_ismp', 'trombolitico', 'insulina', 'opioide', 'neuromuscular', 'sulfonilureia']) || (ev && temAlgum(id, classesEV))
      || nomeTem(id, /cloreto de potassio|kcl|fosfato de potassio|sulfato de magnesio|nitroprussiato|ocitocina|vasopressina|metotrexato/)
      || /glicose (2[0-9]|[3-9][0-9])|glicose hipertonica|nacl (1|2|3|7|10|20)|cloreto de sodio (1|2|3|7|10|20)[ ,.%]|salina hipertonica/.test(nomeTxt)
      || (parenteral && nomeTem(id, /prometazina|fenergan/)) || (/\bsc\b|subcut/.test(via) && nomeTem(id, /^(adrenalina|epinefrina)$/)))
      return [{ nivel: 'info', tipo: 'mpp', msg: 'Medicamento de alta vigilância (ISMP Brasil 2019): faça dupla checagem de dose, via e diluição.' }];
    return [];
  }

  /* ---------------- Conta da dose ---------------- */
  function tomadasDia(item) {
    const h = Number(item.intervalo_horas);
    if (item.continuo) return null;
    if (h > 0 && h <= 24) return 24 / h;
    return null;
  }
  function contaDose(id, item, P) {
    const out = [], info = {};
    let doseMg = paraMg(Number(item.dose_valor), item.dose_unidade);
    const uNorm = norm(item.dose_unidade).replace(/\s/g, '');
    if (doseMg == null && /mg\/kg$/.test(uNorm) && P.peso) { doseMg = Number(item.dose_valor) * P.peso; info.calcPeso = true; }
    const t = tomadasDia(item);
    if (doseMg != null) {
      info.doseMg = doseMg;
      if (t) { info.diaMg = doseMg * t; info.tomadas = t; }
      if (P.peso && info.diaMg) info.mgKgDia = info.diaMg / P.peso;
    }
    // conta por peso declarada pela IA
    const pk = item.dose_por_kg;
    if (pk && pk.valor != null && P.peso && doseMg != null) {
      const esperado = paraMg(Number(pk.valor) * P.peso, String(pk.unidade || 'mg').replace(/\/kg.*$/, ''));
      if (esperado) {
        info.esperadoMg = esperado;
        const cap = item.dose_maxima_dia && paraMg(Number(item.dose_maxima_dia.valor), item.dose_maxima_dia.unidade);
        if (doseMg > esperado * 1.2) out.push({ nivel: 'grave', tipo: 'dose', msg: `A dose (${fmt(doseMg)} mg) passa do que dá a conta por peso: ${fmtNum(pk.valor)} ${pk.unidade || 'mg/kg'} × ${fmtNum(P.peso)} kg = ${fmt(esperado)} mg.` });
        else if (doseMg < esperado * 0.8 && !(cap && info.diaMg && info.diaMg >= cap * 0.95)) out.push({ nivel: 'info', tipo: 'dose', msg: `A dose (${fmt(doseMg)} mg) fica abaixo da conta por peso (${fmt(esperado)} mg). Confira se foi limitada de propósito.` });
      }
    }
    if (pk && pk.valor != null && !P.peso) out.push({ nivel: 'grave', tipo: 'dados', msg: 'Dose calculada por peso, mas o peso não foi informado. Informe o peso para conferir.' });
    // tetos
    const nomes = id.farmacos.join(' ') + ' ' + norm(item.farmaco);
    const idoso = P.idade >= 65, velho75 = P.idade > 75;
    for (const T of TETOS) {
      if (!T.re.test(nomes)) continue;
      if (T.doseEV && doseMg != null && /\b(ev|iv|endoven|intraven)/.test(norm(item.via)) && doseMg > T.doseEV)
        out.push({ nivel: 'grave', tipo: 'dose', msg: `Dose EV de ${fmt(doseMg)} mg passa do máximo por dose (${T.doseEV} mg). ${T.fonte}.` });
      const via = norm(item.via), parenteral = /\b(ev|iv|im|endoven|intraven|intramusc)/.test(via), sl = /\b(sl|sublingual)/.test(via);
      const reduzido = idoso || (P.peso && P.peso < 50) || (P.tfg != null && P.tfg < 60);
      let teto = T.dia, porque = '', nivelTeto = T.nivel || 'grave';
      if (T.diaParenteral && parenteral) { teto = T.diaParenteral; porque = ' (via injetável)'; }
      if (T.diaSL && sl) { teto = reduzido ? T.diaSLIdoso : T.diaSL; porque = reduzido ? ' (sublingual; idoso, <50 kg ou função renal reduzida)' : ' (sublingual)'; }
      else if (T.diaIdoso && reduzido) { teto = T.diaIdoso; porque = ' (idoso, peso <50 kg ou função renal reduzida)'; }
      if (T.diaIdoso75 && velho75) { teto = T.diaIdoso75; porque = ' (>75 anos)'; }
      if (T.diaRenal30 && P.tfg != null && P.tfg < 30) { teto = T.diaRenal30; porque = ' (função renal <30)'; }
      if (T.porKgDia && P.peso) teto = Math.min(teto || Infinity, T.porKgDia * P.peso);
      let dia = info.diaMg;
      if (dia != null && T.sal && T.sal[0].test(nomes)) dia = dia * T.sal[1]; // sal → base (naproxeno sódico 550 = 500 de base)
      if (teto && dia != null) {
        const txtSos = item.se_necessario ? ' se usado em todos os horários' : '';
        if (dia > teto * 10) out.push({ nivel: 'grave', tipo: 'dose', msg: `Total de ${fmt(dia)} mg/dia${txtSos} é mais de 10 vezes o teto (${fmt(teto)} mg/dia): provável erro de unidade.` });
        else if (dia > teto * 1.001) out.push({ nivel: nivelTeto, tipo: 'dose', msg: `Total de ${fmt(dia)} mg/dia${txtSos} passa do teto de ${fmt(teto)} mg/dia${porque}. Fonte: ${T.fonte}.` });
        else if (T.diaAlerta && dia > T.diaAlerta * 1.001) out.push({ nivel: 'atencao', tipo: 'dose', msg: `Total de ${fmt(dia)} mg/dia${txtSos} passa da dose usual (${fmt(T.diaAlerta)} mg/dia). Fonte: ${T.fonte}.` });
        else if (dia >= teto * 0.9) out.push({ nivel: 'info', tipo: 'dose', msg: `Total de ${fmt(dia)} mg/dia${txtSos}: no limite do teto (${fmt(teto)} mg/dia${porque}).` });
        if (T.hep && P.hepatica && P.hepatica !== 'normal' && dia > T.hep * 1.001) out.push({ nivel: T.hepNivel || 'atencao', tipo: 'dose', msg: `Total de ${fmt(dia)} mg/dia na cirrose: ${T.hepMsg}.` });
      }
      break;
    }
    if (tem(id, 'metotrexato') && /\b(vo|oral)/.test(norm(item.via)) && Number(item.intervalo_horas) > 0 && Number(item.intervalo_horas) < 168)
      out.push({ nivel: 'grave', tipo: 'dose', msg: 'Metotrexato oral não oncológico é SEMANAL. Tomada diária é erro com óbitos descritos (ISMP Brasil).' });
    // teto declarado pela própria sugestão
    const md = item.dose_maxima_dia;
    if (md && md.valor != null && info.diaMg != null) {
      const mdMg = paraMg(Number(md.valor), md.unidade);
      if (mdMg && info.diaMg > mdMg * 1.001 && !out.some(a => a.tipo === 'dose' && a.nivel === 'grave'))
        out.push({ nivel: 'grave', tipo: 'dose', msg: `Total de ${fmt(info.diaMg)} mg/dia passa do máximo que a própria sugestão indica (${fmt(mdMg)} mg/dia).` });
    }
    // antimicrobiano sem duração; EV sem diluição
    if (tem(id, 'antimicrobiano') && !String(item.duracao || '').trim()) out.push({ nivel: 'atencao', tipo: 'dados', msg: 'Antimicrobiano sem duração definida. Defina o tempo de tratamento ou a data de reavaliação.' });
    if (/\b(ev|iv|endoven|intraven)/.test(norm(item.via)) && tem(id, 'antimicrobiano') && !String(item.diluicao || '').trim()) out.push({ nivel: 'info', tipo: 'dados', msg: 'Antimicrobiano EV sem diluição e tempo de infusão.' });
    return { alertas: out, conta: info };
  }
  const fmtNum = v => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  const fmt = v => v >= 100 ? Math.round(v).toLocaleString('pt-BR') : fmtNum(v);

  /* ---------------- Conjunto: interações e duplicidade ---------------- */
  function checaConjunto(ids, P) {
    // ids: [{id, rotulo, doItem:bool}] incluindo medicações em uso (doItem=false)
    const out = [];
    const com = cls => ids.filter(x => tem(x.id, cls));
    const comRe = re => ids.filter(x => x.id.farmacos.some(f => re.test(f)));
    const nomes = arr => [...new Set(arr.map(x => x.rotulo))].join(', ');
    const par = (a, b) => a.length && b.length && (a.some(x => x.doItem) || b.some(x => x.doItem)) && a.some(x => b.some(y => y !== x));
    const add = (nivel, msg, envolvidos) => out.push({ nivel, tipo: 'interacao', msg, envolvidos: [...new Set(envolvidos.map(x => x.rotulo))] });

    const nitr = com('nitrato'), pde = com('ipde5'), rio = com('riociguate');
    if (par(nitr, pde)) add('grave', `Nitrato com inibidor da PDE-5 (${nomes([...nitr, ...pde])}): hipotensão grave. Contraindicado (intervalo mínimo de 24 h após sildenafila e 48 h após tadalafila).`, [...nitr, ...pde]);
    if (par(rio, [...nitr, ...pde])) add('grave', `Riociguate com nitrato ou inibidor da PDE-5 (${nomes([...rio, ...nitr, ...pde])}): hipotensão grave. Contraindicado.`, [...rio, ...nitr, ...pde]);
    const imao = com('imao_like'), sero = com('serotoninergico').filter(x => !tem(x.id, 'imao_like'));
    if (par(imao, sero)) add('grave', `Síndrome serotoninérgica: ${nomes([...imao, ...sero])}. Linezolida, azul de metileno e IMAO com serotoninérgicos: evitar (FDA 2011).`, [...imao, ...sero]);
    else {
      const s2 = com('serotoninergico');
      if (s2.length >= 2 && s2.some(x => x.doItem) && new Set(s2.map(x => x.rotulo)).size >= 2) add('atencao', `Dois ou mais serotoninérgicos (${nomes(s2)}): vigiar síndrome serotoninérgica.`, s2);
    }
    const est = com('estatina_cyp3a4'), inib = com('inib_cyp3a4_forte');
    if (par(est, inib)) add('grave', `Sinvastatina ou lovastatina com inibidor forte do CYP3A4 (${nomes([...est, ...inib])}): rabdomiólise. Contraindicado; suspenda a estatina durante o tratamento.`, [...est, ...inib]);
    const colc = com('colchicina');
    if (par(colc, inib)) add('grave', `Colchicina com inibidor forte do CYP3A4/P-gp (${nomes([...colc, ...inib])}): toxicidade grave, com óbitos descritos. Contraindicado com disfunção renal ou hepática; nos demais, reduzir muito a dose. Na prática, evitar.`, [...colc, ...inib]);
    const mtx = com('metotrexato'), smx = comRe(/sulfametoxazol|smx|bactrim/);
    if (par(mtx, smx)) add('grave', `Metotrexato com sulfametoxazol-trimetoprima: mielotoxicidade grave. Evitar.`, [...mtx, ...smx]);
    const alop = com('alopurinol'), tiop = com('tiopurina'), febu = com('febuxostate');
    if (par(alop, tiop)) add('grave', `Alopurinol com azatioprina ou mercaptopurina: mielotoxicidade grave. Se indispensável, reduzir a tiopurina a 1/3–1/4.`, [...alop, ...tiop]);
    if (par(febu, tiop)) add('grave', `Febuxostate com azatioprina ou mercaptopurina: contraindicado (mielotoxicidade).`, [...febu, ...tiop]);
    const carb = com('carbapenem'), valp = com('valproato');
    if (par(carb, valp)) add('grave', `Carbapenêmico com valproato: o nível de valproato cai em horas (risco de crise). Evitar a associação.`, [...carb, ...valp]);
    const opi = com('opioide'), bzd = com('benzodiazepinico');
    if (par(opi, bzd)) add('atencao', `Opioide com benzodiazepínico (${nomes([...opi, ...bzd])}): depressão respiratória. Menores doses e monitorização (FDA 2016).`, [...opi, ...bzd]);
    const clop = comRe(/clopidogrel/), ipp = com('ipp_cyp2c19');
    if (par(clop, ipp)) add('atencao', `Clopidogrel com omeprazol ou esomeprazol: reduz o efeito antiagregante. Prefira pantoprazol.`, [...clop, ...ipp]);
    const vanc = comRe(/vancomicina/), pip = comRe(/piperacilina|tazocin/);
    if (par(vanc, pip)) add('info', `Vancomicina com piperacilina-tazobactam: estudos observacionais mostram mais lesão renal; no ensaio ACORN (JAMA 2023) não houve diferença. Monitorar creatinina e nível de vancomicina.`, [...vanc, ...pip]);
    const amg = com('aminoglicosideo'), nef = [...comRe(/vancomicina|anfotericina|polimixina|colistina/), ...com('diuretico_alca')];
    if (par(amg, nef)) add('atencao', `Aminoglicosídeo com outro nefrotóxico ou ototóxico (${nomes([...amg, ...nef])}): monitorar função renal e audição.`, [...amg, ...nef]);
    const qt = com('qt');
    if (new Set(qt.map(x => x.rotulo)).size >= 2 && qt.some(x => x.doItem)) add('atencao', `Dois ou mais fármacos que prolongam o QT (${nomes(qt)}): ECG, potássio e magnésio.`, qt);
    const raas = [...com('ieca'), ...com('bra')], kpoup = com('poupador_k'), kcl = com('potassio'), smxk = smx;
    const hk = [...raas, ...kpoup, ...kcl, ...smxk];
    if (new Set(hk.map(x => x.rotulo)).size >= 2 && hk.some(x => x.doItem)) add(P.tfg != null && P.tfg < 30 ? 'grave' : 'atencao', `Associação que retém potássio (${nomes(hk)})${P.tfg != null && P.tfg < 30 ? ` com TFG ≈ ${P.tfg}` : ''}: dosar potássio.`, hk);
    const aine = com('aine').filter(x => !x.id.farmacos.every(f => /^(aas|acido acetilsalicilico|aspirina)$/.test(f))), diur = [...com('diuretico_alca'), ...com('tiazidico')];
    if (aine.length && raas.length && diur.length && [...aine, ...raas, ...diur].some(x => x.doItem)) add('atencao', `AINE com IECA/BRA e diurético (${nomes([...aine, ...raas, ...diur])}): risco alto de lesão renal aguda.`, [...aine, ...raas, ...diur]);
    const antic = com('anticoagulante'), antiag = com('antiagregante');
    if (par(antic, [...antiag, ...aine])) add('atencao', `Anticoagulante com antiagregante ou AINE (${nomes([...antic, ...antiag, ...aine])}): mais sangramento. Confirme a indicação da associação.`, [...antic, ...antiag, ...aine]);
    const war = comRe(/varfarina|marevan/), pot = comRe(/fluconazol|metronidazol|sulfametoxazol|smx|bactrim|amiodarona|ciprofloxacino|levofloxacino|claritromicina|eritromicina/);
    if (par(war, pot)) add('atencao', `Varfarina com ${nomes(pot)}: o INR sobe. Controle o INR em 3–5 dias ou ajuste a dose.`, [...war, ...pot]);
    const lit = com('litio'), litInt = [...aine, ...raas, ...com('tiazidico')];
    if (par(lit, litInt)) add('atencao', `Lítio com ${nomes(litInt)}: o nível de lítio sobe. Dosar litemia.`, [...lit, ...litInt]);
    const dig = com('digoxina'), digInt = comRe(/amiodarona|verapamil|claritromicina|eritromicina/);
    if (par(dig, digInt)) add('atencao', `Digoxina com ${nomes(digInt)}: o nível de digoxina sobe. Reduzir a dose e dosar.`, [...dig, ...digInt]);

    const parac = com('paracetamol');
    if (new Set(parac.map(x => x.rotulo)).size >= 2 && parac.some(x => x.doItem)) add('atencao', `Paracetamol em mais de uma fonte (${nomes(parac)}): some as doses; o teto de 4 g/dia vale para o total.`, parac);
    const dip = com('pirazolona');
    if (new Set(dip.map(x => x.rotulo)).size >= 2 && dip.some(x => x.doItem)) add('atencao', `Dipirona em mais de uma fonte (${nomes(dip)}): some as doses.`, dip);
    if (P.idade >= 65 && par(aine, [...com('corticoide'), ...antic, ...antiag.filter(x => !aine.includes(x))])) add('atencao', `Idoso com AINE junto de corticoide, anticoagulante ou antiagregante: sangramento digestivo. Beers 2023: evitar.`, [...aine, ...com('corticoide')]);
    // duplicidade (só entre itens sugeridos, ou item sugerido que repete medicação em uso)
    const DUP = [['aine', 'dois AINEs'], ['ipp', 'dois inibidores de bomba'], ['benzodiazepinico', 'dois benzodiazepínicos'], ['anticoagulante', 'dois anticoagulantes'],
      ['ieca', 'dois IECA'], ['bra', 'dois BRA'], ['estatina', 'duas estatinas'], ['isrs', 'dois ISRS'], ['antipsicotico', 'dois antipsicóticos'], ['corticoide', 'dois corticoides sistêmicos']];
    for (const [cls, txt] of DUP) {
      const g = com(cls).filter(x => !(cls === 'aine' && x.id.farmacos.every(f => /^(aas|acido acetilsalicilico|aspirina)$/.test(f))));
      const distintos = new Set(g.map(x => x.rotulo));
      if (distintos.size >= 2 && g.some(x => x.doItem)) add(cls === 'anticoagulante' ? 'grave' : 'atencao', `Duplicidade: ${txt} (${nomes(g)}).` + (cls === 'anticoagulante' ? ' Só se for transição planejada (ex.: heparina até o INR da varfarina chegar ao alvo).' : ''), g);
    }
    if (raas.length && com('ieca').length && com('bra').length && raas.some(x => x.doItem)) add('grave', `IECA com BRA (${nomes(raas)}): duplo bloqueio aumenta hipercalemia e lesão renal sem benefício. Evitar.`, raas);
    const beta = [...com('penicilina'), ...com('cefalosporina'), ...com('carbapenem')];
    if (new Set(beta.map(x => x.rotulo)).size >= 2 && beta.some(x => x.doItem)) add('atencao', `Dois betalactâmicos (${nomes(beta)}): em geral redundante. Confirme a indicação.`, beta);
    // o mesmo fármaco já em uso
    const doItem = ids.filter(x => x.doItem), emUso = ids.filter(x => !x.doItem);
    for (const a of doItem) for (const b of emUso) if (a.id.farmacos.some(f => b.id.farmacos.includes(f))) add('atencao', `${a.rotulo} já está nas medicações em uso. Evite dose dobrada.`, [a, b]);
    return out;
  }

  /* ---------------- Entrada principal ---------------- */
  function conferir(itens, paciente, emUsoTexto) {
    const P = Object.assign({}, paciente || {});
    // KDIGO 2024: para dose de fármaco, TFG desindexada (mL/min) = TFG CKD-EPI × superfície corporal / 1,73
    if (P.tfg != null && P.altura > 0 && P.peso > 0) {
      const sc = Math.sqrt(P.altura * P.peso / 3600);
      P.tfgIndexada = P.tfg; P.tfgDesindexada = Math.round(P.tfg * sc / 1.73); P.tfg = P.tfgDesindexada;
    }
    const al = parseAlergias(P.alergias);
    const res = { itens: [], conjunto: [], resumo: { grave: 0, atencao: 0, info: 0 }, alergias: al };
    const ids = [];
    (itens || []).forEach((item, i) => {
      const id = identifica(item.farmaco);
      const alertas = [];
      alertas.push(...checaAlergia(id, item.farmaco, al));
      const d = contaDose(id, item, P);
      alertas.push(...d.alertas);
      alertas.push(...checaRenal(id, item, P));
      alertas.push(...checaHepatica(id, P));
      alertas.push(...checaGestacao(id, item, P));
      alertas.push(...checaIdoso(id, item, P));
      alertas.push(...altaVigilancia(id, item));
      if (!id.farmacos.length) alertas.push({ nivel: 'info', tipo: 'dados', msg: 'Fármaco fora da base de conferência: alergia, interações e teto não foram checados por regra.' });
      res.itens.push({ i, farmacos: id.farmacos, classes: [...id.classes], alertas: dedup(alertas), conta: d.conta });
      ids.push({ id, rotulo: item.farmaco, doItem: true, i });
    });
    String(emUsoTexto || '').split(/\n|;|,(?![^(]*\))/).map(s => s.trim()).filter(Boolean).forEach(s => {
      const id = identifica(s);
      if (id.farmacos.length) ids.push({ id, rotulo: s.replace(/\s+\d.*$/, '') || s, doItem: false });
    });
    res.conjunto = checaConjunto(ids, P);
    // distribui os alertas do conjunto também nos itens envolvidos
    for (const c of res.conjunto) {
      for (const x of ids) if (x.doItem && c.envolvidos.includes(x.rotulo)) res.itens[x.i].alertas.push({ nivel: c.nivel, tipo: 'interacao', msg: c.msg, doConjunto: true });
    }
    for (const it of res.itens) { it.alertas = dedup(it.alertas); it.nivel = pior(it.alertas); }
    for (const it of res.itens) for (const a of it.alertas) if (!a.doConjunto) res.resumo[a.nivel]++;
    for (const c of res.conjunto) res.resumo[c.nivel]++;
    if (P.alergias == null || String(P.alergias).trim() === '') res.faltaAlergia = true;
    return res;
  }
  const ORD = { grave: 3, atencao: 2, info: 1, ok: 0 };
  const pior = arr => arr.reduce((m, a) => (ORD[a.nivel] > ORD[m] ? a.nivel : m), 'ok');
  function dedup(arr) { const s = new Set(); return arr.filter(a => { const k = a.nivel + a.msg; if (s.has(k)) return false; s.add(k); return true; }).sort((a, b) => ORD[b.nivel] - ORD[a.nivel]); }

  function tfgCkdEpi2021(idade, sexo, creat) {
    if (!idade || !creat || creat <= 0 || !sexo) return null;
    const f = (sexo === 'F'), k = f ? 0.7 : 0.9, al = f ? -0.241 : -0.302;
    const v = 142 * Math.pow(Math.min(creat / k, 1), al) * Math.pow(Math.max(creat / k, 1), -1.200) * Math.pow(0.9938, idade) * (f ? 1.012 : 1);
    return (isFinite(v) && v > 0) ? Math.round(v) : null;
  }

  function tfgDesindexada(tfg, altura, peso) { if (tfg == null || !(altura > 0) || !(peso > 0)) return null; return Math.round(tfg * Math.sqrt(altura * peso / 3600) / 1.73); }
  const API = { conferir, tfgDesindexada, identifica, parseAlergias, paraMg, tfgCkdEpi2021, norm, _TETOS: TETOS, _CLASSES: CLASSES };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.CVSeg = API;
})(typeof window !== 'undefined' ? window : globalThis);
