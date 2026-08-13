/**
 * A digest of everything in public/assets, written by tools/build_version.py.
 *
 * Appended to every asset request so the URL changes whenever the art does. Without it
 * a browser can hold a cached atlas from an hour ago, pair it with code deployed a
 * minute ago, and fail to start on a sprite that exists perfectly well on the server.
 *
 * DO NOT EDIT. Run `npm run assets`.
 */
export const ASSET_VERSION = "a786de739f14";
