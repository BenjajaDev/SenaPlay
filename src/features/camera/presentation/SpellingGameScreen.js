import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import haptics from '../../../core/feedback/haptics';
import { useRemoteConfig } from '../../remoteConfig/presentation/RemoteConfigProvider';
import SignImage from '../../signs/presentation/SignImage';
import { PALABRAS, UMBRAL_DELETREO } from '../data/practiceSigns';
import CameraLayout, { CameraButton } from './CameraLayout';
import { IaBanner, useSignRecognition } from './signCamera';
import { cameraAlpha, cameraColors } from '../../../shared/theme/tokens/colors';
import { poppins } from '../../../shared/theme/fonts';

/**
 * Juego de Deletreo: escribe una palabra letra por letra haciendo las señas.
 *
 * Antes era un modo dentro de la pantalla de la mano 3D. Se separó porque es un
 * juego con su propio objetivo y progresión.
 *
 * El repertorio de letras que acepta lo determina el modelo de IA entrenado: a
 * medida que el modelo mejore (más letras, señas con movimiento), este juego
 * las reconoce sin cambios de código, porque delega en el modelo estático
 * (mano quieta) y en el dinámico (tramos con movimiento: G, J, S, X, Z).
 */
export default function SpellingGameScreen({ onBack }) {
  const recog = useSignRecognition({ capturaDinamica: true });
  // Umbral ajustable desde el panel web (difficulty.spellingConfidenceThreshold).
  const { config } = useRemoteConfig();
  const umbral = Number(config.difficulty?.spellingConfidenceThreshold) || UMBRAL_DELETREO;

  const [palabraIdx, setPalabraIdx] = useState(0);
  const [letraIdx, setLetraIdx] = useState(0);
  const [aciertos, setAciertos] = useState(0);

  const palabraActual = PALABRAS[palabraIdx];
  const palabraCompleta = letraIdx >= palabraActual.length;
  const letraObjetivo = palabraCompleta ? null : palabraActual[letraIdx];

  const { iaResultado, movimientoRef, activarModoLibre } = recog;

  useEffect(() => {
    if (recog.permisoCamara && !recog.permisoCamara.granted && recog.permisoCamara.canAskAgain) {
      recog.pedirPermisoCamara();
    }
  }, [recog.permisoCamara, recog.pedirPermisoCamara]);

  // El visor arranca sin mano guía: aquí no se compara contra una referencia.
  useEffect(() => {
    activarModoLibre();
  }, [activarModoLibre]);

  // ── Avance automático cuando se reconoce la letra esperada ──
  // Acepta el resultado estático (servidor) y el dinámico (trayectoria J/Z).
  // Para las estáticas exige mano en reposo: así una J en movimiento no se cuela
  // como la letra estática que comparte su forma de mano.
  useEffect(() => {
    if (!iaResultado || palabraCompleta) return;
    if (String(iaResultado.sena).toUpperCase() !== letraObjetivo) return;

    if (iaResultado.dinamica || ((iaResultado.confianza || 0) >= umbral && !movimientoRef.current)) {
      haptics.success();
      setLetraIdx((i) => i + 1);
      setAciertos((n) => n + 1);
    }
  }, [iaResultado, letraObjetivo, palabraCompleta, movimientoRef, umbral]);

  const siguientePalabra = useCallback(() => {
    setPalabraIdx((p) => (p + 1) % PALABRAS.length);
    setLetraIdx(0);
  }, []);

  const reiniciarPalabra = useCallback(() => setLetraIdx(0), []);

  return (
    <CameraLayout
      title="Deletreo"
      onBack={onBack}
      recog={recog}
      overlay={
        // Guía de la letra objetivo, dentro del visor y arriba para no tapar la mano.
        !palabraCompleta ? (
          <View style={propios.guia}>
            <SignImage signKey={letraObjetivo} label={letraObjetivo} size={78} rounded={14} />
            <Text style={propios.guiaTexto}>Haz esta seña</Text>
          </View>
        ) : null
      }
    >
      <IaBanner recog={recog} objetivo={letraObjetivo} textoInactivo="Haz la seña de la letra resaltada…" />

      <View style={propios.progresoRow}>
        <Text style={propios.progresoTexto}>
          Palabra {palabraIdx + 1}/{PALABRAS.length}
        </Text>
        <Text style={propios.progresoTexto}>{aciertos} letras acertadas</Text>
      </View>

      {/* Palabra en curso: estado por borde, color y ✓ (no solo color) */}
      <View
        style={propios.palabraRow}
        accessible
        accessibilityLabel={`Palabra ${palabraActual}, ${Math.min(letraIdx, palabraActual.length)} de ${palabraActual.length} letras`}
      >
        {palabraActual.split('').map((ch, i) => {
          const hecha = i < letraIdx;
          const actual = i === letraIdx && !palabraCompleta;
          return (
            <View key={i} style={[propios.letraChip, hecha && propios.letraChipOk, actual && propios.letraChipActual]}>
              <Text style={[propios.letraChipTexto, hecha && propios.letraChipTextoOk, actual && propios.letraChipTextoActual]}>
                {ch}
              </Text>
              {hecha ? <Text style={propios.check}>✓</Text> : null}
            </View>
          );
        })}
      </View>

      {palabraCompleta ? (
        <View style={propios.footer}>
          <Text style={propios.ok} accessibilityLiveRegion="polite">
            ¡Palabra completa!
          </Text>
          <CameraButton label="Siguiente palabra" icon="arrow-forward" variant="primary" onPress={siguientePalabra} style={propios.footerBtn} />
        </View>
      ) : (
        <View style={propios.footerRow}>
          <Text style={propios.instr}>
            {'Letra actual: '}
            <Text style={propios.letraDestacada}>{letraObjetivo}</Text>
          </Text>
          <CameraButton label="Reiniciar" icon="refresh" onPress={reiniciarPalabra} accessibilityLabel="Reiniciar palabra" />
        </View>
      )}
    </CameraLayout>
  );
}

const propios = StyleSheet.create({
  guia: {
    position: 'absolute',
    top: 10,
    right: 10,
    alignItems: 'center',
    gap: 4,
    backgroundColor: cameraAlpha('stage', 0.82),
    borderWidth: 1.5,
    borderColor: cameraColors.highlight,
    borderRadius: 16,
    padding: 8,
  },
  guiaTexto: { color: cameraColors.textStrong, fontSize: 12, fontFamily: poppins(700) },
  progresoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  progresoTexto: { color: cameraColors.textSoft, fontSize: 12, fontFamily: poppins(700) },
  palabraRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  letraChip: {
    width: 38,
    height: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cameraColors.surface,
    borderWidth: 1.5,
    borderColor: cameraColors.border,
  },
  letraChipOk: { backgroundColor: cameraAlpha('success', 0.16), borderColor: cameraColors.success },
  letraChipActual: { borderColor: cameraColors.highlight, borderWidth: 2, backgroundColor: cameraAlpha('primary', 0.35) },
  letraChipTexto: { fontSize: 20, fontFamily: poppins(900), color: cameraColors.textMuted },
  letraChipTextoOk: { color: cameraColors.success },
  letraChipTextoActual: { color: cameraColors.highlight },
  check: { position: 'absolute', top: 1, right: 3, fontSize: 10, color: cameraColors.success, fontFamily: poppins(800) },
  footer: { alignItems: 'center', gap: 8 },
  footerBtn: { alignSelf: 'stretch' },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  ok: { color: cameraColors.success, fontFamily: poppins(800), fontSize: 15 },
  instr: { flexShrink: 1, color: cameraColors.textSoft, fontSize: 14 },
  letraDestacada: { color: cameraColors.highlight, fontFamily: poppins(900), fontSize: 18 },
});
