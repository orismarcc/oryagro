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
import { addMovimento, deleteMovimentoByCronogramaAtividade } from './useGestao';

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
  { value: 'solo',            label: 'Solo / capina',          emoji: '⛏️', tipo: 'manejo',    usaInsumo: false },
  { value: 'colheita',        label: 'Colheita',               emoji: '🌾', tipo: 'colheita',  usaInsumo: false },
  { value: 'monitoramento',   label: 'Monitoramento / análise', emoji: '🔍', tipo: 'manejo',   usaInsumo: false },
  { value: 'anotacao',        label: 'Anotação / observação',  emoji: '📝', tipo: 'manejo',    usaInsumo: false },
  { value: 'outros',          label: 'Outros',                 emoji: '📌', tipo: 'manejo',    usaInsumo: false },
];

/** Status que contam como LANÇAMENTO do produtor (o resto é legado do plano-guia). */
const STATUS_VISIVEIS = ['feito', 'agendado'];

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
    .in('status', STATUS_VISIVEIS)
    .order('data_execucao', { ascending: false, nullsFirst: false })
    .order('data_prevista', { ascending: false, nullsFirst: false });
  if (error) { logDbError('loadAtividades', error); return []; }
  return data || [];
}

/**
 * Lançamentos de VÁRIOS lotes numa consulta — usado pelo Dashboard, Calendário
 * e Notificações, que antes derivavam do guia da cultura.
 */
export async function loadAtividadesPorLotes(plantioIds = []) {
  const ids = plantioIds.filter(Boolean);
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from('cronograma_atividades')
    .select('*')
    .in('plantio_id', ids)
    .in('status', STATUS_VISIVEIS);
  if (error) { logDbError('loadAtividadesPorLotes', error); return []; }
  return data || [];
}

/** Data de hoje no fuso LOCAL (toISOString usaria UTC e viraria o dia às 21h). */
export function hojeLocalISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Resumo dos AGENDADOS de um conjunto de lançamentos (de um lote ou de vários):
 * quantos estão atrasados e quais são o de hoje, o de amanhã e o próximo.
 * Substitui a previsão que saía do cronograma-guia.
 */
export function resumoAgendados(atividades = [], hojeISO) {
  const hoje = hojeISO || hojeLocalISO();
  const amanhaDate = new Date(`${hoje}T12:00:00`);
  amanhaDate.setDate(amanhaDate.getDate() + 1);
  const amanhaISO = amanhaDate.toISOString().slice(0, 10);

  const agendados = atividades
    .filter(a => a.status === STATUS.AGENDADO && a.data_prevista)
    .sort((a, b) => a.data_prevista.localeCompare(b.data_prevista));

  return {
    atrasadas: agendados.filter(a => a.data_prevista < hoje).length,
    hoje:      agendados.find(a => a.data_prevista === hoje)      || null,
    amanha:    agendados.find(a => a.data_prevista === amanhaISO)  || null,
    proxima:   agendados.find(a => a.data_prevista > amanhaISO)    || null,
    agendados,
  };
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
      // só mudou a data: mantém o status atual (quem decide o campo é o status)
      const { data: atual } = await supabase
        .from('cronograma_atividades').select('status').eq('id', id).single();
      if (atual?.status === STATUS.AGENDADO) patch.data_prevista = data;
      else patch.data_execucao = data;
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

/** Fotos de VÁRIOS lançamentos numa consulta só (lista do lote). */
export async function loadFotosPorAtividades(atividadeIds = []) {
  const ids = atividadeIds.filter(Boolean);
  if (!ids.length) return {};
  const { data, error } = await supabase
    .from('atividade_fotos')
    .select('*')
    .in('atividade_id', ids)
    .order('created_at', { ascending: true });
  if (error) { logDbError('loadFotosPorAtividades', error); return {}; }
  const fotos = data || [];
  if (!fotos.length) return {};
  // URLs assinadas em lote (1 requisição) — o bucket é privado
  const { data: urls } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(fotos.map(f => f.storage_path), 3600);
  const porPath = Object.fromEntries((urls || []).map(u => [u.path, u.signedUrl]));
  const out = {};
  fotos.forEach(f => {
    (out[f.atividade_id] = out[f.atividade_id] || []).push({ ...f, url: porPath[f.storage_path] || null });
  });
  return out;
}

// ── Regras puras (testadas) ──────────────────────────────────────────────────

const normUn = (u) => String(u || '').trim().toLowerCase();

/**
 * Converte a quantidade lançada para a unidade do item de estoque.
 * Ex.: 25 g num item em kg → 0,025. Unidades incompatíveis (g × L) → null,
 * e aí NÃO se dá baixa (melhor não mexer do que mexer errado).
 */
export function qtdNaUnidadeDoEstoque(qtd, unidade, unidadeEstoque) {
  const q = parseFloat(String(qtd ?? '').replace(',', '.'));
  if (!Number.isFinite(q) || q <= 0) return null;
  const de = normUn(unidade) || normUn(unidadeEstoque);
  const para = normUn(unidadeEstoque);
  if (!para || de === para) return q;
  const FATOR = {
    'g>kg': 1 / 1000, 'kg>g': 1000,
    'ml>l': 1 / 1000, 'l>ml': 1000,
    'kg>t': 1 / 1000, 't>kg': 1000,
  };
  const f = FATOR[`${de}>${para}`];
  return f ? Math.round(q * f * 1e6) / 1e6 : null;
}

/**
 * Datas de uma repetição: da data inicial até `ate`, a cada `intervaloDias`.
 * Sem repetição devolve só a data inicial. Limite de 60 ocorrências.
 */
export function gerarDatas(inicio, { intervaloDias = 0, ate = null } = {}) {
  if (!inicio) return [];
  const passo = parseInt(intervaloDias, 10);
  if (!passo || passo < 1 || !ate || ate < inicio) return [inicio];
  const out = [];
  const d = new Date(`${inicio}T12:00:00`);
  while (out.length < 60) {
    const iso = d.toISOString().slice(0, 10);
    if (iso > ate) break;
    out.push(iso);
    d.setDate(d.getDate() + passo);
  }
  return out;
}

// ── Operações completas (lançamento + estoque + fotos) ──────────────────────
// Usadas pelo "Anotar" (global e do lote), pelo Início e pela Agenda, para
// que a baixa no estoque siga SEMPRE a mesma regra.

/** Dá baixa no estoque de um lançamento REALIZADO (se tiver insumo e qtd). */
async function baixarEstoque(row, estoque = []) {
  if (!row?.insumo_id || row.status !== STATUS.REALIZADO) return { ok: true, baixou: false };
  const item = estoque.find(i => String(i.id) === String(row.insumo_id));
  const qtd = qtdNaUnidadeDoEstoque(row.quantidade, row.unidade, item?.unidade ?? row.unidade);
  if (qtd == null) return { ok: true, baixou: false, incompativel: !!row.quantidade };
  const mov = await addMovimento({
    insumoId: row.insumo_id,
    tipo: 'saida',
    quantidade: qtd,
    observacao: `Cronograma: ${row.etapa}`,
    data: row.data_execucao,
    plantioId: row.plantio_id,
    cronogramaAtividadeId: row.id,
  });
  return { ok: !!mov, baixou: !!mov };
}

/**
 * Cria lançamentos em um ou mais lotes, em uma ou mais datas (repetição).
 * Datas futuras num "Já fiz" viram agendadas automaticamente.
 * Retorna { criados, falhas, semBaixa }.
 */
export async function salvarLancamentos({
  lotes = [], form, datas = [], arquivos = [], estoque = [], hojeISO,
}) {
  const hoje = hojeISO || hojeLocalISO();
  let criados = 0, falhas = 0, semBaixa = 0;
  for (const lote of lotes) {
    for (const data of datas) {
      const agendado = form.agendado || data > hoje;
      const row = await addAtividade({
        ...form,
        plantioId: lote.id,
        culturaId: lote.cultura_id,
        insumoId: form.insumoId || null,
        data,
        agendado,
      });
      if (!row) { falhas += 1; continue; }
      criados += 1;
      const b = await baixarEstoque(row, estoque);
      if (b.incompativel) semBaixa += 1;
      if (arquivos.length) await Promise.all(arquivos.map(f => uploadFoto(row.id, f)));
    }
  }
  return { criados, falhas, semBaixa };
}

/** Edita um lançamento e refaz a baixa no estoque (estorna e baixa de novo). */
export async function editarLancamento(id, form, { arquivos = [], estoque = [] } = {}) {
  await deleteMovimentoByCronogramaAtividade(id);
  const row = await updateAtividade(id, { ...form, insumoId: form.insumoId || null });
  if (!row) return null;
  await baixarEstoque(row, estoque);
  if (arquivos.length) await Promise.all(arquivos.map(f => uploadFoto(row.id, f)));
  return row;
}

/** Marca um agendado como feito (com baixa no estoque). */
export async function concluirLancamento(atividade, data, estoque = []) {
  const row = await concluirAtividade(atividade.id, data);
  if (!row) return null;
  await baixarEstoque(row, estoque);
  return row;
}

/** Volta um realizado para agendado (estorna o estoque). */
export async function reabrirLancamento(atividade) {
  await deleteMovimentoByCronogramaAtividade(atividade.id);
  return reabrirAtividade(atividade.id, dataDoLancamento(atividade));
}

/** Exclui um lançamento (estorna o estoque e apaga as fotos). */
export async function excluirLancamento(atividade) {
  await deleteMovimentoByCronogramaAtividade(atividade.id);
  return deleteAtividade(atividade.id);
}
