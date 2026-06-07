/**
 * Logger seguro para OryAgro.
 *
 * Regras:
 * - Em produção: suprime stack traces e detalhes internos do Supabase.
 * - Em dev: exibe mensagens completas para facilitar depuração.
 * - NUNCA loga tokens, senhas, user_id crus ou dados sensíveis.
 */

const IS_DEV = import.meta.env.DEV;

// Campos do erro Supabase que são seguros de exibir em produção
const SAFE_ERROR_FIELDS = ['message', 'code', 'hint'];

/**
 * Sanitiza um objeto de erro Supabase para logar apenas campos seguros.
 * Remove stack traces, detalhes de query e qualquer campo que possa
 * expor o schema do banco em produção.
 */
function sanitizeError(err) {
  if (!err) return 'erro desconhecido';
  if (IS_DEV) return err; // em dev, log completo para facilitar depuração

  if (typeof err === 'string') return err;

  const safe = {};
  for (const field of SAFE_ERROR_FIELDS) {
    if (err[field] !== undefined) safe[field] = err[field];
  }
  return Object.keys(safe).length ? safe : 'erro interno';
}

/**
 * Loga um erro de operação de banco de dados.
 * @param {string} context - Nome da função/operação (ex: 'upsertInsumo')
 * @param {object|string} error - Objeto de erro Supabase
 */
export function logDbError(context, error) {
  if (IS_DEV) {
    console.error(`[DB] ${context}:`, error);
  } else {
    // Em produção: apenas context + campos seguros, sem stack trace
    console.error(`[DB] ${context}:`, sanitizeError(error));
  }
  notifyDbError(context, error);
}

// ── Notificação ao usuário (ponto único para os erros antes silenciosos) ───────
// Em vez de retrofitar 100+ chamadas, qualquer logDbError dispara um evento
// global. O ToastProvider escuta e exibe um toast — com throttle para não
// inundar a tela quando vários erros acontecem em sequência.
//
// Importante: quando OFFLINE não emitimos toast de erro — esse caso é coberto
// pelo indicador de conexão (uma falha offline é esperada, não um bug).
let _lastErrorToastAt = 0;
const ERROR_TOAST_THROTTLE_MS = 5000;

function notifyDbError(context, error) {
  if (typeof window === 'undefined') return;
  // Não notificar erros enquanto offline (indicador de conexão cobre esse caso)
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  const now = Date.now();
  if (now - _lastErrorToastAt < ERROR_TOAST_THROTTLE_MS) return;
  _lastErrorToastAt = now;

  try {
    window.dispatchEvent(new CustomEvent('oryagro:db-error', {
      detail: { context, message: (error && error.message) || 'erro' },
    }));
  } catch { /* ambiente sem CustomEvent — ignora */ }
}

/**
 * Loga um aviso não-crítico.
 */
export function logWarn(context, message) {
  if (IS_DEV) {
    console.warn(`[WARN] ${context}: ${message}`);
  }
}

/**
 * Loga informação (apenas em dev).
 */
export function logInfo(context, message) {
  if (IS_DEV) {
    console.info(`[INFO] ${context}: ${message}`);
  }
}
