/**
 * useProducaoRegistros.js
 *
 * CRUD para registros diários de produção (tabela producao_registros).
 * Cada registro representa quanto um lote produziu em um determinado dia.
 */
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { logDbError } from '../lib/logger';
import { insertOfflineSafe } from '../lib/outbox';

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

async function addProducaoRegistro({ plantioId, data, quantidade, unidade = 'kg', qualidade = 'A', observacao = '' }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  // Offline-safe: registro de produção é feito no campo durante a colheita.
  const { row, error } = await insertOfflineSafe('producao_registros', {
    plantio_id:  plantioId,
    user_id:     user.id,
    data,
    quantidade:  parseFloat(quantidade),
    unidade,
    qualidade,
    observacao: observacao || null,
    updated_at: new Date().toISOString(),
  });
  if (error) { logDbError('addProducaoRegistro', error); throw error; }
  return row;
}

/**
 * Remove um registro de produção. Se ele nasceu de uma COLHEITA anotada
 * (atividade_id), exclui o registro de origem — a produção cai junto (cascata)
 * e não "volta" na próxima edição da atividade.
 */
async function deleteProducaoRegistro(registro) {
  const { error } = registro.atividade_id
    ? await supabase.from('cronograma_atividades').delete().eq('id', registro.atividade_id)
    : await supabase.from('producao_registros').delete().eq('id', registro.id);
  if (error) { logDbError('deleteProducaoRegistro', error); throw error; }
  return true;
}

/** Converte uma quantidade colhida para kg (kg, g, t). Caixas/unidades → null. */
export function paraKg(quantidade, unidade) {
  const q = parseFloat(quantidade);
  if (!Number.isFinite(q)) return null;
  const u = String(unidade || 'kg').trim().toLowerCase();
  if (u === 'kg') return q;
  if (u === 'g') return q / 1000;
  if (u === 't' || u === 'ton') return q * 1000;
  return null;
}

/**
 * Todas as colheitas do usuário (todos os lotes), para Agenda, Análise e PDF.
 * Cada item: { plantio_id, data, quantidade, unidade, quantidade_kg }.
 */
export async function loadColheitas() {
  const { data, error } = await supabase
    .from('producao_registros')
    .select('plantio_id, data, quantidade, unidade')
    .order('data', { ascending: true });
  if (error) { logDbError('loadColheitas', error); return []; }
  return (data || []).map(r => ({ ...r, quantidade_kg: paraKg(r.quantidade, r.unidade) }));
}

async function loadProducaoRegistros(plantioId, limitDays = 90) {
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
    if (!r) return;
    await deleteProducaoRegistro(r);
    setRegistros(prev => prev.filter(x => x.id !== id));
    setTotalKg(prev => prev - parseFloat(r.quantidade || 0));
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
