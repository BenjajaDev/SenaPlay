import { createContext, useContext, useMemo } from 'react';
import { createAuthRepository } from '../../features/auth/data/SupabaseAuthRepository';
import { createCatalogRepository } from '../../features/levels/data/CatalogRepository';
import { LEVELS_CATALOG } from '../../features/levels/data/local/levelsCatalog';
import { createProfileRepository } from '../../features/profile/data/SupabaseProfileRepository';
import { createMistakesRepository } from '../../features/progress/data/MistakesRepository';
import { createProgressRepository } from '../../features/progress/data/ProgressRepository';
import { createRemoteConfigRepository } from '../../features/remoteConfig/data/RemoteConfigRepository';
import { DICTIONARY_ENTRIES } from '../../features/signs/data/local/dictionaryData';
import { REAL_SIGNS } from '../../features/signs/data/local/signsData';
import { createSignsRepository } from '../../features/signs/data/SignsRepository';
import { createMediaRepository } from '../../features/videos/data/MediaRepository';
import { appEvents } from '../events/EventBus';
import { jsonStorage } from '../storage/jsonStorage';
import { supabase as defaultSupabase } from '../supabase/client';

/**
 * Composition root: el ÚNICO lugar donde se eligen las implementaciones
 * concretas (Supabase, AsyncStorage). El resto de la app pide los servicios
 * por contrato con `useServices()`.
 *
 * Beneficios: los tests inyectan repositorios falsos sin mockear módulos, y
 * cambiar de backend es tocar solo este archivo.
 */
export function createServices({ supabase = defaultSupabase, storage = jsonStorage, events = appEvents } = {}) {
  return {
    events,
    auth: createAuthRepository(supabase),
    profile: createProfileRepository(supabase),
    catalog: createCatalogRepository({ supabase, storage, localLevels: LEVELS_CATALOG }),
    progress: createProgressRepository({ storage }),
    mistakes: createMistakesRepository({ supabase, storage }),
    signs: createSignsRepository({
      supabase,
      storage,
      localDictionary: DICTIONARY_ENTRIES,
      localVocabulary: REAL_SIGNS,
    }),
    media: createMediaRepository({ supabase, storage }),
    remoteConfig: createRemoteConfigRepository({ supabase, storage }),
  };
}

const ServicesContext = createContext(null);

export function ServicesProvider({ services, children }) {
  const value = useMemo(() => services || createServices(), [services]);
  return <ServicesContext.Provider value={value}>{children}</ServicesContext.Provider>;
}

export function useServices() {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('useServices debe usarse dentro de <ServicesProvider>.');
  return services;
}
