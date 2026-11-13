# Architecture — how the code works

This document explains the whole repository: what every file is responsible for, how the
pieces talk to each other, and how data travels from a NASA server to a note you hear and a
sleeve you download. Read it top to bottom once; afterwards use the file tables as a map.

- [1. The big picture](#1-the-big-picture)
- [2. Two worlds: offline pipeline vs. browser app](#2-two-worlds-offline-pipeline-vs-browser-app)
- [3. The offline pipeline (`scripts/`)](#3-the-offline-pipeline-scripts)
- [4. The files that cross the boundary (`public/`)](#4-the-files-that-cross-the-boundary-public)
- [5. The browser app (`src/`) — layer by layer](#5-the-browser-app-src--layer-by-layer)
- [6. How the layers communicate](#6-how-the-layers-communicate)
- [7. Five journeys traced through the code](#7-five-journeys-traced-through-the-code)
- [8. The core data shapes](#8-the-core-data-shapes)
- [9. Tests and what they guard](#9-tests-and-what-they-guard)
- [10. Rules the code keeps (invariants)](#10-rules-the-code-keeps-invariants)
- [11. Config and tooling files](#11-config-and-tooling-files)

---

## 1. The big picture

```
 NASA / NOAA / ORNL servers
          │  (HTTP, once, offline — Python)
          ▼
 scripts/  ──►  data-raw/  (downloads, checksums, git-ignored)
          │
          ▼  processed, small, validated files
 public/data/ , public/nasa-svs/
          │  (fetch() at run time — browser)
          ▼
 src/data/adapters  ──► ObservationSample[]   (a value OR an explained rest)
          │
          ▼
 src/audio/musicMapper ──► MusicEvent[]       (notes, bass, accents, closing chord)
          │
          ├──► src/audio/transport  ── one clock ──► sound + step callbacks
          │                                          │
          │                                          ▼
          │                       src/app (state) ──► src/visuals (map, dial, score, inspector)
          │
          └──► src/export/recordRecipe ──► EarthRecord ──► sleeve SVG / PNG · JSON · WAV
```

The single most important idea: **every visible or audible thing is derived from one ordered
list of observations**. The map stops, the score marks, the notes, the year-dial spokes, the
spiral groove and the sleeve artwork are all different drawings of the same list, in the same
order. Nothing is generated independently.

---

## 2. Two worlds: offline pipeline vs. browser app

| | Offline pipeline | Browser app |
|---|---|---|
| Language | Python 3 (numpy, Pillow, scipy) | TypeScript + React 18 (Vite) |
| Folder | `scripts/` | `src/` |
| Runs | rarely, by a developer (`npm run pipeline`) | every visit |
| Talks to the internet | yes (NASA SVS, ERDDAP, ORNL DAAC) | no — only fetches its own `public/` files |
| Output | files in `public/` | sound, pictures, downloads |

The only thing the two worlds share is **files in `public/`** (section 4). The browser never
touches raw NASA data, and the Python never knows about React. Two places must agree on rules —
the geodesic resampling and the grid sampling — so the Python writes **reference answers**
(`presets.json`) and a TypeScript test checks the browser gets the same answers
(`src/tests/pythonParity.test.ts`).

---

## 3. The offline pipeline (`scripts/`)

`run_pipeline.py` runs the steps in order; each step is also a standalone script. Data moves
between steps only through files.

```
pipeline_config.py   (every date, place, URL, range — imported by all steps)
net.py               (download with retries + SHA-256)
geo_lib.py           (haversine + equal-distance resampling — mirrors src/data/geodesicPath.ts)
svs_lib.py           (read NASA's legend ramp; detect gray land in an SVS frame)

 1 acquire_svs3912_frames.py ──► data-raw/*.tif, sst_ecco2_cbar.png, flat_ecco2_dates.txt, acquisition.json
 2 acquire_mur_sst.py        ──► data-raw/mur/mur-YYYYMMDD.nc, acquisition.json
 3 build_ocean_grids.py      ──► public/data/ocean/mur-sst-*.bin|png, grid.json; public/nasa-svs/*.jpg; public/data/legend.json
 4 validate_ocean_alignment.py ─► data-raw/validation.json (exit 1 if picture and numbers don't line up)
 5 build_ocean_presets.py    ──► public/data/ocean/presets.json (routes + Python reference samples)
 6 acquire_modis_ndvi.py     ──► data-raw/modis/<place>.json, acquisition.json
 7 build_land_series.py      ──► public/data/land/<place>.json, places.json
 8 export_manifest.py        ──► public/data/manifest.json (gathers 1–7 into one provenance file)
```

| File | Responsibility | Key functions |
|---|---|---|
| `pipeline_config.py` | Single source of every choice: SVS frame numbers, `OCEAN_DATES`, ERDDAP stride, ice threshold, ocean range `(-2, 31)` and accent `1.0`, MODIS product/year, land places, land range `(0, 0.9)`, pitches | constants only |
| `net.py` | `fetch(url)` with 5 retries and backoff; `download(url, dest)` skips existing files; `sha256(path)` | `fetch`, `download`, `sha256` |
| `geo_lib.py` | Geometry identical to the browser: unwrap longitudes across ±180°, densify to 0.25°, cumulative haversine km, equal-distance stops | `haversine_km`, `resample_geographic` |
| `svs_lib.py` | `legend_lut` finds the coloured bar in NASA's legend PNG and returns its colour ramp (used only to **draw** the MUR data map); `svs_land_mask` marks NASA's gray relief pixels (used only for validation) | `legend_lut`, `svs_land_mask` |
| `acquire_svs3912_frames.py` | Downloads the two NASA frames, legend and frame→time table | `main` |
| `acquire_mur_sst.py` | Builds ERDDAP URLs asking for `analysed_sst`, `sea_ice_fraction`, `mask` every 25th point for each date; saves NetCDF | `query_url`, `main` |
| `build_ocean_grids.py` | Reads NetCDF (scipy), flips rows so north is first, **encodes** each cell as int16: value×100 or a mask code (land −32768, lake −32767, missing −32766, ice −30000−percent). Renders a PNG of the values with NASA's legend. Writes `grid.json` (size, origin, spacing, encoding, percentiles). Re-encodes the SVS frames as web JPEGs | `load_mur`, `encode`, `render_data_map` |
| `validate_ocean_alignment.py` | Proves the NASA picture and MUR grid share registration: 24 named land/sea landmarks + land-mask agreement ≥ 95 % | `main` |
| `build_ocean_presets.py` | Hand-authored suggested routes → 24 stops → samples them with the **same rule as the browser** (`sample`) → stores results as `reference` | `sample`, `status_of`, `note_index` |
| `acquire_modis_ndvi.py` | Asks ORNL for the list of 2023 composite dates, then NDVI / reliability / day-of-year for a 9×9 pixel window, 10 dates per request | `composite_dates`, `main` |
| `build_land_series.py` | Per 16-day window: accept pixels with reliability 0/1, mean if ≥ 50 % accepted, otherwise a rest labelled `snow_ice` or `cloud`. Keeps raw pixels for the inspector | `main` |
| `export_manifest.py` | Joins everything: product names, versions, DOIs, checksums, frame times (checked against `OCEAN_DATES`), validation, the 11 official challenge resources | `frame_times`, `main` |
| `run_pipeline.py` | Runs the 8 steps with `runpy`; a failed validation is reported but doesn't stop the run | — |

---

## 4. The files that cross the boundary (`public/`)

These are the only contract between Python and TypeScript. Vite serves `public/` as-is, and the
app fetches with `import.meta.env.BASE_URL` so it works from any sub-folder.

| File | Written by | Read by (TypeScript) | Format |
|---|---|---|---|
| `data/ocean/grid.json` | build_ocean_grids | `murSstAdapter.loadOceanMeta` | width 1440, height 720, `lat0`, `dLat` (−0.25), `lon0`, `dLon`, encoding codes, per-date file names |
| `data/ocean/mur-sst-YYYYMMDD.bin` | build_ocean_grids | `murSstAdapter.loadOceanGrid` → `Int16Array` | 1440×720 int16 little-endian, row 0 = north |
| `data/ocean/mur-sst-YYYYMMDD.png` | build_ocean_grids | `OceanAtlas` (`<image>` for "Measured field") | RGBA picture of the numbers |
| `data/ocean/presets.json` | build_ocean_presets | `oceanPresets.loadPresets`; `pythonParity.test` | routes (waypoints, name, note, km) + reference samples |
| `data/land/places.json` | build_land_series | `modisNdviAdapter.loadPlaceIndex` | list of places + summaries |
| `data/land/<id>.json` | build_land_series | `modisNdviAdapter.loadPlace` | 23 windows: dates, status, reason, NDVI, std, pixels, reliability |
| `data/manifest.json` | export_manifest | `MethodScene` | provenance and validation |
| `data/legend.json` | build_ocean_grids | (documentation; colour stops of NASA's legend) | JSON |
| `nasa-svs/svs3912-frame-*.jpg` | build_ocean_grids | `OceanAtlas`, `LibraryScene` (`<image>`) | 2048×1024 picture |

Why a binary grid instead of JSON? 1 million values as JSON would be ~10 MB and slow to parse; as
int16 it is 2 MB and becomes an `Int16Array` with zero parsing.

---

## 5. The browser app (`src/`) — layer by layer

Dependencies only point **downwards** in this list. Lower layers never import upper ones, which
is what keeps the code testable (all of `data/`, `audio/normalize`, `audio/musicMapper`,
`export/recordRecipe` and `visuals/geometry` run in Node tests with no browser).

```
 entry      main.tsx → App.tsx
 visuals    scenes + components (React)               ← render state, call actions
 tour       tourDirector · narration · TourBridge     ← the guided journey (talks to app via a host)
 app        recordMachine · RecordContext · useActions · useStudioRecord · persistence
 export     recordRecipe · coverRenderer · wavRenderer
 audio      transport · instruments · musicMapper · normalize
 stories    ocean / vegetation configs (sources, rules, copy)
 data       types · projections · geodesicPath · adapters/*
```

### 5.1 Entry

| File | Responsibility |
|---|---|
| `main.tsx` | Loads fonts (Fontsource) and the six stylesheets, mounts `<App/>` |
| `App.tsx` | Error boundary (`Boundary`), `RecordProvider`, the screen-reader live region `#announcer`, and `Scenes`: picks one scene component from `state.scene`. The `key` changes per scene so each scene remounts (fresh enter animation) and scrolls to top |

### 5.2 `data/` — facts about the Earth, no React, no sound

| File | Responsibility |
|---|---|
| `types.ts` | The contracts from the brief: `ObservationSample`, `MusicalRule`, `MusicEvent`, `ScientificSource`, `EarthRecord`, `GeoPosition`, statuses (`valid / missing / masked / quality_rejected`) |
| `projections.ts` | Equirectangular maths. Map units: x = lon+180, y = 90−lat (1 unit = 1°). `geoToMap`, `mapToGeo` (inverse projection), `wrapLon`, `formatGeo` |
| `geodesicPath.ts` | `resampleGeographic(waypoints, 24)` → 24 stops at equal great-circle distance (mirror of `geo_lib.py`); `thinTrace` removes pointer noise (≥ 60 km apart); `isDegenerateRoute` (< 300 km) |
| `adapters/murSstAdapter.ts` | `OceanGrid` class wraps the `Int16Array`: `statusOf(code)` decodes mask codes; `sample(lat, lon)` = nearest cell decides status, otherwise bilinear over valid corners. `loadOceanGrid(key)` fetches and caches per date. `sampleRoute()` turns 24 stops into 24 `ObservationSample`s with provenance details |
| `adapters/modisNdviAdapter.ts` | `loadPlace(id)` / `loadPlaceIndex()` (cached fetch), `placeSamples(place)` → 23 `ObservationSample`s, `windowLabel` ("13–28 Aug"), `reliabilityLabel` |
| `adapters/modisLiveAdapter.ts` | **Any place.** `fetchLandPoint(lat, lon, onProgress)` asks the ORNL MODIS service (NDVI + reliability, chunks of 10 dates, in parallel, one retry). `buildLandPlace(raw)` is the pure port of `build_land_series.py`. `pointId`/`parsePointId` keep the coordinate in the place id (`pt:47.00,1.00`). Results are cached in memory and `localStorage` |
| `adapters/oceanPresets.ts` | `loadPresets()` and `presetWaypoints()` |

### 5.3 `stories/` — what each side *is*

Plain objects, no logic. Each holds a `ScientificSource` (product, version, DOI, units,
transform notes, credit), a `MusicalRule` (range, scale, accent threshold, tempo, bass/accent
descriptions) and the copy. Changing a sentence or a range happens here.

| File | Contents |
|---|---|
| `ocean.config.ts` | `OCEAN_SOURCE` (MUR), `OCEAN_RULE` (−2…31 °C, accent 1 °C, 120 bpm), `OCEAN_DATES` (A/B), `OCEAN_COPY` |
| `vegetation.config.ts` | `LAND_SOURCE` (MOD13Q1), `LAND_RULE` (0…0.9 NDVI, accent 0.08), `LAND_COPY` |

### 5.4 `audio/` — from numbers to sound

| File | Responsibility |
|---|---|
| `normalize.ts` | **The one rule.** `normalize(value, lo, hi)` → `u` + clamped flag; `noteIndex(u)` = round(u×10); `valueToMidi`; `noteBand` (which value range plays a note); `midiToName` ("G4"), `midiToTone` (Tone.js names) |
| `musicMapper.ts` | `buildEvents(samples, rule)` → one `MusicEvent` per sample: lead note or rest, bass on block starts in sections 2–3 (`blockMean`), accent when `changeFromPrevious` ≥ threshold in sections 3–4, artistic cadence on the last event. `sectionOf` / `sectionBounds` (5/24, 12/24, 20/24). `notableIndex` (biggest change: the guided journey's planned discovery). `eventHash` (FNV-1a, used for record ids and tests) |
| `ensemble.ts` | **Pure** `arrange(events)`: turns the record's events into an ensemble part without changing them. The melody and data bass exactly as the original engine played them, plus one derived layer: soft low strings (a pentatonic `triad` built on the bass, or on the melody in the resolve). It also has soft bells for declared changes, and the closing chord |
| `instruments.ts` | `createVoices(Tone, paletteId)` builds the ensemble for Glass / Wood / Felt on five buses (lead, bass, harmony, accent, cadence). Each bus goes dry plus a reverb send → master → 9.5 kHz high cut → compressor → limiter. `perform(Tone, v, performedEvent, time, beat)` plays one arranged event, and `releaseAll` releases them. Both are shared by live playback and the WAV export |
| `transport.ts` | The **only** owner of sound and the **single clock**. Singleton `transport`. Details in §6.3 |

### 5.5 `app/` — state and behaviour

| File | Responsibility |
|---|---|
| `recordMachine.ts` | The state shape (`State`), every allowed change (`Action` union + `reducer`), and hash routing (`parseHash`, `toHash`). Pure functions — no side effects |
| `RecordContext.tsx` | `RecordProvider`: creates the reducer (initial state from URL + localStorage in `boot()`), runs every **side effect** that follows state: save drafts/shelf, state→URL, URL→state on back/forward, reduced-motion listener, push mix/volume/palette into the transport, load the current record as the transport program, pause on hidden tab. Exposes `{ state, dispatch, studio, activeRecord }` through `useRecord()` |
| `useStudioRecord.ts` | Turns the visitor's *choices* into a *draft record*: loads presets/grid/place (async, cached), resamples the route, samples it, and calls `buildRecord` (with a fixed draft timestamp). Returns `{ status, record, presets, routeWaypoints, place }` |
| `useActions.ts` | Every user **intent** as a function: `ensureSound`, `setSound`, `togglePlay`, `stopPlayback`, `inspect`, `go`, `press`, `openShelf`, `importRecord`, `removeFromShelf`. Components call these instead of dispatching raw actions or touching the transport |
| `persistence.ts` | Guarded `localStorage` read/write for drafts and the shelf (max 12 records) |

### 5.6 `export/` — making the record portable

| File | Responsibility |
|---|---|
| `recordRecipe.ts` | `buildRecord(input)` assembles an `EarthRecord` (derives events, id = story + event hash + time). `toRecipeJson`, `parseRecipe` (validates, re-derives events, refuses mismatches), `catalogueNumber` ("ER-A-B049"), `recipeFileName` |
| `coverRenderer.ts` | `renderSleevePng(record)` — draws `sleeveArt()` paths onto a 2400×2400 canvas with `Path2D`, then the typography with the loaded webfonts, returns a PNG `Blob` |
| `wavRenderer.ts` | `renderRecordWav(record)` — loads Tone, renders the events in `Tone.Offline` with the same voices, `encodeWav` writes a 16-bit PCM RIFF file |

### 5.7 `visuals/` — what you see

Scenes (one is mounted at a time):

| File | Screen | What it owns |
|---|---|---|
| `ArrivalScene.tsx` | 00 Invitation | headline, *Make my Earth Record*, the host's *Begin the narrated journey* invitation, the leave choreography (also lent to the director as `sceneHooks.leaveArrival`); uses `EarthRecordHero` |
| `LibraryScene.tsx` | 01 Library | two sleeves (real NASA frame + route; real NDVI rings), the featured highlight while the host speaks, the card → studio zoom (`open(story)`, also lent as `sceneHooks.openStory`), the shelf, recipe import |
| `StudioScene.tsx` | 02 Studio | layout; chooses `OceanAtlas` or (lazy-loaded) `LandAtlas`; panel controls; readout; play/press buttons; anchored inspector; score footer (the docked living score) |
| `RecordPress.tsx` | 03 Press | the 4-beat morph: own `requestAnimationFrame` loop interpolating origin → score → spiral shapes; triggers phrase / stylus / chord sounds; then `go('reveal')` |
| `RevealScene.tsx` | 04 Reveal | sleeve + disc, liner notes, play, notes explorer, the three exports |
| `MethodScene.tsx` | How it works | full method; reads `manifest.json` for validation numbers and official resources |

Components and helpers:

| File | Responsibility |
|---|---|
| `Masthead.tsx` | brand, act label, nav, the Sound on/off pill |
| `Dialog.tsx` | accessible modal: focus in, Tab trap, Esc, focus returns to opener |
| `EarthRecordHero.tsx` | the arrival sculpture: d3-geo orthographic globe (Natural Earth 110m) rotated by its own rAF loop, grooves, ticks, gold ring, tonearm, iris |
| `OceanAtlas.tsx` | SVG map in degree units; NASA picture or data map repeated at −360/0/+360 for dateline routes; viewBox pan/zoom; pointer → `getScreenCTM().inverse()` → `mapToGeo`; drawing → `thinTrace` → `onRoute`; stops, played line, cursor; reports the selected stop's screen position (`onAnchor`) |
| `LandAtlas.tsx` | Movable d3-geo equirectangular map (drag to pan, zoom levels; a short click → `onPoint(lat, lon)`). Underneath: the NASA GIBS MODIS 16-day NDVI picture for the window on the clock or selected. `gibsUrl` builds one picture per window for the visible box; all 23 are preloaded, the on-screen window first, and they crossfade. Above: coastline, place markers, the live-fetch status, and the year dial on a dark ring backdrop (spokes, ring, month guides, clock hand) |
| `StudioControls.tsx` | `RouteControls` (presets, draw tool, coordinate editor), `DateControl`, `PlaceControl`, `InstrumentControl`, `LayerMixer` |
| `SonicScore.tsx` | the score as a real staff: 5 lines; the 11 pitches sit on lines and spaces; oval heads with stems up or down; a bar line every 4 notes (the bass block); section labels; accent marks over changes; dashed rings for rests; a cursor gliding from note centre to note centre. One button per event (roving tabindex, arrow keys), plus the caption line |
| `ScientificInspector.tsx` | three depths for one note: sentence → facts → technical details (formula with real numbers, bands, bass, change, QA, provenance, MODIS pixel mosaic) |
| `ScienceDialog.tsx` | "What's behind these notes?" + `NoteTable` (value range of each note) |
| `GuideLayer.tsx` | mounted once above every scene: the host's caption card (portrait, current phrase, the one next action, pause/replay/voice/transcript/adjust/end), the narration settings, and `DiscoveryThread` (gold curve from the sample on the map to its score mark). Toggles `html.tour-discovery` so the panel steps back |
| `BeethovenPortrait.tsx` | the host's round cameo (Stieler's 1820 portrait, `public/host/`); `speaking` (breath + sound arcs) and `baton` (the handover gesture) states |
| `RecordSleeve.tsx` | the sleeve as SVG + HTML type, from `sleeveArt()` |
| `RecordDisc.tsx` | the disc with a data spiral groove; highlights the played part |
| `geometry.ts` | **pure** shape maths shared by press, disc, sleeve and PNG: `smooth` (Catmull-Rom), `resampleTo`, `routeShape`, `dialShape`, `scoreShape`, `spiralShape`, `originShape`, `eventLevels`, `sleeveArt` |
| `sampleText.ts` | all human sentences about a sample (`sampleCaption`, `interpretation`, `formatValue`, `whenText`, `whereText`, `REASON_TEXT`) — shared by captions, aria-labels and the inspector so every audience gets the same facts |
| `sleeveText.ts` | the three text lines printed on every sleeve (screen and PNG) |

### 5.7b `tour/` — the narrated journey (no React except the bridge)

| File | Responsibility |
|---|---|
| `guideScript.en.json` | the host's 13 cues: phrases (caption text), per-phrase pacing/pitch/pause, emotion, direction, ElevenLabs settings and v3 emotion tags. Single source for captions, browser voice and the renderer |
| `narration.ts` | `NarrationService` (singleton `narration`): one cue session at a time; per phrase picks **clip** (manifest) → **speech** (best browser voice via `pickVoice`/`scoreVoice`) → **timer** (captions only). `play(cueId)` resolves `'ended'` or `'cancelled'` — never both, never late. Pause/resume/replay/stop, settings (voice on/off, pace, level, chosen voice) persisted locally |
| `tourDirector.ts` | `TourDirector`: the phases (`invitation → record-transition → choosing-record → first-performance → discovery → baton-handover → creation → pressing → record-ready → complete`, plus `paused`/`skipped`). Each run of beats holds a **token**; cancelling it rejects every pending wait, sleep and cue, so stale endings can't act. Learns the app through `observe(AppSnap)`, acts through `TourHost` |
| `index.ts` | singletons `tourDirector` + `narration`, `sceneHooks` (transitions lent by mounted scenes), `drive()`/`isDriving()` (marks the director's own actions), the e2e fast-mode hook |
| `TourBridge.tsx` | builds the `TourHost` from `useActions`/`dispatch`/`transport`, calls `tourDirector.observe(...)` after every render |

### 5.8 `accessibility/` and `styles/`

| File | Responsibility |
|---|---|
| `accessibility/announcements.ts` | `announce(msg)` writes into the polite live region |
| `accessibility/usePlayhead.ts` | `useSmoothPlayhead(playing, step)` — while playing, reads `transport.position()` every animation frame (fractional step) for smooth cursors |
| `styles/tokens.css` | colours, fonts, easing, gutters (CSS variables) |
| `styles/base.css` | reset, grain, type utilities, buttons, masthead, dialog, reduced-motion rules |
| `styles/scenes.css` | arrival (incl. hero animation), library, press, method |
| `styles/studio.css` | studio layout, atlases, year dial, inspector, panel controls, score |
| `styles/guide.css` | host portrait, caption card, arrival invitation, featured sleeve, library→studio zoom, discovery thread and dimming |
| `styles/record.css` | sleeve, disc, reveal |

---

## 6. How the layers communicate

### 6.1 State flows down, intents flow up

```
                ┌──────────── RecordContext ────────────┐
                │ state  (useReducer(reducer))           │
 component ──►  │ dispatch(action)                       │ ──► effects (URL, storage, transport)
   │            │ studio = useStudioRecord(state)        │
   │            │ activeRecord = studio draft OR current │
   │            └────────────────────────────────────────┘
   │                     ▲ re-render with new state
   └── useActions() ─────┘  (intents: togglePlay, inspect, press, go …)
```

* Components **read** with `useRecord()` and **act** with `useActions()`.
* Only `reducer` changes state; it is pure and listed in one switch, so every possible change is
  visible in one file.
* Effects that react to state (save, URL, audio program) live together in `RecordProvider`.

### 6.2 The two records: draft vs. pressed

* **Draft** — `useStudioRecord` rebuilds it whenever the visitor changes route/date/place/name/
  instrument. It uses a fixed `createdAt`, so its id only changes when the *notes* change.
* **Pressed** — `useActions.press()` calls `buildRecord` again with the real time, stores it in
  `state.current` and on the shelf, and moves to the press scene.
* `activeRecord` (in the context) is the draft in the studio and the pressed record in
  press/reveal. Everything that plays or draws "the record" uses `activeRecord`.

### 6.3 The transport and the one clock

```
RecordProvider effect:  transport.load({ id, events, beatSeconds }, { onStep, onEnd })   → arrange(events) once
                                   │
          ┌────────────────────────┴───────────────────────┐
   mode 'audio' (after unlock)                      mode 'silent' (sound off / unavailable)
   play(): every remaining note is handed to the    setInterval 20 ms reading performance.now()
   audio thread at once, at exact AudioContext
   times (perform → voice pools), plus
   Tone.Draw.schedule(emit(k)) at each onset         └─ emit(k) when floor(position) changes
                                   │
                         onStep(k) → dispatch({type:'playhead', index:k})
                                   │
             SonicScore / OceanAtlas / LandAtlas / readout re-render once per note
             + only the small cursor parts (ScoreCursor, PlayedTrail, DialHand) read
               transport.position() every frame (about 30 times a second)
```

* **Nothing on the main thread is needed while music plays.** A record is about 12 s, so `play()`
  schedules all remaining notes on the audio thread immediately. Map redraws, picture decoding or
  speech can't delay, bunch up or drop a note. This is measured: on a 4×-throttled CPU, the live
  output matches the offline render with zero drift, and an e2e test checks it.
* **Voice pools.** Each layer uses a fixed set of single-note voices round-robin (`VoicePool`), so
  notes queued far ahead are never dropped. Tone's PolySynth drops notes past its polyphony limit.
* **Pause / seek / new record.** The current instruments fade out in 30 ms and are replaced
  (`Voices.renew`), which discards notes already queued. Play then schedules again from the current
  step, so no note is ever double-triggered.
* **`position()`** is `anchor.step + (audioTime − anchor.time) / beat`, so the cursor shows what you
  *hear*.
* **Tone.js is loaded lazily** (`loadTone()` inside `unlock()`), because importing it creates an
  AudioContext. `useActions.ensureSound()` is the only caller of `unlock()`, and it is only called
  from click handlers. `unlock()` waits for the reverb to be built before the first note.
* **Mixer, volume and palette.** `RecordProvider` effects call `transport.setLayers`, `setVolume`
  and `setPalette` whenever those parts of state change.

### 6.3b The guided journey

```
 click "Begin the narrated journey" ──▶ tourDirector.start()   (the only mandatory click)
                                           │ host.ensureSound() — unlock inside the gesture
                                           │ narration.play('intro-01') ── resolves on the real end of the cue
                                           │ host.leaveArrival() ─▶ sceneHooks.leaveArrival (ArrivalScene's own needle/ring/iris)
                                           │ narration.play('choose-ocean') … sleep … host.openStory('ocean') ─▶ LibraryScene zoom
                                           │ waitFor(studio ready with the featured record)
                                           │ 'first-notes' → host.play(0) → waitFor(playhead ≥ notable+1)
                                           │ host.inspect(notable) → 'discovery' → 'discovery-ocean' → 'resume' → host.play(notable)
                                           │ waitFor(performance ended) → 'handover' → phase creation (one next action)
 visitor presses ─ useActions.press ─▶ userIntent('press') → waitFor(reveal) → 'record-ready' → complete

 state change ─▶ RecordProvider ─▶ TourBridge effect ─▶ tourDirector.observe(AppSnap)
                    · scene key matches an expectation the director set → its own navigation
                    · otherwise → the visitor navigated: choose a side (branch), library (wait),
                      method/arrival/shelf record (pause 'away', no teleport back)
                    · resolves waitFor() predicates (never while paused)
 useActions.togglePlay / inspect / press ─▶ userIntent(...) unless isDriving()
```

### 6.4 URL ↔ state

`toHash(state)` → `history.pushState` when the scene/story/record changes;
`popstate` → `parseHash` → `dispatch(go | openRecord)`. On first load, `boot()` reads the hash
(and finds `#/record/<id>` on the shelf), so deep links work and back/forward never lose drafts.

### 6.5 Persistence

`RecordProvider` saves `state.ocean`/`state.land` drafts and `state.shelf` to `localStorage`
whenever they change; `boot()` restores them. Nothing is sent to any server.

---

## 7. Five journeys traced through the code

### A. Opening the ocean studio

1. `LibraryScene` → `a.go('studio','ocean')` → reducer sets `scene='studio'`, `story='ocean'`.
2. `RecordProvider` effect pushes `#/studio/ocean`.
3. `useStudioRecord` sees the studio: `loadPresets()` and `loadOceanGrid('A')` fetch
   `presets.json`, `grid.json` and `mur-sst-20070818.bin` (cached afterwards).
4. When both arrive: `resampleGeographic(preset waypoints, 24)` → 24 stops →
   `sampleRoute(grid, 'A', stops)` → 24 `ObservationSample`s →
   `buildRecord(...)` → `buildEvents(samples, OCEAN_RULE)` → draft `EarthRecord`.
5. `activeRecord` changes → `transport.load(program)` (silent; nothing plays).
6. `StudioScene` renders `OceanAtlas` (stops from `record.geometry.points`, status from
   `record.observations`) and `SonicScore` (marks from `record.events`).

### B. Pressing "Hear this journey"

1. `useActions.togglePlay()` → `ensureSound()` → `transport.unlock()` → `import('tone')`,
   `Tone.start()`, `createVoices(Tone, 'glass')` → `dispatch(sound 'on')` →
   `transport.setMode('audio')` (reloads the program on the Tone Transport).
2. `transport.play()`; `dispatch(playing true)`.
3. Every 0.5 s: `playEvent` triggers synths; `Tone.Draw` calls `onStep(k)` →
   `dispatch(playhead k)` → score mark, map stop, caption and readout update.
4. `useSmoothPlayhead` animates the cursor between steps from `transport.position()`.
5. After the last event + 3 beats of tail → `onEnd` → `playing false`, `playhead null`.

### C. Inspecting a note

1. Click score mark 9 → `SonicScore.onSelect(9)` → `useActions.inspect(9)`: pause if playing,
   `transport.seek(9)`, `dispatch(select 9)`, `transport.audition(G4)`.
2. `OceanAtlas` effect computes stop 9's screen position → `onAnchor({x,y})` → `StudioScene`
   passes it as CSS variables `--ax/--ay` → the inspector card sits next to the stop.
3. `ScientificInspector` reads `record.observations[9]`, `record.events[9]`, the rule, and calls
   `normalize`, `noteIndex`, `noteBand`, `changeFromPrevious`, `blockMean` to show the actual
   arithmetic. The sentence comes from `sampleText.interpretation`.

### D. Drawing a route

1. "Draw a route" → `dispatch(ocean {tool:'draw'})` (stop hit-areas stop catching the pointer).
2. `OceanAtlas.onDown/onMove`: screen point → `getScreenCTM().inverse()` → map units, kept in
   local `trace` state (drawn live as a polyline).
3. `onUp`: map units → `mapToGeo` → `thinTrace(60 km)` → `isDegenerateRoute?` (announce and stop)
   → `onRoute(waypoints)` → `dispatch(ocean {waypoints, presetId:null})`.
4. Journey A steps 4–6 repeat with the new waypoints; the new record id reloads the transport.
   Drafts are saved to `localStorage`.

### E. Press → reveal → export

1. `useActions.press()` → `buildRecord` (real timestamp) → `dispatch(shelf [...])` →
   `dispatch(openRecord, 'press')` → `scene='press'`. (`RecordProvider` stops the transport.)
2. `RecordPress` computes three shapes with the same point count from the record
   (`originShape`, `scoreShape`, `spiralShape`), and its own rAF loop interpolates between them
   over 2.7 s; it calls `transport.phrase/stylus/chord` at beats II–IV; then `go('reveal')`.
3. `RevealScene`: the transport is loaded with the pressed record; Play drives the disc groove
   highlight and the sleeve's highlighted stop through `state.playhead`.
4. Exports: `toRecipeJson` → Blob → download; `renderSleevePng` → canvas → PNG; `renderRecordWav`
   → `Tone.Offline` → WAV. Each is a `Blob` given to a temporary `<a download>`.
5. Later: "Open a record recipe" → `parseRecipe(text)` → `importRecord` → reveal.

---

## 8. The core data shapes

```ts
ObservationSample   // one place (ocean) or one 16-day window (land)
  { id, sequenceIndex, position?, timeStart, timeEnd,
    status: 'valid' | 'missing' | 'masked' | 'quality_rejected', reason?,   // 'land' 'sea_ice' 'cloud' …
    numericValue: number | null,          // null for every non-valid status — enforced
    qualityCode?, uncertainty?, detail? }

MusicalRule         // published, fixed per side
  { variable, units, noteCollectionMidi, domainMin, domainMax, accentThreshold, tempoBpm, beatSeconds, … }

MusicEvent          // derived; one per observation, same index
  { sequenceIndex, atBeat, midiNote | null, supportingEvents[bass|accent|cadence], section 1–4, changeMarked, clamped }

EarthRecord         // the recipe — everything needed to reproduce sound and sleeve
  { schemaVersion '1.0', recordId, title, story, source, visualContext?, geometry, timeWindow,
    observations[], musicalRule, instrumentPaletteId, events[], narrativeText, visualStyleId,
    createdAt, sourceStatus 'verified_observations', credits[] }
```

`observations[i]`, `events[i]`, map stop `i`, score mark `i`, dial spoke `i` and groove arc `i`
always refer to the same thing.

---

## 9. Tests and what they guard

| Test | Layer | Guards |
|---|---|---|
| `src/tests/dataMapping.test.ts` | audio | the note rule, bands, clamping, arrangement, bass/accent rules, determinism |
| `src/tests/scientificMasks.test.ts` | data | mask decoding, bilinear over valid neighbours only, real-grid sanity, MODIS rests never interpolated |
| `src/tests/samePathComparison.test.ts` | data + audio | fixed ranges across dates; instruments never change notes |
| `src/tests/recordRoundtrip.test.ts` | export | recipe round trip gives identical events and sleeve; tampered recipes refused |
| `src/tests/pythonParity.test.ts` | data ↔ scripts | the browser reproduces the Python reference exactly |
| `src/tests/geodesicPath.test.ts` | data | equal spacing, dateline, projection |
| `src/tests/helpers.ts` | — | reads the real `public/` files from disk for the tests |
| `src/tests/tourDirector.test.ts` | tour | hands-off progression, choice wins and cancels, pause holds beats, skip, press, leaving |
| `src/tests/narrationScript.test.ts` | tour | cues complete; spoken numbers match the data; voice ranking |
| `tests/e2e/journeys.spec.ts` | whole app | user journeys in Chromium (desktop + Pixel 7), downloads, keyboard, no AudioContext before a gesture, no console errors |

---

## 10. Rules the code keeps (invariants)

1. A rest never carries a value (`numericValue === null` unless `status === 'valid'`);
   `parseRecipe` rejects violations.
2. Ranges are constants in `stories/*.config.ts`; nothing rescales them per route/place/date.
3. Order is never changed between observations, events, stops, marks, spokes and groove.
4. Only the cadence chord is artistic (`artistic: true`); instruments change timbre only.
5. No AudioContext before a user gesture (lazy Tone import).
6. Only `transport.ts` touches Tone; only `reducer` changes state; only `useActions` unlocks sound.
7. Pure modules (`data/`, `normalize`, `musicMapper`, `recordRecipe`, `geometry`) never import
   React or the DOM, so they are tested in Node.
8. The tour never acts on a cancelled token, never navigates the visitor back after they leave,
   and never presses or exports on their behalf.

---

## 11. Config and tooling files

| File | Purpose |
|---|---|
| `package.json` | dependencies (react, tone, d3-geo, topojson-client, world-atlas, fontsource) and scripts |
| `vite.config.ts` | `base: './'` (works from any folder), dev port 5173, preview 4173, Vitest config |
| `tsconfig.json` | strict TypeScript, JSON imports (world-atlas), bundler resolution |
| `playwright.config.ts` | builds + previews the app, runs desktop and Pixel 7 projects, autoplay allowed for audio tests |
| `index.html` | page shell, title, description |
| `.gitignore` | `node_modules`, `dist`, `data-raw`, test outputs |
| `scripts/requirements.txt` | numpy, Pillow, scipy |
| `README.md` · `METHODS.md` · `DATA_SOURCES.md` · `DECISIONS.md` · `STORYBOARD.md` · `ASSET_CREDITS.md` | running/testing · science · provenance · choices · scenes · credits |
