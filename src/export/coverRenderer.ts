/**
 * Sleeve PNG renderer. Draws the SAME geometry as the on-screen sleeve
 * (visuals/geometry.ts:sleeveArt) with Path2D, plus typography, credits and
 * provenance, at full resolution (default 2400 x 2400). No DOM screenshot.
 */
import type { EarthRecord } from '../data/types';
import { formatGeo } from '../data/projections';
import { paletteName } from '../audio/instruments';
import { sleeveArt } from '../visuals/geometry';
import { catalogueNumber } from './recordRecipe';
import { sleeveLines } from '../visuals/sleeveText';

export async function renderSleevePng(record: EarthRecord, px = 2400): Promise<Blob> {
  if (document.fonts?.ready) await document.fonts.ready;
  const art = sleeveArt(record, 1000);
  const c = document.createElement('canvas');
  c.width = px;
  c.height = px;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser.');
  const k = px / art.size;
  ctx.scale(k, k);

  const g = ctx.createRadialGradient(380, 300, 40, 500, 500, 760);
  g.addColorStop(0, art.background[0]);
  g.addColorStop(1, art.background[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1000, 1000);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of art.strokes) {
    ctx.globalAlpha = s.opacity;
    ctx.strokeStyle = s.stroke;
    ctx.lineWidth = s.width;
    ctx.setLineDash(s.dash ? s.dash.split(' ').map(Number) : []);
    ctx.stroke(new Path2D(s.d));
  }
  ctx.setLineDash([]);
  for (const m of art.marks) {
    ctx.globalAlpha = m.rest ? 0.7 : 1;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
    if (m.rest) {
      ctx.strokeStyle = art.ink;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    } else {
      ctx.fillStyle = art.accent;
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  const L = sleeveLines(record);
  const mono = (size: number) => `500 ${size}px "DM Mono", ui-monospace, monospace`;
  ctx.fillStyle = art.ink;
  ctx.textBaseline = 'alphabetic';

  ctx.font = mono(15);
  ctx.globalAlpha = 0.85;
  ctx.fillText('EARTH / RECORDS', 64, 84);
  ctx.textAlign = 'right';
  ctx.fillText(catalogueNumber(record), 936, 84);
  ctx.textAlign = 'left';

  // title (wraps to 3 lines max)
  ctx.globalAlpha = 1;
  ctx.font = `400 84px "Instrument Serif", Georgia, serif`;
  const words = record.title.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > 820 && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  const shown = lines.slice(0, 3);
  shown.forEach((ln, i) => ctx.fillText(ln, 62, 848 - (shown.length - 1 - i) * 80));

  ctx.font = mono(14);
  ctx.globalAlpha = 0.9;
  ctx.fillText(L.sideLine.toUpperCase(), 64, 906);
  ctx.textAlign = 'right';
  ctx.fillText(L.detailLine.toUpperCase(), 936, 906);
  ctx.textAlign = 'left';
  ctx.globalAlpha = 0.62;
  ctx.font = mono(11.5);
  ctx.fillText(`${L.sourceLine}  ·  ${paletteName(record.instrumentPaletteId)}`.toUpperCase(), 64, 944);
  if (record.geometry.points?.length) {
    ctx.textAlign = 'right';
    ctx.fillText(`${formatGeo(record.geometry.points[0])} → ${formatGeo(record.geometry.points[record.geometry.points.length - 1])}`, 936, 944);
    ctx.textAlign = 'left';
  }

  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed'))), 'image/png'));
}
