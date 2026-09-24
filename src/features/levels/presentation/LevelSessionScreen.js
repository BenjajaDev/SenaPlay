import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import useReducedMotion from '../../../core/a11y/useReducedMotion';
import { AppText, Button, Card, MessageDialog, ProgressBar, ScreenHeader, useFeedback } from '../../../shared/ui';
import { useAppTheme } from '../../../shared/theme/ThemeProvider';
import { useRemoteConfig } from '../../remoteConfig/presentation/RemoteConfigProvider';
import { SESSION_STATUS } from '../domain/sessionMachine';
import { EXERCISE_COMPONENTS } from './exercises';
import FeedbackPanel from './session/FeedbackPanel';
import { HintFab, HintPopover } from './session/HintFab';
import LevelCompleteCelebration from './session/LevelCompleteCelebration';
import LivesCounter from './session/LivesCounter';
import useLevelSession from './session/useLevelSession';

/**
 * Sesión de un nivel. Solo orquesta; la lógica vive en:
 *   domain/sessionMachine + domain/evaluateAnswer   reglas (puras, testeadas)
 *   session/useLevelSession                          estado + efectos
 *   exercises/*                                      un componente por tipo
 *   session/*                                        vidas, feedback, pistas, celebración
 *
 * Props:
 *   level          nivel a jugar (ya validado por LevelBuilder)
 *   startingLives  vidas iniciales (config remota / pool de vidas)
 *   onComplete     (resultado) → al terminar; el shell guarda el progreso
 *   onLifeLost     () → cada error (descuenta del pool si aplica)
 *   onBack         salir de la sesión
 */
export default function LevelSessionScreen({ level, startingLives = 3, onComplete, onLifeLost, onBack }) {
  const theme = useAppTheme();
  const reducedMotion = useReducedMotion();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { config, isEnabled } = useRemoteConfig();
  const { confirm } = useFeedback();
  const hintsEnabled = config.difficulty?.hintsEnabled !== false;

  const { state, exercise, answer, hint, result, hasProgress, exerciseKey, actions } = useLevelSession({
    level,
    startingLives: Math.max(1, startingLives),
    scoringRules: config.scoring,
    onLifeLost,
    onComplete,
  });

  // Borde luminoso de la tarjeta del ejercicio al responder.
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!state.feedback) {
      glow.setValue(0);
      return;
    }
    glow.setValue(1);
    if (!reducedMotion) {
      Animated.timing(glow, { toValue: 0.4, duration: 1100, useNativeDriver: true }).start();
    }
  }, [state.feedback, glow, reducedMotion]);

  const requestExit = async () => {
    if (!hasProgress || state.status === SESSION_STATUS.COMPLETED) {
      onBack();
      return;
    }
    const leave = await confirm({
      title: '¿Salir del nivel?',
      message: 'Perderás el avance de esta sesión. Tus niveles completados no se ven afectados.',
      tone: 'warning',
      icon: 'exit-outline',
      confirmLabel: 'Salir',
      cancelLabel: 'Seguir practicando',
    });
    if (leave) onBack();
  };

  // Botón atrás de Android: misma confirmación que la flecha de la cabecera.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      requestExit();
      return true;
    });
    return () => subscription.remove();
  });

  const registry = exercise ? EXERCISE_COMPONENTS[exercise.type] : null;
  const ExerciseComponent = registry?.Component;
  const answering = state.status === SESSION_STATUS.ANSWERING;
  const progress = state.status === SESSION_STATUS.COMPLETED ? 1 : state.index / level.exercises.length;
  const accent = state.feedback?.kind === 'correct' ? theme.colors.success : theme.colors.danger;

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={`Nivel ${level.id}`}
        onBack={requestExit}
        backLabel="Salir del nivel"
        rightNode={
          <LivesCounter
            lives={state.lives}
            maxLives={state.maxLives}
            lostIndex={state.lostLifeIndex}
            mistakeTick={state.mistakeTick}
          />
        }
      />

      <View style={styles.meta}>
        <AppText variant="heading" numberOfLines={1} style={styles.flex}>
          {level.title}
        </AppText>
        <AppText variant="caption" tone="secondary">
          {Math.min(state.index + 1, level.exercises.length)} de {level.exercises.length}
        </AppText>
      </View>
      <ProgressBar value={progress} label="Progreso del nivel" />

      <View style={styles.flex}>
        <Card padding="md" style={styles.exerciseCard}>
          <AppText variant="heading" style={styles.exerciseTitle}>
            {exercise?.title}
          </AppText>
          {/* Solo el contenido del ejercicio scrollea; cabecera y botón de
              verificar/continuar quedan siempre visibles. */}
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.exerciseContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {ExerciseComponent ? (
              <ExerciseComponent
                key={exerciseKey}
                exercise={exercise}
                answer={answer}
                onAnswerChange={actions.changeAnswer}
                onPairResult={actions.reportMistake}
                onHint={hintsEnabled ? actions.showHint : undefined}
                disabled={!answering}
              />
            ) : (
              <AppText tone="secondary">Este ejercicio no está disponible en tu versión de la app.</AppText>
            )}
          </ScrollView>
          <Animated.View
            pointerEvents="none"
            style={[styles.glow, { borderColor: accent, shadowColor: accent, opacity: state.feedback ? glow : 0 }]}
          />
        </Card>

        {hintsEnabled && answering ? (
          <View style={styles.hintAnchor} pointerEvents="box-none">
            <HintPopover hint={hint} onClose={actions.closeHint} />
            <HintFab open={Boolean(hint)} used={state.hintedIndexes.includes(state.index)} onPress={actions.toggleHint} />
          </View>
        ) : null}
      </View>

      {state.notice ? (
        <View style={styles.notice} accessibilityLiveRegion="polite">
          <Ionicons name="information-circle" size={18} color={theme.colors.infoText} />
          <AppText variant="caption" tone="info" style={styles.flex}>
            {state.notice}
          </AppText>
        </View>
      ) : null}

      {state.feedback && state.status === SESSION_STATUS.FEEDBACK ? (
        <FeedbackPanel feedback={state.feedback} onContinue={actions.continue} />
      ) : registry?.autoSubmit ? null : (
        <Button label="Verificar" icon="checkmark-done" onPress={actions.submit} disabled={!answering} haptic />
      )}

      <MessageDialog
        visible={state.status === SESSION_STATUS.GAME_OVER}
        variant="warning"
        title="¡Casi lo logras!"
        message={
          startingLives > 0
            ? `Te quedaste sin vidas esta vez (${state.hits} aciertos). Cada intento te hace mejor.`
            : 'Te quedaste sin vidas. Se recargan con el tiempo: vuelve en un rato o repasa el diccionario.'
        }
        primaryText={startingLives > 0 ? 'Intentar de nuevo' : 'Salir'}
        secondaryText={startingLives > 0 ? 'Salir' : undefined}
        onPrimaryPress={startingLives > 0 ? () => actions.restart(Math.max(1, startingLives)) : onBack}
        onSecondaryPress={onBack}
        onRequestClose={onBack}
      />

      <LevelCompleteCelebration
        visible={state.status === SESSION_STATUS.COMPLETED}
        result={result}
        levelTitle={level.title}
        showConfetti={isEnabled('levels.celebration')}
        onContinue={onBack}
        onReplay={() => actions.restart(Math.max(1, startingLives))}
      />
    </View>
  );
}

function createStyles(theme) {
  const { spacing, radius, colors } = theme;
  return StyleSheet.create({
    screen: { flex: 1, gap: spacing.sm + 2 },
    flex: { flex: 1 },
    meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    exerciseCard: { flex: 1, gap: spacing.sm },
    exerciseTitle: { fontSize: 16 },
    exerciseContent: { flexGrow: 1, paddingBottom: 72 },
    glow: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: radius.lg,
      borderWidth: 3,
      shadowOpacity: 0.8,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 0 },
    },
    hintAnchor: { position: 'absolute', left: spacing.sm, right: spacing.sm, bottom: spacing.sm, alignItems: 'flex-end' },
    notice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.sm + 2,
      borderRadius: radius.md,
      backgroundColor: colors.infoSoft,
    },
  });
}
