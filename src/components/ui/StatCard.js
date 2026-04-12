import { StyleSheet, Text, View } from 'react-native';

const TONE_STYLES = {
  green: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  orange: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  blue: { backgroundColor: '#ECFEFF', borderColor: '#BAE6FD' },
  violet: { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' },
};

export default function StatCard({ label, value, tone = 'violet', style }) {
  return (
    <View style={[styles.card, TONE_STYLES[tone] || TONE_STYLES.violet, style]}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
  },
  value: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1E293B',
  },
  label: {
    marginTop: 5,
    fontSize: 12,
    color: '#475569',
  },
});
