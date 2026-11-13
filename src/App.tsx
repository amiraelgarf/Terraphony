/**
 * Scene router. One scene is mounted at a time; each scene owns its own
 * composition and atmosphere (paper invitation, dark studio, press, paper reveal).
 */
import { Component, useEffect, useRef, type ReactNode } from 'react';
import { RecordProvider, useRecord } from './app/RecordContext';
import { ArrivalScene } from './visuals/ArrivalScene';
import { LibraryScene } from './visuals/LibraryScene';
import { MethodScene } from './visuals/MethodScene';
import { RecordPress } from './visuals/RecordPress';
import { RevealScene } from './visuals/RevealScene';
import { StudioScene } from './visuals/StudioScene';

const TITLES: Record<string, string> = {
  arrival: 'Make a record from Earth',
  library: 'Choose a journey',
  studio: 'Listen and shape',
  press: 'Pressing your record',
  reveal: 'Your record',
  method: 'How it works',
};

function Scenes() {
  const { state } = useRecord();
  const key = `${state.scene}-${state.scene === 'studio' ? state.story : ''}`;
  const first = useRef(true);
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = `${TITLES[state.scene] ?? 'Earth Records'} · Earth Records`;
    if (first.current) {
      first.current = false;
      return;
    }
    // move keyboard / screen-reader focus to the new scene's heading (scenes may focus something more specific themselves)
    const id = window.setTimeout(() => {
      const main = document.querySelector('main');
      if (main && main.contains(document.activeElement) && document.activeElement !== main) return;
      const h = document.querySelector<HTMLElement>('main [data-scene-heading], main h1');
      if (!h) return;
      if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1');
      h.focus({ preventScroll: true });
    });
    return () => window.clearTimeout(id);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <main className={`app${state.reducedMotion ? ' reduce-motion' : ''}`} key={key}>
      {state.scene === 'arrival' && <ArrivalScene />}
      {state.scene === 'library' && <LibraryScene />}
      {state.scene === 'studio' && <StudioScene />}
      {state.scene === 'press' && state.current && <RecordPress />}
      {state.scene === 'reveal' && state.current && <RevealScene />}
      {state.scene === 'method' && <MethodScene />}
    </main>
  );
}

class Boundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="fatal" role="alert">
        <h1 className="display">Something went wrong.</h1>
        <p>Your records and your choices are safe in this browser. Reloading usually fixes this.</p>
        <div className="fatal__actions">
          <button className="cta cta--ink-solid" onClick={() => window.location.reload()}>Reload the page</button>
          <button className="cta cta--ink" onClick={() => window.location.assign(`${window.location.pathname}#/library`)}>Go to my records</button>
        </div>
        <details className="fatal__details">
          <summary>Technical details</summary>
          <p>{this.state.error.message}</p>
        </details>
      </main>
    );
  }
}

export function App() {
  return (
    <Boundary>
      <RecordProvider>
        <div id="announcer" role="status" aria-live="polite" className="sr-only" />
        <Scenes />
      </RecordProvider>
    </Boundary>
  );
}
