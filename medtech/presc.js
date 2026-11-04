/* MedTech PWA: tópico Prescrição, como PrescricaoFolha.swift.
   Com modelo pronto (PRESC_MODELOS): cenário, escolha item a item, copiar e conferir.
   A conferência roda condutai-seguranca.js (CVSeg.conferir) do site, sem mudar regra nenhuma.
   Sem modelo: doses citadas no texto e a prescrição com IA (ponto de encaixe).
   Expõe window.MTPresc. */
(function () {
  'use strict';
  var W = window, D = document;
  var esc = function (s) { return W.MTUI.esc(s); }, ic = function (n) { return W.MTUI.ic(n); };
  var T = function (s, o) { return W.MTConduta.textoSimples(s, o); };

  function opcoesDe(cen) {
    var seq = 0, l = [];
    (cen.blocos || []).forEach(function (b) {
      (b.partes || []).forEach(function (p) {
        (p.opcoes || []).forEach(function (o) { l.push({ id: seq++, o: o, grupo: b.titulo || '' }); });
      });
    });
    return l;
  }
  function linhaCopia(o) {
    var nome = (o.farmaco || '') + (o.apresentacao ? ' (' + o.apresentacao + ')' : '');
    return [nome, o.posologia, o.diluicao, o.duracao].filter(Boolean).join('; ');
  }
  function textoCopia(nome, cenario, ops) {
    return 'Prescrição: ' + nome + ' (' + cenario + ')\n\n' + ops.map(function (x, n) { return (n + 1) + '. ' + linhaCopia(x.o); }).join('\n');
  }

  function pagina(el, o) {
    var item = o.item, modelo = o.modelo;
    el.classList.add('pagina-presc');
    if (!modelo || !modelo.cenarios || !modelo.cenarios.length) {
      el.innerHTML = '<div class="rola"><div class="presc-sem"><p class="corpo">Esta doença ainda não tem modelo de prescrição pronto.</p>' +
        '<button type="button" class="presc-ia" data-acao="presc-ia"><b>Montar prescrição com IA</b><span>Para um paciente, com conferência por regra e revisão de uma segunda IA</span></button></div>' +
        o.doses + o.rodape + '</div>';
      el.querySelector('[data-acao="presc-ia"]').addEventListener('click', function () { W.MedTechCasca.prescricaoIA(item); });
      return;
    }
    var st = { cen: 0, escolhendo: modelo.cenarios.length > 1, marc: {} };
    var cen = function () { return modelo.cenarios[st.cen]; };
    var ops = function () { return opcoesDe(cen()); };
    var escolhidas = function () { return ops().filter(function (x) { return st.marc[x.id]; }); };

    function opHTML(x) {
      var oo = x.o, sel = !!st.marc[x.id], b = W.MTDados.bulaPara(oo.farmaco || '');
      return '<div class="op' + (sel ? ' sel' : '') + '"><button type="button" class="op-bt" data-op="' + x.id + '" aria-pressed="' + sel + '">' +
        '<span class="op-check" aria-hidden="true">' + ic('check') + '</span><span class="op-tx">' +
        '<span class="op-f">' + esc(oo.farmaco) + '</span>' + (oo.apresentacao ? '<span class="op-a">' + esc(oo.apresentacao) + '</span>' : '') +
        '<span class="op-p">' + T((oo.posologia || '') + (oo.duracao ? ' · ' + oo.duracao : '')) + '</span>' +
        (oo.diluicao ? '<span class="op-d">' + T(oo.diluicao) + '</span>' : '') + (oo.obs ? '<span class="op-o">' + T(oo.obs) + '</span>' : '') + '</span></button>' +
        (b ? '<button type="button" class="op-bula" data-bula="' + esc(b.id) + '">Bula de ' + esc(b.nome) + '</button>' : '') + '</div>';
    }
    function blocoHTML(b, base) {
      var h = '<div class="pb"><h3>' + esc(b.titulo) + '</h3>';
      if (b.tipo === 'orientacao') return h + '<ul class="pb-orient">' + (b.itens || []).map(function (t) { return '<li>' + T(t) + '</li>'; }).join('') + '</ul></div>';
      if (b.regra) h += '<p class="pb-regra">' + esc(b.regra) + '</p>';
      (b.partes || []).forEach(function (p) {
        if (p.rotulo) h += '<p class="pb-rot">' + esc(p.rotulo) + '</p>';
        h += '<div class="pb-ops">' + (p.opcoes || []).map(function () { return opHTML(base.l[base.n++]); }).join('') + '</div>';
      });
      return h + '</div>';
    }
    function desenha() {
      var c = cen(), h = '', mostra = !st.escolhendo || modelo.cenarios.length === 1;
      if (modelo.cenarios.length > 1) {
        h += '<div class="cenarios">' + (st.escolhendo ? '<h2>Qual o cenário?</h2>' : '');
        modelo.cenarios.forEach(function (x, i) {
          if (!st.escolhendo && i !== st.cen) return;
          h += '<button type="button" class="cen' + (st.escolhendo ? '' : ' escolhido') + '" data-cen="' + i + '"' + (st.escolhendo ? '' : ' aria-label="' + esc(x.titulo) + '. Toque para trocar de cenário"') + '><span><b>' + esc(x.titulo) + '</b>' + (x.sub ? '<small>' + esc(x.sub) + '</small>' : '') + '</span>' + (st.escolhendo ? '' : '<em>Trocar</em>') + '</button>';
        });
        h += '</div>';
      } else if (c.sub) h += '<p class="cen-sub">' + esc(c.sub) + '</p>';
      if (mostra) { var base = { l: ops(), n: 0 }; h += (c.blocos || []).map(function (b) { return blocoHTML(b, base); }).join(''); }
      h += '<div class="presc-fonte">' + (modelo.fontes && modelo.fontes.length ? '<p>' + esc(modelo.fontes.join(' · ')) + '</p>' : '') +
        '<p>Modelo para adulto; ajuste ao paciente. Apoio à decisão: a prescrição e a responsabilidade são do médico assistente.</p></div>';
      if (mostra) h += o.doses;
      h += o.rodape;
      var rola = el.querySelector('.rola');
      rola.innerHTML = h;
      barra();
    }
    function barra() {
      var b = el.querySelector('.presc-barra'), mostra = !st.escolhendo || modelo.cenarios.length === 1;
      b.hidden = !mostra;
      var n = escolhidas().length;
      b.innerHTML = '<span class="pr-n">' + (n === 0 ? 'Marque os itens que vai usar' : n === 1 ? '1 item' : n + ' itens') + '</span>' +
        (n ? '<button type="button" class="pr-copia" data-acao="copiar">Copiar</button>' + (W.CVSeg ? '<button type="button" class="pr-confere" data-acao="conferir">Conferir</button>' : '') : '');
    }
    el.innerHTML = '<div class="rola"></div><div class="presc-barra" role="group" aria-label="Itens escolhidos"></div>';
    el.addEventListener('click', function (e) {
      var a = e.target.closest('button'); if (!a) return;
      if (a.dataset.cen != null && a.dataset.cen !== '') {
        var i = +a.dataset.cen;
        if (st.escolhendo) { if (i !== st.cen) st.marc = {}; st.cen = i; st.escolhendo = false; }
        else st.escolhendo = true;
        desenha();
        var p = el.querySelector('.cen'); if (p) p.focus({ preventScroll: true });
        return;
      }
      if (a.dataset.op != null && a.dataset.op !== '') {
        var id = +a.dataset.op; st.marc[id] = !st.marc[id];
        a.setAttribute('aria-pressed', !!st.marc[id]);
        a.parentElement.classList.toggle('sel', !!st.marc[id]);
        barra();
        return;
      }
      if (a.dataset.acao === 'copiar') { W.MTUI.copia(textoCopia(item.nome, cen().titulo, escolhidas()), 'Itens copiados. Confira doses para o paciente.'); return; }
      if (a.dataset.acao === 'conferir') { conferencia(item.nome, cen().titulo, escolhidas()); }
    });
    desenha();
  }

  /* ---------- conferência do modelo: paciente e resultado, em folha própria ---------- */
  function num(s) { var v = parseFloat(String(s || '').replace(',', '.').trim()); return isFinite(v) ? v : null; }

  function conferencia(nome, cenario, ops) {
    var p = { idade: '', sexo: '', peso: '', altura: '', creatinina: '', dialise: '', figado: 'normal', gestacao: '', alergias: '', nega: false, emUso: '' };
    W.MTUI.folha({
      titulo: 'Paciente', classe: 'folha-confere', alta: true,
      conteudo: function (c, api) {
        function faltas() {
          var f = [], idade = num(p.idade), peso = num(p.peso);
          if (!(idade > 0 && idade < 130)) f.push('Informe a idade.');
          if (!p.sexo) f.push('Informe o sexo.');
          if (!(peso > 0 && peso < 400)) f.push('Informe o peso: as doses dependem dele.');
          if (!p.nega && !p.alergias.trim()) f.push('Responda sobre alergias ou toque em Nega alergias.');
          return f;
        }
        function tfg() { return W.CVSeg.tfgCkdEpi2021(num(p.idade), p.sexo, num(p.creatinina)); }
        function escolha(rot, campo, op) {
          return '<div class="campo"><p class="cp-r" id="r-' + campo + '">' + rot + '</p><div class="seg" role="radiogroup" aria-labelledby="r-' + campo + '">' + op.map(function (x) {
            var sel = p[campo] === x[0];
            return '<button type="button" role="radio" aria-checked="' + sel + '" class="' + (sel ? 'sel' : '') + '" data-campo="' + campo + '" data-valor="' + esc(x[0]) + '">' + esc(x[1]) + '</button>';
          }).join('') + '</div></div>';
        }
        function caixa(rot, un, campo, modo) {
          return '<label class="campo cx"><span class="cp-r">' + rot + '</span><span class="cx-in"><input inputmode="' + modo + '" data-campo="' + campo + '" value="' + esc(p[campo]) + '" autocomplete="off"><span>' + un + '</span></span></label>';
        }
        function formulario(mostrarFaltas) {
          var t = tfg(), td = t != null ? W.CVSeg.tfgDesindexada(t, num(p.altura), num(p.peso)) : null, f = faltas();
          c.innerHTML = '<div class="folha-cab"><button type="button" class="fc-esq" data-acao="fechar">Fechar</button><h2 data-foco tabindex="-1">Paciente</h2><span></span></div>' +
            '<div class="confere"><p class="nota">' + ops.length + ' ' + (ops.length === 1 ? 'item' : 'itens') + ' do modelo. Nada fica salvo.</p>' +
            '<div class="cx-grade">' + caixa('Idade', 'anos', 'idade', 'numeric') + caixa('Peso', 'kg', 'peso', 'decimal') + caixa('Creatinina', 'mg/dL', 'creatinina', 'decimal') + caixa('Altura (opcional)', 'cm', 'altura', 'numeric') + '</div>' +
            escolha('Sexo', 'sexo', [['F', 'Feminino'], ['M', 'Masculino']]) +
            (p.sexo === 'F' ? escolha('Gestação', 'gestacao', [['', 'Não'], ['gestante', 'Gestante'], ['lactante', 'Amamentando']]) : '') +
            (t != null ? '<div class="tfg"><b>TFG ≈ ' + t + ' mL/min/1,73 m²</b><span>CKD-EPI 2021' + (td != null ? ' · para dose: ' + td + ' mL/min (desindexada)' : '') + '</span></div>' : '') +
            escolha('Diálise', 'dialise', [['', 'Não'], ['hemodiálise', 'Hemo'], ['diálise peritoneal', 'Peritoneal'], ['diálise contínua', 'Contínua']]) +
            escolha('Fígado', 'figado', [['normal', 'Normal'], ['A', 'Child A'], ['B', 'Child B'], ['C', 'Child C']]) +
            '<label class="campo"><span class="cp-r">Alergias</span><input class="cx-livre" data-campo="alergias" value="' + esc(p.alergias) + '" placeholder="Ex.: penicilina (urticária); dipirona"' + (p.nega ? ' disabled' : '') + ' autocomplete="off"></label>' +
            '<button type="button" class="nega' + (p.nega ? ' sel' : '') + '" data-acao="nega" aria-pressed="' + p.nega + '"><span class="op-check" aria-hidden="true">' + ic('check') + '</span>Nega alergias</button>' +
            '<label class="campo"><span class="cp-r">Medicações em uso</span><textarea class="cx-livre" data-campo="emUso" rows="3" placeholder="Uma por linha. Ex.: Losartana 50 mg 12/12 h">' + esc(p.emUso) + '</textarea></label></div>' +
            '<div class="confere-pe">' + (mostrarFaltas && f.length ? '<div class="faltas" role="alert"><b>Faltam dados de segurança</b>' + f.map(function (x) { return '<p>' + esc(x) + '</p>'; }).join('') + '</div>' : '') +
            '<button type="button" class="bt-cheio" data-acao="conferir">Conferir para este paciente</button></div>';
        }
        function resultado() {
          var t = tfg();
          var pac = { sexo: p.sexo, hepatica: p.figado, gestante: p.sexo === 'F' && p.gestacao === 'gestante', lactante: p.sexo === 'F' && p.gestacao === 'lactante',
            alergias: p.nega ? 'nega' : p.alergias.trim(), dialise: p.dialise, alergiaRespondida: p.nega || !!p.alergias.trim(), emUso: p.emUso.trim(), dx: '', cenario: 'emergencia', obs: '' };
          if (num(p.idade) != null) pac.idade = num(p.idade);
          if (num(p.peso) != null) pac.peso = num(p.peso);
          if (num(p.altura) != null) pac.altura = num(p.altura);
          if (num(p.creatinina) != null) pac.creat = num(p.creatinina);
          if (t != null) pac.tfg = t;
          var r = null;
          try {
            // mesma montagem de CVPresc.usarModelo: o item do modelo entra com os campos que a conferência espera
            var itens = ops.map(function (x) { return Object.assign({ grupo: 'Modelo do banco', justificativa: x.o.obs || '', referencia: '', alternativa: '', ajuste_renal: '', ajuste_renal_aplicado: false }, x.o, { grupo: x.grupo }); });
            r = W.CVSeg.conferir(itens, pac, p.emUso);
          } catch (e) { console.error(e); }
          var fora = {}, manter = {}, conferi = false;
          if (r) r.itens.forEach(function (it, i) { if (it.nivel === 'grave') fora[i] = 1; });   // item com bloqueio entra fora, como no site
          var cor = function (n) { return n === 'grave' ? 'critico' : n === 'atencao' ? 'alerta' : 'tinta2'; };
          var rot = function (n) { return n === 'grave' ? 'Bloqueio' : n === 'atencao' ? 'Atenção' : 'Aviso'; };
          var alerta = function (a) { return '<div class="al ' + cor(a.nivel) + '"><span class="al-b"></span><div><b>' + rot(a.nivel) + '</b><p>' + esc(a.msg) + '</p></div></div>'; };
          var fmt = function (v) { return Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 }); };
          function contas(cc, o) {
            if (!cc) return [];
            var l = [], peso = num(p.peso);
            if (cc.calcPeso && cc.doseMg != null && peso && o.dose_valor != null) l.push(fmt(o.dose_valor) + ' ' + (o.dose_unidade || '') + ' × ' + fmt(peso) + ' kg = ' + fmt(cc.doseMg) + ' mg por dose');
            if (cc.diaMg != null && cc.doseMg != null && cc.tomadas > 1) l.push(fmt(cc.doseMg) + ' mg × ' + fmt(cc.tomadas) + ' = ' + (cc.diaMg >= 1000 ? fmt(cc.diaMg / 1000) + ' g' : fmt(cc.diaMg) + ' mg') + '/dia' + (o.se_necessario ? ' se usar em todos os horários' : ''));
            if (cc.mgKgDia != null && cc.tomadas != null) l.push(fmt(cc.mgKgDia) + ' mg/kg/dia');
            return l;
          }
          function desenha() {
            var incl = ops.filter(function (x, i) { return !fora[i]; });
            var h = '<div class="folha-cab"><button type="button" class="fc-esq" data-acao="voltar-form">Voltar</button><h2 data-foco tabindex="-1">Conferência</h2><button type="button" class="fc-dir" data-acao="fechar">Fechar</button></div><div class="confere">';
            if (!r) h += '<p class="corpo">A conferência não abriu neste aparelho. Confira os itens manualmente.</p>';
            else {
              var g = r.resumo || {};
              var gr = g.grave || 0, at = g.atencao || 0, av = g.info || 0;
              h += '<p class="res-tot ' + (gr ? 'critico' : at ? 'alerta' : 'ok') + '">' + gr + ' ' + (gr === 1 ? 'bloqueio' : 'bloqueios') + ', ' + at + ' ' + (at === 1 ? 'atenção' : 'atenções') + ', ' + av + ' ' + (av === 1 ? 'aviso' : 'avisos') + '</p>' +
                '<p class="nota">Conferência por regra, sem IA: alergia e reação cruzada, teto de dose, conta por peso, rim, fígado, gestação, idoso, alta vigilância, interações e duplicidade.</p>';
              if (r.conjunto && r.conjunto.length) h += '<h3>Interações e alertas do conjunto</h3>' + r.conjunto.map(alerta).join('');
              r.itens.forEach(function (it, i) {
                var o = ops[i].o, dentro = !fora[i];
                var proprios = (it.alertas || []).filter(function (a) { return !a.doConjunto; });
                h += '<div class="res-item"><button type="button" class="ri-bt' + (dentro ? ' sel' : '') + '" data-item="' + i + '" aria-pressed="' + dentro + '"><span class="op-check" aria-hidden="true">' + ic('check') + '</span>' +
                  '<span class="op-tx"><span class="op-f">' + esc(o.farmaco) + '</span><span class="op-p">' + T((o.posologia || '') + (o.duracao ? ' · ' + o.duracao : '')) + '</span></span>' +
                  '<span class="ri-n ' + (it.nivel === 'ok' ? 'ok' : cor(it.nivel)) + '">' + (it.nivel === 'ok' ? 'Sem alerta' : rot(it.nivel)) + '</span></button>' +
                  contas(it.conta, o).map(function (x) { return '<p class="ri-conta">' + esc(x) + '</p>'; }).join('') + proprios.map(alerta).join('') +
                  (it.nivel === 'grave' && (!dentro || manter[i]) ? '<button type="button" class="manter' + (manter[i] ? ' sel' : '') + '" data-manter="' + i + '" aria-pressed="' + !!manter[i] + '"><span class="op-check" aria-hidden="true">' + ic('check') + '</span>Li o bloqueio e vou manter este item por decisão clínica</button>' : '') + '</div>';
              });
              h += '<button type="button" class="conferi' + (conferi ? ' sel' : '') + '" data-acao="conferi" aria-pressed="' + conferi + '"><span class="op-check" aria-hidden="true">' + ic('check') + '</span>Conferi doses, alergias e interações deste paciente</button>' +
                '<p class="nota">Apoio à decisão. A prescrição e a responsabilidade são do médico assistente.</p>';
            }
            var pode = conferi && incl.length;
            h += '</div><div class="confere-pe"><button type="button" class="bt-cheio' + (pode ? '' : ' apagado') + '" data-acao="copiar-final"' + (pode ? '' : ' aria-disabled="true"') + '>' + (conferi ? 'Copiar prescrição (' + incl.length + ')' : 'Marque que conferiu para copiar') + '</button></div>';
            c.innerHTML = h;
            c.onclick = function (e) {
              var a = e.target.closest('button'); if (!a) return;
              if (a.dataset.acao === 'fechar') return api.fechar();
              if (a.dataset.acao === 'voltar-form') { formulario(false); c.onclick = cliqueForm; return; }
              if (a.dataset.item != null) { var i = +a.dataset.item; conferi = false; if (!fora[i]) fora[i] = 1; else if (!(r.itens[i].nivel === 'grave' && !manter[i])) delete fora[i]; return desenha(); }
              if (a.dataset.manter != null) { var k = +a.dataset.manter; conferi = false; if (manter[k]) { delete manter[k]; fora[k] = 1; } else { manter[k] = 1; delete fora[k]; } return desenha(); }
              if (a.dataset.acao === 'conferi') { conferi = !conferi; return desenha(); }
              if (a.dataset.acao === 'copiar-final' && conferi && incl.length) W.MTUI.copia(textoCopia(nome, cenario, incl), 'Prescrição copiada.');
            };
            var foco = c.querySelector('h2'); if (foco) foco.focus({ preventScroll: true });
          }
          desenha();
        }
        function cliqueForm(e) {
          var a = e.target.closest('button'); if (!a) return;
          if (a.dataset.acao === 'fechar') return api.fechar();
          if (a.dataset.campo) { p[a.dataset.campo] = a.dataset.valor; if (a.dataset.campo === 'sexo' && p.sexo !== 'F') p.gestacao = ''; return formulario(false); }
          if (a.dataset.acao === 'nega') { p.nega = !p.nega; if (p.nega) p.alergias = ''; return formulario(false); }
          if (a.dataset.acao === 'conferir') { if (faltas().length) { formulario(true); var fl = c.querySelector('.faltas'); if (fl) fl.scrollIntoView({ block: 'nearest' }); return; } resultado(); }
        }
        c.addEventListener('input', function (e) {
          var i = e.target; if (!i.dataset || !i.dataset.campo) return;
          p[i.dataset.campo] = i.value;
          if (/idade|creatinina|altura|peso/.test(i.dataset.campo)) {
            // a TFG acompanha sem redesenhar o campo em edição
            var t = tfg(), box = c.querySelector('.tfg');
            if ((t != null) !== !!box) { var pos = i.selectionStart, campo = i.dataset.campo; formulario(false); var n = c.querySelector('[data-campo="' + campo + '"]'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) { } } }
            else if (box) { var td = W.CVSeg.tfgDesindexada(t, num(p.altura), num(p.peso)); box.innerHTML = '<b>TFG ≈ ' + t + ' mL/min/1,73 m²</b><span>CKD-EPI 2021' + (td != null ? ' · para dose: ' + td + ' mL/min (desindexada)' : '') + '</span>'; }
          }
        });
        c.onclick = cliqueForm;
        formulario(false);
      }
    });
  }

  W.MTPresc = { pagina: pagina, textoCopia: textoCopia };
})();
