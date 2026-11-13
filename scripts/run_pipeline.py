"""Run the whole offline data pipeline in order.

  1. acquire_svs3912_frames.py   download NASA assets (+ checksums)
  2. extract_visual_features.py  frames -> feature grids + web images
  3. validate_alignment.py       registration / comparability / legend checks
  4. build_story_route.py        curated 64-step route + reference samples
  5. export_manifest.py          manifest.json + sources.json

The processed outputs are already committed under public/, so you only need
this to regenerate them.  Usage:  python scripts/run_pipeline.py
"""
import runpy
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

STEPS = ["acquire_svs3912_frames", "extract_visual_features", "validate_alignment",
         "build_story_route", "export_manifest"]

for step in STEPS:
    print(f"\n=== {step} ===")
    try:
        runpy.run_path(str(HERE / f"{step}.py"), run_name="__main__")
    except SystemExit as e:
        if e.code not in (0, None):
            if step == "validate_alignment":
                print("Validation failed: the manifest will mark registration/comparison as NOT verified.")
                continue
            raise
print("\nPipeline complete.")
