/**
 * clima.js — previsão do tempo e manejo de irrigação (#8).
 *
 * Fonte: Open-Meteo (gratuito, sem chave de API). Usa a evapotranspiração de
 * referência ET0 (padrão FAO Penman-Monteith) e a precipitação prevista para
 * montar o balanço hídrico e recomendar a lâmina de irrigação.
 *
 * Metodologia (FAO-56, simplificada e explícita):
 *   ETc  = ET0 × Kc                    (demanda da cultura no dia)
 *   Necessidade líquida = max(0, ETc − chuva efetiva)   [mm/dia]
 * Não modela armazenamento de água no solo (a favor da simplicidade e da
 * previsibilidade); por isso é uma recomendação de manejo, não uma prescrição.
 */

// Coeficiente de cultura (Kc) representativo de meia-estação. Valores conservadores,
// baseados na faixa FAO-56. Ajustáveis; default 1,0 quando a cultura não está listada.
export const KC_POR_CULTURA = {
  alface: 1.0, coentro: 1.0, rucula: 1.0,
  tomate: 1.15, quiabo: 1.05, feijao: 1.05, milho: 1.2, soja: 1.15,
  mandioca: 0.9, abacaxi: 0.5,
  maracuja: 1.05, uva: 0.7, acerola: 0.9, mamao: 1.05, banana: 1.1, goiaba: 0.9,
};

export function kcCultura(culturaId) {
  return KC_POR_CULTURA[culturaId] ?? 1.0;
}

const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast';

/**
 * Busca a previsão diária no Open-Meteo. Lança em caso de erro de rede/HTTP.
 * @returns objeto { daily: { time[], et0[], chuva[], tmax[], tmin[], probChuva[] }, ... }
 */
export async function fetchPrevisao(lat, lon, { pastDays = 2, forecastDays = 7 } = {}) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily: 'et0_fao_evapotranspiration,precipitation_sum,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'auto',
    past_days: String(pastDays),
    forecast_days: String(forecastDays),
  });
  const res = await fetch(`${OPEN_METEO}?${params.toString()}`);
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
  const json = await res.json();
  const d = json.daily || {};
  return {
    tz: json.timezone,
    daily: {
      time: d.time || [],
      et0: d.et0_fao_evapotranspiration || [],
      chuva: d.precipitation_sum || [],
      tmax: d.temperature_2m_max || [],
      tmin: d.temperature_2m_min || [],
      probChuva: d.precipitation_probability_max || [],
    },
    obtidoEm: Date.now(),
  };
}

/**
 * Calcula o balanço hídrico e a recomendação de irrigação (função PURA).
 * @param {Object} previsao  - resultado de fetchPrevisao
 * @param {Object} opts       - { kc, hojeISO }
 * @returns {{
 *   dias: Array<{ data, et0, etc, chuva, necessidade, tmax, tmin, probChuva, futuro }>,
 *   totalNecessidade7, totalChuva7, recomendacao: { nivel, titulo, texto }
 * }}
 */
export function calcularManejoIrrigacao(previsao, { kc = 1.0, hojeISO } = {}) {
  const d = previsao?.daily;
  if (!d || !Array.isArray(d.time) || d.time.length === 0) {
    return { dias: [], totalNecessidade7: 0, totalChuva7: 0, recomendacao: null };
  }
  const hoje = hojeISO || new Date().toISOString().slice(0, 10);

  const dias = d.time.map((data, i) => {
    const et0 = Number(d.et0[i]) || 0;
    const chuva = Number(d.chuva[i]) || 0;
    const etc = et0 * kc;
    const necessidade = Math.max(0, etc - chuva);
    return {
      data,
      et0: Math.round(et0 * 10) / 10,
      etc: Math.round(etc * 10) / 10,
      chuva: Math.round(chuva * 10) / 10,
      necessidade: Math.round(necessidade * 10) / 10,
      tmax: d.tmax[i] != null ? Math.round(d.tmax[i]) : null,
      tmin: d.tmin[i] != null ? Math.round(d.tmin[i]) : null,
      probChuva: d.probChuva[i] != null ? Math.round(d.probChuva[i]) : null,
      futuro: data >= hoje,
    };
  });

  // Considera os próximos 7 dias (a partir de hoje) para os totais/recomendação
  const futuros = dias.filter(x => x.futuro).slice(0, 7);
  const totalNecessidade7 = Math.round(futuros.reduce((s, x) => s + x.necessidade, 0) * 10) / 10;
  const totalChuva7 = Math.round(futuros.reduce((s, x) => s + x.chuva, 0) * 10) / 10;

  // Recomendação para hoje / próximos dias
  const hojeDia = dias.find(x => x.data === hoje) || futuros[0];
  const chuvaProx3 = futuros.slice(0, 3).reduce((s, x) => s + x.chuva, 0);
  const necProx3 = futuros.slice(0, 3).reduce((s, x) => s + x.necessidade, 0);

  let recomendacao;
  if (chuvaProx3 >= necProx3 && chuvaProx3 > 3) {
    recomendacao = {
      nivel: 'segurar',
      titulo: 'Pode segurar a irrigação',
      texto: `Chuva prevista (${Math.round(chuvaProx3)} mm em 3 dias) cobre a demanda da cultura. Reavalie após as chuvas.`,
    };
  } else if ((hojeDia?.necessidade || 0) <= 0.5) {
    recomendacao = {
      nivel: 'ok',
      titulo: 'Sem irrigação necessária hoje',
      texto: 'A demanda hídrica de hoje está baixa ou coberta pela chuva. Monitore os próximos dias.',
    };
  } else {
    recomendacao = {
      nivel: 'irrigar',
      titulo: `Irrigar ≈ ${hojeDia.necessidade} mm hoje`,
      texto: `Demanda da cultura (ETc ${hojeDia.etc} mm) maior que a chuva prevista (${hojeDia.chuva} mm). ` +
        `Necessidade líquida acumulada nos próximos 7 dias: ${totalNecessidade7} mm.`,
    };
  }

  return { dias, totalNecessidade7, totalChuva7, recomendacao };
}

/** Converte lâmina (mm) em volume (litros) para uma área em hectares. 1 mm = 10.000 L/ha. */
export function laminaParaLitros(mm, areaHa) {
  if (!(mm > 0) || !(areaHa > 0)) return 0;
  return Math.round(mm * 10_000 * areaHa);
}

// ─────────────────────────────────────────────────────────────────────────────
// Sistema de irrigação instalado — tempo de acionamento
// ─────────────────────────────────────────────────────────────────────────────

/** Tipos de sistema e sua eficiência de aplicação típica (fração da água que chega à planta). */
export const SISTEMAS_IRRIGACAO = [
  { id: 'gotejamento',  label: 'Gotejamento',    eficiencia: 0.90, dica: 'Emissores na linha; molha só a faixa da planta.' },
  { id: 'microaspersao', label: 'Microaspersão', eficiencia: 0.85, dica: 'Microaspersor por planta ou por grupo.' },
  { id: 'aspersao',     label: 'Aspersão',       eficiencia: 0.75, dica: 'Aspersores cobrindo toda a área.' },
];

export function sistemaIrrigacao(tipo) {
  return SISTEMAS_IRRIGACAO.find(s => s.id === tipo) || null;
}

/** Eficiência padrão do tipo de sistema (fallback 0.8). */
export function eficienciaPadrao(tipo) {
  return sistemaIrrigacao(tipo)?.eficiencia ?? 0.8;
}

/**
 * Taxa de aplicação do sistema em mm/h, derivada da vazão do emissor e da área
 * que ele atende. Base física: 1 litro espalhado em 1 m² = 1 mm de lâmina.
 *   taxa (mm/h) = vazão (L/h) ÷ área do emissor (m²)
 * @returns número em mm/h, ou null se os dados não permitirem calcular.
 */
export function taxaAplicacaoMmH({ vazaoLh, areaEmissorM2 }) {
  const v = Number(vazaoLh), a = Number(areaEmissorM2);
  if (!(v > 0) || !(a > 0)) return null;
  return Math.round((v / a) * 100) / 100;
}

/**
 * Tempo que o sistema deve ficar ligado para aplicar a lâmina líquida desejada.
 *   lâmina bruta = lâmina líquida ÷ eficiência   (compensa perdas do sistema)
 *   tempo (h)    = lâmina bruta ÷ taxa de aplicação
 * @returns {{ horas, minutosTotais, h, min, laminaBruta }} ou null se faltar dado.
 */
export function tempoIrrigacao({ laminaMm, taxaMmH, eficiencia = 0.8 }) {
  const l = Number(laminaMm), t = Number(taxaMmH), e = Number(eficiencia);
  if (!(l > 0) || !(t > 0) || !(e > 0) || e > 1) return null;
  const laminaBruta = l / e;
  const horas = laminaBruta / t;
  const minutosTotais = Math.round(horas * 60);
  return {
    horas: Math.round(horas * 100) / 100,
    minutosTotais,
    h: Math.floor(minutosTotais / 60),
    min: minutosTotais % 60,
    laminaBruta: Math.round(laminaBruta * 10) / 10,
  };
}

/**
 * Resolve a taxa de aplicação efetiva de um talhão: usa a taxa informada
 * diretamente ou, na falta dela, deriva de vazão ÷ área do emissor.
 */
export function resolverTaxaTalhao(talhao) {
  const direta = Number(talhao?.irrigacao_taxa_mm_h);
  if (direta > 0) return direta;
  return taxaAplicacaoMmH({
    vazaoLh: talhao?.irrigacao_vazao_emissor_lh,
    areaEmissorM2: talhao?.irrigacao_area_emissor_m2,
  });
}
