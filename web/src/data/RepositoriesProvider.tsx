import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { createRepositories, type Repositories } from './repositories';

const RepositoriesContext = createContext<Repositories | null>(null);

/** Composition root del portal: los tests inyectan repositorios falsos. */
export function RepositoriesProvider({ repositories, children }: { repositories?: Repositories; children: ReactNode }) {
  const value = useMemo(() => repositories || createRepositories(supabase), [repositories]);
  return <RepositoriesContext.Provider value={value}>{children}</RepositoriesContext.Provider>;
}

export function useRepositories() {
  const value = useContext(RepositoriesContext);
  if (!value) throw new Error('useRepositories debe usarse dentro de <RepositoriesProvider>.');
  return value;
}
