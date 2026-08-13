#!/usr/bin/env python3
"""
Office Buds - village atlas builder.

Turns the outdoor art in art-source/village/ into a game-resolution atlas, the same
way build_sprites.py handles the characters. The source is smooth high-colour
illustration (the grass alone has ~12,700 colours), so it goes through the same
downscale that made the character sheets read as pixel art: premultiply, LANCZOS,
hard alpha cutoff, light unsharp.

Two things needed deciding:

TONE. Straight out of the pack this art is far more saturated than the office, which
made the two places look like different games rather than one game with two rooms.
Pulling saturation to 0.68 and brightness to 0.90 lands it in the office's family
while staying obviously greener and more alive - stepping outside should feel like a
change, just not like a different product.

TILING. Only the water tile actually tiles seamlessly; the grass, cobblestone and
path pieces are standalone illustrations. Downscaling one grass image to a 16px tile
and repeating it gave a very visible pattern, so ground tiles are cut as many
different crops of the source instead, and the room builder picks between them per
tile. The road pieces are used at their authored size as one-off overlays rather than
being forced to repeat.

Run:  python3 tools/build_village.py       (needs Pillow + numpy)
"""

from __future__ import annotations

import json
import os

import random

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

from pixelpng import PartialAlphaError, save_indexed

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "art-source", "village")
OUT = os.path.join(ROOT, "public", "assets")

TILE = 16
ALPHA_CUTOFF = 110
SHARPEN = 60
TONE_SAT = 0.68
TONE_VAL = 0.90

# Prop key -> (source file, target height in world px).
# Heights are set against the 40px character: a person is ~1.75m, so an oak tree at
# 72px reads as roughly 3m, a cottage at 88px as ~3.8m, a barrel at 20px as waist high.
PROPS: dict[str, tuple[str, int]] = {
    "oak_tree":     ("Oak_Tree.png", 72),
    "cottage":      ("Stone Cottage.png", 88),
    "market_stall": ("Market_Stall.png", 56),
    "lamp_post":    ("Lamp_Post.png", 66),
    "well":         ("Well.png", 30),
    "bush":         ("Bush.png", 24),
    "boulder":      ("Boulder.png", 24),
    "barrel":       ("Barrel.png", 20),
    "mushroom":     ("Mushroom.png", 26),
    "chest_closed": ("Chest_Closed.png", 16),
    "chest_open":   ("Chest_Open.png", 18),
    "gold_pile":    ("Gold_Pile.png", 12),
    "crystal_orb":  ("Crystal_Orb.png", 16),
    "sword":        ("Sword.png", 34),
    "shield":       ("Shield.png", 16),
    "staff":        ("Staff.png", 28),
    "rogue":        ("Rogue.png", 40),
    "wraith":       ("Wraith.png", 38),
}

# Ground cut as N crops of one source, so repeating it does not show a pattern.
# Only grass survives this treatment: the pack's Cobblestone is a decorative patch with
# transparent edges rather than a texture, and its "Water Tile" is a chevron rune that
# tiles into obvious wallpaper. Both are authored below from colours sampled out of
# those same files instead, the way the office carpet is.
GROUND: dict[str, tuple[str, int]] = {
    "grass": ("Grass Floor.png", 16),
}

# Sampled from Dirt_Path.png, Cobblestone.png and Water Tile.png, then toned to match.
DIRT = (92, 68, 48)
DIRT_LIGHT = (112, 84, 58)
DIRT_DARK = (68, 48, 34)
STONE = (100, 100, 86)
STONE_DARK = (62, 54, 44)
WATER = (40, 96, 150)
WATER_DARK = (32, 78, 124)
WATER_LIGHT = (86, 152, 182)

# Road pieces kept at authored proportions and placed individually.
ROADS: dict[str, tuple[str, int]] = {
    "path_straight": ("Dirt_Path.png", 48),
    "path_corner":   ("Corner.png", 48),
    "path_cross":    ("Intersection.png", 48),
}


def tone(rgb: Image.Image) -> Image.Image:
    rgb = ImageEnhance.Color(rgb).enhance(TONE_SAT)
    return ImageEnhance.Brightness(rgb).enhance(TONE_VAL)


def crisp(im: Image.Image, height: int) -> Image.Image:
    """Smooth high-res source -> crisp game-resolution sprite of the given height."""
    im = im.convert("RGBA")
    w, h = im.size
    width = max(1, round(w * height / h))

    arr = np.array(im).astype(np.float32)
    alpha = arr[:, :, 3:4] / 255.0
    arr[:, :, :3] *= alpha
    small = Image.fromarray(arr.astype(np.uint8)).resize((width, height), Image.LANCZOS)

    s = np.array(small).astype(np.float32)
    a = s[:, :, 3:4] / 255.0
    s[:, :, :3] = np.where(a > 0.002, s[:, :, :3] / np.maximum(a, 0.002), 0)
    s[:, :, 3] = np.where(s[:, :, 3] > ALPHA_CUTOFF, 255, 0)
    out = Image.fromarray(np.clip(s, 0, 255).astype(np.uint8))

    rgb = tone(out.convert("RGB").filter(ImageFilter.UnsharpMask(radius=1, percent=SHARPEN, threshold=0)))
    return Image.merge("RGBA", (*rgb.split(), out.split()[3]))


def trim(im: Image.Image) -> Image.Image:
    a = np.array(im)[:, :, 3]
    ys, xs = np.where(a > 0)
    if not len(ys):
        return im
    return im.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))


def ground_variants(path: str, count: int) -> list[Image.Image]:
    """Cut `count` different square crops and reduce each to one opaque TILE tile."""
    src = Image.open(path).convert("RGBA")
    w, h = src.size
    # Crop window a bit larger than a tile's worth of source, stepped across the image.
    win = max(TILE, min(w, h) // 3)
    positions: list[tuple[int, int]] = []
    steps = int(np.ceil(np.sqrt(count)))
    for iy in range(steps):
        for ix in range(steps):
            if len(positions) >= count:
                break
            x = int(ix * (w - win) / max(1, steps - 1))
            y = int(iy * (h - win) / max(1, steps - 1))
            positions.append((x, y))

    tiles = []
    for x, y in positions[:count]:
        crop = src.crop((x, y, x + win, y + win))
        t = crisp(crop, TILE)

        arr = np.array(t).astype(float)
        # Reducing one grass image to 16px keeps every blade as per-pixel noise, and a
        # field of that reads as static - the characters disappear into it. Pulling each
        # pixel most of the way to the tile's mean and then quantising leaves flat pixel
        # ground with a little texture, which is what the office carpet does too.
        rgb = arr[:, :, :3]
        arr[:, :, :3] = np.round((rgb * 0.35 + rgb.mean(axis=(0, 1)) * 0.65) / 16) * 16
        # Ground must be fully opaque or the room shows through between tiles.
        arr[:, :, 3] = 255
        tiles.append(Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)))
    return tiles


def path_tile(seed: int) -> Image.Image:
    """
    Dirt path with a few cobbles pressed into it.

    Authored rather than sampled because the pack's cobblestone is a patch with
    transparent edges, so crops of it came out as stripes and holes. Features are kept
    fully inside the tile, which is what makes any two tiles butt together seamlessly.
    """
    im = Image.new("RGBA", (TILE, TILE), (*DIRT, 255))
    d = ImageDraw.Draw(im)
    r = random.Random(seed)
    for _ in range(6):
        x, y = r.randrange(TILE - 2), r.randrange(TILE - 2)
        d.rectangle([x, y, x + r.randint(1, 2), y + 1], fill=DIRT_LIGHT)
    for _ in range(3):
        x, y = r.randrange(1, TILE - 4), r.randrange(1, TILE - 3)
        w, h = r.randint(2, 3), 2
        d.rectangle([x, y, x + w, y + h], fill=STONE_DARK)
        d.rectangle([x, y, x + w - 1, y + h - 1], fill=STONE)
    for _ in range(5):
        d.point((r.randrange(TILE), r.randrange(TILE)), fill=DIRT_DARK)
    return im


def water_tile(seed: int) -> Image.Image:
    """Flat pond water with a couple of short ripple dashes, kept inside the tile."""
    im = Image.new("RGBA", (TILE, TILE), (*WATER, 255))
    d = ImageDraw.Draw(im)
    r = random.Random(seed)
    for _ in range(4):
        x, y = r.randrange(TILE - 3), r.randrange(TILE)
        d.rectangle([x, y, x + r.randint(1, 3), y], fill=WATER_DARK)
    for _ in range(2):
        x, y = r.randrange(1, TILE - 4), r.randrange(TILE)
        d.rectangle([x, y, x + r.randint(2, 3), y], fill=WATER_LIGHT)
    return im


def ritual_circle() -> Image.Image:
    """
    The chalk ring the ceremony happens inside.

    Drawn as an ELLIPSE rather than a circle: the game looks down on the ground at an
    angle, so a true circle painted on the floor reads as a hoop standing upright. The
    2:1.5 squash is what makes it lie flat.

    Authored rather than imported because nothing in the pack is a ground marking, and a
    ring is a handful of ellipse calls - far less work than making an imported patch tile
    against grass.
    """
    w, h = 104, 74
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    chalk = (214, 206, 186, 210)
    chalk_dim = (176, 166, 148, 150)
    inner = (198, 188, 168, 120)

    d.ellipse([1, 1, w - 2, h - 2], outline=chalk, width=2)
    d.ellipse([9, 7, w - 10, h - 8], outline=chalk_dim, width=1)

    # Points of the compass, marked with short spokes between the two rings.
    import math

    cx, cy = (w - 1) / 2, (h - 1) / 2
    for i in range(8):
        a = (i / 8) * math.tau
        x0, y0 = cx + math.cos(a) * (w / 2 - 9), cy + math.sin(a) * (h / 2 - 8)
        x1, y1 = cx + math.cos(a) * (w / 2 - 3), cy + math.sin(a) * (h / 2 - 3)
        d.line([x0, y0, x1, y1], fill=chalk_dim, width=1)

    # A faint star across the middle, kept thin so it never fights the characters
    # standing on top of it.
    for i in range(5):
        a0 = (i / 5) * math.tau - math.tau / 4
        a1 = ((i + 2) / 5) * math.tau - math.tau / 4
        d.line(
            [
                cx + math.cos(a0) * (w / 2 - 11),
                cy + math.sin(a0) * (h / 2 - 10),
                cx + math.cos(a1) * (w / 2 - 11),
                cy + math.sin(a1) * (h / 2 - 10),
            ],
            fill=inner,
            width=1,
        )
    return im


def main() -> None:
    sprites: dict[str, Image.Image] = {}
    sprites["ritual_circle"] = ritual_circle()

    for key, (fname, height) in PROPS.items():
        sprites[key] = trim(crisp(Image.open(os.path.join(SRC, fname)), height))

    for key, (fname, height) in ROADS.items():
        sprites[key] = crisp(Image.open(os.path.join(SRC, fname)), height)

    ground_keys: dict[str, list[str]] = {}

    # Authored ground: guaranteed to tile, and in the pack's own colours.
    for key, maker, count in (("path", path_tile, 4), ("water", water_tile, 4)):
        names = []
        for i in range(count):
            name = f"{key}_{i}"
            sprites[name] = maker(1000 + i)
            names.append(name)
        ground_keys[key] = names

    for key, (fname, count) in GROUND.items():
        variants = ground_variants(os.path.join(SRC, fname), count)
        names = []
        for i, t in enumerate(variants):
            name = f"{key}_{i}"
            sprites[name] = t
            names.append(name)
        ground_keys[key] = names

    # Shelf packer, tall-first.
    W, PAD = 256, 1
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
    path = os.path.join(OUT, "village.png")
    try:
        save_indexed(atlas, path)
    except (PartialAlphaError, ValueError) as exc:
        # The outdoor art is genuinely high-colour - the shaded foliage alone needs more
        # than the 255 entries an indexed PNG leaves room for, and save_indexed refuses
        # rather than quietly banding it. RGBA costs a few KB and keeps the art intact.
        atlas.save(path, optimize=True)
        print(f"  (stored RGBA: {exc})")

    with open(os.path.join(OUT, "village.json"), "w") as fh:
        json.dump(
            {
                "image": "/assets/village.png",
                "size": [W, H],
                "ground": ground_keys,
                "sprites": {k: {"x": v[0], "y": v[1], "w": v[2], "h": v[3]} for k, v in sorted(placed.items())},
            },
            fh,
            separators=(",", ":"),
        )

    kb = os.path.getsize(path) / 1024
    print(f"packed {len(placed)} village sprites into {W}x{H} village.png ({kb:.1f} KB)")
    for key, names in ground_keys.items():
        print(f"  {key}: {len(names)} ground variants")


if __name__ == "__main__":
    main()
