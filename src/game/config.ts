/** Tuning knobs for Office Buds. World units are game pixels, before display scaling. */

export const TILE = 16;

/** Character frames are 40x40 with the feet on the bottom edge and the body centred. */
export const FRAME = 40;
export const FOOT_Y = FRAME;
export const CENTER_X = FRAME / 2;

/** Feet-level box used for collision. Deliberately much smaller than the sprite so
 *  characters can tuck in behind desks instead of bumping into their own shoulders. */
export const BODY_W = 12;
export const BODY_H = 7;

export const WALK_SPEED = 66; // px/sec
/** walk_side/walk_down are authored at this fps; we scale it with real speed so the
 *  feet do not slide when the joystick is only pushed halfway. */
export const WALK_FPS_AT_FULL_SPEED = 11;

export const CAMERA_STIFFNESS = 9; // higher = snappier follow
export const CAMERA_DEADZONE = 1.2; // px, stops sub-pixel jitter when standing still

/** Display scale is chosen so roughly this many world px are visible vertically. */
export const TARGET_VIEW_H = 260;
export const MIN_SCALE = 2;
export const MAX_SCALE = 6;

/** Networking. Movement is lossy and frequent; chat is not. */
export const NET_SEND_HZ = 12;
export const NET_IDLE_RESEND_MS = 1000; // heartbeat so a late joiner sees everyone
export const REMOTE_SMOOTHING = 14; // exponential catch-up rate for remote players
export const REMOTE_SNAP_DIST = 90; // teleport instead of sliding across the room
/** Drop a peer we have not heard from in this long. Everyone heartbeats every
 *  NET_IDLE_RESEND_MS, so this only fires for a tab that died without saying goodbye
 *  - otherwise their character would stand in the office forever. */
export const PEER_TIMEOUT_MS = 15000;

/** Speech bubbles. Longer messages linger a little longer. */
export const BUBBLE_MIN_MS = 2600;
export const BUBBLE_PER_CHAR_MS = 55;
export const BUBBLE_MAX_MS = 7500;
export const BUBBLE_FADE_MS = 400;
export const BUBBLE_MAX_W = 104; // world px before wrapping
export const MAX_MESSAGE_LEN = 140;
export const CHAT_HISTORY_LIMIT = 60;

/**
 * Emotes are one-shot clips, referenced by clip name. Which ones a character actually
 * has depends on the art - Colin has a laptop animation, Michael does not - so the UI
 * reads the list off the atlas manifest rather than hard-coding it.
 */
export const EMOTES: Array<{ clip: string; label: string; glyph: string }> = [
  { clip: "wave", label: "WAVE", glyph: "\u270B" },
  { clip: "lift", label: "LIFT", glyph: "\u{1F4AA}" },
  { clip: "laptop", label: "LAPTOP", glyph: "\u{1F4BB}" },
];

/** How long a room-change announcement stays on screen. */
export const ANNOUNCE_MS = 3200;
/** Fade the screen through black for this long on each side of a room change. */
export const TRANSITION_MS = 260;

/** Touch joystick, in world px (it is drawn into the world canvas so it stays chunky). */
export const STICK_RADIUS = 22;
export const STICK_DEADZONE = 0.16;

export const PALETTE = {
  ink: "#22222d",
  cream: "#eae6da",
  wall: "#5f6782",
  floor: "#3a3d52",
  shadow: "rgba(12,12,22,0.38)",
  accent: "#6f2236",
  /** An unlit opening in the wall band, used for doorways. */
  doorway: "#1b1b24",
  doorwayLip: "#3a3a4a",
  bubbleBorder: "#22222d",
  bubbleFill: "#eae6da",
  nameFill: "#eae6da",
  nameShadow: "#22222d",
} as const;
