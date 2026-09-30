// Mocks globales de módulos nativos para Jest (no hay dispositivo).
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success', Error: 'error', Warning: 'warning' },
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

// WebView es nativo: en Jest se reemplaza por una vista simple (el
// reproductor de videos y la cámara lo importan al cargar el módulo).
jest.mock('react-native-webview', () => {
  const { View } = require('react-native');
  return { WebView: (props) => <View testID={props.testID} /> };
});
