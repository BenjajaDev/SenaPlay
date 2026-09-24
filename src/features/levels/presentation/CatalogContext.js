import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useServices } from '../../../core/di/ServicesProvider';

// Provee el catálogo de niveles a toda la app. Arranca con el catálogo local
// (instantáneo, sin red) y lo reemplaza por el remoto/caché en cuanto llega.
const CatalogContext = createContext({
  levels: [],
  loading: true,
  source: 'local',
  getLevelById: () => null,
  reload: async () => {},
});

export function CatalogProvider({ children }) {
  const { catalog } = useServices();
  const [levels, setLevels] = useState(() => catalog.getLocalLevels());
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState('local');

  const reload = useCallback(async () => {
    setLoading(true);
    const result = await catalog.getLevels();
    setLevels(result.levels);
    setSource(result.source);
    setLoading(false);
    if (__DEV__ && result.warnings.length) {
      console.warn('[catálogo] ejercicios omitidos por datos inválidos:', result.warnings);
    }
  }, [catalog]);

  useEffect(() => {
    let mounted = true;
    catalog.getLevels().then((result) => {
      if (!mounted) return;
      setLevels(result.levels);
      setSource(result.source);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [catalog]);

  const value = useMemo(
    () => ({
      levels,
      loading,
      source,
      reload,
      getLevelById: (levelId) => levels.find((item) => item.id === levelId) || null,
    }),
    [levels, loading, source, reload],
  );

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export const useCatalog = () => useContext(CatalogContext);
