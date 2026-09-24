import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../theme/ThemeProvider';

export default function StatCard({ label, value, tone = 'violet', style }) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const toneStyles = useMemo(() => getToneStyles(theme), [theme]);

  return (
    <View style={[styles.card, toneStyles[tone] || toneStyles.violet, style]}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

function getToneStyles(theme) {
  if (theme.mode === 'dark') {
    return {
      green: { backgroundColor: '#1E3220', borderColor: '#2D5A31' },
      orange: { backgroundColor: '#3A2E12', borderColor: '#6A541D' },
      blue: { backgroundColor: '#172C38', borderColor: '#2C5367' },
      violet: { backgroundColor: '#2A2240', borderColor: '#4B3B73' },
    };
  }

  return {
    green: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
    orange: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
    blue: { backgroundColor: '#ECFEFF', borderColor: '#BAE6FD' },
    violet: { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' },
  };
}

function createStyles(theme) {
  return StyleSheet.create({
    card: {
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
    },
    value: {
      fontSize: 20,
      fontWeight: '900',
      color: theme.colors.textPrimary,
    },
    label: {
      marginTop: 5,
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
  });
}
