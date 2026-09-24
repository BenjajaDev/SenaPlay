import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/global.css';
import './styles/pages.css';

// Aplica el tema guardado antes del primer pintado (evita el destello claro).
try {
  const stored = localStorage.getItem('senaplay.theme');
  if (stored === 'light' || stored === 'dark') document.documentElement.dataset.theme = stored;
} catch {
  /* sin almacenamiento */
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
