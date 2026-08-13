#!/usr/bin/env python3
"""
Office Buds - the asset version stamp.

Every atlas is served from a fixed path: /assets/props.json, /assets/props.png, and so
on. That is fine until the art changes, at which point a browser holding a cached copy
of one of them pairs it with freshly deployed code - and the game dies on startup with
`room "office" references unknown sprite "wall_grey_side"`, which is a true statement
about a file that is correct on the server.

It happened. The fix is to make the URL change when the bytes change, so a stale copy is
never reachable rather than merely unlikely. This hashes everything in public/assets and
writes the digest into a TypeScript constant that loadAssets appends to every request.

`npm test` checks the stamp against the files, so rebuilding the art and forgetting to
re-stamp it fails the build instead of shipping a cache mismatch.

Run:  python3 tools/build_version.py
"""

from __future__ import annotations

import hashlib
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "public", "assets")
OUT = os.path.join(ROOT, "src", "game", "core", "assetVersion.ts")

TEMPLATE = '''/**
 * A digest of everything in public/assets, written by tools/build_version.py.
 *
 * Appended to every asset request so the URL changes whenever the art does. Without it
 * a browser can hold a cached atlas from an hour ago, pair it with code deployed a
 * minute ago, and fail to start on a sprite that exists perfectly well on the server.
 *
 * DO NOT EDIT. Run `npm run assets`.
 */
export const ASSET_VERSION = "{version}";
'''


def digest() -> str:
    h = hashlib.sha256()
    for name in sorted(os.listdir(ASSETS)):
        path = os.path.join(ASSETS, name)
        if not os.path.isfile(path):
            continue
        h.update(name.encode())
        with open(path, "rb") as fh:
            h.update(fh.read())
    return h.hexdigest()[:12]


def main() -> None:
    version = digest()
    with open(OUT, "w") as fh:
        fh.write(TEMPLATE.format(version=version))
    print(f"asset version: {version}")


if __name__ == "__main__":
    main()
