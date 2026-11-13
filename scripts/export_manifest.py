"""Step 5 — write public/data/manifest.json and public/data/sources.json.

The manifest is the single source of truth the app reads about *what* it is
sonifying: fidelity, quantity, frame timestamps (from NASA's dates table),
registration status (from validate_alignment.py) and checksums.

Usage:  python scripts/export_manifest.py
"""
import json

from feature_lib import NO_VALUE, STATUS, VALUE_SCALE
from pipeline_config import (CELL, CREDITS_PEOPLE, DATES_FILE, FRAME_NAME, FRAMES,
                             MIN_CONFIDENCE, MIN_PALETTE_PIXELS, PALETTE_MAX_HUE_GAP,
                             PUBLIC_DATA, RAW_DIR, SOURCE_CREDITS, SVS_PAGE, FRAME_DIR)

OFFICIAL_RESOURCES = [
    (1, "Earth Information Center (EIC) Content Database", "https://svs.gsfc.nasa.gov/gallery/earth-information-center/", "Context: proves the EIC relationship"),
    (2, "Data Sonification: Caldwell 73", "https://svs.gsfc.nasa.gov/13786/", "Conceptual precedent for audible scanning; studied, not copied"),
    (3, "Change in Night Lights between 2012 and 2023 — EIC Version", "https://svs.gsfc.nasa.gov/5313/", "Roadmap: possible second story"),
    (4, "Global Sea Surface Currents and Temperature", "https://svs.gsfc.nasa.gov/3912/", "FLAGSHIP: the frames sonified in this app"),
    (5, "GEOS Aerosols (2025)", "https://svs.gsfc.nasa.gov/5669/", "Roadmap"),
    (6, "Air Quality Model Runs", "https://svs.gsfc.nasa.gov/5533/", "Roadmap"),
    (7, "Perpetual Ocean 2: Western Boundary Currents", "https://svs.gsfc.nasa.gov/5425/", "Visual reference"),
    (8, "DYAMOND Global Carbon Dioxide", "https://svs.gsfc.nasa.gov/5196/", "Roadmap"),
    (9, "Lightning Events Detected from ISS 2017–2023", "https://svs.gsfc.nasa.gov/5011/", "Roadmap"),
    (10, "A 3D View of an Atmospheric River from an Earth System Model", "https://svs.gsfc.nasa.gov/4960/", "Roadmap"),
    (11, "GEDI Forest Height", "https://svs.gsfc.nasa.gov/4950/", "Roadmap"),
]


def read_dates():
    table = {}
    for line in (RAW_DIR / DATES_FILE).read_text(encoding="utf-8").splitlines():
        parts = line.split()
        if len(parts) == 2 and parts[0].isdigit():
            table[int(parts[0])] = parts[1].replace("Z", ":00Z")
    return table


def main():
    dates = read_dates()
    acquisition = json.loads((RAW_DIR / "acquisition.json").read_text(encoding="utf-8"))
    validation = json.loads((RAW_DIR / "validation.json").read_text(encoding="utf-8"))
    stats = json.loads((RAW_DIR / "feature_stats.json").read_text(encoding="utf-8"))
    checksums = {f["file"]: f["sha256"] for f in acquisition["files"]}

    registered = all(r["passed"] == r["total"] for r in validation["registration"].values())
    comparable = bool(validation["comparability"]["comparable"]) and registered

    frames = []
    for key, n in FRAMES.items():
        name = FRAME_NAME.format(n=n)
        frames.append({
            "id": f"svs3912-{n}", "label": key, "svsId": 3912, "frameNumber": n,
            "assetUrl": FRAME_DIR + name,
            "imagePath": f"nasa-svs/svs3912-frame-{n}.jpg",
            "featurePath": f"data/frames/frame-{n}.bin",
            "captureOrModelTimeUTC": dates.get(n),          # from NASA's own table
            "visualProjection": "verified-equirectangular" if registered else "unregistered-image",
            "geographicBounds": [-180, -90, 180, 90],
            "width": 2048, "height": 1024,
            "fidelity": "verified-visual-frame",
            "variable": "image_feature_normalized",
            "sourceCredits": SOURCE_CREDITS,
            "sha256": checksums.get(name),
            "featureStats": stats[key],
        })

    manifest = {
        "schemaVersion": "2.0",
        "storyId": "ocean-in-motion",
        "primaryOfficialResourceId": 3912,
        "sourceGallery": "https://svs.gsfc.nasa.gov/gallery/earth-information-center/",
        "sourceVisual": SVS_PAGE,
        "fidelity": "verified-visual-frame",
        "variable": "image_feature_normalized",
        "units": "normalized_0_1",
        "featureName": "Normalized palette position",
        "interpretation": ("Position, between 0 and 1, of a pixel's hue along NASA's published SST colour legend "
                           "(0 = legend's left end, labelled 0 °C; 1 = right end, labelled 32 °C), "
                           "median of matched pixels in a 4x4-pixel cell. An image feature, not a temperature."),
        "timeRangeDocumentedUTC": ["2007-03-25T12:00:00Z", "2008-03-03T12:00:00Z"],
        "availableFrames": frames,
        "availableComparablePairs": [[frames[0]["id"], frames[1]["id"]]] if comparable else [],
        "mapRegistrationVerified": registered,
        "registrationEvidence": {k: f"{v['passed']}/{v['total']} landmark checks"
                                 for k, v in validation["registration"].items()},
        "comparability": validation["comparability"],
        "grid": {"cellSize": CELL, "width": 2048 // CELL, "height": 1024 // CELL,
                 "planes": ["value", "status", "confidence"], "noValue": NO_VALUE,
                 "valueScale": VALUE_SCALE, "statusCodes": STATUS},
        "processing": {
            "sourceAlgorithm": "hue-to-legend-position inversion (scripts/feature_lib.py)",
            "pixelRules": {"candidate": "max channel >= 40 and saturation >= 0.45",
                           "land": "saturation < 0.18 and 28 <= max channel <= 150 (GTOPO30 relief)",
                           "hueGapDegrees": PALETTE_MAX_HUE_GAP},
            "aggregation": f"median over matched pixels in {CELL}x{CELL} cells; "
                           f"needs >= {MIN_PALETTE_PIXELS} matched pixels and confidence >= {MIN_CONFIDENCE}",
            "confidence": "min(1, matched/8) * clip(1 - MAD/0.08, 0, 1)",
            "missingPolicy": "explicit_rest",
            "legendNote": validation["legend"]["note"],
        },
        "dataIntegrity": {"verifiedRealData": True, "fixture": False,
                          "sampledFrom": "NASA SVS 3912 frame set 2048x1024_1x1_30p/orig"},
        "pipelineA": {"attempted": True, "available": False,
                      "reason": "Matching ECCO2 numeric fields for these frames were not reachable; "
                                "see DECISIONS.md. The app therefore sonifies visual features only."},
        "sourceCredits": SOURCE_CREDITS,
        "creditsPeople": CREDITS_PEOPLE,
        "sourceFilesAndChecksums": acquisition["files"],
    }
    (PUBLIC_DATA / "manifest.json").write_text(json.dumps(manifest, indent=1, ensure_ascii=False), encoding="utf-8")

    sources = [{"n": n, "title": t, "url": u, "role": r} for n, t, u, r in OFFICIAL_RESOURCES]
    (PUBLIC_DATA / "sources.json").write_text(json.dumps(sources, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote manifest (registered={registered}, comparable={comparable}) and sources.json")


if __name__ == "__main__":
    main()
