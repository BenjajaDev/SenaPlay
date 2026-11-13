import { useState } from 'react';
import { evaluateMatchingPair } from '../../domain/evaluateAnswer';

/**
 * Selección de parejas de «emparejar» (letras y palabras comparten la regla):
 * tocar dos cartas de tipos distintos las evalúa; una pareja correcta suma sus
 * ids a la respuesta, y al completar `total` cartas se envía sola. Una
 * incorrecta se informa con `onPairResult` (la sesión descuenta la vida).
 */
export default function usePairSelection({ matched, total, disabled, onAnswerChange, onPairResult }) {
  const [selected, setSelected] = useState(null);

  const handlePress = (card) => {
    if (disabled || matched.includes(card.id)) return;
    if (!selected || selected.type === card.type) {
      setSelected(card);
      return;
    }
    const result = evaluateMatchingPair(selected, card);
    setSelected(null);
    if (!result) return;
    if (result.status === 'correct') {
      const next = [...matched, selected.id, card.id];
      onAnswerChange(next, { autoSubmit: next.length === total });
    } else {
      onPairResult?.(result);
    }
  };

  const stateOf = (card) => (matched.includes(card.id) ? 'matched' : selected?.id === card.id ? 'selected' : 'idle');

  return { handlePress, stateOf };
}
