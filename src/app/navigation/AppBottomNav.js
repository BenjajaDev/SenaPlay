import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useReducedMotion from '../../core/a11y/useReducedMotion';
import haptics from '../../core/feedback/haptics';
import { useAppTheme } from '../../shared/theme/ThemeProvider';

export const TABS = [
  { key: 'levels', label: 'Niveles', icon: 'layers-outline', activeIcon: 'layers' },
  { key: 'dictionary', label: 'Diccionario', icon: 'book-outline', activeIcon: 'book' },
  { key: 'videos', label: 'Videos', icon: 'videocam-outline', activeIcon: 'videocam', flag: 'videos.enabled' },
  { key: 'games', label: 'Juegos', icon: 'game-controller-outline', activeIcon: 'game-controller' },
  { key: 'progress', label: 'Progreso', icon: 'analytics-outline', activeIcon: 'analytics' },
];

function TabItem({ tab, isActive, onPress, theme, styles, reducedMotion }) {
  const scale = useRef(new Animated.Value(isActive ? 1 : 0.9)).current;

  useEffect(() => {
    if (reducedMotion) {
      scale.setValue(isActive ? 1 : 0.9);
      return;
    }
    Animated.spring(scale, { toValue: isActive ? 1 : 0.9, useNativeDriver: true, ...theme.motion.spring.pop }).start();
  }, [isActive, reducedMotion, scale, theme]);

  return (
    <Pressable
      style={styles.item}
      onPress={() => {
        if (!isActive) haptics.selection();
        onPress(tab.key);
      }}
      hitSlop={8}
      accessibilityRole="tab"
      accessibilityLabel={tab.label}
      accessibilityState={{ selected: isActive }}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        {isActive ? (
          <LinearGradient {...theme.gradients.brand} style={styles.iconBadge}>
            <Ionicons name={tab.activeIcon} size={19} color={theme.colors.primaryContrast} />
          </LinearGradient>
        ) : (
          <View style={styles.iconBadge}>
            <Ionicons name={tab.icon} size={19} color={theme.colors.navInactive} />
          </View>
        )}
      </Animated.View>
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
}

/** Barra inferior de pestañas. Oculta las pestañas desactivadas por flag remoto. */
export default function AppBottomNav({ activeTab, onChangeTab, isEnabled = () => true }) {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const reducedMotion = useReducedMotion();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const tabs = TABS.filter((tab) => !tab.flag || isEnabled(tab.flag));

  return (
    <View style={[styles.container, { paddingBottom: 12 + insets.bottom }]} accessibilityRole="tablist">
      {tabs.map((tab) => (
        <TabItem
          key={tab.key}
          tab={tab}
          isActive={tab.key === activeTab}
          onPress={onChangeTab}
          theme={theme}
          styles={styles}
          reducedMotion={reducedMotion}
        />
      ))}
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
      paddingTop: theme.spacing.sm,
      paddingHorizontal: 6,
    },
    item: { flex: 1, minWidth: 0, minHeight: 48, alignItems: 'center', gap: 3, paddingVertical: 2 },
    iconBadge: { width: 38, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    label: {
      ...theme.typography.label,
      fontSize: 11,
      lineHeight: 14,
      color: theme.colors.navInactive,
      maxWidth: '100%',
      textAlign: 'center',
    },
    labelActive: { ...theme.typography.button, fontSize: 11, lineHeight: 14, color: theme.colors.primary },
  });
}
