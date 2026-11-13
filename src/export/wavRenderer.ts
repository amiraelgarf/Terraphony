/**
 * Offline WAV render of a record: the same voices, the same events, the same
 * limiter as live playback, rendered with Tone.Offline (OfflineAudioContext)
 * and encoded as 16-bit PCM stereo.
 */
import type { EarthRecord } from '../data/types';
import { createVoices, perform } from '../audio/instruments';
import { arrange } from '../audio/ensemble';
import { loadTone, TAIL_BEATS } from '../audio/transport';

export async function renderRecordWav(record: EarthRecord, sampleRate = 44100): Promise<Blob> {
  const beat = record.musicalRule.beatSeconds;
  const duration = (record.events.length + TAIL_BEATS + 2) * beat;
  const Tone = await loadTone();
  const buffer = await Tone.Offline(async () => {
    const v = createVoices(Tone, record.instrumentPaletteId);
    v.output.toDestination();
    await v.ready;
    arrange(record.events).forEach((p, k) => perform(Tone, v, p, record.events[k].atBeat * beat + 0.05, beat));
  }, duration, 2, sampleRate);
  return encodeWav(buffer.get() as AudioBuffer);
}

export function encodeWav(buf: AudioBuffer): Blob {
  const ch = buf.numberOfChannels, len = buf.length, rate = buf.sampleRate;
  const bytes = 44 + len * ch * 2;
  const view = new DataView(new ArrayBuffer(bytes));
  const str = (o: number, s: string) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  view.setUint32(4, bytes - 8, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, ch, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * ch * 2, true);
  view.setUint16(32, ch * 2, true);
  view.setUint16(34, 16, true);
  str(36, 'data');
  view.setUint32(40, len * ch * 2, true);
  const data = Array.from({ length: ch }, (_, c) => buf.getChannelData(c));
  // normalise the file to a -3 dBFS peak (the live mix is untouched)
  let peak = 0;
  for (const d of data) for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  const gain = peak > 0 ? Math.min(8, 0.708 / peak) : 1;
  let o = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, data[c][i] * gain));
      view.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  }
  return new Blob([view], { type: 'audio/wav' });
}
