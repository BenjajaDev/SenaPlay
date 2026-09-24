import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MessageDialog from '../../../shared/ui/feedback/MessageDialog';
import ActionButton from '../../../shared/ui/ActionButton';
import ScreenHeader from '../../../shared/ui/ScreenHeader';
import SignImage from '../../signs/presentation/SignImage';
import SurfaceCard from '../../../shared/ui/SurfaceCard';
import { APP_FONTS } from '../../../shared/theme/fonts';
import { normalizeHint } from '../../signs/domain/signDescription';
import { useAppTheme } from '../../../shared/theme/ThemeProvider';

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
  return String(value || '').trim().toLocaleUpperCase('es');
}

function displayLetter(value) {
  return String(value || '').toLocaleUpperCase('es');
}

function displaySign(value) {
  return String(value || '').toLocaleLowerCase('es');
}

function LifeCounter({ lives, livesShake, lostHeartPulse, lostHeartIndex, styles }) {
  const heartScale = lostHeartPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.8],
  });
  const heartTranslate = lostHeartPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });

  return (
    <Animated.View style={[styles.livesRow, { transform: [{ translateX: livesShake }] }]}>
      {Array.from({ length: 3 }).map((_, index) => {
        const isFilled = index < lives;
        const isJustLost = index === lostHeartIndex;
        return (
          <Animated.Text
            key={`life-${index}`}
            style={[
              styles.lifeIcon,
              isJustLost && {
                color: '#EF4444',
                transform: [{ scale: heartScale }, { translateY: heartTranslate }],
              },
            ]}
          >
            {isFilled ? '❤' : '♡'}
          </Animated.Text>
        );
      })}
    </Animated.View>
  );
}

export default function LevelSessionScreen({ level, onBack, onComplete }) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [current, setCurrent] = useState(0);
  const [lives, setLives] = useState(3);
  const [hits, setHits] = useState(0);
  const [fails, setFails] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [gameOverVisible, setGameOverVisible] = useState(false);
  const [finishVisible, setFinishVisible] = useState(false);
  // Pista normalizada: { texto } para las de levelsConfig, o { parametros }
  // cuando se deduce de la descripción fonológica de la seña.
  const [hint, setHint] = useState(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [lostHeartIndex, setLostHeartIndex] = useState(-1);

  const livesShake = useRef(new Animated.Value(0)).current;
  const lostHeartPulse = useRef(new Animated.Value(0)).current;
  const hintAnim = useRef(new Animated.Value(0)).current;
  const wrongFlash = useRef(new Animated.Value(0)).current;

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

    setHint(null);
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

  const triggerLifeAnimation = (lostIndex) => {
    setLostHeartIndex(lostIndex);
    livesShake.setValue(0);
    lostHeartPulse.setValue(1);
    wrongFlash.setValue(1);

    Animated.parallel([
      Animated.sequence([
        Animated.timing(livesShake, { toValue: 12, duration: 50, useNativeDriver: true }),
        Animated.timing(livesShake, { toValue: -12, duration: 50, useNativeDriver: true }),
        Animated.timing(livesShake, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(livesShake, { toValue: -8, duration: 50, useNativeDriver: true }),
        Animated.timing(livesShake, { toValue: 6, duration: 50, useNativeDriver: true }),
        Animated.timing(livesShake, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]),
      Animated.timing(lostHeartPulse, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(wrongFlash, {
        toValue: 0,
        duration: 600,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const loseLife = () => {
    setFails((prev) => prev + 1);
    setLives((prev) => {
      const next = prev - 1;
      triggerLifeAnimation(next);
      if (next <= 0) {
        setGameOverVisible(true);
        return 0;
      }
      return next;
    });
  };

  /**
   * Muestra una pista.
   *
   * `fuente` puede ser la pista del ejercicio (texto o parámetros) y `signKey`
   * la seña sobre la que se pidió. Si el ejercicio no trae pista propia, se
   * deduce de la descripción fonológica de esa seña — así mantener presionada
   * cualquier casilla da ayuda útil, no solo los ejercicios que la definieron.
   */
  const revealHint = (fuente, signKey) => {
    const normalizada = normalizeHint(fuente, signKey);
    if (!normalizada) return;
    setHint(normalizada);
    setHintsUsed((prev) => prev + 1);
    hintAnim.setValue(0);
    Animated.timing(hintAnim, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
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
      return;
    }

    if (exercise.type === 'word-meaning') {
      if (!choiceSelected) {
        handleAnswer(false, 'Selecciona una opción.');
        return;
      }
      handleAnswer(choiceSelected === exercise.correct, 'Ese no es el significado correcto.');
      return;
    }

    if (exercise.type === 'true-false') {
      if (!choiceSelected) {
        handleAnswer(false, 'Responde Verdadero o Falso.');
        return;
      }
      const expected = exercise.answer ? 'true' : 'false';
      handleAnswer(choiceSelected === expected, 'Respuesta incorrecta.');
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
      const isDense = exercise.letters.length > 5;
      const cardStyle = isDense ? styles.matchCardDense : styles.matchCard;
      const textStyle = isDense ? styles.matchTextDense : styles.matchText;
      const typeStyle = isDense ? styles.matchTypeDense : styles.matchType;
      return (
        <View style={styles.exerciseBlock}>
          <Text style={styles.exerciseHint}>Toca una SEÑA y luego su letra correspondiente.</Text>
          <View style={styles.matchGrid}>
            {matchingCards.map((card) => {
              const active = matchingSelected?.id === card.id;
              const matched = matchingMatchedIds.includes(card.id);
              const isSign = card.type === 'sign';
              const displayValue = isSign ? card.value : card.value.toLocaleUpperCase('es');
              return (
                <Pressable
                  key={card.id}
                  style={[
                    cardStyle,
                    active && styles.matchCardActive,
                    matched && styles.matchCardDone,
                  ]}
                  // Mantener presionada una casilla de SEÑA da su pista.
                  onLongPress={() => {
                    if (isSign) revealHint(null, card.value);
                  }}
                  delayLongPress={400}
                  onPress={() => handleMatchingCard(card)}
                >
                  {isSign ? (
                    <SignImage
                      signKey={card.value}
                      label={displayValue.toLocaleUpperCase('es')}
                      size={isDense ? 54 : 68}
                      rounded={10}
                    />
                  ) : (
                    <Text style={[textStyle, matched && styles.matchTextDone]}>
                      {displayValue}
                    </Text>
                  )}
                  <Text style={[typeStyle, matched && styles.matchTextDone]}>
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
            <Pressable
              onLongPress={() => revealHint(exercise.hint, exercise.sign)}
              delayLongPress={400}
              style={styles.signCardInner}
            >
              <SignImage signKey={exercise.sign} size={140} rounded={18} />
              <Text style={styles.signLabel}>SEÑA mostrada · mantén presionado para la pista</Text>
            </Pressable>
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
          <Text style={styles.exerciseHint}>Ordena las SEÑAS en orden alfabético.</Text>
          <View style={styles.slotRowLarge}>
            {orderingSlots.map((item, index) => (
              <Pressable
                key={`slot-${index}`}
                style={[styles.slotLarge, item && styles.slotLargeFilled]}
                onPress={() => removeOrderingSlot(index)}
              >
                {item ? (
                  <SignImage signKey={displaySign(item)} size={58} rounded={8} />
                ) : (
                  <Text style={styles.slotPlaceholder}>{index + 1}</Text>
                )}
              </Pressable>
            ))}
          </View>
          <View style={styles.poolRowLarge}>
            {orderingPool.map((item, index) => (
              <Pressable
                key={`pool-${item}-${index}`}
                style={styles.poolChipLargeSign}
                onLongPress={() => revealHint(null, item)}
                delayLongPress={400}
                onPress={() => addOrderingLetter(item)}
              >
                <SignImage signKey={displaySign(item)} size={44} rounded={8} />
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
            <Pressable
              onLongPress={() => revealHint(exercise.hint, exercise.sign)}
              delayLongPress={400}
              style={styles.signCardInner}
            >
              <SignImage signKey={exercise.sign} size={140} rounded={18} />
              <Text style={styles.signLabel}>Escribe la letra · mantén presionado para la pista</Text>
            </Pressable>
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
            {exercise.signs.map((sign, idx) => (
              <Pressable
                key={`rec-sign-${idx}`}
                onLongPress={() => revealHint(null, sign)}
                delayLongPress={400}
              >
                <SignImage signKey={sign} size={72} rounded={12} />
              </Pressable>
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
                {exercise.signs.map((sign, idx) => (
                  <Pressable
                    key={`sign-${idx}`}
                    onLongPress={() => revealHint(null, sign)}
                    delayLongPress={400}
                  >
                    <SignImage signKey={sign} size={72} rounded={12} />
                  </Pressable>
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

    if (exercise.type === 'word-meaning') {
      return (
        <View style={styles.exerciseBlock}>
          <Text style={styles.exerciseHint}>Lee las SEÑAS y elige el significado correcto.</Text>
          <SurfaceCard style={styles.signStrip}>
            {exercise.signs.map((sign, idx) => (
              <Pressable
                key={`wm-sign-${idx}`}
                onLongPress={() => revealHint(null, sign)}
                delayLongPress={400}
              >
                <SignImage signKey={sign} size={72} rounded={12} />
              </Pressable>
            ))}
          </SurfaceCard>
          <View style={styles.optionList}>
            {exercise.options.map((option) => (
              <Pressable
                key={option}
                style={[styles.optionBtn, choiceSelected === option && styles.optionBtnActive]}
                onPress={() => setChoiceSelected(option)}
              >
                <Text
                  style={[
                    styles.optionTextWord,
                    choiceSelected === option && styles.optionTextActive,
                  ]}
                >
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      );
    }

    if (exercise.type === 'true-false') {
      return (
        <View style={styles.exerciseBlock}>
          <SurfaceCard style={styles.statementCard}>
            <Text style={styles.statementText}>"{exercise.statement}"</Text>
          </SurfaceCard>
          <View style={styles.tfRow}>
            <Pressable
              style={[
                styles.tfBtn,
                styles.tfBtnTrue,
                choiceSelected === 'true' && styles.tfBtnTrueActive,
              ]}
              onPress={() => setChoiceSelected('true')}
            >
              <Ionicons
                name="checkmark-circle"
                size={28}
                color={choiceSelected === 'true' ? '#FFFFFF' : '#22C55E'}
              />
              <Text
                style={[
                  styles.tfText,
                  choiceSelected === 'true' && styles.tfTextActive,
                ]}
              >
                Verdadero
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.tfBtn,
                styles.tfBtnFalse,
                choiceSelected === 'false' && styles.tfBtnFalseActive,
              ]}
              onPress={() => setChoiceSelected('false')}
            >
              <Ionicons
                name="close-circle"
                size={28}
                color={choiceSelected === 'false' ? '#FFFFFF' : '#EF4444'}
              />
              <Text
                style={[
                  styles.tfText,
                  choiceSelected === 'false' && styles.tfTextActive,
                ]}
              >
                Falso
              </Text>
            </Pressable>
          </View>
        </View>
      );
    }

    return null;
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title={`Nivel ${level.id}`} onBack={onBack} />

      <View style={styles.topMeta}>
        <View>
          <Text style={styles.levelTitle}>{level.title}</Text>
          <Text style={styles.levelSubtitle}>Ejercicio {current + 1} de {level.exercises.length}</Text>
        </View>
        <LifeCounter
          lives={lives}
          livesShake={livesShake}
          lostHeartPulse={lostHeartPulse}
          lostHeartIndex={lostHeartIndex}
          styles={styles}
        />
      </View>

      <View style={styles.progressTrack}>
        <LinearGradient
          colors={theme.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.progressFill, { width: `${progress}%` }]}
        />
      </View>

      <SurfaceCard style={styles.exerciseCard}>
        <Text style={styles.exerciseTitle}>{exercise?.title}</Text>

        {hint ? (
          <Animated.View
            style={[
              styles.hintBox,
              {
                opacity: hintAnim,
                transform: [
                  {
                    translateY: hintAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-6, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.hintHeader}>
              <Ionicons name="bulb" size={16} color="#B45309" />
              {hint.texto ? <Text style={styles.hintBoxText}>{hint.texto}</Text> : null}
            </View>

            {/* Pista por parámetros fonológicos (configuración, ubicación, …) */}
            {hint.parametros?.length ? (
              <View style={styles.hintParams}>
                {hint.parametros.map((p) => (
                  <View key={p.label} style={styles.hintParamRow}>
                    <Ionicons name={p.icon} size={13} color="#B45309" />
                    <Text style={styles.hintParamLabel}>{p.label}:</Text>
                    <Text style={styles.hintParamValue}>{p.valor}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </Animated.View>
        ) : null}

        {!hint && (exercise?.hint || exercise?.sign) ? (
          <Pressable
            style={styles.hintBtn}
            onPress={() => revealHint(exercise.hint, exercise.sign)}
          >
            <Ionicons name="bulb-outline" size={14} color={theme.colors.primary} />
            <Text style={styles.hintBtnText}>Obtener pista</Text>
          </Pressable>
        ) : null}

        {/*
          Solo el contenido del ejercicio (grillas, tiras de señas, etc.)
          scrollea si no alcanza el espacio; el encabezado de arriba y el
          botón de verificar/continuar de abajo quedan siempre fijos y
          visibles, sin necesidad de desplazar la pantalla para llegar a él.
        */}
        <ScrollView
          style={styles.exerciseScroll}
          contentContainerStyle={styles.exerciseScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {renderExercise()}
        </ScrollView>

        <Animated.View
          pointerEvents="none"
          style={[
            styles.wrongFlash,
            {
              opacity: wrongFlash.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.18],
              }),
            },
          ]}
        />
      </SurfaceCard>

      {feedback ? (
        <SurfaceCard style={[styles.feedbackCard, feedback.kind === 'correct' ? styles.feedbackGood : styles.feedbackBad]}>
          <Text style={styles.feedbackTitle}>{feedback.kind === 'correct' ? 'Correcto' : 'Incorrecto'}</Text>
          <Text style={styles.feedbackMessage}>{feedback.message}</Text>
          <ActionButton
            label={feedback.kind === 'correct' ? 'Continuar' : 'Intentar de nuevo'}
            onPress={goNext}
            gradientColors={
              feedback.kind === 'correct'
                ? [theme.colors.success, theme.colors.success]
                : [theme.colors.danger, theme.colors.danger]
            }
          />
        </SurfaceCard>
      ) : (
        <ActionButton label="Verificar" onPress={submitCurrentExercise} />
      )}

      <MessageDialog
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
          setLostHeartIndex(-1);
          setHintsUsed(0);
        }}
        onSecondaryPress={onBack}
        onRequestClose={() => setGameOverVisible(false)}
      />

      <MessageDialog
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
              score: Math.max(0, hits * 100 - fails * 30 + lives * 20 - hintsUsed * 5),
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

function createStyles(theme) {
  const isDark = theme.mode === 'dark';

  return StyleSheet.create({
  screen: {
    flex: 1,
    gap: 8,
  },
  topMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  levelTitle: {
    fontFamily: APP_FONTS.extraBold,
    fontSize: 19,
    fontWeight: '900',
    color: theme.colors.textPrimary,
  },
  levelSubtitle: {
    fontFamily: APP_FONTS.medium,
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  livesRow: {
    flexDirection: 'row',
    gap: 3,
  },
  lifeIcon: {
    color: theme.colors.danger,
    fontSize: 18,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: isDark ? '#3A3350' : '#E2E8F0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  exerciseCard: {
    flex: 1,
    padding: 12,
    gap: 8,
  },
  exerciseScroll: {
    flex: 1,
  },
  exerciseScrollContent: {
    flexGrow: 1,
    paddingBottom: 4,
  },
  exerciseTitle: {
    fontFamily: APP_FONTS.bold,
    fontSize: 15,
    color: theme.colors.textPrimary,
    fontWeight: '800',
  },
  hintText: {
    fontSize: 12,
    color: isDark ? '#F5E7B2' : '#0369A1',
    backgroundColor: isDark ? '#3A2E12' : '#E0F2FE',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  showHintText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  hintBox: {
    flexDirection: 'column',
    gap: 8,
    backgroundColor: isDark ? '#3A2E12' : '#FEF3C7',
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  hintBoxText: {
    flex: 1,
    fontSize: 12,
    color: isDark ? '#F5E7B2' : '#92400E',
    fontWeight: '600',
  },
  hintHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hintParams: {
    gap: 5,
  },
  hintParamRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
  },
  hintParamLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: isDark ? '#FBBF24' : '#B45309',
  },
  hintParamValue: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: isDark ? '#FDE68A' : '#78350F',
  },
  hintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    backgroundColor: isDark ? '#2A2341' : '#F5F3FF',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  hintBtnText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  wrongFlash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#EF4444',
    borderRadius: 18,
  },
  optionTextWord: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  statementCard: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  statementText: {
    fontFamily: APP_FONTS.medium,
    fontSize: 15,
    fontStyle: 'italic',
    color: theme.colors.textPrimary,
    lineHeight: 22,
    textAlign: 'center',
  },
  tfRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  tfBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 2,
    paddingVertical: 13,
    backgroundColor: isDark ? '#221C35' : '#FFFFFF',
  },
  tfBtnTrue: { borderColor: '#22C55E' },
  tfBtnFalse: { borderColor: '#EF4444' },
  tfBtnTrueActive: { backgroundColor: '#22C55E', borderColor: '#22C55E' },
  tfBtnFalseActive: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
  tfText: { fontFamily: APP_FONTS.bold, fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary },
  tfTextActive: { color: '#FFFFFF' },
  exerciseBlock: {
    gap: 8,
  },
  exerciseHint: {
    fontFamily: APP_FONTS.medium,
    color: theme.colors.textSecondary,
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
    borderColor: isDark ? '#4B3B73' : '#CBD5E1',
    backgroundColor: isDark ? '#221C35' : '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    minHeight: 106,
  },
  matchCardActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  matchCardDone: {
    borderColor: isDark ? '#7EDB43' : '#22C55E',
    backgroundColor: isDark ? '#2D5A31' : '#DCFCE7',
  },
  matchText: {
    fontFamily: APP_FONTS.black,
    fontSize: 22,
    fontWeight: '900',
    color: theme.colors.textPrimary,
  },
  matchTextDone: {
    color: isDark ? '#D9F9C6' : '#166534',
  },
  matchType: {
    marginTop: 4,
    fontSize: 10,
    color: theme.colors.textSecondary,
    fontWeight: '700',
  },
  matchCardDense: {
    width: '22%',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: isDark ? '#4B3B73' : '#CBD5E1',
    backgroundColor: isDark ? '#221C35' : '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    minHeight: 86,
    marginBottom: 6,
  },
  matchTextDense: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.colors.textPrimary,
  },
  matchTypeDense: {
    marginTop: 2,
    fontSize: 8,
    color: theme.colors.textSecondary,
    fontWeight: '700',
  },
  signCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  signCardInner: {
    alignItems: 'center',
    gap: 8,
  },
  signLabel: {
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  signStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  optionList: {
    gap: 8,
  },
  optionBtn: {
    borderRadius: 14,
    borderWidth: 2,
    borderColor: isDark ? '#4B3B73' : '#CBD5E1',
    backgroundColor: isDark ? '#221C35' : '#FFFFFF',
    paddingVertical: 12,
    alignItems: 'center',
  },
  optionBtnActive: {
    borderColor: theme.colors.primary,
    backgroundColor: isDark ? '#2A2341' : '#F5F3FF',
  },
  optionText: {
    fontFamily: APP_FONTS.black,
    fontSize: 20,
    fontWeight: '900',
    color: theme.colors.textPrimary,
  },
  optionTextActive: {
    color: theme.colors.primary,
  },
  slotRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slot: {
    minWidth: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: isDark ? '#4B3B73' : '#CBD5E1',
    backgroundColor: isDark ? '#221C35' : '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  slotText: {
    fontFamily: APP_FONTS.extraBold,
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  poolRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  poolChip: {
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: isDark ? '#4B3B73' : '#CBD5E1',
    backgroundColor: isDark ? '#221C35' : '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 40,
    alignItems: 'center',
  },
  poolChipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: isDark ? '#2A2341' : '#F5F3FF',
  },
  poolText: {
    fontFamily: APP_FONTS.extraBold,
    color: theme.colors.textPrimary,
    fontWeight: '800',
    fontSize: 18,
  },
  poolTextActive: {
    color: theme.colors.primary,
  },
  slotRowLarge: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 4,
  },
  slotLarge: {
    width: 72,
    height: 84,
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: isDark ? '#4B3B73' : '#CBD5E1',
    backgroundColor: isDark ? '#221C35' : '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotLargeFilled: {
    borderStyle: 'solid',
    borderColor: theme.colors.primary,
    backgroundColor: isDark ? '#2A2341' : '#F5F3FF',
  },
  slotPlaceholder: {
    fontSize: 22,
    fontWeight: '900',
    color: isDark ? '#5B5275' : '#9CA3AF',
  },
  poolRowLarge: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 6,
  },
  poolChipLargeSign: {
    width: 72,
    height: 84,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: isDark ? '#4B3B73' : '#CBD5E1',
    backgroundColor: isDark ? '#221C35' : '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    fontFamily: APP_FONTS.black,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: isDark ? '#4B3B73' : '#CBD5E1',
    backgroundColor: isDark ? '#221C35' : '#FFFFFF',
    color: theme.colors.textPrimary,
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
    borderColor: isDark ? '#7EDB43' : '#22C55E',
    backgroundColor: isDark ? '#1E3220' : '#F0FDF4',
  },
  feedbackBad: {
    borderColor: theme.colors.danger,
    backgroundColor: isDark ? '#3A1E28' : '#FEF2F2',
  },
  feedbackTitle: {
    fontFamily: APP_FONTS.extraBold,
    fontSize: 16,
    fontWeight: '900',
    color: theme.colors.textPrimary,
  },
  feedbackMessage: {
    fontFamily: APP_FONTS.medium,
    color: theme.colors.textSecondary,
    fontSize: 13,
  },
  });
}
