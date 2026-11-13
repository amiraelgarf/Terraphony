/**
 * The host's caption, living above every scene (it survives scene changes, so the
 * voice and the words never restart because a component remounted).
 *
 * One current line, one dominant focus: a small portrait cameo, the phrase being
 * spoken, and quiet controls (pause, replay, voice, transcript, settings, end).
 * During the discovery it also draws the thread from the sample on Earth to its
 * note in the score.
 */
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useRecord } from '../app/RecordContext';
import { useActions } from '../app/useActions';
import { cueById } from '../tour/narration';
import { narration, tourDirector } from '../tour';
import type { TourPhase } from '../tour/tourDirector';
import { BeethovenPortrait } from './BeethovenPortrait';

const BEAT: Partial<Record<TourPhase, string>> = {
  invitation: 'Overture',
  'record-transition': 'Overture',
  'choosing-record': 'The library',
  'first-performance': 'First performance',
  discovery: 'A discovery',
  'baton-handover': 'The baton',
  creation: 'Your turn',
  pressing: 'The press',
  'record-ready': 'Your record',
  complete: 'Your record',
};

const useTour = () => useSyncExternalStore((f) => tourDirector.subscribe(f), () => tourDirector.snapshot);
const useNarration = () => useSyncExternalStore((f) => narration.subscribe(f), () => narration.snapshot);

export function GuideLayer() {
  const { state, dispatch, studio } = useRecord();
  const a = useActions();
  const tour = useTour();
  const voice = useNarration();
  const [transcript, setTranscript] = useState(false);
  const [settings, setSettings] = useState(false);
  const [closing, setClosing] = useState(false);
  const root = useRef<HTMLElement>(null);

  const speakingCue = voice.cueId ? cueById(voice.cueId) : null;
  const visible = (tour.active || !!speakingCue || closing) && state.scene !== 'press';
  const paperScene = state.scene === 'arrival' || state.scene === 'reveal' || state.scene === 'method';

  // keep the final line on screen a moment after the journey completes
  useEffect(() => {
    if (tour.phase !== 'complete') return;
    setClosing(true);
    const id = window.setTimeout(() => setClosing(false), 5200);
    return () => window.clearTimeout(id);
  }, [tour.phase]);

  // the caption sits just above the living score in the studio
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const score = state.scene === 'studio' ? document.querySelector<HTMLElement>('.studio__score') : null;
    if (!score) {
      el.style.removeProperty('--dock');
      return;
    }
    const set = () => el.style.setProperty('--dock', `${Math.round(score.getBoundingClientRect().height)}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(score);
    return () => ro.disconnect();
  }, [state.scene, visible]);

  // the rest of the interface steps back while the camera holds on the discovery
  useEffect(() => {
    document.documentElement.classList.toggle('tour-discovery', tour.focus !== null && state.scene === 'studio');
    return () => document.documentElement.classList.remove('tour-discovery');
  }, [tour.focus, state.scene]);

  if (!visible) return null;

  const paused = tour.paused;
  const ocean = state.story === 'ocean';
  const n = studio.record?.events.length ?? 0;
  const idle = (() => {
    if (paused === 'away') return 'The journey is paused while you look around.';
    if (paused === 'explore') return 'Take your time with this note. Resume when you’re ready.';
    if (paused === 'user') return 'Paused.';
    switch (tour.phase) {
      case 'choosing-record':
        return tour.featured ? 'Choose a side — or wait, and I’ll open the ocean.' : 'Choose a side when you’re ready.';
      case 'first-performance':
      case 'discovery':
        return state.playing && state.playhead !== null ? `Listening · ${ocean ? 'stop' : 'window'} ${state.playhead + 1} of ${n}` : 'Preparing the score…';
      case 'creation':
        return 'Your turn. One idea, if you’d like it:';
      case 'pressing':
        return 'Pressing your record…';
      default:
        return '';
    }
  })();
  const line = speakingCue && !(paused && paused !== 'user') ? voice.text : idle;
  const lastCue = cueById(voice.cueId ?? voice.lastCueId ?? '');
  const inStudio = state.scene === 'studio';

  const next = tour.phase === 'creation' && inStudio && !paused ? tour.next : null;
  const nextButton =
    next === 'draw' && ocean ? (
      <button className="guide__next" onClick={() => { dispatch({ type: 'ocean', patch: { tool: 'draw' } }); tourDirector.nextDone('draw'); }}>
        Draw your own route across the sea <span aria-hidden="true">→</span>
      </button>
    ) : next === 'another-place' && !ocean ? (
      <button className="guide__next" onClick={() => { dispatch({ type: 'land', patch: { placeId: state.land.placeId === 'harvard-forest' ? 'sahel-dahra' : 'harvard-forest' } }); tourDirector.nextDone('another-place'); }}>
        Listen to another place’s year <span aria-hidden="true">→</span>
      </button>
    ) : next === 'press' || (next && next !== (ocean ? 'draw' : 'another-place')) ? (
      <button className="guide__next guide__next--gold" onClick={() => a.press()} disabled={studio.status !== 'ready'}>
        Press my Earth Record <span aria-hidden="true">↗</span>
      </button>
    ) : null;

  return (
    <>
      {tour.focus !== null && inStudio && <DiscoveryThread index={tour.focus} />}
      <aside
        ref={root}
        className={`guide guide--${state.scene}${tour.focus !== null ? ' is-discovery' : ''}${paperScene ? ' guide--paper' : ''}${voice.speaking ? ' is-speaking' : ''}${tour.phase === 'baton-handover' ? ' is-handover' : ''}`}
        role="region"
        aria-label="Narrated journey"
      >
        <div className="guide__card">
          <BeethovenPortrait size={52} tone={paperScene ? 'paper' : 'dark'} speaking={voice.speaking} gesture={tour.phase === 'baton-handover' ? 'baton' : null} className="guide__portrait" />
          <div className="guide__body">
            <div className="guide__meta">
              <span>Your host</span>
              {BEAT[tour.phase] && <span className="guide__beat">{BEAT[tour.phase]}</span>}
              {voice.mode === 'timer' && speakingCue && !paused && <span className="guide__mode">captions</span>}
              {paused && <span className="guide__mode guide__mode--paused">paused</span>}
            </div>
            {/* the spoken line itself is announced once per cue by the director; the caption is visual */}
            <p className="guide__caption" aria-live="off" key={`${voice.cueId}-${voice.phrase}-${line}`}>
              {line}
            </p>
            {nextButton}
            {paused === 'away' && (
              <button className="guide__next" onClick={() => tourDirector.resume()}>
                Resume the journey <span aria-hidden="true">→</span>
              </button>
            )}
            {transcript && lastCue && (
              <ol className="guide__transcript" aria-label="Transcript of the current line">
                {lastCue.phrases.map((p, i) => (
                  <li key={i} className={voice.cueId === lastCue.id && i === voice.phrase ? 'is-now' : ''}>{p.text}</li>
                ))}
              </ol>
            )}
            {settings && <GuideSettings onMusic={(v) => dispatch({ type: 'volume', value: v })} music={state.volume} />}
            <div className="guide__controls">
              {tour.active && paused !== 'away' && (
                <button className="guide__btn" onClick={() => (paused ? tourDirector.resume() : tourDirector.pause('user'))} aria-label={paused ? 'Resume the journey' : 'Pause the journey'}>
                  {paused ? '▶ Resume' : '❚❚ Pause'}
                </button>
              )}
              <button className="guide__btn" onClick={() => narration.replay()} disabled={!voice.lastCueId} aria-label="Replay the line" title="Replay the line">↺ Replay</button>
              <button
                className="guide__btn"
                aria-pressed={narration.settings.voice}
                onClick={() => narration.setSettings({ voice: !narration.settings.voice })}
                aria-label={narration.settings.voice ? 'Turn the voice off (captions continue)' : 'Turn the voice on'}
              >
                {narration.settings.voice ? 'Voice' : 'Muted'}
              </button>
              <button className="guide__btn" aria-expanded={transcript} onClick={() => setTranscript((x) => !x)} aria-label="Transcript" title="Transcript">Text</button>
              <button className="guide__btn" aria-expanded={settings} onClick={() => setSettings((x) => !x)} aria-label="Narration settings" title="Narration settings">Adjust</button>
              {tour.active && (
                <button className="guide__btn guide__btn--end" onClick={() => tourDirector.skip()} aria-label="End the narrated journey" title="End the narrated journey">
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function GuideSettings({ music, onMusic }: { music: number; onMusic: (v: number) => void }) {
  const [, force] = useState(0);
  const s = narration.settings;
  const set = (p: Partial<typeof s>) => {
    narration.setSettings(p);
    force((x) => x + 1);
  };
  const voices = narration.hasRecordedVoice() ? [] : narration.browserVoices();
  return (
    <div className="guide__settings">
      <p className="guide__voice-name">{narration.describeVoice()}</p>
      <label>
        <span>Narration</span>
        <input type="range" min={0} max={1} step={0.05} value={s.level} onChange={(e) => set({ level: Number(e.target.value) })} aria-label="Narration level" />
      </label>
      <label>
        <span>Music</span>
        <input type="range" min={0} max={1} step={0.05} value={music} onChange={(e) => onMusic(Number(e.target.value))} aria-label="Music level" />
      </label>
      <fieldset className="guide__rates">
        <legend>Pace</legend>
        {[0.9, 1, 1.1].map((r) => (
          <button key={r} className="guide__btn" aria-pressed={s.rate === r} onClick={() => set({ rate: r })}>
            {r === 1 ? 'Natural' : r < 1 ? 'Slower' : 'Faster'}
          </button>
        ))}
      </fieldset>
      {voices.length > 1 && (
        <label>
          <span>Voice</span>
          <select value={s.voiceURI ?? ''} onChange={(e) => set({ voiceURI: e.target.value || null })} aria-label="Browser voice">
            <option value="">Best available</option>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

/** The thread from a sample on Earth to its note: one curve, drawn once, following layout. */
function DiscoveryThread({ index }: { index: number }) {
  const [geo, setGeo] = useState<{ d: string; x: number; y: number } | null>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const from = document.querySelector('.atlas__stop.is-selected, .dial__spoke.is-selected');
      const to = document.querySelectorAll('.score__mark')[index] as HTMLElement | undefined;
      if (from && to) {
        const f = from.getBoundingClientRect();
        const t = to.getBoundingClientRect();
        const x1 = f.left + f.width / 2, y1 = f.top + f.height / 2;
        const x2 = t.left + t.width / 2, y2 = t.top + 4;
        const my = (y1 + y2) / 2;
        const d = `M${x1.toFixed(1)} ${y1.toFixed(1)} C${x1.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
        setGeo((g) => (g && g.d === d ? g : { d, x: x1, y: y1 }));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [index]);
  if (!geo) return null;
  return (
    <svg className="thread" aria-hidden="true">
      <path d={geo.d} className="thread__line" pathLength={1} />
      <circle cx={geo.x} cy={geo.y} r={14} className="thread__ripple" />
      <circle cx={geo.x} cy={geo.y} r={14} className="thread__ripple thread__ripple--2" />
    </svg>
  );
}
