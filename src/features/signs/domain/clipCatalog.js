// Glosas del catálogo sanitario del MVP que necesitan clip. El panel las
// muestra como lista de avance (sin clip, borrador, en revisión, validada,
// publicada). Fuente: docs/ai/catalogo_sanitario_propuesto.md, todavía
// pendiente de validación con la comunidad sorda: si cambia el catálogo,
// se cambia aquí. Se pueden subir clips de otras glosas igual.

const entries = (level, glosses) => glosses.map((gloss) => Object.freeze({ gloss, level }));

export const MVP_CLIP_CATALOG = Object.freeze([
  ...entries(1, ['DOLOR', 'FIEBRE', 'ENFERMO/A', 'AYUDA', 'MÉDICO / DOCTOR', 'REMEDIO / MEDICAMENTO', 'TENER', 'NECESITAR', 'NO', 'SÍ', 'MUCHO', 'POCO']),
  ...entries(2, ['HOSPITAL / URGENCIA', 'TOS', 'MAREO', 'VÓMITO', 'ALERGIA', 'RESPIRAR', 'CANSADO/A', 'AGUA / TOMAR', 'BAÑO', 'MEJOR', 'PEOR']),
  ...entries(3, ['DÓNDE', 'QUÉ', 'CUÁNDO', 'AHORA', 'HOY', 'AYER', 'MAÑANA', 'DESDE / HACE']),
]);

export const MVP_CLIP_LEVEL_LABELS = Object.freeze({
  1: 'Nivel 1 · Núcleo',
  2: 'Nivel 2 · Síntomas y necesidades',
  3: 'Nivel 3 · Preguntas y tiempo',
});
