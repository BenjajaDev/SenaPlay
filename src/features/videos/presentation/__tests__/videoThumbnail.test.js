import { act, render, screen } from '@testing-library/react-native';
import { AppThemeProvider } from '../../../../shared/theme/ThemeProvider';
import VideoThumbnail from '../VideoThumbnail';

const renderThumbnail = (uri) =>
  render(
    <AppThemeProvider>
      <VideoThumbnail uri={uri} style={{ width: 96, height: 54 }} />
    </AppThemeProvider>,
  );

// La miniatura es decorativa (oculta al lector): se busca incluyendo ocultos.
const thumbnail = () => screen.queryByTestId('video-thumbnail', { includeHiddenElements: true });

describe('VideoThumbnail', () => {
  test('con miniatura la muestra; si falla, queda la portada de marca', async () => {
    await renderThumbnail('https://x/t.jpg');
    expect(thumbnail().props.source).toEqual({ uri: 'https://x/t.jpg' });
    await act(async () => thumbnail().props.onError());
    expect(thumbnail()).toBeNull();
  });

  test('sin miniatura usa la portada de marca', async () => {
    await renderThumbnail(null);
    expect(thumbnail()).toBeNull();
  });
});
