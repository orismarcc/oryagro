import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, AreaChart, Area, XAxis } from 'recharts';
import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';

function CountUpBRL({ value, duration = 0.9 }) {
  const [display, setDisplay] = useState('R$ 0,00');
  const rafRef = useRef(null);
  const fmt = (v) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  useEffect(() => {
    const target = parseFloat(value) || 0;
    const start = performance.now();
    const animate = (now) => {
      const p = Math.min((now - start) / (duration * 1000), 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplay(fmt(ease * target));
      if (p < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);
  return <span>{display}</span>;
}

const METRIC_ROW = ({ label, value, accent, fmt }) => (
  <div className="flex items-center justify-between py-2.5 border-b border-black/[0.04] last:border-0">
    <span className="text-[12px] text-gray-500">{label}</span>
    <span className={`text-[12px] font-semibold mono ${accent ? 'text-emerald-700' : 'text-gray-800'}`}>{value}</span>
  </div>
);

const CustomTooltip = ({ active, payload, formatBRL }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="card px-3 py-2 text-xs">
      <div className="font-semibold text-gray-700">{payload[0].name}</div>
      <div className="text-gray-500 mono mt-0.5">{formatBRL(payload[0].value)}</div>
    </div>
  );
};

export default function ResultadoPanel({ resultado, cultura }) {
  const {
    totalPlantas, plantasViaveis, custoTotal, custoPlanta,
    receita, lucro, margem, pontoEquilibrio, composicaoCustos, formatBRL, isCampo,
  } = resultado;

  const isProfit = lucro >= 0;
  const margemColor = margem >= 50 ? '#059669' : margem >= 20 ? '#d97706' : '#dc2626';

  const plantasLabel = isCampo && cultura.venda.producaoKgPorHa
    ? 'Produção estimada'
    : isCampo ? 'Plantas viáveis' : 'Comercializáveis';
  const plantasValue = isCampo && cultura.venda.producaoKgPorHa
    ? `${(cultura.venda.producaoKgPorHa * (resultado.areaHa || 1)).toLocaleString('pt-BR')} kg`
    : plantasViaveis.toLocaleString('pt-BR');

  const sparkData = [
    { name: 'Custo', v: custoTotal },
    { name: 'Receita', v: receita },
    { name: 'Lucro', v: Math.max(0, lucro) },
  ];

  return (
    <div className="flex flex-col gap-3 h-full">

      {/* ── Hero metric: Lucro ── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-2xl p-5 relative overflow-hidden"
        style={{
          background: isProfit
            ? 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)'
            : 'linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%)',
          border: `1px solid ${isProfit ? 'rgba(5,150,105,0.15)' : 'rgba(220,38,38,0.15)'}`,
        }}
      >
        {/* Background icon */}
        <div className="absolute right-4 bottom-2 opacity-5">
          {isProfit
            ? <TrendingUp size={80} color="#059669" />
            : <TrendingDown size={80} color="#dc2626" />
          }
        </div>

        <div className="text-[10px] font-bold uppercase tracking-[2.5px] mb-2"
          style={{ color: isProfit ? '#059669' : '#dc2626' }}
        >
          {isProfit ? 'Lucro estimado' : 'Prejuízo estimado'}
        </div>

        <div
          className="stat-num text-4xl mb-1"
          style={{ color: isProfit ? '#059669' : '#dc2626' }}
        >
          <CountUpBRL value={lucro} />
        </div>

        <div className="flex items-center gap-3 mt-3">
          <div className="text-[11px] text-gray-500">
            Margem: <strong style={{ color: margemColor }}>{margem.toFixed(1)}%</strong>
          </div>
          {margem < 20 && (
            <div className="flex items-center gap-1 text-[10px] text-amber-600 font-medium">
              <AlertCircle size={11} /> Margem baixa
            </div>
          )}
        </div>

        {/* Margin bar */}
        <div className="mt-3 h-1.5 bg-black/[0.06] rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: margemColor }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, Math.max(0, margem))}%` }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          />
        </div>
      </motion.div>

      {/* ── Metrics table ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="card p-4"
      >
        <div className="text-[9px] font-bold uppercase tracking-[2.5px] text-gray-400 mb-3">Resumo</div>
        <METRIC_ROW
          label={isCampo ? 'Área' : 'Área/canteiro'}
          value={isCampo ? `${(resultado.areaHa||1).toLocaleString('pt-BR')} ha` : `${(resultado.area||0).toFixed(1)} m²`}
        />
        <METRIC_ROW
          label={isCampo ? 'Plantas/ha → total' : 'Total plantas'}
          value={isCampo
            ? `${(resultado.plantasPorHa||0).toLocaleString('pt-BR')} → ${totalPlantas.toLocaleString('pt-BR')}`
            : totalPlantas.toLocaleString('pt-BR')}
        />
        <METRIC_ROW label={plantasLabel} value={plantasValue} />
        <METRIC_ROW label="Custo total" value={formatBRL(custoTotal)} />
        <METRIC_ROW label="Custo/unidade" value={formatBRL(custoPlanta)} />
        <METRIC_ROW label="Receita" value={formatBRL(receita)} accent />
        <METRIC_ROW label="Ponto equilíbrio" value={`${pontoEquilibrio} un.`} />
      </motion.div>

      {/* ── Donut chart ── */}
      {composicaoCustos.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="card p-4"
        >
          <div className="text-[9px] font-bold uppercase tracking-[2.5px] text-gray-400 mb-2">Composição dos custos</div>
          <ResponsiveContainer width="100%" height={120}>
            <PieChart>
              <Pie data={composicaoCustos} cx="50%" cy="50%" innerRadius={30} outerRadius={52} dataKey="value" paddingAngle={3} strokeWidth={0}>
                {composicaoCustos.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Pie>
              <Tooltip content={<CustomTooltip formatBRL={formatBRL} />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center">
            {composicaoCustos.map(e => (
              <div key={e.name} className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: e.fill }} />
                <span className="text-[9px] text-gray-400">{e.name}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Spark area chart ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="card p-4"
      >
        <div className="text-[9px] font-bold uppercase tracking-[2.5px] text-gray-400 mb-2">Custo · Receita · Lucro</div>
        <ResponsiveContainer width="100%" height={70}>
          <AreaChart data={sparkData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={cultura.cor} stopOpacity={0.3} />
                <stop offset="100%" stopColor={cultura.cor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <Area type="monotone" dataKey="v" stroke={cultura.cor} strokeWidth={2} fill="url(#areaGrad)" dot={{ fill: cultura.cor, r: 3 }} />
            <Tooltip content={<CustomTooltip formatBRL={formatBRL} />} />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>
    </div>
  );
}
