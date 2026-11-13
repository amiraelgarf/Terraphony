/**
 * Studio side-panel controls, kept separate so the scene file stays readable:
 *   RouteControls   suggested routes, draw tool, coordinate editor (keyboard route drawing)
 *   DateControl     "Listen at another moment" (fixed normalization across dates)
 *   PlaceControl    location chooser for the land story (always usable without the map)
 *   InstrumentControl, LayerMixer
 */
import { useState } from 'react';
import { LAYERS, PALETTES, type Layer } from '../audio/instruments';
import type { PlaceIndexEntry } from '../data/adapters/modisNdviAdapter';
import type { OceanPreset } from '../data/adapters/oceanPresets';
import { presetWaypoints } from '../data/adapters/oceanPresets';
import { MIN_ROUTE_KM, routeLengthKm } from '../data/geodesicPath';
import { clampLat, wrapLon } from '../data/projections';
import type { GeoPosition, InstrumentId } from '../data/types';
import type { OceanDraft } from '../app/recordMachine';
import { OCEAN_DATES } from '../stories/ocean.config';

export function RouteControls({ draft, presets, waypoints, onPatch }: { draft: OceanDraft; presets: OceanPreset[]; waypoints: GeoPosition[]; onPatch: (p: Partial<OceanDraft>) => void }) {
  const [editing, setEditing] = useState(false);
  const custom = draft.presetId === null;
  const pts = waypoints.length ? waypoints : [];

  function setPoints(next: GeoPosition[]) {
    onPatch({ presetId: null, waypoints: next.map((p) => ({ lat: clampLat(p.lat), lon: wrapLon(p.lon) })) });
  }
  const editable = custom ? draft.waypoints : pts;
  const lengthKm = editable.length > 1 ? routeLengthKm(editable) : 0;

  return (
    <fieldset className="field">
      <legend>Choose the line</legend>
      <div className="segmented" role="group" aria-label="Route tool">
        <button aria-pressed={draft.tool === 'preset'} onClick={() => onPatch({ tool: 'preset', presetId: draft.presetId ?? presets[0]?.id ?? null })}>Suggested route</button>
        <button aria-pressed={draft.tool === 'draw'} onClick={() => onPatch({ tool: 'draw' })}>Draw a route</button>
      </div>
      {draft.tool === 'preset' ? (
        <select aria-label="Suggested route" value={draft.presetId ?? ''} onChange={(e) => onPatch({ presetId: e.target.value })}>
          {custom && <option value="">Your drawn route</option>}
          {presets.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      ) : (
        <p className="field__note">Drag across the map to draw a line through the sea. It is resampled into 24 stops at equal distances along the Earth&apos;s surface.</p>
      )}
      {draft.presetId && <p className="field__note">{presets.find((p) => p.id === draft.presetId)?.note}</p>}
      <button className="link-btn link-btn--small" aria-expanded={editing} onClick={() => setEditing((v) => !v)}>
        {editing ? 'Close the coordinate editor' : 'Edit the route by coordinates'}
      </button>
      {editing && (
        <div className="coord-editor">
          <p className="field__note">Waypoints in degrees (north and east are positive). The route between them is sampled at 24 equal distances.</p>
          <ol>
            {editable.map((p, i) => (
              <li key={i}>
                <label>
                  <span className="sr-only">Waypoint {i + 1} latitude</span>
                  <input type="number" step="0.5" min={-89} max={89} value={Number(p.lat.toFixed(2))} onChange={(e) => setPoints(editable.map((q, j) => (j === i ? { ...q, lat: Number(e.target.value) } : q)))} />
                </label>
                <label>
                  <span className="sr-only">Waypoint {i + 1} longitude</span>
                  <input type="number" step="0.5" min={-180} max={180} value={Number(p.lon.toFixed(2))} onChange={(e) => setPoints(editable.map((q, j) => (j === i ? { ...q, lon: Number(e.target.value) } : q)))} />
                </label>
                <button className="mini-btn" disabled={editable.length <= 2} onClick={() => setPoints(editable.filter((_, j) => j !== i))} aria-label={`Remove waypoint ${i + 1}`}>Remove</button>
              </li>
            ))}
          </ol>
          <div className="coord-editor__actions">
            <button className="mini-btn" onClick={() => {
              const last = editable[editable.length - 1] ?? { lat: 0, lon: -30 };
              setPoints([...editable, { lat: last.lat, lon: last.lon + 5 }]);
            }}>Add a waypoint 5° east</button>
            {!custom && <button className="mini-btn" onClick={() => setPoints(pts)}>Edit a copy of this route</button>}
            {custom && presets[0] && <button className="mini-btn" onClick={() => onPatch({ presetId: presets[0].id, tool: 'preset' })}>Back to a suggested route</button>}
            {custom && draft.waypoints.length > 1 && <button className="mini-btn" onClick={() => setPoints([...draft.waypoints].reverse())}>Reverse direction</button>}
          </div>
          <p className="field__note">{editable.length > 1 ? `${Math.round(lengthKm).toLocaleString('en-GB')} km${lengthKm < MIN_ROUTE_KM ? ` — too short (minimum ${MIN_ROUTE_KM} km)` : ''}` : 'Add at least two waypoints.'}</p>
        </div>
      )}
    </fieldset>
  );
}

export function DateControl({ value, onChange, layer, onLayer }: { value: string; onChange: (k: 'A' | 'B') => void; layer: 'picture' | 'data'; onLayer: (l: 'picture' | 'data') => void }) {
  return (
    <fieldset className="field">
      <legend>Listen at another moment</legend>
      <div className="segmented" role="group" aria-label="Date">
        {OCEAN_DATES.map((d) => (
          <button key={d.key} aria-pressed={value === d.key} onClick={() => onChange(d.key)}>{d.label}</button>
        ))}
      </div>
      <p className="field__note">Same route, same note range (−2 to 31 °C) on both days, so notes can be compared honestly.</p>
      <div className="segmented segmented--quiet" role="group" aria-label="Map layer">
        <button aria-pressed={layer === 'picture'} onClick={() => onLayer('picture')}>NASA picture</button>
        <button aria-pressed={layer === 'data'} onClick={() => onLayer('data')}>Measured field</button>
      </div>
    </fieldset>
  );
}

export function PlaceControl({ places, value, onChange }: { places: PlaceIndexEntry[]; value: string; onChange: (id: string) => void }) {
  return (
    <fieldset className="field">
      <legend>Choose a landscape</legend>
      <div className="place-list" role="radiogroup" aria-label="Place">
        {places.map((p) => (
          <label key={p.id} className={`place-option${p.id === value ? ' is-on' : ''}`}>
            <input type="radio" name="place" value={p.id} checked={p.id === value} onChange={() => onChange(p.id)} />
            <span className="place-option__name">{p.name}</span>
            <span className="place-option__meta">{p.region} · {p.landscape}</span>
            <span className="place-option__meta">{p.summary.valid} of {p.summary.total} windows passed quality checks</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function InstrumentControl({ value, onChange }: { value: InstrumentId; onChange: (v: InstrumentId) => void }) {
  return (
    <fieldset className="field">
      <legend>Instrument character</legend>
      <div className="instrument-list" role="radiogroup" aria-label="Instrument character">
        {PALETTES.map((p) => (
          <label key={p.id} className={`instrument${p.id === value ? ' is-on' : ''}`}>
            <input type="radio" name="instrument" value={p.id} checked={p.id === value} onChange={() => onChange(p.id)} />
            <span className="instrument__name">{p.name}</span>
            <span className="instrument__desc">{p.description}</span>
          </label>
        ))}
      </div>
      <p className="field__note">Changes the timbre, never the measurement-to-pitch rule.</p>
    </fieldset>
  );
}

const LAYER_TEXT: Record<Layer, [string, string]> = {
  lead: ['Melody', 'data: each value'],
  bass: ['Bass', 'data: mean of each block of 4'],
  accent: ['Accents', 'data: declared changes'],
  cadence: ['Closing chord', 'artistic, not data'],
};

export function LayerMixer({ layers, volume, onLayer, onSolo, onVolume }: { layers: Record<Layer, boolean>; volume: number; onLayer: (l: Layer, on: boolean) => void; onSolo: (l: Layer | null) => void; onVolume: (v: number) => void }) {
  return (
    <details className="mixer">
      <summary>Layers and volume</summary>
      <ul>
        {LAYERS.map((l) => (
          <li key={l}>
            <label className="mixer__toggle">
              <input type="checkbox" checked={layers[l]} onChange={(e) => onLayer(l, e.target.checked)} />
              <span>{LAYER_TEXT[l][0]}</span>
              <small>{LAYER_TEXT[l][1]}</small>
            </label>
            <button className="mini-btn" onClick={() => onSolo(l)} aria-label={`Solo ${LAYER_TEXT[l][0]}`}>Solo</button>
          </li>
        ))}
      </ul>
      <button className="mini-btn" onClick={() => onSolo(null)}>All layers on</button>
      <label className="mixer__volume">
        Volume
        <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => onVolume(Number(e.target.value))} />
      </label>
    </details>
  );
}

export { presetWaypoints };
