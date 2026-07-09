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
const lsKey = "mt_" + APP.id;
const listeners = [];
const MT = {
  mode: PLACEHOLDER ? "demo" : "cloud",
  user: null,
  ready: null,
  _data: undefined,
  onData(cb) { listeners.push(cb); if (MT._data !== undefined) cb(MT._data); },
  _emit(d) { MT._data = d; listeners.forEach(f => { try { f(d); } catch (e) { console.error(e); } }); },
  localGet() { try { return JSON.parse(localStorage.getItem(lsKey)); } catch (e) { return null; } },
  localSet(d) { try { localStorage.setItem(lsKey, JSON.stringify(d)); } catch (e) {} },

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
      d.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:99990;display:flex;align-items:center;justify-content:center;padding:20px';
      d.innerHTML = '<div style="background:#fff;border-radius:16px;max-width:400px;width:100%;padding:26px;font-family:Inter,system-ui,sans-serif;text-align:center">' +
        '<div style="font-size:19px;font-weight:800;color:#0f172a;margin-bottom:8px">Assine o MedTech</div>' +
        '<div style="font-size:14px;color:#64748b;line-height:1.5;margin-bottom:16px">Acesso a todos os apps do ecossistema, com IA incluída.<br>1 app R$ 19,90 · 2 apps R$ 34,90 · tudo R$ 59,90/mês.</div>' +
        '<a href="' + url + '" target="_blank" rel="noopener" style="display:block;background:#2563eb;color:#fff;border-radius:10px;padding:13px;font-weight:700;text-decoration:none">Assinar agora</a>' +
        '<button onclick="document.getElementById(\'mt-paywall\').remove()" style="margin-top:10px;background:none;border:none;color:#64748b;font-size:13px;cursor:pointer">Agora não</button></div>';
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
  .mt-auth{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;background:linear-gradient(135deg,#2563eb,#1e40af)}
  .mt-card{background:#fff;border-radius:20px;padding:30px 26px;max-width:380px;width:100%;box-shadow:0 24px 60px rgba(0,0,0,.25)}
  .mt-brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:22px;letter-spacing:.5px;color:#0f172a}
  .mt-brand .mk{width:38px;height:38px;border-radius:11px;background:#2563eb;display:grid;place-items:center}
  .mt-brand .mk svg{width:24px;height:24px}
  .mt-brand b{color:#1d4ed8}
  .mt-sub{color:#64748b;font-size:13px;margin:4px 0 20px}
  .mt-auth h2{font-size:18px;color:#0f172a;margin-bottom:14px}
  .mt-auth input{width:100%;padding:12px 13px;border:1px solid #e6ebf3;border-radius:11px;font-size:15px;font-family:inherit;margin-bottom:11px}
  .mt-auth input:focus{outline:none;border-color:#2563eb}
  .mt-auth .mt-btn{width:100%;padding:13px;border:none;border-radius:11px;background:#2563eb;color:#fff;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit}
  .mt-auth .mt-btn:hover{background:#1d4ed8}
  .mt-auth .mt-link{background:none;border:none;color:#2563eb;font-weight:700;font-size:13.5px;cursor:pointer;margin-top:12px;font-family:inherit;display:block;width:100%}
  .mt-err{color:#c0392b;font-size:13px;margin:2px 0 8px;min-height:16px}
  .mt-consent{display:flex;gap:8px;align-items:flex-start;font-size:12px;color:#64748b;text-align:left;margin:2px 0 12px}
  .mt-consent a{color:#2563eb;font-weight:700}
  .mt-demobar{position:fixed;left:0;right:0;bottom:0;z-index:9000;background:#fdf0e0;color:#8a5410;font-size:13px;text-align:center;padding:9px 14px;border-top:1px solid #f0d6a8}
  .mt-demobar b{color:#2563eb}
  .mt-demobar button{margin-left:8px;background:#2563eb;color:#fff;border:none;border-radius:7px;padding:4px 10px;font-size:12px;font-weight:700;cursor:pointer}
  .mt-home{position:fixed;z-index:9500;top:calc(env(safe-area-inset-top) + 9px);left:calc(env(safe-area-inset-left) + 9px);display:inline-flex;align-items:center;gap:5px;background:rgba(15,23,42,.84);color:#fff;text-decoration:none;font:700 12px system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;padding:6px 11px 6px 8px;border-radius:999px;box-shadow:0 4px 14px rgba(0,0,0,.3);-webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px);opacity:.6;transition:opacity .15s,transform .12s}
  .mt-home:hover{opacity:1}
  .mt-home:active{transform:scale(.94)}
  .mt-home svg{width:13px;height:13px;flex:0 0 auto}
  body.mt-shell{padding-top:calc(env(safe-area-inset-top) + 42px) !important}
  .mt-splash{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:linear-gradient(135deg,#2563eb,#1e40af)}
  .mt-splash .mk{width:62px;height:62px;border-radius:18px;background:#2563eb;display:grid;place-items:center}
  .mt-splash .mk svg{width:38px;height:38px}
  .mt-splash .sp{width:26px;height:26px;border:3px solid rgba(255,255,255,.25);border-top-color:#2563eb;border-radius:50%;animation:mtspin .8s linear infinite}
  @keyframes mtspin{to{transform:rotate(360deg)}}
  `;
  document.head.appendChild(s);
}

/* Botão flutuante "voltar ao MedTech" — aparece nos apps (não no próprio portal),
   só quando logado. Todos os apps carregam este módulo, então fica num lugar só. */
function injectHomeButton() {
  if (APP.id === 'portal') return;
  if (document.getElementById('mt-home')) return;
  document.body.classList.add('mt-shell');   // reserva uma faixa no topo p/ o botão não cobrir conteúdo
  const a = document.createElement('a');
  a.id = 'mt-home'; a.className = 'mt-home'; a.href = '/app.html'; a.title = 'Voltar ao MedTech';
  a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>MedTech';
  document.body.appendChild(a);
}
function removeHomeButton() { const h = document.getElementById('mt-home'); if (h) h.remove(); document.body.classList.remove('mt-shell'); }

/* Splash de carregamento — cobre a tela enquanto a sessão MedTech é verificada, para
   NÃO vazar a tela própria de cada app (ex.: login antigo) nem piscar o login ao trocar de app. */
function mountSplash() {
  if (!document.body || document.getElementById('mt-splash')) return;
  const d = document.createElement('div'); d.id = 'mt-splash'; d.className = 'mt-splash';
  d.innerHTML = '<span class="mk"><svg viewBox="0 0 96 96"><path d="M18 50 h13 l7 -20 9 38 8 -26 5 8 h13" fill="none" stroke="#172554" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span class="sp"></span>';
  document.body.appendChild(d);
}
function removeSplash() { const s = document.getElementById('mt-splash'); if (s) s.remove(); }
const LOGO = `<span class="mk"><svg viewBox="0 0 96 96"><path d="M18 50 h13 l7 -20 9 38 8 -26 5 8 h13" fill="none" stroke="#172554" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;

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
        removeHomeButton();
        removeSplash();
        if (!document.getElementById('mt-auth')) mountAuth();
      }
    });

    MT.save = async (d) => {
      MT.localSet(d); MT._emit(d);
      if (MT.user) {
        const ref = F.doc(db, 'users', MT.user.uid, 'apps', APP.id);
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
