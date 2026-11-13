# Data sources

All files below were downloaded by `scripts/` without login; checksums are recorded in
`data-raw/**/acquisition.json` and copied into `public/data/manifest.json`.

## Side A numbers — MUR SST v4.1 (used for every ocean note)

**GHRSST Level 4 MUR Global Foundation Sea Surface Temperature Analysis, v4.1** — NASA JPL
(MEaSUREs), distributed by PO.DAAC. https://podaac.jpl.nasa.gov/dataset/MUR-JPL-L4-GLOB-v4.1 ·
doi:10.5067/GHGMR-4FJ04. Accessed through the public NOAA CoastWatch ERDDAP mirror, dataset
`jplMURSST41` (variables `analysed_sst`, `sea_ice_fraction`, `mask`), every 25th grid point.

| Day | File (data-raw/mur) | Bytes | SHA-256 |
|---|---|---:|---|
| 2007-08-18 | `mur-20070818.nc` | 17 642 248 | `f95dcf3d4f8fb138feb03621f93913d138bcd1acb73f1b1e9621a0e4d0893fb7` |
| 2008-02-06 | `mur-20080206.nc` | 17 642 248 | `6ca8e4ce7ba6a52982ff64e35c91c93e58894df867d9414ca85ab32871890a51` |

Request URL pattern (see `scripts/acquire_mur_sst.py`):
`https://coastwatch.pfeg.noaa.gov/erddap/griddap/jplMURSST41.nc?analysed_sst[(DATE T09:00:00Z)][(-89.99):25:(89.99)][(-179.99):25:(180.0)],…`

## Side A picture — NASA SVS 3912

**Global Sea Surface Currents and Temperature** — https://svs.gsfc.nasa.gov/3912/ (ECCO2 model,
MIT/JPL; released 2012). Item 4 of the challenge's official resources.

| Role | File | Bytes | SHA-256 |
|---|---|---:|---|
| Frame → UTC table | `flat_ecco2_dates.txt` | 50 025 | `2911a0e01ba21542462283276636f834511527ac45b9e5df76226acc03f743fb` |
| SST legend | `sst_ecco2_cbar.png` | 8 867 | `7c4c25f9ca51bb458c100ca4d31f452b8dfdbce8898e2945b7042729d55404c5` |
| Frame 26400 · 2007-08-18 16:48 UTC | `flat_global_ecco2_2028x1024.26400.tif` | 6 300 088 | `3e009f2640db6b51e6c9b97212f5c43cba322c26966e1310cd283f3c7afc0640` |
| Frame 30400 · 2008-02-06 16:48 UTC | `flat_global_ecco2_2028x1024.30400.tif` | 6 300 088 | `f8987ad8fe495cc4ebc1fc3812189f73c6a47c855b17875ddadfae8648a38310` |

(Files from `https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/`; frames under
`frames/2048x1024_1x1_30p/orig/`. NASA's filenames say 2028x1024; the images are 2048 × 1024.)
The picture is context only; no value is read from its colours.

## Side B numbers — MODIS MOD13Q1 v061

**MODIS/Terra Vegetation Indices 16-Day L3 Global 250 m SIN Grid, v061** — NASA LP DAAC
(Didan, 2021), doi:10.5067/MODIS/MOD13Q1.061 · https://modis.gsfc.nasa.gov/data/dataprod/mod13.php.
Accessed through the ORNL DAAC MODIS/VIIRS Land Product Subsets REST service
(`https://modis.ornl.gov/rst/api/v1/MOD13Q1/subset`), ±1 km around each site, all composites
starting in 2023.

| Place | File (data-raw/modis) | Bytes | SHA-256 |
|---|---|---:|---|
| Nile Delta farmland | `nile-delta.json` | 38 369 | `0a01c663bf21371fba70086fc9cbf2a9138c36a85f9f3a477a9dfaea3a5e336a` |
| Harvard Forest | `harvard-forest.json` | 38 324 | `1e00f1144027ccd496b8c0ba14a54d3be139163daad7142832864b88a65a1858` |
| Sahel grassland | `sahel-dahra.json` | 38 381 | `db4ae27d4eee31568c7ae50200d2109f033c16d0537b0595fef04b585fe6733f` |

**Any place (live).** A point chosen on the map, or typed as coordinates, is fetched in the
browser from the same ORNL service:
- **What is fetched:** NDVI and pixel reliability, 6 requests, about 15–40 s.
- **Rules:** the same QA as `build_land_series.py`. `src/tests/modisLive.test.ts` rebuilds the
  three curated places from their raw responses and gets identical windows.
- **Caching:** each point is kept in this browser's `localStorage`.

## Side B picture — NASA GIBS, MODIS Terra 16-day NDVI

**What it is:** NASA Global Imagery Browse Services (GIBS), WMS layer
`MODIS_Terra_L3_NDVI_16Day`, EPSG:4326
(`https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi`). No login is needed, and CORS is
open.

**How it is used:**
- **Matching dates.** One JPEG for each 16-day window of 2023 (`TIME` = the window's start date,
  the same date as the MOD13Q1 composite), so there are 23 dated pictures per view.
- **Fitted to the view.** Each picture is cropped to the visible map and uses the studio's ocean
  colour as background (`BGCOLOR`).
- **Colour scale:** NASA's legend, `https://gibs.earthdata.nasa.gov/legends/MODIS_L3_NDVI_H.png`.
- **Role:** the picture shows the season; the notes always come from the MOD13Q1 numbers.

## Base map

Natural Earth land (1:110m on the invitation globe, 1:50m in the land studio), public domain,
via the `world-atlas` npm package (ISC).

## Planned, not used yet

* **Dixie Fire 2021** — NASA SVS 4993 (https://svs.gsfc.nasa.gov/4993/) and FIRMS
  (https://firms.modaps.eosdis.nasa.gov/). Not integrated; removed from the library until it can be played honestly (DECISIONS D9).
* **GEDI forest height** — NASA SVS 4950. Not integrated.

## Derived files in this repository

| File | From | Size |
|---|---|---|
| `public/data/ocean/mur-sst-YYYYMMDD.bin` | MUR, int16 LE 1440 × 720 | 2.07 MB each |
| `public/data/ocean/mur-sst-YYYYMMDD.png` | MUR drawn with NASA's SVS 3912 legend | ~0.6 MB each |
| `public/data/ocean/grid.json`, `presets.json` | grid geometry/encoding; routes + Python reference samples | small |
| `public/data/land/*.json` | QA-filtered series + raw pixels | ~28 kB each |
| `public/nasa-svs/*.jpg` | SVS 3912 frames re-encoded for the web | ~0.9 MB each |
| `public/data/manifest.json` | provenance, checksums, validation, official resources | small |
