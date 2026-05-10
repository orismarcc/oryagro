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

  // 2. Atualizar quantidade no estoque via RPC atômico (I-08: evita race condition)
  const delta = tipo === 'entrada' ? quantidade : -quantidade;
  const { error: rpcErr } = await supabase.rpc('adjust_insumo_quantidade', {
    p_insumo_id: insumoId,
    p_delta: delta,
  });
  if (rpcErr) {
    // Fallback: read-then-update (não atômico, mas mantém funcionamento)
    logDbError('addMovimento:rpc_fallback', rpcErr);
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

/**
 * Load all 'saida' movements for a specific plantio, joined with insumo price.
 * Used to calculate input cost per lote.
 */
export async function loadMovimentosByLote(plantioId) {
  const userId = await getUserId();
  if (!userId) return [];
  const { data } = await supabase
    .from('estoque_movimentos')
    .select('*, insumo:estoque_insumos(nome, unidade, preco_unitario)')
    .eq('user_id', userId)
    .eq('plantio_id', plantioId)
    .eq('tipo', 'saida')
    .order('data', { ascending: false });
  return data || [];
}

/**
 * Update mao_obra_total for a plantio. Returns updated row or null.
 */
export async function updateLoteMaoObra(plantioId, maoObraTotal) {
  const { data, error } = await supabase
    .from('plantios')
    .update({ mao_obra_total: maoObraTotal ?? 0, updated_at: new Date().toISOString() })
    .eq('id', plantioId)
    .select()
    .single();
  if (error) { logDbError('updateLoteMaoObra', error); return null; }
  return data;
}

// ── Vendas ────────────────────────────────────────────────────────────────────

/**
 * Load all sales records for a plantio, newest first.
 */
export async function loadVendas(plantioId) {
  const userId = await getUserId();
  if (!userId) return [];
  const { data } = await supabase
    .from('vendas')
    .select('*')
    .eq('user_id', userId)
    .eq('plantio_id', plantioId)
    .order('data', { ascending: false });
  return data || [];
}

/**
 * Load all sales records for the current user, newest first.
 */
export async function loadTodasVendas() {
  const userId = await getUserId();
  if (!userId) return [];
  const { data } = await supabase
    .from('vendas')
    .select('*')
    .eq('user_id', userId)
    .order('data', { ascending: false });
  return data || [];
}

/**
 * Create a venda record. Returns the new row or null.
 */
export async function addVenda({ plantioId, data, quantidade, unidade, precoUnitario, destino, observacao, compradorId, categoria }) {
  const userId = await getUserId();
  if (!userId) return null;
  const { data: row, error } = await supabase
    .from('vendas')
    .insert({
      user_id: userId,
      plantio_id: plantioId,
      data,
      quantidade,
      unidade: unidade || 'kg',
      preco_unitario: precoUnitario || 0,
      destino: destino || 'outros',
      observacao: observacao || null,
      categoria: categoria || 'Venda de produção in-natura',
      ...(compradorId ? { comprador_id: compradorId } : {}),
    })
    .select()
    .single();
  if (error) { logDbError('addVenda', error); return null; }
  return row;
}

/**
 * Delete a venda record by id.
 */
export async function deleteVenda(id) {
  const { error } = await supabase.from('vendas').delete().eq('id', id);
  if (error) { logDbError('deleteVenda', error); return false; }
  return true;
}

/**
 * Update the status field of a plantio (e.g. 'ativo' → 'concluido').
 * Returns the updated row or null.
 */
export async function updateLoteStatus(id, status) {
  const { data, error } = await supabase
    .from('plantios')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) { logDbError('updateLoteStatus', error); return null; }
  return data;
}

/**
 * Archive a summary of the completed lote cycle to localStorage AND Supabase.
 * Key: ciclo_historico_${lote.id}
 */
export async function arquivarCicloLote(lote, vendas = [], _eventos = [], movimentos = [], maoObraRegistros = []) {
  try {
    const totalVendasKg = vendas.reduce((s, v) => s + (v.quantidade ?? 0), 0);
    const receitaTotal  = vendas.reduce((s, v) => s + (v.quantidade ?? 0) * (v.preco_unitario ?? 0), 0);
    const dataPlantio   = lote.data_plantio;
    const dataConclusao = new Date().toISOString().slice(0, 10);
    const diasCicloReal = dataPlantio
      ? Math.max(0, Math.floor((Date.now() - new Date(dataPlantio + 'T12:00:00')) / 86_400_000))
      : null;

    const custoInsumos  = movimentos.reduce((s, m) => s + (m.quantidade * (m.insumo?.preco_unitario ?? 0)), 0);
    const custoMaoObra  = maoObraRegistros.reduce((s, r) => s + (r.valor ?? 0), 0);

    const ciclo = {
      loteId:        lote.id,
      nome:          lote.nome,
      culturaId:     lote.cultura_id,
      dataPlantio,
      dataConclusao,
      totalVendasKg,
      receitaTotal,
      custoInsumos,
      custoMaoObra,
      diasCicloReal,
      archivedAt:    new Date().toISOString(),
    };

    // Persist to localStorage as fallback
    localStorage.setItem(`ciclo_historico_${lote.id}`, JSON.stringify(ciclo));

    // Also persist to Supabase (fire-and-forget; errors are logged but don't block)
    saveCicloHistorico({
      loteId:        lote.id,
      loteNome:      lote.nome,
      culturaId:     lote.cultura_id,
      dataPlantio,
      dataConclusao,
      totalVendasKg,
      receitaTotal,
      custoInsumos,
      custoMaoObra,
      diasCicloReal,
    }).catch(err => logDbError('arquivarCicloLote:saveCicloHistorico', err));

    return ciclo;
  } catch {
    return null;
  }
}

// ── Mão de obra ───────────────────────────────────────────────

export async function loadMaoObraRegistros(plantioId) {
  const userId = await getUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from('mao_obra_registros')
    .select('*')
    .eq('user_id', userId)
    .eq('plantio_id', plantioId)
    .order('data_inicio', { ascending: false });
  if (error) { logDbError('loadMaoObraRegistros', error); return []; }
  return data || [];
}

export async function addMaoObraRegistro({ plantioId, dataInicio, dataFim, valor, descricao, prestador }) {
  const userId = await getUserId();
  if (!userId) return null;
  const { data: row, error } = await supabase
    .from('mao_obra_registros')
    .insert({
      user_id:     userId,
      plantio_id:  plantioId,
      data_inicio: dataInicio,
      data_fim:    dataFim || null,
      valor:       valor,
      descricao:   descricao || null,
      prestador:   prestador || null,
    })
    .select()
    .single();
  if (error) { logDbError('addMaoObraRegistro', error); return null; }
  return row;
}

export async function deleteMaoObraRegistro(id) {
  const { error } = await supabase.from('mao_obra_registros').delete().eq('id', id);
  if (error) { logDbError('deleteMaoObraRegistro', error); return false; }
  return true;
}

// ── Ciclos histórico (Supabase) ────────────────────────────────

export async function saveCicloHistorico({ loteId, loteNome, culturaId, dataPlantio, dataConclusao, totalVendasKg, receitaTotal, custoInsumos, custoMaoObra, diasCicloReal }) {
  const userId = await getUserId();
  if (!userId) return null;
  const { data: row, error } = await supabase
    .from('ciclos_historico')
    .upsert(
      {
        user_id:         userId,
        lote_id:         loteId,
        lote_nome:       loteNome,
        cultura_id:      culturaId,
        data_plantio:    dataPlantio,
        data_conclusao:  dataConclusao,
        total_vendas_kg: totalVendasKg,
        receita_total:   receitaTotal,
        custo_insumos:   custoInsumos,
        custo_mao_obra:  custoMaoObra,
        dias_ciclo_real: diasCicloReal,
        archived_at:     new Date().toISOString(),
      },
      { onConflict: 'lote_id' },
    )
    .select()
    .single();
  if (error) { logDbError('saveCicloHistorico', error); return null; }
  return row;
}

export async function loadCiclosHistorico() {
  const userId = await getUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from('ciclos_historico')
    .select('*')
    .eq('user_id', userId)
    .order('archived_at', { ascending: false });
  if (error) { logDbError('loadCiclosHistorico', error); return []; }
  return data || [];
}
