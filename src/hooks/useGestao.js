import { supabase, getUserId } from '../lib/supabase';
import { logDbError } from '../lib/logger';
import { insertOfflineSafe } from '../lib/outbox';

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

/**
 * Cria ou edita um insumo. A QUANTIDADE não é gravada aqui: o saldo é mantido
 * pelas movimentações (gatilho no banco). Um insumo novo nasce com 0 e recebe
 * uma "entrada" (estoque inicial ou compra).
 *
 * Estoque mínimo: `minimoTipo` 'percent' (padrão, 25% do nível da última
 * compra — calculado no banco) ou 'valor' (quantidade fixa em `quantidadeMinima`).
 */
export async function upsertInsumo({
  id, nome, unidade, preco_unitario, propriedadeId,
  minimoTipo = 'percent', minimoPercentual = 25, quantidadeMinima = 0,
}) {
  const userId = await getUserId();
  if (!userId) return null;
  const payload = {
    user_id: userId,
    nome,
    unidade,
    preco_unitario: preco_unitario ?? 0,
    minimo_tipo: minimoTipo,
    minimo_percentual: minimoPercentual,
    ...(minimoTipo === 'valor' ? { quantidade_minima: parseFloat(quantidadeMinima) || 0 } : {}),
    ...(propriedadeId ? { propriedade_id: propriedadeId } : {}),
    updated_at: new Date().toISOString(),
  };
  if (id) {
    const { data, error } = await supabase.from('estoque_insumos').update(payload).eq('id', id).select().single();
    if (error) { logDbError('upsertInsumo', error); return null; }
    return data;
  }
  const { row, error } = await insertOfflineSafe('estoque_insumos', { ...payload, quantidade: 0 });
  if (error) { logDbError('upsertInsumo', error); return null; }
  return row;
}

export async function deleteInsumo(id) {
  const { error } = await supabase.from('estoque_insumos').delete().eq('id', id);
  return !error;
}

/**
 * Registra uma movimentação (entrada/saída). O saldo do insumo, o preço médio
 * e o estoque mínimo são atualizados por gatilhos no banco — por isso esta
 * gravação pode ir para a fila offline sem risco de contar duas vezes.
 * Retorna o id da movimentação (ou null).
 */
export async function addMovimento({ insumoId, tipo, quantidade, observacao, data, plantioId, despesaId, precoUnitarioMovimento }) {
  const userId = await getUserId();
  if (!userId) return null;
  const { row, error } = await insertOfflineSafe('estoque_movimentos', {
    user_id: userId,
    insumo_id: insumoId,
    tipo,
    quantidade,
    observacao: observacao || null,
    data,
    plantio_id: plantioId || null,
    despesa_id: despesaId || null,
    preco_unitario_movimento: precoUnitarioMovimento > 0 ? precoUnitarioMovimento : null,
  });
  if (error) { logDbError('addMovimento', error); return null; }
  return row?.id ?? null;
}

export async function loadMovimentos(insumoId) {
  const userId = await getUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from('estoque_movimentos')
    .select('*, plantio:plantios(nome)')
    .eq('user_id', userId)
    .eq('insumo_id', insumoId)
    .order('data', { ascending: false })
    .limit(30);
  if (error) logDbError('loadMovimentos', error);
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
  const { data, error } = await supabase
    .from('estoque_movimentos')
    .select('*, plantio:plantios(nome)')
    .eq('user_id', userId)
    .in('insumo_id', insumoIds)
    .order('data', { ascending: false });
  if (error) logDbError('loadMovimentosBatch', error);
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
  const { data, error } = await supabase
    .from('estoque_movimentos')
    .select('*, insumo:estoque_insumos(nome, unidade, preco_unitario)')
    .eq('user_id', userId)
    .eq('plantio_id', plantioId)
    .eq('tipo', 'saida')
    .order('data', { ascending: false });
  if (error) logDbError('loadMovimentosByLote', error);
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
  const { data, error } = await supabase
    .from('mao_obra_registros')
    .select('*')
    .eq('plantio_id', plantioId)
    .eq('user_id', userId)
    .order('data_inicio', { ascending: false });
  if (error) logDbError('loadMaoObraByLote', error);
  const registros = data || [];
  // A coluna é `valor` (custo do registro) — não horas × valor_hora (schema antigo).
  const total = registros.reduce((sum, r) => sum + (Number(r.valor) || 0), 0);
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
  const { data, error } = await supabase
    .from('mao_obra_registros')
    .select('*')
    .eq('user_id', userId)
    .in('plantio_id', plantioIds);
  if (error) logDbError('loadMaoObraBatch', error);
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
  const { data, error } = await supabase
    .from('vendas')
    .select('*')
    .eq('user_id', userId)
    .eq('plantio_id', plantioId)
    .order('data', { ascending: false });
  if (error) logDbError('loadVendas', error);
  return data || [];
}

/**
 * Load all sales records for the current user, newest first.
 */
export async function loadTodasVendas() {
  const userId = await getUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from('vendas')
    .select('*')
    .eq('user_id', userId)
    .order('data', { ascending: false });
  if (error) logDbError('loadTodasVendas', error);
  return data || [];
}

/**
 * Create a venda record. Returns the new row or null.
 */
export async function addVenda({ plantioId, data, quantidade, unidade, precoUnitario, destino, observacao, compradorId, categoria }) {
  const userId = await getUserId();
  if (!userId) return null;
  // Offline-safe: quem vende no campo muitas vezes está sem sinal.
  const { row, error } = await insertOfflineSafe('vendas', {
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
  });
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
export async function arquivarCicloLote(lote, vendas = [], despesas = [], maoObraRegistros = []) {
  try {
    const totalVendasKg = vendas.reduce((s, v) => s + (v.quantidade ?? 0), 0);
    const receitaTotal  = vendas.reduce((s, v) => s + (v.quantidade ?? 0) * (v.preco_unitario ?? 0), 0);
    const dataPlantio   = lote.data_plantio;
    const dataConclusao = new Date().toISOString().slice(0, 10);
    const diasCicloReal = dataPlantio
      ? Math.max(0, Math.floor((Date.now() - new Date(dataPlantio + 'T12:00:00')) / 86_400_000))
      : null;

    // Custos = o que foi efetivamente pago (despesas do lote). Mão de obra
    // separada; o restante (insumos, máquinas, etc.) entra em custoInsumos.
    const valor = (d) => parseFloat(d.valor) || 0;
    const custoMaoObra = despesas.filter(d => d.categoria === 'Mão de Obra').reduce((s, d) => s + valor(d), 0)
      + maoObraRegistros.reduce((s, r) => s + valor(r), 0);
    const custoInsumos = despesas.filter(d => d.categoria !== 'Mão de Obra').reduce((s, d) => s + valor(d), 0);

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

// ── Ciclos histórico (Supabase) ────────────────────────────────

async function saveCicloHistorico({ loteId, loteNome, culturaId, dataPlantio, dataConclusao, totalVendasKg, receitaTotal, custoInsumos, custoMaoObra, diasCicloReal, talhaoId = null, safraNúmero = null }) {
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
