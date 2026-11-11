import { Ionicons } from '@expo/vector-icons';
import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import announce from '../../../core/a11y/announce';
import useReducedMotion from '../../../core/a11y/useReducedMotion';
import haptics from '../../../core/feedback/haptics';
import { useAppTheme } from '../../../shared/theme/ThemeProvider';
import { AppText, Chip } from '../../../shared/ui';
import useSlowMotion from './useSlowMotion';

/** Lado mínimo (px) para mostrar el reproductor; bajo eso, solo la imagen fija. */
export const CLIP_PLAYER_MIN_SIZE = 120;

const SLOW_RATE = 0.5;

const formatSeconds = (ms) => (ms / 1000).toLocaleString('es-CL', { maximumFractionDigits: 1 });

/**
 * Seña en video. Regla del producto: nada se mueve solo. Al entrar se ve la
 * imagen fija (el cuadro clave, no el primero); el video corre solo cuando
 * la persona toca «Ver seña», una vez y sin sonido, y vuelve a la imagen.
 *
 * Con `interactive` (cajas ≥ CLIP_PLAYER_MIN_SIZE) agrega, debajo de la
 * caja y sin tapar la mano: «Lento» (0,5×, preferencia compartida) y
 * «Repetir» (bucle, apagado por defecto). Con «reducir movimiento» el video
 * se puede ver igual, porque es el contenido y no un adorno, pero no se
 * ofrece el bucle. Sin `interactive` solo muestra la imagen fija con una
 * insignia de «con movimiento»: así una grilla nunca tiene varios videos.
 *
 * El video no se descarga hasta el primer toque, y queda en caché
 * (`useCaching`) para verlo de nuevo sin conexión. Si falla, se vuelve a la
 * imagen fija con un aviso y «Reintentar»; nunca bloquea el ejercicio.
 *
 * Props:
 *   clip         { signKey, gloss, videoUrl, posterUrl, durationMs }
 *   label        nombre de la seña para el lector de pantalla
 *   size         lado de la caja en px
 *   rounded      radio del borde
 *   interactive  muestra el reproductor (por defecto según el tamaño)
 */
export default function SignClip({ clip, label, size, rounded = 14, interactive = size >= CLIP_PLAYER_MIN_SIZE, style }) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const caja = { width: size, height: size, borderRadius: rounded };
  const nombre = label || clip.gloss;

  if (!interactive) {
    return (
      <View
        style={[caja, styles.frame, style]}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Seña de ${nombre}, con movimiento`}
      >
        <Image source={{ uri: clip.posterUrl }} style={[styles.fill, caja]} resizeMode="cover" />
        <View pointerEvents="none" style={styles.badgeSmall}>
          <Ionicons name="videocam" size={12} color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  return <ClipPlayer clip={clip} nombre={nombre} caja={caja} size={size} styles={styles} theme={theme} style={style} />;
}

// Estados: 'poster' (imagen fija) · 'loading' · 'playing' · 'error'.
function ClipPlayer({ clip, nombre, caja, size, styles, theme, style }) {
  const reduceMotion = useReducedMotion();
  const [slow, setSlow] = useSlowMotion();
  const [loop, setLoop] = useState(false);
  const [phase, setPhase] = useState('poster');
  const loadedUrl = useRef(null);

  const player = useVideoPlayer(null, (instance) => {
    instance.muted = true;
    instance.loop = false;
  });

  const loopEnabled = loop && !reduceMotion;

  // Otra seña en la misma caja (siguiente ejercicio): vuelve a la imagen fija.
  useEffect(() => {
    player.pause();
    loadedUrl.current = null;
    setPhase('poster');
  }, [clip.videoUrl, player]);

  useEffect(() => {
    player.playbackRate = slow ? SLOW_RATE : 1;
  }, [slow, player]);

  useEffect(() => {
    player.loop = loopEnabled;
  }, [loopEnabled, player]);

  useEventListener(player, 'playingChange', ({ isPlaying }) => {
    if (isPlaying) setPhase('playing');
  });

  useEventListener(player, 'playToEnd', () => {
    if (!player.loop) setPhase('poster');
  });

  useEventListener(player, 'statusChange', ({ status }) => {
    if (status !== 'error') return;
    loadedUrl.current = null;
    setPhase('error');
    announce(`No se pudo cargar el video de la seña ${nombre}`);
  });

  const stop = () => {
    player.pause();
    setPhase('poster');
  };

  const play = async () => {
    haptics.tap();
    setPhase('loading');
    try {
      if (loadedUrl.current !== clip.videoUrl) {
        await player.replaceAsync({ uri: clip.videoUrl, useCaching: true });
        loadedUrl.current = clip.videoUrl;
      }
      player.currentTime = 0;
      player.playbackRate = slow ? SLOW_RATE : 1;
      player.loop = loopEnabled;
      player.play();
    } catch {
      loadedUrl.current = null;
      setPhase('error');
      announce(`No se pudo cargar el video de la seña ${nombre}`);
    }
  };

  const playing = phase === 'playing';
  const loading = phase === 'loading';
  const segundos = formatSeconds(clip.durationMs);

  return (
    <View style={[styles.column, { width: size }, style]}>
      <View style={[caja, styles.frame]}>
        {loadedUrl.current ? (
          <VideoView player={player} style={[styles.fill, caja]} contentFit="cover" nativeControls={false} />
        ) : null}
        {!playing ? <Image source={{ uri: clip.posterUrl }} style={[styles.fill, caja]} resizeMode="cover" /> : null}

        <Pressable
          onPress={playing ? stop : play}
          disabled={loading}
          style={styles.touchArea}
          accessibilityRole="button"
          accessibilityLabel={playing ? `Detener la seña ${nombre}` : `Ver la seña ${nombre} en movimiento`}
          accessibilityHint={`Video de ${segundos} segundos, sin sonido`}
          accessibilityState={{ busy: loading }}
        >
          {!playing ? (
            <View style={styles.playButton}>
              {loading ? (
                <ActivityIndicator color={theme.colors.primary} />
              ) : (
                <Ionicons name={phase === 'error' ? 'refresh' : 'play'} size={26} color={theme.colors.primary} />
              )}
            </View>
          ) : null}
        </Pressable>

        {!playing ? (
          <View pointerEvents="none" style={styles.badge}>
            <Ionicons name="videocam" size={12} color={theme.colors.primary} />
            {size >= 160 ? (
              <AppText variant="caption" tone="brand">
                Con movimiento
              </AppText>
            ) : null}
          </View>
        ) : null}
      </View>

      {phase === 'error' ? (
        <View style={styles.errorRow} accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle" size={14} color={theme.colors.dangerText} />
          <AppText variant="caption" tone="danger" style={styles.errorText}>
            No se pudo cargar el video. Toca para reintentar.
          </AppText>
        </View>
      ) : null}

      <View style={styles.controls}>
        <Chip label="Lento" icon="speedometer-outline" selected={slow} onPress={() => setSlow(!slow)} />
        {!reduceMotion ? <Chip label="Repetir" icon="repeat" selected={loop} onPress={() => setLoop(!loop)} /> : null}
      </View>
    </View>
  );
}

function createStyles(theme) {
  const { colors, spacing, radius, elevation } = theme;
  return StyleSheet.create({
    column: { alignItems: 'center', gap: spacing.sm },
    frame: { overflow: 'hidden', backgroundColor: colors.surfaceSunken },
    fill: { position: 'absolute', top: 0, left: 0 },
    touchArea: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
    playButton: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceRaised,
      ...elevation.sm,
    },
    // La insignia va en la esquina superior: la mano suele estar al centro.
    badge: {
      position: 'absolute',
      top: spacing.xs,
      left: spacing.xs,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xxs,
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.xxs,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceRaised,
    },
    badgeSmall: {
      position: 'absolute',
      top: spacing.xxs,
      left: spacing.xxs,
      padding: spacing.xxs,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceRaised,
    },
    errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    errorText: { flexShrink: 1 },
    controls: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.xs },
  });
}
