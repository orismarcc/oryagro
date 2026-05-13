import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { logDbError } from '../lib/logger';
import { cacheSet, cacheGet } from './useOfflineCache';

/** Retorna o user_id do usuário autenticado ou null */
async function getUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Debounced upsert of simulator config values to Supabase.
 * Falls back silently on error (localStorage is the source of truth locally).
 * Scoped per user: (user_id, cultura_id).
 */
export function useSimuladorSync(culturaId, valores) {
  const timerRef = useRef(null);

  useEffect(() => {
    if (!culturaId || !valores) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const userId = await getUserId();
      if (!userId) return;
      await supabase
        .from('simulador_configs')
        .upsert(
          { user_id: userId, cultura_id: culturaId, valores, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,cultura_id' },
        );
    }, 1500);
    return () => clearTimeout(timerRef.current);
  }, [culturaId, valores]);
}

/**
 * Load simulator config from Supabase on mount.
 * Returns the remote valores or null if not found / error.
 */
export async function loadSimuladorConfig(culturaId) {
  const userId = await getUserId();
  if (!userId) return null;
  const { data, error } = await supabase
    .from('simulador_configs')
    .select('valores')
    .eq('user_id', userId)
    .eq('cultura_id', culturaId)
    .single();
  if (error || !data) return null;
  return data.valores;
}

/**
 * Save a plantio record to Supabase. Returns the created row or null.
 */
export async function registrarPlantio(payload) {
  const userId = await getUserId();
  if (!userId) return null;
  const { data, error } = await supabase
    .from('plantios')
    .insert({ ...payload, user_id: userId })
    .select()
    .single();
  if (error) { logDbError('registrarPlantio', error); return null; }
  return data;
}

/**
 * Load all plantio lots for a specific cultura (only current user's).
 */
export async function loadLotes(culturaId) {
  const userId = await getUserId();
  if (!userId) return [];
  const { data } = await supabase
    .from('plantios')
    .select('*')
    .eq('user_id', userId)
    .eq('cultura_id', culturaId)
    .order('data_plantio', { ascending: false });
  return data || [];
}

/**
 * Load recent lots across all cultures (for Dashboard — only current user's).
 */
export async function loadTodosLotes(limit = 8) {
  const userId = await getUserId();
  if (!userId) return [];

  // Offline: return cached data if available
  const cacheKey = `lotes_${userId}_${limit}`;
  if (!navigator.onLine) {
    const cached = cacheGet(cacheKey);
    if (cached) return cached;
  }

  const { data, error } = await supabase
    .from('plantios')
    .select('*')
    .eq('user_id', userId)
    .order('data_plantio', { ascending: false })
    .limit(limit);

  if (!error && data) {
    cacheSet(cacheKey, data);
  }
  return data || (cacheGet(cacheKey) ?? []);
}

/**
 * Delete a plantio lot by id. Returns true on success.
 */
export async function deleteLote(id) {
  const { error } = await supabase.from('plantios').delete().eq('id', id);
  return !error;
}

/**
 * Update the mudas_feitas field of a lote (nursery progress tracking).
 * Returns the updated row or null.
 */
export async function updateLoteMudas(id, mudas_feitas) {
  const { data, error } = await supabase
    .from('plantios')
    .update({ mudas_feitas })
    .eq('id', id)
    .select()
    .single();
  if (error) { logDbError('updateLoteMudas', error); return null; }
  return data;
}

// ── Plantio Eventos (date-based event timeline) ──────────────────────────────

/**
 * Load all timeline events for a plantio, ordered chronologically.
 */
export async function loadEventos(plantioId) {
  const userId = await getUserId();
  if (!userId) return [];
  const { data } = await supabase
    .from('plantio_eventos')
    .select('*')
    .eq('user_id', userId)
    .eq('plantio_id', plantioId)
    .order('data', { ascending: true });
  return data || [];
}

/**
 * Add a new timeline event for a plantio. Returns the created row or null.
 */
export async function addEvento(payload) {
  const userId = await getUserId();
  if (!userId) return null;
  const { data, error } = await supabase
    .from('plantio_eventos')
    .insert({ ...payload, user_id: userId })
    .select()
    .single();
  if (error) { logDbError('addEvento', error); return null; }
  return data;
}

/**
 * Delete a timeline event by id. Returns true on success.
 */
export async function deleteEvento(id) {
  const { error } = await supabase.from('plantio_eventos').delete().eq('id', id);
  return !error;
}

/**
 * Load all harvest events (tipo = 'colheita') for the current user across all plantios.
 * Used by AnalysePage to compare actual vs projected production.
 */
export async function loadAllColheitaEventos() {
  const userId = await getUserId();
  if (!userId) return [];
  const { data } = await supabase
    .from('plantio_eventos')
    .select('*')
    .eq('user_id', userId)
    .eq('tipo', 'colheita')
    .order('data', { ascending: true });
  return data || [];
}

/**
 * Update the area_plantada_ha field of a lote (partial planting tracking).
 * Returns the updated row or null.
 */
export async function updateLotePlantado(id, area_plantada_ha) {
  const { data, error } = await supabase
    .from('plantios')
    .update({ area_plantada_ha })
    .eq('id', id)
    .select()
    .single();
  if (error) { logDbError('updateLotePlantado', error); return null; }
  return data;
}

/**
 * Load all cronograma_atividades rows for a given plantio.
 * Used on mount to rehydrate status from Supabase (source of truth).
 */
export async function loadCronogramaAtividades(plantioId) {
  if (!plantioId) return [];
  const { data, error } = await supabase
    .from('cronograma_atividades')
    .select('*')
    .eq('plantio_id', plantioId)
    .order('dia_previsto', { ascending: true });
  if (error) { logDbError('loadCronogramaAtividades', error); return []; }
  return data || [];
}

/**
 * Upsert a cronograma activity status.
 * Used when the user marks a step as done.
 */
export async function syncCronogramaStatus(plantioId, culturaId, atividade) {
  const { error } = await supabase
    .from('cronograma_atividades')
    .upsert(
      {
        plantio_id:      plantioId,
        cultura_id:      culturaId,
        dia_previsto:    atividade.dia,
        etapa:           atividade.etapa,
        produto:         atividade.produto        || '',
        dose:            atividade.dose           || '',
        forma_aplicacao: atividade.forma          || '',
        tipo:            atividade.tipo           || 'manejo',
        status:          atividade.status,
        data_execucao:   atividade.data           || null,
        observacao:      atividade.obs            || null,
        is_custom:       atividade.isCustom       || false,
        updated_at:      new Date().toISOString(),
      },
      // True upsert: update the existing row if one already exists for this
      // (plantio_id, etapa, is_custom) triplet instead of inserting a duplicate.
      { onConflict: 'plantio_id,etapa,is_custom' },
    );
  if (error) logDbError('syncCronogramaStatus', error);
}

// ── Propriedades ──────────────────────────────────────────────────────────────

/**
 * Load all properties the current user has access to:
 * - farms they own (user_id = auth.uid())
 * - farms they are a member of (via farm_members)
 * Results are deduplicated and sorted alphabetically.
 */
export async function loadPropriedades() {
  const userId = await getUserId();
  if (!userId) return [];

  // Offline: return cached data if available
  const cacheKey = `propriedades_${userId}`;
  if (!navigator.onLine) {
    const cached = cacheGet(cacheKey);
    if (cached) return cached;
  }

  // Fetch farms where user is a member (RLS already filters to user's memberships)
  const { data, error } = await supabase
    .from('farm_members')
    .select('propriedades(*)')
    .eq('user_id', userId);

  if (error) {
    // Fallback: load only owned farms
    const { data: owned } = await supabase
      .from('propriedades')
      .select('*')
      .eq('user_id', userId)
      .order('nome');
    return owned || (cacheGet(cacheKey) ?? []);
  }

  // Flatten and deduplicate by id (I-14: guard against duplicate memberships)
  const seen = new Set();
  const farms = (data || [])
    .map(row => row.propriedades)
    .filter(p => p && !seen.has(p.id) && seen.add(p.id))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  cacheSet(cacheKey, farms);
  return farms;
}

/**
 * Create a new property. Returns the created row or null.
 */
export async function createPropriedade({ nome, descricao }) {
  const userId = await getUserId();
  if (!userId) return null;
  const { data, error } = await supabase
    .from('propriedades')
    .insert({ user_id: userId, nome, descricao: descricao || null })
    .select()
    .single();
  if (error) { logDbError('createPropriedade', error); return null; }
  return data;
}

/**
 * Update an existing property. Returns the updated row or null.
 */
export async function updatePropriedade(id, { nome, descricao }) {
  const { data, error } = await supabase
    .from('propriedades')
    .update({ nome, descricao: descricao || null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) { logDbError('updatePropriedade', error); return null; }
  return data;
}

/**
 * Delete a property and all its lotes (cascade).
 * Order: cronograma_atividades → plantio_eventos → plantios → propriedade.
 * Estoque is FK-cascade-deleted by the DB when the propriedade row is removed.
 */
export async function deletePropriedade(id) {
  // 1. Get all plantio IDs for this property
  const { data: plantiosRows } = await supabase
    .from('plantios')
    .select('id')
    .eq('propriedade_id', id);
  const plantioIds = (plantiosRows || []).map(r => r.id);

  if (plantioIds.length > 0) {
    // 2. Delete all child data for each plantio
    await supabase.from('cronograma_atividades').delete().in('plantio_id', plantioIds);
    await supabase.from('plantio_eventos').delete().in('plantio_id', plantioIds);
    await supabase.from('mao_obra_registros').delete().in('plantio_id', plantioIds);
    // Delete venda_parcelas via vendas (2-step: busca ids de vendas, depois deleta parcelas)
    const { data: vendasRows } = await supabase.from('vendas').select('id').in('plantio_id', plantioIds);
    const vendaIds = (vendasRows || []).map(r => r.id);
    if (vendaIds.length > 0) {
      await supabase.from('venda_parcelas').delete().in('venda_id', vendaIds);
    }
    await supabase.from('vendas').delete().in('plantio_id', plantioIds);
    await supabase.from('diario_campo').delete().in('plantio_id', plantioIds);
    // 3. Delete lotes
    await supabase.from('plantios').delete().eq('propriedade_id', id);
  }

  // 4. Delete property (estoque cascade-deleted by FK)
  const { error } = await supabase.from('propriedades').delete().eq('id', id);
  return !error;
}

/**
 * Delete a single lote and all its related data (events + schedule activities).
 * Returns true on success.
 */
export async function deleteLoteCompleto(id) {
  await supabase.from('cronograma_atividades').delete().eq('plantio_id', id);
  await supabase.from('plantio_eventos').delete().eq('plantio_id', id);
  await supabase.from('mao_obra_registros').delete().eq('plantio_id', id);
  // Delete venda_parcelas antes das vendas (FK cascade não cobre esse caso)
  const { data: vendasRows } = await supabase.from('vendas').select('id').eq('plantio_id', id);
  const vendaIds = (vendasRows || []).map(r => r.id);
  if (vendaIds.length > 0) {
    await supabase.from('venda_parcelas').delete().in('venda_id', vendaIds);
  }
  await supabase.from('vendas').delete().eq('plantio_id', id);
  await supabase.from('diario_campo').delete().eq('plantio_id', id);
  const { error } = await supabase.from('plantios').delete().eq('id', id);
  return !error;
}

/**
 * Load all plantios belonging to a specific property.
 * Works for both owners and members (RLS handles access control).
 */
export async function loadLotesByPropriedade(propriedadeId) {
  if (!propriedadeId) return [];
  const { data } = await supabase
    .from('plantios')
    .select('*')
    .eq('propriedade_id', propriedadeId)
    .order('data_plantio', { ascending: false });
  return data || [];
}

/**
 * Count lotes per property accessible to the current user.
 * Returns an object: { [propriedadeId]: count }
 */
export async function countLotesByPropriedade() {
  const userId = await getUserId();
  if (!userId) return {};
  // Query via farm_members to get all accessible farm IDs, then count lotes
  const { data: memberships } = await supabase
    .from('farm_members')
    .select('farm_id')
    .eq('user_id', userId);
  if (!memberships || memberships.length === 0) return {};
  const farmIds = memberships.map(m => m.farm_id);
  const { data } = await supabase
    .from('plantios')
    .select('propriedade_id')
    .in('propriedade_id', farmIds);
  if (!data) return {};
  return data.reduce((acc, row) => {
    acc[row.propriedade_id] = (acc[row.propriedade_id] || 0) + 1;
    return acc;
  }, {});
}
