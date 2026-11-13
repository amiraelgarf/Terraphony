/** "What's behind these notes?" — the rules of the current story on one sheet. */
import { useActions } from '../app/useActions';
import type { StudioStory } from '../app/recordMachine';
import { midiToName, noteBand, PITCHES_MIDI } from '../audio/normalize';
import type { EarthRecord } from '../data/types';
import { OCEAN_RULE, OCEAN_SOURCE } from '../stories/ocean.config';
import { LAND_RULE, LAND_SOURCE } from '../stories/vegetation.config';
import { Dialog } from './Dialog';

export function NoteTable({ story }: { story: StudioStory }) {
  const rule = story === 'ocean' ? OCEAN_RULE : LAND_RULE;
  const d = story === 'ocean' ? 1 : 2;
  const f = (x: number) => (Number.isFinite(x) ? x.toFixed(d) : '');
  return (
    <table className="note-table">
      <caption>Fixed note ranges, {rule.domainMin} to {rule.domainMax} {rule.units} (same for every record of this side)</caption>
      <thead>
        <tr><th scope="col">Note</th><th scope="col">{story === 'ocean' ? 'Temperature' : 'NDVI'}</th></tr>
      </thead>
      <tbody>
        {[...PITCHES_MIDI].map((m, i) => {
          const [a, b] = noteBand(i, rule.domainMin, rule.domainMax);
          return (
            <tr key={m}>
              <th scope="row">{midiToName(m)}</th>
              <td>{!Number.isFinite(a) ? `below ${f(b)}` : !Number.isFinite(b) ? `${f(a)} and above` : `${f(a)} – ${f(b)}`} {story === 'ocean' ? '°C' : ''}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function ScienceDialog({ open, onClose, story, record }: { open: boolean; onClose: () => void; story: StudioStory; record: EarthRecord | null }) {
  const a = useActions();
  const src = story === 'ocean' ? OCEAN_SOURCE : LAND_SOURCE;
  const rule = story === 'ocean' ? OCEAN_RULE : LAND_RULE;
  return (
    <Dialog open={open} onClose={onClose} title="Every note has an origin." overline="Inside the sound" wide>
      <div className="science-grid">
        <div>
          <p className="lead">
            {story === 'ocean'
              ? 'Each note is the sea-surface temperature at one stop of your line, on one day. Warmer water plays higher. The NASA picture behind the map is the ECCO2 model visualization of the same day; the numbers come from a separate, observation-based analysis (MUR).'
              : 'Each note is how green one place looked from space during one 16-day window. Greener plays higher. Greenness (NDVI) is not plant health on its own: seasons, crops, rain and snow all shape it.'}
          </p>
          <h3>What you hear</h3>
          <ul className="plain-list">
            <li><strong>Melody</strong> — the value itself, one note per {story === 'ocean' ? 'stop' : 'window'}.</li>
            <li><strong>Bass</strong> — {rule.bassRule.toLowerCase()}. Enters after the first phrase.</li>
            <li><strong>Accents</strong> — {rule.accentRule.toLowerCase()}. Enter halfway.</li>
            <li><strong>Closing chord</strong> — artistic. It carries no data.</li>
            <li><strong>Rests</strong> — {story === 'ocean' ? 'land, lakes and sea ice' : 'windows where clouds or snow hid most pixels'}. Never filled in.</li>
          </ul>
          <h3>Source</h3>
          <p>
            {src.datasetName} {src.productVersion} · {src.variable} · {src.units} · {src.temporalResolution} · {src.spatialResolution}.{' '}
            <a href={src.canonicalUrl} target="_blank" rel="noreferrer">Product page</a>{src.doi ? ` · doi:${src.doi}` : ''}. Accessed via {src.accessedVia}.
          </p>
          {record && <p className="muted">This record: {record.geometry.label} · {record.timeWindow.label} · {record.events.length} notes, {record.events.filter((e) => e.midiNote === null).length} rests.</p>}
          <button className="link-btn" onClick={() => { onClose(); a.go('method'); }}>Read the full method</button>
        </div>
        <NoteTable story={story} />
      </div>
    </Dialog>
  );
}
