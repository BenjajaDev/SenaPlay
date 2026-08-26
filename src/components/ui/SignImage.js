import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { getSignAsset } from '../../data/signAssets';
import { useAppTheme } from '../../theme/ThemeProvider';

/**
 * Muestra la imagen/GIF de una seña.
 *
 * Reemplaza al glifo tipográfico (fuente ChileanSignLanguage) que se usaba antes:
 * una fuente no puede representar señas con movimiento ni mostrar la mano real,
 * y depende de que la fuente cargue bien en todos los dispositivos.
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

  const asset = getSignAsset(signKey);
  const texto = label !== undefined ? label : String(signKey || '').toLocaleUpperCase('es');

  const caja = { width: size, height: size, borderRadius: rounded };

  if (asset) {
    return (
      <Image
        source={asset}
        style={[styles.imagen, caja, style]}
        resizeMode="contain"
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Seña de ${texto}`}
      />
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
      backgroundColor: theme.mode === 'dark' ? '#1B1730' : '#F7F4FC',
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
