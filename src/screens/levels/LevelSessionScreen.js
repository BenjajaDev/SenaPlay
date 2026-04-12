import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AdaptiveModal from '../../components/AdaptiveModal';
import ActionButton from '../../components/ui/ActionButton';
import GameScreenHeader from '../../components/ui/GameScreenHeader';
import SurfaceCard from '../../components/ui/SurfaceCard';
import { APP_FONTS } from '../../constants/fonts';

function shuffle(items) {
  const clone = [...items];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = clone[i];
    clone[i] = clone[j];
    clone[j] = temp;
  }
  return clone;
}

function buildMatchingCards(letters) {
  const cards = [];
  letters.forEach((sign, index) => {
    const label = sign.toUpperCase();
    cards.push({ id: `l-${index}`, type: 'letter', pair: sign, value: label });
    cards.push({ id: `s-${index}`, type: 'sign', pair: sign, value: sign });
  });
  return shuffle(cards);
}

function normalizeLetter(value) {
  return value.trim().toUpperCase().replace('N~', 'N~');
}

function displayLetter(value) {
  return String(value || '').toUpperCase();
}

function LifeCounter({ lives }) {
  return (
    <View style={styles.livesRow}>
      {Array.from({ length: 3 }).map((_, index) => (
        <Text key={`life-${index}`} style={styles.lifeIcon}>
          {index < lives ? 'â¤' : 'â™¡'}
        </Text>
      ))}
    </View>
  );
}

export default function LevelSessionScreen({ level, onBack, onComplete }) {
  const [current, setCurrent] = useState(0);
  const [lives, setLives] = useState(3);
  const [hits, setHits] = useState(0);
  const [fails, setFails] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [gameOverVisible, setGameOverVisible] = useState(false);
  const [finishVisible, setFinishVisible] = useState(false);
  const [hintText, setHintText] = useState('');

  const [matchingCards, setMatchingCards] = useState([]);
  const [matchingSelected, setMatchingSelected] = useState(null);
  const [matchingMatchedIds, setMatchingMatchedIds] = useState([]);

  const [choiceSelected, setChoiceSelected] = useState('');

  const [orderingPool, setOrderingPool] = useState([]);
  const [orderingSlots, setOrderingSlots] = useState([]);

  const [typingValue, setTypingValue] = useState('');

  const [recognitionSelected, setRecognitionSelected] = useState([]);

  const [wordPool, setWordPool] = useState([]);
  const [wordSlots, setWordSlots] = useState([]);

  const exercise = level.exercises[current];

  useEffect(() => {
    if (!exercise) {
      return;
    }

    setHintText('');
    setChoiceSelected('');
    setTypingValue('');
    setRecognitionSelected([]);

    if (exercise.type === 'matching') {
      setMatchingCards(buildMatchingCards(exercise.letters));
      setMatchingSelected(null);
      setMatchingMatchedIds([]);
    }

    if (exercise.type === 'ordering') {
      setOrderingPool(shuffle(exercise.letters));
      setOrderingSlots(Array(exercise.letters.length).fill(null));
    }

    if (exercise.type === 'build-word' || exercise.type === 'interpret-signs') {
      setWordPool(shuffle(exercise.letters));
      setWordSlots(Array(exercise.word.length).fill(null));
    }
  }, [current, exercise]);

  const progress = useMemo(() => {
    if (!level.exercises.length) {
      return 0;
    }
    return (current / level.exercises.length) * 100;
  }, [current, level.exercises.length]);

  const loseLife = () => {
    setFails((prev) => prev + 1);
    setLives((prev) => {
      const next = prev - 1;
      if (next <= 0) {
        setGameOverVisible(true);
        return 0;
      }
      return next;
    });
  };

  const handleAnswer = (isCorrect, incorrectMessage) => {
    if (isCorrect) {
      setHits((prev) => prev + 1);
      setFeedback({ kind: 'correct', message: 'Excelente, respuesta correcta.' });
      return;
    }

    loseLife();
    setFeedback({ kind: 'incorrect', message: incorrectMessage || 'Respuesta incorrecta.' });
  };

  const goNext = () => {
    if (feedback?.kind === 'correct') {
      if (current < level.exercises.length - 1) {
        setCurrent((prev) => prev + 1);
      } else {
        setFinishVisible(true);
      }
    }
    setFeedback(null);
  };

  const handleMatchingCard = (card) => {
    if (matchingMatchedIds.includes(card.id) || feedback || lives <= 0) {
      return;
    }

    if (!matchingSelected) {
      setMatchingSelected(card);
      return;
    }

    if (matchingSelected.id === card.id || matchingSelected.type === card.type) {
      setMatchingSelected(card);
      return;
    }

    const isCorrect = matchingSelected.pair === card.pair;
    if (isCorrect) {
      const nextMatched = [...matchingMatchedIds, matchingSelected.id, card.id];
      setMatchingMatchedIds(nextMatched);
      setMatchingSelected(null);
      if (nextMatched.length === matchingCards.length) {
        handleAnswer(true);
      }
      return;
    }

    setMatchingSelected(null);
    handleAnswer(false, 'No es pareja correcta.');
  };

  const submitCurrentExercise = () => {
    if (!exercise || lives <= 0) {
      return;
    }

    if (exercise.type === 'multiple-choice') {
      if (!choiceSelected) {
        handleAnswer(false, 'Debes seleccionar una opcion.');
        return;
      }
      handleAnswer(choiceSelected === exercise.correct, 'Seleccion incorrecta.');
      return;
    }

    if (exercise.type === 'ordering') {
      const complete = orderingSlots.every(Boolean);
      if (!complete) {
        handleAnswer(false, 'Completa el orden antes de verificar.');
        return;
      }
      const built = orderingSlots.join('|');
      const expected = exercise.letters.join('|');
      handleAnswer(built === expected, 'El orden alfabetico no es correcto.');
      return;
    }

    if (exercise.type === 'typing') {
      if (!typingValue.trim()) {
        handleAnswer(false, 'Escribe una letra para responder.');
        return;
      }
      handleAnswer(normalizeLetter(typingValue) === normalizeLetter(exercise.answer), 'La letra no coincide.');
      return;
    }

    if (exercise.type === 'recognition') {
      const a = [...recognitionSelected].sort().join('|');
      const b = [...exercise.correct].sort().join('|');
      handleAnswer(a === b, 'La seleccion de letras no coincide con las SEÑAS.');
      return;
    }

    if (exercise.type === 'build-word' || exercise.type === 'interpret-signs') {
      const complete = wordSlots.every(Boolean);
      if (!complete) {
        handleAnswer(false, 'Completa la palabra antes de verificar.');
        return;
      }
      const builtWord = wordSlots.join('');
      handleAnswer(builtWord === exercise.word, 'La palabra formada no es correcta.');
    }
  };

  const toggleRecognition = (letter) => {
    if (feedback) {
      return;
    }
    setRecognitionSelected((prev) => {
      if (prev.includes(letter)) {
        return prev.filter((item) => item !== letter);
      }
      return [...prev, letter];
    });
  };

  const addOrderingLetter = (letter) => {
    if (feedback) {
      return;
    }
    const slotIndex = orderingSlots.findIndex((item) => item === null);
    if (slotIndex < 0) {
      return;
    }
    const poolIndex = orderingPool.findIndex((item) => item === letter);
    if (poolIndex < 0) {
      return;
    }

    const nextSlots = [...orderingSlots];
    nextSlots[slotIndex] = letter;
    const nextPool = [...orderingPool];
    nextPool.splice(poolIndex, 1);
    setOrderingSlots(nextSlots);
    setOrderingPool(nextPool);
  };

  const removeOrderingSlot = (index) => {
    if (feedback) {
      return;
    }
    const letter = orderingSlots[index];
    if (!letter) {
      return;
    }
    const nextSlots = [...orderingSlots];
    nextSlots[index] = null;
    setOrderingSlots(nextSlots);
    setOrderingPool((prev) => [...prev, letter]);
  };

  const addWordLetter = (letter) => {
    if (feedback) {
      return;
    }
    const slotIndex = wordSlots.findIndex((item) => item === null);
    if (slotIndex < 0) {
      return;
    }
    const poolIndex = wordPool.findIndex((item) => item === letter);
    if (poolIndex < 0) {
      return;
    }

    const nextSlots = [...wordSlots];
    nextSlots[slotIndex] = letter;
    const nextPool = [...wordPool];
    nextPool.splice(poolIndex, 1);
    setWordSlots(nextSlots);
    setWordPool(nextPool);
  };

  const removeWordSlot = (index) => {
    if (feedback) {
      return;
    }
    const letter = wordSlots[index];
    if (!letter) {
      return;
    }
    const nextSlots = [...wordSlots];
    nextSlots[index] = null;
    setWordSlots(nextSlots);
    setWordPool((prev) => [...prev, letter]);
  };

  const renderExercise = () => {
    if (!exercise) {
      return null;
    }

    if (exercise.type === 'matching') {
      return (
        <View style={styles.exerciseBlock}>
          <Text style={styles.exerciseHint}>Toca una SEÑA y luego su letra correspondiente.</Text>
          <View style={styles.matchGrid}>
            {matchingCards.map((card) => {
              const active = matchingSelected?.id === card.id;
              const matched = matchingMatchedIds.includes(card.id);
              const isSign = card.type === 'sign';
              const displayValue = isSign ? card.value : card.value.toUpperCase();
              return (
                <Pressable
                  key={card.id}
                  style={[
                    styles.matchCard,
                    active && styles.matchCardActive,
                    matched && styles.matchCardDone,
                  ]}
                  onLongPress={() => {
                    if (card.type === 'sign') {
                      setHintText(`Pista de SEÑA: ${card.value}`);
                    }
                  }}
                  onPress={() => handleMatchingCard(card)}
                >
                  <Text
                    style={[
                      styles.matchText,
                      matched && styles.matchTextDone,
                      isSign && styles.signText,
                    ]}
                  >
                    {displayValue}
                  </Text>
                  <Text style={[styles.matchType, matched && styles.matchTextDone]}>
                    {card.type === 'sign' ? 'SEÑA' : 'LETRA'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      );
    }

    if (exercise.type === 'multiple-choice') {
      return (
        <View style={styles.exerciseBlock}>
          <SurfaceCard style={styles.signCard}>
            <Text style={[styles.signLarge, styles.signText]}>{exercise.sign}</Text>
            <Text style={styles.signLabel}>SEÑA mostrada</Text>
          </SurfaceCard>
          <View style={styles.optionList}>
            {exercise.options.map((option) => (
              <Pressable
                key={option}
                style={[styles.optionBtn, choiceSelected === option && styles.optionBtnActive]}
                onPress={() => setChoiceSelected(option)}
              >
                <Text style={[styles.optionText, choiceSelected === option && styles.optionTextActive]}>
                  {displayLetter(option)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      );
    }

    if (exercise.type === 'ordering') {
      return (
        <View style={styles.exerciseBlock}>
          <Text style={styles.exerciseHint}>Completa los espacios en orden alfabetico.</Text>
          <View style={styles.slotRow}>
            {orderingSlots.map((item, index) => (
              <Pressable key={`slot-${index}`} style={styles.slot} onPress={() => removeOrderingSlot(index)}>
                <Text style={styles.slotText}>{item ? displayLetter(item) : '_'}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.poolRow}>
            {orderingPool.map((item, index) => (
              <Pressable key={`pool-${item}-${index}`} style={styles.poolChip} onPress={() => addOrderingLetter(item)}>
                <Text style={styles.poolText}>{displayLetter(item)}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      );
    }

    if (exercise.type === 'typing') {
      return (
        <View style={styles.exerciseBlock}>
          <SurfaceCard style={styles.signCard}>
            <Text style={[styles.signLarge, styles.signText]}>{exercise.sign}</Text>
            <Text style={styles.signLabel}>Escribe la letra</Text>
          </SurfaceCard>
          <TextInput
            value={typingValue}
            onChangeText={setTypingValue}
            placeholder="Ej: A"
            autoCapitalize="characters"
            style={styles.input}
            placeholderTextColor="#94A3B8"
          />
        </View>
      );
    }

    if (exercise.type === 'recognition') {
      return (
        <View style={styles.exerciseBlock}>
          <Text style={styles.exerciseHint}>Selecciona las letras que representan estas SEÑAS.</Text>
          <SurfaceCard style={styles.signStrip}>
            {exercise.signs.map((sign) => (
              <Text key={sign} style={[styles.signStripText, styles.signText]}>{sign}</Text>
            ))}
          </SurfaceCard>
          <View style={styles.poolRow}>
            {exercise.options.map((item) => {
              const selected = recognitionSelected.includes(item);
              return (
                <Pressable
                  key={item}
                  style={[styles.poolChip, selected && styles.poolChipActive]}
                  onPress={() => toggleRecognition(item)}
                >
                  <Text style={[styles.poolText, selected && styles.poolTextActive]}>{displayLetter(item)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      );
    }

    if (exercise.type === 'build-word' || exercise.type === 'interpret-signs') {
      return (
        <View style={styles.exerciseBlock}>
          {exercise.type === 'interpret-signs' ? (
            <>
              <Text style={styles.exerciseHint}>Interpreta las SEÑAS y forma la palabra correcta.</Text>
              <SurfaceCard style={styles.signStrip}>
                {exercise.signs.map((sign) => (
                  <Text key={sign} style={[styles.signStripText, styles.signText]}>{sign}</Text>
                ))}
              </SurfaceCard>
            </>
          ) : (
            <Text style={styles.exerciseHint}>Palabra objetivo: {exercise.word}</Text>
          )}

          <View style={styles.slotRow}>
            {wordSlots.map((item, index) => (
              <Pressable key={`word-slot-${index}`} style={styles.slot} onPress={() => removeWordSlot(index)}>
                <Text style={styles.slotText}>{item ? displayLetter(item) : '_'}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.poolRow}>
            {wordPool.map((item, index) => (
              <Pressable key={`word-pool-${item}-${index}`} style={styles.poolChip} onPress={() => addWordLetter(item)}>
                <Text style={styles.poolText}>{displayLetter(item)}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      );
    }

    return null;
  };

  return (
    <View style={styles.screen}>
      <GameScreenHeader title={`Nivel ${level.id}`} onBack={onBack} />

      <View style={styles.topMeta}>
        <View>
          <Text style={styles.levelTitle}>{level.title}</Text>
          <Text style={styles.levelSubtitle}>Ejercicio {current + 1} de {level.exercises.length}</Text>
        </View>
        <LifeCounter lives={lives} />
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>

      <SurfaceCard style={styles.exerciseCard}>
        <Text style={styles.exerciseTitle}>{exercise?.title}</Text>
        {hintText ? <Text style={styles.hintText}>{hintText}</Text> : null}
        {exercise?.hint ? (
          <Pressable onPress={() => setHintText(`Pista: ${exercise.hint}`)}>
            <Text style={styles.showHintText}>Mostrar pista</Text>
          </Pressable>
        ) : null}
        {renderExercise()}
      </SurfaceCard>

      {feedback ? (
        <SurfaceCard style={[styles.feedbackCard, feedback.kind === 'correct' ? styles.feedbackGood : styles.feedbackBad]}>
          <Text style={styles.feedbackTitle}>{feedback.kind === 'correct' ? 'Correcto' : 'Incorrecto'}</Text>
          <Text style={styles.feedbackMessage}>{feedback.message}</Text>
          <ActionButton
            label={feedback.kind === 'correct' ? 'Continuar' : 'Intentar de nuevo'}
            onPress={goNext}
            style={feedback.kind === 'correct' ? styles.feedbackBtnGood : styles.feedbackBtnBad}
          />
        </SurfaceCard>
      ) : (
        <ActionButton label="Verificar" onPress={submitCurrentExercise} style={styles.verifyBtn} />
      )}

      <AdaptiveModal
        visible={gameOverVisible}
        context="auth-error"
        title="Se acabaron las vidas"
        message={`Fallos: ${fails}. Vuelve a intentar el nivel.`}
        primaryText="Reiniciar nivel"
        secondaryText="Volver"
        onPrimaryPress={() => {
          setGameOverVisible(false);
          setCurrent(0);
          setLives(3);
          setHits(0);
          setFails(0);
          setFeedback(null);
        }}
        onSecondaryPress={onBack}
        onRequestClose={() => setGameOverVisible(false)}
      />

      <AdaptiveModal
        visible={finishVisible}
        context="level-complete"
        title="Nivel completado"
        message={`Aciertos: ${hits}/${level.exercises.length}. Vidas restantes: ${lives}.`}
        primaryText="Continuar"
        secondaryText="Volver"
        onPrimaryPress={() => {
          setFinishVisible(false);
          if (onComplete) {
            onComplete({
              levelId: level.id,
              score: Math.max(0, hits * 100 - fails * 30 + lives * 20),
              hits,
              fails,
            });
          }
        }}
        onSecondaryPress={onBack}
        onRequestClose={() => setFinishVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    gap: 10,
  },
  topMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  levelTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
  },
  levelSubtitle: {
    color: '#64748B',
    fontSize: 12,
  },
  livesRow: {
    flexDirection: 'row',
    gap: 3,
  },
  lifeIcon: {
    color: '#EF4444',
    fontSize: 18,
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#7E57C2',
  },
  exerciseCard: {
    flex: 1,
    padding: 12,
    gap: 10,
  },
  exerciseTitle: {
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '800',
  },
  hintText: {
    fontSize: 12,
    color: '#0369A1',
    backgroundColor: '#E0F2FE',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  showHintText: {
    color: '#7E57C2',
    fontSize: 12,
    fontWeight: '700',
  },
  exerciseBlock: {
    flex: 1,
    gap: 10,
  },
  exerciseHint: {
    color: '#64748B',
    fontSize: 13,
  },
  matchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  matchCard: {
    width: '31%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    minHeight: 80,
  },
  matchCardActive: {
    borderColor: '#60A5FA',
    backgroundColor: '#EFF6FF',
  },
  matchCardDone: {
    borderColor: '#22C55E',
    backgroundColor: '#DCFCE7',
  },
  matchText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
  },
  matchTextDone: {
    color: '#166534',
  },
  matchType: {
    marginTop: 4,
    fontSize: 10,
    color: '#64748B',
    fontWeight: '700',
  },
  signCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  signLarge: {
    fontSize: 56,
    color: '#7E57C2',
    fontWeight: '900',
  },
  signText: {
    fontFamily: APP_FONTS.sign,
    fontWeight: '400',
  },
  signLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  signStrip: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  signStripText: {
    fontSize: 28,
    color: '#7E57C2',
  },
  optionList: {
    gap: 8,
  },
  optionBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    alignItems: 'center',
  },
  optionBtnActive: {
    borderColor: '#7E57C2',
    backgroundColor: '#F5F3FF',
  },
  optionText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#334155',
  },
  optionTextActive: {
    color: '#6D28D9',
  },
  slotRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  slot: {
    minWidth: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  slotText: {
    fontWeight: '800',
    color: '#0F172A',
  },
  poolRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  poolChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  poolChipActive: {
    borderColor: '#7E57C2',
    backgroundColor: '#F5F3FF',
  },
  poolText: {
    color: '#334155',
    fontWeight: '800',
  },
  poolTextActive: {
    color: '#6D28D9',
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    paddingVertical: 10,
  },
  feedbackCard: {
    padding: 12,
    gap: 8,
  },
  feedbackGood: {
    borderColor: '#22C55E',
    backgroundColor: '#F0FDF4',
  },
  feedbackBad: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  feedbackTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  feedbackMessage: {
    color: '#475569',
    fontSize: 13,
  },
  feedbackBtnGood: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  feedbackBtnBad: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  verifyBtn: {
    backgroundColor: '#7E57C2',
    borderColor: '#7E57C2',
  },
});
