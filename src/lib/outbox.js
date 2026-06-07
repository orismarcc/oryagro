/**
 * outbox.js — fila de escritas offline com retry automático.
 *
 * Quando uma escrita IDEMPOTENTE falha por falta de conexão, ela é enfileirada
 * em localStorage e reenviada automaticamente quando a internet volta. Isso é
 * essencial para uso em campo sem sinal (ex.: marcar etapas do cronograma).
 *
 * ⚠️ SEGURANÇA: só enfileiramos operações IDEMPOTENTES (upsert com onConflict),
 * cujo reenvio múltiplo produz o mesmo resultado. NUNCA enfileire inserts que
 * geram duplicatas ou movimentos de estoque (que alterariam saldo a cada
 * reenvio) — esses devem falhar de forma visível (toast) e ser refeitos online.
 */
import { supabase } from './supabase';
import { logWarn } from './logger';

const KEY = 'oryagro_outbox_v1';

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
export function enqueueUpsert({ table, payload, options }) {
  const queue = read();
  // Dedup: se já existe um upsert pendente para a mesma tabela+chave, substitui
  const sig = JSON.stringify({ table, k: payload?.plantio_id, e: payload?.etapa, d: payload?.dia_previsto, c: payload?.is_custom });
  const filtered = queue.filter(o => o._sig !== sig);
  filtered.push({ id: `${Date.now()}_${Math.random().toString(36).slice(2)}`, kind: 'upsert', table, payload, options: options || {}, _sig: sig, ts: Date.now() });
  write(filtered);
}

async function replay(op) {
  if (op.kind === 'upsert') {
    const { error } = await supabase.from(op.table).upsert(op.payload, op.options);
    return !error;
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
