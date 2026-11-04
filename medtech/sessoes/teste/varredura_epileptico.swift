import Foundation

/* Varredura diferencial do estado de mal epiléptico.
   Desde 04/11/2026 o motor Swift junta as doses por lista em ordem fixa (não mais por Dictionary): não depende de
   SWIFT_DETERMINISTIC_HASHING. O bloco 8 cobre o empate de hora entre todas as drogas (ver DIVERGENCIAS.md, item 1). */
typealias ME = MotorEpileptico

@main
struct VarreduraEpileptico {
    static func base(_ t: Date, segundos s: Double = 600, peso: Double? = 70, continua: Bool? = true) -> EstadoSessao {
        var e = EstadoSessao(protocolo: "epileptico", inicio: t.addingTimeInterval(-900 * 60))
        for q in ME().triagem { e.respostas[q.chave] = false }
        e.medir("minCrise", s / 60, t)
        if let peso { e.medir("peso", peso, t.addingTimeInterval(-900 * 60)) }
        e.medir("idade", 40, t.addingTimeInterval(-900 * 60))
        if let continua { e.respostas["criseContinua"] = continua }
        e.acoes.append(AcaoRegistrada(tipo: "sessao.confirmada", rotulo: "Iniciar o cronômetro", hora: t.addingTimeInterval(-890 * 60)))
        return e
    }
    static func ac(_ e: inout EstadoSessao, _ t: Date, _ tipo: String, segundos s: Double, _ v: [String: Double] = [:]) {
        e.acoes.append(AcaoRegistrada(tipo: tipo, rotulo: tipo, hora: t.addingTimeInterval(-s), valores: v))
    }
    static func dose(_ d: ME.DoseDada) -> [String: Any] { ["droga": d.droga, "hora": Codec.ms(d.hora), "mg": d.mg.map { $0 as Any } ?? NSNull()] }
    static func status(_ s: ME.StatusCrise) -> String { switch s { case .continua: "continua"; case .cessou: "cessou"; case .naoInformado: "naoInformado" } }
    static func funcoesDoEstado(_ e: EstadoSessao) -> Int {
        let j = Codec.estado(e)
        compararFuncao("epileptico", "inicioCrise", [j], Codec.ms(ME.inicioCrise(e)))
        compararFuncao("epileptico", "status", [j], status(ME.status(e)))
        compararFuncao("epileptico", "dosesIniciais", [j], ME.dosesIniciais(e).map(dose))
        compararFuncao("epileptico", "dosesSegunda", [j], ME.dosesSegunda(e).map(dose))
        var n = 4
        if let p = e.valor("peso") { compararFuncao("epileptico", "abaixoDaPlena", [j, p], ME.abaixoDaPlena(e, peso: p).map { $0 as Any } ?? NSNull()); n += 1 }
        for d in ["midazolam", "lorazepam", "diazepam", "fenobarbital"] { compararFuncao("epileptico", "indisponivel", [j, d], ME.indisponivel(e, d)); n += 1 }
        return n
    }

    static func main() {
        principalVarredura { fonte in
            var cfg = ConfigVarredura(motor: ME(), fonte: fonte, base: { t in base(t) })
            cfg.bordas = [
                "minCrise": [0, 4.98, 4.99, 5, 5.01, 19.98, 19.99, 20, 20.01, 39.99, 40, 40.01, 59.99, 60, 60.01, 240],
                "peso": [30, 39.9, 40, 40.01, 40.1, 41, 49.9, 50, 66.6, 66.67, 70, 74.9, 74.99, 75, 75.01, 112.5, 150, 300],
                "idade": [0, 17, 17.9, 17.99, 18, 18.01, 40, 110],
                "glicemia": [10, 59, 59.4, 59.5, 59.9, 59.99, 60, 60.01, 60.4, 61, 90, 800],
                "dadoMidazolam": [0, 4.9, 5, 5.1, 9.9, 10],
                "dadoLorazepam": [0, 3.9, 3.99, 4, 6.9, 7, 8],
                "dadoDiazepam": [0, 9.9, 10, 10.4, 10.5, 10.6, 14, 20],
                "dadoFenobarbital": [0, 1050, 1125, 4500],
                "dadoFosfenitoina": [0, 1400, 1500],
                "dadoValproato": [0, 2800, 3000],
                "dadoLevetiracetam": [0, 4200, 4500],
            ]
            cfg.tempos = [5, 20, 40, 60, 4.99, 5.01, 19.99, 20.01, 39.99, 40.01, 59.99, 60.01, 1, 10]
            cfg.respostasExtras = ["criseContinua", "acessoVenoso"]
            cfg.acoesExtras = ["crise.continua", "crise.cessou", "basal.sim", "basal.nao", "estabilizacao.feita", "glicose.dada", "fase.avancar",
                               "inicial.midazolam", "inicial.lorazepam", "inicial.diazepam", "inicial.fenobarbital", "inicial.diazepamRetal", "inicial.midazolamNasal",
                               "segunda.fosfenitoina", "segunda.valproato", "segunda.levetiracetam", "segunda.fenitoina", "segunda.fenobarbital",
                               "terceira.repetir", "terceira.anestesico"]
                + ["midazolam", "lorazepam", "diazepam", "fenobarbital", "fosfenitoina", "valproato", "levetiracetam"].flatMap { ["servico.sem." + $0, "servico.tem." + $0] }
            /* "para" fora de 1...3 derruba o Swift (índice de nomesFase); a tela só propõe fase + 1 nas fases 1 e 2. */
            cfg.chavesValores = ["para": [1, 2, 3], "mg": [0, 3.9, 4, 5, 7, 9.9, 10, 1050, 1400, 1500], "mgMin": [10.5, 6], "mgMax": [14, 8]]
            cfg.caminhadas = 900
            cfg.aleatorios = 6000
            cfg.funcoes = {
                var n = 0
                for p10 in 0...3000 {
                    let p = Double(p10) / 10
                    let iv = ME.diazepamIV(p), rt = ME.diazepamRetal(p)
                    let x: [String: Any] = [
                        "midazolamIM": ME.midazolamIM(p).map { $0 as Any } ?? NSNull(), "lorazepam": ME.lorazepam(p),
                        "diazepamIV": ["min": iv.min, "max": iv.max], "diazepamRetal": ["min": rt.min, "max": rt.max],
                        "fenobarbital": ME.fenobarbital(p), "fosfenitoina": ME.fosfenitoina(p), "valproato": ME.valproato(p), "levetiracetam": ME.levetiracetam(p),
                    ]
                    compararFuncao("epileptico", "doses", [p], x); n += 1
                }
                for p in [12.9, 12.99, 13, 13.01, 39.99, 40, 40.001, 40.01, 66.66, 66.67, 74.99, 75, 75.01, 100.0 / 3, 73.5, 0.1, 1e-9] {
                    let iv = ME.diazepamIV(p), rt = ME.diazepamRetal(p)
                    compararFuncao("epileptico", "doses", [p], ["midazolamIM": ME.midazolamIM(p).map { $0 as Any } ?? NSNull(), "lorazepam": ME.lorazepam(p), "diazepamIV": ["min": iv.min, "max": iv.max], "diazepamRetal": ["min": rt.min, "max": rt.max], "fenobarbital": ME.fenobarbital(p), "fosfenitoina": ME.fosfenitoina(p), "valproato": ME.valproato(p), "levetiracetam": ME.levetiracetam(p)] as [String: Any]); n += 1
                }
                for s in -10...4000 { compararFuncao("epileptico", "fase", [Double(s)], ME.fase(segundos: Double(s))); n += 1 }
                for s in [299.999, 300.001, 1199.5, 1200.0001, 2399.9999, 3599.999, 3600.0] { compararFuncao("epileptico", "fase", [s], ME.fase(segundos: s)); n += 1 }
                return n
            }
            cfg.extras = { t in
                var r: [(EstadoSessao, Date)] = []
                /* 1. Segundo a segundo em volta das marcas de 5, 20, 40 e 60 min, com doses e respostas variadas. */
                var segs: [Double] = []
                for m in [300.0, 1200, 2400, 3600] { for d in -12...12 { segs.append(m + Double(d)) } }
                segs += stride(from: 0.0, through: 4500, by: 45).map { $0 }
                for s in segs {
                    for cen in 0..<9 {
                        var e = base(t, segundos: s, continua: cen == 7 ? nil : true)
                        switch cen {
                        case 1: ac(&e, t, "inicial.lorazepam", segundos: Swift.min(s, 200), ["mg": 4]); ac(&e, t, "crise.continua", segundos: 1)
                        case 2: ac(&e, t, "inicial.diazepam", segundos: Swift.min(s, 200), ["mgMin": 10, "mgMax": 10]); ac(&e, t, "inicial.diazepam", segundos: Swift.min(s, 100), ["mgMin": 10, "mgMax": 10]); ac(&e, t, "crise.continua", segundos: 1)
                        case 3: ac(&e, t, "inicial.midazolam", segundos: Swift.min(s, 300), ["mg": 10]); ac(&e, t, "crise.continua", segundos: 1)
                        case 4: ac(&e, t, "inicial.midazolam", segundos: Swift.min(s, 900), ["mg": 10]); ac(&e, t, "segunda.levetiracetam", segundos: Swift.min(s, 300), ["mg": 4200]); ac(&e, t, "crise.continua", segundos: 1)
                        case 5: ac(&e, t, "inicial.lorazepam", segundos: Swift.min(s, 200), ["mg": 4]); ac(&e, t, "crise.cessou", segundos: 1); ac(&e, t, "basal.sim", segundos: 0)
                        case 6: ac(&e, t, "fase.avancar", segundos: 10, ["para": 2]); ac(&e, t, "inicial.lorazepam", segundos: Swift.min(s, 200), ["mg": 4])
                        case 7: ac(&e, t, "inicial.lorazepam", segundos: Swift.min(s, 200), ["mg": 4])
                        case 8: ac(&e, t, "fase.avancar", segundos: 10, ["para": 3]); ac(&e, t, "terceira.repetir", segundos: 5)
                        default: break
                        }
                        r.append((e, t))
                    }
                }
                /* 2. Peso a cada 0,5 kg em cada cenário de dose. */
                for p10 in stride(from: 300, through: 3000, by: 5) {
                    let p = Double(p10) / 10
                    for cen in 0..<8 {
                        var e = base(t, segundos: cen < 4 ? 600 : 1500, peso: p)
                        switch cen {
                        case 1: ac(&e, t, "inicial.lorazepam", segundos: 200, ["mg": ME.lorazepam(p)]); ac(&e, t, "crise.continua", segundos: 1)
                        case 2: ac(&e, t, "inicial.diazepam", segundos: 200, ["mgMin": ME.diazepamIV(p).min, "mgMax": ME.diazepamIV(p).max]); ac(&e, t, "crise.continua", segundos: 1)
                        case 3: for d in ["midazolam", "lorazepam", "diazepam"] { ac(&e, t, "servico.sem." + d, segundos: 50) }
                        case 4: ac(&e, t, "inicial.midazolam", segundos: 800, ["mg": ME.midazolamIM(p) ?? 0]); ac(&e, t, "crise.continua", segundos: 1)
                        case 5: ac(&e, t, "inicial.fenobarbital", segundos: 800, ["mg": 15 * p]); ac(&e, t, "crise.continua", segundos: 1)
                                for d in ["fosfenitoina", "valproato", "levetiracetam"] { ac(&e, t, "servico.sem." + d, segundos: 50) }
                        case 6: e.respostas["acessoVenoso"] = false
                        case 7: e.respostas["acessoVenoso"] = false; for d in ["fosfenitoina", "valproato", "levetiracetam"] { ac(&e, t, "servico.sem." + d, segundos: 50) }
                        default: break
                        }
                        r.append((e, t))
                    }
                }
                /* 3. Glicemia, com e sem glicose dada antes ou depois da medida. */
                for g in stride(from: 10.0, through: 800, by: 1) {
                    for cen in 0..<3 {
                        var e = base(t)
                        e.medir("glicemia", g, t.addingTimeInterval(-120))
                        if cen == 1 { ac(&e, t, "glicose.dada", segundos: 60) }
                        if cen == 2 { ac(&e, t, "glicose.dada", segundos: 180) }
                        r.append((e, t))
                    }
                }
                for g in [59.4, 59.5, 59.6, 59.99, 60.0, 60.01, 60.49, 60.5] { var e = base(t); e.medir("glicemia", g, t); r.append((e, t)) }
                /* 4. Toda combinação de drogas indisponíveis, nas fases 1 e 2, com e sem fenobarbital inicial. */
                let drogas = ["midazolam", "lorazepam", "diazepam", "fenobarbital", "fosfenitoina", "valproato", "levetiracetam"]
                for mascara in 0..<(1 << drogas.count) {
                    for s in [600.0, 1500] {
                        for feno in [false, true] {
                            for volta in [false, true] {
                                var e = base(t, segundos: s)
                                for (i, d) in drogas.enumerated() where mascara & (1 << i) != 0 {
                                    ac(&e, t, "servico.sem." + d, segundos: 100)
                                    if volta && i % 2 == 0 { ac(&e, t, "servico.tem." + d, segundos: 50) }
                                }
                                if feno && s > 1200 { ac(&e, t, "inicial.fenobarbital", segundos: 800, ["mg": 1050]); ac(&e, t, "crise.continua", segundos: 1) }
                                r.append((e, t))
                            }
                        }
                    }
                }
                /* 5. Dose digitada abaixo da plena, por droga e peso. */
                for p in [30.0, 40, 41, 66, 66.67, 70, 100, 150] {
                    for (serie, vals) in [("dadoMidazolam", [4.9, 5, 9.9, 10]), ("dadoLorazepam", [3, 3.99, 4, 6.6, 6.7]), ("dadoDiazepam", [4.5, 6, 9.9, 9.99, 10, 10.05])] {
                        for v in vals {
                            for s in [600.0, 1500] {
                                var e = base(t, segundos: s, peso: p)
                                e.medir(serie, v, t.addingTimeInterval(-120))
                                r.append((e, t))
                                ac(&e, t, "crise.continua", segundos: 1)
                                r.append((e, t))
                            }
                        }
                    }
                }
                /* 6. Status da crise: resposta, ações e ordem com a última terapia, segundo a segundo. */
                for d in -3...3 {
                    for resp in [nil, true, false] as [Bool?] {
                        for tipo in ["crise.continua", "crise.cessou", ""] {
                            for basal in ["", "basal.sim", "basal.nao"] {
                                var e = base(t, segundos: 900, continua: resp)
                                ac(&e, t, "inicial.lorazepam", segundos: 300, ["mg": 4])
                                if !tipo.isEmpty { ac(&e, t, tipo, segundos: 300 - Double(d)) }
                                if !basal.isEmpty { ac(&e, t, basal, segundos: 300 - Double(d) - 1) }
                                r.append((e, t))
                            }
                        }
                    }
                }
                /* 7. Idade, fora do escopo e triagem. */
                for i in [0.0, 17, 17.5, 17.99, 18, 18.01, 110] { var e = base(t); e.medir("idade", i, t); r.append((e, t)) }
                for q in ME().triagem { var e = base(t); e.respostas[q.chave] = true; r.append((e, t)); e.respostas[q.chave] = nil; r.append((e, t)) }
                var semInicio = base(t); semInicio.series["minCrise"] = nil; r.append((semInicio, t)); r.append((semInicio, t.addingTimeInterval(3600 * 20)))
                var semConf = base(t); semConf.acoes.removeAll(); r.append((semConf, t))
                /* 8. Doses de drogas diferentes na mesma hora: todos os pares, confirmadas ou digitadas, nas duas ordens de inserção. */
                let listas: [(String, [String], [String: String])] = [
                    ("inicial.", ["midazolam", "lorazepam", "diazepam", "fenobarbital", "diazepamRetal", "midazolamNasal"],
                     ["midazolam": "dadoMidazolam", "lorazepam": "dadoLorazepam", "diazepam": "dadoDiazepam", "fenobarbital": "dadoFenobarbital"]),
                    ("segunda.", ["fosfenitoina", "valproato", "levetiracetam", "fenitoina", "fenobarbital"],
                     ["fosfenitoina": "dadoFosfenitoina", "valproato": "dadoValproato", "levetiracetam": "dadoLevetiracetam"]),
                ]
                for (prefixo, drogas, series) in listas {
                    for a in drogas { for b in drogas where b != a { for (sa, sb) in [(false, false), (true, false), (false, true), (true, true)] {
                        if sa && series[a] == nil || sb && series[b] == nil { continue }
                        var e = base(t, segundos: prefixo == "inicial." ? 600 : 1500)
                        for (d, ser, mg) in [(a, sa, 1.0), (b, sb, 2.0)] {
                            if ser { e.medir(series[d]!, mg, t.addingTimeInterval(-400)) } else { ac(&e, t, prefixo + d, segundos: 400, ["mg": mg]) }
                        }
                        ac(&e, t, "crise.continua", segundos: 1)
                        r.append((e, t))
                        if prefixo == "inicial." { e.medir("dadoDiazepam", 3, t.addingTimeInterval(-400)); r.append((e, t)) }
                    } } }
                    var todas = base(t, segundos: 1500)
                    for d in drogas.reversed() { if let ser = series[d] { todas.medir(ser, 1, t.addingTimeInterval(-400)) } else { ac(&todas, t, prefixo + d, segundos: 400, ["mg": 1]) } }
                    ac(&todas, t, "crise.continua", segundos: 1)
                    r.append((todas, t))
                }
                /* As funções auxiliares também, em cada estado desta lista. */
                var n = 0
                for (e, _) in r.prefix(4000) { n += funcoesDoEstado(e) }
                for (e, _) in r.suffix(1500) { n += funcoesDoEstado(e) }
                print("funções auxiliares sobre estados: \(n) chamadas")
                return r
            }
            return cfg
        }
    }
}
