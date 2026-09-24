import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '../../../shared/ui/ScreenHeader';
import SignImage from '../../signs/presentation/SignImage';
import { PALABRAS, UMBRAL_DELETREO } from '../data/practiceSigns';
import { CameraStage, IaBanner, estilos, useSignRecognition } from './signCamera';

/**
 * Juego de Deletreo: escribe una palabra letra por letra haciendo las señas.
 *
 * Antes era un modo dentro de la pantalla de la mano 3D. Se separó porque es un
 * juego con su propio objetivo y progresión.
 *
 * El repertorio de letras que acepta lo determina el modelo de IA entrenado: a
 * medida que el modelo mejore (más letras, señas con movimiento), este juego
 * las reconoce sin cambios de código, porque delega en /clasificar y en el
 * detector de trayectoria del WebView.
 */
export default function SpellingGameScreen({ onBack }) {
  const insets = useSafeAreaInsets();
  const recog = useSignRecognition();

  const [palabraIdx, setPalabraIdx] = useState(0);
  const [letraIdx, setLetraIdx] = useState(0);
  const [aciertos, setAciertos] = useState(0);

  const palabraActual = PALABRAS[palabraIdx];
  const palabraCompleta = letraIdx >= palabraActual.length;
  const letraObjetivo = palabraCompleta ? null : palabraActual[letraIdx];

  const { iaResultado, movimientoRef, errorCamara, activarModoLibre } = recog;

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

    if (iaResultado.dinamica) {
      setLetraIdx((i) => i + 1);
      setAciertos((n) => n + 1);
    } else if ((iaResultado.confianza || 0) >= UMBRAL_DELETREO && !movimientoRef.current) {
      setLetraIdx((i) => i + 1);
      setAciertos((n) => n + 1);
    }
  }, [iaResultado, letraObjetivo, palabraCompleta, movimientoRef]);

  const siguientePalabra = useCallback(() => {
    setPalabraIdx((p) => (p + 1) % PALABRAS.length);
    setLetraIdx(0);
  }, []);

  const reiniciarPalabra = useCallback(() => setLetraIdx(0), []);

  return (
    <View style={estilos.pantalla}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: 12 }}>
        <ScreenHeader title="Deletreo" onBack={onBack} />
      </View>

      <CameraStage recog={recog} />

      {/* Guía de la letra objetivo, arriba para no tapar la mano */}
      {!palabraCompleta ? (
        <View style={[propios.guia, { top: insets.top + 54 }]}>
          <SignImage signKey={letraObjetivo} label={letraObjetivo} size={78} rounded={16} />
          <Text style={propios.guiaTexto}>Haz esta seña</Text>
        </View>
      ) : null}

      <View style={[estilos.barraControl, { paddingBottom: insets.bottom + 8 }]}>
        {errorCamara ? (
          <View style={estilos.errorCamaraBox}>
            <Text style={estilos.errorCamaraTexto}>⚠ {errorCamara}</Text>
          </View>
        ) : null}

        <IaBanner
          recog={recog}
          objetivo={letraObjetivo}
          textoInactivo="Haz la seña de la letra resaltada…"
        />

        <View style={propios.progresoRow}>
          <Text style={propios.progresoTexto}>
            Palabra {palabraIdx + 1}/{PALABRAS.length}
          </Text>
          <Text style={propios.progresoTexto}>{aciertos} letras acertadas</Text>
        </View>

        {/* Palabra en curso */}
        <View style={propios.palabraRow}>
          {palabraActual.split('').map((ch, i) => (
            <View
              key={i}
              style={[
                propios.letraChip,
                i < letraIdx && propios.letraChipOk,
                i === letraIdx && !palabraCompleta && propios.letraChipActual,
              ]}
            >
              <Text
                style={[
                  propios.letraChipTexto,
                  (i < letraIdx || (i === letraIdx && !palabraCompleta)) &&
                    propios.letraChipTextoOn,
                ]}
              >
                {ch}
              </Text>
            </View>
          ))}
        </View>

        {palabraCompleta ? (
          <View style={propios.footer}>
            <Text style={propios.ok}>¡Palabra completa! 🎉</Text>
            <TouchableOpacity style={estilos.btnPrimario} onPress={siguientePalabra}>
              <Text style={estilos.btnPrimarioTexto}>Siguiente palabra ›</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={propios.footer}>
            <Text style={propios.instr}>
              {'Letra actual: '}
              <Text style={propios.letraDestacada}>{letraObjetivo}</Text>
            </Text>
            <TouchableOpacity onPress={reiniciarPalabra} hitSlop={8}>
              <Text style={propios.reiniciar}>Reiniciar palabra</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const propios = StyleSheet.create({
  guia: {
    position: 'absolute',
    right: 14,
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15,23,42,0.75)',
    borderRadius: 16,
    padding: 8,
  },
  guiaTexto: { color: 'rgba(226,232,240,0.75)', fontSize: 11, fontWeight: '700' },
  progresoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progresoTexto: { color: 'rgba(226,232,240,0.6)', fontSize: 11, fontWeight: '700' },
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
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  letraChipOk: { backgroundColor: 'rgba(34,197,94,0.18)', borderColor: '#22C55E' },
  letraChipActual: { borderColor: '#1CB0F6', backgroundColor: 'rgba(28,176,246,0.15)' },
  letraChipTexto: { fontSize: 20, fontWeight: '900', color: 'rgba(255,255,255,0.4)' },
  letraChipTextoOn: { color: '#FFFFFF' },
  footer: { alignItems: 'center', gap: 6 },
  ok: { color: '#22C55E', fontWeight: '800', fontSize: 15 },
  instr: { color: 'rgba(226,232,240,0.8)', fontSize: 14 },
  letraDestacada: { color: '#1CB0F6', fontWeight: '900', fontSize: 18 },
  reiniciar: {
    color: 'rgba(226,232,240,0.5)',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
});
