import { supabase } from '../lib/supabase';
import { logDbError } from '../lib/logger';

async function getUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// ── Diário de campo ──────────────────────────────────────────────────────────

export async function loadDiario(plantioId = null) {
  const userId = await getUserId();
  if (!userId) return [];
  let q = supabase
    .from('diario_campo')
    .select('*')
    .eq('user_id', userId)
    .order('data', { ascending: false })
    .order('created_at', { ascending: false });
  if (plantioId) q = q.eq('plantio_id', plantioId);
  const { data } = await q;
  return data || [];
}

export async function addDiarioEntry({ plantioId, data, tipo, texto }) {
  const userId = await getUserId();
  if (!userId) return null;
  const { data: row, error } = await supabase
    .from('diario_campo')
    .insert({ user_id: userId, plantio_id: plantioId || null, data, tipo, texto })
    .select()
    .single();
  if (error) { logDbError('addDiarioEntry', error); return null; }
  return row;
}

export async function deleteDiarioEntry(id) {
  const { error } = await supabase.from('diario_campo').delete().eq('id', id);
  return !error;
}

// ── Estoque ─────────────────────────────────────────────────────────────��─────

export async function loadEstoque(propriedadeId = null) {
  const userId = await getUserId();
  if (!userId) return [];
  let q = supabase
    .from('estoque_insumos')
    .select('*')
    .eq('user_id', userId)
    .order('nome');
  if (propriedadeId) q = q.eq('propriedade_id', propriedadeId);
  const { data } = await q;
  return data || [];
}

export async function upsertInsumo({ id, nome, unidade, quantidade, quantidade_minima, preco_unitario, propriedadeId }) {
  const userId = await getUserId();
  if (!userId) return null;
  const payload = {
    user_id: userId,
    nome,
    unidade,
    quantidade,
    quantidade_minima,
    preco_unitario,
    ...(propriedadeId ? { propriedade_id: propriedadeId } : {}),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = id
    ? await supabase.from('estoque_insumos').update(payload).eq('id', id).select().single()
    : await supabase.from('estoque_insumos').insert(payload).select().single();
  if (error) { logDbError('upsertInsumo', error); return null; }
  return data;
}

export async function deleteInsumo(id) {
  const { error } = await supabase.from('estoque_insumos').delete().eq('id', id);
  return !error;
}

export async function addMovimento({ insumoId, tipo, quantidade, observacao, data, plantioId }) {
  const userId = await getUserId();
  if (!userId) return null;

  // 1. Inserir movimento
  const { error: mErr } = await supabase
    .from('estoque_movimentos')
    .insert({
      user_id: userId,
      insumo_id: insumoId,
      tipo,
      quantidade,
      observacao: observacao || null,
      data,
      plantio_id: plantioId || null,
    });
  if (mErr) { logDbError('addMovimento', mErr); return null; }

  // 2. Atualizar quantidade no estoque (fetch + update)
  const delta = tipo === 'entrada' ? quantidade : -quantidade;
  const { data: current } = await supabase
    .from('estoque_insumos')
    .select('quantidade')
    .eq('id', insumoId)
    .single();
  if (current) {
    await supabase
      .from('estoque_insumos')
      .update({
        quantidade: Math.max(0, current.quantidade + delta),
        updated_at: new Date().toISOString(),
      })
      .eq('id', insumoId);
  }
  return true;
}

export async function loadMovimentos(insumoId) {
  const userId = await getUserId();
  if (!userId) return [];
  const { data } = await supabase
    .from('estoque_movimentos')
    .select('*, plantio:plantios(nome)')
    .eq('user_id', userId)
    .eq('insumo_id', insumoId)
    .order('data', { ascending: false })
    .limit(30);
  return data || [];
}
