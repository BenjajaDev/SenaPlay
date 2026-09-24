import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GameScreenHeader from '../../../shared/ui/GameScreenHeader';
import { CameraStage, IaBanner, estilos, useSignRecognition } from './signCamera';

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
 * para no repetir letras ni registrar transiciones. Es deletreo continuo: cuando
 * el modelo dinámico esté entrenado, las señas léxicas entrarán por el mismo
 * camino (llegan como 'sena-dinamica') y se insertarán como palabras completas.
 */
export default function CameraTranslationScreen({ onBack }) {
  const insets = useSafeAreaInsets();
  const recog = useSignRecognition();

  const [texto, setTexto] = useState('');
  const [candidata, setCandidata] = useState(null); // { sena, veces }
  const [activo, setActivo] = useState(true);

  const ultimaConfirmada = useRef({ sena: null, cuando: 0 });
  const { iaResultado, movimientoRef, ultimaDeteccionRef, errorCamara, activarModoLibre } = recog;

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
      setTexto((t) => t + sena);
      ultimaConfirmada.current = { sena, cuando: ahora };
      setCandidata(null);
      return;
    }

    if ((iaResultado.confianza || 0) < UMBRAL_CONFIANZA) return;
    if (movimientoRef.current) return; // mano en tránsito, no es una letra estable

    // Rearme: no repetir la misma letra hasta que pase el tiempo mínimo
    const { sena: previa, cuando } = ultimaConfirmada.current;
    if (sena === previa && ahora - cuando < MS_REARME) return;

    setCandidata((prev) => {
      const veces = prev && prev.sena === sena ? prev.veces + 1 : 1;

      if (veces >= LECTURAS_PARA_CONFIRMAR) {
        setTexto((t) => t + sena);
        ultimaConfirmada.current = { sena, cuando: ahora };
        return null;
      }
      return { sena, veces };
    });
  }, [iaResultado, activo, movimientoRef]);

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
    <View style={estilos.pantalla}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: 12 }}>
        <GameScreenHeader title="Traducción en vivo" onBack={onBack} />
      </View>

      <CameraStage recog={recog} />

      {/* Letra en proceso de confirmarse */}
      {candidata ? (
        <View style={[propios.candidata, { top: insets.top + 54 }]}>
          <Text style={propios.candidataLetra}>{candidata.sena}</Text>
          <View style={propios.candidataTrack}>
            <View style={[propios.candidataFill, { width: `${progresoCandidata * 100}%` }]} />
          </View>
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
          objetivo={null}
          textoInactivo="Empieza a hacer señas para traducir…"
        />

        {/* Texto traducido */}
        <View style={propios.salidaBox}>
          <ScrollView
            style={propios.salidaScroll}
            contentContainerStyle={propios.salidaContent}
          >
            <Text style={texto ? propios.salidaTexto : propios.salidaVacia}>
              {texto || 'La traducción aparecerá aquí…'}
            </Text>
          </ScrollView>
        </View>

        {/* Controles */}
        <View style={propios.controles}>
          <TouchableOpacity
            style={[propios.btn, !activo && propios.btnPausado]}
            onPress={() => setActivo((a) => !a)}
          >
            <Text style={propios.btnTexto}>{activo ? '⏸ Pausar' : '▶ Reanudar'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={propios.btn} onPress={agregarEspacio}>
            <Text style={propios.btnTexto}>␣ Espacio</Text>
          </TouchableOpacity>

          <TouchableOpacity style={propios.btn} onPress={borrarUltimo}>
            <Text style={propios.btnTexto}>⌫ Borrar</Text>
          </TouchableOpacity>

          <TouchableOpacity style={propios.btn} onPress={limpiar}>
            <Text style={propios.btnTexto}>✕ Limpiar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const propios = StyleSheet.create({
  candidata: {
    position: 'absolute',
    right: 14,
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15,23,42,0.78)',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  candidataLetra: { color: '#1CB0F6', fontSize: 30, fontWeight: '900' },
  candidataTrack: {
    width: 46,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  candidataFill: { height: '100%', backgroundColor: '#1CB0F6', borderRadius: 2 },
  salidaBox: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    minHeight: 62,
    maxHeight: 110,
  },
  salidaScroll: { flexGrow: 0 },
  salidaContent: { padding: 10 },
  salidaTexto: { color: '#F1F5F9', fontSize: 19, fontWeight: '700', letterSpacing: 1 },
  salidaVacia: { color: 'rgba(226,232,240,0.35)', fontSize: 13, fontStyle: 'italic' },
  controles: { flexDirection: 'row', gap: 6 },
  btn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  btnPausado: { backgroundColor: 'rgba(245,158,11,0.25)' },
  btnTexto: { color: '#E2E8F0', fontSize: 11, fontWeight: '800' },
});
