import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { useRepositories } from '@/data/RepositoriesProvider';
import { LANDING_LIMITS, MAX_PHOTO_BYTES } from '@/data/repositories';
import type { FooterLink, PhoneScreen, SignSlide } from '@/data/types';
import { builtinLetter, builtinSignSlide, SIGN_LETTERS, signImageUrl } from '@/lib/signs';
import { Button, Card, SelectField, TextField, useFeedback } from '@/ui';

type Errors = Record<string, string>;

function moveItem<T>(items: T[], index: number, delta: number): T[] {
  const next = [...items];
  [next[index], next[index + delta]] = [next[index + delta], next[index]];
  return next;
}

/** Botón que sube una imagen al bucket y entrega su URL y ruta. */
function ImageUploadButton({
  label,
  disabled,
  onUploaded,
  ariaLabel,
}: {
  label: string;
  disabled?: boolean;
  onUploaded: (image: { url: string; path: string }) => void;
  ariaLabel?: string;
}) {
  const { site } = useRepositories();
  const { runBlocking, notify } = useFeedback();
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      notify({ tone: 'warning', message: 'Elige una imagen PNG, JPG o WebP.' });
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      notify({ tone: 'warning', message: 'La imagen supera el máximo de 5 MB.' });
      return;
    }
    try {
      onUploaded(await runBlocking('Subiendo imagen…', () => site.uploadLandingImage(file)));
    } catch (error) {
      notify({ tone: 'danger', title: 'No se pudo subir', message: (error as Error).message });
    }
  };

  return (
    <>
      <Button variant="secondary" size="sm" icon={ImagePlus} disabled={disabled} aria-label={ariaLabel} onClick={() => inputRef.current?.click()}>
        {label}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        aria-label={ariaLabel || label}
        onChange={(event) => {
          upload(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
    </>
  );
}

/** Botones de orden y borrado de un elemento de lista. */
function RowActions({ name, index, total, onMove, onRemove, canRemove = true }: { name: string; index: number; total: number; onMove: (delta: number) => void; onRemove: () => void; canRemove?: boolean }) {
  return (
    <div className="row" style={{ gap: 2 }}>
      <Button variant="ghost" size="sm" icon={ArrowUp} aria-label={`Subir ${name}`} disabled={index === 0} onClick={() => onMove(-1)} />
      <Button variant="ghost" size="sm" icon={ArrowDown} aria-label={`Bajar ${name}`} disabled={index === total - 1} onClick={() => onMove(1)} />
      <Button variant="ghost" size="sm" icon={Trash2} className="btn--ghost-danger" aria-label={`Quitar ${name}`} disabled={!canRemove} onClick={onRemove} />
    </div>
  );
}

const LETTER_OPTIONS = SIGN_LETTERS.map((letter) => ({ value: letter, label: `Letra ${letter} (abecedario)` }));

/**
 * Las tres tarjetas de señas del hero. Cada tarjeta es un carrusel: sus
 * señas pueden ser letras del abecedario incluido o imágenes propias.
 */
export function SignDecksEditor({ decks, errors, onChange }: { decks: SignSlide[][]; errors: Errors; onChange: (decks: SignSlide[][]) => void }) {
  const updateDeck = (deckIndex: number, slides: SignSlide[]) => onChange(decks.map((deck, i) => (i === deckIndex ? slides : deck)));

  return (
    <div className="deck-grid">
      {decks.map((slides, deckIndex) => {
        const update = (slideIndex: number, patch: Partial<SignSlide>) => updateDeck(deckIndex, slides.map((slide, i) => (i === slideIndex ? { ...slide, ...patch } : slide)));
        // Propone la primera letra que la tarjeta aún no usa.
        const nextLetter = SIGN_LETTERS.find((letter) => !slides.some((slide) => slide.image_url === signImageUrl(letter))) || 'A';
        return (
          <Card key={deckIndex} className="item-editor stack-sm">
            <strong>Tarjeta {deckIndex + 1}</strong>
            <span className="text-small text-secondary">{slides.length === 1 ? '1 seña (no rota)' : `${slides.length} señas en rotación`}</span>
            {slides.map((slide, slideIndex) => {
              const letter = builtinLetter(slide.image_url);
              const name = `seña ${slideIndex + 1} de la tarjeta ${deckIndex + 1}`;
              const sourceOptions = letter ? LETTER_OPTIONS : [{ value: 'custom', label: 'Imagen subida' }, ...LETTER_OPTIONS];
              return (
                <div key={slideIndex} className="slide-editor">
                  <div className="row-between">
                    <span className="text-small" style={{ fontWeight: 700 }}>
                      Seña {slideIndex + 1}
                    </span>
                    <RowActions
                      name={name}
                      index={slideIndex}
                      total={slides.length}
                      canRemove={slides.length > 1}
                      onMove={(delta) => updateDeck(deckIndex, moveItem(slides, slideIndex, delta))}
                      onRemove={() => updateDeck(deckIndex, slides.filter((_, i) => i !== slideIndex))}
                    />
                  </div>
                  <div className="slide-editor__body">
                    <img className="slide-editor__thumb" src={slide.image_url} alt="" />
                    <div className="stack-sm" style={{ flex: 1, minWidth: 0 }}>
                      <SelectField
                        label="Imagen"
                        aria-label={`Imagen de la ${name}`}
                        options={sourceOptions}
                        value={letter || 'custom'}
                        onChange={(event) => {
                          const value = event.target.value;
                          if (value === 'custom') return;
                          // Si la etiqueta era la letra anterior (o estaba vacía), se actualiza junto con la imagen.
                          const label = !slide.label.trim() || slide.label === letter ? value : slide.label;
                          update(slideIndex, { ...builtinSignSlide(value), label });
                        }}
                      />
                      <TextField
                        label="Texto bajo la seña *"
                        value={slide.label}
                        error={errors[`signDecks.${deckIndex}.${slideIndex}`]}
                        onChange={(event) => update(slideIndex, { label: event.target.value })}
                      />
                      <div>
                        <ImageUploadButton
                          label="Subir imagen propia"
                          ariaLabel={`Subir imagen propia para la ${name}`}
                          onUploaded={({ url, path }) => update(slideIndex, { image_url: url, image_path: path })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div>
              <Button
                variant="secondary"
                size="sm"
                icon={Plus}
                disabled={slides.length >= LANDING_LIMITS.slidesPerDeck}
                onClick={() => updateDeck(deckIndex, [...slides, builtinSignSlide(nextLetter)])}
              >
                {slides.length >= LANDING_LIMITS.slidesPerDeck ? `Máximo ${LANDING_LIMITS.slidesPerDeck} señas` : 'Agregar seña'}
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/** Capturas de la app para el teléfono de la landing. */
export function ScreensEditor({ screens, onChange }: { screens: PhoneScreen[]; onChange: (screens: PhoneScreen[]) => void }) {
  const update = (index: number, patch: Partial<PhoneScreen>) => onChange(screens.map((screen, i) => (i === index ? { ...screen, ...patch } : screen)));
  const full = screens.length >= LANDING_LIMITS.screens;

  return (
    <div className="stack-sm">
      {screens.length ? (
        <div className="screen-grid">
          {screens.map((screen, index) => {
            const name = `captura ${index + 1}`;
            return (
              <Card key={`${screen.image_url}-${index}`} className="item-editor stack-sm">
                <img className="screen-editor__thumb" src={screen.image_url} alt={`Vista previa de la ${name}`} />
                <TextField
                  label="Descripción"
                  hint="Se muestra como paso junto al teléfono y como texto alternativo."
                  value={screen.caption}
                  onChange={(event) => update(index, { caption: event.target.value })}
                />
                <div className="row-between">
                  <ImageUploadButton
                    label="Cambiar"
                    ariaLabel={`Cambiar la imagen de la ${name}`}
                    onUploaded={({ url, path }) => update(index, { image_url: url, image_path: path })}
                  />
                  <RowActions
                    name={name}
                    index={index}
                    total={screens.length}
                    onMove={(delta) => onChange(moveItem(screens, index, delta))}
                    onRemove={() => onChange(screens.filter((_, i) => i !== index))}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <p className="text-small text-muted">Sin capturas: la sección no se muestra en la landing hasta que subas al menos una.</p>
      )}
      <div>
        <ImageUploadButton
          label={full ? `Máximo ${LANDING_LIMITS.screens} capturas` : 'Agregar captura'}
          disabled={full}
          onUploaded={({ url, path }) => onChange([...screens, { image_url: url, image_path: path, caption: '' }])}
        />
      </div>
      <span className="text-small text-secondary">Usa capturas verticales del teléfono (proporción 9:19,5, por ejemplo 1080 × 2340).</span>
    </div>
  );
}

/** Enlaces propios del pie de página (texto + dirección). */
export function LinksEditor({ links, errors, onChange }: { links: FooterLink[]; errors: Errors; onChange: (links: FooterLink[]) => void }) {
  const update = (index: number, patch: Partial<FooterLink>) => onChange(links.map((link, i) => (i === index ? { ...link, ...patch } : link)));
  return (
    <div className="stack-sm">
      {links.map((link, index) => {
        const name = link.label.trim() || `enlace ${index + 1}`;
        return (
          <Card key={index} className="item-editor stack-sm">
            <div className="row-between">
              <strong>{name}</strong>
              <RowActions name={name} index={index} total={links.length} onMove={(delta) => onChange(moveItem(links, index, delta))} onRemove={() => onChange(links.filter((_, i) => i !== index))} />
            </div>
            <div className="grid-2">
              <TextField label="Texto *" value={link.label} error={errors[`links.${index}.label`]} onChange={(event) => update(index, { label: event.target.value })} />
              <TextField
                label="Dirección *"
                placeholder="https://… o #seccion"
                value={link.url}
                error={errors[`links.${index}.url`]}
                onChange={(event) => update(index, { url: event.target.value })}
              />
            </div>
          </Card>
        );
      })}
      <div>
        <Button variant="secondary" size="sm" icon={Plus} disabled={links.length >= LANDING_LIMITS.footerLinks} onClick={() => onChange([...links, { label: '', url: '' }])}>
          {links.length >= LANDING_LIMITS.footerLinks ? `Máximo ${LANDING_LIMITS.footerLinks} enlaces` : 'Agregar enlace'}
        </Button>
      </div>
    </div>
  );
}
