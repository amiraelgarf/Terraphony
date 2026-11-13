/**
 * EditorialHeader — wordmark, sections, sound status and accessibility settings.
 */
import { Settings2, Volume2, VolumeX } from 'lucide-react';
import { useJukebox } from '../app/JukeboxContext';
import type { AppRoute } from '../app/state';
import { COPY } from '../content/microcopy.en';

const NAV: { route: AppRoute; label: string }[] = [
  { route: 'story', label: 'Story' },
  { route: 'explore', label: 'Explore' },
  { route: 'compare', label: 'Compare' },
  { route: 'method', label: 'Method' },
];

function SoundStatus() {
  const { state, actions } = useJukebox();
  if (state.audio === 'ready')
    return (
      <button type="button" className="btn btn-text sound-status is-on" onClick={actions.disableSound} title="Turn sound off">
        <Volume2 size={15} strokeWidth={1.6} aria-hidden="true" /> Sound on
      </button>
    );
  return (
    <button type="button" className="btn btn-text sound-status" onClick={() => void actions.enableSound()} title="Enable sound">
      <VolumeX size={15} strokeWidth={1.6} aria-hidden="true" /> {state.audio === 'failed' ? 'Sound unavailable — retry' : state.audio === 'off' ? 'Sound off' : 'Enable sound'}
    </button>
  );
}

function AccessibilitySettings() {
  const { state, actions } = useJukebox();
  return (
    <details className="settings">
      <summary aria-label="Accessibility settings" title="Accessibility settings">
        <Settings2 size={16} strokeWidth={1.6} aria-hidden="true" />
      </summary>
      <div className="settings-panel">
        <label className="check">
          <input type="checkbox" checked={state.reducedMotion} onChange={(e) => actions.setReducedMotion(e.target.checked)} />
          Reduce motion (step markers instead of a moving sweep)
        </label>
        <label className="check">
          <input type="checkbox" checked={state.audio === 'off'} onChange={(e) => (e.target.checked ? actions.disableSound() : void actions.enableSound())} />
          Visual-only mode (no sound; the scan still advances)
        </label>
        <p className="muted small">Captions are always on. A full transcript is on the Method page.</p>
      </div>
    </details>
  );
}

export function EditorialHeader() {
  const { state, actions } = useJukebox();
  return (
    <header className="site-header">
      <a href="#/" className="wordmark" onClick={(e) => { e.preventDefault(); actions.navigate('entry'); }}>
        <span className="wordmark-name">{COPY.appName}</span>
        <span className="wordmark-story">Ocean in Motion</span>
      </a>
      <nav aria-label="Sections" className="site-nav">
        {NAV.map((n) => (
          <a
            key={n.route}
            href={n.route === 'story' ? `#/story/${state.chapter === 'threshold' ? 'language' : state.chapter}` : `#/${n.route}`}
            aria-current={state.route === n.route ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault();
              actions.navigate(n.route);
            }}
          >
            {n.label}
          </a>
        ))}
      </nav>
      <div className="header-tools">
        <SoundStatus />
        <AccessibilitySettings />
      </div>
    </header>
  );
}
