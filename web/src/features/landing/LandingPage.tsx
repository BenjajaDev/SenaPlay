import { LayoutDashboard, Moon, Smartphone, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { useRepositories } from '@/data/RepositoriesProvider';
import type { AboutContent, LandingSections, Publication, PublicStats, TeamMember } from '@/data/types';
import { brandIcon } from '@/lib/brand';
import { useThemeMode } from '@/lib/useThemeMode';
import { Button } from '@/ui';
import { AuroraBackground } from './AuroraBackground';
import { landingNavLinks } from './landingNav';
import { MobileNav } from './MobileNav';
import { PartnerMark } from './PartnerMark';
import { PhoneShowcase } from './PhoneShowcase';
import { SiteFooter } from './SiteFooter';
import { AboutSection } from './sections/AboutSection';
import { AccessibilitySection, DownloadSection, HeroLoading, HeroSection, MetricsSection } from './sections/BasicSections';
import { FundingSection } from './sections/FundingSection';
import { PrivacySection } from './sections/PrivacySection';
import { ProblemSection } from './sections/ProblemSection';
import { PublicationsSection } from './sections/PublicationsSection';
import { SolutionSection } from './sections/SolutionSection';
import { TerritorySection } from './sections/TerritorySection';

/**
 * Landing pública. El orden cuenta una historia: por qué (problema), qué
 * (solución y app), dónde y quiénes (territorio, avances, equipo) y con qué
 * respaldo (financiamiento, privacidad). Textos editables desde el panel.
 */
export function LandingPage() {
  const { stats, site, publications } = useRepositories();
  const { mode, toggle } = useThemeMode();
  // El acceso al panel solo se ofrece a quien ya tiene sesión de equipo; el
  // público no lo ve (el equipo entra por /login).
  const { isStaff } = useAuth();
  const [data, setData] = useState<PublicStats | null | undefined>(undefined);
  const [sections, setSections] = useState<LandingSections | undefined>(undefined);
  const [posts, setPosts] = useState<Publication[] | undefined>(undefined);
  const [about, setAbout] = useState<AboutContent | undefined>(undefined);
  const [team, setTeam] = useState<TeamMember[] | undefined>(undefined);

  useEffect(() => {
    let mounted = true;
    stats.publicStats().then((value) => mounted && setData(value));
    return () => {
      mounted = false;
    };
  }, [stats]);

  useEffect(() => {
    let mounted = true;
    site.getSections().then((value) => mounted && setSections(value));
    site.getAbout().then((value) => mounted && setAbout(value));
    site.listPublishedTeam().then((value) => mounted && setTeam(value));
    return () => {
      mounted = false;
    };
  }, [site]);

  useEffect(() => {
    let mounted = true;
    publications.listPublished().then((value) => mounted && setPosts(value));
    return () => {
      mounted = false;
    };
  }, [publications]);

  const showPublications = Boolean(sections?.publications.visible && posts?.length);
  const showShowcase = Boolean(sections?.showcase.visible && sections.showcase.screens.length);
  const navLinks = landingNavLinks(sections, { publications: Boolean(posts?.length), showcase: showShowcase });

  return (
    <>
      <AuroraBackground />
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <header className="landing-nav">
        <div className="brand-lockup">
          <Link to="/" className="brand-link" aria-label="SeñaPlay, inicio">
            <img src={brandIcon(mode)} alt="" width={40} height={40} />
            <span>SeñaPlay</span>
          </Link>
          <PartnerMark />
        </div>
        <nav aria-label="Principal" className="landing-nav__links">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
        <div className="row landing-nav__actions">
          {sections?.download.visible ? (
            <a className="btn btn--sm landing-nav__download" href="#descargar">
              <Smartphone size={16} aria-hidden /> Descargar
            </a>
          ) : null}
          <Button variant="ghost" icon={mode === 'dark' ? Sun : Moon} onClick={toggle} aria-label={mode === 'dark' ? 'Usar tema claro' : 'Usar tema oscuro'} />
          {isStaff ? (
            <Link to="/admin" className="btn btn--secondary btn--sm" aria-label="Panel">
              <LayoutDashboard size={16} aria-hidden /> <span className="landing-nav__panel-label">Panel</span>
            </Link>
          ) : null}
          <MobileNav links={sections?.download.visible ? [...navLinks, { href: '#descargar', label: 'Descargar' }] : navLinks} />
        </div>
      </header>

      <main id="contenido">
        {sections ? <HeroSection hero={sections.hero} moreHref={navLinks[0]?.href || '#nosotros'} /> : <HeroLoading />}
        {sections?.metrics.visible !== false ? <MetricsSection config={sections?.metrics ?? { visible: true, title: '' }} stats={data} /> : null}
        {sections?.problem.visible ? <ProblemSection config={sections.problem} /> : null}
        {sections?.features.visible ? <SolutionSection config={sections.features} /> : null}
        {sections?.accessibility.visible ? <AccessibilitySection config={sections.accessibility} /> : null}
        {sections && showShowcase ? <PhoneShowcase config={sections.showcase} /> : null}
        {sections?.territory.visible ? <TerritorySection config={sections.territory} /> : null}
        {sections && posts && showPublications ? <PublicationsSection config={sections.publications} items={posts} /> : null}
        <AboutSection about={about} team={team} club={sections?.club} />
        {sections?.funding.visible ? <FundingSection config={sections.funding} /> : null}
        {sections?.download.visible ? <DownloadSection config={sections.download} /> : null}
        {sections ? <PrivacySection config={sections.privacy} /> : null}
      </main>

      <SiteFooter config={sections?.footer} navLinks={navLinks} />
    </>
  );
}
