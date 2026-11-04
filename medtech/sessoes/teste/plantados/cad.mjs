/* Os 15 erros plantados de tools/sessao_cad_teste.sh, na mesma ordem, traduzidos para cad.js. */
export default [
  { nome: 'insulina liberada com K 3,5', de: 'const travaK = (k) => k <= 3.5;', para: 'const travaK = (k) => k < 3.5;' },
  { nome: 'KCl com K até 5,5', de: 'if (k > 5.0) {\n    c.valor = \'Sem K\';', para: 'if (k > 5.5) {\n    c.valor = \'Sem K\';' },
  { nome: 'redução com glicemia 259', de: 'if (g < 250 && t > 0.05)', para: 'if (g < 260 && t > 0.05)' },
  { nome: 'dextrose com glicemia 250', de: "if (g < 250) {\n    c.liberado = true;\n    c.valor = 'Dextrose", para: "if (g <= 250) {\n    c.liberado = true;\n    c.valor = 'Dextrose" },
  { nome: 'bicarbonato com pH 7,0', de: 'if (ph < 7.0) {\n    c.liberado = true;', para: 'if (ph <= 7.0) {\n    c.liberado = true;' },
  { nome: 'resolução com β-OHB 0,6', de: "const c1 = b !== null ? (b < 0.6 ? 'sim' : 'nao') : 'falta';", para: "const c1 = b !== null ? (b <= 0.6 ? 'sim' : 'nao') : 'falta';" },
  { nome: 'resolução sem pH 7,3', de: "if (p !== null && p >= 7.3) c2 = 'sim';", para: "if (p !== null && p > 7.3) c2 = 'sim';" },
  { nome: 'resolução sem HCO₃ 18', de: "else if (h !== null && h >= 18) c2 = 'sim';", para: "else if (h !== null && h > 18) c2 = 'sim';" },
  { nome: 'β-OHB faltando vira normal', de: "const c1 = b !== null ? (b < 0.6 ? 'sim' : 'nao') : 'falta';", para: "const c1 = b !== null ? (b < 0.6 ? 'sim' : 'nao') : 'sim';" },
  { nome: 'conta de dose errada', de: 'const u01 = 0.1 * peso', para: 'const u01 = 0.11 * peso' },
  { nome: 'exame vencido não sinalizado', de: "else if (proxima !== null && agora > proxima) s = 'vencido';", para: "else if (proxima !== null && agora > mais(proxima, 3600)) s = 'vencido';" },
  { nome: 'alerta de hipoglicemia em 70', de: 'if (g !== null && g < 70) {', para: 'if (g !== null && g <= 70) {' },
  { nome: 'K faltando vira normal', de: "if (k === null) {\n      c.valor = 'Falta potássio';", para: "k = k ?? 4.0;\n    if (false) {\n      c.valor = 'Falta potássio';" },
  { nome: 'erro antigo: não cai com intervalo curto', de: "if (desde(d[1].hora, d[0].hora) < intervaloMinimoComparacao) {", para: 'if (false) {' },
  { nome: '30 min exatos sem comparar', de: "if (desde(d[1].hora, d[0].hora) < intervaloMinimoComparacao) {", para: "if (desde(d[1].hora, d[0].hora) <= intervaloMinimoComparacao) {" },
];
