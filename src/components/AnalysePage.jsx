import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CULTURAS } from '../data/culturas';
import { loadTodosLotes } from '../hooks/useSupabaseSync';
import { BarChart2, Sprout, LogOut, TrendingUp, Leaf, CheckCircle2, CalendarDays } from 'lucide-react';

/* ─── helpers ─────────────────────────────────────────────── */

function parseCicloDias(cicloStr) {
  if (!cicloStr) return 60;
  const nums = cicloStr.match(/\d+/g);
  if (!nums || nums.length === 0) return 60;
  return parseInt(nums[nums.length - 1], 10);
}

function diasDecorridos(lote) {
  return Math.max(
    0,
    Math.floor(
      (Date.now() - new Date(lote.data_plantio + 'T12:00:00')) / 86_400_000
    )
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatCurrency(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getCultura(culturaId) {
  return CULTURAS[culturaId] || null;
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
  let ativos = 0;
  let prontos = 0;

  lotes.forEach((lote) => {
    const cultura = getCultura(lote.cultura_id);
    const ciclo = cultura ? parseCicloDias(cultura.ciclo) : 60;
    const dias = diasDecorridos(lote);
    if (dias >= ciclo) prontos += 1;
    else ativos += 1;
  });

  const total = ativos + prontos;
  const pctProntos = total > 0 ? Math.round((prontos / total) * 100) : 0;
  const pctAtivos = 100 - pctProntos;

  return (
    <Card>
      <div className="px-4 pt-4 pb-1 flex items-center gap-2 border-b border-gray-50">
        <TrendingUp size={14} className="text-green-500" />
        <span className="text-[13px] font-bold text-gray-700">Status dos Lotes</span>
      </div>
      <div className="px-4 py-4 flex flex-col gap-4">
        {/* Donut-style stacked bar */}
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
            {prontos > 0 && (
              <motion.div
                className="h-full bg-emerald-400"
                initial={{ width: 0 }}
                animate={{ width: `${pctProntos}%` }}
                transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
              />
            )}
          </div>
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>Ativos {pctAtivos}%</span>
            <span>Prontos {pctProntos}%</span>
          </div>
        </div>

        {/* Counts */}
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
              <span className="text-[10px] text-emerald-600/70 font-medium">Prontos p/ Colheita</span>
              <span className="text-[18px] font-bold text-emerald-600 leading-tight">{prontos}</span>
            </div>
          </div>
        </div>
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
          const cicloDias = cultura ? parseCicloDias(cultura.ciclo) : 60;
          const dias = diasDecorridos(lote);
          const pronto = dias >= cicloDias;
          const pct = Math.min(100, Math.round((dias / cicloDias) * 100));

          return (
            <div
              key={lote.id}
              className="flex gap-3 px-4 py-3 items-start"
              style={{ borderLeft: `3px solid ${cor}` }}
            >
              {/* Emoji */}
              <span className="text-[20px] leading-none mt-0.5 flex-shrink-0">{emoji}</span>

              {/* Main content */}
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-gray-800 truncate">{lote.nome}</p>
                    <p className="text-[10px] text-gray-400">
                      {cultura?.nome || '—'} · {formatDate(lote.data_plantio)}
                    </p>
                  </div>
                  {/* Status pill */}
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

                {/* Progress bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, backgroundColor: pronto ? '#10b981' : cor }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 flex-shrink-0">
                    {dias}d / {cicloDias}d
                  </span>
                </div>

                {/* Plants count */}
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

export default function AnalysePage({ onSignOut, userName }) {
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
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  /* Derived stats */
  const totalPlantas = lotes.reduce((s, l) => s + (l.total_plantas || 0), 0);

  const receitaEstimada = lotes.reduce((sum, lote) => {
    const cultura = getCultura(lote.cultura_id);
    if (!cultura?.venda) return sum;
    const { precoUnitario = 0, sobrevivencia = 100 } = cultura.venda;
    return sum + (lote.total_plantas || 0) * (sobrevivencia / 100) * precoUnitario;
  }, 0);

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
            label="Receita Estimada"
            value={formatCurrency(receitaEstimada)}
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
              <DistribuicaoCard lotes={lotes} />
            </motion.div>

            {/* Status dos Lotes */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <SectionLabel>Status</SectionLabel>
              <StatusCard lotes={lotes} />
            </motion.div>

            {/* Histórico de Lotes */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <SectionLabel>Histórico de Lotes</SectionLabel>
              <HistoricoList lotes={lotes} />
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}
