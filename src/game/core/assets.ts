import type { CharacterId } from "../types";

export interface ClipMeta {
  start: number;
  count: number;
  fps: number;
  loop: boolean;
}

export interface CharacterMeta {
  label: string;
  image: string;
  frame: number;
  cols: number;
  total: number;
  box: { x: number; y: number; w: number; h: number };
  clips: Record<string, ClipMeta>;
}

export interface SpriteRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GlyphMeta {
  x: number;
  y: number;
  w: number;
  left: number;
  advance: number;
}

export interface FontMeta {
  image: string;
  lineHeight: number;
  spacing: number;
  glyphs: Record<string, GlyphMeta>;
}

export interface Atlas {
  image: HTMLImageElement;
  sprites: Record<string, SpriteRect>;
}

export interface Assets {
  characters: Record<CharacterId, { meta: CharacterMeta; image: HTMLImageElement }>;
  props: Atlas;
  /** Outdoor art. Loaded after first paint, so the office is playable sooner. */
  village: Atlas | null;
  /** 9px face: chat, speech bubbles, prompts. */
  font: { image: HTMLImageElement; meta: FontMeta };
  /** 7px face, used only for the understated name plates. */
  fontSmall: { image: HTMLImageElement; meta: FontMeta };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${src}`));
    img.src = src;
  });
}

async function loadJSON<T>(src: string): Promise<T> {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`failed to load ${src}: ${res.status}`);
  return (await res.json()) as T;
}

let cached: Promise<Assets> | null = null;

/** Loads every atlas once and memoises it, so remounting the game is instant. */
export function loadAssets(): Promise<Assets> {
  if (cached) return cached;
  cached = (async () => {
    const [charManifest, propManifest, fontMeta, fontSmallMeta] = await Promise.all([
      loadJSON<{ frame: number; characters: Record<string, CharacterMeta> }>("/assets/characters.json"),
      loadJSON<{ image: string; sprites: Record<string, SpriteRect> }>("/assets/props.json"),
      loadJSON<FontMeta>("/assets/font.json"),
      loadJSON<FontMeta>("/assets/font_small.json"),
    ]);

    const ids = Object.keys(charManifest.characters) as CharacterId[];
    const [propImage, fontImage, fontSmallImage, ...charImages] = await Promise.all([
      loadImage(propManifest.image),
      loadImage(fontMeta.image),
      loadImage(fontSmallMeta.image),
      ...ids.map((id) => loadImage(charManifest.characters[id].image)),
    ]);

    const characters = {} as Assets["characters"];
    ids.forEach((id, i) => {
      characters[id] = { meta: charManifest.characters[id], image: charImages[i] };
    });

    return {
      characters,
      props: { image: propImage, sprites: propManifest.sprites },
      village: null,
      font: { image: fontImage, meta: fontMeta },
      fontSmall: { image: fontSmallImage, meta: fontSmallMeta },
    };
  })();
  return cached;
}


let villagePromise: Promise<Atlas> | null = null;

/**
 * Loads the outdoor atlas. It is ~70 KB and only needed once somebody steps outside,
 * so the office does not wait on it; the game kicks this off in the background right
 * after startup and awaits it on the first transition, by which point it is usually
 * already there.
 */
export function loadVillage(assets: Assets): Promise<Atlas> {
  if (assets.village) return Promise.resolve(assets.village);
  if (!villagePromise) {
    villagePromise = (async () => {
      const manifest = await loadJSON<{ image: string; sprites: Record<string, SpriteRect> }>(
        "/assets/village.json",
      );
      const image = await loadImage(manifest.image);
      return { image, sprites: manifest.sprites };
    })();
  }
  return villagePromise.then((atlas) => {
    assets.village = atlas;
    return atlas;
  });
}
