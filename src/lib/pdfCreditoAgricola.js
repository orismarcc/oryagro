/**
 * pdfCreditoAgricola.js — Gerador de relatório para financeiras/bancos
 *
 * Gera um PDF profissional consolidando histórico de produção e finanças
 * para apresentação em solicitações de crédito rural (PRONAF, Banco do Brasil,
 * Sicredi, crédito fundiário etc.).
 *
 * Padrão: comprovante econômico-financeiro de produtor rural
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Paleta institucional
const VERDE_PRIMARIO  = [22, 101, 52];   // #166534
const VERDE_CLARO     = [220, 252, 231]; // #dcfce7
const CINZA_TITULO    = [30, 30, 30];
const CINZA_TEXTO     = [60, 60, 60];
const CINZA_SUBTITULO = [100, 100, 100];
const CINZA_BORDA     = [210, 210, 210];
const VERDE_LINHA     = [134, 239, 172]; // #86efac

function fmtBRL(v) {
  if (!v && v !== 0) return '—';
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtNum(v, dec = 0) {
  if (!v && v !== 0) return '—';
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.substring(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Gera o PDF de crédito agrícola.
 *
 * @param {object} params
 * @param {object} params.produtor  - { nome, cpf, telefone, municipio, estado, dataGeracao }
 * @param {Array}  params.ciclos    - rows de ciclos_historico
 * @param {Array}  params.lotes     - rows de plantios (ativos)
 * @param {Array}  params.vendas    - rows de vendas
 * @param {Array}  params.despesas  - rows de despesas
 * @param {Array}  params.propriedades - rows de propriedades
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
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const MARGIN = 15;
  const CONTENT_W = W - MARGIN * 2;

  // ── helpers de posição ──────────────────────────────────────────────────────
  let y = MARGIN;
  const nl = (n = 5) => { y += n; };
  const newPage = () => { doc.addPage(); y = MARGIN; addHeader(); };

  // ── cabeçalho de página ─────────────────────────────────────────────────────
  const addHeader = () => {
    // Barra verde topo
    doc.setFillColor(...VERDE_PRIMARIO);
    doc.rect(0, 0, W, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('COMPROVANTE ECONÔMICO-FINANCEIRO — PRODUTOR RURAL', MARGIN, 8);
    doc.setFont('helvetica', 'normal');
    const pageNum = doc.internal.getCurrentPageInfo().pageNumber;
    doc.text(`Pág. ${pageNum}`, W - MARGIN, 8, { align: 'right' });
    y = 18;
  };

  // ── rodapé ──────────────────────────────────────────────────────────────────
  const addFooter = () => {
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFillColor(...CINZA_BORDA);
      doc.rect(0, H - 10, W, 10, 'F');
      doc.setTextColor(...CINZA_SUBTITULO);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.text('Gerado pelo sistema OryAgro | oryagro.vercel.app', MARGIN, H - 3.5);
      doc.text(
        `Documento gerado em ${new Date().toLocaleDateString('pt-BR')} — Dados do próprio produtor. Verifique junto à instituição financeira os requisitos específicos.`,
        W - MARGIN, H - 3.5, { align: 'right' }
      );
    }
  };

  // ── seção título ────────────────────────────────────────────────────────────
  const secTitle = (title, icon = '') => {
    nl(4);
    doc.setFillColor(...VERDE_CLARO);
    doc.roundedRect(MARGIN, y, CONTENT_W, 8, 1, 1, 'F');
    doc.setTextColor(...VERDE_PRIMARIO);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`${icon}  ${title}`.trim(), MARGIN + 4, y + 5.5);
    nl(11);
  };

  // ── campo info ──────────────────────────────────────────────────────────────
  const infoRow = (label, value, isHighlight = false) => {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...CINZA_SUBTITULO);
    doc.text(label, MARGIN, y);
    doc.setFont('helvetica', isHighlight ? 'bold' : 'normal');
    doc.setTextColor(isHighlight ? VERDE_PRIMARIO[0] : CINZA_TEXTO[0],
                    isHighlight ? VERDE_PRIMARIO[1] : CINZA_TEXTO[1],
                    isHighlight ? VERDE_PRIMARIO[2] : CINZA_TEXTO[2]);
    doc.text(String(value ?? '—'), MARGIN + 50, y);
    nl(5.5);
  };

  // ── caixa destaque ──────────────────────────────────────────────────────────
  const highlightBox = (label, value, color = VERDE_PRIMARIO) => {
    doc.setFillColor(color[0], color[1], color[2]);
    doc.roundedRect(MARGIN, y, CONTENT_W / 3 - 2, 14, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(label, MARGIN + 4, y + 5);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(String(value), MARGIN + 4, y + 11.5);
    nl(18);
  };

  // ════════════════════════════════════════════════════════════════════════════
  // PÁGINA 1 — IDENTIFICAÇÃO E SUMÁRIO FINANCEIRO
  // ════════════════════════════════════════════════════════════════════════════
  addHeader();

  // Título principal
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...CINZA_TITULO);
  doc.text('RELATÓRIO DE CAPACIDADE PRODUTIVA', W / 2, y + 4, { align: 'center' });
  nl(6);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...CINZA_SUBTITULO);
  doc.text('Comprovante Econômico-Financeiro para Crédito Rural', W / 2, y, { align: 'center' });
  nl(4);
  // Linha separadora verde
  doc.setDrawColor(...VERDE_PRIMARIO);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, y, W - MARGIN, y);
  nl(8);

  // ── 1. Dados do Produtor ──────────────────────────────────────────────────
  secTitle('1. IDENTIFICAÇÃO DO PRODUTOR', '👤');
  infoRow('Nome completo:', produtor.nome || 'Não informado');
  infoRow('CPF / CNPJ:', produtor.cpf || 'Não informado');
  infoRow('Telefone:', produtor.telefone || 'Não informado');
  infoRow('Município / Estado:', `${produtor.municipio || '—'} / ${produtor.estado || 'MT'}`);

  // ── 2. Propriedades ───────────────────────────────────────────────────────
  secTitle('2. PROPRIEDADES RURAIS CADASTRADAS', '🏡');
  if (propriedades.length === 0) {
    doc.setFontSize(8); doc.setTextColor(...CINZA_SUBTITULO);
    doc.text('Nenhuma propriedade cadastrada.', MARGIN, y); nl(7);
  } else {
    autoTable(doc, {
      startY: y,
      head: [['Propriedade', 'Lotes Ativos', 'Culturas']],
      body: propriedades.map(p => {
        const ltsProp = lotes.filter(l => l.propriedade_id === p.id && l.status === 'ativo');
        const culturas = [...new Set(ltsProp.map(l => l.cultura_id))].join(', ');
        return [p.nome, ltsProp.length, culturas || '—'];
      }),
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: VERDE_PRIMARIO, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = doc.lastAutoTable.finalY + 5;
  }

  // ── 3. Resumo Financeiro Consolidado ─────────────────────────────────────
  secTitle('3. RESUMO FINANCEIRO — CICLOS CONCLUÍDOS', '💰');
  if (ciclos.length === 0) {
    doc.setFontSize(8); doc.setTextColor(...CINZA_SUBTITULO);
    doc.text('Nenhum ciclo concluído registrado ainda.', MARGIN, y); nl(7);
  } else {
    const totalReceita  = ciclos.reduce((s, c) => s + parseFloat(c.receita_total || 0), 0);
    const totalCustoIns = ciclos.reduce((s, c) => s + parseFloat(c.custo_insumos || 0), 0);
    const totalCustoMO  = ciclos.reduce((s, c) => s + parseFloat(c.custo_mao_obra || 0), 0);
    const totalCusto    = totalCustoIns + totalCustoMO;
    const totalLucro    = totalReceita - totalCusto;
    const margemMedia   = totalReceita > 0 ? (totalLucro / totalReceita) * 100 : 0;
    const totalKg       = ciclos.reduce((s, c) => s + parseFloat(c.total_vendas_kg || 0), 0);

    // 3 caixas de destaque
    const bW = (CONTENT_W - 6) / 3;
    const bY = y;
    const boxes = [
      { label: 'RECEITA BRUTA TOTAL', value: fmtBRL(totalReceita), color: VERDE_PRIMARIO },
      { label: 'LUCRO LÍQUIDO TOTAL', value: fmtBRL(totalLucro),    color: [20, 83, 45] },
      { label: 'MARGEM MÉDIA',        value: `${fmtNum(margemMedia, 1)}%`, color: [21, 128, 61] },
    ];
    boxes.forEach((b, i) => {
      const bx = MARGIN + i * (bW + 3);
      doc.setFillColor(...b.color);
      doc.roundedRect(bx, bY, bW, 18, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
      doc.text(b.label, bx + 4, bY + 6);
      doc.setFontSize(12); doc.setFont('helvetica', 'bold');
      doc.text(b.value, bx + 4, bY + 14);
    });
    y = bY + 23;

    // Mais métricas
    infoRow('Total de ciclos concluídos:', ciclos.length);
    infoRow('Volume total produzido:', `${fmtNum(totalKg, 1)} kg`);
    infoRow('Custo total de insumos:', fmtBRL(totalCustoIns));
    infoRow('Custo total de mão de obra:', fmtBRL(totalCustoMO));
    infoRow('Período de atividade:', (() => {
      const datas = ciclos.map(c => c.data_plantio).filter(Boolean).sort();
      if (!datas.length) return '—';
      return `${fmtDate(datas[0])} a ${fmtDate(ciclos.map(c => c.data_conclusao).filter(Boolean).sort().at(-1))}`;
    })(), true);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PÁGINA 2 — HISTÓRICO DETALHADO DE CICLOS
  // ════════════════════════════════════════════════════════════════════════════
  if (ciclos.length > 0) {
    newPage();
    secTitle('4. HISTÓRICO DETALHADO DE CICLOS PRODUTIVOS', '📋');

    autoTable(doc, {
      startY: y,
      head: [['Cultura', 'Lote', 'Plantio', 'Colheita', 'Dias', 'Volume (kg)', 'Receita', 'Custo', 'Lucro', 'Margem']],
      body: ciclos
        .sort((a, b) => (b.data_conclusao || '').localeCompare(a.data_conclusao || ''))
        .map(c => {
          const receita = parseFloat(c.receita_total || 0);
          const custo   = parseFloat(c.custo_insumos || 0) + parseFloat(c.custo_mao_obra || 0);
          const lucro   = receita - custo;
          const margem  = receita > 0 ? (lucro / receita) * 100 : 0;
          return [
            c.cultura_id,
            c.lote_nome || '—',
            fmtDate(c.data_plantio),
            fmtDate(c.data_conclusao),
            c.dias_ciclo_real || '—',
            fmtNum(parseFloat(c.total_vendas_kg || 0), 1),
            fmtBRL(receita),
            fmtBRL(custo),
            fmtBRL(lucro),
            `${fmtNum(margem, 0)}%`,
          ];
        }),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: VERDE_PRIMARIO, textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: CINZA_TITULO },
        6: { textColor: [22, 163, 74] },
        8: { textColor: [22, 163, 74], fontStyle: 'bold' },
        9: { textColor: [22, 163, 74], fontStyle: 'bold' },
      },
      margin: { left: MARGIN, right: MARGIN },
      didParseCell: (data) => {
        // Destacar margem negativa em vermelho
        if (data.column.index === 8 || data.column.index === 9) {
          const txt = data.cell.raw;
          if (String(txt).startsWith('-')) {
            data.cell.styles.textColor = [220, 38, 38];
          }
        }
      },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PÁGINA 3 — LOTES ATIVOS + CAPACIDADE DE PAGAMENTO
  // ════════════════════════════════════════════════════════════════════════════
  newPage();
  secTitle('5. LOTES ATIVOS ATUALMENTE', '🌱');
  if (lotes.filter(l => l.status === 'ativo').length === 0) {
    doc.setFontSize(8); doc.setTextColor(...CINZA_SUBTITULO);
    doc.text('Nenhum lote ativo no momento.', MARGIN, y); nl(7);
  } else {
    autoTable(doc, {
      startY: y,
      head: [['Cultura', 'Nome', 'Plantio', 'Plantas', 'Área', 'Fase atual']],
      body: lotes
        .filter(l => l.status === 'ativo')
        .map(l => [
          l.cultura_id,
          l.nome,
          fmtDate(l.data_plantio),
          l.total_plantas ? fmtNum(l.total_plantas) : '—',
          l.area_ha ? `${l.area_ha} ha` : (l.comprimento_m ? `${l.comprimento_m}×${l.largura_m} m` : '—'),
          `Dia ${Math.floor((Date.now() - new Date(l.data_plantio + 'T12:00:00')) / 86400000)}`,
        ]),
      styles: { fontSize: 7.5, cellPadding: 2.5 },
      headStyles: { fillColor: VERDE_PRIMARIO, textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // ── Capacidade de Pagamento ────────────────────────────────────────────────
  secTitle('6. ANÁLISE DE CAPACIDADE DE PAGAMENTO', '📊');
  if (ciclos.length >= 2) {
    const totalReceita = ciclos.reduce((s, c) => s + parseFloat(c.receita_total || 0), 0);
    const totalCusto   = ciclos.reduce((s, c) =>
      s + parseFloat(c.custo_insumos || 0) + parseFloat(c.custo_mao_obra || 0), 0);
    const lucroBruto   = totalReceita - totalCusto;

    // Usar período real dos ciclos
    const datasPlantio   = ciclos.map(c => c.data_plantio).filter(Boolean).sort();
    const datasConc      = ciclos.map(c => c.data_conclusao).filter(Boolean).sort();
    const mesesAtividade = datasPlantio.length && datasConc.length
      ? Math.max(1, Math.round(
          (new Date(datasConc.at(-1)) - new Date(datasPlantio[0])) / (30 * 86400000)
        ))
      : ciclos.length * 3; // estimativa conservadora

    const lucroMensal = lucroBruto / mesesAtividade;
    // Recomendação conservadora: 30% da renda mensal para serviço de dívida
    const capacidadeMensalRecomendada = lucroMensal * 0.30;
    const prazoMaximoRecomendado = 60; // meses

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...CINZA_TEXTO);

    const nota = [
      `Com base nos ${ciclos.length} ciclos concluídos registrados no sistema, a atividade agrícola`,
      `gerou receita total de ${fmtBRL(totalReceita)} em aproximadamente ${mesesAtividade} meses, com lucro`,
      `líquido de ${fmtBRL(lucroBruto)} (margem de ${totalReceita > 0 ? fmtNum((lucroBruto / totalReceita) * 100, 1) : 0}%).`,
      '',
      `RENDA MENSAL MÉDIA (estimada): ${fmtBRL(lucroMensal)}/mês`,
      `CAPACIDADE DE SERVIÇO DE DÍVIDA (30% da renda): ${fmtBRL(capacidadeMensalRecomendada)}/mês`,
      `PRAZO MÁXIMO RECOMENDADO: até ${prazoMaximoRecomendado} meses`,
      '',
      'Atenção: Esta análise é baseada em dados históricos do próprio produtor.',
      'A instituição financeira deve realizar análise de crédito conforme normas próprias.',
    ];
    nota.forEach(line => {
      if (line === '') { nl(3); return; }
      const isBold = line.startsWith('RENDA') || line.startsWith('CAPACIDADE') || line.startsWith('PRAZO');
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      doc.setTextColor(isBold ? VERDE_PRIMARIO[0] : CINZA_TEXTO[0],
                      isBold ? VERDE_PRIMARIO[1] : CINZA_TEXTO[1],
                      isBold ? VERDE_PRIMARIO[2] : CINZA_TEXTO[2]);
      doc.text(line, MARGIN, y);
      nl(5);
    });
  } else {
    doc.setFontSize(8); doc.setTextColor(...CINZA_SUBTITULO);
    doc.text('São necessários pelo menos 2 ciclos concluídos para análise de capacidade de pagamento.', MARGIN, y);
    nl(7);
  }

  // ── Declaração / Assinatura ────────────────────────────────────────────────
  nl(6);
  doc.setDrawColor(...CINZA_BORDA);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, W - MARGIN, y);
  nl(5);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...CINZA_TEXTO);
  doc.text(
    'Declaro que as informações acima são verdadeiras e correspondem à minha atividade produtiva.',
    W / 2, y, { align: 'center' }
  );
  nl(12);
  // Linha de assinatura
  const sigY = y;
  doc.line(MARGIN + 10, sigY, MARGIN + CONTENT_W / 2 - 10, sigY);
  nl(4);
  doc.setFontSize(7.5);
  doc.text(`${produtor.nome || 'Produtor Rural'}`, MARGIN + 10, y);
  doc.setTextColor(...CINZA_SUBTITULO);
  doc.text(`CPF: ${produtor.cpf || ''}`, MARGIN + 10, y + 4.5);
  doc.setTextColor(...CINZA_TEXTO);
  // Linha de data
  const dateX = MARGIN + CONTENT_W / 2 + 10;
  doc.line(dateX, sigY, W - MARGIN - 5, sigY);
  nl(4);
  doc.setFontSize(7.5);
  doc.text(`${produtor.municipio || '—'} - MT, ____/____/________`, dateX, y);

  // Rodapé em todas as páginas
  addFooter();

  // ── Salvar ────────────────────────────────────────────────────────────────
  const nomeArquivo = `OryAgro_Credito_${(produtor.nome || 'Produtor').replace(/\s+/g, '_')}_${new Date().getFullYear()}.pdf`;
  doc.save(nomeArquivo);
  return nomeArquivo;
}
