/**
 * backupExport.js — Export and import full property backups for OryAgro.
 *
 * Exported file format: `.oryagro` (JSON with a known envelope).
 */

import { supabase } from '../lib/supabase';
import { logDbError } from '../lib/logger';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeName(nome) {
  return (nome || 'propriedade')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function omitKeys(obj, keys) {
  if (!obj) return obj;
  const out = { ...obj };
  for (const k of keys) delete out[k];
  return out;
}

// ─── Export ───────────────────────────────────────────────────────────────────

/**
 * Exports all property data to a downloadable `.oryagro` JSON file.
 *
 * @param {string} propriedadeId
 * @param {string} propriedadeNome  Used only for the filename.
 */
export async function exportPropriedadeBackup(propriedadeId, propriedadeNome) {
  try {
    // 1. Fetch property row
    const { data: propRow, error: propErr } = await supabase
      .from('propriedades')
      .select('nome, descricao, localizacao, area_total_ha, created_at')
      .eq('id', propriedadeId)
      .single();
    if (propErr) { logDbError('exportPropriedadeBackup/propriedades', propErr); throw propErr; }

    // 2. Fetch plantios
    const { data: plantios, error: plantiosErr } = await supabase
      .from('plantios')
      .select('id, nome, cultura_id, data_plantio, area_ha, area_plantada_ha, total_plantas, comprimento_m, largura_m, metodo_propagacao, status, mao_obra_total, mudas_feitas, espacamento_linhas, espacamento_plantas, propriedade_id, created_at')
      .eq('propriedade_id', propriedadeId);
    if (plantiosErr) { logDbError('exportPropriedadeBackup/plantios', plantiosErr); throw plantiosErr; }

    // 3. For each plantio fetch related sub-tables
    const lotes = await Promise.all((plantios || []).map(async (plantio) => {
      const [
        { data: eventos,    error: evErr  },
        { data: cronograma, error: crErr  },
        { data: diario,     error: diErr  },
        { data: vendas,     error: veErr  },
      ] = await Promise.all([
        supabase.from('plantio_eventos')
          .select('id, plantio_id, tipo, descricao, data, observacoes, created_at')
          .eq('plantio_id', plantio.id),
        supabase.from('cronograma_atividades')
          .select('*')
          .eq('plantio_id', plantio.id),
        supabase.from('diario_campo')
          .select('id, plantio_id, data, titulo, descricao, tipo, created_at')
          .eq('plantio_id', plantio.id),
        supabase.from('vendas')
          .select('id, plantio_id, data_venda, quantidade_kg, preco_kg, comprador, observacoes, created_at')
          .eq('plantio_id', plantio.id),
      ]);

      if (evErr) logDbError('exportPropriedadeBackup/plantio_eventos', evErr);
      if (crErr) logDbError('exportPropriedadeBackup/cronograma_atividades', crErr);
      if (diErr) logDbError('exportPropriedadeBackup/diario_campo', diErr);
      if (veErr) logDbError('exportPropriedadeBackup/vendas', veErr);

      return {
        nome:               plantio.nome,
        cultura_id:         plantio.cultura_id,
        data_plantio:       plantio.data_plantio,
        area_ha:            plantio.area_ha,
        area_plantada_ha:   plantio.area_plantada_ha,
        total_plantas:      plantio.total_plantas,
        comprimento_m:      plantio.comprimento_m,
        largura_m:          plantio.largura_m,
        metodo_propagacao:  plantio.metodo_propagacao,
        status:             plantio.status,
        mao_obra_total:     plantio.mao_obra_total,
        mudas_feitas:       plantio.mudas_feitas,
        espacamento_linhas: plantio.espacamento_linhas,
        espacamento_plantas: plantio.espacamento_plantas,
        _originalId:        plantio.id,
        eventos:            (eventos    || []).map(e => omitKeys(e, ['user_id'])),
        cronograma:         (cronograma || []),
        diario:             (diario     || []).map(d => omitKeys(d, ['user_id'])),
        vendas:             (vendas     || []).map(v => omitKeys(v, ['user_id'])),
      };
    }));

    // 4. Fetch estoque_insumos
    const { data: insumos, error: insErr } = await supabase
      .from('estoque_insumos')
      .select('id, nome, unidade, quantidade, quantidade_minima, preco_unitario, propriedade_id, created_at')
      .eq('propriedade_id', propriedadeId);
    if (insErr) { logDbError('exportPropriedadeBackup/estoque_insumos', insErr); throw insErr; }

    // 5. For each insumo fetch movements
    const insumosFull = await Promise.all((insumos || []).map(async (insumo) => {
      const { data: movimentos, error: movErr } = await supabase
        .from('estoque_movimentos')
        .select('id, insumo_id, tipo, quantidade, data, observacoes, created_at')
        .eq('insumo_id', insumo.id);
      if (movErr) logDbError('exportPropriedadeBackup/estoque_movimentos', movErr);

      return {
        nome:              insumo.nome,
        unidade:           insumo.unidade,
        quantidade:        insumo.quantidade,
        quantidade_minima: insumo.quantidade_minima,
        preco_unitario:    insumo.preco_unitario,
        _originalId:       insumo.id,
        movimentos: (movimentos || []).map(m => ({
          ...omitKeys(m, ['user_id', 'insumo_id']),
          insumo_nome: insumo.nome,
        })),
      };
    }));

    // 6. Build envelope
    const backup = {
      version:    '1.0',
      format:     'oryagro-property-backup',
      exportedAt: new Date().toISOString(),
      propriedade: {
        nome:          propRow.nome,
        descricao:     propRow.descricao,
        localizacao:   propRow.localizacao,
        area_total_ha: propRow.area_total_ha,
      },
      lotes,
      estoque: { insumos: insumosFull },
    };

    // 7. Trigger download
    const filename = `backup-${sanitizeName(propriedadeNome)}-${todayISO()}.oryagro`;
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    return { success: true };
  } catch (err) {
    logDbError('exportPropriedadeBackup', err);
    return { success: false, error: String(err?.message ?? err) };
  }
}

// ─── Import ───────────────────────────────────────────────────────────────────

/**
 * Imports a backup JSON, creating a NEW property.
 *
 * @param {object} jsonData   Parsed `.oryagro` backup object.
 * @param {string} userId     Authenticated user's UUID.
 * @returns {{ success: boolean, propriedade?: object, error?: string }}
 */
export async function importPropriedadeBackup(jsonData, userId) {
  try {
    // 1. Validate envelope
    if (!jsonData || jsonData.format !== 'oryagro-property-backup') {
      return { success: false, error: 'Arquivo inválido: formato não reconhecido.' };
    }
    if (!jsonData.version) {
      return { success: false, error: 'Arquivo inválido: versão ausente.' };
    }
    if (!userId) {
      return { success: false, error: 'Usuário não autenticado.' };
    }

    const prop = jsonData.propriedade || {};

    // 2. Create new propriedade
    const { data: newProp, error: propErr } = await supabase
      .from('propriedades')
      .insert({
        nome:          prop.nome          || 'Propriedade Importada',
        descricao:     prop.descricao     || null,
        localizacao:   prop.localizacao   || null,
        area_total_ha: prop.area_total_ha || null,
        user_id:       userId,
      })
      .select()
      .single();
    if (propErr) {
      logDbError('importPropriedadeBackup/propriedades', propErr);
      return { success: false, error: `Erro ao criar propriedade: ${propErr.message}` };
    }

    const loteIdMap   = {}; // _originalId → new DB id
    const lotes       = jsonData.lotes   || [];
    const insumos     = (jsonData.estoque?.insumos) || [];

    // 3. Insert lotes and their sub-tables
    for (const lote of lotes) {
      const lotePayload = {
        nome:               lote.nome,
        cultura_id:         lote.cultura_id,
        data_plantio:       lote.data_plantio,
        area_ha:            lote.area_ha            ?? null,
        area_plantada_ha:   lote.area_plantada_ha   ?? null,
        total_plantas:      lote.total_plantas       ?? 0,
        comprimento_m:      lote.comprimento_m      ?? null,
        largura_m:          lote.largura_m           ?? null,
        metodo_propagacao:  lote.metodo_propagacao  ?? null,
        status:             lote.status             ?? 'ativo',
        mao_obra_total:     lote.mao_obra_total     ?? null,
        mudas_feitas:       lote.mudas_feitas        ?? 0,
        espacamento_linhas: lote.espacamento_linhas ?? null,
        espacamento_plantas: lote.espacamento_plantas ?? null,
        propriedade_id:     newProp.id,
        user_id:            userId,
      };

      const { data: newLote, error: loteErr } = await supabase
        .from('plantios')
        .insert(lotePayload)
        .select('id')
        .single();
      if (loteErr) {
        logDbError('importPropriedadeBackup/plantios', loteErr);
        return { success: false, error: `Erro ao importar lote "${lote.nome}": ${loteErr.message}` };
      }

      if (lote._originalId) loteIdMap[lote._originalId] = newLote.id;
      const newLoteId = newLote.id;

      // 3b. Eventos
      if (lote.eventos?.length) {
        const evPayload = lote.eventos.map(e => ({
          ...omitKeys(e, ['id', 'plantio_id', 'user_id']),
          plantio_id: newLoteId,
          user_id:    userId,
        }));
        const { error: evErr } = await supabase.from('plantio_eventos').insert(evPayload);
        if (evErr) logDbError('importPropriedadeBackup/plantio_eventos', evErr);
      }

      // 3c. Cronograma
      if (lote.cronograma?.length) {
        const crPayload = lote.cronograma.map(c => ({
          ...omitKeys(c, ['id', 'plantio_id']),
          plantio_id: newLoteId,
        }));
        const { error: crErr } = await supabase.from('cronograma_atividades').insert(crPayload);
        if (crErr) logDbError('importPropriedadeBackup/cronograma_atividades', crErr);
      }

      // 3d. Diário
      if (lote.diario?.length) {
        const diPayload = lote.diario.map(d => ({
          ...omitKeys(d, ['id', 'plantio_id', 'user_id']),
          plantio_id: newLoteId,
          user_id:    userId,
        }));
        const { error: diErr } = await supabase.from('diario_campo').insert(diPayload);
        if (diErr) logDbError('importPropriedadeBackup/diario_campo', diErr);
      }

      // 3e. Vendas
      if (lote.vendas?.length) {
        const vePayload = lote.vendas.map(v => ({
          ...omitKeys(v, ['id', 'plantio_id', 'user_id']),
          plantio_id: newLoteId,
          user_id:    userId,
        }));
        const { error: veErr } = await supabase.from('vendas').insert(vePayload);
        if (veErr) logDbError('importPropriedadeBackup/vendas', veErr);
      }
    }

    // 4. Insert estoque insumos and movements
    for (const insumo of insumos) {
      const insumoPayload = {
        nome:              insumo.nome,
        unidade:           insumo.unidade           || 'un',
        quantidade:        insumo.quantidade        ?? 0,
        quantidade_minima: insumo.quantidade_minima ?? 0,
        preco_unitario:    insumo.preco_unitario    ?? null,
        propriedade_id:    newProp.id,
        user_id:           userId,
      };

      const { data: newInsumo, error: insErr } = await supabase
        .from('estoque_insumos')
        .insert(insumoPayload)
        .select('id')
        .single();
      if (insErr) {
        logDbError('importPropriedadeBackup/estoque_insumos', insErr);
        return { success: false, error: `Erro ao importar insumo "${insumo.nome}": ${insErr.message}` };
      }

      // 4b. Movements
      if (insumo.movimentos?.length) {
        const movPayload = insumo.movimentos.map(m => ({
          ...omitKeys(m, ['id', 'insumo_id', 'insumo_nome', 'user_id']),
          insumo_id: newInsumo.id,
          user_id:   userId,
        }));
        const { error: movErr } = await supabase.from('estoque_movimentos').insert(movPayload);
        if (movErr) logDbError('importPropriedadeBackup/estoque_movimentos', movErr);
      }
    }

    return { success: true, propriedade: newProp };
  } catch (err) {
    logDbError('importPropriedadeBackup', err);
    return { success: false, error: String(err?.message ?? err) };
  }
}
