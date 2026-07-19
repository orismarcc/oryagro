import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, AreaChart, Area, XAxis } from 'recharts';
import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';

function CountUpBRL({ value, duration = 0.9 }) {
  const [display, setDisplay] = useState('R$ 0,00');
  const raf = useRef(null);
  const fmt = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  useEffect(() => {
    const target = parseFloat(value) || 0;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / (duration * 1000), 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplay(fmt(ease * target));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, duration]);
  return <span>{display}</span>;
}

const MetricRow = ({ label, value, highlight }) => (
  <div className="flex items-center justify-between py-2.5" style={{ borderBottom: '1px solid hsl(140 13% 93%)' }}>
    <span className="text-[12px] text-muted-foreground">{label}</span>
    <span
      className="text-[12px] font-semibold"
      style={{ color: highlight ? 'hsl(156 64% 31%)' : 'hsl(153 24% 12%)' }}
    >
      {value}
    </span>
  </div>
);

const CustomTooltip = ({ active, payload, formatBRL }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="card px-3 py-2 text-xs shadow-md">
      <div className="font-semibold text-foreground">{payload[0].name}</div>
      <div className="text-muted-foreground mt-0.5">{formatBRL(payload[0].value)}</div>
    </div>
  );
};

export default function ResultadoPanel({ resultado, cultura }) {
  const {
    totalPlantas, plantasViaveis, custoTotal, custoPlanta,
    receita, lucro, margem, pontoEquilibrio, composicaoCustos, formatBRL, isCampo,
  } = resultado;

  const isProfit = lucro >= 0;
  const margemColor = margem >= 50 ? 'hsl(142 72% 30%)' : margem >= 20 ? 'hsl(38 92% 46%)' : 'hsl(4 86% 58%)';
  const cor = cultura.cor;

  const plantasLabel = isCampo && cultura.venda.producaoKgPorHa ? 'Produção estimada' : isCampo ? 'Plantas viáveis' : 'Comercializáveis';
  const plantasValue = isCampo && cultura.venda.producaoKgPorHa
    ? `${(cultura.venda.producaoKgPorHa * (resultado.areaHa || 1)).toLocaleString('pt-BR')} kg`
    : plantasViaveis.toLocaleString('pt-BR');

  const sparkData = [
    { name: 'Custo',   v: custoTotal },
    { name: 'Receita', v: receita },
    { name: 'Lucro',   v: Math.max(0, lucro) },
  ];

  return (
    <div className="flex flex-col gap-3">

      {/* ── Lucro hero ── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-2xl p-5 relative overflow-hidden"
        style={{
          background: isProfit
            ? 'linear-gradient(135deg, hsl(152 60% 96%) 0%, hsl(152 55% 94%) 100%)'
            : 'linear-gradient(135deg, hsl(4 80% 96%) 0%, hsl(4 75% 94%) 100%)',
          border: `1px solid ${isProfit ? 'hsl(142 72% 30% / 0.2)' : 'hsl(4 86% 58% / 0.2)'}`,
        }}
      >
        <div className="absolute right-4 bottom-2 opacity-[0.07] pointer-events-none">
          {isProfit ? <TrendingUp size={72} color={isProfit ? 'hsl(142 72% 30%)' : 'hsl(4 86% 58%)'} /> : <TrendingDown size={72} color="hsl(4 86% 58%)" />}
        </div>

        <p
          className="text-[10px] font-bold uppercase tracking-widest mb-1.5"
          style={{ color: isProfit ? 'hsl(142 72% 30%)' : 'hsl(4 86% 58%)' }}
        >
          {isProfit ? 'Lucro estimado' : 'Prejuízo estimado'}
        </p>

        <div
          className="font-display text-4xl font-black leading-none mb-2"
          style={{ color: isProfit ? 'hsl(142 72% 30%)' : 'hsl(4 86% 58%)' }}
        >
          <CountUpBRL value={lucro} />
        </div>

        <div className="flex items-center gap-3 mt-2">
          <span className="text-[11px] text-muted-foreground">
            Margem: <strong style={{ color: margemColor }}>{margem.toFixed(1)}%</strong>
          </span>
          {margem < 20 && (
            <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: 'hsl(38 92% 46%)' }}>
              <AlertCircle size={10} /> Margem baixa
            </span>
          )}
        </div>

        <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.08)' }}>
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
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="card p-4"
      >
        <p className="section-label mb-3">Resumo</p>
        <MetricRow
          label={isCampo ? 'Área' : 'Área/canteiro'}
          value={isCampo ? `${(resultado.areaHa||1).toLocaleString('pt-BR')} ha` : `${(resultado.area||0).toFixed(1)} m²`}
        />
        <MetricRow
          label={isCampo ? 'Plantas/ha → total' : 'Total plantas'}
          value={isCampo
            ? `${(resultado.plantasPorHa||0).toLocaleString('pt-BR')} → ${totalPlantas.toLocaleString('pt-BR')}`
            : totalPlantas.toLocaleString('pt-BR')}
        />
        <MetricRow label={plantasLabel} value={plantasValue} />
        <MetricRow label="Custo total" value={formatBRL(custoTotal)} />
        <MetricRow label="Custo/unidade" value={formatBRL(custoPlanta)} />
        <MetricRow label="Receita" value={formatBRL(receita)} highlight />
        <MetricRow label="Ponto equilíbrio" value={`${pontoEquilibrio} un.`} />
      </motion.div>

      {/* ── Donut ── */}
      {composicaoCustos.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.3 }}
          className="card p-4"
        >
          <p className="section-label mb-2">Composição dos custos</p>
          <ResponsiveContainer width="100%" height={110}>
            <PieChart>
              <Pie data={composicaoCustos} cx="50%" cy="50%" innerRadius={28} outerRadius={48} dataKey="value" paddingAngle={3} strokeWidth={0}>
                {composicaoCustos.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Pie>
              <Tooltip content={<CustomTooltip formatBRL={formatBRL} />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-1">
            {composicaoCustos.map(e => (
              <div key={e.name} className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: e.fill }} />
                <span className="text-[9px] text-muted-foreground">{e.name}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Spark chart ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.3 }}
        className="card p-4"
      >
        <p className="section-label mb-2">Custo · Receita · Lucro</p>
        <ResponsiveContainer width="100%" height={70}>
          <AreaChart data={sparkData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <defs>
              <linearGradient id={`grad-${cultura.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={cor} stopOpacity={0.3} />
                <stop offset="100%" stopColor={cor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'hsl(150 8% 40%)' }} axisLine={false} tickLine={false} />
            <Area type="monotone" dataKey="v" stroke={cor} strokeWidth={2} fill={`url(#grad-${cultura.id})`} dot={{ fill: cor, r: 3 }} />
            <Tooltip content={<CustomTooltip formatBRL={formatBRL} />} />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>
    </div>
  );
}
