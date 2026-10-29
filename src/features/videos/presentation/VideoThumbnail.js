import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import useReducedMotion from '../../../core/a11y/useReducedMotion';
import { useAppTheme } from '../../../shared/theme/ThemeProvider';

/**
 * Vista previa de un video: la miniatura que viene del panel (`thumbnailUrl`)
 * o, si no hay o no carga, una portada de marca con el icono de reproducir.
 * La portada queda debajo mientras la imagen descarga y la imagen entra con
 * un fade corto: nunca se ve un cuadro vacío.
 *
 * Es decorativa (la tarjeta que la contiene ya tiene el nombre del video).
 *
 *   uri         URL de la miniatura (o null)
 *   iconSize    tamaño del icono de reproducir
 *   showPlay    muestra el icono de reproducir encima (default true)
 *   style       tamaño y radio los define quien la usa
 */
export default function VideoThumbnail({ uri, iconSize = 22, showPlay = true, style }) {
  const theme = useAppTheme();
  const reducedMotion = useReducedMotion();
  const styles = useMemo(() => createStyles(theme, iconSize), [theme, iconSize]);
  const [failed, setFailed] = useState(false);
  const appear = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setFailed(false);
    appear.setValue(0);
  }, [uri, appear]);

  const handleLoad = () => {
    if (reducedMotion) {
      appear.setValue(1);
      return;
    }
    Animated.timing(appear, {
      toValue: 1,
      duration: theme.motion.duration.fast,
      easing: theme.motion.easing.enter,
      useNativeDriver: true,
    }).start();
  };

  const showImage = Boolean(uri) && !failed;

  return (
    <View style={[styles.frame, style]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <LinearGradient {...theme.gradients.card} style={StyleSheet.absoluteFill} />
      {!showImage ? <Ionicons name="videocam" size={iconSize * 2.4} color={theme.colors.primary} style={styles.watermark} /> : null}
      {showImage ? (
        <Animated.Image
          testID="video-thumbnail"
          source={{ uri }}
          style={[StyleSheet.absoluteFill, { opacity: appear }]}
          resizeMode="cover"
          onLoad={handleLoad}
          onError={() => setFailed(true)}
        />
      ) : null}
      {showPlay ? (
        <View style={styles.playBadge}>
          <Ionicons name="play" size={iconSize} color={theme.colors.primaryContrast} style={styles.playIcon} />
        </View>
      ) : null}
    </View>
  );
}

function createStyles(theme, iconSize) {
  const badge = Math.round(iconSize * 1.7);
  return StyleSheet.create({
    frame: {
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceSunken,
    },
    watermark: { position: 'absolute', opacity: 0.14 },
    playBadge: {
      width: badge,
      height: badge,
      borderRadius: badge / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
      borderWidth: 2,
      borderColor: theme.colors.primaryContrast,
      ...theme.elevation.sm,
    },
    // El triángulo de «play» se ve corrido a la izquierda si se centra exacto.
    playIcon: { marginLeft: Math.round(iconSize * 0.12) },
  });
}
