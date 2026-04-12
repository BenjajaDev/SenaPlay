import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TABS = [
  { key: 'levels', label: 'Niveles', icon: 'layers-outline', activeIcon: 'layers' },
  { key: 'dictionary', label: 'Diccionario', icon: 'book-outline', activeIcon: 'book' },
  { key: 'videos', label: 'Videos', icon: 'videocam-outline', activeIcon: 'videocam' },
  { key: 'games', label: 'Juegos', icon: 'game-controller-outline', activeIcon: 'game-controller' },
  { key: 'progress', label: 'Progreso', icon: 'analytics-outline', activeIcon: 'analytics' },
];

export default function AppBottomNav({ activeTab, onChangeTab }) {
  const insets = useSafeAreaInsets();

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
              color={isActive ? '#7E57C2' : '#7D8597'}
            />
            <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E3E8F3',
    backgroundColor: '#FFFFFF',
    paddingTop: 8,
    paddingHorizontal: 6,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7D8597',
  },
  labelActive: {
    color: '#7E57C2',
  },
});
