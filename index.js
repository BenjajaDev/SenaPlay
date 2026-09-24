import { registerRootComponent } from 'expo';

import { applyPoppinsGlobally } from './src/shared/theme/applyPoppinsGlobally';
import App from './App';

// Pone Poppins como fuente por defecto de toda la app. Debe ejecutarse antes
// de que cualquier pantalla renderice; ver applyPoppinsGlobally.js para el detalle.
applyPoppinsGlobally();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
