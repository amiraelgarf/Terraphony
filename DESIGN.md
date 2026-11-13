---
name: Earth Records
description: A listening atlas — follow a real NASA observation through space or time and press it into a record.
colors:
  paper: "#f2ede3"
  paper-2: "#e9e2d4"
  cream: "#fff9ee"
  ink: "#10292a"
  ink-soft: "#435b56"
  deep: "#081e22"
  deep-2: "#0d2427"
  deep-3: "#12302f"
  copper: "#b55d47"
  copper-soft: "#d8795c"
  gold: "#e7b276"
  gold-hi: "#f3d49c"
  forest: "#8b9e6e"
  sage: "#aabdb7"
typography:
  display:
    fontFamily: "Instrument Serif, Iowan Old Style, Georgia, serif"
    fontSize: "clamp(62px, 6.6vw, 116px)"
    fontWeight: 400
    lineHeight: 0.86
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Instrument Serif, Iowan Old Style, Georgia, serif"
    fontSize: "clamp(38px, 3.6vw, 60px)"
    fontWeight: 400
    lineHeight: 0.92
  lead:
    fontFamily: "Instrument Serif, Iowan Old Style, Georgia, serif"
    fontSize: "clamp(19px, 1.7vw, 26px)"
    fontWeight: 400
    lineHeight: 1.3
  body:
    fontFamily: "DM Sans, system-ui, Segoe UI, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "DM Sans, system-ui, Segoe UI, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.4
  eyebrow:
    fontFamily: "DM Mono, ui-monospace, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0.14em"
rounded:
  none: "0px"
  pill: "40px"
  round: "50%"
spacing:
  gutter: "clamp(18px, 4.2vw, 76px)"
  masthead: "76px"
  masthead-mobile: "64px"
components:
  button-primary-paper:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "15px 22px"
    height: "52px"
  button-primary-paper-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  button-primary-dark:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.deep}"
    rounded: "{rounded.none}"
    padding: "15px 22px"
    height: "52px"
  button-primary-dark-hover:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.deep}"
  sound-toggle:
    backgroundColor: "transparent"
    rounded: "{rounded.pill}"
    padding: "6px 13px"
    height: "36px"
  dialog:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "clamp(24px, 4vw, 54px)"
---

# Design System: Earth Records

## Overview

**Creative North Star: "The Listening Atlas"**

Earth Records is cartography you can hear. Precise NASA maps sit on near-black, like a chart table at night. Below them runs a calm paper score where every mark is a real measurement. The vinyl record is how people keep and share what they made: a sleeve, a groove and a disc pressed from their own route. It is not decoration for its own sake.

The system moves between two surfaces. **Paper** (warm cream, ink type) is for invitation, reading and keepsakes. **Deep** (teal-black, gold accents) is for looking and listening. A scene belongs to one of them, and the switch between them is part of the story. Science colors come only from NASA's own legends. The house palette never pretends to be data.

The audience is a non-technical visualization team, so the atlas must read before it impresses. Primary actions are obvious and written in plain sentences. Technical detail is always one deliberate step away, never in the way.

**Key Characteristics:**
- Two surfaces, paper and deep, never mixed inside one panel.
- Serif display for meaning, sans for doing, mono only for small reference labels.
- Square-edged, ruled, editorial geometry. Circles belong only to the record and the globe.
- One clock: data motion follows the audio transport, never free CSS timers.
- Every note has an origin you can inspect.

## Colors

A warm archival palette: paper and ink for reading, deep teal for listening, gold and copper as the only accents.

### Primary
- **Listening Gold** (`gold`): active state, focus ring and route stops on deep surfaces. It means "this is live / this is you".
- **Pressing Copper** (`copper`): the paper-surface accent. Used for emphasis words, focus rings on paper and the record label ring.

### Secondary
- **Field Forest** (`forest`) and **Sea Sage** (`sage`): quiet secondary tones for Side B (land) and muted text on deep surfaces.

### Neutral
- **Archive Paper** (`paper`, `paper-2`, `cream`): reading surfaces, dialogs and the reveal.
- **Chart Ink** (`ink`, `ink-soft`): text on paper.
- **Night Sea** (`deep`, `deep-2`, `deep-3`): the studio and library backgrounds, layered from darkest to lightest for depth.

### Named Rules
**The Not-A-Legend Rule.** House colors never encode data. Temperature and greenness use NASA's published legends only.

**The Two-Accent Rule.** Gold lives on deep, copper lives on paper. Neither crosses over except inside the record object itself.

## Typography

**Display Font:** Instrument Serif (with Iowan Old Style, Georgia)
**Body Font:** DM Sans (with system-ui)
**Label/Mono Font:** DM Mono (with ui-monospace)

**Character:** A literary serif carries the voice of the place. A plain grotesque does the work. Mono appears only where something is a reference (coordinates, units, eyebrows).

### Hierarchy
- **Display** (400, clamp 62–116px, 0.86): one per scene, the scene's title.
- **Headline** (400, clamp 38–60px, 0.92): sleeve and section titles.
- **Lead** (serif 400, clamp 19–26px, 1.3): the one sentence that says what this screen is for.
- **Body** (400, 16px, 1.5): explanations, max 65ch.
- **Label** (500, 14–15px, sentence case): buttons, form labels, controls. Field legends are 15px DM Sans, not uppercase mono.
- **Eyebrow** (mono, 12px, 0.14em, uppercase): small orienting labels above titles, decorative only.

### Named Rules
**The Readable-First Rule.** Anything a person must read to act (buttons, labels, inputs, values) is at least 14px, sentence case, in DM Sans. Uppercase mono is for eyebrows and reference data only, never at less than 12px. *(Decision 2026-11-13.)*

**The Plain-Words Rule.** Say what happens, not what it is called: "Hear this journey", not "Play transport". Jargon (SVS, NDVI, SST) appears only next to a plain explanation.

## Layout

Full-bleed scenes, each `min-height: 100svh`, with a fixed-height masthead (76px, 64px on mobile) and a fluid gutter (`clamp(18px, 4.2vw, 76px)`). The invitation is a split: paper text on the left, the deep record object on the right. The studio is map-first with a control column on desktop. It stacks on mobile as map → score → controls. Breakpoint at 760px. Text columns stay under 65ch.

## Elevation & Depth

Mostly flat and ruled. Depth comes from tonal layering of the deep surfaces and 1px hairline rules (`rule-dark` / `rule-paper`). Shadows are reserved for physical objects (records, sleeves, sleeve cards on hover, dialogs) so they read as things you could pick up.

### Named Rules
**The Object-Only Shadow Rule.** Only the record, sleeves and dialogs cast shadows. Interface panels never do.

## Shapes

Square corners everywhere in the interface: buttons, panels, dialogs and inputs. The only round things are the record, the globe, the brand emblem and the sound pill. That contrast is what makes the record feel like an object.

## Components

### Buttons
- **Shape:** square (0px), 1px border in current color, minimum 52px tall for primary and 44px for all others.
- **Primary on paper:** ink outline, fills ink on hover. **Primary on deep:** solid paper, turns gold on hover.
- **Hover / Focus:** lifts 2px. 2px focus ring offset 4px, gold on deep and copper on paper.
- **Link button:** underlined text action for secondary paths. **Mini button:** compact control inside the studio.

### Primary on paper, solid (`.cta--ink-solid`)
- Ink fill with paper text; turns copper-ink on hover. Used when a paper screen has one action that must win (Play my record, Reload the page).

### Step indicator (masthead)
- Four numbered steps: 1 Choose · 2 Listen & shape · 3 Press · 4 Keep. The current step has a gold disc (copper-ink on paper). Below 1180px only the current label shows; on phones it reads "Step n of 4".

### Studio panel steps
- The studio panel is three numbered sections: ① Listen (summary, readout, play) · ② Make it yours · ③ Press your record. Rarely needed controls live in one **More options** disclosure. Section titles are serif 26px with a 28px numbered disc; ① has a filled disc.

### Score legend
- Every score shows a one-line plain reading ("A higher mark means warmer water") and a three-item legend: note bar, big-change dot (`--score-change`), rest ring.

### Sound toggle
- A pill (40px radius) with three animated bars when sound is on. It is always in the masthead, and it is the one way to mute everything.

### Dialog
- Paper sheet on a blurred deep backdrop, square, with a serif headline and a lead sentence. Esc closes it and focus returns to the opener.

### Sleeve card (Library)
- Square sleeve with a disc that slides out on hover. Lifts 8px with an object shadow. Side C is visibly "in preparation" and never looks playable.

### Living score
- Paper strip of 24 marks (height = note). Gold dots mark declared changes. Hollow rings are rests. It follows the one clock.

## Do's and Don'ts

### Do:
- **Do** give every screen one obvious primary action and one lead sentence saying what the screen is for.
- **Do** let headings stand alone: orientation comes from the step indicator, not from small labels above titles.
- **Do** use lucide icons (`ArrowRight`, `ArrowUpRight`, `Play`, `Pause`, `Download`) for icons in controls, never unicode glyphs.
- **Do** colour secondary text with `--ink-muted` (paper) or `--paper-muted` (deep), never with `opacity`.
- **Do** keep technical detail (formulas, dataset IDs, raw errors) one click away inside a `details` disclosure.
- **Do** keep buttons and labels at 14px or more in sentence case (The Readable-First Rule).
- **Do** keep sound opt-in and mirror everything audible on screen (caption, highlighted mark, readout).
- **Do** respect reduced motion: cut instead of animate, keep all information.

### Don't:
- **Don't** use house colors to encode data (The Not-A-Legend Rule).
- **Don't** round interface corners. Only record objects are round.
- **Don't** put shadows on panels or controls.
- **Don't** show a technical term without a plain explanation beside it.
- **Don't** put an eyebrow label directly above a page or section heading.
- **Don't** use the dark-surface eyebrow colours (`sage`, `muted`) on paper; use `--sage-ink` / `--ink-muted`.
