/** Shared wallpaper HTTP path helpers (browser-safe; no Node imports). */

/** Maximum accepted upload size in bytes. */
export const MAX_WALLPAPER_BYTES = 5 * 1024 * 1024

/** Media types accepted for wallpaper uploads. */
export const WALLPAPER_MEDIA_TYPES = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
} as const

/** One accepted wallpaper media type. */
export type WallpaperMediaType = keyof typeof WALLPAPER_MEDIA_TYPES

/** HTTP route prefix that serves and mutates wallpaper assets. */
export const WALLPAPER_HTTP_PREFIX = '/ui-wallpapers'

/**
 * Build the public URL path for one asset.
 * @param assetId - durable asset id.
 * @returns pathname served by the Host route.
 */
export function wallpaperAssetPath(assetId: string): string {
  return `${WALLPAPER_HTTP_PREFIX}/${assetId}`
}

/**
 * Narrow an uploaded Content-Type to an accepted wallpaper media type.
 * @param value - raw Content-Type or mediaType field.
 * @returns the media type, or undefined when unsupported.
 */
export function parseWallpaperMediaType(value: string | undefined): WallpaperMediaType | undefined {
  if (value === undefined) return undefined
  const base = (value.split(';', 1)[0] ?? '').trim().toLowerCase()
  if (base === 'image/jpg') return 'image/jpeg'
  return Object.prototype.hasOwnProperty.call(WALLPAPER_MEDIA_TYPES, base)
    ? base as WallpaperMediaType
    : undefined
}
