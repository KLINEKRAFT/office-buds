#!/usr/bin/env python3
"""
Office Buds - prop atlas + environment tile builder.

Two jobs:

1. Pack every furniture PNG from art-source/furniture/ into one atlas so the game
   makes a single request. Each sprite is trimmed to its opaque pixels and the
   manifest records the trimmed size, so rooms can place props by bottom-centre
   anchor without caring about the original 16/32px padding.

2. Draw the handful of environment tiles the furniture pack does not include -
   carpet, wall, baseboard, window, door. These are authored here rather than
   imported because there is no floor/wall art in the pack; the palette is sampled
   from the furniture so everything sits together.

Run:  python3 tools/build_props.py       (needs Pillow + numpy)
"""

from __future__ import annotations

import json
import os
import random

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "art-source", "furniture")
OUT = os.path.join(ROOT, "public", "assets")

# Sampled from the furniture pack so authored tiles match imported art.
PAL = {
    "carpet_a": (58, 61, 82),
    "carpet_b": (54, 57, 77),
    "carpet_seam": (48, 51, 70),
    "carpet_fleck": (64, 68, 90),
    "wall": (95, 103, 130),
    "wall_hi": (116, 138, 166),
    "wall_lo": (74, 78, 104),
    "wall_top": (52, 52, 69),
    "base": (52, 56, 78),
    "base_hi": (95, 99, 125),
    "trim": (34, 34, 45),
    "glass_hi": (154, 170, 174),
    "glass": (116, 138, 166),
    "glass_lo": (86, 106, 140),
    "sky": (194, 207, 203),
    "wood": (192, 144, 104),
    "wood_lo": (130, 89, 56),
    "metal": (152, 163, 188),
    "cream": (234, 230, 218),
}

# The furniture pack has no floor art, so the tileset atlas is skipped - it is just
# a packed copy of the individual sprites we already read.
SKIP = {"0-Tileset.png"}

TILE = 16
rng = random.Random(0xB0DE)


def solid(w: int, h: int, c) -> Image.Image:
    return Image.new("RGBA", (w, h), (*c, 255))


def carpet(variant: int, base, fleck, seam) -> Image.Image:
    """16x16 carpet tile: flat base, a few flecks, darker seam on two edges."""
    im = solid(TILE, TILE, base)
    px = im.load()
    r = random.Random(1000 + variant)
    for _ in range(14):
        x, y = r.randrange(TILE), r.randrange(TILE)
        px[x, y] = (*fleck, 255)
    for _ in range(8):
        x, y = r.randrange(TILE), r.randrange(TILE)
        px[x, y] = (*seam, 255)
    for x in range(TILE):  # seam along top + left so tiles read as laid squares
        px[x, 0] = (*seam, 255)
    for y in range(TILE):
        px[0, y] = (*seam, 255)
    return im


def wall_tile() -> Image.Image:
    """16x16 of flat upper wall with a faint vertical streak."""
    im = solid(TILE, TILE, PAL["wall"])
    px = im.load()
    r = random.Random(7)
    for _ in range(5):
        x = r.randrange(TILE)
        for y in range(TILE):
            if r.random() < 0.5:
                px[x, y] = (*PAL["wall_lo"], 255)
    return im


def wall_cap() -> Image.Image:
    """16x6 dark cornice that caps the top of the wall band."""
    im = solid(TILE, 6, PAL["wall_top"])
    d = ImageDraw.Draw(im)
    d.rectangle([0, 5, TILE - 1, 5], fill=PAL["wall_lo"])
    return im


def baseboard() -> Image.Image:
    """16x6 skirting board where the wall meets the carpet."""
    im = solid(TILE, 6, PAL["base"])
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, TILE - 1, 0], fill=PAL["base_hi"])
    d.rectangle([0, 5, TILE - 1, 5], fill=PAL["trim"])
    return im


# Hand-authored pixel art. One character per pixel, keys index PAL.
# t=trim  m=metal  g=glass  G=glass_hi  l=glass_lo  s=sky  .=transparent
WINDOW_ART = """
tttttttttttttttttttttttttttttttt
tmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmt
tmssssssssssssmmssssssssssssssmt
tmsGGGGGGGGGGsmmsGGGGGGGGGGGGsmt
tmsGgggggggggsmmsGggggggggggGsmt
tmsGgggggggggsmmsGggggggggggGsmt
tmsGgglllggggsmmsGgggglllgggGsmt
tmsGggllllgggsmmsGggglllllggGsmt
tmsGgggllggggsmmsGggggllllggGsmt
tmsGgggggggggsmmsGggggggggggGsmt
tmsGgggggggggsmmsGggggggggggGsmt
tmsGgggggggggsmmsGggggggggggGsmt
tmsllllllllllsmmsllllllllllllsmt
tmssssssssssssmmssssssssssssssmt
tmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmt
tttttttttttttttttttttttttttttttt
"""

# w=wood  W=wood_lo  c=cream
DOOR_ART = """
ttttttttttttttttttt
tWWWWWWWWWWWWWWWWWt
tWwwwwwwwwwwwwwwwWt
tWwGGGGGGGGGGGGGwWt
tWwGgggggggggggGwWt
tWwGgggggggggggGwWt
tWwGgggggggggggGwWt
tWwGgggggggggggGwWt
tWwGGGGGGGGGGGGGwWt
tWwwwwwwwwwwwwwwwWt
tWwwwwwwwwwwwwwwwWt
tWwwwwwwwwwwwwwwwWt
tWwwwwwwwwwwwwwwwWt
tWwwwwwwwwwwwwwwwWt
tWwwwwwwww.cwwwwwWt
tWwwwwwwww.cwwwwwWt
tWwwwwwwwwwwwwwwwWt
tWwwwwwwwwwwwwwwwWt
tWwwwwwwwwwwwwwwwWt
tWwwwwwwwwwwwwwwwWt
tWWWWWWWWWWWWWWWWWt
ttttttttttttttttttt
"""

CHARS = {
    "t": PAL["trim"], "m": PAL["metal"], "g": PAL["glass"], "G": PAL["glass_hi"],
    "l": PAL["glass_lo"], "s": PAL["sky"], "w": PAL["wood"], "W": PAL["wood_lo"],
    "c": PAL["cream"],
}


def from_art(art: str) -> Image.Image:
    rows = [r for r in art.strip("\n").split("\n") if r]
    w, h = len(rows[0]), len(rows)
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = im.load()
    for y, row in enumerate(rows):
        if len(row) != w:
            raise SystemExit(f"art row {y} is {len(row)} wide, expected {w}")
        for x, ch in enumerate(row):
            if ch == ".":
                continue
            px[x, y] = (*CHARS[ch], 255)
    return im


def partition(width: int) -> Image.Image:
    """
    Cubicle divider, drawn front-on to match the furniture pack.

    The pack has no partitions, and without them the floor plan reads as furniture
    scattered on an empty field. These are what turn it into an office with corridors.
    """
    h = 24
    im = Image.new("RGBA", (width, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    panel = PAL["wall_lo"]
    d.rectangle([0, 2, width - 1, h - 3], fill=panel)
    # Light fabric speckle. Kept sparse - at this size heavy noise reads as dirt.
    px = im.load()
    r = random.Random(width * 31)
    for _ in range(int(width * 1.1)):
        x, y = r.randrange(width), r.randrange(3, h - 4)
        px[x, y] = (*PAL["wall"], 255)
    # Top rail, side posts and a contact shadow along the floor.
    d.rectangle([0, 0, width - 1, 1], fill=PAL["wall_hi"])
    d.rectangle([0, 2, 0, h - 3], fill=PAL["trim"])
    d.rectangle([width - 1, 2, width - 1, h - 3], fill=PAL["trim"])
    d.rectangle([0, h - 2, width - 1, h - 2], fill=PAL["base"])
    d.rectangle([0, h - 1, width - 1, h - 1], fill=PAL["trim"])
    return im


def generated() -> dict[str, Image.Image]:
    """
    Environment tiles the furniture pack does not ship.

    There are two carpet sets. The cool slate one is the main floor; the warm one is
    laid in the break area and lounge. Zoning the floor with real tiles reads far
    better than dropping rug sprites on top - a rug's hard rectangular edge fights the
    hand-drawn furniture, whereas swapping tiles looks like carpet that was simply
    laid differently in that part of the office.
    """
    cool = (PAL["carpet_a"], PAL["carpet_b"])
    warm_a, warm_b = (70, 60, 74), (66, 56, 70)
    warm_fleck, warm_seam = (84, 72, 88), (58, 48, 62)
    return {
        "floor_a": carpet(0, cool[0], PAL["carpet_fleck"], PAL["carpet_seam"]),
        "floor_b": carpet(1, cool[1], PAL["carpet_fleck"], PAL["carpet_seam"]),
        "floor_warm_a": carpet(2, warm_a, warm_fleck, warm_seam),
        "floor_warm_b": carpet(3, warm_b, warm_fleck, warm_seam),
        "wall": wall_tile(),
        "wall_cap": wall_cap(),
        "baseboard": baseboard(),
        "window": from_art(WINDOW_ART),
        "door": from_art(DOOR_ART),
        "partition": partition(32),
        "partition_wide": partition(48),
    }


def trim(im: Image.Image) -> Image.Image:
    a = np.array(im)[:, :, 3]
    ys, xs = np.where(a > 0)
    if not len(ys):
        return im
    return im.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))


def main() -> None:
    sprites: dict[str, Image.Image] = {}

    for fn in sorted(os.listdir(SRC)):
        if not fn.endswith(".png") or fn in SKIP:
            continue
        key = fn[:-4].lower().replace("-", "_").replace(" ", "_")
        sprites[key] = trim(Image.open(os.path.join(SRC, fn)).convert("RGBA"))

    for key, im in generated().items():
        sprites[key] = im

    # Shelf packer: sort tall-first, fill rows. Plenty for ~50 small sprites.
    W = 256
    PAD = 1
    placed: dict[str, tuple[int, int, int, int]] = {}
    x = y = row_h = 0
    for key in sorted(sprites, key=lambda k: -sprites[k].size[1]):
        im = sprites[key]
        w, h = im.size
        if x + w > W:
            x, y, row_h = 0, y + row_h + PAD, 0
        placed[key] = (x, y, w, h)
        x += w + PAD
        row_h = max(row_h, h)
    H = y + row_h

    atlas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for key, (px, py, _, _) in placed.items():
        atlas.paste(sprites[key], (px, py))
    os.makedirs(OUT, exist_ok=True)
    atlas.save(os.path.join(OUT, "props.png"), optimize=True)

    manifest = {
        "image": "/assets/props.png",
        "size": [W, H],
        "sprites": {k: {"x": v[0], "y": v[1], "w": v[2], "h": v[3]} for k, v in sorted(placed.items())},
    }
    with open(os.path.join(OUT, "props.json"), "w") as fh:
        json.dump(manifest, fh, indent=2)

    kb = os.path.getsize(os.path.join(OUT, "props.png")) / 1024
    print(f"packed {len(placed)} sprites into {W}x{H} props.png ({kb:.1f} KB)")


if __name__ == "__main__":
    main()
