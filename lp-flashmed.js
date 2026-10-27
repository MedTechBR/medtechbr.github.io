/* Página do anúncio do FlashMed (rascunho de 27/10/2026): vídeo, carrossel de telas, botão fixo de assinatura
   e repasse de utm/cupom para o checkout. Carregado só por flashmed-enare-enamed-nova.html, depois do vitrine.js. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var PARADO = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- vídeo: sem som, em loop; só começa a baixar depois que a página carregou ---------- */
  var v = $("#lpVid"), bt = $("#lpPlay");
  if (v && bt) {
    var economia = !!(navigator.connection && navigator.connection.saveData);
    var querTocar = !PARADO && !economia, pausadoPeloUsuario = !querTocar, visivel = true;
    v.muted = true;
    function marca() {
      var tocando = !v.paused;
      bt.classList.toggle("parado", !tocando);
      bt.setAttribute("aria-pressed", tocando ? "false" : "true");
      $(".lp-rot", bt).textContent = tocando ? "Pausar o vídeo" : "Tocar o vídeo";
    }
    function toca() { v.preload = "auto"; var p = v.play(); if (p && p.catch) p.catch(function () { marca(); }); }
    bt.hidden = false; marca();
    bt.addEventListener("click", function () {
      if (v.paused) { pausadoPeloUsuario = false; toca(); } else { pausadoPeloUsuario = true; v.pause(); }
    });
    v.addEventListener("play", marca); v.addEventListener("pause", marca);
    var comeca = function () { if (!pausadoPeloUsuario && visivel) toca(); };
    if (document.readyState === "complete") setTimeout(comeca, 100); else addEventListener("load", function () { setTimeout(comeca, 100); });
    /* fora da tela, pausa (bateria e dados); voltando, segue de onde parou */
    if ("IntersectionObserver" in window) new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        visivel = e.isIntersecting;
        if (!visivel && !v.paused) v.pause();
        else if (visivel && v.paused && !pausadoPeloUsuario && v.preload === "auto") toca();
      });
    }, { threshold: 0.2 }).observe(v);
  }

  /* ---------- carrossel: deslizar com o dedo (scroll-snap nativo), pontos, setas e teclado ---------- */
  var tr = $("#lpTrilho");
  if (tr) {
    var telas = $$(".lp-tela", tr), pontos = $("#lpPontos"), ant = $("#lpAnt"), prox = $("#lpProx"), nav = $(".lp-nav"), atual = 0;
    pontos.innerHTML = telas.map(function (_, i) { return '<button type="button" aria-label="Tela ' + (i + 1) + " de " + telas.length + '"></button>'; }).join("");
    var bts = $$("button", pontos);
    function ativa(i) {
      atual = i;
      bts.forEach(function (b, k) { b.setAttribute("aria-current", k === i ? "true" : "false"); });
      var fim = tr.scrollLeft + tr.clientWidth >= tr.scrollWidth - 4;
      ant.disabled = tr.scrollLeft <= 4; prox.disabled = fim;
    }
    var padL = function () { return parseFloat(getComputedStyle(tr).scrollPaddingLeft) || 0; };
    var pos = function (t) { return t.offsetLeft - tr.offsetLeft - padL(); };
    function vai(i) {
      i = Math.max(0, Math.min(telas.length - 1, i));
      tr.scrollTo({ left: pos(telas[i]), behavior: PARADO ? "auto" : "smooth" });
    }
    /* tela "atual" = a mais à esquerda visível */
    function qual() {
      var x = tr.scrollLeft, melhor = 0, d = 1e9;
      telas.forEach(function (t, k) { var dd = Math.abs(pos(t) - x); if (dd < d) { d = dd; melhor = k; } });
      return melhor;
    }
    var raf = 0;
    tr.addEventListener("scroll", function () { if (raf) return; raf = requestAnimationFrame(function () { raf = 0; ativa(qual()); }); }, { passive: true });
    bts.forEach(function (b, k) { b.addEventListener("click", function () { vai(k); }); });
    ant.addEventListener("click", function () { vai(atual - 1); });
    prox.addEventListener("click", function () { vai(atual + 1); });
    tr.addEventListener("keydown", function (e) {
      var k = { ArrowRight: atual + 1, ArrowLeft: atual - 1, Home: 0, End: telas.length - 1 }[e.key];
      if (k === undefined) return;
      e.preventDefault(); vai(k);
    });
    /* tudo cabe na largura (computador): sem setas nem pontos */
    function confere() { nav.hidden = tr.scrollWidth <= tr.clientWidth + 4; ativa(qual()); }
    if ("ResizeObserver" in window) new ResizeObserver(confere).observe(tr); else addEventListener("resize", confere);
    confere();
  }

  /* ---------- botão fixo "Assinar" (celular): aparece depois do "Ver o plano", some com o bloco de preço à vista ---------- */
  var fixo = $("#lpFixo"), ver = $("#lpVer"), plano = $("#plano");
  if (fixo && ver && plano && "IntersectionObserver" in window) {
    var celular = matchMedia("(max-width: 760px)");
    var passouTopo = false, precoVisivel = false;
    fixo.hidden = false;
    function atualiza() {
      var mostra = celular.matches && passouTopo && !precoVisivel && !document.getElementById("mtck");
      fixo.classList.toggle("on", mostra);
      if (mostra) { fixo.removeAttribute("inert"); fixo.removeAttribute("aria-hidden"); }
      else { fixo.setAttribute("inert", ""); fixo.setAttribute("aria-hidden", "true"); }
    }
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { passouTopo = !e.isIntersecting && e.boundingClientRect.top < 80; });
      atualiza();
    }, { rootMargin: "-64px 0px 0px 0px" }).observe(ver);
    new IntersectionObserver(function (es) { es.forEach(function (e) { precoVisivel = e.isIntersecting; }); atualiza(); }, { threshold: 0.15 }).observe(plano);
    /* o aviso de cookies do _mtpixel.js também mora no rodapé: enquanto ele estiver aberto, o botão fixo espera */
    new MutationObserver(atualiza).observe(document.body, { childList: true });
    if (celular.addEventListener) celular.addEventListener("change", atualiza);
    atualiza();
  }

  /* ---------- aviso de cookies (faixa compacta do _mtpixel.js): enquanto aberto, o vídeo encolhe a altura dele,
     para o "Ver o plano" continuar à vista na primeira tela ---------- */
  var raiz = document.documentElement;
  function aviso() {
    var a = document.getElementById("mtck");
    var h = a ? Math.ceil(innerHeight - a.getBoundingClientRect().top) + 8 : 0;
    raiz.style.setProperty("--lp-aviso", h + "px");
  }
  new MutationObserver(aviso).observe(document.body, { childList: true });
  addEventListener("resize", aviso); aviso();

  /* ---------- utm e cupom do anúncio seguem para o checkout ---------- */
  try {
    var q = new URLSearchParams(location.search), leva = [];
    q.forEach(function (val, chave) { if (/^utm_[a-z_]+$/i.test(chave) || chave.toLowerCase() === "cupom") leva.push([chave, val]); });
    if (leva.length) $$("a[data-checkout]").forEach(function (a) {
      var u = new URL(a.getAttribute("href"), location.href);
      leva.forEach(function (p) { if (!u.searchParams.has(p[0])) u.searchParams.set(p[0], p[1]); });
      a.setAttribute("href", u.pathname.replace(/^\//, "") + u.search);
    });
  } catch (e) {}
})();
