import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";

import { NET_SEND_HZ } from "../config";
import type { CharacterId, PlayerState } from "../types";
import type { Net, NetHandlers, NetIdentity } from "./types";

/**
 * Realtime over a single Supabase channel. No database, no auth, no tables:
 *
 *   presence  -> who is in the room, plus their name and character
 *   broadcast "m" -> position/direction/animation, sent at NET_SEND_HZ, lossy
 *   broadcast "c" -> chat messages, reliable
 *
 * Presence is diffed against the previous roster rather than trusting join/leave
 * events, because a dropped event would otherwise strand a ghost in the room forever.
 */
export class SupabaseNet implements Net {
  readonly id: string;
  private client: SupabaseClient | null = null;
  private channel: RealtimeChannel | null = null;
  private handlers: NetHandlers | null = null;
  private roster = new Set<string>();
  private pending: PlayerState | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private closed = false;

  constructor(
    private readonly url: string,
    private readonly anonKey: string,
    private readonly room: string,
    private readonly identity: { id: string; name: string; character: CharacterId },
  ) {
    this.id = identity.id;
  }

  async connect(handlers: NetHandlers): Promise<void> {
    this.handlers = handlers;
    handlers.onStatus("connecting");

    this.client = createClient(this.url, this.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: NET_SEND_HZ * 2 } },
    });

    const channel = this.client.channel(`office:${this.room}`, {
      config: {
        broadcast: { self: false, ack: false },
        presence: { key: this.id },
      },
    });
    this.channel = channel;

    channel.on("presence", { event: "sync" }, () => this.syncRoster());

    channel.on("broadcast", { event: "m" }, ({ payload }) => {
      const p = payload as { id?: string } & Partial<PlayerState>;
      if (!p?.id || p.id === this.id) return;
      if (typeof p.x !== "number" || typeof p.y !== "number") return;
      this.handlers?.onMove(p.id, {
        x: p.x,
        y: p.y,
        dir: p.dir ?? "down",
        moving: !!p.moving,
        emote: p.emote ?? 0,
      });
    });

    channel.on("broadcast", { event: "c" }, ({ payload }) => {
      const p = payload as { id?: string; text?: string; at?: number };
      if (!p?.id || p.id === this.id || typeof p.text !== "string") return;
      this.handlers?.onChat(p.id, p.text, p.at ?? Date.now());
    });

    await new Promise<void>((resolve) => {
      channel.subscribe((status, err) => {
        if (this.closed) return;
        if (status === "SUBSCRIBED") {
          void channel.track({
            name: this.identity.name,
            character: this.identity.character,
          });
          handlers.onStatus("online");
          resolve();
        } else if (status === "CHANNEL_ERROR") {
          handlers.onStatus("error", err?.message ?? "channel error");
          resolve();
        } else if (status === "TIMED_OUT") {
          handlers.onStatus("error", "connection timed out");
          resolve();
        } else if (status === "CLOSED") {
          handlers.onStatus("offline");
        }
      });
    });

    // Movement is rate limited here rather than at the call site, so the game loop can
    // fire sendMove as often as it likes.
    this.timer = setInterval(() => this.flush(), Math.round(1000 / NET_SEND_HZ));
  }

  private syncRoster(): void {
    const channel = this.channel;
    const handlers = this.handlers;
    if (!channel || !handlers) return;

    const state = channel.presenceState<{ name?: string; character?: string }>();
    const seen = new Set<string>();

    for (const [key, metas] of Object.entries(state)) {
      if (key === this.id) continue;
      seen.add(key);
      if (this.roster.has(key)) continue;
      const meta = metas?.[0];
      handlers.onJoin({
        id: key,
        name: (meta?.name || "BUD").slice(0, 12),
        character: (meta?.character === "michael" ? "michael" : "colin") as CharacterId,
      } satisfies NetIdentity);
    }

    for (const key of this.roster) {
      if (!seen.has(key)) handlers.onLeave(key);
    }
    this.roster = seen;
  }

  private flush(): void {
    if (!this.pending || !this.channel) return;
    const payload = { id: this.id, ...this.pending };
    this.pending = null;
    void this.channel.send({ type: "broadcast", event: "m", payload });
  }

  sendMove(state: PlayerState): void {
    // Keep only the newest sample; stale positions are worthless.
    this.pending = state;
  }

  sendChat(text: string): void {
    if (!this.channel) return;
    void this.channel.send({
      type: "broadcast",
      event: "c",
      payload: { id: this.id, text, at: Date.now() },
    });
  }

  disconnect(): void {
    this.closed = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.channel) void this.channel.unsubscribe();
    this.channel = null;
    void this.client?.removeAllChannels();
    this.client = null;
    this.handlers?.onStatus("offline");
  }
}
