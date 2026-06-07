import { supabase, getUserId } from '../lib/supabase';
import { logDbError } from '../lib/logger';

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

export async function addMovimento({ insumoId, tipo, quantidade, observacao, data, plantioId, despesaId, cronogramaAtividadeId, precoUnitarioMovimento }) {
  const userId = await getUserId();
  if (!userId) return null;

  // 1. Inserir movimento — retorna a linha para que o chamador conheça o id
  // (A4-08: rastreabilidade; A4-03/04: vinculação a despesa / atividade do cronograma)
  // precoUnitarioMovimento: preço pago por unidade nesta entrada. Quando informado
  // numa 'entrada', o trigger tg_estoque_movimentos_cmp recalcula o preço médio
  // ponderado do insumo.
  const { data: movRow, error: mErr } = await supabase
    .from('estoque_movimentos')
    .insert({
      user_id: userId,
      insumo_id: insumoId,
      tipo,
      quantidade,
      observacao: observacao || null,
      data,
      plantio_id: plantioId || null,
      despesa_id: despesaId || null,
      cronograma_atividade_id: cronogramaAtividadeId || null,
      preco_unitario_movimento: (precoUnitarioMovimento != null && precoUnitarioMovimento > 0)
        ? precoUnitarioMovimento
        : null,
    })
    .select('id')
    .single();
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
  return movRow?.id ?? true;
}

/**
 * A4-08: Exclui um movimento e ajusta o saldo do insumo atomicamente via RPC.
 * Fallback: read-then-update + delete (não atômico) caso a RPC não esteja disponível.
 */
export async function deleteMovimento(movimentoId) {
  if (!movimentoId) return false;
  const { data, error } = await supabase.rpc('delete_movimento_with_balance', {
    p_movimento_id: movimentoId,
  });
  if (!error) return data === true;

  // Fallback caso a RPC não esteja disponível (migration ainda não aplicada)
  logDbError('deleteMovimento:rpc_fallback', error);
  const { data: mov } = await supabase
    .from('estoque_movimentos')
    .select('insumo_id, tipo, quantidade')
    .eq('id', movimentoId)
    .single();
  if (!mov) return false;
  const delta = mov.tipo === 'entrada' ? -mov.quantidade : mov.quantidade;
  const { data: current } = await supabase
    .from('estoque_insumos')
    .select('quantidade')
    .eq('id', mov.insumo_id)
    .single();
  if (current) {
    await supabase
      .from('estoque_insumos')
      .update({
        quantidade: Math.max(0, current.quantidade + delta),
        updated_at: new Date().toISOString(),
      })
      .eq('id', mov.insumo_id);
  }
  const { error: delErr } = await supabase.from('estoque_movimentos').delete().eq('id', movimentoId);
  return !delErr;
}

/**
 * A4-03: Exclui todos os movimentos vinculados a uma despesa, restaurando o saldo.
 * Usado quando a despesa correspondente é deletada.
 */
export async function deleteMovimentosByDespesa(despesaId) {
  if (!despesaId) return 0;
  const userId = await getUserId();
  if (!userId) return 0;
  const { data: rows } = await supabase
    .from('estoque_movimentos')
    .select('id')
    .eq('user_id', userId)
    .eq('despesa_id', despesaId);
  if (!rows?.length) return 0;
  let n = 0;
  for (const row of rows) {
    if (await deleteMovimento(row.id)) n += 1;
  }
  return n;
}

/**
 * A4-04: Exclui o movimento vinculado a uma etapa do cronograma, restaurando saldo.
 * Usado quando o usuário desfaz a confirmação da etapa ou remove a etapa.
 */
export async function deleteMovimentoByCronogramaAtividade(cronogramaAtividadeId) {
  if (!cronogramaAtividadeId) return 0;
  const userId = await getUserId();
  if (!userId) return 0;
  const { data: rows } = await supabase
    .from('estoque_movimentos')
    .select('id')
    .eq('user_id', userId)
    .eq('cronograma_atividade_id', cronogramaAtividadeId);
  if (!rows?.length) return 0;
  let n = 0;
  for (const row of rows) {
    if (await deleteMovimento(row.id)) n += 1;
  }
  return n;
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
 * Batch-load dos últimos 30 movimentos de uma lista de insumos em uma única query.
 * Retorna um Map { insumoId → movimento[] }
 */
export async function loadMovimentosBatch(insumoIds) {
  if (!insumoIds?.length) return {};
  const userId = await getUserId();
  if (!userId) return {};
  const { data } = await supabase
    .from('estoque_movimentos')
    .select('*, plantio:plantios(nome)')
    .eq('user_id', userId)
    .in('insumo_id', insumoIds)
    .order('data', { ascending: false });
  if (!data) return {};
  // Group by insumo_id
  const map = {};
  insumoIds.forEach(id => { map[id] = []; });
  data.forEach(m => {
    if (map[m.insumo_id]) map[m.insumo_id].push(m);
  });
  return map;
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

// ── Mão de obra (registros) ───────────────────────────────────────────────────

/**
 * Load mao_obra_registros for a single plantio.
 * Returns { registros, total } where total = sum(horas * valor_hora).
 * Falls back gracefully when no records exist.
 */
export async function loadMaoObraByLote(plantioId) {
  if (!plantioId) return { registros: [], total: 0 };
  const userId = await getUserId();
  if (!userId) return { registros: [], total: 0 };
  const { data } = await supabase
    .from('mao_obra_registros')
    .select('*')
    .eq('plantio_id', plantioId)
    .eq('user_id', userId)
    .order('data', { ascending: false });
  const registros = data || [];
  const total = registros.reduce((sum, r) => sum + (r.horas * r.valor_hora), 0);
  return { registros, total };
}

/**
 * Batch-load mao_obra_registros for multiple plantios.
 * Returns a map { [plantioId]: registros[] }.
 */
export async function loadMaoObraBatch(plantioIds) {
  if (!plantioIds?.length) return {};
  const userId = await getUserId();
  if (!userId) return {};
  const { data } = await supabase
    .from('mao_obra_registros')
    .select('*')
    .eq('user_id', userId)
    .in('plantio_id', plantioIds);
  const map = {};
  plantioIds.forEach(id => { map[id] = []; });
  (data || []).forEach(r => {
    if (map[r.plantio_id]) map[r.plantio_id].push(r);
  });
  return map;
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
 * A4-12: Archive a summary of the completed lote cycle to Supabase (ciclos_historico).
 * Returns the in-memory cycle object on success, or null on failure.
 *
 * Antes era fire-and-forget + write em localStorage — a UI marcava o lote como
 * "concluído" mesmo se o Supabase tivesse falhado. Agora propaga erro para o
 * chamador via valor de retorno.
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
    const custoMaoObra  = maoObraRegistros.reduce((s, r) => s + ((r.horas ?? 0) * (r.valor_hora ?? 0)), 0);

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

    // Persiste no Supabase (fonte da verdade). Erro é logado e propagado para
    // o chamador via valor de retorno — não silenciamos para evitar estado
    // inconsistente em que UI mostra "arquivado" mas o BD não tem o registro.
    // Para lotes perenes, passa talhaoId e safraNúmero ao histórico.
    const ePerene = lote.tipo_cultura === 'perene';
    const saved = await saveCicloHistorico({
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
      ...(ePerene ? {
        talhaoId:    lote.talhao_id ?? null,
        safraNúmero: lote.safra_numero ?? null,
      } : {}),
    });
    if (!saved) {
      logDbError('arquivarCicloLote:saveCicloHistorico', new Error('saveCicloHistorico returned null'));
      return null;
    }

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

export async function saveCicloHistorico({ loteId, loteNome, culturaId, dataPlantio, dataConclusao, totalVendasKg, receitaTotal, custoInsumos, custoMaoObra, diasCicloReal, talhaoId = null, safraNúmero = null }) {
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
        // Campos opcionais para culturas perenes
        ...(talhaoId   != null ? { talhao_id:    talhaoId }   : {}),
        ...(safraNúmero != null ? { safra_numero: safraNúmero } : {}),
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

// ── Op#8: Preços de insumos por lote — sincronizados via simulador_configs ──
// Usa cultura_id = '__lote_precos__<loteId>' como chave — sem migration necessária.

/**
 * Salva preços de insumos de um lote no Supabase (debounced pelo chamador).
 */
export async function savePrecoInsumos(loteId, precos) {
  if (!loteId) return;
  const userId = await getUserId();
  if (!userId) return;
  await supabase
    .from('simulador_configs')
    .upsert(
      {
        user_id:    userId,
        cultura_id: `__lote_precos__${loteId}`,
        valores:    precos,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,cultura_id' },
    );
}

/**
 * Carrega preços de insumos de um lote do Supabase.
 * Retorna o objeto de preços ou null se não encontrado / erro.
 */
export async function loadPrecoInsumos(loteId) {
  if (!loteId) return null;
  const userId = await getUserId();
  if (!userId) return null;
  const { data, error } = await supabase
    .from('simulador_configs')
    .select('valores')
    .eq('user_id', userId)
    .eq('cultura_id', `__lote_precos__${loteId}`)
    .single();
  if (error || !data) return null;
  return data.valores ?? null;
}
