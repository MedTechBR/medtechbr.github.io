/* MedTech PWA: os dados de Plantões e Finanças (CofreMes.swift).
   Como no iPhone, o PWA nunca fala direto com o Firestore: abre plantaohub.html e granae.html em quadros ocultos
   (mesmo domínio, mesma sessão de login) e lê e grava pelos próprios apps. Cada gravação é a cópia fiel do que o
   formulário da página faz ao salvar (JSMes no iPhone), rodando dentro da página, com as funções dela
   (persist, saveState, stampTx, tombstone, MT.markDeleted, MT.save com merge). Formato e lugar de gravação são os dela:
   users/{uid}/apps/plantaohub e users/{uid}/apps/granae.
   ?demo=1: as mesmas páginas, no modo demonstração nativo do _mtauth.js (dados fictícios só neste navegador,
   sem nuvem). Para isso o quadro recebe o HTML da página com a configuração do Firebase vazia; o resto é o app como está. */
(function () {
  'use strict';
  var W = window, D = document;
  var DEMO = /[?&]demo=1(&|$)/.test(location.search);
  var BASE = new URL('../', location.href).href;

  var ERROS = {
    semRede: 'Sem conexão com a nuvem. Nada foi gravado.',
    naoPronto: 'Seus dados ainda estão carregando. Nada foi gravado.',
    naoConfirmou: 'A gravação não foi confirmada. Confira a internet e veja se o item aparece.',
    naoAchou: 'Esse item não existe mais. Ele pode ter sido apagado em outro aparelho.'
  };

  /* ---------- capa: instalada dentro da página quando ela fica pronta (capaJS do iPhone) ----------
     MT.save continua sendo o da página; a capa só guarda a promessa da gravação e, sem rede, não deixa sair
     a gravação sem merge (MT.save cai em setDoc quando a transação falha, o que sobrescreveria a nuvem ao voltar a conexão). */
  var CAPA = '(function(){if(window.__cofre)return;' +
    'var c=window.__cofre={ultimo:Promise.resolve(),offline:false,saves:0,reais:0};' +
    'var v=window.MT,s=v.save;' +
    'function g(d){c.saves++;if(c.offline||navigator.onLine===false){try{v.localSet(d);v._emit(d)}catch(e){}return Promise.resolve()}c.reais++;var p=s.call(v,d);c.ultimo=p;return p}' +
    'Object.defineProperty(v,"save",{configurable:true,enumerable:true,get:function(){return s?g:undefined},set:function(f){s=f}});' +
    'function espera(ms,msg){return new Promise(function(_,j){setTimeout(function(){j(new Error(msg))},ms)})}' +
    'c.agir=async function(fn){' +
    'var M=window.MT;if(!M||!M.user||M._data===undefined||typeof M.mergeFn!=="function")throw new Error("nao-pronto");' +
    'if(c.offline||navigator.onLine===false)throw new Error("sem-rede");' +
    'if(M.mode!=="demo"){try{var b=M._fb;await Promise.race([b.F.getDocFromServer(b.F.doc(b.db,"users",M.user.uid,"apps",window.MT_APP.id)),espera(8000,"t")])}catch(e){throw new Error("sem-rede")}}' +
    'c.ultimo=Promise.resolve();' +
    'var r=fn();' +
    'await Promise.race([c.ultimo,espera(20000,"nao-confirmou")]);' +
    'return r===undefined?"":JSON.stringify(r)};' +
    'c.ouvir=function(cb){if(c.ouvindo)return;c.ouvindo=true;var t;function envia(){clearTimeout(t);t=setTimeout(function(){try{if(MT.user)cb(c.exportar())}catch(e){console.error(e)}},100)}MT.onData(envia);envia()};' +
    '})();';

  var EXPORTA_PLANTAO = 'window.__cofre.exportar=function(){return JSON.stringify({uid:(MT.user&&MT.user.uid)||"",shifts:(state.shifts||[]).map(function(s){return Object.assign({},s,{id:String(s.id)})}),locais:state.locais||{},compDay:state.compDay,pgDia:state.pgDia,pgMes:state.pgMes})};';
  /* Exportação do Granaê: roda DENTRO da página (w.eval do texto desta função), então state, compromissos(), faturaDoCartao(),
     faturaPaga(), saldoDaConta(), projecaoSaldo(), comprometimentoPorMes(), paraRevisar() e GranaeOF.feed() são os do próprio app.
     A "visão geral" (contas, financiamentos, investimentos, previdência e patrimônio) é cópia fiel das funções de granae.banco.js,
     que ficam fechadas no módulo dele e não podem ser chamadas de fora. Só leitura: nada aqui grava. */
  function exportaGranae() {
    var ids = function (l) { return (l || []).map(function (x) { return Object.assign({}, x, { id: String(x.id) }); }); };
    var p2 = function (n) { return String(n).padStart(2, '0'); };
    var chaveMes = function (d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1); };
    var feedOF = function () { return (window.GranaeOF && window.GranaeOF.feed && window.GranaeOF.feed()) || null; };
    var f = feedOF();
    /* ---- granae.banco.js (cópia fiel de nomeBanco, nomeBonito, bancoDoItem, contas, faturaAtual,
       financiamentosRecorrentes, financiamentos, parcelas, investimentos, previdencia e das somas de render) ---- */
    var DIA = 86400000;
    var soma = function (a, fn) { return a.reduce(function (s, x) { return s + (+fn(x) || 0); }, 0); };
    function nomeBanco(s) {
      var t = String(s || '').trim();
      var mapa = [[/^nu pagamentos|^nubank/i, 'Nubank'], [/santander/i, 'Santander'], [/bradesco/i, 'Bradesco'],
        [/^caixa|caixa econ/i, 'Caixa'], [/sicredi/i, 'Sicredi'], [/ita[uú]/i, 'Itaú'], [/banco do brasil|^bb\b/i, 'Banco do Brasil'],
        [/inter\b/i, 'Inter'], [/c6/i, 'C6'], [/sicoob/i, 'Sicoob'], [/btg/i, 'BTG'], [/xp\b/i, 'XP']];
      for (var i = 0; i < mapa.length; i++) if (mapa[i][0].test(t)) return mapa[i][1];
      return t.replace(/\s*\(.*\)\s*$/, '') || 'Banco';
    }
    function nomeBonito(s) {
      var t = String(s || '').trim();
      if (!t || t !== t.toUpperCase() || !/[A-Z]{4}/.test(t)) return t;
      var minus = { de: 1, da: 1, do: 1, das: 1, dos: 1, e: 1 };
      return t.toLowerCase().split(/(\s+)/).map(function (w, i) {
        if (/^\s+$/.test(w)) return w;
        if (i && minus[w]) return w;
        if (/^(cdb|lci|lca|cri|cra|pgbl|vgbl|s\.a\.|sa|ltda|visa|bb|xp|btg|c6)$/i.test(w)) return w.toUpperCase().replace('VISA', 'Visa');
        return w.charAt(0).toUpperCase() + w.slice(1);
      }).join('').replace(/\bLiquidacao\b/, 'Liquidação');
    }
    function bancoDoItem(itemId, reserva) {
      var it = f && (f.items || []).filter(function (x) { return x.id === itemId; })[0];
      return nomeBanco(it && it.bank && !/^meu ?pluggy$/i.test(it.bank) ? it.bank : reserva);
    }
    var saldosInformados = function () { return (state.profile && state.profile.bancoSaldos) || {}; };
    function contas() {
      var doBanco = new Map(((f && f.accounts) || []).map(function (a) { return ['of_' + a.id, a]; }));
      return (state.accounts || []).map(function (acc) {
        var b = doBanco.get(acc.id);
        var cartao = acc.kind === 'cartao';
        return {
          id: acc.id, cartao: cartao, cor: acc.color,
          nome: acc.name, banco: nomeBanco(b ? b.name : (acc.ofBanco && !/pluggy/i.test(acc.ofBanco) ? acc.ofBanco : acc.name)),
          saldo: b ? +b.balance || 0 : (acc.of ? +acc.ofSaldo || 0 : (cartao ? 0 : saldoDaConta(acc))),
          limite: b && b.limit != null ? +b.limit : (acc.limite != null ? +acc.limite : null),
          disponivel: b && b.available != null ? +b.available : null,
          vence: (b && b.dueDay) || acc.vencimento || null,
          fecha: (b && b.closeDay) || acc.fechamento || null,
          doBanco: !!(b || acc.of),
          itemId: b ? b.itemId : null
        };
      });
    }
    function faturaAtual(c) {
      if (c.doBanco) return c.saldo;
      var acc = state.accounts.filter(function (a) { return a.id === c.id; })[0];
      return acc ? soma(faturaDoCartao(acc, new Date()), function (t) { return t.amount; }) : 0;
    }
    var RE_FIN = /liquida[cç][aã]o de parcela|financiamento|empr[eé]stimo|cons[oó]rcio|presta[cç][aã]o|parcela (do )?(carro|im[oó]vel|casa)/i;
    function financiamentosRecorrentes() {
      var limite = new Date(Date.now() - 125 * DIA).toISOString().slice(0, 10);
      var grupos = new Map();
      state.transactions.forEach(function (t) {
        if (t.type !== 'expense' || t.transferId || t.pending || t.date < limite) return;
        if (!(RE_FIN.test(t.description || '') || t.category === 'Dívidas')) return;
        if (parcelaInfo(t)) return;
        var base = (t.description || '').toLowerCase().replace(/[\d./-]+/g, ' ').replace(/\s+/g, ' ').trim();
        var k = base + '|' + (t.accountId || '');
        if (!grupos.has(k)) grupos.set(k, []);
        grupos.get(k).push(t);
      });
      var out = [];
      grupos.forEach(function (txs, k) {
        var meses = new Set(txs.map(function (t) { return t.date.slice(0, 7); }));
        if (meses.size < 2) return;
        txs.sort(function (a, b) { return b.date.localeCompare(a.date); });
        var acc = state.accounts.filter(function (a) { return a.id === txs[0].accountId; })[0];
        var bancoRec = acc ? nomeBanco(acc.name) : '';
        var nomeRec = /liquida[cç][aã]o de parcela/i.test(txs[0].description || '') ? ('Empréstimo ' + bancoRec).trim() : nomeBonito(txs[0].description);
        out.push({ chave: 'rec:' + k, nome: nomeRec, banco: /^Empréstimo /.test(nomeRec) ? '' : bancoRec, parcela: +txs[0].amount, ultima: txs[0].date, vezes: txs.length });
      });
      return out;
    }
    function financiamentos() {
      var doBanco = ((f && f.loans) || []).map(function (l) {
        return { chave: 'loan:' + l.id, nome: nomeBonito(l.name), banco: bancoDoItem(l.itemId, l.bank), fonte: 'banco',
          devedor: l.outstanding, parcela: l.installment || (l.outstanding && l.due ? l.outstanding / l.due : null),
          pagas: l.paid, total: l.total, atraso: l.pastDue, cet: l.cet, fim: l.end };
      });
      var informados = saldosInformados();
      var recorrentes = financiamentosRecorrentes().map(function (r) {
        return Object.assign({}, r, { fonte: 'lancamentos', devedor: informados[r.chave] ? informados[r.chave].valor : null, informadoEm: informados[r.chave] && informados[r.chave].em });
      });
      var dividas = compromissos().filter(function (c) { return c.kind === 'divida' && !c.quitado; }).map(function (c) {
        return { chave: 'div:' + c.id, nome: c.descricao, banco: c.credor || '', fonte: 'cadastro', devedor: c.aPagar, pagas: null, total: null, pago: c.pago, valorTotal: c.total };
      });
      var informados2 = saldosInformados();
      var cadastrados = compromissos().filter(function (c) { return c.kind === 'financiamento' && !c.quitado; }).map(function (c) {
        var inf = informados2['fin:' + c.id];
        return { chave: 'fin:' + c.id, nome: c.descricao, banco: c.credor || '', fonte: 'financiamento',
          devedor: inf ? inf.valor : c.aPagar, estimado: !inf, informadoEm: inf && inf.em,
          parcela: c.valorParcela, pagas: c.pagas, total: c.n, fim: c.ultima };
      });
      return doBanco.concat(cadastrados, recorrentes, dividas);
    }
    function parcelas() {
      var abertos = compromissos().filter(function (c) { return !c.quitado && c.kind !== 'divida' && c.kind !== 'financiamento' && c.type === 'expense'; });
      return { porMes: soma(abertos, function (c) { return c.valorParcela; }), falta: soma(abertos, function (c) { return c.aPagar; }) };
    }
    function investimentos() {
      var inv = (f && f.investments) || [];
      return { lista: inv.filter(function (i) { return !i.previdencia; }), prev: inv.filter(function (i) { return i.previdencia; }) };
    }
    function previdencia() {
      var ano = String(new Date().getFullYear());
      var pref = new Date().toISOString().slice(0, 7);
      var aportes = state.transactions.filter(function (t) { return t.type === 'expense' && !t.transferId && !t.pending && /previd/i.test(t.category || ''); });
      var doBanco = investimentos().prev;
      var inf = saldosInformados()['prev'];
      return {
        mes: soma(aportes.filter(function (t) { return t.date.startsWith(pref); }), function (t) { return t.amount; }),
        ano: soma(aportes.filter(function (t) { return t.date.startsWith(ano); }), function (t) { return t.amount; }),
        saldo: doBanco.length ? soma(doBanco, function (i) { return i.balance; }) : (inf ? inf.valor : null),
        informadoEm: !doBanco.length && inf ? inf.em : null, doBanco: doBanco.length > 0
      };
    }
    /* somas do render() da Visão geral, na mesma ordem */
    var cs = contas();
    var correntes = cs.filter(function (c) { return !c.cartao; });
    var cartoes = cs.filter(function (c) { return c.cartao && (c.limite || faturaAtual(c)); });
    var saldoContas = soma(correntes, function (c) { return c.saldo; });
    var faturas = soma(cartoes, function (c) { return faturaAtual(c); });
    var fins = financiamentos();
    var devedor = soma(fins, function (x) { return x.devedor; });
    var semSaldo = fins.filter(function (x) { return x.devedor == null; }).length;
    var inv = investimentos();
    var totInv = soma(inv.lista, function (i) { return i.balance; });
    var prev = previdencia();
    var par = parcelas();
    var patrimonio = saldoContas + totInv + (prev.saldo || 0) - faturas - devedor;

    /* faturas de cada cartão (faturaDoCartao e faturaPaga do Granaê), de 2 meses antes a 4 depois */
    var hoje = new Date();
    var fat = {};
    (state.accounts || []).filter(function (a) { return a.kind === 'cartao'; }).forEach(function (a) {
      fat[a.id] = [-2, -1, 0, 1, 2, 3, 4].map(function (k) {
        var ref = new Date(hoje.getFullYear(), hoje.getMonth() + k, 1);
        var it = faturaDoCartao(a, ref);
        return { mes: chaveMes(ref), total: soma(it, function (t) { return t.amount; }), n: it.length, paga: faturaPaga(a.id, ref) };
      });
    });
    var comp = compromissos().map(function (c) {
      var o = Object.assign({}, c, { id: String(c.id) });
      o.txs = (c.txs || []).map(function (t) { return { id: String(t.id), date: t.date, amount: t.amount, pending: !!t.pending, accountId: t.accountId || null, groupId: t.groupId || null }; });
      return o;
    });
    var saldos = {};
    (state.accounts || []).forEach(function (a) { saldos[a.id] = saldoDaConta(a); });
    var fr = f && window.GranaeOF.frescor ? window.GranaeOF.frescor(f) : null;
    return JSON.stringify({
      uid: (MT.user && MT.user.uid) || '',
      transactions: ids(state.transactions).map(function (t) { var o = Object.assign({}, t); delete o.ofDesc; return o; }),
      categories: ids(state.categories), fixedItems: ids(state.fixedItems), commitments: ids(state.commitments),
      accounts: ids(state.accounts), budgets: ids(state.budgets), rules: (state.rules || []).length,
      bancoSaldos: saldosInformados(),
      feed: f ? {
        items: (f.items || []).map(function (i) { return { id: i.id, bank: i.bank, banco: bancoDoItem(i.id, i.bank), status: i.status || '', error: i.error || '', lastUpdatedAt: i.lastUpdatedAt || null }; }),
        accounts: (f.accounts || []).map(function (a) { return { id: a.id, itemId: a.itemId, kind: a.kind, name: a.name, number: a.number || '', bank: a.bank, balance: a.balance, limit: a.limit, available: a.available }; }),
        investimentos: inv.lista.map(function (i) { return { nome: nomeBonito(i.name), banco: bancoDoItem(i.itemId, i.bank), saldo: +i.balance || 0 }; }),
        lido: fr ? fr.lido : 0, lidoTxt: fr ? fr.lidoTxt : '', ate: fr ? fr.ate : '', ateTxt: fr ? fr.ateTxt : ''
      } : null,
      visao: {
        contas: cs.map(function (c) { return Object.assign({}, c, { fatura: c.cartao ? faturaAtual(c) : null }); }),
        saldoContas: saldoContas, faturas: faturas, financiamentos: fins, devedor: devedor, semSaldo: semSaldo,
        totInv: totInv, previdencia: prev, parcelas: par, patrimonio: patrimonio
      },
      calc: {
        compromissos: comp, faturas: fat, saldos: saldos,
        projecao: projecaoSaldo(3).map(function (m) { return { mes: chaveMes(m.ref), entra: m.entra, sai: m.sai, saldo: m.saldo }; }),
        comprometimento: comprometimentoPorMes(7).map(function (m) { return { mes: chaveMes(m.ref), total: m.total }; }),
        revisar: paraRevisar().length
      }
    });
  }
  var EXPORTA_GRANAE = 'window.__cofre.exportar=' + exportaGranae.toString() + ';';

  /* ---------- operações (cópia fiel do que os formulários das páginas fazem ao salvar; JSMes do iPhone) ---------- */
  var achaP = "const s=state.shifts.find(x=>String(x.id)===id);if(!s)throw new Error('nao-achou');";
  var JS = {
    /* saveForm. Diferença deliberada (a mesma do iPhone): mantém pgDia e pgMes do local (o original zera a regra de pagamento ao salvar plantão). */
    salvarPlantao: "const o={date:r.date,local:String(r.local||'').trim()||'Plantão',start:r.start,end:r.end,value:parseFloat(r.value)||0,status:r.status||'agendado',note:String(r.note||'').trim()};\n" +
      "if(!o.date)throw new Error('data');\n" +
      "o.updatedAt=Date.now();\n" +
      "if(id){const alvo=state.shifts.find(x=>String(x.id)===id);if(alvo){Object.assign(alvo,o);}else{state.shifts.push({id,...o});}}\n" +
      "else{state.shifts.push({id:uid(),...o});}\n" +
      "if(!state.locais)state.locais={};\n" +
      "state.locais[o.local]=Object.assign({},state.locais[o.local]||{},{start:o.start,end:o.end,value:o.value});\n" +
      "persist();",
    /* toggleStatus */
    alternarPago: achaP + "s.status=s.status==='pago'?'agendado':'pago';s.updatedAt=Date.now();persist();",
    /* del: a cópia devolvida serve para o Desfazer. */
    excluirPlantao: achaP + "const copia=JSON.parse(JSON.stringify(s));MT.markDeleted(state,s.id);state.shifts=state.shifts.filter(x=>x.id!==s.id);persist();return copia;",
    /* Desfazer: updatedAt maior que a lápide faz o merge manter o item. */
    restaurarPlantao: "const o=JSON.parse(copia);o.updatedAt=Date.now();state.shifts=state.shifts.filter(x=>x.id!==o.id);state.shifts.push(o);persist();",
    /* dup */
    duplicarPlantao: achaP + "const d=new Date(s.date+'T00:00:00');d.setDate(d.getDate()+7);const nova=ymd(d);state.shifts.push({...s,id:uid(),date:nova,status:'agendado',updatedAt:Date.now()});persist();return nova;",
    /* cellClick com dayClip */
    colarDia: "itens.forEach(s=>state.shifts.push({id:uid(),date:ds,local:s.local,start:s.start,end:s.end,value:s.value,status:'agendado',note:s.note||'',updatedAt:Date.now()}));persist();",
    /* setCompDay */
    definirCompDay: "state.compDay=Math.min(28,Math.max(1,parseInt(v)||1));persist();",
    /* salvarRegraPg */
    salvarRegra: "const dia=Math.min(28,Math.max(1,parseInt(d)||10));const mes=Math.max(0,Math.min(6,parseInt(m)||0));\n" +
      "if(local){if(!state.locais)state.locais={};if(!state.locais[local])state.locais[local]={};state.locais[local].pgDia=dia;state.locais[local].pgMes=mes;}\n" +
      "else{state.pgDia=dia;state.pgMes=mes;}\n" +
      "persist();",
    /* limparRegraPg */
    limparRegra: "const x=(state.locais||{})[local];if(x){delete x.pgDia;delete x.pgMes;}persist();",

    /* txForm submit. Diferença deliberada (a mesma do iPhone): na edição mantém o que este formulário não mostra
       (grupo, banco, vencimento), porque o original os apagaria ao trocar o objeto inteiro. */
    salvarLancamento: "const obj={id:id||cid(),type:r.type,amount:parseFloat(r.amount),description:String(r.description||'').trim(),category:r.category,date:r.date,sub:String(r.sub||'').trim()||null,accountId:r.accountId||null};\n" +
      "if(!obj.amount||!obj.description||!obj.category||!obj.date)throw new Error('campos');\n" +
      "const nPar=parseInt(r.parcelas)||1;\n" +
      "const velho=id?state.transactions.find(t=>String(t.id)===id):null;\n" +
      "if(!velho&&nPar>1){\n" +
      "  const gid=cid();const base=new Date(obj.date+'T00:00:00');const hoje=todayISO();\n" +
      /* Finanças nova: com r.porTotal o valor digitado é o TOTAL da compra e cada parcela leva total/N em centavos;
         o resto da divisão (no máximo N-1 centavos) vai na 1ª parcela, para a soma bater com o total. Fora isso, igual ao txForm. */
      "  const cents=Math.round(obj.amount*100),cada=Math.floor(cents/nPar),resto=cents-cada*nPar;\n" +
      "  const valorK=k=>r.porTotal?(cada+(k===0?resto:0))/100:obj.amount;\n" +
      "  for(let k=0;k<nPar;k++){\n" +
      "    const d=new Date(base);d.setMonth(base.getMonth()+k);\n" +
      "    if(d.getDate()!==base.getDate())d.setDate(0);\n" +
      "    const ds=d.toISOString().slice(0,10);\n" +
      "    const p=stampTx({id:cid(),type:obj.type,amount:valorK(k),description:`${obj.description} (${k+1}/${nPar})`,category:obj.category,date:ds,groupId:gid,sub:obj.sub,accountId:obj.accountId});\n" +
      "    if(ds>hoje)p.pending=true;\n" +
      "    state.transactions.push(p);\n" +
      "  }\n" +
      "  saveState();return;\n" +
      "}\n" +
      "const fin=velho?Object.assign({},velho,obj,{id:velho.id}):obj;\n" +
      "delete fin.pending;\n" +
      "aplicarRegras(fin);\n" +
      "if(fin.date>todayISO())fin.pending=true;\n" +
      "const idx=state.transactions.findIndex(t=>t.id===fin.id);\n" +
      "stampTx(fin);\n" +
      "if(idx>=0)state.transactions[idx]=fin;else state.transactions.push(fin);\n" +
      "saveState();",
    /* txDelete */
    excluirLancamento: "const t=state.transactions.find(x=>String(x.id)===id);if(!t)throw new Error('nao-achou');const copia=JSON.parse(JSON.stringify(t));state.transactions=state.transactions.filter(x=>x.id!==t.id);tombstone('tombstones',t.id);saveState();return copia;",
    restaurarLancamento: "const o=JSON.parse(copia);stampTx(o);state.transactions=state.transactions.filter(x=>x.id!==o.id);state.transactions.push(o);saveState();",
    /* txDup */
    duplicarLancamento: "const t=state.transactions.find(x=>String(x.id)===id);if(!t)throw new Error('nao-achou');const obj=stampTx({id:cid(),type:t.type,amount:parseFloat(t.amount),description:String(t.description||'').trim(),category:t.category,date:todayISO()});if(!obj.amount||!obj.description)throw new Error('campos');state.transactions.push(obj);saveState();",
    /* pagForm submit */
    registrarPagamento: "const c=(state.commitments||[]).find(x=>x.id===alvo)||compromissos().find(x=>x.id===alvo);\n" +
      "if(!c)throw new Error('nao-achou');\n" +
      "const atual=compromissos().find(x=>x.id===c.id);\n" +
      "const ehParcela=modo==='parcela'&&atual&&atual.kind!=='divida';\n" +
      "const k=atual?atual.pagas+1:1;\n" +
      "const t=stampTx({id:cid(),type:'expense',amount:valor,description:ehParcela?`${c.descricao} (${k}/${atual.n})`:`${c.descricao} — pagamento`,category:(ehParcela?atual.categoria:c.category)||'Dívidas',date:data,groupId:c.id,accountId:conta||null});\n" +
      "if(data>todayISO())t.pending=true;\n" +
      "state.transactions.push(t);\n" +
      "saveState();",
    /* fixedForm submit */
    salvarFixo: "const obj={id:id||cid(),type:r.type,name:String(r.name||'').trim(),amount:parseFloat(r.amount),category:r.category||'Outros',frequency:r.frequency||'monthly'};\n" +
      "if(obj.frequency==='yearly')obj.month=parseInt(r.month||'1',10);\n" +
      "if(!obj.name||!obj.amount)throw new Error('campos');\n" +
      "const idx=state.fixedItems.findIndex(f=>f.id===obj.id);\n" +
      "stampTx(obj);\n" +
      "if(idx>=0)state.fixedItems[idx]=obj;else state.fixedItems.push(obj);\n" +
      "saveState();",
    /* fixedDelete */
    excluirFixo: "state.fixedItems=state.fixedItems.filter(f=>f.id!==id);tombstone('fixedTombstones',id);saveState();",
    /* catForm submit, só o campo da meta */
    definirTeto: "const cat=state.categories.find(c=>String(c.id)===id);if(!cat)throw new Error('nao-achou');cat.goal=Math.max(0,parseFloat(v)||0)||null;cat.updatedAt=Date.now();saveState();",

    /* ---- Finanças nova ---- */
    /* alternarFaturaPaga do Granaê, chamada como está (grava acc.faturasPagas['acc:AAAA-MM'] e salva) */
    alternarFaturaPaga: "const a=(state.accounts||[]).find(x=>String(x.id)===id);if(!a)throw new Error('nao-achou');const p=mes.split('-');alternarFaturaPaga(a.id,new Date(+p[0],+p[1]-1,1));",
    /* criarTransferencia do Granaê + saveState, como o trfForm */
    transferir: "const ok=criarTransferencia({de:r.de,para:r.para,valor:+r.valor,data:r.data,descricao:String(r.descricao||'').trim()});if(!ok)throw new Error('campos');saveState();",
    /* informar() de granae.banco.js: saldo devedor ou da previdência informado (state.profile.bancoSaldos) */
    informarSaldo: "const atual={...((state.profile&&state.profile.bancoSaldos)||{})};if(valor==null)delete atual[chave];else atual[chave]={valor:+valor,em:todayISO()};state.profile={...(state.profile||{}),bancoSaldos:atual};saveState();",
    /* cmtForm submit (novo financiamento) */
    novoFinanciamento: "const n=parseInt(r.n)||0;const parcela=+r.parcela||0;const desc=String(r.descricao||'').trim();\n" +
      "if(!n||!parcela||!desc||!r.category||!r.date)throw new Error('campos');\n" +
      "const gid=cid();const base=new Date(r.date+'T00:00:00');const hoje=todayISO();\n" +
      "for(let k=0;k<n;k++){const dt=new Date(base);dt.setMonth(base.getMonth()+k);if(dt.getDate()!==base.getDate())dt.setDate(0);const ds=dt.toISOString().slice(0,10);\n" +
      "const t=stampTx({id:cid(),type:'expense',amount:parcela,description:`${desc} (${k+1}/${n})`,category:r.category,date:ds,groupId:gid,accountId:r.accountId||null});if(ds>hoje)t.pending=true;state.transactions.push(t);}\n" +
      "state.commitments=state.commitments||[];\n" +
      "state.commitments.push(stampTx({id:gid,kind:'financiamento',descricao:desc,nParcelas:n,valorFinanciado:+r.valorFinanciado||null,taxaMensal:+r.taxa||null,total:parcela*n,accountId:r.accountId||null}));\n" +
      "saveState();",
    /* addDivida (ensureCategory) + divForm submit */
    novaDivida: "ensureCategory('Dívidas','expense');const desc=String(r.descricao||'').trim();const total=+r.total||0;if(!desc||!total)throw new Error('campos');\n" +
      "state.commitments=state.commitments||[];state.commitments.push({id:cid(),kind:'divida',descricao:desc,credor:String(r.credor||'').trim()||null,total,category:r.category||'Dívidas',desde:todayISO(),updatedAt:Date.now()});saveState();",
    /* accForm submit (conta ou cartão sem banco) */
    salvarConta: "const nome=String(r.name||'').trim();if(!nome)throw new Error('campos');\n" +
      "const obj=stampTx({id:id||cid(),kind:r.kind||'conta',name:nome,color:r.color||'#6366f1',saldoInicial:+r.saldoInicial||0,fechamento:+r.fechamento||null,vencimento:+r.vencimento||null,limite:+r.limite||null,orcamento:+r.orcamento||null});\n" +
      "state.accounts=state.accounts||[];const i=state.accounts.findIndex(x=>x.id===obj.id);if(i>=0)state.accounts[i]=obj;else state.accounts.push(obj);saveState();",
    /* aplicarRevisao (revisão em lote): categoria e, se houver termo, a regra e reaplicarRegras */
    categorizar: "const t=state.transactions.find(x=>String(x.id)===id);if(!t)throw new Error('nao-achou');t.category=cat;t.updatedAt=Date.now();\n" +
      "let n=0;const termo=String(regra||'').trim();if(termo){state.rules=state.rules||[];state.rules.push({id:cid(),contem:termo,category:cat,updatedAt:Date.now()});n=reaplicarRegras();}\n" +
      "saveState();return n;",
    /* audConfirm (lançamento por voz): ensureCategory é o que onRecordingDone faz antes de mostrar */
    lancarVoz: "ensureCategory(r.category,r.type);const tx={id:cid(),type:r.type,amount:Number(r.amount)||0,description:r.description||'Lançamento por voz',category:r.category||'Outros',date:r.date||todayISO()};\n" +
      "if(!tx.amount)throw new Error('campos');stampTx(tx);state.transactions.push(tx);saveState();",
    /* invConfirm (fatura ou extrato lido pela IA): importa tudo como o Granaê */
    importarFatura: "if(!itens.length)throw new Error('campos');for(const it of itens){ensureCategory(it.category,'expense');state.transactions.push({id:cid(),type:'expense',amount:Number(it.amount)||0,description:it.description,category:it.category,date:it.date,updatedAt:Date.now()});}saveState();return itens.length;"
  };

  /* ---------- leituras que usam funções da página sem gravar (IA, voz, fatura e Open Finance) ----------
     Os objetos (Blob/File) passam direto para a página: mesmo domínio. */
  var CONSULTA = {
    /* runAnalysis do Granaê para o mês escolhido: Gemini.analyzeMonth com os lançamentos do mês, sem transferências; safeMD limpa o texto */
    analisarMes: function (w, a) {
      var p = a.mes.split('-'), ref = new w.Date(+p[0], +p[1] - 1, 1);
      return w.eval('(function(ref,q){return Gemini.analyzeMonth({transactions:state.transactions.filter(t=>inMonth(t.date,ref)&&!ehTransfer(t)),categories:state.categories,fixedItems:state.fixedItems,monthLabel:monthLongFmt.format(ref),customQuestion:q}).then(safeMD)})')(ref, a.pergunta || '');
    },
    /* onRecordingDone: Gemini.classifyAudio(blob, categorias) */
    lerAudio: function (w, a) { return w.eval('(function(b){return Gemini.classifyAudio(b,state.categories)})')(a.blob); },
    /* invoiceFile: Gemini.analyzeInvoice(arquivo, categorias) */
    lerFatura: function (w, a) { return w.eval('(function(f){return Gemini.analyzeInvoice(f,state.categories)})')(a.arquivo); },
    /* faixa "Bancos lidos" do Granaê: o clique dela é o sincronizarAgora do granae.openfinance.js */
    sincronizar: function (w) { var b = w.document.getElementById('ofBar'); if (!b) throw new Error('sem-banco'); b.click(); return true; }
  };

  /* ---------- dados fictícios do modo demonstração (RepositorioDemo do iPhone), gravados pela própria página ---------- */
  var SEMEIA_PLANTAO = "const dia=n=>{const d=new Date();d.setDate(d.getDate()+n);return ymd(d)};\n" +
    "const upa='UPA Central',sl='Hospital São Lucas, PS',cv='Clínica Vida, ambulatório';\n" +
    "const pl=(i,n,l,a,b,v,st)=>({id:'dp'+i,date:dia(n),local:l,start:a,end:b,value:v,status:st,note:'',updatedAt:Date.now()});\n" +
    "state.shifts=[pl(1,-37,upa,'19:00','07:00',1200,'pago'),pl(2,-30,sl,'07:00','19:00',1100,'pago'),pl(3,-23,upa,'19:00','07:00',1200,'pago'),pl(4,-16,sl,'07:00','19:00',1100,'pago'),\n" +
    "pl(5,-9,upa,'19:00','07:00',1200,'agendado'),pl(6,-2,cv,'08:00','12:00',500,'agendado'),pl(7,0,sl,'07:00','19:00',1100,'agendado'),pl(8,1,upa,'19:00','07:00',1200,'agendado'),\n" +
    "pl(9,6,cv,'08:00','12:00',500,'agendado'),pl(10,8,sl,'07:00','19:00',1100,'agendado'),pl(11,15,upa,'19:00','07:00',1200,'agendado'),pl(12,22,sl,'07:00','19:00',1100,'agendado'),\n" +
    "pl(13,31,upa,'19:00','07:00',1200,'agendado'),pl(14,38,cv,'08:00','12:00',500,'agendado')];\n" +
    "state.locais={[upa]:{start:'19:00',end:'07:00',value:1200,pgDia:15,pgMes:1},[sl]:{start:'07:00',end:'19:00',value:1100},[cv]:{start:'08:00',end:'12:00',value:500,pgDia:5,pgMes:1}};\n" +
    "state.compDay=1;state.pgDia=10;state.pgMes=1;\n" +
    "persist();";
  var SEMEIA_GRANAE = "const dia=n=>{const d=new Date();d.setDate(d.getDate()+n);const tz=d.getTimezoneOffset()*60000;return new Date(d-tz).toISOString().slice(0,10)};\n" +
    "const hoje=todayISO();\n" +
    "[['Moradia','expense','#64748b'],['Dívidas','expense','#b91c1c'],['Plantões','income','#4d7c0f']].forEach(([n,t,c])=>{if(!state.categories.some(x=>x.name===n))state.categories.push({id:cid(),type:t,name:n,icon:'🏷️',color:c,goal:null,updatedAt:Date.now()});});\n" +
    "[['Alimentação',900],['Mercado',1200]].forEach(([n,g])=>{const c=state.categories.find(x=>x.name===n);if(c){c.goal=g;c.updatedAt=Date.now();}});\n" +
    "const lc=(n,t,v,d,c)=>{const data=dia(n);const o=stampTx({id:'dl'+n+d.slice(0,3),type:t,amount:v,description:d,category:c,date:data,sub:null,accountId:null});if(data>hoje)o.pending=true;return o};\n" +
    "state.transactions=[lc(0,'income',9200,'Salário','Salário'),lc(0,'expense',412.30,'Mercado da semana','Mercado'),lc(0,'expense',86.90,'Farmácia','Saúde'),lc(0,'expense',38,'Corrida até o hospital','Transporte'),\n" +
    "lc(3,'expense',1850,'Aluguel','Moradia'),lc(9,'expense',240,'Luz e internet','Contas'),lc(12,'expense',59.90,'Assinatura de streaming','Assinaturas'),lc(20,'income',800,'Aula particular','Freelance'),\n" +
    "lc(-3,'expense',96.50,'Jantar','Alimentação'),lc(-5,'income',9200,'Salário','Salário'),lc(-6,'expense',520.40,'Mercado do mês','Mercado'),lc(-8,'expense',74,'Combustível','Transporte'),\n" +
    "lc(-10,'expense',188,'Consulta','Saúde'),lc(-12,'income',2300,'Depósito dos plantões','Plantões'),lc(-14,'expense',1850,'Aluguel','Moradia'),lc(-15,'expense',132.20,'Almoços','Alimentação'),\n" +
    "lc(-18,'expense',240,'Luz e internet','Contas'),lc(-20,'expense',310,'Curso de ECG','Educação'),lc(-24,'expense',145.80,'Cinema e jantar','Lazer')];\n" +
    "for(let k=0;k<10;k++){const data=dia(-60+k*30);const o=stampTx({id:'np'+k,type:'expense',amount:389.90,description:'Notebook ('+(k+1)+'/10)',category:'Educação',date:data,groupId:'gNote',sub:null,accountId:null});if(data>hoje)o.pending=true;state.transactions.push(o);}\n" +
    "state.commitments=[stampTx({id:'dvA',kind:'divida',descricao:'Acerto com a Clara',credor:'Clara',total:3000,category:'Dívidas',desde:dia(-90)})];\n" +
    "state.transactions.push(stampTx({id:'dvp1',type:'expense',amount:500,description:'Acerto com a Clara — pagamento',category:'Dívidas',date:dia(-40),groupId:'dvA',sub:null,accountId:null}));\n" +
    "state.fixedItems=[stampTx({id:'fx1',type:'expense',name:'Aluguel',amount:1850,category:'Moradia',frequency:'monthly'}),stampTx({id:'fx2',type:'expense',name:'Luz e internet',amount:240,category:'Contas',frequency:'monthly'}),\n" +
    "stampTx({id:'fx3',type:'income',name:'Salário',amount:9200,category:'Salário',frequency:'monthly'}),stampTx({id:'fx4',type:'expense',name:'Anuidade do CRM',amount:690,category:'Contas',frequency:'yearly',month:3})];\n" +
    /* Finanças nova: um cartão e uma conta sem banco, parcelados no cartão, um financiamento, meses anteriores e um teto de subcategoria */
    "state.accounts=[stampTx({id:'dcCart',kind:'cartao',name:'Cartão Roxo',color:'#7c3aed',saldoInicial:0,fechamento:3,vencimento:10,limite:8000,orcamento:null}),stampTx({id:'dcConta',kind:'conta',name:'Conta da clínica',color:'#0ea5e9',saldoInicial:4200,fechamento:null,vencimento:null,limite:null,orcamento:null})];\n" +
    "state.transactions.forEach(t=>{if(t.groupId==='gNote'||['Jantar','Cinema e jantar','Almoços','Farmácia'].includes(t.description))t.accountId='dcCart';if(t.description==='Aluguel'||t.description==='Luz e internet')t.accountId='dcConta';});\n" +
    "const serie=(g,desc,n,v,ini,cat,conta,cada)=>{for(let k=0;k<n;k++){const d=new Date();d.setDate(1);d.setMonth(d.getMonth()+ini+k);const ult=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();d.setDate(Math.min(cada,ult));const tz=d.getTimezoneOffset()*60000;const data=new Date(d-tz).toISOString().slice(0,10);const o=stampTx({id:g+k,type:'expense',amount:v,description:desc+' ('+(k+1)+'/'+n+')',category:cat,date:data,groupId:g,sub:null,accountId:conta});if(data>hoje)o.pending=true;state.transactions.push(o);}};\n" +
    "serie('gGel','Geladeira',10,329.9,-3,'Moradia','dcCart',6);serie('gPas','Passagens',5,412,-1,'Lazer','dcCart',12);serie('gPne','Pneus',4,268,0,'Transporte','dcCart',2);\n" +
    "serie('gCar','Carro',48,1890,-21,'Transporte',null,15);\n" +
    "state.commitments.push(stampTx({id:'gCar',kind:'financiamento',descricao:'Carro',nParcelas:48,valorFinanciado:72000,taxaMensal:1.29,total:1890*48,accountId:null}));\n" +
    "for(let m=1;m<=5;m++){const b=-30*m;state.transactions.push(lc(b-4,'income',9200,'Salário','Salário'),lc(b-9,'income',1800+m*150,'Depósito dos plantões','Plantões'),lc(b-6,'expense',1850,'Aluguel','Moradia'),lc(b-11,'expense',980+m*61,'Mercado do mês','Mercado'),lc(b-13,'expense',240+m*35,'Restaurantes','Alimentação'),lc(b-17,'expense',150+m*20,'Combustível','Transporte'));}\n" +
    "const ifo=lc(-2,'expense',64.9,'iFood','Alimentação');ifo.sub='iFood';ifo.accountId='dcCart';state.transactions.push(ifo);\n" +
    "state.budgets=[stampTx({id:'bs1',tipo:'sub',ref:'Alimentação',sub:'iFood',valor:300})];\n" +
    "saveState();";
  /* Demonstração: o resumo do Open Finance chega como o do banco (GranaeOF._setFeed, a entrada de teste do granae.openfinance.js),
     com dois bancos fictícios, um deles pedindo reconexão. A própria importação do Granaê cria as contas e os lançamentos. */
  var FEED_DEMO = "(function(){const h=new Date();const dia=n=>{const d=new Date();d.setDate(d.getDate()+n);const tz=d.getTimezoneOffset()*60000;return new Date(d-tz).toISOString().slice(0,10)};\n" +
    "const fim=new Date(h.getFullYear()+1,h.getMonth(),10);const tz=fim.getTimezoneOffset()*60000;\n" +
    "GranaeOF._setFeed({syncedAt:Date.now()-3*3600000,items:[{id:'itA',bank:'Banco Azul',status:'UPDATED',lastUpdatedAt:new Date(Date.now()-3*3600000).toISOString()},{id:'itB',bank:'Banco Verde',status:'LOGIN_ERROR',error:'A autorização venceu no banco',lastUpdatedAt:new Date(Date.now()-9*86400000).toISOString()}],\n" +
    "accounts:[{id:'a1',itemId:'itA',kind:'conta',name:'Conta corrente',number:'1234',bank:'Banco Azul',balance:18420.55,from:dia(-40)},{id:'a2',itemId:'itB',kind:'conta',name:'Poupança',number:'',bank:'Banco Verde',balance:5200,from:dia(-40)},{id:'c1',itemId:'itA',kind:'cartao',name:'Cartão Azul Black',number:'9876',bank:'Banco Azul',balance:2310.4,limit:15000,available:11200,dueDay:15,closeDay:8,from:dia(-40)}],\n" +
    "transactions:[{id:'ft1',accountId:'c1',type:'expense',amount:89.7,date:dia(-1),desc:'PAGUE MENOS 0412',cat:'',pending:false},{id:'ft2',accountId:'a1',type:'expense',amount:150,date:dia(-2),desc:'PIX JOAO S',cat:'',pending:false},{id:'ft3',accountId:'a1',type:'income',amount:2400,date:dia(-1),desc:'PLANTAO UPA CENTRAL',cat:'Salary',pending:false},{id:'ft4',accountId:'c1',type:'expense',amount:312.4,date:dia(0),desc:'SUPERMERCADO BOM PRECO',cat:'Groceries',pending:true}],\n" +
    "loans:[{id:'L1',itemId:'itA',name:'EMPRESTIMO PESSOAL',bank:'Banco Azul',outstanding:8400,installment:700,paid:6,total:18,end:new Date(fim-tz).toISOString().slice(0,10)}],\n" +
    "investments:[{id:'i1',itemId:'itA',name:'CDB BANCO AZUL',bank:'Banco Azul',balance:25300},{id:'i2',itemId:'itA',name:'PREVIDENCIA PGBL',bank:'Banco Azul',balance:14100,previdencia:true}]});})();";

  /* ---------- números e textos como os do JSON (Decodable tolerante do iPhone) ---------- */
  function num(v) { if (typeof v === 'number') return isFinite(v) ? v : null; if (typeof v === 'string' && v.trim() !== '') { var n = parseFloat(v.replace(',', '.')); return isFinite(n) ? n : null; } return null; }
  function txt(v) { if (typeof v === 'string') return v; if (typeof v === 'number') return String(v); return null; }

  function lerPlantao(o) {
    var locais = {};
    Object.keys(o.locais || {}).forEach(function (k) {
      var m = o.locais[k] || {};
      locais[k] = { start: txt(m.start), end: txt(m.end), value: num(m.value), pgDia: num(m.pgDia), pgMes: num(m.pgMes) };
    });
    return {
      uid: txt(o.uid) || '',
      shifts: (o.shifts || []).map(function (s) {
        return { id: txt(s.id) || '', date: txt(s.date) || '', local: txt(s.local) || '', start: txt(s.start), end: txt(s.end), value: num(s.value), status: txt(s.status), note: txt(s.note) };
      }),
      locais: locais,
      compDay: Math.trunc(num(o.compDay) || 1),
      pgDia: num(o.pgDia),
      pgMes: num(o.pgMes)
    };
  }
  function lerGranae(o) {
    var v = o.visao || {}, c = o.calc || {};
    return {
      uid: txt(o.uid) || '',
      transactions: (o.transactions || []).map(function (t) {
        return { id: txt(t.id) || '', type: txt(t.type) || 'expense', amount: num(t.amount) || 0, description: txt(t.description) || '', category: txt(t.category) || '', date: txt(t.date) || '',
          pending: t.pending === true, groupId: txt(t.groupId), sub: txt(t.sub), accountId: txt(t.accountId), transferId: txt(t.transferId),
          doBanco: !!(t.of || t.ofId), ofPend: t.ofPend === true };
      }),
      categories: (o.categories || []).map(function (c) { return { id: txt(c.id) || '', name: txt(c.name) || '', type: txt(c.type) || 'expense', goal: num(c.goal), color: txt(c.color) }; }),
      fixedItems: (o.fixedItems || []).map(function (f) {
        var m = num(f.month);
        return { id: txt(f.id) || '', type: txt(f.type) || 'expense', name: txt(f.name) || '', amount: num(f.amount) || 0, category: txt(f.category) || '', frequency: txt(f.frequency), month: m == null ? null : Math.trunc(m) };
      }),
      commitments: (o.commitments || []).map(function (c) {
        var n = num(c.nParcelas);
        return { id: txt(c.id) || '', kind: txt(c.kind), descricao: txt(c.descricao), credor: txt(c.credor), total: num(c.total), category: txt(c.category), desde: txt(c.desde),
          nParcelas: n == null ? null : Math.trunc(n), saldoDevedor: num(c.saldoDevedor), accountId: txt(c.accountId), taxaMensal: num(c.taxaMensal), valorFinanciado: num(c.valorFinanciado), banco: txt(c.banco) };
      }),
      accounts: (o.accounts || []).map(function (a) {
        return { id: txt(a.id) || '', name: txt(a.name) || '', kind: txt(a.kind), color: txt(a.color), fechamento: num(a.fechamento), vencimento: num(a.vencimento), limite: num(a.limite),
          orcamento: num(a.orcamento), saldoInicial: num(a.saldoInicial), of: a.of === true, ofBanco: txt(a.ofBanco), faturasPagas: a.faturasPagas && typeof a.faturasPagas === 'object' ? a.faturasPagas : {} };
      }),
      budgets: (o.budgets || []).map(function (b) { return { id: txt(b.id) || '', tipo: txt(b.tipo), ref: txt(b.ref), sub: txt(b.sub), valor: num(b.valor) }; }),
      regras: num(o.rules) || 0,
      bancoSaldos: o.bancoSaldos && typeof o.bancoSaldos === 'object' ? o.bancoSaldos : {},
      feed: o.feed || null,
      /* números calculados pelas funções do próprio Granaê (ver exportaGranae) */
      visao: { contas: v.contas || [], saldoContas: num(v.saldoContas) || 0, faturas: num(v.faturas) || 0, financiamentos: v.financiamentos || [], devedor: num(v.devedor) || 0,
        semSaldo: num(v.semSaldo) || 0, totInv: num(v.totInv) || 0, previdencia: v.previdencia || {}, parcelas: v.parcelas || {}, patrimonio: num(v.patrimonio) || 0 },
      calc: { compromissos: c.compromissos || [], faturas: c.faturas || {}, saldos: c.saldos || {}, projecao: c.projecao || [], comprometimento: c.comprometimento || [], revisar: num(c.revisar) || 0 }
    };
  }

  /* ---------- página oculta (PaginaCofre) ---------- */
  function Pagina(nome, caminho, exporta, semeia) {
    this.nome = nome; this.caminho = caminho; this.exporta = exporta; this.semeia = semeia;
    this.fase = 'parada'; this.quadro = null; this.geracao = 0;
  }
  Pagina.prototype.mudaFase = function (f) { if (this.fase === f) return; this.fase = f; avisa('situacao'); };
  Pagina.prototype.abrir = function () {
    var p = this, g = ++p.geracao;
    p.parar(true);
    p.mudaFase('carregando');
    var q = D.createElement('iframe');
    q.className = 'cofre-pagina';
    q.setAttribute('aria-hidden', 'true');
    q.setAttribute('tabindex', '-1');
    q.inert = true;   // a página oculta nunca toma o foco (o login dela focaria o campo de e-mail)
    q.title = p.nome;
    q.addEventListener('load', function () { if (g === p.geracao) p.acompanhar(g); });
    p.quadro = q;
    if (DEMO) {
      if (p.nome === 'granae') guardaGc();
      fetch(BASE + p.caminho, { cache: 'no-cache', credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }).then(function (h) {
        if (g !== p.geracao) return;
        /* só duas mudanças no HTML, e só na demonstração: endereço base do site e Firebase sem configuração (modo demo do _mtauth.js) */
        var semFb = h.replace(/<script\s+src="_mtfb\.js[^"]*"\s*><\/script>/i, '<script>window.MEDTECH_FB={apiKey:"COLE_AQUI"};<\/script>');
        if (semFb === h || !/<head[^>]*>/i.test(h)) throw new Error('pagina-mudou');
        q.srcdoc = semFb.replace(/<head([^>]*)>/i, '<head$1><base href="' + BASE + '">');
        D.body.appendChild(q);
      }).catch(function (e) { console.warn('cofre: demo de ' + p.nome, e); if (g === p.geracao) p.mudaFase('falhou'); });
    } else {
      q.src = BASE + p.caminho;
      D.body.appendChild(q);
    }
  };
  Pagina.prototype.parar = function (semFase) {
    if (this.quadro) { try { this.quadro.remove(); } catch (e) { } this.quadro = null; }
    if (!semFase) { this.geracao++; this.mudaFase('parada'); }
  };
  Pagina.prototype.janela = function () { try { return this.quadro && this.quadro.contentWindow; } catch (e) { return null; } };
  Pagina.prototype.acompanhar = function (g) {
    var p = this, n = 0;
    (function passo() {
      if (g !== p.geracao) return;
      var w = p.janela(), M = w && w.MT;
      try {
        var temLogin = !!(w && w.document && (w.document.getElementById('mt-login') || w.document.getElementById('mt-auth')));
        if (temLogin && !(M && M.user)) { p.mudaFase('fora'); }
        /* Pronta só quando o próprio app já aplicou os dados: o PlantãoHub e o Granaê registram MT.mergeFn no mesmo
           bloco em que ligam o MT.onData (que roda na hora se o dado já chegou). Antes disso o state deles ainda é o vazio
           e uma gravação partiria dele. */
        else if (M && M.user && M._data !== undefined && M.save && typeof M.mergeFn === 'function') {
          /* demonstração só com página em demonstração, e conta real só com página na nuvem: nunca mistura */
          if ((M.mode === 'demo') !== DEMO) { console.warn('cofre: modo da página não confere', p.nome, M.mode); p.parar(true); p.mudaFase('falhou'); return; }
          w.eval(CAPA);
          w.eval(p.exporta);
          if (W.navigator.onLine === false) w.__cofre.offline = true;
          var pronto = function () {
            if (DEMO && p.nome === 'granae') { try { w.eval(FEED_DEMO); } catch (e) { console.warn('cofre: resumo do banco da demonstração', e); } }
            w.__cofre.ouvir(function (s) { if (g === p.geracao) recebeu(p.nome, s); });
            p.mudaFase('pronta');
          };
          if (DEMO && p.semeia && precisaSemear(p.nome, w)) {
            w.__cofre.agir(w.eval('(function(){\n' + p.semeia + '\n})')).then(function () { marcaSemeado(p.nome); pronto(); }, function (e) { console.warn('cofre: semear', e); pronto(); });
          } else pronto();
          return;
        }
      } catch (e) { console.warn('cofre: acompanhar', p.nome, e); }
      n++;
      setTimeout(passo, n < 80 ? 400 : 2000);   // depois de 32 s continua olhando devagar (login feito em outra aba, rede voltando)
      if (n === 80 && p.fase === 'carregando') p.mudaFase('falhou');
    })();
  };
  Pagina.prototype.avisarRede = function (online) { var w = this.janela(); try { if (w && w.__cofre) w.__cofre.offline = !online; } catch (e) { } };
  /* Só depois que a nuvem respondeu é que o estado muda: a falta de rede nunca deixa um estado pela metade. */
  Pagina.prototype.agir = function (corpo, args) {
    var p = this;
    if (p.fase !== 'pronta') return Promise.reject(new Error(ERROS.naoPronto));
    var w = p.janela();
    if (!w || !w.__cofre) return Promise.reject(new Error(ERROS.naoPronto));
    var nomes = Object.keys(args || {});
    var fn, vals;
    try {
      fn = w.eval('(function(' + nomes.join(',') + '){\n' + corpo + '\n})');
      vals = nomes.map(function (k) { return w.JSON.parse(JSON.stringify(args[k])); });
    } catch (e) { return Promise.reject(new Error('Não consegui gravar. Nada mudou: tente de novo.')); }
    return w.__cofre.agir(function () { return fn.apply(null, vals); }).then(function (r) { if (DEMO && p.nome === 'granae') voltaGc(); return r == null ? '' : String(r); }, function (e) {
      var m = String((e && e.message) || e);
      if (m.indexOf('sem-rede') >= 0) throw new Error(ERROS.semRede);
      if (m.indexOf('nao-pronto') >= 0) throw new Error(ERROS.naoPronto);
      if (m.indexOf('nao-achou') >= 0) throw new Error(ERROS.naoAchou);
      if (m.indexOf('nao-confirmou') >= 0) throw new Error(ERROS.naoConfirmou);
      console.warn('cofre: gravar', p.nome, e);
      // A página pode ter ficado com a mudança só na memória: recarrega para voltar ao que está na nuvem.
      p.abrir();
      throw new Error('Não consegui gravar. Nada mudou: tente de novo.');
    });
  };

  /* Leitura pela página, sem gravar (CONSULTA). Mesma trava de modo e de rede; o resultado volta como veio. */
  Pagina.prototype.consultar = function (nome, args) {
    var p = this;
    if (p.fase !== 'pronta') return Promise.reject(new Error(ERROS.naoPronto));
    var w = p.janela();
    if (!w || !w.__cofre) return Promise.reject(new Error(ERROS.naoPronto));
    if (!online) return Promise.reject(new Error(ERROS.semRede));
    return new Promise(function (ok) { ok(CONSULTA[nome](w, args || {})); });
  };

  /* demonstração: semear uma vez por navegador (ou de novo se a página ficou vazia).
     v2: a semente ganhou cartões, contas, parcelados, financiamento e dívida (Finanças nova). */
  var CHAVE_SEMEADO = 'medtech.demo.semeado.v3.';
  function precisaSemear(nome, w) {
    var feito = false; try { feito = localStorage.getItem(CHAVE_SEMEADO + nome) === '1'; } catch (e) { }
    var vazio = false;
    try { vazio = w.eval(nome === 'plantao' ? '!(state.shifts||[]).length' : '!(state.transactions||[]).length'); } catch (e) { }
    return !feito || vazio;
  }
  function marcaSemeado(nome) { try { localStorage.setItem(CHAVE_SEMEADO + nome, '1'); } catch (e) { } }
  /* O granae.app.js guarda uma cópia em localStorage['gc-state-v1'] (só escrita, ninguém lê). Na demonstração ela
     voltaria com dados fictícios por cima da cópia da conta real deste navegador: guarda e devolve o que havia. */
  var GC = 'gc-state-v1', gcAntes, gcGuardado = false;
  function guardaGc() { if (gcGuardado) return; try { gcAntes = localStorage.getItem(GC); gcGuardado = true; } catch (e) { } }
  function voltaGc() { if (!gcGuardado) return; try { if (gcAntes == null) localStorage.removeItem(GC); else if (localStorage.getItem(GC) !== gcAntes) localStorage.setItem(GC, gcAntes); } catch (e) { } }

  /* ---------- o cofre (CofreMes + RepositorioWeb) ---------- */
  var paginas = {
    plantao: new Pagina('plantao', 'plantaohub.html', EXPORTA_PLANTAO, SEMEIA_PLANTAO),
    granae: new Pagina('granae', 'granae.html', EXPORTA_GRANAE, SEMEIA_GRANAE)
  };
  var cofre = {
    demo: DEMO,
    plantao: lerPlantao({}), granae: lerGranae({}),
    temPlantoes: false, temDinheiro: false,
    guardadoEm: { plantao: null, granae: null },
    versao: 0,
    paginas: paginas
  };
  var online = W.navigator.onLine !== false;
  var pedidas = {}, encerrado = false, donoAtual = null;

  function avisa(o) { cofre.versao++; D.dispatchEvent(new CustomEvent('medtech:cofre', { detail: { origem: o } })); }

  function recebeu(nome, s) {
    if (encerrado) return;
    var o; try { o = JSON.parse(s); } catch (e) { console.warn('cofre: exportação ilegível', e); return; }
    /* outra conta entrou neste navegador: o que estava em memória da anterior sai */
    if (o.uid && donoAtual && o.uid !== donoAtual) { cofre.plantao = lerPlantao({}); cofre.granae = lerGranae({}); cofre.temPlantoes = cofre.temDinheiro = false; }
    if (o.uid) donoAtual = o.uid;
    if (nome === 'plantao') { cofre.plantao = lerPlantao(o); cofre.temPlantoes = true; }
    else { cofre.granae = lerGranae(o); cofre.temDinheiro = true; if (DEMO) voltaGc(); }
    cofre.guardadoEm[nome] = new Date();
    avisa(nome);
  }

  /* As páginas abrem só quando a seção é aberta (o Granaê é pesado); na conta real, só depois do login do PWA. */
  function contaPronta() { return DEMO || !!(W.MT && W.MT.user && !W.MT.user.demo); }
  cofre.ligar = function (nome) {
    if (pedidas[nome]) return;
    pedidas[nome] = 1;
    (function espera() {
      if (encerrado) return;
      if (!contaPronta()) { setTimeout(espera, 400); return; }
      // Sem rede a página nem abre: ela gravaria sozinha ao ativar agendados.
      if (online && paginas[nome].fase === 'parada') paginas[nome].abrir();
      else avisa('situacao');
    })();
  };

  cofre.bloqueio = function (nome) {
    if (!online) return 'Sem internet. Para gravar, conecte-se.';
    if (!pedidas[nome]) return 'Abrindo seus dados. Aguarde um instante.';
    switch (paginas[nome].fase) {
      case 'pronta': return null;
      case 'fora': return 'Sua sessão terminou. Entre de novo para gravar.';
      case 'falhou': return 'Não consegui abrir seus dados. Toque em Tentar de novo.';
      default: return 'Abrindo seus dados. Aguarde um instante.';
    }
  };
  /* Texto da faixa de uma tela (textoBloqueio): sem rede diz desde quando é o dado na tela. */
  cofre.textoBloqueio = function (nome) {
    var b = cofre.bloqueio(nome); if (!b) return null;
    var tem = nome === 'plantao' ? cofre.temPlantoes : cofre.temDinheiro;
    if (b.indexOf('Abrindo') === 0) return tem ? null : b;
    var q = cofre.guardadoEm[nome];
    if (b.indexOf('Sem internet') === 0 && q) return b + ' Você está vendo o que foi carregado às ' + String(q.getHours()).padStart(2, '0') + ':' + String(q.getMinutes()).padStart(2, '0') + '.';
    return b;
  };
  cofre.podeTentar = function (nome) { return online && (paginas[nome].fase === 'falhou'); };
  cofre.tentarDeNovo = function (nome) { if (online && !encerrado) paginas[nome].abrir(); };

  /* gravação em fila (uma de cada vez) */
  var fila = Promise.resolve();
  function emFila(nome, corpo, args) {
    var b = cofre.bloqueio(nome);
    if (b) return Promise.reject(new Error(b));
    var t = fila.then(function () { return paginas[nome].agir(corpo, args); });
    fila = t.catch(function () { });
    return t;
  }
  function P(corpo, a) { return emFila('plantao', corpo, a); }
  function G(corpo, a) { return emFila('granae', corpo, a); }

  cofre.salvarPlantao = function (r) { return P(JS.salvarPlantao, { r: { date: r.date, local: r.local, start: r.start, end: r.end, value: r.value, status: r.status, note: r.note }, id: r.id || '' }); };
  cofre.alternarPago = function (id) { return P(JS.alternarPago, { id: id }); };
  cofre.excluirPlantao = function (id) { return P(JS.excluirPlantao, { id: id }); };
  cofre.restaurarPlantao = function (copia) { return P(JS.restaurarPlantao, { copia: copia }); };
  cofre.duplicarPlantao = function (id) { return P(JS.duplicarPlantao, { id: id }).then(function (s) { return s.replace(/"/g, ''); }); };
  cofre.colarDia = function (itens, dia) {
    return P(JS.colarDia, { itens: itens.map(function (s) { return { local: s.local, start: s.start || '', end: s.end || '', value: s.value || 0, note: s.note || '' }; }), ds: dia });
  };
  cofre.definirCompDay = function (v) { return P(JS.definirCompDay, { v: v }); };
  cofre.salvarRegra = function (local, dia, mes) { return P(JS.salvarRegra, { local: local || '', d: dia, m: mes }); };
  cofre.limparRegra = function (local) { return P(JS.limparRegra, { local: local }); };

  cofre.salvarLancamento = function (r) {
    return G(JS.salvarLancamento, { r: { type: r.type, amount: r.amount, description: r.description, category: r.category, date: r.date, sub: r.sub || '', accountId: r.accountId || '', parcelas: r.parcelas || 1, porTotal: !!r.porTotal }, id: r.id || '' });
  };
  cofre.excluirLancamento = function (id) { return G(JS.excluirLancamento, { id: id }); };
  cofre.restaurarLancamento = function (copia) { return G(JS.restaurarLancamento, { copia: copia }); };
  cofre.duplicarLancamentoHoje = function (id) { return G(JS.duplicarLancamento, { id: id }); };
  cofre.registrarPagamento = function (compromisso, modo, valor, data, conta) { return G(JS.registrarPagamento, { alvo: compromisso, modo: modo, valor: valor, data: data, conta: conta || '' }); };
  cofre.salvarFixo = function (r) { return G(JS.salvarFixo, { r: { type: r.type, name: r.name, amount: r.amount, category: r.category, frequency: r.frequency, month: r.month }, id: r.id || '' }); };
  cofre.excluirFixo = function (id) { return G(JS.excluirFixo, { id: id }); };
  cofre.definirTeto = function (categoria, valor) { return G(JS.definirTeto, { id: categoria, v: valor }); };
  /* Finanças nova */
  cofre.alternarFaturaPaga = function (conta, mes) { return G(JS.alternarFaturaPaga, { id: conta, mes: mes }); };
  cofre.transferir = function (r) { return G(JS.transferir, { r: { de: r.de, para: r.para, valor: r.valor, data: r.data, descricao: r.descricao || '' } }); };
  cofre.informarSaldo = function (chave, valor) { return G(JS.informarSaldo, { chave: chave, valor: valor == null ? null : +valor }); };
  cofre.novoFinanciamento = function (r) { return G(JS.novoFinanciamento, { r: { descricao: r.descricao, n: r.n, parcela: r.parcela, valorFinanciado: r.valorFinanciado || '', taxa: r.taxa || '', category: r.category, date: r.date, accountId: r.accountId || '' } }); };
  cofre.novaDivida = function (r) { return G(JS.novaDivida, { r: { descricao: r.descricao, credor: r.credor || '', total: r.total, category: r.category || 'Dívidas' } }); };
  cofre.salvarConta = function (r) { return G(JS.salvarConta, { r: { kind: r.kind, name: r.name, color: r.color || '', saldoInicial: r.saldoInicial || 0, fechamento: r.fechamento || '', vencimento: r.vencimento || '', limite: r.limite || '', orcamento: r.orcamento || '' }, id: r.id || '' }); };
  cofre.categorizar = function (id, cat, regra) { return G(JS.categorizar, { id: id, cat: cat, regra: regra || '' }).then(function (n) { return +n || 0; }); };
  cofre.lancarVoz = function (r) { return G(JS.lancarVoz, { r: { type: r.type, amount: r.amount, description: r.description, category: r.category, date: r.date } }); };
  cofre.importarFatura = function (itens) { return G(JS.importarFatura, { itens: itens.map(function (i) { return { amount: i.amount, description: i.description, category: i.category, date: i.date }; }) }).then(function (n) { return +n || 0; }); };
  /* leituras pela página (IA, voz, fatura, sincronizar o banco) */
  cofre.consultar = function (nome, args) {
    var b = cofre.bloqueio('granae'); if (b) return Promise.reject(new Error(b));
    return paginas.granae.consultar(nome, args);
  };

  /* rede e volta para a frente */
  function mudouRede(ok) {
    var antes = online; online = ok;
    if (encerrado) return;
    Object.keys(paginas).forEach(function (k) {
      paginas[k].avisarRede(ok);
      if (ok && !antes && pedidas[k] && paginas[k].fase !== 'pronta') paginas[k].abrir();
    });
    avisa('situacao');
  }
  W.addEventListener('online', function () { mudouRede(true); });
  W.addEventListener('offline', function () { mudouRede(false); });
  D.addEventListener('visibilitychange', function () {
    if (D.visibilityState !== 'visible' || encerrado || !online) return;
    Object.keys(paginas).forEach(function (k) { if (pedidas[k] && paginas[k].fase === 'falhou') paginas[k].abrir(); });
  });
  W.addEventListener('pagehide', function () { if (DEMO) voltaGc(); });

  /* Saída da conta: as páginas fecham antes, e nada do dinheiro dela fica na memória. */
  cofre.encerrar = function () {
    encerrado = true;
    Object.keys(paginas).forEach(function (k) { paginas[k].parar(); });
    cofre.plantao = lerPlantao({}); cofre.granae = lerGranae({});
    cofre.temPlantoes = cofre.temDinheiro = false;
    avisa('situacao');
  };
  (function vigiaSaida() {
    if (DEMO) return;
    if (!W.MT || !W.MT.signOut) { setTimeout(vigiaSaida, 300); return; }
    if (W.MT.signOut.__cofre) return;
    var sair = W.MT.signOut;
    W.MT.signOut = function () { cofre.encerrar(); return sair.apply(this, arguments); };
    W.MT.signOut.__cofre = true;
  })();

  cofre._ler = { plantao: lerPlantao, granae: lerGranae };
  W.MTCofre = cofre;
})();
