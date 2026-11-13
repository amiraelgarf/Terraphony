# Impeccable Review — Earth Records

Screen-by-screen review and fixes for a non-technical visualization team.
Each screen gets a critique and an audit. Findings are grouped Critical → Major → Minor and fixed in that order.

**No commits:** by request, changes stay uncommitted in the working tree for review. Ticking a screen means it is fixed and verified, not committed.

**Baseline (2026-11-13):** `npm run typecheck` passes · `npm test` 40/40 pass · dev server on :5173.
**E2E:** Chromium for Playwright installed. Final run: **26/26 passed** (desktop + Pixel 7).

## Screens

- [x] **00 · Invitation** — `#/` (`ArrivalScene`, `EarthRecordHero`, `TourCoach`)
- [x] **01 · Library** — `#/library` (`LibraryScene`, Side C dialog)
- [x] **02a · Ocean studio** — `#/studio/ocean` (`StudioScene`, `OceanAtlas`, `SonicScore`, `StudioControls`, `ScientificInspector`)
- [x] **02b · Land studio** — `#/studio/land` (`LandAtlas`, year dial)
- [x] **03 · Record press** — transient (`RecordPress`)
- [x] **04 · Reveal** — `#/record/<id>` (`RevealScene`, `RecordSleeve`, `RecordDisc`)
- [x] **05 · How it works** — `#/method` (`MethodScene`, `ScienceDialog`)
- [x] **States** — loading, data error, empty shelf, sound off / audio not started, fatal error boundary

## Shared components

Fixed once in a shared place, then reused. Pages must not restyle these.

| Component | Where | Status / note |
|---|---|---|
| **S1 · Type for actions** (`.cta` 15px/600 sentence case; `.link-btn`, `.mini-btn`, `.sound-toggle`, `.dialog__close` 14px DM Sans; `.eyebrow` 12px) | `base.css` | ✅ Fixed on the Invitation. Don't restyle these per page. |
| **S2 · Text colour tokens** `--copper-ink` (5.3:1 on paper), `--ink-muted`, `--paper-muted`; card surfaces `--side-a/b/c`, `--library-bg` | `tokens.css` | ✅ Use these instead of `opacity` or hex for text. |
| **S3 · Masthead**: step indicator (1 Choose · 2 Listen & shape · 3 Press · 4 Keep, compact "Step n of 4" on mobile), "Choose a journey", "How it works" kept on mobile, all targets ≥44px | `Masthead.tsx`, `base.css` | ✅ |
| **S4 · Scene change**: focus moves to the scene `h1`, `document.title` set per scene | `App.tsx` | ✅ Scenes that focus something more specific (Reveal) keep doing so. |
| **S5 · Scene entrance** without full-viewport blur | `base.css` | ✅ |
| **S6 · Icons**: lucide `ArrowUpRight`/`ArrowRight` (`.cta__arrow`) instead of unicode glyphs | per scene | ✅ Invitation and Library done; Studio/Reveal/Method still use glyphs and get switched on their own screens. |
| **S7 · Dialog**: stable `onClose`, 44px Close, `.dialog__actions` bottom row, `details/summary` style | `Dialog.tsx`, `base.css` | ✅ |
| **S8 · Studio controls**: segmented buttons, field legends, `.mini-btn` and `.link-btn--small` all at 44px / 14px+; score tokens `--score-note/-played/-change`; `.inspector :focus-visible` uses copper | `base.css`, `studio.css`, `tokens.css` | ✅ Reveal reuses the inspector and score, so it inherits these. |
| **Copy term**: "record recipe (JSON)" is now **"record file"** everywhere | Library, Reveal ("Save record file"), How it works, import errors | ✅ e2e selector updated in `tests/e2e/journeys.spec.ts`. |
| **S9 · `.cta--ink-solid`** (solid primary on paper), **`.mini-btn--ink`**; `.muted` uses colour (not opacity) on paper scenes; Side B/C labels get paper colours (`--sage-ink`) | `base.css`, `tokens.css` | ✅ |

## Direction (approved 2026-11-13)

- **Refine the current world**, without a redesign: keep the paper/deep surfaces, gold/copper accents, Instrument Serif + DM Sans, and the record metaphor. See `DESIGN.md`, North Star "The Listening Atlas".
- **Readable-First Rule:** actions and labels are at least 14px, sentence case, in DM Sans. Tiny uppercase mono stays for eyebrows only (at least 12px).

## UX pass (whole journey) — approved 2026-11-13 (Side C keeps full size)

Journey today: **Invitation → Library → Studio (listen + shape) → Press → Reveal**, with *How it works* reachable from the masthead.
Where a non-technical visitor gets stuck, and what I propose:

| # | Where | Problem for a non-technical user | Proposal |
|---|---|---|---|
| U1 | Everywhere | No sense of "where am I / what's next". The step label (`02 — Shape the journey`) is tiny and hidden on mobile. | Add a small **step indicator** to the masthead: *1 Choose · 2 Listen & shape · 3 Press · 4 Keep*. It stays visible on mobile in compact form. |
| U2 | Invitation | The headline is poetic, and the lead doesn't say what you actually do. "Continue sound-off" is buried in a tiny footer. | Keep the headline. Rewrite the lead in plain words ("Turn real NASA measurements of the sea and land into a short piece of music, then keep it as a record."). Move the sound choice next to the main button as a clear pair: **Start with sound** / *Start without sound*. Keep "Take the short tour" as the secondary path. |
| U3 | Masthead | "All records" actually opens the journey picker. | Rename it **"Choose a journey"**. |
| U4 | Library | The cards lead with jargon ("MUR v4.1", "MODIS MOD13Q1 v061", "NDVI"). Side C (not playable) gets equal weight with the two real choices. | Plain source line on cards ("Sea temperature measured by NASA satellites"), with the dataset names in smaller secondary text. **Demote Side C** to a smaller "Coming soon" card under the two playable sides. Rename "Open a record recipe (JSON)" to **"Open a saved record file"**. |
| U5 | Studio | The main action, **Hear this journey**, sits at the bottom of a long panel, below route, date, map layer, name and instrument. There are two competing titles ("A line through water" on the map, "Give this place a voice." in the panel). | Reorder the panel into three numbered steps: **① Listen** (play button + live readout at the top), **② Make it yours** (route/place, date, name, instrument), **③ Press your record**. Keep one page title. Collapse "Layers and volume" and the coordinate editor under "More options". |
| U6 | Studio score | The score header is technical ("−2–31 °C → C3–C5 · 120 bpm"). There's no legend for marks, gold dots or hollow rings. | Plain header ("Each mark is one stop · higher = warmer water") plus a three-item legend (note · big change · rest: no data here). Technical line moves into "What's behind these notes?". |
| U7 | Studio map | The credit line under the map is dense with dataset names. | Short plain credit ("Picture: NASA model · Notes: NASA satellite measurements, same day"), with full credits in the science dialog. |
| U8 | Press → Reveal | Check that "Reveal the record now" (skip) is visible enough and that the reveal makes the next steps obvious (play, save, make another). | Review on the screen pass. Likely group the actions as **Play** (primary) · **Save** (sleeve image / audio / recipe) · **Make another**. |

The data, the audio mapping, the scientific wording and the tests' journeys stay unchanged. Only labels, order and layout change.

## Decisions needed

- **Removing records from the shelf:** there is no way to delete a record, and the shelf silently drops the oldest after 12. Add a "Remove" button and a warning when the shelf is full? (Not done: it changes product behaviour.)

- ~~Approve U1–U8~~ → approved.
- ~~Demote Side C~~ → **no**: Side C stays a full-size card on the shelf (D9). U4 keeps only the plain-language source lines and the file-button rename.

---

<!-- Per-screen findings are appended below as each screen is reviewed. -->

## 00 · Invitation (`#/`)

Critique 21/32 (8 heuristics scored) · Audit 13/20 · Detector: 3 small-text hits, eyebrow above heading; 2 false positives (Natural Earth globe, atlas grid).

### Critical
- [x] I1 · "Continue sound-off" has no visible effect: the state was already shown as "Sound off". It is 10.5px, a 20px-tall target, and below the fold. → `clarify` + `layout`: explicit **Start with sound / Start without sound** pair next to the main action.

### Major
- [x] I2 · Lead doesn't say what you do (U2). → `clarify`
- [x] I3 · *(resolved by I1: the arrival choice now sets sound explicitly; the masthead label stays on/off)* Sound state shows "Sound off" while it is actually *not chosen*, and the primary button silently turns sound on. → `clarify` (shared: Masthead)
- [x] I4 · Action text 10–12px uppercase (Readable-First Rule). → `typeset` (shared: S1)
- [x] I5 · Copper text on paper 3.89:1 (eyebrow, dialog overline). → `colorize` (shared: S2)
- [x] I6 · Focus lost and title never changes when the scene changes. → `harden` (shared: S5)
- [x] I7 · Mobile: "How it works" hidden, sound toggle 36px tall, record visual below the fold. → `adapt` (shared: S4)
- [x] I8 · Hero globe re-renders the whole SVG through React state on every frame. → `optimize`

### Minor
- [x] I9 · Eyebrow chip "An invitation to listen" above the h1 (a craft-floor ban). The step indicator now carries orientation. → `distill`
- [x] I10 · Unicode arrows (↗ →) standing in for icons. → `polish` (shared: S6, lucide icons)
- [x] I11 · Full-viewport `blur(8px)` on every scene entrance. → `animate` (shared: S7)
- [x] I12 · *(no change, by design)* 1.65s departure can't be skipped. **Kept by design**: it's the signature moment, and a direct cut happens under reduced motion.

## 01 · Library (`#/library`)

Critique 24/40 · Audit 15/20 · Detector: 12 hits (6 valid: small text, stragglers, eyebrow; others are mono metadata or vinyl grooves by design).

### Critical
- none

### Major
- [x] L1 · Cards lead with jargon (MUR v4.1, MODIS MOD13Q1, NDVI) at 10px (U4). → `clarify` + `typeset`
- [x] L2 · Card actions 11px uppercase mono, below the fold at 768px tall. → `typeset` + `layout`
- [x] L3 · "Open a record recipe (JSON)" → "Open a saved record file" (U4). → `clarify`
- [x] L4 · *(Side C stays full size; plain lead added, technical list moved under a "What's still needed" disclosure, bottom "Back to the journeys" button added)* Side C dialog is written for scientists, repeats a sentence, has no bottom action, and its muted text is 3.92:1. → `clarify` + `colorize`
- [x] L5 · Card buttons wrap headings, so the accessible name is the whole card. → `harden`
- [x] L6 · "All records" label → "Choose a journey" (U3); no journey indicator (U1). → `clarify` (shared: S4)

### Minor
- [x] L7 · Eyebrow chip "The library / Pick a side" above the h1. → `distill`
- [x] L8 · Straggler last words on card paragraphs. → `polish`
- [x] L9 · Dialog close button 32px tall; the dialog effect re-runs on parent re-render (inline onClose). → `harden`
- [x] L10 · Card surfaces are hard-coded hex values. → `colorize` (tokenised)

### Verification (Invitation + Library)
- Desktop 1024×768 and mobile 375×812 checked in the browser. No horizontal overflow. Every action is ≥14px and every target ≥44px tall (scripted scan of both screens). The Library card actions now sit inside 768px.
- Re-audit: detector clean on all changed files (exit 0). The copper text contrast issue is fixed with `--copper-ink`.
- Keyboard: focus lands on the new scene heading after navigation. The Side C dialog takes focus on Close, Esc closes it, and focus returns to the card.
- `npm run typecheck` ✅ · `npm test` 40/40 ✅ · `npm run build` ✅ · e2e ⚠️ not run (browser missing).

## 02a · Ocean studio (`#/studio/ocean`) + 02b · Land studio (`#/studio/land`)

Reviewed together: they share `StudioScene`, the panel, the score and the inspector.
Critique Ocean 24/40, Land 26/40 · Audit Ocean 10/20, Land 11/20 · Detector: 0 findings.

### Critical
- [x] T1 · Desktop layout bug: the `@media (min-width:981px)` rule comes before the base `.studio` rule, so the panel never scrolls. **Hear this journey** sits at y≈1090 and the score at y≈1340 on a 900px screen, so the map, score and play button are never visible together. → `layout`
- [x] T2 · The short tour card opens off-screen (it depends on T1), and its first step points at an off-screen button. → `layout` + `onboard`

### Major
- [x] T3 · Panel order hides the main action (U5). Two competing titles. → `layout` + `distill`: ① Listen · ② Make it yours · ③ Press · More options
- [x] T4 · Studio-only text below the Readable-First Rule: segmented buttons, field legends, inspector Close/summary, mixer, Fit route, readout labels, score labels and tour steps are 9–11.5px. → `typeset`
- [x] T5 · Score header is technical ("−2–31 °C → C3–C5 · 120 bpm"), with no legend and 9px "+ bass / + accents / resolve" labels (U6). → `clarify`
- [x] T6 · Map credit is dense dataset jargon at 10px over the picture (U7). Land's dial legend is jargon and hidden on mobile; month letters repeat (J/J/J). → `clarify` + `adapt`
- [x] T7 · Readout mislabels values when idle ("Sea surface temperature: 18 August 2007", "Greenness (NDVI): 2023"). → `clarify`
- [x] T8 · Inspector: no focus move, no Esc, no focus return. On mobile it opens about 1400px from the tapped mark. The gold focus ring on paper is 1.63:1. → `harden` + `colorize`
- [x] T9 · Contrast: inspector labels 3.86:1, table labels 4.26:1, score section labels 3.25:1, change dot 2.37:1, played mark 2.79:1. → `colorize`
- [x] T10 · Mobile: Hear is two screens down. Order is map → panel → score (DESIGN.md says map → score → controls). Score marks are 13px wide. The map swallows vertical swipes (`touch-action:none` in pan mode). → `adapt`
- [x] T11 · Touch targets under 44px: zoom, segmented buttons, mini buttons, mixer summary, inspector Close. → `adapt`

### Minor
- [x] T12 · The whole studio re-renders on every animation frame while playing (`useSmoothPlayhead` lives in `StudioScene`). → `optimize`
- [x] T13 · Draw mode still shows the preset's note and has no on-map hint. Coordinate inputs have no visible lat/lon labels. → `clarify`
- [x] T14 · Jargon in controls: "Instrument character… timbre", "Measured field", "23 of 23 windows passed quality checks". → `clarify`
- [x] T15 · Unicode ▶ ❚❚ ↗ glyphs (S6 rollout); hard-coded studio colours. → `polish` + `colorize`
- [x] T16 · Land map place markers are 14px click targets and their labels are clipped on mobile. → `adapt`

### What changed (studios)
- **Layout (T1, T2):** desktop now fits on one screen (map + three-step panel + score at 1024×768; the panel scrolls on its own). The tour card sits beside the play button.
- **Panel (T3):** one page title on the map, then ① **Listen** (where/when summary, plain readout, Hear button), ② **Make it yours** (route or place, day, name, sound), ③ **Press your record** (with a one-line "what this does"). **More options** holds the map view switch and the sound layers.
- **Score (T5):** "The living score" with a plain line ("Each mark is one stop on your line. A higher mark means warmer water.") and a three-item legend. Section labels now read "Bass joins / Accents join / Ending".
- **Credits (T6):** a plain sentence on a readable backing plus a **Full credits** link that opens "What's behind these notes?". Land legend is plain; months read Jan / Apr / Jul / Oct.
- **Inspector (T8):** announces its sentence, Esc closes it and returns focus to the note, 44px Close, copper focus ring.
- **Performance (T12):** only the map and the score follow the per-frame clock now; the panel no longer re-renders 60×/s during playback.
- **Mobile (T10, basic):** order is map → score → steps, score marks are 24px (score scrolls sideways), a "Hear it" button sits in the score header, and the map no longer traps vertical swipes. *Mobile is desktop-first by request: only checked for "nothing breaks".*

### Verification (studios)
- Desktop 1024×768: Hear at y=377, score at y=544–768, page doesn't scroll. Scripted scan: no action text under 14px and no target under 44px (except the inline "Full credits" link inside a sentence). Detector clean.
- Inspector: open → announcement fired; Esc → closed and focus back on "Stop 9 of 24".
- Mobile 375px: no horizontal overflow on either studio.
- `npm run typecheck` ✅ · `npm test` 40/40 ✅ · `npm run build` ✅ · e2e ⚠️ not run (Playwright browser missing). The e2e selectors (`Hear this journey`, `^Pause`, `Edit the route by coordinates`, `.score__caption`, `.place-option`, tour region) were all kept.

## 03 · Record press (transient)

Critique 20/28 · Audit 13/20 · Detector: 0 in TSX.

### Major
- [x] P1 · The skip link is partly below the fold at 1024×768 (bottom at 792px) and looks pale and quiet. Esc doesn't skip. → `layout`

### Minor
- [x] P2 · Nothing says the record is already kept on the shelf. → `clarify`
- [x] P3 · `.press__count` is 10px; eyebrow plus a subline that repeats the h1; the status label is announced 4× in 2.7s. → `typeset` + `distill` + `harden`

## 04 · Reveal (`#/record/<id>`)

Critique 25/40 · Audit 12/20.

### Major
- [x] R1 · Action hierarchy (U8): Play and Explore look identical; saves and "Make another" sit below the fold at 768 in one flat row. → `layout` + `clarify`
- [x] R2 · "Export record recipe (JSON)" uses the old name (and the e2e test selector must change with it). → `clarify`
- [x] R3 · The page never says the record is already kept in this browser. → `clarify`
- [x] R4 · Fact labels 10px at 3.78:1, credits 11px at 3.63:1, background off-token, ad-hoc greys. → `typeset` + `colorize`

### Minor
- [x] R5 · "Explore its notes" opens below the fold silently; the score has no header or legend here. → `harden`
- [x] R6 · Export errors show a raw browser message and aren't announced. → `harden`
- [x] R7 · Unicode ▶ ❚❚ ↓, eyebrows above headings, jargon in facts ("120 bpm", "timbre only"). → `polish` + `clarify`
- [x] R8 · The disc's drop-shadow is re-rasterised every frame while it spins. → `optimize`

## 05 · How it works (`#/method`)

Critique 17/32 · Audit 13/20.

### Major
- [x] M1 · The page leads with a code formula and jargon; no plain summary. → `clarify` + `distill`
- [x] M2 · Side B/C labels on paper are 1.49:1 and 1.87:1; `.muted` is 3.92:1; table captions 10.5px at 4.45:1. → `colorize` + `typeset`

### Minor
- [x] M3 · Way-finding: "Back to the records ↗" (external-looking glyph) only at the top of a 3,900px page. → `layout` + `clarify`
- [x] M4 · "recipe" wording, scientist-language Side C paragraph, side-stripe code block, 95-character lines. → `clarify` + `polish`

## States

- [x] X1 · Error boundary shows the raw error message, and Reload loses your place. → `harden`
- [x] X2 · Import error messages are technical. → `clarify`
- [x] X3 · A shared `#/record/<id>` link to a record that isn't on this browser silently redirects. → `harden`
- [x] X4 · Studio load error shows a raw error and has no retry. → `harden`
- [x] X5 · Shelf items now show title + "Sea/Land · day" and have distinct accessible names. *(Removing records and the 12-record limit warning are open: see Decisions needed.)*

### What changed (Press, Reveal, How it works, States)
- **Press:** the eyebrow is gone; the subline says "It's already kept on your shelf in this browser."; a clear **Skip to my record** button sits under the title (y=225 at 768, was cut off at 792); Esc skips; the count line is 13px.
- **Reveal (U8):** solid **Play my record**; "See what each note means" opens the score, scrolls to it and focuses its heading (with a plain lead); **Keep a copy** group = Sleeve image · Audio · **Save record file** with one line explaining the file; "Kept on your shelf in this browser"; facts moved under **Record details** in plain words; **Make another record** at the end. Export errors are plain and announced. Disc shadow no longer re-renders while spinning.
- **How it works:** opens with **In short** (3 plain points); the formula sits behind "Show the exact formula"; Side labels readable (5.2–5.6:1); "Choose a journey" at the top and bottom; "recipe" wording gone.
- **States:** error screen in plain words with **Reload the page** / **Go to my records** and the technical message tucked away; plain import errors; a record link that isn't on this browser explains itself in the Library; studio load error has **Try again**; shelf items show title and day.

### Verification (Press, Reveal, How it works, States)
- Desktop 1024×768: press skip at y=225–279; Esc → reveal, focus on "It's yours."; Play at y=415, Keep a copy at y=539–676 (both above the fold). Method contrast checks pass. Detector clean.
- `npm run typecheck` ✅ · `npm test` 40/40 ✅.

## Follow-up fixes after review

- [x] **Studio map overlapped the score** on short desktop windows (reported with a screenshot). Cause: the map kept a 420px minimum height even when less space was left above the score. Fix: the map can shrink on desktop, the studio's minimum page height is 720px (shorter windows scroll instead of overlapping), and the score always draws above the map. Verified at 1600×700 and 1024×768: map bottom = score top, no overlap.
- [x] e2e selectors follow the renamed buttons: "Save record file", "Sleeve image", "Audio". The mobile drawing test scrolls the map into view first, needed because of the new map → score → steps order. The mobile score button is named "Score playback: play/pause" so it doesn't clash with the main Pause button.

## Final checks
- `npm run typecheck` ✅ · `npm test` 40/40 ✅ · `npm run build` ✅ · `npx playwright test` 26/26 ✅ · detector clean on every changed screen.
- Nothing committed (by request). `.gitignore` gained a `.claude` line from the skill's overlay tool on the first review run; it is still there for you to keep or drop.
