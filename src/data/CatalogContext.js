import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { fetchCatalog } from '../../backend/catalog';
import { LEVELS_CATALOG } from './levelsConfig';

// Provee el catalogo de niveles a toda la app. Arranca con el catalogo local
// (respaldo offline) y lo reemplaza por el de Supabase en cuanto carga.
const CatalogContext = createContext({
  levels: LEVELS_CATALOG,
  loading: true,
  source: 'local',
  getLevelById: () => null,
});

export function CatalogProvider({ children }) {
  const [levels, setLevels] = useState(LEVELS_CATALOG);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState('local');

  useEffect(() => {
    let mounted = true;
    fetchCatalog().then((result) => {
      if (!mounted) return;
      setLevels(result.levels);
      setSource(result.source);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      levels,
      loading,
      source,
      getLevelById: (levelId) => levels.find((item) => item.id === levelId) || null,
    }),
    [levels, loading, source],
  );

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export const useCatalog = () => useContext(CatalogContext);
