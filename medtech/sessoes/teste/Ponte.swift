import Foundation

/* Ponte para o motor JS: um processo node por execução, uma linha de JSON por pedido.
   PONTE=comparar (padrão): avalia no Swift e no JS, reprova na primeira diferença e devolve o do Swift.
   PONTE=js: só o JS responde; os testes do app passam a conferir a saída do JS.
   PONTE_JS: caminho do ponte.mjs (padrão: ao lado deste arquivo, passado pelo script). */

final class NodeJS {
    static let shared = NodeJS()
    let proc = Process()
    let entrada = Pipe(), saida = Pipe()
    var buffer = Data()
    var pedidos = 0
    let modo = ProcessInfo.processInfo.environment["PONTE"] ?? "comparar"

    init() {
        let env = ProcessInfo.processInfo.environment
        proc.executableURL = URL(fileURLWithPath: env["NODE"] ?? "/opt/homebrew/bin/node")
        proc.arguments = [env["PONTE_JS"] ?? "ponte.mjs"]
        proc.standardInput = entrada
        proc.standardOutput = saida
        proc.standardError = FileHandle.standardError
        do { try proc.run() } catch { fatalError("node não abriu: \(error)") }
        atexit {
            let n = NodeJS.shared
            FileHandle.standardError.write("PONTE[\(n.modo)]: \(n.pedidos) pedidos ao JS\n".data(using: .utf8)!)
        }
    }
    func linha() -> String {
        let h = saida.fileHandleForReading
        while true {
            if let i = buffer.firstIndex(of: 0x0A) {
                let l = buffer[buffer.startIndex..<i]
                buffer = Data(buffer[buffer.index(after: i)...])
                return String(decoding: l, as: UTF8.self)
            }
            let d = h.availableData
            if d.isEmpty { fatalError("node fechou") }
            buffer.append(d)
        }
    }
    func pedir(_ v: [String: Any]) -> [String: Any] {
        pedidos += 1
        var d = try! JSONSerialization.data(withJSONObject: v)
        d.append(0x0A)
        entrada.fileHandleForWriting.write(d)
        let r = linha()
        guard let o = try? JSONSerialization.jsonObject(with: Data(r.utf8)) as? [String: Any] else { fatalError("resposta ilegível do node: \(r.prefix(300))") }
        if let erro = o["erro"] as? String { fatalError("erro no JS: \(erro)") }
        return o
    }
}

/* Uma divergência para o processo inteiro: o teste diferencial não segue com saída diferente. */
func reprovarDiferenca(_ r: [String: Any], _ o: String) -> Never {
    print("DIFERENÇA Swift x JS em \(o): \(r["dif"] as? String ?? "?")")
    if let c = r["caminho"] as? String { print("  caminho: \(c)") }
    if let e = r["estado"] as? String { print("  estado: \(e.prefix(4000))") }
    exit(4)
}

/* Compara uma avaliação inteira: orientações, passagem, campos e perguntas dos novos resultados. */
func compararNoJS(_ p: ProtocoloSessao, _ e: EstadoSessao, agora: Date, _ o: Orientacoes) {
    let esperado: [String: Any] = [
        "o": Codec.orientacoes(o),
        "passagem": PassagemSessao.texto(p, e, o, agora: agora),
        "campos": p.camposResultados(e),
        "perguntas": p.perguntasResultados(e).map(Codec.pergunta),
    ]
    let r = NodeJS.shared.pedir(["op": "avaliar", "p": p.id, "e": Codec.estado(e), "agora": Codec.ms(agora), "x": esperado])
    if (r["ok"] as? Bool) != true { reprovarDiferenca(r, "avaliar(\(p.id))") }
}
func compararDefinicao(_ p: ProtocoloSessao) {
    let r = NodeJS.shared.pedir(["op": "definicao", "p": p.id, "x": Codec.definicao(p)])
    if (r["ok"] as? Bool) != true { reprovarDiferenca(r, "definicao(\(p.id))") }
}
func compararMudancas(_ a: Orientacoes, _ d: Orientacoes) {
    let x = ComparaSessao.mudancas(antes: a, depois: d).map(Codec.mudanca)
    let r = NodeJS.shared.pedir(["op": "mudancas", "a": Codec.orientacoes(a), "d": Codec.orientacoes(d), "x": x])
    if (r["ok"] as? Bool) != true { reprovarDiferenca(r, "mudancas") }
}
/* Funções auxiliares exportadas pelo módulo (contas de dose, CrCl etc.): nome, argumentos e o resultado do Swift. */
func compararFuncao(_ p: String, _ nome: String, _ args: [Any], _ x: Any) {
    let r = NodeJS.shared.pedir(["op": "funcao", "p": p, "f": nome, "args": args, "x": x])
    if (r["ok"] as? Bool) != true { reprovarDiferenca(r, "\(p).\(nome)(\(args))") }
}

/* O motor visto pelos testes do app: tudo do Swift, menos avaliar, que passa pelo JS. */
struct PonteJS<M: ProtocoloSessao>: ProtocoloSessao {
    let m: M
    init(_ m: M) {
        self.m = m
        if NodeJS.shared.modo == "comparar" { compararDefinicao(m) }
    }
    var id: String { m.id }
    var nome: String { m.nome }
    var descricao: String { m.descricao }
    var idConduta: String { m.idConduta }
    var referencia: String { m.referencia }
    var escopo: String { m.escopo }
    var parametros: [DefParametro] { m.parametros }
    var parametrosIniciais: [String] { m.parametrosIniciais }
    var parametrosResultados: [String] { m.parametrosResultados }
    var triagem: [PerguntaSessao] { m.triagem }
    var perguntasIniciais: [PerguntaSessao] { m.perguntasIniciais }
    var perguntasAcompanhamento: [PerguntaSessao] { m.perguntasAcompanhamento }
    var ramos: [DefRamo] { m.ramos }
    var exames: [DefExame] { m.exames }
    var graficos: [DefGrafico] { m.graficos }
    var rotuloProximoPasso: String { m.rotuloProximoPasso }
    var rotuloPrazoExame: String { m.rotuloPrazoExame }
    var mostraTodasAsFontes: Bool { m.mostraTodasAsFontes }
    func camposResultados(_ e: EstadoSessao) -> [String] { m.camposResultados(e) }
    func perguntasResultados(_ e: EstadoSessao) -> [PerguntaSessao] { m.perguntasResultados(e) }
    var tituloRamos: String { m.tituloRamos }
    var nomeFonte: String { m.nomeFonte }
    var graficoFixo: String? { m.graficoFixo }
    var tituloExames: String { m.tituloExames }
    var tituloOutrosExames: String { m.tituloOutrosExames }
    var tituloResolucao: String? { m.tituloResolucao }
    func avaliar(_ e: EstadoSessao, agora: Date) -> Orientacoes {
        if NodeJS.shared.modo == "js" {
            let r = NodeJS.shared.pedir(["op": "avaliar", "p": m.id, "e": Codec.estado(e), "agora": Codec.ms(agora)])
            return Codec.lerOrientacoes(r["o"] as? [String: Any] ?? [:])
        }
        let o = m.avaliar(e, agora: agora)
        compararNoJS(m, e, agora: agora, o)
        return o
    }
}
