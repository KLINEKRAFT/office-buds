import {
  ANNOUNCE_MS,
  BUBBLE_MAX_MS,
  BUBBLE_MAX_W,
  BUBBLE_MIN_MS,
  BUBBLE_PER_CHAR_MS,
  EMOTES,
  MAX_MESSAGE_LEN,
  NET_IDLE_RESEND_MS,
  PEER_TIMEOUT_MS,
  REMOTE_SMOOTHING,
  REMOTE_SNAP_DIST,
  TARGET_VIEW_H,
  TRANSITION_MS,
  WALK_SPEED,
} from "./config";
import { availableEmotes, emoteFinished } from "./core/anim";
import { loadAssets, loadVillage, type Assets } from "./core/assets";
import { Audio } from "./core/audio";
import { Camera } from "./core/camera";
import { Input } from "./core/input";
import { Renderer } from "./render/renderer";
import { createNet, type Net, type NetStatus } from "./net";
import type { SeatKind } from "./cast";
import type { Bubble, ChatMessage, CharacterId, Dir, Player, PlayerState, Vec2 } from "./types";
import { buildRoom, type BuiltRoom } from "./world/build";
import { bodyRect, findFreeSpawn, moveWithCollision } from "./world/collision";
import { DEFAULT_ROOM, getRoom, matchSayTrigger } from "./world";

export interface GameOptions {
  canvas: HTMLCanvasElement;
  surface: HTMLElement;
  roomCode: string;
  name: string;
  character: CharacterId;
  /** Decides where you land: Colin gets the desk, everyone else the sofa. */
  seat: SeatKind;
  startRoom?: string;
  onChat(message: ChatMessage): void;
  onStatus(status: NetStatus, detail?: string): void;
  onPeers(count: number): void;
  /** Fires when the place changes, so the HUD can name it. */
  onPlace(roomName: string): void;
  /** A short banner, e.g. "COLIN TOOK EVERYONE OUTSIDE". */
  onAnnounce(text: string): void;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function bubbleDuration(text: string): number {
  return Math.min(BUBBLE_MAX_MS, BUBBLE_MIN_MS + text.length * BUBBLE_PER_CHAR_MS);
}

/**
 * Where somebody starts. Rooms with assigned seating put Colin behind the desk and
 * everyone else on the sofa, so arriving already looks like a meeting; rooms without
 * seats fall back to their ordinary join spawns.
 */
function startPlace(room: BuiltRoom, kind: SeatKind): Vec2 & { dir: Dir } {
  // First seat of the right kind, not a random one: Colin belongs at the desk and a
  // guest belongs on the sofa beside it. findFreeSpawn nudges the rare second guest off
  // to the spare chair rather than standing them inside somebody.
  const seat = (room.def.seats ?? []).find((s) => s.kind === kind);
  if (seat) return { x: seat.x, y: seat.y, dir: seat.dir };
  const joinable = room.def.spawns.slice(0, room.def.joinSpawns ?? room.def.spawns.length);
  const spawn = joinable[Math.floor(Math.random() * joinable.length)] ??
    { x: room.width / 2, y: room.height / 2 };
  return { x: spawn.x, y: spawn.y, dir: "down" };
}

function overlaps(a: { x: number; y: number; w: number; h: number }, b: typeof a): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
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

  private room: BuiltRoom;
  private lastSent: PlayerState | null = null;
  private lastSentAt = 0;
  private lastStepPhase = -1;
  private localSpeed = 0;
  private resizeObserver: ResizeObserver | null = null;

  /** 0 clear, 1 black. Room changes fade out, swap, fade back in. */
  private fade = 0;
  private pending: { to: string; spawn: number } | null = null;
  /**
   * Stops an exit firing the instant you arrive. Starts non-zero because a spawn can
   * legitimately sit close to a doorway, and stepping through it on frame one would
   * bounce you straight back out.
   */
  private exitCooldown = 0.9;

  private constructor(
    private readonly opts: GameOptions,
    private readonly assets: Assets,
    room: BuiltRoom,
  ) {
    this.room = room;
    const id = uid();
    const start = startPlace(room, opts.seat);
    const free = findFreeSpawn(room, start.x, start.y);

    this.local = {
      id,
      name: opts.name,
      character: opts.character,
      x: free.x,
      y: free.y,
      renderX: free.x,
      renderY: free.y,
      dir: start.dir,
      moving: false,
      emote: "",
      room: room.def.id,
      animTime: 0,
      emoteTime: 0,
      bubble: null,
      lastSeen: Date.now(),
    };
    this.players.set(id, this.local);

    this.camera = new Camera(room.width, room.height);
    this.renderer = new Renderer(opts.canvas, assets);
    this.renderer.targetViewH = room.def.targetViewH ?? this.renderer.targetViewH;
    this.net = createNet(opts.roomCode, { id, name: opts.name, character: opts.character });
  }

  static async create(opts: GameOptions): Promise<Game> {
    const assets = await loadAssets();
    const def = getRoom(opts.startRoom ?? DEFAULT_ROOM);
    // Starting room's art has to be in hand before it can be built. Normally that is
    // the office, whose atlas came with loadAssets; ?room=outside needs the other one.
    if (def.atlas === "village") await loadVillage(assets);
    const room = buildRoom(def, assets);
    const game = new Game(opts, assets, room);
    await game.init();
    return game;
  }

  private async init(): Promise<void> {
    this.input.attach(this.opts.surface);
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
    this.opts.onPlace(this.room.def.name);

    // Pull the outdoor atlas in the background so stepping outside is instant.
    void loadVillage(this.assets).catch(() => {});

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
          emote: "",
          room: this.local.room,
          animTime: 0,
          emoteTime: 0,
          bubble: null,
          lastSeen: Date.now(),
        });
        this.audio.join();
        this.reportPeers();
        this.lastSent = null; // push our position so the newcomer sees us
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
        p.room = state.room;
        p.lastSeen = Date.now();
        if (state.emote && state.emote !== p.emote) {
          p.emote = state.emote;
          p.emoteTime = 0;
        } else if (!state.emote) {
          p.emote = "";
        }
        this.targets.set(id, { x: state.x, y: state.y });
        this.reportPeers();
      },
      onChat: (id, text, at) => {
        const p = this.players.get(id);
        if (!p) return;
        this.showBubble(p, text);
        // Only chime for people you are actually standing with.
        if (p.room === this.local.room) this.audio.receiveMessage();
        this.opts.onChat({ id: uid(), playerId: id, name: p.name, text, at, own: false });
      },
      onGo: (id, room, spawn, announce) => {
        const p = this.players.get(id);
        // Somebody in another room deciding to move is not our business.
        if (p && p.room !== this.local.room) return;
        if (announce) this.opts.onAnnounce(announce.replace("{name}", p?.name ?? "SOMEONE"));
        this.beginTransition(room, spawn);
      },
    });
  }

  private reportPeers(): void {
    let here = 0;
    for (const p of this.players.values()) {
      if (p.id !== this.local.id && p.room === this.local.room) here++;
    }
    this.opts.onPeers(here);
  }

  private handleResize = (): void => {
    const rect = this.opts.surface.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    this.renderer.resize(w, h, this.camera, this.room.width, this.room.height);
    const focus = this.cameraFocus();
    this.camera.snapTo(focus.x, focus.y);
  };

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
      this.last = now;
      this.update(dt);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  // ---- room changes --------------------------------------------------------

  /** Starts a fade; the actual swap happens once the screen is covered. */
  private beginTransition(to: string, spawn: number): void {
    if (this.pending) return;
    this.pending = { to, spawn };
    // Kick the atlas load now so the fade covers the download too.
    void loadVillage(this.assets).catch(() => {});
  }

  private applyTransition(): boolean {
    const target = this.pending;
    if (!target) return true;
    const def = getRoom(target.to);
    // Wait, still covered, if the room's art has not arrived yet.
    if (def.atlas === "village" && !this.assets.village) return false;

    this.room = buildRoom(def, this.assets);
    this.camera.setRoom(this.room.width, this.room.height);
    // Rooms may ask for a different zoom; re-derive the scale before repositioning.
    this.renderer.targetViewH = def.targetViewH ?? TARGET_VIEW_H;
    this.handleResize();

    const spawn = this.room.def.spawns[target.spawn] ?? this.room.def.spawns[0];
    const free = findFreeSpawn(this.room, spawn.x, spawn.y);
    const p = this.local;
    p.x = p.renderX = free.x;
    p.y = p.renderY = free.y;
    p.room = def.id;
    p.dir = "down";
    p.moving = false;
    p.emote = "";

    // Anyone still elsewhere keeps their own position; we simply stop drawing them.
    this.camera.snapTo(p.renderX, p.renderY);
    this.exitCooldown = 0.9;
    this.pending = null;
    this.lastSent = null;
    this.opts.onPlace(def.name);
    this.reportPeers();
    return true;
  }

  private checkExits(): void {
    if (this.exitCooldown > 0 || this.pending) return;
    const body = bodyRect(this.local.x, this.local.y);
    for (const exit of this.room.def.exits ?? []) {
      if (overlaps(body, exit.rect)) {
        this.beginTransition(exit.to, exit.spawn ?? 0);
        return;
      }
    }
  }

  // ---- frame ----------------------------------------------------------------

  private update(dt: number): void {
    this.exitCooldown = Math.max(0, this.exitCooldown - dt);

    // Fade out, swap, fade back in. Holding at 1 covers a slow atlas load.
    const step = dt / (TRANSITION_MS / 1000);
    if (this.pending) {
      this.fade = Math.min(1, this.fade + step);
      if (this.fade >= 1) this.applyTransition();
    } else if (this.fade > 0) {
      this.fade = Math.max(0, this.fade - step);
    }

    const frozen = this.pending !== null;
    if (!frozen) {
      this.updateLocal(dt);
      this.checkExits();
    }
    this.updateRemotes(dt);
    this.expireBubbles(Date.now());
    this.evictStalePeers(Date.now());

    const focus = this.cameraFocus();
    this.camera.update(focus.x, focus.y, dt);
    this.maybeSend();

    // Only draw people standing in the same place as you.
    const here = [...this.players.values()].filter((p) => p.room === this.local.room);

    this.renderer.render(
      this.room,
      this.camera,
      here,
      this.local.id,
      this.localSpeed,
      this.input.usingTouch ? this.input.stick() : null,
      Date.now(),
      this.fade,
    );
  }

  /**
   * What the camera looks at. Alone, that is simply you. With company it drifts toward
   * the middle of the group, so in a room built for a meeting you can always see who you
   * are talking to - following one character strictly put the other one off screen.
   *
   * The drift is capped at a fraction of the view from you in each axis, so somebody
   * wandering off can never push you out of your own frame.
   */
  private cameraFocus(): { x: number; y: number } {
    const here = [...this.players.values()].filter((p) => p.room === this.local.room);
    if (here.length < 2) return { x: this.local.renderX, y: this.local.renderY };

    let sx = 0;
    let sy = 0;
    for (const p of here) {
      sx += p.renderX;
      sy += p.renderY;
    }
    const avgX = sx / here.length;
    const avgY = sy / here.length;
    const limitX = this.camera.viewW * 0.4;
    const limitY = this.camera.viewH * 0.3;
    return {
      x: Math.min(Math.max(avgX, this.local.renderX - limitX), this.local.renderX + limitX),
      y: Math.min(Math.max(avgY, this.local.renderY - limitY), this.local.renderY + limitY),
    };
  }

  private updateLocal(dt: number): void {
    const p = this.local;
    const v = this.input.vector();
    const mag = Math.hypot(v.x, v.y);
    this.localSpeed = mag * WALK_SPEED;

    if (p.emote) {
      p.emoteTime += dt;
      const meta = this.assets.characters[p.character].meta;
      // Moving puts the laptop away.
      if (mag > 0 || emoteFinished(meta, p.emote, p.emoteTime)) {
        p.emote = "";
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
      p.dir =
        Math.abs(v.x) >= Math.abs(v.y) ? (v.x < 0 ? "left" : "right") : v.y < 0 ? "up" : "down";
      p.moving = actuallyMoved;
    } else {
      p.moving = false;
    }

    p.renderX = p.x;
    p.renderY = p.y;
    p.animTime += dt;

    if (p.moving) {
      const phase = Math.floor(p.animTime * 11) % 8;
      if ((phase === 1 || phase === 5) && phase !== this.lastStepPhase) this.audio.step();
      this.lastStepPhase = phase;
    } else {
      this.lastStepPhase = -1;
    }
  }

  private updateRemotes(dt: number): void {
    const k = 1 - Math.exp(-REMOTE_SMOOTHING * dt);
    for (const p of this.players.values()) {
      if (p.id === this.local.id) continue;
      p.animTime += dt;
      if (p.emote) {
        p.emoteTime += dt;
        const meta = this.assets.characters[p.character].meta;
        if (emoteFinished(meta, p.emote, p.emoteTime)) {
          p.emote = "";
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
      room: p.room,
    };
    const prev = this.lastSent;
    const now = performance.now();
    const changed =
      !prev ||
      prev.dir !== state.dir ||
      prev.moving !== state.moving ||
      prev.emote !== state.emote ||
      prev.room !== state.room ||
      Math.abs(prev.x - state.x) > 0.4 ||
      Math.abs(prev.y - state.y) > 0.4;

    if (!changed && now - this.lastSentAt < NET_IDLE_RESEND_MS) return;

    this.lastSent = state;
    this.lastSentAt = now;
    this.net.sendMove(state);
  }

  private showBubble(player: Player, text: string): void {
    player.bubble = {
      text,
      lines: this.renderer.font.wrap(text, BUBBLE_MAX_W),
      born: Date.now(),
      duration: bubbleDuration(text),
    } satisfies Bubble;
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

    // Saying the magic words takes the whole room with you.
    const trigger = matchSayTrigger(this.room.def, text);
    if (trigger) {
      const announce = trigger.announce.replace("{name}", this.local.name);
      this.net.sendGo(trigger.to, trigger.spawn ?? 0, trigger.announce);
      this.opts.onAnnounce(announce);
      // Let the bubble land before the screen goes dark.
      window.setTimeout(() => this.beginTransition(trigger.to, trigger.spawn ?? 0), 650);
    }
  }

  emote(clip: string): void {
    const meta = this.assets.characters[this.local.character].meta;
    if (!meta.clips[clip]) return;
    this.local.emote = clip;
    this.local.emoteTime = 0;
    this.lastSent = null;
  }

  /** Emotes this player's character actually has art for. */
  get emotes(): Array<{ clip: string; label: string; glyph: string }> {
    const meta = this.assets.characters[this.local.character].meta;
    const have = new Set(availableEmotes(meta, EMOTES.map((e) => e.clip)));
    return EMOTES.filter((e) => have.has(e.clip));
  }

  /** Called when a text field takes focus, so held keys do not stick. */
  releaseInput(): void {
    this.input.release();
  }

  get localId(): string {
    return this.local.id;
  }

  get placeName(): string {
    return this.room.def.name;
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

export { ANNOUNCE_MS };
