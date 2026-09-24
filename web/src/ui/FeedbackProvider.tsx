import { AlertCircle, CheckCircle2, Info, XCircle, type LucideIcon } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from './Button';
import { Dialog, type DialogTone } from './Dialog';
import { Spinner } from './Display';

type ConfirmOptions = {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DialogTone;
  icon?: LucideIcon;
  /** Si se pasa, se ejecuta DENTRO del diálogo (botón en estado cargando). */
  onConfirm?: () => Promise<void> | void;
};

type ToastTone = 'info' | 'success' | 'warning' | 'danger';
type Toast = { id: number; tone: ToastTone; title?: string; message: string };

type FeedbackApi = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  runBlocking: <T>(label: string, task: () => Promise<T>) => Promise<T>;
  notify: (toast: Omit<Toast, 'id' | 'tone'> & { tone?: ToastTone }) => void;
};

const FeedbackContext = createContext<FeedbackApi | null>(null);
const MIN_BLOCKING_MS = 400;
const TOAST_ICON: Record<ToastTone, LucideIcon> = { info: Info, success: CheckCircle2, warning: AlertCircle, danger: XCircle };

/**
 * Misma API que el FeedbackProvider de la app móvil:
 *   const ok = await confirm({ title: '¿Eliminar nivel?', tone: 'danger', onConfirm: borrar });
 *   await runBlocking('Guardando…', guardar);
 *   notify({ tone: 'success', message: 'Cambios guardados' });
 *
 * Regla del panel: ninguna acción destructiva o que publique cambios se
 * ejecuta sin pasar por confirm().
 */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void; reject: (e: unknown) => void }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [blockingLabel, setBlockingLabel] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const blockingCount = useRef(0);

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve, reject) => setConfirmState({ ...options, resolve, reject })),
    [],
  );

  const runBlocking = useCallback(async <T,>(label: string, task: () => Promise<T>) => {
    blockingCount.current += 1;
    setBlockingLabel(label);
    const started = Date.now();
    try {
      return await task();
    } finally {
      const elapsed = Date.now() - started;
      if (elapsed < MIN_BLOCKING_MS) await new Promise((r) => setTimeout(r, MIN_BLOCKING_MS - elapsed));
      blockingCount.current = Math.max(0, blockingCount.current - 1);
      if (!blockingCount.current) setBlockingLabel(null);
    }
  }, []);

  const notify = useCallback<FeedbackApi['notify']>((toast) => {
    toastId.current += 1;
    const id = toastId.current;
    setToasts((prev) => [...prev.slice(-2), { tone: 'info', ...toast, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((item) => item.id !== id)), 3600);
  }, []);

  const api = useMemo(() => ({ confirm, runBlocking, notify }), [confirm, runBlocking, notify]);

  const close = (value: boolean) => {
    confirmState?.resolve(value);
    setConfirmState(null);
  };

  const handleConfirm = async () => {
    if (!confirmState) return;
    if (!confirmState.onConfirm) return close(true);
    try {
      setBusy(true);
      await confirmState.onConfirm();
      close(true);
    } catch (error) {
      confirmState.reject(error);
      setConfirmState(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FeedbackContext.Provider value={api}>
      {children}

      <Dialog
        open={Boolean(confirmState)}
        tone={confirmState?.tone || 'warning'}
        icon={confirmState?.icon}
        title={confirmState?.title || ''}
        message={confirmState?.message}
        dismissible={!busy}
        onClose={() => close(false)}
        actions={
          <>
            <Button variant="secondary" onClick={() => close(false)} disabled={busy}>
              {confirmState?.cancelLabel || 'Cancelar'}
            </Button>
            <Button variant={confirmState?.tone === 'danger' ? 'danger' : 'primary'} onClick={handleConfirm} loading={busy}>
              {confirmState?.confirmLabel || 'Confirmar'}
            </Button>
          </>
        }
      />

      {blockingLabel ? (
        <div className="blocking-overlay" role="alertdialog" aria-modal="true" aria-label={blockingLabel}>
          <div className="blocking-card">
            <Spinner label={blockingLabel} />
          </div>
        </div>
      ) : null}

      <div className="toast-region" aria-live="polite">
        {toasts.map((toast) => {
          const Icon = TOAST_ICON[toast.tone];
          const accent = `var(--color-${toast.tone === 'danger' ? 'danger' : toast.tone})`;
          return (
            <div key={toast.id} className="toast" role={toast.tone === 'danger' ? 'alert' : 'status'} style={{ ['--toast-accent' as string]: accent }}>
              <Icon size={20} color={accent} aria-hidden />
              <div>
                {toast.title ? <strong style={{ display: 'block' }}>{toast.title}</strong> : null}
                <span className="text-secondary text-small">{toast.message}</span>
              </div>
            </div>
          );
        })}
      </div>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error('useFeedback debe usarse dentro de <FeedbackProvider>.');
  return context;
}
