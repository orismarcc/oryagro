import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { initOutbox } from './lib/outbox';
import { limparChavesLegadas } from './lib/safeStorage';
import './index.css';

// Liga a fila de escritas offline (retry automático ao reconectar).
initOutbox();
// Remove caches de versões antigas que não são mais usados.
limparChavesLegadas();

// Impede que o navegador restaure o scroll antigo ao voltar de uma página.
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
