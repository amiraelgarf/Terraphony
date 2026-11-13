# Decisions

Consequential choices made while implementing *Earth Records — Master Brief v5.0*, with reasons.

## D1 — Ocean notes come from MUR SST, the picture stays NASA SVS 3912
The brief requires numeric observations for production records, not colours. ECCO2 model fields
matching SVS 3912 are not hosted by SVS and JPL's ECCO Drive needs credentials (and may not match
the 2012 render). Brief §8A allows "another NASA-referenced numerical dataset explicitly named as
distinct". MUR SST v4.1 (NASA JPL) is an observation-based daily analysis, available without login
through ERDDAP, for **the very same days** as two SVS 3912 frames. So the visitor sees NASA's
beautiful model visualization and hears measured-analysis numbers for that day; every label says
which is which. The earlier version's "palette position" sonification of image colours was removed.

## D2 — 0.25° sub-sample, int16 encoding with explicit mask codes
Full-resolution MUR is ~1.3 GB per day. A stride-25 sub-sample (1440 × 720) keeps ocean basins and
fronts recognisable, loads in ~2 MB per day, and keeps land, lakes, sea ice and missing values as
distinct codes so a rest can always say *why*.

## D3 — Fixed ranges, published: −2…31 °C and 0…0.9 NDVI
From the pooled distribution (ocean: freezing point to the value exceeded by only 0.17 % of ocean
cells on both days) and from the typical vegetated NDVI span. Never rescaled per route/place/date,
so August vs February, or forest vs savanna, are honestly comparable. Clamping is disclosed.

## D4 — 24 stops at 120 bpm (≈ 12 s); the arrangement follows brief §7.3
Short enough to replay and compare; long enough to have a shape. Lead alone → bass → accents →
resolve. The only artistic voice (closing chord) is labelled and has its own mute.

## D5 — Bass = mean of each block of 4 values; accents = declared change thresholds
A documented summary (brief: "bass derives from a documented regional or temporal summary"), and a
declared change magnitude (1 °C / 0.08 NDVI). Changes are marked on the score even before the
accent voice enters, so silence in section 1–2 never hides information.

## D6 — Land: MOD13Q1 via the ORNL subset service, 9 × 9 pixels, ≥ 50 % QA pass
Real 250 m pixels with pixel-reliability QA, without downloading whole tiles. A 2 km neighbourhood
is a "documented point neighbourhood" (brief §8B). Rejected windows are rests, never interpolated.
Three places with contrasting cycles; the Nile Delta site was moved to an all-cropland window after
the first site included villages (mean NDVI 0.2–0.39 vs 0.31–0.75).

## D7 — One spoke per real 16-day window (23), not 12 months
Brief §10: draw true compositing intervals; month letters are only calendar guides.

## D8 — Records are recipes; the sleeve is a pure function of the recipe
Same recipe → same events → same sleeve (tested). Imported recipes are re-derived and refused if
their notes do not match their observations. PNG is drawn with the same geometry at 2400 px.

## D9 — Side C (Dixie Fire) is visible but not playable
Brief §2 MVP: "label it planned rather than making it falsely playable". Its sleeve is a sober
document grid; its dialog lists exactly what data and review are still required.

## D10 — No AudioContext before a gesture
Importing Tone.js creates an AudioContext, so Tone is loaded only inside the first gesture that
asks for sound (tested). A first soft note plays on "Make my Earth Record" if sound is allowed.
"Continue sound-off" and the Sound pill switch to a silent clock with identical visuals.

## D11 — One clock for sound and picture
Animation reads the transport position every frame; there are no independent CSS timers for data
motion. The press animation is the one exception: it is a fixed 2.7 s choreography of the record's
own geometry, skippable and replaced by a direct reveal under reduced motion.

## D12 — Hash routing + local persistence
`#/`, `#/library`, `#/studio/ocean|land`, `#/record/<id>`, `#/method` deep-link and survive
refresh on any static host. Drafts and the shelf live in `localStorage` only (no accounts, no
uploads); every storage access is guarded.

## D13 — Previous "Ocean in Motion" app
The earlier 7-scene observatory was replaced by this experience. Its source is preserved outside the
project at `../_legacy_backup/src-ocean-in-motion/` for reference.
