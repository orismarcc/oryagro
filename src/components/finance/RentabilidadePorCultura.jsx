/** RentabilidadePorCultura — extraído de TabDRE. */
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from 'recharts';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { CULTURAS } from '../../data/culturas';
import { Card } from './ui';
import { fmtBRL } from './helpers';

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
export default RentabilidadePorCultura;
