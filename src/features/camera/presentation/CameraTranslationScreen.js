import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import haptics from '../../../core/feedback/haptics';
import { useRemoteConfig } from '../../remoteConfig/presentation/RemoteConfigProvider';
import CameraLayout, { CameraButton } from './CameraLayout';
import { IaBanner, useSignRecognition } from './signCamera';
import { cameraAlpha, cameraColors } from '../../../shared/theme/tokens/colors';
import { poppins } from '../../../shared/theme/fonts';

// ── Parámetros del tracking ───────────────────────────────────────────────────
// Traducir en vivo no es "clasificar un frame": el clasificador emite ~2
// lecturas/s y muchas son ruido de transición entre una seña y la siguiente.
// Sin filtrar, un simple "HOLA" sale como "HHHOOLLA". El tracking resuelve tres
// cosas distintas:

// 1) ESTABILIDAD: una letra solo se acepta tras verse N lecturas seguidas.
//    Descarta las formas intermedias que aparecen mientras la mano se acomoda.
const LECTURAS_PARA_CONFIRMAR = 3;

// 2) CONFIANZA mínima del clasificador.
const UMBRAL_CONFIANZA = 0.6;

// 3) REARME: tras confirmar una letra hay que "soltarla" (mostrar otra cosa o
//    sacar la mano) antes de poder repetirla. Sin esto, mantener la mano quieta
//    escribe la misma letra sin parar y las dobles (ELLA) serían imposibles de
//    controlar.
const MS_REARME = 900;

// Pausa sin mano en cuadro que se interpreta como separación de palabras.
const MS_PAUSA_ESPACIO = 1800;

/**
 * Traducción de señas en tiempo real.
 *
 * Va acumulando en texto lo que reconoce la IA, aplicando el tracking de arriba
 * para no repetir letras ni registrar transiciones. Los dos modelos corren en
 * sincronía: las letras con la mano quieta vienen del modelo estático, y cada
 * movimiento lo resuelve el dinámico — una letra con movimiento (G, J, S, X, Z)
 * se agrega al deletreo y una seña léxica (Yo, Mi, Nombre…) como palabra.
 */
export default function CameraTranslationScreen({ onBack }) {
  const recog = useSignRecognition({ capturaDinamica: true });
  // Umbral ajustable desde el panel web (difficulty.aiConfidenceThreshold).
  const { config } = useRemoteConfig();
  const umbralConfianza = Number(config.difficulty?.aiConfidenceThreshold) || UMBRAL_CONFIANZA;

  const [texto, setTexto] = useState('');
  const [candidata, setCandidata] = useState(null); // { sena, veces }
  const [activo, setActivo] = useState(true);

  const ultimaConfirmada = useRef({ sena: null, cuando: 0 });
  const { iaResultado, movimientoRef, ultimaDeteccionRef, activarModoLibre } = recog;

  useEffect(() => {
    if (recog.permisoCamara && !recog.permisoCamara.granted && recog.permisoCamara.canAskAgain) {
      recog.pedirPermisoCamara();
    }
  }, [recog.permisoCamara, recog.pedirPermisoCamara]);

  useEffect(() => {
    activarModoLibre(); // sin mano guía: aquí no se compara contra referencia
  }, [activarModoLibre]);

  // ── Acumulación con tracking ──
  useEffect(() => {
    if (!activo || !iaResultado) return;

    const sena = String(iaResultado.sena).toUpperCase();
    const ahora = Date.now();

    // Las señas con movimiento ya vienen resueltas tras analizar la secuencia
    // completa, así que no necesitan el filtro de estabilidad.
    if (iaResultado.dinamica) {
      haptics.tap();
      setTexto((t) => {
        if (sena.length === 1) return t + sena;
        // Seña léxica: palabra completa, separada de lo que haya antes.
        const base = t && !t.endsWith(' ') ? `${t} ` : t;
        return `${base}${sena} `;
      });
      ultimaConfirmada.current = { sena, cuando: ahora };
      setCandidata(null);
      return;
    }

    if ((iaResultado.confianza || 0) < umbralConfianza) return;
    if (movimientoRef.current) return; // mano en tránsito, no es una letra estable

    // Rearme: no repetir la misma letra hasta que pase el tiempo mínimo
    const { sena: previa, cuando } = ultimaConfirmada.current;
    if (sena === previa && ahora - cuando < MS_REARME) return;

    setCandidata((prev) => {
      const veces = prev && prev.sena === sena ? prev.veces + 1 : 1;

      if (veces >= LECTURAS_PARA_CONFIRMAR) {
        haptics.tap();
        setTexto((t) => t + sena);
        ultimaConfirmada.current = { sena, cuando: ahora };
        return null;
      }
      return { sena, veces };
    });
  }, [iaResultado, activo, movimientoRef, umbralConfianza]);

  // ── Separación de palabras por pausa ──
  // Si la mano sale de cuadro el tiempo suficiente, se inserta un espacio.
  useEffect(() => {
    if (!activo) return;
    const id = setInterval(() => {
      const desde = ultimaDeteccionRef.current;
      if (!desde) return;
      if (Date.now() - desde < MS_PAUSA_ESPACIO) return;

      setTexto((t) => (t.length && !t.endsWith(' ') ? t + ' ' : t));
      ultimaDeteccionRef.current = 0; // un solo espacio por pausa
      setCandidata(null);
    }, 400);
    return () => clearInterval(id);
  }, [activo, ultimaDeteccionRef]);

  const borrarUltimo = useCallback(() => setTexto((t) => t.slice(0, -1)), []);
  const limpiar = useCallback(() => {
    setTexto('');
    setCandidata(null);
    ultimaConfirmada.current = { sena: null, cuando: 0 };
  }, []);
  const agregarEspacio = useCallback(() => setTexto((t) => t + ' '), []);

  const progresoCandidata = candidata
    ? Math.min(1, candidata.veces / LECTURAS_PARA_CONFIRMAR)
    : 0;

  return (
    <CameraLayout
      title="Traducción en vivo"
      onBack={onBack}
      recog={recog}
      overlay={
        // Letra en proceso de confirmarse, dentro del visor (arriba a la derecha).
        candidata ? (
          <View style={propios.candidata} accessibilityLiveRegion="polite" accessibilityLabel={`Confirmando ${candidata.sena}`}>
            <Text style={propios.candidataLetra}>{candidata.sena}</Text>
            <View style={propios.candidataTrack}>
              <View style={[propios.candidataFill, { width: `${progresoCandidata * 100}%` }]} />
            </View>
          </View>
        ) : null
      }
    >
      <IaBanner recog={recog} objetivo={null} textoInactivo="Empieza a hacer señas para traducir…" />

      {/* Texto traducido */}
      <View style={propios.salidaBox} accessibilityLabel={texto ? `Traducción: ${texto}` : 'Aún no hay traducción'}>
        <ScrollView style={propios.salidaScroll} contentContainerStyle={propios.salidaContent}>
          <Text style={texto ? propios.salidaTexto : propios.salidaVacia}>{texto || 'La traducción aparecerá aquí…'}</Text>
        </ScrollView>
      </View>

      {/* Controles: dos filas para que ningún texto se corte en pantallas angostas */}
      <View style={propios.controles}>
        <CameraButton
          label={activo ? 'Pausar' : 'Reanudar'}
          icon={activo ? 'pause' : 'play'}
          variant={activo ? 'secondary' : 'warning'}
          onPress={() => setActivo((a) => !a)}
          accessibilityLabel={activo ? 'Pausar traducción' : 'Reanudar traducción'}
          style={propios.btn}
        />
        <CameraButton label="Espacio" icon="add" onPress={agregarEspacio} accessibilityLabel="Agregar espacio" style={propios.btn} />
      </View>
      <View style={propios.controles}>
        <CameraButton label="Borrar" icon="backspace-outline" onPress={borrarUltimo} accessibilityLabel="Borrar la última letra" style={propios.btn} />
        <CameraButton label="Limpiar" icon="trash-outline" onPress={limpiar} accessibilityLabel="Limpiar el texto" style={propios.btn} />
      </View>
    </CameraLayout>
  );
}

const propios = StyleSheet.create({
  candidata: {
    position: 'absolute',
    top: 10,
    right: 10,
    alignItems: 'center',
    gap: 6,
    backgroundColor: cameraAlpha('stage', 0.82),
    borderWidth: 1.5,
    borderColor: cameraColors.highlight,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  candidataLetra: { color: cameraColors.highlight, fontSize: 30, fontFamily: poppins(900) },
  candidataTrack: {
    width: 46,
    height: 4,
    borderRadius: 2,
    backgroundColor: cameraAlpha('white', 0.18),
    overflow: 'hidden',
  },
  candidataFill: { height: '100%', backgroundColor: cameraColors.highlight, borderRadius: 2 },
  salidaBox: {
    backgroundColor: cameraColors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: cameraAlpha('accent', 0.45),
    minHeight: 58,
    maxHeight: 104,
  },
  salidaScroll: { flexGrow: 0 },
  salidaContent: { padding: 10 },
  salidaTexto: { color: cameraColors.textStrong, fontSize: 19, fontFamily: poppins(700), letterSpacing: 1 },
  salidaVacia: { color: cameraColors.textMuted, fontSize: 13, fontStyle: 'italic' },
  controles: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1 },
});
