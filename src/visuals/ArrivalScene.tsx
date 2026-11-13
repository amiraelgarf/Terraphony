/** Screen 00 — The Invitation. "A world of sound. Yours." */
import { ArrowUpRight } from 'lucide-react';
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

  async function begin(tour: boolean, withSound = true) {
    if (leaving) return;
    // an explicit choice: unlock sound and play one soft seed note, or switch to the silent clock
    if (!withSound) a.setSound(false);
    else if (await a.ensureSound()) transport.audition(60);
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
        <h1 id="arrival-title" className="display arrival__title" tabIndex={-1} data-scene-heading>
          A world
          <br />
          of <i>sound.</i>
          <span className="arrival__last">Yours.</span>
        </h1>
        <p className="arrival__lead">Turn real NASA measurements of the sea and the land into a short piece of music. Then keep it as a record that could only come from that place.</p>
        <div className="arrival__actions">
          <button
            className="cta cta--ink"
            onClick={() => begin(false)}
            onMouseEnter={() => setNudge(true)}
            onMouseLeave={() => setNudge(false)}
            onFocus={() => setNudge(true)}
            onBlur={() => setNudge(false)}
          >
            Make my Earth Record <ArrowUpRight className="cta__arrow" aria-hidden="true" />
          </button>
          <button className="link-btn link-btn--ink" onClick={() => begin(false, false)}>
            Make it without sound
          </button>
        </div>
        <p className="arrival__tour">
          New here? <button className="link-btn link-btn--ink" onClick={() => begin(true)}>Take the short tour</button>
          <span className="arrival__tour-note">about one minute, with sound</span>
        </p>
        <p className="arrival__quote">“We know how Earth looks. What if we could follow how it changes — by listening?”</p>
        <p className="arrival__foot">
          A creative experience built on NASA Earth-science data. Sound plays only after you choose; everything also works silently.
        </p>
      </div>
      <div className="arrival__stage">
        <span className="eyebrow arrival__stage-label" aria-hidden="true">Earth record · 001</span>
        <EarthRecordHero leaving={leaving} nudge={nudge} reducedMotion={state.reducedMotion} />
        <span className="eyebrow arrival__stage-foot" aria-hidden="true">Pressed by you</span>
      </div>
    </section>
  );
}
