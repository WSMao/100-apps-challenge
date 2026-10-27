import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

// Global error telemetry to terminal
window.addEventListener('error', (event) => {
  const errObj = {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error?.stack || String(event.error),
  };
  console.error('[UNCAUGHT ERROR]:', errObj);
  try {
    fetch('/api/log-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(errObj),
    });
  } catch {}
});

window.addEventListener('unhandledrejection', (event) => {
  const errObj = {
    message: 'Unhandled Promise Rejection: ' + (event.reason?.message || String(event.reason)),
    error: event.reason?.stack || String(event.reason),
  };
  console.error('[UNHANDLED REJECTION]:', errObj);
  try {
    fetch('/api/log-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(errObj),
    });
  } catch {}
});

const container = document.getElementById('root');
if (!container) {
  throw new Error('Creative-Neuro: root element #root not found in document.');
}

const root = createRoot(container);
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
