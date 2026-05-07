import { supabase } from '../lib/supabase';
import { logDbError } from '../lib/logger';

// ── Category definitions ─────────────────────────────────────────────────────

export const CATEGORIAS_DESPESA = [
  {
    label: 'Insumos Agrícolas',
    subcategorias: ['Fertilizantes', 'Defensivos', 'Sementes/Mudas', 'Corretivos', 'Outros insumos'],
  },
  {
    label: 'Irrigação',
    subcategorias: ['Energia elétrica', 'Manutenção do sistema', 'Água', 'Peças e reposição'],
  },
  {
    label: 'Mão de Obra',
    subcategorias: ['Diarista', 'Mensalista', 'Empreitada', 'Serviços especializados'],
  },
  {
    label: 'Máquinas e Equipamentos',
    subcategorias: ['Aluguel de máquina', 'Combustível', 'Manutenção', 'Depreciação', 'Aquisição'],
  },
  {
    label: 'Infraestrutura',
    subcategorias: ['Construção', 'Reforma', 'Estufa', 'Cercamento', 'Outros'],
  },
  {
    label: 'Logística e Transporte',
    subcategorias: ['Frete', 'Combustível (veículo)', 'Pedágio', 'Embalagem transporte'],
  },
  {
    label: 'Embalagem e Comercialização',
    subcategorias: ['Caixas', 'Sacolas', 'Etiquetas', 'Taxas de comercialização', 'Outros'],
  },
  {
    label: 'Despesas Operacionais',
    subcategorias: ['Água', 'Luz', 'Internet', 'Aluguel área', 'Seguros', 'Outros'],
  },
  {
    label: 'Análises e Consultorias',
    subcategorias: ['Análise de solo', 'Análise de água', 'Consultoria agronômica', 'Laudos'],
  },
  {
    label: 'Financeiro',
    subcategorias: ['Juros', 'IOF', 'Tarifas bancárias', 'Amortização de empréstimo'],
  },
  {
    label: 'Compras Gerais',
    subcategorias: ['Ferramentas', 'EPI', 'Material de escritório', 'Outros'],
  },
  {
    label: 'Pós-Colheita',
    subcategorias: ['Armazenagem', 'Classificação', 'Beneficiamento', 'Refrigeração'],
  },
];

export const CATEGORIAS_RECEITA = [
  { label: 'Venda de produção in-natura' },
  { label: 'Produtos processados' },
  { label: 'Venda de mudas e propagação' },
  { label: 'Outras receitas' },
];

// ── Auth helper ──────────────────────────────────────────────────────────────

async function getUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// ── CRUD functions ───────────────────────────────────────────────────────────

/**
 * Load all despesas for a specific lote (plantio_id).
 * Returns array sorted by date descending.
 */
export async function loadDespesasByLote(plantioId) {
  const userId = await getUserId();
  if (!userId || !plantioId) return [];

  const { data, error } = await supabase
    .from('despesas')
    .select('*')
    .eq('user_id', userId)
    .eq('plantio_id', plantioId)
    .order('data', { ascending: false });

  if (error) { logDbError('loadDespesasByLote', error); return []; }
  return data || [];
}

/**
 * Load all despesas for the current user, optionally filtered by propriedade_id.
 */
export async function loadTodasDespesas(propriedadeId = null) {
  const userId = await getUserId();
  if (!userId) return [];

  let q = supabase
    .from('despesas')
    .select('*')
    .eq('user_id', userId)
    .order('data', { ascending: false });

  if (propriedadeId) q = q.eq('propriedade_id', propriedadeId);

  const { data, error } = await q;
  if (error) { logDbError('loadTodasDespesas', error); return []; }
  return data || [];
}

/**
 * Add a new despesa record.
 * @param {Object} params
 * @param {string} params.plantioId
 * @param {string|null} params.propriedadeId
 * @param {string} params.categoria
 * @param {string|null} params.subcategoria
 * @param {string|null} params.descricao
 * @param {string|null} params.prestador
 * @param {number} params.valor
 * @param {string} params.data  — ISO date string e.g. "2026-05-07"
 * @param {string|null} params.observacao
 * @returns {Object|null} The created row or null on error
 */
export async function addDespesa({ plantioId, propriedadeId, categoria, subcategoria, descricao, prestador, valor, data, observacao }) {
  const userId = await getUserId();
  if (!userId) return null;

  const { data: row, error } = await supabase
    .from('despesas')
    .insert({
      user_id:        userId,
      plantio_id:     plantioId     || null,
      propriedade_id: propriedadeId || null,
      categoria,
      subcategoria:   subcategoria  || null,
      descricao:      descricao     || null,
      prestador:      prestador     || null,
      valor:          parseFloat(valor) || 0,
      data,
      observacao:     observacao    || null,
    })
    .select()
    .single();

  if (error) { logDbError('addDespesa', error); return null; }
  return row;
}

/**
 * Update an existing despesa record.
 */
export async function updateDespesa(id, updates) {
  const { data, error } = await supabase
    .from('despesas')
    .update({
      categoria:      updates.categoria     ?? undefined,
      subcategoria:   updates.subcategoria  ?? null,
      descricao:      updates.descricao     ?? null,
      prestador:      updates.prestador     ?? null,
      valor:          updates.valor !== undefined ? parseFloat(updates.valor) || 0 : undefined,
      data:           updates.data          ?? undefined,
      observacao:     updates.observacao    ?? null,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) { logDbError('updateDespesa', error); return null; }
  return data;
}

/**
 * Delete a despesa record by id.
 */
export async function deleteDespesa(id) {
  const { error } = await supabase
    .from('despesas')
    .delete()
    .eq('id', id);

  if (error) { logDbError('deleteDespesa', error); return false; }
  return true;
}
