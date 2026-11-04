import Foundation

/* Funções estáticas de MotorSCA que o teste do app chama direto (contas de dose, CrCl, janela, faixa de risco, plano).
   Sem isto, com PONTE=js esses pontos do teste conferem o Swift e não o JS. Aqui, com PONTE=js, cada chamada
   também passa pelo JS (funcoesTeste de sca.js) e reprova (saída 4) se o JS discordar; o valor devolvido é o do Swift,
   então igual nos dois. A troca no teste copiado está em troca_sca.txt ("MotorSCA.<nome>(" por "JSSCA.<nome>("). */
enum JSSCA {
    static var js: Bool { NodeJS.shared.modo == "js" }
    static func dO(_ v: Double?) -> Any { v.map { $0 as Any } ?? NSNull() }
    static func bO(_ v: Bool?) -> Any { v.map { $0 as Any } ?? NSNull() }
    static func sO(_ v: String?) -> Any { v.map { $0 as Any } ?? NSNull() }
    static func f(_ nome: String, _ a: [Any], _ x: @autoclosure () -> Any) { if js { compararFuncao("sca", nome, a, x()) } }

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
    static func faixa(_ v: MotorSCA.FaixaRisco) -> [String: Any] {
        switch v {
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

    static func tenecteplaseMg(peso p: Double) -> Double {
        let v = MotorSCA.tenecteplaseMg(peso: p); f("tenecteplaseMg", [p], v); return v
    }
    static func alteplaseMg(peso p: Double) -> (bolus: Double, trinta: Double, sessenta: Double) {
        let v = MotorSCA.alteplaseMg(peso: p); f("alteplaseMg", [p], ["bolus": v.bolus, "trinta": v.trinta, "sessenta": v.sessenta]); return v
    }
    static func hnfUI(peso p: Double) -> (bolus: Double, infusao: Double) {
        let v = MotorSCA.hnfUI(peso: p); f("hnfUI", [p], ["bolus": v.bolus, "infusao": v.infusao]); return v
    }
    static func clopidogrelComFibrinolise(idade i: Double) -> (ataque: Double?, inicial: Double) {
        let v = MotorSCA.clopidogrelComFibrinolise(idade: i); f("clopidogrelComFibrinolise", [i], ["ataque": dO(v.ataque), "inicial": v.inicial]); return v
    }
    static func prasugrelManutencao(peso: Double?, idade: Double?) -> Double? {
        let v = MotorSCA.prasugrelManutencao(peso: peso, idade: idade); f("prasugrelManutencao", [dO(peso), dO(idade)], dO(v)); return v
    }
    static func enoxComFibrinolise(peso p: Double, idade i: Double?, crcl: Double) -> MotorSCA.EsquemaEnox? {
        let v = MotorSCA.enoxComFibrinolise(peso: p, idade: i, crcl: crcl)
        f("enoxComFibrinolise", [p, dO(i), crcl], v.map { ["bolusIV": dO($0.bolusIV), "scMg": $0.scMg, "mgKg": $0.mgKg, "intervaloH": $0.intervaloH, "teto": dO($0.teto), "bolusSemRegra": $0.bolusSemRegra] as Any } ?? NSNull())
        return v
    }
    static func fondaparinuxBloqueado(crcl: Double) -> Bool {
        let v = MotorSCA.fondaparinuxBloqueado(crcl: crcl); f("fondaparinuxBloqueado", [crcl], v); return v
    }
    static func bivalirudinaInfusaoMgKgH(crcl: Double) -> Double {
        let v = MotorSCA.bivalirudinaInfusaoMgKgH(crcl: crcl); f("bivalirudinaInfusaoMgKgH", [crcl], v); return v
    }
    static func enoxNaICP(previa: Bool?, horas: Double?, umaDose: Bool?) -> MotorSCA.EnoxICP {
        let v = MotorSCA.enoxNaICP(previa: previa, horas: horas, umaDose: umaDose); f("enoxNaICP", [bO(previa), dO(horas), bO(umaDose)], enoxICP(v)); return v
    }
    static func janela(horas h: Double) -> MotorSCA.Janela {
        let v = MotorSCA.janela(horas: h); f("janela", [h], v.rawValue); return v
    }
    static func falhaReperfusao(sintomasMelhoraram s: Bool?, instavel i: Bool?, territorio t: String?, resolucao r: Double?) -> Tres {
        let v = MotorSCA.falhaReperfusao(sintomasMelhoraram: s, instavel: i, territorio: t, resolucao: r)
        f("falhaReperfusao", [bO(s), bO(i), sO(t), dO(r)], Codec.tres(v)); return v
    }
    static func faixaRisco(instavel: Tres, grace: Double?, subindo: Bool?, stDinamico: Bool?, isquemia: Bool?, timi: Double?, tropAbaixoP99: Bool?) -> MotorSCA.FaixaRisco {
        let v = MotorSCA.faixaRisco(instavel: instavel, grace: grace, subindo: subindo, stDinamico: stDinamico, isquemia: isquemia, timi: timi, tropAbaixoP99: tropAbaixoP99)
        f("faixaRisco", [Codec.tres(instavel), dO(grace), bO(subindo), bO(stDinamico), bO(isquemia), dO(timi), bO(tropAbaixoP99)], faixa(v)); return v
    }
    static func criterioSupra(v2v3: Double?, outras: Double?, sexo: String?, idade: Double?) -> Tres {
        let v = MotorSCA.criterioSupra(v2v3: v2v3, outras: outras, sexo: sexo, idade: idade)
        f("criterioSupra", [dO(v2v3), dO(outras), sO(sexo), dO(idade)], Codec.tres(v)); return v
    }
    static func estimarCrCl(metodo: MotorSCA.MetodoCrCl, creatinina: Double?, idade: Double?, sexo: String?, peso: Double?) -> Double? {
        let v = MotorSCA.estimarCrCl(metodo: metodo, creatinina: creatinina, idade: idade, sexo: sexo, peso: peso)
        f("estimarCrCl", [metodo.rawValue, dO(creatinina), dO(idade), sO(sexo), dO(peso)], dO(v)); return v
    }
    static func funcaoRenal(_ e: EstadoSessao, metodo: MotorSCA.MetodoCrCl = MotorSCA.metodoCrCl) -> MotorSCA.Renal {
        let v = MotorSCA.funcaoRenal(e, metodo: metodo)
        f("funcaoRenal", [Codec.estado(e), metodo.rawValue], ["valor": dO(v.valor), "conta": v.conta, "confirmado": v.confirmado]); return v
    }
    static func textoCrCl(_ x: Double, metodo: MotorSCA.MetodoCrCl = MotorSCA.metodoCrCl) -> String {
        let v = MotorSCA.textoCrCl(x, metodo: metodo); f("textoCrCl", [x, metodo.rawValue], v); return v
    }
    static func horaSintomas(_ e: EstadoSessao, agora: Date) -> Date? {
        let v = MotorSCA.horaSintomas(e, agora: agora)
        f("horaSintomas", [Codec.estado(e), Codec.ms(agora)], v.map { Codec.ms($0) as Any } ?? NSNull()); return v
    }
    static func instabilidade(_ e: EstadoSessao) -> Tres {
        let v = MotorSCA.instabilidade(e); f("instabilidade", [Codec.estado(e)], Codec.tres(v)); return v
    }
    static func planoSupra(_ e: EstadoSessao, agora: Date, inst: Tres) -> MotorSCA.Plano {
        let v = MotorSCA.planoSupra(e, agora: agora, inst: inst)
        f("planoSupra", [Codec.estado(e), Codec.ms(agora), Codec.tres(inst)], plano(v)); return v
    }
}
