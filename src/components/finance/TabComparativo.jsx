/**
 * TabComparativo — aba 2 do FinanceiroPage. Extraído verbatim.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, Spinner, EmptyState } from './ui';
import { fmtBRL, fmtPct, getCultura, buildDreMap } from './helpers';
import { aggregateDreEntry } from '../../lib/financeiro';

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
        // A4-01: aggregateDreEntry inclui mão de obra (antes omitida)
        const agg = aggregateDreEntry(e);
        const kgColhido = e.vendas.reduce((s, v) => s + (v.quantidade ?? 0), 0);
        const custoKg = kgColhido > 0 ? agg.custo / kgColhido : null;
        return {
          lote, ano,
          receita: agg.receita,
          custo: agg.custo,
          lucro: agg.lucro,
          kgColhido,
          custoKg,
          margem: agg.margemPct,
        };
      });
  });

  // Max receita para escala do gráfico
  const maxReceita = Math.max(1, ...safras.map((s) => s.receita), ...safras.map((s) => s.custo));

  const cultura = getCultura(culturaSel);

  return (
    <div className="page-body pt-4 pb-8 flex flex-col gap-5">
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
export default TabComparativo;
