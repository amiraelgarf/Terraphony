/** FooterCredits — NASA attribution and independence, visible on every view. */
import { useJukebox } from '../app/JukeboxContext';
import { COPY } from '../content/microcopy.en';

export function FooterCredits() {
  const { registry } = useJukebox();
  return (
    <footer className="site-footer small">
      <p>
        Visualization: <a href={registry.manifest.sourceVisual} target="_blank" rel="noreferrer">NASA SVS 3912 — Global Sea Surface Currents and Temperature</a>. Credit: {registry.manifest.sourceCredits}. Model: ECCO2 (MIT/JPL). Music: original, generated in your browser.
      </p>
      <p className="muted">{COPY.independence} {COPY.historicalNote}</p>
    </footer>
  );
}
