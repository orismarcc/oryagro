/**
 * guia.js — regras puras do Guia técnico da cultura (doses e datas por lote).
 *
 * A dose do guia é exibida SEMPRE como está escrita. O que o app acrescenta é
 * o TOTAL para o lote, e só quando a dose permite calcular com segurança:
 * por planta/cova (× nº de plantas) ou por hectare (× área do lote).
 * Doses por recipiente, por m², por m³ ou concentração de calda ficam sem total.
 */

/** Soma `dias` a uma data ISO, sem cruzar UTC. */
export function somaDias(iso, dias) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const num = (s) => parseFloat(String(s).replace(',', '.'));
const arred = (v) => (v >= 100 ? Math.round(v) : Math.round(v * 10) / 10).toLocaleString('pt-BR');

/** Ajusta unidade para leitura (g→kg, mL→L, kg→t acima de 1000). */
function legivel(valores, un) {
  const max = Math.max(...valores);
  const u = un.toLowerCase();
  if (u === 'g' && max >= 1000) return [valores.map(v => v / 1000), 'kg'];
  if (u === 'ml' && max >= 1000) return [valores.map(v => v / 1000), 'L'];
  if (u === 'kg' && max >= 1000) return [valores.map(v => v / 1000), 't'];
  return [valores, un];
}

/**
 * Total da dose para o lote. Ex.:
 *   "30 g/planta"                    × 440 plantas → "13,2 kg"
 *   "100–200 g NPK por cova"         × 440         → "44–88 kg"
 *   "60 kg/ha de ureia"              × 0,44 ha     → "26,4 kg"
 * Retorna null se a dose não for por planta/cova nem por hectare.
 */
export function totalNoLote(dose, { plantas = 0, areaHa = 0 } = {}) {
  if (!dose) return null;
  const porPlanta = /planta|cova/i.test(dose);
  const porHa = /\/\s*ha\b/i.test(dose);
  const fator = porPlanta ? plantas : porHa ? areaHa : 0;
  if (!fator) return null;

  const partes = [];
  const re = /(\d+(?:[.,]\d+)?)(?:\s*(?:[–-]|a)\s*(\d+(?:[.,]\d+)?))?\s*(kg|g|mL|ml|L|t)\b/g;
  let m;
  while ((m = re.exec(dose)) !== null) {
    const vals = [num(m[1]), ...(m[2] ? [num(m[2])] : [])].filter(Number.isFinite).map(v => v * fator);
    if (!vals.length) continue;
    const [ajust, un] = legivel(vals, m[3]);
    partes.push(`${ajust.map(arred).join('–')} ${un}`);
  }
  return partes.length ? partes.join(' + ') : null;
}

/** Categoria do Anotar que corresponde a uma etapa do guia. */
export function categoriaDaEtapa(e) {
  const txt = `${e.etapa} ${e.forma || ''}`.toLowerCase();
  if (e.tipo === 'colheita') return 'colheita';
  if (e.tipo === 'foliar') return 'adubacao_foliar';
  if (e.tipo === 'aplicacao') return 'defensivo';
  if (e.tipo === 'adubo') return /fertirriga/.test(txt) ? 'fertirrigacao' : 'adubacao_solo';
  if (e.tipo === 'plantio' || /transplant|plantio|semeadura|estaca/.test(txt)) return 'plantio';
  if (/irriga/.test(txt)) return 'irrigacao';
  if (/poda|desbrota|condu|desponte|capa/.test(txt)) return 'poda';
  if (/capina|ro[cç]ada|calag|solo/.test(txt)) return 'solo';
  if (/an[aá]lise|monitor|verifica/.test(txt)) return 'monitoramento';
  return 'outros';
}
