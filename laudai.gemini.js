// Integração Gemini — geração de laudo a partir de imagens + vídeo (Files API)
const Gemini = (() => {
  const BASE = 'https://generativelanguage.googleapis.com';

  // Namespaced por UID — evita vazar chave entre contas no mesmo aparelho.
  function ns(k) {
    const uid = (typeof window !== 'undefined' && window.currentUid) ? window.currentUid : '';
    return uid ? `${uid}:${k}` : k;
  }
  function getKey() { return ''; }  // BYOK desativado na versão MedTech (IA pelo backend central)
  function setKey(k) {
    if (k) localStorage.setItem(ns('geminiKey'), k);
    else localStorage.removeItem(ns('geminiKey'));
  }
  function getModel() { return localStorage.getItem(ns('geminiModel')) || 'gemini-2.5-pro'; }
  function setModel(m) { if (m) localStorage.setItem(ns('geminiModel'), m); }

  async function safeErr(res) {
    try { const j = await res.json(); return j?.error?.message || `${res.status} ${res.statusText}`; }
    catch { return `${res.status} ${res.statusText}`; }
  }
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // ===== Files API (vídeo) =====
  async function uploadVideo(file, onProgress) {
    const key = getKey();
    if (!key) throw new Error('Configure sua Google API Key primeiro.');

    onProgress?.('Iniciando upload do vídeo…', 5);
    const startRes = await fetch(`${BASE}/upload/v1beta/files?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(file.size),
        'X-Goog-Upload-Header-Content-Type': file.type || 'video/mp4',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file: { display_name: file.name } }),
    });
    if (!startRes.ok) throw new Error(`Falha ao iniciar upload: ${await safeErr(startRes)}`);
    const uploadUrl = startRes.headers.get('x-goog-upload-url') || startRes.headers.get('X-Goog-Upload-URL');
    if (!uploadUrl) throw new Error('URL de upload não retornada.');

    onProgress?.('Enviando bytes do vídeo…', 20);
    const upRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Length': String(file.size),
        'X-Goog-Upload-Offset': '0',
        'X-Goog-Upload-Command': 'upload, finalize',
      },
      body: file,
    });
    if (!upRes.ok) throw new Error(`Falha no upload: ${await safeErr(upRes)}`);
    const upJson = await upRes.json();
    const fileObj = upJson.file;
    if (!fileObj?.name) throw new Error('Resposta inválida do upload.');

    onProgress?.('Google processando o vídeo…', 45);
    const maxWaitMs = 5 * 60 * 1000;
    const start = Date.now();
    let current = fileObj;
    while (current.state !== 'ACTIVE') {
      if (current.state === 'FAILED') throw new Error('Processamento do vídeo falhou no servidor.');
      if (Date.now() - start > maxWaitMs) throw new Error('Timeout aguardando processamento do vídeo.');
      await sleep(2500);
      const stateRes = await fetch(`${BASE}/v1beta/${current.name}?key=${encodeURIComponent(key)}`);
      if (!stateRes.ok) throw new Error(`Falha verificando status: ${await safeErr(stateRes)}`);
      current = await stateRes.json();
      const elapsed = Math.min(85, 45 + Math.floor((Date.now() - start) / maxWaitMs * 40));
      onProgress?.('Google processando o vídeo…', elapsed);
    }
    return { uri: current.uri, mimeType: current.mimeType || file.type || 'video/mp4', name: current.name };
  }

  // ===== generateContent =====
  // Modos:
  //   - BYOK: usuário colou sua própria chave Gemini → chama API direto
  //   - Pro:  sem chave própria → chama Cloud Function (que valida assinatura + 3 grátis)
  function isByokMode() { return !!getKey(); }

  function buildParts(media, ctx) {
    const parts = [];
    media.forEach((m, i) => {
      if (m.kind === 'image' || m.kind === 'dicom') {
        parts.push({ text: m.kind === 'dicom' ? `Imagem ${i + 1} (DICOM, ${m.label || m.name}):` : `Imagem ${i + 1}: ${m.name}` });
        parts.push({ inline_data: { mime_type: m.mimeType, data: m.base64 } });
      } else {
        parts.push({ text: `Vídeo ${i + 1}: ${m.name}` });
        parts.push({ file_data: { mime_type: m.mimeType, file_uri: m.fileUri } });
      }
    });
    parts.push({ text: buildPrompt(ctx, media) });
    return parts;
  }

  async function generateLaudo({ media, ctx, model }) {
    const parts = buildParts(media, ctx);
    if (isByokMode()) {
      return await generateDirect(parts, model);
    }
    return await generateViaProxy(parts, model, media);
  }

  async function generateDirect(parts, model) {
    const key = getKey();
    const body = {
      contents: [{ role: 'user', parts }],
      generationConfig: { temperature: 0.35, topP: 0.95, maxOutputTokens: 8192 },
    };
    const url = `${BASE}/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await safeErr(res);
      if (res.status === 400 && /API key/i.test(detail)) throw new Error('API Key inválida. Verifique nas configurações.');
      if (res.status === 429) throw new Error('Cota / rate limit excedido. Aguarde alguns segundos ou troque para Flash.');
      if (res.status === 403) throw new Error('Acesso negado: ' + detail);
      throw new Error(detail);
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join('\n') || '';
    if (!text) {
      const blockReason = data?.promptFeedback?.blockReason;
      if (blockReason) throw new Error(`Resposta bloqueada pela política de segurança do Gemini: ${blockReason}. Tente reformular a história clínica.`);
      throw new Error('Resposta vazia da API.');
    }
    return { text, mode: 'byok' };
  }

  // A IA roda no MedTech central (callables gemini/geminiImage → Vertex, SEM chave).
  // radioia-a61ec foi aposentado. Imagens vão pelo geminiImage (até 14 MB, até 6 imgs);
  // laudos só-texto (ex.: valores laboratoriais digitados) vão pelo gemini.
  async function generateViaProxy(parts, model, media) {
    // Vídeo não suportado nesta versão (exigia BYOK, agora removido).
    if (media.some(m => m.kind === 'video')) {
      const err = new Error('VIDEO_BYOK_REQUIRED');
      err.code = 'video-byok-required';
      throw err;
    }
    const MT = (typeof window !== 'undefined') ? window.MT : null;
    if (!MT || !MT.user) throw new Error('Entre na sua conta MedTech para gerar laudos.');
    // separa imagens e texto dos parts já montados por buildParts
    const images = [], texts = [];
    for (const p of parts) {
      if (p && p.inline_data && p.inline_data.data) images.push({ data: p.inline_data.data, mimeType: p.inline_data.mime_type || 'image/jpeg' });
      else if (p && p.text) texts.push(p.text);
    }
    const prompt = texts.join('\n\n');
    if (images.length > 6) throw new Error('Máximo de 6 imagens por laudo — remova algumas e tente de novo.');
    let text;
    try {
      text = images.length ? await MT.aiImage(images, prompt, model) : await MT.ai(prompt, model);
    } catch (e) {
      const msg = (e && e.message) || 'Falha na IA.';
      if (/unauthenticated|Entre na sua conta/i.test(msg)) throw new Error('Entre na sua conta MedTech para gerar laudos.');
      if (/grande|large|reduza|resoluç/i.test(msg)) throw new Error('Imagem muito grande — reduza a resolução e tente de novo.');
      throw new Error(msg);
    }
    if (!text || !String(text).trim()) throw new Error('Resposta vazia da IA. Tente reformular a história clínica ou trocar o modelo.');
    return { text: String(text), mode: 'central' };
  }

  // A IA vem incluída na conta MedTech (nível ecossistema) — sem paywall/trial por app.
  async function getSubscriptionStatus() {
    const u = (typeof window !== 'undefined' && window.MT) ? window.MT.user : null;
    if (!u) return null;
    return { isPaid: true, ecosystem: true };
  }

  // Detecta categoria do exame pelo nome da modalidade e devolve papel + seções + dicas técnicas
  function getExamContext(modality) {
    const m = (modality || '').toLowerCase();
    const match = (re) => re.test(m);

    if (match(/radiograf|tomograf|ressonânci|ressonanci|ultrassonograf|ultrassom|mamograf|densitometr|medicina nuclear|pet-?ct|fluoroscop|angiograf/)) return {
      role: 'um radiologista experiente',
      sections: '**TÉCNICA**, **ACHADOS** (sistematizado por estrutura/órgão), **IMPRESSÃO DIAGNÓSTICA**, **RECOMENDAÇÕES**',
      hints: 'Use terminologia radiológica formal. Descreva achados por sistema/região anatômica. Mencione localização e tamanho.',
    };
    if (match(/dermatosc|lesão de pele|lesao de pele|dermatológ|dermatologic/)) return {
      role: 'um dermatologista experiente',
      sections: '**DESCRIÇÃO DA LESÃO** (regra ABCDE: assimetria, bordas, cor, diâmetro, evolução; padrão dermatoscópico se aplicável), **DIAGNÓSTICOS DIFERENCIAIS** (em ordem de probabilidade), **RECOMENDAÇÕES** (biópsia, dermatoscopia adicional, seguimento)',
      hints: 'Avalie sinais de alerta para malignidade (ABCDE; padrões dermatoscópicos como rede pigmentada atípica, véu azul-acinzentado, regressão, vasos atípicos). Diferencie nevus benigno de melanoma, CBC, CEC, queratose actínica.',
    };
    if (match(/endoscop|colonoscopia/)) return {
      role: 'um endoscopista experiente',
      sections: '**SEGMENTOS VISUALIZADOS**, **ACHADOS POR SEGMENTO**, **IMPRESSÃO**, **RECOMENDAÇÕES** (biópsia, controle, polipectomia)',
      hints: 'Descreva achados por segmento anatômico. Use classificações relevantes: Paris para pólipos, Forrest para HDA, Los Angeles para esofagite de refluxo, Boston para qualidade do preparo.',
    };
    if (match(/fundoscop|retinograf|oftalmoscop/)) return {
      role: 'um oftalmologista experiente',
      sections: '**DESCRIÇÃO DO FUNDO DE OLHO** (disco óptico e escavação, mácula, vasos, periferia), **ACHADOS RELEVANTES**, **IMPRESSÃO**, **RECOMENDAÇÕES**',
      hints: 'Avalie escavação do disco (E/D), mácula (drusen, edema, hemorragias), vasos retinianos (cruzamentos AV, espessamento), sinais de retinopatia diabética (microaneurismas, exsudatos, neovasos) ou hipertensiva.',
    };
    if (match(/anatomopatol|histopatol|microscop/)) return {
      role: 'um patologista experiente',
      sections: '**DESCRIÇÃO MACROSCÓPICA** (se aplicável), **DESCRIÇÃO MICROSCÓPICA**, **DIAGNÓSTICO HISTOPATOLÓGICO**, **OBSERVAÇÕES** (IHC sugerida, classificação OMS, marcadores)',
      hints: 'Use terminologia patológica formal. Cite classificações OMS quando aplicável. Sugira imunohistoquímica e marcadores moleculares quando indicado.',
    };
    if (match(/ecg|eletrocardiogr|holter/)) return {
      role: 'um cardiologista experiente em eletrocardiografia',
      sections: '**RITMO E FREQUÊNCIA**, **EIXO E INTERVALOS** (PR, QRS, QT/QTc), **ANÁLISE POR DERIVAÇÃO**, **IMPRESSÃO** (laudo descritivo final), **CONDUTA SUGERIDA**',
      hints: 'Identifique ritmo, FC, eixo, alterações de condução (BAV, BR, bloqueios fasciculares), sinais de isquemia/infarto (supra/infra de ST, ondas Q patológicas, T isquêmicas), hipertrofias (Sokolow-Lyon, Cornell), sobrecargas atriais, alterações eletrolíticas (K+, Ca++).',
    };
    if (match(/mapa/)) return {
      role: 'um cardiologista experiente em MAPA',
      sections: '**MÉDIAS** (24h, vigília, sono), **DESCENSO NOTURNO**, **VARIABILIDADE**, **CARGA TENSIONAL**, **IMPRESSÃO**',
      hints: 'Classifique como dipper / non-dipper / extreme dipper / riser. Carga > 30% é anormal. Correlacione com sintomas registrados pelo paciente.',
    };
    if (match(/eeg|eletroencef/)) return {
      role: 'um neurofisiologista clínico experiente',
      sections: '**TRAÇADO DE BASE** (vigília, sonolência, sono se aplicável; ritmos por região), **PAROXISMOS / ATIVIDADES ANORMAIS**, **RESPOSTA A ESTÍMULOS** (fotoestimulação, hiperpneia), **IMPRESSÃO**',
      hints: 'Identifique ritmo de base por região (alfa, beta, theta, delta), paroxismos epileptiformes (focais/generalizados, tipo), assimetrias, lentificações focais ou difusas.',
    };
    if (match(/espirometr/)) return {
      role: 'um pneumologista experiente',
      sections: '**VALORES MEDIDOS vs PREVISTOS** (CVF, VEF1, VEF1/CVF, PFE, FEF25-75), **INTERPRETAÇÃO** (normal / obstrutivo / restritivo / misto), **GRAVIDADE**, **RESPOSTA A BRONCODILATADOR** (se houver), **IMPRESSÃO**',
      hints: 'Use critérios GLI/SBPT. VEF1/CVF < 0,7 sugere obstrução. Avalie reversibilidade pós-BD (Δ VEF1 ≥ 12% e ≥ 200 ml).',
    };
    if (match(/gasometri/)) return {
      role: 'um intensivista / clínico experiente em gasometria',
      sections: '**RESULTADOS**, **INTERPRETAÇÃO ÁCIDO-BASE** (passo-a-passo: pH → distúrbio primário pelo PaCO2/HCO3 → compensação esperada → distúrbios mistos com ânion gap quando indicado), **OXIGENAÇÃO** (PaO2/FiO2 se disponível, gradiente A-a), **IMPRESSÃO**, **CONDUTA SUGERIDA**',
      hints: 'pH 7,35-7,45 normal. Compensação esperada: Winter para metabólica (PaCO2 = 1,5×HCO3 + 8 ± 2). Calcule ânion gap (Na - Cl - HCO3, normal 8-12). Identifique acidose/alcalose, respiratória/metabólica, aguda/crônica.',
    };
    if (match(/hemograma/)) return {
      role: 'um hematologista / patologista clínico experiente',
      sections: '**SÉRIE ERITROCITÁRIA** (Hb, Ht, índices VCM/HCM/CHCM, RDW, morfologia), **SÉRIE LEUCOCITÁRIA** (contagem total, diferencial, atipias), **SÉRIE PLAQUETÁRIA**, **IMPRESSÃO**, **HIPÓTESES DIAGNÓSTICAS**, **CONDUTA SUGERIDA**',
      hints: 'Anemia: classifique pelo VCM (micro/normo/macrocítica) e RDW. Leucocitose: desvio à esquerda, atipias, linfocitose vs neutrofilia. Plaquetas: <150k trombocitopenia, >450k trombocitose. Avalie reticulócitos se disponíveis.',
    };
    if (match(/bioquímic|painel|labora|coagulograma|coagulação|coagulacao|eas|urina|sorologia|hormônio|hormonio|marcadores/)) return {
      role: 'um patologista clínico experiente',
      sections: '**RESULTADOS POR PAINEL** (função renal, hepática, eletrólitos, glicemia, lípides, hormônios, marcadores), **VALORES ALTERADOS COM SIGNIFICADO CLÍNICO**, **IMPRESSÃO**, **HIPÓTESES DIAGNÓSTICAS**, **CONDUTA SUGERIDA**',
      hints: 'Liste apenas achados alterados ou clinicamente relevantes. Correlacione com a história clínica. Cite valores de referência quando ajudar na interpretação.',
    };
    return {
      role: 'um médico especialista experiente na área do exame fornecido',
      sections: '**DESCRIÇÃO DO EXAME**, **ACHADOS RELEVANTES**, **IMPRESSÃO**, **RECOMENDAÇÕES**',
      hints: 'Adapte a estrutura do laudo ao tipo de exame. Mantenha terminologia técnica apropriada.',
    };
  }

  function buildPrompt(ctx, media) {
    const langInstr = {
      'pt-BR': 'Responda em PORTUGUÊS DO BRASIL, terminologia médica formal.',
      'en': 'Respond in ENGLISH, formal medical terminology.',
      'es': 'Responda en ESPAÑOL, terminología médica formal.',
    }[ctx.language];

    const examCtx = getExamContext(ctx.modality);

    const styleInstr = ctx.style === 'narrativo'
      ? 'Use texto corrido, fluido, em parágrafos coesos, terminando com conclusão sintética.'
      : ctx.style === 'acr'
      ? 'Siga o padrão ACR/RSNA quando aplicável (CLINICAL INFORMATION, TECHNIQUE, FINDINGS, IMPRESSION numerada). Adapte para o tipo de exame.'
      : `Estruture o laudo nas seções: ${examCtx.sections}.`;

    const counts = {
      img: media.filter(m => m.kind === 'image').length,
      dcm: media.filter(m => m.kind === 'dicom').length,
      vid: media.filter(m => m.kind === 'video').length,
    };
    const mediaSummary = [
      counts.img ? `${counts.img} imagem(ns)` : null,
      counts.dcm ? `${counts.dcm} corte(s) DICOM renderizado(s)` : null,
      counts.vid ? `${counts.vid} vídeo(s)` : null,
      ctx.examText ? 'texto/resultados fornecidos' : null,
    ].filter(Boolean).join(' + ') || 'os dados fornecidos';

    const hasVideo = counts.vid > 0;
    const hasDicom = counts.dcm > 0;
    const seriesHint = (hasVideo || hasDicom)
      ? `\n\nO material representa uma SÉRIE (cortes consecutivos / cine). Analise frame a frame: identifique janela/sequência, descreva achados ao longo da série, mencione localização aproximada e relacione achados visíveis em múltiplos cortes.`
      : '';

    return `Você é ${examCtx.role} atuando como ferramenta de SEGUNDA OPINIÃO ASSISTIDA por IA. Analise ${mediaSummary} e produza um laudo profissional.

DADOS DO EXAME:
- Tipo: ${ctx.modality}
- Detalhes / Região: ${ctx.region}
${ctx.age ? `- Idade: ${ctx.age}\n` : ''}${ctx.sex ? `- Sexo: ${ctx.sex}\n` : ''}${ctx.history ? `- História clínica / indicação: ${ctx.history}\n` : ''}${ctx.examText ? `\nTEXTO / RESULTADOS FORNECIDOS:\n"""\n${ctx.examText}\n"""\n` : ''}${ctx.dicomMeta ? `\n- Metadados DICOM: ${ctx.dicomMeta}\n` : ''}${seriesHint}

INSTRUÇÕES:
- ${langInstr}
- ${styleInstr}
- ${examCtx.hints}
- Use **Markdown**: ## para seções principais, ### para subseções, **negrito** para achados críticos.
- Diferencie OBSERVAÇÃO objetiva de IMPRESSÃO / HIPÓTESE diagnóstica.
- Liste DIAGNÓSTICOS DIFERENCIAIS em ordem de probabilidade quando aplicável.
- Sinalize achados que demandam atenção imediata com prefixo ⚠️.
- Se a qualidade do material for ruim, técnica inadequada, ou os dados não corresponderem ao tipo de exame informado, declare isso em "LIMITAÇÕES" no início.
- Se você não consegue identificar o material como exame médico válido, recuse a análise e explique.
- Recomende correlação clínica, exames complementares ou seguimento quando pertinente.
- Em "Severidade global" (linha curta ao final), classifique como: NORMAL, ALTERAÇÕES MENORES, ALTERAÇÕES SIGNIFICATIVAS, ou ACHADO CRÍTICO/URGENTE.

NÃO adicione disclaimers no final — o app já mostra um aviso de uso médico responsável.

Comece o laudo agora:`;
  }

  return { getKey, setKey, getModel, setModel, uploadVideo, generateLaudo, getSubscriptionStatus, isByokMode };
})();
