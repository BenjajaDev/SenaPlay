import { Ionicons } from '@expo/vector-icons';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import announce from '../../../core/a11y/announce';
import useReducedMotion from '../../../core/a11y/useReducedMotion';
import haptics from '../../../core/feedback/haptics';
import { useAppTheme } from '../../../shared/theme/ThemeProvider';
import { AppText } from '../../../shared/ui';
import { CLUB_INDEX } from '../data/local/clubCatalog';
import { signDisplayName } from '../domain/signName';
import { useSignClips } from './SignClipsProvider';

/** Tiempo en pantalla: lo justo para leer una o dos palabras sin apurarse. */
export const SIGN_NAME_VISIBLE_MS = 2600;

// Sobre la barra de pestañas y el botón «Comprobar» de los niveles, que viven abajo.
const BOTTOM_CLEARANCE = 96;

const SignNameHintContext = createContext({ showSignName: () => {} });

/**
 * Pista del nombre: al mantener presionada una seña aparece abajo, sin
 * bloquear, «Esta seña es · Buenos días». Es gratis y vale en toda la app
 * (SeñaPlay es para practicar: ver el nombre sirve para comprobar, no regala
 * puntaje). Se cierra sola o al tocarla.
 */
export function SignNameHintProvider({ children }) {
  const { clipFor } = useSignClips();
  const [hint, setHint] = useState(null);
  const nextId = useRef(0);

  const showSignName = useCallback(
    (signKey) => {
      const name = signDisplayName(signKey, { wordByKey: CLUB_INDEX.wordByKey, clip: clipFor(signKey) });
      if (!name) return;
      nextId.current += 1;
      haptics.selection();
      announce(`Esta seña es ${name}`);
      setHint({ id: nextId.current, name });
    },
    [clipFor],
  );

  const hide = useCallback((id) => setHint((current) => (current?.id === id ? null : current)), []);
  const value = useMemo(() => ({ showSignName }), [showSignName]);

  return (
    <SignNameHintContext.Provider value={value}>
      <View style={styles.root}>
        {children}
        <SignNameBanner hint={hint} onHide={hide} />
      </View>
    </SignNameHintContext.Provider>
  );
}

/** `showSignName(signKey)`: muestra el nombre de esa seña. Sin provider no hace nada. */
export const useSignNameHint = () => useContext(SignNameHintContext);

export function SignNameBanner({ hint, onHide }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const themed = useMemo(() => createStyles(theme), [theme]);
  const appear = useRef(new Animated.Value(0)).current;
  // Con un aviso ya visible, el siguiente reemplaza el nombre sin volver a
  // entrar desde cero: mantener presionadas varias señas seguidas no parpadea.
  const onScreen = useRef(false);

  useEffect(() => {
    if (!hint) {
      onScreen.current = false;
      return undefined;
    }
    if (!onScreen.current) appear.setValue(0);
    onScreen.current = true;
    Animated.timing(appear, {
      toValue: 1,
      duration: reducedMotion ? theme.motion.duration.instant : theme.motion.duration.base,
      easing: theme.motion.easing.enter,
      useNativeDriver: true,
    }).start();
    const timer = setTimeout(() => {
      Animated.timing(appear, {
        toValue: 0,
        duration: theme.motion.duration.fast,
        easing: theme.motion.easing.exit,
        useNativeDriver: true,
      }).start(({ finished }) => finished && onHide(hint.id));
    }, SIGN_NAME_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [hint, appear, onHide, reducedMotion, theme]);

  if (!hint) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        themed.wrapper,
        { bottom: insets.bottom + BOTTOM_CLEARANCE },
        {
          opacity: appear,
          transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [reducedMotion ? 0 : 12, 0] }) }],
        },
      ]}
    >
      <Pressable
        onPress={() => onHide(hint.id)}
        accessibilityRole="button"
        accessibilityLabel={`Esta seña es ${hint.name}`}
        accessibilityHint="Toca para cerrar"
        style={themed.banner}
      >
        <View style={themed.iconWrap}>
          <Ionicons name="hand-left" size={20} color={theme.colors.primary} />
        </View>
        <View style={themed.texts}>
          <AppText variant="caption" tone="secondary">
            Esta seña es
          </AppText>
          <AppText variant="title" numberOfLines={2}>
            {hint.name}
          </AppText>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });

function createStyles(theme) {
  const { colors, spacing, radius } = theme;
  return StyleSheet.create({
    wrapper: { position: 'absolute', left: spacing.lg, right: spacing.lg, alignItems: 'center', zIndex: 1000, elevation: 20 },
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      maxWidth: 420,
      paddingVertical: spacing.md,
      paddingLeft: spacing.md,
      paddingRight: spacing.xl,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceRaised,
      ...theme.elevation.md,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primarySoft,
    },
    texts: { flexShrink: 1 },
  });
}
