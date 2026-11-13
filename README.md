# Earth Records — The Earth Information Jukebox

*A world of sound. Yours.* — NASA Space Apps Challenge 2026

Choose a place on Earth, follow a real pattern through **space** (a line across the sea) or
**time** (a year in one place), hear a short composition generated from NASA observations,
inspect where any note came from, and press a personal record whose sleeve is drawn from your
own route and values. Then save the sleeve (PNG), the recipe (JSON) or the audio (WAV).

| Side | Question | Data the notes come from | Picture |
|---|---|---|---|
| **A · Ocean in Motion** | What changes as you travel? | Sea surface temperature, °C — **MUR SST v4.1** (NASA JPL), 18 Aug 2007 or 6 Feb 2008 | NASA **SVS 3912** (ECCO2 model) for the same day |
| **B · A Year in One Place** | What changes as time passes? | Vegetation greenness (NDVI) — **MODIS MOD13Q1 v061**, all 23 16-day windows of 2023 | Natural Earth coastlines + year dial |
| **C · A Landscape Interrupted** | Window-by-window fire detections | *Planned — not playable* (see DECISIONS D9) | — |

Nothing is synthetic. Every note is a real value, or a **rest** where no valid value exists
(land, sea ice, cloud, snow). The sound and sleeve are artistic; the numbers are not.

---

## 1. Quick start (5 minutes)

**Requirements:** Node.js 18+ (20 LTS recommended) and npm. Python is **not** needed to run the
app: the processed NASA data is already in `public/data/`.

```bash
cd earth-information-jukebox
npm install
npm run dev
```

Open **http://localhost:5173** and click **Make my Earth Record**. Sound starts only when you
click something that needs it; use the **Sound off / on** pill (top right) at any time.

Production build: `npm run build` then `npm run preview` → http://localhost:4173.
The `dist/` folder is static (relative paths + hash routes) and can be hosted anywhere.

## 2. Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload (port 5173) |
| `npm run build` | Type-check + production build into `dist/` |
| `npm run preview` | Serve the production build (port 4173) |
| `npm run typecheck` | TypeScript only |
| `npm test` | Unit tests (Vitest, 40 tests, ~1 s) |
| `npm run test:e2e` | Browser journeys (Playwright, desktop + Pixel 7, 26 tests, ~1–2 min) |
| `npm run pipeline` | Re-download and re-process all NASA data (Python, optional) |

First time running e2e tests: `npx playwright install chromium`.

## 3. Walk through it yourself (≈ 10 minutes)

Each step says what you should **see** and **hear**. If something differs, see Troubleshooting.

**The invitation** — `#/`
1. Paper on the left, a dark engraved Earth-record on the right; the globe turns slowly. Silence.
2. Hover **Make my Earth Record**: the tonearm lifts toward the groove.
3. Click it: one soft note; the needle drops, the gold ring around the globe unrolls into a line,
   the stage closes like an iris and the library opens. (With *reduce motion* on: a direct cut.)

**The library** — `#/library`
4. Three sleeves. Side A shows the real NASA SVS 3912 picture with the suggested route drawing on
   hover; Side B shows growth rings drawn from real Nile Delta NDVI; Side C is marked *In
   preparation*. Click C: a dialog explains what data it still needs. Press **Esc**: it closes and
   focus returns to the sleeve.

**Side A, the ocean studio** — click **Ocean in Motion** (`#/studio/ocean`)
5. Map = NASA picture of 18 Aug 2007; a dashed suggested route (Florida Strait → Norwegian Sea)
   with 24 gold stops. Below, the paper **living score**: 24 marks, height = note.
6. **Hear this journey** (≈ 12 s at 120 bpm): melody alone first; a soft bass joins at stop 6;
   from stop 13 soft accents mark stops that changed ≥ 1 °C (the gold dots above the score);
   a closing chord ends it. The cursor on the map, the highlighted mark, the caption line and the
   readout in the panel all move together — they share one clock.
7. Pause and click any score mark (or stop on the map). The **inspector** opens next to that stop:
   one sentence (“Here the sea surface measured 24.3 °C … plays G4”), then value / day / place /
   note. Open **Technical details**: the formula with the real numbers, the note's value band, the
   bass block mean, the change from the previous stop, grid cell, source and DOI.
8. **Listen at another moment → 6 February 2008**: same route, same note range; the line now sits
   lower (the North Atlantic is colder in winter). Switch **NASA picture / Measured field** to see
   the actual MUR numbers drawn with NASA's own SVS 3912 colour legend.
9. **Draw a route**, then drag across the sea. Release: the line becomes 24 equal-distance stops
   (they light up in order). Stops on land or sea ice are hollow rings = rests. Try one through the
   Caribbean islands to see rests.
10. Keyboard: Tab to the score, use ← → / Home / End. Open **Edit the route by coordinates** to
    type waypoints, add, remove or reverse them — no mouse needed.
11. Name the record, choose **Glass & tide / Wood & earth / Felt & dusk** (timbre only — the notes
    do not change), open **Layers and volume** to mute or solo melody, bass, accents or the
    (artistic) closing chord.

**The press** — **Press my Earth Record**
12. ~2.7 s, skippable: your route detaches from the map → straightens into the score (notches =
    your notes, rings = rests) → winds into a spiral groove whose spacing follows your values, the
    tonearm touches down → the disc slides into your sleeve and the title resolves. With sound on
    you hear your notes as a quick phrase, a stylus touch and a chord.

**The reveal** — `#/record/<id>`
13. Sleeve + disc on paper, liner notes on the right. **Play my record**: the disc spins and the
    groove lights up note by note; the sleeve marks the playing stop.
14. **Explore its notes**: the score and inspector again, for the pressed record.
15. **Save sleeve (PNG)** → a 2400 × 2400 image drawn from the recipe (not a screenshot).
    **Export record recipe (JSON)** → everything needed to reproduce it.
    **Save audio (WAV)** → the record rendered offline with the same instruments.
16. **Make another** → back to the library; your record is now on **Your shelf** (kept in this
    browser). Reload the page: it is still there. **Open a record recipe (JSON)** re-opens an
    exported recipe (it is refused if its notes do not match its observations).

**Side B, a year in one place** — `#/studio/land`
17. A quiet map around the Nile Delta and a **year dial**: 23 spokes = the 23 real MODIS 16-day
    windows of 2023 (starting 1 January at 12 o'clock); spoke length = NDVI. Month letters are
    calendar guides only. Play it: the hand sweeps once around the year; two harvests, two dips.
18. Choose **Harvard Forest**: dashed spokes / score rings are windows rejected by quality checks
    (one cloudy, one snow-covered). Choose **Sahel grassland**: one sharp rainy-season pulse, with
    two cloud gaps in the wet season.
19. Inspect a window: its true dates (“13–28 Aug 2023”), NDVI, and in Technical details the 81
    actual MODIS pixels with rejected ones crossed out.

**Other checks**
20. **How it works** (`#/method`): the full method, note tables, registration results, credits.
21. Browser **Back/Forward** move between scenes; drafts survive navigation and reloads.
22. Turn on *reduce motion* in your OS: transitions become cuts, the press becomes a direct reveal.
23. **Sound off**: everything still works; captions and the score carry all the information.
24. Short tour: from `#/` choose **Take the short tour** — Hear → Notice (“That change you
    heard? Here is the observation that made it.”) → Investigate → Shape → Press. Skip any time.

## 4. Automated tests

```bash
npm test            # unit
npm run test:e2e    # browser (builds and serves the app automatically)
```

| File | Proves |
|---|---|
| `src/tests/dataMapping.test.ts` | value → note rule, clamping, note bands, arrangement sections, bass/accent rules, only the closing chord is artistic, determinism |
| `src/tests/scientificMasks.test.ts` | land, lake, sea ice and missing → rests; bilinear uses only valid neighbours; real grid sanity; MODIS QA rests are never interpolated; true 16-day windows |
| `src/tests/samePathComparison.test.ts` | the same route on two days uses the same stops and fixed range; the same value always gives the same note; instruments never change notes |
| `src/tests/recordRoundtrip.test.ts` | recipe → JSON → recipe gives identical events and identical sleeve geometry; tampered, invented or synthetic recipes are refused |
| `src/tests/pythonParity.test.ts` | the browser reproduces the Python pipeline's stops, statuses, grid cells, values and notes for every preset route on both days |
| `src/tests/geodesicPath.test.ts` | equal great-circle spacing, antimeridian crossing, projection round trip, trace thinning |
| `tests/e2e/journeys.spec.ts` | no AudioContext before a gesture; 3-click path to sound; inspector + formula; keyboard score + coordinate editor; drawing; press → reveal → valid JSON / 2400-px PNG / WAV; shelf survives reload; land dial + QA rests + 81 pixels; tour; deep links + back; reduced motion; no horizontal overflow; no console errors — desktop and Pixel 7 |

## 5. Regenerating the data (optional)

```bash
pip install -r scripts/requirements.txt     # numpy, Pillow, scipy
npm run pipeline                            # = python scripts/run_pipeline.py
```

Downloads go to `data-raw/` (git-ignored, ~50 MB); outputs overwrite `public/data/` and
`public/nasa-svs/`. No accounts are needed. Steps (each script also runs on its own):

| Step | Script | Output |
|---|---|---|
| 1 | `acquire_svs3912_frames.py` | NASA SVS 3912 frames, legend, frame→time table (+SHA-256) |
| 2 | `acquire_mur_sst.py` | MUR SST v4.1 for both days via NOAA CoastWatch ERDDAP (0.25° sub-sample) |
| 3 | `build_ocean_grids.py` | `public/data/ocean/*.bin` (int16 °C×100 + mask codes), data-map PNGs, `grid.json` |
| 4 | `validate_ocean_alignment.py` | picture ↔ numbers registration: 24 landmarks + land-mask agreement |
| 5 | `build_ocean_presets.py` | suggested routes + Python reference samples (used by the parity test) |
| 6 | `acquire_modis_ndvi.py` | MOD13Q1 v061 pixels (NDVI, reliability, day-of-year) via ORNL DAAC |
| 7 | `build_land_series.py` | `public/data/land/<place>.json`: QA-filtered 16-day series + raw pixels |
| 8 | `export_manifest.py` | `public/data/manifest.json`: products, versions, checksums, validation |

Change dates, places or ranges in `scripts/pipeline_config.py` (and mirror the ranges in
`src/stories/*.config.ts`; the parity test fails if the ocean range drifts).

## 6. How it is built

```
React 18 + TypeScript + Vite · Tone.js (loaded only after a gesture) · d3-geo + Natural Earth (world-atlas)
Fonts: Instrument Serif (display), DM Sans (body), DM Mono (data labels) — self-hosted via Fontsource
```

**Data flow**

```
story config ─► adapter (MUR grid / MODIS series) ─► ObservationSample[] (valid | masked | missing | quality_rejected)
            ─► musicMapper (fixed range → pentatonic notes, bass, accents, closing chord) ─► MusicEvent[]
            ─► Transport (one clock) ─► map cursor · year-dial hand · score · captions · disc groove
            ─► buildRecord ─► EarthRecord recipe ─► sleeve SVG/PNG · JSON · WAV
```

**State machine** (`src/app/recordMachine.ts`): `arrival → library → studio → press → reveal`
(+ `method`), mirrored in the URL hash. Drafts and the shelf persist in `localStorage` only.

## 7. Project structure

```
earth-information-jukebox/
├─ public/
│  ├─ data/ocean/           MUR grids (.bin), data maps (.png), grid.json, presets.json
│  ├─ data/land/            one JSON per place + places.json
│  ├─ data/manifest.json    provenance, checksums, validation, official resources
│  ├─ data/legend.json      NASA SVS 3912 legend ramp
│  └─ nasa-svs/             the two SVS 3912 frames + NASA legend
├─ scripts/                 Python pipeline (see §5); pipeline_config.py = all choices
├─ src/
│  ├─ app/                  recordMachine (state + routes), RecordContext (effects), useActions,
│  │                        useStudioRecord (draft record), persistence
│  ├─ stories/              ocean / vegetation / fire configs: sources, rules, copy
│  ├─ data/                 types (brief §9 contracts), projections, geodesicPath,
│  │  └─ adapters/          murSstAdapter, modisNdviAdapter, oceanPresets
│  ├─ audio/                normalize (the one rule), musicMapper, instruments (3 palettes), transport
│  ├─ visuals/              scenes (Arrival, Library, Studio, RecordPress, Reveal, Method),
│  │                        EarthRecordHero, OceanAtlas, LandAtlas, SonicScore, ScientificInspector,
│  │                        RecordSleeve, RecordDisc, geometry (route→score→groove→sleeve), TourCoach…
│  ├─ export/               recordRecipe, coverRenderer (PNG), wavRenderer (WAV)
│  ├─ accessibility/        announcements (live region), usePlayhead (audio-clock animation)
│  ├─ styles/               tokens, base, scenes, studio, record
│  └─ tests/                unit tests
└─ tests/e2e/               Playwright journeys
```

## 8. Where to change things

| I want to… | Edit |
|---|---|
| change copy of a side | `src/stories/<side>.config.ts` |
| change note range / accent threshold | `src/stories/*.config.ts` + `scripts/pipeline_config.py`, re-run the pipeline |
| add a suggested ocean route | `PRESETS` in `scripts/build_ocean_presets.py`, run it |
| add a land place | `LAND_PLACES` in `scripts/pipeline_config.py`, run steps 6–8 |
| change instrument sounds | `src/audio/instruments.ts` (timbre only) |
| change the arrangement | `src/audio/musicMapper.ts` (tests describe the current rules) |
| change sleeve artwork | `sleeveArt()` in `src/visuals/geometry.ts` (PNG export follows automatically) |
| change the press choreography | `src/visuals/RecordPress.tsx` (beat timings at the top) |
| change colours / type | `src/styles/tokens.css` |

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| No sound | Click the **Sound off** pill to turn it on; check the tab is not muted; Safari may need a second click. Everything works without sound. |
| “Loading measurements…” forever | Open the browser console; the files in `public/data/` must be served — use `npm run dev`/`preview`, not `file://`. |
| Port 5173/4173 busy | Stop the other server, or `npx vite --port 5180`. |
| e2e: “Executable doesn't exist” | `npx playwright install chromium` |
| e2e: port 4173 in use | Playwright reuses an existing server — make sure it serves this project's latest build (`npm run build`). |
| Pipeline: ERDDAP HTTP 503 | The server is busy; the script retries automatically. Re-run later; cached files are kept. |
| Pipeline: `No module named scipy` | `pip install -r scripts/requirements.txt` |
| My shelf disappeared | It lives in this browser's storage; private windows or clearing site data remove it. Export recipes to keep records. |

More: [ARCHITECTURE.md](ARCHITECTURE.md) (how the code works) · [METHODS.md](METHODS.md) · [DATA_SOURCES.md](DATA_SOURCES.md) · [DECISIONS.md](DECISIONS.md) ·
[STORYBOARD.md](STORYBOARD.md) · [ASSET_CREDITS.md](ASSET_CREDITS.md)

> An independent NASA Space Apps Challenge 2026 project using NASA data and visualization assets; not endorsed by NASA.
