"""Helpers for NASA SVS 3912 image assets (legend ramp, land detection).

The app no longer derives sound from image colours: these helpers only
  * read NASA's published SST legend so the numeric MUR field can be drawn
    with NASA's own colour ramp, and
  * detect NASA's gray shaded-relief land in a frame, to verify that the
    picture is registered with the numeric grid (validate_ocean_alignment.py).
"""
import numpy as np


def legend_lut(cbar_rgba):
    """Extract the ordered colour ramp from NASA's sst_ecco2_cbar.png.

    Returns (colors[N,3] float, positions[N] in 0..1, (x0, x1, row)).
    The bar is located as the widest run of strongly saturated pixels.
    """
    rgb = cbar_rgba[..., :3].astype(float)
    alpha = cbar_rgba[..., 3] if cbar_rgba.shape[-1] == 4 else np.full(rgb.shape[:2], 255)
    mx, mn = rgb.max(-1), rgb.min(-1)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
    colorful = (sat > 0.5) & (mx > 120) & (alpha > 200)
    counts = colorful.sum(1)
    rows = np.where(counts >= counts.max() * 0.95)[0]
    row = int(np.median(rows))
    cols = np.where(colorful[row])[0]
    x0, x1 = int(cols.min()), int(cols.max())
    band = rgb[rows.min():rows.max() + 1, x0:x1 + 1].mean(0)   # average the bar's rows
    positions = np.linspace(0.0, 1.0, band.shape[0])
    return band, positions, (x0, x1, row)


def hue_degrees(rgb):
    """HSV hue in degrees, unwrapped so the legend's red end is slightly
    negative (legend runs ~228 deg blue -> ~-6 deg red, strictly decreasing)."""
    rgb = rgb.astype(float)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx, mn = rgb.max(-1), rgb.min(-1)
    d = np.maximum(mx - mn, 1e-6)
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    return np.where(h > 300, h - 360, h)


def legend_hue_curve(lut_colors, lut_pos):
    """Return (hues ascending, positions) for np.interp. Verifies monotonicity."""
    hues = hue_degrees(lut_colors)
    if np.diff(hues).max() > 0.5:
        raise ValueError("Legend hue is not monotonic; palette-position feature is ill-defined")
    hues = np.minimum.accumulate(hues)       # remove sub-degree jitter
    return hues[::-1], lut_pos[::-1]


def svs_land_mask(rgb):
    """True where a frame pixel is NASA's gray GTOPO30 shaded relief."""
    rgb = rgb.astype(float)
    mx, mn = rgb.max(-1), rgb.min(-1)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
    return (sat < 0.18) & (mx >= 28) & (mx <= 150)
