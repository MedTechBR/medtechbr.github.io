/* MedTech Teleconsulta — motor WebRTC P2P com sinalização via Firestore (medtech-c658c).
   O VÍDEO/ÁUDIO vai direto médico↔paciente (criptografado, DTLS-SRTP) — NUNCA passa
   pelo Firebase. O Firestore carrega só a sinalização (SDP/ICE, sem PHI) em
   tele/{roomId} com id não-adivinhável, apagada ao encerrar.
   Salas "loop:*" usam BroadcastChannel (teste local na mesma máquina, sem backend). */
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, addDoc, getDocs }
  from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const ICE = { iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }] };

/* ---------- sinalização: Firestore ---------- */
function fsSignal(roomId) {
  const app = getApps().length ? getApp() : initializeApp(window.MEDTECH_FB);
  const db = getFirestore(app);
  const room = doc(db, "tele", roomId);
  const unsubs = [];
  return {
    async publishOffer(offer) { await setDoc(room, { offer: { type: offer.type, sdp: offer.sdp }, at: Date.now() }); },
    async publishAnswer(answer) { await updateDoc(room, { answer: { type: answer.type, sdp: answer.sdp } }); },
    onOffer(cb) { const u = onSnapshot(room, s => { const d = s.data(); if (d && d.offer) cb(d.offer); }); unsubs.push(u); },
    onAnswer(cb) { const u = onSnapshot(room, s => { const d = s.data(); if (d && d.answer) cb(d.answer); }); unsubs.push(u); },
    async sendCand(role, cand) { await addDoc(collection(room, role + "Cands"), cand.toJSON()); },
    onCands(role, cb) { const u = onSnapshot(collection(room, role + "Cands"), s => s.docChanges().forEach(c => { if (c.type === "added") cb(c.doc.data()); })); unsubs.push(u); },
    async cleanup(owner) {
      unsubs.forEach(u => { try { u(); } catch (e) {} });
      if (!owner) return;
      try {
        for (const sub of ["callerCands", "calleeCands"]) {
          const snap = await getDocs(collection(room, sub));
          await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
        }
        await deleteDoc(room);
      } catch (e) {}
    },
  };
}

/* ---------- sinalização: BroadcastChannel (salas loop:* — teste local) ---------- */
function bcSignal(roomId) {
  const ch = new BroadcastChannel("mttele-" + roomId);
  const handlers = {};
  const state = { offer: null, answer: null };
  ch.onmessage = e => {
    const m = e.data || {};
    if (m.t === "offer") { state.offer = m.d; (handlers.offer || []).forEach(f => f(m.d)); }
    if (m.t === "answer") { state.answer = m.d; (handlers.answer || []).forEach(f => f(m.d)); }
    if (m.t === "cand") { (handlers["cand:" + m.role] || []).forEach(f => f(m.d)); }
    if (m.t === "hello" && state.offer) ch.postMessage({ t: "offer", d: state.offer }); // re-emite p/ quem entrou depois
  };
  const on = (k, f) => { (handlers[k] = handlers[k] || []).push(f); };
  return {
    async publishOffer(o) { state.offer = { type: o.type, sdp: o.sdp }; ch.postMessage({ t: "offer", d: state.offer }); },
    async publishAnswer(a) { ch.postMessage({ t: "answer", d: { type: a.type, sdp: a.sdp } }); },
    onOffer(cb) { on("offer", cb); if (state.offer) cb(state.offer); ch.postMessage({ t: "hello" }); },
    onAnswer(cb) { on("answer", cb); },
    async sendCand(role, cand) { ch.postMessage({ t: "cand", role, d: cand.toJSON() }); },
    onCands(role, cb) { on("cand:" + role, cb); },
    async cleanup() { try { ch.close(); } catch (e) {} },
  };
}

/* ---------- mídia local com fallback (aparelho sem câmera ainda entra) ---------- */
async function getLocalStream(label) {
  try { return { stream: await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 } }, audio: { echoCancellation: true, noiseSuppression: true } }), real: true }; }
  catch (e1) {
    try { return { stream: await navigator.mediaDevices.getUserMedia({ audio: true }), real: true, audioOnly: true }; }
    catch (e2) {
      // sem câmera/mic (ou permissão negada): tile com iniciais + trilha silenciosa, a conexão segue
      const cv = document.createElement("canvas"); cv.width = 640; cv.height = 480;
      const cx = cv.getContext("2d");
      const draw = () => { cx.fillStyle = "#0E141D"; cx.fillRect(0, 0, 640, 480); cx.fillStyle = "#4C8DFF"; cx.font = "700 120px system-ui"; cx.textAlign = "center"; cx.textBaseline = "middle"; cx.fillText((label || "?").slice(0, 2).toUpperCase(), 320, 240); };
      draw(); setInterval(draw, 1000);
      const stream = cv.captureStream(5);
      try {
        const ac = new (window.AudioContext || window.webkitAudioContext)();
        const dst = ac.createMediaStreamDestination();
        stream.addTrack(dst.stream.getAudioTracks()[0]);
      } catch (e) {}
      return { stream, real: false };
    }
  }
}

/* ---------- motor ---------- */
async function start(opts) {
  // opts: { roomId, role:'caller'|'callee', name, localVideo, remoteVideo, onState(st,extra), onPeerName(n) }
  const sig = opts.roomId.startsWith("loop:") ? bcSignal(opts.roomId) : fsSignal(opts.roomId);
  const pc = new RTCPeerConnection(ICE);
  const me = opts.role, other = me === "caller" ? "callee" : "caller";
  const st = s => { try { opts.onState && opts.onState(s); } catch (e) {} };
  const pending = [];
  let remoteSet = false, closed = false;

  const local = await getLocalStream(opts.name);
  local.stream.getTracks().forEach(t => pc.addTrack(t, local.stream));
  if (opts.localVideo) { opts.localVideo.srcObject = local.stream; opts.localVideo.muted = true; opts.localVideo.play().catch(() => {}); }

  const remoteStream = new MediaStream();
  pc.ontrack = e => { remoteStream.addTrack(e.track); if (opts.remoteVideo && opts.remoteVideo.srcObject !== remoteStream) { opts.remoteVideo.srcObject = remoteStream; opts.remoteVideo.play().catch(() => {}); } };

  // nome do paciente via datachannel (P2P — não passa por servidor)
  let dc;
  if (me === "caller") { dc = pc.createDataChannel("meta"); dc.onmessage = e => { try { const m = JSON.parse(e.data); if (m.name && opts.onPeerName) opts.onPeerName(m.name); } catch (x) {} }; }
  else pc.ondatachannel = e => { dc = e.channel; dc.onopen = () => { try { dc.send(JSON.stringify({ name: opts.name || "Paciente" })); } catch (x) {} }; };

  pc.onicecandidate = e => { if (e.candidate) sig.sendCand(me, e.candidate).catch(() => {}); };
  pc.onconnectionstatechange = () => {
    if (closed) return;
    const s = pc.connectionState;
    if (s === "connected") st("connected");
    else if (s === "disconnected") st("reconnecting");
    else if (s === "failed" || s === "closed") st("dropped");
  };
  const addCand = async c => { if (!remoteSet) { pending.push(c); return; } try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch (e) {} };
  sig.onCands(other, addCand);

  st("connecting");
  if (me === "caller") {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await sig.publishOffer(offer);
    st("waiting"); // aguardando o paciente entrar
    sig.onAnswer(async a => {
      if (remoteSet) return; remoteSet = true;
      await pc.setRemoteDescription(new RTCSessionDescription(a));
      for (const c of pending.splice(0)) { try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch (e) {} }
    });
  } else {
    st("waiting-offer"); // aguardando o médico abrir a sala
    let answered = false;
    sig.onOffer(async o => {
      if (answered) return; answered = true;
      await pc.setRemoteDescription(new RTCSessionDescription(o));
      remoteSet = true;
      for (const c of pending.splice(0)) { try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch (e) {} }
      const ans = await pc.createAnswer();
      await pc.setLocalDescription(ans);
      await sig.publishAnswer(ans);
      st("connecting");
    });
  }

  return {
    pc,
    audioOnly: !!local.audioOnly,
    fake: !local.real,
    toggleMic() { const t = local.stream.getAudioTracks()[0]; if (!t) return false; t.enabled = !t.enabled; return t.enabled; },
    toggleCam() { const t = local.stream.getVideoTracks()[0]; if (!t) return false; t.enabled = !t.enabled; return t.enabled; },
    async hangup() {
      closed = true;
      try { pc.close(); } catch (e) {}
      local.stream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
      await sig.cleanup(me === "caller"); // o médico (dono) apaga a sinalização
      st("ended");
    },
  };
}

window.MTTele = { start };
