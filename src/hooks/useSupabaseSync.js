import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

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
  if (error) { console.error('Supabase plantio error:', error); return null; }
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
  const { data } = await supabase
    .from('plantios')
    .select('*')
    .eq('user_id', userId)
    .order('data_plantio', { ascending: false })
    .limit(limit);
  return data || [];
}

/**
 * Delete a plantio lot by id. Returns true on success.
 */
export async function deleteLote(id) {
  const { error } = await supabase.from('plantios').delete().eq('id', id);
  return !error;
}

/**
 * Upsert a cronograma activity status.
 * Used when the user marks a step as done.
 */
export async function syncCronogramaStatus(plantioId, culturaId, atividade) {
  const { error } = await supabase
    .from('cronograma_atividades')
    .upsert({
      plantio_id: plantioId,
      cultura_id: culturaId,
      dia_previsto: atividade.dia,
      etapa: atividade.etapa,
      produto: atividade.produto || '',
      dose: atividade.dose || '',
      forma_aplicacao: atividade.forma || '',
      tipo: atividade.tipo || 'manejo',
      status: atividade.status,
      data_execucao: atividade.data || null,
      observacao: atividade.obs || null,
      is_custom: atividade.isCustom || false,
      updated_at: new Date().toISOString(),
    });
  if (error) console.error('Supabase cronograma error:', error);
}
