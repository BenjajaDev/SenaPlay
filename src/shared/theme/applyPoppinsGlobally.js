import { forwardRef } from 'react';
import { StyleSheet } from 'react-native';
import { APP_FONTS } from './fonts';

// Escala de texto elegida por el usuario en Perfil → Tamaño de letra. Se
// aplica aquí, en el Text/TextInput global, para que alcance también a los
// `fontSize` escritos a mano en cada pantalla (no solo a AppText). Se suma a
// la escala de accesibilidad del sistema, que React Native ya respeta.
let userFontScale = 1;

export function setUserFontScale(scale) {
  const value = Number(scale);
  userFontScale = Number.isFinite(value) && value > 0 ? value : 1;
}

export function getUserFontScale() {
  return userFontScale;
}

function scaledStyle(style) {
  if (userFontScale === 1) return [baseTextStyle, style];
  const flat = StyleSheet.flatten([baseTextStyle, style]) || {};
  return {
    ...flat,
    ...(flat.fontSize ? { fontSize: Math.round(flat.fontSize * userFontScale * 10) / 10 } : { fontSize: 14 * userFontScale }),
    ...(flat.lineHeight ? { lineHeight: Math.round(flat.lineHeight * userFontScale) } : null),
  };
}

// Pone Poppins como fuente base de TODA la app sin tener que tocar cada
// pantalla: se reemplaza el export `Text`/`TextInput` del paquete
// `react-native` por una versión que agrega `fontFamily` por defecto (los
// estilos que cada pantalla ya define se aplican encima y pueden pisarlo).
//
// Debe llamarse una sola vez, en index.js, antes de registrar la app y antes
// de que cualquier pantalla llegue a renderizar (no antes de que se
// *importen* los módulos: `require('react-native')` cachea el mismo objeto
// para todos, así que basta con mutarlo antes del primer render).
let applied = false;

export function applyPoppinsGlobally() {
  if (applied) return;
  applied = true;

  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  const ReactNative = require('react-native');
  const OriginalText = ReactNative.Text;
  const OriginalTextInput = ReactNative.TextInput;

  const PoppinsText = forwardRef((props, ref) => <OriginalText ref={ref} {...props} style={scaledStyle(props.style)} />);
  PoppinsText.displayName = 'Text';

  const PoppinsTextInput = forwardRef((props, ref) => (
    <OriginalTextInput ref={ref} {...props} style={scaledStyle(props.style)} />
  ));
  PoppinsTextInput.displayName = 'TextInput';

  // `react-native` expone Text/TextInput con un getter (carga perezosa), así
  // que una asignación directa (`ReactNative.Text = ...`) tira "Cannot set
  // property which has only a getter". Hay que redefinir la propiedad.
  overrideExport(ReactNative, 'Text', PoppinsText);
  overrideExport(ReactNative, 'TextInput', PoppinsTextInput);
}

function overrideExport(target, key, value) {
  Object.defineProperty(target, key, {
    value,
    writable: true,
    configurable: true,
    enumerable: true,
  });
}

const baseTextStyle = { fontFamily: APP_FONTS.regular };
