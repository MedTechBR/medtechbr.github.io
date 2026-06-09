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
  localSet(d) { try { localStorage.setItem(lsKey, JSON.stringify(d)); } catch (e) {} }
};
window.MT = MT;

/* ---------- estilos da tela de login (injetados) ---------- */
function injectCSS() {
  if (document.getElementById('mt-style')) return;
  const s = document.createElement('style'); s.id = 'mt-style';
  s.textContent = `
  .mt-auth{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;background:linear-gradient(135deg,#0E5A6D,#083845)}
  .mt-card{background:#fff;border-radius:20px;padding:30px 26px;max-width:380px;width:100%;box-shadow:0 24px 60px rgba(0,0,0,.25)}
  .mt-brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:22px;letter-spacing:.5px;color:#0E2A31}
  .mt-brand .mk{width:38px;height:38px;border-radius:11px;background:#2DD4A8;display:grid;place-items:center}
  .mt-brand .mk svg{width:24px;height:24px}
  .mt-brand b{color:#14b894}
  .mt-sub{color:#5B7882;font-size:13px;margin:4px 0 20px}
  .mt-auth h2{font-size:18px;color:#0E2A31;margin-bottom:14px}
  .mt-auth input{width:100%;padding:12px 13px;border:1px solid #dbe8ea;border-radius:11px;font-size:15px;font-family:inherit;margin-bottom:11px}
  .mt-auth input:focus{outline:none;border-color:#2DD4A8}
  .mt-auth .mt-btn{width:100%;padding:13px;border:none;border-radius:11px;background:#2DD4A8;color:#083845;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit}
  .mt-auth .mt-btn:hover{background:#14b894}
  .mt-auth .mt-link{background:none;border:none;color:#0E5A6D;font-weight:700;font-size:13.5px;cursor:pointer;margin-top:12px;font-family:inherit;display:block;width:100%}
  .mt-err{color:#c0392b;font-size:13px;margin:2px 0 8px;min-height:16px}
  .mt-consent{display:flex;gap:8px;align-items:flex-start;font-size:12px;color:#5B7882;text-align:left;margin:2px 0 12px}
  .mt-consent a{color:#0E5A6D;font-weight:700}
  .mt-demobar{position:fixed;left:0;right:0;bottom:0;z-index:9000;background:#fdf0e0;color:#8a5410;font-size:13px;text-align:center;padding:9px 14px;border-top:1px solid #f0d6a8}
  .mt-demobar b{color:#0E5A6D}
  .mt-demobar button{margin-left:8px;background:#0E5A6D;color:#fff;border:none;border-radius:7px;padding:4px 10px;font-size:12px;font-weight:700;cursor:pointer}
  `;
  document.head.appendChild(s);
}
const LOGO = `<span class="mk"><svg viewBox="0 0 96 96"><path d="M18 50 h13 l7 -20 9 38 8 -26 5 8 h13" fill="none" stroke="#062a33" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;

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
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showDemoBanner);
  else showDemoBanner();
  Promise.resolve().then(() => MT._emit(MT.localGet()));
}
/* ================= CLOUD MODE ================= */
else {
  MT.ready = (async () => {
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
    mountAuth();

    let unsub = null;
    A.onAuthStateChanged(auth, (u) => {
      MT.user = u;
      if (u) {
        const el = document.getElementById('mt-auth'); if (el) el.remove();
        const ref = F.doc(db, 'users', u.uid, 'apps', APP.id);
        if (unsub) unsub();
        unsub = F.onSnapshot(ref, (snap) => {
          let d = null;
          if (snap.exists()) { const raw = snap.data(); try { d = raw.json ? JSON.parse(raw.json) : null; } catch (e) { d = null; } }
          if (d === null) d = MT.localGet();
          MT.localSet(d);
          MT._emit(d);
        }, (err) => { console.error(err); MT._emit(MT.localGet()); });
      } else {
        if (unsub) { unsub(); unsub = null; }
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
