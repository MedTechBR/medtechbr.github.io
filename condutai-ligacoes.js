/* CondutAI — ligações dentro da conduta: abordagem ⇄ prescrição ⇄ bula.
   Entra depois de CVD.realca: CVL.liga(rc, item).
   - trilha (Condutas › Especialidade) e abas "Abordagem | Prescrição";
   - selo BULA ao lado dos remédios em negrito (abre a bula do Banco MedTech numa janela, sem sair da conduta);
   - bloco "Nesta doença" no fim: prescrição, fluxograma, bulas citadas, perguntar à IA;
   - aba Prescrição: modelos por cenário (window.PRESC_MODELOS, gerado de _prescricoes/*.json), escolha item a item
     e "Levar à Prescrição", que passa pela conferência de segurança (condutai-presc.js). */
(function () {
  'use strict';
  var D = document, W = window;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var sem = function (s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };

  /* ---------- nomes de remédio com bula no banco ---------- */
  var _bulas = null;
  function bulas() {
    if (_bulas) return _bulas;
    _bulas = [];
    try {
      Object.keys(BULAS_OFF).forEach(function (k) {
        var b = BULAS_OFF[k];
        [b.nome].concat(b.alias || []).forEach(function (n) {
          n = sem(n).trim();
          if (n.length >= 4) _bulas.push({ k: k, n: n, nome: b.nome });
        });
      });
    } catch (e) { }
    _bulas.sort(function (a, b) { return b.n.length - a.n.length; });
    return _bulas;
  }
  function bulaDe(texto) {
    var t = ' ' + sem(texto).replace(/[^a-z0-9]+/g, ' ') + ' ';
    var L = bulas();
    for (var i = 0; i < L.length; i++) if (t.indexOf(' ' + L[i].n + ' ') >= 0) return L[i];
    return null;
  }
  function bulasCitadas(content) {
    var t = ' ' + sem(content.textContent).replace(/[^a-z0-9]+/g, ' ') + ' ', vistos = {}, out = [];
    bulas().forEach(function (b) { if (!vistos[b.k] && t.indexOf(' ' + b.n + ' ') >= 0) { vistos[b.k] = 1; out.push(b); } });
    return out.sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt'); });
  }

  /* ---------- janela da bula ---------- */
  var dlg = null;
  function abreBula(k, nome) {
    var b = null; try { b = BULAS_OFF[k]; } catch (e) { }
    if (!b) { if (typeof showView === 'function') { showView('bulas'); if (typeof runBula === 'function') runBula(nome || k); } return; }
    if (!dlg) {
      dlg = D.createElement('dialog');
      dlg.className = 'cvl-dlg';
      dlg.setAttribute('aria-labelledby', 'cvlDlgT');
      D.body.appendChild(dlg);
      dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    }
    dlg.innerHTML = '<div class="cvl-dlg-top"><span class="cvl-dlg-ic"><i class="ti ti-pill"></i></span><h3 id="cvlDlgT">' + esc(b.nome) + '</h3>' +
      '<button type="button" class="cvl-dlg-x" aria-label="Fechar"><i class="ti ti-x"></i></button></div>' +
      '<div class="cvl-dlg-corpo result content">' + accordionize(md(b.md.replace(/^#\s+.+\n/, ''))) + '</div>' +
      '<div class="cvl-dlg-pe"><span>Bula do Banco MedTech. Confirme na bula oficial.</span><button type="button" class="cvl-dlg-int"><i class="ti ti-alert-triangle"></i> Ver interações</button></div>';
    dlg.querySelector('.cvl-dlg-x').onclick = function () { dlg.close(); };
    dlg.querySelector('.cvl-dlg-int').onclick = function () {
      dlg.close(); showView('interacoes');
      var m = D.getElementById('it_meds'); if (m && m.value.indexOf(b.nome) < 0) m.value = (m.value.trim() ? m.value.trim() + '\n' : '') + b.nome;
      if (m) m.focus();
    };
    var secs = Array.prototype.slice.call(dlg.querySelectorAll('details.wb-acc'));
    var ac = secs.find(function (d) { return /posologia/i.test(d.querySelector('summary').textContent); }) || secs[0];
    if (ac) ac.open = true;
    dlg.showModal();
    if (ac && ac !== secs[0]) setTimeout(function () { ac.scrollIntoView({ block: 'start' }); }, 30);
  }

  /* ---------- selo BULA nos remédios em negrito ---------- */
  function selos(content) {
    var feitos = {};
    content.querySelectorAll('strong, b').forEach(function (s) {
      if (s.closest('.mermaid, a, summary, h1, h2, h3, h4, .cvl-bula, table th')) return;
      var b = bulaDe(s.textContent);
      if (!b) return;
      var sec = s.closest('details') || content;
      var chave = b.k + '|' + (sec.id || '');
      if (feitos[chave]) return;   // um selo por remédio em cada seção: marcar todas as menções vira ruído
      feitos[chave] = 1;
      var bt = D.createElement('button');
      bt.type = 'button'; bt.className = 'cvl-bula'; bt.dataset.bula = b.k; bt.dataset.nome = b.nome;
      bt.setAttribute('aria-label', 'Abrir bula de ' + b.nome);
      bt.innerHTML = '<i class="ti ti-pill" aria-hidden="true"></i>Bula';
      s.insertAdjacentElement('afterend', bt);
    });
  }

  /* ---------- trilha ---------- */
  function trilha(art, meta) {
    var head = art.querySelector('.result-header');
    if (!head || head.querySelector('.cvl-trilha') || !meta) return;
    var esp = (typeof SPECIALTIES !== 'undefined' && SPECIALTIES[meta.specialty]) ? SPECIALTIES[meta.specialty].label : '';
    var nav = D.createElement('nav');
    nav.className = 'cvl-trilha'; nav.setAttribute('aria-label', 'Você está em');
    nav.innerHTML = '<button type="button" data-t="lib">Condutas</button>' + (esp ? '<i class="ti ti-chevron-right" aria-hidden="true"></i><button type="button" data-t="esp">' + esc(esp) + '</button>' : '');
    nav.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      try { libActiveSpec = b.dataset.t === 'esp' ? meta.specialty : 'all'; libSearch = ''; } catch (x) { }
      showView('condutas');
    });
    head.insertBefore(nav, head.firstChild);
  }

  /* ---------- modelos de prescrição ---------- */
  function modeloDe(meta) { return meta && W.PRESC_MODELOS ? W.PRESC_MODELOS[meta.id] || null : null; }
  function itemLinha(it) {
    return [it.farmaco + (it.apresentacao ? ' (' + it.apresentacao + ')' : ''), it.posologia, it.diluicao, it.duracao].filter(Boolean).join(' — ');
  }
  function htmlOpcao(it, id) {
    var b = bulaDe(it.farmaco);
    return '<li class="cvl-op"><label class="cvl-op-l"><input type="checkbox" data-op="' + id + '"><span class="cvl-caixa" aria-hidden="true"></span>' +
      '<span class="cvl-op-t"><b>' + esc(it.farmaco) + '</b>' + (it.apresentacao ? ' <small>' + esc(it.apresentacao) + '</small>' : '') +
      '<span class="cvl-poso">' + esc(it.posologia) + (it.duracao ? ' · ' + esc(it.duracao) : '') + '</span>' +
      (it.diluicao ? '<span class="cvl-dil">' + esc(it.diluicao) + '</span>' : '') +
      (it.obs ? '<span class="cvl-obs">' + esc(it.obs) + '</span>' : '') + '</span></label>' +
      (b ? '<button type="button" class="cvl-bula" data-bula="' + b.k + '" data-nome="' + esc(b.nome) + '" aria-label="Abrir bula de ' + esc(b.nome) + '"><i class="ti ti-pill" aria-hidden="true"></i>Bula</button>' : '') + '</li>';
  }
  function htmlCenario(c, ci, reg) {
    var h = '';
    (c.blocos || []).forEach(function (bl) {
      h += '<section class="cvl-bloco"><h4 class="cvl-faixa">' + esc(bl.titulo) + '</h4>';
      if (bl.tipo === 'orientacao') {
        h += '<ul class="cvl-ori">' + (bl.itens || []).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
      } else {
        if (bl.regra) h += '<p class="cvl-regra">' + esc(bl.regra) + '</p>';
        (bl.partes || []).forEach(function (p) {
          if (p.rotulo) h += '<p class="cvl-parte">' + esc(p.rotulo) + '</p>';
          h += '<ul class="cvl-ops">' + (p.opcoes || []).map(function (it) { var id = reg.length; reg.push(Object.assign({}, it, { grupo: bl.titulo })); return htmlOpcao(it, id); }).join('') + '</ul>';
        });
      }
      h += '</section>';
    });
    return h;
  }
  function painelRx(rx, meta, item) {
    var m = modeloDe(meta);
    var nome = meta ? meta.name : (item && item.query) || '';
    if (!m) {
      rx.innerHTML = '<div class="cvl-vazio"><span class="cvl-vazio-ic"><i class="ti ti-prescription"></i></span><div><h3>Modelo em preparo</h3>' +
        '<p>Esta conduta ainda não tem prescrição pronta no banco. A IA monta uma para o seu paciente, com a mesma conferência de segurança.</p>' +
        '<button type="button" class="gaso-btn" data-rx="ia"><i class="ti ti-sparkles"></i> Montar para um paciente</button></div></div>';
      rx.querySelector('[data-rx="ia"]').onclick = function () { if (W.CVPresc) CVPresc.abrirCom(nome); };
      return;
    }
    var reg = [], cen = m.cenarios || [];
    var h = '<div class="cvl-cens" role="tablist" aria-label="Cenário">' + cen.map(function (c, i) {
      return '<button type="button" role="tab" class="cvl-cen" data-c="' + i + '" aria-selected="' + (i === 0) + '"><span>' + esc(c.titulo) + '</span>' + (c.sub ? '<small>' + esc(c.sub) + '</small>' : '') + '</button>';
    }).join('') + '</div>';
    h += cen.map(function (c, i) { return '<div class="cvl-cpainel" data-c="' + i + '" role="tabpanel"' + (i ? ' hidden' : '') + '>' + htmlCenario(c, i, reg) + '</div>'; }).join('');
    h += '<div class="cvl-rxpe"><span class="cvl-rxn" aria-live="polite">Marque os itens que vai usar</span>' +
      '<button type="button" class="cv-bt sec" data-rx="copia" disabled aria-label="Copiar itens marcados"><i class="ti ti-copy"></i><span> Copiar</span></button>' +
      '<button type="button" class="gaso-btn" data-rx="leva" disabled><i class="ti ti-shield-check"></i> Conferir<span class="cvl-bl"> para o paciente</span><span class="cvl-bn"></span></button></div>';
    h += '<p class="cvl-fontes"><i class="ti ti-books"></i> ' + esc((m.fontes || []).join(' · ')) + '. Modelo para adulto; ajuste ao paciente.</p>';
    rx.innerHTML = h;
    var sel = function () { return Array.prototype.map.call(rx.querySelectorAll('.cvl-cpainel:not([hidden]) input[data-op]:checked'), function (x) { return reg[+x.dataset.op]; }); };
    var pinta = function () {
      var n = sel().length;
      rx.querySelector('.cvl-rxn').textContent = n ? n + (n === 1 ? ' item marcado' : ' itens marcados') : 'Marque os itens que vai usar';
      rx.querySelector('[data-rx="copia"]').disabled = !n; rx.querySelector('[data-rx="leva"]').disabled = !n;
      rx.querySelector('.cvl-bn').textContent = n ? ' (' + n + ')' : '';
    };
    rx.addEventListener('change', pinta);
    rx.querySelectorAll('.cvl-cen').forEach(function (b) {
      b.onclick = function () {
        rx.querySelectorAll('.cvl-cen').forEach(function (x) { x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
        rx.querySelectorAll('.cvl-cpainel').forEach(function (p) { p.hidden = p.dataset.c !== b.dataset.c; });
        pinta();
      };
    });
    rx.querySelector('[data-rx="copia"]').onclick = function () {
      var c = cen[+rx.querySelector('.cvl-cen[aria-selected="true"]').dataset.c];
      var txt = 'Prescrição — ' + nome + ' (' + c.titulo + ')\n\n' + sel().map(function (it, i) { return (i + 1) + '. ' + itemLinha(it); }).join('\n');
      cvCopia(txt, 'Itens copiados. Confira doses para o paciente.');
    };
    rx.querySelector('[data-rx="leva"]').onclick = function () {
      var c = cen[+rx.querySelector('.cvl-cen[aria-selected="true"]').dataset.c];
      if (W.CVPresc && CVPresc.usarModelo) CVPresc.usarModelo(nome + ' — ' + c.titulo + (c.sub ? ' (' + c.sub + ')' : ''), sel(), m.fontes || []);
    };
  }

  /* ---------- abas e bloco "Nesta doença" ---------- */
  function liga(rc, item) {
    rc = rc || D.getElementById('resultContainer');
    if (!rc) return;
    var art = rc.querySelector('.result'), content = rc.querySelector('.content');
    if (!art || !content || art.dataset.cvl) return;
    art.dataset.cvl = '1';
    var meta = item && item.protocolMeta;
    var etapa = function (f) { try { f(); } catch (e) { if (W.console && console.debug) console.debug('CVL', e); } };
    etapa(function () { trilha(art, meta); });
    etapa(function () { selos(content); });
    if (!meta) return; // abas e prescrição só nas condutas do banco
    var m = modeloDe(meta);
    // abas logo depois do cabeçalho
    var abas = D.createElement('div');
    abas.className = 'cvl-abas'; abas.setAttribute('role', 'tablist'); abas.setAttribute('aria-label', 'Partes da conduta');
    abas.innerHTML = '<button type="button" role="tab" aria-selected="true" data-aba="abord"><i class="ti ti-book-2"></i> Abordagem</button>' +
      '<button type="button" role="tab" aria-selected="false" data-aba="rx"><i class="ti ti-prescription"></i> Prescrição' + (m ? '' : ' <small>IA</small>') + '</button>';
    var head = art.querySelector('.result-header');
    head.insertAdjacentElement('afterend', abas);
    var rx = D.createElement('section');
    rx.className = 'cvl-rx'; rx.hidden = true; rx.setAttribute('role', 'tabpanel');
    abas.insertAdjacentElement('afterend', rx);
    var feito = false;
    var vai = function (aba) {
      abas.querySelectorAll('[data-aba]').forEach(function (b) { b.setAttribute('aria-selected', b.dataset.aba === aba ? 'true' : 'false'); });
      rc.classList.toggle('cvl-modo-rx', aba === 'rx');
      rx.hidden = aba !== 'rx';
      if (aba === 'rx' && !feito) { feito = true; etapa(function () { painelRx(rx, meta, item); }); }
      var alvo = art.getBoundingClientRect().top + W.scrollY - 70;
      if (W.scrollY > alvo) W.scrollTo({ top: alvo, behavior: 'smooth' });
    };
    abas.addEventListener('click', function (e) { var b = e.target.closest('[data-aba]'); if (b) vai(b.dataset.aba); });
    // bloco "Nesta doença" no fim da abordagem
    var cit = bulasCitadas(content);
    var fx = content.querySelector('.mermaid-wrap');
    var bloco = D.createElement('section');
    bloco.className = 'cvl-links'; bloco.setAttribute('aria-labelledby', 'cvlLinksT');
    var h = '<h3 id="cvlLinksT">Nesta doença</h3><div class="cvl-lin">';
    h += '<button type="button" data-l="rx"><span class="cvl-l-ic" style="--k:var(--c-teal)"><i class="ti ti-prescription"></i></span><span><b>Prescrição</b><small>' + (m ? esc((m.cenarios || []).map(function (c) { return c.titulo; }).join(', ')) : 'Montar com a IA para um paciente') + '</small></span><i class="ti ti-chevron-right"></i></button>';
    if (fx) h += '<button type="button" data-l="fx"><span class="cvl-l-ic" style="--k:var(--c-violeta)"><i class="ti ti-git-fork"></i></span><span><b>Fluxograma</b><small>Diagrama e passo a passo</small></span><i class="ti ti-chevron-right"></i></button>';
    h += '<button type="button" data-l="ia"><span class="cvl-l-ic" style="--k:var(--c-azul)"><i class="ti ti-message-circle"></i></span><span><b>Perguntar sobre esta doença</b><small>Resumo de plantão, doses, dúvidas</small></span><i class="ti ti-chevron-right"></i></button>';
    h += '</div>';
    if (cit.length) h += '<p class="cvl-citp">Bulas dos remédios citados</p><div class="cvl-cit">' + cit.map(function (b) { return '<button type="button" class="cvl-bula grande" data-bula="' + b.k + '" data-nome="' + esc(b.nome) + '"><i class="ti ti-pill" aria-hidden="true"></i>' + esc(b.nome) + '</button>'; }).join('') + '</div>';
    bloco.innerHTML = h;
    var depois = art.querySelector('.sources') || art.querySelector('.wb-related');
    if (depois) art.insertBefore(bloco, depois); else art.appendChild(bloco);
    bloco.addEventListener('click', function (e) {
      var b = e.target.closest('[data-l]'); if (!b) return;
      if (b.dataset.l === 'rx') vai('rx');
      if (b.dataset.l === 'ia') { var p = D.getElementById('aiPanelBtn'); if (p) p.click(); }
      if (b.dataset.l === 'fx' && fx) { var d = fx.closest('details'); if (d) d.open = true; fx.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
  }
  // um só ouvinte para todos os selos BULA da tela (conduta, bloco final e aba Prescrição)
  D.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.cvl-bula');
    if (!b) return;
    e.preventDefault(); abreBula(b.dataset.bula, b.dataset.nome);
  });
  W.CVL = { liga: liga, abreBula: abreBula, _bulaDe: bulaDe };
})();
