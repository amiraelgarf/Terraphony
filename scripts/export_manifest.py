"""Final step — write public/data/manifest.json (what the app is playing, and how we know).

Collects: data products + versions, access routes, checksums of every downloaded
file, the frame timestamps from NASA's own table, registration validation,
the fixed musical domains, and the challenge's 11 official resources.

Usage:  python scripts/export_manifest.py
"""
import json

from pipeline_config import (CREDITS_PEOPLE, DATES_FILE, FRAME_DIR, FRAME_NAME, FRAMES, LAND_ACCENT_NDVI,
                             LAND_DOMAIN_NDVI, LAND_YEAR, MODIS_API, MODIS_DOI, MODIS_PAGE, MODIS_PRODUCT,
                             MODIS_VERSION, MUR_DATASET, MUR_DOI, MUR_ERDDAP, MUR_PAGE, OCEAN_ACCENT_C,
                             OCEAN_DATES, OCEAN_DOMAIN_C, PITCHES_MIDI, PUBLIC_DATA, RAW_DIR, SOURCE_CREDITS,
                             SVS_PAGE)

OFFICIAL_RESOURCES = [
    (1, "Earth Information Center (EIC) Content Database", "https://svs.gsfc.nasa.gov/gallery/earth-information-center/", "Context for the challenge"),
    (2, "Data Sonification: Caldwell 73", "https://svs.gsfc.nasa.gov/13786/", "Precedent for scanning sonification; studied, not copied"),
    (3, "Change in Night Lights between 2012 and 2023 — EIC Version", "https://svs.gsfc.nasa.gov/5313/", "Not used"),
    (4, "Global Sea Surface Currents and Temperature", "https://svs.gsfc.nasa.gov/3912/", "Side A picture: the NASA visualization behind every ocean route"),
    (5, "GEOS Aerosols (2025)", "https://svs.gsfc.nasa.gov/5669/", "Not used"),
    (6, "Air Quality Model Runs", "https://svs.gsfc.nasa.gov/5533/", "Not used"),
    (7, "Perpetual Ocean 2: Western Boundary Currents", "https://svs.gsfc.nasa.gov/5425/", "Visual reference for the ocean atmosphere"),
    (8, "DYAMOND Global Carbon Dioxide", "https://svs.gsfc.nasa.gov/5196/", "Not used"),
    (9, "Lightning Events Detected from ISS 2017–2023", "https://svs.gsfc.nasa.gov/5011/", "Not used"),
    (10, "A 3D View of an Atmospheric River from an Earth System Model", "https://svs.gsfc.nasa.gov/4960/", "Not used"),
    (11, "GEDI Forest Height", "https://svs.gsfc.nasa.gov/4950/", "Planned record: Beneath the Canopy (no data integrated yet)"),
]


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None


def frame_times():
    table = {}
    for line in (RAW_DIR / DATES_FILE).read_text(encoding="utf-8").splitlines():
        parts = line.split()
        if len(parts) == 2 and parts[0].isdigit():
            table[int(parts[0])] = parts[1].replace("Z", ":00Z")
    return table


def main():
    times = frame_times()
    validation = read_json(RAW_DIR / "validation.json") or {}
    grid = read_json(PUBLIC_DATA / "ocean" / "grid.json")
    places = read_json(PUBLIC_DATA / "land" / "places.json")
    acq = {
        "svs3912": read_json(RAW_DIR / "acquisition.json"),
        "mur": read_json(RAW_DIR / "mur" / "acquisition.json"),
        "modis": read_json(RAW_DIR / "modis" / "acquisition.json"),
    }
    frames = {}
    for key, n in FRAMES.items():
        t = times.get(n)
        if not t or not t.startswith(OCEAN_DATES[key]):
            raise SystemExit(f"Frame {n} timestamp {t} does not match OCEAN_DATES[{key}]={OCEAN_DATES[key]}")
        v = validation.get("dates", {}).get(key, {})
        frames[key] = {"frame": n, "timeUTC": t, "image": f"nasa-svs/svs3912-frame-{n}.jpg",
                       "url": FRAME_DIR + FRAME_NAME.format(n=n),
                       "landmarksPassed": v.get("landmarksPassed"), "landmarksTotal": v.get("landmarksTotal"),
                       "maskAgreement": v.get("maskAgreement")}

    manifest = {
        "schema": "earth-records.manifest.v1",
        "pitchesMidi": PITCHES_MIDI,
        "ocean": {
            "status": "verified_observations",
            "picture": {"svsId": 3912, "page": SVS_PAGE, "credit": SOURCE_CREDITS, "people": CREDITS_PEOPLE,
                        "frames": frames, "registrationVerified": bool(validation.get("registrationVerified")),
                        "legend": "nasa-svs/sst_ecco2_cbar.png", "timeTable": DATES_FILE},
            "numbers": {"product": "GHRSST Level 4 MUR Global Foundation SST Analysis", "version": "4.1",
                        "dataset": MUR_DATASET, "doi": MUR_DOI, "page": MUR_PAGE, "accessedVia": f"{MUR_ERDDAP}/griddap/{MUR_DATASET}",
                        "dates": OCEAN_DATES, "grid": grid},
            "domainC": list(OCEAN_DOMAIN_C), "accentC": OCEAN_ACCENT_C,
        },
        "land": {
            "status": "verified_observations",
            "product": f"{MODIS_PRODUCT} v{MODIS_VERSION}", "doi": MODIS_DOI, "page": MODIS_PAGE,
            "accessedVia": MODIS_API, "year": LAND_YEAR, "places": places["places"] if places else [],
            "domainNdvi": list(LAND_DOMAIN_NDVI), "accentNdvi": LAND_ACCENT_NDVI,
        },
        "fire": {"status": "planned", "svs": "https://svs.gsfc.nasa.gov/4993/",
                 "reason": "Per-window VIIRS/MODIS active-fire counts for the event polygon are not yet integrated or reviewed."},
        "acquisition": acq,
        "officialResources": [{"n": n, "title": t, "url": u, "role": r} for n, t, u, r in OFFICIAL_RESOURCES],
    }
    out = PUBLIC_DATA / "manifest.json"
    out.write_text(json.dumps(manifest, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
