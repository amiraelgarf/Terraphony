/** Text printed on every sleeve (screen and PNG use the same lines). */
import type { EarthRecord } from '../data/types';

export function sleeveLines(r: EarthRecord) {
  const n = r.events.length;
  const rests = r.events.filter((e) => e.midiNote === null).length;
  const side = r.story === 'ocean' ? 'Side A · Ocean in Motion' : 'Side B · A Year in One Place';
  const unit = r.story === 'ocean' ? 'stops' : 'windows';
  return {
    sideLine: side,
    detailLine: `${n} ${unit}${rests ? ` · ${rests} rest${rests > 1 ? 's' : ''}` : ''} · ${r.timeWindow.label}`,
    sourceLine: r.story === 'ocean' ? 'MUR SST v4.1 · NASA JPL' : 'MODIS MOD13Q1 v061 · NASA',
  };
}
