import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import CameraLayout, { CameraButton } from './CameraLayout';
import { IaBanner, useSignRecognition } from './signCamera';
import { cameraAlpha, cameraColors } from '../../../shared/theme/tokens/colors';
import { poppins } from '../../../shared/theme/fonts';

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
  const recog = useSignRecognition();
  const { iaResultado, iaEstado, grabando, activarModoLibre, iniciarGrabacion } = recog;

  useEffect(() => {
    if (recog.permisoCamara && !recog.permisoCamara.granted && recog.permisoCamara.canAskAgain) {
      recog.pedirPermisoCamara();
    }
  }, [recog.permisoCamara, recog.pedirPermisoCamara]);

  useEffect(() => {
    activarModoLibre();
  }, [activarModoLibre]);

  const procesando = iaEstado === 'procesando';

  const ocupado = grabando || procesando;

  return (
    <CameraLayout
      title="Señas dinámicas (beta)"
      onBack={onBack}
      recog={recog}
      overlay={
        <View style={propios.avisoBox}>
          <Text style={propios.avisoTexto}>Modelo en entrenamiento · señas: {SEÑAS_ENTRENADAS.join(', ')}</Text>
        </View>
      }
    >
      <IaBanner recog={recog} textoInactivo="Graba una seña con movimiento para probarla" />

      {iaResultado && typeof iaResultado.ratioConMano === 'number' ? (
        <Text style={propios.diagnostico}>
          {iaResultado.framesProcesados} frames · {Math.round(iaResultado.ratioConMano * 100)}% con mano detectada
        </Text>
      ) : null}

      <CameraButton
        label={grabando ? 'Grabando…' : procesando ? 'Procesando…' : 'Grabar seña'}
        icon="radio-button-on"
        variant="danger"
        busy={ocupado}
        onPress={iniciarGrabacion}
        accessibilityLabel={grabando ? 'Grabando seña' : procesando ? 'Procesando seña' : 'Grabar seña'}
      />
    </CameraLayout>
  );
}

const propios = StyleSheet.create({
  // Dentro del visor, arriba y a todo el ancho: el texto no se corta.
  avisoBox: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    alignItems: 'center',
    backgroundColor: cameraAlpha('stage', 0.82),
    borderWidth: 1,
    borderColor: cameraAlpha('warning', 0.6),
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  avisoTexto: {
    color: cameraColors.warning,
    fontSize: 12,
    fontFamily: poppins(600),
    textAlign: 'center',
  },
  diagnostico: {
    color: cameraColors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
});
