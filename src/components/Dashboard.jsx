import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CULTURAS } from '../data/culturas';
import { loadTodosLotes, loadPropriedades } from '../hooks/useSupabaseSync';
import { loadEstoque } from '../hooks/useGestao';
import { useCronogramaStatusBatch } from '../hooks/useCronogramaSync';
import { resumoAgendados, STATUS, getCategoria } from '../hooks/useAtividades';
import { resolveLifecycle, fmtDiasRestantes, getFaseColor } from '../lib/lifecycle';
import { Plus, CalendarDays, Sprout, CheckCircle2, Layers, AlertCircle, Clock, ArrowRight, Leaf, Building2, ChevronRight, AlertTriangle } from 'lucide-react';
import Logo from './Logo';



const hojeISO = () => new Date().toISOString().slice(0, 10);

/** 'YYYY-MM-DD' → 'DD/MM' sem passar por UTC (evita perder um dia). */
function fmtDiaMes(iso) {
  if (!iso) return '—';
  const [, m, d] = String(iso).split('-');
  return d && m ? `${d}/${m}` : String(iso);
}

// ── Lot card ─────────────────────────────────────────────────────────────────

function LoteCard({ lote, onSelect, index, atividades = [] }) {
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
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'hsl(140 14% 93%)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${progresso}%`, background: prontoParaColheita ? '#16a34a' : cor }}
        />
      </div>

      {/* ── Agendamentos do produtor (nada é previsto pelo sistema) ── */}
      {(() => {
        const { atrasadas, hoje, amanha, proxima } = resumoAgendados(atividades);
        if (!atrasadas && !hoje && !amanha && !proxima) return null;
        return (
          <div className="mt-2.5 pt-2.5 flex flex-wrap gap-1.5"
            style={{ borderTop: '1px solid hsl(140 13% 92%)' }}>
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
                style={{ background: 'hsl(140 14% 93%)', color: 'hsl(150 8% 45%)' }}>
                <ArrowRight size={9} /> {proxima.etapa} · {fmtDiaMes(proxima.data_prevista)}
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
          style={{ background: 'hsl(156 64% 31% / 0.1)' }}>
          <Building2 size={18} style={{ color: 'hsl(156 64% 31%)' }} />
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
              style={{ borderTop: '1px solid hsl(140 13% 93%)' }}>
              {areaTotal > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span style={{ color: 'hsl(156 64% 31%)' }}>⬛</span>
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
                  <CalendarDays size={9} style={{ color: 'hsl(156 64% 31%)' }} />
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
        style={{ background: 'hsl(156 64% 31% / 0.1)' }}>
        <Layers size={24} style={{ color: 'hsl(156 64% 31%)' }} />
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
        style={{ background: 'hsl(156 64% 31%)' }}
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
 * Alertas a partir dos lotes + dos LANÇAMENTOS do produtor (sem consultas extra).
 * Nada é "previsto" pelo sistema: só atrasa o que o produtor agendou.
 * Returns array of { id, level, text, emoji, lote }
 */
function computeAlertas(lotes, atividadesPorLote = {}) {
  const alertas = [];
  const hoje = hojeISO();

  lotes.forEach(lote => {
    if (lote.status !== 'ativo') return;
    const cultura = CULTURAS[lote.cultura_id];
    if (!cultura) return;

    let lc;
    try { lc = resolveLifecycle(lote, cultura); } catch { return; }

    const { diasDecorridos, prontoParaColheita } = lc;

    // ── 1. Agendamentos do produtor vencidos ───────────────────────────────
    (atividadesPorLote[lote.id] || [])
      .filter(a => a.status === STATUS.AGENDADO && a.data_prevista && a.data_prevista < hoje)
      .forEach(a => {
        const diasAtraso = Math.round(
          (new Date(`${hoje}T12:00:00`) - new Date(`${a.data_prevista}T12:00:00`)) / 86_400_000
        );
        if (diasAtraso <= 0) return;
        const id = `agendado_atrasado_${a.id}`;
        if (isDismissed(id)) return;
        alertas.push({
          id,
          level: diasAtraso > 3 ? 'vermelho' : 'amarelo',
          text: `${cultura.emoji} ${lote.nome} — "${a.etapa}" agendada há ${diasAtraso} dia${diasAtraso !== 1 ? 's' : ''}`,
          emoji: cultura.emoji,
          lote,
          diasAtraso,
        });
      });

    // ── 2. Colheita pronta sem venda ────────────────────────────────────────
    if (prontoParaColheita) {
      // Há quantos dias está pronto = dias decorridos − ciclo até a 1ª produção.
      // Vem do CICLO da cultura (lifecycle), não de um cronograma previsto.
      const diasColheita = lc.diasPrimeiraProducao ?? diasDecorridos;
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

function AlertasUrgencias({ lotes, atividadesPorLote, onSelectLote }) {
  const [dismissed, setDismissed] = useState(0); // counter to force re-render on dismiss

  const alertas = useMemo(
    () => computeAlertas(lotes, atividadesPorLote),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lotes, atividadesPorLote, dismissed]
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

function EstaSemanaSection({ lotes, atividadesPorLote = {} }) {
  const [collapsed, setCollapsed] = useState(false);

  const hoje = hojeISO();
  const limite = new Date(`${hoje}T12:00:00`);
  limite.setDate(limite.getDate() + 7);
  const limiteISO = limite.toISOString().slice(0, 10);

  // Só o que o produtor AGENDOU (incl. atrasados) nos próximos 7 dias.
  const itens = [];
  lotes.forEach(lote => {
    const cultura = CULTURAS[lote.cultura_id];
    if (!cultura) return;
    (atividadesPorLote[lote.id] || []).forEach(a => {
      if (a.status !== STATUS.AGENDADO || !a.data_prevista) return;
      if (a.data_prevista > limiteISO) return;
      itens.push({
        lote, cultura, etapa: a.etapa, data: a.data_prevista,
        emoji: getCategoria(a.categoria).emoji, produto: a.produto,
      });
    });
  });

  itens.sort((a, b) => a.data.localeCompare(b.data));

  if (lotes.length === 0) return null;

  return (
    <div className="mb-5">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="flex items-center gap-2 mb-3 w-full text-left"
      >
        <p className="section-label flex-1">📅 Esta Semana{itens.length ? ` · ${itens.length}` : ''}</p>
        <span className="text-[10px] text-muted-foreground">{collapsed ? 'mostrar' : 'ocultar'}</span>
      </button>

      {!collapsed && (
        <div className="card overflow-hidden">
          {itens.length === 0 ? (
            <p className="px-4 py-4 text-[12px] text-muted-foreground text-center">
              Nada agendado para os próximos 7 dias.<br />
              <span className="text-[11px]">Agende no lote → aba Cronograma.</span>
            </p>
          ) : (
            <div className="divide-y" style={{ divideColor: 'hsl(140 13% 92%)' }}>
              {itens.map((item, idx) => {
                const isAtrasado = item.data < hoje;
                const isHoje = item.data === hoje;
                const cor = item.cultura.cor;
                return (
                  <div key={`${item.lote.id}_${item.etapa}_${idx}`}
                    className="flex items-center gap-3 px-4 py-3"
                    style={{ borderBottom: idx < itens.length - 1 ? '1px solid hsl(140 13% 92%)' : 'none' }}
                  >
                    <span className="text-[18px] flex-shrink-0">{item.emoji || item.cultura.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold text-foreground truncate">{item.lote.nome}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {item.etapa}{item.produto ? ` · ${item.produto}` : ''}
                      </p>
                    </div>
                    <span
                      className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={
                        isAtrasado
                          ? { background: '#fee2e2', color: '#dc2626' }
                          : isHoje
                            ? { background: '#fff7ed', color: '#ea580c' }
                            : { background: `${cor}15`, color: cor }
                      }
                    >
                      {isAtrasado ? `Atrasado · ${fmtDiaMes(item.data)}` : isHoje ? 'Hoje' : fmtDiaMes(item.data)}
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

const BRAND = 'hsl(156 64% 31%)';
const GOLD  = 'hsl(36 92% 42%)';

function StatCard({ icon: Icon, label, value, accent, danger }) {
  const cor = danger ? 'hsl(4 76% 50%)' : accent ? GOLD : BRAND;
  return (
    <div className="card p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon size={13} style={{ color: cor }} />
        <span className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground truncate">{label}</span>
      </div>
      <p className="text-[20px] font-black leading-none tabular-nums" style={{ color: (accent || danger) ? cor : 'var(--fg)' }}>{value}</p>
    </div>
  );
}

function ActTile({ icon: Icon, label, sub, onClick, primary }) {
  return (
    <button type="button" onClick={onClick}
      className="flex items-center gap-3 p-3 rounded-2xl text-left transition-transform active:scale-[0.97]"
      style={primary
        ? { background: BRAND, color: '#fff', boxShadow: `0 8px 18px -8px ${BRAND}` }
        : { background: 'var(--bg-card)', color: 'var(--fg)', border: '1px solid hsl(150 16% 90%)' }}>
      <span className="flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0"
        style={primary ? { background: 'rgba(255,255,255,0.22)' } : { background: `${BRAND}14`, color: BRAND }}>
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-bold leading-tight">{label}</p>
        {sub && <p className="text-[10.5px] leading-tight mt-0.5" style={{ color: primary ? 'rgba(255,255,255,0.78)' : 'hsl(150 8% 45%)' }}>{sub}</p>}
      </div>
    </button>
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

  // ── Lançamentos do cronograma — Supabase é a fonte da verdade ───────────────
  // atividadesPorLote = o que o produtor registrou/agendou (nada é previsto).
  const loteIds = useMemo(() => lotes.map(l => l.id), [lotes]);
  const { atividadesPorLote } = useCronogramaStatusBatch(loteIds);

  const lotesOrfaos = lotes.filter(l => !l.propriedade_id);

  const prontos = useMemo(() => lotes.filter(l => {
    const c = CULTURAS[l.cultura_id];
    try { return c && resolveLifecycle(l, c).prontoParaColheita; } catch { return false; }
  }).length, [lotes]);
  const alertasTotal = useMemo(() => Object.values(alertasPorProp).reduce((s, n) => s + n, 0), [alertasPorProp]);
  const temDados = propriedades.length > 0 || lotes.length > 0;

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const dataHoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

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
          <div className="flex items-center gap-3 pr-24">
            {/* pr-24 reserva espaço à direita para os botões flutuantes */}
            <Logo size={40} className="flex-shrink-0" style={{ borderRadius: 10 }} />
            <div className="min-w-0">
              <p className="text-white/60 text-[12px] font-medium truncate">
                {saudacao}{userName ? `, ${userName}` : ''} 👋
              </p>
              <h1 className="font-display text-white text-[22px] font-black leading-tight">OryAgro</h1>
            </div>
          </div>
          <p className="text-white/55 text-[12px] mt-3 capitalize">{dataHoje}</p>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="page-body pt-4 pb-4">
        {/* Resumo (cards sobrepostos ao hero) */}
        {!loading && temDados && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
            <StatCard icon={Building2} label="Propriedades" value={propriedades.length} />
            <StatCard icon={Leaf} label="Lotes" value={lotes.length} />
            <StatCard icon={CheckCircle2} label="P/ colheita" value={prontos} accent={prontos > 0} />
            <StatCard icon={AlertTriangle} label="Alertas" value={alertasTotal} danger={alertasTotal > 0} />
          </div>
        )}

        {/* Ações rápidas */}
        {!loading && temDados && (
          <div className="grid grid-cols-2 gap-2.5 mb-5">
            <ActTile icon={Plus} label="Novo lote" sub="Registrar cultura" onClick={onAddLote} primary />
            <ActTile icon={Building2} label="Propriedades" sub="Gerenciar" onClick={onManagePropriedades} />
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground text-[13px]">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              className="w-4 h-4 rounded-full border-2"
              style={{ borderColor: 'hsl(156 64% 31% / 0.4)', borderTopColor: 'hsl(156 64% 31%)' }} />
            Carregando…
          </div>
        ) : propriedades.length === 0 && lotes.length === 0 ? (
          <EmptyLotes onAdd={onManagePropriedades} />
        ) : (
          <>
            <AlertasUrgencias lotes={lotes} atividadesPorLote={atividadesPorLote} onSelectLote={onSelectLote} />
            <EstaSemanaSection lotes={lotes} atividadesPorLote={atividadesPorLote} />

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
                    <LoteCard key={l.id} lote={l} onSelect={onSelectLote} index={i} atividades={atividadesPorLote[l.id]} />
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
