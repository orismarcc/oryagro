import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CULTURAS_LIST } from '../data/culturas';
import { useSimulador } from '../hooks/useSimulador';
import { TrendingUp, TrendingDown, Minus, Pencil, Check, ChevronDown } from 'lucide-react';

// ── Constants ────────────────────────────────────────────────────────────────

const CORREDOR_M   = 0.5; // passagem padrão entre canteiros (m)
const AREA_PRESETS = [0.25, 0.5, 1, 2, 5]; // ha presets

// ── Helpers ──────────────────────────────────────────────────────────────────

/** How many standard canteiros fit in the given area (ha), accounting for walkway corridors */
function calcNCanteirosPorHa(cultura, areaHa = 1) {
  if (cultura.tipo === 'campo') return 1;
  const { comprimento, largura } = cultura.canteiro;
  return Math.max(1, Math.floor((areaHa * 10000) / (comprimento * (largura + CORREDOR_M))));
}

/** Insumo defaults for one canteiro / 1 ha */
function buildDefaults(cultura) {
  const isCampo = cultura.tipo === 'campo';
  const ins = cultura.insumos;
  const base = isCampo
    ? {
        areaHa: AREA_HA,
        espacamentoLinhas:  cultura.espacamento.linhas,
        espacamentoPlantas: cultura.espacamento.plantas,
      }
    : {
        comprimento:        cultura.canteiro.comprimento,
        largura:            cultura.canteiro.largura,
        espacamentoLinhas:  cultura.canteiro.espacamentoLinhas,
        espacamentoPlantas: cultura.canteiro.espacamentoPlantas,
      };
  return {
    ...base,
    calcareo:      ins.calcareo.padrao,
    esterco:       ins.esterco.padrao,
    npk:           ins.npk.padrao,
    ureia:         ins.ureia.padrao,
    nitratoCalcio: ins.nitratoCalcio.padrao,
    modObra:       ins.modObra.padrao,
    precoVenda:    cultura.venda.precoUnitario,
    sobrevivencia: cultura.venda.sobrevivencia,
    precoCalcareo: 0.55,
    precoEsterco:  isCampo ? 0.08 : 0.80,
    precoNPK:      isCampo ? 2.50 : 8.00,
    precoUreia:    4.00,
    precoNitratoCa: 12.00,
    precoMulching: 2.10,
    custoEmbalagem:  isCampo ? 0   : 18,
    custoTransporte: 20,
    custoDefensivos: isCampo ? 80  : 35,
    custoEnergia:    25,
  };
}

function fmtBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL',
    minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
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

// ── CulturaRow ────────────────────────────────────────────────────────────────

function CulturaRow({ cultura, rank, areaHa }) {
  const isCampo      = cultura.tipo === 'campo';
  const nCanteiros   = calcNCanteirosPorHa(cultura, areaHa);
  const [editOpen, setEditOpen]   = useState(false);
  const [overrides, setOverrides] = useState({});

  const set = (campo, val) => setOverrides(o => ({ ...o, [campo]: val }));

  const valores  = { ...buildDefaults(cultura), ...overrides };
  const r        = useSimulador(cultura, valores);

  // ── Scale to selected area ──
  const scale      = isCampo ? areaHa : nCanteiros;
  const custoHa    = r.custoTotal * scale;
  const receitaHa  = r.receita   * scale;
  const lucroHa    = receitaHa - custoHa;
  const margemHa   = receitaHa > 0 ? (lucroHa / receitaHa) * 100 : 0;
  const plantasHa  = (r.totalPlantas || 0) * scale;

  const isPositive   = lucroHa >= 0;
  const margemColor  = margemHa >= 50 ? '#059669' : margemHa >= 20 ? '#d97706' : '#dc2626';
  const MargemIcon   = margemHa >= 20 ? TrendingUp : margemHa >= 0 ? Minus : TrendingDown;

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
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl p-3 text-center" style={{ background: 'hsl(210 16% 97%)' }}>
            <p className="section-label mb-0.5">Custo / {areaHa} ha</p>
            <p className="text-[12px] font-bold text-foreground">{fmtBRL(custoHa)}</p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: 'hsl(210 16% 97%)' }}>
            <p className="section-label mb-0.5">Receita / {areaHa} ha</p>
            <p className="text-[12px] font-bold text-foreground">{fmtBRL(receitaHa)}</p>
          </div>
          <div
            className="rounded-xl p-3 text-center"
            style={{ background: isPositive ? 'hsl(152 69% 95%)' : 'hsl(4 80% 96%)' }}
          >
            <p className="section-label mb-0.5">Lucro / {areaHa} ha</p>
            <p className="text-[12px] font-bold" style={{ color: isPositive ? '#059669' : '#dc2626' }}>
              {fmtBRL(lucroHa)}
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
              {plantasHa.toLocaleString('pt-BR')} plantas/{areaHa} ha
            </span>
            <span className="text-[9px] text-muted-foreground">
              {!isCampo && `${nCanteiros}×${cultura.canteiro.comprimento}×${cultura.canteiro.largura}m · `}
              margem {margemHa.toFixed(1)}%
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
              <div className="col-span-2">
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: cultura.cor }}>
                  Ajustar métricas
                </p>
              </div>
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
              <EditField
                label={`Mão de obra${isCampo ? ' / ha' : ' / ciclo'}`}
                value={valores.modObra}
                onChange={v => set('modObra', v)}
                prefix="R$"
              />
              <EditField
                label="Transporte / ciclo"
                value={valores.custoTransporte}
                onChange={v => set('custoTransporte', v)}
                prefix="R$"
              />
              {!isCampo && (
                <EditField
                  label="Embalagem / ciclo"
                  value={valores.custoEmbalagem}
                  onChange={v => set('custoEmbalagem', v)}
                  prefix="R$"
                />
              )}
              <EditField
                label="Defensivos / ciclo"
                value={valores.custoDefensivos}
                onChange={v => set('custoDefensivos', v)}
                prefix="R$"
              />
              <EditField
                label="Energia / ciclo"
                value={valores.custoEnergia}
                onChange={v => set('custoEnergia', v)}
                prefix="R$"
              />
              <button
                onClick={() => setOverrides({})}
                className="col-span-2 text-[11px] font-semibold text-muted-foreground py-1.5 rounded-xl transition-colors hover:text-foreground"
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
  const [sortBy,    setSortBy]    = useState('lucro');   // 'lucro' | 'margem' | 'receita'
  const [areaHa,    setAreaHa]    = useState(1);         // selected area in ha
  const [customArea, setCustomArea] = useState('');      // custom input string
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
          Corredor entre canteiros: {CORREDOR_M * 100} cm · base {effectiveArea} ha
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
            {/* Custom input */}
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
          Toque em ✏️ para ajustar preço de venda, custos e sobrevivência de cada cultura.
        </p>
        {sorted.map((c, i) => (
          <CulturaRow key={c.id} cultura={c} rank={i} areaHa={effectiveArea} />
        ))}
      </div>
    </div>
  );
}

// Static helper used only for sort order — not a React hook
function staticCalc(cultura) {
  const isCampo   = cultura.tipo === 'campo';
  const ins       = cultura.insumos;
  const nC        = calcNCanteirosPorHa(cultura);
  const r         = { custoTotal: 0, receita: 0 };

  const modObra   = ins.modObra.padrao;
  const precoV    = cultura.venda.precoUnitario;
  const sobreviv  = cultura.venda.sobrevivencia;

  // rough cost
  r.custoTotal = ins.calcareo.padrao * 0.55 + ins.esterco.padrao * (isCampo ? 0.08 : 0.80) +
    ins.npk.padrao * (isCampo ? 2.50 : 8.00) +
    (isCampo ? ins.ureia.padrao : ins.ureia.padrao / 1000) * 4.00 + modObra + 80;

  if (isCampo && cultura.venda.producaoKgPorHa) {
    r.receita = cultura.venda.producaoKgPorHa * precoV;
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
