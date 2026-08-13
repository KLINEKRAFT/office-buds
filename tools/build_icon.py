#!/usr/bin/env python3
"""
Office Buds - the browser icon.

Cut from the game's own character atlas rather than drawn separately, so the tab icon
is literally somebody standing in the office. Anything hand-made here would drift out of
step with the art the moment a sheet was redrawn.

Written to app/icon.png, which is where the Next.js App Router looks for a favicon - no
<link> tag and no /favicon.ico round trip, which was 404ing on every cold load.

Run:  python3 tools/build_icon.py       (needs Pillow)
"""

from __future__ import annotations

import json
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "public", "assets")
OUT = os.path.join(ROOT, "app", "icon.png")

INK = (34, 34, 45, 255)
# The idle frame of whoever is first in the manifest. A favicon is 16px on screen, so
# the head has to fill most of it - hence cropping to the top of the sprite rather than
# shrinking the whole character into illegibility.
SCALE = 8
HEAD_H = 20


def main() -> None:
    manifest = json.load(open(os.path.join(ASSETS, "characters.json")))
    name, meta = next(iter(manifest["characters"].items()))
    frame = meta["frame"]
    sheet = Image.open(os.path.join(ROOT, "public", meta["image"].lstrip("/"))).convert("RGBA")

    idle = meta["clips"]["idle_down"]["start"]
    col, row_ = idle % meta["cols"], idle // meta["cols"]
    cell = sheet.crop((col * frame, row_ * frame, (col + 1) * frame, (row_ + 1) * frame))

    # Head and shoulders, squared up on the character's own horizontal box.
    box = meta["box"]
    cx = box["x"] + box["w"] / 2
    half = HEAD_H / 2
    head = cell.crop((round(cx - half), 0, round(cx + half), HEAD_H))

    icon = Image.new("RGBA", head.size, INK)
    icon.alpha_composite(head)
    icon = icon.resize((head.size[0] * SCALE, head.size[1] * SCALE), Image.NEAREST)
    icon.save(OUT)
    print(f"icon: {name} -> app/icon.png ({icon.size[0]}x{icon.size[1]})")


if __name__ == "__main__":
    main()
