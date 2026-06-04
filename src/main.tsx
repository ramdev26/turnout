import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './styles/landing-premium.css';
import './styles/landing-showcase.css';
import './styles/landing-checkout.css';

import { ErrorBoundary } from './components/ErrorBoundary.tsx';

// Build marker helps force fresh client asset caching on hotfix deploys.
(window as Window & { __TURNOUT_BUILD__?: string }).__TURNOUT_BUILD__ = '2026-05-06-cache-fix-1';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
