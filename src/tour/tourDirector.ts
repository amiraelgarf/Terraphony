/**
 * TourDirector — the guided journey as a cancellable state machine.
 *
 *   idle -> invitation -> record-transition -> choosing-record -> first-performance
 *        -> discovery -> baton-handover -> creation -> pressing -> record-ready -> complete
 *   (+ paused, skipped)
 *
 * One click ("Begin the narrated journey") starts it; every later beat starts when
 * the previous narration cue actually ends (NarrationService), when the music
 * reaches a planned data event, or when the visitor acts. No "hear my guidance"
 * button exists.
 *
 * Every run of beats holds a token. Anything the visitor does that changes the
 * story (choosing land, leaving, pressing) cancels the token, so an obsolete cue
 * ending can never navigate them anywhere. The visitor's choice always wins.
 *
 * The director knows nothing about React: it talks to the app through a small
 * TourHost (set by TourBridge) and learns about the app through observe().
 */
import type { EarthRecord } from '../data/types';
import { notableIndex } from '../audio/musicMapper';
import type { Scene, StudioStory } from '../app/recordMachine';

export type TourPhase =
  | 'idle'
  | 'invitation'
  | 'record-transition'
  | 'choosing-record'
  | 'first-performance'
  | 'discovery'
  | 'baton-handover'
  | 'creation'
  | 'pressing'
  | 'record-ready'
  | 'complete'
  | 'paused'
  | 'skipped';

export type PauseReason = 'user' | 'explore' | 'away';
export type NextAction = 'draw' | 'another-place' | 'press' | null;

export type TourSnapshot = {
  phase: TourPhase;
  active: boolean;
  paused: PauseReason | null;
  branch: StudioStory | null;
  /** The record the director is featuring on the shelf while it speaks. */
  featured: StudioStory | null;
  /** The one contextual next step offered after the baton handover. */
  next: NextAction;
  /** Index of the discovery note while the camera holds on it. */
  focus: number | null;
};

/** What the director needs to see of the app. */
export type AppSnap = {
  scene: Scene;
  story: StudioStory;
  playing: boolean;
  playhead: number | null;
  selected: number | null;
  record: EarthRecord | null;
  studioReady: boolean;
  /** The studio holds the featured record (Gulf Stream, 18 Aug 2007 / Nile Delta 2023). */
  featuredLoaded: boolean;
  revealSource: 'press' | 'shelf';
};

/** What the director may ask the app to do. */
export interface TourHost {
  ensureSound(): Promise<boolean>;
  /** Arrival -> library with the needle / ring-to-line transition. */
  leaveArrival(): Promise<void>;
  /** Library card -> studio with the groove-to-geography transition. */
  openStory(story: StudioStory): Promise<void>;
  go(scene: Scene, story?: StudioStory): void;
  featured(story: StudioStory): void;
  play(from?: number): void;
  pause(): void;
  inspect(index: number | null): void;
  chime(): void;
  announce(text: string): void;
}

export interface TourVoice {
  play(cueId: string): Promise<'ended' | 'cancelled'>;
  pause(): void;
  resume(): void;
  stop(): void;
  cueText(cueId: string): string;
}

class Cancelled extends Error {
  constructor() {
    super('tour beat cancelled');
  }
}

type Token = { alive: boolean };
type Waiter = { pred: (s: AppSnap) => boolean; resolve: () => void; reject: (e: Error) => void; token: Token };

const PRE_PERFORMANCE: TourPhase[] = ['invitation', 'record-transition', 'choosing-record'];
const PERFORMANCE: TourPhase[] = ['first-performance', 'discovery'];

export class TourDirector {
  private host: TourHost | null = null;
  private snap: TourSnapshot = { phase: 'idle', active: false, paused: null, branch: null, featured: null, next: null, focus: null };
  private listeners = new Set<(s: TourSnapshot) => void>();
  private token: Token = { alive: false };
  private waiters: Waiter[] = [];
  private app: AppSnap | null = null;
  private lastKey = '';
  private expect: string[] = [];
  private performed = false;
  private musicWasPlaying = false;
  private pausedFrom: TourPhase = 'idle';
  private recordId: string | null = null;
  private sleeps = new Set<{ pause(): void; resume(): void; cancel(): void }>();
  /** Test hook: shortens the director's own holds. */
  timeScale = 1;

  constructor(private voice: TourVoice) {}

  /* ------------------------- wiring -------------------------------- */

  setHost(h: TourHost | null) {
    this.host = h;
  }
  get snapshot() {
    return this.snap;
  }
  subscribe(fn: (s: TourSnapshot) => void) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }
  get active() {
    return this.snap.active;
  }

  /** Called by the bridge after every app state change. */
  observe(app: AppSnap) {
    this.app = app;
    const key = `${app.scene}:${app.scene === 'studio' ? app.story : ''}`;
    if (key !== this.lastKey) {
      this.lastKey = key;
      const at = this.expect.indexOf(key);
      if (at >= 0) this.expect.splice(0, at + 1);
      else if (this.snap.active) this.onNavigate(app);
    }
    // the visitor changed the route / place / date during the performance: they took the baton
    if (this.snap.active && PERFORMANCE.includes(this.snap.phase) && this.snap.paused !== 'away' && this.recordId && app.scene === 'studio' && app.record && app.record.recordId !== this.recordId && app.studioReady) {
      this.recordId = null;
      this.toCreation(app.story, false);
    }
    this.settleWaiters();
  }

  /** Planned beats never advance while the journey is paused. */
  private settleWaiters() {
    const app = this.app;
    if (!app || this.snap.paused) return;
    for (const w of [...this.waiters]) {
      if (!w.token.alive) continue;
      if (w.pred(app)) {
        this.waiters = this.waiters.filter((x) => x !== w);
        w.resolve();
      }
    }
  }

  /* ---------------------- visitor controls ------------------------- */

  /** The one mandatory click. Must be called inside the click handler. */
  start() {
    this.cancel();
    this.performed = false;
    this.set({ phase: 'invitation', active: true, paused: null, branch: null, featured: null, next: null, focus: null });
    void this.run((t) => this.beatInvitation(t));
  }

  /** Pause narration, music and the director's own holds. */
  pause(reason: PauseReason = 'user') {
    if (!this.snap.active || this.snap.paused) return;
    this.musicWasPlaying = !!this.app?.playing;
    if (reason !== 'explore' && this.musicWasPlaying) this.host?.pause();
    this.voice.pause();
    this.sleeps.forEach((s) => s.pause());
    this.set({ paused: reason });
  }

  resume() {
    if (!this.snap.active || !this.snap.paused) return;
    if (this.snap.paused === 'away') return this.resumeFromAway();
    const was = this.musicWasPlaying;
    this.set({ paused: null });
    this.voice.resume();
    this.sleeps.forEach((s) => s.resume());
    if (was && PERFORMANCE.includes(this.snap.phase) && this.app?.scene === 'studio') this.host?.play();
    this.settleWaiters();
  }

  /** End the tour now. Music the visitor started keeps playing. */
  skip() {
    if (!this.snap.active) return;
    this.cancel();
    this.voice.stop();
    this.set({ phase: 'skipped', active: false, paused: null, next: null, focus: null, featured: null });
  }

  /** The visitor's own transport/inspection intents (from useActions). */
  userIntent(kind: 'play' | 'pause' | 'inspect' | 'press', index?: number | null) {
    if (!this.snap.active) return;
    switch (kind) {
      case 'pause':
        return this.pause('user');
      case 'play':
        if (this.snap.paused && this.snap.paused !== 'away') {
          this.musicWasPlaying = false; // the visitor's own Play starts the music
          this.resume();
        }
        return;
      case 'inspect':
        if (index !== null && index !== undefined && PERFORMANCE.includes(this.snap.phase) && index !== this.snap.focus) this.pause('explore');
        return;
      case 'press':
        this.cancel();
        this.voice.stop();
            this.expect.push('press:', 'reveal:');
        this.set({ phase: 'pressing', paused: null, next: null, focus: null });
        void this.run((t) => this.beatPressing(t));
        return;
    }
  }

  /** The visitor's contextual next step after the handover. */
  nextDone(action: NextAction) {
    if (this.snap.phase !== 'creation') return;
    if (action === 'draw' || action === 'another-place') this.set({ next: 'press' });
  }

  /* ---------------------------- beats ------------------------------ */

  private async beatInvitation(t: Token) {
    const h = this.host!;
    const sound = await h.ensureSound();
    this.check(t);
    if (sound) h.chime();
    await this.say('intro-01', t);
    this.set({ phase: 'record-transition' });
    this.expect.push('library:');
    await h.leaveArrival();
    this.check(t);
    await this.beatChoosing(t, true);
  }

  private async beatChoosing(t: Token, narrate: boolean) {
    this.set({ phase: 'choosing-record', featured: 'ocean' });
    if (narrate) await this.say('choose-ocean', t);
    await this.sleep(700, t);
    // no choice made: the featured record opens
    await this.openFeatured('ocean', t);
    await this.beatPerformance('ocean', false, t);
  }

  private async openFeatured(story: StudioStory, t: Token) {
    const h = this.host!;
    h.featured(story);
    if (this.app?.scene !== 'studio' || this.app.story !== story) {
      this.expect.push(`studio:${story}`);
      await h.openStory(story);
      this.check(t);
    }
  }

  private async beatPerformance(story: StudioStory, userChose: boolean, t: Token) {
    const h = this.host!;
    this.set({ phase: 'first-performance', branch: story, featured: null, next: null, focus: null });
    h.featured(story);
    if (userChose) await this.say(story === 'ocean' ? 'choice-ocean' : 'choice-land', t);
    await this.waitFor((s) => s.scene === 'studio' && s.story === story && s.studioReady && s.featuredLoaded && !!s.record, t);
    const record = this.app!.record!;
    this.recordId = record.recordId;
    await this.say(story === 'ocean' ? 'first-notes' : 'first-notes-land', t);

    const notable = notableIndex(record.observations);
    h.play(0);
    await this.waitFor((s) => s.playing, t);
    if (notable !== null) {
      await this.waitFor((s) => (s.playhead !== null && s.playhead >= notable + 1) || (!s.playing && s.playhead === null), t);
      if (this.app!.playhead !== null && this.app!.playhead >= notable + 1) {
        this.set({ phase: 'discovery', focus: notable });
        h.inspect(notable);
        await this.sleep(450, t); // let the sample glow before the voice
        await this.say('discovery', t);
        await this.say(this.scienceCue(story), t);
        await this.say('resume', t);
        this.set({ phase: 'first-performance', focus: null });
        h.inspect(null);
        h.play(notable);
        await this.waitFor((s) => s.playing, t);
      }
    }
    await this.waitFor((s) => !s.playing && s.playhead === null, t);
    this.performed = true;
    this.recordId = null;
    this.set({ phase: 'baton-handover', focus: null });
    await this.say('handover', t);
    this.toCreation(story, true);
  }

  private toCreation(story: StudioStory, fromHandover: boolean) {
    if (!fromHandover) {
      this.cancel();
      this.voice.stop();
      this.performed = true;
    }
    this.recordId = null;
    this.set({ phase: 'creation', branch: story, paused: null, focus: null, next: story === 'ocean' ? 'draw' : 'another-place' });
  }

  private async beatPressing(t: Token) {
    await this.waitFor((s) => s.scene === 'reveal', t);
    await this.sleep(1100, t); // let the reveal settle before speaking
    this.set({ phase: 'record-ready' });
    await this.say('record-ready', t);
    this.set({ phase: 'complete', active: false, paused: null, next: null });
  }

  private scienceCue(story: StudioStory) {
    if (!this.app?.featuredLoaded) return 'discovery-generic';
    return story === 'ocean' ? 'discovery-ocean' : 'discovery-land';
  }

  /* ------------------------ navigation ----------------------------- */

  private onNavigate(app: AppSnap) {
    const phase = this.snap.paused === 'away' ? this.pausedFrom : this.snap.phase;
    if (app.scene === 'studio') {
      if (this.snap.paused === 'away') this.set({ paused: null });
      if (this.performed) return this.toCreation(app.story, false);
      this.cancel();
      this.voice.stop();
      const chose = PRE_PERFORMANCE.includes(phase);
      void this.run((t) => this.beatPerformance(app.story, chose, t));
      return;
    }
    if (app.scene === 'library') {
      this.cancel();
      this.voice.stop();
      this.set({ phase: 'choosing-record', paused: null, next: null, focus: null, featured: null });
      return;
    }
    if (app.scene === 'reveal' && phase === 'pressing') return;
    if (app.scene === 'press') return;
    // arrival, method, a record from the shelf: step aside, keep the place in the story
    this.cancel();
    this.voice.stop();
    this.pausedFrom = phase;
    this.set({ paused: 'away', focus: null });
  }

  private resumeFromAway() {
    const from = this.pausedFrom;
    const story = this.snap.branch ?? 'ocean';
    this.set({ paused: null });
    if (PRE_PERFORMANCE.includes(from)) {
      this.expect.push('library:');
      this.host?.go('library');
      void this.run((t) => this.beatChoosing(t, true));
    } else if (PERFORMANCE.includes(from) || from === 'baton-handover') {
      void this.run(async (t) => {
        await this.openFeatured(story, t);
        await this.beatPerformance(story, false, t);
      });
    } else if (from === 'creation') {
      this.expect.push(`studio:${story}`);
      this.host?.go('studio', story);
      this.set({ phase: 'creation' });
    } else this.set({ phase: 'complete', active: false });
  }

  /* -------------------------- plumbing ----------------------------- */

  private async run(beat: (t: Token) => Promise<void>) {
    const t = (this.token = { alive: true });
    try {
      await beat(t);
    } catch (e) {
      if (!(e instanceof Cancelled)) throw e;
    }
  }

  private cancel() {
    this.token.alive = false;
    for (const w of this.waiters) w.reject(new Cancelled());
    this.waiters = [];
    this.sleeps.forEach((s) => s.cancel());
    this.sleeps.clear();
  }

  private check(t: Token) {
    if (!t.alive) throw new Cancelled();
  }

  private async say(cueId: string, t: Token) {
    this.check(t);
    this.host?.announce(this.voice.cueText(cueId));
    const r = await this.voice.play(cueId);
    this.check(t);
    if (r === 'cancelled') throw new Cancelled();
  }

  private waitFor(pred: (s: AppSnap) => boolean, t: Token): Promise<void> {
    this.check(t);
    if (this.app && !this.snap.paused && pred(this.app)) return Promise.resolve();
    return new Promise((resolve, reject) => this.waiters.push({ pred, resolve, reject, token: t }));
  }

  private sleep(ms: number, t: Token): Promise<void> {
    this.check(t);
    return new Promise((resolve, reject) => {
      let left = ms * this.timeScale;
      let started = performance.now();
      let id: ReturnType<typeof setTimeout> | null = null;
      const handle = {
        pause: () => {
          if (id === null) return;
          clearTimeout(id);
          id = null;
          left -= performance.now() - started;
        },
        resume: () => {
          if (id !== null) return;
          started = performance.now();
          id = setTimeout(fire, Math.max(0, left));
        },
        cancel: () => {
          if (id !== null) clearTimeout(id);
          this.sleeps.delete(handle);
          reject(new Cancelled());
        },
      };
      const fire = () => {
        this.sleeps.delete(handle);
        if (t.alive) resolve();
        else reject(new Cancelled());
      };
      this.sleeps.add(handle);
      if (this.snap.paused) return; // starts on resume
      handle.resume();
    });
  }

  private set(patch: Partial<TourSnapshot>) {
    this.snap = { ...this.snap, ...patch };
    this.listeners.forEach((l) => l(this.snap));
  }
}
