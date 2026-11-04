/* Registro das doenças com sessão de acompanhamento, porta de SessoesDisponiveis.swift. Mesma ordem do app.
   Para acrescentar uma: portar o motor, colocar aqui e criar a varredura e os erros plantados em teste/. */
import motorCAD from './cad.js';
import motorSCA from './sca.js';
import motorSepse from './sepse.js';
import motorAnafilaxia from './anafilaxia.js';
import motorEpileptico from './epileptico.js';
import motorEHH from './ehh.js';
import motorHipona from './hipona.js';

export * as nucleo from './nucleo.js';

export const todas = [motorCAD, motorSCA, motorSepse, motorAnafilaxia, motorEpileptico, motorEHH, motorHipona];
/* Sessão única para mais de uma conduta. */
const condutasIrmas = { nstemi: 'stemi' };
export function protocolo(id) { return todas.find((p) => p.id === id) ?? null; }
export function protocoloPorConduta(idConduta) {
  const alvo = condutasIrmas[idConduta] ?? idConduta;
  return todas.find((p) => p.idConduta === alvo) ?? null;
}
