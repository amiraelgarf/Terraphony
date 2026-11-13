/**
 * SonicLegend — a hands-on teaching control. A hypothetical input slider shows
 * the note it would produce. Clearly labelled illustrative; never source data.
 */
import { useState } from 'react';
import { useJukebox } from '../app/JukeboxContext';
import { PITCHES, explainMapping } from '../domain/sonification';

export function SonicLegend() {
  const { derived, actions } = useJukebox();
  const [v, setV] = useState(0.5);
  const m = explainMapping(v, derived.profile)!;
  return (
    <section className="sonic-legend" aria-labelledby="sonic-legend-title">
      <p className="eyebrow">Sonic legend</p>
      <h3 id="sonic-legend-title">What determines a note?</h3>
      <p className="badge badge-quiet">Illustrative musical mapping — not an observed or model result.</p>
      <label className="slider-label" htmlFor="sonic-input">
        Hypothetical input <span className="num">{v.toFixed(2)}</span> <span className="muted">(normalized feature, 0–1, not a temperature)</span>
      </label>
      <input id="sonic-input" type="range" min={0} max={1} step={0.01} value={v} onChange={(e) => setV(Number(e.target.value))} aria-valuetext={`${v.toFixed(2)}, note ${m.note}`} />
      <div className="scale" aria-hidden="true">
        {PITCHES.map((p, i) => (
          <span key={p} className={i === m.index ? 'is-on' : ''}>{p}</span>
        ))}
      </div>
      <p className="num">
        round({m.u.toFixed(2)} × 10) = {m.index} → <strong>{m.note}</strong>
      </p>
      <button type="button" className="btn btn-quiet" onClick={() => void actions.hearValue(v)}>
        Hear {m.note}
      </button>
    </section>
  );
}
