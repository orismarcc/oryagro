import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu, X, Home, CalendarDays, BarChart2, Building2,
  Package2, Calculator, Settings, DollarSign, Users, TrendingUp,
} from 'lucide-react';
import Logo from './Logo';

const MENU_ITEMS = [
  { id: 'dashboard',     label: 'Dashboard',              icon: Home },
  { id: 'calendario',    label: 'Calendário',             icon: CalendarDays },
  { id: 'analise',       label: 'Análise',                icon: BarChart2,   requiresAdmin: true },
  { id: 'financeiro',    label: 'Financeiro',             icon: DollarSign,  requiresAdmin: true },
  { id: 'simulador',     label: 'Simulador',              icon: TrendingUp },
  { id: 'propriedades',  label: 'Propriedades',           icon: Building2 },
  { id: 'compradores',   label: 'Compradores',            icon: Users,       requiresAdmin: true },
  { id: 'estoque',       label: 'Estoque',                icon: Package2,    requiresProp: true },
  { id: 'calculadora',   label: 'Calculadora de Insumos', icon: Calculator },
];

const SETTINGS_ITEM = { id: 'configuracoes', label: 'Configurações', icon: Settings };

const GREEN = 'hsl(160 84% 27%)';
const GREEN_BG = 'hsl(152 40% 94%)';

export default function HamburgerMenu({ currentView, onNavigate, hasPropriedade = false, isGlobalAdmin = true }) {
  const [open, setOpen] = useState(false);

  const handleNavigate = (id) => {
    setOpen(false);
    onNavigate(id);
  };

  return (
    <>
      {/* ── Trigger button ── */}
      <motion.button
        whileTap={{ scale: 0.88 }}
        onClick={() => setOpen(true)}
        className="fixed z-50 flex items-center justify-center w-10 h-10 rounded-2xl shadow-md"
        style={{
          /* Posiciona abaixo da status bar usando --safe-top (mínimo 28px garantido) */
          top: 'calc(var(--safe-top) + 8px)',
          right: '12px',
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid hsl(214 20% 88%)',
          boxShadow: '0 4px 14px -2px rgb(0 0 0 / 0.12)',
        }}
        aria-label="Abrir menu"
      >
        <Menu size={18} style={{ color: GREEN }} />
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            {/* ── Backdrop ── */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[60]"
              style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}
            />

            {/* ── Drawer ── */}
            <motion.div
              key="drawer"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed top-0 right-0 bottom-0 z-[70] flex flex-col"
              style={{
                width: 280,
                background: '#ffffff',
                boxShadow: '-4px 0 40px rgb(0 0 0 / 0.16)',
                /* O drawer abre sobre a status bar; usamos paddingTop para
                   empurrar seu conteúdo abaixo dela. */
                paddingTop: 'var(--safe-top)',
              }}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-5 py-4 flex-shrink-0"
                style={{ borderBottom: '1px solid hsl(214 20% 92%)' }}
              >
                <div className="flex items-center gap-2.5">
                  <Logo size={32} style={{ borderRadius: 8 }} />
                  <span className="font-display text-[16px] font-extrabold text-foreground">OryAgro</span>
                </div>
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={() => setOpen(false)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
                  style={{ color: 'hsl(215 16% 50%)' }}
                  aria-label="Fechar menu"
                >
                  <X size={18} />
                </motion.button>
              </div>

              {/* Items */}
              <nav className="flex-1 overflow-y-auto py-2">
                {MENU_ITEMS.map((item, idx) => {
                  const isActive = currentView === item.id;
                  const isDisabledProp  = item.requiresProp  && !hasPropriedade;
                  const isDisabledAdmin = item.requiresAdmin && !isGlobalAdmin;
                  const isDisabled = isDisabledProp || isDisabledAdmin;
                  const Icon = item.icon;

                  return (
                    <motion.button
                      key={item.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.04 + idx * 0.045, duration: 0.22 }}
                      onClick={() => !isDisabled && handleNavigate(item.id)}
                      disabled={isDisabled}
                      className="w-full flex items-center gap-3 px-5 py-3 text-left transition-colors"
                      style={{
                        background: isActive ? GREEN_BG : 'transparent',
                        color: isActive
                          ? GREEN
                          : isDisabled
                            ? 'hsl(215 16% 70%)'
                            : 'hsl(215 16% 28%)',
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        opacity: isDisabled ? 0.55 : 1,
                      }}
                    >
                      <Icon
                        size={18}
                        strokeWidth={isActive ? 2.5 : 1.75}
                      />
                      <span
                        className="text-[14px]"
                        style={{ fontWeight: isActive ? 700 : 500 }}
                      >
                        {item.label}
                      </span>
                      {isDisabledProp && (
                        <span
                          className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                          style={{ background: 'hsl(214 20% 92%)', color: 'hsl(215 16% 55%)' }}
                        >
                          sem prop.
                        </span>
                      )}
                      {isDisabledAdmin && (
                        <span
                          className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                          style={{ background: 'hsl(214 20% 92%)', color: 'hsl(215 16% 55%)' }}
                        >
                          só gestor
                        </span>
                      )}
                    </motion.button>
                  );
                })}

                {/* Separador antes de Configurações */}
                <div
                  className="mx-5 my-2"
                  style={{ height: 1, background: 'hsl(214 20% 92%)' }}
                />

                {/* Configurações */}
                {(() => {
                  const isActive = currentView === SETTINGS_ITEM.id;
                  const Icon = SETTINGS_ITEM.icon;
                  return (
                    <motion.button
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.04 + MENU_ITEMS.length * 0.045, duration: 0.22 }}
                      onClick={() => handleNavigate(SETTINGS_ITEM.id)}
                      className="w-full flex items-center gap-3 px-5 py-3 text-left transition-colors"
                      style={{
                        background: isActive ? GREEN_BG : 'transparent',
                        color: isActive ? GREEN : 'hsl(215 16% 28%)',
                      }}
                    >
                      <Icon size={18} strokeWidth={isActive ? 2.5 : 1.75} />
                      <span
                        className="text-[14px]"
                        style={{ fontWeight: isActive ? 700 : 500 }}
                      >
                        {SETTINGS_ITEM.label}
                      </span>
                    </motion.button>
                  );
                })()}
              </nav>

              {/* Footer */}
              <div
                className="px-5 py-4 flex-shrink-0"
                style={{ borderTop: '1px solid hsl(214 20% 92%)' }}
              >
                <p className="text-[11px] text-muted-foreground text-center">
                  OryAgro · Gestão Agrícola
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
