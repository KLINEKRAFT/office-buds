"use client";

import type { CharacterId } from "@/game/types";

/** Mirrors the atlas layout produced by tools/build_sprites.py. */
const FRAME = 40;
const COLS = 8;
const ZOOM = 2;

const CHARACTERS: Array<{ id: CharacterId; label: string }> = [
  { id: "colin", label: "COLIN" },
  { id: "michael", label: "MICHAEL" },
];

/**
 * Shows each character's first idle frame straight from the game atlas, so the picker
 * always matches what you actually get in the office.
 */
export function CharacterPicker({
  value,
  onChange,
}: {
  value: CharacterId;
  onChange(id: CharacterId): void;
}) {
  return (
    <div className="picker">
      {CHARACTERS.map((c) => (
        <button
          key={c.id}
          type="button"
          className="picker__item"
          aria-pressed={value === c.id}
          onClick={() => onChange(c.id)}
        >
          <span
            className="picker__art"
            style={{
              width: FRAME * ZOOM,
              height: FRAME * ZOOM,
              backgroundImage: `url(/assets/${c.id}.png)`,
              backgroundSize: `${COLS * FRAME * ZOOM}px auto`,
              backgroundPosition: "0 0",
            }}
          />
          <span className="picker__name">{c.label}</span>
        </button>
      ))}
    </div>
  );
}
