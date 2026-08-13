"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { EntryScreen } from "@/ui/EntryScreen";
import { isValidRoomCode, makeRoomCode, normalizeRoomCode } from "@/lib/room";

/**
 * Title screen. Creating an office is a single tap: name, bud, go. Joining by code is
 * tucked underneath for the case where someone reads the code out instead of sending
 * the link.
 */
export default function Home() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);

  const code = normalizeRoomCode(joinCode);

  return (
    <EntryScreen
      action="Open your office"
      busy={busy}
      onSubmit={() => {
        setBusy(true);
        router.push(`/o/${makeRoomCode()}`);
      }}
      footer={
        <div className="panel">
          <p className="label">Got a code?</p>
          <div className="row">
            <input
              className="field"
              value={joinCode}
              onChange={(e) => setJoinCode(normalizeRoomCode(e.target.value))}
              placeholder="ABCD"
              maxLength={8}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              style={{ letterSpacing: "0.3em", textAlign: "center" }}
            />
            <button
              type="button"
              className="btn btn--ghost"
              disabled={!isValidRoomCode(code)}
              onClick={() => router.push(`/o/${code}`)}
            >
              Join
            </button>
          </div>
        </div>
      }
    />
  );
}
