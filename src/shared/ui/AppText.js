import { Text } from 'react-native';
import { useAppTheme } from '../theme/ThemeProvider';

const TONE_TO_COLOR = {
  primary: 'textPrimary',
  secondary: 'textSecondary',
  muted: 'textMuted',
  brand: 'primary',
  inverse: 'primaryContrast',
  success: 'successText',
  danger: 'dangerText',
  warning: 'warningText',
  info: 'infoText',
  gold: 'goldText',
};

/**
 * Texto tipográfico del sistema de diseño: variante (tamaño/peso) + tono
 * (color semántico). Reemplaza los `fontSize`/`fontWeight`/`color` sueltos en
 * cada pantalla, que eran la principal fuente de inconsistencias y de hex
 * hardcodeados que se rompían en modo oscuro.
 *
 *   <AppText variant="title">Niveles</AppText>
 *   <AppText variant="caption" tone="muted">3 de 8 completados</AppText>
 */
export default function AppText({ variant = 'body', tone = 'primary', align, style, children, ...rest }) {
  const theme = useAppTheme();
  const colorKey = TONE_TO_COLOR[tone] || tone;
  const color = theme.colors[colorKey] || theme.colors.textPrimary;

  return (
    <Text
      {...rest}
      style={[theme.typography[variant] || theme.typography.body, { color }, align ? { textAlign: align } : null, style]}
    >
      {children}
    </Text>
  );
}
