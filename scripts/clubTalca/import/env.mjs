// Lectura mínima de `.env` en la raíz (solo las variables que el importador necesita).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './domain.mjs';

export function readDotEnv() {
  const file = join(ROOT, '.env');
  if (!existsSync(file)) return {};
  const values = {};
  readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .forEach((line) => {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (match) values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    });
  return values;
}
