import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import CulturaPage from './components/CulturaPage';
import ComparacaoCulturas from './components/ComparacaoCulturas';
import { CULTURAS, CULTURAS_LIST } from './data/culturas';
import { Eye, FlaskConical, CalendarDays, TrendingUp, BarChart2 } from 'lucide-react';

const SECTIONS = [
  { value: 'visao',      label: 'Visão',      Icon: Eye },
  { value: 'manejo',     label: 'Manejo',     Icon: FlaskConical },
  { value: 'cronograma', label: 'Cronograma', Icon: CalendarDays },
  { value: 'simulador',  label: 'Simulador',  Icon: TrendingUp },
  { value: 'comparacao', label: 'Comparar',   Icon: BarChart2 },
];

export default function App() {
  const [culturaSel, setCulturaSel] = useState('alface');
  const [section, setSection]       = useState('visao');
  const cultura = CULTURAS[culturaSel];

  const handleSection = (val) => {
    setSection(val);
    if (val !== 'comparacao' && culturaSel === '__comparacao__') setCulturaSel('alface');
  };

  const isComparacao = section === 'comparacao';

  return (
    <div className="min-h-screen bg-background">

      {/* ── Culture selector ─────────────────────────────── */}
      <div
        className="sticky top-0 z-30"
        style={{
          background: 'hsl(160 84% 10%)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="flex items-center gap-1 px-3 py-2 overflow-x-auto no-scrollbar">
          {CULTURAS_LIST.map(c => {
            const isActive = culturaSel === c.id && !isComparacao;
            return (
              <button
                key={c.id}
                onClick={() => { setCulturaSel(c.id); if (section === 'comparacao') setSection('visao'); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all duration-200 flex-shrink-0 whitespace-nowrap"
                style={{
                  background: isActive ? `${c.cor}25` : 'rgba(255,255,255,0.06)',
                  color: isActive ? c.cor : 'rgba(255,255,255,0.45)',
                  border: isActive ? `1px solid ${c.cor}50` : '1px solid transparent',
                }}
              >
                <span>{c.emoji}</span>
                <span>{c.nome}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────── */}
      <main className="pb-28">
        <AnimatePresence mode="wait">
          <motion.div
            key={isComparacao ? '__cmp__' : culturaSel}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {isComparacao ? (
              <ComparacaoCulturas />
            ) : cultura ? (
              <CulturaPage cultura={cultura} section={section} />
            ) : null}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── Bottom section nav (GranjaTop style) ─────────── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}
      >
        <div
          className="mx-3 mb-1 rounded-2xl overflow-hidden border"
          style={{
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderColor: 'hsl(214 20% 88%)',
            boxShadow: '0 10px 24px -4px rgb(0 0 0 / 0.11), 0 4px 8px -4px rgb(0 0 0 / 0.07)',
          }}
        >
          <div className="flex items-center h-[60px] px-1">
            {SECTIONS.map(({ value, label, Icon }) => {
              const isActive = section === value;
              const activeCor = !isComparacao && cultura ? cultura.cor : 'hsl(160 84% 27%)';

              return (
                <button
                  key={value}
                  onClick={() => handleSection(value)}
                  className="relative flex flex-col items-center justify-center flex-1 h-full gap-0.5 rounded-xl mx-0.5 transition-all duration-200 active:scale-95"
                  style={{ color: isActive ? activeCor : 'hsl(215 16% 40%)' }}
                >
                  {isActive && (
                    <motion.span
                      layoutId="section-pill"
                      className="absolute inset-x-1 inset-y-1.5 rounded-xl"
                      style={{ background: `${activeCor}18` }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex flex-col items-center gap-0.5">
                    <Icon
                      className="transition-all duration-200"
                      size={18}
                      strokeWidth={isActive ? 2.5 : 1.75}
                    />
                    <span
                      className="text-[10px] leading-none transition-all duration-200"
                      style={{ fontWeight: isActive ? 700 : 500 }}
                    >
                      {label}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}
