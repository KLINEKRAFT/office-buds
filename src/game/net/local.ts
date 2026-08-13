import type { CharacterId, PlayerState } from "../types";
import type { Net, NetHandlers, NetIdentity } from "./types";

type Msg =
  | { t: "hello" | "hello_ack"; id: string; name: string; character: CharacterId }
  | { t: "bye"; id: string }
  | ({ t: "m"; id: string } & PlayerState)
  | { t: "c"; id: string; text: string; at: number }
  | { t: "g"; id: string; room: string; spawn: number; announce: string };

/**
 * Same-browser multiplayer over BroadcastChannel.
 *
 * Used when no realtime backend is configured. Two tabs pointed at the same office
 * find each other, which makes the game playable and - more usefully - lets the whole
 * multiplayer path (presence, interpolation, speech bubbles) be exercised without a
 * network. Everything above the transport is identical to the Supabase driver.
 */
export class LocalNet implements Net {
  readonly id: string;
  private channel: BroadcastChannel | null = null;
  private handlers: NetHandlers | null = null;
  private readonly known = new Set<string>();

  constructor(
    private readonly room: string,
    private readonly identity: { id: string; name: string; character: CharacterId },
  ) {
    this.id = identity.id;
  }

  async connect(handlers: NetHandlers): Promise<void> {
    this.handlers = handlers;
    if (typeof BroadcastChannel === "undefined") {
      handlers.onStatus("offline", "this browser has no BroadcastChannel");
      return;
    }

    this.channel = new BroadcastChannel(`office-buds:${this.room}`);
    this.channel.onmessage = (e: MessageEvent<Msg>) => this.receive(e.data);
    // pagehide is the reliable one on mobile Safari, where beforeunload often never
    // fires; both are harmless to register.
    window.addEventListener("beforeunload", this.sayGoodbye);
    window.addEventListener("pagehide", this.sayGoodbye);

    this.post({ t: "hello", id: this.id, name: this.identity.name, character: this.identity.character });
    handlers.onStatus("local", "same-device only");
  }

  private post(msg: Msg): void {
    this.channel?.postMessage(msg);
  }

  private register(id: string, name: string, character: CharacterId): boolean {
    if (id === this.id || this.known.has(id)) return false;
    this.known.add(id);
    this.handlers?.onJoin({ id, name, character } satisfies NetIdentity);
    return true;
  }

  private receive(msg: Msg): void {
    if (!msg || msg.id === this.id) return;
    switch (msg.t) {
      case "hello":
        // Answer with a directed ack rather than another hello, so two tabs greeting
        // each other cannot ping-pong forever.
        this.register(msg.id, msg.name, msg.character);
        this.post({
          t: "hello_ack",
          id: this.id,
          name: this.identity.name,
          character: this.identity.character,
        });
        break;
      case "hello_ack":
        this.register(msg.id, msg.name, msg.character);
        break;
      case "bye":
        if (this.known.delete(msg.id)) this.handlers?.onLeave(msg.id);
        break;
      case "m":
        if (!this.known.has(msg.id)) return;
        this.handlers?.onMove(msg.id, {
          x: msg.x,
          y: msg.y,
          dir: msg.dir,
          moving: msg.moving,
          emote: msg.emote,
          room: msg.room,
        });
        break;
      case "c":
        if (!this.known.has(msg.id)) return;
        this.handlers?.onChat(msg.id, msg.text, msg.at);
        break;
      case "g":
        if (!this.known.has(msg.id)) return;
        this.handlers?.onGo(msg.id, msg.room, msg.spawn, msg.announce);
        break;
    }
  }

  sendMove(state: PlayerState): void {
    this.post({ t: "m", id: this.id, ...state });
  }

  sendChat(text: string): void {
    this.post({ t: "c", id: this.id, text, at: Date.now() });
  }

  sendGo(room: string, spawn: number, announce: string): void {
    this.post({ t: "g", id: this.id, room, spawn, announce });
  }

  private sayGoodbye = (): void => {
    this.post({ t: "bye", id: this.id });
  };

  disconnect(): void {
    this.sayGoodbye();
    window.removeEventListener("beforeunload", this.sayGoodbye);
    window.removeEventListener("pagehide", this.sayGoodbye);
    this.channel?.close();
    this.channel = null;
    this.handlers?.onStatus("offline");
  }
}
