import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import announce from '../../../core/a11y/announce';
import { AppText, Button } from '../../../shared/ui';
import { useAppTheme } from '../../../shared/theme/ThemeProvider';
import { buildVideoHtml, mediaOrigin } from './videoPlayerHtml';

const ERROR_MESSAGES = {
  2: 'Se cortó la conexión mientras cargaba el video.',
  3: 'El video está dañado o no se puede decodificar.',
  4: 'Este formato de video no es compatible con tu teléfono.',
};

/**
 * Reproductor de video dentro de la app (WebView + <video> HTML5). Muestra
 * carga, error con reintento y avisa al terminar. Relación 16:9.
 *
 * Props: video { url, captionsUrl, thumbnailUrl, title }, onEnded, onCaptionsError
 */
export default function VideoPlayer({ video, onEnded, onCaptionsError }) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [status, setStatus] = useState('loading');
  const [errorCode, setErrorCode] = useState(null);
  // Cambiar la key re-crea el WebView: sirve para «Reintentar».
  const [attempt, setAttempt] = useState(0);

  const html = useMemo(
    () =>
      buildVideoHtml({
        url: video?.url,
        captionsUrl: video?.captionsUrl,
        posterUrl: video?.thumbnailUrl,
        background: theme.colors.photoBackdrop,
        accent: theme.colors.primary,
      }),
    [video, theme],
  );

  const handleMessage = (event) => {
    let message;
    try {
      message = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (message.type === 'ready' || message.type === 'playing') setStatus('ready');
    if (message.type === 'ended') {
      announce('Video terminado.');
      onEnded?.();
    }
    if (message.type === 'error') {
      setErrorCode(message.code || 0);
      setStatus('error');
      announce('No se pudo reproducir el video.');
    }
    if (message.type === 'captions-error') onCaptionsError?.();
  };

  const retry = () => {
    setStatus('loading');
    setErrorCode(null);
    setAttempt((prev) => prev + 1);
  };

  if (!html) {
    return (
      <View style={[styles.frame, styles.center]}>
        <Ionicons name="alert-circle" size={32} color={theme.colors.onHeader} />
        <AppText variant="bodyStrong" tone="onHeader" align="center">
          El enlace de este video no es válido.
        </AppText>
      </View>
    );
  }

  return (
    <View style={styles.frame} accessible={status !== 'ready'} accessibilityLabel={`Reproductor: ${video?.title || 'video'}`}>
      <WebView
        key={attempt}
        testID="video-webview"
        source={{ html, baseUrl: mediaOrigin(video.url) }}
        originWhitelist={['*']}
        style={styles.webview}
        javaScriptEnabled
        allowsInlineMediaPlayback
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction={false}
        scrollEnabled={false}
        bounces={false}
        setSupportMultipleWindows={false}
        onMessage={handleMessage}
        onError={() => {
          setErrorCode(2);
          setStatus('error');
        }}
      />

      {status === 'loading' ? (
        <View style={[StyleSheet.absoluteFill, styles.center, styles.overlay]} pointerEvents="none" accessibilityRole="progressbar" accessibilityLabel="Cargando video">
          {/* Indicador propio: el Spinner del sistema usa texto oscuro, ilegible sobre el fondo del video. */}
          <ActivityIndicator size="large" color={theme.colors.onHeader} />
          <AppText variant="caption" tone="onHeader">Cargando video…</AppText>
        </View>
      ) : null}

      {status === 'error' ? (
        <View style={[StyleSheet.absoluteFill, styles.center, styles.overlay]} accessibilityLiveRegion="polite">
          <Ionicons name="cloud-offline-outline" size={32} color={theme.colors.onHeader} />
          <AppText variant="bodyStrong" tone="onHeader" align="center">
            No se pudo reproducir el video
          </AppText>
          <AppText variant="caption" tone="onHeader" align="center" style={styles.errorText}>
            {ERROR_MESSAGES[errorCode] || 'Revisa tu conexión e inténtalo otra vez.'}
          </AppText>
          <Button label="Reintentar" icon="refresh" size="sm" onPress={retry} />
        </View>
      ) : null}
    </View>
  );
}

function createStyles(theme) {
  const { colors, radius, spacing } = theme;
  return StyleSheet.create({
    frame: {
      width: '100%',
      aspectRatio: 16 / 9,
      borderRadius: radius.lg,
      overflow: 'hidden',
      backgroundColor: colors.photoBackdrop,
    },
    webview: { flex: 1, backgroundColor: colors.photoBackdrop },
    center: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg },
    overlay: { backgroundColor: colors.photoBackdrop },
    errorText: { opacity: 0.9 },
  });
}
