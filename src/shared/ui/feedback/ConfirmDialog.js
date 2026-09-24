import { useState } from 'react';
import { View } from 'react-native';
import Button from '../Button';
import Dialog from './Dialog';

/**
 * Confirmación de acciones críticas (cerrar sesión, guardar edición,
 * eliminar, salir de un nivel a medias, canjes). Regla del producto: ninguna
 * acción crítica se ejecuta sin pasar por aquí.
 *
 * Si `onConfirm` devuelve una promesa, el botón muestra "cargando" y el
 * diálogo no se puede cerrar hasta que termine — evita dobles envíos y que el
 * usuario crea que la acción no hizo nada.
 *
 * Normalmente no se usa directo: pide confirmación con `useConfirm()`.
 */
export default function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'warning',
  icon,
  onConfirm,
  onCancel,
}) {
  const [busy, setBusy] = useState(false);
  const destructive = tone === 'danger';

  const handleConfirm = async () => {
    try {
      setBusy(true);
      await onConfirm?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      visible={visible}
      tone={tone}
      icon={icon}
      title={title}
      message={message}
      dismissible={!busy}
      onRequestClose={onCancel}
      actions={
        <>
          <View style={{ flex: 1 }}>
            <Button label={cancelLabel} variant="secondary" onPress={onCancel} disabled={busy} />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label={confirmLabel}
              variant={destructive ? 'danger' : 'primary'}
              onPress={handleConfirm}
              loading={busy}
            />
          </View>
        </>
      }
    />
  );
}
