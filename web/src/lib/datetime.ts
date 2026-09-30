/**
 * Conversión entre instantes ISO (lo que se guarda en Supabase, en UTC) y lo
 * que el editor ve en los campos: fecha y hora LOCALES del navegador.
 *
 * El error anterior: se mostraba `iso.slice(0, 16)` (hora UTC) pero al
 * guardar se leía como hora local, así que en Chile cada guardado corría la
 * hora 3–4 horas y el campo «saltaba» mientras se editaba.
 */

const pad = (value: number) => String(value).padStart(2, '0');

/** ISO → { date: 'AAAA-MM-DD', time: 'HH:mm' } en hora local; vacío si no hay fecha válida. */
export function isoToLocalParts(iso: string | null | undefined): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { date: '', time: '' };
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

/** Fecha y hora locales → ISO (UTC). Sin fecha → null. Sin hora → `fallbackTime`. */
export function localPartsToIso(date: string, time: string, fallbackTime = '00:00'): string | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
  if (!dateMatch) return null;
  const timeMatch = /^(\d{2}):(\d{2})/.exec(time || fallbackTime) || /^(\d{2}):(\d{2})/.exec(fallbackTime);
  const [, y, m, d] = dateMatch.map(Number);
  const [, hh, mm] = (timeMatch || ['', '0', '0']).map(Number);
  const local = new Date(y, m - 1, d, hh, mm, 0, 0);
  // Rechaza fechas imposibles (31 de febrero) que Date «corrige» sola.
  if (local.getFullYear() !== y || local.getMonth() !== m - 1 || local.getDate() !== d) return null;
  return local.toISOString();
}

/** «UTC−03:00» para la zona horaria del navegador en esa fecha (cambia con el horario de verano). */
export function utcOffsetLabel(at: Date = new Date()): string {
  const minutes = -at.getTimezoneOffset();
  const sign = minutes >= 0 ? '+' : '−';
  const abs = Math.abs(minutes);
  return `UTC${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** «martes 29 de septiembre de 2026, 15:00» (hora local). */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Mensaje de error si el fin queda antes (o igual) que el inicio. */
export function rangeError(start: string | null | undefined, end: string | null | undefined): string | null {
  if (!start || !end) return null;
  return new Date(end).getTime() <= new Date(start).getTime() ? 'Debe ser posterior al inicio.' : null;
}
