/* MedTech PWA: seção Exames, igual à do app de iPhone (AchadosView.swift e Motor.swift).
   Tela nativa do PWA (tipo de exame, foto ou arquivo, texto, treino, contexto, Analisar, resultado em blocos, histórico).
   O motor é o mesmo do iPhone: laudai.html?achados=1 aberto num quadro oculto (mesmo domínio, mesma sessão de login).
   Prompt, chamada à IA, gravação do histórico e aceite de estudo são os do próprio LaudAI, chamados lá dentro:
   Gemini.generateLaudo (buildPromptAchados), saveLaudoToFirestore, handleFiles/processImage/Dicom e state.aceiteEstudo.
   Nada de regra ou prompt é escrito aqui. Com ?demo=1 não há motor: a análise é um exemplo fictício pronto. */
(function () {
  'use strict';
  var W = window, D = document;
  if (!W.MedTechCasca || !W.MTUI) return;
  var U = W.MTUI, esc = U.esc, ic = U.ic;
  var DEMO = new URLSearchParams(location.search).get('demo') === '1';
  var MAX_IMAGENS = 6;                                   // teto do backend central (laudai.gemini.js)
  var LS_LANG = 'laudai_lang', LS_STYLE = 'laudai_style'; // as mesmas chaves do LaudAI

  /* id = texto que vai como "Tipo" ao prompt (o mesmo do iPhone, Exames.lista). */
  var TIPOS = [
    ['ECG / Eletrocardiograma', 'ECG'], ['Radiografia (RX)', 'Raio-X'], ['Tomografia (TC)', 'Tomografia'], ['Ressonância (RM)', 'Ressonância'],
    ['Ultrassonografia (US)', 'Ultrassom'], ['Hemograma', 'Hemograma'], ['Gasometria arterial', 'Gasometria'], ['Bioquímica / Painel', 'Bioquímica'],
    ['Lesão de pele / Dermatoscopia', 'Pele'], ['Fundoscopia / Retinografia', 'Fundo de olho'], ['Espirometria', 'Espirometria'], ['Outros', 'Outro']
  ].map(function (t) { return { id: t[0], curto: t[1] }; });
  function curto(mod) { var t = TIPOS.filter(function (x) { return x.id === mod; })[0]; return t ? t.curto : (mod || 'Exame'); }
  function iconeExame(mod) {   // o mesmo do histórico do LaudAI (iconeExame)
    var m = (mod || '').toLowerCase();
    if (/eletrocardio|ecg|holter|mapa/.test(m)) return 'heartbeat';
    if (/hemograma|bioquím|gasometria|coagulo|urina|marcador|hormôn|sorolog/.test(m)) return 'droplet';
    if (/pele|dermato|endoscop|fundoscop|patológ|histopat/.test(m)) return 'microscope';
    if (/eletroencef|espirom/.test(m)) return 'wave-sine';
    return 'scan';
  }

  /* ================= motor: laudai.html?achados=1 num quadro oculto (Motor.swift) ================= */
  var motor = {
    fase: 'parada',      // parada | carregando | pronta | fora | falhou
    quadro: null, w: null, S: null, geracao: 0, esperas: [],
    abrir: function () {
      var m = this, g = ++m.geracao;
      m.parar(true);
      m.fase = 'carregando';
      var q = D.createElement('iframe');
      q.className = 'ex-motor';
      q.title = 'Motor da análise de exames';
      q.setAttribute('aria-hidden', 'true');
      q.setAttribute('tabindex', '-1');
      q.inert = true;   // a página oculta nunca toma o foco
      q.src = '../laudai.html?achados=1&motor=1';
      (D.getElementById('app') || D.body).appendChild(q);
      m.quadro = q;
      var n = 0;
      (function passo() {
        if (g !== m.geracao) return;
        n++;
        var w = null, M = null;
        try { w = q.contentWindow; M = w && w.MT; } catch (e) { }
        try {
          var login = !!(w && w.document && w.document.getElementById('mt-login'));
          if (M && M.user && !M.user.demo && w.eval('typeof state !== "undefined" && state.ready === true')) {
            /* conta real só com a página na nuvem; e as funções do LaudAI que a tela usa precisam estar lá */
            if (M.mode === 'demo' || typeof w.saveLaudoToFirestore !== 'function' || typeof w.handleFiles !== 'function' || w.eval('typeof Gemini') !== 'object') {
              console.warn('exames: o LaudAI mudou ou abriu em demonstração');
              return m.muda('falhou');
            }
            m.w = w; m.S = w.eval('state');
            /* No modo Achados a primeira entrega de dados do LaudAI para no meio: o enterApp dispara o initMainApp, que
               procura o botão do favorito do PACS que o próprio modo Achados já tirou da página, e a exceção pula as linhas
               que copiam laudos, lápides e aceite para o state. Reentregar o mesmo dado roda o próprio callback dele de novo
               (o enterApp não repete), sem gravar nada. */
            if (M._data !== undefined && typeof M._emit === 'function') { try { M._emit(M._data); } catch (e) { } }
            /* os avisos que o LaudAI dá ao ler arquivos (ZIP, DICOM, erro) aparecem na tela do PWA */
            w.toast = function (msg) { U.aviso(String(msg || '')); };
            return m.muda('pronta');
          }
          if (login && !(M && M.user)) m.muda('fora');
        } catch (e) { /* página ainda carregando */ }
        if (m.fase === 'carregando' && n > 120) return m.muda('falhou');   // 36 s
        setTimeout(passo, 300);   // continua olhando: entrar na conta em outra aba destrava sozinho
      })();
    },
    muda: function (f) {
      this.fase = f;
      if (f === 'pronta' || f === 'falhou') { var e = this.esperas; this.esperas = []; e.forEach(function (fn) { fn(); }); }
      tela.aoMotor();
    },
    parar: function (semFase) {
      if (this.quadro) { try { this.quadro.remove(); } catch (e) { } }
      this.quadro = null; this.w = null; this.S = null;
      if (!semFase) { this.geracao++; this.fase = 'parada'; }
    },
    /* Espera a página ficar pronta (até 25 s); reabre se tinha falhado. */
    garantir: function () {
      var m = this;
      if (m.fase === 'pronta') return Promise.resolve(true);
      if (m.fase === 'falhou' || m.fase === 'parada') m.abrir();
      return new Promise(function (ok) {
        var feito = false, fim = function () { if (!feito) { feito = true; ok(m.fase === 'pronta'); } };
        m.esperas.push(fim);
        setTimeout(fim, 25000);
      });
    },
    pega: function (nome) { return this.w.eval(nome); },
    /* Mostra a página do LaudAI por cima do app só enquanto o visualizador DICOM dele está aberto. */
    mostrar: function (sim) {
      var q = this.quadro; if (!q) return;
      try {
        var d = q.contentDocument, st = d.getElementById('ex-motor-estilo');
        if (!st) { st = d.createElement('style'); st.id = 'ex-motor-estilo'; st.textContent = '.app,#mt-demobar,.mt-instalar{visibility:hidden!important}html,body{background:transparent!important}'; d.head.appendChild(st); }
      } catch (e) { }
      q.classList.toggle('vis', !!sim);
      q.inert = !sim;
      if (sim) { q.removeAttribute('aria-hidden'); q.removeAttribute('tabindex'); try { q.focus(); } catch (e) { } }
      else { q.setAttribute('aria-hidden', 'true'); q.setAttribute('tabindex', '-1'); }
    }
  };

  /* Saída da conta: fecha a página antes do MT.signOut (assim a limpeza do banco local não esbarra nela), como o cofre. */
  (function vigiaSaida() {
    if (DEMO) return;
    if (!W.MT || !W.MT.signOut) { setTimeout(vigiaSaida, 300); return; }
    if (W.MT.signOut.__exames) return;
    var sair = W.MT.signOut;
    W.MT.signOut = function () { motor.parar(); return sair.apply(this, arguments); };
    W.MT.signOut.__exames = true;
  })();

  /* ================= dados da tela ================= */
  var st = {
    tipo: TIPOS[0], treino: false, contexto: false, analisando: false,
    midiaDemo: [],            // na demonstração as imagens ficam aqui; com conta, no state.media do LaudAI
    aceiteDemo: false,
    histDemo: null,
    ajustesDemo: { modelo: 'gemini-2.5-pro', idioma: 'pt-BR' }
  };
  function midia() { return (motor.S && motor.S.media) || st.midiaDemo; }
  function imagens() { return midia().filter(function (m) { return m.kind !== 'video'; }); }
  function aceito() { return DEMO ? st.aceiteDemo : !!(motor.S && motor.S.aceiteEstudo); }
  function historico() {
    if (DEMO) return st.histDemo || (st.histDemo = [{ id: 1, date: new Date(Date.now() - 86400000).toISOString(), modality: 'ECG / Eletrocardiograma', region: '12 derivações', text: RESULTADO_DEMO, modo: 'achados', demo: true }]);
    return ((motor.S && motor.S.laudos) || []).filter(function (x) { return x && x.modo === 'achados'; });
  }

  /* A mesma preparação do processImage do LaudAI (lado maior 1600, JPEG 0,92), usada só na demonstração. */
  function preparaLocal(file) {
    return new Promise(function (ok, erro) {
      var r = new FileReader();
      r.onload = function () {
        var img = new Image();
        img.onload = function () {
          var w = img.width, h = img.height, MAX = 1600;
          if (Math.max(w, h) > MAX) { var s = MAX / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
          var c = D.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h);
          var url = c.toDataURL('image/jpeg', 0.92);
          ok({ id: Math.random().toString(36).slice(2), kind: 'image', name: file.name, size: url.length, mimeType: 'image/jpeg', dataUrl: url, base64: url.split(',')[1] });
        };
        img.onerror = erro; img.src = r.result;
      };
      r.onerror = erro; r.readAsDataURL(file);
    });
  }
  function ehImagem(f) { return (f.type || '').indexOf('image/') === 0 || /\.(jpe?g|png|webp|bmp|gif|tiff?|heic|heif)$/i.test(f.name || ''); }

  async function anexar(lista) {
    var files = Array.prototype.slice.call(lista || []);
    if (!files.length) return;
    if (DEMO) {
      var img = files.filter(ehImagem);
      if (img.length < files.length) U.aviso('Na demonstração, use uma imagem (JPG ou PNG). DICOM e ZIP só com a conta.');
      for (var i = 0; i < img.length; i++) {
        try { st.midiaDemo.push(await preparaLocal(img[i])); } catch (e) { U.aviso('Não consegui abrir "' + img[i].name + '".'); }
      }
      tela.desenhaCaptura();
      return;
    }
    tela.ocupado(true, 'Abrindo o arquivo');
    try {
      if (!(await motor.garantir())) { tela.erro(motor.fase === 'fora' ? 'Entre na sua conta MedTech para anexar e analisar.' : 'Não consegui abrir a análise agora. Confira a internet e tente de novo.'); return; }
      /* o handleFiles do LaudAI: ZIP, DICOM (com o visualizador dele), imagens; o mesmo teto de 200 MB */
      var ver = files.some(function (f) { return !ehImagem(f); });
      if (ver) motor.mostrar(true);
      try { await motor.w.handleFiles(files); } finally { if (ver) motor.mostrar(false); }
      if (motor.S.media.some(function (m) { return m.kind === 'video'; })) {
        motor.S.media = motor.S.media.filter(function (m) { return m.kind !== 'video'; });
        U.aviso('Vídeo ainda não é analisado. Exporte os cortes principais como imagens.');
      }
    } catch (e) { console.error(e); U.aviso('Não consegui abrir o arquivo.'); }
    finally { tela.ocupado(false); tela.desenhaCaptura(); }
  }
  function tirar(id) {
    if (motor.S) motor.S.media = motor.S.media.filter(function (m) { return m.id !== id; });
    else st.midiaDemo = st.midiaDemo.filter(function (m) { return m.id !== id; });
    tela.desenhaCaptura();
  }
  function limparMidia() { if (motor.S) motor.S.media = []; st.midiaDemo = []; }

  /* ================= análise (Motor.analisar) ================= */
  function mensagem(e) {
    var m = String((e && e.message) || '');
    if ((e && e.code === 'paywall') || /PAYWALL/.test(m)) return 'O limite de uso da IA de hoje acabou. Ele volta amanhã.';
    if (/internal|unavailable|deadline/i.test(m)) return 'A IA não respondeu agora. Tente de novo em instantes.';
    m = m.replace(/^Error:\s*/, '');
    return m || 'Não consegui analisar agora. Tente de novo.';
  }
  function contexto() {
    var v = function (id) { var el = D.getElementById(id); return el ? el.value.trim() : ''; };
    var ctx = {
      modality: st.tipo.id, region: v('exRegiao'), age: v('exIdade'), sex: v('exSexo'), history: v('exHistoria'), examText: v('exTexto'),
      language: lerLS(LS_LANG) || 'pt-BR', style: lerLS(LS_STYLE) || 'estruturado',
      modo: 'achados', leitura: st.treino ? v('exLeitura') : ''
    };
    /* metadados do DICOM, como o generate() do LaudAI */
    var dcm = midia().filter(function (m) { return m.kind === 'dicom'; });
    if (dcm.length) {
      var meta = dcm[0].meta || {};
      var bits = [meta.modality && 'Modalidade detectada: ' + meta.modality, meta.studyDescription && 'Study: ' + meta.studyDescription,
        meta.seriesDescription && 'Series: ' + meta.seriesDescription, meta.bodyPart && 'Body part: ' + meta.bodyPart,
        meta.patientAge && 'Idade DICOM: ' + meta.patientAge, meta.patientSex && 'Sexo DICOM: ' + meta.patientSex].filter(Boolean);
      if (bits.length) ctx.dicomMeta = bits.join('; ');
    }
    return ctx;
  }
  function lerLS(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  async function tocarAnalisar() {
    if (st.analisando) return;
    tela.erro('');
    if (!podeAnalisar()) { tela.erro('Anexe uma imagem ou cole os resultados do exame em texto.'); return; }
    if (imagens().length > MAX_IMAGENS) { tela.erro('Até ' + MAX_IMAGENS + ' imagens por análise. Tire ' + (imagens().length - MAX_IMAGENS) + ' e tente de novo.'); return; }
    if (!DEMO) {
      tela.ocupado(true, 'Abrindo sua conta');
      var ok = await motor.garantir();
      tela.ocupado(false);
      if (!ok) { tela.erro(motor.fase === 'fora' ? 'Entre na sua conta MedTech para analisar.' : 'Não consegui abrir a análise agora. Confira a internet e tente de novo.'); return; }
    }
    if (!aceito()) { pedirAceite(); return; }
    analisar();
  }
  function podeAnalisar() { var t = D.getElementById('exTexto'); return imagens().length > 0 || !!(t && t.value.trim()); }

  async function analisar() {
    st.analisando = true;
    var ctx = contexto(), fotos = imagens().slice();
    tela.lendo(DEMO ? [{ dataUrl: ECG_DEMO }] : fotos);
    try {
      var txt;
      if (DEMO) {
        await new Promise(function (r) { setTimeout(r, 3200); });
        txt = RESULTADO_DEMO;
        historico().unshift({ id: Date.now(), date: new Date().toISOString(), modality: 'ECG / Eletrocardiograma', region: '12 derivações', text: txt, modo: 'achados', demo: true });
        tela.resultado(txt, 'ECG', [{ dataUrl: ECG_DEMO }], true);
      } else {
        var G = motor.pega('Gemini'), model = G.getModel();
        var media = motor.S.media.filter(function (m) { return m.kind !== 'video'; });
        var res;
        try { res = await G.generateLaudo({ media: media, ctx: ctx, model: model }); }
        catch (e) {   // uma nova tentativa quando a IA não respondeu, como o iPhone
          if (!/internal|unavailable|deadline/i.test((e && e.message) || '')) throw e;
          await new Promise(function (r) { setTimeout(r, 1500); });
          res = await G.generateLaudo({ media: media, ctx: ctx, model: model });
        }
        txt = typeof res === 'string' ? res : res.text;
        try { await motor.w.saveLaudoToFirestore(txt, ctx); }
        catch (e) { console.warn(e); U.aviso('Análise feita, mas não foi salva na nuvem: ' + ((e && e.message) || 'erro desconhecido')); }
        tela.resultado(txt, curto(ctx.modality), fotos, false);
      }
    } catch (e) {
      console.error(e);
      tela.voltaForm();
      tela.erro(mensagem(e));
    } finally {
      st.analisando = false;
      tela.desenhaCab();
    }
  }

  /* Aceite de estudo: a mesma regra e o mesmo registro do LaudAI (salvarDeclaracao no modo Achados). */
  function pedirAceite() {
    U.folha({
      titulo: 'Uso para estudo', classe: 'folha-ex',
      conteudo: function (c, api) {
        c.innerHTML = '<span class="ex-circulo grande" aria-hidden="true">' + ic('school') + '</span>' +
          '<h2 class="folha-titulo" data-foco tabindex="-1">Uso para estudo</h2>' +
          '<p class="corpo">Esta análise é um exercício de leitura feito por IA. Ela pode errar, não é laudo e não substitui a avaliação de um médico.</p>' +
          '<label class="ex-marca"><input type="checkbox" id="exAceiteOk"><span>Não vou usar para decidir a conduta de um paciente e vou tirar nome e documentos das imagens antes de enviar.</span></label>' +
          '<button type="button" class="bt-cheio ex-cheio" id="exAceiteBt" disabled>Confirmar e analisar</button>';
        var cb = c.querySelector('#exAceiteOk'), bt = c.querySelector('#exAceiteBt');
        cb.addEventListener('change', function () { bt.disabled = !cb.checked; });
        bt.addEventListener('click', async function () {
          if (!cb.checked) return;
          bt.disabled = true;
          if (DEMO) st.aceiteDemo = true;   // na demonstração vale só nesta tela
          else {
            var S = motor.S;
            S.aceiteEstudo = { em: new Date().toISOString(), versao: 1 };
            try { await motor.w.MT.save({ laudos: S.laudos || [], _tomb: S._tomb, declaracao: S.declaracao || null, aceiteEstudo: S.aceiteEstudo }); } catch (e) { console.warn(e); }
          }
          api.fechar();
          analisar();
        });
      }
    });
  }

  /* ================= leitura da resposta (struct Analise do iPhone) ================= */
  function lerAnalise(md) {
    var a = { alerta: null, blocos: [] }, atual = null;
    String(md || '').split(/\r?\n/).forEach(function (bruta) {
      var l = bruta.trim();
      if (!l) return;
      if (/^#{1,3}\s/.test(l)) {
        if (atual) a.blocos.push(atual);
        atual = { titulo: l.replace(/#/g, '').trim(), itens: [], texto: [] };
        return;
      }
      if (/^⚠️?/.test(l)) {
        var t = l.replace(/⚠️?/g, '').trim();
        a.alerta = a.alerta ? a.alerta + ' ' + t : t;
        return;
      }
      var m = l.match(/^([-*•]|\d+[.)])\s+/);
      if (m) {
        var txt = l.slice(m[0].length), c = null;
        var r = txt.match(/\s*\(certeza\s+(alta|m[eé]dia|baixa)[^)]*\)\.?\s*$/i);
        if (r) { var s = r[0].toLowerCase(); c = /alta/.test(s) ? 'alta' : /baixa/.test(s) ? 'baixa' : 'média'; txt = txt.slice(0, r.index); }
        if (atual) atual.itens.push({ texto: txt, certeza: c });
      } else if (atual) atual.texto.push(l);
    });
    if (atual) a.blocos.push(atual);
    return a;
  }
  function negrito(s) {   // markdown só de linha: **negrito** e *itálico*
    return esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  }
  function normal(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function certeza(c) {
    var n = c === 'alta' ? 3 : c === 'média' ? 2 : 1, k = c === 'alta' ? 'alta' : c === 'média' ? 'media' : 'baixa';
    return '<span class="ex-cz ' + k + '" role="img" aria-label="Certeza ' + c + '"><span class="ex-cz-b" aria-hidden="true">' +
      [1, 2, 3].map(function (i) { return '<i' + (i <= n ? ' class="on"' : '') + '></i>'; }).join('') + '</span><span aria-hidden="true">' + c + '</span></span>';
  }
  function bloco(b) {
    var t = normal(b.titulo);
    var textos = b.texto.map(function (p) { return '<p>' + negrito(p) + '</p>'; }).join('');
    var lista = function () { return '<ul class="ex-lista">' + b.itens.map(function (i) { return '<li>' + negrito(i.texto) + '</li>'; }).join('') + '</ul>'; };
    var sec = function (cls, icone, corpo) { return '<section class="ex-bloco ' + cls + '"><h3><span class="ex-circulo" aria-hidden="true">' + ic(icone) + '</span>' + esc(b.titulo) + '</h3>' + corpo + '</section>'; };
    if (t.indexOf('aparece') >= 0) return sec('aparece', 'scan',
      '<ul class="ex-achados">' + b.itens.map(function (i) { return '<li><span>' + negrito(i.texto) + '</span>' + (i.certeza ? certeza(i.certeza) : '') + '</li>'; }).join('') + '</ul>' + textos);
    if (t.indexOf('conferir') >= 0) return sec('conferir', 'list-check',
      '<ul class="ex-confere">' + b.itens.map(function (i) { return '<li><label><input type="checkbox"><span>' + negrito(i.texto) + '</span></label></li>'; }).join('') + '</ul>' + textos);
    if (t.indexOf('significar') >= 0) return sec('significar', 'bulb',
      '<ol class="ex-hipoteses">' + b.itens.map(function (i, n) { return '<li><b aria-hidden="true">' + (n + 1) + '</b><span>' + negrito(i.texto) + '</span></li>'; }).join('') + '</ol>' + textos);
    if (t.indexOf('comparada') >= 0) return sec('comparada', 'user-check', lista() + textos);
    if (t.indexOf('qualidade') >= 0) return '<section class="ex-qualidade"><h3>' + esc(b.titulo) + '</h3>' + textos + b.itens.map(function (i) { return '<p>' + negrito(i.texto) + '</p>'; }).join('') + '</section>';
    return sec('outro', 'bookmark', lista() + textos);
  }

  /* ================= tela ================= */
  var raiz = null, fechaRes = null;
  var toque = (function () { try { return W.matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } })();

  var tela = {
    montar: function (el) {
      raiz = el;
      el.innerHTML = '<div class="ex">' +
        '<div class="rola-secao ex-form" id="exForm">' +
          '<div class="ex-cab"><h1 class="titulo-secao">Exames</h1><div class="ex-cab-bts">' +
            '<button type="button" class="ex-link" id="exHist" hidden>' + ic('history') + '<span>Histórico</span></button>' +
            '<button type="button" class="ex-icone" id="exAjustes" aria-label="Ajustes da IA">' + ic('settings') + '</button></div></div>' +
          '<p class="ex-sub">A IA aponta o que vê no exame e mostra como conferir. Para estudo, não é laudo.</p>' +
          '<div class="ex-tipos-rola"><div class="ex-tipos" role="group" aria-label="Tipo de exame">' +
            TIPOS.map(function (t, i) { return '<button type="button" class="ex-tipo" data-i="' + i + '" aria-pressed="false">' + esc(t.curto) + '</button>'; }).join('') +
          '</div></div>' +
          '<div class="ex-captura" id="exCaptura"></div>' +
          campo('exTexto', 'Resultados em texto', 'Cole valores ou a descrição. Ex.: pH 7,32; PaCO2 48; HCO3 24', true) +
          dobra('exDTreino', 'exTreino', 'pencil', 'Treinar antes de ver') +
          '<div class="ex-dobrado" id="exTreino" hidden>' + campo('exLeitura', 'O que você viu', 'Escreva sua leitura. A IA compara com o que ela vê.', true) + '</div>' +
          dobra('exDContexto', 'exContexto', 'align-left', 'Contexto do caso') +
          '<div class="ex-dobrado" id="exContexto" hidden>' +
            campo('exRegiao', 'Região ou detalhes', 'Ex.: tórax PA, 12 derivações') +
            '<div class="ex-par">' + campo('exIdade', 'Idade', 'Ex.: 58 anos') +
              '<div class="ex-campo"><label for="exSexo">Sexo</label><select id="exSexo"><option value="">Não dizer</option><option value="Feminino">Feminino</option><option value="Masculino">Masculino</option></select></div></div>' +
            campo('exHistoria', 'História', 'Ex.: dor torácica há 2 horas', true) +
          '</div>' +
          '<div class="ex-aviso" role="note">' + ic('alert-triangle') + '<p><strong>Para estudo, não é laudo.</strong> A IA pode errar e não substitui a avaliação de um médico. Não use para decidir conduta. As imagens vão para a IA do Google (Gemini): tire nome, CPF e data de nascimento antes de enviar.</p></div>' +
          '<p class="ex-erro" id="exErro" role="alert" hidden></p>' +
          '<button type="button" class="bt-cheio ex-cheio ex-analisar" id="exAnalisar" disabled>' + ic('scan') + '<span>Analisar exame</span></button>' +
          (DEMO ? '<p class="ex-nota-demo">Modo demonstração: nada é enviado. Ao analisar, aparece um exemplo fictício pronto.</p>' : '') +
          '<input type="file" id="exCamera" accept="image/*" capture="environment" hidden>' +
          '<input type="file" id="exArquivo" accept="image/*,.dcm,.dicom,.ima,.zip,application/dicom" multiple hidden>' +
        '</div>' +
        '<div class="ex-lendo" id="exLendo" hidden></div>' +
        '<div class="ex-res" id="exRes" hidden></div>' +
      '</div>';
      tela.marcaTipo();
      tela.desenhaCaptura();
      tela.desenhaCab();
      tela.ligar();
      if (!DEMO) motor.abrir();
    },
    ligar: function () {
      var q = function (s) { return raiz.querySelector(s); };
      q('.ex-tipos').addEventListener('click', function (e) {
        var b = e.target.closest('.ex-tipo'); if (!b) return;
        st.tipo = TIPOS[+b.dataset.i]; tela.marcaTipo();
      });
      q('#exDTreino').addEventListener('click', function () { st.treino = !st.treino; tela.dobra('exDTreino', 'exTreino', st.treino, 'exLeitura'); });
      q('#exDContexto').addEventListener('click', function () { st.contexto = !st.contexto; tela.dobra('exDContexto', 'exContexto', st.contexto, 'exRegiao'); });
      q('#exTexto').addEventListener('input', tela.atualizaBotao);
      q('#exAnalisar').addEventListener('click', tocarAnalisar);
      q('#exHist').addEventListener('click', abrirHistorico);
      q('#exAjustes').addEventListener('click', abrirAjustes);
      ['#exCamera', '#exArquivo'].forEach(function (s) {
        var i = q(s); i.addEventListener('change', function () { var f = i.files; anexar(f).then(function () { i.value = ''; }); });
      });
      q('#exCaptura').addEventListener('click', function (e) {
        var b = e.target.closest('[data-acao]'); if (!b) return;
        var a = b.dataset.acao;
        if (a === 'camera') q('#exCamera').click();
        else if (a === 'arquivo') q('#exArquivo').click();
        else if (a === 'tira') tirar(b.dataset.id);
        else if (a === 'ver') verFoto(midia().filter(function (m) { return m.id === b.dataset.id; })[0]);
        else if (a === 'exemplo') {
          st.midiaDemo = [{ id: 'exemplo', kind: 'image', name: 'ecg-sintetico.svg', mimeType: 'image/svg+xml', dataUrl: ECG_DEMO, exemplo: true }];
          st.tipo = TIPOS[0]; tela.marcaTipo(); tela.desenhaCaptura();
        }
      });
      /* arrastar e colar, como no LaudAI */
      var form = q('#exForm');
      form.addEventListener('dragover', function (e) { e.preventDefault(); form.classList.add('arrastando'); });
      form.addEventListener('dragleave', function (e) { if (e.target === form) form.classList.remove('arrastando'); });
      form.addEventListener('drop', function (e) { e.preventDefault(); form.classList.remove('arrastando'); anexar(e.dataTransfer.files); });
      D.addEventListener('paste', function (e) {
        if (!raiz || raiz.hidden || q('#exForm').hidden) return;
        var it = (e.clipboardData && e.clipboardData.items) || [], fs = [];
        for (var i = 0; i < it.length; i++) if (it[i].kind === 'file') { var f = it[i].getAsFile(); if (f && ehImagem(f)) fs.push(f); }
        if (fs.length) { e.preventDefault(); anexar(fs); }
      });
      D.addEventListener('medtech:secao', function (e) { if (e.detail && e.detail.secao === 'exames') tela.desenhaCab(); });
    },
    marcaTipo: function () {
      raiz.querySelectorAll('.ex-tipo').forEach(function (b) { b.setAttribute('aria-pressed', TIPOS[+b.dataset.i] === st.tipo ? 'true' : 'false'); });
    },
    dobra: function (idBt, idCorpo, aberto, foco) {
      var b = raiz.querySelector('#' + idBt), c = raiz.querySelector('#' + idCorpo);
      b.setAttribute('aria-expanded', aberto ? 'true' : 'false');
      c.hidden = !aberto;
      if (aberto) { var f = raiz.querySelector('#' + foco); if (f && !toque) f.focus({ preventScroll: true }); }
    },
    desenhaCab: function () {
      if (!raiz) return;
      var b = raiz.querySelector('#exHist'); if (b) b.hidden = !historico().length;
    },
    desenhaCaptura: function () {
      var box = raiz.querySelector('#exCaptura'), lista = midia(), n = imagens().length;
      var h = '';
      if (!lista.length) {
        h = '<div class="ex-cap2">' +
          (toque
            ? '<button type="button" class="ex-pega cheio" data-acao="camera">' + ic('camera') + '<b>Fotografar</b></button><button type="button" class="ex-pega" data-acao="arquivo">' + ic('photo') + '<b>Da galeria ou arquivo</b></button>'
            : '<button type="button" class="ex-pega cheio" data-acao="arquivo">' + ic('upload') + '<b>Escolher arquivo</b></button><button type="button" class="ex-pega" data-acao="arquivo">' + ic('drag-drop') + '<b>Arraste ou cole aqui</b></button>') +
          '</div><p class="ex-dica">Foto, imagem ou DICOM (também em ZIP da série). Até ' + MAX_IMAGENS + ' imagens.</p>' +
          (DEMO ? '<button type="button" class="ex-exemplo" data-acao="exemplo">' + ic('heartbeat') + '<span>Usar o ECG sintético de exemplo</span></button>' : '');
      } else {
        h = '<div class="ex-fotos" role="list" aria-label="Imagens anexadas">' + lista.map(function (m, i) {
          var rot = m.kind === 'dicom' ? 'DICOM' : (m.exemplo ? 'Exemplo' : '');
          return '<div class="ex-foto" role="listitem"><button type="button" class="ex-foto-ver" data-acao="ver" data-id="' + esc(m.id) + '" aria-label="Ver a imagem ' + (i + 1) + ' em tela cheia"><img src="' + esc(m.dataUrl || m.thumbUrl || '') + '" alt=""></button>' +
            (rot ? '<span class="ex-selo">' + rot + '</span>' : '') +
            '<button type="button" class="ex-tira" data-acao="tira" data-id="' + esc(m.id) + '" aria-label="Tirar a imagem ' + (i + 1) + '"><span>' + ic('x') + '</span></button></div>';
        }).join('') +
          (n < MAX_IMAGENS && !(lista[0] && lista[0].exemplo) ? '<button type="button" class="ex-mais" data-acao="arquivo" aria-label="Adicionar imagem">' + ic('plus') + '</button>' : '') + '</div>' +
          '<p class="ex-conta' + (n > MAX_IMAGENS ? ' demais' : '') + '">' + n + ' de ' + MAX_IMAGENS + ' imagens' + (n > MAX_IMAGENS ? ': tire ' + (n - MAX_IMAGENS) + ' antes de analisar' : '') + '</p>' +
          (lista[0] && lista[0].exemplo ? '<p class="ex-dica">Traçado sintético desenhado para a demonstração, sem dado de paciente.</p>'
            : '<p class="ex-tire">' + ic('alert-triangle') + 'Tire da imagem nome, CPF e data de nascimento antes de analisar.</p>');
      }
      box.innerHTML = h;
      tela.atualizaBotao();
    },
    atualizaBotao: function () { var b = raiz && raiz.querySelector('#exAnalisar'); if (b) b.disabled = !podeAnalisar(); },
    ocupado: function (sim, txt) {
      var b = raiz.querySelector('#exAnalisar'); if (!b) return;
      if (sim) { b.disabled = true; b.innerHTML = '<span class="ex-gira" aria-hidden="true"></span><span>' + esc(txt || 'Abrindo') + '</span>'; b.setAttribute('aria-busy', 'true'); }
      else { b.innerHTML = ic('scan') + '<span>Analisar exame</span>'; b.removeAttribute('aria-busy'); tela.atualizaBotao(); }
    },
    erro: function (txt) { var e = raiz.querySelector('#exErro'); e.textContent = txt || ''; e.hidden = !txt; },
    aoMotor: function () {
      if (!raiz) return;
      tela.desenhaCab();
      tela.desenhaCaptura();
      if (motor.fase === 'fora') tela.erro('Entre na sua conta MedTech para analisar.');
      else if (motor.fase === 'pronta') { var e = raiz.querySelector('#exErro'); if (/Entre na sua conta|Não consegui abrir a análise/.test(e.textContent)) tela.erro(''); }
    },
    lendo: function (fotos) {
      var f = fotos[0];
      var el = raiz.querySelector('#exLendo');
      el.innerHTML = '<div class="ex-lendo-quadro">' + (f ? '<img src="' + esc(f.dataUrl || '') + '" alt="">' : '<span class="ex-lendo-ic">' + ic('file-description') + '</span>') +
        '<span class="ex-varre" aria-hidden="true"></span></div>' +
        '<p class="ex-etapa" aria-live="polite">Enviando o material</p><p class="ex-tempo">' + (DEMO ? 'Exemplo de demonstração: nada é enviado.' : 'Costuma levar de 15 a 60 segundos.') + '</p>';
      raiz.querySelector('#exForm').hidden = true; el.hidden = false;
      var etapas = ['Enviando o material', 'Lendo o exame', 'Descrevendo o que aparece', 'Separando o que dá para afirmar', 'Preparando como conferir'], i = 0;
      clearInterval(tela._rel);
      tela._rel = setInterval(function () {
        if (el.hidden || i >= etapas.length - 1) { clearInterval(tela._rel); return; }
        el.querySelector('.ex-etapa').textContent = etapas[++i];
      }, DEMO ? 800 : 6000);
    },
    voltaForm: function () {
      clearInterval(tela._rel);
      raiz.querySelector('#exLendo').hidden = true;
      raiz.querySelector('#exRes').hidden = true;
      raiz.querySelector('#exForm').hidden = false;
    },
    resultado: function (txt, titulo, fotos, demo) {
      clearInterval(tela._rel);
      var a = lerAnalise(txt);
      var el = raiz.querySelector('#exRes');
      var h = '<div class="ex-res-cab"><button type="button" class="ex-redondo" id="exNova" aria-label="Nova análise">' + ic('x') + '</button>' +
        '<h2 tabindex="-1" id="exResT">' + esc(titulo) + '</h2>' +
        '<button type="button" class="ex-redondo" id="exPartilha" aria-label="Compartilhar análise">' + ic('share') + '</button></div>';
      if (demo) h += '<p class="ex-selo-demo">' + ic('info-circle') + '<span><strong>Exemplo de demonstração.</strong> Imagem e análise fictícias, prontas; nada foi enviado à IA.</span></p>';
      if (fotos && fotos.length) {
        h += '<div class="ex-res-img"><div class="ex-res-fotos" id="exResFotos">' + fotos.map(function (f, i) {
          return '<button type="button" class="ex-res-foto" data-i="' + i + '" aria-label="Ver a imagem ' + (i + 1) + ' em tela cheia"><img src="' + esc(f.dataUrl || '') + '" alt=""></button>';
        }).join('') + '</div><button type="button" class="ex-recolhe" id="exRecolhe" aria-expanded="true" aria-controls="exResFotos">' + ic('chevron-up') + '<span>Recolher imagem</span></button></div>';
      }
      h += '<div class="ex-res-rola"><div class="ex-res-corpo">';
      if (a.alerta) h += '<div class="ex-alerta" role="note">' + ic('alert-triangle') + '<p>' + negrito(a.alerta) + '</p></div>';
      h += a.blocos.map(bloco).join('');
      if (!a.blocos.length) h += '<div class="ex-cru">' + String(txt || '').split(/\n{2,}/).map(function (p) { return '<p>' + negrito(p).replace(/\n/g, '<br>') + '</p>'; }).join('') + '</div>';
      h += '<p class="ex-rodape">Análise de estudo feita por IA. Pode errar e não é laudo. Confira no exame e não use para decidir conduta.</p>' +
        '<button type="button" class="bt-cheio ex-cheio" id="exNova2">' + ic('plus') + '<span>Nova análise</span></button></div></div>';
      el.innerHTML = h;
      raiz.querySelector('#exLendo').hidden = true;
      raiz.querySelector('#exForm').hidden = true;
      el.hidden = false;
      /* uma camada só para o resultado: o Voltar do aparelho volta ao formulário */
      if (!fechaRes) fechaRes = U.empilha(function () { fechaRes = null; tela.novo(); });
      var fechar = fechaRes;
      el.querySelector('#exNova').addEventListener('click', fechar);
      el.querySelector('#exNova2').addEventListener('click', fechar);
      el.querySelector('#exPartilha').addEventListener('click', function () {
        var texto = (demo ? 'Exemplo de demonstração (fictício)\n\n' : '') + txt;
        if (navigator.share) navigator.share({ title: 'Análise de exame: ' + titulo, text: texto }).catch(function () { });
        else U.copia(texto, 'Análise copiada.');
      });
      var rec = el.querySelector('#exRecolhe');
      if (rec) rec.addEventListener('click', function () {
        var fs = el.querySelector('#exResFotos'), aberto = fs.hidden;
        fs.hidden = !aberto;
        rec.setAttribute('aria-expanded', aberto ? 'true' : 'false');
        rec.innerHTML = ic(aberto ? 'chevron-up' : 'chevron-down') + '<span>' + (aberto ? 'Recolher imagem' : 'Mostrar imagem') + '</span>';
      });
      el.querySelectorAll('.ex-res-foto').forEach(function (b) { b.addEventListener('click', function () { verFoto(fotos[+b.dataset.i]); }); });
      el.querySelectorAll('.ex-confere input').forEach(function (cb) { cb.addEventListener('change', function () { cb.closest('li').classList.toggle('feito', cb.checked); }); });
      var t = el.querySelector('#exResT'); try { t.focus({ preventScroll: true }); } catch (e) { }
    },
    /* "Nova análise": limpa como o iPhone (fotos, resultados, leitura, contexto, região) e volta ao formulário */
    novo: function () {
      limparMidia();
      ['exTexto', 'exLeitura', 'exHistoria', 'exRegiao'].forEach(function (id) { var e = raiz.querySelector('#' + id); if (e) e.value = ''; });
      tela.voltaForm();
      tela.desenhaCaptura();
      var f = raiz.querySelector('#exForm'); f.scrollTop = 0;
    }
  };
  function campo(id, rotulo, ph, area) {
    return '<div class="ex-campo"><label for="' + id + '">' + esc(rotulo) + '</label>' +
      (area ? '<textarea id="' + id + '" rows="2" placeholder="' + esc(ph) + '" autocomplete="off"></textarea>'
        : '<input type="text" id="' + id + '" placeholder="' + esc(ph) + '" autocomplete="off" autocapitalize="off" spellcheck="false">') + '</div>';
  }
  function dobra(id, alvo, icone, nome) {
    return '<button type="button" class="ex-dobra" id="' + id + '" aria-expanded="false" aria-controls="' + alvo + '"><span class="ex-dobra-ic">' + ic(icone) + '</span>' +
      '<span class="ex-dobra-n">' + esc(nome) + '</span><span class="ex-opc">opcional</span>' + ic('chevron-down') + '</button>';
  }

  /* imagem em tela cheia (ZoomFoto): o gesto de pinça do navegador amplia */
  function verFoto(f) {
    if (!f) return;
    var c = D.createElement('div');
    c.className = 'ex-zoom'; c.setAttribute('role', 'dialog'); c.setAttribute('aria-modal', 'true'); c.setAttribute('aria-label', 'Imagem em tela cheia');
    c.innerHTML = '<img src="' + esc(f.dataUrl || f.thumbUrl || '') + '" alt=""><button type="button" class="ex-zoom-x" aria-label="Fechar imagem">' + ic('x') + '</button>';
    (D.getElementById('app') || D.body).appendChild(c);
    var antes = D.activeElement;
    var fechar = U.empilha(function () { c.remove(); if (antes && antes.focus) try { antes.focus({ preventScroll: true }); } catch (e) { } });
    c.querySelector('.ex-zoom-x').addEventListener('click', fechar);
    c.addEventListener('keydown', function (e) { if (e.key === 'Escape') fechar(); });
    var img = c.querySelector('img');
    img.addEventListener('dblclick', function () { img.classList.toggle('perto'); });
    c.querySelector('.ex-zoom-x').focus();
  }

  /* ================= histórico (HistoricoView) ================= */
  function quando(s) {
    var d = new Date(s); if (isNaN(d)) return '';
    return d.toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(/\s*de\s*/g, ' ').replace(' às', ',');
  }
  function abrirHistorico() {
    U.folha({
      titulo: 'Histórico', classe: 'folha-ex',
      conteudo: function (c, api) {
        var l = historico();
        c.innerHTML = '<h2 class="folha-titulo" data-foco tabindex="-1">Histórico</h2>' +
          '<p class="nota ex-hnota">' + (DEMO ? 'Exemplo de demonstração: análises fictícias, só nesta tela.' : 'Suas análises ficam na sua conta MedTech e aparecem em todos os seus aparelhos.') + '</p>' +
          (l.length ? '<div class="ex-hlista">' + l.map(function (a, i) {
            var sub = [a.region, quando(a.date)].filter(Boolean).join(' · ');
            return '<button type="button" class="ex-hitem" data-i="' + i + '"><span class="ex-circulo" aria-hidden="true">' + ic(iconeExame(a.modality)) + '</span>' +
              '<span class="ex-htx"><b>' + esc(curto(a.modality)) + '</b><span>' + esc(sub) + '</span></span>' + ic('chevron-right') + '</button>';
          }).join('') + '</div>'
            : '<p class="corpo t2">As análises que você fizer ficam aqui para abrir de novo.</p>');
        c.querySelectorAll('.ex-hitem').forEach(function (b) {
          b.addEventListener('click', function () {
            var a = l[+b.dataset.i]; if (!a || !a.text) return;
            api.fechar();
            setTimeout(function () { limparMidia(); tela.desenhaCaptura(); tela.resultado(a.text, curto(a.modality), a.demo ? [{ dataUrl: ECG_DEMO }] : [], !!a.demo); }, 30);
          });
        });
      }
    });
  }

  /* ================= ajustes (modelo e idioma, os do LaudAI) ================= */
  function abrirAjustes() {
    var G = (!DEMO && motor.fase === 'pronta') ? motor.pega('Gemini') : null;
    var modelo = G ? G.getModel() : st.ajustesDemo.modelo;
    var idioma = DEMO ? st.ajustesDemo.idioma : (lerLS(LS_LANG) || 'pt-BR');
    U.folha({
      titulo: 'Ajustes da IA', classe: 'folha-ex',
      conteudo: function (c, api) {
        var op = function (v, t, sel) { return '<option value="' + v + '"' + (v === sel ? ' selected' : '') + '>' + t + '</option>'; };
        c.innerHTML = '<h2 class="folha-titulo" data-foco tabindex="-1">Ajustes da IA</h2>' +
          '<p class="nota ex-hnota">Os mesmos do LaudAI. A IA vem incluída na conta MedTech.</p>' +
          '<div class="ex-campo"><label for="exModelo">Modelo</label><select id="exModelo">' + op('gemini-2.5-pro', 'Gemini 2.5 Pro, mais preciso (recomendado)', modelo) + op('gemini-2.5-flash', 'Gemini 2.5 Flash, mais rápido', modelo) + '</select></div>' +
          '<div class="ex-campo"><label for="exIdioma">Idioma da resposta</label><select id="exIdioma">' + op('pt-BR', 'Português (Brasil)', idioma) + op('en', 'English', idioma) + op('es', 'Español', idioma) + '</select></div>' +
          (!DEMO && !G ? '<p class="nota">A conta ainda está abrindo; o modelo escolhido vale assim que ela abrir.</p>' : '') +
          '<button type="button" class="bt-cheio ex-cheio" id="exAjSalvar">Salvar</button>';
        c.querySelector('#exAjSalvar').addEventListener('click', function () {
          var m = c.querySelector('#exModelo').value, i = c.querySelector('#exIdioma').value;
          if (DEMO) { st.ajustesDemo.modelo = m; st.ajustesDemo.idioma = i; }
          else {
            try { localStorage.setItem(LS_LANG, i); } catch (e) { }
            var g = motor.fase === 'pronta' ? motor.pega('Gemini') : null;
            if (g) g.setModel(m);
          }
          api.fechar();
          U.aviso('Ajustes salvos.');
        });
      }
    });
  }

  /* ================= demonstração (Motor.resultadoDemo e um ECG sintético) ================= */
  var RESULTADO_DEMO = [
    '⚠️ Possível supradesnivelamento de ST em parede inferior. Se o exame for de um paciente em atendimento, acione agora o médico responsável, sem depender desta análise.',
    '',
    '## Qualidade do material',
    'Foto de ECG de 12 derivações, legível, com leve inclinação. A calibração não aparece, então as medidas são aproximadas.',
    '',
    '## O que aparece no exame',
    '- **Ritmo sinusal**, com P positiva em DII antes de cada QRS (certeza alta)',
    '- **Supradesnivelamento de ST** em DII, DIII e aVF (certeza média)',
    '- **Infradesnivelamento de ST** em DI e aVL, que pode ser imagem em espelho (certeza média)',
    '- **Sem bloqueio de ramo** evidente, QRS estreito (certeza alta)',
    '- **V4R** não foi registrada, então não dá para avaliar o ventrículo direito (certeza baixa)',
    '',
    '## O que isso pode significar',
    '1. **Infarto de parede inferior**: combina com a elevação em DII, DIII e aVF e com a imagem em espelho em aVL.',
    '2. **Pericardite**: fala contra ela a falta de elevação difusa e a presença de espelho.',
    '3. **Repolarização precoce**: fala contra ela o infra recíproco em DI e aVL.',
    '',
    '## Como conferir você mesmo',
    '1. Confira a calibração no canto da folha.',
    '2. Olhe DII longo para ritmo e frequência.',
    '3. Compare DII, DIII e aVF com DI e aVL.',
    '4. Veja se a elevação em DIII é maior que em DII.',
    '5. Procure V1 a V3 para sinais de parede posterior.',
    '',
    '## Para fixar',
    '- Em infarto inferior, olhe as derivações direitas para avaliar o ventrículo direito.',
    '- Elevação em DIII maior que em DII sugere coronária direita.'
  ].join('\n');

  /* ECG de 12 derivações desenhado aqui (não é exame de ninguém): 25 mm/s, 10 mm/mV, 1 mm = 5 px, FC 75.
     Supra de ST em DII, DIII e aVF e infra em DI e aVL, para combinar com o exemplo acima. */
  var ECG_DEMO = (function () {
    var L = { // p, q, r, s, st, t (mV)
      'I': [.1, -.05, .7, -.1, -.1, -.08], 'II': [.15, -.05, 1.1, -.15, .25, .45], 'III': [.1, -.15, .8, -.1, .3, .5],
      'aVR': [-.12, 0, .15, -.8, -.05, -.2], 'aVL': [.05, -.05, .4, -.3, -.2, -.15], 'aVF': [.12, -.1, .9, -.1, .28, .45],
      'V1': [.08, 0, .25, -1, .05, .1], 'V2': [.1, 0, .45, -1.2, .1, .35], 'V3': [.1, 0, .8, -.8, .05, .35],
      'V4': [.1, -.05, 1.3, -.4, 0, .35], 'V5': [.1, -.08, 1.2, -.2, 0, .3], 'V6': [.1, -.08, 1, -.1, 0, .25]
    };
    var lerp = function (a, b, k) { return a + (b - a) * k; };
    function v(t, p) {
      t = ((t % .8) + .8) % .8;
      if (t < .09) return p[0] * Math.sin(Math.PI * t / .09);
      if (t < .16) return 0;
      if (t < .18) return lerp(0, p[1], (t - .16) / .02);
      if (t < .20) return lerp(p[1], p[2], (t - .18) / .02);
      if (t < .22) return lerp(p[2], p[3], (t - .20) / .02);
      if (t < .25) return lerp(p[3], p[4], (t - .22) / .03);
      if (t < .34) return p[4];
      if (t < .56) { var k = (t - .34) / .22; return p[4] * (1 - k) + p[5] * Math.sin(Math.PI * k); }
      return 0;
    }
    var X0 = 50, COL = 312.5, LIN = 140, TOPO = 30, PXS = 125, PXMV = 50;
    var grade = ['I', 'aVR', 'V1', 'V4'], g2 = ['II', 'aVL', 'V2', 'V5'], g3 = ['III', 'aVF', 'V3', 'V6'];
    var linhas = [grade, g2, g3], larg = X0 + COL * 4 + 20, alt = TOPO + LIN * 4 + 30;
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + larg + ' ' + alt + '" width="' + larg + '" height="' + alt + '">' +
      '<defs><pattern id="p" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M5 0H0V5" fill="none" stroke="#F4C6C6" stroke-width=".6"/></pattern>' +
      '<pattern id="g" width="25" height="25" patternUnits="userSpaceOnUse"><rect width="25" height="25" fill="url(#p)"/><path d="M25 0H0V25" fill="none" stroke="#E79A9A" stroke-width="1"/></pattern></defs>' +
      '<rect width="100%" height="100%" fill="#FFF7F6"/><rect width="100%" height="100%" fill="url(#g)"/>' +
      '<g fill="none" stroke="#1B1B1F" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">';
    var txt = '';
    function traco(base, x0, x1, lead) {
      var d = '';
      for (var x = x0; x <= x1; x += 1) { var y = base - v((x - X0) / PXS, L[lead]) * PXMV; d += (x === x0 ? 'M' : 'L') + x + ' ' + y.toFixed(1); }
      return '<path d="' + d + '"/>';
    }
    for (var r = 0; r < 4; r++) {
      var base = TOPO + LIN * r + 80;
      s += '<path d="M10 ' + base + 'H20V' + (base - 50) + 'H40V' + base + 'H' + X0 + '"/>';   // calibração 1 mV
      if (r < 3) {
        for (var c = 0; c < 4; c++) {
          var lead = linhas[r][c], xa = X0 + COL * c, xb = Math.round(xa + COL);
          s += traco(base, Math.round(xa), xb, lead);
          if (c > 0) s += '<path d="M' + Math.round(xa) + ' ' + (base - 12) + 'V' + (base + 12) + '"/>';
          txt += '<text x="' + (Math.round(xa) + 6) + '" y="' + (base - 52) + '">' + lead + '</text>';
        }
      } else {
        s += traco(base, X0, Math.round(X0 + COL * 4), 'II');
        txt += '<text x="' + (X0 + 6) + '" y="' + (base - 52) + '">II</text>';
      }
    }
    s += '</g><g font-family="Helvetica, Arial, sans-serif" font-size="15" font-weight="700" fill="#1B1B1F">' + txt +
      '<text x="' + X0 + '" y="' + (alt - 10) + '" font-size="13" font-weight="400" fill="#5D6579">25 mm/s · 10 mm/mV · ECG sintético de demonstração, sem dado de paciente</text></g></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  })();

  /* ================= encaixe na casca ================= */
  W.MedTechCasca.registrar('secao', 'exames', function (el) { tela.montar(el); });

  /* Para testes: window.MTExames. _usarMotor(janela) liga a tela a uma página do LaudAI já aberta (prova do caminho com conta). */
  W.MTExames = {
    motor: motor, tela: tela, lerAnalise: lerAnalise, historico: historico, ECG_DEMO: ECG_DEMO,
    _usarMotor: function (w) {
      motor.geracao++; motor.w = w; motor.S = w.eval('state'); w.toast = function (m) { U.aviso(String(m || '')); };
      DEMO = false; motor.fase = 'pronta'; tela.aoMotor();
    }
  };
})();
