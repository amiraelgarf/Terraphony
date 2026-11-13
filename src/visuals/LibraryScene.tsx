/** Screen 01 — The Record Library. "Where shall we listen?" */
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { useRecord } from '../app/RecordContext';
import { useActions } from '../app/useActions';
import { normalize } from '../audio/normalize';
import { loadPlace, type LandPlace } from '../data/adapters/modisNdviAdapter';
import { loadPresets, type OceanPreset } from '../data/adapters/oceanPresets';
import type { EarthRecord } from '../data/types';
import { parseRecipe, RecipeError } from '../export/recordRecipe';
import { FIRE_COPY } from '../stories/fire.config';
import { OCEAN_COPY } from '../stories/ocean.config';
import { LAND_COPY } from '../stories/vegetation.config';
import { Dialog } from './Dialog';
import { dialShape, pathD, smooth } from './geometry';
import { Masthead } from './Masthead';
import { RecordSleeve } from './RecordSleeve';

const BASE = import.meta.env.BASE_URL;

/** Pointer position as CSS variables, so the line detail follows the pointer. */
function tilt(e: PointerEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--px', ((e.clientX - r.left) / r.width).toFixed(3));
  e.currentTarget.style.setProperty('--py', ((e.clientY - r.top) / r.height).toFixed(3));
}

function OceanArt({ preset }: { preset: OceanPreset | null }) {
  const d = useMemo(
    () => (preset ? pathD(smooth(preset.waypoints.map(([lat, lon]) => ({ x: lon + 180, y: 90 - lat })), 8)) : ''),
    [preset],
  );
  return (
    <svg className="choice__art-svg" viewBox="82 14 130 98" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <image href={`${BASE}nasa-svs/svs3912-frame-26400.jpg`} x="0" y="0" width="360" height="180" preserveAspectRatio="none" />
      {d && <path d={d} fill="none" stroke="#f3d49c" strokeWidth={0.9} strokeLinecap="round" className="choice__route" pathLength={1} />}
    </svg>
  );
}

function LandArt({ place }: { place: LandPlace | null }) {
  const rings = useMemo(() => {
    if (!place) return [];
    let last = 0.5;
    const levels = place.windows.map((w) => ({ u: w.ndvi === null ? last : (last = normalize(w.ndvi, 0, 0.9).u) }));
    return Array.from({ length: 12 }, (_, k) => pathD(dialShape(levels, { x: 200, y: 160 }, 26 + k * 9, 6 + k * 3.2), true));
  }, [place]);
  return (
    <svg className="choice__art-svg" viewBox="0 0 400 320" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="400" height="320" fill="#26382c" />
      <g className="choice__rings">
        {rings.map((d, i) => (
          <path key={i} d={d} fill="none" stroke={i === 8 ? '#e7b276' : '#efe6d4'} strokeOpacity={i === 8 ? 0.95 : 0.16 + i * 0.03} strokeWidth={i === 8 ? 2 : 1} />
        ))}
      </g>
    </svg>
  );
}

/** A sober document grid — nothing invented, no flames. */
function FireArt() {
  return (
    <svg className="choice__art-svg" viewBox="0 0 400 320" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="400" height="320" fill="#2b2a28" />
      {Array.from({ length: 18 }, (_, i) => (
        <line key={i} x1={40} x2={360} y1={40 + i * 14} y2={40 + i * 14} stroke="#efe6d4" strokeOpacity={0.12} />
      ))}
      {Array.from({ length: 25 }, (_, i) => (
        <line key={`v${i}`} x1={40 + i * 13.33} x2={40 + i * 13.33} y1={40} y2={278} stroke="#efe6d4" strokeOpacity={0.06} />
      ))}
      <text x="40" y="302" className="choice__doc">14 JUL – 22 OCT 2021 · 12-HOUR WINDOWS</text>
    </svg>
  );
}

export function LibraryScene() {
  const { state } = useRecord();
  const a = useActions();
  const [preset, setPreset] = useState<OceanPreset | null>(null);
  const [place, setPlace] = useState<LandPlace | null>(null);
  const [fireOpen, setFireOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadPresets().then((f) => setPreset(f.presets[0])).catch(() => setPreset(null));
    loadPlace('nile-delta').then(setPlace).catch(() => setPlace(null));
  }, []);

  async function onImport(f: File | undefined) {
    if (!f) return;
    try {
      const rec: EarthRecord = parseRecipe(await f.text());
      setImportError(null);
      a.importRecord(rec);
    } catch (e) {
      setImportError(e instanceof RecipeError ? e.message : 'That file could not be read.');
    } finally {
      if (file.current) file.current.value = '';
    }
  }

  return (
    <section className="scene scene--library" aria-labelledby="library-title">
      <Masthead />
      <div className="library__intro">
        <div>
          <span className="eyebrow eyebrow--gold">The library / Pick a side</span>
          <h1 id="library-title" className="display">
            Where shall
            <br />
            we <em>listen?</em>
          </h1>
        </div>
        <p>There are different ways to hear a planet. Choose a journey; the science comes with it.</p>
      </div>

      <div className="shelf-row">
        <button className="choice choice--ocean" onPointerMove={tilt} onClick={() => a.go('studio', 'ocean')} aria-describedby="choice-a-desc">
          <div className="choice__art">
            <OceanArt preset={preset} />
            <span className="choice__disc" aria-hidden="true" />
            <span className="choice__band eyebrow"><span>Side A</span><span>A path through space</span></span>
          </div>
          <div className="choice__body">
            <span className="eyebrow eyebrow--gold">{OCEAN_COPY.question}</span>
            <h2 className="display">Ocean<br />in Motion</h2>
            <p id="choice-a-desc">{OCEAN_COPY.libraryLine}</p>
            <span className="choice__source">Sea surface temperature, °C · MUR v4.1 · picture NASA SVS 3912</span>
            <span className="choice__go">Open the atlas <span aria-hidden="true">→</span></span>
          </div>
        </button>

        <button className="choice choice--land" onPointerMove={tilt} onClick={() => a.go('studio', 'vegetation')} aria-describedby="choice-b-desc">
          <div className="choice__art">
            <LandArt place={place} />
            <span className="choice__disc" aria-hidden="true" />
            <span className="choice__band eyebrow"><span>Side B</span><span>A journey through time</span></span>
          </div>
          <div className="choice__body">
            <span className="eyebrow eyebrow--sage">{LAND_COPY.question}</span>
            <h2 className="display">A Year in<br />One Place</h2>
            <p id="choice-b-desc">{LAND_COPY.libraryLine}</p>
            <span className="choice__source">Vegetation greenness (NDVI) · MODIS MOD13Q1 v061 · 2023</span>
            <span className="choice__go">Choose a place <span aria-hidden="true">→</span></span>
          </div>
        </button>

        <button className="choice choice--fire is-planned" onClick={() => setFireOpen(true)} aria-describedby="choice-c-desc">
          <div className="choice__art">
            <FireArt />
            <span className="choice__band eyebrow"><span>Side C</span><span>{FIRE_COPY.status}</span></span>
          </div>
          <div className="choice__body">
            <span className="eyebrow eyebrow--muted">{FIRE_COPY.question}</span>
            <h2 className="display">A Landscape<br />Interrupted</h2>
            <p id="choice-c-desc">{FIRE_COPY.libraryLine}</p>
            <span className="choice__source">Planned · Dixie Fire 2021 · not playable yet</span>
            <span className="choice__go">Why it is not ready <span aria-hidden="true">→</span></span>
          </div>
        </button>
      </div>

      <div className="library__shelf">
        <div className="library__shelf-head">
          <h2 className="eyebrow">Your shelf{state.shelf.length > 0 ? ` · ${state.shelf.length}` : ''}</h2>
          <label className="link-btn file-btn">
            Open a record recipe (JSON)
            <input ref={file} type="file" accept="application/json,.json" onChange={(e) => onImport(e.target.files?.[0])} />
          </label>
        </div>
        {importError && <p className="error-note" role="alert">{importError}</p>}
        {state.shelf.length === 0 ? (
          <p className="library__empty">Records you press are kept here, in this browser only.</p>
        ) : (
          <ul className="shelf-list">
            {state.shelf.map((r) => (
              <li key={r.recordId}>
                <button className="shelf-item" onClick={() => a.openShelf(r)} aria-label={`Open “${r.title}”`}>
                  <RecordSleeve record={r} size="small" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={fireOpen} onClose={() => setFireOpen(false)} title="Not pressed yet." overline="Side C · In preparation">
        <p>
          This record will follow a documented wildfire, the 2021 Dixie Fire in California, window by window as NASA&apos;s visualization does (
          <a href={FIRE_COPY.svs} target="_blank" rel="noreferrer">SVS 4993</a>). It stays unplayable until the observations are integrated and reviewed. It needs:
        </p>
        <ul className="plain-list">
          {FIRE_COPY.needs.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
        <p className="muted">One detection is not one fire, and no detection does not prove nothing was burning. The event affected real communities; it will be scored soberly or not at all.</p>
      </Dialog>
    </section>
  );
}
