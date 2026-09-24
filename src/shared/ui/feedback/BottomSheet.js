import { useEffect, useMemo, useRef } from 'react';
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useReducedMotion from '../../../core/a11y/useReducedMotion';
import { useAppTheme } from '../../theme/ThemeProvider';
import AppText from '../AppText';
import IconButton from '../IconButton';

/**
 * Hoja inferior para formularios y menús (editar perfil, filtros). Sube con
 * una animación corta, respeta teclado y safe area, y se cierra con la X, el
 * fondo o el botón atrás — salvo que `dismissible` sea false (ej. guardando).
 */
export default function BottomSheet({ visible, title, onClose, dismissible = true, children, footer }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    slide.setValue(reducedMotion ? 1 : 0);
    if (!reducedMotion) {
      Animated.timing(slide, {
        toValue: 1,
        duration: theme.motion.duration.slow,
        easing: theme.motion.easing.enter,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, reducedMotion, slide, theme]);

  const close = () => {
    if (dismissible) onClose?.();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Cerrar" />
          <Animated.View
            accessibilityViewIsModal
            style={[
              styles.sheet,
              { paddingBottom: insets.bottom + theme.spacing.lg },
              { transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) }] },
            ]}
          >
            <View style={styles.handle} />
            <View style={styles.header}>
              <AppText variant="title" style={styles.flex} accessibilityRole="header">
                {title}
              </AppText>
              {dismissible ? <IconButton icon="close" label="Cerrar" onPress={close} /> : null}
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
              {children}
            </ScrollView>
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(theme) {
  const { colors, spacing, radius } = theme;
  return StyleSheet.create({
    flex: { flex: 1 },
    backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
    sheet: {
      maxHeight: '88%',
      backgroundColor: colors.surfaceRaised,
      borderTopLeftRadius: radius.xxl + 4,
      borderTopRightRadius: radius.xxl + 4,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      ...theme.elevation.lg,
    },
    handle: {
      alignSelf: 'center',
      width: 44,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.borderStrong,
      marginBottom: spacing.sm,
    },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
    body: { gap: spacing.md, paddingBottom: spacing.md },
    footer: { paddingTop: spacing.sm },
  });
}
