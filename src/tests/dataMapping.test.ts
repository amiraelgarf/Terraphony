import { describe, expect, it } from 'vitest';
import { BLOCK, buildEvents, eventHash, notableIndex, sectionBounds, sectionOf } from '../audio/musicMapper';
import { midiToName, noteBand, PITCHES_MIDI, valueToMidi } from '../audio/normalize';
import { OCEAN_RULE } from '../stories/ocean.config';
import { LAND_RULE } from '../stories/vegetation.config';
import { obs } from './helpers';

describe('value -> note (the one rule)', () => {
  it('maps the domain ends to the scale ends', () => {
    expect(valueToMidi(-2, -2, 31).midi).toBe(48);
    expect(valueToMidi(31, -2, 31).midi).toBe(72);
  });
  it('clamps outside the fixed range and discloses it', () => {
    const hot = valueToMidi(34.9, -2, 31);
    expect(hot.midi).toBe(72);
    expect(hot.clamped).toBe(true);
    expect(valueToMidi(20, -2, 31).clamped).toBe(false);
  });
  it('uses the published pentatonic collection', () => {
    expect([...PITCHES_MIDI]).toEqual([48, 50, 52, 55, 57, 60, 62, 64, 67, 69, 72]);
    expect(PITCHES_MIDI.map(midiToName).join(' ')).toBe('C3 D3 E3 G3 A3 C4 D4 E4 G4 A4 C5');
  });
  it('note bands tile the domain without gaps', () => {
    for (let i = 1; i < 11; i++) expect(noteBand(i, -2, 31)[0]).toBeCloseTo(noteBand(i - 1, -2, 31)[1], 9);
    for (let i = 1; i < 10; i++) {
      const [a, b] = noteBand(i, -2, 31);
      expect(valueToMidi((a + b) / 2, -2, 31).index).toBe(i);
    }
  });
  it('NDVI uses its own fixed domain', () => {
    expect(valueToMidi(0.45, LAND_RULE.domainMin, LAND_RULE.domainMax).midi).toBe(PITCHES_MIDI[5]);
  });
});

describe('events and arrangement', () => {
  const values: (number | null)[] = Array.from({ length: 24 }, (_, i) => 10 + i * 0.5);
  values[7] = null;
  const events = buildEvents(obs(values), OCEAN_RULE);

  it('one event per observation, in order; invalid -> rest', () => {
    expect(events).toHaveLength(24);
    expect(events.map((e) => e.sequenceIndex)).toEqual([...Array(24).keys()]);
    expect(events[7].midiNote).toBeNull();
  });
  it('sections follow 5/24, 12/24, 20/24 of the length', () => {
    expect(sectionBounds(24)).toEqual({ bassFrom: 5, accentFrom: 12, resolveFrom: 20 });
    expect(sectionBounds(23)).toEqual({ bassFrom: 5, accentFrom: 12, resolveFrom: 19 });
    expect([0, 4, 5, 11, 12, 19, 20, 23].map((i) => sectionOf(i, 24))).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
  });
  it('bass = block mean an octave down, only in sections 2–3 on block starts', () => {
    const bass = events.flatMap((e) => e.supportingEvents.filter((s) => s.instrumentId === 'bass').map(() => e.sequenceIndex));
    expect(bass).toEqual([8, 12, 16]);
    expect(bass.every((i) => i % BLOCK === 0)).toBe(true);
    const b8 = events[8].supportingEvents.find((s) => s.instrumentId === 'bass')!;
    expect(b8.midiNote).toBe(valueToMidi((14 + 14.5 + 15 + 15.5) / 4, -2, 31).midi - 12);
  });
  it('accents mark declared changes and sound only from section 3', () => {
    const big = obs([10, 10, 12, 12, 12, 14, 14, 14, 14, 14, 14, 14, 16, 16, 18, 18, 18, 18, 18, 18, 20, 20, 20, 20]);
    const ev = buildEvents(big, OCEAN_RULE);
    expect(ev.filter((e) => e.changeMarked).map((e) => e.sequenceIndex)).toEqual([2, 5, 12, 14, 20]);
    const audible = ev.filter((e) => e.supportingEvents.some((s) => s.instrumentId === 'accent')).map((e) => e.sequenceIndex);
    expect(audible).toEqual([12, 14, 20]);
  });
  it('the closing chord is the only artistic voice and comes last', () => {
    const art = events.flatMap((e) => e.supportingEvents.filter((s) => s.artistic).map(() => e.sequenceIndex));
    expect(art).toEqual([23]);
  });
  it('is deterministic', () => {
    expect(eventHash(buildEvents(obs(values), OCEAN_RULE))).toBe(eventHash(events));
  });
  it('change is measured from the previous VALID sample, across rests', () => {
    const ev = buildEvents(obs([10, null, 11.5, 11.6]), OCEAN_RULE);
    expect(ev[2].changeMarked).toBe(true);
    expect(notableIndex(obs([10, 10, 10, 13, 13, 13]))).toBe(3);
  });
});
