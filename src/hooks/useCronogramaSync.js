/**
 * useCronogramaSync.js
 *
 * Single source of truth for cronograma step status across all components.
 * Supabase is always authoritative; localStorage is an offline cache only.
 *
 * Exports:
 *   makeStableId(prefix, etapa)       — shared ID builder (must match CronogramaTimeline)
 *   buildStatusFromDbRows(rows, viv)  — converts DB rows → { statusMap, customRows }
 *   useCronogramaStatusBatch(ids)     — batch load for Dashboard / CalendarioPage
 *   useCronogramaRealtime(id, onUpd)  — Supabase Realtime for active CronogramaTimeline
 *
 * NOTE — Real-time requires Supabase Realtime enabled for cronograma_atividades:
 *   Dashboard → Database → Replication → enable "cronograma_atividades"
 */
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { logDbError } from '../lib/logger';

// ── Shared ID builders ───────────────────────────────────────────────────────
/** MUST stay in sync with CronogramaTimeline's makeStableId. */
export function makeStableId(prefix, etapa) {
  const slug = etapa
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return `${prefix}_${slug}`;
}

/**
 * Stable ID for custom rows — hash of etapa+dia.
 * MUST stay in sync with CronogramaTimeline's makeCustomId.
 */
function _hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
}
export function makeCustomId(etapa, dia) {
  return 'custom_' + _hashStr(String(etapa || '') + '_' + String(dia ?? 0));
}

// ── Row → state converter ─────────────────────────────────────────────────────
/**
 * Convert an array of cronograma_atividades DB rows (for ONE plantio) into:
 *   statusMap  — { [stepId]: { status, data } }
 *   customRows — [{ dia, etapa, produto, dose, forma, tipo }]
 *
 * @param {Array}  rows     - DB rows for a single plantio
 * @param {Array}  vivSteps - etapasViveiro from the cultura's propagation method
 */
export function buildStatusFromDbRows(rows = [], vivSteps = []) {
  const statusMap  = {};
  const customRows = [];

  const stdRows    = rows.filter(r => !r.is_custom);
  const customDbRows = rows.filter(r => r.is_custom);

  stdRows.forEach(row => {
    const isViveiro = vivSteps.some(e => e.etapa === row.etapa);
    const _id = makeStableId(isViveiro ? 'viveiro' : 'default', row.etapa);
    statusMap[_id] = { status: row.status, data: row.data_execucao };
  });

  customDbRows.forEach((row) => {
    // Use stable hash-based ID so indices don't shift when new rows are inserted
    const stableId = makeCustomId(row.etapa, row.dia_previsto);
    // Status is recorded for EVERY row (including 'removida') so the filter works.
    statusMap[stableId] = { status: row.status, data: row.data_execucao };
    // BUT removed rows must NOT be re-injected into the visible customRows array —
    // otherwise a deleted custom step reappears after a Realtime refresh.
    if (row.status === 'removida') return;
    customRows.push({
      dia:       row.dia_previsto,
      etapa:     row.etapa,
      produto:   row.produto || '',
      dose:      row.dose    || '',
      forma:     row.forma_aplicacao || '',
      tipo:      row.tipo    || 'manejo',
      _stableId: stableId,           // carry the ID so CronogramaTimeline uses it directly
    });
  });

  return { statusMap, customRows };
}

// ── Batch loader ──────────────────────────────────────────────────────────────
/**
 * Load cronograma status for multiple lotes in a single Supabase query.
 * Updates localStorage cache so offline mode stays consistent.
 *
 * @param {string[]} loteIds
 * @returns {{
 *   statusByLote: { [loteId]: statusMap },
 *   customByLote: { [loteId]: customRows[] },
 *   loading: boolean,
 * }}
 */
export function useCronogramaStatusBatch(loteIds) {
  const stableKey = [...(loteIds || [])].sort().join(',');

  const [statusByLote, setStatusByLote] = useState({});
  const [customByLote, setCustomByLote] = useState({});
  const [loading, setLoading]           = useState(false);

  useEffect(() => {
    const ids = stableKey.split(',').filter(Boolean);
    if (!ids.length) return;

    // 1. Seed from localStorage immediately (offline-first / instant render)
    const initStatus = {};
    const initCustom = {};
    ids.forEach(id => {
      try {
        const s = localStorage.getItem(`cronograma_status_lote_${id}`);
        if (s) initStatus[id] = JSON.parse(s);
      } catch { /* ignore corrupt cache */ }
      try {
        const c = localStorage.getItem(`cronograma_custom_lote_${id}`);
        if (c) initCustom[id] = JSON.parse(c);
      } catch { /* ignore corrupt cache */ }
    });
    if (Object.keys(initStatus).length) setStatusByLote(initStatus);
    if (Object.keys(initCustom).length) setCustomByLote(initCustom);

    // 2. Fetch from Supabase — always overwrites cache with authoritative data
    setLoading(true);
    supabase
      .from('cronograma_atividades')
      .select('*')
      .in('plantio_id', ids)
      .then(({ data, error }) => {
        setLoading(false);
        if (error) { logDbError('useCronogramaStatusBatch', error); return; }
        if (!data?.length) return;

        // Group rows by plantio_id
        const grouped = {};
        data.forEach(row => {
          if (!grouped[row.plantio_id]) grouped[row.plantio_id] = [];
          grouped[row.plantio_id].push(row);
        });

        const newStatus = {};
        const newCustom = {};
        Object.entries(grouped).forEach(([loteId, rows]) => {
          const { statusMap, customRows } = buildStatusFromDbRows(rows);
          newStatus[loteId] = statusMap;
          if (customRows.length) newCustom[loteId] = customRows;
          // Keep localStorage in sync (offline cache)
          localStorage.setItem(`cronograma_status_lote_${loteId}`, JSON.stringify(statusMap));
          if (customRows.length) {
            localStorage.setItem(`cronograma_custom_lote_${loteId}`, JSON.stringify(customRows));
          }
        });

        setStatusByLote(prev => ({ ...prev, ...newStatus }));
        setCustomByLote(prev => ({ ...prev, ...newCustom }));
      });
  }, [stableKey]); // re-runs only when the set of IDs changes

  return { statusByLote, customByLote, loading };
}

// ── Realtime subscription ─────────────────────────────────────────────────────
/**
 * Subscribe to real-time changes on cronograma_atividades for a single plantio.
 * Called by CronogramaTimeline so multi-device changes appear instantly.
 *
 * @param {string|null} plantioId
 * @param {function}    onUpdate — called with fresh DB rows on every remote change
 */
export function useCronogramaRealtime(plantioId, onUpdate) {
  useEffect(() => {
    if (!plantioId) return;

    const channel = supabase
      .channel(`cronograma:${plantioId}`)
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'cronograma_atividades',
          filter: `plantio_id=eq.${plantioId}`,
        },
        async (_payload) => {
          // Reload all rows for this plantio to get consistent state
          const { data, error } = await supabase
            .from('cronograma_atividades')
            .select('*')
            .eq('plantio_id', plantioId)
            .order('dia_previsto', { ascending: true });
          if (!error && data) onUpdate(data);
        },
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          logDbError('useCronogramaRealtime', new Error(`Channel error for plantio ${plantioId}`));
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [plantioId]); // re-subscribes only when lote changes
}
