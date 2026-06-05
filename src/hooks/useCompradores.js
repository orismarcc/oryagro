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

/**
 * Carrega parcelas pagas de todos os compradores do usuário (para cálculo de
 * histórico de pagamento em batch — evita N+1 queries na lista de compradores).
 * Retorna array de { comprador_id, data_vencimento, data_pagamento }.
 */
export async function loadParcelasPagasBatch() {
  const userId = await getUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from('venda_parcelas')
    .select(`
      id,
      data_vencimento,
      data_pagamento,
      status,
      vendas!inner (
        comprador_id
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'pago')
    .not('data_pagamento', 'is', null)
    .order('data_pagamento', { ascending: false });
  if (error) { logDbError('loadParcelasPagasBatch', error); return []; }
  return (data || []).map(p => ({
    comprador_id: p.vendas?.comprador_id,
    data_vencimento: p.data_vencimento,
    data_pagamento: p.data_pagamento,
  })).filter(p => p.comprador_id);
}

/**
 * Carrega parcelas pendentes em aberto há mais de 30 dias, por comprador.
 * Usado para o cálculo de risco.
 */
export async function loadParcelasAbertas30Dias() {
  const userId = await getUserId();
  if (!userId) return [];
  const limite = new Date();
  limite.setDate(limite.getDate() - 30);
  const { data, error } = await supabase
    .from('venda_parcelas')
    .select(`
      id,
      data_vencimento,
      vendas!inner (
        comprador_id
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'pendente')
    .lt('data_vencimento', limite.toISOString().split('T')[0]);
  if (error) { logDbError('loadParcelasAbertas30Dias', error); return []; }
  return (data || []).map(p => ({
    comprador_id: p.vendas?.comprador_id,
    data_vencimento: p.data_vencimento,
  })).filter(p => p.comprador_id);
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
