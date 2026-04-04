import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Dashboard from './components/Dashboard';
import CulturaPage from './components/CulturaPage';
import SimuladorPage from './components/SimuladorPage';
import ComparacaoCulturas from './components/ComparacaoCulturas';
import { CULTURAS } from './data/culturas';
import { Home, TrendingUp, BarChart2 } from 'lucide-react';

const BOTTOM_NAV = [
  { value: 'dashboard',  label: 'Início',    Icon: Home },
  { value: 'simulador',  label: 'Simulador', Icon: TrendingUp },
  { value: 'comparacao', label: 'Comparar',  Icon: BarChart2 },
];

export default function App() {
  const [mainView, setMainView]   = useState('dashboard'); // 'dashboard' | 'cultura' | 'simulador' | 'comparacao'
  const [culturaId, setCulturaId] = useState(null);

  const handleSelectCultura = (id) => {
    setCulturaId(id);
    setMainView('cultura');
  };

  const handleBack = () => {
    setMainView('dashboard');
    setCulturaId(null);
  };

  const handleNav = (view) => {
    setMainView(view);
    setCulturaId(null);
  };

  const cultura = culturaId ? CULTURAS[culturaId] : null;

  // In cultura view, bottom nav shows culture sections instead
  const isCulturaView = mainView === 'cultura' && cultura;

  return (
    <div className="min-h-screen bg-background">
      <main className="pb-28">
        <AnimatePresence mode="wait">
          <motion.div
            key={mainView === 'cultura' ? `cultura-${culturaId}` : mainView}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {mainView === 'dashboard'  && <Dashboard onSelectCultura={handleSelectCultura} />}
            {mainView === 'cultura'    && cultura && <CulturaPage cultura={cultura} onBack={handleBack} />}
            {mainView === 'simulador'  && <SimuladorPage />}
            {mainView === 'comparacao' && <ComparacaoCulturas />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── Bottom nav ── */}
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
            {BOTTOM_NAV.map(({ value, label, Icon }) => {
              const isActive = mainView === value || (value === 'dashboard' && mainView === 'cultura');
              const activeCor = isCulturaView && value === 'dashboard' ? cultura.cor : 'hsl(160 84% 27%)';

              return (
                <button
                  key={value}
                  onClick={() => handleNav(value)}
                  className="relative flex flex-col items-center justify-center flex-1 h-full gap-0.5 rounded-xl mx-0.5 transition-all duration-200 active:scale-95"
                  style={{ color: isActive ? activeCor : 'hsl(215 16% 40%)' }}
                >
                  {isActive && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-x-1 inset-y-1.5 rounded-xl"
                      style={{ background: `${activeCor}18` }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex flex-col items-center gap-0.5">
                    <Icon size={18} strokeWidth={isActive ? 2.5 : 1.75} className="transition-all duration-200" />
                    <span className="text-[10px] leading-none" style={{ fontWeight: isActive ? 700 : 500 }}>
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
