import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import useStaleWhileRevalidate from '../data/useStaleWhileRevalidate';

function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function setup(initial) {
  const cached = deferred();
  const fresh = deferred();
  const readCached = () => cached.promise;
  const readFresh = () => fresh.promise;
  let renders = 0;
  function Probe() {
    const { data, loading } = useStaleWhileRevalidate(readCached, readFresh, initial);
    renders += 1;
    return <Text>{`${data?.value ?? 'nada'}:${loading ? 'cargando' : 'listo'}`}</Text>;
  }
  return { cached, fresh, Probe, renders: () => renders };
}

describe('useStaleWhileRevalidate', () => {
  test('muestra lo local, luego la caché y al final lo fresco', async () => {
    const { cached, fresh, Probe } = setup({ value: 'local' });
    await render(<Probe />);
    expect(screen.getByText('local:cargando')).toBeTruthy();
    await act(async () => cached.resolve({ value: 'cache' }));
    expect(screen.getByText('cache:cargando')).toBeTruthy();
    await act(async () => fresh.resolve({ value: 'remoto' }));
    expect(screen.getByText('remoto:listo')).toBeTruthy();
  });

  test('si lo fresco llega antes, la caché tardía no lo pisa', async () => {
    const { cached, fresh, Probe } = setup(null);
    await render(<Probe />);
    expect(screen.getByText('nada:cargando')).toBeTruthy();
    await act(async () => fresh.resolve({ value: 'remoto' }));
    await act(async () => cached.resolve({ value: 'cache' }));
    expect(screen.getByText('remoto:listo')).toBeTruthy();
  });

  test('no vuelve a renderizar cuando lo fresco es igual a la caché mostrada', async () => {
    const { cached, fresh, Probe, renders } = setup(null);
    await render(<Probe />);
    await act(async () => cached.resolve({ value: 'igual' }));
    const afterCache = renders();
    await act(async () => fresh.resolve({ value: 'igual' }));
    // Solo cambia `loading` (un render), no el contenido.
    expect(renders()).toBe(afterCache + 1);
    expect(screen.getByText('igual:listo')).toBeTruthy();
  });
});
