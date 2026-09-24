import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../../../shared/ui';
import { useAppTheme } from '../../../../shared/theme/ThemeProvider';

/**
 * Estructura común de las pantallas de autenticación: cabecera con degradé
 * de marca y logo, tarjeta de contenido superpuesta y manejo de teclado y
 * safe area. Las 4 pantallas (login, registro, verificación y nueva
 * contraseña) comparten así el mismo aspecto sin duplicar ~150 líneas de
 * estilos cada una (y sin los colores fijos que ignoraban el modo oscuro).
 */
export default function AuthLayout({ title, subtitle, children, footer }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxl }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient {...theme.gradients.header} style={[styles.hero, { paddingTop: insets.top + theme.spacing.xxl }]}>
            <View style={styles.logoWrap}>
              <Image
                source={require('../../../../../assets/OratioLingo_png.png')}
                style={styles.logo}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
                accessible
                accessibilityLabel="Logo de SeñaPlay"
              />
            </View>
            <AppText variant="display" style={styles.brand}>
              SeñaPlay
            </AppText>
            {subtitle ? (
              <AppText variant="subtitle" align="center" style={styles.heroText}>
                {subtitle}
              </AppText>
            ) : null}
          </LinearGradient>

          <View style={styles.card}>
            {title ? (
              <AppText variant="title" accessibilityRole="header">
                {title}
              </AppText>
            ) : null}
            {children}
          </View>

          {footer ? <View style={styles.footer}>{footer}</View> : null}
          <AppText variant="caption" tone="muted" align="center" style={styles.legal}>
            © {new Date().getFullYear()} SeñaPlay · Lengua de Señas Chilena
          </AppText>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function createStyles(theme) {
  const { colors, spacing, radius } = theme;
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    content: { flexGrow: 1 },
    hero: {
      alignItems: 'center',
      paddingHorizontal: spacing.xxl,
      paddingBottom: spacing.xxxl + spacing.xl,
      gap: spacing.xs,
      borderBottomLeftRadius: radius.xxl + 8,
      borderBottomRightRadius: radius.xxl + 8,
    },
    logoWrap: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: '#FFFFFF', // fondo blanco fijo: el logo es a color sobre blanco
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
      ...theme.elevation.md,
    },
    logo: { width: 66, height: 66 },
    brand: { color: colors.onHeader },
    heroText: { color: colors.onHeader, opacity: 0.95 },
    card: {
      marginTop: -(spacing.xxxl),
      marginHorizontal: spacing.lg + 2,
      padding: spacing.xl,
      gap: spacing.md + 2,
      borderRadius: radius.xxl,
      backgroundColor: colors.surfaceRaised,
      borderWidth: 1,
      borderColor: colors.border,
      ...theme.elevation.lg,
    },
    footer: { marginTop: spacing.lg, paddingHorizontal: spacing.xl, alignItems: 'center' },
    legal: { marginTop: spacing.xl },
  });
}
