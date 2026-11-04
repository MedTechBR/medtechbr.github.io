import Foundation

/* Membros estáticos de MotorEpileptico que o teste do app lê direto pelo apelido M (regras, doses, fase, status).
   O troca_epileptico.txt aponta "typealias M" para cá. Cada membro devolve o valor do Swift; com PONTE=js também
   pergunta ao JS (compararFuncao) e reprova (saída 4) se o JS discordar. Assim um erro plantado no JS, como uma
   regra apontando para a linha errada, reprova nos testes do app. */
enum JSEpileptico {
    typealias ME = MotorEpileptico
    static var js: Bool { NodeJS.shared.modo == "js" }
    static func opt(_ v: Double?) -> Any { v.map { $0 as Any } ?? NSNull() }
    static func faixa(_ f: (min: Double, max: Double)) -> Any { ["min": f.min, "max": f.max] }

    static func r(_ nome: String, _ v: RegraFonte) -> RegraFonte {
        if js { compararFuncao("epileptico", "regra", [nome], Codec.regra(v)) }
        return v
    }
    static var r01: RegraFonte { r("r01", ME.r01) }
    static var r02: RegraFonte { r("r02", ME.r02) }
    static var r03: RegraFonte { r("r03", ME.r03) }
    static var r06: RegraFonte { r("r06", ME.r06) }
    static var r07: RegraFonte { r("r07", ME.r07) }
    static var r08: RegraFonte { r("r08", ME.r08) }
    static var r09: RegraFonte { r("r09", ME.r09) }
    static var r10: RegraFonte { r("r10", ME.r10) }
    static var r11: RegraFonte { r("r11", ME.r11) }
    static var r12: RegraFonte { r("r12", ME.r12) }
    static var r13: RegraFonte { r("r13", ME.r13) }
    static var r14: RegraFonte { r("r14", ME.r14) }
    static var r15: RegraFonte { r("r15", ME.r15) }
    static var r16: RegraFonte { r("r16", ME.r16) }
    static var r17: RegraFonte { r("r17", ME.r17) }
    static var r18: RegraFonte { r("r18", ME.r18) }
    static var r19: RegraFonte { r("r19", ME.r19) }
    static var r20: RegraFonte { r("r20", ME.r20) }
    static var r21: RegraFonte { r("r21", ME.r21) }
    static var r22: RegraFonte { r("r22", ME.r22) }
    static var r23: RegraFonte { r("r23", ME.r23) }
    static var r24: RegraFonte { r("r24", ME.r24) }
    static var r25: RegraFonte { r("r25", ME.r25) }
    static var r26: RegraFonte { r("r26", ME.r26) }
    static var rFenitoina: RegraFonte { r("rFenitoina", ME.rFenitoina) }
    static var rPendente: RegraFonte { r("rPendente", ME.rPendente) }
    static var rAbaixoPlena: RegraFonte { r("rAbaixoPlena", ME.rAbaixoPlena) }
    static var rMid13: RegraFonte { r("rMid13", ME.rMid13) }
    static var rRepetir: RegraFonte { r("rRepetir", ME.rRepetir) }
    static var rFase3Sem: RegraFonte { r("rFase3Sem", ME.rFase3Sem) }
    static var rDisp: RegraFonte { r("rDisp", ME.rDisp) }
    static var rEscopo: RegraFonte { r("rEscopo", ME.rEscopo) }
    static var rSemInicio: RegraFonte { r("rSemInicio", ME.rSemInicio) }

    static func dose(_ nome: String, _ p: Double, _ x: Any) { if js { compararFuncao("epileptico", "dose", [nome, p], x) } }
    static func midazolamIM(_ p: Double) -> Double? { let v = ME.midazolamIM(p); dose("midazolamIM", p, opt(v)); return v }
    static func lorazepam(_ p: Double) -> Double { let v = ME.lorazepam(p); dose("lorazepam", p, v); return v }
    static func diazepamIV(_ p: Double) -> (min: Double, max: Double) { let v = ME.diazepamIV(p); dose("diazepamIV", p, faixa(v)); return v }
    static func diazepamRetal(_ p: Double) -> (min: Double, max: Double) { let v = ME.diazepamRetal(p); dose("diazepamRetal", p, faixa(v)); return v }
    static func fenobarbital(_ p: Double) -> Double { let v = ME.fenobarbital(p); dose("fenobarbital", p, v); return v }
    static func fosfenitoina(_ p: Double) -> Double { let v = ME.fosfenitoina(p); dose("fosfenitoina", p, v); return v }
    static func valproato(_ p: Double) -> Double { let v = ME.valproato(p); dose("valproato", p, v); return v }
    static func levetiracetam(_ p: Double) -> Double { let v = ME.levetiracetam(p); dose("levetiracetam", p, v); return v }

    static func fase(segundos s: TimeInterval) -> Int {
        let v = ME.fase(segundos: s)
        if js { compararFuncao("epileptico", "fase", [s], v) }
        return v
    }
    static var nomesFase: [String] {
        if js { compararFuncao("epileptico", "nomesFase", [], ME.nomesFase) }
        return ME.nomesFase
    }
    static var fenitoinaCondutaLocal: (mgKg: Double, tetoMg: Double)? {
        let v = ME.fenitoinaCondutaLocal
        if js { compararFuncao("epileptico", "fenitoinaCondutaLocal", [], v.map { ["mgKg": $0.mgKg, "tetoMg": $0.tetoMg] as Any } ?? NSNull()) }
        return v
    }
    static func status(_ e: EstadoSessao) -> ME.StatusCrise {
        let v = ME.status(e)
        if js { compararFuncao("epileptico", "status", [Codec.estado(e)], { switch v { case .continua: "continua"; case .cessou: "cessou"; case .naoInformado: "naoInformado" } }()) }
        return v
    }
    static func dosesIniciais(_ e: EstadoSessao) -> [ME.DoseDada] {
        let v = ME.dosesIniciais(e)
        if js { compararFuncao("epileptico", "dosesIniciais", [Codec.estado(e)], v.map { ["droga": $0.droga, "hora": Codec.ms($0.hora), "mg": opt($0.mg)] as [String: Any] }) }
        return v
    }
    static func dosesSegunda(_ e: EstadoSessao) -> [ME.DoseDada] {
        let v = ME.dosesSegunda(e)
        if js { compararFuncao("epileptico", "dosesSegunda", [Codec.estado(e)], v.map { ["droga": $0.droga, "hora": Codec.ms($0.hora), "mg": opt($0.mg)] as [String: Any] }) }
        return v
    }
}
