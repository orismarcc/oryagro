import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X } from 'lucide-react';

const DISMISSED_KEY = 'pwa_install_dismissed_at';
const DISMISS_DAYS = 7;

/**
 * Banner discreto para instalar o webapp como PWA no celular.
 * - Android/Chrome: usa o evento `beforeinstallprompt`
 * - iOS Safari: mostra instrução manual (Compartilhar → Adicionar à tela inicial)
 * - Já instalado ou dismiss recente: oculto
 */
export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Detecta se já está rodando em modo standalone (instalado)
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    if (isStandalone) return;

    // Respeita dismiss recente
    const dismissedAt = parseInt(localStorage.getItem(DISMISSED_KEY) || '0', 10);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_DAYS * 86_400_000) return;

    // iOS detection (não dispara beforeinstallprompt)
    const ua = window.navigator.userAgent || '';
    const iOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    if (iOS) {
      setIsIOS(true);
      setVisible(true);
      return;
    }

    // Android/Chrome — escuta o evento
    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // Quando o usuário aceita a instalação
    const onInstalled = () => {
      setVisible(false);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'dismissed') {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    }
    setDeferredPrompt(null);
    setVisible(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          className="fixed z-[8000] left-1/2 -translate-x-1/2"
          style={{
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)',
            width: 'min(94vw, 380px)',
          }}
        >
          <div
            className="flex items-center gap-3 rounded-2xl shadow-lg p-3"
            style={{
              background: 'white',
              border: '1px solid hsl(214 20% 88%)',
            }}
          >
            <div
              className="flex items-center justify-center rounded-xl flex-shrink-0"
              style={{
                width: 40, height: 40,
                background: 'hsl(142 60% 95%)',
                color: 'hsl(157 68% 26%)',
              }}
            >
              <Download size={20} />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-foreground leading-tight">
                Instalar OryAgro no celular
              </p>
              <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                {isIOS
                  ? 'Toque em Compartilhar → "Adicionar à Tela de Início".'
                  : 'Acesso rápido como um app, funciona offline.'}
              </p>
            </div>

            {!isIOS && (
              <button
                onClick={handleInstall}
                className="px-3 py-2 rounded-xl text-[12px] font-bold text-white flex-shrink-0"
                style={{ background: 'hsl(157 68% 26%)' }}
              >
                Instalar
              </button>
            )}

            <button
              onClick={handleDismiss}
              aria-label="Fechar"
              className="flex-shrink-0 p-1.5 rounded-lg opacity-60 hover:opacity-100"
            >
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
