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
/** Held Shift, or the stick at full travel. Only Colin has the sheet for it so far. */
export const RUN_SPEED = 104;
export const RUN_FPS = 14;
/** How far the stick has to be pushed before it counts as asking to run. */
export const RUN_STICK = 0.92;
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
 * Doors. They start easing open this far out and are wide open at the near distance,
 * which means one opens as you walk up to it rather than snapping when you touch it.
 */
export const DOOR_NEAR = 15;
export const DOOR_FAR = 40;

/** How long after getting up you can reach whoever put you down, from anywhere. */
export const REVENGE_MS = 15000;
/** How many deaths the corner of the screen remembers. */
export const FEED_LIMIT = 5;
/** How long a line stays in the feed. */
export const FEED_MS = 14000;

/** How close you have to stand to somebody to be offered a way to end them. */
export const DOOM_REACH = 44;

/** How close your feet have to be to a prop's anchor before you can pick it up. */
export const REACH_DIST = 26;
/** How far above a carrier's feet a held item is drawn, arms overhead. */
export const CARRY_LIFT = 39;
/** The same, for a character with no lift clip: held at chest height, arms down. */
export const CARRY_LIFT_LOW = 24;

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
