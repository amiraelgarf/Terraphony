/**
 * Transport — owns every sound and the ONE clock that drives score, map
 * cursor, year dial and captions.
 *
 * React never touches synths. It loads a Program (the record's events) and
 * receives step callbacks. Two clock modes with the same API:
 *   'audio'  — Tone.js Transport; events scheduled ahead on the audio clock,
 *              step callbacks fired through Tone.Draw at the audible moment.
 *   'silent' — a performance.now() clock for visual-only listening (sound off,
 *              unsupported or blocked audio). Everything else keeps working.
 *
 * Pause/seek/resume release voices and reschedule from the transport
 * position, so no note is ever double-triggered.
 *
 * Tone.js is imported lazily inside unlock(): importing it creates an
 * AudioContext, and nothing audio-related may exist before a visitor's gesture.
 */
import type * as ToneNS from 'tone';
import type { InstrumentId, MusicEvent } from '../data/types';
import { createVoices, LAYER_LEVELS, LAYERS, type Layer, type Voices } from './instruments';
import { midiToTone } from './normalize';

export type Program = { id: string; events: MusicEvent[]; beatSeconds: number };
export type TransportListener = { onStep: (step: number) => void; onEnd: () => void };
type ClockMode = 'audio' | 'silent';

/** Beats of tail after the last event so the closing chord can ring. */
export const TAIL_BEATS = 3;
const RAMP = 0.08;

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
  private listener: TransportListener | null = null;
  private mode: ClockMode = 'silent';
  private playing = false;
  private lastStep = -1;
  private ids: number[] = [];
  private layers: Record<Layer, boolean> = { lead: true, bass: true, accent: true, cadence: true };
  private volume = 0.7;
  private silentStart = 0;
  private silentOffset = 0;
  private silentTimer: number | null = null;
  private lastAudition = -Infinity;

  get audioReady() {
    return this.voices.size > 0;
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
      this.ensureVoices(this.palette);
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
    return this.voices.get(this.palette) ?? null;
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
    this.release();
    this.palette = id;
    if (this.audioReady) this.ensureVoices(id);
  }

  load(program: Program, listener: TransportListener, startStep = 0, emit = true) {
    this.stop();
    this.program = program;
    this.listener = listener;
    this.lastStep = -1;
    if (this.mode === 'audio') {
      Tone.getTransport().bpm.value = 60 / program.beatSeconds;
      this.schedule();
    }
    this.seekInternal(startStep, emit);
  }

  /** Swap listener without touching playback (React re-renders). */
  rebind(listener: TransportListener) {
    this.listener = listener;
  }

  play() {
    if (!this.program || this.playing) return;
    if (Math.floor(this.position()) >= this.program.events.length) this.seekInternal(0);
    this.playing = true;
    if (this.mode === 'audio') Tone.getTransport().start('+0.05');
    else {
      this.silentStart = performance.now();
      this.silentTimer = window.setInterval(() => this.silentTick(), 20);
      this.silentTick();
    }
  }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    if (this.mode === 'audio') Tone.getTransport().pause();
    else {
      this.silentOffset = this.position();
      this.clearTimer();
    }
    this.release();
  }

  stop() {
    this.playing = false;
    this.clearTimer();
    if (this.audioReady) {
      const t = Tone.getTransport();
      t.stop();
      this.ids.forEach((id) => t.clear(id));
      this.ids = [];
      t.cancel(0);
    }
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
    if (this.mode === 'audio' && this.audioReady) {
      // Transport time runs one look-ahead ahead of what is audible.
      const s = Tone.getTransport().seconds - (this.playing ? Tone.getContext().lookAhead : 0);
      return Math.max(0, s / beat);
    }
    if (!this.playing) return this.silentOffset;
    return this.silentOffset + (performance.now() - this.silentStart) / 1000 / beat;
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
    const db = this.volume <= 0.001 ? -Infinity : 20 * Math.log10(this.volume) - 8;
    if (immediate) v.master.volume.value = db;
    else v.master.volume.rampTo(db, RAMP);
  }

  /** One note on demand (inspecting a score mark). At most ~5 per second. */
  audition(midi: number | null) {
    const v = this.v;
    if (!v || this.mode !== 'audio' || midi === null) return;
    const now = performance.now();
    if (now - this.lastAudition < 180) return;
    this.lastAudition = now;
    v.lead.triggerAttackRelease(midiToTone(midi), 0.45, Tone.now() + 0.01, 0.75);
  }

  /** Short phrase for the press (beat II): the visitor's own notes, quickly. */
  phrase(midis: (number | null)[], spacing = 0.07) {
    const v = this.v;
    if (!v || this.mode !== 'audio') return;
    const t0 = Tone.now() + 0.02;
    midis.forEach((m, i) => {
      if (m !== null) v.lead.triggerAttackRelease(midiToTone(m), 0.25, t0 + i * spacing, 0.45);
    });
  }

  stylus() {
    const v = this.v;
    if (!v || this.mode !== 'audio') return;
    v.thump.triggerAttackRelease('C2', 0.12, Tone.now() + 0.01, 0.6);
  }

  chord(midis: number[]) {
    const v = this.v;
    if (!v || this.mode !== 'audio') return;
    v.cadence.triggerAttackRelease(midis.map(midiToTone), 2.4, Tone.now() + 0.02, 0.4);
  }

  /* ------------------------------------------------------------------ */

  private seekInternal(step: number, emit = true) {
    const n = this.program?.events.length ?? 0;
    const s = Math.max(0, Math.min(n, step));
    this.release();
    const beat = this.program?.beatSeconds ?? 0.5;
    if (this.mode === 'audio') Tone.getTransport().seconds = s * beat;
    else this.silentOffset = s;
    this.lastStep = s - 1;
    if (emit && s < n) this.listener?.onStep(s);
  }

  private schedule() {
    const t = Tone.getTransport();
    const draw = Tone.getDraw();
    const p = this.program!;
    p.events.forEach((e, k) => {
      this.ids.push(
        t.schedule((time) => {
          this.playEvent(e, time, p.beatSeconds);
          draw.schedule(() => this.emit(k), time);
        }, k * p.beatSeconds),
      );
    });
    this.ids.push(t.schedule((time) => draw.schedule(() => this.finish(), time), (p.events.length + TAIL_BEATS) * p.beatSeconds));
  }

  private playEvent(e: MusicEvent, time: number, beat: number) {
    const v = this.v;
    if (!v) return;
    if (e.midiNote !== null) v.lead.triggerAttackRelease(midiToTone(e.midiNote), beat * 0.92, time, 0.72);
    for (const s of e.supportingEvents) {
      if (s.instrumentId === 'bass' && s.midiNote !== undefined) v.bass.triggerAttackRelease(midiToTone(s.midiNote), beat * 3.7, time, s.velocity ?? 0.6);
      if (s.instrumentId === 'accent') v.accent.triggerAttackRelease(0.05, time + 0.002, s.velocity ?? 0.6);
      if (s.instrumentId === 'cadence' && s.midiNotes) v.cadence.triggerAttackRelease(s.midiNotes.map(midiToTone), beat * 3, time + beat, s.velocity ?? 0.35);
    }
  }

  private emit(k: number) {
    if (k === this.lastStep) return;
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
    if (this.mode === 'audio') Tone.getTransport().pause();
    this.release();
    this.silentOffset = this.program?.events.length ?? 0;
    this.listener?.onEnd();
  }

  private release() {
    const now = this.audioReady ? Tone.now() : 0;
    this.voices.forEach((v) => {
      v.lead.releaseAll(now);
      v.bass.triggerRelease(now);
      v.cadence.releaseAll(now);
    });
  }

  private clearTimer() {
    if (this.silentTimer !== null) window.clearInterval(this.silentTimer);
    this.silentTimer = null;
  }
}

export const transport = new Transport();
