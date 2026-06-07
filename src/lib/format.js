/**
 * format.js — helpers de formatação compartilhados (BRL, datas, números, peso).
 *
 * Antes, fmtBRL / fmtDate / fmtKg estavam duplicados em várias telas
 * (TalhaoPage, TabDespesas, Dashboard, etc.). Centralizar evita divergência de
 * formatação e facilita manutenção. Adote incrementalmente nas telas.
 */

const _brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const _num = new Intl.NumberFormat('pt-BR');

/** Valor em reais: 1234.5 → "R$ 1.234,50" */
export function fmtBRL(v) {
  return _brl.format(Number(v) || 0);
}

/** Número com separador pt-BR: 1234.5 → "1.234,5" */
export function fmtNumber(v) {
  return _num.format(Number(v) || 0);
}

/** Data ISO (yyyy-mm-dd) → "dd/mm/aaaa". Aceita timestamps (corta em 10 chars). */
export function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).substring(0, 10).split('-');
  if (!y || !m || !d) return '—';
  return `${d}/${m}/${y}`;
}

/** Peso amigável: 1500 → "1.5t", 800 → "800 kg" */
export function fmtKg(v) {
  const n = Number(v) || 0;
  return n >= 1000 ? `${(n / 1000).toFixed(1)}t` : `${_num.format(n)} kg`;
}
