import Foundation

/* Varredura diferencial da síndrome coronariana aguda: grades fechadas dos cortes (CrCl, idade, faixas de peso da
   tenecteplase e alteplase, tempos de 12 h, 24 h e 120 min, reavaliação de 60-90 min, angiografia de 2-24 h, PDE5,
   GRACE, TIMI, troponina), caminhadas pelos passos guiados e comparação direta das contas puras. */

typealias ESCA = EstadoSessao

enum SCAV {
    nonisolated(unsafe) static var sabor = 0
    static func m(_ t: Date, _ minutos: Double) -> Date { t.addingTimeInterval(-minutos * 60) }
    static func passo(_ e: inout ESCA, _ chave: String, _ t: Date, _ minutos: Double) {
        e.acoes.append(AcaoRegistrada(tipo: "passo." + chave, rotulo: chave, hora: m(t, minutos)))
    }
    static func acao(_ e: inout ESCA, _ tipo: String, _ t: Date, _ minutos: Double, _ v: [String: Double] = [:], rotulo: String? = nil) {
        e.acoes.append(AcaoRegistrada(tipo: tipo, rotulo: rotulo ?? tipo, hora: m(t, minutos), valores: v))
    }
    /* Triagem limpa, T0 há 30 min, ECG há 25 min. */
    static func inicio(_ t: Date, sexo: String? = "m", supra: Bool? = nil, instavel: Bool? = false) -> ESCA {
        var e = ESCA(protocolo: "sca", inicio: m(t, 32))
        for q in MotorSCA().triagem { e.respostas[q.chave] = false }
        passo(&e, "t0", t, 30)
        passo(&e, "ecg", t, 25)
        if let sexo { e.escolhas["sexo"] = sexo }
        if let supra { e.respostas["supra"] = supra }
        if let instavel { for q in MotorSCA.perguntasInstabilidade { e.respostas[q.chave] = instavel && q.chave == "choque" } }
        return e
    }
    static func medir(_ e: inout ESCA, _ t: Date, peso: Double? = 80, idade: Double? = 60, crcl: Double? = 60, confirmar: Bool = true) {
        if let peso { e.medir("peso", peso, m(t, 5)) }
        if let idade { e.medir("idade", idade, m(t, 5)) }
        if let crcl {
            e.medir("crcl", crcl, m(t, 5))
            if confirmar { acao(&e, "crcl.confirmado", t, 4, ["crcl": crcl]) }
        }
    }
    static func fib(_ t: Date, agente: String? = "tnk", peso: Double? = 80, idade: Double? = 60, crcl: Double? = 60, confirmar: Bool = true) -> ESCA {
        var e = inicio(t, supra: true)
        passo(&e, "sintomas", t, 180)
        e.respostas["servicoICP"] = false
        e.medir("projecao", 150, m(t, 10))
        passo(&e, "ci", t, 8)
        if let agente { e.escolhas["agente"] = agente }
        medir(&e, t, peso: peso, idade: idade, crcl: crcl, confirmar: confirmar)
        return e
    }
    static func icp(_ t: Date, peso: Double? = 80, idade: Double? = 60, crcl: Double? = 60, confirmar: Bool = true) -> ESCA {
        var e = inicio(t, supra: true)
        passo(&e, "sintomas", t, 180)
        e.respostas["servicoICP"] = true
        e.medir("projecao", 60, m(t, 10))
        medir(&e, t, peso: peso, idade: idade, crcl: crcl, confirmar: confirmar)
        return e
    }
    static func sem(_ t: Date, peso: Double? = 80, idade: Double? = 60, crcl: Double? = 60, confirmar: Bool = true) -> ESCA {
        var e = inicio(t, supra: false)
        passo(&e, "sintomas", t, 180)
        e.medir("grace", 120, m(t, 10))
        e.respostas["tropSubindo"] = false; e.respostas["stDinamico"] = false; e.respostas["isquemiaCurso"] = false
        medir(&e, t, peso: peso, idade: idade, crcl: crcl, confirmar: confirmar)
        return e
    }
    static func vitais(_ e: inout ESCA, _ t: Date) {
        e.medir("pas", 130, m(t, 6)); e.medir("pad", 80, m(t, 6)); e.medir("fc", 80, m(t, 6)); e.medir("spo2", 96, m(t, 6))
    }

    // Codificação das contas puras para a comparação direta.
    static func dO(_ v: Double?) -> Any { v.map { $0 as Any } ?? NSNull() }
    static func bO(_ v: Bool?) -> Any { v.map { $0 as Any } ?? NSNull() }
    static func sO(_ v: String?) -> Any { v.map { $0 as Any } ?? NSNull() }
    static func plano(_ p: MotorSCA.Plano) -> [String: Any] {
        switch p {
        case .passo(let x): return ["k": "passo", "passo": Codec.passo(x)]
        case .icp(let m): return ["k": "icp", "m": m.rawValue]
        case .fibrinolise(let c): return ["k": "fibrinolise", "considerar": c]
        case .naoICP: return ["k": "naoICP"]
        case .falta(let x): return ["k": "falta", "x": x]
        case .semRegra(let x): return ["k": "semRegra", "x": x]
        }
    }
    static func faixa(_ f: MotorSCA.FaixaRisco) -> [String: Any] {
        switch f {
        case .instavel: return ["k": "instavel"]
        case .alto: return ["k": "alto"]
        case .intermediario: return ["k": "intermediario"]
        case .baixo: return ["k": "baixo"]
        case .escolher: return ["k": "escolher"]
        case .falta(let x): return ["k": "falta", "x": x]
        }
    }
    static func enoxICP(_ x: MotorSCA.EnoxICP) -> String {
        switch x { case .semPrevia: "semPrevia"; case .dose03: "dose03"; case .nada: "nada"; case .semRegra: "semRegra"; case .falta: "falta" }
    }
    static func tresDe(_ s: String) -> Tres { s == "sim" ? .sim : s == "nao" ? .nao : .falta }

    /* Funções de estado: comparadas em cada estado das grades extras. */
    nonisolated(unsafe) static var nEstado = 0
    static func funcoesDoEstado(_ e: ESCA, _ agora: Date) {
        nEstado += 1
        let je = Codec.estado(e), ja = Codec.ms(agora)
        for inst in [Tres.sim, .nao, .falta] {
            compararFuncao("sca", "planoSupra", [je, ja, Codec.tres(inst)], plano(MotorSCA.planoSupra(e, agora: agora, inst: inst)))
            compararFuncao("sca", "faixaAtual", [je, Codec.tres(inst)], faixa(MotorSCA.faixaAtual(e, inst: inst)))
        }
        compararFuncao("sca", "horaSintomas", [je, ja], MotorSCA.horaSintomas(e, agora: agora).map { Codec.ms($0) as Any } ?? NSNull())
        compararFuncao("sca", "instabilidade", [je], Codec.tres(MotorSCA.instabilidade(e)))
        compararFuncao("sca", "absolutasMarcadas", [je], MotorSCA.absolutasMarcadas(e).map(\.chave))
        compararFuncao("sca", "relativasMarcadas", [je], MotorSCA.relativasMarcadas(e).map(\.chave))
        compararFuncao("sca", "listaConferida", [je], MotorSCA.listaConferida(e))
        for mt in MotorSCA.MetodoCrCl.allCases {
            let r = MotorSCA.funcaoRenal(e, metodo: mt)
            compararFuncao("sca", "funcaoRenal", [je, mt.rawValue], ["valor": dO(r.valor), "conta": r.conta, "confirmado": r.confirmado])
        }
        for mv in 1...6 {
            let m = MotorSCA.MotivoICP(rawValue: Double(mv))!
            for inst in [Tres.sim, .nao] { compararFuncao("sca", "decisaoICPValida", [je, Double(mv), Codec.tres(inst)], MotorSCA.decisaoICPValida(e, m, inst: inst)) }
        }
    }

    static func funcoes() -> Int {
        var n = 0
        func f(_ nome: String, _ a: [Any], _ x: Any) { compararFuncao("sca", nome, a, x); n += 1 }
        var pesos = stride(from: 30.0, through: 250.0, by: 0.1).map { ($0 * 100).rounded() / 100 }
        pesos += [59.9, 59.99, 59.999, 60.001, 60.01, 69.9, 69.99, 69.999, 70.001, 70.01, 79.99, 79.999, 80.001, 89.99, 89.999, 90.001, 90.01, 66.66, 66.666, 66.67, 66.99, 66.999, 67.001, 67.01, 70 + 1e-9, 90 - 1e-9, 83.33, 83.34, 99.99, 100.01, 133.33, 133.34]
        for p in pesos {
            f("tenecteplaseMg", [p], MotorSCA.tenecteplaseMg(peso: p))
            f("faixaTNK", [p], MotorSCA.faixaTNK(peso: p))
            let a = MotorSCA.alteplaseMg(peso: p)
            f("alteplaseMg", [p], ["bolus": a.bolus, "trinta": a.trinta, "sessenta": a.sessenta])
            let h = MotorSCA.hnfUI(peso: p)
            f("hnfUI", [p], ["bolus": h.bolus, "infusao": h.infusao])
        }
        let idades: [Double?] = [nil, 17.9, 18, 39.9, 40, 59.9, 60, 74, 74.9, 74.99, 75, 75.01, 75.1, 76, 90, 110]
        let crcls: [Double] = [1, 10, 14.9, 14.99, 15, 15.01, 20, 29.9, 29.99, 30, 30.01, 30.1, 45, 60, 90, 150]
        for p in [30.0, 45, 59.99, 60, 60.01, 66.67, 70, 80, 99.99, 100, 100.01, 133.33, 133.34, 150, 250] {
            for i in idades {
                f("prasugrelManutencao", [p, dO(i)], dO(MotorSCA.prasugrelManutencao(peso: p, idade: i)))
                for c in crcls {
                    let x = MotorSCA.enoxComFibrinolise(peso: p, idade: i, crcl: c)
                    f("enoxComFibrinolise", [p, dO(i), c], x.map { ["bolusIV": dO($0.bolusIV), "scMg": $0.scMg, "mgKg": $0.mgKg, "intervaloH": $0.intervaloH, "teto": dO($0.teto), "bolusSemRegra": $0.bolusSemRegra] as Any } ?? NSNull())
                }
            }
        }
        for i in idades { f("prasugrelManutencao", [NSNull(), dO(i)], dO(MotorSCA.prasugrelManutencao(peso: nil, idade: i))) }
        var ids: [Double] = stride(from: 18.0, through: 110.0, by: 0.5).map { $0 }
        ids += [74.9, 74.99, 75.01, 75.1]
        for i in ids {
            let d = MotorSCA.clopidogrelComFibrinolise(idade: i)
            f("clopidogrelComFibrinolise", [i], ["ataque": dO(d.ataque), "inicial": d.inicial])
        }
        var cs: [Double] = stride(from: 1.0, through: 150.0, by: 0.25).map { $0 }
        cs += [14.99, 15.01, 29.99, 30.01]
        for c in cs {
            f("fondaparinuxBloqueado", [c], MotorSCA.fondaparinuxBloqueado(crcl: c))
            f("bivalirudinaInfusaoMgKgH", [c], MotorSCA.bivalirudinaInfusaoMgKgH(crcl: c))
            for mt in MotorSCA.MetodoCrCl.allCases { f("textoCrCl", [c, mt.rawValue], MotorSCA.textoCrCl(c, metodo: mt)) }
        }
        for c in [14.95, 14.949, 29.95, 29.949, 0.05, 0.049, 99.95, 149.99] { f("textoCrCl", [c, "ckdEpi2021"], MotorSCA.textoCrCl(c)) }
        for pr in [nil, true, false] as [Bool?] {
            for h in [nil, 0, 7.9, 7.99, 8, 8.01, 11.99, 12, 12.01, 24] as [Double?] {
                for u in [nil, true, false] as [Bool?] { f("enoxNaICP", [bO(pr), dO(h), bO(u)], enoxICP(MotorSCA.enoxNaICP(previa: pr, horas: h, umaDose: u))) }
            }
        }
        var hs: [Double] = stride(from: 0.0, through: 50.0, by: 0.01).map { ($0 * 100).rounded() / 100 }
        let hsB: [Double] = [12 - 1e-9, 12 + 1e-9, 24 - 1e-9, 24 + 1e-9, 11.9997, 24.0003]
        hs += hsB
        for h in hs {
            f("janela", [h], MotorSCA.janela(horas: h).rawValue)
        }
        for s in [nil, true, false] as [Bool?] {
            for i in [nil, true, false] as [Bool?] {
                for t in [nil, "anterior", "inferior", "outra"] as [String?] {
                    for r in [nil, 0, 49, 49.9, 49.99, 50, 50.01, 69.9, 69.99, 70, 70.01, 100] as [Double?] {
                        f("falhaReperfusao", [bO(s), bO(i), sO(t), dO(r)], Codec.tres(MotorSCA.falhaReperfusao(sintomasMelhoraram: s, instavel: i, territorio: t, resolucao: r)))
                    }
                }
            }
        }
        for inst in [Tres.sim, .nao, .falta] {
            for g in [nil, 0, 108, 108.9, 109, 109.1, 139.9, 140, 140.1, 141, 300] as [Double?] {
                for sub in [nil, true, false] as [Bool?] {
                    for st in [nil, true, false] as [Bool?] {
                        for isq in [nil, true, false] as [Bool?] {
                            for timi in [nil, 0, 1, 1.9, 2, 3] as [Double?] {
                                for tr in [nil, true, false] as [Bool?] {
                                    f("faixaRisco", [Codec.tres(inst), dO(g), bO(sub), bO(st), bO(isq), dO(timi), bO(tr)], faixa(MotorSCA.faixaRisco(instavel: inst, grace: g, subindo: sub, stDinamico: st, isquemia: isq, timi: timi, tropAbaixoP99: tr)))
                                }
                            }
                        }
                    }
                }
            }
        }
        for d in ["avanafil", "sildenafil", "vardenafil", "tadalafil", "outro"] {
            var hp: [Double] = stride(from: 0.0, through: 60.0, by: 0.5).map { $0 }
            hp += [11.99, 12.01, 23.99, 24.01, 47.99, 48.01]
            for h in hp {
                f("nitratoBloqueadoPorPDE5", [d, h], MotorSCA.nitratoBloqueadoPorPDE5(droga: d, horas: h))
            }
        }
        for v in [nil, 0, 1, 1.4, 1.49, 1.5, 1.51, 1.9, 1.99, 2, 2.01, 2.4, 2.49, 2.5, 2.51, 5] as [Double?] {
            for o in [nil, 0, 0.5, 0.9, 0.99, 1, 1.01, 3] as [Double?] {
                for s in [nil, "m", "f", "x"] as [String?] {
                    for i in [nil, 18, 39, 39.9, 39.99, 40, 40.01, 70] as [Double?] {
                        f("criterioSupra", [dO(v), dO(o), sO(s), dO(i)], Codec.tres(MotorSCA.criterioSupra(v2v3: v, outras: o, sexo: s, idade: i)))
                    }
                }
            }
        }
        for s in [nil, "m", "f", "x"] as [String?] { for i in [nil, 18, 39.9, 40, 70] as [Double?] { f("textoCorteSupra", [sO(s), dO(i)], MotorSCA.textoCorteSupra(sexo: s, idade: i)) } }
        for r in ["Confirmar tenecteplase: 45 mg", "Registrar estreptoquinase iniciada", "Confirmar Registrar x", "Registrar Confirmar y", "abc", "", "Confirmar ", "édem", "fibrinolise.dose"] { f("semVerbo", [r], MotorSCA.semVerbo(r)) }
        f("todasRegras", [], MotorSCA.todasRegras.map(Codec.regra))
        f("contra", [], ["absolutas": MotorSCA.contraAbsolutas.map { ["chave": $0.chave, "texto": $0.texto, "trava": $0.trava] as [String: Any] },
                         "relativas": MotorSCA.contraRelativas.map { ["chave": $0.chave, "texto": $0.texto, "trava": $0.trava] as [String: Any] },
                         "instabilidade": MotorSCA.perguntasInstabilidade.map(Codec.pergunta), "metodo": MotorSCA.metodoCrCl.rawValue])
        /* CKD-EPI e Cockcroft-Gault em grade de creatinina, idade, sexo e peso. */
        var crs = stride(from: 0.2, through: 3.0, by: 0.05).map { ($0 * 100).rounded() / 100 }
        crs += stride(from: 3.5, through: 15.0, by: 0.5).map { $0 } + [0.69, 0.7, 0.71, 0.89, 0.9, 0.91, 0, -1]
        var crsO: [Double?] = crs.map { $0 }
        crsO.append(nil)
        var idO: [Double?] = stride(from: 18.0, through: 110.0, by: 8.0).map { $0 }
        idO += [74.9, 75, nil]
        for c in crsO {
            for i in idO {
                for s in [nil, "m", "f"] as [String?] {
                    for p in [nil, 45.5, 80] as [Double?] {
                        for mt in MotorSCA.MetodoCrCl.allCases {
                            f("estimarCrCl", [mt.rawValue, dO(c), dO(i), sO(s), dO(p)], dO(MotorSCA.estimarCrCl(metodo: mt, creatinina: c, idade: i, sexo: s, peso: p)))
                        }
                    }
                }
            }
        }
        return n
    }

    static func extras(_ t: Date) -> [(ESCA, Date)] {
        var r: [(ESCA, Date)] = []
        var k = 0
        func add(_ e: ESCA, _ a: Date) {
            r.append((e, a))
            k += 1
            if k % 10 == 0 { funcoesDoEstado(e, a) }
        }
        let pesosB: [Double?] = [nil, 30, 45.5, 59.9, 59.99, 60, 60.01, 66.66, 66.67, 66.99, 67, 67.01, 69.99, 70, 70.01, 79.99, 80, 89.99, 90, 90.01, 99.99, 100, 100.01, 133.33, 133.34, 250]
        let idadesB: [Double?] = [nil, 17, 17.9, 18, 39.9, 40, 74, 74.9, 75, 75.1, 76, 90]
        let crclB: [Double?] = [nil, 14.9, 15, 29.9, 29.99, 30, 30.01, 60]
        /* 1. Fibrinolítico por peso x idade x agente. */
        for ag in ["tnk", "tpa", "rpa", "sk", "xx"] as [String?] + [nil] {
            for p in pesosB { for i in idadesB { add(fib(t, agente: ag, peso: p, idade: i), t) } }
        }
        /* 2. Anticoagulante com fibrinólise: peso x idade x CrCl x confirmação x escolha. */
        for p in [nil, 45.5, 66.67, 80, 99.99, 100, 100.01, 133.33] as [Double?] {
            for i in idadesB {
                for c in crclB {
                    for conf in [true, false] {
                        for op in [nil, 1, 2, 3, 4, 7] as [Double?] {
                            var e = fib(t, peso: p, idade: i, crcl: c, confirmar: conf)
                            if let op { acao(&e, "ac.escolha", t, 3, ["op": op]) }
                            if op == 3 { e.respostas["icpPrevista"] = (k % 3 == 0) ? nil : (k % 3 == 1) }
                            add(e, t)
                        }
                    }
                }
            }
        }
        /* 3. ICP: anticoagulante e P2Y12. */
        for p in [nil, 45.5, 59.99, 60, 80, 133.33] as [Double?] {
            for i in [nil, 60, 74.9, 75] as [Double?] {
                for c in crclB {
                    for op in [nil, 2, 4, 5, 3] as [Double?] {
                        for prev in [nil, true, false] as [Bool?] {
                            var e = icp(t, peso: p, idade: i, crcl: c)
                            if let op { acao(&e, "ac.escolha", t, 3, ["op": op]) }
                            e.respostas["anticoagPrevio"] = prev
                            e.respostas["enoxPrevia"] = prev
                            e.respostas["avcAit"] = prev
                            add(e, t)
                        }
                    }
                }
            }
        }
        for h in [nil, 0, 7.9, 8, 12, 12.1, 30] as [Double?] {
            for u in [nil, true, false] as [Bool?] {
                for p2 in [nil, 1.0, 2, 3, 9] as [Double?] {
                    var e = icp(t)
                    acao(&e, "ac.escolha", t, 3, ["op": 5])
                    e.respostas["enoxPrevia"] = true; e.respostas["enoxUmaDose"] = u
                    if let h { e.medir("enoxHoras", h, m(t, 2)) }
                    if let p2 { acao(&e, "p2y12.dada", t, 1, ["op": p2], rotulo: "Confirmar prasugrel 60 mg") }
                    add(e, t)
                    acao(&e, "icp.acionada", t, 2, ["motivo": 1]); add(e, t)
                    acao(&e, "ac.dose", t, 1); add(e, t)
                    acao(&e, "dispositivo", t, 0.5); add(e, t)
                }
            }
        }
        /* 4. Ramo do tempo: sintomas em volta de 12 h e 24 h, segundo a segundo nas bordas. */
        var mins: [Double] = stride(from: 0.0, through: 1600.0, by: 20.0).map { $0 }
        for b in [720.0, 1440.0, 2880.0] { mins += [b - 1, b - 1 / 60.0, b, b + 1 / 60.0, b + 1] }
        for s in mins {
            for proj in [nil, 89, 90, 91, 119, 120, 121, -1] as [Double?] {
                for serv in [nil, true, false] as [Bool?] {
                    var e = inicio(t, supra: true)
                    e.acoes.append(AcaoRegistrada(tipo: "passo.sintomas", rotulo: "s", hora: t.addingTimeInterval(-s * 60)))
                    e.respostas["servicoICP"] = serv
                    if proj == -1 { e.respostas["semDado.projecao"] = true } else if let proj { e.medir("projecao", proj, m(t, 10)) }
                    /* Os sintomas não podem passar do T0: o T0 vai para depois deles. */
                    e.acoes = e.acoes.map { var a = $0; if a.tipo == "passo.t0" || a.tipo == "passo.ecg" { a.hora = Swift.max(a.hora, t.addingTimeInterval(-s * 60)) }; return a }
                    add(e, t)
                    if serv == false && (proj ?? 0) > 120 { passo(&e, "ci", t, 0); e.escolhas["agente"] = "tnk"; medir(&e, t); add(e, t) }
                }
                for ac in [nil, true, false] as [Bool?] {
                    for ga in [nil, true, false] as [Bool?] {
                        var e = inicio(t, supra: true)
                        e.acoes.append(AcaoRegistrada(tipo: "passo.sintomas", rotulo: "s", hora: t.addingTimeInterval(-s * 60)))
                        e.acoes = e.acoes.map { var a = $0; if a.tipo == "passo.t0" || a.tipo == "passo.ecg" { a.hora = Swift.max(a.hora, t.addingTimeInterval(-s * 60)) }; return a }
                        e.respostas["icpAcessivel"] = ac; e.respostas["grandeArea"] = ga; e.respostas["s6c"] = ga; e.respostas["s6d"] = ac
                        if proj == 90 { e.respostas["choque"] = true }
                        add(e, t)
                    }
                }
            }
        }
        /* Sem hora: faixa manual e semDado. */
        for jm in [nil, "menos12", "de12a24", "mais24", "desconhecida", "outra"] as [String?] {
            for inst in [false, true] {
                for ac in [nil, true, false] as [Bool?] {
                    var e = inicio(t, supra: true, instavel: inst)
                    e.respostas["semDado.sintomas"] = true
                    e.escolhas["janelaManual"] = jm
                    e.respostas["icpAcessivel"] = ac; e.respostas["servicoICP"] = true; e.medir("projecao", 100, m(t, 3))
                    add(e, t)
                    passo(&e, "ci", t, 1); e.escolhas["decisaoFib"] = inst ? "fibrinolise" : "icp"; add(e, t)
                }
            }
        }
        /* ICP acionada e correções que reabrem. */
        for mv in [0.0, 1, 2, 3, 4, 5, 6, 7, 1.5] {
            for inst in [false, true] {
                var e = icp(t)
                if inst { e.respostas["choque"] = true; e.respostas["icpAcessivel"] = true }
                acao(&e, "icp.acionada", t, 5, ["motivo": mv])
                add(e, t)
                var c = e; c.respostas["servicoICP"] = nil; add(c, t)
                var d = e; d.medir("projecao", 130, m(t, 1)); add(d, t)
                var f = e; passo(&f, "ci", t, 2); f.respostas["ci.hic"] = true; add(f, t)
                var g = e; g.escolhas["decisaoFib"] = "icp"; add(g, t)
                var h = e; acao(&h, "dispositivo", t, 1); add(h, t.addingTimeInterval(3600))
                var i = e; i.medir("crcl", 14.9, m(t, 0.5)); add(i, t)
            }
        }
        /* 5. Contraindicações: cada item, rever a lista, PAS e PAD nas bordas. */
        let itens = MotorSCA.contraAbsolutas + MotorSCA.contraRelativas
        for it in itens + [ItemPasso(chave: "nenhum", texto: "")] {
            for pas in [nil, 180, 181] as [Double?] {
                for pad in [nil, 110, 111] as [Double?] {
                    for dec in [nil, "fibrinolise", "icp"] as [String?] {
                        var e = fib(t)
                        e.respostas[it.chave] = true
                        if let pas { e.medir("pas", pas, m(t, 2)) }
                        if let pad { e.medir("pad", pad, m(t, 2)) }
                        e.escolhas["decisaoFib"] = dec
                        add(e, t)
                        var rv = e; acao(&rv, "ci.rever", t, 1); add(rv, t)
                        var rv2 = rv; passo(&rv2, "ci", t, 0.5); add(rv2, t)
                    }
                }
            }
        }
        /* 6. Depois da fibrinólise: reavaliação 60-90 min, segundo bólus em 30 min, angiografia 2-24 h. */
        var dm: [Double] = stride(from: 0.0, through: 1500.0, by: 15.0).map { $0 }
        for b in [30.0, 60, 90, 120, 1440] { dm += [b - 1 / 60.0, b, b + 1 / 60.0] }
        for d in dm {
            for ag in ["tnk", "rpa"] {
                for v in 0..<6 {
                    var e = fib(t, agente: ag)
                    acao(&e, "fibrinolise.dose", t, d, ["mg": 40], rotulo: "Confirmar tenecteplase: 40 mg")
                    switch v {
                    case 1: acao(&e, "transferencia", t, d * 0.9); acao(&e, "reavaliacao.abrir", t, 0)
                    case 2: e.respostas["sintomasMelhoraram"] = false
                    case 3: e.respostas["sintomasMelhoraram"] = true; e.respostas["instabPos"] = false; e.escolhas["territorio"] = "anterior"; e.medir("resolucaoST", 60, m(t, 0))
                    case 4: acao(&e, "fibrinolise.segundo", t, 0); acao(&e, "angiografia", t, 0)
                    case 5: acao(&e, "reavaliacao.abrir", t, 0); e.respostas["sintomasMelhoraram"] = true; e.respostas["instabPos"] = false; e.escolhas["territorio"] = "outra"; e.respostas["semDado.resolucaoST"] = true
                    default: break
                    }
                    add(e, t)
                }
            }
        }
        for s in [nil, true, false] as [Bool?] {
            for i in [nil, true, false] as [Bool?] {
                for ter in [nil, "anterior", "inferior", "outra"] as [String?] {
                    for res in [nil, 49, 49.9, 50, 69.9, 70, -1] as [Double?] {
                        for ab in [false, true] {
                            var e = fib(t, agente: "rpa")
                            acao(&e, "fibrinolise.dose", t, 75, ["u": 10], rotulo: "Confirmar primeiro bólus de reteplase: 10 U")
                            if ab { acao(&e, "reavaliacao.abrir", t, 1) }
                            e.respostas["sintomasMelhoraram"] = s; e.respostas["instabPos"] = i; e.escolhas["territorio"] = ter
                            if res == -1 { e.respostas["semDado.resolucaoST"] = true } else if let res { e.medir("resolucaoST", res, m(t, 1)) }
                            add(e, t)
                            var g = e; acao(&g, "resgate.acionado", t, 0); add(g, t)
                        }
                    }
                }
            }
        }
        /* 7. Sem supra: GRACE, TIMI, troponina, cateterismo e anticoagulante. */
        for g in [nil, 108, 109, 140, 141, -1] as [Double?] {
            for timi in [nil, 1, 2] as [Double?] {
                for (tr, p99) in [(nil, nil), (13.0, 14.0), (14.0, 14.0), (15.0, 14.0)] as [(Double?, Double?)] {
                    for sub in [nil, true, false] as [Bool?] {
                        for isq in [nil, true, false] as [Bool?] {
                            for fm in [nil, "baixo", "intermediario"] as [String?] {
                                var e = sem(t)
                                e.series["grace"] = nil
                                if g == -1 { e.respostas["semDado.grace"] = true } else if let g { e.medir("grace", g, m(t, 3)) }
                                if let timi { e.medir("timi", timi, m(t, 3)) }
                                if let tr { e.medir("troponina", tr, m(t, 20)) }
                                if let p99 { e.medir("p99", p99, m(t, 20)) }
                                e.respostas["tropSubindo"] = sub; e.respostas["isquemiaCurso"] = isq
                                e.escolhas["faixaMedico"] = fm
                                add(e, t)
                            }
                        }
                    }
                }
            }
        }
        for cate in [nil, 0, 1, 2, 3, 4] as [Double?] {
            for op in [nil, 6, 7, 8, 2] as [Double?] {
                for c in crclB {
                    for conf in [true, false] {
                        var e = sem(t, crcl: c, confirmar: conf)
                        if let cate { acao(&e, "cate.escolha", t, 4, ["op": cate]) }
                        if let op { acao(&e, "ac.escolha", t, 3, ["op": op]) }
                        add(e, t)
                        if cate == 1 { var a = e; acao(&a, "anatomia.icp", t, 1); add(a, t) }
                        var d = e; acao(&d, "ac.dose", t, 1); acao(&d, "p2y12.dada", t, 1, ["op": 2]); add(d, t)
                    }
                }
            }
        }
        /* Troponina: coletas e janelas de 1-2 h, 3-6 h e 3 h depois da segunda. */
        var tm: [Double] = stride(from: 0.0, through: 400.0, by: 10.0).map { $0 }
        for b in [60.0, 120, 180, 360] { tm += [b - 1 / 60.0, b, b + 1 / 60.0] }
        for x in tm {
            for hs in [nil, true, false] as [Bool?] {
                for n in 1...3 {
                    for dec in [nil, true, false] as [Bool?] {
                        var e = sem(t)
                        e.respostas["ensaioHs"] = hs; e.respostas["tropDecidido"] = dec
                        for j in 0..<n { e.medir("troponina", Double(10 + 5 * j), t.addingTimeInterval(-x * 60 + Double(j) * 60)) }
                        e.medir("p99", 14, m(t, 1))
                        add(e, t)
                    }
                }
            }
        }
        /* Sintomas e isolada de 3 h. */
        for s in [150.0, 179, 180, 181, 240] {
            var e = sem(t)
            e.acoes.removeAll { $0.tipo == "passo.sintomas" }
            e.acoes.append(AcaoRegistrada(tipo: "passo.sintomas", rotulo: "s", hora: t.addingTimeInterval(-s * 60)))
            e.acoes = e.acoes.map { var a = $0; if a.tipo == "passo.t0" || a.tipo == "passo.ecg" { a.hora = Swift.max(a.hora, t.addingTimeInterval(-s * 60)) }; return a }
            e.respostas["ensaioHs"] = true
            e.medir("troponina", 20, t.addingTimeInterval(-60 * 60))
            add(e, t)
        }
        /* Invasiva: prazos de 2, 24 e 72 h, minuto a minuto nas bordas. */
        for h in [2.0, 24, 72] {
            for d in [-1.0, -1 / 60.0, 0, 1 / 60.0, 1] {
                for fx in 0..<3 {
                    var e = sem(t)
                    if fx == 0 { e.respostas["choque"] = true }
                    if fx == 1 { e.medir("grace", 150, m(t, 1)) }
                    for cv in [nil, true] as [Bool?] {
                        e.respostas["contraInvasiva"] = cv
                        add(e, t.addingTimeInterval(h * 3600 - 30 * 60 + d * 60))
                    }
                    acao(&e, "invasiva.feita", t, 1); add(e, t)
                }
            }
        }
        for pq in [nil, 49, 49.9, 50, 51] as [Double?] { var e = sem(t); if let pq { e.medir("plaquetas", pq, m(t, 1)) }; add(e, t) }
        /* 8. Comuns: SpO₂, nitrato e PDE5, betabloqueador, Killip, Hb. */
        for supra in [true, false] {
            for spo in [nil, 89, 89.9, 90, 91] as [Double?] {
                for ox in [false, true] {
                    var e = supra ? icp(t) : sem(t)
                    if let spo { e.medir("spo2", spo, m(t, 1)) }
                    if ox { acao(&e, "oxigenio.inicio", t, 1) }
                    add(e, t)
                }
            }
            for basal in [nil, 120.0, 130] as [Double?] {
                for pas in [nil, 89, 90, 91, 99, 100, 101] as [Double?] {
                    for pde in [nil, true, false] as [Bool?] {
                        for vd in [nil, true, false] as [Bool?] {
                            var e = supra ? icp(t) : sem(t)
                            if let basal { e.medir("pas", basal, m(t, 20)) }
                            if let pas { e.medir("pas", pas, m(t, 1)) }
                            e.respostas["pde5"] = pde; e.respostas["suspeitaVD"] = vd
                            add(e, t)
                            if pde == true {
                                for d in [0.0, 1, 2, 3, 4, -1, 2.7] {
                                    for h in [nil, 11, 12, 13, 23, 24, 25, 47, 48, 49] as [Double?] {
                                        var x = e
                                        acao(&x, "pde5.droga", t, 1, ["op": d])
                                        if let h { x.medir("pde5Horas", h, m(t, 1)) }
                                        add(x, t)
                                    }
                                }
                            }
                            if vd == false { var n = e; acao(&n, "nitrato.dado", t, 0); add(n, t) }
                        }
                    }
                }
            }
            for kil in [nil, 1, 1.9, 2, 4] as [Double?] {
                for bb in [nil, true, false] as [Bool?] {
                    for hb in [nil, 9.9, 9.99, 10, 10.1] as [Double?] {
                        var e = supra ? icp(t) : sem(t)
                        if let kil { e.medir("killip", kil, m(t, 1)) }
                        e.respostas["bbContra"] = bb
                        if let hb { e.medir("hb", hb, m(t, 1)) }
                        add(e, t)
                        var b = e; acao(&b, "betabloqueador", t, 0); add(b, t)
                    }
                }
            }
        }
        /* 9. Função renal: creatinina x idade x sexo, CrCl digitado antes, depois e na mesma hora, confirmação a ±0,05. */
        for cr in [nil, 0.5, 0.7, 0.9, 1.0, 1.2, 2.5, 4.0] as [Double?] {
            for i in [nil, 18, 40, 74.9, 75, 90] as [Double?] {
                for sx in ["m", "f"] {
                    for dig in [nil, -1.0, 0, 1] as [Double?] {
                        for dc in [nil, -0.06, -0.05, -0.049, 0, 0.049, 0.05] as [Double?] {
                            var e = inicio(t, sexo: sx, supra: (k % 2 == 0))
                            passo(&e, "sintomas", t, 180)
                            if let cr { e.medir("creatinina", cr, m(t, 10)) }
                            if let i { e.medir("idade", i, m(t, 10)) }
                            e.medir("peso", 80, m(t, 10))
                            if let dig { e.medir("crcl", 40, m(t, 10 + dig)) }
                            if let dc {
                                let v = MotorSCA.funcaoRenal(e).valor ?? 40
                                acao(&e, "crcl.confirmado", t, 2, ["crcl": v + dc])
                            }
                            add(e, t)
                        }
                    }
                }
            }
        }
        /* 10. Critério de supra digitado, ECG tardio, idade abaixo de 18, CrCl abaixo de 15. */
        for sx in ["m", "f"] {
            for i in [nil, 39.9, 40] as [Double?] {
                for v in [nil, 1.4, 1.5, 1.9, 2, 2.4, 2.5] as [Double?] {
                    for o in [nil, 0.9, 1] as [Double?] {
                        for sp in [nil, true, false] as [Bool?] {
                            var e = inicio(t, sexo: sx, supra: sp)
                            if let i { e.medir("idade", i, m(t, 3)) }
                            if let v { e.medir("supraV2V3", v, m(t, 3)) }
                            if let o { e.medir("supraOutras", o, m(t, 3)) }
                            add(e, t)
                        }
                    }
                }
            }
        }
        for d in [-60.0, -1, 0, 1, 60, 601, 599, 600] {
            var e = inicio(t, supra: false)
            e.acoes.removeAll { $0.tipo == "passo.ecg" }
            e.acoes.append(AcaoRegistrada(tipo: "passo.ecg", rotulo: "ecg", hora: m(t, 30).addingTimeInterval(d)))
            add(e, t)
            add(e, m(t, 30).addingTimeInterval(d - 1))
        }
        for i in [17.0, 17.9, 17.99, 18, 18.01] { var e = icp(t, idade: i); add(e, t); e.medir("crcl", 14.9, m(t, 1)); add(e, t) }
        /* Passos do início com as respostas aos pedaços. */
        for sx in [nil, "m", "f"] as [String?] {
            for sp in [nil, true, false] as [Bool?] {
                for q in 0...4 {
                    var e = inicio(t, sexo: sx, supra: sp, instavel: nil)
                    for (j, p) in MotorSCA.perguntasInstabilidade.enumerated() where j < q { e.respostas[p.chave] = j == 3 }
                    add(e, t)
                    var f = e; f.acoes.removeAll { $0.tipo == "passo.t0" }; add(f, t)
                    var g = e; g.acoes.removeAll { $0.tipo == "passo.ecg" }; add(g, t)
                    var h = e; h.respostas["menor18"] = nil; add(h, t)
                    var x = e; x.respostas["aco"] = true; add(x, t)
                }
            }
        }
        return r
    }
}

@main
struct VarreduraSCA {
    static func main() {
        principalVarredura { fonte in
            var cfg = ConfigVarredura(motor: MotorSCA(), fonte: fonte, base: { t in
                /* Partidas variadas: começo da sessão, ponto de reperfusão, fibrinólise, ICP e sem supra. */
                SCAV.sabor += 1
                switch SCAV.sabor % 6 {
                case 0: var e = SCAV.inicio(t, sexo: nil, supra: nil, instavel: nil); SCAV.vitais(&e, t); return e
                case 1: var e = SCAV.fib(t); SCAV.vitais(&e, t); return e
                case 2: var e = SCAV.icp(t); SCAV.vitais(&e, t); return e
                case 3: var e = SCAV.sem(t); SCAV.vitais(&e, t); return e
                case 4: var e = SCAV.inicio(t, supra: true); SCAV.vitais(&e, t); SCAV.medir(&e, t); return e
                default: var e = ESCA(protocolo: "sca", inicio: SCAV.m(t, 5)); for q in MotorSCA().triagem { e.respostas[q.chave] = false }; return e
                }
            })
            cfg.bordas = [
                "idade": [17, 17.9, 18, 39, 39.9, 40, 74, 74.9, 75, 75.1, 76],
                "peso": [59.9, 59.99, 60, 60.01, 66.66, 66.67, 66.99, 67, 67.01, 69.99, 70, 70.01, 79.99, 80, 89.99, 90, 90.01, 99.99, 100, 100.01, 133.33],
                "creatinina": [0.69, 0.7, 0.71, 0.89, 0.9, 0.91, 1.0, 2.0, 4.0],
                "crcl": [14.9, 14.99, 15, 15.01, 29.9, 29.99, 30, 30.01],
                "pas": [89, 90, 91, 180, 181],
                "pad": [110, 111],
                "spo2": [89, 90, 91],
                "killip": [1, 2],
                "projecao": [89, 90, 91, 119, 120, 121],
                "supraV2V3": [1.4, 1.5, 1.9, 2, 2.4, 2.5],
                "supraOutras": [0.9, 1],
                "resolucaoST": [49, 49.9, 50, 69.9, 70],
                "troponina": [5, 14, 15, 50],
                "p99": [14],
                "grace": [108, 109, 140, 141],
                "timi": [1, 2],
                "hb": [9.9, 10],
                "plaquetas": [49, 50],
                "pde5Horas": [11, 12, 13, 23, 24, 25, 47, 48, 49],
                "enoxHoras": [7.9, 8, 12, 12.1],
            ]
            cfg.tempos = [5, 10, 30, 60, 90, 120, 180, 360, 720, 1440, 2880, 72 * 60]
            cfg.escolhasExtras = ["sexo": ["m", "f"], "agente": ["tnk", "tpa", "rpa", "sk"], "territorio": ["anterior", "inferior", "outra"],
                                  "janelaManual": ["menos12", "de12a24", "mais24", "desconhecida"], "decisaoFib": ["fibrinolise", "icp"], "faixaMedico": ["baixo", "intermediario"]]
            cfg.respostasExtras = MotorSCA.perguntasInstabilidade.map(\.chave) + ["supra", "servicoICP", "icpAcessivel", "grandeArea", "s6c", "s6d", "sintomasMelhoraram", "instabPos",
                                   "avcAit", "anticoagPrevio", "enoxPrevia", "enoxUmaDose", "icpPrevista", "pde5", "suspeitaVD", "bbContra", "contraInvasiva", "ensaioHs", "tropDecidido",
                                   "tropSubindo", "stDinamico", "isquemiaCurso", "semDado.sintomas", "semDado.projecao", "semDado.grace", "semDado.resolucaoST"]
                + (MotorSCA.contraAbsolutas + MotorSCA.contraRelativas).map(\.chave)
            cfg.chavesValores = ["motivo": [1, 2, 3, 4, 5, 6, 0, 7], "op": [0, 1, 2, 3, 4, 5, 6, 7, 8, -1], "crcl": [14.9, 30, 60], "mg": [40, 45], "u": [10]]
            cfg.extras = { t in SCAV.extras(t) }
            cfg.funcoes = { SCAV.funcoes() }
            cfg.caminhadas = 600
            cfg.passosPorCaminhada = 50
            cfg.aleatorios = 4000
            return cfg
        }
        FileHandle.standardError.write("SCA: funções de estado comparadas em \(SCAV.nEstado) estados das grades\n".data(using: .utf8)!)
    }
}
