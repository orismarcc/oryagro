/**
 * cropYields.js — Default annual yield constants per crop.
 *
 * Each entry defines the expected production at full maturity.
 * Used by AnalysePage to project kg/year per lot.
 *
 * unit:
 *   'per_plant'   → yieldValue in kg/plant/year
 *   'per_hectare' → yieldValue in kg/ha/year
 *
 * safrasAno: number of harvests per year at full maturity (perennials)
 */
export const CROP_YIELDS = {
  acerola: {
    cropName: 'Acerola',
    unit: 'per_plant',
    defaultYieldValue: 40,       // kg/plant/year at full maturity
    yieldRangeMin: 20,
    yieldRangeMax: 50,
    safrasAno: 3,                // ~3 flushes/year
    source: 'Embrapa Semiárido, 2022 — Malpighia emarginata',
  },
  banana: {
    cropName: 'Banana',
    unit: 'per_hectare',
    defaultYieldValue: 25_000,   // kg/ha/year
    yieldRangeMin: 15_000,
    yieldRangeMax: 35_000,
    safrasAno: 1,
    source: 'Embrapa Mandioca e Fruticultura, 2022',
  },
  mamao: {
    cropName: 'Mamão',
    unit: 'per_hectare',
    defaultYieldValue: 80_000,   // kg/ha/year
    yieldRangeMin: 60_000,
    yieldRangeMax: 120_000,
    safrasAno: 1,
    source: 'Embrapa Mandioca e Fruticultura, 2022',
  },
  abacaxi: {
    cropName: 'Abacaxi',
    unit: 'per_hectare',
    defaultYieldValue: 40_000,   // kg/ha/year
    yieldRangeMin: 25_000,
    yieldRangeMax: 60_000,
    safrasAno: 1,
    source: 'Embrapa Mandioca e Fruticultura, 2022',
  },
  maracuja: {
    cropName: 'Maracujá',
    unit: 'per_hectare',
    defaultYieldValue: 20_000,   // kg/ha/year
    yieldRangeMin: 15_000,
    yieldRangeMax: 30_000,
    safrasAno: 1,
    source: 'Embrapa Cerrados, 2022',
  },
  alface: {
    cropName: 'Alface',
    unit: 'per_hectare',
    defaultYieldValue: 30_000,   // kg/ha/year (múltiplos ciclos)
    yieldRangeMin: 20_000,
    yieldRangeMax: 40_000,
    safrasAno: 6,
    source: 'Embrapa Hortaliças, 2022',
  },
  coentro: {
    cropName: 'Coentro',
    unit: 'per_hectare',
    defaultYieldValue: 12_000,
    yieldRangeMin: 8_000,
    yieldRangeMax: 18_000,
    safrasAno: 5,
    source: 'Embrapa Hortaliças, 2022',
  },
  rucula: {
    cropName: 'Rúcula',
    unit: 'per_hectare',
    defaultYieldValue: 15_000,
    yieldRangeMin: 10_000,
    yieldRangeMax: 22_000,
    safrasAno: 6,
    source: 'Embrapa Hortaliças, 2022',
  },
  mandioca: {
    cropName: 'Mandioca',
    unit: 'per_hectare',
    defaultYieldValue: 16_000,   // kg/ha/ano (raiz)
    yieldRangeMin: 14_000,
    yieldRangeMax: 20_000,
    safrasAno: 1,
    source: 'Embrapa Mandioca e Fruticultura, 2022',
  },
  feijao: {
    cropName: 'Feijão',
    unit: 'per_hectare',
    defaultYieldValue: 1_800,
    yieldRangeMin: 1_200,
    yieldRangeMax: 2_500,
    safrasAno: 2,
    source: 'Embrapa Arroz e Feijão, 2022',
  },
  milho: {
    cropName: 'Milho',
    unit: 'per_hectare',
    defaultYieldValue: 9_000,
    yieldRangeMin: 8_000,
    yieldRangeMax: 12_000,
    safrasAno: 1,
    source: 'Embrapa Milho e Sorgo, 2022',
  },
  soja: {
    cropName: 'Soja',
    unit: 'per_hectare',
    defaultYieldValue: 3_100,
    yieldRangeMin: 2_800,
    yieldRangeMax: 3_500,
    safrasAno: 1,
    source: 'Embrapa Soja, 2022',
  },
};

/**
 * Get yield config for a culturaId. Returns null if not found.
 * @param {string} culturaId
 * @returns {{ unit, defaultYieldValue, safrasAno, source, ... } | null}
 */
export function getYieldConfig(culturaId) {
  return CROP_YIELDS[culturaId] ?? null;
}

/**
 * Estimate annual kg production for a lote at a given maturity factor (0.0–1.0).
 *
 * @param {object} lote        DB row
 * @param {string} culturaId
 * @param {number} factor      Ramp-up factor for this year (0–1)
 * @returns {{ kg: number, hasConfig: boolean }}
 */
export function estimateKgAnual(lote, culturaId, factor) {
  const cfg = getYieldConfig(culturaId);
  if (!cfg || factor <= 0) return { kg: 0, hasConfig: !!cfg };

  let fullKg = 0;
  if (cfg.unit === 'per_plant') {
    const plantas = parseInt(lote.total_plantas, 10) || 0;
    fullKg = plantas * cfg.defaultYieldValue * (cfg.safrasAno ?? 1);
  } else {
    const areaHa = parseFloat(lote.area_ha) || 0;
    fullKg = areaHa * cfg.defaultYieldValue * (cfg.safrasAno ?? 1);
  }

  return { kg: Math.round(fullKg * factor), hasConfig: true };
}
