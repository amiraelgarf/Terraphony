# Earth Information Jukebox — *Ocean in Motion*

A browser-based listening observatory for the NASA Space Apps Challenge 2026 challenge
*The Earth Information Jukebox*. It turns NASA's Earth Information Center visualization
**SVS 3912 — Global Sea Surface Currents and Temperature** (ECCO2 model, 2007–2008) into
original music generated live in your browser, and lets you trace every note back to the
exact pixel, frame and rule that produced it.

> An independent NASA Space Apps Challenge 2026 project using NASA data and visualization
> assets; not endorsed by NASA.

---

## Contents

1. [Quick start (5 minutes)](#1-quick-start-5-minutes)
2. [What you need installed](#2-what-you-need-installed)
3. [All commands](#3-all-commands)
4. [Guided manual test — walk through every feature](#4-guided-manual-test--walk-through-every-feature)
5. [Automated tests](#5-automated-tests)
6. [Regenerating the NASA data (optional)](#6-regenerating-the-nasa-data-optional)
7. [How it works](#7-how-it-works)
8. [Project structure](#8-project-structure)
9. [Where to change things](#9-where-to-change-things)
10. [Troubleshooting](#10-troubleshooting)
11. [Other documents](#11-other-documents)

---

## 1. Quick start (5 minutes)

All processed NASA data is already in `public/`, so you **do not** need Python or internet
access to the NASA servers to run the app.

```bash
cd earth-information-jukebox
npm install          # once
npm run dev          # starts http://localhost:5173
```

Open **http://localhost:5173** in Chrome, Edge, Firefox or Safari, put on headphones or
turn your speakers on, and click **Begin listening**.

That's it. Section 4 walks you through everything to try.

---

## 2. What you need installed

| Tool | Version | Needed for | Check with |
|---|---|---|---|
| Node.js | 18 or newer (developed on 24) | running, building, testing the app | `node -v` |
| npm | comes with Node | installing packages | `npm -v` |
| Python | 3.10+ with `numpy` and `Pillow` | **only** if you regenerate the data (section 6) | `python --version` |

Nothing else: no database, no API keys, no environment variables.

---

## 3. All commands

Run these from the `earth-information-jukebox/` folder.

| Command | What it does |
|---|---|
| `npm install` | Install dependencies (first time only). |
| `npm run dev` | Development server with hot reload at http://localhost:5173. |
| `npm run build` | Type-check, then build a static site into `dist/`. |
| `npm run preview` | Serve the built `dist/` at http://localhost:4173 (what you would deploy). |
| `npm run typecheck` | TypeScript check only. |
| `npm test` | Unit tests (Vitest) — 53 tests on the science, mapping and geometry rules. |
| `npm run test:e2e` | End-to-end browser tests (Playwright) — builds, serves and drives the real app on desktop and mobile. See section 5 for the one-time browser install. |
| `npm run pipeline` | Re-download the NASA frames and regenerate all data (needs Python, section 6). |

**Deploying:** `npm run build` produces a fully static `dist/` folder (relative paths + hash
routing), so you can drop it on GitHub Pages, Netlify, any web server, or a USB stick served
with `npx serve dist`.

---

## 4. Guided manual test — walk through every feature

Start the app (`npm run dev`) and follow along. Each step says what you should see or hear.
The whole tour takes about 10 minutes.

### 4.1 Entry (Scene 00)
1. Open http://localhost:5173. You should see the real NASA frame, dimmed, with the headline
   *"There is more than one way to understand a moving ocean."*
2. **Nothing plays yet.** Audio only starts after you click — this is deliberate.
3. Note the three options: **Begin listening**, **Explore directly**, **Continue without sound**.

### 4.2 The story (Scenes 01–06)
4. Click **Begin listening**. The header now says **Sound on**. You are on *Scene 01 — Colors are not sound*.
5. On the right, the **Sonic legend**: drag the slider and watch the note change
   (0 → C3, 0.5 → C4, 1 → C5). Click **Hear …** to hear it. Click **Hear the rule** to hear
   three illustrative notes. These are clearly labelled *illustrative*, not data.
6. Click **Continue**. *Scene 02* starts the 40‑second scan automatically:
   - a white cursor travels north along the dotted Atlantic route;
   - a brass ring appears at each note;
   - the bars in the timeline at the bottom are the actual notes (height = pitch,
     small circle = rest, dot above = rhythm accent);
   - instruments enter gradually: bass at beat 9, pad at 17, accents at 25.
   Hollow circles on the route are **rests** (land, or no readable colour) — you hear silence there.
7. Let it finish (or click **Skip to the microscope**). *Scene 03* pauses on the
   **largest step-to-step change** on the route (point 58, south-east of Newfoundland).
   The **Behind the sound** panel shows: frame time, latitude/longitude, source pixel,
   *normalized palette position* (e.g. 0.520 — *normalized, not °C*), confidence, note,
   rhythm and bass. Open **See the mapping** to see `round(u × 10) = index → note`.
8. Click **Replay this event** (plays the few notes around it), then **Continue the story**.
9. *Scene 04 — The contrast*: the same route on two NASA frames — **A: 18 Aug 2007** and
   **B: 6 Feb 2008**. Click **Play A, then B**: 16 notes on A, a short silence, the same 16
   points on B. The map cross-fades between frames; the route never moves. The inspector shows
   A value, B value and **B − A** in *normalized feature units, not °C*.
10. Click **Next scene**. *Scene 05* offers **Probe / Draw / Navigate**. Click **Finish the story**
    for *Scene 06*, the closing, with links to Explore, Compare and Method.

### 4.3 Explore
11. Click **Explore** in the header. Tool **Probe** is selected.
    - Click anywhere in the ocean: one note plays and the inspector explains it.
    - Click on land (e.g. the Sahara): the inspector says it is land and the melody rests.
12. Choose **Draw**, then drag a line across an ocean (e.g. from the Southern Ocean north into
    the Arabian Sea) and release. You should see *"Your path is ready to hear."* and 64 new
    bars in the timeline. Click **Play this route**, then try **Reverse** and **Clear**.
    A very short drag counts as a probe, not a route. A path mostly over land shows a warning.
13. Choose **Navigate**: drag to pan, scroll to zoom (or use the + / − / reset buttons on the
    map). Clicking in Navigate **never** makes a sound.

### 4.4 Compare
14. Click **Compare**. Click any bar in the timeline (e.g. the 21st). Switch between **A** and
    **B**: the selected point stays the same; only the frame changes.
15. Click **Two places**, then click two ocean points: markers **A** and **B** appear and the
    inspector compares them. **Hear A, then B** plays both.

### 4.5 Accessibility checks
16. **Keyboard only:** reload, press <kbd>Tab</kbd> to reach controls. In the timeline use
    <kbd>←</kbd>/<kbd>→</kbd> (and <kbd>Home</kbd>/<kbd>End</kbd>) to move between notes and
    <kbd>Enter</kbd> to open *Why this note?*. Focus the map and use the arrow keys to move a
    crosshair (<kbd>Shift</kbd> = 5°), <kbd>Enter</kbd> to probe that point, <kbd>+</kbd>/<kbd>−</kbd> to zoom.
17. **Without a map:** open **All 64 route points as a list** under the timeline — every point
    with position, value, note, **Play** and **Inspect** buttons. Works with screen readers.
18. **Without sound:** settings icon (top right) → *Visual-only mode*. The scan still runs,
    with all values and notes visible.
19. **Reduced motion:** settings → *Reduce motion* (also follows your OS setting). The cursor
    jumps step by step instead of sweeping, and rings are hidden.
20. **Mobile:** open the dev server on a phone on the same network (`npm run dev -- --host`)
    or use your browser's device emulation.

### 4.6 Method
21. Click **Method**: sources and checksums, how pixels become values, validation results
    (24/24 landmark checks), the musical mapping, limitations, the full story transcript,
    the 11 official challenge resources and credits.
22. Deep links work and survive refresh, e.g. http://localhost:5173/#/story/microscope.

---

## 5. Automated tests

### Unit tests (fast, no browser)
```bash
npm test
```
53 tests across `src/tests/`:

| File | Proves |
|---|---|
| `sonification.test.ts` | `0→C3, 16→C4, 32→C5` and `0→C3, 0.5→C4, 1→C5`; nulls/invalid ranges give rests; clamping affects pitch only; model-SST and image-feature quantities cannot be mixed; accents use spatial (not temporal) differences; identical input → identical event hash; A/B plays identical subsequences. |
| `sourceIntegrity.test.ts` | The manifest is real data (not a fixture) from SVS 3912; timestamps are inside the documented range; **the TypeScript sampler reproduces the Python pipeline's 64 samples exactly on both frames**; land/out-of-bounds give rests with reasons. |
| `frameRegistration.test.ts` | geo↔pixel and screen↔source round trips under pan/zoom; unregistered frames never produce lat/lon. |
| `routeGeometry.test.ts` | antimeridian unwrap; 64 equal-distance points; image routes are never given kilometres; a tap is a probe. |
| `compare.test.ts` | A/B rejects mismatched cameras, timestamps, quantities or unvalidated pairs; never invents a difference; explains same-note quantization. |

### End-to-end tests (real browser)
One-time setup (downloads a test copy of Chromium, ~150 MB):
```bash
npx playwright install chromium
```
Then:
```bash
npm run test:e2e
```
This builds the app, serves it on port 4173, and runs 10 journeys on a desktop and a mobile
(Pixel 7) viewport — 20 tests: entry, the full story, keyboard-only use, keyboard map probing,
probing land vs ocean, drawing/reversing/clearing a route, Navigate never making sound,
temporal and spatial compare, the Method page and deep links. Every test also fails on any
console error. For a visual report: `npx playwright show-report`.

---

## 6. Regenerating the NASA data (optional)

The app ships with processed data. Re-run the pipeline only to reproduce it, change the
frames or route, or tune the feature extraction.

```bash
pip install -r scripts/requirements.txt     # numpy, Pillow
npm run pipeline                            # = python scripts/run_pipeline.py
```

It runs five steps (each is also runnable alone, e.g. `python scripts/validate_alignment.py`):

| Step | Script | Output |
|---|---|---|
| 1 | `acquire_svs3912_frames.py` | Downloads NASA's frame-date table, SST legend and the two TIFF frames into `data-raw/` (+ SHA-256 checksums). ~13 MB. |
| 2 | `extract_visual_features.py` | Web JPEGs in `public/nasa-svs/`, 512×256 feature grids in `public/data/frames/`, `legend.json`, QA images in `data-raw/qa/`. |
| 3 | `validate_alignment.py` | Landmark registration test, A/B comparability, legend round-trip → `data-raw/validation.json`. |
| 4 | `build_story_route.py` | `public/data/story-route.json` — 64 reference samples, accent threshold, notable event. |
| 5 | `export_manifest.py` | `public/data/manifest.json` and `sources.json`. |

Frame choices, cell size and thresholds live in **`scripts/pipeline_config.py`**; the story
route waypoints are at the top of `scripts/build_story_route.py`. After changing either, run
the pipeline, then `npm test` — the parity test will tell you if TypeScript and Python disagree.

`python scripts/acquire_matching_ecco2.py` probes whether numeric ECCO2 data is reachable
(Pipeline A). It never downloads or substitutes anything.

---

## 7. How it works

```
NASA SVS 3912 frames + legend + timestamp table          (official source)
        │  scripts/ (offline, Python)
        ▼
hue → position on NASA's legend (0–1) per pixel → median per 4×4 cell + confidence
land / unreadable cells → "rest"   ·   landmark registration + A/B checks
        │  public/data/*.json, *.bin                    (versioned, checksummed)
        ▼
domain/ (pure TypeScript)
  sourceRegistry → dataSampler → routeGeometry (64 equal-distance points)
  → sonification (value → one of 11 notes, bass, accents) → Program (one step per beat)
        │
        ├──► audio/AudioEngine (Tone.js): one clock, schedules notes, emits step events
        └──► components/: map cursor, rings, timeline, inspector — all driven by the
             same step events, so sound and picture cannot drift apart
```

**The feature, honestly.** We could not obtain the numeric ECCO2 fields behind these exact
frames, so the app does **visual-frame sonification** (the spec's Pipeline B). For each point
it asks *where does this colour sit on NASA's own legend?* — a number from 0 to 1. It follows
the legend but is not a calibrated temperature, so the interface never shows it in °C. See
`METHODS.md` and `DECISIONS.md`.

**The music.** 96 BPM, one route point per beat, 64 points ≈ 40 s. Scale
C3 D3 E3 G3 A3 C4 D4 E4 G4 A4 C5; `note = scale[round(value × 10)]`.
Melody = the value; Bass = mean of each 8-point stretch; Rhythm = accent when the value changes
by ≥ 0.048 from the previous point (spatial change); Atmosphere = an artistic pad (not data).

---

## 8. Project structure

```
earth-information-jukebox/
├── public/                     static assets served as-is
│   ├── nasa-svs/               NASA frames (JPEG) + NASA legend, attributed
│   └── data/                   manifest.json, sources.json, legend.json,
│                               story-route.json, frames/frame-<n>.bin
├── scripts/                    offline Python data pipeline (section 6)
├── src/
│   ├── main.tsx, App.tsx       entry point; loads data, renders the shell
│   ├── app/                    state & orchestration (no UI)
│   │   ├── state.ts            reducer: route, tool, playback, selection, mixer…
│   │   ├── derive.ts           route → samples → events → programs (memoised)
│   │   ├── actions.ts          every user intent as one named function
│   │   ├── effects.ts          engine sync, URL hash sync, story director, visibility
│   │   ├── inspection.ts       what the inspector shows for the current selection
│   │   ├── hashRoute.ts        #/, #/story/<scene>, #/explore, #/compare, #/method
│   │   ├── format.ts           number/position formatting
│   │   └── JukeboxContext.tsx  wires it together; components use useJukebox()
│   ├── domain/                 pure, framework-free, unit-tested logic
│   │   ├── sourceTypes.ts      types (model SST vs visual feature kept separate)
│   │   ├── sourceRegistry.ts   load + validate manifest and grids
│   │   ├── dataSampler.ts      FeatureGrid lookups → value or rest + reason
│   │   ├── projection.ts       geo↔pixel, screen↔source, zoom/pan
│   │   ├── routeGeometry.ts    haversine, antimeridian, equal-distance resampling
│   │   ├── scan.ts             sample a route on a frame
│   │   ├── sonification.ts     note mapping, events, programs, hash
│   │   ├── compare.ts          comparability rules, A/B point comparison
│   │   └── storyHighlights.ts  the notable-event rule
│   ├── audio/                  Tone.js only lives here
│   │   ├── instruments.ts      melody, bass, rhythm, pad, buses, limiter
│   │   └── AudioEngine.ts      transport, silent clock, audition, mixer
│   ├── content/                all copy — story.en.ts (scenes), microcopy.en.ts
│   ├── components/             one component per file (map, inspector, transport…)
│   ├── styles/                 tokens.css, base.css, layout.css, components.css
│   └── tests/                  Vitest unit tests
├── tests/e2e/                  Playwright journeys
├── README.md  DECISIONS.md  METHODS.md  DATA_SOURCES.md  ASSET_CREDITS.md  STORYBOARD.md
└── package.json, vite.config.ts, playwright.config.ts, tsconfig.json
```

Dependency direction is one-way: `components → app → domain`, and `app → audio → domain`.
`domain/` imports nothing from React or Tone.js, which is why it is easy to test.

---

## 9. Where to change things

| I want to… | Edit |
|---|---|
| Change story text or narration | `src/content/story.en.ts` |
| Change button labels / UI wording | `src/content/microcopy.en.ts` |
| Change the scale, tempo, bass/accents | `src/domain/sonification.ts` (then `npm test`) |
| Change instrument sounds | `src/audio/instruments.ts` |
| Change colours, fonts, spacing | `src/styles/tokens.css` |
| Change what a scene does when it opens | `useChapterDirector` in `src/app/effects.ts` |
| Use different NASA frames or route | `scripts/pipeline_config.py`, `scripts/build_story_route.py`, then `npm run pipeline` |

---

## 10. Troubleshooting

| Symptom | Fix |
|---|---|
| **No sound** | Click a button first (browsers block audio until you interact). Check the header says *Sound on*, the volume slider, OS volume, and that no layer is muted under *Sound layers*. Safari: also check the tab isn't muted. |
| *"Sound couldn't start"* banner | The browser refused audio. Everything else still works; click *Sound unavailable — retry* in the header. |
| Playback stopped when I switched tabs | Intentional: playback pauses in a background tab so picture and sound stay in sync. Press Play to resume. |
| `Port 5173 is already in use` | Another dev server is running. Stop it, or run `npm run dev -- --port 5180`. |
| `npm run test:e2e` says the browser is missing | Run `npx playwright install chromium` once. |
| `npm run test:e2e` fails on port 4173 | Stop any other `vite preview` already running on 4173, then retry. |
| *"The source data couldn't be loaded"* | `public/data/` is missing or incomplete; run `npm run pipeline` (section 6). |
| Pipeline download fails on Windows with a TLS/revocation error in `curl` | The scripts use Python's own HTTP client, which avoids this. If NASA's server resets the connection, just re-run — downloads retry and resume from what is cached. |
| `ModuleNotFoundError: numpy / PIL` | `pip install -r scripts/requirements.txt` |

---

## 11. Other documents

- **`METHODS.md`** — the feature extraction, mapping and validation in detail.
- **`DATA_SOURCES.md`** — every NASA asset used, with URLs, timestamps and checksums.
- **`DECISIONS.md`** — consequential choices and why (e.g. Pipeline B, frame choice, bass definition).
- **`STORYBOARD.md`** — the seven scenes and what happens in each.
- **`ASSET_CREDITS.md`** — attribution and usage notes.
