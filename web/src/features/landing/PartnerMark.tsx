import { CLUB_SORDOS_TALCA } from '@/lib/collaborators';

/**
 * Línea vertical y logo del Club de Sordos de Talca, al lado de la marca de
 * SeñaPlay (barra superior y pie). Lleva a la sección de colaboradores.
 */
export function PartnerMark({ size = 40, tone = 'surface' }: Readonly<{ size?: number; tone?: 'surface' | 'header' }>) {
  return (
    <>
      <span className={`brand-divider brand-divider--${tone}`} aria-hidden />
      <a
        className="partner-mark"
        href="#colaboradores"
        aria-label={`${CLUB_SORDOS_TALCA.name}, colaborador de SeñaPlay`}
        title={CLUB_SORDOS_TALCA.name}
      >
        <img src={CLUB_SORDOS_TALCA.logo} alt="" width={size} height={size} />
      </a>
    </>
  );
}
