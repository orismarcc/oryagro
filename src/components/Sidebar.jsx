import React from 'react';
import { cn } from '@/lib/utils';
import { CULTURAS_LIST } from '../data/culturas';
import { BarChart3 } from 'lucide-react';

const LeafSVG = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
    <path d="M14 3C8 3 4 9 4 14c0 5.5 4 9 10 9 6 0 10-4 10-10C24 7 20 3 14 3z" fill="#52b788" opacity="0.25"/>
    <path d="M14 3C20 3 24 8 24 13C24 18 20 23 14 23" stroke="#ffffff" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <path d="M14 23C8 23 4 18 4 13" stroke="#52b788" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <line x1="14" y1="23" x2="14" y2="10" stroke="#52b788" strokeWidth="1" strokeDasharray="2 2"/>
  </svg>
);

const DotIcon = ({ color }) => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <circle cx="9" cy="9" r="7" fill={color} opacity="0.2"/>
    <circle cx="9" cy="9" r="4" fill={color} opacity="0.7"/>
    <line x1="9" y1="16" x2="9" y2="11" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="6.5" y1="13.5" x2="9" y2="11" stroke={color} strokeWidth="1" strokeLinecap="round"/>
    <line x1="11.5" y1="13" x2="9" y2="11" stroke={color} strokeWidth="1" strokeLinecap="round"/>
  </svg>
);

export default function Sidebar({ culturaSelecionada, onSelectCultura, onSelectComparacao }) {
  return (
    <aside className="w-[220px] min-h-screen bg-verde-800 flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-verde-700 flex items-center gap-3">
        <LeafSVG />
        <div>
          <div className="text-white font-display font-bold text-lg leading-none">Ory Agro</div>
          <div className="text-verde-400 text-[10px] tracking-[1.5px] uppercase mt-0.5">Guia Hortícola</div>
        </div>
      </div>

      {/* Culturas */}
      <nav className="flex-1 px-2 py-3">
        <div className="text-verde-400 text-[10px] tracking-[1.5px] uppercase font-bold px-2 mb-2">Culturas</div>
        <ul className="space-y-0.5">
          {CULTURAS_LIST.map(c => (
            <li key={c.id}>
              <button
                onClick={() => onSelectCultura(c.id)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-colors text-left',
                  culturaSelecionada === c.id
                    ? 'bg-verde-700 text-white font-bold'
                    : 'text-verde-100 hover:bg-verde-900 hover:text-white font-normal'
                )}
              >
                <DotIcon color={c.cor} />
                {c.nome}
                {c.tipo === 'campo' && (
                  <span className="ml-auto text-[9px] text-verde-400 font-normal">ha</span>
                )}
              </button>
            </li>
          ))}
        </ul>

        <div className="border-t border-verde-700 mt-3 pt-3">
          <div className="text-verde-400 text-[10px] tracking-[1.5px] uppercase font-bold px-2 mb-2">Análise</div>
          <button
            onClick={onSelectComparacao}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-colors text-left',
              culturaSelecionada === '__comparacao__'
                ? 'bg-verde-700 text-white font-bold'
                : 'text-verde-100 hover:bg-verde-900 hover:text-white font-normal'
            )}
          >
            <BarChart3 size={16} className="text-verde-400" />
            Comparar Culturas
          </button>
        </div>
      </nav>

      <div className="px-4 py-3 border-t border-verde-700">
        <div className="text-verde-700 text-[10px] text-center">Ory Agro © 2025</div>
      </div>
    </aside>
  );
}
