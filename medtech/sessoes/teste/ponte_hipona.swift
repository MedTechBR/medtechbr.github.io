import Foundation

/* Funções estáticas de MotorHipona que os testes do app chamam direto (grau, ramo, conta, t0).
   Sem isto, com PONTE=js esses pontos dos testes conferem o Swift e não o JS. Aqui, com PONTE=js, cada chamada
   também passa pelo JS e reprova (saída 4) se o JS discordar; o valor devolvido é então igual nos dois.
   (O ponte.mjs não tem um op que devolva o valor do JS; com ele, daria para devolver o valor do JS direto.)
   Para usar: no teste copiado, trocar "MotorHipona.grau(", ".ramo(", ".conta(", ".t0(" por "JSHipona.<nome>(". */
enum JSHipona {
    static var js: Bool { NodeJS.shared.modo == "js" }
    static func medida(_ m: Medida?) -> Any { m.map { ["valor": $0.valor, "hora": Codec.ms($0.hora)] as Any } ?? NSNull() }
    static func grau(_ na: Double) -> MotorHipona.Grau {
        let v = MotorHipona.grau(na)
        if js { compararFuncao("hipona", "grau", [na], v.rawValue) }
        return v
    }
    static func ramo(_ e: EstadoSessao) -> MotorHipona.Ramo? {
        let v = MotorHipona.ramo(e)
        if js { compararFuncao("hipona", "ramo", [Codec.estado(e)], v.map { $0.rawValue as Any } ?? NSNull()) }
        return v
    }
    static func t0(_ e: EstadoSessao) -> Medida? {
        let v = MotorHipona.t0(e)
        if js { compararFuncao("hipona", "t0", [Codec.estado(e)], medida(v)) }
        return v
    }
    static func conta(_ e: EstadoSessao) -> MotorHipona.ContaDelta? {
        let c = MotorHipona.conta(e)
        if js {
            compararFuncao("hipona", "conta", [Codec.estado(e)], c.map { d in
                ["t0": medida(d.t0), "atual": medida(d.atual), "referencia": medida(d.referencia), "desdeInicio": d.desdeInicio, "em24h": d.em24h,
                 "primeiras24h": d.primeiras24h, "limite": d.limite, "falta": d.falta, "passou": d.passou] as Any
            } ?? NSNull())
        }
        return c
    }
}
