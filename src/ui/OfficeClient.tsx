"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { CHAT_HISTORY_LIMIT, MAX_MESSAGE_LEN } from "@/game/config";
import { Game } from "@/game/game";
import { STATUS_LABEL, type NetStatus } from "@/game/net";
import type { ChatMessage } from "@/game/types";
import { inviteUrl } from "@/lib/room";
import { EntryScreen, type EntryResult } from "./EntryScreen";

export function OfficeClient({ roomCode }: { roomCode: string }) {
  const [profile, setProfile] = useState<EntryResult | null>(null);

  if (!profile) {
    return (
      <EntryScreen
        action="Enter office"
        roomCode={roomCode}
        onSubmit={setProfile}
        footer={
          <p className="hint" style={{ textAlign: "center" }}>
            Send this page&apos;s link to a friend and you will both land in the same office.
          </p>
        }
      />
    );
  }

  return <OfficeStage roomCode={roomCode} profile={profile} />;
}

function OfficeStage({ roomCode, profile }: { roomCode: string; profile: EntryResult }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<NetStatus>("connecting");
  const [peers, setPeers] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [shared, setShared] = useState(false);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let game: Game | null = null;

    (async () => {
      try {
        if (!canvasRef.current || !stageRef.current) return;
        game = await Game.create({
          canvas: canvasRef.current,
          surface: stageRef.current,
          roomCode,
          name: profile.name,
          character: profile.character,
          onStatus: (s) => !cancelled && setStatus(s),
          onPeers: (n) => !cancelled && setPeers(n),
          onChat: (m) =>
            !cancelled &&
            setMessages((prev) => [...prev, m].slice(-CHAT_HISTORY_LIMIT)),
        });
        if (cancelled) {
          game.dispose();
          return;
        }
        gameRef.current = game;
        // Entering the office was a real tap, so audio is allowed to start here.
        game.audio.unlock();
        game.start();
        setPhase("ready");
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "could not start the office");
        setPhase("error");
      }
    })();

    return () => {
      cancelled = true;
      gameRef.current?.dispose();
      gameRef.current = null;
      game?.dispose();
    };
  }, [roomCode, profile.name, profile.character]);

  useEffect(() => {
    if (composerOpen) {
      gameRef.current?.releaseInput();
      inputRef.current?.focus();
    }
  }, [composerOpen]);

  const send = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    gameRef.current?.say(text);
    setDraft("");
  }, [draft]);

  const invite = useCallback(async () => {
    const url = inviteUrl(roomCode);
    try {
      if (navigator.share) {
        await navigator.share({ title: "Office Buds", text: "come hang out", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 1600);
    } catch {
      // Share sheet dismissed, or clipboard blocked. The code is on screen either way.
    }
  }, [roomCode]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      gameRef.current?.audio.setMuted(!m);
      return !m;
    });
  }, []);

  const dotClass =
    status === "online" ? "chip__dot" : status === "error" ? "chip__dot chip__dot--bad" : "chip__dot chip__dot--off";

  return (
    <>
      <div className="stage" ref={stageRef}>
        <canvas ref={canvasRef} className="stage__canvas" />
      </div>

      {phase === "loading" && <div className="loading">LOADING THE OFFICE...</div>}

      {phase === "error" && (
        <div className="loading">
          <span>COULD NOT START</span>
          <span style={{ color: "#c5c3be", letterSpacing: 0 }}>{error}</span>
        </div>
      )}

      {phase === "ready" && (
        <div className="hud">
          <div className="hud__topleft">
            <button type="button" className="chip chip--button" onClick={invite}>
              {shared ? "LINK COPIED" : `OFFICE ${roomCode}`}
            </button>
          </div>

          <div className="hud__topright">
            <span className="chip">
              <span className={dotClass} />
              {status === "online" ? `${peers + 1} HERE` : STATUS_LABEL[status]}
            </span>
            <button
              type="button"
              className="chip chip--button"
              onClick={() => setSettingsOpen(true)}
              aria-label="Settings"
            >
              ⚙
            </button>
          </div>

          {historyOpen && (
            <div className="history">
              {messages.length === 0 ? (
                <p className="history__empty">NOTHING SAID YET</p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`history__row${m.own ? " history__row--own" : ""}`}
                  >
                    <span className="history__name">{m.name}</span>
                    <span className="history__text">{m.text}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {!composerOpen && (
            <div className="hud__bottomright">
              <button
                type="button"
                className="round"
                onClick={() => setHistoryOpen((v) => !v)}
              >
                <span className="round__glyph">▤</span>
                LOG
              </button>
              <button
                type="button"
                className="round"
                onClick={() => gameRef.current?.wave()}
              >
                <span className="round__glyph">✋</span>
                WAVE
              </button>
              <button
                type="button"
                className="round round--chat"
                onClick={() => setComposerOpen(true)}
              >
                <span className="round__glyph">💬</span>
                CHAT
              </button>
            </div>
          )}

          {composerOpen && (
            <form
              className="composer"
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <input
                ref={inputRef}
                className="field"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setComposerOpen(false);
                }}
                placeholder="Say something..."
                maxLength={MAX_MESSAGE_LEN}
                autoComplete="off"
                enterKeyHint="send"
              />
              <button type="submit" className="btn btn--primary" disabled={!draft.trim()}>
                Send
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setComposerOpen(false)}
                aria-label="Close chat"
              >
                ✕
              </button>
            </form>
          )}
        </div>
      )}

      {settingsOpen && (
        <div className="modal" onClick={() => setSettingsOpen(false)}>
          <div className="modal__box" onClick={(e) => e.stopPropagation()}>
            <div className="modal__bar">
              <span>OFFICE BUDS</span>
              <button
                type="button"
                className="modal__close"
                onClick={() => setSettingsOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="modal__body">
              <p className="label">Invite code</p>
              <div className="invite-code">{roomCode}</div>
              <button type="button" className="btn btn--primary" onClick={invite}>
                {shared ? "Link copied" : "Share invite link"}
              </button>

              <p className="label">Sound</p>
              <button type="button" className="btn" onClick={toggleMute}>
                {muted ? "Sound: off" : "Sound: on"}
              </button>

              <p className="hint">
                Move with the on-screen stick, or WASD / arrow keys on a computer. Tap
                CHAT to talk - your message floats above your head.
              </p>

              <a className="btn btn--ghost" href="/" style={{ textAlign: "center", textDecoration: "none" }}>
                Leave office
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
