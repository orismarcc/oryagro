/**
 * safeStorage.js — localStorage à prova de falha.
 *
 * `localStorage.setItem` LANÇA em situações reais: cota cheia (QuotaExceededError,
 * comum num PWA offline com muito cache) e navegação privada em alguns navegadores.
 * Sem proteção, uma escrita de cache derrubava fluxos que já tinham salvo no banco
 * (ex.: marcar etapa do cronograma, criar lote) — o dado ia para o servidor mas a
 * tela quebrava. Aqui a escrita nunca derruba o fluxo: falhou, segue sem cache.
 */
import { logWarn } from './logger';

const disponivel = (() => {
  try {
    if (typeof localStorage === 'undefined') return false;
    const k = '__oryagro_probe__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch { return false; }
})();

/** Grava uma chave. Retorna true se persistiu, false se falhou (sem lançar). */
export function set(chave, valor) {
  if (!disponivel) return false;
  try {
    localStorage.setItem(chave, valor);
    return true;
  } catch (e) {
    // Cota cheia: tenta liberar caches antigos e repetir uma vez.
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      try {
        podarCaches();
        localStorage.setItem(chave, valor);
        return true;
      } catch { /* segue sem cache */ }
    }
    logWarn('safeStorage.set', `falhou para "${chave}": ${e?.name || e}`);
    return false;
  }
}

/** Lê uma chave. Nunca lança — devolve o fallback em qualquer erro. */
export function get(chave, fallback = null) {
  if (!disponivel) return fallback;
  try {
    const v = localStorage.getItem(chave);
    return v === null ? fallback : v;
  } catch { return fallback; }
}

/** Lê e faz JSON.parse com segurança. */
export function getJSON(chave, fallback = null) {
  const raw = get(chave);
  if (raw == null) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

/** Grava um objeto como JSON. */
export function setJSON(chave, valor) {
  try { return set(chave, JSON.stringify(valor)); } catch { return false; }
}

/** Remove uma chave. Nunca lança. */
export function remove(chave) {
  if (!disponivel) return false;
  try { localStorage.removeItem(chave); return true; } catch { return false; }
}

/**
 * Libera espaço descartando caches recriáveis (prefixos de cache de leitura),
 * preservando o que não pode ser perdido: fila offline e status do cronograma.
 */
function podarCaches() {
  const PRESERVAR = [/^oryagro_outbox/, /^cronograma_status/, /^cronograma_custom/, /^lote_mudas_/];
  const descartaveis = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (PRESERVAR.some(re => re.test(k))) continue;
    if (/^(cache_|clima_|weather_|sim_)/.test(k)) descartaveis.push(k);
  }
  descartaveis.forEach(k => { try { localStorage.removeItem(k); } catch { /* ignora */ } });
  logWarn('safeStorage', `cota cheia — ${descartaveis.length} caches descartados`);
}

export default { set, get, getJSON, setJSON, remove };
