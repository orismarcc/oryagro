import React, { useState } from 'react';
import { Eye, Beaker, Calendar, BarChart2 } from 'lucide-react';
import VisaoGeral from './VisaoGeral';
import ManejoAdubacao from './ManejoAdubacao';
import CronogramaTimeline from './CronogramaTimeline';
import SimuladorFinanceiro from './SimuladorFinanceiro';

const TABS = [
  { value: 'visao',      label: 'Visão Geral',  Icon: Eye },
  { value: 'manejo',     label: 'Manejo',        Icon: Beaker },
  { value: 'cronograma', label: 'Cronograma',    Icon: Calendar },
  { value: 'simulador',  label: 'Simulador',     Icon: BarChart2 },
];

const INFO_CHIPS = (c) => [
  { label: c.soloTipo,          prefix: 'Solo',   color: '#5a3e1b' },
  { label: c.pH,                prefix: 'pH',     color: '#1a6b9a' },
  { label: c.necessidadeHidrica,prefix: 'Água',   color: '#1e4d2b' },
  { label: c.clima,             prefix: 'Clima',  color: '#7b1fa2' },
  { label: c.ciclo,             prefix: 'Ciclo',  color: '#555' },
];

export default function CulturaPage({ cultura }) {
  const [activeTab, setActiveTab] = useState('visao');
  const chips = INFO_CHIPS(cultura);

  return (
    <div className="flex flex-col min-h-screen">

      {/* ── Hero Header ────────────────────────────── */}
      <header
        className="relative overflow-hidden border-b border-borda"
        style={{
          background: `linear-gradient(135deg, ${cultura.cor}18 0%, ${cultura.cor}06 55%, transparent 100%)`,
        }}
      >
        {/* Decorative giant letter */}
        <div
          className="absolute right-6 top-1/2 -translate-y-1/2 font-display font-bold select-none pointer-events-none leading-none"
          style={{
            fontSize: 'clamp(80px, 14vw, 160px)',
            color: cultura.cor,
            opacity: 0.055,
            letterSpacing: '-0.04em',
          }}
        >
          {cultura.nome}
        </div>

        <div className="relative px-8 py-7">
          {/* Scientific name */}
          <div className="text-xs italic text-gray-400 mb-1 font-sans tracking-wide">
            {cultura.nomesCientifico}
          </div>

          {/* Crop name + type badge */}
          <div className="flex items-end gap-4 flex-wrap mb-3">
            <h1
              className="font-display font-bold leading-none"
              style={{ fontSize: 'clamp(28px, 5vw, 48px)', color: cultura.cor }}
            >
              {cultura.emoji || ''} {cultura.nome}
            </h1>
            {cultura.tipo === 'campo' && (
              <span
                className="text-[10px] font-bold uppercase tracking-[2px] px-2 py-1 rounded mb-1"
                style={{ background: `${cultura.cor}15`, color: cultura.cor, border: `1px solid ${cultura.cor}30` }}
              >
                Cultura de Campo · por hectare
              </span>
            )}
          </div>

          {/* Description */}
          <p className="text-[13px] text-gray-500 max-w-2xl leading-relaxed mb-4">
            {cultura.descricao}
          </p>

          {/* Info chips */}
          <div className="flex flex-wrap gap-1.5">
            {chips.map(c => (
              <span
                key={c.prefix}
                className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-medium"
                style={{
                  background: `${c.color}10`,
                  color: c.color,
                  border: `1px solid ${c.color}20`,
                }}
              >
                <span className="opacity-60 text-[10px]">{c.prefix}:</span>
                {c.label}
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* ── Tab Navigation ─────────────────────────── */}
      <div className="bg-white border-b border-borda px-6 sticky top-0 z-20 shadow-sm shadow-black/[0.03]">
        <div className="flex gap-1 py-2">
          {TABS.map(({ value, label, Icon }) => {
            const isActive = activeTab === value;
            return (
              <button
                key={value}
                onClick={() => setActiveTab(value)}
                className="relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all duration-200 outline-none"
                style={isActive ? {
                  background: cultura.cor,
                  color: '#fff',
                  boxShadow: `0 2px 8px ${cultura.cor}40`,
                } : {
                  color: '#888',
                  background: 'transparent',
                }}
              >
                <Icon size={14} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab Content ────────────────────────────── */}
      <div className="flex-1 anim-fade-up" key={`${cultura.id}-${activeTab}`}>
        {activeTab === 'visao'      && <VisaoGeral          cultura={cultura} />}
        {activeTab === 'manejo'     && <ManejoAdubacao       cultura={cultura} />}
        {activeTab === 'cronograma' && <CronogramaTimeline   cultura={cultura} />}
        {activeTab === 'simulador'  && <SimuladorFinanceiro  cultura={cultura} />}
      </div>
    </div>
  );
}
