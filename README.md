# Office Buds

A tiny retro office where two friends can hang out.

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
- **WAVE** plays a one-shot wave animation everyone can see.
- **LOG** shows recent messages, so nothing is lost once a bubble fades.
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

## How it is put together

```
app/                    Next.js routes: title screen and /o/[code]
src/ui/                 React shell — entry screen, HUD, chat, settings
src/game/
  config.ts             every tuning knob in one file
  game.ts               owns the loop and ties the pieces together
  core/                 assets, bitmap font, input, camera, animation, audio
  world/                room format, the office itself, collision, room builder
  render/               renderer, speech bubbles, name plates
  net/                  transport interface + Supabase and same-browser drivers
tools/                  Python art pipeline (run only when the source art changes)
art-source/             the original high-resolution character and furniture art
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
left), and a wave, in a 320x240 PNG of about 60 KB.

### The room

Rooms are data (`src/game/world/office.ts`). A room lists props by bottom-centre anchor,
optional floor zones, spawn points, and interaction zones. Props are depth-sorted by their
anchor y each frame, which is what lets you walk in front of a desk and behind a cubicle
wall. Solid props get an automatic collider covering the bottom slice of their sprite —
front-elevation furniture is drawn much taller than the floor it occupies, so using the
whole sprite would feel like walking into invisible walls.

Adding a room means adding a file and registering it in `src/game/world/index.ts`; nothing
in the engine, renderer or netcode needs to change. The `zones` array is already carried
through for the small interactions (sit in a chair, stand at the copier, coffee) — nothing
reads it yet.

Laying out a room is easier with `?debug=1` (outlines every collider) and `?scale=N`
(pins the zoom, e.g. `?scale=2` to see a whole room at once).

### Realtime

One Supabase channel per office. No database and no auth:

- **presence** — who is here, with their name and character
- **broadcast `m`** — position, facing and animation state, 12/sec, lossy
- **broadcast `c`** — chat messages, reliable

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
Both are about a kilobyte.

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
- `tools/build_font.py` — rasterises the two bitmap fonts

The whole art payload is about 140 KB.

## Credits

Characters and office furniture are the project's own art, in `art-source/`. The bitmap
fonts are rasterised from Liberation Sans Bold (SIL Open Font License 1.1).
