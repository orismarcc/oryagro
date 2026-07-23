/**
 * useAplicacoes.js
 *
 * CRUD do Caderno de Campo de Aplicações (tabela aplicacoes_campo).
 * Cada registro é uma aplicação de defensivo/adubo em um lote, com os campos
 * exigidos para o relatório de rastreabilidade (padrão MAPA).
 */
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { logDbError } from '../lib/logger';
import { insertOfflineSafe } from '../lib/outbox';

// Campos livres do formulário → colunas da tabela
const CAMPOS = [
  'data', 'tipo', 'produto', 'ingrediente_ativo', 'classe', 'registro_mapa',
  'alvo', 'dose', 'area_ha', 'volume_calda', 'equipamento', 'operador',
  'resp_tecnico', 'crea', 'receituario', 'carencia_dias', 'epi',
  'clima_temp', 'clima_umidade', 'clima_vento', 'obs',
];

function normalize(form) {
  const out = {};
  for (const c of CAMPOS) {
    let v = form[c];
    if (v === '' || v === undefined) v = null;
    if (c === 'area_ha')      v = v == null ? null : parseFloat(v);
    if (c === 'carencia_dias') v = v == null ? null : parseInt(v, 10);
    out[c] = v;
  }
  return out;
}

export async function addAplicacao(plantioId, form) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');
  const { row, error } = await insertOfflineSafe('aplicacoes_campo', {
    plantio_id: plantioId,
    user_id: user.id,
    ...normalize(form),
  });
  if (error) { logDbError('addAplicacao', error); throw error; }
  return row;
}

export async function deleteAplicacao(id) {
  const { error } = await supabase.from('aplicacoes_campo').delete().eq('id', id);
  if (error) { logDbError('deleteAplicacao', error); throw error; }
}

export async function loadAplicacoes(plantioId) {
  const { data, error } = await supabase
    .from('aplicacoes_campo')
    .select('*')
    .eq('plantio_id', plantioId)
    .order('data', { ascending: false });
  if (error) { logDbError('loadAplicacoes', error); return []; }
  return data ?? [];
}

export function useAplicacoes(plantioId) {
  const [aplicacoes, setAplicacoes] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    if (!plantioId) { setLoading(false); return; }
    setLoading(true);
    setAplicacoes(await loadAplicacoes(plantioId));
    setLoading(false);
  };

  useEffect(() => { reload(); }, [plantioId]);

  const add = async (form) => {
    const row = await addAplicacao(plantioId, form);
    setAplicacoes(prev => [row, ...prev].sort((a, b) => (b.data || '').localeCompare(a.data || '')));
    return row;
  };

  const remove = async (id) => {
    await deleteAplicacao(id);
    setAplicacoes(prev => prev.filter(a => a.id !== id));
  };

  return { aplicacoes, loading, add, remove, reload };
}
