/**
 * ExploreToolbar — explicit Probe / Draw / Navigate tools (a segmented control),
 * plus the drawn-route panel: Play, Reverse, Compare moments, Clear.
 */
import { ArrowLeftRight, BookOpen, Hand, MousePointer2, Pencil, Play, Trash2 } from 'lucide-react';
import { useJukebox } from '../app/JukeboxContext';
import type { ExploreTool } from '../app/state';
import { COPY } from '../content/microcopy.en';
import { HIGH_REST_SHARE } from '../domain/scan';

const TOOLS: { id: ExploreTool; label: string; icon: typeof Pencil; hint: string }[] = [
  { id: 'probe', label: 'Probe', icon: MousePointer2, hint: COPY.probeInstruction },
  { id: 'draw', label: 'Draw', icon: Pencil, hint: COPY.drawInstruction },
  { id: 'navigate', label: 'Navigate', icon: Hand, hint: COPY.navigateInstruction },
];

export function ToolSwitch() {
  const { state, actions } = useJukebox();
  return (
    <div className="segmented" role="radiogroup" aria-label="Map tool">
      {TOOLS.map((t) => (
        <button key={t.id} type="button" role="radio" aria-checked={state.tool === t.id} className={state.tool === t.id ? 'is-on' : ''} onClick={() => actions.setTool(t.id)}>
          <t.icon size={15} strokeWidth={1.6} aria-hidden="true" /> {t.label}
        </button>
      ))}
    </div>
  );
}

export function ExploreToolbar() {
  const { state, derived, actions } = useJukebox();
  const hint = TOOLS.find((t) => t.id === state.tool)!.hint;
  const drawn = state.routeSource === 'drawn' && state.drawnRoute;
  const rests = derived.scans[state.frameKey].restShare;

  return (
    <section className="explore-bar" aria-label="Explore">
      <div className="explore-head">
        <div>
          <p className="eyebrow">Explore</p>
          <h1 className="chapter-title">{COPY.handover}</h1>
        </div>
        {state.storyReturn && (
          <button type="button" className="btn btn-text" onClick={actions.backToStory}>
            <BookOpen size={14} strokeWidth={1.6} aria-hidden="true" /> Back to story
          </button>
        )}
      </div>
      <div className="explore-tools">
        <ToolSwitch />
        <p className="tool-hint" aria-live="polite">{hint}</p>
      </div>

      <div className="route-panel">
        <p className="route-status">
          {drawn ? <strong>{COPY.routeReady}</strong> : <span>Listening route: <strong>{derived.routeLabel}</strong></span>}
          <span className="muted num"> · {Math.round(derived.routeKm).toLocaleString('en')} km · 64 points{state.drawnRoute && !drawn ? ' · your drawn route is saved' : ''}</span>
        </p>
        {drawn && rests > HIGH_REST_SHARE && <p className="warning">{COPY.manyRests}</p>}
        <div className="route-actions">
          <button type="button" className="btn btn-primary" onClick={() => void actions.playRoute()}>
            <Play size={14} strokeWidth={1.6} aria-hidden="true" /> {drawn ? 'Play this route' : 'Play the route'}
          </button>
          <button type="button" className="btn btn-quiet" onClick={actions.reverseRoute} aria-pressed={state.reversed}>
            <ArrowLeftRight size={14} strokeWidth={1.6} aria-hidden="true" /> Reverse
          </button>
          <button type="button" className="btn btn-quiet" onClick={() => actions.navigate('compare')}>Compare moments</button>
          {state.drawnRoute && (drawn ? (
            <button type="button" className="btn btn-quiet" onClick={actions.useStoryRoute}>Use the story route</button>
          ) : (
            <button type="button" className="btn btn-quiet" onClick={actions.useDrawnRoute}>Use my route</button>
          ))}
          {state.drawnRoute && (
            <button type="button" className="btn btn-quiet" onClick={actions.clearDrawn}>
              <Trash2 size={14} strokeWidth={1.6} aria-hidden="true" /> Clear
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
