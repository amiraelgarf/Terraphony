/** Screen 01 — The Record Library. "Where shall we listen?" */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type PointerEvent } from 'react';
import { useRecord } from '../app/RecordContext';
import { useActions } from '../app/useActions';
import { normalize } from '../audio/normalize';
import { loadPlace, type LandPlace } from '../data/adapters/modisNdviAdapter';
import { loadPresets, type OceanPreset } from '../data/adapters/oceanPresets';
import type { EarthRecord } from '../data/types';
import { parseRecipe, RecipeError } from '../export/recordRecipe';
import { OCEAN_COPY } from '../stories/ocean.config';
import { LAND_COPY } from '../stories/vegetation.config';
import { dialShape, pathD, smooth } from './geometry';
import { Masthead } from './Masthead';
import { RecordSleeve } from './RecordSleeve';
import { sceneHooks, tourDirector } from '../tour';
import type { StudioStory } from '../app/recordMachine';

/** Card -> studio: the record's groove/route grows into the geography (ms). */
const ZOOM_MS = 1150;

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

export function LibraryScene() {
  const { state } = useRecord();
  const a = useActions();
  const [preset, setPreset] = useState<OceanPreset | null>(null);
  const [place, setPlace] = useState<LandPlace | null>(null);
  const [zoom, setZoom] = useState<{ story: StudioStory; x: number; y: number; w: number; h: number } | null>(null);
  const zooming = useRef(false);
  const cards = { ocean: useRef<HTMLButtonElement>(null), vegetation: useRef<HTMLButtonElement>(null) };
  const tour = useSyncExternalStore((f) => tourDirector.subscribe(f), () => tourDirector.snapshot);
  const [importError, setImportError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadPresets().then((f) => setPreset(f.presets[0])).catch(() => setPreset(null));
    loadPlace('nile-delta').then(setPlace).catch(() => setPlace(null));
  }, []);

  /** Open a side with the shared groove -> path -> geography transition (crossfade if reduced motion). */
  function open(story: StudioStory): Promise<void> {
    if (zooming.current) return Promise.resolve();
    const art = cards[story].current?.querySelector('.choice__art');
    if (state.reducedMotion || !art) {
      a.go('studio', story);
      return Promise.resolve();
    }
    zooming.current = true;
    const r = art.getBoundingClientRect();
    setZoom({ story, x: r.left, y: r.top, w: r.width, h: r.height });
    return new Promise((done) =>
      window.setTimeout(() => {
        a.go('studio', story);
        done();
      }, ZOOM_MS),
    );
  }
  const openRef = useRef(open);
  openRef.current = open;
  useEffect(() => {
    const hook = (story: StudioStory) => openRef.current(story);
    sceneHooks.openStory = hook;
    return () => {
      if (sceneHooks.openStory === hook) delete sceneHooks.openStory;
    };
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
        <button ref={cards.ocean} className={`choice choice--ocean${tour.featured === 'ocean' ? ' is-featured' : ''}`} onPointerMove={tilt} onClick={() => open('ocean')} aria-describedby="choice-a-desc">
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

        <button ref={cards.vegetation} className={`choice choice--land${tour.featured === 'vegetation' ? ' is-featured' : ''}`} onPointerMove={tilt} onClick={() => open('vegetation')} aria-describedby="choice-b-desc">
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

      {zoom && (
        <div
          className={`zoom zoom--${zoom.story}`}
          style={{ ['--x0' as string]: `${zoom.x}px`, ['--y0' as string]: `${zoom.y}px`, ['--w0' as string]: `${zoom.w}px`, ['--h0' as string]: `${zoom.h}px` }}
          aria-hidden="true"
        >
          <div className="zoom__frame">
            {zoom.story === 'ocean' ? <OceanArt preset={preset} /> : <LandArt place={place} />}
            <span className="zoom__disc" />
          </div>
        </div>
      )}
    </section>
  );
}
