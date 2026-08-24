/** Schema and crop helpers for the wallpaper plugin. */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SURFACE_CONFIG, resolveSurfaceConfig, type WallpaperSettings, WallpaperSettingsSchema,
} from '../src/wallpaper-settings.ts'
import { wallpaperAssetPath, WALLPAPER_HTTP_PREFIX } from '../src/wallpaper-paths.ts'
import { clampCropState, coverScale } from '../src/client/crop.ts'

describe('WallpaperSettingsSchema', () => {
  it('defaults to an empty surfaces map', () => {
    const value = WallpaperSettingsSchema({} as WallpaperSettings)
    expect(value.surfaces).toEqual({})
  })

  it('accepts a populated surface config', () => {
    const value = WallpaperSettingsSchema({
      surfaces: {
        shell: {
          assetId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          opacity: 0.5,
          fit: 'contain',
          position: { x: 20, y: 80 },
          enabled: true,
        },
      },
    } as unknown as WallpaperSettings)
    expect(value.surfaces.shell).toMatchObject({
      assetId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      opacity: 0.5,
      fit: 'contain',
      enabled: true,
    })
  })
})

describe('resolveSurfaceConfig', () => {
  it('fills defaults for a missing surface', () => {
    expect(resolveSurfaceConfig(undefined)).toEqual(DEFAULT_SURFACE_CONFIG)
  })
})

describe('wallpaperAssetPath', () => {
  it('joins the HTTP prefix and asset id', () => {
    expect(wallpaperAssetPath('abc')).toBe(`${WALLPAPER_HTTP_PREFIX}/abc`)
  })
})

describe('coverScale', () => {
  it('covers the viewport on the larger axis', () => {
    expect(coverScale(200, 100, 100, 100)).toBe(1)
    expect(coverScale(100, 200, 100, 100)).toBe(1)
  })
})

describe('clampCropState', () => {
  it('keeps pan within the image and zoom within the supported range', () => {
    expect(clampCropState({
      naturalWidth: 200,
      naturalHeight: 100,
      scale: 0.5,
      offsetX: 999,
      offsetY: -999,
    }, 100, 100)).toEqual({
      naturalWidth: 200,
      naturalHeight: 100,
      scale: 1,
      offsetX: 50,
      offsetY: 0,
    })
    expect(clampCropState({
      naturalWidth: 100,
      naturalHeight: 100,
      scale: 8,
      offsetX: -999,
      offsetY: 999,
    }, 100, 100)).toMatchObject({ scale: 4, offsetX: -150, offsetY: 150 })
  })
})
