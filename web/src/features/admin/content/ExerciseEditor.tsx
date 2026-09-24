import { ArrowDown, ArrowUp, Copy, Lightbulb, Trash2 } from 'lucide-react';
import type { ExerciseDraft } from '@/data/types';
import { EXERCISE_TYPES, EXERCISE_TYPE_KEYS, type FieldSpec } from '@/lib/domain';
import { Badge, Button, Card, SelectField, Switch, TextArea, TextField } from '@/ui';

const FIELD_LABELS: Record<string, string> = {
  sign: 'Seña (clave)',
  signs: 'Señas mostradas',
  letters: 'Letras / fichas',
  options: 'Opciones',
  correct: 'Respuesta correcta',
  answer: 'Respuesta',
  word: 'Palabra',
  statement: 'Afirmación',
};

const LIST_HINT = 'Separadas por coma. Ej: a, b, c';

export const toList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

function FieldInput({
  name,
  spec,
  exercise,
  onChange,
}: {
  name: string;
  spec: FieldSpec;
  exercise: ExerciseDraft;
  onChange: (value: unknown) => void;
}) {
  const value = exercise.payload[name];
  const label = `${FIELD_LABELS[name] || name}${spec.required ? ' *' : ''}`;

  switch (spec.type) {
    case 'boolean':
      return <Switch label={label} description="Activo = la afirmación es verdadera" checked={Boolean(value)} onChange={onChange} />;
    case 'signs':
    case 'letters':
    case 'options':
      return (
        <TextField
          label={label}
          hint={LIST_HINT}
          value={Array.isArray(value) ? value.join(', ') : ''}
          onChange={(event) => onChange(toList(event.target.value))}
        />
      );
    case 'choice': {
      const options = (exercise.payload[spec.of || 'options'] as string[]) || [];
      return (
        <SelectField
          label={label}
          value={(value as string) || ''}
          onChange={(event) => onChange(event.target.value)}
          options={[{ value: '', label: 'Elige una opción…' }, ...options.map((option) => ({ value: option, label: option }))]}
        />
      );
    }
    case 'subset': {
      const options = (exercise.payload[spec.of || 'options'] as string[]) || [];
      const selected = (value as string[]) || [];
      return (
        <fieldset className="field" style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend className="field__label">{label}</legend>
          <div className="chip-input">
            {options.length === 0 ? <span className="field__hint">Primero define las opciones.</span> : null}
            {options.map((option) => (
              <label key={option} className="badge" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={selected.includes(option)}
                  onChange={(event) => onChange(event.target.checked ? [...selected, option] : selected.filter((item) => item !== option))}
                />
                {option}
              </label>
            ))}
          </div>
        </fieldset>
      );
    }
    default:
      return <TextField label={label} value={(value as string) || ''} onChange={(event) => onChange(event.target.value)} />;
  }
}

type Props = {
  exercise: ExerciseDraft;
  index: number;
  total: number;
  error: string | null;
  onChange: (next: ExerciseDraft) => void;
  onMove: (direction: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
};

/**
 * Formulario dinámico de un ejercicio: los campos salen de EXERCISE_TYPES
 * (el mismo catálogo que usa la app), así un tipo nuevo aparece aquí sin
 * tocar el panel. El error se calcula con la ExerciseFactory compartida.
 */
export function ExerciseEditor({ exercise, index, total, error, onChange, onMove, onDuplicate, onRemove }: Props) {
  const definition = EXERCISE_TYPES[exercise.type];

  const changeType = (type: string) => {
    // Conserva solo los campos que el tipo nuevo entiende.
    const fields = Object.keys(EXERCISE_TYPES[type]?.fields || {});
    const payload = Object.fromEntries(Object.entries(exercise.payload).filter(([key]) => fields.includes(key)));
    onChange({ ...exercise, type, payload });
  };

  return (
    <Card className="exercise-card stack" data-invalid={Boolean(error)} aria-label={`Ejercicio ${index + 1}`}>
      <div className="row-between">
        <div className="row" style={{ gap: 8 }}>
          <Badge tone="neutral">#{index + 1}</Badge>
          <strong>{definition?.label || exercise.type}</strong>
          {error ? <Badge tone="danger">Revisar</Badge> : <Badge tone="success">Válido</Badge>}
        </div>
        <div className="row" style={{ gap: 2 }}>
          <Button variant="ghost" size="sm" icon={ArrowUp} aria-label="Subir" disabled={index === 0} onClick={() => onMove(-1)} />
          <Button variant="ghost" size="sm" icon={ArrowDown} aria-label="Bajar" disabled={index === total - 1} onClick={() => onMove(1)} />
          <Button variant="ghost" size="sm" icon={Copy} aria-label="Duplicar" onClick={onDuplicate} />
          <Button variant="ghost" size="sm" icon={Trash2} aria-label="Eliminar ejercicio" onClick={onRemove} />
        </div>
      </div>

      <div className="grid-2">
        <SelectField
          label="Tipo"
          value={exercise.type}
          onChange={(event) => changeType(event.target.value)}
          options={EXERCISE_TYPE_KEYS.map((key) => ({ value: key, label: EXERCISE_TYPES[key].label }))}
        />
        <TextField
          label="Título (instrucción)"
          value={exercise.title}
          placeholder={definition?.label}
          onChange={(event) => onChange({ ...exercise, title: event.target.value })}
        />
        {Object.entries(definition?.fields || {}).map(([name, spec]) => (
          <FieldInput
            key={name}
            name={name}
            spec={spec}
            exercise={exercise}
            onChange={(value) => onChange({ ...exercise, payload: { ...exercise.payload, [name]: value } })}
          />
        ))}
      </div>

      <TextArea
        label="Pista (opcional)"
        hint="Se muestra en la ampolleta flotante. Describe la forma de la mano, no la respuesta."
        value={exercise.hint}
        onChange={(event) => onChange({ ...exercise, hint: event.target.value })}
        rows={2}
      />
      {exercise.hint ? (
        <div className="row text-small text-secondary" style={{ gap: 6 }}>
          <Lightbulb size={14} aria-hidden /> Vista previa de la pista: «{exercise.hint}»
        </div>
      ) : null}
      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
