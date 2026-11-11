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

// expo-video es nativo: en Jest, un reproductor falso que registra las
// llamadas y deja emitir eventos (`player.emit('statusChange', …)`). Los
// reproductores creados quedan en `__players` para inspeccionarlos.
jest.mock('expo-video', () => {
  const { useRef } = require('react');
  const { View } = require('react-native');
  const players = [];
  const createPlayer = () => {
    const listeners = new Map();
    const player = {
      muted: false,
      loop: false,
      playbackRate: 1,
      currentTime: 0,
      playing: false,
      source: null,
      replaceAsync: jest.fn(async (source) => {
        player.source = source;
      }),
      play: jest.fn(() => {
        player.playing = true;
        player.emit('playingChange', { isPlaying: true, oldIsPlaying: false });
      }),
      pause: jest.fn(() => {
        player.playing = false;
      }),
      addListener: (event, listener) => {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event).add(listener);
        return { remove: () => listeners.get(event).delete(listener) };
      },
      emit: (event, payload) => listeners.get(event)?.forEach((listener) => listener(payload)),
    };
    return player;
  };
  return {
    __players: players,
    useVideoPlayer: (_source, setup) => {
      const ref = useRef(null);
      if (!ref.current) {
        ref.current = createPlayer();
        setup?.(ref.current);
        players.push(ref.current);
      }
      return ref.current;
    },
    VideoView: () => <View testID="sign-clip-video" />,
  };
});
