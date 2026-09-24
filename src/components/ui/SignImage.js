import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { getSignAssets } from '../../data/signAssets';
import { useAppTheme } from '../../theme/ThemeProvider';

const CAROUSEL_FADE_MS = 160;

/**
 * Muestra la imagen/GIF de una seña.
 *
 * Reemplaza al glifo tipográfico (fuente ChileanSignLanguage) que se usaba antes:
 * una fuente no puede representar señas con movimiento ni mostrar la mano real,
 * y depende de que la fuente cargue bien en todos los dispositivos.
 *
 * Cuando una seña tiene más de una foto válida (ej: variaciones de
 * configuración manual en T, X, Y), se muestran con flechas para que el
 * usuario navegue entre ellas a su propio ritmo (nada se mueve solo — más
 * accesible que un carrusel automático) con un crossfade suave al cambiar.
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
  const fade = useRef(new Animated.Value(1)).current;
  const hasCarousel = assets.length > 1;

  // Si cambia la seña mostrada (ej: se reordena un ejercicio) se reinicia.
  useEffect(() => {
    setIndex(0);
    fade.setValue(1);
  }, [signKey]);

  const goTo = (nextIndex) => {
    Animated.timing(fade, {
      toValue: 0,
      duration: CAROUSEL_FADE_MS,
      useNativeDriver: true,
    }).start(() => {
      setIndex(nextIndex);
      Animated.timing(fade, {
        toValue: 1,
        duration: CAROUSEL_FADE_MS,
        useNativeDriver: true,
      }).start();
    });
  };

  const goPrev = () => goTo((index - 1 + assets.length) % assets.length);
  const goNext = () => goTo((index + 1) % assets.length);

  // Las flechas se escalan con la caja para seguir siendo tocables en
  // casillas chicas (grillas de emparejar) sin taparle la mano a la imagen.
  const flechaSize = Math.max(11, Math.round(size * 0.16));
  const flechaCaja = Math.max(18, Math.round(size * 0.32));

  if (assets.length > 0) {
    return (
      <View style={[caja, style]}>
        <Animated.Image
          source={assets[index]}
          style={[styles.imagen, caja, { opacity: fade }]}
          resizeMode="contain"
          accessible
          accessibilityRole="image"
          accessibilityLabel={
            hasCarousel
              ? `Seña de ${texto}, variación ${index + 1} de ${assets.length}`
              : `Seña de ${texto}`
          }
        />
        {hasCarousel ? (
          <>
            <Pressable
              onPress={goPrev}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Variación anterior"
              style={[styles.flecha, styles.flechaIzq, { width: flechaCaja, height: flechaCaja, borderRadius: flechaCaja / 2 }]}
            >
              <Ionicons name="chevron-back" size={flechaSize} color="#FFFFFF" />
            </Pressable>
            <Pressable
              onPress={goNext}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Siguiente variación"
              style={[styles.flecha, styles.flechaDer, { width: flechaCaja, height: flechaCaja, borderRadius: flechaCaja / 2 }]}
            >
              <Ionicons name="chevron-forward" size={flechaSize} color="#FFFFFF" />
            </Pressable>
            <View pointerEvents="none" style={styles.dotsRow}>
              {assets.map((_, dotIndex) => (
                <View
                  key={`dot-${dotIndex}`}
                  style={[styles.dot, dotIndex === index && styles.dotActive]}
                />
              ))}
            </View>
          </>
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
      backgroundColor: theme.mode === 'dark' ? '#1B1730' : '#F7F4FC',
    },
    flecha: {
      position: 'absolute',
      top: '50%',
      marginTop: -11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(20, 12, 28, 0.45)',
    },
    flechaIzq: { left: 2 },
    flechaDer: { right: 2 },
    dotsRow: {
      position: 'absolute',
      bottom: 3,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 3,
    },
    dot: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.mode === 'dark' ? 'rgba(244,240,255,0.35)' : 'rgba(43,23,51,0.25)',
    },
    dotActive: {
      backgroundColor: theme.colors.primary,
    },
    placeholder: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.mode === 'dark' ? '#221C35' : '#F3EEFB',
      borderWidth: 1,
      borderColor: theme.mode === 'dark' ? '#4A3D66' : '#DCCDF8',
      borderStyle: 'dashed',
      paddingHorizontal: 4,
      gap: 2,
    },
    icono: {
      opacity: 0.75,
    },
    texto: {
      fontWeight: '900',
      color: theme.colors.primary,
      textAlign: 'center',
    },
  });
}
