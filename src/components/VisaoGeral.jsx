import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Droplets, Thermometer, Leaf, FlaskConical, Clock, ArrowUpRight } from 'lucide-react';

/* Animated number count-up */
function CountUp({ to, duration = 0.9, format = (v) => Math.round(v).toLocaleString('pt-BR') }) {
  const [val, setVal] = useState(0);
  const rafRef = useRef(null);
  useEffect(() => {
    const start = performance.now();
    const animate = (now) => {
      const progress = Math.min((now - start) / (duration * 1000), 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setVal(ease * to);
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [to, duration]);
  return <span>{format(val)}</span>;
}

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};
const cardVariants = {
  hidden:   { opacity: 0, y: 20, scale: 0.97 },
  visible:  { opacity: 1, y: 0,  scale: 1, transition: { type: 'spring', stiffness: 280, damping: 24 } },
};
const infoVariants = {
  hidden:   { opacity: 0, x: 16 },
  visible:  (i) => ({ opacity: 1, x: 0, transition: { delay: i * 0.06, duration: 0.35, ease: [0.16, 1, 0.3, 1] } }),
};

const INFO_FIELDS = [
  { key: 'soloTipo',           label: 'Solo',   Icon: Leaf },
  { key: 'pH',                 label: 'pH',     Icon: FlaskConical },
  { key: 'necessidadeHidrica', label: 'Água',   Icon: Droplets },
  { key: 'clima',              label: 'Clima',  Icon: Thermometer },
  { key: 'ciclo',              label: 'Ciclo',  Icon: Clock },
];

export default function VisaoGeral({ cultura }) {
  const isCampo = cultura.tipo === 'campo';

  let stats;
  if (isCampo) {
    const pph = Math.floor(10000 / (cultura.espacamento.linhas * cultura.espacamento.plantas));
    stats = [
      { label: 'Área base',    value: cultura.areaPadrao,     numericTo: null },
      { label: 'Espaçamento',  value: cultura.espacamentoPadrao, numericTo: null },
      { label: 'Plantas/ha',   value: null, numericTo: pph },
      { label: 'Sistema',      value: 'Campo aberto', numericTo: null },
    ];
  } else {
    const area   = cultura.canteiro.comprimento * cultura.canteiro.largura;
    const linhas = Math.floor(cultura.canteiro.largura / cultura.canteiro.espacamentoLinhas);
    const porL   = Math.floor(cultura.canteiro.comprimento / cultura.canteiro.espacamentoPlantas);
    stats = [
      { label: 'Área/canteiro',    value: `${area} m²`,     numericTo: null },
      { label: 'Dimensões',        value: `${cultura.canteiro.comprimento}×${cultura.canteiro.largura} m`, numericTo: null },
      { label: 'Plantas/canteiro', value: null,              numericTo: linhas * porL },
      { label: 'Equiv. em ha',     value: null,              numericTo: Math.round(10000 / area), suffix: ' canteiros' },
    ];
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl">

      {/* ── Stat cards ── */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            variants={cardVariants}
            whileHover={{ y: -3, boxShadow: '0 0 0 1px rgba(0,0,0,0.04), 0 12px 40px rgba(0,0,0,0.12)' }}
            className="card p-5 flex flex-col justify-between min-h-[110px] cursor-default"
          >
            {/* Color accent top line */}
            <div
              className="w-8 h-0.5 rounded-full mb-3"
              style={{ background: cultura.cor }}
            />

            {/* Value */}
            <div>
              {s.numericTo != null ? (
                <div className="stat-num text-2xl mb-1" style={{ color: cultura.cor }}>
                  <CountUp to={s.numericTo} />
                  {s.suffix && <span className="text-sm ml-1 font-sans font-normal" style={{ color: cultura.cor }}>{s.suffix}</span>}
                </div>
              ) : (
                <div className="font-bold text-[15px] text-gray-900 leading-snug mb-1">{s.value}</div>
              )}
              <div className="text-[10px] font-semibold uppercase tracking-[1.5px] text-gray-400">{s.label}</div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Bottom grid ── */}
      <div className="grid md:grid-cols-[1fr_260px] gap-4">

        {/* About card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="card p-6"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <div
                className="text-[10px] font-bold uppercase tracking-[2px] mb-1"
                style={{ color: cultura.cor }}
              >
                Sobre a Cultura
              </div>
              <div className="text-xs italic text-gray-400">{cultura.nomesCientifico}</div>
            </div>
            <ArrowUpRight size={14} className="text-gray-300 mt-1" />
          </div>

          {/* Accent line */}
          <div
            className="w-full h-px mb-4"
            style={{ background: `linear-gradient(90deg, ${cultura.cor}40, transparent)` }}
          />

          <p className="text-sm text-gray-600 leading-relaxed">{cultura.descricao}</p>

          <div
            className="mt-5 pt-4 border-t text-[11px] font-semibold uppercase tracking-widest"
            style={{ borderColor: 'rgba(0,0,0,0.06)', color: cultura.cor }}
          >
            {cultura.ciclo}
          </div>
        </motion.div>

        {/* Info chips */}
        <div className="flex flex-col gap-2">
          {INFO_FIELDS.map(({ key, label, Icon }, i) => (
            <motion.div
              key={key}
              custom={i}
              variants={infoVariants}
              initial="hidden"
              animate="visible"
              whileHover={{ x: 3 }}
              className="card flex items-center gap-3 px-4 py-3"
              style={{ cursor: 'default' }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `${cultura.cor}12` }}
              >
                <Icon size={14} style={{ color: cultura.cor }} />
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase tracking-[1.8px] text-gray-400">{label}</div>
                <div className="text-[12px] font-semibold text-gray-800 leading-tight mt-0.5">{cultura[key]}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
