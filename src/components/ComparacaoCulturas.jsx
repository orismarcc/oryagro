import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CULTURAS_LIST } from '../data/culturas';
import { useSimulador } from '../hooks/useSimulador';
import { TrendingUp, TrendingDown, Minus, Pencil, Check, ChevronDown, ChevronUp } from 'lucide-react';

// ── Constants ────────────────────────────────────────────────────────────────

const CORREDOR_M   = 0.5;
const AREA_PRESETS = [0.25, 0.5, 1, 2, 5];

// ── Per-culture operational costs (MT averages, 2024-2025) ──────────────────
// Canteiro: per canteiro (20×1.6m) per ciclo
// Campo: per ha per ciclo completo
const OP_COSTS = {
  // canteiro
  alface:    { transporte: 8,    embalagem: 12,  defensivos: 15,   energia: 15 },
  cebolinha: { transporte: 6,    embalagem: 10,  defensivos: 8,    energia: 12 },
  coentro:   { transporte: 6,    embalagem: 10,  defensivos: 8,    energia: 10 },
  rucula:    { transporte: 6,    embalagem: 10,  defensivos: 8,    energia: 10 },
  couve:     { transporte: 12,   embalagem: 15,  defensivos: 20,   energia: 18 },
  // campo
  quiabo:    { transporte: 600,  embalagem: 400, defensivos: 800,  energia: 400 },
  mandioca:  { transporte: 500,  embalagem: 150, defensivos: 300,  energia: 150 },
  abacaxi:   { transporte: 1200, embalagem: 800, defensivos: 1500, energia: 500 },
  acerola:   { transporte: 800,  embalagem: 500, defensivos: 600,  energia: 400 },
  banana_ana:{ transporte: 800,  embalagem: 400, defensivos: 700,  energia: 500 },
};

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
  const op  = OP_COSTS[cultura.id] || {};

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
    // ── Preços de insumos — médias MT 2024/2025 ──
    precoCalcareo:  0.25,                     // Calcário dolomítico: R$200-300/t
    precoEsterco:   isCampo ? 0.08 : 0.20,    // Granel R$80/t; Curtido canteiro R$200/t
    precoNPK:       isCampo ? 2.80 : 3.50,    // Formulados bulk vs saco
    precoUreia:     3.00,                     // Ureia 46%: R$2.500-3.200/t
    precoNitratoCa: 5.00,                     // Nitrato Ca: R$4.000-6.000/t
    precoMulching:  2.00,                     // Mulching plástico: R$1.80-2.50/m²
    // ── Custos operacionais — per cultura, médias MT ──
    custoTransporte: op.transporte ?? (isCampo ? 500 : 8),
    custoEmbalagem:  op.embalagem  ?? (isCampo ? 300 : 12),
    custoDefensivos: op.defensivos ?? (isCampo ? 500 : 15),
    custoEnergia:    op.energia    ?? (isCampo ? 300 : 12),
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
            background: 'hsl(210 16% 96%)',
            borderColor: 'hsl(214 20% 87%)',
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
      <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: color || 'hsl(215 16% 50%)' }}>
        {children}
      </p>
    </div>
  );
}

// ── CostBreakdown (inside edit panel) ─────────────────────────────────────────

function CostBreakdown({ composicao, custoTotal, cor }) {
  return (
    <div className="col-span-2 rounded-xl p-3 mb-1" style={{ background: 'hsl(210 16% 97%)' }}>
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
          <div className="rounded-xl p-3 text-center" style={{ background: 'hsl(210 16% 97%)' }}>
            <p className="section-label mb-0.5">Custo / {areaHa} ha</p>
            <p className="text-[12px] font-bold text-foreground">{fmtBRL(custoHa)}</p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: 'hsl(210 16% 97%)' }}>
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
                style={{ background: 'hsl(210 16% 94%)' }}
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

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <div className="gradient-hero px-5 pt-6 pb-5">
        <p className="text-white/55 text-xs font-semibold uppercase tracking-widest mb-1">Análise</p>
        <h1 className="font-display text-white text-2xl font-extrabold leading-tight">Comparar Culturas</h1>
        <p className="text-white/50 text-[11px] mt-1">
          Preços médios MT · corredor {CORREDOR_M * 100} cm · base {effectiveArea} ha
        </p>

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
    </div>
  );
}

// ── Static sort helper — mirrors buildDefaults + useSimulador logic ──────────

function staticCalc(cultura) {
  const isCampo   = cultura.tipo === 'campo';
  const ins       = cultura.insumos;
  const nC        = calcNCanteirosPorHa(cultura);
  const op        = OP_COSTS[cultura.id] || {};
  const r         = { custoTotal: 0, receita: 0 };

  const modObra   = ins.modObra.padrao;
  const precoV    = cultura.venda.precoUnitario;
  const sobreviv  = cultura.venda.sobrevivencia;

  // Insumo costs with MT prices
  const precoCalcareo  = 0.25;
  const precoEsterco   = isCampo ? 0.08 : 0.20;
  const precoNPK       = isCampo ? 2.80 : 3.50;
  const precoUreia     = 3.00;
  const precoNitratoCa = 5.00;

  const custoInsumos = ins.calcareo.padrao * precoCalcareo +
    ins.esterco.padrao * precoEsterco +
    ins.npk.padrao * precoNPK +
    (isCampo ? ins.ureia.padrao : ins.ureia.padrao / 1000) * precoUreia +
    (isCampo ? (ins.nitratoCalcio?.padrao || 0) : ((ins.nitratoCalcio?.padrao || 0) / 1000)) * precoNitratoCa +
    ins.sementes.padrao * ins.sementes.precoUnitario;

  const custoMulching = (!isCampo && ins.mulching.multiplicador > 0)
    ? (cultura.canteiro.comprimento * cultura.canteiro.largura) * ins.mulching.multiplicador * 2.00
    : 0;

  const custoTransporte = op.transporte ?? (isCampo ? 500 : 8);
  const custoEmbalagem  = op.embalagem  ?? (isCampo ? 300 : 12);
  const custoDefensivos = op.defensivos ?? (isCampo ? 500 : 15);
  const custoEnergia    = op.energia    ?? (isCampo ? 300 : 12);

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
