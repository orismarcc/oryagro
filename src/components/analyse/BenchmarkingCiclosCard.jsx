/**
 * BenchmarkingCiclosCard — extraído de AnalysePage.jsx sem alterar a lógica.
 */
import React, { useState } from 'react';
import { Award } from 'lucide-react';
import { Card } from './ui';
import { fmtBRL, formatDate, getCultura, safeResolveLifecycle } from './utils';

function BenchmarkingCiclosCard({ ciclosHistorico, lotesAtivos }) {
  // Hooks devem ser chamados incondicionalmente, ANTES de qualquer early return,
  // senão a ordem dos hooks muda entre renders (Rules of Hooks) e o React quebra.
  const [activeIdx, setActiveIdx] = useState(null);

  if (!ciclosHistorico || ciclosHistorico.length === 0) {
    // Find lote closest to completion
    let maisProximo = null;
    let menorDiasRestantes = Infinity;
    lotesAtivos.forEach((lote) => {
      const cultura = getCultura(lote.cultura_id);
      if (!cultura) return;
      const lc = safeResolveLifecycle(lote, cultura);
      if (!lc) return;
      const dias = lc.diasParaColheita ?? Infinity;
      if (dias < menorDiasRestantes) {
        menorDiasRestantes = dias;
        maisProximo = lote;
      }
    });

    return (
      <Card>
        <div className="px-4 pt-4 pb-1 flex items-center gap-2 border-b border-gray-50">
          <Award size={14} className="text-purple-500" />
          <span className="text-[13px] font-bold text-gray-700">Benchmarking de Ciclos</span>
        </div>
        <div className="px-4 py-6 flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center">
            <Award size={22} className="text-purple-300" />
          </div>
          <p className="text-[13px] font-bold text-gray-600">Nenhum ciclo concluído ainda</p>
          <p className="text-[11px] text-gray-400 leading-relaxed max-w-[240px]">
            Conclua um ciclo para ver comparativos de desempenho entre lotes e culturas.
          </p>
          {maisProximo && (() => {
            const cultura = getCultura(maisProximo.cultura_id);
            const lc = safeResolveLifecycle(maisProximo, cultura);
            return (
              <div className="mt-1 bg-purple-50 rounded-xl px-4 py-2.5 flex items-center gap-2">
                <span className="text-[16px]">{cultura?.emoji}</span>
                <div className="text-left">
                  <p className="text-[11px] font-bold text-purple-700">{maisProximo.nome}</p>
                  <p className="text-[10px] text-purple-500">
                    {lc?.prontoParaColheita
                      ? 'Pronto para colheita'
                      : menorDiasRestantes < Infinity
                        ? `Colheita em ~${menorDiasRestantes}d`
                        : 'Mais próximo de concluir'}
                  </p>
                </div>
              </div>
            );
          })()}
        </div>
      </Card>
    );
  }

  // ── Build enriched ciclo rows ────────────────────────────────────────────────
  const ciclos = ciclosHistorico.map((c) => {
    const diasCiclo = c.dias_ciclo_real || 1;
    const kg = c.total_vendas_kg || 0;
    const receitaTotal = c.receita_total || 0;
    const custoInsumos = c.custo_insumos || 0;
    const custoMaoObra = c.custo_mao_obra || 0;
    const kgDia = diasCiclo > 0 ? kg / diasCiclo : 0;
    const receitaLiquida = receitaTotal - custoInsumos - custoMaoObra;
    const margemPct = receitaTotal > 0 ? (receitaLiquida / receitaTotal) * 100 : 0;
    const cultura = getCultura(c.cultura_id);
    return { ...c, kgDia, receitaLiquida, margemPct, cultura, diasCiclo, kg, receitaTotal };
  }).filter((c) => c.cultura !== null);

  // ── Group by cultura to show trend ──────────────────────────────────────────
  const porCultura = {};
  ciclos.forEach((c) => {
    if (!porCultura[c.cultura_id]) porCultura[c.cultura_id] = [];
    porCultura[c.cultura_id].push(c);
  });
  // Sort each group by data_conclusao asc (oldest first) to calc trend
  Object.values(porCultura).forEach((arr) =>
    arr.sort((a, b) => new Date(a.data_conclusao) - new Date(b.data_conclusao))
  );

  // ── Bar chart data: ciclos sorted by data_conclusao desc (newest first) ─────
  const sortedCiclos = [...ciclos].sort(
    (a, b) => new Date(b.data_conclusao) - new Date(a.data_conclusao)
  );

  const maxKgDia = Math.max(...ciclos.map((c) => c.kgDia), 0.001);
  const BAR_MAX_H = 80; // px

  // Trend computation per cultura: compare last ciclo vs previous
  const trends = {};
  Object.entries(porCultura).forEach(([culturaId, arr]) => {
    if (arr.length < 2) return;
    const last = arr[arr.length - 1];
    const prev = arr[arr.length - 2];
    if (prev.kgDia === 0) return;
    const pct = ((last.kgDia - prev.kgDia) / prev.kgDia) * 100;
    trends[culturaId] = pct;
  });

  return (
    <Card>
      <div className="px-4 pt-4 pb-1 flex items-center gap-2 border-b border-gray-50">
        <Award size={14} className="text-purple-500" />
        <span className="text-[13px] font-bold text-gray-700">Benchmarking de Ciclos</span>
        <span className="ml-auto text-[10px] text-gray-400">
          {ciclos.length} ciclo{ciclos.length !== 1 ? 's' : ''} concluído{ciclos.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Trend chips per cultura ───────────────────────────────────────────── */}
      {Object.entries(trends).length > 0 && (
        <div className="px-4 pt-3 flex flex-wrap gap-2">
          {Object.entries(trends).map(([culturaId, pct]) => {
            const cultura = getCultura(culturaId);
            if (!cultura) return null;
            const isUp = pct >= 0;
            return (
              <div
                key={culturaId}
                className="flex items-center gap-1.5 rounded-full px-3 py-1"
                style={{ background: isUp ? '#f0fdf4' : '#fff7ed' }}
              >
                <span className="text-[12px]">{cultura.emoji}</span>
                <span className="text-[10px] font-semibold" style={{ color: isUp ? '#15803d' : '#b45309' }}>
                  {isUp ? '↑' : '↓'} {Math.abs(pct).toFixed(0)}% kg/dia vs ciclo anterior
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Bar chart: kg/dia por ciclo ─────────────────────────────────────── */}
      <div className="px-3 pt-3 pb-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        <div className="flex items-end gap-2" style={{ minWidth: sortedCiclos.length * 52 }}>
          {sortedCiclos.map((ciclo, idx) => {
            const barH = Math.max(2, Math.round((ciclo.kgDia / maxKgDia) * BAR_MAX_H));
            const isActive = activeIdx === idx;
            return (
              <div
                key={ciclo.id ?? idx}
                className="flex flex-col items-center flex-shrink-0 cursor-pointer"
                style={{ width: 44 }}
                onClick={() => setActiveIdx(isActive ? null : idx)}
              >
                {ciclo.kgDia > 0 && (
                  <span className="text-[8px] text-gray-400 font-medium mb-0.5 text-center leading-none">
                    {ciclo.kgDia.toFixed(1)}
                  </span>
                )}
                <div style={{ height: BAR_MAX_H + 4 }} className="flex items-end">
                  <motion.div
                    className="rounded-t"
                    style={{
                      width: 28,
                      backgroundColor: ciclo.cultura?.cor || '#a78bfa',
                      opacity: isActive ? 1 : 0.75,
                      outline: isActive ? `2px solid ${ciclo.cultura?.cor || '#a78bfa'}` : 'none',
                      outlineOffset: 1,
                    }}
                    initial={{ height: 0 }}
                    animate={{ height: barH }}
                    transition={{ duration: 0.6, ease: 'easeOut', delay: idx * 0.04 }}
                  />
                </div>
                <span className="text-[8px] text-gray-400 font-medium mt-1 text-center leading-tight truncate w-full text-center">
                  {ciclo.lote_nome
                    ? ciclo.lote_nome.length > 6
                      ? ciclo.lote_nome.slice(0, 5) + '…'
                      : ciclo.lote_nome
                    : '—'}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-[9px] text-gray-400 mt-1 px-1">kg/dia — toque na barra para detalhes</p>
      </div>

      {/* ── Tooltip/detail panel on bar tap ────────────────────────────────── */}
      {activeIdx !== null && sortedCiclos[activeIdx] && (() => {
        const c = sortedCiclos[activeIdx];
        const cultura = c.cultura;
        const trend = trends[c.cultura_id];
        return (
          <motion.div
            className="mx-3 mb-3 rounded-xl border px-3 py-2.5 flex flex-col gap-1.5"
            style={{ background: '#faf5ff', borderColor: '#e9d5ff' }}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center gap-2">
              <span className="text-[16px]">{cultura?.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold text-purple-800 truncate">{c.lote_nome}</p>
                <p className="text-[10px] text-purple-500">{cultura?.nome}</p>
              </div>
              {trend !== undefined && (
                <span
                  className="text-[10px] font-bold rounded-full px-2 py-0.5 flex-shrink-0"
                  style={{
                    background: trend >= 0 ? '#dcfce7' : '#fef3c7',
                    color: trend >= 0 ? '#15803d' : '#b45309',
                  }}
                >
                  {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(0)}%
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
              <div className="flex justify-between gap-1">
                <span className="text-purple-400">Plantio</span>
                <span className="font-semibold text-purple-700">{formatDate(c.data_plantio)}</span>
              </div>
              <div className="flex justify-between gap-1">
                <span className="text-purple-400">Conclusão</span>
                <span className="font-semibold text-purple-700">{formatDate(c.data_conclusao)}</span>
              </div>
              <div className="flex justify-between gap-1">
                <span className="text-purple-400">Duração</span>
                <span className="font-semibold text-purple-700">{c.diasCiclo}d</span>
              </div>
              <div className="flex justify-between gap-1">
                <span className="text-purple-400">Total kg</span>
                <span className="font-semibold text-purple-700">
                  {c.kg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg
                </span>
              </div>
              <div className="flex justify-between gap-1">
                <span className="text-purple-400">kg/dia</span>
                <span className="font-bold text-purple-700">{c.kgDia.toFixed(2)}</span>
              </div>
              <div className="flex justify-between gap-1">
                <span className="text-purple-400">Receita bruta</span>
                <span className="font-semibold text-purple-700">{fmtBRL(c.receitaTotal)}</span>
              </div>
              <div className="flex justify-between gap-1">
                <span className="text-purple-400">Receita líquida</span>
                <span className={`font-bold ${c.receitaLiquida >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  {fmtBRL(c.receitaLiquida)}
                </span>
              </div>
              <div className="flex justify-between gap-1">
                <span className="text-purple-400">Margem</span>
                <span className={`font-bold ${c.margemPct >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  {c.margemPct >= 0 ? '+' : ''}{c.margemPct.toFixed(1)}%
                </span>
              </div>
            </div>
          </motion.div>
        );
      })()}

      {/* ── Per-cultura comparison table ─────────────────────────────────────── */}
      {Object.entries(porCultura).length > 0 && (
        <div className="px-4 pb-4 flex flex-col gap-3 mt-1">
          {Object.entries(porCultura).map(([culturaId, arr]) => {
            const cultura = getCultura(culturaId);
            if (!cultura) return null;
            const sorted = [...arr].sort(
              (a, b) => new Date(b.data_conclusao) - new Date(a.data_conclusao)
            );
            return (
              <div key={culturaId}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-[14px]">{cultura.emoji}</span>
                  <span className="text-[11px] font-bold text-gray-700">{cultura.nome}</span>
                  <span className="text-[9px] text-gray-400 ml-auto">
                    {arr.length} ciclo{arr.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  {sorted.map((ciclo, i) => (
                    <div
                      key={ciclo.id ?? i}
                      className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2"
                    >
                      <div
                        className="w-1.5 h-10 rounded-full flex-shrink-0"
                        style={{ backgroundColor: cultura.cor }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-gray-700 truncate">{ciclo.lote_nome}</p>
                        <p className="text-[9px] text-gray-400">
                          {formatDate(ciclo.data_plantio)} → {formatDate(ciclo.data_conclusao)} · {ciclo.diasCiclo}d
                        </p>
                      </div>
                      <div className="flex flex-col items-end flex-shrink-0">
                        <span className="text-[11px] font-bold text-gray-700">
                          {ciclo.kgDia.toFixed(2)} kg/d
                        </span>
                        <span
                          className="text-[9px] font-semibold"
                          style={{ color: ciclo.margemPct >= 0 ? '#15803d' : '#b45309' }}
                        >
                          {ciclo.margemPct >= 0 ? '+' : ''}{ciclo.margemPct.toFixed(0)}% mg
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="px-4 pb-3 text-[9px] text-gray-400 leading-relaxed">
        * kg/dia = total vendido ÷ dias do ciclo. Receita líquida = receita − insumos − mão de obra.
      </p>
    </Card>
  );
}

export default BenchmarkingCiclosCard;
