import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import useReducedMotion from '../../core/a11y/useReducedMotion';
import haptics from '../../core/feedback/haptics';
import { useAppTheme } from '../theme/ThemeProvider';

const THUMB = 30;
const PAD = 3;

/**
 * Interruptor de tema claro/oscuro con sol y luna. La perilla se desliza
 * hacia el modo activo, cuyo icono queda resaltado en el color de marca.
 *
 * Pensado para ir sobre una cabecera con degradé (usa `onHeader`), como en
 * las pantallas de autenticación. Guarda la preferencia vía `toggleMode`.
 */
export default function ThemeToggle({ style }) {
  const theme = useAppTheme();
  const reducedMotion = useReducedMotion();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const progress = useRef(new Animated.Value(theme.isDark ? 1 : 0)).current;

  useEffect(() => {
    const toValue = theme.isDark ? 1 : 0;
    if (reducedMotion) {
      progress.setValue(toValue);
      return;
    }
    Animated.timing(progress, {
      toValue,
      duration: theme.motion.duration.base,
      easing: theme.motion.easing.standard,
      useNativeDriver: true,
    }).start();
  }, [theme.isDark, theme.motion, reducedMotion, progress]);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, THUMB] });
  const iconColor = (active) => (active ? theme.colors.primary : theme.colors.onHeader);
  const slop = Math.max(0, Math.ceil((theme.minTouch - (THUMB + PAD * 2)) / 2));

  return (
    <Pressable
      onPress={() => {
        haptics.selection();
        theme.toggleMode();
      }}
      hitSlop={slop}
      accessibilityRole="switch"
      accessibilityLabel="Modo oscuro"
      accessibilityState={{ checked: theme.isDark }}
      style={({ pressed }) => [styles.track, pressed && styles.pressed, style]}
    >
      <Animated.View style={[styles.thumb, { transform: [{ translateX }] }]} />
      <View style={styles.slot}>
        <Ionicons name={theme.isDark ? 'sunny-outline' : 'sunny'} size={17} color={iconColor(!theme.isDark)} />
      </View>
      <View style={styles.slot}>
        <Ionicons name={theme.isDark ? 'moon' : 'moon-outline'} size={16} color={iconColor(theme.isDark)} />
      </View>
    </Pressable>
  );
}

function createStyles(theme) {
  const { colors, radius } = theme;
  return StyleSheet.create({
    track: {
      flexDirection: 'row',
      padding: PAD,
      borderRadius: radius.pill,
      backgroundColor: colors.onHeaderSoft,
    },
    thumb: {
      position: 'absolute',
      top: PAD,
      left: PAD,
      width: THUMB,
      height: THUMB,
      borderRadius: THUMB / 2,
      backgroundColor: colors.surfaceRaised,
      ...theme.elevation.sm,
    },
    slot: { width: THUMB, height: THUMB, alignItems: 'center', justifyContent: 'center' },
    pressed: { opacity: 0.8 },
  });
}
