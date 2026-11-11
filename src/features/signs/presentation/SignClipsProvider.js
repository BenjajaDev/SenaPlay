import { createContext, useContext, useMemo } from 'react';
import useStaleWhileRevalidate from '../../../core/data/useStaleWhileRevalidate';
import { useServices } from '../../../core/di/ServicesProvider';
import { useFeatureFlag } from '../../remoteConfig/presentation/RemoteConfigProvider';
import { getSignAssets } from '../data/local/signAssets';
import { groupClipsByKey, resolveSignMedia, toSignKey } from '../domain/signMedia';

// Clips publicados para toda la app. Se cargan una vez (caché → remoto) para
// que SignImage resuelva qué mostrar sin esperar ni repetir consultas en cada
// casilla. Sin el provider (pruebas, pantallas aisladas) no hay clips.
const SignClipsContext = createContext({ clipsByKey: {}, enabled: false, clipFor: () => null });

const EMPTY = { clips: [], source: 'local' };

export function SignClipsProvider({ children }) {
  const { signClips } = useServices();
  const enabled = useFeatureFlag('signs.clips');
  const { data } = useStaleWhileRevalidate(signClips.getCachedClips, signClips.listClips, EMPTY);
  const clipsByKey = useMemo(() => groupClipsByKey(data.clips), [data.clips]);
  const value = useMemo(
    () => ({
      clipsByKey,
      enabled,
      // Primer clip de una seña, o null (también con el flag apagado).
      clipFor: (signKey) => (enabled ? clipsByKey[toSignKey(signKey)]?.[0] || null : null),
    }),
    [clipsByKey, enabled],
  );
  return <SignClipsContext.Provider value={value}>{children}</SignClipsContext.Provider>;
}

/** Clips cargados y si están habilitados: { clipsByKey, enabled, clipFor(signKey) }. */
export const useSignClips = () => useContext(SignClipsContext);

/** Qué mostrar para una seña: { kind: 'clip' | 'still' | 'placeholder', … } (ver signMedia). */
export function useSignMedia(signKey, label) {
  const { clipsByKey, enabled } = useContext(SignClipsContext);
  return useMemo(
    () => resolveSignMedia({ signKey, clipsByKey, stills: getSignAssets(signKey), clipsEnabled: enabled, label }),
    [signKey, clipsByKey, enabled, label],
  );
}
