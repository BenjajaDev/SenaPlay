import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { APP_FONTS } from '../../constants/fonts';
import { useAppTheme } from '../../theme/ThemeProvider';

export default function SectionHeader({ title, subtitle }) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    container: {
      gap: 4,
    },
    title: {
      fontFamily: APP_FONTS.extraBold,
      fontSize: 22,
      fontWeight: '800',
      color: theme.colors.textPrimary,
    },
    subtitle: {
      fontFamily: APP_FONTS.medium,
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
  });
}
