/* ============================================================
   FlashMed — BANCO-SEMENTE de questões (nível residência).
   Curado à mão pelo MedTech; a IA amplia a partir daqui.
   Esquema de cada questão:
     {id, area, esp, q, ops:[5 alternativas], correct:<índice 0-4>, coment, ref}
   area ∈ CLINICA | CIRURGIA | GO | PED | PREV
   ============================================================ */
window.FM_AREAS = [
  { id:'CLINICA',  nome:'Clínica Médica',      cor:'#2563eb', esp:['Cardiologia','Pneumologia','Nefrologia','Endocrinologia','Gastroenterologia','Infectologia','Hematologia','Reumatologia','Neurologia'] },
  { id:'CIRURGIA', nome:'Cirurgia',            cor:'#0891b2', esp:['Abdome agudo','Trauma','Vascular','Proctologia'] },
  { id:'GO',       nome:'Ginecologia e Obstetrícia', cor:'#db2777', esp:['Obstetrícia','Ginecologia'] },
  { id:'PED',      nome:'Pediatria',           cor:'#16a34a', esp:['Neonatologia','Puericultura','Urgência pediátrica'] },
  { id:'PREV',     nome:'Medicina Preventiva', cor:'#d97706', esp:['SUS e políticas','Epidemiologia','Atenção básica'] }
];

window.QBANK = [
/* ===== CLÍNICA MÉDICA ===== */
{id:'q_cli1',area:'CLINICA',esp:'Cardiologia',q:'Homem de 62 anos, HAS e DM2, chega com dor precordial há 40 min. ECG mostra supra de ST de 2 mm em DII, DIII e aVF. O hospital NÃO tem hemodinâmica e a transferência para ICP levaria 150 min. Qual a conduta de reperfusão mais adequada?',
 ops:['Aguardar a transferência para angioplastia primária, independentemente do tempo','Trombólise química imediata, já que o tempo porta-balão previsto excede 120 min','Apenas AAS, clopidogrel e heparina, sem reperfusão','Realizar teste ergométrico antes de decidir a reperfusão','Iniciar apenas nitrato e morfina e reavaliar em 6 h'],correct:1,
 coment:'IAMCSST com previsão de ICP > 120 min do primeiro contato → fibrinólise em até 10 min (se sem contraindicação), seguida de transferência para estratégia fármaco-invasiva (CAT em 2–24 h). Supra em parede inferior (DII, DIII, aVF).',ref:'SBC/ESC IAMCSST'},
{id:'q_cli2',area:'CLINICA',esp:'Nefrologia',q:'Mulher de 70 anos internada, em uso de furosemida, evolui com creatinina de 1,0 para 2,1 mg/dL em 48 h e diurese 0,4 mL/kg/h nas últimas 8 h. FeNa 0,5%. Qual a principal hipótese?',
 ops:['Necrose tubular aguda','Lesão renal aguda pré-renal','Nefrite intersticial aguda','Glomerulonefrite rapidamente progressiva','Obstrução urinária baixa'],correct:1,
 coment:'FeNa < 1% sugere causa pré-renal. Porém, em uso de diurético a FeNa perde valor — o ideal é a FeUreia (< 35% = pré-renal). Preenche KDIGO (↑Cr ≥ 0,3 em 48 h e diurese < 0,5 mL/kg/h por ≥ 6 h).',ref:'KDIGO'},
{id:'q_cli3',area:'CLINICA',esp:'Endocrinologia',q:'Paciente com CAD, glicemia 480, pH 7,10, K sérico 3,1 mEq/L. Qual a conduta inicial correta quanto ao potássio e à insulina?',
 ops:['Iniciar insulina imediatamente, pois a glicemia está muito alta','Adiar a insulina e repor potássio até K ≥ 3,3 mEq/L','Repor bicarbonato antes de qualquer medida','Iniciar insulina e restringir potássio','Fazer insulina SC e liberar dieta'],correct:1,
 coment:'Na CAD a insulina desloca K para dentro da célula. Com K < 3,3 mEq/L, iniciar insulina causaria hipocalemia grave/arritmia → repor K primeiro e só então iniciar a insulina. K 3,3–5,2: repor junto. K > 5,2: não repor, monitorar.',ref:'ADA'},
{id:'q_cli4',area:'CLINICA',esp:'Infectologia',q:'Adulto de 55 anos, previamente hígido, com meningite bacteriana. Além de dexametasona antes do antibiótico, qual o esquema empírico mais adequado?',
 ops:['Ceftriaxona isolada','Ceftriaxona + vancomicina','Ceftriaxona + vancomicina + ampicilina','Penicilina cristalina isolada','Meropenem isolado'],correct:1,
 coment:'Adulto imunocompetente < 50 anos: ceftriaxona + vancomicina (cobre pneumococo com resistência intermediária). Ampicilina só se > 50 anos ou imunossupressão (cobertura de Listeria). Dexametasona antes/junto da 1ª dose reduz sequelas na meningite pneumocócica.',ref:'IDSA'},
{id:'q_cli5',area:'CLINICA',esp:'Pneumologia',q:'Paciente com DPOC exacerbada, pH 7,28, PaCO₂ 68, rebaixamento leve, usando musculatura acessória. Qual a intervenção com maior impacto em reduzir intubação e mortalidade?',
 ops:['Corticoide venoso em altas doses','Ventilação não invasiva (VNI)','Antibiótico de amplo espectro','Metilxantina (aminofilina) endovenosa','Oxigênio em alto fluxo por máscara não reinalante'],correct:1,
 coment:'Na exacerbação de DPOC com acidose respiratória (pH < 7,35 e PaCO₂ > 45), a VNI é a medida com maior redução de intubação e mortalidade. O2 deve ser titulado para SatO₂ 88–92% (evitar hiperóxia que piora a hipercapnia).',ref:'GOLD'},
{id:'q_cli6',area:'CLINICA',esp:'Cardiologia',q:'Paciente com ICFEr (FE 30%), NYHA II, já em dose otimizada de IECA + betabloqueador. Quais classes acrescentar para completar os "quatro pilares"?',
 ops:['Digoxina e ivabradina','Antagonista mineralocorticoide e iSGLT2','Bloqueador de canal de cálcio e nitrato','Amiodarona e estatina','Diurético de alça e AAS'],correct:1,
 coment:'Os quatro pilares da ICFEr: IECA/ARNI + betabloqueador + antagonista mineralocorticoide (espironolactona) + iSGLT2 (dapagliflozina/empagliflozina). Reduzem mortalidade. BCC di-hidropiridínico não tem benefício e verapamil/diltiazem são contraindicados na ICFEr.',ref:'ESC/SBC IC'},
{id:'q_cli7',area:'CLINICA',esp:'Gastroenterologia',q:'Homem de 50 anos, etilista, com hematêmese volumosa e cirrose conhecida. Além da reanimação, qual a associação farmacológica inicial correta?',
 ops:['Omeprazol + ácido tranexâmico','Terlipressina (ou octreotide) + antibiótico profilático (ceftriaxona)','Propranolol + espironolactona','Vitamina K + plasma fresco de rotina','Metoclopramida + sonda nasogástrica em aspiração'],correct:1,
 coment:'HDA varicosa: droga vasoativa (terlipressina/octreotide) reduz pressão portal + antibiótico profilático (ceftriaxona) reduz mortalidade e ressangramento (mesmo sem sinais de infecção). EDA em até 12 h para ligadura elástica.',ref:'Baveno VII'},
{id:'q_cli8',area:'CLINICA',esp:'Hematologia',q:'Mulher de 35 anos com plaquetopenia (18.000), esquizócitos no sangue periférico, LDH elevado, creatinina normal e alteração neurológica flutuante. ADAMTS13 < 10%. Qual a conduta de urgência?',
 ops:['Transfusão de plaquetas imediata','Plasmaférese (troca plasmática) de urgência','Eculizumab','Corticoide isolado e observação','Anticoagulação plena com heparina'],correct:1,
 coment:'Quadro de PTT (microangiopatia trombótica + ADAMTS13 < 10%). Tratamento é plasmaférese de urgência ± corticoide/rituximabe/caplacizumabe. Transfusão de plaquetas é CONTRAINDICADA (piora a trombose), exceto sangramento com risco de vida.',ref:'ISTH'},
{id:'q_cli9',area:'CLINICA',esp:'Neurologia',q:'Paciente com AVC isquêmico há 2 h, NIHSS 12, sem contraindicações, glicemia e PA controladas, TC sem hemorragia. Qual a conduta?',
 ops:['Apenas AAS 300 mg e internação','Trombólise endovenosa com alteplase/tenecteplase','Heparina plena imediata','Aguardar 24 h para nova TC','Nimodipino para neuroproteção'],correct:1,
 coment:'AVC isquêmico dentro de 4,5 h, sem contraindicações → trombólise EV (alteplase ou tenecteplase). Se oclusão de grande vaso, avaliar trombectomia mecânica (janela até 24 h em casos selecionados por perfusão). PA < 185/110 antes de trombolisar.',ref:'AHA/ASA'},
/* ===== CIRURGIA ===== */
{id:'q_cir1',area:'CIRURGIA',esp:'Abdome agudo',q:'Homem de 24 anos com dor que migrou de periumbilical para fossa ilíaca direita, anorexia, febre baixa e Blumberg positivo. Alvarado 8. Qual a conduta?',
 ops:['TC de abdome obrigatória antes de qualquer decisão em todos os casos','Apendicectomia (indicação cirúrgica com quadro clínico típico e Alvarado alto)','Antibiótico e alta com reavaliação em 48 h','Colonoscopia de urgência','Observação clínica por 72 h sem imagem'],correct:1,
 coment:'Apendicite aguda com quadro típico e Alvarado alto (7–10) tem indicação cirúrgica. Imagem (US/TC) ajuda em casos duvidosos, mulheres em idade fértil e extremos de idade, mas não deve atrasar a cirurgia no quadro clássico.',ref:'—'},
{id:'q_cir2',area:'CIRURGIA',esp:'Trauma',q:'Vítima de trauma fechado, PA 80x50, FC 130, resposta transitória à infusão de 1 L de cristaloide. FAST positivo no abdome. Qual a conduta?',
 ops:['Manter apenas cristaloide em grande volume até estabilizar','Laparotomia exploradora / controle cirúrgico do sangramento e hemotransfusão','TC de abdome com contraste antes de qualquer intervenção','Observação em unidade fechada','Angioembolização eletiva ambulatorial'],correct:1,
 coment:'Choque hemorrágico com FAST positivo e resposta transitória → sangramento ativo intra-abdominal: indicação de controle cirúrgico imediato (laparotomia) + protocolo de transfusão maciça. Evitar cristaloide em excesso (hipotensão permissiva até o controle).',ref:'ATLS'},
{id:'q_cir3',area:'CIRURGIA',esp:'Abdome agudo',q:'Idoso com dor abdominal súbita e intensa, "em facada", desproporcional ao exame físico, FA e acidose láctica. Qual a principal hipótese?',
 ops:['Diverticulite aguda','Isquemia mesentérica aguda','Pancreatite leve','Cólica nefrética','Constipação funcional'],correct:1,
 coment:'Dor abdominal intensa e desproporcional ao exame + fator embólico (FA) + acidose láctica = isquemia mesentérica aguda até prova em contrário. AngioTC de abdome é o exame de escolha; conduta precoce reduz mortalidade (revascularização/ressecção).',ref:'—'},
/* ===== GINECOLOGIA E OBSTETRÍCIA ===== */
{id:'q_go1',area:'GO',esp:'Obstetrícia',q:'Gestante de 34 semanas com PA 160x110, cefaleia e proteinúria. Além do sulfato de magnésio, qual anti-hipertensivo é seguro e indicado para a emergência hipertensiva na gravidez?',
 ops:['Captopril','Hidralazina (ou nifedipino/labetalol)','Losartana','Nitroprussiato de sódio de rotina','Atenolol em bolus'],correct:1,
 coment:'Pré-eclâmpsia grave: sulfato de Mg previne/trata eclâmpsia; para a crise hipertensiva use hidralazina, nifedipino ou labetalol. IECA/BRA são contraindicados na gestação (teratogênicos, oligoâmnio). Nitroprussiato só em exceção (risco de cianeto fetal).',ref:'FEBRASGO'},
{id:'q_go2',area:'GO',esp:'Obstetrícia',q:'Puérpera com atonia uterina e hemorragia pós-parto após massagem e ocitocina sem resposta. Qual a próxima droga uterotônica, atentando a contraindicações?',
 ops:['Metilergometrina — evitar se hipertensão/pré-eclâmpsia','Ácido tranexâmico como único agente','Misoprostol via oral apenas','Carbetocina em nova dose','Sulfato de magnésio'],correct:0,
 coment:'HPP por atonia: ocitocina 1ª linha → metilergometrina (CONTRAINDICADA em HAS/pré-eclâmpsia) → misoprostol → considerar balão intrauterino/cirurgia. Ácido tranexâmico é adjuvante precoce, não substitui uterotônico.',ref:'FEBRASGO/OMS'},
{id:'q_go3',area:'GO',esp:'Ginecologia',q:'Mulher de 28 anos, atraso menstrual, β-hCG positivo, dor pélvica e imagem de massa anexial sem saco gestacional intrauterino. Estável, β-hCG 1.800 e sem BCF. Qual opção pode ser adequada?',
 ops:['Alta com repetição de β-hCG em 1 mês','Metotrexato (gravidez ectópica íntegra, critérios favoráveis)','Curetagem uterina','Cerclagem','Indução do parto'],correct:1,
 coment:'Gravidez ectópica íntegra, paciente estável, β-hCG < 5.000, sem BCF e massa pequena → metotrexato é opção. Instabilidade, rotura, BCF ou β-hCG alto → cirurgia (salpingectomia/salpingostomia).',ref:'FEBRASGO'},
/* ===== PEDIATRIA ===== */
{id:'q_ped1',area:'PED',esp:'Urgência pediátrica',q:'Lactente de 8 meses com bronquiolite, saturação 96%, alimentando bem, desconforto leve. Qual a conduta com melhor evidência?',
 ops:['Corticoide sistêmico + broncodilatador de rotina','Suporte (hidratação, higiene nasal, O2 se necessário) — bronquiolite tem manejo de suporte','Antibiótico empírico','Nebulização com adrenalina em casa','Fisioterapia respiratória vigorosa de rotina'],correct:1,
 coment:'Bronquiolite viral (VSR) tem tratamento de SUPORTE: hidratação, desobstrução nasal e O2 se SatO₂ < 90–92%. Corticoide, broncodilatador e antibiótico NÃO são recomendados de rotina. Sinais de gravidade indicam internação.',ref:'SBP/AAP'},
{id:'q_ped2',area:'PED',esp:'Puericultura',q:'Recém-nascido a termo, mãe HBsAg positivo. Qual conduta reduz a transmissão vertical do vírus da hepatite B?',
 ops:['Apenas vacina para hepatite B no 1º mês','Vacina para hepatite B + imunoglobulina anti-HBs nas primeiras 12–24 h','Nada, apenas acompanhamento sorológico','Antirretroviral para o recém-nascido','Cesárea eletiva isoladamente'],correct:1,
 coment:'RN de mãe HBsAg+: vacina para hepatite B + imunoglobulina específica (HBIG) nas primeiras 12–24 h de vida, em locais diferentes. Reduz drasticamente a transmissão vertical. Completar o esquema vacinal e sorologia após.',ref:'MS/SBP'},
{id:'q_ped3',area:'PED',esp:'Urgência pediátrica',q:'Criança de 3 anos com crise convulsiva tônico-clônica há 6 minutos, sem acesso venoso. Qual a primeira droga e via?',
 ops:['Fenitoína EV','Diazepam ou midazolam (midazolam IM/intranasal/bucal se sem acesso)','Fenobarbital VO','Ácido valproico retal','Aguardar cessar espontaneamente'],correct:1,
 coment:'Crise > 5 min = estado de mal epiléptico → benzodiazepínico é a 1ª linha. Sem acesso venoso: midazolam IM, intranasal ou bucal. Com acesso: diazepam ou midazolam EV. Se persistir, 2ª linha (fenitoína/fosfenitoína, valproato ou levetiracetam).',ref:'—'},
/* ===== MEDICINA PREVENTIVA / SAÚDE COLETIVA ===== */
{id:'q_prev1',area:'PREV',esp:'SUS e políticas',q:'Um princípio doutrinário do SUS garante que todo cidadão tem direito ao atendimento em qualquer nível de complexidade, sem privilégios ou barreiras. Qual princípio é esse?',
 ops:['Hierarquização','Universalidade','Descentralização','Regionalização','Complementaridade do setor privado'],correct:1,
 coment:'Princípios DOUTRINÁRIOS do SUS: Universalidade (todos têm direito), Integralidade (ações de promoção/prevenção/cura/reabilitação) e Equidade (tratar desigualmente os desiguais). Hierarquização/descentralização/regionalização são princípios ORGANIZATIVOS.',ref:'Lei 8.080/90'},
{id:'q_prev2',area:'PREV',esp:'Epidemiologia',q:'Um teste de rastreio tem alta sensibilidade e baixa especificidade. Qual afirmação é correta?',
 ops:['É bom para confirmar a doença (poucos falsos-positivos)','É bom para triagem, pois quase não deixa passar doentes (poucos falsos-negativos)','Tem alto valor preditivo positivo independentemente da prevalência','Não serve para rastreamento populacional','Sensibilidade alta significa muitos falsos-negativos'],correct:1,
 coment:'Alta SENSIBILIDADE = poucos falsos-negativos → ideal para TRIAGEM (não deixa escapar doentes; um resultado negativo praticamente exclui). Baixa especificidade gera falsos-positivos, que depois são confirmados por um teste específico (alta especificidade confirma).',ref:'—'},
{id:'q_prev3',area:'PREV',esp:'Atenção básica',q:'Na Estratégia Saúde da Família, qual característica define o processo de trabalho e o vínculo com a população?',
 ops:['Livre demanda sem território definido','Adscrição de território e população, com equipe multiprofissional de referência','Atendimento exclusivamente por especialistas focais','Porta de entrada hospitalar','Ações apenas curativas individuais'],correct:1,
 coment:'A ESF organiza a atenção básica com território e população ADSCRITOS a uma equipe de referência (médico, enfermeiro, técnico, ACS), com longitudinalidade, vínculo e coordenação do cuidado. É a principal porta de entrada e ordenadora da RAS.',ref:'PNAB'}
];
