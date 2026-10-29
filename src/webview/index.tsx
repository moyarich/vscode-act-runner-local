import React from 'react';
import { createRoot } from 'react-dom/client';
import './global.css';
import { setLocale, t } from './i18n';
setLocale(document.documentElement.lang || navigator.language);
import { App } from './App';

/** Error boundary para capturar crashes do React e exibir mensagem útil */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, color: '#f85149', fontFamily: 'monospace' }}>
          <h2>⚠️ {t('error.webview')}</h2>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#e6edf3', marginTop: 12 }}>
            {this.state.error.message}
          </pre>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#8b949e', marginTop: 8, fontSize: 11 }}>
            {this.state.error.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const root = createRoot(document.getElementById('root')!);
root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
