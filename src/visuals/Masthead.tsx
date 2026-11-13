/** Top bar shared by every scene: brand, where-am-I steps, navigation, sound control. */
import { useActions } from '../app/useActions';
import { useRecord } from '../app/RecordContext';

/** The four steps of the journey, in plain words. Arrival and "How it works" sit outside them. */
const STEPS = [
  { scene: 'library', label: 'Choose' },
  { scene: 'studio', label: 'Listen & shape' },
  { scene: 'press', label: 'Press' },
  { scene: 'reveal', label: 'Keep' },
] as const;

export function Masthead({ tone = 'dark' }: { tone?: 'dark' | 'paper' }) {
  const { state } = useRecord();
  const a = useActions();
  const soundOn = state.sound === 'on';
  const stepIndex = STEPS.findIndex((s) => s.scene === state.scene);
  const soundLabel = state.sound === 'unavailable' ? 'No sound' : soundOn ? 'on' : 'off';
  return (
    <header className={`masthead masthead--${tone}`}>
      <button className="brand" onClick={() => a.go('arrival')} aria-label="Earth Records, back to the beginning">
        <span className="brand__emblem" aria-hidden="true">e</span>
        <span className="brand__name">Earth<br />Records</span>
      </button>

      {stepIndex >= 0 && (
        <nav className="steps" aria-label="Your progress">
          <ol>
            {STEPS.map((s, i) => (
              <li key={s.scene} className={i === stepIndex ? 'is-current' : i < stepIndex ? 'is-done' : ''} aria-current={i === stepIndex ? 'step' : undefined}>
                <span className="steps__num" aria-hidden="true">{i + 1}</span>
                <span className="steps__label">{s.label}</span>
              </li>
            ))}
          </ol>
          <span className="steps__compact" aria-hidden="true">Step {stepIndex + 1} of {STEPS.length}</span>
        </nav>
      )}

      <nav className="masthead__nav" aria-label="Main">
        {state.scene !== 'library' && state.scene !== 'arrival' && (
          <button className="link-btn link-btn--wide" onClick={() => a.go('library')}>Choose a journey</button>
        )}
        {state.scene !== 'method' && (
          <button className="link-btn" onClick={() => a.go('method')}>How it works</button>
        )}
        <button
          className={`sound-toggle${soundOn ? ' is-on' : ''}`}
          aria-pressed={soundOn}
          aria-label={state.sound === 'unavailable' ? 'Sound is not available in this browser' : `Sound ${soundLabel}`}
          onClick={() => a.setSound(!soundOn)}
          disabled={state.sound === 'unavailable'}
        >
          <span className="sound-toggle__bars" aria-hidden="true"><i /><i /><i /></span>
          {state.sound === 'unavailable' ? 'No sound' : <span><span className="sound-toggle__word">Sound </span>{soundLabel}</span>}
        </button>
      </nav>
    </header>
  );
}
