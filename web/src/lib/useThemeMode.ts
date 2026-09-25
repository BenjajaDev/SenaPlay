import { useCallback, useEffect, useState } from 'react';
import { applyFavicon, type ThemeMode } from './brand';

// El script en línea de index.html lee esta misma clave para poner el favicon
// correcto antes de que cargue React.
const KEY = 'senaplay.theme';

function readStored(): ThemeMode | null {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

/** Tema claro/oscuro del portal: preferencia guardada o la del sistema. También elige el favicon. */
export function useThemeMode() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const stored = readStored();
    if (stored) return stored;
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = mode;
    applyFavicon(mode);
  }, [mode]);

  const toggle = useCallback(() => {
    setMode((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* sin almacenamiento: solo esta sesión */
      }
      return next;
    });
  }, []);

  return { mode, toggle };
}
