#!/usr/bin/env python3
"""
Office Buds - character sprite atlas builder.

Turns the high-resolution character sheets in art-source/characters/ into small
game-resolution atlases in public/assets/.

The source sheets are 640x640 frames laid out horizontally. Every sheet places the
character inside that 640 box the same way (feet on the bottom edge, body centred),
so we downscale each 640x640 frame straight to 40x40 (an exact 1/16) WITHOUT
trimming. Keeping the original box is what stops the sprite from jittering when it
switches between animations - every frame shares one anchor: feet at y=39, centre
at x=20.

Downscale recipe (chosen by eyeballing A/B tests, see README):
  premultiply alpha -> LANCZOS to 40x40 -> unpremultiply -> hard alpha cutoff
  -> light unsharp mask.
The alpha cutoff keeps edges crisp for nearest-neighbour upscaling in game; the
unsharp pass puts back the hair/beard/glasses definition that a 16x reduction eats.

Run:  python3 tools/build_sprites.py       (needs Pillow + numpy)
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "art-source", "characters")
OUT = os.path.join(ROOT, "public", "assets")

FRAME = 40          # game-resolution frame size, 640 / 16
COLS = 8            # frames per atlas row
ALPHA_CUTOFF = 96   # below this the source pixel is treated as fully transparent
SHARPEN = 60        # unsharp mask percent


@dataclass(frozen=True)
class Clip:
    """One animation, pulled out of a source sheet by frame index."""
    name: str
    sheet: str
    frames: tuple[int, ...]
    fps: float
    loop: bool = True


# Both characters were drawn with the same set of sheets, so they share a layout.
# The turn-around sheets start facing the camera and rotate away, so only the tail
# of those sheets is usable as a "walking away" cycle.
CHARACTERS: dict[str, dict] = {
    "colin": {
        "label": "COLIN",
        "clips": [
            Clip("idle_down", "Colin_idle_animation_sheet.png", tuple(range(8)), 7),
            Clip("walk_down", "Colin_Walk_Forward_sheet.png", tuple(range(8)), 11),
            Clip("walk_side", "Colin_walk_right_sheet.png", tuple(range(8)), 11),
            Clip("walk_up", "colin_turn_walk_away_sheet.png", (4, 5, 6, 7), 8),
            # No dedicated standing-still art for the side/back views, so we reuse the
            # steadiest frame of each walk cycle (feet closest together) and let the
            # renderer add a 1px breathing bob on top.
            Clip("idle_side", "Colin_walk_right_sheet.png", (7,), 2),
            Clip("idle_up", "colin_turn_walk_away_sheet.png", (4,), 2),
            Clip("wave", "Colin_wave_animation_sheet.png", tuple(range(8)), 9, loop=False),
        ],
    },
    "michael": {
        "label": "MICHAEL",
        "clips": [
            Clip("idle_down", "Michael_idle_animation_sheet.png", tuple(range(8)), 7),
            Clip("walk_down", "Michael_walk forward_animation_sheet.png", tuple(range(8)), 11),
            Clip("walk_side", "michael_walk_right_sheet.png", tuple(range(8)), 11),
            Clip("walk_up", "Michael_turning around_animation_sheet.png", (4, 5, 6, 7), 8),
            Clip("idle_side", "michael_walk_right_sheet.png", (3,), 2),
            Clip("idle_up", "Michael_turning around_animation_sheet.png", (7,), 2),
            Clip("wave", "Michael_wave_animation_sheet.png", tuple(range(8)), 9, loop=False),
        ],
    },
}


def load_sheet(name: str) -> list[Image.Image]:
    im = Image.open(os.path.join(SRC, name)).convert("RGBA")
    w, h = im.size
    if w % h != 0:
        raise SystemExit(f"{name}: width {w} is not a whole number of {h}px frames")
    return [im.crop((i * h, 0, (i + 1) * h, h)) for i in range(w // h)]


def downscale(frame: Image.Image) -> Image.Image:
    """640x640 (or whatever square) -> FRAME x FRAME, crisp."""
    arr = np.array(frame).astype(np.float32)
    alpha = arr[:, :, 3:4] / 255.0
    arr[:, :, :3] *= alpha  # premultiply so transparent pixels don't bleed a halo
    small = Image.fromarray(arr.astype(np.uint8)).resize((FRAME, FRAME), Image.LANCZOS)

    s = np.array(small).astype(np.float32)
    a = s[:, :, 3:4] / 255.0
    s[:, :, :3] = np.where(a > 0.002, s[:, :, :3] / np.maximum(a, 0.002), 0)
    s[:, :, 3] = np.where(s[:, :, 3] > ALPHA_CUTOFF, 255, 0)
    out = Image.fromarray(np.clip(s, 0, 255).astype(np.uint8))

    rgb = out.convert("RGB").filter(
        ImageFilter.UnsharpMask(radius=1, percent=SHARPEN, threshold=0)
    )
    return Image.merge("RGBA", (*rgb.split(), out.split()[3]))


def content_box(frames: list[Image.Image]) -> dict:
    """Union of every frame's opaque pixels - the renderer uses this for shadows."""
    x0, y0, x1, y1 = FRAME, FRAME, 0, 0
    for f in frames:
        a = np.array(f)[:, :, 3]
        ys, xs = np.where(a > 0)
        if not len(ys):
            continue
        x0, y0 = min(x0, int(xs.min())), min(y0, int(ys.min()))
        x1, y1 = max(x1, int(xs.max())), max(y1, int(ys.max()))
    return {"x": x0, "y": y0, "w": x1 - x0 + 1, "h": y1 - y0 + 1}


def build_character(key: str, spec: dict) -> dict:
    sheets: dict[str, list[Image.Image]] = {}
    tiles: list[Image.Image] = []
    clips_meta: dict[str, dict] = {}

    for clip in spec["clips"]:
        if clip.sheet not in sheets:
            sheets[clip.sheet] = load_sheet(clip.sheet)
        src = sheets[clip.sheet]
        start = len(tiles)
        for idx in clip.frames:
            if idx >= len(src):
                raise SystemExit(f"{clip.sheet}: no frame {idx} (has {len(src)})")
            tiles.append(downscale(src[idx]))
        clips_meta[clip.name] = {
            "start": start,
            "count": len(clip.frames),
            "fps": clip.fps,
            "loop": clip.loop,
        }

    rows = (len(tiles) + COLS - 1) // COLS
    atlas = Image.new("RGBA", (COLS * FRAME, rows * FRAME), (0, 0, 0, 0))
    for i, t in enumerate(tiles):
        r, c = divmod(i, COLS)
        atlas.paste(t, (c * FRAME, r * FRAME))

    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f"{key}.png")
    atlas.save(path, optimize=True)

    return {
        "label": spec["label"],
        "image": f"/assets/{key}.png",
        "frame": FRAME,
        "cols": COLS,
        "total": len(tiles),
        "box": content_box(tiles),
        "clips": clips_meta,
    }


def main() -> None:
    manifest = {"frame": FRAME, "characters": {}}
    for key, spec in CHARACTERS.items():
        meta = build_character(key, spec)
        manifest["characters"][key] = meta
        size = os.path.getsize(os.path.join(OUT, f"{key}.png"))
        print(f"{key:9s} {meta['total']:3d} frames  box={meta['box']}  {size/1024:.1f} KB")

    with open(os.path.join(OUT, "characters.json"), "w") as fh:
        json.dump(manifest, fh, indent=2)
    print("wrote public/assets/characters.json")


if __name__ == "__main__":
    main()
