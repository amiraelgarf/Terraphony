# Decisions

Consequential choices made while implementing the brief, with the reasoning.

## D1 — Pipeline B (visual-frame sonification), not Pipeline A
The brief prefers numeric ECCO2 fields matching the SVS 3912 frames. SVS does not host them
("we do not store … the data sets themselves"), and JPL's ECCO Drive was not reachable from
the build environment (and requires Earthdata credentials; it is also not guaranteed to match
the exact 2012 render). Per sections 6.4 and 16 we chose the honest visual-frame mode. The UI
never shows °C for our values; `manifest.fidelity = verified-visual-frame`.
`scripts/acquire_matching_ecco2.py` re-probes access and documents next steps.

## D2 — Feature = hue position along NASA's legend
Tried first: nearest legend colour by RGB direction. It failed at high latitudes because the
legend PNG is rendered lighter than the frames. Hue is invariant to that whitening and to streak
brightness, and the legend's hue is strictly monotonic (≈228° → −6°), so hue → position is a
well-defined inverse. Usable ocean cells went from 44 % to 78 %. Limitation: the last ~3 % of
the legend is one hue (pure red), so values > 0.97 read as ≈ 0.97 (< ⅓ of a note step).

## D3 — 2048×1024 "orig" global frame set, equirectangular −180…180 / −90…90
It is NASA's uncropped 2:1 global set. Registration was not assumed: 24 land/sea landmarks
(several within ~1° of a coastline) are checked on both frames; all pass, so the manifest marks
the frames `verified-equirectangular`. If a check fails the pipeline marks them unregistered
and the app falls back to image coordinates.

## D4 — Frames A = 26400 (18 Aug 2007) and B = 30400 (6 Feb 2008)
Same fixed camera and size; land masks agree on 99.88 % of cells. About six months apart, so
the contrast is seasonal (late northern summer vs winter). Copy calls it "two selected model
times — a seasonal contrast, not a climate trend". Timestamps come from NASA's
`flat_ecco2_dates.txt`, never from frame index ÷ 30.

## D5 — Bass = mean of each 8-point route stretch
The brief allows a fixed-region mean "if available". A single fixed box would give one constant
note per frame. We instead average the valid melody values in each 8-step segment of the route,
labelled exactly that way in the mixer and inspector. Silent when a stretch has no valid values.

## D6 — Accent threshold = 0.048, data-driven
The 90th percentile of |feature difference| between valid cells three cells apart (≈ one route
step) over all of frame A (≈ 260 k pairs). One global threshold for every route and frame.

## D7 — The notable event is computed, not authored
Largest finite change between neighbouring points, ≥ 6 steps from either end, earliest wins ties.
Computed identically in Python (build time, recorded) and TypeScript (run time, unit-tested to agree).
On the story route it is point 58, 43.95°N 51.09°W (0.680 → 0.520).

## D8 — Story route: a meridional line through the Atlantic
Southern Ocean → South Atlantic → equator → Sargasso Sea → across the Gulf Stream → Labrador Sea,
14 597 km, 8 rests on frame A. Chosen for an audible cold → warm → cold arc. The route is the only
hand-authored input; we do not name currents in narration beyond what the data shows.

## D9 — One clock for sound and picture; a silent clock for sound-off
`AudioEngine` drives both the Tone.js transport and UI step events (via `Tone.Draw`). When sound
is off or blocked, an identical `performance.now()` clock drives the same step events, so the
visual-only experience is the same experience.

## D10 — Pause on hidden tab
Background tabs throttle timers; rather than let visuals drift, playback pauses when the tab is
hidden and resumes on Play.

## D11 — Hash routing, relative base
`#/story/<scene>`, `#/explore`, `#/compare`, `#/method` deep-link and survive refresh on any
static host without rewrite rules.

## D12 — Staged entrances only in the Guided passage
Bass enters at beat 9, pad 17, accents 25 in Scene 02 only. Elsewhere all layers play from the
start so Explore and Compare are directly comparable. Note mapping is identical either way (tested).

## D13 — Out of scope (per the brief's priority cut)
Optical-flow "current movement" layer, numeric velocities, second stories (night lights, aerosols,
MUR anomalies), split-map compare, narration audio (captions are always shown instead).
