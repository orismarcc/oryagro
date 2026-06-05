/**
 * useProducaoRegistros.js
 *
 * CRUD para registros diários de produção (tabela producao_registros).
 * Cada registro representa quanto um lote produziu em um determinado dia.
 */
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { logDbError } from '../lib/logger';

// ── Types ─────────────────────────────────────────────────────────────────────
// Registro: { id, plantio_id, user_id, data, quantidade, unidade, qualidade, observacao }
// Qualidades: 'A' (premium), 'B' (comercial), 'C' (baixa qualidade), 'descarte'

const QUALIDADE_CONFIG = {
  A:        { label: 'Premium (A)',  color: '#16a34a', bg: '#dcfce7' },
  B:        { label: 'Comercial (B)', color: '#d97706', bg: '#fef3c7' },
  C:        { label: 'Baixa (C)',    color: '#dc2626', bg: '#fee2e2' },
  descarte: { label: 'Descarte',     color: '#6b7280', bg: '#f3f4f6' },
};
export { QUALIDADE_CONFIG };

// ── Funções CRUD ──────────────────────────────────────────────────────────────

export async function addProducaoRegistro({ plantioId, data, quantidade, unidade = 'kg', qualidade = 'A', observacao = '' }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  const { data: row, error } = await supabase
    .from('producao_registros')
    .insert({
      plantio_id:  plantioId,
      user_id:     user.id,
      data,
      quantidade:  parseFloat(quantidade),
      unidade,
      qualidade,
      observacao: observacao || null,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) { logDbError('addProducaoRegistro', error); throw error; }
  return row;
}

export async function updateProducaoRegistro(id, updates) {
  const { data: row, error } = await supabase
    .from('producao_registros')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) { logDbError('updateProducaoRegistro', error); throw error; }
  return row;
}

export async function deleteProducaoRegistro(id) {
  const { error } = await supabase.from('producao_registros').delete().eq('id', id);
  if (error) { logDbError('deleteProducaoRegistro', error); throw error; }
  return true;
}

export async function loadProducaoRegistros(plantioId, limitDays = 90) {
  const since = new Date();
  since.setDate(since.getDate() - limitDays);
  const { data, error } = await supabase
    .from('producao_registros')
    .select('*')
    .eq('plantio_id', plantioId)
    .gte('data', since.toISOString().split('T')[0])
    .order('data', { ascending: false });
  if (error) { logDbError('loadProducaoRegistros', error); return []; }
  return data ?? [];
}

// ── Hook principal ────────────────────────────────────────────────────────────

export function useProducaoRegistros(plantioId) {
  const [registros, setRegistros]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [totalKg, setTotalKg]       = useState(0);
  const [mediaKgDia, setMediaKgDia] = useState(0);

  const reload = async () => {
    if (!plantioId) { setLoading(false); return; }
    setLoading(true);
    const rows = await loadProducaoRegistros(plantioId, 365);
    setRegistros(rows);

    // Calcular métricas
    const total = rows.reduce((s, r) => s + parseFloat(r.quantidade || 0), 0);
    setTotalKg(total);

    // Média diária baseada em dias com registro
    const diasComRegistro = new Set(rows.map(r => r.data)).size;
    setMediaKgDia(diasComRegistro > 0 ? total / diasComRegistro : 0);
    setLoading(false);
  };

  useEffect(() => { reload(); }, [plantioId]);

  const addRegistro = async (payload) => {
    const row = await addProducaoRegistro({ plantioId, ...payload });
    setRegistros(prev => [row, ...prev].sort((a, b) => b.data.localeCompare(a.data)));
    setTotalKg(prev => prev + parseFloat(payload.quantidade || 0));
    return row;
  };

  const removeRegistro = async (id) => {
    const r = registros.find(x => x.id === id);
    await deleteProducaoRegistro(id);
    setRegistros(prev => prev.filter(x => x.id !== id));
    if (r) setTotalKg(prev => prev - parseFloat(r.quantidade || 0));
  };

  // Dados para gráfico: últimos 30 dias agrupados por data
  const chartData = (() => {
    const byDate = {};
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      byDate[key] = { data: key, kg: 0, qualidadeA: 0, qualidadeB: 0, qualidadeC: 0, descarte: 0 };
    }
    registros.forEach(r => {
      if (!byDate[r.data]) return;
      byDate[r.data].kg += parseFloat(r.quantidade || 0);
      const q = r.qualidade || 'A';
      if (q === 'A')        byDate[r.data].qualidadeA += parseFloat(r.quantidade);
      else if (q === 'B')   byDate[r.data].qualidadeB += parseFloat(r.quantidade);
      else if (q === 'C')   byDate[r.data].qualidadeC += parseFloat(r.quantidade);
      else if (q === 'descarte') byDate[r.data].descarte += parseFloat(r.quantidade);
    });
    return Object.values(byDate);
  })();

  return { registros, loading, totalKg, mediaKgDia, chartData, addRegistro, removeRegistro, reload };
}
