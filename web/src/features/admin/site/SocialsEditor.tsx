import { Plus, Trash2 } from 'lucide-react';
import { useId } from 'react';
import type { SocialLink, SocialNetworkKey } from '@/data/types';
import { useListKeys } from '@/lib/listKeys';
import { MAX_SOCIALS, SOCIAL_ANIMATION_KEYS, SOCIAL_ANIMATIONS, SOCIAL_NETWORK_KEYS, SOCIAL_NETWORKS, SocialIcon } from '@/lib/social';
import { Button, SelectField, TextField } from '@/ui';

/** Una red: ícono, enlace y animación, con vista previa en vivo. */
function SocialRow({
  link,
  index,
  error,
  onChange,
  onRemove,
}: Readonly<{
  link: SocialLink;
  index: number;
  error?: string;
  onChange: (next: SocialLink) => void;
  onRemove: () => void;
}>) {
  const groupName = useId();
  const network = SOCIAL_NETWORKS[link.network];
  return (
    <div className="social-row">
      <div className="social-row__head">
        {/* La vista previa se vuelve a montar al cambiar ícono o animación,
            así la animación elegida se reproduce de inmediato. */}
        <span
          key={`${link.network}-${link.animation}`}
          className={`social-link social-link--${link.animation} social-link--play`}
          title="Vista previa: pasa el mouse para repetir la animación"
          aria-hidden
        >
          <SocialIcon network={link.network} />
        </span>
        <strong className="social-row__title">
          Red {index + 1}: {network.label}
        </strong>
        <Button variant="ghost" size="sm" icon={Trash2} className="btn--ghost-danger" aria-label={`Quitar ${network.label}`} onClick={onRemove} />
      </div>
      <fieldset className="icon-picker">
        <legend className="field__label">Ícono</legend>
        {SOCIAL_NETWORK_KEYS.map((key) => (
          <label key={key} className="icon-picker__option" title={SOCIAL_NETWORKS[key].label}>
            <input
              type="radio"
              name={groupName}
              value={key}
              aria-label={SOCIAL_NETWORKS[key].label}
              checked={link.network === key}
              onChange={() => onChange({ ...link, network: key })}
            />
            <span className="icon-picker__swatch" aria-hidden>
              <SocialIcon network={key} size={18} />
            </span>
          </label>
        ))}
      </fieldset>
      <div className="grid-2">
        <TextField
          label={link.network === 'email' ? 'Correo *' : 'Enlace *'}
          type={link.network === 'email' ? 'email' : 'url'}
          inputMode={link.network === 'email' ? 'email' : 'url'}
          placeholder={network.placeholder}
          value={link.url}
          error={error}
          onChange={(e) => onChange({ ...link, url: e.target.value })}
        />
        <SelectField
          label="Animación al pasar el mouse"
          value={link.animation}
          options={SOCIAL_ANIMATION_KEYS.map((key) => ({ value: key, label: SOCIAL_ANIMATIONS[key] }))}
          onChange={(e) => onChange({ ...link, animation: e.target.value as SocialLink['animation'] })}
        />
      </div>
    </div>
  );
}

/** Lista editable de redes sociales (máximo MAX_SOCIALS). Los errores van con clave `social-<índice>`. */
export function SocialsEditor({
  value,
  errors,
  onChange,
  description,
}: Readonly<{
  value: SocialLink[];
  errors: Record<string, string>;
  onChange: (next: SocialLink[]) => void;
  description: string;
}>) {
  const titleId = useId();
  const rows = useListKeys(value.length);
  const add = () => {
    // Propone la primera red que aún no usa, para no duplicar por descuido.
    const used = new Set(value.map((link) => link.network));
    const network: SocialNetworkKey = SOCIAL_NETWORK_KEYS.find((key) => !used.has(key)) || 'website';
    rows.add();
    onChange([...value, { network, url: '', animation: 'pop' }]);
  };
  return (
    <section className="stack-sm" aria-labelledby={titleId}>
      <div className="row-between">
        <div className="stack-sm" style={{ gap: 0 }}>
          <h3 id={titleId} style={{ fontSize: 16 }}>
            Redes sociales
          </h3>
          <span className="text-small text-secondary">{description}</span>
        </div>
        <Button variant="secondary" size="sm" icon={Plus} disabled={value.length >= MAX_SOCIALS} onClick={add}>
          Agregar red
        </Button>
      </div>
      {value.length ? (
        value.map((link, index) => (
          <SocialRow
            key={rows.keys[index]}
            link={link}
            index={index}
            error={errors[`social-${index}`]}
            onChange={(next) => onChange(value.map((item, i) => (i === index ? next : item)))}
            onRemove={() => {
              rows.remove(index);
              onChange(value.filter((_, i) => i !== index));
            }}
          />
        ))
      ) : (
        <p className="text-small text-muted">Sin redes. Son opcionales.</p>
      )}
    </section>
  );
}
