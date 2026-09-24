// Genera src/styles/tokens.generated.css a partir de los tokens de la app
// móvil (src/shared/theme/tokens). Una sola fuente de verdad: si cambia un
// color en la app, el portal web lo toma en el próximo `pnpm dev`/`build`.
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const tokensDir = path.resolve(here, '../../src/shared/theme/tokens');

// Los archivos de tokens son ESM en un paquete sin "type": "module"; se
// cargan como data-URL para evitar el aviso de Node y no depender de él.
async function load(file) {
  const source = readFileSync(path.join(tokensDir, file), 'utf8');
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}

const { lightColors, darkColors } = await load('colors.js');
const { lightGradients, darkGradients } = await load('gradients.js');

const kebab = (key) => key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
const gradientCss = (g) => {
  const angle = g.start.y === g.end.y ? 90 : g.start.x === g.end.x ? 180 : 135;
  return `linear-gradient(${angle}deg, ${g.colors.join(', ')})`;
};
const block = (colors, gradients) =>
  [
    ...Object.entries(colors).map(([k, v]) => `  --color-${kebab(k)}: ${v};`),
    ...Object.entries(gradients).map(([k, g]) => `  --gradient-${kebab(k)}: ${gradientCss(g)};`),
  ].join('\n');

const css = `/* ARCHIVO GENERADO por scripts/syncTokens.mjs — no editar a mano. */
:root {
${block(lightColors, lightGradients)}
  color-scheme: light;
}

:root[data-theme='dark'] {
${block(darkColors, darkGradients)}
  color-scheme: dark;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
${block(darkColors, darkGradients).replace(/^/gm, '  ')}
    color-scheme: dark;
  }
}
`;

const out = path.resolve(here, '../src/styles/tokens.generated.css');
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, css);
console.log(`Tokens sincronizados → ${path.relative(process.cwd(), out)}`);
