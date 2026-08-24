/** Filesystem store for wallpaper image bytes under `$DSH_HOME/ui-wallpapers`. */

import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import {
  WALLPAPER_MEDIA_TYPES, type WallpaperMediaType,
} from './wallpaper-paths.ts'

export {
  MAX_WALLPAPER_BYTES, parseWallpaperMediaType, WALLPAPER_HTTP_PREFIX, WALLPAPER_MEDIA_TYPES,
  wallpaperAssetPath, type WallpaperMediaType,
} from './wallpaper-paths.ts'

/**
 * Resolve the on-disk wallpaper root under the harness home.
 * @returns absolute directory path.
 */
export function wallpaperRoot(): string {
  return dshHomePath('ui-wallpapers')
}

/**
 * Ensure the wallpaper directory exists.
 * @returns absolute directory path.
 */
export async function ensureWallpaperRoot(): Promise<string> {
  const root = wallpaperRoot()
  await mkdir(root, { recursive: true })
  return root
}

/**
 * Persist one wallpaper blob and return its durable id.
 * @param bytes - image bytes (already size-checked by the caller).
 * @param mediaType - accepted media type.
 * @returns the new asset id.
 */
export async function saveWallpaperAsset(bytes: Buffer, mediaType: WallpaperMediaType): Promise<string> {
  const root = await ensureWallpaperRoot()
  const assetId = randomUUID().replaceAll('-', '')
  const ext = WALLPAPER_MEDIA_TYPES[mediaType]
  await writeFile(join(root, `${assetId}.${ext}`), bytes)
  return assetId
}

/**
 * Locate the on-disk file for one asset id.
 * @param assetId - durable asset id (hex uuid without dashes).
 * @returns absolute path and media type, or undefined when missing/invalid.
 */
export async function findWallpaperAsset(
  assetId: string,
): Promise<{ path: string; mediaType: WallpaperMediaType } | undefined> {
  if (!/^[a-f0-9]{32}$/i.test(assetId)) return undefined
  const root = await ensureWallpaperRoot()
  for (const [mediaType, ext] of Object.entries(WALLPAPER_MEDIA_TYPES) as [WallpaperMediaType, string][]) {
    const path = join(root, `${assetId}.${ext}`)
    try {
      await readFile(path)
      return { path, mediaType }
    } catch {
      // try next extension
    }
  }
  try {
    const names = await readdir(root)
    const match = names.find((name: string) => name.startsWith(`${assetId}.`))
    if (match === undefined) return undefined
    const ext = match.slice(assetId.length + 1)
    const mediaType = (Object.entries(WALLPAPER_MEDIA_TYPES) as [WallpaperMediaType, string][])
      .find(([, candidate]) => candidate === ext)?.[0]
    if (mediaType === undefined) return undefined
    return { path: join(root, match), mediaType }
  } catch {
    return undefined
  }
}

/**
 * Read one wallpaper asset's bytes.
 * @param assetId - durable asset id.
 * @returns bytes and media type, or undefined when missing.
 */
export async function readWallpaperAsset(
  assetId: string,
): Promise<{ bytes: Buffer; mediaType: WallpaperMediaType } | undefined> {
  const found = await findWallpaperAsset(assetId)
  if (found === undefined) return undefined
  return { bytes: await readFile(found.path), mediaType: found.mediaType }
}

/**
 * Delete one wallpaper asset from disk.
 * @param assetId - durable asset id.
 * @returns whether a file was removed.
 */
export async function deleteWallpaperAsset(assetId: string): Promise<boolean> {
  const found = await findWallpaperAsset(assetId)
  if (found === undefined) return false
  await unlink(found.path)
  return true
}
