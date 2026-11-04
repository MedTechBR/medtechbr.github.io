/* MedTech PWA: tela das sessões de acompanhamento sem IA, porta de SessaoView.swift e SessaoArmazem.swift do iPhone.
   Nenhuma regra clínica aqui: tudo o que aparece vem de protocolo.avaliar() (sessoes/*.js, contrato em sessoes/LEIAME.md).
   A tela só desenha, guarda o estado no aparelho (mt.sessao.v1.<id>) e agenda os avisos de exame com o texto do motor.
   Liga-se à casca por MedTechCasca.registrar('sessao', ...). Atalho de teste: ?sessao=lista|<id>. */
import { todas, protocolo, nucleo as n } from './sessoes/index.js';

const W = window, D = document;
const U = W.MTUI, F = W.MTFerUI, esc = U.esc, ic = U.ic;
const APOIO = '<p class="ss-apoio">Apoio à decisão. A conduta é do médico.</p>';

/* ---------- SF Symbols do motor → ícones Tabler ---------- */
const SIMBOLOS = {
  'syringe': 'vaccine', 'syringe.fill': 'vaccine', 'drop.fill': 'droplet', 'drop.circle.fill': 'droplet', 'drop.triangle': 'droplet-exclamation',
  'drop.triangle.fill': 'droplet-exclamation', 'testtube.2': 'test-pipe-2', 'pills': 'pill', 'pills.fill': 'pill', 'pills.circle.fill': 'pills',
  'lungs.fill': 'lungs', 'heart.fill': 'heart', 'bolt.fill': 'bolt', 'bolt.heart.fill': 'heartbeat', 'cross.vial.fill': 'vaccine-bottle',
  'cross.case.fill': 'first-aid-kit', 'cube.fill': 'cube', 'house.fill': 'home', 'list.bullet.clipboard.fill': 'clipboard-list', 'checklist': 'list-check',
  'exclamationmark.triangle.fill': 'alert-triangle', 'exclamationmark.octagon.fill': 'alert-octagon', 'exclamationmark.shield.fill': 'shield-exclamation',
  'figure.walk.motion': 'walk', 'figure.stand': 'man', 'gauge.medium': 'gauge', 'gauge.with.dots.needle.33percent': 'gauge', 'gauge.with.dots.needle.67percent': 'gauge',
  'hand.point.up.left.fill': 'hand-finger', 'bed.double.fill': 'bed', 'shippingbox.fill': 'package', 'wind': 'wind', 'waveform.path': 'wave-sine',
  'waveform.path.ecg': 'activity-heartbeat', 'waveform.path.ecg.rectangle': 'heart-rate-monitor', 'waveform.path.ecg.rectangle.fill': 'heart-rate-monitor',
  'chart.line.uptrend.xyaxis': 'chart-line', 'clock.arrow.circlepath': 'history', 'arrow.triangle.2.circlepath': 'refresh', 'arrow.triangle.branch': 'git-branch',
  'arrow.triangle.swap': 'arrows-exchange', 'arrow.down.circle.fill': 'circle-arrow-down', 'bandage.fill': 'bandage', 'stethoscope': 'stethoscope',
  'nosign': 'ban', 'magnifyingglass': 'search', 'note.text': 'note', 'scissors': 'scissors', 'scope': 'focus-2',
  'brain.head.profile': 'brain', 'brain': 'brain', 'thermometer': 'thermometer', 'clock.fill': 'clock', 'timer': 'clock', 'flag.checkered': 'flag-3'
};
const semIcone = new Set();
function icone(simbolo) {
  const t = SIMBOLOS[simbolo];
  if (!t) semIcone.add(simbolo);
  return t || 'activity-heartbeat';
}
const corHex = (c) => '#' + Number(c).toString(16).padStart(6, '0');
const mesmaRegra = (a, b) => !!a && !!b && a.linha === b.linha && a.texto === b.texto && a.origem === b.origem;

/* ---------- datas e números ---------- */
const dois = (x) => String(x).padStart(2, '0');
function valorHora(ms) { const d = new Date(ms); return dois(d.getHours()) + ':' + dois(d.getMinutes()); }
function valorDataHora(ms) { const d = new Date(ms); return d.getFullYear() + '-' + dois(d.getMonth() + 1) + '-' + dois(d.getDate()) + 'T' + dois(d.getHours()) + ':' + dois(d.getMinutes()); }
function lerHoraHoje(s) {   // "HH:mm" de hoje; não passa de agora (DatePicker in: ...Date())
  const m = /^(\d{1,2}):(\d{2})/.exec(s || ''); if (!m) return null;
  const d = new Date(); d.setHours(+m[1], +m[2], 0, 0);
  return Math.min(d.getTime(), Date.now());
}
function lerDataHora(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s || ''); if (!m) return null;
  return Math.min(new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], 0, 0).getTime(), Date.now());
}
function ehHoje(ms) { const a = new Date(ms), b = new Date(); return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function lerNumero(s) {
  if (s == null || s === '') return null;
  const v = Number(String(s).replace(',', '.'));
  return Number.isFinite(v) ? v : null;
}
function foraDaFaixa(p, textos) {
  return p.parametros.flatMap((d) => {
    const v = lerNumero(textos[d.id]);
    return v !== null && n.foraDaFaixa(d, v) ? [d.nome + ' ' + n.num(v, 2) + ' ' + d.unidade + ': esperado de ' + n.num(d.minPlausivel) + ' a ' + n.num(d.maxPlausivel) + '.'] : [];
  });
}
const rotuloCampo = (d) => (d.unidade ? d.nome + ' (' + d.unidade + ')' : d.nome);

/* ---------- avisos de exame (AvisosSessao): Notification com a frase do motor, sem dado do paciente ---------- */
const Avisos = {
  timers: {},
  suporte() { return 'Notification' in W; },
  /* Só pelo toque do médico (o Seguir da triagem, como no iPhone). */
  pedir() {
    if (!this.suporte() || Notification.permission !== 'default') return;
    try { const r = Notification.requestPermission(); if (r && r.then) r.then(() => reprogramarTodos(), () => {}); } catch (e) { /* sem suporte */ }
  },
  cancelar(id) { (this.timers[id] || []).forEach(clearTimeout); delete this.timers[id]; },
  reprogramar(id, exames, agora) {
    this.cancelar(id);
    if (!this.suporte() || Notification.permission !== 'granted') return;
    const lista = [];
    for (const x of exames) {
      if (x.situacao !== 'noPrazo') continue;
      for (const [sufixo, hora] of [['janela', x.janelaInicio], ['limite', x.proxima]]) {
        if (hora == null || hora <= agora) continue;
        const tag = 'sessao.' + id + '.' + x.id + '.' + sufixo;
        lista.push(setTimeout(() => this.mostrar(tag, x.aviso), Math.min(hora - agora, 2147483000)));
      }
    }
    this.timers[id] = lista;
  },
  mostrar(tag, corpo) {
    const direto = () => { try { new Notification('MedTech', { body: corpo, tag }); } catch (e) { /* sem suporte */ } };
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) {
      navigator.serviceWorker.getRegistration().then((r) => (r && r.showNotification ? r.showNotification('MedTech', { body: corpo, tag }) : direto())).catch(direto);
    } else direto();
  }
};
function reprogramarTodos() {
  const agora = Date.now();
  for (const p of todas) {
    const e = n.carregarEstado(p.id);
    if (e) Avisos.reprogramar(p.id, p.avaliar(e, agora).exames, agora); else Avisos.cancelar(p.id);
  }
}

/* ---------- modelo (SessaoModelo) ---------- */
class Modelo {
  constructor(p) {
    this.p = p;
    this.e = n.carregarEstado(p.id) || n.novoEstado(p.id, Date.now());
    this.vistas = new Set();
    this.o = null; this.oj = '';
    this.recalcular();
  }
  /* devolve true se a orientação mudou */
  recalcular() {
    const novo = this.p.avaliar(this.e, Date.now()), j = JSON.stringify(novo);
    if (j === this.oj) return false;
    this.o = novo; this.oj = j;
    return true;
  }
  atualiza() { [...this.vistas].forEach((f) => f()); }
  guardar() {
    this.recalcular();
    if (!n.salvarEstado(this.e)) U.aviso('Não foi possível guardar neste aparelho.');
    Avisos.reprogramar(this.p.id, this.o.exames, Date.now());
    D.dispatchEvent(new CustomEvent('medtech:sessoes', { detail: { id: this.p.id } }));
    this.atualiza();
  }
  irPara(etapa) { this.e.etapa = etapa; this.guardar(); }
  confirmar(a) { n.confirmar(this.e, a, Date.now()); this.guardar(); }
  desfazerUltima() { if (this.e.acoes.length) { n.desfazerUltima(this.e); this.guardar(); } }
  responder(chave, v) { n.responder(this.e, chave, v); this.guardar(); }
  escolher(ramo, op) { n.escolher(this.e, ramo, op); this.guardar(); }
  medir(valores, hora) { for (const [id, v] of valores) n.medir(this.e, id, v, hora); this.guardar(); }
  novosResultados(valores, respostas, hora) {
    const antes = this.o;
    for (const [id, v] of valores) n.medir(this.e, id, v, hora);
    for (const [c, v] of Object.entries(respostas)) this.e.respostas[c] = v;
    this.guardar();
    return n.mudancas(antes, this.o);
  }
  responderPasso(passo, rotulo, hora, aplicar) { n.responderPasso(this.e, passo, rotulo, hora == null ? Date.now() : hora, aplicar); this.guardar(); }
  voltarPasso() { const ok = n.voltarPasso(this.e); if (ok) this.guardar(); return ok; }
  encerrar() {
    n.apagarEstado(this.p.id);
    Avisos.cancelar(this.p.id);
    this.encerrada = true;
    D.dispatchEvent(new CustomEvent('medtech:sessoes', { detail: { finalizada: this.p.id } }));
  }
}

/* ---------- peças (BotaoGrande, SimNao, BotaoFonte...) ---------- */
/* Cada desenho registra as ações que os botões chamam: data-acao="h" data-h="<índice>". */
function registro(t) {
  let H = [];
  t.acoes.h = (a) => { const f = H[+a.dataset.h]; if (f) f(a); };
  return { on(f) { H.push(f); return 'data-acao="h" data-h="' + (H.length - 1) + '"'; }, limpa() { H = []; } };
}
function bt(r, texto, f, cls = '') { return '<button type="button" class="ss-bt ' + cls + '" ' + r.on(f) + '>' + esc(texto) + '</button>'; }
function botaoFonte(r, f, branca) { return '<button type="button" class="ss-fonte' + (branca ? ' ss-branca' : '') + '" ' + r.on(f) + '>Ver regra e fonte</button>'; }
function simNao(r, pergunta, detalhe, valor, responder) {
  const b = (t, v) => '<button type="button" class="ss-sn" aria-pressed="' + (valor === v) + '" ' + r.on(() => responder(v)) + '>' + t + '</button>';
  return '<div class="ss-simnao"><b>' + esc(pergunta) + '</b>' + (detalhe ? '<span>' + esc(detalhe) + '</span>' : '') +
    '<div class="ss-par" role="group" aria-label="' + esc(pergunta) + '">' + b('Não', false) + b('Sim', true) + '</div></div>';
}
function campos(t, p, ids, textos) {
  const defs = ids.map((i) => p.parametros.find((d) => d.id === i)).filter(Boolean);
  let h = '<div class="ss-campos">';
  for (let i = 0; i < defs.length; i += 2) {
    h += '<div class="fer-linha-campos">' + defs.slice(i, i + 2).map((d) => F.campoNumero(t, { id: d.id, rotulo: rotuloCampo(d), valor: textos[d.id] || '' })).join('') + '</div>';
  }
  return h + '</div>';
}
function campoHora(t, rotulo, ms) {
  return '<div class="ss-hora"><label for="' + t.id + '-hora">' + esc(rotulo) + '</label><input id="' + t.id + '-hora" type="time" data-hora value="' + valorHora(ms) + '" max="' + valorHora(Date.now()) + '"></div>';
}
const ICONE_TRES = { sim: ['circle-check', 'ss-ok', 'cumprido'], nao: ['circle-x', 'ss-alerta-t', 'não cumprido'], falta: ['help-circle', 'ss-atencao', 'falta dado'] };
function criterios(r, painel, verFonte) {
  return '<div class="ss-crit">' + painel.criterios.map((c) => {
    const i = ICONE_TRES[c.situacao];
    return '<div class="ss-crit-l"><i class="ti ti-' + i[0] + ' ' + i[1] + '" role="img" aria-label="' + i[2] + '"></i><div><b>' + esc(c.nome) + '</b><span>' + esc(c.situacao === 'falta' ? 'Falta dado' : (c.valor || '')) + '</span></div></div>';
  }).join('') + botaoFonte(r, () => verFonte(painel.regra)) + '</div>';
}
function travaGrande(r, t, verFonte) {
  return '<div class="ss-trava" role="group" aria-label="' + esc('Bloqueio. ' + t.titulo + '. ' + t.texto) + '"><div class="ss-trava-c">' + ic('alert-octagon') + '<b>' + esc(t.titulo) + '</b></div><p>' + esc(t.texto) + '</p>' +
    botaoFonte(r, () => verFonte(t.regra), true) + '</div>';
}
function alertaFaixa(r, a, verFonte) {
  const f = a.nivel === 'vermelho' ? 'alerta' : 'atencao';
  return '<div class="ss-alerta fx-' + f + '"><div class="ss-alerta-c">' + F.iconeFaixa(f) + '<p>' + esc(a.texto) + '</p></div>' + botaoFonte(r, () => verFonte(a.regra)) + '</div>';
}
/* vermelho antes do amarelo, como alertas.sorted { nivel > nivel } */
const alertasOrdem = (lista) => [...lista].sort((a, b) => (b.nivel === 'vermelho') - (a.nivel === 'vermelho'));

function etiquetaCartao(p, c) {
  const texto = c.etiqueta ?? (c.situacao === 'proximoPasso' ? p.rotuloProximoPasso : n.rotuloSituacao(c.situacao, p.nomeFonte));
  const cls = c.situacao === 'travado' ? 'et-alerta' : (c.situacao === 'faltaDado' || c.situacao === 'decisaoMedico' || c.situacao === 'pergunta') ? 'et-atencao' : '';
  return '<span class="' + cls + '">' + esc(texto) + '</span>';
}
function cartaoHTML(r, m, c, verFonte, aoConfirmar) {
  const cls = c.situacao === 'proximoPasso' ? ' ss-prox' : c.situacao === 'travado' ? ' ss-trav' : c.situacao === 'correndo' ? ' ss-corr' : '';
  let h = '<article class="ss-cartao' + cls + '" style="--c:' + corHex(c.corHex) + '" data-cartao="' + esc(c.id) + '"><div class="ss-cab">' + ic(icone(c.simbolo)) +
    '<div><h3>' + esc(c.titulo) + '</h3>' + etiquetaCartao(m.p, c) + '</div></div>' +
    '<p class="ss-valor">' + esc(c.valor).replace(/\//g, '⁠/⁠') + '</p>';
  if (c.conta !== null) h += '<p class="ss-conta">' + esc(c.conta) + '</p>';
  if (c.detalhe !== null) h += '<p class="ss-detalhe">' + esc(c.detalhe) + '</p>';
  if (c.pergunta) {
    const q = c.pergunta;
    h += simNao(r, q.texto, null, n.resposta(m.e, q.chave), (v) => { n.responderCartao(m.e, q, v, Date.now()); m.guardar(); });
  }
  for (const a of c.acoes) {
    h += '<button type="button" class="ss-acao' + (a.secundaria ? ' ss-sec' : '') + '" ' + r.on(() => aoConfirmar(a)) + '>' + esc(a.rotulo) + '</button>';
  }
  if (c.regras.length) h += botaoFonte(r, () => verFonte(c.regras[0]));
  return h + '</article>';
}
function linhaCalma(r, c, verFonte) {
  return '<button type="button" class="ss-calma" style="--c:' + corHex(c.corHex) + '" aria-description="Abre a regra" ' + r.on(() => { if (c.regras[0]) verFonte(c.regras[0]); }) + '>' + ic(icone(c.simbolo)) +
    '<div><b>' + esc(c.titulo + ': ' + c.valor) + '</b>' + (c.conta !== null ? '<span>' + esc(c.conta) + '</span>' : '') + (c.detalhe !== null ? '<span>' + esc(c.detalhe) + '</span>' : '') + '</div></button>';
}
function linhaMenu(r, titulo, icn, cor, f, destaque) {
  return '<button type="button" class="ss-linha' + (destaque ? ' ss-dest' : '') + '" ' + r.on(f) + '><i class="ti ti-' + icn + '" aria-hidden="true" style="background:' + cor + '"></i><b>' + esc(titulo) + '</b>' +
    (destaque ? '<span>Critérios cumpridos</span>' : '') + '</button>';
}
/* O que pede ação vem primeiro; o bloqueado já está no topo em vermelho. */
function prioridade(c) {
  if (c.noTopo || (c.primeiro && c.situacao !== 'semIndicacao' && c.situacao !== 'correndo')) return -1;
  if (c.discreto) return 5;
  return { proximoPasso: 0, pergunta: 1, decisaoMedico: 2, faltaDado: 3, correndo: 4, travado: 5, semIndicacao: 6 }[c.situacao];
}

/* ---------- relógios (TimelineView): cronômetro, exames, duração ---------- */
function textoExame(x, agora) {
  if (x.situacao === 'semDado') return ['Sem registro', x.rotuloSemDado];
  if (x.situacao === 'encerrado') return ['Encerrado', ''];
  if (x.proxima === null) return x.ultima === null ? ['Sem registro', ''] : ['Sem prazo', 'sem regra de intervalo'];
  const d = (x.proxima - agora) / 1000;
  if (d < 0) return [n.duracao(d), 'vencido há'];
  const s = Math.trunc(d);
  return [Math.trunc(s / 3600) + ':' + dois(Math.trunc((s % 3600) / 60)) + ':' + dois(s % 60), 'até ' + n.hora(x.proxima)];
}
function examesHTML(m, ui, agora) {
  const ex = m.o.exames, dest = ex.filter((x) => x.destaque), resto = ex.filter((x) => !x.destaque && x.situacao !== 'encerrado');
  let h = '';
  if (dest.length) {
    const col = dest.length <= 3 ? dest.length : dest.length === 4 ? 2 : 3;
    h += '<div class="ss-ex-grade' + (col >= 3 ? ' ss-c' + col : '') + '" style="--col:' + col + '">' + dest.map((x) => {
      const venc = x.situacao === 'semDado' || (x.situacao !== 'encerrado' && x.proxima !== null && x.proxima < agora);
      const t = textoExame(x, agora);
      return '<button type="button" class="ss-ex' + (venc ? ' ss-venc' : '') + '" data-acao="exame" data-id="' + esc(x.id) + '" aria-label="' + esc(x.nome + (venc ? ', vencido' : ', no prazo') + '. ' + t[1] + ' ' + t[0]) + '" aria-description="Abre a regra">' +
        '<b>' + esc(x.nome) + '</b><small>' + (esc(t[1]) || '&nbsp;') + '</small><strong class="ss-ex-n">' + esc(t[0]) + '</strong></button>';
    }).join('') + '</div>';
  }
  if (resto.length) {
    const pend = resto.some((x) => x.situacao === 'vencido' || x.situacao === 'semDado');
    h += '<div class="ss-outros"><button type="button" data-acao="outros" aria-expanded="' + !!ui.outros + '"><b>' + esc(m.p.tituloOutrosExames) + '</b>' + (pend ? '<span>pendente</span>' : '') + ic('chevron-down') + '</button>' +
      (ui.outros ? '<div class="ss-outros-c">' + resto.map((x) => {
        const venc = x.situacao === 'vencido' || x.situacao === 'semDado';
        return '<button type="button" class="ss-ex-l' + (venc ? ' ss-venc' : '') + '" data-acao="exame" data-id="' + esc(x.id) + '"><b>' + esc(x.nome) + '</b><strong class="ss-ex-n">' + esc(textoExame(x, agora)[0]) + '</strong></button>';
      }).join('') + '</div>' : '') + '</div>';
  }
  return h;
}
function cronometroHTML(r, c, agora, verFonte) {
  const s = Math.max(0, Math.trunc((agora - c.desde) / 1000));
  const texto = dois(Math.trunc(s / 60)) + ':' + dois(s % 60);
  let h = '<div class="ss-crono-t">' + esc(c.titulo) + '</div><div class="ss-crono-n" role="timer" aria-label="' + esc(c.titulo + ': ' + Math.trunc(s / 60) + ' minutos e ' + (s % 60) + ' segundos') + '">' + texto + '</div>';
  if (c.subtitulo !== null) h += '<div class="ss-crono-s">' + esc(c.subtitulo) + '</div>';
  for (const x of c.marcos) {
    const passou = s >= x.minutos * 60;
    h += '<div class="ss-marco' + (passou ? ' ss-passou' : '') + '"><b>' + n.num(x.minutos, 0) + ' min</b><span>' + esc(x.rotulo) + '</span>' + (passou ? '<i class="ti ti-circle-check" role="img" aria-label="marca atingida"></i>' : '') + '</div>';
  }
  if (c.regra) h += botaoFonte(r, () => verFonte(c.regra));
  return h;
}

/* ---------- gráfico (Charts): linha com pontos, eixo de horas, regras tracejadas; sem animação ---------- */
function grafico(serie, d, linhas, altura, rotulo) {
  const Wd = 340, Hd = altura, L = 46, R = 10, T = 26, B = 24;
  const xs = serie.map((s) => s.hora), ys = serie.map((s) => s.valor).concat((linhas || []).map((l) => l.valor));
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  if (x1 - x0 < 60000) { x0 -= 30 * 60000; x1 += 30 * 60000; }
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (y1 - y0 < 1e-9) { const pad = Math.abs(y0) * 0.1 || 1; y0 -= pad; y1 += pad; }
  const passo = (() => { const bruto = (y1 - y0) / 4, p10 = Math.pow(10, Math.floor(Math.log10(bruto))), f = bruto / p10; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p10; })();
  y0 = Math.floor(y0 / passo) * passo; y1 = Math.ceil(y1 / passo) * passo;
  const px = (x) => L + (x - x0) / (x1 - x0) * (Wd - L - R), py = (y) => T + (1 - (y - y0) / (y1 - y0)) * (Hd - T - B);
  let g = '';
  for (let y = y0; y <= y1 + passo / 2; y += passo) {
    g += '<line class="ss-gg" x1="' + L + '" x2="' + (Wd - R) + '" y1="' + py(y).toFixed(1) + '" y2="' + py(y).toFixed(1) + '"/>' +
      '<text class="ss-ge" x="' + (L - 6) + '" y="' + (py(y) + 4).toFixed(1) + '" text-anchor="end">' + esc(n.num(y, 2)) + '</text>';
  }
  for (let i = 0; i < 4; i++) {
    const t = x0 + (x1 - x0) * (i / 3), x = px(t);
    g += '<line class="ss-gg" x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + T + '" y2="' + (Hd - B) + '"/>' +
      '<text class="ss-ge" x="' + x.toFixed(1) + '" y="' + (Hd - 6) + '" text-anchor="' + (i === 0 ? 'start' : i === 3 ? 'end' : 'middle') + '">' + n.hora(t) + '</text>';
  }
  for (const l of linhas || []) {
    const y = py(l.valor).toFixed(1);
    g += '<line class="ss-gr" x1="' + L + '" x2="' + (Wd - R) + '" y1="' + y + '" y2="' + y + '"/><text class="ss-grt" x="' + (Wd - R) + '" y="' + (py(l.valor) - 4).toFixed(1) + '" text-anchor="end">' + esc(l.rotulo) + '</text>';
  }
  g += '<polyline class="ss-gl" points="' + serie.map((s) => px(s.hora).toFixed(1) + ',' + py(s.valor).toFixed(1)).join(' ') + '"/>';
  g += serie.map((s) => '<circle class="ss-gp" cx="' + px(s.hora).toFixed(1) + '" cy="' + py(s.valor).toFixed(1) + '" r="4.5"/>').join('');
  if (d && d.unidade) g += '<text class="ss-ge" x="' + (L - 6) + '" y="12" text-anchor="end">' + esc(d.unidade) + '</text>';
  return '<svg class="ss-grafico" viewBox="0 0 ' + Wd + ' ' + Hd + '" role="img" aria-label="' + esc(rotulo) + '">' + g + '</svg>';
}
/* minimumScaleFactor dos blocos de exame: o texto encolhe até 55% para caber, sem reticências */
function encaixa(raiz) {
  raiz.querySelectorAll('.ss-ex b, .ss-ex small, .ss-ex strong').forEach((x) => {
    x.style.fontSize = '';
    let t = parseFloat(getComputedStyle(x).fontSize);
    const min = t * 0.55;
    while (x.scrollWidth > x.clientWidth + 0.5 && t > min) { t -= 1; x.style.fontSize = t + 'px'; }
  });
}
const serieOrdenada = (e, id) => [...(e.series[id] || [])].sort((a, b) => a.hora - b.hora);

/* ---------- folha "Ver regra e fonte" (TelaFonteSessao) ---------- */
function abreFonte(p, regra, outras = []) {
  if (!regra) return;
  U.folha({
    titulo: 'Regra e fonte', classe: 'ss-folha',
    conteudo(c, api) {
      c.innerHTML = '<p class="f-rot" data-foco tabindex="-1">Regra</p><p class="f-regra">' + esc(regra.texto) + '</p><p class="f-rot">Onde está na fonte</p><p class="f-origem">' + esc(regra.origem) + '</p>' +
        '<p class="f-rot">Referência</p><p class="f-ref">' + esc(p.referencia) + '</p><p class="f-linha">Linha ' + regra.linha + ' do arquivo de regras.</p>' +
        outras.map((r) => '<hr><p class="f-outra">' + esc(r.texto) + '</p><p class="f-outra-o">' + esc(r.origem) + '</p><p class="f-linha">Linha ' + r.linha + ' do arquivo de regras.</p>').join('') +
        '<button type="button" class="f-fechar">Fechar</button>';
      c.querySelector('.f-fechar').addEventListener('click', api.fechar);
    }
  });
}

/* ---------- camada com redesenho que guarda rolagem, foco e o texto digitado ---------- */
function camada(o) {
  const t = F.tela({ ferramenta: 'sessoes', titulo: o.titulo, grande: o.grande, corTitulo: o.corTitulo, classe: 'ss' + (o.classe ? ' ' + o.classe : '') });
  const r = registro(t);
  const ui = { chave: null, v: {} };
  t.el.addEventListener('input', (ev) => {
    const x = ev.target;
    if (x.dataset.campo) { ui.v.textos = ui.v.textos || {}; ui.v.textos[x.dataset.campo] = x.value; if (ui.aoDigitar) ui.aoDigitar(x); }
  });
  t.el.addEventListener('change', (ev) => { if (ev.target.matches('[data-hora]') && ui.aoHora) ui.aoHora(ev.target); });
  let ultimo = null;
  function pinta(chave, v) {
    ultimo = v;
    const mesma = ui.chave === chave, rolagem = t.rola.scrollTop;
    const ativo = D.activeElement && t.el.contains(D.activeElement) ? D.activeElement : null;
    const foco = ativo && (ativo.dataset.campo || (ativo.dataset.hora !== undefined ? '@hora' : null));
    if (!mesma) { ui.chave = chave; ui.v = {}; }
    r.limpa();
    const x = v(r, ui.v, t);
    t.titulo(x.titulo);
    t.direita(x.direita || '');
    t.rola.innerHTML = x.corpo;
    t.pe.innerHTML = x.pe || '';
    encaixa(t.rola);
    t.voltar = x.voltar || null;
    ui.aoDigitar = x.aoDigitar || null;
    ui.aoHora = x.aoHora || null;
    if (mesma) {
      t.rola.scrollTop = rolagem;
      if (foco) {
        const alvo = foco === '@hora' ? t.el.querySelector('[data-hora]') : t.el.querySelector('[data-campo="' + foco + '"]');
        if (alvo) try { alvo.focus({ preventScroll: true }); if (alvo.setSelectionRange && alvo.type === 'text') alvo.setSelectionRange(alvo.value.length, alvo.value.length); } catch (e) { /* sem foco */ }
      }
    } else {
      t.rola.scrollTop = 0;
      const h = t.el.querySelector('.fer-tit'); if (h && ui.jaAbriu) try { h.focus({ preventScroll: true }); } catch (e) { /* sem foco */ }
      ui.jaAbriu = true;
    }
    if (t.atualizaTeclado) t.atualizaTeclado();
  }
  return { t, r, ui, pinta, repinta: () => { if (ultimo) pinta(ui.chave, ultimo); } };
}

/* ---------- lista de sessões (ListaSessoes) ---------- */
let listaAberta = null;
function abrirLista() {
  if (listaAberta) return;
  const c = camada({ titulo: 'Acompanhar paciente', grande: true, corTitulo: true });
  listaAberta = c;
  const desenha = () => c.pinta('lista', (r) => ({
    titulo: 'Acompanhar paciente',
    corpo: '<div class="ss-pilha"><p class="ss-intro">Você informa os parâmetros atuais e a regra mostra o próximo passo. Sem IA, sem internet e sem nome do paciente.</p>' +
      todas.map((p) => {
        const salva = n.carregarEstado(p.id);
        return '<button type="button" class="ss-doenca" data-sessao="' + p.id + '" ' + r.on(() => abrirSessao(p)) + '>' + ic('heart-rate-monitor') +
          '<div><b>' + esc(p.nome) + '</b><span>' + esc(salva ? 'Em andamento desde ' + n.hora(salva.inicio) : p.descricao) + '</span></div></button>';
      }).join('') + '</div>'
  }));
  desenha();
  D.addEventListener('medtech:sessoes', desenha);
  c.t.aoFechar.push(() => { D.removeEventListener('medtech:sessoes', desenha); listaAberta = null; });
}

/* ---------- a sessão (SessaoView) ---------- */
let atual = null;
function abrirSessao(p) {
  if (atual && atual.m.p.id === p.id) return;
  const m = new Modelo(p);
  const c = camada({ titulo: p.nome });
  const { t, ui } = c;
  const sessao = { m, c };
  atual = sessao;
  const fechar = () => t.fechar();
  const fonte = (r, outras) => abreFonte(p, r, outras || []);

  function desenha() {
    if (m.encerrada) return;
    const e = m.e, o = m.o;
    switch (e.etapa) {
      case 'parametros': return c.pinta('parametros', vParametros);
      case 'perguntas': return c.pinta('perguntas', vPerguntas);
      case 'ramos': return c.pinta('ramos', vRamos);
      case 'agora': return o.passo ? c.pinta('passo:' + o.passo.chave, vPasso) : c.pinta('agora', vAgora);
      default: return c.pinta('triagem', vTriagem);
    }
  }

  /* Triagem de fora do escopo */
  function vTriagem(r, v) {
    if (v.fora === undefined) { v.fora = m.o.foraDeEscopo.length > 0; v.marcados = new Set(); }
    let corpo = '<div class="ss-pilha ss-g10">', pe = '<div class="ss-pe">';
    if (v.fora) {
      corpo += '<i class="ti ti-alert-triangle ss-fora-ic" aria-hidden="true"></i><h2 class="ss-h30">Fora do escopo desta sessão</h2>' +
        m.o.foraDeEscopo.map((x) => '<p class="ss-t22s ss-atencao">' + esc(x) + '</p>').join('') +
        '<p class="ss-t19">A sessão não gera passo automático neste caso. Use a conduta da doença e o seu julgamento.</p>';
      pe += bt(r, 'Corrigir a triagem', () => {
        v.fora = false;
        for (const q of p.triagem) delete m.e.respostas[q.chave];
        m.recalcular(); desenha();
      }) + bt(r, 'Sair', () => { m.encerrar(); fechar(); }, 'ss-leve');
    } else {
      corpo += '<h2 class="ss-h30">Algum destes se aplica?</h2><p class="ss-intro ss-i16" style="padding-bottom:6px">' + esc(p.escopo) + '</p>' +
        p.triagem.map((q) => {
          const on = v.marcados.has(q.chave);
          return '<button type="button" class="ss-marca" aria-pressed="' + on + '" ' + r.on(() => { if (on) v.marcados.delete(q.chave); else v.marcados.add(q.chave); desenha(); }) + '><span>' + esc(q.texto) + '</span>' + (on ? ic('check') : '') + '</button>';
        }).join('');
      pe += bt(r, v.marcados.size ? 'Seguir' : 'Nenhum destes: seguir', () => {
        for (const q of p.triagem) m.e.respostas[q.chave] = v.marcados.has(q.chave);
        m.recalcular();
        if (m.o.foraDeEscopo.length) { v.fora = true; desenha(); return; }
        m.e.inicio = Date.now();
        Avisos.pedir();
        m.irPara('parametros');
      });
    }
    return { titulo: p.nome, corpo: corpo + '</div>', pe: pe + APOIO + '</div>' };
  }

  /* Parâmetros de agora */
  function vParametros(r, v) {
    v.textos = v.textos || {};
    if (v.hora === undefined) v.hora = Date.now();
    const salvar = () => {
      const vals = p.parametrosIniciais.map((id) => [id, lerNumero(v.textos[id])]).filter((x) => x[1] !== null);
      m.medir(vals, v.hora);
      m.irPara(p.perguntasIniciais.length === 0 && p.ramos.length === 0 ? 'agora' : 'perguntas');
    };
    return {
      titulo: 'Parâmetros de agora', voltar: () => m.irPara('triagem'),
      aoHora: (x) => { const h = lerHoraHoje(x.value); if (h !== null) { v.hora = h; x.value = valorHora(h); } },
      corpo: '<div class="ss-pilha"><p class="ss-intro ss-i16">Digite só o que tem. O que faltar fica como falta, nunca como normal.</p>' + campos(t, p, p.parametrosIniciais, v.textos) + campoHora(t, 'Hora da coleta', v.hora) + '</div>',
      pe: '<div class="ss-pe">' + bt(r, 'Seguir', () => {
        const f = foraDaFaixa(p, v.textos);
        if (!f.length) return salvar();
        U.confirma('Confirme o valor', f.join('\n'), [{ rotulo: 'Corrigir' }, { rotulo: 'Está certo', acao: salvar }]);
      }) + APOIO + '</div>'
    };
  }

  /* Sobre o paciente */
  function vPerguntas(r) {
    return {
      titulo: 'Sobre o paciente', voltar: () => m.irPara('parametros'),
      corpo: '<div class="ss-pilha ss-g24">' + p.perguntasIniciais.map((q) => simNao(r, q.texto, q.detalhe, n.resposta(m.e, q.chave), (x) => m.responder(q.chave, x))).join('') + '</div>',
      pe: '<div class="ss-pe">' + bt(r, 'Seguir', () => m.irPara('ramos')) + APOIO + '</div>'
    };
  }

  /* Gravidade, critérios e via: o médico confirma para entrar na sessão */
  function vRamos(r) {
    const o = m.o;
    const pronto = p.ramos.every((x) => m.e.escolhas[x.id] !== undefined && o.ramoBloqueado[m.e.escolhas[x.id]] === undefined);
    let corpo = '<div class="ss-pilha ss-g14">';
    if (o.classificacao !== null) {
      corpo += '<div class="ss-pilha" style="gap:4px"><h2 class="ss-h26">' + esc(o.classificacao) + '</h2>' +
        (o.classificacaoDetalhe !== null ? '<p class="ss-t18 ss-alerta-t" style="font-weight:600">' + esc(o.classificacaoDetalhe) + '</p>' : '') +
        (o.classificacaoRegra ? botaoFonte(r, () => fonte(o.classificacaoRegra)) : '') + '</div>';
    }
    if (o.confirmacao) corpo += criterios(r, o.confirmacao, (x) => fonte(x));
    for (const ramo of p.ramos) {
      corpo += '<h2 class="ss-h20">' + esc(ramo.titulo) + '</h2>' + ramo.opcoes.map((op) => {
        const bloq = o.ramoBloqueado[op.id], on = m.e.escolhas[ramo.id] === op.id;
        return '<button type="button" class="ss-op" aria-pressed="' + on + '"' + (bloq !== undefined ? ' disabled' : '') + ' ' + r.on(() => m.escolher(ramo.id, op.id)) + '><b>' + esc(op.rotulo) + '</b><span>' + esc(bloq !== undefined ? bloq : op.detalhe) + '</span></button>';
      }).join('');
    }
    let pe = '<div class="ss-pe">';
    const a = o.confirmacao && o.confirmacao.acao;
    if (a) pe += '<button type="button" class="ss-bt' + (pronto ? '' : ' ss-inativo') + '" aria-disabled="' + !pronto + '" ' + r.on(() => { if (!pronto) return; m.confirmar(a); m.irPara('agora'); }) + '>' + esc(a.rotulo) + '</button>';
    return { titulo: p.tituloRamos, voltar: () => m.irPara('perguntas'), corpo: corpo + '</div>', pe: pe + APOIO + '</div>' };
  }

  /* Passo guiado: uma pergunta por tela; a resposta entra pelo modelo e o motor decide o passo seguinte */
  function vPasso(r, v) {
    const o = m.o, passo = o.passo, tipo = passo.tipo;
    const def = tipo.caso === 'numero' ? p.parametros.find((d) => d.id === tipo.parametro) : null;
    v.textos = v.textos || {};
    if (tipo.caso === 'hora' && v.hora === undefined) { v.hora = tipo.padrao !== null ? tipo.padrao : Date.now(); v.horaPadrao = tipo.padrao; }
    const salvarNumero = () => {
      const x = lerNumero(v.textos[def.id]);
      if (x === null) return;
      m.responderPasso(passo, def.nome + ': ' + n.num(x, def.casas) + ' ' + def.unidade, null, (e) => n.medir(e, def.id, x, Date.now()));
    };
    const seguirNumero = () => {
      const x = def ? lerNumero(v.textos[def.id]) : null;
      if (x === null) return;
      if (n.foraDaFaixa(def, x)) U.confirma('Confirme o valor', def.nome + ' ' + n.num(x, 2) + ' ' + def.unidade + ': esperado de ' + n.num(def.minPlausivel) + ' a ' + n.num(def.maxPlausivel) + '.', [{ rotulo: 'Corrigir' }, { rotulo: 'Está certo', acao: salvarNumero }]);
      else salvarNumero();
    };
    v.seguirNumero = seguirNumero;
    let corpo = '<div class="ss-pilha ss-g14">' + o.travas.map((x) => travaGrande(r, x, (rg) => fonte(rg))).join('') + alertasOrdem(o.alertas).map((a) => alertaFaixa(r, a, (rg) => fonte(rg))).join('') +
      '<h2 class="ss-h30">' + esc(passo.texto) + '</h2>' + (passo.detalhe !== null ? '<p class="ss-t18">' + esc(passo.detalhe) + '</p>' : '');
    let pe = '<div class="ss-pe">';
    switch (tipo.caso) {
      case 'numero':
        if (def) corpo += F.campoNumero(t, { id: def.id, rotulo: rotuloCampo(def), valor: v.textos[def.id] || '', t24: true });
        pe += '<button type="button" class="ss-bt' + (lerNumero(v.textos[def && def.id]) === null ? ' ss-inativo' : '') + '" data-seguir ' + r.on(seguirNumero) + '>Seguir</button>';
        break;
      case 'hora': {
        const id = t.id + '-quando';
        corpo += '<div class="ss-quando"><label for="' + id + '">Hora</label><input id="' + id + '" type="datetime-local" step="60" data-hora value="' + valorDataHora(v.hora) + '" max="' + valorDataHora(Date.now()) + '"></div>';
        if (passo.confirmarPadrao !== null && v.horaPadrao !== null && v.hora === v.horaPadrao) {
          pe += '<button type="button" class="ss-bt ss-inativo" aria-disabled="true" ' + r.on(() => {}) + '>Escolha a hora acima</button>' +
            bt(r, passo.confirmarPadrao, () => m.responderPasso(passo, passo.texto + ': ' + passo.confirmarPadrao, v.hora), 'ss-leve ss-a54');
        } else {
          const d = new Date(v.hora), quando = ehHoje(v.hora) ? 'hoje' : 'em ' + dois(d.getDate()) + '/' + dois(d.getMonth() + 1);
          pe += bt(r, 'Confirmar ' + quando + ' às ' + n.hora(v.hora), () => m.responderPasso(passo, passo.texto + ': ' + n.hora(v.hora), v.hora));
        }
        break;
      }
      case 'opcoes':
        corpo += tipo.opcoes.map((op) => '<button type="button" class="ss-op ss-opp" ' + r.on(() => m.responderPasso(passo, passo.texto + ' ' + op.rotulo, null, (e) => { e.escolhas[passo.chave] = op.id; })) + '><b>' + esc(op.rotulo) + '</b>' + (op.detalhe ? '<span>' + esc(op.detalhe) + '</span>' : '') + '</button>').join('');
        break;
      case 'lista':
        corpo += tipo.itens.map((i) => {
          const on = n.resposta(m.e, i.chave) === true;
          return '<button type="button" class="ss-marca ' + (i.trava ? 'ss-mtrava' : 'ss-maviso') + '" aria-pressed="' + on + '" ' + r.on(() => m.responder(i.chave, !on)) + '><span>' + esc(i.texto) + '</span>' + (on ? ic('check') : '') + '</button>';
        }).join('');
        pe += bt(r, 'Conferi a lista', () => m.responderPasso(passo, passo.texto + ': lista conferida'));
        break;
      case 'simNao':
        pe += '<div class="ss-par">' + bt(r, 'Não', () => m.responderPasso(passo, passo.texto + ' Não', null, (e) => { e.respostas[passo.chave] = false; }), 'ss-leve ss-a78') +
          bt(r, 'Sim', () => m.responderPasso(passo, passo.texto + ' Sim', null, (e) => { e.respostas[passo.chave] = true; }), 'ss-leve ss-a78') + '</div>';
        break;
    }
    if (passo.regras.length) corpo += botaoFonte(r, () => fonte(passo.regras[0], p.mostraTodasAsFontes ? passo.regras.slice(1) : []));
    if (passo.semDado !== null) pe += bt(r, passo.semDado, () => m.responderPasso(passo, passo.texto + ' ' + passo.semDado, null, (e) => { e.respostas['semDado.' + passo.chave] = true; }), 'ss-leve ss-a54');
    return {
      titulo: passo.secao,
      direita: o.relogioDesde !== null ? '<span class="ss-dur" data-dur="' + o.relogioDesde + '">' + n.duracao((Date.now() - o.relogioDesde) / 1000) + '</span>' : '',
      voltar: () => { if (!m.voltarPasso()) m.irPara('parametros'); },
      aoDigitar: (x) => { const s = t.pe.querySelector('[data-seguir]'); if (s) s.classList.toggle('ss-inativo', lerNumero(x.value) === null); },
      aoHora: (x) => { const h = lerDataHora(x.value); if (h !== null) { v.hora = h; desenha(); } },
      corpo: corpo + '</div>', pe: pe + APOIO + '</div>'
    };
  }

  /* A tela central */
  function vAgora(r, v) {
    const o = m.o, agora = Date.now();
    const verCartao = (rg) => {
      const doCartao = [...o.cartoes, ...o.etapasFinais].find((x) => mesmaRegra(x.regras[0], rg));
      fonte(rg, p.mostraTodasAsFontes && doCartao ? doCartao.regras.slice(1) : []);
    };
    const confirmar = (a) => { v.aviso = 'Registrado às ' + n.hora(Date.now()); m.confirmar(a); };
    let h = '<div class="ss-pilha">';
    if (o.faixaCaminho !== null) h += '<p class="ss-h24">' + esc(o.faixaCaminho) + '</p>';
    if (o.cronometro) h += '<div class="ss-crono" data-crono>' + cronometroHTML(r, o.cronometro, agora, (rg) => fonte(rg)) + '</div>';
    h += o.travas.map((x) => travaGrande(r, x, (rg) => fonte(rg))).join('');
    h += alertasOrdem(o.alertas).map((a) => alertaFaixa(r, a, (rg) => fonte(rg))).join('');
    if (o.encerradaPelaRegra !== null) h += '<p class="ss-h24">' + esc(o.encerradaPelaRegra) + '</p>';
    if (o.resolucao && o.resolucao.cumprido && o.resolucao.acao) {
      h += '<button type="button" class="ss-resolvido" ' + r.on(() => abrirResolucao(sessao)) + '>' + ic('flag-3') + '<div><b>Critérios de resolução cumpridos</b><span>Toque para conferir e confirmar</span></div></button>';
    }
    if (p.graficoFixo) h += curvaFixa(m, p.graficoFixo);
    h += '<div class="ss-exames" data-exames>' + examesHTML(m, v, agora) + '</div>';
    h += o.etapasFinais.map((x) => cartaoHTML(r, m, x, verCartao, confirmar)).join('');
    const ativos = o.cartoes.filter((x) => x.situacao !== 'semIndicacao').map((x, i) => [x, i]).sort((a, b) => prioridade(a[0]) - prioridade(b[0]) || a[1] - b[1]).map((x) => x[0]);
    h += ativos.map((x) => cartaoHTML(r, m, x, verCartao, confirmar)).join('');
    const calmos = o.cartoes.filter((x) => x.situacao === 'semIndicacao');
    if (calmos.length) h += '<h2 class="ss-calmos-t">Sem indicação agora</h2>' + calmos.map((x) => linhaCalma(r, x, verCartao)).join('');
    const cumprido = !!(o.resolucao && o.resolucao.cumprido);
    h += '<div class="ss-menu">';
    if (p.tituloResolucao !== null && (o.resolucao || o.etapasFinais.length)) h += linhaMenu(r, p.tituloResolucao, 'flag-3', '#3451B2', () => abrirResolucao(sessao), cumprido);
    if (m.e.acoes.some((a) => a.tipo.startsWith('passo.'))) h += linhaMenu(r, 'Corrigir a última resposta', 'arrow-back-up', '#A8530A', () => m.voltarPasso());
    h += linhaMenu(r, 'Evolução em gráfico', 'chart-line', '#1F5FD1', () => abrirEvolucao(sessao)) +
      linhaMenu(r, 'Passagem de plantão', 'clipboard-copy', '#6D3FD6', () => abrirPassagem(sessao)) +
      linhaMenu(r, 'Registro', 'clock', '#0F7F74', () => abrirRegistro(sessao)) +
      linhaMenu(r, 'Finalizar acompanhamento', 'circle-check', '#15803D', () => {
        U.confirma('Finalizar o acompanhamento?', (o.resolucao && !o.resolucao.cumprido ? 'Os critérios de resolução ainda não foram cumpridos. ' : '') + 'A sessão sai da tela inicial e os parâmetros, confirmações e horários são apagados deste aparelho. Não dá para desfazer.',
          [{ rotulo: 'Finalizar e apagar', perigo: true, acao: () => { m.encerrar(); fechar(); } }, { rotulo: 'Cancelar' }]);
      }, cumprido);
    h += '</div></div>';
    let pe = '<div class="ss-pe">';
    if (v.aviso) pe += '<div class="ss-registrado" role="status"><span>' + esc(v.aviso) + '</span><button type="button" ' + r.on(() => { v.aviso = null; m.desfazerUltima(); desenha(); }) + '>Desfazer</button></div>';
    pe += bt(r, 'Novos resultados', () => abrirResultados(sessao), 'ss-a66') + APOIO + '</div>';
    const desde = o.relogioDesde !== null ? o.relogioDesde : m.e.inicio;
    return { titulo: p.nome, direita: '<span class="ss-dur" data-dur="' + desde + '">' + n.duracao((agora - desde) / 1000) + '</span>', corpo: h, pe };
  }

  /* relógios: o texto anda a cada segundo; a regra é reavaliada a cada 30 s, ou a cada segundo com cronômetro */
  let seg = 0;
  t.acoes.exame = (a) => { const x = m.o.exames.find((y) => y.id === a.dataset.id); if (x) fonte(x.regra); };
  t.acoes.outros = () => { ui.v.outros = !ui.v.outros; desenha(); };
  const tick = () => {
    if (m.encerrada || m.e.etapa !== 'agora') return;
    seg++;
    if ((m.o.cronometro || seg % 30 === 0) && m.recalcular()) { m.atualiza(); return; }
    const agora = Date.now();
    t.el.querySelectorAll('[data-dur]').forEach((x) => { const s = n.duracao((agora - +x.dataset.dur) / 1000); if (x.textContent !== s) x.textContent = s; });
    const ex = t.rola.querySelector('[data-exames]');
    if (ex) { const hx = examesHTML(m, ui.v, agora); if (ex.innerHTML !== hx) { ex.innerHTML = hx; encaixa(ex); } }
    const cr = t.rola.querySelector('[data-crono]');
    if (cr && m.o.cronometro) { const hc = cronometroHTML(c.r, m.o.cronometro, agora, (rg) => fonte(rg)); if (cr.innerHTML !== hc) cr.innerHTML = hc; }
  };
  const relogio = setInterval(tick, 1000);
  const aoVoltarATela = () => { if (D.visibilityState === 'visible' && !m.encerrada && m.recalcular()) m.atualiza(); };
  D.addEventListener('visibilitychange', aoVoltarATela);
  /* passo numérico: Enter segue */
  t.el.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && ev.target.matches('input[data-num]') && ui.v.seguirNumero && /^passo:/.test(ui.chave)) { ev.preventDefault(); ui.v.seguirNumero(); } }, true);

  m.vistas.add(desenha);
  t.aoFechar.push(() => {
    clearInterval(relogio);
    D.removeEventListener('visibilitychange', aoVoltarATela);
    m.vistas.delete(desenha);
    (sessao.subtelas || []).slice().forEach((s) => s.fechar());
    if (atual === sessao) atual = null;
  });
  if (m.e.etapa === 'agora' && !m.encerrada) m.recalcular();
  desenha();
  return sessao;
}

/* Classificação atual e curva que ficam sempre na tela, para a doença que pede isso */
function curvaFixa(m, parametro) {
  const d = m.p.parametros.find((x) => x.id === parametro), serie = serieOrdenada(m.e, parametro), o = m.o;
  let h = '<div class="ss-curva">';
  if (o.classificacao !== null) h += '<p class="ss-h22">' + esc(o.classificacao) + '</p>';
  if (o.classificacaoDetalhe !== null) h += '<p class="ss-curva-l">' + esc(o.classificacaoDetalhe) + '</p>';
  const u = serie[serie.length - 1];
  if (u && d) h += '<p class="ss-curva-l">' + esc(d.nome + ': ' + n.num(u.valor, d.casas) + ' ' + d.unidade + ' às ' + n.hora(u.hora)) + '</p>';
  if (serie.length) h += grafico(serie, d, [], 140, (d ? d.nome : '') + ', ' + serie.map((s) => n.num(s.valor, d ? d.casas : 1) + ' às ' + n.hora(s.hora)).join(', '));
  return h + '</div>';
}

/* ---------- subtelas (fullScreenCover) ---------- */
function subtela(sessao, titulo, desenho, o = {}) {
  /* um toque duplo não abre a mesma subtela duas vezes */
  if ((sessao.subtelas || []).some((x) => x._sub === titulo)) return null;
  const c = camada({ titulo, grande: o.grande });
  c.t._sub = titulo;
  const { m } = sessao;
  const desenha = () => { if (!m.encerrada) c.pinta('sub', desenho); };
  (sessao.subtelas = sessao.subtelas || []).push(c.t);
  if (o.vivo !== false) m.vistas.add(desenha);
  c.t.aoFechar.push(() => { m.vistas.delete(desenha); sessao.subtelas = sessao.subtelas.filter((x) => x !== c.t); });
  desenha();
  return c;
}
function abrirResolucao(sessao) {
  const { m } = sessao, p = m.p;
  const fonte = (r) => abreFonte(p, r);
  subtela(sessao, p.tituloResolucao ?? 'Resolução', (r) => {
    const o = m.o;
    let h = '<div class="ss-pilha">';
    if (o.resolucao) {
      const rs = o.resolucao;
      h += '<h2 class="ss-h26' + (rs.cumprido ? ' ss-ok' : '') + '">' + (rs.cumprido ? 'Critérios de resolução cumpridos' : 'Ainda sem os critérios de resolução') + '</h2>' + criterios(r, rs, fonte);
      if (rs.texto !== null) h += '<p class="ss-t18" style="font-weight:600">' + esc(rs.texto) + '</p>';
      if (rs.acao) h += bt(r, rs.acao.rotulo, () => m.confirmar(rs.acao));
    }
    h += o.etapasFinais.map((x) => cartaoHTML(r, m, x, fonte, (a) => { m.confirmar(a); U.aviso('Registrado às ' + n.hora(Date.now())); })).join('');
    if (o.encerradaPelaRegra !== null) h += '<p class="ss-h20">' + esc(o.encerradaPelaRegra) + '</p>';
    return { titulo: p.tituloResolucao ?? 'Resolução', corpo: h + '</div>', pe: '<div class="ss-pe">' + APOIO + '</div>' };
  });
}
function abrirEvolucao(sessao) {
  const { m } = sessao, p = m.p;
  const c = subtela(sessao, 'Evolução', (r, v) => {
    v.escolha = v.escolha || {};
    const h = p.graficos.map((g) => {
      const id = v.escolha[g.id] || g.parametros[0], d = p.parametros.find((x) => x.id === id), serie = serieOrdenada(m.e, id);
      let x = '<section class="ss-evo"><h2>' + esc(g.titulo) + '</h2>';
      if (g.parametros.length > 1) x += F.segmentos(g.parametros.map((pp) => ({ id: pp, nome: (p.parametros.find((y) => y.id === pp) || {}).nome || pp })), id, 'data-acao="seg" data-g="' + esc(g.id) + '"');
      const u = serie[serie.length - 1];
      if (u && d) x += '<p class="ss-curva-l">' + esc('Último: ' + n.num(u.valor, d.casas) + ' ' + d.unidade + ' às ' + n.hora(u.hora)) + '</p>';
      x += serie.length ? grafico(serie, d, g.linhas[id] || [], 210, g.titulo + ', ' + serie.map((s) => n.num(s.valor, d ? d.casas : 1) + ' às ' + n.hora(s.hora)).join(', ')) : '<p class="ss-vazio">Sem registro.</p>';
      return x + '</section>';
    }).join('');
    return { titulo: 'Evolução', corpo: '<div class="ss-pilha ss-g18">' + h + '</div>', pe: '<div class="ss-pe">' + APOIO + '</div>' };
  });
  if (c) c.t.acoes.seg = (b) => { c.ui.v.escolha = c.ui.v.escolha || {}; c.ui.v.escolha[b.dataset.g] = b.dataset.v; c.repinta(); };
}
function abrirPassagem(sessao) {
  const { m } = sessao, p = m.p;
  let copiado = false;
  const c = subtela(sessao, 'Passagem de plantão', (r) => {
    const texto = n.passagem(p, m.e, m.o, Date.now());
    return {
      titulo: 'Passagem de plantão', corpo: '<div class="ss-passagem" data-passagem>' + esc(texto) + '</div>',
      pe: '<div class="ss-pe">' + bt(r, copiado ? 'Copiado' : 'Copiar texto', () => { F.copiar(n.passagem(p, m.e, m.o, Date.now())); copiado = true; c.repinta(); }) + APOIO + '</div>'
    };
  });
  return c;
}
function abrirRegistro(sessao) {
  const { m } = sessao, p = m.p;
  subtela(sessao, 'Registro', (r) => {
    const acoes = [...m.e.acoes].sort((a, b) => b.hora - a.hora);
    const corpo = '<div class="ss-pilha ss-g10">' + (acoes.length ? '' : '<p class="ss-t19" style="color:var(--tinta2)">Nada confirmado ainda.</p>') +
      acoes.map((a) => '<div class="ss-reg"><b>' + n.hora(a.hora) + '</b><span>' + esc(a.rotulo) + '</span></div>').join('') + '</div>';
    return {
      titulo: 'Registro', corpo,
      pe: '<div class="ss-pe">' + bt(r, 'Finalizar e apagar a sessão', () => {
        U.confirma('Apagar a sessão deste aparelho?', 'Parâmetros, confirmações e horários somem. Não dá para desfazer.', [
          { rotulo: 'Apagar a sessão', perigo: true, acao: () => { m.encerrar(); sessao.c.t.fechar(); } }, { rotulo: 'Cancelar' }]);
      }, 'ss-perigo') + APOIO + '</div>'
    };
  });
  void p;
}
function abrirResultados(sessao) {
  const { m } = sessao, p = m.p;
  const c = subtela(sessao, 'Novos resultados', (r, v, tt) => {
    v.textos = v.textos || {};
    v.respostas = v.respostas || {};
    if (v.hora === undefined) v.hora = Date.now();
    const ids = p.camposResultados(m.e);
    const salvar = () => {
      const vals = ids.map((id) => [id, lerNumero(v.textos[id])]).filter((x) => x[1] !== null);
      const lista = m.novosResultados(vals, v.respostas, v.hora);
      c.t.fechar();
      abrirMudancas(sessao, lista);
    };
    const corpo = '<div class="ss-pilha ss-g14"><p class="ss-intro ss-i18">Digite só o que tem.</p>' + campoHora(tt, 'Hora da coleta', v.hora) + campos(tt, p, ids, v.textos) +
      p.perguntasResultados(m.e).map((q) => simNao(r, q.texto, null, q.chave in v.respostas ? v.respostas[q.chave] : n.resposta(m.e, q.chave), (x) => { v.respostas[q.chave] = x; c.repinta(); })).join('') + '</div>';
    return {
      titulo: 'Novos resultados', corpo,
      aoHora: (x) => { const h = lerHoraHoje(x.value); if (h !== null) { v.hora = h; x.value = valorHora(h); } },
      pe: '<div class="ss-pe">' + bt(r, 'Salvar e ver o que mudou', () => {
        const f = foraDaFaixa(p, v.textos);
        if (!f.length) return salvar();
        U.confirma('Confirme o valor', f.join('\n'), [{ rotulo: 'Corrigir' }, { rotulo: 'Está certo', acao: salvar }]);
      }) + APOIO + '</div>'
    };
  }, { vivo: false });
  return c;
}
function abrirMudancas(sessao, lista) {
  const p = sessao.m.p;
  const c = subtela(sessao, 'O que mudou', (r) => ({
    titulo: 'O que mudou',
    corpo: '<div class="ss-pilha">' + (lista.length ? '' : '<p class="ss-t22s" style="color:var(--tinta2)">Nada mudou nas orientações.</p>') + lista.map((x) => '<div class="ss-mud"><h3>' + esc(x.titulo) + '</h3>' +
      '<p class="m-antes">' + esc('Antes: ' + x.antes) + '</p><p class="m-agora">' + esc('Agora: ' + x.depois) + '</p>' +
      (x.porque ? '<p class="m-porque">' + esc('Por quê: ' + x.porque.texto) + '</p>' + botaoFonte(r, () => abreFonte(p, x.porque)) : '') + '</div>').join('') + '</div>',
    pe: '<div class="ss-pe">' + bt(r, 'Voltar ao Agora', () => c.t.fechar()) + APOIO + '</div>'
  }), { vivo: false, grande: true });
}

/* ---------- encaixe na casca ---------- */
function liga() {
  const C = W.MedTechCasca;
  /* id vem de "Continuar" ou de "Acompanhar este paciente"; null vem de "Acompanhar paciente" (escolher a doença) */
  C.registrar('sessao', (id) => {
    const p = id ? protocolo(id) : null;
    if (p) abrirSessao(p); else abrirLista();
  });
  D.addEventListener('medtech:sessoes', (ev) => { const f = ev.detail && ev.detail.finalizada; if (f) Avisos.cancelar(f); });
  W.addEventListener('storage', (ev) => { if (!ev.key || ev.key.indexOf(n.CHAVE_ARMAZEM) === 0) reprogramarTodos(); });
  reprogramarTodos();
  const q = new URLSearchParams(location.search).get('sessao');
  if (q) setTimeout(() => { if (q === 'lista') abrirLista(); else if (protocolo(q)) abrirSessao(protocolo(q)); }, 0);
  /* para o teste: o que o motor devolveu para a sessão aberta */
  W.MTSessoesTela = { nucleo: n, protocolo, todas, atual: () => (atual ? { p: atual.m.p, e: atual.m.e, o: atual.m.o } : null), semIcone, avisos: Avisos };
}
if (W.MedTechCasca) liga(); else D.addEventListener('DOMContentLoaded', liga);
