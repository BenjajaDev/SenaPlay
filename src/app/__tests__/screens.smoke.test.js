import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ServicesProvider } from '../../core/di/ServicesProvider';
import { createEventBus } from '../../core/events/EventBus';
import { ok } from '../../core/result';
import LoginScreen from '../../features/auth/presentation/LoginScreen';
import RegisterScreen from '../../features/auth/presentation/RegisterScreen';
import DictionaryTabScreen from '../../features/dictionary/presentation/DictionaryTabScreen';
import GamesTabScreen from '../../features/games/presentation/GamesTabScreen';
import { LEVELS_CATALOG } from '../../features/levels/data/local/levelsCatalog';
import { CatalogProvider } from '../../features/levels/presentation/CatalogContext';
import LevelsTabScreen from '../../features/levels/presentation/LevelsTabScreen';
import ProgressTabScreen from '../../features/progress/presentation/ProgressTabScreen';
import { DICTIONARY_ENTRIES } from '../../features/signs/data/local/dictionaryData';
import { REAL_SIGNS } from '../../features/signs/data/local/signsData';
import VideosTabScreen from '../../features/videos/presentation/VideosTabScreen';
import { LOCAL_VIDEOS } from '../../features/videos/data/MediaRepository';
import LevelBuilder from '../../features/levels/domain/LevelBuilder';
import { AppThemeProvider } from '../../shared/theme/ThemeProvider';
import { FeedbackProvider } from '../../shared/ui';

jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn(), openBrowserAsync: jest.fn() }));
jest.mock('expo-linking', () => ({ createURL: jest.fn(() => 'senaplay://auth/callback') }));
jest.mock('expo-image-picker', () => ({}));

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const levels = LEVELS_CATALOG.map((raw) => LevelBuilder.fromObject(raw).lenient().build());

// Servicios falsos inyectados por el contenedor (sin red ni Supabase).
function fakeServices(overrides = {}) {
  return {
    events: createEventBus(),
    auth: { signIn: jest.fn(async () => ok({ id: 'u1' })), signUp: jest.fn(async () => ok()) },
    profile: {},
    catalog: { getLocalLevels: () => levels, getLevels: async () => ({ levels, source: 'local', warnings: [] }) },
    progress: {},
    signs: {
      getDictionary: async () => ({ entries: DICTIONARY_ENTRIES, source: 'local' }),
      getVocabulary: async () => ({ signs: REAL_SIGNS, source: 'local' }),
    },
    media: { listVideos: async () => ({ videos: LOCAL_VIDEOS, source: 'local' }) },
    remoteConfig: {},
    ...overrides,
  };
}

async function renderWith(ui, services = fakeServices()) {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <AppThemeProvider>
        <ServicesProvider services={services}>
          <FeedbackProvider>
            <CatalogProvider>{ui}</CatalogProvider>
          </FeedbackProvider>
        </ServicesProvider>
      </AppThemeProvider>
    </SafeAreaProvider>,
  );
  return services;
}

describe('pantallas principales (smoke)', () => {
  test('login valida por campo y llama al repositorio', async () => {
    const services = await renderWith(<LoginScreen onGoToRegister={jest.fn()} onNeedPasswordReset={jest.fn()} />);
    await fireEvent.press(screen.getByText('Entrar'));
    expect(await screen.findByText('Ingresa tu correo.')).toBeTruthy();
    expect(services.auth.signIn).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Correo'), 'persona@correo.cl');
    await fireEvent.changeText(screen.getByLabelText('Contraseña'), 'secreto1');
    await fireEvent.press(screen.getByText('Entrar'));
    await waitFor(() => expect(services.auth.signIn).toHaveBeenCalledWith('persona@correo.cl', 'secreto1'));
  });

  test('registro muestra errores y no envía datos inválidos', async () => {
    const services = await renderWith(<RegisterScreen onGoToLogin={jest.fn()} onNeedVerification={jest.fn()} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByText('Ingresa tu nombre completo.')).toBeTruthy();
    expect(services.auth.signUp).not.toHaveBeenCalled();
  });

  test('tabs renderizan con datos locales', async () => {
    await renderWith(
      <>
        <LevelsTabScreen levelProgress={{ unlocked: [1], completed: {} }} onOpenLevel={jest.fn()} lives={{ config: { mode: 'session' } }} />
        <GamesTabScreen onOpenGame={jest.fn()} />
        <ProgressTabScreen levelProgress={{ unlocked: [1, 2], completed: { 1: { score: 500, hits: 5, fails: 1, stars: 2 } } }} userStats={{ streak: 0 }} />
        <VideosTabScreen />
      </>,
    );
    expect(screen.getByText('Ruta de niveles')).toBeTruthy();
    expect(screen.getByText('Memoria de señas')).toBeTruthy();
    expect(screen.getByText(`1 / ${levels.length}`)).toBeTruthy();
    expect(await screen.findByText('Vocabulario para saludos')).toBeTruthy();
  });

  test('diccionario filtra por búsqueda', async () => {
    await renderWith(<DictionaryTabScreen />);
    await fireEvent.changeText(await screen.findByLabelText('Buscar en el diccionario'), 'zzzz');
    expect(await screen.findByText('Sin resultados')).toBeTruthy();
  });
});
