import { ExternalLink, Mail, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { LandingSections } from '@/data/types';
import { brandIcon } from '@/lib/brand';
import { SOCIAL_NETWORKS, SocialIcon, safeLinkHref, socialHref } from '@/lib/social';

type NavLink = { href: string; label: string };

/**
 * Pie de página de la landing (editable en Secciones → Pie de página): marca
 * y frase, redes, navegación por secciones, enlaces propios y contacto. Las
 * columnas sin contenido no se muestran.
 */
export function SiteFooter({ config, navLinks }: { config: LandingSections['footer'] | undefined; navLinks: NavLink[] }) {
  const year = new Date().getFullYear();
  const socials = (config?.socials || []).map((link) => ({ ...link, href: socialHref(link) })).filter((link) => link.href);
  const links = (config?.links || []).map((link) => ({ ...link, href: safeLinkHref(link.url) })).filter((link) => link.href);
  const email = config?.email ? socialHref({ network: 'email', url: config.email }) : null;

  return (
    <footer className="site-footer">
      <div className="site-footer__top">
        <div className="site-footer__brand">
          <Link to="/" className="brand-link site-footer__logo" aria-label="SeñaPlay, inicio">
            {/* El pie siempre es oscuro: se usa el ícono del tema oscuro. */}
            <img src={brandIcon('dark')} alt="" width={40} height={40} />
            <span>SeñaPlay</span>
          </Link>
          {config?.text ? <p className="site-footer__tagline">{config.text}</p> : null}
          {socials.length ? (
            <ul className="site-footer__socials" aria-label="Redes de SeñaPlay">
              {socials.map((link, index) => {
                const external = link.network !== 'email';
                return (
                  <li key={`${link.network}-${index}`}>
                    <a
                      className={`social-link social-link--${link.animation}`}
                      href={link.href as string}
                      target={external ? '_blank' : undefined}
                      rel={external ? 'noopener noreferrer' : undefined}
                      aria-label={`${SOCIAL_NETWORKS[link.network].label} de SeñaPlay${external ? ' (se abre en otra pestaña)' : ''}`}
                      title={SOCIAL_NETWORKS[link.network].label}
                    >
                      <SocialIcon network={link.network} />
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        {navLinks.length ? (
          <nav className="site-footer__column" aria-label="Secciones de la página">
            <h2 className="site-footer__heading">Explorar</h2>
            <ul>
              {navLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href}>{link.label}</a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        {links.length ? (
          <nav className="site-footer__column" aria-label="Enlaces">
            <h2 className="site-footer__heading">Enlaces</h2>
            <ul>
              {links.map((link, index) => {
                const external = /^https?:/i.test(link.href as string);
                return (
                  <li key={`${link.url}-${index}`}>
                    <a href={link.href as string} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}>
                      {link.label}
                      {external ? <ExternalLink size={13} aria-label="(se abre en otra pestaña)" /> : null}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
        ) : null}

        {email || config?.location ? (
          <div className="site-footer__column">
            <h2 className="site-footer__heading">Contacto</h2>
            <ul>
              {email ? (
                <li>
                  <a href={email}>
                    <Mail size={15} aria-hidden /> {config?.email}
                  </a>
                </li>
              ) : null}
              {config?.location ? (
                <li className="site-footer__muted">
                  <MapPin size={15} aria-hidden /> {config.location}
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="site-footer__bottom">
        <span>© {year} SeñaPlay. Todos los derechos reservados.</span>
        {config?.note ? <span>{config.note}</span> : null}
      </div>
    </footer>
  );
}
