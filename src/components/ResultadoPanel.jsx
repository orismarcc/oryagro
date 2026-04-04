import React from 'react';
import { Box, Typography, LinearProgress, Divider } from '@mui/material';
import { PieChart, Pie, Cell, Tooltip as RTooltip, BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';

function MetricaRow({ label, value, destaque }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1, borderBottom: '1px solid #f0ede8' }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={destaque ? 700 : 500} color={destaque ? 'primary.main' : 'text.primary'}>
        {value}
      </Typography>
    </Box>
  );
}

export default function ResultadoPanel({ resultado, cultura }) {
  const {
    area, areaHa, totalPlantas, plantasPorHa, plantasViaveis,
    custoTotal, custoPlanta, receita, lucro, margem,
    pontoEquilibrio, composicaoCustos, formatBRL, isCampo,
  } = resultado;
  const margemColor = margem >= 50 ? '#1e4d2b' : margem >= 20 ? '#d4a017' : '#c0392b';

  const barData = [
    { name: 'Custo', valor: parseFloat(custoTotal.toFixed(2)), fill: '#b5451b' },
    { name: 'Receita', valor: parseFloat(receita.toFixed(2)), fill: '#52b788' },
    { name: 'Lucro', valor: parseFloat(lucro.toFixed(2)), fill: '#1e4d2b' },
  ];

  // Build area row
  const areaLabel = 'Área calculada';
  const areaValue = isCampo
    ? `${(areaHa || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })} ha`
    : `${(area || 0).toFixed(1)} m²`;

  // Build total plants row
  const plantasLabel = 'Total de plantas';
  const plantasValue = isCampo
    ? `${(plantasPorHa || 0).toLocaleString('pt-BR')} /ha → ${(totalPlantas || 0).toLocaleString('pt-BR')}`
    : (totalPlantas || 0).toLocaleString('pt-BR');

  // Build comercializáveis / produção row
  const isMandioca = isCampo && cultura.id === 'mandioca';
  const comercLabel = isMandioca ? 'Produção estimada' : 'Plantas comercializáveis';
  const comercValue = isMandioca
    ? `${((cultura.venda.producaoKgPorHa || 20000) * (areaHa || 1)).toLocaleString('pt-BR')} kg`
    : (plantasViaveis || 0).toLocaleString('pt-BR');

  return (
    <Box sx={{ p: 2, border: '1px solid #e8e4de', borderRadius: '6px', bgcolor: 'background.paper' }}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5, fontFamily: 'Fraunces, Georgia, serif', color: 'primary.main' }}>
        Resumo Financeiro
      </Typography>

      <MetricaRow label={areaLabel} value={areaValue} />
      <MetricaRow label={plantasLabel} value={plantasValue} />
      <MetricaRow label={comercLabel} value={comercValue} />
      <MetricaRow label="Custo total de produção" value={formatBRL(custoTotal)} />
      <MetricaRow label="Custo por planta" value={formatBRL(custoPlanta)} />
      <MetricaRow label="Receita estimada" value={formatBRL(receita)} />
      <MetricaRow label="Lucro estimado" value={formatBRL(lucro)} destaque />
      <MetricaRow label="Ponto de equilíbrio" value={`${pontoEquilibrio} unidades`} />

      <Box sx={{ mt: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary">Margem bruta</Typography>
          <Typography variant="caption" fontWeight={700} sx={{ color: margemColor }}>{margem.toFixed(1)}%</Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={Math.min(100, Math.max(0, margem))}
          sx={{
            height: 8, borderRadius: 4,
            bgcolor: '#f0ede8',
            '& .MuiLinearProgress-bar': { bgcolor: margemColor, borderRadius: 4 },
          }}
        />
      </Box>

      <Divider sx={{ my: 2 }} />
      <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mb: 1, display: 'block' }}>Composição dos custos</Typography>
      <ResponsiveContainer width="100%" height={160}>
        <PieChart>
          <Pie data={composicaoCustos} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={2}>
            {composicaoCustos.map((entry, index) => (
              <Cell key={index} fill={entry.fill} />
            ))}
          </Pie>
          <RTooltip formatter={(v) => formatBRL(v)} />
        </PieChart>
      </ResponsiveContainer>

      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={barData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis hide />
          <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
            {barData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
          </Bar>
          <RTooltip formatter={(v) => formatBRL(v)} />
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}
