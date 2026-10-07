import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
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
import MaisPage from './components/MaisPage';

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
import InstallPWA from './components/InstallPWA';
import { CULTURAS } from './data/culturas';
import { useAuth } from './hooks/useAuth';
import { loadPropriedades, loadTodosLotes } from './hooks/useSupabaseSync';
import { FarmProvider, useFarm } from './context/FarmContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { AnotarProvider, useAnotar } from './context/AnotarContext';
import { Home, CalendarDays, Package2, LayoutGrid, Plus, ArrowLeft, Loader2 } from 'lucide-react';

const BRAND = 'hsl(156 64% 31%)';

export default function App() {
  const { session, loading: authLoading, displayName, signOut } = useAuth();

  if (authLoading) {
    return (
      <ToastProvider>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 size={28} className="animate-spin" style={{ color: 'hsl(156 64% 31%)' }} />
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

  // ── Navegação ──────────────────────────────────────────────────────────────
  // Barra inferior: Início · Agenda · [Anotar] · Estoque · Mais.
  // mainView: 'dashboard' | 'calendario' | 'estoque' | 'mais' | 'lote' | 'cultura-picker' | 'cultura'
  //         | 'propriedades' | 'propriedade' | 'talhao' | 'financeiro' | 'compradores' | 'analise'
  //         | 'simulador' | 'comparacao' | 'calculadora' | 'configuracoes'
  const [mainView, setMainView]             = useState('dashboard');
  const [culturaId, setCulturaId]           = useState(null);
  const [culturaTab, setCulturaTab]         = useState('lotes');
  const [autoOpenLoteForm, setAutoOpenLoteForm] = useState(false);
  const [selectedLote, setSelectedLote]     = useState(null);
  const [selectedPropriedade, setSelectedPropriedade] = useState(null);
  const [selectedTalhao, setSelectedTalhao] = useState(null);
  const [showMigrationWizard, setShowMigrationWizard] = useState(false);
  const [propriedades, setPropriedades] = useState([]);
  const [allLotes, setAllLotes] = useState([]);
  const refreshPropriedadesRef = useRef(null);
  // De onde cada tela de detalhe foi aberta — o "voltar" retorna para lá.
  const [loteOpenedFrom, setLoteOpenedFrom]       = useState('dashboard');
  const [pickerOpenedFrom, setPickerOpenedFrom]   = useState('dashboard');
  const [culturaOpenedFrom, setCulturaOpenedFrom] = useState('dashboard');
  const [estoqueOpenedFrom, setEstoqueOpenedFrom] = useState(null);

  // Reseta scroll ao trocar de tela (scrollTop no contêiner real + rAF pós-render).
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    el.scrollTop = 0;
    const id = requestAnimationFrame(() => { if (el) el.scrollTop = 0; });
    return () => cancelAnimationFrame(id);
  }, [mainView, selectedLote?.id, selectedPropriedade?.id]);

  // Propriedades + lotes (usados pelo Anotar, Análise e navegação)
  const refreshDados = useCallback(() =>
    Promise.all([loadPropriedades(), loadTodosLotes()]).then(([props, ls]) => {
      setPropriedades(props);
      setAllLotes(ls);
      if (props.length === 0 && ls.length > 0) setShowMigrationWizard(true);
    }), []);
  useEffect(() => {
    if (!session) return;
    refreshDados();
    refreshPropriedadesRef.current = refreshDados;
  }, [session, refreshDados]);

  // Propriedade "padrão" para o Estoque quando não há uma aberta: se só existe uma, é ela.
  const propriedadePadrao = selectedPropriedade ?? (propriedades.length === 1 ? propriedades[0] : null);

  const irPara = (view) => {
    setMainView(view);
    setCulturaId(null);
    setAutoOpenLoteForm(false);
  };

  // ── Lote ──
  const abrirLote = (lote, origem = 'dashboard') => {
    setSelectedLote(lote);
    setLoteOpenedFrom(origem);
    if (lote.propriedade_id) {
      const prop = propriedades.find(p => p.id === lote.propriedade_id) ?? null;
      if (prop) setSelectedPropriedade(prop);
    }
    setMainView('lote');
  };
  const handleBackFromLote = () => {
    setSelectedLote(null);
    setMainView(['talhao', 'propriedade'].includes(loteOpenedFrom) ? loteOpenedFrom : 'dashboard');
    refreshDados();
  };

  // ── Novo lote (escolher cultura → formulário) ──
  const handleAddLote = (origem = 'dashboard') => {
    setPickerOpenedFrom(origem);
    setMainView('cultura-picker');
  };
  const handlePickCultura = (id) => {
    setCulturaId(id);
    setCulturaTab('lotes');
    setAutoOpenLoteForm(true);
    setCulturaOpenedFrom(pickerOpenedFrom);
    setMainView('cultura');
  };
  const handleBackFromPicker = () => setMainView(pickerOpenedFrom === 'propriedade' ? 'propriedade' : 'dashboard');
  const handleAddLoteFromPropriedade = (cid) => {
    setPickerOpenedFrom('propriedade');
    if (cid && CULTURAS[cid]) {
      setCulturaId(cid);
      setCulturaTab('lotes');
      setAutoOpenLoteForm(true);
      setCulturaOpenedFrom('propriedade');
      setMainView('cultura');
    } else {
      setMainView('cultura-picker');
    }
  };

  // ── Guia técnico da cultura (aberto a partir do lote) ──
  const abrirGuia = (cid) => {
    setCulturaId(cid);
    setCulturaTab('cronograma');
    setAutoOpenLoteForm(false);
    setCulturaOpenedFrom('lote');
    setMainView('cultura');
  };
  const handleBackFromCultura = () => {
    const destino = culturaOpenedFrom === 'lote' && selectedLote ? 'lote'
      : culturaOpenedFrom === 'propriedade' ? 'propriedade' : 'dashboard';
    setCulturaId(null);
    setAutoOpenLoteForm(false);
    setMainView(destino);
    refreshDados();
  };

  // ── Propriedades / talhões (via Mais) ──
  const handleSelectPropriedade = (p) => { setSelectedPropriedade(p); setMainView('propriedade'); };
  const handleBackFromPropriedade = () => { setSelectedPropriedade(null); setMainView('propriedades'); };
  const handleSelectTalhao = (t) => { setSelectedTalhao(t); setMainView('talhao'); };
  const handleBackFromTalhao = () => { setSelectedTalhao(null); setMainView('propriedade'); };

  // ── Estoque: aba da barra, ou aberto de dentro de uma propriedade ──
  const abrirEstoque = (origem = null) => { setEstoqueOpenedFrom(origem); setMainView('estoque'); };

  const cultura = culturaId ? CULTURAS[culturaId] : null;

  // Papel do usuário na propriedade em foco
  const userRole = getUserRole(selectedPropriedade?.id);

  // Telas restritas a administradores
  const ADMIN_ONLY_VIEWS = ['analise', 'financeiro', 'compradores'];
  const navegarMais = (view) => {
    if (ADMIN_ONLY_VIEWS.includes(view) && !isGlobalAdmin) return;
    if (view === 'propriedades') setSelectedPropriedade(null);
    irPara(view);
  };
  const voltarMais = () => irPara('mais');

  // Qual aba da barra fica acesa
  const VIEWS_MAIS = ['mais', 'propriedades', 'propriedade', 'talhao', 'financeiro', 'compradores',
    'analise', 'simulador', 'comparacao', 'calculadora', 'configuracoes'];
  const abaAtiva =
    mainView === 'calendario' ? 'calendario'
    : mainView === 'estoque' ? 'estoque'
    : VIEWS_MAIS.includes(mainView) ? 'mais'
    : (mainView === 'lote' && ['propriedade', 'talhao'].includes(loteOpenedFrom)) ? 'mais'
    : 'dashboard';
  const corAtiva = mainView === 'lote' && selectedLote && CULTURAS[selectedLote.cultura_id]
    ? CULTURAS[selectedLote.cultura_id].cor : BRAND;

  // ── Botão "voltar" físico do Android (Capacitor) ───────────────────────────
  const androidBackRef = useRef(() => false);
  androidBackRef.current = () => {
    switch (mainView) {
      case 'cultura-picker': handleBackFromPicker();       return true;
      case 'cultura':        handleBackFromCultura();      return true;
      case 'lote':           handleBackFromLote();         return true;
      case 'propriedade':    handleBackFromPropriedade();  return true;
      case 'talhao':         handleBackFromTalhao();       return true;
      case 'estoque':
        if (estoqueOpenedFrom === 'propriedade') setMainView('propriedade'); else irPara('dashboard');
        return true;
      case 'propriedades': case 'financeiro': case 'compradores': case 'analise':
      case 'simulador': case 'comparacao': case 'calculadora': case 'configuracoes':
        voltarMais(); return true;
      case 'calendario': case 'mais':
        irPara('dashboard'); return true;
      default: return false; // Início — sai do app
    }
  };

  useEffect(() => {
    let remove = null;
    (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) return;
        const { App: CapApp } = await import('@capacitor/app');
        const sub = await CapApp.addListener('backButton', () => {
          const handled = androidBackRef.current?.();
          if (!handled) CapApp.exitApp();
        });
        remove = () => sub.remove();
      } catch { /* web — sem botão físico */ }
    })();
    return () => { if (remove) remove(); };
  }, []);

  return (
    <AnotarProvider lotes={allLotes} onAbrir={refreshDados}>
      <div className="bg-background" style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <NetworkStatusBanner />
        <InstallPWA />

        <main
          ref={mainRef}
          className="pb-36"
          style={{
            flex: '1 1 0%',
            minHeight: 0,              /* necessário para overflow funcionar em flex */
            overflowY: 'auto',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'none',
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={
                mainView === 'cultura'        ? `cultura-${culturaId}-${culturaTab}` :
                mainView === 'lote'           ? `lote-${selectedLote?.id}` :
                mainView === 'propriedade'    ? `propriedade-${selectedPropriedade?.id}` :
                mainView === 'talhao'         ? `talhao-${selectedTalhao?.id}` :
                mainView
              }
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
            >
              <Suspense fallback={
                <div className="flex items-center justify-center py-24">
                  <Loader2 size={28} className="animate-spin" style={{ color: BRAND }} />
                </div>
              }>
              {mainView === 'dashboard' && (
                <Dashboard
                  onAddLote={() => handleAddLote('dashboard')}
                  onSelectLote={(l) => abrirLote(l, 'dashboard')}
                  onGoEstoque={() => abrirEstoque(null)}
                  onGoAgenda={() => irPara('calendario')}
                  onGoCompradores={isGlobalAdmin ? () => irPara('compradores') : null}
                  userName={displayName}
                />
              )}
              {mainView === 'calendario' && <CalendarioPage />}
              {mainView === 'estoque' && (
                <EstoquePage
                  propriedadeId={propriedadePadrao?.id ?? null}
                  onBack={estoqueOpenedFrom === 'propriedade' ? () => setMainView('propriedade') : undefined}
                />
              )}
              {mainView === 'mais' && (
                <MaisPage onNavigate={navegarMais} onSignOut={signOut} isGlobalAdmin={isGlobalAdmin} userName={displayName} />
              )}
              {mainView === 'cultura-picker' && (
                <CulturaPicker onSelectCultura={handlePickCultura} onBack={handleBackFromPicker} />
              )}
              {mainView === 'cultura' && cultura && (
                <CulturaPage
                  cultura={cultura}
                  onBack={handleBackFromCultura}
                  autoOpenLoteForm={autoOpenLoteForm}
                  propriedadeId={propriedadePadrao?.id ?? null}
                  initialTab={culturaTab}
                />
              )}
              {mainView === 'lote' && selectedLote && CULTURAS[selectedLote.cultura_id] && (
                <LotePage
                  lote={selectedLote}
                  cultura={CULTURAS[selectedLote.cultura_id]}
                  onBack={handleBackFromLote}
                  userRole={userRole}
                  propriedade={selectedPropriedade}
                  onRepetido={(l) => abrirLote(l, loteOpenedFrom)}
                  onAbrirGuia={abrirGuia}
                />
              )}
              {mainView === 'simulador'  && <ComVoltar onBack={voltarMais}><SimuladorPage onComparar={() => irPara('comparacao')} /></ComVoltar>}
              {mainView === 'comparacao' && <ComVoltar onBack={voltarMais}><ComparacaoCulturas /></ComVoltar>}
              {mainView === 'analise'    && isGlobalAdmin && (
                <ComVoltar onBack={voltarMais}>
                  <AnalysePage onSignOut={signOut} userName={displayName} propriedades={propriedades} userRole={userRole} />
                </ComVoltar>
              )}
              {mainView === 'configuracoes' && <SettingsPage onBack={voltarMais} />}
              {mainView === 'calculadora'   && <CalculadoraPage onBack={voltarMais} />}
              {mainView === 'financeiro'    && isGlobalAdmin && <FinanceiroPage onBack={voltarMais} propriedades={propriedades} />}
              {mainView === 'compradores'   && isGlobalAdmin && <CompradoresPage onBack={voltarMais} />}
              {mainView === 'propriedades' && (
                <PropriedadesPage
                  onBack={voltarMais}
                  onSelectPropriedade={handleSelectPropriedade}
                  onRefreshNeeded={() => refreshPropriedadesRef.current?.()}
                />
              )}
              {mainView === 'propriedade' && selectedPropriedade && (
                <PropriedadePage
                  propriedade={selectedPropriedade}
                  userRole={userRole}
                  onBack={handleBackFromPropriedade}
                  onSelectLote={(l) => abrirLote(l, 'propriedade')}
                  onGoEstoque={() => abrirEstoque('propriedade')}
                  onAddLote={handleAddLoteFromPropriedade}
                  onSelectTalhao={handleSelectTalhao}
                />
              )}
              {mainView === 'talhao' && selectedTalhao && (
                <TalhaoPage
                  talhao={selectedTalhao}
                  onBack={handleBackFromTalhao}
                  onSelectLote={(l) => abrirLote(l, 'talhao')}
                />
              )}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>

        {/* ── Barra inferior: 4 destinos + Anotar no centro ── */}
        <BarraInferior aba={abaAtiva} cor={corAtiva} onNav={(v) => {
          if (v === 'estoque') { abrirEstoque(null); setCulturaId(null); return; }
          if (v === 'mais' && VIEWS_MAIS.includes(mainView) && mainView !== 'mais') { irPara('mais'); return; }
          irPara(v);
        }} />

        {showMigrationWizard && (
          <MigrationWizard
            onComplete={(prop) => {
              setShowMigrationWizard(false);
              setSelectedPropriedade(prop);
            }}
          />
        )}
      </div>
    </AnotarProvider>
  );
}

// ── Barra inferior ───────────────────────────────────────────────────────────
const NAV = [
  { value: 'dashboard',  label: 'Início',  Icon: Home },
  { value: 'calendario', label: 'Agenda',  Icon: CalendarDays },
  { value: 'anotar' },
  { value: 'estoque',    label: 'Estoque', Icon: Package2 },
  { value: 'mais',       label: 'Mais',    Icon: LayoutGrid },
];

function BarraInferior({ aba, cor, onNav }) {
  const { anotar } = useAnotar();
  return (
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
        className="mx-3 mb-1 rounded-2xl border max-w-xl sm:mx-auto"
        style={{
          background: 'rgba(255,255,255,0.94)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderColor: 'hsl(140 13% 88%)',
          boxShadow: '0 10px 24px -4px rgb(0 0 0 / 0.11), 0 4px 8px -4px rgb(0 0 0 / 0.07)',
        }}
      >
        <div className="flex items-center h-[62px] px-1">
          {NAV.map(({ value, label, Icon }) => {
            if (value === 'anotar') {
              return (
                <div key="anotar" className="flex-1 flex justify-center">
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    onClick={() => anotar()}
                    aria-label="Anotar"
                    className="-mt-7 w-[58px] h-[58px] rounded-2xl flex flex-col items-center justify-center text-white"
                    style={{ background: BRAND, boxShadow: `0 10px 22px -6px ${BRAND}`, border: '3px solid #fff' }}
                  >
                    <Plus size={24} strokeWidth={2.6} />
                    <span className="text-[9px] font-extrabold -mt-0.5">Anotar</span>
                  </motion.button>
                </div>
              );
            }
            const isActive = aba === value;
            const c = isActive && value === 'dashboard' ? cor : BRAND;
            return (
              <button
                key={value}
                onClick={() => onNav(value)}
                className="relative flex flex-col items-center justify-center flex-1 h-full gap-0.5 rounded-xl mx-0.5 transition-all duration-200 active:scale-95"
                style={{ color: isActive ? c : 'hsl(150 8% 40%)' }}
              >
                {isActive && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-x-1 inset-y-1.5 rounded-xl"
                    style={{ background: `${c}18` }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex flex-col items-center gap-0.5">
                  <Icon size={19} strokeWidth={isActive ? 2.5 : 1.8} />
                  <span className="text-[10px] leading-none" style={{ fontWeight: isActive ? 700 : 500 }}>{label}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

/** Botão "Voltar" para telas que não têm um próprio (abertas pelo Mais). */
function ComVoltar({ onBack, children }) {
  return (
    <div className="relative">
      <button
        onClick={onBack}
        aria-label="Voltar"
        className="fixed z-40 flex items-center gap-1 px-3 h-9 rounded-xl text-[12px] font-bold"
        style={{
          top: 'calc(var(--safe-top) + 8px)', right: 12,
          background: 'rgba(255,255,255,0.92)', color: BRAND,
          border: '1px solid hsl(140 13% 88%)', boxShadow: '0 4px 14px -2px rgb(0 0 0 / 0.12)',
        }}
      >
        <ArrowLeft size={14} /> Mais
      </button>
      {children}
    </div>
  );
}
