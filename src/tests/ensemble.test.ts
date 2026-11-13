/**
 * The ensemble orchestrates; it never changes what the data says.
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
  it('plays exactly the data melody, and rests stay silent', () => {
    perf.forEach((p, i) => expect(p.lead?.midi ?? null).toBe(events[i].midiNote));
    expect(perf[4].lead).toBeNull();
  });
  it('keeps section 1 as the melody alone', () => {
    perf.filter((_, i) => events[i].section === 1).forEach((p) => {
      expect(p.chord).toHaveLength(0);
    });
  });
  it('adds soft strings later, all inside the pentatonic collection', () => {
    expect(perf.some((p) => p.chord.length === 3)).toBe(true);
    for (const p of perf) for (const h of p.chord) expect(SCALE.has(h.midi % 12)).toBe(true);
  });
  it('keeps the data bass and makes changes audible as pitched chimes', () => {
    events.forEach((e, i) => {
      const bass = e.supportingEvents.find((s) => s.instrumentId === 'bass');
      expect(perf[i].bass?.midi ?? null).toBe(bass?.midiNote ?? null);
      expect(!!perf[i].chime).toBe(e.supportingEvents.some((s) => s.instrumentId === 'accent'));
    });
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
