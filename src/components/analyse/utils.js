/**
 * analyse/utils.js — funções puras compartilhadas da AnalysePage.
 * Extraídas de AnalysePage.jsx sem alterar a lógica (apenas movidas).
 */
import { CULTURAS } from '../../data/culturas';
import { resolveLifecycle, parseCicloDias } from '../../lib/lifecycle';
import { logDbError } from '../../lib/logger';

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateShort(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function getCultura(culturaId) {
  return CULTURAS[culturaId] || null;
}

// fmtBRL desta tela: SEM casas decimais (reais inteiros). Mantido distinto do
// lib/format.fmtBRL (que usa 2 casas) para preservar a exibição atual.
export function fmtBRL(v) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

/** Resolve lifecycle com segurança; em erro retorna null para fallback. */
export function safeResolveLifecycle(lote, cultura) {
  try {
    return resolveLifecycle(lote, cultura);
  } catch (err) {
    logDbError('safeResolveLifecycle', err);
    return null;
  }
}

/** True se o lote está pronto para colheita (com fallback por parseCicloDias). */
export function isProntoParaColheita(lote, cultura) {
  if (!cultura) return false;
  const lc = safeResolveLifecycle(lote, cultura);
  if (lc !== null) return lc.prontoParaColheita === true;
  const cicloDias = parseCicloDias(cultura.ciclo);
  const diasDecorridos = Math.max(
    0,
    Math.floor((Date.now() - new Date(lote.data_plantio + 'T12:00:00')) / 86_400_000)
  );
  return diasDecorridos >= cicloDias;
}
