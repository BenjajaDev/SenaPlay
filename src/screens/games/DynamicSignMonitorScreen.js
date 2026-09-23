import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GameScreenHeader from '../../components/ui/GameScreenHeader';
import { CameraStage, IaBanner, estilos, useSignRecognition } from './signCamera';

// Señas que hoy tiene entrenadas el modelo dinámico (TCN). Solo informativo:
// el modelo igual devuelve su mejor intento con cualquier seña que se grabe.
const SEÑAS_ENTRENADAS = ['G', 'J', 'Mi', 'Nombre', 'Presento', 'S', 'X', 'Yo', 'Z'];

/**
 * Monitoreo del modelo de señas DINÁMICAS (TCN, con movimiento): graba un
 * clip corto de la cámara y lo sube al servidor, que lo procesa con el mismo
 * pipeline que generó el dataset de entrenamiento.
 *
 * A diferencia de las otras pantallas de cámara, esto no es un juego con
 * objetivo — es una herramienta para ir probando el modelo a medida que se
 * agregan más señas/signantes, así que no compara contra una seña objetivo.
 */
export default function DynamicSignMonitorScreen({ onBack }) {
  const insets = useSafeAreaInsets();
  const recog = useSignRecognition();
  const { iaResultado, iaEstado, grabando, errorCamara, activarModoLibre, iniciarGrabacion } = recog;

  useEffect(() => {
    if (recog.permisoCamara && !recog.permisoCamara.granted && recog.permisoCamara.canAskAgain) {
      recog.pedirPermisoCamara();
    }
  }, [recog.permisoCamara, recog.pedirPermisoCamara]);

  useEffect(() => {
    activarModoLibre();
  }, [activarModoLibre]);

  const procesando = iaEstado === 'procesando';

  return (
    <View style={estilos.pantalla}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: 12 }}>
        <GameScreenHeader title="Señas dinámicas (beta)" onBack={onBack} />
      </View>

      <CameraStage recog={recog} />

      <View style={[propios.avisoBox, { top: insets.top + 54 }]}>
        <Text style={propios.avisoTexto}>
          Modelo en entrenamiento · señas: {SEÑAS_ENTRENADAS.join(', ')}
        </Text>
      </View>

      <View style={[estilos.barraControl, { paddingBottom: insets.bottom + 8 }]}>
        {errorCamara ? (
          <View style={estilos.errorCamaraBox}>
            <Text style={estilos.errorCamaraTexto}>⚠ {errorCamara}</Text>
          </View>
        ) : null}

        <IaBanner recog={recog} textoInactivo="Graba una seña con movimiento para probarla" />

        {iaResultado && typeof iaResultado.ratioConMano === 'number' ? (
          <Text style={propios.diagnostico}>
            {iaResultado.framesProcesados} frames · {Math.round(iaResultado.ratioConMano * 100)}% con mano detectada
          </Text>
        ) : null}

        <TouchableOpacity
          style={[propios.btnGrabar, (grabando || procesando) && propios.btnGrabarActivo]}
          onPress={iniciarGrabacion}
          disabled={grabando || procesando}
        >
          {grabando || procesando ? (
            <>
              <ActivityIndicator color="#FFFFFF" size="small" />
              <Text style={propios.btnGrabarTexto}>
                {grabando ? 'Grabando…' : 'Procesando…'}
              </Text>
            </>
          ) : (
            <Text style={propios.btnGrabarTexto}>● Grabar seña</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const propios = StyleSheet.create({
  avisoBox: {
    position: 'absolute',
    left: 14,
    right: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.75)',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  avisoTexto: {
    color: 'rgba(226,232,240,0.75)',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  diagnostico: {
    color: 'rgba(226,232,240,0.45)',
    fontSize: 11,
    textAlign: 'center',
  },
  btnGrabar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EF4444',
    paddingVertical: 14,
    borderRadius: 16,
  },
  btnGrabarActivo: {
    backgroundColor: 'rgba(239,68,68,0.5)',
  },
  btnGrabarTexto: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
});
