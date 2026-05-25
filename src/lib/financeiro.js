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
  // Labor cost: registros are authoritative; fallback to mao_obra_total only when no registros
  const maoObraSource = (maoObraData?.registros?.length > 0) ? 'registros' : 'estimativa';
  const maoObra = maoObraSource === 'registros'
    ? (maoObraData?.total ?? 0)
    : (parseFloat(lote?.mao_obra_total) || 0);

  const custoTotal = custoInsumos + custoDespesas + maoObra;
  const receita = receitaVendas + receitaExtras;
  const lucro = receita - custoTotal;
  const margemPct = receita > 0 ? Math.round((lucro / receita) * 100) : null;

  return { custoInsumos, custoDespesas, maoObra, maoObraSource, custoTotal, receita, lucro, margemPct };
}
