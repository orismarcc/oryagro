/** ProjecaoReceitaCard — extraído de AnalysePage. */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { DollarSign } from 'lucide-react';
import { estimateKgAnual } from '../../constants/cropYields';
import { Card } from './ui';
import CalcNote from '../CalcNote';
import { fmtBRL, getCultura, safeResolveLifecycle, getRampFactor } from './utils';

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

  // ── Polpa / In-natura ─────────────────────────────────────────────────────
  // Per-cultura toggle: 'inNatura' | 'polpa'
  const [modoProjecao, setModoProjecao] = useState({});
  // % rendimento: kg polpa / kg fruta (default 70%)
  const [rendimentos, setRendimentos] = useState({});
  // Preço R$/kg da polpa processada
  const [precosPolpa, setPrecosPolpa] = useState({});

  const getModo = (cid) => modoProjecao[cid] ?? 'inNatura';
  const getRendimento = (cid) => rendimentos[cid] ?? 70;
  const getPrecoPolpa = (cid) => precosPolpa[cid] ?? (prices[cid] ?? 5) * 2;

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

  // ── Compute projected revenue per year — modo polpa vs in-natura ─────────
  // projByYear = projeção PRINCIPAL (polpa se ativado, in-natura caso contrário)
  // projInNaturaByYear = projeção de referência in-natura (sempre calculada, só exibida)
  const projByYear = {};
  const projInNaturaByYear = {};
  const projPolpaByYear = {};

  years.forEach(yr => {
    let totalPrincipal = 0;
    let totalInNatura = 0;
    let totalPolpa = 0;

    lotes.forEach(l => {
      const c = getCultura(l.cultura_id);
      if (!c) return;
      const plantYear = new Date(l.data_plantio + 'T12:00:00').getFullYear();
      const yearFromPlant = yr - plantYear;
      const factor = getRampFactor(c.id, yearFromPlant);
      if (factor === 0) return;

      const { kg } = estimateKgAnual(l, c.id, factor);
      const priceInNatura = prices[c.id] ?? c.venda?.precoUnitario ?? 3.5;
      const rendPct = getRendimento(c.id) / 100;
      const pricePolpa = getPrecoPolpa(c.id);
      const modo = getModo(c.id);

      const receitaInNatura = kg * priceInNatura;
      const receitaPolpa = kg * rendPct * pricePolpa;

      totalInNatura += receitaInNatura;
      totalPolpa += receitaPolpa;
      totalPrincipal += modo === 'polpa' ? receitaPolpa : receitaInNatura;
    });

    projByYear[yr] = totalPrincipal;
    projInNaturaByYear[yr] = totalInNatura;
    projPolpaByYear[yr] = totalPolpa;
  });

  // Check if any cultura has polpa mode on
  const anyPolpaModo = Object.values(culturaGroups).some(({ cultura }) =>
    getModo(cultura.id) === 'polpa'
  );

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

      <div className="px-4 pt-2">
        <CalcNote>
          <li>Receita = produção estimada (kg) × preço por kg (editável acima).</li>
          <li>Produção (kg/ano) = nº de plantas (ou área) × rendimento da cultura × fator da curva de produção do ano.</li>
          <li>Preço: use o valor <strong>in natura</strong> (fruta fresca) ou o de <strong>polpa</strong> processada — cada um tem seu R$/kg.</li>
          <li>Não inclui custos — é receita bruta projetada.</li>
        </CalcNote>
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

      {/* ── Polpa / In-natura toggles ─────────────────────────────────────────── */}
      <div className="px-4 pt-2 pb-1 flex flex-col gap-2">
        {Object.values(culturaGroups).map(({ cultura }) => {
          const modo = getModo(cultura.id);
          const isPolpa = modo === 'polpa';
          return (
            <div
              key={cultura.id}
              className="rounded-xl border p-3"
              style={{
                background: isPolpa ? '#f0fdf4' : '#f8fafc',
                borderColor: isPolpa ? '#86efac' : '#e2e8f0',
              }}
            >
              {/* Cultura header + toggle */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px]">{cultura.emoji}</span>
                  <span className="text-[12px] font-bold text-foreground">{cultura.nome}</span>
                </div>
                <div className="flex rounded-lg overflow-hidden border border-gray-200 text-[10px] font-bold">
                  <button
                    onClick={() => setModoProjecao(p => ({ ...p, [cultura.id]: 'inNatura' }))}
                    className="px-2.5 py-1 transition-colors"
                    style={{
                      background: !isPolpa ? '#16a34a' : '#fff',
                      color: !isPolpa ? '#fff' : '#6b7280',
                    }}
                  >
                    🍒 In-natura
                  </button>
                  <button
                    onClick={() => setModoProjecao(p => ({ ...p, [cultura.id]: 'polpa' }))}
                    className="px-2.5 py-1 transition-colors"
                    style={{
                      background: isPolpa ? '#16a34a' : '#fff',
                      color: isPolpa ? '#fff' : '#6b7280',
                    }}
                  >
                    🧃 Polpa
                  </button>
                </div>
              </div>

              {/* In-natura: só mostra preço (já editável acima, mas repetimos aqui para clareza) */}
              {!isPolpa && (
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>Preço fruta in-natura:</span>
                  <span className="text-gray-400">R$</span>
                  <input
                    type="number" min="0" step="0.10"
                    value={prices[cultura.id] ?? ''}
                    onChange={e => setPrices(p => ({ ...p, [cultura.id]: parseFloat(e.target.value) || 0 }))}
                    className="w-16 text-[11px] font-bold text-green-700 bg-white rounded-lg px-2 py-1 border border-gray-200 outline-none text-right"
                  />
                  <span className="text-gray-400">/kg</span>
                </div>
              )}

              {/* Polpa: rendimento + preço polpa + referência in-natura */}
              {isPolpa && (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-3 items-center">
                    {/* Rendimento % */}
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="text-muted-foreground">Rendimento polpa:</span>
                      <input
                        type="number" min="1" max="100" step="1"
                        value={getRendimento(cultura.id)}
                        onChange={e => setRendimentos(p => ({ ...p, [cultura.id]: parseFloat(e.target.value) || 70 }))}
                        className="w-12 text-[11px] font-bold text-green-700 bg-white rounded-lg px-2 py-1 border border-gray-200 outline-none text-center"
                      />
                      <span className="text-muted-foreground">%</span>
                      <span className="text-[10px] text-gray-400 ml-1">
                        (1 kg fruta → {(getRendimento(cultura.id) / 100).toFixed(2)} kg polpa)
                      </span>
                    </div>
                    {/* Preço polpa */}
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="text-muted-foreground">R$/kg polpa:</span>
                      <input
                        type="number" min="0" step="0.10"
                        value={precosPolpa[cultura.id] ?? getPrecoPolpa(cultura.id)}
                        onChange={e => setPrecosPolpa(p => ({ ...p, [cultura.id]: parseFloat(e.target.value) || 0 }))}
                        className="w-16 text-[11px] font-bold text-green-700 bg-white rounded-lg px-2 py-1 border border-gray-200 outline-none text-right"
                      />
                    </div>
                  </div>
                  {/* Referência in-natura (não entra nos gráficos) */}
                  <div
                    className="flex items-center gap-2 text-[10px] rounded-lg px-2 py-1.5"
                    style={{ background: '#f1f5f9', color: '#64748b' }}
                  >
                    <span>📊 Ref. in-natura (preço:</span>
                    <input
                      type="number" min="0" step="0.10"
                      value={prices[cultura.id] ?? ''}
                      onChange={e => setPrices(p => ({ ...p, [cultura.id]: parseFloat(e.target.value) || 0 }))}
                      className="w-14 text-[10px] font-bold bg-white rounded px-1.5 py-0.5 border border-gray-200 outline-none text-right text-gray-600"
                    />
                    <span>/kg) — referência apenas, não entra nos gráficos</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Comparativo polpa × in-natura (quando polpa ativo) ───────────────── */}
      {anyPolpaModo && (
        <div className="mx-4 mb-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2.5">
          <p className="text-[10px] font-bold text-green-700 uppercase tracking-wide mb-1.5">
            Comparativo de projeção — próximos {years.length} anos
          </p>
          <div className="flex gap-4 flex-wrap">
            <div>
              <p className="text-[9px] text-green-600/70 font-medium">🧃 Polpa (modo ativo)</p>
              <p className="text-[15px] font-black text-green-700">
                {fmtBRL(years.reduce((s, y) => s + (projPolpaByYear[y] || 0), 0))}
              </p>
            </div>
            <div>
              <p className="text-[9px] text-gray-500 font-medium">🍒 In-natura (referência)</p>
              <p className="text-[15px] font-bold text-gray-600">
                {fmtBRL(years.reduce((s, y) => s + (projInNaturaByYear[y] || 0), 0))}
              </p>
            </div>
            <div>
              <p className="text-[9px] text-blue-500 font-medium">📈 Diferença</p>
              <p className="text-[15px] font-bold text-blue-600">
                {(() => {
                  const polpa = years.reduce((s, y) => s + (projPolpaByYear[y] || 0), 0);
                  const inNat = years.reduce((s, y) => s + (projInNaturaByYear[y] || 0), 0);
                  const diff = polpa - inNat;
                  return (diff >= 0 ? '+' : '') + fmtBRL(diff);
                })()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Total projection chip */}
      {totalProjAll > 0 && (
        <div className="px-4 pt-2 flex items-center gap-3 flex-wrap">
          <div className="inline-flex items-center gap-1.5 bg-green-50 rounded-xl px-3 py-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-green-400" />
            <div>
              <p className="text-[9px] text-green-600/70 font-medium leading-none">
                {anyPolpaModo ? '🧃 Projeção com polpa' : '🍒 Projeção in-natura'} — {years[0]}–{years[years.length - 1]}
              </p>
              <p className="text-[14px] font-bold text-green-700 leading-tight">{fmtBRL(totalProjAll)}</p>
            </div>
          </div>
          {anyPolpaModo && (
            <div className="inline-flex items-center gap-1.5 bg-gray-50 rounded-xl px-3 py-1.5 border border-gray-200">
              <div className="w-2.5 h-2.5 rounded-sm bg-gray-400" />
              <div>
                <p className="text-[9px] text-gray-500 font-medium leading-none">🍒 Ref. in-natura</p>
                <p className="text-[14px] font-bold text-gray-600 leading-tight">
                  {fmtBRL(years.reduce((s, y) => s + (projInNaturaByYear[y] || 0), 0))}
                </p>
              </div>
            </div>
          )}
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
export default ProjecaoReceitaCard;
