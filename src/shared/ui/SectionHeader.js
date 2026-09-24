import { StyleSheet, View } from 'react-native';
import AppText from './AppText';

/** Título + subtítulo de sección (inicio de cada tab). `right` para una acción. */
export default function SectionHeader({ title, subtitle, right }) {
  return (
    <View style={styles.row}>
      <View style={styles.texts}>
        <AppText variant="title" accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="subtitle" tone="secondary">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  texts: { flex: 1, gap: 4 },
});
