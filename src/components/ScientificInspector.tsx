/**
 * ScientificInspector — "Behind the sound". Traces the selected note through
 * the whole chain: NASA source → frame/time → position → feature value →
 * normalization → scale index → note → instrument.
 */
import { Compass, Crosshair, RotateCcw, X } from 'lucide-react';
import { useMemo } from 'react';
import { fmtConfidence, fmtDelta, fmtPixel, fmtPosition, fmtValue } from '../app/format';
import { inspect, type Reading } from '../app/inspection';
import { useJukebox } from '../app/JukeboxContext';
import { COPY, REASON_COPY } from '../content/microcopy.en';
import type { PointComparison } from '../domain/compare';
import { PITCHES } from '../domain/sonification';
import { formatUTC } from '../domain/sourceRegistry';

function Readout({ r, title }: { r: Reading; title?: string }) {
  return (
    <dl className="readout">
      {title && <div className="readout-title">{title}</div>}
      <div><dt>Source</dt><dd>NASA SVS 3912 · frame {r.frame.frameNumber}</dd></div>
      <div><dt>Frame time</dt><dd className="num">{formatUTC(r.frame.captureOrModelTimeUTC)} <span className="muted">(model time)</span></dd></div>
      <div><dt>Position</dt><dd className="num">{fmtPosition(r.position)}</dd></div>
      <div><dt>Source pixel</dt><dd className="num">{fmtPixel(r.position)}{r.cell ? ` · cell ${r.cell[0]}, ${r.cell[1]}` : ''}</dd></div>
      <div><dt>Quantity</dt><dd>{r.quantity ? r.quantity.kind === 'visual-feature' ? r.quantity.featureName : 'Modeled SST' : '—'}</dd></div>
      {r.quantity ? (
        <>
          <div>
            <dt>Value</dt>
            <dd className="num value-strong">
              {fmtValue(r.quantity.value)} <span className="muted unit">normalized, not °C</span>
            </dd>
          </div>
          {r.quantity.kind === 'visual-feature' && (
            <div><dt>Confidence</dt><dd className="num">{fmtConfidence(r.quantity.confidence)}</dd></div>
          )}
          <div><dt>Note</dt><dd className="note-big">{r.mapping?.note}</dd></div>
        </>
      ) : (
        <div className="rest-explain">
          <dt>Note</dt>
          <dd>
            <strong>Rest</strong> — {REASON_COPY[r.reason ?? 'missing']}
          </dd>
        </div>
      )}
    </dl>
  );
}

function MappingChain({ r }: { r: Reading }) {
  const m = r.mapping;
  if (!m) return null;
  return (
    <details className="disclosure">
      <summary>{COPY.formulaAction}</summary>
      <ol className="chain num">
        <li>u = clamp(({fmtValue(m.value)} − 0) ÷ (1 − 0), 0, 1) = {m.u.toFixed(3)}{m.clamped && <span className="muted"> (pitch clamped; value shown unclamped)</span>}</li>
        <li>index = round({m.u.toFixed(3)} × 10) = {m.index}</li>
        <li>note = scale[{m.index}] = {m.note}</li>
      </ol>
      <div className="scale" aria-label={`Scale, with ${m.note} highlighted`}>
        {PITCHES.map((p, i) => (
          <span key={p} className={i === m.index ? 'is-on' : ''}>{p}</span>
        ))}
      </div>
    </details>
  );
}

function Comparison({ c, a, b }: { c: PointComparison; a: Reading | null; b: Reading | null }) {
  return (
    <div className="comparison">
      <table>
        <thead>
          <tr><th scope="col" /><th scope="col">A</th><th scope="col">B</th></tr>
        </thead>
        <tbody>
          <tr><th scope="row">Time</th><td className="num">{a?.frame.captureOrModelTimeUTC?.slice(0, 10) ?? '—'}</td><td className="num">{b?.frame.captureOrModelTimeUTC?.slice(0, 10) ?? '—'}</td></tr>
          <tr><th scope="row">Value</th><td className="num">{a?.quantity ? fmtValue(a.quantity.value) : 'rest'}</td><td className="num">{b?.quantity ? fmtValue(b.quantity.value) : 'rest'}</td></tr>
          <tr><th scope="row">Note</th><td>{a?.mapping?.note ?? '—'}</td><td>{b?.mapping?.note ?? '—'}</td></tr>
        </tbody>
      </table>
      {c.comparable ? (
        <p className="num">
          B − A = <strong>{fmtDelta(c.delta)}</strong> <span className="muted">normalized feature units, not °C</span>
        </p>
      ) : (
        <p className="muted">{c.reason}</p>
      )}
      {c.comparable && c.sameNote && <p className="muted">{COPY.sameNote}</p>}
    </div>
  );
}

export function ScientificInspector() {
  const { state, derived, actions, registry } = useJukebox();
  const model = useMemo(() => inspect(state, derived, registry), [state, derived, registry]);
  const inStory = state.route === 'story';
  const threshold = registry.route.accentThreshold;

  let title = 'Select a note';
  if (model.kind === 'step') title = `Route point ${model.index + 1} of ${model.total}`;
  if (model.kind === 'probe') title = 'Probed point';
  if (model.kind === 'spatial') title = 'Two places, one frame';

  return (
    <aside className="inspector" aria-labelledby="inspector-title">
      <header className="inspector-head">
        <div>
          <p className="eyebrow">{COPY.inspectorTitle}</p>
          <h2 id="inspector-title">{title}</h2>
        </div>
        <button type="button" className="icon-btn" onClick={actions.closeInspector} aria-label="Collapse inspector" title="Collapse">
          <X size={16} strokeWidth={1.6} />
        </button>
      </header>
      <p className="badge">{COPY.fidelityBadge}</p>

      {model.kind === 'none' && <p className="muted">Pause on any note in the timeline, or select a point on the map, to see exactly where its sound came from.</p>}

      {(model.kind === 'step' || model.kind === 'probe') && (
        <>
          <Readout r={model.reading} title={model.other ? `Frame ${model.reading.frameKey} (shown)` : undefined} />
          <MappingChain r={model.reading} />
          {model.kind === 'step' && model.reading.event && (
            <dl className="readout readout-secondary">
              <div>
                <dt>Rhythm</dt>
                <dd className="num">
                  {model.reading.event.delta === null ? 'no previous value' : `${fmtDelta(model.reading.event.delta)} from the previous point`}
                  {model.reading.event.accent ? ` · accent (≥ ${threshold})` : ''}
                </dd>
              </div>
              <div>
                <dt>Bass</dt>
                <dd className="num">{model.reading.event.bassValue === null ? 'silent (no valid values in this stretch)' : `stretch mean ${fmtValue(model.reading.event.bassValue)} → ${model.reading.event.bassNote}`}</dd>
              </div>
            </dl>
          )}
          {model.comparison && (
            <Comparison
              c={model.comparison}
              a={model.reading.frameKey === 'A' ? model.reading : model.other}
              b={model.reading.frameKey === 'B' ? model.reading : model.other}
            />
          )}
          <p className="honesty">{model.reading.quantity ? COPY.inspectorVisual : ''} {COPY.inspectorHonesty}</p>
          <div className="inspector-actions">
            {model.kind === 'step' && model.reading.quantity && (
              <button type="button" className="btn btn-quiet" onClick={() => void actions.replayEvent(model.reading.frameKey, model.index)}>
                <RotateCcw size={14} strokeWidth={1.6} aria-hidden="true" /> Replay this event
              </button>
            )}
            <button type="button" className="btn btn-quiet" aria-pressed={state.solo === 'melody'} onClick={() => actions.setSolo(state.solo === 'melody' ? null : 'melody')}>
              Hear only the melody
            </button>
            {model.kind === 'step' && state.route !== 'explore' && (
              <button type="button" className="btn btn-quiet" onClick={actions.exploreHere}>
                <Crosshair size={14} strokeWidth={1.6} aria-hidden="true" /> Explore this location
              </button>
            )}
            {inStory && state.chapter === 'microscope' && (
              <button type="button" className="btn btn-primary" onClick={actions.nextChapter}>
                <Compass size={14} strokeWidth={1.6} aria-hidden="true" /> Continue the story
              </button>
            )}
          </div>
        </>
      )}

      {model.kind === 'spatial' && (
        <>
          {model.a ? <Readout r={model.a} title="Place A" /> : <p className="muted">Select a point on the map to place marker A.</p>}
          {model.b ? <Readout r={model.b} title="Place B" /> : <p className="muted">Then place marker B.</p>}
          {model.comparison && <Comparison c={model.comparison} a={model.a} b={model.b} />}
          <p className="muted">{COPY.compareVisualCaveat}</p>
        </>
      )}

      <details className="disclosure provenance">
        <summary>How this sound was made</summary>
        <ol className="chain">
          <li>Official source: <a href={registry.manifest.sourceVisual} target="_blank" rel="noreferrer">NASA SVS 3912</a>, Global Sea Surface Currents and Temperature (ECCO2 model visualization)</li>
          <li>Asset: frame {derived.frames[state.frameKey].frameNumber} of the 2048×1024 global frame set, time from NASA’s frame table</li>
          <li>Processing: hue matched to NASA’s legend → position 0–1; median of a 4×4-pixel cell; land and unreadable cells become rests</li>
          <li>Variable: normalized palette position (an image feature, not °C)</li>
          <li>Normalization: 0–1 → 11-note scale C3…C5</li>
          <li>Instruments: melody (this value), bass (8-step mean), rhythm (spatial change), atmosphere (artistic)</li>
        </ol>
      </details>
    </aside>
  );
}
