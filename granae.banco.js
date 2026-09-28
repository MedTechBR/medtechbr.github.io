/* ============================================================
   VISÃO GERAL (jeito de banco)
   Tudo o que existe agora, somando todas as contas: saldo em conta, o que
   entrou e saiu no mês, cartões, financiamentos, parcelas, investimentos e
   previdência. Não tem mês para escolher: é a foto de hoje.

   De onde vem cada número:
   - Contas e cartões: saldo/fatura/limite informados pelo banco (Open
     Finance). Conta cadastrada à mão usa o saldo calculado pelo Granaê.
   - Financiamentos: o que o banco informar (GET /loans) + parcelas mensais
     recorrentes achadas nos lançamentos ("Liquidação de parcela"…) + dívidas
     cadastradas em Parcelas. Saldo devedor que o banco não manda, você informa.
   - Previdência: aportes pela categoria Previdência; saldo do banco quando
     vier como investimento, ou informado por você.
   Os saldos informados ficam em state.profile (bancoSaldos), como o resto.
   Depende de granae.app.js (state, fmt, compromissos, saldoDaConta...) e
   granae.openfinance.js (GranaeOF.feed).
   ============================================================ */
(() => {
  const DIA = 86400000;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => escapeHTML(String(s == null ? '' : s));
  const brl = (v) => fmt.format(+v || 0);
  const soma = (a, f) => a.reduce((s, x) => s + (+f(x) || 0), 0);

  const feedOF = () => (window.GranaeOF && window.GranaeOF.feed && window.GranaeOF.feed()) || null;

  /* "Nu Pagamentos S.A. - Instituição de Pagamento (Conta Pré-paga)" → "Nubank" */
  function nomeBanco(s) {
    const t = String(s || '').trim();
    const mapa = [[/^nu pagamentos|^nubank/i, 'Nubank'], [/santander/i, 'Santander'], [/bradesco/i, 'Bradesco'],
      [/^caixa|caixa econ/i, 'Caixa'], [/sicredi/i, 'Sicredi'], [/ita[uú]/i, 'Itaú'], [/banco do brasil|^bb\b/i, 'Banco do Brasil'],
      [/inter\b/i, 'Inter'], [/c6/i, 'C6'], [/sicoob/i, 'Sicoob'], [/btg/i, 'BTG'], [/xp\b/i, 'XP']];
    for (const [re, n] of mapa) if (re.test(t)) return n;
    return t.replace(/\s*\(.*\)\s*$/, '') || 'Banco';
  }

  /* "SICREDI MASTERCARD BLACK" → "Sicredi Mastercard Black": só mexe no que veio
     todo em maiúsculas (é como o banco manda); siglas curtas ficam */
  function nomeBonito(s) {
    const t = String(s || '').trim();
    if (!t || t !== t.toUpperCase() || !/[A-Z]{4}/.test(t)) return t;
    const minus = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
    return t.toLowerCase().split(/(\s+)/).map((w, i) => {
      if (/^\s+$/.test(w)) return w;
      if (i && minus.has(w)) return w;
      if (/^(cdb|lci|lca|cri|cra|pgbl|vgbl|s\.a\.|sa|ltda|visa|bb|xp|btg|c6)$/i.test(w)) return w.toUpperCase().replace('VISA', 'Visa');
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join('').replace(/\bLiquidacao\b/, 'Liquidação');
  }

  /* bancos do MeuPluggy: o nome certo está na conexão ("Sicredi · MeuPluggy") */
  function bancoDoItem(itemId, reserva) {
    const f = feedOF();
    const it = f && (f.items || []).find(x => x.id === itemId);
    return nomeBanco(it && it.bank && !/^meu ?pluggy$/i.test(it.bank) ? it.bank : reserva);
  }

  function haQuanto(ms) {
    if (!ms) return '';
    const min = Math.round((Date.now() - ms) / 60000);
    if (min < 1) return 'agora';
    if (min < 60) return `há ${min} min`;
    const h = Math.round(min / 60);
    return h < 24 ? `há ${h} h` : new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  }

  function lerValor(s) {
    const t = String(s || '').replace(/[^\d,.-]/g, '');
    if (!t) return null;
    const n = t.includes(',') ? +t.replace(/\./g, '').replace(',', '.') : +t;
    return isFinite(n) ? Math.round(n * 100) / 100 : null;
  }

  const saldosInformados = () => (state.profile && state.profile.bancoSaldos) || {};
  function informar(chave, valor) {
    const atual = { ...saldosInformados() };
    if (valor == null) delete atual[chave]; else atual[chave] = { valor, em: todayISO() };
    state.profile = { ...(state.profile || {}), bancoSaldos: atual };
    saveState();
    render();
  }

  /* ---------- dados ---------- */
  function contas() {
    const f = feedOF();
    const doBanco = new Map(((f && f.accounts) || []).map(a => ['of_' + a.id, a]));
    return (state.accounts || []).map(acc => {
      const b = doBanco.get(acc.id);
      const cartao = acc.kind === 'cartao';
      return {
        id: acc.id, cartao, cor: acc.color,
        nome: acc.name, banco: nomeBanco(b ? b.name : (acc.ofBanco && !/pluggy/i.test(acc.ofBanco) ? acc.ofBanco : acc.name)),
        saldo: b ? +b.balance || 0 : (acc.of ? +acc.ofSaldo || 0 : (cartao ? 0 : saldoDaConta(acc))),
        limite: b && b.limit != null ? +b.limit : (acc.limite != null ? +acc.limite : null),
        disponivel: b && b.available != null ? +b.available : null,
        vence: (b && b.dueDay) || acc.vencimento || null,
        fecha: (b && b.closeDay) || acc.fechamento || null,
        doBanco: !!(b || acc.of),
      };
    });
  }

  function faturaAtual(c) {
    if (c.doBanco) return c.saldo;
    const acc = state.accounts.find(a => a.id === c.id);
    return acc ? soma(faturaDoCartao(acc, new Date()), t => t.amount) : 0;
  }

  function mesAtual() {
    const ref = new Date();
    const pref = ref.toISOString().slice(0, 7);
    const tx = state.transactions.filter(t => (t.date || '').startsWith(pref) && !t.transferId);
    const feitos = tx.filter(t => !t.pending);
    const recebido = soma(feitos.filter(t => t.type === 'income'), t => t.amount);
    const gasto = soma(feitos.filter(t => t.type === 'expense'), t => t.amount);
    const agendado = soma(tx.filter(t => t.pending && t.type === 'expense'), t => t.amount);
    return { ref, recebido, gasto, agendado };
  }

  const RE_FIN = /liquida[cç][aã]o de parcela|financiamento|empr[eé]stimo|cons[oó]rcio|presta[cç][aã]o|parcela (do )?(carro|im[oó]vel|casa)/i;
  /* Parcela mensal que se repete: mesma descrição (sem números), mesma conta,
     em pelo menos 2 meses dos últimos 4. É assim que aparece um financiamento
     que o banco não informa como contrato. */
  function financiamentosRecorrentes() {
    const limite = new Date(Date.now() - 125 * DIA).toISOString().slice(0, 10);
    const grupos = new Map();
    for (const t of state.transactions) {
      if (t.type !== 'expense' || t.transferId || t.pending || t.date < limite) continue;
      if (!(RE_FIN.test(t.description || '') || t.category === 'Dívidas')) continue;
      if (parcelaInfo(t)) continue; // compra parcelada no cartão aparece em Parcelas
      const base = (t.description || '').toLowerCase().replace(/[\d./-]+/g, ' ').replace(/\s+/g, ' ').trim();
      const k = base + '|' + (t.accountId || '');
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k).push(t);
    }
    const out = [];
    for (const [k, txs] of grupos) {
      const meses = new Set(txs.map(t => t.date.slice(0, 7)));
      if (meses.size < 2) continue;
      txs.sort((a, b) => b.date.localeCompare(a.date));
      const acc = state.accounts.find(a => a.id === txs[0].accountId);
      const bancoRec = acc ? nomeBanco(acc.name) : '';
      /* "LIQUIDACAO DE PARCELA" é como o Sicredi (e outros) descrevem no extrato
         a parcela de empréstimo: na tela vira "Empréstimo Sicredi" */
      const nomeRec = /liquida[cç][aã]o de parcela/i.test(txs[0].description || '') ? ('Empréstimo ' + bancoRec).trim() : nomeBonito(txs[0].description);
      out.push({ chave: 'rec:' + k, nome: nomeRec, banco: /^Empréstimo /.test(nomeRec) ? '' : bancoRec, parcela: +txs[0].amount, ultima: txs[0].date, vezes: txs.length });
    }
    return out;
  }

  function financiamentos() {
    const f = feedOF();
    const doBanco = ((f && f.loans) || []).map(l => ({
      chave: 'loan:' + l.id, nome: nomeBonito(l.name), banco: bancoDoItem(l.itemId, l.bank), fonte: 'banco',
      devedor: l.outstanding, parcela: l.installment || (l.outstanding && l.due ? l.outstanding / l.due : null),
      pagas: l.paid, total: l.total, atraso: l.pastDue, cet: l.cet, fim: l.end,
    }));
    const informados = saldosInformados();
    const recorrentes = financiamentosRecorrentes().map(r => ({
      ...r, fonte: 'lancamentos', devedor: informados[r.chave] ? informados[r.chave].valor : null, informadoEm: informados[r.chave] && informados[r.chave].em,
    }));
    const dividas = compromissos().filter(c => c.kind === 'divida' && !c.quitado).map(c => ({
      chave: 'div:' + c.id, nome: c.descricao, banco: c.credor || '', fonte: 'cadastro', devedor: c.aPagar, pagas: null, total: null, pago: c.pago, valorTotal: c.total,
    }));
    /* financiamento cadastrado em Parcelas (casa, apartamento...): o que falta é
       parcela × restantes, sem descontar juros futuros; saldo informado vence */
    const informados2 = saldosInformados();
    const cadastrados = compromissos().filter(c => c.kind === 'financiamento' && !c.quitado).map(c => {
      const inf = informados2['fin:' + c.id];
      return {
        chave: 'fin:' + c.id, nome: c.descricao, banco: c.credor || '', fonte: 'financiamento',
        devedor: inf ? inf.valor : c.aPagar, estimado: !inf, informadoEm: inf && inf.em,
        parcela: c.valorParcela, pagas: c.pagas, total: c.n, fim: c.ultima,
      };
    });
    return [...doBanco, ...cadastrados, ...recorrentes, ...dividas];
  }

  function parcelas() {
    const abertos = compromissos().filter(c => !c.quitado && c.kind !== 'divida' && c.kind !== 'financiamento' && c.type === 'expense');
    return {
      lista: abertos.sort((a, b) => b.aPagar - a.aPagar),
      porMes: soma(abertos, c => c.valorParcela),
      falta: soma(abertos, c => c.aPagar),
    };
  }

  function investimentos() {
    const f = feedOF();
    const inv = (f && f.investments) || [];
    return { lista: inv.filter(i => !i.previdencia), prev: inv.filter(i => i.previdencia) };
  }

  function previdencia() {
    const ano = String(new Date().getFullYear());
    const pref = new Date().toISOString().slice(0, 7);
    const aportes = state.transactions.filter(t => t.type === 'expense' && !t.transferId && !t.pending && /previd/i.test(t.category || ''));
    const doBanco = investimentos().prev;
    const inf = saldosInformados()['prev'];
    return {
      mes: soma(aportes.filter(t => t.date.startsWith(pref)), t => t.amount),
      ano: soma(aportes.filter(t => t.date.startsWith(ano)), t => t.amount),
      ultimo: aportes.sort((a, b) => b.date.localeCompare(a.date))[0] || null,
      doBanco,
      saldo: doBanco.length ? soma(doBanco, i => i.balance) : (inf ? inf.valor : null),
      informadoEm: !doBanco.length && inf ? inf.em : null,
    };
  }

  /* ---------- tela ---------- */
  const barra = (usado, total, cls = '') => total > 0
    ? `<div class="bk-barra ${cls}" role="img" aria-label="${Math.round(usado / total * 100)}%"><i style="width:${Math.min(100, Math.max(2, usado / total * 100)).toFixed(1)}%"></i></div>` : '';

  function formInformar(chave, rotulo, atual) {
    return `<form class="bk-informar" data-chave="${esc(chave)}" hidden>
        <label class="muted small" for="bk-in-${esc(chave)}">${esc(rotulo)}</label>
        <div class="row"><input id="bk-in-${esc(chave)}" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${atual != null ? esc(String(atual).replace('.', ',')) : ''}">
        <button type="submit" class="primary small">Salvar</button>
        ${atual != null ? '<button type="button" class="ghost small" data-bk-limpa>Apagar</button>' : ''}</div>
      </form>`;
  }

  function render() {
    const box = $('dashBanco');
    if (!box || box.hidden) return;
    const f = feedOF();
    const cs = contas();
    const correntes = cs.filter(c => !c.cartao);
    const cartoes = cs.filter(c => c.cartao && (c.limite || faturaAtual(c)));
    const saldoContas = soma(correntes, c => c.saldo);
    const faturas = soma(cartoes, c => faturaAtual(c));
    const fins = financiamentos();
    const devedor = soma(fins, x => x.devedor);
    const semSaldo = fins.filter(x => x.devedor == null).length;
    const inv = investimentos();
    const totInv = soma(inv.lista, i => i.balance);
    const prev = previdencia();
    const par = parcelas();
    const mes = mesAtual();
    const patrimonio = saldoContas + totInv + (prev.saldo || 0) - faturas - devedor;
    const nomeMes = mes.ref.toLocaleDateString('pt-BR', { month: 'long' });

    // contas agrupadas por banco
    const porBanco = new Map();
    correntes.forEach(c => { if (!porBanco.has(c.banco)) porBanco.set(c.banco, []); porBanco.get(c.banco).push(c); });
    const bancos = [...porBanco.entries()].map(([b, l]) => ({ b, l, s: soma(l, c => c.saldo) })).sort((x, y) => y.s - x.s);

    box.innerHTML = `
      <section class="bk-hero">
        <div class="bk-hero-top">
          <span class="bk-chip">Saldo em conta · ${correntes.length} conta${correntes.length === 1 ? '' : 's'}</span>
          ${f ? `<button type="button" class="bk-sync" id="bkSync" title="Sincronizar agora"><i class="ti ti-refresh" aria-hidden="true"></i> ${esc(haQuanto(f.syncedAt))}</button>` : ''}
        </div>
        <strong class="bk-total" id="bkTotal">${brl(saldoContas)}</strong>
        <div class="bk-bancos">${bancos.filter(x => x.s).map(x => `<span><b>${esc(x.b)}</b> ${brl(x.s)}</span>`).join('')}</div>
        <div class="bk-patrimonio">
          <span>Patrimônio financeiro</span><strong>${brl(patrimonio)}</strong>
          <small>contas${totInv ? ' + investimentos' : ''}${prev.saldo ? ' + previdência' : ''}${faturas ? ' − faturas' : ''}${devedor ? ' − financiamentos' : ''}${semSaldo ? ` · ${semSaldo} financiamento${semSaldo > 1 ? 's' : ''} sem saldo devedor` : ''} · não conta imóveis e bens</small>
        </div>
      </section>

      <div class="bk-mes">
        <div class="bk-tile in"><span class="bk-ic"><i class="ti ti-arrow-down-left" aria-hidden="true"></i></span><span>Entrou em ${esc(nomeMes)}</span><strong>${brl(mes.recebido)}</strong></div>
        <div class="bk-tile out"><span class="bk-ic"><i class="ti ti-arrow-up-right" aria-hidden="true"></i></span><span>Saiu em ${esc(nomeMes)}</span><strong>${brl(mes.gasto)}</strong></div>
        <div class="bk-tile ${mes.recebido - mes.gasto >= 0 ? 'ok' : 'neg'}"><span class="bk-ic"><i class="ti ti-scale" aria-hidden="true"></i></span><span>Resultado${mes.agendado ? ` · ${brl(mes.agendado)} agendado` : ''}</span><strong>${brl(mes.recebido - mes.gasto)}</strong></div>
      </div>

      <div class="bk-grade">
        <section class="bk-card">
          <header><span class="bk-ic azul"><i class="ti ti-building-bank" aria-hidden="true"></i></span><h3>Contas</h3><strong>${brl(saldoContas)}</strong></header>
          ${bancos.length ? bancos.map(x => `<div class="bk-linha${x.s ? '' : ' apagada'}"><span>${esc(x.b)}${x.l.length > 1 ? ` <small class="muted">${x.l.length} contas</small>` : ''}</span><strong>${brl(x.s)}</strong></div>`).join('')
            : '<p class="muted small">Nenhuma conta ainda. Conecte seu banco em Categorias → Open Finance ou cadastre uma conta.</p>'}
        </section>

        <section class="bk-card">
          <header><span class="bk-ic laranja"><i class="ti ti-credit-card" aria-hidden="true"></i></span><h3>Cartões</h3><strong>${brl(faturas)}</strong></header>
          ${cartoes.length ? cartoes.map(c => {
            const fat = faturaAtual(c);
            const usado = c.limite ? (c.disponivel != null ? c.limite - c.disponivel : fat) : 0;
            return `<div class="bk-cartao">
              <div class="bk-linha"><span>${esc(nomeBonito(c.nome.replace(/\s*••\d+$/, '')))} <small class="muted">${esc(c.banco)}${c.vence ? ' · vence dia ' + c.vence : ''}</small></span><strong>${brl(fat)}</strong></div>
              ${c.limite ? barra(usado, c.limite, usado / c.limite > .8 ? 'alerta' : '') + `<small class="muted">Limite ${brl(c.limite)}${c.disponivel != null ? ' · disponível ' + brl(c.disponivel) : ''}</small>` : ''}
            </div>`;
          }).join('') : '<p class="muted small">Nenhum cartão.</p>'}
          <p class="muted small bk-nota">Valor da fatura aberta, como o banco informa.</p>
        </section>

        <section class="bk-card">
          <header><span class="bk-ic violeta"><i class="ti ti-home-dollar" aria-hidden="true"></i></span><h3>Financiamentos</h3><strong>${devedor ? brl(devedor) : ''}</strong></header>
          ${fins.length ? fins.map(x => `<div class="bk-fin">
              <div class="bk-linha"><span>${esc(x.nome)} <small class="muted">${esc(x.banco)}</small></span><strong>${x.devedor != null ? brl(x.devedor) : '<span class="muted small">saldo ?</span>'}</strong></div>
              ${x.total ? barra(x.pagas || 0, x.total) + `<small class="muted">${x.pagas || 0} de ${x.total} parcelas pagas${x.atraso ? ` · <b class="bk-atraso">${x.atraso} em atraso</b>` : ''}${x.fim ? ' · termina ' + new Date(x.fim + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }) : ''}</small>` : ''}
              ${x.valorTotal ? barra(x.pago || 0, x.valorTotal) + `<small class="muted">${brl(x.pago)} pagos de ${brl(x.valorTotal)}</small>` : ''}
              ${x.fonte === 'financiamento' ? `<small class="muted">Parcela de ${brl(x.parcela)} por mês${x.estimado ? ' · saldo estimado pelas parcelas que faltam' : ' · saldo informado em ' + new Date(x.informadoEm + 'T00:00:00').toLocaleDateString('pt-BR')}</small>
                <button type="button" class="link small" data-bk-abre="${esc(x.chave)}">${x.estimado ? 'Informar saldo devedor do banco' : 'Atualizar saldo devedor'}</button>
                ${formInformar(x.chave, 'Saldo devedor hoje (veja no app do banco)', x.estimado ? null : x.devedor)}` : ''}
              ${x.fonte === 'lancamentos' ? `<small class="muted">Parcela de ${brl(x.parcela)} por mês · última em ${new Date(x.ultima + 'T00:00:00').toLocaleDateString('pt-BR')}${x.informadoEm ? ' · saldo informado em ' + new Date(x.informadoEm + 'T00:00:00').toLocaleDateString('pt-BR') : ''}</small>
                <button type="button" class="link small" data-bk-abre="${esc(x.chave)}">${x.devedor != null ? 'Atualizar saldo devedor' : 'Informar saldo devedor'}</button>
                ${formInformar(x.chave, 'Saldo devedor hoje (veja no app do banco)', x.devedor)}` : ''}
            </div>`).join('')
            : '<p class="muted small">Nenhum financiamento encontrado. Dívidas sem parcela fixa você cadastra em Parcelas.</p>'}
        </section>

        <section class="bk-card">
          <header><span class="bk-ic ambar"><i class="ti ti-calendar-repeat" aria-hidden="true"></i></span><h3>Parcelas</h3><strong>${brl(par.falta)}</strong></header>
          ${par.lista.length ? `<div class="bk-kpis"><div><small class="muted">Por mês</small><b>${brl(par.porMes)}</b></div><div><small class="muted">Falta pagar</small><b>${brl(par.falta)}</b></div></div>` +
            par.lista.slice(0, 6).map(c => `<div class="bk-linha"><span>${esc(c.descricao)} <small class="muted">${c.pagas}/${c.n}</small></span><strong>${brl(c.aPagar)}</strong></div>`).join('') +
            (par.lista.length > 6 ? `<button type="button" class="link small" data-nav="compromissos">Ver as ${par.lista.length} <i class="ti ti-chevron-right" aria-hidden="true"></i></button>` : '')
            : '<p class="muted small">Nenhuma compra parcelada em aberto.</p>'}
        </section>

        <section class="bk-card">
          <header><span class="bk-ic verde"><i class="ti ti-chart-line" aria-hidden="true"></i></span><h3>Investimentos</h3><strong>${brl(totInv)}</strong></header>
          ${inv.lista.length ? inv.lista.map(i => `<div class="bk-linha"><span>${esc(nomeBonito(i.name))} <small class="muted">${esc(bancoDoItem(i.itemId, i.bank))}${i.due ? ' · vence ' + new Date(i.due + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }) : ''}</small></span><strong>${brl(i.balance)}</strong></div>`).join('')
            : '<p class="muted small">Nenhum investimento informado pelos bancos conectados.</p>'}
          ${inv.lista.length ? '<p class="muted small bk-nota">Saldo líquido, já descontado o imposto.</p>' : ''}
        </section>

        <section class="bk-card">
          <header><span class="bk-ic ciano"><i class="ti ti-umbrella" aria-hidden="true"></i></span><h3>Previdência</h3><strong>${prev.saldo != null ? brl(prev.saldo) : ''}</strong></header>
          <div class="bk-kpis"><div><small class="muted">Aporte em ${esc(nomeMes)}</small><b>${brl(prev.mes)}</b></div><div><small class="muted">Aportes em ${new Date().getFullYear()}</small><b>${brl(prev.ano)}</b></div></div>
          ${prev.doBanco.map(i => `<div class="bk-linha"><span>${esc(nomeBonito(i.name))} <small class="muted">${esc(bancoDoItem(i.itemId, i.bank))}</small></span><strong>${brl(i.balance)}</strong></div>`).join('')}
          ${prev.ultimo ? `<small class="muted">Último aporte: ${brl(prev.ultimo.amount)} em ${new Date(prev.ultimo.date + 'T00:00:00').toLocaleDateString('pt-BR')}</small>` : '<small class="muted">Os aportes aparecem aqui quando o lançamento está na categoria Previdência.</small>'}
          ${!prev.doBanco.length ? `<button type="button" class="link small" data-bk-abre="prev">${prev.saldo != null ? `Saldo informado em ${new Date(prev.informadoEm + 'T00:00:00').toLocaleDateString('pt-BR')} · atualizar` : 'Informar saldo acumulado'}</button>
            ${formInformar('prev', 'Saldo acumulado (veja no extrato da previdência)', prev.saldo)}` : ''}
        </section>
      </div>`;

    $('bkSync')?.addEventListener('click', () => document.getElementById('ofBar')?.click());
    box.querySelectorAll('[data-nav]').forEach(b => b.addEventListener('click', () => navigate(b.dataset.nav)));
    box.querySelectorAll('[data-bk-abre]').forEach(b => b.addEventListener('click', () => {
      const form = box.querySelector(`.bk-informar[data-chave="${CSS.escape(b.dataset.bkAbre)}"]`);
      if (!form) return;
      form.hidden = !form.hidden;
      if (!form.hidden) form.querySelector('input').focus();
    }));
    box.querySelectorAll('.bk-informar').forEach(form => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const v = lerValor(form.querySelector('input').value);
        if (v == null || v < 0) { toast('Digite um valor, por exemplo 12.345,67'); return; }
        informar(form.dataset.chave, v);
        toast('Saldo salvo');
      });
      form.querySelector('[data-bk-limpa]')?.addEventListener('click', () => { informar(form.dataset.chave, null); toast('Saldo apagado'); });
    });
    if (typeof contaMoeda === 'function') contaMoeda($('bkTotal'), saldoContas);
  }

  window.renderBanco = render;
  document.addEventListener('granae:of', render);
})();
