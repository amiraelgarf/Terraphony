/**
 * AudioTransport — play/pause/stop, clock, and a timeline of the real events.
 *
 * Each tick is one program step: its height is the note's position in the
 * scale, hollow ticks are rests, a dot marks a rhythm accent. Ticks are a
 * roving-tabindex toolbar: arrows move, Enter opens "Why this note?".
 */
import { Info, Pause, Play, Square, Volume2, VolumeX } from 'lucide-react';
import { useMemo, useRef, type KeyboardEvent } from 'react';
import { fmtClock, fmtPosition, fmtValue } from '../app/format';
import { useJukebox } from '../app/JukeboxContext';
import { COPY } from '../content/microcopy.en';
import { PITCHES } from '../domain/sonification';

export function AudioTransport({ compact = false }: { compact?: boolean }) {
  const { state, derived, actions } = useJukebox();
  const program = useMemo(() => (state.program ? derived.buildProgram(state.program.spec) : null), [state.program, derived]);
  const tickRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const playing = state.playback === 'playing';
  const total = program?.steps.length ?? 0;
  const current = state.step ?? 0;

  const focusTick = (k: number) => {
    const n = Math.max(0, Math.min(total - 1, k));
    actions.seek(n);
    tickRefs.current[n]?.focus();
  };

  const onTickKey = (e: KeyboardEvent<HTMLButtonElement>, k: number) => {
    const map: Record<string, number> = { ArrowRight: k + 1, ArrowLeft: k - 1, Home: 0, End: total - 1, PageUp: k - 8, PageDown: k + 8 };
    if (e.key in map) {
      e.preventDefault();
      focusTick(map[e.key]);
    }
  };

  const tickLabel = (k: number) => {
    const s = program!.steps[k];
    if (!s.event) return `Step ${k + 1}: silence between excerpts`;
    const e = s.event;
    const where = fmtPosition(e.source.position);
    const tag = s.marker ? `frame ${s.marker}, ` : '';
    if (!e.note) return `Step ${k + 1}, ${tag}route point ${e.index + 1}: rest (${e.source.invalidReason ?? 'no data'}), ${where}`;
    return `Step ${k + 1}, ${tag}route point ${e.index + 1}: note ${e.note}, value ${fmtValue(e.source.quantity!.value)}${e.accent ? ', accent' : ''}, ${where}`;
  };

  return (
    <section className={`transport ${compact ? 'is-compact' : ''}`} aria-label="Playback">
      <div className="transport-row">
        <div className="transport-buttons">
          <button type="button" className="btn btn-primary btn-round" onClick={() => void actions.togglePlay()} aria-label={playing ? 'Pause' : 'Play'} title={playing ? 'Pause' : 'Play'} disabled={!program && state.route === 'story'}>
            {playing ? <Pause size={18} strokeWidth={1.6} /> : <Play size={18} strokeWidth={1.6} />}
          </button>
          <button type="button" className="icon-btn" onClick={actions.stop} aria-label="Stop and return to the start" title="Stop" disabled={!program}>
            <Square size={14} strokeWidth={1.6} />
          </button>
        </div>
        <div className="transport-time num" aria-label={`Position ${fmtClock(current)} of ${fmtClock(total)}`}>
          <span>{fmtClock(current)}</span>
          <span className="muted"> / {fmtClock(total)}</span>
        </div>
        <div className="transport-meta">
          <span className="muted">{derived.routeLabel}</span>
          <span className="muted"> · 96 BPM · {total} steps</span>
        </div>
        <button type="button" className="btn btn-quiet" onClick={actions.whyThisNote} disabled={state.selection === null}>
          <Info size={15} strokeWidth={1.6} aria-hidden="true" /> {COPY.inspectorTrigger}
        </button>
        <div className="volume">
          <button type="button" className="icon-btn" onClick={() => actions.setVolume(state.volume > 0 ? 0 : 0.8)} aria-label={state.volume > 0 ? 'Mute' : 'Unmute'} title={state.volume > 0 ? 'Mute' : 'Unmute'}>
            {state.volume > 0 ? <Volume2 size={16} strokeWidth={1.6} /> : <VolumeX size={16} strokeWidth={1.6} />}
          </button>
          <input type="range" min={0} max={1} step={0.05} value={state.volume} onChange={(e) => actions.setVolume(Number(e.target.value))} aria-label="Volume" />
        </div>
      </div>

      {program && (
        <div className="timeline" role="toolbar" aria-label="Note timeline. Use arrow keys to move between steps, Enter to explain a note.">
          {program.steps.map((s, k) => {
            const e = s.event;
            const idx = e?.note ? PITCHES.indexOf(e.note as (typeof PITCHES)[number]) : -1;
            const active = k === state.step;
            return (
              <button
                key={k}
                ref={(el) => (tickRefs.current[k] = el)}
                type="button"
                tabIndex={active || (state.step === null && k === 0) ? 0 : -1}
                className={`tick ${active ? 'is-active' : ''} ${!e ? 'is-gap' : !e.note ? 'is-rest' : ''} ${s.marker ? `marker-${s.marker}` : ''}`}
                aria-label={tickLabel(k)}
                aria-current={active ? 'step' : undefined}
                onClick={() => actions.inspectStep(k)}
                onKeyDown={(ev) => {
                  onTickKey(ev, k);
                  if (ev.key === 'Enter') actions.inspectStep(k);
                }}
              >
                {e?.note && <span className="tick-bar" style={{ height: `${20 + idx * 8}%` }} />}
                {e && !e.note && <span className="tick-rest" />}
                {e?.accent && <span className="tick-accent" />}
              </button>
            );
          })}
        </div>
      )}
      {program?.steps.some((s) => s.marker) && (
        <p className="timeline-key muted">
          <span className="key-a">A</span> {derived.frames.A.captureOrModelTimeUTC?.slice(0, 10)} · then a short silence · <span className="key-b">B</span> {derived.frames.B.captureOrModelTimeUTC?.slice(0, 10)}
        </p>
      )}
    </section>
  );
}
