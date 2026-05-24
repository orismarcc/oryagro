import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

// ── Capacitor / APK ──────────────────────────────────────────────────────────
if (Capacitor.isNativePlatform()) {
  StatusBar.setOverlaysWebView({ overlay: true });
  StatusBar.setStyle({ style: Style.Dark });
  StatusBar.setBackgroundColor({ color: '#16a34a' });

  document.documentElement.classList.add('native');

  /**
   * Mede env(safe-area-inset-top) via um elemento probe e define --safe-top
   * como INLINE STYLE no <html> — prioridade máxima, garante que nunca será
   * sobrescrito por nenhuma regra CSS.
   *
   * Se env() retornar um valor suspeito (< 20px), usa 40px como fallback
   * conservador que cobre todos os dispositivos Android atuais.
   */
  const applySafeTop = () => {
    const probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;top:0;left:0;width:0;' +
      'padding-top:env(safe-area-inset-top,0px);' +
      'visibility:hidden;pointer-events:none;z-index:-1';
    document.documentElement.appendChild(probe);
    const measured = parseFloat(getComputedStyle(probe).paddingTop) || 0;
    probe.remove();

    // Se env() retornou >= 20px, o valor é confiável; senão usa 40px (seguro
    // para barras de status de 24-36dp em qualquer densidade de tela).
    const safeTop = measured >= 20 ? measured : 40;
    document.documentElement.style.setProperty('--safe-top', safeTop + 'px');
  };

  // Aplica imediatamente (captura env() se já disponível) e de novo após
  // 300ms, pois o WebView pode demorar para receber os insets do SO.
  applySafeTop();
  setTimeout(applySafeTop, 300);
}

// Impede que o WebView restaure o scroll antigo ao voltar de uma página.
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
