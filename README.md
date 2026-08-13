# Office Buds

A tiny retro office where two friends can hang out — and a village outside it, for
when the office gets old.

Open the game, type a name, pick a bud, and you get a link. Send the link to a friend and
you are both standing in the same little office — walking around, bumping into the copier,
and talking in speech bubbles over your heads. That is the whole game, and it is meant to
stay that way.

<!-- Built for phones first; works fine on a desktop browser too. -->

## Playing

- **Phone** — touch anywhere on the office and drag. A small joystick appears under your
  thumb, so it never sits on top of the artwork and works in either hand.
- **Desktop** — WASD or the arrow keys.
- **CHAT** opens the composer. What you send floats above your head for a few seconds
  (longer messages linger longer) and your friend sees it in real time.
- **WAVE** and, for Colin, **LAPTOP** — emote buttons only appear for animations that
  character actually has art for.
- **LOG** shows recent messages, so nothing is lost once a bubble fades.
- Walk into the office door to step outside on your own. Or say **"let's go outside"**
  and the whole room goes with you; say **"back to work"** out there to march everyone
  back in. The cottage is the way back in too.
- The office code in the top-left copies (or opens the share sheet for) the invite link.

## Running it

```bash
npm install
npm run dev            # http://localhost:3000
```

Without any environment variables the office still loads and is fully playable — two tabs
on the same machine will even find each other (see *Realtime* below). For real
invite-a-friend multiplayer, copy `.env.example` to `.env.local` and fill in a Supabase
project:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Deploying to Vercel needs the same two variables set in the project settings. There is
nothing else to configure — no database, no migrations, no auth.

If they are missing the game still runs, but on the same-browser driver, and the status
chip says **SAME DEVICE** rather than showing a plain player count. That distinction
exists so it is obvious at a glance whether an invite link will actually reach anyone.

## How it is put together

```
app/                    Next.js routes: title screen and /o/[code]
src/ui/                 React shell — entry screen, HUD, chat, settings
src/game/
  config.ts             every tuning knob in one file
  game.ts               owns the loop and ties the pieces together
  core/                 assets, bitmap font, input, camera, animation, audio
  world/                room format, the office, the village, collision, room builder
  render/               renderer, speech bubbles, name plates
  net/                  transport interface + Supabase and same-browser drivers
tools/                  Python art pipeline (run only when the source art changes)
art-source/             the original high-resolution character, furniture and village art
public/assets/          generated atlases, committed so the app needs no build step
```

### Rendering

Plain HTML5 canvas, no game framework. Phaser would have added roughly a megabyte for
features this game does not use; the whole engine here is a few hundred lines and boots
instantly, which matters more on a phone.

Every frame is drawn once at world resolution into a small offscreen canvas, then blitted
to the screen with a single whole-number scale. That is what keeps the pixels crisp: one
uniform grid, no per-sprite scaling, and one GPU blit per frame regardless of how much is
on screen. The static floor, walls and wall-mounted props are pre-rendered into the room
once at load, so a frame is one background blit plus the depth-sorted props and characters.

Display scale is chosen from the viewport so roughly 260 world pixels are visible
vertically — about 3x on a phone, which leaves the office comfortably larger than the
screen and lets the camera follow you around it.

### Characters

The source sheets are 640x640 frames. Every sheet places the character in that box the
same way — feet on the bottom edge, body centred — so each frame downscales straight to
40x40 (an exact 1/16) with no trimming. Keeping the original box is what stops the sprite
jittering when it switches animation: every frame shares one anchor.

40px was chosen by eye against the furniture. The desk-plus-monitor sprite is 28px for
what is about 120cm of real desk, which puts a person at ~41px. Smaller than that and the
glasses and beards turn to mush, which is most of the charm.

Each character atlas holds idle, walking (toward camera, away, and sideways — mirrored for
left), and a wave, in a 320x240 PNG of about 19 KB. The atlases have hard alpha by
construction, so they are written as indexed PNGs — roughly a third the size of RGBA with
no visible change. The furniture atlas keeps its original anti-aliased edges and is left
as RGBA.

### The room

Rooms are data (`src/game/world/office.ts`). A room lists props by bottom-centre anchor,
optional floor zones, spawn points, and interaction zones. Props are depth-sorted by their
anchor y each frame, which is what lets you walk in front of a desk and behind a cubicle
wall. Solid props get an automatic collider covering the bottom slice of their sprite —
front-elevation furniture is drawn much taller than the floor it occupies, so using the
whole sprite would feel like walking into invisible walls.

Adding a room means adding a file and registering it in `src/game/world/index.ts`; nothing
in the engine, renderer or netcode changes. That claim got tested by adding the village:
it is one 130-line data file. The `zones` array is still carried for the small
interactions (sit in a chair, stand at the copier, wish at the well) — nothing reads it yet.

A room declares which atlas its art comes from, so the office and the village keep
separate sprite sheets. Ground is a list of tile variants picked per tile by a hash,
which is what stops sixteen crops of grass falling into a visible repeat.

### Going places

Two ways to move between rooms, and they deliberately differ:

- **Walking into an exit** (the office door, the village cottage) moves *only you*. Your
  friend sees you leave and can follow.
- **Saying the words** — "let's go outside", "back to work" — moves *everyone*. A spoken
  invitation should take the group, since the whole point is being in the same place.

Which room a player is in rides along in their movement packet, and players elsewhere
simply are not drawn. The screen fades through black while the room is swapped, which
also covers the outdoor atlas still downloading on a slow connection.

A room's `spawns` serve two jobs: the first `joinSpawns` of them are where a fresh player
starts, and the rest are addressed by index from an exit or a spoken trigger. They are
kept apart on purpose — the arrival point sits right by a doorway, and a new player who
started there walked straight back out on their first input.

Laying out a room is easier with `?debug=1` (outlines every collider) and `?scale=N`
(pins the zoom, e.g. `?scale=2` to see a whole room at once).

### Realtime

One Supabase channel per office. No database and no auth:

- **presence** — who is here, with their name and character
- **broadcast `m`** — position, facing, animation state and room, 12/sec, lossy
- **broadcast `c`** — chat messages, reliable
- **broadcast `g`** — "everybody come outside", reliable

Position is sent only when something actually changed, plus a heartbeat once a second so
somebody joining late learns where everyone is standing. Remote players are drawn chasing
their last known position with exponential smoothing rather than snapping to each packet —
smooth beats accurate for two friends wandering around a room. Anyone who stops
heartbeating for 15 seconds is dropped, so a crashed tab does not leave a ghost behind.

`src/game/net/local.ts` is a second driver built on `BroadcastChannel`. It is used when no
Supabase project is configured, and can be forced with `?net=local`. Two tabs on one
machine then see each other, which makes the entire multiplayer path testable without a
network.

### Text

Canvas `fillText` is always antialiased, which looks like mush next to nearest-neighbour
sprites, so all in-world text is blitted from a bitmap atlas built at 1 bit. There are two
sizes: 9px for chat and speech bubbles, 7px for the deliberately understated name plates.
Both are under two kilobytes.

### Sound

Synthesised at runtime with WebAudio — footsteps, message blips, join and leave chimes, and
a very quiet HVAC hum. No audio files, nothing to download. Audio can only start from a
real tap, which is what the "Enter office" button is for. There is a mute toggle in
settings.

## The art pipeline

`public/assets/` is committed, so you only need this when the source art changes:

```bash
pip install pillow numpy
npm run assets
```

- `tools/build_sprites.py` — character sheets to 40x40 atlases
- `tools/build_props.py` — packs the furniture, and draws the floor, wall, partition,
  window and door tiles the furniture pack does not include
- `tools/build_village.py` — the outdoor atlas: props scaled against the 40px character,
  desaturated to sit beside the office, and grass cut as 16 crops so it does not repeat
- `tools/build_font.py` — rasterises the two bitmap fonts
- `tools/pixelpng.py` — shared indexed-PNG writer; refuses images with partial alpha and
  verifies what it wrote still matches the source

The office payload is about 62 KB. The village atlas is another ~69 KB and is fetched in
the background after the office is already playable, so it never delays first paint.

Two notes on the outdoor art, both learned the hard way:

- It is genuinely high-colour, so unlike the character atlases it cannot be stored as an
  indexed PNG. `save_indexed` refuses rather than banding it, and the builder falls back
  to RGBA.
- Only some of a tileset actually tiles. The pack's cobblestone turned out to be a
  decorative patch with transparent edges, and its "water tile" is a chevron rune that
  repeats into obvious wallpaper. Both are authored in `build_village.py` from colours
  sampled out of those same files. The grass is real, and is used.

## Credits

Characters, office furniture and village art are the project's own, in `art-source/`.
The bitmap fonts are rasterised from Liberation Sans Bold (SIL Open Font License 1.1).
