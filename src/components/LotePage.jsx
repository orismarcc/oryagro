import React, { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, CalendarDays, Sprout, TrendingUp,
  Cloud, CheckCircle2, AlertTriangle,
  BookOpen, Loader2,
  Receipt, DollarSign,
} from 'lucide-react';
import CronogramaTimeline from './CronogramaTimeline';
import CurvaProducaoChart from './CurvaProducaoChart';
import { useCurvasProducao } from '../hooks/useCurvasProducao';
import { useWeather } from '../hooks/useWeather';
import { resolveLifecycle } from '../lib/lifecycle';
import {
  loadVendas,
  updateLoteStatus,
  arquivarCicloLote,
  loadMaoObraRegistros,
  loadMovimentosByLote,
} from '../hooks/useGestao';
import { loadDespesasByLote } from '../hooks/useDespesas';
import { can, FARM_ACTIONS } from '../lib/permissions';
import { makeStableId, makeCustomId } from '../hooks/useCronogramaSync';
import { formatDatePtBR, fmtNumber, today, safeLS } from './lote/shared';
import TabInsumos from './lote/TabInsumos';
import TabDiario from './lote/TabDiario';
import TabProducao from './lote/TabProducao';
import TabDespesas from './lote/TabDespesas';
import TabReceitas from './lote/TabReceitas';

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
          statusMap[makeStableId(isViveiro ? 'viveiro' : 'default', row.etapa)] =
            { status: row.status, data: row.data_execucao };
        });
        customDb.forEach((row) => {
          // Use hash-based ID (must match CronogramaTimeline / buildStatusFromDbRows)
          const cid = makeCustomId(row.etapa, row.dia_previsto);
          statusMap[cid] = { status: row.status, data: row.data_execucao };
          custom.push({ dia: row.dia_previsto, etapa: row.etapa, produto: row.produto || '',
            dose: row.dose || '', forma: row.forma_aplicacao || '', tipo: row.tipo || 'manejo',
            _stableId: cid });
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
    const st           = doneStatus[makeStableId('default', etapa.etapa)]; // fixed: was default_${i}
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
    const cid = row._stableId || makeCustomId(row.etapa, row.dia);
    const st = doneStatus[cid];
    colheitas.push({
      id:         cid,
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

// ─── Main LotePage ──────────────────────────────────────────────────────────

const TABS = [
  { value: 'cronograma', label: 'Cronograma', Icon: CalendarDays },
  { value: 'colheita',   label: 'Colheita',   Icon: TrendingUp },
  { value: 'producao',   label: 'Produção',   Icon: Sprout },
  { value: 'receitas',   label: 'Receitas',   Icon: DollarSign },
  { value: 'despesas',   label: 'Despesas',   Icon: Receipt },
  { value: 'diario',     label: 'Diário',     Icon: BookOpen },
];

export default function LotePage({ lote, cultura, onBack, userRole = null, propriedade = null }) {
  const canDelete = can(userRole, FARM_ACTIONS.DELETE_ANY);
  const toast = useToast();
  const [tab, setTab] = useState('cronograma');
  const [concluindo, setConcluindo] = useState(false);
  const [concluido, setConcluido] = useState(lote.status === 'concluido');
  const cor = cultura.cor;

  const lc = resolveLifecycle(lote, cultura);
  const { diasDecorridos, progresso: cycleProgressPct, diasPrimeiraProducao: cicloDias, prontoParaColheita } = lc;
  const cycleProgress = cycleProgressPct / 100;

  // Curva de produção
  const { curves: curvasProducao } = useCurvasProducao();
  const anoRelativo = lote.data_plantio
    ? Math.floor((Date.now() - new Date(lote.data_plantio + 'T12:00:00').getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;
  // Producao plena estimada: usa dados da cultura (campo = kg/ha * area, canteiro = kg/m²)
  const producaoPlena = (() => {
    const area = cultura.tipo === 'campo'
      ? (parseFloat(lote.area_ha) || cultura.area?.padrao || 1)
      : ((parseFloat(lote.comprimento_m) || cultura.canteiro?.comprimento || 1) *
         (parseFloat(lote.largura_m)     || cultura.canteiro?.largura    || 1));
    if (cultura.venda?.producaoKgPorHa)  return Math.round(cultura.venda.producaoKgPorHa * area);
    if (cultura.venda?.producaoKgPorM2)  return Math.round(cultura.venda.producaoKgPorM2 * area);
    if (cultura.venda?.producaoBase)     return cultura.venda.producaoBase;
    return null;
  })();

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
      if (vendas.length === 0) {
        const ok = window.confirm(
          'Este lote não possui receitas registradas. Deseja concluir mesmo assim?'
        );
        if (!ok) return; // finally will reset setConcluindo
      }
      // A4-12: arquivarCicloLote retorna null em falha; não marcar como concluído
      // se o histórico não foi salvo no Supabase.
      const arquivado = await arquivarCicloLote(lote, vendas, despesas, movimentos, maoObraRegistros);
      if (!arquivado) {
        toast.error('Não foi possível arquivar o ciclo no histórico. O lote NÃO foi marcado como concluído. Tente novamente.');
        return; // finally resets setConcluindo
      }
      // updateLoteStatus inside try so any throw is caught.
      // Verifica o retorno: se a atualização falhar no banco, NÃO marca como
      // concluído na UI (evita estado inconsistente UI×DB).
      const atualizado = await updateLoteStatus(lote.id, 'concluido');
      if (!atualizado) {
        toast.error('O ciclo foi arquivado, mas não foi possível marcar o lote como concluído. Tente novamente.');
        return;
      }
      setConcluido(true);
    } catch {
      toast.error('Erro ao concluir lote. O ciclo pode não ter sido arquivado. Tente novamente.');
    } finally {
      // Always reset spinner, whether success, early return, or error
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
                {concluindo ? 'Concluindo…' : lote.tipo_cultura === 'perene' ? 'Concluir Safra' : 'Concluir Lote'}
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
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-white/55 text-[11px] font-semibold leading-none">{cultura.nome}</p>
                {lote.tipo_cultura === 'perene' && lote.safra_numero && (
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none"
                    style={{ background: 'rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.85)' }}>
                    Safra {lote.safra_numero}
                  </span>
                )}
              </div>
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
            <div className="flex flex-col gap-4">
              {/* Curva de produção — mostra a maturação da cultura ao longo dos anos */}
              <CurvaProducaoChart
                culturaId={cultura.id}
                culturaNome={cultura.nome}
                culturaCor={cultura.cor}
                curves={curvasProducao}
                anoAtual={anoRelativo}
                producaoPlena={producaoPlena}
                totalPlantas={lote.total_plantas}
              />
              <CronogramaTimeline cultura={cultura} lotes={[lote]} propriedadeId={lote.propriedade_id ?? null} />
            </div>
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
          {tab === 'producao' && (
            <TabProducao lote={lote} cultura={cultura} />
          )}
          {tab === 'diario' && (
            <TabDiario lote={lote} canDelete={canDelete} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
