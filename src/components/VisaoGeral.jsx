import React, { useEffect, useRef, useState } from 'react';
import { Droplets, Thermometer, Leaf, FlaskConical, Clock, ArrowUpRight, MapPin, Ruler, Sprout, Grid3x3, Calculator } from 'lucide-react';

function CountUp({ to, duration = 0.6, format = v => Math.round(v).toLocaleString('pt-BR') }) {
  const [val, setVal] = useState(to);
  const raf = useRef(null);
  const prev = useRef(to);
  useEffect(() => {
    const from = prev.current;
    prev.current = to;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / (duration * 1000), 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(from + (to - from) * ease);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [to]);
  return <span>{format(val)}</span>;
}

function CalcInput({ label, value, onChange, unit, step = '0.01', min = '0' }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="section-label">{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={min}
          step={step}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="flex-1 rounded-xl border px-3 py-2 text-sm font-semibold text-foreground bg-background focus:outline-none focus:ring-2 min-w-0"
          style={{ borderColor: 'hsl(214 20% 88%)' }}
        />
        {unit && <span className="text-[11px] text-muted-foreground font-medium flex-shrink-0">{unit}</span>}
      </div>
    </div>
  );
}

const INFO_FIELDS = [
  { key: 'soloTipo',           label: 'Solo',   Icon: Leaf },
  { key: 'pH',                 label: 'pH',     Icon: FlaskConical },
  { key: 'necessidadeHidrica', label: 'Água',   Icon: Droplets },
  { key: 'clima',              label: 'Clima',  Icon: Thermometer },
  { key: 'ciclo',              label: 'Ciclo',  Icon: Clock },
];

export default function VisaoGeral({ cultura }) {
  const isCampo = cultura.tipo === 'campo';

  // ── Calculator state ──
  const [calc, setCalc] = useState(
    isCampo
      ? { area: 1, linhas: cultura.espacamento.linhas, plantas: cultura.espacamento.plantas }
      : {
          comprimento: cultura.canteiro.comprimento,
          largura: cultura.canteiro.largura,
          linhas: cultura.canteiro.espacamentoLinhas,
          plantas: cultura.canteiro.espacamentoPlantas,
        }
  );

  const set = (field) => (val) => setCalc(c => ({ ...c, [field]: val }));

  // ── Live calculation ──
  let totalPlantas = 0;
  let sublabel = '';

  const comp = parseFloat(calc.comprimento) || 0;
  const larg = parseFloat(calc.largura) || 0;
  const el   = parseFloat(calc.linhas) || 0;
  const ep   = parseFloat(calc.plantas) || 0;
  const a    = parseFloat(calc.area) || 0;

  if (isCampo) {
    const pph = el > 0 && ep > 0 ? Math.floor(10000 / (el * ep)) : 0;
    totalPlantas = Math.round(pph * a);
    sublabel = `${pph.toLocaleString('pt-BR')} plantas/ha × ${a} ha`;
  } else {
    const nLinhas  = el > 0 ? Math.floor(larg / el) : 0;
    const porLinha = ep > 0 ? Math.floor(comp / ep) : 0;
    totalPlantas = nLinhas * porLinha;
    sublabel = `${nLinhas} linhas × ${porLinha} plantas/linha`;
  }

  // ── Reactive stat cards ──
  let stats;
  if (isCampo) {
    const pph = el > 0 && ep > 0 ? Math.floor(10000 / (el * ep)) : 0;
    stats = [
      { label: 'Área',         value: `${a} ha`,                            Icon: MapPin,  numericTo: null },
      { label: 'Espaçamento',  value: el && ep ? `${el}×${ep} m` : '—',    Icon: Ruler,   numericTo: null },
      { label: 'Plantas/ha',   numericTo: pph,    suffix: '',               Icon: Sprout   },
      { label: 'Total plantas',numericTo: Math.round(pph * a), suffix: '',  Icon: Grid3x3  },
    ];
  } else {
    const area    = comp * larg;
    const nLinhas = el > 0 ? Math.floor(larg / el) : 0;
    const porL    = ep > 0 ? Math.floor(comp / ep) : 0;
    stats = [
      { label: 'Área/canteiro',    value: area > 0 ? `${area.toFixed(1)} m²` : '—',   Icon: MapPin,  numericTo: null },
      { label: 'Dimensões',        value: comp && larg ? `${comp}×${larg} m` : '—',   Icon: Ruler,   numericTo: null },
      { label: 'Plantas/canteiro', numericTo: nLinhas * porL,                          Icon: Sprout,  suffix: '' },
      { label: 'Equiv. em ha',     numericTo: area > 0 ? Math.round(10000 / area) : 0, Icon: Grid3x3, suffix: ' cant.' },
    ];
  }

  return (
    <div className="px-4 pt-5 pb-4 max-w-2xl mx-auto">

      {/* ── Stat cards (reativos) ── */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {stats.map((s, i) => (
          <div key={s.label} className={`card-interactive p-4 animate-enter-${i}`}>
            <div className="icon-circle w-9 h-9 mb-3" style={{ background: `${cultura.cor}15`, color: cultura.cor }}>
              <s.Icon size={16} />
            </div>
            {s.numericTo != null ? (
              <p className="font-display text-2xl font-black leading-none mb-0.5" style={{ color: cultura.cor }}>
                <CountUp to={s.numericTo} />
                {s.suffix && <span className="text-sm font-sans font-semibold ml-1">{s.suffix}</span>}
              </p>
            ) : (
              <p className="font-display text-lg font-bold text-foreground leading-tight mb-0.5">{s.value}</p>
            )}
            <p className="section-label">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Calculadora de Plantio ── */}
      <div className="card-elevated p-5 mb-4 animate-enter-2">
        <div className="flex items-center gap-2 mb-4">
          <div className="icon-circle w-8 h-8" style={{ background: `${cultura.cor}15`, color: cultura.cor }}>
            <Calculator size={14} />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: cultura.cor }}>
              Calculadora de Plantio
            </p>
            <p className="text-[11px] text-muted-foreground leading-none mt-0.5">
              {isCampo ? 'Ajuste área e espaçamento' : 'Ajuste as dimensões do canteiro'}
            </p>
          </div>
        </div>

        {isCampo ? (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <CalcInput label="Área"           value={calc.area}    onChange={set('area')}    unit="ha"  step="0.5" min="0.1" />
            <CalcInput label="Espaç. linhas"  value={calc.linhas}  onChange={set('linhas')}  unit="m"   step="0.1" />
            <CalcInput label="Espaç. plantas" value={calc.plantas} onChange={set('plantas')} unit="m"   step="0.1" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <CalcInput label="Comprimento"    value={calc.comprimento} onChange={set('comprimento')} unit="m"   step="1"    min="1" />
            <CalcInput label="Largura"        value={calc.largura}     onChange={set('largura')}     unit="m"   step="0.1"  min="0.5" />
            <CalcInput label="Espaç. linhas"  value={calc.linhas}      onChange={set('linhas')}      unit="m"   step="0.05" />
            <CalcInput label="Espaç. plantas" value={calc.plantas}     onChange={set('plantas')}     unit="m"   step="0.05" />
          </div>
        )}

        <div
          className="rounded-2xl px-4 py-3 flex items-center justify-between"
          style={{ background: `${cultura.cor}12`, border: `1px solid ${cultura.cor}25` }}
        >
          <div>
            <p className="section-label mb-0.5">Total de plantas</p>
            <p className="text-[11px] text-muted-foreground">{sublabel}</p>
          </div>
          <div className="text-right">
            <p className="font-display text-3xl font-black leading-none" style={{ color: cultura.cor }}>
              <CountUp to={totalPlantas} />
            </p>
            <p className="section-label mt-0.5">{isCampo ? 'plantas/total' : 'plantas/canteiro'}</p>
          </div>
        </div>
      </div>

      {/* ── About card ── */}
      <div className="card-elevated p-5 mb-4 animate-enter-3">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: cultura.cor }}>Sobre a Cultura</p>
            <p className="text-xs italic text-muted-foreground">{cultura.nomesCientifico}</p>
          </div>
          <ArrowUpRight size={14} className="text-muted-foreground mt-1 flex-shrink-0" />
        </div>
        <div className="h-px w-full mb-4" style={{ background: `linear-gradient(90deg, ${cultura.cor}40, transparent)` }} />
        <p className="text-sm text-muted-foreground leading-relaxed">{cultura.descricao}</p>
        <div className="mt-4 pt-3 text-[11px] font-bold uppercase tracking-widest"
          style={{ borderTop: '1px solid hsl(214 20% 88%)', color: cultura.cor }}>
          {cultura.ciclo}
        </div>
      </div>

      {/* ── Info list ── */}
      <div className="flex flex-col gap-2 animate-enter-4">
        {INFO_FIELDS.map(({ key, label, Icon }) => (
          <div key={key} className="card flex items-center gap-3 px-4 py-3">
            <div className="icon-circle w-9 h-9 flex-shrink-0" style={{ background: `${cultura.cor}12`, color: cultura.cor }}>
              <Icon size={15} />
            </div>
            <div>
              <p className="section-label">{label}</p>
              <p className="text-[13px] font-semibold text-foreground leading-tight mt-0.5">{cultura[key]}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
