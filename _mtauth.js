/* ============================================================
   MedTech — módulo compartilhado de LOGIN + SYNC NA NUVEM
   Cole window.MEDTECH_FB (config do Firebase) e window.MT_APP
   antes de carregar este módulo. Enquanto a config estiver com
   "COLE_AQUI", o app roda em MODO DEMONSTRAÇÃO (local, sem login).
   Expõe window.MT: { mode,user,ready,onData,save,signOut }
   ============================================================ */
const CFG = window.MEDTECH_FB || {};
const PLACEHOLDER = !CFG.apiKey || CFG.apiKey === "COLE_AQUI";
const APP = window.MT_APP || { id: "app", name: "App" };
const lsBase = "mt_" + APP.id;
// Cache local POR USUARIO. A chave antiga (sem uid) era compartilhada entre
// contas no mesmo navegador -> num PC de plantao o Dr. B via/gravava os dados
// do Dr. A. Nuke a legada e passa a namespacear por uid; a nuvem e a fonte
// de verdade, entao nada de dado logado se perde.
try { localStorage.removeItem(lsBase); } catch (e) {}
const lsKeyFor = (uid) => lsBase + "_" + (uid || "anon");
const listeners = [];
const MT = {
  mode: PLACEHOLDER ? "demo" : "cloud",
  user: null,
  _uid: null,
  ready: null,
  _data: undefined,
  onData(cb) { listeners.push(cb); if (MT._data !== undefined) cb(MT._data); },
  _emit(d) { MT._data = d; listeners.forEach(f => { try { f(d); } catch (e) { console.error(e); } }); },
  localGet() { try { return JSON.parse(localStorage.getItem(lsKeyFor(MT._uid))); } catch (e) { return null; } },
  localSet(d) { try { localStorage.setItem(lsKeyFor(MT._uid), JSON.stringify(d)); } catch (e) {} },

  /* ---------- Merge por-entidade entre aparelhos (anti last-write-wins) ----------
     O app registra MT.mergeFn e passa as coleções (arrays de {id, updatedAt}).
     - Adições nunca se perdem (união por id).
     - Edição concorrente do MESMO id: vence o updatedAt maior (last-edit-wins por entidade).
     - Deleção via tombstone: state._tomb = {id: tsMs}. Um item é removido se
       _tomb[id] >= item.updatedAt, e o _tomb propaga a deleção p/ os outros aparelhos.
     Requisitos no app: carimbar item.updatedAt = Date.now() ao criar/editar; ao apagar,
     registrar (state._tomb = state._tomb||{})[id] = Date.now(). Escalares seguem o
     aparelho que está salvando. Ver [[reference-granae-perda-dados-merge]]. */
  markDeleted(state, id) { if (!state) return state; (state._tomb = state._tomb || {})[id] = Date.now(); return state; },
  mergeState(remote, local, collections) {
    if (!remote || typeof remote !== 'object') return local;
    if (!local || typeof local !== 'object') return remote;
    const out = Object.assign({}, local);
    const tomb = Object.assign({}, remote._tomb || {});
    const lt = local._tomb || {};
    for (const id in lt) { if (!(id in tomb) || lt[id] > tomb[id]) tomb[id] = lt[id]; }
    (collections || []).forEach(key => {
      const R = Array.isArray(remote[key]) ? remote[key] : [];
      const L = Array.isArray(local[key]) ? local[key] : [];
      const byId = new Map();
      const consider = it => {
        if (!it || it.id == null) return;
        const prev = byId.get(it.id);
        if (!prev) { byId.set(it.id, it); return; }
        if ((+it.updatedAt || 0) >= (+prev.updatedAt || 0)) byId.set(it.id, it);
      };
      R.forEach(consider); L.forEach(consider);
      out[key] = [...byId.values()].filter(x => !(x.id in tomb && tomb[x.id] >= (+x.updatedAt || 0)));
    });
    out._tomb = tomb;
    return out;
  },

  /* ---------- Assinatura do ecossistema (Kiwify central) ----------
     SUBS_ENFORCE=false → NADA muda para os usuários (retorna active provisional).
     Quando o produto Kiwify existir: trocar KIWIFY_CHECKOUT_URL, SUBS_ENFORCE=true
     e bump ?v= dos apps. O webhook central grava users/{uid}.subscription
     ({status, plan, paidUntilMs, ...}) no Firestore medtech-c658c. */
  SUBS_ENFORCE: false,
  KIWIFY_CHECKOUT_URL: 'https://pay.kiwify.com.br/REPLACE_ME',
  _subCache: null,
  async subscription() {
    if (!MT.SUBS_ENFORCE) return { active: true, provisional: true };
    if (!MT.user || !MT._fb) return { active: false, reason: 'nologin' };
    const now = Date.now();
    if (MT._subCache && (now - MT._subCache.at) < 600000) return MT._subCache.val;
    try {
      const { db, F } = MT._fb;
      const snap = await F.getDoc(F.doc(db, 'users', MT.user.uid));
      const sub = (snap.exists() && snap.data().subscription) || {};
      const val = {
        active: sub.status === 'active' && Number(sub.paidUntilMs || 0) > now,
        plan: sub.plan || null,
        paidUntilMs: Number(sub.paidUntilMs || 0)
      };
      MT._subCache = { at: now, val };
      return val;
    } catch (e) { console.warn('MT.subscription falhou', e); return { active: true, degraded: true }; }
  },
  async requirePlan(onOk) {
    const s = await MT.subscription();
    if (s.active) { if (onOk) onOk(s); return true; }
    const uid = MT.user ? MT.user.uid : '';
    const url = MT.KIWIFY_CHECKOUT_URL + (MT.KIWIFY_CHECKOUT_URL.indexOf('?') > -1 ? '&' : '?') + 's1=' + encodeURIComponent(uid);
    if (!document.getElementById('mt-paywall')) {
      const d = document.createElement('div');
      d.id = 'mt-paywall';
      d.style.cssText = 'position:fixed;inset:0;background:rgba(28,32,38,.45);z-index:99990;display:flex;align-items:center;justify-content:center;padding:20px';
      d.innerHTML = '<div style="background:#FFFFFF;border:1px solid #E5E5DF;border-radius:16px;max-width:400px;width:100%;padding:26px;font-family:system-ui,sans-serif;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,.45)">' +
        '<div style="font-size:19px;font-weight:800;color:#23272E;margin-bottom:8px;font-family:system-ui,sans-serif">Assine o MedTech</div>' +
        '<div style="font-size:14px;color:#5E646B;line-height:1.5;margin-bottom:16px">Acesso a todos os apps do ecossistema, com IA incluída.<br>1 app R$ 19,90 · 2 apps R$ 34,90 · tudo R$ 59,90/mês.</div>' +
        '<a href="' + url + '" target="_blank" rel="noopener" style="display:block;background:#2B5CE6;color:#fff;border-radius:10px;padding:13px;font-weight:700;text-decoration:none;box-shadow:0 8px 22px rgba(43,92,230,.25)">Assinar agora</a>' +
        '<button onclick="document.getElementById(\'mt-paywall\').remove()" style="margin-top:10px;background:none;border:none;color:#5E646B;font-size:13px;cursor:pointer">Agora não</button></div>';
      document.body.appendChild(d);
    }
    return false;
  }
};
window.MT = MT;

/* ---------- estilos da tela de login (injetados) ---------- */
function injectCSS() {
  if (document.getElementById('mt-style')) return;
  const s = document.createElement('style'); s.id = 'mt-style';
  s.textContent = `
  .mt-auth{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;background:#FAFAF8}
  .mt-card{background:#FFFFFF;border:1px solid #E5E5DF;border-radius:20px;padding:30px 26px;max-width:380px;width:100%;box-shadow:0 14px 40px -14px rgba(20,24,30,.18)}
  .mt-brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:22px;letter-spacing:-.01em;color:#23272E;font-family:system-ui,sans-serif}
  .mt-brand .mk{width:38px;height:38px;border-radius:11px;background:#2B5CE6;display:grid;place-items:center}
  .mt-brand .mk svg{width:24px;height:24px}
  .mt-brand b{color:#2B5CE6}
  .mt-sub{color:#5E646B;font-size:13px;margin:4px 0 20px}
  .mt-auth h2{font-size:18px;color:#23272E;font-family:system-ui,sans-serif;margin-bottom:14px}
  .mt-auth input{width:100%;padding:12px 13px;border:1px solid rgba(140,160,185,.18);background:#F4F4F0;color:#23272E;border-radius:11px;font-size:15px;font-family:inherit;margin-bottom:11px}
  .mt-auth input:focus{outline:none;border-color:#2B5CE6;box-shadow:0 0 0 3px rgba(43,92,230,.15)}
  .mt-auth input:-webkit-autofill,.mt-auth input:-webkit-autofill:hover,.mt-auth input:-webkit-autofill:focus{-webkit-box-shadow:0 0 0 100px #F4F4F0 inset;-webkit-text-fill-color:#23272E;caret-color:#23272E;transition:background-color 99999s ease-in-out 0s}
  .mt-auth .mt-btn{width:100%;padding:13px;border:none;border-radius:11px;background:#2B5CE6;color:#fff;font-weight:700;font-size:15px;cursor:pointer;font-family:inherit;box-shadow:0 8px 22px rgba(43,92,230,.25)}
  .mt-auth .mt-btn:hover{filter:brightness(1.08)}
  .mt-auth .mt-link{background:none;border:none;color:#2B5CE6;font-weight:700;font-size:13.5px;cursor:pointer;margin-top:12px;font-family:inherit;display:block;width:100%}
  .mt-err{color:#F85149;font-size:13px;margin:2px 0 8px;min-height:16px}
  .mt-consent{display:flex;gap:8px;align-items:flex-start;font-size:12px;color:#5E646B;text-align:left;margin:2px 0 12px}
  .mt-consent a{color:#2B5CE6;font-weight:700}
  .mt-demobar{position:fixed;left:0;right:0;bottom:0;z-index:9000;background:#F4F4F0;color:#5E646B;font-size:13px;text-align:center;padding:9px 14px;border-top:1px solid #DDDDD5}
  .mt-demobar b{color:#2B5CE6}
  .mt-demobar button{margin-left:8px;background:#2B5CE6;color:#fff;border:none;border-radius:7px;padding:4px 10px;font-size:12px;font-weight:700;cursor:pointer}
  .mt-home{position:fixed;z-index:9500;top:calc(env(safe-area-inset-top) + 9px);left:calc(env(safe-area-inset-left) + 9px);display:inline-flex;align-items:center;gap:5px;background:rgba(15,23,42,.84);color:#fff;text-decoration:none;font:700 12px system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;padding:6px 11px 6px 8px;border-radius:999px;box-shadow:0 4px 14px rgba(0,0,0,.3);-webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px);opacity:.6;transition:opacity .15s,transform .12s}
  .mt-home:hover{opacity:1}
  .mt-home:active{transform:scale(.94)}
  .mt-home svg{width:13px;height:13px;flex:0 0 auto}
  body.mt-shell{padding-top:calc(env(safe-area-inset-top) + 42px) !important}
  .mt-sw{position:fixed;inset:0;z-index:9600;background:rgba(20,24,30,.45);display:flex;align-items:flex-start;justify-content:center;padding:60px 16px 16px}
  .mt-sw-box{background:#FAFAF8;border-radius:18px;box-shadow:0 24px 60px -18px rgba(0,0,0,.45);padding:18px 16px 14px;max-width:420px;width:100%;max-height:82vh;overflow:auto}
  .mt-sw-h{font:600 12px system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#9AA0A6;margin:0 0 12px 4px}
  .mt-sw-g{display:grid;grid-template-columns:repeat(4,1fr);gap:16px 6px}
  .mt-sw-a{display:flex;flex-direction:column;align-items:center;gap:6px;text-decoration:none;color:#23272E}
  .mt-sw-a .k{width:48px;height:48px;border-radius:13px;display:grid;place-items:center;font-size:23px;color:#fff;box-shadow:0 2px 5px rgba(35,39,46,.16);transition:transform .12s}
  .mt-sw-a:hover .k{transform:scale(1.08)}
  .mt-sw-a .n{font:500 10.5px system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;text-align:center;line-height:1.2}
  .mt-sw-a.cur .k{outline:3px solid #23272E;outline-offset:2px}
  .mt-sw-a.cur .n{font-weight:700}
  .mt-splash{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:#FAFAF8;}
  .mt-splash .mk{width:62px;height:62px;border-radius:18px;background:#2B5CE6;display:grid;place-items:center}
  .mt-splash .mk svg{width:38px;height:38px}
  .mt-splash .sp{width:26px;height:26px;border:3px solid rgba(140,160,185,.2);border-top-color:#2B5CE6;border-radius:50%;animation:mtspin .8s linear infinite}
  @keyframes mtspin{to{transform:rotate(360deg)}}
  `;
  document.head.appendChild(s);
}

/* Botão flutuante "voltar ao MedTech" — aparece nos apps (não no próprio portal),
   só quando logado. Todos os apps carregam este módulo, então fica num lugar só. */
/* ===== Trocador de funções (shell do super-app) =====
   As "funções" do MedTech: um toque no selo abre a grade e salta de app em app. */
const MT_FUNCS = [
  { id:'agendaai',   nm:'ConsultAI',  ic:'ti-calendar-event', c:'#2B5CE6', url:'/consultai.html' },
  { id:'condutai',   nm:'CondutAI',   ic:'ti-stethoscope',    c:'#1D6FD0', url:'/condutai.html' },
  { id:'atbguia',    nm:'ATBguia',    ic:'ti-pill',           c:'#0E8A9C', url:'/atbguia.html' },
  { id:'enfermaria', nm:'EnfermarIA', ic:'ti-bed',            c:'#3B7BE0', url:'/enfermaria.html' },
  { id:'pocusai',    nm:'PocusAI',    ic:'ti-scan',           c:'#2456B8', url:'/pocusai.html' },
  { id:'laudai',     nm:'LaudAI',     ic:'ti-report-medical', c:'#4166D6', url:'/laudai.html' },
  { id:'paliai',     nm:'PaliAI',     ic:'ti-heart-handshake',c:'#B84A86', url:'/paliai.html' },
  { id:'calcmed',    nm:'CalcMed',    ic:'ti-calculator',     c:'#4C7A99', url:'/calcmed.html' },
  { id:'medprovas',  nm:'MedProvas',  ic:'ti-clipboard-text', c:'#C07C0A', url:'/medprovas.html' },
  { id:'flashmed',   nm:'FlashMed',   ic:'ti-cards',          c:'#D0902A', url:'/flashmed.html' },
  { id:'guiainterno',nm:'Guia do Interno', ic:'ti-school',    c:'#A8730F', url:'/guiainterno.html' },
  { id:'foco',       nm:'Foco',       ic:'ti-target-arrow',   c:'#0E8A63', url:'/foco.html' },
  { id:'plantaohub', nm:'PlantãoHub', ic:'ti-clock',          c:'#15966F', url:'/plantaohub.html' },
  { id:'granae',     nm:'Granaê',     ic:'ti-wallet',         c:'#6D46D8', url:'/granae.html' },
  { id:'logbook',    nm:'Logbook',    ic:'ti-notebook',       c:'#B0532F', url:'/logbook.html' }
];
MT.FUNCS = MT_FUNCS;
MT.openSwitcher = () => openSwitcher();
function ensureTabler() {
  if (document.querySelector('link[href*="tabler-icons"]')) return;
  const l = document.createElement('link'); l.rel = 'stylesheet';
  l.href = 'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3/dist/tabler-icons.min.css';
  document.head.appendChild(l);
}
function openSwitcher() {
  if (document.getElementById('mt-sw')) return;
  ensureTabler();
  const ov = document.createElement('div'); ov.id = 'mt-sw'; ov.className = 'mt-sw';
  const item = f => '<a class="mt-sw-a' + (f.id === APP.id ? ' cur' : '') + '" href="' + f.url + '">' +
    '<span class="k" style="background:' + f.c + '"><i class="ti ' + f.ic + '"></i></span><span class="n">' + f.nm + '</span></a>';
  ov.innerHTML = '<div class="mt-sw-box"><p class="mt-sw-h">Funções do MedTech</p><div class="mt-sw-g">' +
    '<a class="mt-sw-a" href="/app.html"><span class="k" style="background:#23272E"><i class="ti ti-home"></i></span><span class="n">Início</span></a>' +
    MT_FUNCS.map(item).join('') + '</div></div>';
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  document.addEventListener('keydown', function esc(e){ if (e.key === 'Escape') { ov.remove(); document.removeEventListener('keydown', esc); } });
  document.body.appendChild(ov);
}
function injectHomeButton() {
  if (APP.id === 'portal') return;
  if (document.getElementById('mt-home')) return;
  document.body.classList.add('mt-shell');   // reserva uma faixa no topo p/ o botão não cobrir conteúdo
  const a = document.createElement('a');
  a.id = 'mt-home'; a.className = 'mt-home'; a.href = '/app.html'; a.title = 'Trocar de função · MedTech';
  a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/></svg>MedTech';
  a.addEventListener('click', e => { e.preventDefault(); openSwitcher(); });
  document.body.appendChild(a);
}
function removeHomeButton() { const h = document.getElementById('mt-home'); if (h) h.remove(); document.body.classList.remove('mt-shell'); }

/* Splash de carregamento — cobre a tela enquanto a sessão MedTech é verificada, para
   NÃO vazar a tela própria de cada app (ex.: login antigo) nem piscar o login ao trocar de app. */
function mountSplash() {
  if (!document.body || document.getElementById('mt-splash')) return;
  const d = document.createElement('div'); d.id = 'mt-splash'; d.className = 'mt-splash';
  d.innerHTML = '<span class="mk"><svg viewBox="0 0 96 96"><path d="M18 50 h13 l7 -20 9 38 8 -26 5 8 h13" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span class="sp"></span>';
  document.body.appendChild(d);
}
function removeSplash() { const s = document.getElementById('mt-splash'); if (s) s.remove(); }
const LOGO = `<span class="mk"><svg viewBox="0 0 96 96"><path d="M18 50 h13 l7 -20 9 38 8 -26 5 8 h13" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;

function authMarkup() {
  return `<div class="mt-auth" id="mt-auth"><div class="mt-card">
    <div class="mt-brand">${LOGO}<span>${APP.name.replace(/AI$/,'')}<b>${/AI$/.test(APP.name)?'AI':''}</b></span></div>
    <div class="mt-sub">Acesse sua conta MedTech · uma conta para todos os apps</div>
    <form id="mt-login">
      <h2>Entrar</h2>
      <input name="email" type="email" placeholder="E-mail" autocomplete="username" required>
      <input name="password" type="password" placeholder="Senha" autocomplete="current-password" required>
      <p class="mt-err" id="mt-err-l"></p>
      <button class="mt-btn" type="submit">Entrar</button>
      <button class="mt-link" type="button" id="mt-go-reg">Não tem conta? Criar conta</button>
      <button class="mt-link" type="button" id="mt-go-reset">Esqueci minha senha</button>
    </form>
    <form id="mt-register" hidden>
      <h2>Criar conta</h2>
      <input name="name" type="text" placeholder="Seu nome" autocomplete="name" required>
      <input name="email" type="email" placeholder="E-mail" autocomplete="username" required>
      <input name="password" type="password" placeholder="Senha (mín. 6 caracteres)" minlength="6" autocomplete="new-password" required>
      <label class="mt-consent"><input type="checkbox" required style="margin-top:2px"><span>Li e aceito os <a href="https://medtechbr.github.io/termos.html" target="_blank" rel="noopener">Termos</a> e a <a href="https://medtechbr.github.io/privacidade.html" target="_blank" rel="noopener">Política de Privacidade</a> (LGPD).</span></label>
      <p class="mt-err" id="mt-err-r"></p>
      <button class="mt-btn" type="submit">Criar conta</button>
      <button class="mt-link" type="button" id="mt-go-login">Já tenho conta</button>
    </form>
  </div></div>`;
}
function errMsg(code) {
  const m = {
    'auth/invalid-email': 'E-mail inválido.',
    'auth/user-not-found': 'Conta não encontrada.',
    'auth/wrong-password': 'Senha incorreta.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/email-already-in-use': 'Já existe uma conta com este e-mail.',
    'auth/weak-password': 'Senha muito curta (mínimo 6 caracteres).',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde um momento.',
    'auth/network-request-failed': 'Falha de conexão. Verifique sua internet.'
  };
  return m[code] || 'Não foi possível concluir. Tente novamente.';
}

function showDemoBanner() {
  injectCSS();
  if (document.getElementById('mt-demobar')) return;
  const b = document.createElement('div'); b.className = 'mt-demobar'; b.id = 'mt-demobar';
  b.innerHTML = `🔧 <b>Modo demonstração</b> — login real e nuvem ainda não configurados. Seus dados estão salvos só neste navegador. <button onclick="this.parentNode.remove()">Ok</button>`;
  document.body.appendChild(b);
}

/* ================= DEMO MODE ================= */
if (PLACEHOLDER) {
  MT.user = { demo: true, name: 'Demonstração' };
  MT.ready = Promise.resolve();
  MT.save = (d) => { MT.localSet(d); MT._emit(d); return Promise.resolve(); };
  MT.signOut = () => {};
  MT.ai = async () => { throw new Error("Entre na sua conta MedTech para usar a IA."); };
  MT.aiAudio = async () => { throw new Error("Entre na sua conta MedTech para usar a IA."); };
  MT.aiImage = async () => { throw new Error("Entre na sua conta MedTech para usar a IA."); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showDemoBanner);
  else showDemoBanner();
  Promise.resolve().then(() => MT._emit(MT.localGet()));
}
/* ================= CLOUD MODE ================= */
else {
  MT.ready = (async () => {
    injectCSS(); mountSplash();   // cobre a tela já, antes de qualquer await (não vaza a tela do app)
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js");
    const A = await import("https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js");
    const F = await import("https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js");
    const app = initializeApp(CFG);
    const auth = A.getAuth(app);
    let db;
    try { db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) }); }
    catch (e) { db = F.getFirestore(app); }
    MT._fb = { app, auth, db, A, F };
    injectCSS();
    // NÃO montamos a tela de login de cara — esperamos o onAuthStateChanged abaixo.
    // Como todos os apps são do mesmo domínio, a sessão MedTech é compartilhada: se já
    // está logado, entra direto (sem flash de login ao trocar de app). Só mostra login
    // quando o usuário está realmente deslogado.

    // ---- IA central da MedTech (proxy seguro do Gemini via Cloud Function) ----
    try {
      const Fn = await import("https://www.gstatic.com/firebasejs/10.13.2/firebase-functions.js");
      const functions = Fn.getFunctions(app, "southamerica-east1");
      MT.ai = async (prompt, model = "gemini-2.5-flash") => {
        if (!MT.user) throw new Error("Entre na sua conta MedTech para usar a IA.");
        const callable = Fn.httpsCallable(functions, "gemini");
        const res = await callable({ prompt, model });
        return (res && res.data && res.data.text) || "";
      };
      MT.aiAudio = async (audio, mimeType, prompt, model = "gemini-2.5-flash") => {
        if (!MT.user) throw new Error("Entre na sua conta MedTech para usar a IA.");
        const callable = Fn.httpsCallable(functions, "geminiAudio");
        const res = await callable({ audio, mimeType, prompt, model });
        return (res && res.data && res.data.text) || "";
      };
      MT.aiImage = async (images, prompt, model = "gemini-2.5-flash") => {
        if (!MT.user) throw new Error("Entre na sua conta MedTech para usar a IA.");
        const callable = Fn.httpsCallable(functions, "geminiImage");
        const res = await callable({ images, prompt, model });
        return (res && res.data && res.data.text) || "";
      };
    } catch (e) { MT.ai = async () => { throw new Error("IA MedTech indisponível no momento."); }; MT.aiAudio = async () => { throw new Error("IA MedTech indisponível no momento."); }; MT.aiImage = async () => { throw new Error("IA MedTech indisponível no momento."); }; }

    let unsub = null;
    A.onAuthStateChanged(auth, (u) => {
      MT.user = u;
      MT._uid = u ? u.uid : null;
      if (u) {
        const el = document.getElementById('mt-auth'); if (el) el.remove();
        injectHomeButton();
        const ref = F.doc(db, 'users', u.uid, 'apps', APP.id);
        if (unsub) unsub();
        unsub = F.onSnapshot(ref, (snap) => {
          let d = null;
          if (snap.exists()) { const raw = snap.data(); try { d = raw.json ? JSON.parse(raw.json) : null; } catch (e) { d = null; } }
          if (d === null) d = MT.localGet();
          MT.localSet(d);
          MT._emit(d);
          removeSplash();   // dados chegaram e o app já renderizou → tira o splash
        }, (err) => { console.error(err); MT._emit(MT.localGet()); removeSplash(); });
        setTimeout(removeSplash, 3500);   // rede de segurança (offline / lento)
      } else {
        if (unsub) { unsub(); unsub = null; }
        MT._data = undefined;   // nao vaza dado do usuario anterior para a proxima conta
        removeHomeButton();
        removeSplash();
        if (!document.getElementById('mt-auth')) mountAuth();
      }
    });

    MT.save = async (d) => {
      MT.localSet(d); MT._emit(d);
      if (MT.user) {
        const ref = F.doc(db, 'users', MT.user.uid, 'apps', APP.id);
        // Se o app registrou MT.mergeFn, reconcilia com o remoto numa transacao
        // antes de gravar, para nao apagar o que outro aparelho lancou.
        // Sem hook, mantem o comportamento antigo (last-write-wins).
        if (typeof MT.mergeFn === 'function') {
          try {
            let merged = null;
            await F.runTransaction(db, async (tx) => {
              const snap = await tx.get(ref);
              let remote = null;
              if (snap.exists()) { const raw = snap.data(); try { remote = raw.json ? JSON.parse(raw.json) : null; } catch (e) { remote = null; } }
              merged = MT.mergeFn(remote, d) || d;
              tx.set(ref, { json: JSON.stringify(merged), updatedAt: F.serverTimestamp() }, { merge: true });
            });
            if (merged) { MT.localSet(merged); MT._emit(merged); }
            return;
          } catch (e) {
            console.warn('MT.save merge falhou, gravando sem merge:', e && e.message);
          }
        }
        await F.setDoc(ref, { json: JSON.stringify(d), updatedAt: F.serverTimestamp() }, { merge: true });
      }
    };
    MT.signOut = () => A.signOut(auth);

    function mountAuth() {
      if (document.getElementById('mt-auth')) return;
      const wrap = document.createElement('div'); wrap.innerHTML = authMarkup();
      document.body.appendChild(wrap.firstChild);
      const loginF = document.getElementById('mt-login');
      const regF = document.getElementById('mt-register');
      document.getElementById('mt-go-reg').onclick = () => { loginF.hidden = true; regF.hidden = false; };
      document.getElementById('mt-go-login').onclick = () => { regF.hidden = true; loginF.hidden = false; };
      document.getElementById('mt-go-reset').onclick = async () => {
        const email = loginF.email.value.trim();
        const er = document.getElementById('mt-err-l');
        if (!email) { er.textContent = 'Digite seu e-mail acima para receber o link.'; return; }
        try { await A.sendPasswordResetEmail(auth, email); er.style.color = '#14794f'; er.textContent = 'Link de redefinição enviado para seu e-mail.'; }
        catch (e) { er.style.color = '#c0392b'; er.textContent = errMsg(e.code); }
      };
      loginF.onsubmit = async (e) => {
        e.preventDefault();
        const er = document.getElementById('mt-err-l'); er.textContent = '';
        try { await A.signInWithEmailAndPassword(auth, loginF.email.value.trim(), loginF.password.value); }
        catch (err) { er.textContent = errMsg(err.code); }
      };
      regF.onsubmit = async (e) => {
        e.preventDefault();
        const er = document.getElementById('mt-err-r'); er.textContent = '';
        try {
          const cred = await A.createUserWithEmailAndPassword(auth, regF.email.value.trim(), regF.password.value);
          if (regF.name.value.trim()) { try { await A.updateProfile(cred.user, { displayName: regF.name.value.trim() }); } catch (e2) {} }
        } catch (err) { er.textContent = errMsg(err.code); }
      };
    }
    window.__mtMountAuth = mountAuth;
  })();
}
