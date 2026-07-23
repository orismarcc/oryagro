/**
 * listaCompras.js — motor da Lista de Compras Inteligente.
 *
 * Princípio: NÃO recomenda nada genérico. A necessidade vem exclusivamente do
 * cronograma real de cada lote ativo (produto + dose + dia), projetada pela
 * área/plantas do lote, dentro de um horizonte de dias. Compara com o estoque
 * atual e lista apenas o que realmente falta para as próximas aplicações.
 *
 * Regra de ouro de confiabilidade: se a dose não permite calcular a quantidade
 * total com segurança (ex.: dose por litro de calda, sem volume conhecido), o
 * item entra como "a confirmar" SEM número inventado — nunca com um palpite.
 */
import { CULTURAS } from '../data/culturas';

const DAY = 86_400_000;

/** Remove acentos e normaliza para comparação de nomes. */
function norm(s) {
  return (s || '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Interpreta uma string de dose do cronograma.
 * Retorna { base: 'ha'|'planta'|'calda', valor, unidade } ou null.
 * Em faixas (ex.: "40-60 kg/ha") usa o MAIOR valor (conservador para compra).
 */
export function parseDose(doseStr) {
  if (!doseStr || typeof doseStr !== 'string') return null;
  const s = doseStr.toLowerCase().replace(/,/g, '.');
  const nums = (s.match(/\d+(?:\.\d+)?/g) || []).map(Number).filter(n => !isNaN(n));
  if (nums.length === 0) return null;
  const valor = Math.max(...nums);

  // por hectare
  if (/\/\s*ha\b/.test(s)) {
    let unidade = 'kg';
    if (/\bt\s*\/\s*ha/.test(s) || /tonelada/.test(s)) unidade = 't';
    else if (/\bl\s*\/\s*ha/.test(s) || /litro/.test(s)) unidade = 'L';
    else if (/\bg\s*\/\s*ha/.test(s)) unidade = 'g';
    else if (/\bkg\s*\/\s*ha/.test(s)) unidade = 'kg';
    return { base: 'ha', valor, unidade };
  }
  // por planta / cova / pé
  if (/\/\s*(planta|cova|p[eé]\b)/.test(s)) {
    let unidade = 'un';
    if (/kg\s*\//.test(s)) unidade = 'kg';
    else if (/\bg\s*\//.test(s) || /\dg\b/.test(s)) unidade = 'g';
    else if (/ml\s*\//.test(s)) unidade = 'mL';
    else if (/\bl\s*\//.test(s)) unidade = 'L';
    return { base: 'planta', valor, unidade };
  }
  // por litro de calda (não dá para totalizar sem o volume de calda)
  if (/\/\s*l\b/.test(s) || /\/l\b/.test(s)) {
    return { base: 'calda', valor, unidade: null };
  }
  return null;
}

/** Converte quantidade para uma unidade "de compra" amigável (g→kg, mL→L acima de 1000). */
function normalizeUnidade(qtd, unidade) {
  if (unidade === 'g' && qtd >= 1000) return { qtd: qtd / 1000, unidade: 'kg' };
  if (unidade === 'mL' && qtd >= 1000) return { qtd: qtd / 1000, unidade: 'L' };
  return { qtd, unidade };
}

/**
 * Encontra o item de estoque que corresponde a um produto (do cronograma ou do
 * caderno de campo). Exportada para ser a ÚNICA regra de correspondência do app.
 */
export function matchEstoque(produto, estoque) {
  const p = norm(produto);
  if (!p) return null;
  // 1) match direto/contido
  let hit = estoque.find(i => {
    const n = norm(i.nome);
    return n && (p === n || p.includes(n) || n.includes(p));
  });
  if (hit) return hit;
  // 2) match pelo primeiro token relevante (ex.: "ureia 46%" ~ "ureia")
  const token = p.split(/\s|\d/).filter(Boolean)[0];
  if (token && token.length >= 3) {
    hit = estoque.find(i => norm(i.nome).includes(token));
  }
  return hit || null;
}

/**
 * Calcula a lista de compras.
 * @param {Object} p
 * @param {Array}  p.lotes    - plantios ativos: { id, nome, cultura_id, data_plantio, area_ha, total_plantas }
 * @param {Array}  p.estoque  - itens: { id, nome, unidade, quantidade }
 * @param {number} p.horizonteDias - janela futura (padrão 30)
 * @param {Date}   p.hoje     - injetável para testes
 * @returns {{ itens: Array, incertos: Array, horizonteDias:number }}
 *   itens:    { produto, unidade, necessario, emEstoque, comprar, lotes:[nomes] }
 *   incertos: { produto, motivo, lotes:[nomes] }  (dose por calda, sem dados p/ calcular)
 */
export function computeListaCompras({ lotes = [], estoque = [], horizonteDias = 30, hoje = new Date() } = {}) {
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime();
  const fim = inicio + horizonteDias * DAY;

  // acumula necessidades por produto
  const acc = {};      // key -> { produto, unidade, necessario, lotes:Set }
  const incertosMap = {}; // key -> { produto, motivo, lotes:Set }

  for (const lote of lotes) {
    const cultura = CULTURAS[lote.cultura_id];
    if (!cultura?.cronograma || !lote.data_plantio) continue;
    const plantio = new Date(lote.data_plantio + 'T12:00:00').getTime();
    const area = parseFloat(lote.area_ha) || 0;
    const plantas = parseInt(lote.total_plantas, 10) || 0;
    const nomeLote = lote.nome || 'Lote';

    for (const etapa of cultura.cronograma) {
      const produto = etapa?.produto;
      if (!produto || produto === '—' || etapa.tipo === 'colheita' || etapa.tipo === 'plantio') continue;
      const dataEtapa = plantio + (etapa.dia || 0) * DAY;
      if (dataEtapa < inicio || dataEtapa > fim) continue;

      const dose = parseDose(etapa.dose);
      const keyBase = norm(produto);

      let qtd = null, unidade = null;
      if (dose?.base === 'ha' && area > 0) { qtd = dose.valor * area; unidade = dose.unidade; }
      else if (dose?.base === 'planta' && plantas > 0) { qtd = dose.valor * plantas; unidade = dose.unidade; }

      if (qtd == null) {
        // não dá para totalizar com confiança → item "a confirmar"
        const motivo = dose?.base === 'calda'
          ? 'dose por litro de calda — depende do volume aplicado'
          : (dose?.base === 'ha' ? 'lote sem área (ha) cadastrada' :
             dose?.base === 'planta' ? 'lote sem nº de plantas' : 'dose não quantificável');
        if (!incertosMap[keyBase]) incertosMap[keyBase] = { produto, motivo, lotes: new Set() };
        incertosMap[keyBase].lotes.add(nomeLote);
        continue;
      }

      const nz = normalizeUnidade(qtd, unidade);
      const key = `${keyBase}|${nz.unidade}`;
      if (!acc[key]) acc[key] = { produto, unidade: nz.unidade, necessario: 0, lotes: new Set() };
      acc[key].necessario += nz.qtd;
      acc[key].lotes.add(nomeLote);
    }
  }

  // compara com estoque → só entra na lista quem falta
  const itens = [];
  for (const key of Object.keys(acc)) {
    const it = acc[key];
    const est = matchEstoque(it.produto, estoque);
    const emEstoque = est ? (parseFloat(est.quantidade) || 0) : 0;
    // só compara estoque se a unidade bater (evita subtrair kg de litros)
    const unidadeBate = est && norm(est.unidade) === norm(it.unidade);
    const disponivel = unidadeBate ? emEstoque : 0;
    const comprar = Math.max(0, it.necessario - disponivel);
    if (comprar <= 0.0001) continue; // já tem o suficiente
    itens.push({
      produto: it.produto,
      unidade: it.unidade,
      necessario: Math.round(it.necessario * 100) / 100,
      emEstoque: unidadeBate ? emEstoque : (est ? emEstoque : 0),
      unidadeEstoque: est?.unidade ?? null,
      unidadeConflito: est ? !unidadeBate : false,
      comprar: Math.round(comprar * 100) / 100,
      temNoEstoque: !!est,
      lotes: [...it.lotes],
    });
  }

  itens.sort((a, b) => b.comprar - a.comprar);
  const incertos = Object.values(incertosMap).map(i => ({ ...i, lotes: [...i.lotes] }));

  return { itens, incertos, horizonteDias };
}
