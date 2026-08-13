#!/usr/bin/env python3
"""
Office Buds - office atlas builder (LimeZu "Modern Office - Revamped").

Packs the pieces of the pack this office actually uses into one atlas, and writes the
same props.png / props.json the game already loads, so nothing downstream changes.

Two sources, both under art-source/modern-office/:

1. singles/       339 numbered sprites, each centred in a 32x48 box. They are trimmed to
                  their opaque pixels here, so rooms can place them by bottom-centre
                  anchor without caring about the padding.
2. Room_Builder   one 16x16-grid sheet. The left half is wallpaper - each style is a
                  32px band containing its own cap and skirting, so a wall band is one
                  16px-wide slice tiled sideways. The right half is floor tiles.

The pack itself is NOT in the repository - its licence allows using the art but not
redistributing it, so `art-source/modern-office/` is gitignored and the committed
`public/assets/props.png` (a derived work, which the licence is for) is what ships. You
only need the pack to change the office art; see art-source/README.md.

The pack is drawn from a higher angle than a person is - you see the top of a desk but
you look a character in the eye - so the two do not agree perfectly. It lands close
enough because the furniture keeps honest heights: a desk reaches a 40px character's hip
and a cabinet their chest, which is what the eye actually checks.

Run:  python3 tools/build_office.py       (needs Pillow + numpy)
"""

from __future__ import annotations

import json
import os

import random

import numpy as np
from PIL import Image, ImageDraw

from pixelpng import PartialAlphaError, save_indexed

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "art-source", "modern-office")
OUT = os.path.join(ROOT, "public", "assets")

TILE = 16

# name -> singles index. Only what the office uses; the pack has 339 and most of them
# are desk segments for building open-plan floors we do not have.
SINGLES: dict[str, int] = {
    # seating
    "chair_office": 112,
    "tub_chair_white": 196,
    "tub_chair_grey": 197,
    "tub_chair_pink": 198,
    "tub_chair_tan": 199,
    "chair_blue": 329,
    "chair_red": 331,
    # desks. The pack builds open-plan floors out of segments; these are the few pieces
    # that read as a whole desk on their own.
    "desk": 248,
    "desk_grey": 268,
    "desk_cream": 258,
    "workstation": 231,
    "side_table": 190,
    # storage
    "cabinet_tan": 211,
    "cabinet_white": 217,
    "cabinet_olive": 214,
    "cabinet_tall": 194,
    "locker_tan": 195,
    "shelf_mesh": 200,
    "shelf_mesh_tall": 201,
    "shelf_mesh_wide": 205,
    "locker_mesh": 202,
    "counter_white": 208,
    # desk clutter
    "monitor": 122,
    "monitor_blue": 130,
    "keyboard": 128,
    "papers": 135,
    "printer": 166,
    "printer_big": 168,
    "copier": 169,
    # wall-mounted, and the one board that stands on the floor
    "whiteboard": 170,
    "board_stand": 209,
    "photo_group": 164,
    "certificate": 114,
    "certificate_2": 115,
    "notice": 116,
    "picture": 163,
    # the corner everyone gathers in
    "coffee_station": 321,
    "water_cooler": 173,
    # green
    "plant_tall": 98,
    "plant_bushy": 99,
    "plant_small": 100,
}

# Wallpaper styles. Each is a 32px band on the room builder sheet, cap and skirting
# included, so one 16px slice tiles into a finished wall.
WALLS: dict[str, int] = {
    "wall_lavender": 80,
    "wall_grey": 112,
    "wall_brick": 144,
    "wall_white": 176,
}

# Floor tiles, by their top-left cell on the room builder grid. Two variants each so a
# floor never falls into a visible repeat.
FLOORS: dict[str, tuple[int, int]] = {
    "floor_grey_a": (10, 5),
    "floor_grey_b": (11, 6),
    "floor_wood_a": (13, 5),
    "floor_wood_b": (14, 6),
    "floor_dark_a": (10, 9),
    "floor_dark_b": (11, 10),
    "floor_olive_a": (13, 7),
    "floor_olive_b": (14, 8),
    "floor_red_a": (10, 11),
    "floor_red_b": (11, 12),
}


# The rug is the one warm thing in a room of slate and navy. Kept muted so it sits
# with the imported furniture instead of shouting over it.
RUG = {
    "base": (150, 114, 96),
    "fleck": (166, 130, 110),
    "seam": (132, 98, 84),
    "band": (192, 158, 130),
    "edge": (96, 70, 62),
}


def solid(w: int, h: int, c) -> Image.Image:
    return Image.new("RGBA", (w, h), (*c, 255))


def rug_tile(top: bool, left: bool, bottom: bool, right: bool, variant: int) -> Image.Image:
    """
    One 16x16 slice of a bordered rug. The flags say which sides face the outside, so
    the same routine draws all nine pieces of the set.

    Zoning the floor with carpet variants (see `carpet`) reads as carpet laid
    differently; that is right for a break area but wrong for a rug, which wants a real
    hem you can see the edge of. Hence a proper nine-slice rather than another tile pair.
    """
    im = solid(TILE, TILE, RUG["base"])
    px = im.load()
    r = random.Random(4000 + variant)
    for _ in range(18):
        px[r.randrange(TILE), r.randrange(TILE)] = (*RUG["fleck"], 255)
    for _ in range(10):
        px[r.randrange(TILE), r.randrange(TILE)] = (*RUG["seam"], 255)

    d = ImageDraw.Draw(im)
    last = TILE - 1

    # Order matters: weave, then the keyline, then the outer hem. Drawing the hem last
    # is what keeps the silhouette unbroken where two borders meet at a corner.
    if top:
        d.rectangle([0, 1, last, 2], fill=RUG["band"])
    if bottom:
        d.rectangle([0, last - 2, last, last - 1], fill=RUG["band"])
    if left:
        d.rectangle([1, 0, 2, last], fill=RUG["band"])
    if right:
        d.rectangle([last - 2, 0, last - 1, last], fill=RUG["band"])

    if top:
        d.rectangle([0, 3, last, 3], fill=RUG["edge"])
    if bottom:
        d.rectangle([0, last - 3, last, last - 3], fill=RUG["edge"])
    if left:
        d.rectangle([3, 0, 3, last], fill=RUG["edge"])
    if right:
        d.rectangle([last - 3, 0, last - 3, last], fill=RUG["edge"])

    if top:
        d.rectangle([0, 0, last, 0], fill=RUG["edge"])
    if bottom:
        d.rectangle([0, last, last, last], fill=RUG["edge"])
    if left:
        d.rectangle([0, 0, 0, last], fill=RUG["edge"])
    if right:
        d.rectangle([last, 0, last, last], fill=RUG["edge"])
    return im


def rug_set() -> dict[str, Image.Image]:
    """The nine slices, named `rug_<vertical><horizontal>` to match FloorZone.nine."""
    rows = [("t", True, False), ("m", False, False), ("b", False, True)]
    cols = [("l", True, False), ("c", False, False), ("r", False, True)]
    out: dict[str, Image.Image] = {}
    for i, (vk, top, bottom) in enumerate(rows):
        for j, (hk, left, right) in enumerate(cols):
            out[f"rug_{vk}{hk}"] = rug_tile(top, left, bottom, right, i * 3 + j)
    return out


def trim(im: Image.Image) -> Image.Image:
    a = np.array(im)[:, :, 3]
    ys, xs = np.where(a > 8)
    if not len(ys):
        raise SystemExit("empty sprite")
    return im.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))


# ---- doors (LimeZu "Modern Interiors") ---------------------------------------------
#
# Modern Office has no door in it - 339 sprites and not one of them - so the doors come
# from LimeZu's Modern Interiors instead. Same artist, same palette, same 16px grid, and
# a closed leaf measures 16x28 against a 32px wall, which is precisely the proportion a
# door should have. The two packs sit together without any coaxing.
#
# The files are RPG Maker MV exports, which means two things. They are a clean 3x
# upscale, so `[::3, ::3]` recovers the original pixels exactly rather than resampling
# them. And they are laid out as MV character cells: 3 columns by 4 rows of 48x144 - one
# column per door, one row per stage of it swinging open.
INTERIORS = os.path.join(ROOT, "art-source", "modern-interiors")

# file -> the three doors in its columns, left to right.
DOORS: dict[str, tuple[str, str, str]] = {
    "Doors1": ("door_red", "door_wood", "door_tan"),
    "Doors_special": ("door_wc", "door_exit", "door_cold"),
}

# Every frame is cut to the same box so the four of them share one anchor - otherwise
# the door jumps sideways as it opens. The leaf swings up and out in perspective, so the
# open frames are taller than the closed one and the box has to fit the tallest.
DOOR_CELL_W, DOOR_CELL_H = 16, 48
DOOR_TOP, DOOR_BOTTOM = 4, 47


def door_frames() -> dict[str, Image.Image]:
    """Every door, as `<name>_0` (shut) through `<name>_3` (wide open)."""
    out: dict[str, Image.Image] = {}
    for stem, names in DOORS.items():
        path = os.path.join(INTERIORS, f"{stem}.png")
        if not os.path.exists(path):
            raise SystemExit(
                f"door sheet not found: {path}\n"
                "Modern Interiors is gitignored for the same licence reason as Modern\n"
                "Office. See art-source/README.md."
            )
        sheet = Image.open(path).convert("RGBA")
        native = Image.fromarray(np.array(sheet)[::3, ::3])
        for col, name in enumerate(names):
            for row in range(4):
                box = (
                    col * DOOR_CELL_W,
                    row * DOOR_CELL_H + DOOR_TOP,
                    (col + 1) * DOOR_CELL_W,
                    row * DOOR_CELL_H + DOOR_BOTTOM,
                )
                out[f"{name}_{row}"] = native.crop(box)
    return out


def require_pack() -> None:
    """
    The pack is not in the repository - its licence forbids redistributing the art, and
    the generated atlas is what ships. So the common way to run this builder is without
    the input, and it should say so in one line rather than dying on a stray file.
    """
    if os.path.isdir(os.path.join(SRC, "singles")) and os.path.isdir(INTERIORS):
        return
    raise SystemExit(
        f"Art packs not found ({SRC}, {INTERIORS})\n"
        "\n"
        "It is gitignored on purpose: the licence allows using the art, not\n"
        "redistributing it, and public/assets/props.png is already built and committed.\n"
        "You only need the pack to change the office art. See art-source/README.md."
    )


def main() -> None:
    require_pack()
    sprites: dict[str, Image.Image] = {}

    for name, idx in SINGLES.items():
        path = os.path.join(SRC, "singles", f"Modern_Office_Singles_{idx}.png")
        if not os.path.exists(path):
            raise SystemExit(f"{name}: no singles sprite {idx}")
        sprites[name] = trim(Image.open(path).convert("RGBA"))

    sprites.update(rug_set())
    sprites.update(door_frames())

    rb = Image.open(os.path.join(SRC, "Room_Builder_Office_16x16.png")).convert("RGBA")
    # Column 1 rather than column 0: the first column of a wallpaper block carries the
    # block's own left end cap, which would repeat as a seam every 16px.
    for name, y in WALLS.items():
        sprites[name] = rb.crop((TILE, y, TILE * 2, y + 32))
    for name, (cx, cy) in FLOORS.items():
        sprites[name] = rb.crop((cx * TILE, cy * TILE, cx * TILE + TILE, cy * TILE + TILE))

    # ---- pack, tallest first so rows stay tight ----------------------------------
    order = sorted(sprites.items(), key=lambda kv: -kv[1].size[1])
    atlas_w = 256
    x = y = row_h = 0
    placed: dict[str, dict] = {}
    for name, im in order:
        w, h = im.size
        if x + w > atlas_w:
            x, y, row_h = 0, y + row_h + 1, 0
        placed[name] = {"x": x, "y": y, "w": w, "h": h}
        x += w + 1
        row_h = max(row_h, h)

    atlas = Image.new("RGBA", (atlas_w, y + row_h), (0, 0, 0, 0))
    for name, r in placed.items():
        atlas.paste(sprites[name], (r["x"], r["y"]))

    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, "props.png")
    # Indexed storage needs hard alpha, and this pack anti-aliases a few edges. Rather
    # than harden somebody else's art to save a few KB, try it and keep RGBA when the
    # writer objects - the same call the old furniture atlas made.
    try:
        save_indexed(atlas, path)
    except PartialAlphaError:
        atlas.save(path, optimize=True)
    with open(os.path.join(OUT, "props.json"), "w") as fh:
        json.dump({"image": "/assets/props.png", "size": list(atlas.size), "sprites": placed}, fh)

    kb = os.path.getsize(path) / 1024
    print(f"packed {len(placed)} sprites into {atlas.size[0]}x{atlas.size[1]} props.png ({kb:.1f} KB)")
    for name in sorted(placed):
        r = placed[name]
        print(f"  {name:20s} {r['w']:3d}x{r['h']:<3d}")


if __name__ == "__main__":
    main()
