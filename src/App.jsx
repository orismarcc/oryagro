import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Dashboard from './components/Dashboard';
import CulturaPicker from './components/CulturaPicker';
import CulturaPage from './components/CulturaPage';
import LotePage from './components/LotePage';
import LoginPage from './components/LoginPage';
import PropriedadesPage from './components/PropriedadesPage';
import PropriedadePage from './components/PropriedadePage';
import TalhaoPage from './components/TalhaoPage';
import MigrationWizard from './components/MigrationWizard';
import SettingsPage from './components/SettingsPage';
import NetworkStatusBanner from './components/NetworkStatus';
import HamburgerMenu from './components/HamburgerMenu';

// ── Páginas pesadas: carregadas sob demanda (code-splitting) ──────────────────
// Reduz o bundle inicial — recharts/jspdf e estas telas só baixam quando abertas.
const SimuladorPage     = lazy(() => import('./components/SimuladorPage'));
const ComparacaoCulturas = lazy(() => import('./components/ComparacaoCulturas'));
const AnalysePage       = lazy(() => import('./components/AnalysePage'));
const CalendarioPage    = lazy(() => import('./components/CalendarioPage'));
const EstoquePage       = lazy(() => import('./components/EstoquePage'));
const CalculadoraPage   = lazy(() => import('./components/CalculadoraPage'));
const FinanceiroPage    = lazy(() => import('./components/FinanceiroPage'));
const CompradoresPage   = lazy(() => import('./components/CompradoresPage'));
import NotificacoesBell from './components/NotificacoesBell';
import InstallPWA from './components/InstallPWA';
import { CULTURAS } from './data/culturas';
import { useAuth } from './hooks/useAuth';
import { loadPropriedades, loadTodosLotes } from './hooks/useSupabaseSync';
import { FarmProvider, useFarm } from './context/FarmContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { can, FARM_ACTIONS } from './lib/permissions';
import { Home, CalendarDays, Building2, Wallet, Activity, Loader2 } from 'lucide-react';

const ALL_BOTTOM_NAV = [
  { value: 'dashboard',    label: 'Início',       Icon: Home },
  { value: 'propriedades', label: 'Propriedades', Icon: Building2 },
  { value: 'financeiro',   label: 'Financeiro',   Icon: Wallet },
  { value: 'analise',      label: 'Análise',      Icon: Activity, requiresAction: FARM_ACTIONS.VIEW_ANALYSIS },
  { value: 'calendario',   label: 'Calendário',   Icon: CalendarDays },
];

export default function App() {
  const { session, loading: authLoading, user, displayName, signOut } = useAuth();

  if (authLoading) {
    return (
      <ToastProvider>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 size={28} className="animate-spin" style={{ color: 'hsl(160 84% 27%)' }} />
        </div>
      </ToastProvider>
    );
  }

  if (!session) {
    return (
      <ToastProvider>
        <LoginPage />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <FarmProvider session={session}>
        <AppInner session={session} displayName={displayName} signOut={signOut} />
      </FarmProvider>
    </ToastProvider>
  );
}

function AppInner({ session, displayName, signOut }) {
  const { getUserRole, isGlobalAdmin } = useFarm();
  const toast = useToast();

  // BUG-11: detecta expiração de sessão durante o uso e avisa o usuário
  const prevSessionRef = useRef(session);
  useEffect(() => {
    // Se havia sessão antes e agora não há — sessão expirou em uso
    if (prevSessionRef.current && !session) {
      toast.warning('Sua sessão expirou. Faça login novamente.');
    }
    prevSessionRef.current = session;
  }, [session]);

  // BUG-19: Sincronização entre abas — detecta mudanças no localStorage feitas por outra aba
  // e notifica o usuário para recarregar. Não faz reload automático para não interromper o usuário.
  useEffect(() => {
    // Prefixos de chaves que indicam dados do app alterados em outra aba
    const DATA_PREFIXES = [
      'cronograma_status', 'cronograma_custom',
      'lote_mudas', 'lote_precos',
      'propriedades_', 'estoque_',
    ];
    let lastNotified = 0;

    const onStorage = (e) => {
      if (!e.key) return;
      const isAppKey = DATA_PREFIXES.some(p => e.key.startsWith(p));
      if (!isAppKey) return;
      // Limita a uma notificação por 30 s para não spammar
      const now = Date.now();
      if (now - lastNotified < 30_000) return;
      lastNotified = now;
      toast.info('Dados atualizados em outra aba — recarregue a página para sincronizar.');
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [toast]);

  // BUG-18: Teclado virtual Android cobre inputs — rola o elemento focado para dentro da área visível
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return; // não disponível em navegadores antigos

    const onResize = () => {
      const focused = document.activeElement;
      if (!focused) return;
      const tag = focused.tagName;
      if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') return;
      // Aguarda o layout estabilizar antes de rolar
      setTimeout(() => {
        focused.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    };

    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  // Ref para o contêiner de scroll principal — reseta scrollTop diretamente,
  // método mais confiável no WebView do Android vs. window.scrollTo.
  const mainRef = useRef(null);

  // Navigation state
  // mainView: 'dashboard' | 'cultura-picker' | 'cultura' | 'lote' | 'simulador' | 'comparacao' | 'analise' | 'propriedades' | 'propriedade' | 'estoque' | 'financeiro' | 'compradores' | 'calculadora' | 'configuracoes'
  const [mainView, setMainView]             = useState('dashboard');
  const [culturaId, setCulturaId]           = useState(null);
  const [autoOpenLoteForm, setAutoOpenLoteForm] = useState(false);
  const [selectedLote, setSelectedLote]     = useState(null);
  const [selectedPropriedade, setSelectedPropriedade] = useState(null);
  const [selectedTalhao, setSelectedTalhao] = useState(null);
  const [showMigrationWizard, setShowMigrationWizard] = useState(false);
  const [propriedades, setPropriedades] = useState([]);
  const [allLotes, setAllLotes] = useState([]);
  // Ref to trigger a full reload of propriedades+lotes from child pages after CRUD
  const refreshPropriedadesRef = useRef(null);
  // Track where lote/picker was opened from so back goes to the right place
  const [loteOpenedFrom, setLoteOpenedFrom] = useState('dashboard');
  const [pickerOpenedFrom, setPickerOpenedFrom] = useState('dashboard');

  // Reseta scroll ao trocar de tela.
  // Usa mainRef.current.scrollTop (elemento DOM real) + requestAnimationFrame
  // para garantir que o reset acontece APÓS a renderização do novo conteúdo,
  // evitando que a animação do AnimatePresence atrapalhe a posição.
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    el.scrollTop = 0;
    // rAF garante reset após o primeiro frame pintado com o novo conteúdo
    const id = requestAnimationFrame(() => { if (el) el.scrollTop = 0; });
    return () => cancelAnimationFrame(id);
  }, [mainView, selectedLote?.id, selectedPropriedade?.id]);

  // Check on mount if migration is needed; also load propriedades for AnalysePage
  useEffect(() => {
    if (!session) return;
    const refresh = () =>
      Promise.all([loadPropriedades(), loadTodosLotes()]).then(([props, ls]) => {
        setPropriedades(props);
        setAllLotes(ls);
        if (props.length === 0 && ls.length > 0) setShowMigrationWizard(true);
      });
    refresh();
    // Expose refresh so child pages can trigger a reload after CRUD
    refreshPropriedadesRef.current = refresh;
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

  // Back from LotePage → context-aware (talhao, propriedade or dashboard)
  const handleBackFromLote = () => {
    setSelectedLote(null);
    if (loteOpenedFrom === 'talhao') {
      setMainView('talhao');
    } else if (loteOpenedFrom === 'propriedade') {
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
    // Tapping Propriedades on the nav always goes to the list, not a stale detail
    if (view === 'propriedades') setSelectedPropriedade(null);
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

  const handleSelectTalhao = (talhao) => {
    setSelectedTalhao(talhao);
    setMainView('talhao');
  };

  const handleBackFromTalhao = () => {
    setSelectedTalhao(null);
    setMainView('propriedade');
  };

  const handleSelectLoteFromTalhao = (lote) => {
    setSelectedLote(lote);
    if (lote.propriedade_id) {
      const prop = propriedades.find(p => p.id === lote.propriedade_id) ?? null;
      setSelectedPropriedade(prop);
    }
    setLoteOpenedFrom('talhao');
    setMainView('lote');
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
    <div className="bg-background" style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <NetworkStatusBanner />
      <InstallPWA />

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
      <main
        ref={mainRef}
        className="pb-36"
        style={{
          flex: '1 1 0%',
          minHeight: 0,              /* necessário para overflow funcionar em flex */
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'none', /* impede scroll além do fim da lista */
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={
              mainView === 'cultura'        ? `cultura-${culturaId}` :
              mainView === 'lote'           ? `lote-${selectedLote?.id}` :
              mainView === 'cultura-picker' ? 'cultura-picker' :
              mainView === 'propriedade'    ? `propriedade-${selectedPropriedade?.id}` :
              mainView === 'talhao'         ? `talhao-${selectedTalhao?.id}` :
              mainView
            }
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <Suspense fallback={
              <div className="flex items-center justify-center py-24">
                <Loader2 size={28} className="animate-spin" style={{ color: 'hsl(160 84% 27%)' }} />
              </div>
            }>
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
                propriedade={selectedPropriedade}
                onRepetido={handleSelectLote}
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
                onRefreshNeeded={() => refreshPropriedadesRef.current?.()}
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
                onSelectTalhao={handleSelectTalhao}
              />
            )}
            {mainView === 'talhao' && selectedTalhao && (
              <TalhaoPage
                talhao={selectedTalhao}
                onBack={handleBackFromTalhao}
                onSelectLote={handleSelectLoteFromTalhao}
              />
            )}
            </Suspense>
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
              const propriedadesActive = value === 'propriedades' &&
                (mainView === 'propriedades' || mainView === 'propriedade' || mainView === 'estoque');
              const isActive = mainView === value || dashboardActive || propriedadesActive;
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
