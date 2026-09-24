import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Modal, StyleSheet, View } from 'react-native';
import announce from '../../../../core/a11y/announce';
import useReducedMotion from '../../../../core/a11y/useReducedMotion';
import haptics from '../../../../core/feedback/haptics';
import { AppText, Button } from '../../../../shared/ui';
import { useAppTheme } from '../../../../shared/theme/ThemeProvider';
import Confetti from './Confetti';

function Star({ filled, index, reducedMotion, theme }) {
  const pop = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reducedMotion) return;
    Animated.sequence([
      Animated.delay(420 + index * 160),
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, ...theme.motion.spring.pop }),
    ]).start();
  }, [index, pop, reducedMotion, theme]);
  return (
    <Animated.View style={{ transform: [{ scale: pop }], opacity: pop }}>
      <Ionicons name={filled ? 'star' : 'star-outline'} size={index === 1 ? 46 : 36} color={filled ? theme.colors.gold : theme.colors.textMuted} />
    </Animated.View>
  );
}

/**
 * Celebración al completar un nivel: confeti + banner que entra con rebote,
 * estrellas escalonadas y resumen. Vibra con el patrón "celebrate" y anuncia
 * el resultado al lector de pantalla.
 */
export default function LevelCompleteCelebration({ visible, result, levelTitle, showConfetti = true, onContinue, onReplay }) {
  const theme = useAppTheme();
  const reducedMotion = useReducedMotion();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const banner = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible || !result) return;
    haptics.celebrate();
    announce(`Nivel completado. ${result.stars} de 3 estrellas. Puntaje ${result.score}.`);
    banner.setValue(reducedMotion ? 1 : 0);
    if (!reducedMotion) {
      Animated.timing(banner, {
        toValue: 1,
        duration: theme.motion.duration.slow,
        easing: theme.motion.easing.pop,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, result, reducedMotion, banner, theme]);

  if (!result) return null;

  const stats = [
    { icon: 'checkmark-circle', label: 'Aciertos', value: `${result.hits}/${result.total}` },
    { icon: 'heart', label: 'Vidas', value: String(result.lives) },
    { icon: 'sparkles', label: 'Puntaje', value: String(result.score) },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onContinue}>
      <View style={styles.backdrop}>
        <Confetti run={visible && showConfetti} />
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.card,
            {
              opacity: banner,
              transform: [
                { translateY: banner.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
                { scale: banner.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
              ],
            },
          ]}
        >
          <LinearGradient {...theme.gradients.header} style={styles.banner}>
            <Ionicons name="trophy" size={34} color="#FFFFFF" />
            <AppText variant="title" style={styles.bannerTitle} accessibilityRole="header">
              ¡Nivel completado!
            </AppText>
            <AppText variant="subtitle" style={styles.bannerSubtitle}>
              {levelTitle}
            </AppText>
          </LinearGradient>

          <View style={styles.stars} accessible accessibilityLabel={`${result.stars} de 3 estrellas`}>
            {[0, 1, 2].map((index) => (
              <Star key={index} index={index} filled={index < result.stars} reducedMotion={reducedMotion} theme={theme} />
            ))}
          </View>

          <View style={styles.statsRow}>
            {stats.map((stat) => (
              <View key={stat.label} style={styles.stat} accessible accessibilityLabel={`${stat.label}: ${stat.value}`}>
                <Ionicons name={stat.icon} size={18} color={theme.colors.primary} />
                <AppText variant="stat">{stat.value}</AppText>
                <AppText variant="caption" tone="secondary">
                  {stat.label}
                </AppText>
              </View>
            ))}
          </View>

          <AppText variant="caption" tone="success" align="center">
            Tu progreso quedó guardado
          </AppText>

          <View style={styles.actions}>
            <Button label="Continuar" icon="arrow-forward" iconPosition="right" onPress={onContinue} />
            <Button label="Repetir nivel" variant="ghost" icon="refresh" onPress={onReplay} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function createStyles(theme) {
  const { colors, spacing, radius } = theme;
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', paddingHorizontal: spacing.xl },
    card: {
      alignSelf: 'center',
      width: '100%',
      maxWidth: 420,
      borderRadius: radius.xxl,
      backgroundColor: colors.surfaceRaised,
      overflow: 'hidden',
      paddingBottom: spacing.lg,
      gap: spacing.md,
      ...theme.elevation.lg,
    },
    banner: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xl, paddingHorizontal: spacing.lg },
    bannerTitle: { color: '#FFFFFF', textAlign: 'center' },
    bannerSubtitle: { color: '#FFFFFF', opacity: 0.92, textAlign: 'center' },
    stars: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: spacing.md },
    statsRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: spacing.sm },
    stat: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
      paddingVertical: spacing.sm + 2,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceSunken,
    },
    actions: { paddingHorizontal: spacing.lg, gap: spacing.xs },
  });
}
