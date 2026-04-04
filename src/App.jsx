import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import CulturaPage from './components/CulturaPage';
import ComparacaoCulturas from './components/ComparacaoCulturas';
import { CULTURAS, CULTURAS_LIST } from './data/culturas';
import { BarChart3 } from 'lucide-react';

export default function App() {
  const [selecionado, setSelecionado] = useState('alface');
  const cultura = CULTURAS[selecionado];

  return (
    <div className="flex min-h-screen bg-papel font-sans">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar
          culturaSelecionada={selecionado}
          onSelectCultura={(id) => setSelecionado(id)}
          onSelectComparacao={() => setSelecionado('__comparacao__')}
        />
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto pb-16 md:pb-0">
        {selecionado === '__comparacao__' ? (
          <ComparacaoCulturas />
        ) : cultura ? (
          <CulturaPage cultura={cultura} />
        ) : null}
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-verde-800 border-t border-verde-700 z-50 flex overflow-x-auto">
        {CULTURAS_LIST.map(c => (
          <button
            key={c.id}
            onClick={() => setSelecionado(c.id)}
            className={`flex-1 min-w-[60px] flex flex-col items-center gap-0.5 py-2 text-[9px] font-semibold transition-colors ${
              selecionado === c.id ? 'text-white' : 'text-verde-400'
            }`}
          >
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: c.cor, opacity: selecionado === c.id ? 1 : 0.6 }}
            />
            {c.nome.slice(0, 7)}
          </button>
        ))}
        <button
          onClick={() => setSelecionado('__comparacao__')}
          className={`flex-1 min-w-[60px] flex flex-col items-center gap-0.5 py-2 text-[9px] font-semibold ${
            selecionado === '__comparacao__' ? 'text-white' : 'text-verde-400'
          }`}
        >
          <BarChart3 size={12} />
          Comparar
        </button>
      </nav>
    </div>
  );
}
