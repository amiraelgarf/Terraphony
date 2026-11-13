# Data sources

## Flagship (used by the app)
**NASA SVS 3912 — Global Sea Surface Currents and Temperature** — https://svs.gsfc.nasa.gov/3912/
Released 16 March 2012. ECCO2 (MIT/JPL, MITgcm) surface currents coloured by modeled absolute
SST; documented period 2007-03-25T12:00Z → 2008-03-03T12:00Z. Listed as item 4 of the
challenge's 11 official resources.

| Role | File (as published by NASA) | Bytes | SHA-256 |
|---|---|---:|---|
| Frame-number → UTC table | [`flat_ecco2_dates.txt`](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/flat_ecco2_dates.txt) | 50 025 | `2911a0e01ba21542462283276636f834511527ac45b9e5df76226acc03f743fb` |
| SST legend | [`sst_ecco2_cbar.png`](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/sst_ecco2_cbar.png) | 8 867 | `7c4c25f9ca51bb458c100ca4d31f452b8dfdbce8898e2945b7042729d55404c5` |
| Frame A — 2007-08-18 16:48 UTC | [`flat_global_ecco2_2028x1024.26400.tif`](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/frames/2048x1024_1x1_30p/orig/flat_global_ecco2_2028x1024.26400.tif) | 6 300 088 | `3e009f2640db6b51e6c9b97212f5c43cba322c26966e1310cd283f3c7afc0640` |
| Frame B — 2008-02-06 16:48 UTC | [`flat_global_ecco2_2028x1024.30400.tif`](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/frames/2048x1024_1x1_30p/orig/flat_global_ecco2_2028x1024.30400.tif) | 6 300 088 | `f8987ad8fe495cc4ebc1fc3812189f73c6a47c855b17875ddadfae8648a38310` |

(NASA's filenames say `2028x1024`; the images are 2048×1024.) Derived files in `public/` are
produced by `scripts/` and described in `public/data/manifest.json`.

## Not used
- Numeric ECCO2 fields — not hosted by SVS; ECCO Drive not reachable (see DECISIONS D1).
- SVS 5688 MUR 2025–2026 SST anomaly — a different product and variable; not mixed in.

## The 11 official challenge resources
Listed with their role in `public/data/sources.json` and on the app's Method page:
EIC Content Database (gallery), Caldwell 73 sonification (13786), Night Lights 2012–2023 (5313),
**Global Sea Surface Currents and Temperature (3912)**, GEOS Aerosols 2025 (5669), Air Quality
Model Runs (5533), Perpetual Ocean 2 (5425), DYAMOND CO₂ (5196), ISS Lightning 2017–2023 (5011),
3D Atmospheric River (4960), GEDI Forest Height (4950).
