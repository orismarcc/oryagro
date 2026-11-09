/**
 * rateio.js — regras puras de divisão de despesas.
 *
 * - Despesa do LOTE dividida entre os membros (sócios) do lote: por padrão em
 *   partes iguais, cada valor editável; cada parte é "pago" ou "pendente".
 * - Compra da PROPRIEDADE distribuída entre lotes: ao digitar a quantidade que
 *   foi para um lote, o valor sai proporcional ao valor cheio da compra.
 * Tudo em centavos inteiros para a soma fechar exatamente com o total.
 */

const cents = (v) => Math.round((Number(v) || 0) * 100);

/** Número digitado (aceita vírgula). Vazio/ inválido → NaN. */
export function numero(v) {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').trim().replace(/\s/g, '');
  if (!s) return NaN;
  // "1.234,56" → 1234.56 ; "1234,5" → 1234.5 ; "1234.5" → 1234.5
  const norm = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  return Number(norm);
}

/**
 * Divide `total` em `n` partes iguais (2 casas). Os centavos que sobram vão
 * para as primeiras partes: 440 / 3 → [146.67, 146.67, 146.66].
 */
export function dividirIgual(total, n) {
  if (!Number.isFinite(Number(total)) || !(n > 0)) return [];
  const t = cents(total);
  const base = Math.floor(t / n);
  const resto = t - base * n;
  return Array.from({ length: n }, (_, i) => (base + (i < resto ? 1 : 0)) / 100);
}

/** Valor proporcional: `qtd` de `qtdTotal` custa quanto de `valorTotal`. */
export function valorProporcional(qtd, qtdTotal, valorTotal) {
  const q = numero(qtd), qt = numero(qtdTotal), vt = numero(valorTotal);
  if (!Number.isFinite(q) || !Number.isFinite(qt) || !Number.isFinite(vt) || qt <= 0 || q < 0) return null;
  return Math.round((q / qt) * vt * 100) / 100;
}

/** Soma em centavos (evita 0.1 + 0.2). */
export function somar(valores) {
  return valores.reduce((s, v) => s + cents(numero(v) || 0), 0) / 100;
}

/** Diferença entre o total e a soma das partes (0 = fecha certinho). */
export function diferenca(total, partes) {
  return (cents(numero(total) || 0) - cents(somar(partes))) / 100;
}

/**
 * Linhas iniciais do rateio de uma despesa: todos os membros, partes iguais.
 * `pagadorId` (quem pagou na hora) já entra como "pago"; os demais como
 * "pendente" se houver pagador, senão "pago" (cada um pagou a sua parte).
 */
export function rateioInicial(membros, total, pagadorId = null) {
  const valores = dividirIgual(total, membros.length);
  return membros.map((m, i) => ({
    membroId: m.id,
    nome: m.nome,
    valor: valores[i] ?? 0,
    status: !pagadorId || m.id === pagadorId ? 'pago' : 'pendente',
  }));
}

/**
 * Redistribui o total entre as linhas NÃO editadas à mão, mantendo as
 * editadas. Útil quando o total muda ou alguém ajusta uma parte.
 * Quem está fora da divisão (`incluido: false`) fica com 0.
 */
export function redistribuir(linhas, total, editadas = new Set()) {
  const incluidas = linhas.filter(l => l.incluido !== false);
  const fixas = incluidas.filter(l => editadas.has(l.membroId));
  const livres = incluidas.filter(l => !editadas.has(l.membroId));
  const sobra = Math.max(0, (cents(numero(total) || 0) - cents(somar(fixas.map(l => l.valor)))) / 100);
  const valores = dividirIgual(sobra, livres.length);
  let i = 0;
  return linhas.map(l => {
    if (l.incluido === false) return { ...l, valor: 0 };
    return editadas.has(l.membroId) ? l : { ...l, valor: valores[i++] ?? 0 };
  });
}

/**
 * Tira ou devolve um sócio da divisão e reparte de novo. Quem volta entra como
 * "pendente" se outra pessoa pagou tudo. Se todos os incluídos estavam editados
 * à mão, volta a dividir igual (senão a parte de quem saiu ficaria sem dono).
 * @returns {{ linhas: object[], editadas: Set }}
 */
export function alternarMembro(linhas, membroId, total, editadas = new Set(), pagadorId = null) {
  const novas = linhas.map(l => {
    if (l.membroId !== membroId) return l;
    const incluido = l.incluido === false;
    return { ...l, incluido, status: incluido && pagadorId && pagadorId !== membroId ? 'pendente' : l.status };
  });
  let ed = new Set(editadas);
  ed.delete(membroId);
  if (!novas.some(l => l.incluido !== false && !ed.has(l.membroId))) ed = new Set();
  return { linhas: redistribuir(novas, total, ed), editadas: ed };
}

/**
 * Resumo das pendências: total em aberto por pessoa.
 * `rateios` = [{ membro_id, valor, status, membro: { nome } }]
 */
export function pendenciasPorPessoa(rateios) {
  const m = new Map();
  for (const r of rateios) {
    if (r.status !== 'pendente') continue;
    const k = r.membro_id;
    const cur = m.get(k) || { membroId: k, nome: r.membro?.nome || '—', total: 0, itens: 0 };
    cur.total = (cents(cur.total) + cents(r.valor)) / 100;
    cur.itens += 1;
    m.set(k, cur);
  }
  return [...m.values()].sort((a, b) => b.total - a.total);
}

/** Só quem divide as despesas (exclui quem tem apenas acesso ao lote). */
export const soSocios = (membros = []) => membros.filter(m => m.participa_rateio !== false);

/**
 * Quem pagou o quê no lote: por sócio, a parte dele nas despesas divididas,
 * quanto já pagou, quanto falta, a % do total dividido e a diferença para a
 * média (positivo = colocou mais que a média dos sócios).
 * `rateiosPorDespesa` = { [despesaId]: [{ membro_id, valor, status }] }
 * Despesas sem divisão entram em `semDivisao`.
 */
export function resumoPorSocio(despesas = [], rateiosPorDespesa = {}, membros = []) {
  const socios = soSocios(membros);
  const linhas = new Map(socios.map(m => [m.id, { membroId: m.id, nome: m.nome, parte: 0, pago: 0, pendente: 0 }]));
  let semDivisao = 0;
  for (const d of despesas) {
    const rs = rateiosPorDespesa[d.id] || [];
    if (!rs.length) { semDivisao += cents(d.valor); continue; }
    for (const r of rs) {
      let l = linhas.get(r.membro_id);
      if (!l) {  // sócio removido ou que virou "só acesso": mantém o que ele pagou
        l = { membroId: r.membro_id, nome: r.membro?.nome || '—', parte: 0, pago: 0, pendente: 0 };
        linhas.set(r.membro_id, l);
      }
      const v = cents(r.valor);
      l.parte += v;
      if (r.status === 'pendente') l.pendente += v; else l.pago += v;
    }
  }
  const lista = [...linhas.values()];
  const totalDividido = lista.reduce((s, l) => s + l.parte, 0);
  const media = lista.length ? totalDividido / lista.length : 0;
  return {
    totalDividido: totalDividido / 100,
    semDivisao: semDivisao / 100,
    socios: lista.map(l => ({
      membroId: l.membroId,
      nome: l.nome,
      parte: l.parte / 100,
      pago: l.pago / 100,
      pendente: l.pendente / 100,
      percentual: totalDividido > 0 ? Math.round((l.parte / totalDividido) * 1000) / 10 : 0,
      diferenca: Math.round(l.parte - media) / 100,
    })),
  };
}
