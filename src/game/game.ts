import {
  BUBBLE_MAX_MS,
  BUBBLE_MAX_W,
  BUBBLE_MIN_MS,
  BUBBLE_PER_CHAR_MS,
  EMOTE_WAVE,
  MAX_MESSAGE_LEN,
  NET_IDLE_RESEND_MS,
  PEER_TIMEOUT_MS,
  REMOTE_SMOOTHING,
  REMOTE_SNAP_DIST,
  WALK_SPEED,
} from "./config";
import { emoteFinished } from "./core/anim";
import { loadAssets, type Assets } from "./core/assets";
import { Audio } from "./core/audio";
import { Camera } from "./core/camera";
import { Input } from "./core/input";
import { Renderer } from "./render/renderer";
import { createNet, type Net, type NetStatus } from "./net";
import type { Bubble, ChatMessage, CharacterId, Dir, Player, PlayerState } from "./types";
import { buildRoom, type BuiltRoom } from "./world/build";
import { findFreeSpawn, moveWithCollision } from "./world/collision";
import { getRoom } from "./world";

export interface GameOptions {
  canvas: HTMLCanvasElement;
  surface: HTMLElement;
  roomCode: string;
  name: string;
  character: CharacterId;
  roomId?: string;
  onChat(message: ChatMessage): void;
  onStatus(status: NetStatus, detail?: string): void;
  onPeers(count: number): void;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function bubbleDuration(text: string): number {
  return Math.min(BUBBLE_MAX_MS, BUBBLE_MIN_MS + text.length * BUBBLE_PER_CHAR_MS);
}

export class Game {
  private raf = 0;
  private last = 0;
  private running = false;

  private readonly players = new Map<string, Player>();
  private readonly targets = new Map<string, { x: number; y: number }>();
  private readonly local: Player;
  private readonly input = new Input();
  private readonly camera: Camera;
  private readonly renderer: Renderer;
  private readonly net: Net;
  readonly audio = new Audio();

  private lastSent: PlayerState | null = null;
  private lastSentAt = 0;
  private lastStepPhase = -1;
  private localSpeed = 0;
  private resizeObserver: ResizeObserver | null = null;

  private constructor(
    private readonly opts: GameOptions,
    private readonly assets: Assets,
    private readonly room: BuiltRoom,
  ) {
    const id = uid();
    const spawn = room.def.spawns[Math.floor(Math.random() * room.def.spawns.length)] ?? {
      x: room.width / 2,
      y: room.height / 2,
    };
    const free = findFreeSpawn(room, spawn.x, spawn.y);

    this.local = {
      id,
      name: opts.name,
      character: opts.character,
      x: free.x,
      y: free.y,
      renderX: free.x,
      renderY: free.y,
      dir: "down",
      moving: false,
      emote: 0,
      animTime: 0,
      emoteTime: 0,
      bubble: null,
      lastSeen: Date.now(),
    };
    this.players.set(id, this.local);

    this.camera = new Camera(room.width, room.height);
    this.renderer = new Renderer(opts.canvas, assets);
    this.net = createNet(opts.roomCode, { id, name: opts.name, character: opts.character });
  }

  static async create(opts: GameOptions): Promise<Game> {
    const assets = await loadAssets();
    const room = buildRoom(getRoom(opts.roomId ?? "office"), assets);
    const game = new Game(opts, assets, room);
    await game.init();
    return game;
  }

  private async init(): Promise<void> {
    this.input.attach(this.opts.surface);
    // ?debug=1 outlines every collider and ?scale=N pins the zoom - both exist so a
    // new room can be laid out and checked without editing code.
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      this.renderer.debugColliders = params.has("debug");
      const scale = Number(params.get("scale"));
      if (Number.isFinite(scale) && scale >= 1 && scale <= 8) this.renderer.scaleOverride = scale;
    }
    this.handleResize();

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.opts.surface);
    window.addEventListener("orientationchange", this.handleResize);

    this.camera.snapTo(this.local.renderX, this.local.renderY);

    await this.net.connect({
      onStatus: (status, detail) => this.opts.onStatus(status, detail),
      onJoin: (peer) => {
        if (this.players.has(peer.id)) return;
        const spawn = findFreeSpawn(this.room, this.local.x, this.local.y + 24);
        this.players.set(peer.id, {
          id: peer.id,
          name: peer.name,
          character: peer.character,
          x: spawn.x,
          y: spawn.y,
          renderX: spawn.x,
          renderY: spawn.y,
          dir: "down",
          moving: false,
          emote: 0,
          animTime: 0,
          emoteTime: 0,
          bubble: null,
          lastSeen: Date.now(),
        });
        this.audio.join();
        this.reportPeers();
        // Make sure the newcomer sees where we are straight away.
        this.lastSent = null;
      },
      onLeave: (id) => {
        if (!this.players.delete(id)) return;
        this.targets.delete(id);
        this.audio.leave();
        this.reportPeers();
      },
      onMove: (id, state) => {
        const p = this.players.get(id);
        if (!p) return;
        p.dir = state.dir;
        p.moving = state.moving;
        p.lastSeen = Date.now();
        if (state.emote && state.emote !== p.emote) {
          p.emote = state.emote;
          p.emoteTime = 0;
        } else if (!state.emote) {
          p.emote = 0;
        }
        this.targets.set(id, { x: state.x, y: state.y });
      },
      onChat: (id, text, at) => {
        const p = this.players.get(id);
        if (!p) return;
        this.showBubble(p, text);
        this.audio.receiveMessage();
        this.opts.onChat({ id: uid(), playerId: id, name: p.name, text, at, own: false });
      },
    });
  }

  private reportPeers(): void {
    this.opts.onPeers(this.players.size - 1);
  }

  private handleResize = (): void => {
    const rect = this.opts.surface.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    this.renderer.resize(w, h, this.camera);
    this.camera.snapTo(this.local.renderX, this.local.renderY);
  };

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      // Clamp so a backgrounded tab does not teleport everyone on return.
      const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
      this.last = now;
      this.update(dt, now);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private update(dt: number, now: number): void {
    this.updateLocal(dt);
    this.updateRemotes(dt);
    this.expireBubbles(Date.now());
    this.evictStalePeers(Date.now());

    this.camera.update(this.local.renderX, this.local.renderY, dt);
    this.maybeSend();

    this.renderer.render(
      this.room,
      this.camera,
      [...this.players.values()],
      this.local.id,
      this.localSpeed,
      this.input.usingTouch ? this.input.stick() : null,
      Date.now(),
    );
    void now;
  }

  private updateLocal(dt: number): void {
    const p = this.local;
    const v = this.input.vector();
    const mag = Math.hypot(v.x, v.y);
    this.localSpeed = mag * WALK_SPEED;

    // An emote plays through without interrupting movement.
    if (p.emote) {
      p.emoteTime += dt;
      const meta = this.assets.characters[p.character].meta;
      if (emoteFinished(meta, p.emote, p.emoteTime)) {
        p.emote = 0;
        p.emoteTime = 0;
      }
    }

    if (mag > 0) {
      const moved = moveWithCollision(
        this.room,
        p.x,
        p.y,
        v.x * WALK_SPEED * dt,
        v.y * WALK_SPEED * dt,
      );
      const actuallyMoved = moved.x !== p.x || moved.y !== p.y;
      p.x = moved.x;
      p.y = moved.y;
      p.dir = Math.abs(v.x) >= Math.abs(v.y) ? (v.x < 0 ? "left" : "right") : v.y < 0 ? "up" : "down";
      p.moving = actuallyMoved;
    } else {
      p.moving = false;
    }

    p.renderX = p.x;
    p.renderY = p.y;
    p.animTime += dt;

    // Two footfalls per eight-frame cycle, on the contact frames.
    if (p.moving) {
      const phase = Math.floor(p.animTime * 11) % 8;
      if ((phase === 1 || phase === 5) && phase !== this.lastStepPhase) {
        this.audio.step();
      }
      this.lastStepPhase = phase;
    } else {
      this.lastStepPhase = -1;
    }
  }

  private updateRemotes(dt: number): void {
    // Smoothly chase the last received position rather than snapping to each packet.
    const k = 1 - Math.exp(-REMOTE_SMOOTHING * dt);
    for (const p of this.players.values()) {
      if (p.id === this.local.id) continue;
      p.animTime += dt;
      if (p.emote) {
        p.emoteTime += dt;
        const meta = this.assets.characters[p.character].meta;
        if (emoteFinished(meta, p.emote, p.emoteTime)) {
          p.emote = 0;
          p.emoteTime = 0;
        }
      }

      const target = this.targets.get(p.id);
      if (!target) continue;
      p.x = target.x;
      p.y = target.y;
      const dist = Math.hypot(target.x - p.renderX, target.y - p.renderY);
      if (dist > REMOTE_SNAP_DIST) {
        p.renderX = target.x;
        p.renderY = target.y;
      } else {
        p.renderX += (target.x - p.renderX) * k;
        p.renderY += (target.y - p.renderY) * k;
      }
    }
  }

  private expireBubbles(now: number): void {
    for (const p of this.players.values()) {
      if (p.bubble && now > p.bubble.born + p.bubble.duration) p.bubble = null;
    }
  }

  /**
   * Removes anyone who stopped heartbeating. Presence normally reports a clean exit,
   * but a crashed tab or a phone that lost signal never sends one, and without this
   * their character would stand in the office forever.
   */
  private evictStalePeers(now: number): void {
    let dropped = false;
    for (const p of this.players.values()) {
      if (p.id === this.local.id) continue;
      if (now - p.lastSeen <= PEER_TIMEOUT_MS) continue;
      this.players.delete(p.id);
      this.targets.delete(p.id);
      dropped = true;
    }
    if (dropped) {
      this.audio.leave();
      this.reportPeers();
    }
  }

  private maybeSend(): void {
    const p = this.local;
    const state: PlayerState = {
      x: Math.round(p.x * 2) / 2,
      y: Math.round(p.y * 2) / 2,
      dir: p.dir,
      moving: p.moving,
      emote: p.emote,
    };
    const prev = this.lastSent;
    const now = performance.now();
    const changed =
      !prev ||
      prev.dir !== state.dir ||
      prev.moving !== state.moving ||
      prev.emote !== state.emote ||
      Math.abs(prev.x - state.x) > 0.4 ||
      Math.abs(prev.y - state.y) > 0.4;

    // Heartbeat even when idle so anyone who joins late learns where we are standing.
    if (!changed && now - this.lastSentAt < NET_IDLE_RESEND_MS) return;

    this.lastSent = state;
    this.lastSentAt = now;
    this.net.sendMove(state);
  }

  private showBubble(player: Player, text: string): void {
    const bubble: Bubble = {
      text,
      lines: this.renderer.font.wrap(text, BUBBLE_MAX_W),
      born: Date.now(),
      duration: bubbleDuration(text),
    };
    player.bubble = bubble;
  }

  // ---- public API used by the React shell --------------------------------

  say(raw: string): void {
    const text = raw.trim().slice(0, MAX_MESSAGE_LEN);
    if (!text) return;
    this.showBubble(this.local, text);
    this.audio.sendMessage();
    this.net.sendChat(text);
    this.opts.onChat({
      id: uid(),
      playerId: this.local.id,
      name: this.local.name,
      text,
      at: Date.now(),
      own: true,
    });
  }

  wave(): void {
    this.local.emote = EMOTE_WAVE;
    this.local.emoteTime = 0;
    this.lastSent = null; // push the emote out on the next tick
  }

  /** Called when a text field takes focus, so held keys do not stick. */
  releaseInput(): void {
    this.input.release();
  }

  get localId(): string {
    return this.local.id;
  }

  get localCharacter(): CharacterId {
    return this.local.character;
  }

  get facing(): Dir {
    return this.local.dir;
  }

  dispose(): void {
    this.stop();
    this.input.detach();
    this.resizeObserver?.disconnect();
    window.removeEventListener("orientationchange", this.handleResize);
    this.net.disconnect();
    this.audio.dispose();
  }
}
