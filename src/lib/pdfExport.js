import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CULTURAS } from '../data/culturas';

function fmtBRL(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function fmtDateBR(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

function today() {
  return new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export async function exportarRelatorioPDF(lotes, eventosColheita, todasVendas, propriedades) {
  // CULTURAS imported statically at top

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const MARGIN = 14;
  let y = MARGIN;

  // ─── Header ───────────────────────────────────────────────────────────────
  doc.setFillColor(22, 101, 52); // green-800
  doc.rect(0, 0, W, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('OryAgro — Relatório de Produção', MARGIN, 14);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Gerado em: ${today()}`, W - MARGIN, 14, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  y = 32;

  // ─── Section helper ───────────────────────────────────────────────────────
  function sectionTitle(title) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(22, 101, 52);
    doc.text(title, MARGIN, y);
    doc.setDrawColor(22, 101, 52);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y + 1, W - MARGIN, y + 1);
    doc.setTextColor(0, 0, 0);
    y += 6;
  }

  function checkPageBreak(needed = 20) {
    if (y + needed > 275) {
      doc.addPage();
      y = MARGIN;
    }
  }

  // ─── 1. Resumo Geral ──────────────────────────────────────────────────────
  sectionTitle('Resumo Geral');
  const lotesAtivos = lotes.filter(l => l.status === 'ativo');
  const totalPlantas = lotesAtivos.reduce((s, l) => s + (l.total_plantas || 0), 0);
  const areaTotal = lotesAtivos.reduce((s, l) => s + (parseFloat(l.area_ha) || 0), 0);

  const resumoData = [
    ['Total de Lotes',    lotes.length.toString()],
    ['Lotes Ativos',      lotesAtivos.length.toString()],
    ['Total de Plantas',  totalPlantas.toLocaleString('pt-BR')],
    ['Área Cultivada',    `${areaTotal.toFixed(2)} ha`],
    ['Colheitas Regist.', eventosColheita.length.toString()],
    ['Vendas Registradas', todasVendas.length.toString()],
  ];

  autoTable(doc, {
    startY: y,
    head: [],
    body: resumoData,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55 }, 1: { cellWidth: 45 } },
    margin: { left: MARGIN, right: MARGIN },
  });
  y = doc.lastAutoTable.finalY + 8;

  // ─── 2. Lotes Ativos ─────────────────────────────────────────────────────
  checkPageBreak(30);
  sectionTitle('Lotes Ativos');

  if (lotesAtivos.length > 0) {
    const lotesRows = lotesAtivos.map(l => {
      const c = CULTURAS[l.cultura_id];
      return [
        l.nome,
        c?.nome || '—',
        fmtDateBR(l.data_plantio),
        (l.total_plantas || 0).toLocaleString('pt-BR'),
        l.area_ha ? `${parseFloat(l.area_ha).toFixed(2)} ha` : '—',
        l.status || 'ativo',
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [['Nome', 'Cultura', 'Plantio', 'Plantas', 'Área', 'Status']],
      body: lotesRows,
      theme: 'striped',
      headStyles: { fillColor: [22, 101, 52], fontSize: 8, textColor: 255 },
      bodyStyles: { fontSize: 8 },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = doc.lastAutoTable.finalY + 8;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text('Nenhum lote ativo.', MARGIN, y);
    doc.setTextColor(0);
    y += 8;
  }

  // ─── 3. Projeção Financeira ───────────────────────────────────────────────
  checkPageBreak(30);
  sectionTitle('Projeção Financeira por Lote');

  const finRows = lotesAtivos.map(l => {
    const c = CULTURAS[l.cultura_id];
    if (!c) return null;
    const venda = c.venda || {};
    const sobr = (venda.sobrevivencia || 90) / 100;
    const preco = venda.precoUnitario || 0;
    let qtd = 0;
    if (venda.producaoKgPorHa) {
      qtd = venda.producaoKgPorHa * (parseFloat(l.area_ha) || 1) * sobr;
    } else if (venda.producaoBase) {
      qtd = venda.producaoBase * sobr;
    } else {
      qtd = (l.total_plantas || 0) * sobr;
    }
    const receita = qtd * preco;
    const maoObra = parseFloat(l.mao_obra_total) || 0;
    return [l.nome, c.nome, `${Math.round(qtd).toLocaleString('pt-BR')} ${venda.unidade || 'un'}`, fmtBRL(receita), fmtBRL(maoObra)];
  }).filter(Boolean);

  if (finRows.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Lote', 'Cultura', 'Prod. Estimada', 'Receita Proj.', 'Mão de Obra']],
      body: finRows,
      theme: 'striped',
      headStyles: { fillColor: [22, 101, 52], fontSize: 8, textColor: 255 },
      bodyStyles: { fontSize: 8 },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // ─── 4. Colheitas Registradas ─────────────────────────────────────────────
  if (eventosColheita.length > 0) {
    checkPageBreak(30);
    sectionTitle('Colheitas Registradas');
    const colheitaRows = eventosColheita.map(ev => {
      let qtd = '—';
      try {
        const d = typeof ev.descricao === 'string' ? JSON.parse(ev.descricao) : ev.descricao;
        if (d?.qtd) qtd = `${d.qtd} ${d.unidade || 'un'}`;
      } catch {}
      const lote = lotes.find(l => String(l.id) === String(ev.plantio_id));
      const cultura = lote ? CULTURAS[lote.cultura_id] : null;
      return [fmtDateBR(ev.data), lote?.nome || '—', cultura?.nome || '—', qtd];
    });
    autoTable(doc, {
      startY: y,
      head: [['Data', 'Lote', 'Cultura', 'Quantidade']],
      body: colheitaRows,
      theme: 'striped',
      headStyles: { fillColor: [22, 101, 52], fontSize: 8, textColor: 255 },
      bodyStyles: { fontSize: 8 },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // ─── 5. Vendas ────────────────────────────────────────────────────────────
  if (todasVendas.length > 0) {
    checkPageBreak(30);
    sectionTitle('Vendas Registradas');
    const totalReceita = todasVendas.reduce((s, v) => s + v.quantidade * v.preco_unitario, 0);
    const vendasRows = todasVendas.map(v => {
      const lote = lotes.find(l => String(l.id) === String(v.plantio_id));
      const receita = v.quantidade * v.preco_unitario;
      return [
        fmtDateBR(v.data),
        lote?.nome || '—',
        `${v.quantidade} ${v.unidade}`,
        fmtBRL(v.preco_unitario) + `/${v.unidade}`,
        fmtBRL(receita),
        v.destino || '—',
      ];
    });
    vendasRows.push(['', '', '', 'TOTAL', fmtBRL(totalReceita), '']);
    autoTable(doc, {
      startY: y,
      head: [['Data', 'Lote', 'Quantidade', 'Preço Unit.', 'Total', 'Destino']],
      body: vendasRows,
      theme: 'striped',
      headStyles: { fillColor: [22, 101, 52], fontSize: 8, textColor: 255 },
      bodyStyles: { fontSize: 8 },
      footStyles: { fontStyle: 'bold' },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // ─── Footer ───────────────────────────────────────────────────────────────
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(`OryAgro — Relatório gerado em ${today()} — Página ${i} de ${pageCount}`, W / 2, 290, { align: 'center' });
  }

  doc.save(`oryagro-relatorio-${new Date().toISOString().split('T')[0]}.pdf`);
}
