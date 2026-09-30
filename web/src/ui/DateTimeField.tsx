import { AlertCircle, CalendarClock, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { formatDateTime, isoToLocalParts, localPartsToIso, utcOffsetLabel } from '@/lib/datetime';
import { Button } from './Button';

type Props = {
  label: string;
  /** Instante ISO (UTC) o null si no hay fecha. */
  value: string | null | undefined;
  onChange: (iso: string | null) => void;
  /** Hora que se usa si eligen la fecha sin hora (ej. '23:59' para un «hasta»). */
  defaultTime?: string;
  hint?: string;
  error?: string | null;
};

/**
 * Fecha + hora en dos campos nativos separados (más fáciles de usar que
 * `datetime-local`, que en varios navegadores obliga a completar todo de una
 * vez y se borra si falta un segmento). Trabaja en hora local y entrega ISO
 * en UTC; debajo muestra la fecha en palabras y la zona horaria para que no
 * haya dudas de cuándo se activa.
 */
export function DateTimeField({ label, value, onChange, defaultTime = '00:00', hint, error }: Props) {
  const id = useId();
  const [parts, setParts] = useState(() => isoToLocalParts(value));
  // Último valor que emitimos: si el padre nos devuelve el mismo, no se pisa
  // lo que el usuario está escribiendo.
  const emitted = useRef<string | null | undefined>(value);

  useEffect(() => {
    if (value !== emitted.current) {
      setParts(isoToLocalParts(value));
      emitted.current = value;
    }
  }, [value]);

  const update = (next: { date: string; time: string }) => {
    setParts(next);
    const iso = next.date ? localPartsToIso(next.date, next.time, defaultTime) : null;
    // Una fecha a medio escribir no se emite: el campo la conserva hasta completarla.
    if (next.date && !iso) return;
    emitted.current = iso;
    onChange(iso);
  };

  const summary = value ? `${formatDateTime(value)} · hora local (${utcOffsetLabel(new Date(value))})` : null;
  const describedBy = `${id}-desc`;

  return (
    <fieldset className="datetime-field" aria-describedby={describedBy} aria-invalid={Boolean(error) || undefined}>
      <legend className="field__label">{label}</legend>
      <div className="datetime-field__row">
        <CalendarClock size={18} aria-hidden className="datetime-field__icon" />
        <input
          className="input"
          type="date"
          aria-label={`${label}: fecha`}
          value={parts.date}
          onChange={(event) => update({ date: event.target.value, time: parts.time || defaultTime })}
        />
        <input
          className="input datetime-field__time"
          type="time"
          step={60}
          aria-label={`${label}: hora`}
          value={parts.time}
          disabled={!parts.date}
          onChange={(event) => update({ ...parts, time: event.target.value })}
        />
        {parts.date ? (
          <Button variant="ghost" size="sm" icon={X} aria-label={`Quitar ${label.toLocaleLowerCase('es')}`} onClick={() => update({ date: '', time: '' })} />
        ) : null}
      </div>
      {error ? (
        <span className="field__error" id={describedBy} role="alert">
          <AlertCircle size={14} aria-hidden /> {error}
        </span>
      ) : (
        <span className="field__hint" id={describedBy}>
          {summary || hint || 'Sin fecha.'}
        </span>
      )}
    </fieldset>
  );
}
