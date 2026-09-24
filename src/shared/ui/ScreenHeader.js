import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../theme/ThemeProvider';
import AppText from './AppText';
import IconButton from './IconButton';

/**
 * Cabecera estándar de juegos, niveles y pantallas secundarias: botón atrás
 * (accesible, 44px), título centrado y un slot derecho opcional (vidas,
 * puntaje, ayuda).
 */
export default function ScreenHeader({ title, onBack, rightNode, backLabel = 'Volver' }) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.header}>
      {onBack ? (
        <IconButton icon="arrow-back" label={backLabel} onPress={onBack} iconSize={24} />
      ) : (
        <View style={styles.spacer} />
      )}
      <AppText variant="title" numberOfLines={1} style={styles.title} accessibilityRole="header">
        {title}
      </AppText>
      <View style={styles.right}>{rightNode || <View style={styles.spacer} />}</View>
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.sm + 2,
    },
    title: { flex: 1, textAlign: 'center' },
    right: { minWidth: 44, alignItems: 'flex-end' },
    spacer: { width: 44 },
  });
}
