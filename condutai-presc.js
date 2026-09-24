/* CondutAI — Prescrição com conferência de segurança.
   Etapas: (1) dados do paciente com os campos de segurança obrigatórios; (2) a IA pergunta o que falta e,
   em paralelo, busca a diretriz vigente; (3) a IA monta a prescrição ESTRUTURADA (JSON); (4) conferência por
   regra (condutai-seguranca.js) + revisão independente por uma segunda IA no papel de farmacêutico;
   (5) o médico revisa item a item, edita, pede ajustes e só copia depois de marcar que conferiu.
   Nada é salvo: os dados do paciente ficam só nesta aba (sessionStorage), sem nome. */
(function () {
  'use strict';
  const S = window.CVSeg;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const PK = 'cv_paciente_v1';
  const num = v => { const x = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isNaN(x) ? null : x; };
  const radio = n => { const r = document.querySelector(`input[name="${n}"]:checked`); return r ? r.value : ''; };
  const setRadio = (n, v) => { const r = document.querySelector(`input[name="${n}"][value="${v}"]`); if (r) r.checked = true; };
  const fmt = v => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

  /* ================= Paciente ================= */
  function coleta() {
    const idade = num($('p_idade').value), peso = num($('p_peso').value), creat = num($('p_creat').value), altura = num($('p_altura').value);
    const sexo = radio('p_sexo');
    const gest = radio('p_gest');
    const aleTxt = $('p_alergias').value.trim();
    const nega = $('p_nega').getAttribute('aria-pressed') === 'true';
    return {
      idade, sexo, peso, creat, altura, tfg: S.tfgCkdEpi2021(idade, sexo, creat),
      dialise: ({ hd: 'hemodiálise', dp: 'diálise peritoneal', cont: 'diálise contínua' })[radio('p_dialise')] || '',
      hepatica: radio('p_hep') || 'normal',
      gestante: sexo === 'F' && gest === 'gestante', lactante: sexo === 'F' && gest === 'lactante',
      alergias: nega ? 'nega' : aleTxt, alergiaRespondida: nega || !!aleTxt,
      emUso: $('p_emuso').value.trim(),
      dx: $('p_dx').value.trim(), cenario: radio('p_cen') || 'emergencia', obs: $('p_obs').value.trim()
    };
  }
  function guarda() {
    try {
      const p = coleta();
      sessionStorage.setItem(PK, JSON.stringify({ idade: p.idade, sexo: p.sexo, peso: p.peso, creat: p.creat, altura: p.altura, dialise: radio('p_dialise'), hep: radio('p_hep'), gest: radio('p_gest'),
        alergias: $('p_alergias').value, nega: p.alergias === 'nega', emUso: p.emUso, dx: p.dx, cen: radio('p_cen'), obs: p.obs }));
    } catch (e) {}
    window.dispatchEvent(new CustomEvent('cv-paciente'));
  }
  function restaura() {
    let d = null; try { d = JSON.parse(sessionStorage.getItem(PK) || 'null'); } catch (e) {}
    if (!d) return;
    if (d.idade != null) $('p_idade').value = d.idade;
    if (d.peso != null) $('p_peso').value = d.peso;
    if (d.creat != null) $('p_creat').value = d.creat;
    if (d.altura != null) $('p_altura').value = d.altura;
    if (d.sexo) setRadio('p_sexo', d.sexo);
    if (d.dialise) setRadio('p_dialise', d.dialise);
    if (d.hep) setRadio('p_hep', d.hep);
    if (d.gest) setRadio('p_gest', d.gest);
    $('p_alergias').value = d.alergias || '';
    marcaNega(!!d.nega);
    $('p_emuso').value = d.emUso || ''; $('p_dx').value = d.dx || ''; $('p_obs').value = d.obs || '';
    if (d.cen) setRadio('p_cen', d.cen);
  }
  /* resumo curto do paciente, usado também pelo Assistente ("paciente em foco") */
  function resumoPaciente(p) {
    p = p || coleta();
    const L = [];
    if (p.idade) L.push(`${fmt(p.idade)} anos`);
    if (p.sexo) L.push(p.sexo === 'F' ? 'feminino' : 'masculino');
    if (p.peso) L.push(`${fmt(p.peso)} kg`);
    if (p.tfg != null) { const d = S.tfgDesindexada(p.tfg, p.altura, p.peso); L.push(`TFG ≈ ${p.tfg} mL/min/1,73m² (CKD-EPI 2021, creatinina ${fmt(p.creat)})${d != null ? `, desindexada ≈ ${d} mL/min` : ''}`); }
    if (p.dialise) L.push(`em ${p.dialise}`);
    if (p.hepatica && p.hepatica !== 'normal') L.push(`cirrose Child ${p.hepatica}`);
    if (p.gestante) L.push('gestante'); if (p.lactante) L.push('amamentando');
    L.push(p.alergias === 'nega' ? 'nega alergias' : p.alergias ? `alergias: ${p.alergias}` : 'alergias não informadas');
    return L.join(' · ');
  }
  function blocoPaciente(p) {
    const L = [];
    L.push(`Idade: ${p.idade ?? 'não informada'} anos`);
    L.push(`Sexo: ${p.sexo === 'F' ? 'feminino' : p.sexo === 'M' ? 'masculino' : 'não informado'}`);
    L.push(`Peso: ${p.peso != null ? fmt(p.peso) + ' kg' : 'NÃO informado'}`);
    const des = S.tfgDesindexada(p.tfg, p.altura, p.peso);
    if (p.altura) L.push(`Altura: ${fmt(p.altura)} cm`);
    L.push(p.tfg != null ? `Creatinina ${fmt(p.creat)} mg/dL → TFG ≈ ${p.tfg} mL/min/1,73m² (CKD-EPI 2021)${des != null ? `; TFG desindexada ≈ ${des} mL/min (use esta para dose, KDIGO 2024)` : ''}. Ajuste as doses a esta função renal.` : 'Função renal: creatinina não informada.');
    if (p.dialise) L.push(`Terapia renal: ${p.dialise}.`);
    L.push(`Fígado: ${p.hepatica === 'normal' ? 'sem hepatopatia conhecida' : 'cirrose Child-Pugh ' + p.hepatica}`);
    if (p.sexo === 'F') L.push(`Gestação/lactação: ${p.gestante ? 'GESTANTE' : p.lactante ? 'amamentando' : 'não'}`);
    L.push(`Alergias: ${p.alergias === 'nega' ? 'nega alergias' : p.alergias}`);
    L.push(`Medicações em uso: ${p.emUso ? '\n' + p.emUso : 'nenhuma informada'}`);
    L.push(`Cenário: ${({ emergencia: 'emergência', enfermaria: 'enfermaria', uti: 'UTI', ambulatorio: 'ambulatório' })[p.cenario] || p.cenario}`);
    L.push(`Diagnóstico e contexto: ${p.dx}`);
    if (p.obs) L.push(`Observações: ${p.obs}`);
    return L.join('\n');
  }
  function pintaTfg() {
    const p = coleta(), el = $('rxTfg');
    $('rxGestWrap').hidden = p.sexo !== 'F';
    if (p.tfg == null) { el.hidden = true; return; }
    const faixa = p.tfg >= 90 ? 'G1' : p.tfg >= 60 ? 'G2' : p.tfg >= 45 ? 'G3a' : p.tfg >= 30 ? 'G3b' : p.tfg >= 15 ? 'G4' : 'G5';
    el.className = 'rx-tfg ' + (p.tfg < 30 ? 'baixa' : p.tfg < 60 ? 'media' : 'ok');
    const des = S.tfgDesindexada(p.tfg, p.altura, p.peso);
    el.innerHTML = `<i class="ti ti-droplet"></i> TFG ≈ <b>${p.tfg}</b> mL/min/1,73m² <span>CKD-EPI 2021 · ${faixa}</span>${des != null ? `<span class="rx-tfg-des">Para dose: <b>${des}</b> mL/min (desindexada)</span>` : ''}`;
    el.hidden = false;
  }
  function marcaNega(on) {
    const b = $('p_nega'); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    $('p_alergias').disabled = on; if (on) $('p_alergias').value = '';
  }

  /* ================= Validação ================= */
  function valida(p) {
    const faltas = [];
    const marca = (id, cond, msg) => { const el = $(id); const campo = el.closest('.rx-campo') || el.closest('label') || el; campo.classList.toggle('rx-erro', !!cond); if (cond) faltas.push({ id, msg }); };
    marca('p_idade', !(p.idade > 0 && p.idade < 130), 'Informe a idade.');
    marca('p_sexo_f', !p.sexo, 'Informe o sexo.');
    marca('p_peso', !(p.peso > 0 && p.peso < 400), 'Informe o peso: as doses dependem dele.');
    marca('p_alergias', !p.alergiaRespondida, 'Responda sobre alergias (ou toque em "Nega alergias").');
    marca('p_dx', !p.dx, 'Descreva o diagnóstico ou o contexto.');
    return faltas;
  }

  /* ================= IA ================= */
  const SIS = `Você é médico clínico sênior e farmacêutico clínico hospitalar no Brasil, ajudando outro médico a prescrever para um paciente ADULTO real. A segurança vem antes de tudo.
- Use nomes genéricos (DCB) e apresentações disponíveis no Brasil (SUS/ANVISA).
- Ajuste cada dose ao peso, à função renal (TFG por CKD-EPI 2021), ao fígado, à idade e à gestação informados.
- Nunca prescreva um fármaco a que o paciente é alérgico. Se usar uma classe com reação cruzada possível, justifique.
- Considere as medicações em uso: evite interação grave e duplicidade; se algo em uso precisa ser suspenso ou ajustado, diga.
- Baseie-se na diretriz vigente e cite sociedade/diretriz e ano. Nunca invente referência, estudo ou dose. Se não souber, diga.
- Seja enxuto: prescreva o que muda desfecho e o sintomático necessário; profilaxias só quando indicadas no cenário.`;

  async function ia(contents, o) { return (o && o.json && window.callGeminiJson ? window.callGeminiJson : window.callGemini)(contents, o); }
  function jsonDe(t) {
    const s = String(t || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    try { return JSON.parse(s); } catch (e) {}
    const i = s.indexOf('{'), j = s.lastIndexOf('}');
    if (i >= 0 && j > i) return JSON.parse(s.slice(i, j + 1));
    throw new Error('A IA devolveu um formato inesperado. Tente de novo.');
  }
  const T = { S: 'STRING', N: 'NUMBER', B: 'BOOLEAN', A: 'ARRAY', O: 'OBJECT', I: 'INTEGER' };
  const ESQ_PERGUNTAS = { type: T.O, properties: { perguntas: { type: T.A, items: { type: T.O, properties: {
    pergunta: { type: T.S }, por_que: { type: T.S }, opcoes: { type: T.A, items: { type: T.S } } }, required: ['pergunta', 'opcoes'] } } }, required: ['perguntas'] };
  const ESQ_ITEM = { type: T.O, properties: {
    grupo: { type: T.S }, farmaco: { type: T.S }, apresentacao: { type: T.S },
    dose_valor: { type: T.N, nullable: true }, dose_unidade: { type: T.S }, via: { type: T.S },
    intervalo_horas: { type: T.N, nullable: true }, continuo: { type: T.B }, dose_unica: { type: T.B }, se_necessario: { type: T.B },
    posologia: { type: T.S }, duracao: { type: T.S }, diluicao: { type: T.S },
    dose_por_kg: { type: T.O, nullable: true, properties: { valor: { type: T.N }, unidade: { type: T.S } } },
    dose_maxima_dia: { type: T.O, nullable: true, properties: { valor: { type: T.N }, unidade: { type: T.S } } },
    ajuste_renal_aplicado: { type: T.B }, ajuste_renal: { type: T.S },
    justificativa: { type: T.S }, referencia: { type: T.S }, alternativa: { type: T.S } },
    required: ['grupo', 'farmaco', 'dose_unidade', 'via', 'posologia', 'justificativa'] };
  const ESQ_PRESC = { type: T.O, properties: {
    resumo: { type: T.S }, raciocinio: { type: T.S }, suposicoes: { type: T.A, items: { type: T.S } },
    itens: { type: T.A, items: ESQ_ITEM },
    nao_farmacologico: { type: T.A, items: { type: T.S } }, monitorizacao: { type: T.A, items: { type: T.S } },
    reavaliar: { type: T.A, items: { type: T.S } }, alertas_gerais: { type: T.A, items: { type: T.S } },
    referencias: { type: T.A, items: { type: T.S } } }, required: ['resumo', 'itens'] };
  const ESQ_REVISAO = { type: T.O, properties: {
    itens: { type: T.A, items: { type: T.O, properties: { indice: { type: T.I }, veredito: { type: T.S, enum: ['ok', 'atencao', 'erro'] }, observacao: { type: T.S }, sugestao: { type: T.S } }, required: ['indice', 'veredito'] } },
    gerais: { type: T.A, items: { type: T.O, properties: { nivel: { type: T.S, enum: ['info', 'atencao', 'erro'] }, observacao: { type: T.S } }, required: ['nivel', 'observacao'] } } }, required: ['itens'] };

  function promptPerguntas(p) {
    return `${blocoPaciente(p)}

Antes de prescrever, há alguma informação que FALTA e que mudaria a escolha do fármaco ou a dose de forma importante? Pergunte no máximo 3 coisas, só as que realmente mudam a conduta e que NÃO estão nos dados acima (ex.: sinais de choque/gravidade, via oral possível, uso de anticoagulante, cultura prévia ou colonização por germe resistente, QTc, potássio, tempo de sintomas). Cada pergunta com 2 a 4 opções curtas de resposta. Se nada de essencial falta, devolva a lista vazia.`;
  }
  function promptPesquisa(p) {
    return `Busque a diretriz vigente e resuma, em até 220 palavras, o tratamento farmacológico recomendado em ADULTOS para: ${p.dx}. Cenário: ${p.cenario}. Inclua: primeira escolha e alternativas (com dose usual adulta, via, intervalo e duração), ajustes renais relevantes e contraindicações que mudam a escolha. No fim, liste as fontes como "Sociedade/Diretriz — ano". Não invente; se houver divergência entre diretrizes, diga qual é a brasileira.`;
  }
  function promptPrescricao(p, respostas, brief) {
    return `DADOS DO PACIENTE
${blocoPaciente(p)}
${respostas && respostas.length ? '\nRESPOSTAS DO MÉDICO ÀS PERGUNTAS\n' + respostas.map(r => `- ${r.pergunta} → ${r.resposta}`).join('\n') : ''}
${brief ? '\nRESUMO DA DIRETRIZ VIGENTE (pesquisa feita agora; use como base e cite as fontes dela)\n' + brief : ''}

Monte a prescrição inicial para este paciente. Regras do formato:
- Um item por medicamento. "posologia" é a linha exatamente como vai na prescrição (ex.: "1 g EV de 12/12 h").
- dose_valor + dose_unidade = dose de UMA administração (ex.: 1 e "g"; 0,1 e "mcg/kg/min" para infusão). Se a dose é por peso, preencha dose_por_kg e já faça a conta no dose_valor para o peso informado, arredondando para a apresentação.
- intervalo_horas: 6, 8, 12, 24… (null se infusão contínua ou dose única); continuo=true para BIC; dose_unica=true para dose única; se_necessario=true para "se necessário".
- dose_maxima_dia quando houver teto conhecido.
- ajuste_renal_aplicado=true SÓ se você mudou a dose ou o intervalo por causa da função renal; explique em ajuste_renal.
- Antimicrobiano: sempre com duracao (ou data de reavaliação). EV intermitente: diluicao com diluente, volume e tempo de infusão.
- referencia: diretriz e ano. suposicoes: tudo o que você assumiu por falta de dado.
- grupo: objetivo do item (ex.: "Antimicrobiano", "Analgesia", "Antiemético", "Profilaxia de TEV", "Suporte").`;
  }
  function promptRevisao(p, presc) {
    const itens = presc.itens.map((it, i) => `${i}. ${it.farmaco}${it.apresentacao ? ' (' + it.apresentacao + ')' : ''} — ${it.posologia}${it.duracao ? ' — ' + it.duracao : ''}${it.diluicao ? ' — ' + it.diluicao : ''}${it.ajuste_renal ? ' — ajuste renal: ' + it.ajuste_renal : ''}`).join('\n');
    return `PACIENTE
${blocoPaciente(p)}

PRESCRIÇÃO PROPOSTA (índices a partir de 0)
${itens}

Revise criticamente esta prescrição para ESTE paciente, como farmacêutico clínico que responde pela segurança. Procure: dose errada para mais ou para menos, unidade, intervalo, via, diluição ou tempo de infusão inadequados, ajuste renal ou hepático faltando ou errado, alergia e reação cruzada, interação com as medicações em uso ou entre itens, duplicidade, contraindicação por idade ou gestação, omissão importante (profilaxia indicada, reposição de potássio, analgesia), duração inadequada. Para cada item dê veredito ok, atencao ou erro; observacao só quando não for ok, curta e específica; sugestao com a correção concreta. Em gerais, o que vale para o conjunto. Não elogie; não repita o que está certo.`;
  }

  /* ================= Estado ================= */
  let EST = null; // {p, presc, conf, rev, incl:[bool], edit:[bool], contents:[], carregando}
  const box = () => $('presResult');

  function etapas(atual, extra) {
    const E = [['dados', 'Dados conferidos'], ['perguntas', 'Perguntas'], ['diretriz', 'Diretriz vigente'], ['prescricao', 'Prescrição'], ['conferencia', 'Conferência']];
    const idx = E.findIndex(e => e[0] === atual);
    return `<ol class="rx-etapas" aria-label="Andamento">${E.map((e, i) => `<li class="${i < idx ? 'feito' : i === idx ? 'agora' : ''}">${i < idx ? '<i class="ti ti-check"></i>' : i === idx ? '<span class="cv-spin"></span>' : '<i class="ti ti-circle"></i>'}<span>${e[1]}</span></li>`).join('')}</ol>${extra ? `<p class="rx-etapa-sub">${extra}</p>` : ''}`;
  }

  async function iniciar() {
    const p = coleta();
    const faltas = valida(p);
    if (faltas.length) {
      box().innerHTML = `<div class="rx-aviso rx-grave" role="alert"><i class="ti ti-alert-triangle"></i><div><b>Faltam dados de segurança</b><ul>${faltas.map(f => `<li>${esc(f.msg)}</li>`).join('')}</ul></div></div>`;
      const el = $(faltas[0].id); if (el && el.focus) el.focus();
      return;
    }
    if (!(window.MT && window.MT.user)) { box().innerHTML = '<div class="rx-aviso"><i class="ti ti-lock"></i><div>Entre na sua conta MedTech para usar a IA.</div></div>'; return; }
    guarda();
    EST = { p, presc: null, conf: null, rev: null, revEstado: 'aguarda', incl: [], edit: [], respostas: [], brief: '' };
    const bt = $('presGo'); bt.disabled = true;
    box().innerHTML = `<div class="rx-andamento">${etapas('perguntas', 'Vendo se falta alguma informação que muda a conduta')}</div>`;
    cvMostra(box());
    // pesquisa da diretriz roda em paralelo às perguntas
    const pBrief = ia([{ role: 'user', parts: [{ text: promptPesquisa(p) }] }], { model: 'gemini-2.5-flash', temperature: 0.2, maxTokens: 4096, maxRetries: 1 })
      .then(r => r.text).catch(() => '');
    let perguntas = [];
    try {
      const r = await ia([{ role: 'user', parts: [{ text: promptPerguntas(p) }] }], { model: 'gemini-2.5-flash', system: SIS, json: ESQ_PERGUNTAS, temperature: 0.2, maxTokens: 4096, maxRetries: 1 });
      perguntas = (jsonDe(r.text).perguntas || []).filter(q => q && q.pergunta).slice(0, 3);
    } catch (e) { perguntas = []; }
    EST.pBrief = pBrief;
    if (perguntas.length) mostraPerguntas(perguntas);
    else await gerar([]);
    bt.disabled = false;
  }

  function mostraPerguntas(perguntas) {
    box().innerHTML = `<div class="rx-andamento">${etapas('perguntas')}</div>
      <section class="rx-perg" aria-labelledby="rxPergT">
        <h3 id="rxPergT"><i class="ti ti-message-question"></i> Antes de prescrever</h3>
        <p class="rx-sub">As respostas mudam a escolha ou a dose. Se não souber, deixe em branco.</p>
        ${perguntas.map((q, i) => `<div class="rx-q" data-i="${i}">
          <p class="rx-q-t">${esc(q.pergunta)}</p>${q.por_que ? `<p class="rx-q-pq">${esc(q.por_que)}</p>` : ''}
          <div class="rx-q-op" role="radiogroup" aria-label="${esc(q.pergunta)}">${(q.opcoes || []).slice(0, 4).map(o => `<button type="button" class="rx-pill" role="radio" aria-checked="false" data-v="${esc(o)}">${esc(o)}</button>`).join('')}
          <input type="text" class="rx-q-livre" placeholder="Outra resposta" aria-label="Outra resposta"></div></div>`).join('')}
        <div class="rx-acoes"><button type="button" class="gaso-btn" id="rxPergOk">Montar a prescrição</button><button type="button" class="cv-bt sec" id="rxPergPula">Pular perguntas</button></div>
      </section>`;
    box().querySelectorAll('.rx-q-op').forEach(g => g.addEventListener('click', e => {
      const b = e.target.closest('.rx-pill'); if (!b) return;
      g.querySelectorAll('.rx-pill').forEach(x => x.setAttribute('aria-checked', x === b && x.getAttribute('aria-checked') !== 'true' ? 'true' : 'false'));
    }));
    const junta = () => [...box().querySelectorAll('.rx-q')].map(el => {
      const q = perguntas[+el.dataset.i];
      const sel = el.querySelector('.rx-pill[aria-checked="true"]'); const livre = el.querySelector('.rx-q-livre').value.trim();
      return { pergunta: q.pergunta, resposta: livre || (sel ? sel.dataset.v : '') };
    }).filter(r => r.resposta);
    $('rxPergOk').onclick = () => gerar(junta());
    $('rxPergPula').onclick = () => gerar([]);
    const f = box().querySelector('.rx-pill'); if (f) f.focus({ preventScroll: true });
  }

  async function gerar(respostas) {
    const p = EST.p; EST.respostas = respostas;
    box().innerHTML = `<div class="rx-andamento">${etapas('diretriz', 'Buscando a diretriz vigente para o caso')}</div>`;
    EST.brief = await Promise.race([EST.pBrief, new Promise(r => setTimeout(() => r(''), 45000))]);
    box().innerHTML = `<div class="rx-andamento">${etapas('prescricao', 'Montando os itens com dose, via, intervalo e duração (costuma levar de 20 a 40 s)')}</div>`;
    const contents = [{ role: 'user', parts: [{ text: promptPrescricao(p, respostas, EST.brief) }] }];
    try {
      const r = await ia(contents, { model: 'gemini-2.5-pro', system: SIS, json: ESQ_PRESC, temperature: 0.2, maxTokens: 24576 });
      const presc = normaliza(jsonDe(r.text));
      EST.contents = [...contents, { role: 'model', parts: [{ text: JSON.stringify(presc) }] }];
      aplica(presc);
    } catch (err) { erro(err, () => gerar(respostas)); }
  }

  function normaliza(presc) {
    presc.itens = (presc.itens || []).filter(it => it && it.farmaco).map(it => Object.assign({ grupo: 'Outros', apresentacao: '', duracao: '', diluicao: '', ajuste_renal: '', alternativa: '', referencia: '' }, it, {
      dose_valor: it.dose_valor == null ? null : Number(it.dose_valor), intervalo_horas: it.intervalo_horas == null ? null : Number(it.intervalo_horas) }));
    ['suposicoes', 'nao_farmacologico', 'monitorizacao', 'reavaliar', 'alertas_gerais', 'referencias'].forEach(k => { presc[k] = Array.isArray(presc[k]) ? presc[k].filter(Boolean) : []; });
    if (!presc.itens.length) throw new Error('A IA não devolveu nenhum item. Detalhe melhor o caso e tente de novo.');
    return presc;
  }

  function aplica(presc) {
    EST.presc = presc;
    EST.edit = presc.itens.map(() => false);
    EST.conf = S.conferir(presc.itens, EST.p, EST.p.emUso);
    EST.incl = EST.conf.itens.map(c => c.nivel !== 'grave');
    EST.rev = null; EST.revEstado = 'rodando';
    render();
    revisar();
  }
  function reconfere() {
    EST.conf = S.conferir(EST.presc.itens, EST.p, EST.p.emUso);
    EST.conferido = false;
    render(true);
  }

  async function revisar() {
    const alvo = EST.presc;
    try {
      const r = await ia([{ role: 'user', parts: [{ text: promptRevisao(EST.p, alvo) }] }], { model: 'gemini-2.5-pro', system: 'Você é farmacêutico clínico hospitalar no Brasil, revisor independente de prescrições. Seja rigoroso, específico e breve.', json: ESQ_REVISAO, temperature: 0, maxTokens: 16384 });
      if (EST.presc !== alvo) return; // o médico pediu outra versão nesse meio-tempo
      EST.rev = jsonDe(r.text); EST.revEstado = 'pronta';
    } catch (e) { if (EST.presc === alvo) EST.revEstado = 'falhou'; }
    if (EST.presc !== alvo) return;
    if (EST.conferido) { EST.conferido = false; aviso('A revisão da IA chegou. Confira de novo antes de copiar.', 'erro'); }
    render(true);
  }

  function erro(err, repetir) {
    box().innerHTML = `<div class="rx-aviso rx-grave" role="alert"><i class="ti ti-alert-triangle"></i><div><b>Não foi possível montar agora.</b> ${esc(err && err.message || 'Falha na IA')}</div></div><div class="rx-acoes"><button type="button" class="gaso-btn" id="rxDeNovo">Tentar de novo</button></div>`;
    $('rxDeNovo').onclick = repetir;
  }

  /* ================= Render ================= */
  const NIVEL = { grave: { ic: 'ti-alert-octagon', t: 'Bloqueio' }, atencao: { ic: 'ti-alert-triangle', t: 'Atenção' }, info: { ic: 'ti-info-circle', t: 'Aviso' }, ok: { ic: 'ti-circle-check', t: 'Sem alerta' } };
  function revDoItem(i) {
    if (!EST.rev || !Array.isArray(EST.rev.itens)) return null;
    return EST.rev.itens.find(x => Number(x.indice) === i && x.veredito && x.veredito !== 'ok') || null;
  }
  function contaTxt(c, it) {
    if (!c) return '';
    const partes = [];
    if (c.calcPeso && c.doseMg != null) partes.push(`${fmt(it.dose_valor)} ${esc(it.dose_unidade)} × ${fmt(EST.p.peso)} kg = ${fmt(c.doseMg)} mg por dose`);
    if (c.diaMg != null && c.tomadas && c.tomadas > 1) partes.push(`${fmt(c.doseMg)} mg × ${fmt(c.tomadas)} = <b>${c.diaMg >= 1000 ? fmt(c.diaMg / 1000) + ' g' : fmt(c.diaMg) + ' mg'}/dia</b>${it.se_necessario ? ' se usar em todos os horários' : ''}`);
    if (c.mgKgDia != null && c.tomadas) partes.push(`${fmt(c.mgKgDia)} mg/kg/dia`);
    return partes.length ? `<p class="rx-conta"><i class="ti ti-calculator"></i> ${partes.map(x => `<span>${x}</span>`).join('')}</p>` : '';
  }
  function linhaAlerta(a, ia) {
    return `<li class="rx-al ${a.nivel}"><i class="ti ${NIVEL[a.nivel] ? NIVEL[a.nivel].ic : 'ti-info-circle'}"></i><span>${ia ? '<em class="rx-tag-ia">Revisão da IA</em> ' : ''}${esc(a.msg)}</span></li>`;
  }
  function posologiaDe(it) {
    if (!EST || !it._editado) return it.posologia;
    const dose = it.dose_valor != null ? `${fmt(it.dose_valor)} ${it.dose_unidade}` : '';
    const freq = it.continuo ? 'em infusão contínua' : it.dose_unica ? 'dose única' : it.intervalo_horas ? `de ${fmt(it.intervalo_horas)}/${fmt(it.intervalo_horas)} h` : '';
    return [dose, it.via, freq, it.se_necessario ? 'se necessário' : ''].filter(Boolean).join(' ');
  }
  function cardItem(it, i) {
    const c = EST.conf.itens[i];
    const rv = revDoItem(i);
    const nivelIA = rv ? (rv.veredito === 'erro' ? 'grave' : 'atencao') : null;
    const ORD = { ok: 0, info: 1, atencao: 2, grave: 3 };
    const nivel = nivelIA && ORD[nivelIA] > ORD[c.nivel] ? nivelIA : c.nivel;
    const incl = EST.incl[i];
    const alertas = c.alertas.map(a => linhaAlerta(a)).join('') + (rv ? linhaAlerta({ nivel: nivelIA, msg: rv.observacao + (rv.sugestao ? ' Sugestão: ' + rv.sugestao : '') }, true) : '');
    const editando = EST.edit[i];
    return `<article class="rx-item nv-${nivel}${incl ? '' : ' fora'}" data-i="${i}">
      <div class="rx-item-top">
        <label class="rx-check" title="${incl ? 'Tirar da prescrição' : 'Incluir na prescrição'}"><input type="checkbox" data-acao="incl" ${incl ? 'checked' : ''} aria-label="Incluir ${esc(it.farmaco)}"><span></span></label>
        <div class="rx-item-nome">
          <h4>${esc(it.farmaco)}${it.apresentacao ? ` <small>${esc(it.apresentacao)}</small>` : ''}</h4>
          <p class="rx-poso">${esc(posologiaDe(it))}${it.duracao ? ` <span class="rx-dur">· ${esc(it.duracao)}</span>` : ''}</p>
          ${it.diluicao ? `<p class="rx-dil"><i class="ti ti-droplet-half-2"></i> ${esc(it.diluicao)}</p>` : ''}
          ${contaTxt(c.conta, it)}
        </div>
        <span class="rx-selo ${nivel}"><i class="ti ${NIVEL[nivel].ic}"></i> ${NIVEL[nivel].t}</span>
      </div>
      ${alertas ? `<ul class="rx-alertas">${alertas}</ul>` : ''}
      ${!incl && c.nivel === 'grave' ? `<div class="rx-manter"><label><input type="checkbox" data-acao="manter"> Li o bloqueio e vou manter este item por decisão clínica</label></div>` : ''}
      ${editando ? formEdit(it, i) : ''}
      <details class="rx-porque"><summary>Por que este item</summary>
        <p>${esc(it.justificativa)}</p>
        ${it.ajuste_renal ? `<p><b>Função renal:</b> ${esc(it.ajuste_renal)}</p>` : ''}
        ${it.alternativa ? `<p><b>Alternativa:</b> ${esc(it.alternativa)}</p>` : ''}
        ${it.referencia ? `<p class="rx-ref"><i class="ti ti-book"></i> ${esc(it.referencia)}</p>` : ''}
      </details>
      <div class="rx-item-acoes">
        <button type="button" class="rx-lk" data-acao="editar"><i class="ti ti-pencil"></i> ${editando ? 'Fechar edição' : 'Editar dose'}</button>
        <button type="button" class="rx-lk" data-acao="remover"><i class="ti ti-trash"></i> Remover</button>
      </div>
    </article>`;
  }
  function formEdit(it, i) {
    const vias = ['VO', 'EV', 'IM', 'SC', 'SL', 'inalatória', 'retal', 'tópica'];
    return `<div class="rx-edit" data-i="${i}">
      <label>Dose<input type="text" inputmode="decimal" data-f="dose_valor" value="${it.dose_valor != null ? fmt(it.dose_valor) : ''}"></label>
      <label>Unidade<input type="text" data-f="dose_unidade" value="${esc(it.dose_unidade)}"></label>
      <label>Via<select data-f="via">${[...new Set([it.via, ...vias])].map(v => `<option${v === it.via ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
      <label>A cada (h)<input type="text" inputmode="decimal" data-f="intervalo_horas" value="${it.intervalo_horas != null ? fmt(it.intervalo_horas) : ''}" placeholder="vazio = contínuo ou dose única"></label>
      <label class="larga">Duração<input type="text" data-f="duracao" value="${esc(it.duracao)}"></label>
      <p class="rx-edit-nota">A conferência refaz a conta a cada mudança.</p>
    </div>`;
  }
  function lista(t, ic, arr) { return arr && arr.length ? `<section class="rx-bloco"><h4><i class="ti ${ic}"></i> ${t}</h4><ul>${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>` : ''; }

  function render(soRevisao) {
    const { presc, conf, p } = EST;
    const rsm = { grave: 0, atencao: 0, info: 0 };
    conf.itens.forEach((c, i) => { const rv = revDoItem(i); const n = rv ? (rv.veredito === 'erro' ? 'grave' : 'atencao') : null; const ORD = { ok: 0, info: 1, atencao: 2, grave: 3 }; const f = n && ORD[n] > ORD[c.nivel] ? n : c.nivel; if (rsm[f] != null) rsm[f]++; });
    const gerais = (EST.rev && Array.isArray(EST.rev.gerais) ? EST.rev.gerais : []).filter(g => g && g.observacao);
    const revTxt = EST.revEstado === 'rodando' ? '<span class="cv-spin"></span> Revisão independente da IA em andamento' : EST.revEstado === 'pronta' ? '<i class="ti ti-shield-check"></i> Revisada por uma segunda IA no papel de farmacêutico' : EST.revEstado === 'falhou' ? '<i class="ti ti-alert-circle"></i> A revisão da IA não respondeu; a conferência por regra continua valendo' : '';
    const grupos = [];
    presc.itens.forEach((it, i) => { let g = grupos.find(x => x.nome === it.grupo); if (!g) grupos.push(g = { nome: it.grupo, idx: [] }); g.idx.push(i); });
    const aberto = document.activeElement && box().contains(document.activeElement) ? document.activeElement : null;
    const foco = aberto && aberto.dataset ? { i: aberto.closest('[data-i]') && aberto.closest('[data-i]').dataset.i, f: aberto.dataset.f } : null;
    box().innerHTML = `
      <div class="rx-res">
        <div class="rx-res-top">
          <div><h3>${esc(p.dx.length > 90 ? p.dx.slice(0, 90) + '…' : p.dx)}</h3><p class="rx-pac"><i class="ti ti-user"></i> ${esc(resumoPaciente(p))}</p></div>
        </div>
        <div class="rx-painel" role="status">
          <div class="rx-cont"><span class="rx-n grave">${rsm.grave}</span> bloqueio${rsm.grave === 1 ? '' : 's'}</div>
          <div class="rx-cont"><span class="rx-n atencao">${rsm.atencao}</span> atenç${rsm.atencao === 1 ? 'ão' : 'ões'}</div>
          <div class="rx-cont"><span class="rx-n info">${rsm.info}</span> aviso${rsm.info === 1 ? '' : 's'}</div>
          <p class="rx-rev">${revTxt}</p>
        </div>
        ${presc.resumo ? `<p class="rx-resumo">${esc(presc.resumo)}</p>` : ''}
        ${presc.suposicoes.length ? `<div class="rx-aviso"><i class="ti ti-help-circle"></i><div><b>A IA assumiu</b><ul>${presc.suposicoes.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div></div>` : ''}
        ${conf.conjunto.filter(a => a.nivel !== 'info').length || presc.alertas_gerais.length || gerais.length ? `<section class="rx-bloco rx-geral"><h4><i class="ti ti-arrows-cross"></i> Interações e alertas do conjunto</h4><ul class="rx-alertas">${conf.conjunto.map(a => linhaAlerta(a)).join('')}${gerais.map(g => linhaAlerta({ nivel: g.nivel === 'erro' ? 'grave' : g.nivel, msg: g.observacao }, true)).join('')}${presc.alertas_gerais.map(t => linhaAlerta({ nivel: 'info', msg: t })).join('')}</ul></section>` : ''}
        ${grupos.map(g => `<section class="rx-grupo"><h4 class="rx-grupo-t">${esc(g.nome)}</h4>${g.idx.map(i => cardItem(presc.itens[i], i)).join('')}</section>`).join('')}
        ${lista('Medidas não farmacológicas', 'ti-heart-handshake', presc.nao_farmacologico)}
        ${lista('Monitorizar', 'ti-activity-heartbeat', presc.monitorizacao)}
        ${lista('Reavaliar', 'ti-calendar-event', presc.reavaliar)}
        ${presc.raciocinio ? `<details class="rx-bloco rx-racio"><summary><i class="ti ti-bulb"></i> Raciocínio da escolha</summary><p>${esc(presc.raciocinio)}</p></details>` : ''}
        ${presc.referencias.length ? `<section class="rx-bloco rx-refs"><h4><i class="ti ti-books"></i> Referências</h4><ul>${presc.referencias.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>` : ''}
        <section class="rx-ajuste">
          <label for="rxAjuste"><i class="ti ti-adjustments"></i> Pedir um ajuste</label>
          <div class="rx-ajuste-linha"><input id="rxAjuste" type="text" placeholder="Ex.: paciente em hemodiálise; troque por via oral; sem quinolona" autocomplete="off"><button type="button" class="cv-bt sec" id="rxAjusteGo">Refazer</button></div>
        </section>
        <div class="rx-fim">
          <label class="rx-conferi"><input type="checkbox" id="rxConferi"> Conferi doses, alergias e interações deste paciente</label>
          <div class="rx-acoes"><button type="button" class="gaso-btn" id="rxCopia" disabled><i class="ti ti-copy"></i> Copiar prescrição</button><button type="button" class="cv-bt sec" id="rxNova"><i class="ti ti-refresh"></i> Recomeçar</button></div>
          <p class="rx-nota">Apoio à decisão. A prescrição e a responsabilidade são do médico assistente.</p>
        </div>
      </div>`;
    liga();
    if (foco && foco.i != null && foco.f) { const el = box().querySelector(`.rx-edit[data-i="${foco.i}"] [data-f="${foco.f}"]`); if (el) { el.focus(); if (el.setSelectionRange && el.type === 'text') el.setSelectionRange(el.value.length, el.value.length); } }
    if (!soRevisao) cvMostra(box());
  }

  function liga() {
    const R = box();
    R.querySelectorAll('.rx-item').forEach(card => {
      const i = +card.dataset.i;
      card.addEventListener('change', e => {
        const a = e.target.dataset.acao;
        if (a === 'incl') {
          EST.conferido = false; const cf = $('rxConferi'); if (cf) { cf.checked = false; $('rxCopia').disabled = true; }
          if (e.target.checked && EST.conf.itens[i].nivel === 'grave' && !card.querySelector('[data-acao="manter"]:checked')) {
            e.target.checked = false; EST.incl[i] = false; render(true);
            const m = box().querySelector(`.rx-item[data-i="${i}"] [data-acao="manter"]`); if (m) m.focus();
            aviso('Item bloqueado: confirme que vai manter por decisão clínica', 'erro'); return;
          }
          EST.incl[i] = e.target.checked; card.classList.toggle('fora', !e.target.checked);
        }
        if (a === 'manter') { if (e.target.checked) { EST.incl[i] = true; render(true); } }
      });
      card.addEventListener('click', e => {
        const b = e.target.closest('[data-acao]'); if (!b || b.tagName === 'INPUT') return;
        if (b.dataset.acao === 'editar') { EST.edit[i] = !EST.edit[i]; render(true); const f = box().querySelector(`.rx-edit[data-i="${i}"] input`); if (f) f.focus(); }
        if (b.dataset.acao === 'remover') { EST.presc.itens.splice(i, 1); EST.incl.splice(i, 1); EST.edit.splice(i, 1); if (EST.rev && Array.isArray(EST.rev.itens)) EST.rev.itens = EST.rev.itens.filter(x => +x.indice !== i).map(x => (+x.indice > i ? Object.assign({}, x, { indice: +x.indice - 1 }) : x)); reconfere(); aviso('Item removido', 'ok'); }
      });
      const ed = card.querySelector('.rx-edit');
      if (ed) ed.addEventListener('input', e => {
        const f = e.target.dataset.f; if (!f) return;
        const it = EST.presc.itens[i]; let v = e.target.value;
        if (f === 'dose_valor' || f === 'intervalo_horas') v = num(v);
        it[f] = v; it._editado = true;
        if (f === 'intervalo_horas') { it.continuo = false; it.dose_unica = v == null ? it.dose_unica : false; }
        if (EST.rev && Array.isArray(EST.rev.itens)) EST.rev.itens = EST.rev.itens.filter(x => +x.indice !== i); // a revisão da IA era da versão anterior
        clearTimeout(ed._t); ed._t = setTimeout(reconfere, 250);
      });
    });
    const conferi = $('rxConferi'), copia = $('rxCopia');
    conferi.checked = !!EST.conferido; copia.disabled = !conferi.checked;
    conferi.onchange = () => { EST.conferido = conferi.checked; copia.disabled = !conferi.checked; };
    copia.onclick = () => {
      const txt = textoPrescricao();
      if (!txt) { aviso('Nenhum item incluído', 'erro'); return; }
      cvCopia(txt, 'Prescrição copiada', () => { copia.innerHTML = '<i class="ti ti-check"></i> Copiada'; setTimeout(() => { copia.innerHTML = '<i class="ti ti-copy"></i> Copiar prescrição'; }, 1800); });
    };
    $('rxNova').onclick = () => { EST = null; box().innerHTML = ''; $('p_dx').focus(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    const aj = $('rxAjuste'), ajGo = $('rxAjusteGo');
    const pedir = () => { const t = aj.value.trim(); if (t) ajustar(t, ajGo); };
    ajGo.onclick = pedir;
    aj.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); pedir(); } });
  }

  async function ajustar(pedido, bt) {
    if (bt) cvOcupa(bt, true);
    const contents = [...EST.contents, { role: 'user', parts: [{ text: `Ajuste pedido pelo médico: ${pedido}\n\nDevolva a prescrição COMPLETA no mesmo formato, já com o ajuste, mantendo as mesmas regras de segurança. Se o ajuste não for seguro, não o faça e explique em alertas_gerais.` }] }];
    try {
      const r = await ia(contents, { model: 'gemini-2.5-pro', system: SIS, json: ESQ_PRESC, temperature: 0.2, maxTokens: 24576 });
      const presc = normaliza(jsonDe(r.text));
      EST.contents = [...contents, { role: 'model', parts: [{ text: JSON.stringify(presc) }] }];
      if (/hemodi|dialis/i.test(pedido) && !EST.p.dialise) EST.p.dialise = /peritoneal/i.test(pedido) ? 'diálise peritoneal' : 'hemodiálise';
      aplica(presc);
      aviso('Prescrição refeita com o ajuste', 'ok');
    } catch (err) { aviso(err.message || 'Falha ao refazer', 'erro'); if (bt) cvOcupa(bt, false); }
  }

  function textoPrescricao() {
    const { presc, p } = EST;
    const itens = presc.itens.map((it, i) => ({ it, i })).filter(x => EST.incl[x.i]);
    if (!itens.length) return '';
    const fixos = itens.filter(x => !x.it.se_necessario), sos = itens.filter(x => x.it.se_necessario);
    const linha = (x, n) => `${n}. ${x.it.farmaco}${x.it.apresentacao ? ' (' + x.it.apresentacao + ')' : ''} — ${posologiaDe(x.it)}${x.it.diluicao ? ' — ' + x.it.diluicao : ''}${x.it.duracao ? ' — ' + x.it.duracao : ''}`;
    let n = 0; const L = [];
    L.push(`Prescrição — ${p.dx.split('\n')[0].slice(0, 120)}`);
    L.push(`Paciente: ${resumoPaciente(p)}`);
    L.push('');
    fixos.forEach(x => L.push(linha(x, ++n)));
    if (sos.length) { L.push('', 'Se necessário:'); sos.forEach(x => L.push(linha(x, ++n))); }
    if (presc.nao_farmacologico.length) { L.push('', 'Cuidados:'); presc.nao_farmacologico.forEach(t => L.push('- ' + t)); }
    if (presc.monitorizacao.length) { L.push('', 'Monitorizar:'); presc.monitorizacao.forEach(t => L.push('- ' + t)); }
    return L.join('\n');
  }

  /* ================= Ligações da tela ================= */
  function init() {
    if (!$('prescricaoView') || !$('p_dx') || !S) return;
    restaura(); pintaTfg();
    ['p_idade', 'p_peso', 'p_creat', 'p_altura'].forEach(id => $(id).addEventListener('input', () => { pintaTfg(); guarda(); }));
    document.querySelectorAll('#prescricaoView input[type="radio"]').forEach(r => r.addEventListener('change', () => { pintaTfg(); guarda(); }));
    ['p_alergias', 'p_emuso', 'p_dx', 'p_obs'].forEach(id => $(id).addEventListener('input', () => { const c = $(id).closest('.rx-erro'); if (c) c.classList.remove('rx-erro'); guarda(); }));
    $('p_nega').onclick = () => { marcaNega($('p_nega').getAttribute('aria-pressed') !== 'true'); const c = $('p_alergias').closest('.rx-erro'); if (c) c.classList.remove('rx-erro'); guarda(); };
    $('presGo').onclick = () => iniciar();
    $('rxLimpa').onclick = () => {
      try { sessionStorage.removeItem(PK); } catch (e) {}
      $('prescricaoView').querySelectorAll('input[type="text"],input[type="number"],textarea').forEach(el => { el.value = ''; });
      $('prescricaoView').querySelectorAll('input[type="radio"]').forEach(r => { r.checked = r.defaultChecked; });
      marcaNega(false); pintaTfg(); box().innerHTML = ''; EST = null; window.dispatchEvent(new CustomEvent('cv-paciente'));
      aviso('Dados do paciente apagados desta aba', 'ok');
    };
    window.runPrescricao = iniciar;
  }
  window.CVPresc = { resumoPaciente: () => { try { const p = coleta(); if (!(p.idade || p.peso || p.alergiaRespondida)) return ''; return resumoPaciente(p); } catch (e) { return ''; } },
    abrirCom: (dx) => { if (typeof showView === 'function') showView('prescricao'); if (dx) { $('p_dx').value = dx; guarda(); } setTimeout(() => { const alvo = !$('p_idade').value ? $('p_idade') : $('p_dx'); alvo.focus(); }, 80); },
    _estado: () => EST, _coleta: coleta, _aplica: aplica, _render: render };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
