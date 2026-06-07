import { supabase, getUserId } from '../lib/supabase';
import { logDbError } from '../lib/logger';

// Tabelas auditadas → rótulo amigável + ícone (emoji)
const TABELA_META = {
  plantios: { label: 'Lote / Safra', emoji: '🌱' },
  despesas: { label: 'Despesa',      emoji: '💸' },
  receitas: { label: 'Receita',      emoji: '💰' },
  vendas:   { label: 'Venda',        emoji: '🧺' },
};

const ACAO_META = {
  INSERT:      { label: 'criou',       cor: '#16a34a' },
  UPDATE:      { label: 'alterou',     cor: '#2563eb' },
  DELETE:      { label: 'excluiu',     cor: '#dc2626' },
  SOFT_DELETE: { label: 'arquivou',    cor: '#d97706' },
  RESTORE:     { label: 'restaurou',   cor: '#16a34a' },
};

export function tabelaMeta(t)  { return TABELA_META[t] ?? { label: t, emoji: '📄' }; }
export function acaoMeta(a)    { return ACAO_META[a]   ?? { label: a, cor: '#6b7280' }; }

/**
 * Carrega o histórico de alterações (audit_log) do usuário atual.
 * A RLS já limita aos registros das fazendas do usuário.
 *
 * Resolve o nome de quem fez a ação (actor) via profiles, com fallback gracioso.
 *
 * @param {number} limit
 * @returns {Promise<Array>} entradas enriquecidas com { actorNome }
 */
export async function loadAuditLog(limit = 100) {
  const userId = await getUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('audit_log')
    .select('id, actor_id, user_id, tabela, registro_id, acao, diff, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) { logDbError('loadAuditLog', error); return []; }
  const rows = data || [];
  if (rows.length === 0) return [];

  // Resolve nomes dos atores (best-effort — RLS pode limitar profiles de terceiros)
  const actorIds = [...new Set(rows.map(r => r.actor_id).filter(Boolean))];
  const nomePorId = {};
  if (actorIds.length) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, display_name, email')
      .in('id', actorIds);
    (profs || []).forEach(p => { nomePorId[p.id] = p.display_name || p.email || null; });
  }

  return rows.map(r => ({
    ...r,
    actorNome: r.actor_id
      ? (r.actor_id === userId ? 'Você' : (nomePorId[r.actor_id] || 'Outro usuário'))
      : '—',
  }));
}

/**
 * Resume um diff jsonb em texto curto e legível.
 * INSERT/DELETE: mostra campos-chave. UPDATE: lista "campo: antigo → novo".
 */
export function resumirDiff(acao, diff) {
  if (!diff || typeof diff !== 'object') return [];

  // Campos técnicos que não interessam ao usuário
  const OCULTOS = new Set(['id', 'user_id', 'created_at', 'updated_at', 'deleted_at']);

  if (acao === 'UPDATE') {
    // diff = { campo: { old, new } }
    return Object.entries(diff)
      .filter(([k]) => !OCULTOS.has(k))
      .map(([campo, v]) => ({ campo, old: fmtVal(v?.old), new: fmtVal(v?.new) }));
  }

  // INSERT / DELETE: diff é a linha inteira — mostra alguns campos relevantes
  const RELEVANTES = ['nome', 'categoria', 'descricao', 'valor', 'quantidade', 'status', 'data'];
  return RELEVANTES
    .filter(k => diff[k] !== undefined && diff[k] !== null && !OCULTOS.has(k))
    .map(campo => ({ campo, valor: fmtVal(diff[campo]) }));
}

function fmtVal(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
