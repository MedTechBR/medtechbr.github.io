/* ============================================================
   MedTech — Pixel da Meta com consentimento (27/10/2026)
   Pedido do Matheus: tráfego pago no Instagram (plano B: R$ 10/dia em visitas ao site + R$ 5/dia
   mostrando de novo a quem já visitou). O Pixel mede quem veio do anúncio e quem comprou.

   LGPD: nada da Meta carrega antes do "Aceitar". Sem escolha ainda, os eventos ficam na fila da
   página; aceitou, saem; recusou, são descartados. A escolha fica em localStorage "mt.cookies"
   ("sim" | "nao") e pode ser mudada a qualquer hora pela Política de Privacidade (MTPixel.reabrir()).

   Desligado enquanto PIXEL_ID estiver vazio: não carrega nada e não mostra aviso nenhum.
   Eventos: PageView (sozinho), CompleteRegistration, InitiateCheckout e Purchase (portais).
   Purchase leva eventID = id do pagamento, para não contar duas vezes a mesma compra.
   ============================================================ */
(function () {
  "use strict";
  var PIXEL_ID = "1747270693021712";
  var CHAVE = "mt.cookies";

  function ler() { try { return localStorage.getItem(CHAVE); } catch (e) { return null; } }
  function gravar(v) { try { localStorage.setItem(CHAVE, v); } catch (e) {} }

  var fila = [], carregado = false;

  function carregar() {
    if (carregado) return;
    carregado = true;
    /* snippet oficial da Meta (fbevents.js), sem o <noscript> */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    window.fbq("init", PIXEL_ID);
    window.fbq("track", "PageView");
    fila.splice(0).forEach(function (a) { window.fbq.apply(null, a); });
  }

  function evento(nome, dados, id) {
    if (!PIXEL_ID) return;
    var a = ["track", nome, dados || {}];
    if (id) a.push({ eventID: String(id) });
    var c = ler();
    if (c === "sim") { carregar(); window.fbq.apply(null, a); }
    else if (c !== "nao") fila.push(a);
  }

  /* ---------- aviso de cookies ---------- */
  var CSS = ".mtck{position:fixed;left:16px;right:16px;bottom:16px;z-index:2147483000;max-width:560px;margin:0 auto;" +
    "background:var(--mtck-fundo);color:var(--mtck-texto);border:1px solid var(--mtck-borda);border-radius:16px;" +
    "box-shadow:0 12px 40px rgba(0,0,0,.25);padding:16px 18px;font:14px/1.5 Inter,system-ui,-apple-system,sans-serif;" +
    "--mtck-fundo:#fff;--mtck-texto:#1b1d22;--mtck-borda:#dfe3ea;--mtck-sec:#eef1f6;--mtck-pri:#1d4ed8}" +
    "@media (prefers-color-scheme:dark){.mtck{--mtck-fundo:#15171c;--mtck-texto:#eceef2;--mtck-borda:#2c3038;--mtck-sec:#23262d;--mtck-pri:#3b6ff0}}" +
    "body[data-linha] .mtck,body[data-home] .mtck{--mtck-fundo:#111317;--mtck-texto:#eceef2;--mtck-borda:#2c3038;--mtck-sec:#23262d;--mtck-pri:#3b6ff0}" +
    ".mtck p{margin:0 0 12px}.mtck a{color:inherit;text-decoration:underline}" +
    ".mtck-b{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}" +
    ".mtck button{font:inherit;font-weight:600;border:0;border-radius:999px;padding:9px 18px;cursor:pointer;min-height:40px}" +
    ".mtck .nao{background:var(--mtck-sec);color:var(--mtck-texto)}.mtck .sim{background:var(--mtck-pri);color:#fff}" +
    ".mtck button:focus-visible{outline:2px solid var(--mtck-pri);outline-offset:2px}";

  function aviso() {
    if (document.getElementById("mtck")) return;
    if (!document.getElementById("mtck-css")) {
      var st = document.createElement("style"); st.id = "mtck-css"; st.textContent = CSS; document.head.appendChild(st);
    }
    var d = document.createElement("div");
    d.className = "mtck"; d.id = "mtck"; d.setAttribute("role", "region"); d.setAttribute("aria-label", "Cookies");
    d.innerHTML = "<p>Usamos cookies da Meta (Facebook e Instagram) para medir os nossos anúncios. " +
      "O site funciona igual se você recusar. <a href=\"/privacidade.html#cookies\">Saiba mais</a></p>" +
      "<div class=\"mtck-b\"><button type=\"button\" class=\"nao\">Recusar</button><button type=\"button\" class=\"sim\">Aceitar</button></div>";
    d.querySelector(".sim").onclick = function () { gravar("sim"); d.remove(); carregar(); };
    d.querySelector(".nao").onclick = function () { gravar("nao"); fila.length = 0; d.remove(); };
    document.body.appendChild(d);
  }

  function iniciar() {
    if (!PIXEL_ID) return;
    var c = ler();
    if (c === "sim") carregar();
    else if (c !== "nao") aviso();
  }

  window.MTPixel = {
    ativo: !!PIXEL_ID,
    evento: evento,
    /* compra aprovada: valor do plano em reais; id = pagamento/assinatura (evita contar duas vezes) */
    compra: function (produto, periodo, valor, id) {
      evento("Purchase", { value: Number(valor) || 0, currency: "BRL", content_ids: [produto], content_type: "product", content_name: produto + " " + (periodo || "") }, id);
    },
    /* volta o aviso para a pessoa mudar a escolha (link na Política de Privacidade) */
    reabrir: function () {
      if (!PIXEL_ID) return false;
      try { localStorage.removeItem(CHAVE); } catch (e) {}
      aviso();
      return true;
    }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
