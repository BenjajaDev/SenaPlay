import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../theme/ThemeProvider';
import AppText from './AppText';

// Tonos semánticos → tokens del tema (ambos modos definidos en colors.js).
const TONES = {
  green: { soft: 'successSoft', accent: 'success' },
  orange: { soft: 'warningSoft', accent: 'warning' },
  blue: { soft: 'infoSoft', accent: 'info' },
  violet: { soft: 'primarySoft', accent: 'primary' },
  gold: { soft: 'warningSoft', accent: 'gold' },
};

/** Métrica destacada (racha, niveles, precisión). `icon` opcional de Ionicons. */
export default function StatCard({ label, value, tone = 'violet', icon, style }) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const toneTokens = TONES[tone] || TONES.violet;
  const accent = theme.colors[toneTokens.accent];

  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={[styles.card, { backgroundColor: theme.colors[toneTokens.soft], borderColor: accent }, style]}
    >
      {icon ? <Ionicons name={icon} size={18} color={accent} /> : null}
      <AppText variant="stat">{value}</AppText>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    card: {
      borderRadius: theme.radius.lg,
      padding: theme.spacing.md,
      borderWidth: 1,
      gap: theme.spacing.xxs,
    },
  });
}
