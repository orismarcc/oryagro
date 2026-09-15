/**
 * useAtividades.js — Lançamentos do cronograma do lote.
 *
 * Modelo NOVO: o cronograma não traz mais um plano pré-definido pelo sistema.
 * Tudo aqui é lançado pelo produtor, e cada lançamento pode ser:
 *   - AGENDADO  → vai acontecer (tem data_prevista)
 *   - REALIZADO → já aconteceu (tem data_execucao)
 * Um agendado pode ser concluído depois, virando realizado.
 *
 * Reaproveita a tabela cronograma_atividades (is_custom = true em tudo que é
 * lançado pelo usuário) e a ligação com o estoque já existente
 * (estoque_movimentos.cronograma_atividade_id).
 *
 * Fotos: o arquivo vai para o bucket privado `oryagro-attachments` em
 * user/<uid>/atividades/<atividadeId>/..., e a referência fica em atividade_fotos.
 */
import { supabase, getUserId } from '../lib/supabase';
import { logDbError } from '../lib/logger';

const BUCKET = 'oryagro-attachments';

/** Categorias do lançamento — organizam o cronograma do lote. */
export const CATEGORIAS_ATIVIDADE = [
  { value: 'adubacao_solo',   label: 'Adubação (solo)',        emoji: '🧪', tipo: 'adubo',     usaInsumo: true },
  { value: 'fertirrigacao',   label: 'Fertirrigação',          emoji: '💧', tipo: 'adubo',     usaInsumo: true },
  { value: 'adubacao_foliar', label: 'Adubação foliar',        emoji: '🌿', tipo: 'foliar',    usaInsumo: true },
  { value: 'defensivo',       label: 'Defensivo / fitossanitário', emoji: '🛡️', tipo: 'aplicacao', usaInsumo: true },
  { value: 'irrigacao',       label: 'Irrigação',              emoji: '🚿', tipo: 'manejo',    usaInsumo: false },
  { value: 'plantio',         label: 'Plantio / muda',         emoji: '🌱', tipo: 'plantio',   usaInsumo: false },
  { value: 'poda',            label: 'Poda / condução',        emoji: '✂️', tipo: 'manejo',    usaInsumo: false },
  { value: 'solo',            label: 'Solo / capina',          emoji: '🪨', tipo: 'manejo',    usaInsumo: false },
  { value: 'colheita',        label: 'Colheita',               emoji: '🌾', tipo: 'colheita',  usaInsumo: false },
  { value: 'monitoramento',   label: 'Monitoramento / análise', emoji: '🔍', tipo: 'manejo',   usaInsumo: false },
  { value: 'outros',          label: 'Outros',                 emoji: '📌', tipo: 'manejo',    usaInsumo: false },
];

export const getCategoria = (value) =>
  CATEGORIAS_ATIVIDADE.find(c => c.value === value) || CATEGORIAS_ATIVIDADE[CATEGORIAS_ATIVIDADE.length - 1];

/** Status de um lançamento. */
export const STATUS = { AGENDADO: 'agendado', REALIZADO: 'feito' };

/** A data que vale para ordenar/exibir: execução se realizado, senão a prevista. */
export const dataDoLancamento = (a) => a?.data_execucao || a?.data_prevista || null;

// ── Leitura ──────────────────────────────────────────────────────────────────

/** Lançamentos de um lote, do mais recente para o mais antigo. */
export async function loadAtividades(plantioId) {
  if (!plantioId) return [];
  const { data, error } = await supabase
    .from('cronograma_atividades')
    .select('*')
    .eq('plantio_id', plantioId)
    .neq('status', 'removida')
    .order('data_execucao', { ascending: false, nullsFirst: false })
    .order('data_prevista', { ascending: false, nullsFirst: false });
  if (error) { logDbError('loadAtividades', error); return []; }
  return data || [];
}

// ── Escrita ──────────────────────────────────────────────────────────────────

/**
 * Cria um lançamento. `agendado: true` guarda em data_prevista; senão em
 * data_execucao (já realizado). Devolve a linha criada (ou null).
 */
export async function addAtividade({
  plantioId, culturaId, categoria, etapa, produto, insumoId,
  quantidade, unidade, observacao, data, agendado = false, forma,
}) {
  const userId = await getUserId();
  if (!userId || !plantioId) return null;
  const cat = getCategoria(categoria);

  const { data: row, error } = await supabase
    .from('cronograma_atividades')
    .insert({
      plantio_id:      plantioId,
      cultura_id:      culturaId,
      etapa:           (etapa || cat.label).slice(0, 200),
      categoria,
      tipo:            cat.tipo,
      produto:         produto   || null,
      insumo_id:       insumoId  || null,
      quantidade:      quantidade != null && quantidade !== '' ? parseFloat(quantidade) : null,
      unidade:         unidade   || null,
      observacao:      observacao || null,
      forma_aplicacao: forma     || null,
      status:          agendado ? STATUS.AGENDADO : STATUS.REALIZADO,
      data_prevista:   agendado ? data : null,
      data_execucao:   agendado ? null : data,
      is_custom:       true,
      dia_previsto:    null,
    })
    .select()
    .single();

  if (error) { logDbError('addAtividade', error); return null; }
  return row;
}

/** Atualiza os campos informados de um lançamento. */
export async function updateAtividade(id, updates) {
  if (!id) return null;
  const patch = {};
  if (updates.categoria !== undefined) {
    patch.categoria = updates.categoria;
    patch.tipo = getCategoria(updates.categoria).tipo;
  }
  if (updates.etapa       !== undefined) patch.etapa       = updates.etapa;
  if (updates.produto     !== undefined) patch.produto     = updates.produto     || null;
  if (updates.insumoId    !== undefined) patch.insumo_id   = updates.insumoId    || null;
  if (updates.unidade     !== undefined) patch.unidade     = updates.unidade     || null;
  if (updates.observacao  !== undefined) patch.observacao  = updates.observacao  || null;
  if (updates.forma       !== undefined) patch.forma_aplicacao = updates.forma   || null;
  if (updates.quantidade  !== undefined) {
    patch.quantidade = updates.quantidade != null && updates.quantidade !== ''
      ? parseFloat(updates.quantidade) : null;
  }
  // Troca de agendado ⇄ realizado move a data para o campo certo.
  if (updates.agendado !== undefined || updates.data !== undefined) {
    const agendado = updates.agendado;
    const data = updates.data;
    if (agendado === true)  { patch.status = STATUS.AGENDADO;  patch.data_prevista = data ?? undefined; patch.data_execucao = null; }
    if (agendado === false) { patch.status = STATUS.REALIZADO; patch.data_execucao = data ?? undefined; patch.data_prevista = null; }
    if (agendado === undefined && data !== undefined) {
      // só mudou a data: mantém o status atual
      patch.data_execucao = data;
    }
  }
  patch.updated_at = new Date().toISOString();

  const { data: row, error } = await supabase
    .from('cronograma_atividades')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) { logDbError('updateAtividade', error); return null; }
  return row;
}

/** Marca um agendado como realizado na data informada. */
export async function concluirAtividade(id, dataExecucao) {
  return updateAtividade(id, { agendado: false, data: dataExecucao });
}

/** Volta um realizado para agendado (desfaz a conclusão). */
export async function reabrirAtividade(id, dataPrevista) {
  return updateAtividade(id, { agendado: true, data: dataPrevista });
}

/** Exclui o lançamento (as fotos caem em cascata; o arquivo é removido antes). */
export async function deleteAtividade(id) {
  if (!id) return false;
  try { await deleteFotosDaAtividade(id); } catch { /* segue: o registro importa mais */ }
  const { error } = await supabase.from('cronograma_atividades').delete().eq('id', id);
  if (error) { logDbError('deleteAtividade', error); return false; }
  return true;
}

// ── Fotos ────────────────────────────────────────────────────────────────────

/** Fotos de um lançamento (com URL assinada pronta para exibir). */
export async function loadFotos(atividadeId) {
  if (!atividadeId) return [];
  const { data, error } = await supabase
    .from('atividade_fotos')
    .select('*')
    .eq('atividade_id', atividadeId)
    .order('created_at', { ascending: true });
  if (error) { logDbError('loadFotos', error); return []; }
  const fotos = data || [];
  return Promise.all(fotos.map(async (f) => ({ ...f, url: await urlDaFoto(f.storage_path) })));
}

/** URL assinada (o bucket é privado) — válida por 1 hora. */
export async function urlDaFoto(storagePath) {
  if (!storagePath) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 3600);
  if (error) { logDbError('urlDaFoto', error); return null; }
  return data?.signedUrl ?? null;
}

/**
 * Envia uma foto do lançamento. O caminho obedece ao RLS do bucket:
 * user/<uid>/atividades/<atividadeId>/<arquivo>.
 */
export async function uploadFoto(atividadeId, file, legenda = null) {
  const userId = await getUserId();
  if (!userId || !atividadeId || !file) return null;

  const ext = (file.name?.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const nome = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = `user/${userId}/atividades/${atividadeId}/${nome}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false });
  if (upErr) { logDbError('uploadFoto(storage)', upErr); return null; }

  const { data: row, error } = await supabase
    .from('atividade_fotos')
    .insert({ atividade_id: atividadeId, storage_path: path, legenda })
    .select()
    .single();
  if (error) {
    // não deixa arquivo órfão no bucket se a referência falhar
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    logDbError('uploadFoto(db)', error);
    return null;
  }
  return { ...row, url: await urlDaFoto(path) };
}

/** Remove uma foto (arquivo + referência). */
export async function deleteFoto(fotoId, storagePath) {
  if (!fotoId) return false;
  if (storagePath) await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
  const { error } = await supabase.from('atividade_fotos').delete().eq('id', fotoId);
  if (error) { logDbError('deleteFoto', error); return false; }
  return true;
}

/** Remove todas as fotos de um lançamento (usado antes de excluí-lo). */
export async function deleteFotosDaAtividade(atividadeId) {
  const { data } = await supabase
    .from('atividade_fotos').select('storage_path').eq('atividade_id', atividadeId);
  const paths = (data || []).map(f => f.storage_path).filter(Boolean);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths).catch(() => {});
  return paths.length;
}
