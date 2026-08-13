/** No 0/O/1/I/5/S - these get read aloud and typed by hand. */
const ALPHABET = "ABCDEFGHJKLMNPQRTUVWXYZ2346789";
const CODE_LENGTH = 4;

export function makeRoomCode(): string {
  const bytes = new Uint32Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export function normalizeRoomCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

export function isValidRoomCode(raw: string): boolean {
  const code = normalizeRoomCode(raw);
  return code.length >= 3 && code.length <= 8;
}

export function sanitizeName(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9 ._-]/g, "").trim().slice(0, 12);
}

const KEY = "office-buds:profile";

/** Only the name is remembered; the character comes from the cast list. */
export interface Profile {
  name: string;
}

export function loadProfile(): Profile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Profile>;
    const name = sanitizeName(parsed.name ?? "");
    if (!name) return null;
    return { name };
  } catch {
    return null;
  }
}

export function saveProfile(profile: Profile): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    // Private browsing: not being able to remember the name is not worth failing over.
  }
}

export function inviteUrl(code: string): string {
  if (typeof window === "undefined") return `/o/${code}`;
  return `${window.location.origin}/o/${code}`;
}
