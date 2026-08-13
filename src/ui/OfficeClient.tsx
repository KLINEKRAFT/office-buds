"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ANNOUNCE_MS, CHAT_HISTORY_LIMIT, MAX_MESSAGE_LEN } from "@/game/config";
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
        action="Join the meeting"
        roomCode={roomCode}
        onSubmit={setProfile}
        footer={
          <p className="hint" style={{ textAlign: "center" }}>
            Type your name and you will walk in as yourself.
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
  const [place, setPlace] = useState("");
  const [evictedBy, setEvictedBy] = useState("");
  const [announce, setAnnounce] = useState("");
  const [emotes, setEmotes] = useState<Array<{ clip: string; label: string; glyph: string }>>([]);
  const [reach, setReach] = useState<{ action: "take" | "put"; label: string } | null>(null);
  const announceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reachTimer = useRef<ReturnType<typeof setInterval> | null>(null);

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
          seat: profile.seat,
          // ?room=outside drops you straight into a place, for laying rooms out.
          startRoom: new URLSearchParams(window.location.search).get("room") ?? undefined,
          onStatus: (s) => !cancelled && setStatus(s),
          onPeers: (n) => !cancelled && setPeers(n),
          onChat: (m) =>
            !cancelled &&
            setMessages((prev) => [...prev, m].slice(-CHAT_HISTORY_LIMIT)),
          onPlace: (name) => !cancelled && setPlace(name),
          onEvicted: (byName) => {
            if (cancelled) return;
            // Somebody said the word. Everyone goes back to the title screen; rejoining
            // is one tap, which is what keeps this funny rather than annoying.
            setEvictedBy(byName);
            // dispose, not stop: stopping only halts the render loop, leaving the socket
            // open and presence still reporting us. Everyone who stayed would keep a
            // motionless ghost of us for fifteen seconds, still holding whatever we had
            // picked up, and would hear a join chime when we came back as a new id.
            gameRef.current?.dispose();
            gameRef.current = null;
          },
          onAnnounce: (text) => {
            if (cancelled) return;
            setAnnounce(text);
            if (announceTimer.current) clearTimeout(announceTimer.current);
            announceTimer.current = setTimeout(() => setAnnounce(""), ANNOUNCE_MS);
          },
        });
        if (cancelled) {
          game.dispose();
          return;
        }
        gameRef.current = game;
        // Entering the office was a real tap, so audio is allowed to start here.
        game.audio.unlock();
        game.start();
        setEmotes(game.emotes);
        setPhase("ready");
        // Poll rather than push: whether something is within reach changes as you walk,
        // and four times a second is far below what a thumb can notice while costing
        // nothing next to the render loop.
        reachTimer.current = setInterval(() => {
          if (cancelled) return;
          const next = gameRef.current?.reach ?? null;
          // Only re-render when the offer actually changes. Without this, standing next
          // to anything - or carrying it - re-rendered the whole HUD four times a second
          // with an identical tree, competing with the render loop on a slow phone.
          setReach((prev) =>
            prev?.action === next?.action && prev?.label === next?.label ? prev : next,
          );
        }, 250);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "could not start the office");
        setPhase("error");
      }
    })();

    return () => {
      cancelled = true;
      if (announceTimer.current) clearTimeout(announceTimer.current);
      if (reachTimer.current) clearInterval(reachTimer.current);
      gameRef.current?.dispose();
      gameRef.current = null;
      game?.dispose();
    };
  }, [roomCode, profile.name, profile.character, profile.seat]);

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
    status === "online"
      ? "chip__dot"
      : status === "error"
        ? "chip__dot chip__dot--bad"
        : "chip__dot chip__dot--off";

  return (
    <>
      <div className="stage" ref={stageRef}>
        <canvas ref={canvasRef} className="stage__canvas" />
      </div>

      {phase === "loading" && <div className="loading">LOADING THE OFFICE...</div>}

      {evictedBy && (
        <div className="modal">
          <div className="modal__box">
            <div className="modal__bar">
              <span>EVERYBODY OUT</span>
            </div>
            <div className="modal__body">
              <p className="label">{evictedBy} cleared the room</p>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => window.location.reload()}
              >
                Go back in
              </button>
              <a className="btn btn--ghost" href="/" style={{ textAlign: "center", textDecoration: "none" }}>
                Leave for good
              </a>
            </div>
          </div>
        </div>
      )}

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
              {shared ? "LINK COPIED" : `${place || "OFFICE"} \u00B7 ${roomCode}`}
            </button>
          </div>

          <div className="hud__topright">
            <span className="chip">
              <span className={dotClass} />
              {status === "online"
                ? `${peers + 1} HERE`
                : status === "local"
                  ? `${peers + 1} HERE \u00B7 SAME DEVICE`
                  : STATUS_LABEL[status]}
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

          {announce && <div className="announce">{announce}</div>}

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
              {reach && (
                <button
                  type="button"
                  className="round round--act"
                  onClick={() => {
                    gameRef.current?.toggleCarry();
                    setReach(gameRef.current?.reach ?? null);
                  }}
                >
                  <span className="round__glyph">{reach.action === "put" ? "\u{1F44C}" : "\u{1F91A}"}</span>
                  {reach.label}
                </button>
              )}
              {emotes.map((e) => (
                <button
                  key={e.clip}
                  type="button"
                  className="round"
                  onClick={() => gameRef.current?.emote(e.clip)}
                >
                  <span className="round__glyph">{e.glyph}</span>
                  {e.label}
                </button>
              ))}
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

              {status === "local" && (
                <p className="hint" style={{ color: "#e0a3b2" }}>
                  No realtime backend is configured, so this office only reaches other tabs
                  on this device. Set NEXT_PUBLIC_SUPABASE_URL and
                  NEXT_PUBLIC_SUPABASE_ANON_KEY to make invite links work.
                </p>
              )}

              <p className="label">Sound</p>
              <button type="button" className="btn" onClick={toggleMute}>
                {muted ? "Sound: off" : "Sound: on"}
              </button>

              <p className="hint">
                Move with the on-screen stick, or WASD / arrow keys on a computer. Tap
                CHAT to talk - your message floats above your head. Say &quot;let&apos;s go
                outside&quot; and everyone goes with you.
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
