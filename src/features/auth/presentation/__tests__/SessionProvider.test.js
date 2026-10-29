import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ServicesProvider } from '../../../../core/di/ServicesProvider';
import { createEventBus } from '../../../../core/events/EventBus';
import { ok } from '../../../../core/result';
import { SessionProvider, useSession } from '../SessionProvider';

const USER = { id: 'u1', user_metadata: {} };

function Probe() {
  const { status, role } = useSession();
  return <Text>{`${status}:${role}`}</Text>;
}

function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function servicesWith(profile) {
  return {
    events: createEventBus(),
    auth: {
      getSession: async () => ok({ user: USER }),
      onSessionChange: () => () => {},
    },
    profile,
  };
}

async function renderSession(services) {
  await render(
    <ServicesProvider services={services}>
      <SessionProvider>
        <Probe />
      </SessionProvider>
    </ServicesProvider>,
  );
}

describe('SessionProvider · rol al arrancar', () => {
  test('con rol guardado entra al instante y revalida en segundo plano', async () => {
    const remote = deferred();
    const profile = { getCachedRole: jest.fn(async () => 'admin'), getRole: jest.fn(() => remote.promise) };
    await renderSession(servicesWith(profile));

    expect(await screen.findByText('signedIn:admin')).toBeTruthy();
    expect(profile.getRole).toHaveBeenCalledTimes(1);

    await act(async () => remote.resolve('user'));
    expect(screen.getByText('signedIn:user')).toBeTruthy();
  });

  test('sin rol guardado espera la red (con tope) antes de marcar la sesión', async () => {
    const remote = deferred();
    const profile = { getCachedRole: jest.fn(async () => null), getRole: jest.fn(() => remote.promise) };
    await renderSession(servicesWith(profile));

    expect(screen.getByText('loading:user')).toBeTruthy();
    expect(profile.getRole).toHaveBeenCalledWith('u1', { timeoutMs: 4000 });

    await act(async () => remote.resolve('admin'));
    expect(screen.getByText('signedIn:admin')).toBeTruthy();
  });
});
