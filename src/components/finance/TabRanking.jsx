/**
 * TabRanking — aba 3 do FinanceiroPage (com RANKING_CRITERIOS). Extraído verbatim.
 */
import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, Spinner, EmptyState } from './ui';
import { fmtBRL, fmtPct, getCultura, buildDreMap } from './helpers';
import { aggregateDreEntry } from '../../lib/financeiro';

/* ─── Aba 3: Ranking de Culturas ─────────────────────────────── */

const RANKING_CRITERIOS = [
  { key: 'receita', label: 'Maior receita' },
  { key: 'margem', label: 'Maior margem' },
  { key: 'custoKg', label: 'Menor custo/kg' },
];

function TabRanking({ rawData, loading }) {
  const [criterio, setCriterio] = useState('receita');

  const dreMap = useMemo(() => (rawData ? buildDreMap(rawData) : {}), [rawData]);
  const plantios = rawData?.plantios ?? [];

  // Calcular métricas por cultura
  const ranking = useMemo(() => {
    const byCultura = {};

    Object.entries(dreMap).forEach(([pid, byAno]) => {
      const lote = plantios.find((p) => String(p.id) === pid);
      if (!lote || !lote.cultura_id) return;
      const cid = lote.cultura_id;
      if (!byCultura[cid]) {
        byCultura[cid] = {
          cultura_id: cid,
          receita: 0,
          custo: 0,
          lucro: 0,
          kgTotal: 0,
          margemValues: [],
        };
      }
      const entry = byCultura[cid];

      Object.values(byAno).forEach((e) => {
        if (e.receita === 0) return; // ignorar anos sem venda
        // A4-01: aggregateDreEntry inclui mão de obra (antes TabRanking omitia)
        const agg = aggregateDreEntry(e);
        entry.receita += agg.receita;
        entry.custo   += agg.custo;
        entry.lucro   += agg.lucro;
        const kg = e.vendas.reduce((s, v) => s + (v.quantidade ?? 0), 0);
        entry.kgTotal += kg;
        if (agg.receita > 0) entry.margemValues.push((agg.lucro / agg.receita) * 100);
      });
    });

    return Object.values(byCultura)
      .filter((c) => c.receita > 0)
      .map((c) => ({
        ...c,
        margemMedia: c.margemValues.length > 0
          ? c.margemValues.reduce((a, b) => a + b, 0) / c.margemValues.length
          : null,
        custoKg: c.kgTotal > 0 ? c.custo / c.kgTotal : null,
      }));
  }, [dreMap, plantios]);

  const sorted = useMemo(() => {
    return [...ranking].sort((a, b) => {
      if (criterio === 'receita') return b.receita - a.receita;
      if (criterio === 'margem') {
        const ma = a.margemMedia ?? -Infinity;
        const mb = b.margemMedia ?? -Infinity;
        return mb - ma;
      }
      if (criterio === 'custoKg') {
        const ca = a.custoKg ?? Infinity;
        const cb = b.custoKg ?? Infinity;
        return ca - cb;
      }
      return 0;
    });
  }, [ranking, criterio]);

  if (loading) return <Spinner />;
  if (sorted.length === 0)
    return <EmptyState message="Nenhuma cultura com vendas registradas." />;

  const maxReceita = Math.max(1, ...sorted.map((c) => c.receita));

  return (
    <div className="page-body pt-4 pb-8 flex flex-col gap-5">
      {/* Botões de critério */}
      <div className="flex gap-2 flex-wrap">
        {RANKING_CRITERIOS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setCriterio(key)}
            className="px-3 py-1.5 rounded-full text-[11px] font-bold transition-all"
            style={
              criterio === key
                ? { background: 'hsl(156 64% 31%)', color: 'white' }
                : { background: '#f3f4f6', color: '#6b7280' }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* Cards ordenados */}
      <div className="flex flex-col gap-3">
        {sorted.map((c, idx) => {
          const cultura = getCultura(c.cultura_id);
          const isPositive = c.lucro >= 0;
          const barPct = (c.receita / maxReceita) * 100;

          return (
            <motion.div
              key={c.cultura_id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.04 }}
            >
              <Card>
                <div className="px-4 py-3">
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[10px] font-bold text-gray-300 flex-shrink-0 w-4">
                      #{idx + 1}
                    </span>
                    <span className="text-[20px] leading-none">{cultura?.emoji ?? '🌱'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-gray-800 leading-none">
                        {cultura?.nome ?? c.cultura_id}
                      </p>
                      {c.kgTotal > 0 && (
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {c.kgTotal.toLocaleString('pt-BR')} kg colhido
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[14px] font-bold text-green-700">{fmtBRL(c.receita)}</p>
                      <p className={`text-[10px] font-bold ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                        {c.margemMedia != null ? `${fmtPct(c.margemMedia)} margem` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Métricas em linha */}
                  <div className="grid grid-cols-3 gap-2 mb-3 text-[10px]">
                    <div className="bg-red-50 rounded-lg px-2 py-1.5">
                      <p className="text-red-500/70 font-medium">Custo total</p>
                      <p className="font-bold text-red-600">{fmtBRL(c.custo)}</p>
                    </div>
                    <div className={`rounded-lg px-2 py-1.5 ${isPositive ? 'bg-emerald-50' : 'bg-red-50'}`}>
                      <p className={`font-medium ${isPositive ? 'text-emerald-500/70' : 'text-red-500/70'}`}>Lucro</p>
                      <p className={`font-bold ${isPositive ? 'text-emerald-700' : 'text-red-700'}`}>
                        {fmtBRL(c.lucro)}
                      </p>
                    </div>
                    <div className="bg-blue-50 rounded-lg px-2 py-1.5">
                      <p className="text-blue-500/70 font-medium">Custo/kg</p>
                      <p className="font-bold text-blue-700">
                        {c.custoKg != null ? fmtBRL(c.custoKg) : '—'}
                      </p>
                    </div>
                  </div>

                  {/* Barra de margem visual */}
                  {c.margemMedia != null && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] text-gray-400">Margem média</span>
                        <span className={`text-[10px] font-bold ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                          {fmtPct(c.margemMedia)}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${isPositive ? 'bg-emerald-400' : 'bg-red-400'}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, Math.abs(c.margemMedia))}%` }}
                          transition={{ duration: 0.7, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
export default TabRanking;
