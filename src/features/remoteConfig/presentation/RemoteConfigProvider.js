import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import env from '../../../core/config/env';
import { useServices } from '../../../core/di/ServicesProvider';
import { APP_EVENTS } from '../../../core/events/EventBus';
import { setHapticsEnabled } from '../../../core/feedback/haptics';
import {
  DEFAULT_FLAGS,
  DEFAULT_REMOTE_CONFIG,
  evaluateFlags,
  evaluateRemoteState,
  mergeRemoteConfig,
} from '../domain/remoteConfig';

// Al volver la app a primer plano se refresca, pero no más seguido que esto.
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const RemoteConfigContext = createContext({
  status: 'ready',
  config: DEFAULT_REMOTE_CONFIG,
  flags: DEFAULT_FLAGS,
  remoteState: { gate: null, updateAvailable: false, announcements: [] },
  isEnabled: (key) => DEFAULT_FLAGS[key] ?? false,
  refresh: async () => {},
});

/**
 * Expone la configuración remota a toda la app.
 *
 * Estrategia "stale-while-revalidate": arranca con la última configuración
 * guardada (o los defaults) sin esperar a la red, y refresca en segundo
 * plano al montar y al volver a primer plano. Cada cambio se publica en el
 * bus como REMOTE_CONFIG_UPDATED (Observer) para servicios no-React.
 */
export function RemoteConfigProvider({ userId, isAdmin = false, children }) {
  const { remoteConfig: repository, events } = useServices();
  const [snapshot, setSnapshot] = useState(null);
  const [status, setStatus] = useState('loading');
  const lastFetchRef = useRef(0);

  const refresh = useCallback(async () => {
    lastFetchRef.current = Date.now();
    const next = await repository.fetch();
    setSnapshot(next);
    setStatus('ready');
  }, [repository]);

  useEffect(() => {
    let mounted = true;
    repository.getCached().then((cached) => {
      if (!mounted) return;
      if (cached) {
        setSnapshot(cached);
        setStatus('ready');
      }
    });
    refresh().catch(() => setStatus('ready'));

    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active' && Date.now() - lastFetchRef.current > REFRESH_INTERVAL_MS) {
        refresh().catch(() => {});
      }
    });
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [repository, refresh]);

  const value = useMemo(() => {
    const config = mergeRemoteConfig(snapshot?.configRows);
    const flags = evaluateFlags(snapshot?.flagRows, { userId });
    const remoteState = evaluateRemoteState(config, { appVersion: env.appVersion, isAdmin });
    return {
      status,
      config,
      flags,
      remoteState,
      isEnabled: (key) => Boolean(flags[key]),
      refresh,
    };
  }, [snapshot, status, userId, isAdmin, refresh]);

  useEffect(() => {
    setHapticsEnabled(value.flags['feedback.haptics'] !== false);
    events.emit(APP_EVENTS.REMOTE_CONFIG_UPDATED, { config: value.config, flags: value.flags });
  }, [value.config, value.flags, events]);

  return <RemoteConfigContext.Provider value={value}>{children}</RemoteConfigContext.Provider>;
}

export function useRemoteConfig() {
  return useContext(RemoteConfigContext);
}

export function useFeatureFlag(key) {
  return useContext(RemoteConfigContext).isEnabled(key);
}
