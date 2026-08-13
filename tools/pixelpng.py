"""
Shared PNG writer for the art pipeline.

Sprite atlases produced here have hard alpha - every pixel is fully opaque or fully
transparent - which means they can be stored as an indexed PNG with one transparent
palette entry instead of 32-bit RGBA. For pixel art that is roughly a 70% saving with
no visible change, and the atlases are what a phone waits on before the office appears.

Only use this for images whose alpha is already binary. `save_indexed` refuses anything
with partial transparency rather than silently hardening someone's anti-aliased edges.
"""

from __future__ import annotations

import numpy as np
from PIL import Image

TRANSPARENT_INDEX = 255


class TooManyColoursError(ValueError):
    """The image will not survive a 256-colour palette without visible banding."""


class PartialAlphaError(ValueError):
    pass


def save_indexed(im: Image.Image, path: str) -> None:
    """Write an RGBA image with binary alpha as an indexed PNG."""
    im = im.convert("RGBA")
    alpha = np.array(im.getchannel("A"))
    partial = int(((alpha > 0) & (alpha < 255)).sum())
    if partial:
        raise PartialAlphaError(
            f"{path}: {partial} partially transparent pixels; refusing to flatten them"
        )

    # 255 colours, leaving the last palette slot for transparency.
    quantized = im.convert("RGB").quantize(colors=TRANSPARENT_INDEX, method=Image.MEDIANCUT, dither=Image.NONE)

    px = quantized.load()
    for y in range(quantized.size[1]):
        for x in range(quantized.size[0]):
            if alpha[y, x] == 0:
                px[x, y] = TRANSPARENT_INDEX

    # The palette must be padded out to a full 256 entries. Pillow returns only as many
    # entries as the image actually needed, so an image with few colours - the two-colour
    # font atlas, say - would otherwise leave index 255 undefined and every glyph would
    # render as a solid block.
    palette = list(quantized.getpalette() or [])[: TRANSPARENT_INDEX * 3]
    palette += [0, 0, 0] * (TRANSPARENT_INDEX - len(palette) // 3)
    palette += [0, 0, 0]
    quantized.putpalette(palette)
    quantized.save(path, optimize=True, transparency=TRANSPARENT_INDEX)

    _verify(im, path)


def _verify(source: Image.Image, path: str) -> None:
    """
    Reload what we just wrote and confirm it still matches the source.

    Cheap insurance: a palette that silently loses its transparent index turns every
    glyph into a solid block, and that is far easier to catch here than in a screenshot.
    """
    written = Image.open(path).convert("RGBA")
    if written.size != source.size:
        raise ValueError(f"{path}: size changed on write")
    a = np.array(source)
    b = np.array(written)
    if not np.array_equal(a[:, :, 3] > 0, b[:, :, 3] > 0):
        raise ValueError(f"{path}: transparency changed on write")
    opaque = a[:, :, 3] > 0
    if opaque.any():
        delta = int(np.abs(a[opaque][:, :3].astype(int) - b[opaque][:, :3].astype(int)).max())
        if delta > 72:
            # Not a corrupt write - the image genuinely has more colours than a palette
            # holds, and quantising it damaged the art. The caller decides whether to
            # drop back to RGBA rather than ship banding.
            raise TooManyColoursError(f"{path}: colour shifted by {delta} on write")
