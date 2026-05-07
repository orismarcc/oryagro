import { supabase } from '../lib/supabase';
import { logDbError } from '../lib/logger';

async function getUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Carrega todos os dados brutos para a DRE:
 * - vendas de todos os lotes do usuário (com data)
 * - movimentos de saída com preço (join estoque_insumos para preco_unitario)
 * - despesas de todos os lotes
 * - plantios com data_plantio, status, cultura_id, nome, propriedade_id, mao_obra_total (legado)
 */
export async function loadDreRawData() {
  const userId = await getUserId();
  if (!userId) return { vendas: [], movimentos: [], despesas: [], plantios: [] };

  const [vendasRes, movimentosRes, despesasRes, plantiosRes] = await Promise.all([
    supabase
      .from('vendas')
      .select('id, plantio_id, comprador_id, data, quantidade, unidade, preco_unitario, destino')
      .eq('user_id', userId)
      .order('data', { ascending: false }),

    supabase
      .from('estoque_movimentos')
      .select('id, plantio_id, insumo_id, quantidade, data, tipo, estoque_insumos(preco_unitario, nome, unidade)')
      .eq('user_id', userId)
      .eq('tipo', 'saida')
      .order('data', { ascending: false }),

    supabase
      .from('despesas')
      .select('id, plantio_id, categoria, subcategoria, descricao, prestador, valor, data')
      .eq('user_id', userId)
      .order('data', { ascending: false }),

    supabase
      .from('plantios')
      .select('id, nome, cultura_id, propriedade_id, status, data_plantio, mao_obra_total, area_ha, total_plantas')
      .eq('user_id', userId)
      .order('data_plantio', { ascending: false }),
  ]);

  if (vendasRes.error)     logDbError('loadDreRawData.vendas', vendasRes.error);
  if (movimentosRes.error) logDbError('loadDreRawData.movimentos', movimentosRes.error);
  if (despesasRes.error)   logDbError('loadDreRawData.despesas', despesasRes.error);
  if (plantiosRes.error)   logDbError('loadDreRawData.plantios', plantiosRes.error);

  return {
    vendas:     vendasRes.data     || [],
    movimentos: movimentosRes.data || [],
    despesas:   despesasRes.data   || [],
    plantios:   plantiosRes.data   || [],
  };
}

/**
 * Carrega ciclos_historico ordenados por archived_at desc
 */
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
