import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Debounced upsert of simulator config values to Supabase.
 * Falls back silently on error (localStorage is the source of truth locally).
 */
export function useSimuladorSync(culturaId, valores) {
  const timerRef = useRef(null);

  useEffect(() => {
    if (!culturaId || !valores) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      await supabase
        .from('simulador_configs')
        .upsert({ cultura_id: culturaId, valores, updated_at: new Date().toISOString() }, { onConflict: 'cultura_id' });
    }, 1500);
    return () => clearTimeout(timerRef.current);
  }, [culturaId, valores]);
}

/**
 * Load simulator config from Supabase on mount.
 * Returns the remote valores or null if not found / error.
 */
export async function loadSimuladorConfig(culturaId) {
  const { data, error } = await supabase
    .from('simulador_configs')
    .select('valores')
    .eq('cultura_id', culturaId)
    .single();
  if (error || !data) return null;
  return data.valores;
}

/**
 * Save a plantio record to Supabase. Returns the created row or null.
 */
export async function registrarPlantio(payload) {
  const { data, error } = await supabase
    .from('plantios')
    .insert(payload)
    .select()
    .single();
  if (error) { console.error('Supabase plantio error:', error); return null; }
  return data;
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
