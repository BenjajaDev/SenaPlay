import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import announce from '../../../core/a11y/announce';
import haptics from '../../../core/feedback/haptics';
import BlockingOverlay from './BlockingOverlay';
import ConfirmDialog from './ConfirmDialog';
import MessageDialog from './MessageDialog';
import Toast from './Toast';

// Tiempo mínimo que se muestra el overlay de bloqueo: si la operación es muy
// rápida, un parpadeo de 80 ms se percibe como un error visual.
const MIN_BLOCKING_MS = 450;

const FeedbackContext = createContext(null);

/**
 * Orquesta el feedback global con una API imperativa basada en promesas, para
 * que las pantallas no tengan que manejar `visible`/`setVisible` de cada modal:
 *
 *   const { confirm, runBlocking, notify, showMessage } = useFeedback();
 *
 *   const ok = await confirm({ title: '¿Cerrar sesión?', tone: 'danger' });
 *   if (ok) await runBlocking('Cerrando sesión…', () => auth.signOut());
 *
 * `confirm({ ..., onConfirm })` ejecuta la acción DENTRO del diálogo (botón en
 * estado cargando) y resuelve true cuando termina; si lanza, el error se
 * propaga a quien llamó.
 */
export function FeedbackProvider({ children }) {
  const [confirmState, setConfirmState] = useState(null);
  const [messageState, setMessageState] = useState(null);
  const [blockingLabel, setBlockingLabel] = useState(null);
  const [toast, setToast] = useState(null);
  const blockingCount = useRef(0);
  const toastId = useRef(0);

  const confirm = useCallback(
    (options = {}) =>
      new Promise((resolve, reject) => {
        setConfirmState({
          ...options,
          resolve: (value) => {
            setConfirmState(null);
            resolve(value);
          },
          reject: (error) => {
            setConfirmState(null);
            reject(error);
          },
        });
      }),
    [],
  );

  const showMessage = useCallback(
    (options = {}) =>
      new Promise((resolve) => {
        setMessageState({
          ...options,
          resolve: (value) => {
            setMessageState(null);
            resolve(value);
          },
        });
      }),
    [],
  );

  const runBlocking = useCallback(async (label, task) => {
    blockingCount.current += 1;
    setBlockingLabel(label || 'Cargando…');
    const startedAt = Date.now();
    try {
      return await task();
    } finally {
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_BLOCKING_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_BLOCKING_MS - elapsed));
      }
      blockingCount.current -= 1;
      if (blockingCount.current <= 0) {
        blockingCount.current = 0;
        setBlockingLabel(null);
      }
    }
  }, []);

  const notify = useCallback((options) => {
    const next = typeof options === 'string' ? { message: options } : options;
    toastId.current += 1;
    if (next.tone === 'success') haptics.success();
    else if (next.tone === 'danger') haptics.error();
    announce([next.title, next.message].filter(Boolean).join('. '));
    setToast({ tone: 'info', ...next, id: toastId.current });
  }, []);

  const hideToast = useCallback((id) => {
    setToast((current) => (current && current.id === id ? null : current));
  }, []);

  const value = useMemo(
    () => ({ confirm, showMessage, runBlocking, notify }),
    [confirm, showMessage, runBlocking, notify],
  );

  const handleConfirm = async () => {
    const state = confirmState;
    if (!state) return;
    if (!state.onConfirm) {
      state.resolve(true);
      return;
    }
    try {
      await state.onConfirm();
      state.resolve(true);
    } catch (error) {
      state.reject(error);
    }
  };

  return (
    <FeedbackContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        {children}
        <Toast toast={toast} onHide={hideToast} />
      </View>
      <ConfirmDialog
        visible={Boolean(confirmState)}
        title={confirmState?.title}
        message={confirmState?.message}
        confirmLabel={confirmState?.confirmLabel}
        cancelLabel={confirmState?.cancelLabel}
        tone={confirmState?.tone}
        icon={confirmState?.icon}
        onConfirm={handleConfirm}
        onCancel={() => confirmState?.resolve(false)}
      />
      <MessageDialog
        visible={Boolean(messageState)}
        {...(messageState || {})}
        onPrimaryPress={() => messageState?.resolve('primary')}
        onSecondaryPress={() => messageState?.resolve('secondary')}
        onRequestClose={() => messageState?.resolve('dismiss')}
      />
      <BlockingOverlay visible={Boolean(blockingLabel)} label={blockingLabel || undefined} />
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error('useFeedback debe usarse dentro de <FeedbackProvider>.');
  }
  return context;
}

/** Atajo cuando una pantalla solo necesita confirmar. */
export function useConfirm() {
  return useFeedback().confirm;
}
