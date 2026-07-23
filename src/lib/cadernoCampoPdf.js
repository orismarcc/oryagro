/**
 * cadernoCampoPdf.js — Relatório de Caderno de Campo de Aplicações.
 *
 * Gera um PDF de rastreabilidade no padrão exigido para fiscalização
 * (MAPA / defesa agropecuária / certificações): identificação do produtor e
 * da área, tabela cronológica das aplicações e ficha detalhada de cada uma,
 * com espaço para assinatura do responsável técnico.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { classeLabel, tipoLabel } from '../data/defensivos';

const GREEN = [22, 101, 52];
const GRAY = [90, 90, 90];

function fmtDateBR(iso) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}
function nowBR() {
  return new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
const dash = (v) => (v == null || v === '' ? '—' : String(v));

export function gerarCadernoCampoPDF({ lote, cultura, propriedade, aplicacoes = [], produtor = '' }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  let y = 0;

  // ─── Cabeçalho ───────────────────────────────────────────────────────────
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, W, 24, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('CADERNO DE CAMPO — REGISTRO DE APLICAÇÕES', M, 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('Rastreabilidade de defensivos e fertilizantes (padrão MAPA)', M, 17);
  doc.text(`Emitido em: ${nowBR()}`, W - M, 17, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  y = 32;

  // ─── Identificação ───────────────────────────────────────────────────────
  const areaLote = lote?.area_ha ? `${parseFloat(lote.area_ha).toLocaleString('pt-BR')} ha` : '—';
  const ident = [
    ['Produtor', dash(produtor)],
    ['Propriedade', dash(propriedade?.nome)],
    ['Município / UF', dash([propriedade?.municipio, propriedade?.uf].filter(Boolean).join(' / ') || null)],
    ['Talhão / Lote', dash(lote?.nome)],
    ['Cultura', dash(cultura?.nome)],
    ['Área do lote', areaLote],
    ['Data de plantio', fmtDateBR(lote?.data_plantio)],
    ['Total de aplicações', String(aplicacoes.length)],
  ];
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 1.6 },
    columnStyles: { 0: { fontStyle: 'bold', fillColor: [240, 245, 242], cellWidth: 42 } },
    body: ident,
    margin: { left: M, right: M },
  });
  y = doc.lastAutoTable.finalY + 6;

  // ─── Tabela cronológica ──────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...GREEN);
  doc.text('1. Histórico de Aplicações', M, y);
  doc.setTextColor(0, 0, 0);
  y += 2;

  if (aplicacoes.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text('Nenhuma aplicação registrada para este lote.', M, y + 6);
    doc.setTextColor(0, 0, 0);
  } else {
    const ordenadas = [...aplicacoes].sort((a, b) => (a.data || '').localeCompare(b.data || ''));
    autoTable(doc, {
      startY: y + 2,
      theme: 'striped',
      headStyles: { fillColor: GREEN, fontSize: 7.5 },
      styles: { fontSize: 7.5, cellPadding: 1.4, overflow: 'linebreak' },
      head: [['Data', 'Produto', 'Ingr. ativo', 'Classe', 'Alvo', 'Dose', 'Carênc.']],
      body: ordenadas.map((a) => [
        fmtDateBR(a.data),
        dash(a.produto),
        dash(a.ingrediente_ativo),
        a.classe ? classeLabel(a.classe) : '—',
        dash(a.alvo),
        dash(a.dose),
        a.carencia_dias != null ? `${a.carencia_dias} d` : '—',
      ]),
      margin: { left: M, right: M },
    });
    y = doc.lastAutoTable.finalY + 8;

    // ─── Fichas detalhadas ─────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...GREEN);
    if (y > H - 30) { doc.addPage(); y = M; }
    doc.text('2. Fichas Detalhadas', M, y);
    doc.setTextColor(0, 0, 0);
    y += 4;

    ordenadas.forEach((a, i) => {
      const rows = [
        ['Data', fmtDateBR(a.data), 'Tipo', a.tipo ? tipoLabel(a.tipo) : '—'],
        ['Produto comercial', dash(a.produto), 'Classe', a.classe ? classeLabel(a.classe) : '—'],
        ['Ingrediente ativo', dash(a.ingrediente_ativo), 'Registro MAPA', dash(a.registro_mapa)],
        ['Alvo (praga/doença)', dash(a.alvo), 'Dose', dash(a.dose)],
        ['Área tratada', a.area_ha != null ? `${a.area_ha} ha` : '—', 'Volume de calda', dash(a.volume_calda)],
        ['Equipamento', dash(a.equipamento), 'Carência (dias)', a.carencia_dias != null ? String(a.carencia_dias) : '—'],
        ['Operador', dash(a.operador), 'EPI utilizado', dash(a.epi)],
        ['Resp. técnico', dash(a.resp_tecnico), 'CREA', dash(a.crea)],
        ['Receituário nº', dash(a.receituario), 'Clima (T/UR/vento)',
          [a.clima_temp && `${a.clima_temp}°C`, a.clima_umidade && `${a.clima_umidade}%`, a.clima_vento && `${a.clima_vento} km/h`].filter(Boolean).join(' · ') || '—'],
      ];
      if (a.obs) rows.push(['Observações', dash(a.obs), '', '']);

      // page break se não couber a ficha inteira (~48mm)
      if (y > H - 55) { doc.addPage(); y = M; }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setFillColor(...GREEN);
      doc.setTextColor(255, 255, 255);
      doc.rect(M, y, W - 2 * M, 6, 'F');
      doc.text(`Aplicação ${i + 1} — ${fmtDateBR(a.data)}  ·  ${dash(a.produto)}`, M + 2, y + 4.2);
      doc.setTextColor(0, 0, 0);
      y += 6;

      autoTable(doc, {
        startY: y,
        theme: 'grid',
        styles: { fontSize: 7.8, cellPadding: 1.3, overflow: 'linebreak' },
        columnStyles: {
          0: { fontStyle: 'bold', fillColor: [244, 248, 246], cellWidth: 33 },
          2: { fontStyle: 'bold', fillColor: [244, 248, 246], cellWidth: 33 },
        },
        body: rows,
        margin: { left: M, right: M },
      });
      y = doc.lastAutoTable.finalY + 5;
    });
  }

  // ─── Rodapé legal + assinatura (última página) ───────────────────────────
  if (y > H - 42) { doc.addPage(); y = M; }
  y = Math.max(y, H - 42);
  doc.setDrawColor(...GRAY);
  doc.setLineWidth(0.2);
  doc.line(M, y, M + 70, y);
  doc.line(W - M - 70, y, W - M, y);
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY);
  doc.text('Responsável pela aplicação', M, y + 4);
  doc.text('Responsável técnico (Agrônomo / CREA)', W - M - 70, y + 4);
  y += 12;
  doc.setFontSize(6.8);
  const nota =
    'Documento gerado pelo OryAgro para fins de rastreabilidade. O registro de aplicações de agrotóxicos e afins é ' +
    'obrigatório (Lei nº 7.802/1989 e Decreto nº 4.074/2002). O uso de agrotóxicos exige receituário agronômico e ' +
    'deve seguir as instruções do rótulo/bula quanto a dose, alvo, carência e destinação de embalagens. ' +
    'Confira sempre o número de registro MAPA e o período de carência no rótulo do produto.';
  doc.text(doc.splitTextToSize(nota, W - 2 * M), M, y);

  // Numeração de páginas
  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(`Página ${p} de ${total}`, W - M, H - 6, { align: 'right' });
    doc.text('OryAgro · Caderno de Campo', M, H - 6);
  }

  const nomeArq = `caderno-campo-${(lote?.nome || 'lote').replace(/\s+/g, '-').toLowerCase()}.pdf`;
  doc.save(nomeArq);
}
