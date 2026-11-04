import Foundation

/* Codificação dos tipos do núcleo no JSON do contrato do PWA (medtech/sessoes/LEIAME.md).
   Só para o teste diferencial: compila junto do núcleo do app iOS, fora do projeto, sem mudar nada lá.
   Datas viram milissegundos desde 1970, arredondados ao inteiro, como Date.now() no navegador. */

enum Codec {
    static func ms(_ d: Date) -> Double { (d.timeIntervalSince1970 * 1000).rounded() }
    static func data(_ v: Any?) -> Date? {
        guard let n = v as? NSNumber else { return nil }
        return Date(timeIntervalSince1970: n.doubleValue / 1000)
    }
    static func opt(_ v: Any?) -> Any { v ?? NSNull() }
    static func optS(_ v: String?) -> Any { v.map { $0 as Any } ?? NSNull() }
    static func optD(_ v: Date?) -> Any { v.map { ms($0) as Any } ?? NSNull() }
    static func dic(_ d: [String: Double]) -> [String: Any] { d.mapValues { $0 as Any } }

    /* ---------- Estado ---------- */
    static func estado(_ e: EstadoSessao) -> [String: Any] {
        [
            "protocolo": e.protocolo,
            "inicio": ms(e.inicio),
            "series": e.series.mapValues { $0.map { ["valor": $0.valor, "hora": ms($0.hora)] as [String: Any] } },
            "respostas": e.respostas,
            "escolhas": e.escolhas,
            "acoes": e.acoes.map { ["id": $0.id.uuidString, "tipo": $0.tipo, "rotulo": $0.rotulo, "hora": ms($0.hora), "valores": dic($0.valores)] as [String: Any] },
            "etapa": e.etapa,
        ]
    }

    /* ---------- Definição do protocolo ---------- */
    static func pergunta(_ q: PerguntaSessao) -> [String: Any] { ["chave": q.chave, "texto": q.texto, "detalhe": optS(q.detalhe)] }
    static func opcao(_ o: OpcaoRamo) -> [String: Any] { ["id": o.id, "rotulo": o.rotulo, "detalhe": o.detalhe] }
    static func definicao(_ p: ProtocoloSessao) -> [String: Any] {
        [
            "id": p.id, "nome": p.nome, "descricao": p.descricao, "idConduta": p.idConduta, "referencia": p.referencia, "escopo": p.escopo,
            "parametros": p.parametros.map { ["id": $0.id, "nome": $0.nome, "unidade": $0.unidade, "minPlausivel": $0.minPlausivel, "maxPlausivel": $0.maxPlausivel, "casas": $0.casas] as [String: Any] },
            "parametrosIniciais": p.parametrosIniciais,
            "parametrosResultados": p.parametrosResultados,
            "triagem": p.triagem.map(pergunta),
            "perguntasIniciais": p.perguntasIniciais.map(pergunta),
            "perguntasAcompanhamento": p.perguntasAcompanhamento.map(pergunta),
            "ramos": p.ramos.map { ["id": $0.id, "titulo": $0.titulo, "opcoes": $0.opcoes.map(opcao)] as [String: Any] },
            "exames": p.exames.map { ["id": $0.id, "nome": $0.nome, "aviso": $0.aviso, "destaque": $0.destaque] as [String: Any] },
            "graficos": p.graficos.map { g in ["id": g.id, "titulo": g.titulo, "parametros": g.parametros, "linhas": g.linhas.mapValues { $0.map { ["valor": $0.valor, "rotulo": $0.rotulo] as [String: Any] } }] as [String: Any] },
            "rotuloProximoPasso": p.rotuloProximoPasso,
            "rotuloPrazoExame": p.rotuloPrazoExame,
            "mostraTodasAsFontes": p.mostraTodasAsFontes,
            "tituloRamos": p.tituloRamos,
            "nomeFonte": p.nomeFonte,
            "graficoFixo": optS(p.graficoFixo),
            "tituloExames": p.tituloExames,
            "tituloOutrosExames": p.tituloOutrosExames,
            "tituloResolucao": optS(p.tituloResolucao),
        ]
    }

    /* ---------- Orientações ---------- */
    static func regra(_ r: RegraFonte) -> [String: Any] { ["linha": r.linha, "texto": r.texto, "origem": r.origem] }
    static func regraO(_ r: RegraFonte?) -> Any { r.map { regra($0) as Any } ?? NSNull() }
    static func acao(_ a: AcaoProposta) -> [String: Any] { ["tipo": a.tipo, "rotulo": a.rotulo, "valores": dic(a.valores), "secundaria": a.secundaria] }
    static func situacao(_ s: SituacaoCartao) -> String { s.rawValue }
    static func cartao(_ c: Cartao) -> [String: Any] {
        [
            "id": c.id, "titulo": c.titulo, "simbolo": c.simbolo, "corHex": Int(c.corHex), "situacao": c.situacao.rawValue, "valor": c.valor,
            "conta": optS(c.conta), "detalhe": optS(c.detalhe), "regras": c.regras.map(regra), "acoes": c.acoes.map(acao),
            "pergunta": c.pergunta.map { ["chave": $0.chave, "texto": $0.texto] as Any } ?? NSNull(),
            "discreto": c.discreto, "primeiro": c.primeiro, "liberado": c.liberado, "doses": dic(c.doses), "etiqueta": optS(c.etiqueta), "noTopo": c.noTopo,
        ]
    }
    static func tres(_ t: Tres) -> String { switch t { case .sim: "sim"; case .nao: "nao"; case .falta: "falta" } }
    static func painel(_ p: PainelCriterios?) -> Any {
        guard let p else { return NSNull() }
        return [
            "titulo": p.titulo,
            "criterios": p.criterios.map { ["id": $0.id, "nome": $0.nome, "situacao": tres($0.situacao), "valor": optS($0.valor), "opcional": $0.opcional] as [String: Any] },
            "cumprido": p.cumprido, "regra": regra(p.regra), "acao": p.acao.map { acao($0) as Any } ?? NSNull(), "texto": optS(p.texto),
        ] as [String: Any]
    }
    static func tipoPasso(_ t: TipoPasso) -> [String: Any] {
        switch t {
        case .simNao: return ["caso": "simNao"]
        case .opcoes(let o): return ["caso": "opcoes", "opcoes": o.map(opcao)]
        case .numero(let id): return ["caso": "numero", "parametro": id]
        case .hora(let p): return ["caso": "hora", "padrao": optD(p)]
        case .lista(let i): return ["caso": "lista", "itens": i.map { ["chave": $0.chave, "texto": $0.texto, "trava": $0.trava] as [String: Any] }]
        }
    }
    static func passo(_ p: PassoGuiado?) -> Any {
        guard let p else { return NSNull() }
        return ["chave": p.chave, "secao": p.secao, "texto": p.texto, "detalhe": optS(p.detalhe), "tipo": tipoPasso(p.tipo), "regras": p.regras.map(regra), "semDado": optS(p.semDado), "confirmarPadrao": optS(p.confirmarPadrao)] as [String: Any]
    }
    static func situacaoExame(_ s: SituacaoExame) -> String { s.rawValue }
    static func orientacoes(_ o: Orientacoes) -> [String: Any] {
        [
            "foraDeEscopo": o.foraDeEscopo,
            "triagemCompleta": o.triagemCompleta,
            "confirmacao": painel(o.confirmacao),
            "classificacao": optS(o.classificacao),
            "classificacaoDetalhe": optS(o.classificacaoDetalhe),
            "classificacaoRegra": regraO(o.classificacaoRegra),
            "ramoBloqueado": o.ramoBloqueado,
            "travas": o.travas.map { ["id": $0.id, "titulo": $0.titulo, "texto": $0.texto, "regra": regra($0.regra)] as [String: Any] },
            "alertas": o.alertas.map { ["id": $0.id, "nivel": $0.nivel == .vermelho ? "vermelho" : "amarelo", "texto": $0.texto, "regra": regra($0.regra)] as [String: Any] },
            "cartoes": o.cartoes.map(cartao),
            "exames": o.exames.map { ["id": $0.id, "nome": $0.nome, "aviso": $0.aviso, "destaque": $0.destaque, "ultima": optD($0.ultima), "janelaInicio": optD($0.janelaInicio), "proxima": optD($0.proxima), "situacao": $0.situacao.rawValue, "regra": regra($0.regra), "rotuloSemDado": $0.rotuloSemDado] as [String: Any] },
            "resolucao": painel(o.resolucao),
            "etapasFinais": o.etapasFinais.map(cartao),
            "encerradaPelaRegra": optS(o.encerradaPelaRegra),
            "passo": passo(o.passo),
            "relogioDesde": optD(o.relogioDesde),
            "faixaCaminho": optS(o.faixaCaminho),
            "cronometro": o.cronometro.map { c in ["titulo": c.titulo, "desde": ms(c.desde), "subtitulo": optS(c.subtitulo), "marcos": c.marcos.map { ["minutos": $0.minutos, "rotulo": $0.rotulo] as [String: Any] }, "regra": regraO(c.regra)] as Any } ?? NSNull(),
            "ramoAtual": o.ramoAtual,
        ]
    }
    static func mudanca(_ m: Mudanca) -> [String: Any] { ["id": m.id, "titulo": m.titulo, "antes": m.antes, "depois": m.depois, "porque": regraO(m.porque)] }

    /* ---------- Volta: JSON do JS para os tipos Swift (os testes do app rodam sobre a saída do JS) ---------- */
    struct Erro: Error { let campo: String }
    static func s(_ d: [String: Any], _ k: String) -> String { d[k] as? String ?? "" }
    static func sO(_ d: [String: Any], _ k: String) -> String? { d[k] as? String }
    static func b(_ d: [String: Any], _ k: String) -> Bool { (d[k] as? NSNumber)?.boolValue ?? false }
    static func n(_ d: [String: Any], _ k: String) -> Double { (d[k] as? NSNumber)?.doubleValue ?? .nan }
    static func arr(_ d: [String: Any], _ k: String) -> [[String: Any]] { d[k] as? [[String: Any]] ?? [] }
    static func dd(_ d: [String: Any], _ k: String) -> [String: Double] { (d[k] as? [String: Any] ?? [:]).mapValues { ($0 as? NSNumber)?.doubleValue ?? .nan } }
    static func ds(_ d: [String: Any], _ k: String) -> [String: String] { d[k] as? [String: String] ?? [:] }
    static func lerRegra(_ d: [String: Any]) -> RegraFonte { RegraFonte(linha: Int(n(d, "linha")), texto: s(d, "texto"), origem: s(d, "origem")) }
    static func lerRegraO(_ v: Any?) -> RegraFonte? { (v as? [String: Any]).map(lerRegra) }
    static func lerAcao(_ d: [String: Any]) -> AcaoProposta { AcaoProposta(tipo: s(d, "tipo"), rotulo: s(d, "rotulo"), valores: dd(d, "valores"), secundaria: b(d, "secundaria")) }
    static func lerOpcao(_ d: [String: Any]) -> OpcaoRamo { OpcaoRamo(id: s(d, "id"), rotulo: s(d, "rotulo"), detalhe: s(d, "detalhe")) }
    static func lerCartao(_ d: [String: Any]) -> Cartao {
        var c = Cartao(id: s(d, "id"), titulo: s(d, "titulo"), simbolo: s(d, "simbolo"), corHex: UInt32(n(d, "corHex")), situacao: SituacaoCartao(rawValue: s(d, "situacao"))!, valor: s(d, "valor"))
        c.conta = sO(d, "conta"); c.detalhe = sO(d, "detalhe")
        c.regras = arr(d, "regras").map(lerRegra); c.acoes = arr(d, "acoes").map(lerAcao)
        c.pergunta = (d["pergunta"] as? [String: Any]).map { PerguntaCartao(chave: s($0, "chave"), texto: s($0, "texto")) }
        c.discreto = b(d, "discreto"); c.primeiro = b(d, "primeiro"); c.liberado = b(d, "liberado")
        c.doses = dd(d, "doses"); c.etiqueta = sO(d, "etiqueta"); c.noTopo = b(d, "noTopo")
        return c
    }
    static func lerTres(_ s: String) -> Tres { s == "sim" ? .sim : s == "nao" ? .nao : .falta }
    static func lerPainel(_ v: Any?) -> PainelCriterios? {
        guard let d = v as? [String: Any] else { return nil }
        return PainelCriterios(titulo: s(d, "titulo"),
                               criterios: arr(d, "criterios").map { Criterio(id: s($0, "id"), nome: s($0, "nome"), situacao: lerTres(s($0, "situacao")), valor: sO($0, "valor"), opcional: b($0, "opcional")) },
                               cumprido: b(d, "cumprido"), regra: lerRegra(d["regra"] as? [String: Any] ?? [:]),
                               acao: (d["acao"] as? [String: Any]).map(lerAcao), texto: sO(d, "texto"))
    }
    static func lerTipo(_ d: [String: Any]) -> TipoPasso {
        switch s(d, "caso") {
        case "simNao": return .simNao
        case "opcoes": return .opcoes(arr(d, "opcoes").map(lerOpcao))
        case "numero": return .numero(s(d, "parametro"))
        case "hora": return .hora(padrao: data(d["padrao"]))
        default: return .lista(arr(d, "itens").map { ItemPasso(chave: s($0, "chave"), texto: s($0, "texto"), trava: b($0, "trava")) })
        }
    }
    static func lerPasso(_ v: Any?) -> PassoGuiado? {
        guard let d = v as? [String: Any] else { return nil }
        return PassoGuiado(chave: s(d, "chave"), secao: s(d, "secao"), texto: s(d, "texto"), detalhe: sO(d, "detalhe"), tipo: lerTipo(d["tipo"] as? [String: Any] ?? [:]),
                           regras: arr(d, "regras").map(lerRegra), semDado: sO(d, "semDado"), confirmarPadrao: sO(d, "confirmarPadrao"))
    }
    static func lerOrientacoes(_ d: [String: Any]) -> Orientacoes {
        var o = Orientacoes()
        o.foraDeEscopo = d["foraDeEscopo"] as? [String] ?? []
        o.triagemCompleta = b(d, "triagemCompleta")
        o.confirmacao = lerPainel(d["confirmacao"])
        o.classificacao = sO(d, "classificacao"); o.classificacaoDetalhe = sO(d, "classificacaoDetalhe"); o.classificacaoRegra = lerRegraO(d["classificacaoRegra"])
        o.ramoBloqueado = ds(d, "ramoBloqueado")
        o.travas = arr(d, "travas").map { Trava(id: s($0, "id"), titulo: s($0, "titulo"), texto: s($0, "texto"), regra: lerRegra($0["regra"] as? [String: Any] ?? [:])) }
        o.alertas = arr(d, "alertas").map { Alerta(id: s($0, "id"), nivel: s($0, "nivel") == "vermelho" ? .vermelho : .amarelo, texto: s($0, "texto"), regra: lerRegra($0["regra"] as? [String: Any] ?? [:])) }
        o.cartoes = arr(d, "cartoes").map(lerCartao)
        o.exames = arr(d, "exames").map { x in
            var r = ExameDevido(id: s(x, "id"), nome: s(x, "nome"), aviso: s(x, "aviso"), destaque: b(x, "destaque"), ultima: data(x["ultima"]), janelaInicio: data(x["janelaInicio"]),
                                proxima: data(x["proxima"]), situacao: SituacaoExame(rawValue: s(x, "situacao"))!, regra: lerRegra(x["regra"] as? [String: Any] ?? [:]))
            r.rotuloSemDado = s(x, "rotuloSemDado")
            return r
        }
        o.resolucao = lerPainel(d["resolucao"])
        o.etapasFinais = arr(d, "etapasFinais").map(lerCartao)
        o.encerradaPelaRegra = sO(d, "encerradaPelaRegra")
        o.passo = lerPasso(d["passo"])
        o.relogioDesde = data(d["relogioDesde"])
        o.faixaCaminho = sO(d, "faixaCaminho")
        o.cronometro = (d["cronometro"] as? [String: Any]).map { c in
            CronometroSessao(titulo: s(c, "titulo"), desde: data(c["desde"]) ?? Date(), subtitulo: sO(c, "subtitulo"),
                             marcos: arr(c, "marcos").map { MarcoCronometro(minutos: n($0, "minutos"), rotulo: s($0, "rotulo")) }, regra: lerRegraO(c["regra"]))
        }
        o.ramoAtual = ds(d, "ramoAtual")
        return o
    }

    static func json(_ v: Any) -> String {
        let d = try! JSONSerialization.data(withJSONObject: v, options: [.fragmentsAllowed])
        return String(decoding: d, as: UTF8.self)
    }
}
