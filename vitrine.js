/* Vitrine MedTech — comportamento compartilhado. Páginas montadas por _gera_vitrine.py.
   v6 (23/09/2026): herói com palco de aparelhos, vitrine de apps, galerias com abas,
   ampliação de imagens, calculadora de planos (lê planos.json), números animados. */
(()=>{
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const PARADO=matchMedia('(prefers-reduced-motion:reduce)').matches;
const IMG='img/vitrine/';
const SVG={
  esq:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
  dir:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'
};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
/* imagem com variante leve: telas de celular têm -500, de computador -800 */
function srcset(n){
  if(/-390$/.test(n))return {src:IMG+n+'-500.webp',set:`${IMG}${n}-500.webp 500w, ${IMG}${n}.webp 780w`,full:IMG+n+'.webp'};
  if(/^casos-/.test(n))return {src:IMG+n+'-800.webp',set:`${IMG}${n}-800.webp 800w, ${IMG}${n}.webp 1200w`,full:IMG+n+'.webp'};
  return {src:IMG+n+'-800.webp',set:`${IMG}${n}-800.webp 800w, ${IMG}${n}.webp 1600w`,full:IMG+n+'.webp'};
}
function imgTag(n,alt,sizes,cls,eager){const s=srcset(n);return `<img${cls?` class="${cls}"`:''} src="${s.src}" srcset="${s.set}" sizes="${sizes}" data-full="${s.full}" alt="${esc(alt)}" loading="${eager?'eager':'lazy'}" decoding="async">`}

/* ---------- catálogo usado nas vitrines ---------- */
const APPS=[
 {id:'enfermaria',nm:'EnfermarIA',ic:'ti-bed',g:'hosp',img:'enfermaria-390',url:'enfermaria.html',d:'Os internados por leito, com as pendências de cada um e a evolução extraída por IA.'},
 {id:'condutai',nm:'CondutAI',ic:'ti-stethoscope',g:'clin',img:'condutai-390',url:'condutai.html',d:'274 condutas completas e aprofundadas, e uma IA que responde com busca em diretrizes atuais.'},
 {id:'atbguia',nm:'ATBguia',ic:'ti-pill',g:'clin',img:'atbguia-390',url:'atbguia.html',d:'Antibioticoterapia empírica e dirigida, ajuste para a função renal e bulário.'},
 {id:'calcmed',nm:'CalcMed',ic:'ti-calculator',g:'clin',img:'calcmed-390',url:'calcmed.html',d:'64 calculadoras e escores clínicos validados, com a interpretação ao lado do resultado.'},
 {id:'paliai',nm:'PaliAI',ic:'ti-heart-handshake',g:'clin',img:'paliai-390',url:'paliai.html',d:'Triagem de cuidados paliativos em 2 minutos e roteiro para a reunião com a família.'},
 {id:'guiainterno',nm:'Guia do Interno',ic:'ti-school',g:'clin',img:'guiainterno-390',url:'guiainterno.html',d:'O manual de bolso do internato: admissão, evolução, plantão e SBAR, com um mentor de IA.'},
 {id:'pocusai',nm:'PocusAI',ic:'ti-scan',g:'hosp',img:'pocusai-390',url:'pocusai.html',d:'Ultrassom à beira-leito, região por região: onde pôr o transdutor, o que ver e o que fazer.'},
 {id:'laudai',nm:'LaudAI',ic:'ti-report-medical',g:'hosp',img:'laudai-390',url:'laudai.html',d:'Laudos estruturados, com a IA como segunda opinião do radiologista.'},
 {id:'foco',nm:'Foco',ic:'ti-target-arrow',g:'rotina',img:'foco-390',url:'foco.html',d:'Demandas e agenda do médico, com priorização por IA.'},
 {id:'plantaohub',nm:'PlantãoHub',ic:'ti-clock',g:'rotina',img:'plantaohub-390',url:'plantaohub.html',d:'Plantões, horas e quanto você tem a receber, mês a mês.'},
 {id:'granae',nm:'Granaê',ic:'ti-wallet',g:'rotina',img:'granae-390',url:'granae.html',d:'As finanças do médico por voz e pela foto da fatura, com leitura por IA.'},
 {id:'logbook',nm:'Logbook',ic:'ti-notebook',g:'rotina',img:'logbook-390',url:'logbook.html',d:'Procedimentos e casos do residente, com contadores e exportação em planilha.'}
];
const PROVAS=[
 {id:'clinicamed',nm:'ClínicaMed',ic:'ti-heartbeat',img:'clinicamed-390',url:'clinicamed/',d:'Título de Clínica Médica e acesso ao R+: banco extenso de questões de provas reais, comentadas, leituras longas e acompanhamento de turma pela coordenação.'},
 {id:'trafegotitulo',nm:'TráfegoTítulo',ic:'ti-car',img:'trafego-390',url:'trafego-titulo/',d:'Título de Medicina do Tráfego, no formato da prova, com o conteúdo amarrado ao edital e às normas de trânsito vigentes.'},
 {id:'flashmed',nm:'FlashMed',ic:'ti-cards',img:'flashmed-390',url:'flashmed.html',d:'Questões e simulados de residência, com a procedência de cada questão.'},
 {id:'medprovas',nm:'MedProvas',ic:'ti-clipboard-text',img:'medprovas-390',url:'medprovas.html',d:'Para o professor: elabore e corrija provas com IA, a partir do conteúdo da sua disciplina.'}
];
const INST=[
 {nm:'Sistema Hospitalar (HospSys)',ic:'ti-building-hospital',url:'hospsys.html',d:'Prontuário, prescrição, leitos, bloco, farmácia e faturamento, dentro do hospital.'},
 {nm:'Faturamento',ic:'ti-zoom-money',url:'faturamento.html',d:'A IA cruza prontuário e conta; depois, a equipe é treinada para a glosa não voltar.'},
 {nm:'Capacita',ic:'ti-certificate-2',url:'capacita.html',d:'Treinamentos assistenciais no celular, acompanhados pela instituição.'},
 {nm:'Casos Clínicos',ic:'ti-user-heart',url:'casos.html',d:'Casos que evoluem conforme as decisões do aluno.'},
 {nm:'Clinicar',ic:'ti-calendar-heart',url:'clinicar.html',d:'Agenda, prontuário e financeiro da clínica, no navegador.'},
 {nm:'Internato e residência',ic:'ti-users-group',url:'internato.html',d:'Escalas, rodízios, termos e avaliações do ensino em serviço.'},
 {nm:'Sob medida',ic:'ti-code',url:'sobmedida.html',d:'Sistemas feitos para o fluxo do seu serviço.'}
];
const BENCH={
 'Conteúdo clínico':[['Condutas completas',274,300],['Calculadoras e escores',64,300],['Aplicativos com IA',13,300,'dim']],
 'Hospital':[['Exames lab + imagem',280,300,'','~280'],['Medicamentos no catálogo',140,300,'','~140'],['Especialidades de interconsulta',44,300],['Módulos do HospSys',13,300,'dim']]
};

/* ---------- ampliação de imagens (lightbox) ---------- */
const lbx=document.createElement('div');lbx.className='lbx';lbx.setAttribute('role','dialog');lbx.setAttribute('aria-modal','true');lbx.setAttribute('aria-label','Imagem ampliada');
lbx.innerHTML=`<button class="x" aria-label="Fechar">${SVG.x}</button><button class="pv" aria-label="Anterior">${SVG.esq}</button><button class="nx" aria-label="Próxima">${SVG.dir}</button><img alt=""><div class="cap"></div><div class="n"></div>`;
document.body.appendChild(lbx);
let lbSet=[],lbI=0,lbVolta=null;
function lbShow(){const im=lbSet[lbI];const L=$('img',lbx);L.src=im.dataset.full||im.currentSrc||im.src;L.alt=im.alt;$('.cap',lbx).textContent=im.alt||'';$('.n',lbx).textContent=lbSet.length>1?`${lbI+1} de ${lbSet.length}`:'';$('.pv',lbx).hidden=$('.nx',lbx).hidden=lbSet.length<2}
function lbOpen(img){const grp=img.closest('[data-lb]')||img.closest('.xf')||img.closest('.shots,.mosaic,.desk,.frame,section')||document.body;lbSet=$$('img',grp).filter(i=>i.closest('.xf')?true:i.offsetParent!==null);lbI=Math.max(0,lbSet.indexOf(img));lbVolta=document.activeElement;lbShow();lbx.classList.add('on');document.body.classList.add('lbx-open');$('.x',lbx).focus()}
function lbClose(){lbx.classList.remove('on');document.body.classList.remove('lbx-open');if(lbVolta&&lbVolta.focus)lbVolta.focus()}
function lbStep(d){lbI=(lbI+d+lbSet.length)%lbSet.length;lbShow()}
$('.x',lbx).onclick=lbClose;$('.pv',lbx).onclick=()=>lbStep(-1);$('.nx',lbx).onclick=()=>lbStep(1);
lbx.addEventListener('click',e=>{if(e.target===lbx)lbClose()});
addEventListener('keydown',e=>{if(!lbx.classList.contains('on'))return;if(e.key==='Escape')lbClose();else if(e.key==='ArrowLeft')lbStep(-1);else if(e.key==='ArrowRight')lbStep(1)});
let tx0=null;lbx.addEventListener('touchstart',e=>{tx0=e.touches[0].clientX},{passive:true});
lbx.addEventListener('touchend',e=>{if(tx0==null)return;const dx=e.changedTouches[0].clientX-tx0;if(Math.abs(dx)>50)lbStep(dx<0?1:-1);tx0=null});
document.addEventListener('click',e=>{
  const img=e.target.closest('.phone .scr img, .desk img, .mosaic img, .zoomable img, .frame .xf img.on, .show-dev .xf img.on');
  if(img){e.preventDefault();lbOpen(img);return}
  const xf=e.target.closest('.frame .xf, .show-dev .xf');if(xf){const on=$('img.on',xf);if(on){e.preventDefault();lbOpen(on)}}
});

/* ---------- troca com esmaecimento (pilha .xf) ---------- */
function xfShow(box,i){$$('img',box).forEach((im,k)=>im.classList.toggle('on',k===i))}

/* ---------- herói da home: palco com as três linhas ---------- */
const LINHAS3=[
 {k:'app',nm:'MedTech App',url:'medtech-app.html',t:'Os apps do médico assistencial, numa conta só.',desk:['portal-1440','condutai-1440','enfermaria-1440','granae-1440'],ph:['enfermaria-390','condutai-390','atbguia-390','plantaohub-390']},
 {k:'provas',nm:'MedTech Provas',url:'medtech-provas.html',t:'Plataformas de estudo construídas em cima do edital.',desk:['clinicamed-1440','provas-1440','medprovas-1440'],ph:['clinicamed-390','trafego-390','flashmed-390']},
 {k:'inst',nm:'MedTech Institucional',url:'institucional.html',t:'Sistema hospitalar, auditoria de faturamento e treinamentos para a instituição.',desk:['hospsys-mapa','auditoria-fat','capacita-painel','hospsys-pront'],ph:['capacita-390']}
];
const ALT={'portal-1440':'MedTech App: a página inicial com os apps do médico','condutai-1440':'CondutAI no computador','enfermaria-1440':'EnfermarIA no computador: internados por leito','granae-1440':'Granaê no computador: finanças do mês','clinicamed-1440':'ClínicaMed no computador','provas-1440':'Portal MedTech Provas','medprovas-1440':'MedProvas: prova montada com IA','hospsys-mapa':'HospSys: mapa de leitos por setor','auditoria-fat':'Auditoria de faturamento: glosa e rejeição por competência','capacita-painel':'Capacita: adesão aos treinamentos por categoria e setor','hospsys-pront':'HospSys: prontuário do paciente','enfermaria-390':'EnfermarIA no celular','condutai-390':'CondutAI no celular','atbguia-390':'ATBguia no celular','plantaohub-390':'PlantãoHub no celular','clinicamed-390':'ClínicaMed no celular','trafego-390':'TráfegoTítulo no celular','flashmed-390':'FlashMed no celular','capacita-390':'Capacita no celular: os treinamentos do colaborador'};
const hero=$('#hero'),stage=$('#stage3');
if(stage){
  const lsw=$('#lsw'),dk=$('.dk .xf',stage),ph=$('.ph .xf',stage),cap=$('.stcap',stage);
  const DUR=7000,QUADRO=2330;let li=0,fi=0,tLinha=0,tQuadro=0,auto=!PARADO,visivel=true;
  lsw.style.setProperty('--dur',DUR+'ms');
  /* o palco está na primeira dobra: as imagens carregam já (lazy não dispararia enquanto invisíveis) */
  function monta(L){dk.innerHTML=L.desk.map((n,i)=>imgTag(n,ALT[n]||L.nm,'(max-width:900px) 92vw, 560px',i?'':'on',true)).join('');ph.innerHTML=L.ph.map((n,i)=>imgTag(n,ALT[n]||L.nm,'200px',i?'':'on',true)).join('')}
  function linha(i,user){li=i;fi=0;const L=LINHAS3[i];monta(L);cap.href=L.url;cap.innerHTML=`<b>${L.nm}</b><span>${L.t}</span><span class="go">Conhecer ${SVG.dir.replace('<svg','<svg width="14" height="14"')}</span>`;
    $$('button',lsw).forEach((b,k)=>{b.classList.toggle('on',k===i);b.setAttribute('aria-selected',k===i)});
    if(user){auto=false;lsw.classList.add('parado')}
    agenda()}
  function quadro(){const L=LINHAS3[li];fi++;xfShow(dk,fi%L.desk.length);xfShow(ph,fi%L.ph.length)}
  function agenda(){clearTimeout(tLinha);clearInterval(tQuadro);if(!visivel)return;tQuadro=setInterval(quadro,QUADRO);if(auto)tLinha=setTimeout(()=>linha((li+1)%LINHAS3.length),DUR)}
  $$('button',lsw).forEach((b,k)=>b.addEventListener('click',()=>linha(k,true)));
  new IntersectionObserver(es=>es.forEach(x=>{visivel=x.isIntersecting;if(visivel)agenda();else{clearTimeout(tLinha);clearInterval(tQuadro)}})).observe(stage);
  linha(0);
  if(PARADO){auto=false;lsw.classList.add('parado')}
  /* brilho acompanha o ponteiro (sutil) */
  const orb=$('#orb'),core=$('#core'),ring=$('#ring');
  if(!PARADO&&orb&&matchMedia('(hover:hover)').matches){let mx=0,my=0,tx=0,ty=0,raf=0,on=false;
    addEventListener('pointermove',e=>{tx=e.clientX/innerWidth-.5;ty=e.clientY/innerHeight-.5;if(!on){on=true;raf=requestAnimationFrame(f)}},{passive:true});
    function f(t){mx+=(tx-mx)*.06;my+=(ty-my)*.06;orb.style.transform=`translate(calc(-50% + ${mx*40}px),calc(-50% + ${my*40}px))`;core.style.transform=`translate(calc(-50% + ${mx*90}px),calc(-50% + ${my*90}px))`;ring.style.transform=`translate(-50%,-50%) rotate(${t/1000*9}deg)`;
      if(Math.abs(tx-mx)+Math.abs(ty-my)>.001||scrollY<innerHeight)raf=requestAnimationFrame(f);else on=false}}
}

/* ---------- mural de ícones ---------- */
const wall=$('#wall');
if(wall){const it=(a,href)=>`<a href="${href}"><span class="k"><i class="ti ${a.ic}"></i></span>${esc(a.nm)}<span class="tip" role="tooltip"><b>${esc(a.nm)}</b>${esc(a.d)}</span></a>`;
  wall.innerHTML=`<div class="grp">MedTech App</div>`+APPS.map(a=>it(a,'medtech-app.html#app='+a.id)).join('')+
    `<div class="grp">MedTech Provas</div>`+PROVAS.map(a=>it(a,'medtech-provas.html#app='+a.id)).join('')+
    `<div class="grp">MedTech Institucional</div>`+INST.map(a=>it(a,a.url)).join('')}

/* ---------- vitrine de apps (lista + celular) ---------- */
function vitrine(el,items,opts){
  const L=$('.show-l',el),dev=$('.show-dev .xf',el),cap=$('.show-cap',el);let i=0,auto=!PARADO,t=0,vis=false;const DUR=opts.dur||6000;
  el.style.setProperty('--dur',DUR+'ms');
  L.innerHTML=items.map((a,k)=>`<button role="tab" aria-selected="false" data-k="${k}" data-g="${a.g||''}"><span class="k"><i class="ti ${a.ic}"></i></span><span><b>${esc(a.nm)}</b><small>${esc(a.d)}</small></span><span class="pg"></span></button>`).join('');
  dev.innerHTML=items.map(a=>`<img src="${IMG}${a.img}-500.webp" data-full="${IMG}${a.img}.webp" alt="${esc(a.nm)} no celular, com dados fictícios" loading="lazy" decoding="async">`).join('');
  const vis2=()=>$$('button',L).filter(b=>!b.classList.contains('hide'));
  function mostra(k,user){i=k;const a=items[k];xfShow(dev,k);
    $$('button',L).forEach(b=>{const on=+b.dataset.k===k;b.classList.toggle('on',on);b.setAttribute('aria-selected',on)});
    const vs=vis2(),pos=vs.findIndex(b=>+b.dataset.k===k);
    cap.innerHTML=`<h3>${esc(a.nm)}</h3><p>${esc(a.d)}</p><div class="row"><a class="pill solid" href="${a.url}">Abrir o ${esc(a.nm)}</a>${opts.cta||''}</div><div class="ctr"><button class="ant" aria-label="Anterior">${SVG.esq}</button><button class="prox" aria-label="Próximo">${SVG.dir}</button><span class="cnt">${pos+1} de ${vs.length}</span></div>`;
    $('.ant',cap).onclick=()=>passo(-1,true);$('.prox',cap).onclick=()=>passo(1,true);
    const btn=$(`button[data-k="${k}"]`,L);if(user&&btn&&getComputedStyle(L).flexDirection==='row')L.scrollTo({left:btn.offsetLeft-20,behavior:'smooth'});
    if(user){auto=false;el.classList.add('parado')}
    agenda()}
  function passo(d,user){const vs=vis2();const p=vs.findIndex(b=>+b.dataset.k===i);const nx=vs[(p+d+vs.length)%vs.length];mostra(+nx.dataset.k,user)}
  function agenda(){clearTimeout(t);if(auto&&vis)t=setTimeout(()=>passo(1),DUR)}
  L.addEventListener('click',e=>{const b=e.target.closest('button');if(b)mostra(+b.dataset.k,true)});
  L.addEventListener('keydown',e=>{if(e.key==='ArrowDown'||e.key==='ArrowRight'){e.preventDefault();passo(1,true);$('button.on',L).focus()}if(e.key==='ArrowUp'||e.key==='ArrowLeft'){e.preventDefault();passo(-1,true);$('button.on',L).focus()}});
  el.addEventListener('pointerenter',()=>clearTimeout(t));el.addEventListener('pointerleave',agenda);
  new IntersectionObserver(es=>es.forEach(x=>{vis=x.isIntersecting;agenda()}),{threshold:.25}).observe(el);
  const fch=opts.chips&&$(opts.chips);
  if(fch)fch.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;$$('button',fch).forEach(x=>x.classList.toggle('on',x===b));const f=b.dataset.f;
    $$('button',L).forEach(x=>x.classList.toggle('hide',f!=='all'&&x.dataset.g!==f));const vs=vis2();if(vs.length)mostra(+vs[0].dataset.k,true)});
  /* chegada por link do mural: #app=<id> */
  const m=location.hash.match(/app=([a-z0-9-]+)/);const k0=m?items.findIndex(a=>a.id===m[1]):-1;
  mostra(k0>=0?k0:0,k0>=0);if(k0>=0)setTimeout(()=>el.scrollIntoView({behavior:PARADO?'auto':'smooth',block:'start'}),60);
}
if($('#showApp'))vitrine($('#showApp'),APPS,{chips:'#chipsApp',cta:'<a class="pill ghost" href="index.html#planos">Planos</a>'});
if($('#showProvas'))vitrine($('#showProvas'),PROVAS,{dur:7000,cta:'<a class="pill ghost" href="provas.html">Portal Provas</a>'});

/* ---------- galerias com abas / passo a passo ---------- */
$$('[data-gal]').forEach(g=>{
  const bts=$$('.gt button, .stp button',g),box=$('.xf',g),gd=$('.gd',g);
  box.innerHTML=bts.map((b,k)=>imgTag(b.dataset.src,b.dataset.alt||b.textContent.trim(),'(max-width:900px) 92vw, 820px',k?'':'on',k>0)).join('');
  function vai(k){bts.forEach((b,j)=>{b.classList.toggle('on',j===k);b.setAttribute('aria-selected',j===k)});xfShow(box,k);
    if(gd){const b=bts[k];gd.innerHTML=`<b>${esc(b.dataset.t||b.textContent.trim())}</b><p>${esc(b.dataset.d||'')}</p><div class="n">Toque na imagem para ampliar · ${k+1} de ${bts.length}</div>`}}
  bts.forEach((b,k)=>{b.setAttribute('role','tab');b.addEventListener('click',()=>vai(k))});vai(0);
});

/* ---------- calculadora de planos (preços vêm do planos.json) ---------- */
const PLANOS_PADRAO={produtos:[
 {id:'app-1',curto:'1 app',linha:'clinica',apps:1,resumo:'Escolha o app que resolve a sua maior dor. IA incluída.',preco:{mensal:29.9},checkout:{}},
 {id:'app-2',curto:'2 apps',linha:'clinica',apps:2,resumo:'A dupla que você usa todo dia. IA incluída.',preco:{mensal:49.9},checkout:{}},
 {id:'app-tudo',curto:'Tudo',linha:'clinica',apps:'tudo',destaque:true,resumo:'Os 12 apps do MedTech App, com a IA incluída. No anual, 2 meses grátis.',preco:{mensal:89.9,anual:899},checkout:{}}],teste_dias:7};
const brl=v=>v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
async function planos(){try{const r=await fetch('planos.json',{cache:'no-cache'});if(r.ok)return await r.json()}catch(e){}return PLANOS_PADRAO}
const calc=$('#calc');
if(calc)planos().then(P=>{
  const prods=(P.produtos||[]).filter(p=>p.linha==='clinica'&&!p.interno);if(!prods.length)return;
  let per='mensal',sel=(prods.find(p=>p.destaque)||prods[0]).id,escolha=[];
  const temAnual=prods.some(p=>p.preco&&p.preco.anual);
  calc.innerHTML=`${temAnual?`<div class="seg" role="tablist" aria-label="Período"><button class="on" data-p="mensal">Mensal</button><button data-p="anual">Anual<small>2 meses grátis</small></button></div>`:''}
   <div class="pcs" role="radiogroup" aria-label="Plano"></div><div class="pick" hidden></div><div class="sumr"></div>`;
  const pcs=$('.pcs',calc),pick=$('.pick',calc),sumr=$('.sumr',calc);
  function desenha(){
    pcs.innerHTML=prods.map(p=>{const v=p.preco[per];const ok=v!=null;
      const eq=per==='anual'&&ok?`equivale a ${brl(v/12)} por mês`:(per==='anual'?'só no plano mensal':'');
      return `<button class="pc${p.id===sel?' on':''}" role="radio" aria-checked="${p.id===sel}" data-id="${p.id}"${ok?'':' disabled'}><span class="nm">${esc(p.curto)}${p.destaque?'<span class="chip">mais escolhido</span>':''}</span><span class="vl">${ok?brl(v):'—'}${ok?`<small>/${per==='anual'?'ano':'mês'}</small>`:''}</span><span class="eq">${eq}</span><span class="ds">${esc(p.resumo||'')}</span></button>`}).join('');
    const p=prods.find(x=>x.id===sel);const n=typeof p.apps==='number'?p.apps:0;
    if(n){escolha=escolha.slice(0,n);pick.hidden=false;
      pick.innerHTML=`<div class="ph"><span>Escolha ${n===1?'o app':'os '+n+' apps'} do plano</span><b>${escolha.length} de ${n}</b></div><div class="ag">${APPS.map(a=>`<button data-id="${a.id}" class="${escolha.includes(a.id)?'on':''}"${!escolha.includes(a.id)&&escolha.length>=n?' disabled':''} aria-pressed="${escolha.includes(a.id)}"><span class="k"><i class="ti ${a.ic}"></i></span>${esc(a.nm)}</button>`).join('')}</div>`}
    else pick.hidden=true;
    const v=p.preco[per];const venda=p.checkout&&p.checkout[per];
    const q=new URLSearchParams({plano:p.id,periodo:per});if(n&&escolha.length)q.set('apps',escolha.join(','));
    const nomes=n?(escolha.length?escolha.map(id=>APPS.find(a=>a.id===id).nm).join(' + '):'escolha acima'):'os 12 apps';
    sumr.innerHTML=`<div class="t"><b>${esc(p.curto)} · ${per==='anual'?'anual':'mensal'} · ${v!=null?brl(v):''}</b>${esc(nomes)}. Comece com ${P.teste_dias||7} dias grátis de tudo; assine quando fizer sentido.</div><div class="row"><a class="pill solid" href="app.html?${q}">${venda?'Assinar':'Começar grátis'}</a><a class="pill ghost" href="app.html">Criar conta</a></div>`;
  }
  calc.addEventListener('click',e=>{const s=e.target.closest('.seg button');if(s){per=s.dataset.p;$$('.seg button',calc).forEach(b=>b.classList.toggle('on',b===s));const p=prods.find(x=>x.id===sel);if(p.preco[per]==null)sel=(prods.find(x=>x.preco[per]!=null)||p).id;desenha();return}
    const c=e.target.closest('.pc');if(c&&!c.disabled){sel=c.dataset.id;desenha();return}
    const a=e.target.closest('.ag button');if(a&&!a.disabled){const id=a.dataset.id;escolha=escolha.includes(id)?escolha.filter(x=>x!==id):escolha.concat(id);desenha()}});
  desenha();
  /* preços das plataformas de prova */
  const pv=$('#provasPreco');if(pv){const pp=(P.produtos||[]).filter(p=>p.linha==='provas'&&!p.interno);
    pv.innerHTML=pp.map(p=>{const v=p.preco&&(p.preco.anual||p.preco.mensal);return `<span>${esc(p.curto)}${v?` · ${brl(v)}`:''}</span>`}).join(' · ')}
});

/* ---------- números que contam ao aparecer ---------- */
function conta(el){const alvo=+el.dataset.n,suf=el.dataset.s||'';if(PARADO){el.textContent=alvo.toLocaleString('pt-BR')+suf;return}const t0=performance.now(),d=1100;
  (function f(t){const p=Math.min(1,(t-t0)/d),e=1-Math.pow(1-p,3);el.textContent=Math.round(alvo*e).toLocaleString('pt-BR')+suf;if(p<1)requestAnimationFrame(f)})(t0)}
const numIO=new IntersectionObserver(es=>es.forEach(x=>{if(x.isIntersecting){conta(x.target);numIO.unobserve(x.target)}}),{threshold:.6});
$$('[data-n]').forEach(el=>numIO.observe(el));

/* ---------- barras de números ---------- */
const barsEl=$('#bars');
function renderBench(key){if(!barsEl)return;
  barsEl.innerHTML=BENCH[key].map(([l,v,max,cls,lab])=>`<div class="bar ${cls||''}"><span class="l">${l}</span><span class="tr"><span class="fl" data-w="${Math.max(4,Math.round(v/max*100))}"></span></span><span class="v">${lab||v}</span></div>`).join('');
  requestAnimationFrame(()=>requestAnimationFrame(()=>$$('.fl',barsEl).forEach(f=>f.style.width=f.dataset.w+'%')));
}
$$('#bench .t button').forEach(s=>s.addEventListener('click',()=>{$$('#bench .t button').forEach(x=>{x.classList.toggle('on',x===s);x.setAttribute('aria-selected',x===s)});renderBench(s.textContent)}));
if(barsEl)renderBench('Conteúdo clínico');

/* ---------- cabeçalho / barra de produtos / linha ativa ---------- */
const hdr=$('#hdr'),pbw=$('#pbarw');
function onScroll(){const y=scrollY;hdr.classList.toggle('solid',y>40);pbw.classList.toggle('show',hero?y>innerHeight*0.6:true)}
addEventListener('scroll',onScroll,{passive:true});onScroll();
const linhaAtual=document.body.dataset.linha||'';
$$('[data-linha]').forEach(a=>a.classList.toggle('on',!!linhaAtual&&a.dataset.linha===linhaAtual));
/* a home era uma página só, com âncoras por produto; quem chega por um link antigo vai para a página nova */
if(document.body.dataset.home!==undefined){
  const R={app:'medtech-app.html',provas:'medtech-provas.html',institucional:'institucional.html',hospitalar:'hospsys.html',faturamento:'faturamento.html',casos:'casos.html',capacita:'capacita.html',internato:'internato.html',sobmedida:'sobmedida.html'};
  const h=decodeURIComponent(location.hash.slice(1));if(R[h])location.replace(R[h]);
}

/* ---------- reveal ---------- */
const rv=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');rv.unobserve(e.target)}}),{threshold:.12});
$$('.rv').forEach(el=>rv.observe(el));
})();
