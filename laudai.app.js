// LaudAI IA — app principal
// State + UI + Auth + Firestore sync

const state = {
  media: [],          // [{id, kind:'image'|'video'|'dicom', name, ...}]
  laudoText: '',
  generating: false,
  laudos: [],         // Firestore-backed
  unsubLaudos: null,
  ready: false,
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const LS_LANG = 'laudai_lang';
const LS_STYLE = 'laudai_style';

// URL do produto no Kiwify (preencha depois de criar o produto no painel)
// Exemplo: https://pay.kiwify.com.br/seu-id-aqui
const KIWIFY_CHECKOUT_URL = 'https://pay.kiwify.com.br/REPLACE_ME';
const SUBSCRIPTION_PRICE_LABEL = 'R$ 29,90/mês';

// ===== Init wiring =====
// ===== Login central MedTech =====
// _mtauth.js renderiza a tela de login. Quando o usuário entra, abrimos o app e
// recebemos os laudos da nuvem da conta MedTech (users/{uid}/apps/laudai) via MT.onData.
let _mtEnteredUid = null;
(function waitMT() {
  if (!window.MT) { setTimeout(waitMT, 50); return; }
  window.MT.onData((d) => {
    const u = window.MT.user;
    if (u) {
      window.currentUid = u.uid; window.currentUser = u;
      state.ready = true;
      if (_mtEnteredUid !== u.uid) { _mtEnteredUid = u.uid; enterApp(u); }
    }
    state.laudos = (d && Array.isArray(d.laudos) ? d.laudos : []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  });
})();

// ===== CPF utils =====
function maskCPF(v) {
  return String(v || '').replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}
function validateCPF(raw) {
  const cpf = String(raw || '').replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(cpf[i]) * (10 - i);
  let r = (s * 10) % 11; if (r === 10) r = 0;
  if (r !== parseInt(cpf[9])) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(cpf[i]) * (11 - i);
  r = (s * 10) % 11; if (r === 10) r = 0;
  return r === parseInt(cpf[10]);
}
function cpfToEmail(cpfRaw) {
  return `${String(cpfRaw).replace(/\D/g, '')}@cpf.laudai.app`;
}
// Firebase exige senha mínima de 6 chars. Se o usuário usar a senha padrão
// de 3 dígitos (3 primeiros do CPF), repetimos para atingir 6 chars internamente.
// Pro usuário, a senha continua sendo só "123".
function padPassword(p) {
  let s = String(p || '');
  while (s.length < 6) s = s + s;
  return s.slice(0, Math.max(6, s.length));
}

function showLanding() {
  $('#landingPage').classList.remove('hidden');
  $('#authScreen').classList.add('hidden');
  $('#mainApp').classList.add('hidden');
}

function showAuth(mode = 'login') {
  $('#landingPage').classList.add('hidden');
  $('#authScreen').classList.remove('hidden');
  $('#mainApp').classList.add('hidden');
  if (mode === 'register') {
    $('#loginForm').classList.add('hidden');
    $('#registerForm').classList.remove('hidden');
  } else {
    $('#registerForm').classList.add('hidden');
    $('#loginForm').classList.remove('hidden');
  }
}

function initAuthUI() {
  // Landing page por padrão (até auth state determinar)
  showLanding();

  // Landing CTAs
  const wireLand = (sel, mode) => { const el = $(sel); if (el) el.addEventListener('click', () => showAuth(mode)); };
  wireLand('#land-login', 'login');
  wireLand('#land-register', 'register');
  wireLand('#land-cta-1', 'register');
  wireLand('#land-cta-2', 'register');
  wireLand('#land-cta-3', 'register');

  $('#showRegister').addEventListener('click', () => {
    $('#loginForm').classList.add('hidden');
    $('#registerForm').classList.remove('hidden');
    $('#loginError').textContent = '';
    $('#registerError').textContent = '';
  });
  $('#showLoginFromReg').addEventListener('click', () => {
    $('#registerForm').classList.add('hidden');
    $('#loginForm').classList.remove('hidden');
    $('#loginError').textContent = '';
    $('#registerError').textContent = '';
  });

  // Auto-mask CPF inputs
  document.querySelectorAll('input[data-cpf]').forEach(inp => {
    inp.addEventListener('input', (e) => { e.target.value = maskCPF(e.target.value); });
  });

  // No cadastro: ao digitar CPF, pré-preencher a senha com os 3 primeiros dígitos
  // (apenas se o usuário ainda não tiver mexido na senha).
  const regCpfInput = $('#registerForm [name="cpf"]');
  const regPwdInput = $('#registerForm [name="password"]');
  let userTouchedPwd = false;
  regPwdInput.addEventListener('input', () => { userTouchedPwd = true; });
  regCpfInput.addEventListener('input', () => {
    if (userTouchedPwd) return;
    const digits = regCpfInput.value.replace(/\D/g, '');
    regPwdInput.value = digits.slice(0, 3);
  });

  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#loginError').textContent = '';
    const cpfRaw = String(e.target.cpf.value || '').replace(/\D/g, '');
    const pwd = String(e.target.password.value || '');
    if (!validateCPF(cpfRaw)) { $('#loginError').textContent = 'CPF inválido.'; return; }
    if (!pwd) { $('#loginError').textContent = 'Digite a senha.'; return; }
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      await window.fb.signInWithEmailAndPassword(window.fb.auth, cpfToEmail(cpfRaw), padPassword(pwd));
    } catch (err) {
      $('#loginError').textContent = mapAuthError(err);
    } finally {
      btn.disabled = false;
    }
  });

  $('#registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#registerError').textContent = '';
    const name = String(e.target.name.value || '').trim();
    const cpfRaw = String(e.target.cpf.value || '').replace(/\D/g, '');
    const pwd = String(e.target.password.value || '');
    if (name.length < 2) { $('#registerError').textContent = 'Informe seu nome.'; return; }
    if (!validateCPF(cpfRaw)) { $('#registerError').textContent = 'CPF inválido.'; return; }
    if (!pwd) { $('#registerError').textContent = 'Digite uma senha.'; return; }
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      const cred = await window.fb.createUserWithEmailAndPassword(window.fb.auth, cpfToEmail(cpfRaw), padPassword(pwd));
      try { await window.fb.updateProfile(cred.user, { displayName: name }); } catch {}
      // Salva perfil em Firestore
      try {
        await window.fb.setDoc(window.fb.doc(window.fb.db, 'users', cred.user.uid), {
          profile: { name, cpf: cpfRaw, createdAt: Date.now() },
        }, { merge: true });
      } catch (e) { console.warn('Falha ao salvar perfil:', e); }
    } catch (err) {
      $('#registerError').textContent = mapAuthError(err);
    } finally {
      btn.disabled = false;
    }
  });

  // Auth state observer
  window.fb.onAuthStateChanged(window.fb.auth, (user) => {
    if (user) {
      window.currentUid = user.uid;
      window.currentUser = user;
      enterApp(user);
    } else {
      window.currentUid = null;
      window.currentUser = null;
      leaveApp();
    }
  });
}

function mapAuthError(err) {
  const code = err?.code || '';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') return 'CPF ou senha incorretos.';
  if (code === 'auth/invalid-email') return 'CPF inválido.';
  if (code === 'auth/email-already-in-use') return 'CPF já cadastrado.';
  if (code === 'auth/weak-password') return 'Senha muito curta.';
  if (code === 'auth/network-request-failed') return 'Sem conexão.';
  if (code === 'auth/too-many-requests') return 'Muitas tentativas. Tente de novo em alguns minutos.';
  if (code === 'auth/missing-password') return 'Digite a senha.';
  return err?.message || 'Erro de autenticação.';
}

function enterApp(user) {
  $('#landingPage').classList.add('hidden');
  $('#authScreen').classList.add('hidden');
  $('#mainApp').classList.remove('hidden');
  const display = user.displayName || user.email || 'Usuário';
  $('#userEmail').textContent = display;
  $('#userAvatar').textContent = display.slice(0, 1).toUpperCase();

  initMainApp();
  refreshSubscriptionBadge();
}

// ===== Assinatura (badge no header) =====
state.subscription = null;

async function refreshSubscriptionBadge() {
  const badge = $('#subscription-badge');
  if (!badge) return;

  // BYOK: sem assinatura, badge mostra "Chave própria"
  if (Gemini.isByokMode()) {
    badge.innerHTML = '<span class="sub-icon">🔑</span><span>Chave própria</span>';
    badge.className = 'subscription-badge byok';
    badge.title = 'Usando sua API Key Gemini diretamente';
    return;
  }

  // Pro: consulta Cloud Function
  badge.innerHTML = '<span style="opacity:.6">…</span>';
  const sub = await Gemini.getSubscriptionStatus();
  state.subscription = sub;
  if (!sub) {
    badge.innerHTML = '<span class="sub-icon">⚠</span><span>—</span>';
    badge.className = 'subscription-badge';
    return;
  }
  if (sub.ecosystem) {
    badge.innerHTML = `<span class="sub-icon">⭐</span><span>MedTech</span>`;
    badge.className = 'subscription-badge pro';
    badge.title = 'IA incluída na sua conta MedTech';
  } else if (sub.isPaid) {
    const days = Math.ceil((sub.paidUntil - Date.now()) / 86400000);
    badge.innerHTML = `<span class="sub-icon">⭐</span><span>Pro · ${days}d</span>`;
    badge.className = 'subscription-badge pro';
    badge.title = `Pro ativo · expira em ${days} dias`;
  } else {
    const left = sub.freeRemaining;
    badge.innerHTML = `<span class="sub-icon">🎁</span><span>${left} grátis</span>`;
    badge.className = 'subscription-badge trial' + (left === 0 ? ' empty' : '');
    badge.title = left > 0 ? `${left} laudo(s) gratuito(s) restante(s)` : 'Você usou todos os laudos grátis';
  }
}

function cpfFromSyntheticEmail(email) {
  if (!email) return '';
  const m = String(email).match(/^(\d{11})@/);
  return m ? maskCPF(m[1]) : '';
}

function leaveApp() {
  showLanding();
  if (state.unsubLaudos) { state.unsubLaudos(); state.unsubLaudos = null; }
  state.laudos = [];
  state.media = [];
  state.laudoText = '';
}

// ===== Main app =====
let mainInitialized = false;
function initMainApp() {
  if (mainInitialized) {
    refreshSettingsUI();
    return;
  }
  mainInitialized = true;

  // File upload
  const uploader = $('#uploader');
  const fileInput = $('#file-input');
  fileInput.addEventListener('change', (e) => { handleFiles(e.target.files); fileInput.value = ''; });
  uploader.addEventListener('dragover', (e) => { e.preventDefault(); uploader.classList.add('dragover'); });
  uploader.addEventListener('dragleave', () => uploader.classList.remove('dragover'));
  uploader.addEventListener('drop', (e) => {
    e.preventDefault();
    uploader.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
  });
  document.addEventListener('paste', (e) => {
    if ($('#mainApp').classList.contains('hidden')) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    const files = [];
    for (const it of items) {
      if (it.kind === 'file') {
        const f = it.getAsFile();
        if (f && (f.type.startsWith('image/') || f.type.startsWith('video/'))) files.push(f);
      }
    }
    if (files.length) handleFiles(files);
  });

  $('#btn-fetch-url').addEventListener('click', () => fetchExternalUrl($('#url-input').value.trim()));
  $('#url-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); fetchExternalUrl($('#url-input').value.trim()); } });
  $('#btn-show-bookmarklet').addEventListener('click', openBookmarklet);
  $('#bookmarklet-close').addEventListener('click', closeBookmarklet);

  $('#btn-generate').addEventListener('click', generate);
  $('#btn-copy').addEventListener('click', copyLaudo);
  $('#btn-print').addEventListener('click', () => window.print());
  $('#btn-new').addEventListener('click', resetForm);

  $('#btn-settings').addEventListener('click', openSettings);
  $('#settings-cancel').addEventListener('click', closeSettings);
  $('#settings-save').addEventListener('click', saveSettings);

  $('#btn-history').addEventListener('click', openHistory);
  $('#history-close').addEventListener('click', closeHistory);
  $('#history-clear').addEventListener('click', clearHistoryAll);

  // Paywall
  const pb = $('#subscription-badge'); if (pb) pb.addEventListener('click', () => { if (!Gemini.isByokMode()) openPaywall(); });
  const pc = $('#paywall-close'); if (pc) pc.addEventListener('click', closePaywall);
  const pbyok = $('#paywall-byok'); if (pbyok) pbyok.addEventListener('click', () => { closePaywall(); openSettings(); });
  const vc = $('#video-byok-close'); if (vc) vc.addEventListener('click', closeVideoByokModal);
  const vbtn = $('#video-byok-settings'); if (vbtn) vbtn.addEventListener('click', () => { closeVideoByokModal(); openSettings(); });

  $('#btn-logout').addEventListener('click', async () => {
    if (!confirm('Sair da conta MedTech?')) return;
    if (window.MT && window.MT.signOut) window.MT.signOut();
  });

  $$('.modal-bg').forEach(bg => {
    bg.addEventListener('click', (e) => { if (e.target === bg) bg.classList.add('hidden'); });
  });

  refreshSettingsUI();
}

function refreshSettingsUI() {
  $('#model').value = Gemini.getModel();
  $('#language').value = localStorage.getItem(LS_LANG) || 'pt-BR';
  $('#style').value = localStorage.getItem(LS_STYLE) || 'estruturado';
}

// ===== Laudos na nuvem MedTech (users/{uid}/apps/laudai) =====
function subscribeLaudos() { /* laudos chegam via MT.onData (configurado no boot) */ }

async function saveLaudoToFirestore(text, ctx) {
  const list = (state.laudos || []).slice();
  list.unshift({
    id: Date.now(),
    date: new Date().toISOString(),
    modality: ctx.modality,
    region: ctx.region,
    age: ctx.age || '',
    sex: ctx.sex || '',
    text,
  });
  state.laudos = list;
  if (window.MT && window.MT.save) await window.MT.save({ laudos: list });
}

// ===== File handling =====
async function handleFiles(fileList) {
  let all = Array.from(fileList);

  // Expande ZIPs upfront — pode conter DICOM, PNG (do bookmarklet em fallback), MP4 etc.
  const expanded = [];
  for (const f of all) {
    if ((f.name || '').toLowerCase().endsWith('.zip')) {
      try {
        toast(`Extraindo ${f.name}…`);
        const inside = await Dicom.extractZipAll(f);
        if (!inside.length) { toast(`ZIP "${f.name}" está vazio.`, 'error'); continue; }
        // Se houver _DEBUG.txt do bookmarklet, mostra como toast informativo
        const dbg = inside.find(x => /^_?laudai[_-]?log|_DEBUG/i.test(x.name));
        if (dbg) {
          try { console.log('[Bookmarklet log]', await dbg.text()); } catch {}
        }
        const useful = inside.filter(x => !/^_?laudai[_-]?log|_DEBUG|readme|\.txt$/i.test(x.name));
        expanded.push(...useful);
        toast(`${useful.length} arquivo(s) extraído(s) de ${f.name}.`);
      } catch (e) {
        console.error(e);
        toast(`Erro lendo ZIP "${f.name}": ${e.message}`, 'error');
      }
    } else {
      expanded.push(f);
    }
  }
  all = expanded;

  // Categoriza por extensão/MIME (mais robusto que confiar apenas em file.type)
  const isDicom = (f) => {
    const n = (f.name || '').toLowerCase();
    if (/\.(dcm|dicom|ima)$/.test(n)) return true;
    if (f.type === 'application/dicom') return true;
    return false;
  };
  const isImage = (f) => (f.type || '').startsWith('image/') || /\.(jpe?g|png|webp|bmp|gif|tiff?)$/i.test(f.name || '');
  const isVideo = (f) => (f.type || '').startsWith('video/') || /\.(mp4|mov|webm|m4v|qt|avi|mkv)$/i.test(f.name || '');

  const dicomFiles = all.filter(isDicom);
  const imageFiles = all.filter(f => !isDicom(f) && isImage(f));
  const videoFiles = all.filter(f => !isDicom(f) && !isImage(f) && isVideo(f));
  const unknown = all.filter(f => !isDicom(f) && !isImage(f) && !isVideo(f));

  // Arquivos sem extensão (comum em export PACS) — tenta como DICOM
  for (const f of unknown) {
    const n = (f.name || '').toLowerCase();
    if (!/\.[a-z0-9]+$/.test(n)) dicomFiles.push(f);
    else console.warn('Tipo desconhecido ignorado:', f.name);
  }

  if (dicomFiles.length) {
    try {
      toast(`Carregando ${dicomFiles.length} DICOM…`);
      const rendered = await Dicom.openViewer(dicomFiles);
      for (const slice of rendered) state.media.push({ ...slice, id: Math.random().toString(36).slice(2) });
    } catch (e) {
      if (e.message !== 'Cancelado pelo usuário.') {
        console.error(e);
        toast('Erro DICOM: ' + e.message, 'error');
      }
    }
  }

  for (const f of imageFiles) {
    try { state.media.push(await processImage(f)); }
    catch (err) { console.error(err); toast(`Erro processando "${f.name}".`, 'error'); }
  }

  for (const f of videoFiles) {
    if (f.size > 2 * 1024 * 1024 * 1024) { toast(`Vídeo "${f.name}" > 2GB.`, 'error'); continue; }
    try {
      const thumbUrl = await generateVideoThumb(f);
      state.media.push({
        id: Math.random().toString(36).slice(2),
        kind: 'video', name: f.name, size: f.size,
        mimeType: f.type || 'video/mp4', file: f, thumbUrl,
      });
    } catch (err) { console.error(err); toast(`Erro processando vídeo "${f.name}".`, 'error'); }
  }

  if (!dicomFiles.length && !imageFiles.length && !videoFiles.length) {
    toast('Nenhum arquivo utilizável encontrado.', 'error');
  }

  renderThumbs();
}

function processImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1600;
        let { width, height } = img;
        if (Math.max(width, height) > MAX) {
          const s = MAX / Math.max(width, height);
          width = Math.round(width * s); height = Math.round(height * s);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        const mimeType = 'image/jpeg';
        const dataUrl = canvas.toDataURL(mimeType, 0.92);
        const base64 = dataUrl.split(',')[1];
        resolve({
          id: Math.random().toString(36).slice(2),
          kind: 'image',
          name: file.name,
          size: dataUrl.length,
          mimeType, dataUrl, base64,
        });
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function generateVideoThumb(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.src = url; video.muted = true; video.playsInline = true;
    video.addEventListener('loadeddata', () => { try { video.currentTime = Math.min(0.5, (video.duration || 1) / 2); } catch { resolve(null); } });
    video.addEventListener('seeked', () => {
      const canvas = document.createElement('canvas');
      const w = video.videoWidth || 320, h = video.videoHeight || 240;
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(video, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      URL.revokeObjectURL(url);
      resolve(dataUrl);
    });
    video.addEventListener('error', () => { URL.revokeObjectURL(url); resolve(null); });
  });
}

function fmtBytes(n) {
  if (n < 1024) return n + 'B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + 'KB';
  if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + 'MB';
  return (n / 1024 / 1024 / 1024).toFixed(2) + 'GB';
}

function renderThumbs() {
  const wrap = $('#thumbs');
  wrap.innerHTML = '';
  state.media.forEach((m, i) => {
    const div = document.createElement('div');
    div.className = 'thumb';
    if (m.kind === 'image') {
      div.innerHTML = `
        <img src="${m.dataUrl}" alt="${escapeHtml(m.name)}">
        <span class="badge">#${i + 1}</span>
        <button class="remove" data-id="${m.id}" title="Remover">×</button>
      `;
    } else if (m.kind === 'dicom') {
      div.innerHTML = `
        <img src="${m.dataUrl}" alt="${escapeHtml(m.name)}">
        <span class="badge dicom">DCM</span>
        <button class="remove" data-id="${m.id}" title="Remover">×</button>
        <div class="footer">${escapeHtml(m.label || ('Corte ' + (i + 1)))}</div>
      `;
    } else {
      div.innerHTML = `
        ${m.thumbUrl ? `<img src="${m.thumbUrl}" alt="${escapeHtml(m.name)}">` : ''}
        <span class="badge video">VÍDEO</span>
        <span class="play-ic"><svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>
        <span class="size">${fmtBytes(m.size)}</span>
        <button class="remove" data-id="${m.id}" title="Remover">×</button>
      `;
    }
    wrap.appendChild(div);
  });
  wrap.querySelectorAll('.remove').forEach(b => {
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = b.dataset.id;
      state.media = state.media.filter(m => m.id !== id);
      renderThumbs();
    });
  });
}

// ===== Generate =====
async function generate() {
  if (state.generating) return;
  // Sem chave própria o fluxo segue no plano Pro (proxy generateLaudo);
  // exigir chave aqui mataria o modo assinatura.
  const examText = $('#exam-text').value.trim();
  if (!state.media.length && !examText) {
    toast('Anexe um arquivo OU cole o texto/resultados do exame.', 'error'); return;
  }
  const region = $('#region').value.trim();
  if (!region) { toast('Informe os detalhes / região do exame.', 'error'); return; }

  state.generating = true;
  $('#btn-generate').disabled = true;
  showOutput('loading');

  const ctx = {
    modality: $('#modality').value,
    region,
    age: $('#age').value.trim(),
    sex: $('#sex').value,
    history: $('#history').value.trim(),
    examText,
    language: localStorage.getItem(LS_LANG) || 'pt-BR',
    style: localStorage.getItem(LS_STYLE) || 'estruturado',
  };

  // Include DICOM-derived metadata in context if any
  const dicomItems = state.media.filter(m => m.kind === 'dicom');
  if (dicomItems.length) {
    const meta = dicomItems[0].meta || {};
    const bits = [
      meta.modality && `Modalidade detectada: ${meta.modality}`,
      meta.studyDescription && `Study: ${meta.studyDescription}`,
      meta.seriesDescription && `Series: ${meta.seriesDescription}`,
      meta.bodyPart && `Body part: ${meta.bodyPart}`,
      meta.patientAge && `Idade DICOM: ${meta.patientAge}`,
      meta.patientSex && `Sexo DICOM: ${meta.patientSex}`,
    ].filter(Boolean);
    if (bits.length) ctx.dicomMeta = bits.join('; ');
  }

  const model = Gemini.getModel();

  try {
    // Analise de video ainda nao esta disponivel (removida junto do BYOK).
    // Em vez de falhar pedindo uma chave que nao existe mais, descarta o video
    // com aviso honesto e segue com as imagens.
    if (state.media.some(m => m.kind === 'video')) {
      toast('Análise de vídeo ainda não está disponível. Enviei só as imagens.', 'error');
      state.media = state.media.filter(m => m.kind !== 'video');
    }

    setLoader('Analisando achados…', 90);
    const result = await Gemini.generateLaudo({ media: state.media, ctx, model });
    const laudo = typeof result === 'string' ? result : result.text;

    setLoader('Salvando…', 98);
    renderLaudo(laudo, ctx);
    try {
      await saveLaudoToFirestore(laudo, ctx);
    } catch (saveErr) {
      console.warn('Falha ao salvar no Firestore:', saveErr);
      toast('Laudo gerado, mas não foi salvo na nuvem: ' + (saveErr.message || 'erro desconhecido'), 'error');
    }
    refreshSubscriptionBadge();
  } catch (err) {
    console.error(err);
    if (err.code === 'paywall' || /PAYWALL/.test(err.message || '')) {
      showOutput('empty');
      openPaywall();
    } else if (err.code === 'video-byok-required' || /VIDEO_BYOK_REQUIRED/.test(err.message || '')) {
      showOutput('empty');
      openVideoByokModal();
    } else if (err.code === 'pro-not-deployed' || /PRO_NOT_DEPLOYED/.test(err.message || '')) {
      showOutput('empty');
      toast('Plano Pro ainda não foi ativado pelo administrador. Use sua própria chave Gemini em Configurações.', 'error');
      openSettings();
    } else {
      showError(err.message || 'Falha na comunicação com a API.');
    }
  } finally {
    state.generating = false;
    $('#btn-generate').disabled = false;
  }
}

function setLoader(step, pct) {
  $('#loader-step').textContent = step;
  $('#loader-bar').style.width = Math.max(0, Math.min(100, pct)) + '%';
}

// ===== Render output =====
function showOutput(mode) {
  $('#output-empty').classList.toggle('hidden', mode !== 'empty');
  $('#output-loading').classList.toggle('hidden', mode !== 'loading');
  $('#output-result').classList.toggle('hidden', mode !== 'result');
  $('#output-error').classList.toggle('hidden', mode !== 'error');
}

function renderLaudo(markdown, ctx) {
  state.laudoText = markdown;
  const html = mdToHtml(markdown);

  const severity = detectSeverity(markdown);
  const metaEl = $('#laudo-meta');
  metaEl.innerHTML = '';
  metaEl.appendChild(makeTag(ctx.modality));
  metaEl.appendChild(makeTag(ctx.region));
  if (ctx.age || ctx.sex) metaEl.appendChild(makeTag([ctx.age, ctx.sex].filter(Boolean).join(' · ')));
  metaEl.appendChild(makeTag(new Date().toLocaleString('pt-BR')));
  if (severity) metaEl.appendChild(makeTag(severity.label, severity.cls));

  $('#laudo-content').innerHTML = html;
  const counts = {
    img: state.media.filter(m => m.kind === 'image').length,
    dcm: state.media.filter(m => m.kind === 'dicom').length,
    vid: state.media.filter(m => m.kind === 'video').length,
  };
  $('#output-meta').textContent = [
    counts.img && `${counts.img} img`,
    counts.dcm && `${counts.dcm} dcm`,
    counts.vid && `${counts.vid} vídeo`,
  ].filter(Boolean).join(' · ');
  showOutput('result');
}

function makeTag(text, cls = '') {
  const s = document.createElement('span');
  s.className = 'tag ' + cls;
  s.textContent = text;
  return s;
}

function detectSeverity(text) {
  const upper = text.toUpperCase();
  if (/ACHADO CRÍTICO|CRÍTICO\/URGENTE|URGENTE/.test(upper)) return { label: '⚠ Crítico', cls: 'crit' };
  if (/ALTERAÇÕES SIGNIFICATIVAS|SIGNIFICATIVAS/.test(upper)) return { label: 'Alterações significativas', cls: 'warn' };
  if (/ALTERAÇÕES MENORES|MENORES/.test(upper)) return { label: 'Alterações menores', cls: 'warn' };
  if (/NORMAL/.test(upper)) return { label: 'Normal', cls: 'ok' };
  return null;
}

function mdToHtml(md) {
  let html = md.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');

  const lines = html.split('\n');
  const out = [];
  let inUl = false, inOl = false, inPara = false;
  const closePara = () => { if (inPara) { out.push('</p>'); inPara = false; } };
  const closeUl = () => { if (inUl) { out.push('</ul>'); inUl = false; } };
  const closeOl = () => { if (inOl) { out.push('</ol>'); inOl = false; } };
  for (const ln of lines) {
    const t = ln.trim();
    if (!t) { closePara(); closeUl(); closeOl(); continue; }
    if (/^<h[23]>/.test(t)) { closePara(); closeUl(); closeOl(); out.push(t); continue; }
    const ulM = t.match(/^[-*]\s+(.+)$/);
    const olM = t.match(/^\d+[.)]\s+(.+)$/);
    if (ulM) { closePara(); closeOl(); if (!inUl) { out.push('<ul>'); inUl = true; } out.push(`<li>${ulM[1]}</li>`); continue; }
    if (olM) { closePara(); closeUl(); if (!inOl) { out.push('<ol>'); inOl = true; } out.push(`<li>${olM[1]}</li>`); continue; }
    closeUl(); closeOl();
    if (!inPara) { out.push('<p>'); inPara = true; } else { out.push('<br>'); }
    out.push(t);
  }
  closePara(); closeUl(); closeOl();
  return out.join('\n');
}

function showError(msg) {
  $('#error-msg').textContent = msg;
  showOutput('error');
}

async function copyLaudo() {
  try { await navigator.clipboard.writeText(state.laudoText); toast('Laudo copiado.', 'success'); }
  catch { toast('Não foi possível copiar.', 'error'); }
}

function resetForm() {
  state.media = [];
  state.laudoText = '';
  renderThumbs();
  $('#region').value = '';
  $('#age').value = '';
  $('#sex').value = '';
  $('#history').value = '';
  $('#exam-text').value = '';
  showOutput('empty');
}

// ===== Fetch URL externa (PACS, link de imagem) =====
async function fetchExternalUrl(rawUrl) {
  if (!rawUrl) { toast('Cole uma URL primeiro.', 'error'); return; }
  let url;
  try { url = new URL(rawUrl); } catch { toast('URL inválida.', 'error'); return; }

  const btn = $('#btn-fetch-url');
  btn.disabled = true;
  const oldText = btn.textContent;
  btn.textContent = 'Baixando…';
  try {
    // Detecta padrão OHIF (Clinux, Horos etc.) com ?json=<manifesto>
    const jsonParam = url.searchParams.get('json') || url.searchParams.get('url');
    if (jsonParam) {
      toast('Detectado link OHIF — tentando carregar manifesto…');
      try {
        const ohifResult = await fetchOhifManifest(jsonParam);
        if (ohifResult > 0) {
          $('#url-input').value = '';
          renderThumbs();
          toast(`${ohifResult} imagem(ns) carregada(s) do PACS.`, 'success');
          return;
        }
      } catch (e) {
        // Cai pro fluxo direto abaixo
        console.warn('OHIF fetch falhou:', e.message);
      }
    }

    const res = await fetchWithCors(url.toString());
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    const blob = await res.blob();
    const fileName = decodeURIComponent((url.pathname.split('/').pop() || 'arquivo')) || 'arquivo';

    if (ct.startsWith('image/')) {
      const file = new File([blob], fileName + (fileName.includes('.') ? '' : '.jpg'), { type: ct });
      state.media.push(await processImage(file));
      $('#url-input').value = '';
      renderThumbs();
      toast('Imagem anexada.', 'success');
    } else if (ct.startsWith('video/')) {
      const file = new File([blob], fileName + (fileName.includes('.') ? '' : '.mp4'), { type: ct });
      const thumbUrl = await generateVideoThumb(file);
      state.media.push({
        id: Math.random().toString(36).slice(2),
        kind: 'video', name: file.name, size: file.size, mimeType: file.type, file, thumbUrl,
      });
      $('#url-input').value = '';
      renderThumbs();
      toast('Vídeo anexado.', 'success');
    } else if (ct.includes('dicom') || /\.(dcm|dicom)$/i.test(fileName)) {
      const file = new File([blob], fileName, { type: 'application/dicom' });
      const rendered = await Dicom.openViewer([file]);
      for (const slice of rendered) state.media.push({ ...slice, id: Math.random().toString(36).slice(2) });
      $('#url-input').value = '';
      renderThumbs();
    } else if (ct.includes('json')) {
      // Talvez seja manifesto OHIF servido direto
      const text = await blob.text();
      const count = await parseOhifJson(text);
      if (count > 0) { $('#url-input').value = ''; renderThumbs(); toast(`${count} imagem(ns) carregada(s).`, 'success'); }
      else throw new Error('JSON não reconhecido como manifesto OHIF.');
    } else if (ct.includes('html')) {
      throw new Error('URL retornou uma página HTML. Cole o link direto para a imagem, ou use o bookmarklet.');
    } else {
      throw new Error('Tipo de conteúdo não suportado: ' + (ct || 'desconhecido'));
    }
  } catch (err) {
    console.error(err);
    let msg = err.message || 'Falha ao baixar.';
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('CORS')) {
      msg = 'O servidor do PACS bloqueou o acesso direto (CORS). Use o bookmarklet — ele captura a imagem de dentro da página do PACS.';
      // Auto-abre o modal do bookmarklet
      openBookmarklet();
    }
    toast(msg, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = oldText;
  }
}

async function fetchWithCors(url) {
  const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

async function fetchOhifManifest(manifestUrl) {
  const res = await fetchWithCors(manifestUrl);
  const text = await res.text();
  return parseOhifJson(text);
}

// Parser básico de OHIF — extrai URLs de imagens/instâncias e baixa
async function parseOhifJson(text) {
  let data;
  try { data = JSON.parse(text); } catch { return 0; }
  const urls = [];
  const visit = (node) => {
    if (!node) return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (typeof node !== 'object') return;
    // Padrões OHIF comuns: url, imageUrl, src, WadoUriUrl, fileLocation
    for (const key of ['url', 'imageUrl', 'src', 'WadoUriUrl', 'wadouri', 'fileLocation']) {
      if (typeof node[key] === 'string' && /^https?:/i.test(node[key])) urls.push(node[key]);
    }
    for (const v of Object.values(node)) visit(v);
  };
  visit(data);
  const unique = [...new Set(urls)];
  if (!unique.length) return 0;

  // Limita a 30 imagens para não estourar
  const toFetch = unique.slice(0, 30);
  let ok = 0;
  for (const u of toFetch) {
    try {
      const r = await fetchWithCors(u);
      const b = await r.blob();
      const ct = r.headers.get('content-type') || '';
      const fname = u.split('/').pop() || 'imagem';
      if (ct.startsWith('image/')) {
        const file = new File([b], fname, { type: ct });
        state.media.push(await processImage(file));
        ok++;
      } else if (ct.includes('dicom') || /\.(dcm|dicom)$/i.test(fname)) {
        // DICOM via URL — passa pelo viewer
        const file = new File([b], fname, { type: 'application/dicom' });
        try {
          const rendered = await Dicom.openViewer([file]);
          for (const slice of rendered) state.media.push({ ...slice, id: Math.random().toString(36).slice(2) });
          ok++;
        } catch {}
      }
    } catch (e) {
      console.warn('Falha em', u, e.message);
    }
  }
  return ok;
}

// ===== Bookmarklet =====
function buildBookmarkletCode() {
  // Bookmarklet: roda na página do PACS (Clinux, OHIF, qualquer viewer com ?json=manifest).
  // Lê o manifesto OHIF, baixa TODOS os DICOMs da série (não apenas a slice na tela)
  // e empacota em ZIP que o usuário arrasta para o LaudAI.
  // Fallback: se não houver manifesto, captura múltiplos canvases visíveis.
  const code = `(async()=>{
var log=[],push=function(m){log.push('['+(new Date).toISOString()+'] '+m);try{console.log('[RL]',m);}catch(e){}};
push('Start. URL='+location.href);
try{
if(!window.JSZip)await new Promise((R,E)=>{var s=document.createElement('script');s.src='https://unpkg.com/jszip@3.10.1/dist/jszip.min.js';s.onload=R;s.onerror=()=>E(new Error('JSZip falhou'));document.head.appendChild(s);});
push('JSZip loaded');
var box=document.createElement('div');box.style.cssText='position:fixed;top:20px;right:20px;background:#0a0e1a;color:#e2e8f0;padding:16px 20px;border-radius:12px;border:2px solid #06b6d4;font-family:system-ui;font-size:13px;z-index:2147483647;box-shadow:0 12px 32px rgba(0,0,0,.5);min-width:300px;max-width:400px;line-height:1.5';
box.innerHTML='<div id="rl-h" style="font-weight:700;margin-bottom:6px">LaudAI — exportando</div><div id="rl-s">Procurando manifesto OHIF…</div><div id="rl-err" style="margin-top:8px;font-size:11px;color:#f59e0b;max-height:120px;overflow-y:auto;display:none"></div>';
document.body.appendChild(box);
var st=box.querySelector('#rl-s'),hd=box.querySelector('#rl-h'),errEl=box.querySelector('#rl-err');
function showErr(m){errEl.style.display='block';errEl.innerHTML+='⚠ '+m+'<br>';}
function finalize(zip,total,label,ok){zip.file('_LAUDAI_LOG.txt',log.join('\\n'));return zip.generateAsync({type:'blob'}).then(b=>{var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='laudai-'+label+'-'+Date.now()+'.zip';a.click();if(ok){hd.textContent='✓ '+total+' arquivo(s) prontos';hd.style.color='#10b981';st.innerHTML='<span style=color:#94a3b8>Arraste o ZIP no LaudAI</span>';}else{hd.textContent='⚠ Exportação parcial / log baixado';hd.style.color='#f59e0b';}setTimeout(()=>box.remove(),30000);});}
var u=new URL(location.href),jsonUrl=u.searchParams.get('json')||u.searchParams.get('url')||u.searchParams.get('manifest'),urls=[];
push('jsonUrl='+jsonUrl);
if(jsonUrl){
  st.textContent='Baixando manifesto OHIF…';
  try{
    var mr=await fetch(jsonUrl,{credentials:'include'});
    push('Manifesto HTTP '+mr.status);
    if(!mr.ok){showErr('Manifesto HTTP '+mr.status);throw new Error('HTTP '+mr.status);}
    var ct=mr.headers.get('content-type')||'';
    push('Manifesto content-type: '+ct);
    var text=await mr.text();
    push('Manifesto body length: '+text.length);
    var data;try{data=JSON.parse(text);}catch(e){showErr('Manifesto não é JSON válido');push('Parse JSON falhou: '+e.message+'. Primeiros 200 chars: '+text.slice(0,200));throw e;}
    push('Manifesto keys: '+Object.keys(data).join(','));
    function visit(n){if(!n)return;if(Array.isArray(n))return n.forEach(visit);if(typeof n!=='object')return;['url','wadoUri','wadouri','WadoUriUrl','imageUrl','fileLocation','src','dicomweb','RetrieveURL','retrieveUrl'].forEach(function(k){if(typeof n[k]==='string'){var raw=n[k],x=raw.replace(/^wadouri:/i,'').replace(/^dicomweb:/i,'');if(/^https?:/i.test(x))urls.push(x);}});Object.values(n).forEach(visit);}
    visit(data);urls=Array.from(new Set(urls));
    push('URLs encontradas: '+urls.length);
    if(urls.length)push('Exemplo URL: '+urls[0].slice(0,150));
    else push('Manifesto sample: '+JSON.stringify(data).slice(0,500));
  }catch(e){showErr('Manifesto: '+e.message);push('Erro manifesto: '+e.message);}
}else{
  showErr('URL não tem ?json= (não é OHIF padrão)');
}
if(urls.length){
  st.textContent='Baixando 0 / '+urls.length+' DICOMs…';
  var zip=new JSZip(),fol=zip.folder('dicom'),total=urls.length,d=0,ok=0,q=urls.slice(),pad=String(total).length,statuses={};
  await Promise.all(Array.from({length:6},async()=>{while(q.length){var url=q.shift();try{var r=await fetch(url,{credentials:'include'});statuses[r.status]=(statuses[r.status]||0)+1;if(r.ok){var b=await r.blob();var idx=String(d).padStart(pad,'0'),nm=(url.split('?')[0].split('/').pop()||'inst').replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,80);if(!/\\.dcm$/i.test(nm))nm+='.dcm';fol.file(idx+'_'+nm,b);ok++;}}catch(e){statuses['err']=(statuses['err']||0)+1;}d++;st.textContent='Baixando '+d+' / '+total+' ('+ok+' ok)';}}));
  push('Status counts: '+JSON.stringify(statuses));
  push('Sucesso: '+ok+' / '+total);
  if(ok>0){st.textContent='Compactando ZIP…';await finalize(zip,ok,'pacs',true);return;}
  showErr('Nenhum DICOM baixou. Status: '+JSON.stringify(statuses));
  st.textContent='Falhou. Tentando capturar canvas…';
}
var cs=Array.from(document.querySelectorAll('canvas')).filter(c=>c.width>200&&c.height>200&&c.offsetParent);
push('Canvases visíveis: '+cs.length);
if(!cs.length){showErr('Nenhum canvas visível. Abra um exame antes.');await finalize(new JSZip(),0,'log',false);return;}
cs.sort((a,b)=>(b.width*b.height)-(a.width*a.height));
var zip2=new JSZip(),cnt=Math.min(cs.length,30);
for(var i=0;i<cnt;i++){var blob=await new Promise(r=>cs[i].toBlob(r,'image/png'));zip2.file('canvas-'+String(i).padStart(3,'0')+'.png',blob);}
push('Canvas capturados: '+cnt);
showErr('Modo fallback: '+cnt+' canvas PNG (não DICOM raw)');
await finalize(zip2,cnt,'canvas',true);
}catch(e){push('FATAL: '+e.message);try{var zipE=new JSZip();zipE.file('_LAUDAI_LOG.txt',log.join('\\n'));var bE=await zipE.generateAsync({type:'blob'});var aE=document.createElement('a');aE.href=URL.createObjectURL(bE);aE.download='laudai-log-'+Date.now()+'.zip';aE.click();}catch(_){}alert('LaudAI — erro: '+e.message+'\\nLog baixado em ZIP.');}
})();`;
  return 'javascript:' + encodeURIComponent(code);
}

function openBookmarklet() {
  $('#bookmarklet-link').setAttribute('href', buildBookmarkletCode());
  $('#modal-bookmarklet').classList.remove('hidden');
}
function closeBookmarklet() { $('#modal-bookmarklet').classList.add('hidden'); }

// ===== Paywall / Monetização =====
function openPaywall() {
  if (!$('#modal-paywall')) return;
  const sub = state.subscription || {};
  const subEl = $('#paywall-status');
  if (subEl) {
    if (sub.freeRemaining === 0) subEl.textContent = 'Você usou seus 3 laudos gratuitos.';
    else subEl.textContent = `${sub.freeRemaining || 0} laudo(s) grátis restante(s).`;
  }
  const link = $('#paywall-checkout');
  if (link) {
    const uid = window.currentUid || '';
    const url = `${KIWIFY_CHECKOUT_URL}?s1=${encodeURIComponent(uid)}`;
    link.setAttribute('href', url);
  }
  $('#paywall-price').textContent = SUBSCRIPTION_PRICE_LABEL;
  $('#modal-paywall').classList.remove('hidden');
}
function closePaywall() { $('#modal-paywall').classList.add('hidden'); }

function openVideoByokModal() {
  $('#modal-video-byok').classList.remove('hidden');
}
function closeVideoByokModal() { $('#modal-video-byok').classList.add('hidden'); }

// ===== Settings =====
function openSettings() { refreshSettingsUI(); $('#modal-settings').classList.remove('hidden'); }
function closeSettings() { $('#modal-settings').classList.add('hidden'); }
function saveSettings() {
  Gemini.setModel($('#model').value);
  localStorage.setItem(LS_LANG, $('#language').value);
  localStorage.setItem(LS_STYLE, $('#style').value);
  closeSettings();
  toast('Configurações salvas.', 'success');
}

// ===== History (Firestore-backed) =====
function openHistory() {
  const wrap = $('#history-list');
  const list = state.laudos;
  if (!list.length) {
    wrap.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-faint); font-size: 13px;">Nenhum laudo salvo ainda.</div>';
  } else {
    wrap.innerHTML = list.map(item => `
      <div class="modal-list-item" data-id="${item.id}">
        <div class="modal-list-item-top">
          <span class="modal-list-item-title">${escapeHtml(item.region)}</span>
          <span class="modal-list-item-date">${new Date(item.date).toLocaleString('pt-BR')}</span>
        </div>
        <div class="modal-list-item-sub">${escapeHtml(item.modality)}${item.age || item.sex ? ' • ' + escapeHtml([item.age, item.sex].filter(Boolean).join(', ')) : ''}</div>
      </div>
    `).join('');
    wrap.querySelectorAll('.modal-list-item').forEach(el => {
      el.addEventListener('click', () => {
        const id = parseInt(el.dataset.id);
        const item = state.laudos.find(x => x.id === id);
        if (item) {
          renderLaudo(item.text, { modality: item.modality, region: item.region, age: item.age || '', sex: item.sex || '' });
          closeHistory();
        }
      });
    });
  }
  $('#modal-history').classList.remove('hidden');
}

function closeHistory() { $('#modal-history').classList.add('hidden'); }

async function clearHistoryAll() {
  if (!confirm('Apagar todos os laudos do seu histórico? Esta ação não pode ser desfeita.')) return;
  state.laudos = [];
  if (window.MT && window.MT.save) await window.MT.save({ laudos: [] });
  toast('Histórico apagado.', 'success');
  openHistory();
}

// ===== Helpers =====
function escapeHtml(s) {
  return (s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

// PWA: o service worker é do portal MedTech (não registramos um próprio aqui).
