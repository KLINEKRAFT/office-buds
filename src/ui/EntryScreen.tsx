"use client";

import { useEffect, useState } from "react";

import { castFor, isKnownName, type CastMember } from "@/game/cast";
import { loadProfile, sanitizeName, saveProfile } from "@/lib/room";

export type EntryResult = CastMember;

/** Mirrors the atlas layout produced by tools/build_sprites.py. */
const FRAME = 40;
const COLS = 8;
const ZOOM = 2;

/**
 * The one gate before the office. You type your name and turn up as yourself - the
 * character is looked up in the cast list rather than chosen, so an invite always
 * produces the right person. Doubles as the audio unlock, since browsers only allow
 * sound to start from a real tap.
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
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const profile = loadProfile();
    if (profile) setName(profile.name);
    setReady(true);
  }, []);

  const clean = sanitizeName(name);
  const member = castFor(clean);
  const known = clean.length > 0 && isKnownName(clean);
  const canSubmit = clean.length > 0 && !busy;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    saveProfile({ name: member.name });
    onSubmit(member);
  };

  return (
    <div className="screen">
      <form className="screen__inner" onSubmit={submit}>
        <div className="logo">
          <h1 className="logo__title">OFFICE BUDS</h1>
          <p className="logo__sub">{roomCode ? `MEETING ${roomCode}` : "A TINY PLACE TO HANG OUT"}</p>
        </div>

        <div className="panel">
          <p className="label">First name</p>
          <input
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="TYPE YOUR FIRST NAME"
            maxLength={12}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            enterKeyHint="go"
            autoFocus
          />

          {/* Show who they are about to walk in as, straight from the atlas. */}
          <div className="whoami">
            <span
              className="whoami__art"
              style={{
                width: FRAME * ZOOM,
                height: FRAME * ZOOM,
                backgroundImage: `url(/assets/${member.character}.png)`,
                backgroundSize: `${COLS * FRAME * ZOOM}px auto`,
                backgroundPosition: "0 0",
                opacity: clean ? 1 : 0.35,
              }}
            />
            {/* Who you are about to walk in as. Deliberately no title or role - the
                name and the face are the whole of it. */}
            <div className="whoami__text">
              {clean ? (
                <>
                  <strong>{member.name}</strong>
                  <span>{known ? "READY" : "NEW FACE"}</span>
                </>
              ) : (
                <span>Who are you?</span>
              )}
            </div>
          </div>

          <button type="submit" className="btn btn--primary" disabled={!canSubmit || !ready}>
            {busy ? "Entering..." : action}
          </button>
        </div>

        {footer}
      </form>
    </div>
  );
}
