import { createContext, useContext, useMemo } from 'react';
import useStaleWhileRevalidate from '../../../core/data/useStaleWhileRevalidate';
import { useServices } from '../../../core/di/ServicesProvider';
import { numerarNiveles } from '../domain/levelProgress';

// Provee el catálogo de niveles a toda la app. Arranca con el catálogo
// empaquetado (instantáneo), lo reemplaza por el último guardado en el
// dispositivo y luego por el remoto, sin re-renderizar si no cambió nada.
const CatalogContext = createContext({
  levels: [],
  loading: true,
  source: 'local',
  getLevelById: () => null,
  getLevelNumber: (levelId) => levelId,
});

export function CatalogProvider({ children }) {
  const { catalog } = useServices();
  const { data, loading } = useStaleWhileRevalidate(catalog.getCachedLevels, catalog.getLevels, () => ({
    levels: catalog.getLocalLevels(),
    source: 'local',
    warnings: [],
  }));

  const value = useMemo(() => {
    const numbers = numerarNiveles(data.levels);
    return {
      levels: data.levels,
      loading,
      source: data.source,
      getLevelById: (levelId) => data.levels.find((item) => item.id === levelId) || null,
      // Número visible por posición en el catálogo; el id queda como respaldo.
      getLevelNumber: (levelId) => numbers.get(levelId) ?? levelId,
    };
  }, [data, loading]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export const useCatalog = () => useContext(CatalogContext);
