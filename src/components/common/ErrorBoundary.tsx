import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackLabel?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.fallbackLabel ? ` - ${this.props.fallbackLabel}` : ''}]`, error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '3rem 1.5rem',
          textAlign: 'center',
          minHeight: '40vh',
        }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: '#FEE2E2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.25rem',
          }}>
            <AlertTriangle size={28} color="#EF4444" />
          </div>
          <h2 style={{ color: 'var(--primary)', fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.5rem' }}>
            Erro ao carregar esta página
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', maxWidth: 460, margin: '0 0 1.5rem', lineHeight: 1.5 }}>
            Ocorreu um problema inesperado. Tente recarregar a página ou volte ao painel principal.
          </p>
          {this.state.error && (
            <details style={{
              background: '#F8FAFC',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              padding: '0.75rem 1rem',
              marginBottom: '1.5rem',
              maxWidth: 520,
              width: '100%',
              fontSize: '0.78rem',
              color: 'var(--text-muted)',
              textAlign: 'left',
            }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Detalhes do erro</summary>
              <pre style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                {this.state.error.message}
              </pre>
            </details>
          )}
          <button
            onClick={this.handleRetry}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.2rem' }}
          >
            <RefreshCw size={16} /> Tentar Novamente
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
