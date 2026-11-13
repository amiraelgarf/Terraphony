/**
 * MusicalLayerMixer — each layer labelled with what it actually encodes.
 * Solo/mute ramps gain only; mappings never change.
 */
import { useJukebox } from '../app/JukeboxContext';
import { effectiveLayers } from '../app/state';
import { COPY } from '../content/microcopy.en';
import { LAYERS, type Layer } from '../domain/sonification';

const LABELS: Record<Layer, { name: string; meaning: string; tag: 'visual-frame feature' | 'artistic' }> = {
  melody: { name: 'Melody', meaning: 'palette position at the cursor', tag: 'visual-frame feature' },
  bass: { name: 'Bass', meaning: 'mean palette position over each 8-step stretch', tag: 'visual-frame feature' },
  rhythm: { name: 'Rhythm', meaning: 'spatial change between neighbouring route points', tag: 'visual-frame feature' },
  atmosphere: { name: 'Atmosphere', meaning: 'a soft pad, not derived from data', tag: 'artistic' },
};

export function MusicalLayerMixer() {
  const { state, actions } = useJukebox();
  const on = effectiveLayers(state);
  return (
    <details className="disclosure mixer">
      <summary>Sound layers</summary>
      <p className="muted small">{COPY.layerExplanation}</p>
      <ul>
        {LAYERS.map((l) => (
          <li key={l} className={on[l] ? '' : 'is-off'}>
            <div className="mixer-label">
              <span className="mixer-name">{LABELS[l].name}</span>
              <span className="muted small">{LABELS[l].meaning}</span>
              <span className={`tag tag-${LABELS[l].tag === 'artistic' ? 'art' : 'data'}`}>{LABELS[l].tag}</span>
            </div>
            <div className="mixer-buttons">
              <button type="button" className="chip" aria-pressed={state.mutes[l]} onClick={() => actions.toggleMute(l)} aria-label={`Mute ${LABELS[l].name}`}>
                Mute
              </button>
              <button type="button" className="chip" aria-pressed={state.solo === l} onClick={() => actions.setSolo(state.solo === l ? null : l)} aria-label={`Solo ${LABELS[l].name}`}>
                Solo
              </button>
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}
