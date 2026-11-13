import { Ionicons } from '@expo/vector-icons';
import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import announce from '../../../core/a11y/announce';
import useReducedMotion from '../../../core/a11y/useReducedMotion';
import haptics from '../../../core/feedback/haptics';
import { useAppTheme } from '../../../shared/theme/ThemeProvider';
import { AppText } from '../../../shared/ui';
import SignPlaybackControls from './SignPlaybackControls';
import useLoopPreference, { SignPlaybackScope, useActiveClip } from './SignPlaybackContext';
import useSlowMotion from './useSlowMotion';

/** Lado mínimo (px) para mostrar el reproductor; bajo eso, solo la imagen fija. */
export const CLIP_PLAYER_MIN_SIZE = 120;

const SLOW_RATE = 0.5;

/** Bajo este lado (px) «Lento»/«Repetir» van solo con ícono para caber en una fila. */
const CONTROLS_LABEL_MIN_SIZE = 210;

const lowerFirst = (text) => text.charAt(0).toLocaleLowerCase('es') + text.slice(1);

const formatSeconds = (ms) => (ms / 1000).toLocaleString('es-CL', { maximumFractionDigits: 1 });

/**
 * Seña en video. Regla del producto: nada se mueve solo. Al entrar se ve la
 * imagen fija (el cuadro clave, no el primero); el video corre solo cuando
 * la persona toca «Ver seña», una vez y sin sonido, y vuelve a la imagen.
 *
 * Con `interactive` (cajas ≥ CLIP_PLAYER_MIN_SIZE) agrega, debajo de la
 * caja y sin tapar la mano, UNA fila con «Lento» (0,5×, preferencia
 * compartida) y «Repetir» (bucle, apagado por defecto; solo ícono en cajas
 * chicas para que no se apilen). Con «reducir movimiento» el video se puede
 * ver igual, porque es el contenido y no un adorno, pero no se ofrece el bucle.
 *
 * El video completo es el control: tocarlo lo reproduce, lo detiene o, si
 * falló la carga, reintenta. El ▶ de la esquina inferior derecha (fuera del
 * centro para no tapar la mano) es solo un indicador, y mientras corre no se
 * muestra nada sobre la seña: el video termina solo o se detiene al tocarlo.
 * `onLongPress` reenvía «mantener presionado» (la pista del contenedor).
 *
 * `variant="card"` es para tarjetas de elección (SignChoiceExercise): sin
 * insignia ni chips (los gobierna una barra común con SignPlaybackControls y el
 * bucle de SignPlaybackProvider, que también garantiza un solo video activo).
 *
 * El video no se descarga hasta el primer toque, y queda en caché
 * (`useCaching`) para verlo de nuevo sin conexión. Si falla, se vuelve a la
 * imagen fija con un aviso y «Reintentar»; nunca bloquea el ejercicio.
 *
 * Props:
 *   clip         { signKey, gloss, videoUrl, posterUrl, durationMs }
 *   label        nombre de la seña para el lector de pantalla
 *   neutralName  nombre sin la glosa («Seña de la opción 2», «Seña a interpretar»)
 *                para ejercicios donde la glosa es la respuesta; reemplaza a `label`
 *   size         lado de la caja en px
 *   rounded      radio del borde
 *   interactive  muestra el reproductor (por defecto según el tamaño)
 *   variant      'standalone' (por defecto) | 'card'
 *   onLongPress  «mantener presionado» sobre el video (p. ej. la pista del ejercicio)
 */
export default function SignClip({ clip, label, neutralName, size, rounded = 14, interactive = size >= CLIP_PLAYER_MIN_SIZE, variant = 'standalone', onLongPress, style }) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const caja = { width: size, height: size, borderRadius: rounded };
  const nombre = label || clip.gloss;
  // Frase que completa «Ver …», «Detener …»: con nombre neutro no aparece la glosa.
  const sujeto = neutralName ? `la ${lowerFirst(neutralName)}` : `la seña ${nombre}`;

  if (!interactive) {
    return (
      <View
        style={[caja, styles.frame, style]}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${neutralName || `Seña de ${nombre}`}, con movimiento`}
      >
        <Image source={{ uri: clip.posterUrl }} style={[styles.fill, caja]} resizeMode="cover" />
        <View pointerEvents="none" style={styles.badgeSmall}>
          <Ionicons name="videocam" size={12} color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <SignPlaybackScope>
      <ClipPlayer clip={clip} sujeto={sujeto} caja={caja} size={size} card={variant === 'card'} onLongPress={onLongPress} styles={styles} theme={theme} style={style} />
    </SignPlaybackScope>
  );
}

// Estados: 'poster' (imagen fija) · 'loading' · 'playing' · 'error'.
function ClipPlayer({ clip, sujeto, caja, size, card, onLongPress, styles, theme, style }) {
  const reduceMotion = useReducedMotion();
  const [slow, setSlow] = useSlowMotion();
  const [loop] = useLoopPreference();
  const [activeId, setActiveId] = useActiveClip();
  const [phase, setPhase] = useState('poster');
  const loadedUrl = useRef(null);
  // Cada toque o cambio de seña invalida la descarga anterior: con red lenta,
  // un video que termina de bajar tarde no debe reproducirse en otra seña.
  const request = useRef(0);

  const player = useVideoPlayer(null, (instance) => {
    instance.muted = true;
    instance.loop = false;
  });

  const loopEnabled = loop && !reduceMotion;

  // Otra seña en la misma caja (siguiente ejercicio): vuelve a la imagen fija.
  useEffect(() => {
    request.current += 1;
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
    announce(`No se pudo cargar el video de ${sujeto}`);
  });

  // Un solo video a la vez dentro del ejercicio: si otro pasa a ser el activo, este se detiene.
  const id = clip.videoUrl;
  useEffect(() => {
    if (activeId !== null && activeId !== id && (phase === 'playing' || phase === 'loading')) stop();
  }, [activeId]);

  const stop = () => {
    request.current += 1;
    player.pause();
    setPhase('poster');
  };

  const play = async () => {
    const current = ++request.current;
    const url = clip.videoUrl;
    haptics.tap();
    setActiveId(id);
    setPhase('loading');
    try {
      if (loadedUrl.current !== url) {
        await player.replaceAsync({ uri: url, useCaching: true });
        if (current !== request.current) return;
        loadedUrl.current = url;
      }
      player.currentTime = 0;
      player.playbackRate = slow ? SLOW_RATE : 1;
      player.loop = loopEnabled;
      player.play();
    } catch {
      if (current !== request.current) return;
      loadedUrl.current = null;
      setPhase('error');
      announce(`No se pudo cargar el video de ${sujeto}`);
    }
  };

  const playing = phase === 'playing';
  const loading = phase === 'loading';
  const segundos = formatSeconds(clip.durationMs);

  return (
    <View pointerEvents="box-none" style={[styles.column, { width: size }, style]}>
      <View style={[caja, styles.frame]} pointerEvents="box-none">
        <View pointerEvents="none" style={[styles.fill, caja]}>
          {loadedUrl.current ? (
            <VideoView player={player} style={[styles.fill, caja]} contentFit="cover" nativeControls={false} />
          ) : null}
          {!playing ? <Image source={{ uri: clip.posterUrl }} style={[styles.fill, caja]} resizeMode="cover" /> : null}
        </View>

        {/* El video completo es el control: tocarlo reproduce, detiene o reintenta.
            Mientras corre no hay nada encima de la seña. Mantener presionado sigue
            siendo la pista del contenedor (se reenvía con onLongPress). */}
        <Pressable
          onPress={playing ? stop : play}
          onLongPress={onLongPress}
          delayLongPress={400}
          disabled={loading}
          style={[styles.fill, caja]}
          accessibilityRole="button"
          accessibilityLabel={
            playing ? `Detener ${sujeto}` : phase === 'error' ? `Reintentar cargar ${sujeto}` : `Ver ${sujeto} en movimiento`
          }
          accessibilityHint={playing || phase === 'error' ? undefined : `Video de ${segundos} segundos, sin sonido`}
          accessibilityState={{ busy: loading, disabled: loading }}
        />

        {!playing ? (
          // Solo indicador: el toque lo toma el video completo.
          <View pointerEvents="none" style={styles.corner}>
            <View style={styles.cornerButton}>
              {loading ? (
                <ActivityIndicator color={theme.colors.primary} />
              ) : (
                <Ionicons name={phase === 'error' ? 'refresh' : 'play'} size={20} color={theme.colors.primary} />
              )}
            </View>
          </View>
        ) : null}

        {!playing && !card ? (
          <View pointerEvents="none" style={styles.badge}>
            <Ionicons name="videocam" size={12} color={theme.colors.primary} />
            {size >= 160 ? (
              <AppText variant="caption" tone="brand">
                Con movimiento
              </AppText>
            ) : null}
          </View>
        ) : null}

        {card && phase === 'error' ? (
          <View pointerEvents="none" style={styles.errorOverlay} accessibilityLiveRegion="polite">
            <Ionicons name="alert-circle" size={14} color={theme.colors.dangerText} />
            <AppText variant="caption" tone="danger" style={styles.errorText} numberOfLines={2}>
              No cargó
            </AppText>
          </View>
        ) : null}
      </View>

      {!card && phase === 'error' ? (
        <View style={styles.errorRow} accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle" size={14} color={theme.colors.dangerText} />
          <AppText variant="caption" tone="danger" style={styles.errorText}>
            No se pudo cargar el video. Toca para reintentar.
          </AppText>
        </View>
      ) : null}

      {!card ? <SignPlaybackControls compact={size < CONTROLS_LABEL_MIN_SIZE} /> : null}
    </View>
  );
}

function createStyles(theme) {
  const { colors, spacing, radius, elevation } = theme;
  return StyleSheet.create({
    column: { alignItems: 'center', gap: spacing.sm },
    frame: { overflow: 'hidden', backgroundColor: colors.surfaceSunken },
    fill: { position: 'absolute', top: 0, left: 0 },
    // Indicador en la esquina inferior derecha: la mano suele estar al centro.
    corner: { ...StyleSheet.absoluteFillObject, alignItems: 'flex-end', justifyContent: 'flex-end', padding: spacing.sm },
    cornerButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceRaised,
      ...elevation.sm,
    },
    errorOverlay: {
      position: 'absolute',
      left: spacing.xs,
      bottom: spacing.xs,
      maxWidth: '55%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xxs,
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.xxs,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceRaised,
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
  });
}
