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
  var EXPORTA_GRANAE = 'window.__cofre.exportar=function(){var ids=function(l){return (l||[]).map(function(x){return Object.assign({},x,{id:String(x.id)})})};return JSON.stringify({uid:(MT.user&&MT.user.uid)||"",transactions:ids(state.transactions),categories:ids(state.categories),fixedItems:ids(state.fixedItems),commitments:ids(state.commitments),accounts:ids(state.accounts).map(function(a){return {id:a.id,name:a.name,kind:a.kind}})})};';

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
      "  for(let k=0;k<nPar;k++){\n" +
      "    const d=new Date(base);d.setMonth(base.getMonth()+k);\n" +
      "    if(d.getDate()!==base.getDate())d.setDate(0);\n" +
      "    const ds=d.toISOString().slice(0,10);\n" +
      "    const p=stampTx({id:cid(),type:obj.type,amount:obj.amount,description:`${obj.description} (${k+1}/${nPar})`,category:obj.category,date:ds,groupId:gid,sub:obj.sub,accountId:obj.accountId});\n" +
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
    definirTeto: "const cat=state.categories.find(c=>String(c.id)===id);if(!cat)throw new Error('nao-achou');cat.goal=Math.max(0,parseFloat(v)||0)||null;cat.updatedAt=Date.now();saveState();"
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
    "saveState();";

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
    return {
      uid: txt(o.uid) || '',
      transactions: (o.transactions || []).map(function (t) {
        return { id: txt(t.id) || '', type: txt(t.type) || 'expense', amount: num(t.amount) || 0, description: txt(t.description) || '', category: txt(t.category) || '', date: txt(t.date) || '',
          pending: t.pending === true, groupId: txt(t.groupId), sub: txt(t.sub), accountId: txt(t.accountId), transferId: txt(t.transferId) };
      }),
      categories: (o.categories || []).map(function (c) { return { id: txt(c.id) || '', name: txt(c.name) || '', type: txt(c.type) || 'expense', goal: num(c.goal) }; }),
      fixedItems: (o.fixedItems || []).map(function (f) {
        var m = num(f.month);
        return { id: txt(f.id) || '', type: txt(f.type) || 'expense', name: txt(f.name) || '', amount: num(f.amount) || 0, category: txt(f.category) || '', frequency: txt(f.frequency), month: m == null ? null : Math.trunc(m) };
      }),
      commitments: (o.commitments || []).map(function (c) {
        var n = num(c.nParcelas);
        return { id: txt(c.id) || '', kind: txt(c.kind), descricao: txt(c.descricao), credor: txt(c.credor), total: num(c.total), category: txt(c.category), desde: txt(c.desde),
          nParcelas: n == null ? null : Math.trunc(n), saldoDevedor: num(c.saldoDevedor), accountId: txt(c.accountId) };
      }),
      accounts: (o.accounts || []).map(function (a) { return { id: txt(a.id) || '', name: txt(a.name) || '', kind: txt(a.kind) }; })
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

  /* demonstração: semear uma vez por navegador (ou de novo se a página ficou vazia) */
  var CHAVE_SEMEADO = 'medtech.demo.semeado.';
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
    return G(JS.salvarLancamento, { r: { type: r.type, amount: r.amount, description: r.description, category: r.category, date: r.date, sub: r.sub || '', accountId: r.accountId || '', parcelas: r.parcelas || 1 }, id: r.id || '' });
  };
  cofre.excluirLancamento = function (id) { return G(JS.excluirLancamento, { id: id }); };
  cofre.restaurarLancamento = function (copia) { return G(JS.restaurarLancamento, { copia: copia }); };
  cofre.duplicarLancamentoHoje = function (id) { return G(JS.duplicarLancamento, { id: id }); };
  cofre.registrarPagamento = function (compromisso, modo, valor, data, conta) { return G(JS.registrarPagamento, { alvo: compromisso, modo: modo, valor: valor, data: data, conta: conta || '' }); };
  cofre.salvarFixo = function (r) { return G(JS.salvarFixo, { r: { type: r.type, name: r.name, amount: r.amount, category: r.category, frequency: r.frequency, month: r.month }, id: r.id || '' }); };
  cofre.excluirFixo = function (id) { return G(JS.excluirFixo, { id: id }); };
  cofre.definirTeto = function (categoria, valor) { return G(JS.definirTeto, { id: categoria, v: valor }); };

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
