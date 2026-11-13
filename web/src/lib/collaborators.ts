// Organizaciones que colaboran con SeñaPlay. El logo del club se extrajo de
// sus propios videos educativos (public/brand/club-sordos-talca.webp); si el
// club entrega su archivo oficial, basta con reemplazar esa imagen.
export type Collaborator = {
  id: string;
  name: string;
  motto: string;
  logo: string;
  contribution: string;
};

export const CLUB_SORDOS_TALCA: Collaborator = {
  id: 'club-sordos-talca',
  name: 'Club de Sordos de Talca',
  motto: 'Difundiendo la LSCh',
  logo: '/brand/club-sordos-talca.webp',
  contribution: 'Las señas en video de los niveles las hacen integrantes del club, en Lengua de Señas Chilena.',
};

export const COLLABORATORS: readonly Collaborator[] = [CLUB_SORDOS_TALCA];
