import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from 'recharts';
import {
  ChevronLeft,
  TrendingUp,
  TrendingDown,
  BarChart2,
  Award,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { CULTURAS } from '../data/culturas';
import { loadDreRawData } from '../hooks/useFinanceiro';
import { loadMaoObraBatch } from '../hooks/useGestao';
import { logDbError } from '../lib/logger';
import { calcLucroLote, aggregateDreEntry } from '../lib/financeiro';
import { useRealtimeSync } from '../hooks/useRealtimeSync';

import { fmtBRL, fmtPct, formatDateBR, getCultura, anoFromDate, buildDreMap } from './finance/helpers';
import { Card, SectionLabel, Spinner, EmptyState } from './finance/ui';
import TabComparativo from './finance/TabComparativo';
import TabRanking from './finance/TabRanking';

/* ─── Rentabilidade por Cultura (card colapsável) ────────────── */

function RentabilidadePorCultura({ rawData, anoFiltro }) {
  const [aberto, setAberto] = useState(false);

  const dados = useMemo(() => {
    if (!rawData) return [];
    const { plantios = [], vendas = [], despesas = [], movimentos = [], maoObraMap = {} } = rawData;

    const byCultura = {};

    plantios.forEach((p) => {
      const cid = p.cultura_id;
      if (!cid) return;
      const cultura = CULTURAS[cid];
      if (!cultura) return;

      // Filtrar por ano se necessário
      const filtrarAno = (dateStr) => {
        if (!anoFiltro) return true;
        const ano = dateStr ? new Date(dateStr + 'T12:00:00').getFullYear() : null;
        return ano === Number(anoFiltro);
      };

      const pid = p.id;

      // Receita das vendas desse plantio
      const receitaPlantio = vendas
        .filter((v) => v.plantio_id === pid && filtrarAno(v.data))
        .reduce((s, v) => s + (v.quantidade ?? 0) * (v.preco_unitario ?? 0), 0);

      if (receitaPlantio === 0) return; // sem venda = não conta

      // Custos insumos (movimentos de saída)
      const custoInsumos = movimentos
        .filter((m) => m.plantio_id === pid && filtrarAno(m.data))
        .reduce((s, m) => s + (m.quantidade ?? 0) * (m.estoque_insumos?.preco_unitario ?? 0), 0);

      // Despesas diretas
      const custoDespesas = despesas
        .filter((d) => d.plantio_id === pid && filtrarAno(d.data))
        .reduce((s, d) => s + (d.valor ?? 0), 0);

      // Mão de obra
      const registros = maoObraMap[pid] || [];
      const custoMO = registros.length > 0
        ? registros.reduce((s, r) => s + (r.horas * r.valor_hora), 0)
        : parseFloat(p.mao_obra_total) || 0;

      const margem = receitaPlantio - custoInsumos - custoDespesas - custoMO;

      // Área / plantas para calcular R$/m² ou R$/planta
      const area = parseFloat(p.area) || 0; // ha ou m² dependendo do tipo
      const qtdPlantas = parseFloat(p.quantidade_plantas) || parseFloat(p.num_plantas) || 0;

      if (!byCultura[cid]) {
        byCultura[cid] = {
          cid,
          nome: cultura.nome,
          emoji: cultura.emoji || '🌱',
          cor: cultura.cor || '#4ade80',
          tipo: cultura.tipo, // 'canteiro' | 'campo'
          margem: 0,
          areaTotal: 0,
          plantasTotal: 0,
          ciclos: 0,
        };
      }

      byCultura[cid].margem += margem;
      byCultura[cid].areaTotal += area;
      byCultura[cid].plantasTotal += qtdPlantas;
      byCultura[cid].ciclos += 1;
    });

    return Object.values(byCultura)
      .filter((c) => c.ciclos > 0)
      .map((c) => {
        let metrica = null;
        let metricaLabel = null;
        if (c.tipo === 'canteiro') {
          if (c.plantasTotal > 0) {
            metrica = c.margem / c.plantasTotal;
            metricaLabel = 'R$/planta';
          } else if (c.areaTotal > 0) {
            metrica = c.margem / c.areaTotal;
            metricaLabel = 'R$/m²';
          }
        } else {
          // campo — área em ha, converter para m²
          if (c.areaTotal > 0) {
            metrica = c.margem / (c.areaTotal * 10000);
            metricaLabel = 'R$/m²';
          }
        }
        return { ...c, metrica, metricaLabel };
      })
      .sort((a, b) => b.margem - a.margem);
  }, [rawData, anoFiltro]);

  if (dados.length === 0) return null;

  const semDados = dados.every((d) => d.ciclos === 0);

  return (
    <div className="mt-1">
      <button
        onClick={() => setAberto((v) => !v)}
        className="w-full flex items-center justify-between px-1 py-1.5 text-left"
      >
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400/80">
          Rentabilidade por cultura
        </span>
        {aberto
          ? <ChevronUp size={12} className="text-gray-300" />
          : <ChevronDown size={12} className="text-gray-300" />}
      </button>

      <AnimatePresence>
        {aberto && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="overflow-hidden"
          >
            <Card className="mt-1">
              <div className="px-4 pt-3 pb-4">
                {semDados ? (
                  <p className="text-[11px] text-gray-400 text-center py-4">
                    Sem histórico suficiente ainda
                  </p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={Math.max(80, dados.length * 44)}>
                      <BarChart
                        data={dados}
                        layout="vertical"
                        margin={{ top: 0, right: 8, left: 4, bottom: 0 }}
                      >
                        <XAxis
                          type="number"
                          tickFormatter={(v) =>
                            v === 0 ? '0' : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(Math.round(v))
                          }
                          tick={{ fontSize: 9, fill: '#9ca3af' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="nome"
                          tick={{ fontSize: 11, fill: '#374151' }}
                          width={72}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(nome) => {
                            const item = dados.find((d) => d.nome === nome);
                            return item ? `${item.emoji} ${nome}` : nome;
                          }}
                        />
                        <Tooltip
                          formatter={(value) => [fmtBRL(value), 'Margem líquida']}
                          labelFormatter={(label) => {
                            const item = dados.find((d) => d.nome === label);
                            return item ? `${item.emoji} ${label}` : label;
                          }}
                          contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }}
                        />
                        <Bar dataKey="margem" radius={[0, 4, 4, 0]} maxBarSize={22}>
                          {dados.map((entry) => (
                            <Cell key={entry.cid} fill={entry.margem >= 0 ? entry.cor : '#f87171'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>

                    {/* R$/m² ou R$/planta abaixo do gráfico */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 pt-2 border-t border-gray-50">
                      {dados.map((d) => (
                        <div key={d.cid} className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: d.cor }}
                          />
                          <span className="text-[10px] text-gray-500">
                            {d.emoji} {d.nome}:
                          </span>
                          {d.metrica != null ? (
                            <span className="text-[10px] font-bold text-gray-700">
                              {fmtBRL(d.metrica)}/{d.metricaLabel === 'R$/planta' ? 'planta' : 'm²'}
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400">—</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Aba 1: DRE ──────────────────────────────────────────────── */

function DreLine({ ano, entry, expanded, onToggle }) {
  const { receita, custo_insumos, custo_despesas, lucro, margem, isLegacyMO, vendas, movimentos, despesas } = entry;
  const isPositive = lucro >= 0;

  return (
    <div>
      {/* Linha da tabela clicável */}
      <button
        onClick={onToggle}
        className="w-full text-left"
      >
        <div className="grid grid-cols-6 gap-1 px-3 py-2.5 hover:bg-gray-50 transition-colors items-center">
          <div className="flex items-center gap-1 col-span-1">
            <span className="text-[12px] font-bold text-gray-800">{ano}</span>
            {expanded
              ? <ChevronUp size={12} className="text-gray-400 flex-shrink-0" />
              : <ChevronDown size={12} className="text-gray-400 flex-shrink-0" />}
          </div>
          <span className="text-[11px] text-green-700 font-semibold text-right">
            {fmtBRL(receita)}
          </span>
          <span className="text-[11px] text-red-600 text-right">
            {fmtBRL(custo_insumos)}
          </span>
          <div className="text-right flex items-center justify-end gap-1">
            <span className="text-[11px] text-orange-600">
              {fmtBRL(custo_despesas)}
            </span>
            {isLegacyMO && (
              <span className="text-[8px] font-bold bg-amber-100 text-amber-600 rounded px-1 py-0.5 flex-shrink-0">
                leg.
              </span>
            )}
          </div>
          <span className={`text-[11px] font-bold text-right ${isPositive ? 'text-emerald-700' : 'text-red-700'}`}>
            {fmtBRL(lucro)}
          </span>
          <span className={`text-[10px] font-semibold text-right ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
            {fmtPct(margem)}
          </span>
        </div>
      </button>

      {/* Breakdown expandido */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="overflow-hidden"
          >
            <div className="bg-gray-50 px-3 pb-3 pt-2 flex flex-col gap-3 border-t border-gray-100">
              {/* Vendas */}
              {vendas.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-green-700/60 mb-1.5">
                    Vendas ({vendas.length})
                  </p>
                  <div className="flex flex-col gap-1">
                    {vendas.map((v) => (
                      <div key={v.id} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold text-gray-700">
                            {formatDateBR(v.data)}
                            {v.destino && (
                              <span className="ml-2 text-gray-400 font-normal">{v.destino}</span>
                            )}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {v.quantidade} {v.unidade} × {fmtBRL(v.preco_unitario)}
                          </p>
                        </div>
                        <span className="text-[12px] font-bold text-green-700 flex-shrink-0">
                          {fmtBRL(v.valor)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Saídas de insumos */}
              {movimentos.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-red-600/60 mb-1.5">
                    Insumos usados ({movimentos.length})
                  </p>
                  <div className="flex flex-col gap-1">
                    {movimentos.map((m) => (
                      <div key={m.id} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold text-gray-700">
                            {m.estoque_insumos?.nome ?? 'Insumo'}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {formatDateBR(m.data)} · {m.quantidade} {m.estoque_insumos?.unidade ?? ''} × {fmtBRL(m.estoque_insumos?.preco_unitario ?? 0)}
                          </p>
                        </div>
                        <span className="text-[12px] font-bold text-red-600 flex-shrink-0">
                          {fmtBRL(m.custo)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Despesas */}
              {despesas.length > 0 ? (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-orange-600/60 mb-1.5">
                    Despesas ({despesas.length})
                  </p>
                  <div className="flex flex-col gap-1">
                    {despesas.map((d) => (
                      <div key={d.id} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold text-gray-700">
                            {d.categoria}{d.subcategoria ? ` · ${d.subcategoria}` : ''}
                          </p>
                          {d.descricao && (
                            <p className="text-[10px] text-gray-500">{d.descricao}</p>
                          )}
                          {d.prestador && (
                            <p className="text-[10px] text-gray-500 font-medium">👤 {d.prestador}</p>
                          )}
                          <p className="text-[10px] text-gray-400">{formatDateBR(d.data)}</p>
                        </div>
                        <span className="text-[12px] font-bold text-orange-600 flex-shrink-0">
                          {fmtBRL(d.valor)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : isLegacyMO && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-orange-600/60 mb-1.5">
                    Despesas (legado)
                  </p>
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                    <span className="text-[10px] text-amber-700 flex-1">
                      Valor legado registrado no lote (sem detalhamento)
                    </span>
                    <span className="text-[12px] font-bold text-orange-600 flex-shrink-0">
                      {fmtBRL(custo_despesas)}
                    </span>
                  </div>
                </div>
              )}

              {vendas.length === 0 && movimentos.length === 0 && despesas.length === 0 && !isLegacyMO && (
                <p className="text-[11px] text-gray-400 text-center py-2">Sem detalhes disponíveis.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LoteCard({ lote, dreMap, anoFiltro, propriedades }) {
  const [collapsed, setCollapsed] = useState(true);
  const [expandedAnos, setExpandedAnos] = useState({});

  const cultura = getCultura(lote.cultura_id);
  const anoEntries = dreMap[String(lote.id)] || {};

  // Calcular lucro e margem por ano — usando fórmula compartilhada com AnalysePage
  const anosComDados = Object.entries(anoEntries)
    .filter(([ano]) => !anoFiltro || Number(ano) === Number(anoFiltro))
    .map(([ano, entry]) => {
      // buildDreMap already resolved the legacy/registros branching into custo_mao_obra.
      // We pass a non-empty registros sentinel so calcLucroLote uses entry.custo_mao_obra
      // as the authoritative value instead of falling back to lote.mao_obra_total.
      const maoObraData = entry.custo_mao_obra > 0
        ? { registros: [{}], total: entry.custo_mao_obra }
        : { registros: [], total: 0 };
      const result = calcLucroLote({
        lote,
        custoInsumos: entry.custo_insumos,
        custoDespesas: entry.custo_despesas,
        maoObraData,
        receitaVendas: entry.receita,
        receitaExtras: 0,
      });
      const lucro = result.lucro;
      const margem = result.margemPct !== null ? result.margemPct : null;
      return [Number(ano), { ...entry, lucro, margem }];
    })
    .sort(([a], [b]) => b - a); // mais recente primeiro

  if (anosComDados.length === 0) return null;

  const totalReceita = anosComDados.reduce((s, [, e]) => s + e.receita, 0);
  const totalLucro = anosComDados.reduce((s, [, e]) => s + e.lucro, 0);

  const statusBadge =
    lote.status === 'ativo' ? (
      <span className="text-[9px] font-bold text-blue-600 bg-blue-50 rounded-full px-2 py-0.5 flex-shrink-0">
        Ativo
      </span>
    ) : (
      <span className="text-[9px] font-bold text-gray-400 bg-gray-100 rounded-full px-2 py-0.5 flex-shrink-0">
        Concluído
      </span>
    );

  const toggleAno = (ano) =>
    setExpandedAnos((prev) => ({ ...prev, [ano]: !prev[ano] }));

  return (
    <Card className="overflow-visible">
      {/* Header do card de lote */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <span className="text-[18px] leading-none flex-shrink-0">
          {cultura?.emoji ?? '🌱'}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-gray-800 truncate">{lote.nome}</p>
          <p className="text-[10px] text-gray-400">
            {cultura?.nome ?? '—'} · {totalReceita > 0 ? fmtBRL(totalReceita) : 'Sem receita'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {statusBadge}
          <span
            className={`text-[11px] font-bold ${totalLucro >= 0 ? 'text-emerald-700' : 'text-red-600'}`}
          >
            {fmtBRL(totalLucro)}
          </span>
          {collapsed
            ? <ChevronDown size={14} className="text-gray-400" />
            : <ChevronUp size={14} className="text-gray-400" />}
        </div>
      </button>

      {/* Conteúdo colapsável */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="overflow-hidden"
          >
            {/* Cabeçalho da tabela */}
            <div className="grid grid-cols-6 gap-1 px-3 py-1.5 bg-gray-50 border-t border-gray-100">
              {['Ano', 'Receita', 'Insumos', 'Despesas', 'Lucro', 'Margem'].map((h) => (
                <span key={h} className="text-[9px] font-bold uppercase tracking-wider text-gray-400 text-right first:text-left">
                  {h}
                </span>
              ))}
            </div>

            <div className="divide-y divide-gray-50">
              {anosComDados.map(([ano, entry]) => (
                <DreLine
                  key={ano}
                  ano={ano}
                  entry={entry}
                  expanded={!!expandedAnos[ano]}
                  onToggle={() => toggleAno(ano)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

function TabDRE({ rawData, loading, propriedades }) {
  const [anoFiltro, setAnoFiltro] = useState('');
  const [propFiltro, setPropFiltro]       = useState('');
  const [culturaFiltro, setCulturaFiltro] = useState('');

  const dreMap = useMemo(() => (rawData ? buildDreMap(rawData) : {}), [rawData]);

  // Despesas indiretas da propriedade (sem plantio_id = custos indiretos)
  const despesasIndiretas = useMemo(
    () => (rawData?.despesas || []).filter((d) => !d.plantio_id && d.data),
    [rawData]
  );

  // Anos disponíveis nos dados
  const anosDisponiveis = useMemo(() => {
    const anos = new Set();
    Object.values(dreMap).forEach((byAno) => {
      Object.keys(byAno).forEach((ano) => anos.add(Number(ano)));
    });
    return [...anos].sort((a, b) => b - a);
  }, [dreMap]);

  // Agrupar plantios por propriedade
  const plantios = rawData?.plantios ?? [];

  const getPropNome = (pid) => {
    if (pid === '__sem__') return 'Sem propriedade';
    const prop = propriedades.find((p) => String(p.id) === pid);
    return prop ? prop.nome : `Propriedade ${pid}`;
  };

  const propriedadeGroups = useMemo(() => {
    const groups = {};
    plantios.forEach((p) => {
      const pid = p.propriedade_id ? String(p.propriedade_id) : '__sem__';
      if (!groups[pid]) groups[pid] = [];
      groups[pid].push(p);
    });
    return groups;
  }, [plantios]);

  const propriedadesDisponiveis = useMemo(() => {
    const seen = new Set();
    return plantios
      .filter(p => dreMap[String(p.id)] && (p.propriedade_id || true))
      .reduce((acc, p) => {
        const pid = p.propriedade_id ? String(p.propriedade_id) : '__sem__';
        if (!seen.has(pid)) {
          seen.add(pid);
          acc.push({ id: pid, nome: getPropNome(pid) });
        }
        return acc;
      }, []);
  }, [plantios, dreMap, propriedades]);

  const culturasDisponiveis = useMemo(() => {
    const seen = new Set();
    return plantios
      .filter(p => dreMap[String(p.id)] && p.cultura_id)
      .reduce((acc, p) => {
        if (!seen.has(p.cultura_id)) {
          seen.add(p.cultura_id);
          const c = getCultura(p.cultura_id);
          acc.push({ id: p.cultura_id, nome: `${c?.emoji ?? ''} ${c?.nome ?? p.cultura_id}`.trim() });
        }
        return acc;
      }, []);
  }, [plantios, dreMap]);

  // A4-01: Total consolidado do ano filtrado (ou todos) — inclui mão de obra
  // para bater com TabDRE por-lote. Antes omitia, inflando lucro 5-15%.
  const totais = useMemo(() => {
    let receita = 0, custo_insumos = 0, custo_despesas = 0, custo_mao_obra = 0;
    Object.entries(dreMap).forEach(([, byAno]) => {
      Object.entries(byAno).forEach(([ano, entry]) => {
        if (anoFiltro && Number(ano) !== Number(anoFiltro)) return;
        const agg = aggregateDreEntry(entry);
        receita        += agg.receita;
        custo_insumos  += agg.custoInsumos;
        custo_despesas += agg.custoDespesas;
        custo_mao_obra += agg.custoMaoObra;
      });
    });
    const custo_total = custo_insumos + custo_despesas + custo_mao_obra;
    const lucro = receita - custo_total;
    const margem = receita > 0 ? (lucro / receita) * 100 : null;
    return { receita, custo_insumos, custo_despesas, custo_mao_obra, custo_total, lucro, margem };
  }, [dreMap, anoFiltro]);

  // Total de despesas indiretas filtrado pelo ano selecionado
  const totalDespesasIndiretas = useMemo(
    () =>
      despesasIndiretas
        .filter((d) => !anoFiltro || String(anoFromDate(d.data)) === String(anoFiltro))
        .reduce((s, d) => s + (d.valor ?? 0), 0),
    [despesasIndiretas, anoFiltro]
  );

  // Lucro líquido real = lucro dos lotes − custos indiretos da propriedade
  const lucroLiquido = totais.lucro - totalDespesasIndiretas;

  if (loading) return <Spinner />;
  if (anosDisponiveis.length === 0) return <EmptyState />;

  return (
    <div className="px-4 pt-4 pb-8 flex flex-col gap-5">
      {/* Filtros */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-gray-500 w-16 flex-shrink-0">Ano:</span>
          <select
            value={anoFiltro}
            onChange={(e) => setAnoFiltro(e.target.value)}
            className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-[12px] font-semibold text-gray-700 outline-none"
          >
            <option value="">Todos os anos</option>
            {anosDisponiveis.map((ano) => (
              <option key={ano} value={ano}>{ano}</option>
            ))}
          </select>
        </div>
        {propriedadesDisponiveis.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-gray-500 w-16 flex-shrink-0">Prop.:</span>
            <select
              value={propFiltro}
              onChange={(e) => setPropFiltro(e.target.value)}
              className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-[12px] font-semibold text-gray-700 outline-none"
            >
              <option value="">Todas as propriedades</option>
              {propriedadesDisponiveis.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>
        )}
        {culturasDisponiveis.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-gray-500 w-16 flex-shrink-0">Cultura:</span>
            <select
              value={culturaFiltro}
              onChange={(e) => setCulturaFiltro(e.target.value)}
              className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-[12px] font-semibold text-gray-700 outline-none"
            >
              <option value="">Todas as culturas</option>
              {culturasDisponiveis.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Cards por propriedade */}
      {Object.entries(propriedadeGroups).map(([pid, lotesDoGrupo]) => {
        // skip this property group if a property filter is active and doesn't match
        if (propFiltro && pid !== propFiltro) return null;

        // Filtrar lotes que têm dados no dreMap
        const lotesComDados = lotesDoGrupo.filter((lote) => {
          if (culturaFiltro && lote.cultura_id !== culturaFiltro) return false;
          const byAno = dreMap[String(lote.id)] || {};
          return Object.keys(byAno).some(
            (ano) => !anoFiltro || Number(ano) === Number(anoFiltro)
          );
        });
        if (lotesComDados.length === 0) return null;

        return (
          <motion.div
            key={pid}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <SectionLabel>{getPropNome(pid)}</SectionLabel>
            <div className="flex flex-col gap-3">
              {lotesComDados.map((lote) => (
                <LoteCard
                  key={lote.id}
                  lote={lote}
                  dreMap={dreMap}
                  anoFiltro={anoFiltro}
                  propriedades={propriedades}
                />
              ))}
            </div>
          </motion.div>
        );
      })}

      {/* Totais consolidados */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
      >
        <SectionLabel>Total Consolidado {anoFiltro || '(todos os anos)'}</SectionLabel>
        <Card>
          <div className="grid grid-cols-2 gap-3 p-4">
            <div className="bg-green-50 rounded-xl px-3 py-2">
              <p className="text-[10px] text-green-700/60 font-medium">Receita total</p>
              <p className="text-[15px] font-bold text-green-700">{fmtBRL(totais.receita)}</p>
            </div>
            <div className="bg-red-50 rounded-xl px-3 py-2">
              <p className="text-[10px] text-red-600/60 font-medium">Custo insumos</p>
              <p className="text-[15px] font-bold text-red-600">{fmtBRL(totais.custo_insumos)}</p>
            </div>
            <div className="bg-orange-50 rounded-xl px-3 py-2">
              <p className="text-[10px] text-orange-600/60 font-medium">Despesas lotes</p>
              <p className="text-[15px] font-bold text-orange-600">{fmtBRL(totais.custo_despesas)}</p>
            </div>
            {totais.custo_mao_obra > 0 && (
              <div className="bg-amber-50 rounded-xl px-3 py-2">
                <p className="text-[10px] text-amber-700/60 font-medium">Mão de obra</p>
                <p className="text-[15px] font-bold text-amber-700">{fmtBRL(totais.custo_mao_obra)}</p>
              </div>
            )}
            <div className={`rounded-xl px-3 py-2 ${lucroLiquido >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
              <p className={`text-[10px] font-medium ${lucroLiquido >= 0 ? 'text-emerald-700/60' : 'text-red-600/60'}`}>
                Lucro líquido
              </p>
              <p className={`text-[15px] font-bold ${lucroLiquido >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {fmtBRL(lucroLiquido)}
              </p>
            </div>
          </div>
          {totalDespesasIndiretas > 0 && (
            <div className="flex justify-between items-center py-2 px-4 border-t" style={{ borderColor: 'hsl(214 20% 90%)' }}>
              <span className="text-[12px] text-muted-foreground font-medium text-gray-500">Custos indiretos (propriedade)</span>
              <span className="text-[13px] font-bold text-orange-600">{fmtBRL(totalDespesasIndiretas)}</span>
            </div>
          )}
          {totais.margem !== null && (
            <div className="px-4 pb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-gray-500">Margem líquida</span>
                <span className={`text-[12px] font-bold ${lucroLiquido >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  {fmtPct(totais.receita > 0 ? (lucroLiquido / totais.receita) * 100 : null)}
                </span>
              </div>
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${lucroLiquido >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, Math.abs(totais.receita > 0 ? (lucroLiquido / totais.receita) * 100 : 0))}%` }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                />
              </div>
            </div>
          )}
        </Card>
      </motion.div>

      {/* UX 4: Rentabilidade por cultura — card colapsável complementar */}
      <RentabilidadePorCultura rawData={rawData} anoFiltro={anoFiltro} />
    </div>
  );
}

/* ─── Aba 2: Comparativo de Safras ───────────────────────────── */

/* TabComparativo → ./finance/TabComparativo */

/* TabRanking → ./finance/TabRanking */

/* ─── Navegação de abas ───────────────────────────────────────── */

const TABS = [
  { key: 'dre', label: 'DRE', icon: TrendingUp },
  { key: 'comparativo', label: 'Comparativo', icon: BarChart2 },
  { key: 'ranking', label: 'Ranking', icon: Award },
];

/* ─── Componente principal ────────────────────────────────────── */

export default function FinanceiroPage({ onBack, propriedades = [] }) {
  const [tab, setTab] = useState('dre');
  const [rawData, setRawData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    setLoading(true);
    loadDreRawData()
      .then(async (data) => {
        const plantioIds = (data.plantios || []).map(p => p.id);
        const maoObraMap = await loadMaoObraBatch(plantioIds).catch(() => ({}));
        setRawData({ ...data, maoObraMap });
        setLoading(false);
      })
      .catch(err => { logDbError('FinanceiroPage.load', err); setLoading(false); });
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime: re-fetch DRE whenever vendas or despesas change (any device/user)
  useRealtimeSync('vendas',   fetchData);
  useRealtimeSync('despesas', fetchData);
  useRealtimeSync('receitas', fetchData);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-green-700 text-white px-4 pb-4 flex flex-col gap-4" style={{ paddingTop: 'var(--hero-pad-top)' }}>
        {/* Linha superior — pr-24 reserva espaço para os botões flutuantes (≡ e 🔔) */}
        <div className="flex items-center gap-3 pr-24">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-white/70 hover:text-white transition-colors"
            >
              <ChevronLeft size={18} />
              <span className="text-[12px] font-semibold">Voltar</span>
            </button>
          )}
          <div className="flex items-center gap-2 flex-1">
            <BarChart2 size={18} className="opacity-80" />
            <h1 className="text-[16px] font-bold leading-tight">Financeiro</h1>
          </div>
        </div>

        {/* Abas */}
        <div className="flex gap-1 bg-green-800/40 rounded-xl p-1">
          {TABS.map(({ key, label, icon: Icon }) => {
            const isActive = tab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all text-[11px] font-bold"
                style={
                  isActive
                    ? { background: 'rgba(255,255,255,0.9)', color: 'hsl(160 84% 27%)' }
                    : { color: 'rgba(255,255,255,0.65)' }
                }
              >
                <Icon size={12} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Conteúdo das abas */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
          >
            {tab === 'dre' && (
              <TabDRE rawData={rawData} loading={loading} propriedades={propriedades} />
            )}
            {tab === 'comparativo' && (
              <TabComparativo rawData={rawData} loading={loading} propriedades={propriedades} />
            )}
            {tab === 'ranking' && (
              <TabRanking rawData={rawData} loading={loading} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
