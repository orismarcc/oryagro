import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { logDbError } from '../lib/logger';
import { useRealtimeSync } from '../hooks/useRealtimeSync';

/* ─── Formatadores ────────────────────────────────────────────── */

const fmtBRL = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0);

const fmtPct = (v) => {
  if (v == null || !isFinite(v)) return '—';
  return `${v.toFixed(1)}%`;
};

function formatDateBR(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/* ─── Helpers ─────────────────────────────────────────────────── */

function getCultura(culturaId) {
  return CULTURAS[culturaId] || null;
}

function anoFromDate(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr + 'T12:00:00').getFullYear();
}

function buildDreMap(rawData) {
  const { vendas, receitas = [], movimentos, despesas, plantios } = rawData;

  const map = {};

  const ensureEntry = (plantioId, ano) => {
    if (!map[plantioId]) map[plantioId] = {};
    if (!map[plantioId][ano]) {
      map[plantioId][ano] = {
        receita: 0,
        custo_insumos: 0,
        custo_despesas: 0,
        vendas: [],
        movimentos: [],
        despesas: [],
        isLegacyMO: false,
      };
    }
    return map[plantioId][ano];
  };

  // Processar vendas (tabela vendas — produção in-natura, etc.)
  vendas.forEach((v) => {
    if (!v.plantio_id || !v.data) return;
    const ano = anoFromDate(v.data);
    if (!ano) return;
    const entry = ensureEntry(String(v.plantio_id), ano);
    const valor = (v.quantidade ?? 0) * (v.preco_unitario ?? 0);
    entry.receita += valor;
    entry.vendas.push({ ...v, valor });
  });

  // Processar receitas diretas (tabela receitas — serviços, outras entradas)
  receitas.forEach((r) => {
    if (!r.data) return;
    const ano = anoFromDate(r.data);
    if (!ano) return;
    // Agrupa pelo plantio_id quando disponível; caso contrário usa '__receita__'
    const pid = r.plantio_id ? String(r.plantio_id) : '__receita__';
    const entry = ensureEntry(pid, ano);
    entry.receita += r.valor ?? 0;
    entry.vendas.push({ ...r, valor: r.valor ?? 0, _source: 'receita' });
  });

  // Processar movimentos de saída de estoque
  movimentos.forEach((m) => {
    if (!m.plantio_id || !m.data) return;
    const ano = anoFromDate(m.data);
    if (!ano) return;
    const insumo = m.estoque_insumos;
    const preco = insumo?.preco_unitario ?? 0;
    const custo = (m.quantidade ?? 0) * preco;
    const entry = ensureEntry(String(m.plantio_id), ano);
    entry.custo_insumos += custo;
    entry.movimentos.push({ ...m, custo });
  });

  // Processar despesas (nova tabela centralizada)
  despesas.forEach((d) => {
    if (!d.plantio_id || !d.data) return;
    const ano = anoFromDate(d.data);
    if (!ano) return;
    const entry = ensureEntry(String(d.plantio_id), ano);
    entry.custo_despesas += d.valor ?? 0;
    entry.despesas.push(d);
  });

  // Legado: lotes sem despesas mas com mao_obra_total no plantio
  plantios.forEach((p) => {
    const pid = String(p.id);
    const maoObraTotal = parseFloat(p.mao_obra_total) || 0;
    if (maoObraTotal <= 0) return;

    const temDespesas = despesas.some((d) => String(d.plantio_id) === pid);
    if (temDespesas) return;

    const ano = anoFromDate(p.data_plantio);
    if (!ano) return;
    const entry = ensureEntry(pid, ano);
    entry.custo_despesas += maoObraTotal;
    entry.isLegacyMO = true;
  });

  return map;
}

/* ─── Componentes de UI reutilizáveis ────────────────────────── */

function Card({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden ${className}`}>
      {children}
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

function Spinner() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24">
      <div className="w-8 h-8 border-2 border-green-200 border-t-green-500 rounded-full animate-spin" />
      <p className="text-[12px] text-gray-400">Carregando dados financeiros…</p>
    </div>
  );
}

function EmptyState({ message = 'Nenhum dado financeiro encontrado.' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-6">
      <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
        <BarChart2 size={28} className="text-green-400" />
      </div>
      <p className="text-[14px] font-bold text-gray-700">{message}</p>
      <p className="text-[12px] text-gray-400 leading-relaxed">
        Registre vendas e movimentações de estoque para visualizar o demonstrativo.
      </p>
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

  // Calcular lucro e margem por ano
  const anosComDados = Object.entries(anoEntries)
    .filter(([ano]) => !anoFiltro || Number(ano) === Number(anoFiltro))
    .map(([ano, entry]) => {
      const lucro = entry.receita - entry.custo_insumos - entry.custo_despesas;
      const margem = entry.receita > 0 ? (lucro / entry.receita) * 100 : null;
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
  }, [plantios, dreMap]);

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

  // Total consolidado do ano filtrado (ou todos)
  const totais = useMemo(() => {
    let receita = 0, custo_insumos = 0, custo_despesas = 0;
    Object.entries(dreMap).forEach(([, byAno]) => {
      Object.entries(byAno).forEach(([ano, entry]) => {
        if (anoFiltro && Number(ano) !== Number(anoFiltro)) return;
        receita += entry.receita;
        custo_insumos += entry.custo_insumos;
        custo_despesas += entry.custo_despesas;
      });
    });
    const lucro = receita - custo_insumos - custo_despesas;
    const margem = receita > 0 ? (lucro / receita) * 100 : null;
    return { receita, custo_insumos, custo_despesas, lucro, margem };
  }, [dreMap, anoFiltro]);

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
              <p className="text-[10px] text-orange-600/60 font-medium">Despesas</p>
              <p className="text-[15px] font-bold text-orange-600">{fmtBRL(totais.custo_despesas)}</p>
            </div>
            <div className={`rounded-xl px-3 py-2 ${totais.lucro >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
              <p className={`text-[10px] font-medium ${totais.lucro >= 0 ? 'text-emerald-700/60' : 'text-red-600/60'}`}>
                Lucro líquido
              </p>
              <p className={`text-[15px] font-bold ${totais.lucro >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {fmtBRL(totais.lucro)}
              </p>
            </div>
          </div>
          {totais.margem !== null && (
            <div className="px-4 pb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-gray-500">Margem líquida</span>
                <span className={`text-[12px] font-bold ${totais.margem >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  {fmtPct(totais.margem)}
                </span>
              </div>
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${totais.margem >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, Math.abs(totais.margem))}%` }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                />
              </div>
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
}

/* ─── Aba 2: Comparativo de Safras ───────────────────────────── */

function TabComparativo({ rawData, loading, propriedades = [] }) {
  const dreMap = useMemo(() => (rawData ? buildDreMap(rawData) : {}), [rawData]);
  const plantios = rawData?.plantios ?? [];

  // Culturas disponíveis (que têm pelo menos 1 venda)
  const culturasComVendas = useMemo(() => {
    const ids = new Set();
    Object.entries(dreMap).forEach(([pid, byAno]) => {
      const lote = plantios.find((p) => String(p.id) === pid);
      if (!lote) return;
      const temVenda = Object.values(byAno).some((e) => e.receita > 0);
      if (temVenda) ids.add(lote.cultura_id);
    });
    return [...ids].filter(Boolean);
  }, [dreMap, plantios]);

  const [culturaSel, setCulturaSel] = useState('');
  const [anoFiltroComp, setAnoFiltroComp]   = useState('');
  const [propFiltroComp, setPropFiltroComp] = useState('');

  useEffect(() => {
    if (culturasComVendas.length > 0 && !culturaSel) {
      setCulturaSel(culturasComVendas[0]);
    }
  }, [culturasComVendas, culturaSel]);

  const anosDisponiveisComp = useMemo(() => {
    const anos = new Set();
    Object.values(dreMap).forEach(byAno => Object.keys(byAno).forEach(a => anos.add(Number(a))));
    return [...anos].sort((a, b) => b - a);
  }, [dreMap]);

  const propsDisponiveisComp = useMemo(() => {
    const seen = new Set();
    const acc = [];
    plantios
      .filter(p => p.cultura_id === culturaSel)
      .forEach(p => {
        const pid = p.propriedade_id ? String(p.propriedade_id) : '__sem__';
        if (!seen.has(pid)) {
          seen.add(pid);
          const prop = propriedades?.find(pr => String(pr.id) === pid);
          acc.push({ id: pid, nome: prop ? prop.nome : (pid === '__sem__' ? 'Sem propriedade' : `Prop. ${pid.slice(0,6)}`) });
        }
      });
    return acc;
  }, [plantios, culturaSel, propriedades]);

  if (loading) return <Spinner />;
  if (culturasComVendas.length === 0)
    return <EmptyState message="Nenhuma cultura com dados de vendas." />;

  // Lotes da cultura selecionada (com filtro de propriedade)
  const lotesFiltered = plantios.filter((p) => {
    if (p.cultura_id !== culturaSel) return false;
    if (propFiltroComp) {
      const pid = p.propriedade_id ? String(p.propriedade_id) : '__sem__';
      if (pid !== propFiltroComp) return false;
    }
    return true;
  });

  // Anos disponíveis para essa cultura
  const anosSet = new Set();
  lotesFiltered.forEach((lote) => {
    const byAno = dreMap[String(lote.id)] || {};
    Object.keys(byAno).forEach((ano) => anosSet.add(Number(ano)));
  });
  const anos = [...anosSet].sort((a, b) => a - b);

  // Para cada lote × ano: métricas
  const safras = lotesFiltered.flatMap((lote) => {
    const byAno = dreMap[String(lote.id)] || {};
    return anos
      .filter((ano) => byAno[ano] && (!anoFiltroComp || ano === Number(anoFiltroComp)))
      .map((ano) => {
        const e = byAno[ano];
        const lucro = e.receita - e.custo_insumos - e.custo_despesas;
        const custo = e.custo_insumos + e.custo_despesas;
        const kgColhido = e.vendas.reduce((s, v) => s + (v.quantidade ?? 0), 0);
        const custoKg = kgColhido > 0 ? custo / kgColhido : null;
        const margem = e.receita > 0 ? (lucro / e.receita) * 100 : null;
        return { lote, ano, receita: e.receita, custo, lucro, kgColhido, custoKg, margem };
      });
  });

  // Max receita para escala do gráfico
  const maxReceita = Math.max(1, ...safras.map((s) => s.receita), ...safras.map((s) => s.custo));

  const cultura = getCultura(culturaSel);

  return (
    <div className="px-4 pt-4 pb-8 flex flex-col gap-5">
      {/* Filtros */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-gray-500 w-16 flex-shrink-0">Cultura:</span>
          <select
            value={culturaSel}
            onChange={(e) => { setCulturaSel(e.target.value); setPropFiltroComp(''); }}
            className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-[12px] font-semibold text-gray-700 outline-none"
          >
            {culturasComVendas.map((cid) => {
              const c = getCultura(cid);
              return (
                <option key={cid} value={cid}>
                  {c?.emoji ?? ''} {c?.nome ?? cid}
                </option>
              );
            })}
          </select>
        </div>
        {anosDisponiveisComp.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-gray-500 w-16 flex-shrink-0">Ano:</span>
            <select
              value={anoFiltroComp}
              onChange={(e) => setAnoFiltroComp(e.target.value)}
              className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-[12px] font-semibold text-gray-700 outline-none"
            >
              <option value="">Todos os anos</option>
              {anosDisponiveisComp.map((ano) => (
                <option key={ano} value={ano}>{ano}</option>
              ))}
            </select>
          </div>
        )}
        {propsDisponiveisComp.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-gray-500 w-16 flex-shrink-0">Prop.:</span>
            <select
              value={propFiltroComp}
              onChange={(e) => setPropFiltroComp(e.target.value)}
              className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-[12px] font-semibold text-gray-700 outline-none"
            >
              <option value="">Todas as propriedades</option>
              {propsDisponiveisComp.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {safras.length === 0 ? (
        <EmptyState message="Nenhuma safra com dados para esta cultura." />
      ) : (
        <>
          {/* Cards por lote */}
          {lotesFiltered.map((lote) => {
            const safrasLote = safras.filter((s) => s.lote.id === lote.id);
            if (safrasLote.length === 0) return null;

            return (
              <motion.div
                key={lote.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
              >
                <Card>
                  <div className="px-4 pt-3 pb-1 flex items-center gap-2 border-b border-gray-50">
                    <span className="text-[16px]">{cultura?.emoji ?? '🌱'}</span>
                    <span className="text-[13px] font-bold text-gray-700">{lote.nome}</span>
                  </div>

                  {/* Métricas por ano */}
                  <div className="divide-y divide-gray-50">
                    {safrasLote.map(({ ano, receita, custo, lucro, kgColhido, custoKg, margem }) => (
                      <div key={ano} className="px-4 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[12px] font-bold text-gray-600">Safra {ano}</span>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${lucro >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                            {margem != null ? fmtPct(margem) : '—'} margem
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] mb-2">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Receita</span>
                            <span className="font-semibold text-green-700">{fmtBRL(receita)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Custo total</span>
                            <span className="font-semibold text-red-600">{fmtBRL(custo)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Lucro</span>
                            <span className={`font-bold ${lucro >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                              {fmtBRL(lucro)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Custo/kg</span>
                            <span className="font-semibold text-gray-600">
                              {custoKg != null ? fmtBRL(custoKg) : '—'}
                            </span>
                          </div>
                          {kgColhido > 0 && (
                            <div className="flex justify-between col-span-2">
                              <span className="text-gray-400">kg colhido</span>
                              <span className="font-semibold text-gray-600">
                                {kgColhido.toLocaleString('pt-BR')} kg
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Mini gráfico de barras: receita vs custo */}
                        <div className="flex items-end gap-3 mt-1">
                          {/* Label Safra */}
                          <span className="text-[9px] text-gray-400 font-bold w-10 flex-shrink-0 leading-none">
                            {ano}
                          </span>
                          {/* Barra receita */}
                          <div className="flex-1 flex flex-col gap-1">
                            <div className="flex items-center gap-1">
                              <div className="w-2.5 h-2.5 rounded-sm bg-green-400 flex-shrink-0" />
                              <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                                <motion.div
                                  className="h-full bg-green-400 rounded-full"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${(receita / maxReceita) * 100}%` }}
                                  transition={{ duration: 0.6, ease: 'easeOut' }}
                                />
                              </div>
                              <span className="text-[9px] text-gray-500 w-14 text-right flex-shrink-0">
                                {fmtBRL(receita)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-2.5 h-2.5 rounded-sm bg-red-400 flex-shrink-0" />
                              <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                                <motion.div
                                  className="h-full bg-red-400 rounded-full"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${(custo / maxReceita) * 100}%` }}
                                  transition={{ duration: 0.6, ease: 'easeOut', delay: 0.05 }}
                                />
                              </div>
                              <span className="text-[9px] text-gray-500 w-14 text-right flex-shrink-0">
                                {fmtBRL(custo)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </>
      )}
    </div>
  );
}

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
        const custo = e.custo_insumos + e.custo_despesas;
        const lucro = e.receita - custo;
        entry.receita += e.receita;
        entry.custo += custo;
        entry.lucro += lucro;
        const kg = e.vendas.reduce((s, v) => s + (v.quantidade ?? 0), 0);
        entry.kgTotal += kg;
        if (e.receita > 0) entry.margemValues.push((lucro / e.receita) * 100);
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
    <div className="px-4 pt-4 pb-8 flex flex-col gap-5">
      {/* Botões de critério */}
      <div className="flex gap-2 flex-wrap">
        {RANKING_CRITERIOS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setCriterio(key)}
            className="px-3 py-1.5 rounded-full text-[11px] font-bold transition-all"
            style={
              criterio === key
                ? { background: 'hsl(160 84% 27%)', color: 'white' }
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
      .then(data  => { setRawData(data);  setLoading(false); })
      .catch(err  => { logDbError('FinanceiroPage.load', err); setLoading(false); });
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
