/** Screen 00 — The Invitation. "A world of sound. Yours." */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useRecord } from '../app/RecordContext';
import { useActions } from '../app/useActions';
import { transport } from '../audio/transport';
import { EarthRecordHero } from './EarthRecordHero';
import { Masthead } from './Masthead';
import { BeethovenPortrait } from './BeethovenPortrait';
import { sceneHooks, tourDirector } from '../tour';

const LEAVE_MS = 1650;

export function ArrivalScene() {
  const { state } = useRecord();
  const a = useActions();
  const [leaving, setLeaving] = useState(false);
  const [nudge, setNudge] = useState(false);
  const touring = useSyncExternalStore((f) => tourDirector.subscribe(f), () => tourDirector.snapshot.active);

  /** The needle drops, the gold ring unrolls into a line, the iris opens — then the library. */
  function leave(): Promise<void> {
    return new Promise((done) => {
      const go = () => {
        a.go('library');
        setLeaving(false);
        done();
      };
      if (state.reducedMotion) return go();
      setLeaving(true);
      window.setTimeout(go, LEAVE_MS);
    });
  }
  const leaveRef = useRef(leave);
  leaveRef.current = leave;
  useEffect(() => {
    const hook = () => leaveRef.current();
    sceneHooks.leaveArrival = hook;
    return () => {
      if (sceneHooks.leaveArrival === hook) delete sceneHooks.leaveArrival;
    };
  }, []);

  async function begin() {
    if (leaving) return;
    // the gesture may unlock sound; one soft seed note sounds once the needle has landed
    void leave();
    if (await a.ensureSound()) window.setTimeout(() => transport.audition(60), state.reducedMotion ? 0 : LEAVE_MS);
  }

  /** The one click of the guided journey: sound unlocks here, then the host takes it from there. */
  function beginJourney() {
    if (leaving || tourDirector.active) return;
    tourDirector.start();
  }

  return (
    <section className={`scene scene--arrival${leaving ? ' is-leaving' : ''}${touring ? ' is-touring' : ''}`} aria-labelledby="arrival-title">
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
            onClick={() => begin()}
            onMouseEnter={() => setNudge(true)}
            onMouseLeave={() => setNudge(false)}
            onFocus={() => setNudge(true)}
            onBlur={() => setNudge(false)}
          >
            Make my Earth Record <span className="cta__arrow" aria-hidden="true">↗</span>
          </button>
        </div>
        <div className="arrival__host">
          <button className="host-invite" onClick={beginJourney} aria-describedby="host-note">
            <BeethovenPortrait size={58} tone="paper" />
            <span className="host-invite__text">
              <span className="host-invite__label">Begin the narrated journey</span>
              <span className="host-invite__sub">with your host, Beethoven</span>
            </span>
            <span className="host-invite__play" aria-hidden="true">▶</span>
          </button>
          <p id="host-note" className="arrival__host-note">Beethoven as your host (portrait: J. K. Stieler, 1820). One click, then it plays by itself — captions always on; pause, skip or take over at any moment.</p>
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
