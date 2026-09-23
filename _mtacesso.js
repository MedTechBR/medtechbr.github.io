/* ============================================================
   MedTech — acesso por produto comprado (lado do navegador)
   Mesmo contrato e MESMAS regras do backend (MedTech/backend/ACESSO-SPEC.md e
   functions/acesso.js). _testa_acesso.js compara as duas implementações.

   Carregar como <script src="/_mtacesso.js"></script> (apps sem o _mtauth, ex.:
   TráfegoTítulo) ou por import('/_mtacesso.js') (o _mtauth.js faz isso).
   Expõe window.MTAcesso.

   Enquanto nenhum produto do planos.json tiver link de checkout, NADA é
   bloqueado: verificar() devolve {ok:true, motivo:'livre'} sem chamar o servidor.
   Falha de rede ou do servidor também não bloqueia (falha aberta): a trava
   existe para quem não pagou, não para punir quem pagou quando a rede cai.
   ============================================================ */
(function () {
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;
if (G.MTAcesso) return;
var FN = 'https://southamerica-east1-medtech-c658c.cloudfunctions.net/';
var PORTAIS = ['portal', 'portal-provas'];
var DIA = 86400;
var NOMES = { condutai:'CondutAI', atbguia:'ATBguia', enfermaria:'EnfermarIA', pocusai:'PocusAI', laudai:'LaudAI', paliai:'PaliAI', calcmed:'CalcMed', guiainterno:'Guia do Interno', foco:'Foco', plantaohub:'PlantãoHub', granae:'Granaê', logbook:'Logbook', medprovas:'MedProvas', flashmed:'FlashMed', clinicamed:'ClínicaMed', trafegotitulo:'TráfegoTítulo' };
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
function algumaVendaAtiva(P) { return ((P && P.produtos) || []).some(temCheckout); }
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
  return Object.values(mt.p || {}).some(function (ate) { return num(ate) > agora; });
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

/* ---------------- tela de assinatura (tema Astra) ---------------- */
function css() {
  if (document.getElementById('mta-css')) return;
  var s = document.createElement('style'); s.id = 'mta-css';
  s.textContent = '.mta{position:fixed;inset:0;z-index:99995;background:rgba(0,0,0,.86);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:max(24px,env(safe-area-inset-top)) 16px 32px;font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#fff}'
   + '.mta *{box-sizing:border-box}.mta-c{width:100%;max-width:520px;margin:auto;background:#0B0B0C;border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:26px}'
   + '.mta h2{font-size:22px;font-weight:500;letter-spacing:-.02em;line-height:1.25;margin:0}.mta p{font-size:14.5px;color:rgba(255,255,255,.62);line-height:1.55;margin:10px 0 0}'
   + '.mta-l{display:flex;flex-direction:column;gap:8px;margin-top:20px}.mta-o{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-radius:14px;background:rgba(255,255,255,.06)}'
   + '.mta-o b{display:block;font-size:15px;font-weight:500}.mta-o small{display:block;font-size:12.5px;color:rgba(255,255,255,.6);margin-top:2px}'
   + '.mta a.bt,.mta button.bt{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:0 18px;border-radius:999px;border:0;font:500 14px Inter,system-ui,sans-serif;cursor:pointer;text-decoration:none;white-space:nowrap}'
   + '.mta .bt.s{background:#fff;color:#000}.mta .bt.s:hover{background:#e6e6e6}.mta .bt.g{background:rgba(255,255,255,.12);color:#fff}.mta .bt.g:hover{background:rgba(255,255,255,.2)}'
   + '.mta-r{display:flex;gap:8px;flex-wrap:wrap;margin-top:20px}.mta-m{font-size:13px;min-height:18px;margin-top:12px;color:rgba(255,255,255,.62)}.mta-m.e{color:#F87171}'
   + '.mta-f{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:22px;padding-top:16px;border-top:1px solid rgba(255,255,255,.12);font-size:13px}'
   + '.mta-f a,.mta-f button{color:rgba(255,255,255,.62);background:none;border:0;font:inherit;cursor:pointer;padding:8px 0;text-decoration:none}.mta-f a:hover,.mta-f button:hover{color:#fff}';
  document.head.appendChild(s);
}
function fechar() { var o = document.getElementById('mta'); if (o) o.remove(); document.documentElement.style.overflow = ''; }
/* o = {P, mt, appId, motivo, livres, user, signOut, onOk} */
function paywall(o) {
  css(); fechar();
  var P = o.P, mt = o.mt || {}, app = o.appId, nome = NOMES[app] || 'este app', linha = linhaDoApp(P, app), agora = agoraS();
  var d = document.createElement('div'); d.className = 'mta'; d.id = 'mta'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true');
  var tit, txt, corpo = '';
  if (o.motivo === 'escolher') {
    tit = 'Use uma vaga do seu plano com o ' + nome;
    txt = 'Seu plano tem ' + o.livres + (o.livres > 1 ? ' vagas livres' : ' vaga livre') + '. Escolha o ' + nome + ' para abrir agora. Dá para trocar os apps escolhidos uma vez a cada ' + (P.troca_dias || 30) + ' dias, nas Configurações do portal.';
    corpo = '<div class="mta-r"><button class="bt s" data-acao="escolher">Usar uma vaga com o ' + esc(nome) + '</button></div>';
  } else {
    var testeAcabou = num(mt.t) && num(mt.t) <= agora;
    tit = testeAcabou ? 'Seu teste grátis terminou' : 'Assine para usar o ' + nome;
    txt = testeAcabou ? 'O que você registrou continua salvo na sua conta. Para voltar a usar o ' + nome + ', escolha um plano.' : 'O ' + nome + ' faz parte dos planos abaixo. A IA vem incluída em todos.';
    var prods = produtosQueCobrem(P, app);
    corpo = '<div class="mta-l">' + prods.map(function (p) {
      return Object.keys(p.checkout || {}).filter(function (per) { return p.checkout[per] && p.preco && p.preco[per] != null; }).map(function (per) {
        var extra = typeof p.apps === 'number' ? ' · você escolhe ' + (p.apps === 1 ? '1 app' : p.apps + ' apps') : '';
        return '<div class="mta-o"><span><b>' + esc(p.nome || p.id) + '</b><small>' + brl(p.preco[per]) + (per === 'anual' ? ' por ano' : ' por mês') + extra + '</small></span><a class="bt s" href="' + esc(checkoutUrl(p, per, o.user)) + '">Assinar</a></div>';
      }).join('');
    }).join('') + '</div>';
    var es = linha ? escolhidos(P, mt, linha) : [];
    if (linha && vagas(P, mt, linha, agora) > 0 && es.length) {
      corpo += '<p>Ou troque um app do seu plano pelo ' + esc(nome) + ':</p><div class="mta-r">' + es.map(function (a) { return '<button class="bt g" data-acao="trocar" data-sai="' + esc(a) + '">Trocar ' + esc(NOMES[a] || a) + '</button>'; }).join('') + '</div>';
    }
  }
  var portal = portalDaLinha(linha);
  d.innerHTML = '<div class="mta-c"><h2>' + esc(tit) + '</h2><p>' + esc(txt) + '</p>' + corpo +
    '<div class="mta-m" aria-live="polite"></div>' +
    '<div class="mta-r"><button class="bt g" data-acao="atualizar">Já assinei: atualizar</button></div>' +
    '<div class="mta-f"><a href="' + portal + '">Voltar ao portal</a><button data-acao="sair">Sair da conta</button></div></div>';
  document.body.appendChild(d); document.documentElement.style.overflow = 'hidden';
  var msg = d.querySelector('.mta-m');
  function aviso(t, erro) { msg.textContent = t; msg.className = 'mta-m' + (erro ? ' e' : ''); }
  function rever() {
    return lerMt(o.user, true).then(function (mt2) {
      var r = liberado(P, mt2, app);
      if (r.ok) { fechar(); if (o.onOk) o.onOk(r); return true; }
      o.mt = mt2; o.motivo = r.motivo; o.livres = r.livres; paywall(o); return false;
    });
  }
  d.addEventListener('click', function (e) {
    var b = e.target.closest('[data-acao]'); if (!b) return; var a = b.dataset.acao;
    if (a === 'sair') { if (o.signOut) o.signOut(); return; }
    if (a === 'atualizar') { aviso('Conferindo a sua assinatura…'); rever().then(function (ok) { if (!ok) aviso('Ainda não encontramos o pagamento. Pix e cartão confirmam em minutos; boleto leva até 3 dias úteis.'); }).catch(function () { aviso('Não foi possível conferir agora. Tente de novo em instantes.', true); }); return; }
    if (a === 'escolher' || a === 'trocar') {
      var atuais = escolhidos(P, o.mt, linha); var novo = a === 'trocar' ? atuais.filter(function (x) { return x !== b.dataset.sai; }).concat(app) : atuais.concat(app);
      b.disabled = true; aviso('Salvando a sua escolha…');
      chamar('mtEscolherApps', { linha: linha, apps: novo }, o.user).then(function () { return rever(); })
        .catch(function (e2) { b.disabled = false; aviso(e2.message || 'Não foi possível salvar a escolha.', true); });
    }
  });
}

/* ---------------- verificação de entrada no app ---------------- */
/* o = {appId, user, signOut, onOk}. Resolve com {ok, motivo}. */
function verificar(o) {
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

G.MTAcesso = { versao: 1, NOMES: NOMES, linhaDoApp: linhaDoApp, cobre: cobre, vendaAtiva: vendaAtiva, algumaVendaAtiva: algumaVendaAtiva, vagas: vagas, escolhidos: escolhidos, liberado: liberado, acessoAtivoQualquer: acessoAtivoQualquer, produtoPorId: produtoPorId, produtosQueCobrem: produtosQueCobrem,
  carregarPlanos: carregarPlanos, chamar: chamar, lerMt: lerMt, checkoutUrl: checkoutUrl, paywall: paywall, fechar: fechar, verificar: verificar, estado: estado, brl: brl, dataBR: dataBR, _limparCache: function () { cacheP = null; } };
})();
