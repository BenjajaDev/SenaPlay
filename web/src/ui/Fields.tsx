import { AlertCircle } from 'lucide-react';
import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

type FieldShellProps = { label?: string; hint?: string; error?: string | null; id: string; children: ReactNode };

function FieldShell({ label, hint, error, id, children }: FieldShellProps) {
  return (
    <div className="field">
      {label ? (
        <label className="field__label" htmlFor={id}>
          {label}
        </label>
      ) : null}
      {children}
      {error ? (
        <span className="field__error" id={`${id}-error`} role="alert">
          <AlertCircle size={14} aria-hidden /> {error}
        </span>
      ) : hint ? (
        <span className="field__hint" id={`${id}-hint`}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

type Common = { label?: string; hint?: string; error?: string | null };

export function TextField({ label, hint, error, id, ...rest }: Common & InputHTMLAttributes<HTMLInputElement>) {
  const autoId = useId();
  const fieldId = id || autoId;
  return (
    <FieldShell label={label} hint={hint} error={error} id={fieldId}>
      <input
        id={fieldId}
        className="input"
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        {...rest}
      />
    </FieldShell>
  );
}

export function TextArea({ label, hint, error, id, ...rest }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const autoId = useId();
  const fieldId = id || autoId;
  return (
    <FieldShell label={label} hint={hint} error={error} id={fieldId}>
      <textarea
        id={fieldId}
        className="textarea"
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        {...rest}
      />
    </FieldShell>
  );
}

export function SelectField({
  label,
  hint,
  error,
  id,
  options,
  ...rest
}: Common & SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] }) {
  const autoId = useId();
  const fieldId = id || autoId;
  return (
    <FieldShell label={label} hint={hint} error={error} id={fieldId}>
      <select id={fieldId} className="select" aria-invalid={Boolean(error) || undefined} {...rest}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function Switch({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span className="switch__track" aria-hidden />
      <span className="stack-sm" style={{ gap: 0 }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        {description ? <span className="text-secondary text-small">{description}</span> : null}
      </span>
    </label>
  );
}
