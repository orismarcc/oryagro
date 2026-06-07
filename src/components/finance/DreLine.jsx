/** DreLine — extraído de TabDRE. */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { fmtBRL, fmtPct, formatDateBR } from './helpers';

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
export default DreLine;
