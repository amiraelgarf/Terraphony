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

## D9 — Side C (Dixie Fire) removed
It used to appear as an unplayable "planned" sleeve. The V8 handoff (§9) asks for no placeholder
tiles, so the library now shows only the two playable records.

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

## D14 — A narrated journey, not a tutorial (V8 handoff)
**Begin the narrated journey** is the only click the tour needs: it unlocks sound inside the
gesture.

After that click:
- **What moves it on.** Each beat starts when the previous cue actually ends
  (`NarrationService`), or when the music reaches a planned data event.
- **The visitor's choice wins.** Choosing a side, pausing, or inspecting a note always takes
  priority.
- **No stale actions.** A `TourDirector` token cancels obsolete beats, so a late cue ending can
  never navigate anyone.
- **Never on the visitor's behalf.** The tour never presses or exports a record for them.
- **Where the discovery comes from.** It is computed from the data (`notableIndex`), not
  scripted. The specific spoken values are asserted against the data in tests.
- **Existing motion is reused.** The director uses the scenes' own transitions (needle → ring →
  line; card → geography zoom) rather than new animation.

## D15 — The voice: recorded first, browser speech only as a fallback
The script, direction, manifest format and renderer (ElevenLabs with character timestamps, or an
actor's files) are complete. The clips themselves need a licence or an actor, so they are not
included (see VOICE.md).

Until they exist, the fallback works like this:
- It ranks the device's voices and prefers neural, warm, lower voices. Edge's "Natural" voices
  are the best of these.
- It speaks phrase by phrase, with scripted pacing, pitch and real silences.
- Captions always run. The music is never ducked (see D20).

## D16 — The desktop studio fits the viewport
A CSS rule-order bug let the studio grow taller than the screen, which pushed the living score out
of view. The desktop rule now comes after the base rule, so the score stays docked, as the
handoff requires (§8).

## D17 — A small ensemble instead of one instrument (and no noise)
Visitors heard "only piano", and the change accents (filtered noise bursts) made the mix sound
noisy. The record's events are untouched: same notes, same bass, same accents, and recipes and
tests unchanged. A pure `arrange()` (`src/audio/ensemble.ts`) now orchestrates them:
- **Melody:** the lead instrument, doubled by a wind voice in sections 3–4.
- **Bass:** a cello-like voice.
- **Strings:** a pentatonic triad built on the data bass, or on the melody in the resolve.
- **Accents:** pitched bell chimes instead of noise.

Section 1 is still the melody alone. The mix is cleaner:
- less reverb (it is now a send);
- a gentle 9.5 kHz high cut;
- milder compression;
- a measured WAV peak of about −9 dBFS with no clipping.

## D18 — Any place on the land map
Three curated places were too limiting. Any point can now be chosen, by clicking the map or
typing coordinates. Its year is fetched live from ORNL and built with the pipeline's own rules.
Water, ice or missing land data simply become rests, and the panel says why.

## D19 — The land picture moves with the music
Instead of 12 generic monthly images, the studio shows NASA's own MODIS 16-day NDVI picture for
the exact window each note comes from (GIBS, 23 per year). It crossfades as the year plays and
follows any note the visitor selects. All 23 pictures are preloaded, starting with the one on
screen.

## D20 — The sound: proven voices, scheduled on the audio thread
The sound was described as noisy, disturbed and stopping, especially in Chrome. Measurements showed
the cause was timing, not the instruments:
- **The page blocks.** With a 4×-throttled CPU (a typical laptop under load), the page blocked the
  main thread for up to 2.3 s during playback.
- **Tone.js waited for the page.** Its Transport only hands notes to the audio engine 0.1 s ahead,
  and it does that from the main thread, so notes arrived up to 2 s late or bunched up.
  Raising the look-ahead to 0.6 s did not help.
- **Notes were dropped.** Tone's PolySynth also drops notes past its polyphony limit.

The fix:
- **Schedule everything at once.** On play, the whole remaining record (about 24 notes) is scheduled
  on the audio thread at exact times. No main-thread clock is involved during playback.
- **Voice pools.** Round-robin pools of single voices never drop notes.
- **Instant pause and seek.** They swap in fresh instruments, discarding anything still queued.
- **Lighter page.** Only the small cursor parts redraw every frame, and the 23 land pictures publish
  their loading in batches.

Verified on a 4×-throttled CPU: the live recording matches the offline render (contour correlation
0.94 for ocean, 0.89 for land), with 0 ms drift. Live level is +8 dB (peak about −18 dBFS).

The voices are the original engine's (`93a2a50`), plus a soft low string pad, a rounder bass, and
soft bells instead of noise bursts. The glass reverb tail is 4 s instead of 6.5 s.

## D20c — Loud enough to hear, and no silent engine during development
- **Levels.** Measured in real Google Chrome, the music peaked at only −18 dBFS. The opening,
  where the melody plays alone, peaked at −27 dBFS, which is nearly inaudible at an ordinary
  laptop volume. The levels are now set like ordinary music: a +12 dB make-up gain, the melody
  lifted further, a gentle compressor (−10 dB threshold, 2:1 ratio) and a −1 dB limiter. At the
  default 70 % volume, the opening peaks around −5 dBFS and the full ensemble around −3, with no
  clipping. An e2e test guards these levels.
- **Development reloads.** Hot-module replacement in `npm run dev` could swap the audio modules
  inside an open tab. The page then kept animating with a fresh, silent engine. Audio and tour
  modules now force a full page reload when they change.

## D20b — The score is never covered
On laptop-height windows (600–730 px) the map insisted on a 420 px minimum and ran 40–60 px into
the score, covering its header and section labels. On desktop the map now takes only the space
that is left, the score sits above it, and on short screens the staff is a little more compact. An
e2e test checks the layout at 1366 × 657.

## D21 — The score is a staff
Floating bars on long stems did not read as music. The score is now a 5-line staff:
- The 11 pitches sit on lines and spaces, as oval note heads with stems.
- A bar line marks every 4 notes, which is the bass block.
- Accent marks sit over changes, and rests are dashed rings.
- The cursor sits on the note being heard.

It uses the same buttons, keyboard model and classes as before.

## D21b — Nothing on the stage stacks
The map area has fixed zones:
- **Top-left:** the title. **Top-right:** the legends and the picture date.
- **Footer:** the credit and hint on the left, the zoom buttons on the right.
- **Inspector:** a card that always ends above the footer and scrolls if needed.
- **Host caption:** above the footer. While the camera holds on a discovery, it moves to the
  top-left so the sample and its thread to the score stay visible.

On phones the staff scrolls sideways and keeps the sounding note in view.

## D22 — A real portrait of the host
The hand-drawn SVG cameo looked amateur. It is replaced by Stieler's 1820 portrait, which is in
the public domain, in the same round frame and with the same speaking and baton states.

## D13 — Previous "Ocean in Motion" app
The earlier 7-scene observatory was replaced by this experience. Its source is preserved outside the
project at `../_legacy_backup/src-ocean-in-motion/` for reference.
