import { darkColors, lightColors } from '../tokens/colors';
import { darkGradients, lightGradients } from '../tokens/gradients';

// Verifica WCAG 2.1 AA (4.5:1 texto normal) para las combinaciones que la UI
// realmente usa. Si cambias un color de la paleta y este test falla, el cambio
// deja texto ilegible para personas con baja visión.

function luminance(hex) {
  const channels = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT_PAIRS = [
  ['textPrimary', 'background'],
  ['textPrimary', 'surface'],
  ['textSecondary', 'surface'],
  ['textSecondary', 'background'],
  ['textMuted', 'surface'],
  ['textMuted', 'surfaceRaised'],
  ['primary', 'surface'],
  ['primaryContrast', 'primary'],
  ['successText', 'surface'],
  ['dangerText', 'surface'],
  ['warningText', 'surface'],
  ['infoText', 'surface'],
  ['goldText', 'surface'],
  ['onSuccess', 'success'],
  ['onDanger', 'danger'],
  ['onWarning', 'warning'],
  ['onInfo', 'info'],
  ['navInactive', 'surface'],
];

describe.each([
  ['claro', lightColors, lightGradients],
  ['oscuro', darkColors, darkGradients],
])('contraste AA — tema %s', (_name, colors, gradients) => {
  test.each(TEXT_PAIRS)('%s sobre %s ≥ 4.5', (fg, bg) => {
    expect(contrastRatio(colors[fg], colors[bg])).toBeGreaterThanOrEqual(4.5);
  });

  test('texto sobre todos los colores del degradé de marca ≥ 4.5', () => {
    gradients.brand.colors.forEach((stop) => {
      expect(contrastRatio(colors.primaryContrast, stop)).toBeGreaterThanOrEqual(4.5);
    });
  });

  test('ambos temas definen exactamente los mismos tokens', () => {
    expect(Object.keys(colors).sort()).toEqual(Object.keys(lightColors).sort());
    expect(Object.keys(gradients).sort()).toEqual(Object.keys(lightGradients).sort());
  });
});
