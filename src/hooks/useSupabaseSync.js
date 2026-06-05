import { useEffect, useRef } from 'react';
import { supabase, getUserId } from '../lib/supabase';
import { logDbError } from '../lib/logger';
import { cacheSet, cacheGet } from './useOfflineCache';

/**
 * Debounced upsert of simulator config values to Supabase.
 * Falls back silently on error (localStorage is the source of truth locally).
 * Scoped per user: (user_id, cultura_id).
 */
export function useSimuladorSync(culturaId, valores) {
  const timerRef = useRef(null);

  useEffect(() => {
    if (!culturaId || !valores) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const userId = await getUserId();
      if (!userId) return;
      await supabase
        .from('simulador_configs')
        .upsert(
          { user_id: userId, cultura_id: culturaId, valores, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,cultura_id' },
        );
    }, 1500);
    return () => clearTimeout(timerRef.current);
  }, [culturaId, valores]);
}

/**
 * Load simulator config from Supabase on mount.
 * Returns the remote valores or null if not found / error.
 */
export async function loadSimuladorConfig(culturaId) {
  const userId = await getUserId();
  if (!userId) return null;
  const { data, error } = await supabase
    .from('simulador_configs')
    .select('valores')
    .eq('user_id', userId)
    .eq('cultura_id', culturaId)
    .single();
  if (error || !data) return null;
  return data.valores;
}

/**
 * Save a plantio record to Supabase. Returns the created row or null.
 */
export async function registrarPlantio(payload) {
  const userId = await getUserId();
  if (!userId) return null;
  const { data, error } = await supabase
    .from('plantios')
    .insert({ ...payload, user_id: userId })
    .select()
    .single();
  if (error) { logDbError('registrarPlantio', error); return null; }
  return data;
}

/**
 * Load all plantio lots for a specific cultura (only current user's).
 */
export async function loadLotes(culturaId) {
  const userId = await getUserId();
  if (!userId) return [];
  const { data } = await supabase
    .from('plantios')
    .select('*')
    .eq('user_id', userId)
    .eq('cultura_id', culturaId)
    .order('data_plantio', { ascending: false });
  return data || [];
}

/**
 * Load recent lots across all cultures (for Dashboard — only current user's).
 */
export async function loadTodosLotes(limit = 8) {
  const userId = await getUserId();
  if (!userId) return [];

  // Offline: return cached data if available
  const cacheKey = `lotes_${userId}_${limit}`;
  if (!navigator.onLine) {
    const cached = cacheGet(cacheKey);
    if (cached) return cached;
  }

  const { data, error } = await supabase
    .from('plantios')
    .select('*')
    .eq('user_id', userId)
    .order('data_plantio', { ascending: false })
    .limit(limit);

  if (!error && data) {
    cacheSet(cacheKey, data);
  }
  return data || (cacheGet(cacheKey) ?? []);
}

/**
 * Delete a plantio lot by id. Returns true on success.
 */
export async function deleteLote(id) {
  const { error } = await supabase.from('plantios').delete().eq('id', id);
  return !error;
}

/**
 * Update the mudas_feitas field of a lote (nursery progress tracking).
 * Returns the updated row or null.
 */
export async function updateLoteMudas(id, mudas_feitas) {
  const { data, error } = await supabase
    .from('plantios')
    .update({ mudas_feitas })
    .eq('id', id)
    .select()
    .single();
  if (error) { logDbError('updateLoteMudas', error); return null; }
  return data;
}

// ── Plantio Eventos (date-based event timeline) ──────────────────────────────

/**
 * Load all timeline events for a plantio, ordered chronologically.
 */
export async function loadEventos(plantioId) {
  const userId = await getUserId();
  if (!userId) return [];
  const { data } = await supabase
    .from('plantio_eventos')
    .select('*')
    .eq('user_id', userId)
    .eq('plantio_id', plantioId)
    .order('data', { ascending: true });
  return data || [];
}

/**
 * Add a new timeline event for a plantio. Returns the created row or null.
 */
export async function addEvento(payload) {
  const userId = await getUserId();
  if (!userId) return null;
  const { data, error } = await supabase
    .from('plantio_eventos')
    .insert({ ...payload, user_id: userId })
    .select()
    .single();
  if (error) { logDbError('addEvento', error); return null; }
  return data;
}

/**
 * Delete a timeline event by id. Returns true on success.
 */
export async function deleteEvento(id) {
  const { error } = await supabase.from('plantio_eventos').delete().eq('id', id);
  return !error;
}

/**
 * Load all harvest events (tipo = 'colheita') for the current user across all plantios.
 * Used by AnalysePage to compare actual vs projected production.
 */
export async function loadAllColheitaEventos() {
  const userId = await getUserId();
  if (!userId) return [];
  const { data } = await supabase
    .from('plantio_eventos')
    .select('*')
    .eq('user_id', userId)
    .eq('tipo', 'colheita')
    .order('data', { ascending: true });
  return data || [];
}

/**
 * Update the area_plantada_ha field of a lote (partial planting tracking).
 * Returns the updated row or null.
 */
export async function updateLotePlantado(id, area_plantada_ha) {
  const { data, error } = await supabase
    .from('plantios')
    .update({ area_plantada_ha })
    .eq('id', id)
    .select()
    .single();
  if (error) { logDbError('updateLotePlantado', error); return null; }
  return data;
}

/**
 * Pre-load default schedule steps when a new lot is created.
 * Inserts one row per step from cultura.cronograma (and etapasViveiro if applicable),
 * with is_custom=false and status='pendente'. Safe to call after registrarPlantio.
 *
 * @param {object} plantio    — the row returned by registrarPlantio (must have .id, .cultura_id)
 * @param {object} cultura    — the cultura object from CULTURAS[culturaId]
 * @param {number} diasViveiro — shift in days for the propagation method (0 if none)
 */
export async function preCarregarEtapasPadrao(plantio, cultura, diasViveiro = 0) {
  if (!plantio?.id || !cultura) return;
  const userId = await getUserId();
  if (!userId) return;

  const rows = [];

  // 1. Viveiro steps (from metodo_propagacao's etapasViveiro)
  const metodoObj = plantio.metodo_propagacao && cultura.metodosPropagacao
    ? cultura.metodosPropagacao.find(m => m.key === plantio.metodo_propagacao) || null
    : null;

  if (metodoObj?.etapasViveiro) {
    metodoObj.etapasViveiro.forEach(etapa => {
      rows.push({
        user_id:         userId,
        plantio_id:      plantio.id,
        cultura_id:      cultura.id,
        dia_previsto:    etapa.dia,
        etapa:           etapa.etapa,
        produto:         etapa.produto || '',
        dose:            etapa.dose || '',
        forma_aplicacao: etapa.forma || '',
        tipo:            etapa.tipo || 'manejo',
        status:          'pendente',
        is_custom:       false,
      });
    });
  }

  // 2. Standard cronograma steps (shifted by diasViveiro)
  if (cultura.cronograma) {
    cultura.cronograma.forEach(etapa => {
      const diaComShift = etapa.dia + (diasViveiro || 0);
      rows.push({
        user_id:         userId,
        plantio_id:      plantio.id,
        cultura_id:      cultura.id,
        dia_previsto:    diaComShift,
        etapa:           etapa.etapa,
        produto:         etapa.produto || '',
        dose:            etapa.dose || '',
        forma_aplicacao: etapa.forma || '',
        tipo:            etapa.tipo || 'manejo',
        status:          'pendente',
        is_custom:       false,
      });
    });
  }

  if (rows.length === 0) return;

  // Insert with ignoreDuplicates so re-runs don't fail if rows already exist
  const { error } = await supabase
    .from('cronograma_atividades')
    .upsert(rows, { onConflict: 'plantio_id,etapa,dia_previsto,is_custom', ignoreDuplicates: true });

  if (error) logDbError('preCarregarEtapasPadrao', error);
}

/**
 * Load all cronograma_atividades rows for a given plantio.
 * Used on mount to rehydrate status from Supabase (source of truth).
 */
export async function loadCronogramaAtividades(plantioId) {
  if (!plantioId) return [];
  const { data, error } = await supabase
    .from('cronograma_atividades')
    .select('*')
    .eq('plantio_id', plantioId)
    .order('dia_previsto', { ascending: true });
  if (error) { logDbError('loadCronogramaAtividades', error); return []; }
  return data || [];
}

/**
 * Upsert a cronograma activity status.
 * Used when the user marks a step as done.
 */
export async function syncCronogramaStatus(plantioId, culturaId, atividade) {
  // A4-13: retorna o id da atividade upserted para permitir vinculação com
  // estoque_movimentos (necessário para reverter saídas ao desfazer etapas).
  const { data, error } = await supabase
    .from('cronograma_atividades')
    .upsert(
      {
        plantio_id:      plantioId,
        cultura_id:      culturaId,
        dia_previsto:    atividade.dia,
        etapa:           atividade.etapa,
        produto:         atividade.produto        || '',
        dose:            atividade.dose           || '',
        forma_aplicacao: atividade.forma          || '',
        tipo:            atividade.tipo           || 'manejo',
        status:          atividade.status,
        data_execucao:   atividade.data           || null,
        observacao:      atividade.obs            || null,
        is_custom:       atividade.isCustom       || false,
        updated_at:      new Date().toISOString(),
      },
      // True upsert: update the existing row if one already exists for this
      // (plantio_id, etapa, dia_previsto, is_custom) tuple.
      // dia_previsto is part of the key so two custom rows with the same etapa
      // name on different days are treated as distinct rows (not overwritten).
      // NOTE: requires UNIQUE constraint on (plantio_id, etapa, dia_previsto, is_custom)
      //       in the DB. Run migration: see docs/migrations/add_dia_to_cron_unique.sql
      { onConflict: 'plantio_id,etapa,dia_previsto,is_custom' },
    )
    .select('id')
    .single();
  if (error) { logDbError('syncCronogramaStatus', error); return null; }
  return data?.id ?? null;
}

// ── Propriedades ──────────────────────────────────────────────────────────────

/**
 * Load all properties the current user has access to:
 * - farms they own (user_id = auth.uid())
 * - farms they are a member of (via farm_members)
 * Results are deduplicated and sorted alphabetically.
 */
export async function loadPropriedades() {
  const userId = await getUserId();
  if (!userId) return [];

  // Offline: return cached data if available
  const cacheKey = `propriedades_${userId}`;
  if (!navigator.onLine) {
    const cached = cacheGet(cacheKey);
    if (cached) return cached;
  }

  // Fetch farms where user is a member (RLS already filters to user's memberships)
  const { data, error } = await supabase
    .from('farm_members')
    .select('propriedades(*)')
    .eq('user_id', userId);

  if (error) {
    // Fallback: load only owned farms
    const { data: owned } = await supabase
      .from('propriedades')
      .select('*')
      .eq('user_id', userId)
      .order('nome');
    return owned || (cacheGet(cacheKey) ?? []);
  }

  // Flatten and deduplicate by id (I-14: guard against duplicate memberships)
  const seen = new Set();
  const farms = (data || [])
    .map(row => row.propriedades)
    .filter(p => p && !seen.has(p.id) && seen.add(p.id))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  cacheSet(cacheKey, farms);
  return farms;
}

/**
 * Create a new property. Returns the created row or null.
 */
export async function createPropriedade({ nome, descricao }) {
  const userId = await getUserId();
  if (!userId) return null;
  const { data, error } = await supabase
    .from('propriedades')
    .insert({ user_id: userId, nome, descricao: descricao || null })
    .select()
    .single();
  if (error) { logDbError('createPropriedade', error); return null; }
  return data;
}

/**
 * Update an existing property. Returns the updated row or null.
 */
export async function updatePropriedade(id, { nome, descricao }) {
  const { data, error } = await supabase
    .from('propriedades')
    .update({ nome, descricao: descricao || null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) { logDbError('updatePropriedade', error); return null; }
  return data;
}

/**
 * Delete a property and all its lotes (cascade).
 * Order: cronograma_atividades → plantio_eventos → plantios → propriedade.
 * Estoque is FK-cascade-deleted by the DB when the propriedade row is removed.
 */
export async function deletePropriedade(id) {
  const steps = [];
  try {
    // 1. Get all plantio IDs for this property
    const { data: plantiosRows, error: fetchErr } = await supabase
      .from('plantios')
      .select('id')
      .eq('propriedade_id', id);
    if (fetchErr) { logDbError('deletePropriedade:fetchPlantios', fetchErr); return false; }

    const plantioIds = (plantiosRows || []).map(r => r.id);

    if (plantioIds.length > 0) {
      // 2. Delete all child data for each plantio — collect errors.
      // A4-10: cascata estendida para evitar órfãos (FKs eram SET NULL)
      const childDeletes = [
        supabase.from('cronograma_atividades').delete().in('plantio_id', plantioIds),
        supabase.from('plantio_eventos').delete().in('plantio_id', plantioIds),
        supabase.from('mao_obra_registros').delete().in('plantio_id', plantioIds),
        supabase.from('diario_campo').delete().in('plantio_id', plantioIds),
        supabase.from('despesas').delete().in('plantio_id', plantioIds),
        supabase.from('receitas').delete().in('plantio_id', plantioIds),
        supabase.from('estoque_movimentos').delete().in('plantio_id', plantioIds),
        supabase.from('ciclos_historico').delete().in('lote_id', plantioIds),
      ];
      const results = await Promise.all(childDeletes);
      const childErrors = results.filter(r => r.error).map(r => r.error);
      if (childErrors.length > 0) {
        childErrors.forEach(e => logDbError('deletePropriedade:childDelete', e));
        return false;
      }
      steps.push('cronograma_atividades', 'plantio_eventos', 'mao_obra_registros',
                 'diario_campo', 'despesas', 'receitas', 'estoque_movimentos', 'ciclos_historico');

      // Delete venda_parcelas via vendas (FK: venda_parcelas → vendas, not covered by ON DELETE CASCADE)
      const { data: vendasRows, error: vendasErr } = await supabase
        .from('vendas').select('id').in('plantio_id', plantioIds);
      if (vendasErr) { logDbError('deletePropriedade:fetchVendas', vendasErr); return false; }
      const vendaIds = (vendasRows || []).map(r => r.id);
      if (vendaIds.length > 0) {
        const { error: parcelasErr } = await supabase
          .from('venda_parcelas').delete().in('venda_id', vendaIds);
        if (parcelasErr) { logDbError('deletePropriedade:venda_parcelas', parcelasErr); return false; }
      }
      const { error: vendasDelErr } = await supabase
        .from('vendas').delete().in('plantio_id', plantioIds);
      if (vendasDelErr) { logDbError('deletePropriedade:vendas', vendasDelErr); return false; }

      // 3. Delete lotes
      const { error: lotesErr } = await supabase
        .from('plantios').delete().eq('propriedade_id', id);
      if (lotesErr) { logDbError('deletePropriedade:plantios', lotesErr); return false; }
      steps.push('vendas', 'plantios');
    }

    // A4-10: Despesas/receitas registradas diretamente na propriedade (sem lote)
    await Promise.all([
      supabase.from('despesas').delete().eq('propriedade_id', id),
      supabase.from('receitas').delete().eq('propriedade_id', id),
    ]);

    // 4. Delete property (estoque cascade-deleted by FK)
    const { error } = await supabase.from('propriedades').delete().eq('id', id);
    if (error) { logDbError('deletePropriedade:propriedade', error); return false; }
    return true;
  } catch (err) {
    logDbError(`deletePropriedade:unexpected (completed steps: ${steps.join(',')})`, err);
    return false;
  }
}

/**
 * Delete a single lote and all its related data (events + schedule activities).
 * Returns true on success.
 */
export async function deleteLoteCompleto(id) {
  const steps = [];
  try {
    // Delete all child tables in parallel (safe: none depend on each other).
    // A4-09: cascata estendida para evitar órfãos (FKs eram SET NULL)
    const childDeletes = [
      supabase.from('cronograma_atividades').delete().eq('plantio_id', id),
      supabase.from('plantio_eventos').delete().eq('plantio_id', id),
      supabase.from('mao_obra_registros').delete().eq('plantio_id', id),
      supabase.from('diario_campo').delete().eq('plantio_id', id),
      supabase.from('despesas').delete().eq('plantio_id', id),
      supabase.from('receitas').delete().eq('plantio_id', id),
      supabase.from('estoque_movimentos').delete().eq('plantio_id', id),
      supabase.from('ciclos_historico').delete().eq('lote_id', id),
    ];
    const results = await Promise.all(childDeletes);
    const childErrors = results.filter(r => r.error).map(r => r.error);
    if (childErrors.length > 0) {
      childErrors.forEach(e => logDbError('deleteLoteCompleto:childDelete', e));
      return false;
    }
    steps.push('cronograma_atividades', 'plantio_eventos', 'mao_obra_registros',
               'diario_campo', 'despesas', 'receitas', 'estoque_movimentos', 'ciclos_historico');

    // Delete venda_parcelas antes das vendas (FK cascade não cobre esse caso)
    const { data: vendasRows, error: vendasErr } = await supabase
      .from('vendas').select('id').eq('plantio_id', id);
    if (vendasErr) { logDbError('deleteLoteCompleto:fetchVendas', vendasErr); return false; }
    const vendaIds = (vendasRows || []).map(r => r.id);
    if (vendaIds.length > 0) {
      const { error: parcelasErr } = await supabase
        .from('venda_parcelas').delete().in('venda_id', vendaIds);
      if (parcelasErr) { logDbError('deleteLoteCompleto:venda_parcelas', parcelasErr); return false; }
    }
    const { error: vendasDelErr } = await supabase
      .from('vendas').delete().eq('plantio_id', id);
    if (vendasDelErr) { logDbError('deleteLoteCompleto:vendas', vendasDelErr); return false; }
    steps.push('vendas');

    // Finally delete the lote itself
    const { error } = await supabase.from('plantios').delete().eq('id', id);
    if (error) { logDbError('deleteLoteCompleto:plantio', error); return false; }
    return true;
  } catch (err) {
    logDbError(`deleteLoteCompleto:unexpected (completed steps: ${steps.join(',')})`, err);
    return false;
  }
}

/**
 * Load all plantios belonging to a specific property.
 * Works for both owners and members (RLS handles access control).
 */
export async function loadLotesByPropriedade(propriedadeId) {
  if (!propriedadeId) return [];
  const { data } = await supabase
    .from('plantios')
    .select('*')
    .eq('propriedade_id', propriedadeId)
    .order('data_plantio', { ascending: false });
  return data || [];
}

/**
 * Count lotes per property accessible to the current user.
 * Returns an object: { [propriedadeId]: count }
 */
export async function countLotesByPropriedade() {
  const userId = await getUserId();
  if (!userId) return {};
  // Query via farm_members to get all accessible farm IDs, then count lotes
  const { data: memberships } = await supabase
    .from('farm_members')
    .select('farm_id')
    .eq('user_id', userId);
  if (!memberships || memberships.length === 0) return {};
  const farmIds = memberships.map(m => m.farm_id);
  const { data } = await supabase
    .from('plantios')
    .select('propriedade_id')
    .in('propriedade_id', farmIds);
  if (!data) return {};
  return data.reduce((acc, row) => {
    acc[row.propriedade_id] = (acc[row.propriedade_id] || 0) + 1;
    return acc;
  }, {});
}

// ── Talhões (Culturas Perenes) ────────────────────────────────────────────────

/**
 * Cria um novo talhão na tabela talhoes. Retorna o row criado ou null.
 */
export async function criarTalhao({ propriedadeId, nome, culturaId, dataImplantacao, areaHa, totalPlantas, metodoPropagacao, espacamentoLinhas, espacamentoPlanta, observacoes }) {
  const userId = await getUserId();
  if (!userId) return null;
  const { data, error } = await supabase
    .from('talhoes')
    .insert({
      user_id:              userId,
      propriedade_id:       propriedadeId,
      nome,
      cultura_id:           culturaId,
      data_implantacao:     dataImplantacao || null,
      area_ha:              areaHa || null,
      total_plantas:        totalPlantas || null,
      metodo_propagacao:    metodoPropagacao || null,
      espacamento_linhas:   espacamentoLinhas || null,
      espacamento_plantas:  espacamentoPlanta || null,
      observacoes:          observacoes || null,
      status:               'ativo',
    })
    .select()
    .single();
  if (error) { logDbError('criarTalhao', error); return null; }
  return data;
}

/**
 * Retorna todos os talhões ativos de uma propriedade.
 * Inclui contagem de safras (plantios) vinculadas ao talhão.
 */
export async function loadTalhoesPorPropriedade(propriedadeId) {
  if (!propriedadeId) return [];
  const { data, error } = await supabase
    .from('talhoes')
    .select('*, safras:plantios(id, status, safra_numero)')
    .eq('propriedade_id', propriedadeId)
    .eq('status', 'ativo')
    .order('nome');
  if (error) { logDbError('loadTalhoesPorPropriedade', error); return []; }
  // Normaliza: conta safras concluídas e identifica safra ativa
  return (data || []).map(t => {
    const safras = Array.isArray(t.safras) ? t.safras : [];
    return {
      ...t,
      safras_concluidas: safras.filter(s => s.status === 'concluido').length,
      safra_ativa:       safras.find(s => s.status === 'ativo') || null,
      total_safras:      safras.length,
    };
  });
}

/**
 * Retorna todos os talhões do usuário atual (todas as propriedades), apenas ativos.
 */
export async function loadTodosTalhoes() {
  const userId = await getUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from('talhoes')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'ativo')
    .order('nome');
  if (error) { logDbError('loadTodosTalhoes', error); return []; }
  return data || [];
}

/**
 * Retorna todos os plantios vinculados a um talhão, ordenados por safra_numero crescente.
 */
export async function loadSafrasDeTalhao(talhaoId) {
  if (!talhaoId) return [];
  const { data, error } = await supabase
    .from('plantios')
    .select('*')
    .eq('talhao_id', talhaoId)
    .order('safra_numero', { ascending: true });
  if (error) { logDbError('loadSafrasDeTalhao', error); return []; }
  return data || [];
}

/**
 * Cria uma nova safra (plantio) vinculada a um talhão perene.
 * O safra_numero é calculado como max(safra_numero existentes) + 1.
 * Copia area_ha, total_plantas, metodo_propagacao e propriedade_id do talhão.
 * Retorna o novo plantio ou null.
 *
 * @param {string} talhaoId   — UUID do talhão
 * @param {string} dataSafra  — data de início da safra (ISO date string)
 * @param {object} talhaoData — row do talhão (deve conter area_ha, total_plantas,
 *                              metodo_propagacao, propriedade_id, cultura_id, nome)
 */
export async function criarSafraDeTalhao(talhaoId, dataSafra, talhaoData) {
  const userId = await getUserId();
  if (!userId) return null;

  // Calcula o próximo número de safra
  const { data: safrasExistentes, error: fetchErr } = await supabase
    .from('plantios')
    .select('safra_numero')
    .eq('talhao_id', talhaoId)
    .order('safra_numero', { ascending: false })
    .limit(1);
  if (fetchErr) { logDbError('criarSafraDeTalhao:fetchSafras', fetchErr); return null; }

  const ultimaSafra = safrasExistentes?.[0]?.safra_numero ?? 0;
  const proximaSafra = ultimaSafra + 1;

  const { data, error } = await supabase
    .from('plantios')
    .insert({
      user_id:           userId,
      talhao_id:         talhaoId,
      propriedade_id:    talhaoData.propriedade_id || null,
      cultura_id:        talhaoData.cultura_id,
      nome:              `${talhaoData.nome || 'Talhão'} — Safra ${proximaSafra}`,
      data_plantio:      dataSafra,
      area_ha:           talhaoData.area_ha || null,
      total_plantas:     talhaoData.total_plantas || null,
      metodo_propagacao: talhaoData.metodo_propagacao || null,
      tipo_cultura:      'perene',
      safra_numero:      proximaSafra,
      status:            'ativo',
    })
    .select()
    .single();
  if (error) { logDbError('criarSafraDeTalhao', error); return null; }
  return data;
}

/**
 * Atualiza campos de um talhão. Retorna o row atualizado ou null.
 */
export async function atualizarTalhao(id, updates) {
  const { data, error } = await supabase
    .from('talhoes')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) { logDbError('atualizarTalhao', error); return null; }
  return data;
}

/**
 * Soft-delete de um talhão: marca status como 'inativo'.
 * Retorna true em caso de sucesso.
 */
export async function deletarTalhao(id) {
  const { error } = await supabase
    .from('talhoes')
    .update({ status: 'inativo', updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) { logDbError('deletarTalhao', error); return false; }
  return true;
}
