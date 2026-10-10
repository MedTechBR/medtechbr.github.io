/* ============================================================
   MedTech — acesso por produto comprado (lado do navegador)
   Mesmo contrato e MESMAS regras do backend (MedTech/backend/ACESSO-SPEC.md e
   functions/acesso.js). _testa_acesso.js compara as duas implementações.

   Carregar como <script src="/_mtacesso.js"></script> (apps sem o _mtauth, ex.:
   TráfegoTítulo) ou por import('/_mtacesso.js') (o _mtauth.js faz isso).
   Expõe window.MTAcesso.

   Enquanto nenhum produto do planos.json tiver checkout, NADA é bloqueado:
   verificar() devolve {ok:true, motivo:'livre'} sem chamar o servidor.
   Checkout "mp" (09/10/2026) = venda pelo Mercado Pago: anual e "1 mês no
   Pix" pedem o link ao servidor (função mpCheckout) e redirecionam (Pix,
   cartão ou boleto). Mensal no cartão (10/10/2026): abre um diálogo NOSSO com
   o Card Payment Brick do MercadoPago.js v2 (campos seguros do MP; o cartão
   nunca passa pelo nosso código); o token do cartão vai ao mpCheckout
   {modo:'cartao'}, que cria a assinatura já autorizada — sem conta no MP.
   Um link https no checkout continua funcionando como antes (Kiwify).
   Falha de rede ou do servidor também não bloqueia (falha aberta): a trava
   existe para quem não pagou, não para punir quem pagou quando a rede cai.
   CPF (10/10/2026): conta sem CPF cadastrado (claim mt sem c) vê o diálogo
   "Complete seu cadastro" antes do app (garantirCpf/pedirCpf, função mtCpf).
   ============================================================ */
(function () {
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;
if (G.MTAcesso) return;
var FN = 'https://southamerica-east1-medtech-c658c.cloudfunctions.net/';
var PORTAIS = ['portal', 'portal-provas'];
var DIA = 86400;
var NOMES = { condutai:'CondutAI', atbguia:'ATBguia', enfermaria:'EnfermarIA', pocusai:'PocusAI', laudai:'LaudAI', paliai:'PaliAI', calcmed:'CalcMed', guiainterno:'Guia do Interno', foco:'Foco', plantaohub:'PlantãoHub', granae:'Granaê', logbook:'Logbook', medprovas:'MedProvas', flashmed:'FlashMed (ENARE/ENAMED)', clinicamed:'ClínicaMed', cirurgiamed:'CirurgiaMed', trafegotitulo:'TráfegoTítulo', farmauti:'FarmaUTI', enarefarmacia:'Banca ENARE Farmácia', sosfarmacia:'SOS Farmácia Comercial' };
var num = function (v) { return (typeof v === 'number' && isFinite(v)) ? v : 0; };
var agoraS = function () { return Math.floor(Date.now() / 1000); };
var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]; }); };
var brl = function (v) { return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); };
var dataBR = function (s) { return new Date(s * 1000).toLocaleDateString('pt-BR'); };

/* ---------------- regras (iguais às do servidor) ---------------- */
function produtoPorId(P, id) { return ((P && P.produtos) || []).find(function (p) { return p && p.id === id; }) || null; }
function appsDaLinha(P, linha) { var l = ((P && P.linhas) || {})[linha]; return Array.isArray(l) ? l : []; }
function temCheckout(prod) { return !!prod && !prod.interno && Object.values(prod.checkout || {}).some(function (v) { return String(v || '').trim() !== ''; }); }
function linhaDoApp(P, appId) { var L = (P && P.linhas) || {}; var ks = Object.keys(L); for (var i = 0; i < ks.length; i++) if (Array.isArray(L[ks[i]]) && L[ks[i]].indexOf(appId) > -1) return ks[i]; return null; }
function cobre(prod, P, appId, mt) {
  if (!prod) return false; var a = prod.apps;
  if (a === '*') return true;
  if (a === 'tudo') return !!prod.linha && appsDaLinha(P, prod.linha).indexOf(appId) > -1;
  if (Array.isArray(a)) return a.indexOf(appId) > -1;
  if (typeof a === 'number') {
    if (!prod.linha || appsDaLinha(P, prod.linha).indexOf(appId) < 0) return false;
    if (mt === undefined || mt === null) return true;
    return (((mt.s || {})[prod.linha]) || []).indexOf(appId) > -1;
  }
  return false;
}
function vendaAtiva(P, appId) { return ((P && P.produtos) || []).some(function (p) { return temCheckout(p) && cobre(p, P, appId); }); }
/* produto de teste ("teste": true) é vendável mas não conta como venda aberta (igual ao servidor) */
function algumaVendaAtiva(P) { return ((P && P.produtos) || []).some(function (p) { return temCheckout(p) && !p.teste; }); }
function vagas(P, mt, linha, agora) {
  agora = typeof agora === 'number' ? agora : agoraS(); var n = 0; var p = (mt && mt.p) || {};
  Object.keys(p).forEach(function (id) { if (!(num(p[id]) > agora)) return; var prod = produtoPorId(P, id); if (prod && prod.linha === linha && typeof prod.apps === 'number') n += Math.max(0, Math.floor(prod.apps)); });
  return n;
}
function escolhidos(P, mt, linha) {
  var daLinha = appsDaLinha(P, linha); var lista = (((mt && mt.s) || {})[linha]) || []; var out = [];
  (Array.isArray(lista) ? lista : []).forEach(function (a) { if (daLinha.indexOf(a) > -1 && out.indexOf(a) < 0) out.push(a); });
  return out;
}
function liberado(P, mt, appId, agora) {
  agora = typeof agora === 'number' ? agora : agoraS(); mt = mt || {};
  if (!vendaAtiva(P, appId)) return { ok: true, motivo: 'livre' };
  if (((P && P.gratis) || []).indexOf(appId) > -1) return { ok: true, motivo: 'gratis' };
  if (mt.adm) return { ok: true, motivo: 'admin' };
  if (num(mt.t) > agora) return { ok: true, motivo: 'teste' };
  var linha = linhaDoApp(P, appId);
  var vg = linha ? vagas(P, mt, linha, agora) : 0;
  var es = linha ? escolhidos(P, mt, linha).slice(0, vg) : [];
  var s2 = Object.assign({}, mt.s || {}); if (linha) s2[linha] = es;
  var mtEf = Object.assign({}, mt, { s: s2 });
  var ps = mt.p || {}; var ids = Object.keys(ps);
  for (var i = 0; i < ids.length; i++) {
    if (!(num(ps[ids[i]]) > agora)) continue;
    var prod = produtoPorId(P, ids[i]);
    if (prod && cobre(prod, P, appId, mtEf)) return { ok: true, motivo: 'plano', produto: ids[i] };
  }
  var livres = Math.max(0, vg - es.length);
  if (livres > 0) return { ok: false, motivo: 'escolher', livres: livres };
  return { ok: false, motivo: 'assinar' };
}
function acessoAtivoQualquer(P, mt, agora) {
  agora = typeof agora === 'number' ? agora : agoraS();
  if (!algumaVendaAtiva(P)) return true; mt = mt || {};
  if (mt.adm) return true; if (num(mt.t) > agora) return true;
  /* produto de TESTE (R$ 5) não conta, como no servidor (10/10/2026) */
  return Object.keys(mt.p || {}).some(function (id) { var pr = produtoPorId(P, id); return num(mt.p[id]) > agora && !(pr && pr.teste); });
}

/* ---------------- catálogo, servidor, token ---------------- */
var cacheP = null, cacheEm = 0;
function carregarPlanos() {
  if (cacheP && Date.now() - cacheEm < 600000) return Promise.resolve(cacheP);
  return fetch('/planos.json', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('planos ' + r.status); return r.json(); })
    .then(function (P) { cacheP = P; cacheEm = Date.now(); return P; })
    .catch(function (e) { console.warn('MTAcesso: planos.json indisponível, nada será bloqueado', e && e.message); return { produtos: [], linhas: {} }; });
}
/* callable do Firebase por fetch: o mesmo protocolo do SDK, sem precisar dele */
function chamar(nome, dados, user) {
  return user.getIdToken().then(function (tk) {
    return fetch(FN + nome, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tk }, body: JSON.stringify({ data: dados || {} }) });
  }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) {
    if (!r.ok || j.error) { var e = new Error((j.error && j.error.message) || ('erro ' + r.status)); e.status = (j.error && j.error.status) || r.status; throw e; }
    return j.result;
  }); });
}
function lerMt(user, forcar) { return user.getIdTokenResult(!!forcar).then(function (r) { return (r && r.claims && r.claims.mt) || null; }); }
function checkoutUrl(prod, periodo, user) {
  var u = ((prod && prod.checkout) || {})[periodo]; if (!u) return '';
  var q = []; if (user && user.uid) q.push('s1=' + encodeURIComponent(user.uid)); if (user && user.email) q.push('email=' + encodeURIComponent(user.email));
  return u + (u.indexOf('?') > -1 ? '&' : '?') + q.join('&');
}
function produtosQueCobrem(P, appId) { return ((P && P.produtos) || []).filter(function (p) { return temCheckout(p) && cobre(p, P, appId); }); }
function portalDaLinha(linha) { return linha === 'provas' ? '/provas.html' : '/app.html'; }

/* ---------------- compra: Mercado Pago (checkout "mp") ou link antigo ---------------- */
function viaMP(prod, per) { return String(((prod && prod.checkout) || {})[per] || '').trim().toLowerCase() === 'mp'; }
/* anual dividido por 12 e quanto sai mais barato que 12 mensalidades (só apresentação) */
function anualPorMes(prod) { var a = Number(((prod && prod.preco) || {}).anual); return isFinite(a) && a > 0 ? Math.round(a / 12 * 100) / 100 : 0; }
function economiaAnual(prod) {
  var m = Number(((prod && prod.preco) || {}).mensal), a = Number(((prod && prod.preco) || {}).anual);
  if (!(m > 0) || !(a > 0)) return 0; var e = Math.round((1 - a / (m * 12)) * 100); return e > 0 ? e : 0;
}
/* Opções de compra de um produto: mensal, mensal avulso por Pix (se
   planos.mp_pix_mensal) e anual. `como` diz o meio de pagamento na tela. */
function opcoes(P, prod) {
  var out = [];
  if (!prod || prod.interno) return out;
  ['mensal', 'anual'].forEach(function (per) {
    var c = (prod.checkout || {})[per], v = (prod.preco || {})[per];
    if (!c || String(c).trim() === '' || v == null) return;
    var mp = viaMP(prod, per), anual = per === 'anual';
    out.push({ prod: prod, produto: prod.id, periodo: per, modo: '', preco: v, mp: mp,
      titulo: anual ? 'Anual' : 'Mensal', botao: anual ? 'Assinar anual' : 'Assinar mensal',
      rotulo: brl(v) + (anual ? ' por ano' : ' por mês'),
      porMes: anual ? anualPorMes(prod) : 0, economia: anual ? economiaAnual(prod) : 0,
      como: mp ? (anual ? 'Pix, cartão em até 12x ou boleto. Pagamento único, sem renovação automática.' : 'Cartão de crédito. Renova sozinho todo mês. Cancele quando quiser.') : '' });
    if (mp && per === 'mensal' && P && P.mp_pix_mensal === true) {
      out.push({ prod: prod, produto: prod.id, periodo: 'mensal', modo: 'pix', preco: v, mp: true, secundaria: true,
        titulo: '1 mês (Pix ou cartão)', botao: 'Pagar 1 mês', rotulo: brl(v) + ' por 1 mês', porMes: 0, economia: 0,
        como: 'Pix ou cartão de crédito à vista. Pagamento único de 1 mês, sem renovação.' });
    }
  });
  return out;
}
var MP_URL = /^https:\/\/([a-z0-9-]+\.)*mercadopago\.com(\.br)?\//i;
/* mensal no cartão com renovação = formulário do MP dentro do site */
function ehCartao(op) { return !!(op && op.mp && op.periodo === 'mensal' && !op.modo); }
/* Abre o pagamento. Mercado Pago: o servidor cria o link (preferência ou
   assinatura) e devolve a URL. Guarda o retrato do mt e o que foi escolhido
   antes de sair, para o portal saber, na volta (?pago=1), quando a liberação
   chegou e o que oferecer em "Tentar de novo". */
function comprar(op, user, extra) {
  if (!op || !user) return Promise.reject(new Error('Entre na sua conta para assinar.'));
  /* mensal no cartão: resolve {ok:true, r, mt} (assinou) ou {cancelado:true} (fechou) */
  if (ehCartao(op)) return assinarCartao(Object.assign({ op: op, user: user }, extra || {}));
  return lerMt(user, false).catch(function () { return null; }).then(function (mt) {
    try { localStorage.setItem('mt.pag.antes', JSON.stringify({ em: Date.now(), p: (mt && mt.p) || {}, produto: op.produto, periodo: op.periodo, modo: op.modo || '' })); } catch (e) {}
    if (!op.mp) {
      var u = checkoutUrl(op.prod, op.periodo, user);
      if (!u) throw new Error('Este plano ainda não está à venda.');
      G.MTAcesso.irPara(u); return u;
    }
    var dados = { produto: op.produto, periodo: op.periodo }; if (op.modo) dados.modo = op.modo;
    return chamar('mpCheckout', dados, user).then(function (r) {
      var url = r && r.url;
      if (!url || !MP_URL.test(url)) throw new Error('Não foi possível abrir o pagamento agora. Tente de novo em instantes.');
      G.MTAcesso.irPara(url); return url;
    });
  });
}
function irPara(url) { location.href = url; }

/* ---------------- assinatura mensal no cartão (formulário do Mercado Pago) ----------------
   O SDK (https://sdk.mercadopago.com/js/v2) só é baixado quando o diálogo abre.
   Card Payment Brick: os campos de número, validade e CVV são iframes do MP;
   onSubmit entrega um token de uso único, que vai ao servidor. O diálogo é
   modal de verdade (fundo inerte, foco preso, Esc fecha sem cobrar enquanto
   nada foi enviado). */
var MP_SDK = 'https://sdk.mercadopago.com/js/v2';
var _sdk = null, _pk = null;
/* Device ID do antifraude do Mercado Pago (security.js): preenche window.MP_DEVICE_SESSION_ID,
   que vai junto do token do cartão. Sem ele, a validação da assinatura tende a recusar
   (CC_VAL_433). Falha ao carregar não impede o pagamento. */
var _seg = null;
function carregarSeguranca() {
  if (_seg || G.MP_DEVICE_SESSION_ID) return;
  _seg = document.createElement('script');
  _seg.src = 'https://www.mercadopago.com/v2/security.js'; _seg.async = true;
  _seg.setAttribute('view', 'checkout');
  _seg.onerror = function () { try { _seg.remove(); } catch (e) {} _seg = null; };
  document.head.appendChild(_seg);
}
function carregarSDK() {
  if (G.MercadoPago) return Promise.resolve(G.MercadoPago);
  if (_sdk) return _sdk;
  _sdk = new Promise(function (ok, falha) {
    var s = document.createElement('script'); s.src = MP_SDK; s.async = true;
    s.onload = function () { if (G.MercadoPago) ok(G.MercadoPago); else { _sdk = null; falha(new Error('O formulário do Mercado Pago não carregou. Atualize a página e tente de novo.')); } };
    s.onerror = function () { _sdk = null; s.remove(); falha(new Error('Não foi possível carregar o formulário do Mercado Pago. Confira a internet (ou um bloqueador de anúncios) e tente de novo.')); };
    document.head.appendChild(s);
  });
  return _sdk;
}
function chavePublicaMP(user) {
  if (_pk) return Promise.resolve(_pk);
  return chamar('mpCheckout', { acao: 'chave' }, user).then(function (r) {
    if (!r || !/^(APP_USR|TEST)-/.test(String(r.publicKey || ''))) throw new Error('O pagamento com cartão ainda não está disponível. Use o anual ou o Pix por enquanto.');
    _pk = r.publicKey; return _pk;
  });
}
function cssCartao() {
  css();
  if (document.getElementById('mtc-css')) return;
  var s = document.createElement('style'); s.id = 'mtc-css';
  s.textContent = '.mta.mtc{z-index:99997}.mtc .mtc-top{display:flex;align-items:center;justify-content:space-between;gap:10px}.mtc .mta-k{margin:0}'
   + '.mtc .mtc-x{flex:none;width:44px;height:44px;border-radius:999px;border:0;background:#F1F3F6;color:#1F2329;font:600 22px/1 Inter,system-ui,sans-serif;cursor:pointer}.mtc .mtc-x:hover{background:#E3E6EA}.mtc .mtc-x:disabled{opacity:.4;cursor:default}'
   + '.mtc h2{margin-top:12px}.mtc .mtc-v{font-size:26px;font-weight:700;color:#1F2329;letter-spacing:-.01em;margin:6px 0 0}.mtc .mtc-v small{font-size:14px;font-weight:500;color:#4A515A}'
   + '.mtc .mtc-d{margin:6px 0 0;font-size:14px}.mtc .mtc-d b{color:#14633F;font-weight:600}'
   + '.mtc #mtc-brick{margin-top:12px;min-height:40px}.mtc .mta-m{margin-top:10px}.mtc .mta-m.e{background:#FDECEA;border-radius:12px;padding:10px 12px}'
   + '.mtc .mtc-ok{margin-top:16px;padding:16px;border-radius:16px;background:#E3F5EA;color:#14633F}.mtc .mtc-ok b{display:block;font-size:18px;color:#0E4D30}.mtc .mtc-ok p{color:#1F4A33;font-size:14px;margin-top:6px}'
   + '.mtc .mtc-f{font-size:12.5px;color:#4A515A;margin-top:12px;line-height:1.5}'
   + '.mtc .mtc-spin{display:inline-block;width:14px;height:14px;border:2px solid #BFC5CD;border-top-color:#2B5CE6;border-radius:50%;vertical-align:-2px;margin-right:8px;animation:mtcGira .8s linear infinite}@keyframes mtcGira{to{transform:rotate(360deg)}}';
  document.head.appendChild(s);
}
/* o = {op, user, pedirEmail} → Promise<{ok:true, r, mt} | {cancelado:true}> */
function assinarCartao(o) {
  return new Promise(function (resolver) {
    cssCartao();
    var antigo = document.getElementById('mtc'); if (antigo) antigo.remove();
    var op = o.op, user = o.user, prod = op.prod || {}, nome = prod.nome || prod.id || 'MedTech';
    var email = (user && user.email) || '', valor = brl(op.preco);
    var volta = document.activeElement, overflowAntes = document.documentElement.style.overflow;
    var ctrl = null, enviando = false, feito = null, fechado = false;
    var d = document.createElement('div'); d.className = 'mta mtc'; d.id = 'mtc';
    d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-labelledby', 'mtc-h'); d.setAttribute('aria-describedby', 'mtc-d');
    d.innerHTML = '<div class="mta-c"><div class="mtc-top"><p class="mta-k">Assinatura mensal no cartão</p>' +
      '<button type="button" class="mtc-x" data-acao="fechar" aria-label="Fechar sem assinar">&times;</button></div>' +
      '<h2 id="mtc-h" tabindex="-1">' + esc(nome) + '</h2>' +
      '<p class="mtc-v">' + esc(valor) + '<small> por mês</small></p>' +
      '<p class="mtc-d" id="mtc-d"><b>Renova todo mês · cancele quando quiser · desistência em 7 dias com reembolso total.</b></p>' +
      '<div class="mta-m" role="status" aria-live="polite"><span class="mtc-spin" aria-hidden="true"></span>Carregando o formulário seguro do Mercado Pago…</div>' +
      '<div id="mtc-brick"></div><div class="mtc-fim"></div>' +
      '<p class="mtc-f">Os dados do cartão são digitados nos campos seguros do Mercado Pago: a MedTech não vê nem guarda o número do cartão. A cobrança aparece como MEDTECH na fatura.' + (email ? ' Conta MedTech: ' + esc(email) + '.' : '') + '</p></div>';
    /* fundo inerte (inclusive a tela de assinatura, se aberta por cima dela) */
    Array.prototype.forEach.call(document.body.children, function (el) {
      if (el !== d && el.nodeType === 1 && el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE' && !el.inert) { el.inert = true; el.setAttribute('data-mtc-inert', ''); }
    });
    document.body.appendChild(d); document.documentElement.style.overflow = 'hidden';
    var msg = d.querySelector('.mta-m'), btX = d.querySelector('.mtc-x'), h = d.querySelector('#mtc-h');
    setTimeout(function () { try { h.focus({ preventScroll: true }); } catch (e) {} }, 30);
    function aviso(t, erro, girando) {
      msg.innerHTML = (girando ? '<span class="mtc-spin" aria-hidden="true"></span>' : '') + esc(t);
      msg.className = 'mta-m' + (erro ? ' e' : ''); msg.setAttribute('role', erro ? 'alert' : 'status');
    }
    function fechar() {
      if (fechado || enviando) return; fechado = true;
      try { if (ctrl) ctrl.unmount(); } catch (e) {}
      d.remove(); document.documentElement.style.overflow = overflowAntes;
      Array.prototype.forEach.call(document.querySelectorAll('[data-mtc-inert]'), function (el) { el.inert = false; el.removeAttribute('data-mtc-inert'); });
      resolver(feito || { cancelado: true });
      /* depois de quem chamou reativar o botão (microtarefas rodam antes deste setTimeout) */
      setTimeout(function () { if (volta && document.contains(volta)) { try { volta.focus({ preventScroll: true }); } catch (e) {} } }, 0);
    }
    d.addEventListener('keydown', function (e) {
      e.stopPropagation();   /* o Esc/Tab dos diálogos da página não agem por baixo deste */
      if (e.key === 'Escape') { e.preventDefault(); fechar(); return; }
      if (e.key !== 'Tab') return;
      var f = Array.prototype.filter.call(d.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea,iframe,[tabindex]:not([tabindex="-1"])'), function (x) { return x.offsetParent !== null; });
      if (!f.length) { e.preventDefault(); return; }
      var pri = f[0], ult = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === pri || document.activeElement === h)) { e.preventDefault(); ult.focus(); }
      else if (!e.shiftKey && document.activeElement === ult) { e.preventDefault(); pri.focus(); }
    });
    d.addEventListener('click', function (e) { var b = e.target.closest('[data-acao]'); if (b && b.dataset.acao === 'fechar') fechar(); });

    function ativar(r) {
      /* a claim chega pelo token renovado; tenta algumas vezes */
      var pausas = [400, 1200, 2000, 3000, 4000], i = 0, ag = agoraS();
      function vigente(mt) { return num(((mt && mt.p) || {})[op.produto]) > ag; }
      function pronto(mt, chegou) {
        enviando = false; btX.disabled = false;
        feito = { ok: true, r: r, mt: mt || null };
        d.querySelector('#mtc-brick').hidden = true;
        aviso('');
        d.querySelector('.mtc-fim').innerHTML = '<div class="mtc-ok" role="status"><b>Assinatura ativa</b>' +
          '<p>' + (chegou ? 'O ' + esc(nome) + ' já está liberado na sua conta.' : 'O Mercado Pago autorizou o cartão. O acesso ao ' + esc(nome) + ' libera em instantes; se demorar, toque em "Já assinei — atualizar".') +
          ' A primeira cobrança de ' + esc(valor) + ' é feita em até 1 hora e depois todo mês. O recibo chega por e-mail.</p></div>' +
          '<div class="mta-r"><button type="button" class="bt s" data-acao="fechar">Continuar</button></div>';
        var c = d.querySelector('.mtc-fim .bt'); setTimeout(function () { try { c.focus(); } catch (e) {} }, 30);
      }
      (function passo() {
        lerMt(user, true).catch(function () { return null; }).then(function (mt) {
          if (vigente(mt) || i >= pausas.length) { pronto(mt, vigente(mt)); return; }
          setTimeout(passo, pausas[i++]);
        });
      })();
    }
    function enviar(cd) {
      if (enviando) return Promise.reject(new Error('em andamento'));
      enviando = true; btX.disabled = true;
      aviso('Autorizando o cartão no Mercado Pago…', false, true);
      var dados = { produto: op.produto, periodo: 'mensal', modo: 'cartao', cartao: { token: String((cd && cd.token) || '') } };
      var em = cd && cd.payer && cd.payer.email; if (em) dados.cartao.email = String(em);
      var dv = G.MP_DEVICE_SESSION_ID; if (dv) dados.cartao.device = String(dv);
      return chamar('mpCheckout', dados, user).then(function (r) {
        if (!r || r.status !== 'authorized') throw new Error('O servidor de pagamentos está sendo atualizado. Nada foi cobrado; tente de novo em alguns minutos.');
        try { if (ctrl) ctrl.unmount(); } catch (e) {} ctrl = null;
        aviso('Cartão autorizado. Liberando o seu acesso…', false, true);
        ativar(r);
      }, function (e) {
        enviando = false; btX.disabled = false;
        var tm = (e && e.message) || 'O Mercado Pago não aceitou o cartão.';
        aviso(/outro cartão|de novo|Minha assinatura/.test(tm) ? tm : tm + ' Corrija os dados ou use outro cartão.', true);
        throw e;   /* devolve o botão do formulário para nova tentativa */
      });
    }

    carregarSeguranca();
    Promise.all([chavePublicaMP(user), carregarSDK()]).then(function (res) {
      if (fechado) return;
      var mp = new res[1](res[0], { locale: 'pt-BR' });
      var ini = { amount: Number(op.preco) };
      if (email && !o.pedirEmail) ini.payer = { email: email };
      return mp.bricks().create('cardPayment', 'mtc-brick', {
        initialization: ini,
        customization: {
          paymentMethods: { maxInstallments: 1, minInstallments: 1, types: { included: ['credit_card'] } },
          visual: { hideFormTitle: true, texts: { formSubmit: 'Assinar por ' + valor + '/mês' },
            style: { theme: 'default', customVariables: { baseColor: '#2B5CE6', baseColorFirstVariant: '#1E4FCB', baseColorSecondVariant: '#1A3FA8', borderRadiusLarge: '16px', borderRadiusMedium: '12px', formPadding: '0px' } } }
        },
        callbacks: {
          onReady: function () { if (!enviando && !feito) aviso(''); },
          onSubmit: function (cd) { return enviar(cd); },
          onError: function (err) {
            console.warn('Mercado Pago (formulário):', err && (err.cause || err.message));
            if (err && err.type === 'critical') aviso('O formulário do Mercado Pago falhou ao abrir. Feche e tente de novo, ou use o anual ou o Pix.', true);
          }
        }
      }).then(function (c) { ctrl = c; if (fechado) { try { c.unmount(); } catch (e) {} } });
    }).catch(function (e) { if (!fechado) aviso((e && e.message) || 'Não foi possível abrir o formulário do cartão.', true); });
  });
}

/* ---------------- tela de assinatura (trava do app) ----------------
   Diálogo modal de verdade: o resto da página fica inerte, o Tab não sai da
   tela e o Esc não a fecha (é uma trava; só fecha quando o acesso libera ou,
   no portal, quando aberta com fechavel:true). Cores com contraste AA,
   alvos de toque de 44 px e foco visível. */
var AJUDA_URL = 'https://medtechbr.com.br/ajuda.html';
function css() {
  if (document.getElementById('mta-css')) return;
  var s = document.createElement('style'); s.id = 'mta-css';
  s.textContent = '.mta{position:fixed;inset:0;z-index:99995;background:rgba(15,18,24,.72);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:max(20px,env(safe-area-inset-top)) 16px max(28px,env(safe-area-inset-bottom));font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1F2329;-webkit-text-size-adjust:100%}'
   + '.mta *{box-sizing:border-box}.mta-c{width:100%;max-width:540px;margin:auto;background:#fff;border-radius:22px;padding:26px 22px 18px;box-shadow:0 24px 60px -20px rgba(0,0,0,.5)}'
   + '.mta-k{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:#1E4FCB;background:#EAF0FE;border-radius:999px;padding:4px 12px;margin:0 0 12px}'
   + '.mta h2{color:#1F2329;font-size:23px;font-weight:700;letter-spacing:-.02em;line-height:1.2;margin:0;outline:none}.mta .mta-c h2:focus{outline:none!important;box-shadow:none!important}.mta p{font-size:15px;color:#4A515A;line-height:1.55;margin:8px 0 0}'
   + '.mta-apps{display:flex;flex-wrap:wrap;gap:6px;margin:14px 0 0;padding:0;list-style:none}.mta-apps li{font-size:13px;font-weight:600;color:#1F2329;background:#F1F3F6;border-radius:999px;padding:5px 11px}.mta-apps li.at{background:#1F2329;color:#fff}'
   + '.mta-prod{margin-top:18px}.mta-prod+.mta-prod{padding-top:16px;border-top:1px solid #E3E6EA}.mta-prod h3{font-size:16px;font-weight:700;margin:0;color:#1F2329}.mta-prod h3+p{margin-top:2px;font-size:14px}'
   + '.mta-l{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}@media(max-width:480px){.mta-l{grid-template-columns:1fr}}'
   + '.mta-o{display:flex;flex-direction:column;gap:4px;padding:14px;border-radius:16px;border:1.5px solid #D5D9DF;background:#fff}.mta-o.dest{border-color:#2B5CE6;background:#F6F8FF}'
   + '.mta-o .t{font-size:13px;font-weight:700;color:#4A515A;text-transform:uppercase;letter-spacing:.04em;display:flex;justify-content:space-between;gap:6px;align-items:center}.mta-o .t em{font-style:normal;text-transform:none;letter-spacing:0;font-size:12px;font-weight:700;color:#14633F;background:#E3F5EA;border-radius:999px;padding:2px 8px}'
   + '.mta-o .v{font-size:21px;font-weight:700;color:#1F2329;letter-spacing:-.01em}.mta-o .v small{font-size:13px;font-weight:500;color:#4A515A}.mta-o .pm{font-size:13px;color:#14633F;font-weight:600}'
   + '.mta-o .c{font-size:13px;color:#4A515A;line-height:1.45;flex:1}.mta-o .bt{margin-top:8px;width:100%}'
   + '.mta a.bt,.mta button.bt{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:46px;padding:0 18px;border-radius:999px;border:1.5px solid transparent;font:600 15px Inter,system-ui,sans-serif;cursor:pointer;text-decoration:none;text-align:center;line-height:1.2}'
   + '.mta .bt.s{background:#2B5CE6;color:#fff}.mta .bt.s:hover{background:#1E4FCB}.mta .bt.g{background:#fff;color:#1F2329;border-color:#BFC5CD}.mta .bt.g:hover{background:#F1F3F6}'
   + '.mta .bt:focus-visible,.mta a:focus-visible,.mta button:focus-visible{outline:3px solid #1E4FCB;outline-offset:2px}.mta button.bt:disabled{opacity:.6;cursor:default}'
   + '.mta-x{display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:10px;font-size:13.5px;color:#4A515A}.mta-x button{background:none;border:0;padding:12px 0;min-height:44px;font:inherit;font-weight:600;color:#1E4FCB;cursor:pointer;text-decoration:underline;text-underline-offset:3px}'
   + '.mta-g{margin-top:16px;padding:12px 14px;border-radius:14px;background:#F4F6F8;font-size:13.5px;color:#3A4048;line-height:1.5}.mta-g b{color:#1F2329}'
   + '.mta-r{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}.mta-r .bt{flex:1 1 200px}'
   + '.mta-m{font-size:14px;min-height:20px;margin-top:12px;color:#3A4048}.mta-m.e{color:#B42318;font-weight:600}'
   + '.mta-who{font-size:13px;color:#4A515A;margin-top:14px;word-break:break-all}'
   + '.mta-f{display:flex;justify-content:space-between;gap:4px 14px;flex-wrap:wrap;margin-top:12px;padding-top:6px;border-top:1px solid #E3E6EA;font-size:14px}'
   + '.mta-f a,.mta-f button{display:inline-flex;align-items:center;min-height:44px;color:#1E4FCB;background:none;border:0;font:inherit;font-weight:600;cursor:pointer;padding:0 2px;text-decoration:none}.mta-f a:hover,.mta-f button:hover{text-decoration:underline}'
   + '@media(prefers-reduced-motion:no-preference){.mta-c{animation:mtaSobe .28s ease-out both}}@keyframes mtaSobe{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}';
  document.head.appendChild(s);
}
/* fundo inerte enquanto a tela está aberta (marca só o que ela mesma tornou inerte) */
var _mtaObs = null;
function _mtaInerte(el) { if (el.nodeType === 1 && el.id !== 'mta' && el.id !== 'mtc' && el.id !== 'mta-css' && el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE' && !el.inert) { el.inert = true; el.setAttribute('data-mta-inert', ''); } }
function travaFundo() {
  Array.prototype.forEach.call(document.body.children, _mtaInerte);
  if (!_mtaObs && G.MutationObserver) { _mtaObs = new MutationObserver(function (ms) { ms.forEach(function (m) { m.addedNodes.forEach(_mtaInerte); }); }); _mtaObs.observe(document.body, { childList: true }); }
}
function soltaFundo() {
  if (_mtaObs) { _mtaObs.disconnect(); _mtaObs = null; }
  Array.prototype.forEach.call(document.querySelectorAll('[data-mta-inert]'), function (el) { el.inert = false; el.removeAttribute('data-mta-inert'); });
}
var _mtaVolta = null;
function fechar() {
  var o = document.getElementById('mta'); if (o) o.remove();
  soltaFundo(); document.documentElement.style.overflow = '';
  if (_mtaVolta && document.contains(_mtaVolta)) { try { _mtaVolta.focus(); } catch (e) {} } _mtaVolta = null;
}
/* lista de apps que um produto libera (para mostrar "o que o plano inclui") */
function appsDoProduto(P, prod) {
  if (!prod) return [];
  if (prod.apps === 'tudo' || typeof prod.apps === 'number') return appsDaLinha(P, prod.linha);
  if (Array.isArray(prod.apps)) return prod.apps.filter(function (a) { return NOMES[a]; });
  return [];
}
function cartaoOpcao(op, i, user) {
  var p = op.prod, extra = typeof p.apps === 'number' ? ' Você escolhe ' + (p.apps === 1 ? '1 app' : p.apps + ' apps') + '.' : '';
  var bt = op.mp ? '<button type="button" class="bt ' + (op.periodo === 'anual' ? 's' : 'g') + '" data-acao="comprar" data-i="' + i + '">' + esc(op.botao) + '</button>'
                 : '<a class="bt s" href="' + esc(checkoutUrl(p, op.periodo, user)) + '">' + esc(op.botao) + '</a>';
  var preco = op.periodo === 'anual' ? brl(op.preco) + '<small> por ano</small>' : brl(op.preco) + '<small> por mês</small>';
  return '<div class="mta-o' + (op.periodo === 'anual' ? ' dest' : '') + '"><span class="t">' + esc(op.titulo) + (op.economia ? '<em>' + op.economia + '% a menos</em>' : '') + '</span>' +
    '<span class="v">' + preco + '</span>' + (op.porMes ? '<span class="pm">equivale a ' + esc(brl(op.porMes)) + ' por mês</span>' : '') +
    '<span class="c">' + esc(op.como + extra) + '</span>' + bt + '</div>';
}
/* o = {P, mt, appId, motivo, livres, user, signOut, onOk, fechavel} */
function paywall(o) {
  css(); var reabrindo = !!document.getElementById('mta');
  if (!reabrindo) _mtaVolta = document.activeElement;
  var volta = _mtaVolta; fechar(); _mtaVolta = volta;
  var P = o.P, mt = o.mt || {}, app = o.appId, nome = NOMES[app] || 'este app', linha = linhaDoApp(P, app), agora = agoraS();
  var d = document.createElement('div'); d.className = 'mta'; d.id = 'mta';
  d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-labelledby', 'mta-h'); d.setAttribute('aria-describedby', 'mta-d');
  var tit, txt, corpo = '', ops = [];
  if (o.motivo === 'escolher') {
    tit = 'Use uma vaga do seu plano com o ' + nome;
    txt = 'Seu plano tem ' + o.livres + (o.livres > 1 ? ' vagas livres' : ' vaga livre') + '. Escolha o ' + nome + ' para abrir agora. Dá para trocar os apps escolhidos uma vez a cada ' + (P.troca_dias || 30) + ' dias, nas Configurações do portal.';
    corpo = '<div class="mta-r"><button type="button" class="bt s" data-acao="escolher">Usar uma vaga com o ' + esc(nome) + '</button></div>';
  } else {
    var testeAcabou = num(P.teste_dias) > 0 && num(mt.t) && num(mt.t) <= agora;   /* sem teste grátis (teste_dias 0): nunca fala em teste */
    var prods = produtosQueCobrem(P, app);
    var unico = prods.length === 1 ? prods[0] : null;
    var nomeProd = unico ? (unico.nome || unico.id) : '';
    var mesmoNome = unico && unico.apps !== 'tudo' && appsDoProduto(P, unico).length <= 1;   /* ClínicaMed vende o ClínicaMed */
    if (testeAcabou) { tit = 'Seu teste grátis terminou'; txt = 'O que você registrou continua salvo na sua conta. Para voltar a usar o ' + nome + ', escolha um plano.'; }
    else if (unico && mesmoNome) { tit = 'Assine o ' + nomeProd; txt = unico.resumo || ('Assinatura do ' + nomeProd + '.'); }
    else if (unico) { tit = 'Assine o ' + nomeProd + ' para usar o ' + nome; txt = 'O ' + nome + ' faz parte do ' + nomeProd + '. Uma assinatura libera ' + (appsDoProduto(P, unico).length > 1 ? 'todos estes apps' : 'o app') + ', com a IA incluída.'; }
    else { tit = 'Assine para usar o ' + nome; txt = 'O ' + nome + ' faz parte dos planos abaixo. A IA vem incluída em todos.'; }
    ops = [];
    prods.forEach(function (p) {
      var dele = opcoes(P, p), i0 = ops.length; ops = ops.concat(dele);
      var principais = dele.map(function (op, k) { return op.secundaria ? '' : cartaoOpcao(op, i0 + k, o.user); }).join('');
      var sec = dele.map(function (op, k) { return op.secundaria ? '<button type="button" data-acao="comprar" data-i="' + (i0 + k) + '">' + esc(op.botao) + ' (' + esc(brl(op.preco)) + ', sem renovação)</button>' : ''; }).join('');
      var lista = appsDoProduto(P, p);
      corpo += '<section class="mta-prod" aria-label="' + esc(p.nome || p.id) + '">' +
        (unico ? '' : '<h3>' + esc(p.nome || p.id) + '</h3>' + (p.resumo ? '<p>' + esc(p.resumo) + '</p>' : '')) +
        (lista.length > 1 ? '<ul class="mta-apps" aria-label="Apps incluídos">' + lista.map(function (a) { return '<li' + (a === app ? ' class="at"' : '') + '>' + esc(NOMES[a] || a) + '</li>'; }).join('') + '</ul>' : '') +
        '<div class="mta-l">' + principais + '</div>' + (sec ? '<div class="mta-x">' + sec + '</div>' : '') + '</section>';
    });
    if (!ops.length) corpo += '<p>Este app ainda não está à venda. Tente de novo mais tarde.</p>';
    corpo += '<div class="mta-g"><b>Sem fidelidade · desistência em 7 dias com reembolso total.</b><br>' +
      (ops.some(function (op) { return op.mp; }) ? 'Pagamento pelo Mercado Pago: o cartão é digitado nos campos seguros dele (o anual e o Pix abrem a página do Mercado Pago). A MedTech não vê os dados do cartão.' : '') + '</div>';
    var es = linha ? escolhidos(P, mt, linha) : [];
    if (linha && vagas(P, mt, linha, agora) > 0 && es.length) {
      corpo += '<p>Ou troque um app do seu plano pelo ' + esc(nome) + ':</p><div class="mta-r">' + es.map(function (a) { return '<button type="button" class="bt g" data-acao="trocar" data-sai="' + esc(a) + '">Trocar ' + esc(NOMES[a] || a) + '</button>'; }).join('') + '</div>';
    }
  }
  var portal = portalDaLinha(linha);
  var email = o.user && o.user.email ? o.user.email : '';
  d.innerHTML = '<div class="mta-c">' +
    '<p class="mta-k">' + (linha === 'provas' ? 'MedTech Provas' : 'MedTech App') + '</p>' +
    '<h2 id="mta-h" tabindex="-1">' + esc(tit) + '</h2><p id="mta-d">' + esc(txt) + '</p>' + corpo +
    '<div class="mta-m" role="status" aria-live="polite"></div>' +
    '<div class="mta-r"><button type="button" class="bt g" data-acao="atualizar">Já assinei — atualizar</button></div>' +
    (email ? '<p class="mta-who">Conta: ' + esc(email) + '</p>' : '') +
    '<div class="mta-f"><a href="' + AJUDA_URL + '" target="_blank" rel="noopener">Dúvidas</a>' +
    (o.fechavel ? '<button type="button" data-acao="fechar">Fechar</button>' : '<a href="' + portal + '">Voltar ao portal</a>') +
    '<button type="button" data-acao="sair">Sair da conta</button></div></div>';
  document.body.appendChild(d); document.documentElement.style.overflow = 'hidden';
  travaFundo();
  var h = d.querySelector('#mta-h'); setTimeout(function () { try { h.focus({ preventScroll: true }); } catch (e) {} }, 30);
  var msg = d.querySelector('.mta-m');
  function aviso(t, erro) { msg.textContent = t; msg.className = 'mta-m' + (erro ? ' e' : ''); }
  function rever() {
    return lerMt(o.user, true).then(function (mt2) {
      var r = liberado(P, mt2, app);
      if (r.ok) { fechar(); if (o.onOk) o.onOk(r); return true; }
      o.mt = mt2; o.motivo = r.motivo; o.livres = r.livres; return false;
    });
  }
  /* foco preso: Tab e Shift+Tab giram dentro da tela; Esc não libera o app */
  d.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (o.fechavel) fechar(); return; }
    if (e.key !== 'Tab') return;
    var f = Array.prototype.filter.call(d.querySelectorAll('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])'), function (x) { return x.offsetParent !== null; });
    if (!f.length) { e.preventDefault(); return; }
    var pri = f[0], ult = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === pri || document.activeElement === h)) { e.preventDefault(); ult.focus(); }
    else if (!e.shiftKey && document.activeElement === ult) { e.preventDefault(); pri.focus(); }
  });
  d.addEventListener('click', function (e) {
    var b = e.target.closest('[data-acao]'); if (!b) return; var a = b.dataset.acao;
    if (a === 'sair') { if (o.signOut) o.signOut(); return; }
    if (a === 'fechar') { fechar(); return; }
    if (a === 'comprar') {
      var op = ops[Number(b.dataset.i)]; if (!op) return;
      b.disabled = true; aviso(ehCartao(op) ? 'Abrindo o formulário do cartão…' : 'Abrindo o pagamento seguro do Mercado Pago…');
      comprar(op, o.user).then(function (res) {
        if (!res || typeof res !== 'object') return;             /* redirecionou */
        if (res.cancelado) { b.disabled = false; aviso(''); return; }
        aviso('Conferindo a sua assinatura…');
        rever().then(function (ok) { if (!ok) { b.disabled = false; aviso('Assinatura feita. O acesso libera em instantes: toque em "Já assinei — atualizar".'); } })
          .catch(function () { b.disabled = false; aviso('Assinatura feita. Toque em "Já assinei — atualizar" em instantes.'); });
      }).catch(function (e3) { b.disabled = false; aviso((e3 && e3.message) || 'Não foi possível abrir o pagamento.', true); });
      return;
    }
    if (a === 'atualizar') {
      b.disabled = true; aviso('Conferindo a sua assinatura…'); var antes = o.motivo;
      rever().then(function (ok) { if (!ok && o.motivo !== antes) { paywall(o); return; } if (!ok) { b.disabled = false; aviso('Ainda não encontramos o pagamento nesta conta. Cartão e Pix confirmam em minutos; boleto, em até 3 dias úteis. Confira se pagou com a conta ' + (email || 'certa') + '.'); } })
        .catch(function () { b.disabled = false; aviso('Não foi possível conferir agora. Tente de novo em instantes.', true); });
      return;
    }
    if (a === 'escolher' || a === 'trocar') {
      var atuais = escolhidos(P, o.mt, linha); var novo = a === 'trocar' ? atuais.filter(function (x) { return x !== b.dataset.sai; }).concat(app) : atuais.concat(app);
      b.disabled = true; aviso('Salvando a sua escolha…');
      chamar('mtEscolherApps', { linha: linha, apps: novo }, o.user).then(function () { return rever(); }).then(function (ok) { if (!ok) paywall(o); })
        .catch(function (e2) { b.disabled = false; aviso(e2.message || 'Não foi possível salvar a escolha.', true); });
    }
  });
}

/* ---------------- CPF da conta (10/10/2026) ----------------
   O CPF identifica o cliente (pagamento, nota fiscal, liberação pelo painel).
   Fica só no servidor (função mtCpf); o token traz só o marcador mt.c = 1.
   Conta sem o marcador: depois do login e antes do app, o diálogo "Complete
   seu cadastro" pede o CPF. Esc não fecha. Admin é dispensado. Falha do
   servidor (inclusive função ainda não publicada) libera: falha aberta. */
var ILIMITADO = 4102444800, LIMIAR_ILIMITADO = ILIMITADO - 366 * DIA;
function ehIlimitado(ate) { return num(ate) >= LIMIAR_ILIMITADO; }
/* "até 12/03/2027" ou "ilimitado" */
function validade(ate) { return ehIlimitado(ate) ? 'ilimitado' : dataBR(ate); }
function soDigitos(s) { return String(s == null ? '' : s).replace(/\D/g, ''); }
function cpfValido(s) {
  var c = soDigitos(s);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  function dv(n) { var soma = 0; for (var i = 0; i < n; i++) soma += Number(c[i]) * (n + 1 - i); var r = (soma * 10) % 11; return r === 10 ? 0 : r; }
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
}
/* 000.000.000-00 enquanto digita */
function formatarCpf(s) {
  var c = soDigitos(s).slice(0, 11);
  if (c.length > 9) return c.slice(0, 3) + '.' + c.slice(3, 6) + '.' + c.slice(6, 9) + '-' + c.slice(9);
  if (c.length > 6) return c.slice(0, 3) + '.' + c.slice(3, 6) + '.' + c.slice(6);
  if (c.length > 3) return c.slice(0, 3) + '.' + c.slice(3);
  return c;
}
/* liga a máscara num campo de CPF (cursor no fim; apagar continua natural) */
function mascararCampoCpf(inp) {
  if (!inp || inp._mtCpf) return; inp._mtCpf = true;
  inp.addEventListener('input', function () { var v = formatarCpf(inp.value); if (v !== inp.value) inp.value = v; });
}
/* erros de regra (o que a pessoa precisa corrigir) × falha do servidor (libera) */
var ERROS_CPF = ['INVALID_ARGUMENT', 'ALREADY_EXISTS', 'FAILED_PRECONDITION', 'RESOURCE_EXHAUSTED', 'invalid-argument', 'already-exists', 'failed-precondition', 'resource-exhausted'];
function erroDeRegraCpf(e) { return !!e && ERROS_CPF.indexOf(String(e.status || '')) > -1; }
function salvarCpf(cpf, user) {
  return chamar('mtCpf', { cpf: soDigitos(cpf) }, user).then(function (r) {
    return user.getIdToken(true).then(function () { return r; }, function () { return r; });
  });
}
function cssCpf() {
  css();
  if (document.getElementById('mtcpf-css')) return;
  var s = document.createElement('style'); s.id = 'mtcpf-css';
  s.textContent = '.mta.mtcpf{z-index:99996}.mtcpf .mta-c{max-width:440px}'
   + '.mtcpf label{display:block;font-size:14px;font-weight:600;color:#1F2329;margin:18px 0 6px}'
   + '.mtcpf input{width:100%;min-height:48px;padding:10px 14px;border:1.5px solid #8A919A;border-radius:12px;background:#fff;color:#1F2329;font:500 18px Inter,system-ui,sans-serif;letter-spacing:.02em}'
   + '.mtcpf input:focus{outline:3px solid #1E4FCB;outline-offset:2px;border-color:#1E4FCB}.mtcpf input[aria-invalid="true"]{border-color:#B42318}'
   + '.mtcpf [hidden]{display:none!important}.mtcpf .mta-r .bt{flex:1 1 100%}.mtcpf .mta-m.e{background:#FDECEA;border-radius:12px;padding:10px 12px}';
  document.head.appendChild(s);
}
/* o = {user, signOut, fechavel, email} → Promise<{ok:true, r} | {adiado:true} | {fechado:true}> */
function pedirCpf(o) {
  return new Promise(function (resolver) {
    cssCpf();
    var antigo = document.getElementById('mtcpf'); if (antigo) antigo.remove();
    var user = o.user, email = o.email || (user && user.email) || '';
    var volta = document.activeElement, overflowAntes = document.documentElement.style.overflow, enviando = false, fim = false;
    var d = document.createElement('div'); d.className = 'mta mtcpf'; d.id = 'mtcpf';
    d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-labelledby', 'mtcpf-h'); d.setAttribute('aria-describedby', 'mtcpf-d');
    d.innerHTML = '<div class="mta-c"><p class="mta-k">Conta MedTech</p>' +
      '<h2 id="mtcpf-h" tabindex="-1">' + (o.fechavel ? 'Cadastrar CPF' : 'Complete seu cadastro') + '</h2>' +
      '<p id="mtcpf-d">Usamos o CPF para identificar sua conta, nos pagamentos e na nota fiscal. Ele fica guardado só no servidor.</p>' +
      '<form novalidate><label for="mtcpf-i">CPF</label>' +
      '<input id="mtcpf-i" name="cpf" type="text" inputmode="numeric" autocomplete="off" spellcheck="false" maxlength="14" placeholder="000.000.000-00" aria-describedby="mtcpf-m" required>' +
      '<div class="mta-m" id="mtcpf-m" role="status" aria-live="polite"></div>' +
      '<div class="mta-r"><button type="submit" class="bt s">Salvar e continuar</button></div></form>' +
      '<div class="mta-r" data-adiar hidden><button type="button" class="bt g" data-acao="adiar">Continuar e completar depois</button></div>' +
      (email ? '<p class="mta-who">Conta: ' + esc(email) + '</p>' : '') +
      '<div class="mta-f"><a href="' + AJUDA_URL + '" target="_blank" rel="noopener">Dúvidas</a>' +
      (o.fechavel ? '<button type="button" data-acao="fechar">Agora não</button>' : '') +
      (o.signOut ? '<button type="button" data-acao="sair">Sair da conta</button>' : '') + '</div></div>';
    Array.prototype.forEach.call(document.body.children, function (el) {
      if (el !== d && el.nodeType === 1 && el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE' && !el.inert) { el.inert = true; el.setAttribute('data-mtcpf-inert', ''); }
    });
    document.body.appendChild(d); document.documentElement.style.overflow = 'hidden';
    var form = d.querySelector('form'), inp = d.querySelector('#mtcpf-i'), msg = d.querySelector('#mtcpf-m'), bt = form.querySelector('button');
    mascararCampoCpf(inp);
    setTimeout(function () { try { inp.focus({ preventScroll: true }); } catch (e) {} }, 40);
    function aviso(t, erro) { msg.textContent = t; msg.className = 'mta-m' + (erro ? ' e' : ''); msg.setAttribute('role', erro ? 'alert' : 'status'); }
    function fechar(res) {
      if (fim) return; fim = true;
      d.remove(); document.documentElement.style.overflow = overflowAntes;
      Array.prototype.forEach.call(document.querySelectorAll('[data-mtcpf-inert]'), function (el) { el.inert = false; el.removeAttribute('data-mtcpf-inert'); });
      if (volta && document.contains(volta)) { try { volta.focus({ preventScroll: true }); } catch (e) {} }
      resolver(res);
    }
    d.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (o.fechavel && !enviando) fechar({ fechado: true }); return; }
      if (e.key !== 'Tab') return;
      var f = Array.prototype.filter.call(d.querySelectorAll('a[href],button:not([disabled]),input:not([disabled])'), function (x) { return x.offsetParent !== null; });
      if (!f.length) { e.preventDefault(); return; }
      var pri = f[0], ult = f[f.length - 1];
      if (e.shiftKey && document.activeElement === pri) { e.preventDefault(); ult.focus(); }
      else if (!e.shiftKey && document.activeElement === ult) { e.preventDefault(); pri.focus(); }
    });
    d.addEventListener('click', function (e) {
      var b = e.target.closest('[data-acao]'); if (!b) return;
      if (b.dataset.acao === 'sair' && o.signOut) { o.signOut(); return; }
      if (b.dataset.acao === 'fechar' && !enviando) fechar({ fechado: true });
      if (b.dataset.acao === 'adiar') fechar({ adiado: true });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (enviando) return;
      var c = soDigitos(inp.value);
      if (c.length !== 11) { inp.setAttribute('aria-invalid', 'true'); aviso('Digite os 11 números do CPF.', true); inp.focus(); return; }
      if (!cpfValido(c)) { inp.setAttribute('aria-invalid', 'true'); aviso('CPF inválido. Confira os números.', true); inp.focus(); return; }
      inp.removeAttribute('aria-invalid');
      enviando = true; bt.disabled = true; aviso('Salvando…');
      salvarCpf(c, user).then(function (r) {
        enviando = false; fechar({ ok: true, r: r });
      }, function (e2) {
        enviando = false; bt.disabled = false;
        if (erroDeRegraCpf(e2)) { inp.setAttribute('aria-invalid', /CPF/.test(e2.message || '') ? 'true' : 'false'); aviso(e2.message || 'Não foi possível salvar o CPF.', true); inp.focus(); return; }
        /* servidor fora do ar: não prende ninguém do lado de fora */
        aviso('Não conseguimos salvar agora. Você pode continuar e completar o cadastro depois.', true);
        d.querySelector('[data-adiar]').hidden = false;
        try { d.querySelector('[data-acao="adiar"]').focus(); } catch (e3) {}
      });
    });
  });
}
/* Depois do login: conta sem CPF (claim sem c) recebe o diálogo. Uma vez por página. */
var _cpfEmCurso = null;
function garantirCpf(user, signOut) {
  if (!user || user.demo) return Promise.resolve({ ok: true });
  if (_cpfEmCurso) return _cpfEmCurso;
  _cpfEmCurso = lerMt(user, false).catch(function () { return null; }).then(function (mt) {
    if (mt && (mt.c || mt.adm)) return { ok: true, motivo: mt.c ? 'cpf' : 'admin' };
    return chamar('mtCpf', { ver: true }, user).then(function (s) {
      if (s && s.temCpf) return user.getIdToken(true).then(function () { return { ok: true, motivo: 'cpf' }; }, function () { return { ok: true, motivo: 'cpf' }; });
      if (s && s.dispensa) return { ok: true, motivo: 'admin' };
      if (!s || typeof s.temCpf !== 'boolean') return { ok: true, motivo: 'falha-aberta' };
      return pedirCpf({ user: user, signOut: signOut });
    });
  }).catch(function (e) {
    console.warn('MTAcesso: CPF não conferido agora (falha aberta):', e && e.message);
    return { ok: true, motivo: 'falha-aberta' };
  }).then(function (r) { _cpfEmCurso = null; return r; });
  return _cpfEmCurso;
}

/* ---------------- verificação de entrada no app ---------------- */
/* o = {appId, user, signOut, onOk}. Resolve com {ok, motivo}.
   Primeiro o CPF (conta sem CPF completa o cadastro), depois o acesso. */
function verificar(o) {
  if (!o.user) return Promise.resolve({ ok: true, motivo: 'portal' });
  return garantirCpf(o.user, o.signOut).catch(function () { return null; }).then(function () { return verificarAcesso(o); });
}
function verificarAcesso(o) {
  var app = o.appId;
  if (!o.user || PORTAIS.indexOf(app) > -1) return Promise.resolve({ ok: true, motivo: 'portal' });
  var voltouDoPagamento = /[?&]pago=1\b/.test(location.search);
  return carregarPlanos().then(function (P) {
    if (!vendaAtiva(P, app)) return { ok: true, motivo: 'livre' };
    return lerMt(o.user, voltouDoPagamento).catch(function () { return null; }).then(function (mt) {
      if (mt && mt.v) return mt;
      /* conta sem claims: o servidor inicia o teste grátis (ou aplica uma compra pendente) */
      return chamar('mtAcesso', {}, o.user).then(function (r) { return o.user.getIdToken(true).then(function () { return (r && r.mt) || lerMt(o.user, false); }); });
    }).then(function (mt) {
      var r = liberado(P, mt, app); if (r.ok) return r;
      /* token de antes da compra: renova uma vez antes de travar */
      return lerMt(o.user, true).then(function (mt2) {
        var r2 = liberado(P, mt2, app); if (r2.ok) return r2;
        paywall({ P: P, mt: mt2, appId: app, motivo: r2.motivo, livres: r2.livres, user: o.user, signOut: o.signOut, onOk: o.onOk });
        return r2;
      });
    });
  }).catch(function (e) { console.warn('MTAcesso: verificação falhou, liberando (falha aberta):', e && e.message); return { ok: true, motivo: 'falha-aberta' }; });
}

/* Resumo para o portal (cadeados e a seção Assinatura). */
function estado(user) {
  return carregarPlanos().then(function (P) {
    var venda = algumaVendaAtiva(P);
    if (!venda || !user) return { P: P, venda: venda, mt: null };
    return lerMt(user, /[?&]pago=1\b/.test(location.search)).catch(function () { return null; }).then(function (mt) {
      if (mt && mt.v) return { P: P, venda: true, mt: mt };
      return chamar('mtAcesso', {}, user).then(function (r) { return user.getIdToken(true).then(function () { return { P: P, venda: true, mt: (r && r.mt) || null }; }); })
        .catch(function () { return { P: P, venda: true, mt: null, falha: true }; });
    });
  });
}

G.MTAcesso = { versao: 5, NOMES: NOMES, linhaDoApp: linhaDoApp, cobre: cobre, vendaAtiva: vendaAtiva, algumaVendaAtiva: algumaVendaAtiva, vagas: vagas, escolhidos: escolhidos, liberado: liberado, acessoAtivoQualquer: acessoAtivoQualquer, produtoPorId: produtoPorId, produtosQueCobrem: produtosQueCobrem,
  carregarPlanos: carregarPlanos, chamar: chamar, lerMt: lerMt, checkoutUrl: checkoutUrl, viaMP: viaMP, opcoes: opcoes, comprar: comprar, ehCartao: ehCartao, assinarCartao: assinarCartao, irPara: irPara, paywall: paywall, fechar: fechar, verificar: verificar, estado: estado, brl: brl, dataBR: dataBR, anualPorMes: anualPorMes, economiaAnual: economiaAnual, appsDoProduto: appsDoProduto, AJUDA_URL: AJUDA_URL,
  /* CPF e acesso ilimitado (10/10/2026) */
  cpfValido: cpfValido, formatarCpf: formatarCpf, mascararCampoCpf: mascararCampoCpf, pedirCpf: pedirCpf, salvarCpf: salvarCpf, garantirCpf: garantirCpf, erroDeRegraCpf: erroDeRegraCpf, ILIMITADO: ILIMITADO, ehIlimitado: ehIlimitado, validade: validade,
  _limparCache: function () { cacheP = null; } };
})();
