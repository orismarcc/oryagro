/**
 * OryAgro — Utilitários de formatação centralizados
 * Substitui as 6+ cópias de fmtBRL/fmtNumber espalhadas pelo projeto.
 */

const CURRENCY_FMT = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const CURRENCY_COMPACT_FMT = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

const NUMBER_FMT = new Intl.NumberFormat('pt-BR');

/**
 * Formata valor monetário: R$ 1.500,00
 */
export function fmtBRL(value) {
  if (value === undefined || value === null || isNaN(value)) return 'R$ —';
  return CURRENCY_FMT.format(Number(value));
}

/**
 * Formata valor monetário sem centavos: R$ 1.500
 */
export function fmtBRLCompact(value) {
  if (value === undefined || value === null || isNaN(value)) return 'R$ —';
  return CURRENCY_COMPACT_FMT.format(Number(value));
}

/**
 * Formata número com separador de milhar: 1.500
 */
export function fmtNumber(n) {
  if (n === undefined || n === null || isNaN(n)) return '—';
  return NUMBER_FMT.format(Number(n));
}

/**
 * Formata data ISO para pt-BR: 15/06/2025
 */
export function fmtDateBR(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Retorna data de hoje no formato YYYY-MM-DD
 */
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
