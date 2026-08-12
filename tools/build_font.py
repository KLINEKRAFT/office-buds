#!/usr/bin/env python3
"""
Office Buds - bitmap font builder.

Canvas fillText is always antialiased, which turns to mush next to nearest-neighbour
sprite art. So all in-game text is blitted from a bitmap atlas instead.

We rasterise Liberation Sans Bold at 9px and hard-threshold it to 1-bit. At that size
the letterforms collapse into chunky pixel shapes that sit correctly beside the
sprites, while staying far more legible per pixel than a hand-drawn 5x7 face. The
engine draws the atlas white and tints it, and scales it by whole numbers only
(1x for name tags and chat, 2x for headings), so there is exactly one pixel grid.

Liberation fonts are SIL Open Font License 1.1 - see README.

Run:  python3 tools/build_font.py       (needs Pillow + numpy)
"""

from __future__ import annotations

import json
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from pixelpng import save_indexed

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "assets")

FONT = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
CHARS = "".join(chr(c) for c in range(32, 127))

# Two sizes. "font" carries chat, speech bubbles and buttons; "font_small" is only for
# name plates, which the brief asks to keep understated - at 9px a name read almost as
# wide as the character is tall.
VARIANTS = [
    ("font", 9, 140),
    ("font_small", 7, 120),
]

CELL_W, CELL_H = 20, 16   # scratch space per glyph, trimmed afterwards
PEN = (3, 2)              # where the glyph origin sits inside the scratch cell


def render(font: ImageFont.FreeTypeFont, ch: str, threshold: int) -> np.ndarray:
    im = Image.new("L", (CELL_W, CELL_H), 0)
    ImageDraw.Draw(im).text(PEN, ch, font=font, fill=255)
    return (np.array(im) >= threshold)


def build(name: str, size: int, threshold: int) -> None:
    font = ImageFont.truetype(FONT, size)

    masks = {ch: render(font, ch, threshold) for ch in CHARS}

    # One shared baseline: find the vertical band any glyph touches, crop all to it.
    used = np.zeros(CELL_H, bool)
    for m in masks.values():
        used |= m.any(axis=1)
    ys = np.where(used)[0]
    if not len(ys):
        raise SystemExit("font rendered empty")
    top, bottom = int(ys.min()), int(ys.max())
    line_h = bottom - top + 1

    glyphs: dict[str, dict] = {}
    strips: dict[str, np.ndarray] = {}
    for ch, m in masks.items():
        band = m[top:bottom + 1]
        cols = np.where(band.any(axis=0))[0]
        advance = max(1, round(font.getlength(ch)))
        if not len(cols):                      # space and friends
            glyphs[ch] = {"x": 0, "y": 0, "w": 0, "left": 0, "advance": advance}
            continue
        x0, x1 = int(cols.min()), int(cols.max())
        strips[ch] = band[:, x0:x1 + 1]
        glyphs[ch] = {"w": x1 - x0 + 1, "left": x0 - PEN[0], "advance": advance}

    # Pack the strips into one row-major atlas.
    PAD = 1
    max_w = 256
    x = y = 0
    for ch in CHARS:
        if ch not in strips:
            continue
        w = strips[ch].shape[1]
        if x + w > max_w:
            x, y = 0, y + line_h + PAD
        glyphs[ch]["x"], glyphs[ch]["y"] = x, y
        x += w + PAD
    height = y + line_h

    atlas = Image.new("RGBA", (max_w, height), (0, 0, 0, 0))
    px = atlas.load()
    for ch, strip in strips.items():
        gx, gy = glyphs[ch]["x"], glyphs[ch]["y"]
        for yy in range(strip.shape[0]):
            for xx in range(strip.shape[1]):
                if strip[yy, xx]:
                    px[gx + xx, gy + yy] = (255, 255, 255, 255)

    os.makedirs(OUT, exist_ok=True)
    save_indexed(atlas, os.path.join(OUT, f"{name}.png"))

    with open(os.path.join(OUT, f"{name}.json"), "w") as fh:
        json.dump({
            "image": f"/assets/{name}.png",
            "lineHeight": line_h,
            "spacing": 1,       # extra px the engine inserts between glyphs
            "glyphs": glyphs,
        }, fh, separators=(",", ":"))

    kb = os.path.getsize(os.path.join(OUT, f"{name}.png")) / 1024
    print(f"{name}.png {max_w}x{height} lineHeight={line_h} glyphs={len(glyphs)} ({kb:.1f} KB)")


def main() -> None:
    if not os.path.exists(FONT):
        raise SystemExit(f"missing font: {FONT}")
    for name, size, threshold in VARIANTS:
        build(name, size, threshold)


if __name__ == "__main__":
    main()
