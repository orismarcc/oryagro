import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

// Inicializa a StatusBar quando rodando dentro do APK (Capacitor).
// overlay: false → a barra de status tem fundo sólido (#16a34a) e o WebView
// começa ABAIXO dela — sem necessidade de env(safe-area-inset-top) no CSS.
if (Capacitor.isNativePlatform()) {
  StatusBar.setOverlaysWebView({ overlay: false });
  StatusBar.setStyle({ style: Style.Dark });
  StatusBar.setBackgroundColor({ color: '#16a34a' });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
