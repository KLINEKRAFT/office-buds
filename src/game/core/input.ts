import { STICK_DEADZONE } from "../config";

export interface StickView {
  active: boolean;
  /** Origin and knob, in CSS px relative to the canvas. */
  originX: number;
  originY: number;
  knobX: number;
  knobY: number;
}

const KEY_VECTORS: Record<string, [number, number]> = {
  arrowup: [0, -1],
  w: [0, -1],
  arrowdown: [0, 1],
  s: [0, 1],
  arrowleft: [-1, 0],
  a: [-1, 0],
  arrowright: [1, 0],
  d: [1, 0],
};

/** Max knob travel from the touch origin, in CSS px. */
const STICK_RANGE = 46;

/** True when a keystroke belongs to a text field rather than to the game. */
function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

/**
 * Keyboard plus a floating touch stick. The stick has no fixed home: it appears
 * wherever the thumb lands, so it never sits on top of the artwork and works the same
 * whichever hand you hold the phone in.
 */
export class Input {
  private readonly keys = new Set<string>();
  private touchId: number | null = null;
  private originX = 0;
  private originY = 0;
  private knobX = 0;
  private knobY = 0;
  private detachers: Array<() => void> = [];

  /** Set while a touch stick is in use, so the game can hide the desktop hint. */
  usingTouch = false;

  attach(surface: HTMLElement): void {
    const onKeyDown = (e: KeyboardEvent) => {
      // Never swallow keys aimed at a text field. WASD and the arrows are movement keys,
      // and preventDefault on them would stop those letters being typed into the chat
      // box at all - you could not write "was" or move the caret.
      if (isTyping(e.target)) return;
      const k = e.key.toLowerCase();
      if (KEY_VECTORS[k]) {
        this.keys.add(k);
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      this.keys.delete(e.key.toLowerCase());
    };
    // Losing focus mid-key would otherwise leave the player walking forever.
    const onBlur = () => this.keys.clear();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    const localPoint = (t: Touch) => {
      const r = surface.getBoundingClientRect();
      return { x: t.clientX - r.left, y: t.clientY - r.top };
    };

    const onTouchStart = (e: TouchEvent) => {
      if (this.touchId !== null) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const p = localPoint(t);
      this.touchId = t.identifier;
      this.usingTouch = true;
      this.originX = this.knobX = p.x;
      this.originY = this.knobY = p.y;
      e.preventDefault();
    };

    const onTouchMove = (e: TouchEvent) => {
      if (this.touchId === null) return;
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier !== this.touchId) continue;
        const p = localPoint(t);
        this.knobX = p.x;
        this.knobY = p.y;
        e.preventDefault();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (this.touchId === null) return;
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === this.touchId) this.touchId = null;
      }
    };

    surface.addEventListener("touchstart", onTouchStart, { passive: false });
    surface.addEventListener("touchmove", onTouchMove, { passive: false });
    surface.addEventListener("touchend", onTouchEnd);
    surface.addEventListener("touchcancel", onTouchEnd);

    this.detachers = [
      () => window.removeEventListener("keydown", onKeyDown),
      () => window.removeEventListener("keyup", onKeyUp),
      () => window.removeEventListener("blur", onBlur),
      () => surface.removeEventListener("touchstart", onTouchStart),
      () => surface.removeEventListener("touchmove", onTouchMove),
      () => surface.removeEventListener("touchend", onTouchEnd),
      () => surface.removeEventListener("touchcancel", onTouchEnd),
    ];
  }

  detach(): void {
    for (const d of this.detachers) d();
    this.detachers = [];
    this.keys.clear();
    this.touchId = null;
  }

  /** Releases the stick, e.g. when the chat input steals focus. */
  release(): void {
    this.keys.clear();
    this.touchId = null;
  }

  /** Movement vector with magnitude 0..1. Touch wins when both are active. */
  vector(): { x: number; y: number } {
    if (this.touchId !== null) {
      const dx = this.knobX - this.originX;
      const dy = this.knobY - this.originY;
      const len = Math.hypot(dx, dy);
      if (len < STICK_RANGE * STICK_DEADZONE) return { x: 0, y: 0 };
      const mag = Math.min(1, len / STICK_RANGE);
      return { x: (dx / len) * mag, y: (dy / len) * mag };
    }

    let x = 0;
    let y = 0;
    for (const k of this.keys) {
      const v = KEY_VECTORS[k];
      if (!v) continue;
      x += v[0];
      y += v[1];
    }
    const len = Math.hypot(x, y);
    if (len === 0) return { x: 0, y: 0 };
    return { x: x / len, y: y / len };
  }

  stick(): StickView {
    const dx = this.knobX - this.originX;
    const dy = this.knobY - this.originY;
    const len = Math.hypot(dx, dy);
    const clamp = len > STICK_RANGE ? STICK_RANGE / len : 1;
    return {
      active: this.touchId !== null,
      originX: this.originX,
      originY: this.originY,
      knobX: this.originX + dx * clamp,
      knobY: this.originY + dy * clamp,
    };
  }
}
