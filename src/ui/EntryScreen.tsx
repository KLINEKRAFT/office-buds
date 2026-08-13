"use client";

import { useEffect, useState } from "react";

import { castFor, type CastMember } from "@/game/cast";
import { loadProfile, sanitizeName, saveProfile } from "@/lib/room";
import { InviteCard } from "./InviteCard";

export type EntryResult = CastMember;

/**
 * The one gate before the office. Type your first name and go.
 *
 * It deliberately shows you nothing about who you are about to be. The character is
 * looked up from your name, and finding out which one by walking into the room as them
 * is the whole moment - a preview here would spend it before you arrive.
 *
 * Doubles as the audio unlock, since browsers only allow sound to start from a real tap.
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
        <InviteCard roomCode={roomCode} />

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

          <button type="submit" className="btn btn--primary" disabled={!canSubmit || !ready}>
            {busy ? "Entering..." : action}
          </button>
        </div>

        {footer}
      </form>
    </div>
  );
}
