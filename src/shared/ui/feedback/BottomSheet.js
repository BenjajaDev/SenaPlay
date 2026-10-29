import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useReducedMotion from '../../../core/a11y/useReducedMotion';
import { useAppTheme } from '../../theme/ThemeProvider';
import AppText from '../AppText';
import IconButton from '../IconButton';

/**
 * Hoja inferior para formularios y menús (editar perfil, filtros). Sube desde
 * su propio alto, baja por el mismo camino al cerrarse, respeta teclado y
 * safe area, y se cierra con la X, el fondo o el botón atrás — salvo que
 * `dismissible` sea false (ej. guardando).
 *
 * El Modal no anima por su cuenta: la hoja y el fondo usan el mismo valor,
 * así entrar y salir es un solo movimiento. Con «reducir movimiento» solo
 * hay un fade breve, sin desplazamiento.
 */
export default function BottomSheet({ visible, title, onClose, dismissible = true, children, footer }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const progress = useRef(new Animated.Value(0)).current;
  const animationRef = useRef(null);
  // El Modal sigue montado mientras la hoja baja; se desmonta al terminar.
  const [rendered, setRendered] = useState(visible);
  const [height, setHeight] = useState(0);

  const animateTo = (toValue, onFinish) => {
    const { duration, easing } = theme.motion;
    animationRef.current?.stop();
    animationRef.current = Animated.timing(progress, {
      toValue,
      duration: reducedMotion ? duration.instant : toValue ? duration.slow : duration.base,
      easing: toValue ? easing.drawer : easing.exit,
      useNativeDriver: true,
    });
    animationRef.current.start(({ finished }) => finished && onFinish?.());
  };

  useEffect(() => {
    if (visible) {
      setRendered(true);
      // Si se reabre mientras bajaba, el alto ya se conoce: sube desde donde está.
      if (height) animateTo(1);
      return undefined;
    }
    if (!rendered) return undefined;
    animateTo(0, () => {
      setRendered(false);
      setHeight(0);
    });
    return () => animationRef.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Recién al conocer el alto se sabe desde dónde subir.
  const handleLayout = (event) => {
    const measured = event.nativeEvent.layout.height;
    if (!height && visible) {
      progress.setValue(0);
      animateTo(1);
    }
    if (measured !== height) setHeight(measured);
  };

  const close = () => {
    if (dismissible) onClose?.();
  };

  const offset = reducedMotion ? 0 : height || 2000;

  return (
    <Modal visible={rendered} transparent animationType="none" statusBarTranslucent onRequestClose={close}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: progress }]}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={close}
              disabled={!dismissible}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
            />
          </Animated.View>
          <Animated.View
            accessibilityViewIsModal
            onLayout={handleLayout}
            style={[
              styles.sheet,
              { paddingBottom: insets.bottom + theme.spacing.lg },
              {
                opacity: reducedMotion ? progress : 1,
                transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) }],
              },
            ]}
          >
            <View style={styles.handle} importantForAccessibility="no" accessibilityElementsHidden />
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
    container: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { backgroundColor: colors.overlay },
    sheet: {
      maxHeight: '88%',
      backgroundColor: colors.surfaceRaised,
      borderTopLeftRadius: radius.xxl,
      borderTopRightRadius: radius.xxl,
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
