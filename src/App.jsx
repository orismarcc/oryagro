import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Dashboard from './components/Dashboard';
import CulturaPicker from './components/CulturaPicker';
import CulturaPage from './components/CulturaPage';
import LotePage from './components/LotePage';
import SimuladorPage from './components/SimuladorPage';
import ComparacaoCulturas from './components/ComparacaoCulturas';
import AnalysePage from './components/AnalysePage';
import LoginPage from './components/LoginPage';
import CalendarioPage from './components/CalendarioPage';
import EstoquePage from './components/EstoquePage';
import PropriedadesPage from './components/PropriedadesPage';
import PropriedadePage from './components/PropriedadePage';
import MigrationWizard from './components/MigrationWizard';
import SettingsPage from './components/SettingsPage';
import NetworkStatusBanner from './components/NetworkStatus';
import CalculadoraPage from './components/CalculadoraPage';
import FinanceiroPage from './components/FinanceiroPage';
import CompradoresPage from './components/CompradoresPage';
import HamburgerMenu from './components/HamburgerMenu';
import NotificacoesBell from './components/NotificacoesBell';
import { CULTURAS } from './data/culturas';
import { useAuth } from './hooks/useAuth';
import { loadPropriedades, loadTodosLotes } from './hooks/useSupabaseSync';
import { FarmProvider, useFarm } from './context/FarmContext';
import { can, FARM_ACTIONS } from './lib/permissions';
import { Home, CalendarDays, Building2, BarChart2, Activity, Loader2 } from 'lucide-react';

const ALL_BOTTOM_NAV = [
  { value: 'dashboard',  label: 'Início',     Icon: Home },
  { value: 'calendario', label: 'Calendário', Icon: CalendarDays },
  { value: 'analise',    label: 'Análise',    Icon: Activity,  requiresAction: FARM_ACTIONS.VIEW_ANALYSIS },
  { value: 'comparacao', label: 'Comparar',   Icon: BarChart2 },
];

export default function App() {
  const { session, loading: authLoading, user, displayName, signOut } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 size={28} className="animate-spin" style={{ color: 'hsl(160 84% 27%)' }} />
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  return (
    <FarmProvider session={session}>
      <AppInner session={session} displayName={displayName} signOut={signOut} />
    </FarmProvider>
  );
}

function AppInner({ session, displayName, signOut }) {
  const { getUserRole, isGlobalAdmin } = useFarm();

  // Navigation state
  // mainView: 'dashboard' | 'cultura-picker' | 'cultura' | 'lote' | 'simulador' | 'comparacao' | 'analise' | 'propriedades' | 'propriedade' | 'estoque' | 'financeiro' | 'compradores' | 'calculadora' | 'configuracoes'
  const [mainView, setMainView]             = useState('dashboard');
  const [culturaId, setCulturaId]           = useState(null);
  const [autoOpenLoteForm, setAutoOpenLoteForm] = useState(false);
  const [selectedLote, setSelectedLote]     = useState(null);
  const [selectedPropriedade, setSelectedPropriedade] = useState(null);
  const [showMigrationWizard, setShowMigrationWizard] = useState(false);
  const [propriedades, setPropriedades] = useState([]);
  const [allLotes, setAllLotes] = useState([]);
  // Track where lote/picker was opened from so back goes to the right place
  const [loteOpenedFrom, setLoteOpenedFrom] = useState('dashboard');
  const [pickerOpenedFrom, setPickerOpenedFrom] = useState('dashboard');

  // Check on mount if migration is needed; also load propriedades for AnalysePage
  useEffect(() => {
    if (!session) return;
    Promise.all([loadPropriedades(), loadTodosLotes(100)]).then(([props, ls]) => {
      setPropriedades(props);
      setAllLotes(ls);
      if (props.length === 0 && ls.length > 0) setShowMigrationWizard(true);
    });
  }, [session]);

  // ── Navigation handlers ──

  // From Dashboard: user clicks "+ Novo Lote"
  const handleAddLote = () => {
    setPickerOpenedFrom('dashboard');
    setMainView('cultura-picker');
  };

  // From Dashboard: user clicks an existing lot card → dedicated LotePage
  // I-06: also resolve selectedPropriedade so getUserRole() returns the correct role
  const handleSelectLote = (lote) => {
    setSelectedLote(lote);
    setLoteOpenedFrom('dashboard');
    if (lote.propriedade_id) {
      const prop = propriedades.find(p => p.id === lote.propriedade_id) ?? null;
      setSelectedPropriedade(prop);
    }
    setMainView('lote');
  };

  // Back from LotePage → context-aware (propriedade or dashboard)
  const handleBackFromLote = () => {
    setSelectedLote(null);
    if (loteOpenedFrom === 'propriedade') {
      setMainView('propriedade');
    } else {
      setMainView('dashboard');
    }
  };

  // From CulturaPicker: user selects a culture → go to CulturaPage with form open
  const handlePickCultura = (id) => {
    setCulturaId(id);
    setAutoOpenLoteForm(true);
    setMainView('cultura');
  };

  // Back from CulturaPage → context-aware (propriedade or dashboard)
  const handleBack = () => {
    setCulturaId(null);
    setAutoOpenLoteForm(false);
    if (pickerOpenedFrom === 'propriedade') {
      setMainView('propriedade');
    } else {
      setMainView('dashboard');
    }
  };

  // Back from CulturaPicker → context-aware (propriedade or dashboard)
  const handleBackFromPicker = () => {
    if (pickerOpenedFrom === 'propriedade') {
      setMainView('propriedade');
    } else {
      setMainView('dashboard');
    }
  };

  // Bottom nav
  const handleNav = (view) => {
    setMainView(view);
    setCulturaId(null);
    setAutoOpenLoteForm(false);
  };

  const handleSelectPropriedade = (propriedade) => {
    setSelectedPropriedade(propriedade);
    setMainView('propriedade');
  };

  const handleManagePropriedades = () => {
    setMainView('propriedades');
  };

  const handleSelectPropriedadeFromList = (propriedade) => {
    setSelectedPropriedade(propriedade);
    setMainView('propriedade');
  };

  const handleBackFromPropriedades = () => {
    setMainView('dashboard');
  };

  const handleBackFromPropriedade = () => {
    setSelectedPropriedade(null);
    setMainView('propriedades');
  };

  const handleGoEstoque = () => {
    setMainView('estoque');
  };

  const handleBackFromEstoque = () => {
    // Go back to the property that opened estoque, or dashboard
    if (selectedPropriedade) setMainView('propriedade');
    else setMainView('dashboard');
  };

  const handleGoSettings = () => setMainView('configuracoes');
  const handleBackFromSettings = () => setMainView('dashboard');

  const handleGoCalculadora = () => setMainView('calculadora');
  const handleBackFromCalculadora = () => setMainView('dashboard');

  const handleGoFinanceiro = () => setMainView('financeiro');
  const handleBackFromFinanceiro = () => setMainView('dashboard');

  const handleGoCompradores = () => setMainView('compradores');
  const handleBackFromCompradores = () => setMainView('dashboard');

  const handleAddLoteFromPropriedade = () => {
    setPickerOpenedFrom('propriedade');
    setMainView('cultura-picker');
  };

  const handleSelectLoteFromPropriedade = (lote) => {
    setSelectedLote(lote);
    setLoteOpenedFrom('propriedade');
    setMainView('lote');
  };

  const cultura = culturaId ? CULTURAS[culturaId] : null;
  const isInCultura = (mainView === 'cultura' && cultura) || (mainView === 'lote' && selectedLote);
  const activeCultura = mainView === 'lote' && selectedLote ? CULTURAS[selectedLote.cultura_id] : cultura;

  // Role for the currently selected farm
  const userRole = getUserRole(selectedPropriedade?.id);
  // Bottom nav: hide items that require a permission the user doesn't have.
  // VIEW_ANALYSIS also requires isGlobalAdmin (pure technicians never see it).
  const BOTTOM_NAV = ALL_BOTTOM_NAV.filter(item => {
    if (!item.requiresAction) return true;
    if (item.requiresAction === FARM_ACTIONS.VIEW_ANALYSIS && !isGlobalAdmin) return false;
    if (!selectedPropriedade) return true;
    return can(userRole, item.requiresAction);
  });

  // Views where the hamburguer menu should not appear (internal detail screens)
  const HIDE_HAMBURGER = ['lote', 'cultura', 'cultura-picker'];
  const showHamburger = !HIDE_HAMBURGER.includes(mainView);

  // Handler for hamburger navigation
  // Guard admin-only pages: pure technicians cannot access analise, financeiro, compradores
  const ADMIN_ONLY_VIEWS = ['analise', 'financeiro', 'compradores'];
  const handleHamburgerNav = (view) => {
    if (ADMIN_ONLY_VIEWS.includes(view) && !isGlobalAdmin) return;
    setMainView(view);
    setCulturaId(null);
    setAutoOpenLoteForm(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <NetworkStatusBanner />

      {/* ── Hamburger menu (fixed overlay, all main views) ── */}
      {showHamburger && (
        <HamburgerMenu
          currentView={mainView}
          onNavigate={handleHamburgerNav}
          hasPropriedade={!!selectedPropriedade}
          isGlobalAdmin={isGlobalAdmin}
        />
      )}

      {/* ── Notification bell (fixed, all main views) ── */}
      {showHamburger && (
        <NotificacoesBell
          lotes={allLotes.filter(l => l.status === 'ativo')}
          propriedades={propriedades}
          onNavigateToLote={(loteId, propriedadeId) => {
            const lote = allLotes.find(l => l.id === loteId);
            if (lote) {
              setSelectedLote(lote);
              setLoteOpenedFrom('dashboard');
              if (propriedadeId) {
                const prop = propriedades.find(p => p.id === propriedadeId) ?? null;
                setSelectedPropriedade(prop);
              }
              setMainView('lote');
            }
          }}
          onNavigateToCompradores={handleGoCompradores}
        />
      )}
      <main className="pb-36">
        <AnimatePresence mode="wait">
          <motion.div
            key={
              mainView === 'cultura'        ? `cultura-${culturaId}` :
              mainView === 'lote'           ? `lote-${selectedLote?.id}` :
              mainView === 'cultura-picker' ? 'cultura-picker' :
              mainView === 'propriedade'    ? `propriedade-${selectedPropriedade?.id}` :
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
                onSelectPropriedade={handleSelectPropriedade}
                onManagePropriedades={handleManagePropriedades}
                onSignOut={signOut}
                onGoSettings={handleGoSettings}
                userName={displayName}
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
                propriedadeId={selectedPropriedade?.id ?? null}
              />
            )}
            {mainView === 'lote' && selectedLote && CULTURAS[selectedLote.cultura_id] && (
              <LotePage
                lote={selectedLote}
                cultura={CULTURAS[selectedLote.cultura_id]}
                onBack={handleBackFromLote}
                userRole={userRole}
              />
            )}
            {mainView === 'simulador'  && <SimuladorPage />}
            {mainView === 'analise'    && <AnalysePage onSignOut={signOut} userName={displayName} propriedades={propriedades} userRole={userRole} />}
            {mainView === 'comparacao' && <ComparacaoCulturas />}
            {mainView === 'calendario' && <CalendarioPage />}
            {mainView === 'configuracoes' && (
              <SettingsPage onBack={handleBackFromSettings} />
            )}
            {mainView === 'calculadora' && (
              <CalculadoraPage onBack={handleBackFromCalculadora} />
            )}
            {mainView === 'financeiro' && (
              <FinanceiroPage onBack={handleBackFromFinanceiro} propriedades={propriedades} />
            )}
            {mainView === 'compradores' && (
              <CompradoresPage onBack={handleBackFromCompradores} />
            )}
            {mainView === 'estoque' && (
              <EstoquePage propriedadeId={selectedPropriedade?.id ?? null} onBack={handleBackFromEstoque} />
            )}
            {mainView === 'propriedades' && (
              <PropriedadesPage
                onBack={handleBackFromPropriedades}
                onSelectPropriedade={handleSelectPropriedadeFromList}
              />
            )}
            {mainView === 'propriedade' && selectedPropriedade && (
              <PropriedadePage
                propriedade={selectedPropriedade}
                userRole={userRole}
                onBack={handleBackFromPropriedade}
                onSelectLote={handleSelectLoteFromPropriedade}
                onGoEstoque={handleGoEstoque}
                onAddLote={handleAddLoteFromPropriedade}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── Bottom nav ── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50"
        style={{
          paddingBottom: 'max(env(safe-area-inset-bottom), 8px)',
          willChange: 'transform',
          transform: 'translateZ(0)',
          WebkitTransform: 'translateZ(0)',
        }}
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
                (mainView === 'dashboard' || mainView === 'cultura' || mainView === 'cultura-picker' || mainView === 'lote');
              const isActive = mainView === value || dashboardActive;
              const activeCor = isInCultura && value === 'dashboard' && activeCultura ? activeCultura.cor : 'hsl(160 84% 27%)';

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

      {showMigrationWizard && (
        <MigrationWizard
          onComplete={(prop) => {
            setShowMigrationWizard(false);
            setSelectedPropriedade(prop);
          }}
        />
      )}
    </div>
  );
}
