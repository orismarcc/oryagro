import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CULTURAS } from '../data/culturas';
import { loadTodosLotes } from '../hooks/useSupabaseSync';
import { resolveLifecycle, fmtDateBR } from '../lib/lifecycle';
import { logDbError } from '../lib/logger';
import {
  BarChart2,
  Sprout,
  LogOut,
  TrendingUp,
  Leaf,
  CheckCircle2,
  CalendarDays,
  MapPin,
  Clock,
  Activity,
} from 'lucide-react';

/* ─── helpers ─────────────────────────────────────────────── */

/**
 * Parses a cycle string correctly:
 * - "10–14 meses (1ª colheita)" → average months × 30.5 days
 * - "45–60 dias" → average days
 * - Fallback: 365
 */
function parseCicloDias(cicloStr) {
  if (!cicloStr) return 365;
  const mesesMatch = cicloStr.match(/(\d+)\s*(?:[–\-a]\s*(\d+))?\s*meses?/i);
  if (mesesMatch) {
    const min = parseInt(mesesMatch[1], 10);
    const max = mesesMatch[2] ? parseInt(mesesMatch[2], 10) : min;
    return Math.round(((min + max) / 2) * 30.5);
  }
  const clean = cicloStr.replace(/\(.*?\)/g, '');
  const nums = clean.match(/\d+/g);
  if (!nums) return 365;
  const vals = nums.map(Number);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.round(avg);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateShort(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getCultura(culturaId) {
  return CULTURAS[culturaId] || null;
}

/**
 * Safely resolve lifecycle; on error returns null so callers can fall back.
 */
function safeResolveLifecycle(lote, cultura) {
  try {
    return resolveLifecycle(lote, cultura);
  } catch (err) {
    logDbError('safeResolveLifecycle', err);
    return null;
  }
}

/**
 * Determines if a lote is "pronto para colheita" using resolveLifecycle.
 * Falls back to the corrected parseCicloDias if lifecycle resolution fails.
 */
function isProntoParaColheita(lote, cultura) {
  if (!cultura) return false;
  const lc = safeResolveLifecycle(lote, cultura);
  if (lc !== null) return lc.prontoParaColheita === true;
  // fallback
  const cicloDias = parseCicloDias(cultura.ciclo);
  const diasDecorridos = Math.max(
    0,
    Math.floor((Date.now() - new Date(lote.data_plantio + 'T12:00:00')) / 86_400_000)
  );
  return diasDecorridos >= cicloDias;
}

/* ─── sub-components ──────────────────────────────────────── */

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="flex flex-col items-center gap-1 px-4 py-3 rounded-xl bg-white/10 backdrop-blur-sm flex-1 min-w-0">
      <Icon size={16} className="opacity-70" style={{ color: accent || 'white' }} />
      <span className="text-[11px] text-white/70 font-medium leading-none text-center">{label}</span>
      <span className="text-[13px] text-white font-bold leading-tight text-center truncate w-full text-center">{value}</span>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest text-green-700/60 mb-2 px-1">
      {children}
    </p>
  );
}

function Card({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

/* ─── Distribuição por Cultura ────────────────────────────── */

function DistribuicaoCard({ lotes }) {
  const grouped = {};

  lotes.forEach((lote) => {
    const c = getCultura(lote.cultura_id);
    if (!c) return;
    if (!grouped[c.id]) grouped[c.id] = { cultura: c, count: 0, plantas: 0 };
    grouped[c.id].count += 1;
    grouped[c.id].plantas += lote.total_plantas || 0;
  });

  const entries = Object.values(grouped).sort((a, b) => b.plantas - a.plantas);
  const maxPlantas = entries.reduce((m, e) => Math.max(m, e.plantas), 1);

  if (entries.length === 0) return null;

  return (
    <Card>
      <div className="px-4 pt-4 pb-1 flex items-center gap-2 border-b border-gray-50">
        <Leaf size={14} className="text-green-500" />
        <span className="text-[13px] font-bold text-gray-700">Distribuição por Cultura</span>
      </div>
      <div className="px-4 py-3 flex flex-col gap-3">
        {entries.map(({ cultura, count, plantas }) => {
          const pct = Math.round((plantas / maxPlantas) * 100);
          return (
            <div key={cultura.id} className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-[15px]">{cultura.emoji}</span>
                  <span className="text-[12px] font-semibold text-gray-700">{cultura.nome}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400">
                    {count} {count === 1 ? 'lote' : 'lotes'}
                  </span>
                  <span className="text-[11px] font-bold text-gray-600">
                    {plantas.toLocaleString('pt-BR')} pl.
                  </span>
                </div>
              </div>
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: cultura.cor }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ─── Status dos Lotes ────────────────────────────────────── */

function StatusCard({ lotes }) {
  const now = Date.now();
  const em30dias = now + 30 * 86_400_000;

  let ativos = 0;
  let proxColheita30d = 0;

  lotes.forEach((lote) => {
    const cultura = getCultura(lote.cultura_id);
    const lc = cultura ? safeResolveLifecycle(lote, cultura) : null;

    if (lc !== null) {
      if (lc.prontoParaColheita) {
        ativos += 1; // already counted as active but ready
      } else {
        ativos += 1;
        const dataProd = lc.dataPrimeiraProducao;
        if (dataProd && dataProd.getTime() <= em30dias) {
          proxColheita30d += 1;
        }
      }
    } else {
      ativos += 1;
    }
  });

  const total = ativos;
  const pctProx = total > 0 ? Math.round((proxColheita30d / total) * 100) : 0;
  const pctAtivos = 100 - pctProx;

  return (
    <Card>
      <div className="px-4 pt-4 pb-1 flex items-center gap-2 border-b border-gray-50">
        <TrendingUp size={14} className="text-green-500" />
        <span className="text-[13px] font-bold text-gray-700">Status dos Lotes</span>
      </div>
      <div className="px-4 py-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex w-full h-4 rounded-full overflow-hidden bg-gray-100">
            {ativos > 0 && (
              <motion.div
                className="h-full bg-blue-400"
                initial={{ width: 0 }}
                animate={{ width: `${pctAtivos}%` }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
              />
            )}
            {proxColheita30d > 0 && (
              <motion.div
                className="h-full bg-emerald-400"
                initial={{ width: 0 }}
                animate={{ width: `${pctProx}%` }}
                transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
              />
            )}
          </div>
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>Ativos {pctAtivos}%</span>
            <span>Próx. colheita {pctProx}%</span>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex-1 flex items-center gap-2 bg-blue-50 rounded-xl px-3 py-2">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-400 flex-shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] text-blue-600/70 font-medium">Ativos</span>
              <span className="text-[18px] font-bold text-blue-600 leading-tight">{ativos}</span>
            </div>
          </div>
          <div className="flex-1 flex items-center gap-2 bg-emerald-50 rounded-xl px-3 py-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 flex-shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] text-emerald-600/70 font-medium">Próx. Colheita (30d)</span>
              <span className="text-[18px] font-bold text-emerald-600 leading-tight">{proxColheita30d}</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ─── Próximas Colheitas ──────────────────────────────────── */

function ProximasColheitasCard({ lotes }) {
  const now = Date.now();
  const em6meses = now + 180 * 86_400_000;

  const rows = [];

  lotes.forEach((lote) => {
    const cultura = getCultura(lote.cultura_id);
    if (!cultura) return;
    const lc = safeResolveLifecycle(lote, cultura);
    if (!lc) return;

    // Show lotes: already past or within 6 months ahead
    const prodTs = lc.dataPrimeiraProducao ? lc.dataPrimeiraProducao.getTime() : null;
    if (prodTs === null) return;

    if (lc.prontoParaColheita) {
      rows.push({ lote, cultura, lc, prodTs, emAndamento: true });
    } else if (prodTs <= em6meses) {
      rows.push({ lote, cultura, lc, prodTs, emAndamento: false });
    }
  });

  // Sort: already in progress first, then soonest
  rows.sort((a, b) => {
    if (a.emAndamento && !b.emAndamento) return -1;
    if (!a.emAndamento && b.emAndamento) return 1;
    return a.prodTs - b.prodTs;
  });

  const top5 = rows.slice(0, 5);

  if (top5.length === 0) return null;

  return (
    <Card>
      <div className="px-4 pt-4 pb-1 flex items-center gap-2 border-b border-gray-50">
        <CalendarDays size={14} className="text-green-500" />
        <span className="text-[13px] font-bold text-gray-700">Próximas Colheitas</span>
      </div>
      <div className="divide-y divide-gray-50">
        {top5.map(({ lote, cultura, lc, emAndamento }) => {
          const diasRestantes = lc.diasParaColheita;
          const dataBR = formatDateShort(lc.dataPrimeiraProducao);

          let etiqueta;
          if (emAndamento) {
            etiqueta = (
              <span className="flex-shrink-0 text-[10px] font-bold text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">
                ⚠️ Em andamento
              </span>
            );
          } else if (diasRestantes <= 30) {
            etiqueta = (
              <span className="flex-shrink-0 text-[10px] font-bold text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5">
                em {diasRestantes}d
              </span>
            );
          } else {
            etiqueta = (
              <span className="flex-shrink-0 text-[10px] font-medium text-gray-400 bg-gray-50 rounded-full px-2 py-0.5">
                {dataBR}
              </span>
            );
          }

          return (
            <div key={lote.id} className="flex items-center gap-3 px-4 py-3">
              <span className="text-[18px] leading-none flex-shrink-0">{cultura.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold text-gray-800 truncate">{lote.nome}</p>
                <p className="text-[10px] text-gray-400">{cultura.nome}</p>
              </div>
              {etiqueta}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ─── Indicadores de Campo ────────────────────────────────── */

function IndicadoresCampoCard({ lotes, allLotes }) {
  const totalPlantas = lotes.reduce((s, l) => s + (l.total_plantas || 0), 0);
  const areaTotal = lotes.reduce((s, l) => s + (l.area_ha || 0), 0);

  const finalizados = allLotes.filter(
    (l) => l.status === 'colhido' || l.status === 'perdido' || l.status === 'cancelado'
  ).length;

  return (
    <Card>
      <div className="px-4 pt-4 pb-1 flex items-center gap-2 border-b border-gray-50">
        <Activity size={14} className="text-green-500" />
        <span className="text-[13px] font-bold text-gray-700">Indicadores de Campo</span>
      </div>
      <div className="px-4 py-3 grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-0.5 bg-green-50 rounded-xl px-3 py-2">
          <span className="text-[10px] text-green-700/60 font-medium">Total de Plantas</span>
          <span className="text-[16px] font-bold text-green-700 leading-tight">
            {totalPlantas.toLocaleString('pt-BR')}
          </span>
        </div>
        <div className="flex flex-col gap-0.5 bg-teal-50 rounded-xl px-3 py-2">
          <span className="text-[10px] text-teal-700/60 font-medium">Área Cultivada</span>
          <span className="text-[16px] font-bold text-teal-700 leading-tight">
            {areaTotal.toFixed(2)} ha
          </span>
        </div>
        <div className="flex flex-col gap-0.5 bg-blue-50 rounded-xl px-3 py-2">
          <span className="text-[10px] text-blue-700/60 font-medium">Lotes Ativos</span>
          <span className="text-[16px] font-bold text-blue-700 leading-tight">{lotes.length}</span>
        </div>
        <div className="flex flex-col gap-0.5 bg-gray-50 rounded-xl px-3 py-2">
          <span className="text-[10px] text-gray-500/80 font-medium">Finalizados</span>
          <span className="text-[16px] font-bold text-gray-500 leading-tight">{finalizados}</span>
        </div>
      </div>
    </Card>
  );
}

/* ─── Resumo por Propriedade ──────────────────────────────── */

function ResumoPorPropriedadeCard({ lotes, propriedades }) {
  const hasPropriedade = lotes.some((l) => l.propriedade_id != null);
  if (!hasPropriedade) return null;

  const grouped = {};
  lotes.forEach((lote) => {
    const pid = lote.propriedade_id ?? '__sem_prop__';
    if (!grouped[pid]) grouped[pid] = { count: 0, plantas: 0 };
    grouped[pid].count += 1;
    grouped[pid].plantas += lote.total_plantas || 0;
  });

  const getPropriedadeNome = (pid) => {
    if (pid === '__sem_prop__') return 'Sem propriedade';
    const prop = propriedades.find((p) => String(p.id) === String(pid));
    return prop ? prop.nome : `Propriedade ${pid}`;
  };

  const entries = Object.entries(grouped).sort((a, b) => b[1].count - a[1].count);

  return (
    <Card>
      <div className="px-4 pt-4 pb-1 flex items-center gap-2 border-b border-gray-50">
        <MapPin size={14} className="text-green-500" />
        <span className="text-[13px] font-bold text-gray-700">Resumo por Propriedade</span>
      </div>
      <div className="divide-y divide-gray-50">
        {entries.map(([pid, { count, plantas }]) => (
          <div key={pid} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
              <span className="text-[12px] font-semibold text-gray-700 truncate max-w-[160px]">
                {getPropriedadeNome(pid)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-gray-400">
                {plantas.toLocaleString('pt-BR')} pl.
              </span>
              <span className="text-[11px] font-bold text-gray-600">
                {count} {count === 1 ? 'lote' : 'lotes'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ─── Histórico de Lotes ──────────────────────────────────── */

function HistoricoList({ lotes }) {
  const sorted = [...lotes].sort(
    (a, b) => new Date(b.data_plantio) - new Date(a.data_plantio)
  );

  return (
    <Card>
      <div className="px-4 pt-4 pb-1 flex items-center gap-2 border-b border-gray-50">
        <CalendarDays size={14} className="text-green-500" />
        <span className="text-[13px] font-bold text-gray-700">Histórico de Lotes</span>
        <span className="ml-auto text-[10px] text-gray-400">{lotes.length} lotes</span>
      </div>
      <div className="divide-y divide-gray-50">
        {sorted.map((lote) => {
          const cultura = getCultura(lote.cultura_id);
          const cor = cultura?.cor || '#888';
          const emoji = cultura?.emoji || '🌱';

          // Use resolveLifecycle for correct progress/ready state
          const lc = cultura ? safeResolveLifecycle(lote, cultura) : null;
          const pronto = lc ? lc.prontoParaColheita : false;
          const pct = lc ? lc.progresso : 0;
          const diasDecorridos = lc ? lc.diasDecorridos : 0;
          const diasPrimeiraProducao = lc ? lc.diasPrimeiraProducao : parseCicloDias(cultura?.ciclo);

          return (
            <div
              key={lote.id}
              className="flex gap-3 px-4 py-3 items-start"
              style={{ borderLeft: `3px solid ${cor}` }}
            >
              <span className="text-[20px] leading-none mt-0.5 flex-shrink-0">{emoji}</span>

              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-gray-800 truncate">{lote.nome}</p>
                    <p className="text-[10px] text-gray-400">
                      {cultura?.nome || '—'} · {formatDate(lote.data_plantio)}
                    </p>
                  </div>
                  {pronto ? (
                    <span className="flex-shrink-0 flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5">
                      <CheckCircle2 size={9} />
                      Pronto ✓
                    </span>
                  ) : (
                    <span className="flex-shrink-0 text-[10px] font-bold text-blue-500 bg-blue-50 rounded-full px-2 py-0.5">
                      Ativo
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, backgroundColor: pronto ? '#10b981' : cor }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 flex-shrink-0">
                    {diasDecorridos}d / {diasPrimeiraProducao}d
                  </span>
                </div>

                <p className="text-[10px] text-gray-400">
                  {(lote.total_plantas || 0).toLocaleString('pt-BR')} plantas
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ─── Safras Anteriores ───────────────────────────────────── */

function SafrasAnterioresCard({ lotes }) {
  const colhidos = lotes.filter((l) => l.status === 'colhido');
  if (colhidos.length === 0) return null;

  const sorted = [...colhidos].sort(
    (a, b) => new Date(b.data_plantio) - new Date(a.data_plantio)
  );

  return (
    <Card>
      <div className="px-4 pt-4 pb-1 flex items-center gap-2 border-b border-gray-50">
        <Clock size={14} className="text-gray-400" />
        <span className="text-[13px] font-bold text-gray-600">Safras Anteriores</span>
        <span className="ml-auto text-[10px] text-gray-400">{colhidos.length} colhidos</span>
      </div>
      <div className="divide-y divide-gray-50">
        {sorted.map((lote) => {
          const cultura = getCultura(lote.cultura_id);
          const cor = cultura?.cor || '#aaa';
          const emoji = cultura?.emoji || '🌱';

          return (
            <div
              key={lote.id}
              className="flex items-center gap-3 px-4 py-3"
              style={{ borderLeft: `3px solid ${cor}` }}
            >
              <span className="text-[18px] leading-none flex-shrink-0">{emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold text-gray-600 truncate">{lote.nome}</p>
                <p className="text-[10px] text-gray-400">
                  {cultura?.nome || '—'} · Plantio: {formatDate(lote.data_plantio)}
                </p>
              </div>
              <span className="flex-shrink-0 text-[10px] font-bold text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                Finalizado
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ─── Empty state ─────────────────────────────────────────── */

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-6">
      <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
        <Sprout size={28} className="text-green-400" />
      </div>
      <p className="text-[14px] font-bold text-gray-700">Nenhum lote cadastrado</p>
      <p className="text-[12px] text-gray-400 leading-relaxed">
        Crie seu primeiro lote no Dashboard para visualizar as análises de produção.
      </p>
    </div>
  );
}

/* ─── Loading spinner ─────────────────────────────────────── */

function Spinner() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24">
      <div className="w-8 h-8 border-2 border-green-200 border-t-green-500 rounded-full animate-spin" />
      <p className="text-[12px] text-gray-400">Carregando análises…</p>
    </div>
  );
}

/* ─── Main component ──────────────────────────────────────── */

export default function AnalysePage({ onSignOut, userName, propriedades = [] }) {
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadTodosLotes(500)
      .then((data) => {
        if (!cancelled) {
          setLotes(Array.isArray(data) ? data : []);
          setLoading(false);
        }
      })
      .catch((err) => {
        logDbError('AnalysePage.loadTodosLotes', err);
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  /* Derived stats — only active lotes */
  const lotesAtivos = lotes.filter((l) => l.status === 'ativo');

  const totalPlantas = lotesAtivos.reduce((s, l) => s + (l.total_plantas || 0), 0);
  const areaAtiva = lotesAtivos.reduce((s, l) => s + (l.area_ha || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── Hero header ── */}
      <div className="gradient-hero text-white px-4 pt-10 pb-6 flex flex-col gap-4">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart2 size={18} className="opacity-80" />
            <div>
              <h1 className="text-[16px] font-bold leading-tight">Análise de Produção</h1>
              {userName && (
                <p className="text-[10px] text-white/60 leading-none mt-0.5">{userName}</p>
              )}
            </div>
          </div>
          {onSignOut && (
            <button
              onClick={onSignOut}
              className="flex items-center gap-1.5 text-[11px] text-white/70 hover:text-white transition-colors bg-white/10 rounded-lg px-3 py-1.5"
            >
              <LogOut size={12} />
              Sair
            </button>
          )}
        </div>

        {/* Glass stats row */}
        <div className="flex gap-2">
          <StatCard
            icon={Leaf}
            label="Total Lotes"
            value={lotes.length}
          />
          <StatCard
            icon={Sprout}
            label="Total Plantas"
            value={totalPlantas.toLocaleString('pt-BR')}
          />
          <StatCard
            icon={TrendingUp}
            label="Áreas Ativas (ha)"
            value={`${areaAtiva.toFixed(2)} ha`}
            accent="#86efac"
          />
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-4 pt-5 pb-6 flex flex-col gap-5 flex-1">
        {loading ? (
          <Spinner />
        ) : lotes.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Distribuição por Cultura */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <SectionLabel>Distribuição</SectionLabel>
              <DistribuicaoCard lotes={lotesAtivos} />
            </motion.div>

            {/* Status dos Lotes */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <SectionLabel>Status</SectionLabel>
              <StatusCard lotes={lotesAtivos} />
            </motion.div>

            {/* Próximas Colheitas */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
            >
              <SectionLabel>Próximas Colheitas</SectionLabel>
              <ProximasColheitasCard lotes={lotesAtivos} />
            </motion.div>

            {/* Indicadores de Campo */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <SectionLabel>Indicadores de Campo</SectionLabel>
              <IndicadoresCampoCard lotes={lotesAtivos} allLotes={lotes} />
            </motion.div>

            {/* Resumo por Propriedade */}
            {propriedades.length > 0 || lotesAtivos.some((l) => l.propriedade_id != null) ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.25 }}
              >
                <SectionLabel>Por Propriedade</SectionLabel>
                <ResumoPorPropriedadeCard lotes={lotesAtivos} propriedades={propriedades} />
              </motion.div>
            ) : null}

            {/* Histórico de Lotes */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
            >
              <SectionLabel>Histórico de Lotes</SectionLabel>
              <HistoricoList lotes={lotesAtivos} />
            </motion.div>

            {/* Safras Anteriores */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.35 }}
            >
              <SectionLabel>Safras Anteriores</SectionLabel>
              <SafrasAnterioresCard lotes={lotes} />
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}
