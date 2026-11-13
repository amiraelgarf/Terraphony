"""Shared configuration for the offline SVS 3912 data pipeline.

Every script in this folder imports from here so frame choices, paths and
URLs are defined exactly once.
"""
from pathlib import Path

# --- Locations -------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = PROJECT_ROOT / "data-raw"            # downloaded originals (not committed)
PUBLIC_DIR = PROJECT_ROOT / "public"
PUBLIC_DATA = PUBLIC_DIR / "data"              # small processed JSON / grids
PUBLIC_FRAMES = PUBLIC_DIR / "nasa-svs"        # web-ready copies of NASA frames

# --- Official source -------------------------------------------------------
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

# --- Frame selection -------------------------------------------------------
# Two frames from the same uncropped, fixed-camera 2:1 global sequence.
# Chosen roughly six months apart (late northern summer vs northern winter)
# so the comparison is a seasonal contrast between two model times, NOT a trend.
FRAMES = {
    "A": 26400,   # timestamp resolved from flat_ecco2_dates.txt at build time
    "B": 30400,
}

# --- Feature grid ----------------------------------------------------------
CELL = 4                  # source pixels per grid cell side (2048x1024 -> 512x256)
MIN_PALETTE_PIXELS = 3    # of 16 pixels in a cell, at least this many must match the legend
PALETTE_MAX_HUE_GAP = 6.0 # degrees a pixel's hue may sit outside the legend's hue range
MIN_CONFIDENCE = 0.35     # below this a cell is treated as occluded -> rest

# --- Story route -----------------------------------------------------------
ROUTE_SAMPLES = 64
