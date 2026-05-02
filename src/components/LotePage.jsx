import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, CalendarDays, Sprout, Package, TrendingUp,
  Cloud, CheckCircle2, Plus, Trash2, AlertTriangle,
  Thermometer, Droplets, ShoppingCart, BookOpen, Loader2, PenLine,
} from 'lucide-react';
import CronogramaTimeline from './CronogramaTimeline';
import { useWeather } from '../hooks/useWeather';
import { PRECOS_INSUMOS } from '../data/precos';
import { resolveLifecycle } from '../lib/lifecycle';
import {
  loadDiario,
  addDiarioEntry,
  deleteDiarioEntry,
  loadVendas,
  addVenda,
  deleteVenda,
  updateLoteMaoObra,
} from '../hooks/useGestao';
import { can, FARM_ACTIONS } from '../lib/permissions';

// ─── Helpers ────────────────────────────────────────────────────────────────

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDatePtBR(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}


function fmtNumber(n) {
  return n?.toLocaleString('pt-BR') ?? '—';
}

function fmtBRL(n) {
  if (n === undefined || n === null || isNaN(n)) return 'R$ —';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function safeLS(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function saveLS(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

// ─── Scale calculation ───────────────────────────────────────────────────────

function calcScale(cultura, lote) {
  if (cultura.tipo === 'campo') {
    const base = cultura.area?.padrao || 1;
    return (parseFloat(lote.area_ha) || 1) / base;
  }
  const base = cultura.canteiro.comprimento * cultura.canteiro.largura;
  const actual =
    (parseFloat(lote.comprimento_m) || cultura.canteiro.comprimento) *
    (parseFloat(lote.largura_m) || cultura.canteiro.largura);
  return actual / base;
}

// ─── WeatherWidget ──────────────────────────────────────────────────────────

function WeatherWidget({ cor }) {
  const { data, loading, location, alert } = useWeather();

  if (loading) {
    return (
      <div
        className="mt-3 h-16 rounded-2xl animate-pulse"
        style={{ background: 'rgba(255,255,255,0.08)' }}
      />
    );
  }
  if (!data) return null;

  return (
    <div className="mt-3">
      {/* Location label */}
      {location && (
        <p className="text-[10px] font-semibold text-white/60 mb-1.5 flex items-center gap-1">
          <Cloud size={10} />
          {location}
        </p>
      )}

      {/* Alert badge */}
      {alert && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl mb-2 text-[11px] font-semibold"
          style={{ background: 'rgba(251,191,36,0.18)', border: '1px solid rgba(251,191,36,0.35)', color: '#fde68a' }}
        >
          <AlertTriangle size={12} />
          <span>{alert.msg}</span>
        </div>
      )}

      {/* 5-day strip */}
      <div
        className="flex gap-2 overflow-x-auto pb-1"
        style={{ scrollbarWidth: 'none' }}
      >
        {data.map((day) => (
          <div
            key={day.date}
            className="flex-shrink-0 flex flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-2"
            style={{
              minWidth: 56,
              background: 'rgba(255,255,255,0.10)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            <span className="text-[9px] font-bold uppercase tracking-wide text-white/70 leading-none">
              {day.dayName}
            </span>
            <span className="text-lg leading-none">{day.emoji}</span>
            <span className="text-[10px] font-bold text-white leading-none">
              {day.max}°
            </span>
            <span className="text-[9px] text-white/55 leading-none">{day.min}°</span>
            {parseFloat(day.rain) > 0 && (
              <span className="text-[9px] text-blue-300 leading-none">💧</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab: Insumos ────────────────────────────────────────────────────────────

function TabInsumos({ cultura, lote }) {
  const isCampo = cultura.tipo === 'campo';
  const ins = cultura.insumos;
  const scale = calcScale(cultura, lote);

  const PRECO_KEY = `lote_precos_${lote.id}`;

  const defaultPrecos = {
    calcareo:    PRECOS_INSUMOS.calcareo,
    esterco:     isCampo ? PRECOS_INSUMOS.estercoCampo : PRECOS_INSUMOS.estercoCanteiro,
    npk:         isCampo ? PRECOS_INSUMOS.npkCampo     : PRECOS_INSUMOS.npkCanteiro,
    ureia:       PRECOS_INSUMOS.ureia,
    nitratoCalcio: PRECOS_INSUMOS.nitratoCalcio,
    fte:         PRECOS_INSUMOS.fte,
    sementes:    ins.sementes?.precoUnitario ?? 0,
    modObra:     0,
  };

  const [precos, setPrecos] = useState(() => {
    const saved = safeLS(PRECO_KEY, {});
    return { ...defaultPrecos, ...saved };
  });

  // Editable mão de obra state
  const [maoObraReal, setMaoObraReal] = useState(lote.mao_obra_total ?? 0);
  const [savingMaoObra, setSavingMaoObra] = useState(false);
  const maoObraDebounceRef = useRef(null);

  // Sync maoObraReal with lote prop changes
  useEffect(() => {
    setMaoObraReal(lote.mao_obra_total ?? 0);
  }, [lote.mao_obra_total]);

  const handleMaoObraChange = (value) => {
    const num = parseFloat(value) || 0;
    setMaoObraReal(num);

    if (maoObraDebounceRef.current) clearTimeout(maoObraDebounceRef.current);
    maoObraDebounceRef.current = setTimeout(async () => {
      setSavingMaoObra(true);
      try {
        await updateLoteMaoObra(lote.id, num);
      } catch (e) {
        // silently ignore — value still held in local state
      } finally {
        setSavingMaoObra(false);
      }
    }, 500);
  };

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (maoObraDebounceRef.current) clearTimeout(maoObraDebounceRef.current);
    };
  }, []);

  const updatePreco = useCallback((key, value) => {
    setPrecos(prev => {
      const next = { ...prev, [key]: parseFloat(value) || 0 };
      saveLS(PRECO_KEY, next);
      return next;
    });
  }, [PRECO_KEY]);

  const insumoItems = [
    { key: 'calcareo',      label: 'Calcário',                 padrao: ins.calcareo?.padrao ?? 0,      unit: ins.calcareo?.unidade ?? 'kg',      toKg: 1 },
    { key: 'esterco',       label: 'Esterco bovino',            padrao: ins.esterco?.padrao ?? 0,       unit: ins.esterco?.unidade ?? 'kg',       toKg: 1 },
    { key: 'npk',           label: `NPK ${ins.npk?.formula ?? ''}`, padrao: ins.npk?.padrao ?? 0,      unit: ins.npk?.unidade ?? 'kg',           toKg: 1 },
    { key: 'ureia',         label: 'Ureia 46%',                 padrao: ins.ureia?.padrao ?? 0,         unit: ins.ureia?.unidade ?? 'g',          toKg: isCampo ? 1 : 1 / 1000 },
    { key: 'nitratoCalcio', label: 'Nitrato de Cálcio',         padrao: ins.nitratoCalcio?.padrao ?? 0, unit: ins.nitratoCalcio?.unidade ?? 'g',  toKg: isCampo ? 1 : 1 / 1000 },
    { key: 'fte',           label: 'FTE BR-12',                  padrao: ins.fte?.padrao ?? 0,           unit: ins.fte?.unidade ?? 'g',            toKg: isCampo ? 1 : 1 / 1000 },
  ];

  const sementesQty   = (ins.sementes?.padrao ?? 0) * scale;
  const sementesCusto = sementesQty * (precos.sementes || ins.sementes?.precoUnitario || 0);

  // Use editable maoObraReal instead of calculated value
  let totalInsumos = maoObraReal + sementesCusto;
  insumoItems.forEach(item => {
    const qty = item.padrao * scale;
    totalInsumos += qty * item.toKg * (precos[item.key] ?? 0);
  });

  // Scale info display
  const scaleInfo = isCampo
    ? `${((parseFloat(lote.area_ha) || 1)).toFixed(2)} ha · fator ${scale.toFixed(2)}× do padrão`
    : `${(
        (parseFloat(lote.comprimento_m) || cultura.canteiro.comprimento) *
        (parseFloat(lote.largura_m) || cultura.canteiro.largura)
      ).toFixed(1)} m² · fator ${scale.toFixed(2)}× do padrão`;

  const cor = cultura.cor;

  return (
    <div className="px-4 pt-5 pb-8 max-w-2xl mx-auto">
      {/* Header */}
      <p className="section-label mb-1">Calculadora de Insumos</p>
      <p className="text-[12px] text-muted-foreground mb-4">
        Este lote: {scaleInfo}
      </p>

      {/* Insumos card */}
      <div className="card p-0 overflow-hidden mb-4">
        {insumoItems.map((item, idx) => {
          const scaledQty = Math.round(item.padrao * scale * 100) / 100;
          const custo = scaledQty * item.toKg * (precos[item.key] ?? 0);
          return (
            <div
              key={item.key}
              className="flex items-center gap-3 px-4 py-3"
              style={{ borderBottom: idx < insumoItems.length - 1 ? '1px solid hsl(214 20% 91%)' : undefined }}
            >
              {/* Label + qty */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-foreground truncate">{item.label}</p>
                <p className="text-[11px] text-muted-foreground">
                  {scaledQty} {item.unit}
                </p>
              </div>

              {/* Price input */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-[10px] text-muted-foreground">R$/kg</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={precos[item.key] ?? ''}
                  onChange={e => updatePreco(item.key, e.target.value)}
                  className="w-16 rounded-lg border border-input bg-background px-2 py-1 text-[12px] font-semibold text-center focus:outline-none focus:ring-2"
                  style={{ focusRingColor: cor }}
                />
              </div>

              {/* Cost */}
              <div className="text-right flex-shrink-0 w-20">
                <p className="text-[12px] font-bold" style={{ color: cor }}>{fmtBRL(custo)}</p>
              </div>
            </div>
          );
        })}

        {/* Sementes row */}
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ borderTop: '1px solid hsl(214 20% 91%)', background: 'hsl(210 16% 97%)' }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-foreground">Sementes</p>
            <p className="text-[11px] text-muted-foreground">
              {Math.round(sementesQty * 100) / 100} {ins.sementes?.unidade ?? 'un'}
            </p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="text-[10px] text-muted-foreground">R$/un</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={precos.sementes ?? ''}
              onChange={e => updatePreco('sementes', e.target.value)}
              className="w-16 rounded-lg border border-input bg-background px-2 py-1 text-[12px] font-semibold text-center focus:outline-none focus:ring-2"
            />
          </div>
          <div className="text-right flex-shrink-0 w-20">
            <p className="text-[12px] font-bold" style={{ color: cor }}>{fmtBRL(sementesCusto)}</p>
          </div>
        </div>

        {/* Mão de obra row — editable, persisted to Supabase */}
        <div
          className="px-4 py-3"
          style={{ borderTop: '1px solid hsl(214 20% 91%)', background: 'hsl(210 16% 97%)' }}
        >
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <p className="text-[13px] font-semibold text-foreground">Mão de obra real</p>
                {savingMaoObra && (
                  <Loader2 size={11} className="animate-spin text-muted-foreground" />
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">Valor real para este ciclo</p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-[10px] text-muted-foreground">R$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={maoObraReal === 0 ? '' : maoObraReal}
                placeholder="0,00"
                onChange={e => handleMaoObraChange(e.target.value)}
                className="w-24 rounded-lg border border-input bg-background px-2 py-1 text-[12px] font-semibold text-center focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': cor }}
              />
            </div>
            <div className="text-right flex-shrink-0 w-20">
              <p className="text-[12px] font-bold" style={{ color: cor }}>{fmtBRL(maoObraReal)}</p>
            </div>
          </div>
        </div>

        {/* Footer total */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderTop: `2px solid ${cor}30`, background: `${cor}08` }}
        >
          <p className="text-[13px] font-bold text-foreground">Total insumos</p>
          <p className="text-[15px] font-black" style={{ color: cor }}>{fmtBRL(totalInsumos)}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Colheita ───────────────────────────────────────────────────────────

function TabColheita({ cultura, lote, canDelete }) {
  const COLHEITA_KEY = `lote_colheita_${lote.id}`;
  const cor = cultura.cor;

  const [history, setHistory] = useState(() => safeLS(COLHEITA_KEY, []));

  const [form, setForm] = useState({
    data: today(),
    quantidade: '',
    preco: cultura.venda?.precoUnitario ?? 0,
    notas: '',
  });

  const updateHistory = (next) => {
    setHistory(next);
    saveLS(COLHEITA_KEY, next);
  };

  const handleAdd = () => {
    if (!form.quantidade || parseFloat(form.quantidade) <= 0) return;
    const entry = {
      id: Date.now().toString(),
      data: form.data,
      quantidade: parseFloat(form.quantidade),
      preco: parseFloat(form.preco) || 0,
      notas: form.notas,
    };
    const next = [entry, ...history];
    updateHistory(next);
    setForm(f => ({ ...f, quantidade: '', notas: '', data: today() }));
  };

  const handleDelete = (id) => updateHistory(history.filter(h => h.id !== id));

  const sorted = [...history].sort((a, b) => b.data.localeCompare(a.data));

  // Summary
  const totalQty    = history.reduce((s, h) => s + h.quantidade, 0);
  const totalReceita = history.reduce((s, h) => s + h.quantidade * h.preco, 0);
  const precoMedio  = totalQty > 0 ? totalReceita / totalQty : 0;

  const sobrevivencia = cultura.venda?.sobrevivencia ?? 100;
  const receitaEstimada =
    (lote.total_plantas || 0) * (sobrevivencia / 100) * (cultura.venda?.precoUnitario ?? 0);
  const diferenca = totalReceita - receitaEstimada;

  const unidade = cultura.venda?.unidade ?? 'un';

  const previewReceita = (parseFloat(form.quantidade) || 0) * (parseFloat(form.preco) || 0);

  return (
    <div className="px-4 pt-5 pb-8 max-w-2xl mx-auto">

      {/* Summary card */}
      {history.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-4 mb-5"
          style={{ borderColor: `${cor}30` }}
        >
          <p className="section-label mb-3">Resumo</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-0.5">Total colhido</p>
              <p className="text-[15px] font-black" style={{ color: cor }}>{fmtNumber(Math.round(totalQty * 100) / 100)} {unidade}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-0.5">Receita real</p>
              <p className="text-[15px] font-black" style={{ color: cor }}>{fmtBRL(totalReceita)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-0.5">Preço médio</p>
              <p className="text-[14px] font-bold text-foreground">{fmtBRL(precoMedio)}/{unidade}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-0.5">Estimado</p>
              <p className="text-[14px] font-bold text-foreground">{fmtBRL(receitaEstimada)}</p>
            </div>
          </div>

          {/* Difference */}
          <div
            className="mt-3 flex items-center justify-between rounded-xl px-3 py-2.5"
            style={{
              background: diferenca >= 0 ? 'hsl(142 69% 95%)' : 'hsl(4 80% 96%)',
              border: `1px solid ${diferenca >= 0 ? 'hsl(142 69% 85%)' : 'hsl(4 80% 88%)'}`,
            }}
          >
            <p className="text-[12px] font-semibold" style={{ color: diferenca >= 0 ? '#059669' : '#dc2626' }}>
              {diferenca >= 0 ? '▲' : '▼'} {diferenca >= 0 ? 'Acima' : 'Abaixo'} do estimado
            </p>
            <p className="text-[14px] font-black" style={{ color: diferenca >= 0 ? '#059669' : '#dc2626' }}>
              {diferenca >= 0 ? '+' : ''}{fmtBRL(diferenca)}
            </p>
          </div>
        </motion.div>
      )}

      {/* Register form */}
      <p className="section-label mb-3">Registrar Colheita</p>
      <div className="card p-4 mb-5">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Data</label>
            <input
              type="date"
              value={form.data}
              onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] font-semibold focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': cor }}
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
              Quantidade ({unidade})
            </label>
            <input
              type="number"
              min="0"
              step="any"
              placeholder="0"
              value={form.quantidade}
              onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] font-semibold focus:outline-none focus:ring-2"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
              Preço / {unidade}
            </label>
            <div className="flex items-center gap-1">
              <span className="text-[12px] text-muted-foreground font-semibold">R$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.preco}
                onChange={e => setForm(f => ({ ...f, preco: e.target.value }))}
                className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-[13px] font-semibold focus:outline-none focus:ring-2"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Notas</label>
            <input
              type="text"
              placeholder="Opcional"
              value={form.notas}
              onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] focus:outline-none focus:ring-2"
            />
          </div>
        </div>

        {/* Preview */}
        {parseFloat(form.quantidade) > 0 && (
          <p className="text-[12px] text-muted-foreground mb-3">
            Receita:{' '}
            <span className="font-semibold text-foreground">
              {form.quantidade} {unidade} × {fmtBRL(parseFloat(form.preco) || 0)} = <span style={{ color: cor }}>{fmtBRL(previewReceita)}</span>
            </span>
          </p>
        )}

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleAdd}
          disabled={!form.quantidade || parseFloat(form.quantidade) <= 0}
          className="w-full py-3 rounded-xl text-[13px] font-bold text-white flex items-center justify-center gap-2 disabled:opacity-40 transition-opacity"
          style={{ background: cor }}
        >
          <Plus size={15} />
          Registrar Colheita
        </motion.button>
      </div>

      {/* History */}
      {sorted.length > 0 && (
        <>
          <p className="section-label mb-3">Histórico</p>
          <div className="flex flex-col gap-2">
            {sorted.map(entry => {
              const receita = entry.quantidade * entry.preco;
              return (
                <motion.div
                  key={entry.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="card p-4 flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <CheckCircle2 size={12} style={{ color: cor }} />
                      <span className="text-[12px] font-semibold text-foreground">{formatDatePtBR(entry.data)}</span>
                      <span className="text-[12px] text-muted-foreground">
                        {entry.quantidade} {unidade}
                      </span>
                      <span className="text-[11px] text-muted-foreground">· R$ {entry.preco?.toFixed(2)}/un</span>
                    </div>
                    <p className="text-[13px] font-bold" style={{ color: cor }}>= {fmtBRL(receita)}</p>
                    {entry.notas && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">{entry.notas}</p>
                    )}
                  </div>
                  {canDelete && (
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={() => handleDelete(entry.id)}
                      className="p-2 rounded-lg text-muted-foreground hover:text-red-500 transition-colors flex-shrink-0"
                    >
                      <Trash2 size={14} />
                    </motion.button>
                  )}
                </motion.div>
              );
            })}
          </div>
        </>
      )}

      {history.length === 0 && (
        <div className="text-center py-12">
          <TrendingUp size={32} className="mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="text-[13px] text-muted-foreground">Nenhuma colheita registrada ainda</p>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Vendas ─────────────────────────────────────────────────────────────

const DESTINO_OPTIONS = [
  { value: 'feira',          label: 'Feira livre' },
  { value: 'ceasa',          label: 'CEASA' },
  { value: 'cliente_direto', label: 'Cliente direto' },
  { value: 'atravessador',   label: 'Atravessador' },
  { value: 'outros',         label: 'Outros' },
];

const DESTINO_BADGE_STYLE = {
  feira:          { background: '#dcfce7', color: '#166534' },
  ceasa:          { background: '#dbeafe', color: '#1e40af' },
  cliente_direto: { background: '#f3e8ff', color: '#6b21a8' },
  atravessador:   { background: '#ffedd5', color: '#9a3412' },
  outros:         { background: '#f3f4f6', color: '#374151' },
};

function DestinoBadge({ destino }) {
  const style = DESTINO_BADGE_STYLE[destino] ?? DESTINO_BADGE_STYLE.outros;
  const label = DESTINO_OPTIONS.find(d => d.value === destino)?.label ?? destino;
  return (
    <span
      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={style}
    >
      {label}
    </span>
  );
}

function TabVendas({ cultura, lote, canDelete }) {
  const SAFE_BOTTOM = 'calc(env(safe-area-inset-bottom, 0px) + 84px)';
  const cor = cultura.cor;
  const unidadeDefault = cultura.venda?.unidade ?? 'un';

  const [vendas, setVendas] = useState([]);
  const [loadingVendas, setLoadingVendas] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    data: today(),
    quantidade: '',
    unidade: unidadeDefault,
    precoUnitario: cultura.venda?.precoUnitario ?? 0,
    destino: 'feira',
    observacao: '',
  });

  const fetchVendas = useCallback(async () => {
    setLoadingVendas(true);
    try {
      const data = await loadVendas(lote.id);
      setVendas(data ?? []);
    } catch {
      setVendas([]);
    } finally {
      setLoadingVendas(false);
    }
  }, [lote.id]);

  useEffect(() => {
    fetchVendas();
  }, [fetchVendas]);

  const handleAddVenda = async () => {
    if (!form.quantidade || parseFloat(form.quantidade) <= 0) return;
    setSaving(true);
    try {
      await addVenda({
        plantioId: lote.id,
        data: form.data,
        quantidade: parseFloat(form.quantidade),
        unidade: form.unidade,
        precoUnitario: parseFloat(form.precoUnitario) || 0,
        destino: form.destino,
        observacao: form.observacao,
      });
      await fetchVendas();
      // Reset form but keep destino and unidade
      setForm(f => ({
        ...f,
        data: today(),
        quantidade: '',
        precoUnitario: cultura.venda?.precoUnitario ?? 0,
        observacao: '',
      }));
    } catch {
      // fail silently
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVenda = async (id) => {
    try {
      await deleteVenda(id);
      setVendas(prev => prev.filter(v => v.id !== id));
    } catch {}
  };

  const sorted = [...vendas].sort((a, b) => (b.data ?? '').localeCompare(a.data ?? ''));

  // Summary
  const totalQty = vendas.reduce((s, v) => s + (v.quantidade ?? 0), 0);
  const totalReceita = vendas.reduce((s, v) => s + (v.quantidade ?? 0) * (v.precoUnitario ?? 0), 0);
  const precoMedio = totalQty > 0 ? totalReceita / totalQty : 0;

  const previewTotal = (parseFloat(form.quantidade) || 0) * (parseFloat(form.precoUnitario) || 0);

  return (
    <div
      className="px-4 pt-5 max-w-2xl mx-auto overflow-y-auto"
      style={{ paddingBottom: SAFE_BOTTOM, scrollbarWidth: 'none' }}
    >
      {/* Summary */}
      {vendas.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-4 mb-5"
          style={{ borderColor: `${cor}30` }}
        >
          <p className="section-label mb-3">Resumo de Vendas</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-0.5">Total vendido</p>
              <p className="text-[15px] font-black" style={{ color: cor }}>
                {fmtNumber(Math.round(totalQty * 100) / 100)} {form.unidade}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-0.5">Receita total</p>
              <p className="text-[15px] font-black" style={{ color: cor }}>{fmtBRL(totalReceita)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-0.5">Preço médio</p>
              <p className="text-[14px] font-bold text-foreground">{fmtBRL(precoMedio)}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Register form */}
      <p className="section-label mb-3">Registrar Venda</p>
      <div className="card p-4 mb-5">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Data</label>
            <input
              type="date"
              value={form.data}
              onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] font-semibold focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': cor }}
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Quantidade</label>
            <input
              type="number"
              min="0"
              step="any"
              placeholder="0"
              value={form.quantidade}
              onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] font-semibold focus:outline-none focus:ring-2"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Unidade</label>
            <input
              type="text"
              value={form.unidade}
              onChange={e => setForm(f => ({ ...f, unidade: e.target.value }))}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] font-semibold focus:outline-none focus:ring-2"
              placeholder="un"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Preço / unidade</label>
            <div className="flex items-center gap-1">
              <span className="text-[12px] text-muted-foreground font-semibold">R$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.precoUnitario}
                onChange={e => setForm(f => ({ ...f, precoUnitario: e.target.value }))}
                className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-[13px] font-semibold focus:outline-none focus:ring-2"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Destino</label>
            <select
              value={form.destino}
              onChange={e => setForm(f => ({ ...f, destino: e.target.value }))}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] font-semibold focus:outline-none focus:ring-2"
            >
              {DESTINO_OPTIONS.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Observação</label>
            <input
              type="text"
              placeholder="Opcional"
              value={form.observacao}
              onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] focus:outline-none focus:ring-2"
            />
          </div>
        </div>

        {/* Preview */}
        {parseFloat(form.quantidade) > 0 && (
          <p className="text-[12px] text-muted-foreground mb-3">
            <span className="font-semibold text-foreground">
              {form.quantidade} {form.unidade} × {fmtBRL(parseFloat(form.precoUnitario) || 0)} ={' '}
              <span style={{ color: cor }}>{fmtBRL(previewTotal)}</span>
            </span>
          </p>
        )}

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleAddVenda}
          disabled={saving || !form.quantidade || parseFloat(form.quantidade) <= 0}
          className="w-full py-3 rounded-xl text-[13px] font-bold text-white flex items-center justify-center gap-2 disabled:opacity-40 transition-opacity"
          style={{ background: cor }}
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          Registrar Venda
        </motion.button>
      </div>

      {/* History */}
      <p className="section-label mb-3">Histórico de Vendas</p>
      {loadingVendas ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-12">
          <ShoppingCart size={32} className="mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="text-[13px] text-muted-foreground">Nenhuma venda registrada ainda</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map(entry => {
            const total = (entry.quantidade ?? 0) * (entry.precoUnitario ?? 0);
            return (
              <motion.div
                key={entry.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="card p-4 flex items-start gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-[12px] font-semibold text-foreground">{formatDatePtBR(entry.data)}</span>
                    <span className="text-[12px] text-muted-foreground">
                      {entry.quantidade} {entry.unidade}
                    </span>
                    <span className="text-[11px] text-muted-foreground">· {fmtBRL(entry.precoUnitario)}/un</span>
                    {entry.destino && <DestinoBadge destino={entry.destino} />}
                  </div>
                  <p className="text-[13px] font-bold" style={{ color: cor }}>{fmtBRL(total)}</p>
                  {entry.observacao && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">{entry.observacao}</p>
                  )}
                </div>
                {canDelete && (
                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    onClick={() => handleDeleteVenda(entry.id)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-red-500 transition-colors flex-shrink-0 mt-0.5"
                  >
                    <Trash2 size={14} />
                  </motion.button>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Diário ─────────────────────────────────────────────────────────────

const TIPO_OPTIONS = [
  { value: 'anotacao',  label: '📝 Anotação' },
  { value: 'clima',     label: '🌦 Clima' },
  { value: 'praga',     label: '🐛 Praga/Doença' },
  { value: 'visita',    label: '👤 Visita técnica' },
  { value: 'irrigacao', label: '💧 Irrigação' },
  { value: 'outros',    label: '📌 Outros' },
];

const TIPO_BADGE_STYLE = {
  anotacao:  { background: '#dbeafe', color: '#1e40af' },
  clima:     { background: '#e0f2fe', color: '#0369a1' },
  praga:     { background: '#fee2e2', color: '#991b1b' },
  visita:    { background: '#f3e8ff', color: '#6b21a8' },
  irrigacao: { background: '#cffafe', color: '#155e75' },
  outros:    { background: '#f3f4f6', color: '#374151' },
};

function TipoBadge({ tipo }) {
  const style = TIPO_BADGE_STYLE[tipo] ?? TIPO_BADGE_STYLE.outros;
  const opt = TIPO_OPTIONS.find(t => t.value === tipo);
  const label = opt ? opt.label : tipo;
  return (
    <span
      className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={style}
    >
      {label}
    </span>
  );
}

function TabDiario({ lote, canDelete }) {
  const SAFE_BOTTOM = 'calc(env(safe-area-inset-bottom, 0px) + 84px)';

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    data: today(),
    tipo: 'anotacao',
    texto: '',
  });

  const fetchDiario = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadDiario(lote.id);
      setEntries(data ?? []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [lote.id]);

  useEffect(() => {
    fetchDiario();
  }, [fetchDiario]);

  const handleAdd = async () => {
    if (!form.texto.trim()) return;
    setSaving(true);
    try {
      await addDiarioEntry({
        plantioId: lote.id,
        data: form.data,
        tipo: form.tipo,
        texto: form.texto.trim(),
      });
      await fetchDiario();
      setForm({ data: today(), tipo: 'anotacao', texto: '' });
    } catch {
      // fail silently
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDiarioEntry(id);
      setEntries(prev => prev.filter(e => e.id !== id));
    } catch {}
  };

  // Already returned sorted by API, but ensure desc anyway
  const sorted = [...entries].sort((a, b) => (b.data ?? '').localeCompare(a.data ?? ''));

  return (
    <div
      className="px-4 pt-5 max-w-2xl mx-auto overflow-y-auto"
      style={{ paddingBottom: SAFE_BOTTOM, scrollbarWidth: 'none' }}
    >
      {/* Nova Entrada form */}
      <p className="section-label mb-3">Nova Entrada</p>
      <div className="card p-4 mb-5">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Data</label>
            <input
              type="date"
              value={form.data}
              onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] font-semibold focus:outline-none focus:ring-2"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Tipo</label>
            <select
              value={form.tipo}
              onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] font-semibold focus:outline-none focus:ring-2"
            >
              {TIPO_OPTIONS.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-3">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Observação</label>
          <textarea
            rows={3}
            placeholder="Descreva a observação..."
            value={form.texto}
            onChange={e => setForm(f => ({ ...f, texto: e.target.value }))}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] focus:outline-none focus:ring-2 resize-none"
          />
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleAdd}
          disabled={saving || !form.texto.trim()}
          className="w-full py-3 rounded-xl text-[13px] font-bold text-white flex items-center justify-center gap-2 disabled:opacity-40 transition-opacity"
          style={{ background: '#334155' }}
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <PenLine size={15} />}
          Salvar
        </motion.button>
      </div>

      {/* Registros list */}
      <p className="section-label mb-3">Registros</p>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen size={32} className="mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="text-[13px] text-muted-foreground">Nenhum registro ainda</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map(entry => (
            <motion.div
              key={entry.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="card p-4 flex items-start gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: '#f1f5f9', color: '#475569' }}
                  >
                    {formatDatePtBR(entry.data)}
                  </span>
                  <TipoBadge tipo={entry.tipo} />
                </div>
                <p className="text-[13px] text-foreground leading-snug">{entry.texto}</p>
              </div>
              {canDelete && (
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={() => handleDelete(entry.id)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-red-500 transition-colors flex-shrink-0 mt-0.5"
                >
                  <Trash2 size={14} />
                </motion.button>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main LotePage ──────────────────────────────────────────────────────────

const TABS = [
  { value: 'cronograma', label: 'Cronograma', Icon: CalendarDays },
  { value: 'insumos',    label: 'Insumos',    Icon: Package },
  { value: 'colheita',   label: 'Colheita',   Icon: TrendingUp },
  { value: 'vendas',     label: 'Vendas',     Icon: ShoppingCart },
  { value: 'diario',     label: 'Diário',     Icon: BookOpen },
];

export default function LotePage({ lote, cultura, onBack, userRole = null }) {
  const canDelete = can(userRole, FARM_ACTIONS.DELETE_ANY);
  const [tab, setTab] = useState('cronograma');
  const cor = cultura.cor;

  const lc = resolveLifecycle(lote, cultura);
  const { diasDecorridos, progresso: cycleProgressPct, diasPrimeiraProducao: cicloDias, prontoParaColheita } = lc;
  const cycleProgress = cycleProgressPct / 100;

  return (
    <div className="min-h-screen bg-background">

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <div className="gradient-hero relative overflow-hidden">
        {/* Background glow blobs */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: '-30%', right: '-15%', width: '55%', height: '65%',
            background: `radial-gradient(circle, ${cor}35 0%, transparent 70%)`,
          }}
        />
        <div
          className="absolute pointer-events-none"
          style={{
            bottom: '-20%', left: '-10%', width: '40%', height: '50%',
            background: `radial-gradient(circle, ${cor}18 0%, transparent 70%)`,
          }}
        />
        {/* Watermark text */}
        <div
          className="absolute right-0 bottom-0 select-none pointer-events-none font-display font-black leading-none overflow-hidden"
          style={{
            fontSize: 'clamp(80px, 16vw, 140px)',
            color: cor,
            opacity: 0.07,
            letterSpacing: '-0.06em',
            right: '-2%',
            bottom: '-10%',
          }}
        >
          {lote.nome}
        </div>

        <div className="relative z-10 px-5 pt-4 pb-5">
          {/* Back button */}
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-white/60 text-[12px] font-medium mb-4 hover:text-white transition-colors"
          >
            <ArrowLeft size={14} />
            Voltar
          </button>

          {/* Cultura + Lote name row */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="flex items-center gap-3 mb-2"
          >
            <div
              className="h-11 w-11 rounded-2xl flex items-center justify-center border flex-shrink-0"
              style={{
                background: 'rgba(255,255,255,0.15)',
                borderColor: 'rgba(255,255,255,0.25)',
                fontSize: 20,
              }}
            >
              {cultura.emoji}
            </div>
            <div>
              <p className="text-white/55 text-[11px] font-semibold leading-none mb-0.5">{cultura.nome}</p>
              <h1 className="font-display text-white font-extrabold leading-tight" style={{ fontSize: 'clamp(18px, 5vw, 26px)' }}>
                {lote.nome}
              </h1>
            </div>
          </motion.div>

          {/* Meta row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35, delay: 0.07 }}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-4 text-white/65 text-[12px] font-medium"
          >
            <span className="flex items-center gap-1">
              <CalendarDays size={11} />
              {formatDatePtBR(lote.data_plantio)}
            </span>
            <span className="text-white/30">·</span>
            <span className="flex items-center gap-1">
              <Sprout size={11} />
              Dia <strong className="text-white font-bold ml-0.5">{diasDecorridos}</strong> do ciclo
            </span>
            {lote.total_plantas > 0 && (
              <>
                <span className="text-white/30">·</span>
                <span>{fmtNumber(lote.total_plantas)} plantas</span>
              </>
            )}
          </motion.div>

          {/* Cycle progress bar */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.12 }}
            className="mb-1"
          >
            <div className="flex justify-between mb-1.5">
              <span className="text-[10px] text-white/55 font-semibold uppercase tracking-wide">Progresso do ciclo</span>
              <span className="text-[10px] text-white/80 font-bold">
                {cicloDias > 1
                  ? `${diasDecorridos} / ${cicloDias} dias (${cycleProgressPct}%)`
                  : 'N/A'}
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.15)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${cor}80, ${cor})` }}
                initial={{ width: 0 }}
                animate={{ width: `${cycleProgress * 100}%` }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
              />
            </div>
          </motion.div>

          {/* Weather widget */}
          <WeatherWidget cor={cor} />
        </div>
      </div>

      {/* ── Sticky tab bar ──────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-20 px-4 py-2.5"
        style={{
          background: 'rgb(244, 246, 248)',
          borderBottom: '1px solid hsl(214 20% 88%)',
          transform: 'translateZ(0)',
        }}
      >
        <div
          className="flex gap-0.5 p-0.5 rounded-xl overflow-x-auto"
          style={{ background: 'hsl(210 16% 93%)', scrollbarWidth: 'none' }}
        >
          {TABS.map(({ value, label, Icon }) => {
            const isActive = tab === value;
            return (
              <button
                key={value}
                onClick={() => setTab(value)}
                className="relative flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-[12px] font-semibold outline-none transition-colors duration-150"
                style={{ color: isActive ? '#fff' : 'hsl(215 16% 40%)' }}
              >
                {isActive && (
                  <motion.div
                    layoutId="lote-tab-pill"
                    className="absolute inset-0 rounded-[10px]"
                    style={{ background: cor }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <Icon size={12} />
                  <span className="hidden sm:inline">{label}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${lote.id}-${tab}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          style={{ willChange: 'opacity, transform' }}
        >
          {tab === 'cronograma' && (
            <CronogramaTimeline cultura={cultura} lotes={[lote]} />
          )}
          {tab === 'insumos' && (
            <TabInsumos cultura={cultura} lote={lote} />
          )}
          {tab === 'colheita' && (
            <TabColheita cultura={cultura} lote={lote} canDelete={canDelete} />
          )}
          {tab === 'vendas' && (
            <TabVendas cultura={cultura} lote={lote} canDelete={canDelete} />
          )}
          {tab === 'diario' && (
            <TabDiario lote={lote} canDelete={canDelete} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
