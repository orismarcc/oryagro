/**
 * cronograma/helpers.js — constantes e funções puras do CronogramaTimeline.
 * Extraídas sem alterar a lógica (apenas movidas para reduzir o arquivo).
 */
import { makeStableId } from '../../hooks/useCronogramaSync';

export const TIPO_META = {
  plantio:   { color: '#059669', bg: 'hsl(152 69% 93%)', label: 'Plantio',   emoji: '🌱' },
  adubo:     { color: '#d97706', bg: 'hsl(43 96% 93%)',  label: 'Adubação',  emoji: '🧪' },
  foliar:    { color: '#2563eb', bg: 'hsl(221 90% 95%)', label: 'Foliar',    emoji: '💧' },
  colheita:  { color: '#dc2626', bg: 'hsl(4 80% 94%)',   label: 'Colheita',  emoji: '🌾' },
  manejo:    { color: '#7c3aed', bg: 'hsl(263 80% 95%)', label: 'Manejo',    emoji: '🔧' },
  especial:  { color: '#db2777', bg: 'hsl(322 75% 95%)', label: 'Especial',  emoji: '⭐' },
  aplicacao: { color: '#7c3aed', bg: 'hsl(263 80% 95%)', label: 'Aplicação', emoji: '🌿' },
};
export const TIPOS = Object.keys(TIPO_META);

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const formatDate = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

// Add `dia` days to a date_plantio string, returns a Date
export function stepDate(datePlantio, dia) {
  const d = new Date(datePlantio + 'T12:00:00');
  d.setDate(d.getDate() + dia);
  return d;
}

export function formatStepDate(datePlantio, dia) {
  const d = stepDate(datePlantio, dia);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function migrateLegacyStatus(stored, vivSteps, baseSteps) {
  // O-01: skip migration if already done (flag set on previous run)
  if (stored._migrated) return stored;
  let changed = false;
  const migrated = {};

  Object.entries(stored).forEach(([oldId, val]) => {
    const legacyMatch = oldId.match(/^(viveiro|default)_(\d+)$/);
    if (!legacyMatch) {
      migrated[oldId] = val;
      return;
    }
    const prefix = legacyMatch[1];
    const idx    = parseInt(legacyMatch[2], 10);
    const steps  = prefix === 'viveiro' ? vivSteps : baseSteps;
    if (steps[idx]) {
      const newId = makeStableId(prefix, steps[idx].etapa);
      migrated[newId] = val;
      if (newId !== oldId) changed = true;
    }
  });

  // O-01: stamp _migrated flag so future mounts skip this loop
  if (changed) {
    migrated._migrated = true;
    return migrated;
  }
  // Also stamp on existing stored object so we skip next time
  stored._migrated = true;
  return stored;
}

// Extract the first numeric value from a dose string ("500 mL" → "500", "2,5 L" → "2.5")
export function parseNumericDose(doseStr) {
  if (!doseStr || doseStr === '—') return '';
  const match = doseStr.replace(',', '.').match(/(\d+(?:\.\d+)?)/);
  return match ? match[1] : '';
}

// Scale numeric values in a dose string by a factor
export function scaleDose(doseStr, fator) {
  if (!doseStr || doseStr === '—' || Math.abs(fator - 1) < 0.02) return doseStr;
  return doseStr.replace(/(\d+(?:[.,]\d+)?)/g, (match) => {
    const num = parseFloat(match.replace(',', '.'));
    if (isNaN(num)) return match;
    const scaled = Math.round(num * fator);
    return scaled.toString();
  });
}

// Convert ISO date string to Date object (treating as local noon to avoid timezone offset issues)
export function isoToDate(iso) {
  if (!iso) return null;
  return new Date(iso + 'T12:00:00');
}

// Convert Date to ISO yyyy-mm-dd
export function dateToISO(d) {
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
