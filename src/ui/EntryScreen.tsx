"use client";

import { useEffect, useState } from "react";

import type { CharacterId } from "@/game/types";
import { loadProfile, sanitizeName, saveProfile } from "@/lib/room";
import { CharacterPicker } from "./CharacterPicker";

export interface EntryResult {
  name: string;
  character: CharacterId;
}

/**
 * The one gate before the office. Doubles as the audio unlock, since browsers only
 * allow sound to start from a real tap.
 */
export function EntryScreen({
  action,
  roomCode,
  busy,
  footer,
  onSubmit,
}: {
  action: string;
  roomCode?: string;
  busy?: boolean;
  footer?: React.ReactNode;
  onSubmit(result: EntryResult): void;
}) {
  const [name, setName] = useState("");
  const [character, setCharacter] = useState<CharacterId>("colin");
  const [ready, setReady] = useState(false);

  // Remember the last name and character so a returning player is one tap from the door.
  useEffect(() => {
    const profile = loadProfile();
    if (profile) {
      setName(profile.name);
      setCharacter(profile.character);
    }
    setReady(true);
  }, []);

  const clean = sanitizeName(name);
  const canSubmit = clean.length > 0 && !busy;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    saveProfile({ name: clean, character });
    onSubmit({ name: clean, character });
  };

  return (
    <div className="screen">
      <form className="screen__inner" onSubmit={submit}>
        <div className="logo">
          <h1 className="logo__title">OFFICE BUDS</h1>
          <p className="logo__sub">
            {roomCode ? `OFFICE ${roomCode}` : "A TINY PLACE TO HANG OUT"}
          </p>
        </div>

        <div className="panel">
          <p className="label">Your name</p>
          <input
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="COLIN"
            maxLength={12}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            enterKeyHint="go"
          />

          <p className="label">Pick your bud</p>
          <CharacterPicker value={character} onChange={setCharacter} />

          <button type="submit" className="btn btn--primary" disabled={!canSubmit || !ready}>
            {busy ? "Entering..." : action}
          </button>
        </div>

        {footer}
      </form>
    </div>
  );
}
