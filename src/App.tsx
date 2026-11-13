/**
 * App — loads the source registry, then renders the shell. Loading and error
 * states use the same typographic language as the rest of the observatory.
 */
import { useEffect, useState } from 'react';
import { JukeboxProvider, useJukebox } from './app/JukeboxContext';
import { EditorialHeader } from './components/EditorialHeader';
import { ErrorFallback } from './components/ErrorFallback';
import { FooterCredits } from './components/FooterCredits';
import { MethodPage } from './components/MethodPage';
import { Observatory } from './components/Observatory';
import { COPY } from './content/microcopy.en';
import { loadRegistry, type Registry } from './domain/sourceRegistry';

function Notices() {
  const { state, registry, actions } = useJukebox();
  return (
    <>
      {registry.manifest.dataIntegrity.fixture && (
        <div className="banner banner-warn" role="status">Synthetic demonstration — not NASA observations.</div>
      )}
      {state.notice === 'audio-failed' && (
        <div className="banner" role="status">
          {COPY.audioFailure}{' '}
          <button type="button" className="btn btn-text" onClick={actions.dismissNotice}>Dismiss</button>
        </div>
      )}
    </>
  );
}

function Shell() {
  const { state } = useJukebox();
  return (
    <div className={`app ${state.reducedMotion ? 'is-reduced' : ''}`}>
      <a className="skip-link" href="#main">Skip to content</a>
      <EditorialHeader />
      <Notices />
      <main id="main" tabIndex={-1}>
        {state.route === 'method' ? <MethodPage /> : <Observatory />}
      </main>
      <FooterCredits />
    </div>
  );
}

export function App() {
  const [registry, setRegistry] = useState<Registry | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    loadRegistry()
      .then(setRegistry)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (error) return <ErrorFallback message={error} />;
  if (!registry)
    return (
      <div className="loading" role="status">
        <p className="eyebrow">{COPY.appName}</p>
        <p>Loading NASA SVS 3912 frames and feature grids…</p>
      </div>
    );
  return (
    <JukeboxProvider registry={registry}>
      <Shell />
    </JukeboxProvider>
  );
}
