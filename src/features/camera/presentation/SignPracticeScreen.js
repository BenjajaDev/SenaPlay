import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SIGNS } from '../data/practiceSigns';
import CameraLayout, { CameraIconButton } from './CameraLayout';
import { IaBanner, useSignRecognition } from './signCamera';
import { cameraAlpha, cameraColors } from '../../../shared/theme/tokens/colors';
import { poppins } from '../../../shared/theme/fonts';

// Bajo este valor se considera que un dedo está mal colocado y se nombra en la
// corrección. La nota por dedo la calcula el visor (0–1 por dedo).
const DEDO_CASI = 0.78;

const NOMBRE_DEDO = {
  pulgar: 'Pulgar',
  indice: 'Índice',
  medio: 'Medio',
  anular: 'Anular',
  menique: 'Meñique',
};

/**
 * Práctica de señas por cámara: la IA actúa como instructor.
 *
 * Modo libre    → solo reconoce lo que muestras.
 * Modo práctica → compara tu mano contra la seña objetivo y corrige dedo a dedo.
 *
 * El deletreo vive ahora en SpellingGameScreen, no aquí: son objetivos de
 * aprendizaje distintos (corregir la forma vs. encadenar letras) y mezclarlos
 * en una sola pantalla hacía la barra de controles ilegible.
 */
export default function SignPracticeScreen({ onBack }) {
  const recog = useSignRecognition();

  const [modoActivo, setModoActivo] = useState('libre'); // 'libre' | 'practica'
  const [signIndex, setSignIndex] = useState(0);

  const currentSign = SIGNS[signIndex];
  const { puntuacion, activarModoLibre, activarModoPractica } = recog;

  useEffect(() => {
    if (recog.permisoCamara && !recog.permisoCamara.granted && recog.permisoCamara.canAskAgain) {
      recog.pedirPermisoCamara();
    }
  }, [recog.permisoCamara, recog.pedirPermisoCamara]);

  const cambiarModo = useCallback((key) => {
    setModoActivo(key);
    if (key === 'libre') activarModoLibre();
    else activarModoPractica(currentSign);
  }, [activarModoLibre, activarModoPractica, currentSign]);

  const navSign = useCallback((delta) => {
    const nextIdx = (signIndex + delta + SIGNS.length) % SIGNS.length;
    setSignIndex(nextIdx);
    if (modoActivo === 'practica') activarModoPractica(SIGNS[nextIdx]);
  }, [signIndex, modoActivo, activarModoPractica]);

  // ── Corrección del instructor ──
  // `puntuacion` es la nota global (0–100) que manda el WebView. El desglose por
  // dedo viene en el mismo mensaje cuando el visor está en modo práctica.
  const consejo = useMemo(() => {
    if (modoActivo !== 'practica' || puntuacion === null) return null;
    if (puntuacion >= 92) return { tono: 'ok', texto: '¡Perfecto! Mantén esa forma.' };
    if (puntuacion >= 82) return { tono: 'casi', texto: 'Muy cerca. Ajusta un poco los dedos.' };
    if (puntuacion >= 70) return { tono: 'casi', texto: 'Vas bien, revisa la posición de la mano.' };
    return { tono: 'mal', texto: 'Compara con la mano guía y vuelve a intentarlo.' };
  }, [modoActivo, puntuacion]);

  const dedosFlojos = useMemo(() => {
    const dedos = recog.puntuacionDedos;
    if (!dedos) return [];
    return Object.entries(dedos)
      .filter(([, valor]) => valor < DEDO_CASI)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 2)
      .map(([nombre]) => NOMBRE_DEDO[nombre] || nombre);
  }, [recog.puntuacionDedos]);

  return (
    <CameraLayout title="Práctica de señas" onBack={onBack} recog={recog}>
      <IaBanner
        recog={recog}
        objetivo={modoActivo === 'practica' ? currentSign?.id : null}
        textoInactivo="Muestra una seña para que la IA la reconozca…"
      />

      {/* Libre / Práctica guiada */}
      <View style={estilos2.toggleContenedor} accessibilityRole="tablist">
        {MODOS.map((m) => {
          const activo = modoActivo === m.key;
          return (
            <Pressable
              key={m.key}
              style={({ pressed }) => [estilos2.toggleBtn, activo && estilos2.toggleActivo, pressed && estilos2.presionado]}
              onPress={() => cambiarModo(m.key)}
              accessibilityRole="tab"
              accessibilityLabel={`Modo ${m.label}`}
              accessibilityState={{ selected: activo }}
            >
              <Text style={[estilos2.toggleTexto, activo && estilos2.toggleTextoActivo]} numberOfLines={1}>
                {m.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {modoActivo === 'practica' ? (
        <>
          {/* Consejo del instructor */}
          {consejo ? (
            <View
              style={[
                estilos2.consejoBox,
                consejo.tono === 'ok' && estilos2.consejoOk,
                consejo.tono === 'mal' && estilos2.consejoMal,
              ]}
              accessibilityLiveRegion="polite"
            >
              <Text style={estilos2.consejoTexto}>{consejo.texto}</Text>
              {dedosFlojos.length ? <Text style={estilos2.consejoDedos}>Corrige: {dedosFlojos.join(' y ')}</Text> : null}
            </View>
          ) : (
            <Text style={estilos2.instruccion}>{currentSign?.instruccion}</Text>
          )}

          {/* Navegación de señas */}
          <View style={estilos2.signNav}>
            <CameraIconButton icon="chevron-back" label="Seña anterior" onPress={() => navSign(-1)} />
            <View style={estilos2.signInfo}>
              <Text style={estilos2.signName} numberOfLines={1}>
                {currentSign.nombre}
              </Text>
              {puntuacion !== null ? (
                <Text style={[estilos2.puntuacion, { color: colorPuntuacion(puntuacion) }]}>{puntuacion}% de similitud</Text>
              ) : null}
            </View>
            <CameraIconButton icon="chevron-forward" label="Seña siguiente" onPress={() => navSign(1)} />
          </View>
        </>
      ) : null}
    </CameraLayout>
  );
}

const MODOS = [
  { key: 'libre', label: 'Libre' },
  { key: 'practica', label: 'Práctica guiada' },
];

// El número va siempre escrito: el color solo refuerza.
function colorPuntuacion(valor) {
  if (valor > 88) return cameraColors.success;
  if (valor > 72) return cameraColors.warning;
  return cameraColors.danger;
}

const estilos2 = StyleSheet.create({
  toggleContenedor: {
    flexDirection: 'row',
    backgroundColor: cameraColors.surface,
    borderWidth: 1,
    borderColor: cameraColors.border,
    borderRadius: 12,
    padding: 3,
  },
  toggleBtn: { flex: 1, minHeight: 42, justifyContent: 'center', alignItems: 'center', borderRadius: 10, paddingHorizontal: 6 },
  toggleActivo: { backgroundColor: cameraColors.primary, borderWidth: 1.5, borderColor: cameraColors.accent },
  presionado: { opacity: 0.85 },
  toggleTexto: { color: cameraColors.textMuted, fontFamily: poppins(700), fontSize: 13 },
  toggleTextoActivo: { color: cameraColors.text },
  instruccion: {
    color: cameraColors.textSoft,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  consejoBox: {
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: cameraAlpha('warning', 0.14),
    borderWidth: 1,
    borderColor: cameraAlpha('warning', 0.55),
    alignItems: 'center',
    gap: 2,
  },
  consejoOk: {
    backgroundColor: cameraAlpha('success', 0.14),
    borderColor: cameraAlpha('success', 0.6),
  },
  consejoMal: {
    backgroundColor: cameraAlpha('danger', 0.14),
    borderColor: cameraAlpha('danger', 0.6),
  },
  consejoTexto: { color: cameraColors.textStrong, fontSize: 13, fontFamily: poppins(700), textAlign: 'center' },
  consejoDedos: { color: cameraColors.textSoft, fontSize: 12 },
  signNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  signInfo: { flex: 1, alignItems: 'center' },
  signName: { color: cameraColors.textStrong, fontFamily: poppins(800), fontSize: 15 },
  puntuacion: { fontFamily: poppins(800), fontSize: 14, marginTop: 2 },
});
