/* ============================================================
   MedTech — utilitários de UI compartilhados (_mtui.js)
   Substitui as cópias locais de esc()/modal()/closeModal()/toast()
   duplicadas em ~13 apps. IIFE global (apps são single-file, sem módulos).
   Contrato de DOM do modal: <div class="modal" id="modal"><div class="box">…
   (mesmas classes que os apps já estilizam — o CSS continua por app).
   Migração: 1 app por commit — no app, trocar as defs locais por:
     const esc = MTUI.esc, modal = MTUI.modal, closeModal = MTUI.closeModal;
   ============================================================ */
(function () {
  const MTUI = {};

  /* escape HTML (padrão dos apps: & < > ") */
  MTUI.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
  };

  /* modal com o FIX de empilhamento: SEMPRE remove o modal anterior antes de
     abrir (duplo-clique abria 2 modais com IDs iguais e o form vinha vazio). */
  MTUI.modal = function (html, opts) {
    const prev = document.getElementById('modal');
    if (prev) prev.remove();
    const d = document.createElement('div');
    d.className = 'modal';
    d.id = 'modal';
    d.innerHTML = '<div class="box">' + html + '</div>';
    if (!opts || opts.dismissible !== false) {
      d.onclick = function (e) { if (e.target === d) MTUI.closeModal(); };
    }
    document.body.appendChild(d);
    return d;
  };
  MTUI.closeModal = function () {
    const m = document.getElementById('modal');
    if (m) m.remove();
  };

  /* toast (portado do LaudAI — a implementação mais completa) */
  MTUI.toast = function (msg, type) {
    const el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2800);
  };

  /* persistência localStorage com try/catch padronizado */
  MTUI.loadLS = function (key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return (v == null ? (fallback ?? null) : v); }
    catch (e) { return (fallback ?? null); }
  };
  MTUI.persistLS = function (key, obj) {
    try { localStorage.setItem(key, JSON.stringify(obj)); return true; }
    catch (e) { return false; }
  };

  window.MTUI = MTUI;
})();
