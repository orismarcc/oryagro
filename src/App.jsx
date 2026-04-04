import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import CulturaPage from './components/CulturaPage';
import ComparacaoCulturas from './components/ComparacaoCulturas';
import { CULTURAS, CULTURAS_LIST } from './data/culturas';
import { BarChart2 } from 'lucide-react';

const EMOJIS = {
  alface: '🥬', cebolinha: '🧅', coentro: '🌿',
  quiabo: '🫛', mandioca: '🍠', abacaxi: '🍍',
};

export default function App() {
  const [selecionado, setSelecionado] = useState('alface');
  const cultura = CULTURAS[selecionado];

  return (
    <div className="flex min-h-screen" style={{ background: '#f2efe8' }}>

      {/* ── Desktop sidebar ── */}
      <div className="hidden md:flex flex-shrink-0 sticky top-0 h-screen">
        <Sidebar
          culturaSelecionada={selecionado}
          onSelectCultura={(id) => setSelecionado(id)}
          onSelectComparacao={() => setSelecionado('__comparacao__')}
        />
      </div>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-auto pb-20 md:pb-0 min-w-0">
        <div key={selecionado} className="anim-fade-in min-h-screen">
          {selecionado === '__comparacao__' ? (
            <ComparacaoCulturas />
          ) : cultura ? (
            <div className="bg-white min-h-screen shadow-sm shadow-black/[0.04] md:rounded-none">
              <CulturaPage cultura={cultura} />
            </div>
          ) : null}
        </div>
      </main>

      {/* ── Mobile bottom nav ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 flex overflow-x-auto"
        style={{ background: '#07120a' }}>
        {CULTURAS_LIST.map(c => {
          const isActive = selecionado === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setSelecionado(c.id)}
              className="flex-1 min-w-[52px] flex flex-col items-center gap-0.5 py-2.5 transition-colors"
            >
              <span className="text-base leading-none">{c.emoji || EMOJIS[c.id] || '🌱'}</span>
              <span
                className="text-[8px] font-semibold tracking-wide transition-colors"
                style={{ color: isActive ? c.cor : '#ffffff30' }}
              >
                {c.nome.slice(0, 6)}
              </span>
              {isActive && (
                <div className="w-4 h-0.5 rounded-full mt-0.5" style={{ background: c.cor }} />
              )}
            </button>
          );
        })}
        <button
          onClick={() => setSelecionado('__comparacao__')}
          className="flex-1 min-w-[52px] flex flex-col items-center gap-0.5 py-2.5 transition-colors"
        >
          <BarChart2 size={14} color={selecionado === '__comparacao__' ? '#52b788' : '#ffffff30'} />
          <span
            className="text-[8px] font-semibold"
            style={{ color: selecionado === '__comparacao__' ? '#52b788' : '#ffffff30' }}
          >
            Comparar
          </span>
        </button>
      </nav>
    </div>
  );
}
