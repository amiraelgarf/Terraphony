/**
 * Transport — owns every sound and the ONE clock that drives score, map
 * cursor, year dial and captions.
 *
 * React never touches synths. It loads a Program (the record's events) and
 * receives step callbacks. Two clock modes with the same API:
 *   'audio'  — the AudioContext clock. On play, every remaining note of the
 *              record (a record is ~12 s, 24 events) is handed to the audio
 *              thread at once, at exact times. Nothing on the page's main
 *              thread is involved while it plays, so map redraws, picture
 *              decoding or speech can never delay, bunch up or drop a note.
 *              Step callbacks for the picture fire through Tone.Draw at the
 *              audible moment.
 *   'silent' — a performance.now() clock for visual-only listening (sound off,
 *              unsupported or blocked audio). Everything else keeps working.
 *
 * Pause / seek: the current instruments fade out in 30 ms and are replaced by a
 * fresh set (Voices.renew), which also discards the notes already queued on the
 * audio thread; resume schedules again from the current step. No note is ever
 * double-triggered.
 *
 * Tone.js is imported lazily inside unlock(): importing it creates an
 * AudioContext, and nothing audio-related may exist before a visitor's gesture.
 */
import type * as ToneNS from 'tone';
import type { InstrumentId, MusicEvent } from '../data/types';
import { ALL_LAYERS_ON, createVoices, LAYER_LEVELS, LAYERS, perform, releaseAll, type Layer, type Voices } from './instruments';
import { arrange, type PerformedEvent } from './ensemble';
import { midiToTone } from './normalize';

export type Program = { id: string; events: MusicEvent[]; beatSeconds: number };
export type TransportListener = { onStep: (step: number) => void; onEnd: () => void };
type ClockMode = 'audio' | 'silent';

/** Beats of tail after the last event so the closing chord can ring. */
export const TAIL_BEATS = 3;
const RAMP = 0.08;
/** Small safety margin between pressing play and the first note. */
const START_DELAY = 0.08;

let Tone: typeof ToneNS = null as unknown as typeof ToneNS;

/** Load Tone.js on demand (also used by the WAV export). */
export async function loadTone(): Promise<typeof ToneNS> {
  if (!Tone) Tone = await import('tone');
  return Tone;
}

export class Transport {
  private voices = new Map<InstrumentId, Voices>();
  private palette: InstrumentId = 'glass';
  private program: Program | null = null;
  private performed: PerformedEvent[] = [];
  private listener: TransportListener | null = null;
  private mode: ClockMode = 'silent';
  private playing = false;
  private lastStep = -1;
  private layers: Record<Layer, boolean> = { ...ALL_LAYERS_ON };
  private volume = 0.7;
  /** Paused / stopped position in beats. */
  private offset = 0;
  /** While playing: audio time of `step`'s onset. */
  private anchor = { time: 0, step: 0 };
  private silentStart = 0;
  private silentTimer: number | null = null;
  private lastAudition = -Infinity;

  private unlocked = false;
  private preparing: number | null = null;

  get audioReady() {
    return this.unlocked;
  }
  get clockMode() {
    return this.mode;
  }
  get programId() {
    return this.program?.id ?? null;
  }
  isPlaying() {
    return this.playing;
  }

  /** Call only from a user gesture. Resolves true if sound is available. */
  async unlock(): Promise<boolean> {
    try {
      if (typeof window === 'undefined' || !(window.AudioContext || (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext)) return false;
      await loadTone();
      await Tone.start();
      if (Tone.getContext().state !== 'running') return false;
      Tone.getDraw().expiration = 5; // a long page block never drops a step / end callback
      this.unlocked = true;
      // building an orchestra is heavy: do it in the next idle moment, never during the
      // click's own animation (play() builds on the spot if it comes first)
      this.prepare(this.palette);
      return true;
    } catch {
      return false;
    }
  }

  private ensureVoices(id: InstrumentId) {
    if (!this.voices.has(id)) {
      const v = createVoices(Tone, id);
      v.output.toDestination();
      this.voices.set(id, v);
      this.applyMix(v, true);
    }
    return this.voices.get(id)!;
  }

  private get v(): Voices | null {
    return this.unlocked ? this.ensureVoices(this.palette) : null;
  }

  /** Build a palette's instruments when the page is idle. */
  private prepare(id: InstrumentId) {
    if (!this.unlocked || this.voices.has(id) || typeof window === 'undefined') return;
    if (this.preparing !== null) return;
    const run = () => {
      this.preparing = null;
      this.ensureVoices(id);
      if (id !== this.palette) this.prepare(this.palette);
    };
    // wait for any scene transition to finish (~1.7 s), then use the next idle moment
    this.preparing = window.setTimeout(() => {
      if (window.requestIdleCallback) window.requestIdleCallback(run, { timeout: 3000 });
      else run();
    }, 1800);
  }

  setMode(mode: ClockMode) {
    const want: ClockMode = mode === 'audio' && this.audioReady ? 'audio' : 'silent';
    if (want === this.mode) return;
    const pos = Math.floor(this.position());
    this.stop();
    this.mode = want;
    if (this.program && this.listener) this.load(this.program, this.listener, pos, false);
  }

  setPalette(id: InstrumentId) {
    if (id === this.palette) return;
    const was = this.playing;
    if (was) this.pause();
    this.release();
    this.palette = id;
    if (was) this.play();
    else this.prepare(id);
  }

  load(program: Program, listener: TransportListener, startStep = 0, emit = true) {
    this.stop();
    this.program = program;
    this.performed = arrange(program.events);
    this.listener = listener;
    this.lastStep = -1;
    this.seekInternal(startStep, emit);
  }

  /** Swap listener without touching playback (React re-renders). */
  rebind(listener: TransportListener) {
    this.listener = listener;
  }

  play() {
    if (!this.program || this.playing) return;
    const n = this.program.events.length;
    if (Math.floor(this.offset) >= n) this.seekInternal(0);
    const from = Math.max(0, Math.min(n - 1, Math.floor(this.offset)));
    this.playing = true;
    if (this.mode === 'audio' && this.v) {
      const t0 = Tone.immediate() + START_DELAY;
      this.anchor = { time: t0, step: from };
      this.lastStep = from - 1;
      this.scheduleFrom(from, t0);
    } else {
      this.offset = from;
      this.silentStart = performance.now();
      this.silentTimer = window.setInterval(() => this.silentTick(), 20);
      this.silentTick();
    }
  }

  pause() {
    if (!this.playing) return;
    this.offset = this.position();
    this.playing = false;
    this.clearTimer();
    this.cancelDraw();
    this.release();
  }

  stop() {
    this.playing = false;
    this.clearTimer();
    this.cancelDraw();
    this.release();
  }

  seek(step: number) {
    const was = this.playing;
    if (was) this.pause();
    this.seekInternal(step);
    if (was) this.play();
  }

  /** Fractional playhead in beats — the single source of truth for animation. */
  position(): number {
    const beat = this.program?.beatSeconds ?? 0.5;
    if (!this.playing) return this.offset;
    if (this.mode === 'audio' && this.audioReady) return Math.max(this.anchor.step, this.anchor.step + (Tone.immediate() - this.anchor.time) / beat);
    return this.offset + (performance.now() - this.silentStart) / 1000 / beat;
  }

  setLayers(on: Record<Layer, boolean>) {
    this.layers = { ...on };
    this.voices.forEach((v) => this.applyMix(v));
  }

  setVolume(v: number) {
    this.volume = v;
    this.voices.forEach((x) => this.applyMix(x));
  }

  private applyMix(v: Voices, immediate = false) {
    for (const l of LAYERS) {
      const g = this.layers[l] ? LAYER_LEVELS[l] : 0;
      if (immediate) v.buses[l].gain.value = g;
      else v.buses[l].gain.rampTo(g, RAMP);
    }
    // make-up gain: at the default 70 % the full orchestra peaks around -4 dBFS (headroom: the limiter never works)
    const db = this.volume <= 0.001 ? -Infinity : 20 * Math.log10(this.volume) + 8;
    if (immediate) v.master.volume.value = db;
    else v.master.volume.rampTo(db, RAMP);
  }

  /** One original struck tone to open the journey. */
  chime() {
    const v = this.v;
    if (!v || this.mode !== 'audio') return;
    const t = Tone.immediate() + 0.03;
    v.set.lead.triggerAttackRelease('G4', 1.6, t, 0.55);
    v.set.lead.triggerAttackRelease('C5', 1.8, t + 0.18, 0.4);
  }

  /** One note on demand (inspecting a score mark). At most ~5 per second. */
  audition(midi: number | null) {
    // a preview never builds the orchestra on the spot (that would stall the page)
    const v = this.unlocked ? this.voices.get(this.palette) ?? null : null;
    if (!v || this.mode !== 'audio' || midi === null) return;
    const now = performance.now();
    if (now - this.lastAudition < 300) return;
    this.lastAudition = now;
    v.set.lead.triggerAttackRelease(midiToTone(midi), 0.45, Tone.immediate() + 0.01, 0.75);
  }

  /**
   * Short phrase for the press (beat II): the visitor's own melody in miniature — every
   * third note as a harp pluck, spaced so no harp voice is retriggered while it sounds.
   */
  phrase(midis: (number | null)[], spacing = 0.14) {
    const v = this.v;
    if (!v || this.mode !== 'audio') return;
    const t0 = Tone.immediate() + 0.02;
    midis
      .filter((_, i) => i % 3 === 0)
      .forEach((m, i) => {
        if (m !== null) v.set.harp.triggerAttackRelease(midiToTone(m), 0.1, t0 + i * spacing, 0.6);
      });
  }

  stylus() {
    const v = this.v;
    if (!v || this.mode !== 'audio') return;
    v.thump.triggerAttackRelease('C2', 0.12, Tone.immediate() + 0.01, 0.6);
  }

  chord(midis: number[]) {
    const v = this.v;
    if (!v || this.mode !== 'audio') return;
    v.set.cadence.triggerAttackRelease(midis.map(midiToTone), 2.4, Tone.immediate() + 0.02, 0.4);
  }

  /* ------------------------------------------------------------------ */

  private seekInternal(step: number, emit = true) {
    const n = this.program?.events.length ?? 0;
    const s = Math.max(0, Math.min(n, step));
    this.release();
    this.offset = s;
    this.lastStep = s - 1;
    if (emit && s < n) this.listener?.onStep(s);
  }

  /** Hand every remaining note to the audio thread now, at exact times. */
  private scheduleFrom(from: number, t0: number) {
    const p = this.program!;
    const v = this.v!;
    const beat = p.beatSeconds;
    const draw = Tone.getDraw();
    for (let k = from; k < this.performed.length; k++) {
      const time = t0 + (k - from) * beat;
      perform(Tone, v, this.performed[k], time, beat);
      draw.schedule(() => this.emit(k), time);
    }
    draw.schedule(() => this.finish(), t0 + (p.events.length - from + TAIL_BEATS) * beat);
  }

  private cancelDraw() {
    if (this.audioReady) Tone.getDraw().cancel(0);
  }

  private emit(k: number) {
    if (!this.playing || k === this.lastStep) return;
    this.lastStep = k;
    this.listener?.onStep(k);
  }

  private silentTick() {
    if (!this.program) return;
    const pos = this.position();
    const k = Math.floor(pos);
    if (pos >= this.program.events.length + TAIL_BEATS) return this.finish();
    if (k < this.program.events.length && k !== this.lastStep) this.emit(k);
  }

  private finish() {
    if (!this.playing) return;
    this.playing = false;
    this.clearTimer();
    this.release(false); // let the closing chord ring
    this.offset = this.program?.events.length ?? 0;
    this.listener?.onEnd();
  }

  /**
   * Silence what is sounding. With `renew`, the instruments are swapped for fresh
   * ones, which also discards notes already queued on the audio thread.
   */
  private release(renew = true) {
    if (!this.audioReady) return;
    const now = Tone.immediate();
    this.voices.forEach((v) => (renew ? v.renew() : releaseAll(v, now)));
  }

  private clearTimer() {
    if (this.silentTimer !== null) window.clearInterval(this.silentTimer);
    this.silentTimer = null;
  }
}

export const transport = new Transport();
