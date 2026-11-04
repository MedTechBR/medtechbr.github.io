import Foundation

/* Varredura diferencial da anafilaxia. */
@main
struct VarreduraAnafilaxia {
    static func base(_ t: Date) -> EstadoSessao {
        var e = EstadoSessao(protocolo: "anafilaxia", inicio: t.addingTimeInterval(-60 * 60))
        for q in MotorAnafilaxia().triagem { e.respostas[q.chave] = false }
        e.respostas["inicioAgudo"] = true; e.respostas["pele"] = true; e.respostas["respiratorio"] = true
        e.acoes.append(AcaoRegistrada(tipo: "anafilaxia.confirmada", rotulo: "Confirmo: tratar como anafilaxia", hora: t.addingTimeInterval(-55 * 60)))
        let h = t.addingTimeInterval(-50 * 60)
        e.medir("peso", 70, h); e.medir("idade", 40, h); e.medir("pas", 110, h)
        return e
    }
    static func nn(_ v: Double?) -> Any { v.map { $0 as Any } ?? NSNull() }
    static func tresJ(_ t: Tres) -> String { switch t { case .sim: "sim"; case .nao: "nao"; case .falta: "falta" } }

    static func main() {
        principalVarredura { fonte in
            var cfg = ConfigVarredura(motor: MotorAnafilaxia(), fonte: fonte, base: base)
            cfg.bordas = [
                "peso": [2, 5, 9.9, 9.99, 10, 10.01, 20, 30, 49, 49.9, 49.99, 50, 50.01, 51, 70, 120, 250],
                "idade": [0, 0.5, 0.99, 1, 5, 5.99, 6, 9, 9.9, 9.99, 10, 10.01, 12, 12.99, 13, 13.01, 40],
                "pas": [69.9, 70, 71.9, 72, 76.9, 77, 79.9, 80, 87.9, 88, 89, 89.9, 90, 90.1, 110],
                "pasBasal": [100, 110, 120, 130],
                "adrenalinaHa": [0, 1, 4, 5, 6, 14, 15, 16, 30],
            ]
            cfg.tempos = [5, 15, 4.99, 5.01, 14.99, 15.01, 1, 10, 30, 60]
            cfg.escolhasExtras = ["exposicao": ["conhecido", "provavel", "sem"]]
            cfg.acoesExtras = ["adrenalina.dose", "evolucao.resolveu", "evolucao.persiste", "evolucao.piorou", "evolucao.outra", "resolucao.confirmada", "alta.conferida", "volume.bolus", "oxigenio.inicio", "beta2.dado", "triptase.coleta", "acesso.feito", "primeiros.feitos"]
            cfg.respostasExtras = ["inicioAgudo", "pele", "respiratorio", "bronco", "laringe", "paOrgao", "giGrave", "hipotensao", "gestante", "imunoterapia", "pesoEstimado", "instavel", "inconsciente", "betabloqueador"]
            cfg.chavesValores = ["mg": [0.15, 0.3, 0.5, 0.37], "mL": [0.15, 0.3, 0.5, 1400]]
            cfg.funcoes = {
                var n = 0
                let idades: [Double?] = [nil, 0, 0.5, 0.99, 1, 3, 5.99, 6, 8, 9.99, 10, 12.99, 13, 30, 110]
                var pesos: [Double?] = [nil, 0, -1]
                for p10 in 1...2500 { pesos.append(Double(p10) / 10) }
                for p in pesos {
                    for i in (p == nil || p! <= 0 ? idades + stride(from: 0.0, through: 110.0, by: 0.05).map { $0 } : idades) {
                        let d = MotorAnafilaxia.doseAdrenalina(peso: p, idade: i)
                        compararFuncao("anafilaxia", "doseAdrenalina", [nn(p), nn(i)], d.map { ["mg": $0.mg, "porPeso": $0.porPeso] as Any } ?? NSNull())
                        n += 1
                    }
                }
                let pass: [Double?] = [nil] + stride(from: 30.0, through: 300.0, by: 0.5).map { $0 } + [69.9, 71.9, 76.9, 79.9, 87.9, 89.9, 90.1]
                for pas in pass {
                    for i in [nil, 0, 0.5, 1, 3, 5, 9.9, 9.99, 10, 40] as [Double?] {
                        for b in [nil, 60, 100, 110, 120, 130, 250] as [Double?] {
                            compararFuncao("anafilaxia", "hipotensaoCalculada", [nn(pas), nn(i), nn(b)], tresJ(MotorAnafilaxia.hipotensaoCalculada(pas: pas, idade: i, basal: b)))
                            n += 1
                        }
                    }
                }
                return n
            }
            cfg.extras = { t in
                var r: [(EstadoSessao, Date)] = []
                func s(_ x: Double) -> Date { t.addingTimeInterval(-x) }
                /* Dose por peso e por idade no cartão. */
                for p in stride(from: 2.0, through: 250.0, by: 0.5) {
                    for i in [nil, 0.5, 6, 40] as [Double?] {
                        var e = base(t); e.series["peso"] = nil; e.series["idade"] = nil
                        e.medir("peso", p, s(60)); if let i { e.medir("idade", i, s(60)) }
                        if p.truncatingRemainder(dividingBy: 7) == 0 { e.respostas["pesoEstimado"] = true }
                        r.append((e, t))
                    }
                }
                for i in stride(from: 0.0, through: 110.0, by: 0.1) {
                    var e = base(t); e.series["peso"] = nil; e.series["idade"] = nil
                    e.medir("idade", (i * 10).rounded() / 10, s(60))
                    r.append((e, t))
                    var e2 = e; e2.respostas["pele"] = false
                    r.append((e2, t))
                }
                /* Hipotensão, idade e basal no estado inteiro (critérios, volume, posição). */
                for pas in Array(stride(from: 30.0, through: 160.0, by: 1.0)) + [69.9, 71.9, 76.9, 79.9, 89.9, 90.1] {
                    for i in [nil, 1, 5, 9.9, 10, 40] as [Double?] {
                        for b in [nil, 110, 130] as [Double?] {
                            var e = base(t); e.series = [:]
                            e.medir("peso", 20, s(60)); e.medir("pas", pas, s(60))
                            if let i { e.medir("idade", i, s(60)) }
                            if let b { e.medir("pasBasal", b, s(60)) }
                            e.respostas["respiratorio"] = nil; e.respostas["pele"] = false; e.escolhas["exposicao"] = "conhecido"
                            r.append((e, t))
                        }
                    }
                }
                /* Cronômetro da repetição segundo a segundo, por resposta, número de doses e peso. */
                let resps: [String?] = [nil, "resolveu", "persiste", "piorou"]
                for x in stride(from: 0.0, through: 1500.0, by: 1.0) {
                    for (k, rr) in resps.enumerated() {
                        let doses = 1 + (Int(x) + k) % 3
                        var e = base(t)
                        if (Int(x) / 7) % 4 == 0 { e.series["peso"] = nil }
                        if doses >= 2 { e.acoes.append(AcaoRegistrada(tipo: "adrenalina.dose", rotulo: "", hora: s(x + 600), valores: ["mg": 0.5, "mL": 0.5])) }
                        if doses >= 3 { e.medir("adrenalinaHa", 20, s(x)) }
                        e.acoes.append(AcaoRegistrada(tipo: "adrenalina.dose", rotulo: "", hora: s(x), valores: ["mg": 0.5, "mL": 0.5]))
                        if let rr { e.acoes.append(AcaoRegistrada(tipo: "evolucao." + rr, rotulo: "", hora: s(Double(Int(x) % 400)))) }
                        if (Int(x) % 5) == 0 { e.respostas["betabloqueador"] = (Int(x) % 10) == 0 }
                        r.append((e, t))
                    }
                }
                /* Dose só pela série "adrenalina dada há", sem ação. */
                for m in stride(from: 0.0, through: 30.0, by: 0.25) {
                    var e = base(t)
                    e.medir("adrenalinaHa", m, t)
                    r.append((e, t))
                }
                /* Critérios: todas as respostas em três valores, exposição rodando. */
                let chaves = ["inicioAgudo", "pele", "respiratorio", "paOrgao", "giGrave", "hipotensao", "bronco", "laringe"]
                let exps: [String?] = [nil, "conhecido", "provavel", "sem"]
                for m in 0..<6561 {
                    var e = base(t); e.series = [:]
                    var q = m
                    for c in chaves { let v = q % 3; q /= 3; e.respostas[c] = v == 0 ? nil : v == 1 }
                    e.escolhas["exposicao"] = exps[m % 4]
                    if m % 3 == 0 { e.respostas["imunoterapia"] = true }
                    if m % 11 == 0 { e.acoes.removeAll() }
                    r.append((e, t))
                }
                /* Posição, oxigênio, volume e alta em todas as combinações. */
                for m in 0..<729 {
                    var e = base(t)
                    var q = m
                    for c in ["respiratorio", "inconsciente", "gestante", "instavel", "bronco", "laringe"] { let v = q % 3; q /= 3; e.respostas[c] = v == 0 ? nil : v == 1 }
                    if m % 2 == 0 { e.acoes.append(AcaoRegistrada(tipo: "adrenalina.dose", rotulo: "", hora: s(400), valores: ["mg": 0.5])) }
                    if m % 4 == 0 { e.acoes.append(AcaoRegistrada(tipo: "adrenalina.dose", rotulo: "", hora: s(1000), valores: ["mg": 0.5])) }
                    if m % 3 == 0 { e.series["pas"] = nil }
                    if m % 5 == 0 { e.series["peso"] = nil }
                    if m % 7 == 0 { e.acoes.append(AcaoRegistrada(tipo: "evolucao.resolveu", rotulo: "", hora: s(100))); e.acoes.append(AcaoRegistrada(tipo: "resolucao.confirmada", rotulo: "", hora: s(50))) }
                    if m % 9 == 0 { e.acoes.append(AcaoRegistrada(tipo: "volume.bolus", rotulo: "", hora: s(200))) }
                    r.append((e, t))
                }
                return r
            }
            return cfg
        }
    }
}
