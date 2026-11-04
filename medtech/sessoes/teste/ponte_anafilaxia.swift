import Foundation

/* Funções e regras estáticas de MotorAnafilaxia que o teste do app chama direto (doseAdrenalina, hipotensaoCalculada,
   criterio1, criterio2, horasDoses e as regras r01...rSemJanela por "let m = MotorAnafilaxia.self").
   Devolvem o valor do Swift; com PONTE=js cada chamada também vai ao JS e reprova (saída 4) se o JS discordar.
   Ligado pelo troca_anafilaxia.txt na cópia do teste. */
enum JSAnafilaxia {
    static var js: Bool { NodeJS.shared.modo == "js" }
    static func nn(_ v: Double?) -> Any { v.map { $0 as Any } ?? NSNull() }
    static func tres(_ t: Tres) -> String { switch t { case .sim: "sim"; case .nao: "nao"; case .falta: "falta" } }
    static func doseAdrenalina(peso: Double?, idade: Double?) -> (mg: Double, porPeso: Bool)? {
        let d = MotorAnafilaxia.doseAdrenalina(peso: peso, idade: idade)
        if js { compararFuncao("anafilaxia", "doseAdrenalina", [nn(peso), nn(idade)], d.map { ["mg": $0.mg, "porPeso": $0.porPeso] as Any } ?? NSNull()) }
        return d
    }
    static func hipotensaoCalculada(pas: Double?, idade: Double?, basal: Double?) -> Tres {
        let v = MotorAnafilaxia.hipotensaoCalculada(pas: pas, idade: idade, basal: basal)
        if js { compararFuncao("anafilaxia", "hipotensaoCalculada", [nn(pas), nn(idade), nn(basal)], tres(v)) }
        return v
    }
    static func criterio1(_ e: EstadoSessao) -> Tres {
        let v = MotorAnafilaxia.criterio1(e)
        if js { compararFuncao("anafilaxia", "criterio1", [Codec.estado(e)], tres(v)) }
        return v
    }
    static func criterio2(_ e: EstadoSessao) -> Tres {
        let v = MotorAnafilaxia.criterio2(e)
        if js { compararFuncao("anafilaxia", "criterio2", [Codec.estado(e)], tres(v)) }
        return v
    }
    static func horasDoses(_ e: EstadoSessao) -> [Date] {
        let v = MotorAnafilaxia.horasDoses(e)
        if js { compararFuncao("anafilaxia", "horasDoses", [Codec.estado(e)], v.map { Codec.ms($0) }) }
        return v
    }
    static func regra(_ nome: String, _ r: RegraFonte) -> RegraFonte {
        if js { compararFuncao("anafilaxia", "regra", [nome], Codec.regra(r)) }
        return r
    }
    static var r01: RegraFonte { regra("r01", MotorAnafilaxia.r01) }
    static var r02: RegraFonte { regra("r02", MotorAnafilaxia.r02) }
    static var r03: RegraFonte { regra("r03", MotorAnafilaxia.r03) }
    static var r04: RegraFonte { regra("r04", MotorAnafilaxia.r04) }
    static var r05: RegraFonte { regra("r05", MotorAnafilaxia.r05) }
    static var r06: RegraFonte { regra("r06", MotorAnafilaxia.r06) }
    static var r07: RegraFonte { regra("r07", MotorAnafilaxia.r07) }
    static var r08: RegraFonte { regra("r08", MotorAnafilaxia.r08) }
    static var r09: RegraFonte { regra("r09", MotorAnafilaxia.r09) }
    static var r10: RegraFonte { regra("r10", MotorAnafilaxia.r10) }
    static var r11: RegraFonte { regra("r11", MotorAnafilaxia.r11) }
    static var r12: RegraFonte { regra("r12", MotorAnafilaxia.r12) }
    static var r13: RegraFonte { regra("r13", MotorAnafilaxia.r13) }
    static var r14: RegraFonte { regra("r14", MotorAnafilaxia.r14) }
    static var r15: RegraFonte { regra("r15", MotorAnafilaxia.r15) }
    static var r16: RegraFonte { regra("r16", MotorAnafilaxia.r16) }
    static var r17: RegraFonte { regra("r17", MotorAnafilaxia.r17) }
    static var r18: RegraFonte { regra("r18", MotorAnafilaxia.r18) }
    static var r19: RegraFonte { regra("r19", MotorAnafilaxia.r19) }
    static var r20: RegraFonte { regra("r20", MotorAnafilaxia.r20) }
    static var r21: RegraFonte { regra("r21", MotorAnafilaxia.r21) }
    static var r22: RegraFonte { regra("r22", MotorAnafilaxia.r22) }
    static var r23: RegraFonte { regra("r23", MotorAnafilaxia.r23) }
    static var r24: RegraFonte { regra("r24", MotorAnafilaxia.r24) }
    static var r25: RegraFonte { regra("r25", MotorAnafilaxia.r25) }
    static var r26: RegraFonte { regra("r26", MotorAnafilaxia.r26) }
    static var r27: RegraFonte { regra("r27", MotorAnafilaxia.r27) }
    static var r28: RegraFonte { regra("r28", MotorAnafilaxia.r28) }
    static var rGestante: RegraFonte { regra("rGestante", MotorAnafilaxia.rGestante) }
    static var rLactente: RegraFonte { regra("rLactente", MotorAnafilaxia.rLactente) }
    static var rDiferenciais: RegraFonte { regra("rDiferenciais", MotorAnafilaxia.rDiferenciais) }
    static var rInfusao: RegraFonte { regra("rInfusao", MotorAnafilaxia.rInfusao) }
    static var rVolumeSem: RegraFonte { regra("rVolumeSem", MotorAnafilaxia.rVolumeSem) }
    static var rSemJanela: RegraFonte { regra("rSemJanela", MotorAnafilaxia.rSemJanela) }
}
