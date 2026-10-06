import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useCameraPermissions } from 'expo-camera';
import { HAND_HTML } from './handTrackingHtml';
import env from '../../../core/config/env';
import { cameraAlpha, cameraColors } from '../../../shared/theme/tokens/colors';

// ── Servidor Python de IA ──────────────────────────────────────────────────
// En desarrollo es la IP local de tu PC en la misma WiFi. Se configura con
// EXPO_PUBLIC_AI_SERVER_URL (ver src/core/config/env.js), sin tocar código.
export const SERVIDOR_IA = env.aiServerUrl;

// Comando para levantar la IA: python -m uvicorn server:app --host 0.0.0.0 --port 8000

// Confianza mínima para MOSTRAR un resultado en el banner (ver IaBanner). Por
// debajo de esto se muestra "No estoy seguro" en vez de una seña al azar —
// el modelo siempre devuelve alguna clase aunque no reconozca nada, así que
// sin este filtro el banner se siente errático. Mismo orden de magnitud que
// los umbrales de juego ya existentes (UMBRAL_DELETREO=0.55, UMBRAL_CONFIANZA
// de CameraTranslationScreen=0.6).
export const UMBRAL_CONFIANZA_MOSTRAR = 0.55;

// Confianza mínima para aceptar una seña del modelo DINÁMICO. Además de esto,
// el servidor descarta los tramos que el modelo marca como "ninguna" (mano
// quieta, cambio entre letras estáticas) — ver /clasificar_frames.
export const UMBRAL_DINAMICO = 0.6;

// Tras reconocer una seña con movimiento, la siguiente lectura estática no la
// reemplaza en pantalla durante este tiempo (si no, desaparece en ~0,5 s).
const MS_RETENCION_DINAMICA = 1800;

/**
 * Lógica compartida de las pantallas que usan la cámara para reconocer señas:
 * permiso de cámara, puente con el WebView de MediaPipe y clasificación contra
 * el servidor de IA.
 *
 * Con `capturaDinamica`, los dos modelos trabajan en sincronía: la mano quieta
 * se clasifica con el modelo ESTÁTICO (alfabeto) y cada tramo con movimiento
 * se manda al modelo DINÁMICO (G, J, S, X, Z, palabras). Los resultados llegan
 * por el mismo `iaResultado`, con `dinamica: true` y `origen` para distinguirlos.
 *
 * La usan la práctica de señas, el deletreo y la traducción en tiempo real.
 * Cada pantalla decide qué hacer con los resultados; este hook solo los produce.
 */
export function useSignRecognition({ capturaDinamica = false } = {}) {
  const webRef = useRef(null);
  const enClasificacion = useRef(false);
  const enClasificacionTramo = useRef(false);
  const ultimoDinamicoRef = useRef(0);
  const [analizandoMovimiento, setAnalizandoMovimiento] = useState(false);
  // El movimiento cambia ~2 veces/s y solo se consulta dentro de callbacks, así
  // que va en un ref para no re-renderizar la pantalla en cada cambio.
  const movimientoRef = useRef(false);
  // Timestamp del último frame CON mano. La traducción lo usa para detectar
  // pausas (mano fuera de cuadro) y separar palabras.
  const ultimaDeteccionRef = useRef(0);

  // { sena, confianza, origen: 'estatico'|'dinamico'|'trayectoria', dinamica?, alternativas?, framesProcesados?, ratioConMano? }
  const [iaResultado, setIaResultado] = useState(null);
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
      if (Date.now() - ultimoDinamicoRef.current > MS_RETENCION_DINAMICA) {
        setIaResultado({ sena: data['seña'], confianza: data.confianza, origen: 'estatico' });
      }
      setIaEstado('ok');
    } catch (_) {
      setIaEstado('sin-conexion');
    } finally {
      enClasificacion.current = false;
    }
  }, []);

  const mostrarDinamica = useCallback((resultado) => {
    ultimoDinamicoRef.current = Date.now();
    setIaResultado({ ...resultado, dinamica: true });
    setIaEstado('ok');
  }, []);

  // ── Tramo con movimiento → modelo dinámico (captura automática) ──
  // Si el servidor no tiene el modelo dinámico o no responde, queda como
  // respaldo la lectura por trayectoria (J/Z) que ya hizo el WebView.
  const clasificarTramo = useCallback(async ({ frames, fps, heuristica }) => {
    if (enClasificacionTramo.current) return; // un tramo a la vez
    enClasificacionTramo.current = true;
    setAnalizandoMovimiento(true);
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 10000);
      const resp = await fetch(`${SERVIDOR_IA}/clasificar_frames`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frames, fps }),
        signal: ctrl.signal,
      });
      clearTimeout(timeout);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (data.es_seña && data.confianza >= UMBRAL_DINAMICO) {
        mostrarDinamica({
          sena: data['seña'],
          confianza: data.confianza,
          origen: 'dinamico',
          alternativas: data.alternativas,
        });
      }
    } catch (_) {
      if (heuristica) mostrarDinamica({ sena: heuristica, confianza: 1, origen: 'trayectoria' });
    } finally {
      enClasificacionTramo.current = false;
      setAnalizandoMovimiento(false);
    }
  }, [mostrarDinamica]);

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
      // El monitor muestra la respuesta tal cual, incluida "ninguna": es una
      // herramienta para probar el modelo, no un juego.
      mostrarDinamica({
        sena: data['seña'],
        confianza: data.confianza,
        origen: 'dinamico',
        alternativas: data.alternativas,
        framesProcesados: data.frames_procesados,
        ratioConMano: data.ratio_con_mano,
      });
    } catch (_) {
      setIaEstado('sin-conexion');
    } finally {
      subiendoVideo.current = false;
    }
  }, [mostrarDinamica]);

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
        mostrarDinamica({ sena: msg.sena, confianza: 1, origen: 'trayectoria' });
      } else if (msg.tipo === 'tramo-movimiento') {
        clasificarTramo(msg);
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
  }, [clasificarSena, subirVideo, mostrarDinamica, clasificarTramo]);

  // El visor arranca con la captura dinámica apagada; se enciende al cargar.
  const alCargarVisor = useCallback(() => {
    if (capturaDinamica) webRef.current?.injectJavaScript('activarCapturaDinamica(true); true;');
  }, [capturaDinamica]);

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
    analizandoMovimiento,
    alCargarVisor,
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
  const { permisoCamara, pedirPermisoCamara, webRef, manejarMensaje, alCargarVisor } = recog;

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
      onLoadEnd={alCargarVisor}
    />
  );
}

// Etiqueta (icono + texto) de qué modelo produjo el resultado.
const ORIGENES = {
  estatico: '✋ Estática',
  dinamico: '〰 Movimiento',
  trayectoria: '〰 Trayectoria',
};

const nombreVisible = (sena) => (sena === 'ninguna' ? 'Sin seña' : sena);

/** Banner con lo que la IA está reconociendo. Compartido por las pantallas de cámara. */
export function IaBanner({ recog, objetivo, textoInactivo, umbral = UMBRAL_CONFIANZA_MOSTRAR }) {
  const { iaResultado, iaEstado, analizandoMovimiento } = recog;
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
      ) : analizandoMovimiento ? (
        <Text style={estilos.iaTextoTenue} accessibilityLiveRegion="polite">
          〰 Analizando movimiento…
        </Text>
      ) : confiable ? (
        <Text style={estilos.iaTexto} accessibilityLiveRegion="polite">
          {iaResultado.origen ? (
            <Text style={iaResultado.dinamica ? estilos.iaOrigenDinamico : estilos.iaOrigen}>
              {`${ORIGENES[iaResultado.origen]}  `}
            </Text>
          ) : null}
          <Text style={[estilos.iaLetra, { color: acierto ? cameraColors.success : cameraColors.accent }]}>
            {nombreVisible(iaResultado.sena)}
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
  pantalla: { flex: 1, backgroundColor: cameraColors.stage },
  permisoBox: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 14,
  },
  permisoTitulo: { color: cameraColors.textStrong, fontSize: 20, fontWeight: '800' },
  permisoTexto: {
    color: cameraAlpha('text', 0.7),
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  permisoBtn: {
    backgroundColor: cameraColors.accent,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 4,
  },
  permisoBtnTexto: { color: cameraColors.text, fontWeight: '800', fontSize: 15 },
  permisoNota: { color: cameraAlpha('text', 0.5), fontSize: 12, textAlign: 'center' },
  barraControl: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: cameraAlpha('stage', 0.88),
    borderTopWidth: 1,
    borderTopColor: cameraAlpha('white', 0.08),
    gap: 10,
  },
  iaBanner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: cameraAlpha('white', 0.05),
    borderRadius: 10,
  },
  iaTexto: { color: cameraColors.textSoft, fontSize: 14, fontWeight: '600' },
  iaLetra: { fontSize: 18, fontWeight: '900' },
  iaOrigen: { color: cameraAlpha('text', 0.6), fontSize: 11, fontWeight: '700' },
  iaOrigenDinamico: { color: cameraColors.warning, fontSize: 11, fontWeight: '800' },
  iaTextoTenue: { color: cameraAlpha('text', 0.5), fontSize: 12 },
  iaTextoError: { color: cameraColors.dangerLight, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  errorCamaraBox: {
    backgroundColor: cameraAlpha('danger', 0.15),
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  errorCamaraTexto: {
    color: cameraColors.dangerLight,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  btnPrimario: {
    backgroundColor: cameraColors.accent,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 12,
  },
  btnPrimarioTexto: { color: cameraColors.text, fontWeight: '800', fontSize: 14 },
});
