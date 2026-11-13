# Methods

## 1. Source chain
`NASA SVS 3912 → frame 26400 or 30400 (2048×1024 global, time from NASA's table) → hue matched
to NASA's legend → 4×4-cell median "normalized palette position" (0–1) → route sample → note →
instrument`. Every audible event carries its frame id, cell and value, shown in the inspector.

## 2. Feature extraction (`scripts/feature_lib.py`)
1. **Legend.** `sst_ecco2_cbar.png` is scanned for the widest run of saturated pixels (the bar,
   x = 14…291). Its rows are averaged into a 278-colour ramp; position = (x − x0)/(x1 − x0).
   Legend hue decreases strictly from ≈228° to ≈−6° (red wrapped below 0).
2. **Pixels.**
   - *Land*: saturation < 0.18 and 28 ≤ max channel ≤ 150 (NASA's gray shaded relief).
   - *Candidate*: max channel ≥ 40 and saturation ≥ 0.45.
   - Candidate hue within 6° of the legend's hue range → position = interpolated legend position.
3. **Cells** (4×4 px → 512×256 grid): value = median of matched positions;
   confidence = min(1, matched/8) × clip(1 − MAD/0.08, 0, 1).
   Status: *land* if ≥ 50 % land pixels; *ok* if ≥ 3 matched pixels and confidence ≥ 0.35;
   otherwise *occluded* (dark gaps, lakes, ambiguous colour) → rest.
4. **Storage**: `public/data/frames/frame-<n>.bin` = three uint8 planes
   (value×250 or 255, status, confidence×255).

Result: 78.5 % (A) / 77.0 % (B) of ocean cells usable.

## 3. Validation (`scripts/validate_alignment.py`)
- Registration: 24 landmarks (12 land, 12 sea, several near coasts — Florida, Italy, Adriatic,
  Red Sea, Mozambique Channel, Sri Lanka) checked on both frames: 24/24.
- Comparability: identical size, fixed camera, land masks agree on 99.81 % of pixels / 99.88 % of cells.
- Legend round trip: legend colours map back to their own positions within 0.029.
- Code parity: `src/tests/sourceIntegrity.test.ts` asserts the browser reproduces the Python
  reference samples (position, cell, status, value) for all 64 points on both frames.

## 4. Routes
Routes are stored in source coordinates (lat/lon on this registered frame). Waypoints are
antimeridian-unwrapped, densified to ≤ 0.25° steps, measured with haversine distance, and
resampled to 64 equal-distance points (endpoints included). Zoom, pan and screen size cannot
change the melody. Drawn traces are thinned to ≥ 40 km spacing; a trace shorter than 150 km is
treated as a probe.

## 5. Mapping
`u = clamp(value, 0, 1)`; `index = round(u × 10)`; `note = [C3 D3 E3 G3 A3 C4 D4 E4 G4 A4 C5][index]`.
The displayed value is never clamped. Quantization means nearby values can share a note; the
inspector always shows the exact value and explains same-note comparisons.

| Layer | Encodes | Rule |
|---|---|---|
| Melody | the sample | one note per beat |
| Bass | 8-point stretch mean | octave below, re-struck every 4 beats |
| Rhythm | spatial change | accent if \|Δ\| ≥ 0.048 vs previous valid point in listening order |
| Atmosphere | nothing (artistic) | constant C–G–D–E pad |

Tempo 96 BPM, 4/4; 64 steps = 40 s. Limiter at −3 dB; gain ramps of 80 ms for mute/solo.

## 6. Comparison
Temporal A/B is enabled only if the two frames share quantity, fidelity, size, verified
projection, verified timestamps, and are listed as a validated pair in the manifest
(`src/domain/compare.ts`). B − A is reported in normalized feature units. If either side is a
rest, no difference is computed. Spatial comparison (two places, one frame) is always available.

## 7. Known limitations
- The value is an image feature: it inherits rendering choices (streak blending, brightness).
- Red-end hue plateau (> 0.97 → ≈ 0.97).
- High-latitude streaks are dim; more cells there are rests.
- 4×4-pixel cells ≈ 0.7° — a single sample is not a point measurement.
