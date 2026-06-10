/** TabDRE — aba 1 (DRE) do FinanceiroPage. */
import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Download } from 'lucide-react';
import { Card, SectionLabel, Spinner, EmptyState } from './ui';
import { fmtBRL, fmtPct, getCultura, periodFromDate, buildDreMap } from './helpers';
import { aggregateDreEntry } from '../../lib/financeiro';
import { exportFinanceiroCsv } from '../../lib/exportCsv';
import RentabilidadePorCultura from './RentabilidadePorCultura';
import LoteCard from './LoteCard';

function TabDRE({ rawData, loading, propriedades }) {
  const [anoFiltro, setAnoFiltro] = useState('');
  const [propFiltro, setPropFiltro]       = useState('');
  const [culturaFiltro, setCulturaFiltro] = useState('');
  const [periodMode, setPeriodMode]       = useState('ano'); // 'ano' civil | 'safra' agrícola

  const dreMap = useMemo(
    () => (rawData ? buildDreMap(rawData, periodMode) : {}),
    [rawData, periodMode]
  );

  // Troca de modo (ano/safra) invalida o filtro de período selecionado
  const handlePeriodMode = (mode) => {
    setPeriodMode(mode);
    setAnoFiltro('');
  };

  // Despesas indiretas da propriedade (sem plantio_id = custos indiretos)
  const despesasIndiretas = useMemo(
    () => (rawData?.despesas || []).filter((d) => !d.plantio_id && d.data),
    [rawData]
  );

  // Períodos disponíveis nos dados (anos civis ou safras, conforme periodMode).
  // Mantém o rótulo bruto ("2025" ou "2025/26") e ordena pelo ano inicial desc.
  const anosDisponiveis = useMemo(() => {
    const periodos = new Set();
    Object.values(dreMap).forEach((byAno) => {
      Object.keys(byAno).forEach((ano) => periodos.add(ano));
    });
    return [...periodos].sort((a, b) => parseInt(b, 10) - parseInt(a, 10));
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
        if (anoFiltro && String(ano) !== String(anoFiltro)) return;
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
        .filter((d) => !anoFiltro || String(periodFromDate(d.data, periodMode)) === String(anoFiltro))
        .reduce((s, d) => s + (d.valor ?? 0), 0),
    [despesasIndiretas, anoFiltro, periodMode]
  );

  // Lucro líquido real = lucro dos lotes − custos indiretos da propriedade
  const lucroLiquido = totais.lucro - totalDespesasIndiretas;

  // ── Exportação CSV (vendas + despesas) para o contador (IR/ITR) ──────────────
  const plantioById = useMemo(() => {
    const m = {};
    plantios.forEach((p) => { m[String(p.id)] = p; });
    return m;
  }, [plantios]);

  const nomePlantio = (pid) => plantioById[String(pid)]?.nome || '';

  // plantios que passam no filtro de propriedade selecionado
  const plantioNoFiltroProp = (pid) => {
    if (!propFiltro) return true;
    const p = plantioById[String(pid)];
    const grp = p?.propriedade_id ? String(p.propriedade_id) : '__sem__';
    return grp === propFiltro;
  };

  const noPeriodo = (data) =>
    !anoFiltro || String(periodFromDate(data, periodMode)) === String(anoFiltro);

  const handleExportCsv = () => {
    const vendas = (rawData?.vendas || []).filter(
      (v) => v.data && noPeriodo(v.data) && plantioNoFiltroProp(v.plantio_id),
    );
    // Inclui despesas diretas (com plantio) e indiretas (sem plantio).
    const despesas = (rawData?.despesas || []).filter(
      (d) => d.data && noPeriodo(d.data) && (!d.plantio_id || plantioNoFiltroProp(d.plantio_id)),
    );
    const sufixo = (anoFiltro ? String(anoFiltro) : (periodMode === 'safra' ? 'safras' : 'anos'))
      .replace(/[^0-9a-zA-Z]+/g, '-');
    exportFinanceiroCsv({ vendas, despesas, nomePlantio, sufixo });
  };

  if (loading) return <Spinner />;
  if (anosDisponiveis.length === 0) return <EmptyState />;

  return (
    <div className="px-4 pt-4 pb-8 flex flex-col gap-5">
      {/* Filtros */}
      <div className="flex flex-col gap-2">
        {/* Modo de período: ano civil × safra agrícola */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-gray-500 w-16 flex-shrink-0">Período:</span>
          <div className="flex-1 grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
            {[
              { id: 'ano', label: 'Ano civil' },
              { id: 'safra', label: 'Safra' },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => handlePeriodMode(m.id)}
                className={`rounded-lg px-3 py-1.5 text-[12px] font-bold transition-colors ${
                  periodMode === m.id
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-gray-500'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-gray-500 w-16 flex-shrink-0">
            {periodMode === 'safra' ? 'Safra:' : 'Ano:'}
          </span>
          <select
            value={anoFiltro}
            onChange={(e) => setAnoFiltro(e.target.value)}
            className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-[12px] font-semibold text-gray-700 outline-none"
          >
            <option value="">{periodMode === 'safra' ? 'Todas as safras' : 'Todos os anos'}</option>
            {anosDisponiveis.map((ano) => (
              <option key={ano} value={ano}>{periodMode === 'safra' ? `Safra ${ano}` : ano}</option>
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

        {/* Exportar para o contador (IR/ITR) — respeita o período e a propriedade filtrados */}
        <button
          onClick={handleExportCsv}
          className="mt-1 flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-bold text-emerald-700 active:scale-[0.99] transition-transform"
        >
          <Download size={14} />
          Exportar CSV (vendas e despesas)
        </button>
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
            (ano) => !anoFiltro || String(ano) === String(anoFiltro)
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
        <SectionLabel>
          Total Consolidado {anoFiltro
            ? (periodMode === 'safra' ? `Safra ${anoFiltro}` : anoFiltro)
            : (periodMode === 'safra' ? '(todas as safras)' : '(todos os anos)')}
        </SectionLabel>
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
      <RentabilidadePorCultura rawData={rawData} anoFiltro={anoFiltro} periodMode={periodMode} />
    </div>
  );
}

export default TabDRE;
