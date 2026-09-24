import { useCallback, useEffect, useState } from 'react';
import { setUserHapticsPreference } from '../../../core/feedback/haptics';
import { jsonStorage, storageKey } from '../../../core/storage/jsonStorage';

const PREFS_KEY = storageKey('preferences', 'v1');
const DEFAULT_PREFS = { haptics: true };

// Carga las preferencias guardadas al iniciar la app (llamado desde AppRoot)
// para que la vibración respete la elección del usuario desde el primer toque.
export async function hydratePreferences() {
  const prefs = { ...DEFAULT_PREFS, ...(await jsonStorage.get(PREFS_KEY, {})) };
  setUserHapticsPreference(prefs.haptics);
  return prefs;
}

/** Preferencias locales del usuario (por dispositivo). */
export default function usePreferences() {
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);

  useEffect(() => {
    let mounted = true;
    hydratePreferences().then((loaded) => {
      if (mounted) setPrefs(loaded);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const update = useCallback((patch) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      jsonStorage.set(PREFS_KEY, next);
      if ('haptics' in patch) setUserHapticsPreference(next.haptics);
      return next;
    });
  }, []);

  return { prefs, update };
}
