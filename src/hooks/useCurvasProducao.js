/**
 * useCurvasProducao.js
 *
 * Carrega as curvas de maturação de produção do Supabase (tabela curvas_producao).
 * Cada linha: { cultura_id, ano_relativo, fator }
 *   - cultura_id: ID da cultura (ex: 'acerola') ou '_default'
 *   - ano_relativo: 0 = ano do plantio, 1 = 1 ano após, etc.
 *   - fator: 0.0 a 1.0 — porcentagem da produção plena naquele ano
 *   - user_id: null = curva global (padrão do sistema), não-null = customização do usuário
 *
 * Prioridade: curva do usuário > curva global > fallback hardcoded
 */
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// Fallback hardcoded (usado se o banco estiver indisponível)
const FALLBACK_CURVES = {
  acerola:  [0, 0.10, 0.30, 0.60, 0.85, 1.0],
  mamao:    [0, 0.40, 0.80, 1.0,  1.0,  1.0],
  banana:   [0, 0.50, 0.90, 1.0,  1.0,  1.0],
  goiaba:   [0, 0.15, 0.40, 0.70, 0.90, 1.0],
  maracuja: [0, 0.60, 1.0,  1.0,  1.0,  1.0],
  abacaxi:  [0, 0.80, 1.0,  1.0,  1.0,  1.0],
  alface:   [0.80, 1.0, 1.0, 1.0, 1.0, 1.0],
  coentro:  [0.80, 1.0, 1.0, 1.0, 1.0, 1.0],
  rucula:   [0.80, 1.0, 1.0, 1.0, 1.0, 1.0],
  feijao:   [1.0,  1.0, 1.0, 1.0, 1.0, 1.0],
  milho:    [1.0,  1.0, 1.0, 1.0, 1.0, 1.0],
  soja:     [1.0,  1.0, 1.0, 1.0, 1.0, 1.0],
  mandioca: [0,    1.0, 1.0, 1.0, 1.0, 1.0],
  _default: [0,    0.70, 1.0, 1.0, 1.0, 1.0],
};

/** Converte array de rows do DB para mapa { culturaId: [fator0, fator1, ...] } */
function buildCurveMap(rows) {
  const map = {};
  rows.forEach(row => {
    if (!map[row.cultura_id]) map[row.cultura_id] = {};
    map[row.cultura_id][row.ano_relativo] = parseFloat(row.fator);
  });
  // Convert to ordered arrays
  const result = {};
  Object.entries(map).forEach(([cid, anos]) => {
    const maxAno = Math.max(...Object.keys(anos).map(Number));
    result[cid] = Array.from({ length: maxAno + 1 }, (_, i) => anos[i] ?? 1.0);
  });
  return result;
}

/**
 * Singleton cache para evitar múltiplas queries ao mesmo tempo.
 * As curvas raramente mudam — cache de 10 minutos.
 */
let _cache = null;
let _cacheAt = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 min

async function fetchCurves() {
  if (_cache && Date.now() - _cacheAt < CACHE_TTL) return _cache;

  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id ?? null;

  // Fetch global curves + user curves in one query
  let query = supabase
    .from('curvas_producao')
    .select('cultura_id, ano_relativo, fator, user_id')
    .order('cultura_id')
    .order('ano_relativo');

  if (userId) {
    query = query.or(`user_id.is.null,user_id.eq.${userId}`);
  } else {
    query = query.is('user_id', null);
  }

  const { data, error } = await query;
  if (error || !data?.length) return null;

  // Separate global and user curves
  const globalRows = data.filter(r => !r.user_id);
  const userRows   = data.filter(r =>  r.user_id);

  const globalMap = buildCurveMap(globalRows);
  const userMap   = buildCurveMap(userRows);

  // Merge: user curve overrides global for same cultura_id
  const merged = { ...globalMap, ...userMap };

  _cache = merged;
  _cacheAt = Date.now();
  return merged;
}

/** Invalida o cache — chame após salvar uma curva customizada */
export function invalidateCurvasCache() {
  _cache = null;
  _cacheAt = 0;
}

/**
 * Hook React — retorna o mapa de curvas { culturaId: [fator0, fator1, ...] }
 * e uma função helper getProductionFactor(culturaId, anoDoPlantio).
 */
export function useCurvasProducao() {
  const [curves, setCurves] = useState(FALLBACK_CURVES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCurves().then(map => {
      if (map) setCurves({ ...FALLBACK_CURVES, ...map });
    }).finally(() => setLoading(false));
  }, []);

  const getProductionFactor = (culturaId, yearFromPlanting) => {
    const curve = curves[culturaId] ?? curves._default ?? FALLBACK_CURVES._default;
    if (yearFromPlanting <= 0) return curve[0] ?? 0;
    if (yearFromPlanting >= curve.length) return curve[curve.length - 1] ?? 1.0;
    return curve[yearFromPlanting];
  };

  return { curves, loading, getProductionFactor };
}

/**
 * Versão síncrona usando o cache (para componentes que precisam do fator inline).
 * Retorna o fallback se o cache não estiver carregado.
 */
export function getProductionFactorSync(culturaId, yearFromPlanting) {
  const map = _cache ?? FALLBACK_CURVES;
  const curve = map[culturaId] ?? map._default ?? FALLBACK_CURVES._default;
  if (yearFromPlanting <= 0) return curve[0] ?? 0;
  if (yearFromPlanting >= curve.length) return curve[curve.length - 1] ?? 1.0;
  return curve[yearFromPlanting];
}
