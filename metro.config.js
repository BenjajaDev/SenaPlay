// Configuración de Metro: la de Expo por defecto, excluyendo las carpetas del
// repo que no son parte de la app. Sin esto, Metro vigila también web/ y
// ai_module/, y un `pnpm install` dentro de web/ tumba el servidor de
// desarrollo («Detected addition or modification of file web\node_modules…»).
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Rutas absolutas (no solo «/web/»): hay paquetes en node_modules con
// carpetas llamadas web que la app sí necesita.
const escapeForRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const excludeDir = (dir) => new RegExp(`^${escapeForRegExp(path.resolve(__dirname, dir))}[\\\\/].*`);

const existing = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
  excludeDir('web'),
  excludeDir('ai_module'),
];

module.exports = config;
