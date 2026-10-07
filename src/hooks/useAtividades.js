/**
 * useAtividades.js — registros do lote (o que foi feito e o que está agendado).
 *
 * Nada é previsto pelo sistema: cada registro é lançado pelo produtor e é
 *   - AGENDADO  → vai acontecer (data_prevista), ou
 *   - REALIZADO → já aconteceu (data_execucao).
 *
 * Regras que ficam NO BANCO (gatilhos — ver migração 20261007):
 *   - registro realizado com produto do estoque → saída automática (converte
 *     g→kg, mL→L); editar/reabrir/excluir refaz ou estorna;
 *   - registro de colheita realizado com quantidade → produção do lote.
 * Assim as gravações podem ir para a fila offline (sem sinal no campo) sem
 * nunca baixar o estoque duas vezes.
 *
 * Fotos: bucket privado `oryagro-attachments`, em
 * user/<uid>/atividades/<atividadeId>/…, com referência em atividade_fotos.
 * Sem conexão as fotos não sobem (o registro sim) — o chamador avisa.
 */
import { supabase, getUserId } from '../lib/supabase';
import { logDbError } from '../lib/logger';
import { insertOfflineSafe, updateOfflineSafe, deleteOfflineSafe, pendentes } from '../lib/outbox';

const BUCKET = 'oryagro-attachments';

/** Categorias do registro (a colheita tem fluxo próprio no Anotar). */
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

export const getCategoria = (value) =>
  CATEGORIAS_ATIVIDADE.find(c => c.value === value) || CATEGORIAS_ATIVIDADE[CATEGORIAS_ATIVIDADE.length - 1];

/** Status de um registro. */
export const STATUS = { AGENDADO: 'agendado', REALIZADO: 'feito' };

/** Status que contam como registro do produtor (o resto é legado do plano-guia). */
const STATUS_VISIVEIS = [STATUS.REALIZADO, STATUS.AGENDADO];

/** A data que vale para ordenar/exibir: execução se realizado, senão a prevista. */
export const dataDoLancamento = (a) => a?.data_execucao || a?.data_prevista || null;

/** Data de hoje no fuso LOCAL (toISOString usaria UTC e viraria o dia às 21h). */
export function hojeLocalISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Leitura ──────────────────────────────────────────────────────────────────

/**
 * Junta o que veio do banco com o que ainda está na fila offline (marcado com
 * `_pendente`) — o produtor vê o que anotou sem sinal.
 */
function comPendentes(rows, filtroPlantio) {
  const ids = new Set(rows.map(r => r.id));
  const fila = pendentes('cronograma_atividades')
    .filter(r => filtroPlantio(r.plantio_id) && STATUS_VISIVEIS.includes(r.status) && !ids.has(r.id));
  return [...rows, ...fila];
}

/**
 * Registros de um lote (+ os pendentes na fila).
 * Retorna null se a leitura falhar — o chamador mantém o que já mostra.
 */
export async function loadAtividades(plantioId) {
  if (!plantioId) return [];
  const { data, error } = await supabase
    .from('cronograma_atividades')
    .select('*')
    .eq('plantio_id', plantioId)
    .in('status', STATUS_VISIVEIS);
  if (error) { logDbError('loadAtividades', error); return null; }
  return comPendentes(data || [], id => id === plantioId);
}

/**
 * Registros de VÁRIOS lotes numa consulta (Início, Agenda, Lista de compras).
 * Retorna null se a leitura falhar.
 */
export async function loadAtividadesPorLotes(plantioIds = []) {
  const ids = plantioIds.filter(Boolean);
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from('cronograma_atividades')
    .select('*')
    .in('plantio_id', ids)
    .in('status', STATUS_VISIVEIS);
  if (error) { logDbError('loadAtividadesPorLotes', error); return null; }
  const set = new Set(ids);
  return comPendentes(data || [], id => set.has(id));
}

/**
 * Resumo dos AGENDADOS (de um lote ou de vários): quantos estão atrasados e
 * quais são o de hoje, o de amanhã e o próximo.
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

// ── Regras puras (testadas) ──────────────────────────────────────────────────

const normUn = (u) => String(u || '').trim().toLowerCase();

/**
 * Converte a quantidade lançada para a unidade do item de estoque — mesma regra
 * de fn_qtd_na_unidade no banco (aqui serve para a prévia no Anotar).
 * Ex.: 25 g num item em kg → 0,025. Unidades incompatíveis (g × L) → null.
 */
export function qtdNaUnidadeDoEstoque(qtd, unidade, unidadeEstoque) {
  const q = parseFloat(String(qtd ?? '').replace(',', '.'));
  if (!Number.isFinite(q) || q <= 0) return null;
  const para = normUn(unidadeEstoque);
  const de = normUn(unidade) || para;
  if (!para || de === para) return q;
  const FATOR = {
    'g>kg': 1 / 1000, 'kg>g': 1000,
    'ml>l': 1 / 1000, 'l>ml': 1000,
    'kg>t': 1 / 1000, 't>kg': 1000,
    'kg>ton': 1 / 1000, 'ton>kg': 1000,
    't>ton': 1, 'ton>t': 1,
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

/** Monta as colunas de um registro a partir do formulário do Anotar. */
export function linhaDoRegistro(form) {
  const cat = getCategoria(form.categoria);
  const qtd = parseFloat(String(form.quantidade ?? '').replace(',', '.'));
  return {
    etapa:           (form.etapa || form.produto || cat.label).slice(0, 200),
    categoria:       cat.value,
    tipo:            cat.tipo,
    produto:         form.produto    || null,
    insumo_id:       form.insumoId   || null,
    quantidade:      Number.isFinite(qtd) ? qtd : null,
    unidade:         Number.isFinite(qtd) ? (form.unidade || null) : null,
    observacao:      form.observacao || null,
    status:          form.agendado ? STATUS.AGENDADO : STATUS.REALIZADO,
    data_prevista:   form.agendado ? form.data : null,
    data_execucao:   form.agendado ? null : form.data,
  };
}

// ── Gravação (offline-safe) ──────────────────────────────────────────────────

/**
 * Cria registros em um ou mais lotes, em uma ou mais datas (repetição).
 * Datas futuras num "Já fiz" viram agendadas automaticamente.
 * Retorna { criados, falhas, offline, fotosPendentes }.
 */
export async function salvarLancamentos({ lotes = [], form, datas = [], arquivos = [], hojeISO }) {
  const hoje = hojeISO || hojeLocalISO();
  let criados = 0, falhas = 0, offline = 0, fotosPendentes = 0;
  for (const lote of lotes) {
    for (const data of datas) {
      const { row, queued, error } = await insertOfflineSafe('cronograma_atividades', {
        ...linhaDoRegistro({ ...form, data, agendado: form.agendado || data > hoje }),
        plantio_id:  lote.id,
        cultura_id:  lote.cultura_id,
        is_custom:   true,
        dia_previsto: null,
      });
      if (error || !row) { logDbError('salvarLancamentos', error); falhas += 1; continue; }
      criados += 1;
      if (queued) { offline += 1; fotosPendentes += arquivos.length; continue; }
      fotosPendentes += await enviarFotos(row.id, arquivos);
    }
  }
  return { criados, falhas, offline, fotosPendentes };
}

/** Edita um registro (o banco refaz a baixa no estoque). Retorna { ok, offline, fotosPendentes }. */
export async function editarLancamento(id, form, { arquivos = [] } = {}) {
  const { row, queued, error } = await updateOfflineSafe('cronograma_atividades', id, {
    ...linhaDoRegistro(form),
    updated_at: new Date().toISOString(),
  });
  if (error || !row) { logDbError('editarLancamento', error); return { ok: false }; }
  const fotosPendentes = queued ? arquivos.length : await enviarFotos(id, arquivos);
  return { ok: true, offline: queued, fotosPendentes };
}

/** Marca um agendado como feito (o banco dá a baixa no estoque). */
export async function concluirLancamento(atividade, data) {
  return mudarStatus(atividade.id, { status: STATUS.REALIZADO, data_execucao: data, data_prevista: null });
}

/** Volta um realizado para agendado (o banco estorna o estoque). */
export async function reabrirLancamento(atividade) {
  return mudarStatus(atividade.id, {
    status: STATUS.AGENDADO, data_prevista: dataDoLancamento(atividade), data_execucao: null,
  });
}

async function mudarStatus(id, patch) {
  const { row, error } = await updateOfflineSafe('cronograma_atividades', id, {
    ...patch, updated_at: new Date().toISOString(),
  });
  if (error || !row) { logDbError('mudarStatus', error); return null; }
  return row;
}

/** Exclui um registro (o banco estorna o estoque; as fotos vão junto). */
export async function excluirLancamento(atividade) {
  try { await deleteFotosDaAtividade(atividade.id); } catch { /* sem rede: o registro importa mais */ }
  const { ok, error } = await deleteOfflineSafe('cronograma_atividades', atividade.id);
  if (!ok) logDbError('excluirLancamento', error);
  return ok;
}

// ── Fotos ────────────────────────────────────────────────────────────────────

/** Envia as fotos de um registro. Retorna quantas NÃO subiram. */
async function enviarFotos(atividadeId, arquivos = []) {
  if (!arquivos.length) return 0;
  const enviadas = await Promise.all(arquivos.map(f => uploadFoto(atividadeId, f)));
  return enviadas.filter(x => !x).length;
}

/** Fotos de VÁRIOS registros numa consulta só, com URLs assinadas em lote. */
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
  const { data: urls } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(fotos.map(f => f.storage_path), 3600);
  const porPath = Object.fromEntries((urls || []).map(u => [u.path, u.signedUrl]));
  const out = {};
  fotos.forEach(f => {
    out[f.atividade_id] = out[f.atividade_id] || [];
    out[f.atividade_id].push({ ...f, url: porPath[f.storage_path] || null });
  });
  return out;
}

/**
 * Envia uma foto. O caminho obedece ao RLS do bucket:
 * user/<uid>/atividades/<atividadeId>/<arquivo>.
 */
async function uploadFoto(atividadeId, file, legenda = null) {
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
  return row;
}

/** Remove uma foto (arquivo + referência). */
export async function deleteFoto(fotoId, storagePath) {
  if (!fotoId) return false;
  if (storagePath) await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
  const { error } = await supabase.from('atividade_fotos').delete().eq('id', fotoId);
  if (error) { logDbError('deleteFoto', error); return false; }
  return true;
}

/** Apaga os arquivos das fotos de um registro (as linhas caem em cascata). */
async function deleteFotosDaAtividade(atividadeId) {
  const { data } = await supabase
    .from('atividade_fotos').select('storage_path').eq('atividade_id', atividadeId);
  const paths = (data || []).map(f => f.storage_path).filter(Boolean);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths).catch(() => {});
}
