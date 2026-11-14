/**
 * Transport — owns every sound and the ONE clock that drives score, map
 * cursor, year dial and captions.
 *
 * React never touches audio. It loads a Program (the record's events) and
 * receives step callbacks. Two clock modes with the same API:
 *   'audio'  — the record's orchestra is RENDERED in a background worker
 *              (dsp.ts: five stereo stems, one per mixer layer) and PLAYED BACK
 *              from buffers on the AudioContext clock. Nothing is synthesised live:
 *              playback of a buffer is the cheapest, steadiest sound a browser can
 *              make, so a busy computer cannot cause gaps, crackles or cut-outs.
 *   'silent' — a performance.now() clock for visual-only listening (sound off,
 *              unsupported or blocked audio). Everything else keeps working.
 *
 * Mixer: stem -> session fade -> layer gain (mute/solo) -> master (volume) -> speakers.
 * Pause / seek: the playing session fades out in 40 ms (no click) and stops;
 * play starts a new session at the exact offset.
 *
 * The AudioContext is created only inside unlock(), i.e. inside a visitor's gesture.
 */
import type { InstrumentId, MusicEvent } from '../data/types';
import { ALL_LAYERS_ON, LAYERS, type Layer } from './instruments';
import { renderOneShot, type Palette, type Rendered } from './dsp';
import { renderRecord } from './renderClient';

export type Program = { id: string; events: MusicEvent[]; beatSeconds: number };
export type TransportListener = { onStep: (step: number) => void; onEnd: () => void };
type ClockMode = 'audio' | 'silent';
type Session = { sources: AudioBufferSourceNode[]; fades: GainNode[] };

/** Beats of tail after the last event so the closing chord can ring. */
export const TAIL_BEATS = 3;
const START_DELAY = 0.06;
const FADE = 0.04;

export class Transport {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private layerGain: Partial<Record<Layer, GainNode>> = {};
  private fx: GainNode | null = null;
  private palette: InstrumentId = 'glass';
  private program: Program | null = null;
  private listener: TransportListener | null = null;
  private mode: ClockMode = 'silent';
  private playing = false;
  private started = false;
  private lastStep = -1;
  private layers: Record<Layer, boolean> = { ...ALL_LAYERS_ON };
  private volume = 0.7;
  private offset = 0;
  private anchor = { time: 0, step: 0 };
  private silentStart = 0;
  private timer: number | null = null;
  private session: Session | null = null;
  private renders = new Map<string, Promise<AudioBuffer[]>>();
  private oneShots = new Map<string, AudioBuffer>();
  private lastAudition = -Infinity;
  private playToken = 0;

  get audioReady() {
    return this.ctx !== null && this.ctx.state === 'running';
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
      if (typeof window === 'undefined') return false;
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return false;
      if (!this.ctx) {
        // 'playback': larger output buffers — steadier sound for pre-rendered music
        this.ctx = new AC({ latencyHint: 'playback' });
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        for (const l of LAYERS) {
          const g = this.ctx.createGain();
          g.connect(this.master);
          this.layerGain[l] = g;
        }
        this.fx = this.ctx.createGain();
        this.fx.connect(this.master);
        this.applyMix(true);
      }
      if (this.ctx.state !== 'running') await this.ctx.resume();
      if (this.ctx.state !== 'running') return false;
      this.prepare();
      return true;
    } catch {
      return false;
    }
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
    this.palette = id;
    this.prepare();
    if (was) this.play();
  }

  load(program: Program, listener: TransportListener, startStep = 0, emit = true) {
    this.stop();
    this.program = program;
    this.listener = listener;
    this.lastStep = -1;
    this.seekInternal(startStep, emit);
    this.prepare();
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
    this.offset = from;
    this.playing = true;
    this.lastStep = from - 1;
    if (this.mode === 'audio' && this.ctx) {
      // start as soon as the rendered orchestra is ready (usually it already is)
      const token = ++this.playToken;
      this.started = false;
      this.buffers()
        .then((bufs) => {
          if (token !== this.playToken || !this.playing || !this.ctx) return;
          this.startSession(bufs, from);
        })
        .catch(() => {
          // rendering failed: keep the picture going on the silent clock
          if (token !== this.playToken || !this.playing) return;
          this.mode = 'silent';
          this.silentStart = performance.now();
          this.startTimer();
        });
    } else {
      this.silentStart = performance.now();
      this.startTimer();
    }
  }

  pause() {
    if (!this.playing) return;
    this.offset = this.position();
    this.playing = false;
    this.playToken++;
    this.clearTimer();
    this.endSession();
  }

  stop() {
    this.playing = false;
    this.playToken++;
    this.clearTimer();
    this.endSession();
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
    if (this.mode === 'audio' && this.ctx) {
      if (!this.started) return this.offset;
      const heard = this.ctx.currentTime - (this.ctx.outputLatency || 0);
      return Math.max(this.anchor.step, this.anchor.step + (heard - this.anchor.time) / beat);
    }
    return this.offset + (performance.now() - this.silentStart) / 1000 / beat;
  }

  setLayers(on: Record<Layer, boolean>) {
    this.layers = { ...on };
    this.applyMix();
  }

  setVolume(v: number) {
    this.volume = v;
    this.applyMix();
  }

  private applyMix(immediate = false) {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const set = (p: AudioParam, v: number) => {
      p.cancelScheduledValues(now);
      if (immediate) p.setValueAtTime(v, now);
      else {
        p.setValueAtTime(p.value, now);
        p.linearRampToValueAtTime(v, now + 0.08);
      }
    };
    for (const l of LAYERS) set(this.layerGain[l]!.gain, this.layers[l] ? 1 : 0);
    // the rendered mix peaks at -3 dBFS; the default 70 % plays it as rendered
    set(this.master.gain, Math.min(1.25, Math.pow(this.volume / 0.7, 1.5)));
  }

  /* --------------------------- one-shots ----------------------------- */

  private shot(key: string, make: () => [Float32Array, Float32Array], when = 0.01) {
    if (!this.ctx || this.mode !== 'audio' || !this.fx) return;
    let buf = this.oneShots.get(key);
    if (!buf) {
      const [l, r] = make();
      buf = this.ctx.createBuffer(2, l.length, 44100);
      buf.copyToChannel(l, 0);
      buf.copyToChannel(r, 1);
      if (this.oneShots.size > 64) this.oneShots.clear();
      this.oneShots.set(key, buf);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.fx);
    src.start(this.ctx.currentTime + when);
  }

  /** One original struck tone to open the journey. */
  chime() {
    this.shot(`chime:${this.palette}`, () => renderOneShot('lead', this.palette as Palette, [67, 72], 1.6, 0.18), 0.03);
  }

  /** One note on demand (inspecting a score mark). At most ~3 per second. */
  audition(midi: number | null) {
    if (midi === null) return;
    const now = performance.now();
    if (now - this.lastAudition < 300) return;
    this.lastAudition = now;
    this.shot(`note:${this.palette}:${midi}`, () => renderOneShot('lead', this.palette as Palette, [midi], 0.45));
  }

  /** Short phrase for the press (beat II): the visitor's own melody in miniature, on the harp. */
  phrase(midis: (number | null)[], spacing = 0.14) {
    const notes = midis.filter((_, i) => i % 3 === 0).map((m) => m ?? 0).filter((m) => m > 0);
    if (!notes.length) return;
    this.shot(`phrase:${this.palette}:${notes.join(',')}`, () => renderOneShot('harp', this.palette as Palette, notes, 0.12, spacing));
  }

  stylus() {
    this.shot('stylus', () => renderOneShot('thump', this.palette as Palette, [36], 0.12));
  }

  chord(midis: number[]) {
    this.shot(`chord:${midis.join(',')}`, () => renderOneShot('chord', this.palette as Palette, midis, 2.4));
  }

  /* --------------------------- internals ----------------------------- */

  private renderKey() {
    const p = this.program!;
    return `${p.id}|${this.palette}|${p.beatSeconds}`;
  }

  /** Start rendering the current record in the background (if sound is on). */
  private prepare() {
    if (!this.program || !this.ctx || this.ctx.state !== 'running') return;
    void this.buffers().catch(() => undefined);
  }

  private buffers(): Promise<AudioBuffer[]> {
    const key = this.renderKey();
    let job = this.renders.get(key);
    if (!job) {
      const p = this.program!;
      job = renderRecord(p.events, this.palette as Palette, p.beatSeconds).then((r: Rendered) => {
        const ctx = this.ctx!;
        return LAYERS.map((l) => {
          const [left, right] = r.stems[l];
          const b = ctx.createBuffer(2, r.length, r.sampleRate);
          b.copyToChannel(left, 0);
          b.copyToChannel(right, 1);
          return b;
        });
      });
      job.catch(() => this.renders.delete(key));
      this.renders.set(key, job);
      // keep memory modest: only the most recent renders
      while (this.renders.size > 3) this.renders.delete(this.renders.keys().next().value as string);
    }
    return job;
  }

  private startSession(bufs: AudioBuffer[], from: number) {
    const ctx = this.ctx!;
    const beat = this.program!.beatSeconds;
    this.endSession();
    const t0 = ctx.currentTime + START_DELAY;
    const sources: AudioBufferSourceNode[] = [];
    const fades: GainNode[] = [];
    LAYERS.forEach((l, k) => {
      const src = ctx.createBufferSource();
      src.buffer = bufs[k];
      const fade = ctx.createGain();
      // a 15 ms fade-in when starting mid-record, so resuming never clicks
      if (from > 0) {
        fade.gain.setValueAtTime(0, t0);
        fade.gain.linearRampToValueAtTime(1, t0 + 0.015);
      }
      src.connect(fade);
      fade.connect(this.layerGain[l]!);
      src.start(t0, from * beat);
      sources.push(src);
      fades.push(fade);
    });
    this.session = { sources, fades };
    this.anchor = { time: t0, step: from };
    this.started = true;
    this.startTimer();
  }

  private endSession() {
    const s = this.session;
    this.session = null;
    this.started = false;
    if (!s || !this.ctx) return;
    const now = this.ctx.currentTime;
    s.fades.forEach((g) => {
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.linearRampToValueAtTime(0, now + FADE);
    });
    s.sources.forEach((src) => {
      try {
        src.stop(now + FADE + 0.01);
      } catch {
        /* already stopped */
      }
    });
    setTimeout(() => s.fades.forEach((g) => g.disconnect()), (FADE + 0.1) * 1000);
  }

  /** The picture follows the audio clock; a busy page only delays the picture, never the sound. */
  private startTimer() {
    this.clearTimer();
    this.timer = window.setInterval(() => this.tick(), 20);
    this.tick();
  }

  private tick() {
    if (!this.program || !this.playing) return;
    const pos = this.position();
    const n = this.program.events.length;
    if (pos >= n + TAIL_BEATS) return this.finish();
    const k = Math.floor(pos);
    if (k < n && k !== this.lastStep && (this.started || this.mode === 'silent')) {
      this.lastStep = k;
      this.listener?.onStep(k);
    }
  }

  private seekInternal(step: number, emit = true) {
    const n = this.program?.events.length ?? 0;
    const s = Math.max(0, Math.min(n, step));
    this.offset = s;
    this.lastStep = s - 1;
    if (emit && s < n) this.listener?.onStep(s);
  }

  private finish() {
    if (!this.playing) return;
    this.playing = false;
    this.clearTimer();
    // the buffers carry their own tail (closing chord, room): let them ring out
    this.session = null;
    this.started = false;
    this.offset = this.program?.events.length ?? 0;
    this.listener?.onEnd();
  }

  private clearTimer() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }
}

export const transport = new Transport();
