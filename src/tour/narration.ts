/**
 * NarrationService — the host's voice, independent of React mount/unmount.
 *
 * One cue = an ordered list of phrases (captions). Each cue plays in the
 * best available way, decided per phrase:
 *
 *   clip    pre-recorded / pre-rendered voice (public/audio/guide/<locale>/manifest.json).
 *           Either one file per phrase, or one file per cue with phrase start marks.
 *   speech  browser speechSynthesis — FALLBACK only, with the most natural voice
 *           available on the device and per-phrase pacing/pitch for expression.
 *   timer   no voice (narration muted, speech unavailable or failing): captions
 *           still advance at reading pace, so the tour never stalls.
 *
 * Exactly one cue session exists at a time. play() resolves 'ended' when the
 * cue finishes or 'cancelled' if it was stopped/replaced, so stale `onend`
 * callbacks can never drive the tour. Pause/resume keep the phrase position.
 */
import script from './guideScript.en.json';

export type Phrase = { text: string; pauseAfterMs?: number; rate?: number; pitch?: number; tag?: string };
export type Cue = { id: string; beat: string; emotion: string; direction?: string; nextEvent?: string; phrases: Phrase[] };
export type ClipCue = {
  cueId: string;
  /** One file for the whole cue, with phrase start marks in seconds… */
  clipUrl?: string;
  marks?: number[];
  /** …or one file per phrase. */
  phraseClips?: (string | null)[];
  duration?: number;
};
export type ClipManifest = { locale: string; voice?: { provider: string; name: string; note?: string } | null; cues: ClipCue[] };

export type NarrationMode = 'clip' | 'speech' | 'timer';
export type NarrationSnapshot = {
  cueId: string | null;
  phrase: number;
  text: string;
  cueText: string;
  speaking: boolean;
  paused: boolean;
  mode: NarrationMode | null;
  /** Last cue spoken, for "replay the line" after it finished. */
  lastCueId: string | null;
};
export type NarrationSettings = { voice: boolean; rate: number; level: number; voiceURI: string | null };

const SETTINGS_KEY = 'earth-records:guide:v1';
const CUES: Cue[] = (script as { cues: Cue[] }).cues;
export const cueById = (id: string) => CUES.find((c) => c.id === id) ?? null;
export const allCues = () => CUES;

/** Reading pace for captions without voice (≈ 2.5 words per second, never too fast). */
export function readingMs(text: string, rate = 1) {
  const words = text.trim().split(/\s+/).length;
  return Math.max(900, (words / 2.5) * 1000 + 250) / rate;
}

/** Pausable one-shot timer. */
class PTimer {
  private id: number | null = null;
  private left = 0;
  private started = 0;
  constructor(private cb: () => void) {}
  start(ms: number) {
    this.cancel();
    this.left = ms;
    this.resume();
  }
  pause() {
    if (this.id === null) return;
    window.clearTimeout(this.id);
    this.id = null;
    this.left -= performance.now() - this.started;
  }
  resume() {
    if (this.id !== null) return;
    this.started = performance.now();
    this.id = window.setTimeout(() => {
      this.id = null;
      this.cb();
    }, Math.max(0, this.left));
  }
  cancel() {
    if (this.id !== null) window.clearTimeout(this.id);
    this.id = null;
  }
}

/* ------------------------------------------------------------------ */
/* Browser voice choice: the most natural, warm, lower-register voice  */
/* ------------------------------------------------------------------ */

const NOVELTY = /albert|bad news|bahh|bells|boing|bubbles|cellos|wobble|zarvox|trinoids|whisper|jester|organ|superstar|ralph|grandpa|grandma|junior|kathy|fred|rocko|shelley|sandy|flo|eddy|reed/i;
const DEEP_MALE = /andrew|brian|guy|christopher|davis|ryan|thomas|eric|roger|steffan|daniel|arthur|aaron|evan|oliver|george|william|james|tom|alex|male/i;
const FEMALE = /female|zira|aria|jenny|sonia|libby|ava|emma|michelle|samantha|karen|moira|tessa|serena|victoria|susan|hazel|catherine|natasha|clara/i;

export function scoreVoice(v: Pick<SpeechSynthesisVoice, 'name' | 'lang' | 'localService'>): number {
  if (!/^en/i.test(v.lang) || NOVELTY.test(v.name)) return -1;
  let s = 0;
  if (/natural|neural|online|premium|enhanced/i.test(v.name)) s += 50; // neural voices: far better prosody
  if (/multilingual/i.test(v.name)) s += 6;
  if (DEEP_MALE.test(v.name)) s += 22;
  if (FEMALE.test(v.name)) s -= 12;
  if (/andrew|brian|davis|ryan|arthur|daniel/i.test(v.name)) s += 8; // warm, lower, articulate
  if (/^en-(gb|us)/i.test(v.lang)) s += 4;
  if (/google uk english male/i.test(v.name)) s += 12;
  if (/david|mark/i.test(v.name) && !/natural|online/i.test(v.name)) s -= 6; // older SAPI voices sound mechanical
  return s;
}

export function pickVoice(voices: SpeechSynthesisVoice[], preferredURI: string | null): SpeechSynthesisVoice | null {
  if (preferredURI) {
    const v = voices.find((x) => x.voiceURI === preferredURI);
    if (v) return v;
  }
  const ranked = voices.map((v) => ({ v, s: scoreVoice(v) })).filter((x) => x.s >= 0).sort((a, b) => b.s - a.s);
  return ranked[0]?.v ?? null;
}

/** Is this voice a neural / natural one? (They ignore extreme pitch, so we bend it less.) */
const isNatural = (v: SpeechSynthesisVoice | null) => !!v && /natural|neural|online|premium|enhanced/i.test(v.name);

/* ------------------------------------------------------------------ */

type Session = {
  id: number;
  cue: Cue;
  clip: ClipCue | null;
  phrase: number;
  paused: boolean;
  resolve: (r: 'ended' | 'cancelled') => void;
  /** Current phrase player, if any. */
  player: { pause(): void; resume(): void; cancel(): void } | null;
  gap: PTimer | null;
};

type Listener = (s: NarrationSnapshot) => void;

export class NarrationService {
  private manifest: ClipManifest | null = null;
  private manifestLoad: Promise<void> | null = null;
  private brokenClips = new Set<string>();
  private session: Session | null = null;
  private seq = 0;
  private listeners = new Set<Listener>();
  private speakingListeners = new Set<(on: boolean) => void>();
  private snap: NarrationSnapshot = { cueId: null, phrase: 0, text: '', cueText: '', speaking: false, paused: false, mode: null, lastCueId: null };
  private voices: SpeechSynthesisVoice[] = [];
  /** Test hook: < 1 shortens timer-mode captions and pauses. */
  timeScale = 1;
  settings: NarrationSettings = { voice: true, rate: 1, level: 0.9, voiceURI: null };

  constructor(private base = '/') {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(SETTINGS_KEY) : null;
      if (raw) this.settings = { ...this.settings, ...JSON.parse(raw) };
    } catch {
      /* storage blocked: defaults */
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const load = () => (this.voices = window.speechSynthesis.getVoices());
      load();
      window.speechSynthesis.addEventListener?.('voiceschanged', load);
    }
  }

  /* -------------------------- public API ---------------------------- */

  get snapshot() {
    return this.snap;
  }
  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }
  onSpeaking(fn: (on: boolean) => void) {
    this.speakingListeners.add(fn);
    return () => void this.speakingListeners.delete(fn);
  }

  /** The voice that would be used now (for the settings UI and the credits line). */
  describeVoice(): string {
    if (!this.settings.voice) return 'Voice off — captions only';
    if (this.manifest?.voice && this.manifest.cues.length) return `${this.manifest.voice.name} (${this.manifest.voice.provider})`;
    const v = pickVoice(this.voices, this.settings.voiceURI);
    return v ? `${v.name} — browser voice (fallback)` : 'No voice available — captions only';
  }
  browserVoices() {
    return this.voices.filter((v) => scoreVoice(v) >= 0).sort((a, b) => scoreVoice(b) - scoreVoice(a));
  }
  hasRecordedVoice() {
    return !!this.manifest?.cues.length;
  }

  setSettings(patch: Partial<NarrationSettings>) {
    const before = this.settings;
    this.settings = { ...this.settings, ...patch };
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      /* not remembered */
    }
    // a change of voice on/off or voice choice takes effect from the current phrase
    if (this.session && !this.session.paused && (before.voice !== this.settings.voice || before.voiceURI !== this.settings.voiceURI)) {
      this.restartPhrase();
    }
    if (patch.level !== undefined && this.currentAudio) this.currentAudio.volume = this.settings.level;
    if (patch.rate !== undefined && this.currentAudio) this.currentAudio.playbackRate = this.settings.rate;
    this.emit({});
  }

  /** Fetch the recorded-voice manifest once (missing/failed = browser fallback). */
  load(): Promise<void> {
    if (!this.manifestLoad) {
      this.manifestLoad = fetch(`${this.base}audio/guide/en/manifest.json`)
        .then((r) => (r.ok ? r.json() : null))
        .then((m: ClipManifest | null) => {
          if (m && Array.isArray(m.cues)) this.manifest = m;
        })
        .catch(() => undefined);
    }
    return this.manifestLoad;
  }

  /** Play a cue. Resolves when it ends ('ended') or is replaced/stopped ('cancelled'). */
  async play(cueId: string): Promise<'ended' | 'cancelled'> {
    const cue = cueById(cueId);
    if (!cue) return 'ended';
    this.stop();
    const id = ++this.seq;
    await Promise.race([this.load(), new Promise((r) => window.setTimeout(r, 1500))]);
    if (id !== this.seq) return 'cancelled';
    return new Promise((resolve) => {
      this.session = {
        id,
        cue,
        clip: this.manifest?.cues.find((c) => c.cueId === cueId) ?? null,
        phrase: 0,
        paused: false,
        resolve,
        player: null,
        gap: null,
      };
      this.emit({ cueId, phrase: 0, text: cue.phrases[0]?.text ?? '', cueText: cue.phrases.map((p) => p.text).join(' '), paused: false, lastCueId: cueId });
      this.runPhrase(this.session);
    });
  }

  pause() {
    const s = this.session;
    if (!s || s.paused) return;
    s.paused = true;
    s.player?.pause();
    s.gap?.pause();
    this.setSpeaking(false);
    this.emit({ paused: true });
  }

  resume() {
    const s = this.session;
    if (!s || !s.paused) return;
    s.paused = false;
    this.emit({ paused: false });
    if (s.player) {
      s.player.resume();
      if (this.snap.mode !== 'timer') this.setSpeaking(true);
    } else if (s.gap) s.gap.resume();
    else this.runPhrase(s);
  }

  /** Stop everything now (skip, navigate, mute-all). The pending play() resolves 'cancelled'. */
  stop() {
    const s = this.session;
    this.session = null;
    if (!s) return;
    s.player?.cancel();
    s.gap?.cancel();
    this.setSpeaking(false);
    this.emit({ cueId: null, text: '', paused: false, mode: null });
    s.resolve('cancelled');
  }

  /**
   * Replay the line: restarts the current cue from its first phrase inside the same
   * session (the tour still waits for it), or — if nothing is playing — speaks the
   * last cue again on its own, without repeating any action tied to it.
   */
  replay() {
    const s = this.session;
    if (s) {
      s.player?.cancel();
      s.gap?.cancel();
      s.player = null;
      s.gap = null;
      s.phrase = 0;
      s.paused = false;
      this.emit({ paused: false });
      this.runPhrase(s);
      return;
    }
    if (this.snap.lastCueId) void this.play(this.snap.lastCueId);
  }

  /* ------------------------- internals ------------------------------ */

  private currentAudio: HTMLAudioElement | null = null;

  private restartPhrase() {
    const s = this.session;
    if (!s) return;
    s.player?.cancel();
    s.gap?.cancel();
    s.player = null;
    s.gap = null;
    this.runPhrase(s);
  }

  private emit(patch: Partial<NarrationSnapshot>) {
    this.snap = { ...this.snap, ...patch };
    this.listeners.forEach((l) => l(this.snap));
  }

  private setSpeaking(on: boolean) {
    if (this.snap.speaking === on) return;
    this.emit({ speaking: on });
    this.speakingListeners.forEach((l) => l(on));
  }

  private modeFor(s: Session, i: number): NarrationMode {
    if (!this.settings.voice) return 'timer';
    const url = this.clipUrlFor(s, i);
    if (url && !this.brokenClips.has(url)) return 'clip';
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && pickVoice(this.voices, this.settings.voiceURI)) return 'speech';
    return 'timer';
  }

  private clipUrlFor(s: Session, i: number): string | null {
    const c = s.clip;
    if (!c) return null;
    const rel = c.phraseClips?.[i] ?? (c.clipUrl && c.marks ? c.clipUrl : null);
    if (!rel) return null;
    return /^https?:|^\//.test(rel) ? rel : `${this.base}audio/guide/en/${rel}`;
  }

  private runPhrase(s: Session) {
    if (this.session !== s || s.paused) return;
    const phrase = s.cue.phrases[s.phrase];
    if (!phrase) return this.finish(s);
    const mode = this.modeFor(s, s.phrase);
    this.emit({ phrase: s.phrase, text: phrase.text, mode });
    const done = () => {
      if (this.session !== s) return;
      s.player = null;
      this.setSpeaking(false);
      const gap = new PTimer(() => {
        if (this.session !== s) return;
        s.gap = null;
        s.phrase++;
        this.runPhrase(s);
      });
      s.gap = gap;
      gap.start(((phrase.pauseAfterMs ?? 300) * this.timeScale) / this.settings.rate);
    };
    const fail = () => {
      // degrade gracefully: clip -> speech -> timer for this phrase
      if (this.session !== s) return;
      s.player = null;
      this.setSpeaking(false);
      this.runFallback(s, phrase, mode, done);
    };
    if (mode === 'clip') {
      const whole = !!(s.clip?.clipUrl && s.clip.marks && !s.clip.phraseClips);
      if (whole) return this.playWholeCueClip(s);
      s.player = this.playClip(this.clipUrlFor(s, s.phrase)!, done, fail);
      this.setSpeaking(true);
    } else if (mode === 'speech') {
      s.player = this.speak(phrase, done, fail);
      this.setSpeaking(true);
    } else {
      s.player = this.timer(phrase, done);
    }
  }

  private runFallback(s: Session, phrase: Phrase, failed: NarrationMode, done: () => void) {
    if (failed === 'clip' && 'speechSynthesis' in window && pickVoice(this.voices, this.settings.voiceURI)) {
      s.player = this.speak(phrase, done, () => {
        s.player = this.timer(phrase, done);
      });
      this.emit({ mode: 'speech' });
      this.setSpeaking(true);
    } else {
      s.player = this.timer(phrase, done);
      this.emit({ mode: 'timer' });
    }
  }

  private finish(s: Session) {
    if (this.session !== s) return;
    this.session = null;
    this.setSpeaking(false);
    this.emit({ cueId: null, paused: false, mode: null });
    s.resolve('ended');
  }

  private timer(phrase: Phrase, done: () => void) {
    const t = new PTimer(done);
    t.start(readingMs(phrase.text, this.settings.rate) * this.timeScale);
    return { pause: () => t.pause(), resume: () => t.resume(), cancel: () => t.cancel() };
  }

  private playClip(url: string, done: () => void, fail: () => void) {
    const audio = new Audio(url);
    audio.preload = 'auto';
    audio.volume = this.settings.level;
    audio.playbackRate = this.settings.rate;
    (audio as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
    this.currentAudio = audio;
    let settled = false;
    const end = (ok: boolean) => {
      if (settled) return;
      settled = true;
      if (this.currentAudio === audio) this.currentAudio = null;
      if (ok) done();
      else {
        this.brokenClips.add(url);
        fail();
      }
    };
    audio.addEventListener('ended', () => end(true));
    audio.addEventListener('error', () => end(false));
    audio.play().catch(() => end(false));
    return {
      pause: () => audio.pause(),
      resume: () => void audio.play().catch(() => end(false)),
      cancel: () => {
        settled = true;
        audio.pause();
        audio.src = '';
      },
    };
  }

  /** One recorded file for the whole cue; captions follow the phrase marks. */
  private playWholeCueClip(s: Session) {
    const url = this.clipUrlFor(s, 0)!;
    const marks = s.clip!.marks!;
    const audio = new Audio(url);
    audio.volume = this.settings.level;
    audio.playbackRate = this.settings.rate;
    (audio as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
    this.currentAudio = audio;
    let settled = false;
    const onTime = () => {
      let k = 0;
      for (let i = 0; i < marks.length; i++) if (audio.currentTime >= marks[i]) k = i;
      if (k !== s.phrase && this.session === s) {
        s.phrase = k;
        this.emit({ phrase: k, text: s.cue.phrases[k]?.text ?? '' });
      }
    };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', () => {
      if (settled) return;
      settled = true;
      this.currentAudio = null;
      this.finish(s);
    });
    const fail = () => {
      if (settled) return;
      settled = true;
      this.brokenClips.add(url);
      this.currentAudio = null;
      // continue the cue phrase by phrase without the broken file
      s.player = null;
      this.setSpeaking(false);
      this.runPhrase(s);
    };
    audio.addEventListener('error', fail);
    audio.play().catch(fail);
    s.player = {
      pause: () => audio.pause(),
      resume: () => void audio.play().catch(fail),
      cancel: () => {
        settled = true;
        audio.pause();
        audio.src = '';
      },
    };
    this.setSpeaking(true);
  }

  /**
   * Browser speech, phrase by phrase. Expression comes from the script's own
   * pacing: per-phrase rate and pitch, and real silences between phrases.
   * Chrome can drop 'end' events, so a watchdog finishes the phrase anyway.
   */
  private speak(phrase: Phrase, done: () => void, fail: () => void) {
    const synth = window.speechSynthesis;
    const voice = pickVoice(this.voices, this.settings.voiceURI);
    let settled = false;
    let watchdog: PTimer | null = null;
    let u: SpeechSynthesisUtterance | null = null;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      watchdog?.cancel();
      if (ok) done();
      else fail();
    };
    const start = () => {
      u = new SpeechSynthesisUtterance(phrase.text);
      if (voice) {
        u.voice = voice;
        u.lang = voice.lang;
      }
      const natural = isNatural(voice);
      // neural voices already sound human; bend them gently. Older voices get a deeper pitch.
      const pitch = phrase.pitch ?? 0.9;
      u.pitch = natural ? 1 - (1 - pitch) * 0.6 : Math.max(0.7, pitch - 0.05);
      u.rate = Math.max(0.6, Math.min(1.3, (phrase.rate ?? 0.9) * (natural ? 1.04 : 0.97) * this.settings.rate));
      u.volume = this.settings.level;
      u.onend = () => finish(true);
      u.onerror = (e) => {
        if (e.error === 'interrupted' || e.error === 'canceled') return;
        finish(false);
      };
      synth.cancel();
      synth.speak(u);
      watchdog = new PTimer(() => finish(true));
      watchdog.start(readingMs(phrase.text, u.rate) * 1.9 + 2500);
    };
    start();
    return {
      // speechSynthesis.pause() is unreliable across engines: stop and restart the phrase on resume
      pause: () => {
        watchdog?.cancel();
        if (u) u.onend = null;
        synth.cancel();
      },
      resume: () => {
        if (!settled) start();
      },
      cancel: () => {
        settled = true;
        watchdog?.cancel();
        if (u) {
          u.onend = null;
          u.onerror = null;
        }
        synth.cancel();
      },
    };
  }
}

export const narration = new NarrationService(typeof import.meta !== 'undefined' ? import.meta.env?.BASE_URL ?? '/' : '/');

// The audio engine holds live browser audio state (AudioContext, instruments, scheduled
// notes). Hot-swapping this module in development would leave the page with a fresh,
// silent engine; reload the page instead.
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload());
