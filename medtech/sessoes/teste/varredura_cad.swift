import Foundation

/* Varredura diferencial da cetoacidose. */
@main
struct VarreduraCAD {
    static func main() {
        principalVarredura { fonte in
            var cfg = ConfigVarredura(motor: MotorCAD(), fonte: fonte, base: { t in
                var e = EstadoSessao(protocolo: "cad", inicio: t.addingTimeInterval(-600 * 60))
                for q in MotorCAD().triagem { e.respostas[q.chave] = false }
                e.respostas["comprometimento"] = false
                e.respostas["complicada"] = false
                e.escolhas["via"] = "iv"
                e.acoes.append(AcaoRegistrada(tipo: "cad.confirmada", rotulo: "Confirmo a cetoacidose", hora: t.addingTimeInterval(-590 * 60)))
                let h = t.addingTimeInterval(-300)
                e.medir("peso", 70, h); e.medir("glicemia", 400, h); e.medir("potassio", 4.2, h)
                e.medir("ph", 7.2, h); e.medir("hco3", 12, h); e.medir("bohb", 4, h)
                return e
            })
            cfg.bordas = [
                "potassio": [3.4, 3.49, 3.5, 3.51, 3.6, 4.0, 4.99, 5.0, 5.01, 5.1],
                "glicemia": [69, 69.5, 70, 70.4, 199, 199.5, 200, 249, 249.5, 250, 250.4, 251],
                "ph": [6.99, 7.0, 7.01, 7.24, 7.25, 7.26, 7.29, 7.3, 7.31],
                "hco3": [9.9, 10, 14.9, 15, 17.9, 18, 18.1],
                "bohb": [0.59, 0.6, 0.61, 2.99, 3.0, 5.99, 6.0, 6.01],
                "fosfato": [0.99, 1.0, 1.01],
                "peso": [30, 40, 49.9, 50, 70, 73.5, 80, 99.9, 100, 120, 150, 250],
            ]
            cfg.tempos = [60, 120, 240, 4 * 60, 1, 59, 61, 119, 121, 239, 241]
            cfg.escolhasExtras = ["via": ["iv", "sc"]]
            cfg.respostasExtras = ["diureseOk", "sinaisFosfato", "rebaixamento", "podeComer", "insulinaPrevia", "fragilOuRenal", "diabetesPrevio"]
            cfg.chavesValores = ["uKgH": [0.05, 0.1, 0.07], "uH": [3.5, 7, 7.35], "modo": [1, 2], "aCada": [1, 2], "uKg": [0.05, 0.1, 0.2], "u": [3.5, 7, 14], "mmol": [100]]
            cfg.funcoes = {
                var n = 0
                let phs: [Double?] = [nil, 6.5, 6.99, 7.0, 7.01, 7.1, 7.24, 7.25, 7.251, 7.26, 7.29, 7.299, 7.3, 7.31, 7.5]
                let hs: [Double?] = [nil, 1, 9.9, 9.99, 10, 10.01, 14.9, 14.99, 15, 15.01, 17.9, 18, 18.01, 24]
                let bs: [Double?] = [nil, 0, 0.59, 0.6, 0.61, 2.99, 3.0, 3.01, 5.99, 6.0, 6.01, 12]
                func j(_ x: Double?) -> Any { x.map { $0 as Any } ?? NSNull() }
                for ph in phs { for h in hs { for b in bs {
                    compararFuncao("cad", "gravidade", [j(ph), j(h), j(b)], MotorCAD.gravidade(ph: ph, hco3: h, bohb: b).map { $0.rawValue as Any } ?? NSNull())
                    n += 1
                    for g in [nil, 199.0, 200, 250] as [Double?] { for dm in [nil, true, false] as [Bool?] {
                        var e = EstadoSessao(protocolo: "cad", inicio: Date(timeIntervalSince1970: 1_800_000_000))
                        let h0 = Date(timeIntervalSince1970: 1_800_000_000)
                        if let ph { e.medir("ph", ph, h0) }; if let h { e.medir("hco3", h, h0) }; if let b { e.medir("bohb", b, h0) }; if let g { e.medir("glicemia", g, h0) }
                        if let dm { e.respostas["diabetesPrevio"] = dm }
                        let crit: (Criterio) -> Any = { ["id": $0.id, "nome": $0.nome, "situacao": Codec.tres($0.situacao), "valor": Codec.optS($0.valor), "opcional": $0.opcional] }
                        compararFuncao("cad", "criteriosCAD", [Codec.estado(e)], MotorCAD.criteriosCAD(e).map(crit))
                        let r = MotorCAD.criteriosResolucao(e)
                        compararFuncao("cad", "criteriosResolucao", [Codec.estado(e)], ["criterios": r.criterios.map(crit), "cumprido": r.cumprido] as [String: Any])
                        n += 2
                    } }
                } } }
                return n
            }
            cfg.extras = { t in
                var r: [(EstadoSessao, Date)] = []
                /* Grade fechada: K x glicemia x pH x via x insulina correndo, com pesos das contas. */
                for k in [3.4, 3.5, 3.51, 5.0, 5.01] {
                    for g in [69.0, 70, 199, 200, 249, 250] {
                        for ph in [6.99, 7.0, 7.25, 7.3] {
                            for via in ["iv", "sc"] {
                                for st in 0...2 {
                                    for peso in [41.3, 73.5, 99.99] {
                                        var e = cfg0(t)
                                        e.escolhas["via"] = via
                                        let h = t.addingTimeInterval(-120)
                                        e.series = [:]
                                        e.medir("peso", peso, h); e.medir("potassio", k, h); e.medir("glicemia", g, h); e.medir("ph", ph, h); e.medir("hco3", 12, h); e.medir("bohb", 4, h)
                                        e.respostas["diureseOk"] = true
                                        if st == 1 { e.acoes.append(AcaoRegistrada(tipo: via == "iv" ? "insulina.inicio" : "sc.dose", rotulo: "", hora: t.addingTimeInterval(-3600), valores: ["uKgH": 0.1, "uH": 0.1 * peso, "uKg": 0.1, "u": 0.1 * peso, "aCada": 1])) }
                                        if st == 2 { e.acoes.append(AcaoRegistrada(tipo: via == "iv" ? "insulina.inicio" : "sc.dose", rotulo: "", hora: t.addingTimeInterval(-7200), valores: ["uKgH": 0.05, "uH": 0.05 * peso, "uKg": 0.2, "u": 0.2 * peso, "aCada": 2])) }
                                        r.append((e, t))
                                    }
                                }
                            }
                        }
                    }
                }
                /* Transição: basal a cada minuto em volta de 60 e 120 min. */
                for m in stride(from: 50.0, through: 130.0, by: 1.0) {
                    var e = cfg0(t)
                    e.acoes.append(AcaoRegistrada(tipo: "insulina.inicio", rotulo: "", hora: t.addingTimeInterval(-400 * 60), valores: ["uKgH": 0.05, "uH": 3.5]))
                    e.acoes.append(AcaoRegistrada(tipo: "resolucao.confirmada", rotulo: "", hora: t.addingTimeInterval(-200 * 60)))
                    e.respostas["podeComer"] = true; e.respostas["insulinaPrevia"] = false; e.respostas["fragilOuRenal"] = m.truncatingRemainder(dividingBy: 2) == 0
                    e.acoes.append(AcaoRegistrada(tipo: "basal.sc", rotulo: "Basal", hora: t.addingTimeInterval(-m * 60)))
                    r.append((e, t))
                    r.append((e, t.addingTimeInterval(1)))
                    r.append((e, t.addingTimeInterval(-1)))
                }
                return r
            }
            return cfg
        }
    }
    static func cfg0(_ t: Date) -> EstadoSessao {
        var e = EstadoSessao(protocolo: "cad", inicio: t.addingTimeInterval(-600 * 60))
        for q in MotorCAD().triagem { e.respostas[q.chave] = false }
        e.respostas["comprometimento"] = false
        e.respostas["complicada"] = false
        e.escolhas["via"] = "iv"
        e.acoes.append(AcaoRegistrada(tipo: "cad.confirmada", rotulo: "Confirmo a cetoacidose", hora: t.addingTimeInterval(-590 * 60)))
        return e
    }
}
