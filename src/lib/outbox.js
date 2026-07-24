/**
 * outbox.js — fila de escritas offline com retry automático.
 *
 * Quando uma escrita IDEMPOTENTE falha por falta de conexão, ela é enfileirada
 * em localStorage e reenviada automaticamente quando a internet volta. Isso é
 * essencial para uso em campo sem sinal (ex.: marcar etapas do cronograma).
 *
 * ⚠️ SEGURANÇA: só enfileiramos operações IDEMPOTENTES.
 *   - upsert (onConflict): reenviar produz o mesmo resultado.
 *   - insert COM id gerado no cliente (enqueueInsert): o id é a chave primária,
 *     então um reenvio duplicado viola a unique constraint (código 23505) — que
 *     tratamos como sucesso ("já inserido"). Isso torna inserts seguros para a
 *     fila offline sem gerar duplicatas nem alterar saldo de estoque 2×.
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

/** Quantidade de operações pendentes na fila. */
export function pendingCount() {
  return read().length;
}

/**
 * Enfileira uma operação idempotente para reenvio.
 * @param {{ table: string, payload: object, options?: object }} op
 */
export function enqueueUpsert({ table, payload, options, sig }) {
  const queue = read();
  // Dedup: se já existe um upsert pendente para a mesma tabela+chave, substitui.
  // `sig` explícito permite dedup por id (ex.: geometria de um talhão).
  const signature = sig || JSON.stringify({ table, k: payload?.plantio_id, e: payload?.etapa, d: payload?.dia_previsto, c: payload?.is_custom });
  const filtered = queue.filter(o => o._sig !== signature);
  filtered.push({ id: `${Date.now()}_${Math.random().toString(36).slice(2)}`, kind: 'upsert', table, payload, options: options || {}, _sig: signature, ts: Date.now() });
  write(filtered);
}

/**
 * Enfileira um INSERT idempotente para reenvio offline.
 * O payload DEVE conter um `id` gerado no cliente (clientUuid) — é o que torna
 * o reenvio seguro: a 2ª tentativa colide na PK (23505) e é tratada como sucesso.
 * @param {{ table: string, payload: object }} op
 */
export function enqueueInsert({ table, payload }) {
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

  // Offline → enfileira e segue otimista com o mesmo id (replay é idempotente).
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    enqueueInsert({ table, payload: row });
    return { row, queued: true, error: null };
  }
  // Erro real (online) → caller decide como logar/avisar.
  return { row: null, queued: false, error };
}

/**
 * UPDATE resiliente a offline (para edições no campo — ex.: geometria de talhão
 * capturada caminhando o perímetro sem sinal). Tenta atualizar online; se estiver
 * OFFLINE, enfileira um upsert idempotente (por id) e devolve a linha otimista,
 * de modo que o dado NUNCA se perde — sincroniza sozinho quando a internet voltar.
 *
 * @param {string} table
 * @param {string} id     - chave primária da linha
 * @param {object} patch  - colunas a atualizar
 * @returns {Promise<{ row: object|null, queued: boolean, error: object|null }>}
 */
export async function updateOfflineSafe(table, id, patch) {
  const { data, error } = await supabase.from(table).update(patch).eq('id', id).select().single();
  if (!error) return { row: data, queued: false, error: null };

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    enqueueUpsert({ table, payload: { id, ...patch }, options: { onConflict: 'id' }, sig: `upsert:${table}:${id}` });
    return { row: { id, ...patch }, queued: true, error: null };
  }
  return { row: null, queued: false, error };
}

async function replay(op) {
  if (op.kind === 'upsert') {
    const { error } = await supabase.from(op.table).upsert(op.payload, op.options);
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
export async function flush() {
  if (_flushing) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  const queue = read();
  if (!queue.length) return;

  _flushing = true;
  try {
    const remaining = [];
    for (const op of queue) {
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
