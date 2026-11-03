/**
 * useRateio.js — membros (sócios) do lote, rateio das despesas entre eles,
 * pendências/quitação, comprovantes e compras da propriedade distribuídas
 * entre os lotes. Regras de conta em `src/lib/rateio.js`.
 */
import { supabase, getUserId } from '../lib/supabase';
import { logDbError } from '../lib/logger';
import { clientUuid } from '../lib/outbox';
import { hojeLocalISO } from './useAtividades';

const BUCKET = 'oryagro-attachments';

// ── Membros ──────────────────────────────────────────────────────────────────

export async function loadMembros(plantioId) {
  if (!plantioId) return [];
  const { data, error } = await supabase
    .from('lote_membros').select('*').eq('plantio_id', plantioId).order('created_at');
  if (error) { logDbError('loadMembros', error); return []; }
  return data || [];
}

/** Membros de vários lotes: { [plantioId]: membro[] } */
export async function loadMembrosPorLotes(plantioIds = []) {
  const ids = plantioIds.filter(Boolean);
  if (!ids.length) return {};
  const { data, error } = await supabase
    .from('lote_membros').select('*').in('plantio_id', ids).order('created_at');
  if (error) { logDbError('loadMembrosPorLotes', error); return {}; }
  const out = {};
  (data || []).forEach(m => { (out[m.plantio_id] = out[m.plantio_id] || []).push(m); });
  return out;
}

export async function addMembro(plantioId, { nome, email, papel = 'membro', participaRateio = true }) {
  const { data, error } = await supabase
    .from('lote_membros')
    .insert({ plantio_id: plantioId, nome: nome.trim(), email: email.trim().toLowerCase(), papel, participa_rateio: participaRateio })
    .select().single();
  if (error) { logDbError('addMembro', error); return { ok: false, duplicado: error.code === '23505' }; }
  return { ok: true, membro: data };
}

export async function updateMembro(id, patch) {
  const { error } = await supabase.from('lote_membros').update(patch).eq('id', id);
  if (error) { logDbError('updateMembro', error); return false; }
  return true;
}

export async function removeMembro(id) {
  const { error } = await supabase.from('lote_membros').delete().eq('id', id);
  if (error) { logDbError('removeMembro', error); return false; }
  return true;
}

// ── Rateio ───────────────────────────────────────────────────────────────────

/** Rateios de várias despesas: { [despesaId]: rateio[] } (com o membro). */
export async function loadRateios(despesaIds = []) {
  const ids = despesaIds.filter(Boolean);
  if (!ids.length) return {};
  const { data, error } = await supabase
    .from('despesa_rateios').select('*, membro:lote_membros(id, nome, email, user_id)').in('despesa_id', ids);
  if (error) { logDbError('loadRateios', error); return {}; }
  const out = {};
  (data || []).forEach(r => { (out[r.despesa_id] = out[r.despesa_id] || []).push(r); });
  return out;
}

/**
 * Grava o rateio de uma despesa (substitui o anterior).
 * `linhas` = [{ membroId, valor, status }]; partes com valor 0 são ignoradas.
 */
export async function salvarRateio(despesaId, linhas = [], pagadorMembroId = null) {
  const { error: delErr } = await supabase.from('despesa_rateios').delete().eq('despesa_id', despesaId);
  if (delErr) { logDbError('salvarRateio(del)', delErr); return false; }
  const hoje = hojeLocalISO();
  const rows = linhas
    .filter(l => Number(l.valor) > 0)
    .map(l => ({
      despesa_id: despesaId,
      membro_id: l.membroId,
      valor: Math.round(Number(l.valor) * 100) / 100,
      status: l.status === 'pendente' ? 'pendente' : 'pago',
      quitado_em: l.status === 'pendente' ? null : hoje,
    }));
  if (rows.length) {
    const { error } = await supabase.from('despesa_rateios').insert(rows);
    if (error) { logDbError('salvarRateio', error); return false; }
  }
  const { error: pErr } = await supabase.from('despesas')
    .update({ pagador_membro_id: pagadorMembroId || null }).eq('id', despesaId);
  if (pErr) logDbError('salvarRateio(pagador)', pErr);
  return true;
}

/** Marca uma parte pendente como quitada (ou reabre). */
export async function quitarRateio(rateioId, quitar = true) {
  const userId = await getUserId();
  const { error } = await supabase.from('despesa_rateios')
    .update(quitar
      ? { status: 'pago', quitado_em: hojeLocalISO(), quitado_por: userId }
      : { status: 'pendente', quitado_em: null, quitado_por: null })
    .eq('id', rateioId);
  if (error) { logDbError('quitarRateio', error); return false; }
  return true;
}

/**
 * Todas as partes PENDENTES que o usuário enxerga (as dele e, se gere o lote,
 * as dos outros), com a despesa e o lote — para o aviso destacado do Início.
 */
export async function loadPendencias() {
  const { data, error } = await supabase
    .from('despesa_rateios')
    .select('*, membro:lote_membros(id, nome, user_id), despesa:despesas(id, data, valor, produto, descricao, categoria, subcategoria, plantio_id)')
    .eq('status', 'pendente')
    .order('created_at', { ascending: true });
  if (error) { logDbError('loadPendencias', error); return []; }
  return data || [];
}

// ── Comprovantes ─────────────────────────────────────────────────────────────

const TIPOS_ACEITOS = /^(image\/|application\/pdf$)/;

/** Envia um comprovante (foto ou PDF) para a despesa. */
export async function uploadComprovante(despesaId, file) {
  const userId = await getUserId();
  if (!userId || !despesaId || !file) return null;
  if (!TIPOS_ACEITOS.test(file.type || '')) return { erro: 'tipo' };
  if (file.size > 10 * 1024 * 1024) return { erro: 'tamanho' };

  const ext = (file.name?.split('.').pop() || (file.type === 'application/pdf' ? 'pdf' : 'jpg'))
    .toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `user/${userId}/despesas/${despesaId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: upErr } = await supabase.storage.from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) { logDbError('uploadComprovante(storage)', upErr); return null; }

  const { data, error } = await supabase.from('despesa_anexos')
    .insert({ despesa_id: despesaId, storage_path: path, nome: file.name || null, mime: file.type })
    .select().single();
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    logDbError('uploadComprovante(db)', error);
    return null;
  }
  return data;
}

/** Comprovantes de várias despesas com URL assinada: { [despesaId]: anexo[] } */
export async function loadComprovantes(despesaIds = []) {
  const ids = despesaIds.filter(Boolean);
  if (!ids.length) return {};
  const { data, error } = await supabase
    .from('despesa_anexos').select('*').in('despesa_id', ids).order('created_at');
  if (error) { logDbError('loadComprovantes', error); return {}; }
  const anexos = data || [];
  if (!anexos.length) return {};
  const { data: urls } = await supabase.storage.from(BUCKET)
    .createSignedUrls(anexos.map(a => a.storage_path), 3600);
  const porPath = Object.fromEntries((urls || []).map(u => [u.path, u.signedUrl]));
  const out = {};
  anexos.forEach(a => { (out[a.despesa_id] = out[a.despesa_id] || []).push({ ...a, url: porPath[a.storage_path] || null }); });
  return out;
}

export async function removeComprovante(anexo) {
  const { error } = await supabase.from('despesa_anexos').delete().eq('id', anexo.id);
  if (error) { logDbError('removeComprovante', error); return false; }
  await supabase.storage.from(BUCKET).remove([anexo.storage_path]).catch(() => {});
  return true;
}

// ── Compra da propriedade distribuída entre lotes ───────────────────────────

/**
 * Grava a compra da PROPRIEDADE (despesa "mãe", sem lote — não entra no
 * financeiro de nenhum lote) e uma despesa por destino, ligada à mãe, que é a
 * que conta no lote. Cada destino pode levar seu rateio entre membros.
 *
 * destinos = [{ plantioId, quantidade, valor, rateio: [{membroId, valor, status}], pagadorMembroId }]
 */
export async function registrarCompraPropriedade({
  propriedadeId, data, categoria, subcategoria, produto, descricao, prestador,
  quantidade, unidade, valor, observacao, destinos = [],
}) {
  const userId = await getUserId();
  if (!userId) return { ok: false, motivo: 'sessao' };

  const base = {
    user_id: userId, propriedade_id: propriedadeId, data, categoria,
    subcategoria: subcategoria || null, produto: produto || null, descricao: descricao || null,
    prestador: prestador || null, observacao: observacao || null,
  };
  const qtd = Number(quantidade);
  const mae = {
    ...base, id: clientUuid(), plantio_id: null,
    quantidade: qtd > 0 ? qtd : null, unidade: qtd > 0 ? (unidade || null) : null,
    valor: Math.round(Number(valor) * 100) / 100,
  };
  const { error } = await supabase.from('despesas').insert(mae);
  if (error) { logDbError('registrarCompraPropriedade(mae)', error); return { ok: false, motivo: 'despesa' }; }

  const filhas = [];
  for (const d of destinos) {
    const q = Number(d.quantidade);
    const filha = {
      ...base, id: clientUuid(), plantio_id: d.plantioId, despesa_origem_id: mae.id,
      quantidade: q > 0 ? q : null, unidade: q > 0 ? (unidade || null) : null,
      valor: Math.round(Number(d.valor) * 100) / 100,
    };
    const { error: fErr } = await supabase.from('despesas').insert(filha);
    if (fErr) { logDbError('registrarCompraPropriedade(destino)', fErr); return { ok: false, motivo: 'destino', despesaId: mae.id }; }
    if (d.rateio?.length) await salvarRateio(filha.id, d.rateio, d.pagadorMembroId);
    filhas.push(filha);
  }
  return { ok: true, despesaId: mae.id, filhas };
}

/** Compras da propriedade (mães) com seus destinos. */
export async function loadComprasPropriedade(propriedadeId) {
  if (!propriedadeId) return [];
  const { data, error } = await supabase
    .from('despesas').select('*')
    .eq('propriedade_id', propriedadeId).is('plantio_id', null)
    .order('data', { ascending: false });
  if (error) { logDbError('loadComprasPropriedade', error); return []; }
  const maes = data || [];
  if (!maes.length) return [];
  const { data: filhas } = await supabase
    .from('despesas').select('*').in('despesa_origem_id', maes.map(m => m.id));
  const porMae = {};
  (filhas || []).forEach(f => { (porMae[f.despesa_origem_id] = porMae[f.despesa_origem_id] || []).push(f); });
  return maes.map(m => ({ ...m, destinos: porMae[m.id] || [] }));
}
