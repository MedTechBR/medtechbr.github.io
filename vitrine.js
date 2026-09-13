/* Vitrine MedTech — comportamento compartilhado (cabeçalho, barra de produtos, linha ativa, grade de apps, números, herói da home, reveal). Páginas montadas por _gera_vitrine.py */
/* ---------- dados ---------- */
const APPS=[
 {nm:'CondutAI', ic:'ti-stethoscope', g:'clin', d:'274 condutas completas e aprofundadas + IA com busca em diretrizes atuais.'},
 {nm:'ATBguia', ic:'ti-pill', g:'clin', d:'Antibioticoterapia empírica e dirigida, ajuste renal e bulário.'},
 {nm:'EnfermarIA', ic:'ti-bed', g:'hosp', d:'Pacientes internados: leitos, pendências e evolução extraída por IA.'},
 {nm:'PocusAI', ic:'ti-scan', g:'hosp', d:'Guia prático de ultrassom à beira-leito, região por região.'},
 {nm:'LaudAI', ic:'ti-report-medical', g:'hosp', d:'Laudos assistidos por IA como segunda opinião do radiologista.'},
 {nm:'PaliAI', ic:'ti-heart-handshake', g:'clin', d:'Triagem de cuidados paliativos e roteiro de reunião familiar.'},
 {nm:'CalcMed', ic:'ti-calculator', g:'clin', d:'64 calculadoras e escores clínicos validados.'},
 {nm:'Guia do Interno', ic:'ti-school', g:'clin', d:'Handbook do internato: admissão, evolução, plantão e SBAR, com mentor de IA.'},
 {nm:'Logbook', ic:'ti-notebook', g:'rotina', d:'Registro de procedimentos e casos com contadores e exportação CSV.'},
 {nm:'Foco', ic:'ti-target-arrow', g:'rotina', d:'Demandas e agenda do médico, com priorização por IA.'},
 {nm:'PlantãoHub', ic:'ti-clock', g:'rotina', d:'Plantões, horas e quanto você tem a receber, mês a mês.'},
 {nm:'Granaê', ic:'ti-wallet', g:'rotina', d:'Finanças por voz e foto da fatura, com leitura por IA.'}
];
const BENCH={
 'Conteúdo clínico':[['Condutas completas',274,300],['Calculadoras e escores',64,300],['Aplicativos com IA',13,300,'dim']],
 'Estudo':[['Questões na maior plataforma',3000,3200,'','3.000+'],['Temas mapeados (radiologia)',241,3200],['Plataformas prontas',4,3200,'dim']],
 'Hospital':[['Exames lab + imagem',280,300,'','~280'],['Medicamentos no catálogo',140,300,'','~140'],['Especialidades de interconsulta',44,300],['Módulos do HospSys',13,300,'dim']]
};

/* ---------- apps ---------- */
const appsEl=document.getElementById('apps');
if(appsEl){appsEl.innerHTML=APPS.map(a=>`<a class="app" data-g="${a.g}" href="${a.g==='estudo'?'provas.html':'app.html'}"><span class="k"><i class="ti ${a.ic}"></i></span><span><b>${a.nm}</b><span>${a.d}</span></span></a>`).join('');
document.getElementById('tabs').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  document.querySelectorAll('#tabs button').forEach(x=>x.classList.toggle('on',x===b));
  const f=b.dataset.f;
  appsEl.querySelectorAll('.app').forEach(a=>a.classList.toggle('hide',f!=='all'&&a.dataset.g!==f));
});}

/* ---------- bench ---------- */
const barsEl=document.getElementById('bars');
function renderBench(key){if(!barsEl)return;
  barsEl.innerHTML=BENCH[key].map(([l,v,max,cls,lab])=>`<div class="bar ${cls||''}"><span class="l">${l}</span><span class="tr"><span class="fl" data-w="${Math.max(4,Math.round(v/max*100))}"></span></span><span class="v">${lab||v}</span></div>`).join('');
  requestAnimationFrame(()=>requestAnimationFrame(()=>barsEl.querySelectorAll('.fl').forEach(f=>f.style.width=f.dataset.w+'%')));
}
document.querySelectorAll('#bench .t span').forEach(s=>s.addEventListener('click',()=>{
  document.querySelectorAll('#bench .t span').forEach(x=>x.classList.toggle('on',x===s));renderBench(s.textContent);
}));
if(barsEl)renderBench('Conteúdo clínico');

/* ---------- header / pbar / linha ativa ---------- */
const hdr=document.getElementById('hdr'),pbw=document.getElementById('pbarw'),heroEl=document.getElementById('hero');
function onScroll(){const y=scrollY;hdr.classList.toggle('solid',y>40);pbw.classList.toggle('show',heroEl?y>innerHeight*0.6:true)}
addEventListener('scroll',onScroll,{passive:true});onScroll();
const linhaAtual=document.body.dataset.linha||'';
document.querySelectorAll('[data-linha]').forEach(a=>a.classList.toggle('on',!!linhaAtual&&a.dataset.linha===linhaAtual));
/* a home era uma página só, com âncoras por produto; quem chega por um link antigo vai para a página nova */
if(document.body.dataset.home!==undefined){
  const R={app:'medtech-app.html',provas:'medtech-provas.html',institucional:'institucional.html',hospitalar:'hospsys.html',faturamento:'faturamento.html',casos:'casos.html',capacita:'capacita.html',internato:'internato.html',sobmedida:'sobmedida.html'};
  const h=decodeURIComponent(location.hash.slice(1));if(R[h])location.replace(R[h]);
}

/* ---------- hero motion (scroll-driven + mouse parallax) ---------- */
(()=>{
  const hero=document.getElementById('hero'),w1=document.getElementById('w1'),w2=document.getElementById('w2'),
        orb=document.getElementById('orb'),core=document.getElementById('core'),ring=document.getElementById('ring'),
        stars=document.getElementById('stars'),tag=document.getElementById('tagline'),sub=document.getElementById('sub');
  if(!hero||matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  let mx=0,my=0,tx=0,ty=0,t0=performance.now(),entered=true,intro=0;
  addEventListener('pointermove',e=>{tx=(e.clientX/innerWidth-.5);ty=(e.clientY/innerHeight-.5)},{passive:true});
  const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
  function frame(now){
    const t=(now-t0)/1000;
    mx+=(tx-mx)*.06;my+=(ty-my)*.06;
    // progresso do scroll dentro do hero (0 → 1 ao longo de ~90svh)
    const range=hero.offsetHeight-innerHeight;
    const p=Math.min(1,Math.max(0,scrollY/Math.max(1,range)));
    const e=ease(p);
    // palavras: começam afastadas (≈14vw cada lado) e se encontram formando "MedTech"
    intro=Math.min(1,t/1.6);const ie=1-Math.pow(1-intro,3);
    const gap=Math.min(innerWidth*.14,220)*(1-e)+(1-ie)*80;
    const floatY=Math.sin(t*.9)*5*(1-e);
    const scale=1-.12*e;
    if(entered){
      w1.style.transform=`translate(${-gap - mx*18}px,${floatY - my*10}px) scale(${scale})`;
      w2.style.transform=`translate(${gap - mx*18}px,${-floatY - my*10}px) scale(${scale})`;
    }
    // orbe e núcleo: respiram, seguem o mouse e se contraem com o scroll
    const breathe=1+Math.sin(t*.7)*.03;
    orb.style.transform=`translate(calc(-50% + ${mx*40}px),calc(-50% + ${my*40}px)) scale(${(1+.25*e)*breathe})`;
    core.style.transform=`translate(calc(-50% + ${mx*90 + Math.sin(t*.5)*22}px),calc(-50% + ${my*90 + Math.cos(t*.42)*18}px)) scale(${1+.5*e})`;
    core.style.opacity=.9-.5*e;
    ring.style.transform=`translate(-50%,-50%) rotate(${t*9 + e*120}deg) scale(${1-.35*e})`;
    ring.style.opacity=1-e;
    stars.style.transform=`translate(${mx*-30}px,${my*-30 - scrollY*.08}px)`;
    // tagline aparece quando as palavras se encontram; hint de rolagem some
    const tp=Math.max(0,(e-.55)/.45);
    tag.style.opacity=tp;tag.style.transform=`translateY(${10-10*tp}px)`;
    sub.style.opacity=Math.max(0,1-p*2.2);
    if(running)raf=requestAnimationFrame(frame);
  }
  // o laço só roda enquanto o herói está na tela: fora dele os elementos estão invisíveis e o
  // celular gastava CPU e bateria redesenhando 60 vezes por segundo a página inteira
  let running=false,raf=0;
  function start(){if(running)return;running=true;raf=requestAnimationFrame(frame)}
  function stop(){running=false;cancelAnimationFrame(raf)}
  new IntersectionObserver(es=>es.forEach(x=>x.isIntersecting?start():stop())).observe(hero);
  start();
})();

/* ---------- reveal ---------- */
const rv=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');rv.unobserve(e.target)}}),{threshold:.12});
document.querySelectorAll('.rv').forEach(el=>rv.observe(el));
