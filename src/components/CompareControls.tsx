/**
 * CompareControls — what is fixed, what changes. Temporal A/B uses the two
 * validated frames; the spatial fallback compares two places in one frame.
 */
import { Play } from 'lucide-react';
import { useJukebox } from '../app/JukeboxContext';
import { COPY } from '../content/microcopy.en';
import { formatUTC } from '../domain/sourceRegistry';
import { ToolSwitch } from './ExploreToolbar';

export function CompareControls() {
  const { state, derived, actions } = useJukebox();
  const temporalOk = derived.comparability.ok;
  const temporal = state.compareMode === 'temporal' && temporalOk;

  return (
    <section className="compare-bar" aria-label="Compare">
      <p className="eyebrow">Compare</p>
      <h1 className="chapter-title">{temporal ? COPY.compareTitle : 'Two places, one moment.'}</h1>

      <div className="segmented" role="radiogroup" aria-label="Comparison type">
        <button type="button" role="radio" aria-checked={temporal} className={temporal ? 'is-on' : ''} disabled={!temporalOk} onClick={() => actions.setCompareMode('temporal')}>
          Two moments
        </button>
        <button type="button" role="radio" aria-checked={!temporal} className={!temporal ? 'is-on' : ''} onClick={() => actions.setCompareMode('spatial')}>
          Two places
        </button>
      </div>
      {!temporalOk && <p className="warning">{COPY.unavailablePair} {derived.comparability.ok ? '' : derived.comparability.reason}</p>}

      {temporal ? (
        <>
          <p className="caption">{COPY.compareInstruction}</p>
          <div className="ab-switch" role="radiogroup" aria-label="Source frame">
            {(['A', 'B'] as const).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={state.frameKey === k} className={`ab-option ${state.frameKey === k ? 'is-on' : ''}`} onClick={() => actions.setFrame(k)}>
                <span className={`key-${k.toLowerCase()}`}>{k}</span>
                <span className="num">{formatUTC(derived.frames[k].captureOrModelTimeUTC)}</span>
                <span className="muted small">frame {derived.frames[k].frameNumber}</span>
              </button>
            ))}
          </div>
          <div className="route-actions">
            <button type="button" className="btn btn-primary" onClick={() => void actions.playAB()}>
              <Play size={14} strokeWidth={1.6} aria-hidden="true" /> A, then B (16 steps around the selected point)
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => void actions.playRoute()}>Full route on {state.frameKey}</button>
          </div>
          <ul className="fixed-list small">
            <li><strong>Fixed:</strong> route ({derived.routeLabel}), 64 points, projection, scale, tempo, instruments, levels.</li>
            <li><strong>Changes:</strong> only the source frame and its time.</li>
          </ul>
          <p className="muted small">{COPY.compareCaveat} {COPY.compareVisualCaveat}</p>
        </>
      ) : (
        <>
          <p className="caption">{COPY.spatialInstruction}</p>
          <div className="route-actions">
            <div className="segmented" role="radiogroup" aria-label="Marker to place">
              {(['A', 'B'] as const).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={state.spatial.placing === k} className={state.spatial.placing === k ? 'is-on' : ''} onClick={() => actions.setPlacing(k)}>
                  Place {k}
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-primary" disabled={!state.spatial.A || !state.spatial.B} onClick={() => void actions.playSpatial()}>
              <Play size={14} strokeWidth={1.6} aria-hidden="true" /> Hear A, then B
            </button>
          </div>
          <p className="muted small">Frame {derived.frames[state.frameKey].frameNumber} · {formatUTC(derived.frames[state.frameKey].captureOrModelTimeUTC)}. Keyboard: focus the map, move with arrows, press Enter to place.</p>
        </>
      )}
      <div className="compare-tools">
        <span className="muted small">Map tool</span>
        <ToolSwitch />
      </div>
    </section>
  );
}
