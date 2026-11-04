/* MedTech PWA: peças das Ferramentas, iguais às do iPhone (FerramentasComum.swift e FerramentasIA.swift).
   - tela(): camada inteira com cabeçalho (voltar em círculo), área fixa, rolagem, barra acima do teclado numérico e pé;
     o Voltar do aparelho fecha a camada de cima (MTUI.empilha).
   - componentes em HTML: linha tingida, recolhível, segmentos, campo numérico grande, campo de texto, texto clínico (FerBlocos).
   - IA: painelIA() e telaAssistente() usam o prompt montado pelo JS original e o MT.ai do login central.
   Expõe window.MTFerUI. */
(function () {
  'use strict';
  var W = window, D = document;
  var U = W.MTUI, esc = U.esc, ic = U.ic;

  /* cor da ferramenta: fundo (texto branco), tom para áreas claras e tinta (Ferramentas.swift: corFundo, cor, corTinta) */
  var COR_TOM = { calculadoras: '#F76E1E', antibioticos: '#0E7C94', pocus: '#0F7F74', paliativos: '#D6336C' };
  function cores(f) {
    var x = (W.MedTechCasca && W.MedTechCasca.ferramentas[f]) || ['', '', '#5D6579'];
    return { fundo: x[2], tom: COR_TOM[f] || x[2], tinta: 'var(--ti-' + f + ')' };
  }
  function nome(f) { var x = W.MedTechCasca && W.MedTechCasca.ferramentas[f]; return x ? x[0] : f; }

  /* ---------- texto com marcas (1/2 negrito, 3/4 itálico) ---------- */
  function mk(s) {
    return esc(String(s == null ? '' : s)).replace(/\u0001/g, '<b>').replace(/\u0002/g, '</b>').replace(/\u0003/g, '<i>').replace(/\u0004/g, '</i>').replace(/\n/g, '<br>');
  }
  function sem(s) { return String(s == null ? '' : s).replace(/[\u0001-\u0004]/g, ''); }
  /* títulos e nomes sem travessão, como o nome das condutas na casca (nomeTela); o texto clínico fica como veio */
  function tit(s) { return String(s == null ? '' : s).replace(/\s+—\s+/g, ': '); }

  /* ---------- camadas ---------- */
  var abertas = 0, seq = 0;
  function tela(o) {
    var c = cores(o.ferramenta);
    var el = D.createElement('div');
    el.className = 'fer' + (o.classe ? ' ' + o.classe : '');
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', o.titulo || nome(o.ferramenta));
    el.style.setProperty('--fer', c.fundo);
    el.style.setProperty('--fer-c', c.tom);
    el.style.setProperty('--fer-t', c.tinta);
    var id = 'f' + (++seq);
    el.innerHTML = '<header class="fer-cab"><button type="button" class="fer-volta" data-acao="voltar" aria-label="Voltar">' + ic('chevron-left') + '</button>' +
      '<h1 class="fer-tit' + (o.grande ? ' grande' : '') + '" tabindex="-1"' + (o.corTitulo ? ' style="color:' + c.tinta + '"' : '') + '>' + esc(tit(o.titulo || '')) + '</h1><div class="fer-dir">' + (o.direita || '') + '</div></header>' +
      (o.progresso ? '<div class="fer-progresso' + (o.progresso === 'alto' ? ' alto' : '') + '" aria-hidden="true"><i style="width:0"></i></div>' : '') +
      '<div class="fer-fixo"></div>' + (o.semRola ? '' : '<div class="fer-rola"></div>') +
      '<div class="fer-teclado"><div class="faixa-slot"></div><div class="linha-bts"><button type="button" class="ok" data-acao="kb-ok">OK</button><button type="button" class="prox" data-acao="kb-prox">Próximo</button></div></div>' +
      '<div class="fer-pe"></div>';
    (D.getElementById('app') || D.body).appendChild(el);
    abertas++;
    D.body.classList.add('em-fer');
    var t = {
      id: id, el: el, ferramenta: o.ferramenta, cores: c,
      rola: el.querySelector('.fer-rola'), fixo: el.querySelector('.fer-fixo'), pe: el.querySelector('.fer-pe'), cab: el.querySelector('.fer-cab'),
      acoes: {}, lazy: {}, aoFechar: [],
      q: function (s) { return el.querySelector(s); },
      qa: function (s) { return el.querySelectorAll(s); },
      titulo: function (s) { s = tit(s); el.querySelector('.fer-tit').textContent = s; el.setAttribute('aria-label', s); },
      direita: function (h) { el.querySelector('.fer-dir').innerHTML = h; },
      progresso: function (f) { var i = el.querySelector('.fer-progresso > i'); if (i) i.style.width = (Math.max(0, Math.min(1, f)) * 100) + '%'; },
      voltar: null
    };
    var fechada = false;
    t.fechar = U.empilha(function () {
      if (fechada) return;
      fechada = true;
      t.aoFechar.forEach(function (f) { try { f(); } catch (e) { } });
      el.classList.remove('vis');
      el.classList.add('sai');
      abertas--;
      if (!abertas) D.body.classList.remove('em-fer');
      setTimeout(function () { el.remove(); }, U.reduz() ? 0 : 320);
    });
    el.addEventListener('click', function (e) {
      var a = e.target.closest('[data-acao]');
      if (!a || !el.contains(a)) return;
      var n = a.dataset.acao;
      if (n === 'voltar') { e.preventDefault(); if (t.voltar) t.voltar(); else t.fechar(); return; }
      if (n === 'rec') return alternaRec(t, a);
      if (n === 'limpa-busca') { var inp = a.parentNode.querySelector('input'); inp.value = ''; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.focus(); return; }
      if (n === 'kb-ok') { var f = D.activeElement; if (f && f.blur) f.blur(); return; }
      if (n === 'kb-prox') { var p = proximoNumero(t); if (p) p.focus(); return; }
      if (t.acoes[n]) { e.preventDefault(); t.acoes[n](a, e); }
    });
    /* toque nos botões da barra do teclado não pode tirar o foco do campo antes da ação */
    el.querySelector('.fer-teclado').addEventListener('mousedown', function (e) { if (e.target.closest('button')) e.preventDefault(); });
    el.addEventListener('input', function (e) {
      var x = e.target;
      if (x.matches('input[data-num]')) { var l = limpaNumero(x.value); if (l !== x.value) x.value = l; }
      if (x.matches('.fer-busca input')) { var b = x.parentNode.querySelector('.fer-limpa'); if (b) b.hidden = !x.value; }
      if (x.matches('textarea[data-cresce]')) cresce(x);
    });
    ligaTeclado(t);
    requestAnimationFrame(function () {
      el.classList.add('vis');
      var h = el.querySelector('.fer-tit');
      try { h.focus({ preventScroll: true }); } catch (e) { }
    });
    return t;
  }

  /* ---------- barra acima do teclado numérico (FerBarraTeclado) ---------- */
  function numeros(t) { return [].filter.call(t.el.querySelectorAll('input[data-num]'), function (x) { return !x.disabled && x.offsetParent !== null; }); }
  function proximoNumero(t) { var l = numeros(t), i = l.indexOf(D.activeElement); return i >= 0 && i + 1 < l.length ? l[i + 1] : null; }
  function ligaTeclado(t) {
    var el = t.el, bar = el.querySelector('.fer-teclado'), vv = W.visualViewport;
    function posiciona() {
      if (!el.classList.contains('teclado')) return;
      var r = el.getBoundingClientRect(), base = vv ? vv.offsetTop + vv.height : W.innerHeight;
      bar.style.bottom = Math.max(0, r.bottom - base) + 'px';
      var alvo = t.rola || el.querySelector('.pocus-pag') || null;
      if (alvo) alvo.style.paddingBottom = (bar.offsetHeight + 24) + 'px';
    }
    function atualiza() {
      var f = D.activeElement, ligado = !!(f && el.contains(f) && f.matches('input[data-num]'));
      el.classList.toggle('teclado', ligado);
      if (ligado) {
        bar.querySelector('.prox').hidden = !proximoNumero(t);
        bar.querySelector('.ok').style.marginRight = proximoNumero(t) ? '' : 'auto';
        posiciona();
        setTimeout(function () { try { f.scrollIntoView({ block: 'center', behavior: U.reduz() ? 'auto' : 'smooth' }); } catch (e) { } }, 60);
      } else {
        bar.style.bottom = '0px';
        if (t.rola) t.rola.style.paddingBottom = '';
      }
      if (t.aoTeclado) t.aoTeclado(ligado);
    }
    /* Enter no teclado numérico faz o papel do Próximo */
    el.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || !e.target.matches('input[data-num]')) return;
      e.preventDefault();
      var p = proximoNumero(t); if (p) p.focus(); else e.target.blur();
    });
    el.addEventListener('focusin', atualiza);
    el.addEventListener('focusout', function () { setTimeout(atualiza, 0); });
    if (vv) { vv.addEventListener('resize', posiciona); vv.addEventListener('scroll', posiciona); t.aoFechar.push(function () { vv.removeEventListener('resize', posiciona); vv.removeEventListener('scroll', posiciona); }); }
    t.faixaTeclado = function (h) { bar.querySelector('.faixa-slot').innerHTML = h || ''; if (el.classList.contains('teclado')) posiciona(); };
    t.atualizaTeclado = atualiza;
  }
  /* FerCampoLimpa.numero: só dígitos e um separador (vírgula ou ponto) */
  function limpaNumero(s) {
    var viu = false, r = '';
    for (var i = 0; i < s.length; i++) { var c = s[i]; if (c >= '0' && c <= '9') r += c; else if ((c === ',' || c === '.') && !viu) { viu = true; r += c; } }
    return r;
  }
  function cresce(x) { x.style.height = 'auto'; var max = +x.dataset.max || 0; var h = x.scrollHeight + 2; x.style.height = (max ? Math.min(h, max) : h) + 'px'; }

  /* ---------- componentes ---------- */
  function busca(dica, valor, attrs) {
    return '<div class="fer-busca">' + ic('search') + '<input type="search" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" placeholder="' + esc(dica) + '" aria-label="' + esc(dica) + '" value="' + esc(valor || '') + '" ' + (attrs || '') + '>' +
      '<button type="button" class="fer-limpa" data-acao="limpa-busca" aria-label="Limpar busca"' + (valor ? '' : ' hidden') + '>' + ic('x') + '</button></div>';
  }
  function linha(titulo, detalhe, tam, attrs) {
    return '<button type="button" class="fer-linha' + (tam ? ' t' + tam : '') + '" ' + (attrs || '') + '><b>' + mk(tit(titulo)) + '</b>' + (detalhe ? '<span>' + mk(detalhe) + '</span>' : '') + '</button>';
  }
  function sobre(t) { return '<h2 class="fer-sobre">' + esc(t) + '</h2>'; }
  function aviso(t) { return t ? '<p class="fer-aviso">' + mk(t) + '</p>' : ''; }
  /* FerRecolhivel: o conteúdo pode vir pronto ou ser desenhado ao abrir (lazy) */
  var recSeq = 0;
  function recolhivel(o) {
    var id = 'rc' + (++recSeq);
    return '<div class="fer-rec' + (o.botao ? ' botao' : '') + (o.tam ? ' t' + o.tam : '') + '"><button type="button" data-acao="rec" aria-expanded="' + (o.aberto ? 'true' : 'false') + '" aria-controls="' + id + '"' + (o.lazy ? ' data-lazy="' + esc(o.lazy) + '"' : '') + (o.chave ? ' data-chave="' + esc(o.chave) + '"' : '') + '>' +
      '<b' + (o.cor ? ' style="color:' + o.cor + '"' : '') + '>' + esc(tit(o.titulo)) + '</b>' + (o.detalhe != null ? '<span>' + esc(o.detalhe) + '</span>' : '') + ic('chevron-down') + '</button>' +
      '<div class="fer-rec-c' + (o.recuo ? ' recuo' : '') + '" id="' + id + '"' + (o.aberto ? '' : ' hidden') + '>' + (o.aberto || !o.lazy ? (o.conteudo || '') : '') + '</div></div>';
  }
  function alternaRec(t, b) {
    var aberto = b.getAttribute('aria-expanded') !== 'true';
    var c = b.nextElementSibling;
    if (aberto && b.dataset.lazy && !c.dataset.feito && t.lazy[b.dataset.lazy]) { c.innerHTML = t.lazy[b.dataset.lazy](b); c.dataset.feito = '1'; }
    b.setAttribute('aria-expanded', aberto);
    c.hidden = !aberto;
    if (t.aoRec) t.aoRec(b, aberto);
  }
  function segmentos(opcoes, sel, attrs, alto) {
    return '<div class="fer-seg' + (alto ? ' alto' : '') + '" role="group">' + opcoes.map(function (o) {
      /* a quebra cai depois da barra ("Hospitalar/ nosocomial"), nunca no meio da palavra */
      return '<button type="button"' + (o.nome.length > 14 ? ' class="longo"' : '') + ' aria-pressed="' + (o.id === sel) + '" data-v="' + esc(o.id) + '" ' + (attrs || '') + '>' + esc(o.nome).replace(/\//g, '/<wbr>') + '</button>';
    }).join('') + '</div>';
  }
  function marcaSeg(grupo, v) { [].forEach.call(grupo.querySelectorAll('button'), function (b) { b.setAttribute('aria-pressed', b.dataset.v === v); }); }
  function campoNumero(t, o) {
    var id = t.id + '-' + o.id;
    return '<div class="fer-num' + (o.t24 ? ' t24' : '') + (o.off ? ' off' : '') + '"><label for="' + id + '">' + esc(o.rotulo) + '</label>' +
      '<input id="' + id + '" data-num data-campo="' + esc(o.id) + '" type="text" inputmode="decimal" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="next" placeholder="' + esc(o.dica || '') + '" value="' + esc(o.valor || '') + '"' + (o.off ? ' disabled' : '') + '></div>';
  }
  function campoTexto(t, o) {
    var id = t.id + '-' + o.id, l = o.linhas || [1, 1];
    var ctrl = l[1] > 1 || o.multi
      ? '<textarea id="' + id + '" data-campo="' + esc(o.id) + '" rows="' + l[0] + '" data-cresce data-max="' + Math.round(l[1] * 25.2 + 34) + '" placeholder="' + esc(o.dica || '') + '" autocomplete="off">' + esc(o.valor || '') + '</textarea>'
      : '<input id="' + id + '" data-campo="' + esc(o.id) + '" type="text" placeholder="' + esc(o.dica || '') + '" value="' + esc(o.valor || '') + '" autocomplete="off">';
    return '<div class="fer-texto"><label for="' + id + '">' + esc(o.rotulo) + '</label>' + ctrl + '</div>';
  }

  /* ---------- texto clínico (FerBlocos, FerCaixa, FerTabela) ---------- */
  function caixa(tipo, texto) {
    if (tipo === 'ref') return '<p class="fer-ref">' + mk(texto) + '</p>';
    var fx = (tipo === 'perola' || tipo === 'tip') ? 'ok' : (tipo === 'atencao' || tipo === 'warn') ? 'atencao' : tipo === 'dose' ? 'info' : '';
    var rot = tipo === 'perola' ? '<b>Pérola: </b>' : tipo === 'atencao' ? '<b>Atenção: </b>' : '';
    return '<div class="fer-caixa ' + fx + '">' + rot + mk(texto) + '</div>';
  }
  function tabelaH(h, r) {
    return '<div class="fer-tab">' + r.map(function (l) {
      return '<div><span class="t1">' + mk(l[0] || '') + '</span>' + l.slice(1).map(function (v, k) {
        var c = k + 1;
        return v ? '<span class="tc">' + (c < h.length && h[c] ? '<small>' + esc(sem(h[c])) + '</small>' : '') + '<span>' + mk(v) + '</span></span>' : '';
      }).join('') + '</div>';
    }).join('') + '</div>';
  }
  function bloco(b) {
    switch (b.t) {
      case 'h': return '<p class="bh" role="heading" aria-level="3">' + mk(b.x) + '</p>';
      case 'g': return '<p class="bg">' + mk(b.x) + '</p>';
      case 'l': var tag = b.o ? 'ol' : 'ul'; return '<' + tag + '>' + (b.i || []).map(function (i) { return '<li><span>' + mk(i) + '</span></li>'; }).join('') + '</' + tag + '>';
      case 'c': return caixa(b.k || '', b.x || '');
      case 'tab': return tabelaH(b.h || [], b.r || []);
      default: return '<p>' + mk(b.x) + '</p>';
    }
  }
  function blocos(bs, tam, cor) {
    return '<div class="fer-blocos" style="--tam:' + (tam || 18) + 'px' + (cor ? ';--fer-t:' + cor : '') + '">' + (bs || []).map(bloco).join('') + '</div>';
  }
  /* FerSecoesVista: seções em blocos, abertas por padrão (ou só as primeiras `abertas`) */
  function secoesVista(secoes, abertas, tam) {
    if (abertas == null) abertas = Infinity;
    return '<div class="fer-pilha g0">' + secoes.map(function (s, i) {
      if (!s.titulo) return '<div style="padding:6px 0">' + blocos(s.blocos, tam) + '</div>';
      return recolhivel({ titulo: sem(s.titulo), aberto: i < abertas, conteudo: blocos(s.blocos, tam) });
    }).join('') + '</div>';
  }
  function semTituloInicial(s) {
    if (s.length && !s[0].titulo && s[0].blocos.every(function (b) { return b.t === 'h'; })) return s.slice(1);
    return s;
  }
  var FAIXA_IC = { ok: 'circle-check', atencao: 'alert-triangle', alerta: 'alert-octagon', info: 'info-circle', neutra: 'circle-minus' };
  var FAIXA_FALA = { ok: 'faixa favorável', atencao: 'faixa de atenção', alerta: 'faixa de alerta', info: 'informação', neutra: '' };
  function iconeFaixa(f) { return f === 'neutra' ? '' : '<i class="ti ti-' + FAIXA_IC[f] + '" role="img" aria-label="' + FAIXA_FALA[f] + '"></i>'; }

  /* ---------- copiar ---------- */
  function copiar(texto) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(texto).catch(function () { velho(texto); });
    velho(texto); return Promise.resolve();
    function velho(x) { var a = D.createElement('textarea'); a.value = x; a.setAttribute('readonly', ''); a.style.position = 'fixed'; a.style.opacity = '0'; D.body.appendChild(a); a.select(); try { D.execCommand('copy'); } catch (e) { } a.remove(); }
  }

  /* ---------- IA (FerIA, PainelIA, TelaAssistenteIA) ---------- */
  function bloqueio() {
    if (W.MedTechCasca && W.MedTechCasca.demo) return null;
    if (navigator.onLine === false) return 'Sem conexão: a IA precisa de internet. O restante desta tela funciona offline.';
    var M = W.MT;
    if (!M || !M.ai) return 'A conta ainda está conectando. Tente de novo em alguns segundos.';
    if (!M.user) return 'Entre na sua conta MedTech para usar a IA. O restante desta tela funciona sem conta.';
    return null;
  }
  function pedirIA(p) {
    if (W.MedTechCasca && W.MedTechCasca.demo) {
      /* só no modo de demonstração: deixa claro que não veio da IA e mostra o tamanho do prompt montado */
      return new Promise(function (ok) { setTimeout(function () { ok('## Resposta simulada\n- Modo de demonstração: esta resposta **não veio da IA**.\n- Prompt original montado com ' + p.prompt.length + ' caracteres, modelo ' + p.modelo + '.\n\n## Exemplo de lista\n- Primeiro item\n- Segundo item'); }, 700); });
    }
    return Promise.resolve().then(function () { return W.MT.ai(p.prompt, p.modelo, p.opcoes); }).then(function (t) {
      if (!t) throw new Error('Sem resposta da IA. Tente de novo em alguns segundos.');
      return t;
    }, function (e) { throw new Error(String((e && e.message) || e).replace(/^Error: /, '')); });
  }
  /* o: {rotulo, ocupado, nota, copiar, liberado(), pedido()} */
  function painelIA(t, onde, o) {
    var st = { ocupado: false, resp: null, erro: null, copiado: false };
    function desenha() {
      var lib = o.liberado ? o.liberado() : true, bl = bloqueio();
      onde.innerHTML = '<div class="fer-ia"><button type="button" class="fer-cheio t18" data-ia="gerar"' + (st.ocupado || !lib ? ' disabled' : '') + '>' + (st.ocupado ? '<span class="fer-roda" aria-hidden="true"></span>' : '') + esc(st.ocupado ? (o.ocupado || 'Gerando') : o.rotulo) + '</button>' +
        (bl ? caixa('warn', bl) : '') +
        (st.erro ? caixa('warn', st.erro) + '<button type="button" class="fer-texto-bt" data-ia="gerar">Tentar de novo</button>' : '') +
        (st.resp != null ? '<div class="resp" aria-live="polite">' + secoesVista(W.MTFer.motor.md(st.resp)) + '</div>' +
          (o.copiar ? '<button type="button" class="fer-leve" data-ia="copiar">' + esc(st.copiado ? 'Copiado' : o.copiar) + '</button>' : '') + (o.nota ? aviso(o.nota) : '') : '') + '</div>';
    }
    onde.addEventListener('click', function (e) {
      var b = e.target.closest('[data-ia]'); if (!b) return;
      if (b.dataset.ia === 'copiar') { copiar(st.resp.trim()); st.copiado = true; desenha(); return; }
      gerar();
    });
    function gerar() {
      if (st.ocupado || bloqueio()) return;
      var p = o.pedido(); if (!p) return;
      st.ocupado = true; st.erro = null; st.copiado = false; desenha();
      pedirIA(p).then(function (r) { st.resp = r; }, function (e) { st.erro = e.message; }).then(function () { st.ocupado = false; desenha(); });
    }
    desenha();
    return { atualiza: function () { var b = onde.querySelector('[data-ia="gerar"]'); if (b && !st.ocupado) b.disabled = o.liberado ? !o.liberado() : false; } };
  }
  /* Conversa: o histórico e o prompt ficam no código original (chat.reiniciar/enviar/responder/falhar) */
  function telaAssistente(o) {
    var t = tela({ ferramenta: o.ferramenta, titulo: o.titulo });
    var msgs = [], ocupado = false;
    o.chat.reiniciar();
    t.pe.innerHTML = '<div class="chat-pe"><textarea rows="1" data-cresce data-max="132" placeholder="' + esc(o.dica) + '" aria-label="' + esc(o.dica) + '"></textarea><button type="button" data-acao="enviar" disabled>Enviar</button></div>';
    var caixaTxt = t.pe.querySelector('textarea'), btEnv = t.pe.querySelector('button');
    caixaTxt.addEventListener('input', function () { btEnv.disabled = ocupado || !caixaTxt.value.trim(); });
    caixaTxt.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(caixaTxt.value); } });
    function desenha() {
      var bl = bloqueio(), h = '<div class="fer-pilha">';
      if (bl) h += caixa('warn', bl);
      if (!msgs.length) h += '<h2 class="fer-h22">Comece por uma pergunta</h2><div>' + o.sugestoes.map(function (s, i) { return linha(s, null, 18, 'data-acao="sug" data-i="' + i + '"'); }).join('') + '</div>';
      msgs.forEach(function (m) {
        if (m.eu) h += '<div class="chat-eu">' + esc(m.texto) + '</div>';
        else if (m.erro) h += caixa('warn', m.texto);
        else h += secoesVista(W.MTFer.motor.md(m.texto));
      });
      if (ocupado) h += '<div class="chat-roda" role="status" aria-label="Gerando resposta"></div>';
      h += aviso(o.aviso) + '</div>';
      t.rola.innerHTML = h;
      t.rola.scrollTop = t.rola.scrollHeight;
    }
    function enviar(q) {
      var pergunta = String(q || '').trim();
      if (!pergunta || ocupado || bloqueio()) return;
      var p = o.chat.enviar(pergunta); if (!p) return;
      caixaTxt.value = ''; cresce(caixaTxt); caixaTxt.blur();
      msgs.push({ eu: true, texto: pergunta });
      ocupado = true; btEnv.disabled = true; desenha();
      pedirIA(p).then(function (r) { o.chat.responder(r); msgs.push({ texto: r }); }, function (e) { o.chat.falhar(e.message); msgs.push({ texto: e.message, erro: true }); })
        .then(function () { ocupado = false; btEnv.disabled = !caixaTxt.value.trim(); desenha(); });
    }
    t.acoes.sug = function (b) { enviar(o.sugestoes[+b.dataset.i]); };
    t.acoes.enviar = function () { enviar(caixaTxt.value); };
    desenha();
    return t;
  }

  /* carregando: tela já aberta enquanto o JS original chega; falha mostra o motivo e tenta de novo */
  function carregando(t, prom, aoPronto) {
    t.rola.innerHTML = '<p class="fer-carrega" role="status">Abrindo</p>';
    prom.then(function (r) { aoPronto(r); }, function (e) {
      console.warn(e);
      t.rola.innerHTML = '<div class="fer-pilha"><p class="fer-nada">Não foi possível abrir esta ferramenta. Confira a conexão.</p><button type="button" class="fer-leve" data-acao="tentar">Tentar de novo</button></div>';
      t.acoes.tentar = function () { t.fechar(); if (t.reabrir) setTimeout(t.reabrir, 0); };
    });
  }

  W.MTFerUI = {
    tela: tela, cores: cores, nome: nome, mk: mk, sem: sem, tit: tit, busca: busca, linha: linha, sobre: sobre, aviso: aviso, recolhivel: recolhivel, segmentos: segmentos, marcaSeg: marcaSeg,
    campoNumero: campoNumero, campoTexto: campoTexto, caixa: caixa, blocos: blocos, secoesVista: secoesVista, semTituloInicial: semTituloInicial, iconeFaixa: iconeFaixa,
    copiar: copiar, bloqueio: bloqueio, pedirIA: pedirIA, painelIA: painelIA, telaAssistente: telaAssistente, carregando: carregando, limpaNumero: limpaNumero
  };
})();
