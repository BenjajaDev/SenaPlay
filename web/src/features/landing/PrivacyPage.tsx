import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRepositories } from '@/data/RepositoriesProvider';
import type { LandingSections } from '@/data/types';
import { brandIcon } from '@/lib/brand';
import { policyBlocks } from '@/lib/site';
import { useThemeMode } from '@/lib/useThemeMode';
import { SkeletonRows } from '@/ui';
import { TagList } from './sections/SectionHead';

/** Política completa en /privacidad (Secciones → Privacidad → «Texto completo»). Es la URL que se declara en Google Play. */
export function PrivacyPage() {
  const { site } = useRepositories();
  const { mode } = useThemeMode();
  const [privacy, setPrivacy] = useState<LandingSections['privacy'] | undefined>(undefined);

  useEffect(() => {
    let mounted = true;
    site.getSections().then((value) => mounted && setPrivacy(value.privacy));
    return () => {
      mounted = false;
    };
  }, [site]);

  return (
    <>
      <header className="landing-nav">
        <Link to="/" className="brand-link" aria-label="SeñaPlay, inicio">
          <img src={brandIcon(mode)} alt="" width={40} height={40} />
          <span>SeñaPlay</span>
        </Link>
        <Link to="/" className="btn btn--ghost btn--sm">
          <ArrowLeft size={16} aria-hidden /> Volver al inicio
        </Link>
      </header>
      <main id="contenido" className="policy">
        {privacy ? (
          <article className="stack" aria-labelledby="politica-title">
            <h1 id="politica-title">{privacy.title}</h1>
            <p className="policy__intro text-secondary">{privacy.intro}</p>
            <TagList tags={privacy.laws} label="Leyes aplicables" />
            {policyBlocks(privacy.body).map((block, index) =>
              block.kind === 'heading' ? <h2 key={index}>{block.text}</h2> : <p key={index}>{block.text}</p>,
            )}
          </article>
        ) : (
          <SkeletonRows rows={6} label="Cargando la política de privacidad" />
        )}
      </main>
    </>
  );
}
