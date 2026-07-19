import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CULTURAS } from '../data/culturas';
import { loadTodosLotes, loadPropriedades } from '../hooks/useSupabaseSync';
import { loadEstoque } from '../hooks/useGestao';
import { useCronogramaStatusBatch, makeStableId } from '../hooks/useCronogramaSync';
import { resolveLifecycle, fmtDateBR, fmtDiasRestantes, getFaseColor } from '../lib/lifecycle';
import { Plus, CalendarDays, Sprout, CheckCircle2, Layers, AlertCircle, Clock, ArrowRight, Leaf, Building2, ChevronRight, AlertTriangle } from 'lucide-react';
import Logo from './Logo';



/** doneStatus is passed in — never read from localStorage directly */
function getStatusEtapas(cultura, lote, doneStatus = {}) {
  if (!cultura?.cronograma) return { atrasadas: 0, hoje: null, amanha: null, proxima: null };
  try {
    const diasDecorridosRaw = Math.floor(
      (Date.now() - new Date(lote.data_plantio + 'T12:00:00')) / 86_400_000
    );
    const isLoteFuturo = diasDecorridosRaw < 0;
    const metodoObj = lote.metodo_propagacao && cultura.metodosPropagacao
      ? cultura.metodosPropagacao.find(m => m.key === lote.metodo_propagacao) ?? null
      : null;
    const shift = metodoObj?.diasViveiro ?? 0;

    const steps = [
      // I-01: use slug-based stable IDs (matches CronogramaTimeline post-migration)
      ...(metodoObj?.etapasViveiro?.map(e => ({
        ...e,
        _id: makeStableId('viveiro', e.etapa),
        done: doneStatus[makeStableId('viveiro', e.etapa)]?.status === 'feito',
      })) ?? []),
      ...cultura.cronograma.map(e => ({
        ...e,
        dia: e.dia + shift,
        _id: makeStableId('default', e.etapa),
        done: doneStatus[makeStableId('default', e.etapa)]?.status === 'feito',
      })),
    ].filter(s => doneStatus[s._id]?.status !== 'removida');
    const pending = steps.filter(s => !s.done);
    const atrasadas = isLoteFuturo ? 0 : pending.filter(s => s.dia < diasDecorridosRaw).length;
    const hoje      = isLoteFuturo ? null : (pending.find(s => s.dia === diasDecorridosRaw) || null);
    const amanha    = isLoteFuturo ? null : (pending.find(s => s.dia === diasDecorridosRaw + 1) || null);
    const proxima   = pending.find(s => s.dia > Math.max(0, diasDecorridosRaw) + 1) || null;
    return { atrasadas, hoje, amanha, proxima };
  } catch { return { atrasadas: 0, hoje: null, amanha: null, proxima: null }; }
}

// ── Lot card ─────────────────────────────────────────────────────────────────

function LoteCard({ lote, onSelect, index, doneStatus = {} }) {
  const cultura = CULTURAS[lote.cultura_id];
  if (!cultura) return null;

  const cor = cultura.cor;
  let lc;
  try { lc = resolveLifecycle(lote, cultura); }
  catch { return null; } // lote com data_plantio inválida não quebra o Dashboard
  const { diasDecorridos, progresso, prontoParaColheita, diasParaColheita,
          faseAtual, faseIndex, dataPrimeiraProducao } = lc;

  const isCampo = cultura.tipo === 'campo';
  const dimensao = isCampo
    ? `${lote.area_ha ?? '?'} ha`
    : lote.comprimento_m && lote.largura_m
      ? `${lote.comprimento_m}×${lote.largura_m} m`
      : '—';

  const faseColor = faseAtual ? getFaseColor(faseIndex) : null;

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.055, 0.32), duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      onClick={() => onSelect(lote)}
      className="card-interactive w-full text-left p-4"
      style={{ borderLeft: `3px solid ${cor}` }}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ background: `${cor}15` }}>
          {cultura.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[14px] font-bold text-foreground leading-tight truncate">{lote.nome}</p>
            {prontoParaColheita ? (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1"
                style={{ background: '#dcfce7', color: '#16a34a' }}>
                <CheckCircle2 size={9} /> Colheita
              </span>
            ) : faseAtual && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1"
                style={{ background: faseColor.bg, color: faseColor.text }}>
                <Leaf size={9} /> {faseAtual}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[11px] text-muted-foreground font-medium">{cultura.nome}</span>
            <span className="text-[11px] text-muted-foreground">{dimensao}</span>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <CalendarDays size={9} style={{ color: cor }} />
              {new Date(lote.data_plantio + 'T12:00:00').toLocaleDateString('pt-BR')}
            </span>
          </div>
        </div>
        <div className="flex-shrink-0 text-right ml-1">
          <p className="text-[13px] font-black leading-none" style={{ color: cor }}>D{diasDecorridos}</p>
          <p className="text-[9px] text-muted-foreground mt-0.5">
            {prontoParaColheita ? 'pronto' : `${diasParaColheita}d`}
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 mb-2.5 flex-wrap">
        <span className="text-[11px] text-muted-foreground">
          {(lote.total_plantas || 0).toLocaleString('pt-BR')} plantas
        </span>
        <span className="text-[10px] text-muted-foreground opacity-50">·</span>
        <span className="text-[11px] font-bold" style={{ color: prontoParaColheita ? '#16a34a' : cor }}>
          {progresso}% até 1ª colheita
        </span>
        {!prontoParaColheita && (
          <>
            <span className="text-[10px] text-muted-foreground opacity-50">·</span>
            <span className="text-[11px] text-muted-foreground">
              {fmtDiasRestantes(diasParaColheita)}
            </span>
          </>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'hsl(210 16% 93%)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${progresso}%`, background: prontoParaColheita ? '#16a34a' : cor }}
        />
      </div>

      {/* ── Próxima etapa / alertas ── */}
      {!prontoParaColheita && (() => {
        const { atrasadas, hoje, amanha, proxima } = getStatusEtapas(cultura, lote, doneStatus);
        if (!atrasadas && !hoje && !amanha && !proxima) return null;
        return (
          <div className="mt-2.5 pt-2.5 flex flex-wrap gap-1.5"
            style={{ borderTop: '1px solid hsl(214 20% 92%)' }}>
            {atrasadas > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: '#fee2e2', color: '#dc2626' }}>
                <AlertCircle size={9} /> {atrasadas} atrasada{atrasadas > 1 ? 's' : ''}
              </span>
            )}
            {hoje && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: '#fff7ed', color: '#ea580c' }}>
                <Clock size={9} /> Hoje: {hoje.etapa}
              </span>
            )}
            {amanha && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: '#dbeafe', color: '#2563eb' }}>
                ↗ Amanhã: {amanha.etapa}
              </span>
            )}
            {!hoje && !amanha && proxima && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: 'hsl(210 16% 93%)', color: 'hsl(215 16% 45%)' }}>
                <ArrowRight size={9} /> {proxima.etapa} · D{proxima.dia}
              </span>
            )}
          </div>
        );
      })()}
    </motion.button>
  );
}

// ── PropriedadeCard ───────────────────────────────────────────────────────────

function PropriedadeCard({ propriedade, lotes, alertasCount, onSelect, index }) {
  const lotesDaProp = lotes.filter(l => l.propriedade_id === propriedade.id);
  const ativos = lotesDaProp.filter(l => {
    const c = CULTURAS[l.cultura_id];
    return c && !resolveLifecycle(l, c).prontoParaColheita;
  });
  const prontos = lotesDaProp.filter(l => {
    const c = CULTURAS[l.cultura_id];
    return c && resolveLifecycle(l, c).prontoParaColheita;
  });

  let diasParaMaisUrgente = Infinity;
  ativos.forEach(l => {
    const c = CULTURAS[l.cultura_id];
    if (c) {
      const { diasParaColheita } = resolveLifecycle(l, c);
      if (diasParaColheita < diasParaMaisUrgente) diasParaMaisUrgente = diasParaColheita;
    }
  });

  // Derived info from lotes
  const areaTotal = lotesDaProp.reduce((s, l) => s + (parseFloat(l.area_ha) || 0), 0);
  const culturaIds = [...new Set(lotesDaProp.map(l => l.cultura_id).filter(Boolean))];
  const culturasNomes = culturaIds.map(id => CULTURAS[id]).filter(Boolean).map(c => `${c.emoji} ${c.nome}`);
  const dataCadastro = propriedade.created_at
    ? new Date(propriedade.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null;

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.055, 0.32), duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      onClick={() => onSelect(propriedade)}
      className="card-interactive w-full text-left p-4"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'hsl(157 68% 26% / 0.1)' }}>
          <Building2 size={18} style={{ color: 'hsl(157 68% 26%)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[14px] font-bold text-foreground leading-tight truncate">{propriedade.nome}</p>
            {alertasCount > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                style={{ background: '#fee2e2', color: '#dc2626' }}>
                <AlertTriangle size={9} /> {alertasCount}
              </span>
            )}
          </div>
          {propriedade.descricao && (
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{propriedade.descricao}</p>
          )}
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="text-[11px] text-muted-foreground">{lotesDaProp.length} lote{lotesDaProp.length !== 1 ? 's' : ''}</span>
            {ativos.length > 0 && (
              <span className="text-[11px] text-muted-foreground">{ativos.length} ativo{ativos.length !== 1 ? 's' : ''}</span>
            )}
            {prontos.length > 0 && (
              <span className="text-[11px] font-bold" style={{ color: '#16a34a' }}>
                {prontos.length} pronto{prontos.length !== 1 ? 's' : ''} p/ colheita
              </span>
            )}
            {diasParaMaisUrgente < Infinity && (
              <span className="text-[11px] text-muted-foreground">
                próx. colheita: {fmtDiasRestantes(diasParaMaisUrgente)}
              </span>
            )}
          </div>

          {/* Property info grid */}
          {lotesDaProp.length > 0 && (
            <div className="mt-2 pt-2 flex flex-wrap gap-x-3 gap-y-1"
              style={{ borderTop: '1px solid hsl(214 20% 93%)' }}>
              {areaTotal > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span style={{ color: 'hsl(157 68% 26%)' }}>⬛</span>
                  {areaTotal.toFixed(1)} ha cultivados
                </span>
              )}
              {culturasNomes.length > 0 && (
                <span className="text-[10px] text-muted-foreground truncate max-w-[160px]">
                  {culturasNomes.slice(0, 2).join(', ')}{culturasNomes.length > 2 ? ` +${culturasNomes.length - 2}` : ''}
                </span>
              )}
              {dataCadastro && (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <CalendarDays size={9} style={{ color: 'hsl(157 68% 26%)' }} />
                  Desde {dataCadastro}
                </span>
              )}
            </div>
          )}
        </div>
        <ChevronRight size={16} className="opacity-30 flex-shrink-0 mt-1" />
      </div>
    </motion.button>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyLotes({ onAdd }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="card p-8 flex flex-col items-center gap-3 text-center"
    >
      <div className="icon-circle w-16 h-16 text-3xl"
        style={{ background: 'hsl(157 68% 26% / 0.1)' }}>
        <Layers size={24} style={{ color: 'hsl(157 68% 26%)' }} />
      </div>
      <div>
        <p className="text-[14px] font-bold text-foreground">Nenhum lote cadastrado</p>
        <p className="text-[12px] text-muted-foreground mt-1">
          Comece registrando seu primeiro lote de plantio
        </p>
      </div>
      <button
        onClick={onAdd}
        className="mt-1 flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[13px] font-bold text-white transition-all active:scale-[0.98]"
        style={{ background: 'hsl(157 68% 26%)' }}
      >
        <Plus size={15} /> Novo Lote
      </button>
    </motion.div>
  );
}

// ── AlertasUrgencias ──────────────────────────────────────────────────────────

const DISMISS_PREFIX = 'alerta_dismiss_';

function isDismissed(id) {
  try {
    const val = localStorage.getItem(DISMISS_PREFIX + id);
    if (!val) return false;
    return Date.now() - Number(val) < 24 * 60 * 60 * 1000; // 24h
  } catch { return false; }
}

function dismissAlerta(id) {
  try { localStorage.setItem(DISMISS_PREFIX + id, String(Date.now())); } catch {}
}

/**
 * Compute alertas from lotes + statusByLote without any extra queries.
 * Returns array of { id, level, text, emoji, lote }
 */
function computeAlertas(lotes, statusByLote) {
  const alertas = [];
  const now = Date.now();

  lotes.forEach(lote => {
    if (lote.status !== 'ativo') return;
    const cultura = CULTURAS[lote.cultura_id];
    if (!cultura) return;

    let lc;
    try { lc = resolveLifecycle(lote, cultura); } catch { return; }

    const { diasDecorridos, prontoParaColheita } = lc;
    const doneStatus = statusByLote[lote.id] || {};

    // ── 1. Lotes com etapas atrasadas ──────────────────────────────────────
    if (!prontoParaColheita && diasDecorridos >= 0) {
      const metodoObj = lote.metodo_propagacao && cultura.metodosPropagacao
        ? cultura.metodosPropagacao.find(m => m.key === lote.metodo_propagacao) ?? null
        : null;
      const shift = metodoObj?.diasViveiro ?? 0;

      // Para etapas viveiro: o useCronogramaStatusBatch salva com prefixo 'default_'
      // (BUG-5 — não recebe vivSteps). Checamos ambos os prefixos para não gerar
      // falsos alertas em etapas já concluídas.
      const getStepStatus = (id, etapa) => {
        return doneStatus[id] || doneStatus[makeStableId('default', etapa)] || null;
      };

      const steps = [
        ...(metodoObj?.etapasViveiro?.map(e => ({
          ...e,
          _id: makeStableId('viveiro', e.etapa),
        })) ?? []),
        ...cultura.cronograma.map(e => ({
          ...e,
          dia: e.dia + shift,
          _id: makeStableId('default', e.etapa),
        })),
      ].filter(s => {
        const st = getStepStatus(s._id, s.etapa);
        return st?.status !== 'removida';
      });

      const atrasadas = steps.filter(s => {
        // Só alertar se:
        // 1. A etapa é do PASSADO (dia < diasDecorridos)
        // 2. O status NÃO é 'feito' nem 'removida' (inclui undefined — não carregado = pendente)
        // NÃO usar !st sozinho pois isso inclui etapas futuras sem status
        if (s.dia >= diasDecorridos) return false; // etapa futura → não é alerta
        const st = getStepStatus(s._id, s.etapa)?.status;
        return st !== 'feito' && st !== 'removida';
      });

      atrasadas.forEach(step => {
        const diasAtraso = diasDecorridos - step.dia;
        if (diasAtraso <= 0) return; // sanity check: não gerar alertas com 0 ou menos dias
        const id = `etapa_atrasada_${lote.id}_${step._id}`;
        if (isDismissed(id)) return;
        alertas.push({
          id,
          level: diasAtraso > 3 ? 'vermelho' : 'amarelo',
          text: `${cultura.emoji} ${lote.nome} — etapa "${step.etapa}" atrasada ${diasAtraso} dia${diasAtraso !== 1 ? 's' : ''}`,
          emoji: cultura.emoji,
          lote,
          diasAtraso,
        });
      });
    }

    // ── 2. Colheita pronta sem venda ────────────────────────────────────────
    if (prontoParaColheita) {
      // Estimate how many days the lote has been ready by checking diasDecorridos vs expected harvest day
      // Use the last cronograma step's dia as reference for readiness
      const colheitaStep = cultura.cronograma.find(e =>
        e.tipo === 'colheita' || e.etapa?.toLowerCase().includes('colheita')
      );
      const metodoObj = lote.metodo_propagacao && cultura.metodosPropagacao
        ? cultura.metodosPropagacao.find(m => m.key === lote.metodo_propagacao) ?? null
        : null;
      const shift = metodoObj?.diasViveiro ?? 0;
      const diasColheita = colheitaStep ? (colheitaStep.dia + shift) : (lc.diasPrimeiraProducao ?? diasDecorridos);
      const diasPronto = Math.max(0, diasDecorridos - diasColheita);

      const id = `colheita_pronta_${lote.id}`;
      if (!isDismissed(id)) {
        alertas.push({
          id,
          level: diasPronto > 5 ? 'vermelho' : 'amarelo',
          text: `${cultura.emoji} ${lote.nome} pronto para colheita${diasPronto > 0 ? ` há ${diasPronto} dia${diasPronto !== 1 ? 's' : ''}` : ' hoje'}`,
          emoji: cultura.emoji,
          lote,
          diasPronto,
        });
      }
    }
  });

  // Sort: vermelho first, then by severity within each group
  alertas.sort((a, b) => {
    if (a.level !== b.level) return a.level === 'vermelho' ? -1 : 1;
    const aNum = a.diasAtraso ?? a.diasPronto ?? 0;
    const bNum = b.diasAtraso ?? b.diasPronto ?? 0;
    return bNum - aNum;
  });

  return alertas;
}

function AlertasUrgencias({ lotes, statusByLote, onSelectLote }) {
  const [dismissed, setDismissed] = useState(0); // counter to force re-render on dismiss

  const alertas = useMemo(
    () => computeAlertas(lotes, statusByLote),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lotes, statusByLote, dismissed]
  );

  if (alertas.length === 0) return null;

  const temVermelho = alertas.some(a => a.level === 'vermelho');

  const handleDismiss = (e, id) => {
    e.stopPropagation();
    dismissAlerta(id);
    setDismissed(d => d + 1);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="mb-5"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <p className="section-label flex-1">⚠️ Alertas</p>
        <span
          className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white"
          style={{ background: temVermelho ? '#dc2626' : '#d97706' }}
        >
          {alertas.length}
        </span>
      </div>

      {/* Card */}
      <div
        className="rounded-2xl overflow-hidden divide-y"
        style={{
          background: temVermelho ? '#fff5f5' : '#fffbeb',
          border: `1px solid ${temVermelho ? '#fecaca' : '#fde68a'}`,
        }}
      >
        <AnimatePresence initial={false}>
          {alertas.map((alerta) => (
            <motion.div
              key={alerta.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22 }}
              className="flex items-center gap-3 px-4 py-3"
              style={{ borderBottom: '1px solid transparent' }}
            >
              {/* Level indicator dot */}
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: alerta.level === 'vermelho' ? '#dc2626' : '#d97706' }}
              />

              {/* Text */}
              <p className="flex-1 text-[12px] font-medium leading-snug"
                style={{ color: alerta.level === 'vermelho' ? '#7f1d1d' : '#78350f' }}>
                {alerta.text}
              </p>

              {/* Action buttons */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => onSelectLote(alerta.lote)}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-xl transition-all active:scale-[0.95]"
                  style={{
                    background: alerta.level === 'vermelho' ? '#dc2626' : '#d97706',
                    color: '#fff',
                  }}
                >
                  Ver →
                </button>
                <button
                  onClick={(e) => handleDismiss(e, alerta.id)}
                  className="text-[10px] font-semibold px-2 py-1 rounded-xl transition-all active:scale-[0.95]"
                  style={{
                    background: alerta.level === 'vermelho' ? '#fecaca' : '#fde68a',
                    color: alerta.level === 'vermelho' ? '#991b1b' : '#92400e',
                  }}
                  title="Dispensar por 24h"
                >
                  ✕
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

// ── EstaSemanaSection ─────────────────────────────────────────────────────────

function EstaSemanaSection({ lotes, statusByLote = {} }) {
  const [collapsed, setCollapsed] = useState(false);

  const hoje = new Date();
  const em7dias = new Date(hoje.getTime() + 7 * 86_400_000);

  // Collect all upcoming steps in the next 7 days across all lotes
  const itens = [];
  lotes.forEach(lote => {
    const cultura = CULTURAS[lote.cultura_id];
    if (!cultura?.cronograma) return;
    try {
      const dataPlantio = new Date(lote.data_plantio + 'T12:00:00');
      // Use Supabase-loaded status (already includes localStorage fallback from hook)
      const doneStatus = statusByLote[lote.id] || {};
      const metodoObj = lote.metodo_propagacao && cultura.metodosPropagacao
        ? cultura.metodosPropagacao.find(m => m.key === lote.metodo_propagacao) ?? null
        : null;
      const shift = metodoObj?.diasViveiro ?? 0;

      const steps = [
        ...(metodoObj?.etapasViveiro?.map(e => ({ ...e, _id: makeStableId('viveiro', e.etapa) })) ?? []),
        ...cultura.cronograma.map(e => ({ ...e, dia: e.dia + shift, _id: makeStableId('default', e.etapa) })),
      ];

      steps.forEach(step => {
        const st = doneStatus[step._id]?.status;
        if (st === 'feito' || st === 'removida') return;
        const dataEtapa = new Date(dataPlantio.getTime() + step.dia * 86_400_000);
        if (dataEtapa >= hoje && dataEtapa <= em7dias) {
          itens.push({ lote, cultura, etapa: step.etapa, data: dataEtapa, dia: step.dia });
        }
      });
    } catch { /* ignore */ }
  });

  // Sort by date (most urgent first)
  itens.sort((a, b) => a.data - b.data);

  if (lotes.length === 0) return null;

  return (
    <div className="mb-5">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="flex items-center gap-2 mb-3 w-full text-left"
      >
        <p className="section-label flex-1">📅 Esta Semana</p>
        <span className="text-[10px] text-muted-foreground">{collapsed ? 'mostrar' : 'ocultar'}</span>
      </button>

      {!collapsed && (
        <div className="card overflow-hidden">
          {itens.length === 0 ? (
            <p className="px-4 py-4 text-[12px] text-muted-foreground text-center">
              Nenhuma atividade nos próximos 7 dias
            </p>
          ) : (
            <div className="divide-y" style={{ divideColor: 'hsl(214 20% 92%)' }}>
              {itens.map((item, idx) => {
                const diasRestam = Math.ceil((item.data - hoje) / 86_400_000);
                const isHoje = diasRestam === 0;
                const isAmanha = diasRestam === 1;
                const cor = item.cultura.cor;
                return (
                  <div key={`${item.lote.id}_${item.etapa}_${idx}`}
                    className="flex items-center gap-3 px-4 py-3"
                    style={{ borderBottom: idx < itens.length - 1 ? '1px solid hsl(214 20% 92%)' : 'none' }}
                  >
                    <span className="text-[18px] flex-shrink-0">{item.cultura.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold text-foreground truncate">{item.lote.nome}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{item.etapa}</p>
                    </div>
                    <span
                      className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={
                        isHoje
                          ? { background: '#fff7ed', color: '#ea580c' }
                          : isAmanha
                            ? { background: '#dbeafe', color: '#2563eb' }
                            : { background: `${cor}15`, color: cor }
                      }
                    >
                      {isHoje ? 'Hoje' : isAmanha ? 'Amanhã' : item.data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Dashboard({ onAddLote, onSelectLote, onSelectPropriedade, onManagePropriedades, onSignOut, onGoSettings, userName }) {
  const [lotes, setLotes]                   = useState([]);
  const [propriedades, setPropriedades]     = useState([]);
  const [alertasPorProp, setAlertasPorProp] = useState({});
  const [loading, setLoading]               = useState(true);
  const [refreshKey, setRefreshKey]         = useState(0);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadTodosLotes(100),
      loadPropriedades(),
      loadEstoque(),
    ]).then(([ls, props, insumos]) => {
      setLotes(ls);
      setPropriedades(props);
      const alerts = {};
      insumos.forEach(i => {
        if (i.propriedade_id && i.quantidade <= i.quantidade_minima && i.quantidade_minima > 0) {
          alerts[i.propriedade_id] = (alerts[i.propriedade_id] || 0) + 1;
        }
      });
      setAlertasPorProp(alerts);
      setLoading(false);
    }).catch(err => {
      console.error('[Dashboard] loadData error:', err);
      setLoading(false);
    });
  }, [refreshKey]);

  // ── Cronograma status — Supabase as source of truth ──────────────────────────
  const loteIds = useMemo(() => lotes.map(l => l.id), [lotes]);
  const { statusByLote } = useCronogramaStatusBatch(loteIds);

  const lotesOrfaos = lotes.filter(l => !l.propriedade_id);

  return (
    <div className="min-h-screen bg-background">
      {/* ── Hero ── */}
      <div className="gradient-hero relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 left-1/4 w-40 h-40 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%)' }} />
        <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none select-none opacity-[0.06]">
          <Sprout size={120} color="white" />
        </div>

        {/* pt usa var(--hero-pad-top) para iniciar abaixo do hamburger + sino flutuantes */}
        <div className="relative z-10 px-5 pb-6" style={{ paddingTop: 'var(--hero-pad-top)' }}>
          <div className="flex items-center gap-3 mb-4 pr-24">
            {/* pr-24 reserva espaço à direita para os botões flutuantes */}
            <Logo size={40} className="flex-shrink-0" style={{ borderRadius: 10 }} />
            <div className="min-w-0">
              <p className="text-white/60 text-xs font-medium truncate">
                {userName ? `Olá, ${userName}` : 'Guia Hortícola'}
              </p>
              <h1 className="font-display text-white text-xl font-extrabold leading-tight">OryAgro</h1>
            </div>
          </div>

          {/* Stats */}
          <div className="glass rounded-2xl p-4 mb-3" style={{ borderColor: 'rgba(255,255,255,0.18)' }}>
            <div className="grid grid-cols-3 divide-x" style={{ divideColor: 'rgba(255,255,255,0.15)' }}>
              <div className="pr-4">
                <p className="font-display text-white text-2xl font-black leading-none">{loading ? '…' : propriedades.length}</p>
                <p className="text-white/55 text-[10px] font-semibold uppercase tracking-widest mt-0.5">Propriedades</p>
              </div>
              <div className="px-4">
                <p className="font-display text-white text-2xl font-black leading-none">{loading ? '…' : lotes.length}</p>
                <p className="text-white/55 text-[10px] font-semibold uppercase tracking-widest mt-0.5">Lotes</p>
              </div>
              <div className="pl-4">
                <p className="font-display text-white text-2xl font-black leading-none text-emerald-300">
                  {loading ? '…' : lotes.filter(l => {
                    const c = CULTURAS[l.cultura_id];
                    return c && resolveLifecycle(l, c).prontoParaColheita;
                  }).length}
                </p>
                <p className="text-white/55 text-[10px] font-semibold uppercase tracking-widest mt-0.5">P/ Colheita</p>
              </div>
            </div>
          </div>

          {/* Manage properties */}
          <button onClick={onManagePropriedades}
            className="glass w-full flex items-center justify-center gap-2 py-3 rounded-xl transition-all active:scale-[0.98]"
            style={{ borderColor: 'rgba(255,255,255,0.22)' }}>
            <Building2 size={15} color="white" />
            <span className="text-white text-[13px] font-bold">Gerenciar Propriedades</span>
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-4 pt-5 pb-4 max-w-2xl mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground text-[13px]">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              className="w-4 h-4 rounded-full border-2"
              style={{ borderColor: 'hsl(157 68% 26% / 0.4)', borderTopColor: 'hsl(157 68% 26%)' }} />
            Carregando…
          </div>
        ) : propriedades.length === 0 && lotes.length === 0 ? (
          <EmptyLotes onAdd={onManagePropriedades} />
        ) : (
          <>
            <AlertasUrgencias lotes={lotes} statusByLote={statusByLote} onSelectLote={onSelectLote} />
            <EstaSemanaSection lotes={lotes} statusByLote={statusByLote} />

            {propriedades.length > 0 && (
              <div className="mb-5">
                <p className="section-label mb-3 px-1">Suas propriedades</p>
                <div className="space-y-3">
                  {propriedades.map((p, i) => (
                    <PropriedadeCard key={p.id} propriedade={p} lotes={lotes} alertasCount={alertasPorProp[p.id] || 0} onSelect={onSelectPropriedade} index={i} />
                  ))}
                </div>
              </div>
            )}

            {lotesOrfaos.length > 0 && (
              <div>
                <p className="section-label mb-3 px-1 text-muted-foreground">Sem propriedade ({lotesOrfaos.length})</p>
                <div className="space-y-3">
                  {lotesOrfaos.map((l, i) => (
                    <LoteCard key={l.id} lote={l} onSelect={onSelectLote} index={i} doneStatus={statusByLote[l.id]} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
