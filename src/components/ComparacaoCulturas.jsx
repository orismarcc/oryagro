import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CULTURAS_LIST } from '../data/culturas';
import { getPrecosPadrao, getOpCosts, OP_COSTS } from '../data/precos';
import { useSimulador } from '../hooks/useSimulador';
import { TrendingUp, TrendingDown, Minus, Pencil, Check, ChevronDown, ChevronUp, FileDown, HelpCircle, X } from 'lucide-react';

// ── Constants ────────────────────────────────────────────────────────────────

const CORREDOR_M   = 0.5;
const AREA_PRESETS = [0.25, 0.5, 1, 2, 5];

// ── Helpers ──────────────────────────────────────────────────────────────────

function calcNCanteirosPorHa(cultura, areaHa = 1) {
  if (cultura.tipo === 'campo') return 1;
  const { comprimento, largura } = cultura.canteiro;
  return Math.max(1, Math.floor((areaHa * 10000) / (comprimento * (largura + CORREDOR_M))));
}

/** Build default values for one canteiro or 1 ha — with realistic MT prices */
function buildDefaults(cultura) {
  const isCampo = cultura.tipo === 'campo';
  const ins = cultura.insumos;
  const op  = getOpCosts(cultura.id, isCampo);

  const base = isCampo
    ? {
        areaHa: 1,
        espacamentoLinhas:  cultura.espacamento.linhas,
        espacamentoPlantas: cultura.espacamento.plantas,
        ...(cultura.venda.producaoKgPorHa != null
          ? { producaoKgPorHa: cultura.venda.producaoKgPorHa } : {}),
      }
    : {
        comprimento:        cultura.canteiro.comprimento,
        largura:            cultura.canteiro.largura,
        espacamentoLinhas:  cultura.canteiro.espacamentoLinhas,
        espacamentoPlantas: cultura.canteiro.espacamentoPlantas,
        ...(cultura.venda.producaoBase != null
          ? { producaoBase: cultura.venda.producaoBase } : {}),
      };

  return {
    ...base,
    calcareo:       ins.calcareo.padrao,
    esterco:        ins.esterco.padrao,
    npk:            ins.npk.padrao,
    ureia:          ins.ureia.padrao,
    nitratoCalcio:  ins.nitratoCalcio.padrao,
    modObra:        ins.modObra.padrao,
    precoVenda:     cultura.venda.precoUnitario,
    sobrevivencia:  cultura.venda.sobrevivencia,
    precoSementes:  ins.sementes.precoUnitario,
    // Preços de insumos — fonte: src/data/precos.js
    ...getPrecosPadrao(isCampo),
    // Custos operacionais — por cultura, fonte: src/data/precos.js
    custoTransporte: op.transporte,
    custoEmbalagem:  op.embalagem,
    custoDefensivos: op.defensivos,
    custoEnergia:    op.energia,
  };
}

function fmtBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL',
    minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}

function fmtBRL2(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL',
    minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

// ── Pure computation (mirrors useSimulador without React hooks) ───────────────
// Used for PDF generation. Accepts valores from buildDefaults + optional overrides.

function fullCalc(cultura, areaHa = 1, overrides = {}) {
  const v   = { ...buildDefaults(cultura), ...overrides };
  const ins = cultura.insumos;
  const isCampo = cultura.tipo === 'campo';
  const nC  = calcNCanteirosPorHa(cultura, areaHa);

  // Plant count
  let totalPlantas, area;
  if (isCampo) {
    const ppha = (v.espacamentoLinhas > 0 && v.espacamentoPlantas > 0)
      ? Math.floor(10000 / (v.espacamentoLinhas * v.espacamentoPlantas)) : 0;
    totalPlantas = Math.round(ppha * (v.areaHa || 1));
  } else {
    const linhas   = v.espacamentoLinhas   > 0 ? Math.floor(v.largura     / v.espacamentoLinhas)   : 0;
    const porLinha = v.espacamentoPlantas  > 0 ? Math.floor(v.comprimento / v.espacamentoPlantas)  : 0;
    totalPlantas   = linhas * porLinha;
    area           = v.comprimento * v.largura;
  }
  const plantasViaveis = Math.round(totalPlantas * v.sobrevivencia / 100);

  // Insumo costs
  const precoSementes = v.precoSementes || ins.sementes.precoUnitario;
  let custoCalcareo, custoEsterco, custoNPK, custoUreia, custoNitratoCa, custoSementes;
  if (isCampo) {
    const ha = v.areaHa || 1;
    custoCalcareo  = ins.calcareo.padrao  * ha * v.precoCalcareo;
    custoEsterco   = ins.esterco.padrao   * ha * v.precoEsterco;
    custoNPK       = ins.npk.padrao       * ha * v.precoNPK;
    custoUreia     = ins.ureia.padrao     * ha * v.precoUreia;
    custoNitratoCa = (ins.nitratoCalcio?.padrao || 0) * ha * v.precoNitratoCa;
    custoSementes  = ins.sementes.padrao  * ha * precoSementes;
  } else {
    custoCalcareo  = ins.calcareo.padrao * v.precoCalcareo;
    custoEsterco   = ins.esterco.padrao  * v.precoEsterco;
    custoNPK       = ins.npk.padrao      * v.precoNPK;
    custoUreia     = (ins.ureia.padrao / 1000) * v.precoUreia;
    custoNitratoCa = ((ins.nitratoCalcio?.padrao || 0) / 1000) * v.precoNitratoCa;
    const fator    = (area || 32) / 32;
    custoSementes  = ins.sementes.padrao * precoSementes * fator;
  }
  const custoMulching = (!isCampo && ins.mulching.multiplicador > 0)
    ? (area || 0) * ins.mulching.multiplicador * (v.precoMulching || 2.00) : 0;

  const custoTotal = custoCalcareo + custoEsterco + custoNPK + custoUreia +
    custoNitratoCa + custoSementes + custoMulching + v.modObra +
    v.custoEmbalagem + v.custoTransporte + v.custoDefensivos + v.custoEnergia;

  // Receita
  let receita, producaoTotal;
  const cv = cultura.venda;
  if (isCampo && (cv.producaoKgPorHa || v.producaoKgPorHa)) {
    const baseKgHa = parseFloat(v.producaoKgPorHa) || cv.producaoKgPorHa || 0;
    producaoTotal  = baseKgHa * (v.areaHa || 1) * (v.sobrevivencia / 100);
    receita        = producaoTotal * v.precoVenda;
  } else if (cv.producaoBase != null || v.producaoBase != null) {
    const base     = parseFloat(v.producaoBase) || cv.producaoBase || 0;
    producaoTotal  = Math.round(base * (v.sobrevivencia / 100));
    receita        = producaoTotal * v.precoVenda;
  } else {
    producaoTotal  = plantasViaveis;
    receita        = plantasViaveis * v.precoVenda;
  }

  const scale      = isCampo ? areaHa : nC;
  const custoHa    = custoTotal * scale;
  const receitaHa  = receita   * scale;
  const lucroHa    = receitaHa - custoHa;
  const margemHa   = receitaHa > 0 ? (lucroHa / receitaHa) * 100 : 0;
  const producaoHa = producaoTotal * scale;
  const producaoUnidade = isCampo && cv.producaoKgPorHa ? 'kg' : cv.unidade;

  return { custoHa, receitaHa, lucroHa, margemHa, producaoHa, producaoUnidade, nC, custoTotal };
}

// ── PDF generator ─────────────────────────────────────────────────────────────

async function generatePDF(sorted, effectiveArea) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc   = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const today = new Date().toLocaleDateString('pt-BR');
  const areaLabel = effectiveArea === 1 ? '1 ha' : `${effectiveArea} ha`;

  // ── Header ──
  doc.setFillColor(45, 106, 79);
  doc.rect(0, 0, 297, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Comparacao de Culturas', 14, 9);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Area: ${areaLabel}  |  Precos medios Mato Grosso 2024/2025  |  Gerado em: ${today}`, 14, 16);

  // ── Info row ──
  doc.setTextColor(80);
  doc.setFontSize(7.5);
  doc.text(
    'Mao de obra: diarista ~R$130/dia  |  Calcario R$0,25/kg  |  Ureia R$3,00/kg  |  NPK R$2,80-3,50/kg  |  Nitrato Ca R$5,00/kg',
    14, 27
  );

  // ── Table ──
  const calcs = sorted.map(c => fullCalc(c, effectiveArea));

  const tableRows = sorted.map((c, i) => {
    const calc = calcs[i];
    const tipo = c.tipo === 'campo' ? 'Campo' : 'Canteiro';
    const canteiroInfo = c.tipo !== 'campo' ? `${calc.nC} ctrs` : '';
    return [
      c.nome,
      c.tipo === 'campo' ? 'Campo' : `Canteiro\n${canteiroInfo}`,
      c.ciclo,
      fmtBRL(calc.custoHa),
      fmtBRL(calc.receitaHa),
      fmtBRL(calc.lucroHa),
      `${calc.margemHa.toFixed(1)}%`,
      `${Math.round(calc.producaoHa).toLocaleString('pt-BR')} ${calc.producaoUnidade}`,
    ];
  });

  autoTable(doc, {
    startY: 32,
    head: [[
      'Cultura', 'Tipo', 'Ciclo',
      `Custo / ${areaLabel}`, `Receita / ${areaLabel}`, `Lucro / ${areaLabel}`,
      'Margem', `Producao / ${areaLabel}`,
    ]],
    body: tableRows,
    styles: {
      fontSize: 8,
      cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
      lineColor: [220, 225, 230],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [45, 106, 79],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    alternateRowStyles: { fillColor: [248, 252, 249] },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 28 },
      1: { cellWidth: 22, halign: 'center', fontSize: 7 },
      2: { cellWidth: 30, fontSize: 7 },
      3: { halign: 'right', cellWidth: 28 },
      4: { halign: 'right', cellWidth: 28 },
      5: { halign: 'right', cellWidth: 28 },
      6: { halign: 'center', cellWidth: 18 },
      7: { halign: 'right' },
    },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 5) {
        const calc = calcs[data.row.index];
        if (calc) {
          data.cell.styles.textColor = calc.lucroHa >= 0 ? [5, 150, 105] : [220, 38, 38];
          data.cell.styles.fontStyle = 'bold';
        }
      }
      if (data.section === 'body' && data.column.index === 6) {
        const calc = calcs[data.row.index];
        if (calc) {
          data.cell.styles.textColor = calc.margemHa >= 30 ? [5, 150, 105] : calc.margemHa >= 0 ? [180, 90, 10] : [220, 38, 38];
        }
      }
    },
  });

  // ── Footer ──
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(6.5);
    doc.setTextColor(160);
    doc.text(
      `GranjaTop / OryAgro  -  Pagina ${p}/${totalPages}  -  Valores estimados com base em medias de MT. Verifique com fornecedores locais.`,
      14,
      doc.internal.pageSize.height - 6
    );
  }

  doc.save(`comparacao-culturas-${areaLabel.replace(' ', '')}-${today.replace(/\//g, '-')}.pdf`);
}

// ── EditField ─────────────────────────────────────────────────────────────────

function EditField({ label, value, onChange, prefix, suffix }) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{label}</label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground pointer-events-none">
            {prefix}
          </span>
        )}
        <input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
          className={`w-full rounded-xl border text-[12px] font-semibold py-2 outline-none focus:ring-1 ${prefix ? 'pl-7' : 'pl-3'} ${suffix ? 'pr-7' : 'pr-3'}`}
          style={{
            background: 'hsl(140 14% 96%)',
            borderColor: 'hsl(140 13% 87%)',
          }}
        />
        {suffix && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

// ── SectionLabel ──────────────────────────────────────────────────────────────

function SectionLabel({ children, color }) {
  return (
    <div className="col-span-2 mt-1.5 mb-0.5">
      <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: color || 'hsl(150 8% 50%)' }}>
        {children}
      </p>
    </div>
  );
}

// ── CostBreakdown (inside edit panel) ─────────────────────────────────────────

function CostBreakdown({ composicao, custoTotal, cor }) {
  return (
    <div className="col-span-2 rounded-xl p-3 mb-1" style={{ background: 'hsl(140 14% 97%)' }}>
      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
        Composição do custo ({fmtBRL(custoTotal)})
      </p>
      <div className="space-y-1.5">
        {composicao.map(item => {
          const pct = custoTotal > 0 ? (item.value / custoTotal) * 100 : 0;
          return (
            <div key={item.name} className="flex items-center gap-2">
              <div className="w-[6px] h-[6px] rounded-full flex-shrink-0" style={{ background: item.fill }} />
              <span className="text-[10px] text-muted-foreground flex-1 min-w-0 truncate">{item.name}</span>
              <span className="text-[10px] font-semibold text-foreground whitespace-nowrap">{fmtBRL2(item.value)}</span>
              <span className="text-[9px] text-muted-foreground w-[32px] text-right">{pct.toFixed(0)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── ModalInstrucoes ───────────────────────────────────────────────────────────
// Auto-generated from CULTURAS_LIST — adding a new culture automatically appears here

function producaoDesc(c) {
  const v = c.venda;
  if (c.tipo === 'campo' && v.producaoKgPorHa) {
    return `${v.producaoKgPorHa.toLocaleString('pt-BR')} kg/ha × sobrevivência ${v.sobrevivencia}%`;
  }
  if (v.producaoBase != null) {
    const motivo = v.producaoMacosPorPlanta
      ? `${Math.floor(c.canteiro.largura / c.canteiro.espacamentoLinhas) * Math.floor(c.canteiro.comprimento / c.canteiro.espacamentoPlantas)} plantas × ${v.producaoMacosPorPlanta} maços/planta`
      : v.producaoKgPorM2
      ? `${c.canteiro.comprimento * c.canteiro.largura} m² × ${v.producaoKgPorM2} kg/m²`
      : v.producaoKgPorCorte != null
      ? `${v.producaoKgPorCorte} kg/corte × ${v.macosPorKg} maços/kg`
      : `valor de referência`;
    return `${v.producaoBase} ${v.unidade}/canteiro (${motivo}) × sobreviv. ${v.sobrevivencia}%`;
  }
  // plant-count based
  const linhas   = Math.floor(c.canteiro.largura    / c.canteiro.espacamentoLinhas);
  const porLinha = Math.floor(c.canteiro.comprimento / c.canteiro.espacamentoPlantas);
  return `${linhas} linhas × ${porLinha} plantas = ${linhas * porLinha} plantas × sobreviv. ${v.sobrevivencia}%`;
}

function ModalInstrucoes({ onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        className="mt-auto rounded-t-3xl overflow-y-auto"
        style={{ background: 'hsl(0 0% 100%)', maxHeight: '92vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted" />
        </div>

        {/* Header */}
        <div className="px-5 pt-2 pb-4 flex items-center justify-between sticky top-0 bg-white z-10 border-b" style={{ borderColor: 'hsl(140 13% 92%)' }}>
          <div>
            <h2 className="font-display text-[17px] font-extrabold text-foreground">Como os cálculos funcionam</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Metodologia e referências — Mato Grosso 2024/25</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground"
            style={{ background: 'hsl(140 14% 95%)' }}
          >
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-6 pb-10">

          {/* ── Base de cálculo ── */}
          <section>
            <h3 className="section-label mb-2">Base de comparação</h3>
            <div className="rounded-2xl p-4 space-y-2.5 text-[12px] text-foreground leading-relaxed" style={{ background: 'hsl(152 40% 97%)' }}>
              <p>Todas as métricas são normalizadas para a <strong>área selecionada</strong> (padrão: 1 ha).</p>
              <p><strong>Canteiro padrão:</strong> 20 × 1,6 m = 32 m² por canteiro.</p>
              <p><strong>Canteiros por ha:</strong> <code className="text-[11px] bg-white px-1.5 py-0.5 rounded">floor(10.000 / (comprimento × (largura + 0,5 m corredor)))</code></p>
              <p>O corredor de <strong>50 cm</strong> entre canteiros é descontado para simular uma horta real com passagens de trabalho.</p>
            </div>
          </section>

          {/* ── Produção por cultura ── */}
          <section>
            <h3 className="section-label mb-2">Como a produção de cada cultura é estimada</h3>
            <div className="space-y-2">
              {CULTURAS_LIST.map(c => (
                <div key={c.id} className="rounded-xl p-3" style={{ background: `${c.cor}08`, border: `1px solid ${c.cor}20` }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base leading-none">{c.emoji}</span>
                    <span className="text-[12px] font-bold text-foreground">{c.nome}</span>
                    <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full ml-auto"
                      style={{ background: c.tipo === 'campo' ? 'hsl(38 90% 93%)' : 'hsl(152 60% 93%)',
                               color:      c.tipo === 'campo' ? 'hsl(38 70% 32%)' : 'hsl(152 70% 25%)' }}>
                      {c.tipo}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{producaoDesc(c)}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Preços de insumos ── */}
          <section>
            <h3 className="section-label mb-2">Preços de insumos — médias MT</h3>
            <div className="rounded-2xl overflow-hidden border" style={{ borderColor: 'hsl(140 13% 90%)' }}>
              {[
                ['Calcário dolomítico', 'R$ 0,25/kg', 'R$ 200–300/t a granel'],
                ['Esterco (canteiro)', 'R$ 0,20/kg', 'Curtido/compostado R$200/t'],
                ['Esterco (campo)', 'R$ 0,08/kg', 'Granel bovino R$80/t'],
                ['NPK formulado (canteiro)', 'R$ 3,50/kg', 'Saco 25 kg varejo'],
                ['NPK formulado (campo)', 'R$ 2,80/kg', 'Compra a granel/safra'],
                ['Ureia 46%', 'R$ 3,00/kg', 'R$ 2.500–3.200/t MT'],
                ['Nitrato de Cálcio', 'R$ 5,00/kg', 'R$ 4.000–6.000/t'],
                ['Mulching plástico', 'R$ 2,00/m²', 'Rolo 30 µm'],
              ].map(([insumo, preco, obs], i) => (
                <div key={insumo} className="flex items-center px-3 py-2.5 gap-2" style={{ background: i % 2 === 0 ? 'white' : 'hsl(140 14% 98%)' }}>
                  <span className="text-[11px] text-foreground flex-1">{insumo}</span>
                  <span className="text-[11px] font-bold text-foreground whitespace-nowrap">{preco}</span>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap hidden sm:block">{obs}</span>
                </div>
              ))}
            </div>
          </section>

          {/* ── Custos operacionais ── */}
          <section>
            <h3 className="section-label mb-2">Custos operacionais</h3>
            <div className="space-y-3 text-[12px] leading-relaxed text-foreground">
              <div className="rounded-xl p-3.5" style={{ background: 'hsl(140 14% 97%)' }}>
                <p className="font-bold mb-1">Mão de obra</p>
                <p className="text-muted-foreground">Estimativa de diárias totais no ciclo completo × R$130/dia (média diarista MT 2024). Inclui preparo do solo, plantio/transplante, capinas, adubações de cobertura e colheita. Campo inclui meses de colheita contínua (quiabo) ou manutenção perene (acerola, banana).</p>
              </div>
              <div className="rounded-xl p-3.5" style={{ background: 'hsl(140 14% 97%)' }}>
                <p className="font-bold mb-1">Transporte</p>
                <p className="text-muted-foreground">Frete médio para levar a produção ao ponto de venda (feira, CEASA, intermediário). Para canteiros: fração de um frete compartilhado (R$6–12/canteiro/ciclo). Para campo: cargas completas ao longo do ciclo (R$500–1.200/ha).</p>
              </div>
              <div className="rounded-xl p-3.5" style={{ background: 'hsl(140 14% 97%)' }}>
                <p className="font-bold mb-1">Embalagem</p>
                <p className="text-muted-foreground">Sacolas, caixas plásticas, bandejas ou big bags conforme a cultura. Para alface: ~100 sacos por canteiro. Para quiabo/mandioca: caixas de 20 kg reutilizáveis amortizadas por ciclo.</p>
              </div>
              <div className="rounded-xl p-3.5" style={{ background: 'hsl(140 14% 97%)' }}>
                <p className="font-bold mb-1">Defensivos</p>
                <p className="text-muted-foreground">Fungicidas, inseticidas e/ou herbicidas no ciclo. Canteiros de folhosas usam principalmente produtos biológicos (R$8–20). Campo utiliza herbicidas pré/pós emergência e inseticidas conforme necessidade (R$300–1.500/ha dependendo da cultura e pressão de pragas).</p>
              </div>
              <div className="rounded-xl p-3.5" style={{ background: 'hsl(140 14% 97%)' }}>
                <p className="font-bold mb-1">Energia / Irrigação</p>
                <p className="text-muted-foreground">Custo de energia elétrica para bomba de irrigação (micro-aspersão, gotejamento ou aspersão). Para canteiros: R$10–18/ciclo (bomba de 0,5–1 CV em tempo parcial). Para campo: R$150–500/ha dependendo do sistema e duração do ciclo.</p>
              </div>
            </div>
          </section>

          {/* ── Sobrevivência ── */}
          <section>
            <h3 className="section-label mb-2">Sobrevivência / Eficiência de produção</h3>
            <div className="rounded-2xl p-4 text-[12px] leading-relaxed" style={{ background: 'hsl(38 90% 97%)' }}>
              <p>Percentual da produção total estimada que efetivamente chega à venda. Engloba perdas por pragas, clima, descarte pós-colheita e problemas de qualidade.</p>
              <p className="mt-2">Para culturas de campo com <code className="text-[11px] bg-white px-1 rounded">producaoKgPorHa</code>, a sobrevivência funciona como fator de eficiência: <code className="text-[11px] bg-white px-1 rounded">receita = producaoBase × sobrevivência% × preçoVenda</code>.</p>
            </div>
          </section>

          {/* ── Aviso ── */}
          <p className="text-[10px] text-muted-foreground text-center pb-2">
            Valores são estimativas baseadas em médias regionais de Mato Grosso (2024/25). Consulte fornecedores locais para preços atualizados. Todos os campos são editáveis no painel ✏️ de cada cultura.
          </p>

        </div>
      </motion.div>
    </motion.div>
  );
}

// ── CulturaRow ────────────────────────────────────────────────────────────────

function CulturaRow({ cultura, rank, areaHa }) {
  const isCampo      = cultura.tipo === 'campo';
  const nCanteiros   = calcNCanteirosPorHa(cultura, areaHa);
  const [editOpen, setEditOpen]   = useState(false);
  const [overrides, setOverrides] = useState({});
  const [showInsumos, setShowInsumos] = useState(false);

  const set = (campo, val) => setOverrides(o => ({ ...o, [campo]: val }));

  const valores  = { ...buildDefaults(cultura), ...overrides };
  const r        = useSimulador(cultura, valores);

  // ── Scale to selected area ──
  const scale      = isCampo ? areaHa : nCanteiros;
  const custoHa    = r.custoTotal * scale;
  const receitaHa  = r.receita   * scale;
  const lucroHa    = receitaHa - custoHa;
  const margemHa   = receitaHa > 0 ? (lucroHa / receitaHa) * 100 : 0;

  const producaoHa = (r.producaoTotal ?? r.plantasViaveis ?? 0) * scale;
  const producaoUnidade = isCampo && cultura.venda.producaoKgPorHa ? 'kg' : cultura.venda.unidade;

  const isPositive   = lucroHa >= 0;
  const margemColor  = margemHa >= 50 ? '#059669' : margemHa >= 20 ? '#d97706' : '#dc2626';
  const MargemIcon   = margemHa >= 20 ? TrendingUp : margemHa >= 0 ? Minus : TrendingDown;

  const hasProducaoBase = cultura.venda.producaoBase != null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.04, duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="card overflow-hidden"
      style={{ borderLeft: `3px solid ${cultura.cor}` }}
    >
      {/* ── Header ── */}
      <div className="p-4 pb-3">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
            style={{ background: `${cultura.cor}15` }}
          >
            {cultura.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-display text-[15px] font-bold text-foreground">{cultura.nome}</span>
              <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full"
                style={{ background: isCampo ? 'hsl(38 90% 93%)' : 'hsl(152 60% 93%)',
                         color:      isCampo ? 'hsl(38 70% 32%)' : 'hsl(152 70% 25%)' }}>
                {isCampo ? 'campo' : 'canteiro'}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-[11px] text-muted-foreground">{cultura.ciclo}</span>
              {!isCampo && (
                <span className="text-[10px] font-semibold text-muted-foreground">
                  · {nCanteiros} canteiros/{areaHa} ha
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold"
              style={{ background: `${margemColor}15`, color: margemColor }}
            >
              <MargemIcon size={11} />
              {margemHa.toFixed(1)}%
            </div>
            <button
              onClick={() => setEditOpen(o => !o)}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
              style={editOpen
                ? { background: cultura.cor, color: '#fff' }
                : { background: `${cultura.cor}15`, color: cultura.cor }}
              title="Editar métricas"
            >
              {editOpen ? <Check size={13} /> : <Pencil size={13} />}
            </button>
          </div>
        </div>

        {/* ── Metrics ── */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div className="rounded-xl p-3 text-center" style={{ background: 'hsl(140 14% 97%)' }}>
            <p className="section-label mb-0.5">Custo / {areaHa} ha</p>
            <p className="text-[12px] font-bold text-foreground">{fmtBRL(custoHa)}</p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: 'hsl(140 14% 97%)' }}>
            <p className="section-label mb-0.5">Receita / {areaHa} ha</p>
            <p className="text-[12px] font-bold text-foreground">{fmtBRL(receitaHa)}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div
            className="rounded-xl p-3 text-center"
            style={{ background: isPositive ? 'hsl(152 69% 95%)' : 'hsl(4 80% 96%)' }}
          >
            <p className="section-label mb-0.5">Lucro / {areaHa} ha</p>
            <p className="text-[12px] font-bold" style={{ color: isPositive ? '#059669' : '#dc2626' }}>
              {fmtBRL(lucroHa)}
            </p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: `${cultura.cor}0d` }}>
            <p className="section-label mb-0.5">Produção / {areaHa} ha</p>
            <p className="text-[12px] font-bold" style={{ color: cultura.cor }}>
              {producaoHa >= 1000
                ? `${(producaoHa / 1000).toFixed(1)} k`
                : Math.round(producaoHa).toLocaleString('pt-BR')}{' '}
              <span className="text-[10px] font-semibold opacity-70">{producaoUnidade}</span>
            </p>
          </div>
        </div>

        {/* ── Margin bar ── */}
        <div className="mt-2.5">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${margemColor}70, ${margemColor})` }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(Math.max(margemHa, 0), 100)}%` }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: rank * 0.04 }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-muted-foreground">
              sobreviv. {valores.sobrevivencia}% · {Math.round(producaoHa).toLocaleString('pt-BR')} {producaoUnidade}/{areaHa} ha
            </span>
            <span className="text-[9px] text-muted-foreground">
              {!isCampo && `${nCanteiros} ctrs · `}
              custo unit. {fmtBRL2(r.custoTotal)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Edit Panel ── */}
      <AnimatePresence>
        {editOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div
              className="px-4 pt-3 pb-4 grid grid-cols-2 gap-3"
              style={{ borderTop: `1px solid ${cultura.cor}20`, background: `${cultura.cor}05` }}
            >
              {/* ── Cost breakdown ── */}
              <CostBreakdown composicao={r.composicaoCustos} custoTotal={r.custoTotal} cor={cultura.cor} />

              {/* ── Receita ── */}
              <SectionLabel color={cultura.cor}>Receita e produção</SectionLabel>
              <EditField
                label={`Preço / ${cultura.venda.unidade}`}
                value={valores.precoVenda}
                onChange={v => set('precoVenda', v)}
                prefix="R$"
              />
              <EditField
                label="Sobrevivência"
                value={valores.sobrevivencia}
                onChange={v => set('sobrevivencia', v)}
                suffix="%"
              />
              {isCampo && cultura.venda.producaoKgPorHa != null && (
                <EditField
                  label="Produção base (kg/ha)"
                  value={valores.producaoKgPorHa ?? cultura.venda.producaoKgPorHa}
                  onChange={v => set('producaoKgPorHa', v)}
                  suffix="kg"
                />
              )}
              {hasProducaoBase && (
                <EditField
                  label={`Produção base (${cultura.venda.unidade}/ctro)`}
                  value={valores.producaoBase ?? cultura.venda.producaoBase}
                  onChange={v => set('producaoBase', v)}
                  suffix="ud"
                />
              )}

              {/* ── Preços de insumos ── */}
              <SectionLabel color={cultura.cor}>Preço dos insumos (R$/kg)</SectionLabel>
              <EditField
                label="Calcário (R$/kg)"
                value={valores.precoCalcareo}
                onChange={v => set('precoCalcareo', v)}
                prefix="R$"
              />
              <EditField
                label="Esterco (R$/kg)"
                value={valores.precoEsterco}
                onChange={v => set('precoEsterco', v)}
                prefix="R$"
              />
              <EditField
                label="NPK (R$/kg)"
                value={valores.precoNPK}
                onChange={v => set('precoNPK', v)}
                prefix="R$"
              />
              <EditField
                label="Ureia (R$/kg)"
                value={valores.precoUreia}
                onChange={v => set('precoUreia', v)}
                prefix="R$"
              />
              <EditField
                label="Nitrato Ca (R$/kg)"
                value={valores.precoNitratoCa}
                onChange={v => set('precoNitratoCa', v)}
                prefix="R$"
              />
              <EditField
                label={`Semente/muda (R$/${cultura.insumos.sementes.unidade.split('/')[0]})`}
                value={valores.precoSementes}
                onChange={v => set('precoSementes', v)}
                prefix="R$"
              />

              {/* ── Custos operacionais ── */}
              <SectionLabel color={cultura.cor}>Custos operacionais</SectionLabel>
              <EditField
                label={`Mão de obra${isCampo ? ' / ha' : ' / ciclo'}`}
                value={valores.modObra}
                onChange={v => set('modObra', v)}
                prefix="R$"
              />
              <EditField
                label={`Transporte${isCampo ? ' / ha' : ' / ciclo'}`}
                value={valores.custoTransporte}
                onChange={v => set('custoTransporte', v)}
                prefix="R$"
              />
              <EditField
                label={`Embalagem${isCampo ? ' / ha' : ' / ciclo'}`}
                value={valores.custoEmbalagem}
                onChange={v => set('custoEmbalagem', v)}
                prefix="R$"
              />
              <EditField
                label={`Defensivos${isCampo ? ' / ha' : ' / ciclo'}`}
                value={valores.custoDefensivos}
                onChange={v => set('custoDefensivos', v)}
                prefix="R$"
              />
              <EditField
                label={`Energia / irrigação${isCampo ? ' / ha' : ''}`}
                value={valores.custoEnergia}
                onChange={v => set('custoEnergia', v)}
                prefix="R$"
              />

              <button
                onClick={() => setOverrides({})}
                className="col-span-2 text-[11px] font-semibold text-muted-foreground py-1.5 rounded-xl transition-colors hover:text-foreground mt-1"
                style={{ background: 'hsl(140 14% 94%)' }}
              >
                Restaurar padrões
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ComparacaoCulturas() {
  const [sortBy,    setSortBy]    = useState('lucro');
  const [areaHa,    setAreaHa]    = useState(1);
  const [customArea, setCustomArea] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [showInstrucoes, setShowInstrucoes] = useState(false);

  const effectiveArea = useCustom && parseFloat(customArea) > 0
    ? parseFloat(customArea)
    : areaHa;

  const handlePreset = (v) => {
    setAreaHa(v);
    setUseCustom(false);
    setCustomArea('');
  };

  const handleCustomChange = (e) => {
    setCustomArea(e.target.value);
    setUseCustom(true);
  };

  const sorted = [...CULTURAS_LIST].sort((a, b) => {
    const getVal = (c) => {
      const r = staticCalc(c);
      if (sortBy === 'margem')  return r.margemHa;
      if (sortBy === 'receita') return r.receitaHa;
      return r.lucroHa;
    };
    return getVal(b) - getVal(a);
  });

  const handleDownloadPDF = async () => {
    setPdfLoading(true);
    try {
      await generatePDF(sorted, effectiveArea);
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <div className="gradient-hero px-5 pb-5" style={{ paddingTop: 'var(--hero-pad-top)' }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-white/55 text-xs font-semibold uppercase tracking-widest mb-1">Análise</p>
            <h1 className="font-display text-white text-2xl font-extrabold leading-tight">Comparar Culturas</h1>
            <p className="text-white/50 text-[11px] mt-1">
              Preços médios MT · corredor {CORREDOR_M * 100} cm · base {effectiveArea} ha
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 mt-1">
            <button
              onClick={() => setShowInstrucoes(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold transition-all active:scale-95"
              style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
              title="Ver instruções e metodologia"
            >
              <HelpCircle size={14} />
              Instruções
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={pdfLoading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold transition-all active:scale-95 disabled:opacity-60"
              style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)' }}
              title="Baixar comparação em PDF"
            >
              <FileDown size={14} />
              {pdfLoading ? 'Gerando…' : 'PDF'}
            </button>
          </div>
        </div>

        {/* Sort pills */}
        <div className="flex gap-2 mt-3 flex-wrap">
          {[
            { key: 'lucro',   label: 'Maior Lucro' },
            { key: 'margem',  label: 'Maior Margem' },
            { key: 'receita', label: 'Maior Receita' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className="text-[11px] font-bold px-3 py-1.5 rounded-full transition-all"
              style={sortBy === key
                ? { background: 'rgba(255,255,255,0.25)', color: '#fff' }
                : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)' }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Area selector */}
        <div className="mt-3">
          <p className="text-white/50 text-[10px] font-semibold uppercase tracking-widest mb-1.5">Área de comparação</p>
          <div className="flex gap-1.5 flex-wrap items-center">
            {AREA_PRESETS.map(v => (
              <button
                key={v}
                onClick={() => handlePreset(v)}
                className="text-[11px] font-bold px-2.5 py-1 rounded-full transition-all"
                style={!useCustom && areaHa === v
                  ? { background: 'rgba(255,255,255,0.28)', color: '#fff', boxShadow: '0 0 0 1.5px rgba(255,255,255,0.5)' }
                  : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)' }}
              >
                {v} ha
              </button>
            ))}
            <div className="relative flex items-center">
              <input
                type="number"
                min="0.01"
                step="0.1"
                placeholder="outro"
                value={customArea}
                onChange={handleCustomChange}
                className="text-[11px] font-bold w-[68px] rounded-full py-1 px-2.5 outline-none text-white placeholder-white/40"
                style={{
                  background: useCustom && parseFloat(customArea) > 0
                    ? 'rgba(255,255,255,0.28)'
                    : 'rgba(255,255,255,0.08)',
                  border: useCustom && parseFloat(customArea) > 0
                    ? '1.5px solid rgba(255,255,255,0.5)'
                    : '1.5px solid transparent',
                }}
              />
              {useCustom && parseFloat(customArea) > 0 && (
                <span className="absolute right-2.5 text-[9px] text-white/60 pointer-events-none">ha</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 pb-4 space-y-3 max-w-2xl mx-auto">
        <p className="text-[10px] text-muted-foreground px-1 mb-1">
          Custos baseados em médias de MT. Toque em ✏️ para ajustar e ver a composição detalhada.
        </p>
        {sorted.map((c, i) => (
          <CulturaRow key={c.id} cultura={c} rank={i} areaHa={effectiveArea} />
        ))}
      </div>

      <AnimatePresence>
        {showInstrucoes && <ModalInstrucoes onClose={() => setShowInstrucoes(false)} />}
      </AnimatePresence>
    </div>
  );
}

// ── Static sort helper — mirrors buildDefaults + useSimulador logic ──────────

function staticCalc(cultura) {
  const isCampo   = cultura.tipo === 'campo';
  const ins       = cultura.insumos;
  const nC        = calcNCanteirosPorHa(cultura);
  const op        = getOpCosts(cultura.id, isCampo);
  const pp        = getPrecosPadrao(isCampo);
  const r         = { custoTotal: 0, receita: 0 };

  const modObra   = ins.modObra.padrao;
  const precoV    = cultura.venda.precoUnitario;
  const sobreviv  = cultura.venda.sobrevivencia;

  const custoInsumos = ins.calcareo.padrao * pp.precoCalcareo +
    ins.esterco.padrao * pp.precoEsterco +
    ins.npk.padrao * pp.precoNPK +
    (isCampo ? ins.ureia.padrao : ins.ureia.padrao / 1000) * pp.precoUreia +
    (isCampo ? (ins.nitratoCalcio?.padrao || 0) : ((ins.nitratoCalcio?.padrao || 0) / 1000)) * pp.precoNitratoCa +
    ins.sementes.padrao * ins.sementes.precoUnitario;

  const custoMulching = (!isCampo && ins.mulching.multiplicador > 0)
    ? (cultura.canteiro.comprimento * cultura.canteiro.largura) * ins.mulching.multiplicador * pp.precoMulching
    : 0;

  const custoTransporte = op.transporte;
  const custoEmbalagem  = op.embalagem;
  const custoDefensivos = op.defensivos;
  const custoEnergia    = op.energia;

  r.custoTotal = custoInsumos + custoMulching + modObra +
    custoTransporte + custoEmbalagem + custoDefensivos + custoEnergia;

  // Receita
  if (isCampo && cultura.venda.producaoKgPorHa) {
    r.receita = cultura.venda.producaoKgPorHa * (sobreviv / 100) * precoV;
  } else if (cultura.venda.producaoBase != null) {
    r.receita = cultura.venda.producaoBase * (sobreviv / 100) * precoV;
  } else {
    const dim = isCampo
      ? Math.floor(10000 / (cultura.espacamento.linhas * cultura.espacamento.plantas))
      : Math.floor(cultura.canteiro.largura / cultura.canteiro.espacamentoLinhas) *
        Math.floor(cultura.canteiro.comprimento / cultura.canteiro.espacamentoPlantas);
    r.receita = dim * (sobreviv / 100) * precoV;
  }

  const scale      = isCampo ? 1 : nC;
  r.lucroHa        = (r.receita - r.custoTotal) * scale;
  r.receitaHa      = r.receita * scale;
  r.margemHa       = r.receitaHa > 0 ? ((r.receitaHa - r.custoTotal * scale) / r.receitaHa) * 100 : 0;
  return r;
}
