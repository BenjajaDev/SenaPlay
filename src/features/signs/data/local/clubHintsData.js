import { createObservedHints } from '../../domain/observedHints';
import hintsFile from '../content/clubTalcaHints.json';

// `clubTalcaHints.json` lo genera una herramienta aparte (landmarks de MediaPipe
// sobre los videos del club). Una seña sin entrada usa las pistas de siempre.

/** Pistas observadas de las señas del club. */
export const OBSERVED_HINTS = createObservedHints(hintsFile);
