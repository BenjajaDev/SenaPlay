import { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Badge, IconButton } from '../../../shared/ui';
import { useAppTheme } from '../../../shared/theme/ThemeProvider';
import { hasSignAsset } from '../../signs/data/local/signAssets';
import SignImage from '../../signs/presentation/SignImage';

/**
 * Modal de detalle de una seña: imagen grande + cómo se hace.
 *
 * Recibe un objeto ya normalizado (ver `entryToDetail`/`signToDetail` en
 * DictionaryTabScreen) para servir igual a las entradas de deletreo y a las
 * señas léxicas, que tienen formas distintas en los datos.
 *
 * detail = { signKey, title, subtitle?, badge?, badgeTone?, badgeIcon?,
 *            description?, howTo?, source? }
 */
export default function SignDetailModal({ visible, detail, onClose }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (!detail) return null;
  const hasImage = hasSignAsset(detail.signKey);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      {/* Tocar fuera cierra; el Pressable interior detiene la propagación. */}
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar detalle">
        <Pressable
          style={[styles.card, { marginTop: insets.top + 16, marginBottom: insets.bottom + 16 }]}
          onPress={(event) => event.stopPropagation()}
          accessibilityViewIsModal
        >
          <View style={styles.headerRow}>
            <View style={styles.headerTexts}>
              <AppText variant="title" accessibilityRole="header">
                {detail.title}
              </AppText>
              {detail.subtitle ? (
                <AppText variant="caption" tone="secondary">
                  {detail.subtitle}
                </AppText>
              ) : null}
            </View>
            <IconButton icon="close" label="Cerrar" onPress={onClose} iconSize={22} />
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
            <View style={styles.imageWrap}>
              <SignImage signKey={detail.signKey} label={detail.title} size={190} rounded={theme.radius.xl} />
              {!hasImage ? (
                <AppText variant="caption" tone="muted">
                  Imagen de la seña pendiente
                </AppText>
              ) : null}
            </View>

            {detail.badge ? (
              <View style={styles.center}>
                <Badge label={detail.badge} tone={detail.badgeTone || 'brand'} icon={detail.badgeIcon} />
              </View>
            ) : null}

            {detail.description ? (
              <AppText variant="body" align="center">
                {detail.description}
              </AppText>
            ) : null}

            {detail.howTo ? (
              <View style={styles.howToBox}>
                <AppText variant="label" tone="brand" style={styles.howToLabel}>
                  CÓMO SE HACE
                </AppText>
                <AppText variant="body" style={styles.howToText}>
                  {detail.howTo}
                </AppText>
              </View>
            ) : null}

            {detail.source ? (
              <AppText variant="caption" tone="muted" align="center">
                {detail.source}
              </AppText>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(theme) {
  const { colors, spacing, radius } = theme;
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.scrim,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
    },
    card: {
      width: '100%',
      maxWidth: 420,
      maxHeight: '86%',
      backgroundColor: colors.surfaceRaised,
      borderRadius: radius.xxl,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      ...theme.elevation.lg,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingLeft: spacing.lg + 2,
      paddingRight: spacing.sm,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTexts: { flex: 1, paddingRight: spacing.sm, paddingTop: spacing.xs },
    body: { flexGrow: 0 },
    bodyContent: { padding: spacing.lg + 2, gap: spacing.md + 2 },
    imageWrap: { alignItems: 'center', gap: spacing.sm },
    center: { alignItems: 'center' },
    howToBox: {
      padding: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceSunken,
      borderWidth: 1,
      borderColor: colors.border,
    },
    howToLabel: { letterSpacing: 0.5, marginBottom: spacing.xs },
    howToText: { fontSize: 14, lineHeight: 20 },
  });
}
