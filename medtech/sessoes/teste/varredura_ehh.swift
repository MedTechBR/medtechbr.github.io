import Foundation

/* Varredura diferencial do estado hiperosmolar. */
@main
struct VarreduraEHH {
    static func base(_ t: Date, confirmado: Bool = true, medidas: Bool = true) -> EstadoSessao {
        var e = EstadoSessao(protocolo: "ehh", inicio: t.addingTimeInterval(-600 * 60))
        for q in MotorEHH().triagem { e.respostas[q.chave] = false }
        e.respostas["idoso"] = false
        e.respostas["comprometimento"] = false
        e.respostas["basalPrevia"] = false
        e.respostas["tromboseSuspeita"] = false
        e.escolhas["hipovolemia"] = "leve"
        if confirmado { e.acoes.append(AcaoRegistrada(tipo: "ehh.confirmada", rotulo: "Confirmo o estado hiperosmolar", hora: t.addingTimeInterval(-590 * 60))) }
        if medidas {
            let h = t.addingTimeInterval(-300)
            e.medir("peso", 70, h); e.medir("glicemia", 800, h); e.medir("sodio", 145, h); e.medir("potassio", 4.2, h)
            e.medir("ph", 7.35, h); e.medir("hco3", 20, h); e.medir("bohb", 1, h); e.medir("osm", 340, h)
            e.medir("diureseML", 300, h); e.medir("diureseH", 4, h)
        }
        return e
    }
    static func ins(_ e: inout EstadoSessao, _ taxa: Double, _ peso: Double, _ h: Date) {
        e.acoes.append(AcaoRegistrada(tipo: "insulina.inicio", rotulo: "", hora: h, valores: ["uKgH": taxa, "uH": taxa * peso]))
    }
    static func cod(_ c: [Criterio]) -> [[String: Any]] {
        c.map { ["id": $0.id, "nome": $0.nome, "situacao": Codec.tres($0.situacao), "valor": Codec.optS($0.valor), "opcional": $0.opcional] }
    }

    static func main() {
        principalVarredura { fonte in
            var cfg = ConfigVarredura(motor: MotorEHH(), fonte: fonte, base: { t in base(t) })
            cfg.bordas = [
                "potassio": [2.4, 2.5, 2.51, 3.4, 3.49, 3.5, 3.51, 4.99, 5.0, 5.01],
                "glicemia": [39, 39.9, 40, 69, 69.9, 70, 70.1, 199, 199.9, 200, 249, 249.9, 250, 250.1, 599, 599.9, 600, 600.1],
                "sodio": [120, 126, 133.3, 133.33, 133.34, 140, 150, 160],
                "ph": [7.29, 7.299, 7.3, 7.301, 7.31],
                "hco3": [14.9, 14.99, 15, 15.01, 17.9, 17.99, 18, 18.01],
                "bohb": [2.9, 2.99, 3.0, 3.01],
                "osm": [299, 299.9, 300, 300.1, 319, 319.9, 320, 320.1],
                "fosfato": [0.99, 1.0, 1.01],
                "peso": [30, 40, 49.9, 70, 73.5, 99.99, 150, 300],
                "diureseML": [0, 34.9, 35, 35.1, 139, 140, 141, 280, 1000],
                "diureseH": [1, 2, 4, 12],
            ]
            cfg.tempos = [1, 59, 60, 61, 119, 120, 121, 239, 240, 241, 24 * 60 - 1, 24 * 60, 24 * 60 + 1, 8 * 60, 12 * 60]
            cfg.escolhasExtras = ["hipovolemia": ["grave", "leve"]]
            cfg.respostasExtras = ["idoso", "comprometimento", "basalPrevia", "tromboseSuspeita", "pioraMental", "melhoraCognitiva", "sinaisFosfato", "podeComer", "insulinaPrevia", "fragilOuRenal", "osmNaoDeclina", "balancoPositivo", "insulinaAdequada"]
            cfg.chavesValores = ["uKgH": [0.05, 0.1, 0.07], "uH": [3.5, 7], "modo": [1, 2], "repor": [0, 1]]
            cfg.extras = { t in
                var r: [(EstadoSessao, Date)] = []
                let h5 = t.addingTimeInterval(-300)
                /* K x glicemia x HCO₃ x diurese x estado da insulina x decisão de diurese. */
                for k in [2.5, 2.51, 3.49, 3.5, 3.51, 4.99, 5.0, 5.01] {
                    for g in [39.0, 69.9, 70, 199, 200, 249.9, 250, 600] {
                        for h in [14.9, 15, 17.9, 18] {
                            for diu in [nil, 0.49, 0.5, 0.51] as [Double?] {
                                for st in 0...3 {
                                    for dec in [nil, 0.0, 1.0] as [Double?] {
                                        var e = base(t, medidas: false)
                                        let peso = 73.5
                                        e.medir("peso", peso, h5); e.medir("potassio", k, h5); e.medir("glicemia", g, h5); e.medir("sodio", 145, h5)
                                        e.medir("ph", 7.35, h5); e.medir("hco3", h, h5); e.medir("bohb", 1, h5)
                                        if let diu { e.medir("diureseML", diu * peso * 2, h5); e.medir("diureseH", 2, h5) }
                                        if st == 1 { ins(&e, 0.05, peso, t.addingTimeInterval(-3600)) }
                                        if st == 2 { ins(&e, 0.1, peso, t.addingTimeInterval(-3600)) }
                                        if st == 3 { e.acoes.append(AcaoRegistrada(tipo: "insulina.aguardar", rotulo: "", hora: t.addingTimeInterval(-600))) }
                                        if let dec { e.acoes.append(AcaoRegistrada(tipo: "kcl.decisaoDiurese", rotulo: "", hora: t.addingTimeInterval(dec == 1 ? -60 : -600), valores: ["repor": dec])) }
                                        r.append((e, t))
                                    }
                                }
                            }
                        }
                    }
                }
                /* Os quatro critérios, antes e depois de confirmar. */
                for g in [599.0, 600, 601, nil] as [Double?] {
                    for na in [133.33, 133.34, 145, nil] as [Double?] {
                        for m in [319.0, 320, 321, nil] as [Double?] {
                            for b in [2.99, 3.0, nil] as [Double?] {
                                for ph in [7.29, 7.3, nil] as [Double?] {
                                    for h in [14.9, 15, 17.9, 18, nil] as [Double?] {
                                        for conf in [false, true] {
                                            var e = base(t, confirmado: conf, medidas: false)
                                            e.medir("peso", 70, h5); e.medir("potassio", 4.2, h5)
                                            if let g { e.medir("glicemia", g, h5) }
                                            if let na { e.medir("sodio", na, h5) }
                                            if let m { e.medir("osm", m, h5) }
                                            if let b { e.medir("bohb", b, h5) }
                                            if let ph { e.medir("ph", ph, h5) }
                                            if let h { e.medir("hco3", h, h5) }
                                            r.append((e, t))
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                /* Velocidades: glicemia, osmolalidade calculada e medida, sódio em 24 h, pela hora real. */
                /* Intervalos curtos (decisão de 04/11/2026): abaixo de 30 min sem velocidade; 29,99 e 30 nas bordas. */
                for dt in [0.01, 0.5, 1, 10, 29, 29.99, 30.0, 30.01, 60, 90, 120, 241] {
                    for q in [-10.0, 0, 89, 90, 91, 119, 120, 121, 200, 15000] {
                        var e = base(t, medidas: false)
                        e.medir("peso", 70, h5); e.medir("potassio", 4.2, h5); e.medir("sodio", 145, h5)
                        e.medir("glicemia", 700, h5.addingTimeInterval(-dt * 60)); e.medir("glicemia", 700 - q * dt / 60, h5)
                        ins(&e, 0.05, 70, t.addingTimeInterval(-500 * 60))
                        r.append((e, t))
                    }
                    for q in [-4.0, 0, 2, 2.9, 3, 3.1, 5, 7.9, 8, 8.1, 12] {
                        var e = base(t, medidas: false)
                        e.medir("sodio", 160, h5.addingTimeInterval(-dt * 60)); e.medir("glicemia", 900, h5.addingTimeInterval(-dt * 60))
                        e.medir("sodio", 160 - q * dt / 60 / 2, h5); e.medir("glicemia", 900, h5)
                        for resp in [nil, true, false] as [Bool?] {
                            var x = e
                            if let resp { x.respostas["osmNaoDeclina"] = true; x.respostas["balancoPositivo"] = resp; x.respostas["insulinaAdequada"] = true }
                            r.append((x, t))
                        }
                        var m = base(t, medidas: false)
                        m.medir("osm", 340, h5.addingTimeInterval(-dt * 60)); m.medir("osm", 340 - q * dt / 60, h5)
                        r.append((m, t))
                        /* Mistura: medida mais antiga que a calculada. */
                        var mx = e
                        mx.medir("osm", 330, h5.addingTimeInterval(-dt * 120)); mx.medir("osm", 320, h5.addingTimeInterval(-dt * 90))
                        r.append((mx, t))
                    }
                }
                for q in [-25.0, -5, 0, 5, 9.9, 10, 10.1, 20] {
                    for h in [1.0, 12, 23, 24, 24.0 + 1.0 / 3600, 25] {
                        var e = base(t, medidas: false)
                        e.medir("sodio", 150, h5.addingTimeInterval(-h * 3600)); e.medir("sodio", 150 - q, h5)
                        e.medir("sodio", 152, h5.addingTimeInterval(-h * 1800))
                        r.append((e, t))
                    }
                }
                /* Queda exata nos cortes, sem medida intermediária (a de 152 acima desloca o máximo da janela). */
                for na0 in [150.0, 140.5, 133.3] {
                    for q in [9.9, 9.99, 10, 10.01, 10.1] {
                        for h in [0.5, 1.0, 23.99, 24, 24.0 + 1.0 / 3600] {
                            var e = base(t, medidas: false)
                            e.medir("sodio", na0, h5.addingTimeInterval(-h * 3600)); e.medir("sodio", na0 - q, h5)
                            r.append((e, t))
                        }
                    }
                }
                /* Resolução: osmolalidade, glicemia, diurese e cognição. */
                for o in [299.9, 300, 300.1] {
                    for g in [249.0, 250] {
                        for d in [0.5, 0.51] {
                            for cog in [nil, true, false] as [Bool?] {
                                for medida in [true, false] {
                                    var e = base(t, medidas: false)
                                    e.medir("peso", 70, h5); e.medir("glicemia", g, h5); e.medir("potassio", 4.2, h5)
                                    if medida { e.medir("osm", o, h5) } else { e.medir("sodio", (o - g / 18) / 2, h5) }
                                    e.medir("diureseML", d * 70 * 4, h5); e.medir("diureseH", 4, h5)
                                    if let cog { e.respostas["melhoraCognitiva"] = cog }
                                    ins(&e, 0.05, 70, t.addingTimeInterval(-400 * 60))
                                    r.append((e, t))
                                    var e2 = e
                                    e2.acoes.append(AcaoRegistrada(tipo: "resolucao.confirmada", rotulo: "", hora: t.addingTimeInterval(-120)))
                                    for come in [nil, true, false] as [Bool?] {
                                        var e3 = e2
                                        if let come { e3.respostas["podeComer"] = come; e3.respostas["insulinaPrevia"] = false; e3.respostas["fragilOuRenal"] = cog ?? false }
                                        r.append((e3, t))
                                    }
                                }
                            }
                        }
                    }
                }
                /* Exames e volume minuto a minuto; transição em volta de 60 e 120 min. */
                for m in stride(from: 0.0, through: 300.0, by: 1.0) {
                    var e = base(t, medidas: false)
                    let h = t.addingTimeInterval(-m * 60)
                    for (id, v) in [("glicemia", 500.0), ("sodio", 150), ("potassio", 4.2), ("ph", 7.35), ("hco3", 20), ("bohb", 1), ("osm", 330), ("fosfato", 1.2), ("creatinina", 1)] { e.medir(id, v, h) }
                    r.append((e, t))
                    var e2 = e
                    e2.series["potassio"] = [Medida(valor: m.truncatingRemainder(dividingBy: 2) == 0 ? 5.0 : 5.1, hora: h)]
                    r.append((e2, t))
                    var e3 = e
                    ins(&e3, 0.05, 70, t.addingTimeInterval(-300 * 60))
                    r.append((e3, t))
                    var e4 = e
                    e4.acoes.append(AcaoRegistrada(tipo: "volume.inicio", rotulo: "", hora: h))
                    e4.escolhas["hipovolemia"] = m.truncatingRemainder(dividingBy: 3) == 0 ? "grave" : (m.truncatingRemainder(dividingBy: 3) == 1 ? "leve" : nil)
                    r.append((e4, t))
                    if m >= 230 { r.append((e4, t.addingTimeInterval(m * 60 - 240 * 60 + 1))); r.append((e4, t.addingTimeInterval(240 * 60 - m * 60))) }
                }
                for m in stride(from: 50.0, through: 130.0, by: 1.0) {
                    var e = base(t)
                    ins(&e, 0.05, 70, t.addingTimeInterval(-400 * 60))
                    e.acoes.append(AcaoRegistrada(tipo: "resolucao.confirmada", rotulo: "", hora: t.addingTimeInterval(-200 * 60)))
                    e.respostas["podeComer"] = true; e.respostas["insulinaPrevia"] = false; e.respostas["fragilOuRenal"] = m.truncatingRemainder(dividingBy: 2) == 0
                    e.acoes.append(AcaoRegistrada(tipo: "basal.sc", rotulo: "SC", hora: t.addingTimeInterval(-m * 60)))
                    r.append((e, t)); r.append((e, t.addingTimeInterval(1))); r.append((e, t.addingTimeInterval(-1)))
                }
                /* Fosfato x K nas bordas, com e sem sinais (K 5,0 bloqueia desde 04/11/2026). */
                for k in [nil, 4.99, 5.0, 5.01, 5.1] as [Double?] { for f in [nil, 0.5, 0.99, 1.0] as [Double?] { for si in [nil, true, false] as [Bool?] {
                    var e = base(t)
                    let h4 = t.addingTimeInterval(-240)
                    if let k { e.medir("potassio", k, h4) } else { e.series["potassio"] = nil }
                    if let f { e.medir("fosfato", f, h4) }
                    if let si { e.respostas["sinaisFosfato"] = si }
                    r.append((e, t))
                    var c = e; c.acoes.append(AcaoRegistrada(tipo: "fosfato.inicio", rotulo: "", hora: h4)); r.append((c, t))
                } } }
                /* Saiu do perfil depois da confirmação, coleta antes e depois. */
                for d in [-1.0, 1] {
                    for (id, v) in [("ph", 7.29), ("hco3", 17.9), ("bohb", 3.0), ("ph", 7.3), ("hco3", 18), ("bohb", 2.99)] {
                        var e = base(t)
                        e.medir(id, v, t.addingTimeInterval(-590 * 60 + d))
                        r.append((e, t))
                    }
                }
                return r
            }
            cfg.funcoes = {
                var n = 0
                for na in stride(from: 120.0, through: 180.0, by: 0.37) {
                    for g in stride(from: 100.0, through: 1500.0, by: 13.7) {
                        compararFuncao("ehh", "osmEfetiva", [na, g], MotorEHH.osmEfetiva(na: na, glicemia: g)); n += 1
                    }
                }
                var rg = Sorteio(s: 77)
                let t = Date(timeIntervalSince1970: 1_800_000_000)
                for _ in 0..<4000 {
                    var e = base(t, medidas: false)
                    for id in ["sodio", "glicemia", "osm", "diureseML", "diureseH", "peso"] where rg.chance(0.8) {
                        for _ in 0..<(1 + rg.int(4)) {
                            let h = t.addingTimeInterval(-Double(rg.int(6)) * 1800 - Double(rg.um([0, 0, 1, 59, 3600])!))
                            let v: Double
                            switch id {
                            case "sodio": v = 120 + Double(rg.int(500)) / 10
                            case "glicemia": v = 100 + Double(rg.int(1200))
                            case "osm": v = 280 + Double(rg.int(800)) / 10
                            case "diureseML": v = Double(rg.int(500))
                            case "diureseH": v = Double(rg.int(5))
                            default: v = rg.chance(0.1) ? 0 : 40 + Double(rg.int(80))
                            }
                            e.medir(id, v, h)
                            /* Glicemia na mesma hora do sódio, para coleta completa. */
                            if id == "sodio" && rg.chance(0.6) { e.medir("glicemia", 100 + Double(rg.int(1200)), h) }
                        }
                    }
                    let est = Codec.estado(e)
                    let q = MotorEHH.quedaOsm(e)
                    compararFuncao("ehh", "quedaOsm", [est], q.map { ["queda": $0.queda, "medida": $0.medida] as Any } ?? NSNull())
                    compararFuncao("ehh", "quedaGlicemia", [est], MotorEHH.quedaGlicemia(e).map { $0 as Any } ?? NSNull())
                    compararFuncao("ehh", "glicemiaIntervaloCurto", [est], MotorEHH.glicemiaIntervaloCurto(e))
                    compararFuncao("ehh", "osmIntervaloCurto", [est], MotorEHH.osmIntervaloCurto(e))
                    compararFuncao("ehh", "quedaSodio24h", [est], MotorEHH.quedaSodio24h(e).map { $0 as Any } ?? NSNull())
                    compararFuncao("ehh", "diurese", [est], MotorEHH.diurese(e).map { $0 as Any } ?? NSNull())
                    let a = MotorEHH.osmAtual(e)
                    compararFuncao("ehh", "osmAtual", [est], a.map { ["valor": $0.valor, "hora": Codec.ms($0.hora), "medida": $0.medida] as Any } ?? NSNull())
                    compararFuncao("ehh", "coletasCompletas", [est], MotorEHH.coletasCompletas(e).map { ["valor": $0.valor, "hora": Codec.ms($0.hora)] })
                    compararFuncao("ehh", "criteriosEHH", [est], cod(MotorEHH.criteriosEHH(e)))
                    let cr = MotorEHH.criteriosResolucao(e)
                    compararFuncao("ehh", "criteriosResolucao", [est], ["criterios": cod(cr.criterios), "cumprido": cr.cumprido])
                    n += 8
                }
                return n
            }
            return cfg
        }
    }
}
