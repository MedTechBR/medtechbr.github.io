/* MedTech PWA: a conduta como o app de iPhone a lê.
   Port de MarkdownConduta.swift (parser), OrganizaConduta.swift (tópicos, doses, ligações) e FormasConduta.swift
   (forma visual de cada bloco). Só apresentação: nenhum caractere do banco muda, nenhuma regra clínica é decidida aqui.
   Expõe window.MTConduta. */
(function () {
  'use strict';
  var W = window;
  var esc = function (s) { return W.MTUI.esc(s); };

  /* ---------------- texto ---------------- */
  function normal(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  function semEmoji(s) { return String(s || '').replace(/\p{Emoji_Presentation}|\uFE0F|\u23F1|\u26A0/gu, '').trim(); }
  function plano(i) { return i.filter(function (t) { return !t.selo; }).map(function (t) { return t.t; }).join(''); }
  var ehLetra = function (c) { return /[\p{L}\p{N}]/u.test(c || ''); };
  var ehEspaco = function (c) { return /\s/.test(c || ''); };

  /* Doses: a mesma expressão de condutai-didatica.js (número + unidade de dose; não pega mg/dL nem mEq/L). */
  var NUM = '(?:\\d{1,3}(?:\\.\\d{3})+|\\d+)(?:[.,]\\d+)?';
  var SEP = '\\s*(?:[-–—]|a|até|ou|/)\\s*';
  var UNI = '(?:mcg|µg|μg|mg|g|UI|U|mEq|mmol|ng|J|gotas|gts|microgotas|mL(?=\\/kg)|ml(?=\\/kg))';
  var POR = '(?:\\/(?:kg|h|hora|min|dia|d|m²|m2|dose|semana|sem))*';
  var DOSE = '(?<![\\w,./])' + NUM + '(?:' + SEP + NUM + ')*\\s?' + UNI + POR + '(?![\\w/²])';
  function achaDoses(t) {
    var re = new RegExp(DOSE, 'g'), out = [], m;
    while ((m = re.exec(t))) {
      if (/mL/i.test(m[0]) && /[<>≤≥]\s*$/.test(t.slice(Math.max(0, m.index - 3), m.index))) continue;
      out.push({ i: m.index, f: m.index + m[0].length });
    }
    return out;
  }
  function temDose(t) { return achaDoses(t).length > 0; }

  var RE_ALERTA = /^(erro|nao|nunca|evite|evitar|armadilha|cuidado|esquecer)\b/;
  var RE_AVISO = /^(erro|atencao|cuidado)\b/;
  function casa(re, t) { var n = normal(t).trim().replace(/^[^\p{L}\p{N}]+/u, ''); return re.test(n); }
  function eAlerta(t) { return casa(RE_ALERTA, t); }
  function eAviso(i) {
    if (plano(i).indexOf('⚠') === 0) return true;
    var p = i.filter(function (t) { return t.t.trim(); })[0];
    return !!(p && p.b && casa(RE_AVISO, p.t));
  }

  /* ---------------- inline: **negrito**, *itálico*, `código`, [link](http), <br> ---------------- */
  function ate(c, i, m) { if (i + m.length > c.length) return false; for (var k = 0; k < m.length; k++) if (c[i + k] !== m[k]) return false; return true; }
  function fecha(c, ini, marca) {
    if (ini >= c.length || ehEspaco(c[ini])) return -1;
    for (var i = ini + 1; i < c.length; i++) {
      if (ate(c, i, marca) && !ehEspaco(c[i - 1])) {
        var f = i;
        while (f + marca.length < c.length && c[f + marca.length] === '*') f++;   // em "****" fecha no último par
        return f;
      }
    }
    return -1;
  }
  function podeAbrirItalico(c, i) {
    if (!(i + 1 < c.length) || ehEspaco(c[i + 1]) || c[i + 1] === '*') return false;
    if (i > 0 && ehLetra(c[i - 1])) return false;
    return true;
  }
  function fechaItalico(c, ini) {
    for (var i = ini; i < c.length; i++) {
      if (c[i] === '\n') return -1;
      if (c[i] === '*' && !ehEspaco(c[i - 1])) {
        if (ate(c, i, '**')) { i++; continue; }
        if (i + 1 < c.length && ehLetra(c[i + 1])) continue;
        return i;
      }
    }
    return -1;
  }
  function link(c, i) {
    var f = c.indexOf(']', i + 1);
    if (f < 0 || f + 1 >= c.length || c[f + 1] !== '(') return null;
    var g = c.indexOf(')', f + 2);
    if (g < 0) return null;
    var url = c.slice(f + 2, g).join('');
    if (url.indexOf('http') !== 0) return null;
    return { texto: c.slice(i + 1, f), url: url, fim: g + 1 };
  }
  var SIMPLES = ['b', 'strong', 'i', 'em', 'u', 'small', 'sup', 'sub', 'span'];
  function etiqueta(c, i) {
    var f = c.indexOf('>', i);
    if (f < 0 || f - i > 10) return null;
    var t = c.slice(i + 1, f).join('').toLowerCase().trim();
    if (t === 'br' || t === 'br/' || t === 'br /') return { troca: '\n', fim: f + 1 };
    var nome = t.charAt(0) === '/' ? t.slice(1) : t;
    if (SIMPLES.indexOf(nome) >= 0) return { troca: '', fim: f + 1 };
    return null;
  }
  function varre(c, b, it) {
    var saida = [], buf = '', i = 0;
    var desc = function () { if (buf) { saida.push({ t: buf, b: b, i: it }); buf = ''; } };
    while (i < c.length) {
      var ch = c[i], f, r;
      if (ch === '\\' && c[i + 1] === '*') { buf += '*'; i += 2; continue; }   // asterisco escapado é texto
      if (ch === '*') {
        if (ate(c, i, '***') && (f = fecha(c, i + 3, '***')) >= 0) { desc(); saida = saida.concat(varre(c.slice(i + 3, f), true, true)); i = f + 3; continue; }
        if (ate(c, i, '**') && (f = fecha(c, i + 2, '**')) >= 0) { desc(); saida = saida.concat(varre(c.slice(i + 2, f), true, it)); i = f + 2; continue; }
        if (!ate(c, i, '**') && podeAbrirItalico(c, i) && (f = fechaItalico(c, i + 1)) >= 0) { desc(); saida = saida.concat(varre(c.slice(i + 1, f), b, true)); i = f + 1; continue; }
      } else if (ch === '`' && (f = c.indexOf('`', i + 1)) > i + 1) {
        desc(); saida.push({ t: c.slice(i + 1, f).join(''), b: b, i: it, c: true }); i = f + 1; continue;
      } else if (ch === '[' && (r = link(c, i))) {
        desc(); varre(r.texto, b, it).forEach(function (x) { x.link = r.url; saida.push(x); }); i = r.fim; continue;
      } else if (ch === '<' && (r = etiqueta(c, i))) {
        buf += r.troca; i = r.fim; continue;
      }
      buf += ch; i++;
    }
    desc();
    return saida;
  }
  function mesmo(a, b) { return !!a.b === !!b.b && !!a.i === !!b.i && !!a.c === !!b.c && a.link === b.link && !a.selo && !b.selo; }
  function inline(s) {
    var r = [];
    varre(Array.from(String(s)), false, false).forEach(function (p) {
      if (!p.t) return;
      var u = r[r.length - 1];
      if (u && mesmo(u, p)) u.t += p.t; else r.push(p);
    });
    return r;
  }

  /* ---------------- blocos ---------------- */
  function eRegra(l) { return l.length >= 3 && (/^-+$/.test(l) || /^_+$/.test(l) || /^\*+$/.test(l)); }
  function eSeparador(l) { var t = l.trim(); return t.indexOf('-') >= 0 && /^[|:\- \t]+$/.test(t); }
  function marcaLista(bruta) {
    var recuo = /^[ \t]*/.exec(bruta)[0].length, l = bruta.slice(recuo);
    var nivel = recuo >= 2 ? (recuo >= 5 ? 2 : 1) : 0;
    var ms = ['- ', '* ', '• '];
    for (var k = 0; k < ms.length; k++) if (l.indexOf(ms[k]) === 0 && l.indexOf('** ') !== 0) return { nivel: nivel, marca: null, resto: l.slice(2) };
    var m = /^(\d{1,3})([.)]) /.exec(l);
    if (m) return { nivel: nivel, marca: m[1] + m[2], resto: l.slice(m[0].length) };
    return null;
  }
  function comecaBloco(bruta) {
    var l = bruta.trim();
    if (!l) return true;
    if (/^(#|##|###|####) /.test(l)) return true;
    if (l.indexOf('```') === 0 || l.charAt(0) === '>' || l.charAt(0) === '|') return true;
    return eRegra(l) || !!marcaLista(bruta);
  }
  function limpaTitulo(t) { return t.trim().replace(/\*\*/g, ''); }
  function ajusta(l, n) {
    var r = l.slice();
    while (r.length < n) r.push([]);
    if (r.length > n && n > 0) {
      var ult = r[n - 1].slice();
      r.slice(n).forEach(function (x) { ult.push({ t: ' ' }); ult = ult.concat(x); });
      r = r.slice(0, n); r[n - 1] = ult;
    }
    return r;
  }

  function documento(md) {
    var linhas = String(md || '').replace(/\r\n/g, '\n').split('\n'), i = 0;
    var abertura = [], secoes = [], titulo = null, atual = [];
    function fechaSecao() {
      if (titulo != null) secoes.push({ id: secoes.length, titulo: titulo, blocos: atual, tipo: tipoSecao(titulo) });
      else abertura = atual;
      atual = [];
    }
    function cerca(abre) {
      var tipo = abre.slice(3).trim().toLowerCase(), corpo = [];
      i++;
      while (i < linhas.length && linhas[i].trim().indexOf('```') !== 0) corpo.push(linhas[i++]);
      i++;
      var fonte = corpo.join('\n').trim();
      return tipo === 'mermaid' ? { k: 'fluxo', fonte: fonte } : { k: 'par', i: [{ t: fonte, c: true }] };
    }
    function tabela() {
      var cru = [];
      while (i < linhas.length && linhas[i].trim().charAt(0) === '|') cru.push(linhas[i++].trim());
      var cel = function (l) { var s = l; if (s.charAt(0) === '|') s = s.slice(1); if (s.slice(-1) === '|') s = s.slice(0, -1); return s.split('|').map(function (x) { return inline(x.trim()); }); };
      if (cru.length >= 2 && eSeparador(cru[1])) {
        var cab = cel(cru[0]);
        return { k: 'tab', cab: cab, linhas: cru.slice(2).filter(function (l) { return !eSeparador(l); }).map(cel).map(function (l) { return ajusta(l, cab.length); }) };
      }
      var corpo = cru.filter(function (l) { return !eSeparador(l); }).map(cel);
      var larg = Math.max.apply(null, corpo.map(function (l) { return l.length; }).concat([1]));
      return { k: 'tab', cab: [], linhas: corpo.map(function (l) { return ajusta(l, larg); }) };
    }
    function citacao() {
      var partes = [];
      while (i < linhas.length && linhas[i].trim().charAt(0) === '>') partes.push(inline(linhas[i++].trim().slice(1).trim()));
      return { k: 'cita', partes: partes };
    }
    function lista() {
      var itens = [];
      while (i < linhas.length) {
        var b = linhas[i], m = marcaLista(b);
        if (m) { itens.push({ nivel: m.nivel, marca: m.marca, i: inline(m.resto.trim()) }); i++; }
        else if (itens.length && !comecaBloco(b) && b.indexOf('  ') === 0) {   // continuação recuada do item anterior
          var u = itens[itens.length - 1]; u.i = u.i.concat([{ t: '\n' }], inline(b.trim())); i++;
        } else break;
      }
      return { k: 'lista', itens: itens };
    }
    function paragrafo() {
      var partes = [linhas[i++].trim()];
      while (i < linhas.length && !comecaBloco(linhas[i])) partes.push(linhas[i++].trim());
      return { k: 'par', i: inline(partes.join('\n')) };
    }
    while (i < linhas.length) {
      var bruta = linhas[i], l = bruta.trim();
      if (!l) { i++; continue; }
      var b = null;
      if (l.indexOf('```') === 0) b = cerca(l);
      else if (l.indexOf('## ') === 0 || l === '##') { i++; if (titulo != null || atual.length) fechaSecao(); titulo = limpaTitulo(l.slice(2)); continue; }
      else if (l.indexOf('#### ') === 0) { i++; b = { k: 'sub', i: inline(limpaTitulo(l.slice(4))) }; }
      else if (l.indexOf('### ') === 0) { i++; b = { k: 'sub', i: inline(limpaTitulo(l.slice(3))) }; }
      else if (l.indexOf('# ') === 0) { i++; b = { k: 'sub', i: inline(limpaTitulo(l.slice(1))) }; }
      else if (eRegra(l)) { i++; b = { k: 'regra' }; }
      else if (l.charAt(0) === '|') b = tabela();
      else if (l.charAt(0) === '>') b = citacao();
      else if (marcaLista(bruta)) b = lista();
      else b = paragrafo();
      atual.push(b);
    }
    fechaSecao();
    return { abertura: abertura, secoes: secoes };
  }

  /* Tipo da seção: mesma classificação de condutai-didatica.js (as fortes vencem; nas demais, a palavra que vem primeiro). */
  var TIPOS = [
    ['perolas', 'perola|erros comuns'], ['internar', 'quando internar|internac|quando encaminhar|encaminhar|quando operar|\\buti\\b|terapia intensiva'],
    ['diferencial', 'diferencia'], ['tratamento', 'tratamento|conduta|manejo|abordagem terap|terapeutica|\\bterapia\\b|prescric|antibioticoterapia|analgesia'],
    ['complicacoes', 'complica|efeitos adversos|toxicidade'], ['seguimento', 'seguimento|\\balta\\b|acompanhamento|prognostico|orientac'],
    ['populacoes', 'popula|situacoes especiais|grupos especiais|gestante|gestacao|pediatri'], ['sus', '\\bsus\\b|brasil|disponibilidade'],
    ['epidemio', 'epidemiolog|magnitude|incidencia|prevalencia|fatores de risco'], ['fisio', 'fisiopatolog|etiolog|causas|mecanismo|agente|conceito|visao geral|genetica|definic|farmacolog'],
    ['classificacao', 'classifica|gravidade|estratifica|estadiamento|escore'], ['diagnostico', 'diagnost|exames|investigac|avaliac|criterios|imagem|laborat'],
    ['apresentacao', 'apresenta|\\bquadro\\b|reconhecimento|quando suspeitar|sinais e sintomas|exame fisico|historia clinica'], ['fluxo', 'fluxograma|algoritmo']
  ].map(function (x) { return [x[0], new RegExp(x[1])]; });
  var FORTES = { perolas: 1, internar: 1, diferencial: 1 };
  function tipoSecao(titulo) {
    var t = normal(titulo), melhor = null, pos = Infinity;
    for (var k = 0; k < TIPOS.length; k++) {
      var m = TIPOS[k][1].exec(t);
      if (!m) continue;
      if (FORTES[TIPOS[k][0]]) return TIPOS[k][0];
      if (m.index < pos) { pos = m.index; melhor = TIPOS[k][0]; }
    }
    return melhor;
  }

  /* ---------------- tópicos fixos, sempre nesta ordem ---------------- */
  var TOPICOS = [
    ['tratamento', 'Tratamento', 'first-aid-kit'], ['fluxogramas', 'Fluxogramas', 'git-fork'], ['prescricao', 'Prescrição', 'pills'],
    ['diagnostico', 'Diagnóstico', 'stethoscope'], ['quadro', 'Quadro clínico', 'id-badge-2'], ['internacao', 'Internação e alta', 'bed'],
    ['complicacoes', 'Complicações', 'alert-triangle'], ['populacoes', 'Populações especiais', 'users'], ['perolas', 'Pérolas', 'bulb'],
    ['entender', 'Entender a doença', 'book'], ['outros', 'Outros', 'dots-circle-horizontal']
  ].map(function (x) { return { id: x[0], nome: x[1], icone: x[2] }; });
  var ORDEM = TOPICOS.map(function (t) { return t.id; });

  /* Vence a palavra que aparece primeiro no título; em empate, a ordem desta lista. */
  var REGRAS = [
    ['tratamento', '^tratamento|tratamento |\\bconduta\\b|^manejo|manejo (do|da|cronico|clinico|pressorico|intensivo|perioperatorio|cardiovascular|escalonado)|^abordagem terapeutica|\\bdoses?\\b|reperfusao|fibrinolise|trombolise|trombectomia|primeiras? horas?|ressuscitacao|desressuscitacao|antidotos?\\b|soroterapia|antibiotico|antibioticoterapia|antitromboticos|anticoagulacao|analgesi|escada analgesica|opioterapia|prescri|esquemas? |profilaxia|quimioprofilaxia|^terapias?|desprescricao|\\bterapia\\b|^insulina|^dialise: |transfusao|plasmaferese|tranquilizacao|contencao|^refratario|refrataria|reversao|hipotensao permissiva|reaquecimento|resfriamento|descontaminacao|^suporte|^abordagem inicial|^abordagem$|^abordagem na|avaliacao primaria|imediata|^sequencia|^descongestao|^ritmo|^controle de sintomas|^\\d+\\) '],
    ['internacao', '^depois d|quando (internar|encaminhar|operar|dialisar|escalonar|interromper)|internacao|^internar|\\buti\\b|seguimento|^alta\\b|alta[,:]|criterios de alta|convalescenca|reabilitacao|onde (tratar|cuidar)|orientac|^prevencao|prevencao d[ea] |prevencao$|^vacinacao'],
    ['complicacoes', '^manejo das complicac|complicac|efeitos adversos|eventos adversos|toxicidade|sequelas?\\b|^emergencias|sangramento e reversao'],
    ['populacoes', 'populac|situacoes especiais|cenarios especiais|situacoes particulares|na gestante|gestacao|gestante|trauma no idoso|hipotermia no trauma|crianca|nota pediatrica|imunossuprimido|imunossupressao'],
    ['diagnostico', 'diagnostic|\\bexames?\\b|diferenci|^avaliacao|avaliacao (inicial|e |antes|nesta|sistematica|multifatorial|de risco)|classifica|gravidade|estratifica|estadiamento|\\bescores?\\b|escalas?\\b|criterios|investiga|imagem|neuroimagem|rastre|interpret|\\becg\\b|hemocultura|liquor|probabilidade|bandeiras vermelhas|sinais de alarme|d-dimero|biopsia|^tipos|^fases|estagios|^padroes|fenotipos|perfis clinicos|marcadores|^graus|^excluir|^descartar|causas a excluir|reticulocitos|como se fecha|como decidir|^separando'],
    ['quadro', 'apresenta|\\bquadro\\b|reconhec|quando suspeitar|quando pensar|sinais e sintomas|manifestac|formas clinicas|^formas|historia clinica|^sintomas|^curso e apresentacao'],
    ['entender', 'fisiopatolog|etiolog|^causas|causas |mecanismo|^agente|conceito|visao geral|genetica|definic|farmacolog|epidemiolog|contexto|\\bsus\\b|brasil|fatores de risco|^fatores|microbiologia|homeostase|por que mata|do que estamos falando|^precipitantes|^gatilhos|nomenclatura|^evidencia|prognostico|^curso\\b']
  ].map(function (x) { return [x[0], new RegExp(x[1])]; });

  /* Títulos reais cujo assunto é claro, mas sem palavra-chave que dê para generalizar. */
  var EXATOS = (function () {
    var m = {};
    ['bicarbonato — quando nao dar (que e quase sempre)', 'monitorizacao nas primeiras 24 horas', 'resolucao, transicao para sc e correcao da agua livre',
      'intermediario-alto: nao trombolisar de rotina', 'duracao', 'estavel — controle de fc', 'reacao ao soro: como prevenir e como tratar',
      'como executar as manobras terapeuticas', 'inibidores de sglt2 na pratica', 'finerenona: quando e como', 'agonistas de glp-1 e o quinto pilar',
      'metadona × buprenorfina', 'ect: indicacoes e pratica', 'via subcutanea e infusao continua', 'como e um desmame na pratica', 'escolha da droga por cenario',
      'ventilacao nao invasiva na pratica', 'marca-passo temporario e definitivo', 'pos-pcr (rce)', 'a cada 2 min', 'metodos de aumento de eliminacao',
      'escarotomia, fasciotomia e sindrome compartimental', 'fasciotomia: tecnica, timing e fechamento', 'antiagregantes e anticoagulantes na dengue',
      'indicacoes e contraindicacoes', 'ajuste pratico e monitorizacao', 'escolha do suporte pelo tipo de falencia', 'reavaliacao hora a hora', 'tabela de medidas',
      'monitorizacao da hipoglicemia pos-insulina', 'a sequencia alfa antes de beta — e por que inverter e desastre', 'abstinencia leve fora do hospital',
      'falha terapeutica e adesao', 'falha terapeutica e retratamento', 'corrigir a causa reversivel — nao e so prescrever antiemetico',
      'diureticos, corticoide e medidas de suporte — o que a evidencia sustenta', 'metadona e dor irruptiva — dois pontos que exigem cuidado',
      'como contornar os obstaculos da titulacao', 'alergia a penicilina e dessensibilizacao', 'quando nao indicar flebotomia', 'decisao sobre o antiparasitario',
      'refratariedade e escalonamento', 'procedimentos para a dor da fratura e prevencao de novos eventos'].forEach(function (t) { m[t] = 'tratamento'; });
    ['localizacao eletrocardiografica e o que ela preve', 'toxindromes', 'anion-gap e gap osmolar como ferramenta', 'lendo a resposta a adenosina',
      'desmascarando a taquicardia regular de ~150 bpm', 'proteinuria nefrotica versus nefritica', 'achados tubulares que denunciam o intersticio',
      'como o complemento organiza o raciocinio', 'emergencia × urgencia'].forEach(function (t) { m[t] = 'diagnostico'; });
    m['reacao bifasica — o que a evidencia realmente mostra'] = 'quadro';
    return m;
  })();

  function topicoDe(titulo) {
    var t = normal(semEmoji(titulo));
    if (/perolas|erros comuns|armadilhas? letais/.test(t)) return 'perolas';
    if (EXATOS[t]) return EXATOS[t];
    if (t.indexOf('fluxo') === 0) {
      if (/diagnost|investig|etiolog|leitura|interpret|shift|poliuria|dor cervical/.test(t)) return 'diagnostico';
      if (t.indexOf('seguimento') >= 0) return 'internacao';
      if (/crise|choque|controle|refrataria|realimentacao|pos-operatorio|dia de doenca|profilaxia|contato|gestante|piora|resposta|imunossupressao|comprometimento pulmonar|decisao/.test(t)) return 'tratamento';
      return 'outros';
    }
    var melhor = null, pos = Infinity;
    REGRAS.forEach(function (r) { var m = r[1].exec(t); if (m && m.index < pos) { pos = m.index; melhor = r[0]; } });
    return melhor || 'outros';
  }

  /* Título "Fisiopatologia — por que o VD falha": sem mudar palavra, a segunda parte vira subtítulo. */
  function tituloPartido(cru) {
    var l = semEmoji(cru), k = l.indexOf(' — ');
    return k >= 0 ? { principal: l.slice(0, k), sub: l.slice(k + 3) } : { principal: l, sub: null };
  }

  /* ---------------- ligações: selo de bula e links entre condutas ---------------- */
  function marcador(excluir) {
    var D = W.MTDados, lig = D.ligacoes, re = lig && lig.fonte ? (marcador._re || (marcador._re = new RegExp(lig.fonte, 'gi'))) : null;
    var usados = {}, links = 0, porSecao = {};
    function ligaCondutas(t) {
      if (links >= 8 || t.t.trim().length <= 3 || !re) return [t];
      var pedacos = [], ult = 0, m;
      re.lastIndex = 0;
      while ((m = re.exec(t.t))) {
        if (links >= 8) break;
        var id = lig.porApelido[m[0].toLowerCase()];
        if (!id || id === excluir || usados[id]) continue;
        if (m.index > ult) pedacos.push(Object.assign({}, t, { t: t.t.slice(ult, m.index) }));
        pedacos.push(Object.assign({}, t, { t: m[0], link: 'conduta:' + id }));
        ult = m.index + m[0].length; usados[id] = 1; links++;
      }
      if (!pedacos.length) return [t];
      if (ult < t.t.length) pedacos.push(Object.assign({}, t, { t: t.t.slice(ult) }));
      return pedacos;
    }
    function anotaInline(i, secao) {
      var saida = [];
      i.forEach(function (t) {
        if (t.c || t.link) { saida.push(t); return; }
        if (t.b) {
          var b = D.bulaPara(t.t);
          if (b && !porSecao[secao + '|' + b.id]) {
            porSecao[secao + '|' + b.id] = 1;   // um selo por remédio em cada seção: marcar todas as menções vira ruído
            var nome = Object.assign({}, t, { link: 'bula:' + b.id });
            saida.push(nome, { t: 'bula', link: nome.link, selo: true });
            return;
          }
        }
        saida = saida.concat(ligaCondutas(t));
      });
      return saida;
    }
    return function anota(blocos, secao) {
      return blocos.map(function (b) {
        if (b.k === 'par') return { k: 'par', i: anotaInline(b.i, secao) };
        if (b.k === 'lista') return { k: 'lista', itens: b.itens.map(function (x) { return { nivel: x.nivel, marca: x.marca, i: anotaInline(x.i, secao) }; }) };
        if (b.k === 'cita') return { k: 'cita', partes: b.partes.map(function (p) { return anotaInline(p, secao); }) };
        if (b.k === 'tab') return { k: 'tab', cab: b.cab, linhas: b.linhas.map(function (l) { return l.map(function (c) { return anotaInline(c, secao); }); }) };
        return b;
      });
    };
  }

  /* Corte de frase igual ao do site: . ! ? seguido de espaço e maiúscula ou número. */
  function frases(t) {
    var re = /[.!?](?=\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ*"(\d])/g, r = [], pos = 0, m;
    while ((m = re.exec(t))) { r.push(t.slice(pos, m.index + 1)); pos = m.index + 1; }
    r.push(t.slice(pos));
    return r;
  }

  function parseFluxo(fonte) {
    if (!W.CVD || !W.CVD.parseFluxo) return null;
    try { return W.CVD.parseFluxo(fonte); } catch (e) { return null; }
  }

  /* A conduta organizada: abertura, seções por tópico, doses citadas, fluxogramas e formas. */
  function conta(md, id) {
    var doc = documento(md);
    var org = doc.secoes.map(function (s) { return { s: s, topico: topicoDe(s.titulo) }; });
    var ordenadas = [];
    ORDEM.forEach(function (t) { org.forEach(function (o) { if (o.topico === t) ordenadas.push(o); }); });
    var anota = marcador(id);
    var abertura = anota(doc.abertura, -1);
    var secoes = ordenadas.map(function (o) {
      return { id: o.s.id, titulo: o.s.titulo, tipo: o.s.tipo, topico: o.topico, blocos: anota(o.s.blocos, o.s.id) };
    });
    var doses = [], vistos = {};
    var add = function (t, s, b) { t = t.trim(); if (!t || vistos[t]) return; vistos[t] = 1; doses.push({ secao: s, bloco: b, texto: t }); };
    secoes.forEach(function (o) {
      o.blocos.forEach(function (b, bi) {
        if (b.k === 'par') frases(plano(b.i)).forEach(function (f) { if (temDose(f)) add(f, o.id, bi); });
        else if (b.k === 'lista') b.itens.forEach(function (it) { var p = plano(it.i); if (temDose(p)) add(p, o.id, bi); });
        else if (b.k === 'tab') b.linhas.forEach(function (l) {
          // cada célula leva o nome da coluna: fora da tabela, "Não" sozinho não diz nada
          var partes = l.map(function (cel, c) {
            var v = plano(cel); if (!v) return null;
            if (!(c > 0 && c < b.cab.length)) return v;
            var cab = plano(b.cab[c]); return cab ? cab + ': ' + v : v;
          }).filter(Boolean);
          var t = partes.join(' · ');
          if (temDose(t)) add(t, o.id, bi);
        });
      });
    });
    var fluxos = [], formas = {};
    secoes.forEach(function (o) {
      formas[o.id] = classificar(o);
      o.blocos.forEach(function (b) {
        if (b.k !== 'fluxo') return;
        var g = parseFluxo(b.fonte);
        if (g) fluxos.push({ id: fluxos.length, grafo: g, fonte: b.fonte, titulo: tituloPartido(o.titulo).principal, secao: o.id });
      });
    });
    var topicos = ORDEM.filter(function (t) {
      return t === 'prescricao' || (t === 'fluxogramas' && fluxos.length) || secoes.some(function (s) { return s.topico === t; });
    });
    return { abertura: abertura, secoes: secoes, doses: doses, fluxos: fluxos, formas: formas, topicos: topicos,
      secoesDe: function (t) { return secoes.filter(function (s) { return s.topico === t; }); } };
  }

  /* ---------------- formas: só pela estrutura do texto, nunca pelo sentido clínico ---------------- */
  function agrupar(itens) {
    var r = [], atual = null, filhos = [];
    itens.forEach(function (i) {
      if (i.nivel > 0 && atual) filhos.push(i);
      else { if (atual) r.push({ item: atual, filhos: filhos }); atual = i; filhos = []; }
    });
    if (atual) r.push({ item: atual, filhos: filhos });
    return r;
  }
  /* "**Termo:** texto": devolve os trechos do título e do corpo. */
  function termo(i) {
    var fim = 0;
    while (fim < i.length && (i[fim].b || i[fim].selo)) fim++;
    if (!fim || fim >= i.length) return null;
    var tit = i.slice(0, fim), corpo = i.slice(fim), t = plano(tit).trim(), c = plano(corpo).trim();
    if (!t || t.length > 70 || !c) return null;
    return (/[:.]$/.test(t) || c.charAt(0) === ':') ? { titulo: tit, corpo: corpo } : null;
  }
  function comeca(i) { var p = i[0]; return !!(p && p.b && /^\d{1,2}[.)]\s/.test(p.t)); }
  function faixa(cel) {
    var t = normal(plano(cel)).trim();
    if (t.length > 40 || t.indexOf('nao ') >= 0 || t.indexOf('sem ') >= 0) return null;
    var base = t.replace(/[().:*,;\/-]/g, ' ').split(' ').filter(Boolean), p = base[0];
    if (!p) return null;
    if (p === 'leve' || p === 'leves') return 'leve';
    if (p === 'moderada' || p === 'moderado') return 'moderada';
    if (p === 'grave' || (p === 'muito' && base[1] === 'grave')) return 'grave';
    return null;
  }
  function temFaixas(t) { return t.linhas.filter(function (l) { return faixa(l[0] || []); }).length >= 2; }
  var RE_CRIT = /criterio|escore|sinais de alarme|bandeiras vermelhas|sinais de alerta|sinais de gravidade|indicacoes|contraindicacoes|quando internar/;

  function classificar(s) {
    var r = [], cab = normal(s.titulo), dif = s.tipo === 'diferencial', bl = s.blocos, top = s.topico, i = 0;
    var f = function (tipo, ini, fim) { r.push({ tipo: tipo, blocos: bl.slice(ini, fim), id: ini }); };
    while (i < bl.length) {
      var b = bl[i];
      if (b.k === 'sub') { cab = normal(plano(b.i)); f('texto', i, i + 1); }
      else if (b.k === 'par') {
        var p = b.i, fim;
        if (eAviso(p) && top !== 'perolas') f('aviso', i, i + 1);
        else if (comeca(p)) {
          // parágrafos seguidos que abrem com "1." são passos
          fim = i + 1; while (fim < bl.length && bl[fim].k === 'par' && comeca(bl[fim].i)) fim++;
          if (fim - i >= 2) { f('linhaDoTempo', i, fim); i = fim; continue; }
          f('texto', i, i + 1);
        } else if (top !== 'perolas' && termo(p)) {
          // parágrafos seguidos que abrem com "Termo:" viram cartões, um por termo
          fim = i + 1; while (fim < bl.length && bl[fim].k === 'par' && termo(bl[fim].i) && !eAviso(bl[fim].i)) fim++;
          f('cartoes', i, fim); i = fim; continue;
        } else if (plano(p).length > 280 && top !== 'perolas') f('paragrafoLongo', i, i + 1);
        else f('texto', i, i + 1);
      } else if (b.k === 'lista') {
        var pr = agrupar(b.itens);
        var numerada = pr.length >= 2 && pr.every(function (g) { return g.item.marca != null; });
        var comTermo = pr.filter(function (g) { return termo(g.item.i); }).length, tipo;
        if (top === 'perolas' && pr.length >= 3) tipo = 'baralho';
        else if (top === 'perolas') tipo = 'texto';
        else if (numerada) tipo = 'linhaDoTempo';
        else if (dif && pr.length >= 2 && comTermo * 10 >= pr.length * 6) tipo = 'diferencial';
        else if (RE_CRIT.test(cab) && pr.length >= 3) tipo = 'criterios';
        else if (pr.length >= 2 && comTermo * 10 >= pr.length * 6) tipo = 'cartoes';
        else tipo = 'texto';
        f(tipo, i, i + 1);
      } else if (b.k === 'tab') {
        if (temFaixas(b)) f('faixas', i, i + 1);
        else if (dif && b.cab.length && b.linhas.length >= 2) f('diferencial', i, i + 1);
        else f('texto', i, i + 1);
      } else f('texto', i, i + 1);
      i++;
    }
    return r;
  }

  /* ---------------- HTML do texto: negrito, itálico, dose realçada, links ---------------- */
  function doseHTML(t, sobre) {
    var out = '', ult = 0;
    achaDoses(t).forEach(function (m) { out += esc(t.slice(ult, m.i)) + '<span class="dose' + (sobre ? ' sobre' : '') + '">' + esc(t.slice(m.i, m.f)) + '</span>'; ult = m.f; });
    return out + esc(t.slice(ult));
  }
  /* Parágrafo longo: a primeira frase, sem mudar o texto, fica mais forte. */
  function destacaInicio(i) {
    var p = plano(i), m = /[.!?:](?=\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/.exec(p);
    if (!m || m.index >= 170) return i;
    var n = m.index + 1, pos = 0, r = [];
    i.forEach(function (t) {
      if (t.selo) { r.push(t); return; }
      var a = pos, b = pos + t.t.length; pos = b;
      if (b <= n) r.push(Object.assign({}, t, { forte: true }));
      else if (a >= n) r.push(t);
      else { r.push(Object.assign({}, t, { t: t.t.slice(0, n - a), forte: true })); r.push(Object.assign({}, t, { t: t.t.slice(n - a) })); }
    });
    return r;
  }
  /* opts: {dose:true, sobre:false, inicio:false, semNegrito:false} */
  function texto(i, opts) {
    opts = opts || {};
    var dose = opts.dose !== false;
    if (opts.inicio) i = destacaInicio(i);
    return i.map(function (t) {
      if (t.selo) {
        var bid = t.link.slice(5), bu = W.MTDados.bula(bid);
        return '<a class="selo" href="#" data-bula="' + esc(bid) + '" aria-label="Abrir bula de ' + esc(bu ? bu.nome : bid) + '">bula</a>';
      }
      var h = t.c ? esc(t.t) : (dose ? doseHTML(t.t, opts.sobre) : esc(t.t));
      h = h.replace(/\n/g, '<br>');
      if (t.c) h = '<code>' + h + '</code>';
      if (t.i) h = '<em>' + h + '</em>';
      if (t.b && !opts.semNegrito) h = '<strong>' + h + '</strong>';
      else if (t.forte) h = '<span class="forte">' + h + '</span>';
      if (t.link) {
        if (t.link.indexOf('conduta:') === 0) h = '<a class="xlink" href="?conduta=' + esc(t.link.slice(8)) + '" data-conduta="' + esc(t.link.slice(8)) + '">' + h + '</a>';
        else if (t.link.indexOf('bula:') === 0) h = '<a class="xlink" href="#" data-bula="' + esc(t.link.slice(5)) + '">' + h + '</a>';
        else if (/^https?:\/\//.test(t.link)) h = '<a class="ext" href="' + esc(t.link) + '" target="_blank" rel="noopener noreferrer">' + h + '</a>';
      }
      return h;
    }).join('');
  }
  function textoSimples(s, opts) { return texto([{ t: String(s || '') }], opts); }
  function semDoisPontos(i) {
    if (!i.length) return i;
    var p = Object.assign({}, i[0]), t = p.t.trim();
    if (t.charAt(0) === ':') p.t = t.slice(1).trim();
    var r = [p].concat(i.slice(1));
    return r[0].t ? r : r.slice(1);
  }
  function limpaEmoji(i) {
    if (!i.length || i[0].t.indexOf('⚠') !== 0) return i;
    return [Object.assign({}, i[0], { t: semEmoji(i[0].t) })].concat(i.slice(1));
  }
  function semNegrito(i) { return i.map(function (t) { return Object.assign({}, t, { b: false }); }); }

  var ICONE = W.MTUI.ic;

  function avisoHTML(i) {
    return '<div class="aviso-suave"><span class="av-ic" role="img" aria-label="Atenção">' + ICONE('alert-triangle') + '</span><p>' + texto(limpaEmoji(i)) + '</p></div>';
  }
  function perolaHTML(i) {
    var al = eAlerta(plano(i));
    return '<div class="perola' + (al ? ' alerta' : '') + '">' + (al ? '<span class="pe-cuidado">' + ICONE('alert-triangle') + 'Cuidado</span>' : '') + '<p>' + texto(i) + '</p></div>';
  }
  function listaHTML(itens, emPerolas) {
    return '<div class="lista' + (emPerolas ? ' em-perolas' : '') + '">' + itens.map(function (it) {
      var rec = ' style="--nivel:' + it.nivel + '"';
      if (emPerolas) return '<div class="li-perola"' + rec + '>' + perolaHTML(it.i) + '</div>';
      if (eAviso(it.i)) return '<div class="li-perola"' + rec + '>' + avisoHTML(it.i) + '</div>';
      var marca = it.marca ? '<span class="li-marca">' + esc(it.marca) + '</span>' : '<span class="li-ponto' + (it.nivel ? ' sub' : '') + '" aria-hidden="true"></span>';
      return '<div class="li"' + rec + '>' + marca + '<p>' + texto(it.i) + '</p></div>';
    }).join('') + '</div>';
  }
  function celula(c, cabeca, primeira) {
    return texto(cabeca ? semNegrito(c) : c, { dose: !cabeca });
  }
  /* Tabela: 2 colunas cabem como estão; com 3 ou mais, fichas (uma linha por vez) ou grade com a 1ª coluna fixa. */
  function tabelaHTML(t) {
    var col = Math.max(t.cab.length, (t.linhas[0] || []).length);
    if (col <= 2) {
      var linha = function (l, cab) {
        return '<div class="t2-linha' + (cab ? ' cab' : '') + '"><div class="t2-a">' + celula(l[0] || [], cab) + '</div>' + (l.length > 1 ? '<div class="t2-b">' + celula(l[1], cab) + '</div>' : '') + '</div>';
      };
      return '<div class="tab2">' + (t.cab.length ? linha(t.cab, true) : '') + t.linhas.map(function (l) { return linha(l, false); }).join('') + '</div>';
    }
    var fichas = '<div class="fichas">' + t.linhas.map(function (l) {
      var h = '<div class="ficha"><p class="fi-t">' + texto(l[0] || []) + '</p>';
      for (var c = 1; c < l.length; c++) {
        if (!plano(l[c])) continue;
        var cab = c < t.cab.length ? plano(t.cab[c]) : '';
        h += '<div class="fi-c">' + (cab ? '<p class="fi-r">' + esc(cab) + '</p>' : '') + '<p>' + texto(l[c]) + '</p></div>';
      }
      return h + '</div>';
    }).join('') + '</div>';
    var grade = '<div class="grade" tabindex="0" role="region" aria-label="Tabela"><table>' +
      (t.cab.length ? '<thead><tr>' + t.cab.map(function (c, k) { return '<th' + (k === 0 ? ' class="fixa"' : '') + '>' + celula(c, true) + '</th>'; }).join('') + '</tr></thead>' : '') +
      '<tbody>' + t.linhas.map(function (l) { return '<tr>' + l.map(function (c, k) { return k === 0 ? '<th scope="row" class="fixa">' + celula(c, false) + '</th>' : '<td>' + celula(c, false) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
    return '<div class="tabela3"><button type="button" class="t-modo" data-acao="tabela-modo"><span class="v-grade">Ver em grade</span><span class="v-fichas">Ver em fichas</span></button>' +
      '<div class="t-fichas">' + fichas + '</div><div class="t-grade">' + grade + '</div></div>';
  }

  /* ctx: {emPerolas, tituloFluxo, registraFluxo(grafo, fonte, titulo) -> chave} */
  function blocoHTML(b, ctx) {
    ctx = ctx || {};
    switch (b.k) {
      case 'par':
        if (ctx.emPerolas) return perolaHTML(b.i);
        if (eAviso(b.i)) return avisoHTML(b.i);
        return '<p class="corpo">' + texto(b.i, { inicio: plano(b.i).length > 280 }) + '</p>';
      case 'sub': return '<h4 class="subt">' + texto(semNegrito(b.i), { dose: false }) + '</h4>';
      case 'lista': return listaHTML(b.itens, ctx.emPerolas);
      case 'cita': return '<blockquote class="cita">' + b.partes.map(function (p) { return '<p class="corpo">' + texto(p) + '</p>'; }).join('') + '</blockquote>';
      case 'tab': return tabelaHTML(b);
      case 'fluxo': {
        var g = parseFluxo(b.fonte);
        if (!g || !ctx.registraFluxo) return '<pre class="fonte">' + esc(b.fonte) + '</pre>';
        var k = ctx.registraFluxo(g, b.fonte, ctx.tituloFluxo || 'Fluxograma');
        var raiz = g.raizes.length === 1 ? g.nos.get(g.raizes[0]).texto.replace(/\n/g, ' ') : 'Por onde começar?';
        return '<button type="button" class="bloco-fluxo" data-fluxo="' + k + '" aria-label="Abrir fluxograma guiado"><span class="bf-r">Fluxograma guiado</span><span class="bf-t">' + esc(raiz) + '</span><span class="bf-a">Seguir passo a passo</span></button>';
      }
      case 'regra': return '<hr class="fio">';
    }
    return '';
  }

  function itensDe(blocos) {
    var r = [];
    blocos.forEach(function (b) {
      if (b.k === 'lista') r = r.concat(agrupar(b.itens));
      else if (b.k === 'par') r.push({ item: { nivel: 0, marca: null, i: b.i }, filhos: [] });
    });
    return r;
  }
  function filhosHTML(filhos) {
    return filhos.map(function (f) { return '<div class="filho"><span class="li-ponto cor" aria-hidden="true"></span><p>' + texto(f.i) + '</p></div>'; }).join('');
  }

  var nCrit = 0;
  function formaHTML(f, ctx) {
    var b0 = f.blocos[0];
    switch (f.tipo) {
      case 'aviso':
        return '<div class="aviso-forte"><span class="af-ic" role="img" aria-label="Atenção">' + ICONE('alert-triangle') + '</span><p>' + texto(limpaEmoji(b0.i), { sobre: true }) + '</p></div>';
      case 'linhaDoTempo': {
        var passos = [];
        f.blocos.forEach(function (b) {
          if (b.k === 'lista') agrupar(b.itens).forEach(function (g) { passos.push({ marca: g.item.marca ? g.item.marca.replace(/[.)]/g, '') : null, i: g.item.i, filhos: g.filhos }); });
          else if (b.k === 'par') passos.push({ marca: null, i: b.i, filhos: [] });
        });
        return '<ol class="passos">' + passos.map(function (p) {
          return '<li><span class="pa-n"' + (p.marca ? ' aria-label="Passo ' + esc(p.marca) + '"' : ' aria-hidden="true"') + '>' + (p.marca ? esc(p.marca) : '<span class="pa-ponto"></span>') + '</span>' +
            '<div class="pa-t"><p>' + texto(limpaEmoji(p.i)) + '</p>' + filhosHTML(p.filhos) + '</div></li>';
        }).join('') + '</ol>';
      }
      case 'cartoes':
        return '<div class="cartoes">' + itensDe(f.blocos).map(function (g) {
          var t = termo(g.item.i);
          return '<div class="cartao">' + (t ? '<p class="ca-t">' + texto(semNegrito(t.titulo)) + '</p><p>' + texto(limpaEmoji(semDoisPontos(t.corpo))) + '</p>' : '<p>' + texto(limpaEmoji(g.item.i)) + '</p>') + filhosHTML(g.filhos) + '</div>';
        }).join('') + '</div>';
      case 'criterios': {
        var itens = b0.itens, k = 'cr' + (++nCrit);
        return '<div class="criterios" data-total="' + itens.length + '"><div class="cr-topo"><span class="cr-conta" aria-live="polite">Marcados: 0 de ' + itens.length + '</span><button type="button" class="cr-limpa" data-acao="crit-limpa" hidden>Limpar</button></div>' +
          itens.map(function (it, n) {
            return '<label class="cr-item" style="--nivel:' + it.nivel + '"><input type="checkbox" data-acao="crit" id="' + k + '_' + n + '"><span class="cr-caixa" aria-hidden="true">' + ICONE('check') + '</span><span class="cr-t">' + texto(it.i) + '</span></label>';
          }).join('') + '<p class="nota">A contagem só ajuda a conferir. Não soma pontos nem dá resultado.</p></div>';
      }
      case 'faixas':
        return '<div class="faixas">' + b0.linhas.map(function (l) {
          var fx = faixa(l[0] || []), h = '<div class="faixa" data-faixa="' + (fx || '') + '"><span class="fx-cor" aria-hidden="true"></span><div class="fx-c"><p class="fx-t">' + esc(plano(l[0] || [])) + '</p>';
          for (var c = 1; c < l.length; c++) {
            if (!plano(l[c])) continue;
            var cab = c < b0.cab.length ? plano(b0.cab[c]) : '';
            h += '<div class="fi-c">' + (cab ? '<p class="fi-r">' + esc(cab) + '</p>' : '') + '<p>' + texto(l[c]) + '</p></div>';
          }
          return h + '</div></div>';
        }).join('') + '</div>';
      case 'diferencial': {
        var cs = [];
        if (b0.k === 'tab') cs = b0.linhas.map(function (l) {
          return { titulo: l[0] || [], corpo: l.slice(1).map(function (c, k) { return plano(c) ? { r: k + 1 < b0.cab.length ? plano(b0.cab[k + 1]) : '', i: c } : null; }).filter(Boolean) };
        });
        else if (b0.k === 'lista') cs = agrupar(b0.itens).map(function (g) {
          var t = termo(g.item.i);
          var fil = g.filhos.map(function (x) { return { r: '', i: x.i }; });
          return t ? { titulo: t.titulo, corpo: [{ r: '', i: semDoisPontos(t.corpo) }].concat(fil) } : { titulo: g.item.i, corpo: fil };
        });
        return '<div class="difs"><button type="button" class="dif-todos" data-acao="dif-todos" data-n="' + cs.length + '">' + cs.length + ' itens. Toque para abrir ou abra todos</button>' + cs.map(function (c) {
          if (!c.corpo.length) return '<div class="dif"><p class="dif-t">' + texto(semNegrito(c.titulo)) + '</p></div>';
          return '<details class="dif"><summary><span class="dif-t">' + texto(semNegrito(c.titulo)) + '</span>' + ICONE('chevron-down') + '</summary>' +
            c.corpo.map(function (p) { return '<div class="fi-c">' + (p.r ? '<p class="fi-r">' + esc(p.r) + '</p>' : '') + '<p>' + texto(p.i) + '</p></div>'; }).join('') + '</details>';
        }).join('') + '</div>';
      }
      case 'baralho': {
        var gs = agrupar(b0.itens);
        return '<div class="baralho" data-n="' + gs.length + '"><div class="ba-topo"><span class="ba-conta">Pérola 1 de ' + gs.length + '. Deslize para o lado.</span><button type="button" class="ba-modo" data-acao="baralho-modo">Ver em lista</button></div><div class="ba-cartas">' +
          gs.map(function (g, n) {
            var al = eAlerta(plano(g.item.i));
            return '<div class="carta' + (al ? ' alerta' : '') + '" data-n="' + n + '"><span class="ca-ic">' + ICONE(al ? 'alert-triangle' : 'bulb') + (al ? '<b>Cuidado</b>' : '') + '</span><p class="ca-p">' + texto(g.item.i) + '</p>' +
              g.filhos.map(function (x) { return '<p>' + texto(x.i) + '</p>'; }).join('') + '</div>';
          }).join('') + '</div></div>';
      }
    }
    return f.blocos.map(function (b) { return blocoHTML(b, ctx); }).join('');
  }

  W.MTConduta = {
    documento: documento, conta: conta, topicos: TOPICOS, topicoDe: topicoDe, tituloPartido: tituloPartido,
    texto: texto, textoSimples: textoSimples, blocoHTML: blocoHTML, formaHTML: formaHTML, plano: plano, temDose: temDose,
    achaDoses: achaDoses, parseFluxo: parseFluxo, normal: normal, semEmoji: semEmoji, inline: inline
  };
})();
