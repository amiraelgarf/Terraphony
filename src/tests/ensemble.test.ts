/**
 * The orchestra plays the data; it never changes it and never clashes with it.
 */
import { describe, expect, it } from 'vitest';
import { arrange, scaleStep, triad } from '../audio/ensemble';
import { buildEvents } from '../audio/musicMapper';
import { OCEAN_RULE } from '../stories/ocean.config';
import { obs } from './helpers';

const values = [12, 14, 15, 13, null, 18, 21, 22, 22, 25, 24, 20, 19, 17, 16, 18, 20, 23, 26, 27, 25, 22, 20, 18];
const events = buildEvents(obs(values), OCEAN_RULE);
const perf = arrange(events);
const SCALE = new Set([0, 2, 4, 7, 9]);

describe('ensemble', () => {
  it('plays exactly the data melody and the data bass; rests stay silent', () => {
    perf.forEach((p, i) => expect(p.lead?.midi ?? null).toBe(events[i].midiNote));
    expect(perf[4].lead).toBeNull();
    events.forEach((e, i) => {
      const bass = e.supportingEvents.find((s) => s.instrumentId === 'bass');
      if (bass) expect(perf[i].bass?.midi).toBe(bass.midiNote);
    });
  });

  it('opens with the solo and soft strings only, then adds the orchestra section by section', () => {
    const inSection = (n: number) => perf.filter((_, i) => events[i].section === n);
    inSection(1).forEach((p) => {
      expect(p.violin).toBeNull();
      expect(p.horns).toHaveLength(0);
      expect(p.harp).toHaveLength(0);
      expect(p.timpani).toBeNull();
    });
    expect(inSection(1).some((p) => p.strings.length === 3)).toBe(true);
    expect(inSection(2).some((p) => p.violin && p.timpani)).toBe(true);
    expect(inSection(3).some((p) => p.horns.length === 2 && p.harp.length === 2)).toBe(true);
    expect(inSection(4).some((p) => p.harp.length === 1)).toBe(true);
  });

  it('keeps every added note inside the pentatonic collection', () => {
    for (const p of perf) for (const h of [...p.strings, ...p.horns, ...p.harp, ...(p.violin ? [p.violin] : []), ...(p.timpani ? [p.timpani] : [])]) expect(SCALE.has(h.midi % 12)).toBe(true);
  });

  it('builds consonant pentatonic triads', () => {
    expect(triad(48)).toEqual([48, 52, 55]); // C E G
    expect(triad(50)).toEqual([50, 55, 57]); // D G A
    expect(scaleStep(49, 0)).toBe(48);
  });

  it('is deterministic', () => {
    expect(arrange(events)).toEqual(perf);
  });
});
