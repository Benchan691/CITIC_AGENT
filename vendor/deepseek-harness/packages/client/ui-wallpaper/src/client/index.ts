/**
 * Wallpaper plugin, browser half: Host-backed surface backgrounds with a
 * settings card (upload, crop, opacity, fit, position, preview).
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import {
  BUILTIN_SURFACE_IDS, WALLPAPER_SETTINGS_NAMESPACE, type WallpaperSettings,
} from '../wallpaper-settings.ts'
import { WallpaperRuntime, type IWallpaper } from './service.ts'
import { WallpaperCard, type WallpaperCardInjected } from './WallpaperCard.tsx'
import { en, SETTINGS_NS, zh, type WallpaperKey } from './locales.ts'

export {
  BUILTIN_SURFACE_IDS, DEFAULT_SURFACE_CONFIG, resolveSurfaceConfig, SURFACE_ASPECT,
  WALLPAPER_FITS, WALLPAPER_SETTINGS_NAMESPACE, WallpaperSettingsSchema,
  type BuiltinSurfaceId, type WallpaperFit, type WallpaperSettings, type WallpaperSurfaceConfig,
} from '../wallpaper-settings.ts'
export { WALLPAPER_HTTP_PREFIX, wallpaperAssetPath, MAX_WALLPAPER_BYTES } from '../wallpaper-paths.ts'
export {
  WallpaperRuntime, type IWallpaper, type WallpaperSnapshot, type WallpaperSurfaceRegistration,
} from './service.ts'
export { WallpaperCard, type WallpaperCardInjected, type WallpaperCardProps } from './WallpaperCard.tsx'
export { SETTINGS_NS, en, zh, type WallpaperKey } from './locales.ts'
export { coverScale, exportCroppedBlob } from './crop.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Cross-plugin wallpaper registry and Host-backed application. */
    wallpaper: IWallpaper
  }
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Wallpaper settings card copy. */
    'settings.wallpaper': WallpaperKey
  }
}

/** Services required by the wallpaper client plugin. */
export const inject = ['slots', 'locale', 'connection', 'remote', 'settingsScope']

/**
 * Provide ctx.wallpaper, register built-in surface labels, and seat the
 * settings card under the Host namespace key.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  const host = ctx.settingsScope.bind<WallpaperSettings>({ namespace: WALLPAPER_SETTINGS_NAMESPACE })
  const wallpaper = new WallpaperRuntime(ctx, host)
  ctx.provide('wallpaper', wallpaper)

  ctx.effect(() => ctx.locale.register(SETTINGS_NS, { zh, en }), 'ui-wallpaper: dictionaries')

  // Built-in surfaces always appear in the picker; UI plugins may re-register
  // the same ids (dispose-safe) or add custom ones.
  for (const id of BUILTIN_SURFACE_IDS) {
    ctx.effect(
      () => wallpaper.registerSurface({ id, label: `surface.${id}` }),
      `ui-wallpaper: builtin surface ${id}`,
    )
  }

  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item',
    key: WALLPAPER_SETTINGS_NAMESPACE,
    locale: SETTINGS_NS,
    inject: (): WallpaperCardInjected => ({
      hooks: { wallpaper },
      assetUrl: assetId => wallpaper.assetUrl(assetId),
      clearSurface: (surfaceId, deleteAsset) => wallpaper.clearSurface(surfaceId, deleteAsset),
      setSurfaceConfig: (surfaceId, config) => wallpaper.setSurfaceConfig(surfaceId, config),
      uploadAsset: blob => wallpaper.uploadAsset(blob),
    }),
  }, WallpaperCard))
}
