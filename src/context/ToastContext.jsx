import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

// ─── Context ────────────────────────────────────────────────────────────────

const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast deve ser usado dentro de <ToastProvider>');
  return ctx;
}

// ─── Toast item component ────────────────────────────────────────────────────

const STYLES = {
  success: {
    bg: 'hsl(142 72% 29%)',
    border: 'hsl(142 60% 40%)',
    icon: CheckCircle2,
  },
  error: {
    bg: 'hsl(4 86% 50%)',
    border: 'hsl(4 86% 65%)',
    icon: XCircle,
  },
  warning: {
    bg: 'hsl(38 92% 40%)',
    border: 'hsl(38 92% 55%)',
    icon: AlertTriangle,
  },
  info: {
    bg: 'hsl(221 83% 50%)',
    border: 'hsl(221 83% 65%)',
    icon: Info,
  },
};

function ToastItem({ id, message, type = 'info', onDismiss }) {
  const style = STYLES[type] ?? STYLES.info;
  const Icon = style.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 48, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="flex items-start gap-3 px-4 py-3 rounded-2xl shadow-lg max-w-[90vw]"
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        minWidth: 240,
        maxWidth: 340,
      }}
    >
      <Icon size={18} color="white" className="flex-shrink-0 mt-0.5" />
      <span className="flex-1 text-white text-[13px] font-semibold leading-snug">{message}</span>
      <button
        onClick={() => onDismiss(id)}
        className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
        aria-label="Fechar"
      >
        <X size={15} color="white" />
      </button>
    </motion.div>
  );
}

// ─── Provider ────────────────────────────────────────────────────────────────

let _nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  /**
   * Exibe um toast.
   * @param {string} message - Mensagem a exibir
   * @param {'success'|'error'|'warning'|'info'} type - Tipo visual
   * @param {number} duration - Duração em ms (padrão 4000; 0 = permanente)
   */
  const showToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = _nextId++;
    setToasts(prev => [...prev.slice(-3), { id, message, type }]); // máx 4 toasts
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }
    return id;
  }, [dismiss]);

  // Atalhos convenientes
  const toast = {
    success: (msg, dur) => showToast(msg, 'success', dur),
    error:   (msg, dur) => showToast(msg, 'error',   dur ?? 6000),
    warning: (msg, dur) => showToast(msg, 'warning', dur),
    info:    (msg, dur) => showToast(msg, 'info',    dur),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}

      {/* ── Toast container — fixado no bottom, acima da bottom nav ── */}
      <div
        className="fixed z-[9999] flex flex-col-reverse gap-2 pointer-events-none"
        style={{
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'max-content',
        }}
      >
        <AnimatePresence mode="popLayout">
          {toasts.map(t => (
            <div key={t.id} className="pointer-events-auto">
              <ToastItem {...t} onDismiss={dismiss} />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
