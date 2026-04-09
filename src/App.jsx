import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Dashboard from './components/Dashboard';
import CulturaPicker from './components/CulturaPicker';
import CulturaPage from './components/CulturaPage';
import SimuladorPage from './components/SimuladorPage';
import ComparacaoCulturas from './components/ComparacaoCulturas';
import LoginPage from './components/LoginPage';
import { CULTURAS } from './data/culturas';
import { useAuth } from './hooks/useAuth';
import { Home, TrendingUp, BarChart2, Loader2 } from 'lucide-react';

const BOTTOM_NAV = [
  { value: 'dashboard',  label: 'Início',    Icon: Home },
  { value: 'simulador',  label: 'Simulador', Icon: TrendingUp },
  { value: 'comparacao', label: 'Comparar',  Icon: BarChart2 },
];

export default function App() {
  const { session, loading: authLoading, user, signOut } = useAuth();

  // Navigation state
  // mainView: 'dashboard' | 'cultura-picker' | 'cultura' | 'simulador' | 'comparacao'
  const [mainView, setMainView]             = useState('dashboard');
  const [culturaId, setCulturaId]           = useState(null);
  const [autoOpenLoteForm, setAutoOpenLoteForm] = useState(false);

  // ── Navigation handlers ──

  // From Dashboard: user clicks "+ Novo Lote"
  const handleAddLote = () => {
    setMainView('cultura-picker');
  };

  // From Dashboard: user clicks an existing lot card
  const handleSelectLote = (lote) => {
    setCulturaId(lote.cultura_id);
    setAutoOpenLoteForm(false);
    setMainView('cultura');
  };

  // From CulturaPicker: user selects a culture → go to CulturaPage with form open
  const handlePickCultura = (id) => {
    setCulturaId(id);
    setAutoOpenLoteForm(true);
    setMainView('cultura');
  };

  // Back from CulturaPage → dashboard
  const handleBack = () => {
    setMainView('dashboard');
    setCulturaId(null);
    setAutoOpenLoteForm(false);
  };

  // Back from CulturaPicker → dashboard
  const handleBackFromPicker = () => {
    setMainView('dashboard');
  };

  // Bottom nav
  const handleNav = (view) => {
    setMainView(view);
    setCulturaId(null);
    setAutoOpenLoteForm(false);
  };

  const cultura = culturaId ? CULTURAS[culturaId] : null;
  const isInCultura = mainView === 'cultura' && cultura;

  // ── Auth loading ──
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 size={28} className="animate-spin" style={{ color: 'hsl(160 84% 27%)' }} />
      </div>
    );
  }

  // ── Auth gate ──
  if (!session) {
    return <LoginPage />;
  }

  // ── App ──
  return (
    <div className="min-h-screen bg-background">
      <main className="pb-28">
        <AnimatePresence mode="wait">
          <motion.div
            key={
              mainView === 'cultura'        ? `cultura-${culturaId}` :
              mainView === 'cultura-picker' ? 'cultura-picker' :
              mainView
            }
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {mainView === 'dashboard' && (
              <Dashboard
                onAddLote={handleAddLote}
                onSelectLote={handleSelectLote}
                onSignOut={signOut}
                userName={user?.email}
              />
            )}
            {mainView === 'cultura-picker' && (
              <CulturaPicker
                onSelectCultura={handlePickCultura}
                onBack={handleBackFromPicker}
              />
            )}
            {mainView === 'cultura' && cultura && (
              <CulturaPage
                cultura={cultura}
                onBack={handleBack}
                autoOpenLoteForm={autoOpenLoteForm}
              />
            )}
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
              const dashboardActive = value === 'dashboard' &&
                (mainView === 'dashboard' || mainView === 'cultura' || mainView === 'cultura-picker');
              const isActive = mainView === value || dashboardActive;
              const activeCor = isInCultura && value === 'dashboard' ? cultura.cor : 'hsl(160 84% 27%)';

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
