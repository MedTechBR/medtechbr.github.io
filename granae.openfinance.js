/* ============================================================
   OPEN FINANCE (Pluggy / MeuPluggy)
   Os lançamentos do banco entram sozinhos. Quem fala com o Pluggy é a
   Cloud Function "openfinance" (código em _openfinance/): a chave do Pluggy
   nunca passa pelo navegador. A função grava um resumo em
   users/{uid}/apps/granae_of; aqui escutamos esse documento ao vivo e
   importamos para o estado do Granaê.

   Regras da importação:
   - id do lançamento = "of_" + id do Pluggy. Importar de novo não duplica,
     e dois aparelhos importando ao mesmo tempo chegam no mesmo resultado.
   - Excluiu no Granaê? Fica excluído: o tombstone é respeitado. O resumo só
     traz 45 dias, menos que os 60 dias que o tombstone dura, então um
     lançamento excluído não volta depois que o tombstone expira.
   - Já tinha digitado o gasto à mão? Mesmo valor, mesmo tipo, até 3 dias de
     diferença: o manual é vinculado (ofId) em vez de duplicar.
   - Categoria: regras do usuário primeiro; senão a categoria do banco
     traduzida para as do Granaê. Editar depois não é sobrescrito.
   - Pagamento de fatura e transferência entre contas próprias entram como
     transferência (fora dos totais), porque o gasto já veio pelo cartão.
   Depende de granae.app.js (state, saveState, refreshAll, aplicarRegras...).
   ============================================================ */
(() => {
  const FN = 'https://southamerica-east1-medtech-c658c.cloudfunctions.net/';
  const CONNECT_JS = 'https://cdn.pluggy.ai/pluggy-connect/latest/pluggy-connect.js';
  /* Só o MeuPluggy (id 200) é gratuito: conector direto de banco exige plano pago
     do Pluggy e recusa com "contas de teste só podem conectar sandbox". Abrir já
     nele evita escolher o banco errado. Com plano pago, basta esvaziar a lista. */
  const CONECTORES = [200];
  const CORES = ['#820AD1', '#EC7000', '#CC092F', '#0070AF', '#00A868', '#FFB400', '#1F4E9C', '#00B1EA'];
  const DIA = 86400000;

  let feed = null;         // último resumo vindo da função
  let dadosProntos = false; // só importa depois que o estado do Granaê chegou da nuvem
  let unsub = null, uidFeed = null, ocupado = false;

  const $ = (id) => document.getElementById(id);

  /* ---------- chamada à função (protocolo callable, sem o SDK) ---------- */
  async function chamar(action, dados) {
    const u = window.MT && window.MT.user;
    if (!u || u.demo || !u.getIdToken) throw new Error('Entre na sua conta MedTech para usar o Open Finance.');
    const tk = await u.getIdToken();
    const r = await fetch(FN + 'openfinance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tk },
      body: JSON.stringify({ data: { action, ...(dados || {}) } }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) {
      if (r.status === 404) throw new Error('A função do Open Finance ainda não foi publicada (veja _openfinance/LEIAME.md).');
      throw new Error((j.error && j.error.message) || ('erro ' + r.status));
    }
    return j.result;
  }

  /* ---------- categoria do banco → categoria do Granaê ---------- */
  const MAPA_GASTO = [
    [/groceries|supermarket|supermercado|mercado/i, 'Mercado'],
    [/food|eating|restaurant|delivery|bakery|bar\b|coffee|alimenta/i, 'Alimentação'],
    [/transport|taxi|ride|gas station|fuel|parking|toll|vehicle|automotive|combust|estacion/i, 'Transporte'],
    [/health|pharmac|hospital|clinic|dentist|doctor|medic|wellness|gym|fitness|sa[uú]de|farm[aá]cia/i, 'Saúde'],
    [/educat|school|university|course|book|educa/i, 'Educação'],
    [/streaming|digital service|subscription|software|assinatura/i, 'Assinaturas'],
    [/leisure|entertainment|game|travel|ticket|event|cinema|hotel|airline|accommodation|lazer|viage/i, 'Lazer'],
    [/bill|utilit|electric|water|internet|telecom|mobile|phone|rent|housing|tax|insurance|fee|interest|contas|aluguel|imposto/i, 'Contas'],
    [/pix|transfer/i, 'Pix'],
  ];
  const MAPA_GANHO = [
    [/salary|payroll|sal[aá]rio|retirement|aposentad/i, 'Salário'],
    [/investment|dividend|yield|interest|rendiment|juros/i, 'Investimentos'],
    [/entrepreneur|freelanc|self.?employ|aut[oô]nom/i, 'Freelance'],
  ];
  function categoriaDoBanco(cat, tipo) {
    const mapa = tipo === 'income' ? MAPA_GANHO : MAPA_GASTO;
    const padrao = tipo === 'income' ? 'Outras receitas' : 'Outros';
    for (const [re, nome] of mapa) {
      if (re.test(cat || '') && categoryByName(nome, tipo)) return nome;
    }
    return categoryByName(padrao, tipo) ? padrao
      : ((state.categories.find(c => c.type === tipo) || {}).name || padrao);
  }

  const r2 = (v) => Math.round(v * 100) / 100;
  const dias = (a, b) => Math.abs(new Date(a + 'T00:00:00') - new Date(b + 'T00:00:00')) / DIA;
  const descricao = (t) => t.desc + (t.inst ? ` (${t.inst[0]}/${t.inst[1]})` : '');
  const parcela = (s) => { const m = String(s || '').match(/(\d+)\s*\/\s*(\d+)/); return m ? m[1] + '/' + m[2] : ''; };

  /* O lançamento do banco é o mesmo que foi digitado à mão? O cartão lança na
     data da fatura, dias depois da compra, e à mão o valor costuma sair
     arredondado. Valor exato: o banco pode vir de 3 dias antes a 10 depois.
     Valor até 1% (no máximo R$ 1) diferente: só no mesmo dia (±1). Parcela
     "x/y" diferente dos dois lados não é o mesmo lançamento. */
  function mesmoLancamento(x, t) {
    const dv = Math.abs((+x.amount || 0) - t.amount);
    const dt = (new Date(t.date + 'T00:00:00') - new Date(x.date + 'T00:00:00')) / DIA;
    const ok = (dv < 0.005 && dt >= -3 && dt <= 10) || (dv <= Math.min(1, t.amount * 0.01) && Math.abs(dt) <= 1);
    if (!ok) return false;
    const px = parcela(x.description), pt = t.inst ? t.inst.join('/') : parcela(t.desc);
    return !(px && pt && px !== pt);
  }

  /* ---------- importação: resumo do banco → state ---------- */
  function importar() {
    if (!feed || !dadosProntos || typeof state === 'undefined') return;
    const agora = Date.now();
    const hoje = todayISO();
    const desde = (state.profile && state.profile.ofDesde) || '0000-00-00';
    const mortos = new Set((state.tombstones || []).map(t => t.id));
    const contasMortas = new Set((state.accountTombstones || []).map(t => t.id));
    state.accounts = state.accounts || [];
    let mudou = false, novos = 0, vinculados = 0;

    // Contas e cartões
    const contaOk = new Set();
    feed.accounts.forEach((a, i) => {
      const id = 'of_' + a.id;
      if (contasMortas.has(id)) return;
      contaOk.add(a.id);
      let c = state.accounts.find(x => x.id === id);
      if (!c) {
        c = { id, kind: a.kind, name: a.name + (a.number ? ' ••' + a.number : ''), color: CORES[i % CORES.length], saldoInicial: 0, of: true };
        state.accounts.push(c);
        mudou = true;
      }
      const alvo = { ofBanco: a.bank || '', ofSaldo: a.balance };
      if (a.kind === 'cartao') {
        if (a.limit != null && !c.limite) alvo.limite = a.limit;
        if (a.closeDay && !c.fechamento) alvo.fechamento = a.closeDay;
        if (a.dueDay && !c.vencimento) alvo.vencimento = a.dueDay;
      }
      for (const k in alvo) if (c[k] !== alvo[k]) { c[k] = alvo[k]; c.updatedAt = agora; mudou = true; }
    });

    // Lançamentos
    const porId = new Map();
    state.transactions.forEach(t => { porId.set(t.id, t); if (t.ofId) porId.set(t.ofId, t); });
    const noResumo = new Set();
    // Pix e transferência entre as contas do próprio titular (CPF/CNPJ/nome em
    // profile.ofProprios, dado privado do usuário): fora dos totais
    const proprios = ((state.profile && state.profile.ofProprios) || []).map(p => String(p).toLowerCase()).filter(Boolean);
    for (const t0 of feed.transactions) {
      const t = (!t0.transfer && proprios.some(p => String(t0.desc || '').toLowerCase().includes(p))) ? { ...t0, transfer: true } : t0;
      const id = 'of_' + t.id;
      noResumo.add(id);
      if (mortos.has(id) || t.date < desde) continue;
      const pend = t.date > hoje;
      const ex = porId.get(id);
      if (ex) {
        // o banco confirmou/ajustou: atualiza valor e data, nunca a categoria
        const mud = {};
        if (Math.abs((+ex.amount || 0) - t.amount) > 0.004) mud.amount = t.amount;
        if (ex.of && ex.date !== t.date) mud.date = t.date;
        if (ex.of && !!ex.ofPend !== !!t.pending) mud.ofPend = !!t.pending;
        if (ex.of && !!ex.pending !== pend) mud.pending = pend;
        if (Object.keys(mud).length) { Object.assign(ex, mud); ex.updatedAt = agora; mudou = true; }
        continue;
      }
      const conta = contaOk.has(t.accountId) ? 'of_' + t.accountId : null;
      // já digitado à mão?
      const manual = !t.transfer && state.transactions.filter(x =>
        !x.of && !x.ofId && !x.transferId && !x.pending && x.type === t.type &&
        (!x.accountId || !conta || x.accountId === conta) && mesmoLancamento(x, t))
        .sort((a, b) => (Math.abs((+a.amount || 0) - t.amount) - Math.abs((+b.amount || 0) - t.amount)) || (dias(a.date, t.date) - dias(b.date, t.date)))[0];
      if (manual) {
        manual.ofId = id;
        if (!manual.accountId && conta) manual.accountId = conta;
        manual.updatedAt = agora;
        porId.set(id, manual);
        vinculados++; mudou = true;
        continue;
      }
      const obj = { id, type: t.type, amount: t.amount, description: descricao(t), date: t.date, accountId: conta, sub: null, of: true, updatedAt: agora };
      if (t.pending) obj.ofPend = true;
      if (pend) obj.pending = true;
      if (t.transfer) {
        obj.category = 'Transferência';
        obj.transferId = id;
      } else {
        obj.category = categoriaDoBanco(t.cat, t.type);
        aplicarRegras(obj);
        if (conta && obj.accountId !== conta) obj.accountId = conta; // a conta de verdade vence a regra
      }
      state.transactions.push(obj);
      porId.set(id, obj);
      novos++; mudou = true;
    }

    // Pendente que sumiu do banco foi substituído pelo lançamento definitivo
    const inicio = new Map(feed.accounts.map(a => ['of_' + a.id, a.from]));
    const sumiram = state.transactions.filter(t => t.of && t.ofPend && !noResumo.has(t.id)
      && inicio.has(t.accountId) && t.date >= inicio.get(t.accountId));
    if (sumiram.length) {
      const fora = new Set(sumiram.map(t => t.id));
      state.transactions = state.transactions.filter(t => !fora.has(t.id));
      sumiram.forEach(t => tombstone('tombstones', t.id));
      mudou = true;
    }

    // Saldo: o saldo inicial é ajustado para o saldo da conta bater com o do banco
    for (const a of feed.accounts) {
      if (a.kind !== 'conta') continue;
      const c = state.accounts.find(x => x.id === 'of_' + a.id);
      if (!c) continue;
      const soma = state.transactions.reduce((s, t) =>
        (t.accountId === c.id && !t.pending && (t.of || t.ofId)) ? s + (t.type === 'income' ? +t.amount : -t.amount) : s, 0);
      const ini = r2(a.balance - soma);
      if (Math.abs((+c.saldoInicial || 0) - ini) > 0.004) { c.saldoInicial = ini; c.updatedAt = agora; mudou = true; }
    }

    if (mudou) {
      saveState();
      refreshAll();
      const partes = [];
      if (novos) partes.push(`${novos} lançamento${novos > 1 ? 's' : ''} do banco`);
      if (vinculados) partes.push(`${vinculados} conciliado${vinculados > 1 ? 's' : ''}`);
      if (partes.length) toast(partes.join(' · '));
    }
    render();
  }

  /* ---------- escuta ao vivo do resumo ---------- */
  function ligarFeed() {
    const MT = window.MT;
    const u = MT && MT.user;
    const uid = u && !u.demo ? u.uid : null;
    if (uid === uidFeed) return;
    if (unsub) { unsub(); unsub = null; }
    uidFeed = uid; feed = null;
    render();
    if (!uid || !MT._fb) return;
    const { db, F } = MT._fb;
    unsub = F.onSnapshot(F.doc(db, 'users', uid, 'apps', 'granae_of'), (snap) => {
      try { feed = snap.exists() ? JSON.parse(snap.data().json || 'null') : null; }
      catch { feed = null; }
      importar();
      render();
    }, (err) => { console.warn('Open Finance: sem acesso ao resumo', err && err.message); });
  }

  (function esperarMT() {
    if (!(window.MT && window.MT.onData)) { setTimeout(esperarMT, 60); return; }
    window.MT.onData(() => {
      // roda depois do applyData do granae.app.js (registrado antes)
      setTimeout(() => { dadosProntos = true; ligarFeed(); importar(); }, 0);
    });
  })();

  /* ---------- ações ---------- */
  function carregarWidget() {
    if (window.PluggyConnect) return Promise.resolve();
    return new Promise((ok, falha) => {
      const s = document.createElement('script');
      s.src = CONNECT_JS; s.onload = ok;
      s.onerror = () => falha(new Error('Não consegui carregar o Pluggy Connect.'));
      document.head.appendChild(s);
    });
  }

  async function conectar(itemId) {
    if (ocupado) return;
    ocupado = true; render('Abrindo conexão segura…');
    try {
      if (!itemId && !(state.profile && state.profile.ofDesde)) {
        const tudo = confirm('Importar também os últimos 90 dias?\n\nOK: traz o histórico (o que você já lançou à mão é reconhecido e não duplica).\nCancelar: só daqui para frente.');
        state.profile = { ...(state.profile || {}), ofDesde: tudo ? '0000-00-00' : todayISO() };
        saveState();
      }
      const [{ accessToken }] = await Promise.all([chamar('connectToken', { itemId }), carregarWidget()]);
      const pc = new window.PluggyConnect({
        connectToken: accessToken,
        updateItem: itemId || undefined,
        ...(!itemId && CONECTORES.length ? { connectorIds: CONECTORES, selectedConnectorId: CONECTORES[0] } : {}),
        onSuccess: async (d) => {
          const id = (d && d.item && d.item.id) || (d && d.id);
          if (!id) return;
          ocupado = true; render('Buscando contas e lançamentos…');
          try { await chamar('addItem', { itemId: id }); toast('Banco conectado'); }
          catch (e) { toast(e.message, 5000); }
          finally { ocupado = false; render(); }
        },
        onError: (e) => { console.warn('Pluggy Connect', e); },
      });
      pc.init();
    } catch (e) {
      toast(e.message, 5000);
    } finally {
      ocupado = false; render();
    }
  }

  async function sincronizarAgora() {
    if (ocupado) return;
    ocupado = true; render('Sincronizando…');
    try {
      const r = await chamar('sync', { refresh: true });
      toast(r && r.lancamentos != null ? `Sincronizado · ${r.contas} conta(s)` : 'Sincronizado');
    } catch (e) { toast(e.message, 5000); }
    finally { ocupado = false; render(); }
  }

  async function remover(itemId, banco) {
    if (!confirm(`Desconectar ${banco}?\n\nOs lançamentos já importados continuam no Granaê.`)) return;
    ocupado = true; render('Desconectando…');
    try { await chamar('removeItem', { itemId }); toast('Desconectado'); }
    catch (e) { toast(e.message, 5000); }
    finally { ocupado = false; render(); }
  }

  /* ---------- interface ---------- */
  function haQuanto(ms) {
    if (!ms) return '';
    const min = Math.round((Date.now() - ms) / 60000);
    if (min < 1) return 'agora';
    if (min < 60) return `há ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `há ${h} h`;
    return new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  }
  const ESTADO = { UPDATED: 'ok', UPDATING: 'atualizando', LOGIN_ERROR: 'reconectar', OUTDATED: 'desatualizado', WAITING_USER_INPUT: 'aguardando você', WAITING_USER_ACTION: 'aguardando você', ERROR: 'erro' };

  function render(msg) {
    const bar = $('ofBar'), box = $('ofBox');
    const logado = !!(window.MT && window.MT.user && !window.MT.user.demo);
    const itens = (feed && feed.items) || [];

    if (bar) {
      bar.hidden = !itens.length;
      if (itens.length) {
        const erro = itens.some(i => i.error || /ERROR|OUTDATED/.test(i.status));
        const ult = Math.max(0, ...itens.map(i => i.lastUpdatedAt ? Date.parse(i.lastUpdatedAt) : 0));
        bar.classList.toggle('erro', erro);
        bar.innerHTML = `<span class="of-dot" aria-hidden="true"></span>
          <span>${msg ? escapeHTML(msg) : (erro ? 'Open Finance: uma conexão precisa de atenção'
            : `Banco ao vivo · atualizado ${haQuanto(ult || feed.syncedAt)}`)}</span>
          <i class="ti ti-refresh" aria-hidden="true"></i>`;
      }
    }
    if (!box) return;
    if (!logado) {
      box.innerHTML = '<p class="muted small">Entre na sua conta MedTech para conectar seus bancos.</p>';
      return;
    }
    const contas = (feed && feed.accounts) || [];
    box.innerHTML = `
      ${msg ? `<p class="of-msg small"><i class="ti ti-loader-2 of-gira" aria-hidden="true"></i> ${escapeHTML(msg)}</p>` : ''}
      ${itens.length ? `<ul class="cat-list of-lista">${itens.map(i => {
        const cs = contas.filter(a => a.itemId === i.id);
        const st = ESTADO[i.status] || (i.status || '').toLowerCase();
        return `<li class="of-item">
          <div class="of-item-top">
            <strong>${escapeHTML(i.bank)}</strong>
            <span class="of-st ${st === 'ok' ? 'ok' : 'alerta'}">${escapeHTML(st || '—')}</span>
            <button type="button" class="ghost small" data-of-rec="${escapeHTML(i.id)}" title="Reautorizar">Reconectar</button>
            <button type="button" class="ghost small" data-of-del="${escapeHTML(i.id)}" data-of-nome="${escapeHTML(i.bank)}" aria-label="Desconectar"><i class="ti ti-unlink" aria-hidden="true"></i></button>
          </div>
          ${i.error ? `<p class="small of-erro">${escapeHTML(i.error)}</p>` : ''}
          ${cs.map(a => `<div class="of-conta small"><span>${escapeHTML(a.name)}${a.number ? ' ••' + escapeHTML(a.number) : ''}</span>
            <span>${a.kind === 'cartao' ? 'fatura ' : ''}<strong>${fmt.format(a.balance)}</strong></span></div>`).join('')}
          <p class="muted small" style="margin:4px 0 0">Atualizado ${haQuanto(i.lastUpdatedAt ? Date.parse(i.lastUpdatedAt) : 0) || '—'}</p>
        </li>`;
      }).join('')}</ul>` : '<p class="muted small" style="margin:2px 0 8px">Conecte suas contas pelo Open Finance e os gastos e ganhos entram sozinhos, sem digitar.</p>'}
      <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:8px">
        <button type="button" class="primary" id="ofConectar"${ocupado ? ' disabled' : ''}><i class="ti ti-building-bank" aria-hidden="true"></i> Conectar banco</button>
        ${itens.length ? `<button type="button" class="ghost" id="ofSync"${ocupado ? ' disabled' : ''}><i class="ti ti-refresh" aria-hidden="true"></i> Sincronizar agora</button>` : ''}
      </div>
      ${feed && feed.syncedAt ? `<p class="muted small" style="margin:6px 0 0">Última leitura: ${haQuanto(feed.syncedAt)}</p>` : ''}`;
    $('ofConectar')?.addEventListener('click', () => conectar());
    $('ofSync')?.addEventListener('click', sincronizarAgora);
    box.querySelectorAll('[data-of-rec]').forEach(b => b.addEventListener('click', () => conectar(b.dataset.ofRec)));
    box.querySelectorAll('[data-of-del]').forEach(b => b.addEventListener('click', () => remover(b.dataset.ofDel, b.dataset.ofNome)));
  }

  $('ofBar')?.addEventListener('click', () => { if (!ocupado) sincronizarAgora(); });
  setInterval(() => { if (!ocupado) render(); }, 60000);
  render();

  // para testes
  window.GranaeOF = { importar, categoriaDoBanco, _setFeed: (f) => { feed = f; dadosProntos = true; importar(); } };
})();
