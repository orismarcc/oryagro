import React from 'react';
import { logDbError } from '../lib/logger';

/**
 * ErrorBoundary — captura erros de renderização em qualquer componente filho e
 * exibe uma tela de recuperação em vez de deixar o app em tela branca.
 *
 * Sem isto, um único erro de JS em qualquer tela derruba todo o aplicativo.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Reaproveita o logger seguro (sanitiza em produção)
    logDbError('ErrorBoundary', { message: error?.message, stack: info?.componentStack });
  }

  handleReload = () => {
    // Recarrega a aplicação do zero
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-background">
        <div className="text-5xl mb-4">🌱</div>
        <h1 className="text-[18px] font-bold text-foreground mb-2">Algo deu errado</h1>
        <p className="text-[13px] text-muted-foreground max-w-sm mb-6">
          Ocorreu um erro inesperado nesta tela. Seus dados estão seguros no servidor —
          tente recarregar o aplicativo.
        </p>
        <div className="flex gap-2">
          <button
            onClick={this.handleReset}
            className="px-4 py-2.5 rounded-xl text-[13px] font-semibold border border-input text-muted-foreground"
          >
            Tentar de novo
          </button>
          <button
            onClick={this.handleReload}
            className="px-4 py-2.5 rounded-xl text-[13px] font-bold text-white"
            style={{ background: 'hsl(142 72% 29%)' }}
          >
            Recarregar app
          </button>
        </div>
        {import.meta.env.DEV && this.state.error && (
          <pre className="mt-6 max-w-full overflow-auto text-left text-[11px] text-red-500 bg-red-50 p-3 rounded-lg">
            {String(this.state.error?.message || this.state.error)}
          </pre>
        )}
      </div>
    );
  }
}
