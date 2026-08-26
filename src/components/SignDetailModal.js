import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SignImage from './ui/SignImage';
import { hasSignAsset } from '../data/signAssets';
import { useAppTheme } from '../theme/ThemeProvider';

/**
 * Modal de detalle de una seña: imagen/GIF grande + cómo se hace.
 *
 * Recibe un objeto ya normalizado (ver `toSignDetail` en DictionaryTabScreen)
 * para servir igual a las entradas de deletreo y a las señas léxicas, que
 * tienen formas distintas en los datos.
 *
 * detail = {
 *   signKey,      clave del registro de imágenes
 *   title,        encabezado (letra o palabra)
 *   subtitle?,    categoría / tema
 *   badge?,       dificultad o tipo gramatical
 *   badgeColor?,
 *   description?, qué significa
 *   howTo?,       cómo se ejecuta el gesto
 *   source?,      referencia bibliográfica
 * }
 */
export default function SignDetailModal({ visible, detail, onClose }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (!detail) return null;

  const tieneImagen = hasSignAsset(detail.signKey);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Tocar fuera cierra. El Pressable interior detiene la propagación para
          que tocar la tarjeta no la cierre por accidente. */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.card,
            { marginTop: insets.top + 16, marginBottom: insets.bottom + 16 },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.headerRow}>
            <View style={styles.headerTexts}>
              <Text style={styles.title}>{detail.title}</Text>
              {detail.subtitle ? (
                <Text style={styles.subtitle}>{detail.subtitle}</Text>
              ) : null}
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.imageWrap}>
              <SignImage signKey={detail.signKey} label={detail.title} size={190} rounded={20} />
              {!tieneImagen ? (
                <Text style={styles.pendingNote}>
                  Imagen de la seña pendiente
                </Text>
              ) : null}
            </View>

            {detail.badge ? (
              <View style={styles.badgeRow}>
                <View
                  style={[
                    styles.badge,
                    detail.badgeColor ? { backgroundColor: detail.badgeColor } : styles.badgeNeutral,
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      !detail.badgeColor && { color: theme.colors.primary },
                    ]}
                  >
                    {detail.badge}
                  </Text>
                </View>
              </View>
            ) : null}

            {detail.description ? (
              <Text style={styles.description}>{detail.description}</Text>
            ) : null}

            {detail.howTo ? (
              <View style={styles.howToBox}>
                <Text style={styles.howToLabel}>Cómo se hace</Text>
                <Text style={styles.howToText}>{detail.howTo}</Text>
              </View>
            ) : null}

            {detail.source ? <Text style={styles.source}>{detail.source}</Text> : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(6, 4, 16, 0.62)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
    },
    card: {
      width: '100%',
      maxWidth: 420,
      maxHeight: '86%',
      backgroundColor: theme.colors.surface,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingTop: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerTexts: { flex: 1, paddingRight: 10 },
    title: { fontSize: 20, fontWeight: '900', color: theme.colors.textPrimary },
    subtitle: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
    closeBtn: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 16,
    },
    body: { flexGrow: 0 },
    bodyContent: { padding: 18, gap: 14 },
    imageWrap: { alignItems: 'center', gap: 8 },
    pendingNote: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      fontStyle: 'italic',
    },
    badgeRow: { flexDirection: 'row', justifyContent: 'center' },
    badge: {
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 4,
    },
    badgeNeutral: {
      backgroundColor: theme.mode === 'dark' ? '#33294F' : '#EDE7F6',
    },
    badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
    description: {
      fontSize: 14,
      color: theme.colors.textPrimary,
      lineHeight: 20,
      textAlign: 'center',
    },
    howToBox: {
      padding: 12,
      borderRadius: 14,
      backgroundColor: theme.mode === 'dark' ? '#221F31' : '#F7F4FC',
      borderWidth: 1,
      borderColor: theme.mode === 'dark' ? '#3A3352' : '#E6DEF6',
    },
    howToLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: theme.colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 5,
    },
    howToText: { fontSize: 13, color: theme.colors.textPrimary, lineHeight: 19 },
    source: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      fontStyle: 'italic',
      textAlign: 'center',
    },
  });
}
