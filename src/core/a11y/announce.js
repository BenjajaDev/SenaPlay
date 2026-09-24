import { AccessibilityInfo } from 'react-native';

// Anuncia un mensaje al lector de pantalla (TalkBack/VoiceOver) sin mover el
// foco. Se usa junto al feedback visual de acierto/error para que quien usa
// lector de pantalla reciba la misma información.
export default function announce(message) {
  if (!message) return;
  try {
    AccessibilityInfo.announceForAccessibility(String(message));
  } catch {
    /* plataforma sin soporte: el feedback visual sigue presente */
  }
}
