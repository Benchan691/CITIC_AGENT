/** Wallpaper preferences stored in the Host user-settings document. */

import z from '@deepseek-ai/schemastery'

/** Settings namespace owned by the wallpaper plugin. */
export const WALLPAPER_SETTINGS_NAMESPACE = 'ui-wallpaper'

/** Built-in surface ids applied by the shipped shell plugins. */
export const BUILTIN_SURFACE_IDS = ['shell', 'sidebar', 'conversation'] as const

/** One built-in wallpaper surface id. */
export type BuiltinSurfaceId = typeof BUILTIN_SURFACE_IDS[number]

/** How the image fills its surface. */
export const WALLPAPER_FITS = ['cover', 'contain', 'fill'] as const

/** One wallpaper fit mode. */
export type WallpaperFit = typeof WALLPAPER_FITS[number]

/** Preview aspect hints used by the settings card crop/preview panes. */
export const SURFACE_ASPECT: Record<BuiltinSurfaceId, number> = {
  shell: 16 / 10,
  sidebar: 9 / 16,
  conversation: 16 / 11,
}

/** Per-surface wallpaper configuration. */
export interface WallpaperSurfaceConfig {
  /** Host asset id when an image is assigned. */
  assetId?: string
  /** Image opacity in `[0, 1]`. */
  opacity: number
  /** Theme-color scrim strength in `[0, 1]` for text legibility. */
  scrim: number
  /** How the image fills the surface. */
  fit: WallpaperFit
  /** Background position percentages after pan/crop. */
  position: { x: number; y: number }
  /** Whether this surface paints its wallpaper. */
  enabled: boolean
}

/** Durable wallpaper section shared by the Host schema and the browser scope. */
export interface WallpaperSettings {
  /** Per-surface configuration keyed by surface id. */
  surfaces: Record<string, WallpaperSurfaceConfig>
}

/** Default configuration for a surface with no user override. */
export const DEFAULT_SURFACE_CONFIG: WallpaperSurfaceConfig = {
  opacity: 0.4,
  scrim: 0.55,
  fit: 'cover',
  position: { x: 50, y: 50 },
  enabled: true,
}

const SurfaceConfigSchema: z<WallpaperSurfaceConfig> = z.object({
  assetId: z.string(),
  opacity: z.number().min(0).max(1).default(DEFAULT_SURFACE_CONFIG.opacity),
  scrim: z.number().min(0).max(1).default(DEFAULT_SURFACE_CONFIG.scrim),
  fit: z.union([...WALLPAPER_FITS]).default(DEFAULT_SURFACE_CONFIG.fit),
  position: z.object({
    x: z.number().min(0).max(100).default(DEFAULT_SURFACE_CONFIG.position.x),
    y: z.number().min(0).max(100).default(DEFAULT_SURFACE_CONFIG.position.y),
  }).default(DEFAULT_SURFACE_CONFIG.position),
  enabled: z.boolean().default(DEFAULT_SURFACE_CONFIG.enabled),
})

/** Durable wallpaper schema; also the wire envelope the browser scope validates against. */
export const WallpaperSettingsSchema: z<WallpaperSettings> = z.object({
  surfaces: z.dict(SurfaceConfigSchema).default({}),
})

/**
 * Merge a partial surface config onto the defaults.
 * @param value - stored or staged surface config.
 * @returns a complete surface config.
 */
export function resolveSurfaceConfig(value: WallpaperSurfaceConfig | undefined): WallpaperSurfaceConfig {
  if (value === undefined) {
    return {
      opacity: DEFAULT_SURFACE_CONFIG.opacity,
      scrim: DEFAULT_SURFACE_CONFIG.scrim,
      fit: DEFAULT_SURFACE_CONFIG.fit,
      position: { ...DEFAULT_SURFACE_CONFIG.position },
      enabled: DEFAULT_SURFACE_CONFIG.enabled,
    }
  }
  const next: WallpaperSurfaceConfig = {
    opacity: value.opacity,
    scrim: value.scrim,
    fit: value.fit,
    position: { x: value.position.x, y: value.position.y },
    enabled: value.enabled,
  }
  if (value.assetId !== undefined) next.assetId = value.assetId
  return next
}
