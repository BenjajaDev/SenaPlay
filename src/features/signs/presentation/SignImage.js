import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { getSignAssets } from '../data/local/signAssets';
import { useAppTheme } from '../../../shared/theme/ThemeProvider';
import { poppins } from '../../../shared/theme/fonts';
import useVariationSwipe from './useVariationSwipe';

// Acciones del lector de pantalla (deslizar arriba/abajo sobre la seña).
const VARIATION_ACTIONS = [
  { name: 'increment', label: 'Siguiente variación' },
  { name: 'decrement', label: 'Variación anterior' },
];

/**
 * Muestra la imagen/GIF de una seña.
 *
 * Reemplaza al glifo tipográfico (fuente ChileanSignLanguage) que se usaba antes:
 * una fuente no puede representar señas con movimiento ni mostrar la mano real,
 * y depende de que la fuente cargue bien en todos los dispositivos.
 *
 * Cuando una seña tiene más de una foto válida (ej: variaciones de
 * configuración manual en T, X, Y), se cambia de variación ARRASTRANDO la
 * seña hacia los lados (useVariationSwipe); los puntos de abajo indican
 * cuántas hay. Nada se mueve solo: lo decide la persona. Con lector de
 * pantalla es un control ajustable (deslizar arriba/abajo).
 *
 * Mientras no existan los recursos gráficos, dibuja un placeholder que deja
 * claro qué seña va ahí (la letra) sin parecer un error de la app.
 *
 * Props:
 *   signKey  clave en el registro (ej: 'a', 'hola')
 *   label    texto a mostrar en el placeholder; por defecto signKey en mayúsculas
 *   size     lado del cuadro en px (default 72)
 *   rounded  radio del borde (default 14)
 */
export default function SignImage({
  signKey,
  label,
  size = 72,
  rounded = 14,
  style,
  showPlaceholderIcon = true,
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const assets = getSignAssets(signKey);
  const texto = label !== undefined ? label : String(signKey || '').toLocaleUpperCase('es');
  const caja = { width: size, height: size, borderRadius: rounded };

  const [index, setIndex] = useState(0);
  const hasCarousel = assets.length > 1;
  const { translateX, panHandlers, step } = useVariationSwipe({
    index,
    count: assets.length,
    width: size,
    onIndexChange: setIndex,
  });

  // Si cambia la seña mostrada (ej: se reordena un ejercicio) se reinicia.
  useEffect(() => {
    setIndex(0);
    translateX.setValue(0);
  }, [signKey, translateX]);

  // Al arrastrar, la imagen se atenúa un poco hacia los bordes: ayuda a leer
  // que está por cambiar.
  const opacity = translateX.interpolate({
    inputRange: [-size, 0, size],
    outputRange: [0.4, 1, 0.4],
    extrapolate: 'clamp',
  });

  if (assets.length > 0) {
    const nombre = `Seña de ${texto}`;
    return (
      <View
        style={[caja, styles.marco, style]}
        {...(hasCarousel ? panHandlers : null)}
        accessible
        accessibilityRole={hasCarousel ? 'adjustable' : 'image'}
        accessibilityLabel={nombre}
        accessibilityValue={hasCarousel ? { text: `Variación ${index + 1} de ${assets.length}` } : undefined}
        accessibilityHint={hasCarousel ? 'Desliza hacia los lados para ver otra variación' : undefined}
        accessibilityActions={hasCarousel ? VARIATION_ACTIONS : undefined}
        onAccessibilityAction={(event) => step(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
      >
        <Animated.Image
          source={assets[index]}
          style={[styles.imagen, caja, hasCarousel && { opacity, transform: [{ translateX }] }]}
          resizeMode="contain"
        />
        {hasCarousel ? (
          <View pointerEvents="none" style={styles.dotsRow}>
            {assets.map((_, dotIndex) => (
              <View key={`dot-${dotIndex}`} style={[styles.dot, dotIndex === index && styles.dotActive]} />
            ))}
          </View>
        ) : null}
      </View>
    );
  }

  // ── Placeholder ──
  // El tamaño de la tipografía se escala con la caja para que sirva igual en la
  // grilla del diccionario (chica) que en el modal de detalle (grande).
  const tamañoTexto = Math.max(12, Math.round(size * 0.34));
  const tamañoIcono = Math.max(12, Math.round(size * 0.22));

  return (
    <View
      style={[styles.placeholder, caja, style]}
      accessible
      accessibilityLabel={`Imagen de la seña ${texto} pendiente`}
    >
      {showPlaceholderIcon ? (
        <Ionicons
          name="hand-left-outline"
          size={tamañoIcono}
          color={theme.colors.primary}
          style={styles.icono}
        />
      ) : null}
      <Text style={[styles.texto, { fontSize: tamañoTexto }]} numberOfLines={1}>
        {texto}
      </Text>
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    imagen: {
      position: 'absolute',
      top: 0,
      left: 0,
      backgroundColor: theme.colors.surfaceSunken,
    },
    // Recorta la imagen mientras se arrastra: no se sale de su casilla.
    marco: { overflow: 'hidden', backgroundColor: theme.colors.surfaceSunken },
    dotsRow: {
      position: 'absolute',
      bottom: 4,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 4,
    },
    dot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: theme.colors.borderStrong,
    },
    // La activa es más ancha además de tener color: no se informa solo con color.
    dotActive: {
      width: 12,
      backgroundColor: theme.colors.primary,
    },
    placeholder: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceSunken,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      borderStyle: 'dashed',
      paddingHorizontal: 4,
      gap: 2,
    },
    icono: {
      opacity: 0.75,
    },
    texto: {
      fontFamily: poppins(900),
      color: theme.colors.primary,
      textAlign: 'center',
    },
  });
}
