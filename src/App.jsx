import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './components/Sidebar';
import CulturaPage from './components/CulturaPage';
import ComparacaoCulturas from './components/ComparacaoCulturas';
import { CULTURAS, CULTURAS_LIST } from './data/culturas';
import { BarChart2 } from 'lucide-react';

export default function App() {
  const [selecionado, setSelecionado] = useState('alface');
  const cultura = CULTURAS[selecionado];

  return (
    <div className="flex min-h-screen" style={{ background: '#f4f6f8' }}>

      {/* Sidebar */}
      <div className="hidden md:flex flex-shrink-0 sticky top-0 h-screen overflow-y-auto">
        <Sidebar
          culturaSelecionada={selecionado}
          onSelectCultura={setSelecionado}
          onSelectComparacao={() => setSelecionado('__comparacao__')}
        />
      </div>

      {/* Main */}
      <main className="flex-1 min-w-0 overflow-auto pb-20 md:pb-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={selecionado}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="min-h-screen"
          >
            {selecionado === '__comparacao__' ? (
              <ComparacaoCulturas />
            ) : cultura ? (
              <div className="bg-white min-h-screen" style={{ boxShadow: '2px 0 0 0 rgba(0,0,0,0.04)' }}>
                <CulturaPage cultura={cultura} />
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex overflow-x-auto"
        style={{
          background: 'rgba(9,19,11,0.95)',
          backdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        {CULTURAS_LIST.map(c => {
          const isActive = selecionado === c.id;
          return (
            <motion.button
              key={c.id}
              onClick={() => setSelecionado(c.id)}
              whileTap={{ scale: 0.88 }}
              className="flex-1 min-w-[52px] flex flex-col items-center gap-0.5 py-3"
            >
              <span className="text-[17px] leading-none">{c.emoji || '🌱'}</span>
              <span
                className="text-[8px] font-semibold tracking-wide transition-colors"
                style={{ color: isActive ? c.cor : 'rgba(255,255,255,0.25)' }}
              >
                {c.nome.slice(0, 5)}
              </span>
              {isActive && (
                <motion.div
                  layoutId="mobile-indicator"
                  className="w-4 h-0.5 rounded-full"
                  style={{ background: c.cor }}
                />
              )}
            </motion.button>
          );
        })}
        <motion.button
          onClick={() => setSelecionado('__comparacao__')}
          whileTap={{ scale: 0.88 }}
          className="flex-1 min-w-[52px] flex flex-col items-center gap-0.5 py-3"
        >
          <BarChart2
            size={17}
            style={{ color: selecionado === '__comparacao__' ? '#34d399' : 'rgba(255,255,255,0.25)' }}
          />
          <span
            className="text-[8px] font-semibold"
            style={{ color: selecionado === '__comparacao__' ? '#34d399' : 'rgba(255,255,255,0.25)' }}
          >
            Comparar
          </span>
        </motion.button>
      </nav>
    </div>
  );
}
