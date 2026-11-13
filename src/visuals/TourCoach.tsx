/**
 * The optional short tour: Hear -> Notice -> Investigate -> Shape -> Press -> Keep.
 * It never takes control; each step waits for the visitor's own action and
 * can be skipped at any time.
 */
import { useEffect, useMemo } from 'react';
import { useRecord } from '../app/RecordContext';
import { useActions } from '../app/useActions';
import { notableIndex } from '../audio/musicMapper';
import type { EarthRecord } from '../data/types';

const STEPS = [
  { name: 'Hear', text: 'Press “Hear this journey”. The melody starts alone; a bass joins, then soft accents mark big changes.' },
  { name: 'Hear', text: 'Listen for a moment where the line jumps. Every note is one place on the route.' },
  { name: 'Notice', text: 'That change you heard? Here is the observation that made it.' },
  { name: 'Investigate', text: 'The sound is artistic. The number behind it isn’t invented. Open “Technical details” to see the exact rule.' },
  { name: 'Shape', text: 'You choose where to listen next. Pick “Draw a route” and trace your own line across the sea.' },
  { name: 'Press', text: 'Name it, choose an instrument character, then press your Earth Record.' },
];

export function TourCoach({ record }: { record: EarthRecord | null }) {
  const { state, dispatch } = useRecord();
  const a = useActions();
  const step = state.tour ?? 0;
  const notable = useMemo(() => (record ? notableIndex(record.observations) : null), [record]);
  const set = (s: number | null) => dispatch({ type: 'tour', step: s });

  useEffect(() => {
    if (step === 0 && state.playing) set(1);
    if (step === 1 && notable !== null && ((state.playhead ?? 0) >= notable + 2 || (!state.playing && state.playhead === null))) set(2);
    if (step === 4 && state.ocean.presetId === null && state.ocean.waypoints.length > 1) set(5);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const s = STEPS[Math.min(step, STEPS.length - 1)];
  return (
    <div className="tour" role="region" aria-label="Short tour" aria-live="polite">
      <div className="tour__steps" aria-hidden="true">
        {['Hear', 'Notice', 'Investigate', 'Shape', 'Press'].map((n) => (
          <span key={n} className={n === s.name ? 'is-on' : ''}>{n}</span>
        ))}
      </div>
      <p>{s.text}</p>
      <div className="tour__actions">
        {step === 2 && notable !== null && (
          <button className="mini-btn mini-btn--gold" onClick={() => { a.inspect(notable); set(3); }}>Show me</button>
        )}
        {step === 3 && <button className="mini-btn mini-btn--gold" onClick={() => { dispatch({ type: 'ocean', patch: { tool: 'draw' } }); set(4); }}>Next</button>}
        <button className="mini-btn" onClick={() => set(null)}>{step >= 5 ? 'Done' : 'Skip the tour'}</button>
      </div>
    </div>
  );
}
