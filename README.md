# Office Buds

A tiny retro office where friends can hang out — and a grove outside it, for the kind of
meeting that does not belong indoors.

One small office with one desk. Open the game and you get a link; send it to a friend and
they type their first name to walk in as themselves. Colin ends up at the desk and
everyone else in the chairs beside it, talking in speech bubbles over your heads. That is
the whole game, and it is meant to stay that way.

Nobody picks a character. You type your first name and a character is looked up in
`src/game/cast.ts`, so the invite is "type who you are", not "choose an avatar". The cast
is Colin, Michael, Alexis, Melanie and Tiffany; anyone else gets in as a guest.

<!-- Built for phones first; works fine on a desktop browser too. -->

## Playing

- **Phone** — touch anywhere on the office and drag. A small joystick appears under your
  thumb, so it never sits on top of the artwork and works in either hand.
- **Desktop** — WASD or the arrow keys.
- **CHAT** opens the composer. What you send floats above your head for a few seconds
  (longer messages linger longer) and your friend sees it in real time.
- **WAVE**, **JUMP** and **LAPTOP** — emote buttons only appear for animations that
  character actually has art for, so a character with no wave sheet simply has no button.
- **LOG** shows recent messages, so nothing is lost once a bubble fades.
- **PICK UP** appears when you are standing next to something you can lift. You then
  carry it over your head until you put it down, and everyone sees you holding it.
- Walk onto a chair to sit in it, or in behind the desk to sit at it.
- Walk out through the doorway to reach the grove on your own. Or say **"let's go
  outside"** and the whole room goes with you; say **"back to work"** out there to march
  everyone back in. The cottage is the way back.
- The office code in the top-left copies (or opens the share sheet for) the invite link.

### Say the magic words

Some things you type do more than float over your head. `src/game/chatMagic.ts` is the
whole list and adding one is a single line.

| Say | What happens |
| --- | --- |
| party time | The lights go down and disco lamps sweep the room |
| lights out | The lights go off. Everyone becomes a glow in the dark |
| party over | The lights come back on |
| leave | Everybody is turned out of the office |
| earthquake | The room shakes |
| congrats | Confetti |
| hi, bye | You wave |
| standup, coffee, deploy | A banner, for the people who need to know |

Out in the grove there is a second set, and those are gated — see *The grove* below.

Moods stick until somebody changes them; bursts play out and end. Both reach everyone in
the room, and nothing outside it — walking out of a party does not take the lighting with
you.

The disruptive ones are `exact: true`, meaning the whole message has to be the phrase.
That distinction was earned: as substrings, "leave" ended the session every time somebody
said they had to go, "raise" rained confetti on anyone raising a ticket, and "status" and
"coffee" kept a banner on screen through an entire standup. Anything that interrupts
other people has to be typed deliberately.

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
  world/                room format, the office, the grove, collision, room builder
  render/               renderer, speech bubbles, name plates
  net/                  transport interface + Supabase and same-browser drivers
tools/                  Python art pipeline (run only when the source art changes)
art-source/             high-resolution character sheets (see art-source/README.md)
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

Display scale is the larger of two demands. One asks to see roughly 260 world pixels
vertically, which is what a big room like the village wants. A small room wants the
opposite — zoom in far enough to fill the screen, or a one-room office ends up a postage
stamp adrift in letterbox. Taking the max satisfies whichever applies: on a phone the
office comes out at 3x, on a desktop 4-6x. On a wide screen the play surface is held to a
phone-shaped column in the middle, because one small office is a portrait scene and
stretching it across a monitor only buys more empty carpet.

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

**Adding one.** Drop the five sheets in `art-source/characters/`, run
`python3 tools/build_sprites.py`, add the id to `CHARACTER_IDS` in `src/game/types.ts`,
then add a line to `CAST` in `src/game/cast.ts` tying a name to it. Nothing else needs to change — the entry screen, the name plate and the seat
assignment all read from that list. A name that is not on the list still gets in, as a
visitor on the default sprite, so an invite never dead-ends on a typo.

Which seat you arrive in lives on that list too, and typing "Colin" is what puts someone
at the desk. There is no authentication behind it; for friends sharing a link that is the
right amount of security, and it is worth knowing rather than assuming otherwise.

Sheets do not all come back from the generator standing on the floor of their 640px box -
some sit 15-20px high, which at 1/16 scale leaves a character hovering above their own
shadow. The builder measures each character once and drops every one of their frames by
the same amount, which closes the gap without disturbing the shared anchor.

### The grove

Outside used to be a whole village. Nobody explored it — they stood in it and talked, and
480x384 of map meant most of that happened off each other's screens. It is now one
clearing sized the same way the office is, so a ceremony has an audience.

The rite is gated three ways, and all three matter. `only: ["colin"]` restricts the words
to one character; `where: "leader_stone"` restricts them to a zone that exists in no other
room; and the zone is the stone at the head of the circle. Saying the words from the
treeline does nothing. That gating is the whole difference between a ceremony and a
command, and it is three fields on a table entry:

```ts
{ phrases: ["i summon thee"], only: ["colin"], where: "leader_stone", effect: "summon" }
```

Being taken by the rite is `PlayerState.ascended` — replicated on the heartbeat for the
same reason `carrying` is, so somebody walking into the grove late sees exactly who is
still standing. The taken are drawn as the pack's own wraith, keep their name plate, and
cannot walk until the leader calls them back. No new character art: the wraith, the orb,
the altar stone and the braziers were all already in the village pack, unused.

The chalk ring is the one authored piece, in `tools/build_village.py`. It is an ellipse
rather than a circle — the game looks down on the ground at an angle, so a true circle
painted on the floor reads as a hoop standing upright.

### Picking things up

A prop marked `takeable` can be lifted. What makes this simple is that the entire world
state lives in one replicated number: `PlayerState.carrying`, an index into the room's
prop list. A takeable prop is drawn unless somebody standing in the room is carrying it,
and everyone already receives everyone's carrying value on the movement heartbeat.

That means there is no take/drop event to miss, nothing to replay for a late joiner, and
no way for two clients to disagree about what is on the floor. It also means a dropped
item returns to exactly where it started, which is the one thing given up for it — you
can carry the photocopier around the office, but you cannot leave it somewhere else.

Two people reaching for the same thing on the same tick both come away holding it for an
instant; lowest player id keeps it, which both clients work out independently without
having to agree on a clock.

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
which is what stops sixteen crops of grass falling into a visible repeat; a floor zone
can instead name a nine-slice set (`nine: "rug"`) when it wants a visible hem, which a
tile swap cannot give you.

### Sitting down, without any sitting art

Nobody has a sitting animation and none is needed. In a front-on perspective, furniture
drawn over a character's legs reads as sitting behind it — so a seat is just a spot whose
y sorts *before* the furniture's, plus a facing. The desk crosses the manager at chest
height; the sofa crosses a visitor at the waist.

`seats` in the room data says who lands where: the manager gets the desk, everyone else
the sofa beside it, so a meeting looks like a meeting the moment both people are in. The
sofas are deliberately not solid, which makes this something you can also do on purpose —
walk onto a sofa and you are sitting on it.

The office is sized against a portrait phone rather than for looks: 144x240 world px,
which is very nearly one screenful, so the camera only ever drifts a few pixels and
nothing important is ever off-frame. With two people in the room the camera frames the
group rather than following one person, or you would be talking to someone off screen.

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

### Who somebody is

Both transports decode an arriving peer through one function, `src/game/net/identity.ts`,
checked against `CHARACTER_IDS` — which is a runtime list with the `CharacterId` type
derived from it, rather than a hand-written union sitting alongside a separate list.

That shape was earned. The Supabase driver used to decode peers inline with a test
written when the cast was two people: anything that was not `michael` became `colin`. So
over a real connection Alexis, Melanie and Tiffany all arrived wearing Colin's sprite
while looking correct on their own screen. Every automated test passed, because they all
run the same-browser driver, which had its own copy of the logic and no bug.

`npm test` covers that decoder — every character round-tripping as itself, and unknown,
missing and malformed input falling back rather than being clamped onto a real character.
It needs no socket, which is the point: the bug lived in the one path that could not be
reached from a test.

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
- `tools/build_office.py` — the office atlas: named pieces cut out of LimeZu's Modern
  Office pack, wallpaper and floor tiles sliced off its room builder, plus the nine-slice
  rug the pack does not include
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

The office furniture is **Modern Office - Revamped** by **[LimeZu](https://limezu.itch.io/)**,
used under its licence, which permits commercial and non-commercial use and forbids
redistributing the art. `public/assets/props.png` — the packed atlas the game loads — is a
derived work and ships here. The pack's own files are gitignored and are not in this
repository; `art-source/README.md` says where to put them if you need to rebuild.

The cast in `art-source/characters/` and the outdoor art in `art-source/village/` are the
project's own.

The bitmap fonts are rasterised from Liberation Sans Bold (SIL Open Font License 1.1).
