import { CAMERA_DEADZONE, CAMERA_STIFFNESS } from "../config";

/**
 * Follows a point with framerate-independent exponential smoothing, clamped to the
 * room. The final offset is rounded to whole world px so sprites never land on a
 * half pixel and shimmer.
 */
export class Camera {
  x = 0;
  y = 0;

  /** Viewport size in world px, set by the renderer each resize. */
  viewW = 160;
  viewH = 260;

  constructor(private roomW: number, private roomH: number) {}

  setRoom(w: number, h: number): void {
    this.roomW = w;
    this.roomH = h;
  }

  private clamp(x: number, y: number): { x: number; y: number } {
    // If the room is narrower than the viewport, centre it instead of clamping to 0.
    const cx =
      this.roomW <= this.viewW
        ? (this.roomW - this.viewW) / 2
        : Math.min(Math.max(x, 0), this.roomW - this.viewW);
    const cy =
      this.roomH <= this.viewH
        ? (this.roomH - this.viewH) / 2
        : Math.min(Math.max(y, 0), this.roomH - this.viewH);
    return { x: cx, y: cy };
  }

  snapTo(targetX: number, targetY: number): void {
    const c = this.clamp(targetX - this.viewW / 2, targetY - this.viewH / 2);
    this.x = c.x;
    this.y = c.y;
  }

  update(targetX: number, targetY: number, dt: number): void {
    const c = this.clamp(targetX - this.viewW / 2, targetY - this.viewH / 2);
    const k = 1 - Math.exp(-CAMERA_STIFFNESS * dt);
    const nx = this.x + (c.x - this.x) * k;
    const ny = this.y + (c.y - this.y) * k;
    // Snap the last fraction of a pixel so a standing player has a rock-still camera.
    this.x = Math.abs(c.x - nx) < CAMERA_DEADZONE / 100 ? c.x : nx;
    this.y = Math.abs(c.y - ny) < CAMERA_DEADZONE / 100 ? c.y : ny;
  }

  /** Integer world-space offset to subtract when drawing. */
  offset(): { x: number; y: number } {
    return { x: Math.round(this.x), y: Math.round(this.y) };
  }
}
