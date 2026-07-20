/**
 * finance/helpers.js — formatadores e transformações puras do FinanceiroPage.
 * Extraídos sem alterar a lógica (apenas movidos).
 */
import { CULTURAS } from '../../data/culturas';

export const fmtBRL = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0);

export const fmtPct = (v) => {
  if (v == null || !isFinite(v)) return '—';
  return `${v.toFixed(1)}%`;
};

export function formatDateBR(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function getCultura(culturaId) {
  return CULTURAS[culturaId] || null;
}

export function anoFromDate(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr + 'T12:00:00').getFullYear();
}

/**
 * Ano-safra brasileiro: por convenção, a safra de grãos vai de julho a junho.
 * Uma data de jul/2025 a jun/2026 pertence à safra "2025/26".
 * Retorna o rótulo da safra (ex.: "2025/26") ou null.
 */
export function safraFromDate(dateStr, startMonth = 7) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T12:00:00');
  const y = d.getFullYear();
  const m = d.getMonth() + 1; // 1–12
  const inicio = m >= startMonth ? y : y - 1;
  return `${inicio}/${String((inicio + 1) % 100).padStart(2, '0')}`;
}

/**
 * Retorna a chave de período de uma data conforme o modo selecionado.
 * @param {string} dateStr  - YYYY-MM-DD
 * @param {'ano'|'safra'} mode
 */
export function periodFromDate(dateStr, mode = 'ano') {
  return mode === 'safra' ? safraFromDate(dateStr) : anoFromDate(dateStr);
}

/**
 * Constrói o mapa da DRE: { [plantioId]: { [ano]: { receita, custos…, vendas… } } }
 * a partir dos dados brutos (vendas, receitas, movimentos, despesas, plantios,
 * mão de obra). Função pura — sem efeitos colaterais.
 */
export function buildDreMap(rawData, periodMode = 'ano') {
  const { vendas, receitas = [], movimentos, despesas, plantios, maoObraMap = {} } = rawData;

  const map = {};

  const ensureEntry = (plantioId, ano) => {
    if (!map[plantioId]) map[plantioId] = {};
    if (!map[plantioId][ano]) {
      map[plantioId][ano] = {
        receita: 0,
        custo_insumos: 0,
        custo_despesas: 0,
        custo_mao_obra: 0,
        vendas: [],
        movimentos: [],
        despesas: [],
        isLegacyMO: false,
      };
    }
    return map[plantioId][ano];
  };

  // Processar vendas (tabela vendas — produção in-natura, etc.)
  vendas.forEach((v) => {
    if (!v.plantio_id || !v.data) return;
    const ano = periodFromDate(v.data, periodMode);
    if (!ano) return;
    const entry = ensureEntry(String(v.plantio_id), ano);
    const valor = (v.quantidade ?? 0) * (v.preco_unitario ?? 0);
    entry.receita += valor;
    entry.vendas.push({ ...v, valor });
  });

  // Processar receitas diretas (tabela receitas — serviços, outras entradas)
  receitas.forEach((r) => {
    if (!r.data) return;
    const ano = periodFromDate(r.data, periodMode);
    if (!ano) return;
    // Agrupa pelo plantio_id quando disponível; caso contrário usa '__receita__'
    const pid = r.plantio_id ? String(r.plantio_id) : '__receita__';
    const entry = ensureEntry(pid, ano);
    entry.receita += r.valor ?? 0;
    entry.vendas.push({ ...r, valor: r.valor ?? 0, _source: 'receita' });
  });

  // Processar movimentos de saída de estoque
  movimentos.forEach((m) => {
    if (!m.plantio_id || !m.data) return;
    const ano = periodFromDate(m.data, periodMode);
    if (!ano) return;
    const insumo = m.estoque_insumos;
    const preco = insumo?.preco_unitario ?? 0;
    const custo = (m.quantidade ?? 0) * preco;
    const entry = ensureEntry(String(m.plantio_id), ano);
    entry.custo_insumos += custo;
    entry.movimentos.push({ ...m, custo });
  });

  // A4-02: Processar despesas (nova tabela centralizada).
  // Evita dupla contagem: despesas com categoria='Mão de Obra' em lotes que
  // já possuem registros em mao_obra_registros são ignoradas (a migration
  // 20260507_despesas fez um backfill que pode coexistir com a tabela origem).
  const lotesComMaoObraRegistros = new Set(
    Object.entries(maoObraMap)
      .filter(([, regs]) => Array.isArray(regs) && regs.length > 0)
      .map(([pid]) => String(pid)),
  );
  despesas.forEach((d) => {
    if (!d.plantio_id || !d.data) return;
    const ano = periodFromDate(d.data, periodMode);
    if (!ano) return;
    const pid = String(d.plantio_id);
    if (d.categoria === 'Mão de Obra' && lotesComMaoObraRegistros.has(pid)) return;
    const entry = ensureEntry(pid, ano);
    entry.custo_despesas += d.valor ?? 0;
    entry.despesas.push(d);
  });

  // Mão de obra: usa mao_obra_registros como fonte autoritativa (quando há registros),
  // com fallback para mao_obra_total (legado) quando não há registros e não há despesas.
  plantios.forEach((p) => {
    const pid = String(p.id);
    const registros = maoObraMap[p.id] || [];
    const temRegistros = registros.length > 0;

    if (temRegistros) {
      // Fonte autoritativa: soma do `valor` de cada registro (custo da mão de obra).
      const totalMaoObra = registros.reduce((sum, r) => sum + (Number(r.valor) || 0), 0);
      if (totalMaoObra <= 0) return;
      const ano = periodFromDate(p.data_plantio, periodMode);
      if (!ano) return;
      const entry = ensureEntry(pid, ano);
      entry.custo_mao_obra = (entry.custo_mao_obra || 0) + totalMaoObra;
      entry.isLegacyMO = false;
    } else {
      // Fallback legado: mao_obra_total, somente se não há despesas registradas
      const maoObraTotal = parseFloat(p.mao_obra_total) || 0;
      if (maoObraTotal <= 0) return;
      const temDespesas = despesas.some((d) => String(d.plantio_id) === pid);
      if (temDespesas) return;
      const ano = periodFromDate(p.data_plantio, periodMode);
      if (!ano) return;
      const entry = ensureEntry(pid, ano);
      entry.custo_mao_obra = (entry.custo_mao_obra || 0) + maoObraTotal;
      entry.isLegacyMO = true;
    }
  });

  return map;
}
