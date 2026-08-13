"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The invitation.
 *
 * This is the first thing anybody sees when they open a link, so it is doing the job a
 * screenshot would normally do: say what this is and make you want to type your name.
 *
 * It is a real 3D card - `preserve-3d`, a perspective camera, and a stack of faces at
 * descending translateZ that give it actual thickness you can see the side of when it
 * turns. The alternative was a flat card with a drop shadow, which reads as 3D only from
 * dead ahead and falls apart the moment it tilts.
 *
 * The thickness is built from hard-edged slabs in darkening colours rather than a
 * gradient, because everything else in this game is hard-edged and a soft bevel here
 * would look like it came from a different program.
 *
 * It drifts on its own, and follows a pointer or a phone being tilted. Both are turned
 * off under `prefers-reduced-motion`, where it simply sits still and legible.
 */

/** Slabs behind the face, in px of depth. More layers than this is not visible. */
const DEPTH = [3, 6, 9, 12, 15, 18];

/** How far the card leans, in degrees, at the edge of its container. */
const MAX_TILT = 14;

export function InviteCard({ roomCode }: { roomCode?: string }) {
  const tiltRef = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const [live, setLive] = useState(false);

  // Nothing moves for someone who asked for less motion. Checked once on mount rather
  // than only in CSS, so the pointer and gyro handlers are never even attached.
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setLive(!query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  const lean = useCallback((x: number, y: number) => {
    const el = tiltRef.current;
    if (!el) return;
    // Batched into one frame: pointermove fires far faster than the screen refreshes,
    // and writing the custom property on every event does the layout work repeatedly for
    // a single painted result.
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      el.style.setProperty("--lean-y", `${x.toFixed(2)}deg`);
      el.style.setProperty("--lean-x", `${y.toFixed(2)}deg`);
    });
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!live) return;
      const box = e.currentTarget.getBoundingClientRect();
      // -1..1 from the middle of the card, so the lean follows where you actually are
      // rather than how big the card happens to be.
      const nx = (e.clientX - box.left) / box.width - 0.5;
      const ny = (e.clientY - box.top) / box.height - 0.5;
      lean(nx * MAX_TILT * 2, -ny * MAX_TILT * 2);
    },
    [live, lean],
  );

  const onPointerLeave = useCallback(() => lean(0, 0), [lean]);

  // A phone has no pointer, so it leans with the handset instead. No permission is
  // requested - iOS requires a tap for that and interrupting the invitation with a
  // permission dialog is a worse trade than the card simply drifting on its own.
  useEffect(() => {
    if (!live) return;
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma === null || e.beta === null) return;
      const clamp = (v: number) => Math.max(-MAX_TILT, Math.min(MAX_TILT, v));
      lean(clamp(e.gamma / 2), clamp((e.beta - 45) / 2));
    };
    window.addEventListener("deviceorientation", onTilt);
    return () => window.removeEventListener("deviceorientation", onTilt);
  }, [live, lean]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  return (
    <div className="invite" onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
      <div className="invite__tilt" ref={tiltRef}>
        <div className={`invite__float${live ? "" : " invite__float--still"}`}>
          {/* The side of the card. Drawn back to front so the nearest slab wins. */}
          {DEPTH.map((z) => (
            <div key={z} className="invite__slab" style={{ transform: `translateZ(-${z}px)` }} />
          ))}

          <div className="invite__face">
            <span className="invite__kicker">You&rsquo;re invited to join</span>
            <strong className="invite__title">OFFICE BUDS</strong>
            <span className="invite__rule" />
            <span className="invite__meta">
              {roomCode ? `MEETING ${roomCode}` : "A TINY PLACE TO HANG OUT"}
            </span>
            {/* Sweeps across every few seconds. Purely decorative, so it is hidden from
                assistive tech and stopped along with everything else. The wrapper does
                the clipping, because overflow on the face itself would flatten the 3D. */}
            <span className="invite__sheen-clip" aria-hidden="true">
              <span className="invite__sheen" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
