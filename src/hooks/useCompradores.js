import { supabase, getUserId } from '../lib/supabase';
import { logDbError } from '../lib/logger';

// ── Compradores ──────────────────────────────────────────────────────────────

export async function loadCompradores() {
  const userId = await getUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from('compradores')
    .select('*')
    .eq('user_id', userId)
    .order('nome');
  if (error) { logDbError('loadCompradores', error); return []; }
  return data || [];
}

export async function upsertComprador({
  id,
  documento,
  tipoDocumento,
  nome,
  tipo,
  telefone,
  cidade,
  status,
  observacao,
}) {
  const userId = await getUserId();
  if (!userId) return null;
  const payload = {
    user_id: userId,
    documento,
    tipo_documento: tipoDocumento,
    nome,
    tipo,
    telefone,
    cidade,
    status,
    observacao,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = id
    ? await supabase.from('compradores').update(payload).eq('id', id).select().single()
    : await supabase.from('compradores').insert(payload).select().single();
  if (error) { logDbError('upsertComprador', error); return null; }
  return data;
}

export async function deleteComprador(id) {
  const { error } = await supabase.from('compradores').delete().eq('id', id);
  if (error) { logDbError('deleteComprador', error); return false; }
  return true;
}

// ── Parcelas ─────────────────────────────────────────────────────────────────

export async function loadParcelasByComprador(compradorId) {
  const { data, error } = await supabase
    .from('venda_parcelas')
    .select(`
      *,
      vendas!inner (
        data,
        quantidade,
        plantio_id,
        comprador_id
      )
    `)
    .eq('vendas.comprador_id', compradorId)
    .order('data_vencimento', { ascending: true });
  if (error) { logDbError('loadParcelasByComprador', error); return []; }
  // Flatten vendas fields into parcela
  return (data || []).map(p => ({
    ...p,
    venda_data: p.vendas?.data,
    quantidade: p.vendas?.quantidade,
    plantio_id: p.vendas?.plantio_id,
  }));
}

export async function loadTodasParcelasPendentes() {
  const userId = await getUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from('venda_parcelas')
    .select(`
      *,
      vendas!inner (
        comprador_id,
        plantio_id,
        compradores (
          nome
        )
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'pendente')
    .order('data_vencimento', { ascending: true });
  if (error) { logDbError('loadTodasParcelasPendentes', error); return []; }
  return (data || []).map(p => ({
    ...p,
    comprador_id: p.vendas?.comprador_id,
    comprador_nome: p.vendas?.compradores?.nome,
    plantio_id: p.vendas?.plantio_id,
  }));
}

export async function updateParcela(id, { status, dataPagamento }) {
  const payload = {
    status,
    data_pagamento: dataPagamento ?? null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('venda_parcelas')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) { logDbError('updateParcela', error); return null; }
  return data;
}

export async function addParcelas(vendaId, parcelas) {
  const userId = await getUserId();
  if (!userId) return null;
  const rows = parcelas.map(p => ({
    user_id: userId,
    venda_id: vendaId,
    numero_parcela: p.numeroParcela,
    valor: p.valor,
    data_vencimento: p.dataVencimento,
    status: 'pendente',
  }));
  const { data, error } = await supabase
    .from('venda_parcelas')
    .insert(rows)
    .select();
  if (error) { logDbError('addParcelas', error); return null; }
  return data;
}
