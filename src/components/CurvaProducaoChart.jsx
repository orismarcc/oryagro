/**
 * CurvaProducaoChart.jsx
 *
 * Gráfico de evolução da produção ao longo dos anos para uma cultura.
 * Mostra a curva de maturação + marca onde o lote atual está.
 *
 * Props:
 *   culturaId       — ID da cultura (ex: 'acerola')
 *   culturaNome     — Nome exibido (ex: 'Acerola')
 *   culturaCor      — Cor hex da cultura
 *   curves          — mapa { culturaId: [fator0, fator1, ...] } (do useCurvasProducao)
 *   anoAtual        — ano relativo do lote atual (0, 1, 2...)
 *   producaoPlena   — kg esperados na produção plena (para calcular kg projetados)
 *   compact         — boolean: versão compacta para LotePage
 */
import React from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceDot,
} from 'recharts';

const FALLBACK = [0, 0.70, 1.0, 1.0, 1.0, 1.0];

function buildChartData(curve, producaoPlena) {
  return curve.map((fator, ano) => ({
    ano,
    label: `Ano ${ano}`,
    fator: Math.round(fator * 100),
    kg: producaoPlena ? Math.round(fator * producaoPlena) : null,
  }));
}

function CustomTooltip({ active, payload, label, producaoPlena }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-background border border-border rounded-xl px-3 py-2 shadow-lg text-[12px]">
      <p className="font-bold text-foreground mb-1">{d.label}</p>
      <p className="text-muted-foreground">Produção: <span className="font-semibold text-foreground">{d.fator}%</span></p>
      {d.kg !== null && (
        <p className="text-muted-foreground">Estimativa: <span className="font-semibold text-foreground">{d.kg.toLocaleString('pt-BR')} kg</span></p>
      )}
    </div>
  );
}

export default function CurvaProducaoChart({
  culturaId,
  culturaNome,
  culturaCor = '#16a34a',
  curves = {},
  anoAtual = null,
  producaoPlena = null,
  compact = false,
}) {
  const curve = curves[culturaId] ?? curves._default ?? FALLBACK;
  const data  = buildChartData(curve, producaoPlena);

  // Check if this crop reaches full production quickly (annual/seasonal)
  const anosParaPlena = curve.findIndex(f => f >= 0.99);
  const isAnual = anosParaPlena <= 1;

  // Current production factor if we have anoAtual
  const fatorAtual = anoAtual !== null && curve[anoAtual] !== undefined
    ? Math.round(curve[anoAtual] * 100)
    : null;

  if (compact) {
    // Compact version: inline bar-style for LotePage header
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            Curva de Produção
          </span>
          {fatorAtual !== null && (
            <span className="text-[11px] font-bold" style={{ color: culturaCor }}>
              {fatorAtual}% da capacidade plena
            </span>
          )}
        </div>
        <div className="flex gap-1 items-end h-8">
          {data.map((d, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm transition-all"
              style={{
                height: `${Math.max(d.fator, 6)}%`,
                background: i === anoAtual
                  ? culturaCor
                  : d.fator >= 99
                  ? `${culturaCor}60`
                  : `${culturaCor}30`,
                border: i === anoAtual ? `1.5px solid ${culturaCor}` : 'none',
                minHeight: 4,
              }}
              title={`${d.label}: ${d.fator}%`}
            />
          ))}
        </div>
        <div className="flex justify-between">
          <span className="text-[9px] text-muted-foreground">Ano 0</span>
          <span className="text-[9px] text-muted-foreground">Ano {data.length - 1}+</span>
        </div>
      </div>
    );
  }

  // Full chart version
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-[13px] font-bold text-foreground">
            Curva de Produção — {culturaNome}
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {isAnual
              ? 'Cultura anual — produção plena já no 1º ciclo'
              : `Plena produção em ${anosParaPlena > 0 ? `~${anosParaPlena} anos` : 'menos de 1 ano'}`}
          </p>
        </div>
        {fatorAtual !== null && (
          <div
            className="px-3 py-1.5 rounded-xl text-center"
            style={{ background: `${culturaCor}15`, border: `1px solid ${culturaCor}30` }}
          >
            <div className="text-[18px] font-black leading-none" style={{ color: culturaCor }}>
              {fatorAtual}%
            </div>
            <div className="text-[9px] text-muted-foreground font-medium mt-0.5">este lote</div>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${culturaId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={culturaCor} stopOpacity={0.3} />
              <stop offset="95%" stopColor={culturaCor} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 20% 91%)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: 'hsl(215 16% 55%)' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => v.replace('Ano ', 'A')}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: 'hsl(215 16% 55%)' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip content={<CustomTooltip producaoPlena={producaoPlena} />} />

          {/* Reference line for 100% */}
          <ReferenceLine
            y={100}
            stroke={culturaCor}
            strokeDasharray="4 4"
            strokeOpacity={0.4}
            strokeWidth={1}
          />

          {/* Current year marker */}
          {anoAtual !== null && data[anoAtual] && (
            <ReferenceLine
              x={data[anoAtual].label}
              stroke={culturaCor}
              strokeWidth={2}
              strokeOpacity={0.6}
              label={{
                value: 'Hoje',
                position: 'top',
                fontSize: 10,
                fill: culturaCor,
                fontWeight: 700,
              }}
            />
          )}

          <Area
            type="monotone"
            dataKey="fator"
            stroke={culturaCor}
            strokeWidth={2.5}
            fill={`url(#grad-${culturaId})`}
            dot={(props) => {
              const { cx, cy, index } = props;
              const isActive = index === anoAtual;
              return (
                <circle
                  key={index}
                  cx={cx}
                  cy={cy}
                  r={isActive ? 6 : 3}
                  fill={isActive ? culturaCor : 'white'}
                  stroke={culturaCor}
                  strokeWidth={isActive ? 0 : 2}
                />
              );
            }}
          />
        </AreaChart>
      </ResponsiveContainer>

      {producaoPlena && (
        <div className="mt-3 flex gap-3 flex-wrap">
          {data.filter(d => d.kg !== null && d.fator > 0).slice(0, 4).map(d => (
            <div key={d.ano} className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: d.ano === anoAtual ? culturaCor : `${culturaCor}50` }}
              />
              <span className="text-[10px] text-muted-foreground">
                {d.label}: <span className="font-semibold text-foreground">
                  {d.kg.toLocaleString('pt-BR')} kg
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
