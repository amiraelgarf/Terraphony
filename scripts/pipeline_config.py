"""Shared configuration for the offline Earth Records data pipeline.

Every script in this folder imports from here so dates, places, paths and URLs
are defined exactly once.
"""
from pathlib import Path

# --- Locations -------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = PROJECT_ROOT / "data-raw"            # downloaded originals (not committed)
PUBLIC_DIR = PROJECT_ROOT / "public"
PUBLIC_DATA = PUBLIC_DIR / "data"              # small processed grids / JSON
PUBLIC_FRAMES = PUBLIC_DIR / "nasa-svs"        # web-ready copies of NASA frames

# ===========================================================================
# SIDE A — OCEAN
# ===========================================================================
# Picture: NASA SVS 3912 "Global Sea Surface Currents and Temperature" (ECCO2 model).
SVS_ID = 3912
SVS_PAGE = "https://svs.gsfc.nasa.gov/3912/"
SVS_BASE = "https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/"
FRAME_DIR = SVS_BASE + "frames/2048x1024_1x1_30p/orig/"
FRAME_NAME = "flat_global_ecco2_2028x1024.{n}.tif"   # NASA's own (typo'd) filename
DATES_FILE = "flat_ecco2_dates.txt"                 # frame number -> UTC timestamp
COLORBAR_FILE = "sst_ecco2_cbar.png"                 # published SST legend
SOURCE_CREDITS = "NASA/Goddard Space Flight Center Scientific Visualization Studio"
CREDITS_PEOPLE = (
    "Animators: Greg Shirah, Horace Mitchell (NASA/GSFC), Eric Sokolowsky (GST, Inc.); "
    "Producer: Michael Starobin (HTSI); Scientists: Hong Zhang (UCLA), "
    "Dimitris Menemenlis (NASA/JPL Caltech). Model: ECCO2 (MIT/JPL)."
)

# Two frames from the same fixed-camera global sequence (timestamps are read
# from NASA's flat_ecco2_dates.txt at build time and must match OCEAN_DATES).
FRAMES = {"A": 26400, "B": 30400}

# Numbers: GHRSST L4 MUR SST v4.1 (NASA JPL / PO.DAAC) for the same calendar days.
OCEAN_DATES = {"A": "2007-08-18", "B": "2008-02-06"}
MUR_ERDDAP = "https://coastwatch.pfeg.noaa.gov/erddap"
MUR_DATASET = "jplMURSST41"
MUR_STRIDE = 25                 # 0.01 deg * 25 = 0.25 deg sub-sample
MUR_DOI = "10.5067/GHGMR-4FJ04"
MUR_PAGE = "https://podaac.jpl.nasa.gov/dataset/MUR-JPL-L4-GLOB-v4.1"
ICE_MASK_FRACTION = 0.15        # sea-ice fraction at or above this -> masked (rest)

# Fixed note domain for every ocean record (published in the UI and recipe).
# Chosen from the pooled valid distribution of both dates, see build_ocean_grids.py.
OCEAN_DOMAIN_C = (-2.0, 31.0)
OCEAN_ACCENT_C = 1.0            # |dSST| between consecutive samples that triggers an accent

# ===========================================================================
# SIDE B — LAND (seasons)
# ===========================================================================
# MODIS/Terra Vegetation Indices 16-Day L3 Global 250 m (MOD13Q1, collection 6.1)
# via the ORNL DAAC MODIS/VIIRS Land Product Subsets web service (no login).
MODIS_PRODUCT = "MOD13Q1"
MODIS_VERSION = "061"
MODIS_API = "https://modis.ornl.gov/rst/api/v1"
MODIS_DOI = "10.5067/MODIS/MOD13Q1.061"
MODIS_PAGE = "https://modis.gsfc.nasa.gov/data/dataprod/mod13.php"
LAND_YEAR = 2023
LAND_KM = 1                     # +/- 1 km around the site -> 9 x 9 pixels of 250 m
LAND_MIN_VALID_FRACTION = 0.5   # composite accepted if >= 50 % of pixels pass QA
LAND_DOMAIN_NDVI = (0.0, 0.9)
LAND_ACCENT_NDVI = 0.08

# Curated places. Chosen for contrasting, well-documented seasonal cycles.
LAND_PLACES = [
    {"id": "nile-delta", "name": "Nile Delta farmland", "region": "Western Nile Delta, Egypt",
     "lat": 30.85, "lon": 30.70, "landscape": "Irrigated cropland (two harvests a year)"},
    {"id": "harvard-forest", "name": "Harvard Forest", "region": "Massachusetts, USA",
     "lat": 42.531, "lon": -72.19, "landscape": "Temperate deciduous forest"},
    {"id": "sahel-dahra", "name": "Sahel grassland", "region": "Dahra, Senegal",
     "lat": 15.40, "lon": -15.43, "landscape": "Semi-arid savanna (one rainy season)"},
]

# Shared musical scale (C major pentatonic, MIDI)
PITCHES_MIDI = [48, 50, 52, 55, 57, 60, 62, 64, 67, 69, 72]
