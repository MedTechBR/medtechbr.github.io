// Integração com Google Gemini API
// Documentação: https://ai.google.dev/api/generate-content

const Gemini = (() => {
  const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

  // Chaves namespaced por UID pra não vazar entre contas no mesmo aparelho
  function ns(k) {
    const uid = (typeof window !== 'undefined' && window.currentUid) ? window.currentUid : '';
    return uid ? `${uid}:${k}` : k;
  }
  function getKey() {
    // IA central MedTech (sem chave do usuário): "presente" quando logado na conta
    // MedTech, para os antigos checks if(!getKey()) continuarem passando.
    const u = (typeof window !== 'undefined' && window.MT) ? window.MT.user : null;
    return u ? 'medtech-central' : '';
  }
  function getModel() {
    return localStorage.getItem(ns('geminiModel')) || 'gemini-2.5-flash';
  }
  function setKey(k) {
    if (k) localStorage.setItem(ns('geminiKey'), k);
    else localStorage.removeItem(ns('geminiKey'));
  }
  function setModel(m) {
    if (m) localStorage.setItem(ns('geminiModel'), m);
  }

  async function call({ parts, systemInstruction, responseSchema, jsonMode = false, temperature = 0.4 }) {
    // IA central MedTech (Vertex, SEM chave): chama o portão com o login do usuário.
    const user = (typeof window !== 'undefined' && window.MT) ? window.MT.user : null;
    if (!user) throw new Error('Entre na sua conta MedTech para usar a IA.');
    const idToken = await user.getIdToken();

    const generationConfig = { temperature, topP: 0.95 };
    if (jsonMode) {
      generationConfig.responseMimeType = 'application/json';
      if (responseSchema) generationConfig.responseSchema = responseSchema;
    }
    const reqBody = {
      contents: [{ role: 'user', parts }],
      model: 'gemini-2.5-flash',
      generationConfig,
    };
    if (systemInstruction) reqBody.systemInstruction = { parts: [{ text: systemInstruction }] };

    const res = await fetch('https://southamerica-east1-medtech-c658c.cloudfunctions.net/aigateway', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
      body: JSON.stringify(reqBody),
    });

    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json())?.error || ''; } catch {}
      throw new Error(`IA ${res.status}: ${detail || res.statusText}`);
    }
    const data = await res.json();
    const text = (data && data.text) || '';
    return { text, raw: data };
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const s = reader.result;
        const base64 = typeof s === 'string' ? s.split(',')[1] : '';
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Gemini não aceita XLSX/XLS/ODS direto — converte para CSV no navegador via SheetJS
  async function spreadsheetToCsv(file) {
    const name = (file.name || '').toLowerCase();
    const isSheet = /\.(xlsx|xls|ods|numbers)$/.test(name)
      || /spreadsheet|ms-excel|opendocument/.test(file.type || '');
    if (!isSheet) return file;
    if (typeof XLSX === 'undefined') {
      throw new Error('Biblioteca de planilhas não carregou. Verifique sua conexão e recarregue a página.');
    }
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const csv = wb.SheetNames.map(sn => {
      const sheet = wb.Sheets[sn];
      const sheetCsv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
      return `# Aba: ${sn}\n${sheetCsv}`;
    }).join('\n\n');
    return new Blob([csv], { type: 'text/csv' });
  }

  // ====== Casos de uso ======

  async function classifyText(text, categories) {
    const sys = `Você é um assistente financeiro brasileiro. Receba uma frase do usuário descrevendo uma transação (gasto ou recebimento) e devolva um JSON com os campos extraídos. Datas relativas como "hoje", "ontem" devem virar uma data ISO (YYYY-MM-DD) considerando o fuso horário do Brasil. Se faltar valor ou descrição, retorne null no campo. Categoria deve ser escolhida estritamente da lista fornecida (use o NOME exato). Valores em reais.`;

    const schema = {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['income', 'expense'] },
        amount: { type: 'number' },
        description: { type: 'string' },
        category: { type: 'string' },
        date: { type: 'string' },
        confidence: { type: 'number' },
      },
      required: ['type', 'amount', 'description', 'category', 'date'],
    };

    const today = new Date().toISOString().slice(0, 10);
    const catList = categories.map(c => `- ${c.name} (${c.type === 'income' ? 'receita' : 'despesa'})`).join('\n');
    const prompt = `Hoje é ${today}.\nCategorias disponíveis:\n${catList}\n\nFrase do usuário: """${text}"""`;

    const { text: out } = await call({
      parts: [{ text: prompt }],
      systemInstruction: sys,
      jsonMode: true,
      responseSchema: schema,
      temperature: 0.2,
    });
    return JSON.parse(out);
  }

  async function classifyAudio(audioBlob, categories) {
    const sys = `Você é um assistente financeiro brasileiro. Transcreva o áudio (em português do Brasil) e extraia uma transação financeira. Devolva apenas um JSON com type, amount, description, category, date (YYYY-MM-DD) e transcription. Datas relativas viram absolutas no fuso do Brasil. Categoria deve ser exatamente um dos nomes da lista.`;
    const schema = {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['income', 'expense'] },
        amount: { type: 'number' },
        description: { type: 'string' },
        category: { type: 'string' },
        date: { type: 'string' },
        transcription: { type: 'string' },
      },
      required: ['type', 'amount', 'description', 'category', 'date', 'transcription'],
    };

    const today = new Date().toISOString().slice(0, 10);
    const catList = categories.map(c => `- ${c.name} (${c.type === 'income' ? 'receita' : 'despesa'})`).join('\n');
    const base64 = await blobToBase64(audioBlob);
    const mimeType = audioBlob.type || 'audio/webm';

    const { text: out } = await call({
      parts: [
        { text: `Hoje é ${today}.\nCategorias disponíveis:\n${catList}` },
        { inline_data: { mime_type: mimeType, data: base64 } },
      ],
      systemInstruction: sys,
      jsonMode: true,
      responseSchema: schema,
      temperature: 0.2,
    });
    return JSON.parse(out);
  }

  async function analyzeInvoice(file, categories) {
    const sys = `Você analisa faturas de cartão de crédito brasileiras (PDF ou imagem). Extraia todas as compras individuais como transações do tipo expense, com data (YYYY-MM-DD), descrição (estabelecimento), valor em reais e categoria escolhida estritamente da lista. Ignore pagamentos, créditos, juros e tarifas (a menos que sejam compras). Se houver parcelas, mantenha apenas a parcela atual.`;
    const schema = {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              date: { type: 'string' },
              description: { type: 'string' },
              amount: { type: 'number' },
              category: { type: 'string' },
            },
            required: ['date', 'description', 'amount', 'category'],
          },
        },
      },
      required: ['items'],
    };

    const catList = categories.filter(c => c.type === 'expense').map(c => `- ${c.name}`).join('\n');
    const converted = await spreadsheetToCsv(file);
    const base64 = await blobToBase64(converted);
    const mimeType = converted.type || 'application/octet-stream';
    const { text: out } = await call({
      parts: [
        { text: `Categorias de despesa disponíveis:\n${catList}\n\nExtraia todas as compras da fatura.` },
        { inline_data: { mime_type: mimeType, data: base64 } },
      ],
      systemInstruction: sys,
      jsonMode: true,
      responseSchema: schema,
      temperature: 0.2,
    });
    return JSON.parse(out);
  }

  async function analyzeFixedSheet(file, categories) {
    const sys = `Você interpreta planilhas (CSV/XLSX) de orçamento fixo mensal brasileiro. Extraia itens fixos como receitas (income) ou despesas (expense) com nome, valor médio mensal e categoria escolhida estritamente da lista. Se uma linha tiver vários meses, calcule a média. Ignore totais, somatórios e cabeçalhos.`;
    const schema = {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              type: { type: 'string', enum: ['income', 'expense'] },
              amount: { type: 'number' },
              category: { type: 'string' },
            },
            required: ['name', 'type', 'amount', 'category'],
          },
        },
      },
      required: ['items'],
    };

    const catList = categories.map(c => `- ${c.name} (${c.type === 'income' ? 'receita' : 'despesa'})`).join('\n');
    const converted = await spreadsheetToCsv(file);
    const base64 = await blobToBase64(converted);
    const mimeType = converted.type || 'text/csv';
    const { text: out } = await call({
      parts: [
        { text: `Categorias disponíveis:\n${catList}\n\nExtraia os itens fixos da planilha.` },
        { inline_data: { mime_type: mimeType, data: base64 } },
      ],
      systemInstruction: sys,
      jsonMode: true,
      responseSchema: schema,
      temperature: 0.2,
    });
    return JSON.parse(out);
  }

  async function analyzeMonth({ transactions, categories, fixedItems, monthLabel, customQuestion }) {
    const sys = `Você é um consultor financeiro pessoal direto e prático, em português do Brasil. Responda em markdown curto e útil, com seções, bullets e números. Identifique padrões, exageros, oportunidades de economia e compare o realizado com o orçamento fixo médio quando relevante.`;

    const summary = {
      monthLabel,
      categories: categories.map(c => ({ name: c.name, type: c.type })),
      fixedItems: fixedItems.map(f => ({ name: f.name, type: f.type, amount: f.amount, category: f.category })),
      transactions: transactions.map(t => ({
        type: t.type, amount: t.amount, category: t.category,
        description: t.description, date: t.date,
      })),
    };

    const question = customQuestion?.trim()
      ? customQuestion
      : `Faça uma análise do mês: total de entradas, saídas e saldo; principais categorias; comparativo com fixos; 3 a 5 recomendações específicas.`;

    const { text } = await call({
      parts: [{ text: `Dados (JSON):\n\`\`\`json\n${JSON.stringify(summary)}\n\`\`\`\n\nPergunta: ${question}` }],
      systemInstruction: sys,
      temperature: 0.5,
    });
    return text;
  }

  async function deepAnalysis({ transactions, categories, fixedItems }) {
    const sys = `Você é um consultor financeiro pessoal brasileiro especialista em redução de custos e construção de hábitos. Receberá TODAS as transações do usuário (vários meses, possivelmente) e o orçamento fixo médio. Sua tarefa:

1. **Visão geral** — média mensal de receitas, despesas e saldo; tendência ao longo dos meses se houver mais de um.
2. **Top 5 categorias com potencial de economia** — para cada uma: valor médio gasto/mês, quanto seria razoável reduzir (R$ e %), 2-3 ações concretas e práticas.
3. **Gastos recorrentes invisíveis** — assinaturas, mensalidades, débitos automáticos que somam mais do que parece.
4. **Anomalias** — gastos atípicos do(s) último(s) mês(es) que destoam do padrão.
5. **Plano de ação SMART** — 3 metas mensais específicas, mensuráveis e realistas pro próximo mês.

Use markdown com seções (\`##\`), bullets, valores em R$ (formato brasileiro). Seja direto, sem floreio. Tom amigável mas profissional.`;

    const data = {
      categories: categories.map(c => ({ name: c.name, type: c.type })),
      fixedItems: fixedItems.map(f => ({ name: f.name, type: f.type, amount: f.amount, category: f.category })),
      transactions: transactions.map(t => ({
        type: t.type, amount: t.amount, category: t.category, description: t.description, date: t.date,
      })),
    };

    const { text } = await call({
      parts: [{ text: `Dados completos:\n\`\`\`json\n${JSON.stringify(data)}\n\`\`\`\n\nFaça a análise completa conforme as instruções.` }],
      systemInstruction: sys,
      temperature: 0.45,
    });
    return text;
  }

  return {
    getKey, getModel, setKey, setModel,
    classifyText, classifyAudio,
    analyzeInvoice, analyzeFixedSheet, analyzeMonth, deepAnalysis,
  };
})();
