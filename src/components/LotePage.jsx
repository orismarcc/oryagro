import React, { useState } from 'react';
import { useToast } from '../context/ToastContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, CalendarDays, Sprout, TrendingUp,
  Cloud, CheckCircle2, AlertTriangle,
  ClipboardList, Wallet, Info, BookOpen, ChevronRight,
} from 'lucide-react';
import TabRegistros from './lote/TabRegistros';
import CurvaProducaoChart from './CurvaProducaoChart';
import { useCurvasProducao } from '../hooks/useCurvasProducao';
import { useWeather } from '../hooks/useWeather';
import { resolveLifecycle } from '../lib/lifecycle';
import {
  loadVendas,
  updateLoteStatus,
  arquivarCicloLote,
  loadMaoObraRegistros,
} from '../hooks/useGestao';
import { loadDespesasByLote } from '../hooks/useDespesas';
import { registrarPlantio } from '../hooks/useSupabaseSync';
import { can, FARM_ACTIONS } from '../lib/permissions';
import { formatDatePtBR, fmtNumber, today } from './lote/shared';
import TabProducao from './lote/TabProducao';
import IrrigacaoPanel from './IrrigacaoPanel';
import TalhaoMapPreview from './TalhaoMapPreview';
import CroquiGenerator from './CroquiGenerator';
import { geojsonToPoints } from '../lib/geo';
import IrrigacaoKitForm from './IrrigacaoKitForm';
import TabDespesas from './lote/TabDespesas';
import TabReceitas from './lote/TabReceitas';

// ─── WeatherWidget ──────────────────────────────────────────────────────────

function WeatherWidget({ cidade, estado }) {
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

// ─── Finanças: despesas e receitas do lote, lado a lado ─────────────────────

function TabFinancas({ lote, cultura, cor, canDelete }) {
  const [sub, setSub] = useState('despesas');
  return (
    <div>
      <div className="px-4 pt-4">
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'hsl(140 14% 93%)' }}>
          {[['despesas', '💸 Despesas'], ['receitas', '💰 Receitas']].map(([v, lbl]) => (
            <button key={v} onClick={() => setSub(v)}
              className="flex-1 py-2 rounded-lg text-[12.5px] font-bold transition-all"
              style={sub === v ? { background: '#fff', color: cor, boxShadow: '0 1px 3px rgb(0 0 0 / 0.08)' } : { color: 'hsl(150 8% 40%)' }}>
              {lbl}
            </button>
          ))}
        </div>
      </div>
      {sub === 'despesas'
        ? <TabDespesas lote={lote} cor={cor} canDelete={canDelete} />
        : <TabReceitas cultura={cultura} lote={lote} canDelete={canDelete} />}
    </div>
  );
}

function Dado({ lbl, v }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{lbl}</p>
      <p className="font-semibold text-foreground truncate">{v}</p>
    </div>
  );
}

// ─── Main LotePage ──────────────────────────────────────────────────────────

// 4 abas: o que se faz (Registros), o que se colhe, o dinheiro e os dados do lote.
// (Antes eram 7: Cronograma, Colheita, Produção, Caderno, Receitas, Despesas, Diário.)
const TABS = [
  { value: 'registros', label: 'Registros', Icon: ClipboardList },
  { value: 'colheita',  label: 'Colheita',  Icon: TrendingUp },
  { value: 'financas',  label: 'Finanças',  Icon: Wallet },
  { value: 'lote',      label: 'Lote',      Icon: Info },
];

export default function LotePage({ lote, cultura, onBack, userRole = null, propriedade = null, onRepetido = null, onAbrirGuia = null }) {
  const canDelete = can(userRole, FARM_ACTIONS.DELETE_ANY);
  const toast = useToast();
  const [tab, setTab] = useState('registros');
  const [concluindo, setConcluindo] = useState(false);
  const [showKitForm, setShowKitForm] = useState(false);
  const [showCroqui, setShowCroqui] = useState(false);
  // sistema de irrigação instalado neste lote (cópia local p/ refletir após salvar)
  const [kitIrrigacao, setKitIrrigacao] = useState({
    irrigacao_tipo: lote.irrigacao_tipo,
    irrigacao_taxa_mm_h: lote.irrigacao_taxa_mm_h,
    irrigacao_vazao_emissor_lh: lote.irrigacao_vazao_emissor_lh,
    irrigacao_area_emissor_m2: lote.irrigacao_area_emissor_m2,
    irrigacao_eficiencia: lote.irrigacao_eficiencia,
  });
  const [concluido, setConcluido] = useState(lote.status === 'concluido');
  const [repetindo, setRepetindo] = useState(false);
  const cor = cultura.cor;

  const lc = resolveLifecycle(lote, cultura);
  const { diasDecorridos, progresso: cycleProgressPct, diasPrimeiraProducao: cicloDias } = lc;
  const cycleProgress = cycleProgressPct / 100;

  // Curva de produção
  const { curves: curvasProducao, getProductionFactor } = useCurvasProducao();
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

  // Meta de produção da safra ATUAL: produção plena ajustada pela curva de maturação.
  // Perenes crescem ano a ano (fator < 1 nos primeiros anos); anuais colhem a plena no ciclo.
  const fatorMaturacao = cultura.tipoCultura === 'perene' && anoRelativo != null
    ? getProductionFactor(cultura.id, anoRelativo)
    : 1;
  const producaoEstimadaPeriodo = producaoPlena != null
    ? Math.round(producaoPlena * fatorMaturacao)
    : null;

  const handleConcluir = async () => {
    if (!window.confirm('Marcar este lote como concluído? Isso arquivará o ciclo no histórico.')) return;
    setConcluindo(true);
    try {
      // Load all data needed for the archive summary in parallel
      const [vendas, despesas, maoObraRegistros] = await Promise.all([
        loadVendas(lote.id),
        loadDespesasByLote(lote.id),
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
      const arquivado = await arquivarCicloLote(lote, vendas, despesas, maoObraRegistros);
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

  // 📋 Repetir plantio: cria um novo lote copiando os dados do atual + as etapas
  // customizadas do cronograma. Útil para culturas anuais de ciclo curto (alface,
  // coentro) que são replantadas a cada 30–40 dias.
  const handleRepetir = async () => {
    if (!window.confirm(`Criar um novo plantio de ${cultura.nome} copiando área e espaçamento deste lote?`)) return;
    setRepetindo(true);
    try {
      // 1. Cria o novo plantio com data de hoje, copiando os atributos físicos.
      const baseNome = lote.nome.replace(/\s*\(\d+\)\s*$/, '').trim();
      const novo = await registrarPlantio({
        cultura_id:          lote.cultura_id,
        propriedade_id:      lote.propriedade_id ?? null,
        nome:                `${baseNome} (novo)`,
        data_plantio:        today(),
        status:              'ativo',
        area_ha:             lote.area_ha ?? null,
        comprimento_m:       lote.comprimento_m ?? null,
        largura_m:           lote.largura_m ?? null,
        total_plantas:       lote.total_plantas ?? null,
        espacamento_linhas:  lote.espacamento_linhas ?? null,
        espacamento_plantas: lote.espacamento_plantas ?? null,
        metodo_propagacao:   lote.metodo_propagacao ?? null,
      });
      if (!novo) { toast.error('Não foi possível criar o novo plantio.'); return; }

      // O cronograma do lote novo começa vazio: tudo é anotado pelo produtor.
      toast.success('Novo plantio criado!');
      if (onRepetido) onRepetido(novo);
      else onBack?.();
    } catch {
      toast.error('Erro ao repetir o plantio. Tente novamente.');
    } finally {
      setRepetindo(false);
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
              <div className="flex items-center gap-2">
                {/* Repetir plantio — só para culturas anuais (perenes usam Nova Safra) */}
                {canDelete && lote.tipo_cultura !== 'perene' && (
                  <button
                    onClick={handleRepetir}
                    disabled={repetindo}
                    className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all disabled:opacity-50"
                    style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)', border: '1px solid rgba(255,255,255,0.25)' }}
                  >
                    <Sprout size={12} />
                    {repetindo ? 'Criando…' : 'Repetir plantio'}
                  </button>
                )}
                <span className="flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-xl"
                  style={{ background: 'rgba(22,163,74,0.25)', color: '#86efac', border: '1px solid rgba(22,163,74,0.35)' }}>
                  <CheckCircle2 size={12} /> Concluído
                </span>
              </div>
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
          <WeatherWidget cidade={propriedade?.cidade} estado={propriedade?.estado} />
        </div>
      </div>

      {/* ── Sticky tab bar ──────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-20 px-4 py-2.5"
        style={{
          background: 'rgb(244, 246, 248)',
          borderBottom: '1px solid hsl(140 13% 88%)',
          transform: 'translateZ(0)',
        }}
      >
        <div
          className="flex gap-0.5 p-0.5 rounded-xl"
          style={{ background: 'hsl(140 14% 93%)' }}
        >
          {TABS.map(({ value, label, Icon }) => {
            const isActive = tab === value;
            return (
              <button
                key={value}
                onClick={() => setTab(value)}
                className="relative flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-[10px] text-[12px] font-semibold outline-none transition-colors duration-150"
                style={{ color: isActive ? '#fff' : 'hsl(150 8% 40%)' }}
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
          {tab === 'registros' && (
            <TabRegistros lote={lote} cultura={cultura} propriedade={propriedade} cor={cor} canDelete={canDelete} />
          )}
          {tab === 'colheita' && (
            <TabProducao
              lote={lote}
              cultura={cultura}
              producaoEstimadaPeriodo={producaoEstimadaPeriodo}
              producaoPlena={producaoPlena}
              anoRelativo={anoRelativo}
              fatorMaturacao={fatorMaturacao}
            />
          )}
          {tab === 'financas' && (
            <TabFinancas lote={lote} cultura={cultura} cor={cor} canDelete={canDelete} />
          )}
          {tab === 'lote' && (
            <div className="px-4 pt-4 flex flex-col gap-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 110px)' }}>
              {/* Dados do lote */}
              <div className="card p-4">
                <p className="section-label mb-3">Dados do lote</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[12.5px]">
                  <Dado lbl="Cultura" v={`${cultura.emoji} ${cultura.nome}`} />
                  <Dado lbl="Plantio" v={formatDatePtBR(lote.data_plantio)} />
                  <Dado lbl="Área" v={lote.area_ha ? `${fmtNumber(Number(lote.area_ha))} ha` : (lote.comprimento_m && lote.largura_m ? `${lote.comprimento_m}×${lote.largura_m} m` : '—')} />
                  <Dado lbl="Plantas" v={lote.total_plantas ? fmtNumber(lote.total_plantas) : '—'} />
                  <Dado lbl="Espaçamento" v={lote.espacamento_linhas && lote.espacamento_plantas ? `${lote.espacamento_linhas} × ${lote.espacamento_plantas} m` : '—'} />
                  <Dado lbl="Propagação" v={(cultura.metodosPropagacao || []).find(m => m.key === lote.metodo_propagacao)?.label || '—'} />
                  {propriedade?.nome && <Dado lbl="Propriedade" v={propriedade.nome} />}
                </div>
              </div>

              {/* Guia técnico da cultura (consulta) */}
              {onAbrirGuia && (
                <button onClick={() => onAbrirGuia(cultura.id)}
                  className="card p-4 flex items-center gap-3 text-left active:scale-[0.99] transition-transform">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${cor}15` }}>
                    <BookOpen size={18} style={{ color: cor }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-bold text-foreground">Guia técnico de {cultura.nome}</p>
                    <p className="text-[11.5px] text-muted-foreground">Doses, épocas e manejo recomendados — só para consulta</p>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground" />
                </button>
              )}

              {/* Recorte da área demarcada do lote (se houver) */}
              {geojsonToPoints(lote.geojson).length >= 3 && (
                <TalhaoMapPreview geojson={lote.geojson} areaHa={lote.area_gps_ha} cor={cor}
                  onCroqui={() => setShowCroqui(true)} />
              )}
              {/* Manejo de irrigação — usa a localização do lote (se demarcada) ou da propriedade */}
              <IrrigacaoPanel
                lat={lote.latitude ?? propriedade?.latitude} lon={lote.longitude ?? propriedade?.longitude}
                culturaId={cultura.id} culturaNome={cultura.nome}
                areaHa={parseFloat(lote.area_ha) || null}
                talhao={{ ...lote, ...kitIrrigacao }}
                onConfigurarKit={() => setShowKitForm(true)}
              />
              {/* Curva de produção — maturação da cultura ao longo dos anos */}
              <CurvaProducaoChart
                culturaId={cultura.id}
                culturaNome={cultura.nome}
                culturaCor={cultura.cor}
                curves={curvasProducao}
                anoAtual={anoRelativo}
                producaoPlena={producaoPlena}
                totalPlantas={lote.total_plantas}
              />
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {showKitForm && (
        <IrrigacaoKitForm
          entidade="lote"
          talhao={{ ...lote, ...kitIrrigacao }}
          onClose={() => setShowKitForm(false)}
          onSaved={(updated) => setKitIrrigacao({
            irrigacao_tipo: updated.irrigacao_tipo ?? null,
            irrigacao_taxa_mm_h: updated.irrigacao_taxa_mm_h ?? null,
            irrigacao_vazao_emissor_lh: updated.irrigacao_vazao_emissor_lh ?? null,
            irrigacao_area_emissor_m2: updated.irrigacao_area_emissor_m2 ?? null,
            irrigacao_eficiencia: updated.irrigacao_eficiencia ?? null,
          })}
        />
      )}

      {showCroqui && (
        <CroquiGenerator
          pontos={geojsonToPoints(lote.geojson)}
          culturaNome={cultura?.nome || 'Cultura'}
          cor={cor}
          onClose={() => setShowCroqui(false)}
        />
      )}
    </div>
  );
}
