/** Top bar shared by every scene: brand, act label, sound control, navigation. */
import { useActions } from '../app/useActions';
import { useRecord } from '../app/RecordContext';

const ACT: Record<string, string> = {
  arrival: 'A listening atlas / Volume 001',
  library: '01 — Choose where to listen',
  studio: '02 — Shape the journey',
  press: '03 — The record press',
  reveal: '04 — Your record',
  method: 'How it works',
};

export function Masthead({ tone = 'dark' }: { tone?: 'dark' | 'paper' }) {
  const { state } = useRecord();
  const a = useActions();
  const soundOn = state.sound === 'on';
  return (
    <header className={`masthead masthead--${tone}`}>
      <button className="brand" onClick={() => a.go('arrival')} aria-label="Earth Records, back to the beginning">
        <span className="brand__emblem" aria-hidden="true">e</span>
        <span className="brand__name">Earth<br />Records</span>
      </button>
      <span className="masthead__act">{ACT[state.scene]}</span>
      <nav className="masthead__nav" aria-label="Main">
        {state.scene !== 'library' && state.scene !== 'arrival' && (
          <button className="link-btn" onClick={() => a.go('library')}>All records</button>
        )}
        {state.scene !== 'method' && (
          <button className="link-btn" onClick={() => a.go('method')}>How it works</button>
        )}
        <button
          className={`sound-toggle${soundOn ? ' is-on' : ''}`}
          aria-pressed={soundOn}
          onClick={() => a.setSound(!soundOn)}
          disabled={state.sound === 'unavailable'}
          title={state.sound === 'unavailable' ? 'Sound is not available in this browser' : undefined}
        >
          <span className="sound-toggle__bars" aria-hidden="true"><i /><i /><i /></span>
          {state.sound === 'unavailable' ? 'No sound' : soundOn ? 'Sound on' : 'Sound off'}
        </button>
      </nav>
    </header>
  );
}
