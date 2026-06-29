/**
 * analiseSolo.js — motor de interpretação de análise de solo e geração do
 * plano de calagem + adubação para o cronograma do lote.
 *
 * Base técnica: método da Saturação por Bases (V%) — Embrapa / CFSEMG (Manual de
 * Adubação e Calagem para MG). Reproduz a lógica do laudo agronômico Solocria:
 *  - Calagem: NC = CTC × (V2 − V1) / PRNT, com V2 alvo por cultura.
 *  - Fosfatagem só após a calagem (Ca bloqueia o P) — 30 dias de intervalo.
 *  - Parcelamento de N e K (solo arenoso lixivia).
 *  - Sulfato de Amônio no lugar da Ureia a partir da 2ª cobertura quando o solo
 *    é ácido (pH CaCl2 < 5,5): perde 3–5× menos N por volatilização e fornece S.
 *
 * Todas as funções são puras (sem efeitos colaterais).
 *
 * Painel essencial (objeto `analise`):
 *   { ph, p, k, ca, mg, al, hAl, mo, zn?, argila?, prnt?, data?, lab? }
 *   - ph     : pH em CaCl2
 *   - p      : Fósforo P-resina (mg/dm³)
 *   - k      : Potássio (mg/dm³)
 *   - ca,mg,al,hAl : cmolc/dm³
 *   - mo     : Matéria orgânica (g/dm³)
 *   - zn     : Zinco (mg/dm³) — opcional
 *   - argila : % de argila — opcional (textura)
 *   - prnt   : PRNT do calcário a usar (%) — default 80
 */

const num = (v) => {
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : v;
  return Number.isFinite(n) ? n : null;
};

/** Converte K de mg/dm³ para cmolc/dm³ (massa equivalente do K = 391 mg/cmolc). */
export const kParaCmolc = (kMgDm3) => (num(kMgDm3) ?? 0) / 391;

/** Índices derivados: CTC (T), Soma de Bases (SB), V% e saturação por Al (m%). */
export function derivarIndices(a) {
  const ca = num(a.ca) ?? 0;
  const mg = num(a.mg) ?? 0;
  const al = num(a.al) ?? 0;
  const hAl = num(a.hAl) ?? 0;
  const kc = kParaCmolc(a.k);
  const sb = ca + mg + kc;            // Soma de Bases
  const ctc = sb + hAl;              // CTC a pH 7 (T)
  const ctcEfetiva = sb + al;        // CTC efetiva (t)
  const v = ctc > 0 ? (sb / ctc) * 100 : 0;            // Saturação por bases V%
  const m = ctcEfetiva > 0 ? (al / ctcEfetiva) * 100 : 0; // Saturação por Al m%
  return { ca, mg, al, hAl, kCmolc: kc, sb, ctc, ctcEfetiva, v, m };
}

// ── Classes de interpretação (faixas CFSEMG/Embrapa, aproximadas) ─────────────
const faixa = (valor, cortes, rotulos) => {
  if (valor == null) return null;
  for (let i = 0; i < cortes.length; i++) if (valor <= cortes[i]) return rotulos[i];
  return rotulos[rotulos.length - 1];
};

export const classificarP   = (p)  => faixa(num(p),  [6, 12, 20, 40], ['Muito Baixo', 'Baixo', 'Médio', 'Bom', 'Muito Bom']); // mg/dm³ (resina)
export const classificarK   = (k)  => faixa(num(k),  [25, 40, 80, 120], ['Muito Baixo', 'Baixo', 'Médio', 'Bom', 'Muito Bom']); // mg/dm³
export const classificarCa  = (ca) => faixa(num(ca), [1.5, 4.0], ['Baixo', 'Médio', 'Bom']); // cmolc
export const classificarMg  = (mg) => faixa(num(mg), [0.5, 1.0], ['Baixo', 'Médio', 'Bom']); // cmolc
export const classificarMO  = (mo) => faixa(num(mo), [15, 30], ['Baixo', 'Médio', 'Bom']);   // g/dm³
export const classificarZn  = (zn) => faixa(num(zn), [0.6, 1.2], ['Baixo', 'Médio', 'Alto']); // mg/dm³
export const classificarV   = (v)  => faixa(v,       [25, 50, 70], ['Muito Baixo', 'Baixo', 'Bom', 'Alto']); // %
export const classificarAlSat = (m) => faixa(m,      [15, 30, 50], ['Baixo', 'Moderado', 'Alto', 'Muito Alto']); // %
export const classificarPh  = (ph) => faixa(num(ph), [4.4, 5.0, 5.5, 6.0], ['Muito Ácido', 'Ácido', 'Médio Ácido', 'Bom', 'Alcalino']);

// ── Metas de saturação por bases (V2) e faixa de pH ideal por cultura ─────────
export const METAS_CULTURA = {
  acerola: { v2: 65, phIdeal: '5,5–6,0' },
  abacaxi: { v2: 55, phIdeal: '4,5–5,5' },
  _perene: { v2: 60, phIdeal: '5,5–6,5' },
  _anual:  { v2: 70, phIdeal: '6,0–7,0' },
};

export function metaCultura(cultura) {
  if (!cultura) return METAS_CULTURA._anual;
  if (METAS_CULTURA[cultura.id]) return METAS_CULTURA[cultura.id];
  return cultura.tipoCultura === 'perene' ? METAS_CULTURA._perene : METAS_CULTURA._anual;
}

/**
 * Necessidade de calagem pelo método V%. Retorna t/ha (computada e adotada).
 * NC = CTC × (V2 − V1) / PRNT. Adotada = arredonda para cima a 0,1 t/ha.
 */
export function calcularCalagem({ ctc, v, v2, prnt = 80 }) {
  if (!ctc || v >= v2) return { computada: 0, adotada: 0 };
  const computada = (ctc * (v2 - v)) / prnt;
  // Adotada: arredonda ao 0,1 t/ha mais próximo (padrão agronômico prático).
  const adotada = Math.round(computada * 10) / 10;
  return { computada: Math.round(computada * 100) / 100, adotada };
}

/** Interpretação técnica completa + diagnóstico textual. */
export function interpretarSolo(analiseRaw, cultura) {
  const a = analiseRaw || {};
  const idx = derivarIndices(a);
  const meta = metaCultura(cultura);
  const classes = {
    ph: classificarPh(a.ph),
    p: classificarP(a.p),
    k: classificarK(a.k),
    ca: classificarCa(a.ca),
    mg: classificarMg(a.mg),
    mo: classificarMO(a.mo),
    zn: a.zn != null ? classificarZn(a.zn) : null,
    v: classificarV(idx.v),
    alSat: classificarAlSat(idx.m),
  };

  const textura = num(a.argila) != null
    ? (a.argila <= 15 ? 'Arenoso' : a.argila <= 35 ? 'Médio (franco)' : 'Argiloso')
    : null;

  const diagnostico = [];
  const ph = num(a.ph);
  if (ph != null && ph < 5.5)
    diagnostico.push(`Solo ácido (pH ${ph.toString().replace('.', ',')}). A acidez libera Al³⁺ e reduz a disponibilidade de P — a calagem é prioritária.`);
  if (idx.m > 20)
    diagnostico.push(`Saturação por alumínio em ${idx.m.toFixed(1)}% (acima de 20% = toxicidade): o Al³⁺ encurta as raízes. A calagem elimina a toxidez.`);
  if (classes.p === 'Muito Baixo' || classes.p === 'Baixo')
    diagnostico.push(`Fósforo ${classes.p.toLowerCase()} (${num(a.p)} mg/dm³): exige fosfatagem de correção — sempre 30 dias APÓS a calagem.`);
  if (classes.mg === 'Baixo')
    diagnostico.push('Magnésio baixo: usar calcário DOLOMÍTICO (fornece Ca e Mg juntos); o calcítico não corrige o Mg.');
  if (classes.k === 'Baixo' || classes.k === 'Muito Baixo')
    diagnostico.push('Potássio baixo: reforçar e parcelar o K nas coberturas (lixivia fácil em solo arenoso).');
  if (classes.zn === 'Baixo')
    diagnostico.push('Zinco baixo: aplicar sulfato de zinco (ZnSO₄) junto ao fósforo antes do plantio.');
  if (classes.mo === 'Baixo' && textura === 'Arenoso')
    diagnostico.push('Matéria orgânica baixa em solo arenoso: incorporar orgânicos (esterco/composto) na cova/área.');
  if (idx.v >= meta.v2)
    diagnostico.push(`Saturação por bases (V% ${idx.v.toFixed(1)}%) já atende a meta da cultura (${meta.v2}%): calagem dispensável neste momento.`);

  return { indices: idx, classes, textura, meta, diagnostico };
}

// ── Helpers de dose ───────────────────────────────────────────────────────────
const dosePorClasseP_g   = { 'Muito Baixo': 500, 'Baixo': 350, 'Médio': 200, 'Bom': 0, 'Muito Bom': 0 };       // SSP g/cova (perene)
const dosePorClasseP_kgha = { 'Muito Baixo': 500, 'Baixo': 350, 'Médio': 200, 'Bom': 0, 'Muito Bom': 0 };      // SSP kg/ha (área)
const dosePorClasseK_g   = { 'Muito Baixo': 120, 'Baixo': 100, 'Médio': 80, 'Bom': 60, 'Muito Bom': 40 };       // KCl g/cova base
const fmtG = (g) => `${Math.round(g)} g`;
const fmtKg = (kg) => `${Math.round(kg)} kg`;

/**
 * Monta o plano de calagem + adubação a partir da análise e da cultura.
 * Retorna { precisaCalagem, calagem, fosfatagem, cova, coberturas, zinco,
 *           diagnostico, resumo, etapas } onde cada etapa tem `offset` (DAP
 *           relativo ao plantio no campo; negativo = antes do plantio).
 */
export function montarPlanoAdubacao({ analise, cultura, lote }) {
  if (!analise || !cultura) return null;
  const a = analise;
  const interp = interpretarSolo(a, cultura);
  const { indices: idx, classes, meta } = interp;
  const prnt = num(a.prnt) || 80;
  const perene = cultura.tipoCultura === 'perene';

  const calagem = calcularCalagem({ ctc: idx.ctc, v: idx.v, v2: meta.v2, prnt });
  const precisaCalagem = calagem.adotada > 0;
  const dolomitico = classes.mg === 'Baixo' || num(a.mg) < 0.8;
  const tipoCalcario = dolomitico ? 'Calcário Dolomítico' : 'Calcário Calcítico';
  const phAcido = (num(a.ph) ?? 7) < 5.5;

  const etapas = [];
  const resumo = [];

  // ── 1) Calagem em área total (D-60) ────────────────────────────────────────
  if (precisaCalagem) {
    const kgPorMil = Math.round(calagem.adotada * 100); // kg / 1.000 m²
    etapas.push({
      offset: -60, fase: 'Correção', tipo: 'adubo',
      etapa: 'Calagem (correção da acidez)',
      produto: tipoCalcario,
      dose: `${calagem.adotada.toString().replace('.', ',')} t/ha (${kgPorMil} kg/1.000 m²)`,
      forma: `Distribuir a lanço em área total e incorporar com grade a 15–20 cm. PRNT ≥ 70%. Mínimo 45–60 dias antes do plantio. NÃO aplicar junto do superfosfato.`,
      descricao: `Calagem pelo método da Saturação por Bases (Embrapa): NC = CTC × (V2 − V1) / PRNT = ${idx.ctc.toFixed(2)} × (${meta.v2} − ${idx.v.toFixed(1)}) / ${prnt} = ${calagem.computada.toString().replace('.', ',')} t/ha → adotar ${calagem.adotada.toString().replace('.', ',')} t/ha. ${dolomitico ? 'Dolomítico para corrigir também o magnésio.' : ''} Eleva o pH, neutraliza o alumínio tóxico e fornece Ca${dolomitico ? ' + Mg' : ''}.`,
    });
    resumo.push({ produto: tipoCalcario, total: `${calagem.adotada.toString().replace('.', ',')} t/ha`, momento: 'D-60 (área total)' });
  }

  // ── 2) Fosfatagem de correção (D-30) — após a calagem ──────────────────────
  const precisaFosfatagem = classes.p === 'Muito Baixo' || classes.p === 'Baixo' || classes.p === 'Médio';
  if (precisaFosfatagem && !perene) {
    const sspKgHa = dosePorClasseP_kgha[classes.p] || 0;
    if (sspKgHa > 0) {
      const zn = classes.zn === 'Baixo' ? ' + 5 kg/ha de ZnSO₄ (zinco baixo)' : '';
      etapas.push({
        offset: -30, fase: 'Correção', tipo: 'adubo',
        etapa: 'Fosfatagem de correção de área',
        produto: 'Superfosfato Simples (SSP 18%)' + (zn ? ' + ZnSO₄' : ''),
        dose: `${sspKgHa} kg/ha de SSP${zn}`,
        forma: 'Distribuir a lanço e incorporar com grade antes do plantio. No mínimo 30 dias APÓS a calagem (o Ca bloqueia o P).',
        descricao: `Fósforo ${classes.p.toLowerCase()} (${num(a.p)} mg/dm³). Em solo recém-corrigido, o P fica disponível; antes da calagem mais de 60% seria fixado por Fe/Al.`,
      });
      resumo.push({ produto: 'SSP 18% (área)', total: `${sspKgHa} kg/ha`, momento: 'D-30' });
    }
  }

  // ── 3) Adubação de cova (perenes) — D-30 ───────────────────────────────────
  if (perene) {
    const ssp = dosePorClasseP_g[classes.p] || 0;
    const kcl = dosePorClasseK_g[classes.k] || 80;
    const znTxt = classes.zn === 'Baixo' ? ' + 5 g ZnSO₄' : '';
    const partes = [];
    if (ssp > 0) partes.push(`${fmtG(ssp)} SSP 18%`);
    partes.push(`${fmtG(kcl)} KCl 60%`);
    partes.push('5 kg cama de aves curtida (ou 10–15 L esterco bovino curtido)');
    partes.push('4 kg composto orgânico maturado');
    etapas.push({
      offset: -30, fase: 'Correção', tipo: 'adubo',
      etapa: 'Adubação de cova (base)',
      produto: 'SSP + KCl + orgânico' + znTxt,
      dose: partes.join(' + ') + znTxt,
      forma: 'Abrir cova de 0,50×0,50×0,50 m. Misturar TODOS os insumos ao solo retirado, recolocar e aguardar 30 dias antes de plantar. Nunca concentrar adubo em contato com a raiz. Orgânico só bem curtido (≥ 60 dias).',
      descricao: `Cova rica é decisiva para um perene de vida longa. Fósforo ${classes.p?.toLowerCase() || '—'} e potássio ${classes.k?.toLowerCase() || '—'} ajustados à análise. ${classes.zn === 'Baixo' ? 'Zinco baixo: incluir ZnSO₄ na cova.' : ''}`,
    });
    if (ssp > 0) resumo.push({ produto: 'SSP 18% (cova)', total: `${fmtG(ssp)}/cova`, momento: 'D-30' });
    resumo.push({ produto: 'KCl 60% (cova)', total: `${fmtG(kcl)}/cova`, momento: 'D-30' });
    resumo.push({ produto: 'Orgânico (cova)', total: '5 kg cama de aves + 4 kg composto', momento: 'D-30' });
  }

  // ── 4) Coberturas parceladas (N + K) ───────────────────────────────────────
  const coberturas = montarCoberturas({ cultura, classes, phAcido, perene });
  coberturas.forEach((c) => {
    etapas.push({
      offset: c.offset, fase: 'Cobertura', tipo: 'adubo',
      etapa: c.etapa,
      produto: c.produto,
      dose: c.dose,
      forma: c.forma,
      descricao: c.descricao,
    });
  });

  // ── 5) Nova análise em 12 meses ────────────────────────────────────────────
  etapas.push({
    offset: 365, fase: 'Monitoramento', tipo: 'manejo',
    etapa: 'Nova análise de solo (12 meses)',
    produto: '—', dose: '—',
    forma: 'Coletar nova amostra e repetir o painel (incluir micronutrientes B, Cu, Fe, Mn). Ajustar recalagem e manutenção conforme o resultado.',
    descricao: 'O monitoramento anual mantém o solo na faixa ideal. Solos arenosos perdem bases rápido — a recalagem costuma ser necessária.',
  });

  // resumo de coberturas (agregado)
  resumo.push(...resumoCoberturas(coberturas, phAcido));

  return {
    precisaCalagem, calagem, tipoCalcario, dolomitico,
    fosfatagem: precisaFosfatagem,
    perene, phAcido,
    diagnostico: interp.diagnostico,
    interpretacao: interp,
    coberturas,
    resumo,
    etapas: etapas.sort((x, y) => x.offset - y.offset),
  };
}

/** Esquema de coberturas N+K conforme cultura (perene = laudo; anual = genérico). */
function montarCoberturas({ cultura, classes, phAcido, perene }) {
  const ajusteK = classes.k === 'Baixo' || classes.k === 'Muito Baixo' ? 1.25
    : classes.k === 'Bom' || classes.k === 'Muito Bom' ? 0.8 : 1.0;
  const nFonte = (ordem) => (ordem >= 2 && phAcido)
    ? { nome: 'Sulfato de Amônio (21% N)', sigla: 'SA' }
    : { nome: 'Ureia (45% N)', sigla: 'Ureia' };
  const obsSA = phAcido
    ? ' Em solo ácido, o Sulfato de Amônio (a partir da 2ª cobertura) perde 3–5× menos N que a ureia e fornece enxofre.'
    : '';

  if (cultura.id === 'acerola') {
    return [
      cobPlanta(1, 30,  nFonte(1), 30, 25 * ajusteK, '15–20 cm', obsSA),
      cobPlanta(2, 75,  nFonte(2), 70, 40 * ajusteK, '25–30 cm', obsSA),
      cobPlanta(3, 135, nFonte(3), 90, 50 * ajusteK, '35–45 cm', obsSA),
      cobPlanta(4, 195, nFonte(4), 90, 50 * ajusteK, '50–60 cm', obsSA),
    ];
  }
  if (cultura.id === 'abacaxi') {
    // Abacaxi: aplicação no sulco/axila; sem cova. Reduz N e eleva K na pré-floração.
    return [
      cobAxila(1, 0,   { nome: 'Ureia (45% N)', sigla: 'Ureia' }, 15, 25 * ajusteK, 'Sulco de plantio, 3–5 cm abaixo da muda'),
      cobAxila(2, 60,  { nome: 'Ureia (45% N)', sigla: 'Ureia' }, 30, 30 * ajusteK, 'Foliar (sol. 2% ureia) ou na axila das folhas basais'),
      cobAxila(3, 120, { nome: 'Ureia (45% N)', sigla: 'Ureia' }, 30, 32 * ajusteK, 'Solo na base ou foliar — manhã cedo'),
      cobAxila(4, 180, { nome: 'Ureia (45% N)', sigla: 'Ureia' }, 20, 38 * ajusteK, 'Pré-florescimento: reduzir N e elevar K (açúcar + tamanho do fruto)'),
    ];
  }

  // ── Genérico ───────────────────────────────────────────────────────────────
  // N total/ha da cultura (insumos.ureia.padrao) parcelado; K conforme classe.
  const nKgHa = (cultura.insumos?.ureia?.padrao) || (perene ? 90 : 120);
  const baseDias = (cultura.cronograma || []).filter(e => e.tipo === 'adubo').map(e => e.dia);
  const dias = baseDias.length >= 2 ? baseDias
    : perene ? [30, 120, 210] : [15, 35];
  const n = dias.length;
  const kKgHaTotal = ((cultura.insumos?.sulfatoPotassio?.padrao) || (perene ? 150 : 80)) * ajusteK;
  return dias.map((dia, i) => {
    const fonte = nFonte(i + 1);
    const nDose = nKgHa / n;
    const kDose = kKgHaTotal / n;
    return {
      ordem: i + 1, offset: dia,
      etapa: `${i + 1}ª Cobertura (solo) — ${fonte.sigla} + K`,
      produto: `${fonte.nome} + Cloreto de Potássio (KCl 60%)`,
      dose: `${fmtKg(nDose)} ${fonte.sigla}/ha + ${fmtKg(kDose)} KCl/ha`,
      forma: 'Aplicar em cobertura, parcelado, e irrigar logo após. Em solo arenoso nunca aplicar a dose toda de uma vez (lixivia/queima).',
      descricao: `Parcelamento da adubação de cobertura ajustado à análise (K ${classes.k?.toLowerCase() || '—'}).${(i + 1) >= 2 && phAcido ? ' Sulfato de Amônio em vez de ureia por causa da acidez.' : ''}`,
    };
  });
}

function cobPlanta(ordem, offset, fonte, nG, kG, dist, obsSA) {
  return {
    ordem, offset,
    etapa: `${ordem}ª Cobertura — ${fonte.sigla} + KCl`,
    produto: `${fonte.nome} + Cloreto de Potássio (KCl 60%)`,
    dose: `${fmtG(nG)} ${fonte.sigla} + ${fmtG(kG)} KCl / planta`,
    forma: `Aplicar em coroa na projeção da copa, a ${dist} do caule, e irrigar após. Nunca sobre o caule ou as folhas.`,
    descricao: `Cobertura parcelada (solo arenoso lixivia). Distância do caule cresce com a idade da planta.${obsSA}`,
  };
}
function cobAxila(ordem, offset, fonte, nG, kG, modo) {
  return {
    ordem, offset,
    etapa: `${ordem === 1 ? 'Plantio' : `${ordem}ª Cobertura`} — ${fonte.sigla} + KCl`,
    produto: `${fonte.nome} + Cloreto de Potássio (KCl 60%)`,
    dose: `${fmtG(nG)} ${fonte.sigla} + ${fmtG(kG)} KCl / planta`,
    forma: modo,
    descricao: 'O abacaxi absorve bem N por via foliar/axilar. Na pré-floração reduz-se o N e eleva-se o K para tamanho e açúcar do fruto.',
  };
}

function resumoCoberturas(coberturas, phAcido) {
  return coberturas.map((c) => ({
    produto: c.produto.split(' + ')[0],
    total: c.dose,
    momento: `D+${c.offset}`,
  }));
}
