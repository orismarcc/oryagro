import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Leaf, Droplets, Thermometer, FlaskConical, Clock } from 'lucide-react';
import VisaoGeral from './VisaoGeral';
import ManejoAdubacao from './ManejoAdubacao';
import CronogramaTimeline from './CronogramaTimeline';
import SimuladorFinanceiro from './SimuladorFinanceiro';

const GLASS_STATS = (c) => [
  { Icon: FlaskConical, label: 'Solo',   value: c.soloTipo },
  { Icon: Clock,        label: 'Ciclo',  value: c.ciclo },
  { Icon: Droplets,     label: 'Água',   value: c.necessidadeHidrica },
];

export default function CulturaPage({ cultura, section }) {
  const isCampo = cultura.tipo === 'campo';

  return (
    <div className="min-h-screen bg-background">

      {/* ── Hero ─────────────────────────────────────────── */}
      <div className="gradient-hero relative overflow-hidden">

        {/* Culture-colored glow blobs */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: '-30%', right: '-15%',
            width: '55%', height: '65%',
            background: `radial-gradient(circle, ${cultura.cor}35 0%, transparent 70%)`,
          }}
        />
        <div
          className="absolute pointer-events-none"
          style={{
            bottom: '-20%', left: '-10%',
            width: '40%', height: '50%',
            background: `radial-gradient(circle, ${cultura.cor}18 0%, transparent 70%)`,
          }}
        />

        {/* Ghost name watermark */}
        <div
          className="absolute right-0 bottom-0 select-none pointer-events-none font-display font-black leading-none overflow-hidden"
          style={{
            fontSize: 'clamp(80px, 16vw, 160px)',
            color: cultura.cor,
            opacity: 0.07,
            letterSpacing: '-0.06em',
            right: '-2%',
            bottom: '-10%',
          }}
        >
          {cultura.nome}
        </div>

        <div className="relative z-10 px-5 pt-5 pb-6">

          {/* Top row: icon + identity + badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-start justify-between mb-4"
          >
            <div className="flex items-center gap-3">
              <div
                className="h-12 w-12 rounded-2xl flex items-center justify-center border flex-shrink-0"
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  borderColor: 'rgba(255,255,255,0.25)',
                  fontSize: 22,
                }}
              >
                {cultura.emoji}
              </div>
              <div>
                <p className="text-white/55 text-xs italic leading-none mb-1">
                  {cultura.nomesCientifico}
                </p>
                <h1
                  className="font-display text-white font-extrabold leading-tight"
                  style={{ fontSize: 'clamp(22px, 5vw, 32px)' }}
                >
                  {cultura.nome}
                </h1>
              </div>
            </div>

            {isCampo && (
              <span
                className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full flex-shrink-0 mt-1"
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  color: 'rgba(255,255,255,0.8)',
                  border: '1px solid rgba(255,255,255,0.2)',
                }}
              >
                campo · ha
              </span>
            )}
          </motion.div>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.08 }}
            className="text-white/65 text-sm leading-relaxed mb-5 max-w-lg"
          >
            {cultura.descricao}
          </motion.p>

          {/* Glass stat chips */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.14 }}
            className="grid grid-cols-3 gap-2"
          >
            {GLASS_STATS(cultura).map(({ Icon, label, value }) => (
              <div
                key={label}
                className="glass rounded-xl p-3"
                style={{ borderColor: 'rgba(255,255,255,0.18)' }}
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Icon size={11} className="text-white/60" />
                  <span className="text-white/55 text-[9px] font-bold uppercase tracking-widest">
                    {label}
                  </span>
                </div>
                <p className="text-white font-display text-xs font-bold leading-tight">
                  {value}
                </p>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* ── Tab content ──────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${cultura.id}-${section}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          {section === 'visao'      && <VisaoGeral         cultura={cultura} />}
          {section === 'manejo'     && <ManejoAdubacao      cultura={cultura} />}
          {section === 'cronograma' && <CronogramaTimeline  cultura={cultura} />}
          {section === 'simulador'  && <SimuladorFinanceiro cultura={cultura} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
