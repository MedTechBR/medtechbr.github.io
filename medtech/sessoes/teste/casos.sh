#!/bin/zsh
# Roda os testes do app iOS (casos à mão + grades) com o motor JS no lugar do Swift.
# Uso: casos.sh <doenca> [comparar|js|ambos]
#   comparar: cada avaliação dos testes vai ao Swift e ao JS; qualquer diferença reprova (teste diferencial).
#   js: só o JS responde a avaliar; os casos à mão e as grades do app conferem a saída do JS.
#       As funções estáticas que o teste chama direto passam pelo ponte_<doenca>.swift (quando existe):
#       cada chamada também vai ao JS e reprova se ele discordar.
#   ambos (padrão): os dois, em sequência.
# Não mexe no app: copia o teste para uma pasta temporária, troca "let motor = ..." e aplica troca_<doenca>.txt
# (linhas "de<TAB>para", troca literal). Variáveis: IOS (raiz do app), SESSOES_DIR (módulos JS, para erro plantado),
# BIN_CASOS (binário pronto), COMPILAR (só compila para este caminho e sai), ARGS_EXTRA (ex.: --rapido).
set -u
export SWIFT_DETERMINISTIC_HASHING=1
D=$1; MODO=${2:-ambos}
AQUI=${0:A:h}
IOS=${IOS:-$HOME/Documents/Claude/medtech-ios}
S=$IOS/MedTech/Ferramentas/Sessoes
typeset -A MOTOR=(cad MotorCAD sca MotorSCA sepse MotorSepse anafilaxia MotorAnafilaxia epileptico MotorEpileptico ehh MotorEHH hipona MotorHipona)
M=${MOTOR[$D]}
ARGS=(tools/sessao_${D}_casos.md)
[ $D = sca ] && ARGS+=(docs/sessao_sca_regras.md)
[ -n "${ARGS_EXTRA:-}" ] && ARGS+=(${=ARGS_EXTRA})
BIN=${BIN_CASOS:-}
if [ -z "$BIN" ]; then
  T=${TMPDIR:-/tmp}/mtsessoes-casos-$D-$$
  mkdir -p $T
  trap 'rm -rf $T' EXIT
  python3 - $IOS/tools/sessao_${D}_teste.swift $T/teste.swift $M $AQUI/troca_$D.txt <<'PY' || exit 2
import sys, os
s = open(sys.argv[1], encoding='utf8').read()
m = sys.argv[3]
linha = f"let motor = {m}()"
if f"\n{linha}\n" not in s: sys.exit("não achei a linha do motor")
s = s.replace(f"\n{linha}\n", f"\nlet motor = PonteJS({m}())\n", 1)
if os.path.exists(sys.argv[4]):
    for l in open(sys.argv[4], encoding='utf8').read().splitlines():
        if not l.strip() or l.startswith('#'): continue
        de, para = l.split('\t')
        if de not in s: sys.exit("troca não aplicou: " + de)
        s = s.replace(de, para)
open(sys.argv[2], 'w', encoding='utf8').write(s)
PY
  EXTRA=()
  [ -f $AQUI/ponte_$D.swift ] && EXTRA=($AQUI/ponte_$D.swift)
  # Todos os motores e o registro: o teste da SCA usa SessoesDisponiveis.
  swiftc -O -parse-as-library $S/NucleoSessao.swift $S/Motor*.swift $S/SessoesDisponiveis.swift $AQUI/Codec.swift $AQUI/Ponte.swift $EXTRA $T/teste.swift -o $T/casos 2>&1 | grep -v warning | head -20
  BIN=$T/casos
  if [ -n "${COMPILAR:-}" ]; then cp $BIN $COMPILAR; exit 0; fi
fi
[ -x $BIN ] || { echo "não compilou"; exit 2; }
cd $IOS
r=0
if [ $MODO = ambos ]; then modos=(comparar js); else modos=($MODO); fi
for m in $modos; do
  echo "== $D, modo $m"
  PONTE=$m PONTE_JS=$AQUI/ponte.mjs $BIN $ARGS || r=$?
  [ $r -ne 0 ] && break
done
exit $r
