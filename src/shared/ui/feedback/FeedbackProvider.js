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

// Un diálogo cerrado conserva sus opciones: el Modal se desvanece unos
// cientos de ms y, si se vaciaran al cerrar, se vería perder título, mensaje
// y color justo mientras desaparece.
const CLOSED = { open: false, options: null };

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
  const [confirmState, setConfirmState] = useState(CLOSED);
  const [messageState, setMessageState] = useState(CLOSED);
  const [blockingLabel, setBlockingLabel] = useState(null);
  const [toast, setToast] = useState(null);
  const blockingCount = useRef(0);
  const toastId = useRef(0);

  const confirm = useCallback(
    (options = {}) =>
      new Promise((resolve, reject) => {
        const close = () => setConfirmState((prev) => ({ ...prev, open: false }));
        setConfirmState({
          open: true,
          options: {
            ...options,
            resolve: (value) => {
              close();
              resolve(value);
            },
            reject: (error) => {
              close();
              reject(error);
            },
          },
        });
      }),
    [],
  );

  const showMessage = useCallback(
    (options = {}) =>
      new Promise((resolve) => {
        setMessageState({
          open: true,
          options: {
            ...options,
            resolve: (value) => {
              setMessageState((prev) => ({ ...prev, open: false }));
              resolve(value);
            },
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

  const confirmOptions = confirmState.options;
  const messageOptions = messageState.options;
  // Solo el diálogo abierto responde: un toque durante el desvanecimiento no
  // vuelve a resolver una promesa ya resuelta.
  const answerMessage = (value) => messageState.open && messageOptions?.resolve(value);

  const handleConfirm = async () => {
    const state = confirmState.open ? confirmOptions : null;
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
        visible={confirmState.open}
        title={confirmOptions?.title}
        message={confirmOptions?.message}
        confirmLabel={confirmOptions?.confirmLabel}
        cancelLabel={confirmOptions?.cancelLabel}
        tone={confirmOptions?.tone}
        icon={confirmOptions?.icon}
        onConfirm={handleConfirm}
        onCancel={() => confirmState.open && confirmOptions?.resolve(false)}
      />
      <MessageDialog
        visible={messageState.open}
        {...(messageOptions || {})}
        onPrimaryPress={() => answerMessage('primary')}
        onSecondaryPress={() => answerMessage('secondary')}
        onRequestClose={() => answerMessage('dismiss')}
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
