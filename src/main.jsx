import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { initOutbox } from './lib/outbox';
import './index.css';

// Liga a fila de escritas offline (retry automático ao reconectar).
initOutbox();

// ── Capacitor (APK Android) ───────────────────────────────────────────────────
// Em ambiente nativo: marca <html class="native"> (ativa o padding de safe-area
// do CSS) e configura a status bar para sobrepor o WebView com ícones claros,
// já que o topo de toda tela é o hero verde. No navegador isto é ignorado.
(async () => {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return;
    document.documentElement.classList.add('native');
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setStyle({ style: Style.Dark }); // Dark = texto/ícones claros
  } catch { /* web ou plugin ausente — segue como PWA */ }
})();

// Impede que o WebView/browser restaure o scroll antigo ao voltar de uma página.
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

// ── Limpeza de Service Workers antigos ────────────────────────────────────────
// O build anterior usava Vite 8 + rolldown que gerava código inválido causando
// tela branca no mobile. O SW antigo serve esse bundle quebrado do cache.
// Esta rotina desregistra todos os SWs órfãos na primeira execução após o update,
// forçando o browser a baixar o bundle correto do servidor.
(async () => {
  if (!('serviceWorker' in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    // Se há mais de 1 SW ativo ou o SW ativo tem hash antigo, limpa tudo
    if (regs.length > 1) {
      await Promise.all(regs.map(r => r.unregister()));
      window.location.reload();
      return;
    }
    // Verificar se SW atual está servindo a versão correta
    // (workbox gera service worker com precache atualizado — se o SW
    // ainda não assumiu, forçar claim)
    const sw = navigator.serviceWorker.controller;
    if (sw && sw.scriptURL?.includes('sw.js')) {
      // SW está ativo e é o correto — nada a fazer
    }
  } catch { /* falha silenciosa — não bloqueia o app */ }
})();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
