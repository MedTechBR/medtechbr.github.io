/* ============================================================
   CondutAI · didática da leitura (24/09/2026)
   Só APRESENTAÇÃO, determinística: não muda texto, dose nem fluxograma.
   Entra depois de renderResultDireto: CVD.realca(rc, item).
   - fluxograma: Diagrama (cabe na caixa) | Passo a passo (interpreta a
     fonte do mermaid) | Ampliar (tela cheia com zoom);
   - guia rápido no topo: atalhos para as seções-chave e a lista de
     trechos que citam dose;
   - seções com ícone e cor por tipo, tempo de leitura e "Próxima";
   - pérolas em cartões, avisos em caixa, doses em destaque, tabelas
     com cabeçalho e 1ª coluna fixos;
   - barra fina de progresso de leitura.
   ============================================================ */
(function () {
  'use strict';
  var W = window, D = document;

  /* ---------------- utilidades ---------------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function norm(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  function espaco(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function reduz() { try { return W.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function rola(el, bloco) { if (el && el.scrollIntoView) el.scrollIntoView({ behavior: reduz() ? 'auto' : 'smooth', block: bloco || 'start' }); }
  function palavras(t) { return String(t || '').trim().split(/\s+/).filter(Boolean).length; }
  function curto(t, n) { t = espaco(t); return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : t; }

  /* ============================================================
     1. FLUXOGRAMA: interpretador da fonte mermaid (flowchart/graph)
     ============================================================ */
  function desfaz(s) {
    return String(s || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  }
  function semAspas(t) {
    t = String(t == null ? '' : t).trim();
    if (t.length >= 2 && t[0] === '"' && t[t.length - 1] === '"') t = t.slice(1, -1);
    return t;
  }
  // texto de nó ou de aresta: <br/> vira quebra; entidades do mermaid (#quot;) voltam a ser caractere
  function textoNo(t) {
    t = semAspas(t);
    var md = /^`[\s\S]*`$/.test(t);
    if (md) t = t.slice(1, -1).replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');
    t = t.replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?(?:b|strong|i|em|u|small|sub|sup)>/gi, '')
      .replace(/#quot;/g, '"').replace(/#(\d+);/g, function (m, n) { return String.fromCharCode(+n); });
    return t.split('\n').map(espaco).filter(Boolean).join('\n');
  }
  // quebra a fonte em comandos (linha ou ';' fora de aspas, colchetes e |rótulo|)
  function comandos(src) {
    var out = [], cur = '', q = false, dep = 0, pipe = false;
    for (var i = 0; i < src.length; i++) {
      var c = src[i];
      if (c === '\n' || c === '\r') { out.push(cur); cur = ''; q = false; dep = 0; pipe = false; continue; }
      if (q) { if (c === '"') q = false; cur += c; continue; }
      if (c === '"') { q = true; cur += c; continue; }
      if (c === '[' || c === '(' || c === '{') dep++;
      else if ((c === ']' || c === ')' || c === '}') && dep > 0) dep--;
      else if (c === '|' && dep === 0) pipe = !pipe;
      else if (c === ';' && dep === 0 && !pipe) { out.push(cur); cur = ''; continue; }
      cur += c;
    }
    out.push(cur);
    return out.map(function (s) { return s.trim(); }).filter(function (s) { return s && s.indexOf('%%') !== 0; });
  }
  var RE_ID = /[A-Za-z0-9_\u00C0-\u024F]+/y;
  var ABRE = ['(((', '((', '([', '[[', '[(', '[/', '[\\', '{{', '(', '[', '{', '>'];
  var FECHA = { '(((': [')))'], '((': ['))'], '([': ['])'], '[[': [']]'], '[(': [')]'], '[/': ['/]', '\\]'], '[\\': ['\\]', '/]'], '{{': ['}}'], '(': [')'], '[': [']'], '{': ['}'], '>': [']'] };
  var RE_LIG_TXT = /[ \t]*<?(--|==|-\.)(?![-=.>])[ \t]*([^\n]*?)[ \t]*(-{2,}>|={2,}>|\.-+>|-{3,}|={3,}|\.-+)/y;
  var RE_LIG = /[ \t]*<?(-{2,}>|={2,}>|-\.+->|-\.+-(?![ox])|-{3,}|={3,}|~{3,}|-{2,}[ox]|={2,}[ox]|-\.+-[ox])/y;
  var RE_PIPE = /[ \t]*\|([^|]*)\|/y;

  function achaFecha(s, i, fechas) { for (var k = 0; k < fechas.length; k++) if (s.startsWith(fechas[k], i)) return fechas[k]; return null; }
  function lerNo(s, p) {
    RE_ID.lastIndex = p;
    var m = RE_ID.exec(s);
    if (!m) return null;
    var id = m[0], texto = null, forma = null, cls = null;
    p = RE_ID.lastIndex;
    var q = p; while (s[q] === ' ' || s[q] === '\t') q++;
    var ab = null, ini = p;
    for (var a = 0; a < ABRE.length; a++) {
      var at = ABRE[a] === '>' ? p : q;
      if (s.startsWith(ABRE[a], at)) { ab = ABRE[a]; ini = at; break; }
    }
    if (ab) {
      var i = ini + ab.length, fechas = FECHA[ab], f;
      while (s[i] === ' ') i++;
      if (s[i] === '"') {
        var j = s.indexOf('"', i + 1);
        if (j < 0) return null;
        texto = s.slice(i, j + 1); i = j + 1;
        while (s[i] === ' ') i++;
        f = achaFecha(s, i, fechas);
        if (!f) return null;
        i += f.length;
      } else {
        var dep = 0, k = i, achou = -1;
        for (; k < s.length; k++) {
          if (dep === 0) { f = achaFecha(s, k, fechas); if (f) { achou = k; break; } }
          var c = s[k];
          if (c === '[' || c === '(' || c === '{') dep++;
          else if ((c === ']' || c === ')' || c === '}') && dep > 0) dep--;
        }
        if (achou < 0) return null;
        texto = s.slice(i, achou); i = achou + f.length;
      }
      p = i; forma = ab;
    }
    var mc = /^:::([\w-]+)/.exec(s.slice(p));
    if (mc) { cls = mc[1]; p += mc[0].length; }
    return { id: id, texto: texto, forma: forma, cls: cls, p: p };
  }
  function lerGrupo(s, p) {
    var nos = [];
    for (;;) {
      while (s[p] === ' ' || s[p] === '\t') p++;
      var n = lerNo(s, p);
      if (!n) return null;
      nos.push(n); p = n.p;
      var q = p; while (s[q] === ' ' || s[q] === '\t') q++;
      if (s[q] === '&') { p = q + 1; continue; }
      return { nos: nos, p: p };
    }
  }
  function novoGrafo() { return { nos: new Map(), arestas: 0 }; }
  function defineNo(G, n) {
    var no = G.nos.get(n.id);
    if (!no) { no = { id: n.id, texto: null, cls: new Set(), saidas: [], entradas: 0, ordem: G.nos.size }; G.nos.set(n.id, no); }
    if (n.texto != null) no.texto = textoNo(n.texto);
    if (n.cls) no.cls.add(n.cls);
    return no;
  }
  function lerCadeia(s, G) {
    var r = lerGrupo(s, 0);
    if (!r) return false;
    var grupos = [r.nos], rotulos = [], p = r.p, m;
    for (;;) {
      while (s[p] === ' ' || s[p] === '\t') p++;
      if (p >= s.length) break;
      var rot = null;
      RE_LIG_TXT.lastIndex = p; m = RE_LIG_TXT.exec(s);
      if (m) { rot = m[2]; p = RE_LIG_TXT.lastIndex; }
      else {
        RE_LIG.lastIndex = p; m = RE_LIG.exec(s);
        if (!m) return false;
        p = RE_LIG.lastIndex;
        RE_PIPE.lastIndex = p; var mp = RE_PIPE.exec(s);
        if (mp) { rot = mp[1]; p = RE_PIPE.lastIndex; }
      }
      var g = lerGrupo(s, p);
      if (!g) return false;
      rotulos.push(rot); grupos.push(g.nos); p = g.p;
    }
    grupos.forEach(function (ns) { ns.forEach(function (n) { defineNo(G, n); }); });
    rotulos.forEach(function (rot, i) {
      grupos[i].forEach(function (a) {
        grupos[i + 1].forEach(function (b) {
          var na = G.nos.get(a.id), nb = G.nos.get(b.id);
          na.saidas.push({ para: b.id, rotulo: rot == null ? '' : textoNo(rot).replace(/\n/g, ' ') });
          nb.entradas++; G.arestas++;
        });
      });
    });
    return true;
  }
  // devolve {nos, raizes, arestas} ou null (e aí o Passo a passo some; o diagrama fica)
  function parseFluxo(fonte) {
    var cmds = comandos(desfaz(fonte));
    if (!cmds.length || !/^(flowchart|graph)\b/i.test(cmds[0])) return null;
    var G = novoGrafo(), falhas = 0, m;
    for (var i = 0; i < cmds.length; i++) {
      var s = cmds[i];
      if (i === 0) {
        m = /^(?:flowchart|graph)(?:[ \t]+(?:TD|TB|BT|LR|RL))?[ \t]*(.*)$/i.exec(s);
        if (!m) return null;
        s = m[1].trim();
        if (!s) continue;
      }
      if (/^(classDef|style|linkStyle|click|direction|subgraph|end|accTitle|accDescr|title)\b/.test(s)) continue;
      if ((m = /^class[ \t]+(.+?)[ \t]+([\w-]+)$/.exec(s))) {
        var cls = m[2];
        m[1].split(',').forEach(function (id) {
          id = id.trim(); if (!id) return;
          defineNo(G, { id: id, texto: null, cls: cls });
        });
        continue;
      }
      if (!lerCadeia(s, G)) falhas++;
    }
    if (falhas || G.nos.size < 2 || !G.arestas) return null;
    var lista = Array.from(G.nos.values());
    lista.forEach(function (n) { if (n.texto == null || n.texto === '') n.texto = n.id; });
    var raizes = lista.filter(function (n) { return !n.entradas && n.saidas.length; }).map(function (n) { return n.id; });
    if (!raizes.length) raizes = [(lista.find(function (n) { return n.saidas.length; }) || lista[0]).id];
    return { nos: G.nos, raizes: raizes, arestas: G.arestas };
  }
  // para o teste: da(s) raiz(es) chega-se a um fim (nó sem saída)?
  function temFim(G) {
    var vis = new Set(), fila = G.raizes.slice();
    while (fila.length) {
      var id = fila.shift();
      if (vis.has(id)) continue; vis.add(id);
      var n = G.nos.get(id);
      if (!n.saidas.length) return true;
      n.saidas.forEach(function (s) { fila.push(s.para); });
    }
    return false;
  }

  /* ---------------- tamanho do diagrama ---------------- */
  var ESC_MIN = 0.62;
  function natural(svg) {
    if (!svg.dataset.cvdW) {
      var w = parseFloat(svg.getAttribute('width')), h = parseFloat(svg.getAttribute('height'));
      var vb = svg.viewBox && svg.viewBox.baseVal;
      if (!(w > 0) || /%/.test(svg.getAttribute('width') || '') || !(h > 0)) { w = vb && vb.width; h = vb && vb.height; }
      if (!(w > 0) || !(h > 0)) { var r = svg.getBoundingClientRect(); w = r.width; h = r.height; }
      svg.dataset.cvdW = w; svg.dataset.cvdH = h;
    }
    return { w: +svg.dataset.cvdW, h: +svg.dataset.cvdH };
  }
  function ajustaSvg(svg, caixa) {
    if (!svg || !caixa || !caixa.isConnected || svg.closest('.cvd-zoom')) return;
    var n = natural(svg);
    if (!(n.w > 0)) return;
    var cs = getComputedStyle(caixa);
    var livre = caixa.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
    if (livre <= 0) return;
    var e = Math.min(1, livre / n.w);
    if (e < ESC_MIN) e = ESC_MIN;
    svg.style.width = Math.round(n.w * e) + 'px';
    svg.style.height = Math.round(n.h * e) + 'px';
    caixa.classList.toggle('cvd-rola', n.w * e > livre + 1);
    var wrap = caixa.closest('.mermaid-wrap');
    if (wrap) wrap.classList.toggle('cvd-reduzido', e < 0.999);
  }
  var roFluxo = typeof ResizeObserver === 'function' ? new ResizeObserver(function (ents) {
    ents.forEach(function (en) {
      var caixa = en.target, w = Math.round(en.contentRect.width);
      if (caixa._cvdW === w) return;
      caixa._cvdW = w;
      ajustaSvg(caixa.querySelector('.mermaid svg'), caixa);
    });
  }) : null;

  /* ---------------- Passo a passo ---------------- */
  var TAG = {
    critical: '<span class="cvd-no-tag"><i class="ti ti-alert-triangle" aria-hidden="true"></i>Alarme ou decisão crítica</span>',
    action: '<span class="cvd-no-tag"><i class="ti ti-stethoscope" aria-hidden="true"></i>Conduta</span>'
  };
  function tipoNo(n) { return n.cls.has('critical') ? 'critical' : n.cls.has('action') ? 'action' : ''; }
  function linhas(t) { return esc(t).replace(/\n/g, '<br>'); }
  function montaPasso(G, rotulo) {
    var box = D.createElement('div');
    box.className = 'cvd-passo';
    box.setAttribute('role', 'region');
    box.setAttribute('aria-label', 'Fluxograma passo a passo');
    var caminho = G.raizes.length === 1 ? [G.raizes[0]] : [];
    function desenha(foca) {
      var h = '';
      if (caminho.length) {
        h += '<nav class="cvd-trilha" aria-label="Caminho percorrido"><ol>';
        caminho.forEach(function (id, i) {
          var n = G.nos.get(id), t = curto(n.texto.split('\n')[0], 34);
          if (i === caminho.length - 1) h += '<li aria-current="step"><span class="cvd-t-at"><b>' + (i + 1) + '</b>' + esc(t) + '</span></li>';
          else h += '<li><button type="button" data-acao="ir" data-i="' + i + '" title="Voltar a este passo: ' + esc(espaco(n.texto)) + '"><b>' + (i + 1) + '</b>' + esc(t) + '</button><i class="ti ti-chevron-right" aria-hidden="true"></i></li>';
        });
        h += '</ol></nav>';
        var at = G.nos.get(caminho[caminho.length - 1]), tp = tipoNo(at);
        h += '<div class="cvd-no" data-tipo="' + tp + '" tabindex="-1"><div class="cvd-no-topo"><span class="cvd-no-n">Passo ' + caminho.length + '</span>' + (TAG[tp] || '') + '</div>' +
          '<p class="cvd-no-tx">' + linhas(at.texto) + '</p></div>';
        if (at.saidas.length) {
          // com rótulo (Sim/Não, faixas) é uma escolha; sem rótulo, são passos seguintes do mesmo ramo
          var rotS = at.saidas.length === 1 ? 'Próximo passo' : at.saidas.some(function (s) { return s.rotulo; }) ? 'Escolha o caminho' : 'Próximos passos';
          h += '<div class="cvd-saidas" role="group" aria-label="' + rotS + '"><p class="cvd-saidas-rot">' + rotS + '</p>';
          at.saidas.forEach(function (s) {
            var dest = G.nos.get(s.para), dt = espaco(dest.texto);
            h += '<button type="button" class="cvd-saida" data-acao="seguir" data-para="' + esc(s.para) + '" data-tipo="' + tipoNo(dest) + '">' +
              (s.rotulo ? '<span class="cvd-s-txt"><b>' + esc(s.rotulo) + '</b><small>' + esc(dt) + '</small></span>' : '<span class="cvd-s-txt"><b>' + esc(dt) + '</b></span>') +
              '<i class="ti ti-arrow-right" aria-hidden="true"></i></button>';
          });
          h += '</div>';
        } else {
          h += '<div class="cvd-fim"><i class="ti ti-flag-check" aria-hidden="true"></i><span>Fim do fluxo</span></div>';
        }
      } else {
        h += '<div class="cvd-no cvd-no-ini" tabindex="-1"><p class="cvd-no-tx">Por onde começar?</p></div><div class="cvd-saidas" role="group" aria-label="Pontos de partida">';
        G.raizes.forEach(function (id) {
          var n = G.nos.get(id);
          h += '<button type="button" class="cvd-saida" data-acao="raiz" data-para="' + esc(id) + '" data-tipo="' + tipoNo(n) + '"><span class="cvd-s-txt"><b>' + esc(espaco(n.texto)) + '</b></span><i class="ti ti-arrow-right" aria-hidden="true"></i></button>';
        });
        h += '</div>';
      }
      var podeVoltar = caminho.length > 1 || (caminho.length === 1 && G.raizes.length > 1);
      h += '<div class="cvd-pacoes"><button type="button" data-acao="voltar"' + (podeVoltar ? '' : ' disabled') + '><i class="ti ti-arrow-left" aria-hidden="true"></i>Voltar</button>' +
        '<button type="button" data-acao="recomecar"' + (caminho.length > 1 || (G.raizes.length > 1 && caminho.length) ? '' : ' disabled') + '><i class="ti ti-refresh" aria-hidden="true"></i>Recomeçar</button></div>';
      box.innerHTML = h;
      var tr = box.querySelector('.cvd-trilha ol');
      if (tr) tr.scrollLeft = tr.scrollWidth;
      if (foca) {
        var no = box.querySelector('.cvd-no');
        if (no) {
          no.classList.add('cvd-entra');
          try { no.focus({ preventScroll: true }); } catch (e) { no.focus(); }
          var r = box.getBoundingClientRect();
          if (r.top < 80 || r.top > W.innerHeight * 0.6) rola(box, 'start');
        }
      }
    }
    box.addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-acao]');
      if (!b || !box.contains(b)) return;
      var a = b.dataset.acao;
      if (a === 'seguir') caminho.push(b.dataset.para);
      else if (a === 'raiz') caminho = [b.dataset.para];
      else if (a === 'ir') caminho = caminho.slice(0, +b.dataset.i + 1);
      else if (a === 'voltar') { if (caminho.length > 1) caminho.pop(); else if (G.raizes.length > 1) caminho = []; }
      else if (a === 'recomecar') caminho = G.raizes.length === 1 ? [G.raizes[0]] : [];
      desenha(true);
    });
    desenha(false);
    box.hidden = true;
    return box;
  }

  /* ---------------- Ampliar (tela cheia) ---------------- */
  var zoomAberto = null;
  function focaveis(el) {
    return Array.prototype.filter.call(el.querySelectorAll('button:not([disabled]),[tabindex]:not([tabindex="-1"])'), function (x) { return x.offsetParent !== null; });
  }
  function abreZoom(wrap, botao) {
    var svg = wrap.querySelector('.mermaid svg');
    if (!svg || zoomAberto) return;
    var n = natural(svg), z = 1;
    var titulo = espaco((wrap.querySelector('.mermaid-label span') || {}).textContent || 'Fluxograma');
    var ov = D.createElement('div');
    ov.className = 'cvd-zoom';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', titulo + ' ampliado');
    ov.innerHTML = '<div class="cvd-zbarra"><span class="cvd-ztit"><i class="ti ti-git-fork" aria-hidden="true"></i><span>' + esc(titulo) + '</span></span>' +
      '<div class="cvd-zctl" role="group" aria-label="Zoom"><button type="button" data-z="menos" aria-label="Diminuir"><i class="ti ti-minus" aria-hidden="true"></i></button>' +
      '<output class="cvd-zpct" aria-live="polite">100%</output><button type="button" data-z="mais" aria-label="Aumentar"><i class="ti ti-plus" aria-hidden="true"></i></button>' +
      '<button type="button" data-z="ajustar" class="cvd-zaj">Ajustar</button></div>' +
      '<button type="button" class="cvd-zfecha" data-z="fechar" aria-label="Fechar"><i class="ti ti-x" aria-hidden="true"></i><span>Fechar</span></button></div>' +
      '<div class="cvd-zarea" tabindex="0" aria-label="Fluxograma: role nos dois sentidos"><div class="cvd-zin"></div></div>';
    var marca = D.createComment('cvd-svg');
    svg.parentNode.insertBefore(marca, svg);
    var area = ov.querySelector('.cvd-zarea'), dentro = ov.querySelector('.cvd-zin'), pct = ov.querySelector('.cvd-zpct');
    dentro.appendChild(svg);
    D.body.appendChild(ov);
    D.documentElement.classList.add('cvd-travado');
    function aplica(nz, manter) {
      nz = Math.max(0.25, Math.min(3, nz));
      var cx = 0.5, cy = 0.5;
      if (manter && dentro.scrollWidth) {
        cx = (area.scrollLeft + area.clientWidth / 2) / dentro.scrollWidth;
        cy = (area.scrollTop + area.clientHeight / 2) / dentro.scrollHeight;
      }
      z = nz;
      svg.style.width = Math.round(n.w * z) + 'px';
      svg.style.height = Math.round(n.h * z) + 'px';
      pct.textContent = Math.round(z * 100) + '%';
      if (manter) {
        area.scrollLeft = cx * dentro.scrollWidth - area.clientWidth / 2;
        area.scrollTop = cy * dentro.scrollHeight - area.clientHeight / 2;
      }
    }
    function ajusta() {
      var pad = 48;
      aplica(Math.min((area.clientWidth - pad) / n.w, (area.clientHeight - pad) / n.h, 2), false);
      area.scrollLeft = 0; area.scrollTop = 0;
    }
    function fecha() {
      if (marca.parentNode) marca.parentNode.replaceChild(svg, marca);
      if (ov._cvdSai) ov._cvdSai();
      ov.remove();
      D.documentElement.classList.remove('cvd-travado');
      D.removeEventListener('keydown', tecla, true);
      zoomAberto = null;
      svg.style.width = ''; svg.style.height = '';
      ajustaSvg(svg, wrap.querySelector('.mermaid-scroll'));
      if (botao && botao.isConnected) botao.focus();
    }
    function tecla(ev) {
      if (ev.key === 'Escape') { ev.preventDefault(); fecha(); return; }
      if (ev.key === 'Tab') {
        var f = focaveis(ov);
        if (!f.length) return;
        var i = f.indexOf(D.activeElement);
        if (ev.shiftKey && (i <= 0)) { ev.preventDefault(); f[f.length - 1].focus(); }
        else if (!ev.shiftKey && (i === f.length - 1 || i < 0)) { ev.preventDefault(); f[0].focus(); }
        return;
      }
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (ev.key === '+' || ev.key === '=') { ev.preventDefault(); aplica(z * 1.25, true); }
      else if (ev.key === '-' || ev.key === '_') { ev.preventDefault(); aplica(z / 1.25, true); }
      else if (ev.key === '0') { ev.preventDefault(); ajusta(); }
    }
    ov.addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-z]');
      if (!b) return;
      var k = b.dataset.z;
      if (k === 'fechar') fecha();
      else if (k === 'mais') aplica(z * 1.25, true);
      else if (k === 'menos') aplica(z / 1.25, true);
      else if (k === 'ajustar') ajusta();
    });
    // arrastar com o mouse para mover (no toque, o dedo já rola)
    var arr = null;
    area.addEventListener('pointerdown', function (ev) {
      if (ev.pointerType !== 'mouse' || ev.button !== 0) return;
      arr = { x: ev.clientX, y: ev.clientY, l: area.scrollLeft, t: area.scrollTop };
      area.classList.add('cvd-arrasta');
    });
    function move(ev) {
      if (!arr) return;
      area.scrollLeft = arr.l - (ev.clientX - arr.x);
      area.scrollTop = arr.t - (ev.clientY - arr.y);
    }
    function solta() { arr = null; area.classList.remove('cvd-arrasta'); }
    W.addEventListener('pointermove', move);
    W.addEventListener('pointerup', solta);
    ov._cvdSai = function () { W.removeEventListener('pointermove', move); W.removeEventListener('pointerup', solta); };
    D.addEventListener('keydown', tecla, true);
    zoomAberto = ov;
    aplica(1, false);
    // no celular o tamanho natural raramente cabe: começa ajustado à largura, mas nunca abaixo do mínimo legível
    if (n.w > area.clientWidth - 48) aplica(Math.max(ESC_MIN, (area.clientWidth - 48) / n.w), false);
    var fb = ov.querySelector('.cvd-zfecha');
    try { fb.focus({ preventScroll: true }); } catch (e) { fb.focus(); }
  }

  /* ---------------- montagem de cada fluxograma ---------------- */
  function montaFluxo(wrap) {
    if (wrap.dataset.cvd) return;
    wrap.dataset.cvd = '1';
    var rot = wrap.querySelector('.mermaid-label'), caixa = wrap.querySelector('.mermaid-scroll'), el = wrap.querySelector('.mermaid');
    if (!rot || !caixa || !el) return;
    var G = null;
    try { G = parseFluxo(el.getAttribute('data-source') || ''); } catch (e) { G = null; }
    var ctl = D.createElement('div'), leg = null, passo = null, mexeu = false;
    ctl.className = 'cvd-fctl';
    if (G) ctl.innerHTML = '<div class="cvd-seg" role="group" aria-label="Modo de exibição"><button type="button" data-modo="diagrama" aria-pressed="true">Diagrama</button><button type="button" data-modo="passo" aria-pressed="false">Passo a passo</button></div>';
    rot.appendChild(ctl);
    if (G) { passo = montaPasso(G); wrap.appendChild(passo); }
    function modo(m, foca) {
      wrap.dataset.modo = m;
      caixa.hidden = m === 'passo';
      if (leg) leg.hidden = m === 'passo';
      if (passo) passo.hidden = m !== 'passo';
      ctl.querySelectorAll('[data-modo]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.modo === m)); });
      var s = el.querySelector('svg');
      if (m === 'diagrama' && s) ajustaSvg(s, caixa);
      if (foca && m === 'passo' && passo) { var no = passo.querySelector('.cvd-no'); if (no) try { no.focus({ preventScroll: true }); } catch (e) { } }
    }
    // o que depende do desenho pronto (o mermaid pode terminar depois)
    function comSvg(svg) {
      if (wrap._cvdSvg) return;
      wrap._cvdSvg = true;
      var amp = D.createElement('button');
      amp.type = 'button';
      amp.className = 'cvd-amplia';
      amp.setAttribute('aria-label', 'Ampliar fluxograma');
      amp.innerHTML = '<i class="ti ti-arrows-maximize" aria-hidden="true"></i><span>Ampliar</span>';
      ctl.appendChild(amp);
      // legenda das cores (só as que o fluxograma usa)
      var temC = G ? Array.from(G.nos.values()).some(function (n) { return n.cls.has('critical'); }) : !!svg.querySelector('.node.critical');
      var temA = G ? Array.from(G.nos.values()).some(function (n) { return n.cls.has('action'); }) : !!svg.querySelector('.node.action');
      if (temC || temA) {
        leg = D.createElement('div');
        leg.className = 'cvd-legenda';
        leg.innerHTML = (temC ? '<span><i class="cvd-cor cvd-cor-c" aria-hidden="true"></i>Alarme ou decisão crítica</span>' : '') +
          (temA ? '<span><i class="cvd-cor cvd-cor-a" aria-hidden="true"></i>Conduta</span>' : '');
        leg.hidden = caixa.hidden;
        caixa.parentNode.insertBefore(leg, caixa.nextSibling);
      }
      svg.style.maxWidth = 'none';
      if (roFluxo) roFluxo.observe(caixa);
      ajustaSvg(svg, caixa);
    }
    ctl.addEventListener('click', function (ev) {
      var b = ev.target.closest('button');
      if (!b) return;
      if (b.dataset.modo) { mexeu = true; modo(b.dataset.modo, true); }
      else if (b.classList.contains('cvd-amplia')) abreZoom(wrap, b);
    });
    var svg = el.querySelector('svg');
    if (svg) comSvg(svg);
    else if (typeof MutationObserver === 'function') {
      var mo = new MutationObserver(function () {
        var s = el.querySelector('svg');
        if (!s) return;
        mo.disconnect();
        comSvg(s);
        if (!mexeu && W.innerWidth >= 700) modo('diagrama', false);
      });
      mo.observe(el, { childList: true });
      setTimeout(function () { mo.disconnect(); }, 20000);
    }
    modo(G && (W.innerWidth < 700 || !svg) ? 'passo' : 'diagrama', false);
  }
  function fluxos(container) {
    if (!container) return;
    container.querySelectorAll('.mermaid-wrap').forEach(function (w) {
      try { montaFluxo(w); } catch (e) { /* um fluxograma com problema não derruba o resto */ }
    });
  }

  /* ============================================================
     2. DOSES: número + unidade de dose (não pega exame: mg/dL, mEq/L…)
     ============================================================ */
  var NUM = '(?:\\d{1,3}(?:\\.\\d{3})+|\\d+)(?:[.,]\\d+)?';
  var SEP = '\\s*(?:[-–—]|a|até|ou|/)\\s*';
  var UNI = '(?:mcg|µg|μg|mg|g|UI|U|mEq|mmol|ng|J|gotas|gts|microgotas|mL(?=\\/kg)|ml(?=\\/kg))';
  var POR = '(?:\\/(?:kg|h|hora|min|dia|d|m²|m2|dose|semana|sem))*';
  var DOSE_SRC = '(?<![\\w,./])' + NUM + '(?:' + SEP + NUM + ')*\\s?' + UNI + POR + '(?![\\w/²])';
  function reDoseG() { return new RegExp(DOSE_SRC, 'g'); }
  // mL/kg depois de < > ≤ ≥ é limiar (diurese, CVF), não dose: fica de fora
  function achaDoses(t) {
    var re = reDoseG(), out = [], m;
    while ((m = re.exec(t))) {
      if (/mL/i.test(m[0]) && /[<>≤≥]\s*$/.test(t.slice(Math.max(0, m.index - 3), m.index))) continue;
      out.push(m);
    }
    return out;
  }
  function temDose(t) { return achaDoses(t).length > 0; }
  function marcaDoses(t) {
    var out = '', ult = 0;
    achaDoses(t).forEach(function (m) { out += esc(t.slice(ult, m.index)) + '<b>' + esc(m[0]) + '</b>'; ult = m.index + m[0].length; });
    return out + esc(t.slice(ult));
  }
  // recorta ~180 caracteres em volta da 1ª dose, sempre em espaço (nunca no meio do número)
  function recorta(t, max) {
    max = max || 180;
    t = espaco(t);
    if (t.length <= max) return t;
    var m = achaDoses(t)[0], ini = 0;
    if (m && m.index + m[0].length > max - 10) {
      ini = Math.max(0, m.index - 50);
      var sp = t.lastIndexOf(' ', ini);
      ini = sp < 0 ? 0 : sp + 1;
    }
    var fim = ini + max;
    if (m && fim < m.index + m[0].length) fim = m.index + m[0].length;
    if (fim < t.length) { var sp2 = t.lastIndexOf(' ', fim); if (sp2 > ini + 40 && (!m || sp2 >= m.index + m[0].length)) fim = sp2; }
    return (ini > 0 ? '…' : '') + t.slice(ini, fim).replace(/[\s,;:–—-]+$/, '') + (fim < t.length ? '…' : '');
  }
  var FORA_DOSE = '.mermaid-wrap, summary, .cvd-guia, .cvd-prox, .sources, .wb-related';
  var ALVO_DOSE = 'li, p, blockquote, tbody tr';
  function colheDoses(secs, soltos) {
    var lista = [], vistos = new Set();
    function add(sec, el, texto, ini, fim) {
      var k = espaco(texto);
      if (!k || vistos.has(k)) return;
      vistos.add(k);
      lista.push({ sec: sec, el: el, texto: recorta(k), ini: ini, fim: fim });
    }
    function trata(el, sec) {
      if (el.closest(FORA_DOSE)) return;
      if (el.tagName === 'P' && el.parentElement && el.parentElement.closest('li, blockquote')) return;
      if (el.tagName === 'TR') {
        var tt = Array.prototype.map.call(el.cells, function (c) { return espaco(c.textContent); }).filter(Boolean).join(' · ');
        if (temDose(tt)) add(sec, el, tt);
        return;
      }
      var bruto = el.textContent || '';
      if (!temDose(bruto)) return;
      if (el.tagName === 'LI') { add(sec, el, bruto); return; }
      // parágrafo: frase por frase, guardando a posição para destacar o trecho exato.
      // fim de frase = . ! ? seguido de espaço e maiúscula/número (não corta "0.5" nem "p. ex.")
      var corte = /[.!?](?=\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ*"(\d])/g, m, pos = 0, frases = [];
      while ((m = corte.exec(bruto))) { frases.push([pos, m.index + 1]); pos = m.index + 1; }
      frases.push([pos, bruto.length]);
      frases.forEach(function (f) {
        var fr = bruto.slice(f[0], f[1]), lead = fr.length - fr.replace(/^\s+/, '').length;
        if (temDose(fr)) add(sec, el, fr, f[0] + lead, f[1]);
      });
    }
    function varre(raiz, sec) {
      if (raiz.matches(ALVO_DOSE)) trata(raiz, sec);
      raiz.querySelectorAll(ALVO_DOSE).forEach(function (el) { trata(el, sec); });
    }
    (soltos || []).forEach(function (el) { varre(el, null); });
    secs.forEach(function (d) { var b = d.querySelector(':scope > .wb-acc-body'); if (b) varre(b, d); });
    return lista;
  }

  /* ============================================================
     3. SEÇÕES: tipo pelo título (ícone e cor), tempo, "Próxima"
     ============================================================ */
  var TIPOS = [
    { k: 'perolas', re: /perola|erros comuns/, ic: 'ti-bulb', cor: 'ambar' },
    { k: 'internar', re: /quando internar|internac|quando encaminhar|encaminhar|quando operar|\buti\b|terapia intensiva/, ic: 'ti-building-hospital', cor: 'rosa' },
    { k: 'diferencial', re: /diferencia/, ic: 'ti-arrows-split-2', cor: 'teal' },
    { k: 'tratamento', re: /tratamento|conduta|manejo|abordagem terap|terapeutica|\bterapia\b|prescric|antibioticoterapia|analgesia/, ic: 'ti-pill', cor: 'verde' },
    { k: 'complicacoes', re: /complica|efeitos adversos|toxicidade/, ic: 'ti-alert-circle', cor: 'laranja' },
    { k: 'seguimento', re: /seguimento|\balta\b|acompanhamento|prognostico|orientac/, ic: 'ti-calendar-check', cor: 'teal' },
    { k: 'populacoes', re: /popula|situacoes especiais|grupos especiais|gestante|gestacao|pediatri/, ic: 'ti-users', cor: 'indigo' },
    { k: 'sus', re: /\bsus\b|brasil|disponibilidade/, ic: 'ti-map-2', cor: 'azul' },
    { k: 'epidemio', re: /epidemiolog|magnitude|incidencia|prevalencia|fatores de risco/, ic: 'ti-chart-bar', cor: 'indigo' },
    { k: 'fisio', re: /fisiopatolog|etiolog|causas|mecanismo|agente|conceito|visao geral|genetica|definic|farmacolog/, ic: 'ti-dna-2', cor: 'violeta' },
    { k: 'classificacao', re: /classifica|gravidade|estratifica|estadiamento|escore/, ic: 'ti-stairs-up', cor: 'laranja' },
    { k: 'diagnostico', re: /diagnost|exames|investigac|avaliac|criterios|imagem|laborat/, ic: 'ti-microscope', cor: 'ciano' },
    { k: 'apresentacao', re: /apresenta|\bquadro\b|reconhecimento|quando suspeitar|sinais e sintomas|exame fisico|historia clinica/, ic: 'ti-stethoscope', cor: 'azul' },
    { k: 'fluxo', re: /fluxograma|algoritmo/, ic: 'ti-git-fork', cor: 'violeta' }
  ];
  // pérolas, quando internar e diferencial vencem sempre ("Diagnóstico diferencial" é diferencial);
  // nos demais vence o tipo cuja palavra aparece PRIMEIRO ("Complicações e seguimento" = complicações)
  var FORTES = { perolas: 1, internar: 1, diferencial: 1 };
  function tipoDe(titulo) {
    var t = norm(titulo), melhor = null, pos = 1e9;
    for (var i = 0; i < TIPOS.length; i++) {
      var tp = TIPOS[i], m = tp.re.exec(t);
      if (!m) continue;
      if (FORTES[tp.k]) return tp;
      if (m.index < pos) { pos = m.index; melhor = tp; }
    }
    return melhor;
  }
  function tituloDe(d) { var s = d.querySelector(':scope > summary'); return espaco(s ? s.textContent : ''); }
  function abreSecao(d, alvo, destaca) {
    if (!d) return;
    d.open = true;
    var el = alvo || d;
    // espera o details abrir para medir a posição certa
    requestAnimationFrame(function () {
      rola(el, alvo ? 'center' : 'start');
      if (destaca && alvo) pisca(alvo);
    });
  }
  var hlTimer = 0;
  function pisca(el, ini, fim) {
    el.classList.remove('cvd-pisca');
    void el.offsetWidth;
    el.classList.add('cvd-pisca');
    setTimeout(function () { el.classList.remove('cvd-pisca'); }, 2200);
    // trecho exato da frase, sem mexer no DOM (CSS Custom Highlight API, onde existir)
    if (ini != null && W.CSS && CSS.highlights && typeof Highlight === 'function') {
      try {
        var r = faixa(el, ini, fim);
        if (r) {
          CSS.highlights.set('cvd-trecho', new Highlight(r));
          clearTimeout(hlTimer);
          hlTimer = setTimeout(function () { CSS.highlights.delete('cvd-trecho'); }, 3200);
        }
      } catch (e) { }
    }
  }
  function faixa(el, ini, fim) {
    var tw = D.createTreeWalker(el, NodeFilter.SHOW_TEXT), n, pos = 0, r = D.createRange(), achouIni = false;
    while ((n = tw.nextNode())) {
      var len = n.nodeValue.length;
      if (!achouIni && ini <= pos + len) { r.setStart(n, Math.max(0, ini - pos)); achouIni = true; }
      if (achouIni && fim <= pos + len) { r.setEnd(n, Math.max(0, fim - pos)); return r; }
      pos += len;
    }
    return null;
  }

  function decoraSecoes(rc, secs) {
    secs.forEach(function (d, i) {
      var sum = d.querySelector(':scope > summary'), corpo = d.querySelector(':scope > .wb-acc-body');
      if (!sum || !corpo || sum.querySelector('.cvd-st')) return;
      var titulo = tituloDe(d), tp = tipoDe(titulo);
      d.dataset.cvdTipo = tp ? tp.k : '';
      var st = D.createElement('span');
      st.className = 'cvd-st';
      while (sum.firstChild) st.appendChild(sum.firstChild);
      if (tp) {
        d.classList.add('cvd-tip');
        d.style.setProperty('--k', 'var(--c-' + tp.cor + ')');
        var ic = D.createElement('i');
        ic.className = 'ti ' + tp.ic + ' cvd-sic';
        ic.setAttribute('aria-hidden', 'true');
        sum.appendChild(ic);
      }
      sum.appendChild(st);
      // meta discreta: tempo de leitura e o que a seção tem
      var txt = corpo.textContent || '';
      corpo.querySelectorAll('.mermaid-wrap').forEach(function (w) { txt = txt.replace(w.textContent, ' '); });
      var min = Math.max(1, Math.round(palavras(txt) / 200)), meta = [min + ' min'];
      var nt = corpo.querySelectorAll('table').length, nf = corpo.querySelectorAll('.mermaid-wrap').length;
      if (nt) meta.push(nt > 1 ? nt + ' tabelas' : 'tabela');
      if (nf) meta.push(nf > 1 ? nf + ' fluxogramas' : 'fluxograma');
      if (d._cvdDoses) meta.push('doses');
      st.setAttribute('data-meta', meta.join(' · '));
      // "Próxima" no fim do corpo
      var prox = secs[i + 1];
      if (prox) {
        var b = D.createElement('div');
        b.className = 'cvd-prox';
        b.innerHTML = '<button type="button"><span>Próxima: <b>' + esc(curto(tituloDe(prox), 48)) + '</b></span><i class="ti ti-arrow-right" aria-hidden="true"></i></button>';
        b.firstChild.addEventListener('click', function () {
          d.open = false;
          prox.open = true;
          requestAnimationFrame(function () { rola(prox, 'start'); var s = prox.querySelector(':scope > summary'); if (s) try { s.focus({ preventScroll: true }); } catch (e) { } });
        });
        corpo.appendChild(b);
      }
    });
    // sumário lateral: o mesmo ícone e cor da seção
    var lista = rc.querySelector('#cvSumLista');
    if (lista) lista.querySelectorAll('button').forEach(function (b) {
      var d = secs[+b.dataset.i], tp = d && tipoDe(tituloDe(d)), i = b.querySelector('i');
      if (!tp || !i) return;
      i.textContent = '';
      i.className = 'ti ' + tp.ic + ' cvd-sumic';
      i.setAttribute('aria-hidden', 'true');
      b.style.setProperty('--k', 'var(--c-' + tp.cor + ')');
    });
  }

  /* ============================================================
     texto solto: o md() não põe <p> no parágrafo colado ao título (## Título\ntexto),
     então a 1ª frase de muitas seções fica como texto solto no corpo. Aqui ela ganha
     um <p> (o texto não muda): assim entra nas doses, nas pérolas e nos avisos, e
     pega o mesmo tamanho de letra dos outros parágrafos.
     ============================================================ */
  var INLINE = /^(STRONG|EM|B|I|A|BUTTON|CODE|BR|SPAN|SUB|SUP|SMALL|MARK|U|S|DEL|INS|ABBR|KBD)$/;
  function embrulhaSoltos(pai) {
    var run = [];
    function fecha() {
      var tem = run.some(function (n) { return n.nodeType === 3 ? /\S/.test(n.nodeValue) : n.tagName !== 'BR'; });
      if (tem) {
        while (run.length && run[0].nodeType === 1 && run[0].tagName === 'BR') run.shift();
        var p = D.createElement('p');
        p.className = 'cvd-solto';
        pai.insertBefore(p, run[0]);
        run.forEach(function (n) { p.appendChild(n); });
      }
      run = [];
    }
    Array.prototype.slice.call(pai.childNodes).forEach(function (n) {
      if (n.nodeType === 3 || (n.nodeType === 1 && INLINE.test(n.tagName))) run.push(n);
      else if (n.nodeType !== 8) fecha();
    });
    fecha();
  }

  /* ============================================================
     4. PÉROLAS em cartões; avisos em caixa
     ============================================================ */
  var RE_ALERTA = /^(erro|nao|nunca|evite|evitar|armadilha|cuidado|esquecer)\b/;
  var RE_AVISO = /^(erro|atencao|cuidado)\b/;
  function comecaComStrong(el) {
    var n = el.firstChild;
    while (n && n.nodeType === 3 && !n.nodeValue.trim()) n = n.nextSibling;
    return n && n.nodeType === 1 && (n.tagName === 'STRONG' || (n.tagName === 'EM' && n.querySelector('strong'))) ? n : null;
  }
  function icone(cls, ic) {
    var s = D.createElement('span');
    s.className = cls;
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = '<i class="ti ' + ic + '"></i>';
    return s;
  }
  function perolas(secs) {
    secs.forEach(function (d) {
      var corpo = d.querySelector(':scope > .wb-acc-body');
      if (!corpo) return;
      if (d.dataset.cvdTipo === 'perolas') {
        // cada item de lista é uma pérola; parágrafo também, se abre em negrito ou se a seção não tem lista
        var itens = [], lis = corpo.querySelectorAll(':scope > ul > li, :scope > ol > li');
        lis.forEach(function (li) { itens.push(li); li.parentNode.classList.add('cvd-perolas'); });
        corpo.querySelectorAll(':scope > p').forEach(function (p) {
          if (!/\S/.test(p.textContent)) return;
          if (comecaComStrong(p) || !lis.length) itens.push(p);
        });
        itens.forEach(function (el) {
          var t = norm(espaco(el.textContent)).replace(/^[^a-z0-9]+/, '');
          var alerta = RE_ALERTA.test(t);
          el.classList.add('cvd-perola', alerta ? 'cvd-p-alerta' : 'cvd-p-dica');
          el.insertBefore(icone('cvd-pic', alerta ? 'ti-alert-triangle' : 'ti-bulb'), el.firstChild);
        });
        return;
      }
      corpo.querySelectorAll('p, li').forEach(function (el) {
        if (el.closest('.mermaid-wrap, table, .cvd-perola')) return;
        var s = comecaComStrong(el);
        if (!s) return;
        if (!RE_AVISO.test(norm(espaco(s.textContent)))) return;
        el.classList.add('cvd-aviso');
        el.insertBefore(icone('cvd-aic', 'ti-alert-triangle'), el.firstChild);
      });
    });
  }

  /* ============================================================
     5. números de dose em destaque (só dentro de <strong>)
     ============================================================ */
  function destacaDoses(content) {
    content.querySelectorAll('strong').forEach(function (s) {
      if (s.closest('.mermaid-wrap, summary, a, button, .cvd-guia')) return;
      var t = espaco(s.textContent);
      if (t.length > 60 || !temDose(t)) return;
      s.classList.add('cvd-dose');
    });
  }

  /* ============================================================
     6. TABELAS: cabeçalho e 1ª coluna fixos, sombra de "tem mais"
     ============================================================ */
  var roTab = typeof ResizeObserver === 'function' ? new ResizeObserver(function (ents) { ents.forEach(function (en) { if (en.target._cvdSombra) en.target._cvdSombra(); }); }) : null;
  function tabelas(content) {
    content.querySelectorAll('.tbl-scroll').forEach(function (sc) {
      if (sc.parentNode.classList.contains('cvd-tbl')) return;
      var w = D.createElement('div');
      w.className = 'cvd-tbl';
      sc.parentNode.insertBefore(w, sc);
      w.appendChild(sc);
      var tb = sc.querySelector('table'), nc = tb && tb.rows[0] ? tb.rows[0].cells.length : 0;
      if (nc >= 3) { w.classList.add('cvd-tbl-3'); w.style.setProperty('--cvd-cols', nc); }
      function sombra() {
        var mais = sc.scrollWidth - sc.clientWidth;
        w.classList.toggle('cvd-larga', mais > 1);
        w.classList.toggle('cvd-e', sc.scrollLeft > 2);
        w.classList.toggle('cvd-d', mais - sc.scrollLeft > 2);
      }
      sc._cvdSombra = sombra;
      sc.addEventListener('scroll', sombra, { passive: true });
      if (roTab) roTab.observe(sc);
      sombra();
    });
  }

  /* ============================================================
     7. GUIA RÁPIDO no topo
     ============================================================ */
  var ATALHOS = [
    { k: 'tratamento', rot: 'Tratamento' },
    { k: 'internar', rot: 'Quando internar' },
    { k: 'fluxo', rot: 'Fluxograma' },
    { k: 'diagnostico', rot: 'Diagnóstico' },
    { k: 'perolas', rot: 'Pérolas' }
  ];
  var guiaN = 0;
  function guia(rc, secs, doses) {
    var art = rc.querySelector('.result'), content = rc.querySelector('.content');
    if (!art || !content || art.querySelector('.cvd-guia')) return;
    var ats = [];
    ATALHOS.forEach(function (a) {
      var d = null, alvo = null, tp = TIPOS.find(function (t) { return t.k === a.k; });
      if (a.k === 'fluxo') {
        alvo = content.querySelector('.mermaid-wrap');
        d = alvo && alvo.closest('details.wb-acc');
        if (!alvo) return;
      } else {
        d = secs.find(function (s) { return s.dataset.cvdTipo === a.k; });
        if (!d) return;
      }
      ats.push({ rot: a.rot, d: d, alvo: alvo, tp: tp, tit: d ? tituloDe(d) : a.rot });
    });
    if (!ats.length && !doses.length) return;
    var id = 'cvdDoses' + (++guiaN);
    var g = D.createElement('nav');
    g.className = 'cvd-guia';
    g.setAttribute('aria-label', 'Guia rápido da conduta');
    var h = '';
    if (ats.length) {
      h += '<div class="cvd-atalhos"><span class="cvd-ir">Ir para</span>';
      ats.forEach(function (a, i) {
        h += '<button type="button" class="cvd-pilula" data-at="' + i + '" style="--k:var(--c-' + a.tp.cor + ')" title="' + esc(a.tit) + '"><i class="ti ' + a.tp.ic + '" aria-hidden="true"></i>' + esc(a.rot) + '</button>';
      });
      h += '</div>';
    }
    if (doses.length) {
      h += '<button type="button" class="cvd-dosesbt" aria-expanded="false" aria-controls="' + id + '"><i class="ti ti-vaccine" aria-hidden="true"></i><span>Doses desta conduta <span class="cvd-n">(' + doses.length + ')</span></span><i class="ti ti-chevron-down cvd-chev" aria-hidden="true"></i></button>';
      h += '<div class="cvd-doses" id="' + id + '" hidden>';
      // agrupa por seção, na ordem da conduta
      var grupos = [], porSec = new Map();
      doses.forEach(function (x, i) {
        var k = x.sec || 'intro';
        if (!porSec.has(k)) { porSec.set(k, []); grupos.push(k); }
        porSec.get(k).push(i);
      });
      grupos.forEach(function (k) {
        var d = k === 'intro' ? null : k, tp = d ? tipoDe(tituloDe(d)) : null;
        h += '<section class="cvd-dgrupo"' + (tp ? ' style="--k:var(--c-' + tp.cor + ')"' : '') + '><h4>' + (tp ? '<i class="ti ' + tp.ic + '" aria-hidden="true"></i>' : '<i class="ti ti-file-text" aria-hidden="true"></i>') +
          '<span>' + esc(d ? curto(tituloDe(d), 60) : 'Abertura') + '</span></h4><ul>';
        porSec.get(k).forEach(function (i) {
          h += '<li><button type="button" data-dose="' + i + '">' + marcaDoses(doses[i].texto) + '</button></li>';
        });
        h += '</ul></section>';
      });
      h += '</div>';
    }
    g.innerHTML = h;
    var ferr = art.querySelector('.cv-ferr');
    art.insertBefore(g, ferr && ferr.parentNode === art ? ferr : content);
    g.addEventListener('click', function (ev) {
      var b = ev.target.closest('button');
      if (!b) return;
      if (b.dataset.at != null) {
        var a = ats[+b.dataset.at];
        if (a.alvo && a.d) { a.d.open = true; requestAnimationFrame(function () { rola(a.alvo, 'start'); }); }
        else if (a.alvo) rola(a.alvo, 'start');
        else abreSecao(a.d);
        return;
      }
      if (b.classList.contains('cvd-dosesbt')) {
        var p = g.querySelector('.cvd-doses'), abre = p.hidden;
        p.hidden = !abre;
        b.setAttribute('aria-expanded', String(abre));
        return;
      }
      if (b.dataset.dose != null) {
        var x = doses[+b.dataset.dose];
        if (x.sec) x.sec.open = true;
        requestAnimationFrame(function () { rola(x.el, 'center'); pisca(x.el, x.ini, x.fim); });
      }
    });
  }

  /* ============================================================
     barra de progresso de leitura
     ============================================================ */
  var barra = null, rafP = 0;
  function progresso() {
    rafP = 0;
    if (!barra) return;
    var view = D.getElementById('resultView'), art = D.querySelector('#resultContainer .result');
    var ativo = !!(art && view && !view.hidden && art.querySelector('.cvd-guia, .content'));
    barra.hidden = !ativo;
    if (!ativo) return;
    var r = art.getBoundingClientRect(), total = r.height - W.innerHeight * 0.6;
    var p = total > 0 ? Math.min(1, Math.max(0, (W.innerHeight * 0.25 - r.top) / total)) : 1;
    barra.firstChild.style.transform = 'scaleX(' + p.toFixed(4) + ')';
  }
  function agenda() { if (!rafP) rafP = requestAnimationFrame(progresso); }
  function ligaBarra() {
    if (barra) { agenda(); return; }
    barra = D.createElement('div');
    barra.className = 'cvd-prog';
    barra.setAttribute('aria-hidden', 'true');
    barra.innerHTML = '<i></i>';
    D.body.appendChild(barra);
    W.addEventListener('scroll', agenda, { passive: true });
    W.addEventListener('resize', agenda, { passive: true });
    D.addEventListener('toggle', agenda, true);
    var view = D.getElementById('resultView');
    if (view && typeof MutationObserver === 'function') new MutationObserver(agenda).observe(view, { attributes: true, attributeFilter: ['hidden'] });
    agenda();
  }

  /* ============================================================
     ponto de entrada
     ============================================================ */
  function realca(rc) {
    rc = rc || D.getElementById('resultContainer');
    if (!rc) return;
    var content = rc.querySelector('.content');
    if (!content || content.dataset.cvd) return;
    content.dataset.cvd = '1';
    if (roFluxo) roFluxo.disconnect();
    if (roTab) roTab.disconnect();
    var secs = Array.prototype.slice.call(content.querySelectorAll(':scope > details.wb-acc')), soltos = [];
    var etapa = function (f) { try { f(); } catch (e) { if (W.console && console.debug) console.debug('CVD', e); } };
    var doses = [];
    // tipos antes de tudo (pérolas e guia dependem deles)
    secs.forEach(function (d) { var tp = tipoDe(tituloDe(d)); d.dataset.cvdTipo = tp ? tp.k : ''; });
    etapa(function () {
      embrulhaSoltos(content);
      secs.forEach(function (d) { var b = d.querySelector(':scope > .wb-acc-body'); if (b) embrulhaSoltos(b); });
    });
    // o que vem antes da 1ª seção (abertura, sempre visível) entra na lista de doses como "Abertura"
    soltos = Array.prototype.filter.call(content.children, function (c) { return !c.matches('details.wb-acc'); });
    etapa(function () { fluxos(content); });
    etapa(function () { perolas(secs); });
    etapa(function () {
      doses = colheDoses(secs, soltos);
      doses.forEach(function (x) { if (x.sec) x.sec._cvdDoses = true; });
    });
    etapa(function () { decoraSecoes(rc, secs); });
    etapa(function () { destacaDoses(content); });
    etapa(function () { tabelas(content); });
    etapa(function () { guia(rc, secs, doses); });
    etapa(ligaBarra);
  }

  // rede de segurança: se uma conduta já estiver na tela quando este arquivo chegar, realça também
  function inicial() { try { realca(D.getElementById('resultContainer')); } catch (e) { } }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', inicial, { once: true }); else inicial();

  W.CVD = {
    realca: realca,
    fluxos: fluxos,
    parseFluxo: parseFluxo,
    temFim: temFim,
    tipoDe: tipoDe,
    temDose: temDose,
    recorta: recorta,
    versao: 1
  };
})();
