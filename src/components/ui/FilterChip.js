import { Pressable, StyleSheet, Text } from 'react-native';

export default function FilterChip({ label, selected, onPress }) {
  return (
    <Pressable style={[styles.chip, selected && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.text, selected && styles.textActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  chipActive: {
    backgroundColor: '#7E57C2',
    borderColor: '#7E57C2',
  },
  text: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  textActive: {
    color: '#FFFFFF',
  },
});
