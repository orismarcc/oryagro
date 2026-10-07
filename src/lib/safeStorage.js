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
function get(chave, fallback = null) {
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

/** Remove as chaves que casam com algum dos padrões. Nunca lança. */
function removerChaves(padroes) {
  const alvo = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && padroes.some(re => re.test(k))) alvo.push(k);
  }
  alvo.forEach(k => { try { localStorage.removeItem(k); } catch { /* ignora */ } });
  return alvo.length;
}

/**
 * Libera espaço descartando caches recriáveis (leituras guardadas para uso
 * offline). A fila offline (oryagro_outbox) nunca é descartada.
 */
function podarCaches() {
  const n = removerChaves([/^(offline_cache_|cache_|clima_|weather_|sim_)/]);
  logWarn('safeStorage', `cota cheia — ${n} caches descartados`);
}

/**
 * Apaga chaves de versões antigas do app que não são mais lidas (status e
 * etapas do antigo cronograma-guia, flag de mudas). Chamado na inicialização.
 */
export function limparChavesLegadas() {
  if (!disponivel) return;
  try { removerChaves([/^cronograma_status_lote_/, /^cronograma_custom_lote_/, /^lote_mudas_/]); } catch { /* ignora */ }
}
