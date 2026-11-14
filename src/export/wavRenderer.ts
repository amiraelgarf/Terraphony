/**
 * WAV export of a record: exactly the orchestra you hear — the same rendered stems
 * as live playback (dsp.ts, rendered in the background worker), summed and encoded
 * as 16-bit PCM stereo at 44.1 kHz.
 */
import type { EarthRecord } from '../data/types';
import { renderRecord } from '../audio/renderClient';
import type { Palette } from '../audio/dsp';

export async function renderRecordWav(record: EarthRecord): Promise<Blob> {
  const r = await renderRecord(record.events, record.instrumentPaletteId as Palette, record.musicalRule.beatSeconds);
  const left = new Float32Array(r.length), right = new Float32Array(r.length);
  for (const [l, rr] of Object.values(r.stems)) {
    for (let i = 0; i < r.length; i++) {
      left[i] += l[i];
      right[i] += rr[i];
    }
  }
  return encodeWav({ numberOfChannels: 2, length: r.length, sampleRate: r.sampleRate, getChannelData: (c: number) => (c === 0 ? left : right) } as unknown as AudioBuffer);
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
