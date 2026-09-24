import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import useReducedMotion from '../../../core/a11y/useReducedMotion';
import { useAppTheme } from '../../theme/ThemeProvider';

/**
 * Spinner temático: un anillo de marca que gira alrededor de una mano que
 * "respira". Da identidad a las esperas (en vez del spinner genérico del
 * sistema) y deja claro que la app está trabajando, no colgada.
 *
 * Con "reducir movimiento" cae al ActivityIndicator del sistema, que el SO
 * ya adapta a esa preferencia.
 */
export default function Spinner({ size = 56, label, style }) {
  const theme = useAppTheme();
  const reducedMotion = useReducedMotion();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const rotation = useRef(new Animated.Value(0)).current;
  const breath = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reducedMotion) return undefined;
    const spin = Animated.loop(
      Animated.timing(rotation, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }),
    );
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1.12, duration: 520, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0.94, duration: 520, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    spin.start();
    pulse.start();
    return () => {
      spin.stop();
      pulse.stop();
    };
  }, [reducedMotion, rotation, breath]);

  const ring = size;
  const stroke = Math.max(3, Math.round(size / 14));

  return (
    <View
      style={[styles.container, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label || 'Cargando'}
      accessibilityState={{ busy: true }}
    >
      {reducedMotion ? (
        <ActivityIndicator size="large" color={theme.colors.primary} />
      ) : (
        <View style={{ width: ring, height: ring, alignItems: 'center', justifyContent: 'center' }}>
          <View
            style={[
              styles.track,
              { width: ring, height: ring, borderRadius: ring / 2, borderWidth: stroke },
            ]}
          />
          <Animated.View
            style={[
              styles.arc,
              {
                width: ring,
                height: ring,
                borderRadius: ring / 2,
                borderWidth: stroke,
                transform: [{ rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
              },
            ]}
          />
          <Animated.View style={{ transform: [{ scale: breath }] }}>
            <Ionicons name="hand-left" size={Math.round(size * 0.42)} color={theme.colors.primary} />
          </Animated.View>
        </View>
      )}
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    container: { alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md },
    track: { position: 'absolute', borderColor: theme.colors.primarySoft },
    arc: {
      position: 'absolute',
      borderColor: 'transparent',
      borderTopColor: theme.colors.primary,
      borderRightColor: theme.colors.primaryAlt,
    },
    label: {
      ...theme.typography.label,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
  });
}
