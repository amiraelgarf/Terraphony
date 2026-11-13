/**
 * The host's script and voice choice: every cue the director uses exists, the
 * spoken science matches the real data it describes, and the browser fallback
 * picks a natural, lower voice over mechanical or novelty voices.
 */
import { describe, expect, it } from 'vitest';
import { allCues, cueById, pickVoice, readingMs } from '../tour/narration';
import { notableIndex } from '../audio/musicMapper';
import { place, presets } from './helpers';
import { placeSamples } from '../data/adapters/modisNdviAdapter';

const text = (id: string) => cueById(id)!.phrases.map((p) => p.text).join(' ');

describe('guide script', () => {
  it('has every cue the director plays, each with direction and timing', () => {
    for (const id of ['intro-01', 'choose-ocean', 'choice-ocean', 'choice-land', 'first-notes', 'first-notes-land', 'discovery', 'discovery-ocean', 'discovery-land', 'discovery-generic', 'resume', 'handover', 'record-ready']) {
      const c = cueById(id);
      expect(c, id).not.toBeNull();
      expect(c!.phrases.length).toBeGreaterThan(0);
      expect(c!.emotion.length).toBeGreaterThan(0);
    }
    expect(new Set(allCues().map((c) => c.id)).size).toBe(allCues().length);
  });

  it('keeps the brief’s key lines word for word', () => {
    expect(text('intro-01')).toContain('Today we have a new kind of orchestra… the Earth itself.');
    expect(text('choose-ocean')).toBe("We could begin anywhere. For our first performance, let's follow a line through the ocean.");
    expect(text('handover')).toBe('My turn is over. Now the baton is yours. Choose a place, draw a route, or listen to another year.');
    expect(text('record-ready')).toBe('A record unlike any other. Earth provided the pattern. You chose where to listen.');
  });

  it('speaks the Gulf Stream discovery exactly as the data says', () => {
    const ref = presets().presets.find((p) => p.id === 'gulf-stream')!.reference.A;
    const i = ref.findIndex((_, k) => k === 8);
    expect(i).toBe(8); // "stop nine"
    expect(ref[8].lat.toFixed(1)).toBe('39.9');
    expect(Math.abs(ref[8].lon).toFixed(1)).toBe('59.5');
    expect(ref[8].value!.toFixed(1)).toBe('23.7');
    expect(ref[7].value!.toFixed(1)).toBe('28.3');
    const t = text('discovery-ocean');
    for (const w of ['Stop nine', 'thirty-nine point nine degrees north', 'fifty-nine point five west', 'eighteenth of August, two thousand and seven', 'twenty-three point seven', 'twenty-eight point three']) expect(t).toContain(w);
  });

  it('speaks the Nile Delta discovery exactly as the data says', () => {
    const p = place('nile-delta');
    const k = notableIndex(placeSamples(p, 'test'))!;
    const w = p.windows[k], prev = p.windows[k - 1];
    expect(w.start).toBe('2023-06-26');
    expect(w.end).toBe('2023-07-11');
    expect(prev.ndvi!.toFixed(2)).toBe('0.33');
    expect(w.ndvi!.toFixed(2)).toBe('0.57');
    expect(text('discovery-land')).toContain('zero point three three to zero point five seven');
  });

  it('captions without voice advance at a readable pace', () => {
    expect(readingMs('Welcome.')).toBeGreaterThanOrEqual(900);
    expect(readingMs('one two three four five six seven eight nine ten')).toBeGreaterThan(3500);
  });
});

describe('browser voice fallback', () => {
  const v = (name: string, lang = 'en-US') => ({ name, lang, localService: false, voiceURI: name, default: false }) as SpeechSynthesisVoice;
  it('prefers a natural, warm, lower voice', () => {
    const voices = [v('Microsoft David - English (United States)'), v('Microsoft Zira - English (United States)'), v('Google US English'), v('Microsoft Andrew Online (Natural) - English (United States)'), v('Microsoft Aria Online (Natural) - English (United States)')];
    expect(pickVoice(voices, null)!.name).toContain('Andrew');
  });
  it('never picks novelty voices or other languages, and honours the visitor’s choice', () => {
    const voices = [v('Bad News'), v('Zarvox'), v('Thomas', 'fr-FR'), v('Daniel', 'en-GB')];
    expect(pickVoice(voices, null)!.name).toBe('Daniel');
    expect(pickVoice(voices, 'Zarvox')!.name).toBe('Zarvox');
  });
});
