import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { Portfolio } from './Portfolio.jsx';
const Admin = lazy(() => import('./Admin.jsx').then((module) => ({ default: module.Admin })));
import './styles.css';
import '@fontsource/poppins/latin-400.css';
import '@fontsource/poppins/latin-500.css';
import '@fontsource/poppins/latin-600.css';
import '@fontsource/poppins/latin-700.css';
class ErrorBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="app-message">
        <h1>Something went wrong.</h1>
        <button onClick={() => location.reload()}>Reload page</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Suspense
        fallback={
          <main className="app-message">
            <span className="brand">KBD.</span>
            <p>Loading editor…</p>
          </main>
        }
      >
        {location.pathname.startsWith('/admin') ? <Admin /> : <Portfolio />}
      </Suspense>
    </ErrorBoundary>
  </React.StrictMode>,
);
