import Foundation

/* Varredura diferencial da sepse e do choque séptico. */
@main
struct VarreduraSepse {
    static let vs: [String?] = [nil, "definida", "provavel", "possivel", "improvavel", "outra"]
    static let tri: [Bool?] = [nil, true, false]

    static func base(_ t: Date, veross: String? = "provavel", recHa: Double = 30) -> EstadoSessao {
        var e = EstadoSessao(protocolo: "sepse", inicio: t.addingTimeInterval(-600 * 60))
        for q in MotorSepse().triagem { e.respostas[q.chave] = false }
        if let veross { e.escolhas["verossimilhanca"] = veross }
        e.medir("reconhecidaHa", recHa, t)
        e.acoes.append(AcaoRegistrada(tipo: "sepse.confirmada", rotulo: "Confirmo e inicio a contagem", hora: t.addingTimeInterval(-recHa * 60)))
        return e
    }
    static func acao(_ e: inout EstadoSessao, _ tipo: String, _ h: Date) { e.acoes.append(AcaoRegistrada(tipo: tipo, rotulo: tipo, hora: h)) }

    static func prazoJSON(_ p: MotorSepse.PrazoATB) -> [String: Any] {
        switch p {
        case .horas(let h): return ["caso": "horas", "h": h]
        case .adiar: return ["caso": "adiar"]
        case .semRegra: return ["caso": "semRegra"]
        case .falta: return ["caso": "falta"]
        }
    }
    static func o(_ v: Any?) -> Any { v ?? NSNull() }

    /* Funções auxiliares em grade densa, comparadas direto. */
    static func funcoes() -> Int {
        var n = 0
        let t = Date(timeIntervalSince1970: 1_800_000_000)
        for v in vs {
            for c in tri {
                compararFuncao("sepse", "prazoAntibiotico", [o(v), o(c)], prazoJSON(MotorSepse.prazoAntibiotico(verossimilhanca: v, choque: c))); n += 1
            }
        }
        let pesos: [Double?] = [nil, 30, 45.5, 60, 69.9, 70, 86.7, 86.8, 90, 100, 120, 150, 300]
        let alturas: [Double?] = [nil, 0, -1, 120, 150, 160, 169.9, 170, 175, 180, 200, 230]
        let digitados: [Double?] = [nil, 55, 70.25, 80]
        for p in pesos { for a in alturas { for d in digitados {
            let r = MotorSepse.pesoDeCalculo(peso: p, altura: a, digitado: d)
            compararFuncao("sepse", "pesoDeCalculo", [o(p), o(a), o(d)], ["kg": o(r.kg), "motivo": r.motivo]); n += 1
        } } }
        /* Borda do IMC 30 exata: peso = 30 * m². */
        for cm in stride(from: 140.0, through: 210.0, by: 1.0) {
            let m = cm / 100
            for p in [30 * m * m, 30 * m * m + 0.01, 30 * m * m - 0.01, (30 * m * m * 10).rounded() / 10] {
                let r = MotorSepse.pesoDeCalculo(peso: p, altura: cm, digitado: nil)
                compararFuncao("sepse", "pesoDeCalculo", [p, cm, NSNull()], ["kg": o(r.kg), "motivo": r.motivo]); n += 1
            }
        }
        for i in [nil, 18, 64, 64.9, 64.99, 65, 65.01, 90] as [Double?] {
            let f = MotorSepse.faixaPAM(idade: i)
            compararFuncao("sepse", "faixaPAM", [o(i)], f.map { ["alvo": $0.alvo, "min": $0.min, "max": $0.max, "regra": Codec.regra($0.regra)] as Any } ?? NSNull()); n += 1
        }
        /* Estados para reconhecimento, hora do antibiótico, infundido e verossimilhança. */
        var r = Sorteio(s: 99)
        for _ in 0..<3000 {
            var e = EstadoSessao(protocolo: "sepse", inicio: t.addingTimeInterval(-Double(r.int(600)) * 60))
            for _ in 0..<r.int(3) { e.medir("reconhecidaHa", r.um([-5, 0, 0.5, 30, 59.9, 60, 180, 1440])!, t.addingTimeInterval(-Double(r.int(300)) * 60)) }
            for _ in 0..<r.int(3) { e.medir("antibioticoHa", r.um([-1, 0, 10, 45.5, 61, 200])!, t.addingTimeInterval(-Double(r.int(300)) * 60)) }
            for _ in 0..<r.int(5) { e.medir("cristaloide", r.um([0, 250, 333.3, 500, 1000, 0.1, 0.2])!, t.addingTimeInterval(-Double(r.int(300)) * 60)) }
            for _ in 0..<r.int(3) { acao(&e, "antibiotico.dado", t.addingTimeInterval(-Double(r.int(300)) * 60)) }
            for _ in 0..<r.int(3) { acao(&e, "verossimilhanca." + r.um(["definida", "provavel", "possivel", "improvavel"])!, t.addingTimeInterval(-Double(r.int(4)) * 60)) }
            if r.chance(0.5) { e.escolhas["verossimilhanca"] = r.um(["definida", "provavel", "possivel", "improvavel"]) }
            let est = Codec.estado(e)
            compararFuncao("sepse", "reconhecimento", [est], Codec.ms(MotorSepse.reconhecimento(e)))
            compararFuncao("sepse", "horaAntibiotico", [est], MotorSepse.horaAntibiotico(e).map { Codec.ms($0) as Any } ?? NSNull())
            compararFuncao("sepse", "infundido", [est], MotorSepse.infundido(e))
            compararFuncao("sepse", "verossimilhanca", [est], o(MotorSepse.verossimilhanca(e)))
            n += 4
        }
        return n
    }

    static func extras(_ t: Date) -> [(EstadoSessao, Date)] {
        var r: [(EstadoSessao, Date)] = []
        func ha(_ m: Double) -> Date { t.addingTimeInterval(-m * 60) }
        /* Prazos minuto a minuto: classificação x choque x minutos desde o reconhecimento (bordas de 1 h, 3 h, 6 h). */
        for v in vs {
            for c in tri {
                for m in [0.0, 1, 59, 60, 61, 119, 120, 121, 179, 180, 181, 359, 360, 361, 600] {
                    var e = base(t, veross: v, recHa: m)
                    if let c { e.respostas["choque"] = c }
                    e.respostas["hipotensao"] = true; e.respostas["focoControle"] = true
                    r.append((e, t))
                    var e2 = e
                    e2.medir("lactato", 3.1, ha(m / 2))
                    e2.medir("tec", 2.5, ha(m / 2))
                    r.append((e2, t))
                    /* Antibiótico dado há x minutos, por série. */
                    var e3 = e
                    e3.medir("antibioticoHa", 30, ha(5))
                    r.append((e3, t))
                }
            }
        }
        /* Volume: peso x altura x digitado x infundido x hipoperfusão (bordas de 30 e 50 mL/kg). */
        let hips: [(Bool?, Bool?, Bool?)] = [(true, nil, nil), (nil, true, nil), (nil, nil, true), (false, false, false), (nil, nil, nil), (false, nil, false), (false, false, nil)]
        for (h, l, c) in hips {
            for (peso, alt) in [(70.0, 170.0), (86.7, 170.0), (86.8, 170.0), (120.0, 160.0), (70.0, 0), (60.0, -1)] {
                for dig in [nil, 80.0] as [Double?] {
                    for inf in [0.0, 1, 2099, 2100, 2101, 3499, 3500, 3501, 4000] {
                        var e = base(t)
                        e.respostas["hipotensao"] = h; e.respostas["lactatoElevado"] = l; e.respostas["choque"] = c
                        e.medir("peso", peso, ha(20))
                        if alt != 0 || dig == nil { e.medir("altura", alt, ha(20)) }
                        if let dig { e.medir("pesoCalculo", dig, ha(20)) }
                        if inf > 0 { e.medir("cristaloide", inf / 2, ha(15)); e.medir("cristaloide", inf / 2, ha(5)) }
                        e.respostas["tce"] = [nil, true, false][Int(inf) % 3]
                        e.respostas["cirrose"] = Int(inf) % 2 == 0
                        e.respostas["drcIC"] = Int(inf) % 4 == 0
                        r.append((e, t))
                        var e2 = e
                        e2.respostas["hipoperfusaoPersiste"] = [nil, true, false][Int(inf) % 3]
                        e2.respostas["persisteAposVolume"] = [true, false, nil][Int(inf) % 3]
                        if Int(inf) % 2 == 1 { acao(&e2, "volume.restritiva", ha(3)); acao(&e2, "teste.responsivo", ha(2)) }
                        r.append((e2, t))
                    }
                }
            }
        }
        /* PAM: idade x PAM x noradrenalina (faixas 60-70 e 60-65, borda de 65 anos). */
        for idade in [nil, 17.9, 18, 40, 64, 64.9, 65, 80] as [Double?] {
            for pam in [nil, 20, 54, 59, 59.5, 60, 64, 64.5, 65, 65.4, 66, 70, 70.4, 71] as [Double?] {
                for nora in [nil, 0, 0.01, 0.3] as [Double?] {
                    for choque in [true, false, nil] as [Bool?] {
                        var e = base(t)
                        e.respostas["choque"] = choque
                        e.respostas["hipotensao"] = pam.map { $0 < 65 }
                        if let idade { e.medir("idade", idade, ha(30)) }
                        if let pam { e.medir("pam", pam, ha(2)) }
                        if let nora { e.medir("nora", nora, ha(2)) } else if pam == 60 { acao(&e, "nora.inicio", ha(20)) }
                        r.append((e, t))
                    }
                }
            }
        }
        /* Vasopressores, corticoide, cardíaco e retirada: todas as respostas e ações. */
        let tiposVaso = ["vaso.inicio", "vaso.indisponivel", "epi.inicio", "corticoide.inicio", "inotropico.dobutamina", "inotropico.epinefrina"]
        for mascara in 0..<(1 << tiposVaso.count) {
            for cresc in tri {
                for inad in tri {
                    var e = base(t)
                    e.respostas["choque"] = true
                    e.medir("idade", 50, ha(30)); e.medir("nora", 0.2, ha(5))
                    e.respostas["noraCrescente"] = cresc; e.respostas["pamInadequada"] = inad
                    e.respostas["disfuncaoCardiaca"] = cresc; e.respostas["hipoperfusaoComPA"] = inad
                    e.respostas["saiuFaseAguda"] = [true, false, nil][mascara % 3]
                    for (i, tp) in tiposVaso.enumerated() where mascara & (1 << i) != 0 { acao(&e, tp, ha(Double(10 + i))) }
                    r.append((e, t))
                }
            }
        }
        /* Exames minuto a minuto: sinais, foco, UTI, lembrete. */
        for m in stride(from: 0.0, through: 400.0, by: 1.0) {
            var e = base(t, recHa: m)
            e.respostas["lactatoElevado"] = true
            e.respostas["focoControle"] = Int(m) % 5 != 0
            e.medir("pam", 70, ha(m)); e.medir("fc", 100, ha(m * 0.7)); e.medir("fr", 22, ha(m * 0.9))
            e.medir("lembreteMin", 30, ha(m))
            acao(&e, "uti.indicada", ha(m))
            if Int(m) % 7 == 0 { acao(&e, "foco.controlado", ha(m / 2)) }
            if Int(m) % 11 == 0 { acao(&e, "uti.admitido", ha(m / 3)) }
            r.append((e, t))
            /* Sem confirmação: só os prazos. */
            var s = e
            s.acoes.removeAll { $0.tipo == "sepse.confirmada" }
            r.append((s, t))
        }
        /* Fora do escopo e idade abaixo de 18. */
        for q in MotorSepse().triagem {
            var e = base(t); e.respostas[q.chave] = true
            r.append((e, t))
            var i = base(t); i.respostas[q.chave] = nil
            r.append((i, t))
        }
        for idade in [0.0, 10, 17, 17.99, 18] {
            var e = base(t); e.medir("idade", idade, ha(1)); r.append((e, t))
        }
        return r
    }

    static func main() {
        principalVarredura { fonte in
            var cfg = ConfigVarredura(motor: MotorSepse(), fonte: fonte, base: { t in
                var e = base(t, veross: "provavel", recHa: 20)
                e.respostas["hipotensao"] = true
                e.medir("idade", 58, t.addingTimeInterval(-600)); e.medir("peso", 72, t.addingTimeInterval(-600)); e.medir("altura", 170, t.addingTimeInterval(-600))
                e.medir("pam", 58, t.addingTimeInterval(-600)); e.medir("lactato", 3.4, t.addingTimeInterval(-600))
                return e
            })
            cfg.bordas = [
                "pam": [54, 59, 59.5, 60, 60.4, 64, 64.5, 65, 65.4, 66, 69, 70, 70.4, 71],
                "idade": [17, 17.9, 18, 64, 64.9, 65, 65.1],
                "lactato": [1.9, 2, 2.1, 3.9, 4, 4.1],
                "peso": [70, 86.7, 86.8, 120, 30, 300],
                "altura": [150, 170, 180],
                "pesoCalculo": [55, 70.25],
                "cristaloide": [0, 1, 500, 1000, 2099, 2100, 2101, 3500],
                "nora": [0, 0.01, 0.25, 0.3],
                "reconhecidaHa": [0, 1, 59, 60, 61, 179, 180, 181, 359, 360, 361],
                "antibioticoHa": [0, 30, 59, 60, 61],
                "lembreteMin": [1, 30, 60],
                "tec": [2.9, 3, 3.1],
            ]
            cfg.tempos = [1, 59, 60, 61, 179, 180, 181, 359, 360, 361, 30]
            cfg.escolhasExtras = ["verossimilhanca": ["definida", "provavel", "possivel", "improvavel"]]
            cfg.respostasExtras = ["choque", "hipotensao", "lactatoElevado", "instavel", "tce", "cirrose", "drcIC", "disfuncaoCardiaca", "sobrecarga", "naoResponde",
                                   "hipoperfusaoPersiste", "persisteAposVolume", "pamInadequada", "noraCrescente", "hipoperfusaoComPA", "focoControle", "saiuFaseAguda"]
            cfg.acoesExtras = ["verossimilhanca.definida", "verossimilhanca.provavel", "verossimilhanca.possivel", "verossimilhanca.improvavel"]
            cfg.extras = extras
            cfg.funcoes = funcoes
            cfg.caminhadas = 600
            cfg.aleatorios = 6000
            return cfg
        }
    }
}
