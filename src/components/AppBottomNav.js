import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/ThemeProvider';

const TABS = [
  { key: 'levels', label: 'Niveles', icon: 'layers-outline', activeIcon: 'layers' },
  { key: 'dictionary', label: 'Diccionario', icon: 'book-outline', activeIcon: 'book' },
  { key: 'videos', label: 'Videos', icon: 'videocam-outline', activeIcon: 'videocam' },
  { key: 'games', label: 'Juegos', icon: 'game-controller-outline', activeIcon: 'game-controller' },
  { key: 'progress', label: 'Progreso', icon: 'analytics-outline', activeIcon: 'analytics' },
];

export default function AppBottomNav({ activeTab, onChangeTab }) {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[styles.container, { paddingBottom: 12 + insets.bottom }]}>
      {TABS.map((tab) => {
        const isActive = tab.key === activeTab;
        return (
          <Pressable
            key={tab.key}
            style={styles.item}
            onPress={() => onChangeTab(tab.key)}
            hitSlop={8}
          >
            <Ionicons
              name={isActive ? tab.activeIcon : tab.icon}
              size={22}
              color={isActive ? theme.colors.primary : theme.colors.navInactive}
            />
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.72}
              style={[styles.label, isActive && styles.labelActive]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingTop: 8,
      paddingHorizontal: 6,
    },
    item: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      gap: 4,
      paddingVertical: 4,
    },
    label: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.colors.navInactive,
      maxWidth: '100%',
      textAlign: 'center',
    },
    labelActive: {
      color: theme.colors.primary,
    },
  });
}
