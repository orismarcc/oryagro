/**
 * lifecycle.js — Central lifecycle engine for OryAgro.
 *
 * All exported functions are PURE (no side-effects).
 * Components import from here instead of duplicating logic.
 */

// ── Parsing ──────────────────────────────────────────────────────────────────

/**
 * Parse a cycle string like "45–60 dias", "12–18 meses", "2–4 anos",
 * "18–24 meses (1ª safra)" → always returns the MAX value as DAYS.
 *
 * Previous `parseCicloDias` took the last digit literally, which
 * turned "18–24 meses (1ª safra)" → 1 day (from the "1ª"). Fixed here.
 */
export function parseCicloDias(cicloStr) {
  if (!cicloStr) return 60;
  // Strip parenthetical notes so "(1ª safra)" digits don't pollute the parse
  const clean = cicloStr.replace(/\(.*?\)/g, '').toLowerCase().trim();
  const nums = clean.match(/\d+/g);
  if (!nums) return 60;
  const max = Math.max(...nums.map(Number));
  if (clean.includes('ano')) return max * 365;
  if (clean.includes('mes') || clean.includes('mês')) return max * 30;
  return max; // already in days
}

// ── Date helpers ─────────────────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000;

function addDiasToStr(isoDateStr, n) {
  const d = new Date(isoDateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d;
}

export function fmtDateBR(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

export function fmtDiasRestantes(dias) {
  if (dias <= 0) return 'chegou';
  if (dias < 30) return `em ${dias} dia${dias !== 1 ? 's' : ''}`;
  if (dias < 365) {
    const m = Math.round(dias / 30);
    return `em ~${m} mês${m !== 1 ? 'es' : ''}`;
  }
  const a = (dias / 365).toFixed(1).replace('.', ',');
  return `em ~${a} anos`;
}

// ── Core lifecycle resolver ───────────────────────────────────────────────────

/**
 * Resolves the full lifecycle state for a lote.
 *
 * Priority order for config:
 *   1. metodosPropagacao[x].lifecycle  (most specific)
 *   2. cultura.ciclo string (fallback for annual crops)
 *
 * Returns an object with every lifecycle datum a component needs.
 *
 * @param {object} lote    – plantio DB row
 * @param {object} cultura – culturas.js entry
 */
export function resolveLifecycle(lote, cultura) {
  // ── Guard: data_plantio nula/inválida ──────────────────────────────────────
  // Sem este guard, new Date('nullT12:00:00') vira NaN e contamina TODOS os
  // cálculos abaixo (progresso, fases, datas). Retorna um objeto seguro com
  // zeros/nulls e flag dataInvalida para que nenhum caller quebre nem mostre NaN.
  const plantioTs = lote?.data_plantio
    ? new Date(lote.data_plantio + 'T12:00:00').getTime()
    : NaN;
  if (Number.isNaN(plantioTs)) {
    const cicloFallback = parseCicloDias(cultura?.ciclo);
    return {
      dataInvalida: true,
      diasDecorridos: 0,
      diasViveiro: 0,
      cicloDias: cicloFallback,
      diasPrimeiraProducao: cicloFallback,
      diasProducaoPlena: cicloFallback,
      faseAtual: null,
      faseIndex: -1,
      fases: null,
      faseLimites: null,
      dataTransplante: null,
      dataPrimeiraProducao: null,
      dataProducaoPlena: null,
      progresso: 0,
      prontoParaColheita: false,
      emProducaoPlena: false,
      diasParaColheita: cicloFallback,
      metodoObj: null,
    };
  }

  // ── Elapsed days ──
  const diasDecorridos = Math.max(
    0,
    Math.floor((Date.now() - plantioTs) / MS_PER_DAY),
  );

  // ── Propagation method object ──
  const metodoObj = (lote.metodo_propagacao && cultura.metodosPropagacao)
    ? (cultura.metodosPropagacao.find(m => m.key === lote.metodo_propagacao) ?? null)
    : null;

  const diasViveiro = metodoObj?.diasViveiro ?? 0;

  // ── Lifecycle config (from method, or derived from cultura.ciclo) ──
  const lc = metodoObj?.lifecycle ?? null;

  const cicloDias            = lc?.cicloDias            ?? parseCicloDias(cultura.ciclo);
  const diasPrimeiraProducao = lc?.diasPrimeiraProducao ?? cicloDias;
  const diasProducaoPlena    = lc?.diasProducaoPlena    ?? diasPrimeiraProducao;

  // ── Phase determination ──
  const fases       = lc?.fases       ?? null;
  const faseLimites = lc?.faseLimites ?? null; // length = fases.length - 1

  let faseAtual = null;
  let faseIndex = -1;

  if (fases && faseLimites && faseLimites.length === fases.length - 1) {
    for (let i = 0; i < faseLimites.length; i++) {
      if (diasDecorridos < faseLimites[i]) {
        faseAtual = fases[i];
        faseIndex = i;
        break;
      }
    }
    if (faseAtual === null) {
      faseAtual = fases[fases.length - 1];
      faseIndex = fases.length - 1;
    }
  }

  // ── Key dates ──
  const dataTransplante       = diasViveiro > 0 ? addDiasToStr(lote.data_plantio, diasViveiro) : null;
  const dataPrimeiraProducao  = addDiasToStr(lote.data_plantio, diasPrimeiraProducao);
  const dataProducaoPlena     = addDiasToStr(lote.data_plantio, diasProducaoPlena);

  // ── Progress toward first production (0–100, integer) ──
  const progresso = Math.min(100, Math.round((diasDecorridos / diasPrimeiraProducao) * 100));

  // ── Status flags ──
  const prontoParaColheita = diasDecorridos >= diasPrimeiraProducao;
  const emProducaoPlena    = diasDecorridos >= diasProducaoPlena;
  const diasParaColheita   = Math.max(0, diasPrimeiraProducao - diasDecorridos);

  // ── Validation: detect biologically impossible "harvest ready" ──
  // A lote registered less than the minimum biological minimum is never ready.
  const minBioMin = lc?.minDiasBioRealista ?? Math.round(diasPrimeiraProducao * 0.5);
  const harvReady = prontoParaColheita && diasDecorridos >= minBioMin;

  return {
    diasDecorridos,
    diasViveiro,
    cicloDias,
    diasPrimeiraProducao,
    diasProducaoPlena,
    faseAtual,
    faseIndex,
    fases,
    faseLimites,
    dataTransplante,
    dataPrimeiraProducao,
    dataProducaoPlena,
    progresso,
    prontoParaColheita: harvReady,
    emProducaoPlena,
    diasParaColheita,
    metodoObj,
  };
}

// ── Phase color helper ────────────────────────────────────────────────────────

const FASE_COLORS = [
  { bg: '#eff6ff', text: '#1d4ed8' }, // Viveiro → blue
  { bg: '#f0fdf4', text: '#15803d' }, // Estabelecimento → green
  { bg: '#fefce8', text: '#a16207' }, // Vegetativo → yellow
  { bg: '#fff7ed', text: '#c2410c' }, // Pré-produção → orange
  { bg: '#fef2f2', text: '#b91c1c' }, // Produção inicial → red
  { bg: '#f0fdf4', text: '#166534' }, // Produção plena → deep green
];

export function getFaseColor(faseIndex) {
  return FASE_COLORS[Math.min(faseIndex, FASE_COLORS.length - 1)] ?? FASE_COLORS[0];
}
