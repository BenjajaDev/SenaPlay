import {
  Accessibility,
  BookOpen,
  Camera,
  Gamepad2,
  Hand,
  Layers,
  LayoutDashboard,
  Moon,
  Smartphone,
  Sparkles,
  Sun,
  Users,
  Vibrate,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRepositories } from '@/data/RepositoriesProvider';
import type { PublicStats } from '@/data/types';
import { env } from '@/lib/env';
import { useThemeMode } from '@/lib/useThemeMode';
import { Button, Card, Skeleton } from '@/ui';

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Layers, title: 'Niveles progresivos', text: 'Del alfabeto dactilológico a vocabulario real, con desbloqueo por logros.' },
  { icon: Camera, title: 'Práctica con IA', text: 'La cámara reconoce tu mano y te corrige la seña en tiempo real.' },
  { icon: BookOpen, title: 'Diccionario LSCh', text: 'Señas con fotos, parámetros y referencias al diccionario del MINEDUC.' },
  { icon: Gamepad2, title: 'Juegos', text: 'Memoria, quiz contrarreloj y deletreo para reforzar lo aprendido.' },
  { icon: Video, title: 'Videos con subtítulos', text: 'Contenido audiovisual accesible para personas oyentes y no oyentes.' },
  { icon: Sparkles, title: 'Motivación diaria', text: 'Rachas, estrellas y celebraciones que hacen del hábito un juego.' },
];

const A11Y: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Vibrate, title: 'Feedback multimodal', text: 'Cada acierto o error combina color, icono, texto y vibración: nunca depende del audio.' },
  { icon: Accessibility, title: 'WCAG 2.1 AA', text: 'Contraste verificado automáticamente, lector de pantalla y tamaño táctil mínimo de 44px.' },
  { icon: Hand, title: 'Hecha para la comunidad Sorda', text: 'La seña es la protagonista: grande, clara y bajo tu control, sin nada que se mueva solo.' },
];

// value: undefined = cargando (skeleton), null = no disponible (guion).
function Metric({ value, label }: { value: number | null | undefined; label: string }) {
  return (
    <div className="metric">
      <div className="metric__value">
        {value === undefined ? <Skeleton width={64} height={34} /> : value === null ? '–' : value.toLocaleString('es-CL')}
      </div>
      <div className="metric__label">{label}</div>
    </div>
  );
}

/** Landing pública: presenta SeñaPlay, sus características, métricas reales y descargas. */
export function LandingPage() {
  const { stats } = useRepositories();
  const { mode, toggle } = useThemeMode();
  const [data, setData] = useState<PublicStats | null | undefined>(undefined);

  useEffect(() => {
    stats.publicStats().then(setData);
  }, [stats]);

  // Si las métricas fallan (null), cada cifra muestra un guion en vez de un skeleton eterno.
  const pick = (read: (stats: PublicStats) => number) => (data === undefined ? undefined : data === null ? null : read(data));

  return (
    <>
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <header className="landing-nav">
        <Link to="/" className="brand-link" aria-label="SeñaPlay, inicio">
          <img src="/logo.png" alt="" width={40} height={40} />
          <span>SeñaPlay</span>
        </Link>
        <nav aria-label="Principal" className="landing-nav__links">
          <a href="#caracteristicas">Características</a>
          <a href="#accesibilidad">Accesibilidad</a>
          <a href="#descargar">Descargar</a>
        </nav>
        <div className="row" style={{ gap: 8 }}>
          <Button variant="ghost" icon={mode === 'dark' ? Sun : Moon} onClick={toggle} aria-label={mode === 'dark' ? 'Usar tema claro' : 'Usar tema oscuro'} />
          <Link to="/admin" className="btn btn--secondary btn--sm">
            <LayoutDashboard size={16} aria-hidden /> Panel
          </Link>
        </div>
      </header>

      <main id="contenido">
        <section className="hero">
          <div className="hero__content stagger">
            <span className="badge" style={{ background: 'color-mix(in srgb, white 18%, transparent)', color: 'var(--color-on-header)' }}>
              Lengua de Señas Chilena
            </span>
            <h1>Aprende a comunicarte en señas, jugando.</h1>
            <p>
              SeñaPlay combina niveles cortos, juegos y una cámara con inteligencia artificial para que practiques LSCh todos los
              días, a tu ritmo.
            </p>
            <div className="row">
              <a className="btn btn--lg hero__cta" href={env.androidUrl || '#descargar'}>
                <Smartphone size={20} aria-hidden /> Descargar para Android
              </a>
              <a className="btn btn--lg btn--ghost hero__ghost" href="#caracteristicas">
                Conocer más
              </a>
            </div>
          </div>
          <div className="hero__visual" aria-hidden>
            {['A', 'B', 'C'].map((letter, index) => (
              <figure key={letter} className="sign-card" style={{ ['--i' as string]: index }}>
                <img src={`/signs/${letter}.png`} alt="" loading="lazy" />
                <figcaption>{letter}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="metrics" aria-label="SeñaPlay en números">
          <Metric value={pick((s) => s.levels)} label="Niveles" />
          <Metric value={pick((s) => s.exercises)} label="Ejercicios" />
          <Metric value={pick((s) => s.dictionary + s.vocabulary)} label="Señas en el diccionario" />
          <Metric value={pick((s) => s.learners)} label="Estudiantes" />
        </section>
        {data === null ? <p className="text-muted text-small" style={{ textAlign: 'center' }}>Métricas no disponibles por ahora.</p> : null}

        <section id="caracteristicas" className="section">
          <h2 className="section__title">Todo lo que necesitas para aprender LSCh</h2>
          <div className="features-grid stagger">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <Card key={title} variant="raised" className="feature">
                <span className="feature__icon">
                  <Icon size={24} aria-hidden />
                </span>
                <h3>{title}</h3>
                <p className="text-secondary">{text}</p>
              </Card>
            ))}
          </div>
        </section>

        <section id="accesibilidad" className="section section--tinted">
          <h2 className="section__title">Accesible para personas oyentes y no oyentes</h2>
          <div className="grid-3">
            {A11Y.map(({ icon: Icon, title, text }) => (
              <div key={title} className="a11y-item">
                <Icon size={28} aria-hidden color="var(--color-primary)" />
                <h3>{title}</h3>
                <p className="text-secondary">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="descargar" className="section">
          <Card variant="brand" className="download">
            <div className="stack-sm">
              <h2>Empieza hoy, es gratis</h2>
              <p style={{ opacity: 0.92 }}>Disponible para Android. Crea tu cuenta y completa tu primer nivel en 5 minutos.</p>
            </div>
            <div className="row">
              {env.androidUrl ? (
                <a className="btn btn--lg download__btn" href={env.androidUrl}>
                  <Smartphone size={20} aria-hidden /> Google Play
                </a>
              ) : (
                <span className="badge" style={{ background: 'color-mix(in srgb, white 20%, transparent)', color: 'var(--color-on-header)' }}>
                  Próximamente en tiendas
                </span>
              )}
              {env.iosUrl ? (
                <a className="btn btn--lg download__btn" href={env.iosUrl}>
                  <Smartphone size={20} aria-hidden /> App Store
                </a>
              ) : null}
            </div>
          </Card>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="row" style={{ gap: 8 }}>
          <Users size={16} aria-hidden /> Hecho con la comunidad Sorda de Chile
        </div>
        <span>© {new Date().getFullYear()} SeñaPlay</span>
      </footer>
    </>
  );
}
