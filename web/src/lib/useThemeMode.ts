import { useCallback, useEffect, useState } from 'react';

const KEY = 'senaplay.theme';

function readStored(): 'light' | 'dark' | null {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

/** Tema claro/oscuro del portal: preferencia guardada o la del sistema. */
export function useThemeMode() {
  const [mode, setMode] = useState<'light' | 'dark'>(() => {
    const stored = readStored();
    if (stored) return stored;
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = mode;
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
