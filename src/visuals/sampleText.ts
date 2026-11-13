/**
 * Human-language descriptions of samples — captions, aria labels and the
 * inspector's first sentence share these, so sound-off and screen-reader
 * visitors get exactly the same information as listeners.
 */
import { changeFromPrevious } from '../audio/musicMapper';
import { midiToName } from '../audio/normalize';
import { windowLabel } from '../data/adapters/modisNdviAdapter';
import { formatGeo } from '../data/projections';
import type { EarthRecord } from '../data/types';

export const REASON_TEXT: Record<string, string> = {
  land: 'this point is on land',
  lake: 'this point is an inland lake, not the sea',
  sea_ice: 'sea ice covers this point, so no open-water temperature is used',
  cloud: 'clouds hid more than half of the pixels in this window',
  snow_ice: 'snow or ice covered more than half of the pixels in this window',
  fill: 'the satellite returned no data for this window',
};

export function formatValue(r: EarthRecord, v: number | null, digits?: number) {
  if (v === null) return 'no value';
  return r.story === 'ocean' ? `${v.toFixed(digits ?? 1)} °C` : `NDVI ${v.toFixed(digits ?? 2)}`;
}

export function whenText(r: EarthRecord, i: number) {
  const o = r.observations[i];
  if (r.story === 'ocean') return r.timeWindow.label;
  return `${windowLabel({ start: o.timeStart.slice(0, 10), end: o.timeEnd.slice(0, 10) })} ${o.timeStart.slice(0, 4)}`;
}

export function whereText(r: EarthRecord, i: number) {
  const o = r.observations[i];
  if (r.story === 'ocean' && o.position) return formatGeo(o.position);
  return r.geometry.label;
}

/** Short caption: "38.6°N 66.0°W · 24.3 °C → G4" */
export function sampleCaption(r: EarthRecord, i: number) {
  const o = r.observations[i], e = r.events[i];
  const lead = r.story === 'ocean' ? whereText(r, i) : whenText(r, i);
  if (o.status !== 'valid') return `${lead} · rest — ${REASON_TEXT[o.reason ?? ''] ?? 'no valid measurement'}`;
  return `${lead} · ${formatValue(r, o.numericValue)} → ${midiToName(e.midiNote!)}${e.changeMarked ? ' · accent' : ''}`;
}

/** One-sentence interpretation for the inspector. */
export function interpretation(r: EarthRecord, i: number) {
  const o = r.observations[i], e = r.events[i];
  if (o.status !== 'valid') return `No valid measurement here: ${REASON_TEXT[o.reason ?? ''] ?? 'the source has no value'}. The record plays a rest.`;
  const d = changeFromPrevious(r.observations, i);
  const note = midiToName(e.midiNote!);
  if (r.story === 'ocean') {
    const rel = d === null ? '' : Math.abs(d) < 0.05 ? ', about the same as the previous measured stop' : `, ${Math.abs(d).toFixed(1)} °C ${d > 0 ? 'warmer' : 'cooler'} than the previous measured stop`;
    return `Here the sea surface measured ${o.numericValue!.toFixed(1)} °C on ${r.timeWindow.label}${rel}. That temperature plays ${note}.`;
  }
  const level = o.numericValue! < 0.25 ? 'little green vegetation' : o.numericValue! < 0.5 ? 'some green vegetation' : o.numericValue! < 0.7 ? 'green vegetation' : 'dense green vegetation';
  const rel = d === null ? '' : Math.abs(d) < 0.01 ? ', about as green as the previous measured window' : `, ${d > 0 ? 'greener' : 'less green'} than the previous measured window by ${Math.abs(d).toFixed(2)}`;
  return `Between ${whenText(r, i)} the satellite saw ${level} here (NDVI ${o.numericValue!.toFixed(2)})${rel}. That plays ${note}.`;
}
