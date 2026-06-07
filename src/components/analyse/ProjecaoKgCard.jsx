/** ProjecaoKgCard — extraído de AnalysePage. */
import React from 'react';
import { motion } from 'framer-motion';
import { Sprout } from 'lucide-react';
import { estimateKgAnual, getProductionBase, getYieldConfig } from '../../constants/cropYields';
import { Card } from './ui';
import CalcNote from '../CalcNote';
import { getCultura, safeResolveLifecycle, getRampFactor } from './utils';

function ProjecaoKgCard({ lotes, eventosColheita = [], allLotes = [] }) {
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

  // --- Real productivity from completed lotes' harvest events ---
  // Build a map of plantio_id → total harvest kg from recorded events
  const harvestKgByLote = {};
  eventosColheita.forEach(ev => {
    try {
      const d = typeof ev.descricao === 'string' ? JSON.parse(ev.descricao) : (ev.descricao || {});
      const qtd = parseFloat(d?.qtd) || 0;
      const unidade = d?.unidade || 'kg';
      const qtdKg = unidade === 't' ? qtd * 1000 : qtd;
      if (qtdKg > 0 && ev.plantio_id) {
        harvestKgByLote[String(ev.plantio_id)] = (harvestKgByLote[String(ev.plantio_id)] || 0) + qtdKg;
      }
    } catch { /* ignore parse errors */ }
  });

  // Find completed lotes that have recorded harvest data
  const completedLotes = allLotes.filter(l =>
    (l.status === 'colhido' || l.status === 'concluido' || l.status === 'arquivado') &&
    (harvestKgByLote[String(l.id)] || 0) > 0
  );

  // Real kg/planta (for per_plant cultures with completed lotes)
  let realKgPlantaInfo = null;
  {
    const completedPerPlant = completedLotes.filter(l => {
      const c = getCultura(l.cultura_id);
      if (!c) return false;
      const base = getProductionBase(l, c.id);
      return base.method === 'plants' && (l.total_plantas || 0) > 0;
    });
    if (completedPerPlant.length > 0) {
      let totalPlantas = 0;
      let totalKgReal = 0;
      completedPerPlant.forEach(l => {
        totalPlantas += l.total_plantas || 0;
        totalKgReal += harvestKgByLote[String(l.id)] || 0;
      });
      if (totalPlantas > 0 && totalKgReal > 0) {
        let embrapaHaTotal = 0;
        let embrapaWeighted = 0;
        completedPerPlant.forEach(l => {
          const c = getCultura(l.cultura_id);
          const cfg = c ? getYieldConfig(c.id) : null;
          const plantas = l.total_plantas || 0;
          if (cfg && plantas > 0) { embrapaWeighted += cfg.defaultYieldValue * plantas; embrapaHaTotal += plantas; }
        });
        realKgPlantaInfo = {
          avg: totalKgReal / totalPlantas,
          totalPlantas,
          lotesCount: completedPerPlant.length,
          embrapaAvg: embrapaHaTotal > 0 ? embrapaWeighted / embrapaHaTotal : null,
        };
      }
    }
  }

  // Real kg/ha (for per_hectare cultures with completed lotes)
  let realKgHaInfo = null;
  {
    const completedPerHa = completedLotes.filter(l => {
      const c = getCultura(l.cultura_id);
      if (!c) return false;
      const base = getProductionBase(l, c.id);
      return base.method === 'cultivated_area' && (parseFloat(l.area_plantada_ha) || parseFloat(l.area_ha) || 0) > 0;
    });
    if (completedPerHa.length > 0) {
      let totalHa = 0;
      let totalKgReal = 0;
      completedPerHa.forEach(l => {
        const ha = parseFloat(l.area_plantada_ha) || parseFloat(l.area_ha) || 0;
        totalHa += ha;
        totalKgReal += harvestKgByLote[String(l.id)] || 0;
      });
      if (totalHa > 0 && totalKgReal > 0) {
        let embrapaHaTotal = 0;
        let embrapaWeighted = 0;
        completedPerHa.forEach(l => {
          const c = getCultura(l.cultura_id);
          const cfg = c ? getYieldConfig(c.id) : null;
          const ha = parseFloat(l.area_plantada_ha) || parseFloat(l.area_ha) || 0;
          if (cfg && ha > 0) { embrapaWeighted += cfg.defaultYieldValue * ha; embrapaHaTotal += ha; }
        });
        realKgHaInfo = {
          avg: totalKgReal / totalHa,
          totalHa,
          lotesCount: completedPerHa.length,
          embrapaAvg: embrapaHaTotal > 0 ? embrapaWeighted / embrapaHaTotal : null,
        };
      }
    }
  }

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

      <div className="px-4 pt-2">
        <CalcNote>
          <li>Produção <strong>in natura</strong> (fruta fresca), não polpa.</li>
          <li>Base: culturas por planta → nº de plantas × kg/planta/ano; culturas por área → ha × kg/ha/ano.</li>
          <li>Multiplicado pelo <strong>fator da curva de produção</strong> do ano (planta jovem produz menos).</li>
          <li>"Pico" = produção na maturidade plena (100% da curva).</li>
        </CalcNote>
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

      {/* Produtividade real (se houver dados de colheita registrados) */}
      {realKgPlantaInfo && (
        <div className="mx-4 mt-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[11px] font-bold text-green-700">📊 Real (média dos seus lotes)</span>
            <span className="text-[10px] text-green-600 bg-green-100 rounded-full px-1.5 py-0.5 font-semibold">
              {realKgPlantaInfo.avg.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg/planta
            </span>
            {realKgPlantaInfo.embrapaAvg != null && (() => {
              const pct = ((realKgPlantaInfo.avg - realKgPlantaInfo.embrapaAvg) / realKgPlantaInfo.embrapaAvg) * 100;
              const sign = pct >= 0 ? '+' : '';
              const color = pct >= 0 ? '#15803d' : '#b45309';
              return (
                <span className="text-[9px] font-bold rounded-full px-1.5 py-0.5" style={{ color, background: pct >= 0 ? '#dcfce7' : '#fef3c7' }}>
                  {sign}{pct.toFixed(0)}% vs Embrapa
                </span>
              );
            })()}
          </div>
          <p className="text-[9px] text-green-600/70">
            {realKgPlantaInfo.lotesCount} {realKgPlantaInfo.lotesCount === 1 ? 'lote concluído' : 'lotes concluídos'} · {realKgPlantaInfo.totalPlantas.toLocaleString('pt-BR')} plantas
          </p>
          {realKgPlantaInfo.embrapaAvg != null && (
            <p className="text-[9px] text-gray-400 mt-0.5">
              📖 Ref. Embrapa: {realKgPlantaInfo.embrapaAvg.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg/planta/ano
            </p>
          )}
        </div>
      )}
      {realKgHaInfo && (
        <div className="mx-4 mt-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[11px] font-bold text-green-700">📊 Real (média dos seus lotes)</span>
            <span className="text-[10px] text-green-600 bg-green-100 rounded-full px-1.5 py-0.5 font-semibold">
              {Math.round(realKgHaInfo.avg).toLocaleString('pt-BR')} kg/ha
            </span>
            {realKgHaInfo.embrapaAvg != null && (() => {
              const pct = ((realKgHaInfo.avg - realKgHaInfo.embrapaAvg) / realKgHaInfo.embrapaAvg) * 100;
              const sign = pct >= 0 ? '+' : '';
              const color = pct >= 0 ? '#15803d' : '#b45309';
              return (
                <span className="text-[9px] font-bold rounded-full px-1.5 py-0.5" style={{ color, background: pct >= 0 ? '#dcfce7' : '#fef3c7' }}>
                  {sign}{pct.toFixed(0)}% vs Embrapa
                </span>
              );
            })()}
          </div>
          <p className="text-[9px] text-green-600/70">
            {realKgHaInfo.lotesCount} {realKgHaInfo.lotesCount === 1 ? 'lote concluído' : 'lotes concluídos'} · {realKgHaInfo.totalHa.toFixed(2)} ha
          </p>
          {realKgHaInfo.embrapaAvg != null && (
            <p className="text-[9px] text-gray-400 mt-0.5">
              📖 Ref. Embrapa: {Math.round(realKgHaInfo.embrapaAvg).toLocaleString('pt-BR')} kg/ha/ano
            </p>
          )}
        </div>
      )}

      {/* Item 1: kg/planta/ano estimado (Embrapa) para lotes ativos */}
      {kgPorPlantaInfo && !realKgPlantaInfo && (
        <div className="px-4 pt-1 pb-0">
          <span className="text-[11px] font-bold text-green-700/80">
            📖 Embrapa ~{kgPorPlantaInfo.avg.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg/planta/ano
          </span>
          <span className="text-[10px] text-gray-400 ml-1">
            ({currentYear}, média ponderada · {kgPorPlantaInfo.totalPlantas.toLocaleString('pt-BR')} plantas · sem dados reais ainda)
          </span>
        </div>
      )}
      {kgPorPlantaInfo && realKgPlantaInfo && (
        <div className="px-4 pt-1 pb-0">
          <span className="text-[11px] font-bold text-green-700/80">
            🌱 ~{kgPorPlantaInfo.avg.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg/planta/ano
          </span>
          <span className="text-[10px] text-gray-400 ml-1">
            ({currentYear}, lotes ativos · {kgPorPlantaInfo.totalPlantas.toLocaleString('pt-BR')} plantas)
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
        {(realKgPlantaInfo || realKgHaInfo)
          ? '* Projeção baseada em estimativas Embrapa. Produtividade real calculada a partir dos seus registros de colheita.'
          : '* Estimativa baseada em benchmarks Embrapa por cultura. Registre colheitas para ver sua produtividade real aqui.'}
      </p>
    </Card>
  );
}
export default ProjecaoKgCard;
