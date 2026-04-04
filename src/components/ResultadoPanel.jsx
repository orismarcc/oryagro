import React from 'react';
import { Card } from './ui/card';
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';

function MetricRow({ label, value, highlight }) {
  return (
    <div className="flex justify-between py-2 border-b border-borda/60 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-semibold ${highlight ? 'text-verde-800' : 'text-gray-800'}`}>{value}</span>
    </div>
  );
}

export default function ResultadoPanel({ resultado, cultura }) {
  const { totalPlantas, plantasViaveis, custoTotal, custoPlanta, receita, lucro, margem, pontoEquilibrio, composicaoCustos, formatBRL, isCampo } = resultado;
  const margemColor = margem >= 50 ? '#1e4d2b' : margem >= 20 ? '#d4a017' : '#c0392b';

  const barData = [
    { name: 'Custo', valor: +custoTotal.toFixed(2), fill: '#b5451b' },
    { name: 'Receita', valor: +receita.toFixed(2), fill: '#52b788' },
    { name: 'Lucro', valor: +Math.max(0, lucro).toFixed(2), fill: '#1e4d2b' },
  ];

  const plantasLabel = isCampo
    ? (cultura.id === 'mandioca' ? 'Produção estimada (kg)' : 'Plantas viáveis')
    : 'Plantas comercializáveis';
  const plantasValue = isCampo && cultura.id === 'mandioca'
    ? ((cultura.venda.producaoKgPorHa || 20000) * (resultado.areaHa || 1)).toLocaleString('pt-BR') + ' kg'
    : plantasViaveis.toLocaleString('pt-BR');

  return (
    <Card className="p-4">
      <h3 className="font-display font-semibold text-verde-800 text-base mb-3">Resumo Financeiro</h3>

      <MetricRow label={isCampo ? 'Área' : 'Área calculada'} value={isCampo ? `${(resultado.areaHa || 1).toLocaleString('pt-BR')} ha` : `${(resultado.area || 0).toFixed(1)} m²`} />
      <MetricRow label={isCampo ? 'Plantas/ha → total' : 'Total de plantas'} value={isCampo ? `${(resultado.plantasPorHa || 0).toLocaleString('pt-BR')} → ${totalPlantas.toLocaleString('pt-BR')}` : totalPlantas.toLocaleString('pt-BR')} />
      <MetricRow label={plantasLabel} value={plantasValue} />
      <MetricRow label="Custo total de produção" value={formatBRL(custoTotal)} />
      <MetricRow label="Custo por planta/unid." value={formatBRL(custoPlanta)} />
      <MetricRow label="Receita estimada" value={formatBRL(receita)} />
      <MetricRow label="Lucro estimado" value={formatBRL(lucro)} highlight />
      <MetricRow label="Ponto de equilíbrio" value={`${pontoEquilibrio} unidades`} />

      {/* Margem */}
      <div className="mt-3">
        <div className="flex justify-between mb-1">
          <span className="text-xs text-gray-500">Margem bruta</span>
          <span className="text-xs font-bold" style={{ color: margemColor }}>{margem.toFixed(1)}%</span>
        </div>
        <div className="w-full h-2 bg-papel-dark rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(100, Math.max(0, margem))}%`, backgroundColor: margemColor }} />
        </div>
      </div>

      {/* Charts */}
      <div className="mt-4 border-t border-borda pt-3">
        <p className="text-xs text-gray-400 font-semibold mb-2">Composição dos custos</p>
        <ResponsiveContainer width="100%" height={150}>
          <PieChart>
            <Pie data={composicaoCustos} cx="50%" cy="50%" innerRadius={38} outerRadius={65} dataKey="value" paddingAngle={2}>
              {composicaoCustos.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
            </Pie>
            <Tooltip formatter={(v) => formatBRL(v)} />
          </PieChart>
        </ResponsiveContainer>
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={barData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis hide />
            <Bar dataKey="valor" radius={[3, 3, 0, 0]}>
              {barData.map((e, i) => <Cell key={i} fill={e.fill} />)}
            </Bar>
            <Tooltip formatter={(v) => formatBRL(v)} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
