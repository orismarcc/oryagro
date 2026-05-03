/**
 * cropYields.js — Default annual yield constants per crop.
 *
 * UNIT SEMANTICS:
 *   'per_plant'   → defaultYieldValue = kg/plant/YEAR at full maturity (annual total, all flushes)
 *   'per_hectare' → defaultYieldValue = kg/ha/YEAR at full maturity (annual total, all cycles)
 *
 * NOTE: safrasAno is informational only (flushes or cycles per year) and is NOT
 * multiplied in production formulas — defaultYieldValue already represents the ANNUAL total.
 */
export const CROP_YIELDS = {
  acerola: {
    cropName: 'Acerola',
    unit: 'per_plant',
    defaultYieldValue: 40,        // kg/plant/year at full maturity (all 3 flushes combined)
    yieldRangeMin: 30,            // kg/plant/year minimum
    yieldRangeMax: 50,            // kg/plant/year maximum
    safrasAno: 3,                 // informational: ~3 flushes/year (already included in 40 kg)
    // Cross-validation range (non-blocking): implied kg/ha should fall within this range at peak
    peakYieldPerHectare: { min: 30_000, max: 40_000 },
    source: 'Embrapa Cerrados / literatura técnica de acerola',
  },
  banana: {
    cropName: 'Banana',
    unit: 'per_hectare',
    defaultYieldValue: 25_000,    // kg/ha/year
    yieldRangeMin: 15_000,
    yieldRangeMax: 35_000,
    safrasAno: 1,
    source: 'Embrapa Mandioca e Fruticultura, 2022',
  },
  mamao: {
    cropName: 'Mamão',
    unit: 'per_hectare',
    defaultYieldValue: 80_000,    // kg/ha/year
    yieldRangeMin: 60_000,
    yieldRangeMax: 120_000,
    safrasAno: 1,
    source: 'Embrapa Mandioca e Fruticultura, 2022',
  },
  abacaxi: {
    cropName: 'Abacaxi',
    unit: 'per_hectare',
    defaultYieldValue: 40_000,    // kg/ha/year
    yieldRangeMin: 25_000,
    yieldRangeMax: 60_000,
    safrasAno: 1,
    source: 'Embrapa Mandioca e Fruticultura, 2022',
  },
  goiaba: {
    cropName: 'Goiaba',
    unit: 'per_hectare',
    defaultYieldValue: 30_000,    // kg/ha/year at full maturity
    yieldRangeMin: 20_000,
    yieldRangeMax: 40_000,
    safrasAno: 2,                 // informational: 2 flushes/year
    source: 'Embrapa Mandioca e Fruticultura, 2022',
  },
  maracuja: {
    cropName: 'Maracujá',
    unit: 'per_hectare',
    defaultYieldValue: 20_000,    // kg/ha/year
    yieldRangeMin: 15_000,
    yieldRangeMax: 30_000,
    safrasAno: 1,
    source: 'Embrapa Cerrados, 2022',
  },
  alface: {
    cropName: 'Alface',
    unit: 'per_hectare',
    defaultYieldValue: 30_000,    // kg/ha/year (6 ciclos × ~5 000 kg/ha/ciclo)
    yieldRangeMin: 20_000,
    yieldRangeMax: 40_000,
    safrasAno: 6,                 // informational: 6 cycles/year (already in defaultYieldValue)
    source: 'Embrapa Hortaliças, 2022',
  },
  coentro: {
    cropName: 'Coentro',
    unit: 'per_hectare',
    defaultYieldValue: 12_000,    // kg/ha/year
    yieldRangeMin: 8_000,
    yieldRangeMax: 18_000,
    safrasAno: 5,
    source: 'Embrapa Hortaliças, 2022',
  },
  rucula: {
    cropName: 'Rúcula',
    unit: 'per_hectare',
    defaultYieldValue: 15_000,    // kg/ha/year
    yieldRangeMin: 10_000,
    yieldRangeMax: 22_000,
    safrasAno: 6,
    source: 'Embrapa Hortaliças, 2022',
  },
  mandioca: {
    cropName: 'Mandioca',
    unit: 'per_hectare',
    defaultYieldValue: 16_000,    // kg/ha/year (raiz)
    yieldRangeMin: 14_000,
    yieldRangeMax: 20_000,
    safrasAno: 1,
    source: 'Embrapa Mandioca e Fruticultura, 2022',
  },
  feijao: {
    cropName: 'Feijão',
    unit: 'per_hectare',
    defaultYieldValue: 1_800,     // kg/ha/year
    yieldRangeMin: 1_200,
    yieldRangeMax: 2_500,
    safrasAno: 2,
    source: 'Embrapa Arroz e Feijão, 2022',
  },
  milho: {
    cropName: 'Milho',
    unit: 'per_hectare',
    defaultYieldValue: 9_000,     // kg/ha/year
    yieldRangeMin: 8_000,
    yieldRangeMax: 12_000,
    safrasAno: 1,
    source: 'Embrapa Milho e Sorgo, 2022',
  },
  soja: {
    cropName: 'Soja',
    unit: 'per_hectare',
    defaultYieldValue: 3_100,     // kg/ha/year
    yieldRangeMin: 2_800,
    yieldRangeMax: 3_500,
    safrasAno: 1,
    source: 'Embrapa Soja, 2022',
  },
};

/**
 * Get yield config for a culturaId. Returns null if not found.
 * @param {string} culturaId
 */
export function getYieldConfig(culturaId) {
  return CROP_YIELDS[culturaId] ?? null;
}

/**
 * Determine the production calculation basis for a lote.
 *
 * Priority order (per FIX 11A):
 *   1. plant count  (per_plant crops)
 *   2. cultivated area — area_plantada_ha (per_hectare crops)
 *   3. total area   — area_ha (per_hectare crops, fallback)
 *   4. unavailable  → show warning, do not estimate
 *
 * @param {object} lote       DB row from plantios
 * @param {string} culturaId
 * @returns {{ method: 'plants'|'cultivated_area'|'unavailable', value: number, label: string, cfg }}
 */
export function getProductionBase(lote, culturaId) {
  const cfg = getYieldConfig(culturaId);
  if (!cfg) return { method: 'unavailable', value: 0, label: '—', cfg: null };

  if (cfg.unit === 'per_plant') {
    const plantas = parseInt(lote.total_plantas, 10) || 0;
    if (plantas > 0) {
      return {
        method: 'plants',
        value: plantas,
        label: `🌱 ${plantas.toLocaleString('pt-BR')} plantas`,
        cfg,
      };
    }
    // per_plant crop without plant count → unavailable
    return { method: 'unavailable', value: 0, label: '⚠️ sem contagem de plantas', cfg };
  }

  // per_hectare: prefer cultivated area (area_plantada_ha), fallback to area_ha
  const cultivatedHa = parseFloat(lote.area_plantada_ha) || 0;
  if (cultivatedHa > 0) {
    return {
      method: 'cultivated_area',
      value: cultivatedHa,
      label: `📐 ${cultivatedHa.toFixed(2)} ha cultivados`,
      cfg,
    };
  }
  const totalHa = parseFloat(lote.area_ha) || 0;
  if (totalHa > 0) {
    return {
      method: 'cultivated_area',
      value: totalHa,
      label: `📐 ${totalHa.toFixed(2)} ha`,
      cfg,
    };
  }

  return { method: 'unavailable', value: 0, label: '⚠️ sem área cultivada', cfg };
}

/**
 * Estimate annual kg production for a lote at a given maturity factor (0.0–1.0).
 *
 * Uses getProductionBase() priority: plants → cultivated_area → unavailable.
 * NOTE: safrasAno is NOT multiplied — defaultYieldValue is already kg/unit/YEAR.
 *
 * @param {object} lote        DB row
 * @param {string} culturaId
 * @param {number} factor      Ramp-up factor for this year (0–1)
 * @returns {{ kg: number, hasConfig: boolean, method: 'plants'|'cultivated_area'|'unavailable' }}
 */
export function estimateKgAnual(lote, culturaId, factor) {
  const base = getProductionBase(lote, culturaId);

  if (!base.cfg)  return { kg: 0, hasConfig: false, method: 'unavailable' };
  if (base.method === 'unavailable') return { kg: 0, hasConfig: true,  method: 'unavailable' };
  if (factor <= 0) return { kg: 0, hasConfig: true, method: base.method };

  let fullKg = 0;
  if (base.cfg.unit === 'per_plant') {
    // base.value = total_plantas
    fullKg = base.value * base.cfg.defaultYieldValue;
    // Cross-validation for acerola (non-blocking, dev-only)
    if (culturaId === 'acerola' && base.cfg.peakYieldPerHectare) {
      const areaHa = parseFloat(lote.area_ha) || 0;
      if (areaHa > 0) {
        const impliedKgHa = fullKg / areaHa;
        const { min, max } = base.cfg.peakYieldPerHectare;
        if (impliedKgHa < min || impliedKgHa > max) {
          // eslint-disable-next-line no-console
          console.warn(
            `[OryAgro] Acerola yield consistency check failed for lot ${lote.id}: implied ${Math.round(impliedKgHa)} kg/ha is outside expected range [${min}–${max}].`,
          );
        }
      }
    }
  } else {
    // per_hectare: base.value = area in ha
    fullKg = base.value * base.cfg.defaultYieldValue;
  }

  return { kg: Math.round(fullKg * factor), hasConfig: true, method: base.method };
}
