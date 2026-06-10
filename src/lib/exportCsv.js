/**
 * exportCsv.js — geração e download de arquivos CSV no navegador / WebView.
 *
 * Voltado ao produtor que precisa entregar vendas e despesas ao contador
 * (declaração de IR / ITR). Gera CSV com separador ';' e BOM UTF-8 para abrir
 * corretamente no Excel em português (que usa ';' como separador de colunas).
 */

const BOM = '﻿';

/** Escapa um valor para uma célula CSV (aspas duplas + escape de aspas internas). */
function escapeCell(value) {
  if (value == null) return '';
  const str = String(value);
  // Sempre entre aspas para tolerar ';', quebras de linha e vírgulas decimais.
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Monta o texto CSV a partir de cabeçalhos e linhas.
 * @param {string[]} headers
 * @param {Array<Array<string|number>>} rows
 * @returns {string}
 */
export function toCsv(headers, rows) {
  const headerLine = headers.map(escapeCell).join(';');
  const bodyLines = rows.map((row) => row.map(escapeCell).join(';'));
  return BOM + [headerLine, ...bodyLines].join('\r\n');
}

/**
 * Dispara o download de um conteúdo de texto como arquivo.
 * Usa Blob + âncora (funciona em navegadores modernos e Webview Android recente).
 * @param {string} filename
 * @param {string} content
 * @param {string} [mime]
 */
export function downloadText(filename, content, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  // Pequeno atraso antes de revogar evita download abortado em alguns WebViews.
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

const fmtNum = (v) => (Number(v) || 0).toFixed(2).replace('.', ',');
const fmtData = (d) => {
  if (!d) return '';
  const dt = new Date(d + 'T12:00:00');
  if (isNaN(dt)) return String(d);
  return dt.toLocaleDateString('pt-BR');
};

/**
 * Exporta vendas e despesas de um período como dois arquivos CSV.
 * @param {object} args
 * @param {Array} args.vendas        - linhas de vendas (com .data, .quantidade, .preco_unitario, .cultura/nome)
 * @param {Array} args.despesas      - linhas de despesas (com .data, .categoria, .descricao, .valor)
 * @param {(p:object)=>string} [args.nomePlantio] - resolve nome do lote a partir do plantio_id
 * @param {string} [args.sufixo]     - sufixo do arquivo (ex.: período "2025-26")
 */
export function exportFinanceiroCsv({ vendas = [], despesas = [], nomePlantio = () => '', sufixo = '' }) {
  const tag = sufixo ? `_${sufixo}` : '';

  const vendasRows = vendas.map((v) => {
    const valor = (v.quantidade ?? 0) * (v.preco_unitario ?? 0);
    return [
      fmtData(v.data),
      nomePlantio(v.plantio_id) || '',
      v.produto || v.cultura || '',
      fmtNum(v.quantidade),
      v.unidade || '',
      fmtNum(v.preco_unitario),
      fmtNum(valor),
      v.comprador || v.cliente || '',
    ];
  });
  const vendasCsv = toCsv(
    ['Data', 'Lote', 'Produto', 'Quantidade', 'Unidade', 'Preço unit. (R$)', 'Total (R$)', 'Comprador'],
    vendasRows,
  );

  const despesasRows = despesas.map((d) => [
    fmtData(d.data),
    nomePlantio(d.plantio_id) || (d.plantio_id ? '' : 'Custo indireto'),
    d.categoria || '',
    d.descricao || '',
    fmtNum(d.valor),
  ]);
  const despesasCsv = toCsv(
    ['Data', 'Lote', 'Categoria', 'Descrição', 'Valor (R$)'],
    despesasRows,
  );

  downloadText(`vendas${tag}.csv`, vendasCsv);
  // Atraso entre os dois downloads — alguns navegadores bloqueiam downloads simultâneos.
  setTimeout(() => downloadText(`despesas${tag}.csv`, despesasCsv), 600);

  return { vendas: vendasRows.length, despesas: despesasRows.length };
}
