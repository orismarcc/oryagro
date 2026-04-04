import React from 'react';
import { cn } from '@/lib/utils';
import { CULTURAS_LIST } from '../data/culturas';
import { BarChart2 } from 'lucide-react';

const EMOJIS = {
  alface: '🥬', cebolinha: '🧅', coentro: '🌿',
  quiabo: '🫛', mandioca: '🍠', abacaxi: '🍍',
};

export default function Sidebar({ culturaSelecionada, onSelectCultura, onSelectComparacao }) {
  return (
    <aside className="sidebar-noise w-[260px] min-h-screen flex flex-col flex-shrink-0 border-r border-white/5">

      {/* ── Logo ── */}
      <div className="px-6 pt-7 pb-5 border-b border-white/8">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-display font-bold text-white tracking-tight">Ory</span>
          <span className="text-2xl font-display font-bold tracking-tight" style={{ color: '#52b788' }}>Agro</span>
        </div>
        <div className="text-[10px] tracking-[2.5px] uppercase text-white/30 mt-0.5 font-medium">
          Guia Hortícola
        </div>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">

        <div className="text-[9px] tracking-[2px] uppercase text-white/20 font-bold px-3 mb-2">
          Culturas
        </div>

        <ul className="space-y-0.5">
          {CULTURAS_LIST.map((c, idx) => {
            const isActive = culturaSelecionada === c.id;
            return (
              <li key={c.id}>
                <button
                  onClick={() => onSelectCultura(c.id)}
                  style={{
                    borderLeft: `3px solid ${isActive ? c.cor : 'transparent'}`,
                    background: isActive ? `${c.cor}1a` : 'transparent',
                  }}
                  className={cn(
                    'crop-item w-full flex items-center gap-3 px-3 py-2.5 rounded-r-lg text-left group',
                    'transition-all duration-200',
                    isActive ? 'active' : ''
                  )}
                >
                  {/* Emoji icon */}
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[18px] flex-shrink-0 transition-all"
                    style={{ background: `${c.cor}22` }}
                  >
                    {c.emoji || EMOJIS[c.id] || '🌱'}
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      'text-[13px] font-semibold leading-tight transition-colors',
                      isActive ? 'text-white' : 'text-white/60 group-hover:text-white/85'
                    )}>
                      {c.nome}
                    </div>
                    <div className="text-[10px] text-white/25 mt-0.5 truncate">
                      {c.ciclo}
                    </div>
                  </div>

                  {/* Badge */}
                  {c.tipo === 'campo' && (
                    <span
                      className="text-[8px] px-1.5 py-0.5 rounded font-bold tracking-wider flex-shrink-0"
                      style={{ background: `${c.cor}30`, color: c.cor }}
                    >
                      HA
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {/* ── Análise section ── */}
        <div className="mt-5 pt-4 border-t border-white/8">
          <div className="text-[9px] tracking-[2px] uppercase text-white/20 font-bold px-3 mb-2">
            Análise
          </div>
          <button
            onClick={onSelectComparacao}
            className={cn(
              'crop-item w-full flex items-center gap-3 px-3 py-2.5 rounded-r-lg text-left group transition-all duration-200',
              culturaSelecionada === '__comparacao__' ? 'active' : ''
            )}
            style={{
              borderLeft: `3px solid ${culturaSelecionada === '__comparacao__' ? '#52b788' : 'transparent'}`,
              background: culturaSelecionada === '__comparacao__' ? '#52b78818' : 'transparent',
            }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#52b78822' }}>
              <BarChart2 size={15} color="#52b788" />
            </div>
            <span className={cn(
              'text-[13px] font-semibold transition-colors',
              culturaSelecionada === '__comparacao__' ? 'text-white' : 'text-white/60 group-hover:text-white/85'
            )}>
              Comparar Culturas
            </span>
          </button>
        </div>
      </nav>

      {/* ── Footer ── */}
      <div className="px-6 py-4 border-t border-white/6">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-verde-400 animate-pulse" />
          <span className="text-[10px] text-white/20">Ory Agro © 2025</span>
        </div>
      </div>
    </aside>
  );
}
