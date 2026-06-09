/**
 * Centralized financial calculation for a lote.
 * Used by both FinanceiroPage (DRE) and AnalysePage (CustoProducaoCard)
 * to ensure consistent profit figures.
 *
 * @param {object} p
 * @param {object}   p.lote              - plantio row
 * @param {number}   p.custoInsumos      - sum of estoque movement costs (quantidade * preco_unitario)
 * @param {number}   p.custoDespesas     - sum of despesas.valor for this lote
 * @param {object}   p.maoObraData       - { registros: [], total: number } from loadMaoObraByLote
 * @param {number}   p.receitaVendas     - sum of vendas.quantidade * vendas.preco_unitario
 * @param {number}   [p.receitaExtras]   - sum of receitas.valor (optional, default 0)
 * @returns {{
 *   custoInsumos: number,
 *   custoDespesas: number,
 *   maoObra: number,
 *   maoObraSource: 'registros'|'estimativa',
 *   custoTotal: number,
 *   receita: number,
 *   lucro: number,
 *   margemPct: number|null,
 * }}
 */
export function calcLucroLote({ lote, custoInsumos, custoDespesas, maoObraData, receitaVendas, receitaExtras = 0 }) {
  // Labor cost: registros are authoritative; fallback to mao_obra_total only when no registros.
  // Terceiro estado 'sem dados': nem registros nem estimativa legada existem —
  // o lucro NÃO inclui custo de mão de obra e o caller deve sinalizar isso ao
  // usuário (senão a margem aparece inflada silenciosamente).
  const temRegistros  = maoObraData?.registros?.length > 0;
  const estimativa    = parseFloat(lote?.mao_obra_total) || 0;
  const maoObraSource = temRegistros ? 'registros' : (estimativa > 0 ? 'estimativa' : 'sem dados');
  const maoObra = temRegistros ? (maoObraData?.total ?? 0) : estimativa;
  const maoObraIndisponivel = maoObraSource === 'sem dados';

  const custoTotal = custoInsumos + custoDespesas + maoObra;
  const receita = receitaVendas + receitaExtras;
  const lucro = receita - custoTotal;
  const margemPct = receita > 0 ? Math.round((lucro / receita) * 100) : null;

  return { custoInsumos, custoDespesas, maoObra, maoObraSource, maoObraIndisponivel, custoTotal, receita, lucro, margemPct };
}

/**
 * Soma os componentes de custo de uma entry do dreMap (FinanceiroPage),
 * incluindo mão de obra (que estava sendo omitida em TabComparativo/TabRanking).
 * Uso: const { custo, lucro, margemPct } = aggregateDreEntry(entry).
 *
 * A4-01: garante que TabDRE totais, TabComparativo e TabRanking usem
 * a mesma fórmula que TabDRE por-lote (que já incluía mão de obra).
 */
export function aggregateDreEntry(entry) {
  const custoInsumos  = entry?.custo_insumos  ?? 0;
  const custoDespesas = entry?.custo_despesas ?? 0;
  const custoMaoObra  = entry?.custo_mao_obra ?? 0;
  const receita       = entry?.receita        ?? 0;
  const custo         = custoInsumos + custoDespesas + custoMaoObra;
  const lucro         = receita - custo;
  const margemPct     = receita > 0 ? (lucro / receita) * 100 : null;
  return { custoInsumos, custoDespesas, custoMaoObra, custo, receita, lucro, margemPct };
}
