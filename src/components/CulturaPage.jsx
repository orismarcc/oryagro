import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, FlaskConical, CalendarDays, TrendingUp } from 'lucide-react';
import VisaoGeral from './VisaoGeral';
import ManejoAdubacao from './ManejoAdubacao';
import CronogramaTimeline from './CronogramaTimeline';
import SimuladorFinanceiro from './SimuladorFinanceiro';

const TABS = [
  { value: 'visao',      label: 'Visão Geral',  Icon: Eye },
  { value: 'manejo',     label: 'Manejo',        Icon: FlaskConical },
  { value: 'cronograma', label: 'Cronograma',    Icon: CalendarDays },
  { value: 'simulador',  label: 'Simulador',     Icon: TrendingUp },
];

const INFO_CHIPS = (c) => [
  { label: c.soloTipo,           prefix: 'Solo' },
  { label: c.pH,                 prefix: 'pH' },
  { label: c.necessidadeHidrica, prefix: 'Água' },
  { label: c.clima,              prefix: 'Clima' },
  { label: c.ciclo,              prefix: 'Ciclo' },
];

const slideVariants = {
  enter: (dir) => ({ opacity: 0, x: dir > 0 ? 24 : -24 }),
  center: { opacity: 1, x: 0 },
  exit:  (dir) => ({ opacity: 0, x: dir > 0 ? -24 : 24 }),
};

export default function CulturaPage({ cultura }) {
  const [activeTab, setActiveTab] = useState('visao');
  const [dir, setDir] = useState(1);
  const tabIdx = TABS.findIndex(t => t.value === activeTab);

  const switchTab = (val) => {
    const newIdx = TABS.findIndex(t => t.value === val);
    setDir(newIdx > tabIdx ? 1 : -1);
    setActiveTab(val);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#f4f6f8]">

      {/* ── Hero ───────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${cultura.cor}12 0%, ${cultura.cor}05 60%, transparent 100%)`,
          borderBottom: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        {/* Ghost name */}
        <div
          className="absolute right-0 top-1/2 -translate-y-1/2 select-none pointer-events-none font-bold leading-none"
          style={{
            fontFamily: 'Fraunces, Georgia, serif',
            fontSize: 'clamp(100px, 18vw, 200px)',
            color: cultura.cor,
            opacity: 0.045,
            letterSpacing: '-0.05em',
            right: '-2%',
          }}
        >
          {cultura.nome}
        </div>

        <div className="relative px-8 py-8">
          {/* Scientific */}
          <motion.p
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-xs italic mb-2"
            style={{ color: 'rgba(0,0,0,0.35)' }}
          >
            {cultura.nomesCientifico}
          </motion.p>

          {/* Crop name */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="flex items-center gap-4 flex-wrap mb-3"
          >
            <h1
              className="display leading-none"
              style={{
                fontSize: 'clamp(36px, 6vw, 60px)',
                color: cultura.cor,
              }}
            >
              {cultura.emoji} {cultura.nome}
            </h1>
            {cultura.tipo === 'campo' && (
              <span
                className="text-[10px] font-bold uppercase tracking-[2px] px-2.5 py-1 rounded-full"
                style={{
                  background: `${cultura.cor}15`,
                  color: cultura.cor,
                  border: `1px solid ${cultura.cor}25`,
                }}
              >
                Campo · por hectare
              </span>
            )}
          </motion.div>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="text-sm max-w-2xl mb-5 leading-relaxed"
            style={{ color: 'rgba(0,0,0,0.5)' }}
          >
            {cultura.descricao}
          </motion.p>

          {/* Chips */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="flex flex-wrap gap-2"
          >
            {INFO_CHIPS(cultura).map(({ prefix, label }) => (
              <span
                key={prefix}
                className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full font-medium"
                style={{
                  background: 'rgba(255,255,255,0.7)',
                  color: 'rgba(0,0,0,0.55)',
                  border: '1px solid rgba(0,0,0,0.07)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <span style={{ color: cultura.cor, fontWeight: 700, fontSize: 10 }}>{prefix}</span>
                {label}
              </span>
            ))}
          </motion.div>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────── */}
      <div
        className="sticky top-0 z-20 px-8 py-3"
        style={{
          background: 'rgba(244,246,248,0.85)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        <div className="tabs-bar inline-flex gap-0.5">
          {TABS.map(({ value, label, Icon }) => {
            const isActive = activeTab === value;
            return (
              <button
                key={value}
                onClick={() => switchTab(value)}
                className="relative flex items-center gap-1.5 px-4 py-2 rounded-[8px] text-[13px] font-semibold outline-none cursor-pointer"
                style={{ color: isActive ? '#fff' : 'rgba(0,0,0,0.45)' }}
              >
                {isActive && (
                  <motion.div
                    layoutId="tab-pill"
                    className="absolute inset-0 rounded-[8px]"
                    style={{ background: cultura.cor }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <Icon size={13} />
                  <span className="hidden sm:inline">{label}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={`${cultura.id}-${activeTab}`}
            custom={dir}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            {activeTab === 'visao'      && <VisaoGeral         cultura={cultura} />}
            {activeTab === 'manejo'     && <ManejoAdubacao      cultura={cultura} />}
            {activeTab === 'cronograma' && <CronogramaTimeline  cultura={cultura} />}
            {activeTab === 'simulador'  && <SimuladorFinanceiro cultura={cultura} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
