import { supabase, getUserId } from '../lib/supabase';
import { logDbError } from '../lib/logger';

// ── Category definitions ─────────────────────────────────────────────────────

export const CATEGORIAS_DESPESA = [
  {
    label: 'Insumos Agrícolas',
    subcategorias: ['Fertilizantes', 'Defensivos', 'Sementes/Mudas', 'Corretivos', 'Calcário', 'Adubo', 'Outros insumos'],
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

// ── Unit-of-measure mapping ───────────────────────────────────────────────────
// Returns the appropriate unit string for a given category + subcategory pair.

const UNIDADE_MAP = {
  'Insumos Agrícolas': {
    default:          'kg',
    'Fertilizantes':  'kg',
    'Defensivos':     'L',
    'Sementes/Mudas': 'un',
    'Corretivos':     'kg',
    'Calcário':       'ton',
    'Adubo':          'kg',
    'Outros insumos': 'un',
  },
  'Irrigação': {
    default:                 'h',
    'Energia elétrica':      'kWh',
    'Água':                  'm³',
    'Manutenção do sistema': 'un',
    'Peças e reposição':     'un',
  },
  'Mão de Obra': {
    default:                   'dia',
    'Diarista':                'dia',
    'Mensalista':              'mês',
    'Empreitada':              'ha',
    'Serviços especializados': 'h',
  },
  'Máquinas e Equipamentos': {
    default:           'h',
    'Combustível':     'L',
    'Aluguel de máquina': 'h',
    'Aquisição':       'un',
    'Manutenção':      'un',
    'Depreciação':     'un',
  },
  'Infraestrutura': {
    default:    'm²',
    'Estufa':   'm²',
    'Cercamento': 'm',
    'Construção': 'm²',
    'Reforma':  'm²',
    'Outros':   'un',
  },
  'Logística e Transporte': {
    default:                'km',
    'Combustível (veículo)':'L',
    'Embalagem transporte': 'un',
    'Pedágio':              'un',
  },
  'Embalagem e Comercialização': {
    default:                    'un',
    'Caixas':                   'un',
    'Sacolas':                  'un',
    'Etiquetas':                'un',
    'Taxas de comercialização': '%',
    'Outros':                   'un',
  },
  'Despesas Operacionais': {
    default:        'un',
    'Energia elétrica': 'kWh',
    'Água':         'm³',
    'Luz':          'kWh',
    'Internet':     'mês',
    'Aluguel área': 'mês',
    'Seguros':      'mês',
    'Outros':       'un',
  },
  'Análises e Consultorias': {
    default:                    'un',
    'Análise de solo':          'un',
    'Análise de água':          'un',
    'Consultoria agronômica':   'h',
    'Laudos':                   'un',
  },
  'Financeiro': {
    default:                      '%',
    'Juros':                      '%',
    'IOF':                        '%',
    'Tarifas bancárias':          'un',
    'Amortização de empréstimo':  'un',
  },
  'Compras Gerais': {
    default:                  'un',
    'Ferramentas':            'un',
    'EPI':                    'un',
    'Material de escritório': 'un',
    'Outros':                 'un',
  },
  'Pós-Colheita': {
    default:          'kg',
    'Armazenagem':    'm³',
    'Classificação':  'kg',
    'Beneficiamento': 'kg',
    'Refrigeração':   'kg',
  },
};

/**
 * Returns the auto unit string for a given categoria + optional subcategoria.
 */
export function getUnidade(categoria, subcategoria) {
  const catMap = UNIDADE_MAP[categoria];
  if (!catMap) return 'un';
  if (subcategoria && catMap[subcategoria]) return catMap[subcategoria];
  return catMap.default ?? 'un';
}


// ── Despesas CRUD ────────────────────────────────────────────────────────────

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
 */
export async function addDespesa({ plantioId, propriedadeId, categoria, subcategoria, descricao, prestador, quantidade, unidade, valor, data, observacao }) {
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
      quantidade:     quantidade != null && quantidade !== '' ? parseFloat(quantidade) : null,
      unidade:        unidade       || null,
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
      categoria:    updates.categoria    ?? undefined,
      subcategoria: updates.subcategoria ?? null,
      descricao:    updates.descricao    ?? null,
      prestador:    updates.prestador    ?? null,
      quantidade:   updates.quantidade != null ? parseFloat(updates.quantidade) : null,
      unidade:      updates.unidade      ?? null,
      valor:        updates.valor !== undefined ? parseFloat(updates.valor) || 0 : undefined,
      data:         updates.data         ?? undefined,
      observacao:   updates.observacao   ?? null,
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

// ── Receitas CRUD ────────────────────────────────────────────────────────────

/**
 * Load all receitas for a specific lote (plantio_id).
 */
export async function loadReceitasByLote(plantioId) {
  const userId = await getUserId();
  if (!userId || !plantioId) return [];

  const { data, error } = await supabase
    .from('receitas')
    .select('*')
    .eq('user_id', userId)
    .eq('plantio_id', plantioId)
    .order('data', { ascending: false });

  if (error) { logDbError('loadReceitasByLote', error); return []; }
  return data || [];
}

/**
 * Load all receitas for the current user.
 */
export async function loadTodasReceitas(propriedadeId = null) {
  const userId = await getUserId();
  if (!userId) return [];

  let q = supabase
    .from('receitas')
    .select('*')
    .eq('user_id', userId)
    .order('data', { ascending: false });

  if (propriedadeId) q = q.eq('propriedade_id', propriedadeId);

  const { data, error } = await q;
  if (error) { logDbError('loadTodasReceitas', error); return []; }
  return data || [];
}

/**
 * Add a new receita record.
 */
export async function addReceita({ plantioId, propriedadeId, categoria, descricao, comprador, quantidade, unidade, valor, data, observacao }) {
  const userId = await getUserId();
  if (!userId) return null;

  const { data: row, error } = await supabase
    .from('receitas')
    .insert({
      user_id:        userId,
      plantio_id:     plantioId     || null,
      propriedade_id: propriedadeId || null,
      categoria,
      descricao:      descricao     || null,
      comprador:      comprador     || null,
      quantidade:     quantidade != null && quantidade !== '' ? parseFloat(quantidade) : null,
      unidade:        unidade       || null,
      valor:          parseFloat(valor) || 0,
      data,
      observacao:     observacao    || null,
    })
    .select()
    .single();

  if (error) { logDbError('addReceita', error); return null; }
  return row;
}

/**
 * Delete a receita record by id.
 */
export async function deleteReceita(id) {
  const { error } = await supabase
    .from('receitas')
    .delete()
    .eq('id', id);

  if (error) { logDbError('deleteReceita', error); return false; }
  return true;
}
