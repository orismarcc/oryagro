/**
 * outbox.js — fila de escritas offline com retry automático.
 *
 * Quando uma escrita IDEMPOTENTE falha por falta de conexão, ela é enfileirada
 * em localStorage e reenviada automaticamente quando a internet volta. Isso é
 * essencial para uso em campo sem sinal (ex.: marcar etapas do cronograma).
 *
 * ⚠️ SEGURANÇA: só enfileiramos operações IDEMPOTENTES.
 *   - insert COM id gerado no cliente (enqueueInsert): o id é a chave primária,
 *     então um reenvio duplicado viola a unique constraint (código 23505) — que
 *     tratamos como sucesso ("já inserido"). Isso torna inserts seguros para a
 *     fila offline sem gerar duplicatas nem alterar saldo de estoque 2×.
 *   - update/delete POR id: aplicar de novo dá o mesmo resultado.
 * A fila é reenviada NA ORDEM em que foi gravada (insert antes do update dele).
 * O saldo do estoque é mantido por gatilhos no banco, então reenviar um
 * registro nunca baixa o estoque duas vezes.
 * NUNCA enfileire inserts SEM id de cliente (gerariam linhas duplicadas).
 */
import { supabase } from './supabase';
import { logWarn } from './logger';

const KEY = 'oryagro_outbox_v1';

/** Gera um UUID v4 no cliente (cobre WebView/Safari antigos sem crypto.randomUUID). */
export function clientUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Detecta falha de REDE (não de regra do banco).
 *
 * Em campo o caso comum não é `navigator.onLine === false`, e sim sinal fraco:
 * o navegador se diz online, mas a requisição morre (fetch failed / timeout).
 * Sem isto, a escrita se perdia em silêncio. Erros do PostgREST trazem `code`
 * (ex.: 23505, PGRST116) — esses são regra de negócio e NÃO devem ser enfileirados.
 */
export function isErroDeRede(error) {
  if (!error) return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (error.code) return false; // erro do banco (constraint, RLS, etc.)
  const msg = `${error.message || ''} ${error.name || ''}`.toLowerCase();
  return /failed to fetch|networkerror|network request failed|load failed|timeout|typeerror|fetch/.test(msg);
}

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}
function write(queue) {
  try { localStorage.setItem(KEY, JSON.stringify(queue)); } catch { /* quota cheia — ignora */ }
  emitChange(queue.length);
}
function emitChange(size) {
  try { window.dispatchEvent(new CustomEvent('oryagro:outbox-change', { detail: { size } })); } catch { /* noop */ }
}

/**
 * Linhas ainda NA FILA para uma tabela (inserts pendentes, com as edições
 * pendentes já aplicadas; as excluídas saem). Permite mostrar ao produtor o
 * que ele anotou sem sinal antes de subir.
 */
export function pendentes(table) {
  const queue = read().filter(o => o.table === table);
  const excluidos = new Set(queue.filter(o => o.kind === 'delete').map(o => o.rowId));
  return queue
    .filter(o => o.kind === 'insert' && !excluidos.has(o.payload?.id))
    .map(o => {
      const edicoes = queue.filter(u => u.kind === 'update' && u.rowId === o.payload.id);
      return Object.assign({}, o.payload, ...edicoes.map(u => u.payload), { _pendente: true });
    });
}

/** Quantidade de operações pendentes na fila. */
export function pendingCount() {
  return read().length;
}

/**
 * Enfileira um INSERT idempotente para reenvio offline.
 * O payload DEVE conter um `id` gerado no cliente (clientUuid) — é o que torna
 * o reenvio seguro: a 2ª tentativa colide na PK (23505) e é tratada como sucesso.
 * @param {{ table: string, payload: object }} op
 */
function enqueueInsert({ table, payload }) {
  if (!payload?.id) return; // sem id de cliente não é seguro enfileirar
  const queue = read();
  // Dedup pelo id do registro (mesma linha não entra duas vezes)
  const sig = `insert:${table}:${payload.id}`;
  const filtered = queue.filter(o => o._sig !== sig);
  filtered.push({ id: `${Date.now()}_${Math.random().toString(36).slice(2)}`, kind: 'insert', table, payload, _sig: sig, ts: Date.now() });
  write(filtered);
}

/**
 * INSERT resiliente a offline. Gera um id no cliente (idempotência), tenta
 * inserir online e — se a falha for por estar offline — enfileira para reenvio
 * e devolve a linha otimista (mesmo id) para a UI seguir funcionando no campo.
 *
 * @param {string} table
 * @param {object} payload  - sem id; user_id deve já estar incluído
 * @returns {Promise<{ row: object|null, queued: boolean, error: object|null }>}
 */
export async function insertOfflineSafe(table, payload) {
  const row = { id: clientUuid(), ...payload };
  const { data, error } = await supabase.from(table).insert(row).select().single();
  if (!error) return { row: data, queued: false, error: null };

  // Sem rede (offline OU sinal fraco) → enfileira e segue otimista com o mesmo
  // id (replay é idempotente: colisão de PK conta como sucesso).
  if (isErroDeRede(error)) {
    enqueueInsert({ table, payload: row });
    return { row, queued: true, error: null };
  }
  // Erro real (online) → caller decide como logar/avisar.
  return { row: null, queued: false, error };
}

/**
 * UPDATE resiliente a offline (edições no campo — ex.: marcar "Feito", geometria
 * de talhão). Tenta online; sem rede, enfileira o MESMO update por id e devolve
 * a linha otimista — o dado nunca se perde e sincroniza quando a internet voltar.
 *
 * @param {string} table
 * @param {string} id     - chave primária da linha
 * @param {object} patch  - colunas a atualizar
 * @returns {Promise<{ row: object|null, queued: boolean, error: object|null }>}
 */
export async function updateOfflineSafe(table, id, patch) {
  const { data, error } = await supabase.from(table).update(patch).eq('id', id).select().single();
  if (!error) return { row: data, queued: false, error: null };

  if (isErroDeRede(error)) {
    enqueue({ kind: 'update', table, id, payload: patch });
    return { row: { id, ...patch }, queued: true, error: null };
  }
  return { row: null, queued: false, error };
}

/**
 * DELETE resiliente a offline (por id). Sem rede, enfileira; reaplicar um delete
 * de linha que já não existe é inofensivo.
 * @returns {Promise<{ ok: boolean, queued: boolean, error: object|null }>}
 */
export async function deleteOfflineSafe(table, id) {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (!error) return { ok: true, queued: false, error: null };
  if (isErroDeRede(error)) {
    enqueue({ kind: 'delete', table, id });
    return { ok: true, queued: true, error: null };
  }
  return { ok: false, queued: false, error };
}

/** Enfileira update/delete por id. Updates seguidos da mesma linha se fundem. */
function enqueue({ kind, table, id, payload }) {
  const queue = read();
  const sig = `${kind}:${table}:${id}`;
  const anterior = kind === 'update' ? queue.find(o => o._sig === sig) : null;
  const filtered = queue.filter(o => o._sig !== sig);
  filtered.push({
    id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    kind, table, rowId: id,
    payload: anterior ? { ...anterior.payload, ...payload } : payload,
    _sig: sig, ts: Date.now(),
  });
  write(filtered);
}

async function replay(op) {
  // 'upsert': formato de versões antigas — mantido para esvaziar filas antigas.
  if (op.kind === 'upsert') {
    const { error } = await supabase.from(op.table).upsert(op.payload, op.options);
    return !error;
  }
  if (op.kind === 'update') {
    const { error } = await supabase.from(op.table).update(op.payload).eq('id', op.rowId);
    return !error;
  }
  if (op.kind === 'delete') {
    const { error } = await supabase.from(op.table).delete().eq('id', op.rowId);
    return !error;
  }
  if (op.kind === 'insert') {
    const { error } = await supabase.from(op.table).insert(op.payload);
    // 23505 = unique_violation → a linha já foi inserida num replay anterior.
    // Isso é exatamente o sucesso idempotente que queremos.
    if (!error || error.code === '23505') return true;
    return false;
  }
  return true; // tipo desconhecido — descarta para não travar a fila
}

let _flushing = false;

/** Tenta reenviar tudo que está na fila. Mantém o que falhar. */
async function flush() {
  if (_flushing) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  const queue = read();
  if (!queue.length) return;

  _flushing = true;
  try {
    const remaining = [];
    for (const op of queue) {
      // Update/delete de uma linha cujo INSERT ainda não subiu espera a próxima
      // rodada — senão o update "passaria" sem linha e se perderia.
      const dependeDeInsertPendente = (op.kind === 'update' || op.kind === 'delete')
        && remaining.some(r => r.kind === 'insert' && r.table === op.table && r.payload?.id === op.rowId);
      if (dependeDeInsertPendente) { remaining.push(op); continue; }
      try {
        const ok = await replay(op);
        if (!ok) remaining.push(op);
      } catch {
        remaining.push(op);
      }
    }
    write(remaining);
    if (remaining.length === 0) logWarn('outbox', 'fila sincronizada');
  } finally {
    _flushing = false;
  }
}

let _inited = false;
/** Liga o auto-flush: ao reconectar, no startup e periodicamente. */
export function initOutbox() {
  if (_inited || typeof window === 'undefined') return;
  _inited = true;
  window.addEventListener('online', () => { flush(); });
  // Tentativa inicial (caso tenha ficado fila de uma sessão anterior)
  flush();
  // Heartbeat: re-tenta a cada 30s enquanto online
  setInterval(() => { if (navigator.onLine) flush(); }, 30000);
  emitChange(pendingCount());
}
