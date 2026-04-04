import React from 'react';
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Package, Scale } from 'lucide-react';

export default function ResultadoPanel({ resultado, cultura }) {
  const {
    totalPlantas, plantasViaveis, custoTotal, custoPlanta,
    receita, lucro, margem, pontoEquilibrio, composicaoCustos, formatBRL, isCampo,
  } = resultado;

  const isProfit = lucro >= 0;
  const margemColor = margem >= 50 ? '#1e4d2b' : margem >= 20 ? '#d4a017' : '#c0392b';

  const plantasLabel = isCampo && cultura.venda.producaoKgPorHa
    ? 'Produção estimada'
    : isCampo ? 'Plantas viáveis' : 'Comercializáveis';
  const plantasValue = isCampo && cultura.venda.producaoKgPorHa
    ? `${(cultura.venda.producaoKgPorHa * (resultado.areaHa || 1)).toLocaleString('pt-BR')} kg`
    : plantasViaveis.toLocaleString('pt-BR');

  const barData = [
    { name: 'Custo',   valor: +custoTotal.toFixed(2), fill: '#b5451b' },
    { name: 'Receita', valor: +receita.toFixed(2),    fill: '#2d6a4f' },
    { name: 'Lucro',   valor: +Math.max(0, lucro).toFixed(2), fill: '#52b788' },
  ];

  return (
    <div className="flex flex-col gap-3">

      {/* ── Lucro card (hero) ── */}
      <div
        className="rounded-xl p-5 border anim-scale-in"
        style={{
          background: isProfit
            ? 'linear-gradient(135deg, #1e4d2b14, #52b78808)'
            : 'linear-gradient(135deg, #c0392b14, #e07b5608)',
          borderColor: isProfit ? '#52b78830' : '#c0392b30',
        }}
      >
        <div className="flex items-start justify-between mb-1">
          <span className="text-[10px] font-bold uppercase tracking-[2px] text-gray-400">
            {isProfit ? 'Lucro estimado' : 'Prejuízo estimado'}
          </span>
          {isProfit
            ? <TrendingUp size={16} color="#52b788" />
            : <TrendingDown size={16} color="#c0392b" />
          }
        </div>
        <div
          className="num-highlight text-3xl anim-count-up"
          style={{ color: isProfit ? '#1e4d2b' : '#c0392b' }}
        >
          {formatBRL(lucro)}
        </div>
        <div className="text-[11px] text-gray-400 mt-1">
          Margem bruta: <strong style={{ color: margemColor }}>{margem.toFixed(1)}%</strong>
        </div>

        {/* Margin bar */}
        <div className="mt-2.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="metric-bar-fill"
            style={{
              '--bar-w': `${Math.min(100, Math.max(0, margem))}%`,
              width: `${Math.min(100, Math.max(0, margem))}%`,
              background: margemColor,
            }}
          />
        </div>
      </div>

      {/* ── Key metrics ── */}
      <div className="bg-white border border-borda rounded-xl overflow-hidden anim-fade-up delay-50">
        <div className="px-4 py-2.5 border-b border-borda bg-gray-50/50">
          <span className="text-[10px] font-bold uppercase tracking-[2px] text-gray-400">Resumo</span>
        </div>
        <div className="divide-y divide-borda/60">
          {[
            { label: isCampo ? 'Área' : 'Área/canteiro', value: isCampo ? `${(resultado.areaHa||1).toLocaleString('pt-BR')} ha` : `${(resultado.area||0).toFixed(1)} m²` },
            { label: isCampo ? 'Plantas/ha → total' : 'Total de plantas', value: isCampo ? `${(resultado.plantasPorHa||0).toLocaleString('pt-BR')} → ${totalPlantas.toLocaleString('pt-BR')}` : totalPlantas.toLocaleString('pt-BR') },
            { label: plantasLabel, value: plantasValue },
            { label: 'Custo total', value: formatBRL(custoTotal) },
            { label: 'Custo/planta', value: formatBRL(custoPlanta) },
            { label: 'Receita estimada', value: formatBRL(receita), highlight: true },
            { label: 'Ponto de equilíbrio', value: `${pontoEquilibrio} un.` },
          ].map(({ label, value, highlight }) => (
            <div key={label} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-[12px] text-gray-500">{label}</span>
              <span className={`text-[12px] font-semibold ${highlight ? 'text-verde-700' : 'text-gray-800'}`}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Charts ── */}
      {composicaoCustos.length > 0 && (
        <div className="bg-white border border-borda rounded-xl p-4 anim-fade-up delay-100">
          <div className="text-[10px] font-bold uppercase tracking-[2px] text-gray-400 mb-3">
            Composição dos Custos
          </div>
          <ResponsiveContainer width="100%" height={130}>
            <PieChart>
              <Pie data={composicaoCustos} cx="50%" cy="50%" innerRadius={32} outerRadius={58} dataKey="value" paddingAngle={2}>
                {composicaoCustos.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Pie>
              <Tooltip
                formatter={(v) => formatBRL(v)}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e8e4de' }}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-1">
            {composicaoCustos.map(e => (
              <div key={e.name} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ background: e.fill }} />
                <span className="text-[10px] text-gray-500">{e.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Bar comparison ── */}
      <div className="bg-white border border-borda rounded-xl p-4 anim-fade-up delay-150">
        <div className="text-[10px] font-bold uppercase tracking-[2px] text-gray-400 mb-2">
          Custo × Receita × Lucro
        </div>
        <ResponsiveContainer width="100%" height={90}>
          <BarChart data={barData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#999' }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
              {barData.map((e, i) => <Cell key={i} fill={e.fill} />)}
            </Bar>
            <Tooltip
              formatter={(v) => formatBRL(v)}
              contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e8e4de' }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
