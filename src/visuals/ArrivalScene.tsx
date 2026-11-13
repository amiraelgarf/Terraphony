/** Screen 00 — The Invitation. "A world of sound. Yours." */
import { useState } from 'react';
import { useRecord } from '../app/RecordContext';
import { useActions } from '../app/useActions';
import { transport } from '../audio/transport';
import { EarthRecordHero } from './EarthRecordHero';
import { Masthead } from './Masthead';

const LEAVE_MS = 1650;

export function ArrivalScene() {
  const { state, dispatch } = useRecord();
  const a = useActions();
  const [leaving, setLeaving] = useState(false);
  const [nudge, setNudge] = useState(false);

  async function begin(tour: boolean) {
    if (leaving) return;
    // the gesture may unlock sound and play one soft seed note
    if (await a.ensureSound()) transport.audition(60);
    const go = () => {
      if (tour) {
        dispatch({ type: 'ocean', patch: { presetId: 'gulf-stream', tool: 'preset' } });
        dispatch({ type: 'tour', step: 0 });
        a.go('studio', 'ocean');
      } else a.go('library');
      setLeaving(false);
    };
    if (state.reducedMotion) return go();
    setLeaving(true);
    window.setTimeout(go, LEAVE_MS);
  }

  return (
    <section className={`scene scene--arrival${leaving ? ' is-leaving' : ''}`} aria-labelledby="arrival-title">
      <Masthead tone="paper" />
      <div className="arrival__copy">
        <span className="eyebrow eyebrow--rule eyebrow--copper">An invitation to listen</span>
        <h1 id="arrival-title" className="display arrival__title">
          A world
          <br />
          of <i>sound.</i>
          <span className="arrival__last">Yours.</span>
        </h1>
        <p className="arrival__lead">Choose a place on Earth. Follow its patterns through space or time. Make a record that could only come from there.</p>
        <div className="arrival__actions">
          <button
            className="cta cta--ink"
            onClick={() => begin(false)}
            onMouseEnter={() => setNudge(true)}
            onMouseLeave={() => setNudge(false)}
            onFocus={() => setNudge(true)}
            onBlur={() => setNudge(false)}
          >
            Make my Earth Record <span className="cta__arrow" aria-hidden="true">↗</span>
          </button>
          <button className="link-btn link-btn--ink" onClick={() => begin(true)}>
            Take the short tour
          </button>
        </div>
        <p className="arrival__quote">“We know how Earth looks. What if we could follow how it changes — by listening?”</p>
        <p className="arrival__foot">
          A creative experience with NASA Earth-science sources.
          <br />
          Sound starts only when you choose. <button className="inline-btn" onClick={() => a.setSound(false)}>Continue sound-off</button>
        </p>
      </div>
      <div className="arrival__stage">
        <span className="eyebrow arrival__stage-label">Earth / side A — 001</span>
        <EarthRecordHero leaving={leaving} nudge={nudge} reducedMotion={state.reducedMotion} />
        <span className="eyebrow arrival__stage-foot">Coastlines: Natural Earth<br />Pressed by you</span>
      </div>
    </section>
  );
}
