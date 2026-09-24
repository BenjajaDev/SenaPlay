import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useCameraPermissions } from 'expo-camera';
import { HAND_HTML } from './handTrackingHtml';

// ── IP del servidor Python (debe ser la IP local de tu PC en la misma WiFi) ─
// Si tu PC cambia de IP, actualízala aquí.
export const SERVIDOR_IA = 'http://192.168.1.5:8000';

// Comando para levantar la IA: python -m uvicorn server:app --host 0.0.0.0 --port 8000

// Confianza mínima para MOSTRAR un resultado en el banner (ver IaBanner). Por
// debajo de esto se muestra "No estoy seguro" en vez de una seña al azar —
// el modelo siempre devuelve alguna clase aunque no reconozca nada, así que
// sin este filtro el banner se siente errático. Mismo orden de magnitud que
// los umbrales de juego ya existentes (UMBRAL_DELETREO=0.55, UMBRAL_CONFIANZA
// de CameraTranslationScreen=0.6).
export const UMBRAL_CONFIANZA_MOSTRAR = 0.55;
/**
 * Lógica compartida de las pantallas que usan la cámara para reconocer señas:
 * permiso de cámara, puente con el WebView de MediaPipe y clasificación contra
 * el servidor de IA.
 *
 * La usan la práctica de señas, el deletreo y la traducción en tiempo real.
 * Cada pantalla decide qué hacer con los resultados; este hook solo los produce.
 */
export function useSignRecognition() {
  const webRef = useRef(null);
  const enClasificacion = useRef(false);
  // El movimiento cambia ~2 veces/s y solo se consulta dentro de callbacks, así
  // que va en un ref para no re-renderizar la pantalla en cada cambio.
  const movimientoRef = useRef(false);
  // Timestamp del último frame CON mano. La traducción lo usa para detectar
  // pausas (mano fuera de cuadro) y separar palabras.
  const ultimaDeteccionRef = useRef(0);

  const [iaResultado, setIaResultado] = useState(null); // { sena, confianza, dinamica?, framesProcesados?, ratioConMano? }
  const [iaEstado, setIaEstado] = useState(null);       // null | 'ok' | 'sin-conexion'
  const [errorCamara, setErrorCamara] = useState(null);
  const [puntuacion, setPuntuacion] = useState(null);
  // Desglose por dedo (0–1 c/u) que manda el visor en modo práctica.
  const [puntuacionDedos, setPuntuacionDedos] = useState(null);
  // Grabación de clip para el modelo dinámico (TCN) — ver DynamicSignMonitorScreen.
  const [grabando, setGrabando] = useState(false);
  const subiendoVideo = useRef(false);

  const [permisoCamara, pedirPermisoCamara] = useCameraPermissions();

  // ── Clasificación estática contra el servidor ──
  const clasificarSena = useCallback(async (landmarks) => {
    if (enClasificacion.current) return; // evita peticiones encimadas
    enClasificacion.current = true;
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 2500);
      const resp = await fetch(`${SERVIDOR_IA}/clasificar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ landmarks }),
        signal: ctrl.signal,
      });
      clearTimeout(timeout);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setIaResultado({ sena: data['seña'], confianza: data.confianza });
      setIaEstado('ok');
    } catch (_) {
      setIaEstado('sin-conexion');
    } finally {
      enClasificacion.current = false;
    }
  }, []);

  // ── Clip de video → clasificación dinámica (TCN) contra el servidor ──
  const subirVideo = useCallback(async (datosBase64, mime) => {
    if (subiendoVideo.current) return;
    subiendoVideo.current = true;
    setIaResultado(null);
    setIaEstado('procesando');
    try {
      const ctrl = new AbortController();
      // Timeout más largo que clasificarSena: el servidor tiene que abrir el
      // video y correr MediaPipe Holistic frame por frame antes de responder.
      const timeout = setTimeout(() => ctrl.abort(), 15000);
      const resp = await fetch(`${SERVIDOR_IA}/clasificar_video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_base64: datosBase64, mime }),
        signal: ctrl.signal,
      });
      clearTimeout(timeout);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setIaResultado({
        sena: data['seña'],
        confianza: data.confianza,
        dinamica: true,
        framesProcesados: data.frames_procesados,
        ratioConMano: data.ratio_con_mano,
      });
      setIaEstado('ok');
    } catch (_) {
      setIaEstado('sin-conexion');
    } finally {
      subiendoVideo.current = false;
    }
  }, []);

  // ── Mensajes del WebView → RN ──
  const manejarMensaje = useCallback((evento) => {
    try {
      const msg = JSON.parse(evento.nativeEvent.data);
      if (msg.tipo === 'landmarks') {
        if (typeof msg.puntuacion === 'number') setPuntuacion(msg.puntuacion);
        if (msg.dedos) setPuntuacionDedos(msg.dedos);
        movimientoRef.current = !!msg.movimiento;
        if (Array.isArray(msg.landmarks)) {
          ultimaDeteccionRef.current = Date.now();
          clasificarSena(msg.landmarks);
        }
      } else if (msg.tipo === 'sena-dinamica') {
        // Gesto con movimiento (J/Z) ya resuelto por trayectoria en el WebView
        // tras analizar la secuencia completa (~1–1.5s).
        setIaResultado({ sena: msg.sena, confianza: 1, dinamica: true });
        setIaEstado('ok');
      } else if (msg.tipo === 'video-grabado') {
        setGrabando(false);
        subirVideo(msg.datosBase64, msg.mime);
      } else if (msg.tipo === 'error-grabacion') {
        setGrabando(false);
        setErrorCamara(msg.mensaje);
      } else if (msg.tipo === 'error-camara') {
        setErrorCamara(msg.mensaje);
      }
    } catch (_) {}
  }, [clasificarSena, subirVideo]);

  // ── Comandos hacia el WebView ──
  const activarModoLibre = useCallback(() => {
    setPuntuacion(null);
    setPuntuacionDedos(null);
    webRef.current?.injectJavaScript('activarModoLibre(); true;');
  }, []);

  const activarModoPractica = useCallback((sign) => {
    setPuntuacion(null);
    setPuntuacionDedos(null);
    const lmJson = JSON.stringify(sign.landmarks);
    webRef.current?.injectJavaScript(
      `activarModoPractica(${lmJson}, ${JSON.stringify(sign.nombre)}, ${JSON.stringify(sign.instruccion)}); true;`,
    );
  }, []);

  const iniciarGrabacion = useCallback(() => {
    setIaResultado(null);
    setGrabando(true);
    webRef.current?.injectJavaScript('iniciarGrabacion(); true;');
  }, []);

  return {
    webRef,
    permisoCamara,
    pedirPermisoCamara,
    iaResultado,
    iaEstado,
    grabando,
    iniciarGrabacion,
    errorCamara,
    puntuacion,
    puntuacionDedos,
    movimientoRef,
    ultimaDeteccionRef,
    manejarMensaje,
    activarModoLibre,
    activarModoPractica,
    limpiarResultado: () => setIaResultado(null),
  };
}

/**
 * Visor de cámara con seguimiento de manos. Si falta el permiso muestra la
 * pantalla que lo solicita en vez del WebView.
 */
export function CameraStage({ recog }) {
  const { permisoCamara, pedirPermisoCamara, webRef, manejarMensaje } = recog;

  if (!permisoCamara?.granted) {
    return (
      <View style={estilos.permisoBox}>
        <Text style={estilos.permisoTitulo}>Cámara necesaria</Text>
        <Text style={estilos.permisoTexto}>
          Para reconocer tus señas con la mano necesitamos acceso a la cámara.
        </Text>
        <TouchableOpacity style={estilos.permisoBtn} onPress={pedirPermisoCamara}>
          <Text style={estilos.permisoBtnTexto}>
            {permisoCamara && !permisoCamara.canAskAgain
              ? 'Abrir ajustes y permitir'
              : 'Permitir cámara'}
          </Text>
        </TouchableOpacity>
        {permisoCamara && !permisoCamara.canAskAgain ? (
          <Text style={estilos.permisoNota}>
            Si lo bloqueaste, actívalo en Ajustes → SeñaPlay → Permisos → Cámara.
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <WebView
      ref={webRef}
      source={{ html: HAND_HTML, baseUrl: 'https://localhost/' }}
      style={StyleSheet.absoluteFill}
      scrollEnabled={false}
      bounces={false}
      overScrollMode="never"
      androidLayerType="hardware"
      originWhitelist={['*']}
      javaScriptEnabled
      domStorageEnabled
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      mediaCapturePermissionGrantType="grant"
      onPermissionRequest={(e) => e.nativeEvent.request.grant(e.nativeEvent.request.resources)}
      onMessage={manejarMensaje}
    />
  );
}

/** Banner con lo que la IA está reconociendo. Compartido por las tres pantallas. */
export function IaBanner({ recog, objetivo, textoInactivo, umbral = UMBRAL_CONFIANZA_MOSTRAR }) {
  const { iaResultado, iaEstado } = recog;
  // Las señas dinámicas resueltas por trayectoria (J/Z) llegan con confianza=1
  // fija, así que siempre pasan el umbral igual.
  const confiable = iaResultado && (iaResultado.confianza || 0) >= umbral;
  const acierto =
    confiable &&
    objetivo &&
    String(iaResultado.sena).toUpperCase() === String(objetivo).toUpperCase();

  return (
    <View style={estilos.iaBanner}>
      {iaEstado === 'sin-conexion' ? (
        <Text style={estilos.iaTextoError}>
          IA no conectada · revisa el servidor ({SERVIDOR_IA})
        </Text>
      ) : iaEstado === 'procesando' ? (
        <Text style={estilos.iaTextoTenue}>Procesando seña…</Text>
      ) : confiable ? (
        <Text style={estilos.iaTexto}>
          {'IA reconoce: '}
          <Text style={[estilos.iaLetra, { color: acierto ? '#22C55E' : '#1CB0F6' }]}>
            {iaResultado.sena}
          </Text>
          {`  (${Math.round((iaResultado.confianza || 0) * 100)}%)`}
          {acierto ? '  ✓' : ''}
        </Text>
      ) : iaResultado ? (
        <Text style={estilos.iaTextoTenue}>
          {`No estoy seguro… (${Math.round((iaResultado.confianza || 0) * 100)}%)`}
        </Text>
      ) : (
        <Text style={estilos.iaTextoTenue}>
          {textoInactivo || 'Muestra una seña para que la IA la reconozca…'}
        </Text>
      )}
    </View>
  );
}

export const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#0F172A' },
  permisoBox: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 14,
  },
  permisoTitulo: { color: '#F1F5F9', fontSize: 20, fontWeight: '800' },
  permisoTexto: {
    color: 'rgba(226,232,240,0.7)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  permisoBtn: {
    backgroundColor: '#1CB0F6',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 4,
  },
  permisoBtnTexto: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  permisoNota: { color: 'rgba(226,232,240,0.5)', fontSize: 12, textAlign: 'center' },
  barraControl: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: 'rgba(15,23,42,0.88)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    gap: 10,
  },
  iaBanner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
  },
  iaTexto: { color: '#E2E8F0', fontSize: 14, fontWeight: '600' },
  iaLetra: { fontSize: 18, fontWeight: '900' },
  iaTextoTenue: { color: 'rgba(226,232,240,0.5)', fontSize: 12 },
  iaTextoError: { color: '#FCA5A5', fontSize: 11, fontWeight: '600', textAlign: 'center' },
  errorCamaraBox: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  errorCamaraTexto: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  btnPrimario: {
    backgroundColor: '#1CB0F6',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 12,
  },
  btnPrimarioTexto: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
});
