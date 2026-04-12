import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function GameScreenHeader({ title, onBack, rightNode }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={8}>
        <Ionicons name="arrow-back" size={26} color="#0F172A" />
      </Pressable>
      <Text style={styles.title}>{title}</Text>
      {rightNode || <View style={styles.spacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  spacer: {
    width: 26,
  },
});
