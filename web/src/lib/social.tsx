import { Globe, Mail } from 'lucide-react';
import type { ReactNode, SVGProps } from 'react';
import type { SocialAnimationKey, SocialLink, SocialNetworkKey } from '@/data/types';

type IconProps = { size?: number } & Omit<SVGProps<SVGSVGElement>, 'ref'>;
type IconComponent = (props: IconProps) => ReactNode;

/**
 * lucide-react 1.x ya no trae logos de marcas: se dibujan aquí con el mismo
 * estilo de trazo (24×24, stroke 2, puntas redondeadas) para que convivan
 * con el resto de los íconos del portal.
 */
function strokeIcon(children: ReactNode): IconComponent {
  return function StrokeIcon({ size = 20, ...rest }: IconProps) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        {...rest}
      >
        {children}
      </svg>
    );
  };
}

const GithubIcon = strokeIcon(
  <>
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </>,
);
const LinkedinIcon = strokeIcon(
  <>
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </>,
);
const InstagramIcon = strokeIcon(
  <>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </>,
);
const FacebookIcon = strokeIcon(<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />);
const XIcon = strokeIcon(
  <>
    <path d="M4 4l11.733 16h4.267l-11.733-16z" />
    <path d="M4 20l6.768-6.768m2.46-2.46L20 4" />
  </>,
);
const YoutubeIcon = strokeIcon(
  <>
    <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
    <path d="m10 15 5-3-5-3z" />
  </>,
);
const TiktokIcon = strokeIcon(
  <path d="M21 7.917v4.034a9.948 9.948 0 0 1-5-1.951v4.5a6.5 6.5 0 1 1-8-6.326v4.326a2.5 2.5 0 1 0 4 2v-11.5h4.083a6.005 6.005 0 0 0 4.917 4.917z" />,
);
const WebsiteIcon: IconComponent = ({ size = 20, ...rest }) => <Globe size={size} aria-hidden {...rest} />;
const EmailIcon: IconComponent = ({ size = 20, ...rest }) => <Mail size={size} aria-hidden {...rest} />;

/** Íconos que el panel ofrece para las redes de cada integrante. */
export const SOCIAL_NETWORKS: Record<SocialNetworkKey, { label: string; icon: IconComponent; placeholder: string }> = {
  linkedin: { label: 'LinkedIn', icon: LinkedinIcon, placeholder: 'https://www.linkedin.com/in/usuario' },
  github: { label: 'GitHub', icon: GithubIcon, placeholder: 'https://github.com/usuario' },
  instagram: { label: 'Instagram', icon: InstagramIcon, placeholder: 'https://www.instagram.com/usuario' },
  facebook: { label: 'Facebook', icon: FacebookIcon, placeholder: 'https://www.facebook.com/usuario' },
  x: { label: 'X (Twitter)', icon: XIcon, placeholder: 'https://x.com/usuario' },
  youtube: { label: 'YouTube', icon: YoutubeIcon, placeholder: 'https://www.youtube.com/@canal' },
  tiktok: { label: 'TikTok', icon: TiktokIcon, placeholder: 'https://www.tiktok.com/@usuario' },
  website: { label: 'Sitio web', icon: WebsiteIcon, placeholder: 'https://misitio.cl' },
  email: { label: 'Correo', icon: EmailIcon, placeholder: 'nombre@correo.cl' },
};

export const SOCIAL_NETWORK_KEYS = Object.keys(SOCIAL_NETWORKS) as SocialNetworkKey[];

/** Animaciones del ícono al pasar el mouse o enfocarlo (ver .social-link--* en pages.css). */
export const SOCIAL_ANIMATIONS: Record<SocialAnimationKey, string> = {
  pop: 'Crecer',
  bounce: 'Rebote',
  wiggle: 'Vaivén',
  spin: 'Giro',
  pulse: 'Latido',
  float: 'Flotar',
};

export const SOCIAL_ANIMATION_KEYS = Object.keys(SOCIAL_ANIMATIONS) as SocialAnimationKey[];

/** Máximo de redes por integrante: la tarjeta de la landing tiene espacio para una fila. */
export const MAX_SOCIALS = 6;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Enlace seguro para una red: solo http(s) y mailto. Cualquier otro esquema
 * (javascript:, data:…) devuelve null para que nunca llegue a un href.
 */
export function socialHref(link: Pick<SocialLink, 'network' | 'url'>): string | null {
  const value = link.url.trim();
  if (!value) return null;
  if (link.network === 'email') {
    const address = value.replace(/^mailto:/i, '');
    return EMAIL_RE.test(address) ? `mailto:${address}` : null;
  }
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

/** Mensaje de validación para el formulario del panel; null si la red es válida. */
export function socialError(link: SocialLink): string | null {
  if (!link.url.trim()) return 'Escribe el enlace o bórralo.';
  if (socialHref(link)) return null;
  return link.network === 'email' ? 'Escribe un correo válido.' : 'Escribe un enlace válido (https://…).';
}

/** Normaliza lo que viene de la base: descarta entradas incompletas o desconocidas. */
export function cleanSocials(value: unknown): SocialLink[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is SocialLink => Boolean(item) && typeof item === 'object' && (item as SocialLink).network in SOCIAL_NETWORKS)
    .map((item) => ({
      network: item.network,
      url: String(item.url || '').trim(),
      animation: item.animation in SOCIAL_ANIMATIONS ? item.animation : 'pop',
    }))
    .filter((item) => item.url)
    .slice(0, MAX_SOCIALS);
}

export function SocialIcon({ network, size = 20 }: { network: SocialNetworkKey; size?: number }) {
  const Icon = (SOCIAL_NETWORKS[network] || SOCIAL_NETWORKS.website).icon;
  return <Icon size={size} />;
}
