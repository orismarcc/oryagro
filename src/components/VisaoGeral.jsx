import React, { useEffect, useRef, useState } from 'react';
import { Droplets, Thermometer, Leaf, FlaskConical, Clock, ArrowUpRight, MapPin, Ruler, Sprout, Grid3x3 } from 'lucide-react';

function CountUp({ to, duration = 0.9, format = v => Math.round(v).toLocaleString('pt-BR') }) {
  const [val, setVal] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / (duration * 1000), 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(ease * to);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [to, duration]);
  return <span>{format(val)}</span>;
}

const INFO_FIELDS = [
  { key: 'soloTipo',           label: 'Solo',   Icon: Leaf,        circle: 'icon-circle-success' },
  { key: 'pH',                 label: 'pH',     Icon: FlaskConical,circle: 'icon-circle-secondary' },
  { key: 'necessidadeHidrica', label: 'Água',   Icon: Droplets,    circle: 'icon-circle-accent' },
  { key: 'clima',              label: 'Clima',  Icon: Thermometer, circle: 'icon-circle-warning' },
  { key: 'ciclo',              label: 'Ciclo',  Icon: Clock,       circle: 'icon-circle-primary' },
];

export default function VisaoGeral({ cultura }) {
  const isCampo = cultura.tipo === 'campo';

  let stats;
  if (isCampo) {
    const pph = Math.floor(10000 / (cultura.espacamento.linhas * cultura.espacamento.plantas));
    stats = [
      { label: 'Área base',   value: cultura.areaPadrao,          Icon: MapPin,    numericTo: null },
      { label: 'Espaçamento', value: cultura.espacamentoPadrao,   Icon: Ruler,     numericTo: null },
      { label: 'Plantas/ha',  value: null, numericTo: pph,        Icon: Sprout,    suffix: '' },
      { label: 'Sistema',     value: 'Campo aberto',              Icon: Grid3x3,   numericTo: null },
    ];
  } else {
    const area   = cultura.canteiro.comprimento * cultura.canteiro.largura;
    const linhas = Math.floor(cultura.canteiro.largura / cultura.canteiro.espacamentoLinhas);
    const porL   = Math.floor(cultura.canteiro.comprimento / cultura.canteiro.espacamentoPlantas);
    stats = [
      { label: 'Área/canteiro',    value: `${area} m²`,                              Icon: MapPin,  numericTo: null },
      { label: 'Dimensões',        value: `${cultura.canteiro.comprimento}×${cultura.canteiro.largura} m`, Icon: Ruler, numericTo: null },
      { label: 'Plantas/canteiro', value: null, numericTo: linhas * porL,             Icon: Sprout,  suffix: '' },
      { label: 'Equiv. em ha',     value: null, numericTo: Math.round(10000 / area),  Icon: Grid3x3, suffix: ' cant.' },
    ];
  }

  return (
    <div className="px-4 pt-5 pb-4 max-w-2xl mx-auto">

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={`card-interactive p-4 animate-enter-${i}`}
          >
            <div
              className="icon-circle w-9 h-9 mb-3"
              style={{ background: `${cultura.cor}15`, color: cultura.cor }}
            >
              <s.Icon size={16} />
            </div>

            {s.numericTo != null ? (
              <p className="font-display text-2xl font-black leading-none mb-0.5" style={{ color: cultura.cor }}>
                <CountUp to={s.numericTo} />
                {s.suffix && (
                  <span className="text-sm font-sans font-semibold ml-1" style={{ color: cultura.cor }}>
                    {s.suffix}
                  </span>
                )}
              </p>
            ) : (
              <p className="font-display text-lg font-bold text-foreground leading-tight mb-0.5">{s.value}</p>
            )}

            <p className="section-label">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── About card ── */}
      <div className="card-elevated p-5 mb-4 animate-enter-2">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p
              className="text-[10px] font-bold uppercase tracking-widest mb-0.5"
              style={{ color: cultura.cor }}
            >
              Sobre a Cultura
            </p>
            <p className="text-xs italic text-muted-foreground">{cultura.nomesCientifico}</p>
          </div>
          <ArrowUpRight size={14} className="text-muted-foreground mt-1 flex-shrink-0" />
        </div>

        <div
          className="h-px w-full mb-4"
          style={{ background: `linear-gradient(90deg, ${cultura.cor}40, transparent)` }}
        />

        <p className="text-sm text-muted-foreground leading-relaxed">{cultura.descricao}</p>

        <div
          className="mt-4 pt-3 text-[11px] font-bold uppercase tracking-widest"
          style={{
            borderTop: '1px solid hsl(214 20% 88%)',
            color: cultura.cor,
          }}
        >
          {cultura.ciclo}
        </div>
      </div>

      {/* ── Info list ── */}
      <div className="flex flex-col gap-2 animate-enter-3">
        {INFO_FIELDS.map(({ key, label, Icon, circle }) => (
          <div
            key={key}
            className="card flex items-center gap-3 px-4 py-3"
          >
            <div
              className={`icon-circle w-9 h-9 flex-shrink-0`}
              style={{ background: `${cultura.cor}12`, color: cultura.cor }}
            >
              <Icon size={15} />
            </div>
            <div>
              <p className="section-label">{label}</p>
              <p className="text-[13px] font-semibold text-foreground leading-tight mt-0.5">
                {cultura[key]}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
