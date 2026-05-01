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
