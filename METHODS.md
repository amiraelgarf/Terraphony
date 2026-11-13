# Methods

Everything here is implemented in code that is referenced by file, and checked by tests.

## 1. The one musical rule (`src/audio/normalize.ts`)

```
u     = clamp((value − lo) / (hi − lo), 0, 1)
index = round(u × 10)
note  = [C3 D3 E3 G3 A3 C4 D4 E4 G4 A4 C5][index]      (MIDI 48 50 52 55 57 60 62 64 67 69 72)
```

| Side | Variable | Fixed range [lo, hi] | One note step | Accent threshold |
|---|---|---|---|---|
| A Ocean | sea surface temperature, °C | −2 … 31 °C | 3.3 °C | ≥ 1.0 °C change |
| B Land | NDVI (unitless) | 0 … 0.9 | 0.09 | ≥ 0.08 change |

* The range never changes between routes, places or dates (comparison requirement).
* Ocean range: from just below sea-water freezing (≈ −1.8 °C) to 31 °C. On the two days used,
  0.17 % of open-ocean values exceed 31 °C; none are below −2 °C. Clamped values are labelled
  “clamped” in the inspector.
* Quantisation: every value in a note's band plays that note; the inspector shows the band and the
  exact value, so equal notes are never mistaken for equal measurements.

## 2. Arrangement (`src/audio/musicMapper.ts`)

One event per observation, in order, 120 bpm (0.5 s per event; 24 events ≈ 12 s).

| Section (of N events) | Layers | Data or art |
|---|---|---|
| 1 · first 5/24 | lead | data |
| 2 · until 12/24 | + bass on every 4th event = mean of the valid values in that block of 4, one octave down | data |
| 3 · until 20/24 | + accent where \|value − previous valid value\| ≥ threshold | data |
| 4 · last 4/24 | lead + accents; bass rests; after the last note, a C–G–E–G closing chord | the chord is **artistic** |

Score marks show every declared change (gold dot) even before the accent voice enters.
Instrument palettes (glass / wood / felt) change only synthesis and room; tests prove notes are identical.

## 3. Side A — ocean route

**Numbers:** GHRSST L4 MUR SST v4.1, variable `analysed_sst` (°C), daily analysis at nominal
09:00 UTC, 0.01°. Downloaded through NOAA CoastWatch ERDDAP (`jplMURSST41`) with a stride of 25 →
a regular 0.25° grid of point values (1440 × 720). Not an anomaly.

**Masks** (`build_ocean_grids.py`): MUR `mask` bit 2 → land; bit 4 → lake; `sea_ice_fraction` ≥ 0.15
→ sea ice; no analysed value → missing. Stored as int16 codes, so the browser never sees an
invented value.

**Picture:** NASA SVS 3912 frames 26400 (2007-08-18T16:48Z) and 30400 (2008-02-06T16:48Z), times
from NASA's `flat_ecco2_dates.txt`. The picture is the ECCO2 *model* rendering; the notes are MUR
*observation-based analysis*. Both are labelled everywhere; the “Measured field” layer draws the MUR
numbers with NASA's own SVS 3912 legend ramp (0–32 °C) so the visitor can see the data itself.

**Registration** (`validate_ocean_alignment.py`): 24 landmarks (12 land, 12 sea, several within ~1°
of a coast) must agree in BOTH the MUR mask and the SVS frame's gray relief: 24/24 on both days.
Land-mask agreement between MUR and the SVS picture (|lat| ≤ 70°, excluding ice): 98.4 % (A), 98.4 % (B).

**Route → stops** (`src/data/geodesicPath.ts`, mirrored in `scripts/geo_lib.py`): waypoints are
antimeridian-unwrapped, each map segment densified to ≤ 0.25°, cumulative great-circle (haversine)
length measured, 24 stops placed at equal distances including both ends. Drawn traces are thinned
to ≥ 60 km spacing; lines shorter than 300 km are refused (“draw a longer path”). Zoom, pan and
screen size cannot change the stops.

**Sampling** (`murSstAdapter.ts`, mirrored in `build_ocean_presets.py`): the nearest grid cell
decides the status (land / lake / sea ice / missing → rest). Otherwise bilinear interpolation over
the valid corners of the enclosing 2 × 2 cell, weights renormalised. Invalid points are never
snapped to nearby water. `pythonParity.test.ts` proves the browser reproduces Python for all 3
presets × 2 days (stops, statuses, cells, values to 0.001 °C, notes).

## 4. Side B — a year in one place

**Numbers:** MODIS/Terra MOD13Q1 collection 6.1, 250 m, 16-day composites, via the ORNL DAAC
MODIS/VIIRS Land Product Subsets service. Bands: `250m_16_days_NDVI` (×0.0001, fill −3000),
`250m_16_days_pixel_reliability` (0 good, 1 marginal, 2 snow/ice, 3 cloudy), and
`250m_16_days_composite_day_of_the_year`.

**Per window** (`build_land_series.py`): the 9 × 9 pixels within ±1 km of the site; a pixel is
accepted if reliability is 0 or 1 and NDVI is not fill. If ≥ 50 % of pixels are accepted, the value
is their mean (std reported as spread); otherwise the window is a rest: *masked (snow/ice)* if most
rejected pixels are snow/ice, else *quality_rejected (cloud)*. Rests are never interpolated.

**Time:** one note per real composite window starting in 2023 (23 windows; the last one runs
19 Dec 2023 – 3 Jan 2024). Labels show true intervals (“13–28 Aug 2023”). The dial draws one spoke
per window; month letters are calendar guides only.

| Place | Site | Windows valid | Character |
|---|---|---|---|
| Nile Delta farmland | 30.85° N, 30.70° E | 23 / 23 | irrigated cropland, two growing peaks |
| Harvard Forest | 42.531° N, 72.19° W | 21 / 23 (1 cloud, 1 snow) | deciduous forest, one summer plateau |
| Sahel grassland | 15.40° N, 15.43° W | 21 / 23 (2 cloud) | semi-arid savanna, one rainy-season pulse |

NDVI indicates relative greenness, not plant health. The copy never equates low NDVI with damage.

## 5. Records, sleeves and exports

* `buildRecord()` assembles the `EarthRecord` (brief §9 contract): source, geometry, time window,
  observations with status/quality/detail, musical rule, instrument, events, narrative, credits.
* Sleeve art (`sleeveArt()` in `src/visuals/geometry.ts`) is a pure function of the recipe:
  ocean = the route's own shape with offset contour lines whose spacing follows the temperatures;
  land = closed “growth rings” whose radius follows NDVI through the year. The PNG renderer draws
  the same paths with `Path2D` at 2400 × 2400 and adds title, catalogue number, side, time and source.
* The pressing disc's spiral groove gives each note an equal arc; its value pushes the groove outward.
* `parseRecipe()` re-derives events from the stored observations + rule and refuses any recipe whose
  stored notes differ, any rest that carries a value, and any non-verified source.
* WAV: `Tone.Offline` renders the same voices and events, encoded as 16-bit PCM stereo, 44.1 kHz.

## 6. One clock

`src/audio/transport.ts` schedules events on the Tone.js Transport and fires step callbacks with
`Tone.Draw` at the audible moment; animation reads `transport.position()` (minus look-ahead) every
frame. With sound off or unavailable, a `performance.now()` clock produces identical steps. Map
cursor, year-dial hand, score, caption and disc groove all read the same position. Tone.js itself is
loaded only after a user gesture, so no AudioContext exists before the visitor asks for sound.

## 7. Known limitations

* MUR is sub-sampled to 0.25° point values for the web; very sharp coastal fronts can be smoothed.
* The picture (ECCO2 model, 2012 rendering) and the numbers (MUR analysis) can disagree locally;
  they are different products and are labelled as such.
* MODIS values are a 2 km neighbourhood mean; mixed land cover (villages, roads) lowers NDVI.
* Accents use one global threshold per side; the same threshold is used for every route/place.
