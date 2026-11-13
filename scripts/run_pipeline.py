"""Run the whole offline data pipeline in order.

  Side A — ocean
    1. acquire_svs3912_frames.py    NASA SVS 3912 frames, legend, timestamp table (+ checksums)
    2. acquire_mur_sst.py           MUR SST v4.1 for the same two days (0.25 deg sub-sample)
    3. build_ocean_grids.py         compact int16 grids, data-map images, web copies of frames
    4. validate_ocean_alignment.py  picture <-> numbers registration checks
    5. build_ocean_presets.py       suggested routes + reference samples for tests
  Side B — land
    6. acquire_modis_ndvi.py        MOD13Q1 v061 pixels for the curated places (2023)
    7. build_land_series.py         QA-filtered 16-day NDVI series
  8. export_manifest.py             public/data/manifest.json

Processed outputs are already committed under public/, so you only need this
to regenerate them.  Usage:  python scripts/run_pipeline.py
"""
import runpy
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

STEPS = ["acquire_svs3912_frames", "acquire_mur_sst", "build_ocean_grids", "validate_ocean_alignment",
         "build_ocean_presets", "acquire_modis_ndvi", "build_land_series", "export_manifest"]

for step in STEPS:
    print(f"\n=== {step} ===", flush=True)
    try:
        runpy.run_path(str(HERE / f"{step}.py"), run_name="__main__")
    except SystemExit as e:
        if e.code not in (0, None):
            if step == "validate_ocean_alignment":
                print("Validation failed: the manifest will mark registration as NOT verified.")
                continue
            raise
print("\nPipeline complete.")
