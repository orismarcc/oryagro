/**
 * relatorioFinanceiroPdf.js — Relatório Financeiro Consolidado (DRE).
 *
 * Nos mesmos moldes do Caderno de Campo: cabeçalho institucional, identificação,
 * demonstrativo consolidado, quadro por safra e por lote, indicadores e nota
 * para uso financeiro (crédito rural). Alimentado pela DRE ao vivo (buildDreMap
 * + aggregateDreEntry) — os mesmos números exibidos na tela do Financeiro.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { buildDreMap } from '../components/finance/helpers';
import { aggregateDreEntry } from './financeiro';
import { CULTURAS } from '../data/culturas';

const GREEN = [22, 101, 52];
const GRAY = [90, 90, 90];

const fmtBRL = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtPct = (v) => (v == null || !isFinite(v) ? '—' : `${v.toFixed(1)}%`);
function nowBR() {
  return new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function gerarRelatorioFinanceiroPDF({ rawData, propriedades = [], produtor = '' }) {
  const dreMap = buildDreMap(rawData || {});
  const plantios = rawData?.plantios ?? [];
  const propById = new Map((propriedades || []).map(p => [String(p.id), p]));
  const loteById = new Map(plantios.map(p => [String(p.id), p]));

  // Achata dreMap → linhas por lote×ano
  const linhas = [];
  const porAno = {};   // ano -> agregados
  const totais = { receita: 0, custoInsumos: 0, custoDespesas: 0, custoMaoObra: 0, custo: 0, lucro: 0, kg: 0 };

  Object.entries(dreMap).forEach(([pid, byAno]) => {
    const lote = loteById.get(String(pid));
    Object.entries(byAno).forEach(([ano, entry]) => {
      const agg = aggregateDreEntry(entry);
      const kg = (entry.vendas || []).reduce((s, v) => s + (v.quantidade ?? 0), 0);
      const cultura = lote ? CULTURAS[lote.cultura_id] : null;
      const prop = lote?.propriedade_id ? propById.get(String(lote.propriedade_id)) : null;
      linhas.push({
        loteNome: lote?.nome || (pid === '__receita__' ? 'Receitas avulsas' : `Lote ${String(pid).slice(0, 6)}`),
        culturaNome: cultura?.nome || '—',
        propNome: prop?.nome || '—',
        ano,
        ...agg, kg,
      });
      if (!porAno[ano]) porAno[ano] = { receita: 0, custo: 0, lucro: 0, custoInsumos: 0, custoDespesas: 0, custoMaoObra: 0, kg: 0 };
      const a = porAno[ano];
      a.receita += agg.receita; a.custo += agg.custo; a.lucro += agg.lucro;
      a.custoInsumos += agg.custoInsumos; a.custoDespesas += agg.custoDespesas; a.custoMaoObra += agg.custoMaoObra; a.kg += kg;
      totais.receita += agg.receita; totais.custo += agg.custo; totais.lucro += agg.lucro;
      totais.custoInsumos += agg.custoInsumos; totais.custoDespesas += agg.custoDespesas; totais.custoMaoObra += agg.custoMaoObra; totais.kg += kg;
    });
  });

  linhas.sort((a, b) => (b.ano.localeCompare?.(a.ano) ?? b.ano - a.ano) || (b.receita - a.receita));
  const anos = Object.keys(porAno).sort((a, b) => (b.localeCompare?.(a) ?? b - a));
  const margemTotal = totais.receita > 0 ? (totais.lucro / totais.receita) * 100 : null;
  const custoKgMedio = totais.kg > 0 ? totais.custo / totais.kg : null;

  // ─── Documento ───────────────────────────────────────────────────────────
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  let y = 0;

  doc.setFillColor(...GREEN);
  doc.rect(0, 0, W, 24, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('RELATÓRIO FINANCEIRO CONSOLIDADO', M, 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('Demonstrativo de resultados por safra e lote — apoio a crédito rural', M, 17);
  doc.text(`Emitido em: ${nowBR()}`, W - M, 17, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  y = 32;

  // Identificação
  autoTable(doc, {
    startY: y, theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 1.6 },
    columnStyles: { 0: { fontStyle: 'bold', fillColor: [240, 245, 242], cellWidth: 42 }, 2: { fontStyle: 'bold', fillColor: [240, 245, 242], cellWidth: 42 } },
    body: [
      ['Produtor', produtor || '—', 'Propriedades', String(propriedades.length || '—')],
      ['Safras cobertas', anos.length ? `${anos[anos.length - 1]} a ${anos[0]}` : '—', 'Registros', String(linhas.length)],
    ],
    margin: { left: M, right: M },
  });
  y = doc.lastAutoTable.finalY + 6;

  // ─── Demonstrativo consolidado ───────────────────────────────────────────
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...GREEN);
  doc.text('1. Demonstrativo Consolidado', M, y); doc.setTextColor(0, 0, 0); y += 2;
  autoTable(doc, {
    startY: y + 1, theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1.8 },
    columnStyles: { 0: { cellWidth: 110 }, 1: { halign: 'right', fontStyle: 'bold' } },
    body: [
      ['Receita bruta total', fmtBRL(totais.receita)],
      ['(−) Custo com insumos', fmtBRL(totais.custoInsumos)],
      ['(−) Custo com mão de obra', fmtBRL(totais.custoMaoObra)],
      ['(−) Outras despesas', fmtBRL(totais.custoDespesas)],
      ['(=) Custo total', fmtBRL(totais.custo)],
      ['(=) Resultado líquido', fmtBRL(totais.lucro)],
      ['Margem líquida', fmtPct(margemTotal)],
      ['Produção total comercializada', `${totais.kg.toLocaleString('pt-BR')} kg`],
      ['Custo médio por kg', custoKgMedio != null ? fmtBRL(custoKgMedio) : '—'],
    ],
    didParseCell: (d) => {
      if (d.row.index === 5) { d.cell.styles.fillColor = totais.lucro >= 0 ? [232, 245, 233] : [253, 232, 232]; d.cell.styles.fontStyle = 'bold'; }
    },
    margin: { left: M, right: M },
  });
  y = doc.lastAutoTable.finalY + 6;

  // ─── Resultado por safra ─────────────────────────────────────────────────
  if (anos.length) {
    if (y > H - 40) { doc.addPage(); y = M; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...GREEN);
    doc.text('2. Resultado por Safra', M, y); doc.setTextColor(0, 0, 0);
    autoTable(doc, {
      startY: y + 2, theme: 'striped', headStyles: { fillColor: GREEN, fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 1.4 },
      head: [['Safra', 'Receita', 'Custo', 'Lucro', 'Margem', 'kg']],
      body: anos.map(ano => {
        const a = porAno[ano];
        const m = a.receita > 0 ? (a.lucro / a.receita) * 100 : null;
        return [ano, fmtBRL(a.receita), fmtBRL(a.custo), fmtBRL(a.lucro), fmtPct(m), a.kg.toLocaleString('pt-BR')];
      }),
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
      margin: { left: M, right: M },
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  // ─── Detalhe por lote × safra ────────────────────────────────────────────
  if (linhas.length) {
    if (y > H - 40) { doc.addPage(); y = M; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...GREEN);
    doc.text('3. Detalhe por Lote e Safra', M, y); doc.setTextColor(0, 0, 0);
    autoTable(doc, {
      startY: y + 2, theme: 'striped', headStyles: { fillColor: GREEN, fontSize: 7.5 },
      styles: { fontSize: 7.5, cellPadding: 1.3, overflow: 'linebreak' },
      head: [['Lote', 'Cultura', 'Prop.', 'Safra', 'Receita', 'Custo', 'Lucro', 'Marg.']],
      body: linhas.map(l => [
        l.loteNome, l.culturaNome, l.propNome, l.ano,
        fmtBRL(l.receita), fmtBRL(l.custo), fmtBRL(l.lucro), fmtPct(l.margemPct),
      ]),
      columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' } },
      margin: { left: M, right: M },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // ─── Assinatura + nota ───────────────────────────────────────────────────
  if (y > H - 40) { doc.addPage(); y = M; }
  y = Math.max(y, H - 40);
  doc.setDrawColor(...GRAY); doc.setLineWidth(0.2);
  doc.line(M, y, M + 75, y);
  doc.setFontSize(7.5); doc.setTextColor(...GRAY);
  doc.text('Produtor / Responsável', M, y + 4);
  doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, W - M, y + 4, { align: 'right' });
  y += 11;
  doc.setFontSize(6.8);
  const nota =
    'Relatório gerado pelo OryAgro a partir dos lançamentos financeiros do produtor (vendas, insumos, mão de obra e despesas). ' +
    'Documento de apoio à análise de crédito rural; não substitui a escrituração contábil nem o Livro Caixa do Produtor Rural. ' +
    'Os valores refletem os dados informados pelo usuário até a data de emissão.';
  doc.text(doc.splitTextToSize(nota, W - 2 * M), M, y);

  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFontSize(7); doc.setTextColor(...GRAY);
    doc.text(`Página ${p} de ${total}`, W - M, H - 6, { align: 'right' });
    doc.text('OryAgro · Relatório Financeiro', M, H - 6);
  }

  doc.save(`relatorio-financeiro-${new Date().toISOString().slice(0, 10)}.pdf`);
}
