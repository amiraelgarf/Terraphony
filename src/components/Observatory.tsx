/**
 * Observatory — the one persistent stage shared by entry, story, explore and
 * compare. The map, transport and inspector stay mounted across chapters and
 * modes, so moving between them never reloads data or loses the listener's place.
 */
import { Info } from 'lucide-react';
import { useMemo } from 'react';
import { inspect } from '../app/inspection';
import { useJukebox } from '../app/JukeboxContext';
import { COPY } from '../content/microcopy.en';
import { formatUTC } from '../domain/sourceRegistry';
import { AudioTransport } from './AudioTransport';
import { CompareControls } from './CompareControls';
import { EarthDataMap } from './EarthDataMap';
import { EntryScene } from './EntryScene';
import { ExploreToolbar } from './ExploreToolbar';
import { MapLegend } from './MapLegend';
import { MusicalLayerMixer } from './MusicalLayerMixer';
import { RouteStepList } from './RouteStepList';
import { ScientificInspector } from './ScientificInspector';
import { SonicLegend } from './SonicLegend';
import { StoryPanel } from './StoryPanel';

export function Observatory() {
  const { state, derived, actions, registry } = useJukebox();
  const entry = state.route === 'entry';
  const language = state.route === 'story' && state.chapter === 'language';
  const model = useMemo(() => inspect(state, derived, registry), [state, derived, registry]);
  const legendValue =
    model.kind === 'step' || model.kind === 'probe' ? model.reading.quantity?.value ?? null : model.kind === 'spatial' ? model.a?.quantity?.value ?? null : null;
  const frame = derived.frames[state.frameKey];

  return (
    <div className={`observatory ${entry ? 'is-entry' : ''} route-${state.route}`}>
      {!entry && (
        <div className="stage-head">
          {state.route === 'story' && <StoryPanel />}
          {state.route === 'explore' && <ExploreToolbar />}
          {state.route === 'compare' && <CompareControls />}
        </div>
      )}

      <div className={`stage ${state.inspectorOpen || language ? 'has-side' : ''}`}>
        <div className="stage-main">
          <div className="frame-strip small">
            <span>{COPY.sourceLabel}</span>
            <span className="num">
              Frame {state.frameKey}: {formatUTC(frame.captureOrModelTimeUTC)}
            </span>
          </div>
          <EarthDataMap />
          {!entry && <MapLegend value={legendValue} />}
          {entry && <EntryScene />}
        </div>

        {!entry && (state.inspectorOpen || language) && (
          <div className="stage-side">
            {language ? <SonicLegend /> : <ScientificInspector />}
            {!language && <MusicalLayerMixer />}
          </div>
        )}
        {!entry && !state.inspectorOpen && !language && (
          <button type="button" className="btn btn-quiet side-reopen" onClick={() => actions.whyThisNote()}>
            <Info size={14} strokeWidth={1.6} aria-hidden="true" /> {COPY.inspectorTitle}
          </button>
        )}
      </div>

      {!entry && !language && (
        <>
          <AudioTransport />
          <RouteStepList />
        </>
      )}
    </div>
  );
}
