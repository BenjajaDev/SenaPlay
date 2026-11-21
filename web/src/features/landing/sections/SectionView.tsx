import type { LandingSections, Publication, PublicStats, SectionKey } from '@/data/types';
import { CollaboratorsSection } from '../CollaboratorsSection';
import { landingNavLinks } from '../landingNav';
import { PhoneShowcase } from '../PhoneShowcase';
import { SiteFooter } from '../SiteFooter';
import { AccessibilitySection, DownloadSection, HeroSection, MetricsSection } from './BasicSections';
import { FundingSection } from './FundingSection';
import { PrivacySection } from './PrivacySection';
import { ProblemSection } from './ProblemSection';
import { PublicationsSection } from './PublicationsSection';
import { SolutionSection } from './SolutionSection';
import { TerritorySection } from './TerritorySection';

/** Datos que algunas secciones necesitan además de sus textos. */
export type SectionData = { stats: PublicStats | null | undefined; posts: Publication[] };

/**
 * Una sección de la landing, tal como se ve en la página, a partir de sus
 * textos. La usan la landing y la vista previa del panel, así ambas muestran
 * exactamente lo mismo. No decide si la sección está visible: eso lo hace
 * quien la monta.
 */
export function SectionView({ sectionKey, sections, data }: Readonly<{ sectionKey: SectionKey; sections: LandingSections; data: SectionData }>) {
  switch (sectionKey) {
    case 'hero':
      return <HeroSection hero={sections.hero} moreHref={landingNavLinks(sections, { publications: data.posts.length > 0, showcase: true })[0]?.href || '#nosotros'} />;
    case 'metrics':
      return <MetricsSection config={sections.metrics} stats={data.stats} />;
    case 'problem':
      return <ProblemSection config={sections.problem} />;
    case 'features':
      return <SolutionSection config={sections.features} />;
    case 'accessibility':
      return <AccessibilitySection config={sections.accessibility} />;
    case 'showcase':
      return <PhoneShowcase config={sections.showcase} />;
    case 'territory':
      return <TerritorySection config={sections.territory} />;
    case 'publications':
      return <PublicationsSection config={sections.publications} items={data.posts} />;
    case 'club':
      return (
        <section className="section section--tinted">
          <CollaboratorsSection config={sections.club} />
        </section>
      );
    case 'funding':
      return <FundingSection config={sections.funding} />;
    case 'download':
      return <DownloadSection config={sections.download} />;
    case 'privacy':
      return <PrivacySection config={sections.privacy} />;
    case 'footer':
      return <SiteFooter config={sections.footer} navLinks={landingNavLinks(sections, { publications: data.posts.length > 0, showcase: true })} />;
  }
}
