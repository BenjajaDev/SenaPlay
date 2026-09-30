import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ServicesProvider } from '../../../../core/di/ServicesProvider';
import { AppThemeProvider } from '../../../../shared/theme/ThemeProvider';
import { FeedbackProvider } from '../../../../shared/ui';
import VideosTabScreen from '../VideosTabScreen';
import { buildVideoHtml, mediaOrigin, safeMediaUrl } from '../videoPlayerHtml';

// El WebView real es nativo: en Jest se reemplaza por una vista que guarda sus props.
const mockWebViews = [];
jest.mock('react-native-webview', () => {
  const { View: MockView } = require('react-native');
  return {
    WebView: (props) => {
      mockWebViews.push(props);
      return <MockView testID={props.testID} />;
    },
  };
});
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));

const VIDEOS = [
  { id: 'v1', title: 'Saludos en LSCh', category: 'Básico', durationSeconds: 95, url: 'https://cdn.supabase.co/storage/v1/object/public/media/video/saludos.mp4', captionsUrl: 'https://cdn.supabase.co/storage/v1/object/public/media/cc/saludos.srt', description: 'Hola, chao y gracias.', signKey: 'a' },
  { id: 'v2', title: 'La familia', category: 'Básico', durationSeconds: 120, url: 'https://cdn.supabase.co/storage/v1/object/public/media/video/familia.mp4', captionsUrl: null },
  { id: 'v3', title: 'Próximamente', category: 'Intermedio', durationSeconds: 60, url: null },
];

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

async function renderVideos(props = {}) {
  const services = { media: { listVideos: async () => ({ videos: VIDEOS, source: 'remote' }) } };
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <AppThemeProvider>
        <ServicesProvider services={services}>
          <FeedbackProvider>
            <View>
              <VideosTabScreen {...props} />
            </View>
          </FeedbackProvider>
        </ServicesProvider>
      </AppThemeProvider>
    </SafeAreaProvider>,
  );
}

describe('HTML del reproductor', () => {
  test('solo acepta enlaces http(s) y escapa los atributos', () => {
    expect(safeMediaUrl('https://x.cl/v.mp4')).toBe('https://x.cl/v.mp4');
    expect(safeMediaUrl('javascript:alert(1)')).toBeNull();
    expect(safeMediaUrl('https://x.cl/"><script>')).toBeNull();
    expect(buildVideoHtml({ url: 'ftp://x/v.mp4', background: 'black', accent: 'red' })).toBeNull();
    expect(mediaOrigin('https://cdn.supabase.co/storage/v1/x.mp4')).toBe('https://cdn.supabase.co');
  });

  test('reproduce inline, con subtítulos (SRT se convierte a WebVTT) y avisa eventos a la app', () => {
    const html = buildVideoHtml({ url: VIDEOS[0].url, captionsUrl: VIDEOS[0].captionsUrl, background: 'black', accent: 'purple' });
    expect(html).toContain('playsinline');
    expect(html).toContain(`<source src="${VIDEOS[0].url}" />`);
    expect(html).toContain(JSON.stringify(VIDEOS[0].captionsUrl));
    expect(html).toContain("'WEBVTT");
    expect(html).toContain('ReactNativeWebView.postMessage');
  });
});

describe('Videos dentro de la app', () => {
  beforeEach(() => {
    mockWebViews.length = 0;
  });

  test('tocar un video lo reproduce aquí mismo, sin abrir el navegador', async () => {
    const onScrollToTop = jest.fn();
    await renderVideos({ onScrollToTop });
    await fireEvent.press(await screen.findByLabelText(/Saludos en LSCh/));

    expect(screen.getByTestId('video-webview')).toBeTruthy();
    expect(require('expo-web-browser').openBrowserAsync).not.toHaveBeenCalled();
    expect(onScrollToTop).toHaveBeenCalled();
    const webview = mockWebViews[mockWebViews.length - 1];
    expect(webview.source.html).toContain('saludos.mp4');
    expect(webview.source.baseUrl).toBe('https://cdn.supabase.co');
    expect(webview.allowsInlineMediaPlayback).toBe(true);
    expect(screen.getByText('Hola, chao y gracias.')).toBeTruthy();
    expect(screen.getByText('Cargando video…')).toBeTruthy();

    // El video avisa que cargó: desaparece la carga.
    await act(async () => webview.onMessage({ nativeEvent: { data: JSON.stringify({ type: 'ready', duration: 95 }) } }));
    expect(screen.queryByText('Cargando video…')).toBeNull();
  });

  test('muestra un error con reintento si el video falla', async () => {
    await renderVideos();
    await fireEvent.press(await screen.findByLabelText(/La familia/));
    const webview = mockWebViews[mockWebViews.length - 1];
    await act(async () => webview.onMessage({ nativeEvent: { data: JSON.stringify({ type: 'error', code: 4 }) } }));
    expect(screen.getByText('Este formato de video no es compatible con tu teléfono.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Reintentar'));
    expect(screen.getByText('Cargando video…')).toBeTruthy();
  });

  test('«Más videos» cambia de video y la flecha vuelve a la lista', async () => {
    await renderVideos();
    await fireEvent.press(await screen.findByLabelText(/Saludos en LSCh/));
    // Los videos sin publicar no aparecen en «Más videos».
    expect(screen.queryByLabelText(/Próximamente/)).toBeNull();
    await fireEvent.press(screen.getByLabelText(/La familia/));
    expect(mockWebViews[mockWebViews.length - 1].source.html).toContain('familia.mp4');

    await fireEvent.press(screen.getByLabelText('Volver a la lista de videos'));
    expect(screen.queryByTestId('video-webview')).toBeNull();
    expect(screen.getByLabelText(/Próximamente/)).toBeTruthy();
  });
});
