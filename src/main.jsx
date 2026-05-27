import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Impede que o WebView/browser restaure o scroll antigo ao voltar de uma página.
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

// ErrorBoundary temporário para diagnóstico de tela branca no mobile
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      const e = this.state.error;
      return (
        <div style={{ padding: 24, fontFamily: 'monospace', background: '#fff', color: '#c00', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 13 }}>
          <strong>⚠️ Erro ao iniciar o app</strong>{'\n\n'}
          <b>Mensagem:</b> {e?.message}{'\n'}
          <b>Stack:</b>{'\n'}{e?.stack}
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <React.StrictMode>
      <App />
    </React.StrictMode>
  </ErrorBoundary>
);
