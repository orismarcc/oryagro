import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, CalendarDays, Sprout, Package, TrendingUp,
  Cloud, CheckCircle2, Plus, Trash2, AlertTriangle,
  Thermometer, Droplets, ShoppingCart, BookOpen, Loader2, PenLine,
  Receipt, DollarSign, PackagePlus,
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
  updateLoteStatus,
  arquivarCicloLote,
  loadMaoObraRegistros,
  loadMovimentosByLote,
  upsertInsumo,
  addMovimento,
} from '../hooks/useGestao';
import { loadCompradores, addParcelas } from '../hooks/useCompradores';
import {
  CATEGORIAS_DESPESA, CATEGORIAS_RECEITA,
  addDespesa, loadDespesasByLote, deleteDespesa,
  getUnidade,
} from '../hooks/useDespesas';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
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

function WeatherWidget({ cor, cidade, estado }) {
  const { data, loading, location, alert } = useWeather({ cidade, estado });

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
// Reads colheita-type steps from the cronograma (static + custom rows added by user)
// and shows a summary: upcoming harvests, done harvests, next date.

const COLHEITA_COR = '#7c3aed';

function TabColheita({ cultura, lote }) {
  const cor = cultura.cor;

  // ── helpers (inline to avoid import dependency) ──
  function addDaysLocal(d, n) {
    const r = new Date(d); r.setDate(r.getDate() + n); return r;
  }
  function isoLocal(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function makeStableIdLocal(prefix, etapa) {
    const slug = etapa.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    return `${prefix}_${slug}`;
  }

  // Resolve viveiro shift
  const shift = (() => {
    if (lote.metodo_propagacao && cultura?.metodosPropagacao) {
      const m = cultura.metodosPropagacao.find(x => x.key === lote.metodo_propagacao);
      if (m?.diasViveiro) return m.diasViveiro;
    }
    return 0;
  })();

  const plantioDate = new Date(lote.data_plantio + 'T12:00:00');
  const todayStr    = today();

  // Load from Supabase on mount — then merge with localStorage fallback
  const [doneStatus, setDoneStatus]   = useState(() => safeLS(`cronograma_status_lote_${lote.id}`, {}));
  const [customRows, setCustomRows]   = useState(() => safeLS(`cronograma_custom_lote_${lote.id}`, []));

  useEffect(() => {
    import('../hooks/useSupabaseSync').then(({ loadCronogramaAtividades }) => {
      loadCronogramaAtividades(lote.id).then(dbRows => {
        if (!dbRows.length) return;
        const statusMap  = {};
        const custom     = [];
        const customDb   = dbRows.filter(r => r.is_custom);
        dbRows.filter(r => !r.is_custom).forEach(row => {
          const isViveiro = (cultura.metodosPropagacao || [])
            .flatMap(m => m.etapasViveiro || [])
            .some(e => e.etapa === row.etapa);
          statusMap[makeStableIdLocal(isViveiro ? 'viveiro' : 'default', row.etapa)] =
            { status: row.status, data: row.data_execucao };
        });
        customDb.forEach((row, i) => {
          statusMap[`custom_${i}`] = { status: row.status, data: row.data_execucao };
          custom.push({ dia: row.dia_previsto, etapa: row.etapa, produto: row.produto || '',
            dose: row.dose || '', forma: row.forma_aplicacao || '', tipo: row.tipo || 'manejo' });
        });
        setDoneStatus(statusMap);
        if (custom.length) setCustomRows(custom);
        // Update cache
        localStorage.setItem(`cronograma_status_lote_${lote.id}`, JSON.stringify(statusMap));
        if (custom.length) localStorage.setItem(`cronograma_custom_lote_${lote.id}`, JSON.stringify(custom));
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lote.id]);

  // Build list of colheita events
  const colheitas = [];

  // 1. Static cronograma steps with tipo === 'colheita'
  (cultura.cronograma || []).forEach((etapa, i) => {
    if (etapa.tipo !== 'colheita') return;
    const dia          = etapa.dia + shift;
    const dataPlanned  = isoLocal(addDaysLocal(plantioDate, dia));
    const st           = doneStatus[makeStableIdLocal('default', etapa.etapa)]; // fixed: was default_${i}
    const dataReal     = (st?.status === 'feito' && st?.data) ? st.data : null;
    colheitas.push({
      id: `static_${i}`,
      etapa:       etapa.etapa,
      dia,
      dataPlanned,
      dataReal,
      done:        st?.status === 'feito',
      isCustom:    false,
      produto:     etapa.produto || '',
      notas:       st?.obs || '',
    });
  });

  // 2. Custom rows with tipo === 'colheita'
  customRows.forEach((row, i) => {
    if (row.tipo !== 'colheita') return;
    let dataPlanned;
    if (row.dataPrevista) {
      dataPlanned = row.dataPrevista;
    } else if (row.dia !== '' && row.dia !== null && row.dia !== undefined) {
      const diaNum = parseInt(row.dia, 10);
      if (!isNaN(diaNum)) dataPlanned = isoLocal(addDaysLocal(plantioDate, diaNum + shift));
    }
    if (!dataPlanned) return;
    const st = doneStatus[`custom_${i}`];
    colheitas.push({
      id:         `custom_${i}`,
      etapa:      row.etapa || 'Colheita',
      dia:        row.dia,
      dataPlanned,
      dataReal:   (st?.status === 'feito' && st?.data) ? st.data : null,
      done:       st?.status === 'feito',
      isCustom:   true,
      produto:    row.produto || '',
      notas:      row.obs || st?.obs || '',
    });
  });

  colheitas.sort((a, b) => a.dataPlanned.localeCompare(b.dataPlanned));

  const doneCount    = colheitas.filter(c => c.done).length;
  const pendingCount = colheitas.filter(c => !c.done).length;
  const nextColheita = colheitas.find(c => !c.done && c.dataPlanned >= todayStr);

  // Days until next harvest
  const diasAteProxima = nextColheita
    ? Math.ceil((new Date(nextColheita.dataPlanned + 'T12:00:00') - new Date(todayStr + 'T12:00:00')) / 86_400_000)
    : null;

  if (colheitas.length === 0) {
    return (
      <div className="px-4 pt-5 pb-8 max-w-2xl mx-auto">
        <div className="text-center py-16">
          <TrendingUp size={36} className="mx-auto mb-3 opacity-20" style={{ color: COLHEITA_COR }} />
          <p className="text-[14px] font-bold text-foreground mb-1">Nenhuma colheita no cronograma</p>
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            Adicione uma atividade do tipo <strong>Colheita</strong> na aba{' '}
            <span className="font-semibold" style={{ color: cor }}>Cronograma</span> para ver o resumo aqui.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-5 pb-8 max-w-2xl mx-auto">

      {/* ── Summary banner ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-4 mb-5"
        style={{ borderColor: `${COLHEITA_COR}30` }}
      >
        <p className="section-label mb-3">Resumo das Colheitas</p>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-0.5">Total previstas</p>
            <p className="text-[20px] font-black leading-none" style={{ color: COLHEITA_COR }}>{colheitas.length}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-0.5">Realizadas</p>
            <p className="text-[20px] font-black leading-none" style={{ color: '#16a34a' }}>{doneCount}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-0.5">Pendentes</p>
            <p className="text-[20px] font-black leading-none" style={{ color: pendingCount > 0 ? '#d97706' : 'hsl(215 16% 55%)' }}>{pendingCount}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 rounded-full overflow-hidden mb-2" style={{ background: 'hsl(210 16% 93%)' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${colheitas.length > 0 ? (doneCount / colheitas.length) * 100 : 0}%`, background: '#16a34a' }}
          />
        </div>

        {/* Next harvest countdown */}
        {nextColheita && (
          <div
            className="flex items-center justify-between rounded-xl px-3 py-2.5 mt-1"
            style={{ background: `${COLHEITA_COR}0d`, border: `1px solid ${COLHEITA_COR}25` }}
          >
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Próxima colheita</p>
              <p className="text-[13px] font-bold text-foreground mt-0.5">{nextColheita.etapa}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold" style={{ color: COLHEITA_COR }}>
                {formatDatePtBR(nextColheita.dataPlanned)}
              </p>
              {diasAteProxima !== null && (
                <p className="text-[10px] text-muted-foreground">
                  {diasAteProxima === 0 ? 'Hoje!' : diasAteProxima < 0 ? `${Math.abs(diasAteProxima)}d atrás` : `em ${diasAteProxima}d`}
                </p>
              )}
            </div>
          </div>
        )}
      </motion.div>

      {/* ── Colheita list ── */}
      <p className="section-label mb-3">Calendário de Colheitas</p>
      <div className="flex flex-col gap-2.5">
        {colheitas.map((c, i) => {
          const isPast    = c.dataPlanned < todayStr;
          const isToday   = c.dataPlanned === todayStr;
          const statusBg  = c.done ? '#dcfce7'
                          : isToday ? '#fff7ed'
                          : isPast ? '#fee2e2'
                          : `${COLHEITA_COR}0d`;
          const statusBorder = c.done ? '#86efac'
                             : isToday ? '#fed7aa'
                             : isPast ? '#fca5a5'
                             : `${COLHEITA_COR}30`;
          const statusColor = c.done ? '#16a34a'
                            : isToday ? '#ea580c'
                            : isPast ? '#dc2626'
                            : COLHEITA_COR;

          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.2 }}
              className="card p-4"
              style={{ borderLeft: `3px solid ${statusColor}`, opacity: c.done ? 0.8 : 1 }}
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base"
                  style={{ background: statusBg }}
                >
                  {c.done ? '✓' : '🌾'}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Name + badges */}
                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                    <p className={`text-[13px] font-bold leading-tight ${c.done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                      {c.etapa}
                    </p>
                    {c.done && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: '#dcfce7', color: '#16a34a' }}>
                        ✓ realizada
                      </span>
                    )}
                    {!c.done && isToday && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: '#fff7ed', color: '#ea580c' }}>
                        hoje
                      </span>
                    )}
                    {!c.done && isPast && !isToday && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: '#fee2e2', color: '#dc2626' }}>
                        atrasada
                      </span>
                    )}
                    {c.isCustom && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: '#f3e8ff', color: '#7c3aed' }}>
                        personalizada
                      </span>
                    )}
                  </div>

                  {/* Dates */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[11px] font-semibold" style={{ color: statusColor }}>
                      📅 Prevista: {formatDatePtBR(c.dataPlanned)}
                      {c.dia !== undefined && c.dia !== null && c.dia !== '' && (
                        <span className="text-muted-foreground font-normal"> (Dia {c.dia})</span>
                      )}
                    </span>
                    {c.done && c.dataReal && c.dataReal !== c.dataPlanned && (
                      <span className="text-[11px] text-blue-600 font-medium">
                        Realizada: {formatDatePtBR(c.dataReal)}
                      </span>
                    )}
                    {c.done && c.dataReal && c.dataReal === c.dataPlanned && (
                      <span className="text-[11px]" style={{ color: '#16a34a' }}>
                        Realizada no prazo
                      </span>
                    )}
                  </div>

                  {/* Produto */}
                  {c.produto && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">{c.produto}</p>
                  )}

                  {/* Notas */}
                  {c.notas && (
                    <p className="text-[11px] text-muted-foreground italic mt-0.5">"{c.notas}"</p>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Hint */}
      <div
        className="mt-5 flex items-start gap-2.5 px-4 py-3 rounded-2xl"
        style={{ background: 'hsl(210 16% 96%)', border: '1px solid hsl(214 20% 90%)' }}
      >
        <span className="text-base flex-shrink-0">💡</span>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          Para adicionar ou registrar colheitas, vá até a aba{' '}
          <strong className="text-foreground">Cronograma</strong> e adicione ou marque como concluída uma atividade do tipo{' '}
          <strong style={{ color: COLHEITA_COR }}>Colheita</strong>.
        </p>
      </div>
    </div>
  );
}

// ─── Tab: Vendas / Receitas ──────────────────────────────────────────────────

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

// Helper: generate installment preview
function gerarParcelas(totalValor, numParcelas, primeiroVencimento) {
  if (!totalValor || !numParcelas || !primeiroVencimento) return [];
  const valorParcela = Math.round((totalValor / numParcelas) * 100) / 100;
  return Array.from({ length: numParcelas }, (_, i) => {
    const base = new Date(primeiroVencimento + 'T12:00:00');
    base.setDate(base.getDate() + i * 30);
    const iso = `${base.getFullYear()}-${String(base.getMonth()+1).padStart(2,'0')}-${String(base.getDate()).padStart(2,'0')}`;
    return { numeroParcela: i + 1, valor: valorParcela, dataVencimento: iso };
  });
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

// ─── Tab: Despesas ──────────────────────────────────────────────────────────

function TabDespesas({ lote, cor, canDelete }) {
  const SAFE_BOTTOM = 'calc(env(safe-area-inset-bottom, 0px) + 84px)';

  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const [form, setForm] = useState({
    data: today(),
    categoria: CATEGORIAS_DESPESA[0].label,
    subcategoria: '',
    quantidade: '',
    unidade: getUnidade(CATEGORIAS_DESPESA[0].label, ''),
    descricao: '',
    prestador: '',
    valor: '',
    observacao: '',
  });

  // Estoque integration state
  const CATS_COM_ESTOQUE = ['Insumos Agrícolas', 'Embalagem e Comercialização'];
  const showEstoqueToggle = CATS_COM_ESTOQUE.includes(form.categoria);
  const [estoqueForm, setEstoqueForm] = useState({
    enabled: false,
    nomeInsumo: '',
    qtdMinima: '0',
    precoUnitario: '',
  });

  const subcats = CATEGORIAS_DESPESA.find(c => c.label === form.categoria)?.subcategorias || [];
  const autoUnidade = getUnidade(form.categoria, form.subcategoria);

  // Auto-update unidade when categoria or subcategoria changes
  useEffect(() => {
    setForm(f => ({ ...f, unidade: getUnidade(f.categoria, f.subcategoria) }));
  }, [form.categoria, form.subcategoria]);

  // When categoria changes to one without estoque, disable toggle
  useEffect(() => {
    if (!CATS_COM_ESTOQUE.includes(form.categoria)) {
      setEstoqueForm(e => ({ ...e, enabled: false }));
    }
  }, [form.categoria]);

  // Pre-fill nome insumo from subcategoria or categoria
  useEffect(() => {
    if (!estoqueForm.enabled) return;
    setEstoqueForm(e => ({
      ...e,
      nomeInsumo: form.subcategoria || form.categoria,
    }));
  }, [form.subcategoria, form.categoria, estoqueForm.enabled]);

  const fetchRegistros = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadDespesasByLote(lote.id);
      setRegistros(data ?? []);
    } finally {
      setLoading(false);
    }
  }, [lote.id]);

  useEffect(() => { fetchRegistros(); }, [fetchRegistros]);

  // Realtime: any INSERT/UPDATE/DELETE in despesas for this lote refreshes the list
  useRealtimeSync('despesas', fetchRegistros, { column: 'plantio_id', value: lote.id });

  const handleAdd = async () => {
    if (!form.data || !form.valor || parseFloat(form.valor) <= 0) return;
    setSaving(true);
    try {
      await addDespesa({
        plantioId:     lote.id,
        propriedadeId: lote.propriedade_id || null,
        categoria:     form.categoria,
        subcategoria:  form.subcategoria || null,
        quantidade:    form.quantidade   || null,
        unidade:       form.quantidade ? form.unidade : null,
        descricao:     form.descricao    || null,
        prestador:     form.prestador    || null,
        valor:         parseFloat(form.valor),
        data:          form.data,
        observacao:    form.observacao   || null,
      });

      // ── Estoque integration ─────────────────────────────────────────────────
      if (estoqueForm.enabled && estoqueForm.nomeInsumo.trim() && lote.propriedade_id) {
        const qtd = parseFloat(form.quantidade) || 0;
        const insumo = await upsertInsumo({
          nome:              estoqueForm.nomeInsumo.trim(),
          unidade:           form.unidade || 'un',
          quantidade:        0,                                        // managed via movimentos
          quantidade_minima: parseFloat(estoqueForm.qtdMinima) || 0,
          preco_unitario:    parseFloat(estoqueForm.precoUnitario) || 0,
          propriedadeId:     lote.propriedade_id,
        });
        if (insumo?.id && qtd > 0) {
          await addMovimento({
            insumoId:    insumo.id,
            tipo:        'entrada',
            quantidade:  qtd,
            observacao:  `Despesa: ${form.descricao || form.subcategoria || form.categoria}`,
            data:        form.data,
            plantioId:   lote.id,
          });
        }
      }
      // ───────────────────────────────────────────────────────────────────────

      await fetchRegistros();
      setForm({
        data: today(),
        categoria: CATEGORIAS_DESPESA[0].label,
        subcategoria: '',
        quantidade: '',
        unidade: getUnidade(CATEGORIAS_DESPESA[0].label, ''),
        descricao: '',
        prestador: '',
        valor: '',
        observacao: '',
      });
      setEstoqueForm({ enabled: false, nomeInsumo: '', qtdMinima: '0', precoUnitario: '' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDespesa(id);
      setRegistros(prev => prev.filter(r => r.id !== id));
    } catch {}
    setConfirmDeleteId(null);
  };

  const totalDespesas = registros.reduce((s, r) => s + (r.valor ?? 0), 0);

  // Group by category for summary display
  const porCategoria = registros.reduce((acc, r) => {
    acc[r.categoria] = (acc[r.categoria] || 0) + (r.valor ?? 0);
    return acc;
  }, {});

  return (
    <div
      className="px-4 pt-5 max-w-2xl mx-auto overflow-y-auto"
      style={{ paddingBottom: SAFE_BOTTOM, scrollbarWidth: 'none' }}
    >
      {/* Total summary */}
      {registros.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-4 mb-5"
          style={{ borderColor: `${cor}30` }}
        >
          <p className="section-label mb-1">Total Despesas</p>
          <p className="text-[22px] font-black" style={{ color: cor }}>{fmtBRL(totalDespesas)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{registros.length} registro{registros.length !== 1 ? 's' : ''}</p>

          {/* Category breakdown */}
          {Object.entries(porCategoria).length > 1 && (
            <div className="mt-3 space-y-1 border-t pt-3" style={{ borderColor: `${cor}20` }}>
              {Object.entries(porCategoria).map(([cat, val]) => (
                <div key={cat} className="flex justify-between items-center">
                  <span className="text-[11px] text-muted-foreground truncate flex-1 mr-2">{cat}</span>
                  <span className="text-[11px] font-bold flex-shrink-0" style={{ color: cor }}>{fmtBRL(val)}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Form */}
      <p className="section-label mb-3">Registrar Despesa</p>
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
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Valor (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={form.valor}
              onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] font-semibold focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': cor }}
            />
          </div>
        </div>

        <div className="mb-3">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Categoria</label>
          <select
            value={form.categoria}
            onChange={e => setForm(f => ({ ...f, categoria: e.target.value, subcategoria: '' }))}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] font-semibold focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': cor }}
          >
            {CATEGORIAS_DESPESA.map(c => (
              <option key={c.label} value={c.label}>{c.label}</option>
            ))}
          </select>
        </div>

        {subcats.length > 0 && (
          <div className="mb-3">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Subcategoria (opcional)</label>
            <select
              value={form.subcategoria}
              onChange={e => setForm(f => ({ ...f, subcategoria: e.target.value }))}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] font-semibold focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': cor }}
            >
              <option value="">Selecionar…</option>
              {subcats.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}

        {/* Quantidade + unidade auto */}
        <div className="mb-3">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
            Quantidade (opcional)
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              step="any"
              placeholder="0"
              value={form.quantidade}
              onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))}
              className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-[13px] font-semibold focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': cor }}
            />
            <input
              type="text"
              value={form.unidade}
              onChange={e => setForm(f => ({ ...f, unidade: e.target.value }))}
              className="w-[64px] rounded-xl border border-input bg-background px-3 py-2 text-[13px] font-bold text-center focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': cor, color: cor }}
              placeholder="un"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Descrição (opcional)</label>
            <input
              type="text"
              placeholder="Ex: Capina geral"
              value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': cor }}
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Prestador (opcional)</label>
            <input
              type="text"
              placeholder="Ex: João Silva"
              value={form.prestador}
              onChange={e => setForm(f => ({ ...f, prestador: e.target.value }))}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': cor }}
            />
          </div>
        </div>

        {/* Estoque toggle — só aparece para categorias relevantes */}
        {showEstoqueToggle && (
          <div className="mb-3">
            <button
              type="button"
              onClick={() => setEstoqueForm(e => ({ ...e, enabled: !e.enabled }))}
              className="flex items-center gap-2 w-full rounded-xl border px-3 py-2.5 text-[13px] font-semibold transition-colors"
              style={{
                borderColor: estoqueForm.enabled ? cor : 'hsl(var(--border))',
                background:  estoqueForm.enabled ? `${cor}12` : 'transparent',
                color:       estoqueForm.enabled ? cor : 'hsl(var(--muted-foreground))',
              }}
            >
              <PackagePlus size={15} />
              Adicionar ao estoque?
              <span
                className="ml-auto w-9 h-5 rounded-full flex items-center transition-colors flex-shrink-0"
                style={{ background: estoqueForm.enabled ? cor : 'hsl(var(--border))' }}
              >
                <span
                  className="w-4 h-4 bg-white rounded-full shadow transition-transform mx-0.5"
                  style={{ transform: estoqueForm.enabled ? 'translateX(16px)' : 'translateX(0)' }}
                />
              </span>
            </button>

            <AnimatePresence>
              {estoqueForm.enabled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 p-3 rounded-xl space-y-3" style={{ background: `${cor}08`, border: `1px solid ${cor}20` }}>
                    <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: cor }}>
                      Dados do Estoque
                    </p>

                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Nome do insumo</label>
                      <input
                        type="text"
                        placeholder="Ex: Fertilizante NPK"
                        value={estoqueForm.nomeInsumo}
                        onChange={e => setEstoqueForm(f => ({ ...f, nomeInsumo: e.target.value }))}
                        className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] focus:outline-none focus:ring-2"
                        style={{ '--tw-ring-color': cor }}
                      />
                      <p className="text-[10px] text-muted-foreground mt-0.5">Se já existir no estoque com esse nome, a entrada será adicionada ao mesmo item.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Qtd. mínima</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="0"
                            value={estoqueForm.qtdMinima}
                            onChange={e => setEstoqueForm(f => ({ ...f, qtdMinima: e.target.value }))}
                            className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-[13px] focus:outline-none focus:ring-2"
                            style={{ '--tw-ring-color': cor }}
                          />
                          <span className="text-[11px] font-bold text-muted-foreground flex-shrink-0">{form.unidade || 'un'}</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Preço unit. (R$)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0,00"
                          value={estoqueForm.precoUnitario}
                          onChange={e => setEstoqueForm(f => ({ ...f, precoUnitario: e.target.value }))}
                          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] focus:outline-none focus:ring-2"
                          style={{ '--tw-ring-color': cor }}
                        />
                      </div>
                    </div>

                    <p className="text-[10px] text-muted-foreground">
                      A quantidade do campo acima ({form.quantidade || '0'} {form.unidade || 'un'}) será registrada como entrada no estoque da propriedade.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleAdd}
          disabled={saving || !form.data || !form.valor || parseFloat(form.valor) <= 0}
          className="w-full py-3 rounded-xl text-[13px] font-bold text-white flex items-center justify-center gap-2 disabled:opacity-40 transition-opacity"
          style={{ background: cor }}
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          Registrar Despesa
        </motion.button>
      </div>

      {/* List */}
      <p className="section-label mb-3">Registros</p>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : registros.length === 0 ? (
        <div className="text-center py-12">
          <Receipt size={32} className="mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="text-[13px] text-muted-foreground">Nenhuma despesa registrada ainda</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {registros.map(r => (
            <motion.div
              key={r.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="card p-4 flex items-start gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span
                    className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: `${cor}18`, color: cor }}
                  >
                    {formatDatePtBR(r.data)}
                  </span>
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: 'hsl(210 16% 94%)', color: 'hsl(215 16% 40%)' }}
                  >
                    {r.categoria}
                  </span>
                  {r.subcategoria && (
                    <span className="text-[10px] text-muted-foreground">{r.subcategoria}</span>
                  )}
                </div>
                {r.descricao && (
                  <p className="text-[12px] text-foreground mb-0.5">{r.descricao}</p>
                )}
                {r.prestador && (
                  <p className="text-[11px] text-muted-foreground mb-0.5">👤 {r.prestador}</p>
                )}
                <div className="flex items-baseline gap-3">
                  <p className="text-[14px] font-bold" style={{ color: cor }}>{fmtBRL(r.valor)}</p>
                  {r.quantidade != null && (
                    <p className="text-[11px] text-muted-foreground">
                      {fmtNumber(r.quantidade)} {r.unidade}
                    </p>
                  )}
                </div>
              </div>
              {canDelete && (
                confirmDeleteId === r.id ? (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="text-[11px] font-bold px-2 py-1 rounded-lg bg-red-100 text-red-600"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-[11px] font-bold px-2 py-1 rounded-lg bg-gray-100 text-gray-500"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    onClick={() => setConfirmDeleteId(r.id)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-red-500 transition-colors flex-shrink-0 mt-0.5"
                  >
                    <Trash2 size={14} />
                  </motion.button>
                )
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Receitas ───────────────────────────────────────────────────────────

function TabReceitas({ cultura, lote, canDelete }) {
  const SAFE_BOTTOM = 'calc(env(safe-area-inset-bottom, 0px) + 84px)';
  const cor = cultura.cor;
  const unidadeDefault = cultura.venda?.unidade ?? 'un';

  const [vendas, setVendas] = useState([]);
  const [loadingVendas, setLoadingVendas] = useState(true);
  const [saving, setSaving] = useState(false);

  // Compradores
  const [compradores, setCompradores] = useState([]);

  // Form state
  const [form, setForm] = useState({
    data: today(),
    categoria: CATEGORIAS_RECEITA[0].label,
    quantidade: '',
    unidade: unidadeDefault,
    precoUnitario: cultura.venda?.precoUnitario ?? 0,
    destino: 'feira',
    observacao: '',
    compradorId: '',
  });

  // Pagamento
  const [tipoPagamento, setTipoPagamento] = useState('avista'); // 'avista' | 'parcelado'
    const [avistaStatus, setAvistaStatus] = useState('pago'); // 'pago' | 'pendente'
  const [avistaData, setAvistaData] = useState(today());
  const [numParcelas, setNumParcelas] = useState(2);
  const [primeiroVencimento, setPrimeiroVencimento] = useState(today());
  const [parcelasEditaveis, setParcelasEditaveis] = useState([]);

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Auto-generate parcelas preview when relevant inputs change
  useEffect(() => {
    if (tipoPagamento !== 'parcelado') return;
    const total = (parseFloat(form.quantidade) || 0) * (parseFloat(form.precoUnitario) || 0);
    const geradas = gerarParcelas(total, parseInt(numParcelas) || 1, primeiroVencimento);
    setParcelasEditaveis(geradas);
  }, [tipoPagamento, form.quantidade, form.precoUnitario, numParcelas, primeiroVencimento]);

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

  // Realtime: any INSERT/UPDATE/DELETE in vendas for this lote refreshes the list
  useRealtimeSync('vendas', fetchVendas, { column: 'plantio_id', value: lote.id });

  useEffect(() => {
    loadCompradores().then(data => setCompradores(data ?? []));
  }, []);

  const handleAdd = async () => {
    if (!form.quantidade || parseFloat(form.quantidade) <= 0) return;
    setSaving(true);
    try {
      const novaVenda = await addVenda({
        plantioId:     lote.id,
        data:          form.data,
        quantidade:    parseFloat(form.quantidade),
        unidade:       form.unidade,
        precoUnitario: parseFloat(form.precoUnitario) || 0,
        destino:       form.destino,
        observacao:    form.observacao,
        compradorId:   form.compradorId || null,
        categoria:     form.categoria,
      });

      if (novaVenda) {
        const totalVenda = (parseFloat(form.quantidade) || 0) * (parseFloat(form.precoUnitario) || 0);

        if (tipoPagamento === 'parcelado') {
          // Use editáveis (user may have changed individual values/dates)
          const parcelas = parcelasEditaveis.map((p, i) => ({
            numeroParcela:  i + 1,
            valor:          parseFloat(p.valor) || 0,
            dataVencimento: p.dataVencimento,
          }));
          await addParcelas(novaVenda.id, parcelas);
        } else if (tipoPagamento === 'avista' && avistaStatus === 'pago') {
          await addParcelas(novaVenda.id, [{
            numeroParcela:  1,
            valor:          totalVenda,
            dataVencimento: avistaData,
            status:         'pago',
            dataPagamento:  avistaData,
          }]);
        } else {
          // à vista pendente
          await addParcelas(novaVenda.id, [{
            numeroParcela:  1,
            valor:          totalVenda,
            dataVencimento: avistaData,
          }]);
        }
      }

      await fetchVendas();
      // Reset form but keep destino, unidade, and categoria
      setForm(f => ({
        ...f,
        data: today(),
        quantidade: '',
        precoUnitario: cultura.venda?.precoUnitario ?? 0,
        observacao: '',
        compradorId: '',
      }));
      setAvistaData(today());
      setAvistaStatus('pago');
      setPrimeiroVencimento(today());
      setNumParcelas(2);
      setParcelasEditaveis([]);
    } catch {
      // fail silently
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVenda = async (id) => {
    if (confirmDeleteId === id) {
      // Second click — confirm
      try {
        await deleteVenda(id);
        setVendas(prev => prev.filter(v => v.id !== id));
      } catch {}
      setConfirmDeleteId(null);
    } else {
      // First click — ask for confirmation
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId(null), 3000);
    }
  };

  const sorted = [...vendas].sort((a, b) => (b.data ?? '').localeCompare(a.data ?? ''));

  // Summary
  const totalQty = vendas.reduce((s, v) => s + (v.quantidade ?? 0), 0);
  const totalReceita = vendas.reduce((s, v) => s + (v.quantidade ?? 0) * (v.preco_unitario ?? 0), 0);
  const precoMedio = totalQty > 0 ? totalReceita / totalQty : 0;

  const previewTotal = (parseFloat(form.quantidade) || 0) * (parseFloat(form.precoUnitario) || 0);

  const compradorSelecionado = compradores.find(c => c.id === form.compradorId);

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
          <p className="section-label mb-3">Resumo de Receitas</p>
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
      <p className="section-label mb-3">Registrar Receita</p>
      <div className="card p-4 mb-5">
        {/* Categoria */}
        <div className="mb-3">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Categoria</label>
          <select
            value={form.categoria}
            onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] font-semibold focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': cor }}
          >
            {CATEGORIAS_RECEITA.map(c => (
              <option key={c.label} value={c.label}>{c.label}</option>
            ))}
          </select>
        </div>

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

        {/* Comprador selector */}
        <div className="mb-3">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Comprador</label>
          <select
            value={form.compradorId}
            onChange={e => setForm(f => ({ ...f, compradorId: e.target.value }))}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] font-semibold focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': cor }}
          >
            <option value="">Sem comprador</option>
            {compradores.filter(c => c.status !== 'inativo').map(c => (
              <option key={c.id} value={c.id}>{c.nome}{c.tipo ? ` (${c.tipo})` : ''}</option>
            ))}
          </select>
        </div>

        {/* Pagamento config */}
        <div className="mb-3">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-2">Pagamento</label>
          {/* Toggle */}
          <div className="flex gap-1 p-0.5 rounded-xl mb-3"
            style={{ background: 'hsl(210 16% 93%)' }}>
            {[['avista', 'À vista'], ['parcelado', 'Parcelado']].map(([v, l]) => (
              <button
                key={v}
                type="button"
                onClick={() => setTipoPagamento(v)}
                className="flex-1 py-1.5 rounded-[10px] text-[12px] font-bold transition-all"
                style={tipoPagamento === v
                  ? { background: cor, color: 'white' }
                  : { background: 'transparent', color: 'hsl(215 16% 40%)' }}
              >
                {l}
              </button>
            ))}
          </div>

          {tipoPagamento === 'avista' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Data pagamento</label>
                <input
                  type="date"
                  value={avistaData}
                  onChange={e => setAvistaData(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] font-semibold focus:outline-none focus:ring-2"
                  style={{ '--tw-ring-color': cor }}
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Status</label>
                <select
                  value={avistaStatus}
                  onChange={e => setAvistaStatus(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] font-semibold focus:outline-none focus:ring-2"
                  style={{ '--tw-ring-color': cor }}
                >
                  <option value="pago">Pago</option>
                  <option value="pendente">Pendente</option>
                </select>
              </div>
            </div>
          )}

          {tipoPagamento === 'parcelado' && (
            <div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Nº de parcelas</label>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    value={numParcelas}
                    onChange={e => setNumParcelas(Math.min(24, Math.max(1, parseInt(e.target.value) || 1)))}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] font-semibold focus:outline-none focus:ring-2"
                    style={{ '--tw-ring-color': cor }}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Primeiro vencimento</label>
                  <input
                    type="date"
                    value={primeiroVencimento}
                    onChange={e => setPrimeiroVencimento(e.target.value)}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[13px] font-semibold focus:outline-none focus:ring-2"
                    style={{ '--tw-ring-color': cor }}
                  />
                </div>
              </div>

              {/* Parcelas preview/edit */}
              {parcelasEditaveis.length > 0 && (
                <div className="rounded-xl overflow-hidden border border-input mb-1">
                  <p className="text-[10px] font-bold uppercase tracking-wide px-3 py-1.5 text-muted-foreground"
                    style={{ background: 'hsl(210 16% 97%)' }}>
                    Parcelas (editáveis)
                  </p>
                  {parcelasEditaveis.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2"
                      style={{ borderTop: i > 0 ? '1px solid hsl(214 20% 91%)' : undefined }}>
                      <span className="text-[11px] font-bold text-muted-foreground w-5 flex-shrink-0">{i+1}.</span>
                      <input
                        type="date"
                        value={p.dataVencimento}
                        onChange={e => {
                          const updated = [...parcelasEditaveis];
                          updated[i] = { ...updated[i], dataVencimento: e.target.value };
                          setParcelasEditaveis(updated);
                        }}
                        className="flex-1 rounded-lg border border-input bg-background px-2 py-1 text-[12px] focus:outline-none focus:ring-1"
                      />
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <span className="text-[10px] text-muted-foreground">R$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={p.valor}
                          onChange={e => {
                            const updated = [...parcelasEditaveis];
                            updated[i] = { ...updated[i], valor: parseFloat(e.target.value) || 0 };
                            setParcelasEditaveis(updated);
                          }}
                          className="w-20 rounded-lg border border-input bg-background px-2 py-1 text-[12px] font-semibold text-right focus:outline-none focus:ring-1"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
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
          onClick={handleAdd}
          disabled={saving || !form.quantidade || parseFloat(form.quantidade) <= 0}
          className="w-full py-3 rounded-xl text-[13px] font-bold text-white flex items-center justify-center gap-2 disabled:opacity-40 transition-opacity"
          style={{ background: cor }}
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          Registrar Receita
        </motion.button>
      </div>

      {/* History */}
      <p className="section-label mb-3">Histórico de Receitas</p>
      {loadingVendas ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-12">
          <DollarSign size={32} className="mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="text-[13px] text-muted-foreground">Nenhuma receita registrada ainda</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map(entry => {
            const total = (entry.quantidade ?? 0) * (entry.preco_unitario ?? 0);
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
                    {entry.categoria && (
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: `${cor}18`, color: cor }}
                      >
                        {entry.categoria}
                      </span>
                    )}
                    <span className="text-[12px] text-muted-foreground">
                      {entry.quantidade} {entry.unidade}
                    </span>
                    <span className="text-[11px] text-muted-foreground">· {fmtBRL(entry.preco_unitario)}/un</span>
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
                    className="p-2 rounded-lg transition-colors flex-shrink-0 mt-0.5"
                    style={confirmDeleteId === entry.id
                      ? { background: '#fee2e2', color: '#dc2626' }
                      : { color: 'hsl(215 16% 50%)' }}
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

// ─── Main LotePage ──────────────────────────────────────────────────────────

const TABS = [
  { value: 'cronograma', label: 'Cronograma', Icon: CalendarDays },
  { value: 'colheita',   label: 'Colheita',   Icon: TrendingUp },
  { value: 'receitas',   label: 'Receitas',   Icon: DollarSign },
  { value: 'despesas',   label: 'Despesas',   Icon: Receipt },
  { value: 'diario',     label: 'Diário',     Icon: BookOpen },
];

export default function LotePage({ lote, cultura, onBack, userRole = null, propriedade = null }) {
  const canDelete = can(userRole, FARM_ACTIONS.DELETE_ANY);
  const [tab, setTab] = useState('cronograma');
  const [concluindo, setConcluindo] = useState(false);
  const [concluido, setConcluido] = useState(lote.status === 'concluido');
  const cor = cultura.cor;

  const lc = resolveLifecycle(lote, cultura);
  const { diasDecorridos, progresso: cycleProgressPct, diasPrimeiraProducao: cicloDias, prontoParaColheita } = lc;
  const cycleProgress = cycleProgressPct / 100;

  const handleConcluir = async () => {
    if (!window.confirm('Marcar este lote como concluído? Isso arquivará o ciclo no histórico.')) return;
    setConcluindo(true);
    try {
      // Load all data needed for the archive summary in parallel
      const [vendas, despesas, movimentos, maoObraRegistros] = await Promise.all([
        loadVendas(lote.id),
        loadDespesasByLote(lote.id),
        loadMovimentosByLote(lote.id),
        loadMaoObraRegistros(lote.id),
      ]);
      await arquivarCicloLote(lote, vendas, despesas, movimentos, maoObraRegistros);
      await updateLoteStatus(lote.id, 'concluido');
      setConcluido(true);
    } catch {
      // silently fail — UI state stays consistent even if archiving errors
    } finally {
      setConcluindo(false);
    }
  };

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

        <div className="relative z-10 px-5 pb-5" style={{ paddingTop: 'var(--hero-pad-top-no-btns)' }}>
          {/* Back button + Concluir */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-white/60 text-[12px] font-medium hover:text-white transition-colors"
            >
              <ArrowLeft size={14} />
              Voltar
            </button>
            {!concluido && canDelete && (
              <button
                onClick={handleConcluir}
                disabled={concluindo}
                className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all disabled:opacity-50"
                style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.25)' }}
              >
                <CheckCircle2 size={12} />
                {concluindo ? 'Concluindo…' : 'Concluir Lote'}
              </button>
            )}
            {concluido && (
              <span className="flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-xl"
                style={{ background: 'rgba(22,163,74,0.25)', color: '#86efac', border: '1px solid rgba(22,163,74,0.35)' }}>
                <CheckCircle2 size={12} /> Concluído
              </span>
            )}
          </div>

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
          <WeatherWidget cor={cor} cidade={propriedade?.cidade} estado={propriedade?.estado} />
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
                  <span>{label}</span>
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
          {tab === 'colheita' && (
            <TabColheita cultura={cultura} lote={lote} />
          )}
          {tab === 'receitas' && (
            <TabReceitas cultura={cultura} lote={lote} canDelete={canDelete} />
          )}
          {tab === 'despesas' && (
            <TabDespesas lote={lote} cor={cor} canDelete={canDelete} />
          )}
          {tab === 'diario' && (
            <TabDiario lote={lote} canDelete={canDelete} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
