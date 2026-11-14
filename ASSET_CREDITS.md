# Asset credits

## Data
- **MUR SST v4.1** — JPL MUR MEaSUREs Project. 2015. GHRSST Level 4 MUR Global Foundation Sea
  Surface Temperature Analysis. Ver. 4.1. PO.DAAC, CA, USA. doi:10.5067/GHGMR-4FJ04. Accessed via
  NOAA CoastWatch ERDDAP (`jplMURSST41`). Sea-ice fraction: EUMETSAT OSI SAF (as distributed in MUR).
- **MODIS MOD13Q1 v061** — Didan, K. (2021). MOD13Q1 MODIS/Terra Vegetation Indices 16-Day L3
  Global 250m SIN Grid V061. NASA EOSDIS Land Processes DAAC. doi:10.5067/MODIS/MOD13Q1.061.
  Subsets: ORNL DAAC MODIS/VIIRS Land Product Subsets web service.

## NASA imagery (live, not stored)
**MODIS Terra 16-day NDVI** pictures from NASA Global Imagery Browse Services (GIBS),
https://earthdata.nasa.gov/gibs, part of NASA's Earth Science Data and Information System
(ESDIS). The colour legend is GIBS's own `MODIS_L3_NDVI_H`.

## NASA visualization (in `public/nasa-svs/`)
**Global Sea Surface Currents and Temperature**, NASA SVS 3912 — https://svs.gsfc.nasa.gov/3912/.
Credit: NASA/Goddard Space Flight Center Scientific Visualization Studio. Animators: Greg Shirah,
Horace Mitchell (NASA/GSFC), Eric Sokolowsky (GST, Inc.). Producer: Michael Starobin (HTSI).
Scientists: Hong Zhang (UCLA), Dimitris Menemenlis (NASA/JPL Caltech). Model: ECCO2 (MIT/JPL).
Topography: GTOPO30 (USGS). Only two still frames and the legend are used; no NASA soundtrack,
logos or insignia. Usage follows https://svs.gsfc.nasa.gov/help/ and NASA media guidelines.

## Maps
Natural Earth (public domain) via the `world-atlas` package (ISC, Mike Bostock).

## Our own work
- All music is original, synthesized by this project's own renderer (`src/audio/dsp.ts`); no samples or recordings.
- The host's portrait: **Joseph Karl Stieler, *Portrait of Ludwig van Beethoven when composing the
  Missa Solemnis* (1820)**, Beethoven-Haus Bonn. Public domain, via Wikimedia Commons
  (https://commons.wikimedia.org/wiki/File:Beethoven.jpg), cropped to
  `public/host/beethoven-stieler-1820.jpg`. The host's words are this project's own script, not
  Beethoven's. The voice is a captioned
  narration: a recorded or licensed voice when provided (see VOICE.md), otherwise the visitor's
  own browser voice. No Beethoven compositions or recordings are used.
- Interface, sleeve algorithms, groove geometry and copy: this project. The visual direction follows
  the team's own *Earth Records Record Press* prototype.

## Open source
Fonts (SIL Open Font License, self-hosted via Fontsource): Instrument Serif, DM Sans, DM Mono.
Libraries: React (MIT), d3-geo (ISC), topojson-client (ISC), Vite (MIT),
Vitest (MIT), Playwright (Apache-2.0), NumPy (BSD), SciPy (BSD), Pillow (MIT-CMU).

> An independent NASA Space Apps Challenge 2026 project using NASA data and visualization assets;
> not endorsed by NASA.
