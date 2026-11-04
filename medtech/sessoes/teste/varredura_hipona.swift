import Foundation

/* Varredura diferencial da hiponatremia. O ponto crítico é a janela móvel de 24 h: sequências de sódio em grade,
   com as bordas de 24 h exatas (±1 s), os cortes de Δ (5, 8, 10), de Na (105, 125, 130, 135), a queda do ramo C (10, 48 h)
   e os relógios do sódio e da diurese. */
@main
struct VarreduraHipona {
    static let M = MotorHipona()

    static func base(_ t: Date, na: Double? = 118, m0: Double = 600, confirmado: Bool = true) -> EstadoSessao {
        var e = EstadoSessao(protocolo: "hipona", inicio: t.addingTimeInterval(-m0 * 60))
        for q in M.triagem { e.respostas[q.chave] = false }
        e.respostas["hipotonica"] = true
        e.respostas["sintomaGrave"] = false
        e.respostas["sintomaModerado"] = false
        e.respostas["concentracao3"] = true
        e.escolhas["duracao"] = "cronica"
        e.medir("peso", 70, t.addingTimeInterval(-m0 * 60))
        if let na { e.medir("sodio", na, t.addingTimeInterval(-m0 * 60)) }
        if confirmado { e.acoes.append(AcaoRegistrada(tipo: "hipona.confirmada", rotulo: "", hora: t.addingTimeInterval(-(m0 - 1) * 60))) }
        return e
    }
    static func sinal(_ e: inout EstadoSessao, _ ramo: String) {
        switch ramo {
        case "a": e.respostas["sintomaGrave"] = true
        case "b": e.respostas["sintomaModerado"] = true
        case "c": e.escolhas["duracao"] = "aguda"
        case "x": e.respostas["sintomaGrave"] = nil
        case "y": e.respostas["sintomaModerado"] = nil
        case "z": e.escolhas["duracao"] = nil
        case "u": e.escolhas["duracao"] = "desconhecida"
        default: break
        }
    }
    static func acao(_ e: inout EstadoSessao, _ tipo: String, _ t: Date, _ seg: Double, _ v: [String: Double] = [:]) {
        e.acoes.append(AcaoRegistrada(tipo: tipo, rotulo: tipo, hora: t.addingTimeInterval(-seg), valores: v))
    }

    static func estados(_ t: Date) -> [(EstadoSessao, Date)] {
        var r: [(EstadoSessao, Date)] = []
        let ramos = ["a", "b", "c", "d"]
        /* 1. Duas medidas depois do T0, em grade: Δ e janela móvel. */
        for t0 in [105.0, 106, 118, 125, 129.9, 130, 134.9] {
            for d1 in [-2.0, 4.9, 5, 8, 8.1, 10, 10.1] {
                for d2 in [-2.0, 0, 3, 5, 8.1] {
                    for h1 in [6.0, 23, 24, 25] {
                        for h2 in [1.0, 12, 24, 25] {
                            for ramo in ramos {
                                let total = h1 + h2
                                var e = base(t, na: t0, m0: 5 + total * 60)
                                sinal(&e, ramo)
                                e.medir("sodio", t0 + d1, t.addingTimeInterval(-(5 + h2 * 60) * 60))
                                e.medir("sodio", t0 + d1 + d2, t.addingTimeInterval(-300))
                                r.append((e, t))
                            }
                        }
                    }
                }
            }
        }
        /* 2. 24 h exatas, segundo a segundo: primeiro dia x depois, e a referência na borda do corte. */
        for s in -3...3 {
            for d in [7.9, 8, 8.1, 9.9, 10, 10.1, 12] {
                for ramo in ramos {
                    var e = base(t, na: 118, m0: 5 + 24 * 60 + Double(s) / 60)
                    sinal(&e, ramo)
                    e.medir("sodio", 118 + d, t.addingTimeInterval(-300))
                    r.append((e, t))
                    var e2 = base(t, na: 110, m0: 5 + 48 * 60)
                    sinal(&e2, ramo)
                    e2.medir("sodio", 120, t.addingTimeInterval(-300 - 86400 + Double(s)))
                    e2.medir("sodio", 120 + d, t.addingTimeInterval(-300))
                    r.append((e2, t))
                }
            }
        }
        /* 3. Ramo A: bólus, melhora, infusão, parada, tempos de 20 min. */
        for n in 0...4 {
            for ultimoMin in [1.0, 19, 20, 21, 45] {
                for melhora in [nil, true, false] as [Bool?] {
                    for d in [0.0, 3, 4.9, 5, 9.9, 10, 10.1] {
                        for t0 in [118.0, 126, 130, 131] {
                            for inf in 0...2 {
                                for grave in [true, false] {
                                    var e = base(t, na: t0, m0: 120)
                                    e.respostas["sintomaGrave"] = grave
                                    for i in 0..<n { acao(&e, "hipertonica.bolusA", t, (ultimoMin + Double(n - 1 - i) * 20) * 60, ["mL": 150, "pct": 3]) }
                                    if !grave && n == 0 { e.respostas["sintomaGrave"] = true }
                                    if let melhora { e.respostas["sintomasMelhoraram"] = melhora }
                                    e.medir("sodio", t0 + d, t.addingTimeInterval(-120))
                                    if inf >= 1 { acao(&e, "hipertonica.infusao", t, 3000) }
                                    if inf == 2 { acao(&e, "hipertonica.parada", t, 600) }
                                    r.append((e, t))
                                }
                            }
                        }
                    }
                }
            }
        }
        /* 4. Ramo B e C: bólus único, melhora, Na 130, queda aguda nas bordas de 10 e 48 h, concentração e composição corporal. */
        for ramo in ["b", "c"] {
            for feito in [false, true] {
                for melhora in [nil, true, false] as [Bool?] {
                    for t0 in [118.0, 129.9, 130] {
                        for d in [0.0, 4.9, 5, 8, 10, 10.1] {
                            for conc in [nil, true, false] as [Bool?] {
                                for comp in [0, 1, 2] {
                                    var e = base(t, na: t0, m0: 300)
                                    sinal(&e, ramo)
                                    if feito { acao(&e, "hipertonica.bolus" + ramo.uppercased(), t, 3600, ["mL": 150, "pct": 3]) }
                                    if let melhora { e.respostas["sintomasMelhoraram"] = melhora }
                                    e.respostas["concentracao3"] = conc
                                    if comp >= 1 { e.respostas["composicaoDiferente"] = true }
                                    if comp == 2 { e.series["peso"] = nil }
                                    e.medir("sodio", t0 + d, t.addingTimeInterval(-60))
                                    if ramo == "c" {
                                        let hu = t.addingTimeInterval(-60)
                                        e.medir("sodioPrevio", t0 + d + [9.9, 10, 10.1, 11][Int(d) % 4], hu)
                                        e.medir("sodioPrevioHoras", [47.99, 48, 48.01, 2][comp + (feito ? 1 : 0)], hu)
                                    }
                                    r.append((e, t))
                                }
                            }
                        }
                    }
                }
            }
        }
        for q in [9.9, 10, 10.01, 10.1, 15] {
            for h in [0, 1, 47.98, 48, 48.02] {
                for igual in [true, false] {
                    for sub in [0.0, -1, 1] {
                        var e = base(t, na: 120, m0: 300)
                        e.escolhas["duracao"] = "aguda"
                        let hu = t.addingTimeInterval(-60)
                        e.medir("sodioPrevio", 120 + q, hu)
                        e.medir("sodioPrevioHoras", h, igual ? hu : hu.addingTimeInterval(-1))
                        e.medir("sodio", 120 + sub, hu.addingTimeInterval(sub * 60))
                        r.append((e, t))
                    }
                }
            }
        }
        /* 5. Relógios do sódio e da diurese, minuto a minuto em volta dos marcos de 1, 4, 6, 12 e 24 h. */
        for u in stride(from: 0.0, through: 26 * 60, by: 7) {
            for ramo in ["a", "b", "c", "d", "u", "x", "y", "z"] {
                for est in [false, true] {
                    var e = base(t, na: 118, m0: u + 30)
                    sinal(&e, ramo)
                    if est { e.respostas["estabilizou"] = true }
                    e.medir("sodio", 121, t.addingTimeInterval(-30 * 60))
                    if ramo == "a" { acao(&e, "hipertonica.bolusA", t, (u + 25) * 60); e.respostas["sintomasMelhoraram"] = true; e.series["sodio"]![1].valor = 123 }
                    r.append((e, t))
                    r.append((e, t.addingTimeInterval(Double(Int(u) % 5) * 3600 + 1)))
                }
            }
        }
        for m in stride(from: 50.0, through: 70, by: 1) {
            for ramo in ["b", "c"] {
                var e = base(t, na: 118, m0: m)
                sinal(&e, ramo)
                e.medir("sodio", 119, t.addingTimeInterval(-[0, 60, 61, 59][Int(m) % 4]))
                r.append((e, t))
            }
        }
        for diu in [nil, 0, 99, 100, 100.4, 101, 300] as [Double?] {
            for aum in [nil, true, false] as [Bool?] {
                for est in [false, true] {
                    for dm in [0.0, 60, 119, 120, 121, 240] {
                        var e = base(t, na: 118, m0: 400)
                        if let diu { e.medir("diurese", diu, t.addingTimeInterval(-dm * 60)) }
                        if let aum { e.respostas["aumentoDiurese"] = aum }
                        if est { e.respostas["estabilizou"] = true }
                        e.medir("sodio", 120, t.addingTimeInterval(-100 * 60))
                        r.append((e, t))
                    }
                }
            }
        }
        /* 6. Entrada e alertas: Na 135, T0 andando com a confirmação, risco (105), comorbidade, K, neuro, correção rápida com G1. */
        for na in [104.9, 105, 105.1, 120, 134.9, 135, 135.1] {
            for hip in [nil, true, false] as [Bool?] {
                for conf in [false, true] {
                    var e = base(t, na: na, m0: 60, confirmado: conf)
                    e.respostas["hipotonica"] = hip
                    r.append((e, t))
                }
            }
        }
        for antes in [0, 1, 2] {
            var e = base(t, na: 95, m0: 30, confirmado: false)
            e.medir("sodio", 118, t.addingTimeInterval(-20 * 60))
            if antes > 0 { acao(&e, "hipona.confirmada", t, Double(antes == 1 ? 19 : 25) * 60) }
            e.medir("sodio", 120, t.addingTimeInterval(-300))
            e.medir("sodio", 118, t.addingTimeInterval(-20 * 60))
            r.append((e, t))
        }
        for flags in 0..<64 {
            var e = base(t, na: 118, m0: 600)
            let ks = ["fatorRisco", "comorbidade", "repondoK", "neuroNovo", "aumentoDiurese", "estabilizou"]
            for (i, k) in ks.enumerated() where flags & (1 << i) != 0 { e.respostas[k] = true }
            e.medir("sodio", 129 + Double(flags % 3), t.addingTimeInterval(-60))
            if flags % 4 == 0 { acao(&e, "g1.parado", t, 30) }
            if flags % 8 == 1 { acao(&e, "g1.especialista", t, 30) }
            if flags % 5 == 0 { acao(&e, "causa.d", t, 30) }
            r.append((e, t))
        }
        return r
    }

    static func medida(_ m: Medida?) -> Any { m.map { ["valor": $0.valor, "hora": Codec.ms($0.hora)] as Any } ?? NSNull() }
    static func fase(_ f: MotorHipona.FaseA) -> [String: Any] {
        switch f {
        case .rapida: ["caso": "rapida"]
        case .parar(let m): ["caso": "parar", "motivo": m]
        case .melhorou: ["caso": "melhorou"]
        case .continuar: ["caso": "continuar"]
        case .perguntaMelhora: ["caso": "perguntaMelhora"]
        case .semRegraMelhoraCedo: ["caso": "semRegraMelhoraCedo"]
        case .semRegraNa130: ["caso": "semRegraNa130"]
        case .naAltoSemBolus: ["caso": "naAltoSemBolus"]
        case .emCurso: ["caso": "emCurso"]
        case .aplicar(let n): ["caso": "aplicar", "n": n]
        case .tresSemMeta: ["caso": "tresSemMeta"]
        }
    }
    static func funcoes(_ e: EstadoSessao, _ a: Date) -> Int {
        let ej = Codec.estado(e)
        compararFuncao("hipona", "t0", [ej], medida(MotorHipona.t0(e)))
        let c = MotorHipona.conta(e)
        compararFuncao("hipona", "conta", [ej], c.map { d in
            ["t0": medida(d.t0), "atual": medida(d.atual), "referencia": medida(d.referencia), "desdeInicio": d.desdeInicio, "em24h": d.em24h,
             "primeiras24h": d.primeiras24h, "limite": d.limite, "falta": d.falta, "passou": d.passou] as Any
        } ?? NSNull())
        compararFuncao("hipona", "ramo", [ej], MotorHipona.ramo(e).map { $0.rawValue as Any } ?? NSNull())
        compararFuncao("hipona", "quedaAguda", [ej], MotorHipona.quedaAguda(e).map { $0 as Any } ?? NSNull())
        compararFuncao("hipona", "faseA", [ej, Codec.ms(a)], c.map { fase(MotorHipona.faseA(e, c: $0, agora: a)) as Any } ?? NSNull())
        compararFuncao("hipona", "g2Ativo", [ej], MotorHipona.g2Ativo(e))
        compararFuncao("hipona", "infusaoCorrendo", [ej], MotorHipona.infusaoCorrendo(e))
        return 7
    }

    static func main() {
        principalVarredura { fonte in
            var cfg = ConfigVarredura(motor: M, fonte: fonte, base: { t in
                var e = base(t, na: 118, m0: 600)
                e.medir("diurese", 80, t.addingTimeInterval(-600 * 60))
                return e
            })
            cfg.bordas = [
                "sodio": [100, 104.9, 105, 105.1, 110, 113, 118, 119.9, 120, 123, 124.9, 125, 125.1, 126, 127.9, 128, 128.1, 129.9, 130, 130.1, 134.9, 135, 135.1],
                "sodioPrevio": [120, 128, 129.9, 130, 130.1, 131, 135, 140],
                "sodioPrevioHoras": [0, 1, 6, 24, 47.9, 47.99, 48],
                "diurese": [0, 50, 99, 99.9, 100, 100.1, 101, 250],
                "peso": [30, 45, 60, 70, 75.5, 120],
                "potassio": [2.5, 3.5, 4.5],
                "taxa3": [0, 20, 50],
            ]
            cfg.tempos = [20, 19, 21, 60, 4 * 60, 6 * 60, 12 * 60, 24 * 60, 48 * 60, 24 * 60 - 1, 24 * 60 + 1, 2 * 60, 8 * 60]
            cfg.escolhasExtras = ["duracao": ["aguda", "cronica", "desconhecida"]]
            cfg.respostasExtras = ["hipotonica", "sintomaGrave", "sintomaModerado", "fatorRisco", "comorbidade", "composicaoDiferente", "sintomasMelhoraram",
                                   "estabilizou", "aumentoDiurese", "repondoK", "neuroNovo", "concentracao3"]
            cfg.acoesExtras = ["hipona.confirmada", "hipertonica.bolusA", "hipertonica.bolusB", "hipertonica.bolusC", "hipertonica.infusao", "hipertonica.parada",
                               "g1.parado", "g1.especialista", "causa.a", "causa.b", "causa.c", "causa.d"]
            cfg.chavesValores = ["mL": [150, 140], "pct": [3]]
            cfg.caminhadas = 600
            cfg.passosPorCaminhada = 50
            cfg.aleatorios = 6000
            cfg.extras = { t in estados(t) }
            cfg.funcoes = {
                let t = Date(timeIntervalSince1970: 1_800_000_000)
                var n = 0
                for (e, a) in estados(t) { n += funcoes(e, a) }
                for ni in 900...1700 {
                    let na = Double(ni) / 10
                    compararFuncao("hipona", "grau", [na], MotorHipona.grau(na).rawValue); n += 1
                }
                for na in [124.99999, 125.00001, 129.99999, 130.00001, 134.99999, 135.00001] {
                    compararFuncao("hipona", "grau", [na], MotorHipona.grau(na).rawValue); n += 1
                }
                return n
            }
            return cfg
        }
    }
}
