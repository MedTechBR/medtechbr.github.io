import Foundation

/* Teste diferencial por varredura: gera estados, avalia no Swift e no JS e exige saída idêntica (Ponte.swift).
   Três fontes de estados, todas com semente fixa:
   1. bordas: estado base da doença com cada parâmetro passando pelos cortes que aparecem no motor (±0,1, ±0,01, ±1);
   2. caminhadas: a sessão andando como na tela (responde o passo guiado, confirma ações propostas, mede,
      volta passo, desfaz, avança o relógio caindo em cima das marcas de tempo, ±1 s);
   3. aleatórios: estados soltos com dados faltando, respostas e ações em qualquer combinação.
   Os cortes, ações, respostas e escolhas são colhidos do próprio fonte Swift do motor, mais os que a config da doença dá. */

struct Sorteio {
    var s: UInt64
    mutating func prox() -> UInt64 { s &+= 0x9E3779B97F4A7C15; var z = s; z = (z ^ (z >> 30)) &* 0xBF58476D1CE4E5B9; z = (z ^ (z >> 27)) &* 0x94D049BB133111EB; return z ^ (z >> 31) }
    mutating func int(_ n: Int) -> Int { n <= 0 ? 0 : Int(prox() % UInt64(n)) }
    mutating func chance(_ p: Double) -> Bool { Double(prox() >> 11) / Double(1 << 53) < p }
    mutating func um<T>(_ xs: [T]) -> T? { xs.isEmpty ? nil : xs[int(xs.count)] }
}

struct ConfigVarredura {
    let motor: ProtocoloSessao
    let fonte: String
    /* Valores de borda por parâmetro, além dos colhidos do fonte. */
    var bordas: [String: [Double]] = [:]
    /* Marcas de tempo em minutos, além das colhidas do fonte. */
    var tempos: [Double] = []
    var acoesExtras: [String] = []
    var respostasExtras: [String] = []
    var escolhasExtras: [String: [String]] = [:]
    var chavesValores: [String: [Double]] = [:]
    /* Estado de partida das bordas e das caminhadas (triagem respondida, diagnóstico confirmado etc.). */
    var base: (Date) -> EstadoSessao
    /* Estados extras feitos à mão pela doença (cortes combinados, faixas de dose). */
    var extras: (Date) -> [(EstadoSessao, Date)] = { _ in [] }
    /* Comparação direta das funções auxiliares (CrCl, doses etc.). */
    var funcoes: () -> Int = { 0 }
    var caminhadas = 400
    var passosPorCaminhada = 45
    var aleatorios = 3000
}

struct Colheita {
    var numeros: [Double] = []
    var acoes: [String] = []
    var respostas: [String] = []
    var escolhas: [String: [String]] = [:]
    var opcoes: [String] = []
    var chaves: [String] = []
    var segundos: [Double] = []
}

func colher(_ cfg: ConfigVarredura) -> Colheita {
    var c = Colheita()
    guard let s = try? String(contentsOfFile: cfg.fonte, encoding: .utf8) else { print("fonte não lido: \(cfg.fonte)"); exit(2) }
    func todos(_ padrao: String, _ grupo: Int = 1) -> [String] {
        let re = try! NSRegularExpression(pattern: padrao)
        return re.matches(in: s, range: NSRange(s.startIndex..., in: s)).compactMap { m in Range(m.range(at: grupo), in: s).map { String(s[$0]) } }
    }
    c.numeros = Array(Set(todos("(?<![A-Za-z0-9_.\"])([0-9]+(?:\\.[0-9]+)?)(?![0-9A-Za-z_\"])").compactMap(Double.init))).sorted()
    c.acoes = Array(Set(todos("\"([a-z][A-Za-z0-9]*(?:\\.[A-Za-z0-9]+)+)\"") + cfg.acoesExtras)).sorted()
    c.respostas = Array(Set(todos("resposta\\(\"([^\"]+)\"\\)") + todos("respostas\\[\"([^\"]+)\"\\]") + todos("chave: \"([^\"]+)\"") + cfg.respostasExtras)).sorted()
    c.opcoes = Array(Set(todos("OpcaoRamo\\(id: \"([^\"]+)\"") + todos("== \"([a-zA-Z0-9]+)\""))).sorted()
    var esc: [String: Set<String>] = [:]
    for k in todos("escolhas\\[\"([^\"]+)\"\\]") { esc[k, default: []].formUnion(c.opcoes) }
    for r in cfg.motor.ramos { esc[r.id, default: []].formUnion(r.opcoes.map(\.id)) }
    for (k, v) in cfg.escolhasExtras { esc[k, default: []].formUnion(v) }
    c.escolhas = esc.mapValues { Array($0).sorted() }
    c.chaves = Array(Set(todos("valores\\[\"([^\"]+)\"\\]") + Array(cfg.chavesValores.keys))).sorted()
    c.segundos = Array(Set(todos("addingTimeInterval\\((-?[0-9]+(?:\\.[0-9]+)?)\\)").compactMap(Double.init).map(abs) + cfg.tempos.map { $0 * 60 })).filter { $0 > 0 }.sorted()
    return c
}

/* Cortes de um parâmetro: os números do fonte dentro da faixa plausível, com os vizinhos. */
func cortes(_ d: DefParametro, _ c: Colheita, _ cfg: ConfigVarredura) -> [Double] {
    var v = Set<Double>()
    for x in c.numeros + (cfg.bordas[d.id] ?? []) {
        for y in [x, x - 1, x + 1, x - 0.1, x + 0.1, x - 0.01, x + 0.01] where y >= d.minPlausivel && y <= d.maxPlausivel { v.insert((y * 1000).rounded() / 1000) }
    }
    for x in cfg.bordas[d.id] ?? [] { v.insert(x) }
    v.insert(d.minPlausivel); v.insert(d.maxPlausivel)
    return Array(v).sorted()
}

final class Varredura {
    let cfg: ConfigVarredura
    let c: Colheita
    let p: ProtocoloSessao
    var cortesPor: [String: [Double]] = [:]
    var estados = 0
    var mudancas = 0
    var r: Sorteio
    let t0 = Date(timeIntervalSince1970: 1_800_000_000)

    init(_ cfg: ConfigVarredura, semente: UInt64) {
        self.cfg = cfg; self.p = cfg.motor; self.c = colher(cfg); self.r = Sorteio(s: semente)
        for d in p.parametros { cortesPor[d.id] = cortes(d, c, cfg) }
    }

    @discardableResult
    func avaliar(_ e: EstadoSessao, _ agora: Date) -> Orientacoes {
        let o = p.avaliar(e, agora: agora)
        compararNoJS(p, e, agora: agora, o)
        estados += 1
        return o
    }

    func valorDe(_ id: String) -> Double {
        let cs = cortesPor[id] ?? [1]
        return r.um(cs) ?? 1
    }
    func valoresAcao() -> [String: Double] {
        var v: [String: Double] = [:]
        for k in c.chaves where r.chance(0.25) { v[k] = r.um(cfg.chavesValores[k] ?? []) ?? r.um([0, 1, 2, 3, 0.05, 0.1, 0.5] + c.numeros.filter { $0 < 400 })! }
        return v
    }
    func marcaTempo() -> Double { (r.um(c.segundos) ?? 3600) + Double(r.int(3) - 1) }

    /* 1. Bordas: um parâmetro por vez sobre o estado base, e pares de parâmetros sorteados. */
    func bordas() {
        let base = cfg.base(t0)
        let o0 = avaliar(base, t0)
        _ = o0
        for d in p.parametros {
            for v in cortesPor[d.id] ?? [] {
                var e = base
                e.series[d.id] = nil
                e.medir(d.id, v, t0.addingTimeInterval(-300))
                avaliar(e, t0)
                /* A mesma borda com uma medida anterior diferente (tendência, primeira x última). */
                var e2 = e
                e2.medir(d.id, valorDe(d.id), t0.addingTimeInterval(-3900))
                avaliar(e2, t0)
            }
        }
        for _ in 0..<(p.parametros.count * 120) {
            var e = base
            for d in p.parametros where r.chance(0.35) {
                e.series[d.id] = nil
                if r.chance(0.85) { e.medir(d.id, valorDe(d.id), t0.addingTimeInterval(-Double(r.int(4) * 600 + 60))) }
            }
            avaliar(e, t0)
        }
        for (e, a) in cfg.extras(t0) { avaliar(e, a) }
    }

    /* 2. Caminhadas: a sessão como o médico usa. */
    func responderPasso(_ e: inout EstadoSessao, _ passo: PassoGuiado, rotulo: String, hora: Date, _ aplicar: (inout EstadoSessao) -> Void) {
        e.acoes.removeAll { $0.tipo == "passo." + passo.chave }
        aplicar(&e)
        e.acoes.append(AcaoRegistrada(tipo: "passo." + passo.chave, rotulo: rotulo, hora: hora))
    }
    func voltarPasso(_ e: inout EstadoSessao) {
        guard let i = e.acoes.lastIndex(where: { $0.tipo.hasPrefix("passo.") }) else { return }
        let chave = String(e.acoes[i].tipo.dropFirst("passo.".count))
        e.acoes.remove(at: i)
        e.respostas[chave] = nil
        e.respostas["semDado." + chave] = nil
        e.escolhas[chave] = nil
        if e.series[chave]?.isEmpty == false { e.series[chave]?.removeLast() }
    }
    func caminhar(passos: Int) {
        var agora = t0
        var e = r.chance(0.85) ? cfg.base(agora) : EstadoSessao(protocolo: p.id, inicio: agora)
        if r.chance(0.1) { for q in p.triagem where r.chance(0.5) { e.respostas[q.chave] = nil } }
        var anterior: Orientacoes? = nil
        for _ in 0..<passos {
            let o = avaliar(e, agora)
            if let a = anterior { compararMudancas(a, o); mudancas += 1 }
            anterior = o
            let propostas = (o.cartoes + o.etapasFinais).flatMap(\.acoes) + [o.confirmacao?.acao, o.resolucao?.acao].compactMap { $0 }
            let perguntas = (o.cartoes + o.etapasFinais).compactMap(\.pergunta)
            let x = r.int(100)
            if let passo = o.passo, x < 45 {
                let h = agora
                if let s = passo.semDado, r.chance(0.12) {
                    responderPasso(&e, passo, rotulo: passo.texto + " " + s, hora: h) { $0.respostas["semDado." + passo.chave] = true }
                } else {
                    switch passo.tipo {
                    case .simNao:
                        let v = r.chance(0.5)
                        responderPasso(&e, passo, rotulo: passo.texto + (v ? " Sim" : " Não"), hora: h) { $0.respostas[passo.chave] = v }
                    case .opcoes(let ops):
                        if let op = r.um(ops) { responderPasso(&e, passo, rotulo: passo.texto + " " + op.rotulo, hora: h) { $0.escolhas[passo.chave] = op.id } }
                    case .numero(let id):
                        let v = valorDe(id)
                        responderPasso(&e, passo, rotulo: "\(id): \(v)", hora: h) { $0.medir(id, v, h) }
                    case .hora(let padrao):
                        let hh = r.chance(0.5) ? (padrao ?? agora) : agora.addingTimeInterval(-marcaTempo())
                        responderPasso(&e, passo, rotulo: passo.texto + ": " + FormatoSessao.hora(hh), hora: hh) { _ in }
                    case .lista:
                        responderPasso(&e, passo, rotulo: passo.texto + ": lista conferida", hora: h) { _ in }
                    }
                }
            } else if x < 65, let a = r.um(propostas) {
                e.registrar(a, hora: agora)
            } else if x < 72, let q = r.um(perguntas) {
                let v = r.chance(0.6)
                e.respostas[q.chave] = v
                e.acoes.append(AcaoRegistrada(tipo: "resposta." + q.chave, rotulo: q.texto + (v ? " Sim" : " Não"), hora: agora))
            } else if x < 76, let k = r.um(c.respostas) {
                e.respostas[k] = r.chance(0.15) ? nil : r.chance(0.5)
            } else if x < 78, let (k, ops) = r.um(Array(c.escolhas)) {
                e.escolhas[k] = r.chance(0.1) ? nil : r.um(ops)
            } else if x < 88 {
                let h = r.chance(0.7) ? agora : agora.addingTimeInterval(-Double(r.int(120) * 60))
                for d in p.parametros where r.chance(0.3) { e.medir(d.id, valorDe(d.id), h) }
            } else if x < 90 {
                if let t = r.um(c.acoes) { e.acoes.append(AcaoRegistrada(tipo: t, rotulo: t, hora: agora, valores: valoresAcao())) }
            } else if x < 92 {
                voltarPasso(&e)
            } else if x < 93 {
                if !e.acoes.isEmpty { e.acoes.removeLast() }
            }
            /* O relógio anda quase sempre; às vezes cai exatamente numa marca a partir de um evento. */
            if r.chance(0.6) {
                if r.chance(0.5) {
                    let eventos = [e.inicio] + e.acoes.map(\.hora) + e.series.values.flatMap { $0.map(\.hora) }
                    let alvo = (r.um(eventos) ?? agora).addingTimeInterval(marcaTempo())
                    if alvo > agora { agora = alvo } else { agora = agora.addingTimeInterval(Double(r.um([1, 59, 60, 61, 300, 900])!)) }
                } else {
                    agora = agora.addingTimeInterval(Double(r.um([1, 30, 59, 60, 61, 120, 300, 600, 899, 900, 1800, 3599, 3600, 3601, 7200, 14400])!))
                }
            }
        }
    }

    /* 3. Aleatórios: qualquer combinação, com muita coisa faltando. */
    func aleatorio() {
        let agora = t0.addingTimeInterval(Double(r.int(40)) * 1800)
        var e = r.chance(0.7) ? cfg.base(agora.addingTimeInterval(-Double(r.int(48)) * 1800)) : EstadoSessao(protocolo: p.id, inicio: agora.addingTimeInterval(-marcaTempo()))
        for k in c.respostas where r.chance(0.3) { e.respostas[k] = r.chance(0.2) ? nil : r.chance(0.5) }
        for (k, ops) in c.escolhas where r.chance(0.3) { e.escolhas[k] = r.chance(0.2) ? nil : r.um(ops) }
        for d in p.parametros where r.chance(0.5) {
            if r.chance(0.3) { e.series[d.id] = nil }
            for _ in 0..<(1 + r.int(3)) { e.medir(d.id, valorDe(d.id), agora.addingTimeInterval(-marcaTempo() * Double(r.int(3)))) }
        }
        for _ in 0..<r.int(8) {
            if let t = r.um(c.acoes) { e.acoes.append(AcaoRegistrada(tipo: t, rotulo: t, hora: agora.addingTimeInterval(-marcaTempo() * Double(r.int(3))), valores: valoresAcao())) }
        }
        avaliar(e, agora)
    }

    func rodar() {
        let ini = Date()
        let nf = cfg.funcoes()
        bordas()
        let nb = estados
        for _ in 0..<cfg.caminhadas { caminhar(passos: cfg.passosPorCaminhada) }
        let nc = estados - nb
        for _ in 0..<cfg.aleatorios { aleatorio() }
        let na = estados - nb - nc
        print("VARREDURA \(p.id): \(estados) estados idênticos (bordas \(nb), caminhadas \(nc), aleatórios \(na)), \(mudancas) comparações de mudanças, \(nf) chamadas de funções auxiliares, \(String(format: "%.0f", Date().timeIntervalSince(ini))) s")
    }
}

/* Entrada comum: varredura <fonte do motor> [semente] [escala]. */
func principalVarredura(_ fazer: (String) -> ConfigVarredura) {
    let a = CommandLine.arguments
    guard a.count >= 2 else { print("uso: varredura <fonte do motor> [semente] [escala]"); exit(2) }
    var cfg = fazer(a[1])
    let semente = a.count > 2 ? UInt64(a[2]) ?? 1 : 1
    if a.count > 3, let f = Double(a[3]) {
        cfg.caminhadas = Int(Double(cfg.caminhadas) * f); cfg.aleatorios = Int(Double(cfg.aleatorios) * f)
    }
    compararDefinicao(cfg.motor)
    Varredura(cfg, semente: semente).rodar()
}
