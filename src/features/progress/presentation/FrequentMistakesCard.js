import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Badge, Button, Card } from '../../../shared/ui';
import { useAppTheme } from '../../../shared/theme/ThemeProvider';
import SignImage from '../../signs/presentation/SignImage';

const times = (n) => `${n} ${n === 1 ? 'vez' : 'veces'}`;

/**
 * «Tus errores frecuentes»: los ejercicios que más se le complican al
 * usuario, con la seña, cuántas veces falló y qué respondió más seguido.
 * «Repasar» abre el nivel, donde esos ejercicios entran primero al sorteo.
 */
export default function FrequentMistakesCard({ items, onPractice }) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (!items) return null;

  return (
    <Card padding="lg" style={styles.panel}>
      <View style={styles.titleRow}>
        <Ionicons name="school-outline" size={20} color={theme.colors.primary} />
        <AppText variant="heading" style={styles.flex}>
          Tus errores frecuentes
        </AppText>
      </View>

      {!items.length ? (
        <View style={styles.empty}>
          <Ionicons name="sparkles-outline" size={18} color={theme.colors.successText} />
          <AppText variant="caption" tone="secondary" style={styles.flex}>
            Aún no hay errores repetidos. Cuando algo se te complique en un nivel, aparecerá aquí para que lo repases.
          </AppText>
        </View>
      ) : (
        items.map((item) => {
          const firstSign = item.sign ? String(item.sign).split(' ')[0] : null;
          return (
            <View
              key={`${item.levelId}-${item.exerciseKey}`}
              style={styles.row}
              accessible
              accessibilityLabel={`Nivel ${item.levelId}, ${item.title || 'ejercicio'}: fallaste ${times(item.count)}${
                item.topAnswer ? `, sueles responder ${item.topAnswer}` : ''
              }`}
            >
              {firstSign ? (
                <SignImage signKey={firstSign} size={48} rounded={theme.radius.md} />
              ) : (
                <View style={styles.iconBox}>
                  <Ionicons name="help-circle-outline" size={24} color={theme.colors.primary} />
                </View>
              )}
              <View style={styles.flex}>
                <AppText variant="bodyStrong" numberOfLines={2}>
                  {item.title || 'Ejercicio'}
                </AppText>
                <AppText variant="caption" tone="secondary">
                  {`Nivel ${item.levelId} · fallaste ${times(item.count)}`}
                  {item.topAnswer ? ` · sueles responder «${item.topAnswer}»` : ''}
                </AppText>
                {item.gameOvers ? (
                  <View style={styles.badgeRow}>
                    <Badge label={`Te dejó sin vidas ${times(item.gameOvers)}`} tone="warning" icon="heart-dislike-outline" />
                  </View>
                ) : null}
              </View>
            </View>
          );
        })
      )}

      {items.length && onPractice ? (
        <Button
          label={`Repasar nivel ${items[0].levelId}`}
          icon="refresh"
          variant="secondary"
          onPress={() => onPractice(items[0].levelId)}
        />
      ) : null}
    </Card>
  );
}

function createStyles(theme) {
  const { spacing, radius, colors } = theme;
  return StyleSheet.create({
    panel: { gap: spacing.md },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    flex: { flex: 1 },
    empty: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    iconBox: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
    badgeRow: { flexDirection: 'row', marginTop: 4 },
  });
}
