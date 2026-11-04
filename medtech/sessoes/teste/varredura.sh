#!/bin/zsh
# Teste diferencial por varredura: compila o motor Swift do app com a config da doença e compara com o JS.
# Uso: varredura.sh <doenca> [semente] [escala]
# Variáveis: IOS (raiz do app), SESSOES_DIR (módulos JS, para erro plantado), BIN_VARREDURA (binário pronto),
# COMPILAR (só compila para este caminho e sai), TZ.
set -u
# Ordem fixa dos dicionários do Swift (ver DIVERGENCIAS.md, mal epiléptico).
export SWIFT_DETERMINISTIC_HASHING=1
D=$1; SEM=${2:-1}; ESC=${3:-1}
AQUI=${0:A:h}
IOS=${IOS:-$HOME/Documents/Claude/medtech-ios}
S=$IOS/MedTech/Ferramentas/Sessoes
typeset -A MOTOR=(cad MotorCAD sca MotorSCA sepse MotorSepse anafilaxia MotorAnafilaxia epileptico MotorEpileptico ehh MotorEHH hipona MotorHipona)
M=${MOTOR[$D]}
BIN=${BIN_VARREDURA:-}
if [ -z "$BIN" ]; then
  T=${TMPDIR:-/tmp}/mtsessoes-varr-$D-$$
  mkdir -p $T
  trap 'rm -rf $T' EXIT
  swiftc -O -parse-as-library $S/NucleoSessao.swift $S/$M.swift $AQUI/Codec.swift $AQUI/Ponte.swift $AQUI/VarreduraComum.swift $AQUI/varredura_$D.swift -o $T/varr 2>&1 | grep -v warning | head -20
  BIN=$T/varr
  if [ -n "${COMPILAR:-}" ]; then cp $BIN $COMPILAR; exit 0; fi
fi
[ -x $BIN ] || { echo "não compilou"; exit 2; }
PONTE=comparar PONTE_JS=$AQUI/ponte.mjs $BIN $S/$M.swift $SEM $ESC
