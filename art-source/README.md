# Source art

This is the input side of the art pipeline. Nothing here is loaded by the game — the
builders in `tools/` chew through it and emit the atlases in `public/assets/`, and those
are what ship.

```
art-source/characters/    the cast, ours
art-source/village/       outdoor props, ours
art-source/modern-office/    LimeZu's Modern Office - Revamped      (NOT in the repo)
art-source/modern-interiors/ LimeZu's Modern Interiors, doors only  (NOT in the repo)
```

## The packs that are not here

Both LimeZu packs are gitignored, and deliberately. Their licences permit using the art
in a commercial or non-commercial project and forbid redistributing it — and a public
repository with a pack's own PNGs sitting in a browsable folder is redistribution,
whatever we meant by it. Building the game from a pack is the licensed use; re-hosting
it is not.

The generated `public/assets/props.png` is fine and is committed: it is a derived work
that ships inside the game, which is exactly what the licence is for.

So the atlases are committed and you never need this folder unless you are changing the
office art. When you are:

1. Buy/download **Modern Office - Revamped** from LimeZu (limezu.itch.io).
2. Unpack it so the layout matches what `tools/build_office.py` expects:
   ```
   art-source/modern-office/
     Room_Builder_Office_16x16.png
     singles/Modern_Office_Singles_1.png ... _339.png
   ```
3. Download **Modern Interiors** from the same place, and copy just the two door
   sheets out of `RPG_MAKER_MV/Animated_Objects/`:
   ```
   art-source/modern-interiors/
     Doors1.png          (was !$Doors1.png)
     Doors_special.png   (was !$Doors_bathroom_emergency_exit_cold_room.png)
   ```
   Modern Office has no door in it, which is why doors come from the other pack. They
   are RPG Maker MV exports at 3x, and `build_office.py` takes every third pixel to get
   back to the original 16px art exactly.
4. `npm run assets`

The builder fails loudly with the path it wanted if anything is missing, rather than
quietly emitting an atlas full of holes.

## Ours

`characters/` and `village/` are the project's own art and are committed, because losing
them would mean redrawing the cast. They are big (a character is ~8 MB of high-resolution
sheets) and they are the reason a fresh clone is not small. That is a deliberate trade:
the atlases can always be rebuilt from the sheets, and the sheets cannot be rebuilt from
anything.

Adding a character is three steps — drop the sheets in `characters/`, add a `Character(...)`
entry in `tools/build_sprites.py`, add a line to `src/game/cast.ts` — and is written up
properly in the root README.
