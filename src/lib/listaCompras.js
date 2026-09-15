/**
 * listaCompras.js — motor da Lista de Compras Inteligente.
 *
 * Princípio: NÃO recomenda nada genérico e NÃO prevê nada. A necessidade vem
 * exclusivamente do que o PRODUTOR AGENDOU no cronograma dos lotes (produto +
 * quantidade + data prevista), dentro de um horizonte de dias. Compara com o
 * estoque atual e lista apenas o que realmente falta.
 *
 * Regra de ouro de confiabilidade: se o agendamento não tem quantidade/unidade,
 * o item entra como "a confirmar" SEM número inventado — nunca com um palpite.
 */
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
 * Calcula a lista de compras a partir dos AGENDAMENTOS do produtor.
 * @param {Object} p
 * @param {Array}  p.lotes      - plantios ativos: { id, nome } (só para nomear)
 * @param {Array}  p.atividades - linhas de cronograma_atividades (todos os lotes):
 *                                { plantio_id, status, data_prevista, produto, quantidade, unidade }
 * @param {Array}  p.estoque    - itens: { id, nome, unidade, quantidade }
 * @param {number} p.horizonteDias - janela futura (padrão 30)
 * @param {Date}   p.hoje       - injetável para testes
 * @returns {{ itens: Array, incertos: Array, horizonteDias:number }}
 *   itens:    { produto, unidade, necessario, emEstoque, comprar, lotes:[nomes] }
 *   incertos: { produto, motivo, lotes:[nomes] }  (agendamento sem quantidade)
 */
export function computeListaCompras({
  lotes = [], atividades = [], estoque = [], horizonteDias = 30, hoje = new Date(),
} = {}) {
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime();
  const fim = inicio + horizonteDias * DAY;

  const nomePorLote = {};
  for (const l of lotes) nomePorLote[l.id] = l.nome || 'Lote';
  // Se `lotes` foi informado, considera apenas agendamentos desses lotes
  // (permite filtrar por propriedade no card do estoque).
  const filtraLotes = lotes.length > 0;

  // acumula necessidades por produto
  const acc = {};      // key -> { produto, unidade, necessario, lotes:Set }
  const incertosMap = {}; // key -> { produto, motivo, lotes:Set }

  for (const a of atividades) {
    if (a?.status !== 'agendado' || !a.data_prevista) continue;
    if (filtraLotes && !(a.plantio_id in nomePorLote)) continue;

    const produto = (a.produto || '').trim();
    if (!produto || produto === '—') continue;

    const t = new Date(`${a.data_prevista}T12:00:00`).getTime();
    if (isNaN(t) || t < inicio || t > fim) continue;

    const nomeLote = nomePorLote[a.plantio_id] || 'Lote';
    const keyBase = norm(produto);
    const qtd = parseFloat(String(a.quantidade ?? '').replace(',', '.'));
    const unidade = (a.unidade || '').trim();

    if (!Number.isFinite(qtd) || qtd <= 0 || !unidade) {
      // sem quantidade/unidade → "a confirmar", nunca um número inventado
      if (!incertosMap[keyBase]) {
        incertosMap[keyBase] = {
          produto,
          motivo: 'agendamento sem quantidade/unidade informada',
          lotes: new Set(),
        };
      }
      incertosMap[keyBase].lotes.add(nomeLote);
      continue;
    }

    const nz = normalizeUnidade(qtd, unidade);
    const key = `${keyBase}|${nz.unidade}`;
    if (!acc[key]) acc[key] = { produto, unidade: nz.unidade, necessario: 0, lotes: new Set() };
    acc[key].necessario += nz.qtd;
    acc[key].lotes.add(nomeLote);
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
