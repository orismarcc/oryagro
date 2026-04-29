/**
 * Fonte única de verdade para preços e custos padrão — médias MT 2024/2025
 * Importar este módulo em: useSimulador.js, SimuladorFinanceiro.jsx,
 *                          LotePage.jsx, ComparacaoCulturas.jsx
 */

// ── Preços de insumos (R$/kg ou R$/m²) ──────────────────────────────────────
// Referências: IMEA, CONAB, Cooperativas MT (jan-abr 2025)

export const PRECOS_INSUMOS = {
  calcareo:   0.25,   // Calcário dolomítico a granel: R$200–300/t
  estercoCampo:   0.08,   // Esterco bovino granel: ~R$80/t
  estercoCanteiro: 0.20,  // Esterco curtido/compostado: ~R$200/t
  npkCampo:   2.80,   // NPK formulado a granel/safra: ~R$2.800/t
  npkCanteiro: 3.50,  // NPK saco 25 kg varejo: ~R$3.500/t
  ureia:      3.00,   // Ureia 46%: R$2.500–3.200/t
  nitratoCalcio: 5.00, // Nitrato de Cálcio: R$4.000–6.000/t
  mulching:   2.00,   // Mulching plástico 30 µm: R$1,80–2,50/m²
  fte:        15.00,  // FTE BR-12 micronutrientes
};

// ── Custos operacionais por cultura — médias MT 2024/2025 ────────────────────
// Canteiro: por canteiro (20×1,6 m) por ciclo
// Campo: por ha por ciclo completo

export const OP_COSTS = {
  // canteiro (R$/canteiro/ciclo)
  alface:    { transporte: 8,    embalagem: 12,  defensivos: 15,   energia: 15 },
  cebolinha: { transporte: 6,    embalagem: 10,  defensivos: 8,    energia: 12 },
  coentro:   { transporte: 6,    embalagem: 10,  defensivos: 8,    energia: 10 },
  rucula:    { transporte: 6,    embalagem: 10,  defensivos: 8,    energia: 10 },
  couve:     { transporte: 12,   embalagem: 15,  defensivos: 20,   energia: 18 },
  // campo (R$/ha/ciclo)
  quiabo:        { transporte: 600,  embalagem: 400, defensivos: 800,  energia: 400 },
  mandioca:      { transporte: 500,  embalagem: 150, defensivos: 300,  energia: 150 },
  abacaxi:       { transporte: 1200, embalagem: 800, defensivos: 1500, energia: 500 },
  acerola:       { transporte: 800,  embalagem: 500, defensivos: 600,  energia: 400 },
  banana_ana:    { transporte: 800,  embalagem: 400, defensivos: 700,  energia: 500 },
  // Mamão Tainung 01 — defensivos altos por mosca-das-frutas (programa intensivo)
  mamao_tainung: { transporte: 1000, embalagem: 600, defensivos: 1500, energia: 500 },
};

// Fallbacks quando a cultura não está no OP_COSTS
const OP_FALLBACK_CAMPO    = { transporte: 500, embalagem: 300, defensivos: 500, energia: 300 };
const OP_FALLBACK_CANTEIRO = { transporte: 8,   embalagem: 12,  defensivos: 15,  energia: 12  };

/**
 * Retorna os custos operacionais padrão para uma cultura.
 * @param {string} culturaId
 * @param {boolean} isCampo
 * @returns {{ transporte, embalagem, defensivos, energia }}
 */
export function getOpCosts(culturaId, isCampo) {
  return OP_COSTS[culturaId] ?? (isCampo ? OP_FALLBACK_CAMPO : OP_FALLBACK_CANTEIRO);
}

/**
 * Retorna todos os preços de insumos padrão resolvidos para o tipo da cultura.
 * @param {boolean} isCampo
 * @returns {object}
 */
export function getPrecosPadrao(isCampo) {
  return {
    precoCalcareo:  PRECOS_INSUMOS.calcareo,
    precoEsterco:   isCampo ? PRECOS_INSUMOS.estercoCampo : PRECOS_INSUMOS.estercoCanteiro,
    precoNPK:       isCampo ? PRECOS_INSUMOS.npkCampo     : PRECOS_INSUMOS.npkCanteiro,
    precoUreia:     PRECOS_INSUMOS.ureia,
    precoNitratoCa: PRECOS_INSUMOS.nitratoCalcio,
    precoMulching:  PRECOS_INSUMOS.mulching,
  };
}
