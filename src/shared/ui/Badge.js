import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../theme/ThemeProvider';

// Tonos → [fondo, texto]; ambos cumplen AA en claro y oscuro.
const TONES = {
  brand: ['primarySoft', 'primary'],
  success: ['successSoft', 'successText'],
  warning: ['warningSoft', 'warningText'],
  danger: ['dangerSoft', 'dangerText'],
  info: ['infoSoft', 'infoText'],
  neutral: ['surfaceSunken', 'textSecondary'],
};

/** Etiqueta chica de estado/categoría (dificultad, tipo de seña, "Nuevo"). */
export default function Badge({ label, tone = 'brand', icon, style }) {
  const theme = useAppTheme();
  const [bg, fg] = TONES[tone] || TONES.brand;
  const color = theme.colors[fg];
  return (
    <View style={[styles.badge, { backgroundColor: theme.colors[bg] }, style]}>
      {icon ? <Ionicons name={icon} size={11} color={color} /> : null}
      <Text style={[theme.typography.label, styles.text, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Dificultad → tono + icono (no depende solo del color). */
export function difficultyBadgeProps(difficulty) {
  if (difficulty === 'Fácil') return { tone: 'success', icon: 'leaf' };
  if (difficulty === 'Difícil') return { tone: 'danger', icon: 'flame' };
  return { tone: 'warning', icon: 'trending-up' };
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  text: { fontSize: 11, lineHeight: 15 },
});
