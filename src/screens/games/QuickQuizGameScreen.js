import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AdaptiveModal from '../../components/AdaptiveModal';
import ActionButton from '../../components/ui/ActionButton';
import GameScreenHeader from '../../components/ui/GameScreenHeader';
import SignImage from '../../components/ui/SignImage';
import { useAppTheme } from '../../theme/ThemeProvider';

const QUESTIONS = [
  { sign: 'a', options: ['A', 'B', 'C'], correct: 'A' },
  { sign: 'b', options: ['A', 'B', 'D'], correct: 'B' },
  { sign: 'c', options: ['B', 'C', 'D'], correct: 'C' },
  { sign: 'd', options: ['C', 'D', 'E'], correct: 'D' },
  { sign: 'e', options: ['D', 'E', 'F'], correct: 'E' },
  { sign: 'f', options: ['E', 'F', 'G'], correct: 'F' },
];

const MAX_TIME = 10;

export default function QuickQuizGameScreen({ onBack }) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(MAX_TIME);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [isAnswerLocked, setIsAnswerLocked] = useState(false);

  const question = QUESTIONS[index];
  const progress = useMemo(() => (index / QUESTIONS.length) * 100, [index]);

  useEffect(() => {
    if (!started || showResult || isAnswerLocked) {
      return undefined;
    }

    if (timeLeft <= 0) {
      setIsAnswerLocked(true);
      setTimeout(() => {
        moveNext();
      }, 700);
      return undefined;
    }

    const timer = setTimeout(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [started, timeLeft, showResult, isAnswerLocked]);

  const startGame = () => {
    setStarted(true);
    setIndex(0);
    setTimeLeft(MAX_TIME);
    setScore(0);
    setCorrect(0);
    setShowResult(false);
    setIsAnswerLocked(false);
  };

  const moveNext = () => {
    if (index < QUESTIONS.length - 1) {
      setIndex((prev) => prev + 1);
      setTimeLeft(MAX_TIME);
      setIsAnswerLocked(false);
      return;
    }
    setShowResult(true);
  };

  const handleAnswer = (value) => {
    if (isAnswerLocked) {
      return;
    }

    setIsAnswerLocked(true);
    const isCorrect = value === question.correct;

    if (isCorrect) {
      setCorrect((prev) => prev + 1);
      setScore((prev) => prev + 50 + timeLeft * 10);
    }

    setTimeout(() => {
      moveNext();
    }, 700);
  };

  return (
    <View style={styles.screen}>
      <GameScreenHeader
        title="Quiz Rapido"
        onBack={onBack}
        rightNode={<Text style={styles.scoreLabel}>{score} pts</Text>}
      />

      {!started ? (
        <View style={styles.centerBox}>
          <Ionicons name="flash" size={66} color={theme.colors.gold} />
          <Text style={styles.welcomeTitle}>Ronda rapida de SEÑAS</Text>
          <Text style={styles.welcomeText}>6 preguntas. 10 segundos por cada una.</Text>
          <ActionButton
            label="Comenzar"
            onPress={startGame}
            style={styles.startBtn}
            gradientColors={[theme.colors.gold, theme.colors.goldDeep]}
          />
        </View>
      ) : (
        <View style={styles.gameBox}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>Pregunta {index + 1}/{QUESTIONS.length}</Text>
            <Text style={[styles.metaText, timeLeft <= 3 && styles.timerDanger]}>{timeLeft}s</Text>
          </View>

          <View style={styles.questionCard}>
            <Text style={styles.questionText}>Que letra representa esta SEÑA?</Text>
            <SignImage signKey={question.sign} size={96} rounded={16} />
          </View>

          <View style={styles.optionsList}>
            {question.options.map((option) => (
              <Pressable
                key={option}
                style={({ pressed }) => [styles.optionBtn, pressed && styles.optionBtnPressed]}
                onPress={() => handleAnswer(option)}
                disabled={isAnswerLocked}
              >
                <Text style={styles.optionText}>{option}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <AdaptiveModal
        visible={showResult}
        context="level-complete"
        title="Quiz finalizado"
        message={`Aciertos: ${correct}/${QUESTIONS.length}. Puntuacion: ${score}.`}
        primaryText="Jugar otra vez"
        secondaryText="Volver"
        onPrimaryPress={startGame}
        onSecondaryPress={onBack}
        onRequestClose={() => setShowResult(false)}
      />
    </View>
  );
}

function createStyles(theme) {
  const isDark = theme.mode === 'dark';

  return StyleSheet.create({
    screen: {
      flex: 1,
    },
    scoreLabel: {
      fontSize: 14,
      fontWeight: '800',
      color: theme.colors.gold,
    },
    centerBox: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    welcomeTitle: {
      fontSize: 24,
      fontWeight: '900',
      color: theme.colors.textPrimary,
      textAlign: 'center',
    },
    welcomeText: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      textAlign: 'center',
    },
    startBtn: {
      marginTop: 14,
      paddingHorizontal: 24,
    },
    gameBox: {
      flex: 1,
    },
    progressTrack: {
      height: 10,
      borderRadius: 999,
      backgroundColor: isDark ? '#3A3350' : '#E2E8F0',
      overflow: 'hidden',
      marginBottom: 10,
    },
    progressFill: {
      height: '100%',
      backgroundColor: theme.colors.primary,
    },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    metaText: {
      color: theme.colors.textSecondary,
      fontWeight: '700',
    },
    timerDanger: {
      color: theme.colors.danger,
    },
    questionCard: {
      backgroundColor: isDark ? '#261F3B' : '#FFFFFF',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isDark ? '#4B3B73' : '#E2E8F0',
      alignItems: 'center',
      paddingVertical: 20,
      marginBottom: 12,
    },
    questionText: {
      color: isDark ? '#E6DDBB' : '#334155',
      fontWeight: '700',
      marginBottom: 8,
    },
    optionsList: {
      gap: 8,
    },
    optionBtn: {
      backgroundColor: isDark ? '#221C35' : '#FFFFFF',
      borderWidth: 1,
      borderColor: isDark ? '#4B3B73' : '#CBD5E1',
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    optionBtnPressed: {
      backgroundColor: isDark ? '#2A2341' : '#F8FAFC',
    },
    optionText: {
      fontSize: 20,
      fontWeight: '900',
      color: theme.colors.textPrimary,
    },
  });
}
