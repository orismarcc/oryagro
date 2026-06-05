/**
 * pdfCreditoAgricola.js — Gerador de relatório para financeiras/bancos
 *
 * Gera um PDF profissional consolidando histórico de produção e finanças
 * para apresentação em solicitações de crédito rural (PRONAF, Banco do Brasil,
 * Sicredi, crédito fundiário etc.).
 *
 * Padrão: comprovante econômico-financeiro de produtor rural
 * Layout: A4 portrait, sem overflow, com checkPageBreak automático
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Paleta institucional ───────────────────────────────────────────────────────
const VERDE_PRIMARIO  = [22, 101, 52];    // #166534
const VERDE_ESCURO    = [14, 62, 32];     // #0e3e20
const VERDE_CLARO     = [220, 252, 231];  // #dcfce7
const CINZA_TITULO    = [30, 30, 30];
const CINZA_TEXTO     = [60, 60, 60];
const CINZA_SUBTITULO = [100, 100, 100];
const CINZA_BORDA     = [210, 210, 210];
const VERMELHO        = [220, 38, 38];

// ── Formatadores ──────────────────────────────────────────────────────────────
function fmtBRL(v) {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  if (isNaN(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtNum(v, dec = 0) {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  if (isNaN(n)) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function fmtDate(iso) {
  if (!iso) return '—';
  const s = String(iso).substring(0, 10);
  const parts = s.split('-');
  if (parts.length !== 3) return '—';
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}
function safeTxt(v) {
  return v !== null && v !== undefined ? String(v) : '—';
}

/**
 * Gera o PDF de crédito agrícola.
 *
 * @param {object} params
 * @param {object} params.produtor      - { nome, cpf, telefone, municipio, estado }
 * @param {Array}  params.ciclos        - rows de ciclos_historico
 * @param {Array}  params.lotes         - rows de plantios (ativos)
 * @param {Array}  params.vendas        - rows de vendas
 * @param {Array}  params.despesas      - rows de despesas
 * @param {Array}  params.propriedades  - rows de propriedades
 */
export function gerarPdfCreditoAgricola({
  produtor = {},
  ciclos = [],
  lotes = [],
  vendas = [],
  despesas = [],
  propriedades = [],
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W       = doc.internal.pageSize.getWidth();   // 210 mm
  const H       = doc.internal.pageSize.getHeight();  // 297 mm
  const MARGIN  = 14;
  const CW      = W - MARGIN * 2;                     // 182 mm
  const HEADER_H = 14;                                // altura do header
  const FOOTER_H = 10;                                // altura do footer
  const MAX_Y   = H - FOOTER_H - 4;                  // y máximo seguro

  // ── Posição vertical ─────────────────────────────────────────────────────────
  let y = HEADER_H + 4;

  /** Avança y. */
  const nl = (n = 5) => { y += n; };

  /**
   * Verifica se há espaço suficiente para `needed` mm.
   * Se não houver, adiciona nova página e reinicia header.
   */
  const checkPageBreak = (needed) => {
    if (y + needed > MAX_Y) {
      doc.addPage();
      addHeader();
      y = HEADER_H + 4;
    }
  };

  // ── Cabeçalho de página ───────────────────────────────────────────────────────
  const addHeader = () => {
    // Barra verde
    doc.setFillColor(...VERDE_PRIMARIO);
    doc.rect(0, 0, W, HEADER_H, 'F');

    // Logotipo textual à esquerda
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('OryAgro', MARGIN, 6);

    // Título central
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.text('COMPROVANTE ECONOMICO-FINANCEIRO — PRODUTOR RURAL', W / 2, 6, { align: 'center' });
    doc.text('PRONAF · Banco do Brasil · Sicredi · Credito Rural', W / 2, 10.5, { align: 'center' });

    // Número de página à direita
    const pageNum = doc.internal.getCurrentPageInfo().pageNumber;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text(`Pag. ${pageNum}`, W - MARGIN, 8, { align: 'right' });
  };

  // ── Rodapé (aplicado a todas as páginas no final) ─────────────────────────────
  const addAllFooters = () => {
    const total = doc.internal.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setFillColor(...CINZA_BORDA);
      doc.rect(0, H - FOOTER_H, W, FOOTER_H, 'F');
      doc.setTextColor(...CINZA_SUBTITULO);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Gerado pelo sistema OryAgro | oryagro.vercel.app | ${new Date().toLocaleDateString('pt-BR')}`,
        MARGIN, H - 3.5
      );
      doc.text(
        `Pag. ${i}/${total} — Dados fornecidos pelo proprio produtor. Verifique requisitos especificos junto a instituicao financeira.`,
        W - MARGIN, H - 3.5, { align: 'right' }
      );
    }
  };

  // ── Título de seção ───────────────────────────────────────────────────────────
  const secTitle = (title) => {
    checkPageBreak(14);
    nl(3);
    doc.setFillColor(...VERDE_CLARO);
    doc.roundedRect(MARGIN, y, CW, 8, 1, 1, 'F');
    doc.setTextColor(...VERDE_PRIMARIO);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text(title, MARGIN + 4, y + 5.5);
    nl(11);
  };

  // ── Linha de informação (label + valor, 2 colunas) ────────────────────────────
  const infoRow = (label, value, highlight = false) => {
    checkPageBreak(7);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...CINZA_SUBTITULO);
    const safeLabel = doc.splitTextToSize(safeTxt(label), 48)[0];
    doc.text(safeLabel, MARGIN, y);

    doc.setFont('helvetica', highlight ? 'bold' : 'normal');
    doc.setTextColor(...(highlight ? VERDE_PRIMARIO : CINZA_TEXTO));
    const valStr = safeTxt(value);
    const valLines = doc.splitTextToSize(valStr, CW - 52);
    doc.text(valLines, MARGIN + 52, y);
    nl(Math.max(5.5, valLines.length * 4.5));
  };

  // ── 3 caixas de destaque lado a lado ─────────────────────────────────────────
  const highlightBoxes = (boxes) => {
    checkPageBreak(22);
    const gap  = 3;
    const bW   = (CW - gap * (boxes.length - 1)) / boxes.length;
    const bH   = 20;
    const baseY = y;

    boxes.forEach((b, i) => {
      const bx = MARGIN + i * (bW + gap);
      doc.setFillColor(...b.color);
      doc.roundedRect(bx, baseY, bW, bH, 2, 2, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      // Label pode ser longo — quebrar no limite da caixa
      const labelLines = doc.splitTextToSize(b.label, bW - 6);
      doc.text(labelLines, bx + 3, baseY + 5.5);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      const valLines = doc.splitTextToSize(safeTxt(b.value), bW - 6);
      const valY = baseY + 5.5 + labelLines.length * 3.5 + 3;
      doc.text(valLines[0], bx + 3, valY);
    });

    y = baseY + bH + 4;
  };

  // ── Parágrafo com quebra automática ──────────────────────────────────────────
  const paragraph = (text, fontStyle = 'normal', color = CINZA_TEXTO) => {
    checkPageBreak(10);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', fontStyle);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, CW);
    // Cada linha ocupa ~4.5 mm
    const totalH = lines.length * 4.5;
    checkPageBreak(totalH);
    doc.text(lines, MARGIN, y);
    nl(totalH + 1);
  };

  // ── Wrapper autoTable com rastreamento de y ───────────────────────────────────
  const drawTable = (opts) => {
    checkPageBreak(20); // espaço mínimo para iniciar tabela
    autoTable(doc, {
      ...opts,
      startY: y,
      margin: { left: MARGIN, right: MARGIN, top: HEADER_H + 2, bottom: FOOTER_H + 2 },
      didDrawPage: (data) => {
        // Ao mudar de página dentro do autoTable, redesenha header
        if (data.pageNumber > 1 || doc.internal.getCurrentPageInfo().pageNumber > 1) {
          // header já foi adicionado pelo autoTable via pageBreak automático
        }
        if (opts.didDrawPage) opts.didDrawPage(data);
      },
    });
    y = doc.lastAutoTable.finalY + 5;
  };

  // ════════════════════════════════════════════════════════════════════════════════
  // INÍCIO: PÁGINA 1
  // ════════════════════════════════════════════════════════════════════════════════
  addHeader();
  y = HEADER_H + 4;

  // Título principal
  checkPageBreak(20);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...CINZA_TITULO);
  doc.text('RELATORIO DE CAPACIDADE PRODUTIVA RURAL', W / 2, y + 3, { align: 'center' });
  nl(8);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...CINZA_SUBTITULO);
  doc.text('Comprovante para Credito Rural · PRONAF · Banco do Brasil · Sicredi', W / 2, y, { align: 'center' });
  nl(5);

  // Linha separadora
  doc.setDrawColor(...VERDE_PRIMARIO);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, y, W - MARGIN, y);
  nl(7);

  // ── Seção 1: Identificação do produtor ─────────────────────────────────────
  secTitle('1. IDENTIFICACAO DO PRODUTOR');
  infoRow('Nome completo:', produtor.nome || 'Nao informado');
  infoRow('CPF / CNPJ:', produtor.cpf || 'Nao informado');
  infoRow('Telefone:', produtor.telefone || 'Nao informado');
  infoRow('Municipio / Estado:', `${produtor.municipio || '—'} / ${produtor.estado || 'MT'}`);
  infoRow('Data de geracao:', new Date().toLocaleDateString('pt-BR'));

  // ── Seção 2: Propriedades rurais ───────────────────────────────────────────
  secTitle('2. PROPRIEDADES RURAIS CADASTRADAS');
  if (propriedades.length === 0) {
    checkPageBreak(8);
    doc.setFontSize(7.5);
    doc.setTextColor(...CINZA_SUBTITULO);
    doc.text('Nenhuma propriedade cadastrada.', MARGIN, y);
    nl(8);
  } else {
    drawTable({
      head: [['Propriedade', 'Lotes Ativos', 'Culturas Ativas']],
      body: propriedades.map(p => {
        const ltsProp = lotes.filter(l => l.propriedade_id === p.id && l.status === 'ativo');
        const culturas = [...new Set(ltsProp.map(l => l.cultura_id).filter(Boolean))];
        return [
          safeTxt(p.nome),
          ltsProp.length,
          culturas.length > 0 ? culturas.join(', ') : '—',
        ];
      }),
      styles: { fontSize: 7.5, cellPadding: 2.5, overflow: 'linebreak' },
      headStyles: { fillColor: VERDE_PRIMARIO, textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 28, halign: 'center' },
        2: { cellWidth: 'auto' },
      },
    });
  }

  // ── Seção 3: Sumário financeiro ────────────────────────────────────────────
  secTitle('3. SUMARIO FINANCEIRO — CICLOS CONCLUIDOS');
  if (ciclos.length === 0) {
    checkPageBreak(8);
    doc.setFontSize(7.5);
    doc.setTextColor(...CINZA_SUBTITULO);
    doc.text('Nenhum ciclo concluido registrado ainda.', MARGIN, y);
    nl(8);
  } else {
    const totalReceita   = ciclos.reduce((s, c) => s + parseFloat(c.receita_total || 0), 0);
    const totalCustoIns  = ciclos.reduce((s, c) => s + parseFloat(c.custo_insumos || 0), 0);
    const totalCustoMO   = ciclos.reduce((s, c) => s + parseFloat(c.custo_mao_obra || 0), 0);
    const totalCusto     = totalCustoIns + totalCustoMO;
    const totalLucro     = totalReceita - totalCusto;
    const margemMedia    = totalReceita > 0 ? (totalLucro / totalReceita) * 100 : 0;
    const totalKg        = ciclos.reduce((s, c) => s + parseFloat(c.total_vendas_kg || 0), 0);

    // 3 caixas de destaque
    highlightBoxes([
      { label: 'RECEITA BRUTA TOTAL', value: fmtBRL(totalReceita), color: VERDE_PRIMARIO },
      { label: 'LUCRO LIQUIDO TOTAL',  value: fmtBRL(totalLucro),   color: VERDE_ESCURO },
      { label: 'MARGEM MEDIA',         value: `${fmtNum(margemMedia, 1)}%`, color: [21, 128, 61] },
    ]);

    // Métricas adicionais
    infoRow('Total de ciclos concluidos:', ciclos.length);
    infoRow('Volume total produzido:', `${fmtNum(totalKg, 1)} kg`);
    infoRow('Custo total de insumos:', fmtBRL(totalCustoIns));
    infoRow('Custo total de mao de obra:', fmtBRL(totalCustoMO));

    const datasPlantio = ciclos.map(c => c.data_plantio).filter(Boolean).sort();
    const datasConc    = ciclos.map(c => c.data_conclusao).filter(Boolean).sort();
    const periodoStr   = datasPlantio.length && datasConc.length
      ? `${fmtDate(datasPlantio[0])} a ${fmtDate(datasConc[datasConc.length - 1])}`
      : '—';
    infoRow('Periodo de atividade:', periodoStr, true);

    // Nota técnica para culturas perenes (ciclos longos)
    const mediaDias = ciclos.reduce((s, c) => s + parseFloat(c.dias_ciclo_real || 0), 0) / ciclos.length;
    if (mediaDias > 90) {
      checkPageBreak(12);
      nl(2);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...CINZA_SUBTITULO);
      const nota = doc.splitTextToSize(
        'Nota tecnica: Cultura com ciclo medio superior a 90 dias. O fluxo de caixa deve ser analisado em base anual, considerando sobreposicao de ciclos.',
        CW
      );
      doc.text(nota, MARGIN, y);
      nl(nota.length * 4 + 2);
    }
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // PÁGINA 2 — HISTÓRICO DE SAFRAS + LOTES ATIVOS
  // ════════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  addHeader();
  y = HEADER_H + 4;

  // ── Seção 4: Histórico de safras ───────────────────────────────────────────
  secTitle('4. HISTORICO DE SAFRAS / CICLOS PRODUTIVOS');
  if (ciclos.length === 0) {
    checkPageBreak(8);
    doc.setFontSize(7.5);
    doc.setTextColor(...CINZA_SUBTITULO);
    doc.text('Nenhum ciclo registrado.', MARGIN, y);
    nl(8);
  } else {
    drawTable({
      head: [['Cultura', 'Lote', 'Plantio', 'Colheita', 'Dias', 'Vol. (kg)', 'Receita', 'Custo', 'Lucro', '%']],
      body: [...ciclos]
        .sort((a, b) => (b.data_conclusao || '').localeCompare(a.data_conclusao || ''))
        .map(c => {
          const receita = parseFloat(c.receita_total || 0);
          const custo   = parseFloat(c.custo_insumos || 0) + parseFloat(c.custo_mao_obra || 0);
          const lucro   = receita - custo;
          const margem  = receita > 0 ? (lucro / receita) * 100 : 0;
          return [
            safeTxt(c.cultura_id),
            safeTxt(c.lote_nome || '—'),
            fmtDate(c.data_plantio),
            fmtDate(c.data_conclusao),
            safeTxt(c.dias_ciclo_real || '—'),
            fmtNum(parseFloat(c.total_vendas_kg || 0), 1),
            fmtBRL(receita),
            fmtBRL(custo),
            fmtBRL(lucro),
            `${fmtNum(margem, 0)}%`,
          ];
        }),
      styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: VERDE_PRIMARIO, textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 20 },
        1: { cellWidth: 20 },
        2: { cellWidth: 18, halign: 'center' },
        3: { cellWidth: 18, halign: 'center' },
        4: { cellWidth: 10, halign: 'center' },
        5: { cellWidth: 18, halign: 'right' },
        6: { cellWidth: 22, halign: 'right', textColor: [22, 163, 74] },
        7: { cellWidth: 22, halign: 'right' },
        8: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
        9: { cellWidth: 12, halign: 'right', fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && (data.column.index === 8 || data.column.index === 9)) {
          const txt = String(data.cell.raw);
          if (txt.startsWith('-')) {
            data.cell.styles.textColor = VERMELHO;
          } else {
            data.cell.styles.textColor = [22, 163, 74];
          }
        }
      },
    });
  }

  // ── Seção 5: Lotes ativos ──────────────────────────────────────────────────
  secTitle('5. ATIVIDADE PRODUTIVA ATUAL — LOTES ATIVOS');
  const lotesAtivos = lotes.filter(l => l.status === 'ativo');
  if (lotesAtivos.length === 0) {
    checkPageBreak(8);
    doc.setFontSize(7.5);
    doc.setTextColor(...CINZA_SUBTITULO);
    doc.text('Nenhum lote ativo no momento.', MARGIN, y);
    nl(8);
  } else {
    drawTable({
      head: [['Cultura', 'Nome do Lote', 'Data Plantio', 'Plantas', 'Area', 'Dias no Campo']],
      body: lotesAtivos.map(l => {
        const diasNoCampo = l.data_plantio
          ? Math.floor((Date.now() - new Date(l.data_plantio + 'T12:00:00')) / 86400000)
          : '—';
        const area = l.area_ha
          ? `${l.area_ha} ha`
          : l.comprimento_m && l.largura_m
            ? `${l.comprimento_m}x${l.largura_m} m`
            : '—';
        return [
          safeTxt(l.cultura_id),
          safeTxt(l.nome),
          fmtDate(l.data_plantio),
          l.total_plantas ? fmtNum(l.total_plantas) : '—',
          area,
          `Dia ${diasNoCampo}`,
        ];
      }),
      styles: { fontSize: 7.5, cellPadding: 2.5, overflow: 'linebreak' },
      headStyles: { fillColor: VERDE_PRIMARIO, textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 24, fontStyle: 'bold' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 24, halign: 'center' },
        3: { cellWidth: 20, halign: 'right' },
        4: { cellWidth: 24, halign: 'right' },
        5: { cellWidth: 26, halign: 'center' },
      },
    });
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // PÁGINA 3 — ANÁLISE DE CAPACIDADE + DECLARAÇÃO
  // ════════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  addHeader();
  y = HEADER_H + 4;

  // ── Seção 6: Análise de capacidade de pagamento ────────────────────────────
  secTitle('6. ANALISE DE CAPACIDADE DE PAGAMENTO');

  if (ciclos.length < 2) {
    checkPageBreak(10);
    doc.setFontSize(7.5);
    doc.setTextColor(...CINZA_SUBTITULO);
    const msg = doc.splitTextToSize(
      'Sao necessarios pelo menos 2 ciclos concluidos para gerar a analise de capacidade de pagamento.',
      CW
    );
    doc.text(msg, MARGIN, y);
    nl(msg.length * 5 + 3);
  } else {
    const totalReceita   = ciclos.reduce((s, c) => s + parseFloat(c.receita_total || 0), 0);
    const totalCustoIns  = ciclos.reduce((s, c) => s + parseFloat(c.custo_insumos || 0), 0);
    const totalCustoMO   = ciclos.reduce((s, c) => s + parseFloat(c.custo_mao_obra || 0), 0);
    const totalCusto     = totalCustoIns + totalCustoMO;
    const lucroBruto     = totalReceita - totalCusto;
    const margemPct      = totalReceita > 0 ? (lucroBruto / totalReceita) * 100 : 0;

    const datasPlantio   = ciclos.map(c => c.data_plantio).filter(Boolean).sort();
    const datasConc      = ciclos.map(c => c.data_conclusao).filter(Boolean).sort();
    const mesesAtividade = datasPlantio.length && datasConc.length
      ? Math.max(1, Math.round(
          (new Date(datasConc[datasConc.length - 1]) - new Date(datasPlantio[0])) / (30 * 86400000)
        ))
      : ciclos.length * 3;

    const lucroMensal             = lucroBruto / mesesAtividade;
    const capServicoDivida        = lucroMensal * 0.30;
    const prazoMaxRecomendado     = 60;

    // Tabela de métricas chave
    drawTable({
      head: [['Metrica', 'Valor']],
      body: [
        ['Receita bruta total (historico)', fmtBRL(totalReceita)],
        ['Custo total de insumos', fmtBRL(totalCustoIns)],
        ['Custo total de mao de obra', fmtBRL(totalCustoMO)],
        ['Lucro liquido total', fmtBRL(lucroBruto)],
        ['Margem liquida media', `${fmtNum(margemPct, 1)}%`],
        ['Periodo analisado (meses)', mesesAtividade],
        ['Renda mensal media estimada', fmtBRL(lucroMensal)],
        ['Capacidade de servico de divida (30%)', fmtBRL(capServicoDivida)],
        ['Prazo maximo recomendado', `${prazoMaxRecomendado} meses`],
      ],
      styles: { fontSize: 7.5, cellPadding: 2.5 },
      headStyles: { fillColor: VERDE_ESCURO, textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 110 },
        1: { halign: 'right', fontStyle: 'bold', textColor: VERDE_PRIMARIO },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 1) {
          const label = String(data.row.raw[0]);
          if (label.includes('Lucro') || label.includes('Renda') || label.includes('Capacidade')) {
            data.cell.styles.textColor = VERDE_PRIMARIO;
          }
        }
      },
    });

    // Parágrafo explicativo
    checkPageBreak(24);
    paragraph(
      `Com base nos ${ciclos.length} ciclos concluidos registrados no sistema, a atividade agricola gerou receita bruta total de ` +
      `${fmtBRL(totalReceita)} em aproximadamente ${mesesAtividade} meses, com lucro liquido de ${fmtBRL(lucroBruto)} ` +
      `(margem de ${fmtNum(margemPct, 1)}%). A renda mensal media estimada e de ${fmtBRL(lucroMensal)}.`
    );
    paragraph(
      `Aplicando o criterio conservador de 30% da renda para servico de divida, a capacidade de pagamento mensal estimada e de ` +
      `${fmtBRL(capServicoDivida)}/mes. Recomenda-se prazo maximo de ${prazoMaxRecomendado} meses para financiamentos.`,
      'bold', VERDE_PRIMARIO
    );
    paragraph(
      'Atencao: Esta analise e baseada em dados historicos informados pelo proprio produtor e nao substitui a analise de credito ' +
      'realizada pela instituicao financeira conforme suas normas e regulamentacoes proprias.',
      'italic', CINZA_SUBTITULO
    );

    // Projeções futuras (somente se >= 2 ciclos)
    checkPageBreak(30);
    secTitle('PROJECOES FUTURAS (ESTIMATIVA CONSERVADORA)');

    const mediaCicloMeses = mesesAtividade / ciclos.length;
    const projecoes = [
      { periodo: '6 meses',  ciclosEst: Math.round(6  / mediaCicloMeses) },
      { periodo: '12 meses', ciclosEst: Math.round(12 / mediaCicloMeses) },
      { periodo: '24 meses', ciclosEst: Math.round(24 / mediaCicloMeses) },
    ];
    const receitaMediaCiclo = totalReceita / ciclos.length;
    const lucroMedioCiclo   = lucroBruto / ciclos.length;

    drawTable({
      head: [['Periodo', 'Ciclos Estimados', 'Receita Projetada', 'Lucro Projetado']],
      body: projecoes.map(p => [
        p.periodo,
        p.ciclosEst,
        fmtBRL(receitaMediaCiclo * p.ciclosEst),
        fmtBRL(lucroMedioCiclo * p.ciclosEst),
      ]),
      styles: { fontSize: 7.5, cellPadding: 2.5 },
      headStyles: { fillColor: VERDE_PRIMARIO, textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 30 },
        1: { halign: 'center', cellWidth: 40 },
        2: { halign: 'right', textColor: [22, 163, 74] },
        3: { halign: 'right', fontStyle: 'bold', textColor: [22, 163, 74] },
      },
    });

    checkPageBreak(8);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...CINZA_SUBTITULO);
    const aviso = doc.splitTextToSize(
      '* Projecoes baseadas na media historica dos ciclos registrados. Resultados reais podem variar conforme condicoes de mercado, clima e gestao.',
      CW
    );
    doc.text(aviso, MARGIN, y);
    nl(aviso.length * 4 + 3);
  }

  // ── Seção 7: Declaração ────────────────────────────────────────────────────
  secTitle('7. DECLARACAO DO PRODUTOR');

  checkPageBreak(36);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...CINZA_TEXTO);
  const declaracao = doc.splitTextToSize(
    'Declaro, para os devidos fins, que as informacoes constantes neste documento sao verdadeiras e correspondem ' +
    'a minha real atividade produtiva rural, sendo geradas a partir dos registros do sistema OryAgro. ' +
    'Autorizo a instituicao financeira a verificar as informacoes aqui apresentadas junto aos orgaos competentes.',
    CW
  );
  doc.text(declaracao, MARGIN, y);
  nl(declaracao.length * 5 + 6);

  // Linha horizontal separadora
  checkPageBreak(30);
  doc.setDrawColor(...CINZA_BORDA);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, W - MARGIN, y);
  nl(6);

  // Campos de assinatura: lado esquerdo (produtor) e direito (data/local)
  const midX  = W / 2;
  const sigY  = y;
  const lineSz = (midX - MARGIN - 10);

  // Linha assinatura produtor
  doc.setDrawColor(...CINZA_TITULO);
  doc.setLineWidth(0.5);
  doc.line(MARGIN + 5, sigY + 14, MARGIN + 5 + lineSz - 5, sigY + 14);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...CINZA_TITULO);
  doc.text(safeTxt(produtor.nome || 'Produtor Rural'), MARGIN + 5, sigY + 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...CINZA_SUBTITULO);
  doc.text(`CPF: ${safeTxt(produtor.cpf || 'Nao informado')}`, MARGIN + 5, sigY + 22.5);
  doc.text('Assinatura do Produtor', MARGIN + 5, sigY + 27);

  // Linha local e data
  const dateLineX = midX + 5;
  doc.setDrawColor(...CINZA_TITULO);
  doc.line(dateLineX, sigY + 14, W - MARGIN - 5, sigY + 14);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...CINZA_SUBTITULO);
  doc.text(`${safeTxt(produtor.municipio || '—')} - ${safeTxt(produtor.estado || 'MT')},`, dateLineX, sigY + 18);
  doc.text('______ / ______ / ________', dateLineX, sigY + 22.5);
  doc.text('Local e Data', dateLineX, sigY + 27);

  y = sigY + 32;

  // ── Rodapé em todas as páginas ───────────────────────────────────────────────
  addAllFooters();

  // ── Salvar ────────────────────────────────────────────────────────────────────
  const nomeArquivo = `OryAgro_Credito_${(produtor.nome || 'Produtor').replace(/\s+/g, '_')}_${new Date().getFullYear()}.pdf`;
  doc.save(nomeArquivo);
  return nomeArquivo;
}
