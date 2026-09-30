import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { isoToLocalParts, localPartsToIso, rangeError } from '@/lib/datetime';
import { DateTimeField, Dialog, TextField } from '@/ui';

describe('Dialog', () => {
  test('escribir en un campo no mueve el foco al primero (onClose nuevo en cada render)', async () => {
    const user = userEvent.setup();
    function Editor() {
      const [form, setForm] = useState({ title: '', description: '' });
      // onClose inline a propósito: así lo usan las páginas del panel.
      return (
        <Dialog open title="Editar" onClose={() => setForm({ title: '', description: '' })}>
          <TextField label="Título" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <TextField label="Descripción" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Dialog>
      );
    }
    render(<Editor />);
    await user.click(screen.getByLabelText('Descripción'));
    await user.keyboard('Video de saludos');
    expect(screen.getByLabelText('Descripción')).toHaveValue('Video de saludos');
    expect(screen.getByLabelText('Título')).toHaveValue('');
  });
});

describe('fechas y horas del panel', () => {
  test('ida y vuelta en hora local sin correrse', () => {
    const iso = localPartsToIso('2026-09-29', '15:30');
    expect(iso).not.toBeNull();
    expect(isoToLocalParts(iso)).toEqual({ date: '2026-09-29', time: '15:30' });
    // Guardar otra vez lo mismo no cambia el instante (antes se corría 3–4 h).
    const again = isoToLocalParts(iso);
    expect(localPartsToIso(again.date, again.time)).toBe(iso);
  });

  test('sin hora usa la hora por defecto; fechas imposibles o vacías no se aceptan', () => {
    expect(isoToLocalParts(localPartsToIso('2026-12-31', '', '23:59'))).toEqual({ date: '2026-12-31', time: '23:59' });
    expect(localPartsToIso('2026-02-31', '10:00')).toBeNull();
    expect(localPartsToIso('', '10:00')).toBeNull();
    expect(isoToLocalParts('no-es-fecha')).toEqual({ date: '', time: '' });
  });

  test('valida que el fin sea posterior al inicio', () => {
    const start = localPartsToIso('2026-10-01', '10:00');
    expect(rangeError(start, localPartsToIso('2026-10-01', '09:00'))).toMatch(/posterior/);
    expect(rangeError(start, localPartsToIso('2026-10-02', '09:00'))).toBeNull();
    expect(rangeError(null, start)).toBeNull();
  });

  test('DateTimeField emite ISO al elegir fecha y hora, y null al quitarla', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    function Harness() {
      const [value, setValue] = useState<string | null>(null);
      return (
        <DateTimeField
          label="Desde"
          value={value}
          onChange={(iso) => {
            onChange(iso);
            setValue(iso);
          }}
        />
      );
    }
    render(<Harness />);
    const date = screen.getByLabelText('Desde: fecha');
    await user.type(date, '2026-10-05');
    expect(isoToLocalParts(onChange.mock.lastCall?.[0])).toEqual({ date: '2026-10-05', time: '00:00' });

    const time = screen.getByLabelText('Desde: hora');
    await user.clear(time);
    await user.type(time, '18:45');
    expect(isoToLocalParts(onChange.mock.lastCall?.[0])).toEqual({ date: '2026-10-05', time: '18:45' });
    expect(screen.getByText(/hora local \(UTC/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Quitar desde' }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
