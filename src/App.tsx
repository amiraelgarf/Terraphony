/**
 * Scene router. One scene is mounted at a time; each scene owns its own
 * composition and atmosphere (paper invitation, dark studio, press, paper reveal).
 */
import { Component, useEffect, type ReactNode } from 'react';
import { RecordProvider, useRecord } from './app/RecordContext';
import { ArrivalScene } from './visuals/ArrivalScene';
import { LibraryScene } from './visuals/LibraryScene';
import { MethodScene } from './visuals/MethodScene';
import { RecordPress } from './visuals/RecordPress';
import { RevealScene } from './visuals/RevealScene';
import { StudioScene } from './visuals/StudioScene';

function Scenes() {
  const { state } = useRecord();
  const key = `${state.scene}-${state.scene === 'studio' ? state.story : ''}`;
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [key]);
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
      <div className="fatal" role="alert">
        <h1 className="display">Something went wrong.</h1>
        <p>{this.state.error.message}</p>
        <p>Your drafts and pressed records are kept in this browser. Reloading usually fixes this.</p>
        <button className="cta cta--ink" onClick={() => window.location.assign(window.location.pathname)}>Reload</button>
      </div>
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
