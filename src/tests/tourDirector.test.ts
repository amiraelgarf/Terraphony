/**
 * The guided journey's state machine: one click, automatic hand-offs on real cue
 * endings, the visitor's choice always wins, pause holds every planned beat, and
 * cancelled cues can never act later.
 */
import { describe, expect, it } from 'vitest';
import { TourDirector, type AppSnap, type TourHost, type TourVoice } from '../tour/tourDirector';
import type { EarthRecord } from '../data/types';
import { obs } from './helpers';

const flush = async (n = 6) => {
  for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0));
};

function rig() {
  const spoken: string[] = [];
  const calls: string[] = [];
  let pending: { id: string; resolve: (r: 'ended' | 'cancelled') => void } | null = null;
  const voice: TourVoice & { paused: boolean } = {
    paused: false,
    play: (id) =>
      new Promise((resolve) => {
        pending?.resolve('cancelled');
        spoken.push(id);
        pending = { id, resolve };
      }),
    pause: () => void (voice.paused = true),
    resume: () => void (voice.paused = false),
    stop: () => {
      pending?.resolve('cancelled');
      pending = null;
    },
    cueText: (id) => id,
  };
  const d = new TourDirector(voice);
  d.timeScale = 0;
  // values jump at index 4: the planned discovery
  const record = { recordId: 'r1', observations: obs([20, 20, 20, 20, 25, 25, 25, 25]) } as unknown as EarthRecord;
  let app: AppSnap = { scene: 'arrival', story: 'ocean', playing: false, playhead: null, selected: null, record: null, studioReady: false, featuredLoaded: false, revealSource: 'press' };
  const set = (p: Partial<AppSnap>) => {
    app = { ...app, ...p };
    queueMicrotask(() => d.observe(app));
  };
  const host: TourHost = {
    ensureSound: async () => true,
    leaveArrival: async () => {
      calls.push('leaveArrival');
      set({ scene: 'library' });
    },
    openStory: async (story) => {
      calls.push(`openStory:${story}`);
      set({ scene: 'studio', story, record, studioReady: true });
    },
    go: (scene, story) => {
      calls.push(`go:${scene}`);
      set({ scene, story: story ?? app.story });
    },
    featured: (story) => {
      calls.push(`featured:${story}`);
      set({ featuredLoaded: true, ...(app.scene === 'studio' ? { record, studioReady: true } : {}) });
    },
    play: (from) => {
      calls.push(`play:${from ?? '-'}`);
      set({ playing: true, playhead: from ?? app.playhead ?? 0, selected: null });
    },
    pause: () => {
      calls.push('pause');
      set({ playing: false });
    },
    inspect: (i) => {
      calls.push(`inspect:${i}`);
      set(i === null ? { selected: null } : { playing: false, selected: i, playhead: i });
    },
    chime: () => calls.push('chime'),
    announce: () => undefined,
  };
  d.setHost(host);
  d.observe(app);
  const end = async () => {
    await flush();
    const p = pending;
    pending = null;
    p?.resolve('ended');
    await flush();
  };
  return { d, spoken, calls, set, end, current: () => pending?.id ?? null, app: () => app, voice };
}

describe('TourDirector', () => {
  it('runs the whole story from one click, advancing on cue endings and data events', async () => {
    const t = rig();
    t.d.start();
    await t.end(); // intro-01
    expect(t.calls).toContain('leaveArrival');
    expect(t.d.snapshot.phase).toBe('choosing-record');
    await t.end(); // choose-ocean -> no choice -> featured opens
    expect(t.calls).toContain('openStory:ocean');
    expect(t.current()).toBe('first-notes');
    await t.end();
    expect(t.calls).toContain('play:0');
    t.set({ playhead: 3 });
    await flush();
    expect(t.d.snapshot.phase).toBe('first-performance');
    t.set({ playhead: 5 }); // one note after the turn
    await flush();
    expect(t.d.snapshot.phase).toBe('discovery');
    expect(t.calls).toContain('inspect:4');
    await t.end(); // discovery
    await t.end(); // discovery-ocean (featured record)
    await t.end(); // resume
    expect(t.calls).toContain('play:4');
    t.set({ playing: false, playhead: null }); // performance ends
    await flush();
    expect(t.current()).toBe('handover');
    await t.end();
    expect(t.d.snapshot.phase).toBe('creation');
    expect(t.d.snapshot.next).toBe('draw');
    expect(t.spoken).toEqual(['intro-01', 'choose-ocean', 'first-notes', 'discovery', 'discovery-ocean', 'resume', 'handover']);
  });

  it('choosing land during the introduction cancels the ocean branch for good', async () => {
    const t = rig();
    t.d.start();
    await t.end(); // intro
    expect(t.current()).toBe('choose-ocean');
    t.set({ scene: 'studio', story: 'vegetation', record: null, studioReady: false }); // the visitor clicks Side B
    await flush();
    expect(t.current()).toBe('choice-land');
    await t.end();
    await flush(20);
    expect(t.calls.filter((c) => c === 'openStory:ocean')).toHaveLength(0);
    expect(t.d.snapshot.branch).toBe('vegetation');
  });

  it('pause holds the planned discovery until resume; nothing doubles', async () => {
    const t = rig();
    t.d.start();
    await t.end();
    await t.end();
    await t.end(); // first-notes -> music plays
    t.d.pause('user');
    expect(t.voice.paused).toBe(true);
    t.set({ playhead: 6 });
    await flush();
    expect(t.d.snapshot.phase).toBe('first-performance');
    t.d.resume();
    await flush();
    expect(t.d.snapshot.phase).toBe('discovery');
    expect(t.calls.filter((c) => c === 'inspect:4')).toHaveLength(1);
  });

  it('skip stops at once and later events do nothing', async () => {
    const t = rig();
    t.d.start();
    await flush();
    t.d.skip();
    const before = t.calls.length;
    await t.end();
    await flush(10);
    expect(t.d.snapshot.phase).toBe('skipped');
    expect(t.calls.length).toBe(before);
  });

  it('pressing during the performance jumps to the record, then the closing line', async () => {
    const t = rig();
    t.d.start();
    await t.end();
    await t.end();
    t.d.userIntent('press');
    expect(t.d.snapshot.phase).toBe('pressing');
    t.set({ scene: 'press' });
    await flush();
    t.set({ scene: 'reveal' });
    await flush(10);
    expect(t.current()).toBe('record-ready');
    await t.end();
    expect(t.d.snapshot.phase).toBe('complete');
    expect(t.d.active).toBe(false);
  });

  it('leaving for another page pauses the journey; resume continues from the same beat', async () => {
    const t = rig();
    t.d.start();
    await t.end();
    await t.end();
    t.set({ scene: 'method' });
    await flush();
    expect(t.d.snapshot.paused).toBe('away');
    expect(t.calls.filter((c) => c.startsWith('go:'))).toHaveLength(0); // never teleported back
    t.d.resume();
    await flush();
    expect(t.calls).toContain('openStory:ocean');
  });
});
