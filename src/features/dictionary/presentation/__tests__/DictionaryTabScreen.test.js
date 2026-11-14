import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ServicesProvider } from '../../../../core/di/ServicesProvider';
import { AppThemeProvider } from '../../../../shared/theme/ThemeProvider';
import { DICTIONARY_ENTRIES } from '../../../signs/data/local/dictionaryData';
import { CLUB_SOURCE } from '../../../signs/domain/clubDictionary';
import DictionaryTabScreen from '../DictionaryTabScreen';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

const club = (word, theme) => ({ word, theme, type: 'Seña', meaning: null, howTo: null, page: null, source: CLUB_SOURCE });
const VOCABULARY = [
  club('2', 'Números'),
  club('Perro', 'Animales'),
  club('1', 'Números'),
  club('Buenos días', 'Saludos'),
  club('Hola', 'Saludos'),
  { word: 'ABEJA', type: 'Sustantivo', meaning: 'Insecto que produce miel.', howTo: null, theme: 'Animales', page: 21, source: null },
];

const services = {
  signs: {
    getDictionary: async () => ({ entries: DICTIONARY_ENTRIES, source: 'local' }),
    getCachedDictionary: async () => null,
    getVocabulary: async () => ({ signs: VOCABULARY, source: 'remote' }),
    getCachedVocabulary: async () => null,
  },
};

const renderScreen = () =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <AppThemeProvider>
        <ServicesProvider services={services}>
          <DictionaryTabScreen />
        </ServicesProvider>
      </AppThemeProvider>
    </SafeAreaProvider>,
  );

const headers = () => screen.getAllByRole('header').map((node) => node.props.accessibilityLabel).filter(Boolean);

describe('DictionaryTabScreen', () => {
  test('deletreo: el abecedario y las acciones en secciones, sin números deletreados', async () => {
    await renderScreen();
    expect(await screen.findByLabelText('Abecedario, 27 señas')).toBeTruthy();
    expect(screen.queryByText('UNO (1)')).toBeNull();
    expect(screen.queryByText('Números')).toBeNull();
  });

  test('señas reales: por tema en el orden del curso, y dentro del tema en el orden del club', async () => {
    await renderScreen();
    await act(async () => fireEvent.press(await screen.findByText('Señas reales')));
    expect(await screen.findByLabelText('Saludos, 2 señas')).toBeTruthy();
    // La lista virtualiza: se compara el orden de lo que ya está en pantalla (el resto lo cubre vocabulary.test).
    expect(headers().slice(0, 2)).toEqual(['Saludos, 2 señas', 'Números, 2 señas']);
    const cards = screen.getAllByLabelText(/^Ver la seña completa de /).map((card) => card.props.accessibilityLabel);
    expect(cards.slice(0, 4)).toEqual([
      'Ver la seña completa de Hola',
      'Ver la seña completa de Buenos días',
      'Ver la seña completa de 1',
      'Ver la seña completa de 2',
    ]);
  });

  test('señas reales: el filtro de tema deja solo esa sección', async () => {
    await renderScreen();
    await act(async () => fireEvent.press(await screen.findByText('Señas reales')));
    const filters = await screen.findByLabelText('Filtrar por tema');
    await act(async () => fireEvent.press(within(filters).getByText('Números')));
    expect(headers()).toEqual(['Números, 2 señas']);
  });
});
