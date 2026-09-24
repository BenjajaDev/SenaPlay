import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { APP_FONTS } from '../../constants/fonts';
import { useAppTheme } from '../../theme/ThemeProvider';

export default function GameScreenHeader({ title, onBack, rightNode }) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={8}>
        <Ionicons name="arrow-back" size={26} color={theme.colors.textPrimary} />
      </Pressable>
      <Text style={styles.title}>{title}</Text>
      {rightNode || <View style={styles.spacer} />}
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    title: {
      fontFamily: APP_FONTS.extraBold,
      fontSize: 22,
      fontWeight: '800',
      color: theme.colors.textPrimary,
    },
    spacer: {
      width: 26,
    },
  });
}
