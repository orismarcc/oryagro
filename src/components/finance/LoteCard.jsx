/** LoteCard — extraído de TabDRE (renderiza DreLine). */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from './ui';
import { fmtBRL, getCultura } from './helpers';
import { calcLucroLote } from '../../lib/financeiro';
import DreLine from './DreLine';

function LoteCard({ lote, dreMap, anoFiltro, propriedades }) {
  const [collapsed, setCollapsed] = useState(true);
  const [expandedAnos, setExpandedAnos] = useState({});

  const cultura = getCultura(lote.cultura_id);
  const anoEntries = dreMap[String(lote.id)] || {};

  // Calcular lucro e margem por ano — usando fórmula compartilhada com AnalysePage
  const anosComDados = Object.entries(anoEntries)
    .filter(([ano]) => !anoFiltro || String(ano) === String(anoFiltro))
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
      // mantém o rótulo bruto do período (ano civil "2025" ou safra "2025/26")
      return [ano, { ...entry, lucro, margem }];
    })
    .sort(([a], [b]) => parseInt(b, 10) - parseInt(a, 10)); // mais recente primeiro

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
export default LoteCard;
