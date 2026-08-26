import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GameScreenHeader from '../../components/ui/GameScreenHeader';
import { SIGNS } from '../../data/practiceSigns';
import { CameraStage, IaBanner, estilos, useSignRecognition } from './signCamera';

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
  const insets = useSafeAreaInsets();
  const recog = useSignRecognition();

  const [modoActivo, setModoActivo] = useState('libre'); // 'libre' | 'practica'
  const [signIndex, setSignIndex] = useState(0);

  const currentSign = SIGNS[signIndex];
  const { puntuacion, errorCamara, activarModoLibre, activarModoPractica } = recog;

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
    <View style={estilos.pantalla}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: 12 }}>
        <GameScreenHeader title="Práctica de señas" onBack={onBack} />
      </View>

      <CameraStage recog={recog} />

      <View style={[estilos.barraControl, { paddingBottom: insets.bottom + 8 }]}>
        {errorCamara ? (
          <View style={estilos.errorCamaraBox}>
            <Text style={estilos.errorCamaraTexto}>⚠ {errorCamara}</Text>
          </View>
        ) : null}

        <IaBanner
          recog={recog}
          objetivo={modoActivo === 'practica' ? currentSign?.id : null}
          textoInactivo="Muestra una seña para que la IA la reconozca…"
        />

        {/* Toggle Libre / Práctica */}
        <View style={estilos2.toggleContenedor}>
          {[
            { key: 'libre', label: 'Libre' },
            { key: 'practica', label: 'Práctica guiada' },
          ].map((m) => (
            <TouchableOpacity
              key={m.key}
              style={[estilos2.toggleBtn, modoActivo === m.key && estilos2.toggleActivo]}
              onPress={() => cambiarModo(m.key)}
            >
              <Text
                style={[
                  estilos2.toggleTexto,
                  modoActivo === m.key && estilos2.toggleTextoActivo,
                ]}
              >
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {modoActivo === 'practica' && (
          <>
            {/* Consejo del instructor */}
            {consejo ? (
              <View
                style={[
                  estilos2.consejoBox,
                  consejo.tono === 'ok' && estilos2.consejoOk,
                  consejo.tono === 'mal' && estilos2.consejoMal,
                ]}
              >
                <Text style={estilos2.consejoTexto}>{consejo.texto}</Text>
                {dedosFlojos.length ? (
                  <Text style={estilos2.consejoDedos}>
                    Corrige: {dedosFlojos.join(' y ')}
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text style={estilos2.instruccion}>{currentSign?.instruccion}</Text>
            )}

            {/* Navegación de señas */}
            <View style={estilos2.signNav}>
              <TouchableOpacity style={estilos2.btnNav} onPress={() => navSign(-1)}>
                <Text style={estilos2.btnNavTexto}>‹</Text>
              </TouchableOpacity>

              <View style={estilos2.signInfo}>
                <Text style={estilos2.signName}>{currentSign.nombre}</Text>
                {puntuacion !== null && (
                  <Text
                    style={[
                      estilos2.puntuacion,
                      {
                        color:
                          puntuacion > 88 ? '#22C55E' : puntuacion > 72 ? '#F59E0B' : '#EF4444',
                      },
                    ]}
                  >
                    {puntuacion}%
                  </Text>
                )}
              </View>

              <TouchableOpacity style={estilos2.btnNav} onPress={() => navSign(1)}>
                <Text style={estilos2.btnNavTexto}>›</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const estilos2 = StyleSheet.create({
  toggleContenedor: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    padding: 3,
  },
  toggleBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  toggleActivo: { backgroundColor: '#1CB0F6' },
  toggleTexto: { color: 'rgba(255,255,255,0.5)', fontWeight: '700', fontSize: 13 },
  toggleTextoActivo: { color: '#FFFFFF' },
  instruccion: {
    color: 'rgba(226,232,240,0.75)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  consejoBox: {
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.4)',
    alignItems: 'center',
    gap: 2,
  },
  consejoOk: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderColor: 'rgba(34,197,94,0.45)',
  },
  consejoMal: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderColor: 'rgba(239,68,68,0.4)',
  },
  consejoTexto: { color: '#F1F5F9', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  consejoDedos: { color: 'rgba(226,232,240,0.75)', fontSize: 12 },
  signNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  btnNav: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
  },
  btnNavTexto: { color: '#FFFFFF', fontSize: 22, fontWeight: '300', lineHeight: 26 },
  signInfo: { flex: 1, alignItems: 'center' },
  signName: { color: '#F1F5F9', fontWeight: '800', fontSize: 15 },
  puntuacion: { fontWeight: '800', fontSize: 20, marginTop: 2 },
});
