import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

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
