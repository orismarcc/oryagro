import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Impede que o WebView/browser restaure o scroll antigo ao voltar de uma página.
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
