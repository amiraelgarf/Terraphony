/**
 * The science microscope for one note. Three depths in one place:
 *   curiosity  — one sentence
 *   discovery  — value, units, time, place, note
 *   research   — formula with the actual numbers, rules, QA, provenance (expandable)
 * Advanced visitors reach the formula in two interactions: select a note, open details.
 */
import { blockMean, changeFromPrevious, sectionOf } from '../audio/musicMapper';
import { midiToName, noteBand, normalize, noteIndex } from '../audio/normalize';
import { reliabilityLabel, type LandPlace } from '../data/adapters/modisNdviAdapter';
import type { EarthRecord } from '../data/types';
import { formatValue, interpretation, REASON_TEXT, whenText, whereText } from './sampleText';

type Props = {
  record: EarthRecord;
  index: number;
  place?: LandPlace | null;
  onClose: () => void;
  onHear: () => void;
  onPlayFrom: () => void;
  style?: React.CSSProperties;
  className?: string;
};

const SECTION = ['', 'Lead only', 'Lead + bass', 'Lead + bass + accents', 'Resolving'];

export function ScientificInspector({ record, index, place, onClose, onHear, onPlayFrom, style, className = '' }: Props) {
  const o = record.observations[index];
  const e = record.events[index];
  const rule = record.musicalRule;
  const n = record.events.length;
  if (!o || !e) return null;
  const valid = o.status === 'valid' && o.numericValue !== null;
  const norm = valid ? normalize(o.numericValue!, rule.domainMin, rule.domainMax) : null;
  const idx = norm ? noteIndex(norm.u) : null;
  const band = idx !== null ? noteBand(idx, rule.domainMin, rule.domainMax) : null;
  const delta = changeFromPrevious(record.observations, index);
  const bm = blockMean(record.observations, index);
  const sec = sectionOf(index, n);
  const unit = record.story === 'ocean' ? 'Stop' : 'Window';
  const w = place?.windows[index];
  const fv = (x: number) => formatValue(record, x, record.story === 'ocean' ? 2 : 3);
  const bandText = band
    ? !Number.isFinite(band[0]) ? `Every value below ${fv(band[1])}` : !Number.isFinite(band[1]) ? `Every value from ${fv(band[0])} up` : `Every value from ${fv(band[0])} to ${fv(band[1])}`
    : '';

  return (
    <aside className={`inspector ${className}`} style={style} aria-labelledby="inspector-title">
      <div className="inspector__head">
        <span className="eyebrow eyebrow--copper" id="inspector-title">
          {unit} {index + 1} of {n} · {valid ? midiToName(e.midiNote!) : 'Rest'}
        </span>
        <button className="inspector__close" onClick={onClose} aria-label="Close the note inspector">Close</button>
      </div>
      <p className="inspector__sentence">{interpretation(record, index)}</p>
      <dl className="inspector__facts">
        <div><dt>Value</dt><dd>{valid ? formatValue(record, o.numericValue, record.story === 'ocean' ? 2 : 3) : 'No valid measurement'}</dd></div>
        <div><dt>{record.story === 'ocean' ? 'Day' : 'Composite window'}</dt><dd>{whenText(record, index)}</dd></div>
        <div><dt>Where</dt><dd>{whereText(record, index)}</dd></div>
        <div><dt>Note</dt><dd>{valid ? `${midiToName(e.midiNote!)}${e.clamped ? ' (clamped)' : ''}` : 'Rest'}</dd></div>
      </dl>
      {!valid && <p className="inspector__rest">Shown as a ring in the score and on the map. Rests are never filled in with nearby values.</p>}
      <div className="inspector__actions">
        {valid && <button className="link-btn" onClick={onHear}>Hear this note</button>}
        <button className="link-btn" onClick={onPlayFrom}>Play from here</button>
      </div>
      <details className="inspector__details">
        <summary>Technical details: formula, rules and source</summary>
        {valid && norm && band && (
          <div className="inspector__formula">
            <code>
              u = clamp(({o.numericValue!.toFixed(3)} − ({rule.domainMin})) / ({rule.domainMax} − ({rule.domainMin})), 0, 1) = {norm.u.toFixed(3)}
            </code>
            <code>
              index = round(u × 10) = {idx} → {midiToName(e.midiNote!)} (MIDI {e.midiNote})
            </code>
            <p>
              {bandText} plays {midiToName(e.midiNote!)}, so two places can share a note while their numbers differ.
              {e.clamped && ` This value lies outside the fixed range ${rule.domainMin}–${rule.domainMax} ${rule.units} and was clamped to the nearest end.`}
            </p>
          </div>
        )}
        <dl className="inspector__table">
          <div><dt>Arrangement</dt><dd>{SECTION[sec]} (section {sec} of 4)</dd></div>
          <div><dt>Bass ({rule.bassRule.toLowerCase()})</dt><dd>{bm !== null ? formatValue(record, bm, 2) : 'silent: no valid values in this block'}{sec === 1 || sec === 4 ? ' — bass not playing in this section' : ''}</dd></div>
          <div><dt>Change from previous measured {unit.toLowerCase()}</dt><dd>{delta !== null ? `${delta > 0 ? '+' : ''}${formatValue(record, delta, record.story === 'ocean' ? 2 : 3)}` : '—'}{e.changeMarked ? ` ≥ ${rule.accentThreshold} → accent${sec < 3 ? ' (marked; accent voice enters in section 3)' : ''}` : ''}</dd></div>
          <div><dt>Status</dt><dd>{o.status}{o.reason ? ` (${REASON_TEXT[o.reason] ?? o.reason})` : ''}</dd></div>
          <div><dt>Quality</dt><dd>{String(o.qualityCode ?? '—')}</dd></div>
          {o.uncertainty !== undefined && <div><dt>Spread of pixels (std)</dt><dd>{o.uncertainty.toFixed(3)}</dd></div>}
          {Object.entries(o.detail ?? {}).map(([k, v]) => (v === null || v === undefined ? null : <div key={k}><dt>{k}</dt><dd>{String(v)}</dd></div>))}
          <div><dt>Variable</dt><dd>{record.source.variable}, {record.source.units}</dd></div>
          <div><dt>Product</dt><dd>{record.source.datasetName} {record.source.productVersion}</dd></div>
          <div><dt>Accessed via</dt><dd>{record.source.accessedVia}</dd></div>
          <div><dt>Source</dt><dd><a href={record.source.canonicalUrl} target="_blank" rel="noreferrer">{record.source.canonicalUrl.replace(/^https?:\/\//, '')}</a>{record.source.doi ? ` · doi:${record.source.doi}` : ''}</dd></div>
        </dl>
        {w && (
          <figure className="pixels">
            <div className="pixels__grid" style={{ ['--cols' as string]: place!.gridSize[1] }}>
              {w.pixels.map((p, k) => {
                const ok = (w.reliability[k] === 0 || w.reliability[k] === 1) && p !== null;
                return (
                  <span key={k} className={`pixels__cell${ok ? '' : ' is-rejected'}`} style={{ ['--v' as string]: p === null ? 0 : Math.max(0, Math.min(1, p / 0.9)) }} title={`${p === null ? 'no data' : `NDVI ${p.toFixed(3)}`} · QA ${reliabilityLabel(w.reliability[k])}`} />
                );
              })}
            </div>
            <figcaption>
              The {w.totalPixels} MODIS pixels (250 m) averaged for this window. Crossed cells failed quality checks ({w.totalPixels - w.acceptedPixels} here) and were left out.
            </figcaption>
          </figure>
        )}
      </details>
    </aside>
  );
}
