/**
 * CurvaProducaoChart.jsx
 *
 * Gráfico de evolução da produção ao longo dos anos para uma cultura.
 * FIX: usa React.useId() para garantir que o ID do gradient SVG seja único
 * por instância — evita vazamento visual entre múltiplos gráficos na mesma página.
 */
import React, { useId } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
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

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-background border border-border rounded-xl px-3 py-2 shadow-lg text-[12px]">
      <p className="font-bold text-foreground mb-1">{d.label}</p>
      <p className="text-muted-foreground">
        Produção: <span className="font-semibold text-foreground">{d.fator}%</span>
      </p>
      {d.kg !== null && (
        <p className="text-muted-foreground">
          Estimativa: <span className="font-semibold text-foreground">
            {d.kg.toLocaleString('pt-BR')} kg
          </span>
        </p>
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
  totalPlantas = null,
  compact = false,
}) {
  // ID único por instância do componente — evita conflito de IDs SVG na página
  const uid = useId().replace(/:/g, '');
  const gradId = `cpg-${uid}`;

  const curve = curves[culturaId] ?? curves._default ?? FALLBACK;
  const data  = buildChartData(curve, producaoPlena);

  const anosParaPlena = curve.findIndex(f => f >= 0.99);
  const isAnual = anosParaPlena <= 1;

  const fatorAtual = anoAtual !== null && curve[anoAtual] !== undefined
    ? Math.round(curve[anoAtual] * 100)
    : null;

  // ── Média por planta (derivada da MESMA produção plena exibida no gráfico) ──
  // Mantém consistência interna: kg/planta = produção plena ÷ nº de plantas.
  const kgPorPlantaPlena = (producaoPlena && totalPlantas > 0)
    ? producaoPlena / totalPlantas
    : null;
  const kgPorPlantaAtual = (kgPorPlantaPlena !== null && fatorAtual !== null)
    ? kgPorPlantaPlena * (fatorAtual / 100)
    : null;

  // ── Compact (barras inline) ──────────────────────────────────────────────────
  if (compact) {
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
        <div className="flex gap-1 items-end" style={{ height: 32 }}>
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

  // ── Full chart ───────────────────────────────────────────────────────────────
  return (
    <div className="card p-4" style={{ overflow: 'hidden' }}>
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
            className="px-3 py-1.5 rounded-xl text-center flex-shrink-0"
            style={{ background: `${culturaCor}15`, border: `1px solid ${culturaCor}30` }}
          >
            <div className="text-[18px] font-black leading-none" style={{ color: culturaCor }}>
              {fatorAtual}%
            </div>
            <div className="text-[9px] text-muted-foreground font-medium mt-0.5">este lote</div>
          </div>
        )}
      </div>

      {/* Wrapper com overflow hidden garante que o SVG não vaze para fora */}
      <div style={{ overflow: 'hidden', borderRadius: 8 }}>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <defs>
              {/* ID único por instância — chave do fix para o bug de listras */}
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
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
            <Tooltip content={<CustomTooltip />} />

            <ReferenceLine
              y={100}
              stroke={culturaCor}
              strokeDasharray="4 4"
              strokeOpacity={0.4}
              strokeWidth={1}
            />

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
              fill={`url(#${gradId})`}
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
      </div>

      {producaoPlena && (
        <div className="mt-3 flex gap-3 flex-wrap">
          {data.filter(d => d.kg !== null && d.fator > 0).slice(0, 4).map(d => (
            <div key={d.ano} className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
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

      {/* ── Como é calculada a produção (transparência) ────────────────────── */}
      {producaoPlena && (
        <div
          className="mt-3 pt-3 rounded-xl px-3 py-2.5"
          style={{ borderTop: '1px solid hsl(214 20% 91%)', background: `${culturaCor}06` }}
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
            Como é calculada
          </p>
          <ul className="flex flex-col gap-1 text-[11px] text-muted-foreground leading-snug">
            <li>
              🍎 Base: produção <span className="font-semibold text-foreground">in natura</span> (fruta fresca) — não é polpa.
            </li>
            {kgPorPlantaPlena !== null ? (
              <>
                <li>
                  🧮 Fórmula: <span className="font-semibold text-foreground">nº de plantas × kg/planta/ano × % da curva</span> (idade do lote).
                </li>
                <li>
                  🌱 Média por planta:{' '}
                  <span className="font-semibold text-foreground">
                    ~{kgPorPlantaPlena.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg/planta/ano
                  </span>{' '}
                  na produção plena
                  {kgPorPlantaAtual !== null && fatorAtual !== null && (
                    <> · este ano <span className="font-semibold text-foreground">~{kgPorPlantaAtual.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg/planta</span> ({fatorAtual}% da curva)</>
                  )}
                </li>
              </>
            ) : (
              <li>
                🧮 Fórmula: <span className="font-semibold text-foreground">área × kg/ha/ano × % da curva</span> (idade do lote).
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
