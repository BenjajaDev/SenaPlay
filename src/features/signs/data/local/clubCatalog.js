// Índice del curso del Club de Sordos de Talca empaquetado en la app: orden de
// las señas y su palabra legible. Sale del mismo JSON que publica los clips
// (scripts/clubTalca), así el orden del diccionario no depende de la red.
import clipsFile from '../content/clubTalcaClips.json';
import { buildClubIndex } from '../../domain/clubDictionary';

export const CLUB_INDEX = buildClubIndex(clipsFile.clips);
