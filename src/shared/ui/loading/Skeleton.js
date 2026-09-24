import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import useReducedMotion from '../../../core/a11y/useReducedMotion';
import { useAppTheme } from '../../theme/ThemeProvider';

/**
 * Bloque "esqueleto" para contenido que está cargando (listas de niveles,
 * diccionario, estadísticas). Anticipa la forma del contenido real, por lo
 * que la carga se percibe más corta y la pantalla no "salta" al llegar datos.
 *
 * Pulso de opacidad con native driver (un shimmer con gradiente animado
 * obligaría a animar layout). Con "reducir movimiento" queda estático.
 */
export default function Skeleton({ width = '100%', height = 16, radius, style }) {
  const theme = useAppTheme();
  const reducedMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    if (reducedMotion) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.55, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reducedMotion, opacity]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width,
          height,
          borderRadius: radius ?? theme.radius.sm,
          backgroundColor: theme.colors.skeletonBase,
          opacity,
        },
        style,
      ]}
    />
  );
}

/** Tarjeta esqueleto genérica: icono + 2 líneas (lista de niveles/juegos). */
export function SkeletonCard({ lines = 2, style }) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={[styles.card, style]}>
      <Skeleton width={48} height={48} radius={theme.radius.md} />
      <View style={styles.lines}>
        <Skeleton width="60%" height={16} />
        {Array.from({ length: Math.max(0, lines - 1) }).map((_, index) => (
          <Skeleton key={index} width={index % 2 ? '70%' : '90%'} height={12} />
        ))}
      </View>
    </View>
  );
}

/** Lista de tarjetas esqueleto, con label accesible único para toda la lista. */
export function SkeletonList({ count = 4, lines = 2, label = 'Cargando contenido' }) {
  const theme = useAppTheme();
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} style={{ gap: theme.spacing.md }}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} lines={lines} />
      ))}
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      padding: theme.spacing.lg,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    lines: { flex: 1, gap: theme.spacing.sm },
  });
}
