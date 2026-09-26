import { useMemo } from 'react';
import { Image, Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Button, IconButton } from '../../../shared/ui';
import { useAppTheme } from '../../../shared/theme/ThemeProvider';

/**
 * Foto de perfil a pantalla completa. Tocar el fondo, la X o el botón atrás
 * de Android la cierra; «Cambiar foto» abre la galería desde aquí mismo.
 */
export default function AvatarViewer({ visible, uri, name, onClose, onChangePhoto }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const styles = useMemo(() => createStyles(theme), [theme]);
  // Cuadrada y lo más grande posible sin tapar la cabecera ni el botón.
  const size = Math.min(width - theme.spacing.lg * 2, height - insets.top - insets.bottom - 220);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar foto">
        <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
          <AppText variant="heading" tone="onHeader" numberOfLines={1} style={styles.flex}>
            {name || 'Tu foto'}
          </AppText>
          <IconButton icon="close" label="Cerrar foto" onPress={onClose} variant="surface" />
        </View>

        <Pressable onPress={() => {}} accessibilityViewIsModal style={styles.center}>
          {uri ? (
            <Image
              source={{ uri }}
              style={[styles.photo, { width: size, height: size }]}
              resizeMode="cover"
              accessible
              accessibilityRole="image"
              accessibilityLabel={`Foto de perfil de ${name || 'tu cuenta'}`}
            />
          ) : null}
        </Pressable>

        <View style={[styles.footer, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
          <Button label="Cambiar foto" icon="camera-outline" onPress={onChangePhoto} />
        </View>
      </Pressable>
    </Modal>
  );
}

function createStyles(theme) {
  const { spacing, radius, colors } = theme;
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: colors.photoBackdrop, justifyContent: 'space-between' },
    flex: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg },
    center: { alignItems: 'center', justifyContent: 'center', flex: 1 },
    photo: { borderRadius: radius.xxl, backgroundColor: colors.surfaceSunken },
    footer: { paddingHorizontal: spacing.lg },
  });
}
