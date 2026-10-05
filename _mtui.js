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
     abrir (duplo-clique abria 2 modais com IDs iguais e o form vinha vazio).
     05/10/2026 — acessível: role="dialog" + aria-modal, nome tirado do 1º título
     da caixa (ou opts.label), foco entra na caixa ([autofocus] se houver), Tab
     fica preso dentro, Esc fecha (se dismissible) e o foco volta a quem abriu.
     Mantém a <div class="modal"> (o CSS de cada app continua valendo); o
     <dialog>.showModal() mudaria o empilhamento e o fundo dos apps. */
  const FOCAVEIS = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"]),summary';
  let opener = null, seq = 0;
  MTUI.modal = function (html, opts) {
    const prev = document.getElementById('modal');
    if (prev) prev.remove();
    else opener = document.activeElement;   // troca de modal mantém quem abriu o primeiro
    const d = document.createElement('div');
    d.className = 'modal';
    d.id = 'modal';
    d.setAttribute('role', 'dialog');
    d.setAttribute('aria-modal', 'true');
    d.innerHTML = '<div class="box" tabindex="-1">' + html + '</div>';
    const box = d.firstChild;
    const tit = box.querySelector('h1,h2,h3,h4');
    if (opts && opts.label) d.setAttribute('aria-label', opts.label);
    else if (tit) { if (!tit.id) tit.id = 'mtui-tit-' + (++seq); d.setAttribute('aria-labelledby', tit.id); }
    const fecha = !opts || opts.dismissible !== false;
    if (fecha) {
      d.onclick = function (e) { if (e.target === d) MTUI.closeModal(); };
    }
    d.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && fecha) { e.stopPropagation(); MTUI.closeModal(); return; }
      if (e.key !== 'Tab') return;
      const f = Array.prototype.filter.call(d.querySelectorAll(FOCAVEIS), function (el) { return el.offsetParent !== null || el === document.activeElement; });
      if (!f.length) { e.preventDefault(); box.focus(); return; }
      const ini = f[0], fim = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === ini || document.activeElement === box)) { e.preventDefault(); fim.focus(); }
      else if (!e.shiftKey && document.activeElement === fim) { e.preventDefault(); ini.focus(); }
    });
    document.body.appendChild(d);
    const af = box.querySelector('[autofocus]');
    try { (af || box).focus({ preventScroll: true }); } catch (e) {}
    return d;
  };
  MTUI.closeModal = function () {
    const m = document.getElementById('modal');
    if (m) m.remove();
    const o = opener; opener = null;
    if (m && o && o.focus && document.contains(o)) { try { o.focus({ preventScroll: true }); } catch (e) {} }
  };

  /* toast (portado do LaudAI — a implementação mais completa).
     role="status": o leitor de tela anuncia; o texto entra um quadro depois
     de a região existir, senão alguns leitores não leem. */
  MTUI.toast = function (msg, type) {
    const el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
    (window.requestAnimationFrame || setTimeout)(function () { el.textContent = msg; });
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
