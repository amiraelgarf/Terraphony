/**
 * AudioEngine — owns every sound and the one clock that drives the scanner.
 *
 * React never touches synths. It hands the engine a Program (one step per
 * beat) and receives step callbacks. The same clock drives sound, cursor,
 * timeline and inspector, so they cannot drift apart.
 *
 * Two clock modes, identical API:
 *   'audio'  — Tone.js Transport; steps fire via Tone.Draw at audible time.
 *   'silent' — a performance.now() clock for visual-only use (sound off,
 *              or audio blocked). Map, notes and values keep working.
 */
import * as Tone from 'tone';
import { BEAT_SECONDS, LAYERS, type Layer, type Program } from '../domain/sonification';
import { createInstruments, LAYER_LEVELS, PAD_CHORD, type Instruments } from './instruments';

export type EngineListener = {
  onStep: (step: number) => void;
  onEnd: () => void;
};

type ClockMode = 'audio' | 'silent';

/** Minimum gap between auditioned probe notes: at most 4 notes per second. */
export const AUDITION_MIN_GAP_MS = 250;
const GAIN_RAMP_S = 0.08;

export class AudioEngine {
  private inst: Instruments | null = null;
  private program: Program | null = null;
  private listener: EngineListener | null = null;
  private mode: ClockMode = 'silent';
  private padOn = false;
  private playing = false;
  private lastStep = -1;
  private transportIds: number[] = [];

  // silent clock
  private silentStartMs = 0;
  private silentOffsetSteps = 0;
  private silentTimer: number | null = null;

  // audition rate limiting
  private lastAuditionMs = -Infinity;
  private pendingAudition: number | null = null;

  get audioReady(): boolean {
    return this.inst !== null;
  }

  /**
   * Must be called from inside a user gesture. Resolves true when the
   * AudioContext is running and instruments exist.
   */
  async unlock(): Promise<boolean> {
    try {
      await Tone.start();
      if (Tone.getContext().state !== 'running') return false;
      if (!this.inst) this.inst = createInstruments();
      Tone.getTransport().bpm.value = 96;
      return true;
    } catch {
      return false;
    }
  }

  /** Choose sound or visual-only. Switching stops current playback cleanly. */
  setMode(mode: ClockMode) {
    const want: ClockMode = mode === 'audio' && this.inst ? 'audio' : 'silent';
    if (want === this.mode) return;
    const pos = Math.floor(this.position());
    this.stop();
    this.mode = want;
    // Reload silently: a clock switch must not move the visitor's selection.
    if (this.program) this.load(this.program, this.listener!, pos, false);
  }

  get clockMode(): ClockMode {
    return this.mode;
  }

  /** Replace the program. Cancels everything previously scheduled. */
  load(program: Program, listener: EngineListener, startStep = 0, emit = true) {
    this.stop();
    this.program = program;
    this.listener = listener;
    this.lastStep = -1;
    if (this.mode === 'audio') this.scheduleTransport();
    this.seekInternal(startStep, emit);
  }

  get loadedProgramId(): string | null {
    return this.program?.id ?? null;
  }

  play() {
    if (!this.program || this.playing) return;
    if (Math.floor(this.position()) >= this.program.steps.length) this.seekInternal(0);
    this.playing = true;
    if (this.mode === 'audio') {
      Tone.getTransport().start();
    } else {
      this.silentStartMs = performance.now();
      this.silentTimer = window.setInterval(() => this.silentTick(), 25);
      this.silentTick();
    }
  }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    if (this.mode === 'audio') {
      Tone.getTransport().pause();
      this.releaseVoices();
    } else {
      this.silentOffsetSteps = this.position();
      this.clearSilentTimer();
    }
  }

  /** Stop and cancel all scheduled events (mode switch, unmount, new program). */
  stop() {
    this.playing = false;
    this.clearSilentTimer();
    // Only touch Tone once audio was unlocked, so nothing creates an AudioContext before consent.
    if (this.inst) {
      const t = Tone.getTransport();
      t.stop();
      this.transportIds.forEach((id) => t.clear(id));
      this.transportIds = [];
      t.cancel(0);
    }
    this.releaseVoices();
    if (this.pendingAudition !== null) window.clearTimeout(this.pendingAudition);
    this.pendingAudition = null;
  }

  /** Jump to a step. Resumes only if it was playing. */
  seek(step: number) {
    const was = this.playing;
    if (was) this.pause();
    this.seekInternal(step);
    if (was) this.play();
  }

  isPlaying() {
    return this.playing;
  }

  /** Fractional playhead in steps, for smooth cursor interpolation. */
  position(): number {
    if (this.mode === 'audio') {
      const s = Tone.getTransport().seconds - (this.playing ? Tone.getContext().lookAhead : 0);
      return Math.max(0, s / BEAT_SECONDS);
    }
    if (!this.playing) return this.silentOffsetSteps;
    return this.silentOffsetSteps + (performance.now() - this.silentStartMs) / 1000 / BEAT_SECONDS;
  }

  /** One short note for Probe / "Hear the rule". Capped at 4 notes per second. */
  audition(note: string, opts: { accent?: boolean; bass?: string | null } = {}) {
    if (!this.inst || this.mode !== 'audio') return;
    const now = performance.now();
    const fire = () => {
      this.lastAuditionMs = performance.now();
      this.pendingAudition = null;
      const t = Tone.now() + 0.01;
      this.inst!.melody.triggerAttackRelease(note, '8n', t, 0.8);
      if (opts.bass) this.inst!.bass.triggerAttackRelease(opts.bass, '4n', t, 0.6);
      if (opts.accent) this.inst!.rhythm.triggerAttackRelease('A2', '32n', t, 0.6);
    };
    const wait = this.lastAuditionMs + AUDITION_MIN_GAP_MS - now;
    if (this.pendingAudition !== null) window.clearTimeout(this.pendingAudition);
    if (wait <= 0) fire();
    else this.pendingAudition = window.setTimeout(fire, wait);
  }

  /** Effective layer gains (after solo/mute). Smooth ramps, no clicks. */
  setLayers(on: Record<Layer, boolean>) {
    if (!this.inst) return;
    for (const l of LAYERS) this.inst.buses[l].gain.rampTo(on[l] ? LAYER_LEVELS[l] : 0, GAIN_RAMP_S);
  }

  /** Master volume 0..1 (0 = muted). */
  setVolume(v: number) {
    if (!this.inst) return;
    const db = v <= 0.001 ? -Infinity : 20 * Math.log10(v) - 6;
    this.inst.master.volume.rampTo(db, GAIN_RAMP_S);
  }

  /* -------------------------------------------------------------- */

  private seekInternal(step: number, emit = true) {
    const max = this.program?.steps.length ?? 0;
    const s = Math.max(0, Math.min(max, step));
    this.releaseVoices();
    if (this.mode === 'audio') Tone.getTransport().seconds = s * BEAT_SECONDS;
    else this.silentOffsetSteps = s;
    this.lastStep = s - 1;
    if (emit && s < max) this.listener?.onStep(s);
  }

  private scheduleTransport() {
    const t = Tone.getTransport();
    const draw = Tone.getDraw();
    const program = this.program!;
    program.steps.forEach((_step, k) => {
      const id = t.schedule((time) => {
        this.playStep(k, time);
        draw.schedule(() => this.emitStep(k), time);
      }, k * BEAT_SECONDS);
      this.transportIds.push(id);
    });
    const endId = t.schedule((time) => {
      draw.schedule(() => this.finish(), time);
    }, program.steps.length * BEAT_SECONDS);
    this.transportIds.push(endId);
  }

  private playStep(k: number, time: number) {
    const inst = this.inst;
    const step = this.program?.steps[k];
    if (!inst || !step) return;
    if (step.layers.atmosphere && !this.padOn) {
      inst.pad.triggerAttack(PAD_CHORD, time, 0.5);
      this.padOn = true;
    }
    const e = step.event;
    if (!e) return;
    const dur = BEAT_SECONDS * 0.9;
    if (e.note && step.layers.melody) inst.melody.triggerAttackRelease(e.note, dur, time, 0.75);
    if (e.bassOnset && e.bassNote && step.layers.bass) inst.bass.triggerAttackRelease(e.bassNote, BEAT_SECONDS * 3.6, time, 0.6);
    if (e.accent && step.layers.rhythm) inst.rhythm.triggerAttackRelease('A2', '32n', time + 0.001, 0.55);
  }

  private emitStep(k: number) {
    if (k === this.lastStep) return;
    this.lastStep = k;
    this.listener?.onStep(k);
  }

  private silentTick() {
    if (!this.program) return;
    const pos = this.position();
    const k = Math.floor(pos);
    if (k >= this.program.steps.length) {
      this.finish();
      return;
    }
    if (k !== this.lastStep) this.emitStep(k);
  }

  private finish() {
    if (!this.playing) return;
    this.playing = false;
    this.clearSilentTimer();
    if (this.mode === 'audio') Tone.getTransport().pause();
    this.releaseVoices();
    this.silentOffsetSteps = this.program?.steps.length ?? 0;
    this.listener?.onEnd();
  }

  private releaseVoices() {
    if (!this.inst) return;
    const now = Tone.now();
    this.inst.melody.releaseAll(now);
    this.inst.bass.triggerRelease(now);
    if (this.padOn) this.inst.pad.releaseAll(now);
    this.padOn = false;
  }

  private clearSilentTimer() {
    if (this.silentTimer !== null) window.clearInterval(this.silentTimer);
    this.silentTimer = null;
  }
}

/** The single engine instance (audio nodes live outside React). */
export const engine = new AudioEngine();
