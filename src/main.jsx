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

// ── Service Worker: atualização automática e confiável ────────────────────────
// Problema recorrente: o SW (workbox) servia o bundle ANTIGO em cache, então
// novos deploys "não apareciam" até limpar o cache manualmente. Esta rotina
// garante que uma versão publicada seja aplicada sozinha:
//  - checa atualização ao abrir, ao focar o app e a cada 30 min (reg.update());
//  - quando um SW NOVO assume o controle (skipWaiting + clientsClaim no build),
//    recarrega a página UMA vez para servir o conteúdo novo.
(async () => {
  if (!('serviceWorker' in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    if (regs.length > 1) {                 // limpeza de SWs órfãos duplicados
      await Promise.all(regs.map(r => r.unregister()));
      window.location.reload();
      return;
    }

    let refreshing = false;
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // Só recarrega quando um SW novo SUBSTITUI um antigo (atualização real),
      // nunca na primeira instalação — evita reload desnecessário e loops.
      if (refreshing || !hadController) return;
      refreshing = true;
      window.location.reload();
    });

    const checkUpdate = () =>
      navigator.serviceWorker.ready.then(reg => reg.update()).catch(() => {});
    checkUpdate();                                  // ao abrir
    setInterval(checkUpdate, 30 * 60 * 1000);       // a cada 30 min
    window.addEventListener('focus', checkUpdate);  // ao retornar ao app
  } catch { /* falha silenciosa — não bloqueia o app */ }
})();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
