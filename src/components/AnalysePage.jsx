import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CULTURAS } from '../data/culturas';
import { exportarRelatorioPDF } from '../lib/pdfExport';
import { loadTodosLotes, loadAllColheitaEventos } from '../hooks/useSupabaseSync';
import { loadMovimentosByLote, loadTodasVendas } from '../hooks/useGestao';
import { loadTodasDespesas, loadDespesasByLote } from '../hooks/useDespesas';
import { resolveLifecycle, fmtDateBR, parseCicloDias } from '../lib/lifecycle';
import { logDbError } from '../lib/logger';
import { estimateKgAnual, getProductionBase } from '../constants/cropYields';
import { can, FARM_ACTIONS } from '../lib/permissions';
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
  DollarSign,
  Wrench,
  FileDown,
} from 'lucide-react';

/* ─── helpers ─────────────────────────────────────────────── */

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

/* ─── Helpers: produção e receita estimada ────────────────── */

/**
 * Returns { qtdKg, receita } for a lote based on its cultura's venda config.
 * Calculations: campo = producaoKgPorHa × area_ha; canteiro = producaoBase (or per m²)
 */
function calcProducaoLote(lote, cultura) {
  const venda = cultura?.venda;
  if (!venda) return { qtdKg: 0, receita: 0 };
  const sobr = (venda.sobrevivencia || 90) / 100;
  const preco = venda.precoUnitario || 0;

  if (venda.producaoKgPorHa) {
    const area = parseFloat(lote.area_ha) || 1;
    const qtdKg = venda.producaoKgPorHa * area * sobr;
    return { qtdKg, receita: qtdKg * preco };
  }
  if (venda.producaoKgPorM2) {
    const area = (parseFloat(lote.comprimento_m) || 20) * (parseFloat(lote.largura_m) || 1.6);
    const qtdKg = venda.producaoKgPorM2 * area * sobr;
    return { qtdKg, receita: qtdKg * preco };
  }
  if (venda.producaoKgPorCorte) {
    const qtdKg = venda.producaoKgPorCorte * sobr;
    return { qtdKg, receita: qtdKg * (venda.macosPorKg || 1) * preco };
  }
  if (venda.producaoBase) {
    const qtdKg = venda.producaoBase * sobr;
    return { qtdKg, receita: qtdKg * preco };
  }
  // Fallback: plantas × preço
  const plantas = (lote.total_plantas || 0) * sobr;
  return { qtdKg: plantas, receita: plantas * preco };
}

function fmtBRL(v) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key) {
  const [y, m] = key.split('-');
  const d = new Date(+y, +m - 1, 1);
  return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
}

/* ─── Production ramp-up curves by cultura type ──────────── */

/**
 * Returns annual production factor (0.0–1.0) for year N from planting.
 * Year 0 = planting year, Year 1 = first full year, etc.
 * Uses cultura-specific curves; defaults to a conservative 3-year ramp.
 */
function getRampFactor(culturaId, yearFromPlanting) {
  const curves = {
    // Perennial fruit trees: slow start, peak at year 5
    acerola:   [0, 0.10, 0.30, 0.60, 0.85, 1.0],
    mamao:     [0, 0.40, 0.80, 1.0,  1.0,  1.0],
    banana:    [0, 0.50, 0.90, 1.0,  1.0,  1.0],
    goiaba:    [0, 0.15, 0.40, 0.70, 0.90, 1.0],
    maracuja:  [0, 0.60, 1.0,  1.0,  1.0,  1.0],
    // Culturas anuais de ciclo curto: atingem 100% já no ano 0 (do plantio)
    alface:    [0.80, 1.0, 1.0, 1.0, 1.0, 1.0],
    coentro:   [0.80, 1.0, 1.0, 1.0, 1.0, 1.0],
    rucula:    [0.80, 1.0, 1.0, 1.0, 1.0, 1.0],
    // Culturas anuais de ciclo longo: produzem no próprio ano
    feijao:    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    milho:     [1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    soja:      [1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    mandioca:  [0, 1.0, 1.0, 1.0, 1.0, 1.0],   // ciclo 18 meses: nada no ano 0
    abacaxi:   [0, 0.80, 1.0, 1.0, 1.0, 1.0],  // ciclo ~12-18 meses
    // Annual/semi-annual crops: faster ramp (conservative fallback)
    _default:  [0, 0.70, 1.0,  1.0,  1.0,  1.0],
  };
  const curve = curves[culturaId] ?? curves._default;
  if (yearFromPlanting <= 0) return curve[0] ?? 0;
  if (yearFromPlanting >= curve.length) return curve[curve.length - 1];
  return curve[yearFromPlanting];
}

/* ─── Projeção de Receita Anual (bar chart) ──────────────── */

function ProjecaoReceitaCard({ lotes, eventosColheita }) {
  const now = new Date();
  const currentYear = now.getFullYear();

  // Default price per kg per cultura (user-editable)
  const defaultPrices = {};
  lotes.forEach(l => {
    const c = getCultura(l.cultura_id);
    if (!c) return;
    if (!(c.id in defaultPrices)) {
      defaultPrices[c.id] = c.venda?.precoUnitario ?? 3.5;
    }
  });
  const [prices, setPrices] = useState(defaultPrices);

  // Culture groups present
  const culturaGroups = {};
  lotes.forEach(l => {
    const c = getCultura(l.cultura_id);
    if (!c) return;
    if (!culturaGroups[c.id]) culturaGroups[c.id] = { cultura: c, lotes: [] };
    culturaGroups[c.id].lotes.push(l);
  });

  // Find earliest planting year across all lotes
  let minPlantYear = currentYear;
  lotes.forEach(l => {
    const y = new Date(l.data_plantio + 'T12:00:00').getFullYear();
    if (y < minPlantYear) minPlantYear = y;
  });

  // Build year range: min plant year → min plant year + 6 (or current + 5, whichever is later)
  const startYear = minPlantYear;
  const endYear = Math.max(currentYear + 4, minPlantYear + 6);
  const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);

  // For each year, compute projected revenue across all lotes
  const projByYear = {};
  years.forEach(yr => {
    let total = 0;
    lotes.forEach(l => {
      const c = getCultura(l.cultura_id);
      if (!c) return;
      const plantYear = new Date(l.data_plantio + 'T12:00:00').getFullYear();
      const yearFromPlant = yr - plantYear;
      const factor = getRampFactor(c.id, yearFromPlant);
      if (factor === 0) return;

      // Full-potential production via single source of truth (no safrasAno multiplier)
      const priceKg = prices[c.id] ?? c.venda?.precoUnitario ?? 3.5;
      const { kg } = estimateKgAnual(l, c.id, factor);
      total += kg * priceKg;
    });
    projByYear[yr] = total;
  });

  // Actual revenue by year from vendas/colheita eventos
  const actualByYear = {};
  eventosColheita.forEach(ev => {
    if (!ev.data) return;
    const yr = parseInt(ev.data.substring(0, 4), 10);
    const lote = lotes.find(l => String(l.id) === String(ev.plantio_id));
    const cultura = lote ? getCultura(lote.cultura_id) : null;
    let receita = 0;
    try {
      const d = typeof ev.descricao === 'string' ? JSON.parse(ev.descricao) : (ev.descricao || {});
      const priceKg = cultura ? (prices[cultura.id] ?? cultura?.venda?.precoUnitario ?? 0) : 0;
      if (d?.qtd) receita = parseFloat(d.qtd) * priceKg;
    } catch { /* ignore */ }
    actualByYear[yr] = (actualByYear[yr] || 0) + receita;
  });

  const maxVal = Math.max(1,
    ...years.map(y => projByYear[y] || 0),
    ...years.map(y => actualByYear[y] || 0),
  );
  const totalProjAll = years.reduce((s, y) => s + (projByYear[y] || 0), 0);
  const hasCulturas = Object.keys(culturaGroups).length > 0;

  // --- Item 3: first harvest year indicator ---
  let receitaPrimeiraProducaoYear = null;
  lotes.forEach(l => {
    const c = getCultura(l.cultura_id);
    if (!c) return;
    const lc = safeResolveLifecycle(l, c);
    const plantYear = new Date(l.data_plantio + 'T12:00:00').getFullYear();
    for (const yr of years) {
      const factor = getRampFactor(c.id, yr - plantYear);
      if (factor > 0) {
        let candidateYear = yr;
        if (lc?.dataPrimeiraProducao) {
          candidateYear = lc.dataPrimeiraProducao.getFullYear();
        }
        if (receitaPrimeiraProducaoYear === null || candidateYear < receitaPrimeiraProducaoYear) {
          receitaPrimeiraProducaoYear = candidateYear;
        }
        break;
      }
    }
  });

  // Column width + gap for positioning the dashed line
  const receitaColWidth = 44;
  const receitaColGap = 8;
  const receitaColUnit = receitaColWidth + receitaColGap; // 52px per column

  if (!hasCulturas) return null;

  return (
    <Card>
      <div className="px-4 pt-4 pb-1 flex items-center gap-2 border-b border-gray-50">
        <DollarSign size={14} className="text-green-500" />
        <span className="text-[13px] font-bold text-gray-700">Projeção de Receita — {startYear}–{endYear}</span>
      </div>

      {/* Price per kg editors */}
      <div className="px-4 pt-3 flex flex-wrap gap-3">
        {Object.values(culturaGroups).map(({ cultura }) => (
          <div key={cultura.id} className="flex items-center gap-1.5">
            <span className="text-[12px]">{cultura.emoji}</span>
            <span className="text-[10px] text-gray-500 font-medium">{cultura.nome}:</span>
            <span className="text-[10px] text-gray-400">R$</span>
            <input
              type="number"
              min="0"
              step="0.10"
              value={prices[cultura.id] ?? ''}
              onChange={e => setPrices(prev => ({ ...prev, [cultura.id]: parseFloat(e.target.value) || 0 }))}
              className="w-14 text-[11px] font-bold text-green-700 bg-green-50 rounded-lg px-2 py-1 border-0 outline-none text-right"
            />
            <span className="text-[10px] text-gray-400">/kg</span>
          </div>
        ))}
      </div>

      {/* Total projection chip */}
      {totalProjAll > 0 && (
        <div className="px-4 pt-2">
          <div className="inline-flex items-center gap-1.5 bg-green-50 rounded-xl px-3 py-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-green-400" />
            <div>
              <p className="text-[9px] text-green-600/70 font-medium leading-none">Receita total projetada ({years[0]}–{years[years.length - 1]})</p>
              <p className="text-[14px] font-bold text-green-700 leading-tight">{fmtBRL(totalProjAll)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Bar chart */}
      <div className="px-3 pt-3 pb-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        <div className="relative flex items-end gap-2" style={{ minWidth: years.length * receitaColUnit }}>
          {/* Item 3: first harvest dashed line */}
          {receitaPrimeiraProducaoYear !== null && years.includes(receitaPrimeiraProducaoYear) && (() => {
            const idx = years.indexOf(receitaPrimeiraProducaoYear);
            const lineLeft = idx * receitaColUnit + receitaColWidth / 2;
            return (
              <motion.div
                style={{
                  position: 'absolute',
                  left: lineLeft,
                  top: 0,
                  bottom: 16,
                  width: 1,
                  borderLeft: '1px dashed #16a34a',
                  pointerEvents: 'none',
                  zIndex: 10,
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.3 }}
              >
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 4,
                  background: 'rgba(255,255,255,0.92)',
                  borderRadius: 4,
                  padding: '1px 4px',
                  whiteSpace: 'nowrap',
                  fontSize: 9,
                  fontWeight: 700,
                  color: '#16a34a',
                  lineHeight: 1.4,
                }}>
                  🌾 Início
                </div>
              </motion.div>
            );
          })()}

          {years.map(yr => {
            const proj = projByYear[yr] || 0;
            const actual = actualByYear[yr] || 0;
            const isPast = yr < currentYear;
            const isCurrent = yr === currentYear;
            const projH = Math.round((proj / maxVal) * 90);
            const actualH = Math.round((actual / maxVal) * 90);
            const hasData = proj > 0 || actual > 0;
            return (
              <div key={yr} className="flex flex-col items-center flex-shrink-0" style={{ width: receitaColWidth }}>
                {/* Value on top */}
                {hasData && (
                  <span className="text-[8px] text-gray-400 font-medium mb-0.5 text-center leading-none">
                    {proj >= 1000 ? `${Math.round(proj / 1000)}k` : proj > 0 ? `${Math.round(proj)}` : ''}
                  </span>
                )}
                <div className="flex items-end gap-1" style={{ height: 94 }}>
                  {/* Projected bar */}
                  <motion.div
                    className="rounded-t flex-shrink-0"
                    style={{
                      width: actual > 0 ? 16 : 28,
                      backgroundColor: proj > 0
                        ? (isCurrent ? '#16a34a' : isPast ? '#86efac' : '#4ade80')
                        : 'transparent',
                    }}
                    initial={{ height: 0 }}
                    animate={{ height: projH || (hasData && proj > 0 ? 2 : 0) }}
                    transition={{ duration: 0.7, ease: 'easeOut', delay: 0.05 }}
                  />
                  {/* Actual bar */}
                  {actual > 0 && (
                    <motion.div
                      className="rounded-t flex-shrink-0"
                      style={{ width: 16, backgroundColor: '#60a5fa' }}
                      initial={{ height: 0 }}
                      animate={{ height: actualH || 2 }}
                      transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
                    />
                  )}
                </div>
                {/* Year label */}
                <span className="text-[9px] font-bold mt-1 text-center leading-none"
                  style={{ color: isCurrent ? '#16a34a' : isPast ? '#cbd5e1' : '#94a3b8' }}>
                  {yr}
                </span>
                {isCurrent && <div className="w-1 h-1 rounded-full bg-green-400 mt-0.5" />}
              </div>
            );
          })}
        </div>
        {/* Legend */}
        <div className="flex items-center gap-4 mt-2 px-1">
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm bg-green-400" />
            <span className="text-[9px] text-gray-400">Projetada</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm bg-blue-400" />
            <span className="text-[9px] text-gray-400">Realizada</span>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <p className="px-4 pb-3 text-[9px] text-gray-400 leading-relaxed">
        * Projeção baseada na curva média de produção por cultura. Resultados reais podem variar conforme manejo, clima e variedade.
      </p>
    </Card>
  );
}

/* ─── Projeção de Produção Anual (kg) ────────────────────── */

function ProjecaoKgCard({ lotes }) {
  const now = new Date();
  const currentYear = now.getFullYear();

  // Build year range
  let minPlantYear = currentYear;
  lotes.forEach(l => {
    const y = new Date(l.data_plantio + 'T12:00:00').getFullYear();
    if (y < minPlantYear) minPlantYear = y;
  });
  const startYear = minPlantYear;
  const endYear = Math.max(currentYear + 4, minPlantYear + 6);
  const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);

  // Group by cultura for stacked display
  const culturaGroups = {};
  lotes.forEach(l => {
    const c = getCultura(l.cultura_id);
    if (!c) return;
    if (!culturaGroups[c.id]) culturaGroups[c.id] = { cultura: c, lotes: [] };
    culturaGroups[c.id].lotes.push(l);
  });

  // Identify lotes with no production basis (unavailable method)
  const unavailableLotes = lotes.filter(l => {
    const c = getCultura(l.cultura_id);
    if (!c) return false;
    const base = getProductionBase(l, c.id);
    return base.method === 'unavailable';
  });

  // Basis label per lote (for legend)
  const basisLabel = (l) => {
    const c = getCultura(l.cultura_id);
    if (!c) return '⚠️';
    const base = getProductionBase(l, c.id);
    if (base.method === 'plants') return '🌱';
    if (base.method === 'cultivated_area') return '📐';
    return '⚠️';
  };

  // Compute total kg per year
  const kgByYear = {};
  years.forEach(yr => {
    let total = 0;
    lotes.forEach(l => {
      const c = getCultura(l.cultura_id);
      if (!c) return;
      const plantYear = new Date(l.data_plantio + 'T12:00:00').getFullYear();
      const factor = getRampFactor(c.id, yr - plantYear);
      const { kg } = estimateKgAnual(l, c.id, factor);
      total += kg;
    });
    kgByYear[yr] = total;
  });

  const maxKg = Math.max(1, ...years.map(y => kgByYear[y] || 0));
  const totalKgPico = Math.max(...years.map(y => kgByYear[y] || 0));
  const hasCulturas = Object.keys(culturaGroups).length > 0;

  if (!hasCulturas || maxKg <= 0) return null;

  const fmtTon = (kg) => kg >= 1000 ? `${(kg / 1000).toFixed(1)}t` : `${Math.round(kg)}kg`;

  // --- Item 1: kg/planta/ano for per_plant cultures ---
  // Collect per_plant lotes that have total_plantas > 0
  const perPlantLotes = lotes.filter(l => {
    const c = getCultura(l.cultura_id);
    if (!c) return false;
    const base = getProductionBase(l, c.id);
    return base.method === 'plants' && (l.total_plantas || 0) > 0;
  });

  // Compute kg/planta for the current (or nearest future) year with production
  let kgPorPlantaInfo = null;
  if (perPlantLotes.length > 0) {
    // Use the lote with the most plants as reference (or weighted average)
    const totalPlantas = perPlantLotes.reduce((s, l) => s + (l.total_plantas || 0), 0);
    // Weighted average kg/plant using current year's production
    let weightedKgPlanta = 0;
    perPlantLotes.forEach(l => {
      const c = getCultura(l.cultura_id);
      if (!c) return;
      const plantYear = new Date(l.data_plantio + 'T12:00:00').getFullYear();
      const factor = getRampFactor(c.id, currentYear - plantYear);
      const { kg } = estimateKgAnual(l, c.id, factor);
      const plantas = l.total_plantas || 0;
      if (plantas > 0) {
        weightedKgPlanta += (kg / plantas) * plantas;
      }
    });
    const avgKgPlanta = totalPlantas > 0 ? weightedKgPlanta / totalPlantas : 0;
    if (avgKgPlanta > 0) {
      kgPorPlantaInfo = {
        avg: avgKgPlanta,
        totalPlantas,
        lotesCount: perPlantLotes.length,
      };
    }
  }

  // --- Item 3: first harvest year indicator ---
  // Find earliest year where getRampFactor > 0 across all lotes
  let primeiraProducaoYear = null;
  lotes.forEach(l => {
    const c = getCultura(l.cultura_id);
    if (!c) return;
    const lc = safeResolveLifecycle(l, c);
    const plantYear = new Date(l.data_plantio + 'T12:00:00').getFullYear();
    // Find first year in the displayed range where factor > 0
    for (const yr of years) {
      const factor = getRampFactor(c.id, yr - plantYear);
      if (factor > 0) {
        if (primeiraProducaoYear === null || yr < primeiraProducaoYear) {
          // Prefer lc.dataPrimeiraProducao year if available
          if (lc?.dataPrimeiraProducao) {
            const lcYear = lc.dataPrimeiraProducao.getFullYear();
            if (primeiraProducaoYear === null || lcYear < primeiraProducaoYear) {
              primeiraProducaoYear = lcYear;
            }
          } else {
            primeiraProducaoYear = yr;
          }
        }
        break;
      }
    }
  });

  // Column width + gap for positioning the dashed line
  const colWidth = 44;
  const colGap = 8;
  const colUnit = colWidth + colGap; // 52px per column

  return (
    <Card>
      <div className="px-4 pt-4 pb-1 flex items-center gap-2 border-b border-gray-50">
        <Sprout size={14} className="text-green-500" />
        <span className="text-[13px] font-bold text-gray-700">Produção Estimada — kg/ano</span>
        {totalKgPico > 0 && (
          <span className="ml-auto text-[10px] font-bold text-green-600 bg-green-50 rounded-full px-2 py-0.5">
            Pico: {fmtTon(totalKgPico)}
          </span>
        )}
      </div>

      {/* Culture legend with basis tags */}
      <div className="px-4 pt-2 flex flex-wrap gap-2">
        {lotes.map(l => {
          const c = getCultura(l.cultura_id);
          if (!c) return null;
          return (
            <div key={l.id} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: c.cor }} />
              <span className="text-[10px] text-gray-500">
                {basisLabel(l)} {l.nome}
              </span>
            </div>
          );
        })}
      </div>

      {/* Item 1: kg/planta/ano info row */}
      {kgPorPlantaInfo && (
        <div className="px-4 pt-1 pb-0">
          <span className="text-[11px] font-bold text-green-700/80">
            🌱 ~{kgPorPlantaInfo.avg.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg/planta/ano
          </span>
          <span className="text-[10px] text-gray-400 ml-1">
            ({currentYear}, média ponderada · {kgPorPlantaInfo.totalPlantas.toLocaleString('pt-BR')} plantas)
          </span>
        </div>
      )}

      {/* Warning: lotes with no production basis */}
      {unavailableLotes.length > 0 && (
        <div className="mx-4 mt-2 mb-1 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-start gap-2">
          <span className="text-[13px] leading-none mt-0.5">⚠️</span>
          <div>
            <p className="text-[11px] font-bold text-amber-700 leading-tight">Dados insuficientes</p>
            <p className="text-[10px] text-amber-600/80 leading-snug mt-0.5">
              {unavailableLotes.map(l => l.nome).join(', ')} — sem contagem de plantas nem área cadastrada. Esses lotes não aparecem na projeção.
            </p>
          </div>
        </div>
      )}

      {/* Bar chart */}
      <div className="px-3 pt-3 pb-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        <div className="relative flex items-end gap-2" style={{ minWidth: years.length * colUnit }}>
          {/* Item 3: first harvest dashed line */}
          {primeiraProducaoYear !== null && years.includes(primeiraProducaoYear) && (() => {
            const idx = years.indexOf(primeiraProducaoYear);
            const lineLeft = idx * colUnit + colWidth / 2;
            return (
              <motion.div
                style={{
                  position: 'absolute',
                  left: lineLeft,
                  top: 0,
                  bottom: 16,
                  width: 1,
                  borderLeft: '1px dashed #16a34a',
                  pointerEvents: 'none',
                  zIndex: 10,
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.3 }}
              >
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 4,
                  background: 'rgba(255,255,255,0.92)',
                  borderRadius: 4,
                  padding: '1px 4px',
                  whiteSpace: 'nowrap',
                  fontSize: 9,
                  fontWeight: 700,
                  color: '#16a34a',
                  lineHeight: 1.4,
                }}>
                  🌾 Início
                </div>
              </motion.div>
            );
          })()}

          {years.map(yr => {
            const totalKg = kgByYear[yr] || 0;
            const isPast = yr < currentYear;
            const isCurrent = yr === currentYear;
            const barH = Math.round((totalKg / maxKg) * 90);
            return (
              <div key={yr} className="flex flex-col items-center flex-shrink-0" style={{ width: colWidth }}>
                {totalKg > 0 && (
                  <span className="text-[8px] text-gray-400 font-medium mb-0.5 text-center leading-none">
                    {fmtTon(totalKg)}
                  </span>
                )}
                <div style={{ height: 94 }} className="flex items-end">
                  <motion.div
                    className="rounded-t"
                    style={{
                      width: 28,
                      backgroundColor: isCurrent ? '#16a34a' : isPast ? '#86efac' : '#4ade80',
                    }}
                    initial={{ height: 0 }}
                    animate={{ height: barH || (totalKg > 0 ? 2 : 0) }}
                    transition={{ duration: 0.7, ease: 'easeOut', delay: 0.05 }}
                  />
                </div>
                <span
                  className="text-[9px] font-bold mt-1 text-center leading-none"
                  style={{ color: isCurrent ? '#16a34a' : isPast ? '#cbd5e1' : '#94a3b8' }}
                >
                  {yr}
                </span>
                {isCurrent && <div className="w-1 h-1 rounded-full bg-green-400 mt-0.5" />}
              </div>
            );
          })}
        </div>
      </div>

      <p className="px-4 pb-3 text-[9px] text-gray-400 leading-relaxed">
        * Estimativa baseada em benchmarks Embrapa por cultura. Manejo, clima e variedade afetam o resultado real.
      </p>
    </Card>
  );
}

/* ─── Projeção de Produção por Cultura ────────────────────── */

function ProjecaoProducaoCard({ lotes }) {
  const rows = [];
  lotes.forEach(lote => {
    const cultura = getCultura(lote.cultura_id);
    if (!cultura) return;
    const lc = safeResolveLifecycle(lote, cultura);
    const { qtdKg, receita } = calcProducaoLote(lote, cultura);
    if (receita === 0) return;
    const harvestDate = lc?.dataPrimeiraProducao;
    rows.push({ lote, cultura, qtdKg, receita, harvestDate, lc });
  });

  rows.sort((a, b) => {
    const ta = a.harvestDate?.getTime() ?? Infinity;
    const tb = b.harvestDate?.getTime() ?? Infinity;
    return ta - tb;
  });

  if (rows.length === 0) return null;

  const totalReceita = rows.reduce((s, r) => s + r.receita, 0);

  return (
    <Card>
      <div className="px-4 pt-4 pb-1 flex items-center gap-2 border-b border-gray-50">
        <TrendingUp size={14} className="text-green-500" />
        <span className="text-[13px] font-bold text-gray-700">Produção Estimada por Lote</span>
        <span className="ml-auto text-[10px] text-gray-400">{fmtBRL(totalReceita)}</span>
      </div>
      <div className="divide-y divide-gray-50">
        {rows.map(({ lote, cultura, qtdKg, receita, harvestDate, lc }) => {
          const pct = totalReceita > 0 ? (receita / totalReceita) * 100 : 0;
          const venda = cultura.venda;
          const isCampo = cultura.tipo === 'campo';
          const unidadeDisplay = venda?.unidade || 'kg';
          const diasRestantes = lc?.diasParaColheita;
          const pronto = lc?.prontoParaColheita;

          return (
            <div key={lote.id} className="px-4 py-3">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[15px] leading-none">{cultura.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold text-gray-800 truncate">{lote.nome}</p>
                  <p className="text-[10px] text-gray-400">
                    {cultura.nome}
                    {isCampo && lote.area_ha ? ` · ${parseFloat(lote.area_ha).toFixed(2)} ha` : ''}
                    {' · '}{Math.round(qtdKg).toLocaleString('pt-BR')} {unidadeDisplay}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[12px] font-bold text-green-700">{fmtBRL(receita)}</p>
                  {pronto ? (
                    <span className="text-[9px] font-bold text-amber-600 bg-amber-50 rounded-full px-1.5 py-0.5">
                      ⚠️ colher
                    </span>
                  ) : harvestDate ? (
                    <span className="text-[9px] text-gray-400">
                      {diasRestantes != null && diasRestantes <= 60
                        ? `em ${diasRestantes}d`
                        : String(harvestDate.getFullYear())}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
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

/* ─── Custo de Produção e Margem ──────────────────────────── */

function CustoProducaoCard({ lotes, todasVendas }) {
  const [movimentosPorLote, setMovimentosPorLote] = useState({});
  const [despesasPorLote, setDespesasPorLote] = useState({});
  const [loadingCustos, setLoadingCustos] = useState(true);

  useEffect(() => {
    if (lotes.length === 0) { setLoadingCustos(false); return; }
    let cancelled = false;
    Promise.all(
      lotes.map(l => Promise.all([
        loadMovimentosByLote(l.id).then(movs => movs),
        loadDespesasByLote(l.id).catch(() => []),
      ]).then(([movs, despesas]) => ({ id: l.id, movs, despesas })))
    ).then(results => {
      if (cancelled) return;
      const movMap = {};
      const despMap = {};
      results.forEach(({ id, movs, despesas }) => {
        movMap[id] = movs;
        despMap[id] = despesas;
      });
      setMovimentosPorLote(movMap);
      setDespesasPorLote(despMap);
      setLoadingCustos(false);
    }).catch(() => { if (!cancelled) setLoadingCustos(false); });
    return () => { cancelled = true; };
  }, [lotes]);

  if (loadingCustos) {
    return (
      <Card>
        <div className="px-4 py-6 flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-green-200 border-t-green-500 rounded-full animate-spin" />
          <span className="text-[12px] text-gray-400">Calculando custos…</span>
        </div>
      </Card>
    );
  }

  const rows = lotes.map(lote => {
    const cultura = getCultura(lote.cultura_id);
    if (!cultura) return null;

    // Insumo cost: sum(movimento.quantidade * insumo.preco_unitario) for saída movements
    const movs = movimentosPorLote[lote.id] || [];
    const custoInsumos = movs.reduce((sum, m) => {
      const preco = m.insumo?.preco_unitario ?? 0;
      return sum + (m.quantidade * preco);
    }, 0);

    // Labor cost: from mao_obra_total field on lote
    const maoObra = parseFloat(lote.mao_obra_total) || 0;

    // Expenses cost: from despesas table
    const despesas = despesasPorLote[lote.id] || [];
    const custoDespesas = despesas.reduce((s, d) => s + (d.valor ?? 0), 0);

    // Total cost
    const custoTotal = custoInsumos + maoObra + custoDespesas;

    // Revenue: from vendas (actual) or projected
    const vendasLote = todasVendas.filter(v => String(v.plantio_id) === String(lote.id));
    const receitaReal = vendasLote.reduce((s, v) => s + (v.quantidade * v.preco_unitario), 0);
    const { receita: receitaProjetada } = calcProducaoLote(lote, cultura);

    const hasReal = receitaReal > 0;
    const receita = hasReal ? receitaReal : receitaProjetada;
    const margem = receita - custoTotal;
    const pctMargem = receita > 0 ? Math.round((margem / receita) * 100) : null;

    return { lote, cultura, custoInsumos, maoObra, custoDespesas, custoTotal, receitaReal, receitaProjetada, receita, margem, pctMargem, hasReal };
  }).filter(Boolean);

  const lotesComCusto = rows.filter(r => r.custoTotal > 0 || r.receita > 0);
  if (lotesComCusto.length === 0) return null;

  const totalCusto   = lotesComCusto.reduce((s, r) => s + r.custoTotal, 0);
  const totalReceita = lotesComCusto.reduce((s, r) => s + r.receita, 0);
  const totalMargem  = totalReceita - totalCusto;

  // Custo por kg: total de saídas (insumos) / total de kg estimados
  const totalInsumosSaida = lotesComCusto.reduce((s, r) => s + r.custoInsumos, 0);
  const totalKgEstimado = lotes.reduce((s, l) => {
    const c = getCultura(l.cultura_id);
    if (!c) return s;
    const plantYear = new Date(l.data_plantio + 'T12:00:00').getFullYear();
    const currentYear = new Date().getFullYear();
    const factor = getRampFactor(c.id, currentYear - plantYear);
    const { kg } = estimateKgAnual(l, c.id, factor);
    return s + kg;
  }, 0);
  const custoKg = totalInsumosSaida > 0 && totalKgEstimado > 0
    ? totalInsumosSaida / totalKgEstimado
    : null;

  return (
    <Card>
      <div className="px-4 pt-4 pb-1 flex items-center gap-2 border-b border-gray-50">
        <Wrench size={14} className="text-green-500" />
        <span className="text-[13px] font-bold text-gray-700">Custo × Receita × Margem</span>
        {custoKg !== null && (
          <span className="ml-auto text-[10px] font-bold text-blue-600 bg-blue-50 rounded-full px-2 py-0.5">
            R$ {custoKg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/kg
          </span>
        )}
      </div>

      {/* Summary totals */}
      <div className="px-4 pt-3 pb-2 grid grid-cols-3 gap-2">
        <div className="bg-red-50 rounded-xl px-3 py-2">
          <p className="text-[9px] text-red-600/70 font-medium leading-none">Custo Total</p>
          <p className="text-[13px] font-bold text-red-700 leading-tight mt-0.5">{fmtBRL(totalCusto)}</p>
        </div>
        <div className="bg-green-50 rounded-xl px-3 py-2">
          <p className="text-[9px] text-green-600/70 font-medium leading-none">Receita</p>
          <p className="text-[13px] font-bold text-green-700 leading-tight mt-0.5">{fmtBRL(totalReceita)}</p>
        </div>
        <div className={`rounded-xl px-3 py-2 ${totalMargem >= 0 ? 'bg-emerald-50' : 'bg-orange-50'}`}>
          <p className={`text-[9px] font-medium leading-none ${totalMargem >= 0 ? 'text-emerald-600/70' : 'text-orange-600/70'}`}>Margem</p>
          <p className={`text-[13px] font-bold leading-tight mt-0.5 ${totalMargem >= 0 ? 'text-emerald-700' : 'text-orange-700'}`}>{fmtBRL(totalMargem)}</p>
        </div>
      </div>

      {/* Per-lote breakdown */}
      <div className="divide-y divide-gray-50">
        {lotesComCusto.map(({ lote, cultura, custoInsumos, maoObra, custoDespesas, custoTotal, receita, margem, pctMargem, hasReal }) => {
          const cor = cultura.cor;
          const isPositive = margem >= 0;
          return (
            <div key={lote.id} className="px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[14px]">{cultura.emoji}</span>
                <p className="text-[12px] font-bold text-gray-800 truncate flex-1">{lote.nome}</p>
                {pctMargem !== null && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                    {isPositive ? '+' : ''}{pctMargem}%
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-gray-400">Insumos</span>
                  <span className="font-semibold text-gray-600">{fmtBRL(custoInsumos)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Mão de obra</span>
                  <span className="font-semibold text-gray-600">{fmtBRL(maoObra)}</span>
                </div>
                {custoDespesas > 0 && (
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Despesas</span>
                    <span className="font-semibold">{fmtBRL(custoDespesas)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-400">Receita {hasReal ? '(real)' : '(proj.)'}</span>
                  <span className="font-semibold text-green-700">{fmtBRL(receita)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Margem</span>
                  <span className={`font-bold ${isPositive ? 'text-emerald-700' : 'text-red-600'}`}>{fmtBRL(margem)}</span>
                </div>
              </div>

              {lote.total_plantas > 0 && custoTotal > 0 && (
                <div className="flex justify-between text-[11px] mt-1 pt-1 border-t" style={{ borderColor: 'hsl(214 20% 91%)' }}>
                  <span className="text-muted-foreground font-semibold">Custo por planta</span>
                  <span className="font-bold" style={{ color: cor || '#16a34a' }}>
                    {fmtBRL(custoTotal / lote.total_plantas)}
                  </span>
                </div>
              )}

              {/* Cost bar */}
              {custoTotal > 0 && receita > 0 && (
                <div className="mt-2 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden flex">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: '#f87171', width: 0 }}
                    animate={{ width: `${Math.min(100, (custoTotal / Math.max(custoTotal, receita)) * 100)}%` }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                  />
                  <motion.div
                    className="h-full"
                    style={{ backgroundColor: '#4ade80', width: 0 }}
                    animate={{ width: `${Math.max(0, (margem / Math.max(custoTotal, receita)) * 100)}%` }}
                    transition={{ duration: 0.7, ease: 'easeOut', delay: 0.05 }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ─── Despesas por Categoria ──────────────────────────────── */

function DespesasPorCategoriaCard({ despesas }) {
  if (!despesas || despesas.length === 0) return null;

  const fmtBRL = (v) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0);

  // Group by category
  const porCategoria = despesas.reduce((acc, d) => {
    acc[d.categoria] = (acc[d.categoria] || 0) + (d.valor ?? 0);
    return acc;
  }, {});

  const sorted = Object.entries(porCategoria).sort(([, a], [, b]) => b - a);
  const total = sorted.reduce((s, [, v]) => s + v, 0);
  const maxVal = sorted[0]?.[1] || 1;

  return (
    <Card>
      <div className="px-4 pt-4 pb-1 flex items-center gap-2 border-b border-gray-50">
        <DollarSign size={14} className="text-orange-500" />
        <span className="text-[13px] font-bold text-gray-700">Despesas por Categoria</span>
        <span className="ml-auto text-[11px] font-bold text-orange-600">{fmtBRL(total)}</span>
      </div>
      <div className="px-4 py-3 flex flex-col gap-3">
        {sorted.slice(0, 6).map(([categoria, valor]) => {
          const pct = Math.round((valor / maxVal) * 100);
          return (
            <div key={categoria} className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-gray-700 truncate flex-1 mr-2">{categoria}</span>
                <span className="text-[11px] font-bold text-orange-600 flex-shrink-0">{fmtBRL(valor)}</span>
              </div>
              <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-orange-400"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                />
              </div>
            </div>
          );
        })}
        {sorted.length > 6 && (
          <p className="text-[10px] text-gray-400 text-center">
            + {sorted.length - 6} categoria{sorted.length - 6 !== 1 ? 's' : ''} adicional{sorted.length - 6 !== 1 ? 'is' : ''}
          </p>
        )}
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

export default function AnalysePage({ onSignOut, userName, propriedades = [], userRole = null }) {
  const [lotes, setLotes] = useState([]);
  const [eventosColheita, setEventosColheita] = useState([]);
  const [todasVendas, setTodasVendas] = useState([]);
  const [despesas, setDespesas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [selectedLoteId, setSelectedLoteId] = useState(null); // null = all

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([loadTodosLotes(500), loadAllColheitaEventos(), loadTodasVendas(), loadTodasDespesas()])
      .then(([data, eventos, vendas, desp]) => {
        if (!cancelled) {
          setLotes(Array.isArray(data) ? data : []);
          setEventosColheita(Array.isArray(eventos) ? eventos : []);
          setTodasVendas(Array.isArray(vendas) ? vendas : []);
          setDespesas(Array.isArray(desp) ? desp : []);
          setLoading(false);
        }
      })
      .catch((err) => {
        logDbError('AnalysePage.load', err);
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleExportPDF = async () => {
    setExportingPDF(true);
    try {
      await exportarRelatorioPDF(lotes, eventosColheita, todasVendas, propriedades);
    } finally {
      setExportingPDF(false);
    }
  };

  /* Derived stats — only active lotes */
  const lotesAtivos = lotes.filter((l) => l.status === 'ativo');
  const lotesFiltrados = selectedLoteId
    ? lotesAtivos.filter((l) => String(l.id) === selectedLoteId)
    : lotesAtivos;

  const totalPlantas = lotesAtivos.reduce((s, l) => s + (l.total_plantas || 0), 0);
  const areaAtiva = lotesAtivos.reduce((s, l) => s + (l.area_ha || 0), 0);

  // 10C: block technicians from the Analysis page
  if (userRole !== null && !can(userRole, FARM_ACTIONS.VIEW_ANALYSIS)) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
          <BarChart2 size={28} className="text-gray-300" />
        </div>
        <p className="text-[15px] font-bold text-gray-600">Acesso restrito</p>
        <p className="text-[13px] text-gray-400 leading-relaxed">
          A página de análises está disponível apenas para administradores da propriedade.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── Hero header ── */}
      <div className="gradient-hero text-white px-4 pb-6 flex flex-col gap-4" style={{ paddingTop: 'var(--hero-pad-top)' }}>
        {/* Top bar — pr-24 para não sobrepor os botões flutuantes à direita */}
        <div className="flex items-center justify-between pr-24">
          <div className="flex items-center gap-2 min-w-0">
            <BarChart2 size={18} className="opacity-80 flex-shrink-0" />
            <div className="min-w-0">
              <h1 className="text-[16px] font-bold leading-tight">Análise de Produção</h1>
              {userName && (
                <p className="text-[10px] text-white/60 leading-none mt-0.5 truncate">{userName}</p>
              )}
            </div>
          </div>
          {can(userRole ?? 'admin', FARM_ACTIONS.EXPORT_PDF) && (
            <button
              onClick={handleExportPDF}
              disabled={exportingPDF || lotes.length === 0}
              className="flex items-center gap-1.5 text-[11px] text-white/70 hover:text-white transition-colors bg-white/10 rounded-lg px-3 py-1.5 disabled:opacity-40 flex-shrink-0"
            >
              <FileDown size={12} />
              {exportingPDF ? 'Gerando…' : 'PDF'}
            </button>
          )}
        </div>

        {/* KPI cards — 4 in a 2×2 grid */}
        {(() => {
          const currentYear = new Date().getFullYear();
          // Compute prod/revenue estimates for current year
          let kgAnoAtual = 0;
          let receitaAnoAtual = 0;
          let anoPico = currentYear;
          let maxReceita = 0;
          const yearsToCheck = Array.from({ length: 7 }, (_, i) => currentYear - 1 + i);
          const projByYearKpi = {};
          lotesFiltrados.forEach(l => {
            const c = getCultura(l.cultura_id);
            if (!c) return;
            const plantYear = new Date(l.data_plantio + 'T12:00:00').getFullYear();
            yearsToCheck.forEach(yr => {
              const factor = getRampFactor(c.id, yr - plantYear);
              const { kg } = estimateKgAnual(l, c.id, factor);
              const priceKg = c.venda?.precoUnitario ?? 3.5;
              projByYearKpi[yr] = (projByYearKpi[yr] || 0) + kg * priceKg;
              if (yr === currentYear) {
                kgAnoAtual += kg;
                receitaAnoAtual += kg * priceKg;
              }
            });
          });
          yearsToCheck.forEach(yr => {
            if ((projByYearKpi[yr] || 0) > maxReceita) {
              maxReceita = projByYearKpi[yr];
              anoPico = yr;
            }
          });
          const areaFilt = lotesFiltrados.reduce((s, l) => s + (l.area_ha || 0), 0);
          return (
            <div className="grid grid-cols-2 gap-2">
              <StatCard icon={TrendingUp} label="Área Cultivada" value={`${areaFilt.toFixed(1)} ha`} accent="#86efac" />
              <StatCard icon={Leaf} label="Lotes Ativos" value={lotesFiltrados.length} />
              <StatCard icon={Sprout} label={`Prod. ${currentYear} (kg)`} value={kgAnoAtual > 0 ? `${(kgAnoAtual / 1000).toFixed(1)}t` : '—'} accent="#fde68a" />
              <StatCard icon={DollarSign} label={`Receita ${currentYear}`} value={receitaAnoAtual > 0 ? `R$${Math.round(receitaAnoAtual / 1000)}k` : '—'} accent="#86efac" />
            </div>
          );
        })()}

        {/* Per-lot filter pills */}
        {lotesAtivos.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            <button
              onClick={() => setSelectedLoteId(null)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all"
              style={!selectedLoteId
                ? { background: 'rgba(255,255,255,0.9)', color: 'hsl(160 84% 27%)' }
                : { background: 'rgba(255,255,255,0.20)', color: 'rgba(255,255,255,0.75)' }}
            >
              Todos
            </button>
            {lotesAtivos.map((l) => {
              const c = getCultura(l.cultura_id);
              const isActive = selectedLoteId === String(l.id);
              return (
                <button
                  key={l.id}
                  onClick={() => setSelectedLoteId(isActive ? null : String(l.id))}
                  className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all"
                  style={isActive
                    ? { background: 'rgba(255,255,255,0.9)', color: c?.cor || 'hsl(160 84% 27%)' }
                    : { background: 'rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.75)' }}
                >
                  {c?.emoji && <span>{c.emoji}</span>}
                  <span className="truncate max-w-[80px]">{l.nome}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div className="px-4 pt-5 pb-6 flex flex-col gap-5 flex-1">
        {loading ? (
          <Spinner />
        ) : lotes.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Projeção de Receita */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <SectionLabel>Projeção Financeira</SectionLabel>
              <ProjecaoReceitaCard lotes={lotesFiltrados} eventosColheita={eventosColheita} />
            </motion.div>

            {/* Produção em kg/ano */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.04 }}
            >
              <SectionLabel>Produção em kg/ano</SectionLabel>
              <ProjecaoKgCard lotes={lotesFiltrados} />
            </motion.div>

            {/* Produção Estimada por Lote */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
            >
              <SectionLabel>Receita por Lote</SectionLabel>
              <ProjecaoProducaoCard lotes={lotesFiltrados} />
            </motion.div>

            {/* Custo × Receita × Margem */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.12 }}
            >
              <SectionLabel>Custo × Margem</SectionLabel>
              <CustoProducaoCard lotes={lotesFiltrados} todasVendas={todasVendas} />
            </motion.div>

            {/* Distribuição por Cultura */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.08 }}
            >
              <SectionLabel>Distribuição</SectionLabel>
              <DistribuicaoCard lotes={lotesFiltrados} />
            </motion.div>

            {/* Status dos Lotes */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <SectionLabel>Status</SectionLabel>
              <StatusCard lotes={lotesFiltrados} />
            </motion.div>

            {/* Próximas Colheitas */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
            >
              <SectionLabel>Próximas Colheitas</SectionLabel>
              <ProximasColheitasCard lotes={lotesFiltrados} />
            </motion.div>

            {/* Indicadores de Campo */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <SectionLabel>Indicadores de Campo</SectionLabel>
              <IndicadoresCampoCard lotes={lotesFiltrados} allLotes={lotes} />
            </motion.div>

            {/* Despesas por Categoria */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.22 }}
            >
              <SectionLabel>Despesas por Categoria</SectionLabel>
              <DespesasPorCategoriaCard despesas={despesas} />
            </motion.div>

            {/* Resumo por Propriedade */}
            {propriedades.length > 0 || lotesAtivos.some((l) => l.propriedade_id != null) ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.25 }}
              >
                <SectionLabel>Por Propriedade</SectionLabel>
                <ResumoPorPropriedadeCard lotes={lotesFiltrados} propriedades={propriedades} />
              </motion.div>
            ) : null}

            {/* Histórico de Lotes */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
            >
              <SectionLabel>Histórico de Lotes</SectionLabel>
              <HistoricoList lotes={lotesFiltrados} />
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
