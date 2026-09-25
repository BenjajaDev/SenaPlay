import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, ThemeToggle } from '../../../../shared/ui';
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
            <ThemeToggle style={[styles.themeToggle, { top: insets.top + theme.spacing.md }]} />
            <View style={styles.logoWrap}>
              <View style={styles.logoClip}>
                <Image
                  source={theme.isDark ? LOGO_DARK : LOGO_LIGHT}
                  style={styles.logo}
                  resizeMode="contain"
                  accessibilityIgnoresInvertColors
                  accessible
                  accessibilityRole="image"
                  accessibilityLabel="SeñaPlay"
                />
              </View>
            </View>
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

const LOGO_LIGHT = require('../../../../../assets/senaplay_logotipo_claro.png');
const LOGO_DARK = require('../../../../../assets/senaplay_logotipo_oscuro.png');

// Los logotipos oficiales (1024 px) traen el nombre "SeñaPlay" y un fondo
// sólido propio: blanco el claro, #140A1A el oscuro. El dibujo ocupa ~70 % del
// ancho, así que la imagen se agranda un 20 % dentro de la tarjeta para
// recortar parte del margen; el fondo de la tarjeta es el de la propia imagen.
const LOGO_SIZE = 132;
const LOGO_IMAGE_SIZE = Math.round(LOGO_SIZE * 1.2);

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
    themeToggle: { position: 'absolute', right: spacing.lg },
    // La sombra va en logoWrap y el recorte en logoClip: en iOS, overflow
    // 'hidden' en la misma vista también recortaría la sombra.
    logoWrap: {
      width: LOGO_SIZE,
      height: LOGO_SIZE,
      borderRadius: radius.xxl,
      marginBottom: spacing.sm,
      ...theme.elevation.md,
    },
    logoClip: {
      flex: 1,
      borderRadius: radius.xxl,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    logo: { width: LOGO_IMAGE_SIZE, height: LOGO_IMAGE_SIZE },
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
