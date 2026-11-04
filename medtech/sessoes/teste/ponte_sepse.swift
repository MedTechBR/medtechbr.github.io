import Foundation

/* Regras e funções estáticas de MotorSepse que o teste do app lê direto. Devolvem o valor do Swift; com PONTE=js,
   cada leitura também vai ao JS (funcoesTeste de sepse.js) e reprova (saída 4) se ele discordar.
   A troca no teste copiado está em troca_sepse.txt. */
enum JSSepse {
    static var js: Bool { NodeJS.shared.modo == "js" }
    static func r(_ nome: String, _ v: RegraFonte) -> RegraFonte { if js { compararFuncao("sepse", "regra", [nome], Codec.regra(v)) }; return v }
    static var r1: RegraFonte { r("r1", MotorSepse.r1) }
    static var r2: RegraFonte { r("r2", MotorSepse.r2) }
    static var r3: RegraFonte { r("r3", MotorSepse.r3) }
    static var r4: RegraFonte { r("r4", MotorSepse.r4) }
    static var r5: RegraFonte { r("r5", MotorSepse.r5) }
    static var r6: RegraFonte { r("r6", MotorSepse.r6) }
    static var r7: RegraFonte { r("r7", MotorSepse.r7) }
    static var r8: RegraFonte { r("r8", MotorSepse.r8) }
    static var r9: RegraFonte { r("r9", MotorSepse.r9) }
    static var r10: RegraFonte { r("r10", MotorSepse.r10) }
    static var r11: RegraFonte { r("r11", MotorSepse.r11) }
    static var r12: RegraFonte { r("r12", MotorSepse.r12) }
    static var r13: RegraFonte { r("r13", MotorSepse.r13) }
    static var r14: RegraFonte { r("r14", MotorSepse.r14) }
    static var r15: RegraFonte { r("r15", MotorSepse.r15) }
    static var r16: RegraFonte { r("r16", MotorSepse.r16) }
    static var r17: RegraFonte { r("r17", MotorSepse.r17) }
    static var r18: RegraFonte { r("r18", MotorSepse.r18) }
    static var r19: RegraFonte { r("r19", MotorSepse.r19) }
    static var r20: RegraFonte { r("r20", MotorSepse.r20) }
    static var r21: RegraFonte { r("r21", MotorSepse.r21) }
    static var r22: RegraFonte { r("r22", MotorSepse.r22) }
    static var r23: RegraFonte { r("r23", MotorSepse.r23) }
    static var r25: RegraFonte { r("r25", MotorSepse.r25) }
    static var r26: RegraFonte { r("r26", MotorSepse.r26) }
    static var r27: RegraFonte { r("r27", MotorSepse.r27) }
    static var r28: RegraFonte { r("r28", MotorSepse.r28) }
    static var r29: RegraFonte { r("r29", MotorSepse.r29) }
    static var r30: RegraFonte { r("r30", MotorSepse.r30) }
    static var r31: RegraFonte { r("r31", MotorSepse.r31) }
    static var r32: RegraFonte { r("r32", MotorSepse.r32) }
    static var r33: RegraFonte { r("r33", MotorSepse.r33) }
    static var rPrazoVolume: RegraFonte { r("rPrazoVolume", MotorSepse.rPrazoVolume) }
    static var rLembrete: RegraFonte { r("rLembrete", MotorSepse.rLembrete) }
    static var rSem50: RegraFonte { r("rSem50", MotorSepse.rSem50) }
    static var rSobrecarga: RegraFonte { r("rSobrecarga", MotorSepse.rSobrecarga) }
    static var rDrcIC: RegraFonte { r("rDrcIC", MotorSepse.rDrcIC) }
    static var rEscopo: RegraFonte { r("rEscopo", MotorSepse.rEscopo) }
    static func reconhecimento(_ e: EstadoSessao) -> Date {
        let v = MotorSepse.reconhecimento(e)
        if js { compararFuncao("sepse", "reconhecimento", [Codec.estado(e)], Codec.ms(v)) }
        return v
    }
}
