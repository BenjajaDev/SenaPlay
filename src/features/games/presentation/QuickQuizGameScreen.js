import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import announce from '../../../core/a11y/announce';
import haptics from '../../../core/feedback/haptics';
import { AppText, Button, Card, MessageDialog, ProgressBar, ScreenHeader } from '../../../shared/ui';
import { useAppTheme } from '../../../shared/theme/ThemeProvider';
import OptionTile from '../../levels/presentation/exercises/OptionTile';
import { useRemoteConfig } from '../../remoteConfig/presentation/RemoteConfigProvider';
import SignImage from '../../signs/presentation/SignImage';

const QUESTIONS = [
  { sign: 'a', options: ['A', 'B', 'C'], correct: 'A' },
  { sign: 'b', options: ['A', 'B', 'D'], correct: 'B' },
  { sign: 'c', options: ['B', 'C', 'D'], correct: 'C' },
  { sign: 'd', options: ['C', 'D', 'E'], correct: 'D' },
  { sign: 'e', options: ['D', 'E', 'F'], correct: 'E' },
  { sign: 'f', options: ['E', 'F', 'G'], correct: 'F' },
];

const REVEAL_MS = 900;

/**
 * Quiz contrarreloj. Tiempo por pregunta configurable remotamente
 * (difficulty.quizSecondsPerQuestion). Al responder se revela la correcta:
 * la elegida se marca ✓ o ✕ con color, icono, vibración y anuncio.
 */
export default function QuickQuizGameScreen({ onBack }) {
  const theme = useAppTheme();
  const { config } = useRemoteConfig();
  const maxTime = Math.max(3, Number(config.difficulty?.quizSecondsPerQuestion) || 10);

  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(maxTime);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [picked, setPicked] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const revealTimer = useRef(null);

  const question = QUESTIONS[index];
  const locked = picked !== null;

  useEffect(() => () => clearTimeout(revealTimer.current), []);

  const moveNext = () => {
    setPicked(null);
    if (index < QUESTIONS.length - 1) {
      setIndex((prev) => prev + 1);
      setTimeLeft(maxTime);
    } else {
      setShowResult(true);
    }
  };

  const reveal = (value) => {
    setPicked(value);
    const isCorrect = value === question.correct;
    if (isCorrect) {
      haptics.success();
      announce('Correcto');
      setCorrectCount((prev) => prev + 1);
      setScore((prev) => prev + 50 + timeLeft * 10);
    } else {
      haptics.error();
      announce(value === '__timeout__' ? `Se acabó el tiempo. Era ${question.correct}` : `Incorrecto. Era ${question.correct}`);
    }
    revealTimer.current = setTimeout(moveNext, REVEAL_MS);
  };

  useEffect(() => {
    if (!started || showResult || locked) return undefined;
    if (timeLeft <= 0) {
      reveal('__timeout__');
      return undefined;
    }
    const timer = setTimeout(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, timeLeft, showResult, locked]);

  const startGame = () => {
    clearTimeout(revealTimer.current);
    setStarted(true);
    setIndex(0);
    setTimeLeft(maxTime);
    setScore(0);
    setCorrectCount(0);
    setPicked(null);
    setShowResult(false);
  };

  const optionState = (option) => {
    if (!locked) return 'idle';
    if (option === question.correct) return 'matched';
    if (option === picked) return 'selected';
    return 'idle';
  };

  const timeRatio = useMemo(() => timeLeft / maxTime, [timeLeft, maxTime]);

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Quiz rápido"
        onBack={onBack}
        rightNode={
          <AppText variant="label" tone="brand" accessibilityLabel={`${score} puntos`}>
            {score} pts
          </AppText>
        }
      />

      {!started ? (
        <Card variant="gradient" padding="xl" style={styles.welcome}>
          <Ionicons name="flash" size={64} color={theme.colors.gold} />
          <AppText variant="title" align="center">
            Ronda rápida de señas
          </AppText>
          <AppText variant="body" tone="secondary" align="center">
            {QUESTIONS.length} preguntas · {maxTime} segundos por cada una
          </AppText>
          <Button label="Comenzar" icon="play" onPress={startGame} haptic />
        </Card>
      ) : (
        <View style={styles.game}>
          <View style={styles.metaRow}>
            <AppText variant="caption" tone="secondary">
              Pregunta {index + 1}/{QUESTIONS.length}
            </AppText>
            <View style={styles.timer} accessible accessibilityLabel={`Quedan ${timeLeft} segundos`}>
              <Ionicons name="timer-outline" size={16} color={timeLeft <= 3 ? theme.colors.dangerText : theme.colors.textSecondary} />
              <AppText variant="label" tone={timeLeft <= 3 ? 'danger' : 'secondary'}>
                {timeLeft}s
              </AppText>
            </View>
          </View>
          <ProgressBar value={timeRatio} gradient={timeLeft <= 3 ? 'danger' : 'reward'} label="Tiempo restante" />

          <Card padding="lg" style={styles.questionCard}>
            <AppText variant="bodyStrong">¿Qué letra representa esta seña?</AppText>
            <SignImage signKey={question.sign} size={120} rounded={theme.radius.xl} />
          </Card>

          <View style={styles.options}>
            {question.options.map((option) => {
              const state = optionState(option);
              const wrongPick = state === 'selected';
              return (
                <OptionTile
                  key={option}
                  state={state}
                  disabled={locked}
                  onPress={() => reveal(option)}
                  accessibilityLabel={`Letra ${option}`}
                  style={[styles.option, wrongPick && { borderColor: theme.colors.danger, backgroundColor: theme.colors.dangerSoft }]}
                >
                  <View style={styles.optionInner}>
                    <AppText variant="display" tone={wrongPick ? 'danger' : state === 'matched' ? 'success' : 'primary'}>
                      {option}
                    </AppText>
                    {wrongPick ? <Ionicons name="close-circle" size={22} color={theme.colors.dangerText} /> : null}
                  </View>
                </OptionTile>
              );
            })}
          </View>
        </View>
      )}

      <MessageDialog
        visible={showResult}
        variant={correctCount >= QUESTIONS.length / 2 ? 'celebration' : 'info'}
        title="Quiz finalizado"
        message={`Aciertos: ${correctCount}/${QUESTIONS.length}. Puntuación: ${score}.`}
        primaryText="Jugar otra vez"
        secondaryText="Volver"
        onPrimaryPress={startGame}
        onSecondaryPress={onBack}
        onRequestClose={() => setShowResult(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, gap: 12 },
  welcome: { alignItems: 'center', gap: 12, marginTop: 24 },
  game: { gap: 12 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  questionCard: { alignItems: 'center', gap: 12 },
  options: { gap: 10 },
  option: { minHeight: 56 },
  optionInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
