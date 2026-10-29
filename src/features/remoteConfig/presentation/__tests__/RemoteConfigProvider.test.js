import { act, render } from '@testing-library/react-native';
import { AppState, Text } from 'react-native';
import { ServicesProvider } from '../../../../core/di/ServicesProvider';
import { createEventBus } from '../../../../core/events/EventBus';
import { RemoteConfigProvider } from '../RemoteConfigProvider';

const SNAPSHOT = { configRows: [], flagRows: [], fetchedAt: 1, source: 'remote' };

function setup() {
  let realtime = null;
  const repository = {
    getCached: jest.fn(async () => null),
    fetch: jest.fn(async () => SNAPSHOT),
    subscribe: jest.fn((onChange, onConnectionChange) => {
      realtime = { onChange, onConnectionChange };
      return () => {};
    }),
  };
  const services = { events: createEventBus(), remoteConfig: repository };
  return { repository, services, realtime: () => realtime };
}

async function mount(services) {
  await render(
    <ServicesProvider services={services}>
      <RemoteConfigProvider userId="u1">
        <Text>app</Text>
      </RemoteConfigProvider>
    </ServicesProvider>,
  );
}

describe('RemoteConfigProvider · sondeo', () => {
  // En Jest, AppState.currentState es un mock sin valor: se fija «active».
  const original = AppState.currentState;

  beforeEach(() => {
    jest.useFakeTimers();
    AppState.currentState = 'active';
  });

  afterEach(() => {
    AppState.currentState = original;
    jest.useRealTimers();
  });

  test('con Realtime conectado no sondea; con el canal caído sí', async () => {
    const { repository, services, realtime } = setup();
    await mount(services);
    expect(repository.fetch).toHaveBeenCalledTimes(1);

    await act(async () => realtime().onConnectionChange(true));
    await act(async () => jest.advanceTimersByTimeAsync(30 * 1000));
    expect(repository.fetch).toHaveBeenCalledTimes(1);

    await act(async () => realtime().onConnectionChange(false));
    await act(async () => jest.advanceTimersByTimeAsync(30 * 1000));
    expect(repository.fetch).toHaveBeenCalledTimes(2);
  });

  test('al conectar justo después de consultar no repite; un cambio del panel sí refresca', async () => {
    const { repository, services, realtime } = setup();
    await mount(services);

    await act(async () => realtime().onChange('reconnected'));
    await act(async () => jest.advanceTimersByTimeAsync(500));
    expect(repository.fetch).toHaveBeenCalledTimes(1);

    await act(async () => realtime().onChange('changed'));
    await act(async () => jest.advanceTimersByTimeAsync(500));
    expect(repository.fetch).toHaveBeenCalledTimes(2);
  });
});
