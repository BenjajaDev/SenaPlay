import { useCallback, useEffect, useRef, useState } from 'react';
import { useServices } from '../../../core/di/ServicesProvider';
import { APP_EVENTS } from '../../../core/events/EventBus';
import { completeLevel, DEFAULT_LEVEL_PROGRESS } from '../../levels/domain/levelProgress';
import { useRemoteConfig } from '../../remoteConfig/presentation/RemoteConfigProvider';
import { consumeLives, livesForSession, refillLives, resolveLivesConfig } from '../domain/livesPolicy';

/**
 * Estado de progreso del usuario (niveles, racha y vidas) con persistencia.
 *
 * Además escucha el bus de eventos (Observer): cuando una sesión de nivel
 * emite LEVEL_COMPLETED o LIFE_LOST, este hook actualiza y guarda el progreso
 * sin que la pantalla del nivel conozca el almacenamiento.
 */
export default function useUserProgress(userId) {
  const { progress: repository, events } = useServices();
  const { config } = useRemoteConfig();
  const [levelProgress, setLevelProgress] = useState(null);
  const [stats, setStats] = useState(null);
  const [livesState, setLivesState] = useState(null);
  const [now, setNow] = useState(Date.now());
  const loaded = useRef(false);
  const livesConfig = resolveLivesConfig(config.lives);

  useEffect(() => {
    if (!userId) return undefined;
    loaded.current = false;
    let mounted = true;
    Promise.all([
      repository.getLevelProgress(userId),
      repository.recordDailyActivity(userId),
      repository.getLivesState(userId),
    ]).then(([progress, nextStats, lives]) => {
      if (!mounted) return;
      loaded.current = true;
      setLevelProgress(progress);
      setStats(nextStats);
      setLivesState(lives);
    });
    return () => {
      mounted = false;
    };
  }, [userId, repository]);

  // Reloj para la cuenta regresiva de recarga de vidas (solo en modo pool).
  useEffect(() => {
    if (livesConfig.mode !== 'pool') return undefined;
    const timer = setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => clearInterval(timer);
  }, [livesConfig.mode]);

  const recordCompletion = useCallback(
    (result, nextLevel) => {
      setLevelProgress((prev) => {
        const next = completeLevel(prev ?? DEFAULT_LEVEL_PROGRESS, result, nextLevel);
        if (userId && loaded.current) repository.saveLevelProgress(userId, next);
        return next;
      });
    },
    [repository, userId],
  );

  const spendLives = useCallback(
    (amount) => {
      if (livesConfig.mode !== 'pool' || amount <= 0) return;
      setLivesState((prev) => {
        const next = consumeLives(prev, amount, livesConfig, Date.now());
        repository.saveLivesState(userId, next);
        return next;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [repository, userId, livesConfig.mode, livesConfig.maxLives, livesConfig.refillMinutes],
  );

  useEffect(() => {
    const offCompleted = events.on(APP_EVENTS.LEVEL_COMPLETED, ({ result, nextLevel }) => recordCompletion(result, nextLevel));
    const offLife = events.on(APP_EVENTS.LIFE_LOST, ({ amount = 1 } = {}) => spendLives(amount));
    return () => {
      offCompleted();
      offLife();
    };
  }, [events, recordCompletion, spendLives]);

  const pool = refillLives(livesState, livesConfig, now);

  return {
    levelProgress: levelProgress ?? DEFAULT_LEVEL_PROGRESS,
    isLoaded: levelProgress !== null,
    stats,
    lives: {
      config: livesConfig,
      available: livesForSession(livesState, livesConfig, now),
      nextRefillAt: livesConfig.mode === 'pool' ? pool.nextRefillAt : null,
    },
  };
}
